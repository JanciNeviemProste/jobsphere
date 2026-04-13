'use client'

/**
 * UserDetailActions — Client Component
 * Renders action buttons for the user detail page and calls the admin API.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
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
import { Ban, CheckCircle, ShieldCheck, ShieldOff, Trash2, Loader2 } from 'lucide-react'

interface UserDetailActionsProps {
  userId: string
  isBanned: boolean
  isGlobalAdmin: boolean
  isSelf: boolean
  locale: string
}

type Action = 'ban' | 'unban' | 'promote_admin' | 'demote_admin'

export function UserDetailActions({
  userId,
  isBanned,
  isGlobalAdmin,
  isSelf,
  locale,
}: UserDetailActionsProps) {
  const router = useRouter()
  const [pending, setPending] = useState<Action | 'delete' | null>(null)
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)

  function showToast(message: string, ok: boolean) {
    setToast({ message, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function performAction(action: Action) {
    setPending(action)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      })
      const data: { error?: string } = await res.json()
      if (!res.ok) {
        showToast(data.error ?? 'Akcia zlyhala', false)
        return
      }
      showToast('Akcia bola úspešná', true)
      router.refresh()
    } catch {
      showToast('Nepodarilo sa vykonať akciu', false)
    } finally {
      setPending(null)
    }
  }

  async function performDelete() {
    setPending('delete')
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      const data: { error?: string } = await res.json()
      if (!res.ok) {
        showToast(data.error ?? 'Zmazanie zlyhalo', false)
        return
      }
      router.push(`/${locale}/admin/users`)
    } catch {
      showToast('Nepodarilo sa zmazať používateľa', false)
    } finally {
      setPending(null)
    }
  }

  const isLoading = pending !== null

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex shrink-0 flex-wrap gap-2">
        {/* Ban / Unban */}
        {isBanned ? (
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || isSelf}
            onClick={() => performAction('unban')}
            className="border-emerald-200 text-emerald-600 hover:bg-emerald-50"
          >
            {pending === 'unban' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Odblokovať
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || isSelf}
            onClick={() => performAction('ban')}
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            {pending === 'ban' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Ban className="mr-2 h-4 w-4" />
            )}
            Zablokovať
          </Button>
        )}

        {/* Promote / Demote admin */}
        {isGlobalAdmin ? (
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || isSelf}
            onClick={() => performAction('demote_admin')}
            className="border-amber-200 text-amber-600 hover:bg-amber-50"
          >
            {pending === 'demote_admin' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldOff className="mr-2 h-4 w-4" />
            )}
            Odobrať admina
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => performAction('promote_admin')}
          >
            {pending === 'promote_admin' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            Povýšiť na admina
          </Button>
        )}

        {/* Soft Delete */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || isSelf || isGlobalAdmin}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              {pending === 'delete' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Zmazať
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Zmazať používateľa?</AlertDialogTitle>
              <AlertDialogDescription>
                Táto akcia soft-zmaže používateľa (nastaví deletedAt). Používateľ stratí prístup do
                systému. Akciu je možné zvrátiť priamo v databáze.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušiť</AlertDialogCancel>
              <AlertDialogAction
                onClick={performDelete}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                Zmazať
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  )
}
