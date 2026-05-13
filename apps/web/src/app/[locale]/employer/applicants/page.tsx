import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Kanban } from 'lucide-react'
import { ExportCSVButton } from '@/components/ExportCSVButton'
import { ApplicantsTable } from '@/components/employer/applicants-table'

async function getApplicants(userId: string) {
  // Get user's organization
  const userOrgRole = await prisma.userOrgRole.findFirst({
    where: { userId },
  })

  if (!userOrgRole) {
    return null
  }

  // Get all applications for this organization's jobs
  const applications = await prisma.application.findMany({
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
  })

  return applications
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'All Applicants | JobSphere',
    description: 'View and manage all job applicants across your organization.',
  }
}

export default async function ApplicantsPage({ params }: { params: { locale: string } }) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/${params.locale}/login`)
  }

  const applications = await getApplicants(session.user.id)

  if (!applications) {
    redirect(`/${params.locale}/dashboard`)
  }

  type ApplicationWithRelations = typeof applications extends (infer T)[] ? T : never

  const stats = {
    total: applications.length,
    new: applications.filter((a: ApplicationWithRelations) => a.stage === 'NEW').length,
    reviewing: applications.filter(
      (a: ApplicationWithRelations) => a.stage === 'SCREENING' || a.stage === 'PHONE_SCREEN',
    ).length,
    interviewed: applications.filter((a: ApplicationWithRelations) => a.stage === 'INTERVIEW')
      .length,
  }

  const tableApplications = applications.map((a: ApplicationWithRelations) => ({
    id: a.id,
    candidateName: a.candidate.contacts?.[0]?.fullName || a.candidate.contacts?.[0]?.email || '',
    candidateEmail: a.candidate.contacts?.[0]?.email || '',
    jobTitle: a.job.title,
    stage: a.stage,
    createdAt: a.createdAt,
  }))

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
      </div>
    </div>
  )
}
