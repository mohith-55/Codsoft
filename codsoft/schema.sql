-- CodSoft Certificate Verification System
-- Run this SQL in your Render PostgreSQL database

-- Certificates table
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

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Session table (for express-session with connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Seed: default admin (username: admin, password: admin123)
-- Password will be hashed by server on first run
-- But insert a placeholder so the app knows an admin exists
-- The server will handle proper hashing via /api/setup route

-- Seed sample certificate
INSERT INTO certificates (cert_no, student_name, domain, duration, start_date, award_date)
VALUES ('e695dbd', 'Harshith S', 'Python Programming Internship', '4 weeks', '05/Mar/2025', '05/Apr/2025')
ON CONFLICT (cert_no) DO NOTHING;
