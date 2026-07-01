import { prisma } from '@/lib/prisma'

/**
 * Minimal structural type satisfied by both the Prisma client and a Prisma
 * `$transaction` client — only the `organization.findUnique` used for the
 * uniqueness probe is required.
 */
type OrgSlugFinder = {
  organization: {
    findUnique: (args: { where: { slug: string } }) => Promise<{ id: string } | null>
  }
}

/**
 * Generate a URL-safe, unique organization slug from a base string.
 *
 * Mirrors the signup slug-gen (baseSlug + numeric counter until unique). Accepts
 * an optional Prisma-compatible client so it can run inside a `$transaction`
 * (pass the `tx` client) or against the default singleton.
 */
export async function generateUniqueOrgSlug(
  base: string,
  client: OrgSlugFinder = prisma as unknown as OrgSlugFinder,
): Promise<string> {
  const baseSlug =
    base
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'org'

  let slug = baseSlug
  let counter = 1
  while (await client.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`
    counter++
  }
  return slug
}
