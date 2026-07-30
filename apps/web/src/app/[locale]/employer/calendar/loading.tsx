import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shape-matched to `calendar/page.tsx`: a narrow (max-w-4xl) column of
 * day-grouped interview cards, not a month grid.
 */
export default function CalendarLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="mb-6 h-8 w-40" />

        <div className="mb-8 space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-56" />
        </div>

        <div className="space-y-8">
          {Array.from({ length: 3 }).map((_, group) => (
            <div key={group}>
              <Skeleton className="mb-3 h-4 w-32" />
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, card) => (
                  <div key={card} className="space-y-3 rounded-lg border p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-1/2" />
                        <Skeleton className="h-4 w-1/3" />
                      </div>
                      <div className="space-y-2 text-right">
                        <Skeleton className="ml-auto h-4 w-16" />
                        <Skeleton className="ml-auto h-3 w-12" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                    <Skeleton className="h-8 w-32" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
