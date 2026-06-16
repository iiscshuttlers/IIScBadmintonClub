const fs = require('fs');
const content = fs.readFileSync('e:/Github/iiscshuttlers/client/src/pages/PlayerProfile.tsx', 'utf8');
const lines = content.split('\n');
let depth = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  const opens = (line.match(/<div(?=[\s>])/g) || []).length;
  const selfClosing = (line.match(/<div[^>]*\/>/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  
  depth += (opens - selfClosing) - closes;
  
  if (i % 100 === 0) {
    console.log(`Line ${i}: depth = ${depth}`);
  }
}
console.log("Final depth:", depth);
