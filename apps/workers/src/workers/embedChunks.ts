import { Job } from 'bullmq'
import { prisma } from '@jobsphere/db'
import { generateEmbeddings } from '@jobsphere/ai'

interface EmbedChunksJobData {
  resumeId: string
  sections: Array<{
    kind: string
    title?: string
    organization?: string
    text?: string
  }>
}

export async function embedChunksWorker(job: Job<EmbedChunksJobData>) {
  const { resumeId, sections } = job.data

  console.log(`🔢 Generating embeddings for resume ${resumeId}`)

  try {
    let order = 0

    for (const section of sections) {
      const text = [
        section.title,
        section.organization,
        section.text,
      ]
        .filter(Boolean)
        .join(' ')

      if (!text.trim()) continue

      // Generate embeddings
      const embeddings = await generateEmbeddings(text)

      // Store in database
      // Note: pgvector uses SQL for vector inserts
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO "ResumeSection" (
          id, "resumeId", kind, title, organization, text,
          "embeddingVector", "embeddingModel", "order", "createdAt"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          $6::vector, $7, $8, NOW()
        )
        `,
        resumeId,
        section.kind,
        section.title || null,
        section.organization || null,
        text,
        `[${embeddings.join(',')}]`,
        'multilingual-e5-base',
        order++
      )
    }

    // Also index in Meilisearch for full-text search
    // TODO: Add Meilisearch integration

    console.log(`✅ Generated embeddings for ${sections.length} sections`)
    return { sectionsProcessed: sections.length }
  } catch (error) {
    console.error(`❌ Failed to generate embeddings:`, error)
    throw error
  }
}