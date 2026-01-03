'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, MapPin, Euro, Clock, Building2, Mail, Phone, Download, Loader2 } from 'lucide-react'

export default function ApplicationDetailPage({ params }: { params: { locale: string; id: string } }) {
  const t = useTranslations()
  const locale = params.locale
  const applicationId = params.id
  const [application, setApplication] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchApplication() {
      try {
        const response = await fetch(`/api/applications/${applicationId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch application')
        }
        const data = await response.json()
        setApplication(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchApplication()
  }, [applicationId])

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !application) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Chyba</CardTitle>
            <CardDescription>{error || 'Prihláška sa nenašla'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/${locale}/dashboard`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Späť na dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href={`/${locale}/dashboard`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Späť na dashboard
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
                    <CardDescription className="text-base">{application.job.organization.name}</CardDescription>
                  </div>
                  {getStatusBadge(application.stage)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {application.job.city && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{application.job.city}{application.job.region ? `, ${application.job.region}` : ''}</span>
                    </div>
                  )}
                  {(application.job.salaryMin || application.job.salaryMax) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Euro className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {application.job.salaryMin && application.job.salaryMax
                          ? `${application.job.salaryMin} - ${application.job.salaryMax} €`
                          : application.job.salaryMin
                          ? `Od ${application.job.salaryMin} €`
                          : `Do ${application.job.salaryMax} €`}
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
            {application.coverLetter && (
              <Card>
                <CardHeader>
                  <CardTitle>Motivačný list</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm">{application.coverLetter}</div>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            {application.activities && application.activities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Časová os prihlášky</CardTitle>
                  <CardDescription>História vašej prihlášky</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {application.activities.map((activity: any, index: number) => (
                      <div key={activity.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="h-3 w-3 rounded-full bg-primary" />
                          {index !== application.activities.length - 1 && (
                            <div className="w-px flex-1 bg-border mt-2" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="font-medium">{activity.type.replace('_', ' ')}</p>
                          <p className="text-sm text-muted-foreground">{activity.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(activity.createdAt).toLocaleDateString('sk-SK')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle>Kontaktné údaje</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {application.candidate.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${application.candidate.email}`} className="text-primary hover:underline">
                      {application.candidate.email}
                    </a>
                  </div>
                )}
                {application.candidate.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${application.candidate.phone}`} className="hover:underline">
                      {application.candidate.phone}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CV Download */}
            {application.candidate.cvUrl && (
              <Card>
                <CardHeader>
                  <CardTitle>Priložené dokumenty</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href={application.candidate.cvUrl} target="_blank" rel="noopener noreferrer" download>
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
                <Button className="w-full" variant="outline">
                  Stiahnuť všetko
                </Button>
                <Button className="w-full" variant="destructive">
                  Zrušiť prihlášku
                </Button>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  💡 <strong>Tip:</strong> Prihlášky sú zvyčajne spracované do 5 pracovných dní.
                  Môžete očakávať odpoveď emailom.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
