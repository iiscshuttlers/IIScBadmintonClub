import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  /** one-line summary shown next to the title while collapsed */
  summary?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  /** open and scroll into view (e.g. when a deep link targets this section) */
  focus?: boolean;
  /** children bring their own cards: render them below the header row instead of inside it */
  bare?: boolean;
  children: ReactNode;
}

const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm";

/**
 * A section that starts collapsed to a single row. Children mount only once the
 * section is first opened, so panels that fetch data stay idle until needed.
 */
export function CollapsibleSection({ title, summary, icon, defaultOpen = false, focus = false, bare = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen || focus);
  const [mounted, setMounted] = useState(defaultOpen || focus);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focus) return;
    setOpen(true);
    setMounted(true);
    const id = window.setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    return () => window.clearTimeout(id);
  }, [focus]);

  const header = (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => {
        setOpen((o) => !o);
        setMounted(true);
      }}
      className="w-full flex items-center gap-3 px-5 py-4 text-left"
    >
      {icon && <span className="shrink-0 text-primary [&_svg]:w-4 [&_svg]:h-4">{icon}</span>}
      <span className="shrink-0 font-black text-slate-800 dark:text-foreground">{title}</span>
      {summary && !open && <span className="min-w-0 truncate text-xs text-muted-foreground">{summary}</span>}
      <ChevronDown className={`ml-auto w-4 h-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
  );

  if (bare) {
    return (
      <div ref={ref} className="scroll-mt-20 space-y-3">
        <div className={cardCls}>{header}</div>
        {mounted && <div className={open ? "" : "hidden"}>{children}</div>}
      </div>
    );
  }

  return (
    <div ref={ref} className={`${cardCls} scroll-mt-20`}>
      {header}
      {mounted && <div className={open ? "px-5 pb-5" : "hidden"}>{children}</div>}
    </div>
  );
}
