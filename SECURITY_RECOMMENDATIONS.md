# Bezpečnostné odporúčania pre JobSphere

## 🚨 KRITICKÉ (oprviť OKAMŽITE)

### 1. Input Validation
**Problém:** API routes nemajú validáciu vstupov
**Riziko:** SQL injection, XSS, data corruption
**Riešenie:**
```typescript
// Pred:
const { name, description } = await request.json()

// Po:
import { z } from 'zod'
const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional()
})
const data = schema.parse(await request.json())
```

### 2. Encryption pre sensitive data
**Problém:** OAuth tokens a passwords v plain JSON
**Riziko:** Data breach = všetky credentials compromised
**Riešenie:**
```typescript
import crypto from 'crypto'

// Encrypt pred uložením do DB:
const encryptToken = (token: string) => {
  const cipher = crypto.createCipheriv('aes-256-gcm',
    Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'),
    iv)
  // ... encryption logic
}
```

### 3. Rate Limiting
**Problém:** Rate limiting len v jednom súbore
**Riziko:** DDoS, brute force attacks
**Riešenie:**
- Aplikovať na všetky API routes
- Prísnejšie limity pre auth endpoints

## ⚠️ VYSOKÁ PRIORITA

### 4. CSRF Protection
**Problém:** Nie je viditeľná CSRF ochrana
**Riešenie:** Overiť NextAuth CSRF tokens

### 5. IP Spoofing
**Problém:** `x-forwarded-for` môže byť falošný
```typescript
// apps/web/src/lib/audit-log.ts:86
ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
```
**Riešenie:**
```typescript
const getTrustedIP = (request: Request) => {
  // Use Vercel's x-real-ip or x-forwarded-for s validation
  return request.headers.get('x-real-ip') ||
         request.headers.get('x-forwarded-for')?.split(',')[0] ||
         'unknown'
}
```

### 6. Error Handling
**Problém:** Stack traces v error responses
**Riešenie:**
```typescript
// Nikdy neposielať stack trace do clienta:
catch (error) {
  console.error('Internal error:', error)
  return NextResponse.json(
    { error: 'Internal server error' }, // Generic message
    { status: 500 }
  )
}
```

## 📋 STREDNÁ PRIORITA

### 7. SQL Injection Prevention
- Prisma chráni proti SQL injection
- ✅ OK, ale pridať validáciu vstupov pre extra vrstvu

### 8. Session Security
- Overiť NextAuth session timeout
- Implement refresh tokens
- HttpOnly cookies ✅ (NextAuth default)

### 9. Audit Log Encryption
- Encrypto PII v audit logs
- Retention policy (GDPR - max 1 rok)

## 🔒 Best Practices

### 10. Environment Variables
```bash
# Pridať do .env.example:
ENCRYPTION_KEY=  # 32-byte hex key pre AES-256
SESSION_SECRET=  # Separate od NEXTAUTH_SECRET
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

### 11. Dependencies
**Akcia:** Vytvoriť yarn.lock a commitnúť
```bash
yarn install
git add yarn.lock
git commit -m "Add yarn.lock for reproducible builds"
```

### 12. Security Headers
Pridať do next.config.js:
```javascript
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
    ]
  }]
}
```

## 📊 Implementačný plán

1. **Týždeň 1:** Input validation (Zod schemas)
2. **Týždeň 2:** Encryption layer pre tokens/passwords
3. **Týždeň 3:** Rate limiting na všetky routes
4. **Týždeň 4:** Security headers + testing
