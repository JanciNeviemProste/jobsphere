#!/usr/bin/env node
// JobSphere Stop hook — light Definition-of-Done gate (Windows-safe, jq-free).
// Runs typecheck + lint (turbo-cached) only when the working tree is dirty.
// The full test suite is intentionally skipped here (slow, needs a DB) — run it
// via `/po-zmene` or `yarn test`. exit 2 => Claude must fix before finishing.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

let payload = {}
try {
  payload = JSON.parse(readStdin() || '{}')
} catch {
  payload = {}
}

// Avoid infinite loop: if this Stop hook already fired, let Claude finish.
if (payload?.stop_hook_active === true) process.exit(0)

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const isWin = process.platform === 'win32'
const run = (cmd, args) =>
  spawnSync(cmd, args, { cwd: root, encoding: 'utf8', shell: isWin })

// Skip the gate on a clean tree (a purely conversational turn).
const unstaged = run('git', ['diff', '--quiet'])
const staged = run('git', ['diff', '--cached', '--quiet'])
const dirty = (unstaged.status ?? 0) !== 0 || (staged.status ?? 0) !== 0
if (!dirty) process.exit(0)

// Light gate: typecheck + lint (turbo cache makes repeats cheap).
for (const task of ['typecheck', 'lint']) {
  const res = run('yarn', [task])
  if ((res.status ?? 1) !== 0) {
    const tail = (s) => (s ? `\n${String(s).slice(-1500)}` : '')
    process.stderr.write(
      `Definition of Done zlyhalo na "yarn ${task}". ` +
        `Typecheck + lint musia byť zelené pred dokončením — oprav a skús znova.` +
        tail(res.stdout) +
        tail(res.stderr) +
        '\n',
    )
    process.exit(2)
  }
}

process.exit(0)
