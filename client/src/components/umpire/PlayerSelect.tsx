import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Minus, X } from 'lucide-react';
import type { PlayerSlim as Player } from '@/types';

export function PlayerSelect({
  value,
  onChange,
  players,
  placeholder,
  fallbackName,
}: {
  value: string;
  onChange: (v: string) => void;
  players: Player[];
  placeholder?: string;
  fallbackName?: string;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

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

  const filtered = players.filter((p) =>
    (p.full_name || "").toLowerCase().includes((search || "").toLowerCase())
  );

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
        <div ref={listboxRef} className="absolute z-60 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div
              className={`p-3 text-sm font-bold cursor-pointer text-primary ${activeIndex === 0 ? "bg-primary/80/50" : "hover:bg-primary/80/30"}`}
              onClick={() => { onChange(search); setIsOpen(false); }}
            >
              Use "{search}" as Guest
            </div>
          ) : (
            filtered.map((p, idx) => (
              <div
                key={p.id}
                onClick={() => { onChange(p.id); setSearch(p.full_name); setIsOpen(false); }}
                className={`p-3 text-sm font-bold cursor-pointer transition-colors ${activeIndex === idx ? "bg-primary/20 text-primary" : "hover:bg-primary/80/30 text-slate-200"}`}
              >
                {p.full_name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
