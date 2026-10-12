import React from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

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
  /** wouter href for a back link (rendered above the title). */
  backTo?: string;
  /** Custom back handler (takes precedence over backTo). */
  onBack?: () => void;
  /** Back link label. */
  backLabel?: string;
  /** Tighter, borderless header for account/utility pages. */
  compact?: boolean;
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
}: PageHeaderProps) {
  const isCenter = align === "center" && !compact;

  const backLink = (onBack || backTo) ? (
    onBack ? (
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition mb-3"
      >
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </button>
    ) : (
      <Link href={backTo!}>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition mb-3 cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </span>
      </Link>
    )
  ) : null;

  return (
    <header
      className={cn(
        "relative",
        compact
          ? "py-5 sm:py-6"
          : "py-8 sm:py-12 border-b border-slate-200 dark:border-slate-800/80 bg-gradient-to-b from-slate-100/60 dark:from-slate-900/40 to-transparent",
        isCenter ? "text-center" : "text-left",
        className
      )}
    >
      <div className="container mx-auto px-4 max-w-5xl">
        {backLink}
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
            "font-black tracking-tight text-slate-900 dark:text-white mb-2.5 flex items-center gap-2.5",
            compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl md:text-5xl",
            isCenter && "justify-center"
          )}
          style={{ fontFamily: "Outfit, Inter, sans-serif" }}
        >
          {icon}
          {title}
        </h1>

        {subtitle && (
          <p
            className={cn(
              "text-slate-600 dark:text-slate-400 text-sm sm:text-base font-medium max-w-2xl",
              isCenter && "mx-auto",
              children ? "mb-6" : ""
            )}
          >
            {subtitle}
          </p>
        )}

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
