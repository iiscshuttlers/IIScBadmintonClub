param(
    [string]$OutDir = ".\backups"
)

# Ensure the backup directory exists
if (-not (Test-Path -Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupFolder = Join-Path $OutDir "backup-$Timestamp"
$StorageFolder = Join-Path $BackupFolder "storage"
$DbFile = Join-Path $BackupFolder "database.sql"
$ZipFile = Join-Path $OutDir "backup-$Timestamp.zip"

Write-Host "Starting Supabase Backup at $Timestamp" -ForegroundColor Cyan

# Create temporary folder
New-Item -ItemType Directory -Path $StorageFolder | Out-Null

Write-Host "`n[1/3] Backing up Database (Schema + Data)..." -ForegroundColor Yellow
# Using --linked to backup the remote database attached to this project
npx supabase db dump -f $DbFile --linked

if ($LASTEXITCODE -ne 0) {
    Write-Host "Database backup failed!" -ForegroundColor Red
    Remove-Item -Recurse -Force $BackupFolder
    exit 1
}
Write-Host "Database backup successful." -ForegroundColor Green


Write-Host "`n[2/3] Backing up Storage Buckets..." -ForegroundColor Yellow
# Note: --experimental is required for storage commands
npx supabase storage cp -r ss:/// $StorageFolder --linked --experimental

if ($LASTEXITCODE -ne 0) {
    Write-Host "Storage backup failed or incomplete!" -ForegroundColor Red
} else {
    Write-Host "Storage backup successful." -ForegroundColor Green
}


Write-Host "`n[3/3] Compressing backup archive..." -ForegroundColor Yellow
Compress-Archive -Path "$BackupFolder\*" -DestinationPath $ZipFile -Force
Write-Host "Backup compressed to: $ZipFile" -ForegroundColor Green


Write-Host "`nCleaning up temporary files..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $BackupFolder

Write-Host "`nBackup Process Complete!" -ForegroundColor Green

# Optional: Keep only the last 90 backups to save space
$RetentionDays = 90
Write-Host "Checking for backups older than $RetentionDays days..." -ForegroundColor DarkGray
Get-ChildItem -Path $OutDir -Filter "*.zip" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } | Remove-Item -Force

# Copy backup to OneDrive
$OneDriveBackupDir = "D:\OneDrive - Indian Institute of Science\GitHub\IIScBadmintonClub\backups"
if (-not (Test-Path -Path $OneDriveBackupDir)) {
    New-Item -ItemType Directory -Path $OneDriveBackupDir -Force | Out-Null
}

Write-Host "`nCopying backup to OneDrive..." -ForegroundColor Yellow
Copy-Item -Path $ZipFile -Destination $OneDriveBackupDir -Force
Write-Host "Copied backup to $OneDriveBackupDir" -ForegroundColor Green

# Clean up old backups in OneDrive as well
Write-Host "Cleaning up old backups in OneDrive..." -ForegroundColor DarkGray
Get-ChildItem -Path $OneDriveBackupDir -Filter "*.zip" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } | Remove-Item -Force

