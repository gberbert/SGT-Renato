# SGT-Renato — subir ambiente local
# Clique com botao direito > "Executar com PowerShell" ou rode no terminal:
#   cd C:\Users\rhonorin\Documents\SGT-Renato
#   .\start-local.ps1

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
    Write-Host ""
    Write-Host "Node.js/npm nao encontrado." -ForegroundColor Red
    Write-Host ""
    Write-Host "Instale uma vez (PowerShell como administrador):" -ForegroundColor Yellow
    Write-Host '  winget install OpenJS.NodeJS.LTS' -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Depois FECHE e REABRA o terminal e rode este script de novo." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 1
}

if (-not (Test-Path ".env.local")) {
    Write-Host "Arquivo .env.local nao encontrado." -ForegroundColor Red
    Write-Host "Copie .env.local.example para .env.local (se existir) ou peca ajuda ao time." -ForegroundColor Yellow
    exit 1
}

Write-Host "Instalando dependencias (primeira vez pode demorar)..." -ForegroundColor Cyan
& $npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Iniciando servidor local..." -ForegroundColor Green
Write-Host "Quando aparecer 'Local: http://localhost:5173', o navegador abrira sozinho." -ForegroundColor Green
Write-Host "Para parar: Ctrl+C neste terminal." -ForegroundColor Gray
Write-Host ""

& $npm run dev -- --open
