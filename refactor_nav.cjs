const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/components/Navigation.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
if (!content.includes('useAppMode')) {
  content = content.replace(
    'import { useAppUpdate } from "@/hooks/useAppUpdate";',
    'import { useAppUpdate } from "@/hooks/useAppUpdate";\nimport { useAppMode } from "@/contexts/AppModeContext";'
  );
}

// 2. Replace TOP_LEVEL_LINKS
const clubLinks = `const CLUB_LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/players", label: "Players" },
  { href: "/events", label: "Events" },
  { href: "/hall-of-fame", label: "Winners Wall" },
  { href: "/gallery", label: "Gallery" },
  { href: "/exchange", label: "Exchange" },
  { href: "/about", label: "Club" },
];

const PERSONAL_LINKS = [
  { href: "/feed/my-matches", label: "My Matches" },
  { href: "/players?tab=connections", label: "My Network" },
  { href: "/profile/setup", label: "Profile" }
];`;

content = content.replace(
  /const TOP_LEVEL_LINKS = \[[\s\S]*?\];/,
  clubLinks
);

// 3. Add ModeToggle Component inside Navigation
if (!content.includes('ModeToggle')) {
  const modeToggleComponent = `
function ModeToggle({ isLoggedIn, setLocation, mode, setMode }: { isLoggedIn: boolean, setLocation: any, mode: 'club' | 'personal', setMode: any }) {
  const handleToggle = (newMode: 'club' | 'personal') => {
    if (newMode === 'personal' && !isLoggedIn) {
      sessionStorage.setItem("return_url", "/feed/my-matches");
      setLocation("/join");
      return;
    }
    setMode(newMode);
  };

  return (
    <div className="flex bg-slate-100 dark:bg-slate-900 rounded-full p-1 mr-2 shadow-inner border border-slate-200/60 dark:border-slate-800">
      <button
        onClick={() => handleToggle('club')}
        className={\`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all \${mode === 'club' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}\`}
      >
        <Users className="w-3.5 h-3.5" /> Club
      </button>
      <button
        onClick={() => handleToggle('personal')}
        className={\`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all \${mode === 'personal' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}\`}
      >
        <User className="w-3.5 h-3.5" /> Personal
      </button>
    </div>
  );
}`;
  content = content.replace('export default function Navigation() {', modeToggleComponent + '\n\nexport default function Navigation() {');
}

// 4. Inject hooks into Navigation
if (!content.includes('const { mode, setMode } = useAppMode();')) {
  content = content.replace(
    'const { updateInfo, openUpdateDialog } = useAppUpdate();',
    'const { updateInfo, openUpdateDialog } = useAppUpdate();\n  const { mode, setMode } = useAppMode();\n  \n  const currentLinks = mode === "club" ? CLUB_LINKS : PERSONAL_LINKS;'
  );
}

// 5. Replace TOP_LEVEL_LINKS map in desktop and mobile
content = content.replace(
  /TOP_LEVEL_LINKS\.map/g,
  'currentLinks.map'
);

content = content.replace(
  /TOP_LEVEL_LINKS\.filter/g,
  'currentLinks.filter'
);

// 6. Inject ModeToggle into Desktop Top Nav
if (!content.includes('<ModeToggle')) {
  content = content.replace(
    '<div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">',
    '<div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">\n              <ModeToggle isLoggedIn={isLoggedIn} setLocation={setLocation} mode={mode} setMode={setMode} />'
  );
}

// 7. Inject ModeToggle into Mobile Bottom Sheet Menu
if (!content.includes('ModeToggle') || (content.match(/ModeToggle/g) && content.match(/ModeToggle/g).length < 2)) { // Very simple check
  content = content.replace(
    '<div className="w-10 h-1 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-4" />',
    '<div className="w-10 h-1 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-4" />\n                <div className="flex justify-center mb-4"><ModeToggle isLoggedIn={isLoggedIn} setLocation={setLocation} mode={mode} setMode={setMode} /></div>'
  );
}

// 8. Update Mobile Bottom Navigation Bar icons dynamically based on mode
const bottomBarRegex = /<div className="lg:hidden fixed bottom-0 left-0 right-0 z-\[9999\][\s\S]*?<\/div>\s*\{\/\* Global Search Modal \*\/\}/;

const newBottomBar = `<div className="lg:hidden fixed bottom-0 left-0 right-0 z-[9999] bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 flex justify-around items-end px-2 pb-safe pt-1 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
            {mode === 'club' ? (
              <>
                <Link href="/">
                  <button className={\`relative flex flex-col items-center p-2 min-w-[60px] \${isActive("/") ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}\`}>
                    <Home className={\`w-[22px] h-[22px] mb-1 \${isActive("/") ? "fill-emerald-600/20" : ""}\`} />
                    <span className="text-[10px] font-bold">Home</span>
                  </button>
                </Link>
                <Link href="/feed">
                  <button className={\`relative flex flex-col items-center p-2 min-w-[60px] \${isActive("/feed") ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}\`}>
                    <Activity className={\`w-[22px] h-[22px] mb-1 \${isActive("/feed") ? "fill-emerald-600/20" : ""}\`} />
                    <span className="text-[10px] font-bold">Feed</span>
                    {hasUnreadAnnouncements && (
                      <span title="New announcements" className="absolute top-1 right-2.5 flex items-center justify-center">
                        <span className="w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-950" />
                      </span>
                    )}
                  </button>
                </Link>
              </>
            ) : (
              <>
                <Link href={myPlayerId ? \`/player/\${myPlayerId}\` : "/join"}>
                  <button className={\`relative flex flex-col items-center p-2 min-w-[60px] \${(location.startsWith("/player/") && location.includes(myPlayerId!)) ? "text-blue-600 dark:text-blue-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}\`}>
                    <User className={\`w-[22px] h-[22px] mb-1 \${(location.startsWith("/player/") && location.includes(myPlayerId!)) ? "fill-blue-600/20" : ""}\`} />
                    <span className="text-[10px] font-bold">My Stats</span>
                  </button>
                </Link>
                <Link href="/feed/my-matches">
                  <button className={\`relative flex flex-col items-center p-2 min-w-[60px] \${isActive("/feed/my-matches") ? "text-blue-600 dark:text-blue-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}\`}>
                    <Activity className={\`w-[22px] h-[22px] mb-1 \${isActive("/feed/my-matches") ? "fill-blue-600/20" : ""}\`} />
                    <span className="text-[10px] font-bold">My Feed</span>
                  </button>
                </Link>
              </>
            )}

            {/* Center Log Match FAB */}
            <div className="relative -top-5 mx-1">
              {isLoggedIn ? (
                <button
                  onClick={() => window.dispatchEvent(new Event('openLogMatchModal'))}
                  className={\`w-[52px] h-[52px] \${mode === 'club' ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-500/40' : 'bg-gradient-to-tr from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 shadow-blue-500/40'} rounded-full flex items-center justify-center text-white shadow-xl border-4 border-white dark:border-slate-950 transition-transform active:scale-95 cursor-pointer\`}
                >
                  <Plus className="w-6 h-6 stroke-[3]" />
                </button>
              ) : (
                <button onClick={() => {
                  sessionStorage.setItem("return_url", window.location.pathname + window.location.search + window.location.hash);
                  setLocation("/join");
                }} className="w-[52px] h-[52px] bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center text-white shadow-xl border-4 border-white dark:border-slate-950 transition-transform active:scale-95 cursor-pointer">
                  <LogIn className="w-5 h-5 ml-1" />
                </button>
              )}
            </div>

            {mode === 'club' ? (
              <Link href="/players">
                <button className={\`relative flex flex-col items-center p-2 min-w-[60px] \${isActive("/players") ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}\`}>
                  <Users className={\`w-[22px] h-[22px] mb-1 \${isActive("/players") ? "fill-emerald-600/20" : ""}\`} />
                  <span className="text-[10px] font-bold">Players</span>
                </button>
              </Link>
            ) : (
              <Link href="/players?tab=connections">
                <button className={\`relative flex flex-col items-center p-2 min-w-[60px] \${isActive("/players") ? "text-blue-600 dark:text-blue-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}\`}>
                  <Users className={\`w-[22px] h-[22px] mb-1 \${isActive("/players") ? "fill-blue-600/20" : ""}\`} />
                  <span className="text-[10px] font-bold">Network</span>
                </button>
              </Link>
            )}

            <button
              onClick={() => setIsOpen(!isOpen)}
              className={\`relative flex flex-col items-center p-2 min-w-[60px] cursor-pointer \${isOpen ? (mode === 'club' ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400") : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}\`}
            >
              {isOpen ? <X className="w-[22px] h-[22px] mb-1" /> : <Menu className="w-[22px] h-[22px] mb-1" />}
              <span className="text-[10px] font-bold">Menu</span>
            </button>
        </div>

      {/* Global Search Modal */}`;

content = content.replace(bottomBarRegex, newBottomBar);

fs.writeFileSync(filePath, content);
console.log('Navigation.tsx successfully updated.');
