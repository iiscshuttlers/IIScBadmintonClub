const ts = require('typescript');
const fs = require('fs');

const fileName = 'client/src/pages/PlayerProfile.tsx';
let sourceText = fs.readFileSync(fileName, 'utf8');

const sourceFile = ts.createSourceFile(
  fileName,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

const replacements = [];

function findUseMemoDeclaration(node, varName) {
  let foundNode = null;
  function visit(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText() === varName) {
      if (n.initializer && ts.isCallExpression(n.initializer)) {
        if (n.initializer.expression.getText() === 'useMemo' || n.initializer.expression.getText() === 'React.useMemo') {
          foundNode = n.parent.parent; 
        }
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(node);
  return foundNode;
}

function findMatchHandlers(node) {
  let nodes = [];
  function visit(n) {
    if (ts.isVariableDeclaration(n)) {
      const name = n.name.getText();
      if (['handleConfirmMatch', 'handleRejectMatch', 'handleResendRequest', 'handleWithdrawMatch'].includes(name)) {
        nodes.push(n.parent.parent); 
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(node);
  return nodes;
}

const toRemove = [
  'dynamicBadges',
  'profileCompleteness',
  'splitStats',
  'validAchievements',
  'winPct',
  'totalMatches',
  'streakStats',
  'totalPlayedGames'
];

toRemove.forEach(varName => {
  const node = findUseMemoDeclaration(sourceFile, varName);
  if (node) {
    replacements.push({ start: node.getFullStart(), end: node.getEnd(), text: '' });
  }
});

const handlerNodes = findMatchHandlers(sourceFile);
handlerNodes.forEach(n => {
  replacements.push({ start: n.getFullStart(), end: n.getEnd(), text: '' });
});

replacements.sort((a, b) => b.start - a.start);

let newSource = sourceText;
for (const r of replacements) {
  newSource = newSource.substring(0, r.start) + r.text + newSource.substring(r.end);
}

// Inject hooks
const hookCalls = `
  const validAchievements = useMemo(
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
  } = useMatchActions(ownPlayerProfile, refreshProfile, () => {});
`;

newSource = newSource.replace(/const isUnranked = false;/, hookCalls + '\n  const isUnranked = false;');
newSource = newSource.replace(/import \{ isMasterAdminEmail as isAdminEmail \} from "@\/lib\/admin";/, 
`import { usePlayerStats } from "@/hooks/usePlayerStats";\nimport { useMatchActions } from "@/hooks/useMatchActions";\nimport { isMasterAdminEmail as isAdminEmail } from "@/lib/admin";`);

fs.writeFileSync(fileName, newSource);
console.log('Successfully refactored PlayerProfile.tsx');
