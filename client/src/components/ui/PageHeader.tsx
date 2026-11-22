import React from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { BackButton } from "./BackButton";

interface PageHeaderProps {
  badge?: React.ReactNode;
  badgeIcon?: React.ReactNode;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "center";
  /** Icon rendered beside the title. */
  icon?: React.ReactNode;
  /**
   * Shows a Back control above the title. Back returns to the previous
   * in-app screen; `backTo` is the parent used when there isn't one.
   */
  backTo?: string;
  /** Custom back handler (takes precedence over backTo). */
  onBack?: () => void;
  /** Back label. Keep "Back" unless Back always lands on one named place. */
  backLabel?: string;
  /** Tighter, borderless header for account/utility pages. */
  compact?: boolean;
  /** Optional action or button rendered in the header */
  action?: React.ReactNode;
  /** Card variant to be placed inside a content card container. */
  variant?: "default" | "card";
}

/**
 * Standardized PageHeader component providing uniform layout, typography,
 * and aesthetic rhythm across the app. Supports a `compact` variant and an
 * optional back link for account / utility / onboarding pages.
 */
export function PageHeader({
  badge,
  badgeIcon,
  title,
  subtitle,
  children,
  className,
  align = "center",
  icon,
  backTo,
  onBack,
  backLabel = "Back",
  compact = false,
  action,
  variant = "default",
}: PageHeaderProps) {
  const isCard = variant === "card";
  const isCenter = align === "center" && !compact && !isCard;

  const backLink = (onBack || backTo) ? (
    onBack ? (
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition mb-3"
      >
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </button>
    ) : (
      <BackButton parent={backTo!} label={backLabel} className="mb-3" />
    )
  ) : null;

  return (
    <header
      className={cn(
        "relative",
        isCard
          ? "py-4 px-1 border-b border-border/80 mb-6 bg-transparent"
          : compact
          ? "py-5 sm:py-6"
          : "py-8 sm:py-12 border-b border-border/80 bg-gradient-to-b from-card/40 to-transparent",
        isCenter ? "text-center" : "text-left",
        className
      )}
    >
      <div className={cn("max-w-5xl", isCard ? "w-full px-0" : "container mx-auto px-4")}>
        {backLink}
        <div className={cn(action ? "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" : "")}>
          <div>
            {badge && (
              <div
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-wider mb-3",
                  isCenter && "mx-auto"
                )}
              >
                {badgeIcon}
                <span>{badge}</span>
              </div>
            )}

            <h1
              className={cn(
                "font-display font-black tracking-tight text-foreground mb-2.5 flex items-center gap-2.5",
                compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl md:text-5xl",
                isCenter && "justify-center"
              )}
            >
              {icon}
              {title}
            </h1>

            {subtitle && (
              <p
                className={cn(
                  "text-muted-foreground text-sm sm:text-base font-medium max-w-2xl",
                  isCenter && "mx-auto",
                  children ? "mb-6" : ""
                )}
              >
                {subtitle}
              </p>
            )}
          </div>

          {action && (
            <div className="flex items-center gap-2 sm:self-center shrink-0">
              {action}
            </div>
          )}
        </div>

        {children && (
          <div
            className={cn(
              "flex items-center gap-3 flex-wrap pt-2",
              isCenter ? "justify-center" : "justify-start"
            )}
          >
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
