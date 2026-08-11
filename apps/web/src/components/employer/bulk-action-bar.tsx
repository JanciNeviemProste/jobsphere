'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useFormatter, useTranslations } from 'next-intl'
import { X, ChevronDown, Mail, Download, UserX } from 'lucide-react'
import {
  APPLICATION_STAGES,
  type ApplicationStage,
} from '@/lib/constants/application-stages'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { BulkEmailDialog } from './bulk-email-dialog'
import { SHORT_DATE } from '@/lib/formats'

interface ApplicationRow {
  id: string
  candidateName: string
  candidateEmail: string
  jobTitle: string
  stage: string
  createdAt: Date
}

interface BulkActionBarProps {
  selectedIds: string[]
  applications: ApplicationRow[]
  onClear: () => void
  onSuccess: () => void
}

export function BulkActionBar({
  selectedIds,
  applications,
  onClear,
  onSuccess,
}: BulkActionBarProps) {
  const format = useFormatter()
  const t = useTranslations('employer.bulkActions')
  const tCommon = useTranslations('common')
  const tStages = useTranslations('employer.stages')
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const count = selectedIds.length

  const postBulk = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/applications/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res
  }

  const handleMoveStage = async (stage: ApplicationStage) => {
    setLoadingAction(`move-${stage}`)
    try {
      const res = await postBulk({ action: 'move-stage', applicationIds: selectedIds, stage })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t('moveFailed'))
        return
      }
      toast.success(t('movedSuccess', { count: data.processed }))
      onSuccess()
    } catch {
      toast.error(t('moveFailed'))
    } finally {
      setLoadingAction(null)
    }
  }

  const handleReject = async () => {
    setLoadingAction('reject')
    try {
      const res = await postBulk({ action: 'reject', applicationIds: selectedIds })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t('rejectFailed'))
        return
      }
      toast.success(t('rejectedSuccess', { count: data.processed }))
      onSuccess()
    } catch {
      toast.error(t('rejectFailed'))
    } finally {
      setLoadingAction(null)
    }
  }

  const handleExportCsv = () => {
    const idSet = new Set(selectedIds)
    const selected = applications.filter((a) => idSet.has(a.id))
    const headers = [
      t('csvName'),
      t('csvEmail'),
      t('csvPosition'),
      t('csvStage'),
      t('csvAppliedAt'),
    ]
    const rows = selected.map((a) => [
      a.candidateName,
      a.candidateEmail,
      a.jobTitle,
      a.stage,
      format.dateTime(new Date(a.createdAt), SHORT_DATE),
    ])

    const escape = (val: string) => `"${String(val).replace(/"/g, '""')}"`
    const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join(
      '\n',
    )

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${t('csvFilenamePrefix')}-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    URL.revokeObjectURL(url)
    document.body.removeChild(a)
    toast.success(t('exportSuccess', { count: selected.length }))
  }

  const isLoading = loadingAction !== null

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-white px-4 py-3 shadow-sm">
        <span className="text-sm font-medium text-foreground">{t('selectedCount', { count })}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClear}
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{t('clearSelection')}</span>
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isLoading}>
                {t('moveTo')}
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {APPLICATION_STAGES.map((stage) => (
                <DropdownMenuItem
                  key={stage}
                  onClick={() => handleMoveStage(stage)}
                  disabled={loadingAction === `move-${stage}`}
                >
                  {tStages(stage)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isLoading}>
                <UserX className="mr-1 h-4 w-4" />
                {t('reject')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('rejectConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('rejectConfirmDescription', { count })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReject}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('reject')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmailDialogOpen(true)}
            disabled={isLoading}
          >
            <Mail className="mr-1 h-4 w-4" />
            {t('email')}
          </Button>

          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={isLoading}>
            <Download className="mr-1 h-4 w-4" />
            {t('exportCsv')}
          </Button>
        </div>
      </div>

      <BulkEmailDialog
        selectedIds={selectedIds}
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        onSuccess={() => {
          setEmailDialogOpen(false)
          onSuccess()
        }}
      />
    </>
  )
}
