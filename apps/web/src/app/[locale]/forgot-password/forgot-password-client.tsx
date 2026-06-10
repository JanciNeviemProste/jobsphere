'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { AlertCircle, ArrowLeft, Mail, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordClient({ params }: { params: { locale: string } }) {
  const t = useTranslations()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordData) => {
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, locale: params.locale }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send reset email')
      }

      setSubmittedEmail(data.email)
      setIsSuccess(true)
      toast.success('Reset email sent successfully!')
    } catch (error) {
      logger.error('Password reset error', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send reset email')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResend = () => {
    setIsSuccess(false)
    reset()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="mb-2 w-fit">
            <Link href={`/${params.locale}/login`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('auth.backToLogin')}
            </Link>
          </Button>
          <CardTitle className="text-2xl">{t('auth.forgotPassword.title')}</CardTitle>
          <CardDescription>{t('auth.forgotPassword.subtitle')}</CardDescription>
        </CardHeader>

        {isSuccess ? (
          <CardContent className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">{t('auth.forgotPassword.successTitle')}</h3>
            <p className="mb-2 text-muted-foreground">{t('auth.forgotPassword.successMessage')}</p>
            <p className="mb-6 font-medium">{submittedEmail}</p>
            <div className="space-y-2">
              <Button variant="outline" className="w-full" onClick={handleResend}>
                {t('auth.forgotPassword.resendEmail')}
              </Button>
              <Button asChild variant="default" className="w-full">
                <Link href={`/${params.locale}/login`}>{t('auth.backToLogin')}</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {t('auth.forgotPassword.checkSpam')}
            </p>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('auth.emailPlaceholder')}
                    className="pl-10"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p
                    role="alert"
                    aria-live="assertive"
                    className="flex items-center gap-1 text-sm text-destructive"
                  >
                    <AlertCircle className="h-3 w-3" aria-hidden="true" />
                    {errors.email.message}
                  </p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-2">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting
                  ? t('auth.forgotPassword.sending')
                  : t('auth.forgotPassword.sendResetLink')}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t('auth.rememberPassword')}{' '}
                <Link href={`/${params.locale}/login`} className="text-primary hover:underline">
                  {t('auth.signIn')}
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}
