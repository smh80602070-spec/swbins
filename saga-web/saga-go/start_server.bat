@echo off
REM yeoksa-go static server for swbinbot hub (no browser popup)
REM run.bat is for manual play (opens browser); this one is for the watchdog.
set PORT=8791
cd /d "%~dp0"
node "%~dp0..\tools\serve-game.mjs" %PORT% "%~dp0."
