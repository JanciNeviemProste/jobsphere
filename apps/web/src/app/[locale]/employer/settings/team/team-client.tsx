'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InviteMemberDialog } from '@/components/team/InviteMemberDialog'
import { MemberRow } from '@/components/team/MemberRow'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

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

interface TeamData {
  members: Member[]
  currentUserRole: string
}

export default function TeamManagementClient() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [teamData, setTeamData] = useState<TeamData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTeam = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/organizations/current/members')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load team members')
      }

      setTeamData(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      fetchTeam()
    }
  }, [status, router])

  if (status === 'loading' || isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="mb-8">
          <Skeleton className="mb-2 h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const isAdmin = teamData?.currentUserRole === 'ORG_ADMIN'

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Team Management</h1>
          <p className="text-muted-foreground">
            Manage your organization's team members and their roles.
          </p>
        </div>
        {isAdmin && <InviteMemberDialog onSuccess={fetchTeam} />}
      </div>

      {!isAdmin && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Only organization administrators can invite, remove, or change roles of team members.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {teamData?.members.length || 0} member{teamData?.members.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamData?.members && teamData.members.length > 0 ? (
                teamData.members.map((member) => (
                  <MemberRow
                    key={member.userId}
                    member={member}
                    currentUserId={session?.user?.id || ''}
                    currentUserRole={teamData.currentUserRole}
                    onUpdate={fetchTeam}
                  />
                ))
              ) : (
                <TableRow>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No team members yet
                  </td>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
