# Semantic Search & AI Matching Architecture

## Overview

JobSphere uses a **hybrid semantic search system** that combines traditional keyword matching (BM25), vector similarity search (pgvector), and AI-powered contextual analysis (Claude) to provide highly accurate job-candidate matching.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Search Request                          │
│  (Query: "Senior React developer with Node.js experience")  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              Hybrid Scoring Pipeline                        │
│  ┌──────────────┬──────────────┬───────────────────────┐  │
│  │              │              │                       │  │
│  │   Stage 1    │   Stage 2    │      Stage 3          │  │
│  │   BM25       │   Vector     │      LLM              │  │
│  │   Scoring    │   Similarity │      Analysis         │  │
│  │              │              │                       │  │
│  │   Weight:    │   Weight:    │      Weight:          │  │
│  │   0.30       │   0.40       │      0.30             │  │
│  │              │              │                       │  │
│  └──────┬───────┴──────┬───────┴────────┬──────────────┘  │
│         │              │                │                  │
└─────────┼──────────────┼────────────────┼──────────────────┘
          │              │                │
          ↓              ↓                ↓
    ┌──────────┐   ┌──────────┐   ┌──────────────┐
    │ Keywords │   │ pgvector │   │ Claude AI    │
    │ Match    │   │ Cosine   │   │ Contextual   │
    │          │   │ Distance │   │ Analysis     │
    └──────┬───┘   └────┬─────┘   └──────┬───────┘
           │            │                │
           └────────────┼────────────────┘
                        │
                        ↓
              ┌──────────────────┐
              │ Combined Score   │
              │ (0-100 scale)    │
              └──────────────────┘
                        │
                        ↓
              ┌──────────────────┐
              │ Ranked Results   │
              │ with Explanation │
              └──────────────────┘
```

## Hybrid Scoring Algorithm

### Score Calculation

The final match score is a weighted combination of three scoring methods:

```typescript
finalScore = bm25Score * 0.3 + vectorScore * 0.4 + llmScore * 0.3
```

**Rationale for Weights:**

- **Vector Score (40%)**: Highest weight because it captures semantic meaning beyond keywords
- **BM25 Score (30%)**: Important for exact keyword matches and technical terms
- **LLM Score (30%)**: Provides contextual understanding and nuanced matching

### Stage 1: BM25 Keyword Scoring

**Algorithm:** Okapi BM25 (Best Matching 25)

**Implementation:** `apps/web/src/lib/semantic-search.ts` - `calculateBM25Score()`

**How It Works:**

1. Tokenize query and document into terms
2. Calculate term frequency (TF) in document
3. Calculate inverse document frequency (IDF) across corpus
4. Apply BM25 formula with tuning parameters k1=1.2, b=0.75

**Formula:**

```
BM25(q,d) = Σ IDF(qi) * (f(qi,d) * (k1 + 1)) / (f(qi,d) + k1 * (1 - b + b * |d| / avgdl))

where:
  qi = query term i
  f(qi,d) = term frequency of qi in document d
  |d| = document length
  avgdl = average document length in corpus
  k1 = 1.2 (term frequency saturation)
  b = 0.75 (length normalization)
```

**Example:**

```typescript
const query = 'Senior React developer with Node.js experience'
const candidateCV = '5 years of React development, Node.js backend...'

const bm25Score = calculateBM25Score(query, candidateCV)
// Returns: 0.72 (72% keyword match)
```

**Strengths:**

- Fast computation (< 50ms)
- Excellent for exact technical term matches ("React", "Node.js")
- Handles term frequency and document length normalization

**Limitations:**

- Doesn't understand synonyms (e.g., "frontend" vs "front-end")
- No semantic understanding (e.g., "React" and "JavaScript UI library" are unrelated)

---

### Stage 2: Vector Similarity Scoring

**Algorithm:** Cosine Similarity with pgvector

**Implementation:** PostgreSQL pgvector extension + `apps/web/src/lib/semantic-search.ts`

**How It Works:**

1. Generate embeddings for query and candidate CV using Claude/OpenAI
2. Store embeddings as float arrays in `Candidate.cvEmbedding` field
3. Use pgvector `<=>` operator for cosine distance calculation
4. Convert distance to similarity score

**Embedding Generation:**

```typescript
// apps/web/src/lib/ai-matching.ts
import Anthropic from '@anthropic-ai/sdk'

async function generateEmbedding(text: string): Promise<number[]> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  // Use Claude to generate semantic embedding
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Generate a semantic embedding vector for: ${text}`,
      },
    ],
  })

  // Extract embedding from response
  // In practice, use a dedicated embedding model or API
  return parseEmbeddingFromResponse(response)
}
```

**Database Schema:**

```sql
-- Prisma schema
model Candidate {
  id          String   @id @default(cuid())
  cvEmbedding Float[]  // Vector embedding of CV text

  @@index([cvEmbedding(ops: vector_cosine_ops)])
}
```

**Query Pattern:**

```typescript
// Find similar candidates using vector similarity
const results = await prisma.$queryRaw`
  SELECT
    id,
    1 - (cvEmbedding <=> ${queryEmbedding}::vector) AS similarity
  FROM "Candidate"
  WHERE 1 - (cvEmbedding <=> ${queryEmbedding}::vector) > 0.5
  ORDER BY similarity DESC
  LIMIT 20
`
```

**Cosine Similarity Formula:**

```
similarity = 1 - distance
distance = 1 - (A · B) / (||A|| * ||B||)

where:
  A = query embedding vector
  B = candidate embedding vector
  · = dot product
  || || = vector magnitude
```

**Example:**

```typescript
const queryEmbedding = await generateEmbedding('Senior React developer')
const candidateEmbedding = candidate.cvEmbedding

const vectorScore = await calculateVectorSimilarity(queryEmbedding, candidateEmbedding)
// Returns: 0.85 (85% semantic similarity)
```

**Strengths:**

- Captures semantic meaning (understands "frontend engineer" ≈ "React developer")
- Language-agnostic (works across different phrasings)
- Handles synonyms and related concepts

**Limitations:**

- Slower than BM25 (requires embedding generation)
- Requires pre-computed embeddings (asynchronous via workers)
- Black-box model (hard to explain why something matched)

---

### Stage 3: LLM Contextual Analysis

**Algorithm:** Claude AI with structured prompting

**Implementation:** `apps/web/src/lib/ai-matching.ts` - `calculateLLMScore()`

**How It Works:**

1. Send job description + candidate CV to Claude AI
2. Structured prompt asks Claude to evaluate match on specific criteria
3. Claude returns JSON with score (0-100) and explanation

**Prompt Template:**

```typescript
const prompt = `
You are an expert technical recruiter. Evaluate how well this candidate matches the job requirements.

Job Description:
${jobDescription}

Candidate CV:
${candidateCV}

Evaluate the match based on:
1. Technical Skills (40%) - Do they have the required tech stack?
2. Experience Level (30%) - Does their seniority match?
3. Domain Knowledge (20%) - Relevant industry experience?
4. Soft Skills (10%) - Communication, leadership mentioned?

Return JSON:
{
  "score": 0-100,
  "breakdown": {
    "skills": 0-100,
    "experience": 0-100,
    "domain": 0-100,
    "soft": 0-100
  },
  "explanation": "2-3 sentence summary of why this is a good/bad match",
  "matchedSkills": ["React", "Node.js"],
  "missingSkills": ["Python", "AWS"]
}
`
```

**Example Request:**

```typescript
import Anthropic from '@anthropic-ai/sdk'

async function calculateLLMScore(
  jobDescription: string,
  candidateCV: string,
): Promise<LLMMatchResult> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const result = JSON.parse(response.content[0].text)
  return {
    score: result.score / 100, // Normalize to 0-1
    breakdown: result.breakdown,
    explanation: result.explanation,
    matchedSkills: result.matchedSkills,
    missingSkills: result.missingSkills,
  }
}
```

**Example Response:**

```json
{
  "score": 0.82,
  "breakdown": {
    "skills": 85,
    "experience": 80,
    "domain": 75,
    "soft": 90
  },
  "explanation": "Strong match with 5 years React experience and Node.js backend skills. Missing Python and AWS experience but has strong fundamentals.",
  "matchedSkills": ["React", "Node.js", "TypeScript", "REST APIs"],
  "missingSkills": ["Python", "AWS", "Docker"]
}
```

**Strengths:**

- Deep contextual understanding (can read between the lines)
- Provides human-readable explanations
- Can evaluate soft skills and cultural fit cues
- Handles ambiguity and nuance

**Limitations:**

- Most expensive (API costs per request)
- Slowest (2-5 seconds per candidate)
- Non-deterministic (slight variations between runs)
- Rate limits (need to queue requests)

---

## Combining Scores

### Weighted Average

```typescript
// apps/web/src/lib/semantic-search.ts
function calculateFinalScore(bm25Score: number, vectorScore: number, llmScore: number): number {
  const weights = {
    bm25: 0.3,
    vector: 0.4,
    llm: 0.3,
  }

  const finalScore =
    bm25Score * weights.bm25 + vectorScore * weights.vector + llmScore * weights.llm

  return Math.round(finalScore * 100) // Convert to 0-100 scale
}
```

### Example Calculation

**Candidate Match Scores:**

- BM25: 0.72 (72%)
- Vector: 0.85 (85%)
- LLM: 0.82 (82%)

**Final Score:**

```
finalScore = (0.72 * 0.30) + (0.85 * 0.40) + (0.82 * 0.30)
           = 0.216 + 0.340 + 0.246
           = 0.802
           = 80.2% match
```

---

## Embedding Generation Workflow

### Overview

Embeddings are generated asynchronously via BullMQ workers to avoid blocking the main application.

### Flow

```
┌─────────────────────────────────────────┐
│  1. CV Upload                           │
│     (User uploads PDF/DOCX)             │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│  2. CV Parsing                          │
│     (Extract text via parser pipeline)  │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│  3. Store CV Text                       │
│     (Save parsed text to Resume model)  │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│  4. Enqueue Embedding Job               │
│     (Add job to 'embedding' queue)      │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│  5. Worker Processes Job                │
│     (embedding.worker.ts)               │
│     • Generate embedding via Claude AI  │
│     • Store in Candidate.cvEmbedding    │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│  6. Embedding Stored                    │
│     (Candidate now searchable)          │
└─────────────────────────────────────────┘
```

### Implementation

**Step 4: Enqueue Job**

```typescript
// apps/web/src/app/api/cv/upload/route.ts
import { embeddingQueue } from '@/lib/queue'

// After CV parsing
const resume = await prisma.resume.create({
  data: {
    candidateId,
    parsedText,
    isPrimary: true,
  },
})

// Enqueue embedding generation
await embeddingQueue.add('generate-cv-embedding', {
  type: 'cv',
  entityId: candidate.id,
  text: parsedText,
})
```

**Step 5: Worker Processing**

```typescript
// apps/web/src/workers/embedding.worker.ts
import { Worker, Job } from 'bullmq'
import { generateEmbedding } from '@/lib/ai-matching'
import { prisma } from '@/lib/prisma'

const embeddingWorker = new Worker(
  'embedding',
  async (job: Job) => {
    const { type, entityId, text } = job.data

    // Generate embedding using Claude AI
    const embedding = await generateEmbedding(text)

    // Store in database
    if (type === 'cv') {
      await prisma.candidate.update({
        where: { id: entityId },
        data: { cvEmbedding: embedding },
      })
    } else if (type === 'job') {
      await prisma.job.update({
        where: { id: entityId },
        data: { embedding },
      })
    }

    console.log(`Generated ${type} embedding for ${entityId}`)
  },
  {
    connection: redisConnection,
    concurrency: 10, // Process 10 embeddings in parallel
  },
)
```

### Caching Strategy

**Problem:** Generating embeddings is expensive (time + API cost)

**Solution:** Cache embeddings for duplicate text

```typescript
// apps/web/src/lib/embedding-cache.ts
import { Redis } from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

async function getCachedEmbedding(text: string): Promise<number[] | null> {
  const hash = crypto.createHash('sha256').update(text).digest('hex')
  const cached = await redis.get(`embedding:${hash}`)

  if (cached) {
    return JSON.parse(cached)
  }

  return null
}

async function cacheEmbedding(text: string, embedding: number[]): Promise<void> {
  const hash = crypto.createHash('sha256').update(text).digest('hex')
  await redis.set(`embedding:${hash}`, JSON.stringify(embedding), 'EX', 86400) // 24 hours
}
```

---

## Search API Endpoints

### Candidate Search

**Endpoint:** `POST /api/candidates/search`

**Request:**

```typescript
{
  "query": "Senior React developer with Node.js",
  "orgId": "org_abc123",
  "filters": {
    "skills": ["React", "Node.js"],
    "experienceMin": 3,
    "experienceMax": 8,
    "location": "Remote"
  },
  "limit": 20,
  "offset": 0,
  "minSimilarity": 0.5
}
```

**Response:**

```typescript
{
  "candidates": [
    {
      "id": "cand_xyz789",
      "name": "John Doe",
      "email": "john@example.com",
      "matchScore": 85,
      "bm25Score": 72,
      "vectorScore": 85,
      "llmScore": 82,
      "explanation": "Strong match with 5 years React experience...",
      "matchedSkills": ["React", "Node.js", "TypeScript"],
      "missingSkills": ["Python", "AWS"]
    }
  ],
  "total": 1,
  "page": 0,
  "pageSize": 20
}
```

**Implementation:**

```typescript
// apps/web/src/app/api/candidates/search/route.ts
import { hybridSearch } from '@/lib/semantic-search'

export async function POST(req: Request) {
  const { query, orgId, filters, limit, offset, minSimilarity } = await req.json()

  // Execute hybrid search
  const results = await hybridSearch({
    query,
    orgId,
    filters,
    limit,
    offset,
    minSimilarity,
  })

  return NextResponse.json(results)
}
```

---

### Job Recommendations

**Endpoint:** `GET /api/jobs/recommended`

**Response:**

```typescript
{
  "jobs": [
    {
      "id": "job_123",
      "title": "Senior React Developer",
      "organization": { "name": "Tech Corp" },
      "matchScore": 88,
      "matchDetails": {
        "skills": 85,
        "experience": 90,
        "education": 80,
        "location": 95,
        "salary": 85
      },
      "matchedSkills": ["React", "TypeScript", "Node.js"],
      "missingSkills": ["AWS"],
      "explanation": "Excellent match based on your React expertise and full-stack experience."
    }
  ]
}
```

---

## Performance Optimizations

### Database Indexes

**Critical Indexes for Search Performance:**

```prisma
// packages/db/prisma/schema.prisma

model Candidate {
  id          String   @id @default(cuid())
  cvEmbedding Float[]

  @@index([cvEmbedding(ops: vector_cosine_ops)]) // Vector search
}

model Job {
  id        String   @id @default(cuid())
  embedding Float[]
  orgId     String
  status    JobStatus

  @@index([embedding(ops: vector_cosine_ops)])
  @@index([orgId, status]) // Organization scoping
}

model MatchScore {
  id          String  @id @default(cuid())
  candidateId String
  jobId       String
  score       Float

  @@index([candidateId, score])
  @@index([jobId, score])
  @@unique([candidateId, jobId])
}
```

### Query Optimization

**Problem:** Calculating match scores for 1000+ candidates is slow

**Solution 1: Pre-compute Match Scores**

```typescript
// Nightly cron job to pre-compute match scores
async function precomputeMatchScores() {
  const jobs = await prisma.job.findMany({
    where: { status: 'PUBLISHED' },
  })

  for (const job of jobs) {
    const candidates = await prisma.candidate.findMany({
      where: { orgId: job.orgId },
    })

    for (const candidate of candidates) {
      const score = await calculateHybridScore(job, candidate)

      await prisma.matchScore.upsert({
        where: {
          candidateId_jobId: {
            candidateId: candidate.id,
            jobId: job.id,
          },
        },
        update: { score, updatedAt: new Date() },
        create: { candidateId: candidate.id, jobId: job.id, score },
      })
    }
  }
}
```

**Solution 2: Pagination with Cursor**

```typescript
// Paginate search results efficiently
async function searchCandidates(query: string, cursor?: string, limit = 20) {
  const results = await prisma.candidate.findMany({
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { matchScore: 'desc' },
  })

  return {
    candidates: results,
    nextCursor: results[results.length - 1]?.id,
  }
}
```

**Solution 3: Redis Caching**

```typescript
// Cache search results for 5 minutes
import { redis } from '@/lib/redis'

async function getCachedSearchResults(query: string, filters: any) {
  const cacheKey = `search:${JSON.stringify({ query, filters })}`
  const cached = await redis.get(cacheKey)

  if (cached) {
    return JSON.parse(cached)
  }

  const results = await hybridSearch(query, filters)
  await redis.set(cacheKey, JSON.stringify(results), 'EX', 300) // 5 min

  return results
}
```

---

## Monitoring & Observability

### Search Metrics

**Track key metrics for search quality:**

```typescript
// apps/web/src/lib/search-metrics.ts
interface SearchMetrics {
  query: string
  resultsCount: number
  avgMatchScore: number
  executionTime: number
  bm25Time: number
  vectorTime: number
  llmTime: number
}

async function logSearchMetrics(metrics: SearchMetrics) {
  await prisma.searchLog.create({
    data: {
      query: metrics.query,
      resultsCount: metrics.resultsCount,
      avgScore: metrics.avgMatchScore,
      executionTimeMs: metrics.executionTime,
      timestamp: new Date(),
    },
  })

  // Send to monitoring service (Sentry, Datadog, etc.)
  console.log('Search executed:', metrics)
}
```

### A/B Testing Score Weights

**Experiment with different weight combinations:**

```typescript
// Test different weight configurations
const weightConfigs = [
  { bm25: 0.3, vector: 0.4, llm: 0.3 }, // Current
  { bm25: 0.2, vector: 0.5, llm: 0.3 }, // More vector
  { bm25: 0.4, vector: 0.3, llm: 0.3 }, // More keyword
]

async function runABTest(query: string, candidates: Candidate[]) {
  const results = []

  for (const weights of weightConfigs) {
    const scores = await calculateScoresWithWeights(query, candidates, weights)
    results.push({ weights, scores })
  }

  return results
}
```

---

## Troubleshooting

### Common Issues

**Issue:** Vector search returns no results

**Cause:** Embeddings not generated yet

**Solution:** Check if candidate has `cvEmbedding`:

```typescript
const candidate = await prisma.candidate.findUnique({
  where: { id },
  select: { cvEmbedding: true },
})

if (!candidate.cvEmbedding) {
  // Trigger embedding generation
  await embeddingQueue.add('generate-cv-embedding', {
    type: 'cv',
    entityId: candidate.id,
    text: candidate.resumes[0].parsedText,
  })
}
```

---

**Issue:** Slow search performance (> 2 seconds)

**Cause:** Too many candidates, no indexes

**Solution:**

1. Add pgvector index: `@@index([cvEmbedding(ops: vector_cosine_ops)])`
2. Use pagination with LIMIT
3. Pre-compute match scores

---

**Issue:** Match scores are inconsistent

**Cause:** LLM is non-deterministic

**Solution:** Use temperature=0 for more consistent results:

```typescript
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  temperature: 0, // Deterministic
  messages: [{ role: 'user', content: prompt }],
})
```

---

**Issue:** High embedding costs

**Cause:** Generating embeddings for every search

**Solution:**

1. Cache embeddings in Redis
2. Use cheaper embedding models
3. Batch embedding generation
4. Only regenerate if CV text changes

---

## Future Enhancements

### Planned Improvements

1. **Fine-tuned Embedding Model**
   - Train custom model on recruitment data
   - Better domain-specific embeddings

2. **Multi-modal Search**
   - Include GitHub profiles, LinkedIn data
   - Analyze code samples and projects

3. **Relevance Feedback**
   - Learn from recruiter actions (viewed, contacted, hired)
   - Adjust weights based on feedback

4. **Explainable AI**
   - Highlight matching text passages
   - Show which keywords/skills contributed most to score

5. **Real-time Search**
   - WebSocket-based live search
   - Stream results as they're computed

---

## References

- **BM25 Algorithm**: [Wikipedia](https://en.wikipedia.org/wiki/Okapi_BM25)
- **pgvector Extension**: [GitHub](https://github.com/pgvector/pgvector)
- **Anthropic Claude**: [API Docs](https://docs.anthropic.com/)
- **Cosine Similarity**: [Wikipedia](https://en.wikipedia.org/wiki/Cosine_similarity)
