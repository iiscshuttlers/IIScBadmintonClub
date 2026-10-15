import { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

/**
 * Winner certificates (A4 landscape → PDF) and square result cards (→ PNG for
 * WhatsApp/Instagram), both drawn on a canvas so they work offline and on web.
 */

export type Placement = "winner" | "runnerUp" | "third" | "fourth";

export interface CertificateInput {
  recipient: string;
  placement: Placement;
  category: string;
  tournamentName: string;
  /** Free text, e.g. "May 2026" or an ISO date. */
  date?: string;
}

export const PLACEMENT_META: Record<Placement, { title: string; medal: string; color: string; light: string }> = {
  winner: { title: "Champion", medal: "🥇", color: "#b7791f", light: "#fef3c7" },
  runnerUp: { title: "Runner-up", medal: "🥈", color: "#64748b", light: "#f1f5f9" },
  third: { title: "Third Place", medal: "🥉", color: "#c2410c", light: "#ffedd5" },
  fourth: { title: "Fourth Place", medal: "🎖️", color: "#1d4ed8", light: "#dbeafe" },
};

export function formatCertDate(date?: string): string {
  if (!date) return "";
  if (/^\d{4}$/.test(date)) return date;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/** Shrink font until text fits maxWidth. */
function fitText(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, start: number, maxWidth: number) {
  let px = start;
  ctx.font = font(px);
  while (px > 12 && ctx.measureText(text).width > maxWidth) {
    px -= 2;
    ctx.font = font(px);
  }
  return px;
}

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('800 80px "Playfair Display"'),
      document.fonts.load('700 40px "Outfit"'),
      document.fonts.load('500 30px "Inter"'),
    ]);
  } catch {
    /* fall back to system fonts */
  }
}

const SERIF = (px: number) => `800 ${px}px "Playfair Display", Georgia, serif`;
const DISPLAY = (w: number, px: number) => `${w} ${px}px "Outfit", "Inter", system-ui, sans-serif`;
const BODY = (w: number, px: number) => `${w} ${px}px "Inter", system-ui, sans-serif`;

/** A4 landscape at ~150 dpi. */
export async function drawCertificate(input: CertificateInput): Promise<HTMLCanvasElement> {
  await fontsReady();
  const W = 1754;
  const H = 1240;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const meta = PLACEMENT_META[input.placement];

  // Paper + double border
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = meta.color;
  ctx.lineWidth = 14;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.lineWidth = 3;
  ctx.strokeRect(72, 72, W - 144, H - 144);

  // Corner ornaments
  ctx.fillStyle = meta.light;
  for (const [x, y] of [[72, 72], [W - 72, 72], [72, H - 72], [W - 72, H - 72]]) {
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#0f172a";
  ctx.font = DISPLAY(700, 34);
  ctx.fillText("IISc BADMINTON CLUB", W / 2, 190);

  ctx.fillStyle = meta.color;
  ctx.font = SERIF(96);
  ctx.fillText("Certificate of Achievement", W / 2, 320);

  ctx.fillStyle = "#475569";
  ctx.font = BODY(500, 34);
  ctx.fillText("This certificate is proudly presented to", W / 2, 420);

  ctx.fillStyle = "#0f172a";
  fitText(ctx, input.recipient, SERIF, 110, W - 360);
  ctx.fillText(input.recipient, W / 2, 560);

  // Underline under the name
  ctx.strokeStyle = meta.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 420, 600);
  ctx.lineTo(W / 2 + 420, 600);
  ctx.stroke();

  ctx.fillStyle = "#475569";
  ctx.font = BODY(500, 34);
  ctx.fillText("for finishing as", W / 2, 680);

  ctx.fillStyle = meta.color;
  ctx.font = DISPLAY(800, 72);
  ctx.fillText(`${meta.medal} ${meta.title}`, W / 2, 780);

  ctx.fillStyle = "#0f172a";
  fitText(ctx, input.category, (px) => DISPLAY(700, px), 46, W - 360);
  ctx.fillText(input.category, W / 2, 860);

  ctx.fillStyle = "#334155";
  fitText(ctx, input.tournamentName, (px) => DISPLAY(600, px), 42, W - 360);
  ctx.fillText(input.tournamentName, W / 2, 930);

  const date = formatCertDate(input.date);
  ctx.font = BODY(500, 28);
  ctx.fillStyle = "#64748b";
  if (date) ctx.fillText(date, W / 2, 990);

  // Signature line
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W - 560, 1080);
  ctx.lineTo(W - 200, 1080);
  ctx.stroke();
  ctx.font = BODY(600, 24);
  ctx.fillStyle = "#475569";
  ctx.fillText("Club Convener", W - 380, 1116);

  ctx.textAlign = "left";
  ctx.font = BODY(500, 22);
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("Issued via IIScShuttlers", 200, 1116);

  return c;
}

/** 1080×1080 card for social sharing. */
export async function drawResultCard(input: CertificateInput): Promise<HTMLCanvasElement> {
  await fontsReady();
  const S = 1080;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  const meta = PLACEMENT_META[input.placement];

  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, "#0f172a");
  g.addColorStop(1, "#1e293b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // Glow behind the medal
  const glow = ctx.createRadialGradient(S / 2, 330, 20, S / 2, 330, 320);
  glow.addColorStop(0, meta.color + "aa");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);

  ctx.textAlign = "center";
  ctx.fillStyle = "#94a3b8";
  ctx.font = DISPLAY(700, 30);
  ctx.fillText("IISc BADMINTON CLUB", S / 2, 110);

  ctx.font = `200px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.fillText(meta.medal, S / 2, 400);

  ctx.fillStyle = meta.light;
  ctx.font = DISPLAY(800, 84);
  ctx.fillText(meta.title.toUpperCase(), S / 2, 540);

  ctx.fillStyle = "#ffffff";
  fitText(ctx, input.recipient, (px) => DISPLAY(800, px), 76, S - 140);
  ctx.fillText(input.recipient, S / 2, 660);

  ctx.fillStyle = "#e2e8f0";
  fitText(ctx, input.category, (px) => DISPLAY(600, px), 44, S - 140);
  ctx.fillText(input.category, S / 2, 750);

  ctx.fillStyle = "#94a3b8";
  fitText(ctx, input.tournamentName, (px) => BODY(600, px), 36, S - 140);
  ctx.fillText(input.tournamentName, S / 2, 820);

  const date = formatCertDate(input.date);
  if (date) {
    ctx.font = BODY(500, 28);
    ctx.fillText(date, S / 2, 870);
  }

  ctx.fillStyle = meta.color;
  ctx.fillRect(0, S - 16, S, 16);
  return c;
}

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

export function certificateFileBase(input: CertificateInput) {
  return `${slug(input.tournamentName)}-${slug(input.category)}-${slug(input.recipient)}`.slice(0, 120);
}

async function shareNative(base64: string, fileName: string, title: string) {
  const { uri } = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
  await Share.share({ title, files: [uri], dialogTitle: title });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveCertificatePdf(input: CertificateInput, canvas?: HTMLCanvasElement) {
  const c = canvas ?? (await drawCertificate(input));
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.addImage(c.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 297, 210);
  const fileName = `${certificateFileBase(input)}-certificate.pdf`;
  if (Capacitor.isNativePlatform()) {
    await shareNative(pdf.output("datauristring").split(",")[1], fileName, "Save certificate");
  } else {
    pdf.save(fileName);
  }
}

export async function shareResultCard(input: CertificateInput, canvas?: HTMLCanvasElement) {
  const c = canvas ?? (await drawResultCard(input));
  const fileName = `${certificateFileBase(input)}.png`;
  const text = `${PLACEMENT_META[input.placement].medal} ${input.recipient} — ${PLACEMENT_META[input.placement].title}, ${input.category} at ${input.tournamentName}`;
  if (Capacitor.isNativePlatform()) {
    await shareNative(c.toDataURL("image/png").split(",")[1], fileName, "Share result");
    return;
  }
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/png"));
  if (!blob) throw new Error("Could not render image");
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: "IISc Badminton Club", text, files: [file] });
      return;
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }
  }
  downloadBlob(blob, fileName);
}
