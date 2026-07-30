import { useTranslations } from 'next-intl'
import { Mail, Phone, MapPin, Briefcase } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MatchScoreOverride } from '@/components/employer/match-score-override'

interface CandidateContact {
  fullName?: string | null
  email?: string | null
  phone?: string | null
  location?: string | null
  city?: string | null
  country?: string | null
}

interface Resume {
  skills: string[]
  yearsOfExperience?: number | null
  summary?: string | null
}

interface MatchScoreData {
  score0to100: number
  overrideScore?: number | null
}

interface Props {
  contact: CandidateContact | null
  resume: Resume | null
  matchScore: MatchScoreData | null
  // When provided, the score becomes HR-editable (override endpoint).
  applicationId?: string
}

function ScoreBadge({ score }: { score: number }) {
  const t = useTranslations('employer.summaryCard')
  let colorClass = 'bg-red-100 text-red-800'
  if (score >= 80) colorClass = 'bg-green-100 text-green-800'
  else if (score >= 60) colorClass = 'bg-amber-100 text-amber-800'

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${colorClass}`}
    >
      {t('matchBadge', { score })}
    </span>
  )
}

export function ApplicantSummaryCard({ contact, resume, matchScore, applicationId }: Props) {
  const t = useTranslations('employer.summaryCard')
  const displayName = contact?.fullName ?? contact?.email ?? t('candidateFallback')
  const location = contact?.city ?? contact?.location ?? null
  const topSkills = resume?.skills?.slice(0, 5) ?? []

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-3">
            <h2 className="text-2xl font-bold">{displayName}</h2>

            <div className="flex flex-wrap gap-3 text-sm">
              {contact?.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Mail className="h-4 w-4" />
                  {contact.email}
                </a>
              )}
              {contact?.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-1.5 hover:underline"
                >
                  <Phone className="h-4 w-4" />
                  {contact.phone}
                </a>
              )}
              {location && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {location}
                </span>
              )}
              {resume?.yearsOfExperience != null && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  {t('experience', { years: resume.yearsOfExperience })}
                </span>
              )}
            </div>

            {topSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {topSkills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0">
            {matchScore != null ? (
              applicationId ? (
                <MatchScoreOverride
                  applicationId={applicationId}
                  score0to100={matchScore.score0to100}
                  overrideScore={matchScore.overrideScore ?? null}
                />
              ) : (
                <ScoreBadge score={matchScore.overrideScore ?? matchScore.score0to100} />
              )
            ) : (
              <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                {t('noMatchScore')}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
