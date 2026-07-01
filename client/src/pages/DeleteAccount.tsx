import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { toast } from "sonner";
import { Trash2, AlertTriangle, ShieldCheck, Loader2, LogOut } from "lucide-react";

const CONSEQUENCES = [
  "Your player profile and match history will be permanently deleted",
  "Your ELO rating and all statistics will be erased",
  "Your login account will be deactivated",
  "Any Find & Lost posts you created will be removed",
  "This action cannot be undone",
];

export default function DeleteAccount() {
  usePageMeta({ title: "Delete Account", description: "Permanently delete your IISc Badminton Club account" });
  const { session, profile } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"confirm" | "final" | "done">("confirm");
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-200 dark:border-slate-800">
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7 text-rose-600 dark:text-rose-400" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Delete Your Account</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              To delete your account through the app, please sign in first.
            </p>
            <button onClick={() => navigate("/join")} className="w-full px-5 py-3 bg-primary hover:bg-primary text-white font-bold rounded-xl transition">
              Sign In to Delete
            </button>
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                Can't sign in? You can also request account deletion by emailing us:
              </p>
              <a
                href="mailto:iiscbadmintonclub@gmail.com?subject=Account%20Deletion%20Request&body=Please%20delete%20my%20account.%20My%20registered%20email%20is%3A%20"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Email: iiscbadmintonclub@gmail.com
              </a>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                Include your registered email address. We will process your request within 7 business days.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    if (confirmText.trim().toLowerCase() !== "delete my account") {
      toast.error('Please type "delete my account" exactly to confirm.');
      return;
    }
    setLoading(true);
    try {
      // 1. Log the deletion request
      await supabase.from("admin_logs").insert({
        admin_email: session.user.email ?? "unknown",
        action: "user_self_deletion",
        details: reason ? `Reason: ${reason}` : "No reason given",
      });

      // 2. Delete player profile (cascade deletes matches, find_lost_posts via FK)
      if (profile?.id) {
        await supabase.from("players").delete().eq("id", profile.id);
      }

      // 3. Remove push tokens
      await supabase.from("user_push_tokens").delete().eq("user_id", session.user.id);

      // 4. Hard-delete the auth.users record via the admin edge function
      // This satisfies Google Play's requirement for complete account deletion.
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.access_token) {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentSession.access_token}`,
          },
          body: JSON.stringify({ userId: session.user.id }),
        }).catch(() => {
          // Auth deletion may fail if the user is already partially deleted;
          // the profile is gone so we still proceed to sign out.
        });
      }

      // 5. Sign out locally
      await supabase.auth.signOut();

      setStep("done");
    } catch (err: any) {
      toast.error("Deletion failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full text-center shadow-xl border border-slate-200 dark:border-slate-800">
          <div className="w-14 h-14 rounded-full bg-primary/15 dark:bg-primary/40 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-primary dark:text-primary" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">Account Deleted</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Your data has been removed. We're sorry to see you go.
          </p>
          <button onClick={() => navigate("/")} className="w-full py-3 rounded-xl bg-primary hover:bg-primary text-white font-bold transition">
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-8">
      <div className="container mx-auto px-4 max-w-xl py-12">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-rose-50 dark:bg-rose-950/20 border-b border-rose-100 dark:border-rose-900/40 px-6 py-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-slate-900 dark:text-white">Delete My Account</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{session.user.email}</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {step === "confirm" && (
              <>
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-2">This will permanently delete:</p>
                    <ul className="space-y-1">
                      {CONSEQUENCES.map((c, i) => (
                        <li key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5">•</span>{c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Reason for leaving (optional)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="We'd love to know how we can improve..."
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button onClick={() => window.history.back()}
                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                    Cancel
                  </button>
                  <button onClick={() => setStep("final")}
                    className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition shadow-md shadow-rose-500/20">
                    Continue
                  </button>
                </div>
              </>
            )}

            {step === "final" && (
              <>
                <div className="text-center space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Type <strong className="font-black text-rose-600">delete my account</strong> to confirm permanent deletion.
                  </p>
                </div>

                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="delete my account"
                  className="w-full px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 text-sm font-bold text-rose-800 dark:text-rose-300 outline-none focus:ring-2 focus:ring-rose-500 placeholder:font-normal placeholder:text-rose-300 dark:placeholder:text-rose-700"
                />

                <div className="flex gap-3">
                  <button onClick={() => setStep("confirm")} disabled={loading}
                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50">
                    Back
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={loading || confirmText.trim().toLowerCase() !== "delete my account"}
                    className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-sm transition flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {loading ? "Deleting…" : "Delete Forever"}
                  </button>
                </div>
              </>
            )}

            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              If you just need a break, consider{" "}
              <button onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}
                className="text-primary dark:text-primary font-bold hover:underline inline-flex items-center gap-1">
                <LogOut className="w-3 h-3" /> signing out
              </button>{" "}
              instead.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
