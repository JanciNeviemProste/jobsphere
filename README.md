# JobSphere - Multilingual AI-Powered HR ATS & Job Board Platform

## 🚀 Overview

JobSphere is a production-grade, privacy-first, multilingual HR ATS (Applicant Tracking System) and job board platform with AI capabilities powered by Claude Opus 4.1. Built with OWASP ASVS L2+ security standards and full GDPR compliance.

### ✨ Key Features

- **🌍 Multilingual Support**: EN/DE/CZ/SK/PL with full i18n
- **🤖 AI-Powered**: CV parsing, job matching (0-100% calibrated scores), automated grading
- **📧 Email Integration**: Microsoft 365, Gmail, IMAP/SMTP with sequences and automation
- **📝 Assessment System**: Builder, timed tests, AI grading, skill-based scoring
- **💳 Subscription Billing**: 3-tier plans with Stripe integration
- **🔒 Enterprise Security**: RLS, RBAC/ABAC, CSRF protection, rate limiting
- **🏢 Sub-HR Model**: Regional teams for Slovakia (BA/ZA/KE/Remote)

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router, React Server Components)
- **UI**: TailwindCSS + shadcn/ui + Radix Primitives
- **Data**: tRPC, TanStack Query, TanStack Table
- **Forms**: react-hook-form + Zod validation

### Backend
- **API**: Fastify (Node.js, TypeScript) + OpenAPI
- **Database**: PostgreSQL 16 + Prisma + pgvector
- **Workers**: BullMQ + Redis
- **Search**: Meilisearch (BM25) + pgvector (embeddings)

### AI & ML
- **LLM**: Anthropic Claude Opus 4.1
- **Embeddings**: Multilingual models (e5-multilingual)
- **OCR**: Tesseract for scanned documents

### Infrastructure
- **Monorepo**: pnpm + Turborepo
- **Cache/Queue**: Redis
- **Storage**: S3/MinIO
- **Email**: Graph API, Gmail API, SMTP/IMAP
- **Security**: ClamAV, rate limiting, CSP headers

## 📋 Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- PostgreSQL 16 (via Docker)
- Redis (via Docker)

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/JanciNeviemProste/jobsphere.git
cd jobsphere
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Set Up Environment Variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Start Infrastructure Services
```bash
pnpm docker:up
```

This starts:
- PostgreSQL with pgvector
- Redis
- MinIO (S3-compatible storage)
- Meilisearch
- ClamAV
- Mailhog (email testing)

### 5. Initialize Database
```bash
pnpm db:migrate
pnpm db:seed
```

### 6. Start Development Servers
```bash
pnpm dev
```

Access:
- 🌐 Web App: http://localhost:3000
- 🔧 API: http://localhost:4000
- 📚 API Docs: http://localhost:4000/docs
- 📧 Mailhog: http://localhost:8025
- 🗄️ MinIO Console: http://localhost:9001

## 📁 Project Structure

```
jobsphere/
├── apps/
│   ├── web/              # Next.js frontend
│   ├── api/              # Fastify REST API
│   └── workers/          # BullMQ background jobs
├── packages/
│   ├── db/               # Prisma schema & migrations
│   ├── ai/               # AI/ML functions
│   ├── ui/               # Shared UI components
│   ├── i18n/             # Translations (5 languages)
│   └── config/           # Shared configs
├── docker/
│   └── docker-compose.yml
└── docs/                 # Documentation
```

## 🔑 Demo Accounts

After seeding, use these accounts:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@techcorp.sk | demo123 |
| Recruiter | recruiter@techcorp.sk | demo123 |
| Hiring Manager | hiring@techcorp.sk | demo123 |
| Agency | agency@partner.sk | demo123 |

## 🛡️ Security Features

- **Row-Level Security (RLS)**: PostgreSQL policies for multi-tenancy
- **RBAC/ABAC**: Role and attribute-based access control
- **CSRF Protection**: Token-based with middleware validation
- **Rate Limiting**: Sliding window algorithm with Redis
- **CSP Headers**: Strict Content Security Policy
- **File Scanning**: ClamAV integration for uploads
- **2FA**: TOTP-based two-factor authentication
- **Audit Logging**: Comprehensive activity tracking

## 📊 Core Features

### For Candidates
- **AI Create CV**: Upload PDF/DOCX → Parse → Edit → Export
- **Job Search**: Filter by location, salary, seniority, remote options
- **Application Tracking**: Status updates, interview scheduling
- **Assessments**: Timed tests with immediate feedback

### For Employers
- **Applications Inbox**: Grid view with Match %, filters, bulk actions
- **Email Center**: Connect company email, templates, sequences
- **Pipeline Management**: Kanban/stages with automation
- **Assessment Builder**: Create tests with various question types
- **Team Collaboration**: Mentions, notes, assignments

### For Agencies
- **Restricted Access**: Only assigned jobs and candidates
- **Performance Tracking**: Placement metrics and reports

## 💳 Billing Tiers

| Feature | Starter | Pro | Enterprise |
|---------|---------|-----|------------|
| Job Slots | 3 | 15 | Unlimited |
| Team Seats | 3 | 10 | Unlimited |
| Assessments/Month | 1 | 10 | Unlimited |
| Emails/Month | 500 | 5000 | Unlimited |
| SSO | ❌ | ❌ | ✅ |
| Price (EUR/month) | €49 | €199 | Custom |

## 🧪 Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## 📦 Building for Production

```bash
# Build all apps
pnpm build

# Build specific app
pnpm --filter @jobsphere/web build

# Docker build
docker build -t jobsphere:latest .
```

## 🚀 Deployment

### Using Fly.io
```bash
fly deploy --config fly.toml
```

### Using AWS ECS
```bash
aws ecs update-service --cluster jobsphere --service web --force-new-deployment
```

## 📈 Monitoring

- **Traces**: OpenTelemetry with Jaeger/Tempo
- **Metrics**: Prometheus + Grafana
- **Logs**: Structured logging with Pino
- **Errors**: Sentry integration
- **Uptime**: Health check endpoints

## 🌍 Internationalization

Supported languages:
- 🇬🇧 English (en)
- 🇩🇪 German (de)
- 🇨🇿 Czech (cs)
- 🇸🇰 Slovak (sk)
- 🇵🇱 Polish (pl)

## 📚 API Documentation

- **REST API**: http://localhost:4000/docs
- **tRPC Playground**: Integrated in development mode
- **Webhook Events**: See `/docs/webhooks.md`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Documentation: `/docs`
- Issues: GitHub Issues
- Email: support@jobsphere.com

## 🔧 Troubleshooting

### Common Issues

**Database connection failed**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Reset database
pnpm db:reset
```

**Port already in use**
```bash
# Change ports in .env
PORT=4001
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

**Email sending issues**
```bash
# Check Mailhog interface
open http://localhost:8025
```

## 🎯 Roadmap

- [ ] Mobile apps (React Native)
- [ ] Video interview integration
- [ ] Advanced analytics dashboard
- [ ] Slack/Teams integration
- [ ] API rate limiting per org
- [ ] Kubernetes deployment
- [ ] GraphQL API option

## 🙏 Acknowledgements

Built with ❤️ using:
- Next.js by Vercel
- Prisma ORM
- Claude by Anthropic
- shadcn/ui components
- TailwindCSS

---

**JobSphere** - Revolutionizing recruitment with AI 🚀