@echo off
REM yeoksa-dungeon static server for swbinbot hub (no browser popup)
set PORT=8792
cd /d "%~dp0"
node "%~dp0..\tools\serve-game.mjs" %PORT% "%~dp0."
