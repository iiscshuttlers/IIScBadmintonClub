import { PUBLIC_SITE_BASE, PUBLIC_SITE_HOST } from "@/lib/deepLink";

/**
 * Printable A4 poster for a tournament's in-app registration: title, the open
 * categories with their closing times, and a QR code for the My entry panel.
 * Pure string builders so they're testable; the QR SVG is made by the caller.
 */

/** Shares and posters always use the public https site (the app opens it via App Links). */
export function publicLink(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `https://${PUBLIC_SITE_HOST}${PUBLIC_SITE_BASE}${p}`;
}

export interface PosterCategory {
  label: string;
  closes?: string | null; // already formatted (IST)
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function posterHtml(input: {
  tournament: string;
  dates?: string | null;
  categories: PosterCategory[];
  link: string;
  qrSvg: string;
}): string {
  const cats = input.categories.length
    ? input.categories
        .map((c) => `<li><span>${esc(c.label)}</span>${c.closes ? `<em>closes ${esc(c.closes)}</em>` : ""}</li>`)
        .join("")
    : "<li><span>All events</span></li>";
  // The QR SVG comes from the qrcode library (our own input), never from user text.
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(input.tournament)}: register</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: black; background: white; }
  main { max-width: 182mm; margin: 0 auto; padding: 8mm 0; text-align: center; }
  .club { font-size: 14pt; letter-spacing: .2em; text-transform: uppercase; font-weight: 700; }
  h1 { font-size: 34pt; line-height: 1.1; margin: 6mm 0 2mm; }
  .dates { font-size: 15pt; margin: 0 0 6mm; }
  .cta { font-size: 22pt; font-weight: 800; margin: 4mm 0; }
  .qr { width: 92mm; height: 92mm; margin: 4mm auto; }
  .qr svg { width: 100%; height: 100%; }
  ul { list-style: none; padding: 0; margin: 6mm auto; max-width: 140mm; text-align: left; font-size: 15pt; }
  li { display: flex; justify-content: space-between; gap: 6mm; border-bottom: 1px solid black; padding: 2.5mm 0; }
  em { font-style: normal; font-size: 12pt; }
  .steps { font-size: 13pt; margin: 6mm 0 2mm; }
  .link { font-size: 10pt; word-break: break-all; }
  @media print { .noprint { display: none; } }
  .noprint button { font-size: 13pt; padding: 3mm 6mm; margin-top: 6mm; }
</style></head>
<body><main>
  <div class="club">IISc Badminton Club</div>
  <h1>${esc(input.tournament)}</h1>
  ${input.dates ? `<p class="dates">${esc(input.dates)}</p>` : ""}
  <p class="cta">Scan to register in the app</p>
  <div class="qr" role="img" aria-label="QR code for the registration link">${input.qrSvg}</div>
  <ul>${cats}</ul>
  <p class="steps">Sign in, pick your events and your partner. You can change or withdraw until entries close.</p>
  <p class="link">${esc(input.link)}</p>
  <div class="noprint"><button onclick="window.print()">Print poster</button></div>
</main></body></html>`;
}
