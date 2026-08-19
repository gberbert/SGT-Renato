# SGT-Renato — deploy hosting + Cloud Functions (v0.1.200+)
# Uso:
#   1. firebase login   (uma vez, se ainda nao autenticou)
#   2. .\deploy.ps1

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

function Find-Npm {
    $candidates = @(
        "C:\Program Files\nodejs\npm.cmd",
        "$env:APPDATA\npm\npm.cmd",
        "$env:ProgramFiles\nodejs\npm.cmd"
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    $cmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

$npm = Find-Npm
if (-not $npm) {
    Write-Host "Node.js/npm nao encontrado." -ForegroundColor Red
    exit 1
}

$firebase = Join-Path $projectRoot "node_modules\.bin\firebase.cmd"
if (-not (Test-Path $firebase)) {
    Write-Host "Instalando firebase-tools..." -ForegroundColor Cyan
    & $npm install
}

Write-Host "Build do frontend..." -ForegroundColor Cyan
& $npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Dependencias das functions..." -ForegroundColor Cyan
Push-Location (Join-Path $projectRoot "functions")
& $npm install
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
Pop-Location

Write-Host "Deploy Firebase (hosting + functions)..." -ForegroundColor Green
# Cursor/VS Code define VSCODE_CWD e quebra resolucao de templates do firebase-tools
if ($env:VSCODE_CWD) { Remove-Item Env:VSCODE_CWD }
& $firebase deploy --only hosting,functions --project sgt-renato
exit $LASTEXITCODE
