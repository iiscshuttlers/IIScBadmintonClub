import React from "react";
import { AlertCircle, Download, X } from "lucide-react";

export interface DuplicateGroupItem {
  name: string;
  details: string;
  participantId?: string;
}

export interface ParticipantDuplicatesModalProps {
  cat: string;
  groups: DuplicateGroupItem[][];
  onClose: () => void;
  onRemoveDuplicate?: (item: DuplicateGroupItem) => Promise<void>;
}

export function ParticipantDuplicatesModal({
  cat,
  groups,
  onClose,
  onRemoveDuplicate,
}: ParticipantDuplicatesModalProps) {
  const downloadCSV = () => {
    const rows = [["Group", "Name", "Details"]];
    groups.forEach((g, i) =>
      g.forEach((item) => rows.push([`Group ${i + 1}`, item.name, item.details]))
    );
    const csvContent = rows.map((e) => e.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `duplicates_${cat}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <h2 className="font-black text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[var(--warning)]" />
            Potential Duplicates in {cat}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary transition px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md"
            >
              <Download className="w-3 h-3" /> Download
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
          {groups.map((g, i) => (
            <div
              key={i}
              className="bg-amber-50/50 dark:bg-[var(--warning)]/10 p-4 rounded-xl border border-[var(--warning)]/50 dark:border-[var(--warning)]/50"
            >
              <h4 className="text-[10px] font-black text-[var(--warning)]/80 uppercase tracking-widest mb-2">
                Match Group {i + 1}
              </h4>
              <ul className="space-y-2">
                {g.map((item, j) => (
                  <li
                    key={j}
                    className="text-sm flex items-center justify-between gap-2 font-bold text-slate-700 dark:text-slate-300 before:content-[''] before:w-1.5 before:h-1.5 before:bg-[var(--warning)] before:rounded-full before:mr-2"
                  >
                    <span className="truncate flex-1">{item.name}</span>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md shrink-0">
                      {item.details}
                    </span>
                    {item.participantId && onRemoveDuplicate && (
                      <button
                        onClick={() => onRemoveDuplicate(item)}
                        className="text-[10px] font-black text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 px-2 py-1 rounded-md transition shrink-0"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
