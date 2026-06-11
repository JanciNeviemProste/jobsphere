import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Kanban, ChevronLeft, ChevronRight } from 'lucide-react'
import { ExportCSVButton } from '@/components/ExportCSVButton'
import { ApplicantsTable } from '@/components/employer/applicants-table'

const PAGE_SIZE = 20

async function getApplicants(userId: string, page: number) {
  // Get user's organization
  const userOrgRole = await prisma.userOrgRole.findFirst({
    where: { userId },
  })

  if (!userOrgRole) {
    return null
  }

  const where = {
    job: {
      orgId: userOrgRole.orgId,
    },
  }

  // Paginated query + total count — both scoped to the caller's org
  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      select: {
        id: true,
        stage: true,
        createdAt: true,
        job: {
          select: {
            title: true,
          },
        },
        candidate: {
          select: {
            contacts: {
              where: { isPrimary: true },
              take: 1,
              select: {
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.application.count({ where }),
  ])

  return { applications, total, orgId: userOrgRole.orgId }
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'All Applicants | JobSphere',
    description: 'View and manage all job applicants across your organization.',
  }
}

export default async function ApplicantsPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams?: { page?: string }
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/${params.locale}/login`)
  }

  const page = Math.max(1, parseInt(searchParams?.page ?? '1', 10) || 1)
  const result = await getApplicants(session.user.id, page)

  if (!result) {
    redirect(`/${params.locale}/dashboard`)
  }

  const { applications, total } = result
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Stats require DB-side aggregation — use groupBy so we don't load extra rows
  const stageCounts = await prisma.application.groupBy({
    by: ['stage'],
    where: {
      job: {
        orgId: result.orgId,
      },
    },
    _count: { stage: true },
  })

  const stageMap = Object.fromEntries(stageCounts.map((s) => [s.stage, s._count.stage]))

  const stats = {
    total,
    new: stageMap['NEW'] ?? 0,
    reviewing: (stageMap['SCREENING'] ?? 0) + (stageMap['PHONE_SCREEN'] ?? 0),
    interviewed: stageMap['INTERVIEW'] ?? 0,
  }

  const tableApplications = applications.map((a) => ({
    id: a.id,
    candidateName: a.candidate.contacts?.[0]?.fullName || a.candidate.contacts?.[0]?.email || '',
    candidateEmail: a.candidate.contacts?.[0]?.email || '',
    jobTitle: a.job.title,
    stage: a.stage,
    createdAt: a.createdAt,
  }))

  // Build a page href preserving any future filters
  function pageHref(p: number) {
    return `/${params.locale}/employer/applicants${p > 1 ? `?page=${p}` : ''}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href={`/${params.locale}/employer`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Späť na dashboard
          </Link>
        </Button>

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold">Všetci kandidáti</h1>
            <p className="text-muted-foreground">Prehľad všetkých prihlášok</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${params.locale}/employer/pipeline`}>
                <Kanban className="mr-2 h-4 w-4" />
                Zobraziť ako board
              </Link>
            </Button>
            <ExportCSVButton />
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Celkovo</CardTitle>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Nové</CardTitle>
              <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">V procese</CardTitle>
              <div className="text-2xl font-bold text-orange-600">{stats.reviewing}</div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Interview</CardTitle>
              <div className="text-2xl font-bold text-purple-600">{stats.interviewed}</div>
            </CardHeader>
          </Card>
        </div>

        {/* Applicants List */}
        <Card>
          <CardContent className="pt-6">
            <ApplicantsTable applications={tableApplications} locale={params.locale} />
          </CardContent>
        </Card>

        {/* Crawlable pagination */}
        {totalPages > 1 && (
          <nav
            aria-label="Applicants pagination"
            className="mt-8 flex items-center justify-center gap-2"
          >
            {page > 1 && (
              <a
                href={pageHref(page - 1)}
                rel="prev"
                className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
                Predošlá
              </a>
            )}

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => {
                const near = [page - 2, page - 1, page, page + 1, page + 2]
                return p === 1 || p === totalPages || near.includes(p)
              })
              .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis')
                acc.push(p)
                return acc
              }, [])
              .map((item, idx) =>
                item === 'ellipsis' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                    …
                  </span>
                ) : (
                  <a
                    key={item}
                    href={pageHref(item)}
                    aria-current={item === page ? 'page' : undefined}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium hover:bg-muted ${
                      item === page
                        ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                        : ''
                    }`}
                  >
                    {item}
                  </a>
                ),
              )}

            {page < totalPages && (
              <a
                href={pageHref(page + 1)}
                rel="next"
                className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                aria-label="Next page"
              >
                Ďalšia
                <ChevronRight className="h-4 w-4" />
              </a>
            )}
          </nav>
        )}
      </div>
    </div>
  )
}
