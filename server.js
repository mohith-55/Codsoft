require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── DATABASE ───────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false
});

// ─── MIDDLEWARE ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new pgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'codsoft-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: false // set true if using HTTPS only
  }
}));

// ─── DB INIT ────────────────────────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS certificates (
        id SERIAL PRIMARY KEY,
        cert_no VARCHAR(100) UNIQUE NOT NULL,
        student_name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) NOT NULL,
        duration VARCHAR(100),
        start_date VARCHAR(100),
        award_date VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
    `).catch(() => {}); // ignore if exists

    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `).catch(() => {});

    // Seed default admin from env
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    const existing = await client.query('SELECT id FROM admin_users WHERE username = $1', [adminUser]);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(adminPass, 12);
      await client.query(
        'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)',
        [adminUser, hash]
      );
      console.log(`✅ Default admin created: ${adminUser}`);
    }

    // Seed sample certificate
    await client.query(`
      INSERT INTO certificates (cert_no, student_name, domain, duration, start_date, award_date)
      VALUES ('e695dbd', 'Harshith S', 'Python Programming Internship', '4 weeks', '05/Mar/2025', '05/Apr/2025')
      ON CONFLICT (cert_no) DO NOTHING;
    `);

    console.log('✅ Database initialized');
  } finally {
    client.release();
  }
}

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// ─── API: CERTIFICATE VERIFICATION (PUBLIC) ──────────────────
app.get('/api/verify/:certNo', async (req, res) => {
  try {
    const { certNo } = req.params;
    const result = await pool.query(
      'SELECT * FROM certificates WHERE LOWER(cert_no) = LOWER($1)',
      [certNo.trim()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ found: false, message: 'Certificate not found' });
    }
    const cert = result.rows[0];
    res.json({
      found: true,
      data: {
        certNo: cert.cert_no,
        name: cert.student_name,
        domain: cert.domain,
        duration: cert.duration,
        start: cert.start_date,
        award: cert.award_date
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── API: ADMIN LOGIN ─────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM admin_users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const admin = result.rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.adminId = admin.id;
    req.session.adminUser = admin.username;
    res.json({ success: true, username: admin.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── API: ADMIN LOGOUT ────────────────────────────────────────
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ─── API: ADMIN CHECK SESSION ─────────────────────────────────
app.get('/api/admin/session', (req, res) => {
  if (req.session && req.session.adminId) {
    res.json({ loggedIn: true, username: req.session.adminUser });
  } else {
    res.json({ loggedIn: false });
  }
});

// ─── API: GET ALL CERTIFICATES (ADMIN) ───────────────────────
app.get('/api/admin/certificates', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM certificates ORDER BY created_at DESC');
    res.json(result.rows.map(r => ({
      id: r.id,
      certNo: r.cert_no,
      name: r.student_name,
      domain: r.domain,
      duration: r.duration,
      start: r.start_date,
      award: r.award_date
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── API: ADD CERTIFICATE (ADMIN) ────────────────────────────
app.post('/api/admin/certificates', requireAuth, async (req, res) => {
  try {
    const { certNo, name, domain, duration, start, award } = req.body;
    if (!certNo || !name || !domain) return res.status(400).json({ error: 'certNo, name, domain are required' });
    const result = await pool.query(
      `INSERT INTO certificates (cert_no, student_name, domain, duration, start_date, award_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [certNo.trim(), name.trim(), domain.trim(), duration || '', start || '', award || '']
    );
    const r = result.rows[0];
    res.json({ success: true, data: { id: r.id, certNo: r.cert_no, name: r.student_name, domain: r.domain, duration: r.duration, start: r.start_date, award: r.award_date } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Certificate number already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── API: UPDATE CERTIFICATE (ADMIN) ─────────────────────────
app.put('/api/admin/certificates/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { certNo, name, domain, duration, start, award } = req.body;
    if (!certNo || !name || !domain) return res.status(400).json({ error: 'certNo, name, domain are required' });
    const result = await pool.query(
      `UPDATE certificates SET cert_no=$1, student_name=$2, domain=$3, duration=$4,
       start_date=$5, award_date=$6, updated_at=NOW() WHERE id=$7 RETURNING *`,
      [certNo.trim(), name.trim(), domain.trim(), duration || '', start || '', award || '', id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = result.rows[0];
    res.json({ success: true, data: { id: r.id, certNo: r.cert_no, name: r.student_name, domain: r.domain, duration: r.duration, start: r.start_date, award: r.award_date } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Certificate number already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── API: DELETE CERTIFICATE (ADMIN) ─────────────────────────
app.delete('/api/admin/certificates/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM certificates WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── SERVE FRONTEND ──────────────────────────────────────────
// Admin page only accessible via /secret-admin-panel route
app.get('/secret-admin-panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Catch-all: serve main app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START ───────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 CodSoft server running on port ${PORT}`));
}).catch(err => {
  console.error('❌ DB init failed:', err);
  process.exit(1);
});
