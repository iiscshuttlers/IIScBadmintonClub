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
  tagPlayers: { id: string; full_name: string; user_id: string | null }[];
  setLocation: (path: string) => void;
  removeTag: (path: string, id: string) => void;
  approveTag: (path: string, tag: TagEntry) => void;
  rejectTag: (path: string, tag: TagEntry) => void;
  requestTag: (path: string) => void;
  saveTag: (path: string, player: { id: string; full_name: string; user_id: string | null }) => void;
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
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white text-xs font-bold px-3 py-1 rounded-full cursor-pointer transition-colors group"
              onClick={(e) => { e.stopPropagation(); setLocation(`/player/${tag.id}`); }}
            >
              <Tag className="w-3 h-3 text-emerald-400" />
              {tag.name}
              {isAdmin && (
                <button
                  className="ml-1 text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
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
        <div className="flex flex-col items-center justify-center gap-1.5 mt-2 bg-slate-900/60 border border-amber-500/30 p-2.5 rounded-2xl w-full max-w-sm backdrop-blur-md">
          <span className="text-amber-400 text-[10px] uppercase font-black tracking-widest mb-0.5">Pending Approvals</span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {pendingTags.map((pt) => (
              <div key={pt.id} className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 text-white text-xs font-bold px-3 py-1 rounded-full">
                {pt.name}
                <div className="flex items-center ml-1 border-l border-amber-500/30 pl-1.5 gap-1">
                  <button onClick={(e) => { e.stopPropagation(); approveTag(itemPath, pt); }} className="p-0.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/20 rounded-full transition-colors" title="Approve">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); rejectTag(itemPath, pt); }} className="p-0.5 text-red-400 hover:text-red-300 hover:bg-red-400/20 rounded-full transition-colors" title="Reject">
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
            <div className="flex items-center gap-1.5 mt-2 text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 rounded-full text-[11px] font-bold shadow-lg">
              <CheckCircle2 className="w-3.5 h-3.5" /> Tag Requested (Pending Approval)
            </div>
          );
        }

        return (
          <button
            onClick={(e) => { e.stopPropagation(); requestTag(itemPath); }}
            className="flex items-center gap-1.5 mt-2 text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/40 px-3 py-1.5 rounded-full text-[11px] font-bold shadow-lg transition-all"
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
              className="flex items-center gap-1.5 text-white/50 hover:text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 hover:border-white/40 hover:bg-white/10 transition-all"
              onClick={(e) => { e.stopPropagation(); setShowTagPanel((v) => !v); setTagSearch(""); }}
            >
              <UserPlus className="w-3.5 h-3.5" /> Tag a player
            </button>

            {showTagPanel && (
              <div
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-2 border-b border-slate-700 flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    autoFocus
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Search player…"
                    className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 outline-none"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredPlayers.length === 0 ? (
                    <p className="text-slate-500 text-xs text-center py-4">No players found</p>
                  ) : (
                    filteredPlayers.map((p) => (
                      <button
                        key={p.id}
                        className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-emerald-600/20 transition-colors flex items-center gap-2"
                        onClick={() => { saveTag(itemPath, p); setShowTagPanel(false); }}
                      >
                        <UserPlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        {p.full_name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
