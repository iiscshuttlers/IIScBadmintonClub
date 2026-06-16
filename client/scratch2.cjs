const fs = require('fs');
const content = fs.readFileSync('e:/Github/iiscshuttlers/client/src/pages/PlayerProfile.tsx', 'utf8');
const lines = content.split('\n');
const stack = [];

// A better way is to iterate over the entire content and match `<div` and `</div`
let inComment = false;
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  // Very crude block comment ignoring (assumes no multiple comments per line or complex stuff)
  if (line.includes('/*') && line.includes('*/')) {
     line = line.replace(/\/\*.*\*\//g, '');
  }
  
  // Find all <div or </div
  const tokens = [...line.matchAll(/<div(?=[\s>])|<\/div>|<div[^>]*\/>/g)];
  for (const match of tokens) {
    if (match[0].startsWith('</div')) {
       stack.pop();
    } else if (match[0].endsWith('/>')) {
       // self closing, do nothing
    } else {
       stack.push(i + 1);
    }
  }
}
console.log("Unclosed divs at lines:", stack);
