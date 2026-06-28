import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/hooks/usePlayers";
import { generateSingleElimBracket } from "@/lib/bracketGenerator";
import { MatchScoreDisplay } from "@/components/tournament/MatchScoreDisplay";
import { BracketVisual } from "@/components/tournament/BracketVisual";
import {
  Loader2, Save, Trophy, Users, Swords, Archive, Plus, X, Search,
  ChevronDown, ChevronUp, Lock, Unlock, Play, SkipForward, Settings2,
  CalendarDays, MapPin, Link, Download, Upload
} from "lucide-react";
import { InfoModal } from "@/components/InfoModal";

// ── CSV helpers ────────────────────────────────────────────────────────────────

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
        // Simple RFC 4180 CSV parse
        const fields: string[] = [];
        let cur = "", inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
          else if (ch === "," && !inQ) { fields.push(cur); cur = ""; }
          else cur += ch;
        }
        fields.push(cur);
        return fields.map((f) => f.trim());
      }).filter((r) => r.some((c) => c));
      resolve(rows);
    };
    reader.readAsText(file);
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tournament {
  id: string;
  name: string;
  tournament_type: string;
  bracket_format: string;
  categories: string[];
  status: string;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
  description: string | null;
  eligibility: string | null;
  form_url: string | null;
  form_status: string;
  form_close_date: string | null;
  archived_at: string | null;
  created_at: string;
}

interface Participant {
  id: string;
  category: string;
  player_id: string | null;
  partner_id: string | null;
  display_name: string | null;
  seed: number | null;
}

interface TournamentMatch {
  id: string;
  category: string;
  match_code: string;
  round: number;
  round_name: string;
  match_number: number;
  player1_id: string | null;
  player3_id: string | null;
  team1_label: string | null;
  player2_id: string | null;
  player4_id: string | null;
  team2_label: string | null;
  court_number: string | null;
  scheduled_at: string | null;
  points_to_win: number | null;
  best_of_sets: number | null;
  golden_point: number | null;
  winner_side: 1 | 2 | null;
  winner_id: string | null;
  score: string | null;
  sets_history: string[] | null;
  status: string;
  locked: boolean;
  advances_to_match: string | null;
  advances_to_position: 1 | 2 | null;
  advances_to_match_loser: string | null;
  advances_to_position_loser: 1 | 2 | null;
}

interface RoundRule {
  id?: string;
  category: string;
  round: number;
  round_name: string | null;
  points_to_win: number;
  best_of_sets: number;
  golden_point: number;
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";
const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition";
const labelCls = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5";
const CATEGORIES = ["MS", "WS", "MD", "WD", "XD"];
const STATUS_FLOW = ["draft", "active", "completed"] as const;

// ── Status chip ────────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-slate-100 dark:bg-slate-800 text-slate-500",
    active: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
    completed: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
    archived: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  };
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${map[status] ?? map.draft}`}>
      {status}
    </span>
  );
}

function MatchStatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-slate-100 dark:bg-slate-800 text-slate-500",
    in_progress: "bg-amber-100 dark:bg-amber-950/40 text-amber-600",
    completed: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600",
    walkover: "bg-blue-100 dark:bg-blue-950/40 text-blue-600",
  };
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${map[status] ?? map.scheduled}`}>
      {status.replace("_", " ")}
    </span>
  );
}

// ── TournamentManager ──────────────────────────────────────────────────────────

export function TournamentManager() {
  const { session, isMainAdmin } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const SUB_TABS = ["setup", "participants", "bracket", "archive"] as const;
  type SubTab = typeof SUB_TABS[number];

  const getHashSubTab = (): SubTab => {
    const hash = window.location.hash.replace("#", "");
    const parts = hash.split("/");
    const sub = parts[1] as SubTab;
    return SUB_TABS.includes(sub) ? sub : "setup";
  };

  const [activeTab, setActiveTab] = useState<SubTab>(getHashSubTab);

  const setTab = (tab: SubTab) => {
    setActiveTab(tab);
    const hash = window.location.hash.replace("#", "").split("/")[0];
    window.location.hash = `${hash}/${tab}`;
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadTournaments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false });
    setTournaments((data as Tournament[]) ?? []);
    if (data?.length && !selected) setSelected(data[0] as Tournament);
    setLoading(false);
  }, []);

  useEffect(() => { loadTournaments(); }, [loadTournaments]);

  useEffect(() => {
    const onHashChange = () => setActiveTab(getHashSubTab());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const createTournament = async () => {
    setCreating(true);
    const { data, error } = await supabase
      .from("tournaments")
      .insert({ name: "New Tournament", created_by: session?.user?.id })
      .select()
      .single();
    if (error) { toast.error(error.message); setCreating(false); return; }
    toast.success("Tournament created");
    await loadTournaments();
    setSelected(data as Tournament);
    setTab("setup");
    setCreating(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

  return (
    <div className="space-y-5">
      {/* Tournament selector */}
      <div className={cardCls}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
            <InfoModal
              title="TOURNAMENT MANAGER"
              items={[
                { badge: "FORMATS", title: "Bracket Formats", desc: "Supports Single Elimination, Double Elimination, and Round Robin formats." },
                { badge: "SEEDING", title: "Automatic Seeding", desc: "Players are automatically seeded based on their current ELO rating at the time of bracket generation." }
              ]}
            />
            <select
              value={selected?.id ?? ""}
              onChange={(e) => {
                const t = tournaments.find((t) => t.id === e.target.value);
                if (t) { setSelected(t); setTab("setup"); }
              }}
              className="text-sm font-black text-slate-800 dark:text-white bg-transparent border-none outline-none cursor-pointer"
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.name} [{t.status}]</option>
              ))}
            </select>
            {selected && <StatusChip status={selected.status} />}
          </div>
          <button
            onClick={createTournament}
            disabled={creating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            New Tournament
          </button>
        </div>
      </div>

      {selected && (
        <>
          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {(["setup", "participants", "bracket", "archive"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTab(tab)}
                className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${
                  activeTab === tab
                    ? "bg-emerald-600 text-white shadow"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-400"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === "setup" && (
            <SetupTab
              tournament={selected}
              onSaved={(t) => { setSelected(t); loadTournaments(); }}
              isMasterAdmin={isMainAdmin}
            />
          )}
          {activeTab === "participants" && (
            <ParticipantsTab tournament={selected} />
          )}
          {activeTab === "bracket" && (
            <BracketTab tournament={selected} isMasterAdmin={isMainAdmin} />
          )}
          {activeTab === "archive" && (
            <ArchiveTab tournament={selected} isMasterAdmin={isMainAdmin} onArchived={() => loadTournaments()} />
          )}
        </>
      )}

      {!selected && !loading && (
        <div className={`${cardCls} text-center py-10`}>
          <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 font-bold">No tournaments yet. Create one above.</p>
        </div>
      )}
    </div>
  );
}

// ── Setup Tab ──────────────────────────────────────────────────────────────────

function SetupTab({ tournament, onSaved, isMasterAdmin }: {
  tournament: Tournament;
  onSaved: (t: Tournament) => void;
  isMasterAdmin: boolean;
}) {
  const [form, setForm] = useState<Tournament>({ ...tournament });
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const { session } = useAuth();

  useEffect(() => { setForm({ ...tournament }); }, [tournament.id]);

  const upd = <K extends keyof Tournament>(k: K, v: Tournament[K]) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { id, created_at, archived_at, ...rest } = form;
    const { data, error } = await supabase.from("tournaments").update(rest).eq("id", id).select().single();
    if (error) { toast.error(error.message); setSaving(false); return; }
    await supabase.from("admin_logs").insert({
      admin_email: session?.user?.email ?? "admin",
      action: `Updated tournament "${form.name}" (${form.status})`,
    });
    toast.success("Saved");
    onSaved(data as Tournament);
    setSaving(false);
  };

  const transition = async (newStatus: string) => {
    if (!confirm(`Move tournament to "${newStatus}" status?`)) return;
    setTransitioning(true);
    const { data, error } = await supabase.from("tournaments").update({ status: newStatus }).eq("id", tournament.id).select().single();
    if (error) { toast.error(error.message); setTransitioning(false); return; }
    toast.success(`Status → ${newStatus}`);
    onSaved(data as Tournament);
    setTransitioning(false);
  };

  return (
    <div className="space-y-5">
      {/* Status transitions */}
      <div className={cardCls}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Status:</span>
          <StatusChip status={form.status} />
          {form.status === "draft" && (
            <button onClick={() => transition("active")} disabled={transitioning}
              className="px-3 py-1 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition">
              {transitioning ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "→ Activate"}
            </button>
          )}
          {form.status === "active" && (
            <button onClick={() => transition("completed")} disabled={transitioning}
              className="px-3 py-1 text-xs font-black rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition">
              {transitioning ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "→ Mark Completed"}
            </button>
          )}
          {form.status === "draft" && (
            <span className="text-[10px] text-slate-400">Drafts are only visible to admins</span>
          )}
        </div>
      </div>

      {/* Details */}
      <div className={cardCls}>
        <h3 className="font-black text-slate-800 dark:text-white mb-4">Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Tournament Name</label>
            <input value={form.name} onChange={(e) => upd("name", e.target.value)} className={inputCls} placeholder="e.g. INVICTA 2026" />
          </div>
          <div>
            <label className={labelCls}>Tournament Type</label>
            <select value={form.tournament_type} onChange={(e) => upd("tournament_type", e.target.value)} className={inputCls}>
              <option value="open">Open Tournament</option>
              <option value="invitational">Invitational</option>
              <option value="internal">Internal</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Venue</label>
            <input value={form.venue ?? ""} onChange={(e) => upd("venue", e.target.value)} className={inputCls} placeholder="Gymkhana Courts" />
          </div>
          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" value={form.start_date ?? ""} onChange={(e) => upd("start_date", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>End / Finals Date</label>
            <input type="date" value={form.end_date ?? ""} onChange={(e) => upd("end_date", e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Categories</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const active = form.categories.includes(cat);
                return (
                  <button key={cat} type="button"
                    onClick={() => upd("categories", active ? form.categories.filter((c) => c !== cat) : [...form.categories, cat])}
                    className={`px-4 py-1.5 rounded-xl text-sm font-black border transition-all ${active ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-emerald-400"}`}>
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className={labelCls}>Eligibility</label>
            <input value={form.eligibility ?? ""} onChange={(e) => upd("eligibility", e.target.value)} className={inputCls} placeholder="All IISc Members" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Description</label>
            <textarea value={form.description ?? ""} onChange={(e) => upd("description", e.target.value)} className={inputCls} rows={2} placeholder="Short blurb…" />
          </div>
        </div>
      </div>

      {/* Registration */}
      <div className={cardCls}>
        <h3 className="font-black text-slate-800 dark:text-white mb-4">Registration Form</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Form URL</label>
            <input type="url" value={form.form_url ?? ""} onChange={(e) => upd("form_url", e.target.value)} className={inputCls} placeholder="https://forms.office.com/…" />
          </div>
          <div>
            <label className={labelCls}>Form Status</label>
            <select value={form.form_status} onChange={(e) => upd("form_status", e.target.value)} className={inputCls}>
              <option value="open">Open</option>
              <option value="closing_soon">Closing Soon</option>
              <option value="closed">Closed</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Form Closes On</label>
            <input type="date" value={form.form_close_date ?? ""} onChange={(e) => upd("form_close_date", e.target.value)} className={inputCls} />
          </div>
        </div>

      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black transition shadow-lg">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Details
        </button>
      </div>
    </div>
  );
}

// ── Participants Tab ───────────────────────────────────────────────────────────

function ParticipantsTab({ tournament }: { tournament: Tournament }) {
  const { data: allPlayers } = usePlayers();
  const [participants, setParticipants] = useState<Record<string, Participant[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState<Record<string, string>>({});
  const [partnerSearch, setPartnerSearch] = useState<Record<string, string>>({});
  const [openCat, setOpenCat] = useState<string>(tournament.categories[0] ?? "");
  const [adding, setAdding] = useState<string | null>(null);
  const [externalName, setExternalName] = useState("");
  const [thirdPlacePerCat, setThirdPlacePerCat] = useState<Record<string, boolean>>({});
  const [bulkCat, setBulkCat] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const isDoubles = (cat: string) => ["MD", "WD", "XD"].includes(cat);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tournament_participants")
      .select("*")
      .eq("tournament_id", tournament.id)
      .order("seed", { ascending: true });
    const grouped: Record<string, Participant[]> = {};
    for (const cat of tournament.categories) grouped[cat] = [];
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

  const linkParticipantToPlayer = async (participantId: string, playerId: string, playerName: string) => {
    const { error } = await supabase.from("tournament_participants")
      .update({ player_id: playerId, display_name: playerName })
      .eq("id", participantId);
    if (error) { toast.error(error.message); return; }
    setParticipants((prev) => {
      const updated = { ...prev };
      for (const cat of Object.keys(updated)) {
        updated[cat] = updated[cat].map((p) =>
          p.id === participantId ? { ...p, player_id: playerId, display_name: playerName } : p
        );
      }
      return updated;
    });
    setLinkingId(null);
    setLinkSearch("");
    toast.success(`Linked to ${playerName}`);
  };

  const saveSeeds = async (cat: string) => {
    const parts = participants[cat] ?? [];
    await Promise.all(parts.map((p, i) =>
      supabase.from("tournament_participants").update({ seed: p.seed ?? i + 1 }).eq("id", p.id)
    ));
    toast.success(`Seeds saved for ${cat}`);
  };

  // Parse bulk pasted text — each non-empty line is one entry.
  // Singles: "Name"  |  Doubles: "Name1\tName2" or "Name1 & Name2"
  const parseBulkLines = (text: string, cat: string) => {
    const doubles = isDoubles(cat);
    return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      if (doubles) {
        // tab-separated (Excel copy) or " & " separated
        const parts = line.includes("\t") ? line.split("\t") : line.split(/\s*&\s*/);
        const name1 = parts[0]?.trim() ?? "";
        const name2 = parts[1]?.trim() ?? "";
        const match1 = (allPlayers ?? []).find((p) => p.full_name.toLowerCase() === name1.toLowerCase()) ?? null;
        const match2 = name2 ? ((allPlayers ?? []).find((p) => p.full_name.toLowerCase() === name2.toLowerCase()) ?? null) : null;
        return { raw: line, name1, name2, match1, match2 };
      } else {
        const match = (allPlayers ?? []).find((p) => p.full_name.toLowerCase() === line.toLowerCase()) ?? null;
        return { raw: line, name1: line, name2: "", match1: match, match2: null };
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
    const header = doubles ? ["Player1", "Player2"] : ["PlayerName"];
    const examples = doubles
      ? [["Rahul Sharma", "Priya Nair"], ["Arun Kumar", "Meena R"]]
      : [["Rahul Sharma"], ["Priya Nair"], ["Arun Kumar"]];
    downloadCSV(`${cat}_participants_template.csv`, [header, ...examples]);
  };

  const handleParticipantCSV = async (cat: string, file: File) => {
    const rows = await readCSVFile(file);
    const doubles = isDoubles(cat);
    // Skip header row if first cell looks like a header label
    const dataRows = rows[0]?.[0]?.toLowerCase().match(/^(player|name)/) ? rows.slice(1) : rows;
    const lines = dataRows.map((r) => doubles ? `${r[0] ?? ""}\t${r[1] ?? ""}` : (r[0] ?? "")).filter(Boolean);
    setBulkText(lines.join("\n"));
    setBulkCat(cat);
  };

  const hasMatches = async () => {
    const { count } = await supabase.from("tournament_matches").select("id", { count: "exact", head: true }).eq("tournament_id", tournament.id);
    return (count ?? 0) > 0;
  };

  const generateBracket = async (onlyCat?: string) => {
    const catsToGenerate = onlyCat ? [onlyCat] : Object.keys(participants);
    if (await hasMatches()) {
      const msg = onlyCat
        ? `This will delete existing bracket matches for ${onlyCat} and regenerate. Continue?`
        : "This will delete existing bracket matches and regenerate. Continue?";
      if (!confirm(msg)) return;
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
      const mapped = parts.map((p) => ({
        playerId: p.player_id,
        partnerId: p.partner_id,
        displayName: p.display_name ?? (allPlayers?.find((pl) => pl.id === p.player_id)?.full_name ?? "Unknown"),
        seed: p.seed ?? 99,
      }));
      allRows.push(...generateSingleElimBracket(mapped, cat, tournament.id, thirdPlacePerCat[cat] ?? false));
    }
    if (!allRows.length) { toast.error("Need at least 2 participants in a category to generate bracket"); return; }
    const { error } = await supabase.from("tournament_matches").insert(allRows);
    if (error) { toast.error(error.message); return; }

    // Auto-advance byes: find R1 matches where one side is "BYE" and submit walkover
    const byeMatches = allRows.filter(
      (r) => r.round === 1 && (r.team1_label === "BYE" || r.team2_label === "BYE")
    );
    if (byeMatches.length) {
      const { data: insertedRows } = await supabase
        .from("tournament_matches")
        .select("id, match_code, team1_label, team2_label")
        .eq("tournament_id", tournament.id)
        .eq("round", 1)
        .in("match_code", byeMatches.map((r) => r.match_code));
      for (const row of (insertedRows ?? [])) {
        const winningSide: 1 | 2 = row.team2_label === "BYE" ? 1 : 2;
        await supabase.rpc("submit_tournament_match", {
          p_match_id: row.id,
          p_winner_side: winningSide,
          p_score: "W/O",
          p_sets: [],
          p_umpire_id: null,
        });
      }
    }

    toast.success(`Bracket generated — ${allRows.length} matches created${byeMatches.length ? `, ${byeMatches.length} bye(s) advanced` : ""}`);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>;

  return (
    <div className="space-y-4">
      {tournament.categories.map((cat) => {
        const parts = participants[cat] ?? [];
        const doubles = isDoubles(cat);
        const catSearch = search[cat] ?? "";
        const catPartnerSearch = partnerSearch[cat] ?? "";

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
            <button onClick={() => setOpenCat(openCat === cat ? "" : cat)}
              className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-black px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{cat}</span>
                <span className="text-sm text-slate-500">{parts.length} participants</span>
              </div>
              {openCat === cat ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {openCat === cat && (
              <div className="mt-4 space-y-3">
                {parts.map((p, i) => {
                  const player = allPlayers?.find((pl) => pl.id === p.player_id);
                  const partner = allPlayers?.find((pl) => pl.id === p.partner_id);
                  return (
                    <div key={p.id} className="flex flex-col gap-1 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <div className="flex items-center gap-3">
                        <input type="number" min={1}
                          value={p.seed ?? i + 1}
                          onChange={(e) => updateSeed(p.id, parseInt(e.target.value))}
                          className="w-12 text-center text-sm font-black rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 outline-none" />
                        <div className="flex-1 text-sm font-bold text-slate-800 dark:text-white">
                          {p.display_name ?? player?.full_name ?? "Unknown"}
                          {doubles && (partner || p.display_name) && (
                            <span className="text-slate-400 font-medium"> & {partner?.full_name ?? "partner"}</span>
                          )}
                          {!p.player_id && (
                            <span className="ml-2 text-[10px] font-black text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded">external</span>
                          )}
                        </div>
                        {!p.player_id && (
                          <button
                            onClick={() => { setLinkingId(linkingId === p.id ? null : p.id); setLinkSearch(""); }}
                            title="Link to registered player"
                            className="p-1 text-slate-400 hover:text-blue-500 transition">
                            <Link className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => removeParticipant(p.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 transition"><X className="w-4 h-4" /></button>
                      </div>
                      {linkingId === p.id && (
                        <div className="ml-14 relative">
                          <input
                            autoFocus
                            value={linkSearch}
                            onChange={(e) => setLinkSearch(e.target.value)}
                            placeholder="Search registered player to link…"
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {linkSearch && (
                            <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                              {(allPlayers ?? [])
                                .filter((pl) => !pl.is_guest && genderFilter(pl) && pl.full_name.toLowerCase().includes(linkSearch.toLowerCase()))
                                .slice(0, 8)
                                .map((pl) => (
                                  <button key={pl.id}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-950/30 transition"
                                    onClick={() => linkParticipantToPlayer(p.id, pl.id, pl.full_name)}>
                                    {pl.full_name}
                                  </button>
                                ))}
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
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        value={catSearch}
                        onChange={(e) => setSearch((p) => ({ ...p, [cat]: e.target.value }))}
                        placeholder="Search registered player…"
                        className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      {catSearch && (
                        <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                          {filteredPlayers.slice(0, 8).map((pl) => (
                            <button key={pl.id} className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition"
                              onClick={() => {
                                if (!doubles) {
                                  addParticipant(cat, pl.id, null, pl.full_name);
                                } else {
                                  setSearch((p) => ({ ...p, [cat]: pl.full_name }));
                                  // store pending player1
                                  sessionStorage.setItem(`tp_p1_${cat}`, JSON.stringify({ id: pl.id, name: pl.full_name }));
                                }
                              }}>
                              {pl.full_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {doubles && (
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          value={catPartnerSearch}
                          onChange={(e) => setPartnerSearch((p) => ({ ...p, [cat]: e.target.value }))}
                          placeholder="Search partner…"
                          className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        {catPartnerSearch && (
                          <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                            {filteredPartners.slice(0, 8).map((pl) => (
                              <button key={pl.id} className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition"
                                onClick={() => {
                                  const p1Data = sessionStorage.getItem(`tp_p1_${cat}`);
                                  if (p1Data) {
                                    const p1 = JSON.parse(p1Data);
                                    addParticipant(cat, p1.id, pl.id, `${p1.name} & ${pl.full_name}`);
                                    sessionStorage.removeItem(`tp_p1_${cat}`);
                                  }
                                }}>
                              {pl.full_name}
                            </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                      <input
                        value={externalName}
                        onChange={(e) => setExternalName(e.target.value)}
                        placeholder="Or type external player name…"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      {externalName && (
                        <button
                          onClick={() => addParticipant(cat, null, null, externalName)}
                          className="mt-2 w-full py-1.5 text-xs font-black rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition">
                          Add "{externalName}" as external player
                        </button>
                      )}
                    </div>
                    <button onClick={() => setAdding(null)} className="text-xs text-slate-400 hover:text-slate-600 transition">Cancel</button>
                  </div>
                ) : bulkCat === cat ? (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-slate-500">
                        Paste names — one per line.
                        {isDoubles(cat) && ' For doubles, use two columns (tab-separated) or "Name1 & Name2".'}
                      </p>
                      <button
                        onClick={() => downloadParticipantTemplate(cat)}
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-500 hover:text-emerald-600 hover:border-emerald-400 transition">
                        <Download className="w-3 h-3" /> CSV Template
                      </button>
                    </div>
                    <textarea
                      autoFocus
                      rows={6}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder={isDoubles(cat) ? "Rahul Sharma\tPriya Nair\nArun K\tMeena R" : "Rahul Sharma\nPriya Nair\nArun Kumar"}
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                    />
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-blue-500 transition w-fit">
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
                              <span className={`w-2 h-2 rounded-full shrink-0 ${e.match1 ? "bg-emerald-500" : "bg-amber-400"}`} />
                              <span className="flex-1 text-slate-700 dark:text-slate-300 truncate">{e.raw}</span>
                              <span className={`text-[10px] font-black uppercase ${e.match1 ? "text-emerald-600" : "text-amber-500"}`}>
                                {e.match1 ? "matched" : "external"}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => runBulkImport(cat)}
                        disabled={bulkImporting || !bulkText.trim()}
                        className="flex-1 py-2 text-xs font-black rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50 flex items-center justify-center gap-1">
                        {bulkImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Import {bulkText.trim() ? parseBulkLines(bulkText, cat).length : 0} Participants
                      </button>
                      <button onClick={() => { setBulkCat(null); setBulkText(""); }} className="text-xs text-slate-400 hover:text-slate-600 transition px-2">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setAdding(cat)}
                      className="flex-1 py-2 text-xs font-black rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:border-emerald-400 hover:text-emerald-600 transition flex items-center justify-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Add Participant
                    </button>
                    <button onClick={() => { setBulkCat(cat); setBulkText(""); setAdding(null); }}
                      className="px-3 py-2 text-xs font-black rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-1">
                      <Upload className="w-3.5 h-3.5" /> Bulk / CSV
                    </button>
                  </div>
                )}

                {/* Per-category 3rd place toggle */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold">3rd Place Playoff</span>
                  <button
                    onClick={() => setThirdPlacePerCat((p) => ({ ...p, [cat]: !p[cat] }))}
                    className={`relative w-9 h-5 rounded-full transition-colors ${thirdPlacePerCat[cat] ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${thirdPlacePerCat[cat] ? "translate-x-4" : ""}`} />
                  </button>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => saveSeeds(cat)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow transition">
                    Save
                  </button>
                  <button onClick={() => generateBracket(cat)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black shadow transition">
                    <Swords className="w-3.5 h-3.5" /> Generate Bracket
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
}

// ── Bracket Tab ────────────────────────────────────────────────────────────────

function BracketTab({ tournament, isMasterAdmin }: { tournament: Tournament; isMasterAdmin: boolean }) {
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [roundRules, setRoundRules] = useState<RoundRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(tournament.categories[0] ?? "");
  const [showRules, setShowRules] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "visual">("visual");
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<{
    matchId: string; side: 1 | 2; sets: string; bestOfSets: number;
    setsData: { t1: string; t2: string }[];
  } | null>(null);
  const [editSchedule, setEditSchedule] = useState<{ matchId: string; court: string; at: string } | null>(null);
  const [showBulkSchedule, setShowBulkSchedule] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkPreview, setBulkPreview] = useState<{ matchCode: string; court: string; at: string; found: boolean }[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: mData }, { data: rData }] = await Promise.all([
      supabase.from("tournament_matches").select("*").eq("tournament_id", tournament.id).order("round").order("match_number"),
      supabase.from("tournament_round_rules").select("*").eq("tournament_id", tournament.id),
    ]);
    setMatches((mData as TournamentMatch[]) ?? []);
    setRoundRules((rData as RoundRule[]) ?? []);
    setLoading(false);
  }, [tournament.id]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (matchId: string, status: string) => {
    setActingOn(matchId);
    await supabase.from("tournament_matches").update({ status }).eq("id", matchId);
    setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, status } : m));
    setActingOn(null);
  };

  const submitWalkover = async (matchId: string, winningSide: 1 | 2) => {
    setActingOn(matchId);
    const { error } = await supabase.rpc("submit_tournament_match", {
      p_match_id: matchId,
      p_winner_side: winningSide,
      p_score: "W/O",
      p_sets: [],
      p_umpire_id: null,
    });
    if (error) { toast.error(error.message); } else { toast.success("Walkover recorded"); await load(); }
    setActingOn(null);
  };

  const autoWinnerFromSets = (setsStr: string, bestOfSets: number): 1 | 2 | null => {
    const sets = setsStr.split(",").map((s) => s.trim()).filter(Boolean);
    let t1 = 0, t2 = 0;
    for (const s of sets) {
      const [a, b] = s.split("-").map(Number);
      if (!isNaN(a) && !isNaN(b)) { if (a > b) t1++; else if (b > a) t2++; }
    }
    const needed = Math.ceil(bestOfSets / 2);
    if (t1 >= needed) return 1;
    if (t2 >= needed) return 2;
    return null;
  };

  const submitEditScore = async () => {
    if (!editScore) return;
    const setsArr = editScore.setsData
      .filter((s) => s.t1 !== "" && s.t2 !== "")
      .map((s) => `${s.t1}-${s.t2}`);
    if (!setsArr.length) { toast.error("Enter at least one set score"); return; }
    const scoreStr = setsArr.join(", ");
    const fn = isMasterAdmin ? "admin_edit_tournament_match" : "submit_tournament_match";
    const params = isMasterAdmin
      ? { p_match_id: editScore.matchId, p_winner_side: editScore.side, p_score: scoreStr, p_sets: setsArr }
      : { p_match_id: editScore.matchId, p_winner_side: editScore.side, p_score: scoreStr, p_sets: setsArr, p_umpire_id: null };
    const { error } = await supabase.rpc(fn, params);
    if (error) { toast.error(error.message); } else { toast.success("Score saved"); await load(); }
    setEditScore(null);
  };

  const saveSchedule = async () => {
    if (!editSchedule) return;
    await supabase.from("tournament_matches").update({
      court_number: editSchedule.court || null,
      scheduled_at: editSchedule.at || null,
    }).eq("id", editSchedule.matchId);
    await load();
    setEditSchedule(null);
    toast.success("Schedule saved");
  };

  const downloadScheduleTemplate = () => {
    const header = ["MatchCode", "Court", "Date (YYYY-MM-DD)", "Time (HH:MM)"];
    const rows = matches
      .filter((m) => m.category === activeCategory)
      .sort((a, b) => a.round - b.round || a.match_number - b.match_number)
      .map((m) => [
        m.match_code,
        m.court_number ?? "",
        m.scheduled_at ? m.scheduled_at.slice(0, 10) : "",
        m.scheduled_at ? m.scheduled_at.slice(11, 16) : "",
      ]);
    downloadCSV(`${activeCategory}_schedule_template.csv`, [header, ...rows]);
  };

  const handleScheduleCSV = async (file: File) => {
    const rows = await readCSVFile(file);
    // Skip header if first cell is not a match code pattern
    const dataRows = rows[0]?.[0]?.match(/^[A-Z]+_/) ? rows : rows.slice(1);
    const lines = dataRows
      .filter((r) => r[0])
      .map((r) => {
        const code = r[0].toUpperCase();
        const court = r[1] ?? "";
        const date = r[2] ?? "";
        const time = r[3] ?? "";
        const parts = [code];
        if (court) parts.push(`court=${court}`);
        if (date && time) parts.push(`date=${date} time=${time}`);
        else if (date) parts.push(`date=${date}`);
        return parts.join(" ");
      });
    setBulkText(lines.join("\n"));
    parseBulkSchedule(lines.join("\n"));
  };

  const parseBulkSchedule = (text: string) => {
    // Each line: MATCH_CODE: Court X, YYYY-MM-DD HH:MM
    // or:        MATCH_CODE court=X date=YYYY-MM-DD time=HH:MM
    // or:        MATCH_CODE, Court X, DD/MM/YYYY HH:MM
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const results: { matchCode: string; court: string; at: string; found: boolean }[] = [];
    for (const line of lines) {
      if (line.startsWith("#") || line.startsWith("//")) continue;
      // Normalise separators
      const parts = line.split(/[:,\t]+/).map((p) => p.trim()).filter(Boolean);
      if (parts.length < 1) continue;
      const matchCode = parts[0].toUpperCase();

      let court = "";
      let at = "";

      // key=value style
      const kvCourt = line.match(/court\s*=\s*([^\s,]+)/i);
      const kvDate = line.match(/date\s*=\s*(\d{4}-\d{2}-\d{2})/i);
      const kvTime = line.match(/time\s*=\s*(\d{2}:\d{2})/i);
      if (kvCourt) court = kvCourt[1];
      if (kvDate && kvTime) at = `${kvDate[1]}T${kvTime[1]}`;

      if (!court || !at) {
        // Free-form: find "court N" token
        const courtMatch = line.match(/court\s*(\w+)/i);
        if (courtMatch) court = courtMatch[1];

        // Find datetime: YYYY-MM-DD HH:MM or DD/MM/YYYY HH:MM or DD-MM-YYYY HH:MM
        const isoDate = line.match(/(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/i);
        const dmy = line.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})\s+(\d{2}:\d{2})/i);
        if (isoDate) at = `${isoDate[1]}T${isoDate[2]}`;
        else if (dmy) at = `${dmy[3]}-${dmy[2]}-${dmy[1]}T${dmy[4]}`;
      }

      const found = matches.some((m) => m.match_code === matchCode);
      results.push({ matchCode, court, at, found });
    }
    setBulkPreview(results);
  };

  const saveBulkSchedule = async () => {
    setBulkSaving(true);
    let saved = 0;
    for (const row of bulkPreview) {
      if (!row.found) continue;
      const match = matches.find((m) => m.match_code === row.matchCode);
      if (!match) continue;
      await supabase.from("tournament_matches").update({
        court_number: row.court || null,
        scheduled_at: row.at || null,
      }).eq("id", match.id);
      saved++;
    }
    await load();
    setBulkSaving(false);
    setShowBulkSchedule(false);
    setBulkText("");
    setBulkPreview([]);
    toast.success(`Bulk schedule saved for ${saved} match${saved !== 1 ? "es" : ""}`);
  };

  const saveRoundRule = async (rule: RoundRule) => {
    await supabase.from("tournament_round_rules").upsert({
      tournament_id: tournament.id,
      category: rule.category,
      round: rule.round,
      round_name: rule.round_name,
      points_to_win: rule.points_to_win,
      best_of_sets: rule.best_of_sets,
      golden_point: rule.golden_point,
    }, { onConflict: "tournament_id,category,round" });
    await load();
    toast.success("Round rules saved");
  };

  const batchAdvance = async () => {
    const completed = matches.filter((m) => m.status === "completed" && m.advances_to_match);
    for (const m of completed) {
      await supabase.rpc("admin_edit_tournament_match", {
        p_match_id: m.id, p_winner_side: m.winner_side, p_score: m.score, p_sets: m.sets_history,
      });
    }
    await load();
    toast.success("All winners advanced");
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>;
  if (!matches.length) return (
    <div className={`${cardCls} text-center py-10`}>
      <Swords className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p className="text-slate-500 font-bold">No bracket yet. Go to Participants tab and click Generate Bracket.</p>
    </div>
  );

  const categoryMatches = matches.filter((m) => m.category === activeCategory);
  const rounds = [...new Set(categoryMatches.map((m) => m.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {/* Category tabs + batch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tournament.categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-xl text-sm font-black transition-all ${activeCategory === cat ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-400"}`}>
              {cat}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-black">
            <button onClick={() => setViewMode("visual")}
              className={`px-3 py-1.5 transition ${viewMode === "visual" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
              Visual
            </button>
            <button onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 transition ${viewMode === "list" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
              List
            </button>
          </div>
          <button onClick={() => setShowRules((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-600 dark:text-slate-300 hover:border-emerald-400 transition">
            <Settings2 className="w-3.5 h-3.5" /> Round Rules
          </button>
          <button onClick={() => { setShowBulkSchedule(true); setBulkPreview([]); setBulkText(""); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-300 dark:border-blue-700 text-xs font-black text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition">
            <CalendarDays className="w-3.5 h-3.5" /> Bulk Schedule
          </button>
          {isMasterAdmin && (
            <button onClick={batchAdvance}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black transition">
              <SkipForward className="w-3.5 h-3.5" /> Batch Advance
            </button>
          )}
        </div>
      </div>

      {/* Round rules panel */}
      {showRules && (
        <div className={cardCls}>
          <h3 className="font-black text-slate-800 dark:text-white mb-3 text-sm">Round Scoring Rules — {activeCategory}</h3>
          <div className="space-y-2">
            {rounds.map((round) => {
              const rule = roundRules.find((r) => r.category === activeCategory && r.round === round) ?? {
                category: activeCategory, round,
                round_name: categoryMatches.find((m) => m.round === round)?.round_name ?? null,
                points_to_win: 21, best_of_sets: 3, golden_point: 30,
              };
              return (
                <div key={round} className="grid grid-cols-4 gap-2 items-end">
                  <div>
                    <label className={labelCls}>Round</label>
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-300 py-2">{rule.round_name ?? `R${round}`}</div>
                  </div>
                  {(["points_to_win", "best_of_sets", "golden_point"] as const).map((field) => (
                    <div key={field}>
                      <label className={labelCls}>{field.replace(/_/g, " ")}</label>
                      <input type="number" min={1}
                        defaultValue={rule[field]}
                        onBlur={(e) => saveRoundRule({ ...rule, [field]: parseInt(e.target.value) })}
                        className={inputCls} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual bracket */}
      {viewMode === "visual" && (
        <BracketVisual matches={categoryMatches} rounds={rounds} enablePathHighlight />
      )}

      {/* Match cards by round */}
      {viewMode === "list" && rounds.map((round) => {
        const roundMatches = categoryMatches.filter((m) => m.round === round);
        const roundName = roundMatches[0]?.round_name ?? `Round ${round}`;
        return (
          <div key={round}>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">{roundName}</h3>
            <div className="space-y-2">
              {roundMatches.map((m) => {
                const busy = actingOn === m.id;
                const isEditing = editScore?.matchId === m.id;
                const isScheduling = editSchedule?.matchId === m.id;
                const canEdit = !m.locked || isMasterAdmin;

                return (
                  <div key={m.id} className={`${cardCls} !p-4`}>
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        {/* Match header */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase">{m.match_code}</span>
                          <MatchStatusChip status={m.status} />
                          {m.locked && <Lock className="w-3 h-3 text-amber-500" aria-label="Locked — master_admin only" />}
                          {m.court_number && (
                            <span className="text-[10px] text-blue-500 font-bold">Court {m.court_number}</span>
                          )}
                          {m.scheduled_at && (
                            <span className="text-[10px] text-slate-400">{new Date(m.scheduled_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>
                          )}
                        </div>

                        {/* Teams */}
                        <div className={`text-sm font-bold ${m.winner_side === 1 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200"}`}>
                          {m.team1_label ?? "TBD"}
                        </div>
                        <div className="text-[10px] text-slate-400 my-0.5">vs</div>
                        <div className={`text-sm font-bold ${m.winner_side === 2 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200"}`}>
                          {m.team2_label ?? "TBD"}
                        </div>

                        {/* Score */}
                        {m.status === "completed" && (
                          <div className="mt-2">
                            <MatchScoreDisplay
                              sets_history={m.sets_history}
                              team1_label={m.team1_label ?? "Team 1"}
                              team2_label={m.team2_label ?? "Team 2"}
                              winner_side={m.winner_side}
                              status={m.status}
                            />
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {m.status === "scheduled" && canEdit && (
                          <button onClick={() => setStatus(m.id, "in_progress")} disabled={busy}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-black rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-700 hover:bg-amber-200 transition">
                            <Play className="w-3 h-3" /> In Progress
                          </button>
                        )}
                        {m.status !== "completed" && canEdit && (
                          <>
                            <button onClick={() => {
                              const bo = m.best_of_sets ?? 3;
                              setEditScore({ matchId: m.id, side: 1, sets: "", bestOfSets: bo, setsData: Array.from({ length: bo }, () => ({ t1: "", t2: "" })) });
                            }}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-black rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 hover:bg-emerald-200 transition">
                              <Trophy className="w-3 h-3" /> Enter Score
                            </button>
                            <button onClick={() => submitWalkover(m.id, 1)} disabled={busy}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-black rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                              <SkipForward className="w-3 h-3" /> W/O T1
                            </button>
                            <button onClick={() => submitWalkover(m.id, 2)} disabled={busy}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-black rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                              <SkipForward className="w-3 h-3" /> W/O T2
                            </button>
                          </>
                        )}
                        {m.status === "completed" && isMasterAdmin && (
                          <button onClick={() => {
                            const bo = m.best_of_sets ?? 3;
                            const hist = m.sets_history ?? [];
                            const setsData = Array.from({ length: bo }, (_, i) => {
                              const parts = (hist[i] ?? "").split("-");
                              return { t1: parts[0] ?? "", t2: parts[1] ?? "" };
                            });
                            setEditScore({ matchId: m.id, side: m.winner_side ?? 1, sets: hist.join(", "), bestOfSets: bo, setsData });
                          }}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-black rounded-lg border border-amber-300 dark:border-amber-700 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition">
                            <Unlock className="w-3 h-3" /> Edit (Admin)
                          </button>
                        )}
                        <button onClick={() => setEditSchedule({ matchId: m.id, court: m.court_number ?? "", at: m.scheduled_at ?? "" })}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-black rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                          <CalendarDays className="w-3 h-3" /> Schedule
                        </button>
                      </div>
                    </div>

                    {/* Inline score entry */}
                    {isEditing && (() => {
                      const sd = editScore!.setsData;
                      const setsStr = sd.filter(s => s.t1 !== "" && s.t2 !== "").map(s => `${s.t1}-${s.t2}`).join(", ");
                      const autoWinner = autoWinnerFromSets(setsStr, editScore!.bestOfSets);
                      const updateSet = (i: number, field: "t1" | "t2", val: string) => {
                        const next = sd.map((s, idx) => idx === i ? { ...s, [field]: val.replace(/\D/g, "").slice(0, 2) } : s);
                        const nextStr = next.filter(s => s.t1 !== "" && s.t2 !== "").map(s => `${s.t1}-${s.t2}`).join(", ");
                        const auto = autoWinnerFromSets(nextStr, editScore!.bestOfSets);
                        setEditScore((p) => p && ({ ...p, setsData: next, sets: nextStr, ...(auto ? { side: auto } : {}) }));
                      };
                      return (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                          {/* Header row */}
                          <div className="grid grid-cols-[3rem_1fr_1.5rem_1fr] gap-x-2 items-center">
                            <div />
                            <div className="text-center text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate px-1">
                              {m.team1_label ?? "Team 1"}
                            </div>
                            <div />
                            <div className="text-center text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate px-1">
                              {m.team2_label ?? "Team 2"}
                            </div>
                          </div>
                          {/* Per-set rows */}
                          {sd.map((s, i) => {
                            const prevFilled = i === 0 || (sd[i - 1].t1 !== "" && sd[i - 1].t2 !== "");
                            const t1n = parseInt(s.t1), t2n = parseInt(s.t2);
                            const t1Won = !isNaN(t1n) && !isNaN(t2n) && t1n > t2n;
                            const t2Won = !isNaN(t1n) && !isNaN(t2n) && t2n > t1n;
                            return (
                              <div key={i} className={`grid grid-cols-[3rem_1fr_1.5rem_1fr] gap-x-2 items-center ${!prevFilled ? "opacity-30 pointer-events-none" : ""}`}>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">G{i + 1}</span>
                                <input
                                  type="text" inputMode="numeric" value={s.t1}
                                  onChange={(e) => updateSet(i, "t1", e.target.value)}
                                  placeholder="—"
                                  className={`text-center font-black text-base rounded-xl border-2 py-2 outline-none transition w-full
                                    ${t1Won ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"}
                                    focus:border-emerald-400`}
                                />
                                <span className="text-center text-xs font-bold text-slate-400">–</span>
                                <input
                                  type="text" inputMode="numeric" value={s.t2}
                                  onChange={(e) => updateSet(i, "t2", e.target.value)}
                                  placeholder="—"
                                  className={`text-center font-black text-base rounded-xl border-2 py-2 outline-none transition w-full
                                    ${t2Won ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"}
                                    focus:border-emerald-400`}
                                />
                              </div>
                            );
                          })}
                          {/* Winner row */}
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 shrink-0">Winner</span>
                            {autoWinner ? (
                              <span className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                                <Trophy className="w-3 h-3" />
                                {editScore!.side === 1 ? (m.team1_label ?? "Team 1") : (m.team2_label ?? "Team 2")}
                                <span className="text-slate-400 dark:text-slate-500 font-normal">(auto-detected)</span>
                              </span>
                            ) : (
                              <select value={editScore!.side} onChange={(e) => setEditScore((p) => p && ({ ...p, side: parseInt(e.target.value) as 1 | 2 }))}
                                className="text-sm px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-1 focus:ring-emerald-500">
                                <option value={1}>{m.team1_label ?? "Team 1"}</option>
                                <option value={2}>{m.team2_label ?? "Team 2"}</option>
                              </select>
                            )}
                          </div>
                          {/* Actions */}
                          <div className="flex gap-2 pt-1">
                            <button onClick={submitEditScore}
                              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition">
                              Save
                            </button>
                            <button onClick={() => setEditScore(null)} className="text-xs text-slate-400 hover:text-slate-600 transition">Cancel</button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Inline schedule */}
                    {isScheduling && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="flex gap-2">
                          <div>
                            <label className={labelCls}><MapPin className="w-3 h-3 inline mr-1" />Court</label>
                            {(() => {
                              const PRESETS = ["C1","C2","C3"];
                              const isPreset = PRESETS.includes(editSchedule!.court);
                              const isEmpty = editSchedule!.court === "";
                              const selectVal = isPreset ? editSchedule!.court : isEmpty ? "" : "other";
                              return (
                                <>
                                  <select
                                    value={selectVal}
                                    onChange={(e) => {
                                      if (e.target.value === "other") setEditSchedule((p) => p && ({ ...p, court: "​" }));
                                      else setEditSchedule((p) => p && ({ ...p, court: e.target.value }));
                                    }}
                                    className="w-28 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                                  >
                                    <option value="">Select</option>
                                    <option value="C1">Court 1 (C1)</option>
                                    <option value="C2">Court 2 (C2)</option>
                                    <option value="C3">Court 3 (C3)</option>
                                    <option value="other">Other</option>
                                  </select>
                                  {!isPreset && !isEmpty && (
                                    <input
                                      value={editSchedule!.court === "​" ? "" : editSchedule!.court}
                                      onChange={(e) => setEditSchedule((p) => p && ({ ...p, court: e.target.value || "​" }))}
                                      placeholder="Enter court"
                                      className="mt-1 w-28 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                                    />
                                  )}
                                </>
                              );
                            })()}
                          </div>
                          <div className="flex-1">
                            <label className={labelCls}><CalendarDays className="w-3 h-3 inline mr-1" />Date & Time</label>
                            <input type="datetime-local" value={editSchedule!.at ? editSchedule!.at.slice(0, 16) : ""}
                              onChange={(e) => setEditSchedule((p) => p && ({ ...p, at: e.target.value }))}
                              className={inputCls} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveSchedule} className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition">Save</button>
                          <button onClick={() => setEditSchedule(null)} className="text-xs text-slate-400 hover:text-slate-600 transition">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {/* Bulk Schedule Modal */}
      {showBulkSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col gap-4 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-black text-slate-800 dark:text-white text-base">Bulk Schedule — {activeCategory}</h3>
                <p className="text-xs text-slate-500 mt-0.5">One match per line. Supported text formats:</p>
                <div className="mt-1 text-xs text-slate-400 font-mono space-y-0.5">
                  <p>MS_QF_01: Court 3, 2026-06-30 10:00</p>
                  <p>MS_QF_02 court=4 date=2026-06-30 time=11:30</p>
                  <p>MS_SF_01, Court 1, 30/06/2026 14:00</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadScheduleTemplate}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-500 hover:text-blue-600 hover:border-blue-400 transition">
                  <Download className="w-3.5 h-3.5" /> CSV Template
                </button>
                <button onClick={() => setShowBulkSchedule(false)} className="text-slate-400 hover:text-slate-600 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <textarea
              rows={7}
              placeholder={"MS_QF_01: Court 3, 2026-06-30 10:00\nMS_QF_02: Court 4, 2026-06-30 11:30\nMS_SF_01: Court 1, 2026-07-01 09:00"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className={`${inputCls} font-mono text-xs resize-none`}
            />

            <div className="flex items-center gap-3">
              <button
                onClick={() => parseBulkSchedule(bulkText)}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-black transition">
                Preview
              </button>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-400 hover:text-blue-500 transition">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV</span>
                <input type="file" accept=".csv" className="hidden"
                  onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleScheduleCSV(f); e.target.value = ""; }} />
              </label>
            </div>

            {bulkPreview.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-4 gap-0 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-black text-slate-500 uppercase tracking-wider text-[10px]">
                  <span>Match</span><span>Court</span><span>Date & Time</span><span>Status</span>
                </div>
                {bulkPreview.map((row, i) => (
                  <div key={i} className={`grid grid-cols-4 gap-0 px-3 py-2 border-t border-slate-100 dark:border-slate-800 ${!row.found ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{row.matchCode}</span>
                    <span className="text-slate-600 dark:text-slate-400">{row.court || <span className="text-slate-300">—</span>}</span>
                    <span className="text-slate-600 dark:text-slate-400">{row.at ? new Date(row.at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : <span className="text-slate-300">—</span>}</span>
                    <span className={row.found ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                      {row.found ? "✓ Found" : "✗ Not found"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={saveBulkSchedule}
                disabled={bulkSaving || bulkPreview.length === 0 || bulkPreview.every((r) => !r.found)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition disabled:opacity-40 disabled:cursor-not-allowed">
                {bulkSaving ? "Saving…" : `Save ${bulkPreview.filter((r) => r.found).length} Match${bulkPreview.filter((r) => r.found).length !== 1 ? "es" : ""}`}
              </button>
              <button onClick={() => { setShowBulkSchedule(false); setBulkText(""); setBulkPreview([]); }}
                className="text-xs text-slate-400 hover:text-slate-600 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ── Archive Tab ────────────────────────────────────────────────────────────────

function ArchiveTab({ tournament, isMasterAdmin, onArchived }: {
  tournament: Tournament;
  isMasterAdmin: boolean;
  onArchived: () => void;
}) {
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    supabase.from("tournament_matches").select("*").eq("tournament_id", tournament.id)
      .order("round").order("match_number")
      .then(({ data }) => { setMatches((data as TournamentMatch[]) ?? []); setLoading(false); });
  }, [tournament.id]);

  const archive = async () => {
    if (!confirm(`Archive "${tournament.name}"? This cannot be undone.`)) return;
    setArchiving(true);
    const { error } = await supabase.rpc("archive_tournament", { p_tournament_id: tournament.id });
    if (error) { toast.error(error.message); setArchiving(false); return; }
    toast.success("Tournament archived");
    onArchived();
    setArchiving(false);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>;

  const categories = [...new Set(matches.map((m) => m.category))];

  return (
    <div className="space-y-5">
      {tournament.status === "completed" && (
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-800 dark:text-white">Archive Tournament</h3>
              <p className="text-sm text-slate-500 mt-1">Freeze all results and make this a historical record. Cannot be undone.</p>
            </div>
            <button onClick={archive} disabled={archiving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black transition disabled:opacity-50">
              {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              Archive
            </button>
          </div>
        </div>
      )}

      {tournament.status === "archived" && (
        <div className="text-center py-2">
          <span className="text-xs font-black text-amber-600 uppercase tracking-widest px-3 py-1.5 bg-amber-100 dark:bg-amber-950/40 rounded-full">
            Archived {tournament.archived_at ? new Date(tournament.archived_at).toLocaleDateString() : ""}
          </span>
        </div>
      )}

      {/* Full fixture list */}
      {categories.map((cat) => {
        const catMatches = matches.filter((m) => m.category === cat);
        const rounds = [...new Set(catMatches.map((m) => m.round))].sort((a, b) => a - b);
        return (
          <div key={cat} className={cardCls}>
            <h3 className="font-black text-slate-800 dark:text-white mb-4">{cat} — Full Fixtures</h3>
            <div className="space-y-4">
              {rounds.map((round) => {
                const roundMatches = catMatches.filter((m) => m.round === round);
                return (
                  <div key={round}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{roundMatches[0]?.round_name}</p>
                    <div className="space-y-2">
                      {roundMatches.map((m) => (
                        <div key={m.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black text-slate-400">{m.match_code}</span>
                            <MatchStatusChip status={m.status} />
                          </div>
                          <MatchScoreDisplay
                            sets_history={m.sets_history}
                            team1_label={m.team1_label ?? "TBD"}
                            team2_label={m.team2_label ?? "TBD"}
                            winner_side={m.winner_side}
                            status={m.status}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {!matches.length && (
        <div className={`${cardCls} text-center py-10`}>
          <p className="text-slate-400">No matches recorded yet.</p>
        </div>
      )}
    </div>
  );
}
