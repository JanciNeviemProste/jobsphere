'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarClock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { InterviewScheduleDialog } from './interview-schedule-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  STAGE_COLORS,
  STAGE_LABELS_SK,
  type ApplicationStage,
} from '@/lib/constants/application-stages'
import { BulkActionBar } from './bulk-action-bar'

interface ApplicationRow {
  id: string
  candidateName: string
  candidateEmail: string
  jobTitle: string
  stage: string
  createdAt: Date
  avatar?: string | null
  score?: number | null
}

interface ApplicantsTableProps {
  applications: ApplicationRow[]
  locale: string
}

function initials(name: string): string {
  return (
    name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'K'
  )
}

function ScoreCell({ score }: { score?: number | null }) {
  if (typeof score !== 'number') {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  let colorClass = 'bg-red-100 text-red-800'
  if (score >= 80) colorClass = 'bg-green-100 text-green-800'
  else if (score >= 60) colorClass = 'bg-amber-100 text-amber-800'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${colorClass}`}
    >
      {score}%
    </span>
  )
}

export function ApplicantsTable({ applications, locale }: ApplicantsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [scheduleFor, setScheduleFor] = useState<string | null>(null)
  const router = useRouter()

  const allSelected = applications.length > 0 && selectedIds.size === applications.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < applications.length

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(applications.map((a) => a.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSuccess = () => {
    setSelectedIds(new Set())
    router.refresh()
  }

  const stageBadge = (stage: string) => {
    const colorClass = STAGE_COLORS[stage as ApplicationStage]
    const label = STAGE_LABELS_SK[stage as ApplicationStage] ?? stage
    return colorClass ? <Badge className={colorClass}>{label}</Badge> : <Badge>{label}</Badge>
  }

  if (applications.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">
          Nenašli sa žiadni kandidáti. Vytvorte pracovnú ponuku a počkajte na prihlášky.
        </p>
        <Button asChild className="mt-4">
          <Link href={`/${locale}/employer/jobs/new`}>Vytvoriť pozíciu</Link>
        </Button>
      </div>
    )
  }

  const bulkApplications = applications.map((a) => ({
    id: a.id,
    candidateName: a.candidateName,
    candidateEmail: a.candidateEmail,
    jobTitle: a.jobTitle,
    stage: a.stage,
    createdAt: a.createdAt,
  }))

  return (
    <div>
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedIds={Array.from(selectedIds)}
          applications={bulkApplications}
          onClear={() => setSelectedIds(new Set())}
          onSuccess={handleSuccess}
        />
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={someSelected ? 'indeterminate' : allSelected}
                onCheckedChange={toggleAll}
                aria-label="Vybrať všetkých"
              />
            </TableHead>
            <TableHead>Kandidát</TableHead>
            <TableHead>Pozícia</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Skóre</TableHead>
            <TableHead>Dátum</TableHead>
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((application) => (
            <TableRow
              key={application.id}
              data-state={selectedIds.has(application.id) ? 'selected' : undefined}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => toggleOne(application.id)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(application.id)}
                  onCheckedChange={() => toggleOne(application.id)}
                  aria-label={`Vybrať ${application.candidateName}`}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  {application.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={application.avatar}
                      alt={application.candidateName || 'Kandidát'}
                      className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-sm font-semibold text-primary">
                        {initials(application.candidateName || application.candidateEmail || '')}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{application.candidateName || 'Kandidát'}</p>
                    <p className="text-xs text-muted-foreground">{application.candidateEmail}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm">{application.jobTitle}</TableCell>
              <TableCell>{stageBadge(application.stage)}</TableCell>
              <TableCell>
                <ScoreCell score={application.score} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(application.createdAt).toLocaleDateString('sk-SK')}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScheduleFor(application.id)}
                    title="Naplánovať pohovor"
                  >
                    <CalendarClock className="h-4 w-4" />
                    <span className="sr-only">Naplánovať pohovor</span>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/${locale}/employer/applicants/${application.id}`}>Detail</Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {scheduleFor && (
        <InterviewScheduleDialog
          applicationId={scheduleFor}
          open={scheduleFor !== null}
          onOpenChange={(o) => {
            if (!o) setScheduleFor(null)
          }}
          defaultType="VIDEO"
        />
      )}
    </div>
  )
}
