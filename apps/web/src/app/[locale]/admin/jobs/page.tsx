import { redirect } from 'next/navigation'
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
import { JobStatusSelect } from './_components/job-status-select'
import { JobStatusFilter } from './_components/job-status-filter'
import { CreateJobButton } from './_components/create-job-button'

const STATUS_COLORS: Record<string, string> = {
  PUBLISHED: 'bg-green-100 text-green-800 hover:bg-green-100',
  DRAFT: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
  CLOSED: 'bg-red-100 text-red-800 hover:bg-red-100',
  PAUSED: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
}

export default async function AdminJobsPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { status?: string; search?: string; page?: string }
}) {
  const session = await auth()
  if (!session?.user?.isGlobalAdmin) {
    redirect(`/${params.locale}/login?error=forbidden`)
  }

  const status = searchParams.status ?? undefined
  const search = searchParams.search ?? undefined
  const page = Math.max(1, Number(searchParams.page ?? '1'))
  const limit = 50
  const skip = (page - 1) * limit

  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { organization: { name: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }

  const [jobs, total, orgs] = await Promise.all([
    prisma.job.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        orgId: true,
        createdAt: true,
        organization: { select: { name: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.job.count({ where }),
    // Active organizations for the "create job" org picker.
    prisma.organization.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 500,
    }),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Joby</h1>
          <p className="mt-1 text-sm text-slate-500">{total} jobov celkovo</p>
        </div>
        <div className="flex items-center gap-2">
          <JobStatusFilter currentStatus={status} />
          <CreateJobButton orgs={orgs} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Všetky joby</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Názov</TableHead>
                <TableHead>Organizácia</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Prihlásenia</TableHead>
                <TableHead>Dátum</TableHead>
                <TableHead className="text-right">Zmena statusu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="max-w-xs truncate font-medium">{job.title}</TableCell>
                  <TableCell className="text-sm text-slate-500">{job.organization.name}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[job.status] ?? 'bg-slate-100 text-slate-700'}>
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">{job._count.applications}</TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {new Date(job.createdAt).toLocaleDateString('sk-SK')}
                  </TableCell>
                  <TableCell className="text-right">
                    <JobStatusSelect jobId={job.id} currentStatus={job.status} />
                  </TableCell>
                </TableRow>
              ))}
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                    Žiadne joby
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <p className="text-center text-sm text-slate-500">
          Strana {page} z {totalPages}
        </p>
      )}
    </div>
  )
}
