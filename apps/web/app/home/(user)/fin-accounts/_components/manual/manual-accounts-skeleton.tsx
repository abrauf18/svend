import { Skeleton } from '@kit/ui/skeleton';

export function ManualAccountsSkeleton({ className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <div className="mb-4 space-y-4 rounded-lg border border-primary p-6">
        {/* Institution header */}
        <div className="flex items-center justify-between rounded-lg border border-gray-600 p-4">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>

        {/* First account item */}
        <div className="mt-2 pl-4">
          <div className="mt-3 flex w-full max-w-xl items-center justify-between rounded-lg border border-gray-600 p-4">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-[180px]" />
                <Skeleton className="h-4 w-[140px]" />
              </div>
            </div>
            <Skeleton className="h-6 w-10 rounded-full" />
          </div>
        </div>
      </div>

      {/* Gradient fade-out overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-[30vh] [background:linear-gradient(180deg,transparent_10%,hsl(var(--background))_70%)]" />
    </div>
  );
}
