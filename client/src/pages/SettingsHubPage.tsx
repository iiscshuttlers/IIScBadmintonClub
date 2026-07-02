import { useState } from "react";
import { Link, useLocation } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import {
  User,
  Lock,
  Settings,
  Shield,
  Trash2,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PreferencesModal } from "@/components/QuickSettings";

export default function SettingsHubPage() {
  usePageMeta({
    title: "Settings",
    description: "Manage your profile, password, and account preferences.",
  });

  const { signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [signOutDialog, setSignOutDialog] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  const settingsItems = [
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
      icon: Settings,
      label: "App Preferences",
      description: "Configure app settings and notifications",
      onClick: () => setIsPreferencesOpen(true),
    },
    {
      icon: Shield,
      label: "Privacy Policy",
      description: "Read our privacy policy",
      href: "/privacy",
    },
    {
      icon: Trash2,
      label: "Delete Account",
      description: "Permanently delete your account",
      href: "/delete-account",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground dark:text-foreground">Settings</h1>
        <p className="text-muted-foreground dark:text-muted-foreground mt-2">
          Manage your account and preferences
        </p>
      </div>

      {/* Settings Items */}
      <div className="space-y-2 mb-8">
        {settingsItems.map((item) => {
          const Icon = item.icon;
          const content = (
            <div className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer">
              <div className="flex-shrink-0">
                <Icon className="w-6 h-6 text-primary dark:text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground dark:text-foreground">
                  {item.label}
                </h3>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                  {item.description}
                </p>
              </div>
            </div>
          );

          if (item.href) {
            return (
              <Link key={item.label} href={item.href}>
                {content}
              </Link>
            );
          } else if (item.onClick) {
            return (
              <button key={item.label} onClick={item.onClick} className="w-full text-left">
                {content}
              </button>
            );
          }
        })}
      </div>

      {/* Sign Out Button */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
        <Button
          onClick={() => setSignOutDialog(true)}
          className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-foreground font-semibold py-3 rounded-xl transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </Button>
      </div>

      {/* Preferences Modal */}
      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />

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
    </div>
  );
}
