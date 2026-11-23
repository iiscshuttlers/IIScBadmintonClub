import { useState, useRef, useEffect } from "react";
import type { PlayerSlim as Player } from "@/types";
import { isFuzzyMatch } from "@/lib/utils";

export function PlayerSelect({
  value,
  onChange,
  players,
  placeholder,
  className,
  autoFocus,
  onDone,
  menuClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  players: any[];
  placeholder?: string;
  className?: string;
  /** Focus (and so open) the search as soon as it mounts. */
  autoFocus?: boolean;
  /** Called when a player is picked or the picker is left (Escape, click outside). */
  onDone?: () => void;
  /** Extra classes for the results list, e.g. a min width or right alignment. */
  menuClassName?: string;
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
        onDone?.();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, players, onDone]);

  const selectedPlayer = players.find((p) => p.id === value);
  const isSearchUnchanged = selectedPlayer && search === selectedPlayer.full_name;
  const filtered = isSearchUnchanged
    ? players
    : players.filter((p) => isFuzzyMatch(search, p.full_name))
        .sort((a, b) => {
          if (!search) return 0;
          const s = search.toLowerCase();
          const aInc = a.full_name.toLowerCase().includes(s);
          const bInc = b.full_name.toLowerCase().includes(s);
          if (aInc !== bInc) return aInc ? -1 : 1;
          const aStart = a.full_name.toLowerCase().startsWith(s);
          const bStart = b.full_name.toLowerCase().startsWith(s);
          if (aStart !== bStart) return aStart ? -1 : 1;
          return 0;
        });

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
        onDone?.();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      onDone?.();
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
        autoFocus={autoFocus}
        aria-label={placeholder ?? "Search player"}
        className={className || "w-full text-xs font-bold bg-muted border border-border-strong rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-primary"}
      />
      {isOpen && (
        <div className={`absolute z-[60] w-full mt-1 bg-muted border border-border-strong rounded-lg shadow-xl max-h-72 overflow-y-auto ${menuClassName ?? ""}`}>
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
                  onDone?.();
                }}
                className={`p-2 text-xs font-bold cursor-pointer flex items-center justify-between gap-2 ${
                  selectedIndex === idx
                    ? "bg-primary text-primary-foreground font-black"
                    : "hover:bg-primary/20 text-soft"
                }`}
              >
                <span className="truncate">{p.full_name}</span>
                {p.is_guest && (
                  <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                    selectedIndex === idx
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-individual/15 text-individual"
                  }`}>
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
