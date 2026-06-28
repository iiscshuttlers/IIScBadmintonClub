import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BracketVisual, type BracketMatch } from "@/components/tournament/BracketVisual";

const CATEGORY_ORDER = ["MS", "WS", "MD", "WD", "XD"];

export function LiveBracketsSection() {
  const [activeFormat, setActiveFormat] = useState("MS");
  const [formats, setFormats] = useState<string[]>([]);
  const [matchesByFormat, setMatchesByFormat] = useState<Record<string, BracketMatch[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: tournaments } = await supabase
        .from("tournaments")
        .select("id, categories")
        .in("status", ["active", "completed", "archived"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (!tournaments?.length) {
        setError("Tournament brackets are not available yet.");
        setLoading(false);
        return;
      }

      const tournament = tournaments[0];
      const { data: rows, error: matchError } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("round")
        .order("match_number");

      if (matchError || !rows?.length) {
        setError("Tournament brackets are not available yet.");
        setLoading(false);
        return;
      }

      const byFormat: Record<string, BracketMatch[]> = {};
      for (const m of rows) {
        if (!byFormat[m.category]) byFormat[m.category] = [];
        byFormat[m.category].push(m as BracketMatch);
      }

      const fmts = (tournament.categories as string[])
        .filter((c) => byFormat[c])
        .sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));

      setFormats(fmts);
      setMatchesByFormat(byFormat);
      if (fmts.length) setActiveFormat(fmts[0]);
      setLoading(false);
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">
          Loading Brackets
        </p>
      </div>
    );
  }

  if (error || !formats.length) {
    return (
      <div className="py-32 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
          <Trophy className="w-10 h-10 text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Brackets Not Yet Available</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Tournament brackets will appear here once the draw has been published.
        </p>
      </div>
    );
  }

  const currentMatches = matchesByFormat[activeFormat] ?? [];
  const rounds = [...new Set(currentMatches.map((m) => m.round))].sort((a, b) => a - b);

  return (
    <div className="animate-in fade-in duration-300 w-full py-6">
      <div className="max-w-7xl mx-auto mb-6 flex flex-wrap gap-2 justify-center">
        {formats.map((fmt) => (
          <button
            key={fmt}
            onClick={() => setActiveFormat(fmt)}
            className={`px-6 py-2 rounded-full font-bold transition-all shadow-sm ${
              activeFormat === fmt
                ? "bg-emerald-600 text-white"
                : "bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:bg-gray-50 border border-gray-200 dark:border-slate-700"
            }`}
          >
            {fmt}
          </button>
        ))}
      </div>

      <div className="max-w-7xl mx-auto overflow-x-auto">
        {currentMatches.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-slate-500 italic">
            No matches scheduled for {activeFormat} yet.
          </div>
        ) : (
          <BracketVisual matches={currentMatches} rounds={rounds} enablePathHighlight />
        )}
      </div>
    </div>
  );
}
