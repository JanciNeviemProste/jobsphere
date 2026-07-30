import { Skeleton, StatsCardSkeleton, TableSkeleton } from '@/components/ui/skeleton'

/**
 * Shape-matched to `analytics/page.tsx`: header, 5 KPI cards, two side-by-side
 * charts, one full-width trend chart, then the top-jobs table.
 */
function ChartSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border p-6">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-[300px] w-full" />
    </div>
  )
}

export default function AnalyticsLoading() {
  return (
    <div className="container mx-auto space-y-8 py-10">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      <ChartSkeleton />

      <div className="rounded-lg border p-6">
        <TableSkeleton rows={5} />
      </div>
    </div>
  )
}
