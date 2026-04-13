import { redirect, notFound } from 'next/navigation'
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
import { Separator } from '@/components/ui/separator'
import { OrgActionButton } from '../_components/org-action-button'

export default async function AdminOrganizationDetailPage({
  params,
}: {
  params: { locale: string; id: string }
}) {
  const session = await auth()
  if (!session?.user?.isGlobalAdmin) {
    redirect(`/${params.locale}/login?error=forbidden`)
  }

  const org = await prisma.organization.findUnique({
    where: { id: params.id },
    include: {
      users: {
        include: { user: { select: { id: true, name: true, email: true } } },
        where: { deletedAt: null },
        take: 50,
      },
      jobs: {
        where: { status: 'PUBLISHED', deletedAt: null },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          _count: { select: { applications: true } },
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      },
      subscriptions: {
        include: { product: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })

  if (!org) notFound()

  const suspended = org.deletedAt !== null

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{org.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            slug: <span className="font-mono">{org.slug}</span>
            {org.industry && ` · ${org.industry}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {suspended ? (
            <Badge variant="destructive">Pozastavená</Badge>
          ) : (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aktívna</Badge>
          )}
          <OrgActionButton orgId={org.id} suspended={suspended} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{org.users.length}</p>
            <p className="text-sm text-slate-500">Členovia</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{org.jobs.length}</p>
            <p className="text-sm text-slate-500">Aktívne joby</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{org.subscriptions.length}</p>
            <p className="text-sm text-slate-500">Predplatné</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Členovia</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meno</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rola</TableHead>
                <TableHead>Priradený od</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {org.users.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell className="font-medium">{m.user.name ?? '—'}</TableCell>
                  <TableCell className="text-slate-500">{m.user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.role}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {new Date(m.createdAt).toLocaleDateString('sk-SK')}
                  </TableCell>
                </TableRow>
              ))}
              {org.users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-slate-500">
                    Žiadni členovia
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aktívne joby</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pozícia</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Prihlásenia</TableHead>
                <TableHead>Dátum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {org.jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{job.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{job._count.applications}</TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {new Date(job.createdAt).toLocaleDateString('sk-SK')}
                  </TableCell>
                </TableRow>
              ))}
              {org.jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-slate-500">
                    Žiadne aktívne joby
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {org.subscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Predplatné</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plán</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Obdobie</TableHead>
                  <TableHead>Zrušenie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {org.subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.product.name}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          sub.status === 'active'
                            ? 'bg-green-100 text-green-800 hover:bg-green-100'
                            : sub.status === 'trialing'
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                              : sub.status === 'past_due'
                                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                                : 'bg-red-100 text-red-800 hover:bg-red-100'
                        }
                      >
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {new Date(sub.currentPeriodStart).toLocaleDateString('sk-SK')} –{' '}
                      {new Date(sub.currentPeriodEnd).toLocaleDateString('sk-SK')}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {sub.cancelAt ? new Date(sub.cancelAt).toLocaleDateString('sk-SK') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-slate-400">
        Vytvorená: {new Date(org.createdAt).toLocaleString('sk-SK')}
        {org.website && (
          <>
            {' · '}
            <a href={org.website} target="_blank" rel="noopener noreferrer" className="underline">
              {org.website}
            </a>
          </>
        )}
      </div>
    </div>
  )
}
