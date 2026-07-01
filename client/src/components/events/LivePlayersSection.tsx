import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Users, Info } from "lucide-react";

interface Participant {
  id: string;
  category: string;
  display_name: string | null;
  seed: number | null;
}

export function LivePlayersSection({ tournamentId, categories }: { tournamentId: string; categories: string[] }) {
  const [participants, setParticipants] = useState<Record<string, Participant[]>>({});
  const [loading, setLoading] = useState(true);
  const searchParams = new URLSearchParams(window.location.search);
  const [activeCat, setActiveCat] = useState<string>(searchParams.get("cat") || "");

  useEffect(() => {
    supabase
      .from("tournament_participants")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("category")
      .order("seed", { ascending: true })
      .then(({ data }) => {
        const grouped: Record<string, Participant[]> = {};
        for (const p of (data as Participant[]) || []) {
          if (!grouped[p.category]) grouped[p.category] = [];
          grouped[p.category].push(p);
        }
        setParticipants(grouped);
        
        // Auto-select first available category if activeCat is not set or not in valid categories
        const firstActive = categories.find((c) => grouped[c]?.length > 0);
        if (firstActive && (!activeCat || !grouped[activeCat])) {
          setActiveCat(firstActive);
        }
        
        setLoading(false);
      });
  }, [tournamentId, categories, activeCat]);

  useEffect(() => {
    if (!activeCat) return;
    const url = new URL(window.location.href);
    url.searchParams.set("cat", activeCat);
    window.history.replaceState({}, "", url.toString());
  }, [activeCat]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeCategories = categories.filter((c) => participants[c]?.length > 0);

  if (activeCategories.length === 0) {
    return (
      <div className="text-center py-20 bg-white/5 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700">
        <Users className="w-12 h-12 text-slate-300 dark:text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-black text-slate-800 dark:text-foreground">No Players Registered Yet</h3>
        <p className="text-muted-foreground mt-1">Participants will appear here once they are added.</p>
      </div>
    );
  }

  const currentParticipants = participants[activeCat] || [];

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2">
        {activeCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeCat === cat
                ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-foreground shadow-md"
                : "bg-slate-100 dark:bg-slate-800 text-muted-foreground dark:text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {cat} <span className="opacity-60 font-normal ml-1">({participants[cat].length})</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 px-1 pb-2 border-b border-slate-200 dark:border-slate-800">
        <Info className="w-4 h-4 text-primary dark:text-primary" />
        <p className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground">
          Note: Players are not listed in seeding order.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {currentParticipants.map((p, i) => (
          <div 
            key={p.id}
            className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:shadow-md transition-all hover:border-primary/40 dark:hover:border-primary/50"
          >
            <span className="font-bold text-muted-foreground dark:text-slate-200">
              {p.display_name || "Unknown Player"}
            </span>
            <span className="text-[10px] font-black text-muted-foreground bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-full shrink-0">
              #{i + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
