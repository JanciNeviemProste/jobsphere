import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { PipelineBoard } from '@/components/employer/pipeline-board'
import { APPLICATION_STAGES } from '@/lib/constants/application-stages'

// Maximum cards to show per Kanban column — keeps the DOM manageable
const PER_STAGE_CAP = 50

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Pipeline | JobSphere',
    description: 'Kanban board prehľad kandidátov.',
  }
}

export default async function PipelinePage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { jobId?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect(`/${params.locale}/login`)
  }

  const userOrgRole = await prisma.userOrgRole.findFirst({
    where: { userId: session.user.id },
  })
  if (!userOrgRole) {
    redirect(`/${params.locale}/dashboard`)
  }

  const orgId = userOrgRole.orgId
  const currentJobId = searchParams.jobId

  // Load capped card sets per stage + job list in parallel — all scoped to orgId
  const [stageResults, jobs] = await Promise.all([
    // One bounded query per stage (all filtered to org + optional job)
    Promise.all(
      APPLICATION_STAGES.map((stage) =>
        prisma.application.findMany({
          where: {
            job: { orgId },
            stage,
            ...(currentJobId ? { jobId: currentJobId } : {}),
          },
          select: {
            id: true,
            stage: true,
            createdAt: true,
            job: { select: { id: true, title: true } },
            candidate: {
              select: {
                contacts: {
                  take: 1,
                  select: { fullName: true, email: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: PER_STAGE_CAP,
        }),
      ),
    ),
    prisma.job.findMany({
      where: { orgId },
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const applications = stageResults.flat()

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link href={`/${params.locale}/employer`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Späť na dashboard
          </Link>
        </Button>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pipeline</h1>
            <p className="text-muted-foreground">Presúvajte kandidátov medzi fázami</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Server Component: no onChange handlers allowed — submit via the button. */}
            <form method="GET" className="flex items-center gap-2">
              <select
                name="jobId"
                defaultValue={currentJobId ?? ''}
                className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Všetky pozície</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="outline" size="sm">
                Filtrovať
              </Button>
            </form>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${params.locale}/employer/applicants`}>Zoznam</Link>
            </Button>
          </div>
        </div>

        <PipelineBoard
          applications={applications.map((a) => ({
            ...a,
            createdAt: a.createdAt.toISOString(),
          }))}
          jobs={jobs}
          currentJobId={currentJobId}
        />
      </div>
    </div>
  )
}
