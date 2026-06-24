import { Heart, Activity, UserCheck, Sword, Star } from "lucide-react";
import { PlayerCard, type Player } from "@/components/players-directory/PlayerCard";

interface NetworkTabProps {
  players: Player[];
  myBuddyIds: Set<string>;
  ownProfile: Player | null;
  setLocation: (path: string) => void;
  setSelectedOpponentId: (id: string) => void;
  setIsLogMatchOpen: (open: boolean) => void;
  followingIds: Set<string>;
  followers: Player[];
  myBuddyRequests: {
    accepted: Set<string>;
    received: Set<string>;
    sent: Set<string>;
  };
  isAdmin: boolean;
  handleAdminDelete: (id: string) => void;
  handleAdminEdit: (id: string) => void;
  handleBuddyAction: (playerId: string, action: 'send'|'cancel'|'accept'|'remove') => void;
  handleToggleFollow: (id: string) => void;
}

export function NetworkTab({
  players,
  myBuddyIds,
  ownProfile,
  setLocation,
  setSelectedOpponentId,
  setIsLogMatchOpen,
  followingIds,
  followers,
  myBuddyRequests,
  isAdmin,
  handleAdminDelete,
  handleAdminEdit,
  handleBuddyAction,
  handleToggleFollow,
}: NetworkTabProps) {
  return (
    <div className="space-y-10">
      {/* Buddies section */}
      <div>
        <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-5 flex items-center gap-2">
          <Heart className="w-4 h-4 text-violet-500" /> My Buddies ({myBuddyIds.size})
        </h2>
        {myBuddyIds.size === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
            <Heart className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 font-medium text-sm">No buddies yet. Add some from the Directory!</p>
          </div>
        ) : (() => {
          const buddyPlayers = players.filter((p) => myBuddyIds.has(p.id));
          const activeBuddies = buddyPlayers.filter((p) => p.status === "looking" || p.status === "playing" || (!p.status && (p as any).is_looking_to_play));
          const inactiveBuddies = buddyPlayers.filter((p) => !(p.status === "looking" || p.status === "playing" || (!p.status && (p as any).is_looking_to_play)));
          return (
            <div className="space-y-6">
              {activeBuddies.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
                      <Activity className="w-3.5 h-3.5" /> Active
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {activeBuddies.map((player) => (
                      <div
                        key={player.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-emerald-300 dark:border-emerald-700 p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition shadow-sm"
                        onClick={() => setLocation(`/player/${player.id}`)}
                      >
                        <div className="relative shrink-0">
                          {player.avatar_url ? (
                            <img src={player.avatar_url} className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-black text-lg">
                              {player.full_name[0]}
                            </div>
                          )}
                          <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${player.status === "playing" ? "bg-amber-400" : "bg-emerald-500"}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-sm text-slate-800 dark:text-slate-100 truncate">{player.full_name}</p>
                          <p className="text-xs text-slate-400 truncate">{player.department}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">ELO {player.elo_rating ?? "—"}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${player.status === "playing" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400" : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"}`}>
                              {player.status === "playing" ? "Playing Right Now" : "Looking to Play"}
                            </span>
                          </div>
                        </div>
                        {ownProfile && (
                          <button
                            className="ml-auto shrink-0 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOpponentId(player.id);
                              setIsLogMatchOpen(true);
                            }}
                          >
                            <Sword className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {inactiveBuddies.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-wider">
                      <UserCheck className="w-3.5 h-3.5" /> Resting / Inactive
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {inactiveBuddies.map((player) => (
                      <div
                        key={player.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition shadow-sm"
                        onClick={() => setLocation(`/player/${player.id}`)}
                      >
                        <div className="relative shrink-0">
                          {player.avatar_url ? (
                            <img src={player.avatar_url} className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white font-black text-lg">
                              {player.full_name[0]}
                            </div>
                          )}
                          <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${player.status === "injured" ? "bg-rose-400" : player.status === "resting" ? "bg-indigo-400" : "bg-slate-400"}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-sm text-slate-800 dark:text-slate-100 truncate">{player.full_name}</p>
                          <p className="text-xs text-slate-400 truncate">{player.department}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">ELO {player.elo_rating ?? "—"}</span>
                            {player.status && player.status !== "offline" && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${player.status === "injured" ? "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400" : player.status === "resting" ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                                {player.status === "injured" ? "Injured" : player.status === "resting" ? "Taking a break" : "Offline"}
                              </span>
                            )}
                          </div>
                        </div>
                        {ownProfile && (
                          <button
                            className="ml-auto shrink-0 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOpponentId(player.id);
                              setIsLogMatchOpen(true);
                            }}
                          >
                            <Sword className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Following section */}
      <div>
        <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-5 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-violet-500" /> My Following ({followingIds.size})
        </h2>
        {followingIds.size === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
            <UserCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 font-medium text-sm">You aren't following anyone yet. Find some players!</p>
          </div>
        ) : (() => {
          const followingPlayers = players.filter((p) => followingIds.has(p.id));
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {followingPlayers.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  isOwn={false}
                  isAdmin={isAdmin}
                  onDelete={handleAdminDelete}
                  onEdit={handleAdminEdit}
                  onLogMatch={
                    ownProfile
                      ? () => {
                          setSelectedOpponentId(player.id);
                          setIsLogMatchOpen(true);
                        }
                      : undefined
                  }
                  isBuddy={myBuddyIds.has(player.id)}
                  hasReceivedRequest={myBuddyRequests.received.has(player.id)}
                  hasSentRequest={myBuddyRequests.sent.has(player.id)}
                  onBuddyAction={ownProfile ? handleBuddyAction : undefined}
                  isFollowing={followingIds.has(player.id)}
                  onToggleFollow={ownProfile ? handleToggleFollow : undefined}
                  currentUserName={ownProfile?.full_name}
                  currentUserId={ownProfile?.id}
                />
              ))}
            </div>
          );
        })()}
      </div>

      {/* Followers section */}
      <div>
        <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-5 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" /> My Followers ({followers.length})
        </h2>
        {followers.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
            <UserCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 font-medium text-sm">No followers yet. Keep playing!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {followers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isOwn={false}
                isAdmin={isAdmin}
                onDelete={handleAdminDelete}
                onEdit={handleAdminEdit}
                onLogMatch={
                  ownProfile
                    ? () => {
                        setSelectedOpponentId(player.id);
                        setIsLogMatchOpen(true);
                      }
                    : undefined
                }
                isBuddy={myBuddyIds.has(player.id)}
                hasReceivedRequest={myBuddyRequests.received.has(player.id)}
                hasSentRequest={myBuddyRequests.sent.has(player.id)}
                onBuddyAction={ownProfile ? handleBuddyAction : undefined}
                isFollowing={followingIds.has(player.id)}
                onToggleFollow={ownProfile ? handleToggleFollow : undefined}
                currentUserName={ownProfile?.full_name}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pending buddy requests (received) */}
      {ownProfile && (() => {
        const pendingPlayers = players.filter(p => myBuddyRequests.received.has(p.id));
        return (
          <div>
            <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-5 flex items-center gap-2">
              <Heart className="w-4 h-4 text-emerald-500" /> Pending Buddy Requests ({pendingPlayers.length})
            </h2>
            {pendingPlayers.length === 0 ? (
              <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                <Heart className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 font-medium text-sm">No pending requests.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingPlayers.map(player => (
                  <div key={player.id} className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl px-4 py-3 shadow-sm">
                    <div
                      className="shrink-0 w-10 h-10 rounded-full overflow-hidden cursor-pointer"
                      onClick={() => setLocation(`/player/${player.id}`)}
                    >
                      {player.avatar_url ? (
                        <img src={player.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-black text-slate-500">
                          {player.full_name[0]}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setLocation(`/player/${player.id}`)}>
                      <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{player.full_name}</div>
                      <div className="text-xs text-slate-500">{player.department}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleBuddyAction(player.id, 'accept')}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleBuddyAction(player.id, 'remove')}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
