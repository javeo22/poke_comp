type Variant = "table" | "card" | "detail" | "list";

interface LoadingSkeletonProps {
  variant?: Variant;
  count?: number;
  className?: string;
}

export function LoadingSkeleton({
  variant = "card",
  count = 6,
  className = "",
}: LoadingSkeletonProps) {
  if (variant === "table") {
    return (
      <div
        className={`card overflow-hidden ${className}`}
        role="status"
        aria-label="Loading"
      >
        <div className="border-b border-outline-variant bg-surface-mid px-4 py-3">
          <div className="h-3 w-32 animate-pulse rounded bg-surface-high" />
        </div>
        <div className="divide-y divide-outline-variant">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-8 w-8 animate-pulse rounded bg-surface-high" />
              <div className="h-3 flex-1 animate-pulse rounded bg-surface-high" />
              <div className="h-3 w-20 animate-pulse rounded bg-surface-high" />
              <div className="h-3 w-16 animate-pulse rounded bg-surface-high" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div
        className={`card p-6 ${className}`}
        role="status"
        aria-label="Loading"
      >
        <div className="flex items-start gap-4">
          <div className="h-24 w-24 animate-pulse rounded bg-surface-high" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-48 animate-pulse rounded bg-surface-high" />
            <div className="h-3 w-full animate-pulse rounded bg-surface-high" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-surface-high" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded bg-surface-high"
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div
        className={`flex flex-col gap-2 ${className}`}
        role="status"
        aria-label="Loading"
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-low px-4 py-3"
          >
            <div className="h-10 w-10 animate-pulse rounded bg-surface-high" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 animate-pulse rounded bg-surface-high" />
              <div className="h-2 w-2/3 animate-pulse rounded bg-surface-high" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${className}`}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4">
          <div className="mx-auto h-20 w-20 animate-pulse rounded bg-surface-high" />
          <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-surface-high" />
          <div className="mt-2 h-2 w-1/2 animate-pulse rounded bg-surface-high" />
        </div>
      ))}
    </div>
  );
}
