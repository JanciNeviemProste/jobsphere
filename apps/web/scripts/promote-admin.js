#!/usr/bin/env node
/**
 * Promote a user to Global Admin
 * Usage: node apps/web/scripts/promote-admin.js user@example.com
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('Usage: node promote-admin.js <email>')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    console.error(`User with email "${email}" not found.`)
    process.exit(1)
  }

  await prisma.user.update({
    where: { email },
    data: { isGlobalAdmin: true },
  })

  console.log(`✅ User "${email}" is now a Global Admin.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
