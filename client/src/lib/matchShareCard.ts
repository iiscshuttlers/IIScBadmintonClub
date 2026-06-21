/**
 * Premium Match Share Card Renderer
 * Generates a 1080×1080 canvas image in a BWF broadcast style (navy + gold).
 * Supports singles and doubles, a set-by-set breakdown, and a sets headline.
 */

/* ── helpers ─────────────────────────────────────────────────── */

export const loadImg = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    if (url.includes("ui-avatars.com")) return resolve(null); // skip ui-avatars.com due to CORS issues
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
  if (glowColor) {
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 40;
    drawRoundedRect(ctx, x - 4, y - 4, size + 8, size + 8, radius + 4);
    ctx.fillStyle = glowColor;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  drawRoundedRect(ctx, x - borderWidth, y - borderWidth, size + borderWidth * 2, size + borderWidth * 2, radius + 2);
  ctx.fillStyle = borderColor;
  ctx.fill();
  ctx.restore();

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

export interface MatchSharePlayer {
  name: string;
  avatar?: string;
}

export interface MatchShareData {
  // Preferred: full team arrays (1 = singles, 2 = doubles)
  winners?: MatchSharePlayer[];
  losers?: MatchSharePlayer[];
  // Legacy single-player fields (still supported by the profile history card)
  winnerName?: string;
  loserName?: string;
  winnerAvatar?: string;
  loserAvatar?: string;
  // Set data (winner-first). When provided, the fancy set-by-set + headline render.
  sets?: { w: number; l: number }[];
  setsWon?: { w: number; l: number };

  displayScore: string;
  winnerEloChange?: number | string;
  loserEloChange?: number | string;
  matchType?: string; // "Friendly" or "Tournament"
  matchDate?: Date;
  category?: string;
}

const GOLD = "#f59e0b";

export async function renderMatchShareCard(
  data: MatchShareData,
): Promise<HTMLCanvasElement | null> {
  const {
    displayScore,
    winnerEloChange,
    loserEloChange,
    matchType,
    matchDate,
    category,
    sets,
    setsWon,
  } = data;

  // Normalise to team arrays (fall back to legacy single-player fields)
  const winners: MatchSharePlayer[] = data.winners?.length
    ? data.winners
    : [{ name: data.winnerName || "Player 1", avatar: data.winnerAvatar }];
  const losers: MatchSharePlayer[] = data.losers?.length
    ? data.losers
    : [{ name: data.loserName || "Player 2", avatar: data.loserAvatar }];

  const isDoubles = winners.length > 1 || losers.length > 1;
  const hasSets = !!(sets && sets.length);

  // Preload every avatar
  const [winImgs, loseImgs] = await Promise.all([
    Promise.all(winners.map((p) => loadImg(p.avatar || ""))),
    Promise.all(losers.map((p) => loadImg(p.avatar || ""))),
  ]);

  const W = 1080, H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  /* ── Background ── */
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0f1e");
  bg.addColorStop(0.5, "#0f172a");
  bg.addColorStop(1, "#020617");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Mesh dots
  ctx.fillStyle = "rgba(255,255,255,0.012)";
  for (let gx = 0; gx < W; gx += 40) {
    for (let gy = 0; gy < H; gy += 40) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Diagonal sport motif
  ctx.save();
  ctx.globalAlpha = 0.02;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  for (let i = -H; i < W + H; i += 60) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.stroke();
  }
  ctx.restore();

  // Ambient glow behind winner side
  const winGlow = ctx.createRadialGradient(W * 0.28, 420, 0, W * 0.28, 420, 360);
  winGlow.addColorStop(0, "rgba(245,158,11,0.10)");
  winGlow.addColorStop(1, "rgba(245,158,11,0)");
  ctx.fillStyle = winGlow;
  ctx.fillRect(0, 0, W, H);

  /* ── Header ── */
  const topLineGrad = ctx.createLinearGradient(0, 0, W, 0);
  topLineGrad.addColorStop(0, "rgba(245,158,11,0)");
  topLineGrad.addColorStop(0.5, "rgba(245,158,11,1)");
  topLineGrad.addColorStop(1, "rgba(245,158,11,0)");
  ctx.fillStyle = topLineGrad;
  ctx.fillRect(0, 0, W, 4);

  ctx.fillStyle = GOLD;
  ctx.font = "bold 38px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("🏸  IISc Badminton Club", W / 2, 66);

  const divGrad = ctx.createLinearGradient(160, 0, W - 160, 0);
  divGrad.addColorStop(0, "rgba(245,158,11,0)");
  divGrad.addColorStop(0.5, "rgba(245,158,11,0.4)");
  divGrad.addColorStop(1, "rgba(245,158,11,0)");
  ctx.fillStyle = divGrad;
  ctx.fillRect(160, 84, W - 320, 2);

  ctx.fillStyle = "#64748b";
  ctx.font = "900 26px sans-serif";
  ctx.letterSpacing = "8px";
  ctx.fillText("M A T C H   R E S U L T", W / 2, 124);
  ctx.letterSpacing = "0px";

  // Meta line (category • type • date)
  const metaParts: string[] = [];
  if (category) metaParts.push(category);
  if (matchType) metaParts.push(matchType === "Friendly" ? "🏸 Friendly" : "🏆 Tournament");
  if (matchDate) metaParts.push(matchDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }));
  if (metaParts.length) {
    ctx.fillStyle = "#475569";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(metaParts.join("   •   "), W / 2, 162);
  }

  /* ── Avatars ── */
  const avatarSize = isDoubles ? 124 : 180;
  const avatarRadius = isDoubles ? 24 : 30;
  const avatarY = 195;
  const leftCenterX = W * 0.27;
  const rightCenterX = W * 0.73;
  const avatarMidY = avatarY + avatarSize / 2;

  const drawCluster = (
    players: MatchSharePlayer[],
    imgs: (HTMLImageElement | null)[],
    centerX: number,
    isWinner: boolean,
  ) => {
    const gap = 18;
    const totalW = players.length * avatarSize + (players.length - 1) * gap;
    let x = centerX - totalW / 2;
    players.forEach((p, idx) => {
      drawRoundedAvatar(
        ctx, imgs[idx],
        x, avatarY, avatarSize, avatarRadius,
        p.name[0] || "?",
        isWinner ? GOLD : "#334155",
        isWinner ? 5 : 4,
        isWinner ? "rgba(245,158,11,0.5)" : undefined,
      );
      x += avatarSize + gap;
    });

    if (isWinner) {
      // Crown badge over the cluster's top-right
      const crownX = centerX + totalW / 2 - 14;
      const crownY = avatarY - 6;
      drawRoundedRect(ctx, crownX - 24, crownY - 24, 48, 48, 14);
      ctx.fillStyle = GOLD;
      ctx.fill();
      ctx.font = "30px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("👑", crownX, crownY + 1);
    }
  };

  drawCluster(winners, winImgs, leftCenterX, true);
  drawCluster(losers, loseImgs, rightCenterX, false);

  /* ── Center VS badge ── */
  ctx.save();
  drawRoundedRect(ctx, W / 2 - 40, avatarMidY - 26, 80, 52, 16);
  ctx.fillStyle = "#1e293b";
  ctx.fill();
  ctx.strokeStyle = "rgba(245,158,11,0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = GOLD;
  ctx.font = "900 30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("VS", W / 2, avatarMidY);

  /* ── Names, labels, ELO ── */
  const labelY = avatarY + avatarSize + 36;
  const nameY = labelY + 48;
  const eloY = nameY + 44;
  const namesStr = (players: MatchSharePlayer[]) => players.map((p) => p.name).join(" & ");

  const drawEloBadge = (elo: number | string | undefined, cx: number, positive: boolean) => {
    if (elo === undefined || elo === null || elo === "") return;
    const eloStr = typeof elo === "number" ? (elo > 0 ? `+${elo}` : `${elo}`) : elo;
    ctx.font = "900 22px sans-serif";
    const eloW = ctx.measureText(`${eloStr} ELO`).width + 28;
    drawRoundedRect(ctx, cx - eloW / 2, eloY - 18, eloW, 36, 10);
    ctx.fillStyle = positive ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)";
    ctx.fill();
    ctx.fillStyle = positive ? "#10b981" : "#f43f5e";
    ctx.font = "900 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`${eloStr} ELO`, cx, eloY + 4);
  };

  // Winner
  ctx.fillStyle = GOLD;
  ctx.font = "900 20px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "6px";
  ctx.fillText("W I N N E R", leftCenterX, labelY);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#ffffff";
  fitText(ctx, namesStr(winners), 420, 40, 22);
  ctx.fillText(namesStr(winners), leftCenterX, nameY);
  drawEloBadge(winnerEloChange, leftCenterX, true);

  // Loser
  ctx.fillStyle = "#475569";
  ctx.font = "900 20px sans-serif";
  ctx.letterSpacing = "4px";
  ctx.fillText("D E F E A T E D", rightCenterX, labelY);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#94a3b8";
  fitText(ctx, namesStr(losers), 420, 40, 22);
  ctx.fillText(namesStr(losers), rightCenterX, nameY);
  drawEloBadge(loserEloChange, rightCenterX, false);

  /* ── Sets headline (own band, below names) ── */
  let cursorY = eloY + 24;
  if (setsWon) {
    const hy = cursorY + 56;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 86px sans-serif";
    const dash = "  –  ";
    const wStr = String(setsWon.w);
    const lStr = String(setsWon.l);
    const wW = ctx.measureText(wStr).width;
    const dW = ctx.measureText(dash).width;
    const lW = ctx.measureText(lStr).width;
    let cx = W / 2 - (wW + dW + lW) / 2;
    ctx.fillStyle = GOLD;
    ctx.fillText(wStr, cx + wW / 2, hy);
    cx += wW;
    ctx.fillStyle = "#475569";
    ctx.fillText(dash, cx + dW / 2, hy);
    cx += dW;
    ctx.fillStyle = "#93c5fd";
    ctx.fillText(lStr, cx + lW / 2, hy);

    ctx.fillStyle = "#64748b";
    ctx.font = "900 18px sans-serif";
    ctx.letterSpacing = "6px";
    ctx.fillText("S E T S   W O N", W / 2, hy + 58);
    ctx.letterSpacing = "0px";
    cursorY = hy + 92;
  }

  /* ── Score section ── */
  const boxW = 760;
  const boxX = W / 2 - boxW / 2;
  const boxY = cursorY;

  if (hasSets) {
    const boxH = 232;
    ctx.save();
    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 24);
    const scoreBg = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY);
    scoreBg.addColorStop(0, "#111827");
    scoreBg.addColorStop(0.5, "#1e293b");
    scoreBg.addColorStop(1, "#111827");
    ctx.fillStyle = scoreBg;
    ctx.fill();
    ctx.strokeStyle = "rgba(245,158,11,0.2)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Header label
    ctx.fillStyle = "#64748b";
    ctx.font = "900 18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.letterSpacing = "5px";
    ctx.fillText("G A M E   B R E A K D O W N", W / 2, boxY + 38);
    ctx.letterSpacing = "0px";

    const rowsTop = boxY + 64;
    const rowsH = boxH - 84;
    const n = sets!.length;
    const rowH = rowsH / n;
    const leftX = W / 2 - 150;
    const rightX = W / 2 + 150;

    sets!.forEach((s, i) => {
      const cy = rowsTop + rowH * i + rowH / 2;
      const wWon = s.w > s.l;

      ctx.textBaseline = "middle";
      ctx.textAlign = "center";

      ctx.font = `900 ${Math.min(56, rowH * 0.7)}px sans-serif`;
      ctx.fillStyle = wWon ? GOLD : "#64748b";
      ctx.fillText(String(s.w), leftX, cy);
      ctx.fillStyle = !wWon ? "#cbd5e1" : "#64748b";
      ctx.fillText(String(s.l), rightX, cy);

      // SET n pill
      ctx.font = "900 18px sans-serif";
      const pillTxt = `SET ${i + 1}`;
      const pillW = ctx.measureText(pillTxt).width + 28;
      drawRoundedRect(ctx, W / 2 - pillW / 2, cy - 18, pillW, 36, 18);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(pillTxt, W / 2, cy + 1);

      if (i < n - 1) {
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(boxX + 40, rowsTop + rowH * (i + 1));
        ctx.lineTo(boxX + boxW - 40, rowsTop + rowH * (i + 1));
        ctx.stroke();
      }
    });
  } else {
    // Legacy single score box
    const boxH = 120;
    ctx.save();
    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 24);
    const scoreBg = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY);
    scoreBg.addColorStop(0, "#111827");
    scoreBg.addColorStop(0.5, "#1e293b");
    scoreBg.addColorStop(1, "#111827");
    ctx.fillStyle = scoreBg;
    ctx.fill();
    ctx.strokeStyle = "rgba(245,158,11,0.2)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitText(ctx, displayScore, boxW - 80, 64, 36, "900", "monospace");
    ctx.fillText(displayScore, W / 2, boxY + boxH / 2 + 2);
  }

  /* ── Recap line ── */
  const recapY = hasSets ? boxY + 232 + 52 : boxY + 120 + 52;
  ctx.fillStyle = "#cbd5e1";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const recap = `🏆 ${namesStr(winners)} defeated ${namesStr(losers)}`;
  fitText(ctx, recap, W - 120, 28, 18, "bold");
  ctx.fillText(recap, W / 2, recapY);

  /* ── Corner accents ── */
  const cs = 60;
  ctx.strokeStyle = "rgba(245,158,11,0.15)";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(24, 24 + cs); ctx.lineTo(24, 24); ctx.lineTo(24 + cs, 24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - 24 - cs, 24); ctx.lineTo(W - 24, 24); ctx.lineTo(W - 24, 24 + cs); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(24, H - 24 - cs); ctx.lineTo(24, H - 24); ctx.lineTo(24 + cs, H - 24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - 24 - cs, H - 24); ctx.lineTo(W - 24, H - 24); ctx.lineTo(W - 24, H - 24 - cs); ctx.stroke();

  /* ── Footer ── */
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(0, H - 90, W, 90);
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
