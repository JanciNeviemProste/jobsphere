# 🚀 JobSphere - Vercel Deployment Guide

Kompletný návod na nasadenie JobSphere na Vercel.

## 1️⃣ Vercel Postgres (už máš ✅)

DATABASE_URL je už nastavené.

## 2️⃣ Vercel Blob (už máš ✅)

BLOB_READ_WRITE_TOKEN je už nastavené.

## 3️⃣ Vercel KV (Redis)

1. Storage → Create Database → KV
2. Connect Project → jobsphere
3. Auto-pridá: KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN

## 4️⃣ Resend (Emaily)

1. resend.com → Sign up
2. Create API Key
3. Pridaj do Vercel:
   - EMAIL_SERVICE=resend
   - RESEND_API_KEY=re_xxxx
   - EMAIL_FROM=JobSphere <noreply@yourdomain.com>

## 5️⃣ NextAuth

openssl rand -base64 32

Pridaj:
- NEXTAUTH_URL=https://jobsphere-khaki.vercel.app
- NEXTAUTH_SECRET=<generated>

## 6️⃣ Anthropic Claude

console.anthropic.com → API Keys

Pridaj:
- ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

✅ HOTOVO! Push a deploy.
