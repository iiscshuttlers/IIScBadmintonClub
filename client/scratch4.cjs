const fs = require('fs');
const content = fs.readFileSync('e:/Github/iiscshuttlers/client/src/pages/PlayerProfile.tsx', 'utf8');

const stack = [];
const regex = /<div(?=[\s>])|<\/div>/g;

let match;
while ((match = regex.exec(content)) !== null) {
  if (match[0] === '</div>') { 
     stack.pop();
  } else {
     // Check if it's self closing
     const nextClose = content.indexOf('>', match.index);
     const tagContent = content.substring(match.index, nextClose + 1);
     if (tagContent.endsWith('/>')) {
        // self closing, do nothing
     } else {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        // make sure it's not inside a comment
        const beforeStr = content.substring(0, match.index);
        const lastCommentStart = beforeStr.lastIndexOf('/*');
        const lastCommentEnd = beforeStr.lastIndexOf('*/');
        if (lastCommentStart > lastCommentEnd) {
           // inside comment, ignore
           continue;
        }
        stack.push({ line: lineNumber, content: tagContent.replace(/\s+/g, ' ').trim() });
     }
  }
}
console.log("Unclosed divs:");
stack.forEach(x => console.log(`Line ${x.line}: ${x.content}`));
