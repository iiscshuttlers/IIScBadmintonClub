#!/usr/bin/env node
/**
 * Fails when a Tailwind grid sets its columns only from a breakpoint up,
 * e.g. `grid sm:grid-cols-2 gap-4`.
 *
 * Below that breakpoint the grid has no column template, so the browser makes
 * one implicit `auto` column. An auto column grows to fit its widest
 * unbreakable content (a `truncate` line, a long name, a nowrap chip row), so
 * a single long string pushes the whole card past the edge of a phone screen.
 * `grid-cols-1` is `repeat(1, minmax(0, 1fr))`: the column is pinned to the
 * container width and long text truncates or wraps inside the card instead.
 *
 * Fix: add a base column count — `grid grid-cols-1 sm:grid-cols-2 gap-4`.
 * Run with --fix to insert `grid-cols-1` after the `grid` class automatically.
 *
 * A line may opt out with a trailing comment explaining why, e.g.
 *   <div className="grid md:grid-cols-2"> {/* grid-ok: children set their own widths *\/}
 *
 * Usage: node scripts/check-responsive-grids.mjs [--fix]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "client", "src");
const FIX = process.argv.includes("--fix");
const OK_COMMENT = /grid-ok:\s*\S/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

// String and template literals; class lists live in these.
const LITERAL = /(["'`])((?:(?!\1)[^\\]|\\.)*?)\1/gs;
const BASE_COLS = /^grid-cols-/;
const RESPONSIVE_COLS = /^(?:[\w-]+:)+grid-cols-/;
// Variants that are not viewport breakpoints (state/container queries) still
// leave the base case uncovered, so any `x:grid-cols-*` counts.

const findings = [];
for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (/\.test\.(tsx|jsx)$/.test(rel)) continue;
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split("\n");
  const edits = [];
  LITERAL.lastIndex = 0;
  let m;
  while ((m = LITERAL.exec(src))) {
    const body = m[2];
    const tokens = body.split(/\s+/);
    if (!tokens.includes("grid")) continue;
    if (tokens.some((t) => BASE_COLS.test(t))) continue;
    if (!tokens.some((t) => RESPONSIVE_COLS.test(t))) continue;
    const lineNo = src.slice(0, m.index).split("\n").length;
    if (OK_COMMENT.test(lines[lineNo - 1] ?? "")) continue;
    findings.push({ file: rel, line: lineNo, text: body.replace(/\s+/g, " ").trim().slice(0, 120) });
    // position of the standalone `grid` token inside the literal
    const tok = /(^|\s)grid(?=\s|$)/.exec(body);
    if (tok) edits.push(m.index + 1 + tok.index + tok[1].length + "grid".length);
  }
  if (FIX && edits.length) {
    let out = src;
    for (const at of edits.sort((a, b) => b - a)) out = out.slice(0, at) + " grid-cols-1" + out.slice(at);
    fs.writeFileSync(file, out);
  }
}

if (findings.length && !FIX) {
  for (const f of findings) console.log(`${f.file}:${f.line}  ${f.text}`);
  console.error(`\n✖ ${findings.length} grids set columns only from a breakpoint up, so phones get an auto column that can overflow.`);
  console.error("  Add a base count (`grid grid-cols-1 sm:grid-cols-2`), run with --fix, or add `grid-ok: <reason>`.");
  process.exit(1);
} else if (findings.length) {
  console.log(`✓ Added grid-cols-1 to ${findings.length} grids in client/src`);
} else {
  console.log("✓ Every responsive grid in client/src has a base column count");
}
