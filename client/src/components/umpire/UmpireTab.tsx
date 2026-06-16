import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { UmpireEngine } from "./UmpireEngine";
import { Play, Tv2, Activity, AlertTriangle } from "lucide-react";
import { fetchSiteData } from "@/lib/siteData";

export function UmpireTab() {
  const { session, isUmpire } = useAuth();
  const [isUmpiring, setIsUmpiring] = useState(false);
  const [myLiveMatch, setMyLiveMatch] = useState<any>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;

    supabase
      .from("site_data")
      .select("value")
      .eq("key", "live_matches")
      .single()
      .then(({ data }) => {
        if (data?.value && data.value[session.user.id]) {
          setMyLiveMatch(data.value[session.user.id]);
        }
      });

    fetchSiteData<any>("club_settings", "settings.json").then(data => {
      if (data?.maintenanceMode) {
        setMaintenanceMode(true);
      }
    });

    const sub = supabase
      .channel("umpire_tab_matches")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_data",
          filter: "key=eq.live_matches",
        },
        (payload) => {
          if (payload.new && (payload.new as any).value) {
            setMyLiveMatch((payload.new as any).value[session.user.id] || null);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [session?.user?.id]);

  if (!session) return null;

  if (isUmpiring || myLiveMatch) {
    return (
      <div className="-mx-4 sm:mx-0 mb-6">
        <UmpireEngine
          userId={session.user.id}
          userEmail={session.user.email!}
          userName={session.user.user_metadata?.full_name || "Guest"}
          isTournamentUmpire={isUmpire}
          initialMatchState={myLiveMatch}
          onClose={() => {
            setIsUmpiring(false);
            setMyLiveMatch(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-8">
      <div className="flex flex-col items-center justify-center bg-slate-900 rounded-[2rem] p-12 shadow-xl border border-slate-800 gap-6 text-center">
        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center">
          <Tv2 className="w-10 h-10 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-white mb-2">
            Umpire Station
          </h2>
          <p className="text-slate-400 max-w-md mx-auto">
            {maintenanceMode 
              ? "Match logging is temporarily disabled due to system maintenance." 
              : "Start a new live broadcast. Your match will be visible to everyone in the Match Activity feed."}
          </p>
        </div>
        
        {maintenanceMode ? (
          <div className="bg-rose-900/40 text-rose-300 px-6 py-4 rounded-xl flex items-center gap-3 border border-rose-800">
            <AlertTriangle className="w-6 h-6" />
            <span className="font-bold">Maintenance Mode Active</span>
          </div>
        ) : (
          <button
            onClick={() => setIsUmpiring(true)}
            className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-colors text-lg"
          >
            <Play className="w-6 h-6 fill-white" /> Start Umpiring
          </button>
        )}
      </div>
      
      <RecentUmpireMatches 
        onEdit={(matchData) => {
          setMyLiveMatch(matchData);
          setIsUmpiring(true);
        }} 
      />
    </div>
  );
}

function RecentUmpireMatches({ onEdit }: { onEdit: (m: any) => void }) {
  const { profile, isAdmin } = useAuth();
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.id) return;
    const fetchRecent = async () => {
      let query = supabase.from("matches").select("*, player1:players!player1_id(full_name), player2:players!player2_id(full_name), partner1:players!team1_partner_id(full_name), partner2:players!team2_partner_id(full_name)").order("date", { ascending: false }).limit(20);
      if (!isAdmin) {
        query = query.eq("submitted_by", profile.id);
      }
      const { data } = await query;
      if (data) {
        const now = new Date().getTime();
        const filtered = data.filter(m => {
          const mDate = new Date(m.date).getTime();
          // Admin can see everything, umpires see last 15 mins (900000 ms)
          return isAdmin || (now - mDate <= 900000);
        });
        setRecent(filtered);
      }
    };
    fetchRecent();
    const interval = setInterval(fetchRecent, 30000);
    return () => clearInterval(interval);
  }, [profile?.id, isAdmin]);

  if (recent.length === 0) return null;

  return (
    <div className="bg-slate-900 rounded-[2rem] p-8 shadow-xl border border-slate-800">
      <h3 className="text-xl font-black text-white mb-4">Recent Submissions (Editable for 15m)</h3>
      <div className="space-y-3">
        {recent.map(m => (
          <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-800 rounded-xl gap-4">
            <div>
              <p className="text-slate-300 font-bold text-sm">
                {m.player1?.full_name} vs {m.player2?.full_name}
              </p>
              <p className="text-emerald-400 font-bold text-xs">{m.match_score}</p>
            </div>
            <button 
              onClick={() => onEdit({ ...m, is_edit_mode: true })}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg transition-colors shrink-0"
            >
              Edit Score
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
