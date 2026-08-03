/**
 * Automated release script
 * Usage: node scripts/release.mjs ["optional changelog message"]
 *
 * What it does:
 *  1. Bumps versionCode + versionName in android/app/build.gradle
 *  2. Updates client/public/data/app-version.json
 *  3. Builds the web app (vite build)
 *  4. Syncs Capacitor
 *  5. Builds the signed release APK
 *  6. Copies APK to OneDrive
 *  7. Creates a GitHub Release and uploads the APK
 *  8. Commits + pushes version files (triggers GitHub Pages deploy)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync, spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Add GitHub CLI to PATH in case the terminal hasn't picked it up yet
process.env.PATH = `${process.env.PATH};C:\\Program Files\\GitHub CLI`;

const APK_SRC = resolve(
  root,
  "android/app/build/outputs/apk/release/app-release.apk",
);
const AAB_SRC = resolve(
  root,
  "android/app/build/outputs/bundle/release/app-release.aab",
);
const ONEDRIVE_DIR = "D:\\OneDrive - Indian Institute of Science\\Temp_apk";
const REPO = "iiscshuttlers/iiscshuttlers";

const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });

/* ── helpers ────────────────────────────────────────────────────── */
function log(msg) {
  console.log(`\n\x1b[36m▶ ${msg}\x1b[0m`);
}
function ok(msg) {
  console.log(`\x1b[32m✔ ${msg}\x1b[0m`);
}
function fail(msg) {
  console.error(`\x1b[31m✖ ${msg}\x1b[0m`);
  process.exit(1);
}

function bumpVersion(name) {
  // Expect a version like "1.00". Increment the minor part and keep two digits.
  const parts = name.split(".");
  const major = parts[0];
  const minor = parseInt(parts[parts.length - 1] ?? "0");
  const newMinor = (minor + 1).toString().padStart(2, "0");
  return `${major}.${newMinor}`;
}

/* ── 0. Check gh auth ───────────────────────────────────────────── */
log("Checking GitHub CLI auth…");
try {
  execSync("gh auth status", { stdio: "pipe" });
  ok("GitHub CLI authenticated");
} catch {
  fail("Not logged into GitHub CLI. Run: gh auth login");
}

/* ── 1. Bump version in build.gradle ────────────────────────────── */
log("Bumping Android version…");
const gradlePath = resolve(root, "android/app/build.gradle");
let gradle = readFileSync(gradlePath, "utf8");

const codeMatch = gradle.match(/versionCode (\d+)/);
const nameMatch = gradle.match(/versionName "([^"]+)"/);
if (!codeMatch || !nameMatch)
  fail("Could not parse versionCode/versionName from build.gradle");

// Check if a previous run already bumped but didn't commit (retry-safe)
let headGradle = "";
try {
  headGradle = execSync("git show HEAD:android/app/build.gradle", { cwd: root, stdio: "pipe" }).toString();
} catch (e) {}
const headCodeMatch = headGradle.match(/versionCode (\d+)/);
const headCode = headCodeMatch ? parseInt(headCodeMatch[1]) : 0;
const currentCode = parseInt(codeMatch[1]);

const alreadyBumped = currentCode > headCode;

let oldCode, oldName, newCode, newName;
if (alreadyBumped) {
  newCode = parseInt(codeMatch[1]);
  newName = nameMatch[1];
  const prevCode = newCode - 1;
  console.log(
    `  ↩ Previous bump detected — retrying v${newName} (build ${newCode})`,
  );
  oldCode = prevCode;
  oldName = newName;
} else {
  oldCode = parseInt(codeMatch[1]);
  oldName = nameMatch[1];
  newCode = oldCode + 1;
  newName = bumpVersion(oldName);
  gradle = gradle
    .replace(`versionCode ${oldCode}`, `versionCode ${newCode}`)
    .replace(`versionName "${oldName}"`, `versionName "${newName}"`);
  writeFileSync(gradlePath, gradle);
}
ok(`${oldName} (${oldCode})  →  ${newName} (${newCode})`);

/* ── 2. Update app-version.json and Changelog ────────────────────────── */
log("Updating version history and changelog…");

// Auto-generate changelog from git commits since last tag
let autoChangelog = "";
try {
  const tags = execSync("git tag --sort=-creatordate").toString().trim().split('\n');
  let rawLog = "";
  if (tags.length > 0 && tags[0]) {
    rawLog = execSync(`git log ${tags[0]}..HEAD --pretty=format:"%s"`).toString().trim();
  } else {
    rawLog = execSync(`git log -n 10 --pretty=format:"%s"`).toString().trim();
  }

  // Filter out noise commits like version bumps, chores, and merges
  const validCommits = rawLog.split('\n')
    .map(m => m.trim())
    .filter(m => m && 
      !m.toLowerCase().startsWith('chore: release') && 
      !m.toLowerCase().startsWith('updated version') && 
      !m.toLowerCase().startsWith('merge branch') &&
      !m.toLowerCase().startsWith('merge pull request') &&
      !m.toLowerCase().startsWith('wip')
    );
  
  if (validCommits.length > 0) {
    autoChangelog = validCommits.map(m => `- ${m}`).join('\n');
  }
} catch (e) { }

const changelog = process.argv[2] || autoChangelog || `Version ${newName} released with bug fixes and performance improvements.`;
const finalApkName = `IIScShuttlers_v${newName}.apk`;
const finalAabName = `IIScShuttlers_v${newName}.aab`;

const versionJsonPath = resolve(root, "client/public/data/app-version.json");
writeFileSync(
  versionJsonPath,
  JSON.stringify(
    {
      versionCode: newCode,
      versionName: newName,
      downloadUrl: `https://play.google.com/store/apps/details?id=com.iiscshuttlers.app`,
      changelog,
    },
    null,
    2,
  ) + "\n",
);

// Update Persistent Changelog Array
const changelogFile = resolve(root, "client/public/data/changelog.json");
let changelogData = [];
if (existsSync(changelogFile)) {
  try { changelogData = JSON.parse(readFileSync(changelogFile, "utf8")); } catch (e) { }
}

// Avoid duplicates if retrying a failed build
if (!changelogData.find(c => c.versionCode === newCode)) {
  changelogData.unshift({
    versionCode: newCode,
    versionName: newName,
    date: new Date().toISOString(),
    changes: changelog.split('\n').filter(Boolean)
  });
  writeFileSync(changelogFile, JSON.stringify(changelogData, null, 2) + "\n");
}

ok("app-version.json and changelog.json updated");

/* ── 3. Vite build ──────────────────────────────────────────────── */
log("Building web app (vite build)…");
run("npx vite build", { cwd: root });

/* ── 4. Capacitor sync ──────────────────────────────────────────── */
log("Syncing Capacitor…");
run("npx cap sync android", { cwd: root });

/* ── 5. Build release APK & AAB ─────────────────────────────────── */
log("Building release APK and AAB…");
run("gradlew assembleRelease bundleRelease", {
  cwd: resolve(root, "android"),
  shell: true,
});

/* ── 6. Copy artifacts to OneDrive ──────────────────────────────── */
log("Copying APK and AAB to OneDrive in the background…");
try {
  const oneDriveApkPath = resolve(ONEDRIVE_DIR, finalApkName);
  const oneDriveAabPath = resolve(ONEDRIVE_DIR, finalAabName);
  
  spawn("cmd.exe", ["/c", `copy "${APK_SRC}" "${oneDriveApkPath}"`], { detached: true, stdio: "ignore" }).unref();
  spawn("cmd.exe", ["/c", `copy "${AAB_SRC}" "${oneDriveAabPath}"`], { detached: true, stdio: "ignore" }).unref();

  ok("APK and AAB copying initiated in background");
} catch {
  console.warn("⚠ OneDrive copy initiation failed (non-fatal) — continuing");
}

/* ── 7. Git Tag ─────────────────────────────────────────────── */
log(`Creating Git Tag v${newName} (build ${newCode})…`);
const tag = `v${newName}-build${newCode}`;

try {
  run(`git tag ${tag}`, { cwd: root });
  ok(`Git tag ${tag} created`);
} catch (e) {
  console.warn(`⚠ Failed to create tag ${tag} (maybe it already exists?)`);
}

/* ── 8. Commit + push ───────────────────────────────────────────── */
log("Committing version bump and pushing…");
run(`git add android/app/build.gradle client/public/data/app-version.json client/public/data/changelog.json`, {
  cwd: root,
});
run(`git commit -m "chore: release v${newName} (build ${newCode})"`, {
  cwd: root,
});
run("git push --follow-tags", { cwd: root });
ok("Pushed — GitHub Pages deploy triggered");

console.log(
  `\n\x1b[32m🏸 Released v${newName} (build ${newCode}) successfully!\x1b[0m\n`,
);
