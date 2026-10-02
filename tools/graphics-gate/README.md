# graphics-gate — 그래픽 게이트 공통 도구 (SAGA-ARCH §4.5, K-0012)

기준 촬영(사용자 승인 PNG)과 새 촬영을 SSIM·히스토그램 숫자로 비교한다. 세 트랙(godot·web·unity)이 같은 규격 폴더를 쓴다.
**촬영은 사용자가 "기준 촬영"·"그래픽 확인"을 요청한 세션에서만** 한다(루트 CLAUDE.md). 이 도구는 이미 찍힌 PNG 만 비교한다.
계산은 `saga-godot/tools/shot_diff.mjs`(G-0009)를 그대로 쓴다 — 이 폴더는 그것을 감쌀 뿐이다. node 만 필요(의존 0).

## 폴더 규격

| | 기준(사용자 승인) | 새 촬영(git 제외) |
|---|---|---|
| godot | `saga-godot/graphics/baseline/<판>/` | `graphics/latest/godot/<판>/` |
| web | `graphics/baseline/web/<판>/` | `graphics/latest/web/<판>/` |
| unity | `graphics/baseline/unity/<판>/` | `graphics/latest/unity/<판>/` |

판 = `go`·`dungeon`·`forest`·`story`·`realm`. 파일 이름 `<장면>.png` 또는 `<장면>_<W>x<H>.png`(이름 앞부분으로 짝짓는다). 해상도가 다르면 종료 2.

## 쓰는 법

```bash
node tools/graphics-gate/diff.mjs --selftest                   # 도구 점검(합성 PNG, 게임 안 띄움)
node tools/graphics-gate/diff.mjs --all                        # 기준이 있는 칸만 비교, 없으면 "건너뜀"(실패 아님)
node tools/graphics-gate/diff.mjs --track godot --game go      # 한 칸
node tools/graphics-gate/diff.mjs --collect web go <원본폴더>  # 찍어 둔 PNG 를 latest 로 모음(_<W>x<H> 를 붙임)
```

끝 줄 `GFX_GATE fails=N cuts=M skipped=K`. 종료 0 통과 · 1 문턱 초과(ssim < 0.90 또는 hist > 0.15, `--ssim=`·`--hist=` 로 바꿈) · 2 인자·해상도 오류.
FAIL 컷이 있으면 `tasks/sheets/gfx-<날짜>.md` 에 "사용자 판정 대기" 표가 생긴다(`--no-sheet` 로 끔). 의도한 변화면 ○ → 사용자가 새 PNG 를 기준으로 교체한다.

## 촬영 명령 (사용자 요청 때만)

- **godot**: `GODOT=<콘솔 exe> bash saga-godot/tools/shot_baseline.sh <출력 절대 폴더>` → GO 네 컷. 그 PNG 를 `--collect godot go <폴더>` 로 모은다.
- **web**: `saga-web/tools/playcheck/` 의 시나리오(`node <스크립트>.mjs shot`)가 `playcheck/shots/` 에 PNG 를 만든다(1280×720) → `--collect web <판> saga-web/tools/playcheck/shots`.
- **unity**: **배치 촬영 명령이 아직 없다**(`Assets/Editor/Playtest*Gui.cs` 는 점검용). 폴더 규격만 잡아 두었고, 촬영 도구는 별도 U 티켓이 필요하다.

## 첫 기준 만들기

1. 사용자가 새 촬영 PNG 를 눈으로 보고 승인한다(소넷은 그림을 못 본다 — ARCH §4.5).
2. 승인한 PNG 만 위 "기준" 폴더에 복사해 커밋한다. 같은 장면을 두 번 찍어 보고 문턱(기본 0.90/0.15)이 흔들리지 않는지 확인한다.
3. 이후 렌더·재질·조명·모델을 건드린 티켓은 촬영 → `--collect` → `--all` 을 검증 칸에 넣는다.
