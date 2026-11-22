import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("WP10 integrated release gate", () => {
  it("has a unique timestamp for every ordered migration", () => {
    const names = readdirSync(join(root, "supabase", "migrations"))
      .filter((name) => /^\d{14}_.+\.sql$/.test(name));
    const versions = names.map((name) => name.slice(0, 14));
    const duplicates = versions.filter((version, index) => versions.indexOf(version) !== index);

    expect(duplicates).toEqual([]);
  });

  it("keeps authoritative alert dispatch out of authenticated client reach", () => {
    const sql = read("supabase/migrations/20261113170000_add_tournament_subscriptions_and_alert_dedup.sql");

    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.dispatch_authoritative_match_alert[\s\S]*FROM anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.dispatch_authoritative_match_alert[\s\S]*TO service_role/);
    expect(sql).not.toMatch(/dispatch_authoritative_match_alert\([^;]+TO authenticated/);
  });

  it("uses the real scheduled-notification queue contract", () => {
    const sql = read("supabase/migrations/20261113170000_add_tournament_subscriptions_and_alert_dedup.sql");

    expect(sql).toContain("recipient_ids");
    expect(sql).toContain("ARRAY['push']::TEXT[]");
    expect(sql).not.toContain("recipient_id,");
  });

  it("only records scheduled push delivery after FCM accepts every request", () => {
    const dispatcher = read("supabase/functions/dispatch-scheduled-notifications/index.ts");

    expect(dispatcher).toContain('throw new Error("push: Firebase credentials unavailable")');
    expect(dispatcher).toContain('throw new Error("push: no eligible device tokens")');
    expect(dispatcher).toContain("if (!response.ok)");
    expect(dispatcher).toContain("isDeadToken(response.status, responseText)");
    expect(dispatcher).toContain("await Promise.all(");
  });

  it("treats push as best-effort only for gallery photo alerts", () => {
    const dispatcher = read("supabase/functions/dispatch-scheduled-notifications/index.ts");
    const migration = read("supabase/migrations/20261121150000_gallery_album_alerts.sql");

    // Organiser/match rows keep the strict default; only gallery_photos opts out.
    expect(dispatcher).toMatch(/DEFAULT_RULE: DeliveryRule = \{[^}]*pushOptional: false/);
    expect(dispatcher).toMatch(/gallery_photos: \{[^}]*pref: "pref_notify_gallery", pushOptional: true/);
    expect(dispatcher.match(/pushOptional: true/g)).toHaveLength(1);
    expect(migration).toContain("'gallery_photos'");
    expect(migration).toContain("ARRAY['in_app', 'push']");
  });

  it("expires stale match alerts and gives every queued revision a stable identity", () => {
    const migration = read("supabase/migrations/20261115130000_notification_identity_expiry.sql");
    const dispatcher = read("supabase/functions/dispatch-scheduled-notifications/index.ts");

    expect(migration).toContain("event_version BIGINT");
    expect(migration).toContain("scheduled_notifications_authoritative_event_uidx");
    expect(migration).toContain("Superseded by schedule revision");
    expect(migration).toContain("expires_at");
    expect(dispatcher).toContain('error: "Expired before provider dispatch"');
    expect(dispatcher).toContain('action: row.match_id ? "view_match" : "view_announcements"');
    expect(dispatcher).toContain("event_version: String(row.event_version)");
  });

  it("uses one safe deep-link contract for native and warm web notification taps", () => {
    const hook = read("client/src/hooks/useNotificationDeepLinks.ts");
    const pushHook = read("client/src/hooks/usePushNotifications.ts");
    const worker = read("client/public/firebase-messaging-sw.js");

    expect(hook).toContain('event.data?.type === "PUSH_DEEP_LINK"');
    expect(hook).toContain('"pushNotificationActionPerformed"');
    expect(pushHook).not.toContain('"pushNotificationActionPerformed"');
    expect(pushHook).not.toContain("removeAllListeners");
    expect(worker).toContain("Authoritative senders provide the canonical in-app route");
    expect(worker).toMatch(/data\.link[\s\S]*path = data\.link/);
  });

  it("does not expose draft readiness reports to anonymous users", () => {
    const sql = read("supabase/migrations/20261113123000_add_lifecycle_readiness_gates.sql");

    expect(sql).toContain("Not authorized to inspect tournament readiness");
    expect(sql).toContain("FROM anon");
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.verify_tournament_readiness\([^;]+TO authenticated, anon/);
  });

  it("has no first-party caller for legacy unrevisioned result edits", () => {
    const files = [
      "client/src/services/tournamentService.ts",
      // tournamentService.ts is a barrel over these modules.
      ...readdirSync(join(root, "client", "src", "services", "tournament"))
        .filter((name) => name.endsWith(".ts"))
        .map((name) => `client/src/services/tournament/${name}`),
      "client/src/components/admin/TournamentMatchesTab.tsx",
      "client/src/components/admin/TournamentBracketTab.tsx",
    ];

    for (const file of files) {
      expect(read(file), file).not.toContain("admin_edit_tournament_match");
      expect(read(file), file).not.toContain("adminEditTournamentMatch");
    }
  });

  it("excludes the Playwright fixture route from production", () => {
    const app = read("client/src/App.tsx");
    // The engine itself is a lazy import behind the same DEV check, so the
    // route may also be guarded by `UmpireEngine &&`.
    expect(app).toMatch(/import\.meta\.env\.DEV\s*&&\s*(?:UmpireEngine\s*&&\s*)?<Route path="\/test-umpire-engine"/);
    expect(app).toMatch(/const UmpireEngine = import\.meta\.env\.DEV/);
  });

  it("quarantines ownerless legacy score operations instead of adopting them", () => {
    const queue = read("client/src/lib/umpire/offlineQueue.ts");
    const sync = read("client/src/hooks/useOfflineUmpireSync.ts");

    expect(queue).toContain('UNATTRIBUTED_OFFLINE_QUEUE_OWNER = "__unattributed__"');
    expect(queue).not.toContain("legacyOwnerId");
    expect(sync).toContain("parseOfflineQueue(value)");
    expect(sync).toContain("item.ownerId === ownerId");
  });

  it("enforces one active tournament scorer at both RPC and trigger boundaries", () => {
    const sql = read("supabase/migrations/20261114100000_enforce_single_active_tournament_scorer.sql");

    expect(sql).toContain("enforce_single_active_tournament_scorer");
    expect(sql).toContain("scorer_locked");
    expect(sql).toMatch(/CREATE TRIGGER[\s\S]*enforce_single_active_tournament_scorer/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.upsert_live_match_by_id/i);
  });

  it("keeps identity decisions reviewable and future merges reversible", () => {
    const sql = read("supabase/migrations/20261114110000_complete_identity_decisions.sql");

    expect(sql).toContain("player_identity_merge_operations");
    expect(sql).toContain("player_identity_merge_moves");
    expect(sql).toContain("reverse_player_identity_merge");
    expect(sql).toContain("notify_player_claim_decision");
    expect(sql).toContain("status IN ('pending', 'withdrawn')");
    expect(sql).toContain("only admins and tournament officials may set review outcomes");
  });

  it("routes tournament schedule and status edits through a reasoned RPC", () => {
    const sql = read("supabase/migrations/20261114120000_reasoned_tournament_match_admin_updates.sql");
    const service = read("client/src/services/tournament/matchWrites.ts");
    const admin = read("client/src/components/admin/TournamentMatchesTab.tsx");

    expect(sql).toContain("admin_update_tournament_match");
    expect(sql).toContain("A reason is required");
    expect(service).toContain('rpc("admin_update_tournament_match"');
    expect(admin).toContain("adminUpdateTournamentMatch");
    expect(admin).not.toContain("updateTournamentMatch(");
  });

  it("does not synthesize an approximate all-category rating history", () => {
    const analytics = read("client/src/hooks/useProfileAnalytics.ts");
    const profile = read("client/src/pages/PlayerProfile.tsx");

    expect(analytics).not.toMatch(/elo_change\s*\/\s*3/);
    expect(profile).not.toContain("ratingFilter");
  });

  it("keeps manual team-tie winner changes locked out of direct table writes", () => {
    const teamService = read("client/src/services/teamService.ts");
    const manager = read("client/src/components/admin/TeamTournamentManager.tsx");

    const resolveStart = teamService.indexOf("async resolveTieWithScores");
    const resolveEnd = teamService.indexOf("async getTournamentConfigForLineup", resolveStart);
    const resolveBody = teamService.slice(resolveStart, resolveEnd);
    expect(resolveBody).toContain("coordinated tie recalculation RPC");
    expect(resolveBody).not.toContain(".from('tournament_matches')");
    expect(resolveBody).not.toContain(".from('tournament_ties')");
    expect(manager).toContain("Tie correction locked");
  });

  it("keeps doubles identity, sampling and admin observability policies shared", () => {
    const comparison = read("client/src/lib/comparison.ts");
    const admin = read("client/src/lib/adminActions.ts");

    expect(comparison).toContain("canonicalSideIds");
    expect(comparison).toContain("dateFrom");
    expect(comparison).toContain("Walkovers are shown separately");
    expect(admin).toContain("DELAY_THRESHOLD_MINUTES = 15");
    expect(admin).toContain("This is not an all-clear");
    expect(admin).toContain("Other devices' queues are not visible here");
  });

  it("forces corrected factual stories back through review", () => {
    const story = read("client/src/lib/tournamentStory.ts");

    expect(story).toContain('StoryReviewStatus = "draft" | "reviewed" | "published" | "needs_review"');
    expect(story).toContain("latest.get(item.id) !== item.sourceFingerprint");
    expect(story).toContain("diff <= 2");
    expect(story).not.toContain("diff <= 2 ||");
  });

  it("labels venue cache staleness and records the verified static-host limitation", () => {
    const venue = read("client/src/pages/VenueScoreboardPage.tsx");
    const hosting = read("docs/decisions/wc10-public-sharing-hosting-verification.md");

    expect(venue).toContain("isVenueDataStale");
    expect(venue).toContain("Scores may be stale");
    expect(venue).toContain("Fullscreen was not allowed");
    expect(hosting).toContain("| 404 |");
    expect(hosting).toContain("Do not promise rich tournament/match previews");
  });
});
