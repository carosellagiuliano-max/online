import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function KalenderLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Day Headers */}
          <div className="grid grid-cols-[60px_1fr]">
            <div />
            <div className="grid grid-cols-7 border-b">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="p-2 text-center border-r last:border-r-0">
                  <Skeleton className="h-4 w-8 mx-auto mb-1" />
                  <Skeleton className="h-6 w-6 mx-auto" />
                </div>
              ))}
            </div>
          </div>

          {/* Time Grid */}
          <div className="grid grid-cols-[60px_1fr]">
            {/* Time labels */}
            <div className="border-r">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-[60px] border-b p-1">
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
            </div>

            {/* Grid cells */}
            <div className="grid grid-cols-7">
              {Array.from({ length: 7 }).map((_, colIndex) => (
                <div key={colIndex} className="border-r last:border-r-0">
                  {Array.from({ length: 10 }).map((_, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="h-[60px] border-b border-dashed relative"
                    >
                      {/* Random appointment skeletons */}
                      {Math.random() > 0.7 && (
                        <Skeleton
                          className="absolute left-1 right-1 rounded-md"
                          style={{
                            top: `${Math.random() * 20}px`,
                            height: `${Math.random() * 40 + 30}px`,
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
