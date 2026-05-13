import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Briefcase, Users, Kanban, CheckCircle, Clock, XCircle } from 'lucide-react'
import { STAGE_LABELS_EN, STAGE_COLORS } from '@/lib/constants/application-stages'

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'pageMetadata' })
  return { title: t('employer.title'), description: t('employer.description') }
}

async function getEmployerData(userId: string) {
  // Get user's organization
  const userOrgRole = await prisma.userOrgRole.findFirst({
    where: { userId },
    include: {
      organization: true,
    },
  })

  if (!userOrgRole) {
    return null
  }

  // Get jobs for this organization
  const jobs = await prisma.job.findMany({
    where: {
      orgId: userOrgRole.orgId,
    },
    include: {
      applications: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  })

  // Get recent applications
  const recentApplications = await prisma.application.findMany({
    where: {
      job: {
        orgId: userOrgRole.orgId,
      },
    },
    include: {
      job: {
        select: {
          title: true,
        },
      },
      candidate: {
        include: {
          contacts: {
            where: {
              isPrimary: true,
            },
            take: 1,
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 5,
  })

  return {
    organization: userOrgRole.organization,
    jobs,
    recentApplications,
  }
}

export default async function EmployerDashboardPage({ params }: { params: { locale: string } }) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/${params.locale}/login`)
  }

  const data = await getEmployerData(session.user.id)

  if (!data) {
    // User is not an employer
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Prístup odmietnutý</CardTitle>
            <CardDescription>
              Nemáte prístup k employer dashboardu. Vytvorte si organizáciu alebo sa pripojiť k
              existujúcej.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={`/${params.locale}/dashboard`}>Späť na dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { organization, jobs, recentApplications } = data

  type JobWithApplications = typeof jobs extends (infer T)[] ? T : never
  type ApplicationWithRelations = typeof recentApplications extends (infer T)[] ? T : never

  // Calculate stats
  const stats = {
    activeJobs: jobs.filter((j: JobWithApplications) => j.status === 'PUBLISHED').length,
    totalApplicants: jobs.reduce(
      (sum: number, job: JobWithApplications) => sum + job.applications.length,
      0,
    ),
    newApplicants: recentApplications.filter((a: ApplicationWithRelations) => a.stage === 'NEW')
      .length,
    totalJobs: jobs.length,
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" /> Aktívne
          </Badge>
        )
      case 'DRAFT':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" /> Koncept
          </Badge>
        )
      case 'CLOSED':
        return (
          <Badge variant="outline" className="gap-1">
            <XCircle className="h-3 w-3" /> Uzavreté
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getApplicantStatusBadge = (status: string) => {
    const label = STAGE_LABELS_EN[status as keyof typeof STAGE_LABELS_EN] ?? status
    const colorClass = STAGE_COLORS[status as keyof typeof STAGE_COLORS]
    if (colorClass) {
      return <Badge className={colorClass}>{label}</Badge>
    }
    return <Badge>{label}</Badge>
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold">{organization.name} - ATS Dashboard</h1>
            <p className="text-muted-foreground">Spravujte vaše pracovné ponuky a kandidátov</p>
          </div>
          <Button asChild>
            <Link href={`/${params.locale}/employer/jobs/new`}>
              <Plus className="mr-2 h-4 w-4" />
              Nová pozícia
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Aktívne pozície</CardDescription>
              <CardTitle className="text-3xl">{stats.activeJobs}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Celkovo prihlášok</CardDescription>
              <CardTitle className="text-3xl">{stats.totalApplicants}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Nové prihlášky</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{stats.newApplicants}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Celkovo pozícií</CardDescription>
              <CardTitle className="text-3xl text-muted-foreground">{stats.totalJobs}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Active Jobs */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pracovné pozície</CardTitle>
                    <CardDescription>Vaše zverejnené ponuky práce</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {jobs.map((job: JobWithApplications) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <h3 className="font-semibold">{job.title}</h3>
                          {getStatusBadge(job.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {job.applications.length} prihlášok
                          </span>
                          <span>
                            Vytvorené {new Date(job.createdAt).toLocaleDateString('sk-SK')}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/${params.locale}/jobs/${job.id}`}>Zobraziť</Link>
                        </Button>
                        <Button variant="default" size="sm" asChild>
                          <Link href={`/${params.locale}/employer/jobs/${job.id}/edit`}>
                            Upraviť
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}

                  {jobs.length === 0 && (
                    <div className="py-8 text-center">
                      <Briefcase className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                      <p className="mb-4 text-muted-foreground">
                        Zatiaľ nemáte žiadne pracovné ponuky
                      </p>
                      <Button asChild>
                        <Link href={`/${params.locale}/employer/jobs/new`}>
                          <Plus className="mr-2 h-4 w-4" />
                          Vytvoriť prvú pozíciu
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Applicants */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Nedávne prihlášky</CardTitle>
                    <CardDescription>Posledné prihlásení kandidáti</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/${params.locale}/employer/applicants`}>Zobraziť všetky</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentApplications.map((application: ApplicationWithRelations) => (
                    <div
                      key={application.id}
                      className="flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <h4 className="font-semibold">
                            {application.candidate.contacts?.[0]?.fullName ||
                              application.candidate.contacts?.[0]?.email ||
                              'Kandidát'}
                          </h4>
                          {getApplicantStatusBadge(application.stage)}
                        </div>
                        <p className="mb-1 text-sm text-muted-foreground">
                          {application.job.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            Prihlásený {new Date(application.createdAt).toLocaleDateString('sk-SK')}
                          </span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/${params.locale}/employer/applicants/${application.id}`}>
                          Detail
                        </Link>
                      </Button>
                    </div>
                  ))}

                  {recentApplications.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground">
                      <Users className="mx-auto mb-3 h-12 w-12" />
                      <p>Zatiaľ žiadne prihlášky</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Rýchle akcie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href={`/${params.locale}/employer/jobs/new`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Vytvoriť novú pozíciu
                  </Link>
                </Button>
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href={`/${params.locale}/employer/applicants`}>
                    <Users className="mr-2 h-4 w-4" />
                    Zobraziť všetkých kandidátov
                  </Link>
                </Button>
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href={`/${params.locale}/employer/pipeline`}>
                    <Kanban className="mr-2 h-4 w-4" />
                    Pipeline
                  </Link>
                </Button>
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href={`/${params.locale}/employer/settings`}>
                    <Briefcase className="mr-2 h-4 w-4" />
                    Nastavenia spoločnosti
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card>
              <CardHeader>
                <CardTitle>Tipy pre lepší nábor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="mb-1 font-medium">✨ Použite AI matching</p>
                  <p className="text-xs text-muted-foreground">
                    Naša AI automaticky vyhodnotí kandidátov a priradí im skóre zhody
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="mb-1 font-medium">📝 Detailný popis pozície</p>
                  <p className="text-xs text-muted-foreground">
                    Presné popisy pozícií priťahujú kvalitnejších kandidátov
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="mb-1 font-medium">⚡ Rýchla reakcia</p>
                  <p className="text-xs text-muted-foreground">
                    Kandidáti oceňujú rýchlu spätnú väzbu po podaní prihlášky
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
