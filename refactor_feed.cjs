const fs = require('fs');

let feed = fs.readFileSync('client/src/pages/Feed.tsx', 'utf8');

// Imports
feed = feed.replace('import { useState, useEffect, useCallback } from "react";', 'import { useState, useEffect, useCallback, useMemo } from "react";\nimport { useFeedMatches, useLiveSiteData } from "@/hooks/useMatches";');

// State
feed = feed.replace(`const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveMatchIds, setLiveMatchIds] = useState<Set<string>>(new Set());
  const [hasLiveMatches, setHasLiveMatches] = useState(false);

  const [limitCount, setLimitCount] = useState(100);`, 
`const [limitCount, setLimitCount] = useState(100);
  const { data: matches = [], isLoading: loading, isError } = useFeedMatches(limitCount);
  const { data: liveMatchesData } = useLiveSiteData("live_matches");

  const { liveMatchIds, hasLiveMatches } = useMemo(() => {
    const ids = new Set<string>();
    let anyLive = false;
    if (liveMatchesData) {
      Object.values(liveMatchesData).forEach((m: any) => {
        if (m.status === "playing") {
          anyLive = true;
          if (!m.isFriendly) {
            [m.t1?.p1Id, m.t1?.p2Id, m.t2?.p1Id, m.t2?.p2Id].filter(Boolean).forEach((id: string) => ids.add(id));
          }
        }
      });
    }
    return { liveMatchIds: ids, hasLiveMatches: anyLive };
  }, [liveMatchesData]);`);

// Remove old useEffect
const useEffectRegex = /\/\/ Subscribe to live broadcasts.*?return \(\) => \{ supabase\.removeChannel\(sub\); \};\n  \}, \[\]\);/s;
feed = feed.replace(useEffectRegex, '');

// Remove old fetchFeed
const fetchFeedRegex = /const fetchFeed = useCallback\(\s*async \(silent = false\) => \{[\s\S]*?\},\s*\[limitCount\]\s*\);/s;
feed = feed.replace(fetchFeedRegex, '');

// Fix applySession dependency
feed = feed.replace(/fetchFeed\(true\);/g, '/* React Query refetches */');

// Remove useAutoRefresh
feed = feed.replace(/useAutoRefresh\(fetchFeed, 30_000, !loading\);/g, '');
feed = feed.replace('import { useAutoRefresh } from "@/hooks/useAutoRefresh";', '');

fs.writeFileSync('client/src/pages/Feed.tsx', feed);
console.log('Done refactoring Feed.tsx');
