const fs = require('fs');
const text = fs.readFileSync('client/src/components/umpire/UmpireEngine.tsx', 'utf8');
const lines = text.split('\n');

const startIndex = lines.findIndex(l => l.includes('const [players, setPlayers] = useState<Player[]>('));
const endIndex = lines.findIndex(l => l.includes('// ── SETUP SCREEN ───────────────────────────────────────────────────────────'));

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find boundaries.');
  process.exit(1);
}

const logicLines = lines.slice(startIndex, endIndex);
const logicStr = logicLines.join('\n');

// Find all exports
const states = [...logicStr.matchAll(/const \[([a-zA-Z0-9_]+), set[a-zA-Z0-9_]+\] = useState/g)].map(m => m[1]);
const setters = states.map(s => 'set' + s.charAt(0).toUpperCase() + s.slice(1));
const funcs = ['updateMatch', 'startMatch', 'handleEditSet', 'addPoint', 'deductPoint', 'forceEndSet', 'confirmChangeEnds', 'callLet', 'callServiceFault', 'issueCard', 'retireTeam', 'saveMatchToProfile', 'handleClose', 'getName', 'getGender', 'deduceCategory', 'startBreak', 'endBreak'];
const otherVars = ['selectedPlayerIds', 'buddyCheckPassed', 'isDoubles', 'serverName', 'receiverName', 'currentGameNum', 'serverScore', 'receiverScore', 'cardBadge'];

// The hook file content
const hookCode = `import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { ScoringLogic, type MatchFormat } from "@/lib/umpire/scoringLogic";
import type { PlayerSlim as Player } from "@/types";
import { MatchEditState, BwfMatchState, PointLogEntry, CardType, CardTarget } from "@/types/umpire";

export interface UmpireStateProps {
  userId: string;
  userEmail: string;
  userName: string;
  isTournamentUmpire?: boolean;
  friendlyOnly?: boolean;
  initialMatchState?: BwfMatchState | MatchEditState | null;
  onClose: () => void;
}

export function useUmpireState({
  userId,
  userEmail,
  userName,
  isTournamentUmpire,
  friendlyOnly,
  initialMatchState,
  onClose
}: UmpireStateProps) {
  ${logicLines.join('\n  ')}

  return {
    ${[...states, ...setters, ...funcs, ...otherVars].join(',\n    ')}
  };
}
`;

fs.writeFileSync('client/src/hooks/useUmpireState.ts', hookCode);

// Replace logic in UmpireEngine
const hookCall = `
  const umpireState = useUmpireState({
    userId, userEmail, userName, isTournamentUmpire, friendlyOnly, initialMatchState, onClose
  });
  const {
    ${[...states, ...setters, ...funcs, ...otherVars].join(', ')}
  } = umpireState;
`;

lines.splice(startIndex, endIndex - startIndex, hookCall);
fs.writeFileSync('client/src/components/umpire/UmpireEngine.tsx', lines.join('\n'));

console.log('Hook extraction complete. Hook size:', logicLines.length, 'lines.');
