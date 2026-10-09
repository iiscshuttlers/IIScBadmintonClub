import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useConfirm } from "@/contexts/ConfirmContext";
import { PlayerSelect } from "@/components/umpire/PlayerSelect";
import { Users, Plus, Trash2, ChevronDown, ChevronRight, Edit, Loader2, Upload } from "lucide-react";

import { usePlayers } from "@/hooks/usePlayers";
import { ResolveGuestsModal } from "./ResolveGuestsModal";

export function TeamsTab({ tournament }: { tournament: any }) {
  const [teams, setTeams] = useState<any[]>([]);
  const { data: allPlayers, refetch: refetchPlayers } = usePlayers();
  const [loading, setLoading] = useState(true);
  const [addingTeam, setAddingTeam] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", short_name: "", captain_id: null as string | null });
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<Record<string, any[]>>({});
  const [resolvingGuests, setResolvingGuests] = useState(false);
  
  // Add player to team roster state
  const [addingPlayerTeamId, setAddingPlayerTeamId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("PLAYER");
  const [addingMemberLoading, setAddingMemberLoading] = useState(false);

  const { confirm } = useConfirm();

  const loadTeams = useCallback(async () => {
    setLoading(true);
    const { data: teamsData, error: teamsError } = await supabase
      .from("tournament_teams")
      .select("*, captain:players!captain_id(full_name)")
      .eq("tournament_id", tournament.id)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: true });
    
    if (teamsError) {
      toast.error("Failed to load teams");
      console.error(teamsError);
      setLoading(false);
      return;
    } 

    setTeams(teamsData || []);

    if (teamsData && teamsData.length > 0) {
      const { data: membersData } = await supabase
        .from("tournament_team_members")
        .select("*, player:players!player_id(full_name, email, is_guest)")
        .eq("tournament_id", tournament.id)
        .eq("status", "ACTIVE");
      
      if (membersData) {
        const membersByTeam: Record<string, any[]> = {};
        teamsData.forEach(t => membersByTeam[t.id] = []);
        membersData.forEach(m => {
          if (membersByTeam[m.team_id]) {
            membersByTeam[m.team_id].push(m);
          }
        });
        setTeamMembers(membersByTeam);
      }
    } else {
      setTeamMembers({});
    }

    setLoading(false);
  }, [tournament.id]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const toggleExpand = (teamId: string) => {
    if (expandedTeamId === teamId) {
      setExpandedTeamId(null);
    } else {
      setExpandedTeamId(teamId);
    }
  };

  const handleAddTeam = async () => {
    if (!newTeam.name || !newTeam.short_name) {
      toast.error("Please fill in Team Name and Short Name");
      return;
    }

    let finalCaptainId = newTeam.captain_id;

    // Check if captain_id is raw text (i.e. guest name typed without selecting an existing player ID)
    if (finalCaptainId && finalCaptainId.trim().length > 0 && !finalCaptainId.includes("-")) {
      const cleanInput = finalCaptainId.trim().toLowerCase();
      const existingPlayer = (allPlayers || []).find(p => 
        !p.is_guest && (
          (p.email && p.email.toLowerCase() === cleanInput) ||
          (p.iisc_email && p.iisc_email.toLowerCase() === cleanInput) ||
          (p.full_name.toLowerCase() === cleanInput)
        )
      );

      if (existingPlayer) {
        finalCaptainId = existingPlayer.id;
      } else {
        const { data: newGuest, error: guestError } = await supabase.rpc("create_guest_player", {
          p_full_name: finalCaptainId.trim(),
          p_gender: null
        });
        if (guestError || !newGuest) {
          toast.error("Failed to create guest profile for captain: " + (guestError?.message || ""));
          return;
        }
        finalCaptainId = newGuest.id;
        refetchPlayers();
      }
    }
    
    const { data: teamData, error } = await supabase.from("tournament_teams").insert({
      tournament_id: tournament.id,
      name: newTeam.name,
      short_name: newTeam.short_name.toUpperCase().substring(0, 5),
      captain_id: finalCaptainId || null
    }).select("id").single();

    if (error) {
      toast.error(error.message);
    } else {
      if (finalCaptainId && teamData) {
        const { error: memberError } = await supabase.from("tournament_team_members").insert({
          team_id: teamData.id,
          tournament_id: tournament.id,
          player_id: finalCaptainId,
          role: "CAPTAIN",
          status: "ACTIVE"
        });
        if (memberError && memberError.code !== "23505") {
          console.warn("Could not add captain to roster:", memberError);
        }
      }
      toast.success("Team added");
      setAddingTeam(false);
      setNewTeam({ name: "", short_name: "", captain_id: null });
      loadTeams();
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (await confirm({ title: "Delete Team?", message: "Are you sure you want to remove this team? All roster data will be lost.", confirmText: "Delete", confirmColor: "bg-red-600" })) {
      const { error } = await supabase.from("tournament_teams").delete().eq("id", teamId);
      if (error) toast.error(error.message);
      else {
        toast.success("Team deleted");
        loadTeams();
      }
    }
  };

  const handleAddMember = async (teamId: string) => {
    if (!selectedPlayerId || !selectedPlayerId.trim()) {
      toast.error("Please select or enter a player");
      return;
    }
    setAddingMemberLoading(true);
    try {
      let finalPlayerId = selectedPlayerId.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalPlayerId);
      
      if (!isUuid) {
        const cleanInput = finalPlayerId.toLowerCase();
        const existingPlayer = (allPlayers || []).find(p => 
          !p.is_guest && (
            (p.email && p.email.toLowerCase() === cleanInput) ||
            (p.iisc_email && p.iisc_email.toLowerCase() === cleanInput) ||
            (p.full_name.toLowerCase() === cleanInput)
          )
        );

        if (existingPlayer) {
          finalPlayerId = existingPlayer.id;
        } else {
          // Auto-create guest player
          const { data: guestData, error: guestError } = await supabase.rpc("create_guest_player", {
            p_full_name: finalPlayerId,
            p_gender: null
          });
          if (guestError || !guestData) {
            toast.error("Failed to create guest player: " + (guestError?.message || "Unknown error"));
            setAddingMemberLoading(false);
            return;
          }
          finalPlayerId = guestData.id;
          refetchPlayers();
        }
      }

      // Check if already in this team
      const currentMembers = teamMembers[teamId] || [];
      if (currentMembers.some(m => m.player_id === finalPlayerId)) {
        toast.error("This player is already in this team's roster");
        setAddingMemberLoading(false);
        return;
      }

      const { error: insertError } = await supabase.from("tournament_team_members").insert({
        team_id: teamId,
        tournament_id: tournament.id,
        player_id: finalPlayerId,
        role: selectedRole,
        status: "ACTIVE"
      });

      if (insertError) {
        if (insertError.code === "23505") {
          toast.error("Player is already assigned to a team in this tournament");
        } else {
          toast.error("Failed to add player: " + insertError.message);
        }
        setAddingMemberLoading(false);
        return;
      }

      if (selectedRole === "CAPTAIN") {
        await supabase.from("tournament_teams").update({ captain_id: finalPlayerId }).eq("id", teamId);
      }

      toast.success("Player added to roster");
      setAddingPlayerTeamId(null);
      setSelectedPlayerId("");
      setSelectedRole("PLAYER");
      await loadTeams();
    } catch (err: any) {
      toast.error("Error adding player: " + err.message);
    } finally {
      setAddingMemberLoading(false);
    }
  };

  const handleAddCaptainToRoster = async (teamId: string, captainId: string) => {
    try {
      const { error } = await supabase.from("tournament_team_members").insert({
        team_id: teamId,
        tournament_id: tournament.id,
        player_id: captainId,
        role: "CAPTAIN",
        status: "ACTIVE"
      });
      if (error) {
        if (error.code === "23505") {
          toast.error("Captain is already in a team in this tournament");
        } else {
          toast.error("Failed to add captain: " + error.message);
        }
      } else {
        toast.success("Captain added to roster");
        loadTeams();
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteMember = async (memberId: string, memberPlayerId: string, memberName: string, teamId: string, teamCaptainId?: string) => {
    if (await confirm({ 
      title: "Remove Player?", 
      message: `Are you sure you want to remove ${memberName || "this player"} from the team roster?`, 
      confirmText: "Remove", 
      confirmColor: "bg-red-600" 
    })) {
      const { error } = await supabase.from("tournament_team_members").delete().eq("id", memberId);
      if (error) {
        toast.error("Failed to remove player: " + error.message);
      } else {
        if (teamCaptainId === memberPlayerId) {
          await supabase.from("tournament_teams").update({ captain_id: null }).eq("id", teamId);
        }
        toast.success("Player removed from team");
        loadTeams();
      }
    }
  };

  const handleChangeRole = async (memberId: string, teamId: string, playerId: string, newRole: string) => {
    const { error } = await supabase.from("tournament_team_members").update({ role: newRole }).eq("id", memberId);
    if (error) {
      toast.error("Failed to update role: " + error.message);
    } else {
      if (newRole === "CAPTAIN") {
        await supabase.from("tournament_teams").update({ captain_id: playerId }).eq("id", teamId);
      }
      toast.success("Role updated");
      loadTeams();
    }
  };

  const [importMode, setImportMode] = useState<"merge" | "update" | "replace">("merge");

  const handleBulkImport = async () => {
    if (!bulkText.trim()) return;
    setBulkLoading(true);
    try {
      const rows = bulkText.split('\n').map(r => r.trim()).filter(Boolean);
      // Skip header if looks like one
      const dataRows = rows[0].toLowerCase().includes("team") ? rows.slice(1) : rows;
      
      let successCount = 0;
      let errorCount = 0;
      const errorMessages = new Set<string>();

      // Map to hold team names to IDs to add members in the same go
      const teamCache: Record<string, string> = {};

      for (const row of dataRows) {
        // Expected: Team Name, Short Name, Player Name, Email, Role
        const parts = row.split(',').map(p => p.trim());
        if (parts.length < 3) continue;
        
        let teamName, shortName, playerName, email, roleRaw;
        // Support new 5-column format, fallback to 4-column
        if (parts.length >= 5 && parts[3].includes('@')) {
           // Team Name, Short Name, Player Name, Email, Role
           [teamName, shortName, playerName, email, roleRaw] = parts;
        } else {
           // Team Name, Short Name, Email, Role
           [teamName, shortName, email, roleRaw] = parts;
           playerName = email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }

        const role = (roleRaw || "PLAYER").toUpperCase();

        // Find the player by account email OR IISc email (prefer registered non-guest account)
        const cleanEmail = email.trim().toLowerCase();
        let { data: matchingPlayers } = await supabase
          .from("players")
          .select("id, is_guest")
          .or(`email.ilike.${cleanEmail},iisc_email.ilike.${cleanEmail}`);

        let player = matchingPlayers?.find(p => !p.is_guest) || matchingPlayers?.[0] || null;

        if (!player) {
          // Player not found by either account email or iisc_email, auto-create a Guest Profile
          const { data: newGuest, error: guestError } = await supabase.rpc("create_guest_player_with_email", {
            p_email: email,
            p_full_name: playerName + " (Guest)"
          });
          
          if (guestError || !newGuest) {
            errorCount++;
            errorMessages.add(`Failed to create guest profile for ${email}.`);
            continue;
          }
          player = { id: newGuest.id };
        }

        let teamId = teamCache[teamName];
        
        if (!teamId) {
          // Check if team exists
          const { data: existingTeam } = await supabase.from("tournament_teams").select("id").eq("tournament_id", tournament.id).ilike("name", teamName).maybeSingle();
          if (existingTeam) {
            teamId = existingTeam.id;
            // If REPLACE mode and we haven't processed this team yet in this import, clear the roster
            if (importMode === "replace") {
              await supabase.from("tournament_team_members").delete().eq("team_id", teamId);
            }
          } else {
            // Create team if it's the captain row or we just assign a dummy captain and fix later
            // For now, if creating a team, the first player becomes captain if not specified
            const teamShortName = (shortName || teamName).substring(0, 5).toUpperCase();
            const { data: newTeamData, error: createError } = await supabase.from("tournament_teams").insert({
              tournament_id: tournament.id,
              name: teamName,
              short_name: teamShortName,
              captain_id: player.id // Defaulting this player to captain
            }).select("id").single();
            
            if (createError) {
              if (createError.code === '23505' && createError.message?.includes('short_name')) {
                errorMessages.add(`Short Name '${teamShortName}' is already taken.`);
              } else if (createError.code === '23505' && createError.message?.includes('name')) {
                errorMessages.add(`Team Name '${teamName}' is already taken.`);
              } else {
                errorMessages.add(`Error creating team '${teamName}'.`);
              }
              errorCount++;
              continue;
            }
            teamId = newTeamData.id;
          }
          teamCache[teamName] = teamId;
        }

        // Add player to team roster
        if (role === "CAPTAIN") {
          await supabase.from("tournament_teams").update({ captain_id: player.id }).eq("id", teamId);
        }

        const memberRole = role === "CAPTAIN" ? "CAPTAIN" : role === "VICE_CAPTAIN" ? "VICE_CAPTAIN" : role === "MANAGER" ? "MANAGER" : "PLAYER";

        if (importMode === "merge") {
          const { error: memberError } = await supabase.from("tournament_team_members").insert({
            team_id: teamId,
            player_id: player.id,
            tournament_id: tournament.id,
            role: memberRole,
            status: "ACTIVE"
          });
          if (memberError && memberError.code !== '23505') { // Ignore unique constraint violation on merge
             errorCount++;
             errorMessages.add(`Failed to add ${email} to ${teamName}.`);
             continue;
          }
        } else {
          // Update or Replace modes will upsert the new role
          const { error: upsertError } = await supabase.from("tournament_team_members").upsert({
            team_id: teamId,
            tournament_id: tournament.id,
            player_id: player.id,
            role: memberRole,
            status: "ACTIVE"
          }, { onConflict: "team_id,player_id" });
          if (upsertError) {
            errorCount++;
            errorMessages.add(`Failed to update ${email}.`);
            continue;
          }
        }
        successCount++;
      }
      
      if (errorCount === 0) {
        toast.success(`Import complete: ${successCount} players imported successfully.`);
      } else {
        toast.error(`Import finished with ${errorCount} errors. ${Array.from(errorMessages).join(' ')}`, { duration: 6000 });
      }
      
      setBulkImporting(false);
      setBulkText("");
      loadTeams();
    } catch (e: any) {
      toast.error("Import failed: " + e.message);
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-foreground">Teams</h2>
            <p className="text-sm text-muted-foreground mt-1">Manage teams, rosters, and imports.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button 
              onClick={() => setResolvingGuests(true)}
              className="flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 font-bold rounded-xl text-sm transition"
            >
              <Users className="w-4 h-4" /> Resolve Guests
            </button>
            <button 
              onClick={() => { setBulkImporting(!bulkImporting); setAddingTeam(false); }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold rounded-xl text-sm transition"
            >
              <Upload className="w-4 h-4" /> Bulk / CSV
            </button>
            <button 
              onClick={() => { setAddingTeam(true); setBulkImporting(false); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-sm"
            >
              <Plus className="w-4 h-4" /> Add Team
            </button>
          </div>
        </div>

        {addingTeam && (
          <div className="mb-6 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Team Name</label>
                <input 
                  type="text" 
                  value={newTeam.name} 
                  onChange={e => setNewTeam({...newTeam, name: e.target.value})} 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm" 
                  placeholder="e.g. Physics Smashers"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Short Name (Max 5 chars)</label>
                <input 
                  type="text" 
                  value={newTeam.short_name} 
                  onChange={e => setNewTeam({...newTeam, short_name: e.target.value.toUpperCase().substring(0, 5)})} 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm" 
                  placeholder="e.g. PHY"
                  maxLength={5}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Captain</label>
                <PlayerSelect 
                  value={newTeam.captain_id || ""} 
                  onChange={v => setNewTeam({...newTeam, captain_id: v})} 
                  players={allPlayers ?? []}
                  placeholder="Search player..." 
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAddingTeam(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancel</button>
              <button onClick={handleAddTeam} className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg">Save Team</button>
            </div>
          </div>
        )}

        {bulkImporting && (
          <div className="mb-6 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-4">
            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="block text-xs font-bold text-slate-500">Paste or Upload CSV Data</label>
                <label className="cursor-pointer text-xs font-bold text-primary hover:underline flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  Upload File
                  <input 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const text = event.target?.result as string;
                        if (text) setBulkText(text);
                      };
                      reader.readAsText(file);
                      e.target.value = ""; // Reset to allow same file upload again
                    }} 
                  />
                </label>
              </div>
              <textarea 
                rows={6}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-slate-400"
                placeholder="Team Name, Short Name, Email, Role&#10;Physics Smashers, PHY, captain@iisc.ac.in, CAPTAIN&#10;Physics Smashers, PHY, player1@iisc.ac.in, PLAYER"
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                Header row is optional. Columns must be: <strong className="text-primary dark:text-primary">Team Name</strong>, <strong className="text-[var(--info)] dark:text-[var(--info)]">Short Name</strong>, <strong className="text-[var(--warning)] dark:text-[var(--warning)]">Player Name</strong>, <strong className="text-[var(--success)] dark:text-[var(--success)]">Player Email</strong>, <strong className="text-[var(--danger)] dark:text-[var(--danger)]">Role</strong> (<span className="text-slate-600 dark:text-slate-300 font-mono text-[9px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">CAPTAIN</span> / <span className="text-slate-600 dark:text-slate-300 font-mono text-[9px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">VICE_CAPTAIN</span> / <span className="text-slate-600 dark:text-slate-300 font-mono text-[9px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">MANAGER</span> / <span className="text-slate-600 dark:text-slate-300 font-mono text-[9px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">PLAYER</span>).
                If the team does not exist, it will be created. The first player parsed for a new team will be set as its Captain in the system.
              </p>
            </div>
            <div className="flex justify-between items-center mt-4">
              <button 
                onClick={() => {
                  const content = "Team Name,Short Name,Player Name,Email,Role\nPhysics Smashers,PHY,Dr. Raman,captain@iisc.ac.in,CAPTAIN\nPhysics Smashers,PHY,Student One,player1@iisc.ac.in,PLAYER\nMath Mavericks,MATH,Alice Smith,alice@iisc.ac.in,CAPTAIN\nMath Mavericks,MATH,Bob Jones,bob@iisc.ac.in,PLAYER";
                  const blob = new Blob([content], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'team_import_template.csv';
                  a.click();
                }}
                className="text-xs font-bold text-primary hover:underline"
              >
                Download Sample CSV
              </button>
              <div className="flex justify-end gap-2 items-center">
                {teams.length > 0 && bulkText.trim().length > 0 && (
                  <select 
                    value={importMode} 
                    onChange={(e) => setImportMode(e.target.value as any)}
                    className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  >
                    <option value="merge">Mode: Merge (Skip existing)</option>
                    <option value="update">Mode: Update Roles</option>
                    <option value="replace">Mode: Replace Team</option>
                  </select>
                )}
                <button onClick={() => setBulkImporting(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancel</button>
                <button onClick={handleBulkImport} disabled={bulkLoading || !bulkText.trim()} className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
                  {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Import Teams"}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No Teams Added</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-2">
              Click the "Add Team" button above to register the first team manually, or use the bulk uploader.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {teams.map(team => (
              <div key={team.id} className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                
                {/* Card Header */}
                <div 
                  className="p-5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20 flex justify-between items-start cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors"
                  onClick={() => toggleExpand(team.id)}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      {expandedTeamId === team.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      <h4 className="font-black text-lg text-slate-800 dark:text-slate-100 leading-none">{team.name}</h4>
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] uppercase font-black tracking-wider border border-primary/20">
                        {team.short_name}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-bold flex items-center gap-1 pl-6">
                      Captain: <span className="text-slate-600 dark:text-slate-400">{team.captain?.full_name || "Unassigned"}</span>
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full mr-2">
                       {teamMembers[team.id]?.length || 0}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteTeam(team.id); }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors shrink-0"
                      title="Delete Team"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Roster Area */}
                {expandedTeamId === team.id && (
                  <>
                    <div className="flex-1 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="font-bold text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">Team Roster</h5>
                      </div>

                      {team.captain_id && !teamMembers[team.id]?.some(m => m.player_id === team.captain_id) && (
                        <div className="mb-3 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-center justify-between text-xs">
                          <span className="text-amber-800 dark:text-amber-200 text-xs">
                            Captain (<strong>{team.captain?.full_name}</strong>) is not in roster
                          </span>
                          <button 
                            type="button"
                            onClick={() => handleAddCaptainToRoster(team.id, team.captain_id)}
                            className="font-bold text-amber-700 dark:text-amber-300 hover:underline shrink-0 ml-2"
                          >
                            + Add to Roster
                          </button>
                        </div>
                      )}
                      
                      {!teamMembers[team.id] ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
                      ) : teamMembers[team.id]?.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                           <p className="text-xs font-bold">No players added</p>
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                           <table className="w-full text-sm text-left">
                             <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                               {teamMembers[team.id].map(member => (
                                 <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group transition-colors">
                                   <td className="px-3 py-2.5">
                                     <div className="flex flex-col">
                                       <span className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate max-w-[140px]">{member.player?.full_name}</span>
                                       {member.player?.is_guest && <span className="text-[8px] uppercase font-black tracking-widest text-slate-400 mt-0.5">Guest</span>}
                                     </div>
                                   </td>
                                   <td className="px-2 py-2.5 w-28">
                                     <select 
                                       value={member.role}
                                       onChange={(e) => handleChangeRole(member.id, team.id, member.player_id, e.target.value)}
                                       className="w-full bg-transparent text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 outline-none cursor-pointer hover:text-primary transition-colors focus:ring-0 appearance-none"
                                       style={{ backgroundImage: 'none' }}
                                     >
                                       <option value="PLAYER" className="dark:bg-slate-800">Player</option>
                                       <option value="CAPTAIN" className="dark:bg-slate-800">Captain</option>
                                       <option value="VICE_CAPTAIN" className="dark:bg-slate-800">Vice Capt</option>
                                       <option value="MANAGER" className="dark:bg-slate-800">Manager</option>
                                     </select>
                                   </td>
                                   <td className="px-2 py-2.5 text-right w-10">
                                     <button 
                                       type="button"
                                       onClick={() => handleDeleteMember(member.id, member.player_id, member.player?.full_name || "Player", team.id, team.captain_id)}
                                       className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors inline-flex items-center justify-center opacity-0 group-hover:opacity-100"
                                       title="Remove player"
                                     >
                                       <Trash2 className="w-3.5 h-3.5" />
                                     </button>
                                   </td>
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Add Player */}
                    <div className="p-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20">
                       {addingPlayerTeamId === team.id ? (
                         <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 shadow-sm">
                           <div className="flex items-center justify-between">
                             <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                               <Users className="w-3.5 h-3.5 text-primary" /> Add Player to {team.name}
                             </span>
                             <button 
                               type="button"
                               onClick={() => {
                                 setAddingPlayerTeamId(null);
                                 setSelectedPlayerId("");
                               }}
                               className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold"
                             >
                               Cancel
                             </button>
                           </div>

                           <div className="space-y-2">
                             <div>
                               <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                 Player
                               </label>
                               <PlayerSelect 
                                 value={selectedPlayerId}
                                 onChange={(v) => setSelectedPlayerId(v)}
                                 players={allPlayers ?? []}
                                 placeholder="Search player or type guest name..."
                               />
                             </div>

                             <div>
                               <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                 Role
                               </label>
                               <select 
                                 value={selectedRole}
                                 onChange={(e) => setSelectedRole(e.target.value)}
                                 className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary"
                               >
                                 <option value="PLAYER">Player</option>
                                 <option value="CAPTAIN">Captain</option>
                                 <option value="VICE_CAPTAIN">Vice Captain</option>
                                 <option value="MANAGER">Manager</option>
                               </select>
                             </div>
                           </div>

                           <div className="flex justify-end gap-2 pt-1">
                             <button 
                               type="button"
                               onClick={() => {
                                 setAddingPlayerTeamId(null);
                                 setSelectedPlayerId("");
                               }}
                               className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg transition"
                             >
                               Cancel
                             </button>
                             <button 
                               type="button"
                               onClick={() => handleAddMember(team.id)}
                               disabled={addingMemberLoading || !selectedPlayerId.trim()}
                               className="px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-lg flex items-center gap-1.5 transition"
                             >
                               {addingMemberLoading ? (
                                 <>
                                   <Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding...
                                 </>
                               ) : (
                                 <>
                                   <Plus className="w-3.5 h-3.5" /> Add Player
                                 </>
                               )}
                             </button>
                           </div>
                         </div>
                       ) : (
                         <button 
                           type="button"
                           onClick={() => {
                             setAddingPlayerTeamId(team.id);
                             setSelectedPlayerId("");
                             setSelectedRole("PLAYER");
                           }}
                           className="w-full py-2 flex items-center justify-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                         >
                           <Plus className="w-4 h-4"/> ADD PLAYER
                         </button>
                       )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <ResolveGuestsModal 
        tournamentId={tournament.id}
        isOpen={resolvingGuests}
        onClose={() => {
          setResolvingGuests(false);
          loadTeams(); // Reload teams to reflect any linked players
        }}
      />
    </div>
  );
}
