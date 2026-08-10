const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'client', 'src', 'components', 'admin', 'TournamentManager.tsx');
let content = fs.readFileSync(file, 'utf-8');

const injectConfirm = (searchStr) => {
  content = content.replace(searchStr, searchStr + '\n  const { confirm } = useConfirm();');
};

injectConfirm('const { session, isMainAdmin } = useAuth();');
injectConfirm('const [form, setForm] = useState<Tournament>({ ...tournament });');
injectConfirm('const { data: allPlayers } = usePlayers();');
// Since usePlayers() is in two places, we do it twice (or globally).
content = content.replace(/const \{ data: allPlayers \} = usePlayers\(\);/g, 'const { data: allPlayers } = usePlayers();\n  const { confirm } = useConfirm();');

injectConfirm('const [matches, setMatches] = useState<TournamentMatch[]>([]);');
// Wait, setMatches might be in multiple places. Let's do a global replace for that too if it's safe.
content = content.replace(/const \[matches, setMatches\] = useState<TournamentMatch\[\]>\(\[\]\);/g, 'const [matches, setMatches] = useState<TournamentMatch[]>([]);\n  const { confirm } = useConfirm();');


// Replacement 1
content = content.replace(
  /if \(\!confirm\(`Move tournament to "\$\{newStatus\}" status\?`\)\) return;/g,
  `if (!(await confirm({ title: 'Change Status', description: \`Move tournament to "\$\{newStatus\}" status?\` }))) return;`
);

// Replacement 2
content = content.replace(
  /if \(\!confirm\("Are you sure you want to completely delete this draft tournament\? This cannot be undone\."\)\) return;/g,
  `if (!(await confirm({ title: 'Delete Draft', description: "Are you sure you want to completely delete this draft tournament? This cannot be undone.", confirmVariant: 'danger', confirmLabel: 'Delete Draft' }))) return;`
);

// Replacement 3
content = content.replace(
  /if \(\!window\.confirm\(confirmMsg\)\) return;/g,
  `if (!(await confirm({ title: 'Confirm Status Change', description: confirmMsg }))) return;`
);

// Replacement 4
content = content.replace(
  /if \(\!confirm\(msg\)\) return;/g,
  `if (!(await confirm({ title: 'Confirm Action', description: msg }))) return;`
);

// Replacement 5
content = content.replace(
  /if \(\!confirm\("This will synchronize Round 1 bracket match names with the latest Participants list\. Continue\?"\)\) return;/g,
  `if (!(await confirm({ title: 'Sync Match Names', description: "This will synchronize Round 1 bracket match names with the latest Participants list. Continue?" }))) return;`
);

// Replacement 6
content = content.replace(
  /if \(\!confirm\("Reset this match to Scheduled\? This wipes score and status\."\)\) return;/g,
  `if (!(await confirm({ title: 'Reset Match', description: "Reset this match to Scheduled? This wipes score and status.", confirmVariant: 'danger', confirmLabel: 'Reset' }))) return;`
);

// Replacement 7
content = content.replace(
  /if \(\!confirm\(`Force change to \$\{newStatus\.toUpperCase\(\)\}\?`\)\) return;/g,
  `if (!(await confirm({ title: 'Force Status Change', description: \`Force change to \$\{newStatus.toUpperCase()\}?\` }))) return;`
);

// Replacement 8
content = content.replace(
  /if \(\!confirm\(`Archive "\$\{tournament\.name\}"\? This cannot be undone\.`\)\) return;/g,
  `if (!(await confirm({ title: 'Archive Tournament', description: \`Archive "\$\{tournament.name\}"? This cannot be undone.\`, confirmVariant: 'danger', confirmLabel: 'Archive' }))) return;`
);

// Replacement 9
content = content.replace(
  /if \(\!confirm\(`Unarchive "\$\{tournament\.name\}"\?`\)\) return;/g,
  `if (!(await confirm({ title: 'Unarchive Tournament', description: \`Unarchive "\$\{tournament.name\}"?\` }))) return;`
);

fs.writeFileSync(file, content, 'utf-8');
console.log('Replaced successfully');
