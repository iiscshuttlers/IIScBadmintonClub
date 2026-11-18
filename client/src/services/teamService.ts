import { supabase } from "@/lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase-types-auto";
import { findPlayerByEmail } from "@/services/playerPrivateService";
import { PLAYER_PUBLIC_COLUMNS } from "@/lib/playerColumns";

/** Public player columns (PLAYER_PUBLIC_COLUMNS) embedded in a roster row. */
type RosterPlayer = Partial<Tables<"players">>;

/** A tournament_team_members row with its player embedded (under both `player` and `players`). */
type RosterMemberRow = Tables<"tournament_team_members"> & {
  player?: RosterPlayer | null;
  players?: RosterPlayer | null;
};

/** One entry of getTeamRosterWithCaptain; the captain may be a synthetic entry. */
export type TeamRosterEntry = Partial<Tables<"tournament_team_members">> & {
  id: string;
  team_id: string;
  player_id: string;
  role: string;
  status: string;
  is_captain?: boolean;
  player: RosterPlayer | null;
  players: RosterPlayer | null;
};

export interface TournamentTeam {
  id: string;
  tournament_id: string;
  name: string;
  short_name: string;
  captain_id: string | null;
  status: string;
  logo_url?: string | null;
  created_at: string;
  captain?: { full_name: string } | null;
}

export interface TournamentTeamMember {
  id: string;
  tournament_id: string;
  team_id: string;
  player_id: string;
  role: string;
  status: string;
  player?: {
    id: string;
    full_name: string;
    email: string | null;
    gender?: string | null;
    is_guest: boolean | null;
    avatar_url?: string | null;
  };
}

export interface TournamentTie {
  id: string;
  tournament_id: string;
  tie_code: string;
  stage: string;
  team_a_id: string;
  team_b_id: string;
  winner_team_id: string | null;
  score_a: number | null;
  score_b: number | null;
  status: string;
  court: string | null;
  scheduled_at: string | null;
  advances_to: string | null;
  advances_slot: string | null;
  created_at: string;
  team_a?: { id: string; name: string; short_name: string; logo_url?: string | null };
  team_b?: { id: string; name: string; short_name: string; logo_url?: string | null };
  matches?: Array<{ id: string; status: string; court_number?: number }>;
}

export const teamService = {
  async getTournamentTeams(tournamentId: string): Promise<TournamentTeam[]> {
    const { data, error } = await supabase
      .from("tournament_teams")
      .select("*, captain:players!captain_id(full_name)")
      .eq("tournament_id", tournamentId)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data ?? []) as unknown as TournamentTeam[];
  },

  async getTeamsForLiveDisplay(tournamentId: string) {
    const { data, error } = await supabase
      .from("tournament_teams")
      .select("id, tournament_id, name, short_name, pool, seed, captain_id, status")
      .eq("tournament_id", tournamentId)
      .neq("status", "DELETED")
      .order("name", { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  async getTournamentTeamMembers(tournamentId: string): Promise<TournamentTeamMember[]> {
    const { data, error } = await supabase
      .from("tournament_team_members")
      .select("*, player:players!player_id(id, full_name, gender, is_guest, avatar_url)")
      .eq("tournament_id", tournamentId)
      .eq("status", "ACTIVE");

    if (error) throw error;
    return (data ?? []) as unknown as TournamentTeamMember[];
  },

  async createTeam(
    tournamentId: string,
    name: string,
    shortName: string,
    captainId: string | null = null,
  ): Promise<TournamentTeam> {
    const { data, error } = await supabase
      .from("tournament_teams")
      .insert({
        tournament_id: tournamentId,
        name: name.trim(),
        short_name: shortName.trim().toUpperCase(),
        captain_id: captainId,
        status: "ACTIVE",
      })
      .select()
      .single();

    if (error) throw error;
    return data as unknown as TournamentTeam;
  },

  async deleteTeam(teamId: string): Promise<void> {
    const { error } = await supabase
      .from("tournament_teams")
      .update({ status: "INACTIVE" })
      .eq("id", teamId);

    if (error) throw error;
  },

  async addTeamMember(params: {
    tournamentId: string;
    teamId: string;
    playerId: string;
    role?: string;
  }): Promise<TournamentTeamMember> {
    const { data, error } = await supabase
      .from("tournament_team_members")
      .insert({
        tournament_id: params.tournamentId,
        team_id: params.teamId,
        player_id: params.playerId,
        role: params.role || "PLAYER",
        status: "ACTIVE",
      })
      .select()
      .single();

    if (error) throw error;
    return data as unknown as TournamentTeamMember;
  },

  async removeTeamMember(memberId: string): Promise<void> {
    const { error } = await supabase
      .from("tournament_team_members")
      .update({ status: "INACTIVE" })
      .eq("id", memberId);

    if (error) throw error;
  },

  async getTournamentTies(tournamentId: string): Promise<TournamentTie[]> {
    const { data, error } = await supabase
      .from("tournament_ties")
      .select(`
        *,
        team_a:tournament_teams!tournament_ties_team_a_id_fkey(id, name, short_name, logo_url),
        team_b:tournament_teams!tournament_ties_team_b_id_fkey(id, name, short_name, logo_url),
        matches:tournament_matches(id, status, court_number, rubber_order, match_code)
      `)
      .eq("tournament_id", tournamentId)
      .order("round_number", { ascending: true })
      .order("tie_code", { ascending: true });

    if (error) throw error;
    return (data ?? []) as unknown as TournamentTie[];
  },

  async createTie(tieData: {
    tournamentId: string;
    teamAId: string;
    teamBId: string;
    tieCode: string;
    stage?: string;
    advancesTo?: string | null;
    advancesSlot?: string | null;
    court?: string | null;
    scheduledAt?: string | null;
  }): Promise<TournamentTie> {
    const { data, error } = await supabase
      .from("tournament_ties")
      .insert({
        tournament_id: tieData.tournamentId,
        team_a_id: tieData.teamAId,
        team_b_id: tieData.teamBId,
        tie_code: tieData.tieCode,
        stage: tieData.stage || "POOL",
        advances_to_tie: tieData.advancesTo || null,
        advances_to_slot: tieData.advancesSlot || null,
        scheduled_at: tieData.scheduledAt || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as unknown as TournamentTie;
  },

  async updateTieSchedule(
    tieId: string,
    court: string | null,
    scheduledAt: string | null,
  ): Promise<void> {
    const { error: tieErr } = await supabase
      .from("tournament_ties")
      .update({ scheduled_at: scheduledAt })
      .eq("id", tieId);

    if (tieErr) throw tieErr;

    if (court || scheduledAt) {
      const updates: { court_number?: string | null; scheduled_at?: string | null } = {};
      if (court) updates.court_number = court;
      if (scheduledAt) updates.scheduled_at = scheduledAt;

      const { error: matchErr } = await supabase
        .from("tournament_matches")
        .update(updates)
        .eq("tie_id", tieId);

      if (matchErr) throw matchErr;
    }
  },

  async getTieMatches(tieId: string) {
    const { data, error } = await supabase
      .from("tournament_matches")
      .select(`
        *,
        player1:players!tournament_matches_player1_id_fkey(id, full_name),
        player2:players!tournament_matches_player2_id_fkey(id, full_name),
        player3:players!tournament_matches_player3_id_fkey(id, full_name),
        player4:players!tournament_matches_player4_id_fkey(id, full_name)
      `)
      .eq("tie_id", tieId)
      .order("rubber_order", { ascending: true, nullsFirst: false });

    if (error) throw error;
    return data ?? [];
  },

  async resolveTie(params: {
    tieId: string;
    winnerId: string;
    scoreA?: number;
    scoreB?: number;
    rubberScores?: Record<string, { winnerSide: number; score: string }>;
  }): Promise<void> {
    if (params.rubberScores) {
      for (const [matchId, matchData] of Object.entries(params.rubberScores)) {
        await supabase
          .from("tournament_matches")
          .update({
            winner_side: matchData.winnerSide,
            score: matchData.score,
            status: "completed",
          })
          .eq("id", matchId);
      }
    }

    const updatePayload: { score_team_a?: number; score_team_b?: number } = {};
    if (params.scoreA !== undefined && params.scoreA !== null) {
      updatePayload.score_team_a = params.scoreA;
    }
    if (params.scoreB !== undefined && params.scoreB !== null) {
      updatePayload.score_team_b = params.scoreB;
    }

    if (Object.keys(updatePayload).length > 0) {
      await supabase
        .from("tournament_ties")
        .update(updatePayload)
        .eq("id", params.tieId);
    }

    const { error } = await supabase.rpc("set_tie_result", {
      p_tie_id: params.tieId,
      p_winner_team_id: params.winnerId,
      p_note: "Resolved by manager",
    });

    if (error) throw error;
  },

  async getUserCaptainTeam(tournamentId: string, userId: string) {
    // 1. Check if user is captain in tournament_teams
    const { data: captainTeams } = await supabase
      .from("tournament_teams")
      .select("*, tournaments(*)")
      .eq("tournament_id", tournamentId)
      .eq("captain_id", userId);

    let team = captainTeams && captainTeams[0];
    let isCaptain = !!team;

    // 2. If not found in captain_id, check tournament_team_members
    if (!team) {
      const { data: memberRows } = await supabase
        .from("tournament_team_members")
        .select("*, tournament_teams(*, tournaments(*))")
        .eq("tournament_id", tournamentId)
        .eq("player_id", userId)
        .eq("status", "ACTIVE");
      if (memberRows && memberRows[0]) {
        team = memberRows[0].tournament_teams;
        isCaptain = memberRows[0].role === "CAPTAIN" || team?.captain_id === userId;
      }
    }

    if (!team) return null;

    // Fetch active roster for this team
    const { data: members } = await supabase
      .from("tournament_team_members")
      .select(`*, players!tournament_team_members_player_id_fkey(${PLAYER_PUBLIC_COLUMNS})`)
      .eq("team_id", team.id)
      .eq("status", "ACTIVE");

    return { team, isCaptain, members: members || [] };
  },

  async getTeamStandings(tournamentId: string) {
    const { data, error } = await supabase
      .from("tournament_team_standings")
      .select("*")
      .eq("tournament_id", tournamentId);

    if (error) {
      return [];
    }
    return data ?? [];
  },

  async deleteTeamHard(teamId: string): Promise<void> {
    const { error } = await supabase.from("tournament_teams").delete().eq("id", teamId);
    if (error) throw error;
  },

  async updateTeamCaptain(teamId: string, captainId: string | null): Promise<void> {
    const { error } = await supabase.from("tournament_teams").update({ captain_id: captainId }).eq("id", teamId);
    if (error) throw error;
  },

  async updateTeamPool(teamId: string, pool: string): Promise<void> {
    const { error } = await supabase.from("tournament_teams").update({ pool }).eq("id", teamId);
    if (error) throw error;
  },

  async deleteTeamMembersByTeamId(teamId: string): Promise<void> {
    const { error } = await supabase.from("tournament_team_members").delete().eq("team_id", teamId);
    if (error) throw error;
  },

  async deleteTeamMemberHard(memberId: string): Promise<void> {
    const { error } = await supabase.from("tournament_team_members").delete().eq("id", memberId);
    if (error) throw error;
  },

  async updateTeamMemberRole(memberId: string, role: string): Promise<void> {
    const { error } = await supabase.from("tournament_team_members").update({ role }).eq("id", memberId);
    if (error) throw error;
  },

  async upsertTeamMember(params: {
    teamId: string;
    tournamentId: string;
    playerId: string;
    role: string;
  }): Promise<void> {
    const { error } = await supabase.from("tournament_team_members").upsert(
      {
        team_id: params.teamId,
        tournament_id: params.tournamentId,
        player_id: params.playerId,
        role: params.role,
        status: "ACTIVE",
      },
      { onConflict: "team_id,player_id" }
    );
    if (error) throw error;
  },

  async deleteTournamentTies(tournamentId: string): Promise<void> {
    const { error } = await supabase.from("tournament_ties").delete().eq("tournament_id", tournamentId);
    if (error) throw error;
  },

  async insertTournamentTies(ties: Array<TablesInsert<"tournament_ties">>): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await supabase.from("tournament_ties").insert(ties).select();
    if (error) throw error;
    return (data ?? []) as Array<Record<string, unknown>>;
  },

  async updateTournamentTie(tieId: string, patch: TablesUpdate<"tournament_ties">): Promise<void> {
    const { error } = await supabase.from("tournament_ties").update(patch).eq("id", tieId);
    if (error) throw error;
  },

  async insertTournamentMatches(matches: Array<TablesInsert<"tournament_matches">>): Promise<void> {
    const { error } = await supabase.from("tournament_matches").insert(matches);
    if (error) throw error;
  },

  async populatePlayoffQualifiers(tournamentId: string): Promise<unknown> {
    const { data, error } = await supabase.rpc("populate_playoff_qualifiers_from_standings", {
      p_tournament_id: tournamentId,
    });
    if (error) throw error;
    return data;
  },

  async getTournamentRubbers(tournamentId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await supabase
      .from("tournament_matches")
      .select(`
        *,
        player1:players!tournament_matches_player1_id_fkey(id, full_name, avatar_url),
        player2:players!tournament_matches_player2_id_fkey(id, full_name, avatar_url),
        player3:players!tournament_matches_player3_id_fkey(id, full_name, avatar_url),
        player4:players!tournament_matches_player4_id_fkey(id, full_name, avatar_url),
        revealer:players!tournament_matches_revealed_by_fkey(id, full_name)
      `)
      .eq("tournament_id", tournamentId)
      .not("tie_id", "is", null);

    if (error) throw error;
    return (data ?? []) as Array<Record<string, unknown>>;
  },

  async getTieLineupAudits(_tournamentId?: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("tie_lineup_audits")
      .select(`
        *,
        referee:players!tie_lineup_audits_referee_id_fkey(full_name),
        orig_player:players!tie_lineup_audits_original_player_id_fkey(full_name),
        repl_player:players!tie_lineup_audits_replacement_player_id_fkey(full_name)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async checkIsOfficial(tournamentId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("tournament_officials")
      .select("role")
      .eq("tournament_id", tournamentId)
      .eq("user_id", userId)
      .in("role", ["ORGANIZER", "REFEREE", "UMPIRE"]);

    if (error) return false;
    return !!data && data.length > 0;
  },

  async getTeamRoster(teamId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("tournament_team_members")
      .select(`*, players!tournament_team_members_player_id_fkey(${PLAYER_PUBLIC_COLUMNS})`)
      .eq("team_id", teamId)
      .eq("status", "ACTIVE");

    if (error) throw error;
    return data ?? [];
  },

  async findExistingTeamByName(tournamentId: string, name: string): Promise<{ id: string } | null> {
    const { data, error } = await supabase
      .from("tournament_teams")
      .select("id")
      .eq("tournament_id", tournamentId)
      .ilike("name", name)
      .maybeSingle();

    if (error) return null;
    return data;
  },

  async createGuestPlayerWithEmail(email: string, fullName: string): Promise<{ id: string }> {
    const { data, error } = await supabase.rpc("create_guest_player_with_email", {
      p_email: email,
      p_full_name: fullName,
    });
    if (error || !data) throw error || new Error("Failed to create guest player with email");
    return data as { id: string };
  },

  async createGuestPlayerByName(fullName: string): Promise<{ id: string }> {
    const { data, error } = await supabase.rpc("create_guest_player", {
      p_full_name: fullName,
      p_gender: null,
    });
    if (error || !data) throw error || new Error("Failed to create guest player");
    return data as { id: string };
  },

  async findPlayersByEmail(cleanEmail: string): Promise<Array<{ id: string; is_guest: boolean | null }>> {
    // Exact address match on the server; returns identity only.
    try {
      const p = await findPlayerByEmail(cleanEmail);
      return p ? [{ id: p.id, is_guest: p.is_guest }] : [];
    } catch {
      return [];
    }
  },

  async getTeamById(teamId: string) {
    const { data, error } = await supabase
      .from('tournament_teams')
      .select('*, tournaments!tournament_teams_tournament_id_fkey(*)')
      .eq('id', teamId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getTeamTiesForTeam(teamId: string) {
    const { data, error } = await supabase
      .from('tournament_ties')
      .select('*, team_a:tournament_teams!tournament_ties_team_a_id_fkey(name, short_name), team_b:tournament_teams!tournament_ties_team_b_id_fkey(name, short_name)')
      .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getTeamRosterWithCaptain(teamId: string, captainId?: string | null) {
    let rawMembers: RosterMemberRow[] = [];
    const { data, error } = await supabase
      .from('tournament_team_members')
      .select(`*, player:players!player_id(${PLAYER_PUBLIC_COLUMNS})`)
      .eq('team_id', teamId);

    if (error) {
      const fallback = await supabase
        .from('tournament_team_members')
        .select(`*, players:players!tournament_team_members_player_id_fkey(${PLAYER_PUBLIC_COLUMNS})`)
        .eq('team_id', teamId);
      if (!fallback.error) {
        rawMembers = (fallback.data || []) as unknown as RosterMemberRow[];
      }
    } else {
      rawMembers = (data || []) as unknown as RosterMemberRow[];
    }

    const list: TeamRosterEntry[] = rawMembers.map((m) => {
      const p = m.player || m.players;
      return { ...m, player: p, players: p };
    });

    if (captainId && !list.some((m) => m.player_id === captainId)) {
      const { data: captainPlayer } = await supabase
        .from('players')
        .select(PLAYER_PUBLIC_COLUMNS)
        .eq('id', captainId)
        .maybeSingle();

      if (captainPlayer) {
        list.unshift({
          id: `captain-${captainPlayer.id}`,
          team_id: teamId,
          player_id: captainPlayer.id,
          role: 'CAPTAIN',
          status: 'ACTIVE',
          is_captain: true,
          player: captainPlayer,
          players: captainPlayer
        });
      }
    }

    return list;
  },

  async respondTeamInvite(memberId: string, accept: boolean): Promise<void> {
    const { error } = await supabase.rpc('respond_team_invite', {
      p_member_id: memberId,
      p_accept: accept,
    });
    if (error) throw error;
  },

  async removeTeamMemberRpc(memberId: string): Promise<void> {
    const { error } = await supabase.rpc('remove_team_member', {
      p_member_id: memberId,
    });
    if (error) throw error;
  },

  async inviteTeamMemberRpc(teamId: string, playerId: string): Promise<void> {
    const { error } = await supabase.rpc('invite_team_member', {
      p_team_id: teamId,
      p_player_id: playerId,
    });
    if (error) throw error;
  },

  async generateNewTeamInviteToken(teamId: string): Promise<string> {
    const { data, error } = await supabase.rpc('generate_new_team_invite_token', {
      p_team_id: teamId,
    });
    if (error) throw error;
    return data as string;
  },

  async getUserTeamAndPendingLineups(playerId: string): Promise<{ myTeamId: string | null; pendingLineups: number }> {
    const { data: memberTeam } = (await supabase
      .from("tournament_team_members")
      .select("team_id, role, team:tournament_teams(id, captain_id)")
      .eq("player_id", playerId)
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle());

    if (!memberTeam?.team_id) {
      return { myTeamId: null, pendingLineups: 0 };
    }

    const isCap = memberTeam.role === "CAPTAIN" || memberTeam.team?.captain_id === playerId;
    if (!isCap) {
      return { myTeamId: memberTeam.team_id, pendingLineups: 0 };
    }

    const { count } = await supabase
      .from("tournament_ties")
      .select("*", { count: "exact", head: true })
      .or(`team_a_id.eq.${memberTeam.team_id},team_b_id.eq.${memberTeam.team_id}`)
      .neq("state", "COMPLETED")
      .or(`and(team_a_id.eq.${memberTeam.team_id},lineup_locked_a.eq.false),and(team_b_id.eq.${memberTeam.team_id},lineup_locked_b.eq.false)`);

    return { myTeamId: memberTeam.team_id, pendingLineups: count || 0 };
  },

  async resolveTieWithScores(params: {
    tieId: string;
    winnerId: string;
    scoreA?: string;
    scoreB?: string;
    rubberScores: Record<string, { winnerSide: number; score: string }>;
  }): Promise<void> {
    void params;
    throw new Error(
      "Manual tie-result correction is locked. Record or correct each rubber through its audited match flow; " +
      "winner-changing tie corrections require the coordinated tie recalculation RPC.",
    );
  },

  async getTournamentConfigForLineup(tournamentId: string) {
    const { data, error } = await supabase
      .from('tournaments')
      .select('id, tie_format_config, max_rubbers_per_player, ignore_gender_rules')
      .eq('id', tournamentId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getTieLineups(tieId: string, side: string) {
    const { data, error } = await supabase
      .from('tie_lineups')
      .select('*')
      .eq('tie_id', tieId)
      .eq('side', side);
    if (error) throw error;
    return data ?? [];
  },

  async getMatchesByTieId(tieId: string) {
    const { data, error } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tie_id', tieId);
    if (error) throw error;
    return data || [];
  },

  async saveTieLineups(
    tieId: string,
    side: string,
    inserts: Array<Omit<TablesInsert<"tie_lineups">, "tie_id" | "side" | "submitted_by">>,
  ) {
    const { data: authData } = await supabase.auth.getSession();
    const currentUserId = authData?.session?.user?.id;

    for (const row of inserts) {
      const { error } = await supabase.from('tie_lineups').upsert(
        {
          ...row,
          tie_id: tieId,
          side,
          submitted_by: currentUserId || row.player1_id,
        },
        { onConflict: 'tie_id,side,rubber_order' }
      );
      if (error) throw error;
    }
  },

  async lockTieLineup(tieId: string, side: string) {
    const { error } = await supabase.rpc('lock_tie_lineup', {
      p_tie_id: tieId,
      p_side: side,
    });
    if (error) throw error;
  },

  async getTeamByInviteToken(token: string) {
    const { data, error } = await supabase.rpc('get_team_by_invite_token', {
      p_token: token,
    });
    if (error) throw error;
    return data as {
      team_id: string;
      team_name: string;
      short_name: string;
      tournament_id: string;
      tournament_name: string;
      captain_name: string;
      captain_avatar: string | null;
      active_members: number;
      max_roster: number;
      is_full: boolean;
    };
  },

  async joinTeamByToken(token: string) {
    const { data, error } = await supabase.rpc('join_team_by_token', {
      p_token: token,
    });
    if (error) throw error;
    return data as { success: boolean; message: string; team_id?: string };
  },

  async createTeamRpc(params: {
    tournamentId: string;
    name: string;
    shortName: string;
    captainEmail: string;
    logoUrl?: string | null;
  }) {
    const player = await findPlayerByEmail(params.captainEmail).catch(() => null);
    if (!player) throw new Error("Captain not found with that email");

    const { error } = await supabase.rpc('create_team', {
      p_tournament_id: params.tournamentId,
      p_name: params.name,
      p_short_name: params.shortName,
      p_logo_url: params.logoUrl ?? null,
      p_captain_id: player.id,
    });
    if (error) throw error;
  },

  async createTieRpc(params: {
    tournamentId: string;
    tieCode: string;
    teamAId: string | null;
    teamBId: string | null;
    stage: string;
    advancesToTie?: string | null;
    advancesToSlot?: string | null;
  }) {
    const { data: newTieId, error } = await supabase.rpc('create_tie', {
      p_tournament_id: params.tournamentId,
      p_tie_code: params.tieCode,
      p_team_a_id: params.teamAId || null,
      p_team_b_id: params.teamBId || null,
      p_stage: params.stage,
      p_advances_to_tie: params.advancesToTie || null,
      p_advances_to_slot: params.advancesToSlot || null,
    });
    if (error) throw error;
    return newTieId;
  },

  /** Every tournament_teams row of a tournament, unordered. Throws on error. */
  async getTournamentTeamRows(tournamentId: string) {
    const { data, error } = await supabase
      .from('tournament_teams')
      .select('*')
      .eq('tournament_id', tournamentId);
    if (error) throw error;
    return data || [];
  },

  /** Every tournament_ties row of a tournament, unordered. Throws on error. */
  async getTournamentTieRows(tournamentId: string) {
    const { data, error } = await supabase
      .from('tournament_ties')
      .select('*')
      .eq('tournament_id', tournamentId);
    if (error) throw error;
    return data || [];
  },

  /** Organizer dashboard: teams that are not DELETED, by name, as `{ data, error }`. */
  async getOrganizerTeams(tournamentId: string) {
    const { data, error } = await supabase
      .from('tournament_teams')
      .select('*')
      .eq('tournament_id', tournamentId)
      .neq('status', 'DELETED')
      .order('name', { ascending: true });
    return { data, error };
  },

  /** ACTIVE members of a tournament's teams with `player:players!player_id(id, full_name, gender)`, as `{ data, error }`. */
  async getActiveMembersWithPlayer(tournamentId: string) {
    const { data, error } = await supabase
      .from('tournament_team_members')
      .select('id, team_id, player_id, role, status, player:players!player_id(id, full_name, gender)')
      .eq('tournament_id', tournamentId)
      .eq('status', 'ACTIVE');
    return { data, error };
  },

  /** Same members embedding the player through the explicit FK name (`players:`), as `{ data, error }`. */
  async getActiveMembersWithPlayerFk(tournamentId: string) {
    const { data, error } = await supabase
      .from('tournament_team_members')
      .select('id, team_id, player_id, role, status, players:players!tournament_team_members_player_id_fkey(id, full_name, gender)')
      .eq('tournament_id', tournamentId)
      .eq('status', 'ACTIVE');
    return { data, error };
  },

  /** Same members without any player embed, as `{ data, error }`. */
  async getActiveMembersBare(tournamentId: string) {
    const { data, error } = await supabase
      .from('tournament_team_members')
      .select('id, team_id, player_id, role, status')
      .eq('tournament_id', tournamentId)
      .eq('status', 'ACTIVE');
    return { data, error };
  },

  /** Organizer dashboard: a tournament's ties with both teams (name, short_name, captain_id), oldest first. Throws on error. */
  async getOrganizerTies(tournamentId: string) {
    const { data, error } = await supabase
      .from('tournament_ties')
      .select(`
          *,
          team_a:tournament_teams!tournament_ties_team_a_id_fkey(name, short_name, captain_id),
          team_b:tournament_teams!tournament_ties_team_b_id_fkey(name, short_name, captain_id)
        `)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /** Referee dashboard: a tournament's ties with both teams (id, name, short_name, logo_url), oldest first, as `{ data, error }`. */
  async getRefereeTies(tournamentId: string) {
    const { data, error } = await supabase
      .from('tournament_ties')
      .select(`
              *,
              team_a:tournament_teams!tournament_ties_team_a_id_fkey(id, name, short_name, logo_url),
              team_b:tournament_teams!tournament_ties_team_b_id_fkey(id, name, short_name, logo_url)
            `)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true });
    return { data, error };
  },

  /** Order of play: a tournament's ties that are not COMPLETED, by round number, as `{ data, error }`. */
  async getOrderOfPlayTies(tournamentId: string) {
    const { data, error } = await supabase
      .from('tournament_ties')
      .select(`
          id, tie_code, stage, round_name, round_number, state, scheduled_at,
          team_a:tournament_teams!tournament_ties_team_a_id_fkey(name, short_name),
          team_b:tournament_teams!tournament_ties_team_b_id_fkey(name, short_name)
        `)
      .eq('tournament_id', tournamentId)
      .neq('state', 'COMPLETED')
      .order('round_number', { ascending: true });
    return { data, error };
  },

  /** Sets only a tie's scheduled_at and returns `{ error }` (updateTieSchedule/updateTournamentTie differ). */
  async setTieScheduledAt(tieId: string, scheduledAt: string | null) {
    const { error } = await supabase
      .from('tournament_ties')
      .update({
        scheduled_at: scheduledAt,
      })
      .eq('id', tieId);
    return { error };
  },

  /**
   * Umpire tab: ties of the given tournaments that are not COMPLETED, with
   * the tournament name and both team names, oldest first. Returns null on error.
   */
  async getUmpirePendingTies(tournamentIds: string[]) {
    const { data } = await supabase
      .from('tournament_ties')
      .select(`
          *,
          tournament:tournaments(name),
          team_a:tournament_teams!tournament_ties_team_a_id_fkey(name, short_name),
          team_b:tournament_teams!tournament_ties_team_b_id_fkey(name, short_name)
        `)
      .in('tournament_id', tournamentIds)
      .neq('state', 'COMPLETED')
      .order('created_at', { ascending: true });
    return data;
  },

  /** One tie with both team names (lineup console), or null (missing row or error). */
  async getTieWithTeamNames(tieId: string) {
    const { data } = await supabase
      .from('tournament_ties')
      .select('*, team_a:tournament_teams!tournament_ties_team_a_id_fkey(name), team_b:tournament_teams!tournament_ties_team_b_id_fkey(name)')
      .eq('id', tieId)
      .single();
    return data;
  },

  /**
   * Lineup rows naming `userId` as player1 or player2, with the tie (and both
   * teams) and both players embedded; restricted to the tie's tournament when
   * `tournamentId` is given. Returns `{ data, error }`.
   */
  async getMyAssignedRubbers(userId: string, tournamentId?: string) {
    let query = supabase
      .from('tie_lineups')
      .select(`
          *,
          tie:tournament_ties!tie_lineups_tie_id_fkey(
            id,
            tie_code,
            state,
            scheduled_at,
            court,
            tournament_id,
            team_a:tournament_teams!tournament_ties_team_a_id_fkey(name, short_name),
            team_b:tournament_teams!tournament_ties_team_b_id_fkey(name, short_name)
          ),
          player1:players!tie_lineups_player1_id_fkey(full_name, display_name),
          player2:players!tie_lineups_player2_id_fkey(full_name, display_name)
        `)
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);

    if (tournamentId) {
      // filter by tie tournament_id
      query = query.filter('tie.tournament_id', 'eq', tournamentId);
    }

    const { data, error } = await query;
    return { data, error };
  },

  /** A team's members (id, role, player_id) with the player card, as `{ data, error }`. */
  async getTeamSquadRoster(teamId: string) {
    const { data, error } = await supabase
      .from('tournament_team_members')
      .select('id, role, player_id, players!tournament_team_members_player_id_fkey(id, full_name, avatar_url, gender)')
      .eq('team_id', teamId);
    return { data, error };
  },

  /**
   * A tie's rubbers with all four players (id, full_name, avatar_url, gender)
   * and the revealer, by playing order (nulls last). Throws on error.
   */
  async getTieRubbersWithPlayers(tieId: string) {
    const { data, error } = await supabase
      .from('tournament_matches')
      .select(`
          *,
          player1:players!tournament_matches_player1_id_fkey(id, full_name, avatar_url, gender),
          player2:players!tournament_matches_player2_id_fkey(id, full_name, avatar_url, gender),
          player3:players!tournament_matches_player3_id_fkey(id, full_name, avatar_url, gender),
          player4:players!tournament_matches_player4_id_fkey(id, full_name, avatar_url, gender),
          revealer:players!tournament_matches_revealed_by_fkey(id, full_name)
        `)
      .eq('tie_id', tieId)
      .order('playing_order', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data;
  },

  /** The user's watcher row (id) for a tie, as `{ data, error }`. */
  async getTieWatcher(tieId: string, userId: string) {
    const { data, error } = await supabase
      .from('tie_lineup_watchers')
      .select('id')
      .eq('tie_id', tieId)
      .eq('user_id', userId)
      .maybeSingle();
    return { data, error };
  },

  /** Stops the user's lineup notifications for a tie. Throws on error. */
  async unwatchTie(tieId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('tie_lineup_watchers')
      .delete()
      .eq('tie_id', tieId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  /** Subscribes the user to lineup notifications for a tie. Throws on error. */
  async watchTie(tieId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('tie_lineup_watchers')
      .insert({
        tie_id: tieId,
        user_id: userId,
      });
    if (error) throw error;
  },

  /** Team detail header (id, name, short_name, pool, captain_id, tournament_id, logo_url), or null (missing row or error). */
  async getTeamDetailRecord(teamId: string) {
    const { data } = await supabase
      .from('tournament_teams')
      .select('id, name, short_name, pool, captain_id, tournament_id, logo_url')
      .eq('id', teamId)
      .maybeSingle();
    return data;
  },

  /** A team's ACTIVE members with the player card (incl. elo_rating). Returns null on error. */
  async getActiveTeamMembersWithCards(teamId: string) {
    const { data } = await supabase
      .from('tournament_team_members')
      .select('id, player_id, role, status, player:players!player_id(id, full_name, gender, is_guest, avatar_url, elo_rating)')
      .eq('team_id', teamId)
      .eq('status', 'ACTIVE');
    return data;
  },

  /** Ties involving a team with scores and both teams (id, name, short_name, logo_url), oldest first. Returns null on error. */
  async getTeamTiesWithScores(teamId: string) {
    const { data } = await supabase
      .from('tournament_ties')
      .select(`
            id,
            tie_code,
            round_name,
            stage,
            state,
            score_team_a,
            score_team_b,
            winner_team_id,
            created_at,
            team_a:tournament_teams!tournament_ties_team_a_id_fkey(id, name, short_name, logo_url),
            team_b:tournament_teams!tournament_ties_team_b_id_fkey(id, name, short_name, logo_url)
          `)
      .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
      .order('created_at', { ascending: true });
    return data;
  },

  /** Rubber summaries (order, status, set scores, player names) of the given ties. Returns null on error. */
  async getTieRubberSummaries(tieIds: string[]) {
    const { data } = await supabase
      .from('tournament_matches')
      .select(`
              id,
              tie_id,
              match_code,
              category,
              rubber_order,
              rubber_label,
              playing_order,
              status,
              winner_team,
              set1_team1, set1_team2,
              set2_team1, set2_team2,
              set3_team1, set3_team2,
              player1:players!tournament_matches_player1_id_fkey(full_name),
              player2:players!tournament_matches_player2_id_fkey(full_name),
              player3:players!tournament_matches_player3_id_fkey(full_name),
              player4:players!tournament_matches_player4_id_fkey(full_name)
            `)
      .in('tie_id', tieIds);
    return data;
  },

  async submitDeciderLineup(tieId: string, side: string, player1Id: string, player2Id: string | null) {
    const { data, error } = await supabase.rpc('submit_decider_lineup', {
      p_tie_id: tieId,
      p_side: side,
      p_player1_id: player1Id,
      p_player2_id: player2Id,
    });
    if (error) throw error;
    return data;
  },
};
