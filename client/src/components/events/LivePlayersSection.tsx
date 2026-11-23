import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCategorySettings, useRegistrationEntries, useRegistrationWindows, useWaitlistCounts } from "@/hooks/useRegistration";
import { isRegistrationFlagOn } from "@/services/tournament/registrationEntries";
import { categoryEntriesVisible, hiddenReason } from "@/lib/registration/visibility";
import { isDoublesCategory } from "@/lib/registration/partners";
import { stateText } from "@/components/registration/registrationText";
import type { RegistrationTournament } from "@/types/registration";
import { fetchParticipantsWithDepartments } from "@/services/tournamentService";
import { Loader2, Users, Info, Image as ImageIcon, FileText } from "lucide-react";
import { safeReplaceState, safeGetSearchParams } from "@/lib/navUtils";
import { toPng } from "html-to-image";
import { themeColor } from "@/lib/themeColors";
import { getDepartmentAcronym } from "@/data/departments";
import { publishedSeedCount } from "@/lib/seeding";

interface Participant {
  id: string;
  category: string;
  display_name: string | null;
  seed: number | null;
  custom_team_name?: string | null;
  player_id?: string | null;
  partner_id?: string | null;
  player: { full_name: string | null; department: string | null } | null;
  partner: { full_name: string | null; department: string | null } | null;
}

/** The name shown on the card: a doubles pair sorts by its first player. */
function sortName(p: Pick<Participant, "display_name" | "player">): string {
  return (p.display_name || p.player?.full_name || "").trim();
}

/**
 * A–Z by the shown name, ignoring case and accents ("anurag" next to
 * "Anurag"); unnamed entries go last. Returns a new array.
 */
export function sortParticipantsAlphabetically<T extends Pick<Participant, "display_name" | "player">>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const na = sortName(a);
    const nb = sortName(b);
    if (!na || !nb) return na ? -1 : nb ? 1 : 0;
    return na.localeCompare(nb, "en", { sensitivity: "base", numeric: true });
  });
}

export function LivePlayersSection({
  tournamentId,
  categories,
  showParticipants,
  tournament,
}: {
  tournamentId: string;
  categories: string[];
  showParticipants?: boolean | null;
  /** With in-app registration on: per-category visibility, status lines, waitlist counts. */
  tournament?: RegistrationTournament | null;
}) {
  const [allParticipants, setParticipants] = useState<Record<string, Participant[]>>({});
  const { profile } = useAuth();
  const myId = profile?.id ?? null;
  const flagOn = isRegistrationFlagOn(tournament);
  const windows = useRegistrationWindows(tournament);
  const { data: catSettings } = useCategorySettings(tournament);
  const { data: regRows } = useRegistrationEntries(tournament);
  const { data: waitCounts } = useWaitlistCounts(tournament);
  const settingFor = (cat: string) => (Array.isArray(catSettings) ? catSettings : []).find((x) => x.category === cat);
  const visibleCat = (cat: string) => categoryEntriesVisible({
    flagOn, showParticipants, visibility: settingFor(cat)?.entries_visibility, window: windows[cat],
    hasDraw: windows[cat]?.lockReason === "draw",
  });
  // Hidden categories still show the viewer's own entry.
  const participants = useMemo(() => {
    const out: Record<string, Participant[]> = {};
    for (const [cat, list] of Object.entries(allParticipants)) {
      out[cat] = visibleCat(cat) ? list : list.filter((p) => !!myId && (p.player_id === myId || p.partner_id === myId));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allParticipants, myId, flagOn, showParticipants, catSettings, windows]);
  const lookingIds = useMemo(
    () => (Array.isArray(regRows) ? regRows : []).filter((r) => r.looking_for_partner).map((r) => r.id),
    [regRows],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchParams = safeGetSearchParams();
  const [activeCat, setActiveCat] = useState<string>(searchParams.get("cat") || "");
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const exportAsImage = async () => {
    if (!exportRef.current) return;
    setExporting(true);

    // Wait for the re-render to apply "exporting" styles
    await new Promise(r => setTimeout(r, 100));

    try {
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: themeColor("background")
      });
      const link = document.createElement('a');
      link.download = `players-${activeCat}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  const exportAsPDF = async () => {
    if (!activeCat || !participants[activeCat]) return;
    setExporting(true);
    try {
      const parts = participants[activeCat];
      const isDoubles = ["MD", "WD", "XD"].includes(activeCat);
      const pdfSeeds = publishedSeedCount(parts.length);
      // Published seeds print as "Name [1]"; the rest of the draw order stays private.
      const seedTag = (p: Participant) => (p.seed != null && p.seed <= pdfSeeds ? ` [${p.seed}]` : "");

      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      let y = 40;
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Participants - ${activeCat}`, 40, y);
      y += 20;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");

      const lineH = 20;

      if (isDoubles) {
        pdf.setFont("helvetica", "bold");
        pdf.text("No.", 40, y);
        pdf.text("Player 1", 70, y);
        pdf.text("Dept 1", 230, y);
        pdf.text("Player 2", 330, y);
        pdf.text("Dept 2", 490, y);
        pdf.setFont("helvetica", "normal");
        y += 10;
        pdf.line(40, y, pageWidth - 40, y);
        y += 15;
      } else {
        pdf.setFont("helvetica", "bold");
        pdf.text("No.", 40, y);
        pdf.text("Name", 80, y);
        pdf.text("Department", 320, y);
        pdf.setFont("helvetica", "normal");
        y += 10;
        pdf.line(40, y, pageWidth - 40, y);
        y += 15;
      }

      parts.forEach((p, idx) => {
        if (y > pageHeight - 40) {
          pdf.addPage();
          y = 40;
        }

        const rowStr = `${idx + 1}`;
        if (isDoubles) {
          let p1Name = p.display_name?.split("&")[0]?.trim() || p.player?.full_name || "TBD";
          let p2Name = p.display_name?.split("&")[1]?.trim() || p.partner?.full_name || "TBD";
          let p1Dept = p.player?.department || p.custom_team_name || "EXT";
          let p2Dept = p.partner?.department || p.custom_team_name || "EXT";

          pdf.text(rowStr, 40, y);
          pdf.text(`${p1Name.substring(0, 25)}${seedTag(p)}`, 70, y);
          pdf.text(p1Dept.substring(0, 15), 230, y);
          pdf.text(p2Name.substring(0, 25), 330, y);
          pdf.text(p2Dept.substring(0, 15), 490, y);
        } else {
          let name = p.display_name || p.player?.full_name || "TBD";
          let dept = p.player?.department || p.custom_team_name || "EXT";

          pdf.text(rowStr, 40, y);
          pdf.text(`${name.substring(0, 45)}${seedTag(p)}`, 80, y);
          pdf.text(dept.substring(0, 40), 320, y);
        }

        y += lineH;
      });

      pdf.save(`players-${activeCat}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!showParticipants && !flagOn) {
      setError("The participants list has not been published yet.");
      setLoading(false);
      return;
    }

    fetchParticipantsWithDepartments(tournamentId)
      .then((data) => {
        const grouped: Record<string, Participant[]> = {};
        for (const p of (data as any as Participant[]) || []) {
          if (!grouped[p.category]) grouped[p.category] = [];
          grouped[p.category].push(p);
        }

        // Alphabetical, so the list never reveals seedings and is easy to scan.
        for (const cat in grouped) {
          grouped[cat] = sortParticipantsAlphabetically(grouped[cat]);
        }

        setParticipants(grouped);

        // Auto-select first available category if activeCat is not set or not in valid categories
        const firstActive = categories.find((c) => grouped[c]?.length > 0);
        if (firstActive && (!activeCat || !grouped[activeCat])) {
          setActiveCat(firstActive);
        }

        setLoading(false);
      });
  }, [tournamentId, categories, activeCat, flagOn]);

  useEffect(() => {
    if (!activeCat) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("cat", activeCat);
      safeReplaceState(url.toString());
    } catch { /* ignore on Capacitor */ }
  }, [activeCat]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-muted/50 rounded-3xl border border-border-strong">
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-black text-foreground">Participants Not Yet Available</h3>
        <p className="text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  const activeCategories = flagOn
    ? categories.filter((c) => (windows[c] && windows[c].state !== "hidden") || participants[c]?.length > 0)
    : categories.filter((c) => participants[c]?.length > 0);

  if (activeCategories.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/50 rounded-3xl border border-border-strong">
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-black text-foreground">No Players Registered Yet</h3>
        <p className="text-muted-foreground mt-1">Participants will appear here once they are added.</p>
      </div>
    );
  }

  const shownCat = activeCategories.includes(activeCat) ? activeCat : activeCategories[0];
  const currentParticipants = participants[shownCat] || [];
  // App entries get seeds in sign-up order: show seeds only once the draw exists.
  const seedCount = flagOn && windows[shownCat]?.lockReason !== "draw" ? 0 : publishedSeedCount(currentParticipants.length);
  const waiting = (Array.isArray(waitCounts) ? waitCounts : []).find((w) => w.category === shownCat)?.waiting ?? 0;
  const catVisible = visibleCat(shownCat);

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 pb-3">
        {activeCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            className={`px-4 py-2 rounded-full text-sm font-black whitespace-nowrap transition-all duration-300 ${shownCat === cat
                ? "bg-primary text-primary-foreground shadow-md ring-1 ring-primary/50 scale-[1.02]"
                : "bg-muted/60 text-muted-foreground hover:bg-muted-strong hover:text-foreground ring-1 ring-inset ring-border-strong/50"
              }`}
          >
            {cat} {visibleCat(cat) && <span className={`text-[11px] ml-1 font-bold ${shownCat === cat ? "opacity-90" : ""}`}>({allParticipants[cat]?.length ?? 0})</span>}
          </button>
        ))}
      </div>

      {flagOn && windows[shownCat] && (
        <p className="px-1 text-sm font-semibold text-soft" data-testid="category-status">
          {stateText(windows[shownCat])}
          {catVisible && ` · ${allParticipants[shownCat]?.length ?? 0} entered`}
          {waiting > 0 && ` · ${waiting} on the waitlist`}
        </p>
      )}
      {flagOn && !catVisible && (
        <p className="rounded-2xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground" data-testid="category-hidden">
          {hiddenReason(settingFor(shownCat)?.entries_visibility)}
          {currentParticipants.length > 0 && " Your own entry is shown below."}
        </p>
      )}

      <div className="flex items-center justify-between px-1 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          <p className="text-xs font-semibold text-muted-foreground">
            {seedCount > 0
              ? `Listed A–Z. The top ${seedCount} seeds are marked.`
              : "Listed A–Z."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportAsImage} disabled={exporting} className="flex items-center gap-1 text-[10px] font-black uppercase text-muted-foreground hover:text-primary transition bg-muted/60 px-2 py-1 rounded-md">
            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />} Image
          </button>
          <button onClick={exportAsPDF} disabled={exporting} className="flex items-center gap-1 text-[10px] font-black uppercase text-muted-foreground hover:text-primary transition bg-muted/60 px-2 py-1 rounded-md">
            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />} PDF
          </button>
        </div>
      </div>

      <div ref={exportRef} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 bg-transparent p-1 -mx-1">
        {currentParticipants.map((p, i) => (
          <div
            key={p.id}
            className={`group relative flex items-center justify-between p-5 rounded-[1.25rem] transition-all duration-300 overflow-hidden ${exporting
                ? "bg-muted border border-border-strong shadow-sm"
                : "bg-muted/60 backdrop-blur-md border border-border-strong/50 shadow-[0_2px_10px_-4px_color-mix(in_srgb,var(--scrim)_15%,transparent)] dark:shadow-none hover:shadow-xl hover:-translate-y-1 hover:border-primary/50"
              }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <div className="flex-1 flex flex-col min-w-0 pr-4 relative z-10">
              {(!!myId && (p.player_id === myId || p.partner_id === myId)) || (lookingIds.includes(p.id) && !p.partner_id && isDoublesCategory(p.category)) ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {!!myId && (p.player_id === myId || p.partner_id === myId) && (
                    <span className="rounded-full bg-you/15 px-2 py-0.5 text-[10px] font-black uppercase text-you">Your entry</span>
                  )}
                  {lookingIds.includes(p.id) && !p.partner_id && isDoublesCategory(p.category) && (
                    <span className="rounded-full bg-info/15 px-2 py-0.5 text-[10px] font-black uppercase text-info">Looking for a partner</span>
                  )}
                </div>
              ) : null}
              {(() => {
                if (p.display_name && p.display_name.includes("&")) {
                  const names = p.display_name.split("&").map(s => s.trim());
                  const name1 = names[0];
                  const name2 = names[1];
                  const dept1 = p.player?.department ? getDepartmentAcronym(p.player.department) : "EXT";
                  const dept2 = p.partner?.department ? getDepartmentAcronym(p.partner.department) : "EXT";

                  return (
                    <div className="flex flex-col gap-3 w-full">
                      <div className="flex flex-col min-w-0">
                        <span className="font-black text-[14px] text-foreground truncate tracking-tight">{name1}</span>
                        <span className="text-[10px] font-bold text-muted-foreground truncate mt-0.5">{dept1}</span>
                      </div>
                      <div className="w-full h-px bg-gradient-to-r from-muted-strong/50 to-transparent" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-black text-[14px] text-foreground truncate tracking-tight">{name2 || "partner"}</span>
                        <span className="text-[10px] font-bold text-muted-foreground truncate mt-0.5">{dept2}</span>
                      </div>
                    </div>
                  );
                } else {
                  const dept = p.player?.department ? getDepartmentAcronym(p.player.department) : p.custom_team_name ? getDepartmentAcronym(p.custom_team_name) : "EXT";
                  return (
                    <div className="flex flex-col">
                      <span className="font-black text-[15px] text-foreground truncate tracking-tight mb-1">
                        {p.display_name || p.player?.full_name || "Unknown Player"}
                      </span>
                      <span className="text-[11px] font-bold text-muted-foreground truncate">
                        {dept}
                      </span>
                    </div>
                  );
                }
              })()}
            </div>

            {/* Only published seeds are shown; the rest of the draw order stays private. */}
            {p.seed != null && p.seed <= seedCount && (
              <div className="flex-shrink-0 relative z-10 flex flex-col items-end justify-center self-stretch ml-2" title={`Seed ${p.seed}`}>
                <span className="text-[9px] font-black uppercase tracking-widest text-primary">Seed</span>
                <span className="text-[28px] font-black leading-none text-primary tabular-nums">{p.seed}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
