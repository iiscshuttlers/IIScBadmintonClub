import { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { FileOpener } from "@capacitor-community/file-opener";

/** Drop-in replacement for the IIScShuttlers certificate generator.
 * Put the matching SVG and image assets in Vite's public/ directory.
 * The supplied signatures are ILLUSTRATIVE; replace them with authorised scans.
 */
export type Placement = "winner" | "runnerUp" | "third" | "fourth" | "participation" | "official";
export interface CertificateSignatory { name: string; title: string; imageUrl?: string; }
export interface CertificateInput {
  recipient: string;
  placement: Placement;
  category: string;
  tournamentName: string;
  date?: string;
  achievement?: string;
  certificateId?: string;
  signatories?: CertificateSignatory[];
}
export const PLACEMENT_META: Record<Placement, { title: string; medal: string; color: string; light: string }> = {
  winner:        { title: "Champion",    medal: "🥇", color: "#AF8A44", light: "#F5E9D0" },
  runnerUp:      { title: "Runner-up",   medal: "🥈", color: "#7B879A", light: "#E8ECF2" },
  third:         { title: "Third Place", medal: "🥉", color: "#A86B48", light: "#F2DFD1" },
  fourth:        { title: "Fourth Place",medal: "🎖️",color: "#3E628A", light: "#E3ECF5" },
  participation: { title: "Participant", medal: "🏸", color: "#3E7E79", light: "#DDEDE8" },
  official:      { title: "Official",    medal: "🛡️",color: "#786B96", light: "#EDE8F5" },
};
export function certificateWording(input: CertificateInput) {
  const meta = PLACEMENT_META[input.placement];
  if (input.placement === "participation") return {
    heading: "Certificate of Participation",
    lead: input.achievement ? "FOR REACHING THE STAGE OF" : "FOR PARTICIPATING AS A",
    highlight: input.achievement || meta.title,
  };
  if (input.placement === "official") return {
    heading: "Certificate of Appreciation",
    lead: "IN APPRECIATION OF SERVING AS",
    highlight: input.achievement || meta.title,
  };
  return { heading: "Certificate of Achievement", lead: "FOR FINISHING AS", highlight: input.achievement || meta.title };
}
export function expandCategory(cat: string): string {
  const map: Record<string, string> = {
    MS: "Men's Singles", WS: "Women's Singles", MD: "Men's Doubles", WD: "Women's Doubles", XD: "Mixed Doubles",
    BS: "Boys' Singles", GS: "Girls' Singles", BD: "Boys' Doubles", GD: "Girls' Doubles",
  };
  return map[cat.trim().toUpperCase()] ?? cat;
}
export function formatCertDate(date?: string): string {
  const raw = date?.trim();
  if (!raw) return "";
  if (/^\d{4}$/.test(raw)) return raw;
  // Avoid timezone-induced previous-month dates for YYYY-MM-DD values.
  const iso = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(raw);
  if (iso) {
    const month = +iso[2];
    if (month >= 1 && month <= 12) return new Date(Date.UTC(+iso[1], month - 1, 1))
      .toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

// Vector illustration authored at the same A4 aspect ratio as the PDF.
const W = 1400, H = 990, OUT_W = 3508, OUT_H = 2480;
const NAVY = "#081529", INK = "#111111", BLUE_INK = "#1239B3", GOLD = "#B58938";
const SERIF = '"Playfair Display", Georgia, "Times New Roman", serif';
const AWARD_SERIF = '"Cinzel", "Playfair Display", Georgia, serif';
const SANS = '"Inter", "Montserrat", Arial, sans-serif';
const SCRIPT = '"Caveat", "Segoe Script", cursive';
const PUBLIC_BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
const path = (file: string) => `${PUBLIC_BASE}${file}`;
const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  const prior = imageCache.get(url);
  if (prior) return prior;
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    // Vite public assets are same-origin. CORS enables user-supplied URLs when authorised.
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
  imageCache.set(url, promise);
  return promise;
}
async function fontsReady() {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('700 70px "Playfair Display"'),
      document.fonts.load('800 64px "Cinzel"'),
      document.fonts.load('600 32px "Inter"'),
      document.fonts.load('600 40px "Caveat"'),
    ]);
  } catch { /* graceful fallback; see README for recommended fonts */ }
}
function contain(ctx: CanvasRenderingContext2D, img: HTMLImageElement,
                 x: number, y: number, w: number, h: number) {
  const sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
  const s = Math.min(w / sw, h / sh);
  const dw = sw * s, dh = sh * s;
  ctx.drawImage(img, x + (w-dw)/2, y + (h-dh)/2, dw, dh);
}
interface TextStyle { size: number; min?: number; width: number; family?: string; weight?: number;
  color?: string; spacing?: number; align?: CanvasTextAlign; }
function fittedText(ctx: CanvasRenderingContext2D, text: string,
                    x: number, baseline: number, style: TextStyle) {
  const str = String(text || "").trim();
  if (!str) return;
  const family = style.family ?? SERIF, weight = style.weight ?? 700;
  const spacing = style.spacing ?? 0;
  let size = style.size;
  const min = style.min ?? 16;
  ctx.save();
  ctx.textAlign = style.align ?? "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = style.color ?? NAVY;
  for (; size > min; size--) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(str).width + Math.max(0, str.length - 1) * spacing <= style.width) break;
  }
  ctx.font = `${weight} ${size}px ${family}`;
  const full = ctx.measureText(str).width + (str.length - 1) * spacing;
  if (spacing > 0 && full <= style.width) {
    // Draw tracked capitals without relying on the experimental canvas letterSpacing property.
    let start = x - full / 2;
    ctx.textAlign = "left";
    for (const char of str) {
      ctx.fillText(char, start, baseline);
      start += ctx.measureText(char).width + spacing;
    }
  } else ctx.fillText(str, x, baseline, style.width);
  ctx.restore();
}
function framedText(ctx: CanvasRenderingContext2D, value: string,
                    y: number, style: TextStyle) {
  fittedText(ctx, value, W/2, y, style);
}

function tintHandwriting(img: HTMLImageElement, blue = BLUE_INK): HTMLCanvasElement {
  // Recolour only dark handwritten pixels. Works with white-background scans or transparent PNGs.
  const work = document.createElement("canvas");
  work.width = img.naturalWidth; work.height = img.naturalHeight;
  const ctx = work.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Cannot process signature image");
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, work.width, work.height);
  const data = pixels.data;
  const rInk = parseInt(blue.slice(1,3),16), gInk = parseInt(blue.slice(3,5),16), bInk = parseInt(blue.slice(5,7),16);
  for (let i=0; i<data.length; i+=4) {
    const originalAlpha = data[i+3]/255;
    const darkness = Math.max(0, (245 - (data[i]*.299 + data[i+1]*.587 + data[i+2]*.114))/220);
    const newAlpha = Math.round(255 * originalAlpha * Math.min(1, darkness * 1.3));
    data[i]=rInk; data[i+1]=gInk; data[i+2]=bInk; data[i+3]=newAlpha;
  }
  ctx.putImageData(pixels, 0, 0);
  return work;
}
function displaySignature(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null,
                          sign: CertificateSignatory, cx: number) {
  if (img) {
    const tinted = tintHandwriting(img);
    const ratio = tinted.width/tinted.height;
    const w = Math.min(195, 55*ratio), h = w/ratio;
    ctx.drawImage(tinted, cx-w/2, 854-h, w, h);
  } else {
    // Visual placeholder only: replace with a genuine, authorised signature before issuance.
    fittedText(ctx, sign.name, cx, 850, { family: SCRIPT, size: 40, min: 25,
      weight: 600, color: BLUE_INK, width: 208 });
  }
  fittedText(ctx, sign.name, cx, 888, { family: SANS, weight: 700, color: INK, size: 20, min: 15, width: 235 });
  fittedText(ctx, sign.title, cx, 912, { family: SANS, weight: 500, color: INK, size: 17, min: 13, width: 235 });
  fittedText(ctx, "IISc Badminton Club", cx, 935, { family: SANS, weight: 500, color: INK, size: 16, min: 13, width: 235 });
}

/** Generates an A4 landscape 3508×2480px certificate with vector-source artwork. */
export async function drawCertificate(input: CertificateInput): Promise<HTMLCanvasElement> {
  await fontsReady();
  const [artwork, officialLogo] = await Promise.all([
    loadImage(path("cert-artwork.svg")),
    loadImage(path("IISc_Master_Seal_Transparent.png")),
  ]);
  if (!artwork) throw new Error("Missing /public/cert-artwork.svg — copy the supplied artwork into public/");
  const signatories = input.signatories ?? [
    { name: "Aneesh Varla", title: "Co-Convener", imageUrl: path("sign-co-convener.png") },
    { name: "Raja Janmejay", title: "Convener", imageUrl: path("sign-convener.png") },
  ];
  const signatureImages = await Promise.all(signatories.slice(0,2).map(s => loadImage(s.imageUrl || "")));
  const c = document.createElement("canvas");
  c.width = OUT_W; c.height = OUT_H;
  const ctx = c.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(artwork, 0, 0, OUT_W, OUT_H);
  ctx.save();
  ctx.scale(OUT_W/W, OUT_H/H);
  // Header: preserve full official logo and the Hindi lettering, never circle-clip.
  if (officialLogo) contain(ctx, officialLogo, 330, 30, 220, 195);
  else fittedText(ctx, "IISc", 440, 152, { family: SERIF, size: 44, width: 130, color: NAVY });
  fittedText(ctx, "Indian Institute of Science", 845, 120,
    { family: SERIF, weight: 700, size: 40, min: 30, width: 530, color: NAVY });
  fittedText(ctx, "IISc Badminton Club", 845, 158,
    { family: SANS, weight: 500, size: 26, width: 490, color: "#194a8d" });

  const w = certificateWording(input);
  framedText(ctx, w.heading, 281, { family: SERIF, weight: 700, size: 76, min: 49,
    width: 1180, color: NAVY });
  framedText(ctx, "THIS CERTIFICATE IS PROUDLY PRESENTED TO", 332,
    { family: SANS, weight: 500, size: 17, min: 13, width: 920, color: NAVY, spacing: 4.1 });
  framedText(ctx, input.recipient || "Recipient Name", 406,
    { family: SERIF, weight: 800, size: 72, min: 34, width: 1070, color: NAVY });
  framedText(ctx, w.lead, 468,
    { family: SANS, weight: 500, size: 18, min: 13, width: 800, color: NAVY, spacing: 3.6 });
  // Ribbon plate: lettering is drawn ONCE in dark navy, with no opaque knockout pass.
  framedText(ctx, w.highlight.toUpperCase(), 580,
    { family: AWARD_SERIF, weight: 800, size: 57, min: 26, width: 421, color: NAVY, spacing: 1 });
  framedText(ctx, expandCategory(input.category), 677,
    { family: SANS, weight: 700, size: 32, min: 20, width: 920, color: NAVY });
  framedText(ctx, input.tournamentName, 718,
    { family: SANS, weight: 550, size: 24, min: 17, width: 900, color: NAVY });
  const date = formatCertDate(input.date);
  if (date) {
    ctx.save(); ctx.strokeStyle = "#325d91"; ctx.lineWidth = 1.2;
    ctx.beginPath();ctx.moveTo(510,759);ctx.lineTo(575,759);ctx.moveTo(825,759);ctx.lineTo(890,759);ctx.stroke();ctx.restore();
    framedText(ctx, date, 766, { family: SERIF, size: 25, min: 18,
      weight: 600, width: 240, color: "#194a8d" });
  }

  if (signatories.length === 1) {
    displaySignature(ctx, signatureImages[0], signatories[0], 300);
  } else if (signatories.length >= 2) {
    displaySignature(ctx, signatureImages[0], signatories[0], 300);
    displaySignature(ctx, signatureImages[1], signatories[1], 980);
  }
  framedText(ctx, "SPORTSMANSHIP  •  COMMUNITY  •  EXCELLENCE", 928,
    { family: SANS, weight: 500, size: 12, min: 11, width: 370, color: "#234971", spacing: 1.1 });
  if (input.certificateId?.trim()) {
    framedText(ctx, `Certificate ID: ${input.certificateId.trim()}`, 799,
      { family: SANS, weight: 500, size: 12, min: 10, width: 560, color: "#62718a" });
  }
  ctx.restore();
  return c;
}

function drawCardCentered(ctx: CanvasRenderingContext2D, text: string, y: number, opts: TextStyle) {
  fittedText(ctx, text, 540, y, opts);
}
export async function drawResultCard(input: CertificateInput): Promise<HTMLCanvasElement> {
  await fontsReady();
  const logo = await loadImage(path("IISc_Master_Seal_Transparent.png"));
  const S=1080;
  const canvas=document.createElement("canvas");canvas.width=2160;canvas.height=2160;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Result card canvas unavailable");
  ctx.scale(2,2);ctx.imageSmoothingQuality="high";
  const meta=PLACEMENT_META[input.placement];const words=certificateWording(input);
  const bg=ctx.createLinearGradient(0,0,S,S);bg.addColorStop(0,"#101E33");bg.addColorStop(1,"#213C5F");
  ctx.fillStyle=bg;ctx.fillRect(0,0,S,S);
  ctx.strokeStyle="#8393aa";ctx.lineWidth=2;ctx.strokeRect(29,29,S-58,S-58);
  ctx.strokeStyle="#B58938";ctx.lineWidth=1;ctx.strokeRect(36,36,S-72,S-72);
  if(logo)contain(ctx,logo,500,53,80,86);
  drawCardCentered(ctx,"IISc BADMINTON CLUB",183,{family:SANS,weight:700,size:29,width:840,color:"#E3E9F4",spacing:2});
  ctx.textAlign="center";ctx.font='166px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  ctx.fillText(meta.medal,540,417);
  drawCardCentered(ctx,words.highlight.toUpperCase(),540,{family:AWARD_SERIF,weight:800,size:79,min:35,width:860,color:"#FBFAF6"});
  ctx.strokeStyle=meta.color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(380,571);ctx.lineTo(700,571);ctx.stroke();
  drawCardCentered(ctx,input.recipient,661,{family:SANS,weight:700,size:68,min:29,width:895,color:"#FFFFFF"});
  drawCardCentered(ctx,expandCategory(input.category),744,{family:SANS,weight:650,size:43,min:22,width:900,color:"#DBE3EF"});
  drawCardCentered(ctx,input.tournamentName,828,{family:SANS,weight:550,size:34,min:20,width:895,color:"#ADBFD5"});
  drawCardCentered(ctx,formatCertDate(input.date),890,{family:SANS,weight:500,size:27,width:870,color:"#CAD4E2"});
  ctx.fillStyle=meta.color;ctx.fillRect(0,S-16,S,16);
  return canvas;
}

const slug=(s:string) => s.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase();
export function certificateFileBase(input:CertificateInput):string {
  return `${slug(input.tournamentName)}-${slug(input.category)}-${slug(input.recipient)}`.slice(0,120);
}
async function shareNative(base64:string,fileName:string,title:string) {
  const {uri}=await Filesystem.writeFile({path:fileName,data:base64,directory:Directory.Cache});
  await Share.share({title,files:[uri],dialogTitle:title});
}
function downloadBlob(blob:Blob,fileName:string) {
  const url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function saveCertificatePdf(input:CertificateInput,canvas?:HTMLCanvasElement) {
  const c=canvas??await drawCertificate(input);
  const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});
  pdf.addImage(c.toDataURL("image/jpeg",.98),"JPEG",0,0,297,210);
  pdf.setProperties({title:`${certificateWording(input).heading} - ${input.recipient}`,
    subject:`${input.tournamentName} - ${expandCategory(input.category)}`,author:"IISc Badminton Club"});
  const fileName=`${certificateFileBase(input)}-certificate.pdf`;
  if(Capacitor.isNativePlatform()) {
    const base64=pdf.output("datauristring").split(",")[1];
    const {uri}=await Filesystem.writeFile({path:fileName,data:base64,directory:Directory.Cache});
    await FileOpener.open({filePath:uri,contentType:"application/pdf",openWithDefault:true});
  } else downloadBlob(pdf.output("blob"),fileName);
}
export async function shareResultCard(input:CertificateInput,canvas?:HTMLCanvasElement) {
  const c=canvas??await drawResultCard(input);
  const fileName=`${certificateFileBase(input)}.png`;
  const text=`${PLACEMENT_META[input.placement].medal} ${input.recipient} — ${certificateWording(input).highlight}, ${expandCategory(input.category)} at ${input.tournamentName}`;
  if(Capacitor.isNativePlatform()) {
    await shareNative(c.toDataURL("image/png").split(",")[1],fileName,"Share result");return;
  }
  const blob=await new Promise<Blob|null>(resolve=>c.toBlob(resolve,"image/png"));
  if(!blob)throw new Error("Could not render result card");
  const file=new File([blob],fileName,{type:"image/png"});
  if(navigator.canShare?.({files:[file]})) {
    try{await navigator.share({title:"IISc Badminton Club",text,files:[file]});return;}
    catch(error:unknown){if((error as {name?:string})?.name==="AbortError")return;}
  }
  downloadBlob(blob,fileName);
}
