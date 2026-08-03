import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Send, Bug, Lightbulb, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const { session } = useAuth();
  const [type, setType] = useState<"bug" | "feature" | "general">("general");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast("Message required", { description: "Please enter your feedback.", icon: "⚠️" });
      return;
    }
    
    if (!session?.user?.id) {
      toast("Error", { description: "You must be logged in.", icon: "❌" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("user_feedback").insert({
        user_id: session.user.id,
        feedback_type: type,
        message: message.trim(),
        status: "new"
      });

      if (error) throw error;

      toast("Feedback Sent!", { description: "Thank you for helping us improve.", icon: "✅" });
      setMessage("");
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast("Submission Failed", { description: err.message, icon: "❌" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Send Feedback
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setType("bug")}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-xs font-semibold gap-1.5",
                type === "bug" 
                  ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400" 
                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              <Bug className="w-5 h-5" />
              Report Bug
            </button>
            <button
              type="button"
              onClick={() => setType("feature")}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-xs font-semibold gap-1.5",
                type === "feature" 
                  ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400" 
                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              <Lightbulb className="w-5 h-5" />
              Request Feature
            </button>
            <button
              type="button"
              onClick={() => setType("general")}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-xs font-semibold gap-1.5",
                type === "general" 
                  ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-400" 
                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              <MessageSquare className="w-5 h-5" />
              General
            </button>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              type === "bug" ? "What went wrong? Please be specific..." :
              type === "feature" ? "What feature would you like to see?" :
              "Tell us what you think..."
            }
            className="w-full min-h-[120px] p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />

          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-6 font-bold"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Feedback
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
