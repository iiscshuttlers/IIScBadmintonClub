import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { MapPin, X, Flame, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { playVictorySound } from "@/lib/sounds"; // A nice sound for welcome!

export function VenueWelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile) return;

    const checkVenuePresence = async () => {
      try {
        // Fetch the user's latest venue presence event
        const { data, error } = await supabase
          .from("venue_presence_events")
          .select("id, event_type, created_at")
          .eq("player_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          setLoading(false);
          return;
        }

        // Only show if it's an "enter" event
        if (data.event_type !== "enter") {
          setLoading(false);
          return;
        }

        // Check if the event is from the last 2 hours (user approved 2-hour expiry)
        const eventTime = new Date(data.created_at).getTime();
        const now = Date.now();
        const twoHoursMs = 2 * 60 * 60 * 1000;

        if (now - eventTime > twoHoursMs) {
          setLoading(false);
          return;
        }

        // Check if we already showed the popup recently (12 hour cooldown)
        const lastShownStr = localStorage.getItem("venue_welcome_last_shown");
        if (lastShownStr) {
          const lastShown = parseInt(lastShownStr);
          const twelveHoursMs = 12 * 60 * 60 * 1000;
          if (now - lastShown < twelveHoursMs) {
            setLoading(false);
            return;
          }
        }

        // All checks passed! Show the modal and mark this event as seen
        localStorage.setItem("venue_welcome_last_shown", now.toString());
        setIsOpen(true);
        playVictorySound();
        
      } catch (err) {
        console.error("Failed to check venue presence:", err);
      } finally {
        setLoading(false);
      }
    };

    // Small delay to let the app load visually before popping the modal
    const timer = setTimeout(checkVenuePresence, 1500);
    return () => clearTimeout(timer);
  }, [profile]);

  if (loading) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden border-0 bg-transparent shadow-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 mx-auto"
        >
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 opacity-20 dark:opacity-30 pointer-events-none" />
          
          <DialogTitle className="sr-only">Welcome to Gymkhana</DialogTitle>
          <DialogDescription className="sr-only">Venue check-in modal</DialogDescription>

          <div className="px-6 pt-10 pb-6 relative z-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5 text-white transform -rotate-6">
              <MapPin className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">
              Welcome to Gymkhana!
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed px-2">
              You've successfully arrived at the venue. Ready to hit the courts? See what's happening right now.
            </p>

            <div className="flex flex-col w-full gap-3">
              <Button
                onClick={() => { setIsOpen(false); setLocation("/pulse#feed-matches"); }}
                className="w-full rounded-xl py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md font-bold text-sm"
              >
                <Search className="w-4 h-4 mr-2" />
                View Live Matches
              </Button>
              <Button
                onClick={() => { setIsOpen(false); setLocation("/pulse#announcements"); }}
                variant="outline"
                className="w-full rounded-xl py-6 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-sm"
              >
                <Flame className="w-4 h-4 mr-2 text-orange-500" />
                Check Club Pulse
              </Button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
