'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface ApplicantActionsProps {
  applicationId: string
  currentStage: string
  locale: string
}

export function ApplicantActions({ applicationId, currentStage, locale }: ApplicantActionsProps) {
  const router = useRouter()
  const t = useTranslations('applicant')
  const [isLoading, setIsLoading] = useState(false)
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [note, setNote] = useState('')

  const updateStage = async (newStage: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStage }),
      })

      if (!response.ok) {
        throw new Error('Failed to update application')
      }

      toast.success(t('statusUpdated'))
      router.refresh()
    } catch (error) {
      console.error('Error updating stage:', error)
      toast.error(t('statusUpdateFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error(t('emailRequiredFields'))
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/applications/${applicationId}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: emailSubject,
          body: emailBody,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send email')
      }

      toast.success(t('emailSent'))
      setShowEmailDialog(false)
      setEmailSubject('')
      setEmailBody('')
      router.refresh()
    } catch (error) {
      console.error('Error sending email:', error)
      toast.error(t('emailSendFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddNote = async () => {
    if (!note.trim()) {
      toast.error(t('noteRequired'))
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/applications/${applicationId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note }),
      })

      if (!response.ok) {
        throw new Error('Failed to add note')
      }

      toast.success(t('noteAdded'))
      setShowNoteDialog(false)
      setNote('')
      router.refresh()
    } catch (error) {
      console.error('Error adding note:', error)
      toast.error(t('noteAddFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Akcie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {currentStage === 'NEW' && (
            <Button
              className="w-full"
              variant="default"
              onClick={() => updateStage('SCREENING')}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Začať screening
            </Button>
          )}
          {(currentStage === 'SCREENING' || currentStage === 'PHONE_SCREEN') && (
            <Button
              className="w-full"
              variant="default"
              onClick={() => updateStage('INTERVIEW')}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Naplánovať Interview
            </Button>
          )}
          {currentStage === 'INTERVIEW' && (
            <>
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => updateStage('HIRED')}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Prijať kandidáta
              </Button>
              <Button
                className="w-full"
                variant="destructive"
                onClick={() => updateStage('REJECTED')}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Zamietnuť
              </Button>
            </>
          )}
          <Separator />
          <Button
            className="w-full"
            variant="outline"
            onClick={() => setShowEmailDialog(true)}
            disabled={isLoading}
          >
            Poslať email
          </Button>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => setShowNoteDialog(true)}
            disabled={isLoading}
          >
            Pridať poznámku
          </Button>
        </CardContent>
      </Card>

      {/* Email Dialog */}
      {showEmailDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="mx-4 w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Poslať email kandidátovi</CardTitle>
              <CardDescription>Napíšte email, ktorý chcete odoslať</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-subject">Predmet</Label>
                <Input
                  id="email-subject"
                  placeholder="Predmet emailu"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-body">Správa</Label>
                <Textarea
                  id="email-body"
                  placeholder="Text emailu..."
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEmailDialog(false)
                    setEmailSubject('')
                    setEmailBody('')
                  }}
                  disabled={isLoading}
                >
                  Zrušiť
                </Button>
                <Button onClick={handleSendEmail} disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Odoslať
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Note Dialog */}
      {showNoteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="mx-4 w-full max-w-lg">
            <CardHeader>
              <CardTitle>Pridať poznámku</CardTitle>
              <CardDescription>Interná poznámka k tomuto kandidátovi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="note">Poznámka</Label>
                <Textarea
                  id="note"
                  placeholder="Napíšte poznámku..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={6}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNoteDialog(false)
                    setNote('')
                  }}
                  disabled={isLoading}
                >
                  Zrušiť
                </Button>
                <Button onClick={handleAddNote} disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Pridať
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
