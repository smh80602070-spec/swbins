# QUEUE — 갈래 넷, 세션 넷 (전부 Opus 5.5 — 10-07 소넷 5.5 폐지)

**동결 해제(10-05)** — 새 기능은 WIP 상한(`tools/wip.json`) 안에서, 플래그십(웹 1만리·5천하) 먼저. **10-07 리뉴얼 묶음**(SAGA-BACKLOG §6): 웹 W-0101~0108 · 고돗 G-0082·0083 · 자체툴 K-0075·0076. 티켓 끝마다 `node tools/qc.mjs` 자동("실기 확인 대기" 금지). 중간에 들어온 아이디어·변경은 `tasks/INBOX.md` 한 줄(절차 `tasks/INTAKE.md`).

"<갈래> 이어해" = 그 갈래 큐 맨 위. **"자동화 이어해"** = `C:\swbins3` 가 있는 PC 면 자체툴 큐, 없으면 웹 큐 맨 위(체제 티켓부터). 갈래 없이 "이어해"면 어느 갈래인지 한 번 묻고 시작한다. 갈래끼리는 파일이 겹치지 않는다(겹치면 티켓이 명시).

| 갈래 | 부르는 말 | 큐 | 티켓 접두 | 손대는 경로 |
|---|---|---|---|---|
| 웹 | 사가웹 이어해 | [web/QUEUE.md](web/QUEUE.md) | W- | `saga-web/` · `tools/test-web.mjs`·`status.mjs`·`precheck.sh`·`hooks/` · 루트 `README.md`·`CLAUDE.md` |
| 고돗 | 사가고돗 이어해 | [godot/QUEUE.md](godot/QUEUE.md) | G- | `saga-godot/` |
| 유니티 | 사가유니티 이어해 | [unity/QUEUE.md](unity/QUEUE.md) | U- | `saga-unity/` |
| 자체툴 | 사가자체툴 이어해 | [tools/QUEUE.md](tools/QUEUE.md) | K- | `tools/char-forge·world-forge·ai-art·asset-forge·glb-compress·asset-audit` · `archive/` · `data/`·`tools/gen/` · `scenario/README.md` · `C:\swbins3`(별도 저장소, 그쪽 규칙으로 커밋) |

공통 파일(`SAGA-ARCH.md`·`SAGA-BACKLOG.md`·`tasks/README.md`·`RECURRING.md`·이 파일)은 **어느 갈래도 티켓 없이 고치지 않는다.**
