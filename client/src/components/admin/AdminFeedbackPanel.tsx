import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { MessageSquare, Bug, Lightbulb } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminPanel, AdminLoading, AdminEmptyState } from "./AdminPanel";

export function AdminFeedbackPanel() {
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeedback = async () => {
    try {
      const { data, error } = await supabase
        .from("user_feedback")
        .select(`
          *,
          players:user_id ( full_name, email )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFeedback(data || []);
    } catch (err) {
      console.error(err);
      toast("Error loading feedback", { icon: "❌" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("user_feedback")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      toast("Status updated", { icon: "✅" });
      setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, status: newStatus } : f)));
    } catch (err) {
      toast("Error updating status", { icon: "❌" });
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "bug": return <Bug className="w-5 h-5 text-rose-500" />;
      case "feature": return <Lightbulb className="w-5 h-5 text-amber-500" />;
      default: return <MessageSquare className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <AdminPanel icon={MessageSquare} title="User Feedback" description="Bugs and suggestions submitted by users.">
      {loading ? (
        <AdminLoading />
      ) : feedback.length === 0 ? (
        <AdminEmptyState
          icon={MessageSquare}
          title="No feedback yet"
          description="When users submit bugs or suggestions, they'll appear here."
        />
      ) : (
        <div className="space-y-4">
          {feedback.map((item) => (
        <div key={item.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-muted rounded-xl shrink-0">
                {getIcon(item.feedback_type)}
              </div>
              <div>
                <h3 className="font-bold text-foreground">
                  {item.players?.full_name || "Unknown User"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {item.players?.email} • {format(new Date(item.created_at), "MMM d, yyyy h:mm a")}
                </p>
              </div>
            </div>
            
            <select
              value={item.status}
              onChange={(e) => handleStatusChange(item.id, e.target.value)}
              className={cn(
                "text-xs font-bold px-3 py-1.5 rounded-lg border appearance-none outline-none cursor-pointer",
                item.status === 'new' ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50" :
                item.status === 'reviewing' ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50" :
                "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50"
              )}
            >
              <option value="new">New</option>
              <option value="reviewing">Reviewing</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-xl text-sm text-foreground/80 border border-border whitespace-pre-wrap">
            {item.message}
          </div>
        </div>
          ))}
        </div>
      )}
    </AdminPanel>
  );
}
