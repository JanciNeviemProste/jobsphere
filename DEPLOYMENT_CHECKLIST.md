# 🚀 JobSphere - Deployment Checklist

**Aktuálny stav:** 99/100 ✅
**Pripravené na:** Production Deployment
**Posledná aktualizácia:** 2025-10-08

---

## 📋 PRE-DEPLOYMENT KONTROLA

### ✅ Kód - HOTOVÉ
- [x] **TypeScript:** 100% coverage, 0 errors
- [x] **Testy:** 241/241 passing (100%)
- [x] **Build:** Projekt sa builduje bez chýb
- [x] **Linting:** Kód spĺňa štandardy
- [x] **Schema Alignment:** Všetky súbory zosúladené s Prisma schémou

### 🚨 KRITICKÉ - VYŽADUJE AKCIU

#### 1. DATABASE MIGRATION (BLOKUJE DEPLOYMENT!)

**Status:** ⚠️ NEPREVEDENÉ - MUSÍ SA UROBIŤ PRED DEPLOYMENTOM

**Čo sa stane bez migrácie:**
- ❌ Aplikácia spadne pri štarte
- ❌ Chyba: `column "orgId" does not exist`
- ❌ Nefunkčná databáza

**Kroky na prevedenie:**

```bash
# 1. BACKUP DATABÁZY (POVINNÉ!)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# 2. Spustenie migrácie
cd apps/web
npx prisma migrate deploy

# 3. Overenie migrácie
npx prisma migrate status

# 4. Generovanie Prisma Client
npx prisma generate
```

**Čo migrácia robí:**
- Premenuje `organizationId` → `orgId` v 4 modeloch (OrgMember, Job, Subscription, Invoice)
- Aktualizuje indexy
- Zachová všetky dáta (jednoduchý RENAME COLUMN)

**Detailný návod:** Pozri `MIGRATION_GUIDE.md`

---

## 🔧 DEPLOYMENT KROKY

### Pre Vercel Deployment:

#### Krok 1: Environment Variables ✅
Skontroluj, že máš nastavené všetky potrebné premenné v Vercel dashboard:

**Povinné:**
```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://your-domain.com
REDIS_URL=...
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://your-domain.com/api
```

**Optional (ale odporúčané):**
```
OPENAI_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
SENTRY_DSN=...
POSTHOG_KEY=...
```

#### Krok 2: Database Migration ⚠️ KRITICKÉ
```bash
# V Vercel Dashboard → Storage → Postgres → Console
# Alebo lokálne s production DATABASE_URL:

export DATABASE_URL="your-production-database-url"
cd apps/web
npx prisma migrate deploy
```

#### Krok 3: Deploy Code ✅
```bash
git add .
git commit -m "chore: Production deployment - v1.0"
git push origin main
```

Vercel automaticky:
- Detekuje push
- Spustí build
- Nasadí do produkcie

#### Krok 4: Post-Deployment Verification
```bash
# Skontroluj logy
vercel logs --prod

# Otestuj critical endpoints
curl https://your-domain.com/api/health
curl https://your-domain.com/api/jobs
```

---

## 🔍 POST-DEPLOYMENT KONTROLA

### Critical Flows Testing (5-10 minút)

#### 1. User Authentication
- [ ] Registrácia nového užívateľa
- [ ] Prihlásenie
- [ ] Odhlásenie
- [ ] Password reset flow

#### 2. Organization Management
- [ ] Vytvorenie organizácie
- [ ] Pridanie člena do organizácie
- [ ] Nastavenia organizácie

#### 3. Job Posting
- [ ] Vytvorenie job ponuky
- [ ] Publikovanie job ponuky
- [ ] Zobrazenie job ponuky na verejnej stránke
- [ ] Editácia job ponuky

#### 4. Application Flow
- [ ] Podanie prihlášky ako kandidát
- [ ] Zobrazenie prihlášky v employer dashboarde
- [ ] Zmena statusu prihlášky
- [ ] Zobrazenie detailu prihlášky

#### 5. Stripe Integration (ak máš nastavené)
- [ ] Checkout flow
- [ ] Subscription creation
- [ ] Customer portal prístup

### Performance Check
- [ ] Homepage načítanie < 2s
- [ ] API response time < 500ms
- [ ] Database queries optimalizované (check Vercel Analytics)

### Error Monitoring
- [ ] Sentry dashboard - žiadne nové errors
- [ ] Vercel logs - žiadne 500 errors
- [ ] Database connections stable

---

## 🚨 ROLLBACK PLÁN

Ak sa niečo pokazí po deploymene:

### Rýchly Rollback (Vercel)
```bash
# V Vercel Dashboard → Deployments
# Klikni na predchádzajúci deployment → "Promote to Production"
```

### Database Rollback
```bash
# Ak migrácia spôsobila problémy:
psql $DATABASE_URL < backup_YYYYMMDD.sql

# Alebo manuálne vrátiť názvy stĺpcov:
ALTER TABLE "OrgMember" RENAME COLUMN "orgId" TO "organizationId";
ALTER TABLE "Job" RENAME COLUMN "orgId" TO "organizationId";
ALTER TABLE "Subscription" RENAME COLUMN "orgId" TO "organizationId";
ALTER TABLE "Invoice" RENAME COLUMN "orgId" TO "organizationId";
```

---

## 📊 MONITORING SETUP

### 1. Sentry (Error Tracking)
- ✅ Nastavené pre client, server, edge
- Dashboard: https://sentry.io/organizations/your-org/projects/jobsphere

### 2. Vercel Analytics
- ✅ Automaticky enabled
- Dashboard: https://vercel.com/your-team/jobsphere/analytics

### 3. PostHog (Product Analytics)
- ⚠️ Optional - nakonfiguruj ak chceš user tracking
- Dashboard: https://app.posthog.com

### 4. Uptime Monitoring
- [ ] Nastaviť UptimeRobot alebo BetterUptime
- [ ] Pridať health check endpoint monitoring
- [ ] Nastaviť alerting (email/Slack)

---

## 🎯 POST-DEPLOYMENT TASKS

### Immediate (0-24 hours)
- [ ] Monitor Sentry pre errors
- [ ] Monitor Vercel logs
- [ ] Testovať critical flows manuálne
- [ ] Overiť database performance
- [ ] Skontrolovať email delivery (ak máš email sequences)

### Short-term (1-7 dní)
- [ ] Gather user feedback
- [ ] Monitor performance metrics
- [ ] Optimalizovať slow queries (ak existujú)
- [ ] Nastaviť uptime monitoring
- [ ] Dokumentovať production issues

### Long-term (1-4 týždne)
- [ ] Deploy workers na Railway/Render
- [ ] Nastaviť automated backups
- [ ] Implementovať CI/CD pre automatic testing
- [ ] Setup staging environment
- [ ] Plan next features

---

## 🔐 SECURITY CHECKLIST

- [x] Environment variables v .env.local (nie v kóde)
- [x] NEXTAUTH_SECRET je silný a unikátny
- [x] Database credentials sú zabezpečené
- [x] CORS nastavené správne
- [x] CSP headers configured
- [x] Rate limiting implementované
- [x] Input validation na všetkých API routes
- [x] SQL injection protection (Prisma ORM)
- [x] XSS protection (React default escaping)
- [x] GDPR compliance (data export/deletion)

---

## 📞 SUPPORT & TROUBLESHOOTING

### Common Issues

#### Issue 1: "Column orgId does not exist"
**Cause:** Database migration nebola spustená
**Fix:** Spusti `npx prisma migrate deploy`

#### Issue 2: Build fails v Vercel
**Cause:** Missing environment variables
**Fix:** Skontroluj Vercel → Settings → Environment Variables

#### Issue 3: Database connection errors
**Cause:** DATABASE_URL nesprávne nastavená
**Fix:** Overiť connection string v Vercel dashboard

#### Issue 4: Workers nefungujú
**Cause:** REDIS_URL chýba alebo je nesprávna
**Fix:** Nastav REDIS_URL (Upstash Redis odporúčané)

### Logs Locations
```bash
# Vercel Production Logs
vercel logs --prod

# Vercel Function Logs
vercel logs --prod --follow

# Sentry Errors
# https://sentry.io/organizations/your-org/issues/

# Database Logs (Vercel Postgres)
# Vercel Dashboard → Storage → Postgres → Logs
```

---

## ✅ FINAL CHECKLIST

Pred označením deploymentu ako úspešný:

- [ ] Database migration úspešná
- [ ] Production build deployed
- [ ] All environment variables set
- [ ] Critical flows tested manually
- [ ] No errors in Sentry (first hour)
- [ ] No 500 errors in Vercel logs
- [ ] Performance acceptable (<2s page load)
- [ ] Email delivery working (if applicable)
- [ ] Stripe integration working (if applicable)
- [ ] Team notified of deployment
- [ ] Rollback plan ready
- [ ] Monitoring tools configured
- [ ] Backup created

---

## 🎉 POST-DEPLOYMENT CELEBRATION

Po úspešnom deploymene:

1. ✅ Update PROJECT_STATUS.md → 100/100 (po nasadení workers)
2. 📸 Screenshot produkčnej aplikácie
3. 🎊 Oznám team/stakeholders
4. 📝 Napíš deployment notes
5. 🍾 Oslávuj úspech!

---

## 📈 NEXT STEPS (Pre 100/100)

Po úspešnom deploymene kódu, posledný 1% pre 100%:

### Worker Deployment (+1%)
**Čas:** 2-3 hodiny
**Požiadavky:**
- Upstash Redis account
- Railway alebo Render account
- Environment variables setup

**Kroky:**
1. Setup Upstash Redis
2. Deploy workers na Railway
3. Configure worker monitoring
4. Test email sequences
5. Test AI assessment grading

**Návod:** Pozri `ROADMAP_TO_100.md` → Phase 2

---

**Status:** ⚠️ ČAKÁ NA DATABASE MIGRATION
**Next Action:** Spusti database migration podľa MIGRATION_GUIDE.md
**After Migration:** Deploy na Vercel
**Final Score after deployment:** 100/100 🎉

---

*Vytvorené: 2025-10-08*
*Autor: Claude Code*
*Verzia: 1.0*
