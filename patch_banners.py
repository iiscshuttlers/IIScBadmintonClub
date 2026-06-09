import re

with open("client/src/pages/PlayerProfile.tsx", "r", encoding="utf-8") as f:
    content = f.read()

banner_code = """
        {/* Profile Banner */}
        <div className="w-full h-32 sm:h-48 rounded-t-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 cursor-pointer hover:bg-black/70 transition-colors">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white text-xs font-bold">Play Anthem</span>
          </div>
        </div>
"""

# The profile currently has:
# <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden mb-8">
content = content.replace("<div className=\"bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden mb-8\">\n          <div className=\"flex flex-col md:flex-row gap-6 md:gap-8 items-start relative z-10\">", 
                          "<div className=\"bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative mb-8\">\n" + banner_code + "\n          <div className=\"p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8 items-start relative z-10 -mt-12 sm:-mt-16\">")

# Fix avatar to look good overlapping the banner
content = content.replace("<div className=\"relative shrink-0\">", "<div className=\"relative shrink-0 p-1.5 bg-white dark:bg-slate-900 rounded-full shadow-xl\">")

with open("client/src/pages/PlayerProfile.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("PlayerProfile.tsx updated with Banners & Anthems.")
