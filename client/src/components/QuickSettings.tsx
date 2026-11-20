import { Palette, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemePicker } from "@/components/ThemePicker";

export function QuickSettingsContent() {
  return (
    <div className="divide-y divide-border">
      <div className="px-3 py-3">
        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Palette className="w-3 h-3 text-primary" /> App Theme
        </div>
        <ThemePicker />
      </div>
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
