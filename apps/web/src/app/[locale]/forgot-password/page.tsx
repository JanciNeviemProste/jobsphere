'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage({ params }: { params: { locale: string } }) {
  const t = useTranslations()
  const locale = params.locale
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))

    setLoading(false)
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-green-100 p-6">
                <CheckCircle className="h-16 w-16 text-green-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-4">Email odoslaný!</h1>
            <p className="text-muted-foreground mb-8">
              Poslali sme vám email s inštrukciami na obnovenie hesla na adresu{' '}
              <strong>{email}</strong>
            </p>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nenašli ste email? Skontrolujte spam folder.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSent(false)
                  setEmail('')
                }}
              >
                Odoslať znova
              </Button>
              <div className="text-sm">
                <Link href={`/${locale}/login`} className="text-primary hover:underline">
                  Späť na prihlásenie
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="w-fit -ml-2">
            <Link href={`/${locale}/login`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Späť
            </Link>
          </Button>
          <CardTitle className="text-2xl font-bold">Zabudnuté heslo</CardTitle>
          <CardDescription>
            Zadajte váš email a pošleme vám link na obnovenie hesla
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="vas@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="pl-10"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Odosiela sa...' : 'Odoslať reset link'}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Máte účet?{' '}
              <Link href={`/${locale}/login`} className="text-primary hover:underline">
                Prihlásiť sa
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
