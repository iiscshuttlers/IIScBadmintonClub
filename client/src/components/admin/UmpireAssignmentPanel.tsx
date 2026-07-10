import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Calendar, User, Swords, Clock } from "lucide-react";

export function UmpireAssignmentPanel() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [tournamentMatches, setTournamentMatches] = useState<any[]>([]);
  
  const [form, setForm] = useState({
    userId: "",
    tournamentMatchId: "",
    startTime: "",
    endTime: ""
  });

  const loadData = async () => {
    setLoading(true);
    
    // Load assignments
    const { data: aData } = await supabase
      .from("umpire_assignments")
      .select(`
        *,
        user:user_id(id, raw_user_meta_data),
        created_by_user:created_by(id, raw_user_meta_data)
      `)
      .order("created_at", { ascending: false });
    
    setAssignments(aData || []);

    // Load users (umpires or anyone)
    const { data: uData } = await supabase
      .from("players")
      .select("id, full_name, email")
      .order("full_name");
    
    // Note: auth.users is not queryable from client except by RPC or profile joining.
    // Assuming users are in players table with matching UUIDs, or we can just let admin type email.
    // For simplicity, let's fetch profiles from players where id is uuid.
    setUsers(uData?.filter(u => u.id.length > 20) || []);

    // Load upcoming tournament matches
    const { data: tmData } = await supabase
      .from("tournament_matches")
      .select("id, match_code, category, team1_label, team2_label")
      .in("status", ["pending", "playing"])
      .order("match_code");
    
    setTournamentMatches(tmData || []);
    
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async () => {
    if (!form.userId) {
      toast.error("Please select a user");
      return;
    }
    
    if (!form.tournamentMatchId && (!form.startTime || !form.endTime)) {
      toast.error("Please select either a match OR a time block (both start and end)");
      return;
    }

    let start = null;
    let end = null;
    if (form.startTime && form.endTime) {
      // Create local Date from input
      start = new Date(form.startTime).toISOString();
      end = new Date(form.endTime).toISOString();
    }

    const { error } = await supabase.from("umpire_assignments").insert({
      user_id: form.userId,
      tournament_match_id: form.tournamentMatchId || null,
      start_time: start,
      end_time: end,
      created_by: profile?.id
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Assignment added");
      setForm({ userId: "", tournamentMatchId: "", startTime: "", endTime: "" });
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("umpire_assignments").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Assignment removed");
      loadData();
    }
  };

  return (
    <div className="bg-slate-900 rounded-[2rem] p-6 shadow-xl border border-slate-800">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-5 h-5 text-indigo-400" />
        <h2 className="text-xl font-black text-foreground">Umpire Assignments</h2>
      </div>

      <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-4 mb-6">
        <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">New Assignment</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Umpire</label>
            <select
              value={form.userId}
              onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-foreground focus:border-indigo-500 outline-none"
            >
              <option value="">Select User...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Swords className="w-3.5 h-3.5" /> Specific Match (Optional)</label>
            <select
              value={form.tournamentMatchId}
              onChange={e => setForm(f => ({ ...f, tournamentMatchId: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-foreground focus:border-indigo-500 outline-none"
            >
              <option value="">Any Match</option>
              {tournamentMatches.map(tm => (
                <option key={tm.id} value={tm.id}>{tm.match_code} - {tm.category} ({tm.team1_label} vs {tm.team2_label})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Start Time (Optional)</label>
            <input
              type="datetime-local"
              value={form.startTime}
              onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-foreground focus:border-indigo-500 outline-none [color-scheme:dark]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> End Time (Optional)</label>
            <input
              type="datetime-local"
              value={form.endTime}
              onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-foreground focus:border-indigo-500 outline-none [color-scheme:dark]"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleAdd}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" /> Add Assignment
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : assignments.length === 0 ? (
        <div className="text-center p-8 text-muted-foreground text-sm">No active assignments</div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => (
            <div key={a.id} className="bg-slate-800/80 rounded-xl p-4 flex items-center justify-between gap-4 border border-slate-700">
              <div>
                <p className="font-bold text-foreground text-sm">
                  {users.find(u => u.id === a.user_id)?.full_name || "Unknown User"}
                </p>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {a.tournament_match_id ? (
                    <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/30">
                      Match: {tournamentMatches.find(tm => tm.id === a.tournament_match_id)?.match_code || "Unknown"}
                    </span>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/30">
                      Any Match
                    </span>
                  )}
                  {a.start_time && a.end_time && (
                    <span className="text-[10px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/30 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(a.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(a.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(a.id)}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
