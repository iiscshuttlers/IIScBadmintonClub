import { supabase } from "@/lib/supabase";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Json, Tables } from "@/lib/supabase-types-auto";

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // array of user IDs who voted
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  created_at: string;
  created_by?: string;
  is_active: boolean;
  is_archived?: boolean;
  start_date?: string;
  end_date?: string;
  results_revealed?: boolean;
  tournament_id?: string;
}

/** Response of the send-announcement edge function. */
export interface SendAnnouncementResponse {
  message?: string;
  sent?: number;
  failed?: number;
  total?: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
  author?: string;
  pinned?: boolean;
  tag?: string;
}

// ── Live match vote cards ────────────────────────────────────────────────
// A schedule can show ~140 prediction cards at once. Each card used to make
// its own tally request and open its own realtime channel, which meant ~140
// requests per page view and more channels than Supabase Realtime's default
// per-connection limit (100), so the cards past that never updated live.

type VoteTally = { t1: number; t2: number };
type VoteRow = { live_match_id?: string; user_id: string; pick: number };
const TALLY_CHUNK = 100; // keeps the `in.(...)` filter well inside URL limits

let tallyQueue: Map<string, Array<(t: VoteTally) => void>> | null = null;

async function flushTallyQueue(queue: Map<string, Array<(t: VoteTally) => void>>) {
  const ids = [...queue.keys()];
  const counts = new Map<string, VoteTally>(ids.map((id) => [id, { t1: 0, t2: 0 }]));
  for (let i = 0; i < ids.length; i += TALLY_CHUNK) {
    // Errors are ignored as before: a failed read leaves the tally at 0–0.
    const { data } = await supabase
      .from("live_match_votes")
      .select("live_match_id, pick")
      .in("live_match_id", ids.slice(i, i + TALLY_CHUNK));
    data?.forEach((r) => {
      const c = counts.get(r.live_match_id);
      if (!c) return;
      if (r.pick === 1) c.t1++;
      else if (r.pick === 2) c.t2++;
    });
  }
  queue.forEach((resolvers, id) => resolvers.forEach((resolve) => resolve(counts.get(id)!)));
}

type VoteListener = { onInsert: (v: VoteRow) => void; onDelete: (v: VoteRow) => void };
const voteListeners = new Map<string, Set<VoteListener>>();
let voteChannel: ReturnType<typeof supabase.channel> | null = null;

function ensureVoteChannel() {
  if (voteChannel) return;
  const dispatch = (row: VoteRow, kind: keyof VoteListener) => {
    if (!row?.live_match_id) return;
    voteListeners.get(row.live_match_id)?.forEach((l) => l[kind](row));
  };
  voteChannel = supabase
    .channel("live_match_votes_all")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_match_votes" }, (payload) =>
      dispatch(payload.new as VoteRow, "onInsert"),
    )
    // live_match_votes has the default replica identity, so `old` carries only
    // the primary key and deletions can't be routed to a card. The old
    // per-match filtered DELETE subscription never delivered them either.
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "live_match_votes" }, (payload) =>
      dispatch(payload.old as VoteRow, "onDelete"),
    )
    .subscribe();
}

export const feedService = {
  async getPolls(tournamentId?: string): Promise<Poll[]> {
    const { data, error } = await supabase
      .from("site_data")
      .select("value")
      .eq("key", "polls")
      .maybeSingle();

    if (error) throw error;
    const polls: Poll[] = (data?.value as { polls?: Poll[] } | null)?.polls || [];
    if (!tournamentId) return polls;
    return polls.filter((p) => !p.tournament_id || p.tournament_id === tournamentId);
  },

  async savePolls(polls: Poll[]): Promise<void> {
    const { error } = await supabase
      .from("site_data")
      .upsert({ key: "polls", value: { polls } as unknown as Json }, { onConflict: "key" });

    if (error) throw error;
  },

  async votePoll(pollId: string, optionId: string, userId: string): Promise<Poll[]> {
    const polls = await this.getPolls();
    const updatedPolls = polls.map((p) => {
      if (p.id !== pollId) return p;
      const updatedOptions = p.options.map((opt) => {
        const votes = (opt.votes || []).filter((id) => id !== userId);
        if (opt.id === optionId) {
          votes.push(userId);
        }
        return { ...opt, votes };
      });
      return { ...p, options: updatedOptions };
    });

    await this.savePolls(updatedPolls);
    return updatedPolls;
  },

  async getAnnouncements(): Promise<Announcement[]> {
    const { data, error } = await supabase
      .from("site_data")
      .select("value")
      .eq("key", "announcements")
      .maybeSingle();

    if (error) throw error;
    return ((data?.value as { recent?: Announcement[] } | null)?.recent ?? (data?.value as unknown as Announcement[] | null) ?? []) as Announcement[];
  },

  async saveAnnouncements(announcements: Announcement[]): Promise<void> {
    const { error } = await supabase
      .from("site_data")
      .upsert(
        { key: "announcements", value: { recent: announcements } as unknown as Json },
        { onConflict: "key" },
      );

    if (error) throw error;
  },

  async trackAnalyticsEvent(event: string, props: Record<string, unknown> = {}): Promise<void> {
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id ?? null;
      if (!uid) return;
      await supabase.from("analytics_events").insert({
        event,
        props: props as Json,
        player_id: uid,
      });
    } catch {
      // analytics is best-effort
    }
  },

  async getLiveMatchVotes(matchIds: string[], userId?: string) {
    if (!matchIds.length) return { votes: [], myVotes: [] };
    const { data: votes } = await supabase
      .from("live_match_votes")
      .select("live_match_id, pick")
      .in("live_match_id", matchIds);

    let myVotes: Array<{ live_match_id: string; pick: number }> = [];
    if (userId) {
      const { data } = await supabase
        .from("live_match_votes")
        .select("live_match_id, pick")
        .in("live_match_id", matchIds)
        .eq("user_id", userId);
      myVotes = data || [];
    }

    return { votes: votes || [], myVotes };
  },

  async fetchUserLiveVotes(userId: string): Promise<Record<string, 1 | 2>> {
    const { data } = await supabase
      .from("live_match_votes")
      .select("live_match_id, pick")
      .eq("user_id", userId);
    const p: Record<string, 1 | 2> = {};
    if (data) {
      data.forEach((v) => { p[v.live_match_id] = v.pick as 1 | 2; });
    }
    return p;
  },

  async voteLiveMatch(matchId: string, userId: string, prediction: number): Promise<void> {
    const { error } = await supabase.from("live_match_votes").upsert(
      {
        live_match_id: matchId,
        user_id: userId,
        pick: prediction,
      },
      { onConflict: "live_match_id,user_id" }
    );
    if (error) throw error;
  },

  async getPollRevealedMatches(): Promise<Record<string, boolean>> {
    const { data } = await supabase
      .from("site_data")
      .select("value")
      .eq("key", "poll_revealed_matches")
      .maybeSingle();
    return (data?.value as Record<string, boolean>) || {};
  },

  async setPollRevealedMatches(nextState: Record<string, boolean>): Promise<void> {
    await supabase.from("site_data").upsert(
      { key: "poll_revealed_matches", value: nextState },
      { onConflict: "key" }
    );
  },

  async getTournamentContacts(tournamentId: string) {
    const { data } = await supabase
      .from("site_data")
      .select("value")
      .eq("key", `tournament_contacts_${tournamentId}`)
      .maybeSingle();
    return data?.value ?? null;
  },

  async setTournamentContacts(tournamentId: string, value: unknown): Promise<void> {
    await supabase.from("site_data").upsert(
      { key: `tournament_contacts_${tournamentId}`, value: value as unknown as Json },
      { onConflict: "key" }
    );
  },

  async deleteTournamentContacts(tournamentId: string): Promise<void> {
    await supabase.from("site_data").delete().eq("key", `tournament_contacts_${tournamentId}`);
  },

  async sendAnnouncement(payload: { title: string; body: string; targetGroup?: string; [key: string]: unknown }): Promise<void> {
    const { error } = await supabase.functions.invoke("send-announcement", { body: payload });
    if (error) throw error;
  },

  /**
   * Invokes send-announcement with exactly `{ title, body }` and returns the
   * function's response (unlike sendAnnouncement). Throws on error.
   */
  async sendAnnouncementPush(body: { title: string; body: string }): Promise<SendAnnouncementResponse | null> {
    const { data, error } = await supabase.functions.invoke<SendAnnouncementResponse>("send-announcement", {
      body,
    });
    if (error) throw error;
    return data;
  },

  async getLiveMatchPicks(userId: string, matchIds?: string[]): Promise<Record<string, 1 | 2>> {
    let query = supabase
      .from("live_match_votes")
      .select("live_match_id, pick")
      .eq("user_id", userId);
    if (matchIds && matchIds.length > 0) {
      query = query.in("live_match_id", matchIds);
    }
    const { data } = await query;
    const p: Record<string, 1 | 2> = {};
    (data || []).forEach((v) => {
      p[v.live_match_id] = v.pick as 1 | 2;
    });
    return p;
  },

  async saveLiveMatchPick(matchId: string, userId: string, pick: 1 | 2): Promise<void> {
    const { error } = await supabase.from("live_match_votes").upsert(
      {
        live_match_id: matchId,
        user_id: userId,
        pick,
      },
      { onConflict: "live_match_id,user_id" }
    );
    if (error) throw error;
  },

  subscribeToPollRevealedMatches(callback: (revealed: Record<string, boolean>) => void): () => void {
    const sub = supabase
      .channel("poll_revealed_matches_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_data", filter: "key=eq.poll_revealed_matches" },
        (payload) => {
          const newVal = payload.new as { value?: Record<string, boolean> };
          if (newVal?.value) callback(newVal.value);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  },

  async fetchHomeBannersData(): Promise<Pick<Tables<"site_data">, "key" | "value">[]> {
    const { data, error } = await supabase
      .from("site_data")
      .select("key, value")
      .in("key", ["home_banners", "announcements", "events", "flyers"]);
    if (error) throw error;
    return data || [];
  },

  /** Replaces the site_data `home_banners` value (stamping updated_at) and returns `{ error }`. */
  async saveHomeBanners(banners: Json) {
    const { error } = await supabase
      .from("site_data")
      .upsert({ key: "home_banners", value: banners, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return { error };
  },

  subscribeToHomeBanners(callback: (data: Pick<Tables<"site_data">, "key" | "value">[]) => void): () => void {
    const ch = supabase
      .channel("home_banners_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_data", filter: "key=in.(home_banners,announcements,events,flyers)" },
        async () => {
          const data = await feedService.fetchHomeBannersData();
          callback(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  },

  /** Calls made in the same tick share one query (see flushTallyQueue). */
  fetchVoteTally(matchId: string): Promise<{ t1: number; t2: number }> {
    return new Promise((resolve) => {
      if (!tallyQueue) {
        const queue = new Map<string, Array<(t: VoteTally) => void>>();
        tallyQueue = queue;
        setTimeout(() => {
          tallyQueue = null;
          void flushTallyQueue(queue);
        }, 0);
      }
      const waiting = tallyQueue.get(matchId);
      if (waiting) waiting.push(resolve);
      else tallyQueue.set(matchId, [resolve]);
    });
  },

  /**
   * Live vote updates for one match card. Every card shares a single realtime
   * channel (see ensureVoteChannel); the channel closes when the last card
   * unsubscribes.
   */
  subscribeToMatchVotes(
    matchId: string,
    onInsert: (vote: { user_id: string; pick: number }) => void,
    onDelete: (vote: { user_id: string; pick: number }) => void
  ): () => void {
    const listener: VoteListener = { onInsert, onDelete };
    const set = voteListeners.get(matchId) ?? new Set<VoteListener>();
    set.add(listener);
    voteListeners.set(matchId, set);
    ensureVoteChannel();

    return () => {
      const current = voteListeners.get(matchId);
      current?.delete(listener);
      if (current && current.size === 0) voteListeners.delete(matchId);
      if (voteListeners.size === 0 && voteChannel) {
        supabase.removeChannel(voteChannel);
        voteChannel = null;
      }
    };
  },

  async fetchPredictionLeaderboard(): Promise<any[]> {
    const { data: votes } = await supabase
      .from("live_match_votes")
      .select("user_id, live_match_id, pick");

    if (!votes || votes.length === 0) return [];

    const matchIds = [...new Set(votes.map(v => v.live_match_id))];

    const { data: tourneyMatches } = await supabase
      .from("tournament_matches")
      .select("id, player1_id, player2_id, player3_id, player4_id, winner_side")
      .in("id", matchIds);

    const matchWinnerMap: Record<string, 1 | 2> = {};

    if (tourneyMatches) {
      for (const m of tourneyMatches) {
        if (!m.winner_side) continue;
        matchWinnerMap[m.id] = m.winner_side as 1 | 2;
      }
    }

    const userStatsMap: Record<string, { total: number; correct: number }> = {};

    for (const vote of votes) {
      if (!userStatsMap[vote.user_id]) {
        userStatsMap[vote.user_id] = { total: 0, correct: 0 };
      }
      userStatsMap[vote.user_id].total++;

      const actualWinner = matchWinnerMap[vote.live_match_id];
      if (actualWinner && vote.pick === actualWinner) {
        userStatsMap[vote.user_id].correct++;
      }
    }

    const userIds = Object.keys(userStatsMap);
    const { data: players } = await supabase
      .from("players")
      .select("id, full_name, avatar_url")
      .in("id", userIds);

    const playerMap: Record<string, { name: string; avatarUrl?: string }> = {};
    if (players) {
      for (const p of players) playerMap[p.id] = { name: p.full_name, avatarUrl: p.avatar_url };
    }

    return userIds.map(uid => {
      const s = userStatsMap[uid];
      const acc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
      const badges: string[] = [];

      if (s.correct >= 10 && acc >= 70) badges.push("🔮 Master Predictor");
      else if (s.correct >= 5) badges.push("🏆 Oracle");
      else if (s.total >= 5) badges.push("⚡ Active Voter");

      return {
        userId: uid,
        name: playerMap[uid]?.name || "Anonymous Player",
        avatarUrl: playerMap[uid]?.avatarUrl,
        totalVotes: s.total,
        correctVotes: s.correct,
        accuracy: acc,
        badges,
      };
    }).sort((a, b) => b.correctVotes - a.correctVotes || b.accuracy - a.accuracy);
  },

  async fetchPollRevealedMatches(): Promise<Record<string, boolean>> {
    const { data, error } = await supabase
      .from("site_data")
      .select("value")
      .eq("key", "poll_revealed_matches")
      .maybeSingle();
    if (error) throw error;
    return (data?.value ?? {}) as Record<string, boolean>;
  },

  async updatePollRevealedMatches(nextState: Record<string, boolean>): Promise<void> {
    const { error } = await supabase
      .from("site_data")
      .upsert({ key: "poll_revealed_matches", value: nextState as unknown as Json }, { onConflict: "key" });
    if (error) throw error;
  },

  async fetchClubSettings(): Promise<Record<string, unknown> | null> {
    const { data, error } = await supabase
      .from("site_data")
      .select("value")
      .eq("key", "club_settings")
      .maybeSingle();
    if (error) throw error;
    return (data?.value as Record<string, unknown>) ?? null;
  },

  /** Raw postgres_changes on site_data `club_settings` (maintenance banner). Returns the cleanup. */
  subscribeToClubSettings(
    onChange: (payload: RealtimePostgresChangesPayload<Tables<"site_data">>) => void
  ): () => void {
    const channel = supabase.channel('club-settings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_data', filter: "key=eq.club_settings" },
        onChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};

export const fetchPollRevealedMatches = feedService.fetchPollRevealedMatches;
export const updatePollRevealedMatches = feedService.updatePollRevealedMatches;
export const fetchClubSettings = feedService.fetchClubSettings;
export const getLiveMatchPicks = feedService.getLiveMatchPicks;
export const saveLiveMatchPick = feedService.saveLiveMatchPick;

