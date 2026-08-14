/**
 * Importing a worker module must not construct a worker.
 *
 * Constructing a BullMQ Worker opens a Redis connection immediately. The
 * /api/cron routes import processor functions out of these modules, so a
 * module-level `new Worker(...)` means every serverless invocation dials a Redis
 * it has no use for — which is exactly what production logs showed after the
 * cron routes shipped: a connection error per request, for a queue with no
 * consumer.
 *
 * This is a source-level check rather than a runtime one on purpose: importing
 * the modules to observe the side effect would *cause* the side effect, and the
 * failure would then depend on whether a Redis happened to answer.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const WORKERS_DIR = join(process.cwd(), 'src', 'workers')

const workerFiles = readdirSync(WORKERS_DIR).filter((f) => f.endsWith('.worker.ts'))

describe('worker modules have no construction side effects', () => {
  it('finds the worker modules at all', () => {
    // Guards against the glob silently matching nothing, which would make every
    // assertion below vacuously true.
    expect(workerFiles.length).toBeGreaterThanOrEqual(5)
  })

  it.each(workerFiles)('%s does not construct a Worker at module scope', (file) => {
    const source = readFileSync(join(WORKERS_DIR, file), 'utf8')

    // A construction at module scope starts at column 0; inside a factory
    // function it is indented. That distinction is the whole check.
    const moduleScopeConstruction = /^(export\s+)?(const|let|var)\s+\w+\s*=\s*new Worker/m
    expect(source).not.toMatch(moduleScopeConstruction)
  })

  it.each(workerFiles)('%s exports a create* factory instead', (file) => {
    const source = readFileSync(join(WORKERS_DIR, file), 'utf8')
    expect(source).toMatch(/export function create\w*Worker\s*\(/)
  })
})
