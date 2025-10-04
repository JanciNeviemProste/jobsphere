'use client'

import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { MapPin, Briefcase, Clock, Euro, Building2, ArrowLeft, Send } from 'lucide-react'
import Link from 'next/link'

// Mock data - neskôr bude z databázy
const MOCK_JOB_DATA: Record<string, any> = {
  '1': {
    id: '1',
    title: 'Senior React Developer',
    company: 'TechCorp SK',
    location: 'Bratislava, Slovakia',
    salary: '3000 - 5000',
    type: 'FULL_TIME',
    workMode: 'HYBRID',
    seniority: 'SENIOR',
    postedAt: '2 dni dozadu',
    description: `
## O pozícii

Hľadáme skúseného Senior React Developer, ktorý sa pridá k nášmu dynamickému tímu. Budete pracovať na najnovších projektoch využívajúcich moderné technológie.

## Vaše úlohy

- Vývoj a údržba komplexných React aplikácií
- Spolupráca s dizajnérmi a backend vývojármi
- Code review a mentoring junior členov týmu
- Návrh architektúry frontend riešení
- Optimalizácia výkonu aplikácií

## Požadujeme

- 5+ rokov skúseností s React.js
- Skúsenosti s TypeScript, Next.js
- Znalosti state managementu (Redux, Zustand)
- Skúsenosti s testovaním (Jest, React Testing Library)
- Dobrá znalosť Git a CI/CD
- Komunikatívna angličtina

## Ponúkame

- Konkurenčný plat 3000 - 5000 € brutto
- Flexibilná pracovná doba
- Home office 2-3 dni v týždni
- Moderné technológie a nástroje
- Vzdelávanie a certifikácie
- Multisport karta
- Tímové akcie a eventy
    `.trim(),
  },
  '2': {
    id: '2',
    title: 'Frontend Developer',
    company: 'Digital Solutions',
    location: 'Praha, Czech Republic',
    salary: '2500 - 4000',
    type: 'FULL_TIME',
    workMode: 'REMOTE',
    seniority: 'MEDIOR',
    postedAt: '5 dní dozadu',
    description: `
## O nás

Digital Solutions je moderná IT spoločnosť zameraná na vývoj webových aplikácií pre klientov z celej Európy.

## Náplň práce

- Vývoj frontend riešení v React/Vue.js
- Implementácia dizajnu podľa Figma mockupov
- Spolupráca s produktovým tímom
- Účasť na denných stand-upoch

## Očakávame

- 2-4 roky praxe vo frontend vývoji
- Skúsenosti s React alebo Vue.js
- HTML, CSS, JavaScript/TypeScript
- Responsive dizajn a cross-browser kompatibilita
- Samostatnosť a iniciatíva

## Benefity

- 100% remote práca
- Flexibilný pracovný čas
- Práca na medzinárodných projektoch
- Vzdelávacie kurzy
- Káva a ovocie v kancelárii (Praha)
    `.trim(),
  },
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations()
  const jobId = params.id as string

  const job = MOCK_JOB_DATA[jobId]

  if (!job) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Pracovná ponuka nenájdená</h1>
          <Button asChild>
            <Link href="/jobs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Späť na ponuky
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const getWorkModeLabel = (mode: string) => {
    switch (mode) {
      case 'REMOTE': return t('jobs.remote')
      case 'HYBRID': return t('jobs.hybrid')
      case 'ONSITE': return t('jobs.onsite')
      default: return mode
    }
  }

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case 'FULL_TIME': return t('jobs.fullTime')
      case 'PART_TIME': return t('jobs.partTime')
      case 'CONTRACT': return t('jobs.contract')
      default: return type
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/jobs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Späť na ponuky
          </Link>
        </Button>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-3xl mb-2">{job.title}</CardTitle>
                    <CardDescription className="text-lg">{job.company}</CardDescription>
                  </div>
                  <Badge className="text-base px-4 py-2">{job.seniority}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Key Info */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Lokalita</p>
                      <p className="font-medium">{job.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Euro className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Plat</p>
                      <p className="font-medium">{job.salary} € / mesiac</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Typ úväzku</p>
                      <p className="font-medium">{getJobTypeLabel(job.type)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Režim práce</p>
                      <p className="font-medium">{getWorkModeLabel(job.workMode)}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Description */}
                <div className="prose prose-sm max-w-none">
                  {job.description.split('\n\n').map((section: string, idx: number) => {
                    if (section.startsWith('## ')) {
                      return (
                        <h2 key={idx} className="text-xl font-bold mt-6 mb-3">
                          {section.replace('## ', '')}
                        </h2>
                      )
                    }
                    if (section.startsWith('- ')) {
                      const items = section.split('\n')
                      return (
                        <ul key={idx} className="list-disc list-inside space-y-1 mb-4">
                          {items.map((item, i) => (
                            <li key={i}>{item.replace('- ', '')}</li>
                          ))}
                        </ul>
                      )
                    }
                    return (
                      <p key={idx} className="mb-4">
                        {section}
                      </p>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-4">
              {/* Apply Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Uchádzať sa o pozíciu</CardTitle>
                  <CardDescription>
                    Odošlite svoju prihlášku a my sa vám ozveme
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" size="lg">
                    <Send className="mr-2 h-4 w-4" />
                    Odoslať prihlášku
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Musíte byť prihlásený, aby ste sa mohli uchádzať o túto pozíciu
                  </p>
                </CardContent>
              </Card>

              {/* Company Info */}
              <Card>
                <CardHeader>
                  <CardTitle>O spoločnosti</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{job.company}</p>
                      <p className="text-sm text-muted-foreground">IT & Software</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Veľkosť:</span>
                      <span className="font-medium">50-200 zamestnancov</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Založená:</span>
                      <span className="font-medium">2015</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Webstránka:</span>
                      <a href="#" className="font-medium text-primary hover:underline">
                        techcorp.sk
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Posted Time */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Pridané {job.postedAt}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
