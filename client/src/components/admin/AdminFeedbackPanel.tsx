import { useState, useEffect } from "react";
import { adminService } from "@/services/adminService";
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
      const data = await adminService.fetchUserFeedback();
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
      await adminService.updateUserFeedbackStatus(id, newStatus);
      toast("Status updated", { icon: "✅" });
      setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, status: newStatus } : f)));
    } catch (err) {
      toast("Error updating status", { icon: "❌" });
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "bug": return <Bug className="w-5 h-5 text-danger" />;
      case "feature": return <Lightbulb className="w-5 h-5 text-warning" />;
      default: return <MessageSquare className="w-5 h-5 text-info" />;
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
                item.status === 'new' ? "bg-danger/10 text-danger border-danger/30" :
                item.status === 'reviewing' ? "bg-warning/10 text-warning border-warning/30" :
                "bg-success/10 text-success border-success/30"
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
