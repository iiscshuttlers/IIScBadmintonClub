import { toast } from "sonner";
import { jsPDF } from "jspdf";

export interface ProfilePdfData {
  playerName: string;
  avatarUrl?: string;
  department?: string;
  joinedYear?: number;
  playingLevel?: string;
  favoriteShot?: string;
  favoriteFormat?: string;
  winRate?: number;
  totalMatches?: number;
  wins?: number;
  losses?: number;
  ranking?: {
    overall?: number;
    singles?: number;
    doubles?: number;
    mixed?: number;
  };
  instagram?: string;
}

// Load an image into a canvas-drawable HTMLImageElement
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  // Strategy 1: Try direct load (works if same-origin or CORS-enabled)
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = url;
    });
    return img;
  } catch {
    // Strategy 2: Fetch → blob → object URL
    try {
      const res = await fetch(url, { mode: "cors" });
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = objectUrl;
      });
      return img;
    } catch {
      return null;
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export async function exportProfilePdf(data: ProfilePdfData) {
  const toastId = toast.loading("Generating profile card...");
  try {
    const {
      playerName,
      avatarUrl,
      department,
      joinedYear,
      playingLevel,
      winRate = 0,
      totalMatches = 0,
      wins = 0,
      losses = 0,
      ranking = {},
      instagram,
      favoriteShot,
      favoriteFormat,
    } = data;

    const W = 1080;
    const H = 2160;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // ── Theme Selection ──
    let primaryGradColors = ["#b45309", "#d97706", "#f59e0b"]; // Amber (default)
    let accentGlow1 = "rgba(245,158,11,0.18)";
    let accentGlow2 = "rgba(59,130,246,0.12)";
    let shadowColor = "rgba(245,158,11,0.4)";
    let strokeColor = "#f59e0b";
    
    if (winRate >= 70 && totalMatches >= 10) {
      primaryGradColors = ["#0ea5e9", "#3b82f6", "#2563eb"]; // Blue / Diamond
      accentGlow1 = "rgba(59,130,246,0.25)";
      accentGlow2 = "rgba(168,85,247,0.12)";
      shadowColor = "rgba(59,130,246,0.5)";
      strokeColor = "#3b82f6";
    } else if (winRate >= 50 && totalMatches >= 5) {
      primaryGradColors = ["#059669", "#10b981", "#34d399"]; // Emerald
      accentGlow1 = "rgba(16,185,129,0.2)";
      accentGlow2 = "rgba(59,130,246,0.12)";
      shadowColor = "rgba(16,185,129,0.5)";
      strokeColor = "#10b981";
    }

    // ── Background ──
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#0d1f3c");
    bgGrad.addColorStop(0.5, "#0a1628");
    bgGrad.addColorStop(1, "#050d1a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    const glow1 = ctx.createRadialGradient(W, 0, 0, W, 0, 600);
    glow1.addColorStop(0, accentGlow1);
    glow1.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, W, H);

    const glow2 = ctx.createRadialGradient(0, H, 0, 0, H, 700);
    glow2.addColorStop(0, accentGlow2);
    glow2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    try {
      const logoImg = await loadImage("/iisc-logo.png");
      if (logoImg) {
        ctx.save();
        ctx.globalAlpha = 0.05;
        const logoSize = 800;
        ctx.drawImage(logoImg, W/2 - logoSize/2, H/2 - logoSize/2, logoSize, logoSize);
        ctx.restore();
      }
    } catch (e) {}

    // ── Header ──
    const headerH = 200;
    const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
    headerGrad.addColorStop(0, primaryGradColors[0]);
    headerGrad.addColorStop(0.5, primaryGradColors[1]);
    headerGrad.addColorStop(1, primaryGradColors[2]);
    ctx.fillStyle = headerGrad;
    roundRect(ctx, 0, 0, W, headerH, 0);
    ctx.fill();

    ctx.save();
    ctx.globalAlpha = 0.15;
    const shine = ctx.createLinearGradient(0, 0, 0, headerH);
    shine.addColorStop(0, "#ffffff");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, W, headerH);
    ctx.restore();

    ctx.fillStyle = "#1a0a00";
    ctx.font = "900 70px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("IISc BADMINTON CLUB", 54, 105);
    ctx.font = "700 36px sans-serif";
    ctx.globalAlpha = 0.7;
    ctx.fillText("PLAYER CARD", 54, 160);
    ctx.globalAlpha = 1;

    // ── Avatar ──
    const avatarCX = W / 2;
    const avatarCY = headerH + 200;
    const avatarR = 150;

    ctx.save();
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 60;
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarR + 8, 0, Math.PI * 2);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
    ctx.clip();

    const avatarImg = avatarUrl ? await loadImage(avatarUrl) : null;
    if (avatarImg) {
      ctx.drawImage(avatarImg, avatarCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2);
    } else {
      const initGrad = ctx.createLinearGradient(avatarCX - avatarR, avatarCY - avatarR, avatarCX + avatarR, avatarCY + avatarR);
      initGrad.addColorStop(0, "#1e3a5f");
      initGrad.addColorStop(1, "#0d2644");
      ctx.fillStyle = initGrad;
      ctx.fillRect(avatarCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2);
      const initials = playerName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      ctx.font = `900 ${avatarR}px sans-serif`;
      ctx.fillStyle = strokeColor;
      ctx.textAlign = "center";
      ctx.fillText(initials, avatarCX, avatarCY + avatarR * 0.35);
    }
    ctx.restore();

    // ── Player Name ──
    const nameParts = playerName.trim().split(/\s+/);
    const lastName = nameParts.pop() || "";
    const firstName = nameParts.join(" ");
    let nameY = avatarCY + avatarR + 80;

    if (firstName) {
      ctx.font = "600 52px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.textAlign = "center";
      ctx.letterSpacing = "0.2em";
      ctx.fillText(firstName.toUpperCase(), W / 2, nameY);
      nameY += 100;
    }

    ctx.font = "900 120px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(lastName.toUpperCase(), W / 2, nameY);

    const ulW = Math.min(ctx.measureText(lastName.toUpperCase()).width * 0.6, 300);
    ctx.fillStyle = strokeColor;
    ctx.fillRect(W / 2 - ulW / 2, nameY + 20, ulW, 6);

    // ── Info Chips ──
    const chips: string[] = [];
    if (department) chips.push(department);
    if (joinedYear) chips.push(`Class of ${joinedYear}`);
    if (playingLevel) chips.push(playingLevel);
    if (instagram) chips.push(`@${instagram.replace("@", "")}`);

    ctx.font = "600 28px sans-serif";
    const chipH = 56;
    const chipGap = 18;
    const chipPad = 44;
    const chipRowGap = 20;
    const chipMaxX = W - 60;
    const chipStartY = nameY + 70;

    const chipRows: Array<Array<{ label: string; w: number }>> = [];
    let currentRow: Array<{ label: string; w: number }> = [];
    let rowW = 0;
    chips.forEach((label) => {
      const cw = ctx.measureText(label).width + chipPad;
      if (currentRow.length > 0 && 60 + rowW + chipGap + cw > chipMaxX) {
        chipRows.push(currentRow);
        currentRow = [];
        rowW = 0;
      }
      currentRow.push({ label, w: cw });
      rowW += (currentRow.length > 1 ? chipGap : 0) + cw;
    });
    if (currentRow.length) chipRows.push(currentRow);

    let chipRowY = chipStartY;
    chipRows.forEach((row) => {
      const totalW = row.reduce((s, c) => s + c.w, 0) + chipGap * (row.length - 1);
      let cx = (W - totalW) / 2;
      row.forEach(({ label, w: cw }) => {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        roundRect(ctx, cx, chipRowY, cw, chipH, chipH / 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1.5;
        roundRect(ctx, cx, chipRowY, cw, chipH, chipH / 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.textAlign = "center";
        ctx.fillText(label, cx + cw / 2, chipRowY + 38);
        cx += cw + chipGap;
      });
      chipRowY += chipH + chipRowGap;
    });

    const chipY = chipRowY;
    const radarCY = chipY + 320;
    
    // ── Radar Chart ──
    const mapRank = (r?: number) => {
      if (!r || r > 50) return 30;
      return Math.max(0, 100 - (r * 1.5));
    };
    
    const radarData = [
      { label: "Win Rate", value: Math.min(100, Math.max(0, winRate)) },
      { label: "Singles", value: mapRank(ranking.overall || ranking.singles) },
      { label: "Doubles", value: mapRank(ranking.doubles) },
      { label: "Mixed", value: mapRank(ranking.mixed) },
      { label: "Activity", value: Math.min(100, totalMatches * 2) },
    ];
    
    const radarR = 210;
    const numAxes = radarData.length;
    const angleStep = (Math.PI * 2) / numAxes;
    
    ctx.save();
    ctx.translate(W/2, radarCY);
    
    for (let level = 1; level <= 4; level++) {
      const r = (radarR / 4) * level;
      ctx.beginPath();
      for (let i = 0; i < numAxes; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (level === 4) {
        ctx.fillStyle = "rgba(255,255,255,0.02)";
        ctx.fill();
      }
    }
    
    for (let i = 0; i < numAxes; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = Math.cos(angle) * radarR;
      const y = Math.sin(angle) * radarR;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(x, y);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();
      
      const lx = Math.cos(angle) * (radarR + 40);
      const ly = Math.sin(angle) * (radarR + 40);
      ctx.font = "700 24px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(radarData[i].label.toUpperCase(), lx, ly);
    }
    
    ctx.beginPath();
    for (let i = 0; i < numAxes; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const value = radarData[i].value;
      const r = (value / 100) * radarR;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.save();
    ctx.fillStyle = strokeColor;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.restore();
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 4;
    ctx.stroke();
    
    for (let i = 0; i < numAxes; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const value = radarData[i].value;
      const r = (value / 100) * radarR;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
    }
    ctx.restore();

    // ── Key Metrics ──
    const metricsY = radarCY + radarR + 100;
    const statsH = 260;
    
    const statBox = (x: number, y: number, w: number, h: number, val: string, label: string) => {
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      roundRect(ctx, x, y, w, h, 24);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, w, h, 24);
      ctx.stroke();
      
      ctx.font = "900 70px sans-serif";
      ctx.fillStyle = strokeColor;
      ctx.textAlign = "center";
      ctx.fillText(val, x + w/2, y + h/2 + 10);
      
      ctx.font = "700 22px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillText(label.toUpperCase(), x + w/2, y + h/2 + 55);
    };

    const sCW = (W - 120 - 40) / 3;
    statBox(60, metricsY, sCW, statsH, `${winRate}%`, "Win Rate");
    statBox(60 + sCW + 20, metricsY, sCW, statsH, totalMatches.toString(), "Matches");
    statBox(60 + 2*(sCW + 20), metricsY, sCW, statsH, wins.toString(), "Wins");

    // ── Extra info ──
    const extY = metricsY + statsH + 100;
    const extras: string[] = [];
    if (favoriteShot) extras.push(`Fav Shot: ${favoriteShot}`);
    if (favoriteFormat) extras.push(`Fav Format: ${favoriteFormat}`);
    if (extras.length > 0) {
      ctx.font = "600 28px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.textAlign = "center";
      ctx.fillText(extras.join("   ·   "), W / 2, extY);
    }

    // ── Footer bar ──
    const footerGrad = ctx.createLinearGradient(0, H - 90, W, H - 90);
    footerGrad.addColorStop(0, primaryGradColors[0]);
    footerGrad.addColorStop(1, primaryGradColors[2]);
    ctx.fillStyle = footerGrad;
    ctx.fillRect(0, H - 90, W, 90);
    ctx.font = "700 30px sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.textAlign = "center";
    ctx.fillText("IISc Badminton Club  ·  Shuttlers, Bangalore", W / 2, H - 30);

    // ── Build PDF with custom page size matching canvas aspect ratio ──
    const imgData = canvas.toDataURL("image/jpeg", 0.93);
    // Calculate PDF dimensions to match canvas exactly (no clipping)
    const pdfPageW = 210; // A4 width in mm
    const pdfPageH = Math.round((H * pdfPageW) / W); // maintain aspect ratio
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pdfPageW, pdfPageH] });
    pdf.addImage(imgData, "JPEG", 0, 0, pdfPageW, pdfPageH);

    const safeName = playerName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const fileName = `${safeName}_profile.pdf`;

    if (Capacitor.isNativePlatform()) {
      // Get base64 representation of the PDF
      const pdfBase64 = pdf.output("datauristring").split(",")[1];
      
      // Save it temporarily in Cache to share
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      
      toast.success("Profile ready! Opening share menu...", { id: toastId });
      
      await Share.share({
        title: "Player Profile",
        text: `Check out ${playerName}'s IISc Badminton Club Profile!`,
        url: savedFile.uri,
        dialogTitle: "Save or Share Profile PDF"
      });
    } else {
      pdf.save(fileName);
      toast.success("Profile card downloaded!", { id: toastId });
    }
  } catch (error) {
    console.error("PDF Export Error:", error);
    toast.error("Failed to generate PDF. Please try again.", { id: toastId });
  }
}
