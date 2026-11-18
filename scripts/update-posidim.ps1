$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$baseUrl = "https://raw.githubusercontent.com/333cloud/posidim/main"
$files = @(
    @{ Url = "$baseUrl/app/index.tsx"; OutFile = ".\app\index.tsx" },
    @{ Url = "$baseUrl/package.json"; OutFile = ".\package.json" },
    @{ Url = "$baseUrl/app.json"; OutFile = ".\app.json" },
    @{ Url = "$baseUrl/tsconfig.json"; OutFile = ".\tsconfig.json" }
)

foreach ($file in $files) {
    $directory = Split-Path -Parent $file.OutFile
    if ($directory -and -not (Test-Path $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    Write-Host "Downloading $($file.OutFile)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $file.Url -OutFile $file.OutFile
    if (-not (Test-Path $file.OutFile)) {
        throw "Download failed: $($file.OutFile)"
    }
}

Write-Host ""
Write-Host "Installing project dependencies..." -ForegroundColor Cyan
npm.cmd install
if ($LASTEXITCODE -ne 0) {
    throw "npm install failed. Check the error output above."
}

Write-Host ""
Write-Host "Update completed successfully." -ForegroundColor Green
Write-Host "Start the app with: npx.cmd expo start --web"
