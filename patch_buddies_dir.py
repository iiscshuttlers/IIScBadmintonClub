import re

with open("client/src/pages/PlayersDirectory.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add buddies array parsing
buddies_code = """
            const buddiesLooking = players.filter(p => 
              ownProfile.buddies?.includes(p.id) && p.status === 'looking'
            );
"""

content = content.replace("const recommended = players.filter(p =>", buddies_code + "\n            const recommended = players.filter(p =>")

# Add UI for buddies looking
buddies_ui = """
              {buddiesLooking.length > 0 && (
                <div className="mb-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-pink-100 dark:bg-pink-900/50 rounded-lg">
                      <Heart className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Buddies Online</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Your buddies are looking for a match right now!</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {buddiesLooking.map(player => (
                      <PlayerCard 
                        key={"buddy-" + player.id}
                        player={player} 
                        isOwn={false} 
                        isAdmin={isAdmin} 
                        onDelete={handleAdminDelete} 
                        onEdit={handleAdminEdit}
                        onLogMatch={ownProfile ? () => { setSelectedOpponentId(player.id); setIsLogMatchOpen(true); } : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}
"""

content = content.replace("return (\n                <div className=\"mb-10\">", "return (\n              <>\n" + buddies_ui + "                <div className=\"mb-10\">")
content = content.replace("                  </div>\n                </div>\n              );\n            })()", "                  </div>\n                </div>\n              </>\n              );\n            })()")
content = content.replace("import { Search, Filter, Shield, Trophy, Activity, Sword } from \"lucide-react\";", "import { Search, Filter, Shield, Trophy, Activity, Sword, Heart } from \"lucide-react\";")

with open("client/src/pages/PlayersDirectory.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("PlayersDirectory updated with Buddies Online.")
