# 🚀 JobSphere Deployment Guide

Quick guide to deploy JobSphere to production on Vercel.

---

## 📋 Prerequisites

- Vercel account
- GitHub repository connected
- 15 minutes

---

## 🗄️ Step 1: Database Setup (5 min)

### Create Vercel Postgres

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Storage** tab
3. Click **Create Database**
4. Select **Postgres**
5. Choose region (same as your app deployment)
6. Click **Create**

### Connect to Project

1. In database settings, click **Connect Project**
2. Select your `jobsphere` project
3. Environment will be set to **Production**
4. Click **Connect**

✅ `DATABASE_URL` is now automatically added to your environment variables!

---

## 📦 Step 2: Vercel Blob Storage (5 min)

### Create Blob Store

1. Go to **Storage** tab in Vercel Dashboard
2. Click **Create Database**
3. Select **Blob**
4. Click **Create**

### Connect to Project

1. In Blob settings, click **Connect Project**
2. Select your `jobsphere` project
3. Click **Connect**

### Enable Blob Upload

1. Go to **Project Settings** → **Environment Variables**
2. Add new variable:
   - Name: `NEXT_PUBLIC_USE_VERCEL_BLOB`
   - Value: `true`
   - Environment: **Production**

✅ Blob storage is now configured!

---

## 🔐 Step 3: Email Service (5 min - Optional)

### Option A: Resend (Recommended)

1. Sign up at [Resend.com](https://resend.com)
2. Create API Key
3. Add to Vercel Environment Variables:
   - `EMAIL_SERVICE` = `resend`
   - `RESEND_API_KEY` = `re_your_api_key`
   - `EMAIL_FROM` = `JobSphere <noreply@yourdomain.com>`

### Option B: SendGrid

1. Sign up at [SendGrid.com](https://sendgrid.com)
2. Create API Key
3. Add to Vercel Environment Variables:
   - `EMAIL_SERVICE` = `sendgrid`
   - `SENDGRID_API_KEY` = `SG.your_api_key`
   - `EMAIL_FROM` = `noreply@yourdomain.com`

### Option C: Development (Log Only)

Keep default:
- `EMAIL_SERVICE` = `log`

---

## 🔄 Step 4: Deploy & Migrate

### Trigger Deployment

1. Push any commit to `master` branch:
   ```bash
   git commit --allow-empty -m "Trigger deployment"
   git push origin master
   ```

2. OR manually in Vercel Dashboard:
   - Go to **Deployments**
   - Click **Redeploy**

### Migrations Run Automatically

Prisma migrations will execute automatically during build:
```bash
prisma generate
prisma migrate deploy  # <- Runs automatically
```

✅ Database tables are now created!

---

## 🌱 Step 5: Seed Data (3 min)

### Connect to Production Database

1. In Vercel Dashboard → **Storage** → Your Postgres DB
2. Click **`.env.local`** tab
3. Copy the connection string

### Run Seed Script Locally

```bash
cd apps/web

# Set production DATABASE_URL
export DATABASE_URL="postgres://..."

# Run seed
pnpm db:seed
```

### What Gets Created

- ✅ 3 Organizations (TechCorp SK, StartupHub, DataSolutions)
- ✅ 6 Users (3 employers + 3 candidates)
- ✅ 3 Org Memberships
- ✅ 6 Jobs (various positions)
- ✅ 3 Applications with timeline events

### Demo Credentials

**Employers (password: `demo123`):**
- `admin@techcorp.sk` (TechCorp SK)
- `recruiter@startuphub.io` (StartupHub)
- `hr@datasolutions.eu` (DataSolutions)

**Candidates (password: `demo123`):**
- `jan.novak@example.com`
- `maria.kovacova@example.com`
- `peter.szabo@example.com`

---

## ✅ Step 6: Verify Deployment

### Test Core Features

1. **Homepage** - Visit `https://jobsphere-khaki.vercel.app`
2. **Login** - Try `admin@techcorp.sk` / `demo123`
3. **Job Listings** - Browse `/jobs`
4. **Create Job** - Go to `/employer/jobs/new`
5. **Apply** - Test application form with CV upload

### Check Logs

Vercel Dashboard → **Deployments** → Latest → **Runtime Logs**

Look for:
```
✅ Prisma Client generated
✅ Migrations applied
✅ Build successful
```

---

## 🔧 Optional: Google OAuth (10 min)

### 1. Create Google OAuth App

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: `JobSphere`
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs:
   ```
   https://jobsphere-khaki.vercel.app/api/auth/callback/google
   ```

### 2. Add to Vercel

1. Copy **Client ID** and **Client Secret**
2. Add to Vercel Environment Variables:
   - `GOOGLE_CLIENT_ID` = `your_client_id`
   - `GOOGLE_CLIENT_SECRET` = `your_client_secret`

### 3. Redeploy

```bash
git commit --allow-empty -m "Add Google OAuth"
git push origin master
```

---

## 📊 Environment Variables Checklist

### Required (Already Set)

- ✅ `DATABASE_URL` (auto-set by Vercel Postgres)
- ✅ `BLOB_READ_WRITE_TOKEN` (auto-set by Vercel Blob)
- ✅ `NEXTAUTH_URL` (auto-detected)
- ✅ `NEXTAUTH_SECRET` (should already exist)
- ✅ `NEXT_PUBLIC_APP_URL` (should already exist)
- ✅ `NEXT_PUBLIC_API_URL` (should already exist)

### Recommended

- 🟡 `NEXT_PUBLIC_USE_VERCEL_BLOB=true`
- 🟡 `EMAIL_SERVICE=resend` (or `sendgrid` / `log`)
- 🟡 `RESEND_API_KEY` (if using Resend)
- 🟡 `EMAIL_FROM` (if using email service)

### Optional

- ⚪ `GOOGLE_CLIENT_ID`
- ⚪ `GOOGLE_CLIENT_SECRET`
- ⚪ `SENTRY_DSN` (for error tracking)

---

## 🎉 Done!

Your JobSphere is now live and fully functional!

**Live URL:** https://jobsphere-khaki.vercel.app

### Quick Links

- 🏠 [Homepage](https://jobsphere-khaki.vercel.app)
- 💼 [Jobs](https://jobsphere-khaki.vercel.app/jobs)
- 🔐 [Login](https://jobsphere-khaki.vercel.app/login)
- 💰 [Pricing](https://jobsphere-khaki.vercel.app/pricing)

---

## 🐛 Troubleshooting

### Build Fails

**Error:** `Prisma Client not generated`
```bash
# Solution: Ensure build script includes prisma generate
"build": "prisma generate && next build"
```

**Error:** `DATABASE_URL not found`
```bash
# Solution: Reconnect Postgres to project
Vercel Dashboard → Storage → Postgres → Connect Project
```

### Migrations Fail

**Error:** `Migration failed to apply`
```bash
# Solution: Reset database (CAUTION: deletes data)
npx prisma migrate reset --skip-seed
npx prisma migrate deploy
```

### Seed Fails

**Error:** `Unique constraint violation`
```bash
# Solution: Data already exists, skip or reset
# Option 1: Skip seed (data already there)
# Option 2: Clear data first
npx prisma migrate reset
pnpm db:seed
```

### Upload Fails

**Error:** `Blob upload failed`
```bash
# Solution: Check Blob connection
1. Verify BLOB_READ_WRITE_TOKEN is set
2. Verify NEXT_PUBLIC_USE_VERCEL_BLOB=true
3. Redeploy
```

---

## 📞 Support

Issues? Check:
- [README.md](README.md) - Full documentation
- [COMPLETE.md](COMPLETE.md) - Feature checklist
- [GitHub Issues](https://github.com/yourusername/jobsphere/issues)

---

**Made with ❤️ by the JobSphere Team**
