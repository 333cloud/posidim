$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$baseUrl = "https://raw.githubusercontent.com/333cloud/posidim/main"
$files = @(
    @{ Url = "$baseUrl/app/index.tsx"; OutFile = ".\app\index.tsx" },
    @{ Url = "$baseUrl/package.json"; OutFile = ".\package.json" },
    @{ Url = "$baseUrl/app.json"; OutFile = ".\app.json" },
    @{ Url = "$baseUrl/tsconfig.json"; OutFile = ".\tsconfig.json" },
    @{ Url = "$baseUrl/supabase/next_features.sql"; OutFile = ".\supabase\next_features.sql" }
)

foreach ($file in $files) {
    Write-Host "Downloading $($file.OutFile)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $file.Url -OutFile $file.OutFile
}

Write-Host ""
Write-Host "Installing project dependencies..." -ForegroundColor Cyan
npm.cmd install
if ($LASTEXITCODE -ne 0) {
    throw "npm install failed. Please send me the error text."
}

Write-Host ""
Write-Host "Done! Project files have been updated." -ForegroundColor Green
Write-Host "Next: run supabase\next_features.sql in the Supabase SQL Editor, if you have not already done so."
