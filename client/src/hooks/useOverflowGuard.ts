import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Dev-only horizontal-overflow detector.
 *
 * Background: a "ghost sliver" of content once appeared to peek on the left of
 * /personal and /. Live measurement proved the layout was NOT broken — the app
 * clips horizontal overflow via `body { overflow-x: hidden }`
 * (client/src/index.css) plus a shell-level `overflow-x-clip` in App.tsx. That
 * sliver was an HMR / page-transition / device-emulator paint artifact, not a
 * CSS bug, and a hard reload clears it.
 *
 * This hook exists so that if a REAL stray-wide element is ever introduced, it
 * is surfaced loudly in development instead of being silently clipped and
 * mistaken for a phantom again. It is completely inert in production.
 *
 * Note: because the shell/body clip pins `documentElement.scrollWidth` to the
 * viewport width, we cannot detect overflow from scroll metrics — a clipped
 * element never grows the scroll area. Instead we scan element geometry
 * (getBoundingClientRect, which is unaffected by clipping) for elements that
 * extend past the viewport, and report only those that are NOT already
 * contained by a local clipping ancestor. To keep signal high we skip:
 *   - SVG internals (they clip within their <svg> and are never layout bugs),
 *   - out-of-flow decorative layers (position: absolute / fixed — blur orbs,
 *     textures),
 *   - anything a local ancestor clips on the x-axis (overflow-x
 *     hidden/clip/scroll/auto) — e.g. full-bleed hero sections that
 *     intentionally overflow and clip their own content.
 * The app shell (marked `data-overflow-root`) is excluded from that
 * ancestor-clip check, so a genuinely stray element that only the global shell
 * clip catches is still reported. What remains is real content-overflow bugs
 * (wide tables, unbreakable strings, non-wrapping flex rows).
 */
export function useOverflowGuard() {
  const [location] = useLocation();

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const THRESHOLD = 4; // px past the viewport before we care (ignore sub-pixel noise)
    const timers: ReturnType<typeof setTimeout>[] = [];

    const check = () => {
      const vw = window.innerWidth;
      const offenders: {
        tag: string;
        class: string;
        left: number;
        right: number;
        width: number;
      }[] = [];

      const clips = (v: string) =>
        v === "hidden" || v === "clip" || v === "scroll" || v === "auto";

      document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
        // SVG internals clip within their <svg>; never a layout-overflow bug.
        if (el instanceof SVGElement) return;

        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.right <= vw + THRESHOLD && r.left >= -THRESHOLD) return;

        // Ignore decorative / out-of-flow layers (orbs, textures, portals).
        const pos = getComputedStyle(el).position;
        if (pos === "absolute" || pos === "fixed") return;

        // Ignore anything a local ancestor already clips on the x-axis
        // (e.g. full-bleed hero sections). Stop at the shell root so a stray
        // element clipped ONLY by the global shell is still reported.
        let contained = false;
        for (
          let a = el.parentElement;
          a && a !== document.body && !a.hasAttribute("data-overflow-root");
          a = a.parentElement
        ) {
          if (clips(getComputedStyle(a).overflowX)) {
            contained = true;
            break;
          }
        }
        if (contained) return;

        const cls =
          typeof el.className === "string"
            ? el.className
            : (el.getAttribute("class") ?? "");
        offenders.push({
          tag: el.tagName.toLowerCase(),
          class: cls.slice(0, 80),
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
        });
      });

      if (offenders.length === 0) return;

      // Widest first — the likely culprit.
      offenders.sort((a, b) => b.width - a.width);

      console.warn(
        `[overflow-guard] ${offenders.length} in-flow element(s) extend past the ` +
          `viewport (${vw}px) on "${location}". These are clipped for users but ` +
          `indicate a layout bug:`,
      );
      // eslint-disable-next-line no-console
      console.table(offenders.slice(0, 15));
    };

    const schedule = (delay = 250) => {
      timers.push(setTimeout(check, delay));
    };

    // After mount/route change: once after paint, once more after async data
    // has likely loaded (data-driven overflow can appear after the first paint).
    schedule(250);
    schedule(1500);
    const onResize = () => schedule(250);
    window.addEventListener("resize", onResize);

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", onResize);
    };
  }, [location]);
}
