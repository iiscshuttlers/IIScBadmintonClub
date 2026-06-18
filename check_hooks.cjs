const fs = require('fs');
const path = require('path');
const hooksRegex = /^\s*const\s+\[.*?\]\s*=\s*(useState|useReducer|useAuth|useTheme|usePushNotifications|useAdminHistory)\(|^\s*(useEffect|useMemo|useCallback|useRef)\(/;
const earlyReturnRegex = /^\s*if\s*\(.*?\)\s*return\b/;

function scan(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        scan(fullPath);
      }
    } else if (fullPath.endsWith('.tsx')) {
      const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
      let foundReturn = false;
      let returnLine = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/^\s*export\s+(function|const)/) || line.match(/^\s*function\s+/)) {
          foundReturn = false;
        }
        if (earlyReturnRegex.test(line)) {
          foundReturn = true;
          returnLine = i + 1;
        } else if (foundReturn && hooksRegex.test(line)) {
          console.log('Hook violation in ' + fullPath + ' at line ' + (i + 1) + ', after return at ' + returnLine);
          foundReturn = false;
        }
      }
    }
  }
}
scan('client/src');
console.log('Scan complete.');
