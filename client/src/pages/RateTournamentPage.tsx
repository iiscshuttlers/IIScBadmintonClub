import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePageMeta } from "@/hooks/usePageMeta";
import { FEEDBACK_TAGS } from "@/lib/tournamentFeedback";

// tournament_feedback is new; generated types catch up after `supabase db push`.
const sb = supabase as any;

/** Post-event rating: 1–5 stars, optional "what stood out" tags and a comment. */
export default function RateTournamentPage() {
  const [, params] = useRoute<{ tournamentId: string }>("/rate/:tournamentId");
  const tournamentId = params?.tournamentId ?? "";
  const { profile } = useAuth();
  const me = profile?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["rate", tournamentId, me],
    enabled: !!tournamentId && !!me,
    queryFn: async () => {
      const [{ data: t }, { data: played }, { data: mine }] = await Promise.all([
        supabase.from("tournaments").select("name").eq("id", tournamentId).maybeSingle(),
        sb.rpc("played_in_tournament", { p_tournament: tournamentId, p_uid: me }),
        sb.from("tournament_feedback").select("rating, tags, comment").eq("tournament_id", tournamentId).eq("user_id", me).maybeSingle(),
      ]);
      return { name: (t as any)?.name ?? "this tournament", played: !!played, mine };
    },
  });

  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (data?.mine) {
      setRating(data.mine.rating);
      setTags(data.mine.tags ?? []);
      setComment(data.mine.comment ?? "");
    }
  }, [data?.mine]);

  usePageMeta({ title: "Rate the tournament", description: "Post-event feedback" });

  const submit = async () => {
    if (!rating || !me) return;
    setSaving(true);
    const { error } = await sb.from("tournament_feedback").upsert({
      tournament_id: tournamentId,
      user_id: me,
      rating,
      tags,
      comment: comment.trim() || null,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) toast.error("Couldn't save your rating");
    else setDone(true);
  };

  const toggle = (t: string) => setTags((xs) => (xs.includes(t) ? xs.filter((x) => x !== t) : [...xs, t]));

  return (
    <>
      <PageHeader compact badge="Feedback" badgeIcon={<Star className="w-3.5 h-3.5 text-primary" />} title={`How was ${data?.name ?? "the tournament"}?`} />
      <div className="container mx-auto px-4 py-6 max-w-lg">
        {!me ? (
          <p className="text-sm text-muted-foreground">Sign in to rate this tournament.</p>
        ) : isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" aria-label="Loading" />
        ) : !data?.played ? (
          <p className="text-sm text-muted-foreground">Only players who took part can rate this tournament.</p>
        ) : done ? (
          <div className="text-center space-y-3 py-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-lg font-black">Thanks! Your feedback goes to the organisers.</p>
            <Link href="/">
              <span className="text-primary font-bold cursor-pointer">Back to home</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <fieldset>
              <legend className="text-sm font-black mb-2">Overall</legend>
              <div className="flex gap-2" role="radiogroup" aria-label="Rating out of 5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onClick={() => setRating(n)}
                    className="p-1"
                  >
                    <Star className={`w-9 h-9 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-black mb-2">What went well? <span className="font-normal text-muted-foreground">(optional)</span></legend>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_TAGS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tags.includes(t)}
                    onClick={() => toggle(t)}
                    className={`px-3 py-1.5 rounded-full text-sm font-bold border ${tags.includes(t) ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="text-sm font-black">Anything else? <span className="font-normal text-muted-foreground">(optional)</span></span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 1000))}
                rows={4}
                className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm"
                placeholder="What should the organisers keep or change?"
              />
            </label>
            <button
              type="button"
              onClick={submit}
              disabled={!rating || saving}
              className="w-full rounded-xl bg-primary text-primary-foreground font-black py-3 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {data?.mine ? "Update rating" : "Submit"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
