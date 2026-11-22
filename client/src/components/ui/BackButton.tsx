import React from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useGoBack } from "@/hooks/useGoBack";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  /**
   * Where Back goes when there is no earlier in-app screen (opened from a
   * link, a notification or a cold start). Also the link's href, so opening
   * it in a new tab lands on the parent.
   */
  parent: string;
  /** Runs instead of leaving the screen when it returns true (undo an in-page step first). */
  onBeforeLeave?: () => boolean;
  /** Visible label. Defaults to "Back"; name a place only if Back always lands there. */
  label?: React.ReactNode;
  /** Replaces the default arrow + label. */
  children?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

/**
 * The app's Back control: returns to the previous screen the person was on,
 * or to `parent` when there isn't one. The phone's Back key does the same.
 */
export function BackButton({
  parent,
  onBeforeLeave,
  label = "Back",
  children,
  className,
  "aria-label": ariaLabel,
}: BackButtonProps) {
  const goBack = useGoBack(parent);

  return (
    <Link
      href={parent}
      aria-label={ariaLabel}
      onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        if (onBeforeLeave?.()) return;
        goBack();
      }}
      className={cn(
        children ? undefined : "inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition cursor-pointer",
        className,
      )}
    >
      {children ?? (
        <>
          <ArrowLeft className="w-4 h-4" aria-hidden /> {label}
        </>
      )}
    </Link>
  );
}
