import { useState } from "react";
import { Link, useLocation } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationAuth } from "@/hooks/useNavigationAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useAppMode } from "@/contexts/AppModeContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  User,
  Lock,
  Settings,
  Shield,
  Trash2,
  LogOut,
  UserPlus,
  Zap,
  Sun,
  Moon,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  X as CloseIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = [
  { id: "looking", short: "Available", dot: "bg-primary", active: "bg-primary/20 text-primary dark:text-primary/70 ring-1 ring-primary/40" },
  { id: "playing", short: "Playing", dot: "bg-amber-400", active: "bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/40" },
  { id: "resting", short: "Resting", dot: "bg-indigo-400", active: "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-400/40" },
  { id: "injured", short: "Injured", dot: "bg-rose-400", active: "bg-rose-500/20 text-rose-700 dark:text-rose-300 ring-1 ring-rose-400/40" },
] as const;

export default function PersonalProfilePage() {
  usePageMeta({
    title: "Profile",
    description: "Manage your profile and account settings.",
  });

  const { profile, session, refreshProfile, signOut, isMasterAdmin, viewAsRole, setViewAsRole } = useAuth();
  const {
    isAdmin,
    savedAccounts,
    switchAccount,
  } = useNavigationAuth();
  
  const handleInvite = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "IISc Shuttlers",
        text: "Join the IISc Shuttlers community!",
        url: window.location.origin,
      });
    } else {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success("Link copied to clipboard!");
    }
  };
  
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"profile" | "settings">("profile");
  
  // Avatar Zoom State
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const { theme, toggleTheme } = useTheme();
  const { setMode } = useAppMode();
  const [signOutDialog, setSignOutDialog] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  const currentStatus = (profile as any)?.status || "looking";

  const updateStatus = async (newStatus: string) => {
    if (!profile?.id || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const { error } = await supabase.from("players").update({ status: newStatus }).eq("id", profile.id);
      if (error) throw error;
      if (newStatus === "playing" && session?.user?.id) {
        const now = new Date();
        await supabase.from("court_visits").insert({ user_id: session.user.id, visited_at: now.toISOString(), day_of_week: now.getDay(), hour: now.getHours() });
      }
      
      // Notify buddies
      if (newStatus === "playing" || newStatus === "looking") {
        supabase.functions.invoke("notify-social", {
          body: {
            type: "status_update",
            from_player_id: profile.id,
            from_name: profile.full_name || "A buddy",
            new_status: newStatus,
          },
        }).catch((err) => console.error("Failed to notify buddies of status update:", err));
      }

      await refreshProfile();
      toast.success("Status updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const profileItems = [
    {
      icon: User,
      label: "Edit Profile",
      description: "Update your name, avatar, and bio",
      href: "/profile/setup",
    },
    {
      icon: Lock,
      label: "Change Password",
      description: "Update your account password",
      href: "/profile/password",
    },
    {
      icon: Trash2,
      label: "Delete Account",
      description: "Permanently delete your account",
      href: "/delete-account",
      danger: true,
    },
  ];

  const settingsItems = [
    {
      icon: UserPlus,
      label: "Add Account",
      description: "Log in to an additional account",
      href: "/join?add_account=true",
    },
    {
      icon: UserPlus,
      label: "Invite Friends",
      description: "Share the app with others",
      onClick: handleInvite,
      primaryIcon: true,
    },
    ...(isAdmin ? [{
      icon: Zap,
      label: "Site Admin",
      description: "Access the master admin dashboard",
      href: "/admin",
      adminIcon: true,
    }] : []),
    {
      icon: Shield,
      label: "Privacy Policy",
      description: "Read our privacy policy",
      href: "/privacy",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Profile Header */}
      <div className="mb-6 flex items-center gap-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <button 
          onClick={() => {
            setZoomLevel(1);
            setIsAvatarModalOpen(true);
          }}
          className="relative rounded-full overflow-hidden focus:outline-none focus:ring-4 focus:ring-primary/20 transition-transform active:scale-95"
        >
          <Avatar src={profile?.avatar_url} name={profile?.full_name} size="lg" />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
            <ZoomIn className="w-5 h-5 text-white drop-shadow-md" />
          </div>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground dark:text-foreground truncate">
            {profile?.full_name || "Your Profile"}
          </h1>
          <p className="text-muted-foreground dark:text-muted-foreground truncate">
            {profile?.email || ""}
          </p>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
            Member since{" "}
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString()
              : "recently"}
          </p>
        </div>
      </div>

      {/* Tabs Toggle */}
      <div className="flex p-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-xl">
        <button
          onClick={() => setActiveTab("profile")}
          className={cn(
            "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
            activeTab === "profile" 
              ? "bg-white dark:bg-slate-700 text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={cn(
            "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
            activeTab === "settings" 
              ? "bg-white dark:bg-slate-700 text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Settings
        </button>
      </div>

      {activeTab === "profile" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Appearance Toggle */}
          <div className="mb-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-500" /> Appearance
            </h3>
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1 flex gap-1">
              <button onClick={() => { if (theme === "dark") toggleTheme?.(); }} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all", theme === "light" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-foreground shadow-sm" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300")}>
                <Sun className="w-4 h-4" /> Light
              </button>
              <button onClick={() => { if (theme === "light") toggleTheme?.(); }} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all", theme === "dark" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-foreground shadow-sm" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300")}>
                <Moon className="w-4 h-4" /> Dark
              </button>
            </div>
          </div>

          <div className="space-y-2 mb-8">
            {profileItems.map((item) => {
              const Icon = item.icon;
              const content = (
                <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer group">
                  <div className="flex-shrink-0">
                    <Icon className={cn("w-5 h-5", item.danger ? "text-rose-500" : "text-muted-foreground group-hover:text-primary")} />
                  </div>
                  <div className="flex-1">
                    <h3 className={cn("font-semibold", item.danger ? "text-rose-600 dark:text-rose-400" : "text-foreground dark:text-foreground")}>
                      {item.label}
                    </h3>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>
              );

              return item.href ? (
                <Link key={item.label} href={item.href}>{content}</Link>
              ) : (
                <button key={item.label} onClick={(item as any).onClick} className="w-full text-left">{content}</button>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* View As Role */}
          {isMasterAdmin && (
            <div className="mb-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">View As Role</h3>
              </div>
              <div className="p-3">
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                  <button onClick={() => setViewAsRole(null)} className={cn("flex-1 text-[11px] font-bold py-2 rounded-lg transition-all", !viewAsRole ? "bg-white dark:bg-slate-700 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>Master</button>
                  <button onClick={() => setViewAsRole('admin')} className={cn("flex-1 text-[11px] font-bold py-2 rounded-lg transition-all", viewAsRole === 'admin' ? "bg-white dark:bg-slate-700 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>Admin</button>
                  <button onClick={() => setViewAsRole('umpire')} className={cn("flex-1 text-[11px] font-bold py-2 rounded-lg transition-all", viewAsRole === 'umpire' ? "bg-white dark:bg-slate-700 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>Umpire</button>
                  <button onClick={() => setViewAsRole('player')} className={cn("flex-1 text-[11px] font-bold py-2 rounded-lg transition-all", viewAsRole === 'player' ? "bg-white dark:bg-slate-700 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>User</button>
                </div>
              </div>
            </div>
          )}
          {/* Switch Accounts section */}
          {savedAccounts.length > 0 && (
            <div className="mb-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Switch Account</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {savedAccounts.map((acc) => (
                  <button 
                    key={acc.id} 
                    onClick={async () => { await switchAccount(acc); }}
                    className="w-full flex flex-col items-start px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <span className="text-sm font-bold text-foreground">{acc.name}</span>
                    <span className="text-xs text-muted-foreground">{acc.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 mb-8">
            {settingsItems.map((item) => {
              const Icon = item.icon;
              const content = (
                <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer group">
                  <div className="flex-shrink-0">
                    <Icon className={cn("w-5 h-5", item.primaryIcon ? "text-primary" : item.adminIcon ? "text-violet-500" : "text-muted-foreground group-hover:text-primary")} />
                  </div>
                  <div className="flex-1">
                    <h3 className={cn("font-semibold text-foreground dark:text-foreground", item.adminIcon && "text-violet-600 dark:text-violet-400")}>
                      {item.label}
                    </h3>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>
              );

              return item.href ? (
                <Link key={item.label} href={item.href}>{content}</Link>
              ) : (
                <button key={item.label} onClick={(item as any).onClick} className="w-full text-left">{content}</button>
              );
            })}
          </div>

          {/* Sign Out Button */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-6 mb-6">
            <Button
              onClick={() => setSignOutDialog(true)}
              variant="outline"
              className="w-full flex items-center justify-center gap-2 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:text-rose-700 py-6 rounded-xl transition-colors font-bold"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </Button>
          </div>
        </div>
      )}

      {/* Sign Out Confirmation */}
      <ConfirmDialog
        open={signOutDialog}
        title="Sign Out"
        description="Are you sure you want to sign out of your account?"
        confirmLabel="Sign Out"
        confirmVariant="danger"
        onConfirm={handleSignOut}
        onCancel={() => setSignOutDialog(false)}
      />

      <Dialog open={isAvatarModalOpen} onOpenChange={setIsAvatarModalOpen}>
        <DialogContent className="max-w-md w-[90vw] p-0 overflow-hidden bg-black/95 border-slate-800 sm:rounded-2xl rounded-2xl flex flex-col h-[70vh] sm:h-[80vh]">
          {/* Header Controls */}
          <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex gap-2">
              <button 
                onClick={() => setZoomLevel(s => Math.min(s + 0.5, 4))}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors active:scale-95"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setZoomLevel(s => Math.max(s - 0.5, 1))}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors active:scale-95"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
            </div>
            <button 
              onClick={() => setIsAvatarModalOpen(false)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors active:scale-95"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
          
          {/* Zoomable Image Container */}
          <div className="flex-1 w-full h-full flex items-center justify-center overflow-auto touch-pan-x touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="min-w-full min-h-full flex items-center justify-center p-4">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.full_name || "Avatar"} 
                  className="max-w-full max-h-full object-contain rounded-lg transition-transform duration-200 origin-center"
                  style={{ transform: `scale(${zoomLevel})` }}
                />
              ) : (
                <div 
                  className="w-48 h-48 sm:w-64 sm:h-64 rounded-full bg-gradient-to-br from-primary to-teal-500 flex items-center justify-center text-white font-bold text-6xl shadow-xl transition-transform duration-200"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  {(profile?.full_name || "U")[0]?.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
