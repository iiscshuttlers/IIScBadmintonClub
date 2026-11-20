import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDecidedMatchViews } from "@/hooks/queries/useMatchViews";
import { useTournamentStory } from "@/hooks/queries/useTournamentStory";
import { matchPath } from "@/lib/tournamentRoutes";
import {
  STORY_EDITORIAL_NOTE_MAX,
  buildPublishedStoryRecord,
  buildTournamentStoryDraft,
  publicStoryView,
  type FactualStoryItem,
  type TournamentStoryDraft,
} from "@/lib/tournamentStory";

const TYPE_LABEL: Record<FactualStoryItem["type"], string> = {
  champions: "Champion",
  upset: "Seed upset",
  thriller: "Close decider",
  day_summary: "Day summary",
};

/**
 * Factual tournament story (WC-08). Public visitors see only the published
 * story, with every item re-checked against current results; admins also get
 * a review editor. Nothing is shown when no story is published.
 */
export function TournamentStoryPanel({ tournamentId, tournamentName }: { tournamentId: string; tournamentName: string }) {
  const { isAdmin } = useAuth();
  const story = useTournamentStory(tournamentId);
  const decided = useDecidedMatchViews(tournamentId);
  const draft = useMemo(
    () => buildTournamentStoryDraft({ id: tournamentId, name: tournamentName }, decided.views),
    [tournamentId, tournamentName, decided.views],
  );

  const factsReady = decided.status === "ready";
  const view = story.record && factsReady ? publicStoryView(story.record, draft) : null;
  const hasPublic = !!view && (view.visible.length > 0 || view.withheldItemIds.length > 0);

  if (!hasPublic && !isAdmin) return null;

  return (
    <section
      aria-labelledby="tournament-story-heading"
      className="mb-6 bg-card rounded-3xl border border-border shadow-sm p-4 sm:p-6 space-y-4"
    >
      <h2 id="tournament-story-heading" className="flex items-center gap-2 text-lg font-black text-foreground">
        <BookOpen className="w-5 h-5 text-primary" aria-hidden /> Tournament story
      </h2>

      {story.record && !factsReady && (
        <p className="text-sm text-muted-foreground">
          {decided.status === "loading" ? "Checking the story against current results…" : "The story is hidden because current results could not be checked."}
        </p>
      )}

      {view && story.record && <PublishedStory record={story.record} view={view} tournamentId={tournamentId} />}

      {!story.record && isAdmin && (
        <p className="text-sm text-muted-foreground">No story is published. Only you (an admin) can see this section.</p>
      )}

      {isAdmin && (
        <StoryEditor
          draft={draft}
          factsStatus={decided.status}
          story={story}
          tournamentId={tournamentId}
        />
      )}
    </section>
  );
}

function PublishedStory({
  record,
  view,
  tournamentId,
}: {
  record: NonNullable<ReturnType<typeof useTournamentStory>["record"]>;
  view: ReturnType<typeof publicStoryView>;
  tournamentId: string;
}) {
  const published = new Date(record.publishedAt);
  return (
    <div className="space-y-4">
      {record.editorialNote && (
        <figure className="rounded-2xl bg-muted/60 p-4">
          <figcaption className="text-xs font-black uppercase tracking-wide text-muted-foreground mb-1">
            From the organisers
          </figcaption>
          <p className="text-sm text-soft whitespace-pre-line">{record.editorialNote}</p>
        </figure>
      )}
      <ul className="space-y-3">
        {view.visible.map((item) => (
          <StoryItem key={item.id} item={item} tournamentId={tournamentId} />
        ))}
      </ul>
      {view.withheldItemIds.length > 0 && (
        <p role="status" className="text-sm text-warning">
          {view.withheldItemIds.length === 1 ? "1 item is" : `${view.withheldItemIds.length} items are`} hidden because a
          supporting result changed after publication and is awaiting review.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Facts computed from published results ·{" "}
        {Number.isNaN(published.getTime())
          ? "publication date unknown"
          : `published ${published.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
      </p>
    </div>
  );
}

function StoryItem({ item, tournamentId }: { item: FactualStoryItem; tournamentId: string }) {
  return (
    <li className="rounded-2xl border border-border p-4">
      <p className="text-xs font-black uppercase tracking-wide text-primary">
        {TYPE_LABEL[item.type]}
        {item.discipline ? ` · ${item.discipline}` : ""}
      </p>
      <p className="mt-1 font-black text-foreground break-words">{item.headline}</p>
      <p className="mt-1 text-sm text-soft break-words">{item.body}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {item.supportingMatchIds.map((matchId) => (
          <Link key={matchId} href={matchPath(tournamentId, matchId)} className="text-sm font-bold text-primary hover:underline">
            View match
          </Link>
        ))}
      </div>
    </li>
  );
}

function StoryEditor({
  draft,
  factsStatus,
  story,
  tournamentId,
}: {
  draft: TournamentStoryDraft;
  factsStatus: "loading" | "ready" | "error";
  story: ReturnType<typeof useTournamentStory>;
  tournamentId: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Start from the published selection/note when one exists, otherwise everything.
  const draftIds = draft.items.map((i) => i.id).join("|");
  useEffect(() => {
    const publishedIds = new Set(story.record?.items.map((i) => i.id) ?? []);
    const initial = draft.items.filter((i) => (story.record ? publishedIds.has(i.id) : true)).map((i) => i.id);
    setSelected(new Set(initial));
    setNote(story.record?.editorialNote ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftIds, story.record?.publishedAt]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onPublish = () => {
    setError(null);
    setMessage(null);
    try {
      const record = buildPublishedStoryRecord(draft, Array.from(selected), note);
      story.publish.mutate(record, {
        onSuccess: () => setMessage("Story published. Public visitors can now see it."),
        onError: (e: any) => setError(e?.message ?? "Publishing failed"),
      });
    } catch (e: any) {
      setError(e?.message ?? "Publishing failed");
    }
  };

  const onWithdraw = () => {
    setError(null);
    setMessage(null);
    story.withdraw.mutate(undefined, {
      onSuccess: () => setMessage("Story withdrawn."),
      onError: (e: any) => setError(e?.message ?? "Withdrawing failed"),
    });
  };

  const busy = story.publish.isPending || story.withdraw.isPending;

  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`story-editor-${tournamentId}`}
        className="inline-flex items-center gap-1.5 text-sm font-black text-soft hover:text-primary"
      >
        {open ? <ChevronUp className="w-4 h-4" aria-hidden /> : <ChevronDown className="w-4 h-4" aria-hidden />}
        Review story (admin)
      </button>

      {open && (
        <div id={`story-editor-${tournamentId}`} className="mt-3 space-y-4">
          <p className="text-xs text-muted-foreground">
            Items are generated from completed results. Drafts are not saved; only publishing stores the story, and the
            facts are checked again at that moment. Walkovers are not used.
          </p>

          {factsStatus === "loading" && <p className="text-sm text-muted-foreground">Loading results…</p>}
          {factsStatus === "error" && (
            <p className="text-sm text-danger">Results could not be loaded, so no story can be generated.</p>
          )}
          {factsStatus === "ready" && draft.items.length === 0 && (
            <p className="text-sm text-muted-foreground">No finals, seed upsets or close deciders have been recorded yet.</p>
          )}

          {draft.items.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-black text-soft mb-1">Items to publish</legend>
              {draft.items.map((item) => (
                <label key={item.id} className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={selected.has(item.id)}
                    onChange={() => toggle(item.id)}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-black uppercase tracking-wide text-primary">
                      {TYPE_LABEL[item.type]}
                      {item.discipline ? ` · ${item.discipline}` : ""}
                    </span>
                    <span className="block font-bold text-foreground break-words">{item.headline}</span>
                    <span className="block text-sm text-soft break-words">{item.body}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          <div>
            <label htmlFor={`story-note-${tournamentId}`} className="block text-sm font-black text-soft">
              Organiser note (optional)
            </label>
            <textarea
              id={`story-note-${tournamentId}`}
              value={note}
              maxLength={STORY_EDITORIAL_NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-border-strong bg-background p-3 text-sm"
            />
            <p className="text-xs text-muted-foreground">Shown separately as “From the organisers”. {note.length}/{STORY_EDITORIAL_NOTE_MAX}</p>
          </div>

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {message && <p role="status" className="text-sm text-success">{message}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onPublish}
              disabled={busy || factsStatus !== "ready" || selected.size === 0}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground disabled:opacity-50"
            >
              {story.record ? "Republish story" : "Publish story"}
            </button>
            {story.record && (
              <button
                type="button"
                onClick={onWithdraw}
                disabled={busy}
                className="rounded-xl border border-border-strong px-4 py-2 text-sm font-black text-soft disabled:opacity-50"
              >
                Withdraw story
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
