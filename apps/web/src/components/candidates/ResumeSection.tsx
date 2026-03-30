'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Briefcase, GraduationCap, Code, User } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ResumeSection {
  id: string
  kind: string
  text: string | null
  title: string | null
  organization: string | null
  order: number
}

interface Resume {
  id: string
  sections: ResumeSection[]
  skills: string[] | null
}

interface ResumeSectionProps {
  resume: Resume | null
}

export function ResumeSection({ resume }: ResumeSectionProps) {
  const t = useTranslations('resume')

  if (!resume) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p>{t('noResume')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getSectionIcon = (kind: string) => {
    switch (kind.toUpperCase()) {
      case 'SUMMARY':
      case 'OBJECTIVE':
        return <User className="h-5 w-5" />
      case 'EXPERIENCE':
      case 'WORK_EXPERIENCE':
        return <Briefcase className="h-5 w-5" />
      case 'EDUCATION':
        return <GraduationCap className="h-5 w-5" />
      case 'SKILLS':
      case 'TECHNICAL_SKILLS':
        return <Code className="h-5 w-5" />
      default:
        return <FileText className="h-5 w-5" />
    }
  }

  const getSectionTitle = (kind: string) => {
    switch (kind.toUpperCase()) {
      case 'SUMMARY':
        return t('professionalSummary')
      case 'OBJECTIVE':
        return t('careerObjective')
      case 'EXPERIENCE':
      case 'WORK_EXPERIENCE':
        return t('workExperience')
      case 'EDUCATION':
        return t('education')
      case 'SKILLS':
      case 'TECHNICAL_SKILLS':
        return t('skills')
      case 'CERTIFICATIONS':
        return t('certifications')
      case 'PROJECTS':
        return t('projects')
      case 'AWARDS':
        return t('awards')
      default:
        return kind.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    }
  }

  // Sort sections by order
  const sortedSections = [...resume.sections].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <FileText className="h-6 w-6 text-primary" />
          {t('details')}
        </h2>
      </div>

      {/* Skills (if available) */}
      {resume.skills && resume.skills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Code className="h-5 w-5 text-primary" />
              {t('skills')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {resume.skills.map((skill, idx) => (
                <Badge key={idx} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resume Sections */}
      {sortedSections.length > 0 ? (
        sortedSections.map((section) => (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {getSectionIcon(section.kind)}
                {getSectionTitle(section.kind)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {section.title && <h3 className="mb-2 text-base font-semibold">{section.title}</h3>}
              {section.organization && (
                <p className="mb-2 text-sm text-muted-foreground">{section.organization}</p>
              )}
              {section.text && (
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {section.text}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <p>{t('noSections')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
