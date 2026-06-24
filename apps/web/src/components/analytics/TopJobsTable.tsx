'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTranslations } from 'next-intl'

interface TopJobsTableProps {
  jobs: Array<{
    title: string
    count: number
    jobId: string
    views?: number
  }>
}

export function TopJobsTable({ jobs }: TopJobsTableProps) {
  const t = useTranslations('analytics')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('topJobs')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('jobTitle')}</TableHead>
              <TableHead className="text-right">Zobrazenia</TableHead>
              <TableHead className="text-right">{t('applications')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  {t('noApplications')}
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.jobId}>
                  <TableCell className="font-medium">{job.title}</TableCell>
                  <TableCell className="text-right">{job.views ?? 0}</TableCell>
                  <TableCell className="text-right">{job.count}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
