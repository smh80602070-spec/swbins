# saga-web 규칙 요약 (8KB 상한)

판별 `PLAN.md` §2 "반드시 지킬 것"의 **요약본**이다. 충돌하면 PLAN §2 가 이긴다. 세이브 키·id·이름 정책·다섯 벌 복사·원작 에셋 금지는 루트 `CLAUDE.md`. 한 줄 = 규칙 하나.

## 공통(다섯 판)
- 코드로 그리지 않고 에셋으로(사용자 지시 08-28): 그림·초상·아이콘은 실제 에셋, 스크립트는 판정·규칙·상태만. 결이 안 맞는다는 이유로 안 하지 않고, 못 구하면 "막힌 이유 + 대신 할 것"으로 보고. 옛 그림으로 돌아가는 손잡이는 남긴다(`file://`·LOW·오프라인).
- 에셋은 CC0 우선, 재배포 불가 금지, 출처는 `assets/ASSET_LICENSES.md` 에 없으면 두지 않는다(CC-BY 는 표기).
- `js/` 를 고치면 `node saga-web/shared/build/bundle.mjs <판>` 으로 `dist/app*.js` 를 다시 만들고(낡으면 precheck FAIL) `sw.js` VERSION 을 올린다. 새 js 는 `js/manifest.json`(index·test)·`_test.html`·`_demo.html` 에 넣는다 — index.html·sw.js 는 번들이 대신한다(W-0065).
- 새 진단은 `_test.html` 맨 끝에, 앞 항목 상태에 기대지 않게. 무작위는 `core.hash2` 순수 해시, 씨앗 mulberry32(20260824) 순번을 밀지 않는다.
- 세로·가로 둘 다, safe-area·orientation·터치 44px. `prompt()` 금지. 성능은 안정성 > FPS > 로딩 > 그래픽 순(폰 DPR ≤1.5, 4K 텍스처·고해상 전면 그림자 금지).
- 전체 재작성·불필요한 리팩토링·무거운 라이브러리 금지. 기존 UI·기능을 깨지 않는다. 단계별로 고치고 변경 파일·결과만 보고.
- **생성물 js**: `tools/build-parts.mjs` 의 TARGETS 에 든 큰 js(`world3d`·`story`·`dungeon`·`dungeon3d` …)는 직접 고치지 않는다 — `src/<이름>/` 조각을 고치고 `node tools/build-parts.mjs` 로 조립(어긋나면 precheck 가 막는다).
- 헤드리스 크롬은 PID 로만 끈다. 실기 확인은 묶어서 한 번.

## 사가만리
- 시간·날씨·계절은 시각의 순수 함수(기기·시각이 같으면 같은 답), 진단이 값으로 붙든다.
- 평면 지형·격자 배치·빈 평원·같은 나무 반복 금지. 지형은 기복·군집·색 변주.
- 숨은 자리는 가 보기 전까지 지도에 안 뜬다. 발견은 연출+도감에 남는다. NPC 는 서 있기만 하지 않는다.
- 로더는 공통 `asset3d`, 같은 GLB 를 두 번 받지 않고 clone/`InstancedMesh`. LOD 3단·품질 3단 자동(모바일 첫 MEDIUM).
- 필수 에셋(플레이어·기본 맵·시작 마을) 먼저, 지역별 lazy. 3D 값을 고치면 sw.js VERSION.
- `core.hash2` 는 이 판만 옛 식(0~0.5 반환) — 문턱이 맞춰져 있어 그대로 둔다.

## 사가나락
- 판정(`dungeon.js`)과 화면(`dungeon-view.js`·`dungeon3d.js`)은 갈라져 있다. 판정에 three.js 금지, WebGL 없으면 조용히 2D.
- 모든 피해는 `strike()` 한 통로. 무예 모양(shape)은 열 가지 고정 — 늘리지 않는다. curse·heal·buff·summon 은 `el` 을 안 읽는다.
- 던전은 방 단위 로그라이크(`run.room`, `seedOf`). 마을↔필드↔마을은 하나의 세계 좌표계(`world-map.js`), 칸 내용은 세계 칸 좌표만의 함수이고 마을 간 순간이동은 없다.
- 그림·판정·자동지도가 같은 배열을 읽는다(`WM.pieces/clutter/info`). `run` 은 세이브에 안 남고 `save.dungeon` 은 메타만.
- 수치 불변식(`ANCHOR_DIST` 6400·`TOWN_SAFE_R` 1300·`WORLD_LIMIT` 60000·`CHUNK` 200·`DESK_SCALE` 2.0 등)은 PLAN §2.2 표, 바꾸면 진단이 깨진다. 3인칭·등신·양식 토글은 되살리지 않는다(`diablo` 고정).
- 새 무작위는 `core.hash2`. `_test.html` 은 `DG_NO_DRAW`(3D 안 켬) — 화면 층은 실기 항목으로. 옛 "PLAN §28-8·§60" 류 절 번호는 `HANDOFF.md` 의 같은 번호.
- Quaternius 최신 팩 상당수가 재배포 금지 — 팩 페이지에서 낱개 확인. 승인 제외 목록(alien·bunny·cat 류)은 되살리지 않는다.

## 사가마을
- 구면 투영(`village-view.js` `project()`/`unproject()`)을 평평하게 되돌리지 않는다. 집 안(`projIn`)만 일부러 안 휜다.
- 세계는 좌표 해시(`core.hash2`). 지형 개조는 덮개층(`terrain.js`), 절벽은 넣지 않는다.
- 시간은 실제 시계(계절=달·시간대=시·행사=양력·날씨=날짜 해시). 진단은 `VD.season`·`_setStar`·`_setOpen` 구멍으로 붙든다.
- 프레임마다 도는 것은 공용 `Math.random` 을 안 먹는다(`bug.js`·`folk.js` 는 제 난수). 이사·편지는 `rollDay()` 에서만.
- 새 시스템은 데이터 표 하나 + 기존 `focus()`/`interact()`/`talkNpc()` 분기 한 줄. 새 상호작용 프레임워크·전투 체계 금지.
- 적은 수의 좋은 에셋을 배치·스케일로 다양하게. 성능은 중복 로딩→풀링→인스턴싱→LOD→거리 활성화→DPR→그림자 순으로 푼다.

## 사가종횡
- 갈래 4·효과 9 고정(사용자 명시). 효과 실행은 `side.js` `castSkill()` 한 곳, 데이터는 무엇을 할지만. 무예가 늘어도 효과는 안 늘린다.
- `data-enemy.js` 는 사가나락와 나눠 든 파일 — 새 필드를 만들지 않는다. 고유 규칙은 `data-side.js`·`side.js`.
- 무예 점수는 파생값(세이브 안 함). 조작 띠 8칸·찍은 무예만·윗자리부터, 늘리지 않는다.
- 전직 되돌리기 `resetJob()` 은 하루 1회 무료(`todayKey()`). 상점은 위치에 안 매고 🏪 도구줄로 연다.
- 폰엔 방향키가 없다 — 화면 넷 분할 터치. 폰 DPR ≤1.5, 품질 3단(`post3d.js` `TIER_POST`), 실시간 광원은 마을 횃불 정도.

## 사가천하
- 경영·문답은 이 판 밖으로 안 퍼뜨린다. 판정은 두 벌 두지 않는다(`war.js` `fight()`/`stepRound()` 한 곳, 화면은 재생만). AI 전용 판정 금지 — AI 도 사람이 쓰는 함수를 부른다.
- 능력치는 `off.stats()` 한 곳(`hero.js` 불가침). 군주는 `off.lordOf()` 로만 읽는다. 금은 세력 하나·군량은 성마다.
- 사람은 판에서 지우지 않는다(`dead`·`camp`·재야는 플래그). 군주는 기본 불멸(`rtk.lordAging`).
- 성을 늘리면 `data-city.js`·`data-force.js`·`officer.js`/`rtk.js`·`ui-rtk.js` `MAP_VB` 를 고친다. 물길은 양쪽 `land:'river'`, 해협은 `realm3d.js` `STRAITS`.
- 스크립트를 늘리면 넷(`index`·`_test`·`_demo`·`sw.js`). 새 지역 수비 무장은 처음부터 가명·"(가상)". 이름 정책 예외 `data-quiz.js`(실명 유지, 손대지 않는다).
- 새 진단은 그 항목 안에서만 `Math.random` 을 갈아 끼우고 되돌린다. 옛 "PLAN 16·27·40절" 류는 재편 전 번호 — 날짜 절은 `HANDOFF.md`.
