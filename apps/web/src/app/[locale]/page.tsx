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

export default function HomePage({ params }: { params: { locale: string } }) {
  const t = useTranslations()
  const locale = params.locale

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
    <div className="flex min-h-screen flex-col bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-white to-white py-24 sm:py-32">
        <div className="container relative z-10">
          <div className="mx-auto max-w-5xl text-center">
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl text-foreground leading-tight">
              {t('hero.title')}
            </h1>
            <p className="mt-8 text-xl leading-relaxed text-muted-foreground sm:text-2xl max-w-3xl mx-auto">
              {t('hero.subtitle')}
            </p>
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="px-8 py-6 text-lg font-medium" asChild>
                <Link href={`/${locale}/jobs`}>{t('hero.ctaPrimary')}</Link>
              </Button>
              <Button size="lg" variant="outline" className="px-8 py-6 text-lg font-medium border-2" asChild>
                <Link href={`/${locale}/for-employers`}>{t('hero.ctaSecondary')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 sm:py-32 bg-white">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl text-foreground">
              {t('features.title')}
            </h2>
            <p className="mt-6 text-xl text-muted-foreground leading-relaxed">
              {t('features.subtitle')}
            </p>
          </div>

          <div className="mx-auto mt-20 grid max-w-6xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 transition-all hover:border-primary/50 hover:shadow-xl bg-white">
                <CardHeader>
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-xl font-semibold">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
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
              <Link href={`/${locale}/jobs`}>{t('jobs.viewAll')}</Link>
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
                      <Link href={`/${locale}/jobs/${job.id}`}>View Details</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 sm:py-32 bg-gradient-to-br from-primary/5 to-white">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl text-foreground">
              Ready to get started?
            </h2>
            <p className="mt-6 text-xl text-muted-foreground leading-relaxed">
              Join thousands of companies and candidates using JobSphere
            </p>
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="px-8 py-6 text-lg font-medium" asChild>
                <Link href={`/${locale}/signup`}>{t('nav.signup')}</Link>
              </Button>
              <Button size="lg" variant="outline" className="px-8 py-6 text-lg font-medium border-2" asChild>
                <Link href={`/${locale}/pricing`}>{t('nav.pricing')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
