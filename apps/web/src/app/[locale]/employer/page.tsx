'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Briefcase, Users, Eye, CheckCircle, Clock, XCircle } from 'lucide-react'

// Mock data - neskôr z databázy
const MOCK_COMPANY = {
  name: 'TechCorp SK',
  logo: null,
}

const MOCK_JOBS = [
  {
    id: '1',
    title: 'Senior React Developer',
    status: 'ACTIVE',
    applicants: 23,
    views: 456,
    createdAt: '2024-09-15',
  },
  {
    id: '2',
    title: 'Backend Developer',
    status: 'ACTIVE',
    applicants: 15,
    views: 234,
    createdAt: '2024-09-20',
  },
  {
    id: '3',
    title: 'DevOps Engineer',
    status: 'DRAFT',
    applicants: 0,
    views: 12,
    createdAt: '2024-10-01',
  },
]

const MOCK_RECENT_APPLICANTS = [
  {
    id: '1',
    name: 'Peter Kováč',
    jobTitle: 'Senior React Developer',
    status: 'NEW',
    appliedAt: '2024-10-03',
    match: 92,
  },
  {
    id: '2',
    name: 'Jana Horvátová',
    jobTitle: 'Senior React Developer',
    status: 'REVIEWING',
    appliedAt: '2024-10-02',
    match: 88,
  },
  {
    id: '3',
    name: 'Martin Szabó',
    jobTitle: 'Backend Developer',
    status: 'INTERVIEWED',
    appliedAt: '2024-10-01',
    match: 85,
  },
  {
    id: '4',
    name: 'Lucia Mináriková',
    jobTitle: 'Backend Developer',
    status: 'REJECTED',
    appliedAt: '2024-09-30',
    match: 65,
  },
]

export default function EmployerDashboardPage() {
  const t = useTranslations()

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Aktívne</Badge>
      case 'DRAFT':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Koncept</Badge>
      case 'CLOSED':
        return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Uzavreté</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getApplicantStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return <Badge variant="default">Nový</Badge>
      case 'REVIEWING':
        return <Badge variant="secondary">Preveruje sa</Badge>
      case 'INTERVIEWED':
        return <Badge className="bg-blue-600">Interview</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">Zamietnutý</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const stats = {
    activeJobs: MOCK_JOBS.filter(j => j.status === 'ACTIVE').length,
    totalApplicants: MOCK_JOBS.reduce((sum, job) => sum + job.applicants, 0),
    newApplicants: MOCK_RECENT_APPLICANTS.filter(a => a.status === 'NEW').length,
    totalViews: MOCK_JOBS.reduce((sum, job) => sum + job.views, 0),
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">{MOCK_COMPANY.name} - ATS Dashboard</h1>
            <p className="text-muted-foreground">Spravujte vaše pracovné ponuky a kandidátov</p>
          </div>
          <Button asChild>
            <Link href="/employer/jobs/new">
              <Plus className="mr-2 h-4 w-4" />
              Nová pozícia
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
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
              <CardDescription>Celkovo zobrazení</CardDescription>
              <CardTitle className="text-3xl text-muted-foreground">{stats.totalViews}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Jobs */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pracovné pozície</CardTitle>
                    <CardDescription>Vaše zverejnené ponuky práce</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/employer/jobs">Zobraziť všetky</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {MOCK_JOBS.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{job.title}</h3>
                          {getStatusBadge(job.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {job.applicants} prihlášok
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            {job.views} zobrazení
                          </span>
                          <span>Vytvorené {new Date(job.createdAt).toLocaleDateString('sk-SK')}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/employer/jobs/${job.id}`}>Upraviť</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/employer/jobs/${job.id}/applicants`}>Prihlášky</Link>
                        </Button>
                      </div>
                    </div>
                  ))}

                  {MOCK_JOBS.length === 0 && (
                    <div className="text-center py-8">
                      <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                      <p className="text-muted-foreground mb-4">Zatiaľ nemáte žiadne pracovné ponuky</p>
                      <Button asChild>
                        <Link href="/employer/jobs/new">
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
                    <Link href="/employer/applicants">Zobraziť všetky</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {MOCK_RECENT_APPLICANTS.map((applicant) => (
                    <div
                      key={applicant.id}
                      className="flex items-center justify-between gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{applicant.name}</h4>
                          {getApplicantStatusBadge(applicant.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">{applicant.jobTitle}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Prihlásený {new Date(applicant.appliedAt).toLocaleDateString('sk-SK')}</span>
                          <span>•</span>
                          <span className="text-primary font-medium">{applicant.match}% AI match</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/employer/applicants/${applicant.id}`}>Detail</Link>
                      </Button>
                    </div>
                  ))}
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
                  <Link href="/employer/jobs/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Vytvoriť novú pozíciu
                  </Link>
                </Button>
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href="/employer/applicants">
                    <Users className="mr-2 h-4 w-4" />
                    Zobraziť všetkých kandidátov
                  </Link>
                </Button>
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href="/employer/settings">
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
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium mb-1">✨ Použite AI matching</p>
                  <p className="text-muted-foreground text-xs">
                    Naša AI automaticky vyhodnotí kandidátov a priradí im skóre zhody
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium mb-1">📝 Detailný popis pozície</p>
                  <p className="text-muted-foreground text-xs">
                    Presné popisy pozícií priťahujú kvalitnejších kandidátov
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium mb-1">⚡ Rýchla reakcia</p>
                  <p className="text-muted-foreground text-xs">
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
