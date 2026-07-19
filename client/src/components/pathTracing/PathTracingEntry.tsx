import { useState } from "react";
import { MapPin } from "lucide-react";
import { PathTracingWizard } from "./PathTracingWizard";
import type { MatchSource } from "@/services/pathTracingService";

export function PathTracingEntry({
  matchId,
  matchSource,
  userId,
  sessionTimestamp,
}: {
  matchId: string;
  matchSource: MatchSource;
  userId: string | null;
  sessionTimestamp?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-sky-500/30 bg-sky-500/10 text-xs font-bold text-sky-500 hover:bg-sky-500/20 transition-all"
      >
        <MapPin className="w-3.5 h-3.5" /> Trace Court Path
      </button>
      {open && <PathTracingWizard matchId={matchId} matchSource={matchSource} userId={userId} sessionTimestamp={sessionTimestamp} onClose={() => setOpen(false)} />}
    </>
  );
}
