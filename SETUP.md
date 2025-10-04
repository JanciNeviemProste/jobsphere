# JobSphere - Setup Guide

Tento dokument popisuje, ako nastaviť JobSphere pre production deployment na Vercel.

## 1. Databáza (Vercel Postgres)

### Vytvorenie databázy na Vercel:
1. Prejdite na [Vercel Dashboard](https://vercel.com/dashboard)
2. Vyberte váš projekt `jobsphere`
3. Kliknite na **Storage** tab
4. Kliknite **Create Database**
5. Vyberte **Postgres**
6. Pomenujte databázu napr. `jobsphere-db`
7. Vyberte región (odporúčame Frankfurt pre EU)
8. Kliknite **Create**

### Kopírovanie environment variables:
1. Po vytvorení databázy kliknite na `.env.local` tab
2. Skopírujte všetky premenné začínajúce s `POSTGRES_`
3. Prejdite na **Settings** → **Environment Variables**
4. Pridajte nasledujúce premenné:
   - `DATABASE_URL`
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NON_POOLING`

### Spustenie migrácií:
Po nastavení database URL, migrácie sa spustia automaticky počas build procesu (je to v `package.json` build skripte).

## 2. NextAuth Konfigurácia

### Generovanie NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### Nastavenie v Vercel:
1. **Settings** → **Environment Variables**
2. Pridajte:
   - `NEXTAUTH_SECRET` = vygenerovaný secret
   - `NEXTAUTH_URL` = `https://jobsphere-khaki.vercel.app`

## 3. Google OAuth (Voliteľné, ale odporúčané)

### Vytvorenie Google OAuth Credentials:
1. Prejdite na [Google Cloud Console](https://console.cloud.google.com/)
2. Vytvorte nový projekt alebo vyberte existujúci
3. Prejdite na **APIs & Services** → **Credentials**
4. Kliknite **Create Credentials** → **OAuth 2.0 Client ID**
5. Vyberte **Web application**
6. Nastavte:
   - **Authorized JavaScript origins**: `https://jobsphere-khaki.vercel.app`
   - **Authorized redirect URIs**: `https://jobsphere-khaki.vercel.app/api/auth/callback/google`
7. Kliknite **Create**

### Nastavenie v Vercel:
1. **Settings** → **Environment Variables**
2. Pridajte:
   - `GOOGLE_CLIENT_ID` = váš Client ID
   - `GOOGLE_CLIENT_SECRET` = váš Client Secret

## 4. Redeployment

Po pridaní všetkých environment variables:
1. Prejdite na **Deployments** tab
2. Kliknite na tri bodky pri poslednom deployme
3. Kliknite **Redeploy**
4. Alebo pushite nový commit na GitHub - Vercel automaticky deployuje

## 5. Overenie funkčnosti

Po úspešnom deployme:
1. Otvorte `https://jobsphere-khaki.vercel.app/sk`
2. Otestujte:
   - ✅ Homepage sa zobrazuje
   - ✅ Navigácia funguje
   - ✅ `/jobs` zobrazuje ponuky
   - ✅ `/login` a `/signup` fungujú
   - ✅ Registrácia nového používateľa
   - ✅ Prihlásenie
   - ✅ Dashboard sa zobrazuje po prihlásení

## 6. Troubleshooting

### Build error - Prisma
**Problém**: `prisma generate` zlyhá
**Riešenie**: Skontrolujte, že `DATABASE_URL` je správne nastavený

### NextAuth error - Invalid secret
**Problém**: NextAuth hláši chybný secret
**Riešenie**: Vygenerujte nový secret pomocou `openssl rand -base64 32`

### Google OAuth nefunguje
**Problém**: Google OAuth redirect fails
**Riešenie**: Skontrolujte, že redirect URI v Google Console je presne: `https://jobsphere-khaki.vercel.app/api/auth/callback/google`

## Minimálne požiadavky pre fungovanie

**Povinné environment variables:**
- `DATABASE_URL` (alebo `POSTGRES_PRISMA_URL`)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

**Voliteľné (ale odporúčané):**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Bez databázy aplikácia nebude fungovať správne (signup/login vyžaduje DB).
