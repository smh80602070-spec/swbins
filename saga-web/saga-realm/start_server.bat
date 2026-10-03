@echo off
REM saga-realm local server
set PORT=8795
cd /d "%~dp0"
node "%~dp0..\tools\serve-game.mjs" %PORT% "%~dp0."
