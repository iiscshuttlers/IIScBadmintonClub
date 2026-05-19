import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ShieldCheck, ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export default function Join() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email"); // "email" or "otp"

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.endsWith("@iisc.ac.in") && !email.endsWith("@gmail.com")) {
      alert("Access Denied! During testing, please use an @iisc.ac.in or @gmail.com email.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true, // Auto-registers new players!
          emailRedirectTo: `${window.location.origin}/iiscshuttlers/profile/setup`,
        },
      });

      if (error) throw error;
      setStep("otp");
    } catch (err: any) {
      console.error("Failed to send OTP:", err);
      alert("Failed to send login code. " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error, data } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });

      if (error) throw error;

      // Successfully logged in! Check if they already have a profile
      if (data.session) {
        const { data: profile } = await supabase
          .from("players")
          .select("id")
          .eq("user_id", data.session.user.id)
          .single();

        if (profile) {
          // Already registered, go to profile!
          setLocation(`/player/${profile.id}`);
        } else {
          // New player, complete the setup!
          setLocation("/profile/setup");
        }
      }
    } catch (err: any) {
      console.error("Failed to verify OTP:", err);
      alert("Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        
        {/* Header Icon & Text */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            IISc Badminton Club
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Secure sign-in for the IISc Shuttlers community.
          </p>
        </div>

        {/* Dynamic Multi-Step Form */}
        <div className="bg-white dark:bg-slate-900 py-8 px-6 shadow-xl shadow-slate-200/50 dark:shadow-none sm:rounded-3xl sm:px-10 border border-slate-100 dark:border-slate-800">
          <AnimatePresence mode="wait">
            {step === "email" ? (
              
              // STEP 1: Email Input
              <motion.div
                key="email-step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <form onSubmit={handleSendOtp} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      IISc Institutional Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 h-5 text-slate-400" />
                      </div>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="yourname@iisc.ac.in"
                        className="block w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full py-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-base flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      <>
                        Get Secure Login Code
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </Button>
                </form>
              </motion.div>
            ) : (
              
              // STEP 2: OTP Verification
              <motion.div
                key="otp-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Enter the 6-digit Code
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      We sent a secure validation code to <strong className="text-slate-700 dark:text-slate-300">{email}</strong>.
                    </p>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <KeyRound className="h-5 h-5 text-slate-400" />
                      </div>
                      <input
                        required
                        type="text"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="123456"
                        className="block w-full pl-10 pr-4 py-3 tracking-widest text-center text-lg font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full py-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-base flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      ) : (
                        "Verify & Log In"
                      )}
                    </Button>

                    <button
                      type="button"
                      onClick={() => setStep("email")}
                      className="w-full text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline py-2"
                    >
                      Change email address
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 text-center border-t border-slate-100 dark:border-slate-800 pt-6">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              * Fully restricted to official `@iisc.ac.in` domain accounts.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
