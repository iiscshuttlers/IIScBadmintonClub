import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { X, Search, Link2, Loader2, Sparkles, CheckCheck } from "lucide-react";
import { PlayerSelect } from "@/components/umpire/PlayerSelect";
import { usePlayers } from "@/hooks/usePlayers";

function getCandidateScore(guest: any, player: any): number {
  const gEmail = (guest.email || "").trim().toLowerCase();
  const gName = (guest.full_name || "").replace(/\s*\(Guest\)$/i, "").trim().toLowerCase();
  
  const pEmail = (player.email || "").trim().toLowerCase();
  const pIiscEmail = (player.iisc_email || "").trim().toLowerCase();
  const pName = (player.full_name || "").trim().toLowerCase();
  const pNickname = (player.nickname || "").trim().toLowerCase();

  // 1. Exact match on IISc email or account email (Highest priority: 1000)
  if (gEmail && (gEmail === pIiscEmail || gEmail === pEmail)) {
    return 1000;
  }

  // 2. Exact match on full name or nickname (800)
  if (gName && (gName === pName || (pNickname && gName === pNickname))) {
    return 800;
  }

  // 3. Email handle match (e.g. "janmejayraja" in janmejayraja@iisc.ac.in vs Raja Janmejay) (600)
  const gHandle = gEmail.split("@")[0];
  const pHandle = pEmail.split("@")[0];
  const pIiscHandle = pIiscEmail.split("@")[0];

  if (gHandle && (gHandle === pIiscHandle || gHandle === pHandle)) {
    return 600;
  }

  // 4. Normalized name comparison (e.g. "Raja Janmejay" vs "Janmejayraja") (500)
  const gClean = gName.replace(/[^a-z0-9]/g, "");
  const pClean = pName.replace(/[^a-z0-9]/g, "");
  if (gClean && pClean && (gClean === pClean || pClean.includes(gClean) || gClean.includes(pClean))) {
    return 500;
  }

  // 5. Individual word match (e.g. first or last name overlap) (300+)
  const gWords = gName.split(/\s+/).filter(w => w.length > 2);
  const pWords = pName.split(/\s+/).filter(w => w.length > 2);
  let wordMatches = 0;
  for (const gw of gWords) {
    if (pWords.some(pw => pw.includes(gw) || gw.includes(pw))) {
      wordMatches++;
    }
  }
  if (wordMatches > 0) {
    return 300 + wordMatches * 50;
  }

  // 6. Handle contains name or name contains handle (200)
  if (gHandle && gHandle.length > 3 && (pClean.includes(gHandle) || gHandle.includes(pClean))) {
    return 200;
  }

  return 0;
}

function getSortedCandidatesForGuest(guest: any, registeredPlayers: any[]): any[] {
  return [...registeredPlayers]
    .map(p => {
      const score = getCandidateScore(guest, p);
      return {
        ...p,
        _score: score,
        _isSuggested: score > 0,
      };
    })
    .sort((a, b) => {
      if (b._score !== a._score) {
        return b._score - a._score;
      }
      return (b.elo_rating ?? 0) - (a.elo_rating ?? 0);
    });
}

export function ResolveGuestsModal({ 
  tournamentId, 
  isOpen, 
  onClose 
}: { 
  tournamentId: string;
  isOpen: boolean; 
  onClose: () => void;
}) {
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [autoLinking, setAutoLinking] = useState(false);
  const [selectedRealUserId, setSelectedRealUserId] = useState<Record<string, string>>({});
  
  const { data: allPlayers, refetch: refetchPlayers } = usePlayers();

  useEffect(() => {
    if (isOpen) {
      loadGuests();
    }
  }, [isOpen, tournamentId]);

  const loadGuests = async () => {
    setLoading(true);
    // Find all ghost players who are in this tournament's teams or are captains
    const { data, error } = await supabase
      .from("tournament_team_members")
      .select("player:players!player_id(id, full_name, email, iisc_email, created_at, is_guest)")
      .eq("tournament_id", tournamentId)
      .eq("status", "ACTIVE");
      
    if (error) {
      toast.error("Failed to load guests.");
      setLoading(false);
      return;
    }

    // Filter out unique guest players
    const guestMap = new Map();
    data?.forEach(row => {
      const p = row.player as any;
      if (p && p.id && !guestMap.has(p.id)) {
        guestMap.set(p.id, p);
      }
    });
    
    // Also check captains
    const { data: teamsData } = await supabase
      .from("tournament_teams")
      .select("captain:players!captain_id(id, full_name, email, iisc_email, created_at, is_guest)")
      .eq("tournament_id", tournamentId);
      
    teamsData?.forEach(row => {
      const p = row.captain as any;
      if (p && p.id && !guestMap.has(p.id)) {
        guestMap.set(p.id, p);
      }
    });

    const playerIds = Array.from(guestMap.keys());
    if (playerIds.length === 0) {
      setGuests([]);
      setLoading(false);
      return;
    }

    const { data: guestProfiles } = await supabase
      .from("players")
      .select("id, full_name, email, iisc_email, is_guest, created_at")
      .in("id", playerIds)
      .eq("is_guest", true);

    const initialGuests = guestProfiles || [];

    // Ensure we have registered players for matching
    let registered = (allPlayers || []).filter(p => !p.is_guest);
    if (registered.length === 0) {
      const { data: dbPlayers } = await supabase
        .from("players")
        .select("id, full_name, email, iisc_email, is_guest, elo_rating, nickname")
        .eq("is_guest", false)
        .is("deleted_at", null);
      if (dbPlayers) registered = dbPlayers;
    }

    // AUTO-LINK:
    // If any guest's email matches a registered player's account email or IISc email,
    // automatically link them!
    const remainingGuests: any[] = [];
    const initialSelected: Record<string, string> = {};
    let autoLinkedCount = 0;

    for (const guest of initialGuests) {
      const candidates = getSortedCandidatesForGuest(guest, registered);
      const topMatch = candidates[0];

      // Exact email match (score >= 1000)
      if (topMatch && topMatch._score >= 1000) {
        try {
          const { error: mergeErr } = await supabase.rpc("merge_guest_player", {
            guest_id: guest.id,
            real_id: topMatch.id
          });
          if (!mergeErr) {
            autoLinkedCount++;
            continue; // Successfully auto-linked, omit from list
          }
        } catch (e) {
          console.warn("Auto-merge failed:", e);
        }
      }

      // Pre-select top candidate if it's a good match (score >= 300)
      if (topMatch && topMatch._score >= 300) {
        initialSelected[guest.id] = topMatch.id;
      }
      remainingGuests.push(guest);
    }

    if (autoLinkedCount > 0) {
      toast.success(`Auto-linked ${autoLinkedCount} guest profile${autoLinkedCount > 1 ? "s" : ""} to registered IISc account${autoLinkedCount > 1 ? "s" : ""}!`);
      refetchPlayers();
    }

    setGuests(remainingGuests);
    setSelectedRealUserId(initialSelected);
    setLoading(false);
  };

  const handleMerge = async (guestId: string) => {
    const realId = selectedRealUserId[guestId];
    if (!realId) {
      toast.error("Please select a valid registered profile to link to.");
      return;
    }
    
    if (realId === guestId) {
      toast.error("Cannot merge a profile into itself.");
      return;
    }

    const realUser = (allPlayers || []).find(p => p.id === realId);
    if (!realUser) {
      toast.error("Selected user not found.");
      return;
    }

    setMergingId(guestId);
    
    const { error } = await supabase.rpc("merge_guest_player", {
      guest_id: guestId,
      real_id: realId
    });

    if (error) {
      toast.error(error.message || "Failed to merge profiles.");
      setMergingId(null);
    } else {
      toast.success(`Profile successfully linked to ${realUser.full_name}!`);
      setGuests(prev => prev.filter(g => g.id !== guestId));
      setMergingId(null);
      refetchPlayers();
    }
  };

  const handleAutoLinkAll = async () => {
    setAutoLinking(true);
    let linked = 0;
    const registered = (allPlayers || []).filter(p => !p.is_guest);

    for (const guest of guests) {
      const realId = selectedRealUserId[guest.id];
      if (realId) {
        const { error } = await supabase.rpc("merge_guest_player", {
          guest_id: guest.id,
          real_id: realId
        });
        if (!error) linked++;
      }
    }

    toast.success(`Successfully linked ${linked} profile${linked > 1 ? "s" : ""}!`);
    setAutoLinking(false);
    refetchPlayers();
    loadGuests();
  };

  const registeredPlayers = (allPlayers || []).filter(p => !p.is_guest);

  const matchedCandidatesCount = guests.filter(g => {
    const top = getSortedCandidatesForGuest(g, registeredPlayers)[0];
    return top && top._score >= 300;
  }).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-foreground">Resolve Guests</h2>
            <p className="text-sm text-slate-500 mt-1">Link ghost profiles to actual registered users.</p>
          </div>
          <div className="flex items-center gap-2">
            {matchedCandidatesCount > 1 && (
              <button
                onClick={handleAutoLinkAll}
                disabled={autoLinking}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
              >
                {autoLinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Auto-Link All ({matchedCandidatesCount})
              </button>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : guests.length === 0 ? (
            <div className="text-center p-8 text-slate-500">
              <CheckCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-slate-700 dark:text-slate-300">All players are linked to real accounts!</p>
              <p className="text-xs text-muted-foreground mt-1">No unresolved guest profiles found in this tournament.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {guests.map((guest) => {
                const candidatesForGuest = getSortedCandidatesForGuest(guest, registeredPlayers);
                const topSuggestion = candidatesForGuest[0]?._isSuggested ? candidatesForGuest[0] : null;

                return (
                  <div key={guest.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/30 flex flex-col md:flex-row gap-4 items-center">
                    
                    <div className="flex-1 w-full min-w-0">
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{guest.full_name}</div>
                      <div className="text-xs text-slate-500 truncate">{guest.email || "No email"}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-1 uppercase bg-slate-200 dark:bg-slate-700 inline-block px-1.5 py-0.5 rounded">GUEST</div>
                    </div>

                    <div className="text-slate-300 dark:text-slate-600 hidden md:block">
                      <Link2 className="w-5 h-5" />
                    </div>

                    <div className="flex-1 w-full min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Link to Real Account</label>
                        {topSuggestion && (
                          <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Suggested
                          </span>
                        )}
                      </div>
                      <PlayerSelect 
                        value={selectedRealUserId[guest.id] || ""} 
                        onChange={v => setSelectedRealUserId({...selectedRealUserId, [guest.id]: v})} 
                        players={candidatesForGuest}
                        placeholder="Search registered player..." 
                      />
                    </div>

                    <button 
                      onClick={() => handleMerge(guest.id)}
                      disabled={mergingId === guest.id || !selectedRealUserId[guest.id]}
                      className="w-full md:w-auto px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg text-sm flex items-center justify-center disabled:opacity-50"
                    >
                      {mergingId === guest.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Link"}
                    </button>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
