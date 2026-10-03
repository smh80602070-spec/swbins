@echo off
REM yeoksa-village local server
set PORT=8793
cd /d "%~dp0"
node "%~dp0..\tools\serve-game.mjs" %PORT% "%~dp0."
