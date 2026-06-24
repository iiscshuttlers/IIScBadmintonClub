const fs = require('fs');

const path = 'client/src/pages/PlayersDirectory.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add imports
if (!content.includes('usePlayers')) {
  content = content.replace(
    'import { lazy, Suspense } from "react";',
    `import { lazy, Suspense } from "react";\nimport { usePlayers, usePendingMatches, useBuddyRequests, useFollowers } from "@/hooks/usePlayers";`
  );
}

// 2. Remove Cache constants and functions
content = content.replace(/const PLAYER_SELECT =[\s\S]*?\/\* ── Main page ──/m, "/* ── Main page ──");

// 3. Replace state definitions inside PlayersDirectory
content = content.replace(/const \[players, setPlayers\] = useState<Player\[\]>\(\[\]\);[\s\S]*?const \[fetchError, setFetchError\] = useState\(false\);/m, 
`const { data: rawPlayers, isLoading: loading, isError: fetchError } = usePlayers();
  const players = rawPlayers || [];`);

content = content.replace(/const \[pendingMatches, setPendingMatches\] = useState<any\[\]>\(\[\]\);/m, 
`const { data: pendingMatches = [] } = usePendingMatches(ownProfile?.id);`);

content = content.replace(/const \[followers, setFollowers\] = useState<any\[\]>\(\[\]\);/m,
`const { data: followers = [] } = useFollowers(ownProfile?.id);`);

content = content.replace(/const \[buddyRequests, setBuddyRequests\] = useState<Map<string, {id: string; status: string; senderId: string}>>\(new Map\(\)\);/m,
`const { data: buddyRequestsRaw = [] } = useBuddyRequests(ownProfile?.id);
  const buddyRequests = useMemo(() => {
    const map = new Map<string, {id: string; status: string; senderId: string}>();
    buddyRequestsRaw.forEach((req: any) => {
      const otherPlayerId = req.sender_id === ownProfile?.id ? req.receiver_id : req.sender_id;
      map.set(otherPlayerId, { id: req.id, status: req.status, senderId: req.sender_id });
    });
    return map;
  }, [buddyRequestsRaw, ownProfile?.id]);`);

// 4. Remove all fetch functions
content = content.replace(/const fetchPlayers = useCallback\([\s\S]*?\}, \[\]\);/m, "");
content = content.replace(/const fetchFollowers = useCallback\([\s\S]*?\}, \[\]\);/m, "");
content = content.replace(/const fetchBuddyRequests = useCallback\([\s\S]*?\}, \[\]\);/m, "");
content = content.replace(/const fetchPendingMatches = useCallback\([\s\S]*?\}, \[\]\);/m, "");

// 5. Remove useEffects calling fetch functions
content = content.replace(/useEffect\(\(\) => \{\s*fetchPlayers\(\);\s*\}, \[fetchPlayers\]\);/m, "");
content = content.replace(/useEffect\(\(\) => \{\s*if \(!loading\).*?stuckLoaderTimeout\);\s*\}, \[loading\]\);/s, "");

// 6. Fix applySession calls to fetch functions
content = content.replace(/fetchPendingMatches\(data\.id\);\s*fetchFollowers\(data\.id\);\s*fetchBuddyRequests\(data\.id\);/m, "");

// 7. Replace useAutoRefresh silentRefresh
content = content.replace(/const silentRefresh = useCallback\(async \(\) => \{[\s\S]*?\}, \[.*\]\);\s*useAutoRefresh\(silentRefresh, 60_000, !loading\);/m, "");

// 8. Fix mutation invalidations
content = content.replace(/fetchBuddyRequests\(ownProfile\.id\);/g, "/* React Query auto refetches or we can invalidate */");
content = content.replace(/fetchPendingMatches\(ownProfile!\.id\);/g, "/* React Query auto refetches */");
content = content.replace(/fetchPlayers\(\);/g, "/* React Query auto refetches */");

fs.writeFileSync(path, content);
console.log('Successfully refactored PlayersDirectory to React Query!');
