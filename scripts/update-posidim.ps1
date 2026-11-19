$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$tempRoot = Join-Path $env:TEMP ("posidim-update-" + [guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tempRoot "main.zip"
$extractPath = Join-Path $tempRoot "extract"
New-Item -ItemType Directory -Path $extractPath -Force | Out-Null

try {
    Write-Host "Downloading the latest ПОСИДИМ source..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://github.com/333cloud/posidim/archive/refs/heads/main.zip" -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force

    $sourceRoot = Join-Path $extractPath "posidim-main"
    if (-not (Test-Path (Join-Path $sourceRoot "package.json"))) {
        throw "The downloaded project archive is incomplete."
    }

    Write-Host "Updating application source, configuration, SQL and documentation..." -ForegroundColor Cyan
    Get-ChildItem -LiteralPath $sourceRoot -Force | Where-Object {
        $_.Name -notin @("node_modules", ".expo", "dist", ".git")
    } | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $projectRoot -Recurse -Force
    }

    Write-Host "Installing locked dependencies..." -ForegroundColor Cyan
    npm.cmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        throw "Dependency installation failed. Check the npm output above."
    }

    Write-Host ""
    Write-Host "ПОСИДИМ has been updated successfully." -ForegroundColor Green
    Write-Host "Start the app with: npx.cmd expo start --web"
}
finally {
    if (Test-Path $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
