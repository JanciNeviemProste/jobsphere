import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  Globe2,
  FileText,
  ClipboardCheck,
  Mail,
  BarChart3,
  MapPin,
  Briefcase,
  Clock
} from 'lucide-react'

export default function HomePage() {
  const t = useTranslations()

  const features = [
    {
      icon: Sparkles,
      title: t('features.aiMatching.title'),
      description: t('features.aiMatching.description'),
    },
    {
      icon: Globe2,
      title: t('features.multiLingual.title'),
      description: t('features.multiLingual.description'),
    },
    {
      icon: FileText,
      title: t('features.smartCV.title'),
      description: t('features.smartCV.description'),
    },
    {
      icon: ClipboardCheck,
      title: t('features.assessments.title'),
      description: t('features.assessments.description'),
    },
    {
      icon: Mail,
      title: t('features.emailAutomation.title'),
      description: t('features.emailAutomation.description'),
    },
    {
      icon: BarChart3,
      title: t('features.analytics.title'),
      description: t('features.analytics.description'),
    },
  ]

  const sampleJobs = [
    {
      id: 1,
      title: 'Senior Full-Stack Developer',
      company: 'TechCorp',
      location: 'Bratislava, Slovakia',
      type: 'fullTime',
      remote: true,
      salary: '€4,000 - €6,000',
    },
    {
      id: 2,
      title: 'Product Manager',
      company: 'StartupHub',
      location: 'Prague, Czech Republic',
      type: 'fullTime',
      remote: false,
      salary: '€3,500 - €5,000',
    },
    {
      id: 3,
      title: 'UX/UI Designer',
      company: 'DesignStudio',
      location: 'Warsaw, Poland',
      type: 'contract',
      remote: true,
      salary: '€3,000 - €4,500',
    },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background py-20 sm:py-32">
        <div className="container relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              {t('hero.title')}
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
              {t('hero.subtitle')}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/jobs">{t('hero.ctaPrimary')}</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/for-employers">{t('hero.ctaSecondary')}</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Decorative gradient */}
        <div className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary to-primary/30 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 sm:py-32">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
              {t('features.title')}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {t('features.subtitle')}
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 transition-all hover:border-primary/50 hover:shadow-lg">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Job Listings Section */}
      <section className="bg-muted/30 py-20 sm:py-32">
        <div className="container">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t('jobs.title')}
              </h2>
            </div>
            <Button variant="outline" asChild>
              <Link href="/jobs">{t('jobs.viewAll')}</Link>
            </Button>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sampleJobs.map((job) => (
              <Card key={job.id} className="transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{job.title}</CardTitle>
                      <CardDescription className="mt-1 text-base">
                        {job.company}
                      </CardDescription>
                    </div>
                    {job.remote && (
                      <Badge variant="secondary">{t('jobs.remote')}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {job.location}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Briefcase className="h-4 w-4" />
                      {t(`jobs.${job.type}`)}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="h-4 w-4" />
                      {job.salary}
                    </div>
                    <Button className="w-full mt-4" variant="outline" asChild>
                      <Link href={`/jobs/${job.id}`}>View Details</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-32">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Ready to get started?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Join thousands of companies and candidates using JobSphere
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/signup">{t('nav.signup')}</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/pricing">{t('nav.pricing')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
