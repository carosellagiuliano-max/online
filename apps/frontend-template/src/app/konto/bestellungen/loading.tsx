import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function BestellungenLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-10 w-28" />
      </div>

      {/* Order Cards */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4">
                {/* Order Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                </div>

                {/* Order Items */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>

                {/* Order Footer */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
