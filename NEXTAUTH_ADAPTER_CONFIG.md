# NextAuth PrismaAdapter Configuration (BACKUP)

**Dátum zálohy:** 2026-01-08
**Dôvod:** Dočasne odstránený adapter kvôli problémom s DATABASE_URL na Verceli

## Pôvodná konfigurácia (S ADAPTEROM):

```typescript
import { PrismaAdapter } from "@auth/prisma-adapter"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),  // ← TÁTO RIADKA BOLA DOČASNE ODSTRÁNENÁ
  session: {
    strategy: "jwt",
  },
  // ... zvyšok konfigurácie
})
```

## Kedy znova pridať adapter:

**PrismaAdapter je potrebný iba pre:**
1. ✅ OAuth account linking (Google, GitHub, etc.)
2. ✅ Database sessions (keď strategy: "database")
3. ✅ Ukladanie refresh tokenov pre OAuth

**NIE JE potrebný pre:**
- ❌ Credentials (email/password) login s JWT sessions
- ❌ JWT-only authentication

## Ako znova aktivovať:

1. **Overiť že DATABASE_URL v Vercel je správna:**
   ```
   postgres://postgres.wlijkwzowvctxfovqnag:u5yRtMEasktVC34a@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
   ```

2. **Naplniť databázu:**
   ```bash
   yarn db:push
   yarn db:seed
   ```

3. **Pridať adapter späť do auth.ts:**
   ```typescript
   import { PrismaAdapter } from "@auth/prisma-adapter"

   export const { handlers, auth, signIn, signOut } = NextAuth({
     adapter: PrismaAdapter(prisma),  // ← Uncomment this line
     session: { strategy: "jwt" },
     // ...
   })
   ```

4. **Commit a redeploy:**
   ```bash
   git add apps/web/src/lib/auth.ts
   git commit -m "Re-enable PrismaAdapter for OAuth account linking"
   git push
   ```

## Poznámky:

- Backup súbor: `apps/web/src/lib/auth.ts.with-adapter.backup`
- Pri JWT stratégii adapter nie je kritický pre základný login
- Adapter je užitočný pre linking viacerých OAuth providerov k jednému accountu
- Ak používateľ sa prihlási cez Google a potom cez email/password, adapter prepojí účty
