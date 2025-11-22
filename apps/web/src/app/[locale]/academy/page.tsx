import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  GraduationCap,
  FileText,
  Target,
  MessageSquare,
  Search,
  Linkedin,
  TrendingUp,
  Sparkles,
  CheckCircle,
  Clock,
  ArrowRight
} from 'lucide-react'

// Academy modules data
const academyModules = [
  {
    id: 'cv-basics',
    title: 'Ako napísať perfektný životopis',
    description: 'Naučte sa vytvoriť profesionálny CV, ktorý zaujme recruiterov a prejde cez ATS systémy.',
    icon: FileText,
    duration: '15 min',
    difficulty: 'Začiatočník',
    topics: ['Štruktúra CV', 'Kľúčové slová', 'Formátovanie', 'Časté chyby'],
    color: 'bg-blue-500'
  },
  {
    id: 'cover-letter',
    title: 'Motivačný list, ktorý predáva',
    description: 'Naučte sa písať motivačné listy, ktoré vás odlíšia od ostatných kandidátov.',
    icon: MessageSquare,
    duration: '12 min',
    difficulty: 'Začiatočník',
    topics: ['Personalizácia', 'Storytelling', 'Štruktúra', 'Volanie k akcii'],
    color: 'bg-green-500'
  },
  {
    id: 'job-search',
    title: 'Efektívne hľadanie práce',
    description: 'Stratégie a techniky pre systematické hľadanie vysnívanej práce.',
    icon: Search,
    duration: '18 min',
    difficulty: 'Začiatočník',
    topics: ['Job portály', 'Networking', 'Priame oslovenie', 'Sledovanie firiem'],
    color: 'bg-purple-500'
  },
  {
    id: 'linkedin',
    title: 'LinkedIn ako profesionál',
    description: 'Optimalizujte svoj LinkedIn profil a budujte svoju profesionálnu sieť.',
    icon: Linkedin,
    duration: '20 min',
    difficulty: 'Stredne pokročilý',
    topics: ['Headline a summary', 'Odporúčania', 'Contentt marketing', 'Networking tipy'],
    color: 'bg-sky-500'
  },
  {
    id: 'interview-prep',
    title: 'Príprava na pohovor',
    description: 'Komplexný sprievodca prípravou na pracovný pohovor - od výskumu po oblečenie.',
    icon: Target,
    duration: '25 min',
    difficulty: 'Stredne pokročilý',
    topics: ['Výskum firmy', 'Časté otázky', 'STAR metóda', 'Body language'],
    color: 'bg-orange-500'
  },
  {
    id: 'salary-negotiation',
    title: 'Vyjednávanie o plate',
    description: 'Naučte sa sebavedomě vyjednávať o plate a benefitoch.',
    icon: TrendingUp,
    duration: '15 min',
    difficulty: 'Pokročilý',
    topics: ['Výskum miezd', 'Timing', 'Argumentácia', 'Alternatívne benefity'],
    color: 'bg-emerald-500'
  },
  {
    id: 'personal-brand',
    title: 'Budovanie osobnej značky',
    description: 'Vytvorte si silnú profesionálnu značku, ktorá vás odlíši na trhu práce.',
    icon: Sparkles,
    duration: '22 min',
    difficulty: 'Pokročilý',
    topics: ['Online prítomnosť', 'Portfolio', 'Thought leadership', 'Konzistencia'],
    color: 'bg-pink-500'
  },
  {
    id: 'career-change',
    title: 'Zmena kariéry krok za krokom',
    description: 'Praktický sprievodca pre tých, ktorí chcú zmeniť odbor alebo profesiu.',
    icon: Target,
    duration: '30 min',
    difficulty: 'Pokročilý',
    topics: ['Sebahodnotenie', 'Transferable skills', 'Prekvalifikácia', 'Networking v novom odbore'],
    color: 'bg-amber-500'
  }
]

export default async function AcademyPage({
  params
}: {
  params: { locale: string }
}) {
  const t = await getTranslations()

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Hero Section */}
      <div className="bg-primary/5 border-b">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl">
            <Badge className="mb-4">
              <GraduationCap className="mr-1 h-3 w-3" />
              JobSphere Academy
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Nájdite si vysnívanú prácu
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Bezplatné vzdelávacie materiály, ktoré vám pomôžu zlepšiť vaše šance
              na pracovnom trhu. Od písania CV až po vyjednávanie o plate.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span>8 modulov</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-5 w-5 text-primary" />
                <span>~2 hodiny celkovo</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="h-5 w-5 text-primary" />
                <span>Úplne zadarmo</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-8">Vzdelávacie moduly</h2>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {academyModules.map((module, index) => {
            const Icon = module.icon
            return (
              <Card key={module.id} className="hover:shadow-lg transition-shadow group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-lg ${module.color} text-white`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <Badge variant="outline">{module.difficulty}</Badge>
                  </div>
                  <CardTitle className="mt-4 group-hover:text-primary transition-colors">
                    {module.title}
                  </CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Clock className="h-4 w-4" />
                    <span>{module.duration} čítania</span>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {module.topics.map(topic => (
                      <Badge key={topic} variant="secondary" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>

                  <Button asChild className="w-full">
                    <Link href={`/${params.locale}/academy/${module.id}`}>
                      Začať modul
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-12">
              <h3 className="text-2xl font-bold mb-4">Pripravený začať?</h3>
              <p className="text-muted-foreground max-w-xl mx-auto mb-6">
                Vytvorte si účet a sledujte svoj pokrok. Ukladajte si poznámky
                a vracajte sa k materiálom kedykoľvek potrebujete.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link href={`/${params.locale}/signup`}>
                    Vytvoriť účet
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href={`/${params.locale}/jobs`}>
                    Prehľadať práce
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
