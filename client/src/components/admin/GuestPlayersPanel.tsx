import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  UserPlus, Loader2, RefreshCw, Trash2, Ghost, CheckCircle,
  Trophy, ShieldCheck, AlertTriangle, Link2, Search, ArrowRight, Tag,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { InfoModal } from "@/components/InfoModal";

interface ExternalLabel {
  label: string;
  matchCount: number;
  tournaments: string[];
}

interface GuestRow {
  id: string;
  full_name: string;
  gender: string | null;
  elo_rating: number | null;
  total_friendly_matches: number | null;
  created_at: string;
}

interface RealPlayer {
  id: string;
  full_name: string;
  department?: string | null;
}

interface PendingGuestMatch {
  id: string;
  created_at: string;
  score: string;
  category: string;
  winner_id: string;
  player1: { id: string; full_name: string; is_guest?: boolean } | null;
  player2: { id: string; full_name: string; is_guest?: boolean } | null;
  partner1?: { id: string; full_name: string; is_guest?: boolean } | null;
  partner2?: { id: string; full_name: string; is_guest?: boolean } | null;
}

export function GuestPlayersPanel() {
  const { session } = useAuth();
  const { confirm } = useConfirm();
  const { recordAction } = useAdminHistory();
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [pending, setPending] = useState<PendingGuestMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "">("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Inline claim state
  const [selectedGuest, setSelectedGuest] = useState<GuestRow | null>(null);
  const [realPlayers, setRealPlayers] = useState<RealPlayer[]>([]);
  const [claimSearch, setClaimSearch] = useState("");
  const [selectedReal, setSelectedReal] = useState<RealPlayer | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [realPlayersLoaded, setRealPlayersLoaded] = useState(false);

  // Link external labels state
  const [externalLabels, setExternalLabels] = useState<ExternalLabel[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<ExternalLabel | null>(null);
  const [labelSearch, setLabelSearch] = useState("");
  const [labelPlayer, setLabelPlayer] = useState<RealPlayer | null>(null);
  const [labelPlayerSearch, setLabelPlayerSearch] = useState("");
  const [linking, setLinking] = useState(false);
  const [externalFilter, setExternalFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: g }, { data: m }] = await Promise.all([
      supabase
        .from("players")
        .select("id, full_name, gender, elo_rating, total_friendly_matches, created_at")
        .eq("is_guest", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("matches")
        .select(
          "id, created_at, score, category, winner_id, " +
            "player1:players!player1_id(id,full_name,is_guest), " +
            "player2:players!player2_id(id,full_name,is_guest), " +
            "partner1:players!team1_partner_id(id,full_name,is_guest), " +
            "partner2:players!team2_partner_id(id,full_name,is_guest)",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    setGuests((g as GuestRow[]) ?? []);
    const guestMatches = ((m as any[]) ?? []).filter((row) =>
      [row.player1, row.player2, row.partner1, row.partner2].some((p) => p?.is_guest),
    );
    setPending(guestMatches as PendingGuestMatch[]);
    setLoading(false);
  }, []);

  const loadRealPlayers = useCallback(async () => {
    if (realPlayersLoaded) return;
    const { data } = await supabase
      .from("players")
      .select("id, full_name, department")
      .eq("is_approved", true)
      .or("is_guest.is.null,is_guest.eq.false")
      .order("full_name");
    setRealPlayers((data as RealPlayer[]) ?? []);
    setRealPlayersLoaded(true);
  }, [realPlayersLoaded]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadRealPlayers(); }, [loadRealPlayers]);

  const logAction = async (action: string) => {
    const email = session?.user?.email || "admin";
    await supabase.from("admin_logs").insert({ admin_email: email, action, created_at: new Date().toISOString() }).then(() => {});
  };

  const createGuest = async () => {
    const clean = name.trim();
    if (!clean) { toast.error("Enter a name for the guest"); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_guest_player", { p_full_name: clean, p_gender: gender || null });
      if (error) throw error;
      toast.success(`Guest "${clean}" created`);
      await logAction(`Created guest player "${clean}"${gender ? ` (${gender})` : ""}`);
      setName(""); setGender("");
      if (data) setGuests((prev) => [data as GuestRow, ...prev]);
      else load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create guest");
    } finally { setCreating(false); }
  };

  const deleteGuest = async (g: GuestRow) => {
    if (!(await confirm({ title: "Delete Guest", description: `Delete guest "${g.full_name}"? This cannot be undone.`, confirmVariant: "danger" }))) return;
    setBusyId(g.id);
    try {
      const { error } = await supabase.rpc("delete_guest_player", { p_guest_id: g.id });
      if (error) throw error;
      toast.success("Guest deleted");
      await logAction(`Deleted guest player "${g.full_name}"`);
      setGuests((prev) => prev.filter((x) => x.id !== g.id));
      if (selectedGuest?.id === g.id) setSelectedGuest(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete guest");
    } finally { setBusyId(null); }
  };

  const approveMatch = async (m: PendingGuestMatch) => {
    setBusyId(m.id);
    try {
      const { error } = await supabase.rpc("confirm_friendly_match", { match_uuid: m.id, confirmer_id: "umpire_bypass" });
      if (error) throw error;
      toast.success("Match approved — ELO applied");
      await logAction(`Approved guest match ${m.id}`);
      setPending((prev) => prev.filter((x) => x.id !== m.id));
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve match");
    } finally { setBusyId(null); }
  };

  const rejectMatch = async (m: PendingGuestMatch) => {
    if (!(await confirm({ title: "Reject Match", description: "Reject and delete this pending match?", confirmVariant: "danger" }))) return;
    setBusyId(m.id);
    try {
      const { error } = await supabase.from("matches").delete().eq("id", m.id);
      if (error) throw error;
      toast.success("Match rejected");
      await logAction(`Rejected guest match ${m.id}`);
      setPending((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err: any) {
      toast.error(err?.message || "Failed to reject match");
    } finally { setBusyId(null); }
  };

  const executeClaim = async () => {
    if (!selectedGuest || !selectedReal) return;
    const matchCount = selectedGuest.total_friendly_matches ?? 0;
    if (!(await confirm({
      title: "Link Matches",
      description: `Link all ${matchCount} match(es) from "${selectedGuest.full_name}" to "${selectedReal.full_name}"? This cannot be undone.`,
      confirmVariant: "danger",
      confirmLabel: "Link Matches",
    }))) return;
    setClaiming(true);
    try {
      const { error } = await supabase.rpc("claim_guest_player", { p_guest_id: selectedGuest.id, p_real_player_id: selectedReal.id });
      if (error) throw error;
      toast.success(`"${selectedGuest.full_name}" → "${selectedReal.full_name}" — ${matchCount} match(es) transferred.`);
      await logAction(`Claimed guest "${selectedGuest.full_name}" → "${selectedReal.full_name}" (${matchCount} matches)`);
      await recordAction({
        action_type: "delete",
        entity_type: "players",
        entity_id: selectedGuest.id,
        before_state: { is_guest: true, full_name: selectedGuest.full_name },
        after_state: { claimed_by: selectedReal.full_name, real_player_id: selectedReal.id },
        label: `Claimed guest "${selectedGuest.full_name}" → "${selectedReal.full_name}"`,
      });
      setGuests((prev) => prev.filter((x) => x.id !== selectedGuest.id));
      setSelectedGuest(null);
      setSelectedReal(null);
      setClaimSearch("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to claim guest");
    } finally { setClaiming(false); }
  };

  const sideName = (a?: { full_name: string } | null, b?: { full_name: string } | null) =>
    b ? `${a?.full_name} + ${b.full_name}` : a?.full_name ?? "—";

  const filteredReal = realPlayers.filter(
    (p) => !claimSearch || p.full_name.toLowerCase().includes(claimSearch.toLowerCase())
  ).slice(0, 30);

  return (
    <div className="space-y-6">
      {/* ── Create guest ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 sm:p-6">
        <h2 className="text-lg font-black text-slate-800 dark:text-foreground flex items-center gap-2 mb-1">
          <Ghost className="w-5 h-5 text-violet-500" /> Add Guest Player
          <InfoModal
            title="GUEST PLAYERS"
            items={[
              { badge: "LIMITS", title: "Invisible on Leaderboard", desc: "Guests are tracked for internal ELO math, but will never show up on the public leaderboard." },
              { badge: "CLAIM", title: "Claiming a Guest", desc: "If a guest later registers, select them on the left, search for their real account on the right, and click Link." },
            ]}
          />
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Create a profile for a visitor or non-member so their matches and ELO can be tracked.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createGuest()}
            placeholder="Guest name (e.g. Visitor John)"
            maxLength={60}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-on-accent outline-none focus:ring-2 focus:ring-violet-500"
          />
          <div className="flex gap-2">
            {(["Male", "Female"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setGender((g) => (g === opt ? "" : opt))}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition ${
                  gender === opt
                    ? "bg-violet-50 dark:bg-violet-900/30 border-violet-500 text-violet-700 dark:text-violet-300"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-muted-foreground"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <button
            onClick={createGuest}
            disabled={creating}
            className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Add
          </button>
        </div>
      </div>

      {/* ── Pending guest matches ─────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black text-slate-800 dark:text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" /> Matches Awaiting Approval
            {pending.length > 0 && (
              <span className="text-sm font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                {pending.length}
              </span>
            )}
          </h2>
          <button onClick={load} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-slate-800 dark:hover:text-on-accent transition px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
        ) : pending.length === 0 ? (
          <div className="text-center py-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <CheckCircle className="w-9 h-9 text-primary mx-auto mb-2" />
            <p className="text-sm font-bold text-muted-foreground">No guest matches awaiting approval.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((m) => {
              const isBusy = busyId === m.id;
              const displayScore = m.score?.split(" | ")[0]?.split(" [")[0] ?? m.score;
              return (
                <div key={m.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/40 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-black text-sm text-slate-800 dark:text-foreground truncate flex-1">{sideName(m.player1, m.partner1)}</span>
                    <div className="text-center shrink-0">
                      <div className="text-xs font-black font-mono text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">{displayScore}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{m.category || "Friendly"}</div>
                    </div>
                    <span className="font-black text-sm text-slate-800 dark:text-foreground truncate flex-1 text-right">{sideName(m.player2, m.partner2)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={isBusy} onClick={() => approveMatch(m)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary text-primary-foreground text-sm font-bold transition disabled:opacity-50">
                      {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                      Approve & apply ELO
                    </button>
                    <button disabled={isBusy} onClick={() => rejectMatch(m)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-muted-foreground hover:text-rose-600 hover:border-rose-300 text-sm font-bold transition disabled:opacity-50">
                      <Trash2 className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Guest Roster + Claim side by side ────────────────── */}
      <div>
        <h2 className="text-lg font-black text-slate-800 dark:text-foreground flex items-center gap-2 mb-3">
          <Ghost className="w-5 h-5 text-violet-500" /> Guest Roster
          {guests.length > 0 && (
            <span className="text-sm font-bold bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full">
              {guests.length}
            </span>
          )}
          {selectedGuest && (
            <span className="ml-2 text-sm font-bold text-violet-500">
              — Linking "{selectedGuest.full_name}"
            </span>
          )}
        </h2>

        {loading ? null : guests.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-sm font-bold text-muted-foreground">No guest players yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* LEFT: Guest list */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">
                Guest Players — click to link
              </p>
              {guests.map((g) => {
                const isSelected = selectedGuest?.id === g.id;
                const isBusy = busyId === g.id;
                return (
                  <div
                    key={g.id}
                    onClick={() => {
                      if (isSelected) { setSelectedGuest(null); setSelectedReal(null); setClaimSearch(""); }
                      else { setSelectedGuest(g); setSelectedReal(null); setClaimSearch(""); }
                    }}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all ${
                      isSelected
                        ? "bg-violet-50 dark:bg-violet-900/30 border-violet-400 dark:border-violet-600 shadow-md"
                        : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-violet-200 dark:bg-violet-800" : "bg-violet-100 dark:bg-violet-900/40"}`}>
                      <Ghost className={`w-4 h-4 ${isSelected ? "text-violet-700 dark:text-violet-300" : "text-violet-500"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-slate-800 dark:text-foreground truncate">
                        {g.full_name}
                        {g.gender && <span className="ml-2 text-[10px] font-bold uppercase text-muted-foreground">{g.gender}</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        ELO {g.elo_rating ?? 1200} · {g.total_friendly_matches ?? 0} match{(g.total_friendly_matches ?? 0) === 1 ? "" : "es"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isSelected && <Link2 className="w-4 h-4 text-violet-500" />}
                      <button
                        disabled={isBusy}
                        onClick={(e) => { e.stopPropagation(); deleteGuest(g); }}
                        title="Delete guest"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5 px-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Guests with match history can't be deleted — click a guest to link them to a real account.
              </p>
            </div>

            {/* RIGHT: Real player search */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
              {!selectedGuest ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center gap-3 text-muted-foreground">
                  <Link2 className="w-8 h-8 opacity-30" />
                  <p className="text-sm font-bold">Select a guest on the left to link them to a registered player</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Arrow header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5">
                      <Ghost className="w-3.5 h-3.5" /> {selectedGuest.full_name}
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    {selectedReal ? (
                      <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-black px-3 py-1 rounded-full">
                        {selectedReal.full_name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Search for real player →</span>
                    )}
                  </div>

                  {/* Search box */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      value={claimSearch}
                      onChange={(e) => { setClaimSearch(e.target.value); setSelectedReal(null); }}
                      placeholder="Type a name to search..."
                      autoFocus
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-on-accent outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  {/* Player results */}
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                    {claimSearch.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">Start typing to search registered players</p>
                    ) : filteredReal.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">No players found</p>
                    ) : filteredReal.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedReal(p)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm transition ${
                          selectedReal?.id === p.id
                            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 font-bold"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span className="font-bold">{p.full_name}</span>
                        {p.department && <span className="text-xs text-muted-foreground ml-2">· {p.department}</span>}
                      </button>
                    ))}
                  </div>

                  {/* Link button */}
                  <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => { setSelectedGuest(null); setSelectedReal(null); setClaimSearch(""); }}
                      className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-muted-foreground font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={executeClaim}
                      disabled={!selectedReal || claiming}
                      className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                      Link {selectedGuest.total_friendly_matches ?? 0} match{(selectedGuest.total_friendly_matches ?? 0) === 1 ? "" : "es"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Link External Players ─────────────────────────── */}
      <LinkExternalSection
        realPlayers={realPlayers}
        loadRealPlayers={loadRealPlayers}
        logAction={logAction}
      />
    </div>
  );
}

function LinkExternalSection({
  realPlayers,
  loadRealPlayers,
  logAction,
}: {
  realPlayers: RealPlayer[];
  loadRealPlayers: () => void;
  logAction: (a: string) => Promise<void>;
}) {
  const [labels, setLabels] = useState<ExternalLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<ExternalLabel | null>(null);
  const [filter, setFilter] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<RealPlayer | null>(null);
  const [linking, setLinking] = useState(false);

  const loadLabels = useCallback(async () => {
    setLoading(true);
    // Fetch all tournament_matches that have a label but no player linked
    const [{ data: t1 }, { data: t2 }, { data: tp }] = await Promise.all([
      supabase
        .from("tournament_matches")
        .select("team1_label, tournament_id, tournaments(name)")
        .not("team1_label", "is", null)
        .is("player1_id", null),
      supabase
        .from("tournament_matches")
        .select("team2_label, tournament_id, tournaments(name)")
        .not("team2_label", "is", null)
        .is("player2_id", null),
      supabase
        .from("tournament_participants")
        .select("display_name")
        .not("display_name", "is", null)
        .is("player_id", null),
    ]);

    const map = new Map<string, { count: number; tournaments: Set<string> }>();
    for (const row of (t1 ?? []) as any[]) {
      const label = row.team1_label as string;
      if (!label) continue;
      const e = map.get(label) ?? { count: 0, tournaments: new Set() };
      e.count++;
      if (row.tournaments?.name) e.tournaments.add(row.tournaments.name);
      map.set(label, e);
    }
    for (const row of (t2 ?? []) as any[]) {
      const label = row.team2_label as string;
      if (!label) continue;
      const e = map.get(label) ?? { count: 0, tournaments: new Set() };
      e.count++;
      if (row.tournaments?.name) e.tournaments.add(row.tournaments.name);
      map.set(label, e);
    }
    for (const row of (tp ?? []) as any[]) {
      const label = row.display_name as string;
      if (!label) continue;
      const e = map.get(label) ?? { count: 0, tournaments: new Set() };
      e.count++;
      map.set(label, e);
    }

    const list: ExternalLabel[] = [...map.entries()].map(([label, val]) => ({
      label,
      matchCount: val.count,
      tournaments: [...val.tournaments],
    })).sort((a, b) => a.label.localeCompare(b.label));

    setLabels(list);
    setLoading(false);
  }, []);

  useEffect(() => { loadLabels(); }, [loadLabels]);
  useEffect(() => { loadRealPlayers(); }, [loadRealPlayers]);

  const filteredLabels = useMemo(() =>
    labels.filter(l => !filter || l.label.toLowerCase().includes(filter.toLowerCase())),
    [labels, filter]
  );

  const filteredPlayers = useMemo(() =>
    realPlayers.filter(p => !playerSearch || p.full_name.toLowerCase().includes(playerSearch.toLowerCase())).slice(0, 30),
    [realPlayers, playerSearch]
  );

  const executeLink = async () => {
    if (!selectedLabel || !selectedPlayer) return;
    setLinking(true);
    try {
      const { data, error } = await (supabase.rpc as any)("link_label_to_player", {
        p_label: selectedLabel.label,
        p_player_id: selectedPlayer.id,
      });
      if (error) throw error;
      toast.success(`"${selectedLabel.label}" linked to "${selectedPlayer.full_name}" — ${data} slot(s) updated.`);
      await logAction(`Linked label "${selectedLabel.label}" → "${selectedPlayer.full_name}" (${data} slots)`);
      setLabels(prev => prev.filter(l => l.label !== selectedLabel.label));
      setSelectedLabel(null);
      setSelectedPlayer(null);
      setPlayerSearch("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to link");
    } finally { setLinking(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-black text-slate-800 dark:text-foreground flex items-center gap-2">
          <Tag className="w-5 h-5 text-sky-500" /> Link External Players
          {labels.length > 0 && (
            <span className="text-sm font-bold bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-full">
              {labels.length}
            </span>
          )}
        </h2>
        <button onClick={loadLabels} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-slate-800 dark:hover:text-on-accent transition px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        These players were entered as text labels in tournament matches. Link them to their registered profiles to credit their match history.
      </p>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : labels.length === 0 ? (
        <div className="text-center py-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <CheckCircle className="w-9 h-9 text-primary mx-auto mb-2" />
          <p className="text-sm font-bold text-muted-foreground">All external players are linked!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* LEFT: Label list */}
          <div className="space-y-2">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filter by name..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-on-accent outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {filteredLabels.map(l => {
                const isSelected = selectedLabel?.label === l.label;
                return (
                  <div
                    key={l.label}
                    onClick={() => { setSelectedLabel(isSelected ? null : l); setSelectedPlayer(null); setPlayerSearch(""); }}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all ${
                      isSelected
                        ? "bg-sky-50 dark:bg-sky-900/30 border-sky-400 dark:border-sky-600 shadow-md"
                        : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-black ${isSelected ? "bg-sky-200 dark:bg-sky-800 text-sky-700 dark:text-sky-200" : "bg-sky-100 dark:bg-sky-900/40 text-sky-500"}`}>
                      {l.label.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-slate-800 dark:text-foreground truncate">{l.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {l.matchCount} match{l.matchCount === 1 ? "" : "es"}
                        {l.tournaments.length > 0 && ` · ${l.tournaments.slice(0, 2).join(", ")}`}
                      </p>
                    </div>
                    {isSelected && <Link2 className="w-4 h-4 text-sky-500 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Player search */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
            {!selectedLabel ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center gap-3 text-muted-foreground">
                <Link2 className="w-8 h-8 opacity-30" />
                <p className="text-sm font-bold">Select a label on the left to link it to a registered player</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5">
                    <Tag className="w-3 h-3" /> {selectedLabel.label}
                  </span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  {selectedPlayer ? (
                    <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-black px-3 py-1 rounded-full">
                      {selectedPlayer.full_name}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Search for registered player →</span>
                  )}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={playerSearch}
                    onChange={e => { setPlayerSearch(e.target.value); setSelectedPlayer(null); }}
                    placeholder="Type name to search..."
                    autoFocus
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-on-accent outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                  {playerSearch.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">Start typing to search registered players</p>
                  ) : filteredPlayers.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">No players found</p>
                  ) : filteredPlayers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlayer(p)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition ${
                        selectedPlayer?.id === p.id
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 font-bold"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span className="font-bold">{p.full_name}</span>
                      {p.department && <span className="text-xs text-muted-foreground ml-2">· {p.department}</span>}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => { setSelectedLabel(null); setSelectedPlayer(null); setPlayerSearch(""); }}
                    className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-muted-foreground font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeLink}
                    disabled={!selectedPlayer || linking}
                    className="flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    Link {selectedLabel.matchCount} match{selectedLabel.matchCount === 1 ? "" : "es"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
