@echo off
REM deungyong-go local server
set PORT=8791
cd /d "%~dp0"
start "" http://127.0.0.1:%PORT%/index.html
node "%~dp0..\tools\serve-game.mjs" %PORT% "%~dp0."
