import { Skeleton, StatsCardSkeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <Skeleton className="h-8 w-1/4" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>
      <TableSkeleton rows={5} />
    </div>
  )
}
