import { JobCardSkeleton, Skeleton } from '@/components/ui/skeleton'

export default function JobsLoading() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <JobCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
