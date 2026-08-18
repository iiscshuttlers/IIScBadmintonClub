import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Lock, Zap, UserPlus, LogOut, User, Settings, Shield, Trash2, Trophy } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PreferencesModal } from "@/components/QuickSettings";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const STATUS_CONFIG = [
  { id: "looking", short: "Available", dot: "bg-primary", active: "bg-primary/20 text-primary dark:text-primary/70 ring-1 ring-primary/40" },
  { id: "playing", short: "Playing", dot: "bg-amber-400",   active: "bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/40" },
  { id: "resting", short: "Resting", dot: "bg-indigo-400",  active: "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-400/40" },
  { id: "injured", short: "Injured", dot: "bg-rose-400",    active: "bg-rose-500/20 text-rose-700 dark:text-rose-300 ring-1 ring-rose-400/40" },
] as const;
export default function SubBarProfileButton({
  userAvatar, userName, userEmail, myPlayerId, pendingActionCount,
  isAdmin, savedAccounts, switchAccount, handleSignOut, handleInvite,
}: {
  userAvatar: string | null; userName: string; userEmail: string; myPlayerId: string | null;
  pendingActionCount: number; isAdmin: boolean;
  savedAccounts: any[]; switchAccount: (acc: any) => Promise<void>;
  handleSignOut: (msg?: string) => void; handleInvite: () => void;
}) {
  const [, setLocation] = useLocation();
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const { profile, session, refreshProfile } = useAuth();
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const currentStatus = (profile as any)?.status || "looking";

  const updateStatus = async (newStatus: string) => {
    if (!profile?.id || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const { error } = await supabase.from("players").update({ status: newStatus } as any).eq("id", profile.id);
      if (error) throw error;
      if (newStatus === "playing" && session?.user?.id) {
        const now = new Date();
        await supabase.from("court_visits").insert({ user_id: session.user.id, visited_at: now.toISOString(), day_of_week: now.getDay(), hour: now.getHours() });
      }
      await refreshProfile();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 hover:border-primary transition-all duration-200 overflow-hidden shrink-0 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-950">
          {userAvatar ? (
            <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary to-teal-600 text-on-accent flex items-center justify-center font-black text-xs">
              {userName ? userName[0].toUpperCase() : "U"}
            </div>
          )}
          {pendingActionCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-on-accent shadow ring-1 ring-white dark:ring-slate-950">
              {pendingActionCount > 9 ? "9+" : pendingActionCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 border-0 overflow-hidden rounded-2xl shadow-2xl shadow-slate-300/40 dark:shadow-black/60">
        <div className="relative overflow-hidden bg-gradient-to-br from-primary via-teal-600 to-primary dark:from-slate-900 dark:via-slate-800 dark:to-primary/90 px-4 pt-3 pb-4">
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />
          <div className="relative flex justify-between items-center mb-3">
            <span className="text-[10px] font-black tracking-widest text-foreground/50">IISc BADMINTON CLUB</span>
            <button onClick={() => handleSignOut()} className="text-[11px] font-bold text-foreground/50 hover:text-foreground/90 transition-colors px-2 py-0.5 rounded-md hover:bg-white/10">Sign out</button>
          </div>
          <div className="relative flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border-2 border-white/30 shadow-lg shadow-black/20">
              {userAvatar ? (
                <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/20 text-foreground flex items-center justify-center font-black text-xl">
                  {userName ? userName[0].toUpperCase() : "U"}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-foreground text-base leading-tight truncate">{userName}</p>
              <p className="text-foreground/55 text-xs truncate mt-0.5">{userEmail}</p>
              <Link href={myPlayerId ? `/player/${myPlayerId}` : "/profile/setup"} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-foreground/70 hover:text-foreground bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-full transition-all">
                View profile →
              </Link>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-2.5 space-y-2 max-h-[70vh] overflow-y-auto">
          {profile?.id && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-1.5 grid grid-cols-2 gap-1">
              {STATUS_CONFIG.map(({ id, short, dot, active: activeClass }) => {
                const active = currentStatus === id;
                return (
                  <button
                    key={id}
                    disabled={updatingStatus}
                    onClick={() => updateStatus(id)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold transition-all ${
                      active
                        ? activeClass
                        : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${active ? dot : "bg-slate-300 dark:bg-slate-600"}`} />
                    {short}
                  </button>
                );
              })}
            </div>
          )}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <DropdownMenuItem onSelect={() => setLocation("/profile/setup")} className="cursor-pointer font-semibold rounded-none text-muted-foreground dark:text-slate-300 focus:text-foreground dark:focus:text-foreground focus:bg-slate-50 dark:focus:bg-slate-800 px-3 py-2.5 gap-2.5">
              <User className="w-4 h-4 text-muted-foreground" /> Edit Profile
            </DropdownMenuItem>
            {myPlayerId && (
              <DropdownMenuItem onSelect={() => setLocation(`/player/${myPlayerId}/personal`)} className="cursor-pointer font-semibold rounded-none text-muted-foreground dark:text-slate-300 focus:text-foreground dark:focus:text-foreground focus:bg-slate-50 dark:focus:bg-slate-800 px-3 py-2.5 border-t border-slate-100 dark:border-slate-800 gap-2.5">
                <Trophy className="w-4 h-4 text-muted-foreground" /> Personal
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setLocation("/profile/password")} className="cursor-pointer font-semibold rounded-none text-muted-foreground dark:text-slate-300 focus:text-foreground dark:focus:text-foreground focus:bg-slate-50 dark:focus:bg-slate-800 px-3 py-2.5 border-t border-slate-100 dark:border-slate-800 gap-2.5">
              <Lock className="w-4 h-4 text-muted-foreground" /> Change Password
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setIsPreferencesOpen(true); }} className="cursor-pointer font-semibold rounded-none text-muted-foreground dark:text-slate-300 focus:text-foreground dark:focus:text-foreground focus:bg-slate-50 dark:focus:bg-slate-800 px-3 py-2.5 border-t border-slate-100 dark:border-slate-800 gap-2.5">
              <Settings className="w-4 h-4 text-muted-foreground" /> App Preferences
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setLocation("/join?add_account=true")} className="cursor-pointer font-semibold rounded-none text-muted-foreground dark:text-slate-300 focus:text-foreground dark:focus:text-foreground focus:bg-slate-50 dark:focus:bg-slate-800 gap-2.5 px-3 py-2.5 border-t border-slate-100 dark:border-slate-800">
              <UserPlus className="h-4 w-4 text-muted-foreground" /> Add Account
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleInvite} className="cursor-pointer font-semibold rounded-none text-muted-foreground dark:text-slate-300 focus:text-foreground dark:focus:text-foreground focus:bg-slate-50 dark:focus:bg-slate-800 border-t border-slate-100 dark:border-slate-800 gap-2.5 px-3 py-2.5">
              <UserPlus className="h-4 w-4 text-primary" /> Invite Friends
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setLocation("/privacy")} className="cursor-pointer font-semibold rounded-none text-muted-foreground dark:text-slate-300 focus:text-foreground dark:focus:text-foreground focus:bg-slate-50 dark:focus:bg-slate-800 border-t border-slate-100 dark:border-slate-800 gap-2.5 px-3 py-2.5">
              <Shield className="h-4 w-4 text-muted-foreground" /> Privacy Policy
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onSelect={() => setLocation("/admin")} className="cursor-pointer font-semibold rounded-none text-violet-600 dark:text-violet-400 focus:text-violet-700 dark:focus:text-violet-300 focus:bg-violet-50 dark:focus:bg-violet-950/30 gap-2.5 px-3 py-2.5 border-t border-slate-100 dark:border-slate-800">
                <Zap className="h-4 w-4" /> Site Admin
              </DropdownMenuItem>
            )}
          </div>
{savedAccounts.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-3 py-2 text-[10px] font-black text-muted-foreground dark:text-muted-foreground uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">Switch Account</div>
              {savedAccounts.map((acc) => (
                <DropdownMenuItem key={acc.id} className="cursor-pointer font-medium rounded-none focus:text-foreground dark:focus:text-foreground focus:bg-slate-50 dark:focus:bg-slate-800 px-3 py-2.5 border-b border-slate-50 dark:border-slate-800/50 last:border-b-0" onClick={async () => { await switchAccount(acc); }}>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-muted-foreground dark:text-slate-200">{acc.name}</span>
                    <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">{acc.email}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          )}
          <button onClick={() => handleSignOut("Are you sure you want to sign out of this account?")} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/25 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-bold text-sm border border-rose-100 dark:border-rose-900/50 transition-colors">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
          <button onClick={() => setLocation("/delete-account")} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-muted-foreground dark:text-muted-foreground hover:text-rose-500 dark:hover:text-rose-500 font-semibold text-xs transition-colors">
            <Trash2 className="h-3.5 w-3.5" /> Delete Account
          </button>
        </div>
      </DropdownMenuContent>
      
      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
    </DropdownMenu>
  );
}
