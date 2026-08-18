import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Calendar, User, Swords, Clock, Search, X, CheckSquare, Square, ChevronDown, Check } from "lucide-react";

export function UmpireAssignmentPanel() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [tournamentMatches, setTournamentMatches] = useState<any[]>([]);
  
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    tournamentMatchId: "",
    startTime: "",
    endTime: ""
  });

  const loadData = async () => {
    setLoading(true);
    
    // Load assignments
    const { data: aData, error: aErr } = await supabase
      .from("umpire_assignments")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (aErr) console.error("Failed to load umpire assignments:", aErr);
    
    setAssignments(aData || []);

    // Load users
    const { data: uData } = await supabase
      .from("players")
      .select("id, full_name, email")
      .order("full_name");
    
    setUsers(uData?.filter(u => u.id.length > 20) || []);

    // Load upcoming tournament matches
    const { data: tmData } = await supabase
      .from("tournament_matches")
      .select("id, match_code, category, team1_label, team2_label")
      .in("status", ["pending", "scheduled", "in_progress", "playing"])
      .order("match_code");
    
    setTournamentMatches(tmData || []);
    
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(u => 
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  }, [users, userSearch]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const selectAllFiltered = () => {
    const idsToAdd = filteredUsers.map(u => u.id);
    setSelectedUserIds(prev => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const deselectAll = () => {
    setSelectedUserIds([]);
  };

  const handleAdd = async () => {
    if (selectedUserIds.length === 0) {
      toast.error("Please select at least one user");
      return;
    }
    
    if (!form.tournamentMatchId && (!form.startTime || !form.endTime)) {
      toast.error("Please select either a match OR a time block (both start and end)");
      return;
    }

    let start = null;
    let end = null;
    if (form.startTime && form.endTime) {
      start = new Date(form.startTime).toISOString();
      end = new Date(form.endTime).toISOString();
    }

    setSaving(true);
    const { data: authUserData } = await supabase.auth.getUser();
    const currentAuthUserId = authUserData?.user?.id || null;

    const inserts = selectedUserIds.map(uid => ({
      user_id: uid,
      tournament_match_id: form.tournamentMatchId || null,
      start_time: start,
      end_time: end,
      created_by: currentAuthUserId
    }));

    let success = false;
    let errMsg = "";

    try {
      const { error: rpcErr } = await (supabase.rpc as any)("admin_assign_umpires", {
        p_user_ids: selectedUserIds,
        p_tournament_match_id: form.tournamentMatchId || null,
        p_start_time: start,
        p_end_time: end
      });
      if (!rpcErr) {
        success = true;
      } else {
        const { error } = await supabase.from("umpire_assignments").insert(inserts);
        if (!error) {
          success = true;
        } else {
          // If created_by FK fails, retry with created_by = null
          const retryInserts = inserts.map(i => ({ ...i, created_by: null }));
          const { error: retryError } = await supabase.from("umpire_assignments").insert(retryInserts);
          if (!retryError) {
            success = true;
          } else {
            errMsg = retryError.message;
          }
        }
      }
    } catch (e: any) {
      const { error } = await supabase.from("umpire_assignments").insert(inserts);
      if (!error) {
        success = true;
      } else {
        errMsg = error.message;
      }
    }

    if (success) {
      toast.success(`Assigned ${inserts.length} user${inserts.length > 1 ? "s" : ""} successfully!`);
      setSelectedUserIds([]);
      setUserSearch("");
      setForm({ tournamentMatchId: "", startTime: "", endTime: "" });
      loadData();
    } else {
      toast.error(errMsg || "Failed to save umpire assignment. Please ensure your admin role is active or execute the latest migration.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error: rpcErr } = await (supabase.rpc as any)("admin_delete_umpire_assignment", { p_id: id });
      if (rpcErr) {
        const { error } = await supabase.from("umpire_assignments").delete().eq("id", id);
        if (error) throw error;
      }
      toast.success("Assignment removed");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove assignment");
    }
  };

  return (
    <div className="bg-slate-900 rounded-[2rem] p-6 shadow-xl border border-slate-800">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-5 h-5 text-indigo-400" />
        <h2 className="text-xl font-black text-foreground">Umpire Assignments & Time Blocks</h2>
      </div>

      <div className="bg-slate-800/50 p-4 sm:p-5 rounded-2xl border border-slate-700/50 space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">New Assignment</h3>
          {selectedUserIds.length > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg">
              {selectedUserIds.length} user{selectedUserIds.length > 1 ? "s" : ""} selected
            </span>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Multi-user select */}
          <div className="space-y-1.5 md:col-span-2" ref={dropdownRef}>
            <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Select Umpires / Users (Multi-select)</span>
              {selectedUserIds.length > 0 && (
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-indigo-400 hover:text-indigo-300 text-[11px] font-bold underline"
                >
                  Clear Selection
                </button>
              )}
            </label>

            {/* Selected User Chips */}
            {selectedUserIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900/90 border border-slate-700 rounded-xl mb-2 max-h-28 overflow-y-auto">
                {selectedUserIds.map(uid => {
                  const user = users.find(u => u.id === uid);
                  return (
                    <span
                      key={uid}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600/30 border border-indigo-500/50 text-indigo-200 text-xs font-bold rounded-lg"
                    >
                      <span>{user?.full_name || "User"}</span>
                      <button
                        type="button"
                        onClick={() => toggleUser(uid)}
                        className="hover:bg-indigo-500/40 rounded p-0.5"
                      >
                        <X className="w-3 h-3 text-indigo-300" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Search and Dropdown trigger */}
            <div className="relative">
              <div
                onClick={() => setIsDropdownOpen(true)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-on-accent flex items-center justify-between cursor-pointer focus-within:border-indigo-500"
              >
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={e => {
                      setUserSearch(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder={selectedUserIds.length === 0 ? "Search & select users to assign..." : "Add more users..."}
                    className="w-full bg-transparent outline-none text-foreground placeholder:text-slate-500 text-sm"
                  />
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
              </div>

              {/* Scrollable list dropdown */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 max-h-60 overflow-y-auto p-1 divide-y divide-slate-800">
                  <div className="p-2 flex items-center justify-between bg-slate-950/60 rounded-lg mb-1">
                    <span className="text-[11px] font-bold text-slate-400">{filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} found</span>
                    <button
                      type="button"
                      onClick={selectAllFiltered}
                      className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                    >
                      Select All ({filteredUsers.length})
                    </button>
                  </div>
                  {filteredUsers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">No users found matching "{userSearch}"</div>
                  ) : (
                    filteredUsers.map(u => {
                      const isSelected = selectedUserIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleUser(u.id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs ${
                            isSelected ? "bg-indigo-600/20 text-indigo-200" : "hover:bg-slate-800 text-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className={`w-4 h-4 rounded flex items-center justify-center border ${isSelected ? "bg-indigo-600 border-indigo-500 text-white" : "border-slate-600 bg-slate-800"}`}>
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <div className="truncate">
                              <p className="font-bold truncate">{u.full_name}</p>
                              <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Swords className="w-3.5 h-3.5" /> Specific Match (Optional)</label>
            <select
              value={form.tournamentMatchId}
              onChange={e => setForm(f => ({ ...f, tournamentMatchId: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-on-accent focus:border-indigo-500 outline-none"
            >
              <option value="">Any Match in Time Block</option>
              {tournamentMatches.map(tm => (
                <option key={tm.id} value={tm.id}>{tm.match_code} - {tm.category} ({tm.team1_label} vs {tm.team2_label})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Start Time (Time Block)</label>
            <input
              type="datetime-local"
              value={form.startTime}
              onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-on-accent focus:border-indigo-500 outline-none [color-scheme:dark]"
            />
          </div>

          <div className="space-y-1.5 md:col-start-2">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> End Time (Time Block)</label>
            <input
              type="datetime-local"
              value={form.endTime}
              onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-on-accent focus:border-indigo-500 outline-none [color-scheme:dark]"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleAdd}
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Assign {selectedUserIds.length > 0 ? `${selectedUserIds.length} Umpire${selectedUserIds.length > 1 ? "s" : ""}` : "Umpires"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : assignments.length === 0 ? (
        <div className="text-center p-8 text-muted-foreground text-sm">No active assignments</div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
            <span>Current Active Assignments ({assignments.length})</span>
          </div>
          {assignments.map(a => (
            <div key={a.id} className="bg-slate-800/80 rounded-xl p-4 flex items-center justify-between gap-4 border border-slate-700">
              <div>
                <p className="font-bold text-foreground text-sm">
                  {users.find(u => u.id === a.user_id)?.full_name || "Unknown User"}
                  <span className="text-xs text-slate-400 font-normal ml-2">({users.find(u => u.id === a.user_id)?.email})</span>
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
                      {new Date(a.start_time).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: '2-digit', minute:'2-digit' })} - {new Date(a.end_time).toLocaleString("en-IN", { hour: '2-digit', minute:'2-digit' })}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(a.id)}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition"
                title="Remove assignment"
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
