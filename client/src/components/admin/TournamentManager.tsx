import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/hooks/usePlayers";
import { generateSingleElimBracket } from "@/lib/bracketGenerator";
import { MatchScoreDisplay } from "@/components/tournament/MatchScoreDisplay";
import {
  Loader2, Save, Trophy, Users, Swords, Archive, Plus, X, Search,
  ChevronDown, ChevronUp, Lock, Unlock, Play, SkipForward, Settings2,
  CalendarDays, MapPin
} from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"setup" | "participants" | "bracket" | "archive">("setup");
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
    setActiveTab("setup");
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
            <select
              value={selected?.id ?? ""}
              onChange={(e) => {
                const t = tournaments.find((t) => t.id === e.target.value);
                if (t) { setSelected(t); setActiveTab("setup"); }
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
                onClick={() => setActiveTab(tab)}
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
    await load();
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

  const hasMatches = async () => {
    const { count } = await supabase.from("tournament_matches").select("id", { count: "exact", head: true }).eq("tournament_id", tournament.id);
    return (count ?? 0) > 0;
  };

  const generateBracket = async () => {
    if (await hasMatches()) {
      if (!confirm("This will delete existing bracket matches and regenerate. Continue?")) return;
      await supabase.from("tournament_matches").delete().eq("tournament_id", tournament.id);
    }
    const allRows = [];
    for (const [cat, parts] of Object.entries(participants)) {
      if (parts.length < 2) continue;
      const mapped = parts.map((p) => ({
        playerId: p.player_id,
        partnerId: p.partner_id,
        displayName: p.display_name ?? (allPlayers?.find((pl) => pl.id === p.player_id)?.full_name ?? "Unknown"),
        seed: p.seed ?? 99,
      }));
      allRows.push(...generateSingleElimBracket(mapped, cat, tournament.id));
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

        const filteredPlayers = (allPlayers ?? []).filter(
          (p) => !p.is_guest && p.full_name.toLowerCase().includes(catSearch.toLowerCase())
        );
        const filteredPartners = (allPlayers ?? []).filter(
          (p) => !p.is_guest && p.full_name.toLowerCase().includes(catPartnerSearch.toLowerCase())
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
                    <div key={p.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <input type="number" min={1}
                        value={p.seed ?? i + 1}
                        onChange={(e) => updateSeed(p.id, parseInt(e.target.value))}
                        className="w-12 text-center text-sm font-black rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 outline-none" />
                      <div className="flex-1 text-sm font-bold text-slate-800 dark:text-white">
                        {p.display_name ?? player?.full_name ?? "Unknown"}
                        {doubles && (partner || p.display_name) && (
                          <span className="text-slate-400 font-medium"> & {partner?.full_name ?? "partner"}</span>
                        )}
                      </div>
                      <button onClick={() => removeParticipant(p.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 transition"><X className="w-4 h-4" /></button>
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
                ) : (
                  <button onClick={() => setAdding(cat)}
                    className="w-full py-2 text-xs font-black rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:border-emerald-400 hover:text-emerald-600 transition flex items-center justify-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Participant
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex justify-end">
        <button onClick={generateBracket}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black shadow-lg transition">
          <Swords className="w-4 h-4" /> Generate Bracket
        </button>
      </div>
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
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<{ matchId: string; side: 1 | 2; sets: string } | null>(null);
  const [editSchedule, setEditSchedule] = useState<{ matchId: string; court: string; at: string } | null>(null);

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

  const submitEditScore = async () => {
    if (!editScore) return;
    const setsArr = editScore.sets.split(",").map((s) => s.trim()).filter(Boolean);
    const fn = isMasterAdmin ? "admin_edit_tournament_match" : "submit_tournament_match";
    const params = isMasterAdmin
      ? { p_match_id: editScore.matchId, p_winner_side: editScore.side, p_score: editScore.sets, p_sets: setsArr }
      : { p_match_id: editScore.matchId, p_winner_side: editScore.side, p_score: editScore.sets, p_sets: setsArr, p_umpire_id: null };
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
          <button onClick={() => setShowRules((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-600 dark:text-slate-300 hover:border-emerald-400 transition">
            <Settings2 className="w-3.5 h-3.5" /> Round Rules
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

      {/* Match cards by round */}
      {rounds.map((round) => {
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
                            <button onClick={() => setEditScore({ matchId: m.id, side: 1, sets: "" })}
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
                          <button onClick={() => setEditScore({ matchId: m.id, side: m.winner_side ?? 1, sets: m.sets_history?.join(", ") ?? "" })}
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
                    {isEditing && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="flex gap-2">
                          <div>
                            <label className={labelCls}>Winner</label>
                            <select value={editScore!.side} onChange={(e) => setEditScore((p) => p && ({ ...p, side: parseInt(e.target.value) as 1 | 2 }))}
                              className="text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-1 focus:ring-emerald-500">
                              <option value={1}>{m.team1_label ?? "Team 1"}</option>
                              <option value={2}>{m.team2_label ?? "Team 2"}</option>
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className={labelCls}>Sets (comma-separated)</label>
                            <input value={editScore!.sets}
                              onChange={(e) => setEditScore((p) => p && ({ ...p, sets: e.target.value }))}
                              placeholder="21-15, 21-18"
                              className={inputCls} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={submitEditScore}
                            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition">
                            Save
                          </button>
                          <button onClick={() => setEditScore(null)} className="text-xs text-slate-400 hover:text-slate-600 transition">Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Inline schedule */}
                    {isScheduling && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="flex gap-2">
                          <div>
                            <label className={labelCls}><MapPin className="w-3 h-3 inline mr-1" />Court</label>
                            <input value={editSchedule!.court} onChange={(e) => setEditSchedule((p) => p && ({ ...p, court: e.target.value }))}
                              placeholder="Court 1" className="w-28 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none" />
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
