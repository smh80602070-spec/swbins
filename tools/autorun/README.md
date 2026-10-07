# autorun — 무인 기동 (K-0074)

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

## 문맥 70% 넘기기 (K-0079)

대화 세션(VS Code 등)이 문맥 70% 를 넘으면 단계 체크포인트를 커밋하고 멈추고, autorun 데몬이 **같은 갈래**로 새 `claude -p "<갈래> 이어해"` 를 띄운다. 창 자체는 바깥에서 못 닫는다 — 이어지는 건 백그라운드 세션(로그 `_log/`).

- 설치: `node tools/claude-home/install.js`(멱등) — `statusline.js`·`ctx-guard.js` 를 `~/.claude` 로 복사, ctx-guard 를 UserPromptSubmit·PostToolUse·Stop 에 건다. 상태줄 정본은 `tools/claude-home/statusline.js`.
- 흐름: 상태줄이 문맥 % 를 `tools/autorun/_ctx/<session>.json`(git 밖)에 쓴다 → 프롬프트가 "<갈래> 이어해" 면 갈래 기록 → 70% 넘으면 지시 한 번(도구 뒤·프롬프트 때, 못 봤으면 Stop 을 한 번 막고) → 그 뒤 멈추면 `POST /api/run?branch=<갈래>`(실행 중이면 한 개 줄 세움).
- 끄기: `SAGA_CTX_GUARD=0` · 문턱 `SAGA_CTX_LIMIT`(기본 70) · 데몬 포트 `SAGA_AUTORUN_PORT`. 갈래 모르는 세션·저장소 밖 세션(`C:\link` 등)은 아무것도 안 한다.
- **한계**: run.mjs 는 트리가 더러우면 안 돈다(남의 세션 보호) — 다른 세션 미커밋 파일이 있으면 넘김이 exit 3 으로 끝난다(`_ctx` 의 `sent` 에 데몬 답, `_log` 에 이유). 데몬 코드를 바꾸면 데몬을 다시 켜야 `?branch=` 가 먹는다(옛 데몬은 자기 갈래로 한 번 돈다).
