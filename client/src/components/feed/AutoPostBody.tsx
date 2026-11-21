import { Link } from "wouter";
import { Clock, ExternalLink, MapPin, Trophy } from "lucide-react";
import type { AutoAnnouncement } from "@/lib/autoAnnouncements";

/**
 * Body of a Feed post built from tournament data. Everything is rendered as
 * text: names come from the database, so nothing here goes through HTML.
 */
export function AutoPostBody({ post, compact = false }: { post: AutoAnnouncement; compact?: boolean }) {
  const text = compact ? "text-sm" : "text-[15px]";
  return (
    <div className={`space-y-3 ${text}`}>
      {post.lines.map((line, i) => (
        <p key={i} className="text-muted-foreground leading-relaxed">
          {line}
        </p>
      ))}

      {(post.venue || post.closesAt) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {post.venue && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-danger opacity-80" aria-hidden />
              {post.venue}
            </span>
          )}
          {post.closesAt && (
            <span className="flex items-center gap-1.5 text-warning font-semibold">
              <Clock className="w-3.5 h-3.5" aria-hidden />
              Closes {new Date(post.closesAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          )}
        </div>
      )}

      {post.winners && post.winners.length > 0 && (
        <ul className="space-y-1.5" aria-label="Winners">
          {post.winners.map((w) => (
            <li key={`${w.category}-${w.winner}`} className="flex items-start gap-2 leading-snug">
              <Trophy className="w-3.5 h-3.5 mt-0.5 text-gold shrink-0" aria-hidden />
              <span className="min-w-0">
                <span className="font-bold text-foreground">{w.category}:</span>{" "}
                <span className="text-soft font-semibold">{w.winner}</span>
                {w.runnerUp && <span className="text-muted-foreground"> (runner-up {w.runnerUp})</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {post.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {post.actions.map((a, i) => {
            const cls = `inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors ${
              i === 0
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-card text-soft border border-border-strong hover:text-primary"
            }`;
            return a.external ? (
              <a key={`${a.label}-${a.href}`} href={a.href} target="_blank" rel="noopener noreferrer" className={cls}>
                {a.label} <ExternalLink className="w-3.5 h-3.5" aria-hidden />
              </a>
            ) : (
              <Link key={`${a.label}-${a.href}`} href={a.href} className={cls}>
                {a.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
