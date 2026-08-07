import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (mins: number) => void;
  title?: string;
  defaultMins?: number;
}

export function NotificationModal({ isOpen, onClose, onSave, title = "Set Notification", defaultMins = 15 }: NotificationModalProps) {
  const [hours, setHours] = useState("00");
  const [minutes, setMinutes] = useState("15");

  useEffect(() => {
    if (isOpen) {
      const h = Math.floor(defaultMins / 60);
      const m = defaultMins % 60;
      setHours(h.toString().padStart(2, "0"));
      setMinutes(m.toString().padStart(2, "0"));
    }
  }, [isOpen, defaultMins]);

  const handleSave = () => {
    const h = parseInt(hours, 10) || 0;
    const m = parseInt(minutes, 10) || 0;
    const totalMins = h * 60 + m;
    onSave(totalMins);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-violet-400" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <p className="text-sm text-slate-400">
            Remind me before the match starts:
          </p>
          <div className="flex items-center justify-center gap-2 text-2xl font-black">
            <div className="flex flex-col items-center gap-1">
              <input 
                type="number"
                min="0"
                max="24"
                value={hours}
                onChange={e => setHours(e.target.value)}
                className="w-16 h-16 text-center bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500 uppercase">Hours</span>
            </div>
            <span className="mb-5">:</span>
            <div className="flex flex-col items-center gap-1">
              <input 
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={e => setMinutes(e.target.value)}
                className="w-16 h-16 text-center bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500 uppercase">Minutes</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-slate-300 hover:bg-slate-800 transition">
              Cancel
            </button>
            <button onClick={handleSave} className="px-6 py-2 rounded-xl text-sm font-bold bg-violet-600 hover:bg-violet-700 text-white transition">
              Save Alert
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
