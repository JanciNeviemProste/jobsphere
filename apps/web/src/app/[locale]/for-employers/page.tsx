import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Users,
  Target,
  Zap,
  BarChart3,
  Clock,
  Shield,
  CheckCircle,
  ArrowRight
} from 'lucide-react'

export default function ForEmployersPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('forEmployers')
  const features = [
    {
      icon: Users,
      title: t('features.findCandidates.title'),
      description: t('features.findCandidates.description')
    },
    {
      icon: Target,
      title: t('features.aiMatching.title'),
      description: t('features.aiMatching.description')
    },
    {
      icon: Zap,
      title: t('features.fastRecruitment.title'),
      description: t('features.fastRecruitment.description')
    },
    {
      icon: BarChart3,
      title: t('features.analytics.title'),
      description: t('features.analytics.description')
    },
    {
      icon: Clock,
      title: t('features.saveTime.title'),
      description: t('features.saveTime.description')
    },
    {
      icon: Shield,
      title: t('features.secure.title'),
      description: t('features.secure.description')
    }
  ]

  const benefits = [
    t('benefits.list.unlimited'),
    t('benefits.list.aiEvaluation'),
    t('benefits.list.database'),
    t('benefits.list.workflow'),
    t('benefits.list.collaboration'),
    t('benefits.list.analytics'),
    t('benefits.list.integrations'),
    t('benefits.list.support')
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-white to-white py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl font-bold mb-6 text-foreground leading-tight">
                {t('hero.title')}
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                {t('hero.subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="text-lg px-8" asChild>
                  <Link href={`/${params.locale}/signup`}>
                    {t('hero.cta.start')}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8" asChild>
                  <Link href={`/${params.locale}/pricing`}>
                    {t('hero.cta.pricing')}
                  </Link>
                </Button>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="bg-white rounded-2xl shadow-2xl p-8 border">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{t('hero.stats.candidates')}</p>
                      <p className="text-sm text-muted-foreground">{t('hero.stats.today')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Target className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{t('hero.stats.aiMatch')}</p>
                      <p className="text-sm text-muted-foreground">{t('hero.stats.position')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{t('hero.stats.avgTime')}</p>
                      <p className="text-sm text-muted-foreground">{t('hero.stats.process')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('whyUs.title')}</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('whyUs.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
                <CardContent className="pt-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">{t('benefits.title')}</h2>
              <p className="text-lg text-muted-foreground mb-8">
                {t('benefits.subtitle')}
              </p>
              <div className="space-y-3">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-lg">{benefit}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <Card className="border-2">
                <CardContent className="p-6">
                  <h3 className="text-2xl font-bold mb-2">{t('plans.starter.name')}</h3>
                  <p className="text-muted-foreground mb-4">{t('plans.starter.description')}</p>
                  <p className="text-4xl font-bold mb-4">{t('plans.starter.price')}</p>
                  <Button className="w-full" variant="outline" asChild>
                    <Link href={`/${params.locale}/signup`}>{t('plans.starter.cta')}</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card className="border-2 border-primary shadow-lg">
                <CardContent className="p-6">
                  <div className="bg-primary text-primary-foreground text-sm font-semibold px-3 py-1 rounded-full inline-block mb-2">
                    {t('plans.pro.popular')}
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{t('plans.pro.name')}</h3>
                  <p className="text-muted-foreground mb-4">{t('plans.pro.description')}</p>
                  <p className="text-4xl font-bold mb-4">{t('plans.pro.price')}<span className="text-lg text-muted-foreground">{t('plans.pro.period')}</span></p>
                  <Button className="w-full" asChild>
                    <Link href={`/${params.locale}/signup`}>{t('plans.pro.cta')}</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold mb-6">{t('cta.title')}</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t('cta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8" asChild>
              <Link href={`/${params.locale}/signup`}>
                {t('cta.create')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8" asChild>
              <Link href={`/${params.locale}/login`}>
                {t('cta.login')}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
