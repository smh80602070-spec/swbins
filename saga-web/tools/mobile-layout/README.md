# 폰 배치 점검 (mobile-layout)

다섯 판을 헤드리스 크롬 **모바일 에뮬레이션**(390×844 세로 · 844×390 가로, dpr 3, 터치, 안드로이드 UA)으로 띄워
UI 배치를 **숫자로** 잰다. 스크린샷은 기본으로 안 찍는다(루트 `CLAUDE.md` 검증 절 — `--shot` 은 사용자가 요청할 때만).

```
node saga-web/tools/mobile-layout/probe.js                 다섯 판 · 두 방향 · 장면 전부
node saga-web/tools/mobile-layout/probe.js saga-go --only=landscape --scene=main,sheets
  --rects=#dock,#top      장면마다 그 요소 사각형(고칠 때)
  --eval=<식>             장면마다 그 식 값
  --list                  보이는 단추 목록(장면 짤 때)
  --json=<파일>           결과 전체
  --shot=<폴더>           장면마다 스크린샷 PNG(390×844 1배) — 사용자가 "직접 봐 달라"고 할 때만
  --perf                  장면마다 한 화면 부하 — GLB·배우·그리기 호출·삼각형·인스턴스(perf.js)
```

마지막 줄 `MLAYOUT 합계 n건` — **0 이 기준**이다.

## 재는 것 (`measure.js`)

| 이름 | 뜻 |
|---|---|
| 화면밖 | 글자·단추가 화면 밖(스크롤 상자 안은 뺀다) |
| 닿지않음 | 스크롤 상자의 **시작 쪽 밖**으로 밀린 단추 — `justify-content:flex-end` + `overflow:auto` 는 넘친 쪽으로 스크롤이 안 된다(`safe flex-end` 로 푼다) |
| 잘림 | `overflow:hidden` 부모에 30% 넘게 잘린 단추 |
| 가림 | 단추의 보이는 부분 가운데를 다른 요소가 덮음(`elementFromPoint`). 화면 60% 넘게 덮은 창은 "창 열림"으로 따로 센다 |
| 겹침 | 떠 있는(fixed/absolute) UI 덩어리끼리 **속 내용**(글자·단추·그림 사각형)이 맞물림 |
| 터치 | 누르는 대상 짧은 변 40px 미만 |
| 글자 | 11px 미만 |

## 장면 (`games.js`)

- `intro` — 첫 고르기 창(사가블로 출사표 · 사가스토리 첫 장면 · 사가국지 시나리오). 잰 뒤 넘긴다
- `main` — 첫 화면(판이 스스로 연 시트는 닫는다)
- `시트:<id>` — 독의 `[data-sheet]` 단추마다 하나. 시트 안쪽만 잰다

## 요령·함정

- 판은 `tools/lib/gameserve.js` 로 빈 포트에서 서빙한다 — 출처가 달라 실제 세이브(8791~)와 안 섞이고, 서비스워커는 스스로 풀린다.
  새 연습용 프로필(`배치점검`)을 심어 가입 화면을 건너뛴다.
- 크롬은 전용 `--user-data-dir` 로 직접 띄우고 판마다 **그 PID 만** `taskkill /T /F`.
- 헤드리스는 `document.hasFocus()` 가 false 라 판 루프가 멈춘다 → 새 문서마다 true 로 갈아 둔다.
- `pointer: coarse` 가 에뮬레이션에서 맞는다 — 손가락 화면 규칙은 `@media (pointer: coarse)` 로 건다.
- 폰 가로(844×390)는 **폭 규칙으론 데스크톱**이다. 세로로 선 독·목표판·초상이 키 390 을 넘친다 —
  `@media (max-height: 500px) and (min-width: 781px)` 로 따로 잡는다.
- jsdom 은 레이아웃이 없어(모든 rect 0) 이 점검을 못 한다.
- `--perf` 의 삼각형·호출은 헤드리스 등급 기준이다(실기 AUTO 등급과 다를 수 있다). 비교는 같은 명령 전후로. 흩어진 `InstancedMesh` 는 덩이째 컬링이 안 먹는다 — 세 판(사가고 `world3d.instCull`·사가국지 `statCull`·사가블로 `fieldInstance.cull`)은 자리마다 자른다.
