import type { Metadata } from 'next'
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

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Analytics Dashboard | JobSphere',
    description: 'View recruitment analytics, application trends, and hiring metrics.',
  }
}

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
  const orgScope = { job: { orgId } }

  // ── DB-side aggregations — no full row scan in JS ──────────────────────────

  // 1. Stage distribution + total count
  const stageCounts = await prisma.application.groupBy({
    by: ['stage'],
    where: orgScope,
    _count: { stage: true },
  })

  const stageMap = Object.fromEntries(stageCounts.map((s) => [s.stage, s._count.stage]))
  const total = stageCounts.reduce((sum, s) => sum + s._count.stage, 0)

  const newApplications = stageMap['NEW'] ?? 0
  const screening = stageMap['SCREENING'] ?? 0
  const interview = (stageMap['PHONE_SCREEN'] ?? 0) + (stageMap['INTERVIEW'] ?? 0)
  const offer = stageMap['OFFER'] ?? 0
  const hired = stageMap['HIRED'] ?? 0

  const stageData = stageCounts.map((s) => ({ stage: s.stage, count: s._count.stage }))

  // 2. Application trend — count per calendar day, last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // groupBy date requires raw query; fetch minimal rows (id + createdAt) instead —
  // bounded to 30 days so at most a few thousand rows even for large orgs.
  const recentApps = await prisma.application.findMany({
    where: {
      ...orgScope,
      createdAt: { gte: thirtyDaysAgo },
    },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const dateGroups = recentApps.reduce(
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

  // 3. Top jobs by application count — DB aggregation, limit 10
  const jobCounts = await prisma.application.groupBy({
    by: ['jobId'],
    where: orgScope,
    _count: { jobId: true },
    orderBy: { _count: { jobId: 'desc' } },
    take: 10,
  })

  // Resolve job titles in a single IN query (max 10 rows)
  const jobIds = jobCounts.map((j) => j.jobId)
  const jobTitles = await prisma.job.findMany({
    where: { id: { in: jobIds }, orgId },
    select: { id: true, title: true, viewCount: true },
  })
  const titleMap = Object.fromEntries(jobTitles.map((j) => [j.id, j.title]))
  const viewMap = Object.fromEntries(jobTitles.map((j) => [j.id, j.viewCount]))

  const topJobs = jobCounts.map((j) => ({
    jobId: j.jobId,
    title: titleMap[j.jobId] ?? j.jobId,
    count: j._count.jobId,
    views: viewMap[j.jobId] ?? 0,
  }))

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
