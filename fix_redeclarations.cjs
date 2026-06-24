const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/hooks/useUmpireState.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix updateMatch
content = content.replace(
  'match: storeMatch, setMatch, updateMatch,',
  'match: storeMatch, setMatch, updateMatch: storeUpdateMatch,'
);

// We need to change the internal function `updateMatch` to just call storeUpdateMatch inside, OR 
// since internal updateMatch does its own upsert logic, we should leave its name as updateMatch
// so we don't have to rename all calls to it. So renaming destructuring to storeUpdateMatch is correct.

// Fix cards
// Remove the useState line for cards
content = content.replace(
  /const\s*\[cards,\s*setCards\]\s*=\s*useState<Record<CardTarget,\s*CardType\[\]>>\(\{[\s\S]*?\}\);/,
  '// cards state now in Zustand'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed redeclarations');
