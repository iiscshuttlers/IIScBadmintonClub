import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function MatchSection({ 
  title, 
  icon, 
  matches, 
  defaultExpanded = false,
  renderMatchCard 
}: { 
  title: string; 
  icon: React.ReactNode; 
  matches: any[]; 
  defaultExpanded?: boolean;
  renderMatchCard: (match: any, index: number) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [category, setCategory] = useState<string>("ALL");

  const CATEGORIES = ["ALL", "MS", "MD", "XD", "WS", "WD"];

  const filteredMatches = matches.filter(m => {
    if (category === "ALL") return true;
    const c = (m.match_code || m.matchNumber || "").toUpperCase();
    if (c.startsWith(category)) return true;
    // Fallback if match_code is empty, try to infer from category string
    const cat = (m.category || "").toUpperCase();
    if (category === "MS" && (cat.includes("MEN'S SINGLES") || cat === "MS" || cat === "SINGLES")) return true;
    if (category === "MD" && (cat.includes("MEN'S DOUBLES") || cat === "MD" || cat === "DOUBLES")) return true;
    if (category === "WS" && (cat.includes("WOMEN'S SINGLES") || cat === "WS")) return true;
    if (category === "WD" && (cat.includes("WOMEN'S DOUBLES") || cat === "WD")) return true;
    if (category === "XD" && (cat.includes("MIXED") || cat === "XD")) return true;
    return false;
  });

  return (
    <div className="mb-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
      <div 
        className="px-5 py-4 flex items-center justify-between cursor-pointer bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm text-primary">
            {icon}
          </div>
          <h3 className="font-black text-lg text-slate-800 dark:text-slate-100">{title} <span className="text-muted-foreground font-semibold text-sm ml-2">({matches.length})</span></h3>
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {expanded && (
        <div className="p-4 sm:p-5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="mb-5 bg-slate-100/50 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-black transition-all ${
                    category === cat
                      ? "bg-white dark:bg-slate-800 text-primary dark:text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {filteredMatches.length > 0 ? (
              filteredMatches.map((match, i) => renderMatchCard(match, i))
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm font-medium">
                No {category !== "ALL" ? category : ""} matches found in this section.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
