# scripts/install/setup.ps1
Write-Host "=== Installation Krootal Review (PowerShell) ===" -ForegroundColor Cyan

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $root "generate_krootal.ps1"

if (!(Test-Path $script)) {
    Write-Host "ERREUR : generate_krootal.ps1 introuvable dans /scripts/install/" -ForegroundColor Red
    exit 1
}

Write-Host "Exécution du script generate_krootal.ps1..." -ForegroundColor Yellow

try {
    powershell -ExecutionPolicy Bypass -File $script
    Write-Host "generate_krootal.ps1 exécuté avec succès." -ForegroundColor Green
}
catch {
    Write-Host "ERREUR durant l'exécution : $_" -ForegroundColor Red
    exit 1
}

Write-Host "Installation complète !" -ForegroundColor Green
