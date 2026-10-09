$tracks = @("internal", "closed", "open", "production")
foreach ($track in $tracks) {
    Write-Host "========================================="
    Write-Host "Bumping version and building for $track..."
    Write-Host "========================================="
    
    npm run bump
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm run bump failed"
        exit 1
    }

    npm run build:aab
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm run build:aab failed"
        exit 1
    }

    $source = "android\app\build\outputs\bundle\release\app-release.aab"
    $dest = "android\app\build\outputs\bundle\release\app-$track.aab"
    
    if (Test-Path $source) {
        Copy-Item $source -Destination $dest -Force
        Write-Host "Saved build to $dest"
    } else {
        Write-Error "Could not find built AAB at $source"
        exit 1
    }
}

Write-Host "All builds completed successfully."
