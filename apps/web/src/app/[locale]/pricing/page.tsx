'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Loader2 } from 'lucide-react'

export default function PricingPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('pricing')
  const locale = params.locale
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleSubscribe(planId: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE') {
    if (planId === 'STARTER') {
      router.push(`/${locale}/signup`)
      return
    }

    if (planId === 'ENTERPRISE') {
      window.location.href = 'mailto:sales@jobsphere.eu'
      return
    }

    try {
      setLoading(planId)

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })

      if (response.ok) {
        const { url } = await response.json()
        window.location.href = url
      } else {
        const error = await response.json()
        if (response.status === 401) {
          router.push(`/${locale}/signup?plan=${planId}`)
        } else {
          alert(error.error || 'Failed to start checkout')
        }
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Failed to start checkout')
    } finally {
      setLoading(null)
    }
  }

  const plans = [
    {
      name: t('plans.starter.name'),
      price: '0',
      period: t('plans.starter.period'),
      description: t('plans.starter.description'),
      features: [
        t('plans.starter.features.positions'),
        t('plans.starter.features.aiMatching'),
        t('plans.starter.features.emailNotifications'),
        t('plans.starter.features.visibility'),
        t('plans.starter.features.basicStats'),
      ],
      cta: t('plans.starter.cta'),
      popular: false,
    },
    {
      name: t('plans.pro.name'),
      price: '99',
      period: t('plans.pro.period'),
      description: t('plans.pro.description'),
      features: [
        t('plans.pro.features.positions'),
        t('plans.pro.features.advancedAi'),
        t('plans.pro.features.unlimitedApplications'),
        t('plans.pro.features.visibility'),
        t('plans.pro.features.advancedAnalytics'),
        t('plans.pro.features.cvParsing'),
        t('plans.pro.features.emailTemplates'),
        t('plans.pro.features.prioritySupport'),
      ],
      cta: t('plans.pro.cta'),
      popular: true,
    },
    {
      name: t('plans.enterprise.name'),
      price: t('plans.enterprise.price'),
      period: '',
      description: t('plans.enterprise.description'),
      features: [
        t('plans.enterprise.features.unlimitedPositions'),
        t('plans.enterprise.features.customAi'),
        t('plans.enterprise.features.accountManager'),
        t('plans.enterprise.features.unlimitedVisibility'),
        t('plans.enterprise.features.customIntegrations'),
        t('plans.enterprise.features.apiAccess'),
        t('plans.enterprise.features.whiteLabel'),
        t('plans.enterprise.features.sla'),
        t('plans.enterprise.features.customReporting'),
      ],
      cta: t('plans.enterprise.cta'),
      popular: false,
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto mb-16">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col ${
                plan.popular ? 'border-primary shadow-lg scale-105' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary">{t('popular')}</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    {plan.price === 'Custom' ? plan.price : `€${plan.price}`}
                  </span>
                  {plan.period && (
                    <span className="text-muted-foreground"> / {plan.period}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-3 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={() => handleSubscribe(plan.name.toUpperCase() as 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE')}
                  disabled={loading === plan.name.toUpperCase()}
                >
                  {loading === plan.name.toUpperCase() ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t('loading')}
                    </>
                  ) : (
                    plan.cta
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features Comparison */}
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>{t('comparison.title')}</CardTitle>
              <CardDescription>
                {t('comparison.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="font-medium">{t('comparison.featureColumn')}</div>
                  <div className="font-medium text-right">{t('comparison.allPlansColumn')}</div>
                </div>
                <div className="border-t pt-4 space-y-3">
                  {[
                    t('comparison.features.multilingual'),
                    t('comparison.features.mobileApp'),
                    t('comparison.features.cvStorage'),
                    t('comparison.features.gdpr'),
                    t('comparison.features.database'),
                    t('comparison.features.support247'),
                  ].map((feature) => (
                    <div key={feature} className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-muted-foreground">{feature}</div>
                      <div className="text-right">
                        <Check className="h-5 w-5 text-primary inline" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <div className="max-w-4xl mx-auto mt-16">
          <h2 className="text-3xl font-bold text-center mb-8">{t('faq.title')}</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('faq.q1.question')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {t('faq.q1.answer')}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('faq.q2.question')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {t('faq.q2.answer')}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('faq.q3.question')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {t('faq.q3.answer')}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('faq.q4.question')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {t('faq.q4.answer')}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <h2 className="text-3xl font-bold mb-4">{t('cta.title')}</h2>
          <p className="text-muted-foreground mb-8">
            {t('cta.subtitle')}
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href={`/${locale}/signup`}>{t('cta.startFree')}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={`/${locale}/login`}>{t('cta.login')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
