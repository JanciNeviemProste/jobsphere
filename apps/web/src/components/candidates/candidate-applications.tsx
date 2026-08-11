import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { STAGE_COLORS, type ApplicationStage } from '@/lib/constants/application-stages'

interface CandidateApplication {
  id: string
  stage: string
  createdAt: Date
  rejectionReason: string | null
  rejectedAt: Date | null
  job: { id: string; title: string } | null
}

/**
 * Every application this person has made to the organisation.
 *
 * The candidate profile was built around one resume and one match score, with no
 * notion that the same person might have applied before. A recruiter opening a
 * profile could not see that they had been rejected for a different role last
 * month, or that they were mid-process on two roles at once — the detail view was
 * always per-application, never per-person.
 */
export function CandidateApplications({
  applications,
  locale,
}: {
  applications: CandidateApplication[]
  locale: string
}) {
  if (applications.length === 0) {
    return null
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Applications ({applications.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {applications.map((application) => {
          const colorClass = STAGE_COLORS[application.stage as ApplicationStage]
          return (
            <div
              key={application.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/${locale}/employer/applicants/${application.id}`}
                  className="font-medium hover:underline"
                >
                  {application.job?.title ?? 'Position removed'}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Applied {application.createdAt.toISOString().slice(0, 10)}
                </p>
                {/* The reason is the point of showing history at all: "we said no
                    before, and here is why" is what a recruiter needs before
                    deciding again. */}
                {application.rejectionReason && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rejected {application.rejectedAt?.toISOString().slice(0, 10)} —{' '}
                    {application.rejectionReason}
                  </p>
                )}
              </div>
              {colorClass ? (
                <Badge className={colorClass}>{application.stage}</Badge>
              ) : (
                <Badge>{application.stage}</Badge>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
