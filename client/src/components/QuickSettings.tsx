import { Sun, Moon, Settings, Palette, Check } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ACCENTS = [
  { id: "emerald", label: "Lime & Emerald", color: "bg-success" },
  { id: "violet", label: "Electric Violet", color: "bg-individual" },
  { id: "rose", label: "Neon Rose", color: "bg-danger" },
  { id: "amber", label: "Solar Amber", color: "bg-warning" },
  { id: "blue", label: "Cobalt Blue", color: "bg-info" },
  { id: "cyberpunk", label: "Cyberpunk", color: "bg-gradient-to-r from-individual to-accent" },
] as const;

export function QuickSettingsContent() {
  const { theme, toggleTheme, accent, setAccent } = useTheme();

  return (
    <div className="divide-y divide-border">
      {/* S4.3 ACCENT THEME */}
      {setAccent && (
        <div className="px-3 py-3">
          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Palette className="w-3 h-3 text-primary" /> Accent Theme
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ACCENTS.map((acc) => {
              const active = accent === acc.id;
              return (
                <button
                  key={acc.id}
                  onClick={() => setAccent(acc.id)}
                  className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold border transition text-left ${
                    active
                      ? "bg-muted border-primary ring-1 ring-primary/40 text-foreground"
                      : "bg-card border-border text-muted-foreground hover:border-border-strong"
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full ${acc.color} shrink-0 flex items-center justify-center`}>
                    {active && <Check className="w-2.5 h-2.5 text-foreground stroke-[3]" />}
                  </span>
                  <span className="truncate">{acc.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function PreferencesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-background border-border rounded-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-foreground font-black text-xl">
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
