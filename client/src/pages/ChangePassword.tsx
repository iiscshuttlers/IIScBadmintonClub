import { useState } from "react";
import { Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/usePageMeta";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ChangePassword() {
  usePageMeta({ title: "Change Password" });
  const [, setLocation] = useLocation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const getPasswordStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length > 5) strength += 1;
    if (pwd.length > 7) strength += 1;
    if (/[A-Z]/.test(pwd)) strength += 1;
    if (/[0-9]/.test(pwd)) strength += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) strength += 1;
    return Math.min(strength, 4);
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setSuccess(true);
      toast.success("Password Updated successfully!");
      setTimeout(() => {
        setLocation("/");
      }, 2000);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pt-12 sm:pt-20 pb-12 px-4">
      <div className="max-w-md w-full mx-auto">
        <div className="bg-card rounded-3xl p-6 sm:p-6 shadow-xl shadow-media/20 border border-border">
          <PageHeader
            variant="card"
            backTo="/settings"
            backLabel="Back to settings"
            badge="Security"
            badgeIcon={<Lock className="w-3.5 h-3.5" />}
            title="Change Password"
            subtitle="Create a new, strong password to secure your account."
            align="left"
          />

          {success ? (
            <div className="bg-primary/20 text-primary p-6 rounded-2xl flex flex-col items-center justify-center gap-3 text-center border border-primary/40">
              <CheckCircle2 className="w-10 h-10" />
              <div className="font-bold">Password Updated</div>
              <p className="text-sm opacity-80">Taking you back home...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-soft mb-2 uppercase tracking-wider">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-foreground"
                    placeholder="Min. 6 characters"
                  />
                </div>
                {newPassword && (
                  <div className="mt-3 flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          level <= strength
                            ? strength < 2
                              ? "bg-danger"
                              : strength < 3
                                ? "bg-warning"
                                : "bg-primary"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-soft mb-2 uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-foreground"
                    placeholder="Type password again"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                className="w-full bg-primary hover:bg-primary text-primary-foreground font-bold py-3 rounded-xl transition-all h-auto"
              >
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
