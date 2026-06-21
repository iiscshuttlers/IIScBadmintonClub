import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { toast } from "sonner";
import { getBaseShareUrl } from "@/lib/utils";
import { renderMatchShareCard } from "@/lib/matchShareCard";

/**
 * Shared match-sharing flow used by the feed, My Matches, and profile history.
 * Renders the match share card (doubles-aware) and shares it natively, via the
 * Web Share API, or falls back to downloading / copying a link.
 */
export async function shareMatch(match: any) {
  const p1 = match.player1;
  const p2 = match.player2;
  const partner1 = match.partner1;
  const partner2 = match.partner2;

  // Winner can be either primary player or their partner (doubles)
  const isTeam1Winner =
    match.winner_id === match.player1_id || match.winner_id === match.team1_partner_id;

  const team1Names = [p1?.full_name, partner1?.full_name].filter(Boolean).join(" & ") || "Team 1";
  const team2Names = [p2?.full_name, partner2?.full_name].filter(Boolean).join(" & ") || "Team 2";

  const winnerName = isTeam1Winner ? team1Names : team2Names;
  const loserName = isTeam1Winner ? team2Names : team1Names;

  const team1Players = [p1, partner1]
    .filter(Boolean)
    .map((pl: any) => ({ name: pl.full_name || "Player", avatar: pl.avatar_url || "" }));
  const team2Players = [p2, partner2]
    .filter(Boolean)
    .map((pl: any) => ({ name: pl.full_name || "Player", avatar: pl.avatar_url || "" }));
  const winners = isTeam1Winner ? team1Players : team2Players;
  const losers = isTeam1Winner ? team2Players : team1Players;

  // Score: strip legacy video-URL suffix and umpire team annotation
  let displayScore = match.score || match.match_score || "N/A";
  displayScore = String(displayScore).split(" | ")[0].replace(/\s*\[.*$/, "").trim();

  // Parse sets (stored team1-team2) and orient them winner-first
  const rawSets = displayScore
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean)
    .map((s: string) => {
      const [a, b] = s.split("-").map((n: string) => parseInt(n.trim(), 10));
      if (Number.isNaN(a) || Number.isNaN(b)) return null;
      return { a, b };
    })
    .filter(Boolean) as { a: number; b: number }[];
  const sets = rawSets.map(({ a, b }) => (isTeam1Winner ? { w: a, l: b } : { w: b, l: a }));
  const setsWon = sets.length
    ? { w: sets.filter((s) => s.w > s.l).length, l: sets.filter((s) => s.l > s.w).length }
    : undefined;

  const shareUrl = `${getBaseShareUrl()}/feed?match=${match.id}`;
  const text = `🏸 Match Result: ${winnerName} def. ${loserName} (${displayScore})! Check it out on IISc Badminton Club.`;

  const fallbackShare = () => {
    if (Capacitor.isNativePlatform()) {
      Share.share({ title: "IISc Badminton Club Match", text, url: shareUrl, dialogTitle: "Share Match Result" });
    } else if (navigator.share) {
      navigator.share({ title: "IISc Badminton Club Match", text, url: shareUrl });
    } else {
      navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      toast.success("Match result copied to clipboard!");
    }
  };

  try {
    const canvas = await renderMatchShareCard({
      winners,
      losers,
      sets,
      setsWon,
      displayScore,
      winnerEloChange: isTeam1Winner ? match.elo_change_p1 : match.elo_change_p2,
      loserEloChange: isTeam1Winner ? match.elo_change_p2 : match.elo_change_p1,
      matchType: match.is_friendly !== false ? "Friendly" : "Tournament",
      matchDate: new Date(match.created_at),
      category: match.category,
    });

    if (!canvas) {
      fallbackShare();
      return;
    }

    if (Capacitor.isNativePlatform()) {
      const base64 = canvas.toDataURL("image/png").split(",")[1];
      const { uri } = await Filesystem.writeFile({
        path: "match-share.png",
        data: base64,
        directory: Directory.Cache,
      });
      await Share.share({
        title: "IISc Badminton Club Match",
        text,
        files: [uri],
        dialogTitle: "Share Match Result",
      });
      toast.success("Match Recap shared!");
    } else {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          fallbackShare();
          return;
        }
        const file = new File([blob], "match-recap.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ title: "IISc Badminton Club Match", text, url: shareUrl, files: [file] });
            toast.success("Match Recap shared!");
            return;
          } catch (e: any) {
            if (e?.name === "AbortError") return; // user dismissed the share sheet
          }
        }
        // No file-share support (e.g. desktop) — download the image instead
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "match-recap.png";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Match recap downloaded!");
      }, "image/png");
    }
  } catch (err: any) {
    if (!err?.message?.includes("cancel")) fallbackShare();
  }
}
