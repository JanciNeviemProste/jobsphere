import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { OrgActionButton } from './_components/org-action-button'

export default async function AdminOrganizationsPage({ params }: { params: { locale: string } }) {
  const session = await auth()
  if (!session?.user?.isGlobalAdmin) {
    redirect(`/${params.locale}/login?error=forbidden`)
  }

  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      industry: true,
      createdAt: true,
      deletedAt: true,
      _count: {
        select: {
          users: true,
          jobs: true,
          subscriptions: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Organizácie</h1>
        <p className="mt-1 text-sm text-slate-500">Celkovo {orgs.length} organizácií</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Všetky organizácie</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Názov</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead className="text-right">Členovia</TableHead>
                <TableHead className="text-right">Joby</TableHead>
                <TableHead className="text-right">Predplatné</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Dátum</TableHead>
                <TableHead className="text-right">Akcia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((org) => {
                const suspended = org.deletedAt !== null
                return (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/${params.locale}/admin/organizations/${org.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {org.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{org.slug}</TableCell>
                    <TableCell className="text-sm text-slate-500">{org.industry ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm">{org._count.users}</TableCell>
                    <TableCell className="text-right text-sm">{org._count.jobs}</TableCell>
                    <TableCell className="text-right text-sm">{org._count.subscriptions}</TableCell>
                    <TableCell>
                      {suspended ? (
                        <Badge variant="destructive">Pozastavená</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          Aktívna
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {new Date(org.createdAt).toLocaleDateString('sk-SK')}
                    </TableCell>
                    <TableCell className="text-right">
                      <OrgActionButton orgId={org.id} suspended={suspended} />
                    </TableCell>
                  </TableRow>
                )
              })}
              {orgs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-slate-500">
                    Žiadne organizácie
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
