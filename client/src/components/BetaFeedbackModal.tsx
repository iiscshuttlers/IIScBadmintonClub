import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare, ExternalLink, Mail } from "lucide-react";
import { Capacitor } from "@capacitor/core";

interface BetaFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BetaFeedbackModal({ isOpen, onClose }: BetaFeedbackModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-2xl bg-slate-900 border-slate-800 text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-400" />
            Beta Tester Feedback
          </DialogTitle>
          <DialogDescription className="text-slate-400 pt-2">
            Thank you for being one of our 20 active testers! Your feedback is crucial for getting our app approved by Google.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <h4 className="font-bold text-sm mb-2 text-white">Option 1: Google Play (Recommended)</h4>
            <p className="text-xs text-slate-400 mb-3">
              Leave private feedback directly on our Google Play Store listing. This goes straight to our developer dashboard!
            </p>
            {Capacitor.isNativePlatform() ? (
              <Button 
                className="w-full text-xs font-bold" 
                variant="secondary"
                onClick={() => window.open("market://details?id=shuttlers.iisc.com", "_system")}
              >
                Open Play Store
              </Button>
            ) : (
              <Button 
                className="w-full text-xs font-bold" 
                variant="secondary"
                onClick={() => window.open("https://play.google.com/store/apps/details?id=shuttlers.iisc.com", "_blank")}
              >
                Open Play Store
              </Button>
            )}
          </div>

          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <h4 className="font-bold text-sm mb-2 text-white flex items-center gap-1.5">
              Option 2: Google Group
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              Join the discussion, report bugs, or suggest features in our official testers group.
            </p>
            <Button 
              className="w-full text-xs font-bold" 
              variant="outline"
              onClick={() => window.open("https://groups.google.com/g/iisc-badminton-app-testers", "_blank")}
            >
              Open Google Group <ExternalLink className="w-3 h-3 ml-2" />
            </Button>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <h4 className="font-bold text-sm mb-2 text-white flex items-center gap-1.5">
              Option 3: Direct Email
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              Send an email directly to the developer team with screenshots or detailed bug reports.
            </p>
            <Button 
              className="w-full text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90" 
              onClick={() => window.open("mailto:iiscbadmintonclub@gmail.com?subject=Beta Testing Feedback")}
            >
              <Mail className="w-4 h-4 mr-2" /> Email Developers
            </Button>
          </div>
        </div>

        <DialogFooter className="sm:justify-center pt-2">
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
