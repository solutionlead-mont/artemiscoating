@echo off
title Artemis - site local + enregistrement des tarifs
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js n'est pas installe ou n'est pas dans le PATH.
  echo Installez-le depuis https://nodejs.org puis relancez ce fichier.
  echo.
  pause
  exit /b 1
)

echo.
echo Demarrage du site local...
echo Ouvrez ensuite : http://127.0.0.1:8090/
echo Laissez cette fenetre ouverte pendant que vous modifiez les prix.
echo.
node "%~dp0serveur-enregistrement.js"

echo.
echo Le serveur est arrete.
pause
