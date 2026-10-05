# autorun — 무인 기동 (K-0074)

사람이 "이어해" 를 치지 않아도 갈래 큐가 돈다. 한 번 기동 = 큐 맨 위 티켓 하나를 `claude -p "<갈래> 이어해"` 로 실행(게이트·절차는 세션 안에서 그대로).

```
node tools/autorun/run.mjs --branch tools            # 자체툴 큐 맨 위 하나(기본 --max-tickets 1 · --max-minutes 120 · --budget-usd 20)
node tools/autorun/run.mjs --branch web --dry         # 무엇을 띄울지만 보고 안 띄움
node tools/autorun/run.mjs --selftest                 # claude -p 가 이 PC 설정(CLAUDE_CONFIG_DIR·로그인)으로 뜨나
node tools/autorun/run.mjs --register tools --at 02:30   # 작업 스케줄러 매일 등록(사용자가 시킬 때만) · --unregister tools
```

**상주 프로그램 + 제어 페이지(스케줄러 대신, 사용자 10-05)** — `C:\swbins2`(회사용)에는 붙이지 않는다, 전부 이 폴더 안.
```
node tools/autorun/daemon.mjs --branch tools --at 02:30 --port 8798      # 켜 두면 매일 02:30 run.mjs 를 띄움(--every 6 이면 6시간마다)
powershell -ExecutionPolicy Bypass -File tools\autorun\install-startup.ps1 -StartNow   # 로그온 시작 프로그램 등록(+지금 켜기) · -Uninstall 로 해제
http://127.0.0.1:8798                                                   # 상태 · 시작/중지 · 지금 한 번 실행 · 최근 로그(15초마다 갱신) · /api/status JSON
```
- 멈추기: 제어 페이지 "중지" = `tools/autorun/STOP` 파일(있으면 run.mjs 도 안 돈다). "시작" = 파일 삭제. 로그 `tools/autorun/_log/`(git 제외).
- 안 도는 때: 트리가 더럽다(다른 세션 것 보호) · origin 과 갈라짐 · 큐 비었음 · 세션 뒤 HEAD 가 안 움직임(사람 대기 티켓을 되풀이해 토큰을 태우지 않는다).
- 계정: `claude2` 는 따로 있는 exe 가 아니라 PowerShell 함수(`claude.exe` + `CLAUDE_CONFIG_DIR=~/.claude-account2`). 러너는 그 변수를 상속하고, 등록 때 `--config-dir <폴더>`(기본 = 지금 변수 값)를 작업에 박는다. 실행 파일은 PATH·`~/.local/bin` 에서 찾고 `CLAUDE_BIN` 으로 바꿀 수 있다.
- 갈래 = PC 에 맞춰 등록한다: 자체툴은 `C:\swbins3`(SD) 있는 PC, 고돗·유니티는 엔진 있는 PC, 웹은 어디서나.
- 비용: 티켓당 `--max-budget-usd`(기본 20) 상한. 세션은 문맥 로드(CLAUDE.md·메모리·훅)만으로 0.5달러를 넘는다(10-05 실측, 자가 시험은 하이쿠·3달러). 매일 갈래당 1~2 티켓이면 하루 ≤ 갈래 수 × 2 × 20 달러가 천장.
