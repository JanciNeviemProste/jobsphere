/**
 * Server action contract.
 *
 * `'use server'` functions are callable by anything that can POST to the page —
 * Next generates an endpoint per exported action. They never pass through
 * withCsrfProtection or withRateLimit, because there is no route module to wrap,
 * so the guard inside the function body is the only thing between a stranger and
 * the mutation.
 *
 * The route contract can lean on wrapper identifiers. Here there are none, so the
 * contract is stated at the level of the body: every exported action must call an
 * auth guard, and it must do so before it writes.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ACTIONS_DIR = join(__dirname, '..', '..', 'src', 'lib', 'actions')

const AUTH_GUARDS = new Set(['auth', 'getServerSession', 'requireAuth', 'requireOrgAuth'])

/** Prisma calls that change data. */
const WRITE_METHODS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
])

interface Action {
  file: string
  name: string
  fn: ts.FunctionDeclaration
}

function collectActions(): Action[] {
  const files = readdirSync(ACTIONS_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
  const actions: Action[] = []

  for (const file of files) {
    const full = join(ACTIONS_DIR, file)
    const text = readFileSync(full, 'utf8')
    const sf = ts.createSourceFile(full, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)

    // Only modules that actually declare themselves as server actions.
    const isServerModule = sf.statements.some(
      (s) =>
        ts.isExpressionStatement(s) &&
        ts.isStringLiteral(s.expression) &&
        s.expression.text === 'use server',
    )
    if (!isServerModule) continue

    for (const stmt of sf.statements) {
      if (!ts.isFunctionDeclaration(stmt) || !stmt.name) continue
      const exported = ts.getModifiers(stmt)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      if (!exported) continue
      actions.push({ file, name: stmt.name.text, fn: stmt })
    }
  }

  return actions
}

/** Position of the first auth-guard call in the body, or -1. */
function firstAuthGuardPos(fn: ts.Node): number {
  let pos = -1
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      if (AUTH_GUARDS.has(n.expression.text) && (pos === -1 || n.pos < pos)) pos = n.pos
    }
    ts.forEachChild(n, visit)
  }
  visit(fn)
  return pos
}

/** Position of the first `prisma.<model>.<write>()` call, or -1. */
function firstWritePos(fn: ts.Node): number {
  let pos = -1
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const method = n.expression.name.text
      const receiver = n.expression.expression
      const isPrismaModel =
        ts.isPropertyAccessExpression(receiver) &&
        ts.isIdentifier(receiver.expression) &&
        receiver.expression.text === 'prisma'
      if (isPrismaModel && WRITE_METHODS.has(method) && (pos === -1 || n.pos < pos)) pos = n.pos
    }
    ts.forEachChild(n, visit)
  }
  visit(fn)
  return pos
}

const actions = collectActions()

describe('server action contract', () => {
  it('finds the server actions at all', () => {
    // Guards against the whole suite silently passing over an empty list if the
    // actions move directory or drop their 'use server' banner.
    expect(actions.length).toBeGreaterThanOrEqual(7)
    expect(new Set(actions.map((a) => a.file)).size).toBeGreaterThanOrEqual(2)
  })

  it('every exported action authenticates its caller', () => {
    const unguarded = actions
      .filter((a) => firstAuthGuardPos(a.fn) === -1)
      .map((a) => `${a.file}: ${a.name}`)
    expect(unguarded).toEqual([])
  })

  it('every exported action authenticates before it writes', () => {
    // Ordering matters: a guard that runs after the create/update/delete leaves
    // the mutation done and only the response refused.
    const lateGuard = actions
      .filter((a) => {
        const write = firstWritePos(a.fn)
        if (write === -1) return false
        const guard = firstAuthGuardPos(a.fn)
        return guard === -1 || guard > write
      })
      .map((a) => `${a.file}: ${a.name}`)
    expect(lateGuard).toEqual([])
  })
})
