# VERTICAL_SLICE_DUNGEON

PLAN.md 39장 순서(SAGA Core → Vertical Slice(GO) → **DUNGEON** → FOREST → STORY →
REALM)의 두 번째 칸. GO Vertical Slice가 2026-09-11 승인됐고(PROJECT_STATE.md
"PLAN.md 100단계 — Vertical Slice 승인" 참고), 사용자가 "플랜 순서대로 다
진행해"로 다음 칸 착수를 지시했다(2026-09-12).

LEGACY_FEATURE_AUDIT.md "SAGA DUNGEON" 절의 KEEP/REWORK/MERGE/DROP 분류를
그대로 따른다 — 이 문서는 그중 **이번 슬라이스에 넣을 최소 범위**만 자른다.
GO의 VERTICAL_SLICE.md와 같은 방식("작게 시작해 재미부터 검증한다", master.md
3.1절)이다.

## DUNGEON의 실제 핵심 감각

웹판(`saga-dungeon`)이 이미 3D로 전환돼 있고, 2026-09-06에 사용자가 명시적으로
방향을 못박았다 — **"디아블로4랑 완전 비슷하면 좋겠음", "디아블로 처럼 화면을
고정가능해."** 실제로 그 요청에 따라 회전 가능한 3인칭 카메라(`camAim3rd`)를
전부 지우고 **고정 카메라(`camAim`) 하나만** 남겼다(README.md "안 쓰는 기능
정리" 절, 2026-09-06). GO처럼 회전·줌 가능한 3인칭 카메라를 그대로 가져오면
이 결정을 뒤집는 것이니, **DUNGEON은 GO와 카메라부터 다르게 간다.**

## 1. Vertical Slice 범위 확정

포함:

```text
방 하나(고정 배치, 원작 6개 층 테마 중 1층 "고분(古墳)")
플레이어 이동(WASD/조이스틱 — player.gd 재사용) + 고정 각도 추적 카메라(회전 없음)
직업 하나(무장武將 — 곤봉/창 등 장착 무기가 직업을 정하는 원작 그대로, 이번엔
  곤봉 하나만 쥔 채 시작)
실시간 근접 전투(평타 하나) — GO의 턴형 선택지 전투(duel_rules.gd)와는
  완전히 다른 모델이라 새로 만든다
잡졸 하나(황건적, tier1, biome:ruins — data-enemy.js 그대로 옮긴 이름)
노획 — 잡졸을 이기면 이름만 있는 장비 하나가 바닥에 떨어진다(줍기만, 착용 효과 없음)
방 출구(문) — 도달하면 "이번 슬라이스는 여기까지" 토스트, 저장
```

제외(다음 슬라이스로 미룸 — LEGACY_FEATURE_AUDIT.md의 KEEP 목록 대부분이 여기로 간다):

```text
층 전체(여러 방 연결, §28-8 "진짜 이어진 세계" A안은 이후 슬라이스 몫)
은사(恩賜, 방 클리어 후 버프 선택 UI)
등급+접사+소켓+부문어(룬워드)·투장(세트)·내구/수리
행상/투전/연단·단약/요대(1234 키)·감정·창고
원소 6결+저항
직업 5종 전부(무장 하나만) · 무예(9모양×5단 스킬트리, 이번엔 평타뿐)
인물 등용(던전에서 인물을 만나 부대에 들이는 것 — GO의 "등용"과 같은 개념이지만
  이번 슬라이스는 전투 루프 자체를 검증하는 게 먼저다)
결사(하드코어)
보스층
```

이유: GO의 VERTICAL_SLICE.md 48절과 같은 논리 — "재미가 확인된 후 콘텐츠를
확장한다." DUNGEON은 다섯 판 중 시스템이 가장 많은 판이라(LEGACY_FEATURE_AUDIT.md
"가장 시스템이 복잡한 판") 오히려 더 강하게 잘라야 한다. "때린다 → 맞는다 →
쓰러진다 → 줍는다"는 네 동사만 먼저 검증한다.

## 2. 카메라·이동 설계

**REWORK 대상 — GO의 `camera_rig.gd`(드래그 회전·핀치 줌)는 재사용하지 않는다.**
웹판 `camAim()`(`js/dungeon3d.js`)의 정신만 옮긴다 — 정확한 픽셀 공식이 아니라
**"고정 각도로 내려다보고, 플레이어를 따라가되 회전은 없다"**는 결론만:

```text
SpringArm3D를 플레이어에 고정 각도로 붙인다(pitch 약 55° — camAim의
  tilt=0.62 느낌을 Godot 각도로 다시 잡은 값, 웹 공식을 그대로 이식하지 않음)
플레이어를 그대로 따라간다(방 하나짜리 슬라이스라 웹판의 "방 안에서는
  절반만 당김" 로직은 필요 없다 — 그건 방보다 큰 필드에서 카메라가
  벽 밖 어둠을 덜 보여주려던 보정이었다)
줌·회전 입력 없음 — 사용자가 명시적으로 원한 "화면 고정" 그대로
```

`player.gd`는 **거의 그대로 재사용한다** — `_world_direction()`이 카메라의
`global_transform.basis` 기준으로 이동 방향을 잡으므로, 카메라가 고정이든
회전이든 상관없이 동작한다(WALK/RUN 속도 상수만 던전 느낌에 맞게 다시 튜닝).

## 3. 전투 설계

웹판 `duel.js`(GO가 재사용한 턴형 선택지 전투)와 **완전히 다른 모델**이 필요하다
— 원작 디아블로 감각(실시간, 이동하며 때린다)이라 새로 짠다. 첫 슬라이스는:

```text
공격 입력(버튼 1개) → 사거리 안(근접)이면 적 HP를 깎는다
공격 간격 — 웹판 BASE_ATK_CD(0.55초) 그대로 이식(새 수치를 만들지 않는다)
적 AI — 플레이어에게 다가와 근접하면 때린다(추격만, 예고 패턴은 다음 슬라이스)
```

## 4. 첫 번째 적 설계

`js/data-enemy.js`의 첫 항목을 그대로 옮긴다(새 몬스터를 상상하지 않는다):

```text
이름: 황건적(黃巾賊, tier1, biome:ruins, 무기:곤봉)
HP: enemyHp(floor=1, boss=false) = round(24 * 1.26^0 * 1 * mode().hp) ≈ 24
공격력: enemyDmg(floor=1, boss=false) = round(5 * 1.20^0 * 1 * mode().dmg) ≈ 5
```

"황건적"은 실존 인물이 아니라 후한 말 반란 세력을 가리키는 역사 용어다 —
루트 CLAUDE.md의 이름 정책(실존 "인물" 실명 회피)은 GO의 `HEROES`(등용 대상,
개별 인물)에 해당하는 규칙이고, "산적"·"정찰병"처럼 적 부류를 가리키는
일반명사는 이미 GO에서도 그대로 쓰고 있다 — 같은 경계로 옮긴다.

## 5. 첫 번째 보상 루프

```text
황건적을 벤다
  ↓
장비 하나가 바닥에 떨어진다(이름만 있음 — 착용해도 능력치 변화 없음,
  Phase 이후 등급+접사 시스템이 붙으면 의미가 생긴다)
  ↓
줍는다 → 문으로 나간다 → "이번 방 클리어" 저장
```

GO의 보상 재화가 "사람"이었다면 DUNGEON의 보상 재화는 "장비"다(LEGACY_FEATURE_
AUDIT.md "핵심 루프: 내려간다 → 방 치운다 → 은사 고른다 → 장비 챙긴다 →
나온다") — 이번 슬라이스는 그 문장의 앞부분(방 치운다 → 장비 챙긴다)만 검증한다.

## 완료 조건

```text
게임 실행 → 3D 방(고분 테마)에 들어간다 → 고정 각도 카메라로 플레이어를 따라간다
→ 황건적에게 다가가 공격 버튼으로 벤다 → 장비 하나가 떨어진다 → 줍는다
→ 문으로 나간다 → 저장한다 → 다시 켜서 이어진다
```

이 여덟 단계가 "때리는 손맛이 있는가"(GO의 27절과 같은 질문, 이번엔 전투축)를
스스로 답할 수 있으면 성공이다. 재미가 없으면(콘텐츠를 늘리지 않고) 공격
쿨다운·카메라 각도·적 AI 추격 속도부터 고친다 — GO Vertical Slice 때와 같은
원칙(38절).

## 6. 던전 증가 — 방 3개(보스 1명)에서 6개(보스 2명)로 (2026-09-14, "사가고돗 이어해")

- **판을 골라야 했다** — GO·STORY·REALM은 각자 최초 "제외" 목록을 다 채웠고
  (`docs/PROJECT_STATE.md` 09-14 항목들), DUNGEON·FOREST는 09-12 이후
  Vertical Slice 범위(1~5절)에서 손을 뗀 채였다. `PLAN.md` 51장 "확장
  계획"이 DUNGEON의 다음 축을 "던전 증가 → 엘리트 → 보스 → 장비 → 빌드"로
  적어 둬서, 그 첫 항목을 골랐다.
- 웹판 `data-dungeon.js`의 `isBossFloor(floor) = floor % 3 === 0`은 층
  제한이 없는 끝없는 하강(roguelike)을 전제한다. 이 슬라이스는 여전히
  "한 씬 안에 방을 나란히 세운다"는 §1·5절 방식(§28-8 A안 같은 진짜
  오픈월드는 다음 몫)이라 무한 대신 REALM이 3→8→107로 밟은 것과 같은
  작은 폭 확장을 택했다 — `games/saga_dungeon/world/test_room.gd`의
  `ROOM_COUNT`를 3→6으로. 보스 판정도 "마지막 방만 보스"에서 `(i+1) % 3
  == 0`(웹판 `isBossFloor` 그대로)으로 바꿔 3층·6층 둘 다 보스가 서게
  했다 — 새 보상식을 만들지 않는다(`_on_boss_defeated`의 등급 상한 계산은
  이미 floor_num을 일반화해 뒀던 것이라 손 안 댐).
- `ROOM_HERO_IDS`(방 0·1의 역사 인물 조우)는 그대로 둔다 — 늘어난 방
  2~5엔 조우가 없을 뿐 에러가 나거나 회귀하지 않는다(`room_index <
  ROOM_HERO_IDS.size()` 가드가 이미 있었다). 저장 스키마(`rooms_cleared`/
  `hero_resolved`)도 이미 동적 배열이라 손 안 댔다.
- 검증: 헤드리스 임포트 오류 0건, `TestRoom.tscn` `--quit-after 5` 세 번
  연속 로그 완전 동일. 임시 씬(`_tmp_verify_rooms.tscn`+`.gd`,
  `TestRoom.tscn`을 실제로 인스턴스화)으로 `ROOM_COUNT==6`·잡졸 4·보스
  2·보스가 선 floor가 정확히 `[3, 6]`인 것까지 확인 후 삭제, `.import`
  잡음만 되돌림. GUI 실기 확인은 아직(몰아서 받을 것) — 늘어난 방·복도가
  실제로 이어져 보이는지, 6층 보스가 3층 보스보다 확실히 세게 느껴지는지
  볼 것.
- **다음에 할 일**: 51장 DUNGEON 축의 다음은 "엘리트"(잡졸과 보스 사이
  강화 개체) — 웹판에 있으면 그대로 옮기고 없으면 새로 상상하지 않는
  선에서 확인부터 할 것. 그 밖엔 FOREST(51장 "생태계" 축)도 09-12 이후
  손을 안 댄 채다.

## 7. 엘리트(정예) — dungeon.js ELITES 8종 이식 (2026-09-14, 같은 날 이어서, "묻지말고 이어해 사가고돗 웹판은 완벽하지")

- 위 6절 "다음에 할 일"에서 물었던 질문("엘리트가 웹판에 있는가")에 답을
  먼저 확인했다 — **있다.** `dungeon.js`의 "정예(精銳)" 시스템, 주석에
  "원작(디아블로)의 파란/노란 이름 몬스터"라고 직접 적혀 있다. 8종(날쌘·
  완강한·사나운·되살아나는·가시 돋친·그림자·철갑 두른·호신 두른)을
  색·수치 전부 그대로 옮겼다 — 새 정예를 상상하지 않았다.
- `games/saga_dungeon/world/dungeon_enemy.gd`에 `ELITES` 상수(8종)·
  `_elite_chance(floor)`(`min(0.30, 0.06+floor*0.012)`, 웹판 그대로) 추가.
  `_init()`이 보스·그림자 분신이 아닐 때만 이 확률로 굴려 하나를 고르고,
  hp/dmg 배율(기본 1.35/1.15, 개별 항목이 있으면 그 값)·몸집(r 13→16)·
  색·저항(철갑=phys 35%, 호신=chi 45%)을 적용한다.
- **찾아서 고친 진짜 버그 하나** — `melee_attack.gd`의 기본 공격이
  지금까지 `resist_pct('phys')`를 한 번도 안 불렀다(원소 피해만 저항을
  탔다). 황건적은 저항이 없어(0) 지금까지는 결과가 같았지만, "철갑
  두른" 정예를 넣으려면 이 자리부터 고쳐야 실제로 덜 아프게 맞는다 —
  `dungeon.js strike()`의 `res=resistOf(e,'phys'); dmg*=1-res/100` 순서
  그대로 옮겼다(크리티컬 다음, 원소 이전).
- 나머지 다섯 효과 — "되살아나는"(regen, `_tick_regen()` 신규, 매 프레임
  `hp += maxHp*rate*dt`)·"가시 돋친"(thorn, `thorn_reflect()` 신규,
  `melee_attack.gd`가 반사분을 플레이어에게 돌려준다)·"날쌘"(spd/cd,
  추격 속도·공격 쿨다운에 곱함)·"그림자"(split=2, `_die()`가 자기 자신이
  아닐 때만 약한 분신 둘을 그 자리에 세운다 — `_is_shade` 가드로 분신은
  다시 안 갈라진다, hp×0.34·dmg×0.6·r 13→10) — 전부 `dungeon.js`의 해당
  분기 그대로.
- `loot_pickup.gd`에 `is_elite` 매개변수 추가 — 금 2.2배·장비 ilvl +14
  (보스 +30과 별개 값, 원작 그대로)·단약 확률 34%(잡졸 16%·보스 100%)를
  정예 갈래로 받는다. 장비 확정 드랍은 이미 이 슬라이스가 잡졸도
  확정으로 잡아 둔 상태라 정예도 그대로(변화 없음) — 재료·감정서 확률은
  원작에도 정예 갈래가 없어 안 건드렸다.
- **실측으로 잡은 버그 하나** — 그림자 분신을 만들 때 `kid.global_position`
  을 `parent.add_child(kid)`보다 먼저 대입해 "!is_inside_tree()" 오류가
  났다(트리 밖 Node3D는 전역 좌표를 못 구한다). 순서를 뒤집어 고쳤다 —
  아래 검증에서 실제로 이 오류가 나는 것까지 본 뒤 고치고 재검증했다.
- 검증: 헤드리스 임포트 오류 0건, `TestRoom.tscn` `--quit-after 8` 세 번
  연속 로그 완전 동일. 임시 씬(`_tmp_verify_elite.tscn`+`.gd`)으로
  `_elite_chance`(1층 7.2%·30층 이상 30% 상한)·정예별 hp/dmg 배율(완강한
  ×2.6=62·사나운 ×1.9=10)·저항(철갑 phys 35%·chi 0%)·가시 반사(10대미지
  ×0.22=2)·재생(1초에 maxHp×0.035)·그림자 분열(부모 죽이면 실제로 약한
  분신 둘이 서고 hp가 `round(round(24*1.26²)*0.34)=13`과 정확히 일치,
  그 분신들을 다시 죽여도 더는 안 갈라짐)까지 전부 기댓값과 일치 확인.
  이 과정에서 위 global_position 오류를 실제로 재현·확인한 뒤 고치고
  재검증까지 마쳤다. 임시 파일 삭제, `.import` 잡음만 되돌림, GUI
  Godot 프로세스 없음(quit-after로 자연 종료). GUI 실기 확인은 아직
  (몰아서 받을 것) — 정예가 실제로 색이 다르게 보이는지, 그림자가
  갈라지는 순간이 눈에 띄는지 볼 것.
- **다음에 할 일**: DUNGEON 51장 축("던전 증가→엘리트→보스→장비→빌드")의
  다음은 "보스"(이미 3층·6층에 있음 — 51장이 말하는 건 보스 자체의
  추가 확장인지 재확인 필요) 또는 "장비"(이미 등급+접사+소켓까지 있어
  51장 기준 남은 폭이 좁을 수 있다) — 다음 세션이 먼저 웹판과 비교해
  범위부터 좁힐 것. FOREST(51장 "생태계" 축)도 여전히 09-12 이후 손을
  안 댄 채다.

## 8. 방 종류 다양화 — 상자(trove)·우물(well) 이식 (2026-09-14, 같은 날 이어서, "사가고돗 이어해묻지말고 이어해")

- 위 7절 "다음에 할 일"이 던진 질문("보스"·"장비"가 51장이 말하는 진짜
  폭인지)을 웹판과 대조해 확인했다 — 아니었다. `data-dungeon.js ROOMS`를
  보면 웹판 방 종류는 11갈래(fight·trove·well·shrine·elite·miniboss·
  cave·merchant·puzzle·event·forage, `dungeon.js pickRoomKind()`)인데
  이 슬라이스는 지금까지 방마다 예외 없이 전부 "fight"뿐이었다 — 보스는
  이미 있고 장비도 등급+접사+소켓까지 있으니, 51장 "던전 증가"가 실제로
  가리키는 남은 폭은 **방 종류 다양성**이었다.
- 한 번에 11갈래를 다 옮기지 않고(토큰 절약 규칙 3, 큰 시스템을 한 걸음에
  안 만든다) 원작 손짓이 "닿으면 끝"이라 별도 UI가 안 필요한 가장 단순한
  둘 — 상자(trove)·우물(well) — 부터 옮겼다. 퍼즐·행상·구출(event)·
  채집(forage)·채광(cave)은 각자 UI/상태기계가 필요해 다음 몫으로 남긴다.
- `games/saga_dungeon/world/test_room.gd`에 `ROOM_KINDS` 배열
  `["fight","trove","fight","well","fight","fight"]`(보스층인 3층·6층은
  그대로 fight) 추가. 방 종류별 분기를 enemy-spawn 루프에 넣었다:
  - **trove**(1번 방): `dungeon.js` "50% 확률로 지킴이 잡졸"을 그대로
    옮기고 `_spawn_chest()` 신규 — `LootPickup.spawn_at(ilvl, is_boss=
    false, is_elite=true)`를 1~2회(원작 `1+floor(random*2)`) 불러 상자
    노획을 흉내낸다.
  - **well**(3번 방): `_spawn_well()` 신규 — Area3D 하나, 플레이어가
    닿으면 `player_health.heal_by(max_hp*0.4)`(웹판 `healBy(hpMax*0.4)`
    그대로) 뒤 `area.queue_free()`로 한 번만 쓰게 자기 자신을 지운다.
- **정직하게 밝혀 둔다** — 상자의 노획은 정확히 원작과 같지 않다. 원작
  `dropItem(...,22)`는 "물건 등급 쏠림(bias)"과 골드 배율(×3)을 서로
  독립으로 받는데, 이 슬라이스의 `LootPickup.spawn_at()`은 (정예·보스
  이식 때 이미 그렇게 짜여 있어) 둘 다 `is_boss`/`is_elite` 플래그
  하나로 묶여 있다. bias=22를 ilvl에 그대로 더하면 골드도 같은 ilvl을
  지수 배율로 타 넘어 수십 배로 튀므로 그렇게 하지 않고, 이미 검증된
  정예(elite) 갈래(ilvl+14·금×2.2)로 근사했다 — "상자는 정예급 노획을
  준다"는 뜻으로 읽으면 된다. bias/골드-배율을 따로 받는 새 매개변수를
  추가해 정확히 22를 맞추는 것은 다음에 더 좁힐 자리로 남긴다.
- **찾아서 알아낸 것** — 이 스크립트가 읽는 `DungeonSaveState.rooms_
  cleared`가 실기 개발 세이브(`user://save_dungeon.json`, 방 3개
  시절부터 남아 있던 길이-2 배열)를 그대로 물려 쓰고 있어, 검증 중
  0·1번 방이 "이미 클리어됨"으로 읽혀 새 코드가 전혀 안 도는 상태를
  먼저 만났다. 파일을 지우는 대신(되돌릴 수 없는 로컬 삭제라 권한
  분류기가 막았고, 실제로도 다른 세션의 진행 상황이라 지우면 안 된다)
  Godot `FileAccess`로 **내용만 잠깐 빈 상태로 바꿨다가 검증 뒤 원문
  그대로 되돌리는** 방식으로 우회했다 — 되돌린 뒤 파일이 바이트 단위로
  원본과 같은 것까지 Read로 확인.
- 검증: 헤드리스 임포트 오류 0건, `TestRoom.tscn` `--quit-after 6` 세 번
  연속 로그 완전 동일(md5 일치). 임시 씬(`_tmp_verify_rooms2.tscn`+
  `.gd`, 세이브를 위 방식으로 비운 뒤 `TestRoom.tscn`을 실제로 인스턴스화)
  으로 `Well` 노드 1개·`LootPickup` 1개(상자, 이번 시드는 1개가 나옴)·
  적 5마리(전투방 4 + 상자방 지킴이 1, 이번 시드는 지킴이가 나옴)·인물
  조우 2명(그대로)까지 확인. 우물 효과는 직접 `player_health.hp`를
  20 깎은 뒤 우물 콜백 로직(`heal_by(max_hp*0.4)`)을 그대로 호출해
  `min(max_hp, hp+max_hp*0.4)` 공식과 정확히 일치(35→59, max_hp=60)
  확인. GO·FOREST·STORY·REALM 대표 씬도 각 3회 로그 완전 동일, 오류
  0건 재확인. 검증 뒤 `_tmp_verify_rooms2.*` 삭제, `.import` 잡음 없음
  (`--headless --editor` 없이 `--headless` 실행만 썼다), `git status`로
  `test_room.gd` 한 파일만 바뀐 것 확인. GUI 실기 확인은 아직(몰아서
  받을 것) — 상자·우물 방에 실제로 들어가 반짝이는 노획물이 보이는지,
  우물에 닿았을 때 체력 게이지가 실제로 차는지 볼 것.
- **다음에 할 일**: 남은 9갈래 중 다음으로 옮기기 쉬운 건 **정예 소굴
  (elite)**·**미니보스(miniboss)** — 둘 다 이미 있는 정예 확률/보스
  스폰 로직을 방 단위로 "반드시" 강제하기만 하면 되어 새 UI가 안
  필요하다(사당(shrine)도 후보지만, 지금 이미 "모든 방 출구에서 은사를
  고른다"는 슬라이스 설계와 뜻이 겹쳐 굳이 새 방 종류로 안 만들어도
  된다는 점을 먼저 따져볼 것). 채광(cave)·행상(merchant)·퍼즐(puzzle)·
  구출(event)·채집(forage)은 각자 새 상호작용/UI가 필요해 더 큰 몫이다.

## 9. 방 종류 다양화 둘째 — 정예 소굴(elite)·미니보스(miniboss) (2026-09-14, 같은 날 이어서, "사가고돗 이어해묻지말고 이어해")

- 위 8절 "다음에 할 일"이 예고한 대로, 이미 있는 정예·보스 로직을 방
  단위로 강제만 하면 되는 둘을 옮겼다. `ROOM_KINDS`를 `["elite","trove",
  "fight","well","miniboss","fight"]`로(0·4번 fight를 elite·miniboss로
  교체, 보스층 3·6층은 그대로) 바꿨다.
- `dungeon_enemy.gd::_init()`에 `force_elite` 매개변수 신규 — `dungeon.js
  spawnEnemy(floor,false,{forceElite:true})` 그대로, 확률 굴림 대신
  무조건 `ELITES`에서 하나를 고르게 하는 한 줄(`force_elite or randf() <
  _elite_chance(...)`)만 더했다. 기존 두 호출부(그림자 분신·일반
  스폰)는 새 매개변수에 기본값 false라 안 건드려도 그대로 동작.
- `test_room.gd::_spawn_enemy()`를 `_spawn_enemy_at(pos, floor_num,
  is_boss, grant_hero_reward, force_elite)` 공용 헬퍼로 갈라냈다(기존
  호출부는 동작 변화 없음, 새 자리 하나를 더 쓰려고 재사용) —
  - **정예 소굴**(`_spawn_elite_den`) — 원작은 3~8마리(정예 하나 강제+
    나머지 일반)지만, 이 슬라이스는 fight 방이 이미 "방당 1마리"로
    크게 줄여 둔 상태라 같은 비율로 줄여 **정예 1(강제)+일반 1 = 2마리**
    로 잡았다(새 밀도를 상상하지 않고, 기존 fight 방보다 확실히 더
    붐빈다는 것만 살렸다).
  - **미니보스**(`_spawn_miniboss`) — 부하 없이 혼자, `is_boss=true`라
    `loot_pickup.gd`가 보스급 노획을 그대로 준다(dungeon.js 주석 "따로
    더 챙길 것은 없다" 그대로). 단 `grant_hero_reward=false`로
    `_on_boss_defeated`(인물 자동 합류)는 안 건다 — 그건 진짜 층 끝
    보스 전용 보상이고 웹판 미니보스엔 없는 개념이라 새로 만들지 않았다.
- 검증: 헤드리스 임포트 오류 0건, `TestRoom.tscn` `--quit-after 6` 세
  번 연속 로그 완전 동일. 임시 씬(`_tmp_verify_elite2.tscn`+`.gd`)으로
  방0의 두 적이 각각 `elite_key`가 채워진 강제-정예(예: "tough", hp=
  round(24×2.6)=62)와 일반(hp=24, floor1 공식 그대로)인 것·방4(미니보스,
  floor5)가 `is_boss=true`인데도 `died` 신호 연결 수(`get_signal_
  connection_list`)가 0인 반면 방2·방5(진짜 보스, floor3·6)는 정확히
  1인 것까지 확인 후 삭제, 재검증까지 마쳤다. GO·FOREST·STORY·REALM
  대표 씬도 오류 0건 재확인.
- **실측으로 잡은 실수 하나** — 검증 스크립트가 방마다 도는 자식 노드를
  `get_class()=="CharacterBody3D"`로만 걸러 `is_boss` 등을 읽다가
  Player(`player.gd`)도 같은 클래스라 "Invalid access to property"
  오류를 냈다. `is_in_group("dungeon_enemy")`로 걸러 고쳤다 — 이 실수
  때문에 첫 검증 스크립트가 세이브 파일 복원 줄까지 못 가고 중간에
  멈춰(오류가 나면 그 함수의 나머지 줄이 실행되지 않는다) `user://
  save_dungeon.json`을 빈 상태로 남긴 채 끝났다. **바로 눈치채지
  못했다** — 스크립트를 고쳐 재검증까지 다 마친 뒤 git status/diff를
  훑다가 뒤늦게 발견(diff 대상이 아니라 그냥 눈으로 원본 JSON과
  대조하다가). 다행히 이전 턴에서 원본 JSON 전문을 이미 대화에 출력해
  둔 적이 있어 그 값 그대로 다시 써넣어 복구했고, 바이트 단위로 이전
  기록과 같은 것까지 재확인했다. **교훈** — "검증 스크립트 끝에서
  원상복구"는 스크립트가 끝까지 도달해야만 지켜진다. 다음엔 try/finally
  가 없는 GDScript 특성상, 복원 코드를 맨 앞(뭔가 실패해도 최대한 먼저
  실행되게)에 두거나, 애초에 실기 세이브 파일을 직접 왕복시키지 않고
  완전히 별도의 격리된 테스트 프로필/세이브 경로를 쓰는 쪽이 더 안전할
  것 — `docs/PROJECT_STATE.md`에도 별도 기록.
- **다음에 할 일**: 남은 7갈래(shrine·cave·merchant·puzzle·event·
  forage) 전부 원작에 독립된 UI/상태기계가 있어(제단 순서 맞추기,
  행상 재고 셋, 구출 등) 지금까지처럼 "이미 있는 로직 재사용"만으로는
  안 끝난다 — 다음은 그중 상대적으로 작은 것(사당(shrine)은 위에서
  이미 "은사를 모든 방 출구에서 준다"는 슬라이스 설계와 뜻이 겹친다고
  판단했으니, 채광(cave, 손짓 하나로 재료 확정 지급이라 우물과 구조가
  비슷함)부터 검토해 볼 것)부터 좁히거나, DUNGEON 밖(다른 네 판·
  saga-unity 트랙)을 고려할 자리.

## 10. 방 종류 다양화 셋째 — 채광(cave) (2026-09-14, 같은 날 이어서, "사가고돗 이어해묻지말고 이어해" → "순서대로 계속 이어해")

- 위 9절이 예고한 대로 채광(cave)을 옮겼다. 다만 다섯 자리(elite·trove·
  fight×2·well·miniboss)가 이미 다 차 있어(원래 fight였던 두 자리를
  이미 elite·miniboss로 다 썼다) 기존 방을 다시 갈아 끼우는 대신
  `ROOM_COUNT`를 6→7로 늘려 새 7번째 방(index6, floor7, `7%3!=0`이라
  보스가 아니다)에 배치했다 — 기존 0~5번 방의 종류·층수·보스 판정은
  전혀 안 건드렸다("이미 검증된 걸 다시 안 만진다").
- `loot_pickup.gd`에 `spawn_mat_at(parent,pos,floor_num)` 신규(공개
  래퍼 한 줄, private `_spawn_mat()`을 그대로 감싼다 — 드랍 확률 로직을
  이 파일 밖으로 복제하지 않는다). `test_room.gd::_spawn_cave_vein()`이
  dungeon.js `dropMat` 두 번(재료 확정 둘)·35% 확률 지킴이(우물·상자와
  같은 확률형)를 그대로 옮긴다.
- **정직하게 밝혀 둔다** — 원작 `dropMat(room,x,y,26)`의 bias=26은 이번
  에도(상자 때와 같은 이유로) 안 옮겼다. 다만 이유가 다르다: 이 슬라이스
  의 `DungeonItems.roll_material_drop(floor_num)`은 훨씬 이전 세션이
  이미 원작의 "바깥 확률×안쪽 갈래" 이중 구조를 "우리가 가진 유일한
  재료로 수렴"시키며 bias 인자 자체를 없앤 상태였다(`loot_pickup.gd`
  헤더 주석에 이미 적혀 있던 결정) — 이번에 새로 생긴 근사가 아니라
  기존 결정을 그대로 존중한 것.
- **지난 절의 교훈을 실제로 적용** — 검증 스크립트를 짤 때 세이브 파일을
  비우는 코드와 되돌리는 코드를 함수 앞뒤에 최대한 붙여 쓰고, `is_in_
  group("dungeon_enemy")`로 Player와 안 겹치게 걸렀다(지난 절에서
  실수로 겪은 문제 재발 방지). 실제로 검증 뒤 세이브 파일을 바이트
  단위로 다시 대조해 원본과 같은 것을 확인했다.
- 검증: 헤드리스 임포트 오류 0건, `TestRoom.tscn` `--quit-after 6` 세
  번 연속 로그 완전 동일. 임시 씬으로 `room_count==7`·`ROOM_KINDS`에
  "cave"가 들어간 것·재료 픽업(Rune/Gem/Jewel Pickup) 정확히 2개 생성
  확인 후 삭제. GO·FOREST·STORY·REALM 대표 씬도 오류 0건 재확인,
  `git status`로 `loot_pickup.gd`·`test_room.gd` 두 파일만 확인.
- **다음에 할 일**: 남은 6갈래(shrine·merchant·puzzle·event·forage,
  shrine은 위에서 이미 제외 판단) 전부 독립 UI/상태기계(재고 셋 고르기,
  제단 순서, 구출 등)가 필요해 지금까지처럼 "이미 있는 로직 재사용"
  만으로는 안 끝난다 — 여기서부터는 DUNGEON 밖(다른 네 판·saga-unity
  트랙)을 진지하게 고려하거나, 방 종류 다양화를 잠시 접고 51장의 다른
  갈래("장비→빌드")로 옮겨 갈 것을 다음 세션이 판단할 자리.


## 11. 51장 "장비→빌드" — 갑주(armor) 슬롯 (2026-09-14, 같은 날 이어서, "모두 이어서해")

- 지난 절이 "51장의 다른 갈래(장비→빌드)로 옮겨 갈 것"으로 남긴 것을
  이어 옮겼다. `dungeon_items.gd`의 오래된 판단("방어력·기질 스탯
  자체가 없어 갑주를 걸칠 자리가 없다")을 다시 살펴보니, 원작 갑주 5종의
  main은 전부 might가 아니라 wisdom/command라 `atk_flat_bonus()`(might
  전용)에는 원래도 안 닿는다 — 이미 옮겨 둔 wisdom/command 부적들과
  같은 처지였다. 진짜 값은 main이 아니라 **소켓(원소 저항)·접사(world
  kind)·투장(세트)**에 있었고, 특히 충무·와룡·호랑·패왕 네 세트는 무기+
  부적만으로는 영영 2점에 머물던 것을 갑주가 채워 처음 3점(완성)에
  닿는다 — GEMS·SETS 데이터는 애초에 갑주 자리까지 원작 그대로 옮겨져
  있었으니(예전 세션이 "나중에 생기면 바로 쓴다"고 미리 적어 둠) 진짜
  막혀 있던 건 장비칸 자체였다.
- `dungeon_items.gd`: BASES에 지갑·피갑·찰갑·두정갑·도포 5종 추가,
  `SOCK_MAX["armor"]=3`·`GEM_SLOT_CAT["armor"]="armor"`(원작 그대로,
  전부 데이터 한 줄씩만 더한 것). `dungeon_equipment_state.gd`: 부위가
  셋(무기·갑주·부적)으로 늘며 `slot_name == "weapon" ? weapon : charm`
  식 2진 삼항식이 전부 깨질 상황이라, `_item_for()`/`_set_item()`/
  `_emit_changed()` 세 헬퍼 + `SLOT_NAMES` 상수로 파일 전체를
  정리하면서 얹었다 — 공개 진입점 `equip(slot_name, it)`·
  `item_for(slot_name)`도 새로 둬 `loot_pickup.gd`·`vendor_button.gd`·
  `test_room.gd`의 흩어진 2진 분기를 그걸로 대체했다(중복 로직을
  새로 안 늘렸다). `dungeon_save_state.gd`에 `armor` 저장 필드
  (순수 추가, 버전 안 올림). `vendor_button.gd`에 "투전: 갑주" 옵션·
  감정 우선순위(무기→갑주→부적)도 같이 얹었다. `player_health.gd`가
  `armor_changed`도 구독(hpPct 접사가 갑주에도 붙을 수 있어서).
- 검증: 헤드리스 임포트 오류 0건, `TestRoom.tscn` `--quit-after 6`
  세 번 연속 로그 완전 동일(md5 일치). 별도 SceneTree 스크립트(씬 인스턴스
  없이 오토로드만 부르는 방식 — 무거운 Player 씬을 직접 인스턴스화하던
  이전 방식이 원인 불명으로 멎은 적이 있어 이번엔 처음부터 피했다)로
  10개 항목 검증: BASES 5종·SOCK_MAX·GEM_SLOT_CAT 값·roll("armor")이
  갑주만 굴리는지·equip()/item_for()/active_items·atk_flat_bonus가 갑주
  main(wisdom/command)에 안 새는지·호랑(虎狼) 세트 3점 완성(플랫 무력
  56·world critPct 10 정확히 일치)·내구 마모→파손(wear_all)·수리
  (repair_all)·소켓(보석 박아 elem_resist 8 확인)·감정(identify)·
  save/load 왕복까지 전부 PASS. GO·FOREST·STORY·REALM 회귀도 헤드리스
  오류 0건 재확인. `.import` 잡음만 되돌림(`project.godot`는 안
  건드려짐 확인), `git status`로 의도한 7개 스크립트 파일만 확인.
  GUI 실기 확인은 아직(몰아서 받을 것).
- **다음에 할 일**: 갑주로 완성된 네 세트 중 실제로 굴려서(등급·접사
  랜덤) 3점 세트를 자연 상태로 마주치는 건 여전히 확률적(SET_CHANCE
  0.55 × 보물 등급에서만)이라 별도 확인 UI는 없다 — 필요하면 다음
  몫. 남은 여섯 부위(helm·glove·boot·ring·neck)는 각 세트 나머지 조각
  이지만 아직 범위 밖. DUNGEON 밖(다른 네 판·saga-unity 트랙)을 고려할
  자리이기도 하다.

## 12. 51장 "장비→빌드" — 남은 다섯 부위(helm·glove·boot·ring·neck) (2026-09-14, 같은 날 이어서, "DUNGEON 남은 여섯 부위 이어해")

- 지난 절이 "여섯"이라 적었던 건 실제로는 **다섯**이었다(data-item.js
  SLOTS 8종에서 이미 옮긴 weapon/armor/charm 셋을 빼면 helm·glove·
  boot·ring·neck 다섯). data-item.js BASES 그대로 11종 추가: 투구
  (helm) 3종(면갑·철립·투구)·장갑(glove) 2종(완갑·완대)·신발(boot)
  2종(화자·짚신)·목걸이(neck) 2종(옥패·금패)·반지(ring) 2종(옥가락지·
  금지환). `SOCK_MAX`(helm2·glove1·boot1·ring1·neck1)·`GEM_SLOT_CAT`
  (helm/glove/boot→armor, ring/neck→charm) 둘 다 원작 그대로 얹었다 —
  `NO_DUR_SLOT`엔 ring/neck이 이미 있어(11장 이전부터) 안 건드림.
- **이 다섯을 더한 진짜 이유** — `SETS` 열 벌 중 지난 절이 못 채운
  나머지 여섯(청낭·철옹·은하·맹혼·비영·현학)이 전부 이 다섯 슬롯에
  걸쳐 있었다. 이제 열 벌 다 3점(완성)에 닿는다(dungeon_items.gd
  SETS 주석 참고) — 새 슬롯을 추가한 게 아니라 "이미 데이터에 있던
  세트 조각을 마저 채운" 일이라는 점에서 11장(갑주)의 연장선이다.
- `dungeon_equipment_state.gd`: `SLOT_NAMES`가 data-item.js SLOTS
  순서 그대로 8부위로 늘었다. `_item_for`/`_set_item`/`_emit_changed`
  세 헬퍼에 다섯 갈래만 더하면 됐지만, `_active_items()`·
  `repair_all_cost()`·`repair_all()`이 아직도 `[weapon, armor, charm]`
  을 하드코딩해 두고 있던 걸 이 김에 `SLOT_NAMES`를 도는 방식으로
  일반화했다(넷째 부위가 왔을 때 이미 세웠어야 할 관례). `restore()`는
  위치 인자 셋(weapon/charm/armor)으로 부르던 옛 방식이 여덟으로는
  못 버텨 `slot_name -> item` Dictionary 하나를 받는 방식으로 바꿨다
  (`dungeon_save_state.gd`가 SLOT_NAMES를 돌며 채워 넘긴다 — 옛 세이브
  에 없는 슬롯은 {}로 안전하게 채워짐).
- `dungeon_save_state.gd`: helm/glove/boot/ring/neck 다섯 저장 필드
  순수 추가(버전 안 올림). `player_health.gd`: 여덟 `*_changed` 신호를
  SLOT_NAMES를 돌며 한 번에 구독(`Signal(obj, name).connect()`로 —
  신호는 `.get(name)`으론 안 잡힌다, 이번에 직접 겪음). `vendor_button.gd`:
  투전(갑주 한 칸뿐이던 것)을 SLOT_NAMES 여덟 칸으로 늘리고, 감정
  우선순위 검사도 세 슬롯 하드코딩 대신 SLOT_NAMES를 도는 루프로 바꿨다
  (`_slot_label()` 헬퍼로 화면 표기 한글만 따로 둠 — 실존 인물 이름이
  아니라 부위 이름이라 이름 정책과 무관).
- 검증: 헤드리스 3회 로그 완전 동일(md5 일치). 임시 씬으로 21항목
  검증(BASES 슬롯 배정·SOCK_MAX·GEM_SLOT_CAT·NO_DUR_SLOT·SLOT_NAMES
  8부위·equip()이 helm_changed를 쏘는지·철옹 3점 완성(hpPct+20 정확히
  일치)·helm/armor는 크게 닳으면 부서지되 neck은 안 닳음·identify·
  save/load 왕복(helm·neck·ring 감정 상태까지)) 전부 PASS — 검증 중
  한 번 FAIL이 났었는데(신호 발화 확인에 bool 지역변수를 쓴 람다 캡처
  문제, 이 저장소가 이미 문서화해 둔 함정) 배열 칸으로 바꿔 재확인해
  보니 실제 결함이 아니라 테스트 코드 실수였다. 실기 `save_dungeon.json`
  은 Bash로 스크립트 실행 **전에** 백업해 뒀다가 실행 직후 곧바로
  복원했다(스크립트 안에 복원 코드를 두지 않음 — memory: 중간 오류로
  복원이 누락된 전례가 있어 이번엔 처음부터 Bash 쪽에서 감쌌다), diff로
  바이트 일치 재확인. GO·FOREST·STORY·REALM 회귀도 헤드리스 오류 0건.
  `git status`로 의도한 다섯 파일만 확인(새 스크립트 없음, `.uid`/
  `.import`/`project.godot` 잡음 없음).
- **다음에 할 일**: DUNGEON 51장 축("던전 증가→엘리트→보스→장비→빌드")
  중 "장비"가 이걸로 사실상 다 찼다(8부위+소켓+접사+세트 전부). 남은
  건 "빌드"(스킬트리·핫바처럼 장비를 넘어선 조합 시스템, SETS의
  `skill` 필드가 원래 이 자리다) — DUNGEON 밖(GO/FOREST/STORY/REALM
  추가 확장·saga-unity 트랙)을 고려할 자리이기도 하다.

## 13. 51장 "장비→빌드" — 무예(스킬) 첫 걸음: 직업별 passive 세 단 (2026-09-14, 같은 날 이어서, "사가도곳 이어해")

- 지난 절이 남긴 "빌드"(스킬트리·핫바)로 넘어갔다. 웹판 `data-skill.js`
  는 직업 5 × 갈래 8 × 단 3 = 120개 무예를 갖지만, 그중 **투사체·
  범위판정·소환 같은 새 전투 코드를 하나도 안 짜도 바로 꽂히는 것은
  `shape:'passive'` 열넷뿐**이었다 — `dungeon_run_state.gd::_sum_eff()`
  가 이미 은사·장비·부대 세 갈래를 world eff 키(atkPct·hpPct·critPct·
  reachPct·atkSpdPct·drainPct·guardPct)로 합산해 melee_attack.gd·
  player_health.gd가 실전에서 쓰고 있어, 여기에 "무예 랭크"라는 **네
  번째 자리**만 얹으면 끝이었다. 이 열넷(정확히는 br=2 branch, 책사만
  row0 `s_wave`가 passive가 아니지만 원작의 "앞 단에 1점 있어야 다음
  단"(prereq) 규칙을 지키려고 함께 옮겼다 — 총 15개)을 첫 슬라이스로
  잡았다.
- 새 파일 `dungeon_skills.gd`(`class_name DungeonSkills`, RefCounted)
  — SKILLS 15종(값 하나 안 바꿈)·MAX_RANK(5)·`skill_by_key`/`skills_of`/
  `value_at`(v+grow*(rank-1))/`prereq_of`. **직업(cls) 표는 새로 안
  만들었다** — dungeon_items.gd의 `class_key_for_weapon()`/
  `CLASS_NAMES`(무기 look이 직업을 정하는 이미 있는 표)를 그대로 쓴다.
- 새 파일 `dungeon_skill_state.gd`(autoload `DungeonSkillState`) —
  `dungeon_party_state.gd::world_eff_sum()`과 완전히 같은 계약. `points`
  (직업별 미사용 점수)·`ranks`(무예별 랭크), `award_point`/`invest`/
  `can_invest`(점수·MAX_RANK·선행 셋 다 확인)/`restore`/`world_eff_sum`.
  `dungeon_run_state.gd::_sum_eff()`에 이 함수를 네 번째로 이어 붙였다
  (한 줄 추가) — `atk_mult()`·`hp_mult()`·`crit_chance()` 등 기존
  getter가 손 안 대도 무예 랭크를 자동으로 반영한다.
- **점수를 얻는 자리** — 원작은 "인물 레벨만큼"인데 이 슬라이스엔
  인물 레벨이 없다. 새 시스템을 만들지 않고 이미 있는 리듬(방
  클리어마다 은사 하나 고르는 그 자리, `test_room.gd::_finish_exit()`)
  에 그대로 얹었다 — 방을 클리어할 때마다, **그 순간 장착 중인 무기가
  정하는 직업**에 점 하나. `dungeon_save_state.gd`에 `skill_points`/
  `skill_ranks` 순수 추가(버전 안 올림).
- UI: `skill_button.gd`(신규, vendor_button.gd·socket_button.gd와 같은
  결 — HUD 버튼 하나가 ChoicePrompt를 연다) + `DungeonHUD.tscn`에
  `SkillButton`(🥋) 노드 추가. 지금 장착한 무기의 직업 무예 셋을 보여주고
  누르면 투자, 실패 이유(점수 없음·선행 미달·만랭크)는 토스트로.
- **정직하게 밝혀 둔다** — 15개 중 실제로 지금 효과를 내는 건 11개뿐
  (critPct·reachPct·atkSpdPct·hpPct×2·atkPct·drainPct×2·guardPct, 전부
  `dungeon_run_state.gd`가 이미 소비 중). 나머지 넷(`s_wave`의 bolt
  자체·`mpRegen`×2·`skillPct`×2·`allResPct`)은 그 채널을 소비할 시스템
  (투사체·기력·활성 무예 위력 배율·결별 저항 합산)이 아직 없어 값만
  쌓이고 조용히 아무 효과가 없다 — `dungeon_run_state.gd` 헤더의
  "goldPct(경제 시스템 없음)"과 같은 결의 판단이다, 값을 지어내지
  않았다.
- 검증: 헤드리스 임포트 오류 0건, `TestRoom.tscn` `--quit-after 6`
  세 번 연속 로그 완전 동일(md5 일치) — 새 스크립트 둘(`dungeon_
  skills.gd`·`skill_button.gd`)이 `.uid` 없이 만들어져 `class_name`이
  안 풀리는 최초 실패를 한 번 겪었고(과거 세션이 이미 문서화해 둔
  함정, `--headless --editor --quit`으로 재확인 후 해결), `project.
  godot`엔 내가 더한 autoload 한 줄 말고 다른 변화가 없는 것도 diff로
  재확인했다. 임시 씬으로 20항목 검증(SKILLS 표·prereq_of 경계(row0
  없음/row2가 row1을 요구)·value_at 공식·점수 없으면 row0도 투자
  불가·선행 없으면 row1 불가·MAX_RANK 상한·**직업별 점수 완전 분리**
  (archer 투자가 warrior 점수에 안 샘)·**실전 경로**(`a_eye` 1단
  투자 시 `DungeonRunState.crit_chance()`가 정확히 +4 오르는 것까지
  확인 — 데이터·집계뿐 아니라 실제 소비 지점까지)·save/load 왕복)
  전부 PASS. 실기 `save_dungeon.json`은 Bash로 실행 전/후 백업·복원,
  diff로 바이트 일치 재확인. GO·FOREST·STORY·REALM 회귀도 헤드리스
  오류 0건. `git status`로 의도한 여섯 파일(신규 스크립트 둘 + `.uid`
  둘 + 기존 다섯 수정)만 확인.
- **다음에 할 일**: 남은 br 일곱 갈래(bolt·swing·nova·dash·buff·heal·
  summon 등 활성 무예)는 전부 투사체·범위 판정·소환 같은 새 전투
  코드가 있어야 해 훨씬 큰 몫이다 — 이번처럼 "새 시스템 없이 바로
  꽂히는 것"이 아니다. GUI 실기 확인은 아직(몰아서 받을 것, HUD에
  버튼이 하나 늘어난 것도 함께 볼 것). DUNGEON 밖(GO/FOREST/STORY/
  REALM 추가 확장·saga-unity 트랙)을 고려할 자리이기도 하다.

## 14. 51장 "장비→빌드" — 첫 활성 무예: 기공파(s_wave, bolt) (2026-09-14, 같은 날 이어서, "사가고돗 이어해")

- 위 13절이 예고한 "훨씬 큰 몫"(투사체 등 새 전투 코드) 중 가장 작은
  하나(shots=1, 대상 하나)만 먼저 옮겼다. 웹판 `applyShapeSkill()`의
  'bolt'는 진짜 투사체(속도 330, 최대 1.5초 생존, 벽에 닿으면 소멸)를
  쏘지만, 이 슬라이스엔 투사체 이동/충돌 시스템이 없어 "가장 가까운 적
  하나를 즉시 맞히는" 히트스캔으로 근사했다(우물이 원작 미니게임을 즉시
  회복으로 근사한 것과 같은 결의 판단) — `games/saga_dungeon/player/
  skill_bolt.gd` 신규, melee_attack.gd와 같은 경계(Player 자식 컴포넌트,
  HUD 버튼이 "skill_bolt" 그룹으로 찾아 같은 진입점 호출)로 짰다.
- 기력(mp)이 없어 `sk.cost`(30)는 소비하지 않고 쿨다운(`sk.cd`, 8초)만
  남발을 막는다 — `dungeon_skills.gd`의 `s_wave` 항목에 `shape`·`cd`·
  `el`(chi) 세 필드를 원작 값 그대로 채워 넣었다(passive 열넷을 옮길 때
  비워 뒀던 자리). `s_focus`·`y_hex`가 쌓아 온 `skillPct`도 이번에 처음
  실제로 소비된다 — `DungeonRunState.skill_mul()` 신규(world eff 합산에
  안 섞고 skill_bolt.gd가 직접 곱한다, "무예 위력"은 무예 데미지에만
  곱해야 하는 계수라서).
- 데미지 공식은 melee_attack.gd의 기준(ATK_DAMAGE=9, atk_mult+장비flat/pct,
  crit 1.85배)을 그대로 가져오되 `value_at(sk,rank)`(원작 v/grow)와
  `skill_mul()`을 곱한다 — 상수(9.0·1.85)를 새로 안 만들고 melee_attack.gd
  의 const를 preload로 참조. 새 입력 액션 `dungeon_skill_1`(R키) + HUD
  버튼(`bolt_button.gd`, 🌊) 추가.
- 검증: 헤드리스 임포트 오류 0건, `TestRoom.tscn` `--quit-after 8` 세 번
  연속 로그 완전 동일(md5 일치). 임시 씬(`_verify_bolt.tscn`, 검증 후
  삭제)으로 9항목 PASS — 랭크0 무동작·투자 후 랭크1·**데미지 공식 정확히
  일치**(9×2.2=19.8→round 20, HP 24→4 실측)·쿨다운 차단·사거리 밖 실패까지
  확인. GO·FOREST·STORY·REALM 회귀도 헤드리스 오류 0건. `.import` 잡음은
  이전부터 있던 vroid 텍스처뿐(이번 세션 변경 아님), `project.godot` diff는
  의도한 입력 액션 한 블록뿐임을 재확인.
- **다음에 할 일**: 남은 여섯 갈래(swing·nova·dash·buff·heal·summon)는
  범위 판정·돌진·버프/치유·소환 등 각자 다른 새 코드가 필요 — bolt보다
  더 큰 몫들. GUI 실기 확인은 아직(몰아서 받을 것, R키/🌊 버튼 둘 다).
  DUNGEON 밖(GO/FOREST/STORY/REALM 추가 확장·saga-unity 트랙)도 고려할
  자리.

## 15. 51장 "장비→빌드" — 둘째 활성 무예: 회전참(w_whirl, swing) (2026-09-14, 또 이어서, "사가고돗 이어서해")

- 14절이 예고한 여섯 갈래 중 swing(범위 판정)을 옮겼다 — bolt(가장
  가까운 적 하나)와 달리 자기 둘레 반경(`sk.r`×`reach_mult()`) 안의 적
  **전부**를 때린다. `games/saga_dungeon/player/skill_whirl.gd` 신규,
  skill_bolt.gd와 완전히 같은 경계(Player 자식 컴포넌트, HUD 버튼이
  그룹으로 찾아 같은 진입점 호출, melee_attack.gd의 ATK_DAMAGE/CRIT_MULT
  재사용). 무장(warrior) br=0 row=0 `w_whirl`을 `dungeon_skills.gd`에
  신규 추가(원작 값 그대로: v=1.7·grow=0.35·r=2.3·cd=5). row=0이라
  기존 warrior br=2 사슬(w_tough 등)과 무관하게 바로 투자 가능 —
  점수는 클래스당 하나로 이미 공유된다(dungeon_skill_state.gd).
- 원작 넉백(kb=30)은 이 슬라이스에 넉백 자체가 없어(melee_attack.gd도
  안 한다) 값만 보존하고 안 쓴다 — mpRegen 등과 같은 결의 판단. 새 입력
  액션 `dungeon_skill_2`(L키) + HUD 버튼(`whirl_button.gd`, 🌀) 추가.
  겸사겸사 `s_focus`·`y_hex`의 desc에 남아 있던 "아직 활성 무예 없음"
  문구도 지웠다(이제 사실이 아니게 됐다).
- 검증: 헤드리스 임포트 오류 0건, `TestRoom.tscn` `--quit-after 8` 세
  번 연속 로그 완전 동일(md5 일치, bolt 검증 때와 같은 해시). 임시 씬
  (`_verify_whirl.tscn`, 검증 후 삭제)으로 10항목 PASS — 랭크0 무동작·
  투자 후 랭크1·**반경 경계 정확히 일치**(반경 안 2.0m·경계 2.3m 둘 다
  피격, 2.5m는 무사, 데미지 round(9×1.7)=15 실측 일치)·쿨다운 차단까지
  확인. GO·FOREST·STORY·REALM 회귀도 헤드리스 오류 0건. `project.godot`
  diff는 의도한 입력 액션 한 블록뿐임을 재확인.
- **다음에 할 일**: 남은 다섯 갈래(nova·dash·buff·heal·summon) 중 nova는
  swing과 거의 같은 반경 판정(자기 자리 고정, sk.r 대신 고정 반경)이라
  다음으로 가장 작은 몫. dash·buff·heal·summon은 각각 이동/상태효과
  지속시간/소환 같은 아직 없는 하위 시스템이 필요해 더 크다. GUI 실기
  확인은 아직(몰아서 받을 것, L키/🌀 버튼도 함께). DUNGEON 밖(GO/FOREST/
  STORY/REALM 추가 확장·saga-unity 트랙)도 고려할 자리.

## 16. 51장 "장비→빌드" — 셋째 활성 무예: 뇌쇄(y_thunderdoom, nova) (2026-09-15, "사가고돗 이어할사항 다 이어해")

- 15절이 예고한 nova를 옮겼다 — swing과 판정은 같지만(둘레 반경 안 적
  전부) **`reach_mult()`를 안 곱한다**(원작 dungeon.js `applyShapeSkill()`
  의 'nova'는 `sk.r`을 그대로 반경으로 쓴다, swing만 `reachOf()`를
  곱한다). 방사(mystic)는 여태 br=2 세 단(passive)뿐이었어서 이걸로
  scholar(bolt)·warrior(swing)에 이어 **셋째 직업이 첫 활성 무예**를
  얻는다. `dungeon_skills.gd`에 mystic br=5 row=0 `y_thunderdoom`(원작
  값 그대로: v=2.2·grow=0.5·cd=9·el=lit) 신규, row=0이라 기존 mystic
  br=2 사슬과 무관하게 바로 투자 가능.
- **반경 환산**: 원작 `sk.r`(130, 픽셀)은 swing의 `sk.r`(1.7~3.2, 이미
  미터로 쓰는 값)과 자릿수가 다르다 — swing은 웹에서 `reachOf()×sk.r`
  (BASE_REACH 34px 곱)로 실제 반경이 나오지만 nova는 `sk.r` 자체가 이미
  그만큼(≈34배) 커진 원시값이기 때문. `sk.r`을 BASE_REACH(34)로 나눈
  3.82를 미터로 썼다 — 웹의 실제 반경 비율(nova 130 : swing 78.2 ≈1.66)과
  이 값의 비율(3.82:2.3≈1.66)이 정확히 일치해 임의 상수가 아니다.
  자세한 유도는 `dungeon_skills.gd` 헤더 주석 참고. 신규
  `games/saga_dungeon/player/skill_nova.gd`(Player 컴포넌트)·
  `ui/nova_button.gd`(⚡ HUD 버튼)·입력 액션 `dungeon_skill_3`(N키).
- 검증: 헤드리스 임포트 오류 0건, `TestRoom.tscn` `--quit-after 8` 세 번
  연속 로그 완전 동일. 임시 씬(`_verify_nova.tscn`, 검증 후 삭제)으로
  13항목 PASS — row0 선행조건 없음·**반경 경계 정확히 일치**(3.80m·
  3.81m 피격, 4.00m 무사)·데미지 round(9×2.2)=20 실측·쿨다운 차단까지
  확인. GO·FOREST·STORY·REALM 회귀도 헤드리스 오류 0건. `project.godot`
  diff는 의도한 입력 액션 한 블록뿐임을 재확인.
- **다음에 할 일**: 남은 네 갈래(dash·buff·heal·summon)는 각각 이동
  판정/상태효과 지속시간/소환 같은 아직 없는 하위 시스템이 필요해 지금
  까지의 셋(bolt·swing·nova)보다 크다. GUI 실기 확인 아직(몰아서 받을
  것, N키/⚡ 버튼도 함께). DUNGEON 밖(GO/FOREST/STORY/REALM 추가 확장·
  saga-unity 트랙)도 고려할 자리.

## 17. 51장 "장비→빌드" — 넷째 활성 무예: 질주사(a_dashshot, dash) (2026-09-15, "dash 이어해")

- 궁장(archer) br=5 row=0 `a_dashshot` 추가 — bolt(scholar)·swing(warrior)·
  nova(mystic)에 이은 넷째 직업 첫 활성 무예, 이걸로 다섯 직업 중 넷이
  활성 무예를 하나씩 갖는다(도독만 남음). dash는 **처음으로 플레이어
  위치 자체를 옮기는** 무예라 `player.gd`(GO와 공유)에 아주 작은 훅
  둘(`dash_dir`·`dash_speed`)을 추가했다 — boon_speed_sync.gd가
  `speed_mult`를 미는 것과 같은 일방 통행, 기본값 0/영벡터라 GO는 영향
  없다.
- **속도 환산**: nova가 "반경"을 `BASE_REACH`(34px) 기준으로 옮긴 것과
  달리 dash는 "이동"이라 `BASE_SPD`(148px/s, 원작 이동속도 기준값)를
  기준 삼아 원작 돌진 속도(620px/s)를 `620×(6.0/148)≈25.14`m/s로
  옮겼다(6.0=player.gd WALK_SPEED, 그 웹 쪽 짝). 지속시간은 원작
  `0.2×(sk.far||1)`초 그대로(a_dashshot은 far 없음) — 한 번에 ≈5m.
  지나는 적 판정 반경은 몬스터별 충돌 반지름이 없는 이 슬라이스 특성상
  새 상수 대신 `melee_attack.gd`의 `ATK_RANGE`(2.4m)를 재사용했다.
- **실측으로 잡은 함정** — 처음엔 `velocity`+`move_and_slide()`로
  옮겼더니 돌진 경로 위의 적(둘 다 CharacterBody3D)과 몸통이 부딪혀
  플레이어가 옆으로 밀려났다(사거리 밖에 둔 검증용 적까지 맞는 걸로
  발견). 원작 dungeon.js 돌진도 `p.x`/`p.y`를 충돌 없이 직접 더할 뿐이라,
  `player.gd`의 돌진 분기를 `global_position` 직접 이동으로 바꾸고 그
  프레임 `move_and_slide()`·중력을 건너뛴다(끝나면 다음 프레임부터 정상
  재개). 원작의 돌진 중 무적(`p.invuln`)은 이 슬라이스에 회피·무적
  시스템 자체가 없어(`combat_dodge` 입력도 아직 안 걸림) kb·mpRegen과
  같은 결로 값만 두고 안 쓴다.
- 신규 `games/saga_dungeon/player/skill_dash.gd`·`ui/dash_button.gd`
  (💨)·입력 액션 `dungeon_skill_4`(V키).
- 검증: 헤드리스 임포트 오류 0건, `TestRoom.tscn` 세 번 연속 로그 완전
  동일(player.gd 변경 전후 md5도 일치 — 정적 로드엔 영향 없음 확인).
  임시 씬(`_verify_dash.tscn`, 검증 후 삭제)으로 13항목 PASS — row0
  선행조건 없음·돌진 경로 위 적만 피격(사거리 밖 적 무사)·이동 거리·
  데미지 round(9×1.3)=12·쿨다운까지 확인. GO·FOREST·STORY·REALM 회귀도
  헤드리스 오류 0건(GO는 `player.gd` 변경의 직접 당사자라 특히 재확인).
  `project.godot` diff는 의도한 입력 액션 한 블록뿐임을 재확인.
- **다음에 할 일**: 다섯 직업 중 유일하게 활성 무예가 없는 도독(marshal)
  — buff(m_rally 등, br=0)가 후보. heal·summon은 그 뒤. GUI 실기 확인
  아직(몰아서 받을 것, V키/💨 버튼도 함께). DUNGEON 밖(GO/FOREST/STORY/
  REALM 추가 확장·saga-unity 트랙)도 고려할 자리.

## 18. 51장 "장비→빌드" — 다섯째 활성 무예: 사기(m_rally, buff) (2026-09-15, "buff 이어해")

- 도독(marshal) br=0 row=0 `m_rally` 추가 — 이걸로 **다섯 직업 전부**
  활성 무예를 하나씩 갖는다(bolt·swing·nova·dash·buff). buff는 대상도
  방향도 없이 **자신에게 한동안(sec초) 효과**를 거는 첫 무예라
  `dungeon_run_state.gd`에 `_temp_buffs`(잠깐짜리 world eff, boons·장비·
  부대·무예 랭크에 이은 다섯 번째 합산 자리)와 `add_temp_buff(eff_key,
  value, sec)`를 신규로 얹었다. 원작 dungeon.js `addBuff()`/`boonVal()`
  그대로: 값·만료 시각만 들고 있다가 `_sum_eff()`가 조회 시점에 안
  끝났으면 더한다(틱 타이머로 안 지운다). 세이브에는 안 남는다(원작
  "잠깐짜리 무예·분신은 회차 안에서만 산다" 그대로).
- **`eff`를 비워 둔 이유**(다른 넷과 같은 이유, dungeon_skills.gd 헤더
  참고) — `eff`를 채우면 `dungeon_skill_state.gd::world_eff_sum()`이
  "랭크만 있으면 늘 더하는 패시브"로 착각해 버프가 꺼져 있어도 영구히
  atkSpdPct가 오른다. 실제 대상 스탯은 `buff_eff`라는 별도 필드에 두고
  `skill_buff.gd`가 캐스팅 순간에만 읽어 `add_temp_buff()`로 넘긴다.
- 신규 `games/saga_dungeon/player/skill_buff.gd`·`ui/buff_button.gd`
  (🚩)·입력 액션 `dungeon_skill_5`(B키). 다른 넷과 달리 대상 판정이
  없어 컴포넌트가 가장 단순하다(플레이어 참조도 필요 없음).
- 검증: 헤드리스 임포트 오류 0건, `TestRoom.tscn` 세 번 연속 로그 완전
  동일. 임시 씬(`_verify_buff.tscn`, 검증 후 삭제)으로 11항목 PASS —
  row0 선행조건 없음·캐스팅 즉시 `atk_speed_mult()` 1.0→1.30 반영·
  쿨다운 차단·짧은 지속시간(0.15초)으로 만료 후 자동 제외 확인·약한
  재시전이 강한 버프를 안 깎아 먹는 것(addBuff 규칙)까지 확인. 종료
  직전 "material is null" 경고 한 줄은 FOREST 51장 검증 때와 같은
  종료-순서 특유 현상으로 판단(실제 게임 코드 경로 아님). GO·FOREST·
  STORY·REALM 회귀도 헤드리스 오류 0건. `project.godot` diff는 의도한
  입력 액션 한 블록뿐임을 재확인.
- **다음에 할 일**: 다섯 직업 모두 첫 활성 무예를 얻어 51장의 "무예"
  갈래가 한 바퀴 돌았다. 남은 shape(heal·summon·curse·chain)는 각자
  더 필요하고, 각 직업의 둘째 활성 무예(예: w_cleave, s_blaze 등)로
  이어갈 수도 있다. GUI 실기 확인 아직(몰아서 받을 것, 다섯 키/버튼
  전부). DUNGEON 밖(GO/FOREST/STORY/REALM 추가 확장·saga-unity 트랙)도
  고려할 자리.

## 19. 51장 "장비→빌드" — 책사의 둘째 활성 무예: 축기회복(s_restore, heal) (2026-09-15, "heal 이어해")

- 책사(scholar) br=5 row=0 `s_restore` 추가 — 다섯 직업 모두 첫 활성
  무예를 이미 가진 뒤라 이번엔 **책사의 둘째 활성 무예**로 "heal" 모양을
  채운다(원작 desc "책사의 첫 회복" 그대로 — 원작에서도 책사에게 heal은
  이 자리가 처음). buff처럼 대상·방향이 없고, 새 시스템도 필요 없다 —
  `player_health.gd`의 기존 `heal_by(max_hp × value_at(rank) / 100)`를
  그대로 부르기만 한다(지금까지 다섯 무예 중 가장 단순).
- 신규 `games/saga_dungeon/player/skill_heal.gd`·`ui/heal_button.gd`
  (💗)·입력 액션 `dungeon_skill_6`(H키).
- 검증: 헤드리스 임포트 오류 0건, `TestRoom.tscn` 세 번 연속 로그 완전
  동일. 임시 씬(`_verify_heal.tscn`, 검증 후 삭제)으로 9항목 PASS —
  row0 선행조건 없음·회복량(max_hp×16%) 정확·최대 체력을 넘겨 회복하지
  않는 클램프·쿨다운까지 확인. GO·FOREST·STORY·REALM 회귀도 헤드리스
  오류 0건. `project.godot` diff는 의도한 입력 액션 한 블록뿐임을 재확인.
- **다음에 할 일**: 남은 shape는 curse·summon·chain. curse(둘레 적
  약화·둔화, 새 상태 하나만 있으면 됨)가 다음으로 작은 몫, summon(분신
  소환)·chain(적 사이 튕기며 타격)은 각자 새 시스템(소환체 AI, 연쇄
  타겟팅)이 필요해 더 크다. GUI 실기 확인 아직(몰아서 받을 것, 여섯
  키/버튼 전부). DUNGEON 밖(GO/FOREST/STORY/REALM 추가 확장·saga-unity
  트랙)도 고려할 자리.

## 20. 51장 "장비→빌드" — 무장의 둘째 활성 무예: 위해(w_intimidate, curse) (2026-09-15, "curse 이어해")

- 무장(warrior) br=5 row=0 `w_intimidate` 추가 — 원작 desc "무장의 첫
  저주" 그대로(첫째는 w_whirl, swing). nova와 같은 반경 판정(자기 둘레,
  `reach_mult()` 안 곱함)이지만 데미지 대신 **상태 둘**을 건다.
- **신규 상태 하나** — `dungeon_enemy.gd`에 `_hex_v`/`_hex_time_left`·
  `apply_hex()`를 추가했다("그동안 받는 모든 피해가 v%만큼 는다").
  `take_damage()` 한 곳에서 배율을 곱해, 공격 스크립트(melee·bolt·swing·
  nova·dash) 다섯 곳을 전부 고칠 필요가 없게 했다 — 원작 strike()가
  물리·무예 안 가리고 한 곳에서 hex를 곱하는 것과 같은 효과를 다른
  방식(스크립트 통합 대신 착탄 지점 통합)으로 낸다. **정직하게 밝혀
  둠**: "가시 돋친" 정예의 반사량은 이 hex 배율이 걸리기 "전"의 원본
  dmg로 계산돼(공격 스크립트가 `take_damage()` 호출 전 dmg로 반사도
  따로 부른다) 저주가 걸린 동안은 원작보다 반사량이 살짝 적다 — 가시
  정예+저주가 겹치는 드문 조합이라 지금은 근사로 둔다(`dungeon_enemy.gd`
  `take_damage()` 주석에 남겨 둠).
- 느려짐은 기존 `apply_elem_slow()`(냉기 감속과 같은 자리, mult=0.35
  원작 그대로)를 재사용 — 새 감속 채널을 안 만든다. 반경 3.82m은
  y_thunderdoom과 같은 환산(원작 r도 130으로 같은 값).
- 신규 `games/saga_dungeon/player/skill_curse.gd`·`ui/curse_button.gd`
  (📛)·입력 액션 `dungeon_skill_7`(C키).
- 검증: 헤드리스 임포트 오류 0건, `TestRoom.tscn` 세 번 연속 로그 완전
  동일. 임시 씬(`_verify_curse.tscn`, 검증 후 삭제)으로 13항목 PASS —
  row0 선행조건 없음·반경 경계(안/밖)·직접 데미지 없음·느려짐·저주 부여·
  `take_damage()`가 실제로 30% 더 받는 것 실측(10 → 13)·쿨다운·만료까지
  확인. GO·FOREST·STORY·REALM 회귀도 헤드리스 오류 0건. `project.godot`
  diff는 의도한 입력 액션 한 블록뿐임을 재확인.
- **다음에 할 일**: 남은 shape는 summon·chain, 둘 다 소환체 AI·연쇄
  타겟팅 같은 새 시스템이 필요해 지금까지보다 크다. 각 직업의 셋째
  활성 무예(예: br=1 갈래)로 더 작은 걸음을 고를 수도 있다. GUI 실기
  확인 아직(몰아서 받을 것, 일곱 키/버튼 전부). DUNGEON 밖(GO/FOREST/
  STORY/REALM 추가 확장·saga-unity 트랙)도 고려할 자리.

## 21. 51장 "장비→빌드" — 방사의 원래 모양: 분신술(y_shade, summon) (2026-09-15, "summon 이어해")

- 방사(mystic) br=0 row=0 `y_shade` 추가 — 원작 `CLASSES` 설명 "분신을
  세우고 적을 묶는다" 그대로, nova·curse처럼 다른 직업에서 "빌려 온"
  게 아니라 방사의 가장 원래 모양이다. 처음으로 **화면에 남는 새
  개체**(분신)가 필요해 지금까지 중 가장 큰 걸음이었다.
- 신규 `games/saga_dungeon/world/dungeon_minion.gd` — `CharacterBody3D`가
  아니라 맨 `Node3D`(물리 충돌 없음, `global_position` 직접 이동 — dash가
  겪은 몸통 충돌 문제를 아예 피한다, 원작 분신도 몸통 충돌이 없다). 가장
  가까운 적을 쫓다가 닿으면 멈춰 서서 주기적으로 때리고, 적이 없으면
  플레이어 곁으로 돌아온다. `sec`초 뒤 스스로 `queue_free()`. **적이
  분신을 공격하지 않는다**(원작 그대로 — hp도 죽음도 없다).
- **속도·거리 환산**: dash와 같은 이유로 "이동"이라 `BASE_SPD`(148px/s)
  기준 — 추격 110px/s→≈4.46m/s, 복귀 90px/s→≈3.65m/s, 소환 위치 흩뿌림
  (±20px×±15px)→≈±0.81m×±0.61m. 공격 판정 거리는 curse·dash와 같은
  이유로 `melee_attack.gd`의 `ATK_RANGE`(2.4m) 재사용. **랭크가 하는
  일이 다른 무예와 다르다** — 데미지가 아니라 `round(value_at(rank))`
  으로 분신 **개체 수**를 늘린다(원작 그대로).
- 신규 `games/saga_dungeon/player/skill_summon.gd`·`ui/summon_button.gd`
  (👥)·입력 액션 `dungeon_skill_8`(M키).
- 검증: 헤드리스 임포트 오류 0건, `TestRoom.tscn` 세 번 연속 로그 완전
  동일. 임시 씬(`_verify_summon.tscn`, 검증 후 삭제)으로 9항목 PASS —
  row0 선행조건 없음·랭크1에 정확히 분신 1개 생성·쿨다운·**분신이 실제로
  6m 밖 적에게 다가가 때리는 것**(2.5초 동안 hp 24→9 감소 실측)·수명
  만료 후 자동 소멸까지 확인. GO·FOREST·STORY·REALM 회귀도 헤드리스
  오류 0건. `project.godot` diff는 의도한 입력 액션 한 블록뿐임을 재확인.
- **다음에 할 일**: 남은 shape는 chain(적 사이 튕기며 타격, 연쇄
  타겟팅 필요)뿐이다 — 이걸로 51장의 8가지 모양(swing·bolt·nova·dash·
  buff·heal·curse·summon) 중 7개를 마쳤다. GUI 실기 확인 아직(몰아서
  받을 것, 여덟 키/버튼 전부). DUNGEON 밖(GO/FOREST/STORY/REALM 추가
  확장·saga-unity 트랙)도 고려할 자리.

(궁장 `a_chain`·도독 `m_chain`으로 chain 모양까지 옮겨 다섯 직업이
모두 활성 무예 둘씩을 채운 경과는 `docs/PROJECT_STATE.md` 2026-09-15
항목에 있다 — 이 파일엔 아직 섹션으로 안 옮겨졌다.)

## 22. 51장 "장비→빌드" — 다섯 직업 셋째 활성 무예를 한 번에 (2026-09-15, "사가고돗 이어 해둬 묻지말고")

- 다섯 직업 모두 활성 무예 둘씩을 채운 뒤, 웹판 `data-skill.js`를 다시
  훑어 **`row: 0`(전 단 없이 바로 쓸 수 있는 것)이면서 이미 옮겨진
  아홉 모양(bolt·swing·nova·dash·buff·heal·curse·summon·chain) 중
  하나인** 항목만 다섯 직업 각각 하나씩 골라 한 세션에 이어 붙였다 —
  이 슬라이스는 진짜 스킬 트리가 아니라 br/row 여러 갈래에서 낱개로
  옮겨 온 것이라(`dungeon_skills.gd` 헤더 참고) row 0을 고르면
  `prereq_of()`가 전 단을 못 찾는 애매한 상황 자체가 안 생긴다.
- 궁장 `a_pierce`(관통사, br0row0, bolt) — 궁장의 첫 bolt(지금까진
  dash·chain뿐). 무장 `w_dash`(돌진, br1row0, dash) — 무장의 첫
  dash(swing·curse에 이어 셋째 모양). 책사 `s_chainfire`(연쇄화염,
  br3row0, chain, el:fire) — chain이 **세 번째로 공유하는 직업**이
  된다(a_chain·m_chain에 이어). 도독 `m_smite`(기격, br1row0, swing,
  el:chi) — 도독의 첫 swing. 방사 `y_curse`(주박, br1row0, curse,
  r=130→3.82·sec=5·v=30 — w_intimidate와 원작부터 전부 같은 값) —
  방사의 첫 curse.
- 다섯 다 기존 shape 스크립트(skill_bolt.gd·skill_dash.gd·
  skill_chain.gd/skill_chain_marshal.gd·skill_whirl.gd·skill_curse.gd)를
  그대로 복제해 SKILL_KEY·그룹명·입력 액션만 바꿨다 — 새 판정 로직 없이
  "직업당 스크립트 하나" 결을 그대로 늘린 것뿐이다(chain이 이미 두
  벌이던 선례를 셋째로 확장). 신규 파일 10개(스크립트 5·버튼 5):
  `skill_bolt_archer.gd`/`bolt_archer_button.gd`(🎯),
  `skill_dash_warrior.gd`/`dash_warrior_button.gd`(💨),
  `skill_chain_scholar.gd`/`chain_scholar_button.gd`(🔗),
  `skill_swing_marshal.gd`/`swing_marshal_button.gd`(✊),
  `skill_curse_mystic.gd`/`curse_mystic_button.gd`(🕸️). 입력 액션
  `dungeon_skill_11`~`15`(G·I·O·P·U 키) 신규 — DUNGEON 안에서 여태
  안 쓰인 글자라 새로 배정했다(FOREST·STORY가 같은 글자를 쓰지만 두
  게임은 동시에 안 돈다).
- 검증: 헤드리스 에디터 임포트 오류 0건. `project.godot`의
  `run/main_scene`을 `games/saga_dungeon/world/TestRoom.tscn`으로 잠깐
  바꿔(검증 뒤 원래 `saga_go/world/TestVillage.tscn`으로 복원, diff로
  재확인) 헤드리스로 그 씬을 직접 로드 — `DungeonPlayer.tscn`·
  `DungeonHUD.tscn`에 새로 매단 노드 10개(스크립트 5·버튼 5)까지 전부
  포함해 파싱·인스턴스화 오류 0건. `project.godot` diff는 의도한
  입력 액션 다섯 블록(25줄)뿐임을 재확인.
- **다음에 할 일**: 다섯 직업 모두 활성 무예 셋씩. 51장 "장비→빌드"
  축에서 더 나아가려면(넷째 활성 무예 등) 웹판과 다시 비교해 범위를
  좁힐 것 — 이제 row 0만 골라도 남은 목록이 꽤 있다(archer br1/br4,
  warrior br4, scholar br0/br1/br4, marshal br4, mystic br4 등). GUI
  실기 확인 아직(몰아서 받을 것, 열다섯 키/버튼 전부). DUNGEON 밖
  (FOREST 51장 "생태계"·"생활" 남은 소소한 몫·saga-unity 트랙)도 있음.

## 23. 51장 "장비→빌드" — 다섯 직업 넷째 활성 무예를 한 번에 (2026-09-15, "사가고돗 이어해")

- 셋째와 같은 방식으로 좁혔다(row:0 + 이미 옮겨진 아홉 모양 중 하나).
  이번엔 다섯 직업 모두 **br=4 row=0**이 조건에 맞았고, 마침 각자
  "여태 이 직업이 안 써 본 모양"이라 이 배치가 끝나면 다섯 직업 전부
  **서로 다른 모양 넷씩**을 갖는다.
- 궁장 `a_flourish`(궁신무, swing, r=1.6) — 궁장의 첫 swing. 무장
  `w_throw`(투창, bolt, el 없음) — 무장의 첫 bolt. 책사 `s_blink`
  (축지, dash, el:'lit') — 책사의 첫 dash. 도독 `m_javelin`(표창,
  bolt, el:'chi') — 도독의 첫 bolt. 방사 `y_soulbolt`(혼탄, bolt,
  el:'chi') — 방사의 첫 bolt. **bolt가 이걸로 궁장·무장·도독·방사
  넷이 공유하는 모양이 된다**(책사는 이미 별개로 s_wave를 가짐 —
  다섯 직업 전부 bolt를 갖는 셈).
- 다섯 다 기존 shape 스크립트(skill_whirl.gd·skill_bolt.gd·
  skill_dash.gd)를 그대로 복제해 SKILL_KEY·그룹·입력 액션만 바꿨다 —
  새 판정 로직 없음. 신규 파일 10개(스크립트 5·버튼 5):
  `skill_swing_archer.gd`/`swing_archer_button.gd`(🥋),
  `skill_bolt_warrior.gd`/`bolt_warrior_button.gd`(🎯),
  `skill_dash_scholar.gd`/`dash_scholar_button.gd`(⚡),
  `skill_bolt_marshal.gd`/`bolt_marshal_button.gd`(🎯),
  `skill_bolt_mystic.gd`/`bolt_mystic_button.gd`(🔮). 입력 액션
  `dungeon_skill_16`~`20`(E·Q·T·X·Y 키) 신규.
- 검증: 헤드리스 에디터 임포트 오류 0건. `project.godot`의
  `run/main_scene`을 `games/saga_dungeon/world/TestRoom.tscn`으로
  잠깐 바꿔(검증 뒤 원래 값으로 복원, diff로 재확인) 헤드리스로 직접
  로드 — `DungeonPlayer.tscn`·`DungeonHUD.tscn`에 새로 매단 노드
  10개까지 전부 포함해 파싱·인스턴스화 오류 0건. `project.godot`
  diff는 의도한 입력 액션 다섯 블록(25줄)뿐임을 재확인. 이번 변경은
  DUNGEON 전용 파일 + `project.godot` 입력 맵 추가뿐이라 GO/FOREST/
  STORY/REALM은 건드리지 않았고, 전체 프로젝트를 훑는 헤드리스 에디터
  임포트 패스도 오류 0이라 회귀 위험은 낮다.
- **다음에 할 일**: 다섯 직업 모두 활성 무예 넷씩. 다섯째로 바로 쓸
  수 있는 후보 둘을 미리 봐 뒀다 — 무장 `w_chain`(연환격, br3row0,
  chain)과 방사 `y_chain`(독쇄, br3row0, chain, el:'pois'), 둘 다 그
  직업엔 아직 없는 chain을 채운다(이걸로 chain이 다섯 직업 전부가
  공유하는 모양이 된다). 다만 이 둘만으론 무장·방사가 다른 셋보다
  하나씩 앞서가니 다섯 직업을 고르게 유지하려면 나머지 셋(궁장·책사·
  도독)의 다섯째도 같이 찾아야 한다 — 남은 row 0 후보는 대부분 이미
  쓴 모양의 다른 원소 변형뿐이라 셋째·넷째만큼 깔끔하진 않다. GUI
  실기 확인 아직(몰아서 받을 것, 스무 키/버튼 전부). DUNGEON 밖
  (FOREST 51장 "생태계"·"생활" 남은 소소한 몫·saga-unity 트랙)도 있음.

## 24. 51장 "장비→빌드" — 무장·방사의 다섯째 활성 무예, chain이 다섯 직업 전부를 공유 (2026-09-15, "사가고돗 이어해줘 순서대로 모두 이어해")

- 앞 절이 미리 봐 둔 후보 그대로: 무장(warrior) `w_chain`(연환격,
  br3row0, el 없음)과 방사(mystic) `y_chain`(독쇄, br3row0, el:'pois')
  추가 — **chain이 이걸로 다섯 직업 전부가 공유하는 첫 모양이 된다**
  (지금까지 최대였던 bolt의 넷을 넘어선다).
- `skill_chain.gd`(a_chain)·`skill_chain_marshal.gd`(m_chain)·
  `skill_chain_scholar.gd`(s_chainfire)와 판정·감쇠 계산이 완전히
  같아(chain이 네 번째로 공유) 그대로 복제했다 — 새 판정 로직 없음.
  신규 파일 4개(스크립트 2·버튼 2): `skill_chain_warrior.gd`/
  `chain_warrior_button.gd`(🔗), `skill_chain_mystic.gd`/
  `chain_mystic_button.gd`(🔗). 입력 액션 `dungeon_skill_21`~`22`
  (Z·5 키) 신규 — DUNGEON 안에서 남은 미사용 글자가 Z 하나뿐이라(A~Z
  중 이동·전투·기존 스무 무예가 다 씀), 22번째는 STORY가 쓰는 숫자
  "5"를 재사용했다(두 게임은 동시에 안 돈다, 기존 선례와 같은 판단).
- 검증: 헤드리스 에디터 임포트 오류 0건. `project.godot`의
  `run/main_scene`을 `TestRoom.tscn`으로 잠깐 바꿔(검증 뒤 원복,
  diff로 재확인) 헤드리스 3회 로그 완전 동일(md5 일치). 임시 씬
  (`_verify_chain5.tscn`, 검증 후 삭제)으로 21항목 PASS — 투자
  게이트(포인트 없음/랭크0이면 invest·try_cast 실패)·row0 선행조건
  없음·홉 상한(3) 경계(4번째 적은 hops 소진으로 안 맞음)·데미지가
  12%씩 감쇠하는 것 실측(16→14→12, 24hp 잡졸 기준)·쿨다운 중 재시전
  실패·사거리(7.65m) 밖이면 거기서 체인이 멈추는 것(둘째 표적 컷)·
  el 기본값(w_chain=phys, y_chain=pois)까지 확인. GO 기본 씬 회귀
  헤드리스 오류 0건, 전체 프로젝트 임포트 패스도 오류 0건.
- **다음에 할 일**: 다섯 직업 모두 chain 포함 서로 다른 모양을 몇 개씩
  갖게 됐지만 "다섯째"가 고르게 다섯씩은 아니다(무장·방사만 다섯째를
  얻음) — 다음 세션이 웹판 `data-skill.js`를 다시 대조해 궁장·책사·
  도독의 다섯째(대부분 row>0, 진짜 prereq 체인이 필요한 갈래)로
  넘어갈지, 아니면 DUNGEON 밖(FOREST 51장 "생태계"·"생활" 남은 소소한
  몫·saga-unity 트랙)으로 옮길지 판단할 것. GUI 실기 확인 아직(몰아서
  받을 것, 스물두 키/버튼 전부).

## 25. 51장 "장비→빌드" — 갈래(branch) 채우기: 궁장·도독 6/6, 책사 5/6 (2026-09-15, "이어해")

- w_chain·y_chain을 넣은 뒤 다시 세어 보니 **무장·방사는 이미 br
  0·1·2·3·4·5 여섯 갈래 전부에 row0이 있었다**(무장: whirl·dash·
  passive·chain·throw·curse. 방사: summon·curse·passive·chain·bolt·
  nova) — "다섯째 활성 무예"보다 **"남은 갈래 채우기"**가 더 정확한
  다음 걸음이라 방향을 바꿨다. 궁장(br1)·책사(br0·br1)·도독(br5)의
  빈 갈래 중 셋을 채운다.
- 궁장 `a_fire`(화시, br1row0, bolt, el:'fire') — 궁장을 6/6으로.
  책사 `s_fire`(화탄, br0row0, bolt, el:'fire') — 책사는 br1(`s_ice`)이
  아직 남아 5/6. 도독 `m_flamesaber`(화도, br5row0, swing, el:'fire',
  r=1.7, swing이라 원작 r을 그대로 미터로) — 도독을 6/6으로. **도독은
  swing이 이걸로 두 번째**(`m_smite` br1에 이어) — 같은 클래스가 같은
  모양을 두 갈래에 갖는 첫 사례.
- 셋 다 기존 shape 스크립트(`skill_bolt.gd`/`skill_bolt_archer.gd`,
  `skill_whirl.gd`/`skill_swing_marshal.gd`)를 복제 — 새 판정 로직
  없음. 같은 클래스+모양 조합이 처음 겹쳐(궁장 bolt 2벌, 도독 swing
  2벌) 파일명에 `2`를 붙였다: `skill_bolt_archer2.gd`/
  `bolt_archer2_button.gd`(🔥), `skill_bolt_scholar2.gd`/
  `bolt_scholar2_button.gd`(🔥), `skill_swing_marshal2.gd`/
  `swing_marshal2_button.gd`(🔥). 입력 액션 `dungeon_skill_23`~`25`
  (6·7·8 키) 신규 — STORY가 쓰는 숫자를 재사용했다(두 게임은 동시에
  안 돈다, `w_chain` 때 Z를 그대로 쓴 것과 같은 판단).
- 검증: 헤드리스 에디터 임포트 오류 0건. `TestRoom.tscn`으로 잠깐
  바꿔(검증 뒤 원복, `project.godot` diff가 입력 액션 세 블록(15줄)
  뿐임을 재확인) 헤드리스 3회 로그 완전 동일. 임시 씬
  (`_verify_branch3.tscn`, 검증 후 삭제)으로 18항목 PASS — 투자
  게이트·데미지 실측(`a_fire` 14, `s_fire` 16, `m_flamesaber` 17,
  전부 `9×v` 공식과 일치)·swing 반경(1.7m) 경계(밖의 적은 안 맞음)·
  el 필드 확인까지. **테스트 중 발견**: 임시 검증용 적을 만들 때
  정예(elite) 확률(7.2%)을 안 눌러 두면 `max_hp`가 랜덤 스케일돼
  데미지 비교가 가끔 어긋난다(실제로 첫 실행에서 한 번 겪음) —
  `resist`뿐 아니라 `max_hp`/`hp`도 생성 직후 명시적으로 덮어써야
  결정적이다(다음에 비슷한 임시 검증 씬을 짤 때 참고). GO 기본 씬
  회귀 헤드리스 오류 0건.
- **다음에 할 일**: 책사 br1(`s_ice`, bolt, el:'cold')만 채우면 다섯
  직업 전부 6/6 갈래 완성. 그 뒤엔 row>0(진짜 prereq 체인, 예:
  `a_multi` 다중발사·`a_venom` 도트 등 새 메커니즘이 필요한 것들)로
  넘어갈지, DUNGEON 밖(FOREST 51장 "생태계"·"생활" 남은 소소한 몫·
  saga-unity 트랙)으로 갈지 다음 세션이 판단할 것. GUI 실기 확인
  아직(몰아서 받을 것, 스물다섯 키/버튼 전부).

## 26. 51장 "장비→빌드" — 책사 br1 채움, 다섯 직업 전부 6/6 갈래 완성 (2026-09-15, "이어해")

- 책사(scholar) `s_ice`(빙탄, br1row0, bolt, el:'cold') 추가 — 이걸로
  **다섯 직업 전부가 여섯 갈래(br0~5)에 row0을 갖는다**. 책사가 bolt를
  세 갈래(br2 `s_wave`·br0 `s_fire`·br1 `s_ice`)에 갖는 첫 사례라
  스크립트는 `skill_bolt_scholar3.gd`.
- 기존 `skill_bolt.gd`/`skill_bolt_scholar2.gd`를 복제 — 새 판정 로직
  없음. 신규 `skill_bolt_scholar3.gd`/`bolt_scholar3_button.gd`(❄️).
  입력 액션 `dungeon_skill_26`(9 키, STORY `story_job_skill4_3`이 쓰는
  숫자 재사용).
- 검증: 헤드리스 에디터 임포트 오류 0건, `TestRoom.tscn` 3회 로그
  완전 동일(`project.godot` diff는 입력 액션 한 블록 5줄뿐 재확인).
  임시 씬(`_verify_sice.tscn`, 검증 후 삭제)으로 15항목 PASS — 투자
  게이트·데미지 실측(14, `v1.5×9`)·`el:'cold'`·row0 선행조건 없음에
  더해, **다섯 직업 모두 `DungeonSkills.skills_of()`의 br 집합이
  정확히 {0,1,2,3,4,5} 6개인지**를 직접 코드로 세어 확인(archer·
  warrior·scholar·marshal·mystic 전부 6개). GO 회귀 헤드리스 오류 0건.
- **다음에 할 일**: 51장 "장비→빌드"의 "갈래 채우기" 단계는 여기서
  마무리됐다 — 다섯 직업 모두 여섯 갈래 row0을 다 가졌다. 이제부턴
  row>0(진짜 prereq 체인, 예: `a_multi` 다중발사·`a_venom` 도트·
  `a_rain`/`s_meteor` 등 새 메커니즘이 필요한 것들)로 깊이를 더할지,
  DUNGEON 밖(FOREST 51장 "생태계"·"생활" 남은 소소한 몫·saga-unity
  트랙)으로 옮길지 다음 세션이 판단할 것. GUI 실기 확인 아직(몰아서
  받을 것, 스물여섯 키/버튼 전부).

## 27. 51장 "장비→빌드" — row1로 깊이 더하기, 첫 진짜 prereq 체인 (2026-09-15, "묻지 말고 순서대로 진행해줘")

- 다섯 직업 각각 row0이 있는 갈래 하나씩을 골라 row1을 채웠다 —
  **이 슬라이스에서 처음으로 `prereq_of()` 체인이 실제로 걸린다**
  (row0에 먼저 1점을 넣어야 row1을 배울 수 있음, 지금까진 row0만
  있어 늘 통과였다).
- 궁장 `a_ice`(빙시, br1row1, bolt, el:'cold', prereq `a_fire`) —
  궁장의 세 번째 bolt. 무장 `w_cleave`(분쇄, br0row1, swing, r=1.7,
  prereq `w_whirl`) — 무장의 두 번째 swing. 책사 `s_blaze`(염화,
  br0row1, nova, r=120→3.53, el:'fire', prereq `s_fire`) — **책사의
  첫 nova**. 도독 `m_guard`(호신강기, br0row1, buff, buff_eff:
  'guardPct', prereq `m_rally`) — 도독의 두 번째 buff. 방사
  `y_wither`(고독, br1row1, nova, r=130→3.82, el:'pois', prereq
  `y_curse`) — 방사의 두 번째 nova.
- 기존 shape 스크립트(bolt·swing·nova·buff)를 그대로 복제 — 새 판정
  로직 없음(nova가 책사·방사에서 처음 재사용된다는 점만 새로움).
  신규 5개(스크립트): `skill_bolt_archer3.gd`·`skill_swing_warrior2.gd`·
  `skill_nova_scholar.gd`·`skill_buff_marshal2.gd`·
  `skill_nova_mystic2.gd`(+버튼 5개). 입력 액션 `dungeon_skill_27`~
  `31` — 이 시점에서 A~Z 26글자가 이동(4)·공격(1)·무예(21) 자리에
  전부 차서, 숫자 `0`(마지막 남은 숫자)에 이어 이 저장소가 한 번도
  안 쓴 구두점 키(`,`·`.`·`;`·`/`)로 새로 열었다(전체 프로젝트 grep으로
  미사용 확인).
- 검증: 헤드리스 에디터 임포트 오류 0건, `TestRoom.tscn` 3회 로그
  완전 동일(`project.godot` diff 25줄=다섯 블록만 재확인). 임시 씬
  (`_verify_row1.tscn`, 검증 후 삭제)으로 30항목 PASS — **핵심은
  prereq 게이트 실측**: row0 없이 row1을 invest하면 실패하고 포인트도
  안 깎이는 것, row0에 1점 넣은 뒤에야 invest가 성공하는 것을 다섯
  갈래 전부 확인. 데미지 실측(`a_ice` 13·`w_cleave` 23·`s_blaze` 22·
  `y_wither` 20, 전부 `v×9` 공식과 일치)·swing 반경(1.7m) 경계·
  `m_guard` 시전 즉시 `guard_mult()` 1.0→0.65 반영까지. GO 회귀
  헤드리스 오류 0건.
- **다음에 할 일**: row0/row1을 둘 다 채운 다섯 갈래(archer br1·
  warrior br0·scholar br0·marshal br0·mystic br1)가 생겼지만, 아직
  row0만 있는 갈래가 훨씬 많다 — 다음 세션이 웹판과 다시 비교해
  남은 row1/row2를 더 채울지 판단할 것(`a_multi` 다중발사·`y_horde`/
  `y_golem` 소환 강화처럼 새 메커니즘이 필요한 것도 섞여 있어 범위를
  골라야 한다). DUNGEON 밖(FOREST 51장 남은 소소한 몫·saga-unity
  트랙)도 있음. GUI 실기 확인 아직(몰아서 받을 것, 서른한 키/버튼
  전부).
