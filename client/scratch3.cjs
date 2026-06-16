const fs = require('fs');
const content = fs.readFileSync('e:/Github/iiscshuttlers/client/src/pages/PlayerProfile.tsx', 'utf8');

// Replace comments
const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '');

const stack = [];
const regex = /<div(?=[\s>])|<\/div>/g;

let match;
while ((match = regex.exec(cleanContent)) !== null) {
  if (match[0] === '</div>') { 
     stack.pop();
  } else {
     // Check if it's self closing by looking ahead for the next >
     const nextClose = cleanContent.indexOf('>', match.index);
     const tagContent = cleanContent.substring(match.index, nextClose + 1);
     if (tagContent.endsWith('/>')) {
        // self closing, do nothing
     } else {
        // find line number
        const lineNumber = cleanContent.substring(0, match.index).split('\n').length;
        stack.push(lineNumber);
     }
  }
}
console.log("Unclosed divs at lines:", stack);
