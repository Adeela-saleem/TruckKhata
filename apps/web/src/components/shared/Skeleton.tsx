export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton rounded-md ${className}`} style={style} />
}

/** Matches a KPIRow of 6 cards while data loads. */
export function KPIRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card px-4 py-4 min-h-[108px] flex flex-col gap-3">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-7 w-14 mt-auto" />
        </div>
      ))}
    </div>
  )
}

export function ChartSkeleton({ height = 256 }: { height?: number }) {
  return (
    <div className="card px-5 py-4">
      <Skeleton className="h-3 w-44 mb-5" />
      <Skeleton className="w-full rounded-lg" style={{ height }} />
    </div>
  )
}
