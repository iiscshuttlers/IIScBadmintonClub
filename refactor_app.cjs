const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Import useAppBootstrap
content = content.replace(
  'import { usePingsNotification } from "./hooks/usePingsNotification";\nimport { initSounds } from "./lib/sounds";',
  'import { useAppBootstrap } from "./hooks/useAppBootstrap";'
);

// 2. Remove old hook imports
content = content.replace('import { useInactivityLogout } from "./hooks/useInactivityLogout";\n', '');
content = content.replace('import { useNativeBackButton } from "./hooks/useNativeBackButton";\n', '');
content = content.replace('import { usePullToRefresh } from "./hooks/usePullToRefresh";\n', '');
content = content.replace('import { useOfflineSync } from "./hooks/useOfflineSync";\n', '');
content = content.replace('import { useBroadcastNotification } from "./hooks/useBroadcastNotification";\n', '');

// 3. Remove GlobalAuthHooks
content = content.replace(/function GlobalAuthHooks\(\) \{[\s\S]*?return null;\n\}\n/g, '');

// 4. Update AppContent
content = content.replace(
  /function AppContent\(\) \{[\s\S]*?useOfflineSync\(\);[\s\S]*?\}\);[\s\S]*?\}, \[profile\?\.id\]\);/g,
  `function AppContent() {
  const { updateInfo, isDialogOpen, dismissUpdate } = useAppUpdate();
  const { profile } = useAuth();
  
  const {
    isLogMatchOpen,
    setIsLogMatchOpen,
    defaultOpponentId,
    setDefaultOpponentId,
    otherPlayers
  } = useAppBootstrap();`
);

// 5. Remove <GlobalAuthHooks /> from JSX
content = content.replace(/\s*<GlobalAuthHooks \/>\n/g, '\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('App.tsx cleaned up');
