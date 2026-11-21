import React from "react";
import { X, Phone } from "lucide-react";
import type { Participant } from "@/types/tournament";

export interface ParticipantContactsModalProps {
  category: string;
  parts: Participant[];
  allPlayers: Array<{ id: string; full_name: string; contact_number?: string | null }>;
  onClose: () => void;
}

export function ParticipantContactsModal({
  category,
  parts,
  allPlayers,
  onClose,
}: ParticipantContactsModalProps) {
  return (
    <div className="rounded-xl border border-success/40 bg-success/10 p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-success">
          {category} Contacts ({parts.length})
        </h4>
        <button onClick={onClose} className="text-muted-foreground hover:text-faint transition">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {parts.map((p, i) => {
          const pl = allPlayers?.find((x) => x.id === p.player_id);
          const name = p.display_name ?? pl?.full_name ?? "Unknown";
          const phone = pl?.contact_number;
          return (
            <div key={p.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg hover:bg-muted/40">
              <span className="w-5 text-right text-muted-foreground font-bold shrink-0">{i + 1}.</span>
              <span className="flex-1 font-bold text-soft truncate">{name}</span>
              {phone ? (
                <a href={`tel:${phone}`} className="font-mono text-success shrink-0">{phone}</a>
              ) : (
                <span className="text-muted-foreground italic shrink-0">no phone</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
