import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (totalMins: number) => Promise<void> | void;
  title?: string;
  defaultMins?: number;
  matchId?: string;
  matchTime?: string | null;
}

export function NotificationModal({ 
  isOpen, 
  onClose, 
  onSave,
  title = "Set Match Alert",
  defaultMins = 15,
  matchId,
  matchTime 
}: NotificationModalProps) {
  const { session } = useAuth();
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const h = Math.floor(defaultMins / 60);
      const m = defaultMins % 60;
      setHours(h > 0 ? h.toString() : "");
      setMinutes(m > 0 ? m.toString() : "");
    }
  }, [isOpen, defaultMins]);

  const h = parseInt(hours || "0", 10);
  const m = parseInt(minutes || "0", 10);
  const totalMins = (h * 60) + m;

  const hoursStr = h > 0 ? `${h} hour${h > 1 ? 's' : ''}` : '';
  const minsStr = m > 0 ? `${m} min${m > 1 ? 's' : ''}` : '';
  const displayTimeStr = [hoursStr, minsStr].filter(Boolean).join(" and ") || "0 mins";

  let notificationTimeStr = "";
  if (matchTime && !isNaN(totalMins)) {
    const notifyDate = new Date(matchTime);
    if (!isNaN(notifyDate.getTime())) {
      notifyDate.setMinutes(notifyDate.getMinutes() - totalMins);
      notificationTimeStr = notifyDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id && !onSave) return;
    
    if (isNaN(h) || isNaN(m)) {
      toast.error("Please enter valid time.");
      return;
    }
    
    setLoading(true);
    
    try {
      if (onSave) {
        await onSave(totalMins);
      } else if (matchId && session?.user?.id) {
        const { error } = await supabase.from("user_match_notifications").upsert({
          match_id: matchId,
          user_id: session.user.id,
          notify_before_mins: totalMins
        }, { onConflict: 'match_id, user_id' });
        
        if (error) throw error;
      }
      
      const timeMsg = notificationTimeStr ? ` (at ${notificationTimeStr})` : '';
      toast.success(`You will be notified ${displayTimeStr} before the match${timeMsg}!`);
      window.dispatchEvent(new Event("match_alerts_changed"));
      onClose();
    } catch (e) {
      toast.error("Failed to set notification.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-slate-900 border border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-accent" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            When would you like to be notified before the match starts?
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="flex justify-center items-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <Input
                type="number"
                min="0"
                max="24"
                placeholder="00"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-20 text-center text-2xl font-black bg-slate-800 border-slate-700 h-16"
              />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Hours</span>
            </div>
            <span className="text-3xl font-black text-slate-600 mb-6">:</span>
            <div className="flex flex-col items-center gap-2">
              <Input
                type="number"
                min="0"
                max="59"
                placeholder="00"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-20 text-center text-2xl font-black bg-slate-800 border-slate-700 h-16"
              />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mins</span>
            </div>
          </div>
          
          {/* Quick presets */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => { setHours(""); setMinutes("15"); }} className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs">15 mins</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { setHours(""); setMinutes("30"); }} className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs">30 mins</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { setHours("1"); setMinutes(""); }} className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs">1 hour</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { setHours("24"); setMinutes(""); }} className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs">1 day</Button>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-3 flex items-center justify-center gap-2 text-sm text-slate-300">
            <Clock className="w-4 h-4 text-accent" />
            <span className="font-medium text-center">
              Alert: <strong className="text-white">{displayTimeStr}</strong> before 
              {notificationTimeStr ? <span className="text-accent ml-1">(at {notificationTimeStr})</span> : " match start"}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={onClose} className="hover:bg-slate-800">Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-accent text-accent-foreground font-bold px-6">
              {loading ? "Saving..." : "Set Alert"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
