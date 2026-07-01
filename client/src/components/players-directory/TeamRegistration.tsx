import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { usePlayers } from "@/hooks/usePlayers";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";

export function TeamRegistration({ onTeamRegistered }: { onTeamRegistered: () => void }) {
  const { session, profile } = useAuth();
  const { data: players } = usePlayers();
  
  const [partnerId, setPartnerId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);

  const currentUser = profile as any;

  const availablePartners = useMemo(() => {
    if (!players || !currentUser) return [];
    return players
      .filter((p) => p.id !== currentUser.id && !p.is_guest)
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [players, currentUser]);

  const selectedPartner = useMemo(() => {
    return players?.find((p) => p.id === partnerId);
  }, [players, partnerId]);

  const teamCategory = useMemo(() => {
    if (!currentUser || !selectedPartner) return "";
    const g1 = currentUser.gender?.toLowerCase();
    const g2 = selectedPartner.gender?.toLowerCase();
    if (!g1 || !g2) return "";
    if (g1 === g2) {
      return g1 === "female" ? "WD" : "MD";
    }
    return "XD";
  }, [currentUser, selectedPartner]);

  const handleRegister = async () => {
    if (!currentUser || !partnerId || !teamName) return;
    setLoading(true);

    try {
      // Create team
      const { error } = await supabase.from("doubles_teams").insert({
        team_name: teamName.trim(),
        player1_id: currentUser.id,
        player2_id: partnerId,
        category: teamCategory,
        elo_rating: 1200,
        matches_played: 0,
        matches_won: 0,
      });

      if (error) {
        if (error.code === '23505') {
          throw new Error("You and this partner already have a registered team!");
        }
        // Fallback for missing table
        if (error.code === '42P01') {
          throw new Error("Database migration required! Please run the 20260627000000_doubles_teams.sql script in Supabase.");
        }
        throw error;
      }

      toast.success("Team registered successfully!");
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      setTeamName("");
      setPartnerId("");
      onTeamRegistered();
    } catch (err: any) {
      toast.error(err.message || "Failed to register team.");
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-foreground dark:text-foreground uppercase tracking-wider">Register a Team</h2>
          <p className="text-sm font-medium text-muted-foreground">Form an official doubles partnership</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Select Partner</label>
            <select
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-bold text-slate-800 dark:text-slate-200"
            >
              <option value="">-- Choose Partner --</option>
              {availablePartners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Team Name</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. The Smashers"
              maxLength={30}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-bold text-slate-800 dark:text-slate-200 placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="md:col-span-7 flex flex-col justify-center">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 text-center">Team Preview</h3>
            
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden ring-4 ring-primary/20">
                  {currentUser.avatar_url ? (
                    <img src={currentUser.avatar_url} alt="You" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-bold">{currentUser.full_name?.[0]}</div>
                  )}
                </div>
                <span className="text-xs font-bold text-muted-foreground dark:text-slate-300">You</span>
              </div>

              <div className="text-slate-300 dark:text-muted-foreground">
                <Plus className="w-6 h-6" />
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden ring-4 ring-violet-500/20">
                  {selectedPartner?.avatar_url ? (
                    <img src={selectedPartner.avatar_url} alt="Partner" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground">
                      {selectedPartner ? selectedPartner.full_name[0] : "?"}
                    </div>
                  )}
                </div>
                <span className="text-xs font-bold text-muted-foreground dark:text-slate-300">
                  {selectedPartner ? selectedPartner.full_name.split(" ")[0] : "Partner"}
                </span>
              </div>
            </div>

            {teamCategory && (
              <div className="mt-4 text-center">
                <span className="inline-block px-3 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-black uppercase tracking-widest rounded-full">
                  Category: {teamCategory}
                </span>
              </div>
            )}
            
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleRegister}
                disabled={loading || !partnerId || !teamName || !teamCategory}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-foreground px-8 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-colors shadow-lg shadow-violet-500/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register Team"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
