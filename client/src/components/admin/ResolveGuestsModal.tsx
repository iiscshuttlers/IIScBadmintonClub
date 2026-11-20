import React, { useState, useEffect } from "react";
import { adminService } from "@/services/adminService";
import { toast } from "sonner";
import { X, Search, Link2, Loader2, Sparkles, CheckCheck } from "lucide-react";
import { PlayerSelect } from "@/components/umpire/PlayerSelect";
import { useAdminPlayers } from "@/hooks/usePlayers";
import { PlayerMergeDialog } from "@/components/admin/PlayerMergeDialog";

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
  const [reviewing, setReviewing] = useState<{ guestId: string; realId: string } | null>(null);
  const [autoLinking, setAutoLinking] = useState(false);
  const [selectedRealUserId, setSelectedRealUserId] = useState<Record<string, string>>({});
  
  const { data: allPlayers, refetch: refetchPlayers } = useAdminPlayers();

  useEffect(() => {
    if (isOpen) {
      loadGuests();
    }
  }, [isOpen, tournamentId]);

  const loadGuests = async () => {
    setLoading(true);
    try {
      const initialGuests = await adminService.fetchTournamentTeamGuests(tournamentId);

      if (initialGuests.length === 0) {
        setGuests([]);
        setLoading(false);
        return;
      }

      // Ensure we have registered players for matching
      let registered: any[] = (allPlayers || []).filter(p => !p.is_guest);
      if (registered.length === 0) {
        const dbPlayers = await adminService.fetchCandidatePlayers();
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

        // WP8: nothing is merged automatically. Strong candidates (email
        // match ≥ 1000, likely ≥ 300) are only pre-selected for review.

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
    } catch (err: any) {
      toast.error(err?.message || "Failed to load guests.");
    } finally {
      setLoading(false);
    }
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

    // Previewed, reasoned merge (WP8) instead of a direct one-click link.
    setReviewing({ guestId, realId });
  };

  const registeredPlayers = (allPlayers || []).filter(p => !p.is_guest);

  const matchedCandidatesCount = guests.filter(g => {
    const top = getSortedCandidatesForGuest(g, registeredPlayers)[0];
    return top && top._score >= 300;
  }).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-media/60 backdrop-blur-sm">
      {reviewing && (
        <PlayerMergeDialog
          open
          onOpenChange={(o) => { if (!o) setReviewing(null); }}
          guestId={reviewing.guestId}
          realId={reviewing.realId}
          onMerged={() => {
            toast.success("Guest history linked");
            setGuests((prev) => prev.filter((g) => g.id !== reviewing.guestId));
            refetchPlayers();
          }}
        />
      )}
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-black text-foreground">Resolve Guests</h2>
            <p className="text-sm text-muted-foreground mt-1">Link ghost profiles to actual registered users.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} aria-label="Close" className="p-2 text-muted-foreground hover:text-soft bg-muted rounded-full">
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
            <div className="text-center p-8 text-muted-foreground">
              <CheckCheck className="w-10 h-10 text-success mx-auto mb-2" />
              <p className="font-bold text-soft">All players are linked to real accounts!</p>
              <p className="text-xs text-muted-foreground mt-1">No unresolved guest profiles found in this tournament.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {guests.map((guest) => {
                const candidatesForGuest = getSortedCandidatesForGuest(guest, registeredPlayers);
                const topSuggestion = candidatesForGuest[0]?._isSuggested ? candidatesForGuest[0] : null;

                return (
                  <div key={guest.id} className="p-4 border border-border-strong rounded-xl bg-muted/30 flex flex-col md:flex-row gap-4 items-center">
                    
                    <div className="flex-1 w-full min-w-0">
                      <div className="font-bold text-soft truncate">{guest.full_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{guest.email || "No email"}</div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-1 uppercase bg-muted-strong inline-block px-1.5 py-0.5 rounded">GUEST</div>
                    </div>

                    <div className="text-faint hidden md:block">
                      <Link2 className="w-5 h-5" />
                    </div>

                    <div className="flex-1 w-full min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Link to Real Account</label>
                        {topSuggestion && (
                          <span className="text-[10px] font-bold text-warning flex items-center gap-1">
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
