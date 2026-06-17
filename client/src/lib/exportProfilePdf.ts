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
  const winRate =
    data.wins + data.losses > 0
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

  // Remove any existing overlay first
  document.getElementById("__pdf-overlay")?.remove();
  document.getElementById("__pdf-print-style")?.remove();

  // Print stylesheet — hides everything except our overlay content when printing
  const printStyle = document.createElement("style");
  printStyle.id = "__pdf-print-style";
  printStyle.textContent = `
    @media print {
      body > *:not(#__pdf-overlay) { display: none !important; }
      #__pdf-overlay { position: static !important; background: white !important; }
      #__pdf-overlay-toolbar { display: none !important; }
    }
  `;
  document.head.appendChild(printStyle);

  const overlay = document.createElement("div");
  overlay.id = "__pdf-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:99999;background:white;overflow-y:auto;font-family:system-ui,-apple-system,sans-serif;color:#1e293b;";

  overlay.innerHTML = `
    <div id="__pdf-overlay-toolbar" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;gap:12px;position:sticky;top:0;z-index:1;">
      <div style="font-weight:600;color:#475569;">PDF Preview</div>
      <div style="display:flex;gap:8px;">
        <button id="__pdf-save" style="padding:8px 16px;background:#059669;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;">⬇ Save as PDF</button>
        <button id="__pdf-close" style="padding:8px 16px;background:#64748b;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;">✕ Close</button>
      </div>
    </div>
    <div style="padding:24px;max-width:720px;margin:0 auto;">
      <div style="display:flex;align-items:center;gap:20px;border-bottom:3px solid #059669;padding-bottom:16px;margin-bottom:24px;">
        ${
          data.avatarUrl
            ? `<img src="${data.avatarUrl}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;" crossorigin="anonymous" />`
            : `<div style="width:72px;height:72px;border-radius:50%;background:#dcfce7;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#059669;">${data.name.charAt(0).toUpperCase()}</div>`
        }
        <div>
          <h1 style="margin:0 0 4px;font-size:24px;font-weight:900;">${data.name}</h1>
          <div style="color:#059669;font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">IISc Badminton Club</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;">
          <div style="font-size:28px;font-weight:900;color:#059669;">${data.elo}</div>
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">ELO Rating</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;">
          <div style="font-size:28px;font-weight:900;color:#0f172a;">${data.wins}</div>
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">Wins</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;">
          <div style="font-size:28px;font-weight:900;color:#0f172a;">${data.losses}</div>
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">Losses</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;">
          <div style="font-size:28px;font-weight:900;color:#0f172a;">${winRate}%</div>
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">Win Rate</div>
        </div>
      </div>

      ${
        rows
          ? `<h2 style="font-size:14px;font-weight:900;color:#475569;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;">Recent Matches</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr>
          <th style="text-align:left;padding:8px 10px;background:#f1f5f9;font-weight:700;color:#64748b;text-transform:uppercase;font-size:10px;letter-spacing:0.05em;">Date</th>
          <th style="text-align:left;padding:8px 10px;background:#f1f5f9;font-weight:700;color:#64748b;text-transform:uppercase;font-size:10px;letter-spacing:0.05em;">Opponent</th>
          <th style="text-align:left;padding:8px 10px;background:#f1f5f9;font-weight:700;color:#64748b;text-transform:uppercase;font-size:10px;letter-spacing:0.05em;">Score</th>
          <th style="text-align:left;padding:8px 10px;background:#f1f5f9;font-weight:700;color:#64748b;text-transform:uppercase;font-size:10px;letter-spacing:0.05em;">Result</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`
          : ""
      }

      <div style="margin-top:32px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;">
        Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })} • IISc Badminton Club
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    printStyle.remove();
  };

  overlay.querySelector("#__pdf-save")!.addEventListener("click", () => {
    window.print();
  });
  overlay.querySelector("#__pdf-close")!.addEventListener("click", close);

  // Close on Android/iOS hardware back button (popstate trick)
  const popHandler = () => {
    close();
    window.removeEventListener("popstate", popHandler);
  };
  history.pushState({ pdfOverlay: true }, "");
  window.addEventListener("popstate", popHandler);
}
