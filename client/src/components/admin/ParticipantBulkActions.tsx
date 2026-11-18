import React from "react";
import { Unlink, X } from "lucide-react";

export interface ParticipantBulkActionsProps {
  category: string;
  selectedCount: number;
  onBulkUnlink: () => Promise<void>;
  onBulkRemove: () => Promise<void>;
  onClearSelection: () => void;
}

export function ParticipantBulkActions({
  category,
  selectedCount,
  onBulkUnlink,
  onBulkRemove,
  onClearSelection,
}: ParticipantBulkActionsProps) {
  if (selectedCount <= 0) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-xl mb-4">
      <span className="text-sm font-bold text-primary flex-1">
        {selectedCount} selected in {category}
      </span>
      <button
        onClick={onBulkUnlink}
        className="px-3 py-1.5 text-xs font-bold text-black bg-[var(--warning)] hover:opacity-80 rounded-lg transition flex items-center gap-1"
      >
        <Unlink className="w-3 h-3" /> Unlink
      </button>
      <button
        onClick={onBulkRemove}
        className="px-3 py-1.5 text-xs font-bold text-white bg-[var(--danger)] hover:opacity-80 rounded-lg transition flex items-center gap-1"
      >
        <X className="w-3 h-3" /> Delete
      </button>
      <button
        onClick={onClearSelection}
        className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-lg transition flex items-center gap-1"
      >
        Clear
      </button>
    </div>
  );
}
