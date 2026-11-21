import { loadImg } from "./matchShareCard";
import { themeColor, themeFont, withAlpha } from "./themeColors";

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

export interface WrappedShareData {
  year: number;
  playerName: string;
  avatarUrl?: string;
  totalMatches: number;
  winRate: string;
  biggestRival: string;
  bestStreak: number;
  ranking: {
    overall?: number;
    singles?: number;
    doubles?: number;
    mixed?: number;
  };
}

export async function renderWrappedShareCard(
  data: WrappedShareData,
): Promise<HTMLCanvasElement | null> {
  const {
    year,
    playerName,
    avatarUrl,
    totalMatches,
    winRate,
    biggestRival,
    bestStreak,
    ranking
  } = data;

  const playerImg = await loadImg(avatarUrl || "");

  const W = 1080, H = 1920; // 9:16 aspect ratio (Instagram Story size)
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Theme colours and fonts, resolved now so the image matches the user's theme.
  const ON = themeColor("on-accent"); // text on the gradient
  const DISPLAY = themeFont("display");
  const BODY = themeFont("body");
  const STAT = themeFont("stat");
  try {
    await Promise.all([
      document.fonts?.load(`900 110px ${DISPLAY}`),
      document.fonts?.load(`900 40px ${STAT}`),
      document.fonts?.load(`bold 36px ${BODY}`),
    ]);
  } catch { /* draw with whatever is available */ }

  // Background Gradient (Spotify Wrapped Style) — theme gradient into its warm accent
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, themeColor("grad-from"));
  bg.addColorStop(0.5, themeColor("grad-to"));
  bg.addColorStop(1, themeColor("grad-warm-from"));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Decorative blobs
  ctx.fillStyle = withAlpha(ON, 0.1);
  ctx.beginPath();
  ctx.arc(W * 0.8, H * 0.1, 400, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.1, H * 0.9, 600, 0, Math.PI * 2);
  ctx.fill();

  // Top header
  ctx.fillStyle = withAlpha(ON, 0.9);
  ctx.font = `bold 40px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.fillText("IISc Badminton Club", W / 2, 100);
  
  ctx.font = `900 110px ${DISPLAY}`;
  ctx.fillStyle = ON;
  ctx.fillText(`${year} IN`, W / 2, 250);
  ctx.fillText("REVIEW", W / 2, 360);

  // Profile Avatar
  const avatarSize = 300;
  const avatarX = W / 2 - avatarSize / 2;
  const avatarY = 480;
  
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.lineWidth = 15;
  ctx.strokeStyle = withAlpha(ON, 0.5);
  ctx.stroke();
  ctx.clip();
  if (playerImg) {
    ctx.drawImage(playerImg, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = themeColor("muted");
    ctx.fill();
    ctx.fillStyle = themeColor("foreground");
    ctx.font = `bold 100px ${DISPLAY}`;
    ctx.textBaseline = "middle";
    ctx.fillText(playerName[0] || "?", W / 2, avatarY + avatarSize / 2);
  }
  ctx.restore();

  // Player Name
  ctx.font = `bold 60px ${BODY}`;
  ctx.fillStyle = ON;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(playerName, W / 2, avatarY + avatarSize + 40);

  // Stats Grid
  const startY = avatarY + avatarSize + 160;
  const gapY = 180;

  const renderStat = (y: number, label: string, val: string) => {
    ctx.save();
    drawRoundedRect(ctx, 100, y, W - 200, 140, 40);
    ctx.fillStyle = withAlpha(ON, 0.14);
    ctx.fill();
    ctx.restore();

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = withAlpha(ON, 0.8);
    ctx.font = `bold 36px ${BODY}`;
    ctx.fillText(label, 150, y + 70);

    ctx.textAlign = "right";
    ctx.fillStyle = ON;
    ctx.font = `900 54px ${BODY}`;
    ctx.fillText(val, W - 150, y + 70);
  };

  renderStat(startY, "TOTAL MATCHES", totalMatches.toString());
  renderStat(startY + gapY, "WIN RATE", winRate);
  renderStat(startY + gapY * 2, "BIGGEST RIVAL", biggestRival);
  renderStat(startY + gapY * 3, "BEST STREAK", `${bestStreak} 🔥`);

  // 2x2 Rankings Grid Box
  const rankY = startY + gapY * 4;
  ctx.save();
  drawRoundedRect(ctx, 100, rankY, W - 200, 240, 40);
  ctx.fillStyle = withAlpha(ON, 0.14);
  ctx.fill();
  ctx.restore();

  const drawRankItem = (x: number, y: number, label: string, val?: number) => {
    ctx.textAlign = "left";
    ctx.fillStyle = withAlpha(ON, 0.8);
    ctx.font = `bold 26px ${BODY}`;
    ctx.fillText(label, x, y);
    
    ctx.textAlign = "right";
    ctx.fillStyle = ON;
    ctx.font = `900 40px ${STAT}`;
    ctx.fillText(val ? `#${val}` : "N/A", x + 350, y);
  };

  // Top Row (Overall, Singles)
  drawRankItem(150, rankY + 65, "OVERALL RANK", ranking.overall);
  drawRankItem(W / 2 + 30, rankY + 65, "SINGLES", ranking.singles);
  
  // Bottom Row (Doubles, Mixed)
  drawRankItem(150, rankY + 175, "DOUBLES", ranking.doubles);
  drawRankItem(W / 2 + 30, rankY + 175, "MIXED", ranking.mixed);

  // Footer
  // ctx.fillStyle = "rgba(255,255,255,0.6)";
  // ctx.font = "bold 30px sans-serif";
  // ctx.textAlign = "center";
  // ctx.fillText("iiscshuttlers.github.io/IIScBadmintonClub", W / 2, H - 60);

  return canvas;
}
