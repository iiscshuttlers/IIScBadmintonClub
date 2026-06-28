import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  UserPlus, Loader2, RefreshCw, Trash2, Ghost, CheckCircle,
  Trophy, ShieldCheck, AlertTriangle, Link2, X, Search,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { InfoModal } from "@/components/InfoModal";

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
  const { recordAction } = useAdminHistory();
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [pending, setPending] = useState<PendingGuestMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "">("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [claimGuest, setClaimGuest] = useState<GuestRow | null>(null);
  const [realPlayers, setRealPlayers] = useState<RealPlayer[]>([]);
  const [claimSearch, setClaimSearch] = useState("");
  const [selectedReal, setSelectedReal] = useState<RealPlayer | null>(null);
  const [claiming, setClaiming] = useState(false);

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
    // Only pending matches that actually involve a guest need admin approval.
    const guestMatches = ((m as any[]) ?? []).filter((row) =>
      [row.player1, row.player2, row.partner1, row.partner2].some(
        (p) => p?.is_guest,
      ),
    );
    setPending(guestMatches as PendingGuestMatch[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const logAction = async (action: string) => {
    const email = session?.user?.email || "admin";
    await supabase
      .from("admin_logs")
      .insert({ admin_email: email, action, created_at: new Date().toISOString() })
      .then(() => {});
  };

  const createGuest = async () => {
    const clean = name.trim();
    if (!clean) {
      toast.error("Enter a name for the guest");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_guest_player", {
        p_full_name: clean,
        p_gender: gender || null,
      });
      if (error) throw error;
      toast.success(`Guest "${clean}" created`);
      await logAction(`Created guest player "${clean}"${gender ? ` (${gender})` : ""}`);
      setName("");
      setGender("");
      if (data) setGuests((prev) => [data as GuestRow, ...prev]);
      else load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create guest");
    } finally {
      setCreating(false);
    }
  };

  const deleteGuest = async (g: GuestRow) => {
    if (!confirm(`Delete guest "${g.full_name}"? This cannot be undone.`)) return;
    setBusyId(g.id);
    try {
      const { error } = await supabase.rpc("delete_guest_player", { p_guest_id: g.id });
      if (error) throw error;
      toast.success("Guest deleted");
      await logAction(`Deleted guest player "${g.full_name}"`);
      setGuests((prev) => prev.filter((x) => x.id !== g.id));
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete guest");
    } finally {
      setBusyId(null);
    }
  };

  const approveMatch = async (m: PendingGuestMatch) => {
    setBusyId(m.id);
    try {
      // Guests can't log in to accept — admin finalises via the umpire bypass,
      // which applies ELO exactly like a normal confirmation.
      const { error } = await supabase.rpc("confirm_friendly_match", {
        match_uuid: m.id,
        confirmer_id: "umpire_bypass",
      });
      if (error) throw error;
      toast.success("Match approved — ELO applied");
      await logAction(`Approved guest match ${m.id}`);
      setPending((prev) => prev.filter((x) => x.id !== m.id));
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve match");
    } finally {
      setBusyId(null);
    }
  };

  const rejectMatch = async (m: PendingGuestMatch) => {
    if (!confirm("Reject and delete this pending match?")) return;
    setBusyId(m.id);
    try {
      const { error } = await supabase.from("matches").delete().eq("id", m.id);
      if (error) throw error;
      toast.success("Match rejected");
      await logAction(`Rejected guest match ${m.id}`);
      setPending((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err: any) {
      toast.error(err?.message || "Failed to reject match");
    } finally {
      setBusyId(null);
    }
  };

  const openClaimModal = async (g: GuestRow) => {
    setClaimGuest(g);
    setClaimSearch("");
    setSelectedReal(null);
    if (realPlayers.length === 0) {
      const { data } = await supabase
        .from("players")
        .select("id, full_name, department")
        .eq("is_approved", true)
        .is("is_guest", null)
        .order("full_name");
      setRealPlayers((data as RealPlayer[]) ?? []);
    }
  };

  const executeClaim = async () => {
    if (!claimGuest || !selectedReal) return;
    const matchCount = claimGuest.total_friendly_matches ?? 0;
    if (!confirm(`Link all ${matchCount} match(es) from "${claimGuest.full_name}" to "${selectedReal.full_name}"? This cannot be undone.`)) return;
    setClaiming(true);
    try {
      const { error } = await supabase.rpc("claim_guest_player", {
        p_guest_id: claimGuest.id,
        p_real_player_id: selectedReal.id,
      });
      if (error) throw error;
      toast.success(`Guest "${claimGuest.full_name}" claimed by "${selectedReal.full_name}". ${matchCount} match(es) transferred.`);
      await logAction(`Claimed guest "${claimGuest.full_name}" → "${selectedReal.full_name}" (${matchCount} matches)`);
      await recordAction({
        action_type: "delete",
        entity_type: "players",
        entity_id: claimGuest.id,
        before_state: { is_guest: true, full_name: claimGuest.full_name },
        after_state: { claimed_by: selectedReal.full_name, real_player_id: selectedReal.id },
        label: `Claimed guest "${claimGuest.full_name}" → "${selectedReal.full_name}"`,
      });
      setGuests((prev) => prev.filter((x) => x.id !== claimGuest.id));
      setClaimGuest(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to claim guest");
    } finally {
      setClaiming(false);
    }
  };

  const sideName = (
    a?: { full_name: string } | null,
    b?: { full_name: string } | null,
  ) => (b ? `${a?.full_name} + ${b.full_name}` : a?.full_name ?? "—");

  return (
    <div className="space-y-8">
      {/* ── Create guest ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 sm:p-6">
        <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 mb-1">
          <Ghost className="w-5 h-5 text-violet-500" /> Add Guest Player
          <InfoModal
            title="GUEST PLAYERS"
            items={[
              { badge: "LIMITS", title: "Invisible on Leaderboard", desc: "Guests are tracked for internal ELO math, but will never show up on the public leaderboard." },
              { badge: "CLAIM", title: "Claiming a Guest", desc: "If a guest later registers for an official account, use the 'Claim Player' action to transfer their historical matches to their new account." }
            ]}
          />
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          Create a profile for a visitor or non-member so their matches and ELO can be tracked.
          They appear only in match-logging dropdowns — not the public leaderboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createGuest()}
            placeholder="Guest name (e.g. Visitor John)"
            maxLength={60}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
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
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500"
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
        <p className="text-[11px] text-slate-400 mt-2">
          Gender is optional but recommended — it's needed for accurate cross-gender ELO scaling.
        </p>
      </div>

      {/* ── Pending guest matches ────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" /> Matches Awaiting Approval
            {pending.length > 0 && (
              <span className="text-sm font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                {pending.length}
              </span>
            )}
          </h2>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
          </div>
        ) : pending.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-500">No guest matches awaiting approval.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((m) => {
              const isBusy = busyId === m.id;
              const displayScore = m.score?.split(" | ")[0]?.split(" [")[0] ?? m.score;
              return (
                <div
                  key={m.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/40 p-4"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-black text-sm text-slate-800 dark:text-white truncate flex-1">
                      {sideName(m.player1, m.partner1)}
                    </span>
                    <div className="text-center shrink-0">
                      <div className="text-xs font-black font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                        {displayScore}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                        {m.category || "Friendly"}
                      </div>
                    </div>
                    <span className="font-black text-sm text-slate-800 dark:text-white truncate flex-1 text-right">
                      {sideName(m.player2, m.partner2)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={isBusy}
                      onClick={() => approveMatch(m)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                      Approve & apply ELO
                    </button>
                    <button
                      disabled={isBusy}
                      onClick={() => rejectMatch(m)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:border-rose-300 text-sm font-bold transition disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Guest roster ─────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 mb-3">
          <Ghost className="w-5 h-5 text-violet-500" /> Guest Roster
          {guests.length > 0 && (
            <span className="text-sm font-bold bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full">
              {guests.length}
            </span>
          )}
        </h2>

        {loading ? null : guests.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-500">No guest players yet.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {guests.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3"
              >
                <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                  <Ghost className="w-4 h-4 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-slate-800 dark:text-white truncate">
                    {g.full_name}
                    {g.gender && (
                      <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">{g.gender}</span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    ELO {g.elo_rating ?? 1200} · {g.total_friendly_matches ?? 0} match
                    {(g.total_friendly_matches ?? 0) === 1 ? "" : "es"}
                  </p>
                </div>
                {(claimGuest?.id !== g.id) && (
                  <button
                    disabled={busyId === g.id}
                    onClick={() => openClaimModal(g)}
                    title="Claim: link to a real player account"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-xs font-bold transition disabled:opacity-50"
                  >
                    <Link2 className="w-3.5 h-3.5" /> Claim
                  </button>
                )}
                <button
                  disabled={busyId === g.id}
                  onClick={() => deleteGuest(g)}
                  title="Delete guest"
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition disabled:opacity-50"
                >
                  {busyId === g.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Guests with match history can't be deleted — use "Claim" to link them to a real player account and transfer their match history.
        </p>
      </div>

      {/* ── Claim modal ──────────────────────────────────────── */}
      {claimGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Link2 className="w-5 h-5 text-violet-500" /> Claim Guest Account
              </h3>
              <button onClick={() => setClaimGuest(null)} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="bg-violet-50 dark:bg-violet-900/20 rounded-2xl p-4">
              <p className="text-sm font-bold text-violet-800 dark:text-violet-300">
                <Ghost className="w-4 h-4 inline mr-1" />
                {claimGuest.full_name}
              </p>
              <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                {claimGuest.total_friendly_matches ?? 0} match(es) will be transferred to the selected real player.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Select Real Player</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={claimSearch}
                  onChange={(e) => { setClaimSearch(e.target.value); setSelectedReal(null); }}
                  placeholder="Search by name..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {realPlayers
                  .filter(p => !claimSearch || p.full_name.toLowerCase().includes(claimSearch.toLowerCase()))
                  .slice(0, 20)
                  .map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedReal(p)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition ${selectedReal?.id === p.id ? "bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200 font-bold" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"}`}
                    >
                      {p.full_name}
                      {p.department && <span className="text-xs text-slate-400 ml-2">· {p.department}</span>}
                    </button>
                  ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setClaimGuest(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={executeClaim}
                disabled={!selectedReal || claiming}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Claim Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
