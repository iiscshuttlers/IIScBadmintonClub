import React from "react";
import { PlusCircle } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * Empty state with signature IISc Badminton shuttlecock illustration and warm microcopy.
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`text-center py-14 px-6 bg-white dark:bg-slate-900/80 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center ${className}`}
    >
      {/* Warm Shuttlecock SVG Icon */}
      <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 text-primary shadow-xs">
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-8 h-8 stroke-current"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Shuttlecock cork / base */}
          <path d="M18 36c0 3.3 2.7 6 6 6s6-2.7 6-6v-3H18v3z" fill="currentColor" fillOpacity="0.2" />
          {/* Feather cone outline */}
          <path d="M18 33L10 12h28l-8 21" />
          {/* Feather ribs */}
          <path d="M19 12l2 21" />
          <path d="M29 12l-2 21" />
          <path d="M24 12v21" />
          {/* Thread / tape bands */}
          <path d="M14 20h20" />
          <path d="M16 26h16" />
        </svg>
      </div>

      <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm font-medium mb-5">
        {description}
      </p>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-slate-950 font-black text-xs hover:brightness-105 active:scale-95 transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <PlusCircle className="w-4 h-4" /> {actionLabel}
        </button>
      )}
    </div>
  );
}
