import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { deleteAccount } from "@/services/playerService";
import { disableBiometricLogin } from "@/lib/biometricAuth";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useGoBack } from "@/hooks/useGoBack";
import { toast } from "sonner";
import { Trash2, AlertTriangle, ShieldCheck, Loader2, LogOut } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";

const CONSEQUENCES = [
  "Your player profile and match history will be permanently deleted",
  "Your ELO rating and all statistics will be erased",
  "Your login account will be deactivated",
  "Any Find & Lost posts you created will be removed",
  "This action cannot be undone",
];

export default function DeleteAccount() {
  usePageMeta({ title: "Delete Account", description: "Permanently delete your IISc Badminton Club account" });
  const { session, profile, signOut } = useAuth();
  const [, navigate] = useLocation();
  const goBack = useGoBack("/settings");
  const [step, setStep] = useState<"confirm" | "final" | "done">("confirm");
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card rounded-3xl p-6 max-w-md w-full shadow-xl border border-border">
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-danger/15 flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7 text-danger" />
            </div>
            <h2 className="text-xl font-black text-foreground">Delete Your Account</h2>
            <p className="text-sm text-muted-foreground">
              To delete your account through the app, please sign in first.
            </p>
            <Button onClick={() => navigate("/join")} className="w-full py-6 font-bold text-base">
              Sign In to Delete
            </Button>
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">
                Can't sign in? You can also request account deletion by emailing us:
              </p>
              <a
                href="mailto:iiscbadmintonclub@gmail.com?subject=Account%20Deletion%20Request&body=Please%20delete%20my%20account.%20My%20registered%20email%20is%3A%20"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted text-soft text-sm font-bold hover:bg-muted-strong transition"
              >
                <AlertTriangle className="w-4 h-4 text-warning" />
                Email: iiscbadmintonclub@gmail.com
              </a>
              <p className="text-[10px] text-muted-foreground mt-2">
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
      await deleteAccount({
        userId: session.user.id,
        profileId: profile?.id,
        userEmail: session.user.email,
        reason,
      });

      // 5. Sign out locally
      await disableBiometricLogin();
      await signOut();

      setStep("done");
    } catch (err: any) {
      toast.error("Deletion failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card rounded-3xl p-6 max-w-sm w-full text-center shadow-xl border border-border">
          <div className="w-14 h-14 rounded-full bg-primary/40 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-black text-foreground mb-2">Account Deleted</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Your data has been removed. We're sorry to see you go.
          </p>
          <Button onClick={() => navigate("/")} className="w-full py-6 font-bold text-base">
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      <div className="container mx-auto px-4 max-w-xl py-12">
        <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
          <PageHeader
            variant="card"
            backTo="/settings"
            badge="Irreversible"
            badgeIcon={<Trash2 className="w-3.5 h-3.5 text-danger" />}
            title="Delete My Account"
            subtitle={session.user.email}
            align="left"
            className="px-6 pt-5 pb-3 border-b border-danger/25"
          />

          <div className="p-6 space-y-6">
            {step === "confirm" && (
              <>
                <div className="bg-warning/10 border border-warning/25 rounded-2xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-warning mb-2">This will permanently delete:</p>
                    <ul className="space-y-1">
                      {CONSEQUENCES.map((c, i) => (
                        <li key={i} className="text-xs text-warning flex items-start gap-1.5">
                          <span className="text-warning mt-0.5">•</span>{c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Reason for leaving (optional)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="We'd love to know how we can improve..."
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-3 rounded-xl border border-border-strong bg-muted text-sm text-foreground outline-none focus:ring-2 focus:ring-danger resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goBack}
                    className="flex-1 py-3"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setStep("final")}
                    className="flex-1 py-3"
                  >
                    Continue
                  </Button>
                </div>
              </>
            )}

            {step === "final" && (
              <>
                <div className="text-center space-y-2">
                  <p className="text-sm text-soft">
                    Type <strong className="font-black text-danger">delete my account</strong> to confirm permanent deletion.
                  </p>
                </div>

                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="delete my account"
                  className="w-full px-4 py-3 rounded-xl border border-danger/25 bg-danger/10 text-sm font-bold text-danger outline-none focus:ring-2 focus:ring-danger placeholder:font-normal placeholder:text-danger"
                />

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep("confirm")}
                    disabled={loading}
                    className="flex-1 py-3"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={loading || confirmText.trim().toLowerCase() !== "delete my account"}
                    className="flex-1 py-3 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {loading ? "Deleting…" : "Delete Forever"}
                  </Button>
                </div>
              </>
            )}

            <p className="text-center text-xs text-muted-foreground">
              If you just need a break, consider{" "}
              <button onClick={async () => { await disableBiometricLogin(); await signOut(); navigate("/"); }}
                className="text-primary font-bold hover:underline inline-flex items-center gap-1">
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
