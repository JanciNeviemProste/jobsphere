import type { ReactNode } from 'react'
import Link from 'next/link'
import { LayoutList, Kanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { APPLICATION_STAGES, STAGE_LABELS_SK } from '@/lib/constants/application-stages'

export type ApplicantsView = 'kanban' | 'list'
export type ApplicantsSort = 'date_desc' | 'date_asc' | 'score_desc'

export const APPLICANTS_SORTS: ApplicantsSort[] = ['date_desc', 'date_asc', 'score_desc']

const SORT_LABELS_SK: Record<ApplicantsSort, string> = {
  date_desc: 'Najnovšie',
  date_asc: 'Najstaršie',
  score_desc: 'Najvyššie skóre',
}

interface Props {
  view: ApplicantsView
  locale: string
  jobs: { id: string; title: string }[]
  currentJobId?: string
  currentStage?: string
  currentSort?: ApplicantsSort
}

/**
 * Shared toolbar for the two candidate views (Kanban board + Zoznam/list).
 * The toggle links jump between the two routes carrying the active filters;
 * the GET form re-submits the filters to the current route. Server component —
 * URL query params are the single source of truth for both views.
 */
export function ApplicantsViewControls({
  view,
  locale,
  jobs,
  currentJobId,
  currentStage,
  currentSort,
}: Props) {
  const buildHref = (targetView: ApplicantsView) => {
    const params = new URLSearchParams()
    if (currentJobId) params.set('jobId', currentJobId)
    if (currentStage) params.set('stage', currentStage)
    if (currentSort) params.set('sort', currentSort)
    const qs = params.toString()
    const base =
      targetView === 'kanban' ? `/${locale}/employer/pipeline` : `/${locale}/employer/applicants`
    return qs ? `${base}?${qs}` : base
  }

  const formAction =
    view === 'kanban' ? `/${locale}/employer/pipeline` : `/${locale}/employer/applicants`

  const toggleBtn = (targetView: ApplicantsView, label: string, icon: ReactNode) => {
    const active = view === targetView
    return (
      <Link
        href={buildHref(targetView)}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          active
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        aria-current={active ? 'page' : undefined}
      >
        {icon}
        {label}
      </Link>
    )
  }

  const selectClass =
    'rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
        {toggleBtn('kanban', 'Kanban', <Kanban className="h-4 w-4" />)}
        {toggleBtn('list', 'Zoznam', <LayoutList className="h-4 w-4" />)}
      </div>

      {/* Server Component: no onChange handlers — submit via the button. */}
      <form method="GET" action={formAction} className="flex flex-wrap items-center gap-2">
        <select name="jobId" defaultValue={currentJobId ?? ''} className={selectClass}>
          <option value="">Všetky pozície</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </select>

        <select name="stage" defaultValue={currentStage ?? ''} className={selectClass}>
          <option value="">Všetky fázy</option>
          {APPLICATION_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABELS_SK[stage]}
            </option>
          ))}
        </select>

        <select name="sort" defaultValue={currentSort ?? 'date_desc'} className={selectClass}>
          {APPLICANTS_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {SORT_LABELS_SK[sort]}
            </option>
          ))}
        </select>

        <Button type="submit" variant="outline" size="sm">
          Filtrovať
        </Button>
      </form>
    </div>
  )
}
