# autorun — 무인 기동 (K-0074)

> **10-18 사용자 결정: 트레이·데몬은 쓰지 않는다** — 같은 창 이어하기(K-0098, 아래 절)가 70% 에서 멈추는 걸로 충분. PC 마다 한 번 `powershell -ExecutionPolicy Bypass -File toolsautoruninstall-startup.ps1 -Uninstall` 로 시작 프로그램에서 빼고 떠 있는 tray.ps1·daemon.mjs 는 그 PID 만 끈다(이 PC 10-18 끝 · **다른 PC 는 그쪽 첫 세션이**).

사람이 "이어해" 를 치지 않아도 갈래 큐가 돈다. 한 번 기동 = 큐 맨 위 티켓 하나를 `claude -p "<갈래> 이어해"` 로 실행(게이트·절차는 세션 안에서 그대로).

```
node tools/autorun/run.mjs --branch tools            # 자체툴 큐 맨 위 하나(기본 --max-tickets 1 · --max-minutes 120 · --budget-usd 20)
node tools/autorun/run.mjs --branch web --dry         # 무엇을 띄울지만 보고 안 띄움
node tools/autorun/run.mjs --selftest                 # claude -p 가 이 PC 설정(CLAUDE_CONFIG_DIR·로그인)으로 뜨나
node tools/autorun/run.mjs --register tools --at 02:30   # 작업 스케줄러 매일 등록(사용자가 시킬 때만) · --unregister tools
```

**상주 프로그램 + 트레이 아이콘 + 제어 페이지(스케줄러 안 씀 — PC 를 켜 둘 일이 없다, 사용자 10-05)** — `C:\swbins2`(회사용)에는 붙이지 않는다, 전부 이 폴더 안.
```
powershell -ExecutionPolicy Bypass -File tools\autorun\install-startup.ps1 -StartNow   # 로그온 시작 프로그램 둘(데몬·트레이) 등록 + 지금 켜기 · -Uninstall 로 해제
node tools/autorun/daemon.mjs --branch tools --at none --on-boot 5      # 기본: 예약 없음, 데몬 시작 5분 뒤 한 번. --at 02:30(매일)·--every 6(시간마다)도 됨
powershell -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File tools\autorun\tray.ps1   # 트레이: 초록 대기·파랑 실행 중·회색 중지·빨강 데몬 꺼짐, 우클릭 메뉴(지금 실행·시작·중지·데몬 켜기/끄기·제어 페이지)
http://127.0.0.1:8798                                                   # 상태 · 시작/중지 · 지금 한 번 실행 · 최근 로그(15초마다 갱신) · /api/status JSON
```
- **QC 자동(10-07)**: 티켓 세션이 커밋을 남기면 `node tools/qc.mjs --branch <갈래>` 를 돌려 로그와 `tools/_out/qc-last.md` 에 남긴다. FAIL 이면 그 갈래 다음 세션이 큐보다 먼저 고친다(tasks/README 절차 1). `--no-qc` 로 끈다.
- 멈추기: 제어 페이지 "중지" = `tools/autorun/STOP` 파일(있으면 run.mjs 도 안 돈다). "시작" = 파일 삭제. 로그 `tools/autorun/_log/`(git 제외).
- 안 도는 때: 트리가 더럽다(다른 세션 것 보호) · origin 과 갈라짐 · 큐 비었음 · 세션 뒤 HEAD 가 안 움직임(사람 대기 티켓을 되풀이해 토큰을 태우지 않는다).
- 계정: `claude2` 는 따로 있는 exe 가 아니라 PowerShell 함수(`claude.exe` + `CLAUDE_CONFIG_DIR=~/.claude-account2`). 러너는 그 변수를 상속하고, 등록 때 `--config-dir <폴더>`(기본 = 지금 변수 값)를 작업에 박는다. 실행 파일은 PATH·`~/.local/bin` 에서 찾고 `CLAUDE_BIN` 으로 바꿀 수 있다.
- 갈래 = PC 에 맞춰 등록한다: 자체툴은 `C:\swbins3`(SD) 있는 PC, 고돗·유니티는 엔진 있는 PC, 웹은 어디서나.
- 모델: 무인 티켓 세션은 **Opus 5.5**(`--model claude-opus-5-5` 기본 — 10-07 사용자 "소넷 5.5는 너무 무식해", 소넷 폐지). R-0(티켓 쓰기)·막힌 티켓도 Opus 5.5 또는 페이블. 데몬 옵션을 바꾸면 데몬을 다시 켜야 적용된다(node 끄고 `install-startup.ps1 -StartNow`). 비용: Opus 는 소넷보다 비싸니 `--budget-usd` 상한을 그대로 두면 티켓 하나가 더 일찍 끊길 수 있다 — 끊기면 상한을 사용자에게 묻는다.
- 비용: 티켓당 `--max-budget-usd`(기본 20) 상한. 세션은 문맥 로드(CLAUDE.md·메모리·훅)만으로 0.5달러를 넘는다(10-05 실측, 자가 시험은 하이쿠·3달러). 매일 갈래당 1~2 티켓이면 하루 ≤ 갈래 수 × 2 × 20 달러가 천장.

## 같은 창 자동 이어하기 · 문맥 70% 멈춤 (K-0098, K-0079 갈음)

켜 둔 대화 세션(VS Code 창)에서 `<갈래> 이어해` 를 한 번 치면, 티켓을 끝내고 멈추려 할 때 Stop 훅이 **같은 창·같은 대화**에 다음 "이어해" 를 돌려 넣는다. 문맥 70% 면 체크포인트 커밋 후 그 창에서 멈춘다(새 대화에서 다시 "이어해" 는 사람이). 백그라운드로 넘기지 않는다.

- 설치: `node tools/claude-home/install.js`(멱등) — `ctx-guard.js`·`statusline.js` 를 `~/.claude` 로 복사, ctx-guard 를 UserPromptSubmit·PostToolUse·Stop 에 건다. 상태줄이 옛 `statusline-command.sh` 면 같은 모양의 `statusline.js` 로 바꾼다. 새로 연 창부터 확실히 먹는다.
- 이어 가는 때: 그 턴이 "이어해"(또는 훅의 이어하기)로 시작 · 갈래 잠금 주인 · 문맥 < 70% · 마지막 말이 질문·`⏸` 아님 · 그 턴에 **자기 갈래 티켓 번호(W-/G-/U-/K-NNNN) 커밋**이 생김. 하나라도 아니면 그냥 멈춘다. 상한 `SAGA_LOOP_MAX`(30).
- 멈추는 때: 권한 창·선택지 질문(원래 기다림) · 글로 질문 · `⏸ 멈춤: <이유>` · 커밋 없이 끝남 · 사용자가 다른 말을 침(그 창은 손으로 돈다) · 70%.
- 여러 창: 상태는 세션마다 `_ctx/<session>.json`. 갈래 잠금 `_ctx/lane-<갈래>.lock`(20분 소식 없으면 풀림, 70% 멈춤 때 풂) — 같은 갈래를 두 번째 창에서 치면 "다른 창이 돌리는 중" 알림만 받고 안 이어 간다. 다른 갈래 창의 커밋으로는 안 이어 간다.
- 문맥 %: 상태줄이 `_ctx/<session>.pct` 에 쓴다(15분 안 것). 없으면 transcript 끝의 usage ÷ 창 크기(`.pct` 의 size → `SAGA_CTX_WINDOW` → 1000000(이 PC Opus 5.5 창)).
- 끄기: 이어하기만 `tools/autorun/_ctx/LOOP-OFF` 파일(바로 먹음) 또는 `SAGA_LOOP=0` · 전부 `SAGA_CTX_GUARD=0` · 문턱 `SAGA_CTX_LIMIT`(70) · 훅 빼기 `install.js --uninstall`. 저장소 밖 세션(`C:\link` 등)·갈래 모르는 세션은 아무것도 안 한다.
- 데몬 `POST /api/run?branch=`(K-0079 넘김 입구)는 남아 있지만 훅은 더 부르지 않는다.
