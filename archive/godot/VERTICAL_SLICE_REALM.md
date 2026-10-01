# VERTICAL_SLICE_REALM

PLAN.md 39장 순서(Core → Vertical Slice(GO) → DUNGEON → FOREST → STORY →
**REALM**)의 마지막 칸 — GO/DUNGEON/FOREST/STORY는 전부 Vertical Slice
코드가 있다(승인 게이트는 DUNGEON·STORY가 아직 GUI 실기 대기 중). REALM은
`games/saga_realm/` 폴더조차 아직 없다 — 이 문서가 그 설계(Phase 2)의
첫 문서다.

LEGACY_FEATURE_AUDIT.md "SAGA REALM" 절(108~120행)의 분류를 그대로
따른다: **KEEP(절대) — 경영·문답(학당)은 REALM 전용, 다른 판으로 안
퍼뜨린다**(루트 CLAUDE.md 금지사항과 같은 문장). REWORK — 렌더링
계층만 새로 얹는다(`rtk.js`·`war.js`·`officer.js`의 판정 로직은 GDScript로
옮기되 거의 그대로 이식). DROP — "실시간 액션 전투 중심 RPG"로 재정의하지
않는다, **turn-based 경영을 실시간 액션으로 갈아엎지 않는다**.

## 1. 이 판의 "Vertical Slice"란 무엇인가 — 결정 (2026-09-12)

GO/DUNGEON/FOREST/STORY 네 판의 Vertical Slice는 전부 "플레이어 →
월드 이동 → 탐험 → NPC → 퀘스트 → 몬스터 → 실시간 전투 → 스킬 → 보상 →
장비"라는 실시간(rAF 루프) 틀이었다(PLAN.md 3.1절). REALM은 애초에
**턴제**(다섯 판 중 유일하게 rAF 루프가 없다, LEGACY_FEATURE_AUDIT.md
110~111행)라 이 틀이 안 맞는다 — REALM만의 최소 재미 단위를 새로
정의해야 한다.

**결정 — REALM의 Vertical Slice는:**

```text
성 하나를 3D로 조망한다
→ 내정 명령 하나를 실행한다(개간/상업 등)
→ "다음 달"을 눌러 턴을 넘긴다
→ 정산(금·군량이 실제로 바뀐 걸 본다)
→ 재야 인재를 찾아 등용한다
→ 저장한다 → 다시 켜서 이어진다
```

다른 네 판의 "몬스터·스킬·장비" 자리에 REALM은 "명령·정산·등용"이
들어간다. **실시간 이동·전투는 이 슬라이스에 아예 없다** — LEGACY_
FEATURE_AUDIT.md 120행 DROP 문장의 직접 적용("실시간 액션으로 갈아엎지
않는다"는 첫 슬라이스에서도 지킨다, 나중에 "3D 월드맵+액션 전투"를
얹을 때도 경영이 주 루프라는 틀 자체는 안 바뀐다).

## 2. 3D로 뭘 새로 얹나 — 결정

audit의 REWORK 문장 그대로 "렌더링 계층만 새로 얹는다". 구체적으로는
성 하나의 3D 모형(GLB 없으면 이 프로젝트 전체 원칙대로 primitive) +
그 성을 도는 카메라 — "조망" 화면 하나면 첫 슬라이스엔 충분하다.
웹판(`city3d.js`·`realm3d.js`)이 이미 3D 렌더를 갖고 있었다 — 처음부터
새로 설계하지 않고 그 좌표계·스케일 감을 옮겨 참고한다(다음에 착수할 때
두 파일을 먼저 실측할 것, 아직 안 읽었다).

## 3. 판정 로직 — 결정 (재사용, 새로 안 만든다)

`rtk.js` ORDERS(개간·상업·기술·치안·축성·징병·훈련·조선·수색·등용, 10종)
중 첫 슬라이스는 **개간·상업·수색·등용 4종만** 쓴다(GO 첫 슬라이스가
채집 동사 하나만 쓴 것과 같은 절제 — PLAN.md 3.1 Vertical Slice First).
공식(`base + 자질×per`)·비용(금)은 원작 그대로 이식한다 — "새 판정식을
상상하지 않는다"는 이 저장소 전체의 습관(다른 네 판의 데미지·경험치
공식도 전부 이렇게 옮겼다).

## 4. 포함 / 제외

### 포함

```text
성 3곳(진류·복양·허창 — 시나리오 194년 조조군이 원래부터 갖고 시작하는
  성 셋 그대로, 2026-09-12 2-4절 참고) 중 하나를 골라 3D 조망
인접 재야 무장 1~2명(수색으로 찾아야 보인다, 성에 안 매인 force-wide)
명령 10종 전부: 개간·상업·기술·치안·축성·징병·훈련·조선·수색·등용
  (치안은 2026-09-12 1차 추가, 나머지 다섯은 2차 추가, 여러 성은 2-4절
  3차 추가. 조선은 land: plain 성(진류·허창)에서는 늘 실패하고 강가 성
  (복양)에서만 되는 것까지 원작 그대로)
"성" 버튼으로 조망·명령 대상 성 전환
"다음 달" 진행 + 정산(세력 금고는 세 성의 상업 소득 합산, 군량·치안·
  병력 군량 소비는 성마다 따로 갱신)
저장/불러오기
```

### 제외 (다음 슬라이스로 미룸)

```text
전체 107개 성 중 조조군이 처음부터 가진 3개 밖(정복·외교로 늘리기)
외교·계략(diplo.js) · 전쟁(war.js, 진영·공성·수군)
문답(학당, quiz.js) — KEEP이지만 첫 슬라이스 범위 밖
승진/관직 5단
시나리오 200년·208년(194년 하나만)
다른 세력의 실제 AI 행동(이번 슬라이스에선 가만히 있다고 봐도 된다)
무장의 성 소속(위치) — 로스터 전체에서 자질이 가장 높은 무장이 지금
  조망 중인 성 어디든 명령을 쓴다, 여러 무장을 성마다 나눠 앉히는 건
  다음 자리(2-4절)
여러 성을 한 지도에 동시에 띄우는 realm3d.js식 월드맵(지금은 성 버튼
  으로 한 번에 하나씩 전환, 디오라마·카메라는 여전히 하나뿐)
성벽 파손율(wall/maxWall 비율)·재해(disaster)·인구 자연 증감(치안·개간에
  연동한 rtk.js 성장 공식) — 명령이 만드는 값(sec/wall/pop/troops 등)은
  전부 들여왔지만, 그 값에 딸린 이 세 자동 시스템은 아직 안 옮겼다
  (2-2·2-3절)
```

## 5. 완료 조건

```text
게임 실행 → 성 3D 조망 → 개간 명령 실행(금 차감 확인) → "다음 달"
(무장이 하나뿐이라 한 달에 명령 하나만 쓴다 — rtk.js order()의
"이 달에 이미 명령을 썼습니다" 규칙을 그대로 이식했다, 실제 구현 때
발견) → 상업 명령 실행 → 다음 달 → 정산(금·군량이 실제로 바뀐 걸
확인 — 군량은 수확달인 6·10월에만 는다) → 수색으로 재야 인재 발견 →
다음 달 → 등용(그 무장이 내 세력에 들어온 걸 확인) → 저장한다 →
다시 켜서 이어진다
```

**2026-09-12 구현 중 정정** — 처음 이 절을 쓸 때는 "개간→상업→다음
달→...→등용"을 한 턴 안에 다 할 수 있는 것처럼 적었으나, `rtk.js`가
"무장 한 사람은 한 달에 명령 하나"를 원래도 지키고 있었다(order()의
`r.done` 체크). 시작 무장이 하나뿐인 이 슬라이스에서는 명령마다
"다음 달"을 한 번씩 껴야 한다 — 위 문장을 그렇게 고쳤다. 새 규칙을
만든 게 아니라 원작이 이미 갖고 있던 제약을 뒤늦게 반영한 것이다.

GO의 12단계·DUNGEON의 8단계·FOREST의 7단계와 같은 자리 — 이 여덟 단계가
"경영이 재미있는가"를 스스로 답할 수 있으면 성공이다.

## 다음

설계는 여기까지(이번 세션 분, 1~5절). 다음은 GO/DUNGEON/FOREST/STORY가
밟은 순서(Phase 1 `games/saga_realm/` 폴더 생성 → Phase 3 3D 구현
착수)로 넘어가는 게 자연스럽다 — 단, 착수 여부·`city3d.js`/`realm3d.js`
실측은 사용자에게 확인받거나 다음 세션에서 이어간다(다른 네 판과 같은
결).

## 2-2. 명령 확장 — 치안(sec) 추가 (2026-09-12)

**"이어해"로 이어진 작업.** 4절 "제외" 목록에 있던 치안 명령을 끌어왔다 —
`realm_orders.gd`의 `gold_income()`/`food_income()`이 `rtk.js` 공식을 그대로
옮기며 `secMul(sec)`도 함께 가져왔었는데(치안 명령이 없어) sec를 시작값
60에 **고정한 상수**로만 흉내 냈다. 이번에 하는 일은 그 상수 자리를 실제
값으로 바꾸는 것뿐 — 인구(pop)·성벽(wall)·재해(disaster)처럼 이 슬라이스에
아예 없는 다른 시스템은 끌어들이지 않았다(그 셋과 엮인 rtk.js 줄, 예:
인구 증감·굶주림에 따른 성벽 파손은 안 옮겼다).

- `realm_orders.gd` — ORDERS에 `sec`(치안, stat=command, gold=40, base=3,
  per=0.05) 추가, `cap_of()`(agri/comm/sec 셋 다 상한 100·900·900),
  `sec_mul(sec)`을 실제 함수로 뽑아 `gold_income()`/`food_income()`이 sec
  인자를 받게 했다.
- `realm_save_state.gd` — `sec` 변수 추가(시작값 60), `_do_devel()`을
  `get()`/`set()`(Object 리플렉션)으로 일반화해 agri/comm/sec 세 개발
  명령을 한 벌로 처리(if/else 두 갈래 늘리는 대신). `next_month()`가
  `rtk.js settleMonth()`의 "치안은 가만두면 내려간다"(-1/월, clamp 0~100)
  를 그대로 이식. save()/try_load()에 sec 필드 추가.
- `realm_city.gd` — `city3d.js`의 "치안이 높으면 횃불 하나가 더 선다"
  (sec>=80)를 그대로 옮겨, 원래 고정 소품이던 셋째 횃불 자리를 `_dyn`
  으로 옮기고 `_build_sec_torch()`로 조건부 생성.
- `realm_status_label.gd` — HUD에 `🪧 %d`(sec) 표시 추가.
- **검증(헤드리스, 값 자체까지)** — import 확인(project.godot 변경 없음)
  → GO/DUNGEON/FOREST/STORY/REALM 다섯 씬 전부 `--quit-after 5` 세 번
  연속 exit 0·오류 0건·로그 완전 동일(다섯 씬 각각). **임시 디버그로
  실제 값 확인**: 치안 명령 실행 시 amount=8(command 자질 기반 공식과
  일치)·금 40 차감 확인, 다음 달 정산 시 `sec_mul` 기댓값과 실제 소득
  계산이 공식대로 맞물림, 치안이 매달 정확히 -1 감쇠, sec≥80일 때 횃불
  조건 true, 저장/불러오기 왕복(sec=77 저장→0으로 흩트림→다시 불러와
  77 복원) 확인. 디버그 원상복구(diff 0), 테스트 세이브 삭제.
- **GUI 실기 확인은 아직 안 함**(HUD에 치안 수치가 잘 읽히는지, 횃불
  조건이 실제로 눈에 띄는지) — 계속 몰아서 받을 것.
- **다음 이어질 것** — 나머지 5종 명령(기술·축성·징병·훈련·조선) 확장,
  또는 `realm3d.js`(여러 성 월드맵) 실측(여러 성으로 넓힐 때).

## 2-3. 명령 확장 — 나머지 다섯(기술·축성·징병·훈련·조선) 마저 추가 (2026-09-12)

**사용자 지시 "나머지 명령도 마저 추가해줘"** — 2-2절이 치안 하나만 들여온
뒤 남긴 "다음 이어질 것"(나머지 5종 명령)을 이어서, `rtk.js` ORDERS 10종이
이제 전부 REALM에 들어왔다. 2-2절과 같은 원칙("명령이 만드는 값만 들이고,
그 값에 딸린 다른 시스템은 안 들인다")을 다섯 개 전부에 그대로 적용했다:

- **기술(tech)·훈련(train)** — war.js가 없어 지금은 그냥 자라기만 하는
  숫자다(공식·cap은 원작 그대로 옮겨 나중에 전투 슬라이스가 붙을 때 쓸
  자리만 마련).
- **축성(wall)** — 공성(war.js)이 없어 마찬가지로 숫자만 자란다. 성벽
  파손율(maxWall과의 비율)은 여전히 안 옮겼다 — 디오라마의 담장은 그대로
  늘 꽉 찬 넷.
- **징병(draft)** — `rtk.js` 공식이 인구(pop)를 깎아 병력(troops)을 만드는
  구조라 이번에 pop·troops 두 값을 처음 들였다. **인구가 저절로 늘거나
  치안·개간에 연동해 변하는 rtk.js 성장 공식은 안 옮겼다** — pop은 징병
  으로만 준다. 대신 troops가 생긴 이상 매달 군량을 먹고(`eatOf()`), 군량이
  떨어지면 병사가 흩어지는 굶주림 로직(`rtk.js` 그대로)까지는 옮겼다 —
  안 그러면 병력이 군량과 무관한 죽은 숫자가 된다.
- **조선(ships)** — 허창은 `land: plain`이라 `rtk.js` `order()`도 이 성
  에서는 원래 항상 막는다("물길이 없는 성입니다"). 새 판정을 만들지 않고
  그 실패를 그대로 옮겼다 — 강가 성으로 넓힐 때 실제로 쓰이게 된다.

구현: `realm_orders.gd`에 ORDERS 나머지 다섯 + `cap_of()`/`food_upkeep()`
추가(캡·기준값 전부 `rtk.js`/`data-city.js` 그대로: tech cap 900, wall
시작 5400·cap 10800, train cap 100, pop 시작 260000). `realm_save_state.gd`
— `_roll_amount()`로 "대성공+성과량" 계산을 devel/draft가 공유하도록 뽑고,
`_do_draft()`(room 클램프·훈련도 희석) 신설, `execute_order()`에 ships
river-체크(금 차감 전에 먼저 막음, `rtk.js` 순서 그대로) 추가, `next_month()`
에 병력 군량 소비·굶주림 로직 추가, 저장/불러오기에 다섯 필드 추가.
`realm_status_label.gd` HUD에 🪖 병력 표시 추가(치안 뒤).

**검증(헤드리스, 값 자체까지)** — import 확인(project.godot 변경 없음) →
GO·DUNGEON·FOREST·STORY·REALM 다섯 씬 전부 `--quit-after 5` 세 번 연속
exit 0·로그 완전 동일. **임시 디버그로 실제 값 확인**(현책 지력100·통솔
92·무력38 기준): 조선 실행 시 금 안 나가고 항상 실패, 기술 amount=6
(2+100×0.04, 비대성공), 축성 amount=354(60+92×3.2, 비대성공), 훈련
amount=7(대성공, round((3+38×0.05)×1.5)), 징병 amount=1028(200+92×9,
room·pop/12 클램프 안 걸림)에 pop=260000→258972·troops=0→1028 정확히
일치, 첫 징병이 전량 신병이라 훈련도가 47→0으로 희석되는 것까지 공식대로
확인(troops-amount)/troops=0), 다음 달 정산에서 군량이 troops×10/1000=10
만큼 정확히 줄어듦. 저장/불러오기 왕복(다섯 필드 전부 임의값→흩트림→
복원) 확인. 디버그 원상복구(diff 0), 테스트 세이브 삭제.

**GUI 실기 확인은 아직 안 함** — 계속 몰아서 받을 것.

**다음 이어질 것** — 이제 rtk.js ORDERS 10종이 전부 있다. 남은 굵직한
확장은: 여러 성 동시 운영(현재 하나뿐), 전쟁/외교(war.js·diplo.js),
문답(quiz.js), 또는 이번에 들여온 wall/tech/train 값을 실제로 소비하는
전투 슬라이스 설계 — 어느 쪽이든 승인 후.

## 2-1. `city3d.js` 실측 반영 — 디오라마로 재구성 (2026-09-12)

2절이 "다음에 착수할 때 실측할 것"이라 남겨 둔 `city3d.js`를 읽었다.
핵심은 "장식이 아니라 읽는 화면"(원문) — 성벽 파손율·인구·상업·개간·
군량·치안을 전부 소품 **개수**로 그대로 세운 디오라마이고, 성 숫자가
바뀔 때만(`sig()` 비교) 다시 짓는다. `realm_city.gd`를 그 방식대로
다시 짜서 정적 실루엣(대·누각·담장뿐이던 것)에 밭(개간)·시장(상업)·
곳간(군량)·**로스터 깃발**(이 슬라이스에만 있는 값, 무장 수)을 추가했다
— 성벽 파손율·인구·치안은 이 슬라이스에 그 값 자체가 없어(3·4절 "제외")
뺐다. 기준값(밭 90·시장 80·곳간 400 단위당 하나)은 원작 `city3d.js`
그대로 이식.

## 2-4. 여러 성으로 확장 — 진류·복양·허창 (2026-09-12)

**사용자 지시 "여러 성으로 넓히는 것부터 해줘"** — 2-3절이 남긴 "다음
이어질 것" 중 "여러 성 동시 운영"을 골랐다. **전쟁·정복 없이 여러 성을
굴리는 방법**을 찾다가 `data-force.js`를 다시 보니, 시나리오 194의
조조군(`cao`)이 원래부터 성 셋(`cities: ['chenliu', 'puyang', 'xuchang']`
— 진류·복양·허창)을 갖고 시작한다는 사실을 확인했다. 정복도 외교도 안
만들고 **"이미 갖고 있던 것"만 플레이 가능하게 넓힌 것** — 4절 "제외"의
"외교·전쟁"은 그대로 남는다.

- `realm_cities.gd`(신규) — 세 성의 `data-city.js` 정의(agri/comm/wall/
  pop 시작값, land: 진류·허창은 plain, 복양은 river)와 `rtk.js`
  `capOf()`의 land별 배율(agriCap/commCap)·`food_start()`(8000+agri×8,
  기존 허창 11200 공식과 같음)를 옮겼다. **복양이 첫 강가 성이라 조선
  (ships) 명령이 이번에 처음으로 실제 쓸모가 생겼다**(cap=300, 시작값
  60) — 진류·허창(plain)은 여전히 capOf('ships')=0이라 늘 실패.
- `realm_orders.gd` — `cap_of(key, city_id)`로 city_id 인자를 받게
  바꿔 agri/comm/wall/ships 캡을 성마다 계산한다(tech/sec/train은
  land 무관이라 그대로 상수). 성 하나였을 때 굳혀 뒀던 CAP_AGRI 등
  플랫 상수는 지웠다.
- `realm_save_state.gd` — 가장 큰 변화. `agri`~`ships` 아홉 필드가
  플랫 top-level var에서 **`cities: Dictionary`**(city_id → 저 아홉
  필드를 담은 Dictionary)로 옮겨졌고 `current_city`(지금 조망·명령
  대상)가 새로 생겼다. `gold`(세력 금고)·`roster`·`year`/`month`는
  `rtk.js`처럼 여전히 세력 전체가 공유(성마다 안 나뉜다). 시작 금고도
  성 하나 가정 상수(2400)에서 `rtk.js` 공식 그대로(2000+성 수×400=3200)
  로 고쳤다. `next_month()`는 이제 **세 성의 상업 소득을 합산**해 세력
  금고에 반영하고(`rtk.js settleMonth()` "세력 금고" 루프 그대로),
  군량·치안·병력 정산은 성마다 따로 돈다. **재해석 유지** — 무장의
  "성 소속(위치)"은 여전히 안 따진다(1차 추가 때부터의 결정과 같은 결)
  — 로스터 전체에서 자질이 가장 높은, 이번 달에 안 쓴 무장이 `current_
  city` 어디든 명령을 쓴다. `SAVE_VERSION`을 1→2로 올렸다(구조가 바뀌어
  옛 세이브는 버전 불일치로 자동 무시되고 기본값으로 다시 시작한다 —
  PLAN.md 28장 "Save Version"이 대비하라던 바로 그 경우).
- `realm_city_button.gd`(신규) — "성" 버튼, GO ChoicePrompt로 세
  성 중 조망·명령 대상을 고른다(realm_order_button.gd와 같은 패턴).
  디오라마·카메라는 여전히 하나뿐이다(1절 "성 하나를 3D로 조망한다") —
  성을 바꾸면 `realm_city.gd`가 `current_city`를 읽어 같은 자리에서
  다시 짓는다. 세 성을 한 지도에 동시에 띄우는 `realm3d.js`식 월드맵은
  아직 안 만들었다(다음에 볼 자리).
- `realm_city.gd` — `_rebuild_if_changed()`의 sig()에 `current_city`를
  넣어 성을 바꾸면 자동으로 다시 짓게 했고, farms/markets/granary/
  sec_torch 네 함수가 이제 `RealmSaveState.cities[current_city]`를
  인자로 받는다.
- `realm_status_label.gd` — HUD 맨 앞에 성 이름을 붙이고(지금 조망
  중인 성이 어디인지 항상 보이게), agri/comm/sec/troops를 `current_
  city`에서 읽도록 고쳤다.

**검증(헤드리스, 값 자체까지)** — import 확인(project.godot 변경 없음)
→ GO·DUNGEON·FOREST·STORY·REALM 다섯 씬 전부 `--quit-after 5` 세 번
연속 exit 0·로그 완전 동일. **임시 디버그로 실제 값 확인**: 시작 금고
3200(2000+3×400)·세 성 기본값(agri/comm/wall/pop/food/ships) 전부
`data-city.js`·공식과 정확히 일치, 성 전환 후 복양에서 조선 실행 시
성공(amount=10, ships 60→70)·진류에서는 river 게이트로 항상 실패(금
안 나감) 확인, **로스터가 하나뿐이라 한 성에서 명령을 쓰면 같은 달엔
다른 성에서도 명령을 못 쓰는 것**(officer 소진, 의도한 부작용 —
"무장 위치는 안 따진다"고 "무장 수가 늘어난다"는 건 별개임을 확인)까지
확인. 다음 달 정산이 세 성 comm 소득의 **합**과 정확히 일치(공식대로
손 계산), 치안이 세 성 전부 -1씩 독립적으로 감쇠. 저장/불러오기 왕복 —
JSON을 거치며 정수가 실수로 바뀌는 것(Godot JSON 특성, 모든 필드가
`int()`/`float()`로 방어되어 있어 무해함을 확인) 말고는 세 성의 아홉
필드·금고 전부 정확히 복원. 디버그 원상복구(diff 0), 테스트 세이브 삭제.

**GUI 실기 확인 완료** — 사용자가 직접 켜서 확인("실기 잘되니 다음
진행해"), 이어서 다음 조각으로 넘어갔다(2-5절).

## 2-5. 재야를 성마다 나눠 묻기 (2026-09-12)

**사용자 지시 "다음 진행해"** — 2-4절이 남긴 세 후보(realm3d.js 월드맵 /
무장을 성마다 나눠 앉히는 시스템 / 전쟁·외교·문답) 중 가운데 것의 **안전한
조각**을 골랐다. 무장의 "성 소속(위치)"을 명령 실행 자체에 완전히
적용하면(그 성에 있는 무장만 그 성에서 명령 가능) 시작 무장이 하나뿐인
지금 즉시 막다른 골목이 생긴다 — 진류·복양엔 애초에 아무도 없으니
"무장이 있어야 수색할 수 있는데 수색해야 무장이 생긴다"는 순환이
막힌다. 그래서 **명령 실행(어느 무장이든 current_city에서 쓸 수 있다)은
그대로 두고, 수색(search)만 성마다 다르게** 만들었다 — 재야를 성 소속으로
나눠 묻어 "성마다 다른 사람이 있다"는 결과만 먼저 들여왔다. 명령 실행
자체의 성 소속 게이팅(위 막다른 골목 문제)은 여전히 다음 자리.

- `realm_officer_pool.gd` — `HIDDEN_POOL`(평평한 배열)을
  `HIDDEN_POOL_BY_CITY`(city_id → 배열)로 바꿨다. 해장(kr_yisunsin)은
  복양, 이도인(jp_musashi)은 진류에 묻었다 — 허창(본거지, 이미 시작
  무장이 있음)엔 일부러 안 묻어 세 성을 다 둘러볼 이유를 만들었다.
- `realm_save_state.gd` `_do_search()` — `RealmOfficerPool.HIDDEN_POOL`
  대신 `HIDDEN_POOL_BY_CITY.get(current_city, [])`을 본다. 그 외
  로직(rarity 내림차순·지력 기반 reach)은 그대로.

**검증(헤드리스, 값 자체까지)** — import 확인(project.godot 변경 없음)
→ 다섯 씬 전부 `--quit-after 5` 세 번 연속 exit 0·로그 완전 동일.
**임시 디버그로 실제 값 확인**: 허창에서 수색 시 found=""(아무도 없음),
복양에서 수색 시 해장(kr_yisunsin)만 나옴, 진류에서 수색 시 이도인
(jp_musashi)만 나옴, 다시 복양에서 수색하면 이미 찾아서 found=""(각
수색 사이 `next_month()`로 무장 턴을 비워 가며 확인). 디버그 원상복구
(diff 0), 테스트 세이브 삭제.

**GUI 실기 확인 완료** — 사용자가 직접 확인("다음 진행해"), 이어서
2-6절로 그 "나머지 절반"을 마저 넣었다.

## 2-6. 무장의 성 소속을 명령 실행에도 적용 (2026-09-12)

**사용자 지시 "다음 진행해"** — 2-5절이 "막다른 골목을 풀 방법이 먼저
필요"라며 미뤄 둔 나머지 절반을 마저 넣었다. 풀어낸 방법은 **수색·등용은
계속 예외로 남기는 것**이다 — 개발형 명령(개간·상업·기술·치안·축성·
훈련·조선)과 징병은 `rtk.js order()`의 `r.city !== cityId` 체크 그대로
"그 성에 배치된 무장만" 쓸 수 있게 했지만, 수색·등용은 여전히 로스터
전체 아무나 실행할 수 있다. 그래서 순환이 안 생긴다 — 진류·복양에 아직
아무도 없어도 그리로 가서 수색·등용은 할 수 있고, 등용에 성공하면 그
무장이 **찾아낸(수색한) 성**에 배치된다. 시작 무장(현책)은 허창에 배치돼
있어 허창은 기존과 똑같이 돌아간다.

- `realm_save_state.gd` — `officer_city: Dictionary`(officer_id→city_id)
  신설, 시작값 `{sg_zhugeliang: "xuchang"}`. `_best_officer_for(stat,
  city_filter="")`로 바뀌어 city_filter가 비어 있으면(수색·등용) 로스터
  전체, 아니면(개발형·징병) 그 성 배치자만 본다. `execute_order()`가
  key로 `location_bound`를 갈라 호출한다. `_do_hire()` 성공 시
  `officer_city[target_id] = current_city`를 심는다. `_governor()`
  (전 세력 공통 하나)를 `_governor_at(city_id)`로 바꿔 `next_month()`의
  gov_mul도 이제 **그 성에 배치된 무장 중 으뜸**만 본다(배치자가 없으면
  rtk.js처럼 mul=1.0 — 인재를 안 심은 성은 정산도 더 약하다). `next_month()`
  전체를 city별 단일 루프로 다시 짜면서 금고 합산(income) 계산도 그
  루프 안으로 옮겼다(리팩터, 값은 그대로). `SAVE_VERSION` 2→3(officer_city
  추가), 저장/불러오기에 반영.
- **하지 않은 것** — 무장의 실제 3D 이동/여행(성 사이를 걸어서 옮기는
  것)은 이 슬라이스에 없다. "배치"는 데이터일 뿐 — 등용된 순간 그 성에
  고정되고, 그 배치를 바꾸는 명령(전임 등)은 아직 없다(다음에 볼 자리).

**검증(헤드리스, 값 자체까지)** — import 확인 중 헤드리스 에디터가
`project.godot`의 66-1절 렌더러 프로파일 줄(3줄)과 그림자 상수 한 줄을
또 조용히 지운 것을 발견(saga-godot/CLAUDE.md에 이미 적힌 알려진 흠) —
`git checkout`으로 되돌리고 실제로 고친 파일만 커밋 대상에 남겼다. →
GO·DUNGEON·FOREST·STORY·REALM 다섯 씬 전부 `--quit-after 5` 세 번 연속
exit 0·로그 완전 동일. **임시 디버그로 실제 값 확인**: 진류에서 개간
시도 시 배치된 무장이 없어 실패(금 안 나감), 같은 진류에서 수색은
여전히 성공(예외 확인), 등용을 성공할 때까지 반복(확률 판정이라 몇 번
필요했다) → 성공 시 `officer_city`에 `jp_musashi: "chenliu"`가 정확히
추가됨, 그 직후 진류에서 개간이 이도인(무력97·지력70)의 자질로 정확히
성공(amount=7, 공식과 일치), 허창은 여전히 현책으로 그대로 작동(영향
없음) 확인. 저장/불러오기 왕복으로 `officer_city` 두 항목 다 정확히
복원. 디버그 원상복구(diff 0), 테스트 세이브 삭제.

**GUI 실기 확인은 아직 안 함** — 계속 몰아서 받을 것.

**다음 이어질 것** — `realm3d.js`(여러 성을 한 지도에 띄우는 월드맵),
무장을 성 사이로 옮기는 명령(전임/이동), 또는 전쟁/외교(war.js/
diplo.js)·문답(quiz.js) — 어느 쪽이든 승인 후.


## 2-7. 무장을 성 사이로 옮기는 명령 — 전임 (2026-09-12)

**사용자 지시 "saga-godot 이어해"** — 2-6절이 남긴 세 후보(realm3d.js
월드맵 / 전임·이동 / 전쟁·외교·문답) 중 가장 좁은 스코프를 골랐다.
2-6절에서 "그 성에 배치된 무장만 명령을 쓸 수 있다"를 넣은 뒤로 진류·
복양은 등용해야만 개발형 명령을 쓸 수 있는데, 등용은 늘 그 성에서
일어나(수색한 성에 배치) 배치를 바꿀 방법이 아예 없었다 — `war.js
moveOfficer(officerId, toId)`를 그대로 옮겨 그 막힌 자리를 풀었다.

- `realm_cities.gd` — `ADJ`(맞닿은 성 간선)·`is_adjacent()` 신설.
  `data-city.js`의 전체 지도 간선 중 이 세 성에 걸치는 것만 옮겼다:
  복양↔진류, 진류↔허창. **복양↔허창은 없다** — 원작 지도에서 둘 사이에
  진류가 있어 안 맞닿는다(전임하려면 진류를 거쳐야 한다).
- `realm_save_state.gd` — `transfer_officer(officer_id, to_city_id)`
  신설. `war.js moveOfficer()`를 그대로 옮기되, 이 슬라이스는 성 셋이
  전부 우리 것이라 원작의 "남의 성인가"(`to.force !== r.force`) 체크는
  뺐다(항상 통과하는 체크라 의미가 없다) — 실제로 갈리는 건 맞닿음과
  "이 달에 이미 명령을 썼는가"(`_done_this_month`, 개발형 명령과 같은
  자리를 공유한다 — 전임도 그 달의 명령 한 번을 쓴다) 둘뿐이다. 원작의
  `from.gov = null`(태수 자리 비우기)은 옮기지 않았다 — 이 슬라이스는
  태수를 저장하지 않고 `_governor_at()`이 매번 `officer_city`를 보고
  다시 골라서, 옮긴 순간 자동으로 반영된다.
- `realm_transfer_button.gd`(신규) + `RealmHUD.tscn`에 "전임" 버튼
  추가(성 버튼 바로 위) — `realm_city_button.gd`/`realm_order_button.gd`
  와 같은 `ChoicePrompt` 패턴이되 2단이다: 로스터에서 무장을 고르면(현재
  배치 성 표시) 그 성과 맞닿은 성 목록이 뜨고, 고르면 실행. 맞닿은 성이
  없으면(이론상 지금 지도에선 안 생긴다 — 세 성 다 적어도 하나씩 맞닿아
  있다) 토스트로 알리고 아무 일도 안 한다.
- **검증 중 발견하고 고친 별개의 버그** — `realm_month_button.gd`가
  `RealmSaveState.food`(최상위 프로퍼티)를 읽고 있었는데, 2-4절("여러
  성으로 확장", commit d41c687)이 `food`를 `cities[city_id].food`로
  옮기면서 이 파일만 안 따라갔다. 존재하지 않는 프로퍼티라 GDScript
  정적 타입 추론이 실패해 **스크립트 자체가 파싱조차 안 되고 있었다**
  (즉 "다음 달" 버튼이 켜져 있었다면 그 자리에서 에러) — 지금까지의
  헤드리스 검증이 "exit 0"만 보고 로그의 SCRIPT ERROR 줄은 안 훑어서
  d41c687 이후 계속 놓치고 있었다. `current_city`(HUD가 쓰는 것과 같은
  "지금 조망 중인 성" 관점) 기준으로 고쳤다. **다음 세션부터 헤드리스
  검증에서 exit 코드만 보지 말고 로그에 SCRIPT ERROR/Parse Error가
  있는지도 grep으로 같이 확인할 것** — 이번처럼 exit 0인데 스크립트
  하나가 조용히 안 실린 경우를 놓칠 수 있다.

**검증(헤드리스, 값 자체까지)** — import 확인(`--headless --editor
--quit` 후 `git diff -- project.godot '*.import'`로 훑음 — 이번엔 3줄
렌더러 프로파일 삭제가 또 발생해 `git checkout`으로 되돌림, 알려진 흠
그대로) → GO·DUNGEON·FOREST·STORY·REALM 다섯 씬 전부 `--quit-after 5`
세 번 연속 exit 0, 이번엔 로그 전체를 error/warn/missing/invalid/cannot
로 훑어 실제로 한 줄도 안 나오는 것까지 확인(위 month_button.gd 버그를
이 방식으로 찾았다). **임시 디버그로 실제 값 확인**(`realm_save_state.gd
_ready()`에 넣었다 뺐다, diff 0 확인): `is_adjacent`가 복양-진류·진류-
허창 true, 복양-허창 false로 정확히 갈림. 시작 무장(현책, 허창)을
진류로 전임 성공 → `officer_city`에 정확히 반영. 같은 달 안에 그 무장을
다시 복양으로 전임 시도 → "이 달에 이미 명령을 썼습니다"로 정확히
막힘. 달을 넘긴 뒤(`_done_this_month.clear()`) 진류→복양 전임 성공.
그 뒤 복양→허창(안 맞닿음) 시도 → "맞닿아 있지 않습니다"로 정확히
막힘. 없는 무장 id → "로스터에 없는 무장", 같은 성으로 전임 시도 →
"이미 그 성에 있습니다" 둘 다 정확히 확인. 디버그 원상복구(diff 0),
테스트 세이브 없음(디버그가 `save()`를 안 불러 생성 자체가 없었다).

**GUI 실기 확인은 아직 안 함** — 계속 몰아서 받을 것.

**다음 이어질 것** — `realm3d.js`(여러 성을 한 지도에 띄우는 월드맵),
또는 전쟁/외교(war.js/diplo.js)·문답(quiz.js) — 어느 쪽이든 승인 후.


## 2-8. 월드맵 첫 슬라이스 — 성 셋을 한 지도로 (2026-09-12)

**사용자 지시 "응 진행해"** — 2-7절이 남긴 세 후보(realm3d.js 월드맵 /
전쟁·외교 / 문답) 중 `realm3d.js`를 골랐다. 여러 번 "여러 성으로 넓힐
때 다시 볼 것"으로 미뤄 왔는데 2-4절에서 실제로 성이 셋이 됐으니 지금이
그때다. **realm3d.js 전체(1006줄: 성 서른 곳·heightmap 지형·해협·드래그
궤도 카메라)는 옮기지 않았다** — 이 슬라이스는 성이 셋뿐이라 지형
기복·바다 같은 지리적 디테일이 realm_city.gd의 "성벽 파손율처럼 없는
값은 안 그린다"는 원칙과 같은 이유로 아직 값 자체가 없다. 첫 슬라이스는
**평평한 바닥 + 성마다 표지 하나(성표, 城標) + 지금 조망 중인 성 강조**
로 좁혔다.

- `realm_cities.gd` — CITIES 각 항목에 `x`·`y`(`data-city.js` 지도
  좌표, 0~100 지도 비율) 추가: 진류(63,39)·복양(68,33)·허창(58,47).
  `map_center()`(x·y 평균) 신설 — 성이 늘어도 상수를 다시 안 박게.
- `realm_worldmap.gd`(신규, Node3D) — 성마다 기둥(색은 land별)+깃발
  하나로 성표를 세운다. 좌표는 `map_center()` 기준으로 옮기고
  **`WORLD_SCALE=14`로 축척을 새로 골랐다**(realm3d.js의 4.5는 성 서른
  곳이 지도 전체에 퍼진 걸 가정한 값이라 그대로 쓰면 성 셋이 한 덩어리로
  겹친다 — 위치의 방향·비율은 실측 그대로, 축척만 이 슬라이스 크기에
  맞춘 재해석). `RealmSaveState.current_city`를 폴링해(realm_city.gd와
  같은 결) 강조색을 바꾼다 — 값이 바뀔 때만 갱신(매 프레임 비교 정도의
  가벼운 폴링이라 sig() 캐시까지는 안 씀).
- `realm_worldmap_camera.gd`(신규, Camera3D) — `realm_camera.gd`(디오라마
  궤도 카메라)와 같은 WASD 재사용 요령, 반경·높이만 지도 전체가 담기게
  키웠다(RADIUS 60~220, HEIGHT 130).
- `realm_map_button.gd`(신규) — "지도" 버튼, `RealmSaveState.
  viewing_map`(신설, **저장 안 함** — 세이브를 열 때마다 디오라마부터
  보인다) 하나만 뒤집는다.
- `realm_city.gd`/`realm_camera.gd` — `viewing_map`을 폴링해 켜져 있으면
  디오라마를 숨기고(리빌드도 건너뜀) 카메라도 끈다. 두 카메라가 같은
  move_* 입력 액션을 나눠 쓰므로 정확히 하나만 `current=true`가 되게
  했다(불리언 하나로 갈리니 동시에 둘 다 true일 일이 없다).
- `TestCity.tscn`에 `WorldMap`(Node3D)·`WorldMapCamera3D`(Camera3D)
  형제 노드 추가, `RealmHUD.tscn`에 "지도" 버튼 추가(전임 버튼 바로
  위).
- **하지 않은 것(다음에 볼 자리)** — 성표를 탭해 조망 대상을 바꾸는 것
  (원작 realm3d.js의 핵심 상호작용, `ui.openCity()`를 그대로 부르는
  것과 같은 결). 지금은 여전히 "성" 버튼(ChoicePrompt)으로만 바꾸고
  이 지도는 순전히 개관용이다. 지형 기복·해협·드래그 궤도 카메라도 안
  옮겼다 — 값도 없고 이 슬라이스 크기에 필요하지도 않다.

**검증(헤드리스, 값 자체까지)** — import 확인(`--headless --editor
--quit`, `project.godot` 변경 없음 — 이번엔 66-1절 렌더러 프로파일이
안 지워졌다, texture-a.png.import만 늘 그렇듯 재발생해 `git checkout`)
→ 다섯 씬 전부 `--quit-after 5` 세 번 연속 exit 0, 로그를
error/warn/missing/invalid/cannot로 훑어 한 줄도 없음(2-7절에서 정한
습관 그대로 계속 지킴). **임시 디버그로 실제 값 확인**: `map_center()`
=(63, 39.667) 손 계산과 일치. 세 마커의 `_world_pos()`가 손 계산과
정확히 일치(진류(0,-9.33), 복양(70,-93.33), 허창(-70,102.67)) — 이때
허창-복양 대각 거리가 약 240으로 처음 잡은 `GROUND_SPAN=220`보다 커
가장자리가 빠듯한 것을 발견해 **260으로 늘렸다**(재검증 없이 상수만
키운 것 — 바닥이 넓어지는 것뿐이라 다른 값에 영향 없음, 그래도 이후
재헤드리스 통과 확인함). `viewing_map` 기본값 false·수동 전환 true
반영 확인. 디버그 원상복구(diff 0), 테스트 세이브 없음.

**GUI 실기 확인은 아직 안 함** — 마커 셋이 실제로 서로 안 겹치고
읽히는지, 두 카메라 전환이 매끄러운지는 눈으로 봐야 한다. 계속 몰아서
받을 것.

**다음 이어질 것** — 성표 탭으로 조망 대상 바꾸기, 또는 전쟁/외교
(war.js/diplo.js)·문답(quiz.js) — 어느 쪽이든 승인 후.


## 2-9. 성표 탭으로 조망 대상 바꾸기 (2026-09-12)

**사용자 지시 "성표 탭으로 조망 대상 바꾸는 것도 이어해"** — 2-8절이
"다음에 볼 자리"로 미뤄 둔 realm3d.js의 핵심 상호작용("성을 탭하면
그 성을 연다")을 옮겼다. 이 슬라이스엔 `ui.openCity()`(성 시트를 여는
것) 자체가 없으니, 대신 이 슬라이스가 실제로 가진 것 — `current_city`를
바꾸는 것 — 을 부르는 것으로 재해석했다. "성" 버튼(ChoicePrompt)이
하던 일과 결과는 같고, 이제 지도 위에서 직접 눌러도 된다.

- `realm_worldmap.gd` — 성표마다 `Area3D`+`CollisionShape3D`
  (`CylinderShape3D`, 반경 2.6·높이 4.5 — 기둥 반경 0.7보다 훨씬 넉넉하게
  손가락 탭을 봐준다)를 얹고 `input_event`를 성 id로 `bind()`해 연결.
  `_ready()`에서 `get_viewport().physics_object_picking = true`로
  물리 피킹을 켠다 — **이 프로젝트에 3D 오브젝트 탭 판정이 처음 등장**
  (GO/DUNGEON/FOREST/STORY는 전부 이동+충돌이지 탭 선택이 아니었다).
  `project.godot`에 새 입력 액션이나 물리 레이어를 하나도 안 늘려도
  되는 길이라 골랐다 — 마우스 왼쪽 클릭·터치(index 0) 둘 다
  `InputEventMouseButton`/`InputEventScreenTouch`를 직접 갈라 받는다
  (`games/saga_go/player/camera_rig.gd`가 마우스·터치를 나눠 받던 것과
  같은 요령, `camera_rig.gd`는 드래그 회전이라 문지방(threshold)이
  있었지만 이건 탭 하나뿐이라 필요 없다). 마우스·터치 에뮬레이션은
  Godot 기본값(`emulate_mouse_from_touch`)에 기댄다 — project.godot에
  따로 켠 줄 없음, 4.x 기본이 이미 켜져 있다.
  - `_process()`에서 `viewing_map`이 꺼지면 각 Area3D의
    `input_ray_pickable`도 같이 끈다(성 하나짜리 디오라마 화면의 카메라는
    시야가 원점 근처뿐이라 실수로 겹칠 일은 거의 없지만, 숨어 있는 동안
    탭이 먹히면 안 되니 확실히 막았다).
- **검증 중 잡은 실수** — 처음엔 `InputEventMouseButton`/
  `InputEventScreenTouch` 두 타입 검사를 `event is X and event.pressed`
  한 줄짜리 불리언 식으로 짧게 썼다가, GDScript 정적 타입 추론이
  베이스 타입(`InputEvent`)엔 `pressed`/`button_index`/`index` 프로퍼티가
  없어 **파싱 자체가 실패**했다(2-7절에서 잡은 `realm_month_button.gd`
  버그와 똑같은 함정 — 이번엔 헤드리스 검증에서 exit 코드뿐 아니라 로그도
  같이 훑는 습관 덕에 커밋 전에 바로 잡았다). `camera_rig.gd`처럼
  `if event is X: var y := event as X` 형태로 갈라 고쳤다.

**검증(헤드리스, 값 자체까지)** — import 확인(project.godot 변경 없음,
texture-a.png.import만 늘 그렇듯 재발생해 되돌림) → 다섯 씬 전부
`--quit-after 5` 세 번 연속 exit 0, 로그를 error/warn/missing/invalid/
cannot로 훑어 한 줄도 없음(위 파싱 버그를 이 방식으로 커밋 전에 잡았다).
**임시 디버그로 실제 값 확인**(`_ready()`에서 `call_deferred`로 한 번
불렀다 뺐다, diff 0 확인): `viewing_map` 끈 상태에서 `input_ray_pickable`
false → 켠 뒤 true로 정확히 바뀜. 가짜 `InputEventMouseButton`
(pressed=true, LEFT)으로 진류 탭 → `current_city`가 정확히 `chenliu`로
바뀜. 같은 이벤트의 release(pressed=false)로 복양을 탭해도 **바뀌지
않음**(눌림만 반응, 뗌은 무시 — 의도대로). 가짜 `InputEventScreenTouch`
(pressed=true, index=0)로 허창 탭 → `current_city`가 정확히 `xuchang`
으로 바뀜. 디버그 원상복구(diff 0), 테스트 세이브 없음.

**GUI 실기 확인은 아직 안 함** — 실제 마우스 클릭·손가락 탭으로 성표가
눌리는 느낌(탭 판정 반경이 너무 넓거나 좁지 않은지)은 눈으로 볼 것.
계속 몰아서 받을 것.

**다음 이어질 것** — 지형 기복·해협·드래그 궤도 카메라(realm3d.js의
나머지), 또는 전쟁/외교(war.js/diplo.js)·문답(quiz.js) — 어느 쪽이든
승인 후.


## 2-10. 월드맵 드래그 궤도 카메라 (2026-09-12)

**사용자 지시 "saga-godot 이어해"** — 2-9절이 남긴 realm3d.js 나머지
(지형 기복·해협·드래그 카메라) 중 **드래그 카메라만** 골랐다. 지형
기복·해협은 값 자체가 없다는 재해석을 계속 유지 — 성 셋 모두 평지에
가깝고(진류·허창=plain, 복양=river) 산·바다로 갈라진 지형이 아니라서
realm_city.gd가 "없는 값은 안 그린다"는 원칙과 같은 이유로 계속
스코프 밖에 둔다. 드래그 카메라만 골랐다.

- `realm_worldmap_camera.gd` — WASD(move_* 액션) 대신 `games/saga_go/
  player/camera_rig.gd`의 드래그 판정을 그대로 옮겼다: 마우스 버튼+모션,
  터치+드래그를 각각 받고 10px 문지방으로 탭(성표 선택)과 구분한다.
  궤도를 realm3d.js처럼 **완전한 구면 좌표**(yaw+pitch+radius)로
  바꿨다 — 이전엔 yaw·radius만 돌리고 높이(HEIGHT)가 고정값이었는데,
  드래그의 세로 성분을 태우려니 구면 좌표가 자연스럽다. pitch 범위는
  realm3d.js `PITCH_MIN()`/`PITCH_MAX()`의 라디안 값(0.35~1.3)을 그대로
  썼다(각도라 지도 크기와 무관하게 옮길 수 있다). radius(중심까지 거리)
  범위(120~420)만 이 슬라이스의 지도 크기(GROUND_SPAN=260)에 맞게 새로
  골랐다. 마우스 휠 줌도 camera_rig.gd 감각으로 추가.
  - 디오라마 카메라(realm_camera.gd)는 이번 변경과 무관 — 계속 WASD를
    쓴다("성 조망" 단일 화면엔 드래그보다 WASD가 더 어울린다는 1절 결정
    그대로).
- **하지 않은 것(다음에 볼 자리)** — 핀치(두 손가락) 줌. 마우스 휠은
  옮겼지만 멀티터치 핀치 제스처(두 터치 인덱스 거리 추적)는 스코프
  밖으로 남겼다 — 이 지도 크기에서 휠·드래그만으로도 아쉽지 않다고 보고
  좁혔다.

**검증(헤드리스, 값 자체까지)** — import 확인(project.godot 변경 없음,
texture-a.png.import만 늘 그렇듯 재발생해 되돌림) → 다섯 씬 전부
`--quit-after 5` 세 번 연속 exit 0, 로그를 error/warn/missing/invalid/
cannot로 훑어 한 줄도 없음. **임시 디버그로 실제 값 확인**: 문지방
아래 이동(거리 3.16 < 10)은 안 잠기고(`_drag_confirmed=false`, yaw
불변), 문지방 넘는 이동(거리 58.3)은 잠겨서 `yaw`·`pitch`가
`relative.x`·`relative.y`·`ROTATE_SPEED`(0.006) 공식과 정확히 일치
(0.6-47*0.006=0.318, 0.9-29*0.006=0.726). 마우스 휠로 radius가
`ZOOM_STEP`(14)만큼 정확히 줄고, radius·pitch 둘 다 최소·최대에서
더 밀어도 그대로 멈춰 있는 것(clamp) 확인. 디버그 원상복구(diff 0),
테스트 세이브 없음.

**GUI 실기 확인은 아직 안 함** — 드래그 감도·확대/축소 범위가 실제
손가락·마우스로 자연스러운지는 눈으로 볼 것. 계속 몰아서 받을 것.

**다음 이어질 것** — 전쟁/외교(war.js/diplo.js)·문답(quiz.js) — 성표
탭까지 갖췄으니 realm3d.js식 월드맵 슬라이스는 이걸로 일단락, 다음은
완전히 새 시스템 쪽. 승인 후.


## 3. 전쟁 — 첫 전투 슬라이스: 소패 공략 (2026-09-12)

**사용자 지시 "전쟁 외교 이어해"** — 착수 전에 `war.js`(armyPower/
stepRound/fight)·`diplo.js`(relation/pact)·`rtk-ai.js`·`data-force.js`
시나리오 194를 먼저 조사했다(fork 리서치). 결론:

- `fight(atk, def, wallRef, toId, land, dry)`가 이미 "한 번 부르면
  최대 10합을 굴려 승부를 낸다"는, REALM의 다른 명령들과 같은 "한
  명령 → 한 결과" 모양이다 — 새 판정 구조를 안 만들어도 그대로 옮겨
  붙는다.
- `diplo.js`는 얕지만(relation 스칼라 + envoy() 단발 확률) **이번엔
  안 옮겼다** — 전쟁 쪽이 이미 이번 세션 분량으로 충분해 "전쟁"과
  "외교" 중 하나만 골랐다(사용자 지시가 둘 다였지만, 한 세션에 하나씩
  이라는 이 프로젝트의 관례를 지켰다). 외교는 다음 세션 후보로 남는다.
- `rtk-ai.js`(AI 턴)는 필요 없다 — `forecast()`가 이미 "AI 없이 정적인
  성 수치로 fight()를 그대로 굴려 승산만 재는" 선례라, 첫 공격 목표를
  AI가 움직이지 않는 **고정 수치의 적 성**으로 두면 된다.
- 시나리오 194에서 조조 성 셋에 맞닿은 실제 이웃(data-city.js ADJ)
  중 뭍길·평지라 배(ships)가 안 걸리는 건 허창↔소패(유비령)·허창↔여남
  (원술령)·허창↔완(유표령)·진류↔낙양(이각령) 넷 — 그중 **소패**를
  골랐다(허창과 맞닿았고, `capture()`의 세력 멸망·보스전·랜드마크 같은
  부수 효과가 없는 평범한 소성).

**포함**: `army_power()`/`step_round()`/`fight()` 판정식 그대로(계수
0.055·0.85+0.3·ROUT=0.35·성벽 배율 0.9·공성 배율 0.045 전부 원작 값,
새로 안 지어냈다). 야전/공성 갈림(`sortie = def.troops > atk.troops*
0.85`)도 그대로 — AI 결정이 아니라 그냥 문턱값이라 포함해도 스코프가
안 늘어난다. 승리하면 `captured` 깃발.

**뺀 것(재해석)**:
- 진형·일기토 — 능력치 문턱·확률이 따로 있어 mul=1 고정과 같은 결로
  건너뜀.
- 수전·화공·배 — 소패가 뭍길이라 안 걸림.
- 진영(camp, 여러 달에 걸치는 원정) — 승부가 안 갈리면(stalemate)
  이 슬라이스엔 진영 시스템이 없어 **routed와 같이 취급**(살아남은
  병력이 그냥 돌아간다).
- 함락 뒤처리(무장 배치·태수·치안 반토막·세력 멸망·랜드마크·보스전) —
  이 슬라이스는 정복한 성을 아직 플레이 가능한 성으로 안 들인다(다음에
  볼 자리) — `captured` 깃발만 세운다.
- 수량 선택 UI — `xuchang`(소패와 맞닿은 유일한 우리 성)에 있는
  **전군**을 보낸다. 이 판 다른 명령들처럼 버튼 하나로 결과만 본다.
- **재해석 — 소패 수비 병력(troops_start).** 원작 rtk.js는 모든 성이
  troops=0에서 시작해 AI가 여러 달에 걸쳐 채우는데, 이 슬라이스엔
  적 AI가 없어(그대로 두면 언제 쳐도 병력 없는 성을 시시하게 이기기만
  하는 자리가 된다) 우리 성 셋이 몇 달 굴러 도달할 법한 중간 규모
  (800)를 정적으로 채워 뒀다 — 복양이 처음부터 배 60척을 갖고 시작하는
  것과 같은 결의 재해석("안 그러면 판이 시시해진다").

**구현**:
- `realm_war.gd`(신규, RefCounted) — `army_power()`/`step_round()`/
  `fight()`. atk/def/wall은 Dictionary를 그대로 고쳐 쓴다(war.js가
  `atk.troops -= lossA`로 직접 고치던 것과 같은 결 — GDScript
  Dictionary도 참조 전달이라 그대로 옮겨진다). rng는
  `RealmSaveState._rng`(고정 시드)를 받아 진단 결정성을 지킨다.
- `realm_cities.gd` — `ENEMY_CITIES`(소패 하나, data-city.js 그대로:
  wall_start=3600, land=plain, from_city="xuchang"), `LAND_DEF`/
  `LAND_SIEGE`(data-city.js LAND_TYPES 표 전체 — 하나만 골라 옮기면
  "왜 이건 빼고 저건 옮겼나"는 새 판단이 끼는 셈이라 LAND_AGRI_CAP/
  LAND_COMM_CAP처럼 표 전체를 그대로 들였다), `enemy_by_id()`/
  `land_def()`/`land_siege()`.
- `realm_save_state.gd` — `enemies: Dictionary`(신설, enemy_id→
  {troops,wall,max_wall,train,tech,captured}) + `_init_enemies()`.
  `attack(enemy_id)` — war.js setupMarch()/finishMarch()의 "출진 준비
  → fight() 호출 → 뒤처리"를 좁혀 옮겼다: 전제조건(500명 이상·군량
  2배월치·이 성 소속 무장·이 달 명령 안 씀) → 전군 출진(troops=0,
  food -= need) → `RealmWar.fight()` 호출 → 승리면 captured=true,
  패배/무승부면 생존 병력·치중(baggage=food_upkeep(troops), need의
  정확히 절반)을 원래 성으로 반환. `enemies["xiaopei"]`는 공격할
  때마다 병력·성벽이 그대로 이어진다(재도전이 의미 있게).
  `next_month()`는 enemies를 안 건드린다(적 AI가 없어 매달 그대로).
  SAVE_VERSION 3→4(enemies 추가).
- `realm_attack_button.gd`(신규) + `RealmHUD.tscn`에 "공격" 버튼
  (전임 버튼 바로 위).

**검증(헤드리스, 값 자체까지)** — import 확인(project.godot 변경 없음,
texture-a.png.import만 늘 그렇듯 재발생해 되돌림) → 다섯 씬 전부
`--quit-after 5` 세 번 연속 exit 0, 로그를 error/warn/missing/invalid/
cannot로 훑어 한 줄도 없음. **임시 디버그로 실제 값 확인**:
`army_power(1000,40,100,0,0,0)`=322.0, `army_power(1000,40,100,80,90,1)`
=872.083... 둘 다 손 계산과 정확히 일치. 전제조건 넷(병력 부족·군량
부족·무장 없음·병력<500) 각각 정확한 실패 사유 확인. 실제 전투: 600명
(허창)으로 소패(800명, 성벽 3600) 공격 → `sortie=true`(800>600*0.85)
로 야전 갈림 정확, 무승부(날이 저묾) → 생존 482명·군량 99994(need=12,
baggage=6, 손 계산과 정확히 일치)로 귀환, 소패는 549명으로 줄어든 채
성벽은 그대로(야전이라 공성 피해 없음 — 정확). 이어서 10만 명으로
재공격 → 압도적 물량에 공성 갈림(sortie=false)으로 성벽이 한 합만에
0으로 무너지고(10만×0.045=4500>3600) 소패 함락(`captured=true`).
그 뒤 세 번째 공격 시도 → "이미 함락한 성입니다"로 정확히 막힘.
**병력·성벽이 두 번의 공격에 걸쳐 정확히 이어진 것까지 확인** — 재도전
설계가 의도대로 작동한다. 디버그 원상복구(diff 0), 테스트 세이브 없음.

**GUI 실기 확인은 아직 안 함** — 계속 몰아서 받을 것.

**다음 이어질 것** — 외교(diplo.js, relation/envoy 단발 확률), 함락한
성을 플레이 가능한 성으로 들이는 나머지 절반(다음 목표를 더 늘리려면
`ENEMY_CITIES`에 항목만 추가하면 되는 구조로 짜 뒀다), 또는 문답
(quiz.js) — 어느 쪽이든 승인 후.


## 4. 외교 — 조공·화친 (2026-09-12)

**사용자 지시 "외교도 이어해"** — 3절(전쟁)이 남긴 첫 후보. diplo.js를
다시 읽고 셋 다 좁혔다:

- **동맹(ally)은 안 옮겼다** — 이 슬라이스는 세력이 우리(조조)와 소패
  주인(유비령, 내부 id `bei`) 둘뿐이라 "함께 칠 셋째 세력"이 없다.
  화친(truce, "칠 수 없다")만으로 diplo.js 머리말의 "외교는 시간을
  산다"는 목적이 이미 채워진다.
- **`envoyChance()`의 국력 차(edge)·공동의 적(commonEnemy) 보정도 안
  옮겼다** — `R.summary(force).cities`·`R.ranking()`처럼 세력 여럿의
  성 수·순위를 비교하는데, 이 슬라이스는 `bei`를 온전한 세력으로 안
  굴려서(소패는 정적 수치일 뿐) 그 비교가 성립하지 않는다. 두 항 다
  원래 작은 보정이라 빼도 공식이 안 망가진다.
- **계략(plot: 이간·유언비어·매수·화계)은 통째로 안 옮겼다** — 무장
  충성(loyal) 값을 다루는데, REALM의 로스터엔 그 값 자체가 아직 없다
  (다음에 볼 자리 — loyal을 먼저 들여야 할 자리).

**포함**: `relation`(우호, 0~100 기본 40)·`envoy(kind='tribute')`(round
(gold/120), 1~30, 굴림 없이 확정)·`envoy(kind='truce')`(확률 0.30+지력/
320+우호/260+금/12000, 성공 시 우호+12·8개월 화친, 실패해도 우호+2)를
계수 그대로 옮겼다. `war.js canMarch()`의 `diplo.blocked()` 체크도
`attack()`에 그대로 심어 **화친 중이면 공격이 막힌다** — 원작 문구
"맹약이 있어 칠 수 없습니다"까지 그대로.

**구현**:
- `realm_diplo.gd`(신규, RefCounted) — `truce_chance()`/`tribute_up()`
  순수 함수. 위 "안 옮긴 것" 셋을 머리말에 남겨 다음에 손댈 때 참고할
  수 있게 했다.
- `realm_cities.gd` — `ENEMY_CITIES[0]`에 `force`("bei", 화면에 안
  보이는 내부 키)·`lord`("sg_liubei") 추가. **`force_name`처럼 실명을
  박아 두지 않았다** — 화면에 뭔가 보일 땐 `Characters.find(lord).name`
  으로 이미 가명이 된 이름("인형")을 쓴다(루트 CLAUDE.md 이름 정책 —
  data-force.js 원문은 세력 `name`에 "유비"를 그대로 쓰지만, 그건 웹판
  자신도 아직 못 고친 흠이지 saga-godot이 새로 만들 자리에서 따라 할
  이유가 아니다).
- `realm_save_state.gd` — `diplomacy: Dictionary`(force_id→{relation,
  truce_months}) + `_init_diplomacy()`. `envoy_truce()`/`envoy_tribute()`
  — 사자(지력 으뜸 무장, **위치 무관** — 원작도 성 소속을 안 따진다)를
  보낸다. 수량 선택 UI가 없어 `ENVOY_GOLD`(300)·`TRIBUTE_GOLD`(600)
  고정값(전임·전군출진과 같은 결). `attack()`에 화친 체크 추가.
  `next_month()`가 매달 `truce_months`를 하나씩 깎는다(0에서 멈춘다 —
  원작처럼 키를 지우지 않는 쪽이 `attack()`의 `get(...,0)` 체크와 더
  맞는다). SAVE_VERSION 4→5.
- `realm_diplo_button.gd`(신규) + `RealmHUD.tscn`에 "외교" 버튼(공격
  버튼 바로 위) — `ChoicePrompt` 2지 선택(조공/화친).

**검증(헤드리스, 값 자체까지)** — import 확인(project.godot 변경 없음,
texture-a.png.import만 늘 그렇듯 재발생해 되돌림) → 다섯 씬 전부
`--quit-after 5` 세 번 연속 exit 0, 로그를 error/warn/missing/invalid/
cannot로 훑어 한 줄도 없음. **임시 디버그로 실제 값 확인**:
`truce_chance(70,40,300)`=0.69759615384615, `tribute_up(600)`=5 둘 다
손 계산과 정확히 일치. 조공 실행 → 우호 40→45(gold 3200→2500, 정확히
700 지출) 확인. 화친 실행 → 확률식이 그 시점 우호(45)·사자 지력(100,
현책)으로 0.81057692307692까지 소수점 그대로 일치, 성공 시 우호
45→57·`truce_months=8`·금 정확히 400 지출 확인. **화친 중 10만 병력
공격 시도 → "맹약이 있어 칠 수 없습니다"로 정확히 막힘**(핵심 통합
지점 검증). 그 뒤 `next_month()` 10번 → `truce_months` 8에서 0까지
정확히 깎이고 그 아래로는 안 내려감, `relation`은 그대로(57) 확인.
디버그 원상복구(diff 0).

**GUI 실기 확인은 아직 안 함** — 계속 몰아서 받을 것.

**다음 이어질 것** — 무장 충성(loyal) 값을 들여 계략(plot)의 문을 여는
것, 함락한 성을 플레이 가능한 성으로 들이는 나머지 절반, 또는 문답
(quiz.js) — 어느 쪽이든 승인 후.


## 5. 정복 성 편입 — 소패를 플레이 가능한 성으로 (2026-09-12)

**사용자 지시 "1,2,3 순서대로 다해"** — 4절(외교) 끝에 남은 세 후보
(정복 성 편입/무장 충성+계략/문답) 중 사용자가 순서를 직접 정했다.
그중 첫 번째. 3절이 `captured` 깃발만 세우고 미뤄 둔 "함락 뒤처리
나머지 절반" — war.js `capture()`를 다시 읽어 이 슬라이스가 실제로
쓸 수 있는 부분만 옮겼다.

**포함**: `to.force`(정복 자체, 이제 `cities` Dictionary에 들어가는 것으로
표현) · `to.troops = atk.troops`(원정군 생존 병력이 그대로 수비대) ·
`to.train = atk.train` · `to.sec = max(10, round(sec*0.5))`("갓 뺏은
성은 어수선하다") 계수 그대로.

**뺀 것(재해석)**:
- 수비 무장 달아남/사로잡힘(`fled`/`caught`) — 소패엔 이름 있는 수비
  장수가 없어(`realm_war.gd` 머리말, officer_count=0) 옮길 대상 자체가
  없다.
- 보스전 보상 — 같은 이유(`bossBeaten` 판정 대상이 없다).
- 세력 멸망 판정 — `enemies` Dictionary가 성을 세력별로 묶지 않아서
  "그 세력의 마지막 성을 뺏었는가"를 새로 판정해야 하는데, 상대(`bei`)가
  애초에 소패 하나만 정적으로 들고 있어 이 슬라이스 범위 밖(다음에 볼
  자리).
- 재야 풀(`HIDDEN_POOL_BY_CITY`) — 소패용 항목을 새로 안 만들었다.
  수색하면 "더 찾을 사람이 없다"로 정직하게 끝난다(스코프 확장이 아니라
  "편입" 자체에 집중).

**구현**:
- `realm_cities.gd` — `ENEMY_CITIES[xiaopei]`에 `x`(70)·`y`(43)·
  `agri_start`(220)·`comm_start`(200)·`pop_start`(120000)를 data-city.js
  원문에서 마저 가져왔다(지금까지는 전투에 쓰는 값만 옮겨 뒀었다).
  `any_by_id()`(신규) — CITIES든 ENEMY_CITIES든 정의를 하나로 찾아
  `_land()`/`wall_cap()`/`food_start()`가 정복한 성도 같은 공식을 타게
  했다("재사용" 원칙 — 새 특수 케이스를 안 만든다). `playable_ids()`
  (신규) — 시작 성 셋 + `RealmSaveState.cities`에 편입된 성. `is_adjacent()`
  확장 — `ENEMY_CITIES[].from_city` 간선을 그대로 재사용(새 표 안 만듦).
- `realm_save_state.gd` — `attack()`이 이기면 `_annex_city()`(신규)를
  불러 `cities[xiaopei]`를 채운다. `agri`/`comm`/`pop`은 위 `*_start`,
  `sec`은 위 공식, `tech`는 `enemies[xiaopei].tech`(전투로 안 바뀜),
  `wall`은 공성 끝난 값, `food`/`ships`는 `_init_cities()`가 새 성에
  쓰는 것과 같은 공식(`RealmCities.food_start()`/`ships_start()`).
  SAVE_VERSION 5→6.
- `realm_city_button.gd`/`realm_transfer_button.gd`/`realm_status_label.gd`/
  `realm_worldmap.gd` — `RealmCities.CITIES`/`ids()`/`by_id()`를 쓰던
  자리를 `playable_ids()`/`any_by_id()`로 바꿔 정복한 성이 "성" 선택지·
  전임 목적지·상태 표시줄·월드맵에 그대로 나타나게 했다. 월드맵은
  `_process()`가 매 프레임 `enemies[].captured`를 폴링해(FOREST
  gather_label.gd와 같은 결) 소패가 함락되는 순간 마커를 하나 더 짓는다
  (좌표·색은 새로 들인 x·y·land로 CITIES 마커와 동일하게 잡힌다).

**검증(헤드리스, 값 자체까지)** — import 확인(project.godot 변경 없음,
texture-a.png.import만 늘 그렇듯 재발생해 되돌림) → 다섯 씬 전부
`--quit-after 5` 세 번 연속 exit 0·로그 완전 무결(error/warn/missing/
invalid/cannot 전부 0건). **임시 디버그로 실제 값 확인**: 함락 전
`agri_cap(xiaopei)`=900·`comm_cap`=900·`wall_cap`=7200·`ships_cap`=0
(plain 공식과 정확히 일치), `is_adjacent(xuchang,xiaopei)`=true. 허창
병력 10만으로 재공격 → 함락(`wall 3600→0`) → `cities.xiaopei`=
{agri:220, comm:200, sec:30, tech:100, wall:0, train:40, pop:120000,
troops:99972, food:9760, ships:0} — **전부 손 계산과 정확히 일치**
(sec=max(10,round(60*0.5))=30, food=8000+220*8=9760, troops=100000-
loss_a(28)=99972). `playable_ids()`가 함락 후 `xiaopei`를 포함하는 것,
`transfer_officer`가 이제 허창↔소패를 맞닿음으로 인정하는 것까지 확인.
디버그 원상복구(diff 0), 테스트 세이브 없음.

**GUI 실기 확인은 아직 안 함** — 월드맵에 새 마커가 실제로 자연스럽게
나타나는지, 성 전환이 매끄러운지는 눈으로 볼 것. 계속 몰아서 받을 것.

**다음 이어질 것** — 사용자가 이미 순서를 정했다: 다음은 무장 충성
(loyal) 값을 들여 계략(plot)의 문을 여는 것, 그다음은 문답(quiz.js).


## 6. 무장 충성(loyal) + 계략(plot) 절반 (2026-09-12)

**사용자 지시 "1,2,3 순서대로 다해"** — 두 번째. `officer.js`
`baseLoyal()`/`checkDefection()`, `diplo.js`의 계략(PLOTS) 절을 다시
읽었다.

**포함**: `base_loyal(id)` = 52 + (군주와 trait 같으면 +12) - (rarity-3)*6
- (삼국지 사람이 아니면 -4), clamp 25~85(officer.js 그대로). 시작
무장(현책)·새로 등용된 무장 전부 이 값으로 `officer_loyal`에 채워진다.
`checkDefection()`(월말, 12 이하면 35% 확률로 이탈) — officer.js 그대로.
계략은 유언비어(치안 -10~-22)·화계(군량 -25%~-55%) 둘 — 계수·성공률
공식(0.30+(내지력-태수지력)/200+(60-치안)/400, clamp 0.05~0.9) 전부
diplo.js 그대로. 걸기만 해도 우호 -4, 들통나면 추가 -6(diplo.js
addRelation 그대로). **화친 체크 없음도 원작 그대로** — `plot()`은
`attack()`과 달리 `diplo.blocked()`를 안 본다.

**뺀 것(재해석)**:
- **이간·매수** — 적 무장을 대상으로 하는데(`off.atCity(cityId,
  c.force)` 후보), 소패엔 3절이 밝힌 대로 "이름 있는 수비 장수가
  없다" — 대상 자체가 없어 늘 죽은 버튼이 된다. 유언비어·화계(성
  자체가 대상)만 남겼다. 이간·매수는 적 쪽에 이름 있는 무장을 먼저
  들여야 하는 자리(다음에 볼 자리).
- **국력 차·공동의 적 보정** — plotChance()의 이간/매수 전용 항이라
  애초에 안 옮긴 두 계략용, 여기 있을 이유가 없다.
- **이탈한 무장이 재야로 돌아가는 것** — officer.js는 떠난 사람을
  그 성의 `found`로 되돌리는데, 그러면 재등용 창구가 새로 열리는
  셈이라 스코프가 는다. 이 슬라이스는 로스터·배치·충성 기록에서
  조용히 지운다.

**구현**:
- `realm_diplo.gd` — `LORD_ID`("sg_caocao", data-force.js force('cao').
  lord)·`base_loyal()`·`PLOTS`(rumor·fire 둘)·`plot_chance()`·관련 상수
  (SEC_HIT_*·FOOD_BURN_*·PLOT_*_HIT·PLOT_GUARD_WISDOM=30, "태수가 비어
  있으면"의 원작 기본값 — 이 슬라이스는 적 태수를 안 다뤄 늘 이 값).
- `realm_save_state.gd` — `officer_loyal: Dictionary`(신설, 시작 무장·
  `_do_hire()` 성공 시 채움). `_init_enemies()`에 `sec`/`food` 추가
  (계략의 대상 값, `_init_cities()`와 같은 공식). `next_month()`에
  `_check_defection()` 호출 추가. `plot(kind, enemy_id)`/`plot_preview()`
  /`_plot_check()`(공용 검증) 신규 — 목표 존재·아직 우리 성 아님·맞닿음
  (`playable_ids()` 중 하나라도 `is_adjacent`)·금·무장·이 달 명령 순서로
  검증. SAVE_VERSION 6→7.
- `realm_plot_button.gd`(신규) + `RealmHUD.tscn`에 "계략" 버튼(외교
  버튼 바로 위) — ChoicePrompt에 **계산한 성공률을 미리 보여준다**
  ("계략은 성공률을 숨기지 않는다", diplo.js 머리말 원칙 그대로).

**검증(헤드리스, 값 자체까지)** — import 확인(project.godot 변경 없음,
texture-a.png.import만 늘 그렇듯 재발생해 되돌림) → 다섯 씬 전부
`--quit-after 5` 세 번 연속 exit 0·로그 완전 무결. **임시 디버그로
실제 값 확인**: `base_loyal(sg_zhugeliang)`=52(rarity5·trait 일치
+12·rarity 벌점 -12·삼국지라 0 — 상쇄돼 52), `base_loyal(kr_yisunsin)`
=36(52-12-4), `base_loyal(jp_musashi)`=42(52-6-4) 전부 손 계산과 정확히
일치. `plot_preview(rumor)` chance=0.65(0.30+(100-30)/200+(60-60)/400,
현책 지력100과 정확히 일치) → 실행 → 치안 60→38(hit 22, 범위 10~22
안), 우호 40→36(-4) 정확. 연이어 `plot(fire)` chance=0.705(치안이 38로
바뀐 뒤 재계산 — 0.30+0.35+0.055, 정확히 일치) → 군량 9760→5882(burn
3878, 39.7% — 범위 25~55% 안). 함락 후 `plot()` → "우리 성입니다"로
정확히 막힘(전쟁·정복·계략 세 슬라이스 통합 지점 확인). 충성을 5로
강제하고 `next_month()` 20회 반복 → 로스터에서 정확히 이탈(35%×20회
누적 확률상 당연), `officer_loyal`에서도 같이 지워짐 확인. 디버그
원상복구(diff 0).

**GUI 실기 확인은 아직 안 함** — 계략 메뉴의 성공률 표시가 읽기 좋은지,
버튼 다섯 개가 화면에 다 들어가는지는 눈으로 볼 것. 계속 몰아서 받을 것.

**다음 이어질 것** — 사용자가 이미 순서를 정했다: 마지막으로 문답
(quiz.js).


## 7. 문답(quiz.js) 첫 슬라이스 (2026-09-12)

**사용자 지시 "1,2,3 순서대로 다해"** — 마지막, 완전히 새로운 시스템.
`quiz.js`(출제·채점·보상)와 `data-quiz.js`(문제 260개, 6분야)를 읽었다.

**포함**: `data-quiz.js` BANK 중 **분야마다 다섯 문항**(hist·idiom·
sense·mz·world·proverb, id 앞자리 h~p 01~05, 총 30문항) — id·q·c(보기)·
a(정답)·why(해설) 전부 원문 그대로, 새 문제를 안 지어냈다. 출제
순서(안 익힌 문제 → 쉬운 등급부터, 다 익히면 틀린 것 위주 복습)·
보기 섞기(Fisher-Yates)·채점(첫 정답/복습 구분, 연속 정답)까지 quiz.js
그대로. `rtk.js study()`의 "학식(lore)이 LORE_PER_FIND(6)만큼 쌓이면
재야 하나가 저절로 드러난다"도 그대로 옮겨 **REALM 기존 등용 루프에
바로 연결**했다 — `HIDDEN_POOL_BY_CITY`(재야 두 명, `RealmOfficerPool`)
중 아직 안 드러난 사람을 rarity 순으로 `found[]`에 밀어 넣는다(수색
없이, 지력 판정 없이 — 원작 `revealFree()`와 같다).

**뺀 것(재해석)**:
- **feat·fame·scroll 보상** — 원작은 첫 정답에 공적(feat)·명성(fame)도
  주고 연속 5마다 등용서(scroll) 아이템도 주는데, 이 슬라이스(REALM)엔
  그 축 자체가 없다(player.fame·items.scroll 같은 게 없다). 첫 정답
  보상은 **세력 금고(gold, `rtk.js study()`가 하던 일)와 학식→재야
  공개**만 남겼다.
- **서고(learnedList, 익힌 날짜순 목록)** — UI가 늘어나는 기능이라
  스코프 밖. `quiz.learned`엔 값(true)만 있고 원작처럼 타임스탬프는
  안 남긴다.
- **분야·등급별 진행 현황(progress()의 per/byLv)** — `quiz_progress()`
  는 학습 수·정답률·streak만 축약해 돌려준다. 세부 대시보드는 다음에
  볼 자리.

**구현**:
- `realm_quiz_data.gd`(신규) — `CATS`·`BANK`(30문항)·`LV_NAME`·
  `LV_REWARD`(gold/rgold만, feat/fame/scroll 뺌)·`LORE_PER_FIND`·
  `lv_of()`/`by_id()`.
- `realm_save_state.gd` — `quiz: Dictionary`(신설, qstate()와 같은 모양:
  learned·wrongs·total·correct·streak·best_streak·lore) + `_init_quiz()`.
  `quiz_draw()`(안 익힌 문제 우선, 쉬운 등급부터 — 다 익혔으면 틀린
  횟수 내림차순 상위 1/4에서) → `_present()`(보기 섞기) → `quiz_answer()`
  (채점·보상·오답노트 갱신·lore 누적→`_reveal_free()`). `quiz_progress()`
  축약. SAVE_VERSION 7→8.
- `realm_quiz_button.gd`(신규) + `RealmHUD.tscn` "문답" 버튼(계략 버튼
  위, 맨 위) — ChoicePrompt로 문제·보기 넷을 띄우고 고르면 채점 결과를
  토스트로.

**검증(헤드리스, 값 자체까지)** — import 확인(project.godot 변경 없음,
texture-a.png.import만 늘 그렇듯 재발생해 되돌림) → 다섯 씬 전부
`--quit-after 5` 세 번 연속 exit 0·로그 완전 무결. **임시 디버그로
실제 값 확인**: 30문항 전부 학습될 때까지(첫 문제는 일부러 오답 처리
후 재도전) 40회 출제·채점 → `learned`=30(=BANK 전체)·`answered`=40·
`correct`=39(오답 1회 제외)·`wrongs`={}(틀렸던 문제도 맞히면 지워짐)
전부 정확. `lore`=5 — lv1×20+lv2×9+lv3×1의 학식 합(41)을 6으로 나눈
나머지(41 mod 6=5)와 정확히 일치, 이 과정에서 `_reveal_free()`가
정확히 6번 불려 재야 풀의 전부(kr_yisunsin·jp_musashi 둘)를 소진하고
이후는 조용히 no-op(원작 그대로). `gold` 증분(1532)도 분해해 보니
"첫 정답 30회분 고정 1430" + "복습 정답 9회분 102" — 102는 8×10(lv1
복습)+1×22(lv3 복습)로 정확히 맞아떨어짐(Godot `sort_custom`이 JS
`Array.sort`와 달리 동순위 안정성을 보장하지 않아 quiz.js 손 계산과
"어느 문제가 복습권에 드는지"는 갈릴 수 있지만, 보상 공식 자체는
어느 조합으로도 정확히 들어맞는다 — 코드 결함이 아니라 동순위 처리
차이). 모두 익힌 뒤 재출제 → `review: true`로 정확히 전환됨 확인.
디버그 원상복구(diff 0), 테스트 세이브 없음.

**GUI 실기 확인은 아직 안 함** — 문답 버튼이 다른 다섯 버튼과 함께
화면에 다 들어가는지, 보기 넷 고르는 느낌이 자연스러운지는 눈으로
볼 것. 계속 몰아서 받을 것.

**다음 이어질 것** — 사용자가 지정한 세 가지(정복 성 편입·충성+계략·
문답)를 이걸로 전부 마쳤다. 다음 후보: quiz.js 분야당 문항 더 늘리기,
이간·매수(적 쪽에 이름 있는 무장 들이기 먼저), 서고(learnedList) UI —
어느 쪽이든 승인 후.


## 8. 문답 문항 늘리기 (2026-09-12)

**사용자 지시 "1,2,3 다해줘"** — 7절 끝에 남은 세 후보 중 첫 번째.
`realm_quiz_data.gd`의 BANK를 분야마다 다섯 → 열다섯 문항으로 늘렸다
(h06~15·i06~15·s06~15·m06~15·w06~15·p06~15, data-quiz.js 원문 그대로).
총 30 → 90문항. 로직(`realm_save_state.gd` quiz_draw/answer 등)은
안 건드렸다 — BANK 크기에만 의존하게 짜 뒀던 그대로 자동으로 늘어난
문항 수를 받아들인다.

**검증(헤드리스, 값 자체까지)** — id 90개 전부 유일함(중복 없음, grep로
확인) → import 확인(project.godot 변경 없음) → 다섯 씬 전부
`--quit-after 5` 세 번 연속 exit 0·로그 완전 무결. 임시 디버그로
`RealmQuizData.BANK.size()`=90, `quiz_progress().total`=90, `quiz_draw()`
정상 동작(s02 출제, 보기 섞임) 확인. 디버그 원상복구(diff 0).

**GUI 실기 확인은 아직 안 함** — 계속 몰아서 받을 것.

**다음 이어질 것** — 이간·매수(적 쪽 이름 있는 무장 들이기), 그다음
서고(learnedList) UI.


## 9. 이간·매수 — 적 쪽에 이름 있는 무장 들이기 (2026-09-12)

**사용자 지시 "1,2,3 다해줘"** — 8절 끝에 남은 세 후보 중 두 번째.
data-force.js 시나리오 194 `force('bei').officers` = [sg_guanyu·
sg_zhangfei·rf_mizhu·rf_jianyong] 중 **saga_core characters.gd에
이미 있는 둘만**(sg_guanyu·sg_zhangfei) 소패 수비 무장으로 들였다 —
rf_* 둘은 REALM 전용 데이터(130명+)라 아직 saga_core에 없다(다음에
볼 자리).

**포함**: `officer.js baseLoyal()`을 **군주를 인자로 받게 일반화**해서
(기본값 유지로 기존 호출은 그대로) 소패 무장의 충성 바닥값을 그들의
군주(`sg_liubei`) 기준으로 계산했다. `diplo.js plotChance()`의 이간·
매수 전용 공식(이간: 공통항+(60-대상충성)/300, 매수: 0.15+(70-대상충성)
/100-(대상rarity-3)*0.06+(내지력-태수지력)/400+(60-치안)/400) 그대로.
대상 자동 선택(충성이 가장 낮은 쪽, 군주 제외)도 diplo.js 그대로 —
**군주는 데이터 단계에서부터 `officers` 배열에 안 넣어** 매번 걸러낼
필요가 없게 했다.

**재해석**:
- **이간 성공 시 즉시 이탈 판정.** 원작은 월말 `checkDefection()`이
  12 이하인 사람을 35% 확률로 몰아내는데, 적 로스터엔 월말 정산 자리가
  없다(next_month()는 우리 로스터만 돈다) — 그래서 **이간이 충성을
  12 이하로 떨어뜨리는 순간 같은 굴림(35%)을 그 자리에서 한 번 돈다.**
  판정 확률 자체는 안 바꿨다. 떠나면 `found[]`로 간다(원작 `r.found=true`
  와 같다 — 등용 대상이 된다).
- **매수 성공 시 즉시 합류.** 원작 bribe()가 바로 배치하는 것과 같다 —
  `roster`에 곧장 들어가고(수색·등용 두 단계 생략) `officer_loyal`=40
  (원작 그대로)으로 시작, 위치는 `RealmCities.DEFAULT_CITY`(허창).
- **태수(guard) 지력을 실제 값으로.** 지금까지 rumor·fire는 `PLOT_
  GUARD_WISDOM`(30) 고정값을 썼다(적 태수 정보가 없어서) — 이제 넷 다
  `enemies[eid].officers` 중 지력 최댓값을 쓴다(`_enemy_guard_wisdom()`).
  수비 무장이 남아 있는 동안은 계략이 더 어렵고, 매수·이간으로 다
  빼내면 원래(30)로 돌아간다.
- **전투도 갱신 — `attack()`의 `def_army`가 이제 `enemies[eid].officers`
  를 그대로 반영한다**(officer_count·best_command·best_might). 이름
  있는 수비 무장이 남아 있으면 방어가 실제로 세진다 — 매수·이간으로
  미리 빼내는 것이 전쟁 준비로도 뜻이 생겼다(계략·전쟁 두 슬라이스가
  이번에 실제로 맞물렸다).
- **함락 시 남은 수비 무장은 사로잡혀 재야가 된다** — war.js capture()
  의 caught 분기(소패는 몸 붙일 이웃 성이 없어 fled 분기가 원작에서도
  안 탄다). 매수·이간으로 미리 안 빠진 사람만 이 대상이다.
- **보스전 보상·세력 멸망 판정은 여전히 안 옮겼다** — 옮긴 둘 다 보스가
  아니고, `bei`가 성을 몇 개 들고 있는지 `enemies`가 안 따진다.

**구현**:
- `realm_cities.gd`: `ENEMY_CITIES[xiaopei]`에 `officers: [sg_guanyu,
  sg_zhangfei]` 추가(군주는 안 넣음).
- `realm_diplo.gd`: `base_loyal(officer_id, lord_id=LORD_ID)` 일반화.
  `PLOTS`를 원작 순서(이간·유언비어·매수·화계) 그대로 넷으로. `discord_
  chance()`/`bribe_chance()` 신규. `DISCORD_HIT_*`·`DEFECT_LOYAL_FLOOR`
  ·`DEFECT_CHANCE`·`BRIBE_LOYAL_SET` 신규 — `DEFECT_LOYAL_FLOOR`/
  `DEFECT_CHANCE`는 기존 `_check_defection()`의 하드코딩값(12·0.35)도
  이참에 이 상수를 쓰게 바꿨다(재사용).
- `realm_save_state.gd`: `enemy_officer_loyal: Dictionary`(신설) +
  `_init_enemies()`가 `officers` 배열도 실행 중 값으로 복사해 채운다.
  `_enemy_guard_wisdom()`/`_pick_plot_target()` 신규. `_plot_check()`가
  이간·매수의 대상 선택·확률 계산을 추가로 맡는다. `plot()`이 이간·
  매수 실행 분기를 얻는다. `attack()`의 `def_army`가 `e.officers`를
  반영, 함락 시 남은 수비 무장을 `found[]`로 옮긴다. SAVE_VERSION 8→9.
- `realm_plot_button.gd`: 메뉴에 이간·매수 대상 이름·성공률 표시,
  실행 결과 토스트(충성 변화·이탈·합류) 추가.
- `realm_war.gd`: 머리말만 갱신(판정식 자체는 안 바꿨다 — 애초에
  officer_count>0 분기도 다루는 일반식이었다).

**검증(헤드리스, 값 자체까지)** — import 확인(project.godot 변경 없음,
texture-a.png.import만 재발생해 되돌림) → 다섯 씬 전부 `--quit-after 5`
세 번 연속 exit 0·로그 완전 무결. **임시 디버그로 실제 값 확인**:
`enemy_officer_loyal` 시작값 — 관우 52(rarity5·trait일치+12-12벌점=
상쇄), 장비 46(52-6, trait 불일치) 전부 손 계산과 정확히 일치.
`guard_wisdom`=75(관우 지력, 손 계산과 일치). `bribe_chance`=0.3925,
`discord_chance`=0.47166667 — 공식 그대로 재계산해 소수점까지 정확히
일치. `army_power`(관우·장비 있음)=751.333 vs (없음)=257.6 — 손 계산과
정확히 일치(수비력이 약 3배 차이, 의도한 재균형). 매수 시도(실패,
gold -600 정확) → 이간 10회 반복(대상이 장비→관우로 자동 전환되는 것,
매 시도마다 재계산되는 chance가 손 계산과 전부 일치, 충성 12 이하에서
이탈 판정이 정확히 걸리는 것과 장비가 실제로 이탈해 `found[]`로 가는
것)까지 전부 확인. 디버그 원상복구(diff 0).

**GUI 실기 확인은 아직 안 함** — 계략 메뉴에 대상 이름이 잘 보이는지는
눈으로 볼 것. 계속 몰아서 받을 것.

**다음 이어질 것** — 서고(learnedList) UI. rf_mizhu·rf_jianyong을
saga_core에 들이는 것도 후보로 남는다(승인 후).


## 10. 서고(learnedList) UI (2026-09-12)

**사용자 지시 "1,2,3 다해줘"** — 9절 끝에 남은 세 후보 중 마지막.
quiz.js `learnedList()`(익힌 지식을 최근 순으로 다시 보는 화면)를 옮겼다.

**재해석 — "최근 순"을 시각이 아니라 순번으로.** 원작은 `Date.now()`로
"언제 익혔는지"를 남기는데, 이 슬라이스가 실제 시각을 쓰면 헤드리스
검증의 "세 번 돌려도 같은 결과"가 깨진다(루트 CLAUDE.md 검증 습관 —
시각은 돌린 순간마다 달라진다). 대신 `quiz.total`(그 시점까지 누적
시도 횟수, 항상 증가)을 `quiz.learned[qid]`에 저장해 정렬 키로 쓴다 —
"몇 번째 시도에서 익혔는가"가 곧 "언제 익혔는가"의 순서를 그대로
보존한다(결정적이면서 원작의 "최근 순"과 같은 뜻).

**포함**: 목록 항목마다 분야·등급·문제·정답·해설까지 원작 그대로 다시
보여준다(quiz.js `shortQ()`도 옮겨 메뉴 한 줄엔 줄인 문제만, 고르면
전체를 토스트로).

**뺀 것(재해석)**: `ChoicePrompt.build()`(games/saga_go/ui/choice_
prompt.gd)가 choices 수만큼 패널 높이를 늘리기만 하고 스크롤이 없다 —
학습이 쌓이면(최대 90개) 화면 밖으로 넘치는 패널이 생긴다. 그래서
`quiz_learned_list()`에 `limit`(기본 20)을 둬 **최근 20개까지만**
보여준다. 전체 목록·페이지네이션·분야별 필터 UI는 다음에 볼 자리
(`quiz_learned_list(cat_key, limit)`는 이미 분야 필터 인자를 받게
짜 놨다 — 다음에 UI만 얹으면 된다).

**구현**:
- `realm_quiz_data.gd`: `cat_name()`(분야 key→표시 이름)·`short_q()`
  (26자 넘으면 줄이기, quiz.js 그대로) 신규.
- `realm_save_state.gd`: `quiz_answer()`의 `quiz.learned[qid] = true`
  를 `quiz.learned[qid] = quiz.total`로 바꿨다(위 재해석). `quiz_
  learned_list(cat_key="", limit=20)` 신규 — BANK를 돌며 익힌 것만
  골라 `at`(=quiz.total 당시 값) 내림차순 정렬 후 자른다.
- `realm_archive_button.gd`(신규) + `RealmHUD.tscn` "서고" 버튼(맨 위,
  문답 버튼보다도 위) — ChoicePrompt로 목록을 띄우고 고르면 문제·정답·
  해설을 토스트로.

**검증(헤드리스, 값 자체까지)** — import 확인(project.godot 변경 없음,
texture-a.png.import만 재발생해 되돌림) → 다섯 씬 전부 `--quit-after 5`
세 번 연속 exit 0·로그 완전 무결. **임시 디버그로 실제 값 확인**:
학습 전 `quiz_learned_list()`=[]. 25문항을 순서대로 학습시키고(전부
"첫 정답") 실제 학습 순서를 손으로 기록 → `quiz_learned_list()`가
정확히 그 순서를 뒤집은 것의 앞 20개와 **완전히 일치**(`got == expect`
비교 결과 true). `size()`=20(제한 정확히 적용). `short_q`/`cat_name`
예시 값도 정확. 디버그 원상복구(diff 0), 테스트 세이브 없음.

**GUI 실기 확인은 아직 안 함** — 버튼 열한 개(서고·문답·계략·외교·
공격·지도·전임·성·명령·다음 달·저장, 화면 세로 780px 분량)가 화면에
다 들어가는지, 서고 목록이 읽기 좋은지는 눈으로 볼 것. 계속 몰아서
받을 것.

**다음 이어질 것** — 사용자가 지정한 세 후보(문답 문항 늘리기·이간·
매수·서고 UI)를 이걸로 전부 마쳤다. 다음 후보: 전체 서고·분야 필터
UI, rf_mizhu·rf_jianyong을 saga_core에 들여 소패 수비를 완전하게
하는 것, 또는 REALM 밖의 다른 판(GO/DUNGEON/FOREST/STORY) 작업 —
어느 쪽이든 승인 후.


## 11. 서고 — 전체·분야 필터 메뉴 (2026-09-12)

**사용자 지시 "1,2,3 다 진행해"** — 10절 끝에 남은 세 후보를 전부
승인, 이 중 첫 번째. 서고 버튼을 누르면 곧바로 "최근 20개" 목록으로
가던 것을, 먼저 **"전체" + 학습이 있는 분야만 고르는 메뉴 한 단계**를
더 넣었다.

**설계** — 각 분야는 최대 15문항(8절에서 분야당 5→15로 늘어난 뒤
그대로)이라 `quiz_learned_list(cat_key)`의 기본 `limit=20`에 걸릴 일이
없다 — 분야를 고르면 그 분야를 전부 볼 수 있다("최근 N개"로 잘리는 건
"전체"를 골랐을 때뿐). 아직 한 문제도 안 익힌 분야는 메뉴에서 뺀다
(고를 게 없는 항목을 안 보여준다).

**구현**:
- `realm_save_state.gd`: `quiz_cat_counts()` 신규 — `CATS`를 돌며 분야별
  {key, name, learned, total}을 센다. `quiz_progress()`의 주석만 이
  함수로 위임하도록 손봤다(로직은 그대로).
- `realm_archive_button.gd`: `_on_pressed()`가 이제 1단계 메뉴("전체" +
  분야별 "이름 (익힌/전체)")를 띄우고, 고르면 `_open_list(cat_key, ...)`
  가 그 목록을 연다(기존 `_on_pressed()`가 하던 목록 구성 로직을 그대로
  옮김). `_show_detail()`은 안 바꿨다.

**검증(헤드리스, 값 자체까지)** — import 확인(`--headless --editor
--quit`) → texture-a.png.import 재발생, 이전과 같은 알려진 노이즈라
되돌림(diff 0), 그 외 project.godot·`*.import` 변경 없음 확인. 다섯 씬
전부 `--quit-after 5` 세 번 연속 exit 0·로그 완전 무결(수정 전/후 두 번씩
= 총 30회). **임시 디버그로 실제 값 확인**(`realm_city.gd` `_ready()`에
`_debug_archive_check()`를 잠깐 추가): (1) 90문항 전부 학습 후
`quiz_cat_counts()` 여섯 분야 전부 `15/15`, `quiz_learned_list()`(전체)
size=20(제한 정확), 분야별 `quiz_learned_list(cat_key)` size가 각각
`quiz_cat_counts()`의 `learned`값과 정확히 일치, 필터링 결과에 다른
분야가 섞이지 않음(`filter_ok=true` 전부) 확인. (2) 부분 학습(37/90,
분야별 8·3·8·5·6·7로 고르게 안 나눠짐)에서도 분야별 합(37)이 전체
학습 수와 정확히 일치, 각 분야 목록 크기가 기대값과 정확히 일치 확인.
두 케이스 모두 확인 뒤 디버그 코드(전용 preload·`_ready()` 호출·함수
전부) 원상복구 — `git diff`로 `realm_city.gd` 변경 0줄 확인. 테스트
세이브 없음(`save()` 호출 안 함).

**GUI 실기 확인은 아직 안 함** — 1단계 메뉴가 늘어도 ChoicePrompt 패널이
화면에 다 들어가는지(분야 6개 + 전체 = 최대 7줄), 분야를 고른 뒤 목록
제목이 잘 읽히는지는 눈으로 볼 것. 계속 몰아서 받을 것.

**다음 이어질 것** — 사용자가 승인한 나머지 둘: rf_mizhu·rf_jianyong을
saga_core에 들이는 것, 그리고 REALM 밖 다른 판(STORY가 가장 진도가
얕아 유력) 작업.


## 12. rf_mizhu·rf_jianyong을 saga_core에 들이기 — 소패 수비 완전화 (2026-09-12)

**사용자 지시 "1,2,3 다 진행해"** — 세 후보 중 두 번째. 9절에서 "saga_core
characters.gd에 없어서" 뺐던 유비군 남은 둘(미축·간옹)을 마저 들여 소패
수비 무장을 data-force.js 원문의 넷(sg_guanyu·sg_zhangfei·rf_mizhu·
rf_jianyong) 전부로 채웠다.

**주의 — 이름 정책 예외 처리.** 105명의 기존 HEROES는 "원본(웹판)에서
이미 가명화된 상태를 그대로 옮긴" 것인데, 이 둘의 원본(`saga-realm/js/
data-force.js`)은 **가명화가 안 된 실명 상태**였다(미축/麋竺·간옹/簡雍
그대로 — REALM 전용 데이터라 2026-09-06 HEROES 가명화 작업의 범위 밖에
있었다). 루트 CLAUDE.md 이름 정책("새 역사 인물을 추가할 때 실명을
쓰지 않는다")에 따라 **이 세션에서 처음으로 가명을 새로 지었다**:
미축(麋竺)→**창윤(倉潤)**, 간옹(簡雍)→**언유(言柔)**. id·era·faction·
rarity·trait·stats·emoji·quote는 원문 그대로(quote는 이름을 안 드러내
정책에 안 걸린다).

**구현**:
- `saga_core/data/characters.gd`: `rf_mizhu`·`rf_jianyong` 두 항목을
  삼국지 절 끝(`sg_menghuo` 다음)에 추가. 105명→107명(삼국지 22→24).
  머리말에 이 예외 처리를 기록(다음에 REALM 무장 전체를 옮길 때 같은
  가명을 이어 쓰도록).
- `realm_cities.gd`: `ENEMY_CITIES[xiaopei].officers`를 `[sg_guanyu,
  sg_zhangfei]`에서 data-force.js 원문 그대로 넷으로 채웠다.
- `realm_diplo.gd`, `realm_save_state.gd`(`_enemy_guard_wisdom()`·
  `_pick_plot_target()`·`attack()`의 `def_army`·capture `found[]` 이동)
  전부 **코드 변경 없음** — 이미 `officers` 배열 길이에 안 물리고
  루프로 도는 일반식이었다(9절에서 이렇게 짠 이유가 여기서 그대로
  득이 됐다).

**검증(헤드리스, 값 자체까지)** — import 확인(texture-a.png.import만
재발생, 알려진 노이즈라 되돌림) → 다섯 씬 전부 `--quit-after 5` 세 번
연속 exit 0·로그 무결. **임시 디버그로 실제 값 확인**(`realm_city.gd`
`_ready()`에 잠깐 추가): `officers`=네 id 정확 → `base_loyal()` 재계산
— 관우 52·장비 46(기존과 동일, 회귀 없음)·**미축 52**(rarity3, trait
불일치라 보정 없음)·**간옹 58**(rarity2, (2-3)*6=-6 만큼 오히려 +6)
전부 손 계산과 정확히 일치. `guard_wisdom`=**84**(미축, 지력84로 관우
75보다 높아져 태수 역할이 바뀜 — 의도한 재균형) → 2명일 때(75)와
비교해 변화 확인. `army_power`(4명, troops800·train40·tech100·
command95·might98)=**777.09**(officer_count 보정 (4-1)×0.03=0.09 추가,
2명일 때 751.33에서 손 계산대로 증가) 정확히 일치. `_pick_plot_target`
=장비(로열티 46, 최저) 정확. **함락까지 재현**(허창 병력 10만으로
`attack("xiaopei")` 강제 승리) → `found[]`에 네 명 전부 정확히 들어감,
`enemies.xiaopei.officers`는 빈 배열로 정리됨 확인. 디버그 원상복구
(`realm_city.gd` git diff 0줄), 테스트 세이브 없음.

**GUI 실기 확인은 아직 안 함** — 계략 메뉴에 네 후보(대상)가 다 뜨는지,
이름(창윤·언유)이 자연스럽게 보이는지는 눈으로 볼 것. 계속 몰아서 받을 것.

**다음 이어질 것** — 사용자가 승인한 마지막 하나: REALM 밖 다른 판
작업. STORY가 방금 첫 Vertical Slice 조각만 끝나 진도가 가장 얕다
(3절 참고 아님 — `docs/PROJECT_STATE.md` STORY 항목) — STORY의 "제외"
목록(사냥터 8곳·전직 트리·무예 47개·장비/노획·보스·원거리 적)을
DUNGEON·FOREST가 했던 것과 같은 방식으로 하나씩 채우는 쪽이 유력.

## 13. 인구 자연 증감 + 재해(disaster) (2026-09-13, "saga-godot 이어해")

**사용자 지시 "saga-godot 이어해"** — STORY가 12절(rf_mizhu·rf_jianyong)
이후 여러 세션에 걸쳐 20개 사명 중 19개(r_purse 제외)·업적·전직 트리·
장비/주문서/원거리 적 전부를 채워 더는 STORY 안에 새로 옮길 굵직한
항목이 없어졌다(`docs/PROJECT_STATE.md` STORY 마지막 항목 참고) — GO·
DUNGEON·FOREST도 이미 각자 "제외" 목록을 다 채운 상태라, 4절 "제외"에
남아 있던 REALM 자신의 마지막 항목("성벽 파손율·재해·인구 자연 증감")
으로 돌아왔다.

**구현 범위 — 셋 중 둘.** 재해(disaster)와 인구 자연 증감을 옮기고,
성벽 파손율(wall/maxWall 비율 **표시값**)은 뺐다 — 디오라마가 담장을
늘 꽉 찬 것으로만 그려 그 비율을 보여줄 곳이 없고, 재해(수해)가 wall을
실제로 깎는 효과 자체는 이미 옮겨져 있어 "파손"이라는 현상은 결과로
드러난다(비율 게이지만 없을 뿐).

**공식 — rtk.js settleMonth()/rollDisasters() 그대로**:
```text
grow = pop*0.006*(agri/320)*(secMul(sec)*2-0.8)
  + (재해.pop이 있으면 pop*재해.pop)
  - (sec<35면 pop*0.008)
pop = max(5000, round(pop+grow))
재해 지속 중이면 매달: troops = max(0, round(troops*(1+재해.troops)))
                      wall = max(200, wall+재해.wall)
harvestMul(재해.harvest, 기본 1.0) — goldOf/foodOf 둘 다에 곱해진다
매달 42% 확률로 성 하나(무작위)를 골라 재해가 없으면 새로 건다 —
  치안이 낮을수록(0.55+(60-sec)/200, 0.3~0.9 clamp) "나쁜" 재해 쪽으로
```
5종(가뭄·수해·역병·황충·풍년) 수치 전부 원문 그대로 — `realm_orders.gd`
`DISASTERS`.

**재해석 — "지속되는 동안 매달 다시 적용"은 원작 그대로다.** 처음엔
"시작 달에 한 번만"으로 잘못 짤 뻔했는데, 원작 `settleMonth()`를 다시
읽어 `dz`(disasterByKey)가 **매달 c.disaster로부터 다시 계산**되고
troops/wall 갱신이 매달 같은 루프 안에 있는 것을 확인 — 역병(3개월)은
병력이 매달 5%씩 세 번 준다, 수해(2개월)는 성벽이 두 번(-800) 깎인다.

**구현**:
- `realm_orders.gd` — `DISASTERS`(신규, rtk.js 원문 5종)·`DISASTER_CHANCE`
  (0.42)·`disaster_by_key()`·`POP_GROWTH_*` 상수 넷·`pop_growth_delta()`
  신규. `gold_income()`/`food_income()`에 `harvest_mul` 매개변수(기본
  1.0) 추가 — 기존 호출부는 안 건드려도 그대로 1.0으로 동작.
- `realm_save_state.gd` — 도시 dict에 `disaster`(String, 기본 "")·
  `d_left`(int, 기본 0) 신규(`_init_cities()`·`_annex_city()` 둘 다).
  `next_month()`: 재해 조회(dz) → harvest_mul 반영한 gold/food 수입 →
  기존 굶주림/치안 로직 그대로 → 인구 증감 → 재해 troops/wall 효과 →
  재해 지속시간 감소, 0 되면 해제+Toast. 끝에서 `_roll_disasters()`
  신규(새 재해 배정, 성 선택·good/bad 풀 필터·Toast). `Toast` preload
  신규(이 파일이 처음으로 직접 토스트를 띄운다 — 지금까지는 UI 버튼이
  before/after 값을 diff해 스스로 토스트를 만들었지만, 재해는 "지금
  조망 중인 성"이 아닌 임의의 성에서 일어날 수 있어 버튼의 diff 방식이
  안 맞는다). SAVE_VERSION 9→10(`cities`는 통째로 저장/로드되는 dict라
  구버전 세이브를 로드해도 새 키가 없을 뿐 안 깨지지만, 이 저장소
  관례대로 값이 늘 때마다 버전을 올린다 — 구버전은 그냥 버려진다).
- **검증(헤드리스, 값 자체까지)** — import 확인(texture-a.png.import만
  재발생, 되돌림) → 다섯 씬 `--quit-after 5` 세 번 연속 exit 0·로그
  무결. **임시 씬(`_verify_disaster.tscn/.gd`, STORY가 확립한 "임시
  .tscn+.gd로 autoload 태우기" 방식 그대로)**으로: sec=80·agri=400일 때
  `pop_growth_delta()`가 손 계산과 일치(양의 성장) → sec=20(35 미만
  페널티 포함)일 때 음의 성장으로 뒤집힘 → `_roll_disasters()`를 반복
  호출해(`_rng` 고정 시드) 42% 근처 빈도로 재해가 걸리는지, sec 낮은
  성엔 실제로 "나쁜" 재해가 더 자주 걸리는지 표본으로 확인 → 역병을
  직접 걸어(`c.disaster="plague"`, `d_left=3`) `next_month()` 세 번
  호출 → troops가 매달 5%씩 정확히 세 번 줄고 세 번째 달에 `d_left`가
  0이 되며 disaster가 해제되는 것까지 손 계산과 일치. 수해도 같은
  방식으로 wall이 두 번 -400(계 -800)씩 깎이는 것 확인. 인구는 5000
  바닥(POP_FLOOR) 아래로 안 내려가는 것도 극단값(pop=100, 나쁜 재해)
  으로 확인. 임시 파일 삭제, 재검증까지 마쳤다. `.import` 잡음만
  되돌림. GUI 실기 확인은 아직(몰아서 받을 것) — 재해 토스트가 "다음
  달" 버튼을 누른 화면에서 자연스러운 타이밍에 뜨는지 특히 볼 것.
- **다음에 할 일** — REALM 4절 "제외" 목록엔 이제 성벽 파손율 표시값
  (위 "구현 범위"에서 뺀 이유 참고, 디오라마가 비율을 보여줄 UI가
  없어 굳이 새로 만들 우선순위는 낮다)과 승진/관직 5단·전체 107개 성·
  시나리오 200/208년·타 세력 AI 정도가 남는다 — 전부 새 UI/시스템이
  크게 필요한 항목들이라 다음 세션에서 우선순위를 다시 볼 것. 그 밖엔
  REALM 밖(다른 네 판·saga-unity 트랙)으로.

## 14. 성벽 파손율 + 재해 상시 표시 (2026-09-13, "saga-godot 이어해")

**사용자 지시 "saga-godot 이어해"** — 13절이 "보여줄 UI가 없어" 뺐던
성벽 파손율을 그 UI를 만들어 채웠다. 13절이 남긴 나머지(승진/관직
5단·전체 107개 성·시나리오 200/208년·타 세력 AI)는 전부 존재하지 않는
큰 하부구조(관직 5단만 해도 무장 레벨/경험치/공(功) 시스템 자체가
이 슬라이스에 아예 없다 — officer.js `grow()`/`EXP`/`promote()`를
통째로 새로 들여야 함)가 먼저 필요해 훨씬 크다고 판단, 이번엔 가장
작고 자체완결적인 표시값 하나만 골랐다.

**구현** — 새 시스템 없이 이미 있는 값만 보여준다:
- `realm_status_label.gd` — `RealmCities.wall_cap(city_id)` 대비
  `wall`의 백분율(`🧱 N%`)을 상태줄에 추가. 재해도 지금까지 `next_month()`
  토스트(3초, 시작/해제 순간만)로만 보였던 것을, 재해가 걸려 있는 동안
  `%s %s(%d개월)`(이모지·이름·남은 개월)로 상시 표시하게 했다 — 13절이
  들인 `cities[].disaster`/`d_left`를 이번에 처음 UI에 연결한 것.
- 코드 변경은 이 파일 하나뿐 — `realm_orders.gd`/`realm_save_state.gd`는
  안 건드림(이미 있는 `wall_cap()`·`disaster_by_key()`·`cities[]` 필드를
  읽기만 한다).

**검증(헤드리스, 값 자체까지)** — import 확인(vroid 텍스처류 `.import`
잡음만 재발생, 되돌림) → 다섯 씬(GO·DUNGEON·FOREST·STORY·REALM 각
대표 씬) `--quit-after 5` 오류 0건. **임시 씬(RealmHUD.tscn을
`load().instantiate()`로 통째로 불러 StatusLabel 자식 노드를 찾아
`_process(0.0)`을 직접 호출하는 방식 — STORY가 확립한 "임시 .tscn+.gd로
autoload 태우기"의 REALM 버전)**으로: wall을 wall_cap의 50%로 맞추고
수해를 강제로 걸어 `🧱 50%`·`🌊 수해(2개월)`가 정확히 라벨 텍스트에
나타나는지, 재해를 해제한 뒤엔 그 문구가 사라지는지 확인 후 임시 파일
삭제, 재검증까지 마쳤다. `.import` 잡음만 되돌림. GUI 실기 확인은
아직(몰아서 받을 것) — 상태줄이 길어져도 화면 폭 안에서 줄바꿈되는지
특히 볼 것(다섯 항목이던 게 일곱으로 늘었다).

**다음에 할 일** — REALM 4절 "제외"엔 이제 승진/관직 5단·전체 107개
성·시나리오 200/208년·타 세력 AI만 남는다. 전부 새 하부구조가 필요한
큰 항목이라, 그중 하나를 시작하려면 먼저 범위를 좁히는 결정(예: 관직
5단이면 "무장 레벨/경험치부터"인지 "관직 자체만 먼저 만들고 레벨은
다음"인지)이 필요하다 — 다음 세션에서 그 결정부터. 그 밖엔 REALM
밖(다른 네 판·saga-unity 트랙)으로.

## 15. 둘째 정복 목표 — 하비(下邳, 여포령) (2026-09-13, "saga-godot 이어해")

**"전체 107개 성" 항목을 범위를 정해 조금 옮겼다.** 승진/관직 5단·
시나리오 200/208년·타 세력 AI는 새 하부구조(레벨/경험치/공, 새 지도
데이터, AI 판단 로직)가 통째로 없어 결정부터 필요한 반면, "전체 107개
성"은 이미 있는 `ENEMY_CITIES`(소패 하나뿐이었다) 패턴에 **성 하나를
더 얹는 것**만으로 실제 콘텐츠가 늘어난다 — 새 시스템 없이 데이터
추가만으로 되는 가장 작은 조각이라 이걸 골랐다.

**목표 — 하비(下邳, xiapi), 여포(`sg_lubu`, 기존 105인에 있음)령.**
data-city.js 원문 그대로(agri 320·comm 300·wall 5200·pop 220000·land
river). **`from_city`를 "xiaopei"로 잡아 "소패를 먼저 정복해야 열리는
둘째 단계"로 의도했다** — `realm_cities.gd is_adjacent()`가
`ENEMY_CITIES[].from_city`를 간선으로도 재사용하는 기존 메커니즘을
그대로 이용해(코드 변경 없음), 소패가 `cities`(플레이 가능 성 목록)에
편입돼야만 `attack("xiapi")`의 `cities.has(from_city)` 검사가 통과한다.

**troops_start(1500) — 소패(800)와 같은 재해석, 값만 스케일.** 원작
rtk.js `troops=3000+round(pop/90)` 공식을 쓰면 5444가 나오는데, 소패도
이 공식을 안 쓰고 "우리 성이 몇 달 굴러 도달할 중간 규모"로 정적으로
잡았었다(13절 이전, 2-4절 머리말 참고) — 하비는 인구비(220000/
120000≈1.83)만큼만 올려 둘째 목표다운 난이도 상승만 반영했다.

**officers — 진궁(rf_chengong)·고순(rf_gaoshun) saga_core 신규 편입.**
data-force.js 여포군 그대로(진궁 wisdom92·고순 command90, 둘 다
rarity4). 원본이 실명 상태라(rf_mizhu·rf_jianyong 때와 같은 사정)
이번에 처음 가명을 지었다 — 진궁→**현모(玄謀)**, 고순→**진위(陣威)**.
faction은 위/오/촉 어디에도 안 속해 이미 있던 "군웅"(원소·원술 등)을
그대로 썼다. 여포(`sg_lubu`)는 군주라 이간·매수 후보 목록엔 안 넣는다
(diplo.js "매수 후보에서 군주는 뺀다" 원칙, 소패 때와 같음).
`saga_core/data/characters.gd` 105→109명(삼국지 24→26).

**UI 일반화 — 목표가 하나에서 둘로 늘며 세 버튼을 전부 고쳤다.**
`realm_attack_button.gd`·`realm_diplo_button.gd`·`realm_plot_button.gd`
셋 다 지금까지 `const TARGET := "xiaopei"`로 목표가 고정돼 있었는데,
`realm_city_button.gd`·`realm_transfer_button.gd`와 같은 ChoicePrompt
목록 패턴(공격·외교는 대상 고르기 1단 추가, 계략은 이미 있던 "계략
종류 고르기" 앞에 "대상 고르기" 1단을 더해 2단)으로 바꿨다 — 목표가
셋째로 늘어도 이 파일들은 다시 안 고쳐도 된다(ENEMY_CITIES 데이터만
늘리면 됨). 함락한 곳은 목록에서 뺀다. `realm_save_state.gd`의
`attack()`/`envoy_tribute()`/`envoy_truce()`/`plot()`/`plot_preview()`
전부 이미 `enemy_id`/`target_id`를 매개변수로 받는 일반식이라(9절
rf_mizhu·rf_jianyong 검증 때 확인된 그대로) 코드 변경 없이 그대로
재사용됐다.

**검증(헤드리스, 값 자체까지)** — import 확인(vroid 텍스처류 `.import`
잡음만 재발생, 되돌림) → 다섯 씬(GO·DUNGEON·FOREST·STORY·REALM 각
대표 씬) `--quit-after 5` 오류 0건. **임시 씬(`_verify_xiapi.tscn/
.gd`)**으로: `ENEMY_CITIES.size()==2`·하비 `from_city`="xiaopei"·
troops_start=1500 확인 → `Characters.find("rf_chengong").name`이
"진궁"이 아니라 "현모"(고순도 마찬가지) 확인 → 소패 정복 전엔
`attack("xiapi")`가 정확히 "없는 출진 성"으로 실패 → `is_adjacent
("xiapi","xiaopei")`는 참, `is_adjacent("xiapi","xuchang")`는 거짓 →
`_annex_city()`로 소패를 강제 정복(검증 전용 직접 호출)한 뒤 병력·
군량·소패 배치 장수를 채우면 `attack("xiapi")`가 성공 → `plot_preview
("rumor","xiapi")`도 오류 없이 값을 준다까지 확인 후 임시 파일 삭제,
재검증까지 마쳤다. `.import` 잡음만 되돌림. GUI 실기 확인은 아직
(몰아서 받을 것) — 특히 외교/계략 버튼의 새 "대상 고르기" 1단이
자연스러운지, 하비가 실제로 소패를 정복하기 전엔 공격 목록에 있어도
눌렀을 때 "없는 출진 성" 토스트가 자연스러운지 볼 것.

**다음에 할 일** — REALM 4절 "제외"엔 이제 승진/관직 5단·전체 107개
성 중 하비를 뺀 나머지·시나리오 200/208년·타 세력 AI가 남는다. "전체
107개"는 이런 식으로 하나씩 더 늘릴 수 있지만(다음 후보는 하비와
맞닿은 수춘/壽春(원술령) 등), 승진/관직 5단·타 세력 AI 쪽이 게임성
측면에선 더 묵직한 다음 걸음이다 — 다음 세션에서 우선순위 결정.
그 밖엔 REALM 밖(다른 네 판·saga-unity 트랙)으로.

## 16. "전체 107개 성" — 삼국지 30성 중 나머지 25개 일괄 추가 (2026-09-14, "REALM에서 다음에 뭘 이어갈까" → "성 하나 더 정복지 추가" → "다해 순서대로" → "묻지말고 최대한해")

**15절이 남긴 선택지 중 "성 하나 더"를 사용자가 골랐고, 곧이어 "하나가
아니라 다 해, 순서대로", "묻지 말고 최대한 하라"는 지시가 이어져 —
`data-city.js` 삼국지 30성 중 우리 성 셋(진류·복양·허창)과 이미 정복
목표로 있던 소패·하비를 뺀 **나머지 25개를 한 번에** 넣었다.** 한국·
일본·교주·서역·남중·천축·막북·임읍·균열·폐허·묘역(전체 107성 중 나머지
77개)은 **이번에 안 넣었다** — 이유는 아래 "이번에 뺀 것" 참고.

### from_city — 새로 만든 그래프가 아니라 원작 LINKS를 그대로 훑은 결과

`data-city.js`의 `LINKS`(30성 실제 인접 그래프)를 우리 다섯 성(진류·
복양·허창·소패·하비, 이미 정복 체인에 있음) 뿌리에서 너비우선(BFS)으로
훑어 `from_city`를 계산했다 — 소패→하비가 이미 그 그래프의 한 가지였던
것과 정확히 같은 방식(새 규칙을 안 만들었다). 결과 순서(발견 순):
낙양(진류)·업(복양)·북해(복양)·여남(허창)·완(허창)·수춘(소패)·진양(낙양)·
장안(낙양)·남피(업)·강하(여남)·신야(완)·건업(수춘)·시상(수춘)·천수(장안)·
한중(장안)·계(남피)·양양(강하)·강릉(강하)·회계(건업)·장사(시상)·무위(천수)·
성도(한중)·강주(한중)·북평(계)·영안(강릉). **한 세력이 성을 여럿 가지면
(원소=업/남피/진양, 유표=완/신야/강릉/강하/장사/양양 등) 그 세력이 BFS로
가장 먼저 닿는 성 하나만 정복해도 다음 성으로 이어지는 게 아니라, 그
세력의 각 성마다 도착 조건(from_city)이 다 다르다** — 예: 완을 정복해도
신야가 자동으로 열리지 않고 신야의 `from_city`가 곧 "wan"이라 완을
정복해야 신야가 열린다(체인이 갈라지지 않고 한 줄로 이어진다). 이건
15절 하비까지의 패턴을 그대로 연장한 것뿐, 새 설계가 아니다.

### officers — 세력당 대표 성 하나에만 싣는다

`is_adjacent()`/`attack()`과 달리 `officers`는 **세력 단위**가 아니라
**성 단위**로 실려 있다(`realm_save_state.gd`의 `_init_enemies()`가
`ENEMY_CITIES[].officers`를 성별로 그대로 복사). 원소처럼 성을 셋(업·
남피·진양) 가진 세력의 무장을 세 성 모두에 실으면 이간·매수 때 같은
무장이 세 곳에서 각각 뽑혀 중복 영입될 수 있다 — 그래서 **세력이 BFS로
가장 먼저 닿는 성 하나에만 `officers`를 싣고, 나머지 성은 빈 배열로
둔다**(`lord`는 화면에 "누구 성인지" 보여주는 용도라 그 세력의 모든
성에 그대로 싣는다 — 표시와 영입 대상은 서로 다른 필드다). 검증 스크립트로
36명의 officer id가 어느 성에도 중복 없이 정확히 한 번씩만 나온다는 것,
전부 `Characters.find()`로 찾아진다는 것까지 확인했다(아래 "검증" 절).

### characters.gd — 이번에 처음 가명을 지은 40명 (109명 → 149명, 삼국지 26 → 66)

data-force.js FORCES_194의 조조군을 뺀 나머지 아홉 세력(원소·공손찬·
공융·원술·손책·유표·이각·마등·장로·유장) 소속 무장 40명(군주 9 + 부하
31, `sg_*`로 이미 saga_core 105인에 있는 사람은 다시 안 넣었다 — 예:
원소군의 조운은 `sg_zhaoyun`이 이미 있어 이 40명에 안 들어간다) 전부
name·hanja만 새로 가명을 지었다(원본은 전부 실명). **faction —
data-force.js의 200/208년 표까지 대조해 실제로 위/오/촉 중 한 곳에
재배치되는 게 확인된 사람만 그 세력으로, 나머지는 전부 "군웅".** 장합·
채모·괴량·문빙·가후(208년 표에서 조조군 소속으로 재등장)→"위", 마등·
방덕·한수(208년까지 마초의 세력에 계속 묶임, 마초 본인은 이미 "촉")→
"촉", 손책·정보·황개·한당·주태(손책→손권으로 이어지는 창업 무리, 세
시나리오 내내 함께)→"오". 자세한 이름·근거는 `characters.gd` 2026-09-14
머리말 항목 참고 — 여기서 40명을 다시 나열하지 않는다(4장 원칙).

### 이번에 뺀 것

- **한국·일본·교주·서역·남중·천축·막북·임읍·균열·폐허·묘역(77성)** —
  전부 `force: null`(주인 없음)에 "재야 수비대"(`*_GARRISON`) 방식이라,
  지금 `ENEMY_CITIES` 스키마·`realm_diplo_button.gd`/`realm_plot_button.gd`
  (전부 `force`/`lord` 있는 걸 전제로 목록을 짠다)가 그대로 못 받는다.
  세력 없는 성을 외교/계략 대상 목록에서 빼는 코드, "정복하면 수비대가
  통째로 재야에 풀린다" 같은 다른 영입 경로가 먼저 필요하다 — 데이터만
  욱여넣으면 외교/계략 버튼에 "상대"라는 빈 이름의 성이 뜨는 어색한
  결과가 된다. 균열·폐허·묘역은 여기에 더해 **몬스터 3D 자산 자체가 이
  Godot 프로젝트에 아직 없다**(다섯 판의 Enemy/Boss가 전부 placeholder
  캡슐인 것과 같은 사정, 66-2장 참고) — 이 셋은 자산 이식이 먼저다.
  이 77성은 그래서 **구조가 다른 별도 작업**으로 다음에 남긴다.
- 승진/관직 5단·시나리오 200/208년·타 세력 AI — 13~15절이 이미 여러 번
  적어 둔 것과 같은 이유(새 하부구조 필요)로 여전히 손 안 댔다.

### 검증

헤드리스 임포트(`--headless --editor --quit`) 오류 0건 →
`TestCity.tscn` `--quit-after 5` 오류 0건(다섯 판 대표 씬 전부 확인하던
이전 관례 대신, 이번 변경이 REALM 데이터/캐릭터 파일만 건드려 REALM
대표 씬 하나로 좁혔다 — GO/DUNGEON/FOREST/STORY는 이 두 파일을 안
읽는다). **임시 씬(`_tmp_verify_realm2.tscn/.gd`, 이번엔 `RealmSaveState`
autoload가 필요해 SceneTree 단독 스크립트 대신 Node 씬으로 만들었다 —
bare `--script` 실행은 autoload가 안 걸려 `RealmCities`가 자기 자신의
`RealmSaveState` 참조도 못 찾고 컴파일이 깨졌다, 시행착오 기록)**으로:
`ENEMY_CITIES.size()==27`·주요 인접 간선 17개 참/거짓·모든 성의
`from_city`가 실제로 존재하는 성을 가리키는지·`lord`/`officers` 전부
`Characters.find()`로 찾아지는지·officer id 36개가 중복 없이 한 번씩만
나오는지·`wall_cap`/`food_start`/`agri_cap`/`comm_cap`/`ships_*`가 27개
성 전부에서 안 죽는지·`RealmSaveState.enemies.size()==27`·
`RealmSaveState.diplomacy`에 12개 세력이 다 채워졌는지까지 확인 후 임시
파일 삭제, 재검증(파일이 사라진 채로 다시 임포트 확인)까지 마쳤다.
`.import` 잡음(vroid 텍스처류)만 되돌렸다. GUI 실기 확인은 아직(몰아서
받을 것) — 특히 성 목록이 2개에서 27개로 늘며 "성" 버튼의 ChoicePrompt
목록이 길어졌는데 스크롤이 되는지, 외교/계략의 "누구와" 목록도 마찬가지로
길어졌는데 안 잘리는지 볼 것.

### 다음에 할 일

REALM 4절 "제외"엔 이제 한국·일본·교주·서역·남중·천축·막북·임읍·균열·
폐허·묘역(77성, 구조가 달라 별도 작업)·승진/관직 5단·시나리오 200/208년·
타 세력 AI가 남는다. "전체 107개 성"의 삼국지 30성 부분은 이걸로
**완주**했다(30/30) — 다음은 77성 쪽에 손을 댈지(외교/계략 버튼에
`force`/`lord` 없는 성을 거르는 코드부터 필요), 아니면 승진/관직 5단·
타 세력 AI 같은 새 하부구조 쪽으로 갈지 다음 세션에서 결정. 그 밖엔
REALM 밖(다른 네 판·saga-unity 트랙)으로.

## 17. "전체 107개 성" 완전 완주 — 나머지 77개(한국·일본·교주·서역·남중·천축·막북·임읍·균열·폐허·묘역) (2026-09-14, 같은 날 이어서, "77개 마저 이어해")

**16절이 "구조가 달라 별도 작업"으로 남겨 둔 77개를 이어서 마저
넣었다.** 삼국지 30성과 달리 이 77개는 전부 `force: null`(주인 없음)에
`garrison`(수비 병력) 필드를 쓰는 "재야 수비대" 구조다 — data-city.js·
data-force.js 원문 그대로.

### 코드로 처음 확인한 사실 — diplo.js는 원래부터 주인 없는 성을 거른다

`saga-web/saga-realm/js/diplo.js`의 `plotAt()`을 다시 읽어 확인했다 —
`if (!c.force) return { ok: false, why: '주인 없는 성입니다' }`. 원작
`ui-rtk.js`의 외교 화면(`viewDiplo()`)도 애초에 **성이 아니라 세력
단위**로 목록을 짜서(`R().ranking()`) 주인 없는 성은 세력 자체가 없어
목록에 올라올 일이 없다. 즉 **"주인 없는 성은 외교·계략 대상이 아니다"는
이 포트가 새로 정한 규칙이 아니라 원작이 처음부터 갖고 있던 규칙**이다
— 지금까지 `realm_diplo_button.gd`/`realm_plot_button.gd`가 이 가드
없이도 안 터진 건 삼국지 30성이 전부 `force`가 있는 성이었기 때문일
뿐이다(우연히 안 걸렸던 것). `realm_diplo_button.gd`·`realm_plot_button.gd`
목록 루프에 `if String(e.get("force","")).is_empty(): continue` 한 줄씩
추가해 이 규칙을 처음으로 코드에 옮겼다. **공격(`realm_attack_button.gd`)은
안 고쳤다** — `war.js`의 `march()`는 `to.force`를 아예 안 보고
`from.force !== to.force`만 확인해(§275) 주인 없는 성도 원작부터 공격
대상이다.

### from_city — 11개 지역이 사슬처럼 한 줄로 안 이어진다

`data-city.js LINKS`를 BFS로 다시 훑되, 이번엔 뿌리가 여러 갈래다:
한국(beiping)·일본(한국의 gimhae)·교주(changsha)·서역(wuwei)·남중
(jiangzhou)·천축(남중의 yongchang)·막북(jinyang)·임읍(교주의 rinan)·
균열(일본의 yamato)·폐허(균열의 janyeong)·묘역(폐허의 chimmuk). 한국→
일본→균열→폐허→묘역만 한 줄로 쭉 이어지고, 교주→임읍·남중→천축은
갈래가 갈린다(서역·막북은 삼국지 30성에서 바로 갈라져 나온 독립
가지). 지역 내부 순서·부모는 각 지역의 `LINKS`(예: 한국은
`['yangping','guknae'],['guknae','nakrang']...`)를 그대로 BFS로 훑었다
— 16절과 같은 방식, 새 규칙 없음.

### officers/characters — 이번엔 가명을 안 지었다

99명(11개 지역 × 9인) 전부 `characters.gd`에 **원본 이름 그대로**
편입했다 — data-force.js `KOREA_OFFICERS`~`TOMB_OFFICERS`가 처음부터
`era: "OO(가상)"`로 실존 인물이 아닌 지어낸 이름이라(파소단·독가루·
성혼·거해 등) 16절(삼국지 무장)과 달리 새로 이름을 지을 필요가
없었다. `faction` 필드는 위/오/촉이 아니라 원본 관례 그대로 **그
무장이 지키는 성 이름**을 그대로 썼다. `boss: true`(균열의 fu_
jongwang·막북의 mb_seonwoo·임읍의 ly_jeonchung·폐허의 ru_geohae·묘역의
tb_baekgi)와 `monster`(균열·폐허·묘역의 실제 3D 모델 경로)는 이 스키마에
없는 필드라 **옮기지 않았다** — 지금 REALM엔 보스전 보상 배율도, 3D
몬스터 렌더링도 없다(다섯 판의 Enemy/Boss가 전부 placeholder 캡슐인
것과 같은 사정, 66-2장 참고). 나중에 이 두 시스템이 생기면 그때
데이터를 다시 대야 한다.

### 재해석 — troops_start=garrison, food는 여전히 공용 공식

`troops_start`는 원작 `seedNeutral()`(`troops = garrison`) 그대로 —
25개 성 때(인구비 스케일)와 다른 결이다. 반면 **food는 여전히
`RealmCities.food_start()`(8000+agri×8) 공용 공식을 그대로 쓴다** —
원작은 `food = garrison*2`로 이 성들만 따로 계산하지만, 그 갈래를
새로 안 만들었다(이미 지역별 특수 케이스를 늘리지 않는 게 15~16절의
일관된 결). wall도 원작은 `wall = maxWall`(성장 여지 없음)로 두지만
이 포트의 `wall_cap()`은 이미 있는 대로 `wall_start×2`를 그대로
돌린다 — 어차피 정복 전엔 wall_cap이 화면에 안 쓰이고, 정복 후엔
이 포트가 "정복한 성은 일반 성과 똑같이 큰다"는 그대로 전제를 유지하는
쪽이 낫다고 판단했다.

### 검증

헤드리스 임포트 오류 0건 → `TestCity.tscn --quit-after 5` 오류 0건.
임시 씬(`_tmp_verify_realm3.tscn/.gd`, 16절과 같은 Node 방식)으로:
`ENEMY_CITIES.size()==104`(27+77) · 11개 지역 진입 간선(예: `is_adjacent
("wuwei","dunhuang")`) · 지역 내부 갈림길 간선(`wirye`가 `geumseong`·
`gimhae` 둘 다로 이어짐, `chikushi`가 `hyuga`·`izumo` 둘 다로 이어짐,
`hoegok`이 `yeokbyeong`·`janhyang` 둘 다로 이어짐) 참 확인 · 모든
`from_city`가 실제 존재하는 성(합쳐 107개)을 가리키는지 · `lord`/
`officers` 전부 `Characters.find()`로 찾아지는지 · officer 135명(기존
36 + 이번 99)이 전부 유일한지 · 27개 성만 `force`가 있고 나머지 77개는
비어 있는지 · `wall_cap`/`food_start`/`agri_cap`/`comm_cap`/`ships_*`가
104개 성 전부에서 안 죽는지 · `RealmSaveState.enemies.size()==104` ·
`RealmSaveState.diplomacy`에 빈 문자열 키가 없는지(주인 없는 77개가
실제로 빠졌는지) · `Characters.HEROES` 248명(149+99) 전부 표시 이름이
서로 겹치지 않는지까지 확인 후 임시 파일 삭제, 재검증까지 마쳤다.
`.import` 잡음만 되돌렸다. GUI 실기 확인은 아직(몰아서 받을 것) — 특히
"공격" 목록이 이제 104개 성을 다 보여주는데(대부분 아직 "없는 출진
성"으로 막힐 것), ChoicePrompt가 이 규모에서 스크롤이 되는지, 그리고
`realm_worldmap.gd`의 지도 좌표계(원래 삼국지 3성 기준 `GROUND_SPAN`=
260·`WORLD_SCALE`=14)가 서역(x -58)·묘역(y 148)처럼 훨씬 먼 좌표까지
왔을 때 마커가 지면 밖으로 밀려나 보이지는 않는지 — **이건 데이터
정합성과 별개로 아직 손 안 댄 시각적 사안**이라 다음 항목에 남긴다.

### 다음에 할 일

**"전체 107개 성" 자체는 완전히 끝났다(107/107).** 남은 건: (1)
`realm_worldmap.gd`의 좌표계가 지금 3성 기준으로 잡혀 있어 방금 늘어난
넓은 좌표 범위(-58~236, -15~148)에서 마커가 지면(`GROUND_SPAN`) 밖으로
나가지 않는지 GUI로 먼저 봐야 한다 — 필요하면 `map_center()`/
`GROUND_SPAN`/`WORLD_SCALE`을 playable_ids() 전체 기준으로 다시 잡는
손질이 뒤따를 수 있다. (2) 승진/관직 5단·시나리오 200/208년·타 세력
AI — 여전히 새 하부구조가 필요해 손 안 댔다. (3) 정복 후 관리(무장
배치·태수·치안 반토막 등, attack() 머리말 참고)·보스전 보상·3D 몬스터
자산(균열·폐허·묘역) — 전부 다음 자리. 그 밖엔 REALM 밖(다른 네 판·
saga-unity 트랙)으로.

## 18. 월드맵 좌표계 실기 수정 — GROUND_SPAN·LOOK_AT (2026-09-14, 같은 날 이어서, "월드맵 좌표계 몰아서 말고 지금 바로 확인해줘")

**17절 끝에서 "GUI로 먼저 봐야 한다"고 남긴 걸, 사용자가 미루지 말고
지금 확인하라고 지시해 바로 손댔다.** 헤드리스 임시 스크립트로 107개
성 전부의 월드 좌표를 뽑아 보니 **103/107개가 `GROUND_SPAN`(260, 반경
130) 바깥**이었다 — 심지어 하비(xiapi, 세 번째로 만든 정복 목표)도
이미 260 밖(224, 5)에 있었다. 가장 먼 성 진혼(jinhon)은 원점에서 2679
단위. 원인은 둘:

1. **`GROUND_SPAN`(바닥 평면 크기)이 처음 3성 클러스터(반경 130)만
   가정한 값**이라 16·17절에서 107성을 다 채운 지금은 절대다수가 바닥
   밖에 뜬다.
2. **`realm_worldmap_camera.gd`의 `LOOK_AT`이 원점에 상수로 고정**돼
   있어, 궤도 반경(`RADIUS_MAX`=420)으로는 원점에서 420 단위 안쪽만
   갈 수 있다 — 원점에서 985(중앙값)~2679 단위 떨어진 성 대부분은
   카메라가 아예 도달 못 한다.

**다행히 이웃 성끼리(from_city 간선)의 실측 거리는 전부 420 안쪽이다**
(임시 스크립트로 106개 간선을 전부 재 봄 — 가장 먼 것도 367, 잔재↔폐도).
그래서 두 가지를 고쳤다:

- `RealmCities`에 `WORLD_SCALE`(기존 `realm_worldmap.gd`에 있던 14.0,
  값은 그대로)과 `world_pos(city_id)`(성 id 하나로 바로 월드 좌표를
  계산하는 공용 헬퍼)를 신설 — 카메라 쪽도 이 값을 봐야 해서 옮겼다.
- `realm_worldmap.gd`: `GROUND_SPAN` 260 → **6000**(평면 메시는
  세분 없는 사각형 하나라 커져도 비용이 없다). `_world_pos()`는
  `RealmCities.WORLD_SCALE`을 참조하도록 바꿈(중복 상수 제거).
- `realm_worldmap_camera.gd`: `LOOK_AT` 상수(원점 고정) → **`_look_at`
  변수, 매 프레임 `RealmCities.world_pos(RealmSaveState.current_city)`
  로 갱신**. 궤도(반경·pitch·yaw)는 그대로 두고 **축만 "지금 조망 중인
  성"을 따라가게** 했다 — 정복해 나가며 조망 대상을 옆 성으로 옮길
  때마다(이미 있는 "성표 탭으로 조망 전환" 상호작용) 축이 따라와 매번
  반경 420 안에서 다음 이웃 성이 보인다. 카메라를 자유팬으로 다시
  설계하지 않고 축만 바꿔 전체 지도를 커버한 것 — "이웃끼리는 가깝다"는
  이 판의 지리적 사실을 그대로 이용했다(새 메커니즘이 아니다).

### 검증(이번엔 실기 GUI까지 — 사용자가 "지금 바로" 요청)

- 헤드리스 임포트 + `TestCity.tscn --quit-after 5` 오류 0건.
- 임시 스크립트로 재확인: **107개 성 전부 `GROUND_SPAN` 안쪽**(고치기
  전 103개 밖 → 고친 뒤 0개 밖), 최대 간선 거리 367 < `RADIUS_MAX`
  420(참).
- **PowerShell 스크린샷으로 실제 확인**(saga-godot CLAUDE.md 절차) —
  임시 씬(`TestCity.tscn`을 그대로 인스턴싱 + `viewing_map=true`를
  강제하는 래퍼 스크립트)으로 두 장을 찍었다: (1) `current_city=
  "xuchang"`(원래 3성 클러스터, 늘 되던 자리) (2) `current_city=
  "dayuan"`(대완, 서역 서쪽 끝 — 고치기 전이었다면 원점에서 2647
  단위 떨어져 바닥이 안 보였을 자리). **두 스크린샷 모두 같은 바닥
  평면이 카메라 아래 그대로 나타난다** — 상단 상태줄의 "지금 보는 성"
  이름이 실제로 바뀐 것도 확인(HUD가 `current_city`를 그대로 읽는다는
  뜻). 다만 **다이유안은 아직 정복 전이라 마커 자체는 없다**(마커는
  정복한 성에만 선다, `_check_annexed()`) — 이번 확인은 "바닥이
  있는가·카메라가 닿는가"까지만 본 것이고, 실제 마커·색·간판이 이
  거리에서 어떻게 보이는지는 정복이 실제로 벌어져야 다시 볼 수 있다.
  환경(`env_pc.tres`)의 뿌연 톤 자체는 66-2장이 이미 알고 있는 별개
  사안이라 이번 확인 범위 밖으로 남긴다.
- 스크린샷·임시 씬·임시 스크립트 전부 확인 후 삭제, `taskkill`로 GUI
  Godot 프로세스 정리, `.import` 잡음만 되돌림.

### 다음에 할 일

REALM 4절 "제외"는 17절과 같다(승진/관직 5단·시나리오 200/208년·타
세력 AI·정복 후 관리·보스전 보상·3D 몬스터 자산) — 이번 항목은 순수하게
17절이 남긴 시각 버그 하나를 마저 잠근 것이다. 다음 세션은 이 넷 중
아무거나 골라도 되고, REALM 밖(다른 네 판·saga-unity 트랙)으로 가도
된다 — 사용자가 "다음 거 묻지 말고 이어가라"고 지시했으니, 다음
세션은 우선순위를 사용자에게 되묻지 않고 위 목록 중 가장 작고
자체완결적인 것부터 스스로 골라 진행할 것.

## 19. 승진/관직 5단 (2026-09-14, 같은 날 이어서, "사가고돗 이어해" → "묻지말고 순서대로 다 진행해")

4절 "제외"에 오래 남아 있던 항목 중 첫째. `saga-web/saga-realm/js/
hero.js`(MAX_LV=30·MAX_RANK=5·LV_STEP=0.022·RANK_STEP=0.06·expNeed·
growMul)와 `officer.js`(EXP·promoteCost·RANK_KOR·promote())를 그대로
옮겼다 — 새 판정식을 상상하지 않는다. 새 파일 `realm_growth.gd`(상수·
순수 함수)와 `realm_save_state.gd`의 `officer_growth`(officer_id →
{lv,exp,rank,feats})가 짝을 이룬다.

**재해석 — EXP 종류를 이 슬라이스에 있는 시스템만큼만 옮긴다.** 원작
EXP는 order/march/siege/win/duel/gov 여섯인데, siege(진영 없음)·
duel(일기토 없음)은 뺐다. order(개발형·징병 명령)·gov(태수로 한 달
버팀)·march(출진)·win(함락)만 옮겼다 — 전부 이 슬라이스에 이미 있는
자리(`_do_devel`/`_do_draft`→`_grant_order_growth()`, `next_month()`의
태수 계산, `attack()`의 출진·함락)에 한 줄씩 꽂았다.

**능력치를 쓰는 자리를 전부 한 함수로 좁혔다.** hero.js 머리말의
"계산이 두 곳으로 갈라지면 화면과 판정이 어긋난다"를 그대로 따라
`_effective_stat(id, stat_key)`(기본치 × growMul)를 새로 두고, 기존에
`Characters.find(id).stats.get(...)`을 직접 읽던 아홉 자리(명령 성과
굴림·수색·등용·태수 고르기·출진 대장/수비 무장·최적 무장 고르기·
정전/계략을 보내는 무장·계략 대상 지력) 전부 이걸 거치게 바꿨다.
아직 관직이 없는 무장(대부분)은 lv=1·rank=0(배율 1.0)이라 화면에 보이는
기존 수치가 하나도 안 바뀐다 — 승진해야 비로소 갈린다.

새 UI: **"승진" 버튼**(`realm_promote_button.gd`, RealmHUD 맨 위,
ArchiveButton 위) — `realm_transfer_button.gd`와 같은 ChoicePrompt
1단(무장 고르기 하나로 끝) 패턴. 목록에 "이름 — 관직명 Lv.N (공
F/필요치)"를 보여줘 승진에 얼마나 남았는지 버튼을 누르기 전에 안다
(diplo.js "계략은 성공률을 숨기지 않는다"와 같은 결).

세이브: `SAVE_VERSION` 10→11(`officer_growth` 추가). 검증(헤드리스) —
임포트 오류 0건, 다섯 씬(TestVillage/TestRoom/TestVillageForest/
TestField/TestCity) 각각 `--quit-after 5` 오류 0건, TestCity 세 번
연속 로그 완전 동일. 임시 씬(`_tmp_verify_growth`)으로 exp_need·
grow_mul 손계산 일치·레벨업 시 effective stat이 growMul만큼 실제로
커짐·공 부족 시 승진 거부→공 채운 뒤 성공(관직명·충성 반환값 확인)·
MAX_RANK에서 막힘·`execute_order`가 devel 경로에서 feats+1/충성+1/
exp+EXP.order를 실제로 얹음·저장→값 흩트림→불러오기 왕복(lv/exp/
rank/feats 네 값 모두 복원)까지 확인 후 임시 파일·테스트 세이브
삭제, 재검증까지 마쳤다. `.import` 잡음만 되돌림. GUI 실기 확인은
아직(몰아서 받을 것) — "승진" 버튼 목록 문구가 잘 읽히는지, 실제
플레이에서 몇 달 만에 첫 승진이 나오는지 특히 볼 것.

**다음에 할 일(19절 작성 당시 예상)** — 시나리오 200/208년부터 이어갈
생각이었으나, 실제로 조사해 보니 순서를 바꿨다(20·21절 참고).

## 20. 정복 후 관리 — attack() 승리 시 무장을 새 성으로 배치 (2026-09-14, 같은 날 이어서, "묻지말고 순서대로 다 진행해")

19절 다음으로 시나리오 200/208년에 손대려 했으나, `attack()` 머리말의
"관리 인계(무장 배치·태수·치안 반토막 등)는 옮기지 않았다" 주석을 다시
보니 **이미 낡아 있었다** — `_annex_city()`(2026-09-12)가 치안 반토막·
agri/comm/pop 편입·`troops`/`train` 승계까지 진작 다 옮겨 놨는데, 정작
war.js capture()의 `off.placeAt(atk.officers[i], toId, newForce)`(이끌고
간 장수를 새 성에 앉히는 한 줄)만 안 옮겨져 있었다. 그 결과 성을
정복해도 아무도 배치되지 않아 `_governor_at()`이 늘 ""를 돌려주고, 새
성은 태수 배율(govMul)의 이득을 하나도 못 받는 채로 방치되고 있었다 —
"정복 후 관리"가 사실상 이 한 줄만 빠진 상태였다. `attack()` 승리
분기에 `officer_city[officer_id] = enemy_id`를 추가해 바로잡았다(
`_governor_at()`이 officer_city를 매번 다시 훑는 구조라 태수를 따로
저장할 필요가 없다). 낡은 머리말도 실제 구현에 맞게 정정.

검증(헤드리스): 임시 씬으로 소패를 확실히 이기도록 판을 짠(아군 병력
5만·적 병력 0) 뒤 함락 → `officer_city[oid]==xiaopei`·`_governor_at
(xiaopei)==oid`·`xiaopei in playable_ids()`까지 확인. 다섯 씬 각각
`--quit-after 5` 오류 0건, 임시 파일 삭제·`.import` 잡음 되돌림.

## 21. 보스전 보상 (2026-09-14, 같은 날 이어서, "묻지말고 순서대로 다 진행해")

20절 다음으로 실제 우선순위를 다시 봤다 — 시나리오 200/208년과 타 세력
AI는 "우리 성 셋만 있다"는 이 슬라이스의 전제 자체를 흔드는 큰 재설계
(200/208년은 조조가 처음부터 8~19개 성을 갖고 시작해 지금의 cities/
enemies 이원 구조로는 못 담는다, 타 세력 AI는 열두 세력 전부에 살림·
로스터·war.forecast() 사본까지 필요하다)라 다음 세션에서 범위를 먼저
좁혀야 한다고 판단, 그사이 **보스전 보상**(작고 자체완결적)을 먼저
끝냈다.

`js/data-force.js`를 다시 뒤져 `boss: true`가 실제로 **여섯** 명
(tz_beonwang·mb_seonwoo·ly_jeonchung·fu_jongwang·ru_geohae·tb_baekgi,
천축·막북·임읍·균열·폐허·묘역 각 지역 허브 하나씩)에 있다는 걸 확인했다
— 17절 때 옮겨 적은 머리말이 "다섯"(천축 누락)이라고 잘못 적어 뒀던
걸 이번에 바로잡았다(`saga_core/data/characters.gd` 머리말).
`characters.gd`의 이 여섯 항목에 `boss: true`만 얹었다(`monster`는
여전히 안 옮김 — 3D 몬스터 렌더링 자체가 없다).

`realm_save_state.gd attack()` 승리 분기에 war.js capture()의
`bossBeaten` 처리를 그대로 옮겼다 — 함락 직전 수비 명단(`def_officers`,
아직 안 지워진 시점)에서 `boss:true`인 사람을 찾으면 금 600(원작
`bonusGold` 그대로)을 얹는다. **재해석 — 유물은 안 준다.** 원작은
`ID.randomItem()`으로 유물도 하나 씌우는데, 이 슬라이스엔 장비/유물
시스템 자체가 없어(REALM에 `data-item.js` 대응이 없다) 금 보너스만
옮겼다 — `quiz_answer()`가 feat/fame/scroll을 뺀 것과 같은 결. `attack()`
반환값에 `boss_beaten`(이름, 없으면 빈 문자열)을 추가하고
`realm_attack_button.gd`가 함락 메시지에 "👑 보스급 수비 무장 OO 을(를)
꺾었다! 금 600" 한 줄을 덧붙이게 했다(보스 격파 시 토스트 표시 시간도
1.5초 늘렸다 — 두 줄이라 읽을 시간이 더 필요하다).

검증(헤드리스): 임시 씬으로 (1) 여섯 id 전부 `boss:true`를 실제로
갖고 있는지, (2) 신독(shendu, tz_beonwang 소속)을 확실히 이기도록
판을 짜 함락 → `boss_beaten=="번왕"`·금이 정확히 600 늘어남을 확인,
(3) 보스 없는 하비(xiapi)를 같은 방식으로 함락 → `boss_beaten==""`·
금 보너스 없음까지 확인 후 임시 파일 삭제. 다섯 씬 각각 `--quit-after
5` 오류 0건, `.import` 잡음 되돌림. GUI 실기 확인은 아직(몰아서 받을
것) — 토스트 두 줄이 화면에서 안 잘리는지 볼 것.

**다음에 할 일** — REALM 4절 "제외"엔 이제 시나리오 200/208년·타 세력
AI·3D 몬스터 자산(균열/폐허/묘역)만 남는다. 셋 다 위에서 밝힌 대로 새
하부구조가 필요한 큰 항목 — 시나리오는 "성 소유권이 동적으로 바뀌는"
구조 재설계, 타 세력 AI는 열두 세력의 살림·로스터·전투 예측을 통째로
갖추는 일, 3D 몬스터 자산은 saga-godot 66-2장 결의 카툰 셰이더/에셋
파이프라인과 맞물린다. 다음 세션은 이 셋 중 먼저 **범위부터 좁히는
결정**(예: 3D 몬스터 자산은 균열 하나만, 몬스터 하나만 먼저 등)을
사용자와 확인하거나 스스로 가장 작게 쪼개서 시작할 것. 그 밖엔 REALM
밖(다른 네 판·saga-unity 트랙)으로.

## 22. 타 세력 AI 첫 슬라이스 — 적이 되받아친다 (2026-09-14, 같은 날 이어서, "묻지말고 이어해")

21절 끝에서 "시나리오 200/208·타 세력 AI·3D 몬스터 자산 셋 다 범위부터
좁혀야 한다"고 남겼던 것 중, 조사해 보니 **타 세력 AI가 가장 작게
쪼갤 여지가 있었다** — rtk-ai.js 전체(경제 성장 pickOrder·승진·사자·
계략까지)를 옮기는 대신, "다른 세력이 실제로 행동한다"(4절 "제외"의
원문)의 가장 눈에 띄는 절반인 **"적이 우리 성을 친다"**만 먼저 옮겼다.
전투 판정은 `attack()`이 이미 쓰는 `RealmWar.fight()` 그대로 재사용
(새 판정식 없음) — 공격/수비 배역만 뒤집는다.

**재해석 — 셋.**
- **creed(성향) 차등을 아직 안 옮겼다.** rtk-ai.js는 aggressive/
  balanced/turtle마다 손실 허용치·빈도가 다른데, 그 표(`data-force.js
  force.creed`) 자체가 이 슬라이스엔 없다(REALM 게임데이터의
  `enemies[].force`는 이름표일 뿐, 세력 성향 테이블이 아니다) —
  `AI_MARCH_CHANCE`(0.20) 하나로 "친다/안 친다"만 가른다. 경제 성장
  AI(pickOrder)를 옮길 때 creed 표도 같이 볼 것.
- **AI가 이겨도 성을 뺏지 않는다.** 세력 멸망/패배 판정이 이 슬라이스에
  없어(attack() 머리말·4절 "제외" 참고) 플레이어가 성을 전부 잃는 막다른
  상태를 만들 위험을 피했다 — 승패 판정 자체(RealmWar.fight 공식)는
  그대로 굴리되, 그 결과로 생긴 troops/wall 변화만 반영하고 소유권은
  안 건드린다.
- **주인 없는 성(재야 수비대, force가 빈 문자열)은 움직이지 않는다** —
  diplo.js "주인 없는 성은 계략 대상이 아니다"와 같은 결(외교/계략
  버튼이 이미 쓰는 가드, 17절 참고). 화친 중(`diplomacy[].
  truce_months>0`)이면 그 세력은 쉰다(war.js canMarch()의 diplo.
  blocked() 체크와 같은 자리).

새 함수 셋(`realm_save_state.gd`): `_run_enemy_ai()`(매달 `next_month()`가
부른다 — `_check_defection()` 다음, `_roll_disasters()` 전) ·
`_weakest_adjacent_playable(enemy_id)`(우리 성 중 병력 최소인 인접
성을 고른다) · `_enemy_attack(enemy_id, e, target_id)`(수비 측은 그
성에 배치된 무장 **전원**을 센다 — player attack()이 공격 측에서 하나만
데려가는 것과 다르다, 수비는 원래도 그 성에 있는 사람 전부가 함께
막는다는 rtk.js `off.atCity()` 그대로). 같은 달에 여러 성이 공격받으면
메시지를 모아 토스트 하나로 보여준다(Toast가 한 줄만 표시하는 구조라
겹쳐 사라지는 것을 막았다).

검증(헤드리스): 임포트 오류 0건, 다섯 씬 각각 `--quit-after 5` 오류
0건, TestCity 세 번 연속 로그 완전 동일. 임시 씬으로 (1) 재야 성은
`force`가 빈 문자열임을 확인, (2) 소패(bei 세력)의 병력·자질을 압도적
으로 올리고 50개 시드를 훑어 최소 한 번은 실제로 공격이 터짐(허창
병력이 실제로 줆·소유권은 안 바뀜)을 확인, (3) 그 세력을 화친 상태로
두면 50개 시드 전부에서 그 세력만은(다른 세력의 독립적 공격과는 무관)
안 움직임을 확인 — 후 임시 파일·테스트 세이브 삭제, 재검증까지 마쳤다.
`.import` 잡음만 되돌림. GUI 실기 확인은 아직(몰아서 받을 것) — 여러
성이 한 달에 같이 공격받았을 때 토스트 줄바꿈이 안 잘리는지 볼 것.

**다음에 할 일** — REALM 4절 "제외"엔 이제 시나리오 200/208년·3D 몬스터
자산·(이번에 일부러 미룬) creed 차등 경제 AI·세력 멸망 판정이 남는다.
시나리오 200/208년은 여전히 "성 소유권이 시나리오마다 다르다"는 큰
재설계가 필요해 범위를 먼저 좁혀야 한다. 3D 몬스터 자산도 마찬가지
(REALM엔 몬스터를 보여줄 장면 자체가 없다). 그 밖엔 REALM 밖(다른 네
판·saga-unity 트랙)으로.

## 23. 타 세력 AI — creed(성향) 차등 (2026-09-14, 같은 날 이어서, "묻지말고 이어해" 두 번째)

22절이 균일 확률(`AI_MARCH_CHANCE` 하나)로 미뤄 둔 "creed 차등"을
마저 옮겼다 — 완전히 새 항목을 벌이는 대신, 방금 만든 22절 기능을
더 다듬는 자연스러운 다음 조각이라 우선순위를 이걸로 잡았다(시나리오
200/208년·3D 몬스터 자산은 여전히 범위부터 좁혀야 하는 큰 재설계라
보류).

`realm_cities.gd`에 `CREED`(force_id→'aggressive'/'balanced'/'turtle',
`js/data-force.js FORCES_194`의 `creed` 필드 그대로, cao 제외 12개
세력)와 `creed_of()`/`creed_chance_mul()`을 추가했다. **재해석 —
rtk-ai.js 자체엔 "친다/안 친다" 확률표가 없다**(실제 판단은 매번
`war.forecast()`로 다시 계산한다, 이 슬라이스엔 그 예측 판정이 없다) —
creed를 "얼마나 자주 치려 드는가"로 옮긴 단순화다: aggressive
1.5배·balanced 1.0배·turtle 0.35배를 `AI_MARCH_CHANCE`에 곱한다.
`_run_enemy_ai()`가 이 배율을 실제로 곱해 쓰도록 한 줄만 바꿨다.

검증(헤드리스): 임포트 오류 0건, 다섯 씬 각각 `--quit-after 5` 오류
0건, TestCity 세 번 연속 로그 완전 동일. 임시 씬으로 `creed_of()`/
`creed_chance_mul()` 손계산 일치(bu=aggressive×1.5, biao=turtle×0.35,
shao=balanced×1.0, 없는 force_id는 balanced 기본값)와, 같은 시드
구간(300회)에서 aggressive 쪽 성공 횟수가 turtle 쪽보다 실제로 많이
나옴(86 vs 19, 기댓값 0.30 vs 0.07과 부합)까지 확인 후 임시 파일 삭제,
재검증까지 마쳤다. `.import` 잡음만 되돌림. GUI 실기 확인은 아직
(몰아서 받을 것).

**다음에 할 일** — REALM 4절 "제외"엔 이제 시나리오 200/208년·3D
몬스터 자산·(economy) pickOrder AI(같은 CREED 표를 lossCap/keepGold
축으로 다시 쓸 자리)·세력 멸망 판정이 남는다. 앞 둘은 여전히 큰
재설계가 필요하다. 그 밖엔 REALM 밖(다른 네 판·saga-unity 트랙)으로.

## 24. 세력 멸망/승패 판정 (2026-09-14, 같은 날 이어서, "묻지말고 이어해" 세 번째)

23절이 남긴 넷(시나리오 200/208년·3D 몬스터 자산·economy AI·세력
멸망 판정) 중 **세력 멸망 판정**이 실제로 조사해 보니 가장 작았다 —
rtk.js `checkResult()`는 단 두 줄짜리 판정이다("우리 성이 0개면 패배,
`st.cities` 전체를 다 가지면 승리"). 그대로 옮겼다: `check_result()`가
`cities.size()`가 성 우주 전체(기본 3 + 정복 대상 104 = 107)에
닿으면 `result = "win"`을 굳힌다. `next_month()` 끝에서 매달 부른다.

**재해석 — "lose"는 이 슬라이스에서 도달 불가능하다.** 22절("타 세력
AI")이 "AI가 이겨도 성을 뺏지 않는다"고 이미 정해 둬 `cities`가 절대
비지 않는다 — 새 안전장치를 또 만든 게 아니라 그 결정의 자연스러운
결과다. rtk.js `endMonth()`의 `if (!st.started || st.result) return
null;`도 옮겼다 — `result`가 정해지면 `next_month()`가 그 자리에서
아무 일도 안 한다("다음 달" 버튼도 미리 그 상태를 감지해 "이미 승부가
났습니다"로 안내, `realm_month_button.gd`). `SAVE_VERSION` 11→12
(`result` 필드).

검증(헤드리스): 임포트 오류 0건, 다섯 씬 각각 `--quit-after 5` 오류
0건. 임시 씬으로 (1) 성 셋만 가진 상태에선 승패 미정·(2) 나머지
104개를 전부 우리 성으로 만들면 즉시 "win"·(3) 그 뒤 성을 다시
줄여도 결과가 굳어 안 바뀜·(4) `result`가 정해진 뒤 `next_month()`를
불러도 연·월이 안 바뀜·(5) 저장→값 초기화→불러오기로 "win"이 복원됨
까지 확인 후 임시 파일·테스트 세이브 삭제, 재검증까지 마쳤다.
`.import` 잡음만 되돌림. GUI 실기 확인은 아직(몰아서 받을 것) —
실제로 107개 성을 다 정복하는 건 현재 명령 체계로 아주 오래 걸리므로
승리 토스트 문구가 화면에서 안 잘리는지 정도만 확인하면 된다.

**다음에 할 일** — REALM 4절 "제외"엔 이제 시나리오 200/208년·3D
몬스터 자산·economy pickOrder AI(CREED 표를 lossCap/keepGold 축으로)만
남는다. 셋 다 이번 세션이 반복해서 "범위부터 좁혀야 한다"고 판단한
큰 재설계 — 다음 세션은 사용자와 방향을 확인하거나, 그중 하나를 더
잘게 쪼갤 방법을 먼저 찾을 것. 그 밖엔 REALM 밖(다른 네 판·
saga-unity 트랙)으로.

## 25. economy pickOrder AI — 적 성 passive 성장 (2026-09-14, 같은 날 이어서, "사가고돗 이어해 묻지 말고")

24절이 남긴 셋(시나리오 200/208년·3D 몬스터 자산·economy AI) 중
economy AI를 조사해 보니 rtk-ai.js `pickOrder()`를 통째로 옮기는 건
여전히 크다 — 원래 우선순위(sec→agri→comm→wall→ships→draft→train→
agri→comm→tech→sec)가 agri/comm/food/pop/ships/gold를 전제하는데,
이 슬라이스의 적(`enemies[eid]`)은 그 값 자체가 없다(`troops`·`wall`·
`max_wall`·`train`·`tech`·`sec`·`food`·`officers`뿐 — `_init_enemies()`
참고, 원래 전투·계략 대상 값만 있었다). **범위를 실제로 있는 네
필드(sec/wall/train/tech)로 좁혀서 이번에 끝냈다** — agri·comm·
draft·ships·시장(trade)·승진(promote, 적은 이미 관직 개념이 없다)은
빠졌다.

`realm_save_state.gd`에 세 함수 추가:
- `_enemy_pick_order(e)` — pickOrder 우선순위 그대로(sec<45 → sec,
  wall<maxWall*0.7 → wall, train<70 → train, tech<400 → tech,
  sec<85 → sec), 넷 다 문턱을 채웠으면 빈 문자열(더 할 일 없음).
- `_best_enemy_officer(officers, stat_key)` — bestFor() 축약, `e.
  officers`(정적 정의를 복사해 든 배열, `_init_enemies()` 참고) 중
  그 자질이 가장 높은 사람.
- `_run_enemy_economy()` — `RealmOrders.ORDERS`의 sec/wall/train/tech
  항목(`base`·`per`·`stat`)과 `_roll_amount()`가 이미 쓰는 대성공 공식
  (`round((base + stat*per) * (crit ? 1.5 : 1))`, crit률 `clamp(stat/
  400, 0.03, 0.28)`)을 그대로 재사용해 값을 올리고, 각 필드의 캡(sec
  100·train 100·tech 900·wall은 `max_wall`)에서 멈춘다. `captured`거나
  장수가 하나도 없는 적은 건너뛴다. **금 소모가 없다** — 적에게 금고
  자체가 없어(플레이어처럼 명령을 "사는" 구조가 아니다), 세력이 살아
  있는 한 매달 공짜로 자란다. `next_month()`가 `_run_enemy_ai()` 뒤에
  부른다.

**재해석 — 이게 메우는 구멍.** 이전까지 `troops`/`wall`/`sec`/`train`/
`tech`는 전투·`realm_plot_button.gd`(유언비어)로 **내려가는 경로만**
있고 올라가는 경로가 하나도 없었다 — 한 번 계략·전투로 깎은 적 성은
플레이어가 손대지 않는 한 영영 그 값에 멈춰 있었다. `troops`(병력)
자체는 여전히 이 슬라이스에 회복 경로가 없다(원작 rtk-ai.js도 draft로
인구를 깎아 병력을 만드는 구조라 이 슬라이스의 적에겐 pop이 없어
옮길 수 없다 — 범위 밖으로 남긴다).

검증(헤드리스): 임포트 오류 0건, 다섯 씬 각각 `--quit-after 5` 세
번 연속 로그 완전 동일(`.import` 잡음만 되돌림, `project.godot`은
이번엔 안 건드려짐). 임시 씬(`_tmp_verify_econ`)으로 (1) 넷 다 낮게
만들면 sec가 최우선으로 뽑힘·(2) 한 틱 뒤 sec만 오르고 wall/train/
tech는 그대로·(3) sec≥45면 다음 우선순위(wall)로 넘어감·(4) wall을
`max_wall*0.7` 근처에 두고 여러 틱 굴려도 `max_wall`을 못 넘음·(5)
sec 근처에서도 100을 못 넘음·(6) `captured=true`인 적은 손 안 댐·(7)
네 필드가 전부 문턱을 채운 적은 `_enemy_pick_order`가 빈 문자열까지
확인 후 임시 파일 삭제, 재검증까지 마쳤다. GUI 실기 확인은 아직(몰아서
받을 것) — 여러 달 굴렸을 때 적 성이 실제로 더 단단해지는 체감은
사람이 직접 몇 달 돌려봐야 보인다.

**다음에 할 일** — REALM 4절 "제외"엔 이제 시나리오 200/208년·3D
몬스터 자산 둘만 남는다. 둘 다 여전히 큰 재설계(시나리오는 세력·시작
성 배치 자체가 달라지고, 3D 몬스터 자산은 새 렌더링 하부구조가
필요하다) — 다음 세션은 사용자와 방향을 확인하거나 더 잘게 쪼갤
방법을 먼저 찾을 것. 그 밖엔 REALM 밖(다른 네 판·saga-unity 트랙)으로.

## 26. 3D 몬스터 자산 — 첫 걸음: 미정복 성을 지도에 세우기 (2026-09-14, 같은 날 이어서, "이어해 묻지 말고")

25절이 남긴 둘(시나리오 200/208년·3D 몬스터 자산) 중 3D 몬스터 자산을
다시 조사했다 — 실제 GLB 몬스터 모델을 만들어 붙이는 건 여전히 66-2장
카툰 셰이더/에셋 파이프라인과 맞물린 큰 일이지만, **그전에 더 근본적인
구멍을 발견했다**: `realm_worldmap.gd`가 지금까지 `CITIES`(우리 성 3)와
정복한 성만 마커를 세우고 있어서, 아직 안 뺏은 104개 성은 지도에서
**아예 안 보였다** — 적이 어디 있는지, 보스가 어느 성에 있는지 지도
만으로는 전혀 알 수 없던 상태. 몬스터 3D 모델이 없어도 이 구멍부터
메우는 게 먼저라고 보고, **실제 몬스터를 세우는 대신 색으로 구분한
자리표시자를 세우는 걸 이번 슬라이스로 잡았다**(다른 다섯 판의
Enemy/Boss가 GLB 전엔 다 캡슐 placeholder였던 것과 같은 결).

`realm_worldmap.gd`:
- `_build_marker(c)` → `_build_marker(c, color)` — 우호/적/보스 어느
  색을 세울지는 이제 호출부가 정한다(전엔 안에서 `_land_color()`로
  고정 유추).
- `_ready()`가 `CITIES`(우호색) + `ENEMY_CITIES` 104개 전부(미정복이면
  `COLOR_ENEMY`, 보스급 수비 무장이 있으면 `COLOR_BOSS`, 이미 정복된
  세이브라면 우호색)를 한 번에 세운다 — 이제 마커 총량이 항상
  `CITIES.size() + ENEMY_CITIES.size()`(107)다.
- `_is_boss_city(eid)` 신규 — `enemy_by_id(eid).officers` 중
  `Characters.find(oid).boss == true`인 사람이 있는지(`attack()`의
  bossBeaten 판정과 같은 기준, 21절). 여섯 지역 허브(천축·막북·임읍·
  균열·폐허·묘역)가 여기 걸린다.
- `_check_annexed()` — **마커를 새로 짓지 않고 색만 바꾸도록 갈아
  끼웠다**(마커 자체는 `_ready()`에서 이미 다 있다). `_annexed_seen`
  (eid→true, 한 번 우호색으로 바뀌면 다시 안 본다)을 새로 뒀다.
- `_on_marker_input()` — **미정복 성은 눌러도 `current_city`가 안
  바뀐다.** `RealmSaveState.cities.has(city_id)`로 갈라, 우리 성이면
  전처럼 조망 대상을 바꾸고, 아니면 이름(+보스면 "보스급 수비")만
  토스트로 보여준다. 이 가드가 없으면 `realm_city.gd`/명령 실행 전부가
  전제하는 "current_city는 항상 `cities`에 있다"(3절 "포함")가 깨진다.

**재해석 — 왜 진짜 몬스터가 아니라 색인가.** GLB 몬스터를 세우려면
지역별 실루엣·스케일·아웃라인 셰이더 결정이 먼저 필요한데(66-2장이
아직 REALM엔 안 들어왔다), 그 결정은 사람의 시각 판단이라 코드만으로
못 끝낸다. 색 구분은 그 결정을 기다리지 않고도 "적이 어디 있는지
보인다"는 실제 이득을 바로 준다 — 나중에 진짜 몬스터 모델이 들어오면
`COLOR_ENEMY`/`COLOR_BOSS` 자리에 그 모델을 얹기만 하면 되므로 버려지는
작업도 아니다.

검증(헤드리스): 임포트 오류 0건, 다섯 씬 각각 `--quit-after 5` 세 번
연속 로그 완전 동일(`TestCity.tscn`이 이 월드맵을 실제로 인스턴스화해
`_ready()`의 107개 마커 생성 경로를 그대로 통과했다). 임시 씬
(`_tmp_verify_map`)으로 (1) 마커 총량이 정확히 107·(2) 미정복 성의
`_base_color`가 `COLOR_ENEMY`/`COLOR_BOSS` 중 하나(우호색이 아님)·(3)
`_is_boss_city`가 여섯 곳에서만 true·(4) 미정복 성 마커를 탭해도
`current_city` 불변·(5) 우리 성 마커를 탭하면 정상적으로 바뀜·(6)
정복 시뮬레이션 후 `_check_annexed()`가 `_base_color`를 우호색으로
바꾸고 `_annexed_seen`에 기록함까지 확인 후 임시 파일 삭제(시뮬레이션한
captured 값도 원상복구), 재검증까지 마쳤다. `.import` 잡음만 되돌림.
GUI 실기 확인은 아직(몰아서 받을 것) — 특히 107개 마커가 다 세워진
월드맵이 카메라 성능·탭 판정 밀도(근접한 성끼리 탭이 헷갈리지 않는지)
면에서 실제로 괜찮은지는 사람이 봐야 안다.

**다음에 할 일** — REALM 4절 "제외"엔 이제 **시나리오 200/208년** 하나만
남는다. 여전히 큰 재설계(조조가 처음부터 8~19개 성을 갖는 걸 지금의
`cities`/`enemies` 이원 구조로 못 담는다, 20절 머리말 참고) — 다음
세션은 사용자와 방향을 확인하거나 더 잘게 쪼갤 방법을 먼저 찾을 것.
3D 몬스터 자산 자체(GLB 모델)는 이 절로 "구멍은 메웠지만 진짜 모델은
여전히 없다"는 상태로 66-2장 아트 파이프라인이 REALM까지 올 때를
기다린다. 그 밖엔 REALM 밖(다른 네 판·saga-unity 트랙)으로.

## 27. 시나리오 200년(관도) — 첫 걸음 (2026-09-14, 같은 날 이어서, "이어해 묻지 말고")

26절까지 "큰 재설계"라고만 적어 둔 마지막 항목을 실제로 뜯어봤다.
걱정했던 것과 달리 **필요한 자료는 이미 다 있었다** — `ENEMY_CITIES`
104개 전부가 애초에 `agri_start`/`comm_start`/`pop_start`/`wall_start`/
`troops_start`/`train_start`/`tech_start`를 갖고 있다(data-city.js가
107개 성 전체에 원래 공통으로 주는 값이라, `cities`(3개)만 쓰던
이 슬라이스가 지금까지 안 썼을 뿐이다 — `_annex_city()`가 정복 시
이미 이 값들로 새 `cities` 항목을 짓고 있었다, 그 "신선한 버전"이면
됐다). 진짜 막혀 있던 건 자료가 아니라 **"성 하나가 지금 누구 것인가"를
어디서 읽는가**였다 — 아래 참고.

`js/data-force.js FORCES_200`을 옮겼다: 조조가 처음부터 8개 성(허창·
진류·복양 + 낙양·장안·소패·하비·수춘)을 갖는다. 194에만 있던 세력
여섯(공손찬 zan·공융 rong·이각 jue·여포 bu·원술 shu·손책 ce)은 200엔
없다 — 그 성은 조조 몫이 되거나(낙양·장안은 jue, 소패는 bei, 하비는
bu, 수춘은 shu) 남은 세력에게 재배정된다(계·북평은 zan→shao, 북해는
rong→shao, 건업·시상·회계는 ce→quan(손책이 손권이 된 것뿐, 성은
그대로), 여남은 shu→bei).

`realm_cities.gd`:
- `SCENARIO_CAO_CITIES`(194/200 조조 시작 성 목록)·
  `SCENARIO_FORCE_OVERRIDE`(200에서 194 기준 force가 실제로 달라지는
  7개 자리만) 신규.
- `CREED`에 `"quan": "balanced"` 추가(FORCES_200.quan.creed 그대로 —
  기존 기본값과 우연히 같지만 명시해 둔다).

`realm_save_state.gd`:
- **`city_force: Dictionary`(city_id→force_id) 신규 — "지금 누구 것인가"의
  유일한 출처.** 예전엔 6곳(외교·계략·전투)이 전부 `enemy_def.get("force",
  "")`로 194 기준 정적값을 직접 읽었다 — 시나리오가 그 값을 겹쳐 쓸 수
  없는 구조였다. `_init_city_force(overrides)`가 `RealmCities.
  SCENARIO_FORCE_OVERRIDE[scenario_id]`를 겹쳐 써서 채우고(조조 몫이 된
  성은 아예 뺀다 — "적의 세력" 개념 자체가 없다), `force_of(city_id)`
  하나로 좁혀 6곳 전부와 `_init_diplomacy()`가 이걸 쓰게 갈아 끼웠다.
- `_init_cities()`/`_init_enemies()`를 `scenario_id`로 일반화 — 194의
  세 성은 지금까지처럼(troops=0, RealmOrders 기본 상수), 시나리오가
  추가로 준 성(낙양 등 5개)은 그 성 자신의 `_start` 값들로 채운다("이미
  자리 잡은 성을 물려받는다"). `_init_enemies()`는 조조 몫이 된 성을
  건너뛴다(한 성이 `cities`와 `enemies` 둘 다에 있으면 안 된다).
- **`start_scenario(id)` 신규** — 위 넷(`_init_city_force`·`_init_cities`·
  `_init_enemies`·`_init_diplomacy`) + `_init_quiz`를 다시 부르고
  로스터·연월·금고·결과를 새로 시작한다(rtk.js setup() 금고 공식
  `2000 + cities.size()*400`을 성 개수가 달라진 시나리오에도 그대로
  적용 — 200은 5200). **아직 이걸 부르는 UI가 없다** — "새 게임"
  시나리오 고르기 화면은 다음 슬라이스 몫(REALM 4절 "포함"에 아직
  "새 게임" 자체가 없다, 지금까지 게임은 언제나 194로만 부팅했다).
- `save()`/`try_load()`에 `scenario_id` 추가(SAVE_VERSION 12→13).
  `city_force`는 파생값이라 저장하지 않고 불러온 뒤 다시 채운다.

**놓칠 뻔한 것 — 정적 `ENEMY_CITIES`를 직접 훑던 UI 세 곳.**
`realm_attack_button.gd`·`realm_diplo_button.gd`·`realm_plot_button.gd`가
전부 `RealmCities.ENEMY_CITIES`(107개 지도 전체, 시나리오 무관)를 직접
돌며 `RealmSaveState.enemies.get(eid, {}).get("captured", false)`만
봤다 — 194에선 이 둘(정적 전체 vs 실제 적)이 늘 같은 집합이라 문제가
없었지만, 200에서 조조 몫이 된 5개 성은 `enemies`엔 없는데 여전히
`ENEMY_CITIES`엔 있어 **세 버튼 다 그 성을 "공격/외교/계략 대상"으로
잘못 보여줄 뻔했다**(제일 먼저 눈에 띈 건 `realm_worldmap.gd` — 우호
마커를 `RealmCities.CITIES`(194 고정 3개) 기준으로만 세워서, 200의
낙양 등 5개는 우호 마커도 못 받으면서 동시에 적 마커까지 받을
뻔했다). 세 버튼 다 `if not RealmSaveState.enemies.has(eid): continue`
가드를 앞에 추가했고, 월드맵은 우호 마커 루프를 `RealmCities.CITIES`
대신 `RealmSaveState.cities.keys()`로 바꿨다 — "지금 우리 성이 뭔가"는
언제나 `RealmSaveState.cities`가 유일한 출처가 되도록 통일했다.

**재해석 — 뺀 것.** 로스터는 시나리오와 무관하게 여전히 무장 한 명
(`STARTING_OFFICER`)뿐이다 — 이 슬라이스가 처음부터 "로스터 전체를
안 준다, 수색/등용으로 채운다"는 원칙이라(2-4절), 200의 조조 로스터
12명을 그대로 옮기지 않았다. `realm_diplo_button.gd _lord_name()`은
여전히 성의 **정적** `lord` 필드를 읽는다 — 200에서 force가 재배정된
7개 성(계·북평·북해·건업·시상·회계·여남)은 이 라벨이 194 기준 옛
군주 이름을 보여준다(예: 계는 "고문"(shao)에 속하게 됐지만 라벨은
여전히 원소가 아니라 공손찬 쪽 이름을 읽는다) — `force_of()`가
갈랐지만 `lord`는 성마다 정적으로 하나뿐이라 아직 안 건드렸다. 실제로
드러나려면 "새 게임 200 시작" UI 자체가 먼저 있어야 하니, 그 UI를
붙일 때 같이 고칠 자리로 남긴다.

검증(헤드리스): 임포트 오류 0건, 다섯 씬 각각 `--quit-after 5` 세 번
연속 로그 완전 동일(194 기본 부팅 경로는 전혀 안 바뀌었다는 뜻).
임시 씬으로 (1) 194 기본 부팅 — cities 3·enemies 104·force_of(xiaopei)
=="bei"·force_of(ye)=="shao"·재야(빈 force) 뺀 distinct force 12개,
(2) `start_scenario("200")` — cities 8·enemies 99·총합 107·조조의 8개
성이 cities엔 있고 enemies엔 없음·기존 3성(xuchang)은 troops=0 그대로·
새 5성(luoyang)은 troops_start 그대로 물려받음·7개 재배정
force_of 전부 기대값과 일치·조조 몫 성은 force_of=""·**diplomacy가
정확히 7개(죽은 항목 없음)**·current_city=="xuchang"·gold==5200·
year==200, (3) 다시 `start_scenario("194")`로 왕복 — cities 3·
enemies 104·gold 3200·force 12개로 정확히 원복까지 확인 후 삭제,
재검증까지 마쳤다. `.import` 잡음만 되돌림. GUI 실기 확인은 아직
(몰아서 받을 것) — 특히 "새 게임 200" 진입점이 아직 없어 이 함수는
사람이 직접 눌러 볼 방법이 아직 없다(다음 항목).

**다음에 할 일** — REALM 4절 "제외"가 **완전히 비었다**(포함 항목
전부 구현, 제외 항목 전부 최소 한 걸음씩 진행). 남은 굵직한 일은
전부 이 절이 미리 표시해 둔 후속 작업이다: (1) "새 게임" 시나리오
고르기 UI(이게 있어야 `start_scenario()`를 사람이 실제로 눌러 볼 수
있다, 208도 이 UI가 생긴 뒤 곁들일 것 — 208은 손권·유비 동맹 pact도
추가로 필요하다) (2) `_lord_name()` 등 라벨류가 force 재배정을 못
따라가는 자리 정리 (3) 3D 몬스터 자산(GLB, 66-2장). 그 밖엔 REALM
밖(다른 네 판·saga-unity 트랙)으로도 진지하게 고려할 자리 — REALM
"포함" 목록 자체는 이제 다 채워졌다.

## 28. 시나리오 재배정 라벨 정리 — lord_of() (2026-09-14, 같은 날 이어서, "이어해 묻지 말고")

27절이 "다음에 할 일" (2)로 남긴 것. `realm_diplo_button.gd _lord_name()`이
성의 **정적** `lord` 필드(194 기준)를 직접 읽어서, 200에서 force가
재배정된 7개 성(계·북평·북해→shao, 건업·시상·회계→quan, 여남→bei)의
"외교 — 누구와" 목록이 여전히 옛 주인 이름(공손찬·공융·손책·원술)을
보여줄 뻔했다.

`realm_cities.gd`에 `FORCE_LORD`(force_id→그 세력 군주, `data-force.js`
각 FORCES_* 항목의 `lord` 그대로 — 세력은 시나리오가 바뀌어도 군주가
안 바뀐다, 손책→손권처럼 force id 자체가 바뀌는 quan만 예외로 명시)
신규. `realm_save_state.gd`에 `lord_of(city_id)` 신규 —
`force_of(city_id)`가 이미 답한 "지금 세력"을 `FORCE_LORD`로 한 번 더
거친다(재야 성은 force가 없어 자연히 빈 문자열). `_lord_name()`이 이
함수를 쓰도록 갈아 끼웠다 — `enemy_def`(정적 조회) 자체를 더는 안 쓴다.

검증(헤드리스): 임포트 오류 0건, 다섯 씬 각각 `--quit-after 5` 세 번
연속 로그 완전 동일. 임시 씬으로 194에서 `lord_of(jixian)`=="공손찬
그대로"·`lord_of(xiaopei)`=="유비"·재야 성은 빈 문자열, `start_
scenario("200")` 뒤 `lord_of(jixian)`=="원소"(재배정 확인)·
`lord_of(jianye)`=="손권"(ce→quan 인물 교체 확인)·`lord_of(runan)`==
"유비"(shu→bei)·`lord_of(ye)`=="원소"(안 바뀐 자리도 여전히 맞음)·
`lord_of(luoyang)`==""(우리 성이 됨) 전부 확인, `Characters.find()`로
실제 표시 이름("패항" 등)까지 뽑아 본 뒤 삭제, 재검증까지 마쳤다.
`.import` 잡음만 되돌림.

**다음에 할 일** — REALM 4절 "제외"의 후속 작업 중 이제 (1) "새 게임"
시나리오 고르기 UI (2) 3D 몬스터 자산(GLB, 66-2장) 둘만 남는다. 둘 다
새 UI/렌더링 하부구조가 필요하다 — 다음 세션은 방향을 확인하거나
더 잘게 쪼갤 방법을 먼저 찾을 것. 그 밖엔 REALM 밖(다른 네 판·
saga-unity 트랙)으로도 진지하게 고려할 자리.

## 29. "새 게임" 시나리오 고르기 UI (2026-09-14, 같은 날 이어서, "이어해 묻지 말고")

28절이 남긴 마지막 둘 중 "새 게임" UI를 끝냈다 — `start_scenario()`가
지금까지 아무도 부르지 못하는 함수였는데, 이제 실제로 눌러 볼 수 있다.

`realm_city.gd _ready()`가 `RealmSaveState.try_load()`가 실패하면
(세이브 파일이 아예 없거나 `SAVE_VERSION`이 안 맞는 옛 세이브 — 둘 다
지금까지 조용히 194로 부팅해 왔다) `ChoicePrompt.build()`(다른 REALM
버튼들과 같은 공용 헬퍼)로 "194년 · 군웅할거"/"200년 · 관도" 두 선택지를
띄운다. 골라야 `RealmSaveState.start_scenario(id)`가 실제로 불린다.
디오라마 고정 소품(기단·누각·담장 — 시나리오·현재 성과 무관)은 고르는
동안에도 그대로 짓는다 — `_process()`의 `_rebuild_if_changed()`(sig
비교)가 이미 매 프레임 값 변화를 보고 있어, 선택 직후엔 새 함수 없이
다음 프레임에 저절로 밭·시장 등을 다시 짓는다.

**놓칠 뻔한 것 — `realm_worldmap.gd`가 `_ready()`에서 마커를 한 번만
세운다는 전제.** 새 게임에서 고르기 전엔 "우리 성이 몇 곳인가"가 아직
안 정해졌는데, 월드맵은 이미 `_ready()` 시점에 (기존 194 기본값 기준)
107개 마커를 다 지어 버린다 — 그 뒤 플레이어가 "200"을 고르면 정작
낙양 등 5개 성의 마커 색은 갱신할 방법이 없어 계속 적/보스색으로 잘못
남을 뻔했다. `RealmSaveState.scenario_ready`(bool, 기본 true) 신규 —
`realm_city.gd`가 패널을 띄우는 순간 false로 내리고, `start_scenario()`
끝에서 다시 true로 올린다. `realm_worldmap.gd`는 `_markers_built` 가드로
`scenario_ready`가 true가 될 때까지 마커 세우기를 미루고, `_process()`가
매 프레임 그 값을 지켜보다 true가 되는 순간 한 번만 짓는다(`_ready()`가
하던 일을 `_build_all_markers()`로 뽑아 `_ready()`/`_process()` 양쪽에서
부를 수 있게 함).

**재해석 — 자잘한 rough edge, 의도적으로 안 막음.** 패널이 화면 일부만
덮어(`ChoicePrompt` 표준 크기) 그 바깥의 HUD 버튼(예: "다음 달")은 여전히
눌린다 — 눌러도 크래시나 데이터 손상은 없다(패널이 뜬 시점에도 이미
`RealmSaveState`는 194 기본값으로 완전히 유효한 상태라 정상 동작하고,
나중에 시나리오를 고르면 `start_scenario()`가 연·월·금고까지 전부 다시
시작하므로 그 사이 진행은 그냥 덮인다). 진짜 막으려면 HUD 자체를
잠그는 손잡이가 필요한데, 이 슬라이스 범위 밖으로 남긴다.

검증(헤드리스): 임포트 오류 0건, 다섯 씬 각각 `--quit-after 5` 세 번
연속 로그 완전 동일(로그 자체는 엔진 리소스 로딩 추적이라 패널 유무와
무관하게 똑같다 — 실제 동작 확인은 아래 임시 씬으로 따로 했다). 임시
씬(`TestCity.tscn`을 실제로 인스턴스화, `await get_tree().process_frame`
으로 진짜 프레임을 흘려보냄)으로 (1) 세이브 없이 부팅 → `scenario_ready
==false`·`cities.size()==3`(아직 안 바뀜), (2) 씬 트리에서 "200년" 텍스트의
실제 Button을 찾아 `pressed.emit()`으로 **진짜 신호 경로**를 통해 클릭 —
`scenario_ready==true`·`cities.size()==8`·`year==200`·월드맵
`_markers_built==true`·마커 107개·`luoyang`이 우호색으로 바뀜까지 확인,
(3) 거기서 `save()`한 뒤 두 번째 `TestCity` 인스턴스를 새로 띄워 **패널이
안 뜨고**(`scenario_ready`가 이미 true) 저장된 200 상태가 그대로
복원되는지까지 확인 후 임시 파일·테스트 세이브 삭제, 재검증까지 마쳤다.
`.import` 잡음만 되돌림.

**다음에 할 일** — REALM 4절 "제외"의 후속 작업 중 **3D 몬스터
자산(GLB, 66-2장) 하나만** 남는다 — 여전히 새 렌더링 하부구조·아트
방향 결정이 필요해 다음 세션은 범위부터 좁힐 것. 208년(적벽) 시나리오는
이 UI에 세 번째 선택지로 곁들일 수 있지만 손권·유비 동맹 pact를 아직
안 옮겨서 뺐다. GUI 실기 확인은 아직(몰아서 받을 것) — 패널 레이아웃이
실제 화면에서 안 잘리는지, 버튼 두 개가 누르기 편한지 볼 것. 그 밖엔
REALM 밖(다른 네 판·saga-unity 트랙)으로도 진지하게 고려할 자리.

## 30. 3D 몬스터 자산 — 범위 좁히기: 깃발 대신 몬스터 실루엣 (2026-09-14, 같은 날 이어서, "묻지말고 사가고돗만 이어해")

- 남은 마지막 하나(3D 몬스터 자산)를 사용자에게 방향을 물어(AskUserQuestion)
  "범위 좁히기"를 골랐다. 실제 CC0 몬스터 GLB를 새로 구하는 건 여전히
  66-2장 카툰 파이프라인 결정(사람 손·itch.io 다운로드 필요)을 기다려야
  해서, 이번엔 그 전 단계로 **26절이 세운 색 깃발 자리표시자를 몬스터
  형태로 한 걸음 더** — GO `animal_builder.gd`(사슴·소 — 어울리는 CC0
  킷이 없어 box 조합으로 대신한 것)와 같은 결로 코드가 그리는 primitive
  몸통+뿔이다.
- `realm_worldmap.gd`에 `_build_monster_body(color, is_boss)` 신규(몸통
  BoxMesh + 뿔 CylinderMesh(top_radius=0) N개, 보스는 몸통 1.6배·뿔 3개,
  일반 적은 그대로·뿔 1개 — 색뿐 아니라 형태로도 구분). `_build_marker()`에
  `is_enemy: bool` 인자 추가 — 우리 성은 기존 깃발(`_build_flag()`로 분리),
  적/보스 성은 몬스터 실루엣을 얹는다. `_check_annexed()`가 함락 시 몬스터
  노드를 지우고 그 자리에 깃발을 세우도록 갈아 끼웠다(`_monsters:
  Dictionary` 신규로 city_id→몬스터 노드 추적).
- 검증: 헤드리스 임포트 오류 0건, 다섯 씬 각각 `--quit-after 5` 세 번
  연속 로그 완전 동일. 임시 씬(`_tmp_verify_monster.tscn`+`.gd`,
  `TestCity.tscn`을 실제로 인스턴스화)으로 마커 107·몬스터 104(우리 성
  3곳은 몬스터 없음 확인)·보스 성(`shendu`) 뿔 3개·일반 적 성(`xiaopei`)
  뿔 1개·`xiaopei`를 함락 처리한 뒤 몬스터가 사라짐까지 확인 후 삭제,
  재검증까지 마쳤다. `.import` 잡음만 되돌림. GUI 실기 확인은 아직(몰아서
  받을 것) — 107개 마커 중 몬스터 실루엣이 깃발보다 실제로 "지켜지고
  있다"는 느낌을 주는지, 뿔 개수 차이가 이 축척에서 눈에 띄는지 볼 것.
- **다음에 할 일**: REALM 4절 "제외"는 여전히 완전히 비어 있다(3D 몬스터
  자산은 "구멍 메움 → 색 구분 → 형태 구분"까지 왔지 실제 GLB로 끝난 건
  아니다 — 진짜 CC0 몬스터 모델은 66-2장 카툰 파이프라인·사람 손이
  필요해 계속 미뤄 둔다). 다음 세션은 REALM 밖(다른 네 판 확장·saga-unity
  트랙)을 진지하게 고려하거나, 66-2장 적용 순서(캐릭터 카툰 톤 확정→
  Enemy/Boss 확장)가 사람 손을 거쳐 진행되면 그때 이 몬스터 실루엣에
  실제 셰이더/모델을 입힐 것.

## 31. 시나리오 208년(적벽) (2026-09-14, 같은 날 이어서, "묻지말고 사가고돗 이어해")

- 다섯 판 전부 최초 "제외" 목록이 빈 뒤, 27절이 남겨 둔 미완료 기록
  ("208년은 손권·유비 동맹 pact를 아직 안 옮겨서 시나리오 선택지에서
  뺐다")을 마저 처리했다. `js/data-force.js FORCES_208`을 옮긴다 —
  조조가 처음부터 열아홉 성을 가진 "아주 기울어진 판".
- `realm_cities.gd`에 `SCENARIO_CAO_CITIES["208"]`(19개, 194/200 몫에
  더해 원소·유표 세력 소멸로 흡수한 아홉 성)·`SCENARIO_FORCE_OVERRIDE
  ["208"]`(손책→손권 3곳은 200과 동일, 유표 소멸로 유비가 흡수한
  강하·장사, 마등→마초 승계인 천수·무위 — 한중·성도/강주/영안은 194
  기준 force가 이미 일치해 재배정 불필요)·`CREED["chao"]="aggressive"`·
  `FORCE_LORD["chao"]="sg_machao"` 신규. `realm_city.gd` 시나리오
  고르기 패널에 "208년 · 적벽 (조조, 성 19곳)" 선택지 추가.
- **원작 pacts(손권·유비 동맹)는 일부러 안 옮겼다** — `realm_save_
  state.gd _run_enemy_ai()` 머리말이 이미 밝힌 단순화("AI가 이겨도
  성을 뺏지 않는다")대로 이 슬라이스의 적 AI는 서로 안 치고 플레이어
  만 노린다. 동맹이 있어도 없어도 게임플레이가 똑같으니, 실제로 없는
  메커니즘을 흉내 내는 죽은 필드를 추가하지 않았다 — REALM의 "빈 값은
  안 그린다" 원칙(실기(realm_city.gd) 축성 파손율과 같은 결)을 시스템
  단위로 넓힌 것이다.
- 검증: 헤드리스 임포트 오류 0건, 다섯 씬 각각 `--quit-after 5` 세 번
  연속 로그 완전 동일. 임시 씬으로 `start_scenario("208")` → cities
  19·enemies 88·총합 107·재배정 7곳(quan 3·bei 2·chao 2)의 `force_of()`
  전부 일치·재배정 불필요 4곳(hanzhong·chengdu·jiangzhou·yongan)도
  194 기준 그대로·조조 몫 성은 `force_of` 빈 문자열·`FORCE_LORD.chao`=
  "sg_machao"·`creed_of("chao")`="aggressive"·194로 왕복 시 정확히
  원복까지 확인 후 삭제, 재검증까지 마쳤다. `.import` 잡음만 되돌림.
  GUI 실기 확인은 아직(몰아서 받을 것).
- **다음에 할 일**: REALM의 세 시나리오(194/200/208) 모두 갖춰졌다.
  다음은 REALM 안에서 더 좁힐 것을 찾거나(3D 몬스터 자산이 여전히
  실제 GLB 없이 primitive 상태), REALM 밖(다른 네 판 추가 확장·
  saga-unity 트랙)을 고려할 자리.

## 32. 문답 문항 완주 — data-quiz.js BANK 260문항 전부 (2026-09-14, "묻지말고 이어해 REALM도 손대")

- **판을 골라야 했다** — DUNGEON·FOREST·STORY는 09-14 안에 "이미 있는
  데이터인데 화면엔 다 안 나온 자리"를 찾아 밀도를 늘렸다(정예 8종·
  바이옴 둘째 종·NPC_TALK 다섯 마을). REALM에서 같은 결의 자리를
  찾다가, 8절이 이미 "더 늘리려면 이 형식 그대로 data-quiz.js에서
  계속 골라 오면 된다"고 스스로 적어 둔 채 남겨 뒀던 문답 은행을
  발견했다 — 08-12에 분야마다 15문항(총 90)까지만 옮기고 나머지
  170문항(분야당 최대 50 중 hist/idiom/sense/mz는 16~50·world/proverb는
  16~30)을 안 옮긴 채였다.
- 실존 인물 실명(세종대왕·이순신·강감찬 등)이 그대로 나오는 것도
  원작 그대로다 — 이름 정책 예외([[saga_realm_data_force_realnames]]
  메모, `docs/PROJECT_STATE.md`가 "data-quiz.js는 역사 퀴즈라 예외"로
  확정해 둔 결정) 그대로 유지, 손 안 댔다.
- **170문항을 손으로 옮겨 적지 않았다** — Node.js로 `data-quiz.js`의
  BANK 배열을 `new Function('return '+arrText)()`로 직접 파싱해 실제
  JS 객체 배열을 얻은 뒤, 각 항목을 GDScript 딕셔너리 리터럴로
  변환해(따옴표·역슬래시 이스케이프 포함) 기존 `realm_quiz_data.gd`
  BANK 배열 끝(p15 다음)에 그대로 이어 붙였다 — 260문항 전체를 한
  글자도 안 틀리게 옮기는 유일한 방법이라 판단했다(사람이 옮겨 적으면
  이 분량에서 오탈자가 안 날 수가 없다). `realm_save_state.gd`의
  `quiz_progress().total`은 이미 `RealmQuizData.BANK.size()`를 그대로
  읽고 있어(하드코딩된 90 같은 값이 따로 없음) 로직은 한 줄도 안
  바꿨다.
- 검증: 헤드리스 임포트 오류 0건, `TestCity.tscn` `--quit-after 6`
  세 번 연속 로그 완전 동일. 임시 씬(`_tmp_verify_quiz.tscn`+`.gd`)으로
  `BANK.size()==260`·분야별 개수(hist/idiom/sense/mz 50·world/proverb
  30, 원작과 정확히 일치)·중복 id 0·보기 4개가 아닌 항목 0·정답
  인덱스 범위 밖 0·q/why 빈 문자열 0·대표 항목 몇 개(h50·p30·m19)의
  텍스트가 원문과(따옴표 포함 이스케이프까지) 정확히 일치까지 확인 후
  삭제, 재검증까지 마쳤다. GO·DUNGEON·FOREST·STORY 대표 씬도 오류 0건
  재확인. `.import` 잡음만 되돌림. GUI 실기 확인은 아직(몰아서 받을
  것) — 서고(learnedList) 화면에서 늘어난 260개가 분야별로 잘 나뉘어
  보이는지 볼 것.
- **다음에 할 일**: REALM 안에서 데이터가 미완인 자리는 이제 정말
  거의 없다(3D 몬스터 자산 GLB만 66-2장·사람 손 대기). 다음은 REALM
  밖(다른 네 판·saga-unity 트랙)을 진지하게 고려할 자리.
