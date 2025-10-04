'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Upload, Send, FileText, CheckCircle } from 'lucide-react'
import Link from 'next/link'

// Mock job data
const MOCK_JOB = {
  id: '1',
  title: 'Senior React Developer',
  company: 'TechCorp SK',
  location: 'Bratislava, Slovakia',
}

export default function ApplyPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations()
  const jobId = params.id as string
  const locale = params.locale as string

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    coverLetter: '',
    cvFile: null as File | null,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, cvFile: e.target.files[0] })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      let cvUrl = null

      // Upload CV file if provided
      if (formData.cvFile) {
        const uploadFormData = new FormData()
        uploadFormData.append('file', formData.cvFile)

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData,
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload CV')
        }

        const uploadData = await uploadResponse.json()
        cvUrl = uploadData.url
      }

      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          coverLetter: formData.coverLetter,
          cvUrl,
          expectedSalary: null,
          availableFrom: null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit application')
      }

      setSubmitting(false)
      setSubmitted(true)

      // Redirect after 3 seconds
      setTimeout(() => {
        router.push(`/${locale}/dashboard`)
      }, 3000)
    } catch (error) {
      console.error('Error submitting application:', error)
      alert('Nepodarilo sa odoslať prihlášku. Skúste to prosím znova.')
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="flex justify-center mb-6">
                <div className="rounded-full bg-green-100 p-6">
                  <CheckCircle className="h-16 w-16 text-green-600" />
                </div>
              </div>
              <h1 className="text-3xl font-bold mb-4">Prihláška úspešne odoslaná!</h1>
              <p className="text-muted-foreground mb-8">
                Vaša prihláška na pozíciu <strong>{MOCK_JOB.title}</strong> v spoločnosti{' '}
                <strong>{MOCK_JOB.company}</strong> bola odoslaná.
              </p>
              <p className="text-sm text-muted-foreground mb-8">
                Budete presmerovaný na dashboard...
              </p>
              <div className="flex gap-4 justify-center">
                <Button asChild>
                  <Link href={`/${locale}/dashboard`}>Prejsť na dashboard</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/${locale}/jobs`}>Hľadať ďalšie ponuky</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href={`/${locale}/jobs/${jobId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Späť na ponuku
          </Link>
        </Button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Uchádzať sa o pozíciu</h1>
          <p className="text-muted-foreground">
            {MOCK_JOB.title} v {MOCK_JOB.company}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle>Osobné údaje</CardTitle>
                <CardDescription>Základné informácie o vás</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Krstné meno *</Label>
                    <Input
                      id="firstName"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="Ján"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Priezvisko *</Label>
                    <Input
                      id="lastName"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Novák"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jan.novak@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefón *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+421 900 123 456"
                  />
                </div>
              </CardContent>
            </Card>

            {/* CV Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Životopis (CV) *</CardTitle>
                <CardDescription>Nahrajte váš najnovší životopis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                    {formData.cvFile ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{formData.cvFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(formData.cvFile.size / 1024).toFixed(2)} KB
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setFormData({ ...formData, cvFile: null })}
                        >
                          Odstrániť
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mb-2">
                          Pretiahnite sem váš CV alebo kliknite pre výber
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">
                          PDF, DOC, DOCX (max. 5MB)
                        </p>
                        <label htmlFor="cv-upload">
                          <Button type="button" variant="outline" asChild>
                            <span>
                              <Upload className="mr-2 h-4 w-4" />
                              Vybrať súbor
                            </span>
                          </Button>
                        </label>
                        <input
                          id="cv-upload"
                          type="file"
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          onChange={handleFileChange}
                          required
                        />
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cover Letter */}
            <Card>
              <CardHeader>
                <CardTitle>Motivačný list</CardTitle>
                <CardDescription>Voliteľne - napíšte, prečo ste vhodný kandidát</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="coverLetter">Správa pre zamestnávateľa</Label>
                  <textarea
                    id="coverLetter"
                    rows={8}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Napíšte, prečo ste vhodný pre túto pozíciu..."
                    value={formData.coverLetter}
                    onChange={(e) => setFormData({ ...formData, coverLetter: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.coverLetter.length} / 2000 znakov
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">
                      Odoslaním prihlášky súhlasíte so spracovaním vašich osobných údajov v súlade s{' '}
                      <Link href="/privacy" className="text-primary hover:underline">
                        Ochranou súkromia
                      </Link>{' '}
                      a{' '}
                      <Link href="/terms" className="text-primary hover:underline">
                        Podmienkami používania
                      </Link>
                      .
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <Button type="submit" className="flex-1" disabled={submitting}>
                      {submitting ? (
                        'Odosiela sa...'
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Odoslať prihlášku
                        </>
                      )}
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link href={`/${locale}/jobs/${jobId}`}>Zrušiť</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </div>
  )
}
