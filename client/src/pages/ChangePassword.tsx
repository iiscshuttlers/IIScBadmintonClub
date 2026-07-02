import { useState } from "react";
import { Lock, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/usePageMeta";

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col pt-12 sm:pt-20 pb-12 px-4">
      <div className="max-w-md w-full mx-auto">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to home
        </button>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-6 shadow-xl shadow-slate-200/50 dark:shadow-black/20 border border-slate-100 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 dark:bg-primary/30 flex items-center justify-center mb-6">
            <Lock className="w-6 h-6 text-primary dark:text-primary" />
          </div>
          
          <h1 className="text-2xl font-black text-foreground dark:text-foreground mb-2">
            Change Password
          </h1>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-8">
            Create a new, strong password to secure your account.
          </p>

          {success ? (
            <div className="bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary p-6 rounded-2xl flex flex-col items-center justify-center gap-3 text-center border border-primary/30 dark:border-primary/80/30">
              <CheckCircle2 className="w-10 h-10" />
              <div className="font-bold">Password Updated</div>
              <p className="text-sm opacity-80">Taking you back home...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-muted-foreground dark:text-slate-300 mb-2 uppercase tracking-wider">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-foreground dark:text-foreground"
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
                              ? "bg-rose-500"
                              : strength < 3
                                ? "bg-amber-500"
                                : "bg-primary"
                            : "bg-slate-200 dark:bg-slate-800"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground dark:text-slate-300 mb-2 uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-foreground dark:text-foreground"
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
