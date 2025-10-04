# 🚀 Vercel Setup Instructions

## ⚠️ IMPORTANT: Vercel Project Settings

### 1. **Root Directory** (KRITICKÉ!)
```
Settings → General → Root Directory: apps/web
```

### 2. **Framework Preset**
```
Framework: Next.js (auto-detected)
```

### 3. **Build Settings** (nechaj AUTO!)
```
Build Command: (leave empty - auto-detected from package.json)
Output Directory: (leave empty - auto .next)
Install Command: (leave empty - auto pnpm install)
```

### 4. **Node.js Version**
```
Node.js Version: 20.x (auto from .node-version file)
```

---

## 📋 Environment Variables

Vo Vercel Dashboard → Settings → Environment Variables nastav:

### Required Variables (ALL ENVIRONMENTS):

```bash
# App URLs
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_API_URL=https://your-railway-api.railway.app

# Auth
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=https://your-app.vercel.app

# Database (for Prisma Client)
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis (for sessions)
REDIS_URL=redis://default:pass@host:6379
```

### Optional Variables (Production):

```bash
# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_SENTRY_DSN=https://...
```

---

## ✅ Deploy Checklist

- [ ] Root Directory = `apps/web`
- [ ] Framework = Next.js
- [ ] Build/Install Commands = (empty/auto)
- [ ] Environment Variables nastavené
- [ ] Push na GitHub → Auto-deploy

---

## 🐛 Troubleshooting

### If build fails with pnpm errors:
1. Check Root Directory is `apps/web`
2. Clear build cache: Deployments → Redeploy → ❌ Use existing Build Cache
3. Check pnpm version: Should auto-detect from `packageManager` field

### If "Module not found" errors:
Dependencies are in root package.json but referenced from apps/web.
This is normal for monorepos - Vercel will handle it with Root Directory = `apps/web`.

---

## 📞 Support

See full documentation: `docs/VERCEL-DEPLOYMENT.md`
