const fs = require('fs');
const path = 'D:/NF/New folder/iiscshuttlers/client/src/components/umpire/UmpireEngine.tsx';
const content = fs.readFileSync(path, 'utf8').split('\n');

// Keep lines 0 to 103 (up to UmpireEngine signature)
const before = content.slice(0, 103);
// Keep lines from 778 onwards (SETUP SCREEN and below)
const after = content.slice(778);

const newCode = `  const umpireState = useUmpireState({
    userId,
    userEmail,
    userName,
    isTournamentUmpire,
    friendlyOnly: !isAdminEmail(userEmail) && !isTournamentUmpire,
    initialMatchState,
    onClose
  });

  const {
    players, match, cards, showLog, showChangeEnds, changeEndsReason,
    pendingBreakAfterEnds, showCardPanel, cardTarget, showRetireModal,
    isEditSetupOpen, showToolsMenu, isDirectScoreOpen, showFullTimer,
    directSetsText, directWinner, myBuddies, breakSecondsLeft, breakLabel,
    setPlayers, setMatch, setCards, setShowLog, setShowChangeEnds, setChangeEndsReason,
    setPendingBreakAfterEnds, setShowCardPanel, setCardTarget, setShowRetireModal,
    setIsEditSetupOpen, setShowToolsMenu, setIsDirectScoreOpen, setShowFullTimer,
    setDirectSetsText, setDirectWinner, setBreakSecondsLeft, setBreakLabel,
    updateMatch, startMatch, handleEditSet, addPoint, deductPoint, forceEndSet,
    confirmChangeEnds, callLet, callServiceFault, issueCard, retireTeam, saveMatchToProfile,
    handleClose, getName, getGender, deduceCategory, startBreak, endBreak,
    selectedPlayerIds, buddyCheckPassed, isDoubles, serverName, receiverName,
    currentGameNum, serverScore, receiverScore, cardBadge
  } = umpireState;

  // Render variables
  const friendlyOnly = !isAdminEmail(userEmail) && !isTournamentUmpire;`;

const finalContent = [...before, newCode, ...after].join('\n');
fs.writeFileSync(path, finalContent);
console.log('Done refactoring UmpireEngine.tsx');
