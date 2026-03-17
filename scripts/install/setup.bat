@echo off
echo === Installation Krootal Review (Windows .BAT) ===

set SCRIPT=%~dp0generate_krootal.ps1

if not exist "%SCRIPT%" (
    echo ERREUR : generate_krootal.ps1 introuvable dans /scripts/install/
    exit /b 1
)

echo Execution du script PowerShell...
powershell -ExecutionPolicy Bypass -File "%SCRIPT%"

if %errorlevel% neq 0 (
    echo ERREUR durant l'execution du script.
    exit /b 1
)

echo Installation terminee !
exit /b 0
