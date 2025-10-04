'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'

export default function NewJobPage({ params }: { params: { locale: string } }) {
  const t = useTranslations()
  const router = useRouter()
  const locale = params.locale
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    location: '',
    minSalary: '',
    maxSalary: '',
    workMode: 'HYBRID',
    jobType: 'FULL_TIME',
    seniority: 'MEDIOR',
    description: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))

    setSaving(false)
    router.push(`/${locale}/employer`)
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
          <h1 className="text-3xl font-bold mb-2">Vytvoriť novú pozíciu</h1>
          <p className="text-muted-foreground">Pridajte detaily o pracovnej ponuke</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Základné informácie</CardTitle>
                <CardDescription>Názov a lokalita pozície</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Názov pozície *</Label>
                  <Input
                    id="title"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="napr. Senior React Developer"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Lokalita *</Label>
                  <Input
                    id="location"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="napr. Bratislava, Slovakia"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Job Details */}
            <Card>
              <CardHeader>
                <CardTitle>Detaily pozície</CardTitle>
                <CardDescription>Typ práce a požiadavky</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="workMode">Pracovný režim *</Label>
                    <select
                      id="workMode"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={formData.workMode}
                      onChange={(e) => setFormData({ ...formData, workMode: e.target.value })}
                    >
                      <option value="REMOTE">Remote</option>
                      <option value="HYBRID">Hybrid</option>
                      <option value="ONSITE">Onsite</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="jobType">Typ úväzku *</Label>
                    <select
                      id="jobType"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={formData.jobType}
                      onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}
                    >
                      <option value="FULL_TIME">Full-time</option>
                      <option value="PART_TIME">Part-time</option>
                      <option value="CONTRACT">Contract</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seniority">Seniority *</Label>
                  <select
                    id="seniority"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formData.seniority}
                    onChange={(e) => setFormData({ ...formData, seniority: e.target.value })}
                  >
                    <option value="JUNIOR">Junior</option>
                    <option value="MEDIOR">Medior</option>
                    <option value="SENIOR">Senior</option>
                    <option value="LEAD">Lead</option>
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="minSalary">Min. plat (€/mesiac)</Label>
                    <Input
                      id="minSalary"
                      type="number"
                      value={formData.minSalary}
                      onChange={(e) => setFormData({ ...formData, minSalary: e.target.value })}
                      placeholder="3000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxSalary">Max. plat (€/mesiac)</Label>
                    <Input
                      id="maxSalary"
                      type="number"
                      value={formData.maxSalary}
                      onChange={(e) => setFormData({ ...formData, maxSalary: e.target.value })}
                      placeholder="5000"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Popis pozície</CardTitle>
                <CardDescription>Podrobný popis práce a požiadaviek</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="description">Popis *</Label>
                  <textarea
                    id="description"
                    rows={12}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="## O pozícii&#10;&#10;Popis práce...&#10;&#10;## Požiadavky&#10;&#10;- Požiadavka 1&#10;- Požiadavka 2&#10;&#10;## Ponúkame&#10;&#10;- Benefit 1&#10;- Benefit 2"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Podporuje Markdown formátovanie
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <Button type="submit" className="flex-1" disabled={saving}>
                    {saving ? 'Ukladá sa...' : 'Vytvoriť pozíciu'}
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <Link href={`/${locale}/employer`}>Zrušiť</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </div>
  )
}
