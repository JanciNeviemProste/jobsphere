import { handlers } from "@/lib/auth"

// Force Node.js runtime instead of Edge Runtime
// Edge Runtime doesn't support bcryptjs and has limited Prisma support
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const { GET, POST } = handlers
