# Security Policy

## 🔒 Security Overview

JobSphere takes security seriously. This document outlines our security policies, practices, and how to report security vulnerabilities.

**Current Security Rating: 8.5/10** (Production Ready)

## 🛡️ Supported Versions

Security updates are provided for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## 🚨 Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

### How to Report

1. **Email:** Send details to `security@jobsphere.app`
2. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Time

- **Initial Response:** Within 48 hours
- **Status Update:** Within 7 days
- **Fix Timeline:** Depends on severity (see below)

### Severity Levels

| Severity | Response Time | Examples |
|----------|---------------|----------|
| **Critical** | 24 hours | RCE, SQL injection, Authentication bypass |
| **High** | 7 days | XSS, CSRF, Unauthorized data access |
| **Medium** | 30 days | Information disclosure, Weak encryption |
| **Low** | 90 days | Minor information leaks, Non-sensitive bugs |

## 🔐 Security Measures

### Authentication & Authorization

#### Implemented
- ✅ NextAuth v5 with secure session management
- ✅ Bcrypt password hashing (12 rounds)
- ✅ JWT-based sessions with secure cookies
- ✅ Role-based access control (RBAC)
- ✅ Session expiration and refresh
- ✅ OAuth 2.0 support (Google, Microsoft)

#### Best Practices
- Passwords must be minimum 8 characters
- Sessions expire after 30 days of inactivity
- Failed login attempts are logged
- Account lockout after 5 failed attempts (future)

### Data Protection

#### Encryption at Rest
- ✅ **OAuth tokens:** AES-256-GCM encryption
- ✅ **Passwords:** Bcrypt with salt rounds = 12
- ✅ **Sensitive fields:** Encrypted before storage
- ✅ **Encryption key:** 256-bit key stored in environment variables

**Encryption Implementation:**
```typescript
// OAuth tokens are encrypted using AES-256-GCM
const encryptedTokens = encrypt(JSON.stringify({
  access_token: tokens.access_token,
  refresh_token: tokens.refresh_token,
  expiry_date: tokens.expiry_date,
}))
```

#### Encryption in Transit
- ✅ HTTPS enforced (HSTS headers)
- ✅ TLS 1.2+ only
- ✅ Secure cookies (httpOnly, secure, sameSite)

### Input Validation

#### Zod Schema Validation
All API endpoints validate inputs using Zod schemas:

```typescript
// Example: Job creation validation
const createJobSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(50000),
  salaryMin: z.number().int().positive().optional(),
  salaryMax: z.number().int().positive().optional(),
  organizationId: z.string().cuid(),
})
```

#### SQL Injection Prevention
- ✅ Prisma ORM with parameterized queries
- ✅ No raw SQL queries
- ✅ Type-safe database operations

#### XSS Prevention
- ✅ React auto-escapes by default
- ✅ Content Security Policy headers
- ✅ DOMPurify for user-generated HTML (if needed)

### Rate Limiting

Implemented using Redis (Upstash) with sliding window algorithm:

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| **Authentication** | 5 requests | 1 minute |
| **API (Authenticated)** | 100 requests | 1 minute |
| **Public API** | 200 requests | 1 minute |
| **Strict Operations** | 10 requests | 15 minutes |
| **File Uploads** | 10 requests | 5 minutes |

**Implementation:**
```typescript
// Rate limiting is applied to all API routes
export const POST = withRateLimit(
  async (req: Request) => {
    // Handler logic
  },
  { preset: 'auth' } // 5 requests per minute
)
```

### Security Headers

All responses include comprehensive security headers:

```javascript
// next.config.js
headers: [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com; ..."
  }
]
```

### CSRF Protection

- ✅ NextAuth CSRF tokens
- ✅ SameSite cookies
- ✅ Origin header validation

### Error Handling

#### Production Error Handling
- ❌ No stack traces in production
- ❌ No sensitive data in error messages
- ✅ Generic error messages to users
- ✅ Detailed logs to Sentry (sanitized)

**Example:**
```typescript
// Development
{ error: "Database error: unique constraint violation on users.email" }

// Production
{ error: "An error occurred. Please try again later." }
```

### Monitoring & Logging

#### Sentry Integration
- ✅ Real-time error tracking
- ✅ Performance monitoring
- ✅ Session replay (with privacy controls)
- ✅ Sensitive data sanitization
- ✅ PII removal from logs

#### Audit Logging
All sensitive operations are logged:
- User authentication (login/logout)
- Data access (candidate views)
- Data exports
- Permission changes
- Subscription changes

**Audit Log Format:**
```typescript
{
  userId: "user_123",
  action: "USER_LOGIN",
  entityType: "USER",
  entityId: "user_123",
  ipAddress: "1.2.3.4",
  userAgent: "Mozilla/5.0...",
  timestamp: "2025-01-15T10:30:00Z"
}
```

## 🔍 Security Testing

### Automated Testing
- ✅ Unit tests with 80%+ coverage
- ✅ Integration tests for critical paths
- ✅ Type checking with strict TypeScript
- ✅ ESLint security rules
- ✅ Dependency vulnerability scanning (GitHub Dependabot)

### Manual Security Review
- Regular code reviews
- Security-focused PR reviews
- Penetration testing (quarterly)
- Third-party security audits (annually)

### CI/CD Security

GitHub Actions workflow includes:
```yaml
- Type checking
- Linting (security rules)
- Tests (including security tests)
- Dependency vulnerability scan (Trivy)
- Build verification
```

## 🚫 Known Limitations

### Current Limitations
1. **Account Lockout:** Not yet implemented (planned)
2. **2FA:** Not yet implemented (planned)
3. **API Key Management:** Not yet implemented (planned)
4. **IP Whitelisting:** Not available
5. **Advanced Threat Detection:** Basic rate limiting only

### Planned Security Enhancements
- [ ] Two-factor authentication (2FA)
- [ ] Account lockout after failed attempts
- [ ] API key rotation
- [ ] Advanced bot detection
- [ ] Real-time threat monitoring
- [ ] Security headers enforcement in middleware

## 📋 Security Checklist

### For Developers

When adding new features, ensure:

- [ ] All inputs are validated with Zod
- [ ] Authentication is required for protected routes
- [ ] Rate limiting is applied
- [ ] Sensitive data is encrypted
- [ ] Error messages don't leak information
- [ ] Tests include security scenarios
- [ ] No secrets in code
- [ ] Audit logging for sensitive operations

### For Deployment

Before deploying to production:

- [ ] All environment variables are set
- [ ] ENCRYPTION_KEY is properly generated
- [ ] HTTPS is enforced
- [ ] Security headers are configured
- [ ] Sentry is configured
- [ ] Rate limiting (Redis) is active
- [ ] Database backups are configured
- [ ] Access logs are enabled

## 🔑 Environment Variables Security

### Required Security Variables

```bash
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<64-char-hex>

# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=<base64-string>

# Redis for rate limiting
KV_REST_API_URL=<upstash-url>
KV_REST_API_TOKEN=<upstash-token>
```

### Best Practices
- ❌ Never commit `.env` files
- ✅ Use different keys for dev/staging/prod
- ✅ Rotate keys regularly (every 90 days)
- ✅ Use secret management service (Vercel Secrets, AWS Secrets Manager)
- ✅ Limit access to production secrets

## 🛠️ Incident Response

### In Case of Security Breach

1. **Immediate Actions:**
   - Isolate affected systems
   - Revoke compromised credentials
   - Enable maintenance mode if needed
   - Preserve logs for investigation

2. **Assessment:**
   - Identify scope of breach
   - Determine data affected
   - Document timeline

3. **Remediation:**
   - Fix vulnerability
   - Deploy patch
   - Verify fix effectiveness

4. **Communication:**
   - Notify affected users (within 72 hours)
   - Document incident
   - Post-mortem analysis

5. **Follow-up:**
   - Implement preventive measures
   - Update security policies
   - Additional security training

## 📚 Security Resources

### Internal Documentation
- [SECURITY_IMPLEMENTATION.md](docs/SECURITY_IMPLEMENTATION.md) - Detailed security implementation
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [README.md](README.md) - Project overview

### External Resources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [Prisma Security](https://www.prisma.io/docs/guides/deployment/deployment-guides/security)

## 🏆 Security Acknowledgments

We thank the following security researchers for responsibly disclosing vulnerabilities:

- [No vulnerabilities reported yet]

## 📞 Contact

**Security Team:** security@jobsphere.app
**Bug Bounty:** Not currently available
**Response Time:** 48 hours for initial response

---

**Last Updated:** January 2025
**Next Review:** April 2025

This security policy is subject to change. Check back regularly for updates.
