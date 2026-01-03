# Database Integration Tests

This directory contains comprehensive database integration tests for JobSphere, covering transactions, schema validation, and vector search functionality.

## Test Files

### 1. `transactions.test.ts`
Tests database transaction handling and data consistency:
- **Transaction Rollback**: Verifies that failed transactions properly roll back all changes
- **Concurrent Operations**: Tests parallel database operations and race condition handling
- **Nested Transactions**: Validates complex multi-table operations within transactions
- **Transaction Isolation**: Ensures proper isolation between concurrent transactions
- **Error Handling**: Tests constraint violations and error recovery

### 2. `schema-validation.test.ts`
Tests database schema constraints and relationships:
- **Foreign Key Constraints**: Validates referential integrity across tables
- **Unique Constraints**: Tests unique indexes (email, slug, composite keys)
- **Cascade Deletes**: Verifies proper cleanup when parent records are deleted
- **Composite Keys**: Tests multi-column unique constraints and queries
- **Data Integrity**: Ensures relationships remain consistent across operations

### 3. `vector-search.test.ts`
Tests pgvector similarity search for semantic matching:
- **Vector Storage**: Tests storing embeddings in Job and ResumeSection tables
- **Cosine Similarity**: Tests semantic search using cosine distance operator (`<=>`)
- **L2 Distance**: Tests Euclidean distance search (`<->`)
- **Inner Product**: Tests dot product similarity search (`<#>`)
- **Hybrid Search**: Combines vector similarity with filters (salary, seniority, remote)
- **Performance**: Tests query performance with multiple embeddings

## Prerequisites

### 1. Test Database
You must use a separate test database to avoid data loss. The tests will automatically fail if `DATABASE_URL` doesn't contain "test".

**Option A: Local PostgreSQL with Docker**
```bash
# Start PostgreSQL with pgvector extension
cd apps/web
yarn docker:up

# Set test database URL
export DATABASE_URL="postgresql://jobsphere:jobsphere_dev_2024@localhost:5432/jobsphere_test"
```

**Option B: Manual PostgreSQL Setup**
```sql
-- Create test database
CREATE DATABASE jobsphere_test;

-- Enable pgvector extension
\c jobsphere_test
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
```

### 2. Database Schema
Apply the Prisma schema to your test database:

```bash
cd apps/web
export DATABASE_URL="postgresql://user:pass@localhost:5432/jobsphere_test"
yarn db:push
```

### 3. Environment Variables
The test setup automatically configures test environment variables, but you need:

```bash
# Required
DATABASE_URL="postgresql://user:pass@localhost:5432/jobsphere_test"

# Optional (auto-configured with test values)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="test-secret"
ANTHROPIC_API_KEY="test-key"
```

## Running Tests

### Run All Database Tests
```bash
cd apps/web
yarn test:integration:run tests/integration/db
```

### Run Specific Test File
```bash
# Transactions only
yarn test:integration:run tests/integration/db/transactions.test.ts

# Schema validation only
yarn test:integration:run tests/integration/db/schema-validation.test.ts

# Vector search only
yarn test:integration:run tests/integration/db/vector-search.test.ts
```

### Interactive Mode
```bash
# Run with Vitest UI
yarn test:integration:ui tests/integration/db

# Watch mode
yarn test:integration tests/integration/db
```

### With Coverage
```bash
yarn test:integration:coverage tests/integration/db
```

## Test Structure

Each test file follows this pattern:

```typescript
describe('Feature Category', () => {
  beforeAll(async () => {
    // Seeds base test data (users, organization)
    await seedTestData()
  })

  beforeEach(async () => {
    // Cleans dynamic data before each test
    await cleanupDynamicData()
  })

  afterAll(async () => {
    // Cleans all test data and disconnects
    await cleanupAllTestData()
    await disconnectDb()
  })

  it('should test specific behavior', async () => {
    // Test implementation
  })
})
```

## Test Data

The test helper (`test-db.ts`) provides:

### Test IDs
```typescript
TEST_IDS.org           // Test organization
TEST_IDS.recruiter     // Recruiter user
TEST_IDS.admin         // Admin user
TEST_IDS.hiringManager // Hiring manager user
TEST_IDS.agency        // Agency user
TEST_IDS.candidate     // Candidate user
```

### Factory Functions
```typescript
createTestJob(overrides?)              // Creates a job
createTestCandidate(overrides?)        // Creates a candidate
createTestCandidateWithContact()       // Creates candidate + contact
createTestApplication(jobId, candidateId)  // Creates application
createTestUser(email, name)            // Creates user
createTestOrganization(name, slug)     // Creates organization
```

## Vector Search Implementation

The vector search tests use raw SQL queries because Prisma doesn't fully support pgvector operations:

```typescript
// Store embedding
await prisma.$executeRaw`
  INSERT INTO "Job" (..., embedding)
  VALUES (..., ${`[${embedding.join(',')}]`}::vector)
`

// Cosine similarity search
const results = await prisma.$queryRaw`
  SELECT id, title,
    1 - (embedding <=> ${`[${queryEmbedding.join(',')}]`}::vector) as similarity
  FROM "Job"
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> ${`[${queryEmbedding.join(',')}]`}::vector
  LIMIT 10
`
```

### Vector Operators
- `<=>` : Cosine distance (0 = identical, 2 = opposite)
- `<->` : L2/Euclidean distance
- `<#>` : Negative inner product

## Common Issues

### Error: DATABASE_URL does not contain "test"
**Solution**: Ensure your `DATABASE_URL` includes "test" in the database name:
```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/jobsphere_test"
```

### Error: relation "Job" does not exist
**Solution**: Apply the Prisma schema to your test database:
```bash
yarn db:push
```

### Error: extension "vector" does not exist
**Solution**: Enable pgvector extension in PostgreSQL:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Tests hang or timeout
**Solution**: Check database connection and increase timeout:
```typescript
it('test name', async () => {
  // test code
}, 30000) // 30 second timeout
```

### Foreign key constraint violations
**Solution**: Ensure you're using test IDs from `TEST_IDS` or creating entities in correct order:
```typescript
const job = await createTestJob()
const candidate = await createTestCandidate()
const application = await createTestApplication(job.id, candidate.id)
```

## Best Practices

1. **Always use test database**: Never point tests at production or development database
2. **Clean up after tests**: Use `cleanupDynamicData()` or `cleanupAllTestData()`
3. **Use factory functions**: Prefer `createTestJob()` over raw Prisma creates
4. **Test isolation**: Each test should be independent and not rely on other tests
5. **Meaningful assertions**: Test actual behavior, not just "doesn't throw"
6. **Transaction testing**: Verify both success and rollback scenarios
7. **Vector dimensions**: Use consistent embedding dimensions (1536 for OpenAI)

## Performance Benchmarks

Expected test execution times:
- Transaction tests: ~5-10 seconds
- Schema validation tests: ~10-15 seconds
- Vector search tests: ~15-20 seconds
- Total suite: ~30-45 seconds

## CI/CD Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run Database Integration Tests
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/jobsphere_test
  run: |
    cd apps/web
    yarn db:push
    yarn test:integration:run tests/integration/db
```

## Further Reading

- [Prisma Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Vitest Integration Testing](https://vitest.dev/guide/testing-types.html#integration-testing)
- [PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
