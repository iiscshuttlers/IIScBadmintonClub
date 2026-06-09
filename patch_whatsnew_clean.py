import re

with open("client/src/pages/Home.tsx", "r", encoding="utf-8") as f:
    content = f.read()

modal_ui = """
      {/* What's New Modal */}
      {showWhatsNew && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-indigo-100 dark:border-indigo-900/50 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <Trophy className="w-32 h-32 text-indigo-500" />
            </div>
            
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl">
                <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">What's New!</h2>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">v2.5 Platform Update</p>
              </div>
            </div>

            <div className="space-y-4 mb-8 relative z-10">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Overwatch Tribunal</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Suspicious matches are now flagged for admin review.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-lg shrink-0 mt-0.5">
                  <Activity className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Calibration Phase</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">New players are 'Unranked' for their first 5 matches.</p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                setShowWhatsNew(false);
                localStorage.setItem('seenWhatsNew_v25', 'true');
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-colors relative z-10"
            >
              Awesome, let's play!
            </button>
          </motion.div>
        </div>
      )}
"""

state_injection = """
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem('seenWhatsNew_v25')) {
      const timer = setTimeout(() => setShowWhatsNew(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);
"""

content = content.replace("export default function Home() {", "export default function Home() {\n" + state_injection)

# Specific replace for the opening return of Home
content = re.sub(r"(export default function Home\(\) \{[\s\S]*?return \(\n\s*)<div", r"\1<>\n" + modal_ui + "\n    <div", content, count=1)

# Specific replace for the closing of Home. `  );\n}\n\n// -- Animated Logo`
content = re.sub(r"</div>\n\s*\);\n\}\n\n// -- Animated Logo", "</div>\n    </>\n  );\n}\n\n// -- Animated Logo", content, count=1)

with open("client/src/pages/Home.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Home.tsx updated cleanly.")
