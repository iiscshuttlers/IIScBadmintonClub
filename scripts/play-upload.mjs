/**
 * Upload an Android App Bundle to Google Play through the Play Developer API.
 *
 * Usage:
 *   node scripts/play-upload.mjs [options]
 *
 * Options:
 *   --aab <path>            Bundle to upload (default: android/app/build/outputs/bundle/release/app-release.aab)
 *   --track <name>          production | beta | alpha | internal (default: production, or $PLAY_TRACK)
 *   --status <status>       draft | completed | inProgress (default: draft)
 *   --rollout               Same as --status completed (full rollout)
 *   --fraction <0-1>        Staged rollout share; implies --status inProgress
 *   --existing <code>       Don't upload; point the track at an already-uploaded version code
 *                           (use this to roll out a draft uploaded earlier)
 *   --notes <text>          Release notes (max 500 characters)
 *   --notes-file <path>     Release notes from a file
 *   --lang <code>           Release notes language (default: en-US, or $PLAY_NOTES_LANG)
 *   --validate              Run every step but validate the edit instead of committing it
 *   --dry-run               Check the key, bundle and options offline; no network calls
 *
 * Service-account key: $PLAY_SERVICE_ACCOUNT_KEY, else
 *   ~/.config/iiscshuttlers/play-service-account.json
 * Keep it outside the repository. See docs/play-store-upload.md for setup.
 *
 * Without --notes/--notes-file, notes come from the newest entry in
 * client/public/data/changelog.json, with commit prefixes stripped.
 *
 * Exit codes: 0 done, 1 failed, 2 no key found (callers may treat as "skipped").
 */

import { readFileSync, existsSync, statSync } from "fs";
import { createSign } from "crypto";
import { homedir } from "os";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

export const PACKAGE_NAME = "shuttlers.iisc.com";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const UPLOAD_API = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const NOTES_LIMIT = 500;
const TRACKS = ["production", "beta", "alpha", "internal"];
const STATUSES = ["draft", "completed", "inProgress"];

/* ── options ────────────────────────────────────────────────────── */
export function parseArgs(argv, env = process.env) {
  const opts = {
    aab: resolve(root, "android/app/build/outputs/bundle/release/app-release.aab"),
    track: env.PLAY_TRACK || "production",
    status: "draft",
    fraction: null,
    existing: null,
    notes: null,
    notesFile: null,
    lang: env.PLAY_NOTES_LANG || "en-US",
    validate: false,
    dryRun: false,
  };
  const need = (i, flag) => {
    if (i + 1 >= argv.length) throw new Error(`${flag} needs a value`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--aab": opts.aab = resolve(need(i, a)); i++; break;
      case "--track": opts.track = need(i, a); i++; break;
      case "--status": opts.status = need(i, a); i++; break;
      case "--rollout": opts.status = "completed"; break;
      case "--fraction": opts.fraction = Number(need(i, a)); opts.status = "inProgress"; i++; break;
      case "--existing": opts.existing = need(i, a); i++; break;
      case "--notes": opts.notes = need(i, a); i++; break;
      case "--notes-file": opts.notesFile = resolve(need(i, a)); i++; break;
      case "--lang": opts.lang = need(i, a); i++; break;
      case "--validate": opts.validate = true; break;
      case "--dry-run": opts.dryRun = true; break;
      default: throw new Error(`Unknown option: ${a}`);
    }
  }
  if (!TRACKS.includes(opts.track)) throw new Error(`--track must be one of ${TRACKS.join(", ")}`);
  if (!STATUSES.includes(opts.status)) throw new Error(`--status must be one of ${STATUSES.join(", ")}`);
  if (opts.status === "inProgress") {
    if (!(opts.fraction > 0 && opts.fraction < 1)) throw new Error("--fraction must be between 0 and 1 (exclusive) for a staged rollout");
  } else if (opts.fraction !== null) {
    throw new Error("--fraction only applies to a staged rollout (status inProgress)");
  }
  if (opts.existing !== null && !/^\d+$/.test(opts.existing)) throw new Error("--existing must be a version code (digits)");
  return opts;
}

/* ── release notes ──────────────────────────────────────────────── */
// "- fix(db): close database functions" -> "Close database functions"
export function cleanChange(line) {
  let s = String(line).trim().replace(/^[-*•]\s*/, "");
  s = s.replace(/^(feat|fix|perf|refactor|chore|docs|style|test|build|ci)(\([^)]*\))?!?:\s*/i, "");
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function notesFromChangelog(entry, limit = NOTES_LIMIT) {
  const skip = /^(docs|chore|test|ci|build|style|refactor)(\(|:)/i;
  const seen = new Set();
  const lines = [];
  for (const raw of entry?.changes ?? []) {
    const bare = String(raw).trim().replace(/^[-*•]\s*/, "");
    if (!bare || skip.test(bare)) continue;
    const text = cleanChange(bare);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    lines.push(`• ${text}`);
  }
  if (lines.length === 0) return `Version ${entry?.versionName ?? ""}: bug fixes and improvements.`.trim();
  return fitNotes(lines, limit);
}

// Keep whole lines while they fit; end with a short "and more" line if any were dropped.
export function fitNotes(lines, limit = NOTES_LIMIT) {
  const more = "• Other fixes and improvements";
  const out = [];
  for (const line of lines) {
    const next = [...out, line].join("\n");
    const room = out.length + 1 < lines.length ? limit - more.length - 1 : limit;
    if (next.length > room) break;
    out.push(line);
  }
  if (out.length < lines.length) out.push(more);
  const text = out.join("\n");
  return text.length <= limit ? text : text.slice(0, limit - 1) + "…";
}

export function resolveNotes(opts) {
  let text;
  if (opts.notes !== null) text = opts.notes;
  else if (opts.notesFile) text = readFileSync(opts.notesFile, "utf8");
  else {
    const file = resolve(root, "client/public/data/changelog.json");
    const entries = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
    text = notesFromChangelog(entries[0]);
  }
  text = text.trim();
  if (text.length > NOTES_LIMIT) throw new Error(`Release notes are ${text.length} characters; Play allows ${NOTES_LIMIT}.`);
  return text;
}

/* ── auth ───────────────────────────────────────────────────────── */
export function keyPath(env = process.env) {
  return env.PLAY_SERVICE_ACCOUNT_KEY || join(homedir(), ".config", "iiscshuttlers", "play-service-account.json");
}

export function loadKey(path) {
  const key = JSON.parse(readFileSync(path, "utf8"));
  if (key.type !== "service_account" || !key.client_email || !key.private_key) {
    throw new Error(`${path} is not a service-account JSON key (needs type, client_email, private_key).`);
  }
  return key;
}

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

export function signJwt(key, now = Math.floor(Date.now() / 1000)) {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: key.client_email,
    scope: SCOPE,
    aud: key.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  return `${unsigned}.${b64url(signer.sign(key.private_key))}`;
}

async function accessToken(key) {
  const res = await fetch(key.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signJwt(key) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`Google sign-in for ${key.client_email} failed (${res.status}): ${body.error_description || body.error || "no token"}`);
  }
  return body.access_token;
}

/* ── API calls ──────────────────────────────────────────────────── */
async function call(token, method, url, { json, body, contentType } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  if (json !== undefined) headers["Content-Type"] = "application/json";
  else if (contentType) headers["Content-Type"] = contentType;
  const res = await fetch(url, { method, headers, body: json !== undefined ? JSON.stringify(json) : body });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.error?.message || data.raw || res.statusText;
    const err = new Error(`${method} ${url.replace(/\?.*$/, "")} → ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function releaseBody(opts, versionCode, notes, name) {
  const release = {
    name,
    versionCodes: [String(versionCode)],
    status: opts.status,
    releaseNotes: [{ language: opts.lang, text: notes }],
  };
  if (opts.status === "inProgress") release.userFraction = opts.fraction;
  return { track: opts.track, releases: [release] };
}

function versionNameFromGradle() {
  try {
    const gradle = readFileSync(resolve(root, "android/app/build.gradle"), "utf8");
    return {
      code: Number(gradle.match(/versionCode (\d+)/)?.[1]),
      name: gradle.match(/versionName "([^"]+)"/)?.[1],
    };
  } catch {
    return { code: NaN, name: undefined };
  }
}

/* ── main ───────────────────────────────────────────────────────── */
export async function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    console.error(`✖ ${e.message}`);
    return 1;
  }

  const kp = keyPath();
  if (!existsSync(kp)) {
    console.error(`✖ No Play service-account key at ${kp}. Set PLAY_SERVICE_ACCOUNT_KEY or see docs/play-store-upload.md.`);
    return 2;
  }

  let key, notes;
  try {
    key = loadKey(kp);
    notes = resolveNotes(opts);
    if (opts.existing === null && !existsSync(opts.aab)) throw new Error(`Bundle not found: ${opts.aab}`);
  } catch (e) {
    console.error(`✖ ${e.message}`);
    return 1;
  }

  const gradle = versionNameFromGradle();
  const what = opts.existing ? `version code ${opts.existing} (already uploaded)` : `${opts.aab} (${(statSync(opts.aab).size / 1048576).toFixed(1)} MB)`;
  const statusText = opts.status === "inProgress" ? `staged rollout to ${Math.round(opts.fraction * 100)}%` : opts.status === "completed" ? "full rollout" : "draft (not sent to users)";
  console.log(`▶ Play upload: ${PACKAGE_NAME}, track ${opts.track}, ${statusText}`);
  console.log(`  bundle: ${what}`);
  console.log(`  service account: ${key.client_email}`);
  console.log(`  notes (${opts.lang}, ${notes.length}/${NOTES_LIMIT}):\n${notes.split("\n").map((l) => "    " + l).join("\n")}`);

  if (opts.dryRun) {
    signJwt(key); // proves the private key parses and signs
    console.log("✔ Dry run: key, bundle and options are valid. Nothing was sent.");
    return 0;
  }

  let token, editId;
  try {
    token = await accessToken(key);
    const app = `${API}/applications/${PACKAGE_NAME}`;
    editId = (await call(token, "POST", `${app}/edits`, { json: {} })).id;

    let versionCode = opts.existing;
    if (versionCode === null) {
      console.log("▶ Uploading bundle…");
      const up = await call(token, "POST", `${UPLOAD_API}/applications/${PACKAGE_NAME}/edits/${editId}/bundles?uploadType=media`, {
        body: readFileSync(opts.aab),
        contentType: "application/octet-stream",
      });
      versionCode = up.versionCode;
      console.log(`✔ Uploaded version code ${versionCode}`);
    }

    const name = Number(versionCode) === gradle.code && gradle.name ? `${gradle.name} (${versionCode})` : String(versionCode);
    await call(token, "PUT", `${app}/edits/${editId}/tracks/${opts.track}`, { json: releaseBody(opts, versionCode, notes, name) });

    if (opts.validate) {
      await call(token, "POST", `${app}/edits/${editId}:validate`);
      await call(token, "DELETE", `${app}/edits/${editId}`).catch(() => {});
      console.log("✔ Validated: Play accepted the release. Nothing was committed.");
      return 0;
    }

    await call(token, "POST", `${app}/edits/${editId}:commit`);
    console.log(`✔ Committed: ${name} on ${opts.track} as ${statusText}.`);
    if (opts.status === "draft") {
      console.log(`  Roll it out in Play Console, or: node scripts/play-upload.mjs --existing ${versionCode} --rollout`);
    }
    return 0;
  } catch (e) {
    if (token && editId) {
      await call(token, "DELETE", `${API}/applications/${PACKAGE_NAME}/edits/${editId}`).catch(() => {});
    }
    console.error(`✖ ${e.message}`);
    if (e.status === 401 || e.status === 403) {
      console.error("  Check that the service account is invited in Play Console (Users and permissions) with release rights for this app, and that the Google Play Android Developer API is enabled in its Cloud project.");
    }
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code));
}
