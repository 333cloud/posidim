$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$baseUrl = "https://raw.githubusercontent.com/333cloud/posidim/main"
$files = @(
    @{ Url = "$baseUrl/app/index.tsx"; OutFile = ".\app\index.tsx" },
    @{ Url = "$baseUrl/package.json"; OutFile = ".\package.json" },
    @{ Url = "$baseUrl/app.json"; OutFile = ".\app.json" },
    @{ Url = "$baseUrl/supabase/next_features.sql"; OutFile = ".\supabase\next_features.sql" }
)

foreach ($file in $files) {
    Write-Host "Скачиваю $($file.OutFile)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $file.Url -OutFile $file.OutFile
}

Write-Host ""
Write-Host "Устанавливаю зависимости проекта..." -ForegroundColor Cyan
npm.cmd install
if ($LASTEXITCODE -ne 0) {
    throw "npm install завершился с ошибкой. Пришли мне текст ошибки."
}

Write-Host ""
Write-Host "Готово! Файлы приложения обновлены." -ForegroundColor Green
Write-Host "Следующий шаг: выполнить supabase\next_features.sql в Supabase SQL Editor, если ещё не выполнял."
