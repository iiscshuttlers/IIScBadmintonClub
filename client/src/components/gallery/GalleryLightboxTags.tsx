import { useState } from "react";
import { Tag, X, UserPlus, Search, CheckCircle2, Check } from "lucide-react";
export type TagEntry = { id: string; name: string };

export function GalleryLightboxTags({
  itemPath,
  tags,
  pendingTags,
  session,
  tagPlayers,
  setLocation,
  removeTag,
  approveTag,
  rejectTag,
  requestTag,
  saveTag,
  isAdmin,
  currentUserProfile,
}: {
  itemPath: string;
  tags: TagEntry[];
  pendingTags: TagEntry[];
  session: any;
  tagPlayers: { id: string; full_name: string }[];
  setLocation: (path: string) => void;
  removeTag: (path: string, id: string) => void;
  approveTag: (path: string, tag: TagEntry) => void;
  rejectTag: (path: string, tag: TagEntry) => void;
  requestTag: (path: string) => void;
  saveTag: (path: string, player: { id: string; full_name: string }) => void;
  isAdmin: boolean;
  currentUserProfile?: { id: string; full_name: string } | null;
}) {
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [tagSearch, setTagSearch] = useState("");

  const filteredPlayers = tagPlayers.filter((p) =>
    p.full_name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  return (
    <>
      {/* Tagged player chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-1.5 bg-on-media/15 hover:bg-on-media/25 backdrop-blur-sm border border-on-media/25 text-on-media text-xs font-bold px-3 py-1 rounded-full cursor-pointer transition-colors group"
              onClick={(e) => { e.stopPropagation(); setLocation(`/player/${tag.id}`); }}
            >
              <Tag className="w-3 h-3 text-on-media/70" />
              {tag.name}
              {isAdmin && (
                <button
                  className="ml-1 text-on-media/70 hover:text-on-media opacity-0 group-hover:opacity-100 transition-all"
                  onClick={(e) => { e.stopPropagation(); removeTag(itemPath, tag.id); }}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pending Tags UI (For Admins) */}
      {isAdmin && pendingTags.length > 0 && (
        <div className="flex flex-col items-center justify-center gap-1.5 mt-2 bg-card border border-warning/40 p-2.5 rounded-2xl w-full max-w-sm shadow-lg">
          <span className="text-warning text-[10px] uppercase font-black tracking-widest mb-0.5">Pending Approvals</span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {pendingTags.map((pt) => (
              <div key={pt.id} className="flex items-center gap-1.5 bg-warning/20 border border-warning/40 text-foreground text-xs font-bold px-3 py-1 rounded-full">
                {pt.name}
                <div className="flex items-center ml-1 border-l border-warning/30 pl-1.5 gap-1">
                  <button onClick={(e) => { e.stopPropagation(); approveTag(itemPath, pt); }} className="p-0.5 text-primary hover:text-primary/70 hover:bg-primary/20 rounded-full transition-colors" title="Approve">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); rejectTag(itemPath, pt); }} className="p-0.5 text-danger hover:text-danger/80 hover:bg-danger/20 rounded-full transition-colors" title="Reject">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regular User Request Tag Button */}
      {currentUserProfile && !isAdmin && (() => {
        const isAlreadyTagged = tags.some((t) => t.id === currentUserProfile.id);
        const isAlreadyPending = pendingTags.some((t) => t.id === currentUserProfile.id);

        if (isAlreadyTagged) return null;

        if (isAlreadyPending) {
          return (
            <div className="flex items-center gap-1.5 mt-2 text-warning bg-card border border-warning/40 px-3 py-1.5 rounded-full text-[11px] font-bold shadow-lg">
              <CheckCircle2 className="w-3.5 h-3.5" /> Tag Requested (Pending Approval)
            </div>
          );
        }

        return (
          <button
            onClick={(e) => { e.stopPropagation(); requestTag(itemPath); }}
            className="flex items-center gap-1.5 mt-2 text-on-media/90 hover:text-on-media bg-on-media/10 hover:bg-on-media/20 border border-on-media/25 hover:border-on-media/50 px-3 py-1.5 rounded-full text-[11px] font-bold shadow-lg transition-all"
          >
            🙋‍♂️ Is that you? Request Tag
          </button>
        );
      })()}

      {/* Tag a player button + panel (Admins Only) */}
      {isAdmin && (
        <div className="flex items-center gap-2 relative">
          <div className="relative mt-2">
            <button
              className="flex items-center gap-1.5 text-on-media/75 hover:text-on-media text-xs font-bold px-3 py-1.5 rounded-full border border-on-media/25 hover:border-on-media/50 hover:bg-on-media/10 transition-all"
              onClick={(e) => { e.stopPropagation(); setShowTagPanel((v) => !v); setTagSearch(""); }}
            >
              <UserPlus className="w-3.5 h-3.5" /> Tag a player
            </button>

            {showTagPanel && (
              <div
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-card border border-border-strong rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-2 border-b border-border-strong flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    autoFocus
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Search player…"
                    className="flex-1 bg-transparent text-foreground text-sm placeholder-faint outline-none"
                  />
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowTagPanel(false); }}
                    className="p-1 hover:bg-foreground/10 rounded-full transition-colors text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredPlayers.length === 0 ? (
                    <p className="text-muted-foreground text-xs text-center py-4">No players found</p>
                  ) : (
                    filteredPlayers.map((p) => {
                      const isTagged = tags.some((t) => t.id === p.id);
                      const isPending = pendingTags.some((t) => t.id === p.id);
                      
                      return (
                        <button
                          key={p.id}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                            isTagged || isPending
                              ? "bg-primary/10 text-primary hover:bg-primary/20 font-semibold"
                              : "text-foreground hover:bg-muted"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isTagged || isPending) {
                              removeTag(itemPath, p.id);
                            } else {
                              saveTag(itemPath, p);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {isTagged || isPending ? (
                              <Check className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <UserPlus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                            {p.full_name}
                          </div>
                          {(isTagged || isPending) && (
                            <span className="text-[10px] uppercase font-bold text-primary/70">
                              {isPending ? "Pending" : "Tagged"}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="p-2 border-t border-border-strong bg-muted/50">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowTagPanel(false); }}
                    className="w-full py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-xl transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
