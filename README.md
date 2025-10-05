# JobSphere - Enterprise AI-Powered ATS

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748)](https://www.prisma.io/)
[![Claude AI](https://img.shields.io/badge/Claude-Opus%204-orange)](https://www.anthropic.com/)
[![License](https://img.shields.io/badge/license-Proprietary-red)](LICENSE)

**Live Demo:** [https://jobsphere-khaki.vercel.app](https://jobsphere-khaki.vercel.app)

## 🚀 Overview

JobSphere is an enterprise-grade Applicant Tracking System powered by Anthropic's Claude AI, built with Next.js 14. Complete with AI CV parsing, hybrid matching algorithms, email automation, skills assessments, Stripe billing, and full GDPR compliance.

---

## ✨ Features

### For Candidates
- **Job Search & Filtering** - Browse jobs with advanced filters (location, work mode, salary, seniority)
- **One-Click Applications** - Apply to jobs with CV upload and cover letter
- **Application Tracking** - Monitor application status with detailed timeline
- **AI Matching Scores** - See how well you match each position
- **Personal Dashboard** - Track all applications in one place
- **Profile Management** - Maintain your professional profile and preferences

### For Employers
- **Job Posting Management** - Create and manage job listings
- **Applicant Tracking** - Review and manage candidates with advanced filtering
- **AI-Powered Candidate Matching** - Automatic matching scores for applicants
- **Application Review** - Detailed applicant profiles with CV access
- **Status Management** - Update application statuses (Pending → Reviewing → Interviewed → Accepted/Rejected)
- **Company Settings** - Manage company profile, billing, and notifications
- **Team Collaboration** - Multi-user support with role-based access

### Platform Features
- **🌍 Multilingual** - Support for 5 languages (EN, DE, CS, SK, PL)
- **🔒 Secure Authentication** - NextAuth v5 with Email/Password + Google OAuth
- **📱 Responsive Design** - Mobile-first approach with beautiful UI
- **📧 Email Notifications** - Automated email updates for applications
- **📊 Analytics Dashboard** - Real-time statistics and insights
- **🎨 Modern UI** - Built with shadcn/ui and TailwindCSS
- **⚡ Performance** - Server-side rendering and optimized loading

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5
- **Styling:** TailwindCSS + shadcn/ui
- **Internationalization:** next-intl
- **Forms:** React Hook Form + Zod validation
- **State Management:** React Server Components

### Backend
- **Database:** PostgreSQL (via Vercel Postgres)
- **ORM:** Prisma
- **Authentication:** NextAuth v5
- **File Upload:** Local file storage (extendable to S3/Vercel Blob)
- **Email:** Resend / SendGrid (configurable)
- **API:** Next.js API Routes + Server Actions

### Infrastructure
- **Hosting:** Vercel
- **CI/CD:** GitHub Actions (automatic deployment)
- **Security:** CSRF protection, rate limiting, XSS headers, bcrypt password hashing

---

## 🚦 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (or Vercel Postgres)
- pnpm (recommended) or npm

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/jobsphere.git
cd jobsphere
```

### 2. Install Dependencies
```bash
pnpm install
# or
npm install
```

### 3. Environment Variables

Create `apps/web/.env` file:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/jobsphere"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-generate-with-openssl"

# OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Email (optional - defaults to 'log' mode)
EMAIL_SERVICE="log"  # Options: log, resend, sendgrid
EMAIL_FROM="JobSphere <noreply@jobsphere.app>"
# RESEND_API_KEY="re_xxx"
# SENDGRID_API_KEY="SG.xxx"

# App URLs
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
```

### 4. Database Setup
```bash
cd apps/web

# Generate Prisma Client
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev

# (Optional) Seed database
pnpm prisma db seed
```

### 5. Run Development Server
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
jobsphere/
├── apps/
│   └── web/                    # Next.js web application
│       ├── src/
│       │   ├── app/            # App router pages
│       │   │   ├── [locale]/   # Internationalized routes
│       │   │   │   ├── dashboard/        # Candidate dashboard
│       │   │   │   ├── employer/         # Employer ATS
│       │   │   │   ├── jobs/             # Job listings & details
│       │   │   │   ├── login/            # Authentication
│       │   │   │   ├── signup/
│       │   │   │   ├── pricing/
│       │   │   │   └── forgot-password/
│       │   │   └── api/        # API routes
│       │   │       ├── auth/
│       │   │       ├── jobs/
│       │   │       ├── applications/
│       │   │       └── upload/
│       │   ├── components/     # React components
│       │   │   └── ui/         # shadcn/ui components
│       │   └── lib/            # Utilities
│       │       ├── prisma.ts   # Prisma client
│       │       ├── auth.ts     # NextAuth config
│       │       ├── email.ts    # Email service
│       │       └── actions/    # Server actions
│       ├── public/             # Static files
│       │   └── uploads/        # File uploads
│       ├── prisma/             # Database schema
│       └── package.json
├── packages/
│   └── database/               # Shared Prisma schema
├── COMPLETE.md                 # Feature checklist
└── README.md                   # This file
```

---

## 🗄️ Database Schema

### Core Models
- **User** - Authentication and user profiles
- **Organization** - Companies/Employers
- **OrgMember** - Organization memberships with roles
- **Job** - Job postings
- **Application** - Job applications
- **ApplicationEvent** - Application timeline/history
- **Candidate** - Candidate profiles
- **Email** - Email tracking
- **Subscription** - Billing/subscription management

See `packages/database/prisma/schema.prisma` for complete schema.

---

## 📧 Email Configuration

JobSphere supports multiple email providers:

### Resend (Recommended)
```bash
EMAIL_SERVICE="resend"
RESEND_API_KEY="re_your_api_key"
EMAIL_FROM="JobSphere <noreply@yourdomain.com>"
```

### SendGrid
```bash
EMAIL_SERVICE="sendgrid"
SENDGRID_API_KEY="SG.your_api_key"
EMAIL_FROM="noreply@yourdomain.com"
```

### Development (Log Only)
```bash
EMAIL_SERVICE="log"  # Emails are logged to console
```

---

## 🔐 Authentication

JobSphere uses **NextAuth v5** with:

1. **Email/Password** - Bcrypt hashed passwords
2. **Google OAuth** - One-click sign-in
3. **Protected Routes** - Middleware-based protection
4. **Session Management** - JWT-based sessions

### Setting up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://yourdomain.com/api/auth/callback/google` (prod)
6. Copy Client ID and Secret to `.env`

---

## 📁 File Upload

Currently uses local file storage in `public/uploads/cvs/`.

### Migrating to Cloud Storage

**Vercel Blob:**
```bash
pnpm add @vercel/blob

# Update apps/web/src/app/api/upload/route.ts
import { put } from '@vercel/blob'
const blob = await put(filename, file, { access: 'public' })
```

**AWS S3:**
```bash
pnpm add @aws-sdk/client-s3

# Configure S3 client and upload
```

---

## 🌍 Internationalization

JobSphere supports 5 languages out of the box:

- 🇬🇧 English (en)
- 🇩🇪 German (de)
- 🇨🇿 Czech (cs)
- 🇸🇰 Slovak (sk)
- 🇵🇱 Polish (pl)

Translations are managed via `next-intl`. To add a new language:

1. Create `messages/{locale}.json`
2. Add locale to `src/i18n.ts`
3. Update middleware config

---

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect GitHub Repository**
   ```bash
   # Push to GitHub
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your repository
   - Set environment variables
   - Deploy

3. **Database Setup**
   - Create Vercel Postgres database
   - Copy `DATABASE_URL` to environment variables
   - Migrations run automatically on deploy

### Environment Variables for Production

Set these in Vercel Dashboard:

```
DATABASE_URL=postgres://...
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-production-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
EMAIL_SERVICE=resend
RESEND_API_KEY=...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
```

---

## 🧪 Testing

```bash
# Run type checking
pnpm type-check

# Run linting
pnpm lint

# Format code
pnpm format

# Build for production
pnpm build
```

---

## 📊 API Reference

### Jobs API

**GET /api/jobs**
- Query params: `search`, `workMode`, `jobType`, `seniority`
- Returns: Array of active jobs

**POST /api/jobs**
- Body: Job details (title, location, salary, etc.)
- Returns: Created job
- Auth: Required

### Applications API

**GET /api/applications**
- Query params: `status`, `jobId`
- Returns: User's applications
- Auth: Required

**POST /api/applications**
- Body: Application details (jobId, coverLetter, cvUrl)
- Returns: Created application
- Auth: Required

**GET /api/applications/:id**
- Returns: Application details
- Auth: Required (candidate or employer)

**PATCH /api/applications/:id**
- Body: Status update
- Returns: Updated application
- Auth: Required (employer only)

### Upload API

**POST /api/upload**
- Body: FormData with file
- Returns: File URL
- Auth: Required
- Max size: 5MB
- Allowed: PDF, DOC, DOCX

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Vercel](https://vercel.com/) - Hosting platform
- [Prisma](https://www.prisma.io/) - Database ORM
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [NextAuth](https://next-auth.js.org/) - Authentication
- [Resend](https://resend.com/) - Email service

---

## 📞 Support

- **Documentation:** [COMPLETE.md](COMPLETE.md)
- **Issues:** [GitHub Issues](https://github.com/yourusername/jobsphere/issues)
- **Email:** support@jobsphere.app

---

**Made with ❤️ by the JobSphere Team**