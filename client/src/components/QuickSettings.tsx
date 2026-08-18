import { Sun, Moon, Settings } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function QuickSettingsContent() {
  const { theme, toggleTheme } = useTheme();


  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {/* APPEARANCE */}
      <div className="px-3 py-3">
        <div className="text-[10px] font-black text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Sun className="w-3 h-3" /> Appearance
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1 flex gap-1 mb-3">
          <button onClick={() => { if (theme === "dark") toggleTheme?.(); }} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${theme === "light" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-on-accent shadow-sm" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300"}`}>
            <Sun className="w-3.5 h-3.5" /> Light
          </button>
          <button onClick={() => { if (theme === "light") toggleTheme?.(); }} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${theme === "dark" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-on-accent shadow-sm" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300"}`}>
            <Moon className="w-3.5 h-3.5" /> Dark
          </button>
        </div>
      </div>


    </div>
  );
}

export function PreferencesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-foreground font-black text-xl">
            <Settings className="w-5 h-5 text-primary" />
            App Preferences
          </DialogTitle>
        </DialogHeader>
        <div className="p-2">
          <QuickSettingsContent />
        </div>
      </DialogContent>
    </Dialog>
  );
}
