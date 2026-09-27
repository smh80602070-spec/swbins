# SAGA 프로젝트 — Godot 4.x 3D 신규 구축 최종 작업지시서
## Legacy 1~80 통합판 / Vertical Slice 우선 / Mobile 3D RPG

## 0장 — 읽는 법 (2026-09-16)

- **이야기(시나리오) 정본**: 루트 `../scenario/`(판별 다섯 벌 + 공통 틀 `README.md` — 세 트랙 공통). 사가고는 1~20장이 이 트랙 `story.gd` 가 대사 정본이고, 새 장·다른 판은 거기 장 카드를 따른다. 구현하면 `scenario/README.md` §7 진행표를 고친다.
- **크기**: 이 파일은 약 75KB, 장(章)은 `# N.` H1 이다. `grep -n "^# " PLAN.md` 로 목차를 뽑고 필요한 장만 `sed -n` 으로 읽는다. 통째로 읽지 않는다.
- **상태**는 `docs/PROJECT_STATE.md`(≤15KB, 세션 끝에 덮어씀) 에, **이력**은 `docs/HISTORY.md`(append-only, `grep -n "^## "` 로만) 에 있다. 이 파일엔 **날짜 달린 세션 기록을 쓰지 않는다** — 결정이 바뀔 때만 고친다.
- **상위 문서**: `../SAGA-DESIGN.md`(재미 표준 8·참고 게임 카탈로그·그래픽·에셋·문서 3층). 101~105장이 그 문서를 이 트랙에 맞춰 구체화한 것이다. 웹 다섯 판의 `saga-web/<판>/PLAN.md` §5 가 게임성 후보의 출처다.
- **장 번호는 고정**이다(PROJECT_STATE·HISTORY·코드 주석이 가리킨다). 새 내용은 끝에 새 번호로 덧붙인다.
- 헤드리스 검증·GUI 확인·Godot exe 확보 절차는 폴더 `CLAUDE.md`. 여기서 반복하지 않는다.
- 첫 턴 순서: 루트 CLAUDE.md(자동) → 이 폴더 CLAUDE.md(자동) → 이 0장 → `docs/PROJECT_STATE.md` → 필요한 장·HISTORY 절만.

---

---

# 0. 프로젝트 최종 목표

기존의

- saga-go
- saga-dungeon
- saga-forest
- saga-story
- saga-realm

5개 게임을 기존 웹/JavaScript 구조에서 억지로 Godot으로 포팅하지 않는다.

**Godot 4.x 기반의 완전히 새로운 네이티브 3D 게임 프로젝트로 재구축한다.**

기존 프로젝트와 기존 1~80번 작업지시서는 폐기하는 것이 아니라,

> 기존 구현을 그대로 유지하는 것이 아니라  
> 기존 기획/콘텐츠/게임성 중 가치 있는 부분만 추출하여  
> 신규 Godot 구조에 재설계하여 통합한다.

기존 코드의 구조적 한계를 신규 프로젝트에 그대로 가져오지 않는다.

---

# 1. 최우선 우선순위

모든 작업은 다음 우선순위를 따른다.

1. **게임이 실제로 재미있어야 한다.**
2. **3D 그래픽 품질**
3. **넓고 풍부한 월드**
4. **전투 / 성장 / 탐험**
5. **모바일 UX**
6. **확장 가능한 구조**
7. **Claude Code 토큰 절약**

기능 개수만 늘리는 것을 목표로 하지 않는다.

각 기능은 반드시:

- 왜 필요한가?
- 플레이어가 무엇을 재미있어 하는가?
- 반복 플레이에 어떤 영향을 주는가?
- 다른 시스템과 어떻게 연결되는가?

를 기준으로 판단한다.

---

# 2. 절대 금지사항

다음 작업을 하지 않는다.

- 기존 JS 코드를 Godot GDScript로 기계적으로 변환
- 기존 HTML/CSS/JS 구조를 Godot에 억지로 재현
- 기존 파일을 무조건 유지
- 처음부터 거대한 오픈월드 제작
- 테스트되지 않은 시스템을 대량 생성
- 임시 Placeholder만으로 최종 그래픽을 구성
- 기능만 많고 재미없는 게임 제작
- 모든 시스템을 한 번에 구현
- 동일한 시스템을 5개 게임에 각각 중복 구현
- Claude Code가 불필요하게 전체 프로젝트를 반복 분석
- 이미 완료된 파일을 매번 전체 재작성
- 사용하지 않는 에셋/스크립트 대량 생성

---

# 3. 개발 핵심 원칙

## 3.1 Vertical Slice First

처음부터 완성 게임을 만들지 않는다.

먼저 다음이 모두 들어간 **작은 플레이 가능한 Vertical Slice**를 완성한다.

플레이어

→ 월드 이동

→ 탐험

→ NPC

→ 퀘스트

→ 몬스터

→ 실시간 전투

→ 스킬

→ 보상

→ 장비

→ 성장

→ 다음 지역 이동

→ 저장/로드

까지 하나의 재미있는 게임 루프를 완성한다.

Vertical Slice가 재미있지 않으면 콘텐츠를 늘리지 않는다.

---

# 4. 기존 1~80번 자료 통합 규칙

기존 1~80번 작업지시서가 저장되어 있다면 먼저 분석한다.

단, 그대로 실행하지 않는다.

기존 내용을 다음 4가지로 분류한다.

### KEEP

현재도 가치가 높으며 신규 구조에 그대로 반영할 기능

### REWORK

아이디어는 좋지만 Godot 4.x 구조에 맞게 다시 설계해야 하는 기능

### MERGE

서로 중복되는 기능을 하나의 공통 시스템으로 통합할 기능

### DROP

낡았거나 재미가 없거나 유지비용이 높은 기능

기존 1~80의 기능을 삭제할 때는 무조건 삭제하지 말고,

**왜 유지/변경/통합/삭제하는지 짧게 기록한다.**

이 분석 결과를:

`docs/LEGACY_FEATURE_AUDIT.md`

에 작성한다.

---

# 5. 5개 게임의 역할 재정의

5개 게임은 서로 완전히 다른 엔진/시스템으로 만들지 않는다.

공통 SAGA Core 위에 각 게임의 콘텐츠를 얹는다.

---

## SAGA GO

핵심:

- 탐험
- 이동
- 지역 발견
- 수집
- 몬스터
- 이벤트
- 지도 기반 콘텐츠
- 성장

게임 감각:

**"계속 돌아다니고 발견하고 싶다."**

---

# SAGA DUNGEON

핵심:

- 던전 탐험
- 실시간 전투
- 몬스터
- 엘리트
- 보스
- 장비
- 스킬
- 랜덤 이벤트
- 보상

게임 감각:

**"한 판 더 돌고 더 좋은 장비를 얻고 싶다."**

---

# SAGA FOREST

핵심:

- 넓은 자연환경
- 동물
- 채집
- 탐험
- 생활 콘텐츠
- NPC
- 마을
- 자연 이벤트
- 숨겨진 장소

게임 감각:

**"그냥 돌아다녀도 재미있다."**

---

# SAGA STORY

핵심:

- 스토리
- NPC
- 대화
- 퀘스트
- 선택
- 지역 사건
- 캐릭터 관계
- 메인/서브 스토리

게임 감각:

**"다음 이야기가 궁금하다."**

---

# SAGA REALM

핵심:

- 넓은 세계
- 지역
- 세력
- 도시
- 영지
- 전쟁/분쟁
- 영웅
- 성장
- 전략적 콘텐츠

게임 감각:

**"내가 이 세계를 성장시키고 있다는 느낌."**

---

# 6. 공통 SAGA Core Architecture

5개 프로젝트가 공유할 수 있도록 다음 시스템을 공통화한다.

```text
SAGA Core
├── Player
├── Character
├── Combat
├── Skill
├── Enemy
├── Boss
├── Quest
├── Dialogue
├── Inventory
├── Equipment
├── Item
├── Stats
├── Progression
├── Save
├── World
├── NPC
├── Event
├── Audio
├── Camera
├── Mobile Input
├── UI
├── Localization
├── Data
└── Performance
```

게임별 콘텐츠만 별도 모듈로 만든다.

---

# 7. 데이터 기반 설계

게임 데이터를 코드에 하드코딩하지 않는다.

가능하면:

- Resource
- JSON
- CSV
- Godot Resource
- Scriptable-style Data Resource

등을 활용한다.

예:

```text
data/
├── characters/
├── enemies/
├── bosses/
├── items/
├── equipment/
├── skills/
├── quests/
├── dialogue/
├── maps/
├── events/
└── balance/
```

예:

```text
EnemyData
- id
- name
- level
- hp
- attack
- defense
- move_speed
- attack_range
- skills
- drop_table
- ai_type
```

콘텐츠 추가를 위해 핵심 코드를 수정하지 않아도 되도록 한다.

---

# 8. 실제 3D 에셋 구조

최종 게임은 실제 3D 에셋 기반으로 구성한다.

지원:

- GLB
- GLTF
- PNG
- JPG
- WebP
- Texture
- Animation
- Material

권장 구조:

```text
assets/
├── characters/
├── enemies/
├── bosses/
├── animals/
├── buildings/
├── environment/
├── vegetation/
├── rocks/
├── props/
├── weapons/
├── armor/
├── effects/
├── UI/
└── audio/
```

Placeholder는 개발 초기 테스트용으로만 사용한다.

최종 게임의 주요 화면에는 실제 에셋을 사용한다.

---

# 9. 월드 품질 목표

기존처럼 빈 공간이 많은 월드를 만들지 않는다.

각 지역에는 최소한 다음 계층이 존재하도록 설계한다.

```text
Terrain
├── Main Landmark
├── Secondary Landmark
├── Buildings
├── Vegetation
├── Rocks
├── Props
├── NPC
├── Animals
├── Enemies
├── Hidden Area
├── Resource Area
├── Event Area
└── Dungeon/POI
```

플레이어가 이동할 때:

**"여기는 아무것도 없다."**

라는 느낌이 최대한 발생하지 않도록 한다.

---

# 10. 월드 디자인 원칙

맵 크기만 크게 만들지 않는다.

큰 월드는 다음을 포함해야 한다.

- 시야에 보이는 랜드마크
- 목적지
- 길
- 갈림길
- 숨겨진 공간
- 높은 지역
- 낮은 지역
- 물
- 숲
- 절벽
- 동굴
- 건물
- NPC
- 몬스터
- 채집
- 이벤트
- 던전

즉,

**크기보다 밀도와 발견의 재미를 우선한다.**

---

# 11. 전투 설계

전투는 단순히:

```text
공격 버튼
→ 데미지
→ 적 사망
```

으로 만들지 않는다.

기본 구조:

```text
Move
↓
Target
↓
Attack
↓
Skill
↓
Dodge / Defense
↓
Enemy Reaction
↓
Reward
```

전투에는 최소한:

- 기본 공격
- 강공격 또는 콤보
- 스킬
- 회피
- 피격 반응
- 쿨다운
- 자원
- 적 AI
- 거리
- 공격 범위
- 보스 패턴

을 고려한다.

---

# 12. 전투 재미의 핵심

전투는 숫자만 증가시키지 않는다.

적마다 차이를 만든다.

예:

```text
근접형
원거리형
돌진형
방어형
마법형
소환형
광역형
암살형
엘리트
보스
```

플레이어가:

**"이 적은 이렇게 상대해야 한다."**

라고 생각하게 만들어야 한다.

---

# 13. 보스 디자인

보스는 HP만 높은 몬스터로 만들지 않는다.

보스는:

- 단계 변화
- 공격 패턴
- 광역 공격
- 약점
- 회피 요구
- 소환
- 환경 활용
- 페이즈 변화
- 보상

을 갖도록 설계한다.

---

# 14. 성장 시스템

플레이어 성장:

```text
Level
↓
Stats
↓
Equipment
↓
Skill
↓
Build
```

단순 레벨업 외에:

- 장비
- 스킬
- 특성
- 옵션
- 빌드
- 세트 효과

등으로 성장 방향을 선택할 수 있도록 확장 가능하게 만든다.

---

# 15. 장비 시스템

기본:

- 무기
- 방어구
- 장신구

확장:

- 등급
- 레벨
- 옵션
- 강화
- 세트
- 특수 효과

단, 처음부터 전부 구현하지 않는다.

Vertical Slice에서는:

**무기 + 장비 + 기본 옵션**

까지만 구현한다.

---

# 16. 퀘스트 시스템

퀘스트 유형:

- 이동
- 대화
- 수집
- 사냥
- 탐험
- 던전
- 보스
- NPC 이벤트

데이터 기반으로 설계한다.

예:

```text
Quest
├── ID
├── Type
├── Conditions
├── Objectives
├── Rewards
├── Dialogue
└── NextQuest
```

---

# 17. 반복 플레이 루프

게임의 핵심 루프:

```text
탐험
↓
발견
↓
전투
↓
보상
↓
성장
↓
새로운 지역/콘텐츠
↓
더 강한 적
↓
더 좋은 보상
↓
다시 탐험
```

여기에:

```text
퀘스트
이벤트
수집
던전
보스
NPC
스토리
```

를 연결한다.

---

# 18. "계속 플레이할 이유" 설계

단순히 콘텐츠 양을 늘리지 않는다.

플레이어가 다음 중 하나를 항상 느끼게 한다.

- 다음 지역이 궁금하다.
- 다음 장비를 얻고 싶다.
- 레벨을 올리고 싶다.
- 새로운 스킬을 얻고 싶다.
- 보스를 잡고 싶다.
- 숨겨진 장소를 찾고 싶다.
- NPC 이야기를 보고 싶다.
- 새로운 동물을 발견하고 싶다.
- 새로운 던전에 가고 싶다.

---

# 19. 모바일 UX

세로/가로 모두 지원한다.

### Portrait

- 한 손 플레이
- 핵심 UI 집중
- 간단한 전투

### Landscape

- 넓은 시야
- 액션 전투
- 스킬 UI
- 월드 탐험

화면 방향이 변경되어도 게임 상태가 유지되어야 한다.

---

# 20. 모바일 조작

기본:

```text
Virtual Joystick
+
Attack
+
Skill Buttons
+
Dodge
+
Interact
```

상황에 따라 UI를 자동 변경한다.

예:

탐험:

```text
Joystick
Interact
Map
Menu
```

전투:

```text
Joystick
Attack
Skill
Dodge
Target
```

---

# 21. 카메라

3D 모바일 게임에 적합한 카메라를 구현한다.

필수:

- 줌
- 회전
- 거리 제한
- 지형 충돌
- 캐릭터 추적
- 전투 시 시야 보정
- 건물/오브젝트 가림 처리

---

# 22. 그래픽 품질

목표는 단순한 3D가 아니다.

**아트 스타일은 66-2장 결정에 따라 원신(Genshin Impact)류 카툰/셀셰이딩이다
— 사실적(포토리얼) PBR 재질이 목표가 아니다.** 아래 항목은 그 방향
안에서 고려한다(예: Lighting·Shadow는 밴드형 셀 음영, Material은 카툰
셰이더 위에서의 PBR 파라미터 사용).

- PBR Material(카툰 셰이더의 입력값으로— 66-2장)
- Lighting
- Shadow
- Ambient Lighting
- Fog
- Sky
- Environment
- Particle
- VFX
- Animation
- Post Processing

단, 모바일 성능을 우선하여 효과를 선택적으로 적용한다.

---

# 23. 애니메이션

캐릭터:

- Idle
- Walk
- Run
- Attack
- Hit
- Death
- Dodge
- Skill

몬스터도 최소한의 상태별 애니메이션을 갖는다.

AnimationTree/State Machine 구조를 고려한다.

---

# 24. NPC

NPC는 단순 장식물이 아니다.

NPC에:

- 이름
- 위치
- 대화
- 퀘스트
- 상점
- 이벤트
- 관계

를 연결할 수 있도록 한다.

---

# 25. 동물 시스템

FOREST를 중심으로 공통 시스템화한다.

동물:

- Idle
- Wander
- Flee
- Group
- Interaction

을 지원할 수 있도록 만든다.

동물은 월드에 생명감을 제공해야 한다.

---

# 26. 이벤트 시스템

월드 이벤트:

- 몬스터 출현
- 보물 발견
- NPC 이벤트
- 희귀 몬스터
- 지역 이벤트
- 시간 이벤트
- 랜덤 이벤트

등을 데이터 기반으로 확장한다.

---

# 27. 던전 시스템

던전은 별도의 공통 시스템으로 만든다.

```text
Dungeon
├── Entrance
├── Rooms
├── Enemies
├── Elite
├── Event
├── Treasure
├── Boss
└── Reward
```

초기에는 수동 제작된 던전부터 시작한다.

향후 랜덤 생성 구조로 확장할 수 있게 설계한다.

---

# 28. 세이브 시스템

저장:

- 플레이어 위치
- 레벨
- 경험치
- 장비
- 인벤토리
- 퀘스트
- 이벤트 상태
- 월드 상태

버전 필드를 포함한다.

향후 데이터 구조 변경에 대비하여 Save Version을 둔다.

---

# 29. 성능 최적화

모바일을 처음부터 고려한다.

필수 검토:

- LOD
- Occlusion Culling
- Visibility
- Object Pool
- Texture 최적화
- Mesh 최적화
- Draw Call 감소
- Batch
- Shadow 최적화
- Particle 제한
- AI 업데이트 주기
- 물리 처리 최적화

---

# 30. AI 최적화

모든 NPC/몬스터가 매 프레임 AI를 실행하지 않는다.

예:

```text
Near Player
→ High Frequency

Medium Distance
→ Reduced Frequency

Far Distance
→ Low Frequency / Sleep
```

월드 규모가 커져도 모바일에서 유지되도록 한다.

---

# 31. 공통 모듈 구조

권장 구조:

```text
saga_core/
├── combat/
├── character/
├── player/
├── enemy/
├── quest/
├── dialogue/
├── inventory/
├── equipment/
├── item/
├── skill/
├── save/
├── world/
├── event/
├── ui/
├── mobile/
├── data/
└── utilities/
```

게임별:

```text
games/
├── saga_go/
├── saga_dungeon/
├── saga_forest/
├── saga_story/
└── saga_realm/
```

공통 코드와 게임별 콘텐츠를 분리한다.

---

# 32. 개발 방식

Claude Code는 한 번에 대량 구현하지 않는다.

각 단계마다:

```text
1. 현재 상태 확인
2. 필요한 파일만 읽기
3. 최소 변경
4. 구현
5. 실행/검증
6. 오류 수정
7. 결과 기록
```

을 수행한다.

---

# 33. Claude Code 토큰 절약 규칙

매우 중요.

### 규칙 1

프로젝트 전체 파일을 매번 읽지 않는다.

### 규칙 2

변경 대상 파일만 읽는다.

### 규칙 3

이미 완료된 시스템을 다시 분석하지 않는다.

### 규칙 4

작업 전:

```text
현재 상태
변경 파일
목표
검증 방법
```

만 먼저 확인한다.

### 규칙 5

큰 파일을 불필요하게 전체 출력하지 않는다.

### 규칙 6

동일한 코드를 복사하지 않는다.

### 규칙 7

공통 시스템을 재사용한다.

### 규칙 8

한 단계가 끝나면 다음 단계로 넘어가기 전에 검증한다.

### 규칙 9

기존 구현을 무조건 재작성하지 않는다.

### 규칙 10

작업 로그를 남겨 다음 실행에서 불필요한 재분석을 방지한다.

**규칙 10 — 상태 파일은 덮어쓴다(2026-09-16 재정의, 원문은 `docs/HISTORY.md`)**: `docs/PROJECT_STATE.md` 는 **≤15KB 로 현재 상태만** 담고 세션이 끝나면 **덮어쓴다**(완료 요약 표·현재·다음·알려진 오류·테스트 상태·실기 확인 대기). 세션 기록·경위·판단 이유는 `docs/HISTORY.md` 에 날짜 항목으로 **append** 한다(항목당 15줄 이내, 커밋 해시만). `VERTICAL_SLICE_*.md` 는 설계 근거 문서라 별도지만 확정된 배경을 재서술하지 않는다. 상위 규칙은 `../SAGA-DESIGN.md` §9(문서 3층)·104장.

---

# 34. Claude Code 작업 상태 파일

다음 파일을 만든다.

```text
docs/
├── PROJECT_STATE.md
├── ARCHITECTURE.md
├── LEGACY_FEATURE_AUDIT.md
├── VERTICAL_SLICE.md
├── PERFORMANCE.md
├── ASSET_GUIDE.md
└── CHANGELOG.md
```

`PROJECT_STATE.md`에는 현재:

- 완료 단계
- 현재 작업
- 다음 작업
- 알려진 오류
- 테스트 상태

만 간단히 기록한다.

---

# 35. 1~100 최종 작업 단계

## Phase 1 — 프로젝트 기반

### 01
Godot 4.x 프로젝트 생성.

### 02
프로젝트 이름 및 기본 설정.

### 03
모바일 해상도/화면 설정.

### 04
Portrait/Landscape 지원 구조.

### 05
기본 폴더 구조 생성.

### 06
SAGA Core 구조 생성.

### 07
게임별 모듈 구조 생성.

### 08
Git/버전 관리 구조 확인.

### 09
PROJECT_STATE.md 작성.

### 10
ARCHITECTURE.md 작성.

---

# Phase 2 — Legacy 분석

### 11
기존 saga-go 분석.

### 12
기존 saga-dungeon 분석.

### 13
기존 saga-forest 분석.

### 14
기존 saga-story 분석.

### 15
기존 saga-realm 분석.

### 16
기존 1~80 작업지시서 확보/분석.

### 17
중복 기능 분류.

### 18
유지 기능 분류.

### 19
재설계 기능 분류.

### 20
삭제 기능 분류.

### 21
LEGACY_FEATURE_AUDIT.md 작성.

### 22
5개 게임의 공통 기능 추출.

### 23
게임별 고유 기능 추출.

### 24
신규 Architecture에 통합.

### 25
Legacy 분석 완료 검증.

---

# Phase 3 — Vertical Slice 설계

### 26
Vertical Slice 범위 확정.

### 27
첫 번째 테스트 지역 설계.

### 28
플레이어 목표 정의.

### 29
첫 번째 적 설계.

### 30
첫 번째 보스 설계.

### 31
첫 번째 퀘스트 설계.

### 32
첫 번째 던전 설계.

### 33
첫 번째 장비 설계.

### 34
첫 번째 스킬 설계.

### 35
첫 번째 보상 루프 설계.

---

# Phase 4 — 3D World Foundation

### 36
3D World 기본 Scene 생성.

### 37
Terrain 구현.

### 38
Lighting 구현.

### 39
Sky/Environment 구현.

### 40
Fog/Atmosphere 구현.

### 41
실제 GLB/GLTF 에셋 import 구조.

### 42
Material 구조.

### 43
Vegetation 배치.

### 44
Rock/Prop 배치.

### 45
Building 배치.

### 46
Landmark 배치.

### 47
Path/Road 구성.

### 48
Water 구성.

### 49
높낮이가 있는 지형 구성.

### 50
첫 번째 플레이 가능 지역 완성.

---

# Phase 5 — Player

### 51
Player 3D 모델 연결.

### 52
Idle/Walk/Run 구현.

### 53
3D 이동 구현.

### 54
중력/충돌 구현.

### 55
Camera Follow 구현.

### 56
Camera Rotation 구현.

### 57
Camera Zoom 구현.

### 58
모바일 Virtual Joystick 구현.

### 59
Portrait UI 구현.

### 60
Landscape UI 구현.

---

# Phase 6 — Combat

### 61
Combat Core 구현.

### 62
Basic Attack 구현.

### 63
Target 시스템.

### 64
Damage 시스템.

### 65
HP/Death 시스템.

### 66
Hit Reaction.

### 67
Enemy AI.

### 68
Enemy Attack.

### 69
Skill 시스템.

### 70
Cooldown/Resource 시스템.

### 71
Dodge 시스템.

### 72
첫 번째 엘리트 몬스터.

### 73
첫 번째 보스.

### 74
보스 패턴.

### 75
전투 재미 검증.

---

# Phase 7 — RPG Systems

### 76
Stats 시스템.

### 77
EXP 시스템.

### 78
Level Up.

### 79
Item 시스템.

### 80
Inventory.

### 81
Equipment.

### 82
Equipment Stats.

### 83
Reward 시스템.

### 84
Loot Table.

### 85
Skill Upgrade 기반.

---

# Phase 8 — World Gameplay

### 86
NPC 시스템.

### 87
Dialogue 시스템.

### 88
Quest 시스템.

### 89
Quest Objective.

### 90
Quest Reward.

### 91
World Event.

### 92
Resource/Collect 시스템.

### 93
Animal 시스템.

### 94
Hidden Area.

### 95
Dungeon Entrance.

---

# Phase 9 — Persistence / Quality

### 96
Save/Load.

### 97
Data Versioning.

### 98
Mobile Performance Pass.

### 99
Vertical Slice 전체 플레이 테스트.

### 100
최종 재미/품질 평가 후 다음 콘텐츠 확장 여부 결정.

---

# 36. Vertical Slice 완료 조건

100단계까지 무조건 기능을 추가하는 것이 목표가 아니다.

다음 조건을 만족하면 Vertical Slice 성공으로 판단한다.

플레이어가 게임을 실행한다.

↓

3D 월드에 들어간다.

↓

직접 이동한다.

↓

주변을 탐험한다.

↓

NPC를 발견한다.

↓

퀘스트를 받는다.

↓

몬스터를 만난다.

↓

실시간 전투를 한다.

↓

스킬을 사용한다.

↓

적을 처치한다.

↓

아이템을 획득한다.

↓

장비한다.

↓

성장한다.

↓

새로운 지역/던전에 들어간다.

↓

엘리트/보스와 싸운다.

↓

보상을 얻는다.

↓

저장한다.

↓

다시 플레이한다.

이 과정이 **재미있어야 한다.**

---

# 37. Vertical Slice 재미 평가

다음 질문에 YES가 되어야 한다.

### 탐험

- 이동하는 것 자체가 재미있는가?
- 주변에 볼거리가 있는가?
- 다음 장소가 궁금한가?

### 전투

- 공격이 손맛이 있는가?
- 적마다 대응 방법이 다른가?
- 스킬 사용이 재미있는가?
- 보스가 기억에 남는가?

### 성장

- 레벨업이 의미가 있는가?
- 장비 획득이 즐거운가?
- 캐릭터가 강해지는 느낌이 있는가?

### 월드

- 빈 공간이 지나치게 많지 않은가?
- 랜드마크가 있는가?
- NPC/동물/몬스터가 살아 움직이는가?

### 모바일

- 한 손으로 조작 가능한가?
- 버튼이 너무 작지 않은가?
- 화면이 복잡하지 않은가?
- 세로/가로 모두 자연스러운가?

### 반복 플레이

- "한 번 더 해볼까?"라는 느낌이 드는가?

---

# 38. Vertical Slice 실패 시 처리

재미가 부족하면 콘텐츠를 추가하지 않는다.

먼저 다음을 수정한다.

1. 이동감
2. 카메라
3. 전투 타격감
4. 적 AI
5. 스킬
6. 보상
7. 탐험 밀도
8. UI
9. 진행 속도

재미가 확인된 후 콘텐츠를 확장한다.

---

# 39. 이후 5개 게임 확장 전략

Vertical Slice의 공통 Core가 안정화되면 다음 순서로 확장한다.

```text
SAGA Core
      ↓
Vertical Slice
      ↓
SAGA GO
      ↓
SAGA DUNGEON
      ↓
SAGA FOREST
      ↓
SAGA STORY
      ↓
SAGA REALM
```

단, 공통 시스템을 먼저 완성하고 게임별 콘텐츠를 확장한다.

---

# 40. 게임별 차별화

공통 시스템을 공유하되 게임의 느낌은 확실히 다르게 만든다.

```text
GO
= 탐험

DUNGEON
= 전투/파밍

FOREST
= 자연/생활/탐험

STORY
= 스토리/NPC/사건

REALM
= 세계/세력/성장
```

각 게임이 단순히 맵과 몬스터만 다른 동일 게임이 되지 않도록 한다.

---

# 41. 최종 품질 목표

목표는:

**"기존 웹게임을 Godot으로 옮긴 게임"**

이 아니다.

목표:

**"기존 SAGA의 아이디어를 기반으로 새롭게 만든 모바일 3D RPG"**

이다.

그래픽:

기존 JS/Web 기반 그래픽보다 확실히 높은 품질.

월드:

작은 테스트맵 수준에서 끝내지 않고 확장 가능한 구조.

전투:

숫자만 교환하는 전투가 아니라 액션과 전략을 느낄 수 있도록 한다.

탐험:

이동 자체가 콘텐츠가 되도록 한다.

성장:

레벨만 올리는 것이 아니라 장비/스킬/빌드가 연결되도록 한다.

---

# 42. Claude Code 실행 방식

각 단계 실행 시 반드시 다음 순서로 진행한다.

```text
[STEP START]

1. PROJECT_STATE 확인
2. 현재 프로젝트 구조 확인
3. 해당 단계에 필요한 파일만 확인
4. 기존 구현과 충돌 여부 확인
5. 최소 변경으로 구현
6. Godot 실행/검증
7. 오류 수정
8. 완료 여부 확인
9. PROJECT_STATE 업데이트

[STEP END]
```

완료되지 않은 상태에서 다음 단계로 넘어가지 않는다.

---

# 43. 토큰 절약을 위한 추가 규칙

Claude Code는 다음을 반드시 지킨다.

```text
DO NOT:
- 프로젝트 전체 cat
- 전체 파일 반복 출력
- 동일 파일 반복 분석
- 이미 완료된 기능 재설명
- 필요 없는 리팩토링
- 관련 없는 파일 수정
- 한 단계에서 여러 Phase 동시 구현

DO:
- 필요한 파일만 읽기
- 필요한 코드만 수정
- 변경 범위 최소화
- 테스트 후 다음 단계 진행
- 상태 문서 활용
- 공통 시스템 재사용
```

---

# 44. 에셋 사용 원칙

에셋은 무작정 많이 넣지 않는다.

우선순위:

1. Player
2. 주요 Enemy
3. Boss
4. Environment
5. Building
6. Vegetation
7. Props
8. Animals
9. VFX

초기에는 핵심 에셋만 사용하고 이후 확장한다.

---

# 45. 모바일 성능 목표

최종적으로 모바일 환경에서 안정적으로 동작할 수 있도록 한다.

특히:

- 지나치게 많은 NPC 생성 금지
- 지나치게 많은 그림자 금지
- 과도한 Particle 금지
- 과도한 투명 재질 금지
- 고해상도 텍스처 남용 금지
- 모든 AI를 매 프레임 처리하지 않음
- 필요하지 않은 오브젝트는 비활성화

---

# 46. 디버그 시스템

개발 중 다음 정보를 확인할 수 있도록 한다.

```text
FPS
Draw Calls
Visible Objects
Enemy Count
NPC Count
Memory
Player Position
Current Quest
Player Level
Current Zone
```

릴리즈 빌드에서는 제거하거나 숨길 수 있도록 한다.

---

# 47. 오류 처리

각 단계 완료 후 최소:

- Godot 프로젝트 실행
- Scene 로드
- 주요 기능 실행
- Console 오류 확인

을 수행한다.

치명적인 오류가 있으면 다음 단계로 넘어가지 않는다.

---

# 48. 코드 품질

코드는:

- 명확한 이름
- 작은 책임
- 재사용 가능
- 데이터 기반
- 의존성 최소화

를 원칙으로 한다.

거대한 Manager 하나에 모든 기능을 넣지 않는다.

---

# 49. 시스템 의존성

권장 방향:

```text
Data
 ↓
System
 ↓
Component
 ↓
Scene
 ↓
UI
```

게임별 코드가 Core 내부를 직접 난립하게 참조하지 않도록 한다.

---

# 50. 최종적으로 만들어야 하는 것

최종 SAGA 구조:

```text
SAGA
│
├── SAGA CORE
│
├── GO
│
├── DUNGEON
│
├── FOREST
│
├── STORY
│
└── REALM
```

Core는 공유.

콘텐츠는 분리.

---

# 51. 확장 계획

Vertical Slice 이후:

**2026-09-23 재검토**: 다섯 판 전체를 완료 요약(PROJECT_STATE)과 대조 — GO·DUNGEON(장비→빌드 갈래 채우기까지)·FOREST·REALM은 101~105 재작업으로 이 여섯 축이 사실상 다 닿았다(REALM은 원래 계획보다 넘치게). 실제로 비어 있던 둘: **STORY "관계"**(웹판에 참고할 설계가 없었음)는 사제 유대(`mentor_bond`, story_save_state.gd)로 첫 걸음 완료. **DUNGEON "장비→빌드"의 무예 row1/row2 깊이**(다섯 갈래는 row0만)는 아직 열려 있다 — 일부는 새 메커니즘(다중발사·소환 강화 등)이 필요해 범위를 먼저 좁혀야 한다.

### GO

월드 확장

→ 탐험

→ 지역

→ 이벤트

→ 수집

→ 희귀 몬스터

### DUNGEON

던전 증가

→ 엘리트

→ 보스

→ 장비

→ 빌드

### FOREST

생태계

→ 동물

→ 채집

→ 마을

→ 생활

### STORY

스토리 챕터

→ NPC

→ 선택

→ 사건

→ 관계

### REALM

지역

→ 세력

→ 도시

→ 영지

→ 대규모 콘텐츠

---

# 52. 절대로 잊지 말아야 할 것

게임의 재미가 기능 수보다 중요하다.

예:

기능 100개 + 재미없음

보다

기능 10개 + 계속 플레이하고 싶음

이 훨씬 중요하다.

---

# 53. 첫 번째 목표

첫 번째 목표는 완성 게임이 아니다.

다음 하나를 완성한다.

> **"작지만 실제로 재미있는 3D SAGA 게임 플레이 루프"**

---

# 54. 첫 실행 시 Claude Code가 해야 할 일

새 프로젝트에서 바로 코딩하지 않는다.

먼저:

1. 기존 5개 게임의 관련 파일/문서 확인
2. 기존 1~80 작업지시서 확인
3. 좋은 기능 추출
4. 중복 제거
5. 낡은 기능 제거
6. 신규 Architecture 설계
7. Vertical Slice 범위 결정
8. 개발 순서 확인
9. 그 후 Phase 1부터 실행

---

# 55. 첫 번째 실행 명령

Claude Code는 첫 실행에서 전체 게임을 만들지 않는다.

다음만 수행한다.

```text
LEGACY AUDIT
+
ARCHITECTURE
+
VERTICAL SLICE PLAN
+
PROJECT FOUNDATION
```

그 후 사용자 확인 없이 가능한 범위 내에서 검증 가능한 최소 구현부터 진행한다.

---

# 56. 최종 개발 철학

이 프로젝트는

**"기존 게임을 변환하는 프로젝트"**

가 아니라

**"기존 SAGA의 좋은 아이디어를 이용해 새로운 게임을 만드는 프로젝트"**

다.

따라서 기존 코드보다:

- 재미
- 구조
- 그래픽
- 탐험
- 전투
- 성장
- 모바일 UX

를 우선한다.

---

# 57. 완료 기준

각 단계는 반드시 다음 중 하나로 기록한다.

```text
DONE
BLOCKED
NEEDS_REWORK
```

완료되지 않은 작업을 DONE으로 표시하지 않는다.

---

# 58. 최종 판단 기준

어떤 기능을 추가할 때 다음 질문을 한다.

```text
이 기능이 재미를 증가시키는가?
이 기능이 탐험을 증가시키는가?
이 기능이 전투를 증가시키는가?
이 기능이 성장의 의미를 증가시키는가?
이 기능이 월드를 더 살아있게 만드는가?
이 기능이 반복 플레이를 증가시키는가?
```

모두 NO라면 우선순위를 낮춘다.

---

# 59. 기능 추가 원칙

"있으면 좋을 것 같은 기능"보다

"플레이어가 실제로 사용하는 기능"

을 우선한다.

---

# 60. 콘텐츠 밀도

월드 크기보다:

```text
Landmark Density
NPC Density
Enemy Density
Event Density
Resource Density
Discovery Density
```

를 관리한다.

---

# 61. 플레이어 경험

첫 5분:

- 이동
- 탐험
- 전투

첫 15분:

- 퀘스트
- 장비
- 성장

첫 30분:

- 새로운 지역
- 엘리트
- 던전

첫 60분:

- 보스
- 빌드
- 새로운 목표

를 경험할 수 있도록 설계한다.

---

# 62. 게임 템포

초반부터 너무 많은 시스템을 보여주지 않는다.

순서:

```text
Move
↓
Explore
↓
Fight
↓
Reward
↓
Grow
↓
Discover
↓
Challenge
```

---

# 63. UI 원칙

UI는 화면을 가리지 않는다.

특히 모바일에서:

- 큰 버튼
- 명확한 아이콘
- 최소 텍스트
- 중요 정보 우선
- 전투 중 불필요한 UI 숨김

을 적용한다.

---

# 64. 로딩

월드 규모가 커질 것을 고려하여:

- Scene 분리
- Streaming 고려
- 필요 에셋만 로드
- 사용하지 않는 리소스 해제

가 가능한 구조로 설계한다.

---

# 65. 월드 확장

처음에는 작은 지역 하나만 만든다.

그 지역의 품질이 충분히 높아진 후:

```text
Region 1
→ Region 2
→ Region 3
→ Dungeon
→ Town
→ Forest
→ Mountain
→ Special Area
```

순으로 확장한다.

---

# 66. 그래픽 확장

초기:

- Player
- Enemy
- Environment

이후:

- NPC
- Animals
- Buildings
- Props
- VFX
- Boss

순으로 확장한다.

---

# 66-1. 렌더러 프로파일 — Forward+ / Mobile 이중 구성

## 결정 (2026-09-11)

**Godot을 유지한다. Unity·Unreal로 갈아타지 않는다.**

> **추가 기록 (2026-09-11, 같은 날 더 이어서)** — 이 결정은 여전히 유효하다.
> 다만 사용자가 이후 "유니티로 전환을 추가한다, 다른 곳(다른 세션)은 Godot
> 작업 중이니"로 요청해, **`saga-unity/`라는 별개 폴더에 Unity 6 병행
> 트랙을 새로 열었다**(그 폴더의 `PLAN.md` 0장 참고). 이건 이 결정을
> 뒤집는 게 아니다 — "Godot을 버리고 Unity로 간다"가 아니라 "Godot은
> 그대로 두고 Unity도 별도로 해본다"는 병행 실험이다. 이 트랙(`saga-godot/`)
> 작업은 계속 그대로 진행한다. `saga-unity/`를 이 폴더에 섞어 넣지 않는다
> (완전히 다른 프로젝트, 코드 공유 없음).

"언리얼 수준의 3D"라는 요구를 검토한 결론:

- 화면 품질 차이의 대부분은 엔진이 아니라 **에셋 품질**(모델·텍스처·애니메이션·라이팅 셋업)에서 난다.
  이 부분은 어느 엔진으로 가도 똑같이 만들어야 한다.
- 엔진이 실제로 차이를 내는 것은 Nanite·Lumen·Megascans 같은 **PC 전용 포토리얼 파이프라인**이다.
  이 프로젝트는 모바일을 목표로 하므로(45장) 그쪽으로 가도 그 기능을 꺼야 한다.
- 따라서 엔진 교체는 비용만 크고 이득이 없다. 대신 **PC에서는 Forward+ 렌더러를 켜서**
  Godot이 낼 수 있는 상한까지 올린다.

품질 목표는 **스타일라이즈드 고품질**이다. 포토리얼 야외 대규모 씬은 목표로
잡지 않는다. **"스타일라이즈드"의 구체적인 방향은 66-2장 참고** — 원신
(Genshin Impact)류 카툰/셀셰이딩이다. 이 절(66-1)은 렌더러 파이프라인
(Forward+/Mobile, SDFGI·SSR 같은 이펙트 on/off)만 다루고, 66-2는 그
위에서 실제로 어떻게 그려 보이는지(셰이딩 방식·아웃라인·색감)를 다룬다
— 서로 다른 층이라 둘 다 필요하다.

## 두 프로파일

| 프로파일 | 대상 | rendering_method | 켜는 것 |
|---|---|---|---|
| **PC** | Windows / macOS / Linux 빌드, 에디터 | `forward_plus` | SDFGI(또는 VoxelGI), SSR, SSAO, SSIL, Volumetric Fog, Glow, TAA/FSR2, 고품질 그림자 |
| **Mobile** | Android / iOS 빌드 | `mobile` | Glow, MSAA 2x, 저해상도 그림자, 나머지 전부 꺼짐 |

Web 내보내기는 `gl_compatibility`만 지원하므로 Web은 Mobile 프로파일에 준한다.

## project.godot 설정 방식

기본값을 Forward+로 두고, 플랫폼 feature tag로 덮어쓴다.

```text
[rendering]

renderer/rendering_method="forward_plus"
renderer/rendering_method.mobile="mobile"
renderer/rendering_method.web="gl_compatibility"
```

- 렌더러 선택은 **이 세 줄로만** 한다. 씬 파일 안에서 렌더러를 분기하지 않는다.
- 현재 `project.godot`은 `renderer/rendering_method="mobile"` 단일 구성이다.
  전환은 **Vertical Slice(81~100장) 이후**, 실기 확인 때 몰아서 한다. 지금은 바꾸지 않는다.

## Environment 분리

프로파일 차이는 **project.godot + WorldEnvironment 리소스 두 개**에만 존재한다.

```text
assets/environment/
├── env_pc.tres        # SDFGI · SSR · SSAO · SSIL · Volumetric Fog · Glow
└── env_mobile.tres    # Glow · Tonemap · 색보정만
```

- 시작 시 `OS.has_feature("mobile")` 또는 `OS.has_feature("web")`로 하나를 골라 WorldEnvironment에 붙인다.
- 톤매핑(ACES 또는 Filmic)·노출·색보정 값은 **두 리소스에서 같게** 유지한다. 프로파일이 달라도
  게임의 색 톤은 같아야 한다.
- 메시·머티리얼·텍스처·애니메이션은 **한 벌**이다. 프로파일별로 에셋을 따로 두지 않는다.
  LOD·텍스처 해상도 차이는 Godot import 설정과 `rendering/textures` 프로젝트 설정으로만 조절한다.

## 하지 말 것

- 프로파일을 셋 이상으로 늘리기
- Mobile 프로파일에서 SDFGI·SSR·SSIL·Volumetric Fog를 켜 보는 것 (45장 위반)
- "언리얼만큼"을 이유로 엔진 교체를 다시 제안하기 — 위 결정으로 종결
- Nanite·Lumen에 대응하는 기능이 없다는 이유로 Forward+ 채택을 미루기 —
  이 프로젝트의 품질은 에셋과 라이팅 셋업에서 나온다(8장·44장)

## 검증

- 46장 디버그 화면에 **현재 rendering_method**를 표시한다.
- PC 프로파일 FPS·Draw Call은 에디터에서, Mobile 프로파일은 71장 테스트 기기에서 확인한다.
- 실기 확인은 매 단계마다 하지 않고 **마지막에 몰아서** 한다.

---

# 66-2. 아트 디렉션 — 카툰/셀셰이딩(원신류) 렌더링

## 결정 (2026-09-13, 뒤늦게 문서화)

**목표 그래픽은 원신(Genshin Impact)류 카툰/셀셰이딩이다.** 이 방향은
전에 구두로 정해졌던 것인데 이 문서엔 66-1장의 "스타일라이즈드 고품질,
포토리얼 아님"이라는 모호한 표현으로만 남아 있었다 — 실제로 무엇을
뜻하는지가 코드로 옮길 만큼 구체적이지 않았다. 이 장이 그 구멍을 메운다.
**지금(2026-09-13)까지 셀셰이딩·아웃라인 셰이더는 코드에 하나도 없다**
(`saga_core/shaders/`엔 구면 세계용 `curved_textured`·`curved_vertex_color`
둘뿐, 전부 표준 PBR/버텍스컬러 라이팅) — 이 장은 **방향 결정**이고,
실제 셰이더 작성·전체 머티리얼 교체는 별도 작업 단계로 이후에 한다
(지금 이 세션에서 코드를 바로 다 바꾸지 않는다 — 32장 "한 번에 한 걸음"
원칙, 아래 "적용 순서" 참고).

## 무엇을 뜻하는가 (구체적 스펙)

- **캐릭터/몬스터/NPC**: 표준 PBR Lit이 아니라 **밴드형(quantized) 셀
  셰이딩** — diffuse를 2~3단 계단으로 끊어 칠한다(원신처럼 부드러운
  그라디언트가 아니라 뚜렷한 명암 경계). Rim light(가장자리 발광) 추가.
- **아웃라인**: 캐릭터·몬스터·주요 NPC·주요 오브젝트에 검은/짙은 윤곽선
  (inverted-hull 또는 노멀 기반 프레넬 방식 중 Godot 4.x·모바일 성능에
  맞는 쪽을 구현 단계에서 고른다). **모든 오브젝트에 걸지 않는다** —
  풀·자갈·배경 소품처럼 수가 많은 것까지 아웃라인을 걸면 모바일에서
  드로우콜/버텍스 비용이 커진다(45장 위반). 아웃라인은 "시선이 가는 것"
  (플레이어·적·NPC·중요 채집물)으로 한정한다.
- **환경(지형/식생/건물)**: 캐릭터만큼 뚜렷한 밴드 셰이딩은 아니어도
  **채도 높고 painterly한 톤**(원신 필드 느낌) — 사실적 거칠기/금속성
  PBR 재질(녹슨 철, 젖은 돌 같은 사실적 서브서피스)은 목표가 아니다.
  하늘/구름도 사실적 대기산란보다 **손그림에 가까운 그라디언트+구름
  텍스처**를 우선한다.
- **물**: 완전한 SSR 반사보다 **단순화된 색+하이라이트+가장자리 거품**
  스타일(원신 물 표현과 같은 결) — PC 프로파일(66-1)이라도 물만은
  포토리얼 반사를 목표로 깊이 파지 않는다.
- **그림자**: 66-1의 SDFGI/고품질 그림자는 그대로 켜되(입체감 자체는
  필요), 캐릭터 셀 셰이딩과 **부드러운 사실적 그림자가 충돌해 보이지
  않는지**는 실기 확인 때 같이 본다(원신도 그림자 자체는 부드럽게 깔고
  캐릭터 셰이딩만 밴드로 끊는 방식이라 이 조합 자체는 이미 검증된 패턴).

## 66-1과의 관계

66-1(렌더러 프로파일)은 **파이프라인**(Forward+/Mobile, 어떤 이펙트를
켜고 끄는지) 층이고, 이 장(66-2)은 그 위에서 **셰이딩 방식**(카툰이냐
포토리얼이냐) 층이다. 서로 독립적 — PC/Mobile 두 프로파일 다 카툰
셰이딩을 쓴다(카툰 셰이딩 자체가 이미 저비용이라 모바일에 오히려 유리).

## 왜 지금까지 에셋을 그대로 못 쓰는가

- Kenney `Blocky Characters` 류는 이름 그대로 각진 블록 형태고, 텍스처도
  단순 색 아틀라스(`colormap.png`)라 위 셀셰이딩 셰이더를 입혀도
  애니메이션풍 얼굴·비율(둥근 눈, 부드러운 옷 실루엣)이 나오지 않는다.
- 원신풍 그래픽은 **모델 자체**(애니메이션 비율 조형)와 **셰이더**(램프
  기반 명암 2~3단 + 외곽선) 둘이 같이 있어야 나온다 — 셰이더만 바꿔서는
  안 된다. 지금까지 쓰던 **Kenney CC0 로우폴리 킷(`docs/ASSET_GUIDE.md`)
  은 이 방향과 맞지 않아 순차 교체 대상**이다.

## 새 에셋 소스

- **캐릭터** — [VRoid Studio](https://vroid.com/en/studio)(pixiv, 무료).
  애니메이션풍 3D 아바타를 에디터로 직접 만들어 VRM(glTF 2.0 기반)으로
  내보낸다. 상업적 사용(게임 포함) 허용 — 단 "VRoid 모델을 자동
  생성·변형해 내보내는 앱"을 만드는 것 자체는 별도 라이선스가 필요하다는
  제약이 있는데, 우리는 그런 앱이 아니라 완성된 캐릭터를 에디터로 직접
  만들어 쓰는 것뿐이라 해당 없음. VRM은 GLB/GLTF 계열이라 8장 지원
  포맷과 그대로 맞는다.
- **환경/소품** — Kenney 대신 **Quaternius**(CC0, `Ghibli Game Kit`·
  `Stylized Nature MegaKit` 계열)나 **KayKit**(CC0, itch.io) 쪽이 더
  둥글고 부드러운 형태라 셀셰이딩과 잘 맞는다. 실제로 받을 때 이 두
  소스부터 확인한다 — 목적은 "Kenney 전면 폐기"가 아니라 "형태가
  셀셰이딩에 맞는지"다. 형태가 맞으면 계속 쓸 수 있다.
- **절대 쓰지 않는 것** — 원신(미호요)의 실제 게임 리소스·데이터마이닝된
  에셋이나 셰이더 코드를 그대로 가져오는 것. 루트 CLAUDE.md의 "원작사의
  실제 에셋 가져다 넣기 금지" 원칙이 원신에도 그대로 적용된다 — **오마주
  (스타일 참고)는 되지만 복제는 안 된다.** 셰이더는 아래처럼 오픈소스
  교육용 구현체를 참고해 직접 짠다.

## 셰이더 — 엔진마다 직접 구현

- **Godot 4**: 커스텀 셀셰이딩 프래그먼트 셰이더(램프 기반 명암 2~3단,
  위 "무엇을 뜻하는가" 스펙대로) + 외곽선(inverted-hull 또는 노멀 기반
  프레넬 방식 — 노멀 방향으로 살짝 부풀린 메시의 backface만 검게 렌더,
  Godot 4.x·모바일 성능에 맞는 쪽을 구현 단계에서 고른다). 참고 구현:
  godotshaders.com "Complete Cel Shader for Godot 4", Binbun "Godot
  Ultimate Toon Shader".
- Unity 트랙(`saga-unity`)과 **셰이더 코드를 공유하지 않는다** — 엔진마다
  셰이더 언어·파이프라인이 달라 saga-unity PLAN.md 66-2장에 별도로
  구현한다(루트 CLAUDE.md: 두 트랙은 코드 공유 없음, 기획만 같이 봄).

## 적용 순서 (지금 당장 할 일이 아니다 — 다음에 이어갈 세션이 볼 것)

1. 캐릭터 하나(Player, 아래 "진행" 절의 VRoid 임시 자산으로 시험 가능)에
   카툰 셰이더 시험 적용 → GUI로 실제로 원신 느낌이 나는지 확인(코드만으로
   판단 못 한다, 루트 CLAUDE.md 실기 확인 방침대로 이 결정 자체가 시각
   판단이라 예외적으로 초기에 한 번 봐야 한다) → 톤 확정.
2. 확정되면 Enemy/NPC/Boss까지 같은 셰이더 확장, 44장 우선순위(Player →
   주요 Enemy → Boss → Environment → Building → …)를 그대로 따른다.
3. 아웃라인은 성능 영향이 커서 마지막에 별도로 검토(모바일 실기기
   프레임 확인 필수, 71장 테스트 기기).
4. 환경(지형/식생/건물) 머티리얼 톤 보정은 8장·66장 "그래픽 확장" 순서를
   그대로 따라 뒤로 미룬다.

## 마이그레이션 — 기존 통합 Kenney 에셋을 어떻게 할까

`docs/ASSET_GUIDE.md`에 기록된 Kenney 통합(캐릭터 4종·마을집 모듈·던전
방/복도/문·논밭·사당)은 검증까지 끝난 실제 동작 코드다. 위 "적용 순서"와
같은 순서로, 옮기기 전 기존 Kenney 자산을 지우지 않는다 — 교체가
실패하면 되돌릴 수 있어야 한다.

## 하지 말 것

- 캐릭터를 사실적 PBR(금속성·거칠기 사실적 값)로 만들었다가 "나중에
  카툰으로 바꾸자"고 미루기 — 셰이딩 방식은 머티리얼 워크플로 자체가
  달라 나중에 통째로 다시 만드는 비용이 크다. 처음부터 카툰으로 간다.
- 모든 오브젝트에 아웃라인을 걸어 보고 나서 성능을 걱정하기 — 처음부터
  "시선이 가는 것만" 범위를 정해 시작한다.
- 이 결정을 이유로 66-1(렌더러 프로파일)이나 45장(모바일 성능 목표)을
  다시 논의하기 — 그래픽 방향은 확정, 파이프라인 결정과 독립이다.
- Kenney 자산을 한 번에 전부 지우고 시작하기(마이그레이션 중 게임이
  통째로 깨진다)
- 원신 데이터마이닝 리소스·셰이더를 그대로 가져다 쓰기(저작권 문제)
- Godot·Unity 트랙끼리 셰이더 코드를 공유하려 시도하기

## saga-unity와의 관계

**더 이상 같은 방향이 아니다(2026-09-13, 같은 날 두 번 바뀜).** 처음
이 장을 쓸 때는 "saga-unity는 별개 반영 안 됨, 범위 밖"이었고, 그 뒤
같은 날 잠깐 "saga-unity도 같은 원신풍 셀셰이딩"으로 맞췄다가(VRoid
샘플 미러링·gltFast 임포트 검증까지 함께 함) — **사용자가 다시 "saga-
unity는 원신 스타일이 아니라 사실적인 걸로, 엔진마다 다른 점이 필요해"
로 지시해 최종적으로 갈라섰다.** 지금은 `saga-godot`(이 장, 카툰/
셀셰이딩)과 `saga-unity`(그쪽 PLAN.md 66-2장, 사실적 PBR)가 **서로
다른 그래픽 목표**를 갖는다 — 더 이상 개념까지 공유하지 않는다. 다만
VRoid 샘플 gltFast 임포트가 됐다는 기술 검증 자체는 saga-unity 쪽에
그대로 남아 있다(그래픽 스타일과 무관한 엔진 사실). 자세한 내용은
saga-unity `docs/ASSET_GUIDE.md`·`docs/PROJECT_STATE.md`의 "정정" 항목
참고 — 여기서 반복하지 않는다(4장 원칙).

## 현재 적용 상태 (2026-09-16 요약 — 경위·검증 로그는 `docs/HISTORY.md` "66-2장 진행 기록")

- **파이프라인**: VRoid Studio 설치·샘플 VRM 내보내기(라이선스 전체 허용으로 저장)·`.glb` 사본 Godot 헤드리스 임포트 검증 완료. 프리셋 내보내기까지는 PowerShell 좌표 클릭으로 자동화 가능, 실제 조형은 사람 몫. `assets/characters_vroid/AvatarSample_A.{vrm,glb}` 는 **파이프라인 검증용 임시 자산**이다(최종 캐릭터 아님).
- **셀셰이더**: `saga_core/shaders/cel_toon.gdshader`(band_count 3·band_softness 0.08·rim_strength 0.3·rim_power 4.5, 아웃라인 없음) + 공용 헬퍼 `cel_shader_apply.gd`(`BaseMaterial3D` 에 `albedo_texture` 가 있는 서피스만 덮음). 적용: GO/DUNGEON/FOREST 공용 `player.gd`, `story_player.gd`, GO `npc_builder.gd`. **미적용**: FOREST 주민(`WorldCurveMaterial` 사용 — 곡률+카툰 병합은 별도 작업), Enemy/Boss(전부 단색 캡슐 placeholder, GLB 생기면 한 줄 추가).
- **톤**: 미확정. 흰 알베도 + rim + `env_pc.tres` glow 가 겹쳐 하얗게 날아가는 문제가 남아 있다. 사람이 GUI 로 최종 승인해야 확정 — 그 전까지 위 적용은 "잠정". 아웃라인은 톤 확정 뒤에만 시작한다(102장 스펙).
- **에셋 후보 판정**: KayKit Medieval Hexagon — **불채택**(Kenney 와 같은 각진 저폴리, 교체 실익 없음, 후보 폴더는 Q-c 로 이미 삭제됨). Quaternius Stylized Nature MegaKit — **나무·덤불 22종 확보 완료**(2026-09-20, `assets/vegetation/`, ASSET_GUIDE 해당 날짜), 씬 배치는 아직. 결론: **자연물(Vegetation)을 건물보다 먼저 교체**하는 쪽이 비용 대비 효과가 크다, 건물은 셰이더+painterly 톤 보정으로 간다.
- **사람 손이 필요한 것**: 실제 캐릭터 조형(VRoid), Mixamo 애니 다운로드, 톤 최종 승인.

## 검증

- 이 장 자체(스펙·에셋 소스·라이선스 결정)는 문서 결정이라 헤드리스로
  검증할 게 없다(project.godot·씬·스크립트 변경 없음) — 단, "진행" 절의
  실제 VRoid 임포트는 헤드리스로 검증했다(위 기록).
- 실제 셰이더를 적용하는 다음 단계부터 46장 디버그 화면에 "카툰 셰이더
  적용 여부"를 표시하고, 위 "적용 순서" 1번에서 사람이 직접 화면을
  봐야 한다(이 결정만은 예외적으로 코드 완성 전에 한 번 실기 확인).

---

# 67. 사운드

초기부터 구조만 만들어 둔다.

지원:

- BGM
- SFX
- Attack
- Hit
- Skill
- UI
- Environment

콘텐츠가 늘어도 교체하기 쉽게 만든다.

---

# 68. Localization

텍스트를 코드에 직접 박지 않는다.

향후:

- 한국어
- 영어
- 일본어

등으로 확장 가능한 구조를 사용한다.

---

# 69. 접근성

가능하면:

- UI 크기
- 진동 On/Off
- 효과음 On/Off
- BGM On/Off
- 그래픽 품질

을 설정 가능하게 한다.

---

# 70. 품질 검증

각 Phase마다:

```text
Functional Test
Visual Test
Mobile Test
Performance Test
```

를 실시한다.

---

# 71. 테스트 기기

최소:

- 저사양 모바일
- 중급 모바일
- 고성능 모바일

을 고려한다.

---

# 72. 최적화 시점

최적화를 마지막에 한 번만 하지 않는다.

Vertical Slice부터 지속적으로 측정한다.

---

# 73. 메모리 관리

특히 모바일에서:

- Texture
- Mesh
- Animation
- Audio
- Particle

사용량을 관리한다.

---

# 74. 씬 관리

하나의 거대한 Scene에 모든 것을 넣지 않는다.

예:

```text
World
├── Terrain
├── Environment
├── NPC
├── Animals
├── Enemies
├── Events
└── POI
```

필요에 따라 분리한다.

---

# 75. Prefab 개념

Godot Scene을 재사용 가능한 단위로 만든다.

예:

```text
EnemyBase.tscn
NPCBase.tscn
Tree.tscn
Rock.tscn
Building.tscn
Chest.tscn
Portal.tscn
```

---

# 76. 재사용성

새 몬스터를 추가할 때:

기존 Combat/AI 시스템을 복사하지 않는다.

Data만 추가하여 새로운 몬스터를 만들 수 있는 방향을 우선한다.

---

# 77. 밸런스

수치는 코드에 흩어지지 않는다.

가능한 한:

```text
data/balance/
```

에서 관리한다.

---

# 78. 개발 로그

중요 변경 사항은:

```text
CHANGELOG.md
```

에 짧게 기록한다.

긴 설명을 남겨 Claude Code가 다음 실행마다 불필요하게 읽지 않도록 한다.

---

# 79. 작업 단위

하나의 Step은 가능하면:

**하나의 명확한 결과물**

을 갖는다.

예:

```text
STEP 61
Combat Core 생성
→ CombatManager
→ Damage 처리
→ 테스트
→ DONE
```

---

# 80. 실패 방지

어떤 단계가 실패하면:

```text
중단
→ 원인 파악
→ 최소 수정
→ 재검증
→ 완료
```

한다.

실패한 상태에서 기능을 계속 쌓지 않는다.

---

# 81~90. Vertical Slice 확장 검증

### 81
플레이어 이동 감각 검증.

### 82
카메라 감각 검증.

### 83
월드 시각적 품질 검증.

### 84
전투 타격감 검증.

### 85
적 AI 재미 검증.

### 86
스킬 재미 검증.

### 87
보상 재미 검증.

### 88
성장 체감 검증.

### 89
탐험 동기 검증.

### 90
30분 플레이 테스트.

---

# 91~100. 최종 Vertical Slice Gate

### 91
모바일 Portrait 테스트.

### 92
모바일 Landscape 테스트.

### 93
저사양 성능 테스트.

### 94
메모리 테스트.

### 95
세이브/로드 테스트.

### 96
버그 수정.

### 97
불필요한 기능 제거.

### 98
그래픽 품질 최종 개선.

### 99
게임 루프 최종 검증.

### 100
**Vertical Slice 승인/재설계 결정.**

100단계에서 무조건 다음 콘텐츠로 넘어가지 않는다.

게임이 재미없다면 Phase를 되돌려 개선한다.

---

# 101. 재미 진단·게임성 이식 (2026-09-16 신설 — `../SAGA-DESIGN.md` §3·§5 를 이 트랙에 적용)

## 101-1. 표준 8 현재 상태 (근거 = 씬/스크립트)

| # | 표준 | 상태 | 근거 |
|---|---|---|---|
| A | 목표판 3줄 | △ | GO `quest_label.gd`(사명 1줄)·`codex_label.gd`(발견 N/총), STORY `quest_label.gd`+사명 20+반복/일일 6, FOREST 주민 부탁·하루 1회 채집 리셋. **"지금·이번 세션·이번 주" 3줄을 늘 보여 주는 판은 없다.** DUNGEON·REALM 은 목표 표시가 없다 |
| B | 세션 마무리 카드 | × | 없음. DUNGEON 결사 사망 화면은 정지만 하고 요약이 없다. REALM 월말은 수치 갱신뿐 |
| C | 손맛 5요소 | △ | STORY `story_combat.gd` `trigger_hitstop()` 만 있다. GO `bandit_encounter.gd` 는 화면 플래시(0.35s)만. 흔들림·숫자 팝·타격음 라운드로빈은 어느 판에도 없다(67장 사운드는 구조만) |
| D | 선택 3택 | △ | GO 설득 무/지/덕 3라운드, DUNGEON `dungeon_boons.gd` 은사(고정 셋 → 직접 고르기), DUNGEON 무예 9모양×6갈래×3단은 "전부 찍는" 트리. **축 중복 금지·거절 보상 규칙 없음** |
| E | 발견 밀도 | △ | GO 도감 TOTAL place 10·event 18·beast 6·record 3·pet 11 이 지역 3(11×11+9×9+7×7 = 251칸)에 흩어져 있다 — 60m 격자 빈칸 10% 규칙엔 못 미친다(포구·폐허 "빈 칸 많음", HISTORY 09-16). FOREST 는 구면 시야가 좁아 밀도 체감이 다르다 |
| F | 실패·회복 | × | 죽음 비용·회수·"죽어도 남는 것" 설계가 없다. DUNGEON 결사(하드코어)는 극단값만 있고 기본 난도의 실패 루프가 없다. STORY 플레이어 HP 는 있으나 사망 처리가 얕다 |
| G | 성장 가시화 | × | 장비 등급·접사·부위 6(DUNGEON)·10부위 tier1~4(STORY)가 전부 **라벨**로만 드러난다. 캐릭터는 단색 캡슐/Kenney character-a~d 라 외형 변화가 없다 |
| H | 돌아올 이유 | △ | STORY 반복/일일 사명 6, FOREST 실시간 하루·계절행사 8일·순무 시세, GO TimeOfDay 밤 사건 2. 주간·월간 축은 없다 |

**가장 큰 구멍 3**: ① 세션 구조 부재(A·B) ② 실패 루프 부재(F) ③ 성장이 보이지 않음(G — 그래픽 102장과 같은 뿌리).

## 101-2. 웹 PLAN §5 후보 표 — 3D 이식 대상

웹 다섯 판의 새 PLAN §5(각 8 후보) 가 출처다. 3D 는 **새로 설계하지 않는다** — 웹에서 검증된 것부터 옮기고, 엔진 장점으로 C·G 를 웹보다 한 단 올린다. "웹 검증" 열은 웹 PLAN §8 Phase 진행에 따라 갱신한다(지금은 전부 미검증).

| 판 | 웹 §5 후보(우선순위 순) | 채우는 표준 | 3D 이식 순서 |
|---|---|---|---|
| GO | 봉수대(탑→지도 해제) · 사당 시련 3분 방 · 75초 토벌(부위 3·저스트 회피) · 일과판+마무리 카드 · 비석 순례(GPS) · 인연 · 승급 3택 · 패배 비용 15% | A E C B H D F | ① 일과판+카드 ② 승급 3택 ③ 패배 비용 ④ 사당 시련(`hero_encounter` 골격 재사용) ⑤ 봉수대(REGIONS 지도 해제) ⑥ 75초 토벌. **비석 순례(GPS)는 3D 트랙 제외**(폰 GPS 는 웹 판 몫) |
| DUNGEON | 축복 3택(은사 재해석) · 유품(죽음 비용·회수) · 부적 던전(티어·변형자) · 월드 보스 시간표 · 난입(15분 파도) · 목표판·세션 카드 · 시대 퓨전 · 손맛 2차 | D F G H C A | ① 축복 3택(`dungeon_boons.gd` 확장) ② 유품(`dungeon_hardcore_state` 옆에 기본 난도 사망 루프) ③ 손맛 2차 ④ 부적 던전(방 6 구조 위 변형자) ⑤ 난입 ⑥ 월드 보스. 시대 퓨전은 웹 검증 뒤 |
| FOREST | 일과판 · 마무리 카드 · 마을 번들 · 관계 하트 · 발견 밀도 격자+숲의 정령 60 · 축제 · 택배 사슬 · 채집 손맛+마을 평가 | A B G H E C | ① 일과판+카드(공용) ② 관계 하트(`villager_builder` 주민 5+부탁 위) ③ 마을 번들(`museum.gd`·`forest_home` 연동) ④ 발견 격자(구면 시야 반경 기준으로 재계산) ⑤ 축제(`forest_festival.gd` 8일 위) ⑥ 택배(3D 는 마을 하나라 **보류**) |
| STORY | 직업 정체성(갈래별 고유 조작) · 무예 96 유파 재해석 · 비경(경로 선택 미니던전+축복 3택) · 관문 대장(주간 보스) · 이동 손맛 · 목표판+카드 · 손맛 표준 · 동료 교대 | D G E H C A | ① 손맛 표준(hitstop 있음 → 5요소) ② 이동 손맛(대시·코요테·버퍼 — `story_player.gd`) ③ 직업 정체성(전직 4단 위 고유 조작 1) ④ 관문 대장(`story_boss_spawner` 주간 플래그) ⑤ 비경 ⑥ 유파 재해석(3D 무예 트리는 tier1~4 완주 상태라 **웹 결과 보고 결정**) |
| REALM | 인물 특성·야망 · 관계·이벤트 체인 · 일기토 3택·설전 · 시작 시나리오 3+이정표 · 승리 조건 4+결과 카드 · 지형·진형 전술 · 월간 요약 카드+목표판 · 군주 사망·계승 | D A G F | ① 월간 요약 카드+목표판(월말 처리에 얹음) ② 승리 조건 4(멸망 판정 위) ③ 인물 특성·야망(`realm_officer_pool` 필드 추가) ④ 일기토 3택·설전(문답 260 재사용) ⑤ 이벤트 체인 ⑥ 계승. 시작 시나리오는 이미 3 |

**GO ⑥ 75초 토벌 — 부위 파괴, 결정 뒤집힘(2026-09-21)**: 2026-09-20 "Target 버튼으로 갑주→병장→기마 순환 선택" 결정은 웹판 실제 구현(`saga-web/saga-go/PLAN.md` §5-③ "구현(2026-09-17)")과 다른 걸 새로 설계한 것이었다 — 웹은 조준 UI 없이 같은 기세 풀을 25%/50%/75% 누적 문턱으로 읽어 파괴마다 스태거를 강제한다. "새로 설계하지 않는다" 원칙대로 새 UI 대신 이 방식을 그대로 옮겨 **구현 완료**(`duel_rules.gd::_check_stagger()`, `is_raid` 플래그로 "도적 두목"만 켠다). 웹의 재료 보상("단사")은 3D GO 경제에 없어 경험치(`stagger_exp_reward`)로 대체.

## 101-3. 3D 가 웹보다 올려야 하는 것 — C·G 구체안

- **C 손맛(다섯 판 공용 `saga_core/combat_feel.gd` 신설)**: `hit(target, amount, crit)` 한 호출이 5요소를 발생시킨다 — ① hitstop `Engine.time_scale` 0.05 로 70ms(치명 120ms, STORY `trigger_hitstop` 을 여기로 승격) ② 카메라 `SpringArm3D` 부모에 4px 상당(거리 8m 기준 0.06m) 노이즈 120ms ③ 피격 메시 `albedo_tint` 흰색 80ms(셀셰이더 uniform) ④ 숫자 팝 `Label3D` 0.6s 위로 0.8m·크리티컬 1.4배 ⑤ 타격음 3종 라운드로빈(`AudioStreamPlayer3D`, 67장 구조 채우기). 진단: 임시 씬에서 `hit()` 1회 → 5요소 신호 5개.
- **C 애니 블렌딩**: `AnimationTree` 1D 블렌드(idle 0 · walk 2.5 · run 5.5 m/s), 공격 OneShot fade 0.05/0.1, 피격 OneShot 0.2. 현재 Kenney character 는 애니 없음 → 103장 Mixamo 리타겟 뒤에 켠다.
- **G 성장 가시화**: 등급별 **보이는 것 1개** — 무기 메시 스왑(tier1~4 GLB 4종, 103장 kitbash 로 생성) · 등급 색 외곽선(102장 아웃라인 색을 등급 팔레트로) · 이펙트(전설 = 잔광 파티클 1). 인물 등용 시 부대 뒤를 따르는 동행 실루엣(GO·DUNGEON). 진단: 등급 1→4 스냅샷 4장 비교.
- **E 발견 밀도**: `saga_core/world/density_report.gd`(순수 격자 계산, GO·FOREST 공용 — 104-5 에서 codex_state.gd 소속으로 뒀던 걸 FOREST 도 그대로 쓰게 여기로 옮겼다) — 60m(GO 격자 48m 기준 1.25칸) 반경 빈 격자 비율을 헤드리스로 출력. 10% 넘으면 그 지역에 콘텐츠를 더 넣는다(웹 §3-E 진단과 같은 수치).

## 101-4. 이식 공통 순서

1. `saga_core/ui/goal_board.gd`(목표판 3줄) + `session_card.gd`(마무리 카드) — 다섯 판 HUD 에 같은 노드. 데이터는 판별 `*_state.gd` 가 `GoalBoard.set_goals(now, session, week)` 로 넣는다.
2. `saga_core/combat_feel.gd`(101-3) — 전투 있는 판(GO·DUNGEON·STORY)만 `hit()`. **FOREST는 전투가 없어(4절 "전투·포획·HP는 안 만든다")** `pickup()`(2026-09-18 신설, 숫자 팝+타격음만)을 채집·낚시 성공에 붙인다. **REALM은 대상 자체가 없다** — 일기토·공성 전부 ChoicePrompt/토스트 턴제 판정이라 카메라 rig·MeshInstance3D 타겟이 씬에 없다(105-Q3 "실시간 타이밍 입력은 안 넣는다"와 같은 결) — 연결 대상 없음으로 완료 처리.
3. 판별 ① 후보부터 표 순서대로. 한 세션에 후보 하나. 각 후보 끝에 헤드리스 3회 md5 + HISTORY 항목.
4. 웹 §5 가 "검증 실패" 로 판정한 후보는 3D 에서 뺀다(SAGA-DESIGN §2-1).

---

# 102. 그래픽 개편 (2026-09-16 신설 — `../SAGA-DESIGN.md` §6.0·§6.2·§6.4 를 실제 파일에 맞춤)

66-1(렌더러 프로파일)·66-2(카툰 방향)는 그대로다. 이 장은 그 둘을 **수치와 파일**로 내린다.

## 102-1. 아트 바이블 적용(§6.0)

| 항목 | 이 트랙 값 |
|---|---|
| 스타일 | 스타일라이즈드 저폴리 + 3단 셀 램프(`cel_toon.gdshader` band_count 3) + 외곽선(시선 가는 것만, 66-2 규칙) |
| 팔레트 | 판·바이옴별 24색 JSON `assets/generated/palettes/<name>.json`(103장). 임포트 시 정점색/텍스처 스냅 |
| 스케일 | 사람 1.7m·문 2.2m·층 3m. **105 Q-h 결정(c, 2026-09-19)**으로 GO·DUNGEON·FOREST 플레이어/NPC/영웅·도적 조우를 옛 3.4m(임의 배율 1.25×·2.182× 등)에서 정확히 절반(0.625×·1.091× 등)으로 낮춰 실제 적용했다 — 캡슐(0.45r/1.7h)·GO 카메라(거리 8·줌 6~11·FOV 50)도 같이 맞춤. `fit_height()`는 새 VRoid/캐릭터를 더 들일 때 계속 쓴다. DUNGEON 방(12×12m 등, GLB 실측)·FOREST 마을(TILE_SIZE 3m)·GO 지역/타일(48m)·상호작용 반경(TALK_RADIUS 등)·초목 스케일은 애초에 캐릭터 키가 아니라 GLB 실측이나 판 자체 페이싱에 매인 값이라 **안 건드렸다** — 이번 결정 범위 밖(2026-09-19 조사로 확인, 아래 실기 확인 대기) |
| 빛 | `DirectionalLight3D` rotation (-55, -45, 0)·energy 1.2·color (1, 0.96, 0.9). 림은 셰이더 rim 으로(별도 라이트 없음). 다섯 판 같은 값 |
| 카메라 | GO `camera_rig.gd` FOV 50·거리 8·줌 6~11m·피치 35°(105 Q-h 반영 완료). DUNGEON/FOREST는 다른 스크립트 `dungeon_camera_rig.gd`(고정 카메라, 회전·줌 없음) — 방·집 치수가 원래 사람 스케일이라 피치/거리(12m·55°, 14m·62°)는 그대로 둔다. STORY 사이드 FOV 40·거리 14, REALM 궤도 FOV 45. 흔들림은 `combat_feel` 만 |
| 실루엣 | 캐릭터·몬스터 GLB 는 128px 축소 스냅샷에서 구별돼야 채택(103장 판정 절차) |

## 102-2. WorldEnvironment 파라미터 표 (`assets/environment/env_pc.tres`·`env_mobile.tres`)

톤·색은 두 리소스에서 **같게**(66-1 규칙). 지금 값 → 목표값.

| 속성 | 지금 | PC 목표 | Mobile 목표 |
|---|---|---|---|
| `tonemap_mode` | 2 Filmic | **4 AgX** | 4 AgX |
| `tonemap_exposure` | 1.0 | 1.0 | 1.0 |
| `ssao_enabled` / `ssao_radius` / `ssao_intensity` | on / 기본 | on / **1.0** / **2.0** | off |
| `ssil_enabled` | on | on(데스크톱만) | off |
| `sdfgi_enabled` | on | **on 유지**(105장 Q-b 종결, 2026-09-23 — LightmapGI 폐기) | off |
| `ssr_enabled` | on(56) | **off**(66-2 "물은 단순화" — SSR 필요 없음) | off |
| `glow_enabled` / `glow_intensity` / `glow_bloom` / `glow_hdr_threshold` | on / 0.6 / 0.05 / 기본 | on / 0.6 / **0.0** / **1.0** | on / 0.5 / 0.0 / 1.0 |
| `adjustment_enabled` / `contrast` / `saturation` / `color_correction` | off | **on / 1.05 / 1.10 / LUT 1장**(판별 `assets/generated/lut_<판>.png`) | 같음 |
| `fog_enabled` / `fog_light_color` / `fog_density` / `fog_sky_affect` | on / (0.75,0.78,0.72) / 0.006 | on / **= sky_horizon_color** / 0.006 / 0.5 | on / 같음 / 0.006 / 0.5 |
| `volumetric_fog_enabled` | on(0.01) | off(안개는 깊이·높이 안개로 충분, 성능) | off |
| `sky` | ProceduralSky | ProceduralSky 유지 + 판별 top/horizon 색을 팔레트에서 | 같음 |

흰 옷이 날아가는 문제(66-2 현재 상태)는 `glow_bloom 0.05→0.0`·`glow_hdr_threshold 1.0` 으로 먼저 잡고, 그래도 남으면 `rim_strength 0.3→0.2`.

## 102-3. 툰 셰이더 스펙

- `cel_toon.gdshader` 유지. 파라미터 확정값: band_count 3 · band_softness 0.08 · rim_color (1, 0.95, 0.85) · rim_power 4.5 · rim_strength 0.2~0.3(102-2 뒤 결정). `hit_flash` uniform(0~1) 추가 — `combat_feel` ③ 이 쓴다.
- **외곽선**: `next_pass` 에 뒤집힌 헐 셰이더 `cel_outline.gdshader`(신규) — `cull_front`, `unshaded`, `VERTEX += NORMAL * thickness`, thickness **0.015m**(폰 1.5배 픽셀 비율에서 1px 안팎), color (0.08, 0.06, 0.10). 대상: Player·Enemy·NPC·상호작용 채집물만(66-2). 풀·바위·건물엔 안 건다. 등급 색 외곽선(101-3 G)은 같은 셰이더의 color 만 바꾼다.
- **FOREST 곡률 병합**: `world_curve.gdshaderinc` 를 `cel_toon` 에 `#include` 하는 변종 `cel_toon_curved.gdshader` 하나로 주민·건물·나무를 덮는다(`world_curve_material.gd` 는 그대로, 새 머티리얼 생성 경로만 추가). 구면 투영은 절대 되돌리지 않는다.
- 램프 텍스처 방식으로 바꾸지 않는다(band 수식이 이미 있고 텍스처 1장 절약).

## 102-4. 조명·GI·프로브

- 지역 씬(TestVillage·TestRoom·TestVillageForest·각 STORY Field·TestCity)마다 `LightmapGI` 1개, 텍셀 0.5/m, 정적 지형·건물만 베이크(`GeometryInstance3D.gi_mode = STATIC`). 동적 캐릭터는 `DYNAMIC`(프로브 샘플).
- `ReflectionProbe` 1개/지역, `update_mode ONCE`, 박스 = 지역 크기, 물 없는 지역은 생략.
- 그림자: PC `directional_shadow/size 4096`·soft 3(지금 값 유지), Mobile 1024·soft 0. 캐릭터 발밑 **접지 그림자(blob decal)** 를 `Decal` 1개로 추가 — 소프트 섀도가 꺼진 폰에서도 붙어 보이게.

## 102-5. 초목·지형·애니

- 초목: `vegetation_builder.gd`·`forest_vegetation_builder.gd` 의 `MultiMeshInstance3D` 유지. 바람 셰이더 `wind_sway.gdshaderinc`(정점 `VERTEX.x += sin(TIME*1.2 + world.x*0.3) * 0.08 * UV.y`)를 잎 메시에만. 인스턴스 상한 PC 2000 · Mobile 600.
- 지형: 글자 지도(`test_map.gd`·`village_map.gd`·STORY `*_map.gd`)는 그대로 데이터로 두고, 타일 평면 MultiMesh 대신 **지역당 heightmap 메시 1개**(`terrain_builder.gd` 에 `build_heightmap()` 경로 추가) + 트라이플레이너 셰이더 `terrain_triplanar.gdshader`(잔디·흙·돌 3타일 + 노이즈 블렌드, 타일은 103장 `tilegen`). 기존 `height` 값(산 +2.5·강 -1.0)을 그대로 읽는다. 충돌 바닥도 같은 메시에서 생성해 "평평한 충돌 바닥" 한계를 없앤다.
- 애니: 103장 Mixamo 리타겟 뒤 `AnimationTree`(101-3). 그 전엔 캡슐·정지 GLB 그대로.
- Mobile 프로파일: 위 표의 Mobile 열 + 외곽선 유지 + 인스턴스 600 + LUT 유지. 프로파일 분기는 66-1 의 세 줄과 `environment_profile.gd` 로만.

## 102-6. 현재 에셋 판정 (§6.0-1 한 스타일·105장 Q3 기준)

| 폴더 | 내용 | 판정 | 이유·조건 |
|---|---|---|---|
| `assets/characters/` character-a~d (Kenney Blocky) | 플레이어·NPC·산적 | **교체 대기(보류)** | 각진 블록 얼굴이 셀 램프와 안 맞음(66-2). 대체 GLB 확정 전까지 지우지 않는다(마이그레이션 규칙) |
| `assets/characters_vroid/` AvatarSample_A | GO 플레이어 기준 캐릭터 | **Q3 결정(a)** | 하이폴(29542) 애니 비율. 2026-09-19 사용자가 "VRoid로" 명시 지시해 GO `Player.tscn`에 적용 완료(a: VRoid 주역 + 저폴리 나머지) |
| `assets/characters_vroid/` saga_forest_avatar_01 | FOREST 플레이어 기준 캐릭터 | **Q3 결정(a) 적용** | 2026-09-19⑮ 사용자가 VRoid Studio로 직접 조형해 전달(Q-d "VRoid 조형" 몫). GO와 같은 파이프라인(베이크·1.7m 스케일)으로 `ForestPlayer.tscn`에 적용. DUNGEON 플레이어는 아직 character-a.glb(저폴리) 그대로 — 셋 다 바꿀지는 계속 열려 있음 |
| `assets/buildings/` (Fantasy Town 모듈) | 마을집·기둥 | **남김** | 66-2 결론대로 셰이더+팔레트 스냅+painterly 톤으로 충분. `colormap.png` 를 팔레트 24색으로 스냅 |
| `assets/vegetation/`·`rocks/` (Nature Kit) | 나무·바위 | **교체(Quaternius Stylized Nature)** | 뭉게 캐노피가 목표 톤에 맞음. 사람이 itch.io 에서 받아 줘야 함. 그 전엔 팔레트 스냅만 |
| `assets/dungeon/` (Modular Cave) | 방·복도·문 | **남김** | 굴혈 mood 팔레트 3종 스냅 |
| `assets/shrine/` altar-stone | 옛 사당 | **남김** | |
| `assets/environment/` env_*.tres | 환경 | **남김·102-2 로 재설정** | |

## 102-7. "허접해 보이는" 10가지 — 이 트랙 해당 여부

| 원인 | 해당 | 처방(장) |
|---|---|---|
| 에셋 스타일 혼재 | **해당**(Kenney 블록 + VRoid 하이폴 + 단색 캡슐) | 102-6·103 |
| 후처리 없음 | 부분(Glow·Fog 있음, Adjustments·LUT 없음) | 102-2 |
| 그림자 계단 | 부분(PC soft 3, Mobile 0) | 102-4 blob |
| 바닥 한 색 | **해당**(타일 색 평면) | 102-5 트라이플레이너 |
| 하늘·안개 불일치 | 부분(fog 색 ≠ horizon) | 102-2 |
| 스케일 뒤죽박죽 | 부분(마을집 모듈 실측 조립 뒤 개선, 캐릭터 1.4×/1.25× 배율 임의) | 102-1 fit_height |
| 애니 끊김 | **해당**(애니 없음) | 101-3·103-4 |
| 타격 반응 없음 | **해당**(hitstop 1개) | 101-3 |
| UI 폰트·패널 불일치 | 부분(Label 나열, 9-slice 없음) | 폰트 1+숫자 1, 9-slice 패널 1종 `saga_core/ui/` |
| 카메라 클리핑 | 부분(SpringArm 있음, 근접 페이드 없음) | `camera_rig.gd` 근접 페이드 1.5m |

---

# 103. 에셋 창조 파이프라인 (2026-09-16 신설 — `../SAGA-DESIGN.md` §7 를 이 프로젝트가 받는 방식)

## 103-1. 받는 자리

```text
assets/generated/
├── palettes/      <name>.json          24색 hex 배열 + 역할(base8·light8·dark8). 판·바이옴별
├── tiles/         <biome>_<kind>_512.png (+ _n 노멀, _r 러프)   트라이플레이너용
├── props/         <kind>_s<seed>_<nn>.glb                      procgen 바위·나무·울타리·비석
├── variants/      <원본이름>__<palette>.glb                     palette.py 스냅 결과
├── kitbash/       <조합표이름>_<nn>.glb                          부품 조합 캐릭터·건물
├── sprites/       <kind>.png                                    spritegen — 9-slice 패널·상태 아이콘
├── lut/           lut_<판>.png                                  102-2 색보정
└── sfx/           hit_01~03.wav · pick_01~03.wav · ui_01~03.wav (원안 ogg, vorbis 인코더 없어 wav로 — 103-1)
```

- 원본 팩(`assets/characters/…` 등)과 섞지 않는다. 생성물은 씨앗으로 재생성 가능해야 한다(파일명에 `s<seed>`).
- 스크립트는 저장소 루트 `tools/asset-forge/`(SAGA-DESIGN §7.2 — palette.py(2026-09-19)·kitbash.py·procgen.py(2026-09-20, rock/stele/fence/wall 4종)·tilegen.py(2026-09-20, grass/dirt/stone/sand/snow/lava 6종, 512 베이스+노멀+러프니스, 감싸기 보간이라 완전 시임리스)·sfxgen.py(2026-09-20, saga-realm js/sfx.js 의 tone/noise/chime 합성을 numpy 로 이식, hit/pick/ui 각 3종 라운드로빈. **ogg 아니라 wav** — vorbis 인코더가 이 PC엔 없다)·spritegen.py(2026-09-20, PIL ImageDraw로 직접 래스터화 — **SVG 단계 생략**, 들여올 SVG 소스가 없어서. panel_9slice·icon_heart_filled/empty·icon_star) 신설. 103장 전부 신설 완료). Python 3.12(문서상 3.14 는 오기) + Pillow + numpy + trimesh + scipy(2026-09-20 추가 설치, trimesh의 fix_normals/vertex_normals 가 내부적으로 필요) 확인됨(Blender 없음). 스크립트는 다섯 판·두 트랙이 같이 쓰되 **출력만** 각 프로젝트로 간다(코드 공유 금지 원칙은 게임 코드 얘기, 빌드 도구는 예외 — 105장 Q 로 확인). **실행 함정**: 이 PC 는 `python`/`python3` 가 WindowsApps 스토어 스텁이고, `py` 단독도 스크립트의 `#!/usr/bin/env python3` 셰뱅을 읽어 같은 스텁으로 샌다(exit 9009, "Python" 한 줄만 찍고 끝) — 반드시 `py -3 tools/asset-forge/<script>.py`로 버전을 못박아 부른다.

## 103-2. `.import` 규칙

- 텍스처: VRAM Compressed + 밉맵(ASSET_GUIDE 2026-09-11⑨ 와 같음), 팔레트 스냅 PNG 도 동일. LUT 는 **압축 끔·밉맵 끔**(색보정 정확도).
- GLB: 기본 임포터, `root_type Node3D`, 애니 없는 소품은 `meshes/generate_lods false`(저폴리라 불필요). `.import` 파일은 첫 헤드리스 임포트 뒤 함께 커밋한다(기존 관례). 임포트 뒤 `git diff -- project.godot '*.import'` 잡음 확인은 폴더 CLAUDE.md 그대로.
- 팔레트 JSON 은 Godot 이 임포트하지 않는 순수 데이터(`.json` 그대로 `FileAccess` 로 읽거나 빌드 시에만 씀).

## 103-3. 변형 배가 대상 (지금 있는 것으로 곧바로 할 수 있는 것)

| 원본 | 팔레트 | 결과 | 쓰는 곳 |
|---|---|---|---|
| Nature Kit 나무 3·바위 2 | GO 마을/포구/폐허 3 + FOREST 바이옴 5(green·meadow·dark·mushroom·rocky) | 5×8 = 40 변형 | `vegetation_builder`·`forest_biome_scatter` 가 바이옴별 변형을 고른다 |
| Fantasy Town 모듈 4(벽·판자·지붕·기둥) | 마을·폐허·**시대 퓨전(녹슨 금속·홀로그램 잔해)** 3 | 12 변형 | `landmarks_builder`·`forest_house`·STORY `story_town` |
| Modular Cave | 굴혈 mood 3(흙·석회·용암) | 3 세트 | DUNGEON `TestRoom` 방 종류별 |
| character-a~d | NPC 옷 팔레트 8 | 32 변형 | `npc_builder`·`villager_builder`·REALM 무장 실루엣 — **교체 전 임시**, 교체되면 새 GLB 에 같은 스크립트 |
| procgen 바위(노이즈 구체)·비석·울타리·돌담 | 판별 | 씨앗당 무한 | 포구·폐허 빈 칸(101-1 E) 채우기 |
| tilegen 잔디·흙·돌·모래·눈·용암 | 판별 24색 | 6×판 | 102-5 트라이플레이너 |
| 무기 kitbash(자루 3 × 날 4 × 장식 3) | 등급 4 색 | 36 | 101-3 G 무기 메시 스왑 |

## 103-4. VRoid·Mixamo 활용 조건

- **대체 예정(2026-09-24 사용자 확정)**: 상용을 위해 VRoid·Mixamo 는 `tools/char-forge/`(Blender 헤드리스 + CC0 MakeHuman·Quaternius)로 바꾼다. 순서·기준은 그 README §7 — 이 장 아래 줄은 교체 전까지의 현재 상태다. **동작은 교체 끝**: 게임이 부르는 여덟 동작은 `assets/characters_vroid/anim_cc0/`(CC0, `tools/ual_lib_build.gd`), 아래 Mixamo 줄은 몸(VRoid) 얘기만 유효하다. **몸 = VRoid 직접 디자인(2026-09-25 결정)**: 공방 툰 몸은 얼굴이 원신풍이 아니라 안 쓴다. 주역은 사람이 VRoid 로 디자인해 `../tools/char-forge/vroid_intake.sh <vrm> <id>` 로 들인다(그 README §10).
- **Mixamo**: 인간형 GLB(character-a~d 는 리그가 Kenney 자체 — 리타겟 필요, VRoid 는 VRM 휴머노이드) 를 FBX 로 올려 자동 리깅 + 애니(idle·walk·run·attack·hit·dodge·death) 받기 → Godot `BoneMap`(`SkeletonProfileHumanoid`) 리타겟. 라이선스는 게임 사용 허용. 사람이 Adobe 계정으로 다운로드해야 한다(자동화 불가).
- **VRoid**: 105장 Q3 결정(a, 2026-09-19) — 인물 105 조형은 사람 몫이라 현실적으로 **주역 5~10명만** VRoid, 나머지는 kitbash 저폴리. GO(AvatarSample_A)·FOREST(saga_forest_avatar_01) 플레이어에 적용 완료. DUNGEON 플레이어도 같은 VRoid로 바꿀지는 열려 있음(사람이 조형 하나 더 만들어 줘야 함, Q-d) — `cel_shader_apply.gd`의 `FACE_BAKE_BY_GLB` 표에 GLB 경로만 추가하면 같은 파이프라인으로 붙는다. `cel_toon` 으로만 렌더(MToon 원본 셰이더는 안 씀).
- 66-1/66-2 와의 관계: 66-1 결정(Godot 유지)·66-2 결정(카툰 방향·원작 리소스 금지·Kenney 순차 교체)은 그대로. 이 장은 "무엇으로 교체하나" 의 실행 계획이다. AI 생성(SAGA-DESIGN §7.4)은 소품·건물 텍스처에만, 원작 IP 프롬프트 금지, 결과물도 팔레트 스냅.

## 103-5. 판정 절차(새 에셋 하나를 들일 때)

1. 라이선스(CC0/CC-BY/VRM 허용) 확인 → ASSET_GUIDE 표에 한 줄.
2. 헤드리스 임포트 오류 0.
3. `fit_height` 스케일 → 128px 실루엣 스냅샷(사람 GUI 확인은 몰아서).
4. 팔레트 스냅 → `assets/generated/variants/`.
5. 씬 1곳에 물리고 헤드리스 3회 md5 회귀.

---

# 104. 안정화·검증 (2026-09-16 신설 — Phase 0)

- **절차**: Godot exe 확보·헤드리스 임포트·실행·`.import`/`project.godot` 잡음 되돌림·GUI 확인·PID 종료는 폴더 `CLAUDE.md` 가 정본이다. 여기서 반복하지 않는다.
- **회귀 스크립트(신설, 저장소 `tools/godot_regress.sh`)**: 다섯 대표 씬(`TestVillage`·`TestRoom`·`TestVillageForest`·`SinyaField`·`TestCity`) 을 `--headless --quit-after 5 --verbose` 로 각 3회 돌려 로그 md5 동일 + error/warn 0 을 한 줄로 출력. **재질 감사**(2026-09-23 추가, `saga_core/world/material_audit.gd`·호스트 `tools/material_audit_host.tscn`)도 다섯 씬 각 1회 — 텍스처 있는 원본을 덮으며 ① 텍스처·정점색 둘 다 잃음(flat-tint) ② 알파 컷 무시(alpha-dropped) ③ 원본과 다른 텍스처(foreign-texture, 얼굴 베이크 예외)를 0건이어야 통과(에러 없이 "다르게 그려질" 뿐이라 md5로는 못 잡는 부류). 세션 끝에 이것과 `git diff -- project.godot '*.import'` 빈 것을 확인한 뒤 HISTORY 항목을 쓴다.
- **세이브 버전**: 다섯 `*_save_state.gd` 전부 `version` 필드와 마이그레이션 함수가 있는지 점검(PLAN 28장·97단계). 없는 판은 Phase 0 에서 추가. 헤드리스 검증 항목: 구버전 파일 로드 → 기본값 채움 → 재저장 왕복.
- **문서 크기 상한**: `PLAN.md` ≤100KB · `docs/PROJECT_STATE.md` ≤15KB · `CLAUDE.md` ≤6KB. 루트 `tools/precheck.sh` 가 잰다. `docs/HISTORY.md` 는 상한 없음(grep 전용).
- **실기 확인 대기**: 목록은 `docs/PROJECT_STATE.md` "실기 확인 대기" 가 정본(항목명만). 사용자가 몰아서 보고, 결과는 HISTORY 날짜 항목으로. 확인 전엔 같은 판에 새 큰 시스템을 얹지 않는다(SAGA-DESIGN §8-1).
- **Phase 0 작업 목록**(순서대로, 각 1세션 이하):
  1. `tools/godot_regress.sh` 작성·5씬 3회 통과.
  2. 세이브 버전 필드 다섯 판 점검·보강.
  3. `.import` 잡음 자동 되돌림을 regress 스크립트 끝에(`git checkout -- '*.import' project.godot` 는 **의도한 변경이 없을 때만**, 스크립트가 먼저 diff 를 보여 주고 묻는다).
  4. `ChoicePrompt` 류 클로저 패턴 전수 검사(09-16 크래시와 같은 모양: 로컬 변수 캡처 후 `queue_free`).
  5. `density_report()`(101-3) 로 GO 3지역·FOREST 빈 격자 비율 측정 → PROJECT_STATE 에 수치 1줄.
  6. 이후 101장 이식 ① 로 넘어간다.

## 104-7. 폰 발열 예산 (2026-09-24 사용자 "핸드폰이 불날 정도 사양은 아니어야" · "그래픽을 낮추라는 게 아니다")

- 원칙: **보이는 그림은 그대로, 헛그리기·헛계산만 걷는다.** 해상도 낮추기·효과 끄기·프레임 상한은 이 장의 수단이 아니다(필요하면 사용자 결정).
- 기준(모바일 렌더러, 기기와 무관한 수 — `tools/probe_perf.gd` 세 지역 신상 곁 8방향): 한 프레임 draw call **≤ 260**, 삼각형 평균 **≤ 35만**·최대 **≤ 50만**. 물리(헤드리스, 제자리) ≤ 2ms.
- GO 적용(`world/render_budget.gd`, test_village 가 다 지은 뒤 한 번): 삼각형 5만+ 이고 지도 전체에 걸친 MultiMesh(나무 등)만 112m 칸으로 쪼갬 — 칸마다 시야·그림자 범위 밖은 빠지고 먼 칸은 엔진 LOD(화면 1px 오차). 작은 풀·꽃까지 96m 로 다 쪼개면 넓게 볼 때 draw call 887 까지 올라 기각. 카메라 far 4000 → 1000m(가장 맑은 안개로도 0.07%). 들판 적은 플레이어 100m 밖에서 쉬면 AI·물리·몸 애니를 멈추고 90m 안에서 깬다(`field_enemy.gd SLEEP_M`).
- 측정 결과(09-24): 마을 삼각형 평균 258만 → 32만(최대 274만 → 44만), draw call 180~250 그대로 · 물리 5.3 → 1.6ms, 처리 9.2 → 2.9ms. 실기 발열은 사람 몫(71장 기기).
- 남은 후보(그림 그대로인 것만): 지형 셰이더가 한 점에 텍스처 27~30번(재질 셋 × 색·노멀·거칠기 × 면 셋) — 모바일 전용 변형에서 같은 그림을 더 적은 샘플로 · VRoid 인물 윤곽선(next_pass)이 삼각형을 두 배로 · 해 그림자 4단 분할(그림자에 드는 물체를 여러 번 그림).

---

# 105. 열린 질문 (사용자 결정 — 답이 나오면 해당 장에 내려보내고 여기서 지운다)

- **Q1 완성판 트랙 — 결정(2026-09-21): Unity 먼저 집중으로 뒤집힘**(SAGA-DESIGN §10-Q1, 2026-09-20 "Godot 먼저" 결정을 사용자가 하루 만에 다시 뒤집었다). 이 트랙의 팔레트·procgen·tilegen·sfxgen·spritegen 파이프라인 우위는 그대로 유효하지만, 그래픽·에셋 신규 투자 우선순위는 Unity 쪽으로 넘어갔다. 이 트랙 병행 개발은 유지, 진행 중인 작업은 그대로 존중.
- **Q-b SDFGI vs LightmapGI — 종결(2026-09-23, PC는 SDFGI 유지)**: `terrain_builder.gd`·`vegetation_builder.gd`가 지형·초목을 매 세션 `_ready()`에서 절차적으로 새로 짓는다(102-5) — LightmapGI 베이크는 고정된 정적 메시·UV2에 텍스처를 구워 재사용하는 방식이라, 세션마다 바뀌는 절차적 지형엔 구조적으로 안 맞는다(매번 다시 구워야 해 모바일에 오히려 부담, 애초에 GI를 "구워서" 아끼려던 취지와 반대). windowed exe 실측(TestVillage, 맑음·여름 강제)으로 현재 SDFGI 톤도 확인 — 과다노출·색 튐 없이 기존 승인 톤 그대로. PC는 SDFGI on 유지로 확정, LightmapGI 방향은 폐기.
- **Q-d 사람 몫 — 종결(2026-09-23, Quaternius 씬 배치 5단계까지 완료)**: 사람이 무료 Standard 버전을 직접 받아 Quaternius 68종(나무·덤불 22+바위 24+잔디·꽃 22) **전부** `assets/vegetation/`·`assets/rocks/`에 확보·임포트 검증·4팔레트 스냅(ASSET_GUIDE 09-20)까지 끝냈고, **씬 배치(5단계)도 09-23 세션 안에서 전부 마쳤다** — GO 정원길·해변 조약돌·숲 하층(고사리·버섯·잔디·선반버섯)·평지 들꽃·신설 "관목"(`SHRUBS`) 층까지 68종이 전부 어딘가에 배치됨(GO `vegetation_builder.gd`), FOREST는 바이옴 primitive 3종 교체(상세 HISTORY 09-23 여러 절). 남는 건 순수 사람 몫 둘뿐: **Mixamo — 로그인만 사람, 검색·선택·다운로드는 자동**(루트 `tools/mixamo_automation/`, 2026-09-21 구축) · **VRoid 조형(주역 몇 명)**은 자동화 대안 없음(CharacterGen 등 검토·기각, 2026-09-23).

---

# 106. GO 원신 기준 (2026-09-23 사용자 결정 — "원신 같아야 해" → 점검 결과 다섯 갈래 "순서대로 다해줘")

그래픽(66-2)만이 아니라 **GO 게임성 전체의 기준을 원신에 둔다**. 2026-09-24 사용자 "원신으로 완전 일치 · 전투 스타일·맵 스타일" — 목표는 비슷한 수준이 아니라 **조작·화면·시스템의 완전 일치**이고, 우선순위는 전투(⑧)·지도(⑨), 그다음 아래 "남은 격차" 순서(오마주·문법만, 원작 리소스·이름 금지 — 66-2 "하지 말 것" 그대로). 퓨전(시대 혼합·몬스터)은 계속 허용. 이 장이 **GO 한정으로** VS 때의 "웹 duel.js 그대로, 새로 설계하지 않는다"(34절) 원칙을 대신한다 — 옛 결투는 사건용으로 남기고, 들판 전투는 새로 짠다. DUNGEON·FOREST 가 같이 쓰는 `player.gd` 는 건드리지 않는다(GO 는 `go_player.gd` 상속).

| 순서 | 갈래 | 스펙 | 사람 몫 |
|---|---|---|---|
| ① | **이동** | `go_player.gd` — 점프 1.4m·스태미나 100(달리기 8/s·등반 6/s·도약 15·활공 5/s·수영 2~12/s, 회복 25/s·지연 0.8s, 소진 시 30까지 달리기 잠금)·등반(정적 몸체, 법선 y<0.5, 꼭대기·1.3m 이하 턱 넘어오르기)·활공(발밑 2m+, 7.5m/s·낙하 2.2m/s, 코드로 그린 날개)·수영(수면 Area3D, 기력 0 → 마지막 땅 복귀)·스태미나 고리 UI·모바일 점프 버튼. 지형(`terrain_builder.gd`): 산 10~18m(테두리 22~30m) 고원+봉우리 9m·수직 절벽 옆면·강바닥 -3m·보이는 메시 trimesh 충돌·지도 경계벽(레이어 2)·물 레이어 4. 자동 점검 `tools/probe_traversal.gd` 11항목 | 등반·활공·수영·점프 전용 Mixamo 클립(지금은 idle/walk + 몸 기울기) |
| ② | **물·하늘** | 툰 물 셰이더(깊이로 색 두 단·물가 거품·흐르는 하이라이트 띠·프레넬), 손그림 하늘(그라디언트+노이즈 구름+해 원반), PC/Mobile 두 env 같은 톤(66-1) | — |
| ③ | **들판 전투** | 들판에 떠도는 적(배회→발견→예고→공격), 기본 공격 3타·원소 스킬·원소 폭발, 원소 3(화·수·뇌)과 반응 3(증발 ×1.5·과부하 광역·감전 지속), 등용한 동료 최대 4명 교체(숫자키, 동료마다 id 해시로 원소 고정) | — |
| ④ | **인물 모델** | 캡슐(역사 인물·신수·늑대)부터 실제 모델로. 있는 VRoid 3체+팔레트 변형, 짐승은 확보 가능한 CC0 GLB | 주역 VRoid 조형 |
| ⑤ | **지역 잇기** | 마을·포구·폐허를 한 좌표계에 붙이고(원점 8000m 떨어뜨리기 폐기) 산 사이 고개로 걸어서 넘어간다. 역참은 순간이동 지점(원신 워프 포인트)으로 남긴다 | — |
| ⑥ | **보물 상자** | 등급 4(평범·정교·진귀·화려, 경험치 5·15·30·60 — 새 재화 없음) × 잠금 3(없음 · 무리: 반경 12m 들판 적을 한꺼번에 전멸 · 석등: 6m 둘레 석등마다 정한 원소를 스킬·폭발로 밝혀 20초 안에 다) · 세 지역 16개(평범 7·정교 4는 산 턱·진귀 3·화려 2). 다가가면 저절로 열림, 연 상자는 EventState `chest_<id>`(세이브 스키마 그대로). 자동 점검 `tools/probe_treasure.gd` 9항목 | — |
| ⑦ | **원소 쓰는 적** | 퓨전 괴물 셋(불도깨비 화·물거북 수·번개살쾡이 뇌, 코드로 그림) — 원소 방패(150·180·130): 방패가 있는 동안 체력 대신 방패만 깎임, 같은 원소 면역·물리 ×0.4·상성(수>화·뇌>수·화>뇌) ×2.5, 반응·부착 없음 → 깨지면 2초 비틀거림, 그 뒤 보통 적. 덤벼 맞히면 화상(피해 ×0.2 세 번, 이것만으로는 안 쓰러짐)·젖음(스태미나 -25)·감전(기력 -25). 무리 3곳 8마리(포구 1·폐허 2, 마을은 사건 칸이 빽빽해 안 넣음), 경험치 20 | — |

| ⑧ | **전투 조작·화면 원신 일치** | PC 배치: 마우스를 가두는 시점(`camera_rig.gd mouse_look`, GO 만 켬 — Alt·Esc·그룹 `ui_modal`·`duel_active`·frozen 이면 커서 풀림) · 마우스 왼쪽 공격(0.4초 누르면 강공격 ×1.3, 스태미나 20) · 공중·활공에서 누르면 낙하 공격(발밑 2.5m+, ×(1.2+0.1×떨어진 m, 15m 까지)) · E 스킬 · Q 폭발 · Shift 누르는 순간 대시(계속 누르면 달리기)·오른쪽 대시 — 옛 J/K/L 유지. **인물마다 체력·기력**(대기 인물 기력 60%), 쓰러지면 다음 인물로, 다 쓰러지면 모두 가득 부활. **원소마다 스킬·폭발 모양**(화: 앞 부채꼴 5m ×1.1 / 7m ×2.4 + 3초 불 고리 · 수: 4m ×0.9 + 모두 8% 회복 / 7m ×1.6 + 8초 회복 · 뇌: 8m 가까운 셋 낙뢰 ×1.0 / 7m ×1.2 + 6초 낙뢰). **원소 공명**(같은 원소 둘+: 화 공격 +25%·수 체력 +25%·뇌 기력 +50%). HUD: 오른쪽 명단 체력 막대·오른쪽 아래 E·Q 원. `probe_field_combat.gd` 13→19항목 | — |
| ⑨ | **지도 원신 일치** | `ui/world_map.gd` — 왼쪽 위 원형 미니맵(북쪽 위, 인물 화살표·카메라 부채꼴·지점 아이콘, 지름 220m, 누르면 지도) · M 지도 화면(세 지역 한 장 1px=3m, terrain LEGEND 색+height_at 북서 음영, 물은 물빛, 끌기·휠 0.8~5배, 지점 눌러 "순간이동") · 지역 이름 띠(경계를 넘으면 2.8초, 청하 마을·갯바람 포구·잿빛 폐허) · 탐험도 %(지역의 지점 활성화+보물 상자). 신상을 켜기 전엔 그 지역 지도가 구름에 덮임. `world/waypoints.gd` — 순간이동 지점 7(신상 3: 지역마다 하나) — 5m 안에 들면 활성화(EventState `wp_<id>`, 스키마 그대로), 신상 6m 안에 서 있거나 신상으로 순간이동하면 쓰러진 인물까지 모두 가득. 왼쪽 위 대화·부대·사명·도감·날씨 글자는 미니맵 밑으로(런타임, 씬 파일 그대로). 자동 점검 `tools/probe_world_map.gd` 10항목 | — |

| ⑩ | **인물 육성** | `data/growth.gd`(표) + `PartyState.growth·bag`. 레벨 1~90·돌파 0~6(상한 20·40·50·60·70·80·90), 다음 레벨 경험 = 400+6×Lv², 견문록 짧은 1000·보통 5000·두꺼운 20000(경험 5 = 1냥, 상한에서 남는 경험 버림), 돌파 = 냥 5천~6만 + 인물 원소 결정 1·3·6·9·12·20 + 전리품(늑대 송곳니/도적 휘장, id 해시) 3·10·15·20·25·30. 능력치 배율 1+0.035×(Lv-1)+0.08×돌파 × 공격 60·방어 35, 체력 = 200+방어×2 — **들판 전투는 인물마다 이 값**(옛 PartyState.atk 는 사건 결투·승급 3택만). 얻는 곳: 들판 적(늑대 냥 40+송곳니 · 도적 60+휘장 · 원소 괴물 90+결정+짧은 견문록), 보물 상자(등급별 냥 300~3000·견문록·결정). **SAVE_VERSION 3**: `char_growth`·`bag`, v2 는 부대 레벨 L → 인물 Lv 1+2L(20 까지). 인물 화면 `ui/character_screen.gd`(C·B·"인물" 단추). 자동 점검 `tools/probe_growth.gd` 10항목 | — |

| ⑪ | **수집 구슬·신상 봉헌** | `world/star_shards.gd` — 별조각 20(마을 8·포구 7·폐허 5): 산꼭대기(땅+1.2m)·물 위(수면+0.6m)·나무 위(땅+2.6m), 등반·수영·점프·활공으로 닿는다. 1.6m 안에 들면 줍기(EventState `shard_<id>`), 신상 둘레 6m 에 서면 저절로 바침(`shardgive_<id>`) — 두 개마다 신상 Lv+1 → 스태미나 상한 +8(최대 180)·냥 1000·짧은 견문록 2. `go_player.stamina_max` 변수(STAMINA_MAX 는 처음 값). 지도 탐험도에 별조각 포함·지도 옆에 신상 Lv. 자동 점검 `tools/probe_star_shards.gd` 6항목 | — |

| ⑫ | **특성 레벨·운명의 자리** | `data/growth.gd` 표 + `PartyState` 성장 칸에 `tn/ts/tb`(기본 공격·원소 스킬·원소 폭발 1~10)·`con`(0~6) — 필드만 더해 SAVE_VERSION 3 그대로(없으면 1·0). 특성 상한은 돌파가 연다(돌파 0~1 → 1 · 2 → 2 · 3 → 4 · 4 → 6 · 5 → 8 · 6 → 10), 레벨마다 그 특성 피해 ×1.0~1.8(자리 보너스로 13 → ×2.125, 스킬은 피해만 — 수 회복량은 그대로). 올리기: 냥 2500~14만 + 무예 쪽지 3 → 교본 2·4·6·9 → 비전 4·6·12·16 + 돌파 전리품 3~22(주간 보스 재료는 그 갈래에서). 운명의 자리 = 같은 인물 중복 등용 대신 **인연 매듭**(인물 가리지 않음) 하나로 한 자리: 1 스킬 쿨 -20% · 2 반응 피해 +15% · 3 스킬 +3 · 4 체력 +20% · 5 폭발 +3 · 6 폭발 뒤 10초 공격 +25%. 얻는 곳: 원소 괴물 쪽지 1 · 상자 평범 쪽지 1·정교 쪽지 2·진귀 교본 2+매듭 1·화려 교본 3+비전 1+매듭 2 · 신상 Lv 마다 매듭 1(매듭 모두 17개 — 비경·의뢰가 생기면 늘린다). 인물 화면 가운데 아래에 특성 세 줄·자리 여섯 줄. 자동 점검 `tools/probe_talent.gd` 10항목 | — |

| ⑬ | **원소 시야** | `world/elemental_sight.gd` — 휠 누르기·V 를 누르고 있는 동안(터치는 "시야" 단추로 켜고 끔). 화면 잿빛(명도만 남기고 푸른 기·가장자리 어둡게, 켜는 순간 가운데서 퍼지는 물결 0.7초, 켜고 끄기 0.2초) — 인라인 canvas 셰이더(hint_screen_texture), CanvasLayer -1 이라 HUD 는 색 그대로. 반경 45m 안 짚기(벽 너머로도, 잿빛 막 위 2D 빛): 안 연 상자 금빛 · 안 주운 별조각 하늘빛 · 꺼진 석등 그 원소 색 · 안 켠 순간이동 지점 흰빛 · 들판 적(원소 괴물은 원소 색, 나머지 붉게). 흔적: 80m 안 가장 가까운 상자·별조각 쪽으로 땅 위 2.2m 마다 빛 점(최대 14개)이 흐른다. 창(보이는 ui_modal)·결투·frozen 이면 꺼짐. 이동·전투는 안 막음, 세이브 없음. 자동 점검 `tools/probe_elemental_sight.gd` 8항목 | — |

| ⑭ | **원소 7·반응** | `combat/elements.gd` — 화·수·뇌에 풍·빙·암·초. 동료 원소 = id 해시 % 7(세이브에 원소 없음 — 옛 동료 원소가 바뀐다, 주인공은 화). 풍·암은 안 붙는다. 반응: 융해 ×1.5(화+빙) · 빙결(수+빙, 2.5초 멈춤 — 강공격·낙하로 치면 쇄빙 ×1.5·풀림) · 초전도(빙+뇌, 둘레 3m ×0.5 + 8초 물리 ×1.4) · 확산(풍+화·수·뇌·빙, 둘레 4m 적에게 그 원소를 옮겨 붙이고 ×0.6) · 결정(암+화·수·뇌·빙, 명단 전체 보호막 = 지금 인물 최대 체력 20%·15초) · 개화(초+수, 1.5초 뒤 씨앗 둘레 3m ×1.5) · 연소(초+화, 0.5초마다 ×0.2 여덟 번) · 촉진(초+뇌, 8초 뇌 활성·초 발산 ×1.25). 보호막은 받는 피해를 먼저 막고 다 막으면 원소 효과(화상·젖음·감전)도 막는다. 새 원소 스킬·폭발: 풍(5m ×1.0 끌어당김 / 7m ×1.0 + 6초 소용돌이) · 빙(앞 부채꼴 6m ×1.2 / 7m ×1.4 + 6초 눈보라) · 암(앞 2.5m 기둥 3m ×1.3 / 7m ×2.0 + 보호막 30%) · 초(4m ×1.0 / 7m ×1.2 + 8초 가시덤불). 공명: 풍 스태미나 소모 ×0.85 · 빙 빙 부착·빙결 적에게 +15% · 암 보호막 동안 +15% · 초 반응 +20%. 풍·빙·암·초 결정은 진귀(1)·화려(2) 상자에서만 — 원소 방패는 옛 셋 상성 그대로(새 넷은 ×1.0). 자동 점검 `tools/probe_elements.gd` 11항목 | — |

| ⑮ | **새 원소 괴물 넷** | `field_enemy.gd` KINDS — 회오리매(풍, 새 틀, 방패 140) · 눈여우(빙, 여우 틀, 170) · 바위곰(암, 곰 틀, 230) · 덩굴뱀(초, 뱀 틀, 160), 코드로 그림·경험치 20·냥 90+그 원소 결정 1+짧은 견문록+무예 쪽지. 무리 셋 8마리(포구 (4,6) 매 둘+뱀 · (6,7) 여우 둘+뱀 · 폐허 (1,4) 곰 둘 — 마을은 사건 칸이 빽빽해 뺌, 상자 무리 잠금·지점·별조각과 1.4칸+). 방패 상성: 풍 ← 암 · 빙 ← 화 · 암 ← 초 · 초 ← 풍(×2.5), 바위 방패는 물리도 ×1.0. 맞으면: 풍 휘말림(지금 인물 스킬 쿨 +2초) · 빙 한기(스태미나 회복 3초 멈춤) · 암 짓눌림(피해 ×0.3 더, 이것만으론 안 쓰러짐) · 초 중독(1초마다 ×0.15 네 번, 화상 자리). 자동 점검은 `probe_elements.gd` 에 ⑫~⑮ 4항목 더해 15, 전투 점검 적 수 21 → 29 | — |

| ⑯ | **무기·치명타** | `data/weapons.gd` 표 + `PartyState.weapons`(id→lv/exp/asc/ref)·`equip`(인물→무기) — 필드만 더해 SAVE_VERSION 3 그대로. 종류 5(한손검·양손검·장병기·법구·활, 인물 id 해시 · 주인공 한손검), 그 종류만 든다. 기본 공격 모양(`field_combat.WEAPON_KIT`): 한손검 옛 3타 · 양손검 ×0.6/0.7/1.0 느리게, 무거운 타격(쇄빙·바위 방패) · 장병기 3.4m 좁고 빠르게 · 법구 7m 안 하나를 인물 원소로 · 활 14m 안 하나 물리. 무기 15(수련용 ★1 다섯 — 공격 23, 여럿이 같이 듦 · ★3 다섯·★4 다섯 — 공격 39~44 + 부옵션 하나(공격력%·치명타 확률·치명타 피해·기력 획득·체력%) + 효과 하나(기본 공격·스킬·폭발·반응 피해 +12~20%)). 공격 = (인물 기본×배율 + 무기 공격력) × (1+공격력%) × 승급 특성. 무기 Lv 1~90·돌파 0~6(상한 계단 인물과 같음), 공격력 ×(1+0.12×(Lv-1)+0.3×돌파)·부옵션 ×(1+0.04×(Lv-1)), 경험 = 인물표×0.6(강화석 조각 400·강화석 2000·정련 강화석 10000, 경험 10 = 1냥), 돌파 = 냥 5천~3만 + 무쇠 조각 2~16 + 전리품. 같은 무기를 또 얻으면 재련 +1(5 까지, 효과 ×(1+0.25×(재련-1))), 한 자루를 옮기면 먼저 인물은 수련용. **치명타**: 인물 기본 5%·50% + 부옵션, 씨앗 고정 난수(20260824), 치는 인물이 있을 때만(점검이 `_deal` 을 바로 부르면 안 굴림). 얻는 곳: 진귀 상자 ★3·화려 상자 ★4(상자 id 해시로 종류), 강화석(원소 괴물·상자)·무쇠(도적·상자). 인물 화면 돌파 밑에 무기 줄+"강화"·"무기 돌파"·"무기 바꾸기". 자동 점검 `tools/probe_weapons.gd` 11항목 | — |

| ⑰ | **성유물** | `data/artifacts.gd` 표·생성 + `PartyState.artifacts`(uid "a<번호>" → set·slot·rarity·lv·exp·total·main·subs·seed·owner)·`artifact_seq` — 필드만 더해 SAVE_VERSION 3 그대로. 부위 5(꽃=체력·깃=공격력·해시계 공격%/체력%/방어%/기력 · 술잔 +원소 일곱·물리 피해 · 관 치명 확률/피해/공격%/체력%/방어%). ★4 +16(부옵션 처음 2~3)·★5 +20(3~4), +4 마다 넷 미만이면 새 부옵션·넷이면 하나 오름(한 번 = 최대치×0.7~1.0), 무작위는 성유물 씨앗(번호로 정함). 주옵션 = 처음+(끝-처음)×Lv/20(★4 ×0.8). 체력·방어 고정값은 이 판 규모로 줄임(꽃 32→210, 깃 47→311). 강화 = 연마석(경험 2500·냥 250), 다음 +1 = (Lv+1)×1500, 분해 = ★4 1·★5 2 + 쌓인 경험 8할. 가진 것 상한 200(넘치면 안 낀 ★4 부터 분해). 세트 5(2/4): 떠돌이 무사(공격 +18% / 한손검·양손검·장병기 기본 공격 +35%) · 불꽃 무녀(화 +15% / 증발·융해·과부하·연소 +40%) · 바람 나그네(풍 +15% / 확산 +60%) · 절연 깃발(기력 +20% / 폭발 +25%) · 물결 성자(수 +15% / 스킬 +30%). 공격 = ((인물×배율 + 무기) × (1+공격%) + 공격 고정) × 특성, 방어·체력도 같은 꼴. 원소 피해 보너스는 치명타와 같은 경계(치는 인물이 있을 때만). 얻는 곳: 원소 괴물 ★4 하나 · 정교 ★4 · 진귀 ★5 · 화려 ★5 둘. 인물 화면 무기 밑에 부위 다섯 줄(바꾸기·강화)·켜진 세트·"안 낀 ★4 분해". 자동 점검 `tools/probe_artifacts.gd` 12항목 | — |

| ⑱ | **채집·요리** | `data/cooking.gd`(표) · `world/gathering.gd`(채집) · `world/kitchen.gd`(냄비·조리·먹기) · `ui/cooking_screen.gd`(G · 냄비 곁 F · "요리" 단추). 채집 24무리 55개(마을 24·포구 16·폐허 15) — 일반 재료 다섯(박하·꿀꽃·산사과·송이버섯·바지락, 실제 시각 30분 뒤 다시 남)·지역 특산물 셋(마을 청하란·포구 갯소라·폐허 재꽃 지역마다 6, 1시간 — 원신의 하루·이틀을 채집 자리 수에 맞춰 줄임, 옅은 빛무리), 1.5m 안에 들면 줍기, 캔 때는 `PartyState.gather_t`. 짐승 고기 = 늑대·바위곰 드롭. 냄비 셋(신상 곁 +3.5m, 장작불) 3m 안에서만 조리. 요리 여덟 × 품질 셋(이상한·보통·맛있는): 바늘이 1.6초에 왕복, 요리마다 맛있는 칸 가운데 ±0.07 · 보통 ±0.2. 숙련 5 번이면 자동 조리(보통) — `PartyState.cook_prof`. 효과: 꿀꽃 떡(한 인물 14~26%+40~80) · 버섯 꼬치(명단 모두 6~12%) · 고기 찜(쓰러진 인물 10~20% 로) — 먹은 인물 포만감 +35(100 상한, 초마다 1) · 공격 계열(박하 고기볶음 공격 +12~24 · 청하란 차 치명 확률 +5~10% · 재꽃 버섯전 치명 피해 +10~20%) · 방어 계열(바지락탕 방어 +10~20) · 모험 계열(갯소라 구이 스태미나 소모 -12~24%) — 명단 전체 300초, 계열마다 하나(갈아 끼움), `PartyState.stat()` 에 더해짐. 버프·포만감은 세션 한정. **돌파에 특산물**(원신 문법): 3·10·20·30·45·60, 주인공 청하란·동료 id 해시로 셋 중 하나. 필드만 더해 SAVE_VERSION 3 그대로(`gather_t`·`cook_prof`). 자동 점검 `tools/probe_cooking.gd` 13항목 | — |

| ⑲ | **일일 의뢰** | `data/commissions.gd`(풀 열둘·굴림) · `world/commissions.gd`(진척·보상·게시판·의뢰판 U/"의뢰" 단추). 하루 넷(새벽 4시 갈림, 기기 지역 시각), 날짜 해시로 고르고 종류 다섯(토벌·채집·요리·원소 반응·둘러보기)이 겹치지 않게. 진척은 신호로: field_enemy `died`(kind·원소 괴물) · gathering `gathered` · kitchen `cooked` · field_combat `reacted`(새 신호 — 반응·쇄빙·활성/발산) · 둘러보기는 0.5초마다 그 자리 12m. 하나 끝나면 냥 1200·짧은 견문록 2·부대 경험 20(옛 부대 레벨 = 모험 등급 자리), 넷 다 끝나면 마을 역참 옆 게시판 4m 에서 냥 3000·견문록 1·강화석 2·연마석 2·부대 경험 40. 오른쪽 위 목표판 셋째 줄(전엔 "—")에 "의뢰 n/4". `PartyState.commissions`(day·list·bonus) — 필드만 더해 SAVE_VERSION 3 그대로, 날이 지난 세이브는 불러온 뒤 새로 굴림. 자동 점검 `tools/probe_commissions.gd` 10항목 | — |

| ⑳ | **비경** | `data/domains.gd`(표·원기) · `world/domains.gd`(입구·원판·도전·보상 나무·단계 창·안내 글자). 비경 셋 — 잠든 무덤(성유물, 폐허 (5,2.3)) · 옛 서당(특성 재료, 마을 (3.3,5.6)) · 쇠부리 터(무기 재료, 포구 (7.3,4.6)). 입구 3m 안 F(터치 "비경" 단추) → 단계 I·II·III(체력 ×1/2/3.5·공격 ×1/1.5/2.2, 부대 Lv 0/3/6 에 열림 — 옛 부대 레벨이 모험 등급 자리) → 세상 밖 원판(x -1400, 지름 36m, 보이지 않는 벽). 3초 뒤 파도 둘, 120초 안에 다 쓰러뜨리면 가운데 보상 나무 — 다가가면 **원기** 20 을 써서 받음(모자라면 못 받고 나감). 명단이 다 쓰러지거나(field_combat `party_wiped` 새 신호) 시간이 다 되거나 "나가기"면 실패(원기 안 씀), 2.5초 뒤 입구로. 비경 적은 field_enemy 그대로 — `scale_stats`·`respawns`·`drops` 칸(되살아나지 않고 전리품·경험 없음). 지맥 이상: 무덤 = 적이 물을 띤다(4초마다) · 서당 = 적을 쓰러뜨리면 명단 기력 +8 · 쇠부리 터 = 적 공격 ×1.3. 보상: 냥 1000~2600 + 무덤 ★4/★5 성유물(I 2/0 · II 2/1 · III 1/2, 세트 불꽃 무녀·물결 성자 번갈아)+연마석 · 서당 무예 쪽지~비전 · 쇠부리 강화석·무쇠 + 부대 경험 10~20. 원기 상한 160·실제 시각 8분에 1(`PartyState.resin`·`resin_t` 두 필드, SAVE_VERSION 3 그대로 — 진행 중 도전은 저장 안 함). 안에 있는 동안 그룹 `go_domain_active` — 지도(순간이동)가 안 열린다. 자동 점검 `tools/probe_domains.gd` 11항목 | — |

| ㉑ | **주간 보스** | `combat/field_boss.gd`(field_enemy 상속 — 패턴·2단계) + 비경 틀 그대로(`data/domains.gd` "weekly" 칸 · 입구 "먹구름 제단" 포구 (5.4,7.4)). 보스 "먹구름 이무기"(뇌, 체력 6000·공격 40, 단계 배율은 비경과 같음) 하나를 원판 가운데에, 180초. 패턴 셋 차례로(재사용 3.5초 → 2단계 2.4초): 내려찍기(둘레 5m 붉은 원 1.2초 예고, ×1.6) · 먹구름 벼락(플레이어 발밑과 양옆 3m 원 셋 r2.5, 1.0초, ×1.2 한 번만) · 물기(들판 적 돌진). 얼리면 예고가 멈춘다. 체력 50% 에서 2단계: 뇌 원소 방패 600×체력 배율(불 ×2.5, elements.gd 상성 그대로)·패턴 빨라짐. 안내 글자에 보스 체력 %·방패. 원기 60, 이번 주(월요일 새벽 4시 갈림) 처음 셋은 30 — `PartyState.weekly`(week·claims, 필드만 더해 SAVE_VERSION 3 그대로). 보상: 냥 2000~4000 + **뇌룡 비늘** 1/2/3 + 무예 교본·비전 + ★5 성유물 1/1/2(절연 깃발·떠돌이 무사) + III 인연 매듭 1. 특성 비용(growth.gd TALENT_WEEKLY): 7→8 비늘 1 · 8→9 2 · 9→10 2. 자동 점검 `tools/probe_weekly_boss.gd` 9항목 | — |

| ㉒ | **모험 등급·세계 등급** | `data/adventure.gd`(표·계산) · `world/adventure_rank.gd`(보상·변화 알림·낮추기). **모험 등급 = 옛 부대 레벨 + 1**(경험 100 마다 — 사건·상자·들판 적·의뢰·비경이 주던 부대 경험 그대로, 승급 3택도 그대로). **세계 등급 0~8** — 모험 등급 1·5·10·15·20·25·30·35·40(원신 20·25…55 를 이 판 경험 속도로 당김). 세계 등급마다 들판 적 체력·방패 +35%·공격 +22%(`field_enemy.apply_world_level` — 깎인 비율 그대로 바꿈, field_spawner 가 `PartyState.world_changed` 에 다시 앉힘), 머리 위 "Lv.N"(8·20·26·36·45·54·63·72·85), 전리품 냥 +25%·3 단계마다 그 밖 +1. 비경·주간 보스 적은 안 받음(단계 배율만). 한 단계 낮추기·되돌리기(의뢰판 U 맨 위 단추 — 등급 줄과 함께). 모험 등급이 오를 때마다 냥 2000·짧은 견문록 3·강화석 조각 2, 5 의 배수면 인연 매듭 1(`PartyState.ar_paid` — 옛 세이브는 불러온 등급으로 앉혀 지난 보상이 쏟아지지 않게). 비경 단계 잠금 부대 Lv 0/3/6 → 모험 등급 1/6/12. 왼쪽 위 글자 "Lv.N" → "모험 등급 N · 세계 등급 M". `wl_lowered`·`ar_paid` 두 필드(SAVE_VERSION 3 그대로). 자동 점검 `tools/probe_adventure.gd` 9항목 | — |
| ㉓ | **들판 보스** | `data/field_bosses.gd`(표) · `world/field_bosses.gd`(세우기·보상 꽃·보스 막대) — 몸·패턴은 주간 보스 틀 `combat/field_boss.gd`(2단계 방패 양·알림은 KINDS 칸 `phase_shield`·`phase_text`, 집으로 돌아가 체력을 채우거나 되살아나면 1단계 — `field_enemy._on_reset`). 셋: 마을 동쪽 숲 가장자리 (10,3.5) **돌개바람 수리왕**(풍, 새 틀, 체력 3000·공격 28, 2단계 풍 방패 400 ← 암) · 포구 동쪽 모래밭 (7,6.5) **물마루 거북왕**(수, 거북 틀, 3400·26, 450 ← 뇌) · 폐허 동쪽 뜰 (5,4) **잿불 도깨비왕**(화, 도깨비 틀, 3000·30, 400 ← 수) — 자리는 상자·무리·지점·별조각·비경 입구·사건 칸과 1칸+·반경 12m 평평(height_at 표본). 세계 등급을 받는다(들판 적과 같은 배율·Lv). 쓰러뜨리면 그 자리에 **보상 꽃**(보스 원소 빛) — 3m 안 F(터치 "보상 (F)" 단추)로 **원기 40**: 그 보스 재료 2 + 보스 원소 결정 1 + 냥 1800 + 짧은 견문록 2(세계 등급 `scale_loot`) + ★4 성유물 1 + 부대 경험 30. 모자라면 꽃이 남고, 받으면 150초 뒤 보스가 다시 선다(받기 전엔 쓰러진 채). 싸우는 동안(30m 안·쫓는 중, 비경 밖) 화면 위 가운데에 "Lv.N 이름 — 체력 %"·체력 막대·방패 막대. 지도·미니맵에 보스 표(신상을 켠 지역만). **돌파 2 단계부터 보스 재료** 2·4·8·12·20(`growth.gd ASCEND_COST boss`·`boss_of` — 주인공 돌개바람 깃, 동료 id 해시로 돌개바람 깃·물마루 진주·잿불 뿔). 저장 없음(SAVE_VERSION 3 그대로). 자동 점검 `tools/probe_field_bosses.gd` 10항목, 전투 점검 적 수 29 → 32 | — |
| ㉔ | **인물별 고유 스킬** | `data/kits.gd`(표) · field_combat `_kit_skill`·`_kit_burst`(원소 기본 스킬 대신) · go_player `skill_dash`·`launch_up`. 인물이 105 라 **대표 다섯부터** — 표에 없는 인물은 원소마다 같은 스킬 그대로(이름만 `ELEMENT_NAMES`). **나**(화·한손검): E 불꽃 돌진(앞 4.5m 돌진, 폭 2m 길 위 ×1.3, 무적, 6초) / Q 불새 깃(둘레 6m ×2.0 + 8초 기본·강·낙하 공격에 화 부여 ×1.2). **현책**(뇌): E 팔괘진(발밑 4.5m 진 10초 — 1.5초마다 가까운 둘 ×0.45, 맞힐 때마다 명단 기력 2, 인물을 바꿔도 남음, 12초) / Q 천기 뇌우(7m ×1.4 + 12초 명단 스킬 재사용 두 배로 돎·다른 인물 기력 +15). **해장**(화·법구): E 일제 포격(12m 안 적 셋 자리에 0.6초 뒤 포탄 2.5m ×1.0, 없으면 앞 8m, 7초) / Q 학날개 진(8m ×1.8 + 10초 명단 공격 +20%). **결사**(뇌·활): E 결사 방진(3.5m ×0.8 + 명단 보호막 최대 체력 25%·12초, 12초) / Q 오천의 맹세(7m ×1.6 + 10초 받는 피해 ×0.7). **도적 두목**(풍·활): E 회오리 도약(3.5m ×1.2 끌어당김 + 위로 솟구침 약 5m — 활공·낙하 공격으로, 8초) / Q 돌개바람 올가미(앞 7m 에 8초 소용돌이 5m, 0.5초마다 ×0.3·끌어당김 6). 폭발 기력은 모두 100 그대로. 특성 배율·운명의 자리(1 은 고유 재사용 대기에도 -20%)·치명타는 그대로 든다(진·포탄·소용돌이는 쓴 인물 몫으로 굴림). 켜진 효과는 왼쪽 위 상태 줄("화 부여 6초" 등), 인물 화면 특성 줄에 스킬 이름·마우스를 올리면 설명. 세이브 없음. 자동 점검 `tools/probe_kits.gd` 12항목(원판 위 허수아비), 전투 점검은 원소 기본 인물을 고유 없는 이로 | — |
| ㉕ | **이야기 임무** | `data/story.gd`(장·단계·인물 표) · `world/story_quest.gd`(진행·대화 창·목표 표시·임무 목록). 단계 type 여섯: talk(인물 3m F → 대화, 줄마다 F·Space·Enter·누르기, 고르는 줄은 대답만 다름) · go(반경 안 들기) · boss(들판 보스 쓰러뜨리기 — 이미 쓰러져 꽃을 기다리면 바로 넘김) · kill(임무 적 — 되살아나지 않음·전리품 없음·세계 등급) · light(옛 제단에 어느 원소든 스킬·폭발, element_receiver) · domain(그 비경 깨기). 임무 인물 셋이 늘 서 있다: 청하 촌장 누리(마을 (5.8,3.3)) · 늙은 사공 버들(포구 (4,4.65)) · 떠돌이 학자 은비(폐허 (3.1,2.35)) — 지금 단계가 아니면 혼잣말 한 줄. **제1장 먹구름이 오는 마을**(모험 등급 1, 일곱 단계: 촌장 → 동쪽 숲 끝 → 돌개바람 수리왕 → 사공 → 폐허 어귀 졸개 넷 → 학자 → 제단 → 촌장, 보상 인연 매듭 2·냥 1만·견문록 3·교본 2·부대 경험 100) · **제2장 먹구름 제단**(모험 등급 5, 학자 → 제단 가기 → 주간 보스 비경 → 촌장, 매듭 3·냥 2만·두꺼운 견문록·비전 1·경험 150). 단계마다 부대 경험 10. 표시: 목표에 금빛 기둥+"◆ 거리" · 미니맵 밑 추적 글자(장 이름·목표·거리, 잠기면 "모험 등급 N 에 열린다") · 지도·미니맵 금빛 마름모(미니맵 밖이면 가장자리) · O(터치 "임무") 목록. 보이는 창(승급 3택 등)이 떠 있으면 말을 안 건다. `PartyState.story` {ch, step} 한 필드(SAVE_VERSION 3 그대로) — 임무 적·제단은 저장 안 함(불러오면 그 단계 처음). 자동 점검 `tools/probe_story.gd` 13항목 | — |
| ㉖ | **갈래 스킬(고유 스킬을 도감 전원으로)** | `data/kits.gd` FAMILIES·ELEMENT_EXTRA·`kit_of()`(고유 → 갈래 → 원소 기본) · field_combat `_kit_extras`. 사당 시련이 ★3~4 187명 중 아무나 주므로 손으로 몇 명 더 짜 봐야 거의 안 만난다 → 인물 trait 가 틀, 원소가 이름·덧붙는 것. **무용**(might 84): E ○○ 돌격(앞 3.5m 돌진·무적, ×1.15, 7초) / Q ○○ 검기(5.5m ×1.8 + 8초 기본 공격 원소 부여 ×1.15). **통솔**(command 38): E ○○ 호령(10m 안 적 둘 자리에 0.6초 뒤 탄 2.2m ×0.95, 8초) / Q ○○ 군기(7m ×1.5 + 10초 명단 공격 +15%). **인덕**(virtue 30): E ○○ 방패(3m ×0.7 + 명단 보호막 20%·12초, 12초) / Q ○○ 맹세(6.5m ×1.4 + 10초 받는 피해 -20%). ○○ = 원소 앞말(불꽃·물결·번개·바람·서리·바위·덩굴) — 21칸 42 이름이 다 다름. 원소 덧붙임: 화 폭발 ×1.15 · 수 스킬 명단 회복 4%·폭발 8% · 뇌 다른 인물 기력 +3/+10 · 풍 스킬 재사용 -1.5초 · 빙 스킬 ×1.15 · 암 보호막 +12%(방패 틀이면 그 보호막에 더함) · 초 폭발 효과 +3초. **지략**(wisdom 96)은 원소를 그대로 다루는 이들이라 원소 기본 스킬 그대로(설명만 ELEMENT_TEXTS 로 채움). 고유 다섯은 갈래보다 한 단 위(그 갈래의 대표). 인물 화면 특성 설명 앞에 [무용]·[지략]·[고유]. 세이브 없음. 자동 점검 `tools/probe_kits.gd` 18항목(갈래 여섯 더함) | — |
| ㉗ | **이야기 셋째 장·대화 연출** | `data/story.gd` 제3장 · `world/story_quest.gd` 단계 type 둘 더(gather — 그 채집물 count 번, world/gathering.gd `gathered`·`nearest()` 가 목표 / cook — 아무 요리 한 번, world/kitchen.gd `cooked`, 가까운 솥이 목표) · `player/camera_rig.gd` `talk_shot`·`end_talk`. **제3장 · 잔칫날의 불청객**(모험 등급 7): 촌장 → 청하란 셋 → 요리 하나 → 사공 → 잿불 도깨비왕(들판 보스) → 학자(비문 둘째 조각 "가면 쓴 나그네") → 잠든 무덤(비경) → 잔치 마당 졸개 넷 → 촌장. 보상 인연 매듭 3·냥 25000·견문록(대) 2·특성 재료 3단 1, 장 경험 180. 채집 센 수는 저장 안 함(임무 적처럼 불러오면 그 단계 처음부터). **대화 카메라**: 말하는 이 얼굴(발 +1.45m)을 중심에 두고 듣는 이 어깨 너머(옆 22°·위 9°, 팔 = 두 사람 거리 + 1.7m)에서 — 인물 줄이면 인물, 고르는 줄·내 대답이면 나. 말하는 이가 바뀌면 부드럽게 옮겨 가고(지수 7/초), 끝나면 0.45초에 대화 전 각도·팔 길이로. 대화 중엔 끌기·마우스 시점·흔들림 안 받음, 팔이 내 몸에 걸리지 않게 그동안만 내 몸을 뺀다. 대화를 열면 나를 인물 쪽으로 돌려 세운다. 자동 점검 `tools/probe_story.gd` 13 → 22항목 | — |
| ㉘ | **이야기 넷째 장·따라가기** | `data/story.gd` 제4장·NPCS `wanderer`(appear·mask)·FOLLOW_* · `world/story_quest.gd` follow type·`npc_visible`·`_place_npcs`·`_ground_y`·`_add_mask`. **제4장 · 가면 쓴 나그네**(모험 등급 10): 촌장 → 남쪽 다리목 나그네 → 나그네를 따라 다리 건너 남쪽 들녘까지 → 나그네(진짜 범인은 따로, 그자도 가면을 쓴다) → 들녘 매복 졸개 넷 → 나그네(가면 조각을 주고 떠남) → 학자(제단은 다섯) → 촌장. 보상 인연 매듭 3·냥 30000·견문록(대) 2·특성 재료 3단 2, 장 경험 200. **나그네**: 4장 둘째~여섯째 단계에만 서 있고(모험 등급이 올라 장이 풀리는 순간에도 맞춰 보임), 따라가기를 지나면 길 끝에 선다. 흰 가면(눈구멍·붉은 줄)을 머리 뼈(J_Bip_C_Head)에 붙임. **따라가기**: 내가 12m 안이면 2.6m/초로 다음 길 점까지 걷고(걷기 애니), 멀면 서서 기다리며 30m 밖이면 추적 글자 "너무 멀다, 가까이!". 앞장서 걷는 동안은 말을 못 건다. 발 높이는 레이어 1 을 아래로 쏜 광선(다리 상판 위를 걷게, 나·적은 뺌). 길 진행은 저장 안 함(불러오면 길 처음부터). 자동 점검 `tools/probe_story.gd` 22 → 30항목 | — |
| ㉙ | **대화 몸짓** | 새 `world/talk_face.gd`(SkeletonModifier3D, VRoid 몸 하나에 붙음) · `world/story_quest.gd` 글자 흘리기(REVEAL_CPS 30)·`_begin_reveal`·`_finish_reveal` · `data/story.gd` 줄 셋째 칸 표정. **글자 흘리기**: 대사가 초당 30글자로 나오고 F·Space·누르기 한 번이면 줄 전체, 한 번 더면 다음 줄(원신처럼). **입 모양**: 나오는 한글 음절의 가운뎃소리 21 → VRoid 입 다섯(Fcl_MTH_A·I·U·E·O — ㅏㅑㅘ A · ㅣㅟㅢ I · ㅜㅠㅡ U · ㅐㅔ류 E · ㅓㅕㅗㅛㅝ O), 한글이 아니면 닫음, 한 글자 연 입은 0.14초쯤에 닫힘. **표정**: 줄 = [말하는 이, 글, 표정?] — joy·angry·sorrow·surprised·fun → Fcl_ALL_* 0.7(1~4장 13줄에 붙임). **눈 깜박임**: 늘 2.2~5초마다 0.14초. **손짓**: 말하는 동안 애니 위에 오른팔을 앞으로 들고(윗팔 38°·아랫팔 42°, 천천히 흔듦) 글자마다 조금 끄덕임 — 뼈대 공간 X 축 회전, 몸 앞이 ±Z 인지는 발목→발끝으로 잰다. 세기는 `influence` 로 섞어 켜고 끔. 나(플레이어)도 첫 대화 때 붙어 내 대답에 입·손짓. **이 일로 찾은 옛 버그**: `saga_forest_avatar_01` 은 뼈대 공간 앞이 -Z(나머지 둘은 +Z)인데 ① Mixamo 재타겟이 그걸 몰라 서기 자세에서 두 손이 머리 위(손 1.75m·머리 1.41m)·걷기 방향도 뒤집힘 ② 몸을 "앞 = +Z"로 돌리는 곳(VroidBody 인물·도적·FOREST 플레이어)이 등을 보였다. → `tools/mixamo_retarget.gd` 가 타깃이 뒤돌아 있으면 스윙·엉덩이 이동을 Y축 180° 로 켤레(애니 .res 는 로컬 전용이라 PC 마다 다시 돌려야 함) · `world/vroid_body.gd` `front_sign()`·안쪽 자식 180° · `player/player.gd`(FOREST 플레이어) 같은 보정 · 나그네 가면도 앞 방향 따라. 자동 점검 `tools/probe_story.gd` 30 → 31항목(입 모양 매핑·흘리는 중 입 열림·손이 몸 앞·위로·F 한 번이면 줄 전체·끝나면 제자리·표정·깜박임, 가면이 얼굴 쪽) | — |

| ㉚ | **이야기 다섯째 장·석등 차례·인물 자리 옮기기** | `data/story.gd` 제5장·`STATIONS`·`SEAL_MARKS`·`SEAL_LAYOUT`·`windows()` · `world/story_quest.gd` seal type·`_window_now`·`_place_npcs`(모든 인물)·`_seal_hit`·`seal_hint`·`_build_seal` · `world/elemental_sight.gd` 다음 석등. **제5장 · 서쪽 고개 옛길**(모험 등급 12): 촌장(학자가 사흘째 소식 없음) → 서쪽 숲 옛길 어귀(마을 (1.3,4.6)) → 학자를 에워싼 가면 졸개 넷 → 학자(옛길, (1.1,2.55)) → 둘째 제단 석등 차례(옛 사당 뒤 숲 (1.15,1.3)) → 제단에 몰려든 가면 무리 다섯 → 나그네(제단 곁에 다시 — 그자는 북쪽 봉우리 너머로 달아남, 비문 조각) → 학자(셋째 조각 "다섯 제단이 모두 깨면 먹구름의 주인이 돌아온다") → 촌장. 보상 인연 매듭 3·냥 35000·견문록(대) 3·특성 재료 3단 2, 장 경험 220. **seal**(원신 석등 차례 퍼즐): 제단 둘레 6m 에 석등 셋(해·달·별, 놓인 자리는 북쪽부터 달·별·해 — 비문 차례 해 → 달 → 별과 다름), 어느 원소든 스킬·폭발. 다음 차례 석등이 닿으면 그것만 켜지고(폭발이 셋에 다 닿아도 하나씩), 다음 차례가 아닌 것만 닿으면 다 꺼진다. 시간 제한 없음, 추적 글자 "n/3 (해 → 달 → 별)", 원소 시야가 다음 석등을 그 빛깔로 짚음. 켠 수는 저장 안 함. **인물 자리**: `appear`(보일 때만)·`STATIONS`(늘 있는 인물)가 {ch, from, to, region?, cell?} 한 칸 또는 여러 칸 — cell 이 있으면 그 단계 동안 거기 선다(학자는 5장 0~3 단계 옛길·4~7 단계 제단 곁, 나그네는 4장 칸 + 5장 여섯째 단계 제단 곁). 모험 등급이 올라 장이 풀리는 순간에도 옮겨 선다. **자리 고르기 함정**: 서쪽 숲은 신수 조우(백호 (1,3), 반경 16m)·여우굴·빈터·샘이 촘촘해 처음 잡은 옛길 자리가 백호 원 안이었다 — 조우 창이 떠 대화가 막힘 → 22m 북쪽으로. 점검이 새 자리마다 나무 줄기(vegetation_builder 해시)·신수 조우 원 여유를 잰다. 자동 점검 `tools/probe_story.gd` 31 → 41항목 | — |

| ㉛ | **이야기 동료·고유 스킬 둘·편성** | `data/story.gd` MEMBERS·`member()`·장 `join` · `data/kits.gd` KITS 둘 · `combat/elements.gd`·`data/weapons.gd`(이야기 동료는 표로, 해시 아님) · `combat/field_combat.gd` blink·echo·lore·`_marks`·`_lore_t`·`_hero_of` · `world/story_quest.gd` `_join`·`_join_past` · `data/party_state.gd` `put_in_party`·`in_party` · `ui/character_screen.gd` 편성 단추·⚔. 원신처럼 **이야기가 인물을 준다** — 도감(saga_core, id 불변) 밖 id 라 다른 판에 안 샌다: **학자 은비**(`story_scholar`, ★4·초·법구, 2장 끝) · **가면 쓴 나그네**(`story_wanderer`, ★5·빙·한손검, 5장 끝). 동료가 돼도 세상엔 임무 인물로 계속 선다. 이 기능 전에 그 장을 끝낸 세이브는 불러올 때 조용히 들어온다. **은비** E 비문 탁본(발밑 4.5m 9초 — 1.5초마다 적 넷까지 ×0.35 초 부착·맞힐 때마다 명단 기력 1.5, 10초) / Q 옛 글자 풀이(7.5m ×1.3 + 12초 명단 원소 반응 피해 ×1.4 — `_reaction_mul` 에 곱). **나그네** E 그림자 걸음(10m 안 가까운 적을 지나 그 뒤 1.5m 까지 skill_dash — 충돌·무적 그대로, 도착 둘레 2.5m ×1.5, 그 적에 8초 표식: 명단 누구에게든 피해 ×1.25, 7초) / Q 가면 벗기(6m ×1.6 + 15m 안 표식 난 적마다 0.3초 간격 메아리 셋 ×0.7 — 적을 따라감, 표식 난 적이 없으면 가까운 둘). 상태 줄 "반응 +40%"·"표식 n". **편성**: 옛 들판 명단은 늘 나 + members 앞 셋이라 넷째부터 들어온 동료는 싸움에 못 나왔다 → 인물 화면 "⚔ 들판 명단에 넣기"(members 맨 앞으로, 셋째 자리가 빠짐 — 순서가 그대로 저장, 스키마 그대로), 목록에 ⚔ 표시. 합류 알림에 명단이 차 있으면 편성 안내. 자동 점검 `tools/probe_kits.gd` 18 → 23항목 · `tools/probe_story.gd` 합류·지난 장 합류(두 번 불러도 한 명) | — |

| ㉜ | **이야기 여섯째 장·봉우리 오르기·이야기 보스** | `data/story.gd` 제6장·climb·duel·CLIMB_SLACK · `world/story_quest.gd` climb·duel(`go_story_boss`)·DUEL_FALL · `combat/field_enemy.gd` KINDS `black_mask`(vroid·mask·rotation·summon) · `combat/field_boss.gd` def `rotation`·그림자·`_summon` · `world/field_bosses.gd` 위 보스 막대가 이야기 보스도 · `world/vroid_body.gd` `add_mask`(story_quest 에서 옮김, 빛깔 인자). **제6장 · 북쪽 봉우리의 검은 가면**(모험 등급 15): 학자(셋째 제단은 봉우리 꼭대기, 길 없음) → 북쪽 봉우리 꼭대기로 오르기(마을 (7.1,1.5) 고원 12m — 벽 타기·활공) → 봉우리의 나그네(그림자 경고) → **검은 가면** → 나그네(가면에 금, 먹구름 속으로 달아남·비문 조각) → 셋째 제단 다시 밝히기 → 봉우리에 올라온 학자(넷째 조각 "먹구름 임금은 다섯 제단에 나뉘어 잠들었다, 가면은 임금의 신하의 표식") → 촌장. 보상 인연 매듭 4·냥 40000·견문록(대) 3·특성 재료 3단 2, 장 경험 240. **climb**: 반경 안 + 발이 그 자리 땅 높이 - 2.5m 보다 위(밑 골짜기에선 안 넘어감). **duel / 검은 가면**: field_boss 틀, 사람 몸(VRoid ★5 검은 옷)+검은 가면(보랏빛 줄), 체력 4200·공격 32·뇌. 패턴 차례 그림자 → 벼락 → 물기 → 내려찍기 → 그림자 → 물기. **그림자** = 플레이어 등 뒤 2.2m 로 옮겨 붙어 둘레 3.2m 0.8초 예고 ×1.4(나그네 그림자 걸음의 거울). 절반에서 뇌 방패 520(불 ×2.5)+가면 졸개(도적) 둘, 쓰러뜨리면 졸개도 흩어진다. 한 번뿐·전리품 없음·세계 등급, 위 보스 막대. 봉우리에서 떨어져 집보다 5m 아래면 봉우리로 되돌린다. 자리: 봉우리는 나무 없는 산 칸이라 바위(시각만) 해시로 여유 23m, 현무 조우 원 여유 13.9m. 점검 `tools/probe_story.gd` 50항목(6장 아홉 — 풀림·자리 여유·골짜기에선 안 넘어감·꼭대기·보스 막대·가면·그림자 등 뒤 2.20m·떨어지면 되돌림·2단계 방패+졸개 둘·졸개 흩어짐·제단·학자·✔ 제6장) | — |

| ㉝ | **편성 — 넣기·빼기·자리 순서** | `data/party_state.gd` PARTY_MAX·`party_size`·`party()`·`put_in_party`·`remove_from_party`·`move_up_in_party`·`recruit` 빈자리 채움 · `combat/field_combat.gd` roster = 나 + `party()` · `data/save_state.gd` "party_size" 한 칸(없으면 3 — 버전 그대로) · `ui/character_screen.gd` 명단 한 줄·넣기/빼기·◀ 앞 자리로 · `world/test_village.gd` 점검(SAGA_*_PROBE)이면 자리 수 3. 명단 = 나(늘 첫 자리, 못 뺌) + members 앞 party_size 명 — 자리 순서가 members 순서(숫자키 2·3·4)라 세이브 모양은 그대로. 넣기: 빈자리면 거기, 꽉 찼으면 마지막 자리와 바뀜. 빼기: 자리가 비고 명단이 줄어듦(원신처럼 넷보다 적게). 빈자리가 있으면 새로 들어온 동료가 저절로 채움(옛날 "셋 찰 때까지 저절로"와 같게). 인물 화면 가운데 위 "들판 명단: 1 나 · 2 … · 3 … · 4 (빈자리)" 한 줄, 고른 인물에 "⚔ 넣기/빼기"(꽉 찼으면 누구와 바뀌는지)·"◀ 앞 자리로". 점검은 실제 세이브를 불러온 채 명단을 바꿔 끼우므로 test_village 가 자리 수를 3 으로 되돌린다(저장 안 함). 자동 점검 `tools/probe_kits.gd` formation(바꿈·빼기·빈자리 합류·앞으로·나 못 뺌) | — |

| ㉞ | **이야기 일곱째 장·제단 지키기·검은 가면 둘째 대결** | `data/story.gd` 제7장·defend·DEFEND_START/RING/WAVE_SEC·duel `flee` · `world/story_quest.gd` defend(SiegeAltar 체력·물결·무너지면 처음부터+쉬는 틈 4초) · `combat/field_enemy.gd` `siege`(지킬 것 — 곧장 가서 침, 내가 SIEGE_PULL 5m 안이면 나)·KINDS `black_mask_tide` · `combat/field_boss.gd` 패턴 `tide`(밀물) · `world/vroid_body.gd` `add_mask(crack)`. **제7장 · 물마루 곶의 넷째 제단**(모험 등급 18): 학자(넷째 제단 = 포구 서쪽 물마루 곶) → 사공(밤마다 가면 무리가 곶으로) → 곶(포구 (3.0,4.5)) → 나그네(그자가 무리부터 보냈다) → **제단 지키기** → **금 간 검은 가면** → 나그네(깨진 가면 반쪽 아래 얼굴을 알아본 듯 — 다음 장 떡밥) → 넷째 제단 다시 밝히기 → 사공(불이 켜지자 바다 건너 섬에도 불빛 — 다섯째 제단) → 촌장. 보상 인연 매듭 4·냥 45000·견문록(대) 4·특성 재료 3단 2, 장 경험 260. **defend**(원신 장치 지키기): 제단 체력 1200 × 세계 등급 공격 배율, 내가 25m 안에 들면 첫 물결, 물결을 다 잡거나 28초가 지나면 다음(셋 — 도적 둘·물거북 / 도적·불도깨비·물거북·번개살쾡이 / 도적 둘·바위곰·눈여우), 둘레 15m 에서 나와 제단으로 곧장. 반쯤 깎이면 경고, 무너지면 무리가 물러가고 그 단계 처음부터(4초 쉼). 제단 위 "넷째 제단 N%" 글자(초록→빨강), 추적 글자 "제단 a/b · 물결 n/3". **금 간 검은 가면**: 체력 4800·공격 34·**물**, 가면 왼쪽에 흰 금. 패턴 차례 밀물 → 그림자 → 물기 → 밀물 → 내려찍기 → 그림자. **밀물** = 보스에서 나를 향해 원 넷(2.5m 부터 3m 간격, 반경 2m) 1.1초 예고 ×1.3 — 옆으로 비킨다. 절반에서 물 방패 560(뇌 ×2.5)+졸개(도적·물거북). 한 번뿐·전리품 없음·세계 등급. 자리: 늙은 어부 부탁 반경(14m)에 걸리면 부탁 창이 대화를 막아(처음 자리 (2.4,4.45)에서 실제로 막힘) 어부·게·표류물·조각배에서 25m 넘게 떨어뜨림. 점검 `tools/probe_story.gd` 62항목(7장 열셋 — 풀림·자리 여유(신수 원·포구 사건 반경·물결 자리 전부 뭍)·멀면 물결 안 나옴·첫 물결이 제단을 침·시간/전멸로 다음 물결·무너지면 처음부터·금 간 가면·밀물 원 넷 줄지어·2단계·✔ 제7장) | — |

| ㉟ | **이야기 동료 둘 더 — 치유·협동 공격** | `data/story.gd` MEMBERS `story_elder`·`story_ferryman`, 제6장·제7장 join·끝 대사 한 줄씩 · `data/kits.gd` KITS 둘·스킬 gust/wave·폭발 feast/rain · `combat/field_combat.gd` `_kit_skill` gust·wave, `_kit_burst` feast·rain, 효과 `kit_feast`, `_rain_follow`(기본·강·낙하 공격이 맞은 뒤)·상태 줄 "뱃노래 N초". 명단에 없던 역할 둘(원신 치유·협동 공격). **촌장 누리**(★4·풍·법구, 6장 보상): E 부채 바람 — 앞 6m 부채꼴(내적 0.2) ×1.1·밀어냄 7·명단 모두 체력 6%, 재사용 8초 / Q 잔칫날 순풍 — 둘레 6m ×1.2, 10초 바람 자리: 1초마다 안에 선 지금 인물 5% 회복·안의 적 풍 ×0.25. **사공 버들**(★4·수·장병기, 7장 보상): E 노 물결 — 앞으로 9m·폭 2m ×1.4·앞으로 밀어냄 6, 재사용 9초(나는 제자리) / Q 뱃노래 — 둘레 5m ×1.1, 15초 동안 명단 누구든 기본·강·낙하 공격이 맞으면 1초에 한 번 8m 안 가까운 적 둘에 물 노 ×0.4(수 부착 — 반응 잇기, 버들 치명타). 세상의 임무 인물은 그대로 서 있다(npc). 이미 6·7장을 끝낸 세이브는 불러올 때 조용히 합류(_join_past). 점검 `tools/probe_kits.gd` ㉔ elder_heal(부채꼴 밖 적은 안 맞음·밀림 방향·명단 +6%·바람 자리 두 번 회복) ㉕ ferryman_rain(길 위·앞으로 밀림·수 부착·기본 공격 뒤 따라 치기 1초 쉼·둘) · probe_story 6·7장 끝 합류·지난 장 합류 | — |

| ㊱ | **편성 여러 벌 — 원신 파티 1~4·싸우는 중 막음** | `data/party_state.gd` PRESET_COUNT·`presets`·`preset_i`·`use_preset`·`preset_party`·`restore_presets`, `_set_party` 가 지금 칸에 적음 · `data/save_state.gd` "party_presets"·"party_preset"(없으면 지금 명단이 1번 — 버전 그대로) · `combat/field_combat.gd` `in_combat()`(쫓거나 치는 적이 30m 안, 쉬는 적·제단만 치는 적 빼고) · `ui/character_screen.gd` "편성 1~4 (N명)" 단추 줄·`use_preset`·`_combat_blocked`. 칸마다 나를 뺀 명단(셋까지). 지금 명단은 늘 지금 칸과 같고(넣기·빼기·앞으로·새 동료 합류가 그대로 적힘), 다른 칸을 누르면 지금 명단은 지금 칸에 남고 그 칸 명단이 들판 명단(없는 동료·겹침은 뺌), 지금 인물은 첫 자리(나)로. 빈 칸이면 나 혼자(원신처럼). **싸우는 중엔 막는다**(원신 규칙, ㉝ 때 "지금은 안 막음"으로 남긴 빈틈) — 칸 바꾸기·넣기·빼기·앞으로 모두 "싸우는 중에는 편성을 바꿀 수 없다". 점검 `tools/probe_kits.gd` ㉖ presets(옛 세이브 = 지금 명단이 1번·빈 칸이면 나 혼자·넣기가 그 칸에·돌아오면 옛 명단·같은 칸 무시·세이브 왕복·쫓는 적 30m 안이면 막힘·멈추면 바뀌고 첫 자리) | — |

| ㊲ | **이야기 여덟째 장·앞바다 바위섬·도둑 쫓기·배** | `data/test_map.gd` 포구 (6,2) `K` · `world/terrain_builder.gd` LEGEND K·ISLET_RISE/TOP_R/SHORE_R/BUMP·vertex_height 둥근 둔덕·물도 깜 · `world/star_shards.gd` c_sea_e (6,2)→(7,3) · `world/waypoints.gd` c_isle "앞바다 바위섬" · `data/story.gd` 제8장·chase·sail·CHASE_*·NPCS haesol·STATIONS ferryman·7장 "먼 섬"→"앞바다 바위섬" · `world/story_quest.gd` chase(`_chase_tick`·`_build_thief`)·sail(`_sail`, 사공에게 F)·NPC 가면 빛깔/금. **섬 자리**: 새 지역을 짓지 않고 포구 바다 칸 하나를 지형 글자 K 로 — 기준 높이 = 바다 밑(-3, 가장자리 절벽 없음), 가운데로 6m 둥글게 솟아 꼭대기 약 3.2m·물 위 반지름 약 16m·꼭대기 평지 약 7.7m. 선착장에서 약 80m, 모래밭에서 약 55m(헤엄쳐도 됨). **제8장 · 바위섬의 다섯째 제단**(모험 등급 20): 촌장 → 사공(노를 도둑맞음) → **노 도둑 쫓기** → 사공 → **배**(섬 남쪽 물가, 곁 신상이 켜짐) → 섬 꼭대기 가면 무리 → 나그네(검은 가면의 참이름 해솔 — 옛 동무) → 석등 별→달→해(해솔의 노래) → **해솔**(가면 반쪽 깨짐: "다섯 제단은 임금을 가둔 자물쇠 — 먹구름 위 여섯째 자리에서 기다리마") → 나그네 → 배로 포구 → 촌장. 보상 인연 매듭 4·냥 50000·견문록(대) 4·특성 재료 3단 3, 장 경험 280. **chase**: 도둑이 7m/초로 길 점 일곱을 달리고 점마다 0.7초 숨 고르기(평균 약 5.8m/초 — 걷기 6 이면 거리가 안 줄고 달리기 10 이면 잡힘), 14m 안에 들면 출발·2.5m 안이면 잡음·길 끝이면 처음 자리로. 길은 포구 동쪽 물가(어부·표류물·조각배 반경 밖, 여유 15m). **sail**: 사공에게 F → 한 줄 뒤 그 자리로(화면 전환 없이 알림 글자). 섬에 있는 동안 사공은 배 댄 자리에 서고, 돌아올 땐 그 사공에게. 점검 `tools/probe_story.gd` 75항목(8장 열셋 — 섬 높이·배 댄 자리 물 위·옮긴 별조각 물 위·자리 다 뭍·도둑 길 사건 여유·도둑 평균 속도·출발·놓치면 처음으로·잡기·배·신상 켜짐·섬 무리·석등 뭍·별달해·해솔 가면 금·돌아오는 배·✔ 제8장) | — |
| ㊳ | **이야기 아홉째 장·구름섬·바람 기둥·먹구름 임금** | `world/sky_isle.gd`(새 — 구름섬·바람 기둥·먹구름 덮개) · `player/go_player.gd` `updraft`/`in_updraft`·UPDRAFT_MIN_CLEARANCE · `data/story.gd` 제9장·sky type·NPCS haesol_free(`body` 칸)·wanderer 9장 칸·MEMBERS story_haesol · `world/story_quest.gd` `_cell_pos(…, sky)`·sky 단계·구름섬 무리 떨어지면 제자리·DUEL_CLEAR · `combat/field_enemy.gd` KINDS haesol_mask·storm_king·`size`/`body_r`/`crown`/`mask_face` · `combat/field_boss.gd` 패턴 halo · `world/vroid_body.gd` `add_crown` · `data/kits.gd` story_haesol. **하늘 자리 결정**: 세상 밖 원판이 아니라 **봉우리 위 구름섬**(세상 안) — 마을에서 올려다보이는 표지가 되고, 끝나면 활공으로 곧장 마을에 내려온다(원신 바람 기류·활공 문법). **구름섬**: 섬 가운데 마을 (7.1,1.0), 윗면 = 봉우리 (7.1,1.5) 땅 + 40m(약 52m), 반지름 14m 평평한 풀밭 + 밑은 거꾸로 선 바위 뿔(충돌), 둘레 낮은 돌 난간 1m(적은 못 넘고 나는 넘는다 — 턱 넘기 1.3m), 북쪽 끝 여섯째 자리 돌 단(장식). 9장이 끝나기 전엔 위에 먹구름 덮개, 끝나면 걷힘. **바람 기둥**: 봉우리 꼭대기 반지름 3.5m, 섬 윗면 + 9m 까지. 9장이 풀린 뒤부터 늘(끝나도 남아 다시 오른다). 기둥 안 공중(뛰어올랐거나 발밑 1m 이상)이면 저절로 활공하고 9m/초로 솟는다, 손을 떼면 앞으로 흐르지 않는다(기둥 밖으로 안 밀림). 땅에 선 채로는 안 뜬다. 기둥 안에서 점프로 접으면 기둥을 나갈 때까지 다시 안 편다. 기둥 끝~섬 가장자리 10m 는 활공으로. **제9장 · 먹구름 위 여섯째 자리**(모험 등급 25, 이야기 1부 마무리): 학자(끝 구절 '다섯 불이 모이는 곳, 봉우리 위 하늘') → 북쪽 봉우리 꼭대기 → 나그네(바람 기둥) → **바람 기둥 타고 구름섬에** → 섬 무리 넷(회오리매·번개살쾡이 둘·도적) → **먹구름 가면 해솔**(뇌, 체력 5400·공격 36, 그림자·벼락·밀물·물기·내려찍기, 절반에서 뇌 방패 600+회오리매·번개살쾡이) → 가면 벗은 해솔 → **먹구름 임금**(뇌, 사람 몸 1.9배·왕관·어두운 가면, 체력 9000·공격 40, 내려찍기·고리·벼락·물기·그림자·밀물, 절반에서 뇌 방패 800+졸개 둘) → 나그네와 해솔 → 해솔(난간 넘어 활공) → **활공해 마을로**(촌장 곁 20m) → 촌장. 보상 인연 매듭 5·냥 60000·견문록(대) 5·특성 재료 3단 4, 장 경험 320, **해솔 합류**(★5 뇌·양손검, E 먹구름 벼락 = shells 셋·Q 가면 없는 노래 = 뇌 부여 10초). **고리(halo)**: 보스 둘레 3~9m 고리 1.3초 예고 ×1.5 — 보스 곁(3m 안)으로 파고들거나 9m 밖으로. **겹침 함정**: 대결 보스가 내가 선 자리에 생기면 몸이 겹쳐 서로 밀어 올려 둘이 20m 솟았다 → 내가 4m 안이면 나에게서 4m 떨어뜨려 세운다(6·7장 대결도 같이). 구름섬 무리·보스가 떨어지면(집보다 5m 아래) 제자리로. 신수 조우는 구 모양 Area3D 라 40m 위 섬엔 안 걸림. 점검 `tools/probe_story.gd` 75 → 87항목(9장 열둘 — 섬 밑 지형·기둥 둘레·기둥~섬 틈 10m·들판 적 184m·땅에선 안 뜸·저절로 활공·섬보다 위로·접으면 안 폄·섬 무리·떨어지면 제자리·해솔 금·2단계 졸개·가면 벗은 해솔·임금 1.9배·왕관·고리 6m 맞고 1.5m·11m 안 맞음·마을에 내려오면 넘어감·해솔 합류·먹구름 걷힘) | — |
| ㊴ | **세계 임무 셋(곁가지)·따라가는 임무 바꾸기** | 새 `data/world_quests.gd`(인물 일곱·임무 셋) · `world/story_quest.gd` 세계 임무 칸(`track`/`set_track`/`wq_step`/`_wq_for_npc`/`_advance_wq`·`_npc_info`·`_window_now` wq 칸·푸른 ! `QuestMark`·목록 오른쪽 칸+따라가기 단추·`_advance_later`·코드 몸 `_drone_body`·chase `caught`/`body`) · `data/party_state.gd`·`data/save_state.gd` `world_quests` 한 필드(SAVE_VERSION 그대로). **엔진**: 이야기 임무와 같은 단계 엔진을 쓰고 '따라가는 임무' 하나만 목표·추적 글자·임무 적을 세운다(원신 임무 추적). 맡는 법 = 머리 위 푸른 ! 인 사람에게 F — 그 임무가 시작되고 따라가는 임무가 된다. 따라가지 않는 임무도 다음 단계가 대화면 그 사람에게 말을 걸어 잇는다(그 순간 그 임무로). 세계 임무를 따라가는 중에 이야기 인물에게 말을 걸면 이야기로 넘어가 대화가 이어진다. O 목록 오른쪽에 세계 임무 칸과 따라가기 단추(맡은 게 있을 때). 끝나면 이야기 임무로 돌아간다. 바꾸면 그 단계 처음부터(임무 적·제단은 저장 안 함 — 이야기와 같은 규칙). 불 켜기·석등 끝의 0.8초 뒤 넘김은 그 사이 따라가는 임무·단계가 바뀌면 안 넘긴다(엉뚱한 임무가 넘어가던 틈). **전체 퓨전**(SAGA-DESIGN §12·§13): 임무마다 과거·현대·미래 인물이 한 자리에, 이름 옆 작은 글씨로 시대. **① 바람에 흩어진 편지**(마을, 모험 등급 3): 역참지기 묵호(과거) → 배달꾼 다래(현대) → 편지 물고 달아나는 배달 기계 둥실이(미래, 코드로 그린 몸) 쫓기 → 둥실이 → 북서쪽 숲 언덕 돌개바람 둥지 셋 → 묵호(봉투 도장이 세 시절). 냥 12000·견문록 2·매듭 1. **② 세 시절의 등대**(포구, 8): 바다 연구원 물결(현대) → 동쪽 모래톱 옛 등대 터 → 등대 지기 한빛(미래 기계) → 무리 셋 → 옛 봉수대(과거) 불 → 물결. 냥 15000·견문록 3·매듭 1. **③ 폐허의 시간 틈**(폐허, 12): 시간 탐사대원 별이(미래) → 틈 괴물 셋 → 별이 → 옛 석공 돌쇠(과거) → 석등 달→해→별 → 제단 지키기 두 물결 → 돌쇠 → 별이. 냥 18000·견문록 3·교본 2·매듭 1. 단계마다 부대 경험 8, 끝에 60~80. **자리 함정**: 마을 들판은 사건 원(반지름 16m)·역사 인물(18m)·신수(16m)가 칸 가운데마다 있어 첫 자리 셋이 다 걸렸다(지도 조각 사건 (4,4)·포구 봉수대 (7,7)·폐허 봉수대 (5,1)·결사 (5,5)) — 반 칸 자리(x.5)로. 점검 새 `tools/probe_world_quests.gd` `SAGA_WQ_PROBE=1` 12항목(표·세 시대·모험 등급 잠김·자리 여유(사건 원·나무 줄기·이야기 인물·물결 둘레)·맡기·코드 몸 쫓기·따라잡기·둥지·따라가기 바꾸기와 이야기 인물 대화·끝·보상·등대(불 켠 직후 바꿔도 안 넘어감)·시간 틈(틀린 차례 꺼짐·지키기)·다 끝남) | — |
| ㊵ | **활 조준 사격·과녁 잠금** | 새 `combat/aimed_shot.gd`(조준·충전·화살·급소·조준점 HUD) · 새 `world/shoot_target.gd`(과녁) · `combat/field_combat.gd` `_act`(키·터치 한 입구)·`press_attack`/`release_attack`·길게 누르기 → 조준·`nearest_target`·`force_crit`·"R 조준"/"조준" 단추 · `player/camera_rig.gd` `set_aim`·`_aim_turn` · `player/go_player.gd` `aiming`·`can_aim` · `world/treasure_chest.gd` 잠금 target·석등 `arrow_stop` · `world/treasure_spawner.gd` 둘 · `world/elemental_sight.gd` 과녁. **조준**: 활 인물만 R(터치 "조준", 공격 단추 위) — 오른 어깨 너머(팔 2.4m·옆 0.62·위 0.55·화각 40, 위아래 -60~+50°, 시점 0.6배로 곱게), 제자리·몸은 카메라 쪽, 걷기·점프·대시·활 아닌 인물로 바꾸면 풀림. 조준 밖에서 활 인물이 공격을 0.4초 길게 누르면 강공격 대신 조준으로 들어가 충전, 떼면 쏘고 나온다(원신 활 강공격). **충전**: 누르는 동안 1.4초 — 덜 차면 물리 ×0.45, 다 차면 인물 원소 ×1.25(기본 공격 특성·원소 부여 배율 그대로), 쏘는 틈 0.3초. **화살**: 물리 몸체 없이 60m/s·중력 4(쏠 때 떨어지는 만큼 들어 올려 조준점에 정확히), 1.6초. 땅·벽(레이어 1 광선), 들판 적은 보이는 몸 높이 원기둥(물리 캡슐이 짐승 몸보다 작아서 — 반지름 max(body_r, 높이×0.28)), 과녁은 판 둘레 공 0.75m, 석등 머리(`arrow_stop` meta). 적 몸 위 70% 부터 **급소** = 반드시 치명타("급소!"). 충전 화살은 멈춘 자리 1.2m 로 element_receiver(석등·옛 제단) — 멀리서 석등 켜기. 맞히면 기력 5·뱃노래 따라 치기. **과녁 잠금**(상자 잠금 넷째): 과녁 셋, 하나 맞으면 10초 금빛 — 셋 다 켜지면 봉인 풀림(켜진 채 남음). 법구·활 기본 공격도 둘레 적이 없으면 사거리 안 과녁을 친다(이야기 동료에 활잡이가 없어서 — 학자·촌장 법구로도 풀림). 포구 (5.6,5.4) 정교(기둥 3·5.5·8m) · 폐허 (3.9,5.2) 진귀(셋째는 기둥 없이 떠서 ±2.5m 오감, 4초) — 상자 18·봉인 7, 적 무리·다른 상자와 20m+. 원소 시야에 안 맞힌 과녁 흰빛. **터치 버그 고침**: 전투 단추가 `Input.action_press` 만 불러 `_unhandled_input` 이 안 불렸다(그 함수는 입력 이벤트를 안 만든다) → 공격·스킬·폭발·대시가 폰에서 안 먹었다. 단추가 `_act` 를 바로 부른다. 조준 중엔 어느 손가락으로 끌어도 시점이 돈다. 자동 점검 `tools/probe_archery.gd`(`SAGA_ARCHERY_PROBE=1`) 17항목 | — |
| ㊶ | **지도에 임무 표식** | `world/story_quest.gd` `map_marks`·`_step_target`(target_pos 를 단계마다로 — 안 따라가는 임무는 쫓기 도둑·임무 적 대신 그 단계 칸) · `ui/world_map.gd` `draw_quest_icon`·`is_tracked_kind`·`quest_marks`·`select_mark`·`track_selected`·`nearest_active_point`·범례·"따라가기" 단추. **표식**(원신 문법 — 이야기 금빛·세계 임무 푸른빛): 따라가는 임무 = 찬 마름모(미니맵에선 멀면 가장자리에 붙음) · 맡았지만 안 따라가는 임무 = 빈 마름모(그 단계 자리 — 대화면 그 사람, 쫓기면 길 첫 점) · 맡을 수 있는 세계 임무 = 둥근 판 "!"(맡길 사람 자리, 모험 등급이 닿은 것만) · 세계 임무를 따라가는 동안의 이야기 임무 = 금빛 빈 마름모. 빈 마름모·"!" 는 신상을 안 켠 지역(구름)엔 안 그림, 미니맵에선 둘레 안일 때만. **지도에서 고르기**: 표식을 누르면 아래 칸에 임무 이름·지금 할 일·가까운 켠 순간이동 지점(거리) — "따라가기"(안 따라가는 임무·이야기, 맡기 전 "!" 는 막힘) · "가까운 지점으로 순간이동". 세이브 그대로. 자동 점검 `tools/probe_quest_map.gd`(`SAGA_QMAP_PROBE=1`) 8항목 | — |
| ㊷ | **낚시** | 새 `data/fishing.gd`(표) · 새 `world/fishing.gd`(낚시터·물고기 그림자·찌·낚싯대·줄다리기·낚시 조합) · `data/party_state.gd`·`data/save_state.gd` `fishing` 한 필드 · `data/growth.gd` 물고기 여덟 가방 이름 · `data/weapons.gd` `w_polearm_catch` · `ui/world_map.gd` `draw_fish_icon`. **낚시터 넷**: 마을 강가 서·동(서는 칸 (3.4|7.3, 6.42) → 물고기 도는 물 (…, 6.62)) · 포구 선착장 곁 (5.0,3.62)·서쪽 갯가 (2.0,3.62) — 물고기 다섯씩, 잡은 자리는 30분(실제 시각) 뒤 다시(`fishing.gone`). **물고기 여덟**(세 시대): 마을 은비늘 붕어★·청하 쏘가리★★·태엽 잉어★★★ / 포구 갯바람 전어★·등불 복어★★·강철 넙치★★·네온 갈치★★★·옛 달 해파리★★★. **미끼 셋** = 채집 재료 하나씩(꿀꽃·산사과·짐승 고기, 던질 때 하나) — 물고기마다 좋아하는 미끼 하나. **흐름**(원신 문법): 둘레 3m 에서 F(터치 "낚시") → 얼림·낚싯대·물 위 고리(이동 키로 서는 자리에서 4~14m, 물 위만) · 1~3 미끼 → F·왼쪽 던지기 → 둘레 4m 의 그 미끼 물고기가 다가와 1~3번 건드림(이때 당기면 달아나 8초 안 옴) → 입질 1초 안 당기기 → 줄다리기: 누르면 찌가 오르고(가속 2.6·최대 1.2/s) 떼면 내려감, 물고기 칸(너비 0.28~0.15, ★ 높을수록 좁고 빨리 옮김) 안이면 막대 +, 밖이면 − · 0.3 에서 시작, 1 = 잡음(부대 경험 2·4·8), 0 = 놓침 · 15초 안 오면 "오지 않는다". 맞으면·Esc·오른쪽("그만") 끝, 싸우는 중엔 못 들어감. **낚시 조합**(포구 (4.5,3.8) 게시판 F): 갯바람 작살(★4 장병기, 전어 6·복어 3·넙치 2 — 처음 얻고 뒤엔 재련) · 냥 3000(붕어 3 / 전어 3) · 견문록 2(쏘가리 2) · 정련 강화석(태엽 잉어 1) · 인연 매듭(갈치·해파리 1씩). 지도·미니맵에 낚시터(신상 켠 지역). 자동 점검 `tools/probe_fishing.gd`(`SAGA_FISH_PROBE=1`) 11항목 | — |
| ㊸ | **업적** | 새 `data/achievements.gd`(표) · 새 `world/achievements.gd`(셈·알림·받기·화면 Y) · `combat/aimed_shot.gd` `weak_hit` 신호 · `data/party_state.gd`·`data/save_state.gd` `achievements` 한 필드. **업적 스물둘·단계 예순셋**, 갈래 다섯: 세상 곳곳(상자 5·10·18 · 별조각 5·12·20 · 순간이동 지점 3·6·8 · 신상 레벨 2·5·10 · 탐험도 100% 지역 1·3) · 싸움의 길(적 20·100·300 · 원소 괴물 5·20·60 · 보스 1·5·15 · 비경 1·5·15 · 급소 화살 1·10·30) · 원소의 이치(반응 10·50·200 · 반응 가짓수 4·8·14 · 쇄빙 1·10 · 확산 1·20) · 살림살이(채집 20·60·150 · 요리 1·10·30 · 맛있는 요리 1·5·15 · 물고기 1·10·30 · 물고기 가짓수 3·5·8) · 이야기(장 1·5·9 · 세계 임무 1·2·3 · 모험 등급 5·10·20). **셈**: 신호로 세는 것(적 `died` — 나중에 생기는 적도 `node_added` 로 붙음, 반응 `reacted`, 채집·요리(맛있는 = 품질 2)·낚시·비경 cleared·급소)은 stats 에 쌓고, 나머지는 이미 있는 상태에서 읽는다(DERIVED). 0.5초마다·신호마다 단계를 보고 새로 닿으면 "🏆 업적 달성" 알림 — **불러온 직후 첫 확인은 알림 없이**. **보상**(원신처럼 화면에서 받기): 단계 기본 냥 3000 / 냥 6000·짧은 견문록 3 / 견문록 2·강화석 2, 어려운 셋(탐험도 셋째 지역·반응 열넷·이야기 아홉 장)은 인연 매듭 1. 화면 = Y(위 "업적" 단추, 받을 것이 있으면 ●N) — 갈래 다섯 탭·줄마다 다음 단계 글·진척·"받기", "모두 받기". 자동 점검 `tools/probe_achievements.gd`(`SAGA_ACHIEVE_PROBE=1`) 9항목 | — |
| ㊹ | **탐사 파견** | 새 `data/dispatch.gd`(표) · 새 `world/dispatch.gd`(게시판·보내기·부르기·받기·화면) · `data/party_state.gd` `dispatch` 한 필드·`is_away`(put_in_party·use_preset·preset_party 가 탐사 중 동료를 뺀다) · `data/save_state.gd` · `ui/character_screen.gd`(목록 🧭·넣기 단추 막음). **게시판**: 마을 역참 앞 순간이동 지점 곁 북동쪽(칸 (5.35,3.0) + (4,0,−4)m, 의뢰 게시판 반대편) 3m 안 F(터치 "탐사 파견" — 끝난 탐사가 있으면 ●N). **탐사지 여섯**(지역 신상을 켜야 열림, 세 시대): 청하 마을 옛 역참 길(과거·풍, 냥 1500)·북쪽 숲 가장자리(과거·초, 박하 2·송이버섯 1) / 갯바람 포구 갯벌 선창(현대·수, 바지락 3)·녹슨 조선소(현대·화, 강화석 조각 2·무쇠 조각 1) / 잿빛 폐허 잿빛 채석장(과거·암, 무쇠 조각 2·짐승 고기 1)·시간 틈 관측소(미래·뇌, 연마석 1·강화석 조각 1) — 4시간 기준. **시간** 4·8·12·20시간(이 기기 실제 시각, 꺼 둔 동안도 흐름) × 배율 1·1.8·2.5·3.8(반올림, 칸마다 최소 1). **자리 수** = 모험 등급 1·1·5·10·15 이상인 칸 수(2~5), 탐사지 하나에 한 명. **보낼 수 있는 동료** = 들판 명단에 없고 탐사 안 나간 동료(나는 못 감). 원신의 탐사 특성 대신 **잘 맞는 원소**(탐사지마다 하나) 인물이면 보상 +25%(올림). 도중에 "부르기" = 보상 없이 돌아옴, 다 되면 "받기"·"모두 받기". 다 된 탐사는 한 번 알림(불러온 직후엔 모아서 한 줄). 상태 `PartyState.dispatch` {out: {탐사지: {id, hours, start}}, done}(SAVE_VERSION 그대로). 자동 점검 `tools/probe_dispatch.gd`(`SAGA_DISPATCH_PROBE=1`) 12항목 | — |
| ㊺-1 | **이야기 2부 무대 — 넷째 지역 서리봉 고원** | 새 `world/region4_frost.gd`(지형·식생·명소 다섯·발견 여섯·눈) · `data/test_map.gd` REGIONS `frost` · `world/terrain_builder.gd` 글자 N 눈밭(0.15m)·I 얼어붙은 호수(걸음)·`REGION_COLORS`/`color_of`(고원의 산은 흰 산) · `saga_core/shaders/terrain_triplanar.gdshader` 눈·얼음 갈래(가장 어두운 채널 0.78+ = 눈, 푸른 밝은 색 = 매끈한 얼음 — 기존 지형색은 안 걸려 화면 그대로) · `ui/world_map.gd` 이름·신상 · `waypoints.gd` 셋 · `field_spawner.gd` 무리 넷 · `treasure_spawner.gd` 다섯 · `star_shards.gd` 셋 · `cooking.gd` 채집 일곱 · `vegetation_builder.gd` Pine 다섯(5.52m 역산) · `codex_state.gd` place 49. **자리**: 9×9, 원점 (0,0,−480) — 남쪽 변이 마을 북쪽 변(z=−288)에 붙고 (4,8) 길 = 마을 (5,0) 북쪽 산길 어귀(굴 옆을 지나 걸어서). **명소**(전체 퓨전): 옛 산성 터 R (3,4)(과거 — 돌담 네 변·문루·망루 돌단) · 기상 관측소 (4.4,1.2)(현대 — 원통·둥근 지붕·전파 탑·도는 풍속계·전지판) · 추락한 비행선 (6.45,5.25)(미래 — 은빛 선체·빛줄·꼬리 날개·파편) · 얼어붙은 호수 I (3,2)(4,2) · 고개 경계비. 고원 안에서만 눈(파티클 260). **순간이동** 서리 고개·고원 신상·기상 관측소 · **무리** (2,3) 눈여우 셋 · (6,3) 회오리매 둘+눈여우 · (2,6) 바위곰 둘 · (5,6) 번개살쾡이 둘+눈여우 · **상자** 평범 2·정교(산 턱) 1·진귀 무리 1·화려 석등(불 셋 — 주인공 혼자서도) 1 · **별조각** 봉우리 둘·나무 위 하나 · **채집** 송이버섯·박하·산사과(특산물은 없음 — 인물 돌파 재료와 묶여 있어 사용자와). 나무 팔레트는 아직 마을 변형(전용 눈 팔레트는 다음). **작은 발견 일곱**(위성 조각·장수 석상·사냥꾼 오두막·눈사람·케이블카·얼음굴·봉화, 반경 14m) — 발견 밀도(104-5, 60m) 48.9% → 0%, place 56. 자동 점검 `tools/probe_frost.gd`(`SAGA_FROST_PROBE=1`) 10항목(걸어서 넘기 — 1m 마다 턱·막힘) | — |
| ㊺-2 | **이야기 제10장 · 서리 고개 너머** | `data/story.gd` CHAPTERS ch10(모험 등급 26)·NPCS `haram`(기상 관측원 하람, 현대 — 관측소 앞 (3.85,1.7))·`bandi`(조종 기계 반디, 미래 — 코드 몸 drone, 비행선 곁 (6.0,4.8))·STATIONS `haram`(따라가기 뒤 비행선 곁 → 산성 터 문루 안쪽) · 새 `tools/probe_story2.gd`(`SAGA_STORY2_PROBE=1`, 2부 점검 — 1부는 probe_story.gd 그대로, 장 수 9 → 10). **단계 아홉**: 촌장(북쪽 산길이 얼었다·관측소 불빛이 꺼졌다) → 서리 고개 (4.0,7.4) → 고원 신상 (5.0,4.5) → 얼어붙은 호수 무리 넷(눈여우 셋·회오리매, (3.7,2.45)) → 하람(은빛 배가 떨어진 뒤 눈이 안 멎음) → 하람 따라가기(호수 → 신상 곁 → 비행선) → 반디(별배는 앞날에서 시간 틈을 지나다 떨어짐 — 심장을 켤 불씨는 옛 산성에) → 옛 산성 터 → 하람(산성지기 옛이야기, 다음 장으로). 보상 인연 매듭 2·냥 40000·견문록 6·무예 교본 3, 부대 경험 240. 10단계 점검(인물 자리·따라가는 길 걷기·단계마다 목표·장 끝 보상·하람 제자리) | — |
| ㊺-3 | **이야기 제11장 · 얼음 아래 산성** | `data/story.gd` CHAPTERS ch11(모험 등급 28)·NPCS `bawoo`(산성지기 바우, 과거 — `helmet`, appear 11장 2~7 단계만: 문루 안쪽 (3.0,4.11) · 석등 동안 호숫가 (3.25,2.36))·STATIONS `haram`(마지막 단계 비행선 곁) · `world/vroid_body.gd` `add_helmet`(쇠 투구·챙·뾰족·붉은 술) · `world/story_quest.gd` defend 값 `altar`(제단 글자)·`start`(첫 알림)·`dirs`(무리 나오는 방향, 도 — 산성 담이 막는 쪽 빼기) · `tools/probe_story2.gd` 11장 열 항목. **단계 아홉**: 하람(날씨 지도 — 찬 기운 둘: 비행선·호수 한가운데) → 옛 산성 문루 (3.0,4.2) → 바우(불씨는 호수 얼음 밑 석빙고, 노랫말) → 호수 석등 차례 (3.25,2.1) 달 → 해 → 별 → 얼음 문에서 깬 파수 넷(바위곰·눈여우 둘·번개살쾡이) → 바우에게 봉화 불씨 → 문루 앞 봉화 제단 (3.0,4.25) 지키기(체력 1400·물결 셋 3·4·5 마리, 동·남동·남·남서·서에서만) → 바우 작별 → 비행선 반디·하람(심장실이 얼었고 시간 틈의 무언가 — 12장으로). 보상 인연 매듭 2·냥 42000·견문록 6·무예 교본 3, 부대 경험 250 | — |
| ㊺-4 | **이야기 제12장 · 떨어진 별배** | `data/story.gd` CHAPTERS ch12(모험 등급 30, join `story_haram`)·MEMBERS `story_haram`(관측원 하람 ★4 화·활)·STATIONS `bandi`(구미호 뒤 얼음굴 앞 (6.15,2.5))·`haram`(6~8 비행선 곁) · `data/kits.gd` `story_haram`(휴대 관측기 zone·맑음 예보 rally) · `combat/field_enemy.gd` KINDS `rift_fox`(틈새 서리 구미호, fox9 3.2m·빙·2단계 빙 방패 700·졸개 눈여우·회오리매) · `combat/field_boss.gd` 패턴 `rift`(틈새 질주 — 원 다섯 줄 1.0초 예고 → 줄 끝으로 옮김, 땅 높이 1.5m 넘게 다르면 제자리)·`_rift_to` · `world/region4_frost.gd` `CALM_AFTER_CH`(12장 끝 눈 260 → 60)·`calm()`·`snow_amount()` · `tools/probe_story2.gd` 12장 열 항목. **단계 아홉**: 하람 → 반디(심장이 없다) → 얼음굴 어귀 (6.2,2.05) → 시간 틈 무리 넷 (5.9,2.25) → 구미호 → 반디(심장) → 비행선 곁 심장 받침 (6.53,5.37) light → 반디(추위 멈춤·날개 조각 셋) → 하람 합류. 보상 인연 매듭 4·냥 50000·두꺼운 견문록 4·무예 비전 2, 부대 경험 280 | — |
| ㊻-1 | **서리봉 고원 들판 보스 · 만년설 바위곰왕** | `combat/field_enemy.gd` KINDS `snow_bear_king`(암·bear 3.4m·패턴 slam·tide·bite·halo·2단계 암 방패 450) · `data/field_bosses.gd` BOSSES·ORDER 넷째(고원 (3.15,5.65), 재료 `frost_core`) · `data/growth.gd` ITEMS `frost_core`(만년설 바위 심장)·`BOSS_OF`(해시 밖 지역 인물 재료 — `story_haram`) · 점검 probe_frost `field_boss`(반경 12m 평평·주변 1칸+)·probe_field_bosses 표·들판 적 44. **규칙**: 돌파 보스 재료 해시 풀 `BOSS_MATS` 는 셋 그대로(늘리면 있던 인물 재료가 바뀐다) — 새 지역 보스 재료는 `BOSS_OF` 로 그 지역 인물에게만 | — |
| ㊻-2 | **서리봉 고원 탐사지 둘** | `data/dispatch.gd` SPOTS·ORDER 일곱·여덟째 — 얼음 아래 산성 터(과거·빙, 무쇠 조각 1·송이버섯 2)·추락한 비행선 잔해(미래·풍, 강화석 조각 2·연마석 1), 고원 신상(`f_statue`)을 켜야 열림. 고원 특산물이 아직이라 있는 재료로(특산물이 정해지면 여기 base 에 더한다) · 점검 probe_dispatch ① 네 지역 둘씩·⑤ 고원 잠김/열림·⑫ 목록 글자 | — |
| ㊻-3 | **서리봉 고원 특산물 · 눈꽃** | `data/growth.gd` ITEMS `snow_bloom`·새 `SPECIALTY_OF`(해시 밖 지역 인물 특산물 — `story_haram`)·`specialty_of` 가 먼저 본다 · `data/cooking.gd` GATHER·SPECIALTY_OF_REGION `frost`·PATCHES 셋×2(고원 북서 (2.3,2.3)·가운데 (4.2,3.4)·동쪽 (6.4,4.2)) · `world/gathering.gd` 꽃 모양(옅은 청록 줄기) · `data/dispatch.gd` 고원 탐사지 둘에 눈꽃 1씩 · 점검 probe_cooking ① 채집 68·지역마다 특산물 6 · ⑫ 하람 = 눈꽃·해시 풀엔 없음 · probe_frost 고원 채집 13. **규칙**: 특산물 해시 풀 `SPECIALTIES` 셋 그대로(보스 재료 BOSS_MATS 와 같은 까닭). 눈꽃 요리는 아직 없음 | — |
| ㊻-4 | **눈 전용 나무** | `saga_core/shaders/vegetation_wind.gdshader` `snow_amount`(위를 보는 잎·가지에 눈, 잎빛을 서늘하게 — 0 이면 예전 그대로) · `world/vegetation_builder.gd` `REGION_TREE_SNOW` {frost 0.7}. 새 GLB(팔레트 스냅 변형) 대신 셰이더로 — 스냅은 잎 색만 바꾸고 "가지 위 눈"이 안 생긴다 | — |
| ㊼-1 | **이야기 3부 제13장 "녹슨 조선소의 날개"** | 새 `world/era_sites.gd`(3부 시대 명소 — 포구 동쪽 물가 (7.3,3.85) 녹슨 조선소: 콘크리트 바닥·바다로 내려가는 선대·짓다 만 배 늑골·문형 기중기 들보 12.6m(다리 바깥면 = 들보 끝면이라 타고 올라 넘어선다)·창고·발견 `coast_shipyard`, 도감 place 57) · `data/story.gd` NPCS `daon`(조선공 다온, 현대)·STATIONS 반디 13장 6~8 조선소·CHAPTERS ch13(ar 32, 아홉 단계: 반디 → 조선소 → 다온 → 시간 틈 무리 넷 → 다온 → **기중기 오르기**(climb 새 값 `above` = 땅 위 높이, 14.6 = 들보 위에 서야) → 반디 → **용접대 지키기**(북쪽 바다 빼고 다섯 방향) → 다온) · `world/story_quest.gd` climb `above` · 점검 새 `tools/probe_story3.gd`(`SAGA_STORY3_PROBE=1`) 10항목(오르기는 실제 벽 타기 입력으로) | — |
| ㊼-2 | **이야기 3부 제14장 "시간 틈 관측소"** | `world/era_sites.gd` 폐허 서쪽 (1.2,2.2) 시간 틈 관측소(미래): 땅엔 육각 쇠 바닥·부서진 기둥 여섯(둘레 7.5m)·허공의 보랏빛 틈과 도는 고리, **24m 위에 떠 있는 관측대**(반지름 9m·난간 1m·북쪽 관측경 돔), 남쪽 13m **시간 기둥**(상승 기류 — 구름섬 바람 기둥과 같은 틀, 14장 석등을 켠 뒤부터 늘 선다)·발견 `ruins_rift_observatory`(도감 place 58) · `data/story.gd` NPCS `gaon`(시간 틈 관측사 가온, 미래, 새 `visor` = `VroidBody.add_visor` 은빛 머리띠·청록 빛 띠·안테나)·STATIONS 반디 14장 9 관측대 위(lift)·CHAPTERS ch14(ar 34, 열 단계: 반디 → 관측소 → 가온 → 시간 틈 무리 넷 → 가온 → **틈 석등 별 → 해 → 달**(1부·2부와 다른 넷째 차례) → 가온 → **시간 기둥 타고 관측대로**(climb above 26) → 관측대 파수 셋(kill `lift` 24) → 반디(구미호가 틈을 지나 옛 역참 길로 — 15장)) · `world/story_quest.gd` 단계·인물 칸 새 값 `lift`(땅 높이 + lift m, `_cell_pos`·무리 둘레·떨어지면 제자리) · 점검 `probe_story3.gd` 21항목(오르기는 실제로 기둥에 뛰어들어 솟고 활공해 내려앉기) | — |
| ㊼-3 | **이야기 3부 제15장 "옛 역참 길"(3부 끝)** | `world/era_sites.gd` 마을 남쪽 산골 길 (5,8)~(5,10)(폭 48m 평지·양옆 절벽) 서쪽 (4.72,8.8) 옛 역참 터(과거): 돌담 세 변·초가 마구간·구유·역참 깃대·마구간 역마(코드 몸 말 — 15장 쫓기 동안만 빈다), 골짜기 북쪽 어귀 돌장승 둘, 한가운데 이정표는 그대로 · 발견 `village_old_road`(도감 place 59) · `data/story.gd` NPCS `dareum`(파발꾼 달음, 과거, 새 `hat` = `VroidBody.add_hat` 벙거지·붉은 띠·끈)·STATIONS 달음 15장 8~10 별배 곁·CHAPTERS ch15(ar 36, join `story_dareum`, 열한 단계: 반디 → 옛 역참 길 → 달음 → **놀란 역마 쫓기**(chase 새 body `horse` — creature_builder 말) → 달음 → 여우불 무리 넷 → **여우불 구미호**(새 `rift_fox_ember` 화·3.4m, 틀만: 틈새 질주·그림자·밀물·고리, 2단계 화 방패 800 — 물로) → 달음 → 별배로 → 날개 이음매에 불(light) → 반디) · MEMBERS `story_dareum`(★4 암·장병기 — 이야기 동료에 없던 원소)·`data/kits.gd` 파발 질주(dash)·마패 호령(guard 피해 -25%) · `world/region4_frost.gd` **15장을 마치면 별배가 뜬다**(선체·충돌·이름표를 `Ship` 아래로 — 수평으로 서서 FLY_H 9m 위, 빛 날개 셋, 이름표 "별배", 지켜보면 4초에 걸쳐 떠오름, 파편은 땅에) · 점검 `probe_story3.gd` 33항목·`probe_kits` 고유 12·합류 7 | — |
| ㊽-1 | **이야기 4부 무대 — 다섯째 지역 은하 나루** | 새 `world/region5_skyport.gd`(지형·식생·명소 넷·경계비·길가 빛 가로등·시간 틈 문·발견 열여섯) · `data/test_map.gd` REGIONS `skyport` · `world/terrain_builder.gd` 글자 M 금속 포장(0.1m, 셰이더는 모래와 같은 "정점색 그대로" 갈래 CUSTOM0 .b) · `ui/world_map.gd` 이름·신상 · `waypoints.gd` 셋 · `field_spawner.gd` 무리 셋(여덟 마리) · `treasure_spawner.gd` 다섯 · `star_shards.gd` 셋 · `cooking.gd` 채집 넷(특산물 없음 — 사용자와) · `dispatch.gd` 탐사지 둘(별배 나루 창고 미래·뇌 / 옛 절터 주춧돌 과거·초) · `codex_state.gd` place 75. **자리**: 9×9, 원점 (−480,0,0) — 포구의 거울 자리, 동쪽 변이 마을 서쪽 변(x=−264)에 붙고 (8,3) 길 = 마을 (0,4) 숲 칸(틈 고개). **시간 틈 문**: 고개 칸 동쪽 변 보랏빛 막 + 충돌 — 15장을 마치면(ch ≥ 15) 사라진다(빛 기둥 둘은 남음). **명소**(미래 중심 전체 퓨전): 별배 나루 M (5.3,1.6)(미래 — 반지름 9m 착륙판·18m 계류 탑·도는 빛 고리 셋·계류 팔 둘·표지 부스) · 옛 절터 R (2.5,3.5)(과거 — 삼층 돌탑·주춧돌 줄·돌계단) · 은하역 H (5,5)(현대 — 승강장·녹슨 객차·간판·남쪽 철로) · 태양광 밭 F (3.5,6) · 틈 고개 경계비. **작은 발견 열**(배달 기계·절 종·공중전화·시간 캡슐·돌탑·이정표·화물 상자·정류장·옹기·안테나) — 발견 밀도 23.9% → 2.2%. 자동 점검 `tools/probe_skyport.gd`(`SAGA_SKYPORT_PROBE=1`) 10항목(문 닫힘·열림 뒤 걸어서 넘기 487걸음 턱 0.10m) · 옛 점검 개수 기준(지도 14·신상 5·상자 28·별조각 26·채집 77·냄비 5·들판 적 52) | — |
| ㊽-2 | **이야기 4부 제16장 "별배가 돌아온 나루"** | `data/story.gd` NPCS `ara`(나루지기 아라, 미래, 새 `halo` = `VroidBody.add_halo` 머리 위 빛 고리·귀 옆 빛 조각)·STATIONS 반디 16장 6~8 나루·CHAPTERS ch16(ar 38, 아홉 단계: 반디(고원) → 틈 고개 → 아라 → 착륙판 무리 넷 → 아라 → **계류 탑 벽 타기**(climb above 20 — 18m 탑 옆면, 꼭대기에 서면 신호) → 반디(별배 몰고 옴) → **매인 별배 계류대 지키기**(defend, 동쪽 탑 쪽 뺀 일곱 방향) → 아라(항해 기록 "선장이 옛 절터 종소리를 따라 틈으로" — 17장)) · `world/region5_skyport.gd` 나루에 매인 별배(`DockedShip` — 16장 6단계부터, 착륙판 위 6m 에 수평·날개 셋, 밑은 비어 무리가 지나감·윗면 올라섬) · `world/region4_frost.gd` 그때부터 고원 별배(선체·충돌·이름표)를 숨김(`_refresh_away`, 파편은 남음) · 계류 탑 꼭대기 빛 공을 20.4m 로(서는 자리 위) · 점검 새 `tools/probe_story4.gd`(`SAGA_STORY4_PROBE=1`) 10항목(오르기는 실제 벽 타기 입력) | — |
| ㊽-3 | **이야기 4부 제17장 "옛 절터의 종"** | `data/story.gd` NPCS `hangyeol`(종지기 한결, 과거 — 종각이 무너지던 밤 시간 틈에 휩쓸려 온 옛 절 종지기, 새 `beads` = `VroidBody.add_beads` 목에 나무 염주·붉은 가사 띠)·STATIONS 반디 17장 0~6 나루 / 7 쓰러진 종 곁 / 8~9 종각 곁 · 한결 4~7 종 곁 · CHAPTERS ch17(ar 40, 열 단계: 아라 → 옛 절터 → 한결 → 쓰러진 종(1.2,5.0) 곁 무리 넷 → 한결 → **이야기 보스 `moss_serpent` 종 감은 이끼 이무기**(초, 코드 몸 serpent 3.8m, 있는 패턴만, 2단계 초 방패는 풍으로) → 한결 → 반디(별배 견인 빛줄로 종을 들어 종각에 — 새 종고리는 별배 쇠) → **종 울리기**(light `bell` — 제단 돌 없이 종각에 원소) → 한결("종이 다시 울리면 막차가 한 번 더 온다" — 18장)) · `world/story_quest.gd` light `bell` 갈래(돌 숨김·불 대신 `ring_bell`) · `world/region5_skyport.gd` 절터 탑 동쪽 10m 종각(`Belfry` — 돌 기단·기둥 넷·들보·기와 지붕, 기단·기둥·아래 지붕 충돌) · 17장 8단계부터 `HungBell` 보임·비탈의 쓰러진 종(작은 발견 skyport_bell 의 종 몸)은 숨김 · `ring_bell` 3초 잦아드는 흔들림 · 점검 `tools/probe_story4.gd` 17장 12항목(모두 22) | — |
| ㊽-4 | **이야기 4부 제18장 "은하역 막차"(4부 끝)** | `data/story.gd` NPCS `dodam`(기관사 도담, 현대 — 은하역 마지막 기관사, 새 `goggles` = `VroidBody.add_goggles` 이마 위 구리 테 고글)·STATIONS 반디 18장 0 종각 / 1~9 역 곁 · 도담 7 선로 끝 · MEMBERS `story_dodam`(★4 뇌·양손검) · `data/kits.gd` 고유 스킬 선로 전류(wave)·막차 출발 신호(haste) · CHAPTERS ch18(ar 42, join, 열 단계: 반디(종각) → 은하역 → 도담 → 태양광 밭 무리 넷 → **꺼진 변전함에 원소**(light 새 `bare`·`hit_text` — 돌·불 없이 장치가 받는다) → 도담 → **선장의 잔상 쫓기**(chase 새 body `captain` — 사람 몸 + 남색 선장 모자, 선로 위 일곱 점) → 도담(운행 기록부 "틈 너머 첫 정거장") → **출발을 기다리는 막차 지키기**(defend, 북쪽 객차 쪽 뺀 다섯 방향) → 도담 합류) · `world/region5_skyport.gd` 18장 5단계부터 막차 전조등 둘·행선 표시판·창 빛이 켜지고 변전함 표시등 빨강 → 초록(`train_powered`) · 점검 `tools/probe_story4.gd` 18장 11항목(모두 33) · probe_kits 고유 13·합류 8 | — |
| ㊾-1 | **이야기 5부 무대 — 여섯째 지역 틈새 갈림길** | 새 `world/region6_crossing.gd`(지형·식생·명소 넷·경계비·틈 등롱·은하역에서 이어지는 선로·시간 틈 문·발견 열여섯) · `data/test_map.gd` REGIONS `crossing`(9×9, 원점 (−480,0,432) — 은하 나루 남쪽 변에 붙임, 나루 (5,8) 을 산 → 선로 고개로) · `world/terrain_builder.gd` REGION_COLORS 푸르스름한 풀·보랏빛 산 · `ui/world_map.gd` 이름·신상 · `waypoints.gd` 셋 · `field_spawner.gd` 무리 셋(여덟 마리) · `treasure_spawner.gd` 다섯 · `star_shards.gd` 셋 · `cooking.gd` 채집 넷(아홉) · `dispatch.gd` 탐사지 둘(첫 정거장 분실물 창고 현대·풍 / 뒤엉킨 성문 아래 과거·암) · `codex_state.gd` place 91. **시간 틈 문**: 고개 칸 북쪽 변(월드 z 192) 보랏빛 막 + 충돌 — 4부를 마치면(ch ≥ 18) 사라진다. **명소**(시간 틈 안쪽 — 시대가 가장 심하게 뒤엉킴): 첫 정거장 H (5,2)(현대·미래 — 선로 동쪽 승강장·빛 지붕·한지 역명판·바늘 없는 시간표·차막이) · 뒤엉킨 성문 R (2.5,4.5)(과거 — 12° 기운 누각 성문 + 허공에 멈춘 성벽 조각 넷, 밟고 누각 지붕까지) · 멈춘 시계탑 (6.6,5.8)(현대 — 16m 벽 타기·네 면 빛 문자판) · 떠 있는 섬돌 M (2.5,7)(미래·틈 — 섬돌 열다섯이 1.1m 씩 나선으로 → 17.6m 꼭대기 틈 수정) · 틈 고개 경계비. **작은 발견 열**(문자판·등롱·경비 기계·기와 조각·신호기·틈 수정·수레·탈출 포드·표 기계·칼과 투구) — 발견 밀도 4.0%. 자동 점검 `tools/probe_crossing.gd`(`SAGA_CROSSING_PROBE=1`) 11항목 · 옛 점검 개수 기준(지도 17·신상 6·상자 33·별조각 29·채집 86·냄비 6·들판 적 60) | — |
| ㊾-2 | **이야기 5부 제19장 "틈 너머 첫 정거장"** | `data/story.gd` NPCS `hanbyeol`(별배 선장 한별, 미래 — 틈 한가운데서 시간을 멈춰 틈이 더 벌어지지 않게 붙들고 있었다, 새 `captain_hat` = add_hat 남색·금띠)·appear 7 섬돌 꼭대기(lift 17.9) / 8~9 섬돌 아래 / 19장 뒤 첫 정거장 곁 · 인물 자리 칸 새 `ch_to`(그 장들이 끝난 뒤 계속 서 있을 자리) — 반디 19장 뒤 = 은하 나루 착륙판 곁(4부 뒤 고원 빈자리 틈 메움) · STATIONS 반디 19장 0~1 은하역 / 2~4 첫 정거장 / 5 시계탑 발치 / 6~9 섬돌 곁 · 도담 2~9 첫 정거장 · CHAPTERS ch19(ar 44, 열 단계: 도담 → **막차 타기**(sail) → 반디 → 갈림목 무리 넷 → **멈춘 시계탑 벽 타기**(climb above 18) → 반디 → **떠 있는 섬돌 꼭대기로**(climb above 19.9) → 선장 → **이야기 보스 `time_warden` 멈춘 시간의 파수꾼**(풍, 사람 몸 2배·금빛 가면, 있는 패턴만, 2단계 풍 방패는 암) → 선장(다음 역 "갈림길 끝" — 틈이 처음 찢어진 곳)) · `world/story_quest.gd` _window_now ch_to · `world/region6_crossing.gd` 시계탑 윗면 턱 없앰(지붕은 모서리 기둥 넷 위 2.6m)·19장 5단계부터 네 면 바늘이 돈다(`clock_running`) · 점검 새 `tools/probe_story5.gd`(`SAGA_STORY5_PROBE=1`) 11항목(시계탑은 실제 벽 타기 입력) | — |
| ㊾-3 | **이야기 5부 제20장 "갈림길 끝" — 5부 끝** | 새 `world/rift_end.gd`(첫 정거장 동남쪽 하늘에 뜬 섬 — 칸 (6.3,2.6), 기둥 칸 (6.3,3.1) 땅 + 46m, 반지름 20·난간 1m, 구름섬 틀: 세 갈래 선로(옛 나무 북동 60°·쇠 북서 300°·빛 남 180°) 끝마다 시대 닻(석등·신호기+차막이·빛 기둥) · 한가운데 위 세로로 찢어진 틈(`tear_state` 0 찢어짐 / 1 20장 6단계부터 오므라듦·닻이 켜짐 / 2 20장 끝 닫힘 → 고요한 별빛) · 쇠 갈래 끝에서 첫 정거장 쪽으로 내려가는 떠 있는 선로 조각(보기만) · 바람 기둥(20장이 풀린 뒤부터) · 도감 place `crossing_end`(91→92)) · `world/story_quest.gd` 새 `_spot_pos`·`_floating` — 단계·인물 칸 `rift_end = true` 면 섬 윗면 높이(kill·duel·light·seal·defend·sail 의 to·appear·stations), 떠 있는 자리면 석등·물결도 그 높이 · `data/story.gd` CHAPTERS ch20(ar 46, join `story_hanbyeol`, 열한 단계: 선장 → **막차로 갈림길 끝**(sail rift_end) → 반디 → 틈 짐승 다섯 → 선장 → **매듭 석등 달 → 별 → 해**(seal) → 선장 → **매듭 제단 지키기**(defend 2000, 물결 셋) → 선장 → **이야기 보스 `rift_crow` 틈 삼킨 별까마귀**(빙, 코드 몸 bird 4.4m, 틈새 질주·고리·회오리·내려찍기·밀물 줄 — 그림자 뺌, 2단계 빙 방패는 화) → 선장 합류) · 자리: 한별·반디·도담 20장 2~10 섬 위 · MEMBERS `story_hanbyeol`(★5 풍·활) · `data/kits.gd` 별배 견인줄(updraft)·틈 닫기(vortex) · 점검 `probe_story5` 20장 13항목(모두 24) · probe_kits 고유 14·합류 9 | — |
| ㊿-1 | **이야기 6부 무대 — 일곱째 지역 잠긴 도읍** | 새 `world/region7_sunken.gd` · `data/test_map.gd` REGIONS `sunken`(9×9, 원점 (480,0,432) — 포구 남쪽 변에 붙임(틈새 갈림길의 거울 자리), 포구 (1,8) 산 → 모래 고개) · `world/terrain_builder.gd` 새 글자 **U**(빛 돔 안 마른 바닥 −10, 물 안 깖, 표시 .b)·REGION_COLORS 잿빛 모래·푸른 바위 · `ui/world_map.gd` 이름·신상 u_statue · `waypoints.gd` 셋(어귀·신상·등대 섬) · `field_spawner.gd` 무리 셋(여덟, 모래밭만) · `treasure_spawner.gd` 다섯(돔 안 하나는 22장 뒤) · `star_shards.gd` 셋 · `cooking.gd` 채집 넷(아홉) · `dispatch.gd` 탐사지 둘(해저 연구 기지 창고 현대·수 / 잠긴 궁궐 기단 과거·암) · `codex_state.gd` place 108. **잠수 없음(결정)**: 바다는 강과 같은 물(바닥 −3, 헤엄) — 도읍은 "얕게 잠겨 기단·지붕이 물 위로 드러난" 모양, 물 위 턱은 모두 +0.75 이하(헤엄 넘어오르기), 헤엄 구간 최장 ≤ 55m(디딤 지붕 셋). 시나리오의 "숨 막대·잠수"는 쓰지 않고 21장 물속 이동은 잠수정(sail 틀)으로. **해무 문**: 고개 북쪽 변 흰 막 + 충돌 — 5부를 마치면(ch ≥ 20) 걷힌다(틈이 닫혀 도읍이 드러났다). **명소**: 잠긴 궁궐 (2.3,5)(과거 — 기단 +0.25·기운 정전·맞배 지붕, 모래밭에서 돌다리) · 해저 연구 기지·잠수정 선착장 (6.5,3.3)(현대 — 갑판 +0.5·컨테이너·관제실·기지 통로, 빛 돔까지 잔교, 잔교 옆 노란 잠수정 `Submarine`) · 빛 돔 (5,6)(미래 — 받침 고리 안 22·바깥 34·윗면 +0.5, 유리 반구(충돌, 북쪽 문 자리만 비움), 안 층계참 → 경사로 25° → 마른 바닥·기록실. 문은 22장을 마치면(ch ≥ 22) 열림) · 옛 등대 (7,7) K 바위섬(과거·미래 — 15m 돌탑 벽 타기·난간 판, 23장을 마치면(ch ≥ 23) 불·빛줄기). **작은 발견 열**(테왁·잠수 투구·보급 상자·진주조개·신호 부표·돌거북 비석·편액·해태상·빛 해파리·수중 드론). 자동 점검 `tools/probe_sunken.gd`(`SAGA_SUNKEN_PROBE=1`) 14항목 · 옛 점검 개수 기준(지도 20·신상 7·상자 38·별조각 32·채집 95·냄비 7·들판 적 68) | — |
| ㊿-2 | **이야기 6부 제21장 "바다 밑 등불"** | `data/story.gd` NPCS `yeoul`(잠수 기사 여울, 현대 — 해저 연구 기지 마지막 대원, 잠수 마스크 = goggles, 늘 기지 경사로 서쪽 모래밭) · 한별 appear 21장 0~1 은하 나루 별배 곁 / 2~ 잠긴 도읍 모래밭(ch_to) · STATIONS 반디 2~6 모래밭 / 7~ 궁궐 기단 위(lift 3.25) · 여울 4~6 선착장 판 위(lift 3.5) / 7~ 기단 위 · CHAPTERS ch21(ar 48, 여덟 단계: 한별 → **별배 타기**(sail hanbyeol → 모래밭) → 반디 → 기지 앞 물짐승 넷 → **잔교 따라 잠수정 선착장**(go, 판 위) → 여울 → **잠수정으로 물속 불빛 따라**(sail yeoul → 기단 위, lift) → 여울(테왁 불빛·반디의 지워진 칸 "등대")) · `world/region7_sunken.gd` 새 `dock_pos()`(잔교 40% 오른쪽 4.5m — 이야기 칸 (6.08,4.26) 과 맞춤)·`sea_lights_on()`/`SeaLights`(20장 뒤 궁궐 둘레 불 켜진 테왁 여덟 + 물속 빛 망울) · 점검 새 `tools/probe_story6.gd`(`SAGA_STORY6_PROBE=1`) 9항목 · probe_story5 20장 뒤 선장 자리 → 은하 나루 | — |
| ㊿-3 | **이야기 6부 제22장 "잠긴 궁궐의 해녀"** | `data/story.gd` NPCS `mulsae`(해녀 물새, 과거 — 도읍이 잠기던 날 물질 나갔다 갇힘, 흰 물옷, appear 만: 곁채 지붕 위 lift 3.45 / 돔 문 앞 받침 위 lift 3.5 / 문이 열린 뒤 돔 안) · 반디·여울 22장 자리(기단 → 받침 위 → 돔 안, ch_to) · CHAPTERS ch22(ar 50, 열 단계: 여울 → 물새(곁채 지붕) → **바지락 셋**(gather) → 물새(받침 위) → **물길 석등 해 → 별 → 달**(seal, 돔 가운데 북쪽 27.5m 받침 위 lift) → 물새 → **빛 돔 문 자물쇠 지키기**(defend 2100, 물결 셋 — dirs 84·96·264·276 로 고리 동·서에서만) → 여울(문 열림) → **이야기 보스 `abyss_angler` 심해 등불아귀**(수, 코드 몸 serpent 3.6m, 돔 안 마른 바닥, 2단계 수 방패는 뇌) → 물새) · `world/region7_sunken.gd` 문 여는 조건을 22장 7단계부터로(`CH22`·`DOOR_FROM_STEP` — 옛 "22장 뒤") · `combat/field_enemy.gd` KINDS `abyss_angler` · 점검 `probe_story6` 22장 11항목(모두 20) | — |
| ㊿-4 | **이야기 6부 제23장 "빛 돔의 기록"(6부 끝)** | `data/story.gd` NPCS `parang`(돔 관리 인공지능 파랑, 미래 — 몸은 조종 기계 틀 drone·파란 빛깔, 23장부터 기록실 앞 경사로 발치 동쪽) · 반디 3단계 자리 = 등대 난간 판 위(lift 15.3) · MEMBERS `story_mulsae`(★4 **수·한손검**(빗창) — 시나리오의 수·장병기는 사공 버들과 똑같이 겹쳐 무기를 바꿈) · CHAPTERS ch23(ar 52, join story_mulsae, 일곱 단계: 파랑(옥새 봉인·전력은 등대에서) → **옛 등대 돌탑 오르기**(climb, above = 난간 판 + 2) → **꺼진 등롱에 원소**(light bare, lift 15.3) → 반디(난간 판 — 그날 누군가 먹구름으로 등롱을 덮었다) → 파랑(기록 재생: 별배를 떨어뜨린 건 틈이 아니라 먹구름을 부리는 가면 그림자, 반디 기록도 그가 지움) → **이야기 보스 `dome_colossus` 돔 파수 거신**(암, 코드 몸 goblin 4.8m, 돔 안 마른 바닥, 2단계 암 방패는 초) → 물새(합류, 명령 발신지 = 구름 위 하늘 항로 → 7부)) · `world/region7_sunken.gd` 등대를 23장 3단계부터 켬(`CH23`·`LIGHT_FROM_STEP` — 옛 "23장 뒤")·켜지면 기록 단말도 밝아짐 · **난간 판 충돌을 탑 벽과 같은 반지름으로**(1m 내민 턱 밑에서 벽 타기가 멈췄다 — 그림만 0.3m 내밈, 서는 자리 등롱~가장자리 1m) · `data/kits.gd` 물새 고유(자맥질 blink·숨비소리 feast) · 점검 `probe_story6` 23장 8항목(모두 28, 돌탑을 실제로 타고 오름)·`probe_kits` 고유 15·합류 10·`probe_sunken` 난간 판 자리 | — |
| 51-1 | **이야기 7부 무대 — 구름 위 항로(떠 있는 섬 셋)** | 새 `world/sky_route.gd`(고정 지역 아님 — 잠긴 도읍 남쪽 바다 위 하늘, 칸은 sunken 좌표) · 섬 셋은 서쪽일수록 높다: 하늘 사당 `shrine`(과거, 윗면 60m·반지름 18 — 북쪽 기와 사당·바람 방울 장대 넷, 가운데 8m 비움) · 비행선 잔해 `wreck`(현대, 82m·20 — 조종실(충돌)·찢어진 기낭·꼬리 날개·프로펠러·풍향계) · 궤도 정거장 조각 `orbit`(미래, 104m·16 육각 — 태양 날개·9m 안테나·구름 씨앗 장치 셋(반지름 9m)) · 섬 사이 틈 6~10m, 난간 1m. **23장 등롱 뒤(Sunken.light_on)에만 보이고 밟힌다**(몸 숨김 + 충돌 층 0). **바람 기둥 셋**(구름섬·갈림길 끝 틀): 등대 섬(K 평평한 꼭대기, 탑에서 7m) → 사당 · 사당 서쪽 가장자리 3.5m 안 → 잔해 · 잔해 → 정거장, 끝 = 다음 섬 + 9, 다음 섬 가장자리까지 활공 약 12m — 등대·사당 기둥은 24장 뒤, 잔해 기둥은 25장 뒤. 첫 섬엔 24장 별배로(sail to isle). `world/story_quest.gd` 단계·인물 칸 `isle = "<id>"` = 그 섬 윗면(_spot_pos·_floating) · 도감 place 111(sky_shrine·sky_wreck·sky_orbit) · 자동 점검 `tools/probe_sky_route.gd`(`SAGA_SKYROUTE_PROBE=1`) 9항목 — 기둥마다 실제로 타고 올라 활공해 다음 섬에 내려섬 | — |
| 51-2 | **이야기 7부 제24장 "하늘 사당의 바람 방울"** | `data/story.gd` NPCS `saebyeok`(바람 무녀 새벽, 과거 — 사당이 하늘로 들린 날부터 홀로, appear 24장 2~ 사당 앞 서쪽 isle shrine) · 한별·반디 24장 자리(모래밭 → 사당 섬 남쪽, 24장 뒤에도) · CHAPTERS ch24(ar 54, 일곱 단계: 한별(등대 빛줄기 끝 섬·비행선 구조 신호) → **별배로 하늘 항로**(sail to isle shrine) → 새벽 → 사당 마당 먹구름 졸개 넷(kill isle) → 새벽 → **바람 방울 석등 별 → 해 → 달**(seal isle) → 새벽(먹구름은 위에서 흘러내린다 · 사당 서쪽 바람 기둥)) · `world/sky_route.gd` 사당 위 먹구름 덩이 아홉·흐린 방울 — 24장 6단계부터 걷힘(`CH24`·`SHRINE_CLEAR_STEP`) · 점검 새 `tools/probe_story7.gd`(`SAGA_STORY7_PROBE=1`) 8항목 | — |
| 51-3 | **이야기 7부 제25장 "멈춘 기상 비행선"** | `data/story.gd` NPCS `haneul`(비행사 하늬, 현대 — 비행 고글 = 기관사 고글 틀·주황 비행복, 25장부터 잔해 섬 조종실 동쪽 앞 isle wreck) · 반디 25장 1~ 잔해 섬(뒤에도) · CHAPTERS ch25(ar 56, 일곱 단계: 새벽 → **사당 바람 기둥 타고 활공해 잔해 섬으로**(climb isle wreck) → 하늬(기록계 — 누가 구름을 만든다) → **구름 씨앗 드론 쫓기**(chase isle, drone 몸, 섬 둘레 반지름 12~18m 길) → 하늬 → **비행선 기관 지키기**(defend 2200 isle, dirs 0·30·120·160·300 — 꼬리 날개·프로펠러·난간을 비켜) → 하늬(발신지 = 궤도 정거장 조각)) · `world/story_quest.gd` climb 에 isle(그 섬 윗면에 서면)·chase 길에 isle(`_path_pos` — 길 점·달리는 높이가 섬 윗면) · 점검 `probe_story7` 25장 8항목(모두 16, 바람 기둥을 실제로 타고 활공해 잔해 섬에 내려섬) | — |
| 51-4 | **이야기 7부 제26장 "궤도 조각의 그림자"(7부 끝)** | `data/story.gd` NPCS `gamyeon`(가면 그림자 — 23장 반디 기록 속 그자, 가면·먹빛 옷, 26장 6단계에만 정거장 서쪽, 정체는 8부까지) · 하늬·반디 26장 1~ 정거장 조각(뒤에도) · MEMBERS `story_haneul`(★4 **빙·장병기** — 비행선 닻 갈고리, 이야기 동료에 없던 짝) · CHAPTERS ch26(ar 58, join story_haneul, 아홉 단계: 하늬 → **잔해 바람 기둥 타고 활공해 정거장으로**(climb isle orbit) → 하늬 → **구름 씨앗 장치 셋 끄기** 남동 → 북 → 남서(light bare isle ×3) → 가면 그림자(별배를 떨어뜨린 까닭 — 매듭이 다시 묶이면 먹구름이 설 자리가 없다) → **이야기 보스 `storm_shadow` 먹구름 임금의 그림자**(뇌, 사람 몸 2배·먹빛 왕관·보랏빛 가면, 2단계 뇌 방패는 불 — 쓰러뜨리면 그림자는 "청하의 여섯 매듭이 풀리는 날 다시 보자") → 하늬 합류(반디: 여섯 매듭 = 1부 여섯 제단 → 8부)) · `world/sky_route.gd` 장치마다 끈 뒤 단계부터 먹구름 알·연기 꺼짐(`SEEDER_OFF_FROM`) · **정거장 윗면을 둥글게**(육각 판은 둥근 충돌·난간과 어긋나 난간이 허공에 떴다 — 육각은 빛 줄로만) · `data/kits.gd` 하늬 고유(얼음 관측 풍선 shells·한파 예보 lore) · 점검 `probe_story7` 26장 8항목(모두 24)·`probe_kits` 고유 16·합류 11 | — |
| 52-1 | **이야기 8부 무대 — 여섯 매듭·먹구름 눈** | 새 `world/storm_eye.gd`(새 고정 지역 없음 — 첫 지역으로 돌아온다) · **여섯 매듭** = 1부 여섯 제단 칸(폐허 1장·서쪽 옛길 5장·봉우리 6장·곶 7장·바위섬 8장·구름섬 9장) 북쪽 2.4m 금줄 매듭 돌(보기만) — 27장부터 보이고, 풀린 매듭은 먹구름 연기·묶이면(`KNOTS` 장·단계) 불 + 곧은 금빛 줄, 여섯 다 묶이면(28장 8단계) 줄이 매듭 등불 한 점으로, 29장 뒤엔 줄 거둠 · **먹구름 눈** = 구름섬 서쪽 36.5m·윗면 24m 위 판(반지름 16, 난간 1m 충돌) — 28장 9단계부터 보이고 밟힘, 둘레 먹구름 소용돌이·가운데 매듭 등불, 29장부터 구름섬 서쪽 가장자리 바람 기둥(활공 약 10m), 29장 뒤 "맑은 하늘 뜰" · 단계·인물 칸 `eye = true` = 눈 윗면(`story_quest.gd` `_spot_pos`·`_floating`·climb) · 도감 place 112(`storm_eye`) · 자동 점검 `tools/probe_storm_eye.gd`(`SAGA_STORMEYE_PROBE=1`) 7항목 — 기둥을 실제로 타고 올라 활공해 눈에 내려섬 | — |
| 52-2 | **이야기 8부 제27장 "풀리는 매듭"** | `data/story.gd` CHAPTERS ch27(ar 60, 아홉 단계: 촌장(제단 불이 꺼진다·자장가 끝 소절) → 은비(폐허 — 탁본 뒷면 "매듭 여섯이 틈을 묶고 틈이 임금을 묶는다"·둘째 석등 차례) → **첫째 매듭 먹구름 졸개**(kill 폐허 1장 제단 칸) → **첫째 매듭 불**(light) → **둘째 매듭 석등 달 → 별 → 해**(seal 옛길 5장 칸) → 나그네(처음 가면 무늬 = 임금 자신의 얼굴) → **봉우리 오르기**(climb) → **셋째 매듭 불**(light 6장 칸) → 해솔(먹구름 속 목소리 = 가면 그림자)) · **반디 8부 자리 = 청하 촌장 동쪽**(옛 "26장 뒤 정거장" 칸 대신) · 점검 새 `tools/probe_story8.gd`(`SAGA_STORY8_PROBE=1`) 27장 10항목 | — |
| 52-3 | **이야기 8부 제28장 "여섯째 매듭"** | ch28(ar 62, 열 단계: 버들(하람 무전·한별 항로표 신호) → **곶 넷째 매듭 지키기**(defend 7장 칸, altar "넷째 매듭") → **넷째 매듭 불** → **버들의 배로 바위섬**(sail, 사공도 섬 배 댄 자리에 — STATIONS) → **다섯째 매듭 석등 해 → 별 → 달**(seal 8장 칸) → **봉우리 바람 기둥으로 구름섬**(sky) → 구름섬 무리 다섯(kill sky) → **여섯째 매듭 불**(light sky — 여섯 줄이 매듭 등불로) → 가면 그림자(정체 = 먹구름 임금의 참몸, 구름섬 북동쪽 한 번) → 나그네(모두를 불러 모으라)) · 끝나면 먹구름 눈이 서고 29장 바람 기둥 · 점검 28장 11항목 | — |
| 52-4 | **이야기 8부 제29장 "먹구름의 근원"(8부 끝, 1차 결말)** | ch29(ar 64, 아홉 단계: 광장 촌장(도담·한별·반디) → **편성 시험**(새 단계 `party` — 들판 명단의 이야기 동료가 과거·현대·미래를 하나씩, 목표 글에 시대마다 ✔/✗ · MEMBERS 에 `era`) → **구름섬 서쪽 바람 기둥으로 먹구름 눈**(climb eye) → 임금의 참몸 → **매듭 등불 지키기**(defend eye `bare` — 새 defend bare: 제단 돌 없이 눈 가운데 등불, 물결 셋 둘레 15m) → **이야기 보스 `storm_king_true` 먹구름 임금 — 참몸**(뇌, 사람 몸 2.4배·먹빛 왕관·흰 처음 가면, 2단계 뇌 방패는 불, 눈 남쪽 9m) → 해솔(소용돌이 걷힘 — `storm_eye.gd` EYE_CLEAR_STEP 6) → 활공해 광장(go) → 잔치(반디·한별이 9부 떡밥 "굳은 자리")) · 보상 fate_knot 10·모라 30만·book_l 10·talent_3 5·경험 1000(동료 없음) · 먹구름 눈 반지름 16 → 18(물결 둘레가 난간 안) · 점검 29장 10항목(모두 31, 기둥을 실제로 타고 눈에) | — |
| 52-5 | **결말 뒤 — 이야기 보스 재대결·밤의 잔불** | **재대결**(주간 보스 틀, `data/domains.gd` 넷 더함 — `after_ch` 29: 1차 결말 뒤에만 입구가 보이고 열림, `Domains.domain_open`): 매듭 등불의 메아리(먹구름 임금 참몸, 청하 광장 동쪽) · 얼음굴의 메아리(틈새 서리 구미호, 고원) · 갈림길의 메아리(틈 삼킨 별까마귀) · 빛 돔의 메아리(돔 파수 거신, 잠긴 도읍 모래밭) — 보스 하나·240초·원기 60(주간 할인 셋은 모든 주간 보스가 함께 셈)·보상 boss_mat·특성 책·★5 성유물 · **밤의 잔불**(새 `data/night_echoes.gd`·`world/night_echoes.gd`): 결말 뒤 밤(실제 시각 21~4시)에만 일곱 지역마다 보랏빛 잔불 — 14m 안에 들면 잔당 셋(그 지역 이야기 kill 칸), 60m 넘게 떠나거나 낮이 되면 거둠, 다 쓰러뜨리면 그 지역 이야기 인물 한 줄 + 모라 2만·talent_2 1, 지역마다 하루 한 번(새벽 4시 넘김) · 세이브 `night_echo` 한 칸(필드만 더함) · 자동 점검 새 `tools/probe_aftermath.gd`(`SAGA_AFTERMATH_PROBE=1`) 6항목 | — |
| 53-1 | **이야기 9부 무대 — 여덟째 지역 굳은 거리** | 새 `world/region8_amber.gd` · `test_map.gd` REGIONS `amber`(9×9, 원점 (−480,0,−432) — 은하 나루 북쪽 변에 붙임, 은하 나루 row0 (3,0) 을 길 `=` 로 열어 이 지역 (3,8) 길과 이음) · 고개 결정 막(1차 결말 ch ≥ 29 뒤 풀림, 충돌) · 명소: 네거리(신호등 넷 — 32장 뒤 초록 · 굳은 자리 셋 CRYSTALS — 30장 CRYSTAL_OFF_FROM 5·6·7 단계부터 녹음) · 초롱 시계방(충돌 건물, 서쪽 앞 괘종시계) · 호박 속 장터(H, 결정 돔 반지름 4.6 — 31장 2단계부터 깨짐, 석등 고리 6m 는 바깥) · 짓다 만 부양탑(심 기둥 6×12m 벽 타기·윗면 태엽 심장 — 32장 3단계부터 녹음, 공중 층판 둘·크레인) · 고가 선로와 멈춘 전철(보기만) · 발견 열여섯(place 128) · 표: 순간이동 셋(a_pass·a_statue 신상·a_tower)·들판 무리 셋·상자 다섯·별조각 셋·채집 넷·탐사지 둘(a_market·a_rail)·지도 이름 · 자동 점검 새 `tools/probe_amber.gd`(`SAGA_AMBER_PROBE=1`) 6항목 — 결말 전엔 고개에서 막히고 뒤엔 걸어서 넘음 | — |
| 53-2 | **이야기 9부 제30장 "멈춘 거리"** | `data/story.gd` NPCS `chorong`(시계 수리공 초롱, 현대 — 손목시계 속 틈 조각 태엽 덕에 혼자 안 굳음, 9부(ch 29~)부터 늘 시계방 서쪽 앞 (6.25,5.3)) · 한별 9부 자리 = 은하 나루 착륙판 곁(하늘 사당 자리보다 먼저) · 반디 STATIONS 30장 0 착륙판 → 1~(뒤에도) 굳은 거리 시계방 남서쪽 · CHAPTERS ch30(ar 66, 여덟 단계: 한별(항로표 굳은 신호·고개 막이 풀림) → **고개 넘어 거리 어귀**(go amber (3,7.5)) → **네거리 결정 짐승 넷**(kill, 있는 kind) → 초롱 → **굳은 자리 셋 신호등 앞 → 정류장 → 우체통**(light bare — `region8_amber.gd` CRYSTALS 칸, CRYSTAL_OFF_FROM 5·6·7 단계부터 녹음) → 초롱(사람은 녹여도 시간은 안 흐름 — 서쪽 장터 결정) · 신호등은 빨강 그대로 · 자동 점검 새 `tools/probe_story9.gd`(`SAGA_STORY9_PROBE=1`) 9항목 | — |
| 53-3 | **이야기 9부 제31장 "호박 속 장터"** | `data/story.gd` NPCS `neoul`(장돌뱅이 너울, 과거 — 벙거지, 장터 결정이 깨진 뒤(31장 2~, 뒤에도) 장터 가운데 굳어 있던 자리) · 초롱 STATIONS 31장 1~4 장터 동쪽 앞(석등 고리 밖) · CHAPTERS ch31(ar 68, 일곱 단계: 초롱(장터 노래 "해 뜨면 장이 서고, 달 뜨면 셈을 하고, 별 뜨면 짐을 싼다") → **장터 석등 해 → 달 → 별**(seal **bare** 새로 — 제단 돌·불 없이 석등 셋이 결정 돔을 둘러쌈, hit_text, `region8_amber.gd` MARKET_FREE_STEP 2 부터 돔 깨짐) → 너울 → **조각 도둑 쫓기**(chase body drone, 네거리를 한 바퀴 도는 길 열한 점) → 너울(저울추 = 틈 조각 태엽) → **되감는 괘종시계 지키기**(defend bare, 시계방 서쪽 괘종시계 칸, 물결 셋 — 가게 벽 쪽을 뺀 dirs, `CLOCK_WIND_STEP` 5 동안 바늘이 돎) → 초롱(한 칸 가고 멈춤 — 부양탑 꼭대기)) · 자동 점검 `probe_story9` 에 31장 8항목(합 17) | — |
| 53-4 | **이야기 9부 제32장 "짓다 만 부양탑"(9부 끝)** | `data/story.gd` NPCS `saegil`(탑 설계사 새길, 미래 — 바이저, 높은 데를 무서워함, 31장 끝(6)부터 탑 발치 남쪽 (4.0,1.62)) · 초롱 STATIONS 32장 5 탑 밑 광장 · MEMBERS `story_chorong`(★4 **암·법구** — 태엽 손목시계, 이야기 동료에 없던 짝) · `data/kits.gd` 초롱 고유(태엽 괘종 zone·되감은 시간 rain) · `combat/field_enemy.gd` `amber_turtle`(호박 등딱지 거북, 암, 코드 몸 turtle 5m — 호박빛 등딱지·잿빛 몸, 내려찍기·바위 줄·물기·고리, 2단계 암 방패(초)) · CHAPTERS ch32(ar 70, join story_chorong, 여섯 단계: 새길 → **탑 벽 타기**(climb above 12 = TOWER_H) → **태엽 심장**(light bare lift 12 — `region8_amber.gd` HEART_OFF_STEP 3) → 새길(탑 밑 광장이 울린다) → **이야기 보스 호박 등딱지 거북**(duel 광장 (4.8,1.6) — FLOW_STEP 5 부터 신호등 초록) → 초롱 합류(반디 — 굳은 신호가 지도 가장자리 너머로 = 10부 떡밥)) · 자동 점검 `probe_story9` 에 32장 7항목(합 24) | — |
| 54-1 | **이야기 10부 무대 — 아홉째 지역 갈무리 벌** | 새 `world/region9_vault.gd` · `test_map.gd` REGIONS `vault`(9×9, 원점 (432,0,−480) — 서리봉 고원 동쪽 변에 붙임, 지도에서 비어 있던 북동쪽 끝, 고원 (8,3) 을 길 `=` 로 열어 이 지역 (0,3) 길과 이음) · 고개 빛 울타리(9부 끝 ch ≥ 32 뒤 꺼짐, 충돌) · 명소: 시간 씨앗 금고(VAULT_CELL, 반지름 11·벽 12m 충돌 + 지붕 충돌 — 안으로는 남쪽 문만, 문은 34장 DOOR_OPEN_STEP 6 부터 열림 · 안: 굳은 순간 진열장 다섯(청하 잔치·별배·막차·궁궐·네거리)·해미 진열장(35장 HAEMI_FREE_STEP 6 부터 깨짐)·기록 기둥 9m 벽 타기·윗면 갈무리의 핵(CORE_DIM_STEP 5 부터 꺼짐)) · 동력 기둥 둘(PYLONS — 34장 PYLON_OFF_FROM 5·6) · 곳간 마을(다락 곳간 충돌·문은 34장 GRANARY_OPEN_STEP 2 부터 열림) · 물류 야적장(창고·컨테이너 더미 충돌·갠트리 크레인) · 운반 드론 셋(야적장 ↔ 금고, 보기만) · 고개 장승 · 발견 열여섯(place 144) · 표: 순간이동 셋(g_pass·g_statue 신상·g_vault)·들판 무리 셋·상자 다섯·별조각 셋·채집 넷·탐사지 둘(g_granary·g_yard)·지도 이름·지형 색 · 자동 점검 새 `tools/probe_vault.gd`(`SAGA_VAULT_PROBE=1`) 6항목 — 9부 전엔 고개에서 막히고 뒤엔 걸어서 넘음 | — |
| 54-2 | **이야기 10부 제33장 "지도 가장자리 너머"** | `data/story.gd` NPCS `maru`(창고지기 마루, 현대 — 10부(ch 32~)부터 늘 창고 셔터 앞 (6.2,5.2)) · 반디 STATIONS 33장 0 굳은 거리 → 1 고원 관측소 하람 곁 → 2~(뒤에도) 갈무리 벌 창고 앞 (6.0,5.3) · 하람은 늘 관측소 앞 · CHAPTERS ch33(ar 72, 여섯 단계: 반디(굳은 신호 = 지도 가장자리 너머 동쪽) → 하람(레이더에 드론 편대·빛 울타리가 꺼짐) → **벌 어귀**(go vault (0.9,3.0)) → **야적장 결정 짐승 넷**(kill (5.6,4.6)) → **조각 운반 드론 쫓기**(chase body drone, 야적장 → 길 → 동력 기둥 사이 → 금고 문 앞 열한 점) → 마루(드론은 날마다 조각을 금고로 · 문은 동력 기둥 둘이 붙들고 동력은 곳간 마을에서 — 34장 떡밥)) · 보상 fate_knot 8·모라 15만·book_l 8·talent_3 3·경험 700 · 자동 점검 새 `tools/probe_story10.gd`(`SAGA_STORY10_PROBE=1`) 7항목 | — |
| 54-3 | **이야기 10부 제34장 "곳간의 씨앗"** | `data/story.gd` NPCS `sodam`(곳간지기 소담, 과거 — 곳간 문이 열린 뒤(34장 2~, 뒤에도) 곳간 문 앞 서쪽 (1.15,5.5), 동력 기둥부터(4~, 뒤에도) 금고 문 앞 두 기둥 사이 (4.0,2.3)) · 마루 STATIONS 34장 1~ 곳간 동남쪽(석등 고리 밖) · CHAPTERS ch34(ar 74, 일곱 단계: 마루(곳간 노래 "별 보고 나가, 해 보고 거두고, 달 보고 들인다") → **곳간 석등 별 → 해 → 달**(seal bare, GRANARY_OPEN_STEP 2 부터 곳간 문이 열림) → 소담 → **씨앗 곳간 지키기**(defend bare, 곳간 문 앞 (1.4,5.55), 물결 셋 — 곳간 쪽(북)을 뺀 dirs) → **동력 기둥 서 → 동**(light bare — PYLON_OFF_FROM 5·6) → 소담(금고의 목소리 "아름다운 때를 영원히" — DOOR_OPEN_STEP 6 금고 문 열림)) · 보상 fate_knot 8·모라 15.5만·book_l 8·talent_3 3·경험 720 · 점검 `probe_story10` 에 34장 8항목(합 15) | — |
| 54-4 | **이야기 10부 제35장 "갈무리"(10부 끝)** | `data/story.gd` NPCS `haemi`(씨앗 보관사 해미, 미래 — 바이저, 금고 안에 들어선 뒤(35장 1~, 뒤에도) 해미 진열장 자리 = `region9_vault.gd` case_pos(HAEMI_CASE_DEG)) · `garmuri`(금고 관리 인공지능 갈무리, 미래 — 몸 drone, 기둥 윗면에 선 뒤(4) 핵 곁 lift 11 에 한 번) · 소담 STATIONS 35장 1~(뒤에도) 금고 문 안쪽 (4.0,1.6667) · MEMBERS `story_haemi`(★4 **초·한손검** — 씨앗 칼, 이야기 동료에 없던 짝) · `data/kits.gd` 해미 고유(씨앗 가르기 dash·싹 틔우는 칼 infuse) · `combat/field_enemy.gd` `vault_queen`(금고 파수 드론 여왕, 풍, 코드 몸 bird 4.6m — 합금 몸·푸른 날개 끝·씨앗빛 눈, 틈새 질주·회오리·고리·내려찍기·밀물 줄, 2단계 풍 방패(암)) · CHAPTERS ch35(ar 76, join story_haemi, 일곱 단계: 소담 → **금고 안 진열관**(go (4.0,1.6) r4) → 해미(진열장 속 — 굳은 자리의 정체: 갈무리가 돌아가려던 조각을 붙잡아 굳힘) → **기록 기둥 벽 타기**(climb above 9 = PILLAR_H) → 갈무리("변하는 것은 사라진다, 나는 지킨다" — CORE_DIM_STEP 5 핵 꺼짐) → **이야기 보스 금고 파수 드론 여왕**(duel 금고 앞 동력 기둥 사이 광장 (4.0,2.45) — HAEMI_FREE_STEP 6 진열장 깨짐) → 해미 합류(소담 씨앗 한 줌 · 11부 떡밥 "틈이 처음 찢어진 순간")) · 보상 fate_knot 9·모라 17.5만·book_l 9·talent_3 4·경험 760 · 점검 `probe_story10` 에 35장 8항목(합 23) · probe_kits 고유 18·합류 13 | — |
| 55-1 | **이야기 11부 무대 — 열째 지역 세갈래 고을** | 새 `world/region10_fork.gd` · `test_map.gd` REGIONS `fork`(9×9, 원점 (0,0,−912) — 서리봉 고원 북쪽 변에 붙임, 고원 row0 (4,0) 을 길 `=` 로 열어 이 지역 (4,8) 길과 이음) · 고개 호박 장막(38장 MOMENT_FREE_STEP 4 뒤 걷힘, 충돌 — 그전엔 36장 금고 가장 깊은 진열장 sail 로만 들어옴) · 명소: 고을 성문(문루 둘·짧은 성벽 충돌, 가운데 5m 열림) · 대장간(충돌, 멈춘 화덕 불) · 세갈래 길목(이정표 · 머리 위 하늘 틈 RIFT_Y 42 · 멈춘 별까마귀 CROW_Y 20 — 38장 CROW_WAKE_STEP 1 부터 사라짐) · 선로 공사장(천막·선로)·멈춘 증기 기관차(충돌) · 종루(TOWER_H 10 벽 타기) · 격자 말뚝 셋(LATTICES 역참길 끝·선로 끝·종루 위 — 37장 LATTICE_OFF_FROM 2·5·7) · 공중에 멈춘 호박 알갱이 48(순간이 풀리면 사라짐) · 발견 열여섯(place 160) · `region9_vault.gd` 가장 깊은 진열장(북쪽 벽 앞 DEEP_CASE_R 9.5 — 10부 끝(ch ≥ 35) 뒤 드러나고 순간이 풀리면 깨짐) · 표: 순간이동 셋(h_gate·h_statue 신상·h_junction)·들판 무리 셋·상자 다섯·별조각 셋·채집 넷·탐사지 둘(h_forge·h_works)·지도 이름·지형 색 · 자동 점검 새 `tools/probe_fork.gd`(`SAGA_FORK_PROBE=1`) 6항목 — 순간이 풀리기 전엔 고개에서 막히고 뒤엔 걸어서 넘음 | — |

**남은 격차(㊴ 뒤 순서, 2026-09-25 원신 대조)**: ~~① 활 조준 사격(충전 원소 화살·과녁 퍼즐)~~ ㊵ 끝 ~~② 지도에 세계 임무 표(맡을 수 있는 !·진행 중 ◇)~~ ㊶ 끝 ~~③ 낚시~~ ㊷ 끝 ~~④ 업적~~ ㊸ 끝 ~~⑤ 탐사 파견~~ ㊹ 끝 ⑥ 이야기 2부 → ㊺ 로 시작(아래 "이야기 2부") · 사용자 결정: 기원(뽑기 — 지금은 사당 시련·등용이 인물 얻는 길). 이름·그림·수치는 이 판 것으로(오마주 규칙 그대로).

**이야기 2부(㊺~, 2026-09-25)**: "이어해"(범위 질문에 답 없이 — 진행 신호로 받아 아래 안으로). 무대 = 넷째 지역 서리봉 고원(마을 북쪽 고개 너머, 과거·현대·미래 한 고원). 순서: ㊺-1 지역 땅(끝) → ㊺-2 제10장 "서리 고개 너머"(끝)(촌장 → 고개 → 고원 신상 → 관측소 앞 눈여우 무리 → 관측원 하람(현대) → 따라가 추락한 비행선 → 조종 기계 반디(미래, 코드 몸)) → ㊺-3 제11장 "얼음 아래 산성"(끝)(하람 날씨 지도 → 산성지기 바우(과거) → 호수 석등 차례 → 파수 → 봉화 불씨 → 문루 앞 봉화 제단 지키기) → ㊺-4 제12장 "떨어진 별배"(끝)(얼음굴 이야기 보스 틈새 서리 구미호·별배 심장·2부 동료 하람 — 답 없이 "이어해"라 하람으로). **2부 끝.** 3부 실마리: 별배 날개 조각 셋이 여러 시대에 흩어졌고 구미호도 틈 너머로. 그 뒤 후보(㊻ 고원 다듬기, 답 없이 "이어해"면 차례대로): ~~고원 들판 보스~~ ㊻-1 끝 · ~~탐사지 둘~~ ㊻-2 끝 · ~~고원 특산물~~ ㊻-3 끝(눈꽃 — 답 없이 "이어해"라 추천안) · ~~눈 전용 팔레트~~ ㊻-4 끝(셰이더 눈) · 그다음 3부(별배 날개 조각 셋).

**이야기 3부(㊼~, 2026-09-26)**: 2부 끝 실마리 "별배 날개 조각 셋이 여러 시대에 흩어졌다·구미호도 틈 너머로" — 새 지역 대신 탐사 파견이 이름만 쓰던 세 자리를 실제 명소로(`world/era_sites.gd`). 순서: ~~㊼-1 제13장 녹슨 조선소의 날개(포구·현대, 기중기 오르기·용접대 지키기)~~ 끝 → ~~㊼-2 제14장 시간 틈 관측소(폐허·미래 — 떠 있는 관측대·틈 석등·시간 기둥)~~ 끝 → ~~㊼-3 제15장 옛 역참 길(마을·과거 — 파발꾼 달음, 놀란 역마 쫓기, 여우불 구미호, 조각 셋을 모아 별배가 뜬다·3부 동료 달음 — 답 없이 "이어해"라 그 장 주인공인 파발꾼으로)~~ 끝. **3부 끝.** 4부 실마리: 뜬 별배가 틈이 닫히는 방향 — "이 배가 온 시대"로. 이름·인물은 이 판 것(가상).

**이야기 4부(㊽~, 2026-09-26)**: 3부 끝 뒤 "이어해"(후보 셋 중 첫째) — 별배가 온 시대. 2부처럼 새 지역부터: 다섯째 지역 은하 나루(마을 서쪽 숲 끝 틈 고개 너머, 미래 중심에 과거 절터·현대 역). 순서: ~~㊽-1 지역 땅~~ 끝 → ~~㊽-2 제16장 별배가 돌아온 나루~~ 끝(나루지기 아라(미래) · 계류 탑 벽 타기로 신호 · 별배가 고원에서 날아와 나루에 매임 · 매인 별배 지키기 · 별배 항해 기록 "선장이 절터 종소리를 따라 틈으로") → ~~㊽-3 제17장 옛 절터의 종~~ 끝(종지기 한결(과거) · 쓰러진 종 곁 무리 · 종 감은 이끼 이무기 · 별배가 종을 들어 종각에 · 원소로 종 울리기 · "종이 다시 울리면 막차가 한 번 더 온다") → ~~㊽-4 제18장 은하역 막차~~ 끝(기관사 도담(현대) · 변전함에 전기 · 선장의 잔상 쫓기 · 막차 지키기 · 동료 도담) = **4부 끝**. 5부 실마리: 선장은 막차 행선지 "틈 너머 첫 정거장"에 먼저 내렸다. 이름·인물은 이 판 것(가상).

**이야기 5부(㊾~, 2026-09-26)**: 4부 끝 뒤 "이어해"(후보 셋 중 첫째) — 선장을 만나러 틈 너머로. 4부처럼 새 지역부터: 여섯째 지역 틈새 갈림길(은하역 선로 끝 고개 너머, 시간 틈 안쪽 — 과거·현대·미래가 한 땅에 가장 심하게 뒤엉킴). 순서: ~~㊾-1 지역 땅~~ 끝 → ~~㊾-2 제19장 틈 너머 첫 정거장~~ 끝(막차 타기 · 시계탑 태엽 · 섬돌 꼭대기의 선장 한별 · 멈춘 시간의 파수꾼 · 반디 기본 자리를 은하 나루로) → ~~㊾-3 제20장 갈림길 끝~~ 끝(첫 정거장 위 하늘에 뜬 섬 · 세 갈래 선로·시대 닻 · 매듭 석등·매듭 제단 · 틈 삼킨 별까마귀 · 동료 한별) = **5부 끝**. 이름·인물은 이 판 것(가상).

**이야기 6부(㊿~, 2026-09-27)**: 5부 끝 뒤 "이어해"(후보 셋 중 첫째) — `../scenario/saga-go.md` 6부 장 카드. 새 지역부터: 일곱째 지역 잠긴 도읍(포구 남쪽 바다 — 틈이 닫히며 굳은 시대 조각, 과거 궁궐·현대 해저 기지·미래 빛 돔). 순서: ~~㊿-1 지역 땅~~ 끝 → ~~㊿-2 제21장 바다 밑 등불~~ 끝(별배 → 기지 앞 물짐승 → 잔교 끝 잠수정 선착장 → 여울 → 잠수정으로 물속 불빛 따라 궁궐 기단) → ~~㊿-3 제22장 잠긴 궁궐의 해녀~~ 끝(곁채 지붕의 물새 · 바지락 기름 · 물길 석등 · 자물쇠 지키기 · 돔 문 열림 · 돔 안 심해 등불아귀) → ~~㊿-4 제23장 빛 돔의 기록~~ 끝(파랑 · 등대 돌탑 오르기 · 등롱 불 · 반디의 지워진 기록 — 먹구름을 부리는 가면 그림자 · 돔 파수 거신 · 동료 물새) = **6부 끝**. 이름·인물은 이 판 것(가상).

**이야기 7부(51~, 2026-09-27)**: 6부 끝 뒤 "이어해" — `../scenario/saga-go.md` 7부 장 카드(이번에 짬). 무대부터: 구름 위 항로(잠긴 도읍 남쪽 하늘에 뜬 섬 셋 — 과거 하늘 사당·현대 비행선 잔해·미래 궤도 정거장 조각, 바람 기둥과 활공으로 잇는다). 순서: ~~51-1 무대~~ 끝 → ~~51-2 제24장 하늘 사당의 바람 방울~~ 끝(별배로 사당 섬 · 무녀 새벽 · 먹구름 졸개 · 바람 방울 셋 차례 · 먹구름 걷힘) → ~~51-3 제25장 멈춘 기상 비행선~~ 끝(바람 기둥 → 잔해 섬 · 비행사 하늬 · 구름 씨앗 드론 쫓기 · 기관 재시동 지키기) → ~~51-4 제26장 궤도 조각의 그림자~~ 끝(구름 씨앗 장치 셋 끄기 · 가면 그림자 · 이야기 보스 먹구름 임금의 그림자 · 동료 하늬 ★4 빙·장병기) = **7부 끝**. 번호 51 은 106장 안 절 번호(원 숫자는 ㊿ 까지라 아라비아 숫자로 — 51장 확장과 다르다).

**이야기 8부(52~, 2026-09-27)**: 7부 끝 뒤 "이어해" — `../scenario/saga-go.md` 8부 장 카드(이번에 짬, **1차 결말**). 새 지역 없이 청하로 돌아와 1부 여섯 제단 = 시간 틈을 묶던 "여섯 매듭"을 다시 묶고, 가면 그림자(= 먹구름 임금의 참몸)와 마지막 대결. 순서: ~~52-1 무대(여섯 매듭·먹구름 눈)~~ 끝 → ~~52-2 제27장 풀리는 매듭~~ 끝(촌장 · 은비 탁본 뒷면 · 폐허 첫째 · 옛길 둘째 석등 · 나그네 — 처음 가면 무늬 · 봉우리 셋째 · 해솔) → ~~52-3 제28장 여섯째 매듭~~ 끝(곶 지키기 · 바위섬 석등 · 구름섬 · 가면 그림자 정체 · 먹구름 눈이 열림) → ~~52-4 제29장 먹구름의 근원~~ 끝(편성 시험: 과거·현대·미래 동료 하나씩 · 먹구름 눈 · 매듭 등불 지키기 · 이야기 보스 먹구름 임금 참몸 · 잔치) = **8부 끝, 1차 결말** → ~~52-5 결말 뒤~~ 끝(모든 지역 밤 사건·재대결 — 주간 보스 틀).

**이야기 9부(53~, 2026-09-27)**: 결말 뒤 "이어해" — `../scenario/saga-go.md` 9부 장 카드(이번에 짬, 실마리 2 "굳은 자리"). 새 지역부터: 여덟째 지역 굳은 거리(은하 나루 북쪽 고개 너머, 현대 중심 — 과거 장터·미래 부양탑). 순서: ~~53-1 지역 땅~~ 끝 → ~~53-2 제30장 멈춘 거리~~ 끝(한별 → 고개 → 네거리 결정 짐승 → 시계 수리공 초롱 → 굳은 자리 셋 light bare → 초롱) → ~~53-3 제31장 호박 속 장터~~ 끝(장터 석등 해 → 달 → 별 → 장돌뱅이 너울 → 조각 도둑 쫓기 → 시계방 지키기) → ~~53-4 제32장 짓다 만 부양탑~~ 끝(설계사 새길 → 탑 벽 타기 → 태엽 심장 light bare → 이야기 보스 호박 등딱지 거북(암, turtle 몸) → 동료 초롱 ★4 암·법구) = 9부 끝. 단계 번호는 `region8_amber.gd` CH30~32·CRYSTAL_OFF_FROM·MARKET_FREE_STEP·HEART_OFF_STEP·FLOW_STEP 과 맞춘다.

**이야기 10부(54~, 2026-09-27)**: 9부 끝 뒤 "이어해" — `../scenario/saga-go-part10.md` 10부 장 카드(이번에 짬 — saga-go.md 가 30KB 한도에 가까워 부로 나눔. 떡밥 32장 "굳은 신호가 지도 가장자리 너머로"·31장 "도둑 드론은 조각을 한곳으로"). 새 지역부터: 아홉째 지역 갈무리 벌(서리봉 고원 동쪽 절벽 너머, 미래 중심 — 과거 곳간 마을·현대 물류 야적장·미래 시간 씨앗 금고). 2차 흐름의 적 = 금고 관리 인공지능 갈무리("아름다운 때를 영원히"). 순서: ~~54-1 지역 땅~~ 끝 → ~~54-2 제33장 지도 가장자리 너머~~ 끝(반디 → 고원 하람 → 고개 → 야적장 결정 짐승 → 운반 드론 쫓기 → 창고지기 마루) → ~~54-3 제34장 곳간의 씨앗~~ 끝(마루 → 곳간 석등 별 → 해 → 달 → 곳간지기 소담 → 곳간 지키기 → 동력 기둥 둘 light bare → 소담, 금고 문 열림) → ~~54-4 제35장 갈무리~~ 끝(소담 → 금고 안 → 해미 목소리 → 기록 기둥 벽 타기 → 갈무리 → 이야기 보스 금고 파수 드론 여왕(풍, bird 몸) → 동료 해미 ★4 초·한손검) = 10부 끝. 단계 번호는 `region9_vault.gd` CH33~35·GRANARY_OPEN_STEP·PYLON_OFF_FROM·DOOR_OPEN_STEP·CORE_DIM_STEP·HAEMI_FREE_STEP 과 맞춘다.

**이야기 11부(55~, 2026-09-27)**: 10부 끝 뒤 "이어해" — `../scenario/saga-go-part10.md` 11부 장 카드(이번에 짬, 2차 흐름의 끝 = 2차 결말. 중심 시대는 과거 — 9부 현대·10부 미래 다음). 떡밥 35장 "틈이 처음 찢어진 순간". 새 지역부터: 열째 지역 세갈래 고을(서리봉 고원 북쪽 — 처음엔 금고 가장 깊은 진열장으로만). 순서: ~~55-1 지역 땅~~ 끝 → 55-2 제36장 가장 깊은 진열장(해미 → 진열장 속으로 sail → 대장장이 벼리 → 성문 앞 결정 짐승 → 벼리 따라 대장간 → 벼리) → 55-3 제37장 세 갈래 길(벼리 → 역참길 말뚝 → 측량 기사 나래 → 기관차 지키기 → 선로 말뚝 → 종루 벽 타기 → 종루 말뚝 → 벼리) → 55-4 제38장 처음의 순간(벼리 → 이야기 보스 처음의 별까마귀(뇌) → 갈무리 참몸 등장 → 이야기 보스 갈무리 참몸(암) → 해미(순간이 풀림) → 고원 고개 → 촌장 누리 둘째 잔치 · 동료 벼리 ★4 화·양손검) = 11부 끝, 2차 결말. 단계 번호는 `region10_fork.gd` CH36~38·LATTICE_OFF_FROM·CROW_WAKE_STEP·MOMENT_FREE_STEP 과 맞춘다.

**웹 사가고 이식**(2026-09-25 사용자 지시): 이 장 ①~㉝ 을 웹판에 옮기는 순서는 `saga-web/saga-go/PLAN.md` §5 ⑲(순서 1~15). GO 에 새 번호(㉞~)를 더하면 그 표 끝에도 한 줄 더한다.

- 진척·실기 대기는 `docs/PROJECT_STATE.md`, 경위는 `docs/HISTORY.md` 날짜 항목.
- 각 갈래는 헤드리스 자동 점검 + `godot_regress.sh` 통과 후 커밋, 실기 확인은 몰아서.

---

# 107. 고정 특색 지역 (2026-09-24 사용자 결정 — `../SAGA-DESIGN.md` §12, 일곱 판 공통)

사용자: "전체 지역을 랜덤이 아닌 사가블로처럼 각각 특색이 있는 지역으로" · "모든 프로젝트에 적용". 본보기는 웹 사가블로 §5.12(방위별 이름 있는 지역 아홉·지역 명단·위험도)·사가고 ⑮(땅 열여섯).

- **지금(2026-09-24 조사)**: GO `data/test_map.gd` REGIONS 셋(마을·해안·폐허)은 고정 원점, 산 잡음은 고정 씨앗(20260923) — 무작위는 아니지만 지역마다 가진 속성이 적다. FOREST `forest_biome.gd` 바이옴 넷은 고정 사분면. STORY 는 판마다 맵 파일, 미궁만 `randi`. DUNGEON 은 방 무드 순환 + `randf` 스폰.
- **할 일**: ① GO 지역 표에 이름·사연·땅빛·소품 묶음·몬스터 명단·위험도를 붙이고 `terrain_builder.gd`·스포너가 읽게 한다(원신 기준 106장의 "지역 잇기" 와 한 몸) ② FOREST 바이옴 넷에 이름·명소·짐승 명단 ③ STORY 미궁은 회차형 예외로 두되 층마다 고정 명소 하나 ④ DUNGEON 은 무작위 방 사이에 손으로 짠 명소 층(웹 사가블로 §5.15 결).
- 이 장은 방향만 적는다 — 착수는 이 트랙 세션이 PLAN 106 순서와 맞춰 정한다(다른 세션이 GO 코드를 동시에 고치는 중일 수 있다).

# FINAL RULE

Claude Code는 이 문서를 한 번에 1~100까지 실행하지 않는다.

반드시:

```text
현재 Step 확인
↓
해당 Step만 실행
↓
검증
↓
상태 기록
↓
다음 Step
```

방식으로 진행한다.

특히 최초에는:

```text
Legacy Audit
→ Architecture
→ Vertical Slice
→ Project Foundation
```

까지만 집중한다.

**완성 게임을 한 번에 만들지 않는다.**

먼저:

> "작지만 그래픽이 좋고, 이동이 좋고, 전투가 재미있고, 탐험하고 싶고, 보상을 얻고 다시 플레이하고 싶은 3D 모바일 게임"

을 만든다.

그 이후에 SAGA GO / DUNGEON / FOREST / STORY / REALM을 확장한다.

**기존 1~80번의 장점은 버리지 않되, 구조적 중복과 낡은 구현 방식은 과감하게 제거하고 신규 Godot 4.x 구조에 맞게 재해석한다.**