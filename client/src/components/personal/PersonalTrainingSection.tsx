import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAceTraining } from "@/services/aceService";
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
        // Goes through the ace-training edge function: the ACE secret stays on
        // the server and the lookup uses the signed-in user's verified email.
        const result = await fetchAceTraining();
        if (result.reason === null) {
          setData(result.data);
        } else if (result.reason === "not_configured") {
          setError("ACE API configuration is missing.");
        } else if (result.reason === "not_signed_in") {
          setError("You must be logged in with an email to view ACE training data.");
        } else {
          setError("Please create an account on the ACE app with the same email id.");
        }
      } catch {
        setError("Please create an account on the ACE app with the same email id.");
      } finally {
        setLoading(false);
      }
    };

    fetchTrainingData();
  }, [session?.user?.email]);

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-series-a/10 to-accent/10 rounded-2xl shadow-md border border-series-a/30 p-6">
        <div className="text-center mb-6">
          <Dumbbell className="w-8 h-8 text-series-a mx-auto mb-3" />
          <h2 className="font-black text-xl text-foreground mb-1">ACE Training Hub</h2>
          <p className="text-sm text-muted-foreground">Live data imported from the Brainy app</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-series-a border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm text-muted-foreground">Syncing with ACE...</p>
          </div>
        ) : error ? (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-center">
            <AlertTriangle className="w-6 h-6 text-danger mx-auto mb-2" />
            <p className="text-sm text-danger font-medium">{error}</p>
          </div>
        ) : data && (
          <div className="space-y-6">
            
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-xl p-4 border border-border-strong shadow-sm text-center">
                <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Total Sessions</p>
                <p className="text-2xl font-black text-series-a">{data.sessions?.length || 0}</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 border border-border-strong shadow-sm text-center">
                <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Active Goals</p>
                <p className="text-2xl font-black text-success">{data.goals?.length || 0}</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 border border-border-strong shadow-sm text-center col-span-2 md:col-span-1">
                <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Current Habits</p>
                <p className="text-2xl font-black text-individual">{data.habits?.length || 0}</p>
              </div>
            </div>

            {/* Recent Sessions */}
            {data.sessions && data.sessions.length > 0 && (
              <div>
                <h3 className="font-bold text-soft mb-3 flex items-center">
                  <ActivitySquare className="w-4 h-4 mr-2 text-series-a" /> Recent Sessions
                </h3>
                <div className="space-y-2">
                  {data.sessions.slice(0, 3).map((session: any) => (
                    <div key={session.id} className="bg-muted/80 rounded-lg p-3 border border-border-strong flex justify-between items-center shadow-sm">
                      <div>
                        <p className="font-semibold text-sm text-soft">{session.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{session.type} • {session.duration_mins} mins</p>
                      </div>
                      <div className="bg-muted-strong px-2 py-1 rounded text-xs font-medium text-soft">
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
                <h3 className="font-bold text-soft mb-3 flex items-center">
                  <Target className="w-4 h-4 mr-2 text-success" /> Active Goals
                </h3>
                <div className="space-y-3">
                  {data.goals.map((goal: any) => (
                    <div key={goal.id} className="bg-muted/80 rounded-lg p-3 border border-border-strong shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-semibold text-sm text-soft">{goal.title}</p>
                        <span className="text-xs font-bold text-success">{goal.progress}%</span>
                      </div>
                      <div className="w-full bg-muted-strong rounded-full h-1.5">
                        <div className="bg-success h-1.5 rounded-full" style={{ width: `${goal.progress}%` }}></div>
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

