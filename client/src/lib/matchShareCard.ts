/**
 * Premium Match Share Card Renderer
 * Generates a 1080×1080 canvas image in a BWF broadcast style.
 */

/* ── helpers ─────────────────────────────────────────────────── */

export const loadImg = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxFontSize: number,
  minFontSize: number,
  fontWeight = "bold",
  fontFamily = "sans-serif",
): number {
  let size = maxFontSize;
  while (size > minFontSize) {
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
  return size;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}

function drawRoundedAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  radius: number,
  initial: string,
  borderColor: string,
  borderWidth: number,
  glowColor?: string,
) {
  // Glow effect behind winner
  if (glowColor) {
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    drawRoundedRect(ctx, x - 4, y - 4, size + 8, size + 8, radius + 4);
    ctx.fillStyle = glowColor;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.restore();
  }

  // Border
  ctx.save();
  drawRoundedRect(ctx, x - borderWidth, y - borderWidth, size + borderWidth * 2, size + borderWidth * 2, radius + 2);
  ctx.fillStyle = borderColor;
  ctx.fill();
  ctx.restore();

  // Avatar image or fallback initial
  ctx.save();
  drawRoundedRect(ctx, x, y, size, size, radius);
  ctx.clip();
  if (img) {
    ctx.drawImage(img, x, y, size, size);
  } else {
    const fallbackGrad = ctx.createLinearGradient(x, y, x + size, y + size);
    fallbackGrad.addColorStop(0, "#1e3a5f");
    fallbackGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = fallbackGrad;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = "#f59e0b";
    ctx.font = `bold ${size * 0.45}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initial.toUpperCase(), x + size / 2, y + size / 2);
  }
  ctx.restore();
}

export interface MatchShareData {
  winnerName: string;
  loserName: string;
  winnerAvatar: string;
  loserAvatar: string;
  displayScore: string;
  winnerEloChange?: number | string;
  loserEloChange?: number | string;
  matchType?: string; // "Friendly" or "Tournament"
  matchDate?: Date;
  category?: string;  // "Singles" or "Doubles"
}

export async function renderMatchShareCard(
  data: MatchShareData,
): Promise<HTMLCanvasElement | null> {
  const {
    winnerName,
    loserName,
    winnerAvatar,
    loserAvatar,
    displayScore,
    winnerEloChange,
    loserEloChange,
    matchType,
    matchDate,
    category,
  } = data;

  const [winImg, loseImg] = await Promise.all([
    loadImg(winnerAvatar || ""),
    loadImg(loserAvatar || ""),
  ]);

  const W = 1080, H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // ── Background gradient ──
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0f1e");
  bg.addColorStop(0.5, "#0f172a");
  bg.addColorStop(1, "#020617");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle mesh texture dots
  ctx.fillStyle = "rgba(255,255,255,0.012)";
  for (let gx = 0; gx < W; gx += 40) {
    for (let gy = 0; gy < H; gy += 40) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Ambient glow behind winner side
  const winGlow = ctx.createRadialGradient(W * 0.28, 420, 0, W * 0.28, 420, 340);
  winGlow.addColorStop(0, "rgba(245,158,11,0.08)");
  winGlow.addColorStop(1, "rgba(245,158,11,0)");
  ctx.fillStyle = winGlow;
  ctx.fillRect(0, 0, W, H);

  // ════════════════════════════════════════════════════════════
  // HEADER
  // ════════════════════════════════════════════════════════════

  // Top accent line
  const topLineGrad = ctx.createLinearGradient(0, 0, W, 0);
  topLineGrad.addColorStop(0, "rgba(245,158,11,0)");
  topLineGrad.addColorStop(0.3, "rgba(245,158,11,0.7)");
  topLineGrad.addColorStop(0.5, "rgba(245,158,11,1)");
  topLineGrad.addColorStop(0.7, "rgba(245,158,11,0.7)");
  topLineGrad.addColorStop(1, "rgba(245,158,11,0)");
  ctx.fillStyle = topLineGrad;
  ctx.fillRect(0, 0, W, 4);

  // Brand
  ctx.fillStyle = "#f59e0b";
  ctx.font = "bold 38px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("🏸  IISc Shuttlers", W / 2, 70);

  // Divider
  const divGrad = ctx.createLinearGradient(160, 0, W - 160, 0);
  divGrad.addColorStop(0, "rgba(245,158,11,0)");
  divGrad.addColorStop(0.5, "rgba(245,158,11,0.4)");
  divGrad.addColorStop(1, "rgba(245,158,11,0)");
  ctx.fillStyle = divGrad;
  ctx.fillRect(160, 90, W - 320, 2);

  // Subtitle
  ctx.fillStyle = "#64748b";
  ctx.font = "900 28px sans-serif";
  ctx.letterSpacing = "8px";
  ctx.fillText("M A T C H   R E S U L T", W / 2, 136);
  ctx.letterSpacing = "0px";

  // ════════════════════════════════════════════════════════════
  // PLAYER AVATARS
  // ════════════════════════════════════════════════════════════

  const avatarSize = 220;
  const avatarRadius = 32;
  const avatarY = 200;
  const leftCenterX = W * 0.28;
  const rightCenterX = W * 0.72;

  // VS badge in center
  const vsY = avatarY + avatarSize / 2;
  ctx.save();
  drawRoundedRect(ctx, W / 2 - 42, vsY - 28, 84, 56, 16);
  ctx.fillStyle = "#1e293b";
  ctx.fill();
  ctx.strokeStyle = "rgba(245,158,11,0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#f59e0b";
  ctx.font = "900 32px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("VS", W / 2, vsY);

  // Winner avatar (left) – golden glow + border
  drawRoundedAvatar(
    ctx, winImg,
    leftCenterX - avatarSize / 2, avatarY,
    avatarSize, avatarRadius,
    winnerName[0] || "?",
    "#f59e0b", 5,
    "rgba(245,158,11,0.5)",
  );

  // Winner crown badge
  ctx.save();
  const crownX = leftCenterX + avatarSize / 2 - 20;
  const crownY = avatarY - 10;
  drawRoundedRect(ctx, crownX - 22, crownY - 22, 44, 44, 14);
  ctx.fillStyle = "#f59e0b";
  ctx.fill();
  ctx.restore();
  ctx.font = "28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("👑", crownX, crownY);

  // Loser avatar (right) – muted border
  drawRoundedAvatar(
    ctx, loseImg,
    rightCenterX - avatarSize / 2, avatarY,
    avatarSize, avatarRadius,
    loserName[0] || "?",
    "#334155", 4,
  );

  // ════════════════════════════════════════════════════════════
  // PLAYER NAMES & LABELS
  // ════════════════════════════════════════════════════════════

  const nameY = avatarY + avatarSize + 44;
  const labelY = nameY + 42;

  // Winner label
  ctx.fillStyle = "#f59e0b";
  ctx.font = "900 20px sans-serif";
  ctx.textAlign = "center";
  ctx.letterSpacing = "6px";
  ctx.fillText("W I N N E R", leftCenterX, avatarY + avatarSize + 20);
  ctx.letterSpacing = "0px";

  // Winner name — auto-fit
  ctx.fillStyle = "#ffffff";
  fitText(ctx, winnerName, 380, 44, 26);
  ctx.fillText(winnerName, leftCenterX, nameY);

  // Winner ELO badge
  if (winnerEloChange) {
    const eloStr = typeof winnerEloChange === "number"
      ? (winnerEloChange > 0 ? `+${winnerEloChange}` : `${winnerEloChange}`)
      : winnerEloChange;
    ctx.font = "900 22px sans-serif";
    const eloW = ctx.measureText(`${eloStr} ELO`).width + 28;
    drawRoundedRect(ctx, leftCenterX - eloW / 2, labelY - 18, eloW, 36, 10);
    ctx.fillStyle = "rgba(16,185,129,0.15)";
    ctx.fill();
    ctx.fillStyle = "#10b981";
    ctx.font = "900 22px sans-serif";
    ctx.fillText(`${eloStr} ELO`, leftCenterX, labelY + 4);
  }

  // Loser label
  ctx.fillStyle = "#475569";
  ctx.font = "900 20px sans-serif";
  ctx.letterSpacing = "4px";
  ctx.fillText("D E F E A T E D", rightCenterX, avatarY + avatarSize + 20);
  ctx.letterSpacing = "0px";

  // Loser name — auto-fit
  ctx.fillStyle = "#94a3b8";
  fitText(ctx, loserName, 380, 44, 26);
  ctx.fillText(loserName, rightCenterX, nameY);

  // Loser ELO badge
  if (loserEloChange) {
    const eloStr = typeof loserEloChange === "number"
      ? (loserEloChange > 0 ? `+${loserEloChange}` : `${loserEloChange}`)
      : loserEloChange;
    ctx.font = "900 22px sans-serif";
    const eloW = ctx.measureText(`${eloStr} ELO`).width + 28;
    drawRoundedRect(ctx, rightCenterX - eloW / 2, labelY - 18, eloW, 36, 10);
    ctx.fillStyle = "rgba(244,63,94,0.15)";
    ctx.fill();
    ctx.fillStyle = "#f43f5e";
    ctx.font = "900 22px sans-serif";
    ctx.fillText(`${eloStr} ELO`, rightCenterX, labelY + 4);
  }

  // ════════════════════════════════════════════════════════════
  // SCORE SECTION
  // ════════════════════════════════════════════════════════════

  const scoreBoxY = 590;
  const scoreBoxH = 120;
  const scoreBoxW = 680;
  const scoreBoxX = W / 2 - scoreBoxW / 2;

  // Score container
  ctx.save();
  drawRoundedRect(ctx, scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH, 24);
  const scoreBg = ctx.createLinearGradient(scoreBoxX, scoreBoxY, scoreBoxX + scoreBoxW, scoreBoxY);
  scoreBg.addColorStop(0, "#111827");
  scoreBg.addColorStop(0.5, "#1e293b");
  scoreBg.addColorStop(1, "#111827");
  ctx.fillStyle = scoreBg;
  ctx.fill();
  // Score border
  ctx.strokeStyle = "rgba(245,158,11,0.2)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Score accent line on top of score box
  ctx.save();
  const scoreLineGrad = ctx.createLinearGradient(scoreBoxX + 40, 0, scoreBoxX + scoreBoxW - 40, 0);
  scoreLineGrad.addColorStop(0, "rgba(245,158,11,0)");
  scoreLineGrad.addColorStop(0.5, "rgba(245,158,11,0.5)");
  scoreLineGrad.addColorStop(1, "rgba(245,158,11,0)");
  ctx.fillStyle = scoreLineGrad;
  ctx.fillRect(scoreBoxX + 40, scoreBoxY, scoreBoxW - 80, 2);
  ctx.restore();

  // Score text
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitText(ctx, displayScore, scoreBoxW - 80, 64, 36, "900", "monospace");
  ctx.fillText(displayScore, W / 2, scoreBoxY + scoreBoxH / 2 + 2);

  // ════════════════════════════════════════════════════════════
  // MATCH METADATA
  // ════════════════════════════════════════════════════════════

  const metaY = scoreBoxY + scoreBoxH + 50;

  // Build metadata string
  const metaParts: string[] = [];
  if (category) metaParts.push(category);
  if (matchType) metaParts.push(matchType === "Friendly" ? "🏸 Friendly" : "🏆 Tournament");
  if (matchDate) {
    metaParts.push(matchDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }));
  }
  const metaStr = metaParts.join("  •  ");

  if (metaStr) {
    ctx.fillStyle = "#475569";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(metaStr, W / 2, metaY);
  }

  // ════════════════════════════════════════════════════════════
  // DECORATIVE ELEMENTS
  // ════════════════════════════════════════════════════════════

  // Subtle diagonal lines (sport motif)
  ctx.save();
  ctx.globalAlpha = 0.02;
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 1;
  for (let i = -H; i < W + H; i += 60) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.stroke();
  }
  ctx.restore();

  // Corner accents
  const cornerSize = 60;
  ctx.strokeStyle = "rgba(245,158,11,0.15)";
  ctx.lineWidth = 3;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(24, 24 + cornerSize);
  ctx.lineTo(24, 24);
  ctx.lineTo(24 + cornerSize, 24);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(W - 24 - cornerSize, 24);
  ctx.lineTo(W - 24, 24);
  ctx.lineTo(W - 24, 24 + cornerSize);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(24, H - 24 - cornerSize);
  ctx.lineTo(24, H - 24);
  ctx.lineTo(24 + cornerSize, H - 24);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(W - 24 - cornerSize, H - 24);
  ctx.lineTo(W - 24, H - 24);
  ctx.lineTo(W - 24, H - 24 - cornerSize);
  ctx.stroke();

  // ════════════════════════════════════════════════════════════
  // FOOTER
  // ════════════════════════════════════════════════════════════

  // Footer bar
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(0, H - 90, W, 90);

  // Bottom accent line
  const botLineGrad = ctx.createLinearGradient(0, 0, W, 0);
  botLineGrad.addColorStop(0, "rgba(245,158,11,0)");
  botLineGrad.addColorStop(0.5, "rgba(245,158,11,0.3)");
  botLineGrad.addColorStop(1, "rgba(245,158,11,0)");
  ctx.fillStyle = botLineGrad;
  ctx.fillRect(0, H - 90, W, 2);

  ctx.fillStyle = "#475569";
  ctx.font = "bold 26px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("iiscshuttlers.github.io/iiscshuttlers", W / 2, H - 44);

  return canvas;
}
