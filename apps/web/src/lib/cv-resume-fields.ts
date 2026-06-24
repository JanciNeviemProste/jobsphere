/**
 * Map the AI `ExtractedCV` into the canonical builder-shaped structured fields the
 * Resume JSON columns store. Mirrors the client `handleCVParsed` mapping
 * (apps/web/src/app/[locale]/create-cv/create-cv-client.tsx) so an uploaded CV is
 * stored in the SAME shape the CV builder produces — the employer applicant detail
 * and the "Moje CV" preview then render uploaded CVs the same as built ones
 * (previously these JSON columns were left empty on upload, so the employer saw no
 * structured experience/education).
 */

export interface ResumeStructuredFields {
  personalInfo: {
    fullName: string
    email: string
    phone: string
    location: string
    linkedin: string
    website: string
    photo: string
    interests: string[]
    skills: { name: string; level: string }[]
  }
  experiences: {
    company: string
    position: string
    period: string
    description: string
    current: boolean
  }[]
  education: { school: string; degree: string; field: string; year: string }[]
  languages: { name: string; proficiency: string }[]
  skills: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractedCvToResumeFields(cv: any): ResumeStructuredFields {
  const fmtPeriod = (s: unknown, e: unknown, current: unknown) => {
    const start = s ? String(s) : ''
    const end = current ? 'Present' : e ? String(e) : ''
    return [start, end].filter(Boolean).join(' - ')
  }
  const skills: string[] = Array.isArray(cv?.skills)
    ? cv.skills.map((x: unknown) => String(x)).filter(Boolean)
    : []
  const personal = cv?.personal ?? {}
  return {
    personalInfo: {
      fullName: personal.fullName ?? '',
      email: personal.email ?? '',
      phone: personal.phone ?? '',
      location: personal.location ?? '',
      linkedin: personal.linkedIn ?? '',
      website: personal.portfolio || personal.github || '',
      photo: '',
      interests: Array.isArray(cv?.interests)
        ? cv.interests.map((x: unknown) => String(x)).filter(Boolean)
        : [],
      skills: skills.map((name) => ({ name, level: 'Pokročilý' })),
    },
    experiences: (Array.isArray(cv?.experiences) ? cv.experiences : []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e: any) => ({
        company: e.company ?? '',
        position: e.title ?? '',
        period: fmtPeriod(e.startDate, e.endDate, e.current),
        description: e.description ?? '',
        current: !!e.current,
      }),
    ),
    education: (Array.isArray(cv?.education) ? cv.education : []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e: any) => ({
        school: e.institution ?? '',
        degree: e.degree ?? '',
        field: e.field ?? '',
        year: e.endDate ? String(e.endDate) : '',
      }),
    ),
    languages: (Array.isArray(cv?.languages) ? cv.languages : []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (l: any) => ({
        name: l.name ?? '',
        proficiency: l.level ?? 'Pokročilý',
      }),
    ),
    skills,
  }
}
