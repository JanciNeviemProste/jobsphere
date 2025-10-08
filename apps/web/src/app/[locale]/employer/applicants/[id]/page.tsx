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
  const userOrgRole = await prisma.userOrgRole.findFirst({
    where: { userId },
  })

  if (!userOrgRole) {
    return null
  }

  // Get application with all details
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      job: {
        orgId: userOrgRole.orgId,
      },
    },
    include: {
      job: {
        include: {
          organization: true,
        },
      },
      candidate: {
        include: {
          contacts: {
            where: { isPrimary: true },
            take: 1,
          },
        },
      },
      activities: {
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
      case 'NEW':
        return <Badge variant="secondary">Nová prihláška</Badge>
      case 'SCREENING':
        return <Badge>Screening</Badge>
      case 'PHONE':
        return <Badge className="bg-blue-600">Telefonický interview</Badge>
      case 'ONSITE':
        return <Badge className="bg-purple-600">Osobný interview</Badge>
      case 'OFFER':
        return <Badge className="bg-green-600">Ponuka</Badge>
      case 'HIRED':
        return <Badge className="bg-green-700">Prijaté</Badge>
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
                  {getStatusBadge(application.stage)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{application.job.city}{application.job.region && `, ${application.job.region}`}</span>
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
                    <span>
                      {application.job.remote ? 'Remote' : application.job.hybrid ? 'Hybrid' : 'On-site'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{application.job.employmentType}</span>
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
                  {application.activities.map((event: { id: string; type: string; description: string; createdAt: Date }, index: number) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-primary" />
                        {index !== application.activities.length - 1 && (
                          <div className="w-px flex-1 bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="font-medium">{event.type}</p>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
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
                    {application.candidate.contacts?.[0]?.fullName || 'Bez mena'}
                  </p>
                  <div className="mt-3 space-y-2">
                    {application.candidate.contacts?.[0]?.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`mailto:${application.candidate.contacts[0].email}`}
                          className="text-primary hover:underline"
                        >
                          {application.candidate.contacts[0].email}
                        </a>
                      </div>
                    )}
                    {application.candidate.contacts?.[0]?.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`tel:${application.candidate.contacts[0].phone}`}
                          className="hover:underline"
                        >
                          {application.candidate.contacts[0].phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CV Download - TODO: Implement document retrieval from CandidateDocument model */}

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Akcie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {application.stage === 'NEW' && (
                  <Button className="w-full" variant="default">
                    Začať screening
                  </Button>
                )}
                {application.stage === 'SCREENING' && (
                  <Button className="w-full" variant="default">
                    Naplánovať Interview
                  </Button>
                )}
                {application.stage === 'PHONE' && (
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

            {/* Notes - TODO: Display notes from Json array */}
          </div>
        </div>
      </div>
    </div>
  )
}
