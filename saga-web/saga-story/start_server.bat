@echo off
REM yeoksa-side local server
set PORT=8794
cd /d "%~dp0"
node "%~dp0..\tools\serve-game.mjs" %PORT% "%~dp0."
