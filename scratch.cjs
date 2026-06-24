const fs = require('fs');
let code = fs.readFileSync('client/src/pages/PlayerProfile.tsx', 'utf8');

// 1. Add hook imports
code = code.replace(
  /import \{ isMasterAdminEmail as isAdminEmail \} from "@\/lib\/admin";/,
  `import { usePlayerProfile } from "@/hooks/usePlayerProfile";\nimport { usePlayerStats } from "@/hooks/usePlayerStats";\nimport { useMatchActions } from "@/hooks/useMatchActions";\nimport { isMasterAdminEmail as isAdminEmail } from "@/lib/admin";`
);

// 2. Remove all states up to refreshProfile (handled by usePlayerProfile)
const stateRegex = /const \[player, setPlayer\] = useState<Player \| null>\(null\);[\s\S]*?const refreshProfile = async \(\) => \{[\s\S]*?^\s*};\n/m;
code = code.replace(stateRegex, '');

// 3. Remove useEffect for initial fetch and refresh interval
const useEffectRegex = /useEffect\(\(\) => \{[\s\S]*?refreshProfile\(\);[\s\S]*?\}, \[id\]\);\n\n  useEffect\(\(\) => \{[\s\S]*?clearInterval\(interval\);\n  }, \[id, loading\]\);/m;
code = code.replace(useEffectRegex, '');

// 4. Inject hook calls
const hookCalls = `
  const {
    player,
    loading,
    error,
    liveMatches,
    pendingMatches,
    ownPlayerProfile,
    isFollowing,
    setIsFollowing,
    isBuddy,
    setIsBuddy,
    hasSentRequest,
    setHasSentRequest,
    hasReceivedRequest,
    setHasReceivedRequest,
    refreshPlayerProfile,
  } = usePlayerProfile(id, matchesOnly);

  const validAchievements = React.useMemo(
    () =>
      player ? player.achievements.filter((a) => a && a.trim() !== "") : [],
    [player],
  );

  const {
    profileCompleteness,
    dynamicBadges,
    winPct,
    totalMatches,
    splitStats,
    streakStats,
    totalPlayedGames
  } = usePlayerStats(player, liveMatches, validAchievements);

  const {
    handleConfirmMatch,
    handleRejectMatch,
    handleResendRequest,
    handleWithdrawMatch
  } = useMatchActions(ownPlayerProfile, refreshPlayerProfile, () => {});
`;
code = code.replace(/const isUnranked = false;/, hookCalls + '\n  const isUnranked = false;');

// 5. Remove match action handlers
code = code.replace(/\/\* ── Match action handlers ──[\s\S]*?handleWithdrawMatch = async[^\}]+toast\.error[^\}]+}[^\}]+}[^\}]+}[^\}]+};/m, '');

// 6. Remove advanced stats and split stats
code = code.replace(/const dynamicBadges = useMemo[\s\S]*?\}, \[liveMatches, id\]\);/m, '');
code = code.replace(/const profileCompleteness = useMemo[\s\S]*?\}, \[player\]\);/m, '');
code = code.replace(/const splitStats = useMemo[\s\S]*?\}, \[liveMatches, id\]\);/m, '');

fs.writeFileSync('client/src/pages/PlayerProfile.tsx', code);
