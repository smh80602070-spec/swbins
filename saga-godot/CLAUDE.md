# saga-godot

다섯 게임을 Godot 4.x 3D 로 재구축하는 **완전히 새 프로젝트**. 정본은 이 폴더 `PLAN.md`.
`saga-web/*`(웹 판)·`saga-unity/`(병행 트랙)는 건드리지 않는다.

- 현재 상태 `docs/PROJECT_STATE.md`(≤15KB, 세션 끝에 **덮어쓴다**) · 세션 이력 `archive/godot/HISTORY.md`(600KB+, 보관·**grep 으로만**) · 구조 `docs/ARCHITECTURE.md` · 실기 조작법 `docs/HOW_TO_PLAYTEST.md`
- **`PLAN.md`(장은 `# N.` H1)·`archive/godot/` 의 `HISTORY.md`·`VERTICAL_SLICE_*.md` 는 통째로 읽지 않는다.** 목차 grep 후 필요한 장·날짜만 `sed -n` 으로 읽는다. PLAN 0장(읽는 법)부터.
- 세션 기록은 티켓 메모·커밋 메시지에 남긴다(`archive/godot/HISTORY.md` 는 append 하지 않는다). `PLAN.md` 는 결정이 바뀔 때만 고치고 날짜 세션 기록을 넣지 않는다. 상위 문서 `../SAGA-DESIGN.md`.
- 사용자가 실기 테스트 방법을 물으면 `HOW_TO_PLAYTEST.md` 를 가리키고, 새 입력 액션이 생기면 거기에 반영한다.

## Godot 실행 파일 — PC 마다 다르다

이 저장소는 여러 PC 에서 돈다. `PROJECT_STATE.md` 의 "설치 완료" 기록은 그 PC 얘기다. 새 세션은 먼저 확인한다:

```bash
which godot godot4 2>&1
find "$LOCALAPPDATA/Microsoft/WinGet/Packages" -iname "*godot*.exe" 2>/dev/null
```

없으면 winget 에 기대지 말고 GitHub 릴리스에서 표준판(non-Mono, C# 안 씀) 64비트 zip 을 스크래치패드에 받아 푼다.
버전은 `project.godot` 의 `config/features` 태그("4.7")와 맞춘다. 헤드리스 검증엔 `_console` exe 를 쓴다.

```bash
curl -sSL -o Godot.zip "https://github.com/godotengine/godot/releases/download/<TAG>-stable/Godot_v<TAG>-stable_win64.exe.zip"
unzip -o -q Godot.zip
```

- 받은 exe 는 **커밋하지 않는다**(`.gitignore` 대상이 아니어도 add 금지).
- Bash 로 받은 파일이 PowerShell 에서 안 보이면 격리를 의심하기 전에 PowerShell(`Invoke-WebRequest`·`Expand-Archive`)로 그 자리에서 다시 받는다.

## 검증

`project.godot`·씬 파일을 텍스트로 고친 뒤엔 헤드리스 로드까지 통과해야 확정으로 본다:

```bash
GODOT=<받은 폴더>/Godot_v<TAG>-stable_win64_console.exe
"$GODOT" --headless --editor --path <프로젝트 경로> --quit            # 최초 1회: 임포트·문법
"$GODOT" --headless --path <프로젝트 경로> --quit-after 3 --verbose > log.txt 2>&1
grep -iE "error|warn|missing|invalid|cannot" log.txt
```

- **`--headless --editor --quit` 는 `project.godot`·`*.import` 를 조용히 고쳐 쓴다**(기본값과 같은 명시 설정을 지운다 — 렌더러 프로파일 줄이 실제로 사라진 적 있다).
  검증 뒤 커밋 전에 반드시 `git diff -- project.godot '*.import'` 를 훑고, 의도치 않은 변경은 `git checkout` 으로 되돌린 뒤 고친 파일만 add 한다.
- `--headless` 는 더미 렌더러다. 파싱·참조 깨짐은 잡지만 **실제 화면에 뭘 그리는지는 확인 안 된다.**

## GUI 화면 확인

- **개발 중 습관적으로 GUI 를 띄워 스크린샷을 찍지 않는다**(루트 CLAUDE.md 와 같은 원칙). 기능을 다 완성한 뒤 사용자가 직접 보거나, 명시적으로 요청할 때만.
- 요청받아 찍을 때는 windowed exe(`_console` 아닌 쪽)를 `Start-Process -PassThru` 로 띄우고 `System.Drawing` `CopyFromScreen` 으로 PNG 저장 후 Read 로 본다.
- 정리는 **PID 로** `Stop-Process -Id`. 이름으로 잡을 땐 `taskkill //F //IM Godot_v*.exe` 처럼 정확한 파일명만(`//IM godot.exe` 식으로 뭉뚱그리지 않는다).
