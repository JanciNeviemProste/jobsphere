import { PrismaClient } from '@prisma/client'
import { put } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const prisma = new PrismaClient()

/**
 * Migration script: Local filesystem → Vercel Blob Storage
 *
 * Migrates CV files from public/uploads/cvs/ to Vercel Blob Storage
 * Updates database URIs to point to Blob URLs
 *
 * Usage:
 *   1. Set BLOB_READ_WRITE_TOKEN in .env.local
 *   2. Run: tsx scripts/migrate-local-files-to-blob.ts
 */
async function migrateLocalFilesToBlob() {
  console.log('🚀 Starting migration: Local files → Vercel Blob Storage\n')

  // Find all documents with local filesystem paths
  const localDocs = await prisma.candidateDocument.findMany({
    where: {
      uri: {
        startsWith: '/uploads/'
      }
    },
    select: {
      id: true,
      uri: true,
      candidateId: true
    }
  })

  console.log(`Found ${localDocs.length} local files to migrate\n`)

  if (localDocs.length === 0) {
    console.log('✅ No local files found. Migration complete!')
    return
  }

  let successCount = 0
  let failCount = 0
  const errors: Array<{ uri: string; error: string }> = []

  for (const doc of localDocs) {
    try {
      // Construct local path
      const localPath = join(process.cwd(), 'public', doc.uri)

      // Read file
      const fileBuffer = await readFile(localPath)

      // Extract filename
      const filename = doc.uri.split('/').pop() || `${doc.id}.pdf`

      // Upload to Vercel Blob
      const blob = await put(`migrated/${doc.candidateId}/${filename}`, fileBuffer, {
        access: 'public',
        addRandomSuffix: false
      })

      // Update database
      await prisma.candidateDocument.update({
        where: { id: doc.id },
        data: { uri: blob.url }
      })

      console.log(`✓ ${doc.uri} → ${blob.url}`)
      successCount++
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`✗ Failed: ${doc.uri} - ${errorMessage}`)
      errors.push({ uri: doc.uri, error: errorMessage })
      failCount++
    }
  }

  console.log(`\n📊 Migration Summary:`)
  console.log(`   ✅ Successful: ${successCount}`)
  console.log(`   ❌ Failed: ${failCount}`)
  console.log(`   📈 Total: ${localDocs.length}`)

  if (errors.length > 0) {
    console.log(`\n❌ Errors:`)
    errors.forEach(({ uri, error }) => {
      console.log(`   - ${uri}: ${error}`)
    })
  }

  console.log('\n✨ Migration complete!')
}

// Run migration
migrateLocalFilesToBlob()
  .catch((err) => {
    console.error('\n❌ Migration failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
