# 🚀 Vercel Deployment Checklist

## Pre-Deployment Checklist

### ✅ **1. Vercel Project Settings**

#### General Settings
```
Framework Preset: Next.js
Root Directory: apps/web
Node.js Version: 20.x
Package Manager: pnpm
```

#### Build & Development Settings
```
Build Command: pnpm build
Output Directory: .next
Install Command: pnpm install
Development Command: pnpm dev
```

---

### ✅ **2. Environment Variables** (KRITICKÉ!)

V Vercel Dashboard → Settings → Environment Variables nastav:

#### **Required (Production + Preview + Development)**

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `NEXT_PUBLIC_APP_URL` | `https://jobsphere.vercel.app` | Your Vercel production URL |
| `NEXT_PUBLIC_API_URL` | `https://jobsphere-api.up.railway.app` | Backend API URL (Railway) |
| `NEXTAUTH_SECRET` | `<32+ char random string>` | Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://jobsphere.vercel.app` | Same as NEXT_PUBLIC_APP_URL |
| `DATABASE_URL` | `postgresql://user:pass@host/db` | Neon/Supabase connection string |
| `REDIS_URL` | `redis://default:pass@host:6379` | Upstash Redis URL |

#### **Optional (Production only)**

| Variable | Example | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Stripe public key |
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_...` | PostHog analytics |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://...` | Sentry error tracking |

#### **Jak nastaviť env vars v Vercel:**

**Option A: Cez UI** (Odporúčané)
1. Vercel Dashboard → Your Project
2. Settings → Environment Variables
3. Add Variable
   - Name: `NEXT_PUBLIC_APP_URL`
   - Value: `https://your-app.vercel.app`
   - Environments: ✅ Production, ✅ Preview, ✅ Development
4. Save
5. Repeat pre všetky premenné

**Option B: Cez CLI**
```bash
# Login
vercel login

# Link projekt
vercel link

# Pridaj env var pre Production
vercel env add NEXT_PUBLIC_APP_URL production
# Paste value when prompted

# Pridaj pre Preview
vercel env add NEXT_PUBLIC_APP_URL preview

# Pridaj pre Development
vercel env add NEXT_PUBLIC_APP_URL development

# Pull env vars lokálne (vytvorí .env.local)
vercel env pull
```

**Option C: Hromadný import**
```bash
# Vytvor env-vars.txt
NEXT_PUBLIC_APP_URL=https://jobsphere.vercel.app
NEXT_PUBLIC_API_URL=https://api.railway.app
NEXTAUTH_SECRET=your-secret-here
# ... atď

# Import
cat env-vars.txt | while read line; do
  vercel env add production <<< "$line"
done
```

---

### ✅ **3. Monorepo Configuration**

#### Ensure `vercel.json` is correct:
```json
{
  "buildCommand": "cd ../.. && pnpm turbo run build --filter=@jobsphere/web",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

#### For Turborepo caching:
```bash
# Add to Vercel env vars
TURBO_TOKEN=<get from vercel.com/account/tokens>
TURBO_TEAM=<your-team-slug>
```

---

### ✅ **4. Pre-Build Validácia**

#### Test lokálne PRED deployom:
```bash
# 1. Nastav env vars
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local with real values

# 2. Verify env vars
pnpm --filter @jobsphere/web verify:env

# 3. Test build
pnpm --filter @jobsphere/web build

# 4. Test production build lokálne
pnpm --filter @jobsphere/web start
# Open http://localhost:3000
```

#### Ak build zlyháva:
```bash
# Skip env validation (debugging only)
pnpm --filter @jobsphere/web build:skip-verify

# Check type errors
pnpm --filter @jobsphere/web typecheck

# Check linting
pnpm --filter @jobsphere/web lint
```

---

### ✅ **5. Deploy Process**

#### Automatický deploy (Odporúčané):
1. Push na GitHub → Vercel auto-deploy
2. Preview URL pre každú PR
3. Production deploy na `main` branch

#### Manuálny deploy:
```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

---

### ✅ **6. Post-Deploy Verifikácia**

#### Check deployment:
```bash
# Get deployment URL
vercel ls

# Check deployment logs
vercel logs <deployment-url>

# Test production
curl https://your-app.vercel.app/api/health
```

#### Verify in browser:
- [ ] Homepage loads (`https://your-app.vercel.app`)
- [ ] API proxy works (`/api/...` → Railway)
- [ ] Auth flow funguje (login/signup)
- [ ] Environment variables sú správne (check browser console)
- [ ] No CORS errors v Network tab
- [ ] CSP headers active (Security tab)

---

### ✅ **7. Troubleshooting**

#### Build fails: "Invalid environment variables"
```bash
# Fix: Nastav chýbajúce env vars v Vercel Settings
# Check error message pre missing vars
```

#### Build fails: "Module not found"
```bash
# Fix: Ensure dependencies v package.json
pnpm install
git add package.json pnpm-lock.yaml
git commit -m "Update dependencies"
git push
```

#### Runtime: "Cannot connect to API"
```bash
# Fix: Check NEXT_PUBLIC_API_URL
# Verify Railway API is running: curl https://api-url/health
# Check CORS in Railway API
```

#### "Secret does not exist" error
```bash
# Fix: Remove Secret syntax from vercel.json
# Use direct env vars cez Vercel UI namiesto @secret-name
```

---

## Common Errors & Fixes

### ❌ Error: "Framework Preset detection failed"
**Fix:**
```bash
# Vercel Settings → General → Framework Preset → Next.js
# Root Directory → apps/web
```

### ❌ Error: "NEXT_PUBUC_APP_URL references Secret..."
**Fix:**
```json
// vercel.json - REMOVE env section with @secrets
{
  "buildCommand": "...",
  // Delete this:
  // "env": { "NEXT_PUBLIC_APP_URL": "@next-public-app-url" }
}
```
Then set vars via Vercel UI instead.

### ❌ Error: "pnpm: command not found"
**Fix:**
```bash
# Vercel auto-detects pnpm from packageManager field in package.json
# Ensure root package.json has:
{
  "packageManager": "pnpm@9.0.0"
}
```

### ❌ Error: "Turborepo cache miss"
**Fix:**
```bash
# Add to Vercel env vars:
TURBO_TOKEN=<token>
TURBO_TEAM=<team>
```

---

## Performance Optimization

### Enable Turbo Cache
```bash
# Get token
vercel link
# Copy TURBO_TOKEN from output

# Add to Vercel env vars
```

### Edge Functions (Optional)
```typescript
// app/api/route.ts
export const runtime = 'edge' // Deploy to Edge
```

### Image Optimization
```typescript
// next.config.js
module.exports = {
  images: {
    domains: ['your-cdn.com'],
    formats: ['image/avif', 'image/webp'],
  },
}
```

---

## Security Checklist

- [ ] `NEXTAUTH_SECRET` is random 32+ char string
- [ ] No sensitive data in `NEXT_PUBLIC_*` vars
- [ ] HTTPS enforced (Vercel auto)
- [ ] CSP headers configured (vercel.json)
- [ ] CORS restricted to your domain
- [ ] Rate limiting v API (Railway)

---

## Monitoring

### Vercel Analytics
```bash
# Enable in Vercel Dashboard → Analytics
# Add to app:
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### Logs
```bash
# Real-time logs
vercel logs --follow

# Filter by function
vercel logs --filter api/trpc

# Download logs
vercel logs > logs.txt
```

---

## Cost Optimization

### Free Tier Limits:
- 100 GB bandwidth/month
- 100 GB-hours serverless execution
- 6,000 build minutes/month

### Stay under limits:
```bash
# Use ISR instead of SSR
export const revalidate = 3600 // 1 hour cache

# Edge functions (faster, cheaper)
export const runtime = 'edge'

# Image optimization
import Image from 'next/image'
```

---

## Rollback Procedure

### Revert to previous deployment:
```bash
# List deployments
vercel ls

# Promote previous deployment
vercel promote <previous-deployment-url>
```

---

**Last Updated:** 2025-01-04
**Author:** DevOps Team
