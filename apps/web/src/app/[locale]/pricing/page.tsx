'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'

export default function PricingPage({ params }: { params: { locale: string } }) {
  const t = useTranslations()
  const locale = params.locale

  const plans = [
    {
      name: 'Starter',
      price: '0',
      period: 'mesiac',
      description: 'Pre malé firmy a začiatočníkov',
      features: [
        '1 aktívna pozícia',
        'Základné AI matching',
        'Email notifikácie',
        '30 dní viditeľnosť',
        'Základná štatistika',
      ],
      cta: 'Začať zadarmo',
      popular: false,
    },
    {
      name: 'Professional',
      price: '99',
      period: 'mesiac',
      description: 'Pre rastúce spoločnosti',
      features: [
        '10 aktívnych pozícií',
        'Pokročilé AI matching',
        'Neobmedzené prihlášky',
        '60 dní viditeľnosť',
        'Pokročilá analytika',
        'CV parsing s AI',
        'Email šablóny',
        'Prioritná podpora',
      ],
      cta: 'Vyskúšať 14 dní zadarmo',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'Pre veľké organizácie',
      features: [
        'Neobmedzené pozície',
        'Vlastný AI model',
        'Dedikovaný account manager',
        'Neobmedzená viditeľnosť',
        'Custom integrácie',
        'Advanced API prístup',
        'White-label riešenie',
        'SLA 99.9%',
        'Custom reporting',
      ],
      cta: 'Kontaktovať predaj',
      popular: false,
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Cenník</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Vyberte si plán, ktorý najlepšie vyhovuje vašim náborovým potrebám
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
                  <Badge className="bg-primary">Najobľúbenejšie</Badge>
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
                  asChild
                >
                  <Link href={`/${locale}/signup`}>{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features Comparison */}
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Porovnanie funkcií</CardTitle>
              <CardDescription>
                Všetky plány obsahujú základné funkcie JobSphere
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="font-medium">Funkcia</div>
                  <div className="font-medium text-right">Všetky plány</div>
                </div>
                <div className="border-t pt-4 space-y-3">
                  {[
                    'Multilingválna podpora (5 jazykov)',
                    'Mobilná aplikácia',
                    'Bezpečné úložisko CV',
                    'GDPR compliance',
                    'Kandidátska databáza',
                    '24/7 technická podpora',
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
          <h2 className="text-3xl font-bold text-center mb-8">Často kladené otázky</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Môžem kedykoľvek zmeniť plán?</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Áno, môžete kedykoľvek prejsť na vyšší alebo nižší plán. Zmeny sa prejavia
                okamžite.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ako funguje 14-dňová skúšobná doba?</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Môžete vyskúšať Professional plán 14 dní zadarmo bez potreby platobnej karty.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Aké platobné metódy akceptujete?</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Akceptujeme kreditné karty (Visa, Mastercard), bankový prevod a faktúru pre
                Enterprise klientov.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Je možné získať refund?</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Áno, ponúkame 30-dňovú záruku vrátenia peňazí bez udania dôvodu.
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <h2 className="text-3xl font-bold mb-4">Pripravení začať?</h2>
          <p className="text-muted-foreground mb-8">
            Pripojte sa k stovkám spoločností, ktoré nám dôverujú
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href={`/${locale}/signup`}>Začať zadarmo</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={`/${locale}/login`}>Prihlásiť sa</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
