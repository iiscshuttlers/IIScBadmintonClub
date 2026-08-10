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

// 2. Bump versions
const newVersionCode = currentVersionCode + 1;
const newVersionName = (currentVersionName + 0.01).toFixed(2);

console.log(`Bumping version...`);
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
