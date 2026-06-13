import { loadImg } from "./matchShareCard";

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
  playerName: string;
  avatarUrl?: string;
  totalMatches: number;
  winRate: string;
  biggestRival: string;
  bestStreak: number;
  highestElo: number;
}

export async function renderWrappedShareCard(
  data: WrappedShareData,
): Promise<HTMLCanvasElement | null> {
  const {
    playerName,
    avatarUrl,
    totalMatches,
    winRate,
    biggestRival,
    bestStreak,
    highestElo
  } = data;

  const playerImg = await loadImg(avatarUrl || "");

  const W = 1080, H = 1920; // 9:16 aspect ratio (Instagram Story size)
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background Gradient (Spotify Wrapped Style)
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#8b5cf6"); // Violet
  bg.addColorStop(0.5, "#d946ef"); // Fuchsia
  bg.addColorStop(1, "#f97316"); // Orange
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Decorative blobs
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath();
  ctx.arc(W * 0.8, H * 0.1, 400, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.1, H * 0.9, 600, 0, Math.PI * 2);
  ctx.fill();

  // Top header
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("IISc Shuttlers", W / 2, 100);
  
  ctx.font = "900 110px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("YEAR IN", W / 2, 250);
  ctx.fillText("REVIEW", W / 2, 360);

  // Profile Avatar
  const avatarSize = 300;
  const avatarX = W / 2 - avatarSize / 2;
  const avatarY = 480;
  
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.lineWidth = 15;
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.stroke();
  ctx.clip();
  if (playerImg) {
    ctx.drawImage(playerImg, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 100px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(playerName[0] || "?", W / 2, avatarY + avatarSize / 2);
  }
  ctx.restore();

  // Player Name
  ctx.font = "bold 60px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(playerName, W / 2, avatarY + avatarSize + 40);

  // Stats Grid
  const startY = avatarY + avatarSize + 160;
  const gapY = 180;

  const renderStat = (y: number, label: string, val: string) => {
    ctx.save();
    drawRoundedRect(ctx, 100, y, W - 200, 140, 40);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fill();
    ctx.restore();

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 36px sans-serif";
    ctx.fillText(label, 150, y + 70);

    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 54px sans-serif";
    ctx.fillText(val, W - 150, y + 70);
  };

  renderStat(startY, "TOTAL MATCHES", totalMatches.toString());
  renderStat(startY + gapY, "WIN RATE", winRate);
  renderStat(startY + gapY * 2, "BIGGEST RIVAL", biggestRival);
  renderStat(startY + gapY * 3, "BEST STREAK", `${bestStreak} 🔥`);
  renderStat(startY + gapY * 4, "HIGHEST ELO", highestElo.toString());

  // Footer
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("iiscshuttlers.com", W / 2, H - 60);

  return canvas;
}
