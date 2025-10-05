/**
 * CV Parse API
 * Parses raw text with Claude & saves to database
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { prisma } from '@/lib/db'
import { extractCvFromText } from '@jobsphere/ai'

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get raw text from body
    const { rawText } = await request.json()

    if (!rawText || rawText.length < 50) {
      return NextResponse.json(
        { error: 'Invalid CV text - too short' },
        { status: 400 }
      )
    }

    // 3. Find or create Candidate record
    let candidate = await prisma.candidate.findUnique({
      where: { userId: session.user.id },
    })

    if (!candidate) {
      candidate = await prisma.candidate.create({
        data: {
          userId: session.user.id,
          locale: 'sk', // TODO: Get from user preferences
        },
      })
    }

    // 4. Parse CV with Claude
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      )
    }

    const extractedCV = await extractCvFromText(rawText, {
      apiKey,
      model: 'claude-opus-4-20250514',
      locale: candidate.locale,
    })

    // 5. Create Resume record
    const resume = await prisma.resume.create({
      data: {
        candidateId: candidate.id,
        language: candidate.locale,
        rawText,
        parsedData: extractedCV as any, // Store full JSON
        sections: {
          create: [
            // Personal section
            {
              type: 'PERSONAL',
              title: 'Personal Information',
              content: JSON.stringify(extractedCV.personal),
              orderIndex: 0,
            },
            // Summary
            ...(extractedCV.summary
              ? [
                  {
                    type: 'SUMMARY' as const,
                    title: 'Summary',
                    content: extractedCV.summary,
                    orderIndex: 1,
                  },
                ]
              : []),
            // Experience sections
            ...extractedCV.experiences.map((exp, idx) => ({
              type: 'EXPERIENCE' as const,
              title: exp.title,
              content: JSON.stringify(exp),
              orderIndex: 2 + idx,
            })),
            // Education sections
            ...extractedCV.education.map((edu, idx) => ({
              type: 'EDUCATION' as const,
              title: edu.degree,
              content: JSON.stringify(edu),
              orderIndex: 2 + extractedCV.experiences.length + idx,
            })),
            // Skills
            {
              type: 'SKILLS' as const,
              title: 'Skills',
              content: JSON.stringify(extractedCV.skills),
              orderIndex:
                2 +
                extractedCV.experiences.length +
                extractedCV.education.length,
            },
          ],
        },
      },
    })

    // 6. Generate embeddings for sections (async - don't wait)
    // TODO: Implement background job to generate embeddings

    return NextResponse.json({
      cvId: resume.id,
      candidateId: candidate.id,
      success: true,
    })

  } catch (error) {
    console.error('CV parse error:', error)
    return NextResponse.json(
      { error: 'Failed to parse CV' },
      { status: 500 }
    )
  }
}
