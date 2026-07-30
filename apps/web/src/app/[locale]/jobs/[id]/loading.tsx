import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shape-matched to `jobs/[id]/page.tsx`: two-column detail layout — job card +
 * CTA on the left, company / similar jobs / quick stats sidebar on the right.
 * Previously this fell back to the marketing `PageSkeleton` from `[locale]/`.
 */
export default function JobDetailLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-6 h-8 w-32" />

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <div className="space-y-6 rounded-lg border p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-9 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </div>
                <Skeleton className="h-16 w-16 rounded-lg" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-40" />
                ))}
              </div>

              <div className="space-y-2 border-t pt-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className={i % 3 === 2 ? 'h-4 w-4/6' : 'h-4 w-full'} />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-lg border border-primary/20 bg-primary/5 p-6 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton className="h-5 w-56" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3 rounded-lg border p-6">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-9 w-full" />
            </div>

            <div className="space-y-4 rounded-lg border p-6">
              <Skeleton className="h-5 w-32" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>

            <div className="space-y-3 rounded-lg border p-6">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
