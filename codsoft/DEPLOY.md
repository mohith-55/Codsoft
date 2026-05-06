# 🚀 CodSoft — Render.com Deployment Guide

## What's in this project

```
codsoft/
├── server.js          ← Express backend + all API routes
├── package.json       ← Node.js dependencies
├── .env.example       ← Copy to .env for local dev
├── schema.sql         ← Database schema reference
├── .gitignore
└── public/
    ├── index.html     ← Main website (all pages)
    └── admin.html     ← Hidden admin panel
```

---

## STEP 1 — Push to GitHub

1. Create a new repo on https://github.com (e.g. `codsoft-site`)
2. In the project folder, run:

```bash
git init
git add .
git commit -m "Initial CodSoft website"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/codsoft-site.git
git push -u origin main
```

---

## STEP 2 — Create PostgreSQL Database on Render

1. Go to https://render.com → Sign up / Log in
2. Click **"New +"** → **"PostgreSQL"**
3. Fill in:
   - **Name:** `codsoft-db`
   - **Database:** `codsoft`
   - **User:** `codsoft_user`
   - **Region:** Singapore (closest to India)
   - **Plan:** Free
4. Click **"Create Database"**
5. Wait ~1 min, then copy the **"External Database URL"** — looks like:
   `postgresql://codsoft_user:XXXX@dpg-xxx.singapore-postgres.render.com/codsoft`

---

## STEP 3 — Deploy Web Service on Render

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub account and select `codsoft-site` repo
3. Fill in:
   - **Name:** `codsoft-app`
   - **Region:** Singapore
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free

---

## STEP 4 — Set Environment Variables

In your Web Service settings → **"Environment"** tab, add:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | (paste the External DB URL from Step 2) |
| `SESSION_SECRET` | any long random string, e.g. `codsoft-2026-xyz-secret-abc` |
| `ADMIN_USERNAME` | `admin` (or your preferred username) |
| `ADMIN_PASSWORD` | `yourStrongPassword123` |
| `NODE_ENV` | `production` |

Click **"Save Changes"**

---

## STEP 5 — Deploy!

1. Click **"Manual Deploy"** → **"Deploy latest commit"**
2. Watch the logs — you should see:
   ```
   ✅ Database initialized
   ✅ Default admin created: admin
   🚀 CodSoft server running on port 10000
   ```
3. Your site is live at: `https://codsoft-app.onrender.com`

---

## 🔗 Your URLs

| Page | URL |
|------|-----|
| Main Website | `https://codsoft-app.onrender.com` |
| Verification | `https://codsoft-app.onrender.com` → click Verification |
| **Admin Panel** | `https://codsoft-app.onrender.com/secret-admin-panel` |

> ⚠️ **The admin panel is hidden** — it's only accessible via the `/secret-admin-panel` URL.
> Do NOT share this URL publicly. It's not linked anywhere on the main site.

---

## 🔐 Admin Credentials

- URL: `https://your-app.onrender.com/secret-admin-panel`
- Username: whatever you set in `ADMIN_USERNAME`
- Password: whatever you set in `ADMIN_PASSWORD`

---

## 💻 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env
# Edit .env with your local PostgreSQL URL

# 3. Start server
npm run dev
# Site: http://localhost:3000
# Admin: http://localhost:3000/secret-admin-panel
```

---

## ⚠️ Free Tier Notes

- Render free tier **spins down after 15 min of inactivity**
- First request after spin-down takes ~30 seconds
- Upgrade to "Starter" ($7/mo) for always-on
- Free PostgreSQL database expires after **90 days** on free plan

---

## 🛠 Adding More Admins

Connect to your database using the Render dashboard shell and run:

```sql
-- The server auto-hashes passwords, so add via the API
-- Or use the Render shell:
INSERT INTO admin_users (username, password_hash)
VALUES ('newadmin', '$2b$12$HASHED_PASSWORD_HERE');
```

Or simply update `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars to change the default admin credentials (a new admin will be created on next deploy).
