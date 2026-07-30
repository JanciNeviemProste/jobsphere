import { redirect } from 'next/navigation'
import { getFormatter } from 'next-intl/server'
import { SHORT_DATE } from '@/lib/formats'
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
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Predplatné | Admin',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 hover:bg-green-100',
  trialing: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  past_due: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  canceled: 'bg-red-100 text-red-800 hover:bg-red-100',
  unpaid: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
}

export default async function AdminSubscriptionsPage({ params }: { params: { locale: string } }) {
  const session = await auth()
  const format = await getFormatter()
  if (!session?.user?.isGlobalAdmin) {
    redirect(`/${params.locale}/login?error=forbidden`)
  }

  const subscriptions = await prisma.subscription.findMany({
    include: {
      organization: { select: { name: true, slug: true } },
      product: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const counts = subscriptions.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Predplatné</h1>
        <p className="mt-1 text-sm text-slate-500">
          {subscriptions.length} predplatných (Stripe je source of truth)
        </p>
      </div>

      <div className="flex gap-4">
        {Object.entries(counts).map(([status, count]) => (
          <Card key={status} className="flex-1">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-sm capitalize text-slate-500">{status}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Všetky predplatné</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organizácia</TableHead>
                <TableHead>Plán</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Obdobie</TableHead>
                <TableHead>Zrušenie</TableHead>
                <TableHead>Vytvorené</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{sub.organization.name}</p>
                      <p className="text-xs text-slate-400">{sub.organization.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{sub.product.name}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[sub.status] ?? 'bg-slate-100 text-slate-700'}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {format.dateTime(sub.currentPeriodStart, SHORT_DATE)} –{' '}
                    {format.dateTime(sub.currentPeriodEnd, SHORT_DATE)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {sub.cancelAt ? format.dateTime(sub.cancelAt, SHORT_DATE) : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {format.dateTime(sub.createdAt, SHORT_DATE)}
                  </TableCell>
                </TableRow>
              ))}
              {subscriptions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                    Žiadne predplatné
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
