import Link from 'next/link'
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
  const features = [
    {
      icon: Users,
      title: 'Nájdite tých správnych kandidátov',
      description: 'Prístup k tisíckam kvalifikovaných profesionálov hľadajúcich nové príležitosti.'
    },
    {
      icon: Target,
      title: 'AI-Powered Matching',
      description: 'Naša AI technológia automaticky vyhodnotí a priradí najlepších kandidátov k vašim pozíciám.'
    },
    {
      icon: Zap,
      title: 'Rýchly nábor',
      description: 'Zrýchlite proces náboru s našimi automatizovanými nástrojmi a workflow.'
    },
    {
      icon: BarChart3,
      title: 'Prehľadné štatistiky',
      description: 'Sledujte výkonnosť vašich inzerátov a optimalizujte náborový proces.'
    },
    {
      icon: Clock,
      title: 'Ušetrite čas',
      description: 'Automatizácia rutinných úloh vám ušetrí hodiny času každý týždeň.'
    },
    {
      icon: Shield,
      title: 'Bezpečné a spoľahlivé',
      description: 'Enterprise-level bezpečnosť pre ochranu vašich dát a kandidátov.'
    }
  ]

  const benefits = [
    'Neomedzený počet aktívnych pozícií',
    'AI vyhodnotenie kandidátov',
    'Prístup k databáze kandidátov',
    'Vlastné náborové workflow',
    'Team collaboration nástroje',
    'Pokročilá analytika a reporty',
    'Integrácie s HR systémami',
    'Prioritná zákaznícka podpora'
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-white to-white py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl font-bold mb-6 text-foreground leading-tight">
                Nájdite najlepších kandidátov rýchlejšie
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                JobSphere je moderný ATS systém, ktorý vám pomôže efektívne spravovať náborový proces
                a nájsť tých správnych ľudí pre váš tím.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="text-lg px-8" asChild>
                  <Link href={`/${params.locale}/signup`}>
                    Začať zadarmo
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8" asChild>
                  <Link href={`/${params.locale}/pricing`}>
                    Pozrieť ceny
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
                      <p className="font-semibold">234 aktívnych kandidátov</p>
                      <p className="text-sm text-muted-foreground">Dnes pribudlo +12</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Target className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">92% AI match score</p>
                      <p className="text-sm text-muted-foreground">Senior React Developer</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">3.2 dni priemerný čas</p>
                      <p className="text-sm text-muted-foreground">Od prihlášky po interview</p>
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
            <h2 className="text-4xl font-bold mb-4">Prečo vybrať JobSphere?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Všetko čo potrebujete pre efektívny nábor na jednom mieste
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
              <h2 className="text-4xl font-bold mb-6">Kompletný ATS systém</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Všetky funkcie, ktoré potrebujete na efektívne riadenie náborového procesu
                od začiatku až po úspešné prijatie kandidáta.
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
                  <h3 className="text-2xl font-bold mb-2">Starter</h3>
                  <p className="text-muted-foreground mb-4">Pre malé tímy</p>
                  <p className="text-4xl font-bold mb-4">Free</p>
                  <Button className="w-full" variant="outline" asChild>
                    <Link href={`/${params.locale}/signup`}>Začať zadarmo</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card className="border-2 border-primary shadow-lg">
                <CardContent className="p-6">
                  <div className="bg-primary text-primary-foreground text-sm font-semibold px-3 py-1 rounded-full inline-block mb-2">
                    Najpopulárnejšie
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Professional</h3>
                  <p className="text-muted-foreground mb-4">Pre rastúce firmy</p>
                  <p className="text-4xl font-bold mb-4">€99<span className="text-lg text-muted-foreground">/mes</span></p>
                  <Button className="w-full" asChild>
                    <Link href={`/${params.locale}/signup`}>Vyskúšať 14 dní zadarmo</Link>
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
          <h2 className="text-4xl font-bold mb-6">Pripravení začať?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Pridajte sa k stovkám spoločností, ktoré už používajú JobSphere pre efektívnejší nábor.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8" asChild>
              <Link href={`/${params.locale}/signup`}>
                Vytvoriť účet zadarmo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8" asChild>
              <Link href={`/${params.locale}/login`}>
                Už máte účet? Prihlásiť sa
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
