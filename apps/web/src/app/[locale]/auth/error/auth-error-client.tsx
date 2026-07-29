'use client'

import { useSearchParams } from 'next/navigation'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react'

const errorMessages: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: 'Chyba konfigurácie',
    description: 'Nastala chyba v konfigurácii autentifikácie. Kontaktujte administrátora.',
  },
  AccessDenied: {
    title: 'Prístup zamietnutý',
    description: 'Nemáte oprávnenie na prístup k tejto stránke.',
  },
  Verification: {
    title: 'Chyba overenia',
    description: 'Odkaz na overenie vypršal alebo už bol použitý.',
  },
  OAuthSignin: {
    title: 'Chyba prihlásenia',
    description: 'Nepodarilo sa začať prihlásenie cez externého poskytovateľa.',
  },
  OAuthCallback: {
    title: 'Chyba prihlásenia',
    description: 'Nastala chyba pri spracovaní odpovede od poskytovateľa (Google, Microsoft).',
  },
  OAuthCreateAccount: {
    title: 'Chyba vytvorenia účtu',
    description: 'Nepodarilo sa vytvoriť účet pomocou externého poskytovateľa.',
  },
  EmailCreateAccount: {
    title: 'Chyba vytvorenia účtu',
    description: 'Nepodarilo sa vytvoriť účet s touto emailovou adresou.',
  },
  Callback: {
    title: 'Chyba prihlásenia',
    description: 'Nastala chyba pri spracovaní prihlásenia.',
  },
  OAuthAccountNotLinked: {
    title: 'Účet nie je prepojený',
    description:
      'Táto emailová adresa je už registrovaná s iným typom prihlásenia. Použite pôvodný spôsob prihlásenia.',
  },
  EmailSignin: {
    title: 'Chyba odoslania emailu',
    description: 'Nepodarilo sa odoslať prihlasovací email.',
  },
  CredentialsSignin: {
    title: 'Nesprávne prihlasovacie údaje',
    description: 'Email alebo heslo nie sú správne. Skúste to znova.',
  },
  SessionRequired: {
    title: 'Vyžaduje sa prihlásenie',
    description: 'Pre prístup k tejto stránke sa musíte prihlásiť.',
  },
  Default: {
    title: 'Chyba autentifikácie',
    description: 'Nastala neočakávaná chyba. Skúste to znova.',
  },
}

export default function AuthErrorClient() {
  const searchParams = useSearchParams()
  const params = useParams()
  const locale = (params?.locale as string) || 'sk'
  const error = searchParams.get('error') || 'Default'

  const errorInfo = errorMessages[error] || errorMessages.Default

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">{errorInfo.title}</CardTitle>
          <CardDescription className="text-base">{errorInfo.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error === 'OAuthAccountNotLinked' && (
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="mb-2 font-medium">Čo to znamená?</p>
              <p className="text-muted-foreground">
                Váš email je už registrovaný pomocou hesla. Prihláste sa pomocou emailu a hesla,
                alebo použite funkciu &quot;Zabudnuté heslo&quot;.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href={`/${locale}/login`}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Skúsiť znova
              </Link>
            </Button>

            <Button variant="outline" asChild className="w-full">
              <Link href={`/${locale}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Späť na hlavnú stránku
              </Link>
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 rounded-lg bg-muted p-3 text-xs">
              <p className="font-mono text-muted-foreground">Debug: error={error}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
