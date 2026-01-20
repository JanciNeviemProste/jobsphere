# Background Workers Architecture

## Overview

JobSphere uses **BullMQ** for reliable background job processing. Workers handle time-consuming tasks asynchronously to keep API responses fast and improve user experience.

## Queue System

### Technology Stack

- **Queue System:** BullMQ (Redis-based)
- **Redis Provider:** Upstash (serverless Redis)
- **Worker Runtime:** Node.js (separate process from Next.js)
- **Job Storage:** Redis with persistence

### Queue Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     API Routes                             │
│  (Enqueue jobs via queue.add())                            │
└───────────────────┬────────────────────────────────────────┘
                    │
                    ↓
┌────────────────────────────────────────────────────────────┐
│                 Redis (Upstash)                            │
│  ┌──────────────┬──────────────┬───────────────────────┐  │
│  │ Email Queue  │ Embed Queue  │ Grading Queue         │  │
│  │              │              │                       │  │
│  │ Priority: 1  │ Priority: 2  │ Priority: 3           │  │
│  │ Retry: 3x    │ Retry: 5x    │ Retry: 3x             │  │
│  └──────┬───────┴──────┬───────┴────────┬──────────────┘  │
└─────────┼──────────────┼────────────────┼─────────────────┘
          │              │                │
          ↓              ↓                ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Email Worker │  │ Embed Worker │  │ Grade Worker │
│              │  │              │  │              │
│ • Send email │  │ • Generate   │  │ • AI grade   │
│ • Track      │  │   embeddings │  │   answers    │
│   delivery   │  │ • Store      │  │ • Calculate  │
│              │  │   vectors    │  │   score      │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Worker Types

### 1. Email Sequence Worker

**File:** `apps/web/src/workers/email-sequence.worker.ts`

**Purpose:** Process automated email drip campaigns

**Job Types:**

- `send-email-step`: Send individual email step
- `schedule-sequence`: Schedule entire email sequence

**Processing Logic:**

```typescript
// Job data structure
interface EmailStepJob {
  sequenceId: string
  stepId: string
  candidateId: string
  variables: {
    candidateName: string
    jobTitle: string
    companyName: string
    // ... other template variables
  }
}

// Worker processing
async function processEmailStep(job: Job<EmailStepJob>) {
  const { sequenceId, stepId, candidateId, variables } = job.data

  // 1. Fetch email template from database
  const step = await prisma.emailSequenceStep.findUnique({
    where: { id: stepId },
  })

  // 2. Replace template variables
  const subject = replaceVariables(step.subject, variables)
  const body = replaceVariables(step.bodyTemplate, variables)

  // 3. Send email via Resend/SendGrid
  await sendEmail({
    to: candidate.email,
    subject,
    html: body,
  })

  // 4. Track email sent
  await prisma.email.create({
    data: {
      sequenceId,
      stepId,
      candidateId,
      status: 'SENT',
    },
  })

  // 5. Schedule next step (if exists)
  const nextStep = await getNextStep(sequenceId, stepId)
  if (nextStep) {
    await emailQueue.add(
      'send-email-step',
      {
        ...job.data,
        stepId: nextStep.id,
      },
      {
        delay: nextStep.dayOffset * 24 * 60 * 60 * 1000, // Days to milliseconds
      },
    )
  }
}
```

**Configuration:**

```typescript
const emailQueue = new Queue('email-sequence', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // Start with 5 second delay
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
})

const emailWorker = new Worker('email-sequence', processEmailStep, {
  connection: redisConnection,
  concurrency: 5, // Process 5 emails simultaneously
})
```

**Error Handling:**

- Retry failed sends up to 3 times
- Exponential backoff between retries
- Log failures to database
- Alert admin on permanent failures

---

### 2. Embedding Generation Worker

**File:** `apps/web/src/workers/embedding.worker.ts`

**Purpose:** Generate vector embeddings for semantic search

**Job Types:**

- `generate-cv-embedding`: Create embedding for candidate CV
- `generate-job-embedding`: Create embedding for job description

**Processing Logic:**

```typescript
// Job data structure
interface EmbeddingJob {
  type: 'cv' | 'job'
  entityId: string
  text: string
}

// Worker processing
async function processEmbedding(job: Job<EmbeddingJob>) {
  const { type, entityId, text } = job.data

  // 1. Generate embedding using Claude AI or OpenAI
  const embedding = await generateEmbedding(text)

  // 2. Store in database
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

  // 3. Log completion
  console.log(`Generated ${type} embedding for ${entityId}`)
}
```

**Configuration:**

```typescript
const embeddingQueue = new Queue('embedding', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    priority: 2, // Medium priority
  },
})

const embeddingWorker = new Worker('embedding', processEmbedding, {
  connection: redisConnection,
  concurrency: 10, // High concurrency for fast processing
})
```

**Optimization:**

- Batch processing for multiple embeddings
- Caching of embeddings for duplicate text
- Rate limiting for AI API calls
- Fallback to simpler embeddings if AI fails

---

### 3. Assessment Grading Worker

**File:** `apps/web/src/workers/assessment-grading.worker.ts`

**Purpose:** Auto-grade assessment submissions using Claude AI

**Job Types:**

- `grade-assessment`: Grade entire assessment attempt

**Processing Logic:**

```typescript
// Job data structure
interface GradingJob {
  attemptId: string
  assessmentId: string
}

// Worker processing
async function processGrading(job: Job<GradingJob>) {
  const { attemptId, assessmentId } = job.data

  // 1. Fetch attempt with answers
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: true,
      assessment: {
        include: {
          sections: {
            include: { questions: true },
          },
        },
      },
    },
  })

  let totalScore = 0
  let maxScore = 0

  // 2. Grade each question
  for (const question of getAllQuestions(attempt.assessment)) {
    const answer = attempt.answers.find((a) => a.questionId === question.id)
    maxScore += question.points

    let score = 0

    switch (question.type) {
      case 'MCQ':
      case 'MULTI_SELECT':
        // Automatic grading for multiple choice
        score = gradeMultipleChoice(answer, question)
        break

      case 'SHORT_TEXT':
      case 'LONG_TEXT':
      case 'CODE':
        // AI grading for open-ended questions
        score = await gradeWithAI(answer, question)
        break
    }

    // 3. Update answer score
    await prisma.answer.update({
      where: { id: answer.id },
      data: { score },
    })

    totalScore += score
  }

  // 4. Calculate percentage and update attempt
  const percentage = (totalScore / maxScore) * 100
  const passed = percentage >= attempt.assessment.passingScore

  await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      totalScore,
      percentage,
      status: 'GRADED',
      gradedAt: new Date(),
    },
  })

  // 5. Notify candidate (optional)
  if (passed) {
    await notifyCandidate(attempt.candidateId, 'PASSED', percentage)
  }
}

// AI grading helper
async function gradeWithAI(answer: Answer, question: Question): Promise<number> {
  const prompt = `
    Grade this answer according to the rubric.

    Question: ${question.text}
    Rubric: ${question.rubric}
    Max Points: ${question.points}

    Student Answer: ${answer.text}

    Provide a score between 0 and ${question.points} based on:
    - Correctness
    - Completeness
    - Code quality (if applicable)
    - Clarity of explanation

    Return only a number.
  `

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 100,
    messages: [{ role: 'user', content: prompt }],
  })

  const score = parseFloat(response.content[0].text)
  return Math.min(score, question.points)
}
```

**Configuration:**

```typescript
const gradingQueue = new Queue('assessment-grading', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    priority: 3, // Lower priority than real-time operations
  },
})

const gradingWorker = new Worker('assessment-grading', processGrading, {
  connection: redisConnection,
  concurrency: 3, // Limited concurrency to avoid AI rate limits
})
```

**Error Handling:**

- Retry on AI API failures
- Fallback to manual grading if AI fails repeatedly
- Notify admin of grading errors
- Keep attempt in SUBMITTED state if grading fails

---

## Queue Configuration

### Redis Connection

```typescript
import { Queue, Worker } from 'bullmq'
import { Redis } from 'ioredis'

const redisConnection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})
```

### Job Options

```typescript
interface JobOptions {
  priority?: number // 1 (highest) to 10 (lowest)
  delay?: number // Milliseconds before processing
  attempts?: number // Max retry attempts
  backoff?: {
    type: 'exponential' | 'fixed'
    delay: number // Initial delay in ms
  }
  removeOnComplete?: boolean | number // Auto-remove after N jobs
  removeOnFail?: boolean | number // Keep failed jobs for debugging
}
```

### Worker Options

```typescript
interface WorkerOptions {
  concurrency?: number // Max concurrent jobs
  limiter?: {
    max: number // Max jobs per duration
    duration: number // Time window in ms
  }
}
```

## Monitoring & Observability

### Health Checks

```typescript
// Check worker status
const workers = [emailWorker, embeddingWorker, gradingWorker]

for (const worker of workers) {
  worker.on('ready', () => {
    console.log(`Worker ${worker.name} is ready`)
  })

  worker.on('error', (err) => {
    console.error(`Worker ${worker.name} error:`, err)
    // Alert monitoring system
  })
}
```

### Job Metrics

```typescript
// Track job completion
worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed in ${job.finishedOn - job.processedOn}ms`)
})

// Track job failures
worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err)
  // Send to Sentry or logging service
})
```

### Queue Metrics

```typescript
// Get queue stats
const counts = await queue.getJobCounts()
console.log({
  waiting: counts.waiting,
  active: counts.active,
  completed: counts.completed,
  failed: counts.failed,
})
```

## Running Workers

### Development

```bash
# Start all workers
cd apps/web && yarn workers

# Start specific worker
cd apps/web && yarn workers:email
```

### Production

```bash
# PM2 or similar process manager
pm2 start apps/web/src/workers/index.ts --name jobsphere-workers

# Or Docker
docker-compose up workers
```

## Best Practices

### 1. Idempotent Jobs

- Design jobs to be safely retried
- Check if work already completed
- Use unique job IDs to prevent duplicates

### 2. Graceful Failures

- Handle errors without throwing
- Log failures for debugging
- Provide fallback mechanisms

### 3. Job Data

- Keep job data small (< 1KB)
- Store large data in database
- Pass only IDs and metadata

### 4. Concurrency

- Set appropriate concurrency limits
- Consider API rate limits
- Monitor Redis memory usage

### 5. Cleanup

- Remove completed jobs
- Archive failed jobs periodically
- Monitor queue growth

## Troubleshooting

### Common Issues

**Issue:** Jobs stuck in "active" state

- **Cause:** Worker crashed without cleaning up
- **Solution:** Restart workers, jobs will be retried

**Issue:** Redis connection errors

- **Cause:** Network issues or Redis down
- **Solution:** Check Redis health, restart workers

**Issue:** High memory usage

- **Cause:** Too many queued jobs
- **Solution:** Increase workers or reduce job size

**Issue:** Jobs failing repeatedly

- **Cause:** Invalid job data or code error
- **Solution:** Check logs, fix code, manually retry

### Debug Mode

```typescript
// Enable debug logging
process.env.DEBUG = 'bull*'

// Or use BullMQ UI for monitoring
// https://github.com/felixmosh/bull-board
```
