# 🚀 JobSphere Deployment Guide

## Architektúra Deploymentu

JobSphere používa **hybridný deployment model**:

- **Frontend (Next.js)** → Vercel
- **Backend (Fastify API + Workers)** → Railway/Render
- **Database** → Neon/Supabase (PostgreSQL)
- **Redis** → Upstash
- **Storage** → AWS S3 / Cloudflare R2

---

## 📋 Pred Deploymentom

### 1. Externé Služby

Zaregistruj sa a nastav:

#### Database - Neon (PostgreSQL)
- URL: https://neon.tech
- Free tier: 0.5 GB, 1 projekt
- **Dôležité:** Zapni pgvector extension
```sql
CREATE EXTENSION vector;
```

#### Redis - Upstash
- URL: https://upstash.com
- Free tier: 10,000 commands/day
- Skopíruj: `REDIS_URL`

#### AI - Anthropic
- URL: https://console.anthropic.com
- Vytvor API key
- Skopíruj: `ANTHROPIC_API_KEY`

#### Storage - AWS S3 / Cloudflare R2
- AWS S3: https://aws.amazon.com/s3
- Cloudflare R2: https://cloudflare.com/products/r2
- Vytvor bucket a API keys

#### Billing - Stripe (Voliteľné)
- URL: https://stripe.com
- Vytvor produkty a ceny
- Nastav webhook endpoint

---

## 🎯 Option 1: Vercel (Frontend) + Railway (Backend)

### **Step 1: Deploy Backend na Railway**

#### 1.1 Vytvor Railway projekt
```bash
# Nainštaluj Railway CLI
npm i -g @railway/cli

# Login
railway login

# Vytvor nový projekt
railway init
```

#### 1.2 Pripoj GitHub repo
```bash
railway link
```

#### 1.3 Pridaj služby
V Railway dashboard:

**PostgreSQL:**
- Add Service → Database → PostgreSQL
- Skopíruj `DATABASE_URL`

**Redis:**
- Add Service → Database → Redis
- Alebo použi Upstash (externý)

#### 1.4 Nastav Environment Variables

```bash
# Core
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
NODE_ENV=production

# Security
JWT_SECRET=<generuj-openssl-rand-base64-32>
COOKIE_SECRET=<generuj-openssl-rand-base64-32>

# AI
ANTHROPIC_API_KEY=sk-ant-api03-...

# Storage
S3_BUCKET=jobsphere-uploads
S3_REGION=eu-central-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# Frontend URL (Vercel)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Stripe (optional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### 1.5 Deploy
```bash
railway up
```

Railway automaticky:
- Detekuje monorepo
- Buildne pomocou `pnpm build`
- Spustí API na porte 4000

#### 1.6 Získaj API URL
```bash
railway domain
# Output: https://jobsphere-api.up.railway.app
```

---

### **Step 2: Deploy Frontend na Vercel**

#### 2.1 Import GitHub repo
- Choď na https://vercel.com/new
- Import `JanciNeviemProste/jobsphere`

#### 2.2 Configure Project
```
Framework Preset: Next.js
Root Directory: apps/web
Build Command: pnpm --filter @jobsphere/web build
Output Directory: apps/web/.next
Install Command: pnpm install --filter @jobsphere/web
```

#### 2.3 Environment Variables

```bash
# App URLs
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_API_URL=https://jobsphere-api.up.railway.app

# Auth
NEXTAUTH_SECRET=<generuj-openssl-rand-base64-32>
NEXTAUTH_URL=https://your-app.vercel.app

# Database (pre Prisma client)
DATABASE_URL=postgresql://...

# Redis (pre session store)
REDIS_URL=redis://...

# Stripe (optional)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

#### 2.4 Aktualizuj vercel.json

Zmeň rewrite destination na Railway URL:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://jobsphere-api.up.railway.app/api/:path*"
    }
  ]
}
```

#### 2.5 Deploy
```bash
vercel --prod
```

---

### **Step 3: Spoj Services**

#### 3.1 CORS v Railway API

Pridaj Vercel URL do CORS whitelist (`apps/api/src/index.ts`):
```typescript
await server.register(cors, {
  origin: [
    'http://localhost:3000',
    'https://your-app.vercel.app',
    'https://your-app-*.vercel.app', // Preview deployments
  ],
  credentials: true,
})
```

Re-deploy Railway:
```bash
railway up
```

#### 3.2 Stripe Webhooks

V Stripe dashboard:
```
Webhook URL: https://jobsphere-api.up.railway.app/webhooks/stripe
Events: customer.subscription.*, invoice.*, payment_intent.*
```

#### 3.3 Database Migrations

```bash
# Z lokálneho env
export DATABASE_URL="postgresql://..."
pnpm db:migrate
pnpm db:seed
```

---

## 🎯 Option 2: Render (Full Stack)

### Deploy na Render.com

#### 1. Vytvor Blueprint
`render.yaml`:
```yaml
services:
  # API
  - type: web
    name: jobsphere-api
    env: docker
    dockerfilePath: ./Dockerfile
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: jobsphere-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: jobsphere-redis
          type: redis
          property: connectionString

  # Workers
  - type: worker
    name: jobsphere-workers
    env: docker
    dockerfilePath: ./Dockerfile
    dockerCommand: node apps/workers/dist/index.js

  # Web
  - type: web
    name: jobsphere-web
    env: node
    buildCommand: pnpm --filter @jobsphere/web build
    startCommand: pnpm --filter @jobsphere/web start

databases:
  - name: jobsphere-db
    databaseName: jobsphere
    user: jobsphere
    plan: starter

  - name: jobsphere-redis
    plan: starter
```

#### 2. Deploy
```bash
# Z GitHub repo
render deploy
```

---

## 🎯 Option 3: Fly.io (Full Stack)

### Deploy na Fly.io

#### 1. Nainštaluj Fly CLI
```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

#### 2. Vytvor fly.toml
```toml
app = "jobsphere"
primary_region = "fra"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"

[[services]]
  internal_port = 4000
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "connections"
    hard_limit = 1000
    soft_limit = 500

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

#### 3. Vytvor PostgreSQL
```bash
fly postgres create --name jobsphere-db --region fra
fly postgres attach jobsphere-db
```

#### 4. Deploy
```bash
fly deploy
fly open
```

---

## 🔧 Post-Deployment Checklist

### ✅ Verifikuj Deployment

- [ ] Frontend dostupný na Vercel URL
- [ ] API health check: `https://api-url/health`
- [ ] Database connection funguje
- [ ] Redis connection funguje
- [ ] Workers bežia (check logs)

### ✅ Security

- [ ] HTTPS enabled (Vercel/Railway auto)
- [ ] CORS správne nastavený
- [ ] Environment variables sú secret
- [ ] Rate limiting aktívny
- [ ] CSP headers nastavené

### ✅ Monitoring

```bash
# Railway logs
railway logs

# Vercel logs
vercel logs

# Database metrics
# Check Neon/Supabase dashboard
```

### ✅ Webhooks

- [ ] Stripe webhook URL nastavený
- [ ] Webhook secret správny
- [ ] Test webhook: `stripe trigger payment_intent.succeeded`

---

## 📊 Scaling

### Railway
- **Vertical:** Settings → Resources → Upgrade RAM/CPU
- **Horizontal:** Add workers → Duplicate service

### Vercel
- Automatic scaling (serverless)
- Edge functions pre low latency

---

## 💰 Cost Estimate

### Free Tier (Development)
- **Vercel:** Free (Hobby)
- **Railway:** $5/month credit
- **Neon:** Free (0.5GB)
- **Upstash:** Free (10k req/day)
- **Total:** ~$5/month

### Production (Low Traffic)
- **Vercel:** $20/month (Pro)
- **Railway:** $20/month (512MB API + Workers)
- **Neon:** $19/month (Scaler)
- **Upstash:** $10/month (10M req/month)
- **S3:** ~$5/month
- **Total:** ~$74/month

### Production (High Traffic)
- **Vercel:** $20/month (Pro)
- **Railway:** $50/month (2GB API + 1GB Workers)
- **Neon:** $69/month (Business)
- **Upstash:** $50/month (100M req/month)
- **S3:** ~$20/month
- **Total:** ~$209/month

---

## 🐛 Troubleshooting

### Build Fails na Vercel
```bash
# Skontroluj build command
pnpm --filter @jobsphere/web build

# Check dependencies
pnpm install --filter @jobsphere/web --prod=false
```

### API nedostupné z Frontend
```bash
# Verify CORS
curl -H "Origin: https://your-app.vercel.app" \
  https://api-url/health -v

# Check Railway logs
railway logs -f
```

### Database Connection Error
```bash
# Test connection
psql $DATABASE_URL

# Check pgvector
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Workers nie sú active
```bash
# Check Redis connection
redis-cli -u $REDIS_URL ping

# Check worker logs
railway logs --service workers
```

---

## 📚 Ďalšie Zdroje

- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Neon Docs](https://neon.tech/docs)
- [Upstash Docs](https://docs.upstash.com)

---

**Úspešný deployment! 🎉**
