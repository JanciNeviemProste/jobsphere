import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import * as pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import Tesseract from 'tesseract.js'

// Initialize Anthropic Claude
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Types
export const ExtractedCVSchema = z.object({
  personal: z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    summary: z.string().optional(),
  }).optional(),
  experiences: z.array(z.object({
    title: z.string(),
    company: z.string(),
    location: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    current: z.boolean().default(false),
    description: z.string().optional(),
    achievements: z.array(z.string()).default([]),
  })).default([]),
  education: z.array(z.object({
    degree: z.string(),
    field: z.string().optional(),
    institution: z.string(),
    location: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    gpa: z.string().optional(),
  })).default([]),
  skills: z.array(z.string()).default([]),
  languages: z.array(z.object({
    language: z.string(),
    proficiency: z.string(),
  })).default([]),
  certifications: z.array(z.object({
    name: z.string(),
    issuer: z.string().optional(),
    date: z.string().optional(),
    expiry: z.string().optional(),
  })).default([]),
  projects: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    technologies: z.array(z.string()).default([]),
    url: z.string().optional(),
  })).default([]),
})

export type ExtractedCV = z.infer<typeof ExtractedCVSchema>

// Extract text from PDF with OCR fallback
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer)
    if (data.text && data.text.trim().length > 100) {
      return data.text
    }
    // Fallback to OCR if text extraction fails
    return await performOCR(buffer)
  } catch (error) {
    console.error('PDF extraction error:', error)
    return await performOCR(buffer)
  }
}

// Extract text from DOCX
export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch (error) {
    console.error('DOCX extraction error:', error)
    throw new Error('Failed to extract text from DOCX')
  }
}

// Perform OCR on scanned documents
async function performOCR(buffer: Buffer): Promise<string> {
  try {
    const worker = await Tesseract.createWorker()
    await worker.loadLanguage('eng')
    await worker.initialize('eng')

    const { data: { text } } = await worker.recognize(buffer)
    await worker.terminate()

    return text
  } catch (error) {
    console.error('OCR error:', error)
    throw new Error('Failed to perform OCR')
  }
}

// Extract structured CV data using Claude Opus 4.1
export async function extractCV(
  rawText: string,
  localeHint: string = 'en'
): Promise<ExtractedCV> {
  const prompt = `
    You are an expert CV/resume parser. Extract structured information from the following CV text.
    The CV might be in ${localeHint} language.

    CV Text:
    ${rawText}

    Extract and return a JSON object with the following structure:
    {
      "personal": {
        "name": "full name",
        "email": "email address",
        "phone": "phone number",
        "location": "city, country",
        "summary": "professional summary"
      },
      "experiences": [
        {
          "title": "job title",
          "company": "company name",
          "location": "location",
          "startDate": "YYYY-MM",
          "endDate": "YYYY-MM or null if current",
          "current": boolean,
          "description": "role description",
          "achievements": ["achievement 1", "achievement 2"]
        }
      ],
      "education": [
        {
          "degree": "degree type",
          "field": "field of study",
          "institution": "school/university",
          "location": "location",
          "startDate": "YYYY-MM",
          "endDate": "YYYY-MM",
          "gpa": "GPA if mentioned"
        }
      ],
      "skills": ["skill1", "skill2"],
      "languages": [
        {
          "language": "language name",
          "proficiency": "proficiency level"
        }
      ],
      "certifications": [
        {
          "name": "certification name",
          "issuer": "issuing organization",
          "date": "issue date",
          "expiry": "expiry date if applicable"
        }
      ],
      "projects": [
        {
          "name": "project name",
          "description": "description",
          "technologies": ["tech1", "tech2"],
          "url": "project URL if available"
        }
      ]
    }

    Return only valid JSON, no additional text.
  `

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 4000,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return ExtractedCVSchema.parse(parsed)
      }
    }

    throw new Error('Failed to extract valid JSON from response')
  } catch (error) {
    console.error('CV extraction error:', error)
    throw new Error('Failed to extract CV data')
  }
}

// Generate job description using Claude
export async function generateJobDescription(
  input: {
    title: string
    company: string
    location: string
    requirements?: string[]
    responsibilities?: string[]
    skills?: string[]
  },
  locale: string = 'en'
): Promise<string> {
  const prompt = `
    Generate a comprehensive job description in ${locale} language for:

    Title: ${input.title}
    Company: ${input.company}
    Location: ${input.location}
    ${input.requirements ? `Key Requirements: ${input.requirements.join(', ')}` : ''}
    ${input.responsibilities ? `Key Responsibilities: ${input.responsibilities.join(', ')}` : ''}
    ${input.skills ? `Required Skills: ${input.skills.join(', ')}` : ''}

    Create a professional, engaging job description that includes:
    1. Role overview
    2. Key responsibilities
    3. Required qualifications
    4. Nice-to-have skills
    5. What we offer

    Format it in clean markdown.
  `

  const response = await anthropic.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 2000,
    temperature: 0.7,
    messages: [{
      role: 'user',
      content: prompt
    }]
  })

  const content = response.content[0]
  return content.type === 'text' ? content.text : ''
}

// Compute match percentage between job and resume
export async function computeMatchPercent(
  job: {
    title: string
    description: string
    requirements: string
    skills?: string[]
  },
  resumeText: string,
  locale: string = 'en'
): Promise<{ percent: number; evidence: any }> {
  const prompt = `
    Analyze the match between this job and candidate resume.

    Job Title: ${job.title}
    Job Description: ${job.description}
    Requirements: ${job.requirements}
    ${job.skills ? `Required Skills: ${job.skills.join(', ')}` : ''}

    Resume:
    ${resumeText}

    Evaluate the match based on:
    1. Skills match (40% weight)
    2. Experience relevance (30% weight)
    3. Education fit (15% weight)
    4. Location/availability (15% weight)

    Return a JSON object with:
    {
      "score": number between 0-100,
      "breakdown": {
        "skills": number,
        "experience": number,
        "education": number,
        "location": number
      },
      "matchedSkills": ["skill1", "skill2"],
      "missingSkills": ["skill1", "skill2"],
      "strengths": ["strength1", "strength2"],
      "gaps": ["gap1", "gap2"],
      "recommendation": "hire/maybe/no"
    }
  `

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 2000,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        return {
          percent: Math.min(100, Math.max(0, Math.round(result.score))),
          evidence: result
        }
      }
    }

    return { percent: 0, evidence: {} }
  } catch (error) {
    console.error('Match computation error:', error)
    return { percent: 0, evidence: { error: 'Failed to compute match' } }
  }
}

// Summarize CV into bullet points
export async function summarizeCV(cv: ExtractedCV, locale: string = 'en'): Promise<string[]> {
  const prompt = `
    Summarize this CV into 3-5 key bullet points in ${locale} language:
    ${JSON.stringify(cv, null, 2)}

    Focus on:
    - Most relevant experience
    - Key skills
    - Notable achievements
    - Education highlights

    Return only the bullet points, one per line, starting with "•"
  `

  const response = await anthropic.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 500,
    temperature: 0.3,
    messages: [{
      role: 'user',
      content: prompt
    }]
  })

  const content = response.content[0]
  if (content.type === 'text') {
    return content.text.split('\n').filter(line => line.trim().startsWith('•'))
  }

  return []
}

// Anonymize CV by removing PII
export async function anonymizeCV(cv: ExtractedCV): Promise<ExtractedCV> {
  const anonymized = { ...cv }

  if (anonymized.personal) {
    anonymized.personal = {
      ...anonymized.personal,
      name: '[REDACTED]',
      email: '[REDACTED]',
      phone: '[REDACTED]',
      location: anonymized.personal.location?.split(',')[1]?.trim() || '[REDACTED]'
    }
  }

  // Remove company names but keep industries
  anonymized.experiences = anonymized.experiences.map(exp => ({
    ...exp,
    company: '[Company in ' + guessIndustry(exp.company) + ']'
  }))

  // Redact institution names
  anonymized.education = anonymized.education.map(edu => ({
    ...edu,
    institution: '[University]'
  }))

  return anonymized
}

// Helper to guess industry from company name
function guessIndustry(company: string): string {
  const lower = company.toLowerCase()
  if (lower.includes('tech') || lower.includes('software')) return 'Technology'
  if (lower.includes('bank') || lower.includes('finance')) return 'Finance'
  if (lower.includes('health') || lower.includes('medical')) return 'Healthcare'
  if (lower.includes('retail') || lower.includes('shop')) return 'Retail'
  return 'Industry'
}

// Grade assessment answer using Claude
export async function gradeAssessmentAnswer(
  question: string,
  answer: string,
  rubric?: any,
  maxPoints: number = 10
): Promise<{ score: number; rationale: string }> {
  const prompt = `
    Grade this assessment answer:

    Question: ${question}
    Answer: ${answer}
    ${rubric ? `Grading Rubric: ${JSON.stringify(rubric)}` : ''}
    Maximum Points: ${maxPoints}

    Evaluate based on:
    1. Correctness and accuracy
    2. Completeness of the answer
    3. Clarity and structure
    4. Use of examples where relevant

    Return JSON:
    {
      "score": number (0 to ${maxPoints}),
      "rationale": "explanation of the grade"
    }
  `

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 500,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    }

    return { score: 0, rationale: 'Failed to grade answer' }
  } catch (error) {
    console.error('Grading error:', error)
    return { score: 0, rationale: 'Error during grading' }
  }
}

// Generate embeddings for semantic search
export async function generateEmbeddings(text: string): Promise<number[]> {
  // This would integrate with a multilingual embedding model
  // For now, returning a placeholder
  // In production, use: @xenova/transformers with multilingual-e5-base

  // Placeholder: generate random embeddings for demo
  return Array.from({ length: 768 }, () => Math.random())
}

// Explain match in human-readable format
export function explainMatch(evidence: any, locale: string = 'en'): string[] {
  const explanations: string[] = []

  if (evidence.matchedSkills?.length > 0) {
    explanations.push(`Matched skills: ${evidence.matchedSkills.join(', ')}`)
  }

  if (evidence.strengths?.length > 0) {
    explanations.push(...evidence.strengths)
  }

  if (evidence.recommendation === 'hire') {
    explanations.push('Strong candidate - recommend for interview')
  } else if (evidence.recommendation === 'maybe') {
    explanations.push('Potential fit - worth considering')
  }

  if (evidence.gaps?.length > 0) {
    explanations.push(`Areas for development: ${evidence.gaps.join(', ')}`)
  }

  return explanations
}