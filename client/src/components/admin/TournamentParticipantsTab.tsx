// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { usePlayers } from "@/hooks/usePlayers";
import { generateSingleElimBracket, planDraw, entryRoundLabel, findWalkoverMatches } from "@/lib/bracketGenerator";
import { syncBracketNames } from "@/lib/bracketSync";
import { exportToImage, exportToPDF } from "@/utils/exportUtils";
import {
  Loader2, Save, Trophy, Users, Swords, Plus, X, Search,
  ChevronDown, ChevronUp, ChevronRight, Lock, Unlock, Play,
  Download, Upload, Trash2, Clipboard, RotateCcw, AlertCircle, RefreshCw, Check, Pencil, FileText
} from "lucide-react";

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function readCSVFile(file: File): Promise<string[][]> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? "";
      const rows = text.split(/\r?\n/).map((line) => {
        const fields: string[] = [];
        let cur = "", inQ = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (c === '"') {
            if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
          } else if (c === ',' && !inQ) {
            fields.push(cur.trim());
            cur = "";
          } else {
            cur += c;
          }
        }
        fields.push(cur.trim());
        return fields;
      }).filter((r) => r.some((c) => c !== ""));
      resolve(rows);
    };
    reader.readAsText(file);
  });
}

export interface Tournament {
  id: string;
  name: string;
  status: string;
  categories: string[];
  [key: string]: any;
}

export interface Participant {
  id: string;
  category: string;
  player_id: string | null;
  partner_id: string | null;
  display_name: string | null;
  seed: number | null;
  entry_round: number | null;
}

export function TournamentParticipantsTab({ tournament }: { tournament: Tournament }) {
  const [search, setSearch] = useState<Record<string, string>>({});
  const [partnerSearch, setPartnerSearch] = useState<Record<string, string>>({});
  const getHashCat = () => {
    const parts = window.location.hash.replace("#", "").split("/");
    return parts[2] || (tournament.categories || [])[0] || "";
  };
  const [activeCat, setActiveCat] = useState<string>(getHashCat());

  useEffect(() => {
    const handleHash = () => {
      const parts = window.location.hash.replace("#", "").split("/");
      if (parts[1] === "participants") {
         setActiveCat(parts[2] || (tournament.categories || [])[0] || "");
      }
    };
    window.addEventListener("hashchange", handleHash);
    handleHash();
    return () => window.removeEventListener("hashchange", handleHash);
  }, [tournament.categories]);

  const setTabCat = (cat: string) => {
    setActiveCat(cat);
    const parts = window.location.hash.replace("#", "").split("/");
    window.location.hash = `${parts[0] || ""}/participants/${cat}`;
  };
  const [adding, setAdding] = useState<string | null>(null);
  const [externalName, setExternalName] = useState("");
  const [thirdPlacePerCat, setThirdPlacePerCat] = useState<Record<string, boolean>>({});
  const [bulkCat, setBulkCat] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkSearch2, setLinkSearch2] = useState("");
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<Record<string, "all" | "registered" | "external">>({});
  const [adminPlayers, setAdminPlayers] = useState<any[]>([]);
  const [editingName, setEditingName] = useState<{ id: string, name1: string, name2: string } | null>(null);
  const [duplicateReport, setDuplicateReport] = useState<{ cat: string, groups: { name: string, details: string }[][] } | null>(null);
  const isDoubles = (cat: string) => ["MD", "WD", "XD"].includes(cat);
  const { confirm } = useConfirm();

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
      ? ["Seed", "Player 1", "Player 1 Status", "Player 2", "Player 2 Status"] 
      : ["Seed", "Player Name", "Status"];

    const rows = filtered.map(p => {
      const player = allPlayers?.find(pl => pl.id === p.player_id);
      const partner = allPlayers?.find(pl => pl.id === p.partner_id);
      
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
      ? ["Seed", "Player 1", "Player 1 Status", "Player 2", "Player 2 Status"] 
      : ["Seed", "Player Name", "Status"];

    const rows = filtered.map(p => {
      const player = allPlayers?.find(pl => pl.id === p.player_id);
      const partner = allPlayers?.find(pl => pl.id === p.partner_id);
      
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

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tournament_participants")
      .select("*")
      .eq("tournament_id", tournament.id)
      .order("seed", { ascending: true });

    // Also fetch admin players with emails for better CSV matching
    const { data: playersData } = await supabase.from("players").select("id, full_name, email, iisc_email").is("deleted_at", null);
    if (playersData) setAdminPlayers(playersData);

    const grouped: Record<string, Participant[]> = {};
    for (const cat of (tournament.categories || [])) grouped[cat] = [];
    for (const p of (data ?? []) as Participant[]) {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    }
    setParticipants(grouped);
    setLoading(false);
  }, [tournament.id]);

  useEffect(() => { load(); }, [load]);

  const addParticipant = async (cat: string, playerId: string | null, partnerId: string | null, displayName: string) => {
    const nextSeed = (participants[cat]?.length ?? 0) + 1;
    const { error } = await supabase.from("tournament_participants").insert({
      tournament_id: tournament.id,
      category: cat,
      player_id: playerId,
      partner_id: partnerId,
      display_name: displayName || null,
      seed: nextSeed,
    });
    if (error) { toast.error(error.message); return; }
    await load();
    setSearch((p) => ({ ...p, [cat]: "" }));
    setPartnerSearch((p) => ({ ...p, [cat]: "" }));
    setExternalName("");
    setAdding(null);
    toast.success("Participant added");
  };

  const removeParticipant = async (id: string) => {
    const { error } = await supabase.from("tournament_participants").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    // Re-sequence seeds for all affected categories
    const updated = { ...participants };
    for (const cat of Object.keys(updated)) {
      const remaining = updated[cat].filter((p) => p.id !== id);
      if (remaining.length !== updated[cat].length) {
        const reseeded = remaining.map((p, i) => ({ ...p, seed: i + 1 }));
        await Promise.all(reseeded.map((p) =>
          supabase.from("tournament_participants").update({ seed: p.seed }).eq("id", p.id)
        ));
        updated[cat] = reseeded;
      }
    }
    setParticipants(updated);
  };

  const updateSeed = async (id: string, seed: number) => {
    await supabase.from("tournament_participants").update({ seed }).eq("id", id);
    setParticipants((prev) => {
      const updated = { ...prev };
      for (const cat of Object.keys(updated)) {
        updated[cat] = updated[cat].map((p) => p.id === id ? { ...p, seed } : p).sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));
      }
      return updated;
    });
  };

  const updateEntryRound = async (id: string, entryRound: number | null) => {
    const { error } = await supabase
      .from("tournament_participants")
      .update({ entry_round: entryRound })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    setParticipants((prev) => {
      const updated = { ...prev };
      for (const cat of Object.keys(updated)) {
        updated[cat] = updated[cat].map((p) => p.id === id ? { ...p, entry_round: entryRound } : p);
      }
      return updated;
    });
  };

  const clearEntryRounds = async (cat: string) => {
    const pinned = (participants[cat] ?? []).filter((p) => p.entry_round != null);
    if (!pinned.length) { toast.success(`No manual entry rounds set in ${cat}`); return; }
    const { error } = await supabase
      .from("tournament_participants")
      .update({ entry_round: null })
      .in("id", pinned.map((p) => p.id));
    if (error) { toast.error(error.message); return; }
    setParticipants((prev) => ({
      ...prev,
      [cat]: (prev[cat] ?? []).map((p) => ({ ...p, entry_round: null })),
    }));
    toast.success(`Reset ${pinned.length} manual entry round(s) in ${cat}`);
  };

  /**
   * Push a participant edit straight into the bracket so it also reaches the
   * umpire panel, live scores and anything else reading `tournament_matches`.
   *
   * Restricted to `scheduled` rows: a late partner edit must never rewrite a
   * match that is already in progress or completed. The manual "Sync Names"
   * button remains the way to force a full sweep across every round.
   */
  const autoSyncBracket = async (category: string | undefined, whatChanged: string) => {
    if (!category || !tournament?.id) return;
    try {
      const { updated, invalidDraw } = await syncBracketNames({
        tournamentId: tournament.id,
        category,
        onlyScheduled: true,
        resolvePlayerName: (id) => allPlayers?.find((pl) => pl.id === id)?.full_name,
      });
      if (invalidDraw) return; // bracket not generated yet, or draw doesn't fit
      if (updated > 0) {
        // Participant state is already updated optimistically by the caller, and
        // the bracket tab reloads on its own — no refetch needed here.
        toast.success(`${whatChanged} — bracket updated (${updated} match${updated === 1 ? "" : "es"})`);
      }
    } catch (err: any) {
      // Never let a sync failure mask the successful participant edit.
      toast.error(`Participant saved, but bracket sync failed: ${err?.message ?? "unknown error"}. Use "Sync Names" on the Bracket tab.`);
    }
  };

  const linkParticipantToPlayer = async (participantId: string, playerId: string | null, playerName: string) => {
    // Determine the new display name if it's doubles (preserve the partner's name)
    const p = participants[Object.keys(participants).find(cat => participants[cat].some(p => p.id === participantId)) || ""]?.find(p => p.id === participantId);
    let newDisplayName = playerName;
    if (p && p.category && ["MD", "WD", "XD"].includes(p.category)) {
      const partner = allPlayers?.find((pl) => pl.id === p.partner_id);
      if (partner) newDisplayName = `${playerName} & ${partner.full_name}`;
      else if (p.display_name && p.display_name.includes('&')) {
        const parts = p.display_name.split('&');
        newDisplayName = `${playerName} & ${parts[1].trim()}`;
      }
    }

    const { error } = await supabase.from("tournament_participants")
      .update({ player_id: playerId, display_name: newDisplayName })
      .eq("id", participantId);
    if (error) { toast.error(error.message); return; }
    
    setParticipants((prev) => {
      const updated = { ...prev };
      for (const cat of Object.keys(updated)) {
        updated[cat] = updated[cat].map((pt) => pt.id === participantId ? { ...pt, player_id: playerId, display_name: newDisplayName } : pt);
      }
      return updated;
    });
    setLinkingId(null);
    setLinkSearch("");
    toast.success(`Linked to ${playerName}`);
    await autoSyncBracket(p?.category, `Linked to ${playerName}`);
  };

  const linkParticipantToPartner = async (participantId: string, partnerId: string | null, partnerName: string) => {
    const p = participants[Object.keys(participants).find(cat => participants[cat].some(p => p.id === participantId)) || ""]?.find(p => p.id === participantId);
    let newDisplayName = partnerName;
    if (p) {
      const player1 = allPlayers?.find((pl) => pl.id === p.player_id);
      if (player1) newDisplayName = `${player1.full_name} & ${partnerName}`;
      else if (p.display_name && p.display_name.includes('&')) {
        const parts = p.display_name.split('&');
        newDisplayName = `${parts[0].trim()} & ${partnerName}`;
      } else if (p.display_name) {
        newDisplayName = `${p.display_name.trim()} & ${partnerName}`;
      }
    }

    const { error } = await supabase.from("tournament_participants")
      .update({ partner_id: partnerId, display_name: newDisplayName })
      .eq("id", participantId);
    if (error) { toast.error(error.message); return; }
    
    setParticipants((prev) => {
      const updated = { ...prev };
      for (const cat of Object.keys(updated)) {
        updated[cat] = updated[cat].map((pt) => pt.id === participantId ? { ...pt, partner_id: partnerId, display_name: newDisplayName } : pt);
      }
      return updated;
    });
    setLinkingId(null);
    setLinkSearch2("");
    toast.success(`Partner set to ${partnerName}`);
    await autoSyncBracket(p?.category, `Partner set to ${partnerName}`);
  };

  const saveEditedName = async () => {
    if (!editingName) return;
    const p = participants[Object.keys(participants).find(cat => participants[cat].some(p => p.id === editingName.id)) || ""]?.find(p => p.id === editingName.id);
    if (!p) return;
    
    const doubles = ["MD", "WD", "XD"].includes(p.category);
    const newDisplayName = doubles 
      ? `${editingName.name1.trim()} & ${editingName.name2.trim()}`
      : editingName.name1.trim();
      
    const { error } = await supabase.from("tournament_participants")
      .update({ display_name: newDisplayName })
      .eq("id", editingName.id);
      
    if (error) { toast.error(error.message); return; }
    
    setParticipants((prev) => {
      const updated = { ...prev };
      for (const cat of Object.keys(updated)) {
        updated[cat] = updated[cat].map((pt) =>
          pt.id === editingName.id ? { ...pt, display_name: newDisplayName } : pt
        );
      }
      return updated;
    });
    setEditingName(null);
    toast.success("Name updated");
    await autoSyncBracket(p.category, "Name updated");
  };

  const saveSeeds = async (cat: string) => {
    const parts = participants[cat] ?? [];
    await Promise.all(parts.map((p, i) =>
      supabase.from("tournament_participants").update({ seed: p.seed ?? i + 1 }).eq("id", p.id)
    ));
    toast.success(`Seeds saved for ${cat}`);
  };

  const bulkRemove = async () => {
    const ok = await confirm({ title: "Delete Participants", description: `Delete ${selectedParts.length} participants?`, confirmLabel: "Delete", confirmVariant: "danger" });
    if (!ok) return;
    setLoading(true);
    await supabase.from("tournament_participants").delete().in("id", selectedParts);
    await load();
    setSelectedParts([]);
    setLoading(false);
  };

  const bulkUnlink = async () => {
    const ok = await confirm({ title: "Unlink Participants", description: `Unlink ${selectedParts.length} participants?`, confirmLabel: "Unlink", confirmVariant: "danger" });
    if (!ok) return;
    setLoading(true);
    await supabase.from("tournament_participants").update({ player_id: null }).in("id", selectedParts);
    await load();
    setSelectedParts([]);
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedParts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Parse bulk pasted text — each non-empty line is one entry.
  const parseBulkLines = (text: string, cat: string) => {
    const doubles = isDoubles(cat);
    return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const matchPlayer = (name: string, personal: string, iisc: string) => {
        if (!name && !personal && !iisc) return null;
        return adminPlayers.find(p => {
          if (name && p.full_name && p.full_name.toLowerCase() === name.toLowerCase()) return true;
          if (personal && p.email && p.email.toLowerCase() === personal.toLowerCase()) return true;
          if (iisc && p.iisc_email && p.iisc_email.toLowerCase() === iisc.toLowerCase()) return true;
          
          if (personal && p.iisc_email && p.iisc_email.toLowerCase() === personal.toLowerCase()) return true;
          if (iisc && p.email && p.email.toLowerCase() === iisc.toLowerCase()) return true;
          return false;
        }) ?? null;
      };

      if (doubles) {
        // tab-separated (Excel copy) or " & " separated
        const rawParts = line.includes("\t") ? line.split("\t").map(s => s.trim()) : line.split(/\s*&\s*/).map(s => s.trim());
        const validParts = rawParts.filter(Boolean);
        
        let name1 = "", name2 = "", email1 = "", email2 = "";
        
        if (validParts.length >= 6) {
           name1 = validParts[0]; email1 = validParts[1] || validParts[2];
           name2 = validParts[3]; email2 = validParts[4] || validParts[5];
        } else {
           let state = 1; 
           for (const p of validParts) {
             const isEmail = p.includes("@");
             if (state === 1) {
                if (!name1 && !isEmail) { name1 = p; }
                else if (isEmail) {
                   if (!email1) email1 = p;
                } else {
                   state = 2;
                   name2 = p;
                }
             } else if (state === 2) {
                if (isEmail) {
                   if (!email2) email2 = p;
                } else {
                   if (!name2) name2 = p;
                   else name2 += " " + p;
                }
             }
           }
        }

        const match1 = matchPlayer(name1, email1, email1) || ((allPlayers ?? []).find(p => name1 && p.full_name.toLowerCase() === name1.toLowerCase()) ?? null);
        const match2 = name2 ? (matchPlayer(name2, email2, email2) || ((allPlayers ?? []).find(p => name2 && p.full_name.toLowerCase() === name2.toLowerCase()) ?? null)) : null;
        return { raw: line, name1, name2, match1, match2 };
      } else {
        const parts = line.split("\t").map(s => s.trim()).filter(Boolean);
        let name = "", email = "";
        for (const p of parts) {
          if (p.includes("@")) { if (!email) email = p; }
          else { if (!name) name = p; }
        }
        
        const match = matchPlayer(name, email, email) || ((allPlayers ?? []).find(p => name && p.full_name.toLowerCase() === name.toLowerCase()) ?? null);
        return { raw: line, name1: name, name2: "", match1: match, match2: null };
      }
    });
  };

  const runBulkImport = async (cat: string) => {
    const entries = parseBulkLines(bulkText, cat);
    if (!entries.length) return;
    setBulkImporting(true);
    let seed = (participants[cat]?.length ?? 0) + 1;
    for (const entry of entries) {
      const playerId = entry.match1?.id ?? null;
      const partnerId = entry.match2?.id ?? null;
      const displayName = isDoubles(cat)
        ? (entry.name2 ? `${entry.name1} & ${entry.name2}` : entry.name1)
        : entry.name1;
      await supabase.from("tournament_participants").insert({
        tournament_id: tournament.id,
        category: cat,
        player_id: playerId,
        partner_id: partnerId,
        display_name: displayName || null,
        seed: seed++,
      });
    }
    await load();
    setBulkCat(null);
    setBulkText("");
    setBulkImporting(false);
    toast.success(`${entries.length} participant(s) imported`);
  };

  const downloadParticipantTemplate = (cat: string) => {
    const doubles = isDoubles(cat);
    const header = doubles 
      ? ["Player1 Name", "Player1 Personal Email", "Player1 IISc Email", "Player2 Name", "Player2 Personal Email", "Player2 IISc Email"] 
      : ["Player Name", "Personal Email", "IISc Email"];
    const examples = doubles
      ? [["Rahul Sharma", "rahul@gmail.com", "rahul@iisc.ac.in", "Priya Nair", "priya@gmail.com", "priya@iisc.ac.in"]]
      : [["Rahul Sharma", "rahul@gmail.com", "rahul@iisc.ac.in"]];
    downloadCSV(`${cat}_participants_template.csv`, [header, ...examples]);
  };

  const handleParticipantCSV = async (cat: string, file: File) => {
    const rows = await readCSVFile(file);
    const doubles = isDoubles(cat);
    // Skip header row if first cell looks like a header label
    const dataRows = rows[0]?.[0]?.toLowerCase().match(/^(player|name)/) ? rows.slice(1) : rows;
    const lines = dataRows.map((r) => {
      if (doubles) {
        return [r[0] ?? "", r[1] ?? "", r[2] ?? "", r[3] ?? "", r[4] ?? "", r[5] ?? ""].join("\t");
      } else {
        return [r[0] ?? "", r[1] ?? "", r[2] ?? ""].join("\t");
      }
    }).filter(line => line.replace(/\t/g, '').trim().length > 0);
    setBulkText(lines.join("\n"));
    setBulkCat(cat);
  };

  const hasMatches = async () => {
    const { count } = await supabase.from("tournament_matches").select("id", { count: "exact", head: true }).eq("tournament_id", tournament.id);
    return (count ?? 0) > 0;
  };

  const checkDuplicates = (cat: string, catParts: any[], doubles: boolean) => {
    const isSimilar = (n1: string, n2: string) => {
      const clean = (s: string) => s.replace(/\bguest\b/gi, '').replace(/[^a-z0-9\s]/gi, '').toLowerCase().trim();
      const a = clean(n1);
      const b = clean(n2);
      if (a === b) return true;
      if (a.length > 5 && b.includes(a)) return true;
      if (b.length > 5 && a.includes(b)) return true;
      
      const wa = a.split(/\s+/).filter(w => w.length > 2);
      const wb = b.split(/\s+/).filter(w => w.length > 2);
      if (wa.length === 0 || wb.length === 0) return false;
      let match = 0;
      wa.forEach(w => { if (wb.some(x => x === w)) match++; });
      if (match >= 2) return true;
      
      const dist = (s1: string, s2: string) => {
        const m = s1.length, n = s2.length;
        const dp = Array.from({length: m+1}, () => new Array(n+1).fill(0));
        for(let i=0; i<=m; i++) dp[i][0] = i;
        for(let j=0; j<=n; j++) dp[0][j] = j;
        for(let i=1; i<=m; i++) {
          for(let j=1; j<=n; j++) {
            dp[i][j] = s1[i-1] === s2[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
          }
        }
        return dp[m][n];
      };
      if (Math.abs(a.length - b.length) < 3 && dist(a, b) <= 2) return true;
      return false;
    };

    const mappedNames: { name: string, details: string }[] = [];
    catParts.forEach((p, index) => {
      const details = p.seed ? `Seed ${p.seed}` : `Row ${index + 1}`;
      if (doubles) {
        let n1 = p.display_name ?? allPlayers?.find((pl) => pl.id === p.player_id)?.full_name ?? "Unknown";
        let n2 = allPlayers?.find((pl) => pl.id === p.partner_id)?.full_name ?? "partner";
        if (p.display_name && p.display_name.includes("&")) {
          const splitNames = p.display_name.split("&").map(s => s.trim());
          n1 = splitNames[0];
          n2 = splitNames[1] || n2;
        }
        mappedNames.push({ name: n1, details });
        mappedNames.push({ name: n2, details });
      } else {
        let n = p.display_name ?? allPlayers?.find((pl) => pl.id === p.player_id)?.full_name ?? "Unknown";
        mappedNames.push({ name: n, details });
      }
    });

    const nameItems = mappedNames.filter(n => n.name && n.name.toLowerCase() !== "unknown" && n.name.toLowerCase() !== "partner");
    const groups: { name: string, details: string }[][] = [];
    const visited = new Set<number>();

    for (let i = 0; i < nameItems.length; i++) {
      if (visited.has(i)) continue;
      
      let currentGroup = [nameItems[i]];
      visited.add(i);

      let added = true;
      while(added) {
        added = false;
        for (let j = 0; j < nameItems.length; j++) {
          if (visited.has(j)) continue;
          if (currentGroup.some(gItem => isSimilar(gItem.name, nameItems[j].name))) {
             currentGroup.push(nameItems[j]);
             visited.add(j);
             added = true;
          }
        }
      }

      if (currentGroup.length > 1) {
        groups.push(currentGroup);
      }
    }

    if (groups.length > 0) {
      setDuplicateReport({ cat, groups });
    } else {
      toast.success(`No similar or duplicate names found in ${cat}!`);
    }
  };

  // Runs on every render (the draw preview needs it), so keep the name lookup O(1).
  const playerNameById = useMemo(
    () => new Map((allPlayers ?? []).map((pl) => [pl.id, pl.full_name])),
    [allPlayers]
  );

  const toBracketParticipant = useCallback((p: Participant) => ({
    playerId: p.player_id,
    partnerId: p.partner_id,
    displayName: p.display_name ?? (p.player_id ? playerNameById.get(p.player_id) : null) ?? "Unknown",
    seed: p.seed ?? 99,
    entryRound: p.entry_round,
    refId: p.id,
  }), [playerNameById]);

  const generateBracket = async (onlyCat?: string) => {
    if (bulkText.trim() && bulkCat && (!onlyCat || onlyCat === bulkCat)) {
      toast.error(`You have un-imported participants in ${bulkCat}. Please click 'Import' first.`);
      return;
    }

    const catsToGenerate = onlyCat ? [onlyCat] : Object.keys(participants);

    // Refuse up front if the pinned entry rounds ask for more of the draw than exists.
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

    if (await hasMatches()) {
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
        await supabase.from("tournament_matches").delete().eq("tournament_id", tournament.id).eq("category", onlyCat);
      } else {
        await supabase.from("tournament_matches").delete().eq("tournament_id", tournament.id);
      }
    }
    const allRows = [];
    for (const cat of catsToGenerate) {
      const parts = participants[cat] ?? [];
      if (parts.length < 2) continue;
      allRows.push(...generateSingleElimBracket(
        parts.map(toBracketParticipant), cat, tournament.id, thirdPlacePerCat[cat] ?? false
      ));
    }
    if (!allRows.length) { toast.error("Need at least 2 participants in a category to generate bracket"); return; }
    const { error } = await supabase.from("tournament_matches").insert(allRows);
    if (error) { toast.error(error.message); return; }

    // Auto-advance byes. A participant given more than one bye is walked over in
    // several consecutive rounds, so these must be submitted in round order —
    // each result has to land before the next round's match is decided.
    const byeMatches = findWalkoverMatches(allRows);
    let advanced = 0;
    if (byeMatches.length) {
      const { data: insertedRows } = await supabase
        .from("tournament_matches")
        .select("id, match_code, team1_label, team2_label")
        .eq("tournament_id", tournament.id)
        .in("match_code", byeMatches.map((r) => r.match_code));
      const byCode = new Map((insertedRows ?? []).map((r) => [r.match_code, r]));
      for (const bye of byeMatches) {
        const row = byCode.get(bye.match_code);
        if (!row) continue;
        const winningSide: 1 | 2 = bye.team2_label === "BYE" ? 1 : 2;
        const { error: rpcError } = await supabase.rpc("submit_tournament_match", {
          p_match_id: row.id,
          p_winner_side: winningSide,
          p_score: "W/O",
          p_sets: [],
          p_umpire_id: null,
        });
        if (!rpcError) advanced++;
      }
    }

    toast.success(`Bracket generated — ${allRows.length} matches created${advanced ? `, ${advanced} bye(s) advanced` : ""}`);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {duplicateReport && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
               <h2 className="font-black text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                 <AlertCircle className="w-5 h-5 text-[var(--warning)]" />
                 Potential Duplicates in {duplicateReport.cat}
               </h2>
               <div className="flex items-center gap-2">
                 <button 
                   onClick={() => {
                     const rows = [["Group", "Name", "Details"]];
                     duplicateReport.groups.forEach((g, i) => g.forEach(item => rows.push([`Group ${i+1}`, item.name, item.details])));
                     const csvContent = rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
                     const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                     const link = document.createElement("a");
                     link.href = URL.createObjectURL(blob);
                     link.setAttribute("download", `duplicates_${duplicateReport.cat}.csv`);
                     document.body.appendChild(link);
                     link.click();
                     document.body.removeChild(link);
                   }}
                   className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary transition px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md"
                 >
                   <Download className="w-3 h-3" /> Download
                 </button>
                 <button onClick={() => setDuplicateReport(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                   <X className="w-5 h-5"/>
                 </button>
               </div>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
               {duplicateReport.groups.map((g, i) => (
                  <div key={i} className="bg-amber-50/50 dark:bg-[var(--warning)]/10 p-4 rounded-xl border border-[var(--warning)]/50 dark:border-[var(--warning)]/50">
                     <h4 className="text-[10px] font-black text-[var(--warning)]/80 uppercase tracking-widest mb-2">Match Group {i+1}</h4>
                     <ul className="space-y-2">
                        {g.map((item, j) => (
                          <li key={j} className="text-sm flex items-center justify-between font-bold text-slate-700 dark:text-slate-300 before:content-[''] before:w-1.5 before:h-1.5 before:bg-[var(--warning)] before:rounded-full before:mr-2">
                            <span className="truncate">{item.name}</span>
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md shrink-0">{item.details}</span>
                          </li>
                        ))}
                     </ul>
                  </div>
               ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {(tournament.categories || []).map((cat) => (
          <button
            key={cat}
            onClick={() => setTabCat(cat)}
            className={`px-4 py-2 rounded-full text-sm font-black transition ${
              activeCat === cat
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {cat} <span className="opacity-75 ml-1">({participants[cat]?.length ?? 0})</span>
          </button>
        ))}
      </div>

      {(!tournament.categories || tournament.categories.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
          <p className="text-sm font-bold text-slate-500">No categories selected for this tournament yet.</p>
          <p className="text-xs text-slate-400 mt-1">Go to the Setup tab to select categories first.</p>
        </div>
      )}

      {(tournament.categories || []).includes(activeCat) && (() => {
        const cat = activeCat;
        const allParts = participants[cat] ?? [];
        const statusFilt = filterStatus[cat] || "all";
        const parts = allParts.filter(p => {
          if (statusFilt === "registered") return p.player_id !== null;
          if (statusFilt === "external") return p.player_id === null;
          return true;
        });

        const doubles = isDoubles(cat);
        const catSearch = search[cat] ?? "";
        const catPartnerSearch = partnerSearch[cat] ?? "";

        // Live draw preview — drives the bye budget counter and the per-player
        // entry round options below. Uses the full category list, not the
        // filtered view, so the numbers stay honest while searching.
        const drawPlan = allParts.length >= 2 ? planDraw(allParts.map(toBracketParticipant)) : null;
        const resolvedEntryRound = new Map(
          (drawPlan?.entries ?? []).map((e) => [e.participant.refId!, e.entryRound])
        );

        const genderFilter = (p: { gender?: string | null }) => {
          if (cat === "MS" || cat === "MD") return p.gender == null || p.gender === "Male";
          if (cat === "WS" || cat === "WD") return p.gender == null || p.gender === "Female";
          return true; // XD — allow both
        };
        const filteredPlayers = (allPlayers ?? []).filter(
          (p) => !p.is_guest && genderFilter(p) && p.full_name.toLowerCase().includes(catSearch.toLowerCase())
        );
        const filteredPartners = (allPlayers ?? []).filter(
          (p) => !p.is_guest && genderFilter(p) && p.full_name.toLowerCase().includes(catPartnerSearch.toLowerCase())
        );

        return (
          <div key={cat} className={cardCls}>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row flex-wrap sm:items-center justify-between gap-3 px-1 mb-2">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedParts(prev => 
                          parts.every(p => prev.includes(p.id)) 
                            ? prev.filter(id => !parts.some(p => p.id === id)) 
                            : Array.from(new Set([...prev, ...parts.map(p => p.id)]))
                        );
                      }}
                      className="text-xs font-bold text-primary hover:underline px-2 py-1 bg-primary/10 rounded-md"
                    >
                      {parts.length > 0 && parts.every(p => selectedParts.includes(p.id)) ? "Deselect All" : "Select All"}
                    </button>
                    
                    <select
                      value={filterStatus[cat] || "all"}
                      onChange={(e) => setFilterStatus(prev => ({ ...prev, [cat]: e.target.value as any }))}
                      className="text-xs font-bold px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="all">All</option>
                      <option value="registered">Registered Only</option>
                      <option value="external">External Only</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => checkDuplicates(cat, parts, doubles)}
                      className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[var(--warning)] transition px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md"
                    >
                      <AlertCircle className="w-3 h-3" /> Check Duplicates
                    </button>
                    <button
                      onClick={() => downloadCategoryJPG(cat)}
                      className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-green-500 transition px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md"
                    >
                      <Camera className="w-3 h-3" /> Export JPG
                    </button>
                    <button
                      onClick={() => downloadCategoryCSV(cat)}
                      className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary transition px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md"
                    >
                      <Download className="w-3 h-3" /> Export CSV
                    </button>
                  </div>
                </div>
                {selectedParts.length > 0 && parts.some(p => selectedParts.includes(p.id)) && (
                  <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-xl mb-4">
                    <span className="text-sm font-bold text-primary flex-1">
                      {selectedParts.filter(id => parts.some(p => p.id === id)).length} selected in {cat}
                    </span>
                    <button onClick={bulkUnlink} className="px-3 py-1.5 text-xs font-bold text-[var(--warning)] bg-[var(--warning)] hover:bg-[var(--warning)] rounded-lg transition flex items-center gap-1">
                      <Unlink className="w-3 h-3" /> Unlink
                    </button>
                    <button onClick={bulkRemove} className="px-3 py-1.5 text-xs font-bold text-[var(--danger)] bg-[var(--danger)] hover:bg-[var(--danger)] rounded-lg transition flex items-center gap-1">
                      <X className="w-3 h-3" /> Delete
                    </button>
                    <button onClick={() => setSelectedParts(prev => prev.filter(id => !parts.some(p => p.id === id)))} className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-lg transition flex items-center gap-1">
                      Clear
                    </button>
                  </div>
                )}
                {drawPlan && (
                  <div className={`rounded-xl border p-3 mb-3 ${drawPlan.overAllocatedSlots > 0 ? "border-[var(--danger)] dark:border-[var(--danger)] bg-rose-50 dark:bg-[var(--danger)]/30" : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40"}`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-xs font-black text-slate-700 dark:text-slate-200">
                        Draw of {drawPlan.drawSize}
                        <span className="font-bold text-muted-foreground"> · {allParts.length} entries</span>
                      </div>
                      <button
                        onClick={() => clearEntryRounds(cat)}
                        className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-primary transition px-2 py-1 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800"
                      >
                        Reset to automatic
                      </button>
                    </div>
                    {drawPlan.overAllocatedSlots > 0 ? (
                      <p className="mt-1.5 text-xs font-bold text-[var(--danger)] dark:text-[var(--danger)]">
                        Manual entry rounds need {drawPlan.overAllocatedSlots} more slot(s) than the draw has — move some seeds to a later round before generating.
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs font-bold text-muted-foreground">
                        {drawPlan.totalByeSlots} bye slot{drawPlan.totalByeSlots === 1 ? "" : "s"}:
                        {" "}<span className="text-slate-700 dark:text-slate-200">{drawPlan.manualByeSlots} assigned by hand</span>,
                        {" "}<span className="text-slate-700 dark:text-slate-200">{drawPlan.autoByeSlots} auto-filled down the seed list</span>.
                      </p>
                    )}
                    {drawPlan.forcedAdjustments.length > 0 && (
                      <p className="mt-1 text-xs font-bold text-[var(--warning)] dark:text-[var(--warning)]">
                        {drawPlan.forcedAdjustments.length} pinned entr{drawPlan.forcedAdjustments.length === 1 ? "y was" : "ies were"} moved a round later to fill the draw.
                      </p>
                    )}
                  </div>
                )}
                {parts.map((p, i) => {
                  const player = allPlayers?.find((pl) => pl.id === p.player_id);
                  const partner = allPlayers?.find((pl) => pl.id === p.partner_id);
                  const effectiveRound = resolvedEntryRound.get(p.id) ?? 1;
                  return (
                    <div key={p.id} className="flex flex-col gap-2 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/20 px-2 -mx-2 rounded-xl transition-colors">
                      {/* Top Row */}
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="flex items-center gap-2 sm:gap-3 mt-1 shrink-0">
                          <input type="checkbox" checked={selectedParts.includes(p.id)} onChange={() => toggleSelect(p.id)} className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer" />
                          <input type="number" min={1}
                            value={p.seed ?? i + 1}
                            onChange={(e) => updateSeed(p.id, parseInt(e.target.value))}
                            className="w-10 sm:w-12 text-center text-sm font-black rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all" />
                        </div>
                        <div className="flex-1 flex flex-col min-w-0">
                          {(() => {
                            let name1 = p.display_name ?? player?.full_name ?? "Unknown";
                            let name2 = partner?.full_name ?? "partner";
                            let dept1 = player?.department || "External/Other";
                            let dept2 = partner?.department || "External/Other";

                            if (doubles && p.display_name && p.display_name.includes("&")) {
                               const names = p.display_name.split("&").map(s => s.trim());
                               name1 = names[0];
                               name2 = names[1];
                            }
                            
                            if (doubles) {
                              return (
                                <div className="flex flex-col sm:flex-row sm:items-start w-full gap-1.5 sm:gap-3">
                                  <div className="flex flex-col flex-1 min-w-0 sm:pr-3 sm:border-r border-slate-200 dark:border-slate-700">
                                    <div className="text-sm font-bold text-slate-800 dark:text-foreground truncate flex items-center gap-1.5">
                                      <span className="truncate">{name1}</span>
                                      {!p.player_id && <span className="text-[9px] font-black uppercase text-[var(--warning)] bg-[var(--warning)] dark:text-[var(--warning)] dark:bg-[var(--warning)]/50 px-1.5 py-0.5 rounded-full shrink-0">ext</span>}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate mt-0.5">{getDepartmentAcronym(dept1)}</span>
                                  </div>
                                  <div className="flex flex-col flex-1 min-w-0 sm:pl-1">
                                    <div className="text-sm font-bold text-slate-800 dark:text-foreground truncate flex items-center gap-1.5">
                                      <span className="truncate">{name2}</span>
                                      {!p.partner_id && <span className="text-[9px] font-black uppercase text-[var(--warning)] bg-[var(--warning)] dark:text-[var(--warning)] dark:bg-[var(--warning)]/50 px-1.5 py-0.5 rounded-full shrink-0">ext</span>}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate mt-0.5">{getDepartmentAcronym(dept2)}</span>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="flex flex-col justify-center min-h-[32px]">
                                  <div className="text-sm font-bold text-slate-800 dark:text-foreground truncate flex items-center gap-2">
                                    <span className="truncate">{p.display_name ?? player?.full_name ?? "Unknown"}</span>
                                    {!p.player_id && (
                                      <span className="text-[9px] font-black uppercase text-[var(--warning)] bg-[var(--warning)] dark:text-[var(--warning)] dark:bg-[var(--warning)]/50 px-1.5 py-0.5 rounded-full shrink-0">external</span>
                                    )}
                                  </div>
                                  {player?.department && (
                                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                                      {getDepartmentAcronym(player.department)}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          })()}
                        </div>
                        <button onClick={() => removeParticipant(p.id)}
                          title="Remove Participant"
                          className="p-1.5 mt-0.5 text-slate-400 hover:text-[var(--danger)] hover:bg-rose-50 dark:hover:bg-[var(--danger)]/30 rounded-lg transition shrink-0 ml-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Bottom Row */}
                      <div className="flex flex-wrap items-center gap-2 pl-[3.25rem] sm:pl-[4.25rem]">
                        {drawPlan && (
                          <select
                            value={p.entry_round == null ? "" : String(p.entry_round)}
                            onChange={(e) => updateEntryRound(p.id, e.target.value === "" ? null : parseInt(e.target.value))}
                            title="Round this player plays their first match in"
                            className={`shrink-0 text-[11px] font-bold rounded-lg border py-1.5 px-2 outline-none max-w-[10rem] cursor-pointer transition-colors ${p.entry_round == null ? "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-muted-foreground hover:border-slate-300 dark:hover:border-slate-600" : "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"}`}
                          >
                            <option value="" className="bg-slate-800 text-slate-100">Auto — {entryRoundLabel(effectiveRound, drawPlan.drawSize)}</option>
                            {Array.from(
                              { length: Math.max(1, Math.min(drawPlan.totalRounds - 1, 4)) },
                              (_, idx) => idx + 1
                            ).map((r) => (
                              <option key={r} value={r} className="bg-slate-800 text-slate-100">
                                {entryRoundLabel(r, drawPlan.drawSize)}
                                {r > 1 ? ` (${r - 1} bye${r > 2 ? "s" : ""})` : ""}
                              </option>
                            ))}
                          </select>
                        )}
                        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700/50">
                          <button
                            onClick={() => {
                              let n1 = p.display_name ?? player?.full_name ?? "Unknown";
                              let n2 = partner?.full_name ?? "partner";
                              if (doubles && p.display_name && p.display_name.includes("&")) {
                                 const names = p.display_name.split("&").map(s => s.trim());
                                 n1 = names[0];
                                 n2 = names[1];
                              }
                              setEditingName({ id: p.id, name1: n1, name2: n2 });
                              setLinkingId(null);
                            }}
                            title="Edit Names"
                            className="p-1.5 text-slate-500 hover:text-[var(--info)] hover:bg-white dark:hover:bg-slate-700 rounded-md transition">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setLinkingId(linkingId === p.id ? null : p.id); setLinkSearch(""); setEditingName(null); }}
                            title={p.player_id ? "Change linked player" : "Link to registered player"}
                            className={`p-1.5 rounded-md transition hover:bg-white dark:hover:bg-slate-700 ${p.player_id ? "text-[var(--info)]" : "text-slate-500 hover:text-[var(--info)]"}`}>
                            <Link className="w-3.5 h-3.5" />
                          </button>
                          {p.player_id && (
                            <button
                              onClick={() => linkParticipantToPlayer(p.id, null, p.display_name?.split(' &')[0] || "")}
                              title="Unlink Player 1"
                              className="p-1.5 text-[var(--warning)] hover:text-[var(--warning)] hover:bg-white dark:hover:bg-slate-700 rounded-md transition">
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {doubles && p.partner_id && (
                            <button
                              onClick={() => linkParticipantToPartner(p.id, null, p.display_name?.split('&')[1]?.trim() || "")}
                              title="Unlink Player 2"
                              className="p-1.5 text-[var(--danger)] hover:text-[var(--danger)] hover:bg-white dark:hover:bg-slate-700 rounded-md transition">
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {editingName?.id === p.id && (
                        <div className="ml-14 mt-1 flex items-center gap-2">
                          <input 
                            value={editingName.name1}
                            onChange={(e) => setEditingName({ ...editingName, name1: e.target.value })}
                            placeholder={doubles ? "Player 1 Name" : "Player Name"}
                            autoFocus
                            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none"
                          />
                          {doubles && (
                            <input 
                              value={editingName.name2}
                              onChange={(e) => setEditingName({ ...editingName, name2: e.target.value })}
                              placeholder="Player 2 Name"
                              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none"
                            />
                          )}
                          <button onClick={saveEditedName} className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90">Save</button>
                          <button onClick={() => setEditingName(null)} className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg hover:opacity-90">Cancel</button>
                        </div>
                      )}

                      {linkingId === p.id && (
                        <div className="ml-14 mt-1 flex flex-col gap-2">
                          <div className="relative">
                            <input
                              autoFocus
                              value={linkSearch}
                              onChange={(e) => setLinkSearch(e.target.value)}
                              placeholder={doubles ? "Search Player 1 to link…" : "Search registered player to link…"}
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--info)] dark:border-[var(--info)] bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-[var(--info)]"
                            />
                            {linkSearch && (
                              <div className="mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm max-h-40 overflow-y-auto">
                                {(allPlayers ?? [])
                                  .filter((pl) => !pl.is_guest && genderFilter(pl) && pl.full_name.toLowerCase().includes(linkSearch.toLowerCase()))
                                  .slice(0, 8)
                                  .map((pl) => (
                                    <button key={pl.id}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-[var(--info)]/30 transition"
                                      onClick={() => linkParticipantToPlayer(p.id, pl.id, pl.full_name)}>
                                      {pl.full_name}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                          
                          {doubles && (
                            <div className="relative mt-2">
                              <input
                                value={linkSearch2}
                                onChange={(e) => setLinkSearch2(e.target.value)}
                                placeholder="Search Player 2 to link…"
                                className="w-full px-3 py-1.5 text-xs rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-purple-500"
                              />
                              {linkSearch2 && (
                                <div className="mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm max-h-40 overflow-y-auto">
                                  {(allPlayers ?? [])
                                    .filter((pl) => !pl.is_guest && genderFilter(pl) && pl.full_name.toLowerCase().includes(linkSearch2.toLowerCase()))
                                    .slice(0, 8)
                                    .map((pl) => (
                                      <button key={pl.id}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-purple-50 dark:hover:bg-purple-950/30 transition"
                                        onClick={() => linkParticipantToPartner(p.id, pl.id, pl.full_name)}>
                                        {pl.full_name}
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add panel */}
                {adding === cat ? (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-2">
                    {(() => {
                      let p1 = null;
                      if (doubles) {
                        try {
                          const p1Data = sessionStorage.getItem(`tp_p1_${cat}`);
                          if (p1Data) p1 = JSON.parse(p1Data);
                        } catch (e) {}
                      }

                      if (p1) {
                        return (
                          <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg mb-2">
                            <span className="text-sm font-bold text-primary">Selected: {p1.name}</span>
                            <button onClick={() => {
                              sessionStorage.removeItem(`tp_p1_${cat}`);
                              setSearch((p) => ({ ...p, [cat]: "" }));
                            }} className="text-primary hover:text-primary/70 transition">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div className="relative mb-2">
                          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                          <input
                            value={catSearch}
                            onChange={(e) => setSearch((p) => ({ ...p, [cat]: e.target.value }))}
                            placeholder={doubles ? "Search player 1…" : "Search registered player…"}
                            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-primary"
                          />
                          {catSearch && (
                            <div className="mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm max-h-40 overflow-y-auto">
                              {filteredPlayers.slice(0, 8).map((pl) => (
                                <button key={pl.id} className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 dark:hover:bg-primary/90/30 transition"
                                  onClick={() => {
                                    if (!doubles) {
                                      addParticipant(cat, pl.id, null, pl.full_name);
                                      setSearch((p) => ({ ...p, [cat]: "" }));
                                    } else {
                                      setSearch((p) => ({ ...p, [cat]: "" }));
                                      sessionStorage.setItem(`tp_p1_${cat}`, JSON.stringify({ id: pl.id, name: pl.full_name }));
                                    }
                                  }}>
                                  {pl.full_name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {doubles && (
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                        <input
                          value={catPartnerSearch}
                          onChange={(e) => setPartnerSearch((p) => ({ ...p, [cat]: e.target.value }))}
                          placeholder="Search partner…"
                          className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-primary"
                        />
                        {catPartnerSearch && (
                          <div className="mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm max-h-40 overflow-y-auto">
                            {filteredPartners.slice(0, 8).map((pl) => (
                              <button key={pl.id} className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 dark:hover:bg-primary/90/30 transition"
                                onClick={() => {
                                  const p1Data = sessionStorage.getItem(`tp_p1_${cat}`);
                                  if (p1Data) {
                                    try {
                                      const p1 = JSON.parse(p1Data);
                                      addParticipant(cat, p1.id, pl.id, `${p1.name} & ${pl.full_name}`);
                                      sessionStorage.removeItem(`tp_p1_${cat}`);
                                      setPartnerSearch((p) => ({ ...p, [cat]: "" }));
                                    } catch (e) {
                                      sessionStorage.removeItem(`tp_p1_${cat}`);
                                    }
                                  } else {
                                    toast.error("Please select Player 1 first");
                                  }
                                }}>
                              {pl.full_name}
                            </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {(catSearch.trim() || catPartnerSearch.trim()) && (
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                        <button
                          onClick={() => {
                            if (!doubles) {
                              addParticipant(cat, null, null, catSearch.trim());
                            } else {
                              const p1Data = sessionStorage.getItem(`tp_p1_${cat}`);
                              if (p1Data) {
                                try {
                                  const p1 = JSON.parse(p1Data);
                                  addParticipant(cat, p1.id, null, `${p1.name} & ${catPartnerSearch.trim() || 'Unknown'}`);
                                  sessionStorage.removeItem(`tp_p1_${cat}`);
                                } catch (e) {
                                  sessionStorage.removeItem(`tp_p1_${cat}`);
                                }
                              } else {
                                addParticipant(cat, null, null, `${catSearch.trim() || 'Unknown'} & ${catPartnerSearch.trim() || 'Unknown'}`);
                              }
                            }
                          }}
                          className="mt-2 w-full py-2 text-xs font-black rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition">
                          {doubles ? (
                            (() => {
                              const p1Data = sessionStorage.getItem(`tp_p1_${cat}`);
                              if (p1Data) {
                                try {
                                  const p1 = JSON.parse(p1Data);
                                  return `Add external partner "${catPartnerSearch.trim()}" for ${p1.name}`;
                                } catch(e) {}
                              }
                              return `Add external team "${catSearch.trim() || '?'} & ${catPartnerSearch.trim() || '?'}"`;
                            })()
                          ) : `Add external player "${catSearch.trim()}"`}
                        </button>
                      </div>
                    )}
                    <button onClick={() => setAdding(null)} className="text-xs text-muted-foreground hover:text-muted-foreground transition">Cancel</button>
                  </div>
                ) : bulkCat === cat ? (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-muted-foreground">
                        Paste names — one per line.
                        {isDoubles(cat) && ' For doubles, use two columns (tab-separated) or "Name1 & Name2".'}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText();
                              if (text) setBulkText(p => p ? p + "\n" + text : text);
                            } catch (e) {
                              toast.error("Clipboard access denied or empty");
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-black text-[var(--info)] hover:text-[var(--info)] hover:border-[var(--info)] transition"
                        >
                          <Clipboard className="w-3 h-3" /> Paste
                        </button>
                        <button
                          onClick={() => downloadParticipantTemplate(cat)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-black text-muted-foreground hover:text-primary hover:border-primary transition"
                        >
                          <Download className="w-3 h-3" /> CSV Template
                        </button>
                      </div>
                    </div>
                    <textarea
                      autoFocus
                      rows={6}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder={isDoubles(cat) ? "Rahul Sharma\tPriya Nair\nArun K\tMeena R" : "Rahul Sharma\nPriya Nair\nArun Kumar"}
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-[var(--info)] transition w-fit">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload CSV instead</span>
                      <input type="file" accept=".csv" className="hidden"
                        onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleParticipantCSV(cat, f); e.target.value = ""; }} />
                    </label>
                    {bulkText.trim() && (() => {
                      const entries = parseBulkLines(bulkText, cat);
                      return (
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {entries.map((e, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${e.match1 ? "bg-primary" : "bg-[var(--warning)]"}`} />
                              <span className="flex-1 text-muted-foreground dark:text-slate-300 truncate">{e.raw}</span>
                              <span className={`text-[10px] font-black uppercase ${e.match1 ? "text-primary" : "text-[var(--warning)]"}`}>
                                {e.match1 ? "Found" : "External"}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <div className="flex gap-2 pt-2">
                      <button
                        disabled={bulkImporting || !bulkText.trim()}
                        onClick={() => runBulkImport(cat)}
                        className="flex-1 bg-primary text-primary-foreground text-xs font-black py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition"
                      >
                        {bulkImporting ? "Importing..." : "Run Import"}
                      </button>
                      <button onClick={() => { setBulkCat(null); setBulkText(""); }} className="px-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black py-2 rounded-lg transition">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setAdding(cat)}
                      className="flex-1 py-2 text-xs font-black rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-muted-foreground hover:border-primary hover:text-primary transition flex items-center justify-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Add Participant
                    </button>
                    <button onClick={() => { setBulkCat(cat); setBulkText(""); setAdding(null); }}
                      className="px-3 py-2 text-xs font-black rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-muted-foreground hover:border-[var(--info)] hover:text-[var(--info)] transition flex items-center justify-center gap-1">
                      <Upload className="w-3.5 h-3.5" /> Bulk / CSV
                    </button>
                  </div>
                )}

                {/* Per-category 3rd place toggle */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-bold">3rd Place Playoff</span>
                  <button
                    onClick={() => setThirdPlacePerCat((p) => ({ ...p, [cat]: !p[cat] }))}
                    className={`relative w-9 h-5 rounded-full transition-colors ${thirdPlacePerCat[cat] ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${thirdPlacePerCat[cat] ? "translate-x-4" : ""}`} />
                  </button>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => saveSeeds(cat)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary text-primary-foreground text-xs font-black shadow transition">
                    Save
                  </button>
                  <button onClick={() => generateBracket(cat)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-on-accent text-xs font-black shadow transition">
                    <Swords className="w-3.5 h-3.5" /> Generate Bracket
                  </button>
                </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
