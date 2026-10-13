import { useLocation } from "wouter";
import { Swords, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function FloatingRecordMatchButton() {
  const [location, setLocation] = useLocation();
  const { session } = useAuth();

  // Hide on broadcast, tv displays, or live umpire consoles
  if (
    location.startsWith("/tv") ||
    location.startsWith("/broadcast") ||
    location.startsWith("/court-display") ||
    location.startsWith("/umpire/") ||
    location.startsWith("/tie-umpire/")
  ) {
    return null;
  }

  const handleRecordMatch = () => {
    if (!session) {
      sessionStorage.setItem("return_url", location + window.location.search + window.location.hash);
      setLocation("/join");
      return;
    }
    window.dispatchEvent(new CustomEvent("openLogMatchModal"));
  };

  return (
    <button
      onClick={handleRecordMatch}
      aria-label="Record a match"
      className="lg:hidden fixed bottom-20 right-4 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl hover:bg-primary/95 active:scale-95 transition-all border border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <Swords className="w-4 h-4" />
      <span>Record</span>
    </button>
  );
}
