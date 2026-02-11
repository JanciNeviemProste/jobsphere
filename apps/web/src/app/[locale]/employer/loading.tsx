import { Skeleton, StatsCardSkeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function EmployerLoading() {
  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <Skeleton className="h-8 w-1/4" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>
      <TableSkeleton rows={8} />
    </div>
  )
}
