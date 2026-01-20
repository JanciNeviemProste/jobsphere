# JobSphere Architecture Overview

## System Architecture

JobSphere is built as a modern, scalable monorepo application following enterprise-grade architectural patterns.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                        │
│                  Next.js 14 App Router                      │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                   Vercel Edge Network                       │
│              (Static Assets, Middleware)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                Next.js Server (Serverless)                  │
│  ┌───────────────┬──────────────┬───────────────────────┐  │
│  │ Server        │ API Routes   │ Server Actions        │  │
│  │ Components    │              │                       │  │
│  └───────┬───────┴──────┬───────┴───────┬───────────────┘  │
│          │              │               │                   │
│          │              ↓               │                   │
│          │     ┌────────────────┐      │                   │
│          │     │  NextAuth v5   │      │                   │
│          │     │  (Auth Layer)  │      │                   │
│          │     └────────────────┘      │                   │
│          │              │               │                   │
│          ↓              ↓               ↓                   │
│          ┌──────────────────────────────┐                  │
│          │        Prisma ORM            │                  │
│          │    (Database Client)         │                  │
│          └──────────────┬───────────────┘                  │
└─────────────────────────┼──────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ↓                 ↓                 ↓
┌───────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL   │  │    Redis     │  │  Vercel Blob │
│  (Supabase)   │  │  (Upstash)   │  │   (Files)    │
│               │  │              │  │              │
│  + pgvector   │  │  BullMQ      │  │  Private     │
│  extension    │  │  Queues      │  │  Access      │
└───────────────┘  └──────┬───────┘  └──────────────┘
                          │
                          ↓
                   ┌────────────────┐
                   │ Background     │
                   │ Workers        │
                   │                │
                   │ • Email        │
                   │ • Embeddings   │
                   │ • Grading      │
                   └────────────────┘
```

## Monorepo Structure

```
jobsphere/
├── apps/
│   └── web/                  # Main Next.js application
│       ├── src/
│       │   ├── app/          # App Router pages and API routes
│       │   ├── components/   # React components
│       │   ├── lib/          # Utilities and business logic
│       │   └── workers/      # BullMQ background workers
│       ├── public/           # Static assets
│       └── prisma/           # Database schema
├── packages/
│   ├── db/                   # Shared Prisma schema (legacy)
│   ├── ai/                   # AI utilities (Claude integration)
│   ├── ui/                   # Shared UI components
│   └── i18n/                 # Internationalization
└── docs/                     # Documentation
```

## Tech Stack

### Frontend

- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript 5 (strict mode)
- **Styling:** TailwindCSS + shadcn/ui components
- **State Management:** React Server Components (RSC)
- **Forms:** React Hook Form + Zod validation
- **Internationalization:** next-intl (5 languages)

### Backend

- **Runtime:** Node.js 18+ (serverless on Vercel)
- **API:** Next.js API Routes + Server Actions
- **Database:** PostgreSQL with pgvector extension
- **ORM:** Prisma (type-safe database client)
- **Authentication:** NextAuth v5
- **Background Jobs:** BullMQ with Redis
- **AI:** Anthropic Claude (CV parsing, matching, grading)

### Infrastructure

- **Hosting:** Vercel (serverless functions)
- **Database:** Supabase (PostgreSQL with pgvector)
- **Redis:** Upstash (serverless Redis)
- **File Storage:** Vercel Blob (production) / Local (dev)
- **Email:** Resend / SendGrid
- **Monitoring:** Sentry
- **CI/CD:** GitHub Actions

## Key Architectural Patterns

### 1. Multi-Tenant Architecture

- All resources scoped to organizations (`orgId`)
- Role-based access control (RBAC)
- Data isolation at database query level
- Middleware-enforced authorization

### 2. Hybrid Rendering

- **Server Components:** Default for data fetching
- **Client Components:** For interactivity
- **Static Generation:** Public pages (jobs list, marketing)
- **Dynamic Rendering:** Authenticated pages (dashboard)

### 3. API Design

- **REST APIs:** Complex operations (search, recommendations)
- **Server Actions:** Form submissions, simple mutations
- **Consistent Error Handling:** Standard error responses
- **Rate Limiting:** IP-based with Redis

### 4. Background Processing

- **BullMQ Queues:** Async task processing
- **Worker Pattern:** Separate worker processes
- **Retry Logic:** Automatic retries with exponential backoff
- **Job Priorities:** High, normal, low

### 5. AI Integration

- **CV Parsing:** Multi-stage pipeline with fallbacks
- **Semantic Search:** Hybrid BM25 + Vector + LLM
- **Auto-Grading:** Claude AI assessment evaluation
- **Embeddings:** Text-to-vector with caching

## Data Flow Examples

### CV Upload Flow

```
1. User uploads CV (PDF/DOCX)
   ↓
2. API Route: /api/cv/upload
   ↓
3. Security checks (size, MIME, antivirus)
   ↓
4. Multi-stage parsing:
   - Stage 1: Node.js parser (fast)
   - Stage 2: OCR (if stage 1 fails)
   - Stage 3: Metadata fallback
   ↓
5. Store parsed text in database
   ↓
6. Enqueue job: Generate embeddings
   ↓
7. Worker: embedding.worker.ts
   ↓
8. Store vector in candidate.cvEmbedding
```

### Job Matching Flow

```
1. Recruiter searches for candidates
   ↓
2. API Route: /api/candidates/search
   ↓
3. Hybrid scoring:
   - BM25: Keyword matching
   - Vector: Cosine similarity (pgvector)
   - LLM: Claude AI contextual analysis
   ↓
4. Combine scores with weights
   ↓
5. Return ranked candidates with explanations
```

### Assessment Grading Flow

```
1. Candidate submits assessment
   ↓
2. API Route: /api/assessments/{id}/submit
   ↓
3. Store answers in database
   ↓
4. Enqueue job: Grade assessment
   ↓
5. Worker: assessment-grading.worker.ts
   ↓
6. For each question:
   - MCQ: Check correctIndexes
   - CODE: Send to Claude AI for evaluation
   - TEXT: Send to Claude AI with rubric
   ↓
7. Calculate total score and percentage
   ↓
8. Update attempt status to GRADED
```

## Security Architecture

### Authentication

- NextAuth v5 with multiple providers
- JWT sessions with secure cookies
- OAuth tokens encrypted with AES-256-GCM
- Session validation on every request

### Authorization

- Role-based access control (4 roles)
- Organization-scoped data queries
- API route middleware checks
- Resource ownership validation

### Data Protection

- Input validation with Zod schemas
- SQL injection prevention (Prisma parameterized queries)
- XSS protection (Content Security Policy headers)
- CSRF protection (token validation)
- Rate limiting (Redis-backed)

### File Security

- File size limits (10MB for CVs)
- MIME type validation
- VBA macro detection (DOCX files)
- ClamAV antivirus scanning (optional)

## Performance Optimizations

### Database

- pgvector for fast similarity search
- Indexes on frequently queried fields
- Connection pooling
- Query result caching

### API

- Response caching with TTL
- Pagination for large result sets
- Lazy loading of related data
- Optimistic Prisma queries

### Frontend

- Code splitting by route
- Image optimization (Next.js Image)
- Lazy component loading
- Prefetching critical routes

## Scalability Considerations

### Horizontal Scaling

- Serverless architecture (auto-scales)
- Stateless API design
- Redis for shared state
- CDN for static assets

### Database Scaling

- Read replicas for reporting
- Connection pooling
- Query optimization
- Index tuning

### Worker Scaling

- Multiple worker instances
- Job queue partitioning
- Priority-based processing
- Automatic retry handling

## Deployment Architecture

### Production Environment

```
GitHub Repo → GitHub Actions CI/CD → Vercel Deployment
                     ↓
               ┌─────┴─────┐
               │           │
          Build & Test    Deploy
               │           │
               ↓           ↓
          TypeScript    Serverless
          Validation    Functions
          ESLint
          Tests
```

### Environment Separation

- **Development:** Local PostgreSQL, Local Redis
- **Staging:** Supabase (staging), Upstash (staging)
- **Production:** Supabase (production), Upstash (production)

## Monitoring & Observability

### Error Tracking

- Sentry for error monitoring
- Structured logging with context
- Request tracing with traceId
- Performance metrics

### Business Metrics

- Application conversion rates
- CV parsing success rates
- Assessment completion rates
- API response times

## Future Enhancements

### Planned Improvements

- WebSocket support for real-time updates
- GraphQL API layer
- Microservices for heavy workloads
- Machine learning model deployment
- Advanced analytics dashboard

### Scalability Roadmap

- Multi-region deployment
- Database sharding
- Message queue partitioning
- Caching layer improvements
