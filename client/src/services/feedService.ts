import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/supabase-types-auto";

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

export interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
  author?: string;
  pinned?: boolean;
  tag?: string;
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
      await supabase.from("analytics_events" as any).insert({
        event,
        props,
        player_id: uid,
      });
    } catch {
      // analytics is best-effort
    }
  },

  async getRivalryHeadToHead(player1Id: string, player2Id: string) {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .or(
        `and(player1_id.eq.${player1Id},player2_id.eq.${player2Id}),and(player1_id.eq.${player2Id},player2_id.eq.${player1Id})`,
      )
      .in("status", ["confirmed", "walkover"])
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
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

  async fetchHomeBannersData(): Promise<any[]> {
    const { data, error } = await supabase
      .from("site_data")
      .select("key, value")
      .in("key", ["home_banners", "announcements", "events", "flyers"]);
    if (error) throw error;
    return data || [];
  },

  subscribeToHomeBanners(callback: (data: any[]) => void): () => void {
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

  async fetchStatProb(t1Ids: string[], t2Ids: string[]): Promise<{ t1: number; t2: number } | null> {
    if (!t1Ids.length || !t2Ids.length) return null;

    const { data } = await supabase
      .from("matches")
      .select("player1_id, team1_partner_id, player2_id, team2_partner_id, winner_id")
      .or(
        `and(player1_id.in.(${t1Ids.join(",")}),player2_id.in.(${t2Ids.join(",")})),` +
        `and(player1_id.in.(${t2Ids.join(",")}),player2_id.in.(${t1Ids.join(",")}))`
      )
      .limit(100);

    if (!data || data.length === 0) {
      const allIds = [...t1Ids, ...t2Ids];
      const { data: allMatches } = await supabase
        .from("matches")
        .select("player1_id, team1_partner_id, player2_id, team2_partner_id, winner_id")
        .or(
          allIds.map(id => `player1_id.eq.${id},player2_id.eq.${id},team1_partner_id.eq.${id},team2_partner_id.eq.${id}`).join(",")
        )
        .limit(200);
      if (!allMatches || allMatches.length === 0) return null;

      const winRate = (ids: string[]) => {
        let wins = 0, total = 0;
        for (const match of allMatches) {
          const isT1 = ids.includes(match.player1_id) || ids.includes(match.team1_partner_id ?? "");
          const isT2 = ids.includes(match.player2_id) || ids.includes(match.team2_partner_id ?? "");
          if (!isT1 && !isT2) continue;
          total++;
          if (ids.includes(match.winner_id ?? "")) wins++;
        }
        return total === 0 ? 0.5 : wins / total;
      };

      const r1 = winRate(t1Ids), r2 = winRate(t2Ids);
      const sum = r1 + r2;
      if (sum === 0) return { t1: 50, t2: 50 };
      const t1 = Math.round((r1 / sum) * 100);
      return { t1, t2: 100 - t1 };
    }

    let t1Wins = 0, t2Wins = 0;
    for (const match of data) {
      const matchT1Ids = [match.player1_id, match.team1_partner_id].filter(Boolean);
      const winnerIsMatchT1 = matchT1Ids.includes(match.winner_id);
      const matchT1IsOurT1 = t1Ids.some(id => matchT1Ids.includes(id));
      if (winnerIsMatchT1) {
        matchT1IsOurT1 ? t1Wins++ : t2Wins++;
      } else {
        matchT1IsOurT1 ? t2Wins++ : t1Wins++;
      }
    }
    const total = t1Wins + t2Wins || 1;
    return {
      t1: Math.round((t1Wins / total) * 100),
      t2: Math.round((t2Wins / total) * 100),
    };
  },

  async fetchVoteTally(matchId: string): Promise<{ t1: number; t2: number }> {
    const { data } = await supabase
      .from("live_match_votes")
      .select("pick")
      .eq("live_match_id", matchId);
    if (!data) return { t1: 0, t2: 0 };
    return {
      t1: data.filter(r => r.pick === 1).length,
      t2: data.filter(r => r.pick === 2).length,
    };
  },

  subscribeToMatchVotes(
    matchId: string,
    onInsert: (vote: { user_id: string; pick: number }) => void,
    onDelete: (vote: { user_id: string; pick: number }) => void
  ): () => void {
    const sub = supabase
      .channel(`votes_${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_match_votes",
          filter: `live_match_id=eq.${matchId}`,
        },
        (payload) => {
          onInsert(payload.new as any);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "live_match_votes",
          filter: `live_match_id=eq.${matchId}`,
        },
        (payload) => {
          onDelete(payload.old as any);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  },

  async fetchPredictionLeaderboard(): Promise<any[]> {
    const { data: votes } = await supabase
      .from("live_match_votes")
      .select("user_id, live_match_id, pick");

    if (!votes || votes.length === 0) return [];

    const matchIds = [...new Set(votes.map(v => v.live_match_id))];

    const [{ data: matches }, { data: tourneyMatches }] = await Promise.all([
      supabase
        .from("matches")
        .select("id, player1_id, player2_id, team1_partner_id, team2_partner_id, winner_id")
        .in("id", matchIds),
      supabase
        .from("tournament_matches")
        .select("id, player1_id, player2_id, player3_id, player4_id, winner_side")
        .in("id", matchIds),
    ]);

    const matchWinnerMap: Record<string, 1 | 2> = {};

    if (matches) {
      for (const m of matches) {
        if (!m.winner_id) continue;
        const isT1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
        matchWinnerMap[m.id] = isT1Winner ? 1 : 2;
      }
    }

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
};

export const fetchPollRevealedMatches = feedService.fetchPollRevealedMatches;
export const updatePollRevealedMatches = feedService.updatePollRevealedMatches;
export const fetchClubSettings = feedService.fetchClubSettings;
export const getLiveMatchPicks = feedService.getLiveMatchPicks;
export const saveLiveMatchPick = feedService.saveLiveMatchPick;

