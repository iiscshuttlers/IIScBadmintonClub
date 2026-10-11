import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Minus, X } from 'lucide-react';
import type { PlayerSlim as Player } from '@/types';
import { isFuzzyMatch } from '@/lib/utils';

export function PlayerSelect({
  value,
  onChange,
  players,
  placeholder,
  fallbackName,
  disabledPlayerIds,
}: {
  value: string;
  onChange: (v: string) => void;
  players: Player[];
  placeholder?: string;
  fallbackName?: string;
  disabledPlayerIds?: string[] | Set<string>;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const disabledSet = disabledPlayerIds instanceof Set ? disabledPlayerIds : new Set(disabledPlayerIds || []);

  useEffect(() => {
    if (value) {
      const p = players.find((p) => p.id === value);
      setSearch(p ? p.full_name : value);
    } else {
      setSearch(fallbackName || "");
    }
  }, [value, players, fallbackName]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
        if (value) {
          const p = players.find((p) => p.id === value);
          setSearch(p ? p.full_name : value);
        } else setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, players, fallbackName]);

  const isInputFocusedOnSelected = Boolean(value && players.find((p) => p.id === value)?.full_name === search);

  const filtered = players.filter((p) => {
    if (!search || !search.trim() || isInputFocusedOnSelected) return true;
    const q = search.trim().toLowerCase();
    return (
      isFuzzyMatch(q, p.full_name) ||
      p.full_name.toLowerCase().includes(q) ||
      Boolean(p.email && (p.email.toLowerCase().includes(q) || isFuzzyMatch(q, p.email))) ||
      Boolean(p.iisc_email && (p.iisc_email.toLowerCase().includes(q) || isFuzzyMatch(q, p.iisc_email))) ||
      Boolean(p.nickname && isFuzzyMatch(q, p.nickname))
    );
  });

  useEffect(() => {
    setActiveIndex(-1);
  }, [search]);

  useEffect(() => {
    if (activeIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") setIsOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        const selected = filtered[activeIndex];
        if (disabledSet.has(selected.id)) {
          return;
        }
        onChange(selected.id);
        setSearch(selected.full_name);
        setIsOpen(false);
      } else if (search.length > 0 && filtered.length === 0) {
        onChange(search);
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        placeholder={placeholder ?? "Search or type name..."}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setIsOpen(true); onChange(e.target.value); }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full text-sm font-bold bg-slate-900/50 border border-slate-700 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground truncate"
      />
      {isOpen && (
        <div 
          ref={listboxRef} 
          className="absolute z-[100] left-0 right-0 w-full mt-1 bg-slate-850 dark:bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto overscroll-contain visible-scrollbar touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {filtered.length === 0 ? (
            <div
              className={`p-3 text-sm font-bold cursor-pointer text-primary ${activeIndex === 0 ? "bg-primary/80/50" : "hover:bg-primary/80/30"}`}
              onClick={() => { onChange(search); setIsOpen(false); }}
            >
              Use "{search}" as Guest
            </div>
          ) : (
            filtered.map((p, idx) => {
              const isAlreadyAdded = disabledSet.has(p.id);

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (isAlreadyAdded) return;
                    onChange(p.id);
                    setSearch(p.full_name);
                    setIsOpen(false);
                  }}
                  className={`p-2.5 text-sm font-bold transition-colors border-b border-slate-700/40 last:border-0 ${
                    isAlreadyAdded
                      ? "cursor-not-allowed opacity-60 bg-slate-800/80"
                      : activeIndex === idx
                      ? "bg-primary/20 text-primary cursor-pointer"
                      : "hover:bg-primary/80/30 text-slate-200 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate ${isAlreadyAdded ? "line-through text-slate-400 font-semibold" : ""}`}>
                      {p.full_name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isAlreadyAdded && (
                        <span className="text-[10px] font-bold text-amber-400/90 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                          Already in team
                        </span>
                      )}
                      {p._isSuggested && !isAlreadyAdded && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/30">
                          Suggested Match
                        </span>
                      )}
                    </div>
                  </div>
                  {p.iisc_email && (
                    <div className={`text-[11px] font-mono truncate mt-0.5 ${isAlreadyAdded ? "line-through text-slate-500" : "text-emerald-400/90"}`}>
                      IISc: {p.iisc_email}
                    </div>
                  )}
                  {p.email && p.email !== p.iisc_email && (
                    <div className={`text-[11px] font-mono truncate mt-0.5 ${isAlreadyAdded ? "line-through text-slate-500" : "text-slate-400"}`}>
                      {p.email}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
