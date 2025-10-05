/**
 * AI Types & Interfaces
 */

export interface ExtractedCV {
  personal?: {
    fullName?: string
    email?: string
    phone?: string
    location?: string
    linkedIn?: string
    github?: string
    portfolio?: string
  }
  summary?: string
  experiences: Experience[]
  education: Education[]
  skills: string[]
  languages?: Language[]
  certifications?: Certification[]
  projects?: Project[]
}

export interface Experience {
  title: string
  company: string
  location?: string
  startDate?: Date | string
  endDate?: Date | string
  current?: boolean
  description?: string
  achievements?: string[]
  skills?: string[]
}

export interface Education {
  degree: string
  institution: string
  location?: string
  startDate?: Date | string
  endDate?: Date | string
  gpa?: string
  description?: string
}

export interface Language {
  name: string
  level: 'BASIC' | 'CONVERSATIONAL' | 'FLUENT' | 'NATIVE'
}

export interface Certification {
  name: string
  issuer: string
  date?: Date | string
  credentialId?: string
  url?: string
}

export interface Project {
  name: string
  description?: string
  technologies?: string[]
  url?: string
  startDate?: Date | string
  endDate?: Date | string
}

export interface MatchScore {
  score0to100: number
  bm25Score?: number
  vectorScore?: number
  llmScore?: number
  evidence: MatchEvidence
  version: string
}

export interface MatchEvidence {
  matchingSkills: string[]
  missingSkills: string[]
  relevantExperience: string[]
  educationMatch: boolean
  locationMatch: boolean
  salaryMatch: boolean
  yearsOfExperience?: number
  reasoning: string
}

export interface EmbeddingProvider {
  name: string
  embed(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
}

export interface AIConfig {
  anthropicApiKey: string
  model: string
  embeddingsProvider: EmbeddingProvider
  locale?: string
}
