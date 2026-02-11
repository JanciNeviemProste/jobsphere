import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import { StatsOverview } from '@/components/analytics/StatsOverview'
import { TopJobsTable } from '@/components/analytics/TopJobsTable'

const ChartLoading = () => (
  <div className="space-y-4 rounded-lg border p-6">
    <Skeleton className="h-6 w-1/3" />
    <Skeleton className="h-[300px] w-full" />
  </div>
)

const ApplicationsByStageChart = dynamic(
  () =>
    import('@/components/analytics/ApplicationsByStageChart').then((m) => ({
      default: m.ApplicationsByStageChart,
    })),
  { loading: ChartLoading },
)

const ConversionFunnel = dynamic(
  () =>
    import('@/components/analytics/ConversionFunnel').then((m) => ({
      default: m.ConversionFunnel,
    })),
  { loading: ChartLoading },
)

const ApplicationsTrend = dynamic(
  () =>
    import('@/components/analytics/ApplicationsTrend').then((m) => ({
      default: m.ApplicationsTrend,
    })),
  { loading: ChartLoading },
)

export default async function AnalyticsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Get user's organization
  const membership = await prisma.userOrgRole.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
  })

  if (!membership) {
    return (
      <div className="container mx-auto py-10">
        <h1 className="mb-6 text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground">You are not a member of any organization.</p>
      </div>
    )
  }

  const orgId = membership.orgId

  // Fetch all applications for the organization
  const applications = await prisma.application.findMany({
    where: { orgId },
    include: {
      job: {
        select: {
          title: true,
          id: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Calculate stats
  const total = applications.length
  const newApplications = applications.filter((a) => a.stage === 'NEW').length
  const screening = applications.filter((a) => a.stage === 'SCREENING').length
  const interview = applications.filter((a) =>
    ['PHONE_SCREEN', 'INTERVIEW'].includes(a.stage),
  ).length
  const offer = applications.filter((a) => a.stage === 'OFFER').length
  const hired = applications.filter((a) => a.stage === 'HIRED').length

  // Group by stage for pie chart
  const stageGroups = applications.reduce(
    (acc, app) => {
      const stage = app.stage
      acc[stage] = (acc[stage] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const stageData = Object.entries(stageGroups).map(([stage, count]) => ({
    stage,
    count,
  }))

  // Group by date for trend chart
  const dateGroups = applications.reduce(
    (acc, app) => {
      const date = new Date(app.createdAt).toLocaleDateString()
      acc[date] = (acc[date] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const trendData = Object.entries(dateGroups)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-30) // Last 30 days

  // Group by job for top jobs table
  const jobGroups = applications.reduce(
    (acc, app) => {
      const jobId = app.jobId
      if (!acc[jobId]) {
        acc[jobId] = {
          title: app.job.title,
          count: 0,
          jobId: app.jobId,
        }
      }
      acc[jobId].count++
      return acc
    },
    {} as Record<string, { title: string; count: number; jobId: string }>,
  )

  const topJobs = Object.values(jobGroups)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return (
    <div className="container mx-auto space-y-8 py-10">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of applications for {membership.organization.name}
        </p>
      </div>

      {/* Stats Overview */}
      <StatsOverview
        total={total}
        newApplications={newApplications}
        screening={screening}
        interview={interview}
        hired={hired}
      />

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        <ApplicationsByStageChart data={stageData} />
        <ConversionFunnel
          total={total}
          screening={screening}
          interview={interview}
          offer={offer}
          hired={hired}
        />
      </div>

      {/* Trend Chart */}
      <ApplicationsTrend data={trendData} />

      {/* Top Jobs Table */}
      <TopJobsTable jobs={topJobs} />
    </div>
  )
}
