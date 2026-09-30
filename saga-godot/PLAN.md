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

**106장 표(행 ①~56-2)와 이야기 부 설명 문단은 `docs/spec/` 로 옮겼다**(내용 불변 — 장·행 번호는 그대로 인용한다):

- 행 ①~㉑ → `docs/spec/106-a.md`
- 행 ㉒~㉝ → `docs/spec/106-b.md`
- 행 ㉞~㊹ → `docs/spec/106-c.md`
- 행 ㊺~㊿ → `docs/spec/106-d.md`
- 행 51~56 → `docs/spec/106-e.md`
- 남은 격차·이야기 2~11부 설명·웹 이식 문단 → `docs/spec/106-story-parts.md`

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