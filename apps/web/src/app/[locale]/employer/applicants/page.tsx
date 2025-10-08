import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download } from 'lucide-react'

async function getApplicants(userId: string) {
  // Get user's organization
  const orgMember = await prisma.orgMember.findFirst({
    where: { userId },
  })

  if (!orgMember) {
    return null
  }

  // Get all applications for this organization's jobs
  const applications = await prisma.application.findMany({
    where: {
      job: {
        organizationId: orgMember.organizationId,
      },
    },
    include: {
      job: {
        select: {
          title: true,
        },
      },
      candidate: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return applications
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
    new: applications.filter((a: ApplicationWithRelations) => a.status === 'PENDING').length,
    reviewing: applications.filter((a: ApplicationWithRelations) => a.status === 'REVIEWING').length,
    interviewed: applications.filter((a: ApplicationWithRelations) => a.status === 'INTERVIEWED').length,
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge>Nový</Badge>
      case 'REVIEWING':
        return <Badge variant="secondary">Preveruje sa</Badge>
      case 'INTERVIEWED':
        return <Badge className="bg-blue-600">Interview</Badge>
      case 'ACCEPTED':
        return <Badge className="bg-green-600">Prijatý</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">Zamietnutý</Badge>
      default:
        return <Badge>{status}</Badge>
    }
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Všetci kandidáti</h1>
            <p className="text-muted-foreground">Prehľad všetkých prihlášok</p>
          </div>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
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
            <div className="space-y-4">
              {applications.map((application: ApplicationWithRelations) => (
                <div
                  key={application.id}
                  className="flex items-center justify-between gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-semibold text-primary">
                          {(application.candidate.name || application.candidate.email)
                            .split(' ')
                            .map((n: string) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          {application.candidate.name || application.candidate.email}
                        </h3>
                        <p className="text-sm text-muted-foreground">{application.candidate.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground ml-13">
                      <span>{application.job.title}</span>
                      <span>•</span>
                      <span>Prihlásený {new Date(application.createdAt).toLocaleDateString('sk-SK')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(application.status)}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/${params.locale}/employer/applicants/${application.id}`}>
                        Detail
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}

              {applications.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    Nenašli sa žiadni kandidáti. Vytvorte pracovnú ponuku a počkajte na prihlášky.
                  </p>
                  <Button asChild className="mt-4">
                    <Link href={`/${params.locale}/employer/jobs/new`}>Vytvoriť pozíciu</Link>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
