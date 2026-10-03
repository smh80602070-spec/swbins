@echo off
REM yeoksa-dungeon local server (opens browser)
set PORT=8792
cd /d "%~dp0"
start "" http://127.0.0.1:%PORT%/index.html
node "%~dp0..\tools\serve-game.mjs" %PORT% "%~dp0."
