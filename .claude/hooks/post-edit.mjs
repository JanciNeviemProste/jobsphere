#!/usr/bin/env node
// JobSphere PostToolUse hook — Windows-safe, jq-free.
// Reads the hook payload on stdin, formats the changed file with prettier
// (best-effort), then scans it for likely secrets. exit 2 => warning is
// surfaced back to Claude. Never blocks on format/parse/read failures.
import { readFileSync, writeFileSync } from 'node:fs'

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
  process.exit(0) // malformed payload — never block
}

const filePath = payload?.tool_input?.file_path
if (!filePath || !/\.(ts|tsx|js|jsx|mjs|cjs|css|json)$/.test(filePath)) {
  process.exit(0)
}

// 1) Best-effort format via the prettier Node API (resolved from root node_modules).
try {
  const prettier = await import('prettier')
  const format = prettier.format ?? prettier.default?.format
  const resolveConfig = prettier.resolveConfig ?? prettier.default?.resolveConfig
  if (typeof format === 'function') {
    const src = readFileSync(filePath, 'utf8')
    const options = (resolveConfig ? await resolveConfig(filePath) : null) || {}
    const out = await format(src, { ...options, filepath: filePath })
    if (typeof out === 'string' && out !== src) writeFileSync(filePath, out)
  }
} catch {
  // prettier not resolvable / formatting failed — skip silently
}

// 2) Secret scan (the security-relevant part). Trusted .claude config files are
//    skipped so this scanner doesn't flag its own pattern list.
if (/[\\/]\.claude[\\/]/.test(filePath)) process.exit(0)

try {
  const contents = readFileSync(filePath, 'utf8')
  const patterns = [
    /sk_live_[A-Za-z0-9]/,
    /sk-ant-[A-Za-z0-9]/,
    /whsec_[A-Za-z0-9]/,
    /\bnpg_[A-Za-z0-9]/,
    /service_role/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /password\s*[:=]\s*['"][^'"]{6,}['"]/i,
  ]
  const hit = patterns.find((re) => re.test(contents))
  if (hit) {
    process.stderr.write(
      `⚠️  Možný secret v zmenenom súbore ${filePath} (vzor ${hit}). ` +
        `Over a presuň do .env / secret manageru pred commitom.\n`,
    )
    process.exit(2)
  }
} catch {
  // unreadable — don't block
}

process.exit(0)
