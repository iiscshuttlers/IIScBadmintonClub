const fs = require('fs');

const umpireEnginePath = 'client/src/components/umpire/UmpireEngine.tsx';
const lines = fs.readFileSync(umpireEnginePath, 'utf8').split('\n');

// Find bounds
let start = -1;
let end = -1;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('const renderSetupContent = () => {')) start = i;
  if (lines[i].includes('const renderSetupOverlay = () => {')) { end = i; break; }
}

if (start === -1 || end === -1) {
  console.log('Bounds not found');
  process.exit(1);
}

// Lines to extract
const contentLines = lines.slice(start + 1, end - 3); // extract inner content

const newFileContent = `import React from 'react';
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

  const t1p1Name = match.t1.p1Id ? getName(match.t1.p1Id) : "";
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

  return (
` + contentLines.map(l => l.replace(/^  /, '')).join('\n') + `
}
`;

fs.writeFileSync('client/src/components/umpire/UmpireSetupFlow.tsx', newFileContent);

// Modify UmpireEngine.tsx
lines.splice(start, end - start, `  const renderSetupContent = () => (
    <UmpireSetupFlow
      match={match}
      setMatch={setMatch}
      players={players}
      friendlyOnly={friendlyOnly}
      isEditSetupOpen={isEditSetupOpen}
      setIsEditSetupOpen={setIsEditSetupOpen}
      handleClose={handleClose}
      getName={getName}
      deduceCategory={deduceCategory}
      startMatch={startMatch}
      buddyCheckPassed={buddyCheckPassed}
      selectedPlayerIds={selectedPlayerIds}
    />
  );`);

const updatedEngineText = `import { UmpireSetupFlow } from "./UmpireSetupFlow";\n` + lines.join('\n');
fs.writeFileSync('client/src/components/umpire/UmpireEngine.tsx', updatedEngineText);

console.log('Successfully extracted UmpireSetupFlow!');
