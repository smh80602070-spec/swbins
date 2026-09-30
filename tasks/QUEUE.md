# QUEUE — 맨 위가 다음 일

새 기능 0. 전부 "체제 세우기"(SAGA-ARCH §7 1~2주). 한 줄 = 한 세션. 위에서 아래로. 건너뛰지 않는다.

| 순서 | 티켓 | 종류 | 상태 |
|---|---|---|---|
| 1 | [T-0001](T-0001.md) 웹 헤드리스 러너 `tools/test-web.mjs` | 통합 | 작성됨 |
| 2 | [T-0002](T-0002.md) 웹 다섯 판 `features.json` 첫 채우기 | 측정 | 작성됨 |
| 3 | [T-0003](T-0003.md) `tools/status.mjs` + 트랙 `STATE.md` 생성 | 통합 | 작성됨 |
| 4 | [T-0004](T-0004.md) precheck 게이트 확장(문서 상한 전체·파일 크기·features 검사) | 통합 | 작성됨 |
| 5 | T-0005 확인 시트 생성 `status.mjs --sheet <판>` | 측정 | **미작성 — 여기서 멈춘다** |
| 6 | T-0006 archive 이동(HISTORY·HANDOFF·긴 README) + 트랙 `RULES.md` 셋 | 통합 | 미작성 |
| 7 | T-0007 Godot `probe_all.sh` + 네 판 최소 probe 셋 | 닫기 | 미작성 |
| 8 | T-0008 Unity Playtest 헬퍼(세이브 격리·assert) | 닫기 | 미작성 |
| 9 | T-0009 `data/heroes.json` + `gen-web.mjs`(바이트 일치 확인) | 통합 | 미작성 |
| 10 | T-0010 `saga-web/shared/js/` 4파일 + `sync-shared.mjs` | 통합 | 미작성 |

미작성 티켓은 페이블 세션(주 1회)이 §6.2 틀로 채운다. 채워지기 전에는 `RECURRING.md` 로 넘어간다.
