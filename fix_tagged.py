import re

with open("client/src/pages/PlayerProfile.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the conditional render for media
old_media = """                {player.stats.media.some(m => m.type === "image") && (
                  <div>
                    <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
                      <Image className="w-4 h-4 text-emerald-500" /> Game Photos
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {player.stats.media.filter(m => m.type === "image").map((img, idx) => (
                        <div key={idx} onClick={() => setLightboxImage(img.url)}
                          className="group relative aspect-video rounded-2xl overflow-hidden cursor-pointer border border-slate-200 dark:border-slate-800 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                          <img loading="lazy" src={img.url} alt={img.caption || "Game Photo"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                            <span className="text-white text-xs font-bold line-clamp-2">{img.caption || "View"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}"""

new_media = """                <div>
                  <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center justify-between mb-3">
                    <span className="flex items-center gap-2"><Image className="w-4 h-4 text-emerald-500" /> Tagged In</span>
                    <button onClick={() => alert("Tagging feature coming in v3.0! For now, ping admins to add photos.")} className="text-[10px] uppercase font-bold text-slate-400 hover:text-emerald-500 transition-colors bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">Add Photo</button>
                  </h3>
                  {player.stats.media.filter(m => m.type === "image").length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {player.stats.media.filter(m => m.type === "image").map((img, idx) => (
                        <div key={idx} onClick={() => setLightboxImage(img.url)}
                          className="group relative aspect-video rounded-2xl overflow-hidden cursor-pointer border border-slate-200 dark:border-slate-800 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                          <img loading="lazy" src={img.url} alt={img.caption || "Game Photo"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                            <span className="text-white text-xs font-bold line-clamp-2">{img.caption || "View"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center">
                      <Image className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">No tagged photos yet.</p>
                    </div>
                  )}
                </div>"""

content = content.replace(old_media, new_media)

with open("client/src/pages/PlayerProfile.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Tagged In option fixed.")
