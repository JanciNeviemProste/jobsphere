/**
 * CV Parse API
 * Parses raw text with Claude & saves to database
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { extractCvFromText } from '@jobsphere/ai'
import { addEmbeddingJob } from '@/lib/queue'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limit'
import { getOrCreateCandidateForUser, getPersonalCandidateForUser } from '@/lib/identity'
import { isAllowedCvUrl } from '@/lib/cv-url'

export const runtime = 'nodejs'

export const POST = withRateLimit(
  async (request: Request) => {
    try {
      // 1. Optional authentication - allow anonymous users
      const session = await auth()

      // 2. Get raw text (and optional uploaded-file metadata) from body.
      // The file metadata is produced by /api/cv/upload and forwarded by the
      // client so we can persist the stored file as a CandidateDocument and link
      // it to the created Resume (SEC-001).
      const {
        rawText,
        fileUrl,
        filename,
        mime,
        size,
        hash,
      }: {
        rawText?: string
        fileUrl?: string
        filename?: string
        mime?: string
        size?: number
        hash?: string
      } = await request.json()

      if (!rawText || rawText.length < 20) {
        return NextResponse.json(
          {
            error: `Invalid CV text - too short (${rawText?.length || 0} characters, minimum 20 required)`,
          },
          { status: 400 },
        )
      }

      // SSRF guard (F1): the file reference is later fetched server-side by the CV
      // download route, so reject any client-provided fileUrl that isn't one we
      // produced (Vercel Blob / local uploads). Checked before the costly AI call.
      if (fileUrl && !isAllowedCvUrl(fileUrl)) {
        return NextResponse.json({ error: 'Invalid file reference' }, { status: 400 })
      }

      logger.info('Parsing CV', { textLength: rawText.length })

      // Get locale from accept-language header or default to 'en'
      const acceptLanguage = request.headers.get('accept-language')
      const locale = acceptLanguage?.split(',')[0]?.split('-')[0] || 'en'

      // 4. Parse CV with AI (OpenRouter Gemini Flash or Claude fallback)
      const openRouterKey = process.env.OPENROUTER_API_KEY
      const anthropicKey = process.env.ANTHROPIC_API_KEY

      if (!openRouterKey && !anthropicKey) {
        return NextResponse.json({ error: 'AI service not configured' }, { status: 500 })
      }

      const extractedCV = await extractCvFromText(rawText, {
        openRouterApiKey: openRouterKey,
        apiKey: anthropicKey,
        model: openRouterKey ? 'google/gemini-2.5-flash-lite' : 'claude-opus-4-20250514',
        locale,
      })

      // 5. If user is logged in, save to database
      if (session?.user?.id) {
        // Resolve the Candidate to attach this CV to. Employer-side members get
        // their org candidate; a plain job-seeker (no org membership) gets their
        // PERSONAL candidate so the uploaded CV lands in their own profile
        // instead of failing — the "my CV in my profile" model.
        const userOrg = await prisma.userOrgRole.findFirst({
          where: { userId: session.user.id },
          select: { orgId: true },
        })

        const candidate = userOrg
          ? await getOrCreateCandidateForUser(session.user.id, userOrg.orgId)
          : await getPersonalCandidateForUser(session.user.id)

        // If the upload step provided the stored file reference, persist it as a
        // CandidateDocument so the CV is no longer orphaned and can be served via
        // the authenticated download route (SEC-001).
        let sourceDocumentId: string | undefined
        if (fileUrl && filename && mime && typeof size === 'number') {
          const document = await prisma.candidateDocument.create({
            data: {
              candidateId: candidate.id,
              type: 'CV',
              uri: fileUrl,
              filename,
              mime,
              size,
              hash: hash || null,
              parsedAt: new Date(),
            },
          })
          sourceDocumentId = document.id
        }

        // Create Resume record with basic info from parsed CV, linking the source
        // document when available.
        const resume = await prisma.resume.create({
          data: {
            candidateId: candidate.id,
            sourceDocumentId,
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

        // 7. Queue embedding generation job asynchronously
        if (sections.length > 0) {
          addEmbeddingJob({ resumeId: resume.id }).catch((error) => {
            logger.error('Failed to queue embedding job', error)
            // Don't fail the request if job queueing fails
          })
          logger.info('Queued embedding job for resume', { resumeId: resume.id })
        }

        return NextResponse.json({
          resumeId: resume.id,
          candidateId: candidate.id,
          documentId: sourceDocumentId ?? null,
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
      logger.error('CV parse error', error)
      return NextResponse.json({ error: 'Failed to parse CV' }, { status: 500 })
    }
  },
  { preset: 'upload' }, // 10 requests per 5 minutes
)
