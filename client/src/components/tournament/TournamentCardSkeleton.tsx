import React from "react";

export function TournamentCardSkeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animate-pulse space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
              <div className="h-5 w-12 bg-slate-200 dark:bg-slate-800 rounded-full" />
            </div>
            <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
            <div className="h-3.5 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-3.5 w-2/5 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        </div>
      ))}
    </>
  );
}
