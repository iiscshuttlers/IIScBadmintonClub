#!/usr/bin/env node
/**
 * Fails when client code hard-codes a colour or font instead of using the
 * theme tokens in client/src/styles/themes.css.
 *
 * Blocked in client/src (ts, tsx, css):
 *   - Tailwind palette classes:  bg-emerald-500, text-slate-400, border-white/10, …
 *   - Arbitrary colour classes:  bg-[#0f172a], shadow-[0_0_6px_rgba(…)], …
 *   - Hex / rgb() / hsl() colour literals in code and CSS
 *   - Hard-coded font families (fontFamily: "Outfit", font-[…])
 *
 * Use tokens instead: bg-card, text-soft, text-live, bg-success/10,
 * border-border-strong, var(--primary), themeColor("primary"), var(--font-display).
 *
 * A line may opt out with a trailing comment explaining why, e.g.
 *   ctx.fillStyle = "#ffffff"; // raw-color-ok: printed certificate paper
 * Theme definition files (styles/themes.css, the @theme block of index.css)
 * are exempt.
 *
 * Usage: node scripts/check-raw-colors.mjs [--list] [--json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "client", "src");
const EXEMPT_FILES = new Set(["client/src/styles/themes.css"]);

const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const UTIL = "bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|divide|placeholder|decoration|shadow|accent|caret";
const RULES = [
  { id: "palette-class", re: new RegExp(`(?<![\\w-])(?:[\\w\\[\\]&>=.:/*-]+:)?!?(?:${UTIL})-(?:${PALETTE})-\\d{2,3}\\b`, "g") },
  { id: "white-black-class", re: new RegExp(`(?<![\\w-])(?:[\\w\\[\\]&>=.:/*-]+:)?!?(?:${UTIL})-(?:white|black)(?![\\w-])`, "g") },
  { id: "arbitrary-colour-class", re: new RegExp(`(?<![\\w-])(?:${UTIL})-\\[[^\\]]*(?:#[0-9a-fA-F]{3}|rgba?\\(|hsla?\\()`, "g") },
  { id: "hex-colour", re: /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g },
  { id: "rgb-hsl-colour", re: /\b(?:rgba?|hsla?)\(\s*\d/g },
  { id: "font-family", re: /\b(?:Playfair|Bodoni|Cinzel|Caveat|Outfit|Barlow|Unbounded|Fraunces|Manrope|Jakarta|Inter Tight)\b|font-\[(?!var\()/g },
];

const OK_COMMENT = /raw-color-ok:\s*\S/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(e.name) && !e.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

function stripComments(line, inBlock) {
  // remove // and /* */ comments so prose about colours does not count
  let out = "";
  let i = 0;
  let block = inBlock;
  let quote = null;
  while (i < line.length) {
    const c = line[i];
    const n = line[i + 1];
    if (block) {
      if (c === "*" && n === "/") { block = false; i += 2; continue; }
      i++; continue;
    }
    if (quote) {
      out += c;
      if (c === "\\") { out += n ?? ""; i += 2; continue; }
      if (c === quote) quote = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && n === "/") break;
    if (c === "/" && n === "*") { block = true; i += 2; continue; }
    out += c; i++;
  }
  return { code: out, inBlock: block };
}

const findings = [];
for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (EXEMPT_FILES.has(rel)) continue;
  if (/\.test\.(tsx?)$/.test(rel)) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  let inBlock = false;
  let inThemeBlock = false;
  lines.forEach((line, idx) => {
    if (rel.endsWith("index.css")) {
      if (/^@theme\b/.test(line)) inThemeBlock = true;
      if (inThemeBlock) { if (/^}/.test(line)) inThemeBlock = false; return; }
    }
    const { code, inBlock: nb } = stripComments(line, inBlock);
    inBlock = nb;
    if (OK_COMMENT.test(line)) return;
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(code))) {
        // url fragments and ids like href="#abc" are not colours
        if (rule.id === "hex-colour" && /(?:href|to|id|url\(|#\{)\s*=?\s*["'`(]?$/.test(code.slice(0, m.index))) continue;
        findings.push({ file: rel, line: idx + 1, rule: rule.id, match: m[0], text: line.trim().slice(0, 160) });
      }
    }
  });
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(findings, null, 1));
} else if (findings.length) {
  const byRule = {};
  for (const f of findings) byRule[f.rule] = (byRule[f.rule] || 0) + 1;
  const files = new Set(findings.map((f) => f.file));
  if (process.argv.includes("--list") || findings.length <= 60) {
    for (const f of findings) console.log(`${f.file}:${f.line}  [${f.rule}] ${f.match}   ${f.text}`);
  }
  console.error(`\n✖ ${findings.length} hard-coded colour/font uses in ${files.size} files:`, byRule);
  console.error("  Use theme tokens (see client/src/styles/themes.css) or add `// raw-color-ok: <reason>`.");
} else {
  console.log("✓ No hard-coded colours or fonts in client/src");
}
process.exit(findings.length ? 1 : 0);
