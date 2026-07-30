import { Skeleton, StatsCardSkeleton, TableSkeleton } from '@/components/ui/skeleton'

/**
 * Shape-matched to `applicants/page.tsx`: back link, header row, 4 stat cards,
 * then the applicants table inside a card.
 */
export default function ApplicantsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-6 h-8 w-40" />

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>

        <div className="rounded-lg border p-6">
          <TableSkeleton rows={8} />
        </div>
      </div>
    </div>
  )
}
