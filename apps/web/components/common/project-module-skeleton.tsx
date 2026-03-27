import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Placeholder enquanto o chunk do módulo do projeto carrega (next/dynamic). */
export function ProjectModuleSkeleton() {
  return (
    <div className="page-sections">
      <Card>
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-8 w-2/3 max-w-md" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="min-h-[240px] w-full rounded-xl" />
    </div>
  );
}
