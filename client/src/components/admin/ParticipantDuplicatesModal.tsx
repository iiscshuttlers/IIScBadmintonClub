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
    <div className="fixed inset-0 z-[100] bg-media/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-card rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-border">
        <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-muted/50">
          <h2 className="font-black text-lg text-foreground flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning" />
            Potential Duplicates in {cat}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1 text-xs font-bold text-soft hover:text-primary transition px-2 py-1 bg-muted hover:bg-muted-strong rounded-md"
            >
              <Download className="w-3 h-3" /> Download
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-soft transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
          {groups.map((g, i) => (
            <div
              key={i}
              className="bg-warning/10 p-4 rounded-xl border border-warning/50"
            >
              <h4 className="text-[10px] font-black text-warning/80 uppercase tracking-widest mb-2">
                Match Group {i + 1}
              </h4>
              <ul className="space-y-2">
                {g.map((item, j) => (
                  <li
                    key={j}
                    className="text-sm flex items-center justify-between gap-2 font-bold text-soft before:content-[''] before:w-1.5 before:h-1.5 before:bg-warning before:rounded-full before:mr-2"
                  >
                    <span className="truncate flex-1">{item.name}</span>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-muted px-2 py-1 rounded-md shrink-0">
                      {item.details}
                    </span>
                    {item.participantId && onRemoveDuplicate && (
                      <button
                        onClick={() => onRemoveDuplicate(item)}
                        className="text-[10px] font-black text-danger hover:text-danger/80 bg-danger/10 hover:bg-danger/15 px-2 py-1 rounded-md transition shrink-0"
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
