import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dumbbell, ActivitySquare, Target, AlertTriangle } from "lucide-react";

export function TrainingSection() {
  const { session } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrainingData = async () => {
      if (!session?.user?.email) {
        setError("You must be logged in with an email to view ACE training data.");
        setLoading(false);
        return;
      }

      try {
        const aceUrl = import.meta.env.VITE_ACE_API_URL;
        const aceSecret = import.meta.env.VITE_ACE_API_SECRET;
        
        if (!aceUrl || !aceSecret) {
          setError("ACE API configuration is missing.");
          setLoading(false);
          return;
        }

        const res = await fetch(`${aceUrl}?email=${encodeURIComponent(session.user.email)}`, {
          headers: {
            'Authorization': `Bearer ${aceSecret}`
          }
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `ACE server returned ${res.status}`);
        }

        const jsonData = await res.json();
        setData(jsonData);
      } catch (err: any) {
        setError("Please create an account on the ACE app with the same email id.");
      } finally {
        setLoading(false);
      }
    };

    fetchTrainingData();
  }, [session?.user?.email]);

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-[var(--series-a)]/10 to-cyan-500/10 rounded-2xl shadow-md border border-[var(--series-a)] dark:border-[var(--series-a)]/30 p-6">
        <div className="text-center mb-6">
          <Dumbbell className="w-8 h-8 text-[var(--series-a)] dark:text-[var(--series-a)] mx-auto mb-3" />
          <h2 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-1">ACE Training Hub</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Live data imported from the Brainy app</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-[var(--series-a)] border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm text-slate-500">Syncing with ACE...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
            <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
          </div>
        ) : data && (
          <div className="space-y-6">
            
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Total Sessions</p>
                <p className="text-2xl font-black text-[var(--series-a)] dark:text-[var(--series-a)]">{data.sessions?.length || 0}</p>
              </div>
              <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Active Goals</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{data.goals?.length || 0}</p>
              </div>
              <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center col-span-2 md:col-span-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Current Habits</p>
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{data.habits?.length || 0}</p>
              </div>
            </div>

            {/* Recent Sessions */}
            {data.sessions && data.sessions.length > 0 && (
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
                  <ActivitySquare className="w-4 h-4 mr-2 text-[var(--series-a)]" /> Recent Sessions
                </h3>
                <div className="space-y-2">
                  {data.sessions.slice(0, 3).map((session: any) => (
                    <div key={session.id} className="bg-white dark:bg-slate-800/80 rounded-lg p-3 border border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-sm">
                      <div>
                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{session.title}</p>
                        <p className="text-xs text-slate-500 capitalize">{session.type} • {session.duration_mins} mins</p>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs font-medium text-slate-600 dark:text-slate-300">
                        {new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Goals */}
            {data.goals && data.goals.length > 0 && (
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
                  <Target className="w-4 h-4 mr-2 text-emerald-500" /> Active Goals
                </h3>
                <div className="space-y-3">
                  {data.goals.map((goal: any) => (
                    <div key={goal.id} className="bg-white dark:bg-slate-800/80 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{goal.title}</p>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{goal.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${goal.progress}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

