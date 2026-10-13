#!/usr/bin/env node
/**
 * Build gate for the "cannot find name" / ReferenceError class of bug in files
 * that carry `// @ts-nocheck` (mostly components/admin). Those files are invisible
 * to `tsc --noEmit`, so a removed/renamed handler still referenced in JSX — e.g.
 * `toggleExpand is not defined`, `setBookingDate is not defined` — ships and only
 * throws at runtime on click.
 *
 * This script temporarily strips the pragma from every @ts-nocheck file, runs tsc,
 * and keeps only the undefined-name diagnostics (TS2304 / TS2552 / TS2551). It then
 * compares them against a committed baseline (scripts/undefined-refs-baseline.json):
 * any undefined reference NOT in the baseline fails the build, while already-known
 * ones are grandfathered so the gate can land before every legacy file is cleaned up.
 *
 *   node scripts/check-undefined-refs.mjs                 # check (CI / npm run check)
 *   node scripts/check-undefined-refs.mjs --update-baseline  # re-snapshot known refs
 *
 * The type-mismatch noise that @ts-nocheck intentionally silences is ignored; this
 * gate is only about names that don't resolve.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { globSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BASELINE = resolve(__dirname, "undefined-refs-baseline.json");
const UNDEFINED_CODES = new Set(["2304", "2552", "2551"]);
const PRAGMA_RE = /^\s*\/\/\s*@ts-nocheck.*\r?\n/;

function listNoCheckFiles() {
  // Node 22+ has fs.globSync; fall back to a manual walk if unavailable.
  let files;
  try {
    files = globSync("client/src/**/*.{ts,tsx}", { cwd: ROOT });
  } catch {
    files = execSync("git ls-files client/src", { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .filter((f) => /\.tsx?$/.test(f));
  }
  return files
    .map((f) => resolve(ROOT, f))
    .filter((abs) => existsSync(abs) && PRAGMA_RE.test(readFileSync(abs, "utf8")));
}

function run() {
  const update = process.argv.includes("--update-baseline");
  const files = listNoCheckFiles();
  const backups = new Map();

  // Strip the pragma from each file, remembering the original to restore later.
  for (const abs of files) {
    const original = readFileSync(abs, "utf8");
    backups.set(abs, original);
    writeFileSync(abs, original.replace(PRAGMA_RE, ""));
  }

  let tscOutput = "";
  try {
    try {
      execSync("npx tsc --noEmit", { cwd: ROOT, encoding: "utf8", stdio: "pipe", maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      tscOutput = `${e.stdout || ""}${e.stderr || ""}`;
    }
  } finally {
    // ALWAYS restore, even if tsc throws or the process is interrupted mid-run.
    for (const [abs, original] of backups) writeFileSync(abs, original);
  }

  // Collect undefined-name diagnostics as "relpath|identifier".
  const found = new Set();
  const detail = [];
  for (const line of tscOutput.split(/\r?\n/)) {
    const m = line.match(/^(.+?)\((\d+),\d+\): error TS(\d+): (.*)$/);
    if (!m) continue;
    const [, file, lineNo, code, msg] = m;
    if (!UNDEFINED_CODES.has(code)) continue;
    const nameMatch = msg.match(/Cannot find name '([^']+)'|Property '([^']+)' does not exist/);
    const name = nameMatch ? nameMatch[1] || nameMatch[2] : msg;
    const rel = relative(ROOT, resolve(ROOT, file)).replace(/\\/g, "/");
    found.add(`${rel}|${name}`);
    detail.push(`  ${rel}:${lineNo}  ${msg}`);
  }

  if (process.env.DEBUG_REFS) {
    console.error(`[debug] files=${files.length} tscOutputLen=${tscOutput.length} found=${found.size}`);
    console.error(`[debug] first tsc lines:\n${tscOutput.split("\n").slice(0, 4).join("\n")}`);
  }

  if (update) {
    writeFileSync(BASELINE, JSON.stringify([...found].sort(), null, 2) + "\n");
    console.log(`Baseline updated: ${found.size} known undefined-reference(s).`);
    return;
  }

  const baseline = existsSync(BASELINE) ? new Set(JSON.parse(readFileSync(BASELINE, "utf8"))) : new Set();
  const novel = [...found].filter((sig) => !baseline.has(sig));
  const fixed = [...baseline].filter((sig) => !found.has(sig));

  if (novel.length > 0) {
    console.error("\n✗ New undefined reference(s) in @ts-nocheck files (likely a ReferenceError at runtime):\n");
    for (const d of detail) {
      const rel = d.trim().split(/:\d+\s/)[0];
      const name = d.match(/Cannot find name '([^']+)'|Property '([^']+)' does not exist/);
      const sig = `${rel}|${name ? name[1] || name[2] : ""}`;
      if (novel.includes(sig)) console.error(d);
    }
    console.error(
      "\nFix the reference, or — if intentional — run `node scripts/check-undefined-refs.mjs --update-baseline` and commit the baseline.\n",
    );
    process.exit(1);
  }

  if (fixed.length > 0) {
    console.log(`✓ No new undefined references. ${fixed.length} baselined ref(s) now fixed — run --update-baseline to shrink the baseline.`);
  } else {
    console.log(`✓ No new undefined references in ${files.length} @ts-nocheck files (${baseline.size} baselined).`);
  }
}

run();
