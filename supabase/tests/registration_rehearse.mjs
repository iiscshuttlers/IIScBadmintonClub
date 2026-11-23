#!/usr/bin/env node
/**
 * Rehearse the registration migrations against a database inside ONE
 * transaction that always ends in ROLLBACK (safe on production).
 *
 *   node supabase/tests/registration_rehearse.mjs <upto> [assertion files...] [--dry]
 *
 * <upto>: A | B | C | partb | cron | all — which new migrations to replay
 * (in order). Assertion files have their own top-level `BEGIN;` / `ROLLBACK;`
 * lines stripped so they run in the same transaction; the placeholder
 * `:'window_cases'` is replaced by client/src/lib/registration/registrationWindowCases.json
 * so TypeScript and SQL check the same case list.
 *
 * Runs: npx --yes supabase@3.3.0 db query --remote --yes -f <tmp script>
 * (--dry only writes the script and prints its path).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIGRATIONS = [
  ["A", "supabase/migrations/20261123150000_registration_schema.sql"],
  ["B", "supabase/migrations/20261123150100_registration_player_rpcs.sql"],
  ["C", "supabase/migrations/20261123150200_registration_organiser_rpcs.sql"],
  ["partb", "supabase/migrations/20261123150300_court_key_normalise.sql"],
  ["partb", "supabase/migrations/20261123150400_tournament_role_checks.sql"],
  ["cron", "supabase/migrations/20261123150500_registration_cron.sql"],
];
const ORDER = ["A", "B", "C", "partb", "cron"];

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const rest = args.filter((a) => a !== "--dry");
const upto = (rest.shift() ?? "A").replace(/^all$/, "cron");
const only = rest.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const files = rest.filter((a) => !a.startsWith("--"));
const stop = ORDER.indexOf(upto);
if (stop < 0) throw new Error(`unknown stage ${upto}`);

const read = (p) => readFileSync(join(root, p), "utf8");
const strip = (sql) => sql.replace(/^\s*(BEGIN|ROLLBACK|COMMIT)\s*;\s*$/gim, "-- (rehearsal: transaction control removed)");
const cases = JSON.stringify(JSON.parse(read("client/src/lib/registration/registrationWindowCases.json")));

let script = "SET lock_timeout = '3s';\nSET statement_timeout = '60s';\nBEGIN;\n";
for (const [stage, file] of MIGRATIONS) {
  if (ORDER.indexOf(stage) > stop) continue;
  if (only && !only.includes(stage)) continue;
  script += `\n-- ===== migration ${file}\n${strip(read(file))}\n`;
}
for (const f of files) {
  script += `\n-- ===== assertions ${f}\n${strip(read(f)).replaceAll(":'window_cases'", `$cases$${cases}$cases$`)}\n`;
}
script += "\nROLLBACK;\n";

const out = join(mkdtempSync(join(tmpdir(), "reg-rehearse-")), "rehearsal.sql");
writeFileSync(out, script);
if (dry) {
  console.log(out);
} else {
  const res = execFileSync("npx", ["--yes", "supabase@3.3.0", "db", "query", "--remote", "--yes", "--agent", "no", "-o", "table", "-f", out], {
    cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32",
  });
  console.log(res);
}
