import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { disciplineOf } from "@/lib/matchView";

export function MatchSection({ 
  title, 
  icon, 
  matches, 
  defaultExpanded = false,
  renderMatchCard,
  headerAction
}: { 
  title: string; 
  icon: React.ReactNode; 
  matches: any[]; 
  defaultExpanded?: boolean;
  renderMatchCard: (match: any, index: number) => React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [category, setCategory] = useState<string>("ALL");

  const CATEGORIES = ["ALL", "MS", "MD", "XD", "WS", "WD"];

  const filteredMatches = matches.filter(m => {
    if (category === "ALL") return true;
    // Shared discipline recognition first (category text or match-code prefix).
    if (disciplineOf(m.category, m.match_code) === category) return true;
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
    <div className="mb-6 bg-card rounded-3xl border border-border shadow-sm overflow-hidden transition-all duration-300">
      <div 
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        className="px-5 py-4 min-h-[44px] flex items-center justify-between cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary bg-muted/50 hover:bg-muted transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-card rounded-xl shadow-sm text-primary">
            {icon}
          </div>
          <h3 className="font-black text-lg text-foreground">{title} <span className="text-muted-foreground font-semibold text-sm ml-2">({matches.length})</span></h3>
        </div>
        <div className="flex items-center gap-3">
          {headerAction && (
            <div onClick={(e) => e.stopPropagation()}>
              {headerAction}
            </div>
          )}
          <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="p-4 sm:p-5 pt-2 border-t border-border">
          <div className="mb-5 bg-background p-1.5 rounded-2xl border border-border">
            <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  aria-pressed={category === cat}
                  className={`flex-1 sm:flex-none px-3 py-2 min-h-[44px] rounded-xl text-xs font-black transition-all ${
                    category === cat
                      ? "bg-muted text-primary shadow-sm ring-1 ring-border-strong"
                      : "text-muted-foreground hover:text-soft hover:bg-muted/50"
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
              <div className="text-center py-8 text-muted-foreground text-sm font-medium">
                No {category !== "ALL" ? category : ""} matches found in this section.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
