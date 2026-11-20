import React from "react";

export function TournamentCardSkeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-2xl p-5 animate-pulse space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-muted rounded-full" />
              <div className="h-5 w-12 bg-muted rounded-full" />
            </div>
            <div className="h-4 w-16 bg-muted rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-6 w-3/4 bg-muted rounded-lg" />
            <div className="h-4 w-1/2 bg-muted rounded-md" />
          </div>
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="h-3.5 w-1/3 bg-muted rounded" />
            <div className="h-3.5 w-2/5 bg-muted rounded" />
          </div>
        </div>
      ))}
    </>
  );
}
