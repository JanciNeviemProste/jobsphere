/**
 * CV Parse API
 * Parses raw text with Claude & saves to database
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { extractCvFromText } from '@jobsphere/ai'
import { generateCVEmbeddings } from '@/lib/embeddings'

export async function POST(request: NextRequest) {
  try {
    // 1. Optional authentication - allow anonymous users
    const session = await auth()

    // 2. Get raw text from body
    const { rawText } = await request.json()

    if (!rawText || rawText.length < 20) {
      return NextResponse.json(
        { error: `Invalid CV text - too short (${rawText?.length || 0} characters, minimum 20 required)` },
        { status: 400 }
      )
    }

    console.log(`Parsing CV with ${rawText.length} characters`)

    // Get locale from accept-language header or default to 'en'
    const acceptLanguage = request.headers.get('accept-language')
    const locale = acceptLanguage?.split(',')[0]?.split('-')[0] || 'en'

    // 4. Parse CV with AI (OpenRouter Gemini Flash or Claude fallback)
    const openRouterKey = process.env.OPENROUTER_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY

    if (!openRouterKey && !anthropicKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      )
    }

    const extractedCV = await extractCvFromText(rawText, {
      openRouterApiKey: openRouterKey,
      apiKey: anthropicKey,
      model: openRouterKey ? 'google/gemini-flash-1.5-8b' : 'claude-opus-4-20250514',
      locale,
    })

    // 5. If user is logged in, save to database
    if (session?.user?.id) {
      // Find or create Candidate record
      let candidate = await prisma.candidate.findFirst({
        where: { userId: session.user.id },
      })

      if (!candidate) {
        candidate = await prisma.candidate.create({
          data: {
            userId: session.user.id,
            locale,
          },
        })
      }

      // Create Resume record with basic info from parsed CV
      const resume = await prisma.resume.create({
        data: {
          candidateId: candidate.id,
          language: locale,
          summary: extractedCV.summary || null,
        },
      })

      // 6. Create ResumeSection records from extractedCV
      const sections = []

      if (extractedCV.summary) {
        sections.push({
          resumeId: resume.id,
          kind: 'SUMMARY',
          text: extractedCV.summary,
          order: 1,
        })
      }

      if (extractedCV.experiences && Array.isArray(extractedCV.experiences)) {
        const experienceText = extractedCV.experiences
          .map((exp: any) => {
            const parts = []
            if (exp.title) parts.push(exp.title)
            if (exp.company) parts.push(exp.company)
            if (exp.period) parts.push(exp.period)
            if (exp.description) parts.push(exp.description)
            return parts.join(' | ')
          })
          .join('\n\n')

        if (experienceText) {
          sections.push({
            resumeId: resume.id,
            kind: 'EXPERIENCE',
            text: experienceText,
            order: 2,
          })
        }
      }

      if (extractedCV.education && Array.isArray(extractedCV.education)) {
        const educationText = extractedCV.education
          .map((edu: any) => {
            const parts = []
            if (edu.degree) parts.push(edu.degree)
            if (edu.institution) parts.push(edu.institution)
            if (edu.year) parts.push(edu.year)
            if (edu.field) parts.push(edu.field)
            return parts.join(' | ')
          })
          .join('\n\n')

        if (educationText) {
          sections.push({
            resumeId: resume.id,
            kind: 'EDUCATION',
            text: educationText,
            order: 3,
          })
        }
      }

      if (extractedCV.skills && Array.isArray(extractedCV.skills)) {
        const skillsText = extractedCV.skills.join(', ')

        if (skillsText) {
          sections.push({
            resumeId: resume.id,
            kind: 'SKILLS',
            text: skillsText,
            order: 4,
          })
        }
      }

      // Bulk create sections
      if (sections.length > 0) {
        await prisma.resumeSection.createMany({
          data: sections,
        })
      }

      // 7. Generate embeddings asynchronously (don't wait for completion)
      if (sections.length > 0) {
        generateCVEmbeddings(resume.id).catch((error) => {
          console.error('Failed to generate embeddings:', error)
          // Don't fail the request if embedding generation fails
        })
      }

      return NextResponse.json({
        resumeId: resume.id,
        candidateId: candidate.id,
        success: true,
        parsed: extractedCV,
        sectionsCreated: sections.length,
      })
    }

    // 6. For anonymous users, just return parsed data (don't save to DB)
    return NextResponse.json({
      success: true,
      parsed: extractedCV,
      anonymous: true,
    })

  } catch (error) {
    console.error('CV parse error:', error)
    return NextResponse.json(
      { error: 'Failed to parse CV' },
      { status: 500 }
    )
  }
}
