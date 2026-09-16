import { useState, useRef, useEffect } from "react";
import type { PlayerSlim as Player } from "@/types";
import { isFuzzyMatch } from "@/lib/utils";

export function PlayerSelect({
  value,
  onChange,
  players,
  placeholder,
  className
}: {
  value: string;
  onChange: (v: string) => void;
  players: any[];
  placeholder?: string;
  className?: string;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const p = players.find((p) => p.id === value);
      if (p) setSearch(p.full_name);
    } else setSearch("");
  }, [value, players]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (value) {
          const p = players.find((p) => p.id === value);
          if (p) setSearch(p.full_name);
        } else setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, players]);

  const selectedPlayer = players.find((p) => p.id === value);
  const isSearchUnchanged = selectedPlayer && search === selectedPlayer.full_name;
  const filtered = isSearchUnchanged
    ? players
    : players.filter((p) => isFuzzyMatch(search, p.full_name));

  useEffect(() => {
    setSelectedIndex(-1);
  }, [search, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") setIsOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filtered.length) {
        const p = filtered[selectedIndex];
        onChange(p.id);
        setSearch(p.full_name);
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
        placeholder={placeholder ?? "Search player..."}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
          onChange("");
        }}
        onFocus={(e) => {
          setIsOpen(true);
          e.target.select();
        }}
        onClick={(e) => {
          e.currentTarget.select();
        }}
        onKeyDown={handleKeyDown}
        className={className || "w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-primary"}
      />
      {isOpen && (
        <div className="absolute z-[60] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground text-center">No players found</div>
          ) : (
            filtered.map((p, idx) => (
              <div
                key={p.id}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => {
                  onChange(p.id);
                  setSearch(p.full_name);
                  setIsOpen(false);
                }}
                className={`p-2 text-xs font-bold cursor-pointer flex items-center justify-between gap-2 ${
                  selectedIndex === idx
                    ? "bg-primary/15 dark:bg-primary/60 text-primary dark:text-primary/30"
                    : "hover:bg-primary/10 dark:hover:bg-primary/80/30 text-muted-foreground dark:text-slate-200"
                }`}
              >
                <span className="truncate">{p.full_name}</span>
                {p.is_guest && (
                  <span className="shrink-0 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300">
                    Guest
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
