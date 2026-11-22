import React from "react";
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canGoBackInApp } from "@/lib/navHistory";

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | string | null;
  onRetry?: () => void;
  homeLink?: boolean;
  backLink?: boolean;
  className?: string;
}

/**
 * Standardized ErrorState primitive across the app (S6).
 * Provides clean error messaging, retry triggers, and navigation recovery.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred while loading this section.",
  error,
  onRetry,
  homeLink = true,
  backLink = false,
  className = "",
}: ErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : typeof error === "string" ? error : null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-card border border-border shadow-sm max-w-md mx-auto my-6 ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-danger/20 text-danger flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6" />
      </div>

      <h3 className="text-base sm:text-lg font-black text-foreground mb-1.5">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-muted-foreground mb-4 max-w-xs">
        {description}
      </p>

      {errorMessage && (
        <pre className="text-[11px] p-2.5 rounded-xl bg-muted/80 text-danger font-mono w-full text-left overflow-x-auto mb-4 border border-danger/20">
          {errorMessage}
        </pre>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 w-full pt-1">
        {onRetry && (
          <Button
            onClick={onRetry}
            size="sm"
            className="flex items-center gap-1.5 bg-primary hover:bg-primary text-primary-foreground font-bold text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        )}

        {backLink && (
          <Button
            onClick={() => {
              // May render outside the router, so no wouter navigation here.
              if (canGoBackInApp()) window.history.back();
              else window.location.href = import.meta.env.BASE_URL;
            }}
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Go Back
          </Button>
        )}

        {homeLink && (
          <a href="/">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 text-xs font-bold"
            >
              <Home className="w-3.5 h-3.5" /> Return Home
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}
