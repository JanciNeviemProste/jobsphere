'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Briefcase, FileText, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

interface DashboardData {
  user: {
    name: string
    email: string
    avatarUrl?: string | null
  }
  stats: {
    total: number
    pending: number
    reviewing: number
    accepted: number
    rejected: number
  }
  profileCompletion: number
  profileSteps: {
    basicInfo: boolean
    cvUploaded: boolean
    skills: boolean
    preferences: boolean
  }
  applications: Array<{
    id: string
    jobTitle: string
    company: string
    companyLogo?: string | null
    status: string
    appliedAt: string
    location: string
    jobId: string
  }>
  recommendedJobs: Array<{
    id: string
    title: string
    company: string
    companyLogo?: string | null
    location: string
    salaryMin?: number | null
    salaryMax?: number | null
    type?: string | null
    match: number
  }>
}

interface DashboardClientProps {
  locale: string
  initialData: DashboardData
}

export default function DashboardClient({ locale, initialData }: DashboardClientProps) {
  const t = useTranslations()
  const { user, stats, profileCompletion, profileSteps, applications, recommendedJobs } =
    initialData

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" /> {t('dashboard.status.pending')}
          </Badge>
        )
      case 'REVIEWING':
        return (
          <Badge variant="default" className="gap-1">
            <AlertCircle className="h-3 w-3" /> {t('dashboard.status.reviewing')}
          </Badge>
        )
      case 'ACCEPTED':
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle2 className="h-3 w-3" /> {t('dashboard.status.accepted')}
          </Badge>
        )
      case 'REJECTED':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" /> {t('dashboard.status.rejected')}
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(locale === 'sk' ? 'sk-SK' : 'en-US')
  }

  const formatSalary = (min?: number | null, max?: number | null) => {
    if (!min && !max) return t('dashboard.salary.negotiable')
    if (min && max) return `${min} - ${max} €`
    if (min) return `${min}+ €`
    if (max) return `do ${max} €`
    return ''
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">{t('dashboard.welcome', { name: user.name })}</h1>
          <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>{t('dashboard.stats.total')}</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>{t('dashboard.stats.pending')}</CardDescription>
              <CardTitle className="text-3xl text-muted-foreground">{stats.pending}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>{t('dashboard.stats.reviewing')}</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{stats.reviewing}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>{t('dashboard.stats.accepted')}</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.accepted}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Applications */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('dashboard.applications.title')}</CardTitle>
                    <CardDescription>{t('dashboard.applications.subtitle')}</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/${locale}/jobs`}>{t('dashboard.applications.searchJobs')}</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className="flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold">{app.jobTitle}</h3>
                            <p className="text-sm text-muted-foreground">{app.company}</p>
                          </div>
                          {getStatusBadge(app.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{app.location}</span>
                          <span>•</span>
                          <span>
                            {t('dashboard.applications.appliedOn', {
                              date: formatDate(app.appliedAt),
                            })}
                          </span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/${locale}/jobs/${app.jobId}`}>
                          {t('dashboard.applications.viewJob')}
                        </Link>
                      </Button>
                    </div>
                  ))}

                  {applications.length === 0 && (
                    <div className="py-8 text-center">
                      <Briefcase className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                      <p className="mb-4 text-muted-foreground">
                        {t('dashboard.applications.empty')}
                      </p>
                      <Button asChild>
                        <Link href={`/${locale}/jobs`}>
                          {t('dashboard.applications.browseJobs')}
                        </Link>
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
                <CardTitle>{t('dashboard.profile.title')}</CardTitle>
                <CardDescription>{t('dashboard.profile.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{t('dashboard.profile.completion')}</span>
                    <span className="font-semibold">{profileCompletion}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${profileCompletion}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    {profileSteps.basicInfo ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={profileSteps.basicInfo ? '' : 'text-muted-foreground'}>
                      {t('dashboard.profile.steps.basicInfo')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {profileSteps.cvUploaded ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={profileSteps.cvUploaded ? '' : 'text-muted-foreground'}>
                      {t('dashboard.profile.steps.cv')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {profileSteps.skills ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={profileSteps.skills ? '' : 'text-muted-foreground'}>
                      {t('dashboard.profile.steps.skills')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {profileSteps.preferences ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={profileSteps.preferences ? '' : 'text-muted-foreground'}>
                      {t('dashboard.profile.steps.preferences')}
                    </span>
                  </div>
                </div>
                <Button className="w-full" asChild>
                  <Link href={`/${locale}/dashboard/cv`}>Moje CV</Link>
                </Button>
                <Button className="w-full" variant="outline" asChild>
                  <Link href={`/${locale}/dashboard/profile`}>
                    {t('dashboard.profile.complete')}
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Recommended Jobs */}
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.recommended.title')}</CardTitle>
                <CardDescription>{t('dashboard.recommended.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {recommendedJobs.map((job) => (
                  <div key={job.id} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold">{job.title}</h4>
                        <p className="text-xs text-muted-foreground">{job.company}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {job.match}% match
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {job.location} • {formatSalary(job.salaryMin, job.salaryMax)}
                    </p>
                    <Button size="sm" variant="outline" className="w-full" asChild>
                      <Link href={`/${locale}/jobs/${job.id}`}>
                        {t('dashboard.recommended.view')}
                      </Link>
                    </Button>
                  </div>
                ))}

                {recommendedJobs.length === 0 && (
                  <div className="py-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      {t('dashboard.recommended.empty')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
