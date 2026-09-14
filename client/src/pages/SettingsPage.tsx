import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationAuth } from "@/hooks/useNavigationAuth";
import { useAppMode } from "@/contexts/AppModeContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  Bell,
  Lock,
  Trash2,
  Settings as SettingsIcon,
  UserPlus,
  Shield,
  Zap,
  LogOut,
  ChevronRight,
  BellRing
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { NotificationSettingsModal } from "@/components/profile/NotificationSettingsModal";

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { profile, isMasterAdmin, viewAsRole, setViewAsRole, signOut } = useAuth();
  const { savedAccounts, switchAccount } = useNavigationAuth();
  const { setMode } = useAppMode();
  const [signOutDialog, setSignOutDialog] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setSignOutDialog(false);
    setLocation("/");
  };

  const handleInvite = async () => {
    const inviteText = "Join me on IISc Badminton Club! The ultimate platform for badminton tracking.";
    const inviteUrl = "https://iiscshuttlers.github.io/IIScBadmintonClub/join";
    
    if (Capacitor.isNativePlatform()) {
      await Share.share({
        title: "Join IISc Badminton Club",
        text: inviteText,
        url: inviteUrl,
        dialogTitle: "Invite Friends",
      });
    } else if (navigator.share) {
      await navigator.share({
        title: "Join IISc Badminton Club",
        text: inviteText,
        url: inviteUrl,
      });
    } else {
      await navigator.clipboard.writeText(`${inviteText} ${inviteUrl}`);
      toast.success("Invite link copied to clipboard!");
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
      icon: Bell,
      label: "My Subscriptions",
      description: "Manage match and player alerts",
      href: "/profile/subscriptions",
    },
    {
      icon: BellRing,
      label: "Notification Settings",
      description: "Manage push notifications",
      onClick: () => setIsNotificationModalOpen(true),
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

  const adminItems = [
    {
      icon: Zap,
      label: "Site Admin",
      description: "Access the master admin dashboard",
      href: "/admin",
      adminIcon: true,
    }
  ];

  const appItems = [
    {
      icon: ArrowLeft,
      label: "Switch to Club Mode",
      description: "Return to the main club dashboard",
      onClick: () => {
        setMode("club");
        setLocation("/");
      },
      primaryIcon: true,
    },
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
    {
      icon: Shield,
      label: "Privacy Policy",
      description: "Read our privacy policy",
      href: "/privacy",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 pt-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <SettingsIcon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">Account & Profile</h2>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              {profileItems.map((item) => {
                const content = (
                  <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                    <div className="flex-shrink-0">
                      <item.icon className={cn("w-5 h-5", item.danger ? "text-rose-500" : "text-muted-foreground group-hover:text-primary")} />
                    </div>
                    <div className="flex-1">
                      <h3 className={cn("text-sm font-semibold text-left", item.danger ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
                        {item.label}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 text-left">{item.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700" />
                  </div>
                );

                return item.href ? (
                  <Link key={item.label} href={item.href}>{content}</Link>
                ) : (
                  <button key={item.label} onClick={item.onClick} className="w-full text-left">{content}</button>
                );
              })}
            </div>
          </section>

          {/* View As Role */}
          {isMasterAdmin && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">Developer Mode</h2>
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-2">
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => setViewAsRole(null)} className={cn("flex-1 min-w-[70px] text-xs font-bold py-2.5 rounded-xl transition-all", !viewAsRole ? "bg-slate-100 dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800/50")}>Master</button>
                  <button onClick={() => setViewAsRole('admin')} className={cn("flex-1 min-w-[70px] text-xs font-bold py-2.5 rounded-xl transition-all", viewAsRole === 'admin' ? "bg-slate-100 dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800/50")}>Admin</button>
                  <button onClick={() => setViewAsRole('umpire')} className={cn("flex-1 min-w-[70px] text-xs font-bold py-2.5 rounded-xl transition-all", viewAsRole === 'umpire' ? "bg-slate-100 dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800/50")}>Umpire</button>
                  <button onClick={() => setViewAsRole('player')} className={cn("flex-1 min-w-[70px] text-xs font-bold py-2.5 rounded-xl transition-all", viewAsRole === 'player' ? "bg-slate-100 dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800/50")}>User</button>
                </div>
              </div>
            </section>
          )}

          {/* Admin Items */}
          {isMasterAdmin && (
            <section>
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {adminItems.map((item) => (
                  <Link key={item.label} href={item.href || "#"}>
                    <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                      <div className="flex-shrink-0">
                        <item.icon className="w-5 h-5 text-violet-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                          {item.label}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Switch Accounts */}
          {savedAccounts.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">Switch Account</h2>
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {savedAccounts.map((acc) => (
                  <button 
                    key={acc.id} 
                    onClick={async () => { await switchAccount(acc); }}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <div>
                      <div className="text-sm font-bold text-foreground">{acc.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{acc.email}</div>
                    </div>
                    {acc.id === profile?.id && (
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* App / Other */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">App</h2>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              {appItems.map((item) => {
                const content = (
                  <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                    <div className="flex-shrink-0">
                      <item.icon className={cn("w-5 h-5", item.primaryIcon ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-sm font-semibold text-foreground">{item.label}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700" />
                  </div>
                );

                return item.href ? (
                  <Link key={item.label} href={item.href}>{content}</Link>
                ) : (
                  <button key={item.label} onClick={item.onClick} className="w-full text-left">{content}</button>
                );
              })}
            </div>
          </section>

          {/* Sign Out Button */}
          <div className="pt-4">
            <Button
              onClick={() => setSignOutDialog(true)}
              variant="outline"
              className="w-full flex items-center justify-center gap-2 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 py-6 rounded-2xl transition-colors font-bold shadow-sm"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={signOutDialog}
        title="Sign Out"
        description="Are you sure you want to sign out of your account?"
        confirmLabel="Sign Out"
        confirmVariant="danger"
        onConfirm={handleSignOut}
        onCancel={() => setSignOutDialog(false)}
      />
      
      <NotificationSettingsModal
        open={isNotificationModalOpen}
        onOpenChange={setIsNotificationModalOpen}
      />
    </div>
  );
}
