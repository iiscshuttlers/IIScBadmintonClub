import { makeDrawWarnings } from "@/lib/registration/drawWarnings";
import { isRegistrationFlagOn } from "@/services/tournament/registrationEntries";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/contexts/ConfirmContext";
import { generateSingleElimBracket, planDraw, entryRoundLabel, findWalkoverMatches } from "@/lib/bracketGenerator";
import { exportToImage } from "@/utils/exportUtils";
import { downloadCSV, readCSVFile } from "@/utils/csvUtils";
import {
  Loader2, Swords, Plus, X, Search,
  Download, Upload, AlertCircle, Phone, Camera
} from "lucide-react";
import type { Tournament, Participant } from "@/types/tournament";
import { tournamentService } from "@/services/tournamentService";
import { playerService } from "@/services/playerService";
import { ParticipantBulkActions } from "./ParticipantBulkActions";
import { ParticipantImportModal } from "./ParticipantImportModal";
import { ParticipantSeedingTable } from "./ParticipantSeedingTable";
import { ParticipantDuplicatesModal, type DuplicateGroupItem } from "./ParticipantDuplicatesModal";
import { ParticipantContactsModal } from "./ParticipantContactsModal";
import { fetchParticipantEmails } from "@/services/playerPrivateService";

/**
 * `host`: the tournament's creator editing entries outside the Manager (the
 * Organiser panel). Entry writes work for them through tp_host_manage; the
 * draw generator, contacts and phone editing need admin data or match writes,
 * so they are hidden, and the category is not kept in the URL hash.
 */
export function TournamentParticipantsTab({ tournament, variant = "manager" }: { tournament: Tournament; variant?: "manager" | "host" }) {
  const isHost = variant === "host";
  const [search, setSearch] = useState<Record<string, string>>({});
  const [partnerSearch, setPartnerSearch] = useState<Record<string, string>>({});

  const getHashCat = () => {
    if (isHost) return (tournament.categories || [])[0] || "";
    const parts = window.location.hash.replace("#", "").split("/");
    return parts[2] || (tournament.categories || [])[0] || "";
  };
  const [activeCat, setActiveCat] = useState<string>(getHashCat());
  const shownCat = (tournament.categories || []).includes(activeCat)
    ? activeCat
    : (tournament.categories || [])[0] || "";

  useEffect(() => {
    if (isHost) return;
    const handleHash = () => {
      const parts = window.location.hash.replace("#", "").split("/");
      if (parts[1] === "participants") {
        setActiveCat(parts[2] || (tournament.categories || [])[0] || "");
      }
    };
    window.addEventListener("hashchange", handleHash);
    handleHash();
    return () => window.removeEventListener("hashchange", handleHash);
  }, [tournament.categories, isHost]);

  const setTabCat = (cat: string) => {
    setActiveCat(cat);
    if (isHost) return;
    const parts = window.location.hash.replace("#", "").split("/");
    window.location.hash = `${parts[0] || ""}/participants/${cat}`;
  };

  const [adding, setAdding] = useState<string | null>(null);
  const [thirdPlacePerCat, setThirdPlacePerCat] = useState<Record<string, boolean>>({});
  const [manualOrderPerCat, setManualOrderPerCat] = useState<Record<string, boolean>>({});
  const [bulkCat, setBulkCat] = useState<string | null>(null);
  const [allCatImporting, setAllCatImporting] = useState(false);
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<Record<string, "all" | "registered" | "external">>({});
  const [adminPlayers, setAdminPlayers] = useState<any[]>([]);
  const [participants, setParticipants] = useState<Record<string, Participant[]>>({});
  const [loading, setLoading] = useState(true);
  const [contactsView, setContactsView] = useState<string | null>(null);
  const [duplicateReport, setDuplicateReport] = useState<{ cat: string; groups: DuplicateGroupItem[][] } | null>(null);

  const allPlayers = adminPlayers;
  const cardCls = "bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-5";
  const isDoubles = (cat: string) => ["MD", "WD", "XD"].includes(cat);
  const { confirm } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Entry emails are organiser/official-only and come from a checked RPC.
      const [rows, emails] = await Promise.all([
        tournamentService.fetchTournamentParticipants(tournament.id),
        fetchParticipantEmails(tournament.id),
      ]);
      const data = rows.map((p: any) => (emails[p.id] ? { ...p, email: emails[p.id] } : p));
      const playersData = await playerService.fetchAdminPlayerDirectory();
      if (playersData) setAdminPlayers(playersData);

      const grouped: Record<string, Participant[]> = {};
      for (const cat of (tournament.categories || [])) grouped[cat] = [];
      for (const p of data) {
        if (!grouped[p.category]) grouped[p.category] = [];
        grouped[p.category].push(p);
      }
      setParticipants(grouped);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load participants");
    } finally {
      setLoading(false);
    }
  }, [tournament.id, tournament.categories]);

  useEffect(() => { load(); }, [load]);

  const downloadCategoryCSV = (cat: string) => {
    const parts = participants[cat] ?? [];
    const statusFilt = filterStatus[cat] || "all";
    const doubles = isDoubles(cat);

    const filtered = parts.filter(p => {
      if (statusFilt === "registered") return p.player_id !== null;
      if (statusFilt === "external") return p.player_id === null;
      return true;
    });

    const header = doubles
      ? ["Seed", "Player 1", "P1 Status", "Player 2", "P2 Status"]
      : ["Seed", "Player", "Status"];

    const rows = filtered.map(p => {
      const player = p.player_id ? allPlayers?.find(pl => pl.id === p.player_id) : null;
      const partner = p.partner_id ? allPlayers?.find(pl => pl.id === p.partner_id) : null;
      if (doubles) {
        const p1Name = player?.full_name ?? p.display_name?.split(' &')[0]?.trim() ?? "Unknown";
        const p2Name = partner?.full_name ?? p.display_name?.split(' &')[1]?.trim() ?? "";
        return [
          (p.seed ?? "").toString(),
          p1Name,
          p.player_id ? "Registered" : "External",
          p2Name,
          p.partner_id ? "Registered" : (p2Name ? "External" : "")
        ];
      } else {
        return [
          (p.seed ?? "").toString(),
          p.display_name ?? player?.full_name ?? "Unknown",
          p.player_id ? "Registered" : "External"
        ];
      }
    });

    downloadCSV(`${tournament.name.replace(/\s+/g, '_')}_${cat}_participants.csv`, [header, ...rows]);
  };

  const downloadCategoryJPG = async (cat: string) => {
    const parts = participants[cat] ?? [];
    const statusFilt = filterStatus[cat] || "all";
    const doubles = isDoubles(cat);

    const filtered = parts.filter(p => {
      if (statusFilt === "registered") return p.player_id !== null;
      if (statusFilt === "external") return p.player_id === null;
      return true;
    });

    const header = doubles
      ? ["Seed", "Player 1", "P1 Status", "Player 2", "P2 Status"]
      : ["Seed", "Player", "Status"];

    const rows = filtered.map(p => {
      const player = p.player_id ? allPlayers?.find(pl => pl.id === p.player_id) : null;
      const partner = p.partner_id ? allPlayers?.find(pl => pl.id === p.partner_id) : null;
      if (doubles) {
        const p1Name = player?.full_name ?? p.display_name?.split(' &')[0]?.trim() ?? "Unknown";
        const p2Name = partner?.full_name ?? p.display_name?.split(' &')[1]?.trim() ?? "";
        return [
          (p.seed ?? "").toString(),
          p1Name,
          p.player_id ? "Registered" : "External",
          p2Name,
          p.partner_id ? "Registered" : (p2Name ? "External" : "")
        ];
      } else {
        return [
          (p.seed ?? "").toString(),
          p.display_name ?? player?.full_name ?? "Unknown",
          p.player_id ? "Registered" : "External"
        ];
      }
    });

    const sheetName = `${tournament.name} - ${cat} Participants`;
    const filename = `${tournament.name.replace(/\s+/g, '_')}_${cat}_participants`;

    await exportToImage([{ name: sheetName, data: [header, ...rows] }], filename);
  };

  const addParticipant = async (cat: string, playerId: string | null, partnerId: string | null, displayName: string) => {
    const nextSeed = (participants[cat]?.length ?? 0) + 1;
    try {
      await tournamentService.addTournamentParticipant({
        tournament_id: tournament.id,
        category: cat,
        player_id: playerId,
        partner_id: partnerId,
        display_name: displayName || "",
        seed: nextSeed,
      });
      await load();
      setSearch((p) => ({ ...p, [cat]: "" }));
      setPartnerSearch((p) => ({ ...p, [cat]: "" }));
      setAdding(null);
      toast.success("Participant added");
    } catch (error: any) {
      toast.error(error?.message || "Failed to add participant");
    }
  };

  const removeParticipant = async (id: string) => {
    try {
      await tournamentService.deleteTournamentParticipant(id);
      const updated = { ...participants };
      for (const cat of Object.keys(updated)) {
        const remaining = updated[cat].filter((p) => p.id !== id);
        if (remaining.length !== updated[cat].length) {
          const reseeded = remaining.map((p, i) => ({ ...p, seed: i + 1 }));
          await tournamentService.updateTournamentParticipants(
            reseeded.map((p) => ({ id: p.id, patch: { seed: p.seed } }))
          );
          updated[cat] = reseeded;
        }
      }
      setParticipants(updated);
      toast.success("Participant removed");
    } catch (error: any) {
      toast.error(error?.message || "Failed to remove participant");
    }
  };

  const updateSeed = async (id: string, seed: number) => {
    await tournamentService.updateTournamentParticipant(id, { seed });
    setParticipants((prev) => {
      const updated = { ...prev };
      for (const cat of Object.keys(updated)) {
        updated[cat] = updated[cat].map((p) => p.id === id ? { ...p, seed } : p).sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));
      }
      return updated;
    });
  };

  const updateEntryRound = async (id: string, entryRound: number | null) => {
    try {
      await tournamentService.updateTournamentParticipant(id, { entry_round: entryRound });
      setParticipants((prev) => {
        const updated = { ...prev };
        for (const cat of Object.keys(updated)) {
          updated[cat] = updated[cat].map((p) => p.id === id ? { ...p, entry_round: entryRound } : p);
        }
        return updated;
      });
    } catch (error: any) {
      toast.error(error?.message || "Failed to update entry round");
    }
  };

  const linkParticipantToPlayer = async (participantId: string, playerId: string | null, playerName: string) => {
    try {
      await tournamentService.updateTournamentParticipant(participantId, {
        player_id: playerId,
        display_name: playerName,
      });
      setParticipants((prev) => {
        const updated = { ...prev };
        for (const cat of Object.keys(updated)) {
          updated[cat] = updated[cat].map((p) =>
            p.id === participantId ? { ...p, player_id: playerId, display_name: playerName } : p
          );
        }
        return updated;
      });
      toast.success("Linked to registered profile");
    } catch (error: any) {
      toast.error(error?.message || "Failed to link participant");
    }
  };

  const linkParticipantToPartner = async (participantId: string, partnerId: string | null, partnerName: string) => {
    const current = Object.values(participants).flat().find((p) => p.id === participantId);
    const p1Name = current?.display_name?.split(" &")[0]?.trim() || "Player 1";
    const updatedName = partnerName ? `${p1Name} & ${partnerName}` : p1Name;

    try {
      await tournamentService.updateTournamentParticipant(participantId, {
        partner_id: partnerId,
        display_name: updatedName,
      });
      setParticipants((prev) => {
        const updated = { ...prev };
        for (const cat of Object.keys(updated)) {
          updated[cat] = updated[cat].map((p) =>
            p.id === participantId ? { ...p, partner_id: partnerId, display_name: updatedName } : p
          );
        }
        return updated;
      });
      toast.success("Partner linked successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to link partner");
    }
  };

  const saveEditedName = async (id: string, name1: string, name2: string) => {
    const fullName = name2 ? `${name1} & ${name2}` : name1;
    try {
      await tournamentService.updateTournamentParticipant(id, { display_name: fullName });
      setParticipants((prev) => {
        const updated = { ...prev };
        for (const cat of Object.keys(updated)) {
          updated[cat] = updated[cat].map((p) => p.id === id ? { ...p, display_name: fullName } : p);
        }
        return updated;
      });
      toast.success("Name updated");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update name");
    }
  };

  const updatePhone = async (playerId: string, phone: string) => {
    try {
      await playerService.updatePlayerContact(playerId, phone || null);
      const pl = allPlayers.find((p) => p.id === playerId);
      if (pl) pl.contact_number = phone || null;
      toast.success("Phone updated");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update phone");
    }
  };

  const saveSeeds = async (cat: string) => {
    const parts = participants[cat] ?? [];
    try {
      await tournamentService.updateTournamentParticipants(
        parts.map((p, i) => ({ id: p.id, patch: { seed: p.seed ?? i + 1 } }))
      );
      toast.success(`Seeds saved for ${cat}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to save seeds");
    }
  };

  const bulkRemove = async () => {
    const ok = await confirm({
      title: "Delete Participants",
      description: `Delete ${selectedParts.length} participants?`,
      confirmLabel: "Delete",
      confirmVariant: "danger",
    });
    if (!ok) return;
    setLoading(true);
    try {
      await tournamentService.deleteTournamentParticipants(selectedParts);
      setSelectedParts([]);
      await load();
      toast.success("Participants deleted");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete participants");
      setLoading(false);
    }
  };

  const bulkUnlink = async () => {
    setLoading(true);
    try {
      await tournamentService.updateTournamentParticipants(
        selectedParts.map((id) => ({ id, patch: { player_id: null } }))
      );
      setSelectedParts([]);
      await load();
      toast.success("Unlinked selected participants");
    } catch (error: any) {
      toast.error(error?.message || "Failed to unlink participants");
      setLoading(false);
    }
  };

  const checkDuplicates = (cat: string, parts: Participant[], doubles: boolean) => {
    const groups: DuplicateGroupItem[][] = [];
    const seen = new Map<string, DuplicateGroupItem[]>();

    for (const p of parts) {
      const pl1 = allPlayers?.find((x) => x.id === p.player_id);
      const name1 = pl1?.full_name ?? p.display_name?.split(" &")[0]?.trim() ?? "Unknown";
      const key1 = name1.toLowerCase().trim();
      if (!seen.has(key1)) seen.set(key1, []);
      seen.get(key1)!.push({ name: name1, details: `Seed ${p.seed || "?"}`, participantId: p.id });

      if (doubles) {
        const pl2 = allPlayers?.find((x) => x.id === p.partner_id);
        const name2 = pl2?.full_name ?? p.display_name?.split(" &")[1]?.trim();
        if (name2) {
          const key2 = name2.toLowerCase().trim();
          if (!seen.has(key2)) seen.set(key2, []);
          seen.get(key2)!.push({ name: name2, details: `Partner of ${name1}`, participantId: p.id });
        }
      }
    }

    groups.push(...[...seen.values()].filter((g) => g.length > 1));
    if (!groups.length) {
      toast.success(`No duplicate players found in ${cat}`);
      return;
    }
    setDuplicateReport({ cat, groups });
  };

  const handleAllCategoryCSV = async (file: File) => {
    setAllCatImporting(true);
    try {
      const rows = await readCSVFile(file);
      if (rows.length < 2) {
        toast.error("CSV file is empty or missing headers");
        return;
      }
      const header = rows[0].map((h) => h.toLowerCase().trim());
      const catIdx = header.findIndex((h) => h.includes("cat"));
      const p1Idx = header.findIndex((h) => h.includes("player 1") || h.includes("name"));
      const p2Idx = header.findIndex((h) => h.includes("player 2") || h.includes("partner"));

      if (catIdx === -1 || p1Idx === -1) {
        toast.error("CSV must contain 'Category' and 'Player 1' (or 'Name') columns");
        return;
      }

      let total = 0;
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const cat = r[catIdx]?.trim().toUpperCase();
        const p1Name = r[p1Idx]?.trim();
        const p2Name = p2Idx !== -1 ? r[p2Idx]?.trim() : "";
        if (!cat || !p1Name) continue;

        const displayName = p2Name ? `${p1Name} & ${p2Name}` : p1Name;
        const nextSeed = (participants[cat]?.length ?? 0) + 1;
        await tournamentService.addTournamentParticipant({
          tournament_id: tournament.id,
          category: cat,
          player_id: null,
          partner_id: null,
          display_name: displayName,
          seed: nextSeed,
        });
        total++;
      }
      await load();
      toast.success(`Imported ${total} participant(s) across categories`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to import CSV");
    } finally {
      setAllCatImporting(false);
    }
  };

  const playerNameById = useMemo(
    () => new Map((allPlayers ?? []).map((pl) => [pl.id, pl.full_name])),
    [allPlayers]
  );

  const toBracketParticipant = useCallback((p: Participant, index?: number) => ({
    playerId: p.player_id,
    partnerId: p.partner_id,
    displayName: p.display_name ?? (p.player_id ? playerNameById.get(p.player_id) : null) ?? "Unknown",
    seed: p.seed ?? 99,
    entryRound: p.entry_round,
    refId: p.id,
    originalIndex: index,
  }), [playerNameById]);

  const generateBracket = async (onlyCat?: string) => {
    const catsToGenerate = onlyCat ? [onlyCat] : Object.keys(participants);

    for (const cat of catsToGenerate) {
      const parts = participants[cat] ?? [];
      if (parts.length < 2) continue;
      const plan = planDraw(parts.map(toBracketParticipant));
      if (plan.overAllocatedSlots > 0) {
        toast.error(
          `${cat}: manual entry rounds need ${plan.overAllocatedSlots} more slot(s) than the ${plan.drawSize}-player draw has. Move some seeds to a later round.`
        );
        return;
      }
    }

    // In-app registration: warn about shared partners, partner-less doubles and
    // seeds that are only sign-up order before the draw locks the category.
    const drawWarnings = makeDrawWarnings(
      catsToGenerate.flatMap((cat) => participants[cat] ?? []),
      catsToGenerate,
      { flagOn: isRegistrationFlagOn(tournament) },
    );
    if (drawWarnings.length > 0) {
      const go = await confirm({
        title: "Before you make the draw",
        description: drawWarnings.join(" "),
        confirmLabel: "Make draw anyway",
        confirmVariant: "danger",
      });
      if (!go) return;
    }

    // Only this category's matches when regenerating one category.
    const existingMatchesCount = await tournamentService.countTournamentMatches(tournament.id, onlyCat);

    if (existingMatchesCount > 0) {
      const msg = onlyCat
        ? `This will delete existing bracket matches for ${onlyCat} and regenerate. Continue?`
        : "This will delete existing bracket matches and regenerate. Continue?";
      const ok = await confirm({
        title: "Regenerate Bracket",
        description: msg,
        confirmLabel: "Regenerate",
        confirmVariant: "danger",
      });
      if (!ok) return;
      if (onlyCat) {
        await tournamentService.deleteTournamentMatchesByTournament(tournament.id, onlyCat);
      } else {
        await tournamentService.deleteTournamentMatchesByTournament(tournament.id);
      }
    }

    const allRows: any[] = [];
    for (const cat of catsToGenerate) {
      const rawParts = participants[cat] ?? [];
      if (rawParts.length < 2) continue;
      const parts = manualOrderPerCat[cat]
        ? [...rawParts].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
        : rawParts;
      allRows.push(...generateSingleElimBracket(
        parts.map(toBracketParticipant), cat, tournament.id, thirdPlacePerCat[cat] ?? false, manualOrderPerCat[cat] ?? false
      ));
    }
    if (!allRows.length) {
      toast.error("Need at least 2 participants in a category to generate bracket");
      return;
    }

    try {
      const insertedRows = await tournamentService.createTournamentMatches(allRows);
      const byeMatches = findWalkoverMatches(allRows);
      let advanced = 0;
      if (byeMatches.length) {
        const byCode = new Map((insertedRows ?? []).map((r) => [r.match_code, r]));
        for (const bye of byeMatches) {
          const row = byCode.get(bye.match_code);
          if (!row) continue;
          const winningSide: 1 | 2 = bye.team2_label === "BYE" ? 1 : 2;
          await tournamentService.recordTournamentWalkover({
            p_match_id: row.id,
            p_winner_side: winningSide,
            p_umpire_id: null,
          });
          advanced++;
        }
      }
      toast.success(`Bracket generated — ${allRows.length} matches created${advanced ? `, ${advanced} bye(s) advanced` : ""}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate bracket");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {duplicateReport && (
        <ParticipantDuplicatesModal
          cat={duplicateReport.cat}
          groups={duplicateReport.groups}
          onClose={() => setDuplicateReport(null)}
          onRemoveDuplicate={async (item) => {
            const ok = await confirm({
              title: "Remove duplicate?",
              description: `Remove "${item.name}" (${item.details}) from ${duplicateReport.cat}?`,
              confirmLabel: "Remove",
              confirmVariant: "danger",
            });
            if (!ok) return;
            await tournamentService.deleteTournamentParticipant(item.participantId!);
            toast.success("Removed duplicate entry");
            await load();
            setDuplicateReport(null);
          }}
        />
      )}

      {/* Category selector. Old "#…/participants/ALL" links land on the first category. */}
      <div role="group" aria-label="Category" className="flex flex-wrap items-center gap-1.5 mb-4">
        {(tournament.categories || []).map((cat) => (
          <button
            key={cat}
            type="button"
            aria-pressed={shownCat === cat}
            onClick={() => setTabCat(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-black transition ${
              shownCat === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted-strong"
            }`}
          >
            {cat} <span className="opacity-70">{participants[cat]?.length ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Category View */}
      {(() => {
        const cat = shownCat;
        if (!cat) return null;
        const parts = participants[cat] ?? [];
        const doubles = isDoubles(cat);
        const catSearch = search[cat] || "";
        const catPartnerSearch = partnerSearch[cat] || "";

        const drawPlan = planDraw(parts.map(toBracketParticipant));
        const resolvedEntryRound = new Map<string, number>(
          drawPlan.entries.map((e) => [e.participant.refId ?? "", e.entryRound])
        );

        const filteredPlayers = (allPlayers ?? []).filter((p) =>
          p.full_name?.toLowerCase().includes(catSearch.toLowerCase())
        );

        const filteredPartners = (allPlayers ?? []).filter((p) =>
          p.full_name?.toLowerCase().includes(catPartnerSearch.toLowerCase())
        );

        return (
          <div key={cat} className={cardCls}>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row flex-wrap sm:items-center justify-between gap-3 px-1 mb-2">
                <div className="flex items-center gap-2 sm:gap-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedParts((prev) =>
                        parts.every((p) => prev.includes(p.id))
                          ? prev.filter((id) => !parts.some((p) => p.id === id))
                          : Array.from(new Set([...prev, ...parts.map((p) => p.id)]))
                      );
                    }}
                    className="text-xs font-bold text-primary hover:underline px-2 py-1 bg-primary/10 rounded-md"
                  >
                    {parts.length > 0 && parts.every((p) => selectedParts.includes(p.id)) ? "Deselect All" : "Select All"}
                  </button>

                  <select
                    value={filterStatus[cat] || "all"}
                    onChange={(e) => setFilterStatus((prev) => ({ ...prev, [cat]: e.target.value as any }))}
                    className="text-xs font-bold px-2 py-1 bg-muted border border-border-strong rounded-md outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">All</option>
                    <option value="registered">Registered Only</option>
                    <option value="external">External Only</option>
                  </select>
                  <button
                    onClick={() => { setBulkCat(cat); setAdding(null); }}
                    className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-info transition px-2 py-1 bg-muted hover:bg-muted-strong rounded-md"
                  >
                    <Upload className="w-3 h-3" /> Import
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => checkDuplicates(cat, parts, doubles)}
                    className="flex items-center gap-1 text-xs font-bold text-soft hover:text-warning transition px-2 py-1 bg-muted hover:bg-muted-strong rounded-md"
                  >
                    <AlertCircle className="w-3 h-3" /> Check Duplicates
                  </button>
                  <button
                    onClick={() => downloadCategoryJPG(cat)}
                    className="flex items-center gap-1 text-xs font-bold text-soft hover:text-success transition px-2 py-1 bg-muted hover:bg-muted-strong rounded-md"
                  >
                    <Camera className="w-3 h-3" /> Export JPG
                  </button>
                  <button
                    onClick={() => downloadCategoryCSV(cat)}
                    className="flex items-center gap-1 text-xs font-bold text-soft hover:text-primary transition px-2 py-1 bg-muted hover:bg-muted-strong rounded-md"
                  >
                    <Download className="w-3 h-3" /> Export CSV
                  </button>
                  {!isHost && (
                    <button
                      onClick={() => setContactsView(contactsView === cat ? null : cat)}
                      className="flex items-center gap-1 text-xs font-bold text-success hover:text-success/80 transition px-2 py-1 bg-success/10 hover:bg-success/20 rounded-md"
                    >
                      <Phone className="w-3 h-3" /> Contacts
                    </button>
                  )}
                </div>
              </div>

              {!isHost && contactsView === cat && (
                <ParticipantContactsModal
                  category={cat}
                  parts={parts}
                  allPlayers={allPlayers}
                  onClose={() => setContactsView(null)}
                />
              )}

              <ParticipantBulkActions
                category={cat}
                selectedCount={selectedParts.filter((id) => parts.some((p) => p.id === id)).length}
                onBulkUnlink={bulkUnlink}
                onBulkRemove={bulkRemove}
                onClearSelection={() => setSelectedParts((prev) => prev.filter((id) => !parts.some((p) => p.id === id)))}
              />

              {/* Seeding & Participant Rows */}
              <ParticipantSeedingTable
                category={cat}
                parts={parts}
                allPlayers={allPlayers}
                isDoubles={doubles}
                selectedParts={selectedParts}
                toggleSelect={(id) => {
                  setSelectedParts((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                  );
                }}
                updateSeed={updateSeed}
                updateEntryRound={updateEntryRound}
                removeParticipant={removeParticipant}
                linkParticipantToPlayer={linkParticipantToPlayer}
                linkParticipantToPartner={linkParticipantToPartner}
                saveEditedName={saveEditedName}
                updatePhone={isHost ? undefined : updatePhone}
                drawPlan={drawPlan}
                resolvedEntryRound={resolvedEntryRound}
              />

              {/* Import Modal */}
              {bulkCat === cat && (
                <ParticipantImportModal
                  tournament={tournament}
                  activeCategory={cat}
                  adminPlayers={adminPlayers}
                  isDoubles={isDoubles}
                  onClose={() => setBulkCat(null)}
                  onImportComplete={load}
                />
              )}

              {/* Add Participant Drawer */}
              {adding === cat && (
                <div className="bg-muted/50 rounded-xl p-3 space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <input
                      value={catSearch}
                      onChange={(e) => setSearch((p) => ({ ...p, [cat]: e.target.value }))}
                      placeholder={doubles ? "Search player 1…" : "Search registered player…"}
                      className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border-strong bg-card outline-none focus:ring-1 focus:ring-primary"
                    />
                    {catSearch && (
                      <div className="mt-1 w-full bg-card border border-border-strong rounded-xl shadow-sm max-h-40 overflow-y-auto">
                        {filteredPlayers.slice(0, 8).map((pl) => (
                          <button
                            key={pl.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-primary/20 transition"
                            onClick={() => {
                              if (!doubles) {
                                addParticipant(cat, pl.id, null, pl.full_name);
                                setSearch((p) => ({ ...p, [cat]: "" }));
                              } else {
                                setSearch((p) => ({ ...p, [cat]: "" }));
                                sessionStorage.setItem(`tp_p1_${cat}`, JSON.stringify({ id: pl.id, name: pl.full_name }));
                              }
                            }}
                          >
                            <span>{pl.full_name}</span>
                            {(pl.iisc_email || pl.email) && <span className="ml-2 text-[10px] text-muted-foreground">{pl.iisc_email || pl.email}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {doubles && (
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                      <input
                        value={catPartnerSearch}
                        onChange={(e) => setPartnerSearch((p) => ({ ...p, [cat]: e.target.value }))}
                        placeholder="Search partner…"
                        className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border-strong bg-card outline-none focus:ring-1 focus:ring-primary"
                      />
                      {catPartnerSearch && (
                        <div className="mt-1 w-full bg-card border border-border-strong rounded-xl shadow-sm max-h-40 overflow-y-auto">
                          {filteredPartners.slice(0, 8).map((pl) => (
                            <button
                              key={pl.id}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-primary/20 transition"
                              onClick={() => {
                                const p1Data = sessionStorage.getItem(`tp_p1_${cat}`);
                                if (p1Data) {
                                  try {
                                    const p1 = JSON.parse(p1Data);
                                    addParticipant(cat, p1.id, pl.id, `${p1.name} & ${pl.full_name}`);
                                    sessionStorage.removeItem(`tp_p1_${cat}`);
                                    setPartnerSearch((p) => ({ ...p, [cat]: "" }));
                                  } catch {
                                    sessionStorage.removeItem(`tp_p1_${cat}`);
                                  }
                                } else {
                                  toast.error("Please select Player 1 first");
                                }
                              }}
                            >
                              {pl.full_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <button onClick={() => setAdding(null)} className="text-xs text-muted-foreground hover:text-muted-foreground transition">
                    Cancel
                  </button>
                </div>
              )}

              {/* Add participant button */}
              {adding !== cat && bulkCat !== cat && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setAdding(cat)}
                    className="flex-1 py-2 text-xs font-black rounded-xl border border-dashed border-border-strong text-muted-foreground hover:border-primary hover:text-primary transition flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Participant
                  </button>
                </div>
              )}

              {isHost ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">An admin makes the draw from these entries and seeds.</p>
                  <button
                    onClick={() => saveSeeds(cat)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary text-primary-foreground text-xs font-black shadow transition"
                  >
                    Save Seeds
                  </button>
                </div>
              ) : (
              <>
              {/* Per-category 3rd place and manual order toggles */}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-bold">3rd Place Playoff</span>
                <button
                  onClick={() => setThirdPlacePerCat((p) => ({ ...p, [cat]: !p[cat] }))}
                  className={`relative w-9 h-5 rounded-full transition-colors ${thirdPlacePerCat[cat] ? "bg-primary" : "bg-faint"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-foreground shadow transition-transform ${thirdPlacePerCat[cat] ? "translate-x-4" : ""}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-bold">Manual draw order</span>
                <button
                  onClick={() => setManualOrderPerCat((p) => ({ ...p, [cat]: !p[cat] }))}
                  className={`relative w-9 h-5 rounded-full transition-colors ${manualOrderPerCat[cat] ? "bg-primary" : "bg-faint"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-foreground shadow transition-transform ${manualOrderPerCat[cat] ? "translate-x-4" : ""}`} />
                </button>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => saveSeeds(cat)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary text-primary-foreground text-xs font-black shadow transition"
                >
                  Save Seeds
                </button>
                <button
                  onClick={() => generateBracket(cat)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-individual hover:bg-individual/90 text-individual-foreground text-xs font-black shadow transition"
                >
                  <Swords className="w-3.5 h-3.5" /> Generate Bracket
                </button>
              </div>
              </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
