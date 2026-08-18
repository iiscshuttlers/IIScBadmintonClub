import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const buildGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
const appVersionJsonPath = path.join(rootDir, 'client', 'public', 'data', 'app-version.json');
const packageJsonPath = path.join(rootDir, 'package.json');

// 1. Read build.gradle to find current versions
let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');

const versionCodeMatch = buildGradleContent.match(/versionCode\s+(\d+)/);
const versionNameMatch = buildGradleContent.match(/versionName\s+"([\d.]+)"/);

if (!versionCodeMatch || !versionNameMatch) {
  console.error('Could not find versionCode or versionName in build.gradle');
  process.exit(1);
}

const currentVersionCode = parseInt(versionCodeMatch[1], 10);
const currentVersionName = parseFloat(versionNameMatch[1]);

// Catch drift before compounding it. build.gradle is the source of truth; if
// app-version.json has fallen behind (e.g. build.gradle was edited by hand),
// say so loudly — a stale app-version.json means the in-app update prompt
// compares against the wrong number and never fires.
try {
  const existingJson = JSON.parse(fs.readFileSync(appVersionJsonPath, 'utf8'));
  if (existingJson.versionCode !== currentVersionCode) {
    console.warn(
      `\n⚠️  Version mismatch before bump:\n` +
      `      build.gradle      versionCode ${currentVersionCode}\n` +
      `      app-version.json  versionCode ${existingJson.versionCode}\n` +
      `    build.gradle wins; app-version.json will be realigned by this bump.\n`
    );
  }
} catch {
  // Missing or unreadable app-version.json is handled later in the script.
}

// 2. Bump versions
//
// The step is configurable so you never have to hand-edit build.gradle to skip
// numbers. Editing it by hand is the one way these files drift apart, because
// app-version.json is what the running app compares against — if it lags behind
// the published build, the update prompt silently never fires.
//
//   npm run bump          → +1   (340 → 341)
//   npm run bump -- 10    → +10  (340 → 350)
//   npm run bump -- --to=350     → set exactly
const arg = process.argv[2];
let newVersionCode;

if (arg && arg.startsWith('--to=')) {
  newVersionCode = parseInt(arg.slice('--to='.length), 10);
  if (!Number.isFinite(newVersionCode)) {
    console.error(`Invalid --to value: ${arg}`);
    process.exit(1);
  }
  if (newVersionCode <= currentVersionCode) {
    console.error(
      `versionCode must increase: current is ${currentVersionCode}, got ${newVersionCode}.\n` +
      `Google Play rejects a build whose versionCode is not higher than the last one.`
    );
    process.exit(1);
  }
} else {
  const step = arg ? parseInt(arg, 10) : 1;
  if (!Number.isFinite(step) || step < 1) {
    console.error(`Invalid step "${arg}" — pass a positive integer, e.g. "npm run bump -- 10".`);
    process.exit(1);
  }
  newVersionCode = currentVersionCode + step;
}

// versionName tracks the code so the two stay recognisable together.
const bumpedBy = newVersionCode - currentVersionCode;
const newVersionName = (currentVersionName + 0.01 * bumpedBy).toFixed(2);

console.log(`Bumping version (step ${bumpedBy})...`);
console.log(`Version Code: ${currentVersionCode} -> ${newVersionCode}`);
console.log(`Version Name: ${currentVersionName.toFixed(2)} -> ${newVersionName}`);

// 3. Update build.gradle
buildGradleContent = buildGradleContent.replace(
  /versionCode\s+\d+/,
  `versionCode ${newVersionCode}`
);
buildGradleContent = buildGradleContent.replace(
  /versionName\s+"[\d.]+"/,
  `versionName "${newVersionName}"`
);
fs.writeFileSync(buildGradlePath, buildGradleContent, 'utf8');

// 4. Update app-version.json
let appVersionContent = fs.readFileSync(appVersionJsonPath, 'utf8');
const appVersionData = JSON.parse(appVersionContent);
appVersionData.versionCode = newVersionCode;
appVersionData.versionName = newVersionName;
fs.writeFileSync(appVersionJsonPath, JSON.stringify(appVersionData, null, 2) + '\n', 'utf8');

// 5. Update package.json
let packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
const packageJsonData = JSON.parse(packageJsonContent);
packageJsonData.version = `${newVersionName}.0`;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonData, null, 2) + '\n', 'utf8');

console.log('✅ Version bumped successfully in build.gradle, app-version.json, and package.json');
