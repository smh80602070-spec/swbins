<!-- 옮김: PLAN.md `## 3.1 Vertical Slice First` · BASE 7d80c15d -->

## 3.1 Vertical Slice First

처음부터 완성 게임을 만들지 않는다.

먼저 다음이 모두 들어간 **작은 플레이 가능한 Vertical Slice**를 완성한다.

플레이어 → 월드 이동 → 탐험 → NPC → 퀘스트 → 몬스터 → 실시간 전투 →
스킬 → 보상 → 장비 → 성장 → 다음 지역 이동 → 저장/로드

까지 하나의 재미있는 게임 루프를 완성한다.

Vertical Slice가 재미있지 않으면 콘텐츠를 늘리지 않는다.

**첫 슬라이스는 saga-godot과 같은 범위로 잡는다** — 사가만리(GO)의
"도적의 습격" 하나. `saga-godot/docs/VERTICAL_SLICE.md`가 이미 이 범위를
검토해 뒀다(걷기 → 주민 대화 → 사건 조우 → 전투 → 승리 → 등용 → 저장,
보스·퀘스트·던전·장비는 의도적으로 제외). 같은 범위를 쓰면 두 트랙의
결과물을 나중에 공정하게 비교할 수 있다 — 이 문서가 범위를 다시 고민하지
않는다.

---

# 4. 기존 1~80번·레거시 자료 통합 규칙

**`saga-godot/docs/LEGACY_FEATURE_AUDIT.md`를 그대로 재사용한다.** 다섯 웹
판의 PLAN/PLAN1/PLAN2·README를 다시 읽고 KEEP/REWORK/MERGE/DROP을 다시
분류하지 않는다 — 이미 끝나 있다. 이 문서에서 게임 디자인(5장)·데이터
구조(7장) 논의는 그 감사 결과와 일관되게 맞춘다.

다만 **Unity 고유의 REWORK 여지**가 있으면 여기 별도로 적는다:

### Unity에서 REWORK 후보

- (착수 전 — Phase 2에서 실제로 Unity 프로젝트를 만들며 채운다)

---

# 5. 5개 게임의 역할 재정의

**`saga-godot/PLAN.md` 5장과 완전히 동일하다** — 게임 디자인은 엔진과
무관하다. 요약만 옮긴다(자세한 것은 그 문서 참고, 다시 쓰지 않는다):

| 게임 | 핵심 | 게임 감각 |
|---|---|---|
| SAGA GO | 탐험·이동·지역 발견·수집·몬스터·이벤트·지도 콘텐츠·성장 | "계속 돌아다니고 발견하고 싶다." |
| SAGA DUNGEON | 던전 탐험·실시간 전투·몬스터·엘리트·보스·장비·스킬·랜덤 이벤트·보상 | "한 판 더 돌고 더 좋은 장비를 얻고 싶다." |
| SAGA FOREST | 넓은 자연환경·동물·채집·탐험·생활 콘텐츠·NPC·마을·자연 이벤트·숨겨진 장소 | "그냥 돌아다녀도 재미있다." |
| SAGA STORY | 스토리·NPC·대화·퀘스트·선택·지역 사건·캐릭터 관계·메인/서브 스토리 | "다음 이야기가 궁금하다." |
| SAGA REALM | 넓은 세계·지역·세력·도시·영지·전쟁/분쟁·영웅·성장·전략적 콘텐츠 | "내가 이 세계를 성장시키고 있다는 느낌." |

주의: 예전에 한 세션이 이 5장을 "제네릭 판타지 몬스터 RPG"로 잘못
재정의했던 사고가 있었다(`saga-godot` 감사 기록 참고) — **다섯 게임 모두
"역사 인물로 노는" 정체성**을 유지한다. 인물·장수 이름은 실명이 아니라
가명(루트 `CLAUDE.md`의 이름 정책, 이 트랙에도 그대로 적용).

---

# 6. 공통 SAGA Core Architecture

5개 프로젝트가 공유할 수 있도록 다음 시스템을 공통화한다. Unity에서는
**Assembly Definition(`.asmdef`)으로 계층을 나눠**, 게임별 코드가
Core 내부 세부사항에 의존하지 않게 한다(49장).

```text
SagaCore (Assets/SagaCore/, SagaCore.asmdef)
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
├── MobileInput
├── UI
├── Localization
├── Data
└── Performance
```

게임별 콘텐츠만 별도 모듈로 만든다.

---

# 7. 데이터 기반 설계

게임 데이터를 코드에 하드코딩하지 않는다.

Unity에서는:

- **ScriptableObject** — Godot Resource의 직접적 대응. 데이터 애셋
  (`EnemyData`, `ItemData`, `QuestData` 등)은 전부 ScriptableObject로 정의한다
- JSON (세이브 데이터, 외부에서 가져오는 밸런스 표)
- CSV (표 형태 밸런스 데이터, 필요하면)

를 활용한다.

```text
Assets/Data/
├── Characters/     (ScriptableObject: CharacterData)
├── Enemies/        (ScriptableObject: EnemyData)
├── Bosses/
├── Items/
├── Equipment/
├── Skills/
├── Quests/
├── Dialogue/
├── Maps/
├── Events/
└── Balance/
```

예:

```csharp
[CreateAssetMenu(menuName = "Saga/EnemyData")]
public class EnemyData : ScriptableObject {
    public string id;
    public string displayName;
    public int level;
    public int hp;
    public int attack;
    public int defense;
    public float moveSpeed;
    public float attackRange;
    public SkillData[] skills;
    public DropTableData dropTable;
    public AiType aiType;
}
```

콘텐츠 추가를 위해 핵심 코드를 수정하지 않아도 되도록 한다.

---

# 8. 실제 3D 에셋 구조

최종 게임은 실제 3D 에셋 기반으로 구성한다.

지원(Unity 기본 임포터가 다 받는다):

- FBX, GLB/GLTF (Unity 임포터가 직접 지원)
- PNG, JPG, WebP
- Texture, Animation(Animator/Animation Clip), Material(URP Lit/Simple Lit)

권장 구조:

```text
Assets/Art/
├── Characters/
├── Enemies/
├── Bosses/
├── Animals/
├── Buildings/
├── Environment/
├── Vegetation/
├── Rocks/
├── Props/
├── Weapons/
├── Armor/
├── Effects/
├── UI/
└── Audio/
```

Placeholder(Unity 기본 Primitive: Cube/Capsule/Cylinder)는 개발 초기
테스트용으로만 사용한다. 최종 게임의 주요 화면에는 실제 에셋을 사용한다.
`saga-godot`이 쓰는 CC0 에셋 소스(Kenney·Quaternius·ambientCG·Mixamo 등)를
이쪽도 그대로 재사용할 수 있다 — 라이선스가 같으니 새로 찾을 필요 없다.

---

# 9. 월드 품질 목표 · 10. 월드 디자인 원칙

**`saga-godot/PLAN.md` 9·10장과 동일**(엔진 무관 — 다시 쓰지 않는다):
각 지역에 Terrain·Landmark·Buildings·Vegetation·Rocks·Props·NPC·Animals·
Enemies·Hidden Area·Resource Area·Event Area·Dungeon/POI가 최소한씩
있어야 하고, "여기는 아무것도 없다"는 느낌을 최대한 피한다. 크기보다
밀도와 발견의 재미를 우선한다.

---

# 11~30. 전투·성장·장비·퀘스트·NPC·동물·이벤트·던전 설계

**`saga-godot/PLAN.md` 11~30장과 동일한 설계 원칙을 따른다** — 이 부분은
게임 디자인이라 엔진과 무관하다. 요점만:

- 전투: Move→Target→Attack→Skill→Dodge/Defense→Enemy Reaction→Reward 구조.
  기본 공격·강공격/콤보·스킬·회피·피격 반응·쿨다운·자원·적 AI·거리·공격
  범위·보스 패턴을 갖춘다. 적 유형(근접/원거리/돌진/방어/마법/소환/광역/
  암살/엘리트/보스)마다 대응법이 달라야 한다.
- 보스: HP만 높은 몬스터가 아니라 단계 변화·공격 패턴·광역 공격·약점·
  회피 요구·소환·환경 활용·페이즈 변화·보상을 갖춘다.
- 성장: Level→Stats→Equipment→Skill→Build. Vertical Slice에서는
  **무기 + 장비 + 기본 옵션**까지만.
- 퀘스트: 이동·대화·수집·사냥·탐험·던전·보스·NPC 이벤트 유형, 데이터 기반
  (`QuestData` ScriptableObject: ID/Type/Conditions/Objectives/Rewards/
  Dialogue/NextQuest).
- 반복 플레이 루프: 탐험→발견→전투→보상→성장→새로운 지역/콘텐츠→더 강한
  적→더 좋은 보상→다시 탐험. 여기에 퀘스트·이벤트·수집·던전·보스·NPC·
  스토리를 연결한다.
- "계속 플레이할 이유": 다음 지역·다음 장비·레벨업·새 스킬·보스·숨겨진
  장소·NPC 이야기·새 동물·새 던전 중 항상 하나는 느끼게 한다.

---

# 19~21. 모바일 UX · 조작 · 카메라

세로/가로 모두 지원한다(Unity: `Screen.orientation` + Canvas Scaler
`Scale With Screen Size`). 화면 방향이 변경되어도 게임 상태가 유지되어야
한다.

기본 조작:

```text
Virtual Joystick + Attack + Skill Buttons + Dodge + Interact
```

Unity의 새 Input System(`com.unity.inputsystem`) On-Screen Controls로
가상 조이스틱·버튼을 구성한다(Godot 트랙의 `virtual_joystick.gd`와 같은
역할). 상황(탐험/전투)에 따라 UI를 자동 전환한다.

카메라: 3인칭 추적 카메라 — 줌·회전·거리 제한·지형 충돌(Cinemachine의
`CinemachineThirdPersonFollow` + `CinemachineDeoccluder` 사용을 권장,
직접 스크립트도 가능)·전투 시 시야 보정·건물/오브젝트 가림 처리.

---

# 22~23. 그래픽 품질 · 애니메이션

PBR Material(URP Lit)·Lighting·Shadow·Ambient Lighting·Fog·Sky·
Environment·Particle(VFX Graph 또는 Shuriken)·Post Processing(URP
Volume)을 고려하되, 모바일 성능을 우선해 효과를 선택적으로 적용한다.

캐릭터 애니메이션: Idle/Walk/Run/Attack/Hit/Death/Dodge/Skill.
**Animator Controller + Animation State Machine**을 쓴다(Godot의
AnimationTree/State Machine과 같은 역할). 몬스터도 최소한의 상태별
애니메이션을 갖는다.

---

# 24~27. NPC · 동물 · 이벤트 · 던전

**`saga-godot/PLAN.md` 24~27장과 동일한 설계**(엔진 무관, 요약만):
NPC는 이름·위치·대화·퀘스트·상점·이벤트·관계를 가진다. 동물은
Idle/Wander/Flee/Group/Interaction을 지원해 월드에 생명감을 준다.
월드 이벤트(몬스터 출현·보물 발견·NPC 이벤트·희귀 몬스터·지역/시간/랜덤
이벤트)는 데이터 기반으로 확장한다. 던전은 Entrance/Rooms/Enemies/
Elite/Event/Treasure/Boss/Reward 구조, 초기엔 수동 제작부터.

---

# 28. 세이브 시스템

저장: 플레이어 위치·레벨·경험치·장비·인벤토리·퀘스트·이벤트 상태·월드
상태. **Version 필드를 포함한다**(향후 데이터 구조 변경 대비).

Unity 구현: `JsonUtility` 또는 `System.Text.Json`으로 직렬화한
`SaveData` 클래스를 `Application.persistentDataPath`에 저장. 세이브
스키마는 `saga-godot`의 세이브 스키마·다섯 웹 판의 세이브 키 관례
(루트 `CLAUDE.md` — 세이브 키는 폴더 이름과 무관하게 고정)와 **개념은
맞추되 파일 포맷을 억지로 통일하지 않는다** — 트랙마다 자기 엔진에
자연스러운 포맷을 쓴다.

---

# 29~30. 성능 최적화 · AI 최적화

모바일을 처음부터 고려한다. 필수 검토: LOD Group, Occlusion Culling
(Unity 내장), Frustum Culling(자동), Object Pooling, Texture 압축
(ASTC 권장, 모바일 빌드), Mesh 최적화, Draw Call 감소(GPU Instancing/
SRP Batcher), Shadow 최적화(Cascade 수 축소, 모바일은 Shadow 거리 축소),
Particle 제한, AI 업데이트 주기, 물리 처리 최적화(Fixed Timestep 조정).

AI 최적화: 거리 기반 업데이트 빈도 — Near Player(High Frequency) /
Medium Distance(Reduced) / Far Distance(Low/Sleep). 월드 규모가 커져도
모바일에서 유지되도록 한다.

---

# 31. 공통 모듈 구조 (Unity 프로젝트 레이아웃)

```text
saga-unity/
├── Assets/
│   ├── SagaCore/          (SagaCore.asmdef — 공통 시스템)
│   │   ├── Combat/
│   │   ├── Character/
│   │   ├── Player/
│   │   ├── Enemy/
│   │   ├── Quest/
│   │   ├── Dialogue/
│   │   ├── Inventory/
│   │   ├── Equipment/
│   │   ├── Item/
│   │   ├── Skill/
│   │   ├── Save/
│   │   ├── World/
│   │   ├── Event/
│   │   ├── UI/
│   │   ├── Mobile/
│   │   └── Utilities/
│   ├── Games/
│   │   ├── SagaGo/        (SagaGo.asmdef — SagaCore 참조)
│   │   ├── SagaDungeon/
│   │   ├── SagaForest/
│   │   ├── SagaStory/
│   │   └── SagaRealm/
│   ├── Data/               (7장 — ScriptableObject 데이터)
│   ├── Art/                (8장 — 3D 에셋)
│   ├── Scenes/
│   └── Settings/           (URP Asset, Quality 등)
├── docs/
│   ├── PROJECT_STATE.md
│   ├── VERTICAL_SLICE.md
│   ├── PERFORMANCE.md
│   ├── ASSET_GUIDE.md
│   └── CHANGELOG.md
├── ProjectSettings/         (Unity 표준)
├── Packages/                (Unity 표준, manifest.json)
└── PLAN.md                  (이 문서)
```

게임별 asmdef는 SagaCore를 참조하되, SagaCore는 게임별 asmdef를 참조하지
않는다(단방향 의존 — 49장).

---

# 32~33. 개발 방식 · 토큰 절약 규칙

**`saga-godot/PLAN.md` 32·33장과 동일한 규칙**을 따른다(그대로 인용):

각 단계마다: 현재 상태 확인 → 필요한 파일만 읽기 → 최소 변경 → 구현 →
실행/검증 → 오류 수정 → 결과 기록.

- 프로젝트 전체 파일을 매번 읽지 않는다
- 변경 대상 파일만 읽는다
- 이미 완료된 시스템을 다시 분석하지 않는다(4장 — 레거시 감사도 포함)
- 작업 전: 현재 상태/변경 파일/목표/검증 방법만 먼저 확인한다
- 큰 파일을 불필요하게 전체 출력하지 않는다
- 동일한 코드를 복사하지 않는다, 공통 시스템을 재사용한다
- 한 단계가 끝나면 다음 단계로 넘어가기 전에 검증한다
- 기존 구현을 무조건 재작성하지 않는다
- 작업 로그를 남겨 다음 실행에서 불필요한 재분석을 방지한다

**규칙 10 — 상태·이력 분리(2026-09-16 재편으로 대체).** `docs/PROJECT_STATE.md` 는 상태만 ≤15KB 로 **덮어쓰고**, 날짜별 경위는 `docs/HISTORY.md` 에 append 한다. 이 PLAN 에는 세션 기록을 쓰지 않는다(0장·`../SAGA-DESIGN.md` §9). 2026-09-16 이전에 쌓인 장문 기록은 HISTORY.md 첫 절에 그대로 있다.

---

# 34. Claude Code 작업 상태 파일

```text
docs/
├── PROJECT_STATE.md   (상태만 ≤15KB, 덮어쓴다 — 0장)
├── HISTORY.md         (세션 이력 append-only, grep 으로만)
├── VERTICAL_SLICE.md
├── PERFORMANCE.md
├── ASSET_GUIDE.md
└── CHANGELOG.md
```

`ARCHITECTURE.md`·`LEGACY_FEATURE_AUDIT.md`는 새로 안 만든다 —
`saga-godot/docs/`의 것을 참고로 링크만 건다(0·4장).

---

# 35. 1~100 최종 작업 단계
