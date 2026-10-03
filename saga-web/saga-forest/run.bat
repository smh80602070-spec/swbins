@echo off
REM yeoksa-village local server
set PORT=8793
cd /d "%~dp0"
start "" http://127.0.0.1:%PORT%/index.html
node "%~dp0..\tools\serve-game.mjs" %PORT% "%~dp0."
