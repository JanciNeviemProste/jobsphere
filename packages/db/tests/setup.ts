import { beforeAll, afterAll, beforeEach } from 'vitest'
import { exec } from 'child_process'
import { promisify } from 'util'
import { prisma } from '../src'

const execAsync = promisify(exec)

beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/jobsphere_test'

  // Run migrations
  await execAsync('pnpm prisma migrate deploy')

  console.log('✅ Test database initialized')
})

beforeEach(async () => {
  // Clean database before each test
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `

  for (const { tablename } of tables) {
    if (tablename !== '_prisma_migrations') {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`)
    }
  }
})

afterAll(async () => {
  await prisma.$disconnect()
})