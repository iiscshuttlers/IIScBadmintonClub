import re

with open("client/src/pages/Feed.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# We want to find the <button onClick={...}> right before <Share2 className="w-4 h-4" /> Share </button>
# Let's replace the whole block using regex
pattern = r"<button\s+onClick=\{async\s*\(e\)\s*=>\s*\{[^}]*e\.preventDefault\(\);[^<]*</button>"
replacement = """<button 
                      onClick={(e) => {
                        e.preventDefault();
                        handleShare(match);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 ml-2"
                    >
                      <Share2 className="w-4 h-4" /> Share
                    </button>"""

content = re.sub(pattern, replacement, content, count=1)

with open("client/src/pages/Feed.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Feed.tsx fixed.")
