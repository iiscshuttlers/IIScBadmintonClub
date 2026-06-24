const fs = require('fs');
const lines = fs.readFileSync('engineBottom.txt', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('match.status === "finished"')) {
    console.log(i + 1, l.trim());
  }
});
