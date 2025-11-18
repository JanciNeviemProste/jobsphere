'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Briefcase, FileText, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

// Mock data - neskôr z databázy
const MOCK_USER = {
  name: 'Ján Novák',
  email: 'jan.novak@example.com',
  cvUploaded: true,
}

const MOCK_APPLICATIONS = [
  {
    id: '1',
    jobTitle: 'Senior React Developer',
    company: 'TechCorp SK',
    status: 'PENDING',
    appliedAt: '2024-10-01',
    location: 'Bratislava, Slovakia',
  },
  {
    id: '2',
    jobTitle: 'Frontend Developer',
    company: 'Digital Solutions',
    status: 'REVIEWING',
    appliedAt: '2024-09-28',
    location: 'Praha, Czech Republic',
  },
  {
    id: '3',
    jobTitle: 'Full Stack Developer',
    company: 'Innovation Labs',
    status: 'REJECTED',
    appliedAt: '2024-09-20',
    location: 'Viedeň, Austria',
  },
  {
    id: '4',
    jobTitle: 'React Native Developer',
    company: 'Mobile First',
    status: 'ACCEPTED',
    appliedAt: '2024-09-15',
    location: 'Brno, Czech Republic',
  },
]

const RECOMMENDED_JOBS = [
  {
    id: '5',
    title: 'Senior Frontend Engineer',
    company: 'Tech Solutions',
    location: 'Bratislava',
    salary: '3500 - 5500',
    match: 95,
  },
  {
    id: '6',
    title: 'React Developer',
    company: 'WebDev Co',
    location: 'Remote',
    salary: '3000 - 4500',
    match: 88,
  },
  {
    id: '7',
    title: 'Lead Frontend Developer',
    company: 'Digital Agency',
    location: 'Praha',
    salary: '4500 - 7000',
    match: 82,
  },
]

export default function DashboardPage({ params }: { params: { locale: string } }) {
  const t = useTranslations()
  const locale = params.locale

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Čaká sa</Badge>
      case 'REVIEWING':
        return <Badge variant="default" className="gap-1"><AlertCircle className="h-3 w-3" /> Preveruje sa</Badge>
      case 'ACCEPTED':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> Prijaté</Badge>
      case 'REJECTED':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Zamietnuté</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const stats = {
    total: MOCK_APPLICATIONS.length,
    pending: MOCK_APPLICATIONS.filter(a => a.status === 'PENDING').length,
    reviewing: MOCK_APPLICATIONS.filter(a => a.status === 'REVIEWING').length,
    accepted: MOCK_APPLICATIONS.filter(a => a.status === 'ACCEPTED').length,
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Vitajte späť, {MOCK_USER.name}!</h1>
          <p className="text-muted-foreground">Tu je prehľad vašich pracovných príležitostí</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Celkovo prihlášok</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Čaká sa</CardDescription>
              <CardTitle className="text-3xl text-muted-foreground">{stats.pending}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>V procese</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{stats.reviewing}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Prijaté</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.accepted}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Applications */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Moje prihlášky</CardTitle>
                    <CardDescription>Všetky vaše odoslané prihlášky</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/${locale}/jobs`}>Hľadať prácu</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {MOCK_APPLICATIONS.map((app) => (
                    <div
                      key={app.id}
                      className="flex items-start justify-between gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h3 className="font-semibold">{app.jobTitle}</h3>
                            <p className="text-sm text-muted-foreground">{app.company}</p>
                          </div>
                          {getStatusBadge(app.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{app.location}</span>
                          <span>•</span>
                          <span>Prihlásené {new Date(app.appliedAt).toLocaleDateString('sk-SK')}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/applications/${app.id}`}>Detail</Link>
                      </Button>
                    </div>
                  ))}

                  {MOCK_APPLICATIONS.length === 0 && (
                    <div className="text-center py-8">
                      <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                      <p className="text-muted-foreground mb-4">Zatiaľ nemáte žiadne prihlášky</p>
                      <Button asChild>
                        <Link href={`/${locale}/jobs`}>Prehľadať ponuky</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Profile Completion */}
            <Card>
              <CardHeader>
                <CardTitle>Profil</CardTitle>
                <CardDescription>Dokončite svoj profil pre lepšie návrhy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Dokončenie profilu</span>
                    <span className="font-semibold">75%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: '75%' }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Základné informácie</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>CV nahrané</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <span>Zručnosti a skúsenosti</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <span>Preferencie práce</span>
                  </div>
                </div>
                <Button className="w-full" variant="outline" asChild>
                  <Link href={`/${locale}/dashboard/profile`}>Dokončiť profil</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Recommended Jobs */}
            <Card>
              <CardHeader>
                <CardTitle>Odporúčané pre vás</CardTitle>
                <CardDescription>AI návrhy na základe vášho profilu</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {RECOMMENDED_JOBS.map((job) => (
                  <div key={job.id} className="space-y-2 pb-4 border-b last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{job.title}</h4>
                        <p className="text-xs text-muted-foreground">{job.company}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{job.match}% match</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{job.location} • {job.salary} €</p>
                    <Button size="sm" variant="outline" className="w-full" asChild>
                      <Link href={`/${locale}/jobs/${job.id}`}>Zobraziť</Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
