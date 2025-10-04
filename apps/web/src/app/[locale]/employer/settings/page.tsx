'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Building2, Mail, Phone, MapPin, Globe } from 'lucide-react'

export default function EmployerSettingsPage({ params }: { params: { locale: string } }) {
  const t = useTranslations()
  const locale = params.locale
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href={`/${locale}/employer`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Späť na dashboard
          </Link>
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Nastavenia spoločnosti</h1>
          <p className="text-muted-foreground">Spravujte informácie o vašej spoločnosti</p>
        </div>

        <div className="space-y-6">
          {/* Company Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Informácie o spoločnosti
              </CardTitle>
              <CardDescription>Základné údaje o vašej organizácii</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Názov spoločnosti *</Label>
                  <Input id="companyName" defaultValue="TechCorp SK" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Kontaktný email *</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" defaultValue="contact@techcorp.sk" required />
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
                  <Label htmlFor="location">Adresa</Label>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Input id="location" defaultValue="Bratislava, Slovakia" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Webstránka</Label>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <Input id="website" type="url" defaultValue="https://techcorp.sk" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Popis spoločnosti</Label>
                  <textarea
                    id="description"
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Krátky popis vašej spoločnosti..."
                    defaultValue="Moderná IT spoločnosť zameraná na vývoj inovatívnych riešení."
                  />
                </div>

                <Button type="submit" disabled={saving}>
                  {saving ? 'Ukladá sa...' : 'Uložiť zmeny'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Billing */}
          <Card>
            <CardHeader>
              <CardTitle>Fakturácia a platba</CardTitle>
              <CardDescription>Spravujte vaše predplatné a platobné metódy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-semibold">Professional Plan</p>
                  <p className="text-sm text-muted-foreground">€99 / mesiac</p>
                </div>
                <Button variant="outline" size="sm">Zmeniť plán</Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="font-medium">Platobná metóda</p>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-12 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center text-white text-xs font-bold">
                      VISA
                    </div>
                    <div>
                      <p className="text-sm">•••• •••• •••• 4242</p>
                      <p className="text-xs text-muted-foreground">Expires 12/25</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Upraviť</Button>
                </div>
              </div>

              <Button variant="outline" className="w-full">Zobraziť faktúry</Button>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Notifikácie</CardTitle>
              <CardDescription>Spravujte, ako a kedy chcete dostávať notifikácie</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email notifikácie</p>
                  <p className="text-sm text-muted-foreground">Dostávajte emaily o nových prihlásenkach</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Týždenný report</p>
                  <p className="text-sm text-muted-foreground">Sumár aktivity každý pondelok</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Marketing emaily</p>
                  <p className="text-sm text-muted-foreground">Tipy a novinky o JobSphere</p>
                </div>
                <input type="checkbox" className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Nebezpečná zóna</CardTitle>
              <CardDescription>Nezvratné akcie pre váš účet</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-destructive/50 rounded-lg">
                <div>
                  <p className="font-medium">Zrušiť predplatné</p>
                  <p className="text-sm text-muted-foreground">
                    Stratíte prístup k premium funkciám
                  </p>
                </div>
                <Button variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground">
                  Zrušiť
                </Button>
              </div>
              <div className="flex items-center justify-between p-4 border border-destructive/50 rounded-lg">
                <div>
                  <p className="font-medium">Zmazať účet</p>
                  <p className="text-sm text-muted-foreground">
                    Permanentne zmazať všetky dáta
                  </p>
                </div>
                <Button variant="destructive" size="sm">
                  Zmazať účet
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
