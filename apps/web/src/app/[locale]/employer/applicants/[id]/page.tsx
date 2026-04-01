import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Mail, Phone, Download, MapPin, Euro, Clock, Building2 } from 'lucide-react'
import { ApplicantActions } from '@/components/applicant-actions'

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
            where: {
              isPrimary: true,
            },
            take: 1,
          },
          resumes: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
            include: {
              sourceDocument: true,
            },
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

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Applicant Detail | JobSphere',
    description: 'Review applicant details, resume, and application history.',
  }
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

  const getStatusBadge = (stage: string) => {
    switch (stage) {
      case 'NEW':
        return <Badge variant="secondary">Nová</Badge>
      case 'SCREENING':
        return <Badge>Preveruje sa</Badge>
      case 'PHONE_SCREEN':
        return <Badge className="bg-blue-600">Telefonický pohovor</Badge>
      case 'INTERVIEW':
        return <Badge className="bg-blue-600">Interview</Badge>
      case 'OFFER':
        return <Badge className="bg-green-600">Ponuka</Badge>
      case 'HIRED':
        return <Badge className="bg-green-600">Prijaté</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">Zamietnuté</Badge>
      default:
        return <Badge>{stage}</Badge>
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
          <div className="space-y-6 lg:col-span-2">
            {/* Job Info */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="mb-2 text-2xl">{application.job.title}</CardTitle>
                    <CardDescription className="text-base">
                      {application.job.organization.name}
                    </CardDescription>
                  </div>
                  {getStatusBadge(application.stage)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {application.job.city && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {application.job.city}
                        {application.job.region ? `, ${application.job.region}` : ''}
                      </span>
                    </div>
                  )}
                  {application.job.salaryMin && application.job.salaryMax && (
                    <div className="flex items-center gap-2 text-sm">
                      <Euro className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {application.job.salaryMin} - {application.job.salaryMax} € / mesiac
                      </span>
                    </div>
                  )}
                  {(application.job.remote || application.job.hybrid) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{application.job.remote ? 'Remote' : 'Hybrid'}</span>
                    </div>
                  )}
                  {application.job.employmentType && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{application.job.employmentType.replace('_', ' ')}</span>
                    </div>
                  )}
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
            {application.activities && application.activities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Časová os prihlášky</CardTitle>
                  <CardDescription>História tejto prihlášky</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {application.activities.map(
                      (
                        activity: {
                          id: string
                          type: string
                          description: string
                          createdAt: Date
                        },
                        index: number,
                      ) => (
                        <div key={activity.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="h-3 w-3 rounded-full bg-primary" />
                            {index !== application.activities.length - 1 && (
                              <div className="mt-2 w-px flex-1 bg-border" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="font-medium">{activity.type.replace('_', ' ')}</p>
                            <p className="text-sm text-muted-foreground">{activity.description}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(activity.createdAt).toLocaleDateString('sk-SK')}
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
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
                  <p className="text-lg font-semibold">
                    {application.candidate.contacts?.[0]?.fullName ||
                      application.candidate.contacts?.[0]?.email ||
                      'Kandidát'}
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

            {/* CV Download */}
            {application.candidate.resumes?.[0]?.sourceDocument && (
              <Card>
                <CardHeader>
                  <CardTitle>Životopis</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <a
                      href={application.candidate.resumes[0].sourceDocument.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={application.candidate.resumes[0].sourceDocument.filename}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {application.candidate.resumes[0].sourceDocument.filename || 'Stiahnuť CV'}
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <ApplicantActions
              applicationId={application.id}
              currentStage={application.stage}
              locale={params.locale}
            />

            {/* Notes */}
            {Array.isArray(application.notes) && application.notes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Poznámky</CardTitle>
                  <CardDescription>Interné poznámky k uchádzačovi</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {application.notes.map((note: any, index: number) => (
                      <div key={index} className="border-l-2 border-primary/30 py-2 pl-3">
                        <p className="whitespace-pre-wrap text-sm">
                          {typeof note === 'string' ? note : note.text || JSON.stringify(note)}
                        </p>
                        {typeof note === 'object' && note.createdAt && (
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{note.createdByName}</span>
                            <span>•</span>
                            <span>{new Date(note.createdAt).toLocaleDateString('sk-SK')}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
