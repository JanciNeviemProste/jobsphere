'use client'

import { useState } from 'react'
import { TableCell, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useToast } from '@/components/ui/use-toast'
import { Trash2 } from 'lucide-react'

interface Member {
  userId: string
  role: string
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
    avatar: string | null
  }
}

interface MemberRowProps {
  member: Member
  currentUserId: string
  currentUserRole: string
  onUpdate: () => void
}

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ORG_ADMIN: 'default',
  RECRUITER: 'secondary',
  SUB_HR: 'secondary',
  HIRING_MANAGER: 'outline',
  AGENCY: 'destructive',
}

const roleLabels: Record<string, string> = {
  ORG_ADMIN: 'Organization Admin',
  RECRUITER: 'Recruiter',
  SUB_HR: 'Sub-HR',
  HIRING_MANAGER: 'Hiring Manager',
  AGENCY: 'Agency',
}

export function MemberRow({ member, currentUserId, currentUserRole, onUpdate }: MemberRowProps) {
  const [isChangingRole, setIsChangingRole] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const { toast } = useToast()

  const isCurrentUser = member.userId === currentUserId
  const canEdit = currentUserRole === 'ORG_ADMIN' && !isCurrentUser

  const handleRoleChange = async (newRole: string) => {
    setIsChangingRole(true)
    try {
      const response = await fetch(`/api/organizations/current/members/${member.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to change role')
      }

      toast.success('Member role updated successfully')

      onUpdate()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role')
    } finally {
      setIsChangingRole(false)
    }
  }

  const handleRemove = async () => {
    setIsRemoving(true)
    try {
      const response = await fetch(`/api/organizations/current/members/${member.userId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove member')
      }

      toast.success('Member removed successfully')

      onUpdate()
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member')
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            {member.user.avatar ? (
              <img
                src={member.user.avatar}
                alt={member.user.name || member.user.email}
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <span className="text-sm font-medium text-primary">
                {(member.user.name || member.user.email).charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <p className="font-medium">{member.user.name || member.user.email}</p>
            {member.user.name && (
              <p className="text-sm text-muted-foreground">{member.user.email}</p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        {canEdit ? (
          <Select value={member.role} onValueChange={handleRoleChange} disabled={isChangingRole}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ORG_ADMIN">Organization Admin</SelectItem>
              <SelectItem value="RECRUITER">Recruiter</SelectItem>
              <SelectItem value="SUB_HR">Sub-HR</SelectItem>
              <SelectItem value="HIRING_MANAGER">Hiring Manager</SelectItem>
              <SelectItem value="AGENCY">Agency</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge variant={roleBadgeVariant[member.role] || 'secondary'}>
            {roleLabels[member.role] || member.role}
          </Badge>
        )}
      </TableCell>
      <TableCell>{new Date(member.createdAt).toLocaleDateString()}</TableCell>
      <TableCell className="text-right">
        {canEdit ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={isRemoving}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove team member</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove {member.user.name || member.user.email} from your
                  organization? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRemove}
                  className="bg-destructive text-destructive-foreground"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : isCurrentUser ? (
          <span className="text-sm text-muted-foreground">(You)</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  )
}
