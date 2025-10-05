/**
 * @jobsphere/ai
 * AI & Matching Package
 */

// CV Parsing
export {
  extractCvFromText,
  summarizeCv,
  anonymizeCv,
  generateJobDescription,
} from './cv-parser'

// Embeddings
export {
  VoyageEmbeddings,
  OpenAIEmbeddings,
  CohereEmbeddings,
  createEmbeddingProvider,
  embedCvSection,
  embedCvBatch,
} from './embeddings'

// Match Score
export {
  calculateMatchScore,
  matchCandidatesToJob,
  type JobRequirements,
} from './match-score'

// Types
export type {
  ExtractedCV,
  Experience,
  Education,
  Language,
  Certification,
  Project,
  MatchScore,
  MatchEvidence,
  EmbeddingProvider,
  AIConfig,
} from './types'