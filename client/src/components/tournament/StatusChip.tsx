import React from "react";
import { Radio, Clock, CheckCircle2, AlertCircle, Archive } from "lucide-react";

export type TournamentStatusState =
  | "live"
  | "in_progress"
  | "active"
  | "scheduled"
  | "upcoming"
  | "completed"
  | "archived"
  | "pending"
  | "locked";

interface StatusConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  classes: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  live: {
    label: "LIVE",
    icon: Radio,
    classes: "bg-danger text-danger-foreground font-black animate-pulse shadow-sm shadow-danger/40",
  },
  in_progress: {
    label: "LIVE",
    icon: Radio,
    classes: "bg-danger text-danger-foreground font-black animate-pulse shadow-sm shadow-danger/40",
  },
  active: {
    label: "LIVE",
    icon: Radio,
    classes: "bg-danger text-danger-foreground font-black animate-pulse shadow-sm shadow-danger/40",
  },
  scheduled: {
    label: "SCHEDULED",
    icon: Clock,
    classes: "bg-muted-strong/80 text-soft border border-border-strong/50",
  },
  upcoming: {
    label: "UPCOMING",
    icon: Clock,
    classes: "bg-primary/10 text-primary border border-primary/20",
  },
  pending: {
    label: "LINEUP PENDING",
    icon: AlertCircle,
    classes: "bg-warning/15 text-warning border border-warning/30",
  },
  locked: {
    label: "LINEUPS LOCKED",
    icon: CheckCircle2,
    classes: "bg-success/15 text-success border border-success/30",
  },
  completed: {
    label: "COMPLETED",
    icon: CheckCircle2,
    classes: "bg-success/15 text-success border border-success/30",
  },
  archived: {
    label: "ARCHIVED",
    icon: Archive,
    classes: "bg-muted text-muted-foreground border border-border-strong/60",
  },
};

export interface StatusChipProps {
  state?: TournamentStatusState | string | null;
  label?: string;
  compact?: boolean;
  className?: string;
}

export function StatusChip({
  state,
  label: customLabel,
  compact = false,
  className = "",
}: StatusChipProps) {
  const normalizedKey = (state || "").toLowerCase().replace("-", "_");
  const cfg = STATUS_CONFIG[normalizedKey] || {
    label: customLabel || normalizedKey.toUpperCase() || "UNKNOWN",
    icon: Clock,
    classes: "bg-muted text-soft border border-border-strong",
  };

  const Icon = cfg.icon;
  const label = customLabel || cfg.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-black uppercase tracking-wider shrink-0 select-none ${
        compact ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-0.5 text-[10px]"
      } ${cfg.classes} ${className}`}
    >
      <Icon className={compact ? "w-2.5 h-2.5 shrink-0" : "w-3 h-3 shrink-0"} />
      <span>{label}</span>
    </span>
  );
}
