const fs = require('fs');

const umpireSetupPath = 'client/src/components/umpire/UmpireSetupFlow.tsx';
let content = fs.readFileSync(umpireSetupPath, 'utf8');

// I will fix UmpireSetupFlow by replacing the duplicate section
const toRemove = `  const t1p1Name = match.t1.p1Id ? getName(match.t1.p1Id) : "";
  const t1p2Name = match.t1.p2Id ? getName(match.t1.p2Id) : "";
  const t2p1Name = match.t2.p1Id ? getName(match.t2.p1Id) : "";
  const t2p2Name = match.t2.p2Id ? getName(match.t2.p2Id) : "";

  const teamLabel = (p1: string, p2: string, fallback: string) =>
    p1 ? (p2 ? \`\${p1.split(" ")[0]} & \${p2.split(" ")[0]}\` : p1) : fallback;

  const t1Label = teamLabel(t1p1Name, t1p2Name, "Team 1");
  const t2Label = teamLabel(t2p1Name, t2p2Name, "Team 2");
  const playersReady = !!(match.t1.p1Id && match.t2.p1Id);
  const isDoubles = !!(match.t1.p2Id || match.t2.p2Id);

  const initials = (name: string) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (`;

// But wait, it's easier to just recreate it from the original renderSetupContent.txt!
const renderText = fs.readFileSync('renderSetupContent.txt', 'utf8').split('\n');

const newContent = `import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { PlayerSelect } from './PlayerSelect';
import type { PlayerSlim as Player } from '@/types';
import type { BwfMatchState } from './UmpireEngine';

interface UmpireSetupFlowProps {
  match: BwfMatchState;
  setMatch: React.Dispatch<React.SetStateAction<BwfMatchState>>;
  players: Player[];
  friendlyOnly: boolean;
  isEditSetupOpen: boolean;
  setIsEditSetupOpen: (val: boolean) => void;
  handleClose: () => void;
  getName: (id: string) => string;
  deduceCategory: () => string;
  startMatch: () => void;
  buddyCheckPassed: boolean;
  selectedPlayerIds: string[];
}

export function UmpireSetupFlow({
  match,
  setMatch,
  players,
  friendlyOnly,
  isEditSetupOpen,
  setIsEditSetupOpen,
  handleClose,
  getName,
  deduceCategory,
  startMatch,
  buddyCheckPassed,
  selectedPlayerIds,
}: UmpireSetupFlowProps) {
  const updateMatch = (updates: Partial<BwfMatchState>) => setMatch(prev => ({ ...prev, ...updates }));

` + renderText.slice(1, -2).map(l => l.replace(/^  /, '')).join('\n') + `
}
`;

fs.writeFileSync(umpireSetupPath, newContent);
console.log('Fixed UmpireSetupFlow!');
