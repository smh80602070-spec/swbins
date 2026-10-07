# 도구 목록 — 저장소 전체(웹 다섯 판 · saga-godot · saga-unity)

도구마다 자세한 사용법은 그 폴더 README·파일 머리 주석이 정본이다. 여기는 **어디에 무엇이 있나**만 적는다.
게임 서버가 아닌 로컬 도구들이다. 커밋·푸시는 하지 않는다(precheck 만 커밋 훅이 부른다).

## 게임 만들기

| 도구 | 하는 일 | 여는 법 |
|---|---|---|
| `saga-web/tools/content-editor/` | 도감(`data.js` HEROES·PETS·BIOS)을 다섯 판에 함께 반영 · 판별 `data-*.js` 표 88개 항목 편집 · 3D 자산 재할당·업로드(OBJ+MTL+텍스처도 GLB 로 자동 변환) · 실명 가드 · sw.js 자동 올림 · ▶ 실행 창 · **대사·퀘스트 편집기**(`story.html` — 다섯 판 퀘스트·대사·문답 표 15개를 칸으로, 바뀐 값 자리만 저장) | `run-editor.bat` → :8799 |
| `saga-web/tools/map-editor/` | 어댑터 구조 — 사가만리 `land.js` 글자 지도(칠하기·명소 옮기기) · 사가천하 `data-city.js` 성 135(끌기·길 잇기/끊기·지형 칠하기) · 사가종횡 `data-side.js` 사냥터 11(발판·줄·문·사람·채집) · **3D 배치**(사가만리 `land.js` `deco` — 게임 js 로 그린 3D 뷰포트·이동/회전/크기 기즈모·되돌리기) · **사가나락 마을**(`town.js` 손 마을 넷의 장식·사람·표식 — 끌기·자동 장식·게임에서 설 자리 겹쳐 보기). 검사는 그 판 게임 데이터·진단 그대로 · ▶ 실행 창 | `run-map-editor.bat` → :8800 |
| `saga-web/tools/new-game/` | 여섯 번째 웹 판 뼈대(바로 도는 최소 놀이·세이브·sw.js·진단 8항목·문서 3층) + `register.mjs`(CLAUDE.md 표·precheck·asset-audit·content-editor GAMES 자동 등록, 멱등) | `node new-game.mjs --folder saga-xxx --title .. --port ..` |
| 사가 엔진 → **별도 저장소 [swbins4](https://github.com/smh8627-jpg/swbins4)** | 코드 없이 3D 게임을 만드는 범용 편집기+실행기. 2026-09-25 이 저장소(`saga-web/tools/engine/`)에서 떼어냈다 — 실명 가드·three·Quaternius CC0 모델 묶음을 안에 들였고 다섯 판과 코드 공유 없음. 사용법·진단은 그 저장소 README | 이 저장소 옆(`..\swbins4`)에 받아 두면 `saga-web/tools/run-tools.bat` 이 :8801 로 같이 켠다(다섯 판 assets 를 에셋 묶음으로 붙여서) |
| `tools/scene-layout/` | 글자 지도 → 배치표(JSON) → Godot `.tscn`(걷기 래퍼 `LayoutWalk.tscn` 로 실제 이동·명소 판정까지) / Unity `.unity` 조립(트랙별 스크립트) | README 의 두 단계 명령 |

웹 편집기 셋(콘텐츠 편집기·맵 편집기·사가 엔진 — 엔진은 옆 저장소 swbins4 가 있을 때)을 한 번에 켜고 상태를 보는 허브: `saga-web/tools/run-tools.bat` → `index.html`.
두 편집기 모두 위 줄 **▶ 실행**(F5)으로 게임을 편집기 안 오른쪽 창에 띄운다(연습용 세이브, `saga-web/tools/lib/gameserve.js`·`play-panel.js`).

## 에셋 만들기·다듬기

| 도구 | 하는 일 |
|---|---|
| `tools/asset-forge/` | 파이썬 절차 생성 — `palette`(팔레트 스냅) · `kitbash`(부품 조립) · `procgen`(바위·나무·소품) · `tilegen`(시임리스 타일) · `spritegen`(아이콘) · `sfxgen`(효과음) · `vroid_face_bake_project`(VRoid 얼굴 재베이크) |
| `tools/glb-compress/` | `compress.mjs` Meshopt+WebP 압축(처리 기록 manifest) · `vrm-slim.mjs` VRM 모프 떼기 · `seam-simplify.mjs` 사진측량 UV 조각 모델 줄이기 · `join-parts.mjs` 부품 따로인 GLB 를 재질별 한 덩이로(그리기 호출 줄이기) |
| `tools/obj-split/` | OBJ 쪼개기 |
| `saga-unity/tools/dedupe_forge_textures.py` | 공방 몸 텍스처 중복 합치기 — 내용·가져오기 설정이 같은 그림을 하나로(화질 변화 0, 드라이런 기본, Unity 끄고, `--apply`) |
| `tools/mixamo_automation/` | Mixamo 모션 받기(`fetch.mjs --dest`) — 원본은 로컬 전용(.gitignore) |
| `tools/char-forge/` | 자체 인물 공방(Blender 헤드리스 + CC0) — 레시피 → `.glb`/`.fbx`(`build.py`)·파일 검증(`verify.py`)·팩 받기(`fetch_sources.py`)·기존 뼈대에 동작 굽기(`bake_for_rig.py`)·**VRoid 주역 들이기 `vroid_intake.sh <vrm> <id>`** |
| `tools/world-forge/` | 파이썬+Blender 헤드리스 지형·지물·건물·탈것 에셋 만들기(트랙별 결과 한 레시피에서) — 3D 세계 자산 |
| `tools/ai-art/` | 로컬 ComfyUI(swbins3, Z-Image·Illustrious·Animagine, 상업 허용)로 초상·배경·바닥 타일·무늬 그림 만들기 — `gen.py` 배치 + `.license.json`, 2D 모드 배경 층 분리·이음매 타일 포함 |
| `saga-web/tools/playcheck/` | 웹 판을 헤드리스 크롬(CDP)으로 실제 조작해 보는 플레이 점검 |
| `saga-web/tools/bake-portraits/` | 도감·카드 초상을 webp 로 미리 굽기 |
| `saga-web/saga-go/tools/bake-icons/` | 짐승·건물 2D 지도 아이콘 굽기 |
| `saga-godot/tools/mixamo_retarget.gd` | (옛) Mixamo 모션 → VRM 뼈대 리타겟 — 이제 어느 씬도 결과를 안 부른다 |
| `saga-godot/tools/ual_lib_build.gd` | char-forge 가 VRoid 뼈대에 구운 CC0 동작 .glb → `anim_cc0/*_lib.res` (월드 기준 변환·자체 확인) · 점검 `probe_anim_cc0.gd` |

## 점검·검증

| 도구 | 하는 일 |
|---|---|
| `tools/precheck.sh` | 커밋 전 점검(커밋 훅이 자동 실행) — js 구문 · 도감 md5 · sw.js 버전 · **바뀐 에셋 🔴** · 문서 크기(CLAUDE 6KB·PLAN·ARCH·BACKLOG·STATE 8KB·티켓 4KB, Godot·Unity PLAN·char-forge README 는 WARN) · `features.json` 스키마 · **js/gd/cs 1,500줄 새로 넘김**(기존 큰 파일 목록 `tools/big-files.txt` 보다 늘어도 FAIL) · 진단 수 감소 WARN(`tools/_out/testcount.json`) · Godot 참조 방향(`check_refs.sh`) · `--full` 이면 웹 진단 러너까지 |
| `tools/qc.mjs` | **QC 한 명령**(10-07) — 번들·shared 사본·진단 러너·재미표준 8 측정·2D/3D 촬영(pw)·완성도·게이트, `--branch godot` 은 probe_all·`tools` 는 에셋 감사·`--full` 은 3회 DIFF. 결과 `tools/_out/qc-last.md`(+`qc/<일시>.md`, 이전과 비교, **Claude 눈 판정 PNG 목록**). autorun 이 티켓 뒤 자동, 대화 세션은 Stop 훅 `qc-guard`(claude-home) 가 "실기 확인 대기" 를 막고 돌리게 한다 |
| `tools/build-parts.mjs` | 큰 js 를 소스 조각으로 나눠 두고 이어 붙여 실행 파일을 만든다(TARGETS 19개 — 사가만리 world3d·story·field-combat·world·ui, 사가나락 dungeon·dungeon3d·dungeon-view·ui, 사가마을 village·village-view·village-view3d·ui, 사가종횡 side·ui, 사가천하 ui-rtk·realm3d·war·rtk 등. `src/<이름>/NN.js` → `js/<이름>.js`, 바이트 동일. 도구가 직접 고치는 `town.js`·판별 `asset3d.js` 는 제외). 조각을 고치면 이걸 돌리고, `--check` 는 비교만(precheck 가 부름) |
| `tools/gen-index.mjs` | 판별 `js/manifest.json`(index·test 의 `<script src>` 연속 줄 묶음)과 `index.html`·`_test.html` 을 맞춘다 — 기본은 html 다시 쓰기, `--check` 는 비교만(precheck 가 부름), 새 js 는 `--add <판> <js> --after <앞.js>` 한 줄(sw.js SHELL·VERSION 은 직접) |
| `tools/sync-shared.mjs` | `saga-web/shared/`(정본: `net.js`·`anim-own.js`·`vroid-variant.js`·`build/build-single.mjs`)를 다섯 판에 복사 · `--check` 는 md5 비교만(precheck 가 부름). 정본을 고치면 이걸 돌리고 다섯 판 sw.js VERSION 을 올린다 |
| `tools/status.mjs` | 웹 다섯 판 `features.json`·러너 결과로 판별 완성도(D3+÷전체)·D0/D1·WIP 초과·1,500줄 넘는 js 를 표로 — `saga-web/STATE.md` 와 README "현재" 표 블록을 덮어쓴다. `--big`(큰 파일만) · `--json` · `--sheet <판>`(사람 확인 시트 → `tasks/sheets/`) |
| `tools/test-web.mjs` | 웹 판 `_test.html` 헤드리스 러너 — 빈 포트 서버 + 전용 프로필 크롬으로 `RESULT n/m`·실패 이름을 찍고 종료 코드 0/1. `node tools/test-web.mjs [판…] [--runs=N] [--budget=ms]` · 결과 `tools/_out/test-web.json` · `precheck.sh --full` 이 다섯 판 전부 돌린다 |
| `tools/asset-audit/` | 세 트랙 에셋 점검 — 공개 유출 · 압축 디코더 누락 · 용량 · .meta/.import 짝 · 폰 예산 · 출처 문서 · 미참조 · 사본. `--quick` 은 바뀐 것만 |
| `tools/asset-place/` | 에셋 배치 - 정본 `saga-assets/` 한 곳에서 웹·Godot·Unity 폴더로 배포하고 같은지 검사(`place.py --check`·`--write`, 표 `asset-place.json`). 웹·고돗·유니티 갈래는 에셋을 안 고친다(K-0019) |
| `tools/claude-home/` | 좀비 청소기 — 부모 죽은 bash·git·serena·헤드리스 크롬 묶음만 끔(일반 node·Unity·Godot 품은 묶음은 보존), 세션 시작·턴 끝(10분 간격) 훅. PC마다 `node tools/claude-home/install.js`(되돌리기 `--uninstall`), 기록 `~/.claude/reap-orphans.log`(끈 것)·`reap-orphans.last`(마지막으로 돈 시각). 훅이 WMI(cscript `reap-launch.wsf`)로 띄운다 — 그냥 detached 로 띄우면 훅과 함께 죽는다. 끄는 건 이름난 단명 보조(statusline·rtk hook 등)·MCP·30분 넘은 헤드리스 크롬·한 번도 실행 못 한 일시정지 고아뿐 — 부모 죽은 bash 라도 남의 백그라운드 작업일 수 있어 안 끈다. 시험: `reap-orphans.ps1 -DryRun` |
| `tools/hooks/` | `gate.js` 훅 게이트(세션 절차·커밋 전 precheck·PLAN 날짜 기록 막기) · 티켓 6144B 초과 막기 · `syntax-check.js` js 구문 한꺼번에 |
| `saga-web/tools/mobile-layout/` | 폰 배치 점검 — 다섯 판을 헤드리스 크롬 모바일 에뮬레이션(세로·가로)으로 띄워 화면 밖·닿지 않음·가림·겹침·터치 40px·글자 11px 을 **숫자로**(스크린샷 없음), 첫 화면·첫 창·시트 전부. `node probe.js` → `MLAYOUT 합계 0건` |
| `saga-godot/tools/godot_regress.sh` | 다섯 대표 씬 헤드리스 3회 회귀(로그 md5·error/warn 0) |
| `saga-unity/tools/unity-batch.sh` | Unity 배치 실행 + 설치 버전 부작용 4파일 원복 — **다른 세션이 saga-unity 를 고치는 중이면 쓰지 않는다**(Packages 파일을 되돌린다) |
| 각 판 `_test.html` · `_admin.html` · `_demo.html` | 진단(RESULT n/n) · 세이브·균형 손잡이 · 장면 데모 |
