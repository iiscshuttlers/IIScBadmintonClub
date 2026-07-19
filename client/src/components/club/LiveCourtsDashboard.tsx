import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Activity, Users, MonitorPlay, AlertTriangle } from "lucide-react";

export function LiveCourtsDashboard() {
  const [courts, setCourts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourts = async () => {
      const { data, error } = await supabase
        .from('club_courts')
        .select(`
          *,
          matches (
            id,
            score,
            player1:players!matches_player1_id_fkey(name),
            player2:players!matches_player2_id_fkey(name),
            partner1:players!matches_partner1_id_fkey(name),
            partner2:players!matches_partner2_id_fkey(name)
          )
        `)
        .order('court_number', { ascending: true });

      if (data && !error) setCourts(data);
      setLoading(false);
    };

    fetchCourts();

    const channel = supabase.channel('live-courts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_courts' }, payload => {
        fetchCourts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return <div className="text-slate-400 text-sm animate-pulse text-center py-10">Loading Live Courts...</div>;
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <MonitorPlay className="w-5 h-5 text-sky-400" />
        <h2 className="text-lg font-black text-slate-100 uppercase tracking-widest">Live Court Status</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {courts.map((court) => (
          <div 
            key={court.id} 
            className={`border rounded-2xl p-4 flex flex-col ${
              court.status === 'occupied' 
                ? 'bg-slate-800/80 border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.1)]' 
                : court.status === 'maintenance'
                ? 'bg-rose-950/20 border-rose-500/20'
                : 'bg-slate-900/50 border-slate-700/50'
            }`}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="font-black text-xl text-slate-200">Court {court.court_number}</span>
              <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
                court.status === 'occupied' ? 'bg-sky-500/20 text-sky-400' :
                court.status === 'maintenance' ? 'bg-rose-500/20 text-rose-400' :
                'bg-emerald-500/20 text-emerald-400'
              }`}>
                {court.status === 'occupied' && <Activity className="w-3 h-3 inline mr-1 animate-pulse" />}
                {court.status}
              </span>
            </div>

            {court.status === 'occupied' && court.matches && (
              <div className="mt-2 flex-grow flex flex-col justify-center">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-300">
                      {court.matches.player1?.name} 
                      {court.matches.partner1 && ` / ${court.matches.partner1.name}`}
                    </span>
                  </div>
                  <div className="text-center font-black text-2xl text-sky-400 font-mono tracking-widest my-1">
                    {court.matches.score || "0 - 0"}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-300">
                      {court.matches.player2?.name}
                      {court.matches.partner2 && ` / ${court.matches.partner2.name}`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {court.status === 'open' && (
              <div className="flex-grow flex items-center justify-center text-slate-500 text-xs font-semibold py-8">
                Available for play
              </div>
            )}
            
            {court.status === 'maintenance' && (
              <div className="flex-grow flex flex-col items-center justify-center text-rose-500/70 text-xs font-semibold py-6">
                <AlertTriangle className="w-8 h-8 mb-2 opacity-50" />
                Under Maintenance
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
