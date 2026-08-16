// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { usePlayers } from "@/hooks/usePlayers";
import { generateSingleElimBracket, planDraw, entryRoundLabel, findWalkoverMatches } from "@/lib/bracketGenerator";
import { MatchScoreDisplay } from "@/components/tournament/MatchScoreDisplay";
import { BracketVisual } from "@/components/tournament/BracketVisual";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  Loader2, Save, Trophy, Users, Swords, Archive, Plus, X, Search,
  ChevronDown, ChevronUp, Lock, Unlock, Play, SkipForward, Settings2,
  CalendarDays, MapPin, Link, Unlink, Download, Upload, Trash2, Clipboard, RotateCcw, AlertCircle, RefreshCw, Check, Bell, Camera, Pencil, FileText
} from "lucide-react";
import { InfoModal } from "@/components/InfoModal";
import { PlayerSelect } from "@/components/umpire/PlayerSelect";
import { getDepartmentAcronym } from "@/data/departments";
import { exportToImage, exportToPDF } from "@/utils/exportUtils";

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
  auto_reminders_enabled?: boolean;
  archived_at: string | null;
  created_at: string;
  show_participants?: boolean | null;
  show_brackets?: boolean | null;
}

interface Participant {
  id: string;
  category: string;
  player_id: string | null;
  partner_id: string | null;
  display_name: string | null;
  seed: number | null;
  /** Pinned first-match round. null = automatic bye allocation. */
  entry_round: number | null;
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
const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition";
const labelCls = "block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-1.5";
const CATEGORIES = ["MS", "WS", "MD", "WD", "XD"];
const STATUS_FLOW = ["draft", "active", "completed"] as const;

const toLocalDatetimeStr = (isoStr: string | null) => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

// ── Status chip ────────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-slate-100 dark:bg-slate-800 text-muted-foreground",
    active: "bg-primary/15 dark:bg-primary/40 text-primary dark:text-primary",
    completed: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
    archived: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  };
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${map[status] ?? map.draft}`}>
      {status}
    </span>
  );
}

function MatchStatusChip({ match }: { match: { status: string, scheduled_at?: string | null, court_number?: string | null } }) {
  if (match.status === "walkover") return <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 whitespace-nowrap">W/O</span>;
  if (match.status === "completed") return <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/15 dark:bg-primary/40 text-primary whitespace-nowrap">COMPLETED</span>;
  if (match.status === "in_progress") return <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 whitespace-nowrap">LIVE</span>;
  if (match.scheduled_at) return <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 whitespace-nowrap">SCHEDULED</span>;
  return <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground whitespace-nowrap">PENDING</span>;
}

const COURT_COLORS: Record<string, string> = {
  C1: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  C2: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
  C3: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
  C4: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  C5: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
  C6: "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300",
};
function getCourtColorClass(court: string) {
  return COURT_COLORS[court.toUpperCase()] ?? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300";
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
    
    // Show all tournaments including deleted ones so admins can restore/trash them properly
    const allTournaments = data as Tournament[] ?? [];
    setTournaments(allTournaments);
    
    if (allTournaments.length && !selected) {
      setSelected(allTournaments[0]);
    }
    setLoading(false);
  }, [selected]);

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
      .insert({ name: "New Tournament", created_by: session?.user?.id, year: new Date().getFullYear() })
      .select()
      .single();
    if (error) { toast.error(error.message); setCreating(false); return; }
    toast.success("Tournament created");
    await loadTournaments();
    setSelected(data as Tournament);
    setTab("setup");
    setCreating(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

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
                { badge: "SEEDING", title: "Automatic Seeding", desc: "Players are automatically seeded based on their current ELO rating at the time of bracket generation." },
                { badge: "BYES", title: "Manual Entry Rounds", desc: "By default the draw's spare slots become byes for the top seeds, one each. On the Participants tab you can pin any player's first-match round instead — a second bye costs 3 slots, so the counter above the list shows what's left." }
              ]}
            />
            <select
              value={selected?.id ?? ""}
              onChange={(e) => {
                const t = tournaments.find((t) => t.id === e.target.value);
                if (t) { setSelected(t); setTab("setup"); }
              }}
              className="text-sm font-black text-slate-800 dark:text-foreground bg-transparent border-none outline-none cursor-pointer"
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {t.name} [{t.status}]
                </option>
              ))}
            </select>
            {selected && <StatusChip status={selected.status} />}
          </div>
          <button
            onClick={createTournament}
            disabled={creating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary text-primary-foreground text-xs font-black transition disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            New Tournament
          </button>
        </div>
      </div>

      {selected && (
        <>
          {/* Tabs */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            {(["setup", "participants", "bracket", "archive"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTab(tab)}
                className={`px-3 py-2 rounded-xl text-sm font-black transition-all w-full sm:w-auto text-center ${
                  activeTab === tab
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-muted-foreground dark:text-slate-300 hover:border-primary"
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
              onDelete={() => { setSelected(null); loadTournaments(); }}
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
          <Trophy className="w-12 h-12 text-slate-300 dark:text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-bold">No tournaments yet. Create one above.</p>
        </div>
      )}
    </div>
  );
}

// ── Setup Tab ──────────────────────────────────────────────────────────────────

function SetupTab({ tournament, onSaved, isMasterAdmin, onDelete }: {
  tournament: Tournament;
  onSaved: (t: Tournament) => void;
  isMasterAdmin: boolean;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<Tournament>({ ...tournament });
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const { session } = useAuth();
  const { recordAction } = useAdminHistory();
  const { confirm } = useConfirm();

  useEffect(() => { setForm({ ...tournament }); }, [tournament.id]);

  const upd = <K extends keyof Tournament>(k: K, v: Tournament[K]) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (form.start_date && form.end_date) {
      if (new Date(form.start_date) > new Date(form.end_date)) {
        toast.error("Start date cannot be after the end date.");
        return;
      }
    }
    
    setSaving(true);
    const { id, created_at, archived_at, ...rest } = form;
    
    // Sanitize empty strings to null for date columns
    if (rest.start_date === "") rest.start_date = null;
    if (rest.end_date === "") rest.end_date = null;
    if (rest.form_close_date === "") rest.form_close_date = null;

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
    const ok = await confirm({ title: "Confirm Status Change", description: `Move tournament to "${newStatus}" status?`, confirmLabel: "Move", confirmVariant: "primary" });
    if (!ok) return;
    setTransitioning(true);
    const { data, error } = await supabase.from("tournaments").update({ status: newStatus }).eq("id", tournament.id).select().single();
    if (error) { toast.error(error.message); setTransitioning(false); return; }
    await recordAction({
      action_type: "update",
      entity_type: "tournaments",
      entity_id: tournament.id,
      before_state: tournament,
      after_state: data,
      label: `Changed tournament "${tournament.name}" status to ${newStatus}`,
    });
    toast.success(`Status → ${newStatus}`);
    onSaved(data as Tournament);
    setTransitioning(false);
  };

  const deleteDraft = async () => {
    if (form.status !== "draft") return;
    if (!confirm("Are you sure you want to send this draft tournament to the trash?")) return;
    setSaving(true);
    const afterState = { ...tournament, status: "deleted" };
    const { error } = await supabase.from("tournaments").update({ status: "deleted" }).eq("id", tournament.id);
    if (error) { toast.error("Failed to trash: " + error.message); setSaving(false); return; }
    
    await recordAction({
      action_type: "update",
      entity_type: "tournaments",
      entity_id: tournament.id,
      before_state: tournament,
      after_state: afterState,
      label: `Sent draft tournament "${form.name}" to Trash`,
    });
    
    toast.success("Tournament sent to Trash");
    if (onDelete) onDelete();
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Status transitions */}
      <div className={cardCls}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-bold text-muted-foreground dark:text-slate-300">Status:</span>
          <StatusChip status={form.status} />
          {form.status === "draft" && (
            <button onClick={() => transition("active")} disabled={transitioning}
              className="px-3 py-1 text-xs font-black rounded-xl bg-primary hover:bg-primary text-primary-foreground disabled:opacity-50 transition">
              {transitioning ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "→ Activate"}
            </button>
          )}
          {form.status === "active" && (
            <>
              <button onClick={() => transition("completed")} disabled={transitioning}
                className="px-3 py-1 text-xs font-black rounded-xl bg-blue-600 hover:bg-blue-500 text-foreground disabled:opacity-50 transition">
                {transitioning ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "→ Mark Completed"}
              </button>
              <button onClick={() => transition("draft")} disabled={transitioning}
                className="px-3 py-1 text-xs font-black rounded-xl bg-slate-600 hover:bg-slate-500 text-foreground disabled:opacity-50 transition">
                {transitioning ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "↺ Revert to Draft"}
              </button>
            </>
          )}
          {form.status === "completed" && (
            <button onClick={() => transition("active")} disabled={transitioning}
              className="px-3 py-1 text-xs font-black rounded-xl bg-amber-600 hover:bg-amber-500 text-foreground disabled:opacity-50 transition">
              {transitioning ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "↺ Re-Activate (Live)"}
            </button>
          )}
          {form.status === "draft" && (
            <span className="text-[10px] text-muted-foreground">Drafts are only visible to admins</span>
          )}
        </div>
      </div>

      {/* Public Visibility */}
      <div className={cardCls}>
        <h3 className="font-black text-slate-800 dark:text-foreground mb-4">Public Visibility</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Control which tabs are visible to players on the public Pulse page.
        </p>
        <div className="flex flex-col sm:flex-row gap-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={!!form.show_participants}
              onChange={(e) => upd("show_participants", e.target.checked)}
              className="w-5 h-5 accent-primary rounded border-slate-300"
            />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Show Participants Tab</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={!!form.show_brackets}
              onChange={(e) => upd("show_brackets", e.target.checked)}
              className="w-5 h-5 accent-primary rounded border-slate-300"
            />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Show Brackets Tab</span>
          </label>
        </div>
      </div>

      {/* Details */}
      <div className={cardCls}>
        <h3 className="font-black text-slate-800 dark:text-foreground mb-4">Details</h3>
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
              <option value="team">Team Tournament</option>
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
                    className={`px-4 py-1.5 rounded-xl text-sm font-black border transition-all ${active ? "bg-primary text-primary-foreground border-primary" : "border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-primary"}`}>
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
        <h3 className="font-black text-slate-800 dark:text-foreground mb-4">Registration Form</h3>
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
            <input 
              type="datetime-local" 
              value={toLocalDatetimeStr(form.form_close_date)} 
              onChange={(e) => {
                const val = e.target.value;
                if (!val) upd("form_close_date", "");
                else upd("form_close_date", new Date(val).toISOString());
              }} 
              className={inputCls} 
            />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <label className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-amber-500" /> Auto Match & Umpire Reminders
            </label>
            <p className="text-xs text-muted-foreground">
              Sends push & email notifications to players and umpires 30 mins before scheduled matches.
            </p>
          </div>
          <button
            type="button"
            onClick={() => upd("auto_reminders_enabled", !form.auto_reminders_enabled)}
            className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${
              form.auto_reminders_enabled !== false
                ? "bg-emerald-600 text-white border-emerald-500 shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
            }`}
          >
            {form.auto_reminders_enabled !== false ? "✓ Enabled" : "Disabled"}
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          {form.status === "draft" && (
            <button onClick={deleteDraft} disabled={saving || transitioning}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold transition">
              <Trash2 className="w-4 h-4" />
              Delete Draft
            </button>
          )}
        </div>
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary disabled:opacity-50 text-primary-foreground font-black transition shadow-lg">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Details
        </button>
      </div>

      {/* Danger Zone */}
      <div className="mt-12 pt-8 border-t-2 border-red-100 dark:border-red-900/30">
        <h3 className="text-sm font-black text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Danger Zone
        </h3>
        <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-6 border border-red-200 dark:border-red-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-red-900 dark:text-red-100">Send to Trash (Soft Delete)</h4>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              Move this tournament to the trash instead of permanently deleting it. You can undo this action from the admin panel history.
            </p>
          </div>
          <button
            onClick={async () => {
              const confirmMsg = "Move this tournament to the Trash? You will be able to undo this action using the admin panel's Undo feature.";
              const ok = await confirm({ title: "Trash Tournament", description: confirmMsg, confirmLabel: "Trash Tournament", confirmVariant: "danger" });
              if (!ok) return;
              
              const afterState = { ...tournament, status: "deleted" };
              const { error } = await supabase.from("tournaments").update({ status: "deleted" }).eq("id", tournament.id);
              if (error) {
                toast.error("Failed to trash: " + error.message);
              } else {
                await recordAction({
                  action_type: "update",
                  entity_type: "tournaments",
                  entity_id: tournament.id,
                  before_state: tournament,
                  after_state: afterState,
                  label: `Sent tournament "${tournament.name}" to Trash`,
                });
                
                toast.success("Tournament sent to Trash");
                if (onDelete) onDelete(); // Close setup tab view by clearing selected
              }
            }}
            className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-foreground font-black transition shadow"
          >
            Trash Tournament
          </button>
        </div>
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
  const getHashCat = () => {
    const parts = window.location.hash.replace("#", "").split("/");
    return parts[2] || tournament.categories[0] || "";
  };
  const [activeCat, setActiveCat] = useState<string>(getHashCat());

  useEffect(() => {
    const handleHash = () => {
      const parts = window.location.hash.replace("#", "").split("/");
      if (parts[1] === "participants") {
         setActiveCat(parts[2] || tournament.categories[0] || "");
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
    toast.success(`Linked to ${playerName}. Hint: Go to Bracket tab and click "Sync Names" to update bracket!`);
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
    toast.success("Name updated. Sync bracket if generated!");
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
                 <AlertCircle className="w-5 h-5 text-amber-500" />
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
                  <div key={i} className="bg-amber-50/50 dark:bg-amber-950/10 p-4 rounded-xl border border-amber-200/50 dark:border-amber-900/50">
                     <h4 className="text-[10px] font-black text-amber-600/80 uppercase tracking-widest mb-2">Match Group {i+1}</h4>
                     <ul className="space-y-2">
                        {g.map((item, j) => (
                          <li key={j} className="text-sm flex items-center justify-between font-bold text-slate-700 dark:text-slate-300 before:content-[''] before:w-1.5 before:h-1.5 before:bg-amber-400 before:rounded-full before:mr-2">
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
        {tournament.categories.map((cat) => (
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

      {tournament.categories.includes(activeCat) && (() => {
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
              <div className="flex items-center justify-between px-1 mb-2">
                  <div className="flex items-center gap-4">
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
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => checkDuplicates(cat, parts, doubles)}
                      className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-amber-500 transition px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md"
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
                    <button onClick={bulkUnlink} className="px-3 py-1.5 text-xs font-bold text-amber-600 bg-amber-100 hover:bg-amber-200 rounded-lg transition flex items-center gap-1">
                      <Unlink className="w-3 h-3" /> Unlink
                    </button>
                    <button onClick={bulkRemove} className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-100 hover:bg-rose-200 rounded-lg transition flex items-center gap-1">
                      <X className="w-3 h-3" /> Delete
                    </button>
                    <button onClick={() => setSelectedParts(prev => prev.filter(id => !parts.some(p => p.id === id)))} className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-lg transition flex items-center gap-1">
                      Clear
                    </button>
                  </div>
                )}
                {drawPlan && (
                  <div className={`rounded-xl border p-3 mb-3 ${drawPlan.overAllocatedSlots > 0 ? "border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30" : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40"}`}>
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
                      <p className="mt-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
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
                      <p className="mt-1 text-xs font-bold text-amber-600 dark:text-amber-400">
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
                                      {!p.player_id && <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/50 px-1.5 py-0.5 rounded-full shrink-0">ext</span>}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate mt-0.5">{getDepartmentAcronym(dept1)}</span>
                                  </div>
                                  <div className="flex flex-col flex-1 min-w-0 sm:pl-1">
                                    <div className="text-sm font-bold text-slate-800 dark:text-foreground truncate flex items-center gap-1.5">
                                      <span className="truncate">{name2}</span>
                                      {!p.partner_id && <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/50 px-1.5 py-0.5 rounded-full shrink-0">ext</span>}
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
                                      <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/50 px-1.5 py-0.5 rounded-full shrink-0">external</span>
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
                          className="p-1.5 mt-0.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition shrink-0 ml-1">
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
                            className="p-1.5 text-slate-500 hover:text-blue-500 hover:bg-white dark:hover:bg-slate-700 rounded-md transition">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setLinkingId(linkingId === p.id ? null : p.id); setLinkSearch(""); setEditingName(null); }}
                            title={p.player_id ? "Change linked player" : "Link to registered player"}
                            className={`p-1.5 rounded-md transition hover:bg-white dark:hover:bg-slate-700 ${p.player_id ? "text-blue-500" : "text-slate-500 hover:text-blue-500"}`}>
                            <Link className="w-3.5 h-3.5" />
                          </button>
                          {p.player_id && (
                            <button
                              onClick={() => linkParticipantToPlayer(p.id, null, p.display_name?.split(' &')[0] || "")}
                              title="Unlink Player 1"
                              className="p-1.5 text-amber-500 hover:text-amber-600 hover:bg-white dark:hover:bg-slate-700 rounded-md transition">
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {doubles && p.partner_id && (
                            <button
                              onClick={() => linkParticipantToPartner(p.id, null, p.display_name?.split('&')[1]?.trim() || "")}
                              title="Unlink Player 2"
                              className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-700 rounded-md transition">
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
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            {linkSearch && (
                              <div className="mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm max-h-40 overflow-y-auto">
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
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-black text-blue-500 hover:text-blue-600 hover:border-blue-400 transition"
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
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-blue-500 transition w-fit">
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
                              <span className={`w-2 h-2 rounded-full shrink-0 ${e.match1 ? "bg-primary" : "bg-amber-400"}`} />
                              <span className="flex-1 text-muted-foreground dark:text-slate-300 truncate">{e.raw}</span>
                              <span className={`text-[10px] font-black uppercase ${e.match1 ? "text-primary" : "text-amber-500"}`}>
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
                      className="px-3 py-2 text-xs font-black rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-muted-foreground hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-1">
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
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-foreground text-xs font-black shadow transition">
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

// ── Bracket Tab ────────────────────────────────────────────────────────────────

function BracketTab({ tournament, isMasterAdmin }: { tournament: Tournament; isMasterAdmin: boolean }) {
  const { data: allPlayers } = usePlayers();
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [roundRules, setRoundRules] = useState<RoundRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(() => {
    const hash = window.location.hash.replace("#", "");
    const parts = hash.split("/");
    if (parts[1] === "bracket" && parts[2]) {
      return tournament.categories.includes(parts[2]) ? parts[2] : (tournament.categories[0] ?? "");
    }
    return tournament.categories[0] ?? "";
  });
  const [showRules, setShowRules] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "visual">(() => {
    const hash = window.location.hash.replace("#", "");
    const parts = hash.split("/");
    if (parts[1] === "bracket" && parts[3]) {
      return parts[3] === "list" ? "list" : "visual";
    }
    return "visual";
  });
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<{
    matchId: string; side: 1 | 2; sets: string; bestOfSets: number; goldenPoint: number; pointsToWin: number;
    setsData: { t1: string; t2: string }[];
  } | null>(null);
  const [editSchedule, setEditSchedule] = useState<{ matchId: string; court: string; at: string } | null>(null);
  const [assignUmpire, setAssignUmpire] = useState<{ matchId: string; umpireId: string } | null>(null);
  const [showBulkSchedule, setShowBulkSchedule] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkPreview, setBulkPreview] = useState<{ matchCode: string; court: string; at: string; found: boolean }[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [remindSendingId, setRemindSendingId] = useState<string | null>(null);
  const [remindSentMap, setRemindSentMap] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

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

  useEffect(() => {
    if (activeCategory) {
      const hash = window.location.hash.replace("#", "");
      const baseHash = hash.split("/")[0] || "tournament";
      window.history.replaceState(null, "", `#${baseHash}/bracket/${activeCategory}/${viewMode}`);
    }
  }, [activeCategory, viewMode]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      const parts = hash.split("/");
      if (parts[1] === "bracket") {
        if (parts[2] && tournament.categories.includes(parts[2])) setActiveCategory(parts[2]);
        if (parts[3] === "list" || parts[3] === "visual") setViewMode(parts[3] as "list" | "visual");
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [tournament.categories]);

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
    
    // Validate badminton rules
    const ptw = editScore.pointsToWin;
    const gp = editScore.goldenPoint;
    let t1Wins = 0;
    let t2Wins = 0;
    const needed = Math.ceil(editScore.bestOfSets / 2);

    for (let i = 0; i < editScore.setsData.length; i++) {
      const s = editScore.setsData[i];
      if (s.t1 === "" || s.t2 === "") continue;

      if (t1Wins >= needed || t2Wins >= needed) {
        toast.error(`Invalid score: The match was already won in earlier sets. You cannot enter a score for set ${i + 1}.`);
        return;
      }

      const t1 = parseInt(s.t1, 10) || 0;
      const t2 = parseInt(s.t2, 10) || 0;
      const win = Math.max(t1, t2);
      const lose = Math.min(t1, t2);
      
      let valid = false;
      if (win === ptw && (win - lose) >= 2) valid = true;
      else if (win > ptw && win < gp && (win - lose) === 2) valid = true;
      else if (win === gp && (win - lose) >= 1 && (win - lose) <= 2) valid = true;
      
      // Allow 0-0 as incomplete set or empty entry
      if (win === 0 && lose === 0) continue;

      if (!valid) {
        toast.error(`Invalid score in set ${i + 1}: ${t1}-${t2}. Enter a mathematically valid badminton score.`);
        return;
      }

      if (t1 > t2) t1Wins++;
      else if (t2 > t1) t2Wins++;
    }

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
    
    let isoAt = editSchedule.at || null;
    if (isoAt) {
      const d = new Date(isoAt);
      if (!isNaN(d.getTime())) {
        isoAt = d.toISOString();
      }
    }

    await supabase.from("tournament_matches").update({
      court_number: editSchedule.court || null,
      scheduled_at: isoAt,
      reminder_sent: false,
    }).eq("id", editSchedule.matchId);
    await load();
    setEditSchedule(null);
    toast.success("Schedule saved");
  };

  const saveUmpire = async () => {
    if (!assignUmpire) return;
    setActingOn(assignUmpire.matchId);
    const { error } = await supabase.from("tournament_matches").update({
      umpired_by: assignUmpire.umpireId || null
    }).eq("id", assignUmpire.matchId);
    setActingOn(null);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Umpire updated");
      await load();
      setAssignUmpire(null);
    }
  };

  const downloadScheduleTemplate = () => {
    const header = ["MatchCode", "Court", "Date (YYYY-MM-DD)", "Time (HH:MM)"];
    const rows = matches
      .filter((m) => m.category === activeCategory && m.team1_label !== "BYE" && m.team2_label !== "BYE")
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
      const matchCode = line.split(/[\s,:,\t]+/)[0].toUpperCase();
      if (!matchCode) continue;

      let court = "";
      let at = "";

      // key=value style
      const kvCourt = line.match(/court\s*=\s*([^\s,]+)/i);
      const kvDate = line.match(/date\s*=\s*(\d{4}[-\/]\d{2}[-\/]\d{2}|\d{2}[-\/]\d{2}[-\/]\d{4})/i);
      const kvTime = line.match(/time\s*=\s*(\d{1,2})(:\d{2})?(:\d{2})?/i);
      if (kvCourt) court = kvCourt[1];
      if (kvDate && kvTime) {
        let d = kvDate[1];
        if (d.match(/^\d{2}[-\/]\d{2}[-\/]\d{4}$/)) {
          const dParts = d.split(/[-\/]/);
          d = `${dParts[2]}-${dParts[1]}-${dParts[0]}`;
        }
        let t = kvTime[1].padStart(2, "0");
        t += kvTime[2] ? kvTime[2] : ":00";
        try {
          at = new Date(`${d}T${t}`).toISOString();
        } catch (e) {
          at = `${d}T${t}`;
        }
      }

      if (!court || !at) {
        // Free-form: find "court N" token
        const courtMatch = line.match(/court\s*(\w+)/i);
        if (courtMatch) court = courtMatch[1];

        // Find datetime: YYYY-MM-DD HH:MM or DD/MM/YYYY HH:MM or DD-MM-YYYY HH:MM
        const isoDate = line.match(/(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/i);
        const dmy = line.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})\s+(\d{2}:\d{2})/i);
        if (isoDate) {
          try { at = new Date(`${isoDate[1]}T${isoDate[2]}`).toISOString(); } catch(e) { at = `${isoDate[1]}T${isoDate[2]}`; }
        }
        else if (dmy) {
          try { at = new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T${dmy[4]}`).toISOString(); } catch(e) { at = `${dmy[3]}-${dmy[2]}-${dmy[1]}T${dmy[4]}`; }
        }
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

    // Sync to existing matches in this round
    await supabase.from("tournament_matches").update({
      points_to_win: rule.points_to_win,
      best_of_sets: rule.best_of_sets,
      golden_point: rule.golden_point,
    }).eq("tournament_id", tournament.id).eq("category", rule.category).eq("round", rule.round);

    await load();
    toast.success("Round rules saved");
  };

  const batchAdvance = async () => {
    const completed = matches.filter((m) => (m.status === "completed" || m.status === "walkover") && m.advances_to_match);
    for (const m of completed) {
      await supabase.rpc("admin_edit_tournament_match", {
        p_match_id: m.id, p_winner_side: m.winner_side, p_score: m.score, p_sets: m.sets_history,
      });
    }
    await load();
    toast.success("All winners advanced");
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!matches.length) return (
    <div className={`${cardCls} text-center py-10`}>
      <Swords className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p className="text-muted-foreground font-bold">No bracket yet. Go to Participants tab and click Generate Bracket.</p>
    </div>
  );

  const downloadMatchesPDF = async (cat: string) => {
    const catMatches = matches.filter((m) => m.category === cat);
    if (!catMatches.length) {
      toast.error("No matches to export");
      return;
    }

    const header = [
      "Match Code",
      "Round",
      "Court",
      "Schedule",
      "Team 1",
      "Team 2",
      "Status",
      "Score / Result"
    ];

    const rows = catMatches.map((m) => {
      const scheduleStr = m.scheduled_at
        ? new Date(m.scheduled_at).toLocaleString("en-IN", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "TBD";

      const courtStr = m.court_number ? `Court ${m.court_number}` : "-";
      
      let scoreStr = "-";
      if (m.status === "walkover") {
        scoreStr = `W/O (${m.winner_side === 1 ? m.team1_label : m.team2_label})`;
      } else if (m.sets_history && m.sets_history.length > 0) {
        scoreStr = m.sets_history.join(", ");
      } else if (m.score) {
        scoreStr = m.score;
      }

      return [
        m.match_code || "",
        m.round_name || `Round ${m.round}`,
        courtStr,
        scheduleStr,
        m.team1_label || "TBD",
        m.team2_label || "TBD",
        (m.status || "pending").toUpperCase(),
        scoreStr
      ];
    });

    const sheetName = `${tournament.name} - ${cat} Matches`;
    const filename = `${tournament.name.replace(/\s+/g, '_')}_${cat}_matches`;

    await exportToPDF([{ name: sheetName, data: [header, ...rows] }], filename);
  };

  const downloadMatchesCSV = (cat: string) => {
    const catMatches = matches.filter((m) => m.category === cat);
    if (!catMatches.length) {
      toast.error("No matches to export");
      return;
    }

    const header = [
      "Match Code",
      "Round",
      "Court",
      "Scheduled Time",
      "Team 1",
      "Team 2",
      "Status",
      "Score / Result"
    ];

    const rows = catMatches.map((m) => {
      const scheduleStr = m.scheduled_at
        ? new Date(m.scheduled_at).toLocaleString("en-IN", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "TBD";

      const courtStr = m.court_number ? `Court ${m.court_number}` : "";
      let scoreStr = "";
      if (m.status === "walkover") {
        scoreStr = `W/O (${m.winner_side === 1 ? m.team1_label : m.team2_label})`;
      } else if (m.sets_history && m.sets_history.length > 0) {
        scoreStr = m.sets_history.join(", ");
      } else if (m.score) {
        scoreStr = m.score;
      }

      return [
        m.match_code || "",
        m.round_name || `Round ${m.round}`,
        courtStr,
        scheduleStr,
        m.team1_label || "TBD",
        m.team2_label || "TBD",
        (m.status || "pending").toUpperCase(),
        scoreStr
      ];
    });

    downloadCSV(`${tournament.name.replace(/\s+/g, '_')}_${cat}_matches_list.csv`, [header, ...rows]);
  };

  const categoryMatches = matches.filter((m) => m.category === activeCategory);
  const rounds = [...new Set(categoryMatches.map((m) => m.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {/* Category tabs + batch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tournament.categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-xl text-sm font-black transition-all ${activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-muted-foreground dark:text-slate-300 hover:border-primary"}`}>
              {cat}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          {/* Row 1: Visual and List */}
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-black w-full">
            <button onClick={() => setViewMode("visual")}
              className={`flex-1 px-3 py-1.5 transition ${viewMode === "visual" ? "bg-slate-800 text-foreground" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300"}`}>
              Visual
            </button>
            <button onClick={() => setViewMode("list")}
              className={`flex-1 px-3 py-1.5 transition ${viewMode === "list" ? "bg-slate-800 text-foreground" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300"}`}>
              List
            </button>
          </div>

          {/* Row 2: Export PDF and Export CSV */}
          <div className="flex gap-2 w-full">
            <button onClick={() => downloadMatchesPDF(activeCategory)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-700 text-xs font-black text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition">
              <FileText className="w-3.5 h-3.5 shrink-0" /> Export PDF
            </button>
            <button onClick={() => downloadMatchesCSV(activeCategory)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 text-xs font-black text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition">
              <Download className="w-3.5 h-3.5 shrink-0" /> Export CSV
            </button>
          </div>

          {/* Row 3: Admin Actions (flex-wrap for responsiveness) */}
          <div className="flex flex-wrap gap-2 w-full">
            <button onClick={() => setShowRules((v) => !v)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black text-muted-foreground dark:text-slate-300 hover:border-primary transition min-w-[120px]">
              <Settings2 className="w-3.5 h-3.5 shrink-0" /> Round Rules
            </button>
            <button onClick={() => { setShowBulkSchedule(true); setBulkPreview([]); setBulkText(""); }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-300 dark:border-blue-700 text-xs font-black text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition min-w-[120px]">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" /> Bulk Schedule
            </button>
            <button 
            disabled={isSyncing}
            onClick={async () => {
              if (!confirm("This will synchronize Round 1 bracket match names with the latest Participants list. Continue?")) return;
              setIsSyncing(true);
              try {
                const { data: pData, error: pErr } = await supabase.from("tournament_participants").select("*").eq("tournament_id", tournament.id).eq("category", activeCategory);
                if (pErr) { toast.error(pErr.message); return; }
                const parts = (pData as Participant[]) ?? [];
                
                const mapped = parts.map((p) => ({
                  playerId: p.player_id,
                  partnerId: p.partner_id,
                  displayName: p.display_name ?? (allPlayers?.find((pl) => pl.id === p.player_id)?.full_name ?? "Unknown"),
                  seed: p.seed ?? 99,
                  entryRound: p.entry_round,
                }));

                const newRows = generateSingleElimBracket(mapped, activeCategory, tournament.id, false);
                if (!newRows.length) { toast.error("Manual entry rounds don't fit the draw"); return; }

                let updatedCount = 0;
                for (const row of newRows.filter(r => r.round === 1)) {
                  const { error } = await supabase.from("tournament_matches").update({
                    player1_id: row.player1_id,
                    team1_label: row.team1_label,
                    player3_id: row.player3_id,
                    player2_id: row.player2_id,
                    team2_label: row.team2_label,
                    player4_id: row.player4_id,
                  }).eq("tournament_id", tournament.id).eq("match_code", row.match_code);
                  if (!error) updatedCount++;
                }
                toast.success(`Synced ${updatedCount} matches in Round 1`);
                
                const completed = matches.filter((m) => (m.status === "completed" || m.status === "walkover") && m.advances_to_match);
                if (completed.length > 0) {
                  toast.info("Cascading name updates to advanced rounds...");
                  for (const m of completed) {
                    await supabase.rpc("admin_edit_tournament_match", {
                      p_match_id: m.id, p_winner_side: m.winner_side, p_score: m.score, p_sets: m.sets_history,
                    });
                  }
                }
                load();
              } finally { 
                setIsSyncing(false); 
              }
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 text-xs font-black text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition min-w-[120px] disabled:opacity-50">
            {isSyncing ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 shrink-0" />} Sync Names
          </button>
          <button 
            disabled={isAdvancing}
            onClick={async () => {
              setIsAdvancing(true);
              try { await batchAdvance(); } finally { setIsAdvancing(false); }
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-foreground text-xs font-black transition min-w-[120px] disabled:opacity-50">
            {isAdvancing ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" /> : <SkipForward className="w-3.5 h-3.5 shrink-0" />} Batch Advance
          </button>
          </div>
        </div>
      </div>

      {/* Round rules panel */}
      {showRules && (
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black text-slate-800 dark:text-foreground text-sm">Round Scoring Rules — {activeCategory}</h3>
            <button
              onClick={async () => {
                const p = toast.loading("Saving all round rules...");
                await Promise.all(rounds.map(async (round) => {
                  const rule = roundRules.find((r) => r.category === activeCategory && r.round === round) ?? {
                    category: activeCategory, round,
                    round_name: categoryMatches.find((m) => m.round === round)?.round_name ?? null,
                    points_to_win: 21, best_of_sets: 3, golden_point: 30,
                  };
                  const ptw = parseInt((document.getElementById(`rule-${activeCategory}-${round}-points_to_win`) as HTMLInputElement)?.value || "21");
                  const bos = parseInt((document.getElementById(`rule-${activeCategory}-${round}-best_of_sets`) as HTMLInputElement)?.value || "3");
                  const gp = parseInt((document.getElementById(`rule-${activeCategory}-${round}-golden_point`) as HTMLInputElement)?.value || "30");
                  await saveRoundRule({ ...rule, points_to_win: ptw, best_of_sets: bos, golden_point: gp });
                }));
                toast.success("Saved all round rules!", { id: p });
                load();
              }}
              className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition shadow-sm"
            >
              Save All
            </button>
          </div>
          <div className="space-y-2">
            {rounds.map((round) => {
              const rule = roundRules.find((r) => r.category === activeCategory && r.round === round) ?? {
                category: activeCategory, round,
                round_name: categoryMatches.find((m) => m.round === round)?.round_name ?? null,
                points_to_win: 21, best_of_sets: 3, golden_point: 30,
              };
              return (
                <div key={round} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-2 items-end mb-2 pb-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div>
                    <label className={labelCls}>Round</label>
                    <div className="text-sm font-bold text-muted-foreground dark:text-slate-300 py-2 truncate">{rule.round_name ?? `R${round}`}</div>
                  </div>
                  {(["points_to_win", "best_of_sets", "golden_point"] as const).map((field) => (
                    <div key={field}>
                      <label className={labelCls}>{field.replace(/_/g, " ")}</label>
                      <input type="number" min={1}
                        id={`rule-${activeCategory}-${round}-${field}`}
                        defaultValue={rule[field]}
                        className={inputCls} />
                    </div>
                  ))}
                  <div>
                    <button
                      onClick={() => {
                        const ptw = parseInt((document.getElementById(`rule-${activeCategory}-${round}-points_to_win`) as HTMLInputElement)?.value || "21");
                        const bos = parseInt((document.getElementById(`rule-${activeCategory}-${round}-best_of_sets`) as HTMLInputElement)?.value || "3");
                        const gp = parseInt((document.getElementById(`rule-${activeCategory}-${round}-golden_point`) as HTMLInputElement)?.value || "30");
                        saveRoundRule({ ...rule, points_to_win: ptw, best_of_sets: bos, golden_point: gp });
                      }}
                      className="px-3 py-2 rounded-xl bg-primary hover:bg-primary text-primary-foreground text-xs font-black transition shadow-sm mb-[1px]"
                    >
                      Save
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual bracket */}
      {viewMode === "visual" && (
        <ErrorBoundary>
          <BracketVisual matches={categoryMatches} rounds={rounds} enablePathHighlight />
        </ErrorBoundary>
      )}

      {/* Match cards by round */}
      {viewMode === "list" && rounds.map((round) => {
        const roundMatches = categoryMatches.filter((m) => m.round === round);
        const roundName = roundMatches[0]?.round_name ?? `Round ${round}`;
        return (
          <div key={round}>
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">{roundName}</h3>
            <div className="space-y-2">
              {roundMatches.map((m) => {
                const busy = actingOn === m.id;
                const isEditing = editScore?.matchId === m.id;
                const isScheduling = editSchedule?.matchId === m.id;
                const isByeMatch = m.team1_label === "BYE" || m.team2_label === "BYE";
                const canEdit = (!m.locked || isMasterAdmin) && !isByeMatch;

                return (
                  <div key={m.id} className={`${cardCls} !p-0 overflow-hidden`}>
                    {/* ── Card Header Bar ── */}
                    <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-200/60 dark:bg-slate-700/60 px-2 py-0.5 rounded-md">{m.match_code}</span>
                      <MatchStatusChip match={m} />
                      {m.locked && <Lock className="w-3.5 h-3.5 text-amber-500" aria-label="Locked" />}
                      {m.scored_by && m.status === 'completed' && (
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 ml-auto">
                          <Trophy className="w-3 h-3" /> {allPlayers?.find((p) => p.id === m.scored_by)?.full_name || "Umpire"}
                        </span>
                      )}
                    </div>

                    {/* ── Card Body ── */}
                    <div className="px-4 py-3">
                      {/* Court + Schedule row */}
                      {(m.court_number || m.scheduled_at) && (
                        <div className="flex items-center gap-2 flex-wrap mb-2.5">
                          {m.court_number && (
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${getCourtColorClass(m.court_number)}`}>
                              Court {m.court_number}
                            </span>
                          )}
                          {m.scheduled_at && (
                            <span className="text-[10px] text-muted-foreground dark:text-slate-400 flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              {new Date(m.scheduled_at).toLocaleString("en-IN", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Teams */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-bold truncate ${m.winner_side === 1 ? "text-primary" : "text-foreground dark:text-slate-200"}`}>
                            {m.team1_label ?? "TBD"}
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-muted-foreground uppercase shrink-0">vs</span>
                        <div className="flex-1 min-w-0 text-right">
                          <div className={`text-sm font-bold truncate ${m.winner_side === 2 ? "text-primary" : "text-foreground dark:text-slate-200"}`}>
                            {m.team2_label ?? "TBD"}
                          </div>
                        </div>
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

                    {/* ── Action Buttons ── */}
                    <div className="px-4 pb-3 pt-1 space-y-2">
                      {/* Primary actions row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {m.status === "scheduled" && canEdit && (
                          <button onClick={() => setStatus(m.id, "in_progress")} disabled={busy}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/40 transition">
                            <Play className="w-3 h-3" /> Start
                          </button>
                        )}
                        {m.status !== "completed" && canEdit && (
                          <>
                            <button onClick={() => {
                              const bo = m.best_of_sets ?? 3;
                              const gp = m.golden_point ?? 30;
                              const ptw = m.points_to_win ?? 21;
                              setEditScore({ matchId: m.id, side: 1, sets: "", bestOfSets: bo, goldenPoint: gp, pointsToWin: ptw, setsData: Array.from({ length: bo }, () => ({ t1: "", t2: "" })) });
                            }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-primary/15 dark:bg-primary/40 text-primary hover:bg-primary/25 dark:hover:bg-primary/50 transition">
                              <Trophy className="w-3 h-3" /> Score
                            </button>
                            <button onClick={() => submitWalkover(m.id, 1)} disabled={busy}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                              <SkipForward className="w-3 h-3" /> W/O T1
                            </button>
                            <button onClick={() => submitWalkover(m.id, 2)} disabled={busy}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                              <SkipForward className="w-3 h-3" /> W/O T2
                            </button>
                          </>
                        )}
                        {m.status === "completed" && isMasterAdmin && (
                          <button onClick={() => {
                            const bo = m.best_of_sets ?? 3;
                            const gp = m.golden_point ?? 30;
                            const ptw = m.points_to_win ?? 21;
                            const hist = m.sets_history ?? [];
                            const setsData = Array.from({ length: bo }, (_, i) => {
                              const parts = (hist[i] ?? "").split("-");
                              let t1Str = parts[0] ?? "";
                              let t2Str = parts[1] ?? "";
                              if (parseInt(t1Str, 10) > gp) t1Str = gp.toString();
                              if (parseInt(t2Str, 10) > gp) t2Str = gp.toString();
                              return { t1: t1Str, t2: t2Str };
                            });
                            setEditScore({ matchId: m.id, side: m.winner_side ?? 1, sets: hist.join(", "), bestOfSets: bo, goldenPoint: gp, pointsToWin: ptw, setsData });
                          }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition">
                            <Unlock className="w-3 h-3" /> Edit
                          </button>
                        )}

                        {/* Spacer to push secondary actions right */}
                        <div className="flex-1" />

                        {!isByeMatch && m.status === "scheduled" && (
                          <button
                            disabled={remindSendingId === m.id}
                            onClick={async () => {
                              setRemindSendingId(m.id);
                              try {
                                const { error } = await supabase.functions.invoke("match-notifier", { body: { match_id: m.id, type: "manual" } });
                                if (error) throw error;
                                toast.success("Reminder sent!");
                                setRemindSentMap((prev) => ({ ...prev, [m.id]: true }));
                                setTimeout(() => {
                                  setRemindSentMap((prev) => ({ ...prev, [m.id]: false }));
                                }, 3000);
                              } catch (e: any) {
                                toast.error(e.message ?? "Failed to send reminder");
                              } finally {
                                setRemindSendingId(null);
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                          >
                            {remindSendingId === m.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                                <span>Sending...</span>
                              </>
                            ) : remindSentMap[m.id] ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-black">Sent!</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3 h-3 text-amber-500" />
                                <span>Remind</span>
                              </>
                            )}
                          </button>
                        )}
                        {!isByeMatch && (
                          <>
                            <button onClick={() => {
                              let localAt = "";
                              if (m.scheduled_at) {
                                const d = new Date(m.scheduled_at);
                                const pad = (n: number) => n.toString().padStart(2, '0');
                                localAt = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                              }
                              setEditSchedule({ matchId: m.id, court: m.court_number ?? "", at: localAt });
                            }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                              <CalendarDays className="w-3 h-3" /> Schedule
                            </button>
                            <button onClick={() => { window.location.href = `${import.meta.env.BASE_URL}tv/camera/${m.id}`; }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition">
                              <Camera className="w-3 h-3" /> Camera
                            </button>
                          </>
                        )}
                      </div>

                      {/* Admin-only row */}
                      {isMasterAdmin && !isByeMatch && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-dashed border-slate-200/60 dark:border-slate-700/40">
                          {(isMasterAdmin || session?.user?.id === m.umpired_by) && m.status !== "completed" && (
                            <button onClick={() => setAssignUmpire({ matchId: m.id, umpireId: m.umpired_by ?? "" })}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                              <Users className="w-3 h-3" /> Umpire
                            </button>
                          )}

                          {m.status !== "scheduled" && (
                            <button onClick={async () => {
                              if (!confirm("Reset this match to Scheduled? This wipes score and status.")) return;
                              setActingOn(m.id);
                              const prev = { status: m.status, score: m.score, sets_history: m.sets_history, winner_side: m.winner_side };
                              const { error } = await supabase.from("tournament_matches").update({ status: "scheduled", score: null, sets_history: [], winner_side: null }).eq("id", m.id);
                              setActingOn(null);
                              if (error) { toast.error(error.message); return; }
                              toast.success("Match reset to Scheduled", {
                                action: { label: "Undo", onClick: async () => {
                                  await supabase.from("tournament_matches").update(prev).eq("id", m.id);
                                  const res = await supabase.from("tournament_matches").select("*").eq("tournament_id", tournament.id).order("round").order("match_number");
                                  if (!res.error) setMatches((res.data as TournamentMatch[]) ?? []);
                                }},
                                duration: 5000
                              });
                              const res = await supabase.from("tournament_matches").select("*").eq("tournament_id", tournament.id).order("round").order("match_number");
                              if (!res.error) setMatches((res.data as TournamentMatch[]) ?? []);
                            }}
                              disabled={busy}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition">
                              <RotateCcw className="w-3 h-3" /> Reset
                            </button>
                          )}
                          <div className="flex-1" />
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Status</span>
                            <select
                              value={m.status}
                              onChange={async (e) => {
                                const newStatus = e.target.value;
                                if (newStatus === m.status) return;
                                if (!confirm(`Force change to ${newStatus.toUpperCase()}?`)) return;
                                setActingOn(m.id);
                                const prev = { status: m.status };
                                const { error } = await supabase.from("tournament_matches").update({ status: newStatus }).eq("id", m.id);
                                setActingOn(null);
                                if (error) { toast.error(error.message); return; }
                                toast.success("Status updated", {
                                  action: { label: "Undo", onClick: async () => {
                                    await supabase.from("tournament_matches").update(prev).eq("id", m.id);
                                    const res = await supabase.from("tournament_matches").select("*").eq("tournament_id", tournament.id).order("round").order("match_number");
                                    if (!res.error) setMatches((res.data as TournamentMatch[]) ?? []);
                                  }},
                                  duration: 5000
                                });
                                const res = await supabase.from("tournament_matches").select("*").eq("tournament_id", tournament.id).order("round").order("match_number");
                                if (!res.error) setMatches((res.data as TournamentMatch[]) ?? []);
                              }}
                              disabled={busy}
                              className="bg-transparent border border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase text-muted-foreground rounded-lg px-2 py-1 outline-none transition cursor-pointer"
                            >
                              <option value="scheduled">Scheduled</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                              <option value="walkover">Walkover</option>
                            </select>
                          </div>
                        </div>
                      )}
                      {isByeMatch && m.status !== "completed" && isMasterAdmin && (
                        <button onClick={async () => {
                          setActingOn(m.id);
                          const wSide = m.team1_label === "BYE" ? 2 : 1;
                          const { error } = await supabase.from("tournament_matches").update({ status: "completed", winner_side: wSide, score: "BYE" }).eq("id", m.id);
                          setActingOn(null);
                          if (error) { toast.error(error.message); return; }
                          toast.success("BYE match restored");
                          const res = await supabase.from("tournament_matches").select("*").eq("tournament_id", tournament.id).order("round").order("match_number");
                          if (!res.error) setMatches((res.data as TournamentMatch[]) ?? []);
                        }}
                          disabled={busy}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-primary/15 dark:bg-primary/40 text-primary hover:bg-primary/25 transition">
                          <RotateCcw className="w-3 h-3" /> Restore BYE
                        </button>
                      )}
                    </div>

                    {/* Inline score entry */}
                    {isEditing && (function() {
                      const sd = editScore!.setsData;
                      const setsStr = sd.filter(s => s.t1 !== "" && s.t2 !== "").map(s => `${s.t1}-${s.t2}`).join(", ");
                      const autoWinner = autoWinnerFromSets(setsStr, editScore!.bestOfSets);
                      const updateSet = (i: number, field: "t1" | "t2", val: string) => {
                        let numStr = val.replace(/\D/g, "");
                        if (numStr) {
                          const num = parseInt(numStr, 10);
                          if (num > editScore!.goldenPoint) numStr = editScore!.goldenPoint.toString();
                        }
                        const next = sd.map((s, idx) => idx === i ? { ...s, [field]: numStr } : s);
                        const nextStr = next.filter(s => s.t1 !== "" && s.t2 !== "").map(s => `${s.t1}-${s.t2}`).join(", ");
                        const auto = autoWinnerFromSets(nextStr, editScore!.bestOfSets);
                        setEditScore((p) => p && ({ ...p, setsData: next, sets: nextStr, ...(auto ? { side: auto } : {}) }));
                      };
                      return (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                          {/* Scoring rules indicator */}
                          <div className="flex items-center justify-center gap-2 mb-1 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-slate-50 dark:bg-slate-800/50 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700/50">
                            <span title="Points required to win a set">Win at {editScore!.pointsToWin}</span>
                            <span className="opacity-30">•</span>
                            <span title="Best of X sets">Best of {editScore!.bestOfSets}</span>
                            <span className="opacity-30">•</span>
                            <span title="Maximum points possible (Golden Point)">GP {editScore!.goldenPoint}</span>
                          </div>
                          {/* Header row */}
                          <div className="grid grid-cols-[3rem_1fr_1.5rem_1fr] gap-x-2 items-center">
                            <div />
                            <div className="text-center text-[10px] font-black uppercase tracking-wider text-muted-foreground dark:text-muted-foreground px-1">
                              {(function() {
                                const l = m.team1_label ?? "Team 1";
                                if (!l.includes("&")) return <div className="break-words whitespace-normal leading-[1.1]">{l}</div>;
                                const parts = l.split("&");
                                return (
                                  <div className="flex flex-col items-center leading-[1.1]">
                                    <span className="break-words whitespace-normal w-full">{parts[0].trim()}</span>
                                    <span className="text-[8px] opacity-40 lowercase my-0.5">and</span>
                                    <span className="break-words whitespace-normal w-full">{parts[1].trim()}</span>
                                  </div>
                                );
                              })()}
                            </div>
                            <div />
                            <div className="text-center text-[10px] font-black uppercase tracking-wider text-muted-foreground dark:text-muted-foreground px-1">
                              {(function() {
                                const l = m.team2_label ?? "Team 2";
                                if (!l.includes("&")) return <div className="break-words whitespace-normal leading-[1.1]">{l}</div>;
                                const parts = l.split("&");
                                return (
                                  <div className="flex flex-col items-center leading-[1.1]">
                                    <span className="break-words whitespace-normal w-full">{parts[0].trim()}</span>
                                    <span className="text-[8px] opacity-40 lowercase my-0.5">and</span>
                                    <span className="break-words whitespace-normal w-full">{parts[1].trim()}</span>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                          {/* Per-set rows */}
                          {sd.map((s, i) => {
                            const setsBeforeStr = sd.slice(0, i).filter(prev => prev.t1 !== "" && prev.t2 !== "").map(prev => `${prev.t1}-${prev.t2}`).join(",");
                            const isAlreadyWon = autoWinnerFromSets(setsBeforeStr, editScore!.bestOfSets) !== null;
                            const prevFilled = i === 0 || (sd[i - 1].t1 !== "" && sd[i - 1].t2 !== "");
                            const isDisabled = !prevFilled || isAlreadyWon;

                            const t1n = parseInt(s.t1), t2n = parseInt(s.t2);
                            const t1Won = !isNaN(t1n) && !isNaN(t2n) && t1n > t2n;
                            const t2Won = !isNaN(t1n) && !isNaN(t2n) && t2n > t1n;
                            return (
                              <div key={i} className={`grid grid-cols-[3rem_1fr_1.5rem_1fr] gap-x-2 items-center ${isDisabled ? "opacity-40 pointer-events-none grayscale" : ""}`}>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">G{i + 1}</span>
                                <input
                                  type="text" inputMode="numeric" value={s.t1}
                                  onChange={(e) => updateSet(i, "t1", e.target.value)}
                                  disabled={isDisabled}
                                  placeholder="—"
                                  className={`text-center font-black text-base rounded-xl border-2 py-2 outline-none transition w-full
                                    ${t1Won ? "border-primary bg-primary/10 dark:bg-primary/30 text-primary dark:text-primary/70"
                                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-foreground"}
                                    focus:border-primary`}
                                />
                                <span className="text-center text-xs font-bold text-muted-foreground">–</span>
                                <input
                                  type="text" inputMode="numeric" value={s.t2}
                                  onChange={(e) => updateSet(i, "t2", e.target.value)}
                                  disabled={isDisabled}
                                  placeholder="—"
                                  className={`text-center font-black text-base rounded-xl border-2 py-2 outline-none transition w-full
                                    ${t2Won ? "border-primary bg-primary/10 dark:bg-primary/30 text-primary dark:text-primary/70"
                                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-foreground"}
                                    focus:border-primary`}
                                />
                              </div>
                            );
                          })}
                          {/* Winner row */}
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground shrink-0">Winner</span>
                            {autoWinner ? (
                              <span className="flex items-center gap-1.5 text-xs font-black text-primary dark:text-primary">
                                <Trophy className="w-3 h-3" />
                                {editScore!.side === 1 ? (m.team1_label ?? "Team 1") : (m.team2_label ?? "Team 2")}
                                <span className="text-muted-foreground dark:text-muted-foreground font-normal">(auto-detected)</span>
                              </span>
                            ) : (
                              <select value={editScore!.side} onChange={(e) => setEditScore((p) => p && ({ ...p, side: parseInt(e.target.value) as 1 | 2 }))}
                                className="text-sm px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-1 focus:ring-primary">
                                <option value={1}>{m.team1_label ?? "Team 1"}</option>
                                <option value={2}>{m.team2_label ?? "Team 2"}</option>
                              </select>
                            )}
                          </div>
                          {/* Actions */}
                          <div className="flex gap-2 pt-1">
                            <button onClick={submitEditScore}
                              className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary text-primary-foreground text-xs font-black transition">
                              Save
                            </button>
                            <button onClick={() => setEditScore(null)} className="text-xs text-muted-foreground hover:text-muted-foreground transition">Cancel</button>
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
                            {(function() {
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
                          <button onClick={saveSchedule} className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-foreground text-xs font-black transition">Save</button>
                          <button onClick={() => setEditSchedule(null)} className="text-xs text-muted-foreground hover:text-muted-foreground transition">Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Inline Umpire Assign */}
                    {assignUmpire?.matchId === m.id && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <div>
                          <label className={labelCls}><Users className="w-3 h-3 inline mr-1" />Assign Umpire</label>
                          <div className="mt-1">
                            <PlayerSelect
                              value={assignUmpire.umpireId}
                              onChange={(v) => setAssignUmpire(p => p ? { ...p, umpireId: v } : null)}
                              players={allPlayers ?? []}
                              placeholder="Select an umpire..."
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveUmpire} className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-foreground text-xs font-black transition">Save</button>
                          <button onClick={() => setAssignUmpire(null)} className="text-xs text-muted-foreground hover:text-muted-foreground transition">Cancel</button>
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
                <h3 className="font-black text-slate-800 dark:text-foreground text-base">Bulk Schedule — {activeCategory}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">One match per line. Supported text formats:</p>
                <div className="mt-1 text-xs text-muted-foreground font-mono space-y-0.5">
                  <p>MS_QF_01: Court 3, 2026-06-30 10:00</p>
                  <p>MS_QF_02 court=4 date=2026-06-30 time=11:30</p>
                  <p>MS_SF_01, Court 1, 30/06/2026 14:00</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadScheduleTemplate}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black text-muted-foreground hover:text-blue-600 hover:border-blue-400 transition">
                  <Download className="w-3.5 h-3.5" /> CSV Template
                </button>
                <button onClick={() => setShowBulkSchedule(false)} className="text-muted-foreground hover:text-muted-foreground transition">
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
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-foreground text-xs font-black transition">
                Preview
              </button>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-blue-500 transition">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV</span>
                <input type="file" accept=".csv" className="hidden"
                  onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleScheduleCSV(f); e.target.value = ""; }} />
              </label>
            </div>

            {bulkPreview.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-4 gap-0 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-black text-muted-foreground uppercase tracking-wider text-[10px]">
                  <span>Match</span><span>Court</span><span>Date & Time</span><span>Status</span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {bulkPreview.map((row, i) => (
                    <div key={i} className={`grid grid-cols-4 gap-0 px-3 py-2 border-t border-slate-100 dark:border-slate-800 ${!row.found ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                      <span className="font-bold text-muted-foreground dark:text-slate-300">{row.matchCode}</span>
                      <span className="text-muted-foreground dark:text-muted-foreground">{row.court || <span className="text-slate-300">—</span>}</span>
                      <span className="text-muted-foreground dark:text-muted-foreground">{row.at ? new Date(row.at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : <span className="text-slate-300">—</span>}</span>
                      <span className={row.found ? "text-primary font-bold" : "text-red-500 font-bold"}>
                        {row.found ? "✓ Found" : "✗ Not found"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={saveBulkSchedule}
                disabled={bulkSaving || bulkPreview.length === 0 || bulkPreview.every((r) => !r.found)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-foreground text-xs font-black transition disabled:opacity-40 disabled:cursor-not-allowed">
                {bulkSaving ? "Saving…" : `Save ${bulkPreview.filter((r) => r.found).length} Match${bulkPreview.filter((r) => r.found).length !== 1 ? "es" : ""}`}
              </button>
              <button onClick={() => { setShowBulkSchedule(false); setBulkText(""); setBulkPreview([]); }}
                className="text-xs text-muted-foreground hover:text-muted-foreground transition">
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

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const categories = [...new Set(matches.map((m) => m.category))];

  return (
    <div className="space-y-5">
      {tournament.status === "completed" && (
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-800 dark:text-foreground">Archive Tournament</h3>
              <p className="text-sm text-muted-foreground mt-1">Freeze all results and make this a historical record. Cannot be undone.</p>
            </div>
            <button onClick={archive} disabled={archiving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-foreground font-black transition disabled:opacity-50">
              {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              Archive
            </button>
          </div>
        </div>
      )}

      {tournament.status === "archived" && (
        <div className="flex flex-col items-center gap-3 py-2">
          <span className="text-xs font-black text-amber-600 uppercase tracking-widest px-3 py-1.5 bg-amber-100 dark:bg-amber-950/40 rounded-full">
            Archived {tournament.archived_at ? new Date(tournament.archived_at).toLocaleDateString() : ""}
          </span>
          {isMasterAdmin && (
            <button onClick={async () => {
              if (!confirm(`Unarchive "${tournament.name}"?`)) return;
              setArchiving(true);
              const { error } = await supabase.from("tournaments").update({ status: "completed", archived_at: null }).eq("id", tournament.id);
              if (error) { toast.error(error.message); setArchiving(false); return; }
              toast.success("Tournament unarchived");
              onArchived();
            }} disabled={archiving} className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-black px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50">
              {archiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Unarchive
            </button>
          )}
        </div>
      )}

      {/* Full fixture list */}
      {categories.map((cat) => {
        const catMatches = matches.filter((m) => m.category === cat);
        const rounds = [...new Set(catMatches.map((m) => m.round))].sort((a, b) => a - b);
        return (
          <div key={cat} className={cardCls}>
            <h3 className="font-black text-slate-800 dark:text-foreground mb-4">{cat} — Full Fixtures</h3>
            <div className="space-y-4">
              {rounds.map((round) => {
                const roundMatches = catMatches.filter((m) => m.round === round);
                return (
                  <div key={round}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{roundMatches[0]?.round_name}</p>
                    <div className="space-y-2">
                      {roundMatches.map((m) => (
                        <div key={m.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black text-muted-foreground">{m.match_code}</span>
                            <MatchStatusChip match={m} />
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
          <p className="text-muted-foreground">No matches recorded yet.</p>
        </div>
      )}
    </div>
  );
}
