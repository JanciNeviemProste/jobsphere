/**
 * Semantic Search Library
 * Vector similarity search for candidates using pgvector
 */

import { prisma } from '@/lib/db'
import { generateEmbedding } from '@/lib/embeddings'
import { logger } from '@/lib/logger'

export interface CandidateMatch {
  candidateId: string
  resumeId: string
  resumeTitle: string
  similarity: number
  matchedSection?: {
    type: string
    content: string
  }
  candidate?: {
    id: string
    orgId: string
    tags: string[]
  }
}

export interface SearchCandidatesParams {
  jobDescription: string
  organizationId?: string
  limit?: number
  minSimilarity?: number
  includeDetails?: boolean
}

/**
 * Search candidates using semantic similarity
 * @param params Search parameters
 * @returns Array of candidate matches sorted by similarity
 */
export async function searchCandidates(
  params: SearchCandidatesParams
): Promise<CandidateMatch[]> {
  const {
    jobDescription,
    organizationId,
    limit = 10,
    minSimilarity = 0.5,
    includeDetails = false
  } = params

  try {
    // 1. Generate embedding for job description
    logger.info('Generating job description embedding')
    const jobEmbedding = await generateEmbedding(jobDescription)

    // 2. Convert embedding to pgvector format
    const embeddingString = `[${jobEmbedding.join(',')}]`

    // 3. Execute vector similarity search using pgvector
    const results = await prisma.$queryRaw<any[]>`
      SELECT
        r.id as "resumeId",
        r.title as "resumeTitle",
        r."candidateId" as "candidateId",
        rs.kind as "sectionType",
        rs.text as "sectionContent",
        1 - (rs."embeddingVector" <=> ${embeddingString}::vector) as similarity
      FROM "ResumeSection" rs
      JOIN "Resume" r ON rs."resumeId" = r.id
      JOIN "Candidate" c ON r."candidateId" = c.id
      WHERE
        rs."embeddingVector" IS NOT NULL
        AND (1 - (rs."embeddingVector" <=> ${embeddingString}::vector)) >= ${minSimilarity}
        ${organizationId ? prisma.$queryRaw`AND c."organizationId" = ${organizationId}` : prisma.$queryRaw``}
      ORDER BY rs."embeddingVector" <=> ${embeddingString}::vector ASC
      LIMIT ${limit}
    `

    // 4. Transform results
    const matches: CandidateMatch[] = results.map(row => ({
      candidateId: row.candidateId,
      resumeId: row.resumeId,
      resumeTitle: row.resumeTitle,
      similarity: parseFloat(row.similarity),
      matchedSection: {
        type: row.sectionType,
        content: row.sectionContent?.slice(0, 200) + '...'
      }
    }))

    // 5. Optionally include candidate details
    if (includeDetails && matches.length > 0) {
      const candidateIds = matches.map(m => m.candidateId)
      const candidates = await prisma.candidate.findMany({
        where: { id: { in: candidateIds } },
        select: {
          id: true,
          orgId: true,
          tags: true
        }
      })

      const candidateMap = new Map(candidates.map(c => [c.id, c]))

      matches.forEach(match => {
        match.candidate = candidateMap.get(match.candidateId)
      })
    }

    logger.info('Candidate search completed', {
      resultsCount: matches.length,
      limit,
      minSimilarity
    })

    return matches
  } catch (error) {
    logger.error('Semantic candidate search failed', { error })
    throw new Error('Failed to search candidates')
  }
}

/**
 * Find similar candidates based on an existing candidate's CV
 * @param candidateId Source candidate ID
 * @param limit Number of similar candidates to return
 * @returns Array of similar candidate matches
 */
export async function findSimilarCandidates(
  candidateId: string,
  limit: number = 5
): Promise<CandidateMatch[]> {
  try {
    const resume = await prisma.resume.findFirst({
      where: { candidateId },
      include: {
        sections: {
          // @ts-ignore - embeddingVector is Unsupported type
          where: { embeddingVector: { not: null } },
          take: 1
        }
      }
    })

    // @ts-expect-error - sections is included but TS doesn't infer it
    if (!resume || !resume.sections || resume.sections.length === 0) {
      logger.warn('No resume with embeddings found', { candidateId })
      return []
    }

    // @ts-ignore - embeddingVector is Unsupported type
    // @ts-expect-error - sections is included
    const sourceEmbedding = resume.sections[0].embeddingVector
    const embeddingString = `[${sourceEmbedding}]`

    const results = await prisma.$queryRaw<any[]>`
      SELECT
        r.id as "resumeId",
        r.title as "resumeTitle",
        r."candidateId" as "candidateId",
        1 - (rs."embeddingVector" <=> ${embeddingString}::vector) as similarity
      FROM "ResumeSection" rs
      JOIN "Resume" r ON rs."resumeId" = r.id
      WHERE
        rs."embeddingVector" IS NOT NULL
        AND r."candidateId" != ${candidateId}
      ORDER BY rs."embeddingVector" <=> ${embeddingString}::vector ASC
      LIMIT ${limit}
    `

    return results.map(row => ({
      candidateId: row.candidateId,
      resumeId: row.resumeId,
      resumeTitle: row.resumeTitle,
      similarity: parseFloat(row.similarity)
    }))
  } catch (error) {
    logger.error('Find similar candidates failed', { error, candidateId })
    throw new Error('Failed to find similar candidates')
  }
}

/**
 * Get match score between a specific job and candidate
 * @param jobId Job ID
 * @param candidateId Candidate ID
 * @returns Match score between 0-1
 */
export async function getJobCandidateMatchScore(
  jobId: string,
  candidateId: string
): Promise<number | null> {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      // @ts-ignore - embedding is Unsupported type
      select: { embedding: true }
    })

    // @ts-ignore - embedding is Unsupported type
    if (!job || !job.embedding) {
      logger.warn('Job has no embedding', { jobId })
      return null
    }

    const resume = await prisma.resume.findFirst({
      where: { candidateId },
      include: {
        sections: {
          where: {
            kind: 'SUMMARY',
            // @ts-ignore - embeddingVector is Unsupported type
            embeddingVector: { not: null }
          },
          take: 1
        }
      }
    })

    // @ts-expect-error - sections is included but TS doesn't infer it
    if (!resume || !resume.sections || resume.sections.length === 0) {
      logger.warn('Candidate has no resume embedding', { candidateId })
      return null
    }

    // @ts-ignore - embedding and embeddingVector are Unsupported types
    const jobEmbeddingString = `[${job.embedding}]`
    // @ts-ignore - embeddingVector is Unsupported type
    // @ts-expect-error - sections is included
    const cvEmbedding = resume.sections[0].embeddingVector
    const cvEmbeddingString = `[${cvEmbedding}]`

    const result = await prisma.$queryRaw<{ similarity: number }[]>`
      SELECT 1 - (${cvEmbeddingString}::vector <=> ${jobEmbeddingString}::vector) as similarity
    `

    return result[0]?.similarity || null
  } catch (error) {
    logger.error('Get match score failed', { error, jobId, candidateId })
    return null
  }
}
