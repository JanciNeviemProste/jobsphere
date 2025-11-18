/**
 * OpenAI Embeddings Library
 * Generate and manage vector embeddings for CV and job semantic search
 */

import OpenAI from 'openai'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS || '1536')

/**
 * Generate embeddings for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty')
    }

    // Truncate text to fit within token limits (~8000 tokens)
    const truncatedText = text.slice(0, 32000)

    const response = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncatedText,
      dimensions: EMBEDDING_DIMENSIONS,
    })

    return response.data[0].embedding
  } catch (error) {
    logger.error('Failed to generate embedding', { error, textLength: text.length })
    throw new Error('Failed to generate embedding')
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  try {
    if (texts.length === 0) {
      return []
    }

    // OpenAI allows up to 2048 inputs per batch
    const MAX_BATCH_SIZE = 100
    const batches: number[][][] = []

    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE)
      const truncatedBatch = batch.map(t => t.slice(0, 32000))

      const response = await getOpenAI().embeddings.create({
        model: EMBEDDING_MODEL,
        input: truncatedBatch,
        dimensions: EMBEDDING_DIMENSIONS,
      })

      batches.push(response.data.map(d => d.embedding))
    }

    return batches.flat()
  } catch (error) {
    logger.error('Failed to generate batch embeddings', { error, count: texts.length })
    throw new Error('Failed to generate batch embeddings')
  }
}

/**
 * Generate embeddings for all sections of a resume
 */
export async function generateCVEmbeddings(resumeId: string): Promise<void> {
  try {
    const sections = await prisma.resumeSection.findMany({
      where: { resumeId },
      orderBy: { order: 'asc' }
    })

    if (sections.length === 0) {
      logger.warn('No resume sections found', { resumeId })
      return
    }

    for (const section of sections) {
      // ResumeSection doesn't have a text field, combine title and description
      const sectionText = [section.title, section.description].filter(Boolean).join('\n')

      if (!sectionText || sectionText.trim().length === 0) {
        continue
      }

      try {
        const embedding = await generateEmbedding(sectionText)

        await prisma.resumeSection.update({
          where: { id: section.id },
          // @ts-ignore - embeddingVector is Unsupported type
          data: { embeddingVector: embedding }
        })

        logger.info('Generated embedding for resume section', {
          resumeId,
          sectionId: section.id,
          kind: section.kind
        })
      } catch (error) {
        logger.error('Failed to generate section embedding', {
          error,
          resumeId,
          sectionId: section.id
        })
        // Continue with other sections even if one fails
      }
    }

    logger.info('Completed CV embeddings generation', { resumeId, sectionsProcessed: sections.length })
  } catch (error) {
    logger.error('Failed to generate CV embeddings', { error, resumeId })
    throw new Error('Failed to generate CV embeddings')
  }
}

/**
 * Generate embedding for a job description
 */
export async function generateJobEmbedding(jobId: string): Promise<void> {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        title: true,
        description: true,
        location: true,
      }
    })

    if (!job) {
      throw new Error('Job not found')
    }

    // Combine all job text fields
    const jobText = [
      job.title,
      job.description,
      job.location,
    ].filter(Boolean).join('\n\n')

    if (jobText.trim().length === 0) {
      logger.warn('Job has no text content', { jobId })
      return
    }

    const embedding = await generateEmbedding(jobText)

    await prisma.job.update({
      where: { id: jobId },
      // @ts-ignore - embedding is Unsupported type
      data: { embedding }
    })

    logger.info('Generated job embedding', { jobId })
  } catch (error) {
    logger.error('Failed to generate job embedding', { error, jobId })
    throw new Error('Failed to generate job embedding')
  }
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same dimensions')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
