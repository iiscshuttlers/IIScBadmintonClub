export function PageSkeleton() {
  return (
    <div className="flex-1 w-full px-4 py-10 max-w-5xl mx-auto space-y-5">
      {/* Heading shimmer */}
      <div className="h-9 w-1/3 rounded-xl shimmer" />
      <div className="h-4 w-3/4 rounded shimmer" />
      <div className="h-4 w-1/2 rounded shimmer" />
      {/* Card row shimmer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-44 rounded-2xl shimmer" />
        ))}
      </div>
      {/* List shimmer */}
      <div className="space-y-3 mt-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-3 items-center">
            <div className="w-10 h-10 rounded-full flex-shrink-0 shimmer" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded shimmer" />
              <div className="h-3 w-1/3 rounded shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
