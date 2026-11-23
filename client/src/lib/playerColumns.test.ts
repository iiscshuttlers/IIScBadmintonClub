import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PARTICIPANT_PUBLIC_COLUMNS, PARTICIPANT_REGISTRATION_COLUMNS, PLAYER_PUBLIC_COLUMNS, PLAYER_PRIVATE_COLUMNS, selectsPrivatePlayerColumns } from "./playerColumns";

/**
 * Guard for the contact-privacy migration (20261113170000): client roles can
 * no longer read players.email / iisc_email / contact_number / sr_number, so
 * a query that requests them (directly, via `*`, or by filtering on them)
 * fails at runtime. This scans the client source so it fails here first.
 */

const SRC = join(__dirname, "..");
const PRIVATE = PLAYER_PRIVATE_COLUMNS.join("|");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "node_modules" ? [] : files(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.|supabase-types/.test(name) ? [p] : [];
  });
}

function violations(): string[] {
  const out: string[] = [];
  for (const file of files(SRC)) {
    const s = readFileSync(file, "utf8");
    const at = (i: number) => `${relative(SRC, file)}:${s.slice(0, i).split("\n").length}`;
    // Embedded selects: players(...), players!fk(...), alias:players!fk(...)
    for (const m of s.matchAll(/players(?:![a-z_0-9]+)?\(([^)]*)\)/g)) {
      if (m[1].trim() === "*" || new RegExp(`\\b(${PRIVATE})\\b`).test(m[1])) out.push(`${at(m.index!)} embeds ${m[0]}`);
    }
    // from("players") chains: select("*"), select(), private columns, filters on them.
    for (const m of s.matchAll(/from\(\s*["']players["']\s*\)/g)) {
      const chunk = s.slice(m.index! + m[0].length, m.index! + m[0].length + 400);
      const sel = chunk.match(/\.select\(\s*(["'`])([\s\S]*?)\1/);
      if (sel && (sel[2].trim() === "*" || new RegExp(`\\b(${PRIVATE})\\b`).test(sel[2]))) out.push(`${at(m.index!)} selects ${sel[2].trim().slice(0, 40)}`);
      // Same statement only (up to the first ';'), linear scan.
      const stmt = chunk.slice(0, chunk.indexOf(";") === -1 ? 200 : chunk.indexOf(";"));
      if (stmt.includes(".select()")) out.push(`${at(m.index!)} select()`);
      const filt = chunk.slice(0, 300).match(new RegExp(`\\.(eq|neq|ilike|like|or|in|is)\\(\\s*["'\`][^"'\`]*\\b(${PRIVATE})\\b`));
      if (filt) out.push(`${at(m.index!)} filters on ${filt[2]}`);
    }
    // Other tables with restricted columns (migration 20261114090000).
    for (const [table, cols] of Object.entries(OTHER_RESTRICTED)) {
      for (const m of s.matchAll(new RegExp(`from\\(\\s*["']${table}["']\\s*\\)`, "g"))) {
        const chunk = s.slice(m.index! + m[0].length, m.index! + m[0].length + 400);
        const stmt = chunk.slice(0, chunk.indexOf(";") === -1 ? 400 : chunk.indexOf(";"));
        const sel = stmt.match(/\.select\(\s*(["'`])([\s\S]*?)\1/);
        if (sel && (/(^|[\s,])\*($|[\s,])/.test(sel[2]) || new RegExp(`\\b(${cols})\\b`).test(sel[2])))
          out.push(`${at(m.index!)} ${table} selects ${sel[2].trim().slice(0, 40)}`);
        if (stmt.includes(".select()")) out.push(`${at(m.index!)} ${table} select()`);
      }
    }
  }
  return out;
}

const OTHER_RESTRICTED: Record<string, string> = {
  tournament_participants: "email",
  find_lost_posts: "claim_contact",
};

describe("player contact privacy", () => {
  it("public column list excludes private columns", () => {
    expect(selectsPrivatePlayerColumns(PLAYER_PUBLIC_COLUMNS)).toBe(false);
    expect(selectsPrivatePlayerColumns("id, email")).toBe(true);
    expect(selectsPrivatePlayerColumns("*")).toBe(true);
  });

  it("no client query requests or filters on private player columns", () => {
    // Known, intentionally untouched legacy helpers in the WP3-owned
    // tournamentService (unused since the contact RPCs) are listed so a
    // new occurrence still fails. Remove them when WP3 lands.
    const found = violations();
    expect(found).toEqual([]);
  }, 30_000);
});

describe("participant column lists", () => {
  const cols = PARTICIPANT_REGISTRATION_COLUMNS.split(",").map((c) => c.trim());
  it("never select the participant email", () => {
    expect(PARTICIPANT_PUBLIC_COLUMNS.split(",").map((c) => c.trim())).not.toContain("email");
    expect(cols).not.toContain("email");
  });
  it("includes the in-app registration columns", () => {
    for (const c of ["registered_by", "source", "looking_for_partner", "updated_at"]) expect(cols).toContain(c);
  });
});
