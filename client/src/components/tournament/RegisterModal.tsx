import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import { EventTypeBadge } from "@/components/tournament/EventTypeBadge";
import { RankedBadge } from "@/components/tournament/RankedBadge";
import type { TournamentThemeInput } from "@/lib/tournamentTheme";
import {
  X, Loader2, CheckCircle2, Clock, XCircle, Trophy, Send, Users2, LogOut,
} from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  MS: "Men's Singles", WS: "Women's Singles",
  MD: "Men's Doubles", WD: "Women's Doubles", XD: "Mixed Doubles",
  BS: "Boys' Singles", GS: "Girls' Singles",
  BD: "Boys' Doubles", GD: "Girls' Doubles",
};

const isDoublesCat = (c: string) => /D$/i.test(c);

interface RegTournament extends TournamentThemeInput {
  id: string;
  name?: string | null;
  categories?: string[] | null;
}

interface RegisterModalProps {
  open: boolean;
  onClose: () => void;
  tournament: RegTournament;
  onRegistered?: () => void;
}

interface ExistingReg {
  id: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  categories: string[];
}

const STATUS_UI: Record<string, { icon: typeof Clock; cls: string; label: string; note: string }> = {
  pending: { icon: Clock, cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900", label: "Pending review", note: "The organisers will review your entry soon." },
  approved: { icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900", label: "You're in!", note: "Your registration has been approved." },
  rejected: { icon: XCircle, cls: "text-rose-600 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900", label: "Not accepted", note: "This entry wasn't accepted. Contact the organisers for details." },
  withdrawn: { icon: XCircle, cls: "text-slate-500 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800", label: "Withdrawn", note: "You withdrew from this event. You can register again." },
};

export function RegisterModal({ open, onClose, tournament, onRegistered }: RegisterModalProps) {
  const { profile } = useAuth();

  const allCats = useMemo(() => (tournament.categories ?? []).filter(Boolean), [tournament.categories]);

  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<ExistingReg | null>(null);
  const [cats, setCats] = useState<string[]>([]);
  const [partners, setPartners] = useState<Record<string, string>>({});
  const [phone, setPhone] = useState("");
  const [txnId, setTxnId] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("tournament_registrations")
      .select("id, status, categories")
      .eq("tournament_id", tournament.id)
      .eq("player_id", profile.id)
      .maybeSingle();
    setExisting((data as any) ?? null);
    setCats(((data as any)?.categories as string[]) ?? []);
    setPhone(((profile as any)?.phone as string) ?? "");
    setLoading(false);
  }, [profile, tournament.id]);

  useEffect(() => {
    if (open) {
      setPartners({});
      setTxnId("");
      setMessage("");
      load();
    }
  }, [open, load]);

  const toggleCat = (c: string) =>
    setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const canEdit = !existing || existing.status === "withdrawn" || existing.status === "rejected";

  const submit = async () => {
    if (!profile?.id) return toast.error("Please sign in to register");
    if (cats.length === 0) return toast.error("Pick at least one category");

    // Compose partner notes as "CAT: name" lines for the doubles categories picked.
    const partnerNote = cats
      .filter(isDoublesCat)
      .map((c) => (partners[c]?.trim() ? `${c}: ${partners[c].trim()}` : null))
      .filter(Boolean)
      .join("; ");

    setSubmitting(true);
    const row = {
      tournament_id: tournament.id,
      player_id: profile.id,
      full_name: profile.full_name ?? "Player",
      email: (profile as any).iisc_email || (profile as any).email || null,
      phone: phone.trim() || null,
      categories: cats,
      partner_names: partnerNote || null,
      transaction_id: txnId.trim() || null,
      message: message.trim() || null,
      status: "pending" as const,
    };
    // Upsert so re-registering after a withdrawal/rejection reuses the unique row.
    const { error } = await supabase
      .from("tournament_registrations")
      .upsert(row as any, { onConflict: "tournament_id,player_id" });
    setSubmitting(false);
    if (error) return toast.error(error.message || "Could not register");
    toast.success("Registration submitted");
    onRegistered?.();
    load();
  };

  const withdraw = async () => {
    if (!existing) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("tournament_registrations")
      .update({ status: "withdrawn" })
      .eq("id", existing.id);
    setSubmitting(false);
    if (error) return toast.error(error.message || "Could not withdraw");
    toast.success("You've withdrawn from this event");
    load();
  };

  if (!open) return null;

  const fieldCls =
    "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40 text-slate-900 dark:text-slate-100";
  const showForm = canEdit;

  return (
    <ThemeScope {...tournament}>
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-black text-slate-800 dark:text-foreground truncate">Register</h3>
              <p className="text-xs text-muted-foreground truncate">{tournament.name ?? "This tournament"}</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <EventTypeBadge tournament_type={tournament.tournament_type} format_family={tournament.format_family} />
              <RankedBadge ranked={tournament.counts_for_elo} />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <>
                {/* Current status banner */}
                {existing && existing.status !== "withdrawn" && (() => {
                  const S = STATUS_UI[existing.status];
                  const Icon = S.icon;
                  return (
                    <div className={`flex items-start gap-2.5 rounded-xl border p-3 ${S.cls}`}>
                      <Icon className="w-5 h-5 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-black">{S.label}</p>
                        <p className="text-xs opacity-90">{S.note}</p>
                        {existing.categories?.length > 0 && (
                          <p className="text-xs mt-1 font-bold">
                            {existing.categories.map((c) => CATEGORY_LABELS[c] ?? c).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {showForm && (
                  <>
                    {/* Categories */}
                    <div className="space-y-2">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Categories {allCats.length === 0 && <span className="normal-case font-medium text-muted-foreground">— none set by organiser</span>}
                      </p>
                      {allCats.length === 0 && (
                        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                          The organiser hasn't published categories for this event yet. Check back soon or contact them to register.
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {allCats.map((c) => {
                          const active = cats.includes(c);
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => toggleCat(c)}
                              className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-colors ${
                                active ? "border-primary bg-primary/10" : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                              }`}
                            >
                              <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 ${active ? "border-primary bg-primary" : "border-slate-300 dark:border-slate-600"}`}>
                                {active && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                              </span>
                              <span className={`text-sm font-black ${active ? "text-primary" : "text-slate-700 dark:text-slate-200"}`}>
                                {CATEGORY_LABELS[c] ?? c}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Partners for doubles categories */}
                    {cats.filter(isDoublesCat).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Users2 className="w-3.5 h-3.5" /> Partners
                        </p>
                        {cats.filter(isDoublesCat).map((c) => (
                          <div key={c} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 w-28 shrink-0">{CATEGORY_LABELS[c] ?? c}</span>
                            <input
                              value={partners[c] ?? ""}
                              onChange={(e) => setPartners((p) => ({ ...p, [c]: e.target.value }))}
                              placeholder="Partner's name"
                              className={fieldCls}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Contact + optional */}
                    <div className="space-y-2">
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className={fieldCls} />
                      <input value={txnId} onChange={(e) => setTxnId(e.target.value)} placeholder="Payment / transaction ID (if applicable)" className={fieldCls} />
                      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Note to organisers (optional)" className={`${fieldCls} resize-none`} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
            {existing && (existing.status === "pending" || existing.status === "approved") && (
              <button
                onClick={withdraw}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" /> Withdraw
              </button>
            )}
            {showForm && (
              <button
                onClick={submit}
                disabled={submitting || loading || cats.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-black transition disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {existing && existing.status !== "withdrawn" ? "Update entry" : "Submit"}
              </button>
            )}
          </div>
        </div>
      </div>
    </ThemeScope>
  );
}
