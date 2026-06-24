import { describe, it, expect } from 'vitest'
import { extractedCvToResumeFields } from '../cv-resume-fields'

describe('extractedCvToResumeFields', () => {
  it('maps the AI ExtractedCV into the builder-shaped Resume fields', () => {
    const out = extractedCvToResumeFields({
      personal: {
        fullName: 'Ján Uchádzač',
        email: 'jan@example.com',
        phone: '0900',
        location: 'Žilina',
        linkedIn: 'https://linkedin.com/in/jan',
        portfolio: 'https://jan.dev',
        github: 'https://github.com/jan',
      },
      summary: 'Skúsený vývojár',
      experiences: [
        {
          title: 'Senior Developer',
          company: 'ACME',
          startDate: '2020-01',
          endDate: '2024-03',
          description: 'práca',
          current: false,
        },
        { title: 'Dev', company: 'StartUp', startDate: '2024-04', current: true },
      ],
      education: [{ degree: 'Ing.', institution: 'UNIZA', field: 'Informatika', endDate: '2020' }],
      skills: ['TypeScript', 'React'],
      languages: [{ name: 'Angličtina', level: 'FLUENT' }],
      interests: ['turistika', 'čítanie'],
    })

    // experiences: title→position, startDate/endDate→period, current→"Present"
    expect(out.experiences[0]).toEqual({
      company: 'ACME',
      position: 'Senior Developer',
      period: '2020-01 - 2024-03',
      description: 'práca',
      current: false,
    })
    expect(out.experiences[1].period).toBe('2024-04 - Present')
    expect(out.experiences[1].current).toBe(true)

    // education: institution→school, endDate→year
    expect(out.education[0]).toEqual({
      school: 'UNIZA',
      degree: 'Ing.',
      field: 'Informatika',
      year: '2020',
    })

    // skills String[] for matching + structured skills (with level) in personalInfo
    expect(out.skills).toEqual(['TypeScript', 'React'])
    expect(out.personalInfo.skills).toEqual([
      { name: 'TypeScript', level: 'Pokročilý' },
      { name: 'React', level: 'Pokročilý' },
    ])

    // personalInfo: linkedIn→linkedin, portfolio/github→website, interests carried
    expect(out.personalInfo.fullName).toBe('Ján Uchádzač')
    expect(out.personalInfo.linkedin).toBe('https://linkedin.com/in/jan')
    expect(out.personalInfo.website).toBe('https://jan.dev')
    expect(out.personalInfo.interests).toEqual(['turistika', 'čítanie'])

    // languages: level→proficiency
    expect(out.languages[0]).toEqual({ name: 'Angličtina', proficiency: 'FLUENT' })
  })

  it('is robust to missing/empty fields', () => {
    const out = extractedCvToResumeFields({})
    expect(out.experiences).toEqual([])
    expect(out.education).toEqual([])
    expect(out.languages).toEqual([])
    expect(out.skills).toEqual([])
    expect(out.personalInfo.fullName).toBe('')
    expect(out.personalInfo.skills).toEqual([])
    expect(out.personalInfo.interests).toEqual([])
  })

  it('falls back website to github when no portfolio, and defaults language proficiency', () => {
    const out = extractedCvToResumeFields({
      personal: { github: 'https://github.com/x' },
      languages: [{ name: 'Slovenčina' }],
    })
    expect(out.personalInfo.website).toBe('https://github.com/x')
    expect(out.languages[0].proficiency).toBe('Pokročilý')
  })
})
