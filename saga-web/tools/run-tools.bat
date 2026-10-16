@echo off
REM saga-web 게임 제작 도구 한 곳에서 열기 — 콘텐츠 편집기(8799)·맵 편집기(8800)·사가 엔진(8801) 서버를
REM 각각 새 창으로 띄우고 허브 페이지(index.html)를 연다. 로컬 전용, 게임 서버 아니다.
REM 끝났으면 각 서버 창을 닫으면(Ctrl+C) 된다. 이 창은 그냥 닫아도 된다.
REM 사가 엔진은 별도 저장소(swbins4)로 떼어냈다 — 이 저장소 옆 폴더(..\swbins4)에 받아 두었을 때만 같이 켠다.
REM 그때 다섯 판 assets 를 에셋 묶음으로 붙여(SAGA_ENGINE_LIBS) 편집기 서랍에 다섯 판 모델도 뜨게 한다.
cd /d "%~dp0"
start "content-editor :8799" cmd /k "cd /d "%~dp0content-editor" && node server.js"
start "map-editor :8800" cmd /k "cd /d "%~dp0map-editor" && node server.js"
start "ops :8802" cmd /k "cd /d "%~dp0ops" && node ops.mjs"
set "ENGINE=%~dp0..\..\..\swbins4"
if exist "%ENGINE%\server.js" (
  set "SAGA_ENGINE_LIBS=saga-go=%~dp0..\saga-go\assets;saga-forest=%~dp0..\saga-forest\assets;saga-story=%~dp0..\saga-story\assets;saga-realm=%~dp0..\saga-realm\assets;saga-dungeon=%~dp0..\saga-dungeon\assets"
  start "engine :8801" cmd /k "cd /d "%ENGINE%" && node server.js"
) else (
  echo 사가 엔진 swbins4 가 저장소 옆에 없어 건너뛴다 — https://github.com/smh8627-jpg/swbins4
)
timeout /t 1 /nobreak >nul
start "" "%~dp0index.html"
