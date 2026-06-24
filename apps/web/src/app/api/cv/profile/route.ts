/**
 * Personal CV profile API — a job-seeker's own saved CVs ("my profile", Profesia-style).
 *
 *  - GET            → list the signed-in user's saved CVs (id, title, dates, counts).
 *  - GET ?id=<id>   → full structured data of one CV (to render / edit).
 *  - POST           → save the CV builder's data as a new Resume on the personal candidate.
 *  - DELETE ?id=... → soft-delete one of the user's saved CVs.
 *
 * CVs are stored on the user's PERSONAL candidate (sentinel org), so they exist
 * independent of any employer and are never visible to employers.
 */

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withRateLimit } from '@/lib/rate-limit'
import { withCsrfProtection } from '@/lib/csrf'
import { getPersonalCandidateForUser } from '@/lib/identity'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const personSchema = z
  .object({
    fullName: z.string().max(200).optional().default(''),
    email: z.string().max(200).optional().default(''),
    phone: z.string().max(100).optional().default(''),
    location: z.string().max(200).optional().default(''),
    linkedin: z.string().max(400).optional().default(''),
    website: z.string().max(400).optional().default(''),
    photo: z.string().max(2000).optional().default(''),
  })
  .default({})

const cvSchema = z.object({
  personalInfo: personSchema,
  experiences: z
    .array(
      z.object({
        company: z.string().max(300).optional().default(''),
        position: z.string().max(300).optional().default(''),
        period: z.string().max(120).optional().default(''),
        description: z.string().max(5000).optional().default(''),
        current: z.boolean().optional().default(false),
      }),
    )
    .max(50)
    .optional()
    .default([]),
  education: z
    .array(
      z.object({
        school: z.string().max(300).optional().default(''),
        degree: z.string().max(300).optional().default(''),
        field: z.string().max(300).optional().default(''),
        year: z.string().max(50).optional().default(''),
      }),
    )
    .max(50)
    .optional()
    .default([]),
  skills: z
    .array(
      z.object({
        name: z.string().max(150).optional().default(''),
        level: z.string().max(50).optional().default(''),
      }),
    )
    .max(200)
    .optional()
    .default([]),
  interests: z.array(z.string().max(150)).max(100).optional().default([]),
  languages: z
    .array(
      z.object({
        name: z.string().max(150).optional().default(''),
        proficiency: z.string().max(50).optional().default(''),
      }),
    )
    .max(50)
    .optional()
    .default([]),
})

type CvData = z.infer<typeof cvSchema>

// Reconstruct the builder's CVPreviewData shape from a stored Resume row.
function resumeToCvData(r: {
  personalInfo: unknown
  experiences: unknown
  education: unknown
  languages: unknown
  skills: string[]
}): CvData {
  const pi = (r.personalInfo ?? {}) as Record<string, unknown>
  const arr = (v: unknown) => (Array.isArray(v) ? v : [])
  return {
    personalInfo: {
      fullName: String(pi.fullName ?? ''),
      email: String(pi.email ?? ''),
      phone: String(pi.phone ?? ''),
      location: String(pi.location ?? ''),
      linkedin: String(pi.linkedin ?? ''),
      website: String(pi.website ?? ''),
      photo: String(pi.photo ?? ''),
    },
    experiences: arr(r.experiences) as CvData['experiences'],
    education: arr(r.education) as CvData['education'],
    skills: (Array.isArray(pi.skills)
      ? (pi.skills as CvData['skills'])
      : r.skills.map((name) => ({ name, level: '' }))) as CvData['skills'],
    interests: (Array.isArray(pi.interests) ? pi.interests : []) as string[],
    languages: arr(r.languages) as CvData['languages'],
  }
}

function cvTitle(data: CvData): string {
  return (
    data.personalInfo.fullName.trim() ||
    data.experiences.find((e) => e.position)?.position ||
    'Môj životopis'
  )
}

export const GET = withRateLimit(
  async (request: Request) => {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const candidate = await getPersonalCandidateForUser(session.user.id)
    const id = new URL(request.url).searchParams.get('id')

    if (id) {
      const resume = await prisma.resume.findFirst({
        where: { id, candidateId: candidate.id, deletedAt: null },
        select: {
          id: true,
          personalInfo: true,
          experiences: true,
          education: true,
          languages: true,
          skills: true,
          createdAt: true,
        },
      })
      if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({
        id: resume.id,
        createdAt: resume.createdAt,
        data: resumeToCvData(resume),
      })
    }

    const resumes = await prisma.resume.findMany({
      where: { candidateId: candidate.id, deletedAt: null },
      select: {
        id: true,
        personalInfo: true,
        experiences: true,
        education: true,
        skills: true,
        createdAt: true,
        updatedAt: true,
        sourceDocumentId: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })
    const cvs = resumes.map((r) => {
      const pi = (r.personalInfo ?? {}) as Record<string, unknown>
      return {
        id: r.id,
        title: String(pi.fullName ?? '').trim() || 'Môj životopis',
        hasPhoto: Boolean(pi.photo),
        experienceCount: Array.isArray(r.experiences) ? r.experiences.length : 0,
        educationCount: Array.isArray(r.education) ? r.education.length : 0,
        skillCount: r.skills.length,
        fromUpload: Boolean(r.sourceDocumentId),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }
    })
    return NextResponse.json({ cvs })
  },
  { preset: 'api' },
)

export const POST = withCsrfProtection(
  withRateLimit(
    async (request: Request) => {
      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const parsed = cvSchema.safeParse(await request.json())
        if (!parsed.success) {
          return NextResponse.json(
            { error: 'Invalid CV data', details: parsed.error.errors },
            { status: 400 },
          )
        }
        const data = parsed.data

        // Reject an empty CV (nothing worth storing).
        const hasContent =
          data.personalInfo.fullName.trim() ||
          data.experiences.some((e) => e.position || e.company) ||
          data.education.some((e) => e.school || e.degree) ||
          data.skills.some((s) => s.name)
        if (!hasContent) {
          return NextResponse.json(
            { error: 'CV je prázdne — vyplň aspoň meno alebo skúsenosti.' },
            { status: 400 },
          )
        }

        // Only allow https photo URLs (the photo upload returns a Vercel Blob https URL).
        const photo = data.personalInfo.photo.startsWith('https://') ? data.personalInfo.photo : ''

        const candidate = await getPersonalCandidateForUser(session.user.id)
        const resume = await prisma.resume.create({
          data: {
            candidateId: candidate.id,
            language: 'sk',
            summary: null,
            // Full structured CV lives in the Json columns so it round-trips back
            // to the builder/preview; skills[] (names) also feeds matching/search.
            personalInfo: {
              ...data.personalInfo,
              photo,
              interests: data.interests,
              skills: data.skills,
            },
            experiences: data.experiences,
            education: data.education,
            languages: data.languages,
            skills: data.skills.map((s) => s.name).filter(Boolean),
          },
          select: { id: true },
        })
        return NextResponse.json({ id: resume.id, title: cvTitle(data) }, { status: 201 })
      } catch (error) {
        logger.error('Save profile CV error', { error })
        return NextResponse.json({ error: 'Failed to save CV' }, { status: 500 })
      }
    },
    { preset: 'api' },
  ),
)

export const DELETE = withCsrfProtection(
  withRateLimit(
    async (request: Request) => {
      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = new URL(request.url).searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

        const candidate = await getPersonalCandidateForUser(session.user.id)
        // Scope the delete to the user's own personal candidate (ownership check).
        const result = await prisma.resume.updateMany({
          where: { id, candidateId: candidate.id, deletedAt: null },
          data: { deletedAt: new Date() },
        })
        if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return NextResponse.json({ ok: true })
      } catch (error) {
        logger.error('Delete profile CV error', { error })
        return NextResponse.json({ error: 'Failed to delete CV' }, { status: 500 })
      }
    },
    { preset: 'api' },
  ),
)
