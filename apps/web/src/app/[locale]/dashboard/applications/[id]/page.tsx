'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, MapPin, Euro, Clock, Building2, Mail, Phone, Download } from 'lucide-react'

const MOCK_APPLICATION = {
  id: '1',
  job: {
    title: 'Senior React Developer',
    company: 'TechCorp SK',
    location: 'Bratislava, Slovakia',
    salary: '3000 - 5000',
    workMode: 'HYBRID',
    type: 'FULL_TIME',
  },
  candidate: {
    name: 'Ján Novák',
    email: 'jan.novak@example.com',
    phone: '+421 900 123 456',
  },
  status: 'REVIEWING',
  appliedAt: '2024-10-01',
  coverLetter: `Dobrý deň,

Som nadšený, že môžem požiadať o pozíciu Senior React Developer vo vašej spoločnosti. S viac ako 5 rokmi skúseností v React vývoji a s hlbokými znalosťami TypeScript, Next.js a moderných frontend technológií si myslím, že som ideálny kandidát pre túto rolu.

Vo svojej predchádzajúcej pozícii som viedol tím 5 vývojárov pri vytváraní komplexnej e-commerce platformy, ktorá obsluhuje viac ako 100,000 používateľov mesačne. Implementoval som pokročilé state management riešenia, optimalizoval výkon aplikácie a zaviedol best practices pre code review a testing.

Teším sa na možnosť prispieť k vašim projektom a priniesť moje skúsenosti do vášho tímu.

S pozdravom,
Ján Novák`,
  timeline: [
    {
      date: '2024-10-01',
      status: 'Prihláška odoslaná',
      description: 'Vaša prihláška bola úspešne odoslaná',
    },
    {
      date: '2024-10-02',
      status: 'Prihláška v procese',
      description: 'HR tím prezerá vašu prihlášku',
    },
    {
      date: '2024-10-03',
      status: 'CV schválené',
      description: 'Vaše CV bolo schválené recruitérom',
    },
  ],
}

export default function ApplicationDetailPage({ params }: { params: { locale: string; id: string } }) {
  const t = useTranslations()
  const locale = params.locale
  const applicationId = params.id

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
                    <CardTitle className="text-2xl mb-2">{MOCK_APPLICATION.job.title}</CardTitle>
                    <CardDescription className="text-base">{MOCK_APPLICATION.job.company}</CardDescription>
                  </div>
                  {getStatusBadge(MOCK_APPLICATION.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{MOCK_APPLICATION.job.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Euro className="h-4 w-4 text-muted-foreground" />
                    <span>{MOCK_APPLICATION.job.salary} € / mesiac</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{MOCK_APPLICATION.job.workMode}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{MOCK_APPLICATION.job.type}</span>
                  </div>
                </div>
                <Separator />
                <div className="text-sm text-muted-foreground">
                  Prihlásené {new Date(MOCK_APPLICATION.appliedAt).toLocaleDateString('sk-SK')}
                </div>
              </CardContent>
            </Card>

            {/* Cover Letter */}
            <Card>
              <CardHeader>
                <CardTitle>Motivačný list</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-sm">{MOCK_APPLICATION.coverLetter}</div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Časová os prihlášky</CardTitle>
                <CardDescription>História vašej prihlášky</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {MOCK_APPLICATION.timeline.map((event, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-primary" />
                        {index !== MOCK_APPLICATION.timeline.length - 1 && (
                          <div className="w-px flex-1 bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="font-medium">{event.status}</p>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(event.date).toLocaleDateString('sk-SK')}
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
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle>Kontaktné údaje</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${MOCK_APPLICATION.candidate.email}`} className="text-primary hover:underline">
                    {MOCK_APPLICATION.candidate.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${MOCK_APPLICATION.candidate.phone}`} className="hover:underline">
                    {MOCK_APPLICATION.candidate.phone}
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* CV Download */}
            <Card>
              <CardHeader>
                <CardTitle>Priložené dokumenty</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full justify-start">
                  <Download className="mr-2 h-4 w-4" />
                  CV_Jan_Novak_2024.pdf
                </Button>
              </CardContent>
            </Card>

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
