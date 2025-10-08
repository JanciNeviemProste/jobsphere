import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Mail, Phone, Download, MapPin, Euro, Clock, Building2 } from 'lucide-react'

async function getApplicationDetail(applicationId: string, userId: string) {
  // Get user's organization
  const orgMember = await prisma.orgMember.findFirst({
    where: { userId },
  })

  if (!orgMember) {
    return null
  }

  // Get application with all details
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      job: {
        organizationId: orgMember.organizationId,
      },
    },
    include: {
      job: {
        include: {
          organization: true,
        },
      },
      candidate: true,
      events: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  })

  return application
}

export default async function EmployerApplicationDetailPage({
  params,
}: {
  params: { locale: string; id: string }
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/${params.locale}/login`)
  }

  const application = await getApplicationDetail(params.id, session.user.id)

  if (!application) {
    redirect(`/${params.locale}/employer/applicants`)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary">Čaká sa</Badge>
      case 'REVIEWING':
        return <Badge>Preveruje sa</Badge>
      case 'INTERVIEWED':
        return <Badge className="bg-blue-600">Interview</Badge>
      case 'ACCEPTED':
        return <Badge className="bg-green-600">Prijaté</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">Zamietnuté</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href={`/${params.locale}/employer/applicants`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Späť na kandidátov
          </Link>
        </Button>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Info */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-2xl mb-2">{application.job.title}</CardTitle>
                    <CardDescription className="text-base">
                      {application.job.organization.name}
                    </CardDescription>
                  </div>
                  {getStatusBadge(application.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{application.job.location}</span>
                  </div>
                  {application.job.salaryMin && application.job.salaryMax && (
                    <div className="flex items-center gap-2 text-sm">
                      <Euro className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {application.job.salaryMin} - {application.job.salaryMax} € / mesiac
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{application.job.workMode}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{application.job.type}</span>
                  </div>
                </div>
                <Separator />
                <div className="text-sm text-muted-foreground">
                  Prihlásené {new Date(application.createdAt).toLocaleDateString('sk-SK')}
                </div>
              </CardContent>
            </Card>

            {/* Cover Letter */}
            <Card>
              <CardHeader>
                <CardTitle>Motivačný list</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-sm">{application.coverLetter}</div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Časová os prihlášky</CardTitle>
                <CardDescription>História tejto prihlášky</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {application.events.map((event: { id: string; type: string; title: string; description: string | null; createdAt: Date }, index: number) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-primary" />
                        {index !== application.events.length - 1 && (
                          <div className="w-px flex-1 bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="font-medium">{event.title}</p>
                        {event.description && (
                          <p className="text-sm text-muted-foreground">{event.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(event.createdAt).toLocaleDateString('sk-SK')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Candidate Info */}
            <Card>
              <CardHeader>
                <CardTitle>Kandidát</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-semibold text-lg">
                    {application.candidate.name || 'Bez mena'}
                  </p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`mailto:${application.candidate.email}`}
                        className="text-primary hover:underline"
                      >
                        {application.candidate.email}
                      </a>
                    </div>
                    {application.candidate.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`tel:${application.candidate.phone}`}
                          className="hover:underline"
                        >
                          {application.candidate.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CV Download */}
            {application.cvUrl && (
              <Card>
                <CardHeader>
                  <CardTitle>Priložené dokumenty</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href={application.cvUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Stiahnuť CV
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Akcie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {application.status === 'PENDING' && (
                  <Button className="w-full" variant="default">
                    Pozrieť sa na Interview
                  </Button>
                )}
                {application.status === 'REVIEWING' && (
                  <Button className="w-full" variant="default">
                    Naplánovať Interview
                  </Button>
                )}
                {application.status === 'INTERVIEWED' && (
                  <>
                    <Button className="w-full bg-green-600 hover:bg-green-700">
                      Prijať kandidáta
                    </Button>
                    <Button className="w-full" variant="destructive">
                      Zamietnuť
                    </Button>
                  </>
                )}
                <Separator />
                <Button className="w-full" variant="outline">
                  Poslať email
                </Button>
                <Button className="w-full" variant="outline">
                  Pridať poznámku
                </Button>
              </CardContent>
            </Card>

            {/* Notes */}
            {application.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Poznámky</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{application.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
