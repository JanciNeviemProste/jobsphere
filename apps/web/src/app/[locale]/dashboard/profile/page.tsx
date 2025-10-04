'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Upload, User, Briefcase, MapPin, Mail, Phone } from 'lucide-react'

export default function ProfilePage({ params }: { params: { locale: string } }) {
  const t = useTranslations()
  const locale = params.locale
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href={`/${locale}/dashboard`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Späť na dashboard
          </Link>
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Môj profil</h1>
          <p className="text-muted-foreground">Spravujte svoje osobné informácie a nastavenia</p>
        </div>

        <div className="space-y-6">
          {/* Personal Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Osobné informácie
              </CardTitle>
              <CardDescription>Vaše základné údaje</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Krstné meno</Label>
                    <Input id="firstName" defaultValue="Ján" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Priezvisko</Label>
                    <Input id="lastName" defaultValue="Novák" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" defaultValue="jan.novak@example.com" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefón</Label>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <Input id="phone" type="tel" defaultValue="+421 900 123 456" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Lokalita</Label>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Input id="location" defaultValue="Bratislava, Slovakia" />
                  </div>
                </div>

                <Button type="submit" disabled={saving}>
                  {saving ? 'Ukladá sa...' : 'Uložiť zmeny'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* CV Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                CV / Životopis
              </CardTitle>
              <CardDescription>Nahratie vášho životopisu pre uchádzanie sa o prácu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-2">
                  Pretiahnite sem váš CV alebo kliknite pre výber
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  PDF, DOC, DOCX (max. 5MB)
                </p>
                <Button variant="outline">Vybrať súbor</Button>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-sm">CV_Jan_Novak_2024.pdf</p>
                    <p className="text-xs text-muted-foreground">Nahrané 1.10.2024 • 245 KB</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">Zobraziť</Button>
                    <Button size="sm" variant="ghost">Odstrániť</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Work Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Preferencie práce</CardTitle>
              <CardDescription>Pomôžte nám nájsť vhodnú prácu pre vás</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Preferovaná pozícia</Label>
                  <Input id="jobTitle" defaultValue="Senior React Developer" />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="minSalary">Minimálny plat (€/mesiac)</Label>
                    <Input id="minSalary" type="number" defaultValue="3000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxSalary">Maximálny plat (€/mesiac)</Label>
                    <Input id="maxSalary" type="number" defaultValue="5000" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Preferovaný pracovný režim</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm">Remote</Button>
                    <Button type="button" variant="default" size="sm">Hybrid</Button>
                    <Button type="button" variant="outline" size="sm">Onsite</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skills">Kľúčové zručnosti (oddelené čiarkou)</Label>
                  <Input
                    id="skills"
                    defaultValue="React, TypeScript, Next.js, Node.js, GraphQL"
                    placeholder="React, TypeScript, Node.js..."
                  />
                </div>

                <Button type="submit">Uložiť preferencie</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
