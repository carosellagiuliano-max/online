import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function TermineLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Tabs */}
      <div className="space-y-6">
        <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>

        {/* Appointment Cards */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Date Badge Skeleton */}
                  <Skeleton className="h-20 w-20 rounded-lg flex-shrink-0" />

                  {/* Content Skeleton */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-6 w-24" />
                    </div>
                    <div className="flex gap-4">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-9 w-28" />
                      <Skeleton className="h-9 w-28" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
