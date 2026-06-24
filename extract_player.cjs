const fs = require('fs');
let lines = fs.readFileSync('client/src/components/umpire/UmpireEngine.tsx', 'utf8').split('\n');
lines.splice(238, 121);
const newText = 'import { PlayerSelect } from "./PlayerSelect";\n' + lines.join('\n');
fs.writeFileSync('client/src/components/umpire/UmpireEngine.tsx', newText);
