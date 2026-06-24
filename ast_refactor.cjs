const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/hooks/useUmpireState.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add import for useUmpireStore
if (!content.includes('import { useUmpireStore }')) {
  content = content.replace(
    'import { useState, useEffect, useRef, useCallback, useMemo } from "react";',
    'import { useState, useEffect, useRef, useCallback, useMemo } from "react";\nimport { useUmpireStore } from "@/store/umpireStore";'
  );
}

// 2. We need to initialize the store state ONCE per match based on initialMatchState.
// We can use an effect for that, but we have to replace the local state variables.

const statesToReplace = [
  'cards', 'showLog', 'showChangeEnds', 'changeEndsReason', 'pendingBreakAfterEnds',
  'showCardPanel', 'cardTarget', 'showRetireModal', 'isEditSetupOpen', 'showToolsMenu',
  'isDirectScoreOpen', 'showFullTimer', 'directSetsText', 'directWinner',
  'breakSecondsLeft', 'breakLabel'
];

let storeDestructure = `  const {
    match: storeMatch, setMatch, updateMatch,
    ${statesToReplace.map(s => `${s}, set${s.charAt(0).toUpperCase() + s.slice(1)}`).join(',\n    ')}
  } = useUmpireStore();\n\n`;

// Replace `const [match, setMatch] = useState...` with store logic
// We'll rename local match to `_initialMatch` just for the first run, and use `storeMatch` as the real one.
content = content.replace(
  /const\s+\[match,\s*setMatch\]\s*=\s*useState<BwfMatchState>\(\(\)\s*=>\s*\{([\s\S]*?)\}\);/,
  `// Use Zustand store instead
${storeDestructure}
  const match = storeMatch || (() => {
    $1
  })();

  useEffect(() => {
    if (!storeMatch) {
      setMatch(match);
    }
  }, [storeMatch, setMatch, match]);
`
);

// Replace `const [state, setState] = useState...` for the rest
for (const state of statesToReplace) {
  const cap = state.charAt(0).toUpperCase() + state.slice(1);
  const regex = new RegExp(`const\\s+\\[${state},\\s*set${cap}\\]\\s*=\\s*useState.*?;`, 'g');
  content = content.replace(regex, `// ${state} now in Zustand`);
}

// Replace startBreak logic and endBreak logic to use umpireEffects
if (!content.includes('import { playTimerEndEffect }')) {
  content = content.replace(
    'import { useState',
    'import { playTimerEndEffect } from "@/lib/umpire/umpireEffects";\nimport { useState'
  );
}

// Inside startBreak, replace the audio/haptics try/catch block with a call to playTimerEndEffect()
content = content.replace(
  /try\s*\{\s*if\s*\(typeof\s*window[\s\S]*?catch\(e\)\s*\{\}/g,
  'playTimerEndEffect();'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully refactored useUmpireState.tsx to use Zustand!');
