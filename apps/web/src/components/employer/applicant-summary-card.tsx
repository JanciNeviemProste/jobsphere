import { Mail, Phone, MapPin, Briefcase } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
}

interface Props {
  contact: CandidateContact | null
  resume: Resume | null
  matchScore: MatchScoreData | null
}

function ScoreBadge({ score }: { score: number }) {
  let colorClass = 'bg-red-100 text-red-800'
  if (score >= 80) colorClass = 'bg-green-100 text-green-800'
  else if (score >= 60) colorClass = 'bg-amber-100 text-amber-800'

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${colorClass}`}
    >
      {score}% zhoda
    </span>
  )
}

export function ApplicantSummaryCard({ contact, resume, matchScore }: Props) {
  const displayName = contact?.fullName ?? contact?.email ?? 'Kandidát'
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
                  {resume.yearsOfExperience}{' '}
                  {resume.yearsOfExperience === 1
                    ? 'rok'
                    : resume.yearsOfExperience < 5
                      ? 'roky'
                      : 'rokov'}{' '}
                  skúseností
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
              <ScoreBadge score={matchScore.score0to100} />
            ) : (
              <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                Match score nedostupné
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
