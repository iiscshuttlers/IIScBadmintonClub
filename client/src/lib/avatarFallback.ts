import { themeColor } from "@/lib/themeColors";

/**
 * Player photos come from Google accounts (lh3.googleusercontent.com) or
 * storage. When one fails to load (Google throttling a page of 100+ photos,
 * a privacy browser blocking googleusercontent.com, a deleted file), the
 * browser draws a broken-image icon plus the alt text. Components that own an
 * avatar handle onError themselves (ui/Avatar, PlayerCard); this is the
 * app-wide safety net for the rest: a failed *round* image with a name in
 * `alt` is swapped for an initials picture in the theme's colours.
 */

export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

/** A square SVG (data URI) with the initials centred. */
export function initialsAvatarUri(name: string | null | undefined, bg: string, fg: string): string {
  const text = initialsOf(name).replace(/[<>&"']/g, "");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">` +
    `<rect width="96" height="96" fill="${bg}"/>` +
    `<text x="48" y="50" dominant-baseline="middle" text-anchor="middle" ` +
    `font-family="system-ui, sans-serif" font-size="38" font-weight="800" fill="${fg}">${text}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Avatars are round: the image or one of its close ancestors is `rounded-full`. */
export function looksLikeAvatar(img: HTMLImageElement): boolean {
  if (!img.alt.trim()) return false;
  const round = (el: Element | null) => !!el && el.classList.contains("rounded-full");
  return round(img) || round(img.parentElement) || round(img.parentElement?.parentElement ?? null);
}

/** Installs the capture-phase listener (image errors don't bubble). Returns the uninstaller. */
export function installAvatarFallback(doc: Document = document): () => void {
  const onError = (event: Event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.avatarFallback === "1" || !looksLikeAvatar(img)) return;
    img.dataset.avatarFallback = "1";
    img.removeAttribute("srcset");
    img.src = initialsAvatarUri(img.alt, themeColor("muted-strong") || "Canvas", themeColor("foreground") || "CanvasText");
  };
  doc.addEventListener("error", onError, true);
  return () => doc.removeEventListener("error", onError, true);
}
