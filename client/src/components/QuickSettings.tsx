import { Palette, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemePicker } from "@/components/ThemePicker";

export function QuickSettingsContent({ compact = false }: { compact?: boolean }) {
  return (
    <div className="divide-y divide-border">
      <div className="px-3 py-3">
        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Palette className="w-3 h-3 text-primary" /> App Theme
        </div>
        <ThemePicker compact={compact} />
      </div>
    </div>
  );
}

export function PreferencesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* Header stays put and only the list scrolls, so the close button is always
          reachable. On phones the height leaves room for the bottom tab bar. */}
      <DialogContent className="sm:max-w-md bg-background border-border rounded-2xl w-[95vw] sm:w-full max-h-[calc(100dvh-10rem)] lg:max-h-[85dvh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 p-4 pr-12 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-foreground font-black text-xl">
            <Settings className="w-5 h-5 text-primary" />
            App Preferences
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-2">
          <QuickSettingsContent compact />
        </div>
      </DialogContent>
    </Dialog>
  );
}
