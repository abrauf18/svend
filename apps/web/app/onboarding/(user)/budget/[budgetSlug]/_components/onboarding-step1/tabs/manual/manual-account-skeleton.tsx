import { Skeleton } from '@kit/ui/skeleton';

export default function ManualAccountSkeleton() {
  return (
    <div className="mt-2">
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
  );
}
