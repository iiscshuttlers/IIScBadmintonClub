import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Sun, Moon, Lock, Zap, UserPlus, Shield, LogOut
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuickSettingsContent } from "@/components/QuickSettings";
import { type ViewAsRole } from "@/contexts/AuthContext";

export default function SubBarProfileButton({
  userAvatar, userName, userEmail, myPlayerId, pendingActionCount,
  isAdmin, theme, toggleTheme, savedAccounts, switchAccount, handleSignOut, handleInvite,
  isTrulyMainAdmin, viewAsRole, setViewAsRole,
}: {
  userAvatar: string | null; userName: string; userEmail: string; myPlayerId: string | null;
  pendingActionCount: number; isAdmin: boolean; theme: string; toggleTheme: () => void;
  savedAccounts: any[]; switchAccount: (acc: any) => Promise<void>;
  handleSignOut: (msg?: string) => void; handleInvite: () => void;
  isTrulyMainAdmin: boolean; viewAsRole: ViewAsRole | null; setViewAsRole: (r: ViewAsRole | null) => void;
}) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 transition-all duration-200 overflow-hidden shrink-0 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950">
          {userAvatar ? (
            <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-xs">
              {userName ? userName[0].toUpperCase() : "U"}
            </div>
          )}
          {pendingActionCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white shadow ring-1 ring-white dark:ring-slate-950">
              {pendingActionCount > 9 ? "9+" : pendingActionCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 border-0 overflow-hidden rounded-2xl shadow-2xl shadow-slate-300/40 dark:shadow-black/60">
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 dark:from-slate-900 dark:via-slate-800 dark:to-emerald-950 px-4 pt-3 pb-4">
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />
          <div className="relative flex justify-between items-center mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/50">IISc Badminton Club</span>
            <button onClick={() => handleSignOut()} className="text-[11px] font-bold text-white/50 hover:text-white/90 transition-colors px-2 py-0.5 rounded-md hover:bg-white/10">Sign out</button>
          </div>
          <div className="relative flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border-2 border-white/30 shadow-lg shadow-black/20">
              {userAvatar ? (
                <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/20 text-white flex items-center justify-center font-black text-xl">
                  {userName ? userName[0].toUpperCase() : "U"}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-base leading-tight truncate">{userName}</p>
              <p className="text-white/55 text-xs truncate mt-0.5">{userEmail}</p>
              <Link href={myPlayerId ? `/player/${myPlayerId}` : "/profile/setup"} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-full transition-all">
                View profile →
              </Link>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-2.5 space-y-2 max-h-[70vh] overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-1 flex gap-1 shadow-sm border border-slate-100 dark:border-slate-800">
            <button onClick={() => { if (theme === "dark") toggleTheme(); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${theme === "light" ? "bg-amber-50 text-amber-700 shadow-sm border border-amber-200" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}>
              <Sun className="w-3.5 h-3.5" /> Light
            </button>
            <button onClick={() => { if (theme === "light") toggleTheme(); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${theme === "dark" ? "bg-indigo-950/60 text-indigo-300 shadow-sm border border-indigo-800" : "text-slate-400 hover:text-slate-600"}`}>
              <Moon className="w-3.5 h-3.5" /> Dark
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <QuickSettingsContent />
          </div>
          {isTrulyMainAdmin && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">View As</p>
              <div className="grid grid-cols-2 gap-1">
                {(["master_admin", "admin", "umpire", "player"] as ViewAsRole[]).map(role => {
                  const active = viewAsRole === role || (!viewAsRole && role === "master_admin");
                  const labels: Record<ViewAsRole, string> = { master_admin: "Master Admin", admin: "Admin", umpire: "Umpire", player: "Player" };
                  return (
                    <button
                      key={role}
                      onClick={() => { setViewAsRole(role === "master_admin" ? null : role); setOpen(false); }}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${active ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                    >
                      {labels[role]}
                    </button>
                  );
                })}
              </div>
              {viewAsRole && (
                <p className="text-[10px] text-amber-500 font-bold mt-1.5 text-center">Viewing as {viewAsRole.replace("_", " ")}</p>
              )}
            </div>
          )}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <DropdownMenuItem onSelect={() => setLocation("/profile/password")} className="cursor-pointer font-semibold rounded-none text-slate-700 dark:text-slate-300 focus:bg-slate-50 dark:focus:bg-slate-800 px-3 py-2.5 gap-2.5">
              <Lock className="w-4 h-4 text-slate-400" /> Change Password
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onSelect={() => setLocation("/admin")} className="cursor-pointer font-semibold rounded-none text-violet-600 dark:text-violet-400 focus:bg-violet-50 dark:focus:bg-violet-950/30 gap-2.5 px-3 py-2.5 border-t border-slate-100 dark:border-slate-800">
                <Zap className="h-4 w-4" /> Site Admin
              </DropdownMenuItem>
            )}
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            {savedAccounts.length > 0 && (
              <>
                <div className="px-3 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">Switch Account</div>
                {savedAccounts.map((acc) => (
                  <DropdownMenuItem key={acc.id} className="cursor-pointer font-medium rounded-none focus:bg-slate-50 dark:focus:bg-slate-800 px-3 py-2.5 border-b border-slate-50 dark:border-slate-800/50 last:border-b-0" onClick={async () => { await switchAccount(acc); }}>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{acc.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{acc.email}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800 m-0" />
              </>
            )}
            <DropdownMenuItem onSelect={() => setLocation("/join?add_account=true")} className="cursor-pointer font-semibold rounded-none text-slate-700 dark:text-slate-300 focus:bg-slate-50 dark:focus:bg-slate-800 gap-2.5 px-3 py-2.5">
              <UserPlus className="h-4 w-4 text-slate-400" /> Add Account
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleInvite} className="cursor-pointer font-semibold rounded-none text-slate-700 dark:text-slate-300 focus:bg-slate-50 dark:focus:bg-slate-800 border-t border-slate-100 dark:border-slate-800 gap-2.5 px-3 py-2.5">
              <UserPlus className="h-4 w-4 text-emerald-500" /> Invite Friends
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setLocation("/privacy")} className="cursor-pointer font-semibold rounded-none text-slate-700 dark:text-slate-300 focus:bg-slate-50 dark:focus:bg-slate-800 border-t border-slate-100 dark:border-slate-800 gap-2.5 px-3 py-2.5">
              <Shield className="h-4 w-4 text-slate-400" /> Privacy Policy
            </DropdownMenuItem>
          </div>
          <button onClick={() => handleSignOut("Are you sure you want to sign out of this account?")} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/25 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-bold text-sm border border-rose-100 dark:border-rose-900/50 transition-colors">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
