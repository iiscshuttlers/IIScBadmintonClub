import { Check } from "lucide-react";

const STEPS = [
  { key: "draft", label: "Draft" },
  { key: "active", label: "Live" },
  { key: "completed", label: "Completed" },
] as const;

/** Map any tournament status to the lifecycle step index. */
function statusToIndex(status: string): number {
  switch (status) {
    case "draft":
      return 0;
    case "active":
    case "upcoming":
      return 1;
    case "completed":
    case "archived":
      return 2;
    default:
      return 0;
  }
}

interface LifecycleStepperProps {
  status: string;
  /** theme accent for the active step, e.g. "bg-violet-600" */
  accentBg?: string;
  className?: string;
}

/**
 * Compact lifecycle stepper: Draft → Live → Completed. Past steps are filled,
 * the current step uses the event-family accent, future steps are outlined.
 * Scrolls rather than overflowing on narrow screens.
 */
export function LifecycleStepper({ status, accentBg = "bg-primary", className = "" }: LifecycleStepperProps) {
  const current = statusToIndex(status);

  return (
    <ol className={`flex items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {STEPS.map((step, i) => {
        const isDone = i < current;
        const isCurrent = i === current;
        return (
          <li key={step.key} className="flex items-center gap-1.5 shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${
                isCurrent
                  ? `${accentBg} text-white`
                  : isDone
                    ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    : "border border-dashed border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-500"
              }`}
            >
              {isDone ? (
                <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
              ) : (
                <span className="text-[10px] tabular-nums">{i + 1}</span>
              )}
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className={`h-px w-4 shrink-0 ${i < current ? "bg-slate-300 dark:bg-slate-600" : "bg-slate-200 dark:bg-slate-700"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
