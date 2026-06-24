const fs = require('fs');

let content = fs.readFileSync('client/src/pages/PlayersDirectory.tsx', 'utf8');
content = content.replace('fetchPlayers(); // To refresh Elo', '/* React Query auto refetches */');
content = content.replace('fetchPlayers();', '/* React Query auto refetches */');
content = content.replace('.select(PLAYER_SELECT)', '.select("*")');
fs.writeFileSync('client/src/pages/PlayersDirectory.tsx', content);

let service = fs.readFileSync('client/src/services/playerService.ts', 'utf8');
service = service.replace('import { type Tables } from "@/types";', 'import type { PlayerRow } from "@/types";');
service = service.replace('type PlayerRow = Tables<"players">;', '');
fs.writeFileSync('client/src/services/playerService.ts', service);
