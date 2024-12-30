import { Skeleton } from "@kit/ui/skeleton"

export function PlaidConnectionItemsSkeleton({ className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <div className="mb-4 border border-primary rounded-lg space-y-4 p-6">
        {/* Institution header */}
        <div className="flex items-center justify-between p-4 border border-gray-600 rounded-lg">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
        
        {/* First account item */}
        <div className="pl-4 mt-2">
          <div className="flex items-center justify-between p-4 w-full max-w-xl border border-gray-600 mt-3 rounded-lg">
            <div className="flex items-center space-x-4 h-12">
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
  )
} 
