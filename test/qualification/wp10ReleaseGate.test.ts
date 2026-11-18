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

  it("does not expose draft readiness reports to anonymous users", () => {
    const sql = read("supabase/migrations/20261113123000_add_lifecycle_readiness_gates.sql");

    expect(sql).toContain("Not authorized to inspect tournament readiness");
    expect(sql).toContain("FROM anon");
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.verify_tournament_readiness\([^;]+TO authenticated, anon/);
  });

  it("has no first-party caller for legacy unrevisioned result edits", () => {
    const files = [
      "client/src/services/tournamentService.ts",
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
    expect(app).toMatch(/import\.meta\.env\.DEV\s*&&\s*<Route path="\/test-umpire-engine"/);
  });
});
