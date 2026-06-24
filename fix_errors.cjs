const fs = require('fs');

let c1 = fs.readFileSync('client/src/pages/DoublesPairProfile.tsx', 'utf8');
c1 = c1.replace('setTeam1Player1(p1 as PlayerRow);', 'setTeam1Player1(p1 as any as PlayerRow);');
fs.writeFileSync('client/src/pages/DoublesPairProfile.tsx', c1);

let c2 = fs.readFileSync('client/src/pages/PlayersDirectory.tsx', 'utf8');
c2 = c2.replace('import { Link } from "react-router-dom";', 'import { Link } from "react-router-dom";\nimport type { PlayerRow } from "@/types";');
c2 = c2.replace('setCurrentUser(data as PlayerRow);', 'setCurrentUser(data as any as PlayerRow);');
fs.writeFileSync('client/src/pages/PlayersDirectory.tsx', c2);

let c3 = fs.readFileSync('client/src/pages/PlayerProfile.tsx', 'utf8');
c3 = c3.replace('useMatchActions(ownPlayerProfile, refreshProfile, () => {});', 'useMatchActions(ownPlayerProfile, refreshProfile, () => {}, pendingMatches);');
fs.writeFileSync('client/src/pages/PlayerProfile.tsx', c3);
