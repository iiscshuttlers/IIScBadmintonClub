/**
 * Client-side player profile PDF export (#59).
 * Uses the browser's print API with a hidden print-only div
 * so there's no extra library dependency.
 */

interface ProfileData {
  name: string;
  elo: number;
  wins: number;
  losses: number;
  avatarUrl?: string | null;
  recentMatches: Array<{
    date: string;
    opponent: string;
    score: string;
    result: "W" | "L";
  }>;
}

export function exportProfilePdf(data: ProfileData) {
  const winRate = data.wins + data.losses > 0
    ? Math.round((data.wins / (data.wins + data.losses)) * 100)
    : 0;

  const rows = data.recentMatches
    .slice(0, 15)
    .map(
      (m) =>
        `<tr>
          <td>${new Date(m.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
          <td>${m.opponent}</td>
          <td>${m.score}</td>
          <td style="color:${m.result === "W" ? "#059669" : "#dc2626"}; font-weight:700">${m.result}</td>
        </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${data.name} — IISc Shuttlers Profile</title>
<style>
  @page { size: A4; margin: 24mm 20mm; }
  body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; margin: 0; }
  .header { display: flex; align-items: center; gap: 20px; border-bottom: 3px solid #059669; padding-bottom: 16px; margin-bottom: 24px; }
  .avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; }
  .avatar-placeholder { width: 72px; height: 72px; border-radius: 50%; background: #dcfce7; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 900; color: #059669; }
  h1 { margin: 0 0 4px; font-size: 24px; font-weight: 900; }
  .club { color: #059669; font-size: 13px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; }
  .stat-value { font-size: 28px; font-weight: 900; color: #0f172a; }
  .stat-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
  .elo-value { color: #059669; }
  h2 { font-size: 14px; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 10px; background: #f1f5f9; font-weight: 700; color: #64748b; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
  .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  ${data.avatarUrl
    ? `<img src="${data.avatarUrl}" class="avatar" crossorigin="anonymous" />`
    : `<div class="avatar-placeholder">${data.name.charAt(0).toUpperCase()}</div>`
  }
  <div>
    <h1>${data.name}</h1>
    <div class="club">IISc Shuttlers Badminton Club</div>
  </div>
</div>

<div class="stats">
  <div class="stat">
    <div class="stat-value elo-value">${data.elo}</div>
    <div class="stat-label">ELO Rating</div>
  </div>
  <div class="stat">
    <div class="stat-value">${data.wins}</div>
    <div class="stat-label">Wins</div>
  </div>
  <div class="stat">
    <div class="stat-value">${data.losses}</div>
    <div class="stat-label">Losses</div>
  </div>
  <div class="stat">
    <div class="stat-value">${winRate}%</div>
    <div class="stat-label">Win Rate</div>
  </div>
</div>

${rows ? `
<h2>Recent Matches</h2>
<table>
  <thead><tr><th>Date</th><th>Opponent</th><th>Score</th><th>Result</th></tr></thead>
  <tbody>${rows}</tbody>
</table>` : ""}

<div class="footer">
  Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })} • IISc Shuttlers
</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=794,height=1123");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.print();
  };
}
