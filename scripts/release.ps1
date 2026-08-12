$ErrorActionPreference = "Stop"

Write-Host "Starting Full Deployment Pipeline..." -ForegroundColor Cyan

Write-Host "`n[1/6] Checking for TypeScript errors..." -ForegroundColor Yellow
npm run check
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Type check failed! Please fix the errors before releasing." -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/6] Building Web Application..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Web build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n[3/6] Bumping Versions..." -ForegroundColor Yellow
node scripts/bump-version.js

Write-Host "`n[4/6] Syncing and Building Android APK and AAB..." -ForegroundColor Yellow
npx cap sync android
Set-Location android
.\gradlew.bat assembleRelease bundleRelease
Set-Location ..

Write-Host "`n[5/6] Copying artifacts to OneDrive..." -ForegroundColor Yellow
$apkSource = "android\app\build\outputs\apk\release\app-release.apk"
$aabSource = "android\app\build\outputs\bundle\release\app-release.aab"
$onedriveApkDir = "D:\OneDrive - Indian Institute of Science\WebsiteApps\Apps\IIScBadmintonClub\apk"
$onedriveAabDir = "D:\OneDrive - Indian Institute of Science\WebsiteApps\Apps\IIScBadmintonClub\aab"

if (!(Test-Path $onedriveApkDir)) { New-Item -ItemType Directory -Force -Path $onedriveApkDir }
if (!(Test-Path $onedriveAabDir)) { New-Item -ItemType Directory -Force -Path $onedriveAabDir }

$version = (Get-Content package.json | ConvertFrom-Json).version

Copy-Item -Path $apkSource -Destination "$onedriveApkDir\IIScShuttlers_v$version.apk" -Force
Copy-Item -Path $aabSource -Destination "$onedriveAabDir\IIScShuttlers_v$version.aab" -Force
Write-Host "Copied to OneDrive successfully." -ForegroundColor Green

Write-Host "`n[6/6] Pushing to GitHub..." -ForegroundColor Yellow
git add -A
git commit -m "chore: release v$version (auto-deployed)"
git push origin HEAD

Write-Host "`nDeployment Pipeline Completed Successfully!" -ForegroundColor Green
