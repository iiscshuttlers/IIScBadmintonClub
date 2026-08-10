$OneDriveFolder = "D:\OneDrive - Indian Institute of Science\WebsiteApps\Apps\IIScBadmintonClub"

Write-Host "Checking OneDrive directory..." -ForegroundColor Cyan
if (-not (Test-Path $OneDriveFolder)) {
    New-Item -ItemType Directory -Path $OneDriveFolder | Out-Null
    Write-Host "Created folder: $OneDriveFolder" -ForegroundColor Green
}

Write-Host "`n[1/3] Building APK (Debug)..." -ForegroundColor Yellow
npm run build:apk
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error building APK!" -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/3] Building AAB (Release)..." -ForegroundColor Yellow
npm run build:aab
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error building AAB!" -ForegroundColor Red
    exit 1
}

Write-Host "`n[3/3] Copying builds to OneDrive..." -ForegroundColor Yellow

# Get version from package.json
$PackageJson = Get-Content "package.json" | ConvertFrom-Json
$AppVersion = $PackageJson.version
$BaseName = "IIScShuttlers-v$AppVersion"

$ApkFolder = Join-Path $OneDriveFolder "apk"
$AabFolder = Join-Path $OneDriveFolder "aab"

if (-not (Test-Path $ApkFolder)) { New-Item -ItemType Directory -Path $ApkFolder | Out-Null }
if (-not (Test-Path $AabFolder)) { New-Item -ItemType Directory -Path $AabFolder | Out-Null }

$ApkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
$AabPath = "android\app\build\outputs\bundle\release\app-release.aab"

if (Test-Path $ApkPath) {
    $ApkDest = Join-Path $ApkFolder "$BaseName.apk"
    Copy-Item $ApkPath -Destination $ApkDest -Force
    Write-Host "Copied APK to $ApkDest" -ForegroundColor Green
} else {
    Write-Host "Could not find APK at $ApkPath" -ForegroundColor Red
}

if (Test-Path $AabPath) {
    $AabDest = Join-Path $AabFolder "$BaseName.aab"
    Copy-Item $AabPath -Destination $AabDest -Force
    Write-Host "Copied AAB to $AabDest" -ForegroundColor Green
} else {
    Write-Host "Could not find AAB at $AabPath" -ForegroundColor Red
}

Write-Host "`nAll done!" -ForegroundColor Cyan
