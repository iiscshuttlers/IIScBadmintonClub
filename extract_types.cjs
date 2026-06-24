const fs = require('fs');

const text = fs.readFileSync('client/src/components/umpire/UmpireEngine.tsx', 'utf8');
const lines = text.split('\n');

const startTypes = lines.findIndex(l => l.includes('import type { PlayerSlim as Player } from "@/types";'));
const endTypes = lines.findIndex(l => l.includes('export function UmpireEngine({'));

if (startTypes > -1 && endTypes > -1) {
  const typesContent = lines.slice(startTypes, endTypes).join('\n');
  fs.writeFileSync('client/src/types/umpire.ts', typesContent);

  lines.splice(startTypes, endTypes - startTypes, 'import { MatchEditState, BwfMatchState, PointLogEntry, CardType, CardTarget } from "@/types/umpire";\nimport type { PlayerSlim as Player } from "@/types";\n');
  fs.writeFileSync('client/src/components/umpire/UmpireEngine.tsx', lines.join('\n'));
  console.log('Extracted types successfully.');
} else {
  console.log('Could not find start/end bounds.');
}
