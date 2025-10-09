/**
 * CV Parser using OpenRouter (Gemini Flash - FREE) or Claude Opus 4
 * Extrahuje štruktúrované dáta z CV (PDF/DOCX/text)
 */

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { ExtractedCV } from './types'

const CV_EXTRACTION_PROMPT = `You are an expert CV/Resume parser. Extract structured information from the following CV text.

Return ONLY valid JSON in this exact format:
{
  "personal": {
    "fullName": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedIn": "string",
    "github": "string",
    "portfolio": "string"
  },
  "summary": "string - professional summary or objective",
  "experiences": [
    {
      "title": "string",
      "company": "string",
      "location": "string",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or 'present'",
      "current": boolean,
      "description": "string",
      "achievements": ["string"],
      "skills": ["string"]
    }
  ],
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "location": "string",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM",
      "gpa": "string",
      "description": "string"
    }
  ],
  "skills": ["string - technical and soft skills"],
  "languages": [
    {
      "name": "string",
      "level": "BASIC|CONVERSATIONAL|FLUENT|NATIVE"
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string",
      "date": "YYYY-MM",
      "credentialId": "string",
      "url": "string"
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "technologies": ["string"],
      "url": "string",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM"
    }
  ]
}

Important:
- Extract ALL information present in the CV
- Use null for missing fields
- Normalize dates to YYYY-MM format
- Extract skills from experience descriptions
- Be thorough and accurate
- Return ONLY the JSON, no explanation`

export async function extractCvFromText(
  rawText: string,
  config: {
    apiKey?: string
    openRouterApiKey?: string
    model?: string
    locale?: string
  }
): Promise<ExtractedCV> {
  // Try OpenRouter first (FREE Gemini Flash)
  if (config.openRouterApiKey) {
    try {
      return await extractWithOpenRouter(rawText, config)
    } catch (error) {
      console.warn('OpenRouter failed, falling back to Anthropic:', error)
      // Fall through to Anthropic
    }
  }

  // Fallback to Anthropic Claude
  if (!config.apiKey) {
    throw new Error('No API key provided (OpenRouter or Anthropic)')
  }

  return await extractWithAnthropic(rawText, config)
}

// OpenRouter implementation (FREE Gemini Flash)
async function extractWithOpenRouter(
  rawText: string,
  config: { openRouterApiKey?: string; model?: string; locale?: string }
): Promise<ExtractedCV> {
  const openai = new OpenAI({
    apiKey: config.openRouterApiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  })

  const response = await openai.chat.completions.create({
    model: config.model || 'google/gemini-flash-1.5-8b', // FREE model
    messages: [
      {
        role: 'system',
        content: 'You are a precise CV parser. You MUST respond with valid JSON only. Do not include any text before or after the JSON object.',
      },
      {
        role: 'user',
        content: `${CV_EXTRACTION_PROMPT}\n\nCV Text (Language: ${config.locale || 'en'}):\n\n${rawText}`,
      },
    ],
    max_tokens: 4096,
    temperature: 0.1,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from OpenRouter')
  }

  try {
    // Clean up response (remove markdown code blocks if present)
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const extracted = JSON.parse(cleanedContent) as ExtractedCV
    return extracted
  } catch (error) {
    console.error('OpenRouter parsing error:', error)
    console.error('Raw content:', content)
    throw new Error(`Failed to parse CV JSON from OpenRouter: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Anthropic Claude implementation (fallback)
async function extractWithAnthropic(
  rawText: string,
  config: { apiKey?: string; model?: string; locale?: string }
): Promise<ExtractedCV> {
  if (!config.apiKey) {
    throw new Error('Anthropic API key required')
  }

  const anthropic = new Anthropic({ apiKey: config.apiKey })

  const message = await anthropic.messages.create({
    model: config.model || 'claude-opus-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `${CV_EXTRACTION_PROMPT}\n\nCV Text (Language: ${config.locale || 'en'}):\n\n${rawText}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  try {
    const extracted = JSON.parse(content.text) as ExtractedCV
    return extracted
  } catch (error) {
    throw new Error(`Failed to parse CV JSON: ${error}`)
  }
}

/**
 * Summarizuje CV do 3-5 bulletov
 */
export async function summarizeCv(
  cv: ExtractedCV,
  config: { apiKey: string; locale?: string }
): Promise<string[]> {
  const anthropic = new Anthropic({ apiKey: config.apiKey })

  const cvText = JSON.stringify(cv, null, 2)

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514', // Rýchlejší model
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Summarize this CV in 3-5 concise bullet points highlighting key qualifications, experience, and skills. Language: ${config.locale || 'en'}

CV:
${cvText}

Return ONLY a JSON array of strings: ["bullet 1", "bullet 2", ...]`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response')
  }

  return JSON.parse(content.text)
}

/**
 * Anonymizuje CV (odstráni PII)
 */
export function anonymizeCv(cv: ExtractedCV): ExtractedCV {
  return {
    ...cv,
    personal: {
      fullName: 'REDACTED',
      email: 'REDACTED',
      phone: 'REDACTED',
      location: cv.personal?.location, // Location môže zostať
      linkedIn: undefined,
      github: undefined,
      portfolio: undefined,
    },
    experiences: cv.experiences.map((exp) => ({
      ...exp,
      company: exp.company, // Firma môže zostať
      location: exp.location,
    })),
    education: cv.education.map((edu) => ({
      ...edu,
      institution: edu.institution, // Škola môže zostať
      location: edu.location,
    })),
  }
}

/**
 * Generuje Job Description pomocou AI
 */
export async function generateJobDescription(
  input: {
    title: string
    department?: string
    seniority?: string
    requiredSkills?: string[]
    niceToHaveSkills?: string[]
    responsibilities?: string[]
  },
  config: { apiKey: string; locale?: string }
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: config.apiKey })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Generate a professional job description in ${config.locale || 'en'} for:

Title: ${input.title}
Department: ${input.department || 'N/A'}
Seniority: ${input.seniority || 'N/A'}
Required Skills: ${input.requiredSkills?.join(', ') || 'N/A'}
Nice-to-have Skills: ${input.niceToHaveSkills?.join(', ') || 'N/A'}
Key Responsibilities: ${input.responsibilities?.join(', ') || 'N/A'}

Create a compelling job description with:
- Brief company/role introduction
- Key responsibilities (3-5 bullets)
- Required qualifications (3-5 bullets)
- Nice-to-have qualifications (2-3 bullets)
- What we offer (2-3 bullets)

Return ONLY the job description text, no title or headers.`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response')
  }

  return content.text
}
