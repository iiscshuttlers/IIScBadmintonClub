import type { ReactNode } from "react";
import { Loader2, Megaphone, UserCheck } from "lucide-react";
import {
  presenceLabel,
  presenceTone,
  spectatorLabel,
  type PlayerPresence,
} from "@/lib/matchReadiness";

/**
 * Small shared pieces for the check-in feature. Status is always spelled out
 * in words (never colour alone).
 */

const TONE_CLASS: Record<ReturnType<typeof presenceTone>, string> = {
  here: "bg-emerald-500/15 text-emerald-300",
  court: "bg-cyan-500/15 text-cyan-300",
  break: "bg-amber-500/15 text-amber-300",
  rest: "bg-violet-500/15 text-violet-300",
  none: "bg-slate-800 text-slate-300",
};

const DOT_CLASS: Record<ReturnType<typeof presenceTone>, string> = {
  here: "bg-emerald-400",
  court: "bg-cyan-300",
  break: "bg-amber-300",
  rest: "bg-violet-300",
  none: "",
};

export function PresenceChip({ presence, withTime = true, className = "" }: { presence: PlayerPresence; withTime?: boolean; className?: string }) {
  const tone = presenceTone(presence);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${TONE_CLASS[tone]} ${className}`}>
      {DOT_CLASS[tone] && <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[tone]}`} aria-hidden />}
      {presenceLabel(presence, { withTime })}
    </span>
  );
}

export function MatchCodeChip({ code, className = "" }: { code: string | null | undefined; className?: string }) {
  if (!code) return null;
  return (
    <span className={`inline-flex shrink-0 items-center rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] font-black text-slate-100 ${className}`}>
      {code}
    </span>
  );
}

/** Spectator chip: "Both sides here" / "Waiting for players". No names, ever. */
export function SpectatorChip({ ready, className = "" }: { ready: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${
        ready ? "bg-primary/15 text-primary" : "bg-slate-800 text-slate-300"
      } ${className}`}
    >
      {ready && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
      {spectatorLabel(ready)}
    </span>
  );
}

export function SmallButton({
  children,
  onClick,
  busy = false,
  tone = "neutral",
  disabled = false,
  label,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  busy?: boolean;
  tone?: "neutral" | "primary" | "warning";
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const toneCls =
    tone === "primary"
      ? "bg-primary text-primary-foreground border-primary"
      : tone === "warning"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
        : "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700";
  return (
    <button
      type="button"
      aria-label={label}
      disabled={busy || disabled}
      onClick={onClick}
      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${toneCls} ${className}`}
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function CheckInForThemButton({ onClick, busy, name }: { onClick: () => void; busy?: boolean; name: string }) {
  return (
    <SmallButton onClick={onClick} busy={busy} label={`Check in ${name}`}>
      <UserCheck className="h-3.5 w-3.5" aria-hidden /> Check in for them
    </SmallButton>
  );
}

export function CallButton({ onClick, busy, name, children }: { onClick: () => void; busy?: boolean; name?: string; children?: ReactNode }) {
  return (
    <SmallButton onClick={onClick} busy={busy} tone="warning" label={name ? `Call ${name}` : undefined}>
      <Megaphone className="h-3.5 w-3.5" aria-hidden /> {children ?? "Call"}
    </SmallButton>
  );
}

export function SectionTitle({ dot, title, count }: { dot: string; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      <h3 className="text-sm font-black text-slate-100">{title}</h3>
      {count != null && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-black text-slate-300">{count}</span>}
    </div>
  );
}
