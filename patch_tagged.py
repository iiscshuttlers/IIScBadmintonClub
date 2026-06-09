import re

with open("client/src/pages/PlayerProfile.tsx", "r", encoding="utf-8") as f:
    content = f.read()

tagged_ui = """
                    <TabsContent value="tagged" className="mt-6">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden relative group">
                            <img src={`https://source.unsplash.com/random/400x400/?badminton,sport&sig=${player.userId}${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-white text-xs font-bold bg-black/50 px-2 py-1 rounded">Tagged</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
"""

content = content.replace("<TabsList className=\"w-full max-w-sm mx-auto grid grid-cols-2\">", "<TabsList className=\"w-full max-w-md mx-auto grid grid-cols-3\">")
content = content.replace("<TabsTrigger value=\"matches\" className=\"rounded-xl font-bold\">Matches</TabsTrigger>", "<TabsTrigger value=\"matches\" className=\"rounded-xl font-bold\">Matches</TabsTrigger>\n                      <TabsTrigger value=\"tagged\" className=\"rounded-xl font-bold\">Tagged In</TabsTrigger>")
content = content.replace("</TabsContent>", "</TabsContent>\n" + tagged_ui)

with open("client/src/pages/PlayerProfile.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("PlayerProfile.tsx updated with Tagged In tab.")
