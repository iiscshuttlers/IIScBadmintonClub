const fs = require('fs');

let c1 = fs.readFileSync('client/src/pages/DoublesPairProfile.tsx', 'utf8');
c1 = c1.replace('setTeam1Player1(p1 as any as PlayerRow);', '');
c1 = c1.replace('setTeam1Player1(p1 as PlayerRow);', 'setTeam1Player1(p1 as any as PlayerRow);');
fs.writeFileSync('client/src/pages/DoublesPairProfile.tsx', c1);

let c2 = fs.readFileSync('client/src/pages/PlayersDirectory.tsx', 'utf8');
if(!c2.includes('import type { PlayerRow }')) {
  c2 = c2.replace(/import \{.*\} from "lucide-react";/, '$&\nimport type { PlayerRow } from "@/types";');
}
c2 = c2.replace('setCurrentUser(data as PlayerRow);', 'setCurrentUser(data as any as PlayerRow);');
fs.writeFileSync('client/src/pages/PlayersDirectory.tsx', c2);

let c3 = fs.readFileSync('client/src/pages/PlayerProfile.tsx', 'utf8');
const hookBlockRegex = /  const validAchievements = useMemo\([\s\S]*?useMatchActions\(ownPlayerProfile, refreshProfile, \(\) => \{\}, pendingMatches\);\r?\n/m;
const match = c3.match(hookBlockRegex);
if(match) {
  c3 = c3.replace(match[0], '');
  // Insert it after profileLoadRetried
  c3 = c3.replace(/  const profileLoadRetried = useRef\(false\);/, '  const profileLoadRetried = useRef(false);\n' + match[0]);
  c3 = c3.replace('usePlayerStats(player,', 'usePlayerStats(player as any as import("@/types").PlayerRow,');
}
fs.writeFileSync('client/src/pages/PlayerProfile.tsx', c3);
