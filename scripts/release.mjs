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

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Add GitHub CLI to PATH in case the terminal hasn't picked it up yet
process.env.PATH = `${process.env.PATH};C:\\Program Files\\GitHub CLI`;

const JAVA_HOME = 'C:\\Program Files\\Microsoft\\jdk-21.0.11.10-hotspot';
const APK_SRC   = resolve(root, 'android/app/build/outputs/apk/release/app-release.apk');
const APK_COPY  = 'D:\\OneDrive - Indian Institute of Science\\Temp_apk\\IIScShuttlers.apk';
const REPO      = 'iiscshuttlers/iiscshuttlers';

const run = (cmd, opts = {}) =>
  execSync(cmd, { stdio: 'inherit', ...opts });

/* ── helpers ────────────────────────────────────────────────────── */
function log(msg)  { console.log(`\n\x1b[36m▶ ${msg}\x1b[0m`); }
function ok(msg)   { console.log(`\x1b[32m✔ ${msg}\x1b[0m`); }
function fail(msg) { console.error(`\x1b[31m✖ ${msg}\x1b[0m`); process.exit(1); }

function bumpVersion(name) {
  const parts = name.split('.');
  parts[parts.length - 1] = String(parseInt(parts[parts.length - 1]) + 1);
  return parts.join('.');
}

/* ── 0. Check gh auth ───────────────────────────────────────────── */
log('Checking GitHub CLI auth…');
try {
  execSync('gh auth status', { stdio: 'pipe' });
  ok('GitHub CLI authenticated');
} catch {
  fail('Not logged into GitHub CLI. Run: gh auth login');
}

/* ── 1. Bump version in build.gradle ────────────────────────────── */
log('Bumping Android version…');
const gradlePath = resolve(root, 'android/app/build.gradle');
let gradle = readFileSync(gradlePath, 'utf8');

const codeMatch = gradle.match(/versionCode (\d+)/);
const nameMatch = gradle.match(/versionName "([^"]+)"/);
if (!codeMatch || !nameMatch) fail('Could not parse versionCode/versionName from build.gradle');

// Check if a previous run already bumped but didn't commit (retry-safe)
const dirtyFiles = execSync('git status --porcelain', { cwd: root }).toString();
const alreadyBumped = dirtyFiles.includes('android/app/build.gradle');

let oldCode, oldName, newCode, newName;
if (alreadyBumped) {
  newCode = parseInt(codeMatch[1]);
  newName = nameMatch[1];
  const prevCode = newCode - 1;
  console.log(`  ↩ Previous bump detected — retrying v${newName} (build ${newCode})`);
  oldCode = prevCode; oldName = newName;
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

/* ── 2. Update app-version.json ─────────────────────────────────── */
log('Updating app-version.json…');
const changelog = process.argv[2] || `Version ${newName}`;
const versionJsonPath = resolve(root, 'client/public/data/app-version.json');
writeFileSync(versionJsonPath, JSON.stringify({
  versionCode: newCode,
  versionName: newName,
  downloadUrl: `https://github.com/${REPO}/releases/latest/download/IIScShuttlers.apk`,
  changelog,
}, null, 2) + '\n');
ok('app-version.json updated');

/* ── 3. Vite build ──────────────────────────────────────────────── */
log('Building web app (vite build)…');
run('vite build', { cwd: root });

/* ── 4. Capacitor sync ──────────────────────────────────────────── */
log('Syncing Capacitor…');
run('npx cap sync android', { cwd: root });

/* ── 5. Build release APK ───────────────────────────────────────── */
log('Building release APK…');
run('gradlew assembleRelease', {
  cwd: resolve(root, 'android'),
  env: { ...process.env, JAVA_HOME },
  shell: true,
});

/* ── 6. Copy APK to OneDrive ────────────────────────────────────── */
log('Copying APK to OneDrive…');
try {
  run(`copy "${APK_SRC}" "${APK_COPY}"`, { shell: true });
  ok('APK copied to OneDrive');
} catch {
  console.warn('⚠ OneDrive copy failed (non-fatal) — continuing');
}

/* ── 7. GitHub Release ──────────────────────────────────────────── */
log(`Creating GitHub Release v${newName} (build ${newCode})…`);
const tag = `v${newName}-build${newCode}`;

// Delete tag/release if it somehow already exists
try { execSync(`gh release delete ${tag} --repo ${REPO} --yes`, { stdio: 'pipe' }); } catch {}
try { execSync(`gh api repos/${REPO}/git/refs/tags/${tag} -X DELETE`, { stdio: 'pipe' }); } catch {}

run(
  `gh release create ${tag} "${APK_SRC}#IIScShuttlers.apk" ` +
  `--repo ${REPO} ` +
  `--title "v${newName}" ` +
  `--notes "${changelog.replace(/"/g, "'")}" ` +
  `--latest`
);
ok(`GitHub Release v${newName} published`);

/* ── 8. Commit + push ───────────────────────────────────────────── */
log('Committing version bump and pushing…');
run(`git add android/app/build.gradle client/public/data/app-version.json`, { cwd: root });
run(`git commit -m "chore: release v${newName} (build ${newCode})"`, { cwd: root });
run('git push', { cwd: root });
ok('Pushed — GitHub Pages deploy triggered');

console.log(`\n\x1b[32m🏸 Released v${newName} (build ${newCode}) successfully!\x1b[0m\n`);
