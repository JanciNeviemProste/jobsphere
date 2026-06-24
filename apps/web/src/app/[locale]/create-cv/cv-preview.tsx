'use client'

/**
 * Printable CV preview rendered from the builder's form state.
 * Used both for the on-screen "Náhľad" modal and the hidden #cv-print container
 * that `window.print()` turns into a PDF.
 */

export interface CVPreviewData {
  personalInfo: {
    fullName: string
    email: string
    phone: string
    location: string
    linkedin: string
    website: string
    photo: string
  }
  experiences: {
    company: string
    position: string
    period: string
    description: string
    current: boolean
  }[]
  education: { school: string; degree: string; field: string; year: string }[]
  skills: { name: string; level: string }[]
  interests: string[]
  languages: { name: string; proficiency: string }[]
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 border-b-2 border-gray-800 pb-1 text-lg font-bold uppercase tracking-wide text-gray-900">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function CVPreview({ data }: { data: CVPreviewData }) {
  const p = data.personalInfo
  const contact = [p.email, p.phone, p.location, p.linkedin, p.website].filter(Boolean)
  const filledExp = data.experiences.filter((e) => e.position || e.company)
  const filledEdu = data.education.filter((e) => e.school || e.degree)
  const filledSkills = data.skills.filter((s) => s.name)
  const filledInterests = data.interests.filter(Boolean)
  const filledLangs = data.languages.filter((l) => l.name)

  return (
    <div className="mx-auto max-w-[800px] bg-white p-10 text-[13px] leading-relaxed text-gray-800">
      {/* Header */}
      <header className="flex items-center gap-6 border-b-4 border-gray-800 pb-5">
        {p.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.photo}
            alt={p.fullName || 'Foto'}
            className="h-28 w-28 flex-shrink-0 rounded-full border object-cover"
          />
        )}
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            {p.fullName || 'Tvoje meno'}
          </h1>
          {filledExp[0]?.position && (
            <p className="mt-1 text-lg text-gray-600">{filledExp[0].position}</p>
          )}
          {contact.length > 0 && (
            <p className="mt-2 break-words text-[12px] text-gray-600">{contact.join('  ·  ')}</p>
          )}
        </div>
      </header>

      {filledExp.length > 0 && (
        <Section title="Pracovné skúsenosti">
          <div className="space-y-4">
            {filledExp.map((exp, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-semibold text-gray-900">
                    {exp.position}
                    {exp.company ? ` — ${exp.company}` : ''}
                  </p>
                  {exp.period && (
                    <p className="whitespace-nowrap text-[12px] text-gray-500">{exp.period}</p>
                  )}
                </div>
                {exp.description && (
                  <p className="mt-1 whitespace-pre-line text-gray-700">{exp.description}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {filledEdu.length > 0 && (
        <Section title="Vzdelanie">
          <div className="space-y-3">
            {filledEdu.map((edu, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4">
                <p className="text-gray-900">
                  <span className="font-semibold">{edu.degree || edu.school}</span>
                  {edu.degree && edu.school ? ` — ${edu.school}` : ''}
                  {edu.field ? `, ${edu.field}` : ''}
                </p>
                {edu.year && (
                  <p className="whitespace-nowrap text-[12px] text-gray-500">{edu.year}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {filledSkills.length > 0 && (
        <Section title="Zručnosti">
          <div className="flex flex-wrap gap-2">
            {filledSkills.map((s, i) => (
              <span key={i} className="rounded border border-gray-300 px-2 py-0.5 text-[12px]">
                {s.name}
              </span>
            ))}
          </div>
        </Section>
      )}

      {filledInterests.length > 0 && (
        <Section title="Záujmy">
          <p className="text-gray-700">{filledInterests.join(' · ')}</p>
        </Section>
      )}

      {filledLangs.length > 0 && (
        <Section title="Jazyky">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {filledLangs.map((l, i) => (
              <p key={i} className="text-gray-700">
                <span className="font-medium text-gray-900">{l.name}</span>
                {l.proficiency ? ` — ${l.proficiency}` : ''}
              </p>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
