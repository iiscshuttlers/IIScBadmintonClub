import { useState, useEffect } from "react";

export function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const el = document.documentElement;
          const scrolled = el.scrollTop || document.body.scrollTop;
          const total = el.scrollHeight - el.clientHeight;
          // Clamp: after navigating to a shorter page the old scrollTop can
          // exceed the new scroll range and push the bar past the screen edge.
          setPct(total > 0 ? Math.min(100, (scrolled / total) * 100) : 0);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[3px] bg-transparent pointer-events-none">
      <div
        className="h-full bg-primary transition-[width] duration-75 ease-out shadow-[0_0_8px_color-mix(in_srgb,var(--primary)_60%,transparent)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
