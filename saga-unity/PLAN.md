# SAGA 프로젝트 — Unity 6 3D 신규 구축 최종 작업지시서
## saga-godot과 나란히 가는 두 번째 엔진 트랙 / Vertical Slice 우선 / Mobile 3D RPG

## 0장 — 읽는 법 (2026-09-16 재편)

- **이야기(시나리오) 정본**: 루트 `../scenario/`(판별 다섯 벌 + 공통 틀 `README.md` — 세 트랙 공통). 다섯 판 모두 이 트랙은 아직 장이 없다. 넣는 자리는 README §6(`Data/ScenarioData.cs`·`ScenarioState.cs`), 판별 "트랙 메모"가 기존 퀘스트를 어느 장에 흡수할지 적었다. 구현하면 §7 진행표를 고친다.
- **이 파일은 정본이지만 통째로 읽지 않는다**(≈75KB). `grep -n "^# \|^## "` 로 장 목차를 뽑고 필요한 장만 `sed -n` 으로 읽는다. 장 번호(1~100·66-1·66-2·101~105)는 `docs/`·코드 주석이 가리키므로 **바꾸지 않는다**.
- **상태**는 `docs/PROJECT_STATE.md`(≤15KB, 세션 끝에 덮어쓴다). **이력**은 `docs/HISTORY.md`(append-only, 날짜·게임명으로 grep). 이 PLAN 에는 날짜 달린 세션 기록을 쓰지 않는다 — 결정이 바뀔 때만 고친다(`../SAGA-DESIGN.md` §9 문서 3층).
- 공통 개편 설계(재미 표준 8·참고 게임·그래픽·에셋·버그)는 `../SAGA-DESIGN.md`. 이 트랙 적용분은 **101~105장**(끝). 다섯 웹 판의 게임성 후보는 `../saga-web/<판>/PLAN.md` §5 — 3D 는 거기서 검증된 것을 옮긴다(101장).
- 규칙(엔진 확인·배치 모드 부작용·GUI 금지·gitignore)은 이 폴더 `CLAUDE.md` 가 정본이고 여기서 반복하지 않는다.

---

# 0. 이 문서의 위치

**이 폴더(`saga-unity/`)의 정본은 이 `PLAN.md`다.** 기존 다섯 웹 판
(saga-go·saga-dungeon·saga-forest·saga-story·saga-realm)은 이 문서를 보지
않는다 — 각자 폴더의 `PLAN.md`가 그대로 정본이다.

**`saga-godot/`과의 관계 — 경쟁이 아니라 병행.** `saga-godot/`은
2026-08-31부터 진행 중인 Godot 4.x 3D 재구축이고, 그 프로젝트의
`PLAN.md` 66-1장은 "Godot을 유지한다, Unity·Unreal로 갈아타지 않는다"를
**이미 결정하고 닫아 뒀다.** 이 문서는 그 결정을 뒤집는 게 아니다 —
**2026-09-11, 사용자가 "유니티로 전환을 추가한다, 다른 곳(다른 세션)은
Godot 작업 중이니"로 명시적으로 요청한 두 번째, 병행 트랙**이다.
- `saga-godot/`은 계속 간다. 이 폴더가 그걸 대체하지 않는다.
- 두 트랙은 **같은 기획(이 문서 5장, 다섯 게임의 정체성)을 공유**하되
  엔진·구현은 완전히 별개다. 한쪽 코드를 다른 쪽에 기계적으로 옮기지 않는다
  (Godot의 GDScript를 그대로 C#으로 번역하지 않는다 — 각 엔진의 관용구를 쓴다).
- **레거시 감사는 다시 하지 않는다.** `saga-godot/docs/LEGACY_FEATURE_AUDIT.md`가
  다섯 웹 판의 KEEP/REWORK/MERGE/DROP 분류를 이미 끝내 뒀다 — 그 결과를
  그대로 참고한다(33장 토큰 절약 규칙 3 "이미 완료된 시스템을 다시
  분석하지 않는다"). 엔진이 다르다고 기획 분석까지 다시 할 이유는 없다.
- **왜 두 엔진인가**는 이 문서가 판단할 일이 아니다 — 사용자가 직접 비교해
  보고 정하려는 목적으로 이해한다. 이 문서는 "Unity 쪽을 잘 만드는 법"만
  다룬다. Unity가 Godot보다 낫다/못하다를 여기서 논하지 않는다.

기존 프로젝트와 기존 1~80번 작업지시서는 폐기하는 것이 아니라,

> 기존 구현을 그대로 유지하는 것이 아니라
> 기존 기획/콘텐츠/게임성 중 가치 있는 부분만 추출하여
> 신규 Unity 구조에 재설계하여 통합한다.

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

- 기존 JS 코드를 C#으로 기계적으로 변환
- **`saga-godot/`의 GDScript를 C#으로 기계적으로 번역** (두 트랙이 같은
  기획을 공유하되 각자 엔진에 맞게 새로 설계한다 — 0장 참고)
- 기존 HTML/CSS/JS 구조를 Unity에 억지로 재현
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
- **`saga-godot/`이 쓰는 파일을 이 트랙 작업 중에 건드리기** (완전히 별개
  프로젝트 — 그쪽 세션의 진행을 깨뜨린다)

---

# 3. 개발 핵심 원칙

## 3.1 Vertical Slice First

처음부터 완성 게임을 만들지 않는다.

먼저 다음이 모두 들어간 **작은 플레이 가능한 Vertical Slice**를 완성한다.

플레이어 → 월드 이동 → 탐험 → NPC → 퀘스트 → 몬스터 → 실시간 전투 →
스킬 → 보상 → 장비 → 성장 → 다음 지역 이동 → 저장/로드

까지 하나의 재미있는 게임 루프를 완성한다.

Vertical Slice가 재미있지 않으면 콘텐츠를 늘리지 않는다.

**첫 슬라이스는 saga-godot과 같은 범위로 잡는다** — 사가고(GO)의
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

## Phase 1 — 프로젝트 기반

### 01
Unity 프로젝트 생성. **버전은 이미 설치된 Unity 6000.3.23f1을 쓴다**
(Unity Hub로 새로 받지 않는다 — 이미 있다). 템플릿은 **3D (URP)**.

### 02
프로젝트 이름 및 기본 설정("SAGA" — saga-godot과 이름 통일).

### 03
모바일 해상도/화면 설정(Player Settings → Resolution and Presentation).

### 04
Portrait/Landscape 지원 구조(Player Settings → Allowed Orientations).

### 05
기본 폴더 구조 생성(31장 레이아웃).

### 06
SagaCore asmdef 생성.

### 07
게임별 asmdef 생성(SagaGo만 먼저 — 3장 Vertical Slice 범위).

### 08
Git/버전 관리 구조 확인 — **이 폴더도 저장소(swbins) 안이다.** Unity가
생성하는 `Library/`·`Temp/`·`Obj/`·`Build/`·`Logs/`·`UserSettings/`는
반드시 `.gitignore`에 추가한다(용량이 크고 로컬 캐시라 커밋하면 안 됨 —
`saga-go/server/certs/`를 안 커밋하는 것과 같은 이유로 중요).

### 09
PROJECT_STATE.md 작성.

### 10
(ARCHITECTURE.md는 34장에 따라 생략 — saga-godot 것을 참고로 링크)

---

## Phase 2 — Vertical Slice 설계

**레거시 분석(saga-godot의 옛 Phase 2)은 생략한다 — 4장, 이미 끝나 있다.**
바로 Vertical Slice 설계로 간다.

### 11
Vertical Slice 범위 확정 — **saga-godot과 동일**(3장): 사가고, "도적의
습격" 사건 하나.

### 12
`docs/VERTICAL_SLICE.md` 작성 — `saga-godot/docs/VERTICAL_SLICE.md`를
참고하되 Unity 구현 방식(씬 구조, 프리팹 이름 등)으로 다시 적는다.

### 13~20
(saga-godot Phase 3의 26~35절과 같은 항목 — 첫 지역/적/보스/퀘스트/던전/
장비/스킬/보상 루프 설계. Vertical Slice 문서 안에 같이 적는다.)

---

## Phase 3 — 3D World Foundation

### 21
3D World 기본 Scene 생성(`Assets/Scenes/TestVillage.unity`).

### 22
Terrain 구현 — saga-go 웹판의 7×7 글자 지도(`test_map`)를 그대로
가져와 쓴다(saga-godot의 `test_map.gd`와 같은 데이터, Unity에선
`TestMapData.cs` 또는 ScriptableObject로).

### 23
Lighting 구현(Directional Light + URP Global Volume).

### 24
Sky/Environment 구현(URP Volume Profile — Physically Based Sky 또는
Skybox Material).

### 25
Fog/Atmosphere 구현(URP Volume — Fog 오버라이드).

### 26
실제 GLB/FBX 에셋 import 구조 확인(Unity는 기본 지원 — 별도 플러그인
불필요).

### 27
Material 구조(URP Lit 기반 공통 머티리얼).

### 28~31
Vegetation·Rock/Prop·Building·Landmark 배치(GPU Instancing 또는
개별 프리팹 — draw call 고려, 29장).

### 32
Path/Road 구성.

### 33
Water 구성(URP 기본 셰이더 또는 간단 커스텀 셰이더).

### 34
높낮이가 있는 지형 구성. **saga-godot이 2026-09-11에 겪은 "칸 경계가
바둑판처럼 갈라져 보이는" 문제를 참고**(`saga-godot/games/saga_go/world/
terrain_builder.gd`의 정점 색 블렌딩 해법) — Unity에서 똑같은 함정을
밟을 수 있다(타일마다 별도 메시로 땅을 채우면 하드 엣지가 생긴다).
처음부터 이어붙인 단일 메시(Mesh 클래스로 직접 정점 배열 구성, 또는
Unity Terrain 시스템의 텍스처 블렌딩 레이어)를 검토한다.

### 35
첫 번째 플레이 가능 지역 완성.

---

## Phase 4 — Player

### 36
Player 3D 모델 연결(Placeholder: Capsule → 나중에 실제 리그드 모델).

### 37
Idle/Walk/Run 구현(Animator Controller).

### 38
3D 이동 구현(CharacterController 또는 Rigidbody 기반 — 모바일이라
CharacterController 권장).

### 39
중력/충돌 구현.

### 40
Camera Follow 구현(Cinemachine 권장).

### 41
Camera Rotation 구현.

### 42
Camera Zoom 구현.

### 43
모바일 Virtual Joystick 구현(Input System On-Screen Controls).

### 44
Portrait UI 구현.

### 45
Landscape UI 구현.

---

## Phase 5 — Combat

### 46
Combat Core 구현.

### 47
Basic Attack 구현.

### 48
Target 시스템.

### 49
Damage 시스템.

### 50
HP/Death 시스템.

### 51
Hit Reaction.

### 52
Enemy AI.

### 53
Enemy Attack.

### 54
Skill 시스템.

### 55
Cooldown/Resource 시스템.

### 56
Dodge 시스템.

### 57
(엘리트/보스는 Vertical Slice 범위 밖 — saga-godot과 동일하게 스킵)

### 58
전투 재미 검증(37장 체크리스트로).

---

## Phase 6 — RPG Systems

### 59
Stats 시스템.

### 60
EXP 시스템.

### 61
Level Up.

### 62
Item 시스템.

### 63
Inventory.

### 64
Equipment.

### 65
Equipment Stats.

### 66
Reward 시스템.

### 67
Loot Table.

---

## Phase 7 — World Gameplay

### 68
NPC 시스템.

### 69
Dialogue 시스템.

### 70
Quest 시스템.

### 71
Quest Objective/Reward.

### 72
World Event.

### 73
Hidden Area.

---

## Phase 8 — Persistence / Quality

### 74
Save/Load.

### 75
Data Versioning.

### 76
Mobile Performance Pass.

### 77
Vertical Slice 전체 플레이 테스트.

### 78
**최종 재미/품질 평가 후 다음 콘텐츠 확장 여부 결정** — 이 시점에
`saga-godot`의 같은 슬라이스와 나란히 놓고 비교할 수 있다(0장의 병행
목적).

---

# 36~38. Vertical Slice 완료 조건 · 재미 평가 · 실패 시 처리

**`saga-godot/PLAN.md` 36~38장과 동일한 기준**을 쓴다(다시 쓰지 않음) —
플레이어가 게임을 실행 → 3D 월드 진입 → 이동 → 탐험 → NPC 발견 → 퀘스트
수령 → 몬스터 조우 → 실시간 전투 → 스킬 사용 → 처치 → 아이템 획득 →
장비 → 성장 → 새 지역/던전 → 엘리트/보스 → 보상 → 저장 → 재플레이,
이 과정이 **재미있어야 한다.** 재미가 부족하면 콘텐츠 추가 전에 이동감·
카메라·타격감·적 AI·스킬·보상·탐험 밀도·UI·진행 속도부터 고친다.

---

# 39~43. 확장 전략 · 차별화 · 최종 품질 목표

**`saga-godot/PLAN.md` 39~43장과 동일**(엔진 무관, 요약): 공통 Core
안정화 후 GO→DUNGEON→FOREST→STORY→REALM 순으로 확장. 게임별 느낌은
확실히 다르게(GO=탐험, DUNGEON=전투/파밍, FOREST=자연/생활, STORY=스토리/
NPC/사건, REALM=세계/세력/성장). 목표는 "기존 웹게임을 Unity로 옮긴 게임"이
아니라 "SAGA 아이디어 기반의 새 모바일 3D RPG".

---

# 44~49. 에셋 사용 원칙 · 모바일 성능 목표 · 디버그 시스템

**`saga-godot/PLAN.md` 44~49장과 동일한 원칙**: 에셋 우선순위
(Player→주요 Enemy→Boss→Environment→Building→Vegetation→Props→Animals→
VFX). 모바일 성능(과도한 NPC/그림자/Particle/투명 재질/고해상도 텍스처
금지, AI 매 프레임 처리 금지). 디버그 화면(FPS/Draw Calls/Visible
Objects/Enemy Count/NPC Count/Memory/Player Position/Current Quest/
Player Level/Current Zone) — Unity는 `Debug.Log` + 온스크린 커스텀
UI 또는 Unity Profiler 연동. **saga-godot의 디버그 라벨(현재
rendering_method 표시, 66-1장)과 같은 정신으로, 현재 Render Pipeline
Asset 이름을 표시한다.**

---

# 50. 최종적으로 만들어야 하는 것

```text
SAGA
│
├── SAGA CORE (saga-godot 트랙과 saga-unity 트랙, 각자 독립)
│
├── GO
├── DUNGEON
├── FOREST
├── STORY
└── REALM
```

Core는 트랙 안에서 공유. 콘텐츠는 게임별로 분리. **두 트랙(Godot/Unity)
사이에는 코드를 공유하지 않는다** — 기획만 공유한다(0장).

---

# 51~65. 확장 계획 · 게임별 차별화

**`saga-godot/PLAN.md` 51·65장과 동일**(다시 쓰지 않음) — Vertical
Slice 이후 GO(월드 확장→탐험/지역/이벤트/수집/희귀 몬스터)→
DUNGEON(던전 증가→엘리트/보스/장비/빌드)→FOREST(생태계→동물/채집/마을/
생활)→STORY(스토리 챕터→NPC/선택/사건/관계)→REALM(지역→세력/도시/영지/
대규모 콘텐츠) 순.

---

# 66-1. 렌더러 프로파일 — URP PC / Mobile 이중 구성

## 결정 (2026-09-11)

**Unity 6 + URP(Universal Render Pipeline)를 쓴다.** HDRP는 쓰지
않는다 — HDRP는 모바일을 지원하지 않는다(45장 모바일 목표와 정면 충돌).

`saga-godot`의 66-1장(Forward+ / Mobile 이중 구성)과 같은 이유로,
플랫폼별로 다른 **URP Asset(Renderer 설정)**을 쓴다:

| 프로파일 | 대상 | Rendering Path | 켜는 것 |
|---|---|---|---|
| **PC** | Windows/macOS/Linux 빌드, 에디터 | **Forward+**(Unity 6 URP 신규 지원) | SSAO, Screen Space Reflection, Volumetric Fog, HDR Bloom, 고품질 그림자(Cascade 4단), MSAA/TAA |
| **Mobile** | Android/iOS 빌드 | Forward(전통 경로) | Bloom만, 그림자 저해상도·Cascade 1~2단, MSAA 2x, SSAO·SSR·Volumetric 전부 끔 |

## 설정 방식 — **Unity 공식 "3D (URP) Cross-Platform" 템플릿이 이미 그대로 갖고 있다**

2026-09-11 Phase 1에서 프로젝트를 `com.unity.template.3d-cross-platform`
템플릿으로 만들어 보니, 이 절이 하려던 일을 템플릿이 **이미 다 해 뒀다**
(직접 만들 필요 없음 — 확인만 했다):

```text
Assets/Settings/
├── PC_RPAsset.asset       (renderingMode=ForwardPlus)  + PC_Renderer.asset
└── Mobile_RPAsset.asset   (renderingMode=Forward)      + Mobile_Renderer.asset
```

`ProjectSettings/QualitySettings.asset`에 Quality 레벨이 이미 둘
(`Mobile`·`PC`)이고, 각 레벨의 `customRenderPipeline`이 각각
`Mobile_RPAsset`·`PC_RPAsset`을 가리킨다. `Mobile` 레벨엔
`excludedTargetPlatforms: [Standalone]`이 걸려 있어 PC 빌드에서는
자동으로 `PC` 레벨(=Forward+)이 골라진다 — **플랫폼 분기 스크립트를
따로 안 짜도 된다.** 66-1장이 원래 요구하던 "씬 안에서 안 갈라짐"·
"빌드 타깃에 따라 자동 전환" 둘 다 템플릿 기본값으로 충족된다.

**할 일은 확인·튜닝뿐이다** — 두 RPAsset의 그림자·AA·후처리 오버라이드
값이 아래 표(PC=고품질/Mobile=저사양)와 실제로 맞는지 Phase 3~4에서
콘텐츠가 늘 때 다시 점검한다. 지금(Phase 1) 단계에서 값을 미리 튜닝하지
않는다 — 아직 비교할 실제 씬이 없다(32장 "최소 변경" 원칙).

- **씬/프리팹 안에서 렌더러를 분기하지 않는다** — Quality Settings +
  URP Asset 스위칭으로만 한다(saga-godot의 "이 세 줄로만 한다"와 같은 원칙).
- 색 톤(Tonemapping·노출·색보정)은 **두 URP Asset의 Volume Profile에서
  같게** 유지한다.
- 메시·머티리얼·텍스처·애니메이션은 한 벌이다. 플랫폼별 에셋을 따로
  안 둔다. 텍스처 해상도·압축은 Platform-specific Texture Import
  Override로만 조절한다.

## 하지 말 것

- HDRP로 갈아타기(모바일 미지원)
- 프로파일을 셋 이상으로 늘리기
- Mobile 프로파일에서 SSAO·SSR·Volumetric Fog를 켜 보는 것(45장 위반)
- Forward+ 미지원을 이유로 오래된 Unity 버전을 쓰기 — 이미 설치된
  6000.3.23f1(Unity 6)이 Forward+를 지원하는 최초 세대다, 굳이 낮출 이유 없다

## 검증

- 46장 디버그 화면에 현재 URP Asset/Rendering Path 이름을 표시한다.
- PC 프로파일 FPS·Draw Call은 에디터에서, Mobile 프로파일은 71장 테스트
  기기에서 확인한다.
- 실기 확인은 매 단계마다 하지 않고 **마지막에 몰아서** 한다(루트
  `CLAUDE.md`의 실기 확인 방침, saga-godot 트랙과 동일).

---

# 66-2. 아트 방향 — 사실적(포토리얼) PBR, 파이널 판타지 최신작 기준 (2026-09-13, 재정정)

## 결정 — saga-godot과 다른 방향으로 갈라섬 + 구체적 레퍼런스 확정

**처음엔 "saga-godot과 같은 결정(원신류 애니메이션 셀셰이딩)"이라고
적었으나, 같은 날 사용자가 "saga-unity는 원신 스타일이 아니라 사실적인
걸로 변경할게, 엔진마다 다른 점이 필요해"로 뒤집었다.** 두 3D 트랙의
그래픽 목표가 이제 의도적으로 다르다:

| 트랙 | 목표 그래픽 |
|---|---|
| `saga-godot` | 원신(Genshin Impact)류 카툰/셀셰이딩(그 프로젝트 PLAN.md 66-2장) |
| `saga-unity` | **사실적(포토리얼) PBR, 파이널 판타지 최신작(스퀘어에닉스) 기준** — 이 장 |

**추가 지시(같은 날 다시) — "파이널 판타지 그래픽처럼 하고 싶어, 최신작
기준임".** "사실적 PBR"이라는 방향만으로는 톤이 안 잡혀(사실적 PBR도
언리얼 엔진 데모부터 배틀필드까지 폭이 넓다) 구체적 레퍼런스를 못박는다
— **파이널 판타지 16(2023)·파이널 판타지 7 리버스(2024) 같은, 이 결정
시점 기준 가장 최근 스퀘어에닉스 넘버링작/리메이크의 그래픽 톤**이
기준이다. 더 최신 넘버링작·리메이크가 나오면 그쪽을 기준으로 갱신하되,
아래 스펙(사실적 인체 비율·무드 있는 시네마틱 라이팅·디테일한 재질)
자체는 유지된다.

루트 CLAUDE.md의 "기획만 같이 본다"는 원칙은 여전히 유효하지만(공통
게임 디자인·데이터 구조 등), **그래픽 아트 방향은 이 지점부터 공유
대상이 아니다** — 앞으로 saga-godot의 66-2장(카툰/셀셰이딩 스펙)을
이 프로젝트에 옮기지 않는다.

## 무엇을 뜻하는가 (파이널 판타지 최신작 기준 구체 스펙)

- 66-1장이 이미 잡아 둔 **PC 프로파일(Forward+ 상당, SSAO·SSR·
  Volumetric Fog·HDR Bloom·고품질 그림자)**이 그대로 목표에 맞는다 —
  포토리얼 방향이라 오히려 66-1장을 고칠 필요가 없다(66-1장은 렌더러
  파이프라인 층, 이 장은 그 위의 "무엇을 사실적으로 그릴 것인가" 층).
- **캐릭터**: 실사에 가까운 인체 비율(원신류 애니메이션풍 비율이 아님).
  표준 URP Lit(PBR: 알베도·메탈릭·러프니스·노멀맵) 기반이되, 피부는
  **Subsurface Scattering(URP `Skin` 근사 — SSS 노멀·틱니스맵 활용)**을
  얹어 밀랍 같은 느낌을 피한다. 머리카락은 처음부터 스트랜드 단위
  렌더링(Alembic/그루밍 파이프라인)까지 가지 않고 **다중 레이어 헤어카드
  + 이방성(anisotropic) 하이라이트**로 시작(성능·제작비 대비 FF 최신작
  헤어의 결을 가장 싸게 근사하는 방식 — 44장 "최소 변경" 원칙).
  갑옷/의상은 금속·가죽·천 각각 다른 러프니스·노멀 디테일로 구분한다.
- **라이팅/무드**: 평면적인 균일 조명이 아니라 **극적인 명암 대비**
  (강한 키라이트+짙은 그림자, 역광·림라이트로 실루엣 강조), Volumetric
  Fog/God Ray로 공간감. 색보정은 **필름틱 LUT**(살짝 desaturate,
  하이라이트는 따뜻하게·그림자는 차갑게 — 전형적 시네마틱 톤).
- **Post Processing(URP Volume)**: HDR Bloom(66-1장 이미 있음)에 더해
  **얕은 피사계심도**(대화·연출 장면에서, 평소 플레이 중엔 과하게 걸지
  않음 — 모바일에서 상시 DoF는 비용 크다), 미세한 Film Grain, 약한
  Chromatic Aberration, Motion Blur(카메라 회전 시만 약하게). 전부
  **PC 프로파일 위주**로 걸고 Mobile 프로파일에서는 66-1장 표대로
  대거 줄인다(DoF·Film Grain·Motion Blur는 Mobile에서 끔 — 45장).
- **환경**: 밀도 높은 식생·먼지/불티 파티클로 공간을 채운다(Unity 6
  URP의 Adaptive Probe Volumes로 정적 GI 보강 검토 — Enlighten
  없이도 반사광이 자연스럽게 스미는 게 FF 최신작 실내·던전 톤의 핵심).
  물은 굴절+SSR 반사를 그대로 쓴다(66-1장 PC 프로파일 SSR 활용 —
  saga-godot과 정반대로 여기서는 물도 포토리얼 방향).
- 텍스처·모델 디테일(고해상도 노멀맵, PBR 재질값 등)이 실제 화질을
  좌우한다(66-1장 8행이 이미 짚어 둔 원칙 — "에셋 품질이 엔진보다
  중요"). 다만 모바일 목표(45장)는 그대로라 텍스처 해상도·폴리곤 수·
  위 이펙트 전부 모바일 프로파일에서 축소 대상.

## 현실적 기대치 — "얼마나 비슷해질 수 있나"

**사용자 질문 "파이널판타지16 정도 가능할까?" → "비슷한 정도까지만
이라도"로 스스로 눈높이를 낮춰 답함(2026-09-13).** 정직하게 적어 둔다
— FF16은 스퀘어에닉스가 수백 명 규모로 수년간, PS5 전용(모바일 타협
없이) 만든 게임이다. 이 프로젝트는 혼자(세션이 코드를 짬)·CC0/무료
또는 저가 에셋 위주·모바일까지 겸하는 프로젝트(45장)라 **동일한 밀도는
애초에 목표가 아니다.** 항목별 현실적 격차:

| 요소 | 근접 가능성 | 이유 |
|---|---|---|
| 라이팅 무드·색보정·후처리(LUT·Bloom·Volumetric Fog) | **높음** | 셋업 문제라 엔진·시간 문제, 에셋 구매 불필요 |
| 환경(지형·식생·던전 재질) | **중간~높음** | PBR 텍스처 킷(Quixel Megascans류)을 구하면 재질 자체는 실제로 AAA급 — 배치 밀도·규모만 줄어듦 |
| 캐릭터 얼굴·피부·헤어 | **낮음** | 포토그래메트리 스캔·커스텀 페이셜 리그·스트랜드 헤어는 팀·예산이 드는 영역 — 헤어카드·SSS 근사로 "방향"만 흉내 |
| 천/갑옷 시뮬레이션(옷감 물리) | **낮음** | 실시간 클로스 시뮬은 비용이 커 모바일과 상충(45장) — 정적 노멀맵으로 흉내 |

**목표를 다시 말하면**: FF16과 나란히 비교해 이길 수 없다는 걸 알고
가는 것 — "그 게임이 주는 무드·색감·조명의 방향"을 참고해 이 프로젝트가
낼 수 있는 최고치를 뽑는 것이지, 초근접 재현이 목표가 아니다. 다음에
실제 캐릭터/환경 에셋을 조사하는 세션은 이 표를 보고 **라이팅·환경부터
먼저 투자하고(체감 대비 비용이 싸다), 캐릭터 디테일은 기대치를 낮게
잡을 것.**

## 절대 하지 않는 것 — 실제 스퀘어에닉스 자산 사용

**파이널 판타지는 스타일 레퍼런스(오마주)일 뿐이다.** 스퀘어에닉스의
실제 게임 리소스(모델·텍스처·셰이더 코드)·데이터마이닝된 에셋을 가져다
쓰지 않는다 — 루트 CLAUDE.md "원작사의 실제 에셋 가져다 넣기 금지"
원칙이 그대로 적용된다(saga-godot 66-2장이 원신에 대해 같은 원칙을
적은 것과 동일). 그림은 CC0/라이선스 확인된 에셋이나 코드가 그린다,
캐릭터 조형·라이팅 셋업만 톤을 참고한다.

## 지금까지의 Kenney/VRoid 에셋은 어떻게 되나

- **Kenney CC0 로우폴리 킷**(`Assets/Art/`, `docs/ASSET_GUIDE.md`)은
  카툰 방향에서도 이미 교체 대상이었고, 사실적 방향에서도 마찬가지로
  최종 그래픽엔 안 맞는다(로우폴리·단순 색 텍스처라 어느 방향이든
  플레이스홀더에 가깝다) — 교체가 필요하다는 결론 자체는 안 바뀐다.
- **VRoid Studio 샘플 아바타**(`Assets/Art/CharactersVroid/
  AvatarSample_A.vrm`+`.glb`, saga-godot과 같은 파일을 미러링해 옴)는
  애니메이션풍 캐릭터라 사실적 방향과는 안 맞는다. 당초(이 문단을 쓴
  시점)엔 "지우지 않고 그대로 둔다"였으나, gltFast 임포트 검증이라는
  목적을 다한 뒤 **2026-09-21 삭제로 뒤집혔다**(102-4). 실제 최종
  캐릭터 에셋 소스(사실적 방향에 맞는 것)는 아래 "다음에 할 일"로
  미룬다.
- 새 에셋 소스(사실적 방향에 맞는 것 — 예: 사실적 인체 스캔/사진측량
  기반 캐릭터, PBR 텍스처가 갖춰진 환경 킷 등)는 **아직 정하지 않았다**
  — 사용자가 "플랜만 수정"이라고 범위를 한정해, 이번엔 방향만 문서화
  하고 실제 소스 조사는 다음으로 미룬다.

## 하지 말 것

- saga-godot의 66-2장(카툰/셀셰이딩 스펙·VRoid/Quaternius/KayKit 에셋
  소스·셰이더 참고 구현)을 그대로 옮겨오기 — 이 트랙은 이제 다른 목표다.
- 두 트랙의 그래픽이 원래 같아야 한다고 재논의하기 — 사용자가 명시적으로
  갈라 달라고 지시했다(이 절 "결정" 참고).
- 이 정정을 이유로 66-1장(렌더러 프로파일)을 다시 논의하기 — 오히려
  66-1장이 이미 사실적 방향에 맞게 잡혀 있어 그대로 쓴다.

## ①~⑪ 캐릭터·환경 파이프라인 — 전부 완료 (2026-09-13), 기록은 `docs/HISTORY.md`

라이팅/후처리 셋업(`BuildFF16VolumeProfiles.cs`) · Poly Haven PBR 5벌(채널 팩킹은 `BuildMetallicSmoothnessMap()` 으로 표준 URP Lit 유지) · 캐릭터 셰이더 3벌 반입(MIT·MIT·CC0, `CharacterShaders_candidates/`) · Mixamo Maria 반입+Humanoid 리깅(`MixamoRigUtil.RigCharacter()` 가 `ExtractTextures()` 포함) · Animator 8클립 · 피부 서브메시 분리 근사(`BuildMariaSkinSplit.cs`).
**남은 결정 사항**: 헤어카드(분리된 헤어 메시 필요, 아직 없음)는 사람 GUI 몫으로 남음. **SSS는 2026-09-22 리플렉션 기법으로 해결**(Q-U3 참고 — "코드로 불가"가 뒤집힘). DoF 는 대화 연출 토글이 생긴 뒤에만. Mixamo 산출물은 `Assets/Art/CharactersRealistic/`(gitignore) 밖으로 내지 않는다. 자세한 경위는 `docs/HISTORY.md` "PLAN.md 66-2장" 절.

---

# 67~69. 사운드 · Localization · 접근성

**`saga-godot/PLAN.md` 67~69장과 동일한 목표**: BGM/SFX/Attack/Hit/
Skill/UI/Environment 사운드 구조(Unity AudioSource + AudioMixer로
카테고리별 볼륨 분리). 텍스트는 코드에 안 박는다(Unity Localization
패키지 또는 간단 JSON 사전, 한국어/영어/일본어 확장 가능). UI 크기·
진동·효과음·BGM On/Off·그래픽 품질 설정 가능하게.

**진행 요약(2026-09-14~15, 경위는 `docs/HISTORY.md` "67~69장" 절)** — SFX·BGM·접근성 설정·Localization 인프라가 다섯 판 전부에 붙었다. 유지할 결정만 적는다:
- SFX 는 코드로 Master/SFX/BGM 볼륨을 곱하는 `XxxAudio.cs`(다섯 벌). AudioMixer 에셋은 사람이 GUI 로 노드를 이어야 해 배치 모드로 못 만든다 — 만들지 않는다.
- BGM 은 판마다 CC0 상시 루프 1곡(`Assets/Art/Audio/CC0_BGM/`). 승리/패배처럼 들어야 갈리는 선곡은 사람 몫 — 먼저 묻지 않고 시작하지 않는다.
- Localization: `XxxLocalization.T(key[, fallback])` + `Resources/Localization/xxx_<lang>.json`(ko·en, ja 없음). 키 누락은 키 자체를 돌려준다(빈 화면 대신 보이게). `settings.*` 공유 키는 다섯 벌 md5 일치, 게임별 키는 불일치 허용. 코드에 `T(키, 한국어)` 로만 있고 표에 없는 키는 `py tools/loc-missing.py`(판별 개수, 빠지면 exit 1)로 훑는다 — 2026-09-24 GO·DUNGEON·FOREST·STORY 205개를 채워 0(REALM 은 원래 0). **내부 식별자(문자열 값으로 매칭되는 상수)는 번역하지 않는다.** 씬에 구워 넣는 버튼은 `LocalizedButtonLabel`(폴링) 로만 언어 전환. en 은 세션 번역이라 사람 검수 전.
- **완료(2026-09-22 재조사)**: 위 "미착수" 넷을 다시 확인해 보니 REALM 문답 36·서고·GO HiddenTreasure·DUNGEON 행상/구출·FOREST 가구 14/마감재 10 은 이미 키가 채워져 있었다(이 줄이 오래 안 갱신된 낡은 기록) — 실제로 비어 있던 건 REALM "전투 서술" 쪽(일기토·설전·전술·승리 카드·1인 서사 카드 7종, `RealmLocalization.T()` 호출은 있었지만 ko/en JSON에 키 자체가 없어 항상 한국어 폴백만 나왔다, 92개 추가)과 FOREST 바이옴 4곳 이름(애초에 `T()` 호출조차 없이 필드 그대로 노출, `ForestBiomeData.Zone.DisplayName`을 계산 프로퍼티로 바꿈)뿐이었다 — 둘 다 마저 채웠다.

---

# 70~80. 품질 검증 · 테스트 기기 · 최적화 시점 · 씬 관리 · 개발 로그

**`saga-godot/PLAN.md` 70~80장과 동일한 원칙**: 각 Phase마다 Functional/
Visual/Mobile/Performance Test. 저사양/중급/고성능 모바일 최소 셋 고려.
최적화는 마지막 한 번이 아니라 Vertical Slice부터 지속 측정. 하나의
거대한 Scene에 다 넣지 않는다(World/Terrain/Environment/NPC/Animals/
Enemies/Events/POI 분리). Prefab을 재사용 단위로 쓴다(`EnemyBase.prefab`,
`NPCBase.prefab`, `Tree.prefab` 등). 새 몬스터는 기존 Combat/AI를
복사하지 않고 Data(ScriptableObject)만 추가해서 만든다. 수치는
`Assets/Data/Balance/`에서 관리. 중요 변경은 `docs/CHANGELOG.md`에
짧게. 실패한 단계는 중단→원인 파악→최소 수정→재검증→완료, 실패 상태에서
계속 쌓지 않는다.

---

# 81~100. Vertical Slice 확장 검증 · 최종 Gate

**`saga-godot/PLAN.md` 81~100장과 동일한 체크리스트**를 쓴다: 이동감·
카메라 감각·월드 시각 품질·전투 타격감·적 AI 재미·스킬 재미·보상 재미·
성장 체감·탐험 동기·30분 플레이 테스트, 이어서 모바일 Portrait/Landscape
테스트·저사양 성능 테스트·메모리 테스트·세이브/로드 테스트·버그 수정·
불필요한 기능 제거·그래픽 품질 최종 개선·게임 루프 최종 검증·**Vertical
Slice 승인/재설계 결정.** 100단계에서 무조건 다음 콘텐츠로 안 넘어간다 —
재미없으면 Phase를 되돌려 개선한다.

---

# 101. 재미 진단·게임성 이식 (SAGA-DESIGN §1~§5 적용, 2026-09-16)

## 101-1. 표준 8 — 이 트랙 현재 상태

| # | 표준(§3) | 상태 | 근거(씬·스크립트) |
|---|---|---|---|
| A 목표판 | 지금/세션/주간 3줄 | **×** | `PlayerHud`·`StoryHud`·`RealmHud` 는 HP·골드·퀘스트 진척 상태줄만. "다음에 할 것" 을 계산하는 곳이 없다 |
| B 마무리 카드 | 종료·귀환 시 카드 | **×** | 저장 버튼 토스트(`command.save_ok`)가 유일한 "마무리". 얻은 것·다음 할 것 요약 없음 |
| C 손맛 | 5요소(hitstop·흔들림·플래시·팝·소리) | **△** | DUNGEON `DamagePopup`·SFX 라운드로빈은 있음. hitstop·카메라 임펄스·피격 플래시 없음. GO 전투는 선택지 UI(`EncounterUiKit`)라 타격 자체가 없다 |
| D 선택 3택 | 서로 다른 축 3택 | **△** | STORY 전직 4택 1회(`StoryJobChoiceUi`)·STORY 선택(`StoryChoiceUi`, 2택)·DUNGEON 빌드 1(회전베기). 반복되는 성장 3택 없음 |
| E 발견 밀도 | 60m 격자 빈칸 ≤10% | **△** | GO 은닉 보물·돌탑·유물·채집·산신당은 있으나 7×7 지도에 손배치, 밀도 규칙·재배치 없음. DUNGEON 방 종류 6 은 규칙적 |
| F 실패·회복 | 비용 10~20%·회복 ≤2분 | **×** | 죽음 처리(`death` 클립)만. 비용·회수·"죽어도 남는 것" 없음. REALM 패전 비용도 병력 감소뿐 |
| G 성장 가시화 | 단계마다 보이는 변화 1 | **△** | 장비 스탯은 오르지만 외형 불변(`CharacterVisual` 은 종류별 GLB 1). STORY 두목 1.4배는 예외 |
| H 돌아올 이유 | 일일·주간 | **×** | 실시간 시계 없음. 세이브 타임스탬프만 |

**가장 큰 구멍 3**: ① A·B 부재 — 다섯 씬 모두 "다음에 뭘 하나" 를 사람이 PROJECT_STATE 를 읽어야 안다. ② C — 사실적 아트로 갈수록 타격 반응 부재가 더 티 난다(66-2 톤에서 피격 플래시 없는 적은 마네킹). ③ F·H — 한 번 본 씬을 다시 열 이유가 없다.

## 101-2. 다섯 게임 × 웹 PLAN §5 후보 — 3D 이식 표

웹 판 §5 는 2026-09-16 설계본이고 **전부 웹 미검증**이다. 3D 는 "웹에서 통한 것부터" 옮기되(§5 원칙), A·B·C 처럼 웹 검증이 필요 없는 UI·감각 표준은 병행한다.

**결정(2026-09-19, 사용자)**: 위 "웹에서 통한 것부터" 게이트를 **saga-godot 트랙의 실기 승인으로도 충족된 것으로 인정한다.** saga-godot 은 saga-web 과 별개로 이미 이 표의 여러 후보를 3D 로 구현해 사용자 실기 테스트로 "재미있다" 승인을 받았다(GO·DUNGEON·FOREST 는 VS 승인 자체가 실기 확인, STORY·REALM 도 101-2 항목 다수 완료 — `saga-godot/docs/PROJECT_STATE.md` "완료 요약" 표 참고). saga-web 쪽 문서에 검증 도장이 안 찍혔다는 이유만으로 saga-unity 착수를 더 미루지 않는다 — **다만 UI·조작·수치는 saga-godot 구현을 그대로 베끼지 않고 이 트랙 자체 컴포넌트로 재해석한다**(루트 CLAUDE.md·이 문서 서두 "코드 공유 없음" 원칙 그대로, 참고하는 것은 "이 설계가 재미있다"는 사실뿐).

**결정(Q-U1, 2026-09-22 형식 정리)**: 101 착수 순서(공통 선행을 먼저 다섯 판에 깔지, GO 한 판 끝까지 보여 준 뒤 확장할지)는 실제로 "GO 한 판 끝까지 → 확장" 경로 그대로 다섯 판 전부로 확장돼 처리됐다 — 105 열린 질문에서 지운다.

**결정(2026-09-20, 사용자)**: 위 게이트(웹 검증 또는 godot 실기 승인)조차 없는 후보도 **막지 않는다** — 이 세션 시점 다섯 판 101-2 후보가 전부 게이트에 걸려(GO⑤ 모바일 빌드 뒤·DUNGEON5.7 웹 선행 뒤·STORY5-2/5-8 보류·FOREST5.6/5.7 웹·godot 승인 사례 없음·REALM 은 전부 닫힘) 다음 작업이 없던 상황에서, "게이트 무시하고 unity 자체 진행"을 사용자가 직접 골랐다. 다만 위 문단의 재해석 원칙(saga-godot·saga-web 구현을 그대로 베끼지 않는다)은 그대로 지킨다 — FOREST 5.7이 이 결정으로 처음 착수됐다.

| 게임 | 웹 §5 후보(우선순위 순, 제목만) | 3D 첫 이식 | 이 트랙 대응 파일 |
|---|---|---|---|
| GO | ① 봉수대(탑→지도 해제) ② 사당 시련 3분 방 ③ 75초 토벌·부위·저스트 회피 ④ 일과판+마무리 카드 ⑤ 비석 순례(GPS) ⑥ 인연(동행 관계) ⑦ 승급 3택 ⑧ 패배 비용·회수 | **④ → ⑦ → ③**(2026-09-19) → **① → ⑥ → ⑧**(2026-09-20) → **②**(2026-09-20, 이어서) — 남은 건 ⑤(GPS, Unity 모바일 빌드 뒤)뿐. ③은 "야생 조우"(`BanditEncounter`)가 아니라 이미 "토벌" 결인 `RareWolfEncounter`에 얹었다(`DuelRules.Raid`). **①**은 TestVillage가 GPS 오버월드가 아니라 9×11 고정 격자 하나뿐이라 "27개 권역·GPS 반경 1.5km 노출"을 그대로 못 옮긴다 — 봉수대를 마을에 하나만 두고(격자 4,4), 미니맵이 없는 이 트랙에서는 "지도 해제" 대신 목표판(`GoSessionTracker.GoalLineNow()`)이 불 켜기 전엔 봉수대 자신을, 켠 뒤엔 남은 발견형 랜드마크(숨은 보물·산신당·동쪽 숲 유적) 전부를 최근접 후보로 받아들이는 쪽으로 재해석했다(새 `BeaconTower`). **⑥**은 이 슬라이스의 등용 대상이 "산적" 하나뿐이라(늑대는 등용 안 됨) faction/era 결(궁합) 축이 성립하지 않아 스코프 밖으로 뺐다 — 남은 "함께 걸은 거리·함께 이긴 토벌로 인연 0~3, +2%/등급"만 수치 그대로 옮겼다(새 `BondState`, `PartyState.Recruit`가 자동 등록). **⑧**은 원문(15%·상한300·10분·동시3개)을 그대로 옮겼다 — 10분 창은 `Time.time`(앱 재시작 시 0으로 리셋)이 아니라 `DateTime.Now.Ticks`로 재 앱을 완전히 껐다 켜도 창이 흐르게 했다(새 `DropState`/`DropMarker`, `GameBootstrap.Start()`가 로드 직후 만료분을 거르고 남은 것만 마커로 되살린다). **②**는 27권역·105명 인물 풀이 없어 입구 하나(산신당 옆 격자 4,1)로 좁히고, 파도 3(웹판 wolfpack 90→bandit 120→scout 170 재해석)을 하나의 공유 타이머(180초)로 이어(`DuelRules.Left`를 다음 파도 timeSec로 그대로 넘김), 보상도 "그 권역 인물 조우" 대신 "인장 조각" 수집(3개=인장 1, 이정표 보상)으로 재해석했다 — 하루 3회·실패 시 10분 재입장 잠금은 원문 그대로(새 `ShrineTrialState`/`ShrineTrialEncounter`). 경위는 `docs/HISTORY.md` 2026-09-20 grep | `PlayerHud`·`QuestState`·`BanditEncounter`·`RareWolfEncounter`·`PartyState`·`LandmarksBuilder`·`BeaconTower`·`BondState`·`DropState`·`DropMarker`·`GoSessionTracker`·`ShrineTrialState`·`ShrineTrialEncounter` |
| DUNGEON | 5.1 축복 3택 5.2 유품(죽음 비용·회수) 5.3 부적 던전 티어 5.4 월드 보스 75초 5.5 난입 파도 5.6 목표판·카드 5.7 시대 퓨전 5.8 손맛 2차·가시화 | **5.8 → 5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.7 → 5.6 전부 완료(2026-09-20~21) — DUNGEON 101-2 전부 닫혔다.** **5.6(2026-09-21, 재검토 이어 마무리)**: 공통 A(`GoalBoard`)·B(`SessionCard`)는 이미 2026-09-19 붙어 있었지만 "이번 세션"·"이번 주" 두 줄이 실제 값 없는 자리표시 문구였다 — GO ④ 일과판(`DailyTaskState`)과 같은 구조(날짜 해시로 그날의 풀 3택·도장 7=주간 보상)를 이 트랙의 반복 시스템 넷(걷기·적 처치·부적 층 클리어(5.3)·난입 완주(5.5))에 맞춰 새 `DungeonDailyTaskState`로 짰다. 월드 보스(5.4)는 매 세션 만난다는 보장이 없어 일일 풀에서 뺐다(GO도 발견형 콘텐츠는 풀에서 뺀 전례). 세이브는 GO v10과 같은 구조로 v8에 추가(버전 게이팅, GO의 null-tolerant 방식과 다름 — 이 트랙 SaveState는 처음부터 버전 번호로 마이그레이션한다). — **5.7(게이트 무시 착수, 101-2 서두 2026-09-20 결정)**: 웹판(191행) "인물 30"(현대·근미래 인물 30, `data-hero-ext.js`)은 이 트랙에 인물 로스터 자체가 없어(GO의 `PartyState` 같은 등용 시스템 없음, 단일 주인공 `HeroState`) 스코프에서 뺐다. "시대 혼재 건물"(biome 데코에 시대 층 하나씩)도 절차적 층(`DungeonFloorRunner`)이 `SagaBiome` 데코 후크(`DungeonRoomBuilder.BuildDecor()`, Room1~4 손빚 방 전용)를 안 써 마찬가지로 뺐다. 실제로 옮긴 건 **미래 무기 look 2**(`wp_lance_e` 전자창·`wp_gauntlet` 동력장갑, `ItemData.WeaponShape`로 `WeaponVisual`이 등급 색과 별개로 모양 자체를 리사이즈)와 **기계화 변종**(원안 "짐승형 파생 규칙"은 짐승형 몬스터가 없어 대신 절차적 정예를 5층부터 "기계화 정찰병"으로 바꿔치기, `EraFusionData`, "emp 저항"은 EMP 메커닉이 없어 뺌). 헤드리스 진단 중 **실제 버그 발견·수정**: `HeroState.Restore()`(세이브 로드 경로)가 `EquipmentChanged`를 안 쏴 `WeaponVisual`이 로드된 무기 모양을 못 갱신할 수 있었다(`StoryWeaponVisual.JobChosen`과 같은 함정) — `Restore()`에도 이벤트를 쏘게 고침. 새 `EraFusionData`. 5.5 "난입"도 위 넷과 같은 재해석 — 웹판 "모루골 결사비 옆 표식"은 Room1(이 트랙의 실제 중심 마을)에 세우지만, "방 하나에서 파도"는 이미 콘텐츠가 있는 Room1을 못 써서 완전히 격리된 고정 방(`HordeArena`)으로 텔레포트하는 쪽으로 좁혔다. 레벨업 3택은 새 시스템 없이 5.1 `BlessingState`를 그대로 재사용(난입 시작 시 `SnapshotIds()`로 회차 축복을 비우고, 종료 시 `Restore()`로 되돌린다 — "난입 한정"의 뜻). 웹판 "10분 이상 부적 1"은 부적 인벤토리가 없어(5.3과 같은 이유) 금 보너스로 대체. 5.8 중 hitstop·타격 VFX·죽음 표식 은 2026-09-17 완료 — 101-3 C·F 표 참고, **`LootMarker`(101-3 F, 적 사망 시각 잔향뿐)는 5.2(플레이어 죽음 비용·회수, 실제 골드 반환)와 다른 것 — 혼동 주의**. 5.1 은 웹판의 무예 4칸·서명 무예·7원소 시너지(36개 표)를 그대로 옮기지 않았다 — 대신 이 트랙 고유의 "하나를 크게(강공격) 대 여럿을 조금씩(회전베기)" 빌드(51장)를 직접 강화하는 공(攻)/수(守)/선(旋) 3축으로 재해석했다(새 `BlessingState`). 5.2 도 웹판의 "런 리셋 뒤 재방문 회수" 전제를 그대로 옮기지 않았다 — 이 트랙은 편도 진행이라 "회수 전에 방을 뜨면 잃는다"로 좁혔다(사망 시 골드 전부를 `GraveMarker`로, `SessionCard`로 요약). 5.3 도 웹판의 "굴혈 앞 티어 선택 + 부적 인벤토리"를 그대로 옮기지 않았다 — 허브가 없어 "층 10 이후 보스층마다 자동으로 걸리는 변형자"(`SigilState`, 정예 폭증 hp×2 / 유리대포 피해×1.5, 결정적)로 좁혔다. **5.4 도 웹판의 "15분 실시간 슬롯 + 마을 필드 스폰"(재방문 가능한 지속 마을 전제)을 그대로 옮기지 않았다** — 이 트랙엔 그런 마을이 없어(편도 절차적 진행), 대신 이미 있는 "층 끝 두목"(`SpawnSolo` withEscorts, 고정 배치 `BuildBoss()` 둘 다) 자체를 75초 제한 전투로 승격시켰다: `DungeonEnemy`에 `isWorldBoss` 플래그를 추가해 아그로 순간부터 75초 카운트다운(`PlayerHud`에 표시)이 시작되고, 시간 안에 못 잡으면 도망(보상 30%, 웹판 그대로) — GO 101-2 ③ "75초 토벌"의 75/50/25% 부위 파괴 문턱 관례를 그대로 재사용해 부위 3(투구/갑주/무기, 사람형이라 GO의 다리/몸통/급소 대신)이 파괴될 때마다 보너스 골드+완파 보너스를 준다. 저스트 회피(공격 예고 타이밍)는 이 트랙 실시간 전투에 적 공격 예고(윈드업) 상태 자체가 없어 이번엔 스코프에서 뺐다(기존 회피 무적시간이 이미 "제때 피하면 안 맞는다"는 같은 결의 보상을 준다) | `PlayerCombat`·`DungeonEnemy`·`DungeonFloorRunner`·`HeroState`·`DamagePopup`·`HitSpark`·`LootMarker`·`GraveMarker`·`PlayerHud`·`CameraRig`·`BlessingState`·`BlessingChoiceUi`·`SigilState`·`HordeRunner`·`HordeGate`·`HordeState`·`EraFusionData`·`ItemData`·`WeaponVisual`·`DungeonDailyTaskState` |
| FOREST | 5.1 일과판 5.2 마무리 카드 5.3 마을 번들 5.4 관계 하트 5.5 발견 격자+정령 60 5.6 축제 5.7 택배 사슬 5.8 채집 손맛 | **5.1+5.2 → 5.4 → 5.5 → 5.3 → 5.7 → 5.6 완료(2026-09-20~21) — FOREST 101-2 전부 닫혔다.** **5.6(2026-09-21)**: 웹판(157행) 설날·대보름·삼짇날·단오·칠석·백중·한가위·동지 8개(음력 날짜)는 이 트랙에 낚시·부엌·주민 5명(숲지기 1명뿐)·음력 계산이 없어 전부 못 옮긴다 — 사용자와 상의해 **셋만** 골랐다: 세배(숲지기에게 말 걸기, "주민 5"를 1명으로 축소)·꽃놀이("꽃 8종류 찾기"를 이 트랙의 실제 채집 갈래 수 4로 좁혀 "60초 안에 채집 자리 넷 모두")·소원("별똥별"을 고정 소원돌 오브젝트로, 보상은 원문 그대로 "다음 날 채집 ×1.5"를 24시간 실시간 버프로). 음력 계산 자체도 새 라이브러리 없이는 불가능해 **매달 고정 일자**(1일=세배·8일=꽃놀이·15일=소원)로 재해석 — `DateTime.Now`가 매달 그 날짜에 반복되므로 GO/DUNGEON 일과판의 날짜 해시가 필요 없다(행사가 날짜 하나에 결정적으로 묶임). 나머지 다섯(대보름·단오·백중·한가위·동지)은 각각 새 오브젝트(모닥불)·시스템(낚시·연타·사진·부엌)이 없어는 못 옮겨 스코프 밖에 남겼다. 새 `ForestFestivalState`(순수 판정 — SigilState처럼 결정적)·`ForestWishStone`(소원돌, `ForestVillager`와 같은 결). `ForestSessionTracker.GoalLineWeek()`의 자리표시 문구도 같이 고쳤다 — 오늘이 행사날이면 안내, 아니면 다음 행사까지 D-day. 세이브 v7(`festivalDoneDate`·`festivalWishUntilTicks`, 소원 버프는 GO `DropState`처럼 Ticks라 앱을 껐다 켜도 흐른다). 헤드리스 진단(`CheckFestival()`)은 `ForestFestivalState.ForceDayForTest()`(진단 전용, 실제 게임 코드 경로에선 안 씀)로 날짜를 고정해 세배·꽃놀이·소원 완료 1회·같은 날 중복 거절·소원 배율·목표판 D-day 문구까지 값으로 확인 — GO `CheckDailyTasks()`가 날짜 문자열을 직접 넘기는 것과 같은 결. — 웹판 곤충·물고기·화석·조개 4갈래는 사고(박물관) 건물·가방을 전제하지만 이 트랙엔 둘 다 없고(`ForestState.cs` 클래스 주석) 호수·강도 없어(`ForestGroundBuilder` "판정은 항상 평면 좌표로") 물고기·조개 갈래를 옮길 대상이 없다 — 대신 이미 있는 네 바이옴 존(`ForestBiomeData.Zones`)에 하나씩 어울리는 갈래로 재해석했다: 어둑숲→곤충, 버섯숲→버섯, 바위 지대→화석, 꽃밭→화초. "채집=기증"으로 합쳤다(가방이 없어 발견 즉시 도감에 기록, DUNGEON `BestiaryState`와 같은 결). 새 `ForestMuseumState`(도감 상태)·`ForestCollectSpot`(존별 채집 자리 4)·`ForestMuseumDecorator`(갈래 완성 시 시설 하나, 네 갈래 다 채우면 깃발). **5.8① 채집 손맛도 완료(2026-09-20)** — 웹판 "아이템 팝→가방"은 가방이 없어 `DamagePopup` 결의 텍스트 팝으로, "효과음 20종"은 기존 Kenney 3종 라운드로빈으로, "연속 채집 리듬 보너스"는 낚시가 없어 채집 성사 자체를 8초 창으로 세는 쪽으로 재해석했다(새 `ForestGatherFeel`·`ForestGatherPopup`·`ForestGatherBump`·`ForestGatherStreak`, 경위는 HISTORY 2026-09-20 grep). **5.8② 마을 평가도 완료(2026-09-20)** — 웹판 잡초·꽃·심은 나무·집 꾸미기·사고 기증 다섯 축 중 이 트랙엔 잡초·꽃·나무 심기 자체가 없어(자라는 식생 없음) 실제로 값이 있는 둘(집 꾸미기 `ForestHomeState.Score()`, 박물관 기증 `ForestMuseumState`)만 합쳐 별 5개로 환산했다. 등급 경계는 웹판 `town.js BEAUTY_GRADES`(0/60/100/150/200)를 그대로 재사용. "별이 떨어질 조건" 경고는 안 옮겼다 — 이 트랙 두 축 다 늘기만 해 내려갈 일이 없다. 5.8③(자동 순행은 손맛 건너뜀)은 이 트랙에 자동 순행 시스템 자체가 없어 해당 없음. 새 `ForestTownScore`(점수·별·조건 2줄)·`ForestTownScoreBoard`(마을 중심 깃대, 다가가면 토스트). **5.7 택배 사슬도 완료(2026-09-20, 게이트 무시하고 이 트랙 자체 진행 — 사용자 결정)** — 웹판(167행)은 우주기지·폐허·캠프 같은 고정 목적지 3곳을 전제하지만 이 트랙 지도엔 그런 랜드마크가 없어 이미 있는 네 바이옴 존을 배달 목적지로 재해석했다(우체통을 존마다 하나씩). 보상은 금 경제가 없어(`ForestState.cs` 클래스 주석) 과일로 재해석, 웹판 "현실 5분" 시간제한은 이 트랙 맵 크기에 맞춰 45초로 축소. 소포 3종(보통/깨지기 쉬움 — 달리면 파손/시간제한 — 늦으면 보상 절반)·연속 3배달 사슬 보너스(×1.5)는 원문 결 그대로. 웹판의 배달 등급 마일스톤(10/30/60 — 수레·우주복·로버 탑승 등 코스메틱)은 이 트랙에 그런 자산이 없어 스코프에서 뺐다(장식 대신 누적 배달 수만 세이브). 새 `ForestDeliveryState`(소포·사슬·누적 배달)·`ForestDeliveryCounter`(접수대)·`ForestDeliveryMailbox`(목적지 우체통 4). `Player/PlayerController.cs`가 매 프레임 달리는 중인지 `ForestDeliveryState.NotifyRunning()`으로 보고. | `ForestState`·`ForestVillager`·`ForestHomeState`·`ForestGroundBuilder`·`ForestMuseumState`·`ForestCollectSpot`·`ForestMuseumDecorator`·`ForestGatherFeel`·`ForestTownScore`·`ForestTownScoreBoard`·`ForestDeliveryState`·`ForestDeliveryCounter`·`ForestDeliveryMailbox`·`ForestFestivalState`·`ForestWishStone` |
| STORY | 5-1 직업 정체성(고유 조작) 5-2 무예 유파 재해석 5-3 비경 미니던전 5-4 관문 대장 주간 보스 5-5 이동 손맛 5-6 목표판·카드 5-7 손맛 표준 5-8 동료 교대 | **5-5 → 5-7 → 5-1 → 5-4 → 5-3 → 5-8 완료(2026-09-20~21)** — 남은 건 5-2뿐. **5-2 결정(2026-09-23, 사용자 "무예 트리부터")**: 웹은 2026-09-19에 이미 구현했다(보류 사유 "웹 미확정"은 낡았다) — 진짜 걸림돌은 이 트랙에 무예 96·SP·띠가 없다는 구조 차이라, **1단계 = 1차 직업 무예+SP**(완료, `StorySkillData`·`StorySkillState`·`StorySkillPanelUi`·`StorySkillSlotButton` — 웹 1차 24개 중 heal 둘 제외 22개, SP 레벨당 2(웹 현재값), 칸 4 자동 배치, heal·guard·invuln은 체력 축이 없어 뺌, 부적 regen만 기력 회복 배율로 옮김, 퇴보사는 설명대로 후퇴), **2단계 = 2차 전직 + 유파 세트(완료, 2026-09-23)** — 1차만으론 유파마다 무예가 하나라 칸에 같은 유파 둘을 놓을 수 없어(사용자 결정 "2차 전직부터") 2차 넷(장군·신궁·자객·도사, grow 원문)과 2차 무예 19개(웹 20 중 회천결 heal 제외, 철벽·호신부 guard와 그림자밟기·축지술 invuln 뺌, 새 효과 rain 하나)를 먼저 들였다. **결정(사용자)**: 2차 전직은 웹 Lv.25 대신 **Lv.15**(+1차 무예 하나 5, 웹 canJoin 원문) — 사냥터가 하나라 Lv.10→25에 비경 약 300판이 들었다. **비경 적은 플레이어 레벨을 lv로** 받아 경험치만 웹 식 `(6+lv×4)×(보스15)`(Lv.10→15 약 4판), 체력은 웹 식(18×1.22^lv) 대신 **기본 공격력이 시작값보다 늘어난 비율만큼**(이 트랙은 공격력이 레벨로 안 올라 웹 식이면 Lv.13부터 보스를 90초 안에 못 잡음). 3·4차도 레벨을 낮춘다(아래 3단계 — 비율 대신 판수로). 세트는 웹 `SCHOOLS` 24행·`schoolBonus()` 그대로(2 → V2, 4 → V4; 칸 4라 4세트는 3·4차가 생겨야 가능). 칸은 여전히 자동 — 웹 bar()처럼 윗자리부터, 단 **칸이 4라 남은 자리엔 이미 놓인 것과 같은 유파를 먼저**(재해석). dash 2세트는 회피 동작이 없어 그 dash 무예 자신의 재사용 대기에 곱한다. `StoryJobState.Promote()`·`StoryJobTrainer.ShowPromote()`(StoryChoiceUi 2택)·`StorySkillState.SlotSkills()/SchoolTier()/BonusOf()`·`StorySkillData.Schools`·`StoryCombat.JobsTier2/EnemyExp()`·`StoryLabyrinthRunner.PlayerPowerHpMul()`. **3단계 = 3·4차 전직 + 칸 고정(완료, 2026-09-23 — 판단 질문에 답 없이 "이어해"라 기본안으로 진행)**: 3차 넷(원수·비장·귀영·진인)·4차 넷(전신·궁성·명왕·천존, grow 원문)과 무예 48 중 회복 넷을 뺀 44개(무적은 invuln만 빼고, 답공사·익보사는 후퇴). **레벨은 웹 Lv.45/70 대신 Lv.20/25** — 2차와 같은 비율(×0.6)이면 Lv.27/42인데 경험치 필요량이 1.28^lv, 비경 경험치는 lv 1차식이라 15→27 약 60판·27→42 1,500판 이상이 들어 **판수로 맞췄다**(10→15 약 5판, 15→20 약 11판, 20→25 약 28판). 무예 조건은 웹 canJoin() 원문(3차 8·4차 10). **칸은 자동 + 사람이 고정**(`StorySkillState.TogglePin`): 4차가 되면 자동 배치가 유파 다른 4차 무예 넷으로 차 세트가 아예 안 켜져, 고정한 무예가 고정 순서대로 앞 칸, 남은 칸은 예전 자동 배치(같은 유파 먼저)로 — 아무것도 안 고정하면 예전과 같다. 세이브 `skillPins`(버전 안 올림). 무예 패널은 사슬이 최대 23줄이라 **차수 탭**(1차~지금 자리, 열면 지금 자리)으로 한 번에 한 차수만, 줄마다 "칸" 버튼, 탭 아래 칸 넷 줄. `StoryCombat.JobsTier3/4·UpperJobTables·PromoteLevelFor/PromoteSkillLevelFor`·`StoryJobState.NextTier/PromoteLevelNeeded`·`StorySkillPanelUi.SelectTab/ClickPin`. **5-8(2026-09-21)**: 웹판(302행)은 인물 105 로스터에서 셋을 편성해 각자 개별 체력을 갖고 쓰러진 인물은 마을 복귀까지 교대 불가한 것을 전제한다 — 이 트랙엔 인물 로스터가 없고(`StoryCombat.cs` 클래스 주석) 결정적으로 **플레이어가 피격당하지 않아**(`StoryCombat.StartHp` 주석) 개별 체력·쓰러짐·"0.2초 무적" 셋 다 적용할 축이 없다. "편성"을 인물 획득이 아니라 **항상 갖춘 고정 역할 셋**(선봉·유격·호법)으로, "체력"을 공격 배율(1.15/1.0/0.9)로, "서명 1발"을 그 역할의 기존 무예(횡소/기탄/기합, 웹판 "새 효과 없음" 원칙 그대로 재사용)를 MP 소모 없이 즉시 발동하는 것으로 좁혔다 — 그 무예 자신의 쿨다운은 그대로 존중(교대 자체의 4초 쿨다운과는 별개 축). 직업·무예는 여전히 계정 단위(웹판 그대로). 웹판 "HUD 초상 3(체력 바)"은 초상 자체가 없어 `StoryHud` 텍스트 한 줄(활성 역할+교대 쿨다운)로, "버튼 1(폰은 초상 탭)"은 역할마다 버튼 셋(선봉/유격/호법)으로 재해석했다(더 명확함). 새 `StoryPartyState`(순수 로스터·쿨다운 판정), 세이브(버전 안 올림, `championWeek`류와 같은 결 — 없으면 0=선봉). **5-4(2026-09-20)**: godot STORY(`story_boss_spawner.gd`/`story_enemy.gd`, HISTORY 2026-09-17 실기 승인)의 재해석 — godot은 자동 리스폰하는 필드 넷을 매주 강화판으로 재활용하지만, 이 트랙은 두목이 하나뿐이고 상시 그 자리에 서 있는 편도 필드다(반격도 없다 — `StoryEnemy.cs` 클래스 주석 "재해석" 참고). "이번 주 미도전이면 그 두목이 챔피언으로 승격"으로 좁히고, godot의 "3분 초과 시 광폭화"(공격력 배율 — 이 두목은 애초에 반격을 안 해 적용할 축이 없다)는 "시간 안에 못 잡으면 태세를 정비한다"(체력 회복+무제한 재도전, 재방문 없는 필드라 도망 대신 재해석)로 바꿨다. HP×2.5·방패 파괴(누적 피해 30%→10초 피해 ×1.5)·처치 시 경험치×2(이 트랙엔 금·고유장비가 없어 경험치만)는 godot 수치 그대로. 새 `StorySaveState.ChampionAvailable()/ClaimChampion()`(주 index, SAVE_VERSION 안 올림), `StoryEnemy.TryBecomeChampion()`(GameBootstrap.Start()가 TryLoad() 뒤 명시적으로 호출 — Awake() 시점엔 세이브가 아직 안 실렸을 수 있다), `StoryHud`에 챔피언전 타이머 줄. **5-3(2026-09-20)**: godot STORY(`story_labyrinth.gd`, HISTORY 2026-09-18 실기 승인)의 재해석을 이어 옮겼다 — 원안 "인물 서명 효과를 빌려 쓴다"는 이 트랙에 로스터가 없어(웹판도 "인물 미선택 대체값" 시작) godot과 같은 결로 실제 채널(공격/방어/유틸 3축, 9종 — 축마다 하나씩 뽑는 구조라 축 중복이 애초에 안 생긴다)로 다시 짰다. **재해석 — 죽음**: 이 트랙 플레이어는 피격당하지 않아(`StoryCombat.cs` StartHp 주석) HP 기반 죽음이 없다 — 대신 **노드 제한시간**(전투 50s·정예 60s·보스 90s)을 강제 실패 조건으로 세웠다(시간 안에 못 끝내면 회차 종료, 이미 확정된 기억 조각은 유지). **재해석 — 실행 방식**: godot은 새 3D 씬을 짓지만 이 트랙은 필드 경계벽이 폭만 막고 있어(`StoryTerrainBuilder.BuildBoundaryWalls`) 새 구역을 끼울 자리가 없다 — 노드 지도는 풀스크린 UI(`StoryLabyrinthMapUi`)로, 전투류 노드만 필드 밖 멀리(x=1000~) 지은 전용 아레나로 순간이동시켜 실제 `StoryEnemy`를 스폰해 싸운다(보물·휴식·사건은 즉시 판정). **재해석 — 영구 강화**: 원안 "최대 HP +2%×10단"은 적용 축이 없어(`StoryJobTrainer.cs` "체력 상한이 어디에도 안 쓰인다" 주석) 실제 채널인 공격력에 얹는다. 새 `StoryLabyrinthData`(축복 9종·노드 5종·주간 변형자 3종)·`StoryLabyrinthState`(회차는 메모리만, 기억 조각·영구강화 단수만 세이브)·`StoryLabyrinthRunner`(아레나·노드 판정·제한시간)·`StoryLabyrinthGate`(문, `StoryChoiceUi` 재사용)·`StoryLabyrinthMapUi`(노드 지도+은사 3택 UI). 헤드리스 진단 중 실제 버그 둘 발견·수정: `StoryLabyrinthMapUi.Instance`가 에디터 전용 `Build()`에서만 채워져 있어(`StoryJobChoiceUi`와 같은 함정) 실제 플레이 세션엔 null로 남았을 것 — `Awake()`에도 채우게 고침. `ClearChildren()`이 `Destroy()`(프레임 끝 지연)를 써서 같은 프레임에 은사 패널을 연달아 다시 그리면 버튼이 안 지워지고 쌓임 — `DestroyImmediate`로 고침. | `StoryPlayerController`·`StoryCombat`·`StoryJobState`·`StoryEnemy`·`StorySaveState`·`StoryHud`·`GameBootstrap`·`StoryPartyState` |
| REALM | 5-1 인물 특성·야망 5-2 관계 이벤트 체인 5-3 일기토·설전 5-4 시작 시나리오·이정표 5-5 승리 조건·결과 카드 5-6 지형·진형 개입 5-7 월간 요약 카드 5-8 계승 | **5-7 → 5-1 → 5-6 → 5-2 → 5-8 → 5-3 → 5-5 전부 완료(2026-09-20)** — 남은 건 5-4(제외 확정, 아래)뿐, 101-2 REALM 은 이제 다 닫혔다. **5-5(2026-09-20)**: godot REALM(`realm_save_state.gd` `check_result()`, 2026-09-17 실기 승인)의 재해석 — 이 트랙엔 세력·화친 시스템 자체가 없어(REALM 은 무주공산 성만 있다) 웹판·godot 의 패권·외교·생존 셋은 그 개념 자체가 없어 보류하고, **정복**(전 적국 함락, 이번에 판정 신설)과 **문화**(문답 정답 30 — godot 은 문답 은행 260개 기준 200이지만 이 트랙 은행은 36개뿐이라 "학문" 야망 목표(15)의 두 배로 좁힘) 둘만 남겼다. godot과 같은 "닫힌 판"(먼저 채운 조건 하나로 끝) — 새 `RealmVictoryState`(순수 정적 클래스), 달성 시 `SessionCard`로 결과 카드(연월·함락 성·로스터 3줄), 목표판 셋째 줄이 "가장 가까운 승리 조건 + 진척 %"로 바뀐다(`RealmSessionTracker.GoalLineWeek()`). `RealmCommandUi.ExecuteNextMonth()`만 godot처럼 판이 끝난 뒤를 막는다("공격"·"명령"은 안 막음 — 계속해도 무해). (공통 선행 A·B 는 2026-09-17 `RealmSessionTracker` 로 이식 완료 — 5-7 아이디어를 그대로 써 "월간" 트리거로 변형. **Q-U2(사슬 계속 vs 5-4 전환)는 2026-09-18 "사슬 계속"으로 결정 — 웹 미검증인 5-4(새 시나리오 6종)는 이 트랙에 안 옮긴다.** 세 사슬 끝(회계·영안·오원)이 원작 LINKS상 진짜 막다른 끝이라 "성 하나당 목표 하나" 제약을 풀고 16차 확장(장안→천수·장사→남해·강주→주제)으로 계속 늘림 — `RealmEnemyCity.TargetsFrom()`·`RealmCommandUi` 공격 고르기 패널 신설, 자세한 경위는 `docs/HISTORY.md` 2026-09-18. **5-1(2026-09-20)**: 무장 3명뿐이고 치안·태수·이간·명성 축이 없어 웹판 특성 12·야망 6종 대신 실제 계수 자리 셋(계략 성공률·출진 전투력·문답 보상)에 물리는 특성 3종(용맹·교활·현명)·값 판정 가능한 야망 3종(부귀·숙적·학문)으로 좁혔다. 새 `RealmOfficerTraits`(id 해시 결정적, 세이브는 야망 달성 여부만). **5-6(2026-09-20)**: 성 지형이 `RealmLand` 둘(Plain/River)뿐이라 웹판 지형 4종·전술 4개 대신 평야=기병 돌격(무력80+, 첫 합 ×1.25)·강=화공(지력60+, 전투 내내 상대 전투력 ×0.85) 둘로 좁혔다. "진형 수동 선택"은 이 트랙에 진형 시스템 자체가 없어(`RealmArmy`에 그런 필드 없음) 스코프 밖. `RealmWar.Fight/StepRound`에 `firstRoundPowerMul`·`defPowerMul` 두 배율 자리를 새로 열고 `RealmWarState.ResolveTactic()`이 지형·로스터 능력치로 계산, `RealmCommandUi`에 켜고 끄는 토글 버튼(현재 성 기준 지형 힌트 문구 포함) · **5-2(2026-09-20)**: 무장 관계(의형제·원수 등 20~30쌍)·세력 간 이벤트 대신 saga-godot 승인분과 같은 결로 "특성·야망(5-1) 조건의 1인 서사 카드"로 재해석 — 카드 7종(특성 3+야망 3+체인 후속 1 "논공행상"), 매달 18%, 효과는 금만(전투력·계략 배율은 5-1·5-6과 겹쳐 안 건드림), 세이브 없음(문답류와 같은 결). 새 `RealmEventState`, `RealmCommandUi`에 자동 팝업 패널(다른 아홉 패널과 달리 `CloseAllPanels()`가 안 건드림). **5-8(2026-09-20, 사용자와 두 차례 상의 뒤 재해석 확정 — 경위는 HISTORY 2026-09-20 grep)**: 무장 풀이 3명 고정(`RealmOfficerPool.Catalog`)이라 원작처럼 무장이 죽으면 로스터가 영구히 줄기만 하고, 반대로 "일시 정지"로 죽음을 빼면 후계자가 자리를 잇는다는 계승의 알맹이가 사라진다 — 그래서 아무도 안 죽되 **허창(본거지) 배치 자리 자체가 실제로 넘어가는** 쪽으로 좁혔다: 매달 낮은 확률로 허창 주재 무장이 물러나면 로스터의 다른 무장 중 통솔(Command) 최고가 허창을 잇고(`RealmCityState.SwapOfficerCities`, 기존 배치 딕셔너리를 맞바꿀 뿐이라 세이브 스키마 변경 없음), 대가로 허창 치안이 절반으로 깎인다(성 함락 뒤처리와 같은 기존 규칙 재사용). 웹판·saga-godot과 같은 "위험이 크므로 손잡이 뒤에" 원칙대로 `RealmSettingsState.SuccessionOn` 기본 꺼짐. 새 `RealmSuccessionState`. **5-3(2026-09-20, 이전 세션이 "실제로 만든 적이 없는 오기"라 바로잡은 뒤 이 세션이 구현)**: godot REALM(`realm_war.gd`·`realm_save_state.gd`)이 이미 실기 승인받은 재해석 그대로 옮겼다 — **일기토**는 "무력 차 보정" 없이 순수 3택 가위바위보(베기>막기>막기>찌르기>찌르기>베기)로 좁히고, 이 슬라이스의 `Fight()`가 10합 집계식이라 "합마다"가 아니라 3합 결과를 평균 배율(승1.3·무1.0·패0.8) 하나로 뭉쳐 `RealmWar.Fight`의 새 `duelPowerMul` 자리(매 합 atk 쪽, `firstRoundPowerMul`·`defPowerMul`과 안 겹치는 축)에 얹는다 — `RealmCommandUi`에 전술과 독립된 토글(둘 다 켜면 배율이 같이 곱해진다). **설전**은 동맹/화친(다른 세력) 자체가 없는 이 트랙엔 유일한 적용처인 "등용"(hire)에만 걸고, 사자 지력으로 난도 상한(70+→3등급·40+→2등급·그 밖 1등급)을 정해 문답 은행(`RealmQuizData.Bank`, 학당과 별도 추첨 — `RealmQuizState`의 익힘/오답/연속 상태는 안 건드림)에서 3문 뽑아 정답 수(0~3)→배율(0.8/0.95/1.1/1.3)을 등용 성공률에 곱한다(같은 0.05~0.9 구간으로 다시 클램프, 새 `RealmCityState.HireChance()` 순수 함수). 새 `RealmDuelState`·`RealmDebateState`) | `RealmCommandUi`·`RealmWarState`·`RealmWar`·`RealmOfficer`·`RealmOfficerTraits`·`RealmEventState`·`RealmSuccessionState`·`RealmQuizState`·`RealmSessionTracker`·`RealmEnemyCity`·`RealmDuelState`·`RealmDebateState`·`RealmVictoryState` |

**공통 선행(다섯 판 동시, SagaCore 에 1벌)**: `GoalBoard`(A, 3줄 위젯 — 게임별 공급자 인터페이스 `IGoalSource` 를 각 asmdef 가 구현) · `SessionCard`(B, Timeline 5초 카드) · `HitFeedback`(C — 아래) · `Cadence`(H, 로컬 시계 기반 일일/주간 키). SagaCore→게임 단방향 의존(49장)은 그대로.

## 101-3. 엔진 장점으로 C·G 를 한 단 올리기(웹이 못 하는 것)

| 표준 | Unity 수단 | 기본값 |
|---|---|---|
| C hitstop | `Time.timeScale` 대신 **피격자·가해자 Animator.speed=0** + 나머지 정상(전역 정지는 모바일 입력 지연) | 70ms, 치명 120ms — **다섯 판 중 실시간 전투가 있는 GO·DUNGEON·STORY 전부 구현 완료(2026-09-17)**. STORY는 `StoryCombat.ApplyHitFreeze()`(가해자만, 이 판은 적 쪽 Animator가 아예 없다)로, 웹판 원문 그대로인 크리티컬 전역 슬로모(`TriggerHitstop`/`Time.timeScale`)와는 별개 기능. GO는 `BanditEncounter`/`RareWolfEncounter.ApplyHitstop()` — 프레임 단위 공격이 아니라 초당 판정(`DuelRules.Step`)이라 "hit"/"heavy(안 피함)" 이벤트마다 player·foe(있으면) 둘 다 멎는다(늑대는 Animator 없는 primitive라 player만 실제로 걸림). GO 헤드리스 검증은 이 PC 기준 **player Animator가 null**(Maria FBX 미보유 — foe Abe는 예전에 구운 그대로라 있음)이라 foe 쪽 speed==0만 실제로 확인 |
| C 흔들림 | **Cinemachine Impulse Source/Listener**(이미 Cinemachine 권장, 40장) | 진폭 0.15m·120ms·감쇠 지수 |
| C 플래시 | `MaterialPropertyBlock` 로 `_EmissionColor` 80ms(머티리얼 복제 없음, SRP Batcher 유지) | 흰색 0.6 |
| C 팝·소리 | `DamagePopup`(DUNGEON·STORY 2026-09-17 기준 2벌 — GO/FOREST/REALM은 실시간 근접 전투가 없거나 범위 밖) + `SfxPlayer` 라운드로빈 3음 | 0.6s 상승·페이드 |
| C 타격 VFX | Mobile: Shuriken 스파크 8입자 / PC: VFX Graph 동일 이름 | **DUNGEON·STORY 구현 완료(2026-09-17)** — `HitSpark`(두 판 각각 사본, `DamagePopup`과 같은 파일 위치). VFX Graph는 에디터 노드 그래프라 이 프로젝트의 "빌드 스크립트가 코드로 짓는다" 방식과 안 맞아 **PC도 같은 Shuriken 재사용**으로 단순화(강공격/크리티컬은 입자 수 8→14·속도로만 구분). 표의 "풀링 16"도 `DamagePopup`과 같은 이유(도메인 리로드 끈 헤드리스 연속 실행에서 static 배열이 파괴된 오브젝트를 계속 든다)로 안 쓰고 즉시 Destroy — 수명 0.25s로 짧아 안전. 헤드리스 검증은 `HitSpark.SpawnCount`(테스트 전용 카운터)로 확인 |
| G 장비 가시화 | `CharacterVisual` 에 슬롯 소켓(무기·어깨·망토) — Mixamo Humanoid 본 이름 고정이라 소켓 공용 | 등급별 이미시브 림 3단 — **STORY 전직 차수 옷 빛깔(2026-09-23)**: 웹판 `jobLook()` 이식 — 옷 슬롯 `_BaseColor`에 갈래 색(웹 BRANCH_TINT)을 차수×0.12(상한 0.6) 섞는다, **재해석**: 사실적 PBR이라 피부 재질("Skin")은 건너뛰고 공유 재질 대신 슬롯별 `MaterialPropertyBlock`(`StoryOutfitTint`). 무기는 갈래 뿌리로만 갈려 2~4차 차이가 안 보이던 자리를 채운다. **무기 소켓 DUNGEON·GO 구현 완료(2026-09-17)**. `CharacterVisual.FindOrCreateWeaponSocket()`(오른손 `HumanBodyBones.RightHand`, Humanoid 아니면 시각 루트 밑 고정 오프셋 폴백) + `WeaponVisual`(자루+칼날을 코드로 짓는다, 무기 메시 자산이 없어서 — 원작 자산 금지). `ItemData.Grade`(0~2)를 무기 서열에 맞춰 새로 매겼다(DUNGEON: wp_start·wp_axe=0, wp_saber=1, wp_glaive·wp_greatblade=2 / GO: wp_wood=0, wp_iron=1, wp_relic=2) — 등급이 높을수록 칼날이 조금 더 크고 이미시브 림이 강해진다(0=무광·1=옅은 청록·2=강한 금색). GO는 `HeroState.EquipmentChanged` 대신 `Inventory.ItemGained`(무기 슬롯만 필터링, "주웠다" 이벤트라 재장착 개념 자체가 없음 — 시작 무기도 없어 "닫힌 빈 손"이 0등급으로 표시됨). 어깨·망토 소켓은 그런 장비 데이터 자체가 아직 없어 범위 밖(105장 결정 전까지 손 안 댐). STORY는 아이템/등급 시스템 자체가 없어(순수 job 스탯) 이 방식 그대로 포트 불가하나, 사용자가 "직업별 무기 소켓"으로 재해석 지시(2026-09-18) — **완료**: `StoryWeaponVisual`(무사→검·궁수→활·협객→표창·방사→지팡이, 전부 primitive 조합), `StoryJobState.JobChosen` 이벤트(전직·세이브 로드 둘 다 배선 — `Restore()`도 쏘게 고침, 안 그러면 세션 중 리셋 뒤 손의 무기가 새 Job과 안 맞는다) |
| G 지형 반응 | **URP Decal Projector** 로 발자국·타격 흔적(웹 불가) | 수명 8s·최대 32 — **DUNGEON·GO 구현 완료(2026-09-17)**. `BuildDecalRendererFeature.cs`(멱등)가 `PC_Renderer.asset`·`Mobile_Renderer.asset` 둘 다에 `DecalRendererFeature`를 배선(기본값 Automatic 기법 — DBuffer/ScreenSpace 자동 선택, 데칼 레이어 끔이라 아무 표면이나 다 받음, **프로젝트 공통 자산이라 DUNGEON 때 한 번 배선한 걸로 다섯 판 전부 적용됨**). `GroundDecal`(판별 사본)이 발자국(이동 중 0.35s 간격)·타격 흔적(피격마다)을 스폰 — 텍스처 자산이 없어(원작 자산 금지) 패키지 내장 `Shader Graphs/Decal`에 단색만 입힌 사각 패치일 뿐 실제 발자국·타격 자국 "모양"은 아니다(실기 확인 대기). 캡 초과 시 가장 오래된 것부터 즉시 제거. GO는 실시간 프레임 히트 판정이 없어(`DuelRules.Step` 초당 판정) 타격 흔적은 `BanditEncounter`/`RareWolfEncounter.OnDuelEvent()`의 "hit"/"heavy(안 피함)" 케이스에 건다(101-3 C hitstop과 같은 훅). `SagaDungeon.asmdef`·`SagaGo.asmdef` 둘 다 `Unity.RenderPipelines.Universal.Runtime` 참조 추가 필요했음(`DecalProjector`가 URP 전용 어셈블리) — STORY는 asmdef 자체가 없어(전역 어셈블리) 이 문제가 없다. **STORY도 완료(2026-09-18)** — `StoryGroundDecal`(사본), 발자국은 `StoryPlayerController.Walk()`, 타격 흔적은 `StoryEnemy.TakeDamage()` |
| G 성장 연출 | Timeline + Cinemachine 컷(레벨업 1.2s) | **DUNGEON·GO 구현 완료(2026-09-17)** — `CameraRig.PlayLevelUpCut()`. Cinemachine 패키지를 이 프로젝트가 안 받았고(G 흔들림도 Impulse 대신 수동 `Shake()`) Timeline 애셋 전례도 없어 같은 결로 "줌을 MinZoom까지 당겼다 되돌리는" 수동 코루틴으로 대신했다(합계 1.2s 그대로). DUNGEON은 `HeroState.LeveledUp`, GO는 `PlayerStats.LeveledUp` → 각 `GameBootstrap.OnLeveledUp()`이 호출(GO는 그동안 구독자가 0명이었다 — 이번에 처음 연결). 스킵 가능 그대로 — 아무 키나 누르면 그 프레임에 원래 줌으로 복귀. STORY는 카메라가 오빗이 아니라 X/Y 고정 추적 원근 카메라(줌 개념 자체가 없음) — **완료(2026-09-18)**, `ZDistance`를 가변 필드로 바꿔 같은 결의 카메라 펀치인으로 재해석(`StoryCameraFollow.PlayLevelUpCut()`), `StoryJobState.LeveledUp` → `GameBootstrap.OnLeveledUp()` |
| F 죽음 | 리깅 유지한 채 `Animator` death → 유품 마커 프리팹 드롭 | **DUNGEON·GO 구현 완료(2026-09-17)** — `LootMarker`(`DungeonEnemy.Die()`가 기존 즉시 보상 뒤 호출). 회수 반경 2m(표 그대로), 주워도 추가 보상은 없다 — 이미 준 보상의 시각적 잔향일 뿐(즉시-보상 흐름은 세이브·베스티어리·퀘스트 완료가 얽혀 있어 안 건드림). 12초 안 주우면 스스로 사라짐. GO는 각자 사본 `World/LootMarker.cs`(SagaDungeon 참조 불가라 새로 짬) — `BanditEncounter`/`RareWolfEncounter.FinishFight()`의 승리 분기, 기존 보상(등용·경험치·돈·전리품) 뒤·`Destroy(gameObject)` 전에 호출. 헤드리스 검증은 Bandit만(RareWolf는 같은 스폰 함수 재사용이라 위험 낮다고 판단, 안 건드림). STORY도 **완료(2026-09-18)** — `StoryLootMarker`(사본, `StoryEnemy.Die()`가 Destroy 전에 호출), Animator 유무와 무관해 그대로 포트됨 |

전부 **기존 씬 구성을 안 바꾸는** 컴포넌트 추가라 `Build()` 재실행이 필요한 것은 위젯 캔버스 추가(A·B) 둘뿐이다.

---

# 102. 그래픽 개편 — 사실적 PBR(66-2 유지) 위에 SAGA-DESIGN §6 적용

**전제**: SAGA-DESIGN §6.0-1 "한 스타일 = 툰" 과 §6.3 "Shader Graph 툰" 은 이 트랙엔 적용하지 않는다 — 66-2장(사용자 지시 2026-09-13, 사실적 PBR·FF16 톤)이 우선한다. §6.0 의 **나머지 원칙**(팔레트→톤, 스케일, 빛 방향, 카메라, 실루엣)과 §6.4 "허접 10가지" 는 그대로 적용한다. 트랙 간 스타일 불일치 자체는 105장 Q3′.

## 102-1. 아트 바이블(이 트랙 판)
1. 한 스타일: **사실적 PBR + 필름틱 LUT**. Kenney 로우폴리·VRoid 애니풍과 한 화면에 섞지 않는다(44장 교체가 끝난 판부터 강제).
2. 톤: 팔레트 스냅 대신 **판별 색보정 LUT 1장**(`Assets/Settings/LUT_<game>.png`, 32³) — 마을=따뜻/그림자 차갑게, 굴혈=청록, 들판=황금시각, 필드(STORY)=고대비, 성(REALM)=저채도.
3. 스케일: 사람 1.7m(Mixamo 기본 1.75 → `MixamoRigUtil` 에서 0.97), 문 2.2m, 층 3m. 임포트 `Preset` 으로 강제(103-2).
4. 빛: 키 라이트 방향 고정(회전 X 55°·Y -45°), 림 라이트 1(반대편 약 0.3), 앰비언트 = 스카이 그라디언트. `SkyFogBuilder`(GO) 값을 다섯 판 공통 프리팹으로.
5. 카메라: 판별 1개(FOV 40·거리 6·기울기 25°, STORY 는 정사영 12), 줌 2단. 흔들림은 101-3 Impulse 만.
6. 실루엣: 캐릭터·적은 128px 축소 스냅으로 구별 확인(`PlaytestXxx` 에 스크린샷 다운스케일 단계 추가 — GUI 필요라 사람 확인 몫).

## 102-2. Volume 프로파일 — 현재값과 추가값

| 오버라이드 | 현재(`FF16Volume_PC/Mobile`) | 추가·변경 | PC | Mobile |
|---|---|---|---|---|
| Tonemapping | ACES | 유지 | ○ | ○ |
| Bloom | 임계 0.9·강도 0.35·scatter 0.6·tint 따뜻 | 강도 0.5(§6.3) | ○ | ○(0.3) |
| Color Adjustments | 노출 +0.1·대비 12·채도 -8·필터 따뜻 | 대비 5·채도 -5 로 완화 + **LUT**(Color Lookup, 102-1-2) — **완료(2026-09-22)**, `BuildGameToneLuts.cs`가 게임별 32³ LUT(`Assets/Settings/LUT_<game>.png`)를 코드로 굽고 전용 `ToneVolume_<game>.asset`(ColorLookup만)으로 다섯 씬에 두 번째 Volume(우선순위 1)으로 겹침 — 공유 Color Adjustments 값은 안 건드림 | ○ | ○ |
| Vignette | 0.25·smooth 0.6 | 유지 | ○ | ○ |
| Film Grain / CA | 0.15 / 0.08 (PC 만) | 유지 | ○ | × |
| **SSAO**(Renderer Feature) | 템플릿 기본(PC) | 반경 0.5·강도 1.5·다운샘플 — **완료(2026-09-22)**, `PC_Renderer.asset` 값만 수정(Radius 0.3→0.5·Intensity 0.4→1.5·Downsample 0→1, 코드 아니라 직접 값) | ○ | × |
| **Screen Space Shadows** | 없음 | Renderer Feature 추가 | ○ | × |
| **Fog** | `SkyFogBuilder`(GO 만) | 다섯 판 공통, 색=하늘 지평선, 지수 0.012 | ○ | ○(0.008) |
| Shadows | Cascade 4/1, 2048/1024, MSAA 4/2 | 유지 + **접지 blob 그림자** 프리팹(모바일 캐릭터) — **완료(2026-09-22)**, `SagaCore/BlobShadow.cs`(QualitySettings "Mobile" 레벨에서만 켜짐, 코드로 구운 64×64 원형 그라디언트 공유 텍스처, GO·DUNGEON·FOREST·STORY Player에 배선) | ○ | blob |
| Depth of Field | **대화·카드 연출 토글 시만**(`SessionCard` 가 켠다, 105 Q-U5 2026-09-17 확정·구현 완료) | 유지 | ○ | × |
| Motion Blur | 없음 | 넣지 않는다 | × | × |
| Adaptive Probe Volumes | 없음 | 정적 씬 5개에 APV 1 + Reflection Probe 1 | ○ | 라이트맵 |

전부 `BuildFF16VolumeProfiles.cs` 확장 + `PC_Renderer.asset` Feature 추가로 코드에서 짓는다(Shader Graph 배선과 달리 코드 가능).

## 102-3. 캐릭터·재질 파이프라인
- 캐릭터: **Mixamo Humanoid(FBX)** 표준 유지, `MixamoRigUtil` 1벌. 피부는 `BuildMariaSkinSplit` 근사(BaseColor/Smoothness 웜톤) 위에 **`FakeSSS.shadersubgraph`를 Emission에 배선한 `MariaSkin.shadergraph`**(2026-09-22, `BuildMariaSssShaderGraph.cs` 리플렉션 조립, Q-U3 참고)를 겹쳐 실제 wrap-lighting 글로우를 더한다. 헤어카드 이방성(`AnisoHair_cathyhlshih`, MIT) 은 헤어 메시가 분리된 캐릭터에만(아직 분리된 헤어 메시 없음 — 미착수).
- 환경: Poly Haven CC0 PBR(`EnvironmentPBR_candidates` 5벌 → 승격) + `BuildMetallicSmoothnessMap()` 채널 팩킹 유지. **트라이플레이너 셰이더 1개**(heightmap 메시용, Shader Graph 없이 HLSL — `VertexColorLit.shader` 옆) 로 잔디·흙·돌 3타일 블렌드.
- heightmap 메시: `TerrainBuilder`(GO) 의 4×4 서브쿼드 정점 블렌딩 유지. 높이 데이터 규격(`float[w*h]` + 셀 크기)은 saga-godot 과 **파일 포맷만 공유**, 코드는 공유하지 않는다.
- VRoid: `UniVRM + MToon10` 은 애니풍 셰이더라 66-2 와 상충 — 이 트랙에선 초상·컷신에도 쓰지 않는다(105장 Q3′ 결정 전까지 파일만 보존).

## 102-4. `Assets/Art` 판정 표

**105 Q1 이 2026-09-21 "Unity 먼저"로 확정되며 게이트가 풀려 실행 시작.** 2026-09-21 세션에서 승격 둘(코드 참조 없음/문자열 경로뿐이라 안전) 실행·검증 완료. 나머지는 아직 표만(실행은 각자 조건 충족 확인 뒤).

| 폴더 | 내용 | 판정 | 이유 |
|---|---|---|---|
| `Shaders/Character/`(구 `CharacterShaders_candidates/`) SSS·AnisoHair·HairCards | MIT·MIT·CC0 | **완료(2026-09-21): 승격, SSS는 2026-09-22 배선까지 완료** | grep 확인 후 `git mv`만으로 이동. **SSS(`FakeSSS.shadersubgraph`)는 이제 `MariaSkin.shadergraph`에서 실제로 참조됨**(Q-U3). AnisoHair·HairCards는 여전히 코드 참조 0건(분리된 헤어 메시 없음) |
| `Environment/PBR/`(구 `EnvironmentPBR_candidates/`) Poly Haven 5벌 + .mat | CC0 | **완료(2026-09-21): 승격됨** | `BuildEnvironmentPbrSample.cs`·`BuildTestCityScene.cs`·`BuildTestDungeonScene.cs`·`BuildTestStoryScene.cs`·`BuildTestVillageScene.cs` 5개 경로 상수 갱신, 4씬 재빌드 + `PlaytestHeadless`·`PlaytestDungeonHeadless`·`PlaytestRealmSlice`·`PlaytestStorySlice` 전부 재검증 OK(STORY는 아래 "발견하고 고친 오류" 참고) |
| `CharactersRealistic/` (gitignore) | Mixamo Maria·Abe·Brute | 남김(로컬 전용) | ToS 상 재배포 금지, 커밋 안 함 |
| `CharactersVroid/` AvatarSample_A | 애니풍 | **완료(2026-09-21): 삭제됨** | 임포트 검증 끝, 66-2 와 불일치. 코드·GUID 참조 0건(Assets·ProjectSettings 전부 확인) 확인 뒤 사용자 승인 받아 `git rm` |
| `Characters/` Kenney blocky 4종 | CC0 로우폴리 | **판정 취소 — 아직 못 뺀다** | 2026-09-21 확인: `character-{a,b,c,d}.glb` 가 GO 플레이어·GO/FOREST/STORY 주민·STORY 잡졸·씬 4개에 **여전히 실사용 중**("44장 Player·Enemy 교체 완료" 전제가 틀렸다 — DUNGEON만 Mixamo 교체, 나머지 셋은 아직 Kenney). Q-U4(3명 유지 확정)로 봐도 이 넷을 곧 뗄 계획이 없다 |
| `Buildings/`·`Dungeon/`·`Shrine/` Kenney | CC0 | **완료** — `EnvironmentMaterial.MakeTiled()`로 실제 PBR(Poly Haven) 씌워짐 | `LandmarksBuilder.cs`(wall-block·roof-gable·gate-rock·altar-stone·planks)·`DungeonRoomBuilder.cs`(gateModel 아치)에 이미 있었다 — "완료 요약" 표의 "44장 완료"가 이 뜻. 102-4 재조사(2026-09-21)로 처음 확인 |
| `Props/` Kenney(fence·fence-gate·lantern·stall-red) | CC0 | **완료(2026-09-21 fence, 2026-09-23 lantern·stall)** | fence·fence-gate는 승격된 `Environment/PBR/dark_wooden_planks_URPLit.mat`을 `PropsBuilder.SpawnFencePanel()`에 씌움(`LandmarksBuilder.BuildBridge()`와 같은 결). **lantern·stall-red 재조사(2026-09-23, `BuildPropsMaterialSplit.cs`)** — "재질이 섞여 위험"은 실제로 삼각형별 UV 색을 다 뜯어본 결과 절반만 맞았다: lantern은 158개 삼각형 **전부**가 금속 톤(나무 성분 0, 쪼갤 게 없었다) — 원본 텍스처는 그대로 두고 `metallicFactor`·`roughnessFactor`(URP `_Metallic`이 아니라 glTFast PBR Shader Graph 고유 이름)만 올렸다. stall-red는 270개 중 나무 다리 142개·빨강 차양 128개로 뚜렷이 갈려 `BuildMariaSkinSplit.cs`와 같은 기법(삼각형 UV 중심점 팔레트 색 샘플)으로 메시를 서브메시 둘로 쪼개 다리엔 목재 PBR, 차양은 원본 그대로(색 안 건드림) 복제 재질을 씌웠다. **발견한 회귀**: `PropsBuilder.MarkStatic()`이 서브메시 여럿(=재질도 여럿)인 오브젝트까지 정적 배칭 대상으로 표시하면 Unity 정적 배칭이 결합 메시로 바꿔치기해 `MeshFilter.sharedMesh.subMeshCount`가 실행마다 달라졌다(실측 5·49) — 서브메시 여럿인 오브젝트는 정적 배칭에서 뺐다. 산출물은 `Assets/Art/Props/Generated/`(103-1 규칙, 커밋). |
| `Rocks/`·`Vegetation/` Kenney (GO+FOREST) | CC0 | **완료(2026-09-21)**: `procgen.py`(노이즈 변형)로 나무 12벌·바위 10벌을 새로 지어 GO `VegetationBuilder.cs`가 타일 해시로 고른다, `Saga/VertexColorTriplanarLit`(정점색+트라이플레이너 디테일)로 칠함. FOREST `ForestFruitTree.cs`(과일나무, 게임플레이 상호작용 오브젝트)는 인지 일관성 때문에 **변종 풀이 아니라 씨앗 하나(`tree_s1_01.glb`) 고정**으로 같은 재질만 적용 | Blender 불필요(trimesh만으로 충분, tree kind 신규). 실기 확인 대기(결과물은 사람이 직접 봐야 판단) |
| `Audio/` Kenney·CC0_BGM | CC0 | 남김 | |

**발견하고 고친 오류(2026-09-21)**: `PlaytestStorySlice`가 `KillEnemies` 단계에서 매번 FAIL(잡졸 #0 처치에 유품 마커 안 생김) — 이 승격 작업 중 우연히 드러났다(`git stash`로 HEAD에서도 재현해 회귀 아님을 확인). 원인은 `PlaytestStorySlice.cs`의 `SaveLoad` phase가 세이브 왕복 검증차 `StoryPartyState.Restore(2)`(호법, 공격 배율 0.9)로 바꾼 뒤 실제 `persistentDataPath/save_story.json`을 덮어쓰고 원상복구를 안 한 것 — 다음 실행마다 `GameBootstrap.Start()`가 이 오염된 파일을 이어받아 "잡졸 한 방 처치" 전제(공격력 마진)가 깨져 있었다. GO `PlaytestHeadless.cs`의 try/finally 원상복구 패턴을 그대로 옮겨 고쳤다. 103-3 과 무관한 별개 버그지만 이 승격 검증 중에 나온 것이라 여기 같이 적는다.

## 102-5. §6.4 "허접 10가지" 해당 여부
스타일 혼재 **해당**(Kenney 잔존·VRoid) · 후처리 **완료(2026-09-22)** — SSAO·LUT 5장(위와 동일)에 이어 **Screen Space Shadows도 추가** — `BuildDecalRendererFeature.cs`와 같은 결로 `BuildScreenSpaceShadowsFeature.cs`가 `SerializedObject`로 `PC_Renderer.asset`에만 건다(URP 내장 `ScreenSpaceShadows`는 `internal`이라 `Type.GetType(...)` 리플렉션으로 인스턴스화, 셰이더 필드는 비워 둬도 `LoadMaterial()`이 `Shader.Find`로 스스로 채운다) — Mobile_Renderer.asset은 그대로 둔다(102-2 원안 "모바일 성능 목표로 Cascade 1 유지" 판단과 같은 이유, 화면 전체 블릿 패스라 무겁다). 다섯 판 배치 컴파일+헤드리스 3연속 재확인. · 그림자 계단 **전부 완료(2026-09-22)** — Cascade 1은 유지(모바일 성능 목표, 102-2 원안)하되 `BlobShadow`로 접지 그림자 보완. Player 다음으로 적·NPC도 마쳤다 — `CharacterVisual.EnsureBlobShadow()`(GO/DUNGEON/FOREST/STORY 네 벌)를 `Spawn()`·`SpawnFallbackCapsule()` 끝에서 불러 Kenney 경로를 전부 덮고, `Spawn()`을 안 타는 리깅(Animator) 분기 셋(`BanditEncounter.cs`·`DungeonEnemy.cs`·`StoryEnemy.cs`)엔 같은 호출을 직접 추가 — `BlobShadow` 자체가 Mobile 품질 레벨 아니면 스스로 꺼지니 무조건 붙여도 안전 · 바닥 한 색 **GO·DUNGEON·STORY·REALM은 이미 실제 PBR 타일드 재질**(`EnvironmentMaterial.MakeTiled`)이거나 디테일 오버레이가 있었다 — **FOREST만 진짜 단색이었다(2026-09-22 발견·완료)**: `ForestWorldCurve.shader`에 GO `VertexColorLit`과 같은 결의 그레이스케일 디테일 오버레이(`_DetailTex`/`_DetailTiling`/`_DetailStrength`, 월드 XZ 직접 샘플)를 추가, `ForestGroundBuilder.cs`가 필드로 받아 `BuildTestVillageForestScene.BuildGround()`가 Poly Haven leafy_grass AO 맵을 물린다(기본값 흰 텍스처·Strength 0이라 이 셰이더를 같이 쓰는 나무·NPC는 영향 없음) · 하늘·안개 **GO 외 해당** · 스케일 **재조사 결과 절반만 해당(2026-09-22)** — 높이는 이미 통일돼 있다: Kenney(`CharacterVisual.Spawn(..., HumanHeight=3.4)`)와 Mixamo(`riggedVisualScale`, 실측 높이 기준 계산, `BanditEncounter.cs`·`DungeonEnemy.cs` 등)가 같은 목표 높이로 스케일을 맞춘다 — 남은 건 **비례(블로키 vs 사실적 체형)뿐**이고, 이건 103-3 결정("실제 Mixamo 모델은 3명만 유지")과 정면으로 부딪혀 코드로 못 고친다(Kenney 리메시나 Mixamo 확대가 필요, 둘 다 이 세션 범위 밖) — 그대로 두는 것이 현재 결정과 일관됨 · 애니 끊김 **재조사 결과 해소(2026-09-22)** — Maria·Abe·Brute 세 컨트롤러(`Assets/Animators/*.controller`) 전부 `m_TransitionDuration` 0.1~0.15s 블렌드가 이미 있다(직접 YAML 확인, `AddReturnToIdle()`·`AddAnyStateTrigger()` 빌더 코드도 동일) — 이 표를 쓴 시점(초기 102장)보다 나중에 44장 Mixamo 교체가 블렌드까지 같이 넣었는데 표만 안 고쳐져 있었다. 게임 코드에 `Animator.Play/CrossFade` 직접 호출 없음(전부 `SetTrigger`/`SetFloat`라 선언된 duration이 그대로 적용) 확인 · 타격 반응 **해당**(101-1 C) · UI 폰트·패널 **재조사 결과 해당 없음(2026-09-22)** — `RealmUiKit`·GO/FOREST `EncounterUiKit` 셋을 실제로 diff, 폰트(`LegacyRuntime.ttf`)·버튼/패널 색·크기까지 바이트 단위로 이미 동일하다(다섯 벌 복사 원칙대로 파일만 갈라져 있을 뿐) — PLAN이 이 항목을 "안 됨"으로 오래 들고 있었을 뿐, 실제 통일 작업은 필요 없다 · 카메라 클리핑 **전부 완료(2026-09-22)** — Cinemachine 패키지 없이(이 트랙은 카메라를 전부 수동 코루틴으로 다룬다, `CameraRig.cs` 클래스 주석) `ResolveCollisionZoom()`(raycast pull-in) 패턴을 GO·DUNGEON에 이어 `RealmOrbitCamera.cs`에도 추가 — 성 중심(원점) 고정 오빗이라 자기 CharacterController가 없어 `CameraSkin`은 원점이 건물 안일 때 레이 시작점이 막히는 것만 방지. FOREST는 벽 충돌 없는 고정 카메라라 원래 스코프 밖(그대로).

**102-5는 이제 전부 닫혔다.** 남은 건 실기 확인(Screen Space Shadows·BlobShadow·카메라 pull-in 체감)뿐 — `PROJECT_STATE.md` "실기 확인 대기"로 옮김.

---

# 103. 에셋 창조 파이프라인 (SAGA-DESIGN §7 적용)

## 103-1. 이 트랙이 받는 것
- `tools/asset-forge/`(저장소 루트, 제안 상태) 산출물은 **`Assets/Art/Generated/<game>/`** 로 받는다. 원본 팩·Poly Haven 과 섞지 않는다. 씨앗·팔레트 JSON 은 `Assets/Art/Generated/_seed/` 에 같이 둔다(재생성 가능).
- **결정(2026-09-21, 사용자, 구 105 Q4)**: `Assets/Art/Generated/` 산출물은 **커밋한다**(스크립트+씨앗만 두고 재생성하지 않는다) — Unity 는 .meta 가 GUID 를 물고 있어 재생성 시 GUID 가 바뀌면 씬 참조가 깨지기 때문. 폴더당(게임별) 크기 상한은 **20MB**, 넘으면 다음 세션에서 압축·해상도 하향 검토.
- 이 트랙은 팔레트 스냅(§7.2-1) 대신 **LUT 톤**(102-1-2)이라 `palette.py` 는 정점색 플레이스홀더 메시에만 쓴다. 주력은 `procgen.py`(바위·나무·울타리·돌담·비석, 사실적 방향은 노이즈 변형 + PBR 트라이플레이너)·`kitbash.py`(Poly Haven 텍스처가 입힌 모듈로 건물 변형)·`tilegen.py`(트라이플레이너 3타일 세트, 판별 5)·`sfxgen.py`.
- 변형 배가 대상: 나무(오크 1종 → 바이옴 5×3 형태, **완료 2026-09-21** — procgen 12벌) · 바위(2 → 12, **완료 2026-09-21** — procgen 10벌+기존 2벌) · 건물 모듈(Kenney 4 → PBR 모듈 8 × 배치 조합, **완료 2026-09-21(GO)** — 새 부품 없이 곁채·굴뚝 배치 조합, `LandmarksBuilder.BuildHouseBody()`) · DUNGEON 방 셸(4 → 티어별 마모 3단, **완료 2026-09-22** — 새 지오메트리 없이 재질 톤·거칠기만, `EnvironmentMaterial.MakeTiled(..., wearTier)`·`DungeonRoomBuilder.SetWearTier()`, `DungeonFloorRunner`가 층 깊이로 자동 배정) · REALM 성벽 3단(**완료 2026-09-22** — 새 지오메트리 없이 담장 높이/두께·망루 크기·개수만, `RealmCityBuilder.WallTier()`가 `record.Wall`(축성 명령 실수치, `def.BaseWall`~`×2`)로 자동 배정 — 103-1 변형 배가 전부 완료).

## 103-2. 임포트 프리셋 규칙(`Assets/Settings/Presets/`, 코드로 적용)
| 대상 | Preset | 값 |
|---|---|---|
| 텍스처 albedo/normal/ORM | `Tex_PBR` | 최대 2048(PC·Mobile 같음 — **모바일 해상도 안 낮춤**, 사용자 2026-09-24 "그래픽을 낮추라는 게 아니다", 옛 "Mobile 1024 override" 안 씀), sRGB albedo 만, 노멀 타입 지정 |
| 메시 GLB/FBX 정적 | `Mesh_Static` | Read/Write 끔, 스케일 1.0(§6.0-3 자동 리스케일은 빌더에서), 라이트맵 UV 생성 |
| 캐릭터 FBX | `Mesh_Humanoid` | `MixamoRigUtil` 이 처리(Humanoid·ExtractTextures) |
| 오디오 | `Audio_SFX`/`Audio_BGM` | SFX 압축 ADPCM·BGM Vorbis 0.5·스트리밍 |

## 103-3. 사람이 여는 도구(§7.3) — 이 트랙 조건
- **Mixamo**: 표준. 새 캐릭터는 body FBX(For Unity) + 필요한 클립. 재배포 금지라 `CharactersRealistic/` 로컬 전용, 분리 메시 산출물도 그 안 `Generated/`.
- **결정(2026-09-21, 사용자, 구 105 Q-U4)**: 실제 Mixamo 모델은 **현재 3명(Maria·Abe·Brute) 유지**, 늘리지 않는다. 나머지 인물은 이 3 베이스 + 장비 소켓 변형(101-3 G)으로 간다.
- **Blender**(설치 완료, 2026-09-21, winget `BlenderFoundation.Blender` 5.2.1 LTS, `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`): 헤어 마스크·리토폴로지·헤어카드 분리(⑪이 막힌 지점)·데시메이트를 `blender -b -P` 배치로 세션이 자동화 가능. 다른 PC는 새로 설치해야 한다.
- **VRoid**: 이 트랙에선 쓰지 않는다(102-3).
- **대체 예정(2026-09-24 사용자 확정)**: 상용을 위해 Mixamo 몸·클립은 `tools/char-forge/`(Blender 헤드리스 + CC0 MakeHuman·Quaternius, PBR 레시피)로 바꾼다. 교체 대상 표·순서는 그 README §7·§9 — 위 "3명 유지" 결정은 교체 전까지의 현재 상태다.
- AI 3D(§7.4)로 만든 소품은 Blender 데시메이트 + 102-2 Preset 을 거친 뒤에만 `Generated/` 로.

## 103-4. 44장 교체 결정과의 관계
44장(Player→Enemy→Boss→Environment→Building) 교체는 다섯 판 완료다. 103 은 그 **다음 층** — 종류를 늘리는 것이 아니라 E(발견 밀도) 를 채울 **변형 밀도** 를 만든다. 새 종류 추가는 101-2 후보가 요구할 때만.

---

# 104. 안정화·검증 (SAGA-DESIGN §8 적용, Phase 0)

## 104-1. Phase 0 목록(101 착수 전에 끝낸다)
1. ~~배치 모드 뒤 4파일 원복을 `tools/unity-batch.sh` 한 줄로~~ — **완료**(`tools/unity-batch.sh`, 2026-09-16).
2. ~~**Playtest 원칙 교체**~~ — **완료**(2026-09-16, GO·DUNGEON·FOREST·STORY `CheckSettingsPanel()` 전부 실제 호출 검증으로 교체). 남았던 구멍 `StoryJobChoiceUi`(전직 팝업, 테스트 자체가 없던 것)도 **2026-09-17에 메움**(`PlaytestStorySlice.cs` — Show()로 뜨는지·버튼 클릭(Choose)으로 콜백+닫힘까지 확인).
3. ~~`[SerializeField]` 누락 감사~~ — **완료**(2026-09-16, `UI/`·`World/`·`Player/` 폴더 전부 grep, 버그 없음 확인).
4. 실기 확인 대기(`PROJECT_STATE.md`) 를 사용자가 몰아서 1회 — 결과로 닫히는 항목만 지운다.
5. `Assets/Art/*_candidates` 승격·삭제(102-4, 105장 결정 뒤).
6. 문서 상한: `PROJECT_STATE.md` ≤15KB·PLAN ≤110KB — `tools/precheck.sh` 가 검사한다.

## 104-2. 검증 절차(중복 금지 — 정본은 폴더 `CLAUDE.md`)
배치 컴파일 → 씬 `Build()`(GameObject 구성이 바뀔 때만) → 해당 `Playtest*` 3연속 → 4파일 원복 → `git diff --stat` 확인 → 커밋. GUI 는 사용자 요청 시만. Play 진입 테스트는 `-quit` 없이.

## 104-3. 세이브 스키마
게임별 `XxxSaveState` 버전 필드 유지(GO v5+, FOREST v4, STORY v6 …). 101 후보가 필드를 더할 때 **구버전 로드 단계**를 해당 `Playtest*` 에 반드시 추가(웹 §8-3 과 같은 규칙). 마이그레이션 경로 없이 필드를 잃는 변경(FOREST v3→v4 가구 배치 소실 같은 것)은 이제 하지 않는다.

---

# 105. 열린 질문 (사용자 결정, 답이 나오면 해당 장으로 내리고 여기서 지운다)

(현재 없음 — Q-U3는 SSS 배선 완료로 101·102-3·102-4로 내림. 헤어카드는 분리된 헤어 메시가 아직 없어 질문 자체가 성립하지 않는다, 101 "남은 결정 사항" 참고)

---

# 106. FF·젤다 방향 — DUNGEON 대표 판 (2026-09-23, 사용자 결정)

**지시**: "파이널 판타지 같거나 젤다의 전설 같아야 해" → 점검 보고의 추천 순서를 "순서대로 진행"으로 승인. 66-2(FF16 톤 그래픽)는 그대로 두고, 이 장은 **손맛·구조·연출** 축이다. 수치 시스템(무예·전직·세트류) 추가는 이 장 순서가 끝날 때까지 멈춘다.

**대표 판 = DUNGEON(`TestDungeon`)** — 다섯 판 중 유일하게 3인칭 실시간 근접 전투가 온전히 있다. 여기서 검증한 뒤 GO(필드)·STORY(이야기)로 옮긴다. 웹판 정체성(디아블로)은 층 진행·노획물로 남기고, 전투 감각과 던전 구조만 젤다 쪽으로 옮긴다.

| 순서 | 항목 | 핵심 | 상태 |
|---|---|---|---|
| 1 | 전투 손맛(젤다) | 락온(주목)·적 공격 예고·락온 옆걸음/백스텝·완벽 회피 반격 | 완료(옆걸음 블렌드 포함, 실기 확인 전) |
| 2 | 젤다식 던전 하나 | 작은 열쇠→잠긴 문, 스위치·블록 퍼즐, 던전 도구 1(갈고리 또는 폭탄)→그 도구로 여는 길, 보스 열쇠→보스방 | 코드 완료(106-2, 도구=벽력탄, 실기 확인 전) |
| 3 | 연출(FF) | Cinemachine·Timeline 도입 — 보스 등장 컷·상자 열기·지역 도착 타이틀 | 코드 완료(106-3, 실기 확인 전) |
| 4 | 캐릭터 통일 | NPC·적 Kenney 블록 → Mixamo 사실 모델(이름 정책 유지) | DUNGEON 코드 완료(106-4, 실기 확인 전) |
| 5 | 탐험 | 점프·기어오르기·높은 곳 랜드마크 | 코드 완료(106-5, 실기 확인 전) |
| 6 | FF 확장 | 동료 파티 전투·소환수 대형 연출 | 코드 완료(106-6, 실기 확인 전) — 106장 여섯 순서 전부 코드 완료 |

## 106-1. 락온·예고·반격 (순서 1)

- **락온**(`Player/PlayerLockOn.cs`): Q·"주목" 버튼 토글, Tab 대상 바꾸기. 후보 = 살아 있는 적 12m 안, 점수 = 거리 × (2 − 카메라 정면 내적)(앞에 있는 적 우선). 대상이 죽거나 16m 밖이면 가까운 다음 적으로 자동 전환, 없으면 해제. 표식 = 머리 위 역삼각 + 발밑 고리(`LineRenderer`, 새 셰이더 없음).
- **락온 중 이동**: 달리기 없음(4.5m/s), 몸은 늘 대상을 본다. Maria.controller 에 `LockOn`·`MoveX`·`MoveY` 가 있으면 2D 블렌드(검방 옆걸음 좌·우·뒷걸음, Mixamo), 없으면 걷기 클립 폴백. 클립 반입은 `Editor/BuildMariaLockOnStrafe.cs`(멱등, 클립 없으면 건너뜀).
- **카메라**: 락온 중 yaw 가 플레이어→대상 방향으로 따라가고(초당 6배 보간) 피치 38°, 피벗을 대상 쪽으로 25%(최대 3m) 당겨 둘을 한 화면에. 해제하면 원래 피치로 돌아간다.
- **회피**: 락온 중 입력 방향으로 옆구르기, 입력 없으면 **백스텝**(대상 반대).
- **적 공격 예고**(`DungeonEnemy`): 사거리에 들면 즉시 때리던 것을 **예비동작 → 판정**으로 나눈다. 잡졸 0.5s·두목급 0.7s, 그동안 멈춰 서서 몸이 붉게 차오르고 발밑 경고 고리가 판정 반경(사거리×1.2)까지 커진다. 판정 순간 반경 밖이면 헛손질. 공격 주기(`attackInterval`)는 예비동작 시작부터 세어 **가만히 서 있으면 예전과 같은 초당 피해**(숙련에만 보상).
- **끊기**: 강공격은 두목급이 아닌 적의 예비동작을 끊는다(주기 절반 뒤 다시).
- **완벽 회피 → 반격**: 판정 순간이 회피 무적(0.22s, 웹판 DODGE_INVULN 그대로) 안이면 "완벽 회피" — 무적 창 자체가 좁아 따로 창을 두지 않는다. 1.2s 안의 다음 평타·강공격 한 번이 2배(반격, 평타도 강공격처럼 예비동작을 끊는다). 전역 슬로모는 쓰지 않는다(101-3 hitstop 원칙).
- 진단: `PlaytestDungeonHeadless.CheckLockOn`·`CheckEnemyTelegraph`.

## 106-2. 젤다식 던전 "잊힌 능묘" (순서 2)

**자리**: Room2(0,0,30) 서쪽 문 → 복도(-15,30) → 30m 격자 방 다섯(20×20, 기존 `DungeonRoomBuilder`·`DungeonCorridorBuilder` 재사용, 폐허 바이옴·마모 1단). roomId `temple_*`.

```
            [보스방 (-30,90)]
                  │ 보스 문(보스 열쇠)
[보스 열쇠 방]──금 간 벽──[벽력탄 방 (-30,60)]
 (-60,60)                  │ 잠긴 문(작은 열쇠)
[시련의 방 (-60,30)]────[입구 홀 (-30,30)]──── Room2
```

| 방 | 핵심 | 풀이 |
|---|---|---|
| 입구 홀 | 첫 발에 제목 토스트("잊힌 능묘"), 북쪽 잠긴 문 | 열쇠가 없다는 걸 먼저 보여 준다 |
| 시련의 방 | 잡졸 셋 | 다 쓰러뜨리면 상자가 나타난다 → **작은 열쇠** |
| 벽력탄 방 | 밀 수 있는 돌 블록 + 발판 | 블록을 2m 칸 단위로 밀어 발판에 올리면 상자 → **벽력탄**(던전 도구). 방을 벗어나면 블록 원위치(막힘 방지) |
| 보스 열쇠 방 | 서쪽 복도의 **금 간 벽**, 잡졸 둘 | 벽력탄으로 벽을 부순다 → 큰 상자 → **보스 열쇠** |
| 보스방 | "능묘지기"(두목 모델 1.5배) | 갑주 — 칼은 15%만 들어간다. **벽력탄에 맞으면 갑주가 벗겨져 4초 기절, 그동안 150%** |

- **벽력탄**(`PlayerBombs`·`TempleBomb`): R·"벽력탄" 버튼. 앞 1m 에 놓고 2초 뒤 반경 3m 폭발 — 적 피해(평타×3, 예비동작 끊기)·금 간 벽 파괴·능묘지기 갑주 벗기기·**자기도 휘말리면 피해 4**. 한 번에 하나.
- **상자**: 가까이 가면 열린다(DUNGEON 은 상호작용 키 없이 근접 판정이 관례). 뚜껑이 열리고 얻은 것이 머리 위로 떠오르며 팡파르(연출 본판은 순서 3).
- **저장**: `TempleState`(작은 열쇠 수 + 진행 플래그 9비트) → 세이브 v9 `templeKeys`·`templeFlags`. 문·벽·상자·블록·능묘지기는 `TempleState.Changed` 로 상태를 다시 입는다(열린 문은 계속 열려 있다). 쓰러뜨린 잡졸은 기존처럼 다시 선다.
- **HUD**: 능묘에 한 번 들어간 뒤부터 "🗝 열쇠 n · 보스 열쇠 · 벽력탄" 줄.
- 진단: `PlaytestDungeonHeadless.CheckTemple` — 열쇠 없는 문 막힘 → 시련 클리어 전 상자 숨김 → 열쇠 → 문 → 블록 벽 막힘/발판 → 벽력탄 → 금 간 벽 → 보스 열쇠 → 보스 문 → 갑주 15%/기절 150% → 정복 플래그.

## 106-3. 연출 — Cinemachine·Timeline (순서 3)

**패키지**: Cinemachine 3.1.7(+splines 2.9·settings-manager, 매니페스트에 이것만 더함). Timeline 1.8.13 은 원래 있었다. 101-3 G·102-5 에서 "Cinemachine 안 받음, 수동 코루틴"으로 미뤘던 것을 여기서 받는다 — 레벨업 줌 펀치·흔들림·벽 pull-in 은 `CameraRig` 그대로.

**카메라 구조(하이브리드)**: `CameraRig` 는 실제 카메라 대신 플레이 가상 카메라 `PlayerView`(CinemachineCamera, 우선순위 10, 부품 없음 = 자기 트랜스폼 그대로)를 움직인다. 실제 카메라 `PlayerCamera` 에 `CinemachineBrain`. 컷 카메라는 우선순위 0 이라 Timeline `CinemachineTrack` 이 넘겨받을 때만 산다. 첫 샷 이즈 인·끝 샷 이즈 아웃이 플레이 카메라와의 블렌드. `view` 가 비면 예전처럼 자식 카메라를 직접 움직인다(Cinemachine 없는 씬).

| 컷 | 트리거 | 길이 | 샷 | 제목 카드 |
|---|---|---|---|---|
| 능묘 도착 | 입구 홀 첫 발(`Visited`) | 4.5s | 남동쪽 위(7m)에서 내려오며 북쪽 잠긴 문 쪽으로(이즈 0.9/0.9) | 가운데 "잊힌 능묘 / 이름 잃은 왕이 잠든 곳" 0.7~3.9s. 목표 토스트는 컷 뒤 |
| 상자 열기 | `TempleChest.Open()` 셋 다 | 2.6s | 상자 옆 2.4m·위 1.6m, 벽에 덜 막힌 쪽을 고르고 막히면 당긴다, 아이템 쪽으로 다가감(이즈 0.45/0.55). 플레이어는 상자를 본다 | 없음(획득 토스트 그대로) |
| 능묘지기 등장 | 보스 문 열린 뒤 보스방 중심 8m, 한 번(`BossIntroSeen` 1<<9, 세이브 v9 `templeFlags` 그대로) | 5.2s | 넓은 샷 2.0s(문 앞 높은 데서 밀고 들어감) → 맞붙여 자른 발치 올려다보기 3.2s(손떨림 Handheld_normal_mild) | 왼쪽 아래 "잊힌 능묘의 갑주 파수 — 칼날을 튕긴다 / 능묘지기" 2.3~5.0s. 2.0s 에 포효(공격 클립, 판정 없음) |

- **멈춤**: `Time.timeScale` 은 안 건드리고 `DungeonCutscenes.Playing` 을 본다 — 플레이어 이동·공격 셋·회피·벽력탄·락온, 적 AI(`Tick` 조기 반환, 예비동작도 그 자리에). hitstop 이 전역 시간을 안 건드리는 원칙(101-3)과 같은 결.
- **화면**: 레터박스(위아래 11%, 0.2s), 컷 동안 HUD 캔버스 전부 끔(토스트 `DialogueUI` 만 남기고 레터박스 위에 뜬다), "건너뛰기 ▶ 아무 키 · 탭".
- **넘기기**: 아무 키·클릭·탭(첫 0.35s 무시). 넘기면 이즈 없이 곧바로 플레이 카메라로 자른다. 컷이 돌 때 새 컷이 오면 앞 컷을 끝낸다.
- **Timeline 애셋**: `Assets/Games/SagaDungeon/Cinematics/Timelines/Temple_*.playable` — `BuildDungeonCinematics`(씬 빌더가 플레이어·HUD 뒤에 부름)가 만든다. 있으면 트랙만 비우고 다시 채워 GUID 를 지킨다. 사용자 트랙 둘: `CutsceneDollyTrack`(가상 카메라 직선 달리, 스플라인 대신) · `CutsceneTitleTrack`(제목 카드 앞뒤 0.45s 페이드, 번역 키 `cut.*`).
- 진단: `CheckTemple` 에 컷 검사(도착 컷·HUD 0·적 멈춤·2s 지역명 카드·넘기면 HUD 복귀 → 상자 카메라 자리 → 컷 중 벽력탄 막힘 → 보스방 밖 안 틂/첫 발 틂·3s 이름표·다시 안 틂 → 능묘 한 바퀴 컷 5회) + `StartCutCameraProbe`(3프레임째 등장 컷 3s) → `CheckCutCameraLive`(6프레임째 브레인 활성=`CutCam_BossClose`·실제 카메라 위치·포효 신호) → `CheckCutCameraBack`(8프레임째 `PlayerView` 복귀). `CinemachineBrain.ManualUpdate()` 는 ManualUpdate 모드가 아니면 오류를 남기므로 프레임을 넘겨 본다.
- 옮긴 곳: DUNGEON 층 두목·월드 보스 106-7, STORY 두목 106-8, GO 망루 수호장 106-9 — 같은 결을 판마다 복사(판 사이 코드 공유 없음 원칙).

## 106-4. 캐릭터 통일 — DUNGEON (순서 4)

적(잡졸 Abe·두목 Brute)은 44장에서 이미 사실 모델이었다. 남은 Kenney 블록·캡슐 자리를 Mixamo 로 바꿨다.

| 자리 | 전 | 후(Mixamo 캐릭터) | 동작 |
|---|---|---|---|
| 동행 무사(`AllyFighter`) | character-b 청색 칠, 애니 없음 | Paladin W/Prop(검방) | 서기·걷기(2.6m/s, 가까울 때)·달리기(6m/s, 멀 때)·공격 트리거, 컷 동안 멈춤 |
| 마을 사람(Town2~4) | character-b | Peasant Man / Girl 번갈아 | 대기(시작 위상 흩음, `NpcIdle`) |
| 포로(구출방, 층 진행 포로 포함) | 캡슐 | Peasant Girl | 무릎 꿇은 대기 → 풀려나면 플레이어를 보고 기쁜 대기 |
| 행상(씬 5 + 층 진행) | 초록 상자뿐 | 좌판 + 뒤에 Peasant Man | 대기 |
| 능묘 파수꾼 6 | Abe 회청색 | Skeletonzombie(해골, 옅은 칠) | Abe 와 같은 5상태 |

- **받기**: `tools/mixamo_automation` 에 `--character`(현재 캐릭터 바꾸기)·`--tpose`(몸체)·`--inplace`(걷기·달리기 제자리) 추가. 레시피는 그 README 표. 원본은 gitignore(`CharactersRealistic/`) — **PC 마다 받고 `Saga/Setup NPC Character Imports` 한 번**.
- **굽기**: `SetupNpcCharacterImports`(표 하나로 넷, Abe 스크립트를 더 복사하지 않음) → `Assets/Animators/<이름>.controller`(커밋) + `<이름>Animated.prefab`(로컬). 규칙은 Abe 와 같은 `Speed`·`Attack/Hit/Death`, 추가 대기(`Kneel`)는 상태 이름으로 튼다. 프리팹이 없으면 씬 빌더가 예전 모델로 폴백.
- 런타임 포로·행상은 `DungeonEnemy.SetSpawnContext` 와 같은 결(비활성 → `SetModel` → 활성).
- 진단: `CheckNpcModels`(동행·마을 사람 3·포로 Kneel·행상 5·해골 6 이 Humanoid). 이 PC 에 프리팹이 없으면 건너뛴다.
- **GO·STORY·FOREST NPC 완료(2026-09-24, 판별 복사)**: 판마다 `NpcIdle` 복사본(`SpawnRigged` 가 그 판 사람 키로 맞추고 발을 뿌리에). GO 촌장 Peasant Man·떠돌이 상인 Peasant Girl·나그네 궁수(키 3.4, 마을 가운데·북쪽 문을 봄) · FOREST 숲지기 Peasant Man(1.8m, 셰이더가 안 휘어 짐승처럼 땅 휨만큼 내림) · STORY 척후병 Peasant Man·전직관 Jolleen(1.75m, 카메라 쪽 — STORY 동료 셋 몸과 안 겹치게). 프리팹이 없는 PC 는 예전 Kenney. 진단 `PlaytestNpcModels`(세 판 헤드리스).
- **능묘지기 전용 몸 완료(2026-09-24)**: Ganfaul M Aure(검은 갑주 망령), 옛 몸과 같은 키 3.5m(`BuildDungeonTemple.GuardianHeight`, 프리팹 키를 재서 배율), 제 빛깔(옛 검푸른 칠 뺌). 없는 PC 는 Brute 1.5배.
- **두목 전용 몸 둘째 묶음(2026-09-24)**: 황건 살수(방3 고정 + 층 미니보스) = Ninja · 층 주인(108 ③ 여섯) = Demon T Wiezzorek(명소 빛 35% — 한 몸을 빛으로 가름) · 5.7 기계화 정찰병 = Alien Soldier · STORY 황건 두목(들판·비경) = Morak. 키는 옛 몸과 같게(씬 빌더가 프리팹 키를 재서 `*ScaleMul`·`riggedBossVisualScale`), 제 빛깔. 층 끝 두목·황건적 두목은 원래 배역 Brute 그대로, 여느 정예는 잡졸 Abe 칠. 없는 PC 는 예전 몸. 진단 `PlaytestNpcModels`(DUNGEON 칸 셋·배율·방3 살수 키, STORY 두 곳 Morak·2.24m).
- 남은 것: REALM(인물이 화면에 서지 않는 경영형이라 해당 자리 없음).

---

## 106-5. 탐험 — 점프·기어오르기·높은 곳 랜드마크 (순서 5)

- **이동**(`Saga.Dungeon.Player.PlayerController`): GO 107 ② 를 던전 키(사람 1.8m = GO 3.4m 의 0.53배)로 줄여 옮겼다 — 상태 넷(땅·공중·등반·넘어오르기). **점프 = F·"점프" 버튼**(Space 는 평타라 안 씀), 1.3m(측정 1.37m). **등반은 `DungeonClimbable` 이 붙은 면만**(담쟁이 벽 — 방·복도 벽은 못 오른다, GO 는 반대로 `NoClimb` 만 뺀다), 1.7m/s·옆 1.4m/s, 스태미나 없음(던전엔 없다), 등반 중 F = 손 놓기, 가슴 높이에 벽이 없어지면 넘어오르기 0.4s. 내리막 붙이기(0.4m). 등반·넘어오르기 중엔 공격·강공격·회전베기·회피·벽력탄이 막힌다. 활공·수영은 안 옮겼다(절벽·물이 없다). Animator 는 Maria.controller 의 `Climb`·`Jump`·`ClimbRate` 를 그대로 쓴다.
- **옛 감시탑 뜰**(`BuildDungeonWatchCourt`, 새 방 (30,0,30)): Room2 **동쪽 문** → 복도(15,30) → 방(폐허·마모 1단). 처음 들어서면 안내(`WatchCourtHint`). **옛 감시탑** 8m(3.6m 네모, 담쟁이 네 면 = 기어오름, 꼭대기 화톳불이 방 벽 너머로 보이는 랜드마크, 꼭대기 모서리 상자 = 금 80·경험치 60) · **계단식 돌 셋**(폭 2.8m, 윗면 0.9·1.8·2.7m — 점프 없인 한 칸도 못 오름) → **2m 틈**(1.2m 는 캡슐이 양 모서리에 걸쳐 걸어서 건넜다) → 선반 상자(금 40·경험치 25). 탑에서 달려 뛰면 방 벽(4m)을 넘을 수 있어 이 방 벽 위에만 보이지 않는 막이(4~14m, "Ignore Raycast" 층 — `CameraRig` 벽 당김 광선은 이 층을 뺀다).
- **상자**: `TempleChest` 에 내용물 `Treasure`(돈·경험치)와 높이 차 1.5m 판정(탑 밑에서 꼭대기 상자를 못 열게) — 진행 비트 `WatchTowerChest`·`WatchLedgeChest`(10·11번, 세이브 v9 `templeFlags` 정수 그대로라 스키마 안 바뀜).
- 진단: `PlaytestDungeonExplore`(`PlaytestDungeonHeadless` 가 능묘 진단 앞에서 부름) — Room2 동쪽 문으로 뜰까지 걷기 · 안내 한 번 · 점프 높이 · 방 벽·첫 돌은 밀어도 안 붙음 · 셋째 돌에서 점프 없이 틈을 못 건넘 · 턱/꺼짐 앞에서 뛰며 선반까지(점프 3번 이상) → 상자 · 탑 밑에선 안 열림 · 탑 남쪽 면에 붙어 회피 막힘 → 넘어오름 → 꼭대기 상자 · 등반 중 F 로 손 놓기 · 탑에서 동쪽으로 뛰어도 벽을 못 넘음. 상자 컷은 넘기고, 자리·진행 비트·돈/경험치는 되돌린다.

## 106-6. FF 확장 — 동료 파티 전투·소환수 (순서 6)

FF 최신작 전투의 "동료는 스스로 싸우고, 특기는 게이지를 써서 시킨다 · 게이지가 차면 소환수가 판을 뒤집는다"만 옮긴다. 이름은 전부 가상(원작 동료·소환수 이름 없음), 세이브 스키마 안 바뀜(게이지는 한 판의 흐름이라 저장 안 함 — FF 도 ATB 는 저장 안 한다).

| 인물 | 자리 | 평소 | 명령(게이지 한 칸) |
|---|---|---|---|
| 동행 무사(`AllyFighter`, Paladin) | 앞줄 | 8m 안 적을 쫓아 평타(0.55s, 4) | **1·"도발" — 방패 도발**: 12m 안 적이 8초 동안 무사만 쫓고 때린다, 받는 피해 40% |
| 동행 술사(`AllyMystic`, Peasant Girl + Maria.controller 리타깃) | 뒷줄 | 10m 안 적에게 1.6s 마다 빛살(14m/s 로 쫓아가 맞힘, 4), 3.5m 안으로 붙으면 물러섬 | **2·"치유" — 치유의 빛**: 플레이어 체력 40%, 무사를 60% 로 일으킨다 |

- **스탯**: 웹판 `partyPower()` 공식 그대로 — 무사 might 24·wisdom 12·command 18(atk 20.4, 체력 `max(30, def×3)` = 40), 술사 might 10·wisdom 30(atk 16). 한 타 `max(4, atk/6)` = 둘 다 4.
- **적 표적**: 플레이어, 또는 도발을 건 무사. 술사는 노리지 않는다(그래서 체력이 없다). 적 AI 는 표적 하나만 바꿔 쓴다(`DungeonEnemy.Target`) — 예비동작·판정 규칙(106-1)은 그대로.
- **무사 쓰러짐**: 체력 0 → 누운 자세(Paladin 에 쓰러짐 클립 없음, 몸을 눕히는 절차적 폴백), 도발 풀림, 12초 뒤 30% 로 일어남. 곁 12m 에 적이 없으면 4초 뒤 체력이 다 찬다.
- **명령 게이지(ATB)**: 맞힌 **횟수**로 찬다(레벨·장비와 무관하게 박자가 같게) — 플레이어 평타 +12(둘 다) · 강공격·반격 +18 · 회전베기는 몇을 베도 +12 한 번 · 완벽 회피 +25 · 동료 제 평타 +5(자기만). 100 = 한 칸.
- **소환 게이지**: 플레이어 한 타 +3 · 동료 한 타 +1 · 명령 한 번 +12 · 완벽 회피 +6. 100 이면 V·"소환"(평타만이면 약 34번 — 한두 무리).
- **소환 "바위 거신"**(`PartySummon`): 두목 모델(Brute) 3.2배·돌빛, 발밑 금빛 진·점광. 플레이어와 가장 가까운 적 사이 4m(벽이 가까우면 벽 앞)에 솟아(0~1.4s) **3.2s 에 땅을 내리친다 — 14m 안 적 전부 플레이어 한 타 × 15**(강공격 판정, 예비동작 끊기), 충격 고리가 14m 까지 퍼진다. 4.2s 부터 가라앉아 5.0s 에 사라진다. 14m 안에 적이 없으면 안 부른다(게이지 안 씀).
- **소환 컷**(`Party_Summon.playable`, 5.0s): 넓은 샷 2.6s(플레이어 등 뒤 낮은 데서 솟는 거신을 올려다보며 고개를 듦, 이즈 인 0.6) → 맞붙여 자른 옆 낮은 샷 2.4s(내리치기를 따라 내려봄, 손떨림 1.4, 이즈 아웃 0.7). 카메라 두 자리는 부르는 순간 거신·플레이어에 맞춰 다시 잡고 벽이 막으면 당긴다(상자 컷과 같은 결). 제목 카드(왼쪽 아래) "소환 — 잠든 산이 깨어난다 / 바위 거신" 0.5~2.4s. 레터박스·HUD 끔·적 멈춤·아무 키로 넘김은 106-3 그대로 — **넘기면 아직 안 내리쳤어도 그 자리에서 내리친다**(피해는 한 번만). 시간은 거신이 스스로 세고 컷은 카메라·제목만 맡는다.
- **HUD**(`PartyHud`, 왼쪽 위 체력 막대 아래): 무사 = 이름·체력·게이지·[1](쓰러지면 "쓰러짐") / 술사 = 이름·게이지·[2] / 소환 게이지·[V]. 차면 금빛 + "준비". 모바일 버튼 셋(도발·치유·소환, 회피·주목 줄 왼쪽 한 줄)은 준비되면 진해지고 아니면 흐려진다.
- 막힘: 컷 중·등반 중 명령·소환 안 먹음. 게이지가 덜 차면 토스트로 까닭.
- 진단: `PlaytestDungeonParty`(`PlaytestDungeonHeadless` 가 탐험 진단 앞에서 부름) — 진짜 평타 → 게이지 · 덜 찬 명령 막힘 · 도발(적이 무사를 쫓아 때림·플레이어 무피해·40%) · 쓰러짐(도발 풀림·명령 막힘·HUD) · 치유(+40%·일으킴) · 12초 기상 30% · 빛살(쏨·맞힘·게이지·간격) · 물러섬 · 소환(덜 참/곁에 적 없음 막힘 · 컷·HUD 꺼짐 · 3.2s 전 안 침 · 14m 안만 × 15 · 넘겨도 한 번 · 초반에 넘기면 즉시).
- **전용 클립(2026-09-24)**: 무사 = 도발 `Taunt`(방패 치켜듦 0.57s)·도발 중 피격 `Blocked`(방패 자세로 받음)·피격 `Hit`·쓰러짐 `Death`(2.3s 뒤로 눕고 머묾 — 일어나면 대기로 곧장, 절차적 눕히기는 클립 없는 PC 폴백), 술사 = 제 컨트롤러로 걷기·달리기·빛살 시전 `Attack`(한 손 앞으로)·치유 시전 `Heal`(되살림 주문 4.2s) — Maria.controller 리타깃은 클립 없는 PC 폴백. Mixamo 레시피는 `tools/mixamo_automation` README 표(같은 설명 카드 둘 중 선 판은 `--nth`), `SetupNpcCharacterImports` 의 `ExtraTriggers`. 진단은 `PlaytestDungeonParty` 가 트리거·상태(쓰러짐 들어감/일어나면 나옴·술사가 Maria 를 안 씀)까지 본다.
- **소환수 모델(2026-09-24)**: 두목(Brute) 뼈대에 CC0 바위(Kenney rock_largeA/smallA) 14 덩이를 마디마다 붙이고(몸통·팔 둘×2·다리 둘×2·머리·주먹 둘·발 둘) 두목 살갗은 숨긴다 — 두목 클립 그대로 솟고 내리친다. 가슴·두 주먹에 금빛 발광 조각 셋. 돌은 PolyHaven rock_boulder_dry 사진 재질(`rock_boulder_dry_URPLit.mat`, 비금속). 사람 뼈대가 아니거나 바위가 없으면 예전 돌빛 틴트.
- 남은 것: 동료 교대·장비·성장, GO·STORY 로 옮기기(판별 복사). 새 글자 `party.*`·`action.taunt/heal/summon`·`cut.summon_*` 는 ko/en 표에 넣었다(2026-09-24, en 은 세션 번역 — 사람 검수 전).

## 106-7. 층 두목·살수 등장 컷 (106-3 후속)

106-3 컷은 능묘지기 한 마리 전용(보스방 고정 카메라)이었다. 절차 층의 두목·살수와 첫 방의 고정 두목에도 FF 식 등장 컷을 준다 — **컷 하나(`Boss_FieldIntro.playable`, 3.8s)를 여러 두목이 같이 쓴다**.

- **언제**: 두목급(`isBoss`)이 처음 달려들 때(Idle→Chase). 층 두목(월드 보스)은 만날 때마다, 살수 같은 나머지 두목급은 세션에 이름마다 한 번. 능묘지기(갑주)는 제 컷(106-3)이 있어 뺀다. 다른 컷이 돌고 있으면 안 튼다.
- **샷**: 플레이어 어깨 너머 넓은 샷 1.6s(이즈 인 0.6, 두목 가슴을 본다) → 맞붙여 자른 두목 발치 올려다보기 2.2s(두목 키 기준 거리, 손떨림 0.9, 이즈 아웃 0.7). 두 자리 다 두목이 달려드는 순간 두목·플레이어에 맞춰 다시 잡고 벽이 막으면 당기며, 옆은 덜 막힌 쪽을 고른다(상자·소환 컷과 같은 결). 1.6s(컷 순간)에 포효.
- **이름표**: 왼쪽 아래 보스 이름표 1.9~3.6s. 글자는 `CutsceneTitleCard.SetOverride` 로 그 두목 이름(번역 표시명)으로 덮어쓰고 컷이 끝나면 지운다. 부제 — 층 두목 "층 끝의 우두머리 — 75초 안에 쓰러뜨려라" · 살수 "층을 지키는 살수 — 홀로 서서 기다린다".
- **두목전 타이머**(101-2 5.4, 75초): 컷 동안은 적 `Tick` 이 일찍 돌아가 줄지 않는다. "⏱ 두목전 시작" 토스트는 컷이 끝난 뒤(넘겨도) 뜬다.
- 진단: `PlaytestDungeonBossIntro`(파티 진단 앞) — 컷·타이머 멈춤·이름표·포효·가까운 샷 거리/높이·넘긴 뒤 시간 흐름·다음 층 두목 또 틂·같은 살수 두 번째 안 틂·능묘지기/잡졸 안 틂.

## 106-8. STORY 두목 등장 컷 (106 결 옮기기 첫째 — 판별 복사)

106 은 "DUNGEON 에서 검증한 뒤 GO·STORY 로 옮긴다". 첫 이식은 STORY(`TestField`) 들판 두목(관문 대장) 등장 컷 — 코드는 DUNGEON 것을 쓰지 않고 `Saga.Story.Cinematics` 로 복사했다(0장 원칙).

- **카메라 하이브리드**(106-3 과 같은 구조): `StoryCameraFollow` 는 실제 카메라 대신 플레이 가상 카메라 `StoryPlayerView`(CinemachineCamera, 우선순위 10)에 붙어 그걸 움직인다(위치 계산·흔들림·레벨업 줌은 그대로). 실제 카메라 `StoryCamera` 에 `CinemachineBrain`(기본 블렌드 EaseInOut 0.6).
- **언제**: 두목이 살아 있고 플레이어가 X 로 9m 안에 처음 들어올 때, 씬 로드마다 한 번. 비경(아레나) 두목은 뺀다.
- **샷**(`Story_BossIntro.playable`, 4.2s): 옆에서 보던 2.5D 화면이 잠깐 3/4 각도로 돈다 — 플레이어 어깨 너머(화면 앞쪽 -Z, 두목 반대쪽 옆) 넓은 샷 1.8s(이즈 인 0.6) → 맞붙여 자른 두목 발치 앞쪽에서 올려다보기 2.4s(두목 키 기준 거리, 손떨림 0.9, 이즈 아웃 0.7). 자리는 다가서는 순간 다시 잡고 막히면 당긴다. 1.8s(컷 순간)에 포효(공격 클립·타격음, 이 판 두목은 반격이 없어 판정 없음).
- **이름표**: 제목 트랙 없이 `StoryCutscenes` 가 컷 시각으로 직접 페이드(2.1~3.9s, 앞뒤 0.45s) — 이 판은 컷이 하나라 트랙을 옮기지 않았다. "황건 두목" / 부제 관문 대장이면 "관문 대장 — 이번 주 강화판, 180초 안에 쓰러뜨려라", 아니면 "들판 가장 안쪽을 지키는 우두머리".
- **멈춤**: 플레이어 `Update` 가 통째로 일찍 돌아간다(입력·이동·쿨다운), 관문 대장 180초는 안 준다. 레터박스·HUD 끔(토스트만)·아무 키로 넘김은 DUNGEON 과 같다.
- 진단: `PlaytestStoryBossIntro`(`PlaytestStorySlice` Init 단계, 두목 곁에 가기 전) — 브레인·플레이 가상 카메라 · 20m 밖 안 틂 · 6m 틂 · 플레이어/관문 대장 시간 멈춤 · HUD 꺼짐/복귀 · 이름표 글자·넓은 샷 땐 안 뜸·가까운 샷 땐 뜸 · 포효 시각 · 가까운 샷 거리/앞쪽/높이 · 한 번만. 여기서 한 번 틀어 두므로 뒤 단계(KillBoss 의 두목 곁 순간이동)는 안 막힌다.
- 남은 것: STORY 파티는 106-10(사용자 결정 "교대 셋을 곁에 세우기"), 소환은 그 다음 단계. GO 는 106-9.

## 106-9. GO 두목 등장 컷 — 망루 수호장 (106 결 옮기기 둘째)

GO 엔 두목급 들판 적이 없었다(옛 사건 결투 셋은 선택 화면 방식이고 흰 늑대는 캡슐 몸) — 먼저 107-7 "망루 수호장"을 세우고 그 첫 만남에 컷을 준다.

- **카메라 하이브리드**(106-3·106-8 과 같은 구조): `CameraRig` 는 `view`(플레이 가상 카메라 `PlayerView`, 우선순위 10)가 있으면 실제 카메라 대신 그걸 민다(줌·벽 당김·레벨업 줌 그대로). 실제 카메라 `PlayerCamera` 에 `CinemachineBrain`(EaseInOut 0.6). `SagaGo.asmdef` 에 Cinemachine·Timeline 참조.
- **판별 복사**: `Saga.Go.Cinematics` — `GoCutDolly`·`GoCutDollyClip`·`GoCutDollyTrack`·`GoCutscenes`(STORY 관리자 결, 이름표는 컷 시각으로 직접 페이드). `Editor/BuildGoCinematics`, 애셋 `Go_GuardianIntro.playable`.
- **언제**: 수호장이 처음 달려들 때(발견 18m 또는 먼저 맞았을 때 — `FieldEnemy.GuardianEngaged`), 씬 로드마다 한 번. 쓰러뜨린 뒤엔 수호장이 없다.
- **샷**(4.2s, STORY 와 같은 박자): 플레이어 어깨 너머 넓은 샷 1.8s(GO 사람 키 3.4m 배율 — 뒤 6→3.9m·위 4.3→3.6m) → 맞붙여 자른 수호장 발치 올려다보기 2.4s(수호장 키 기준, 옆은 덜 막힌 쪽, 손떨림 0.9). 1.8s 에 포효(공격 클립 + 원소 빛 고리). 이름표 "망루 수호장" / "옛 망루를 지키는 돌장수 — 방패 두 겹(뇌 → 화)".
- **멈춤**: 들판 적 `Tick`·들판 전투 입력(`FieldCombat.Update`)·플레이어 이동(`PlayerController.Update`, 진단이 부르는 `Step` 은 그대로) 이 `GoCutscenes.Playing` 을 본다. 레터박스·HUD 끔·아무 키로 넘김.
- 진단: `PlaytestGoGuardian`(들판 전투 진단 앞) 안에서 — 브레인·`CameraRig.view` · 22m 안 틂 · 12m 틂 · 수호장 멈춤 · HUD · 이름표·넓은 샷엔 안 뜸 · 포효 시각 · 가까운 샷 거리/높이 · 넘김 · 두 번째 만남 안 틂. 여기서 한 번 틀어 두므로(`Engaged`) 뒤 진단이 수호장 곁을 지나도 컷이 안 돈다.

## 106-10. STORY 파티 — 교대 셋을 곁에 세우기 (106 결 옮기기 셋째, 2026-09-24 사용자 결정)

사용자가 세 안(소환만 · **교대 셋을 곁에 세우기** · STORY 건너뛰기) 중 둘째를 골랐다. 5-8 교대의 세 역할이 실제 몸으로 서서, **앞에 나선 역할은 플레이어와 한 몸(숨김), 쉬는 둘이 곁에서 스스로 싸운다** — 교대는 "누가 앞에 서나". 5-8 의 공격 배율·서명 1발은 그대로.

| 역할 | 몸 | 곁에서 하는 일 |
|---|---|---|
| 선봉 | Paladin(검·방패) | 1.5m 까지 달려가 1.1s 마다 근접 한 타(× 0.35) |
| 유격 | Archer(Mixamo Erika Archer With Bow/Arrow) | 8.5m 안 적에게 1.6s 마다 화살(기탄의 관통 없는 판, × 0.3), 2.5m 안으로 붙으면 물러섬 |
| 호법 | Peasant Girl | 6m 안 적에게 2.2s 마다 빛(× 0.22) · 적이 곁에 있으면 8s 마다 기력 최대치 12% 채움(치유 시전 클립) |

- **한 타**: 플레이어 기초 공격력(시작값 + 전직 + 기억 조각, × 비경 축복) × 배율 — 기합·교대 배율은 안 곱한다. 둘 합쳐 플레이어 평타의 약 1/5 을 더하는 정도(판수 체감이 크게 안 바뀌게).
- **체력 없음**: 이 판 적은 반격이 없고 플레이어도 안 맞는다(5-8 과 같은 이유) — 동료도 안 맞고 안 쓰러진다.
- **자리·이동**: 뒤쪽 줄 z = +0.9(발판 깊이 4m 안), 플레이어 등 뒤 1.1m·2.1m. 발밑을 아래로 쏴 땅을 찾고 떨어지면 중력. 플레이어와 발 높이가 0.8m 넘게 다르고 7m 안이면 0.5s 포물선으로 곁에 뛰어오른다. 14m 넘게 벌어지면(비경 아레나 순간이동 등) 불꽃과 함께 곁으로 옮긴다. 표적은 같은 높이(±1.5m)·플레이어 10m 안 적만. 충돌체 없음(플레이어를 안 막는다).
- **교대 연출**: 활성 역할이 바뀌면(교대·세이브 복원 모두) 들어가는 쪽은 불꽃과 함께 사라지고 나오는 쪽은 플레이어 곁에서 튀어나온다(`StoryCompanionSquad` 가 매 프레임 비교). 컷 동안 멈춤.
- **HUD**: 교대 줄에 "· 곁: 유격·호법". 세이브 스키마 안 바뀜.
- **몸 없는 PC**: `CharactersRealistic/` 는 gitignore — 몸 프리팹이 없으면 빛깔 캡슐로 선다(동작은 같다). 궁수는 README 레시피로 받으면 씬 빌더가 알아서 굽는다.
- 진단: `PlaytestStoryCompanions`(`PlaytestStorySlice` Init, 두목 컷 진단 뒤) — 맵 밖 임시 바닥·발판에서 `Step(dt)` 을 직접 굴린다: 몸 셋·애니메이터·충돌체 없음 · 활성 숨김 · 멀면 옮김 · 걸어서 따라옴 · 떨어짐 · 발판 위로 뛰어오름 · 선봉 타격 · 유격 화살(관통 없음) · 호법 기력 +12% · 진짜 교대 · 복원. 끝나면 동료를 멈춰(`PausedForTest`) 뒤 단계(잡졸 수·한 방 피해 전제)를 안 흔든다.
- **둘째 단계 — 소환 "우레뿔 거수"(2026-09-24)**: DUNGEON 106-6 소환의 판별 복사(`StorySummonState`·`StorySummon`·`StorySummoner`).
  - 게이지: 적을 맞힐 때마다 플레이어 +3 · 곁의 동료 +1 · 소환 내려찍기 0(`StoryEnemy.TakeDamage` 한 곳에서 센다). 100 이면 V·"소환"(교대 줄 왼쪽 끝 버튼). 잡졸이 한 방에 죽는 판이라 평타만이면 약 34 번 — 들판 한 바퀴쯤. 세이브 안 함.
  - 막힘: 덜 참 · 소환수 자리에서 좌우 14m 안 적 없음(게이지 안 씀) · 줄에 매달림 · 컷 중 — 토스트로 까닭.
  - 몸: Mixamo Warrok(뿔 거구, 이 판 두목 Brute 와 안 겹침) 6.5m + 먹구름빛 틴트 + `Mutant Jump Attack`(Attack). 플레이어가 보는 쪽 4m 앞, 뒤쪽 줄 z = 1.5.
  - 흐름(5.0s): 발판이 허공에 뜬 판이라 땅에서 솟지 않고 **먹구름에서 번개와 함께 내려선다**(0~1.2s, 착지 불꽃·흔들림) → 2.0s 뛰어올라 → 3.2s 내려찍기: 좌우 14m·위아래 6m 안 적 전부 플레이어 한 타 × 8(시작 공격력·선봉이면 193 — 두목 216 의 약 9할), 맞은 적마다 하늘에서 번개 한 줄 → 4.2s 부터 줄어 5.0s 에 사라진다.
  - 컷(`Story_Summon.playable`, 5.0s): 넓은 샷 2.6s(플레이어 등 뒤 화면 앞 낮은 데서 내려서는 거수를 올려다봄, 이즈 인 0.6) → 맞붙여 자른 거수 옆 앞쪽 낮은 샷 2.4s(내려찍기를 따라 내려봄, 손떨림 1.4, 이즈 아웃 0.7). 이름표 "우레뿔 거수 / 소환 — 먹구름이 뿔에 내려앉는다" 0.5~2.4s. 넘기면 아직 안 찍었어도 그 자리에서 한 번 찍는다. `StoryCutscenes` 는 컷 둘(두목 등장·소환)을 같은 레터박스·이름표로 튼다.
  - 진단: `PlaytestStorySummon`(슬라이스 Init, 동료 진단 뒤) — 맵 밖 임시 바닥: 게이지 +3/+1/0 · 덜 참·적 없음 거절 · 부르면 게이지 0·자리·컷·HUD 꺼짐·이름표·Warrok 모델 · 가까운 샷 화면 앞 낮은 데 · 3.2s 전 안 침 · 14m 안 둘만 × 8 · 넘기면 HUD 복귀·한 번만 · 초반에 넘기면 즉시.
- 남은 것: 동료 전용 클립(선봉 방패 막기 등은 이 판엔 맞는 일이 없어 보류) · 소환 소리(이 판 소리 표에 맞는 큰 타격음이 없다).

# 107. GO 원신 기준 — 전투 시스템·지도 형태 (2026-09-24, 사용자 결정)

**지시**: "사가고를 원신이 전투 시스템 맵형태가 완전 일치하게" → "유니티 사가고도 원신식, **지금 바로**". 106장 순서 5(DUNGEON 점프·등반)보다 먼저 한다 — 등반·점프는 107 ②에서 GO 에 먼저 들어가고, DUNGEON 순서 5는 그걸 판별 복사한다.
웹·Godot 사가고와 **규칙(수치 비율)만 같게**, 코드는 공유하지 않는다(0장). 원작 리소스·이름 금지(66-2 "하지 말 것"), 아트는 이 트랙 원칙대로 사실적 PBR. 이 장이 **GO 한정으로** VS 의 "웹 duel.js 그대로" 원칙을 대신한다 — 옛 사건 결투(도적·희귀 늑대·사당 시련)는 사건용으로 남긴다.

GO 세계는 사람 키가 3.4m(`CharacterVisual.HumanHeight`, 실측의 약 1.85배)라 거리 수치는 그 배율로 늘렸다.

| 순서 | 갈래 | 스펙 | 상태 |
|---|---|---|---|
| ① | **들판 전투** | 아래 107-1 | 코드 완료(실기 확인 전) |
| ② | **이동** | 아래 107-2 | 코드 완료(실기 확인 전) |
| ③ | **지역 지도** | 아래 107-3 | 코드 완료(실기 확인 전) — 경사·고개·바이옴(안개·햇빛)·식생 바이옴(나무·풀·갈대)까지 |
| ④ | **보물 상자** | 아래 107-4 | 코드 완료(실기 확인 전) |
| ⑤ | **원소 쓰는 적** | 아래 107-5 | 코드 완료(실기 확인 전) |
| ⑥ | **동료 모델** | 아래 107-6 | 코드 완료(실기 확인 전) |
| ⑦ | **지역 수호자**(웹 ⑪) | 아래 107-7 | 코드 완료(실기 확인 전) — 옛 망루 곁 하나, 등장 컷은 106-9 |
| ⑧ | **지역 사명 사슬**(웹 ⑬) | 아래 107-8 | 코드 완료(실기 확인 전) — 역참(망루) → 무리 2 → 수호장/상자, 세이브 v16 |

## 107-1. 들판 전투 (①)

- **무대 전환 없음**: 지도 위 적 무리 여섯 곳(`FieldSpawner`, 사건 칸을 피한 숲·공터 — 동쪽 숲 둘·북쪽 숲·남쪽 공터 둘·논밭 옆), 산적(Abe)·해골 병사(Skeleton) 모델, 없으면 캡슐.
- **적**(`FieldEnemy`): 배회(집 둘레 10m) → 발견 24m → 추격(7m/s) → 예고 0.6s(머리 위 "!"·붉게 차오름·발밑 고리) → 판정(반경 4.2m) → 쉼 1.2s. 집에서 45m 끌려 나오면 귀가하며 전부 회복. 쓰러지면 90초 뒤 다시 선다. 머리 위 이름·체력 막대·붙은 원소 점. 산적 체력 320·공격 26·경험치 15, 해골 220·20·10.
- **공격 셋**(`FieldCombat`, 플레이어): 기본 공격 J(3타 0.8·0.9·1.3배, 이어 치기 창 0.9s, 사거리 4.2m·앞 120°, 6.5m 안 가장 가까운 적을 향해 몸을 돌림) · 원소 스킬 E(앞 2m 중심 반경 7m, 1.8배, 원소 부착, 쿨 6s) · 원소 폭발 Q(반경 12m, 4배, 기력 100 소모). 기력: 기본 공격 적중 +2, 스킬 적중 +15. 공격력 = 옛 결투와 같은 합(부대+레벨+장비 × 특성·인연).
- **원소 3·반응 3**(`GoElements`): 화·수·뇌, 부착 6초. 화↔수 **증발** 그 타격 ×1.5 · 화↔뇌 **과부하** 반경 7m 광역(공격력 ×1.0)+밀침 · 수↔뇌 **감전** 2초 동안 0.5초마다 공격력 ×0.3, 옆 4m 의 젖은 적에게도 번짐. 반응은 부착을 지운다. 물리(기본 공격)는 부착·반응 없음.
- **동료 교체**: 주인공(화) + 등용한 동료 앞 셋 = 최대 4명, 숫자키 1~4·명단 탭, 쿨 1s. 동료 원소는 id 의 FNV 해시로 고정. 체력·스킬 쿨·기력은 인물마다 따로. 체력 = 200 + 방어×2. 8초 안 맞으면 초당 4% 회복.
- **회피**: L·왼쪽 Ctrl·버튼, 스태미나 15(100, 0.8s 뒤 초당 25 회복, 달리기 초당 8, 바닥나면 30까지 달리기 잠금), 무적 0.3s·5m 대시(`PlayerController.Dash`).
- **쓰러짐**: 나선 인물이 쓰러지면 다음 산 사람으로 자동 교체, 모두 쓰러지면 잃는 것 없이 마을 스폰에서 전원 회복.
- **옛 결투와의 경계**: 결투 중(`DuelGate.Active`, 세 사건 `Update` 첫 줄 보고)엔 들판 전투 입력·적 AI 가 멈춘다.
- **HUD**(`FieldCombatHud`, 런타임 생성): 아래 가운데 체력·기력·스태미나, 오른쪽 명단 넷(번호·이름·원소 점·체력·폭발 준비), 스킬/폭발 쿨, 모바일 버튼 공격·스킬·폭발·회피. 피해 숫자(`FieldDamageText`, 반응 이름은 원소 색).
- 세이브 스키마는 안 바꾼다(체력·기력은 판 사이에 안 남긴다).
- 진단: `PlaytestGoFieldCombat`(`PlaytestHeadless` 가 부른다).

## 107-2. 이동 (②)

- **지형**(`TestMapData.GroundHeight`·`TerrainBuilder`): 산 칸 = 칸마다 높이가 다른 절벽 고원(안쪽 12~22m, 테두리 30~38m, 좌표 해시). 강·다리 칸 = 강바닥 -3.5m, 수면 -0.45m(옛 값 그대로). 칸마다 땅속 -10m 까지 꽉 찬 충돌 기둥 — 기둥 옆면이 곧 절벽·강둑이고 메시에도 옆면(바위색/흙색)을 세웠다. 옛 보이지 않는 벽(산 6m·강)은 없앴다. 지도 네 변 밖엔 90m 경계벽(`NoClimb`). 다리 충돌 판은 보이는 덱 폭(7m)·높이(윗면 1.0m)에 맞췄고, 플레이어 `stepOffset` 1.1m 라 걸어서 오른다. `Legend.Height` 는 옛 배치 코드가 그대로 쓰도록 안 바꿨다.
- **상태 여섯**(`PlayerController.MoveMode`): 지상·공중·등반·넘어오르기·활공·수영. `traversal`(씬 빌더가 TestVillage 에만 켬)이 꺼진 씬은 점프까지만.
- **점프**: Space(입력 액션 Jump)·모바일 "점프" 버튼, 2.4m(9.8m/s, 중력 20).
- **등반**: 가슴·무릎 높이 광선이 둘 다 가파른 면(법선 y<0.5)에 닿는 쪽으로 밀면 붙는다(상자·메시 충돌체만 — 캡슐·구=사람·소품과 `NoClimb` 제외). 위아래 3.2m/s·옆 2.6m/s, 스태미나 초당 6(가만히 1.5), Space = 도약(3m, 15), 아래+Space = 놓기, 가슴 높이에 벽이 없어지면 넘어오르기(0.45s), 기력 0 이면 떨어진다.
- **활공**: 공중·발밑 4m+ 에서 Space, 앞 10m/s·낙하 3m/s, 스태미나 초당 5, Space 로 접기, 벽에 닿으면 등반. 날개는 코드로 그린 판 둘.
- **수영**: 강 칸에서 발이 수면 2.6m 아래로 내려가면(머리가 다리 판 밑을 지난다). 4m/s(초당 2)·달리기 7m/s(초당 12)·가만히 초당 1. 기력 0 → 마지막으로 딛은 땅(0.5초마다 기록)으로, 잃는 것 없음. 강둑은 기어올라 나온다.
- **스태미나**(`GoStamina`): 달리기·회피·등반·활공·수영 공용 100, 0.8s 뒤 초당 25 회복. 등반·활공·수영은 달리기 잠금과 무관하게 `Use`.
- **전투와의 경계**: 공격·스킬·폭발·회피는 땅을 딛고 있을 때만(`OnFoot`). 들판 적은 산·강 칸에 안 들어온다(`FieldEnemy.CanStandOn`).
- **동작 클립**(Mixamo, 로컬 전용): 등반 Climbing Up A Wall(제자리)·활공 Mid-Air Falling Idle·수영 Swimming Underwater + 물 위 Treading Water·점프 Jump Up → `BuildMariaTraversal`(멱등, 루트 이동은 자세에 굽기)이 Maria.controller 에 `Climb`·`Glide`·`Swim`·`Jump`·`ClimbRate` 상태를 더한다. 없으면 걷기 클립 폴백.
- 진단: `PlaytestGoTraversal`(지형 높이·적 칸 제한·점프 높이·절벽 붙기/등반 중 공격 금지/넘어오르기/스태미나·활공 낙하/전진·수영 높이/스태미나·강둑 등반·익사 복귀·경계벽).

## 107-3. 지역 지도 (③)

- **지역 일곱**(`GoWorldMap.RegionAt`, 이름은 지어낸 것): 마을 들판·서쪽 숲길·동쪽 숲·북쪽 산기슭·너른 강·남쪽 공터·끝 논밭. 경계를 넘으면 가운데 위에 "— 이름 —"(처음이면 "새 지역"), 발 디딘 지역을 적는다.
- **순간이동 지점 다섯**(`WaypointStone`, 역참): 마을·동쪽 숲·산기슭·남쪽 공터·논밭. 돌기둥 위 구슬, 7m 안에 가면 켜져 푸르게 빛난다. 지도에서 켠 지점을 누르면 그 남쪽 4m 로 순간이동(결투 중 안 됨, 쫓던 적은 귀가).
- **옛 망루**(`Watchtower`): 길목(3,6) 옆 안쪽 산(4,6) 고원 위 8m 네모 돌탑 24m + 꼭대기 화톳불(빛 60m). 옆면을 기어올라 꼭대기에 서면 지도 전체가 밝혀지고 불이 푸르게 바뀐다. 망루 칸엔 봉우리 없음.
- **봉우리**(`TestMapData.HasPeak`·`TerrainBuilder.BuildPeaks`): 산 칸 절반쯤에 육각 뿔대(밑 10m·위 5m·높이 12~18m, 옆면 법선 y≈0.38 이라 기어오를 수 있고 윗면에 설 수 있다), 볼록 MeshCollider.
- **M 지도 화면**(`WorldMapUi`, 런타임 생성): M·오른쪽 위 "지도" 버튼. 칸 색 텍스처(물 푸름·산 높이 명암), 안 가 본 지역은 어둡고 이름이 "? ? ?", 플레이어 화살표, 옛 망루, 역참 ◆(켜짐 푸름).
- **걸어 오르는 경사·고개**(`TestMapData.Ramps`·`TerrainBuilder.BuildRamps`): 절벽에 기댄 쐐기 모양 돌 비탈 셋, 28°(캐릭터 경사 한계 45° 안 — 걸어서 오르고, 윗면 법선 y≈0.88 이라 등반엔 안 걸림), 폭 8m, 볼록 MeshCollider. **고개** = (1,8) 산을 남쪽 공터 숲(1,7)에서 올라 끝 논밭 숲(1,9)으로 내려가는 길(가운데 길목 문 말고 다른 길) · **비탈** = 남쪽 공터(4,7) 동쪽 끝에서 옛 망루 고원(4,6)으로(가운데 행운 돌탑은 14m 비킴). 이동 진단이 쓰는 (2,6)·(2,7) 은 피했다. M 지도에 "≡ 고개"·"≡ 비탈"(그 지역에 발 디디면 보임).
- **내리막 붙이기**(`PlayerController.StepWalk`): 비탈을 걸어 내려가면 매 프레임 발이 살짝 떠서 "공중"(낙하 동작·활공 가능)이 됐다 — 방금까지 딛고 있었고 뛰어오르는 중이 아니며 발밑 0.6m 안에 땅이 있으면 붙인다(절벽 끝에서 걸어 나가면 발밑이 멀어 그대로 공중).
- **지역마다 바이옴**(`GoWorldMap.Atmospheres`·`RegionAtmosphere`, Play 때 `WorldMapBuilder` 가 붙임): 안개 빛깔·짙기(기본 0.0035 × 0.9~2.6)·햇빛 빛깔(방향광 원래 빛에 곱) — 마을 노을빛 · 서쪽 숲길 짙은 녹빛 · 동쪽 숲 호박빛 · 북쪽 산기슭 서늘한 회청 · 너른 강 물안개(가장 짙음) · 남쪽 공터 금빛 · 끝 논밭 밀빛. 경계를 넘으면 2.5초(63%)에 걸쳐 스며든다.
- **식생 바이옴**(2026-09-24, `GoWorldMap.Vegetations`·`VegetationBuilder`, 편집기 씬 빌드 때 굽는다 — **씬 재빌드 필요**): 숲 칸 나무 수·수관 모양·크기·잎 빛깔·풀 포기를 지역마다 — 마을 옛 모습 그대로(풀 5) · 서쪽 숲길 칸당 4·활엽+버드나무류·짙은 녹빛·크게 · 동쪽 숲 활엽·**호박빛 단풍** · 북쪽 산기슭 **침엽수만**·서늘한 청록 · 남쪽 공터 칸당 2·금빛 풀밭(풀 12) · 끝 논밭 칸당 2·밀빛(풀 7). 수관 모양은 procgen 씨앗별로 미리 셈(`TreeFormBySeed`: 1·2 침엽, 3·4·6·11 버드나무류, 나머지 활엽). 잎 빛깔은 `Saga/VertexColorTriplanarLit` 의 새 `_CanopyTint`(초록 정점색만, a = 세기, 기본 0 → 옛 재질 그대로) — 지역마다 재질 한 벌(씬에 함께 저장). 칸마다 앞 세 그루는 옛 자리 그대로(해시 salt 불변), 늘어난 나무는 상자·역참·들판 무리·수호장 8m 를 비킨다. **풀**(procgen `grass_s1~3`, 들·숲 칸, 충돌 없음, 요지 3.5m 비킴)·**갈대**(`reed_s1~2`, 강 바로 북쪽 줄 들·숲 칸의 남쪽 둑 띠, 칸당 7) — 둘은 재질색 GLB 라 가져온 재질을 지역마다 복제해 같은 공식으로 초록만 물들인다. 모델이 없는 PC(Generated gitignore)는 풀·갈대를 안 깔고 나무는 모든 모양에서 고른다.
- 진단(식생): `PlaytestGoVegetation`(빛깔 공식 · 숲 칸 나무 수 · 지역 모양 · 재질 빛깔 · 몸통 충돌 수 · 상자가 몸통에 안 박힘 · 풀 자리/충돌 없음/요지 비킴/남쪽 공터가 마을보다 1.5배 빽빽·더 노람 · 갈대 둑 띠). 결과 나무 44·풀 181·갈대 49, 씬 2.5→3.9MB.
- 진단(경사·바이옴): `PlaytestGoSlopesBiome`(비탈 칸·방향·봉우리 안 겹침 · 가운데 높이·법선 28° · 망루 비탈·고개 북쪽을 실제로 걸어 오름(등반 없음·스태미나 그대로) · 고개를 넘어 (1,9) 로 내려섬(공중 0.6초 미만) · 지역 바이옴 표 · 경계에서 툭 안 바뀜·오래 있으면 그 지역 값·마을로 돌아오면 기본값 · 지도 표시 숨김/보임).
- **세이브 v14**: `waypoints`·`regionsVisited`·`mapRevealed`(`WorldMapState`), v13 → 빈 기본값.
- 진단: `PlaytestGoWorldMap`(지역 표·역참 칸·봉우리 윗면 충돌·지역 기록/지도 어둠·역참 켜기/순간이동/진짜 버튼/결투 중 거절·망루 실제 등반→밝히기·지도 버튼·세이브 v14 왕복·v13 로드, 세이브 파일은 되돌림).

## 107-4. 보물 상자 (④)

- **표**(`GoTreasure`): 열여섯 = 평범 7·정교 4·진귀 3·화려 2(Godot ⑥ 비율). 보상 경험치 5·15·30·60 + 돈 10·25·50·100냥(새 재화 없음 — 상인 25·길세 40 기준), 화려만 물건 하나(쇠칼·가죽 갑주).
- **자리·잠금**: 평범 = 잠금 없음, 숲·들 곳곳(사건 칸 한가운데는 비킴) · 정교 = 잠금 없음, 높은 곳 넷(옛 망루 꼭대기·봉우리 (4,8)·(6,6)·봉우리 없는 산 (2,6) 고원 — 봉우리·고원 한가운데는 이동·지도 진단이 높이를 재는 자리라 2.2m·(6,6)m 비킴) · 진귀 = **무리 잠금**, 들판 무리(동쪽 숲 북·남쪽 공터 서·논밭 옆) 한가운데, 그 `GroupId` 적이 **한꺼번에** 모두 쓰러져 있으면 풀림(하나라도 되살아 있으면 안 풀림, 풀린 뒤 적이 다시 서도 풀린 채) · 화려 = **원소 석등**, 둘레 11m(Godot 6m × 1.85)에 석등 셋, 석등마다 정한 원소의 스킬·폭발 원(`FieldCombat.ElementPulse`)에 걸리면 켜지고 첫 불부터 20초 안에 다 켜야 풀림(아니면 전부 꺼짐). 첫째(마을 서쪽)는 화·화·화 = 주인공 혼자, 둘째(강 여울 북쪽)는 화·수·화 = 수 원소 동료(등용한 산적, FNV 해시 = 수)가 있어야.
- **여는 법**: 풀린 상자 4m 안·높이 차 3m 안에 들면 저절로 열림(뚜껑이 0.6s 에 젖혀짐). 잠긴 상자는 14m 안에 들면 푸는 법을 한 번 알려 준다. 겉모습: 나무 몸통 + 등급 띠(쇠·구리·은청·금, 진귀부터 은은히 빛남) + 빛, 잠기면 검은 사슬 X.
- **세이브**: 연 상자만 `WorldEventState` `chest_<id>` — 스키마 v14 그대로. 풀린 잠금은 판 안에서만(저장 안 함). 불러오면 상자가 기록에 맞춰 열린/닫힌 모습으로.
- **지도**: M 지도 안내 줄 끝에 "보물 상자 n/16".
- 진단: `PlaytestGoTreasure`(표 수·칸·봉우리/고원·무리 존재·석등 원소가 주인공+산적으로 풀리는지 · 높은 상자가 딛는 면 위 · 다가가 열기/멀리서 안 열림/두 번 안 열림/뚜껑 · 망루 밑에서 안 열림 · 무리 한꺼번에 아니면 잠김/전멸 풀림/부활 뒤 풀린 채 · 석등 다른 원소 거절/하나씩/20초 꺼짐/진짜 스킬 E/폭발 원 둘 · 화려 물건 · 지도 개수 · 세이브 왕복, 상자 기록·돈·경험치·가방·세이브 파일은 되돌림).

## 107-5. 원소 쓰는 적 (⑤)

- **적 셋**(`FieldEnemy.Kind`, 이름은 지어낸 것): 불도깨비(화, 체력 260·공격 24·방패 150·키 0.85배) · 물귀신(수, 300·22·180·1.15배) · 번개귀(뇌, 230·28·130·1배), 경험치 20. 방패 값은 Godot ⑦ 그대로. 모양은 코드 도형 대신 **해골 병사 모델에 원소 빛깔을 입힌 "원소 깃든 망자"**(사실적 PBR 트랙이라, 66-2) + 반투명 방패 거품 + 몸 둘레를 도는 원소 구슬 셋 + 원소 빛, 머리 위 방패 막대(원소 빛깔)·이름 빛깔.
- **원소 방패**(`GoElements.ShieldMul`): 방패가 있는 동안 체력 대신 방패만 깎이고, 같은 원소 **면역**("면역") · 물리 ×0.4 · 상성(수>화·뇌>수·화>뇌) ×2.5("상성!") · 나머지 ×1, 반응·부착 없음. 깨지면("방패 깨짐!") 넘친 몫은 버리고 하던 예고를 끊고 **2초 비틀거림**(`State.Stagger`), 그 뒤로 보통 적(부착·반응 받음). 옆 적 과부하 광역은 방패가 배율 1 로 받는다. 귀가·부활하면 방패 복구.
- **덤벼 맞히면**(`FieldCombat.ApplyFoeStatus`, 회피 무적이면 없음): 화 = 화상(그 타격 피해 ×0.2 를 1초마다 세 번, 이것만으로는 체력 1 아래로 안 내려감) · 수 = 젖음(스태미나 -25) · 뇌 = 감전(나선 인물 기력 -25).
- **무리 셋 여덟**(`FieldSpawner`, 보물 상자·역참·사건 칸을 비킴): 동쪽 숲 어귀(5.5,2.2) 물귀신 2 · 서쪽 숲길(0.2,4.0) 번개귀 2+물귀신 · 끝 논밭 동쪽 숲(5.3,9.0) 불도깨비 2+번개귀. 주인공(화)은 번개귀 방패를 상성으로 깨고 불도깨비엔 면역 — 불도깨비는 수 동료(산적)나 물리로.
- 세이브 스키마는 안 바꾼다.
- 진단: `PlaytestGoElementalFoe`(상성 표 · 원소 적 8·무리 3·경험치 · 셋마다 방패 값/면역/물리 0.4/상성 2.5/그 밖 1/부착·반응 없음/체력 그대로/깨짐→넘친 몫 버림→비틀 1초 유지·2초 끝/깨진 뒤 부착/부활 복구 · 주인공 진짜 스킬 E 가 불도깨비엔 면역·번개귀는 한 번에 깸 · 화상 3틱 합 0.6배/안 쓰러짐 · 젖음 · 감전 · 산적·회피 무적엔 상태 없음).

## 107-6. 동료 모델 (⑥)

- **몸 교체**(`PartyBodies`, 플레이어에 붙음): 나선 인물의 몸으로 바뀐다 — 주인공 = 씬에 굳힌 Maria, 등용한 "산적" = Abe(두목·잡졸과 같은 사실 모델), 그 밖 동료 id = 기사·농부·아낙(Paladin·PeasantMan·PeasantGirl) 중 FNV 해시로 고정. 처음 나설 때 한 번 만들어 두고 켜고 끈다(충돌체는 지움, 키는 `CharacterVisual.HumanHeight`).
- **같은 컨트롤러**: 몸이 전부 Humanoid 라 Maria.controller 를 그대로 씌운다(아바타 리타깃) → 걷기·공격·피격·점프·등반·활공·수영 상태가 동료 몸에서도 돈다. `PlayerController.SetBody` 가 보던 방향을 넘기고, 옛 몸을 끄고, Animator 파라미터 유무를 다시 세고, 활공 날개를 새 몸 등으로 옮긴다.
- **대신하기**: 모델이 이 PC 에 없거나(로컬 전용 자산) Humanoid 가 아니면 그 인물은 주인공 몸에 원소 빛깔을 옅게 입히는 예전 방식.
- **무기**(`WeaponVisual`)는 주인공 손에만 있다(장비는 주인공 것). 전멸 복귀·세이브 불러오기·진단 리셋은 명단 첫째(주인공) 몸으로.
- 씬 빌더(`BuildTestVillageScene.BuildFieldCombat`)가 모델·컨트롤러를 넘긴다 — **씬 재빌드 필요**. 세이브 스키마는 안 바꾼다.
- 진단: `PlaytestGoPartyBodies`(산적으로 교체 → 몸이 바뀜·옛 몸 꺼짐·Humanoid·같은 컨트롤러·Climb/Speed 파라미터·키 3.4m±20%·방향 넘김·날개 옮김·충돌체 없음·걷기 Speed·기본 공격 · 주인공으로 되돌림·무기 그대로 · 두 번째 교체는 같은 몸(한 벌) · 전멸 복귀 → 주인공 몸 · 모델 고르기 고정). 모델이 없는 PC 에선 빛깔 대신만 본다.

## 107-7. 망루 수호장 (⑦, 웹 사가고 ⑪ 지역 수호자 규칙)

웹 ⑪ 은 "고향을 뺀 지역마다 랜드마크 탑 곁 수호자 하나". 이 판은 랜드마크 탑이 옛 망루 하나뿐이라 **그 곁 하나**로 좁혔다(규칙·수치 비율은 웹 그대로, 이름·몸은 지어낸 것).

- **자리**: 옛 망루(4,6) 고원 남쪽 발치 = 남쪽 공터 북쪽 가장자리(3.6, 6.75) — 역참·돌탑·두 무리를 비켜 섰고 역참마다 발견 반경 +4m 밖. 발견 18m(보통 적 24m).
- **몸**: 두목 모델(Brute) 키 1.6배(≈5.4m), 돌빛에 지금 겹의 원소가 은은히 밴다. 방패 거품·도는 구슬·원소 빛은 107-5 것을 크게(거품 4.2m·구슬 반경 2.6m), 겹이 바뀌면 전부 새 원소 빛깔로. 머리 위 이름 옆 "방패 n겹".
- **수치**(웹 ⑪ 비율): 체력 220×6.5 = 1430 · 겹마다 방패 300×1.3 = 390 · 공격 36 · 경험 90(30×등급 3) · 금 150냥.
- **두 겹**: 겉 = **뇌**(주인공 화가 상성 ×2.5 로 깬다) → 깨지면 **0.8초 휘청** 뒤 곧 속 방패가 가득 차오르고 "속 방패 화 — 수 원소 동료로 바꿔라" 알림. 속 = **화**(주인공은 면역 — 수 동료(산적) 상성 ×2.5, 물리는 ×0.4 로 느리게) → 깨지면 **3초 드러눕는다**(약점). 겹이 깨질 때 체력은 안 깎이고 넘친 몫은 버린다(107-5 규칙). 귀가(끌려 나옴 45m)하면 체력·겹 전부 처음부터.
- **토벌**: 한 번 쓰러뜨리면 다시 안 선다(무리처럼 90초 뒤 되살아나지 않는다, 웹 `save.field.guards` 결) — `GuardianState` → **세이브 v15 `guardianDown`**, v14 → false. `FieldSpawner.PlannedCount` 는 쓰러뜨렸으면 안 센다. 토스트 "망루 수호장 토벌! 금 150냥 · 경험치 90".
- 진단: `PlaytestGoGuardian` — 표·키·자리(역참과 거리) · 겉 화 상성 → 속 방패 가득·원소 바뀜·0.8초·체력 그대로 · 속 화 면역·물리 0.4·수 상성 → 3초 · 그 뒤 체력 · 다시 서면 겉부터 · 등장 컷(106-9) · 토벌 금·경험·PlannedCount -1·90초 뒤에도 안 섬 · 세이브 v15 왕복·v14 로드(세이브 파일은 되돌림). 기존 `PlaytestGoWorldMap`·`PlaytestGoTreasure` 의 버전 검사는 15 로, `PlaytestGoElementalFoe` 의 "원소 적 8" 은 수호장을 뺀다.
- **수호장 전용 몸 완료(2026-09-24)**: Maw J Laygo(뿔 달린 갑주 거수), 키는 그대로 5.4m(`FieldEnemy` 가 재서 맞춤), 돌빛 칠 대신 제 빛깔 위에 지금 겹 원소 30%. 없는 PC 는 Brute.
- 남은 것: 지역마다 수호자(탑·랜드마크가 더 생기면). (지역 사명 사슬은 107-8)

## 107-8. 지역 사명 사슬 (⑧, 웹 사가고 ⑬)

웹 ⑬ 은 "고향을 뺀 지역마다 ① 탑 발견 ② 무리 토벌 2 ③ 탑 곁 수호자". 이 판은 탑·수호자가 옛 망루 하나뿐이라 **첫 단은 역참, 셋째 단은 그 지역 보물 상자 모두**로 대신한다(원신 탐색도 결). 규칙(앞에서부터 차례로·단마다 보상 한 번)·금 비율은 웹 그대로, 웹의 단사는 이 판에 없어 경험치로.

- **표**(`GoRegionMission`): 동쪽 숲(등급 1, 동쪽 숲 역참 → 무리 2 → 상자) · 북쪽 산기슭(1, 산기슭 역참 → 무리 2 → 상자) · 남쪽 공터(3, **옛 망루 꼭대기** → 무리 2 → **망루 수호장**) · 끝 논밭(2, 논밭 역참 → 무리 2 → 상자). 마을 들판(고향)·서쪽 숲길·너른 강(역참 없음)은 사명 없음. 남쪽 공터 등급 3 = 수호장 등급.
- **차례**: `StageOf(발견, 토벌, 마지막)` — 발견 전에 친 무리도 셈은 쌓이고(2 에서 멈춤), 발견하는 순간 둘째 단까지 한꺼번에 넘어간다. 앞 단이 막히면 뒤 단은 조건이 맞아도 안 센다.
- **토벌 셈**: 들판 무리를 **한꺼번에 다** 쓰러뜨리면(`FieldSpawner.GroupWiped`, 107-4 무리 잠금과 같은 판정) 그 무리 한가운데 지역(`FieldSpawner.GroupRegion`)에 +1. 90초 뒤 되살아난 같은 무리를 다시 쳐도 센다(북쪽 산기슭은 무리가 하나). 수호장은 무리가 아니다.
- **보상**: 둘째 단 금 80×등급·경험 20×등급 · 평정 금 200×등급·경험 60×등급(+ 수호장 제 보상). 첫 단 보상은 역참·망루가 준다(없음).
- **한 줄**(`RegionMissionHud`, `WorldMapBuilder` 가 Play 때 붙임): 위쪽 가운데(목표판·자막 아래, y -228) "◆ 이름 사명 n/3 · 다음 할 일"(○○ 역참을 켜라 / 옛 망루 꼭대기에 올라라 / 이 지역 무리 토벌 n/2 / 망루 수호장을 쓰러뜨려라 / 이 지역 보물 상자 n/m). 지금 선 지역에 사명이 없거나 평정했으면 숨는다. 보상을 받으면 그 줄이 4초 금빛 보상 글(자막은 수호장 토벌 글과 덮이니 안 쓴다). 0.25초마다 다시 센다(역참·망루·수호장·상자 이벤트가 제각각이라).
- **M 지도**: 사명 있는 지역 이름 밑에 "사명 n/3"·"평정".
- **세이브 v16** `missions`(지역·토벌 셈·받은 보상 비트) — 다시 불러도 안 준다. v15 → 빈 목록(발견·수호장·상자는 기존 기록에서 다시 센다).
- 진단: `PlaytestGoRegionMission`(보물 상자 진단 뒤) — 순수 단 계산 · 표(지역·역참 지역·망루 지역·무리·상자) · 일부 처치 안 셈 · 무리 먼저 2 에서 멈춤·보상 없음 → 역참 켜면 2/3 한꺼번에·금 80 · 마을 안 셈 · 한 줄/보상 글/마을에서 숨김 · v16 왕복 뒤 다시 안 줌 · 상자 → 평정 금 200·줄 숨음 · 지도 이름표 · 망루 → 무리 → 수호장 → 평정(240·600) · v15 로드. 사명·지도·수호장·월드 이벤트·돈·경험·적·세이브 파일은 되돌림. 수호장·지도·상자 진단의 버전 검사는 16.

---

# 108. 고정 특색 지역 (2026-09-24 사용자 결정 — `../SAGA-DESIGN.md` §12, 일곱 판 공통)

사용자: "전체 지역을 랜덤이 아닌 사가블로처럼 각각 특색이 있는 지역으로" · "모든 프로젝트에 적용". 본보기는 웹 사가블로 §5.12(방위별 이름 있는 지역 아홉·지역 명단·위험도)·사가고 ⑮(땅 열여섯).

- **지금(2026-09-24 조사)**: GO `Data/GoWorldMap.cs` 지역 일곱(마을 들판·서쪽 숲길·동쪽 숲·북쪽 산기슭·너른 강·남쪽 공터·끝 논밭)은 이름·글자 자리뿐, 지형은 고정 `TestMapData.Rows`. FOREST `ForestBiomeData.Zones` 는 고정 구역·빛깔(시각만). STORY 는 웹 판 옮김. DUNGEON 은 `SagaBiome` 다섯 + 고정 씨앗 `System.Random(20260824)`.
- **① GO 완료(2026-09-24)**: `GoWorldMap.Region` 에 한자·사연·위험(1~3)·몬스터 명단. 땅빛은 107-3 `Atmospheres`·`Vegetations` 그대로.
  - 표: 마을 들판 市原 ●○○ 적 없음 · 서쪽 숲길 雷林 ●●○ 번개귀·물귀신 · 동쪽 숲 丹林 ●●○ 산적·해골·물귀신 · 북쪽 산기슭 寒麓 ●●● 해골 · 너른 강 廣川 ●○○ 적 없음 · 남쪽 공터 金坪 ●●● 산적·해골·수호장 · 끝 논밭 末田 ●●○ 산적·불도깨비·번개귀.
  - 위험 배율 1 → ×1.0, 2 → ×1.15, 3 → ×1.3. `FieldSpawner` 가 무리 한가운데 지역으로 `FieldEnemy.ApplyDanger` 를 불러 체력·공격·방패·경험치에 곱한다. 수호장은 107-7 표 그대로.
  - 명단은 정직해야 한다: 무리 구성 ⊆ 그 지역 명단, 명단의 종류는 그 지역에 실제로 선다(`PlaytestGoRegionTraits`).
  - 글: 경계 자막 "— 이름 한자 —" + "위험 ●●○ · 명단"(처음 가는 땅이면 사연 한 줄 더) · 지도 이름표에 위험 점 · 지도 위쪽에 지금 선 지역 두 줄.
  - **지역 전용 소품 묶음 완료(2026-09-24)**: `GoRegionProps.Clusters` 무더기 아홉(마을 들판은 이미 차 있어 뺌) — 雷林 벼락 고목 둘(그을린 고사목·통나무, 몇 초마다 푸른 번쩍임) · 丹林 산적 야영터(돌 화덕·일렁이는 불빛·통나무 걸상·술통·상자·등롱) · 寒麓 무너진 성터·무덤 줄(돌기둥·눕은 기둥·이끼 무덤 돌·고사목) · 廣川 여울 바위 둘(강바닥 바위가 물 위로·떠내려온 통나무) · 金坪 옛 수비대 자리(꽂힌·눕은 방패·부러진 기둥) · 末田 가을걷이 마당(상자·바구니·들통·술통).
    - 모델: Poly Haven 사진측량 열 벌(CC0, glTF 1k 원본, `Assets/Art/Props/PolyHaven/`) + Kenney 돌기둥(성벽 돌 PBR). 웹 판 스캔은 meshopt·WebP 압축이라 glTFast 가 못 읽어 원본을 새로 받았다. 먼 거리용 LOD1(Blender decimate) — 화면 높이 25% 넘을 때만 원본.
    - 규칙: 자리는 손으로 박는다(난수 없음). 무더기 가운데는 상자·역참·무리·수호장에서 12m, 조각은 채집·NPC·조우·석등에서 7m·비탈 끝에서 10m. 길·다리 칸 금지. 밑면은 실제 꼭짓점 최저점을 땅(강은 강바닥)에 맞춘다. 빈터(`Clearing`) 안엔 나무·풀을 안 세운다. 불빛 둘(그림자 없음), 무더기 하나 원본 삼각형 ≤ 35만.
    - 진단 `PlaytestGoRegionProps`(식생 진단 뒤).
- **② FOREST 완료(2026-09-24)**: `ForestBiomeData.Zone` 에 한자·사연·짐승 명단·명소. 어둑숲 暗林(숲도깨비·안개유령, 이끼 돌제단) · 바위 지대 巖野(바위도깨비·무쇠도깨비, 거인 선돌) · 버섯숲 菌林(버섯정령·포자괴물, 요정 돌고리) · 꽃밭 花原(꽃정령·나비정령, 옛 돌기둥터).
  - 존 판정은 중심에서 11.5m(빛깔 띠 가운데). 드나들 때 자막 "— 이름 한자 —" + "사는 것: …", 그 판에서 처음 든 존이면 사연 한 줄 더, 마을로 오면 "— 마을 —"(`ForestZoneTracker`, 세이브 안 건드림).
  - 명소는 존 중심에서 바깥 z 로 7m(den 둘·채집 자리·우편함과 안 겹치는 남은 축). CC0 GLB(돌제단·등불·바위·돌기둥)로 짜고, PBR 재질이라 휨 셰이더를 안 타니 "Visual" 을 거리² × 0.004 만큼 통째로 내린다. 5m 안에 오면 이름·사연 자막(처음이면 "명소 발견!").
  - **짐승 여덟 사실 모델(2026-09-24)**: 도형 → Mixamo 몸 + 빛깔·꾸밈(`SetupForestCreatureModels`, 없는 PC 는 도형 폴백). 숲도깨비 Goblin · 바위도깨비 Pumpkinhulk(돌빛) · 무쇠도깨비 Warrok(무쇠빛) · 포자괴물 Parasite(등 버섯 무리) · 안개유령 Nightshade(반투명·떠 있음) · 정령 셋 Jolleen 작게(버섯 갓·꽃 화관·나비 날개). 키 0.85~1.85m, "Visual" 을 명소처럼 휨만큼 내린다.
- **③ DUNGEON 완료(2026-09-24)** — 웹 사가블로 §5.15 결(코드 공유 없음). `DungeonLandmarkData` 명소 층 여섯: 5 순장 왕릉 殉陵 · 10 무너진 망루성 廢樓城 · 15 흑풍 산채 黑風寨 · 20 가라앉은 용궁 沈龍宮 · 25 업화 대문 業火門 · 30 구름 위 금궐 雲上闕. 31~100층과 그 사이 층은 예전 갈림길 그대로(전부 고정하면 로그라이트 반복이 죽는다).
  - 명소 층은 방 다섯이 늘 같은 순서. 문 하나에 다음 방 이름이 붙고, 난수를 안 쓴다. 잡졸 이름은 그 층 것. 마지막 방은 층 주인(두목 공식 × 1.15, 호위 둘, 월드 보스 초읽기 없음, 등장 컷 부제 "○○의 주인").
  - 첫 토벌에만 그 층 고유 무기(24~46)와 금(층 × 40). 두 번째부터는 흑철중검. 세이브 v10 `landmarkClears`. HUD 층 줄에 "⚱ 이름 · 방 이름", 들어갈 때·방마다 자막.
- **FOREST 존 전용 소품 완료(2026-09-24)**: `ForestZoneProps.Clusters` 존마다 무더기 둘(A = 가운데 + (−7sx, 2sz) · B = (3sx, −7sz), sx·sz 는 존 바깥 방향 부호 — den 둘·채집·우편함·명소를 비킨 두 곳). 暗林 이끼 고목·버려진 등롱 · 巖野 굴러온 바위·광부 짐 · 菌林 썩은 통나무·버섯 바구니 · 花原 꽃 따는 자리·쉼터. GO 와 같은 Poly Haven 스캔(에셋만 같이, 코드는 이 판 것), 사람 키가 실제와 같은 1.8m 라 실측 그대로(× 1). 조각마다 뿌리(충돌, 안 움직임) → Visual(휨 거리² × 0.004 만큼 내림, `ForestZonePropsBuilder.Follow`) → Body(밑면) → LOD0·LOD1(화면 높이 30%). 휨 때문에 정적 표시 안 함. 존 하나 원본 삼각형 ≤ 25만. 진단 `PlaytestForestZoneProps`.
- 108 은 이 트랙 몫(①②③)과 GO·FOREST 소품까지 전부 끝.
- 이 장은 방향만 적는다 — 착수는 이 트랙 세션이 106·107 순서와 맞춰 정한다(다른 세션이 같은 파일을 고치는 중일 수 있다).

---

# 109. 전체 퓨전 · 인물 105 · 웹 변경 이식 — 순서대로 전부 (2026-09-25 사용자 결정)

사용자: "새로운 세션에서 이어 할건데 다 순서대로 적용 되어야 해". 2026-09-25 점검 결과 이 트랙은 ① `../SAGA-DESIGN.md` §13 전체 퓨전이 DUNGEON 5.7(미래 무기 모양 둘·기계화 정찰병)밖에 없고, ② 웹 도감 인물 105 가 없으며(GO 등용 = 산적 한 종, 동료 몸은 해시로 셋 중 하나, 몸 모델 약 20), ③ 웹 PLAN §5 의 2026-09-24 새 절 대부분이 안 옮겨졌다. 아래 표를 **위에서부터 한 줄씩** 한다.

- **규칙**: 한 세션 = 표의 다음 한 줄(크면 그 줄을 쪼갠 첫 조각). 줄 끝 = 그 판 헤드리스 3연속 OK + 커밋·푸시 + 이 표 "상태" 갱신 + PROJECT_STATE "다음 작업"을 다음 줄로. 건너뛰지 않는다 — 막히면(에셋·로그인·결정) 그 사유를 상태에 적고 사용자에게 묻는다.
- **옮기는 법**: 101-2 와 같다 — 웹 코드를 베끼지 않고 그 절의 규칙·수치를 이 트랙 구조로 재해석(없는 구조는 적고 뺀다). 웹 쪽 정본은 `saga-web/<판>/PLAN.md` 해당 절.
- **세 시대**: 이 장에서 새로 넣는 사람·적·소품·건물·사건은 전부 과거·현대·미래가 한 자리에(§13). 한 시대만 가진 새 콘텐츠는 기준 미달. 이름은 가명(실명 금지), 세이브는 버전 올려 옛 세이브를 버리지 않는다.
- **몸**: Mixamo 레시피(`tools/mixamo_automation` README)로 받고 `SetupNpcCharacterImports` 표에 더한다. 현대·미래 후보 카드: Swat Guy·Gas Mask·Alien Soldier·Crypto·Vanguard 류(카드 모습 확인 후). `tools/char-forge` 단계 3(unity)이 나오면 그쪽으로 바꿔 끼울 수 있게 몸 고르기는 표 한 곳에 모은다.

| 순서 | 무엇 | 웹 근거 | 상태 |
|---|---|---|---|
| **A. 전체 퓨전 (§13)** | | | |
| 1 | GO 세 시대 사람·적 — 마을·역참 둘레 사람 셋(과거·현대·미래), 들판 무리 40% 를 다른 시대 적으로(현대 몸·미래 몸 + 원소 규칙 그대로) · 지역 소품 무더기에 현대·미래 조각 섞기 | 사가고 ⑱·⑰ 땅 전용 퓨전 소품 | **1a 사람·적 완료(2026-09-25)** — `GoEras`(무리 해시 60/20/20·역참 110m 안 제 시대, 종류·원소 그대로 몸·이름만: 현대 방독면 약탈자·떠도는 망자 / 미래 강철 경비병·별바다 손님)·`FolkBuilder`(역참 5 × 세 시대 셋, 역할마다 다른 몸 10, 36초 오가기·12m 한 마디)·위험 줄 "시간 틈"·진단 `PlaytestGoEras`. **1b 소품 완료(2026-09-25)** — 무더기 9 에 현대 13(드럼통·타이어·배전함·덮개 씌운 차·방호벽, Poly Haven)·미래 9("시간 틈 잔해": 탐사선 계기·감시 눈·탐조등·중계함·발전기를 4~5배로 띄워 청록 발광 URP Lit·세로축 회전 `RiftSpin`), 다른 시대 32%·지역마다 둘 다·LOD1 여덟. **줄 1 끝** |
| 2 | DUNGEON 세 시대 — 5.7 을 넓힌다: 잡졸 무리·마을 사람·행상에 현대·미래 몸, 명소 층·마을 데코에 시대 층 | 사가블로 5.7·§13·§5.20 | **2a 잡졸·손님·행상 완료(2026-09-25)** — `DungeonEras`: 전투 방 잡졸 넷 해시 60/20/20(층 난수 수열 안 밂, 명소 층·호위·두목 그대로), 층 단계 넷 × 현대·미래 제 몸 여덟(폭주 청년 Brian·시험 기동 인형 X Bot / 방역복 추적자 Gas Mask·경비 보행병 Exo Red / 진압 특공대 Swat·강철 인형 병정 Y Bot / 암흑가 해결사 The Boss·별 너머 방문자 Zlorp), 행상 몸 현대 Leonard·미래 Astra, 마을 셋·갈림길 손님 넷(`EraFolk`, 대사 넷 돌림)·진단 `PlaytestDungeonEras`. **2b 꾸밈 완료(2026-09-25)** — `DungeonEraDecor`: 명소 층 여섯 벌(ProcRoom 에 꺼 둔 채 굽고 그 층 방 다섯 내내 켬 — 왕릉 발굴단 방호벽·배전함 / 산채 약탈 드럼통 / 용궁 떠밀려 온 타이어 / 업화 대문 그을린 덮개 차 …) + 마을 셋·갈림길 둘(손님 곁에 제 시대 물건), GO 와 같은 Poly Haven 스캔 실측 × 1, 미래 = 시간 틈 잔해(청록 발광·1.5m 위에 떠 돎 `EraRiftSpin`), 조각 69·다른 시대 41%·방 하나 원본 ≤ 30만, 진단 `PlaytestDungeonEraDecor`. **줄 2 끝** |
| 3 | STORY 세 시대 사람·적 — 사냥터 잡졸·마을 사람에 현대·미래 | 사가스토리 5-12 | **완료(2026-09-25)** — `StoryEras`: 관문대 넷 = 들판·비경 1~2층·3~4층·5층, 단계마다 현대·미래 제 몸(폭주 라이더 Racer·시험 인형 Dummy / 떠도는 망자 Warzombie·별바다 손님 Mremireh / 뒷골목 불량배 Jody·플라즈마 변이체 Yaku / 용병 돌격대 Steve·강철 거신 Mannequin ×1.3), 들판 열 자리 중 넷은 표로 박고(13·18·28·37m) 비경 보통 전투 잡졸은 해시 40%(정예·보스·두목 그대로), 처음 가까이 오면 "⏳ 시간 틈" 알림, 마을이 없어 들판 뒤쪽 길에 손님 둘(사진 찍는 여행자 Olivia·시간 여행자 Ely, 대사 넷 돌림), 진단 `PlaytestStoryEras`. **줄 3 끝** |
| 4 | FOREST 세 시대 — 존 소품·명소에 현대·미래 조각, 마을에 시대 섞인 사람 | 사가의숲 §13 적용분 | **완료(2026-09-25)** — 존 소품(`ForestZoneProps`): 무더기 여덟에 현대(드럼통·타이어·배전함·덮개 씌운 차·방호벽)·미래 시간 틈 잔해(청록 발광·머리 위에 떠 돎 `ForestRiftSpin`, GO·DUNGEON 과 같은 빛깔) + 존마다 **명소 곁 무더기**(제단 위 중계함·선돌 곁 탐조등·돌고리 위 계기·돌기둥 위 감시 눈), 조각 42 중 16(38%). 마을(`ForestEras`·`ForestEraFolk`): 광장 둘레 사람 여섯 — 과거 길 잃은 성 파수병 Castle Guard·붉은 두건 순례 기사 Pelegrini / 현대 택배 기사 달음 Pete·사진작가 찰나 Sophie / 미래 금빛 외골격 시간 여행자 Uriel·불시착 탐사원 루미 Jennifer, 36초 중 3초씩 3.5m 오가고 곁에 오면 대사 넷 돌림(웹 §5.9·5.10 부탁·단골은 줄 12). 진단 `PlaytestForestEras`. **줄 4 끝** |
| 5 | REALM 세 시대 — 시간 틈 사람(현대·미래 재야) + 퓨전 시나리오·사연(폐허·묘역·삼계) | 사가국지 5-12·5-9 | **완료(2026-09-25)** — `RealmEras`: 시간 틈 아홉(현대 강서·공석·금담·명변·도하 / 미래 성연·궤도·은하·영점, 웹 자질 그대로)을 본토 적국 아홉(소패·하비·낙양·업·수춘·장안·성도·양양·건업)에 재야로 묻음 — 함락해 들인 뒤 수색(처음 찾을 때 사연 한 토막)·등용(웹 이방인 충성 감점 → 등용률 ×0.85, 이 트랙엔 충성 축이 없다), 이름 뒤 시대 딱지. 퓨전 사연 셋(`RealmEventState` 여는 셋 + 이어지는 셋): 관문 성 균열 = 운중 · 폐허 = 오원 · 묘역 = 일남을 쥐면 뜨고, 관문 성 치안·병력·훈련·기술·상업·인구를 건드리며, 둘째 단에서 이계 무장(성혼·부생·강해)이 합류. 시나리오 ⑦⑧⑨ 는 이 트랙에 시나리오 선택·세력 AI 가 없어 뺐다. 몸은 없음(지도 위 인물은 줄 13). 진단 `PlaytestRealmEras`. **줄 5 끝 = A 전체 퓨전 끝** |
| **B. 인물 105** | | | |
| 6 | 도감 옮기기 — 웹 `data.js` HEROES 105(id 그대로·표시 이름은 가명·시대·원소)를 GO 등용 목록으로, 싸워서 등용 | 사가고 ⑯·도감 | **6a 완료(2026-09-25)** — `GoHeroes`: 웹 HEROES 105 를 스크립트로 옮긴 표(id·가명·시대 묶음 넷·희귀도·기질·자질·한마디, 웹 `hanja` 칸은 세계사 몇몇이 실명에 가까운 로마자라 뺐다), 원소는 웹과 같은 해시로 일곱 중 하나 → 이 트랙 셋(불·바위 화 40 · 물·얼음·풀 수 33 · 번개·바람 뇌 32, 원래 값은 줄 8 용으로 남김). 들판 인물(`FieldHeroes`): 지역 여섯에 한 자리씩(위험도 = 희귀도 − 2, 너른 강 뺌), 평소엔 서 있는 사람 → 7m 안에 들면 그 자리에서 겨루기(인물 = `FieldEnemy.Kind.Hero`: 체력 220×(1.6+0.7★), ★4 방패 한 겹·★5 두 겹(제 원소 → 제 원소가 누르는 원소, 수호장 두 겹 규칙 일반화), 졸개 ★3 하나·★4~5 둘(둘째는 현대·미래 몸), 기질 무 = 넓은 내려찍기·지 = 발밑에 떨어지는 원거리·덕 = 빠른 근접), 체력 0 = 굴복(무릎) → 동행, 끌고 멀리 가면 없던 일, 전멸이면 떠나고 다음 사람. 곁 셋 = 최근 등용 셋·이름·원소는 도감에서. 세이브 그대로(동행 명단). 진단 `PlaytestGoHeroes`. **6b 도감 화면 완료(2026-09-25)** — `HeroDexUi`(B 키·오른쪽 위 "도감" 버튼): 위 모은 수(등용 n/105·만남 m) · 시대 넷 탭(탭마다 등용/전체) · 그 시대 칸 8 줄, 세 단계 = 등용(원소 빛깔·이름·원소·기질) / 만남(겨루기를 한 번이라도 연 사람, 회색·이름) / 안 만남(검은 그림자 칸 — 별과 "? ? ?" 만) · 칸을 누르면 자세히(등용 = 자질 셋·한마디, 만남·그림자 = 서는 지역) · 가로 PC 캔버스 1080×607 안 · 지도와 서로 닫힘. "만남"은 `HeroDexState`(세이브 v17 `heroesSeen`, v16 = 동행만 만남). 웹 세력 칸은 번역 56개라 뺐다. 진단 `PlaytestGoHeroDex`. **줄 6 끝** |
| 7 | 몸 배정 — 시대 × 체형으로 몸 20여 벌에 나눠 싣고 빛깔·꾸밈 조합(FOREST 짐승 방식)으로 인물마다 다른 겉모습, 동료 교체(107-6)가 그 몸을 쓴다 | 사가고 도감 | **완료(2026-09-25)** — `GoHeroLooks`(몸 고르기 표 한 곳): 역사풍 사실 몸 열일곱(남 열둘 Dreyar·Castle Guard 01/02·Heraklios·Pelegrini·Brady·Morak·Uriel(★5 만)·Peasant Man·Paladin·Joe(근대 인물 양복)·Ninja(암영조 하나) / 여 다섯 Kachujin·Arissa·Eve·Peasant Girl·Archer — 새로 받은 Mixamo 여덟 포함, GO 역참 사람·시대 적·산적 몸은 뺐다), 기질·시대 어울림 점수 + 한 몸 최대 10 으로 나눔, 여자 열둘·근대 다섯·닌자는 손으로 박음(`BodyOverride` — char-forge 단계 4 몸이 나오면 여기로 바꿔 끼운다). **빛깔은 안 쓴다** — 이 몸들은 피부·옷이 재질 하나라 얼굴까지 물들고, 사용자 기준 "색만 다른 건 다른 게 아니다". 대신 모양 다섯 축: 키 셋 · 체격 셋(몸 너비 0.9/1/1.1) · 등(칼·에스톡·사브르·철퇴·전투 망치·도끼·방패) · 허리(손도끼·단검·나침반·등잔) · 머리(어부 모자·둥근 안경, 투구·두건 몸엔 없음) — Poly Haven 스캔 CC0 열둘 + 방패, 실측 × 몸 키/1.75. **같은 몸 두 사람은 다섯 축 중 둘 이상 다름**(105 모두 다른 모습). `HeroDresser` 가 그 몸의 살 정점을 한 번 구워 등·허리·머리 자리를 재고 뼈에 붙인다(칼은 넓은 끝 = 자루가 어깨 위로). 동행 교체(`PartyBodies`)·들판에 선 인물·겨루기 상대 셋이 같은 겉모습. 진단 `PlaytestGoHeroLooks`. **줄 7 끝** |
| 8 | 인물마다 다른 원소 스킬 모양 + 지도 위 동행 모션(교체 연출) | 사가고 ⑫·⑭ | **완료(2026-09-25)** — `GoSkillShapes`: 원소 스킬(E) 모양 넷 — 웹의 id 해시 대신 **기질**로(웹 ⑲ 순서 11 "모양 = 기질 틀 × 원소" 방향, 겨루기 틀과 같은 결): 무 = 돌진 32 · 덕 = 찌르기 28 · 지 = 장판 23 / 소환 22(id 해시 반반) · 통 = 소환, 주인공 원형 그대로, 도감 밖(산적) 해시. 거리는 웹 원형 4.5m : 여기 7m 로 ×1.56, 배율은 웹 원형 ×2.2 : 여기 ×1.8 로 ×0.82 — 찌르기 직선 12.5m·폭 2.5m ×2.3 · 돌진 최대 9.4m(겨눈 적 1.9m 앞)·폭 2.8m ×2.0·무적 0.3초 · 장판 반경 6.2m 5초 1초 틱 ×0.5 · 소환 반경 10.9m 8초 1.5초 틱 가까운 적 하나 ×0.75. 장판·소환 = `FieldCombat.Zones`(놓은 사람 공격력, 교체해도 남음, 첫 틱 곧바로). 빛깔은 웹 원소 일곱(`WebElement`)으로 칠한다(피해 원소는 셋). 그림: 찌르기·돌진 = 원소 빛 띠(`FieldLineFx`) · 장판 = 틱마다 고리 · 소환 = 떠서 흔들리는 등불 정령(Poly Haven 등잔 + 점광, `SkillSpirit`)이 적에게 빛줄기. 스킬 칸·머리 위에 모양 이름. **교체 연출**(웹 ⑭, `PartyBodies`): 들판 교체·쓰러져 넘김이면 옛 몸을 떼어 옆뒤로 4.7m(웹 2.4m × 척도 1.94) 0.6초 걸어 물러나 0.9초에 떠오르며 줄어 사라지고, 새 몸이 옆 3.1m 에서 0.35초 ease-out 으로 들어선다. 물러나던 몸을 곧바로 부르면 제자리로. 되돌림·전멸은 바로. 진단 `PlaytestGoSkillShapes`. **줄 8 끝 = B 인물 105 끝** |
| **C. 웹 변경 이식 (판별, 웹 절 순서)** | | | |
| 9 | GO — 건물 가림 카메라(⑯ 뒷부분) · ⑰ 중 107-2 에 없는 것(폭포·정상 순간이동 등 — 대조 후 남은 것만) | 사가고 ⑯·⑰ | **완료(2026-09-25)** — 대조: 오르기·헤엄·점프·활공·등반 도약(107-2)·다리·땅 퓨전 소품(109-1b)은 이미 있음, 능선 걸음 ×0.5·내리막 ×1.2 는 웹 키보드 걸음 배율이라 물리 비탈·등반인 이 트랙엔 안 옮김. **카메라**: 벽엔 이미 광선 당김이 있었지만 마을집 지붕(5.7m)엔 충돌체가 없어 집 뒤로 가면 카메라가 지붕 속에 들어 캐릭터가 가려졌다 → 지붕마다 카메라만 막는 트리거(`CameraOccluder`, 걷기·등반 광선은 모두 트리거 무시라 안 걸림) · 광선 → 반지름 0.35m 구 · 사람·짐승·줄기(캡슐·구·CharacterController)는 지나감(곁을 지날 때 들썩이지 않게). 지붕 너머 선 16m → 4.3m. **정상**(`GoWorldMap.Peaks` = 봉우리 칸 28, `PeakSummits`): 윗면(반지름 6m·1.2m 아래까지)에 처음 서면 금 80 + 높이(28~55m) · 경험 70(웹 50 + 단사 2 → 지역 사명 비율로 +20) · 기록 **세이브 v18** `peaksFound`, M 지도 ▲(그 지역 발 디디면 보임·오른 정상 금빛·누르면 윗면으로 순간이동, 안 오름·결투 중 거절), 이름 "지역 봉우리 N". **발원지 폭포 둘**(`TestMapData.Waterfalls`): 동쪽 끝 경계 산(8,4) → 강 "은빛 폭포" 36m · 서쪽 산(1,6) → 강 "안개 폭포" 15m — 고원 윗면 샘 웅덩이 → 턱에서 1.4m 밖으로 휘어 수면까지 떨어지는 물 판(새 셰이더 `Saga/WaterfallUnlit`: 폭 22 줄기가 서로 다른 빠르기로 흰 물살, 턱은 희게, 양옆 흐림) + 물보라 입자(부드러운 점 텍스처를 코드로 굽는다), 충돌체 없음(뒤 절벽은 그대로 기어오름), 지도 "≋ 이름". 진단 `PlaytestGoPeaks`. **줄 9 끝** |
| 10 | DUNGEON — 5.9 비결 → 5.10 비전 → 5.11 시련 → 5.12 고정 세계 지역 아홉 → 5.13 지역 몬스터·위험도·우두머리 → 5.14 지역 사연 → 5.16 몸짓 → 5.17 동행 서명·합격 → 5.18 명소 주인 고유 수 → 5.19 몰이 사냥 (한 절 = 한 조각) | 사가블로 5.9~5.19 | **10-1 비결 완료(2026-09-25)** — 웹은 무예 120 × 단수 1~5 인데 이 트랙 무예는 셋뿐·단수가 없어 **평타·강공격·회전베기에 비결 하나씩**, 단 = 1 + (Lv−1)/2 로 Lv 1·3·5·7·9 에 하나씩 연다(`SecretState`). 웹 수치 그대로: 분노 위력 ×1.45·(기력 → 이 판 유일한 대가인) 재냉각 ×1.4 · 한기 ×0.9·(원소·지속 피해가 없어) 맞은 적 2.8초 얼림 = 쫓기·공격 준비·예비동작 ×0.6, 얼음빛(`DungeonEnemy.Chill`) · 확산 ×0.8·회전베기 반경 ×1.35, 평타·강공격은 사거리 ×1.35 + 곁의 둘 · 신속 ×0.7·재냉각 ×0.5 · 흡혈 ×0.9·쓴 뒤 3초 세 무예 피해의 12%. 레벨이 모자라면(웹 환원) 고른 값은 남기고 없는 것으로 읽는다. 패널(`SecretPanelUi`, K·소환 위 "비결" 버튼, Play 때 지어 씬 재빌드 없음) — 무예 셋 줄 × 다섯 칸·잠긴 칸 "Lv.n"·공격 버튼 오른쪽 위에 첫 글자 딱지. **빛기둥**(`LootMarker`): 무기 등급 1 = 명품 노랑 3.4m · 2 = 보물 초록 5.6m · 명소 첫 토벌 무기 = 고유 주황 8m 굵게(웹 110·180·260 비), 0.35초에 솟고 1.5초는 안 줍힘, 보물·고유는 떨어질 때 소리. 보석은 등급이 없어 뺐다. 세이브 v11 `secrets`. 진단 `PlaytestDungeonSecrets`. **10-2 비전 완료(2026-09-25)** — 웹 "전설 한 점에 비전 하나"의 전설 자리를 이 트랙 맨 위 명소 첫 토벌 무기 여섯(빛기둥 고유)이 맡는다: 굴리지 않고 `ItemData.Lore` 에 박음(순장검 혈해=흡혈 · 성주도 노화=분노 · 쌍부 만상=확산 · 삼지창 빙혼=한기 · 업화 철퇴 노화 · 금검 섬광=신속, 다섯 다 나옴). 든 무기의 비전과 같은 비결을 건 무예 위력 ×1.6(분노와 곱해 2.32, 재냉각은 그대로), 딴 비결·빈 무예는 그대로, 무기를 바꾸면 꺼짐. 무기 한 칸이라 "같은 비전 두 점 안 겹침"은 저절로 · 부서짐·미확인·부르기 +1 은 없는 축이라 뺌 · 세이브 없음(무기 id). 표시: 패널 제목 줄 "비전 노화 — 분노 을(를) 건 무예 위력 ×1.6"·무예 줄 " · 비전 노화 ×1.6"·그 비결 칸에 "비전 노화" · HUD 무기 뒤 "[비전 노화]" · 줍기 글에 비전 줄. 진단 `PlaytestDungeonSecrets` 에 이음(앞 진단은 비전 없는 목검을 쥐고 돈다). **10-3 시련 완료(2026-09-25)** — 굴혈 카드·부적 층이 없어 **난입과 같은 격리 방**을 쓴다: 난입 표식 북쪽 5m 시련 표식(`TrialGate`, 금빛 기둥·모래시계) → 제10층 전엔 안내, 뒤로는 단계 카드(`TrialCardUi`, 열린 단계 위 셋·적 배율·최고·횟수·순위표 다섯) → 고르면 방으로. 웹 수치 그대로(`TrialState`): 15분 · 진척 100(잡졸 3·정예 8, 웹 보스 10·그림자 1 은 이 시련에 안 나옴) → 그 방에 수호자 · 적 = 제10층 공식 × (1 + 0.35 × 단계) · 쓰러지면 −30초·그 자리에서 일어섬(유품 없음, `HeroState.GraveSuppressed`) · 시간 초과 = 기록 없음 · 완주 = 순위표 10·절반 넘게 남기면 +2 아니면 +1 단계(상한 100) · 전설 한 점 = 명소 무기 여섯 중 하나(§5.10 비전) · 공적 6+단계(공적 화폐가 없어 × 50 냥) · 빛기둥 고유. 살아 있는 적이 셋 밑이면 무리(잡졸 넷 = 과거 황건적·현대·미래 시대 적·과거 + 정예 = 과거 황건 정예/미래 기계화 정찰병 번갈아, §13) · 수호자 = 층 주인 몸 × 층 두목 공식 × 1.15, 첫 등장 컷(시계는 컷 동안 멈춤). HUD 한 줄(단계·시계 1분 미만 붉게·진척/수호자!) · 종료 카드(시간·순위·열린 단계·보상). 러너·표식·카드는 Play 때 `TrialRunner.Install`(씬 재빌드 없음). 난입과 서로 막음. 세이브 v12 `trialBest/Open/Runs/Board`(순위표 인물 칸 → 그때 레벨). 진단 `PlaytestDungeonTrial`. **10-4 지역 아홉 완료(2026-09-26)** — 웹은 481×481 칸 절차 들판을 방위 아홉으로 가르지만 이 트랙 바깥 세상은 이미 30m 간격 3×3 칸의 손으로 박은 방이라 **칸 하나 = 지역 하나**, 방위를 웹 그대로 맞춤(`DungeonWorldMap`): 가운데 모루골 = 중원 벌판 中原 · 동 Town4 = 잿빛 폐도시 廢都市(굴뚝 마을) · 동남 갈림길 = 소금 개펄 鹽田 · 남 Town2 = 지옥 균열 地獄龜裂(잿불 마을) · 서남 갈림길 = 태양 신도시 新都市 · 서 Town3 = 서역 모랫길 西域(낙타 마을) · 서북 잊힌 능묘 입구 = 천계 사당 天界 · 북 던전 길 Room2~4 = 북방 설산 北方雪山 · 동북 옛 감시탑 뜰 = 기계 황무지 機械荒蕪 (키·이름·한자·시대·사연·땅색은 웹 `world-map.js` 그대로, 자리 이름은 지어냄). 칸 경계는 복도 한가운데(±15m), 칸 밖(ProcRoom 던전 층·능묘 속 방·난입/시련 방)은 지역 없음. 새 지역에 1.2초 머물면 제 캔버스 배너 두 줄(— 이름 한자 — / 자리 · 시대 · 사연, 4초, 땅빛 글) — 지역 밖에 다녀와도 같은 지역은 다시 안 띄움(`DungeonRegionTracker`, Play 때 설치). 땅빛 = 웹 땅색 색조를 칸 방 바닥 열하나에 40% 곱함(MaterialPropertyBlock, 사진 재질 유지). M 지도 나침반 다섯 칸 → 3×3 아홉 칸(이름·한자·자리, 바탕 땅빛, 지금 칸 금빛, 위에 "지금 — 이름"). 웹이 고친 절차 들판 끼임은 이 트랙에 절차 들판이 없어 해당 없음 · 지역 전용 시대 소품은 109-2b 가 마을·갈림길에 이미 세 시대라 더 안 세움 · 세이브 없음. 진단 `PlaytestDungeonRegions`. **10-5 위험도·우두머리 완료(2026-09-27)** — 위험도 웹 값(중원 0·개펄 2·폐도시/서역 3·신도시/설산 4·천계 5·지옥/기계 6), 웹 "3000 마다 +1" 은 칸이 모두 가운데서 한 칸이라 없음. **옛 VS 적·매복엔 안 곱함**(설산 위험 4 가 던전 첫 길) — 위험도는 새 우두머리·호위에만. 명단(웹 12~23종)은 이 판 몸이 적어 **지역 시대로 호위 몸**: 과거 황건 정예 · 현대/미래 그 층 단계 시대 적 · 신화 해골 무사(`DungeonRegionFoes`). 우두머리 아홉(웹 id·이름·사연·빛깔 그대로) — 칸마다 벽 가 고정 표식(검은 돌기둥 + 빛 구슬, `RegionBossRunner` Play 때), 웹 "1500 안에 들면" 은 칸이 방 하나라 시작 마을에서 바로 붙어 **밟으면 섬**(4m 알림 한 번), 호위 정예 셋은 방 안쪽 부채꼴 · 세기 = 위험 + 4 층 두목 공식·체력 ×3 · 등장 컷은 두목급 결(부제 = 사연) · 이 판 적 이동이 벽을 안 봐 **18m 끈**(물러남, 쉼 없음). 토벌: 전설 = 명소 무기 여섯 중 지역·횟수 해시(§5.10 비전)·홍옥·금(잡졸 금 ×6)·공적 (15 + 층) × 50 냥, 10분(실제 시각) 쉼 = 구슬 잿빛. 웹 "보물 둘·재료" 는 무기 한 칸·재료 없음이라 뺌. 몸은 **다른 판 몸을 빌림**(STORY Morak·Racer·Dummy·Warzombie·Mremireh·Yaku·Mannequin · GO Maw·Copzombie, 신화 호위 Skeleton) — 층 진행기 `regionBodyNames/Models`, 키는 Play 때 재서 2.8m. HUD 무기 줄 끝 "위험 N"(웹 "HUD 머리 = 지역 이름" 은 영어에서 목표판과 겹쳐 뺌) · 배너 셋째 줄 · M 지도 ☠ 이름·✔·쉼 흐림. 세이브 v13 `regionBoss`. 진단 `PlaytestDungeonRegionFoes`. **10-6 지역 사연 완료(2026-09-27)** — 웹 CHAINS 아홉(제목·의뢰인·사연·흔적·찾은 글·정예·평정 글)·수치 그대로(`DungeonRegionSagas`): 들어섬 배너가 뜨면 열리고 네 걸음 순서대로만 — ① 토벌 10+2L(그 지역에서 쓰러진 적 누구든, 처치 자리로 판정) ② 흔적(그 걸음일 때만 빛나는 작은 흔적, 1.6m) ③ 정예 3(중원 2, 정예 표시 적 = 사냥터 정예·우두머리 호위 + 우두머리) ④ 그 지역 우두머리(닿으면 쉼 지움). 처치 한 번은 지금 걸음 하나에만 셈(우두머리로 ③·④ 동시 안 됨), 우두머리를 먼저 잡아도 안 건너뜀. 금·경험 60+30L… / 평정 공적 (20+L)×50 냥 / 구주 평정 금 20000·경험 1000·공적 ×50. **이 트랙 다름**: 칸엔 들판 몬스터가 없어 ①·③ 걸음 동안 칸마다 **사냥터 깃발**(밟으면 ① 잡졸 셋·③ 남은 수만큼 정예, 지역 시대 몸·위험 층, 다 쓰러지면 3초 뒤 다시, 칸 떠나면 물러남 — 들어서기만 해도 서면 시작 방에서 곧장 붙어 깃발로). 흔적 그림 문자(🪨🪧 등)는 대체 글꼴에 없는 게 섞여 🔍 하나로. HUD 한 줄 "📜 제목 k/4 걸음 n/m" · M 지도 칸 머리 ❔/📜/🔍/🏳·판 아래 "지역 사연 n/9 평정". 지역 배너는 축복 3택·시련 카드가 열리면 숨음(배치 점검 겹침). 세이브 v14 `regionSaga`·`regionSagaAll`. 진단 `PlaytestDungeonRegionSagas`. **10-7 몸짓 완료(2026-09-27)** — 웹 `gesture.js` 그대로 화면 층만(판정·세이브 없음, `GestureState` 순수 + `Gesturer` 화면 + `GestureRunner` 묶음 Play 때): ① 다가서면(3.2m, 나갔다 오면 또) 👋 1.0초 ② 볼일 = 행상이 팔면 제 일 1.6초(연달아 와도 한 번) ③ 틈틈이 7~11초마다 1.4초 제 일(글자 없음, 주기·어긋남 = 키 FNV-1a 웹 값) ④ 동행 둘: 선두 **회전베기**(이 판엔 서명 무예가 없어 대기술 자리)에 ❗ 호응 0.8초 = 제 공격 클립(무사 베기·술사 시전), 두목급(IsBoss·월드 보스 — 층 두목·살수·명소 주인·우두머리·시련 수호자) 처치 🎉 이겼다·레벨업 🎉 경하 1.4초 통통 튐. 걷거나 치는 중·쓰러짐·도발이면 글자만. **이 트랙 다름**: 웹 마을 사람 일곱이 없어 이 판에 선 사람으로 일 표 여섯(촌민 🌾 일손 = 망치질 · 행상(시대 행상 포함) 💰 흥정 · 시대 손님 넷 📦 배달·📱 통화·⌛ 좌표·📡 측정 = 흥정), 몸이 **대기 클립뿐**이라 슬롯 교체 대신 `LateUpdate` 에서 팔·허리·머리 뼈를 **월드 축**으로 더 돌림(손짓 = 오른팔 140° 흔듦 · 흥정 = 두 팔 앞 + 끄덕 · 망치질 = 두 번 내리침 · 환호 = 두 팔 번쩍), 애니메이터가 안 쓴 프레임은 되돌려 안 쌓임 · 폴백 몸은 몸 전체 숙임·튐. 마을 아낙 몸의 Attack(술사 시전)은 일손에 안 씀. 머리 위 글자 = 월드 TMP(키 재서 +0.3m, 솟고 흐려짐). 웹 손잡이 `dungeon.gesture` = `GestureState.Enabled`. 그림 문자는 대체 글꼴에 있는 것만(변형 선택자 없이). 5.17 ✨ 서명·⚡ 합격은 다음 조각. 진단 `PlaytestDungeonGestures`. **10-8 동행 서명·합격 완료(2026-09-27)** — 웹 `castAllySig` 수치 그대로(`AllySigState` 순수 + 동행마다 `AllySigCaster`): 첫 4초 · 재사용 max(8, cd × 1.5) · 제 자리 반경 안 적 셋 이상이거나 정예·두목급(IsBoss·월드 보스)이면 · 선두 서명 뒤 1.5초 안이면 적 하나로도 곧장 **합격** ×1.5·알림 "⚡ 합격! 무사 · 💥 철벽 진동"(창은 한 번 쓰면 닫힘 — 동행 둘 중 먼저 나간 쪽만) · 밀침 ≤ 웹 30 · 축복 3택이 떠 있거나 컷 중·쓰러져 있으면 안 씀 · 무작위 없음 · 세션 셈(서명·합격, 세이브 없음) · 손잡이 `AllySigState.Enabled`. **이 트랙 다름**: 동행이 인물이 아니라 서명을 **하나씩 지어 줌** — 무사 💥 철벽 진동(v 3.0·cd 16 → 24초·밀침 1.25m) · 술사 ❄ 서리꽃 파동(v 2.6·cd 14 → 21초·밀침 0.83m·맞은 적 2.8초 얼림 = 비결 한기 값). 선두 서명 = 회전베기(10-7 과 같은 자리). 반경 = 웹 120 을 회전베기 비(68px ↔ 2.8m)로 5m, 밀침 30px → 1.25m. 위력 = 제 평타 × v(웹 companionMul 은 선두 대비 힘이라 뺌 — 이 판 동행은 제 공격력을 따로 가짐). 두목급은 안 밀림. 모양 = 제 자리 땅 고리 0.35초(`SigPulse`, 무사 금빛·술사 얼음빛) + 제 공격 클립 + 몸짓 쓴 쪽만 ✨ 서명 / ⚡ 합격(동행별 몸짓 키 — 호응·환호는 여전히 둘 다). 진단 `PlaytestDungeonAllySig`. **10-9 명소 주인 고유 수 완료(2026-09-27)** — 웹 `guard.sig`·`guardZones`·`stepGuardSig` 그대로(`DungeonLordSigs` 순수 표·원 자리 + 주인마다 `LordSigRunner`, 주인 `Tick` 이 부름): 명소 키 여섯 = 웹 여섯이라 짝 그대로 — tomb 순장 호령(체력 ⅔·⅓ 에 이 층 잡졸 둘, 방 치움 셈에 듦) · fort 망루 화살비(내 자리+양옆 원 셋, 시전마다 1.1rad 돎) · bandit 흑풍 삼연돌(내 자리로 세 번, 주인이 원 가운데로) · palace 심연 소용돌이(예고 동안 2.5m/s 로 끌림·1.2m 에서 멈춤·구르는 중 안 끌림) · hellgate 업화 장판(불바닥 6초·0.5초마다 × 0.2·넷까지) · cloud 천뢰 십자(줄 넷 × 원 다섯, + / × 번갈아). 수치 웹 그대로(첫 3초·cd·예고·× 주인 공격력), 거리는 24px = 1m(10-8 과 같은 비). 예고 원(`LordZoneFx`)은 제 크기에 서서 터질 때가 다가올수록 진해지고 굵어짐, 불바닥은 일렁임. 예고·시전 동안 강타를 쉬고, 강타 예비동작 중엔 새로 안 검. 구르기 무적이면 원도 비킴. 첫 시전만 알림(호령은 문턱마다 한 줄). 주인이 쓰러지면 예고 원·불바닥 지움. **이 트랙 다름**: 웹 원소(빙·화·뇌)는 원소 피해가 없어 빛깔만 · 소용돌이 끌림은 CharacterController.Move(벽이 막음). 손잡이 `DungeonLordSigs.Enabled`. 진단 `PlaytestDungeonLordSigs`(명소 여섯을 뛰어 진짜 주인 방에서). 진단 중 발견: `HeroState.ExpForLevel` 이 레벨 ≈72 부터 int 를 넘어 음수 → `AddExp` 무한 루프(게임 멈춤) → int 최대에 멈추게 고침. **10-10 몰이 사냥 완료(2026-09-27) — 10번 칸 끝** — 웹 §5.19 1차·2차 흩어짐(`DungeonHunt` 순수 수치·판정): 층 진행기 전투방 잡졸 하나마다 졸개 2(같은 몸·이름, 체력 55%·피해 70%·몸 0.75·보상 절반·무기 없음, 둘레 1.0~1.83m 고리·첫 공격 0.6~1.4초 어긋남 = 층·방 해시, 방 적 상한 30, 정예·두목급엔 안 붙임) · 평타 앞 120°·사거리 × 1.35 곁 60% · 강공격 앞 180°·× 1.8 곁 강공격의 75%(예비동작도 끊음) — 확산 비결 곁 둘과 안 겹침 · 경직 0.25초(다음 공격이 밀림, 두목급 제외) · 움찔 0.28초(피격 클립이 없는 몸만, 있는 몸은 원래 Hit 트리거) · 쓰러지면 나에게서 먼 쪽 ±0.45rad(자리 해시)로 힘 0.7~2.4(넘친 피해·강공격 +0.5) × 1.1m 날아가며 돌고 0.6~1.2초에 0.8m 가라앉음, 쓰러짐 클립 없으면 눕힘(`DeathFling`, 파괴 1.2초 안 — 애니메이터 있는 몸만, 폴백 도형은 예전처럼 곧장 사라짐). 손잡이 PackN·CleaveOn·Stagger·Scatter(0 = 옛 동작). **해당 없음**: 방 1.5배(이 판 방 20×20m ≈ 웹 1.5배 뒤 넓이, 방 셸이 구운 GLB) · 들판 상한·무리 보충·세계 소품 밀도·안 보이는 나무(절차 들판 없음) · 무예 원뿔·끌어당기기(그런 무예 없음, 회전베기는 둘레 그대로). 진단 `PlaytestDungeonHunt`(진짜 전투방·진짜 평타/강공격·진짜 Die), 옛 진단 둘(명소 보통 층·세 시대 전투 방)은 졸개를 빼고 셈. 다음 = 11번 칸 STORY 5-9 |
| 11 | STORY — 5-9 보스 패턴전 → 5-10 보스 고유 기술·그로기 → 5-11 관문 대장 고유 기술 | 사가스토리 5-9~5-11 | **11-1 보스 패턴전 완료(2026-09-27)** — 이 트랙 STORY 는 플레이어가 한 번도 안 맞는 판이라(체력 축 없음·적 반격 없음) **사용자 결정으로 플레이어 체력 신설**(`StoryPlayerHp`): 최대 = 웹 power() 60 + 통솔 15×6 + 레벨×12 + 전직 grow.hp(Lv.1 = 162) · 맞은 뒤 무적 0.7초(웹 HIT_COOL) · 탕약·치유 무예가 없어 5초 안 맞으면 초당 4% 회복 · 세이브 없음 · HUD 기력 앞 "❤ HP a/b". 때리는 건 두목 패턴뿐(잡졸은 그대로 반격 없음). 쓰러지면 들판 = 입구(2m)에서 일어서고 두목 태세 되돌림(체력 가득·1단계·부하 거둠·관문 대장 시계/방패), 비경 = 시간 초과와 같은 패퇴(재기 있으면 그 방 다시). 웹 동료 교대 onFall·주운 금 절반은 없는 축이라 뺌. **패턴**(`StoryBossPattern` 순수 + 두목마다 `StoryBossPatternRunner`, Play 때 붙음): 웹 수치 그대로 — 66%·33% 단계, 1단계 내려찍기(내 자리 원 1.6m 1.0초 ×1.3)·낙석(세 줄기 0.8m 1.1초 ×0.9, 옆 줄기 2.6~3.6m) → 2단계 + 지진(1.2초 ×1.2, 뛰었거나 발판·줄 위면 삶)·부하 둘(단계에 한 번, ±1.8m, 이 판 잡졸이라 반격 없음 — 비경이면 방 적으로 들어 다 쓰러뜨려야 방이 끝남) → 3단계 + 휩쓸기(1.8초, 안전지대 폭 3.4m 가 내 발에서 3~6.4m, 내 최대 체력 55%) · 광폭 피해 ×1.25·간격 ×0.7 · 간격 6.5/5.0/3.8초·첫 3.2초·포효 뒤 1.4초 · 같은 것 안 이음 · near = 가로 8.4m·발 높이차 1.4m(웹 420·70px). 거리는 이 판 척도 50px = 1m. 두목 한 대 힘 = 웹 (4 + lv×1.6)×2 인데 들판 두목은 레벨이 없어 **플레이어 레벨**을 lv 로(`StoryCombat.BossDmgFor`), 반올림은 웹 Math.round(.5 위로). 들판 두목은 등장 컷(106-8) 뒤부터, 비경 두목은 곧장. 관문 대장(이 판은 같은 두목의 주간 강화판)도 같은 패턴을 탄다 — 웹 관문 대장은 제 패턴(달려들기·내려찍기·소환)이 있어 빠지지만 이 판엔 그게 없어서. 웹 돌진("패턴 동안 돌진 미룸")은 이 판 두목에 돌진이 없어 해당 없음. 예고(`StoryBossWarnFx`, Sprites/Default 투명): 원 = 땅 원판 + 테두리(낙석은 그림자 기둥), 지진 = 판 전체 바닥 띠 일렁임 + "⬆ 점프!", 휩쓸기 = 안전지대 밖 붉은 막 + 초록 기둥 "안전", 터질 때 다가올수록 진함 · 판정 때 흔들림·자국, 예고 때 두목 공격 클립 · 알림(2단계·광폭·휩쓸기·부르기). 손잡이 `StoryBossPattern.Enabled`·`EnrageMul`. 진단 `PlaytestStoryBossPattern`(웹 항목 + 체력·실제 들판 루프·쓰러짐·비경 두목). **11-2 고유 기술·그로기 완료(2026-09-27)** — 웹 SIG 표 열둘을 그대로(`StoryBossPattern.Sigs`, 두목 id·이름·기술·종류, 글 ko/en) 옮기고 여섯 기술 판정·예고를 모두 지었다: 도넛(두목 곁 반지름 2m 만 삶 1.3초 ×1.1 — 판 전체 붉은 막 + 두목 곁 초록 "붙어라!") · 화살비(다섯 점 2.2m 간격 ±0.4m 흔들림 r 0.68 1.2초 ×0.8, 틈으로) · 쇠뇌(뛰었거나 발판 위면 맞음 1.1초 ×1.1 — 지진의 거꾸로, 머리 높이 1.9m 붉은 띠 "⬇ 뛰지 마라!") · 불기둥 두 박자(2.4m 칸 홀수 → 짝수, 반폭 1.2m, 1.0+0.8초 ×1.0, 불빛 기둥) · 쇠사슬(1.4초 3m/s 로 두목 쪽으로 끌림 — CharacterController.Move 라 벽이 막음, 둘레 2.6m 폭발 ×1.4) · 추적(보라 원이 1초 발을 따라오다 0.5초 멈춘 뒤 터짐 r 1.4m ×1.4). 고유 기술은 모든 단계 후보 끝에 끼고 등장 뒤 첫 기술은 늘 그것(플레이어가 쓰러져 두목이 태세를 되돌리면 다시), 걸 때 "⚔ 두목 — 기술명" 알림. **그로기**: 피해를 주는 패턴(부르기 제외, 불기둥 두 박자는 하나)을 셋 잇달아 피하면 5초 — 새 패턴 없음·받는 피해 ×1.5(`StoryEnemy.TakeDamage`, 관문 대장 방패 창과 곱함)·머리 위 "★★★ 그로기 N초"·알림, 끝나면 1초 안에 다시, 맞으면 셈 0. **이 트랙 다름**: 웹 사냥터 보스 여섯은 이 판 들판이 하나라 **황건 두목(도넛)만**, 비경 두목은 웹 비경 보스 그대로 **관문 수호장(추적)** 으로 이름도 바꿔 부른다(몸은 그대로). 나머지 기술(화살비·쇠뇌·불기둥·쇠사슬)은 11-3 관문 대장 다섯이 쓴다. 웹 그로기의 "걷기·박치기·돌진 없음"은 이 판 두목이 안 움직여 해당 없음. 진단 `PlaytestStoryBossPattern` 에 웹 §5-10 항목(표·첫 기술·도넛/쇠뇌·화살비/불기둥·쇠사슬/추적·그로기) + 실제 들판(도넛 첫 기술·그로기 ×1.5)·비경(관문 수호장 추적 따라옴·멈춤). **11-3 관문 대장 고유 기술 완료(2026-09-27) — 줄 11 끝** — 웹은 관문 대장 다섯을 마을 다섯에 하나씩 두지만 이 판 관문 대장은 "이번 주 미도전이면 들판 두목이 승격"(101-2 5-4) 한 자리라, **주마다 다섯이 돌아가며**(`StoryBossPattern.GateCaptains`·`GateCaptainIndex` = 주 번호 % 5: 산채 두령 돌팔매 소나기(화살비) · 왜구 선장 갈고리 끌어당김(쇠사슬) · 거란 도통 기마 화살 일제사(쇠뇌) · 몽골 만호장 만호 포위진(도넛) · 왜장 화승총 두 줄 사격(불기둥)) 승격한 두목이 그 이름·기술을 입는다 — 이름표·등장 컷 제목·알림이 그 이름(몸은 그대로). 웹 `stepSig` 그대로 고유 기술은 공용 후보에 안 끼고 제 시계로: 첫 4초·그 뒤 8초, 다른 패턴이 걸려 있으면 미룬다(그동안 시계도 멈춤), 첫 기술 강제 없음, 이름 없는 두목은 무반응, 그로기 같이. 웹 관문 대장의 "제 패턴"(달려들기·내려찍기·소환)은 이 판에 없어 **공용 패턴전(단계·부르기·휩쓸기·광폭)이 그 자리** — 웹 "단계·광폭 없이"와 다르다(11-1 결정 그대로). 방패·180초·보상은 101-2 5-4 그대로. 플레이어가 쓰러져 태세를 되돌리면 다시 4초. 진단 `PlaytestStoryBossPattern` 에 돌림(다섯·다섯 주 뒤 처음)·첫 4초·8초·공용 후보에 안 낌·미룸·무반응 + 실제 들판(공용 내려찍기 뒤로 미룬 갈고리가 끌고 15) · `PlaytestStoryBossIntro` 이름표 = 이번 주 관문 대장. 묶음 없는 PC 3연속 bossPattern·boss intro OK(슬라이스 끝은 기준선 FAIL — 묶음 PC 재확인) |
| 12 | FOREST — 5.9 떠돌이 방문객 → 5.10 새 손님·단골·몸짓 | 사가의숲 5.9·5.10 | **12-1 떠돌이 방문객 완료(2026-09-27)** — 웹 §5.9 손님 여섯(`ForestVisitors`, 키·이름·대사·시대 웹 그대로): 🦊 여우 화상 호연(신화, 오늘만 가구전 비싼 쪽 — 웹 값 1400 이상 — 하나를 ×1.5) · 🧭 난파 선원 풍랑(과거, 나침반 조각 다섯) · 👻 도깨비불 반디(신화, 몸 조각 다섯) · 🎣 낚시 명인 청파(과거) · 🦋 곤충 박사 나비(현대) · 🤖 시간 여행자 K-7(미래). 실제 날짜 해시(FNV)로 하루 한 명이 광장 (3, 2)에 선다(존 밖·물건 3m·집 5m·사람 길 2.5m·스폰 4m). **이 트랙 다름**: 금 대신 과일(웹 금 ÷ 100 — 가구 값과 같은 비: 보상 7~10, 여우 값 = 가구 과일 × 1.5) · 말 걸기 단추가 없어 다가서면(2.5m) 말하고 **물러났다(4m) 다시 오면 또**(웹 "한 번 더 말 걸면") · 가방이 없어 웹 "가방에서 가져간다"는 **만난 뒤 그날 그 갈래를 채집한 수**(`ForestCollectSpot` → `ForestVisitors.OnGather`, 다 모으면 알림) · 물고기·광석 갈래가 없어 낚시 명인 = 버섯 셋("미끼 궁리"), 시간 여행자 = 화석 둘 + 꽃 하나(대사도) · 웹 "바깥 숲 고리 다섯 자리"는 바깥 고리가 없어 **존 넷 안**(가운데서 4~10m, 조각 i = 존 (해시+i)%4 라 존마다 하나 이상, 서로 8m 넘게, 존 소품·채집 자리·명소·우체통·마을 물건에서 2.5m 밖) — 떠서 돌며 빛나고 1.6m 안에서 줍는다, 손님이 남은 방위(동~북동 여덟)를 알려 줌. 보상 가구 다섯(`FurnitureItem.VisitorGifts` 선장의 궤짝·도깨비 등롱·명인의 어탁·나비 표본 액자·시간의 탁상시계, 웹 값·새 세트 "잔치")은 가구전 룰렛에 없고 창고 → 빈 자리에 놓임(`TryPlaceAny` 가 둘 다 본다). 몸은 **다른 판 씬이 이미 쓰는 몸을 빌림**(여우 Arissa · 선원 Heraklios · 명인 Brady · 박사 Leonard · 여행자 XBot, 이 판 사람·숲지기와 안 겹침) — 묶음 없는 PC 라 `ForestBootstrap.visitorBodyNames/Models` 를 씬 YAML 에 손으로(GUID 는 GO TestVillage·DUNGEON TestDungeon 그대로), 빌더도 같은 표를 싣게. 도깨비불은 몸 없이 떠 흔들리는 푸른 빛 구슬 + 점광. 머리 위 이름표. 실행기 `ForestVisitorRunner`(부트스트랩이 Play 때 설치, 날이 바뀌면 다시 세움). 세이브 v8 `visit*`(날·손님·주운 조각·끝냄·권함·만남·가져오기 수, v7 이하는 기록 없음). 진단 `PlaytestForestVisitors`. **12-2 새 손님 둘·단골·몸짓·이웃 완료(2026-09-27) — 줄 12 끝** — 웹 §5.10·§5.11: ① 👺 도깨비 대장 두두(신화, 몸 = DUNGEON 층 주인 Demon — 뿔) — 존 넷 "흔들리는 덤불" 셋(초록 공 셋이 이따금 부르르)에 숨은 꼬마를 들추면 꼬마가 광장 대장 곁 앞줄에 **작게**(0.95m, 같은 몸) 서서 춤 → 셋 다면 과일 9·도깨비 방망이 탁자 · 👽 불시착 탐사원 루미(미래) — 부품 넷(청록 빛 상자) → 과일 11·별 지도 액자. **이 트랙 다름**: 루미는 이미 마을 사람(109-4 surveyor, 몸 Jennifer)이라 손님 날엔 **그 사람이 광장에 나오고 평소 자리에선 숨는다**(`Visitor.FolkId`, 눌러앉으면 늘) · 웹 §5.13 현대 손님 둘(택배 기사 달음·사진작가 찰나)도 이 트랙엔 마을 사람으로 이미 있어 손님 표에 안 넣음(손님 여덟). ② **단골**(웹 수치): 부탁을 마칠 때마다(여우는 사기) 정 +1, 셋 이상이면 마친 날 다시 다가서면 "벌써 N번째로구려… 눌러앉아도 되겠소?", 한 번 더 다가서면 눌러앉음(자리 여덟 `SettleSpots` — 광장 둘레 3~10m, 물건 3m·집 5m·존 소품 3m·사람 길 2.5m·서로 2m·스폰 4m, 걸을 수 없으면 찾는 웹 규칙 대신 손으로 박고 진단이 잰다). 눌러앉은 손님은 날마다 제자리, 제 손님 날엔 광장 한가운데 하나만. 하루 한 번 선물 과일 2~3(웹 금 200~300 ÷ 100), 그 뒤엔 눌러앉은 한마디. ③ **몸짓**: 5m 안이면 나를 돌아보고(아니면 수다 짝을 봄) 4m 안에서 4초마다 머리 위 👋 1초 — 이 판 몸은 대기 클립뿐이라 웹 interaction 클립 대신 글자 · 그날 부탁을 다 들어주면(꼬마는 늘) 깡충 0.25m + 초당 60° 천천히 돎. ④ **이웃(§5.11)**: 눌러앉은 손님 하나에 마을 평가 +6(`ForestTownScore.Total`, 평가판 셋째 줄 "이웃 손님 N명") · 광장에 둘 이상이면 날짜 해시로 한 쌍이 마주 보고 수다(웹 CHAT_OPEN·REPLY 여덟 — 낚시 명인 줄은 물 없는 숲에 맞게), 선물 뒤 다가서면 "(수다 중)" 그 대화. 가구 둘 더(잔치 세트). 빌린 몸 표에 Demon·Jennifer 두 줄 더(씬 YAML 손으로, GUID = TestDungeon lordModel·TestVillageForest surveyor). 세이브 v9(정·눌러앉은 손님·오늘 선물·물음, v8 이하는 단골 없음). 진단 `PlaytestForestVisitors` 에 웹 §5.10 항목(도깨비·탐사원 / 청함·눌러앉음·딴 날 선물 한 번 / 자리 여덟 / 손짓·춤 / 이웃 평가·수다) + 세이브 v9. 묶음 없는 PC 3연속 OK(오류는 기준선 둘) |
| 13 | REALM — 5-11 싸움터 땅 → 5-10 지도 위 실제 인물·모션 | 사가국지 5-11·5-10 | **13-1 싸움터 땅 완료(2026-09-28)** — 이 트랙엔 전투 장면이 없어(결과는 알림 한 줄) 출진하면 **그 성의 고정 싸움터로 3.6초 컷**(`RealmBattlefield`, 누르면 넘김): 웹 `battleLook` 표 그대로(`RealmBattleLook` — 땅 넷 평야·구릉·강가·산성 + 주 덮어쓰기 사막·초원·밀림·해안·균열·폐허·묘역, 바닥빛·하늘·가장자리 소품 6~8 순번 자리, 강가·해안 앞 물줄기), 쉰여덟 성의 땅·주는 웹 CITIES 에서 옮김(웹에 없는 정도 = 연주 평야) — 이 트랙 성에 쓰이는 결은 여섯. 그 위에 양군 머릿수 기둥(천 명당 하나, 한쪽 3~24, 장수 깃발)이 다가가 맞붙고 잃은 몫만큼 쓰러진 뒤 이긴 쪽이 나아가고 진 쪽이 물러난다 — 판정은 끝난 값을 그릴 뿐(`AttackResult` 에 양군 시작·남은 병력), 판정 `RealmLand` 는 그대로. 알림 첫 줄 "⚔ 소패 평야". 런타임에 지도 밖(4000,0,4000)에 원시 도형으로 짓고 제 카메라(깊이 50) — 씬 재빌드 없음. 웹 수전 물빛은 수전이 없어 뺌. 진단 `PlaytestRealmBattlefield`(슬라이스 세 시대 뒤) · **13-2 지도 위 인물·모션 코드분 완료(2026-09-28, 사용자 "13-2 코드분 먼저" — 이 PC 에 사실 몸 묶음이 없다)** — `RealmActorPlan`(순수 판: 태수 = 이 달 그 성에서 명령 낸 무장, 없으면 그 성의 통솔 높은 무장 · 몸짓 = 웹 `mapClips` 개간 괭이질·상업 흥정·훈련 칼 휘두름·등용 읍·축성 망치, 그 밖은 서기 · 재야 = 찾았지만 안 들인 사람이 제 성 둘레를 걷는다 · 상한 24 태수 먼저 · 손잡이 `Enabled`), 이 달 성별 명령은 `RealmCityState` 에 화면 층으로(세이브 없음, 달이 바뀌면 비움). 월드맵(`RealmMapActors`, 카메라 120~420m 라 말 크기 4m)·싸움터 두 장수(첫 합 공격 쪽 베기·지키는 쪽 맞음 → 둘째 합 이긴 쪽 베기·진 쪽 쓰러짐) — 인물은 **도형 대역**(`RealmFigure`, 몸통·머리·투구·팔 + 괭이·칼·망치·엽전, 동작은 시각으로 짠 코드 자세). 웹 ① 원정 행군 보간은 이 트랙 출진이 그 자리에서 끝나 뺐고 ⑤ 줌은 선택이라 뺐다. 진단 `PlaytestRealmActors`(슬라이스 개간 단계 + 세 시대 뒤). **13-2b 사실 몸 완료(2026-09-29)** — `RealmBodies`(씬 빌더가 채우는 몸 표: 무장 = Dreyar·CastleGuard02·Heraklios·Paladin, 재야 = PeasantMan·Brady·PeasantGirl·Kachujin·Eve, 주인공 Maria.controller 로 Humanoid 리타깃)가 있으면 `RealmFigure` 가 사실 몸으로 서고(키 배율·서기·걷기·베기·맞기·쓰러짐은 클립, 괭이질·흥정·읍·망치는 서기 위에 허리·팔 뼈를 몸 축으로 얹음·손에 든 것은 오른손 뼈), 표가 비었거나 몸이 Humanoid 가 아니면 도형 대역 그대로. 몸은 id 해시로 늘 같고 싸움터 두 장수는 같은 몸이 안 됨 |
| 14 | GO — 웹 ⑲(saga-godot 106 이식 순서표, 2026-09-25 추가)가 코드로 옮겨지면 그 줄마다 107 과 대조해 없는 것만 | 사가고 ⑲ | **대기 풀림(2026-09-28 대조 — 웹 ⑲ 1~46 코드분 완료)**, ⑲ 순서 하나 = 조각 하나(크면 쪼갬), 수치는 웹 ⑳ 이름·표. **14-1a 원소 일곱·반응 열셋 완료(2026-09-28, 웹 ⑲-1)** — `GoElements` 풍·빙·암·초(옛 셋 번호 그대로), 풍·암은 안 붙고 반응만(회오리·굳힘), 새 반응: 녹임 ×1.5 · 얼어붙음 2.5초(암·강공격·낙하 공격으로 깨뜨림 ×1.5 — 14-1a 땐 3타째, 14-2 에서 뗌) · 서리번개 5.5m ×0.5 + 8초 물리 ×1.4 · 회오리 7.4m 원소 옮김 ×0.6 · 굳힘(명단 보호막 최대 체력 20%·15초, 다 막으면 원소 효과도 막음) · 꽃피움 1.5초 뒤 씨앗 5.5m ×1.5 · 들불 0.5초 ×0.2 여덟 번 · 싹틈 8초(번개싹·덩굴뻗음 ×1.25) — 배수는 Godot 칸, 반지름 × 1.85, 옛 셋(물안개·터짐·물벼락)은 107 값 그대로, 이름은 웹 표시 이름. 방패 상성 일곱(암>풍·화>빙·초>암·풍>초), 바위 방패는 물리 ×1. 도감 인물 원소가 일곱 그대로(암 → 화 식으로 접던 107 을 풂 — 안내 한 줄, 세이브 `el7Noticed` 버전 그대로), **산적은 옛 셋 해시 그대로**(107 상자 퍼즐이 주인공 화 + 산적 수로 풀리게 짜여 있다 — 웹은 % 7). 새 원소 적에게 맞으면 휘말림(스킬 +2초)·한기(스태미나 3초 멈춤)·짓눌림(×0.3, 안 쓰러짐)·중독(1초 ×0.15 네 번, 화상 자리). ★5 속 방패는 누르는 원소가 없는 빙만 빙을 누르는 화. 새 원소 인물의 졸개는 옛 몸에 그 원소 방패("바람 졸개" 식 — 제 괴물은 14-1b). HUD 굳힘 줄. 진단 `PlaytestGoFieldCombat.CheckReactions7`. **14-1b = 새 원소 괴물 넷(회오리매·눈여우·바위곰·덩굴뱀)·무리 꼴 셋** — 몸이 필요해 묶음 PC 로 미룸. **14-2 강공격·낙하 공격 완료(2026-09-28, 웹 ⑲-2)** — J·공격 단추를 0.4초 넘게 누르면 강공격(스태미나 20·가까운 적 쪽 앞 넓게 5.9m 옆까지·×1.3 물리·콤보 처음부터, 누른 채로는 한 번), 모자라면 "스태미나 부족" · 활공 중 발밑 4.6m 넘을 때 공격 = 날개 접고 초당 55m 로 내리꽂아 착지 둘레 6.5m ×(1.2 + 떨어진 높이, 15m 까지) 물리 · 깨뜨림은 강공격·낙하만(3타째에서 뗌, Godot 와 같게). 화면 단추는 누르고 있기(`AttackHoldButton`, 강공격 뒤 뗀 클릭은 먹는다). 자동 전투는 이 트랙에 없어 뺐다. 진단 `CheckChargeAndPlunge`(실제 활공 → 내리꽂기 → 착지까지). **14-3 = ⑲-3 대조**: 상자(등급·석등·무리 잠금·보상)는 107-4 에 이미 있다(웹의 지역 칸마다 넷은 이 트랙 지도가 9×11 한 판이라 16 고정 그대로) → 없는 둘만. **14-3a 수집 구슬·봉헌 완료(2026-09-28)** — `GoOrbs`(순수): 지역 일곱 × 셋 = 21, 칸마다 ① 정상 둘레 산마루(윗면 +2.2m) ② 강물 위(수면 +0.6m, 헤엄쳐야) ③ 숲 높이(땅 +4.4m, 점프 꼭대기라야), 없으면 들판(+2.0m) — 지역 id 해시로 늘 같은 자리(산마루 4·강 3·나무 5·들판 9), 높이는 웹 × 1.85. 줍기 = 수평 3m + 발 기준 −0.5~+3.6m. 봉헌 = 불 올린 봉수대(이 트랙의 탑) 14m 안에서 저절로 — 둘마다 신상 +1단(최대 10) → 스태미나 상한 +8(100 → 180, `GoStamina.Max` 가 속성이 됨)·금 200·경험 20(웹 단사 2 대신). `GoOrbField`(WorldMapBuilder 가 Play 때 붙임, 빛 구슬 — 모델 없음, 땅에 레이로 앉힘). 세이브 **v19** `orbsGot`·`orbsGiven`(v18 은 빈 기록). 진단 `PlaytestGoOrbs`. **14-3b 원소 시야 완료(2026-09-28)** — `ElementalSight`(WorldMapBuilder 가 Play 때 붙임): V 를 누르는 동안(폰은 HUD "시야" 단추로 켜고 끔) 런타임 전역 Volume(채도 −70·노출 −0.6)이 0.2초에 올라오고 켜는 순간 83m 물결 고리, 0.25초마다 83m 안 짚기 빛기둥(안 연 상자 금빛·안 주운 구슬 하늘빛·꺼진 석등 제 원소 빛·못 켠 역참·못 오른 정상·안 밝힌 망루 흰빛·들판 적 원소 빛/맨몸 붉게 — 발광이 세서 잿빛 속에 빛깔이 남는다) + 148m 안 가장 가까운 상자·구슬 쪽 흔적 점(4m 간격·최대 14, 땅에 앉힘). 결투·등장 컷 중 꺼짐. 거리는 웹 45·80·2.2m × 1.85. 순수 규칙 `GoSight`, 진단 `PlaytestGoSight`. **⑲-3 줄 끝.** **14-4 무예 단계·깨달음 완료(2026-09-28, 웹 ⑲-4 + ⑳ 이름·수치)** — 107·109 엔 인물 육성이 없었다(승급 3택은 부대 레벨업마다). `GoTalent`·`TalentState`: 도감 동행마다 기본 공격·원소 스킬·원소 해방 무예 1~10(배율 1.0~1.98, 깨달음 ③ 이 스킬·해방 +2) + 깨달음 다섯(인연 매듭 하나씩 — ① 스킬 대기 −15% · ② 반응 피해 +20% · ③ 스킬·해방 +2단 · ④ 최대 체력 +15% · ⑤ 해방 뒤 8초 공격 +20%). 상한은 웹의 인물 승급 ★ 대신 **부대 레벨 1·5·10·15·20·25 → 3·4·5·7·9·10**(인물마다 승급이 없다). 값 = 금 + 쪽지/교본/비전(웹 그대로) — 단사는 이 판에 없어 뺐고 7 → 8 부터 드는 뇌룡 비늘(웹 ⑲-9 주간 보스)이 오기 전까지 7단이 끝. 주인공·도감 밖(산적)은 1단. 들판 피해: 기본(3타·강공격·낙하)·스킬(선·원·장판·소환)·해방이 제 무예 배율, 반응 조각은 안 타고 깨달음 ② 만. 얻는 곳: 상자(평범 쪽지 1·정교 쪽지 2·진귀 교본 2+매듭 1·화려 교본 3+비전 1+매듭 2)·방패 두른 원소 괴물 쓰러뜨림 쪽지 1·신상 봉헌 등급마다 매듭 1. 도감(B) 오른쪽 무예 칸(재료·세 줄 + 올리기 단추·깨달음 ◆◇ + 열기 단추, 런타임 UI). 세이브 **v20** `talents`·`talentMats`(v19 → 1단·0). 진단 `PlaytestGoTalent`. **14-5a 무기·치명타 완료(2026-09-28, 웹 ⑲-5 앞 절반 · ⑳ 이름·수치)** — `GoWeapons`·`WeaponState`: 종류 다섯(칼·대도·창·서책·활, 인물 id 해시 = 웹 `typeOf` 식 — 웹 표본 넷 일치, 주인공 칼), 제 종류만 든다. 기본 공격 모양은 웹 KIT 를 이 트랙 칼(옛 3타 0.8·0.9·1.3 · 0.33초 · 4.2m)에 맞춘 비(배율 타마다 · 빠르기 × 0.33/0.34 · 사거리 × 4.2/3.2) — 서책 9.2m 인물 원소로 하나, 활 18.4m 물리 하나, 대도 무거운 타격(깨뜨림). 무기 열다섯(웹 ⑳ 표, 수련용 ★1 다섯은 기본) · 공격 × 0.75(이 트랙 기본 공격력 60/웹 80) · Lv 1~30(벼림 0~5 → 상한 10~30) · 강화 = 강화석 1+⌊(n−1)/5⌋ + 금 15n · 벼림 = 금 250~1250(단사 뺌) · 울림 5(넘치면 강화석 10) · 옮기면 먼저 든 사람은 수련용. 치명타 = 기본 5%·50% + 무기 부옵션, 씨앗 고정 난수(mulberry32 20260824), 기본·강공격·낙하·스킬·장판·해방만 굴림(반응 조각·직접 맞히기는 안 굴림), 치명 글 금빛 크게. 공격 = (옛 공격 + 무기 공격) × (1 + 공격%) · 체력% · 기력 획득% · 효과(기본/스킬/해방/반응 피해). 얻는 곳: 상자 강화석 2·5·15·40 + 진귀 ★3·화려 ★4 무기(상자 id 해시로 종류) · 방패 두른 원소 괴물 강화석 1. 도감 왼쪽 무기 칸(강화·벼림·바꾸기). 세이브 **v21** `weapons`·`weaponEquip`·`weaponOre`. 진단 `PlaytestGoWeapons`(피해값을 딱 보는 진단들은 `CritOffForTest`). **14-5b 보패 완료(2026-09-28, 웹 ⑲-5 뒤 절반 · ⑳ 이름·수치)** — `GoArtifacts`·`ArtifactState`: 부위 다섯(패옥 체력·비녀 공격 고정 · 가락지 공격%/치명/치피 · 향낭 체력%/방어%/원소 일곱/물리 · 관모 공격%/체력%/방어%/기력), ★4·★5(최대 +12·+15, 부옵션 처음 2~3·3~4, 3단마다 넷 미만이면 새로·넷이면 하나 오름, 굴림 0.75·0.85·1.0), 주옵션·부옵션 곡선·칸 구성·세트 다섯(떠돌이 무사 공격 15%/칼·대도·창 기본 +30% · 대장간 불씨 화 12%/물안개·녹임·터짐·들불 +35% · 솔바람 피리 풍 12%/회오리 +50% · 봉화 깃발 기력 18%/해방 +20% · 나루 안개 수 12%/스킬 +25%)은 웹 ⑳ 그대로. 무작위는 번호 씨앗 mulberry32(20260824 + 번호 × 7919) — **웹과 같은 번호면 같은 보패**(진단이 웹 표본 넷 대조). 강화 = 연마석 ⌈0.6 × (n+1)⌉ + 금 × 12, 분해 = ★4 1·★5 2 + 들인 연마석 × 0.8, 가진 것 200 넘치면 안 낀 ★4 부터 분해. 값은 웹 그대로 들고 들판에 탈 때만 고정 공격 × 0.75 · 고정 체력 × 0.4(270/660) · 고정 방어 × 0.6(35/60). 공격 = ((기본 + 무기) × (1 + 공격%) + 고정) · 체력 = (기본 × (1 + 체력%) + 고정) × 깨달음 ④ · 방어는 나선 사람이 받는 피해에만(`ActiveDef`, 체력 상한은 보패 없는 방어로) · 피해 보너스는 웹 식 더하기(1 + 무기 효과 + 4 세트 + 원소 피해, `DmgMul`) · 반응 4 세트는 `SetReactMul`(나선 사람 몫). 얻는 곳: 상자 무늬 ★4 · 옻칠 ★5 · 금박 ★5 둘 · 방패 두른 원소 괴물 ★4(숨은 터·들판 보스는 그 순서까지 없음). 도감 닫기 단추 아래 보패 칸(가진 수·연마석·켜진 세트 / 고른 부위 옵션 · 부위 다섯 · 바꾸기(좋은 순, 끝 넘으면 빈 칸)·강화·빼기·안 낀 ★4 분해). 세이브 **v22** `artifacts`·`artifactSeq`·`artifactPolish`. 진단 `PlaytestGoArtifacts`. **⑲-5 줄 끝.** **14-6 채집·요리 완료(2026-09-28, 웹 ⑲-6)** — 51장 산나물(한 번 캐면 끝·금 8)은 그대로 두고 따로. `GoCooking`·`CookState`: 재료 아홉(박하·꿀꽃·산사과·송이버섯·바지락 · 특산 청하란·갯소라·재꽃 · 짐승 고기), 지역 일곱 → 웹 바이옴(마을 home · 서쪽 숲길·동쪽 숲 bamboo · 북쪽 산기슭 ruins · 너른 강 marsh(강에 닿은 뭍 칸, 물가로 밀어서) · 남쪽 공터 plain · 끝 논밭 canyon), 지역마다 **고정** 무리 일반 넷(웹 바이옴 표 앞 넷 — 이 판 지역은 웹 칸 1.2km 보다 작다) + 특산 둘(마을 하나), 무리마다 일반 2~3·특산 2 포기(지역 id 해시, 포기 105). 2.8m 안 저절로 줍기, 다시 자라기 일반 30분·특산 1시간(실제 시각, 세이브). 짐승 고기는 14-1b 짐승이 오기 전까지 **산적이 하나씩**. 솥 = 역참 다섯 곁 6.5m(돌 셋·불씨·가마솥 도형), 7.4m 안에서만 조리. 요리 여덟 × 품질 셋(이상한·보통·맛있는) — 바늘 1.6초 왕복, 맛있는 칸 ±0.07·보통 ±0.2, 다섯 번 하면 자동(보통). 먹기 = 가장 좋은 품질부터, 회복 셋(꿀꽃 떡 한 사람 = 비율 가장 낮은 사람 · 버섯 꼬치 명단 · 고기 찜 쓰러진 첫 사람, 포만감 35·최대 100·초당 −1) · 버프 다섯(공격 계열 공격 고정·치명·치피 / 방어 계열 방어 고정 / 모험 계열 스태미나 소모 −12~24%, 명단 전체 300초, 계열마다 하나 — 웹은 주인공엔 안 타지만 이 트랙은 주인공도). 값은 웹 그대로, 고정 공격 × 0.75 · 방어 × 0.6 · 회복 × 0.4. 스태미나 감소는 `GoStamina` 셋(회피·강공격·달리기·등반·활공·수영) 모두. 요리 창(`CookingUi`, G · "요리" 단추 — 솥 곁이거나 요리를 가졌을 때): 재료·켜진 효과·요리 여덟 줄(조리·자동·먹기) + 바늘 막대·불 끄기. 버프·포만감은 세이브 안 함(웹·Godot 같게). 웹의 승급 특산물(인물 승급)·눈꽃(서리봉 고원)은 이 트랙에 없어 뺐다. 세이브 **v23** `cookBag`·`cookProf`·`cookGather`. 진단 `PlaytestGoCooking`. **14-7 여정 등급·천하 등급 완료(2026-09-28, 웹 ⑲-7)** — `GoAdventure`·`AdventureState`: 여정 등급 = 부대 레벨 그대로(새 경험 체계 없음), 오를 때마다 금 100 × 등급 · 강화석 2 · 5 의 배수면 인연 매듭 1(한 번씩, 여러 단계면 모두 — 웹 부대 경험 40 × 등급은 인물 경험이 없어 뺐다). 천하 등급 0~8 = 여정 1·3·6·9·12·15·18·21·24(웹 그대로), 들판 적(무리·원소 괴물·들판 인물·졸개·수호장) 체력·방패 ×(1 + 0.35w) · 공격 ×(1 + 0.22w) — 지역 위험 배율(108)에 곱하고, 바뀌면 살아 있는 적도 다시 잰다(남은 체력 비율 그대로, `FieldEnemy.ApplyWorld`). 전리품 금 ×(1 + 0.25w) 는 이 트랙 처치 금이 수호장뿐이라 수호장 금에만. 한 단계 낮추기·되돌리기(들판 적이 쫓거나 예고하는 중엔 막음, 천하 0 은 못 낮춤) — 지도(M) 오른쪽 열 줄 + 단추. 웹의 단사 +1·머리 위 Lv 덧셈은 이 트랙에 없어 뺐고, HUD 에 천하를 붙이면 대사 줄과 겹쳐(배치 점검) 지도에만. 옛 진단은 `AdventureState.OffForTest`(천하 0·보상 없음)로 돈다. 세이브 **v24** `advLowered`·`advPaid`(v23 은 지금 레벨까지 받은 걸로 — 보상이 쏟아지지 않게). 진단 `PlaytestGoAdventure`. 같이: 배치 점검이 잡은 14-3b "시야" 단추 ↔ 조우 창 단추 겹침 — 시야 단추를 오른쪽으로(−405, 110 폭). **14-8 일일 의뢰 완료(2026-09-28, 웹 ⑲-8 — 새 판 없이 101-2 ④ 일과판을 넓힘)** — `DailyTaskState`: 풀 넷 → 여덟(새 후보 들판 적 8 · 원소 반응 6 · 채집 5 · 요리 2), 하루 셋 → **갈래 넷에서 하나씩 = 넷**(이 판 갈래: 걸음 = 걷기·성황당 기원 · 만남 = 도적 조우·희귀 늑대 · 싸움 = 들판 적·원소 반응 · 살림 = 채집·요리), 날 갈림 **새벽 4시**. 일과 하나를 채우면 그 일과 보상(웹 표 — 걷기 금 30·경험 60 · 도적 40·90 · 늑대 = 성채 60·120 · 성황당 = 비석 50·100 · 들판 적 50·100·강화석 1 · 반응 45·90·쪽지 1 · 채집 35·70 · 요리 40·80, 알림 줄). 넷을 다 한 날 역참(순간이동 돌기둥 7m 안)에 들르면 마무리 보상 한 번(금 150 · 강화석 2 · 인연 매듭 1 — 부대 경험 120 은 뺐다), 목표판 "이번 세션" 줄이 그때까지 역참 안내. 도장은 이 판 규칙 그대로(넷 다 한 날 하나·7 = 주간 — 웹은 일과마다 도장). 하루 셋이던 옛 세이브는 그날 진행만 비운다(길이가 달라). 옛 진단은 `DailyTaskState.OffForTest`(진행 무시)로 — 날짜마다 다른 일과 보상이 금·강화석 값에 끼지 않게. 세이브 **v25** `dailyBonus`. 진단 `PlaytestGoDaily`(옛 `CheckDailyTasks` 는 하루 넷으로). **14-9 숨은 터·원기·주간 보스 완료(2026-09-28, 웹 ⑲-9 · ⑳)** — 웹 ⑲-9 는 주간 보스만이 아니라 숨은 터 셋 + 원기 + 주간 보스 한 묶음이라 한 조각으로. `GoDomain`·`DomainState`·`DomainField`·`DomainUi`: 웹은 땅 열여섯마다 입구(종류 셋을 돌림)지만 이 판 지도는 작아 **종류마다 하나** — 산기슭 잠든 무덤(3.9,1.1, 보패) · 강가 옛 서당(4.6,4.2, 무예 책) · 논밭 쇠부리 터(3.6,9.0, 강화석) · 먹구름 제단(1.5,4.35 강가, 주간) — 들판 무리·역참·수호장에서 55m, 서로 80m 넘게(진단). 입구 = 돌기둥 둘 + 들보 + 종류 빛(기둥에 충돌), 제단 = 검은 단 + 비석 + 보랏빛 구슬. 11m 안에 서면 입구 카드(보상·터 기운·원기·단계 I·II·III = 여정 1·6·12, 체력 ×1·2·3.5 · 공격 ×1·1.5·2.2). 3초 뒤 파도 둘(주간 = 보스 하나), 120초(주간 180), 원판 **40m**(웹 55m 는 이 트랙 적 끈 45m 를 넘어 줄임), 원판 밖·시간·전멸(`FieldCombat.Wiped`)·물러나기면 실패(원기 안 씀). 적 = 옛 몸에 원소(14-1a 졸개 결 — 물두꺼비 = 물귀신 · 거북 = 암 물귀신 · 회오리매 = 풍 번개귀 · 덩굴 = 초 물귀신 · 섬영마·날쌘용 = 번개귀 · 멧돼지 = 산적), 지역 위험 2 고정 × 단계, **천하 등급·경험·전리품·일과·무리 기록 없고 다시 안 서며, 원판 안에선 끝까지 쫓는다**(`FieldEnemy.DomainFoe`). 터 기운: 무덤 4초마다 물 · 서당 쓰러뜨리면 명단 기력 +13(웹 8/60 → 100) · 쇠부리 적 공격 ×1.3. 다 쓰러뜨리면 가운데 보상 나무 → 원기 15(주간 45, 이번 주 처음 둘 25) 로 받기(보상 표 웹 그대로 — 무덤 보패 ★4·★5·연마석 · 서당 쪽지·교본·비전 · 쇠부리 강화석 · 주간 금·교본/비전·**뇌룡 비늘**(무예 7 → 8~10)·매듭·★5 보패, 세트는 받은 수로 번갈이, 부대 경험은 뺐다). 주간 보스 먹구름 이무기 = 번개귀(해골 몸 × 2.2 크기) 체력 4400(들판 적 220 × 20) · 공격 44 · 내리치기 8.1m · 예고 1.2초 · 간격 3.5초, 체력 절반에서 뇌 방패(최대 체력 10%)·간격 ×0.69. 원기 상한 120 · 실제 시각 10분에 1(처음·옛 세이브는 가득), 주 = 월요일 새벽 4시. 도전 중엔 왼쪽 미니맵 위 한 줄(단계·파도·남은 초·보스 체력·방패) + 물러나기, 나무 7.4m 안이면 받기 카드. 진행 중 도전은 세이브 안 함. 세이브 **v26** `resin`·`resinT`·`domainClaims`·`weeklyWeek`·`weeklyN`. 진단 `PlaytestGoDomain`. **14-10 들판 보스 완료(2026-09-28, 웹 ⑲-10)** — 웹도 새 보스 없이 지역 수호자가 들판 보스라, 이 트랙은 **망루 수호장(107-7)** 이 들판 보스. `GuardianState` 에 꽃(`Bloom`)·받은 시각(`PaidAt`)·`Standing`(안 쓰러뜨렸거나 받고 150초), `GuardianBloom`: 쓰러뜨린 자리에 보상 꽃(겉 원소 뇌 빛, 도형), 5.6m 안(웹 3m × 1.85)이면 카드 — 원기 30(14-9)을 써서 받기: ★4 보패 1 · 금 100 × 지역 위험(3) × 천하 전리품 배율, 모자라면 꽃이 남는다. 받으면 150초 뒤 수호장이 다시 선다(늘 세워 두고 서 있을 때가 아니면 첫 틱에 꺼짐 → 이 컴포넌트가 켜고 되살림). 다시 쓰러뜨리면 토벌 금·경험 없이 꽃만(첫 토벌만 `MarkDefeated` 가 true). **웹 보스 재료(인물 승급 ★2~5 용)·부대 경험은 뺐다** — 이 트랙은 무예 상한이 부대 레벨이라(14-4) 인물 승급이 없다(요리 승급 특산물·단사와 같은 결정). 세이브 **v27** `guardianBloom`·`guardianPaidAt`(v26 은 쓰러뜨렸으면 꽃이 핀 것으로). 진단 `PlaytestGoFieldBoss`. **14-11 고유·갈래 스킬 완료(2026-09-28, 웹 ⑲-11)** — 109-8 은 기질로 모양(무 = 돌진 · 덕 = 찌르기 · 통 = 소환 · 지 = 장판/소환)이었고, 웹 ⑲-11 은 지략만 ⑫ 모양으로 두고 나머지를 한 벌(스킬 + 해방)로 바꿈 → `GoKits`(표·순수): **고유 다섯**(주인공 불꽃 돌진/불새 깃 · 팔괘진/천기 뇌우 · 일제 포격/학날개 진 · 결사 방진/오천의 맹세 · 화살비/돌개 화살 — id 는 웹과 같다), **갈래** 무용 돌격(돌진)/검기(원소 부여) · 통솔 호령(늦게 떨어지는 탄)/군기(명단 공격 ×1.15) · 인덕 방패(명단 보호막 = 굳힘 칸)/맹세(받는 피해 ×0.8), 원소 덧붙임 일곱(웹 그대로). 지략·도감 밖은 null → 109-8 모양·해방 기본. 척도: 거리 × 1.85 · 스킬 배율 × 1.8/2.2 · 해방 배율 × 4/4.5 · 기력 × 100/60, 스킬 대기는 한 벌 값(옛 6초 고정 대신). `FieldCombat`: `KitSkillCast`(돌진·탄·방패·진)·`KitBurstCast`(원소 부여·군기·맹세·빠름·소용돌이)·명단 효과 시각·탄·진/소용돌이(`SkillShape.KitZone`·`Vortex`, `FieldEnemy.PullToward`), 원소 부여는 기본·강공격·낙하에. HUD 스킬 단추·도감 상세 한 줄(갈래·스킬·해방 이름). 웹 이야기 동료(story_*) 한 벌은 이 트랙에 동료가 없어 뺐다. 세이브 없음. 옛 진단은 `GoKits.OffForTest`(웹 손잡이 `field.kits` 0 과 같다). 진단 `PlaytestGoKits`. **14-12 이야기 임무 1~2장 완료(2026-09-28, 웹 ⑲-12 · 정본 대사 saga-godot `story.gd`)** — 이 트랙 이야기 0장이라 1부 처음부터. `GoStory`(표)·`StoryState`·`StoryField`·`StoryUi`: 인물 셋 · 1장 여덟 단계(talk·go·boss·talk·kill·talk·light·talk, 여정 1) · 2장 넷(talk·go·domain·talk, 여정 5). **자리 대응**(시나리오 트랙 메모의 대응표): 청하 마을 → 마을 들판, **누리 = 옛 마을 촌장(1,3)** 을 그대로(몸·혼잣말은 VS 촌장) · 대숲 고을 탑·수호자 → 남쪽 공터 옛 망루 발치(3.1,7.05)·**망루 수호장**(이 판 들판 보스는 하나) · 갈대 나루 → 너른 강 북쪽 물가 버들(2.35,4.4, 먹구름 제단 곁) · 옛 성터 언덕 → 북쪽 산기슭 동굴 어귀 은비(3.35,1.4)·임무 적(4.45,1.3)·옛 제단(3.0,1.1) — 대사는 원문, 땅 이름만 바꿈. 버들·은비 몸은 옛 마을 사람(촌장 사내 몸·상인 여인 몸)을 빌린다(사람 NPC 공방 몸 교체 때 같이 바뀜). 거리: 대화 5m · go 20m · light 원소 신호 원 + 2.5m(원소 안 봄 — 옛 제단은 석등 몸, 켜면 불이 남음) · kill 60m 안이면 번개귀 둘·불도깨비 둘(`sq:장_단계`, `FieldEnemy.StoryFoe` — 선 지역 위험도, 경험·전리품·일과 없고 다시 안 섬) · 혼잣말 10m·45초. boss 는 수호장이 이미 안 서 있으면(꽃 대기) 바로 넘김, domain 은 먹구름 제단 깸(`DomainField.Cleared` — 보상 나무가 자랄 때). 장 끝 보상 1장 금 500·교본 2·매듭 2 · 2장 금 1000·비전 1·매듭 3 — **웹 부대 경험(단계 10·장 끝 300/500)은 뺐다**(14-7·14-8·14-10 과 같은 결정). 화면: 목표 금빛 기둥(30m) · 추적 줄(위에서 284 — 대사 자막·지역 사명 줄 밑, 누르거나 O = 목록) · 곁이면 "누리와 이야기 (F)" 단추 → 대화 창(한 줄씩, 고르는 줄은 단추 둘·F = 첫째), 창이 열린 동안 들판 전투 입력·적이 멎음(`StoryState.Talking`), 숨은 터 도전·결투·등장 컷 중엔 안 열림. 대사·표시 글 59 짝 한·영 표. 세이브 **v28** `storyCh`·`storyStep`(임무 적·제단 불은 저장 안 함, v27 → 1장 처음). 옛 진단은 `StoryState.OffForTest`. 진단 `PlaytestGoStory`. 밖으로: 은비 합류(웹 ⑲-15)·몸짓·카메라(웹 ⑲-13), VS "도적의 습격"을 1장 kill 로 흡수하는 것(시나리오 메모)은 VS 진단이 그 퀘스트를 보고 있어 보류. **14-13 이야기 3·4장·따라가기·대화 연출 완료(2026-09-28, 웹 ⑲-13)** — 단계 셋 더: gather(그 채집물 n 번, `CookState.Picked` — 기둥은 가장 가까운 자란 포기) · cook(아무 요리 하나, `CookState.Cooked` — 기둥은 가장 가까운 역참 솥) · follow(인물이 길을 걷는다 — 12m 안이면 초당 2.6m, 멀면 선다, 30m 넘으면 추적 줄 "너무 멀어졌다", 길 끝이면 넘김 — 걸은 거리는 저장 안 함). 3장(여정 7 · 금 1250·교본 2·비전 1·매듭 3): 누리 → 청하란 셋 → 요리 → 버들 → **불도깨비 우두머리**(끝 논밭 3.0,9.35 — 웹 가마골 수호자, 이 판 수호자는 망루 하나라 kill 단계의 이야기 보스로 새로 세움: 불도깨비 몸 ×1.8·체력 ×6·공격 ×1.5 + 졸개 둘, `FieldEnemy.MakeStoryBoss`) → 은비 → 산기슭 잠든 무덤 깨기(domain 단계가 숨은 터 id 를 고름) → 잔치 마당(마을 역참 서쪽 들 2.3,2.3) 불도깨비 셋·번개귀 → 누리. 4장(여정 10 · 금 1500·교본 2·비전 2·매듭 3): 누리 → **가면 쓴 나그네**(남쪽 다리 북쪽 머리 3.0,4.45 — 옛 나그네 궁수 몸 + 검은 탈, 둘째~여섯째 단계에만 선다) → 따라가기(다리 → 산 벽 길목 → 남쪽 공터 서쪽 2.55,7.2, 약 140m) → 나그네 → 가면 졸개(2.3,7.45 — 불도깨비 둘·빙 물귀신·암 물귀신, 웹 눈여우·바위곰은 14-1b 전까지 옛 몸에 원소) → 나그네 → 은비 → 누리. 대화 연출: 글이 초당 30자로 흘러나옴(F·다음 한 번 = 줄 전체, 한 번 더 = 다음 줄) · 고른 대답이 "나"의 줄로 한 번 · 말하는 인물이 나를 봄 · **대화 카메라**(`CameraRig.BeginTalkShot` — 말하는 이 쪽 어깨 너머 25°·거리 5.5·내려다봄 15°, 드래그 멈춤, 닫으면 원래 각도·거리). 웹 표정(줄 셋째 칸)·입 움직임·손짓은 얼굴 틀·몸짓 동작이 없어 뺐다(사람 NPC 공방 몸 교체 뒤 다시 볼 것). 나그네 영어는 옛 VS 나그네와 같은 Traveler(용어 흔들림 0). 글 70 짝. 세이브 없음(v28 그대로). 진단 `PlaytestGoStory` 넓힘. **14-14 이야기 5·6장·석등 차례·봉우리·검은 가면 완료(2026-09-28, 웹 ⑲-14)** — 단계 셋 더: seal(둘째 제단 둘레 8m 석등 셋 — 북쪽부터 시계 방향 달·별·해, 비문 차례 해·달·별, 원소 신호에 걸린 가장 가까운 꺼진 석등 하나만, 틀리면 모두 꺼짐 — 켠 수 저장 안 함, 석등 빛깔 해 = 화·달 = 빙·별 = 암 + 머리 위 이름) · climb(그 봉우리 윗면에 서기, `GoWorldMap.StandsOn`) · duel(이야기 보스 — 체력 절반에서 뇌 방패 최대 체력 12% + 불도깨비 졸개 둘, 보스를 쓰러뜨리면 넘김). 인물 칸 `At`(늘 서되 그 칸 동안 옮겨 섬 — 은비), 칸이 길 위(`Path`)·고원 위(`Peak`)일 수 있다. **5장**(여정 12 · 금 1750·교본 3·비전 2·매듭 3, 솔숲 고개 → **서쪽 숲길**): 누리 → 옛길 어귀(0.35,3.0) → 은비를 에워싼 졸개(불도깨비 둘·초 물귀신·풍 번개귀) → 은비(옛길 −0.1,2.85) → 둘째 제단(숲길 북쪽 끝 0.0,2.05) 석등 차례 → 제단 무리 다섯 → 나그네 → 은비 → 누리. **6장**(여정 15 · 금 2000·교본 3·비전 2·매듭 4): 은비 → **봉우리 (6,7)** 꼭대기(안쪽 산 칸 가운데 오르기 가장 쉬운 곳 — 고원 14.3m + 봉우리 13.5m, 남쪽 공터 동쪽. 웹은 고향 북쪽이지만 이 판 북쪽 봉우리는 전부 경계 산(고원 30~38m)) → 고원 위 나그네 → **검은 가면**(산적 몸 + 검은 탈, 체력 ×8·공격 ×1.9 — 공격 차례 그림자 걸음·침·근접·내려찍기·그림자 걸음·근접, `FieldEnemy.BossMove`·`MoveSpec` = 웹 ROT × 1.85: 그림자 25.9m 에서 내 등 뒤 4.1m 로 건너뛰어 제 둘레 5.9m ×1.4 · 침 16.7m 내 발밑 4.4m · 내려찍기 7m 제 둘레 7.8m ×1.2, 설 수 없는 자리면 제자리) → 나그네 → 셋째 제단(고원 위) 불 → 은비(고원) → 누리. 결투 자리는 봉우리 윗면(반지름 5m)이 좁아 **그 산 칸 고원**(48m) 위 — 봉우리 밑동에서 18m 넘게, 칸 가장자리에서 3m 안쪽(진단). 들판 적은 산 칸에 못 서지만 **고원에서 선 이야기 적은 제 칸 안(봉우리 밑동 밖)만** 움직인다(`FieldEnemy.CanStep`). 웹 합류(5장 나그네·6장 누리 동료)는 웹 ⑲-15·17 순서로. 글 74 짝. 세이브 없음. 진단 `PlaytestGoStory` 넓힘. **14-15 이야기 동료 둘·고유 스킬·편성 완료(2026-09-28, 웹 ⑲-15)** — 이야기 동료 = `GoHeroes.Story`(도감 밖 id, `HeroEra.Story` — 도감 수 105 그대로, `TryGet` 이 함께 찾는다, 들판 인물로는 안 선다): **은비**(`story_scholar` ★4·초·지략·서책·무 55 지 92 통 70, 2장 끝) · **가면 쓴 나그네**(`story_wanderer` ★5·빙·무용·칼·90/75/72, 5장 끝 — `GoStory.Chapter.Join`). 합류 = 동행 맨 뒤(= 들판 둘째 자리, 등용과 같게) + 장 끝 알림 글 "… 합류", 합류가 생기기 전에 그 장을 끝낸 세이브는 불러올 때 조용히(`StoryState.CatchUpJoins`, 두 번 불러도 한 명). 무기 종류는 해시 대신 표(서책·칼). **고유 스킬**(웹 kits.js 값, 이 트랙 척도 — 거리 × 1.85 · 스킬 ×1.8/2.2 · 해방 ×4/4.5 · 기력 ×100/60): 은비 E 비문 탁본(옛 장판 틀 그대로 — 발밑 8.3m 9초, 1.5초마다 적 넷까지 ×0.7, 맞힐 때마다 명단 기력 +2.5, 대기 10) / Q 옛 글자 풀이(새 `Lore` — 13.9m ×2.8 + 12초 명단 원소 반응 피해 ×1.4, `FieldCombat.LoreLeft`) · 나그네 E 그림자 걸음(새 `Blink` — 18.5m 안 가까운 적을 지나 그 뒤 2.8m 로 **건너뛰기**(돌진이 적 몸에 막혀서) · 무적 · 도착 둘레 4.6m ×3.2 · 그 적에 8초 표식 = 누구에게든 받는 피해 ×1.25(`FieldEnemy.Mark`, 쓰러지면 사라짐), 뒤가 물·높이 차 3m 넘으면 적 앞, 적이 없으면 앞 7.4m, 대기 8) / Q 가면 벗기(새 `Echo` — 11.1m ×3.4 + 27.8m 안 표식 난 적마다 0.3초 간격 메아리 셋 ×1.5 — 그 적을 따라가 친다, 표식 난 적이 없으면 가까운 둘). **편성**: 이 트랙 들판 명단은 주인공 + 동행 순서의 뒤 셋이라 **순서가 곧 편성**(`PartyState.FieldIds` — 세이브 칸 새로 없음): 들판에 넣기(둘째 자리로, 가장 오래 선 셋째가 빠짐) · 빼기(맨 앞으로 — 동행 넷 이상일 때만) · ◀ 앞 자리로 · 싸우는 중(`WorldMapUi.Fighting`)엔 막음. 도감(B) 다섯째 탭 "이야기 동료 n/2"(안 들어온 동료는 그림자 칸 + "N장 끝에 합류") · 상세 줄 "들판 n째 자리/대기" · 무기 칸 아래 편성 단추 둘. 웹 동행 다섯 제한·대기 하나는 이 트랙 동행 명단이 등용 전부라 뺐다. 몸은 도감 몸 배정(`GoHeroLooks`)에 없어 폴백 — 묶음 PC 의 사람 NPC 몸 교체 때 은비 = 상인 여인 몸·나그네 = 나그네 궁수 몸으로. 글 18 짝. 세이브 없음. 진단 `PlaytestGoStoryAllies`(옛 `PlaytestGoHeroDex` 는 탭 다섯). **14-16 이야기 7장·제단 지키기·금 간 검은 가면 완료(2026-09-28, 웹 ⑲-16)** — **7장**(여정 18 · 금 2250·교본 3·비전 2·매듭 4): 은비 → 버들 → 곶 → 나그네 → **넷째 제단 지키기** → **금 간 검은 가면** → 나그네 → 넷째 제단 불 → 버들(곶에 노 저어 옴) → 누리. 곶 = 강 북쪽 물가 마을 동쪽 끝(5.35,4.45) — 이 판 강은 곧은 띠라 곶이 없어 물결을 강 쪽 빼고 다섯 방향(서·북서·북·북동·동)에서 오게 했다. **defend**: 30m 안에 오면 첫 물결 — 제단 둘레 20m(웹 15m × 1.35)에서 물결 셋(불도깨비 둘·물귀신 / + 번개귀 / 불도깨비 둘·암·빙 물귀신 — 웹 두꺼비·날쌘용·바위곰·눈여우, 14-1b 전까지), 다 잡았거나 28초면 다음, 셋 다 잡으면 넘김 · 무리는 제단으로 곧장(`FieldEnemy.SetSiege` — 내가 9.25m 안이면 나를, 아니면 제단을 친다, 제단을 노린 한 대는 나를 안 친다, 끈·포기 거리 없음) · 제단 체력 45 × 산적 공격 26 × 지역 위험 배율 · 절반에 경고 · 무너지거나 전멸하면 무리가 흩어지고 4초 쉰 뒤 처음부터(저장 안 함) · 추적 줄 " · 넷째 제단 n% · 물결 w/3". 제단 몸은 지키기부터 선다(light 단계 `AltarFrom`). **금 간 검은 가면**: 체력 ×9.2·공격 ×2.0, 금 간 탈, 공격 차례 밀물·그림자·근접·밀물·내려찍기·그림자 — **밀물**(`BossMove.Tide`, 웹 ROT × 1.85: 20.4m 에서 나 쪽으로 원 넷 반지름 3.7m·4.6m 부터 5.55m 간격 ×1.3, 원 하나라도 들면 맞음), 2단계 물 방패(번개로 깬다) + 불도깨비·물귀신 졸개, 나올 때·2단계·쓰러질 때 글. 결투 단계에 2단계 원소·졸개·글 칸(`Step.P2El`·`Adds`·`EnterKo`…). **14-14 회귀 고침**: `StoryField.Refresh` 가 kill 이 아닌 단계의 임무 적을 치워 **6장 검은 가면이 0.5초마다 치워졌다 다시 섰다**(진단이 그 사이 한 박자를 안 돌려 놓침) — 결투·지키기 무리도 남기고, 진단에 "한 박자 뒤에도 같은 보스"를 더함. 웹 7장 끝 사공 합류는 웹 ⑲-17 순서로. 글 51 짝. 세이브 없음. 진단 `PlaytestGoStory` 넓힘. **14-17 촌장·사공 동료 완료(2026-09-28, 웹 ⑲-17)** — `GoHeroes.Story` 에 둘 더(도감 105 그대로): **누리**(★4·풍·서책·인덕, 6장 끝) · **버들**(★4·수·창·무용, 7장 끝) — 합류 대사는 14-14·16 에 이미 있었고 `Chapter.Join` 만 더함, 옛 세이브는 `CatchUpJoins` 가 조용히. 고유 스킬 넷(웹 값 × 거리 1.85·스킬 1.8/2.2·해방 4/4.5): 부채 바람(`KitSkillType.Gust` — 앞 11.1m 부채꼴 내적 0.2 이상 ×2.3, 나에게서 먼 쪽으로 13m 밀어냄, 명단 모두 체력 6%, 대기 8) · 잔칫날 순풍(`KitBurstType.Feast` — 둘레 ×2.5 + 10초 바람 자리 반지름 11.1m `SkillShape.Feast`, 첫 틱 1초 뒤·1초마다 안에 선 지금 인물 5% 회복·안의 적 풍 ×0.5) · 노 물결(`Wave` — 앞 16.7m·폭 3.7m ×2.9, 앞으로 11.1m 밀어냄·나는 제자리, 대기 9) · 뱃노래(`Rain` — 둘레 ×2.3 + 15초 동안 누가 나서든 기본·강·낙하 공격이 맞으면 1초에 한 번 14.8m 안 가까운 둘에 물 노 ×0.85 — 값·원소·치명은 놓은 사람 것으로 굳힘). **밀려남**(`FieldEnemy.KnockBack` — 0.25초 고르게 미끄러짐, 멎어 있거나 얼어 있어도, 산·물 칸 앞에서 멎음) — 수호장·주간 보스·이야기 보스·굴복한 인물은 안 밀림(웹 보스 제외). 웹 효과 상태 줄("뱃노래 n초")은 웹도 뒤로 넘겨 뺐다. 몸은 도감 몸 배정 밖이라 폴백(14-15 둘과 같이 묶음 PC 의 사람 NPC 몸 교체 때). 글 8 짝. 세이브 없음. 진단 `PlaytestGoStoryAllies` 넓힘(옛 `PlaytestGoHeroDex` 이야기 칸 4). **14-18 편성 1~4·싸우는 중 막기 완료(2026-09-28, 웹 ⑲-18)** — 웹 칸 = 동행 다섯(들판 넷 + 대기)이지만 이 트랙 들판은 "동행 순서의 뒤 셋"(14-15)이라 **칸 = 들판 셋 순서**(`PartyState.Presets` 넷): 지금 들판이 늘 정본 — 지금 칸은 읽을 때마다 `FieldIds` 로 적힘 · 다른 칸을 고르면 그 셋(가진 동행만·겹침 뺌)을 순서 맨 뒤로 옮김(모자라면 남은 자리는 원래 뒤 사람) · **빈 칸은 지금 들판을 베껴 시작**(웹은 "나 혼자" — 이 트랙엔 비운 들판이 없다) · 같은 칸 무시 · 바꾸면 주인공이 앞(`RebuildParty(lead)`). **싸우는 중**(`FieldCombat.InCombat` — 웹 `inCombat`): 방금 3초 안에 맞히거나(`FieldEnemy.TakeHit` → `MarkFought`) 맞았거나, 55.5m(웹 30m × 1.85) 안에 쫓기·예고·숨 고르기 중인 적(제단만 치는 적은 곁 9.25m 밖이면 뺌) — 편성 넣기·빼기·앞 자리로·칸 바꾸기 모두(`FormationBusy`), 옛 `WorldMapUi.Fighting`(천하 등급·숨은 터)은 그대로. **UI** 도감 닫기 왼쪽 "편성 n / m명·빈 칸" 단추 넷(지금 칸 금빛). **세이브** `partyPresets`(칸마다 id 쉼표)·`partyPreset` — 버전 그대로(옛 세이브 = 빈 칸 넷·1번 = 지금 들판). 웹 밖(칸 이름·숫자키)은 이 트랙도 뺌. 글 5 짝. 진단 `PlaytestGoPresets`. **14-19 이야기 8장·바위섬·도둑 쫓기·배 완료(2026-09-28, 웹 ⑲-19)** — **8장**(여정 20 · 금 2500·교본 3·비전 3·매듭 4, 12단계): 누리 → 버들 → **chase** 노 도둑 → 버들 → **sail** 섬으로 → 섬 무리 넷(불도깨비 둘·물귀신·번개귀 — 웹 두꺼비·매) → 나그네(참이름 해솔) → **석등 별·달·해**(`Step.Order`, 석등 틀을 seal 단계마다 한 벌로 일반화 — 5장 둘째 제단·8장 섬) → 해솔 → 나그네 → **sail** 나루로 → 누리. **바위섬**: 웹은 곶 둘레에서 이웃 물이 가장 많은 뭍 칸이지만 이 판 강은 곧은 띠 하나라 그런 칸이 없다 → 곶 동남쪽 강 칸 한가운데(6.4,5.0)에 반지름 12m 둥근 바위섬을 Play 때 짓는다(`StoryField.BuildIsle` — 돌 원통 + 풀 윗면 + 가장자리 바위 셋, 윗면 0.1m, `MeshCollider`) · 섬 위 이야기 적은 섬 안에서만 걷고(`FieldEnemy.CanStep` → `GoStory.OnIsle`) · 헤엄쳐 가장자리 2.5m 안에 오면 섬 위로 올린다(물속 돌 벽엔 턱이 없다 — 쓰러져 마을로 돌아간 뒤에도 닿게). **chase**: 웹 13m/초·쉼 0.5·출발 14m·잡기 2.5m(걷기 8·달리기 17.6 사이) → 이 판 걷기 6·달리기 10 사이로 9m/초·0.5초·12m·2.5m, 길 점 여덟(강가 나루 동쪽 물가 → 북쪽 들, **되돌아오지 않는 길** — 웹 고리 길은 걷는 이가 지름길로 가로챌 수 있다), 평균 8.0m/초, 잡기를 먼저 보고 길 끝이면 처음 자리로, 추적 줄 "노 도둑 n m — 달려라!"·"(가까이 가면 달아난다)", 자리는 `StoryState.ChasePos`(저장 안 함). **sail**: 대화 끝(`StoryUi.Next`)에 곧장 그 자리로(섬 북쪽 물가 · 강가 나루 사공 곁) + 알림 — 웹 키보드 판 순간이동과 같은 결. 인물 둘: 노 도둑(쫓기 단계만, 역참 나무꾼 몸)·검은 가면 해솔(섬 한 단계, 역참 파수꾼 몸 + 금 간 가면) — 몸은 `FolkBuilder.BodyModel` 을 빌림, 버들은 섬 5~10째·나그네 7~10째. 웹 밖(섬 곁 탑 켜짐·배 모델·섬 높이)은 여기도 뺌. 글 57 짝. 세이브 없음. 진단 `PlaytestGoStory` 넓힘(7장 끝 = 8장 잠김). **14-20 이야기 9장·구름섬·바람 기둥·먹구름 임금·해솔 합류 완료(2026-09-28, 웹 ⑲-20)** — **9장**(여정 25 · 금 2750·교본 3·비전 4·매듭 5, 12단계, 1부 끝): 은비 → 봉우리 꼭대기(6장 봉우리, 알림은 단계 `EnterKo`) → 정상 나그네(`Spot.Summit`) → **sky**(구름섬 윗면에 서면) → 섬 무리 넷(회오리매 = 풍 번개귀·번개귀 둘·불도깨비) → **먹구름 가면 해솔**(금 간 가면, 체력 ×10.4·공격 ×2.1 — 웹 13·2.1 을 14-16 비 0.8 로, 그림자·침·밀물·근접·내려찍기·그림자, 2단계 뇌 방패 + 풍 번개귀·번개귀) → 가면 벗은 해솔(`Spot.Unmask`·이름·혼잣말 덮기) → **먹구름 임금**(×13.6·×2.3·몸 ×2.0·왕관·어두운 금빛 눈, 내려찍기·**고리**·침·근접·그림자·밀물·고리, 2단계 뇌 방패 + 불도깨비·번개귀) → 나그네·해솔 → 해솔 → go 마을 → 누리, 끝에 **해솔 합류**(★5 뇌 대도, E 먹구름 벼락 = 탄 셋 12m·2.4m·×2.3 · Q 가면 없는 노래 = 뇌 부여 10초 ×1.2 — 있는 틀). **구름섬**: 이 판은 진짜 3D 활공이라 웹 층(onSky) 흉내 대신 **실제 발판** — 6장 봉우리 정상에서 서쪽 36m·위로 54m(웹 북쪽 27m·40m × 1.35, 이 판 북쪽 하늘엔 옆 봉우리 (6,6)이 솟아 위에서 쏘는 광선이 걸려 서쪽 숲 칸 위로), 반지름 19m, 돌 원통 + 거꾸로 선 바위 뿔 + 풀 + **난간 1.6m 토막 스물넷**(걸어 오르는 턱 1.1m 보다 높고 점프 2.4m 보다 낮음, `NoClimb`) + 북쪽 돌 단, 9장 전엔 먹구름 덮개(검은 구름 덩이). 섬 둘은 `StoryField.Awake` 에서 짓는다(불러온 섬 위 자리에서 안 떨어지게). **바람 기둥**(`PlayerController.DraftOn` — `StoryField` 가 켬): 정상 반지름 4.7m · 섬 윗면 + 12m 까지 초당 9m, 공중이면 저절로 활공·기력 안 씀·땅에선 안 뜸·기둥 안에서 접으면 나갈 때까지 안 폄, 흰 고리 여덟이 솟는 그림. **층**(웹 `apart`): `GoStory.SameLayer` — 섬 층(윗면 8m 아래·난간 3m 밖까지)과 땅이 다르면 들판 적이 못 보고 쫓던 적은 제자리로(`ForceReturn`), `FieldCombat` 도 층이 다른 적은 못 친다 · 구름섬 이야기 적은 난간 안에서만 걷는다(`CanStep`). **고리**(`BossMove.Halo`): 웹 3~9m × 1.85 = 안쪽 5.55m 빈 원 ~ 16.65m, 예고 1.3초 ×1.5, 안쪽 테(`HaloRing`). 웹 밖(대결 보스 겹침 띄우기·들판 적 184m 검사)은 여기도 뺌. 글 56 짝. 세이브 없음. 진단 `PlaytestGoStory` 넓힘(8장 끝 = 9장 잠김·섬이 봉우리·망루 위가 아님). **14-21 세계 임무 셋·따라가는 줄 완료(2026-09-28, 웹 ⑲-21)** — 표 `GoWorldQuests`(웹 worldquest.js 대사 그대로, 땅 이름만 이 판 — 갈대 나루 = 강가 나루·옛 성터 = 북쪽 산기슭) · 인물 일곱은 `GoStory.Npcs`(wq_*, `Spot.Wq` = 그 임무 단계 동안만, 시대 글자 `EraKo`) · 상태 `WorldQuestState`(단계·끝남). **따라가는 줄**(`StoryState.Track` −1 이야기 / 0~2 임무): `Current`·`Advance`·`LineKey`(= "장_단계" · "wqN_단계")가 그 줄을 따르고 임무 적 키·석등·제단 불이 줄 열쇠로 묶인다(`StoryField` 제단·석등 틀을 이야기 장 + 임무 전부로 일반화) — 바꾸면 그 단계 처음부터(무리·물결 치움), 임무가 끝나면 보상·이야기로. **말 걸기**(`StoryUi.NearestTalk`): 5m 안 이야기 대화·맡을 임무의 맡길 사람·맡은 임무의 다음 대화 상대 중 가장 가까운 것(같으면 따라가는 줄) — 말을 걸면 그 줄을 따라가고 맡을 것이면 맡는다. **푸른 !**(맡을 것 밝게·안 따라가는 임무의 다음 상대 흐리게) · 대화 단추에 시대 글자 · 추적 줄 🔷 · O 목록(끝난 장은 한 줄로 줄이고 지금 장·다음 장 + 세계 임무 칸, 창 높이 640) + **따라가기 단추 넷**. 쫓기는 인물의 `RunPath` 로 일반화(노 도둑·둥실이, 알림은 단계 칸). 둥실이 = 떠 있는 배달 기계(원시 도형 — 웹 드론 몸). 임무: ① 바람에 흩어진 편지(여정 3, 금 600·교본 2·매듭 1 — 묵호 → 다래 → 둥실이 쫓기(마을 북쪽 들을 동쪽으로 곧게, 평균 7.9m/초) → 둥실이 → 서쪽 숲 언덕 둥지(풍 번개귀 둘·산적) → 묵호) ② 세 시절의 등대(여정 8, 750·교본 3·매듭 1 — 물결 → 동쪽 물가 끝 옛 등대 터(곶과 바위섬 사이, 동쪽 숲 무리와 45m) → 한빛 → 무리 → 봉수대 원소 불 → 물결) ③ 성터의 시간 틈(여정 12, 900·교본 3·비전 2·매듭 1 — 별이 → 틈 괴물(동쪽) → 별이 → 돌쇠(서쪽) → 석등 달·해·별 → 제단 지키기 물결 둘 → 돌쇠 → 별이). 괴물은 몸 다섯에 원소(14-1b 전까지). 세이브 `wqSteps`·`wqDone`·`wqTrack`(버전 그대로). 웹 부대 경험은 이 트랙에 없어 뺌, 지도·미니맵 표식은 웹도 ⑲-23. 글 112 짝(옛 `story.chase_track` 은 인물 이름 칸 `story.chase_track2` 로). 진단 `PlaytestGoWorldQuests`. **14-22 활 조준 사격·과녁 잠금 완료(2026-09-28, 웹 ⑲-22)** — 웹 2.5D 옮김을 그대로(Godot 의 세로 조준·지형 가림은 웹처럼 뺌): 활 인물만 **R**(HUD 🎯 — 회피 위, 활일 때만), 제자리(`PlayerController.MoveLocked` — 방향 입력은 `AimInput` 으로 넘겨 겨눈 쪽을 초당 2.4 라디안 돌림, 점프면 풀고 뜀) · 카메라 어깨 너머(`CameraRig.SetAim` — 거리 4.8·피치 8°·오른쪽 1.3m, 끄면 원래대로) · 겨눈 쪽 ±0.16 라디안·74m(웹 40m × 1.85) 안 같은 층의 적·상자 과녁·상자 석등·이야기 석등/옛 제단(`StoryField.AimPoints`)에 저절로 잠김(금빛 고리, ◎ 금빛). 누르는 동안 충전 1.4초 · 화살 초속 111m·사거리 83m(× 1.85) — 적이면 따라가 박히고, 점 과녁은 그 자리에서 멈춤 · 다 차면 인물 원소 ×1.25, 덜 차면 물리 ×0.45(원소 부여면 그 원소) · **급소** = 다 찬 화살이 쫓기·예고·숨 고르기가 아닌 적에 박히면 반드시 치명("급소!") · 맞히면 기력 +2·뱃노래 따라 치기 · 충전 화살이 멈춘 자리 2.2m 원소 신호(석등·제단을 멀리서 켬). 조준 밖에서 활 인물이 길게(0.4초) 누르면 강공격 대신 조준·충전 → 떼면 쏘고 나옴. 회피·점프·다른 인물·대화면 풀림. **과녁 잠금**(`GoTreasure.Lock.Targets`, 상자 잠금 넷째): 웹은 고향 밖 무늬 상자 절반이지만 이 판 무늬 상자는 높은 곳 자리이고 들이 다 차 있어 **옻칠 상자 하나를 봉우리 없는 산 (1,8) 고원 위에**(상자 17 · 옻칠 4) — 과녁 셋(기둥 + 붉은 눈 판)이 12·16·20m(웹 9·12·15 × 1.35), 2.1 라디안씩 · 화살(충전 무관)·서책/활 기본 공격(둘레에 적이 없으면 사거리 안 가장 가까운 과녁)이 맞히면 10초 금빛, 셋이 함께 빛나면 풀림 · 기척 보기에 안 맞힌 과녁 흰 점. 세이브 없음. 글 6 짝. 진단 `PlaytestGoAim`(옛 `PlaytestGoTreasure` 상자 수 17). 14-23 지도 임무 표식(웹 ⑲-23, 월드맵만 — 이 트랙엔 미니맵이 없다) 끝 · **14-24 낚시 완료(2026-09-29, 웹 ⑲-24)** — 규칙·물고기 여덟(과거·현대·미래)·입질·줄다리기 수치 웹 그대로(`GoFishing`·`FishingFlow` — 웹 m × 1.85, 시간·수치 그대로) · **낚시터 넷은 강 북쪽 둑**(남쪽은 산 절벽이라 딛는 땅이 없다 — 서는 자리 = 둑에서 2.5m 안쪽 땅, 물은 +Z 쪽 강 칸 `~`, 다리 칸 `B` 는 물 아님): 서쪽 둑(gx 1, 강 물고기)·다리목(gx 2.3, 갯물고기 + 게시판)·시간 틈 물목(gx 4, 갯물고기)·동쪽 둑(gx 5, 강 물고기), 낚시터마다 물고기 다섯(웹 표 그대로), 잡은 자리는 30분 뒤 다시 · 미끼 = 요리 재료 꿀꽃·산사과·짐승 고기(`CookState.Spend` 공개) · `FishingField`(도형만: 서는 자리 푸른 원반·물고기 그림자·찌·줄·고리·게시판 판자, 겨누는 동안 걸음을 잠그고 `MoveLocked` 방향 입력이 고리를 옮김·점프하면 끝) · `FishingUi`(위 오른쪽 "낚시"·"게시판" 단추 — 곁에서만 · 아래 가운데 낚시 칸 = 미끼 셋·◀ 가까이 멀리 ▶·던지기/당기기 큰 단추(누른 채 줄다리기)·그만 · 줄다리기 막대 · 게시판 창; 키 F 던지기·당기기·게시판 / T 미끼 / Esc 그만) · 낚시 중엔 `FieldCombat.CanAct` 가 막히고 `StoryUi` F 가 비킴 · 조합 여섯(갯바람 작살 `w_polearm_catch` ★4 창 atk 41·기력 9%·폭발 18%(무기 표 16), 금 800 둘·쪽지 2·강화석 3·매듭 1) · 세이브 `fishBag`·`fishLog`·`fishGone`(버전 그대로) · 월드맵 낚시터 "~ 이름" 넷(마을 들판 = 시작 땅이라 처음부터 보임). 웹 부대 경험은 이 트랙에 없어 뺌 · 소리 없음. 글 59 짝. 진단 `PlaytestGoFishing`(`PlaytestHeadless` 가 지도 표식 뒤에 부름) · 배치 점검 `UiLayoutCheck` GO 상태 셋 추가(낚시 칸·줄다리기·게시판). **14-25 업적 완료(2026-09-29, 웹 ⑲-25)** — 다섯 갈래(세상 곳곳·싸움의 길·원소의 이치·살림살이·이야기)·업적 22·단계 63(웹 표 순서·이름·보상 그대로: 첫 단 금 300 · 둘째 금 600·무예 쪽지 2 · 셋째 무예 교본 2·강화석 3, 어려운 셋(지역 평정·반응 도감·이야기 따라)은 매듭 1 더 — `GoAchieve`·`AchieveState`). 셈 = 상태에서 읽는 것(상자 `GoTreasure.OpenedCount`·구슬·오른 정상·봉헌 등급·끝낸 사명·물고기 기록·이야기 장·세계 임무·여정 등급) + 신호(`AchieveState.Bump`/`Reaction` — `FieldEnemy` 처치·큰 적·원소 괴물·반응, `FieldCombat` 급소, `DomainField` 숨은 터, `CookState` 채집·요리·맛있는 요리). 웹 탑·탐험도는 이 트랙에 없어 정상(28)·봉헌 등급·사명 지역으로 바꾸고 단계 값은 이 트랙 최대치 안(상자 17·정상 5/14/28). `AchieveUi`: Y 또는 위 오른쪽 "업적 ●N", 탭 다섯·줄(별·진척·막대·다음 보상)·받기·모두 받기, 0.5초마다 새 단계 알림(불러온 뒤 첫 확인은 조용). 세이브 `achStats`·`achKinds`·`achGot`(버전 그대로). 글 60 짝. 진단 `PlaytestGoAchieve` · `UiLayoutCheck` GO 상태 "업적 창". **14-26 탐사 파견 완료(2026-09-29, 웹 ⑲-26)** — 규칙 웹 그대로(`GoDispatch`·`DispatchState`): 시간 4·8·12·20시간(이 기기 실제 시각 `CookState.Now` — 꺼 둔 동안도 흐름) × 배율 1·1.8·2.5·3.8(반올림·최소 1) · 자리 = 여정 등급 1·1·5·10·15 이상인 칸 수(2~5) · 탐사지 하나에 한 명 · 잘 맞는 원소(`GoElements.ForMember` = 탐사지 원소)면 +25%(올림) · 부르면 보상 없이 돌아옴 · 받기·모두 받기. 동료 = 도감 인물 중 **들판 명단(`PartyState.FieldIds`) 밖**이고 안 나간 이 — 나간 동료는 `PartyState.ToField`·`Pick`(편성 고르기)이 못 넣음. 탐사지 여덟은 웹 이름·설명·시대·원소·보상 그대로, 땅만 이 판 지역(마을 들판 둘 = 늘 열림 · 너른 강 둘 · 남쪽 공터 둘 · 북쪽 산기슭 둘 — 그 지역을 밟아야 열림), 웹 서리봉 특산 눈꽃은 청하란으로, 단사 = 연마석(`ArtifactState.AddPolish`). 게시판 = 역참 다섯 곁 솥 반대편 서쪽 6.5m·반경 7.4m(웹 3.5·4m × 1.85, `DispatchField` 도형: 기둥 둘·판·지도 종이). `DispatchUi`: 곁이면 위 오른쪽 "탐사"(끝난 게 있으면 ●N)·F(이야기·낚시가 먼저), 창 = ◀▶ 동료·◀▶ 시간 + 탐사지 여덟 줄(상태·보상 미리보기, 잘 맞으면 ★) + 보내기/부르기·받기·모두 받기, 게시판 곁에서만 보내고 받음. 알림 1초마다(불러온 직후 모아 한 줄). 세이브 `dispOut`·`dispDone`(버전 그대로). 글 49 짝. 진단 `PlaytestGoDispatch` · `UiLayoutCheck` GO 상태 "탐사 창". 인물별 탐사 특성·게시판 전용 모델은 밖. **다음 = 14-27 (웹 ⑲-27 서리봉 고원 — 넷째 지역)** |
| **D. 계속 맞추기** | 웹 PLAN §5 에 새 절이 생기면 이 표 C 끝에 줄을 더한다(세션 시작 때 웹 다섯 PLAN §5 목차를 이 표와 대조). | | 상시 |

# 110. 상용화 — 내놓을 수 있는 게임으로 (2026-09-26 사용자 결정)

사용자: 진행도·"상용화 급인지 확인" 뒤 **"상용화"**. 2026-09-26 점검: 실행 파일을 한 번도 안 만들었고(빌드 씬 `TestVillage` 하나), 확인은 헤드리스 로직뿐, 사실 몸(Mixamo 수십 벌)은 git 밖이라 PC마다 다른 게임, UI 는 옛 `UI.Text`+기본 폰트 29 파일(TextMeshPro 0)·세로 1080×1920 기준, 타이틀·메뉴·판 고르기 없음(씬 이름 `Test*`), 영어 번역 검수 전. **109 표(기능 이식)는 이 장이 끝나거나 사용자가 돌려놓을 때까지 멈춘다**(다음 조각 10-5 는 설계만 — 옛 VS 적엔 위험도 안 곱함·우두머리 몸은 다른 판 몸 빌림). **2026-09-27 사용자: 기계 몫 끝난 뒤 109 재개**(남은 사람 칸은 이 표에 그대로).

- **규칙**: 한 세션 = 아래 한 줄(크면 첫 조각). 줄 끝 = 그 줄의 "끝 조건" + 커밋·푸시 + 상태 갱신. 그래픽은 안 깎는다(최적화 = 안 보이는 낭비만). 사람 몫(폰에 깔아 보기·스토어 계정·서명 키 보관)은 막힌 칸에 적고 묻는다.
- 빌드 도구: `Editor/SagaPlayerBuild.cs` — `-executeMethod Saga.EditorTools.SagaPlayerBuild.BuildWindows` / `.BuildAndroid`, 결과물 `Build/<대상>/`(gitignore) + `build_report.txt`(결과·크기·시간·오류·큰 에셋 스물).

| 순서 | 무엇 | 끝 조건 | 상태 |
|---|---|---|---|
| 1 | **실제 빌드** — Windows 실행 파일 → Android APK, 다섯 판 씬 | 두 대상 다 빌드 성공, 빌드에서만 나는 오류(에디터 전용 코드·빠진 셰이더) 0, 크기·큰 에셋 기록 | **완료(2026-09-26)** — 빌드에서만 나는 오류 하나: 다섯 판 사운드가 PC 에 없는 `Handheld.Vibrate` 를 조건 없이 불렀다 → `#if UNITY_ANDROID \|\| UNITY_IOS`. Windows 852MB·9.4분·오류 0(화면 없이 85초 켜 예외 0) · Android APK 470.7MB(압축 전 1.85GB)·8.7분·오류 0. 큰 에셋: PC 는 Mixamo 몸 텍스처(장당 5.3MB), 폰은 BGM·fbx. 빌드가 건드린 설정(URP 에셋 직렬화·batching·preloadedAssets)은 되돌렸고, 성능 테스트 패키지 부산물 `Assets/Resources/PerformanceTestRun*` 은 빌드 스크립트가 치운다. 켜면 첫 씬 GO 만 뜨고 판을 옮길 길이 없다 → 흐름을 2로 당김 |
| 2 | **흐름** — 타이틀 → 판 고르기(다섯) → 이어하기/새로 → 설정·나가기, 판에서 타이틀로 돌아가기(새 UI 는 처음부터 TextMeshPro) | 빌드를 켜서 다섯 판을 다 오가고 저장이 이어짐 | **완료(2026-09-26)** — 빌드 0번 `Title`(`Editor/BuildTitleScene`, UI 는 Play 때 `Games/SagaTitle/TitleScreen`): "SAGA" · 카드 다섯(판 이름·한 줄 — 원작 이름 안 씀·저장 있음/처음) · 이어하기/새로 시작(저장 있으면 확인 창) · 게임 종료(iOS 숨김) · 버전, 가로는 카드 한 줄·세로 폰은 다섯 줄. 판 부트스트랩이 세이브를 읽은 뒤 `SagaCore.SagaFlow.Enter(판, 저장)` → **자동 저장**(타이틀로·앱이 뒤로 갈 때·끌 때 — 예전엔 저장 버튼뿐) · **일시정지 메뉴**(Esc = 안드로이드 뒤로 가기: 계속하기·저장·타이틀로·게임 종료, 시간 멈춤). "새로 시작"은 이번 실행에 이미 들어갔던 판이면 앱을 켤 때 떠 둔 기본값을 적용해 메모리 정적 상태까지 되돌린다 — 그래서 다섯 판 세이브를 `ToJson`/`ApplyJson`/`HasSave`/`DeleteSave` 로 나눴다(파일 형식·버전 그대로). 새 UI 는 TextMeshPro + Noto Sans KR(OFL, 동적 SDF, `Editor/SetupSagaFonts`) — 공통 도구 `SagaCore.SagaUi`(가로 1920×1080 기준·반반 맞춤). 빌드 씬 목록은 `SagaPlayerBuild.Scenes` 한 곳(에디터 목록도 맞춤). 진단 `PlaytestSagaFlow`(진짜 버튼으로 다섯 판 두 바퀴·새로 시작 되돌리기·일시정지·자동 저장, 3연속). 남음: 타이틀 설정(언어·음량 공통)과 눈에 보이는 일시정지 단추(iOS 는 뒤로 가기가 없다)는 ⑤ UI |
| 3 | **폰 성능·발열** — 개발 APK(화면 fps·메모리 표시)를 폰에 깔아 판마다 fps·발열·메모리 | 판마다 30fps 유지 여부 기록, 넘는 판은 안 보이는 낭비부터 | **3a 측정 도구 완료(2026-09-26)** — `SagaCore/SagaPerf.cs`, 측정용 빌드에만(`SAGA_PERF`, `SagaPlayerBuild.BuildAndroidPerf` → `Build/Android/SAGA-perf.apk` 479MB·릴리스 IL2CPP — 개발 빌드는 스크립트가 느려 fps 를 낮게 잰다): 화면 아래 한 줄(fps·ms·1% 낮은·배터리 온도 BATTERY_CHANGED·발열 단계 PowerManager API 29+·메모리) · 씬마다 기록 `perf_log.json`(판·구간·초·평균·1% 낮은·최장 프레임·최고 온도·발열·메모리, 200줄) · 타이틀 **자동 측정**(다섯 판 × 몸풀기 10초 → 상한 30초 → 상한 풀고 15초, 세이브 안 건드림) · **성능 기록**표. 진단 `PlaytestSagaPerf` 3연속. **3b 대기(사람 몫)**: 폰에 설치 → 자동 측정 → 판마다 5분 놀기 → 기록표 사진(`HOW_TO_PLAYTEST` §10). 그동안 ④ 를 먼저 한다 |
| 4 | **빌드 재현성** — git 밖 사실 몸·스캔을 어느 PC 에서나 같은 결과로(받기 스크립트 한 방 + 빠지면 빌드를 막는 검사) | 새 클론 → 한 방 → 같은 빌드, 폴백 도형이 빌드에 섞이면 실패 | **완료(2026-09-26)** — git 밖은 사실 몸 폴더 하나뿐(4.2GB·1520파일, 스캔은 이미 커밋). 커밋된 씬·컨트롤러가 그 폴더 `.meta` GUID 를 물어 **Mixamo 다시 받기로는 같은 빌드가 안 된다** → 폴더를 통째로 나른다: `tools/realistic-pack.sh` `manifest`(해시 목록 `tools/realistic/manifest.sha256` 커밋)·`pack <보관함>`(목록 순서 tar, 1900MB 조각, 이름 = 목록 해시 12자)·`fetch <보관함>`(.utmp 에 풀어 대조 → 제자리, 한 방)·`verify`. 보관함 = 비공개 — 원본은 구글 드라이브 `gdrive:saga-assets`(`push`·`pull`, rclone md5 대조), 로컬 자리 기본 `~/saga-assets`(2026-09-28 사용자 결정, 전엔 OneDrive). 빌드 문지기 `Editor/SagaAssetGate.cs`(빌드마다 먼저, 걸리면 빌드 안 함): ① 폴더 = 목록 ② 빌드가 쓰는 그 폴더 파일 ⊂ 목록 ③ `build_deps.txt`(쓰던 몸 576) 가 줄면 = 씬이 몸 없이 지어진 폴백 ④ 빌드 씬·텍스트 의존의 끊긴 GUID 0. 빌드마다 지문 `<이름>_assets.txt`(에셋 전부·바이트). **시험**: 새 클론(몸 없음) → 검사 FAIL exit 1(① 1520·③ 576·④ 컨트롤러·씬 21) · fetch 33초 → 가져오기+검사 OK+빌드 11분 → 이 PC 빌드와 파일 181 같음·크기 863.0MB 같음·지문 3916 중 3줄만 다름(glb 둘 = 원본·meta 같고 이 PC 옛 가져오기 캐시, TMP 셰이더 24B). 도중 발견: autocrlf 가 클론의 텍스트 에셋(현지화 JSON)을 CRLF 로 풀어 빌드가 달라짐 → `saga-unity/.gitattributes`(json·txt LF, 목록 바이트 그대로), 이 PC 78파일 LF 로 다시 꺼냄. 묶음 cb71a2102fd9 을 OneDrive 에 둠 |
| 5 | **UI** — 남은 `UI.Text` 를 TextMeshPro + 한글 폰트(오픈 라이선스)로 · 가로/세로 둘 다 맞는 캔버스 · 판별 HUD 정리 | `UI.Text` 0, 16:9·20:9·4:3 에서 겹침 0(배치 점검 도구) | **5a 글자 완료(2026-09-26)** — 스크립트 70개 기계 치환(문자열·주석 밖만: `Text`→`TextMeshProUGUI`·`TextAnchor`→`TextAlignmentOptions`·`FontStyle`→`FontStyles`·넘침 두 줄→`textWrappingMode`/`overflowMode`·`supportRichText`→`richText`·옛 글꼴 대입 줄 삭제 — TMP 기본 글꼴이 Noto Sans KR) + asmdef 셋(GO·DUNGEON·FOREST)에 `Unity.TextMeshPro` · 줄 간격은 배수→em/100(1.1→+10) · uGUI `Outline`/`Shadow` 7곳은 TMP 에 안 먹어 `SagaCore/TmpEffect`(글꼴 재질 복사·SDF 테두리/밑그림자·같은 설정은 재질 공유, 플레이 때만 입힘) · **월드 글자 `TextMesh` 7곳**(피해 숫자·이름표·줍기 글·층 표지 — 내장 글꼴이라 폰에서 한글 □)도 `SagaCore/SagaWorldText`(TMP 3D, 크기 = 옛 fontSize×characterSize). 씬 다섯 + LayoutWalk 재빌드 한 방 `Editor/SagaRebuildScenes.RebuildAll`(끝에 씬·프리팹의 옛 Text 를 GUID 로 세어 0 아니면 FAIL) → **옛 Text 251 → 0**(DUNGEON 은 옛 지도 다섯 칸이 굳어 있던 5개가 빠짐). 진단 헤드리스 18종 3연속 OK. 남음: LayoutWalk·CharCompare(빌드 밖)의 TextMesh · **5b 배치 점검 완료(2026-09-26)** — `Editor/UiLayoutCheck`(타이틀·다섯 판을 플레이로 켜 첫 화면 HUD 를 16:9·20:9·4:3 마다, 잴 때만 루트 캔버스를 월드 공간으로 돌려 스케일러 식 그대로의 논리 크기를 입힘 · 발자국 = 사각형 / TMP 는 보이는 글자 잉크 상자(textBounds 는 줄 높이 1.45em 라 과함) · 위젯 = 캔버스·꽉 찬 투명 틀 바로 밑 덩어리, 위젯 안 겹침·모달·릴리스에 안 뜨는 DebugHud 는 뺌 · `Logs/ui_layout_report.txt` 에 16:9 위젯 자리표). 첫 측정 **234건** — 원인: 판 HUD 캔버스가 세로 1080×1920·폭 맞춤이라 가로에서 논리 높이 607(16:9)·486(20:9). **결정: 폰도 가로 고정**(자동 회전에서 세로 둘 끔 — 액션 판 셋이 가로 전제, 되돌리려면 이 줄) · 판 HUD 기준을 한 곳 `SagaUi.GameReference` 1600×900·**Expand**(16:9 = 1600×900, 20:9 = 2000×900, 4:3 = 1600×1200 — 크기는 원래 세로 설계의 실제 크기와 비슷) · `SagaUi.ApplyGameScaler` 를 빌더 23곳·런타임·판 설정 다섯의 UI 크기가 부름(설정의 UI 크기가 타이틀·일시정지 메뉴 캔버스까지 세로 기준으로 덮던 것도 `MenuCanvas` 표시로 막음) · 메뉴 캔버스도 Expand → **47건**. 손 배치: GO 교체 명단 오른쪽 가운데 → 왼쪽 가운데 · DUNGEON 미니맵 오른쪽 기둥 → 왼쪽 파티 줄 밑, 설정 → 윗줄 저장 왼쪽 · STORY 버튼 160→128·다섯 줄 → 네 줄(무예는 기술 칸 줄 왼쪽 끝), 설정 → 윗줄, 상태 글 폭 600→480 · REALM 오른쪽 세로 줄 위로 30 넘침 → 20 아래서·간격 112 · 타이틀 제목·부제 간격 → **0건**. 남음: 첫 화면만 잰다(패널·팝업·나중에 켜지는 버튼 — 예: GO 폭발) · **5c-1 일시정지 단추·타이틀 설정 완료(2026-09-26)** — `SagaFlow` 가 판에 들어올 때 **Ⅱ 단추**(`SagaPauseButton`, 판 HUD 와 같은 1600×900 기준 오른쪽 위에서 386·30 안쪽 80×80 = 다섯 판 공통 설정·저장 줄 왼쪽 빈칸, 막대 둘 그림이라 글꼴 무관, 컷 HUD 숨기기에 같이 숨음) · 타이틀 **설정**(`Games/SagaTitle/TitleSettings`): 언어·전체 음량(0/25/50/75/100%)·배경음·효과음·진동(폰만)을 다섯 판 공개 설정 API 로 한꺼번에 — 판 설정 키(PlayerPrefs)는 판마다 따로 그대로, 서로 다르면 "판마다 다름"·누르면 사가고 값의 다음 칸으로 맞춤. UI 크기·그래픽은 판 설정에만. 공통 UI 언어 `SagaUi.Lang`(타이틀이 사가고 언어에서 읽어 적음) — 타이틀·일시정지 메뉴가 두 언어(판 이름 영문 Saga GO·Sagablo·Saga Forest·Saga Story·Saga Realm). 도중 발견: 흐름·성능 진단 러너가 `MoveNext()` 하나라 `yield return WaitTitle()` 같은 중첩 대기가 한 틱으로 흘러 **기다리지도 그 안을 검사하지도 않았다** → `Editor/NestedCoroutine`(스택으로 펼침). 진단 `PlaytestSagaFlow`(타이틀 설정 진짜 단추·언어 ko→en→ko 다시 짓기·섞인 음량·배경음/효과음·Ⅱ 단추로 일시정지, 판 설정은 떠 뒀다 되돌림) 3연속 · 배치 점검 0건 · **5c-2a 패널 배치 완료(2026-09-26)** — `UiLayoutCheck` 가 첫 화면 뒤 보이는 단추를 하나씩 눌러(타이틀은 설정만) 새로 뜬 그래픽 셋 이상 = 패널을 세 화면비로 잰다(단위 = 단추·단추 밖 글자, 판·띠·아이콘 그림은 뺌, 스크롤 마스크 밖은 자름, 움직이는 표지는 `SagaCore/LayoutFree`) · 닫기는 닫기·확인 류 단추 → 일시정지 메뉴 → 연 단추 다시. 첫 측정 패널 20 **391건** → 0: 타이틀 설정(앵커 = 기준점이라 줄 이름·값 단추가 파고듦) · 판 설정 다섯(마지막 줄 ↔ 닫기, 국지는 판 920 > 화면 900 → 860) · GO 지도(860×1051 가운데 → 높이 820 왼쪽 + 글·닫기 오른쪽 열) · DUNGEON 비결(판 1080 → 860, 줄 260 → 166) · STORY 무예(900×1600 세로 판 → 1500×860 가로, 무예 줄 두 열) · REALM 명령(다섯째 줄이 판 밖 → 판 720·간격 96) · **REALM 성 목록 = 첫 스크롤**(한 줄씩 쌓여 끝판 58성이면 화면 밖 → `ScrollRect`+`RectMask2D`+3열 격자, 지울 땐 떼어 끄고 Destroy). **5c-2b 속 패널·영어 배치 완료(2026-09-26)** — 판 패널 안 단추(닫기 류 빼고 40까지, 설정 창은 전역 값을 돌려 뺌)를 또 눌러 둘째 단계(도감 탭·문답 등)를 같은 식으로, 닫기가 없으면 패널 안 바뀜(탭)이라 다시 안 누름, 안 단추가 이미 닫았으면(성 고르기) 연 단추를 또 안 누름 · **영어 한 바퀴**(다섯 판 언어 en → 타이틀부터 다시, 보고서 `en:` 머리) · 판 설정 PlayerPrefs 36 키는 `Editor/SagaPrefsBackup` 으로 떠 뒀다 되돌림(흐름 진단도 이것) · 글꼴 아틀라스 둘째 장의 `TMP_SubMeshUI` 는 뺌(사각형이 글자와 무관 — 영어 바퀴에서 가짜 겹침 26). 결과: 두 언어 × 판 패널 40·속 패널 7·첫 화면 여섯 × 세 화면비 **0건**. **5c-2c-1 첫 화면 영어 완료(2026-09-26)** — 배치 점검 영어 바퀴가 **보이는 한글 글**을 센다(`Logs/ui_layout_report.txt` 끝, 한글 조각만) — 첫 측정 118. 원인 둘: ① 빌더가 씬에 구운 글(지을 때 한국어 — 설정 창·국지 명령 단추·패널 제목·닫기·STORY 저장·DUNGEON 점프)은 실행 때 다시 안 읽었다 → 판마다 `XxxLocalization.RelocalizeScene()`(한국어 표 값과 같은 글이면 그 키로 다시, 글마다 키·마지막 쓴 글을 기억해 영어 → 한국어도, 코드가 바꾼 글은 잊음, 공통 UI 언어 `SagaUi.Lang` 도 맞춤) — 설정 창 `Start`·판 안 언어 바꿀 때 부름, 국지 명령 단추·전술/일기토 단추는 만들 때 식으로 다시(전술은 영어가 세 줄이라 자동 맞춤) ② 코드에 박힌 글 — 목표판 머리(지금·이번 세션·이번 주 → `SagaUi.L`)·세션 정리 카드·GO/DUNGEON 일과 줄(`task.<종류>`)·DUNGEON/STORY 가장 가까운 적·FOREST 나무·택배·축제(`festival.name.<종류>`)·REALM 조망·함락·STORY 동료 표시 이름(`party.name.<id>`) → 표 키(새 키 ko·en 짝 서른넷). STORY 목표판 셋째 줄의 개발 자리표("다음 승급 이정표 준비 중(101-2 ⑦ 대기)")는 **다음 전직 레벨**로. 결과 118 → **1**(문답 서고의 "중꺾마" = 문제 내용). **5c-2c-2 상태가 있어야 뜨는 글 완료(2026-09-26)** — 감시 도구 `Editor/HangulWatch`(명령줄 `-hangulWatch`): 판별 헤드리스 다섯을 영어로 돌리며 켜진 TMP 글(UI·월드) 중 한글이 든 것 + 번역 표에 키가 없어 한국어 폴백이 나간 순간(`SagaUi.MissingText` — 다섯 판 `T()` 에 고리)을 `Logs/hangul_watch.txt` 에(그 판 언어가 en 일 때만·DebugUI 뺌, 원래 언어는 파일로 떠 뒀다 끝에 되돌림). 진단은 상태를 코드로 만들어 UI 를 덜 거치니 정적 훑기로 보탬: 코드의 한국어 글 중 **한국어 표 값과 다른 것 = 키 없이 박힌 것**(165). 고친 것 — 박힌 글 → 표 키(ko·en 짝 147): GO 승급 카드·저장 / DUNGEON 축복 카드·방 표지·부적·필드 사건·층 내려가기·월드 보스 부위·퍼즐·채집·보물·광맥·우물·난입·시련 수호자·무기 둘 / FOREST 도감 열둘(한국어 이름 = 세이브 키라 그대로 두고 화면만 `museum.item.<id>`)·집 드나들기 / STORY 유파 스물넷·비경 은사 아홉·망루 / REALM 결과·정리 카드·특성·야망. **그림 문자**(⚔ 📜 🚪 🐺 등 마흔넷)가 Noto Sans KR 에 없어 □ 였다 → **Noto Emoji**(OFL, 흑백 윤곽이라 SDF 로 구움, `Assets/Art/Fonts/NotoEmoji/`)를 TMP 셋째 대체 글꼴로(`SetupSagaFonts`), 어느 쪽에도 없는 ≋ ✗ 는 ≈ ×. 진단이 한국어를 박아 둔 검사(언어 되돌림·목표판 머리·척후병 대사·축제·택배·GO 지역 사명·국지 사연)를 지금 언어의 표 값으로 → **다섯 판 헤드리스가 영어로도 통과**(국지는 감시 모드면 시작 언어를 en 으로). 결과: 영어 감시 보이는 한글 0 · 누락 키 0. 뺀 것: 성능 기록 표(측정용 빌드 전용)·DebugHud·GO 세력 이름(화면에 안 씀)·국지 문답의 한국어 사자성어(문제 자체). 함정: 셸 heredoc 이 백슬래시를 먹어 치환 스크립트가 C# 에 날 줄바꿈을 넣었다 — 백슬래시가 든 스크립트는 Write 로. **5c-3 놀다가 켜지는 것 완료(2026-09-27)** — `UiLayoutCheck` 에 **상태** 단계: 단추로는 안 열리는 것을 판마다 실제로 켜고 세 화면비로 잰다(알림·고르기는 패널처럼 새로 뜬 것만, 전투 HUD·대사 줄·배너는 화면 전체 — 늘 있는 HUD 와 겹치면 문제). 상태 = GO 들판 전투 명단 넷(이름 긴 인물 셋)·폭발 준비·지역 사명 줄 / 옛 결투 셋(결투 중엔 들판 HUD 가 숨는 모습 그대로)·조우 알림 셋·승급 3택 / DUNGEON 축복 3택·시련 카드·지역 배너 / FOREST 밀어내기 / STORY 전직·선택 / REALM 알림 / 판마다 긴 대사 줄 — 두 언어 × 38. 조사용 `-uiHidden`(재지 않고 첫 화면에 숨은 UI 목록). 첫 측정 **193건** → 0: GO 결투 화면(막대·제목이 레벨·돈 줄·저장과, 속공이 조이스틱과) → 제목·시간 한 줄 + 막대 셋을 레벨 줄·대사 밑으로, 속공은 조이스틱 오른쪽(자리 한 곳 `EncounterUiKit.Duel*`) · 조우 알림 글 상자가 첫 단추까지 내려옴 · 승급/축복 3택 셋째 카드 ↔ 거절(130·간격 150) · DUNGEON 시련 카드 판 1000 > 화면 900 → 840 · DUNGEON·STORY 대사 줄(위 가운데 920 폭이 목표판·파티 줄·단추 기둥과) → HUD 빈 틈 아래쪽(왼쪽 기준이라 20:9 에서도 틈 안) · DUNGEON 지역 배너 → 같은 틈 가운데 · STORY 전직 창 넷째 단추 ↔ 닫기(판 720) · GO 대사 줄 위 정렬(영어 세 줄이 목표판·Ⅱ 에 닿음). **씬 빌더가 구운 UI 여섯(대사 줄 셋·3택 둘·전직 창)은 자리를 런타임 `ApplyLayout()` 한 곳으로 — 빌더와 `Awake` 가 같이 불러 씬을 다시 안 지어도 맞는다**(사실 몸이 없는 PC 에서 재빌드하면 씬이 폴백 몸으로 지어진다). 점검기: 세션 정리 카드는 모달(REALM "다음 달" 알림과 같이 뜬다) · 단추 없이 저절로 닫히는 카드는 6초 기다림. 3연속 OK. 남음: 영어 검수(사람) · 폰 실기 |
| 6 | **마감** — 크레딧(CC0·Mixamo 약관·폰트), 버전·앱 id·아이콘, 영어 검수 목록, 충돌 로그 · **스토어 크기**: APK 470MB 라 Google Play 는 AAB + Play Asset Delivery(기본 모듈 ≤200MB) 로 나눠야 한다 | 스토어 제출 목록 채움 | **6a 크레딧·오류 기록·버전 완료(2026-09-27)** — 출처 표 한 곳 `SagaCore/SagaCredits`(폴더 접두어 → 출처·라이선스·저작권 줄, 긴 접두어가 이김, 우리 것은 `own`) · 점검 `Editor/SagaCreditsCheck`: 빌드에 들어가는 에셋(빌드 씬·Resources·품질별 렌더 파이프라인 에셋의 의존 655)을 표에 맞춰 **표에 없는 에셋이 하나라도 있으면 FAIL** — 빌드 문지기 ⑤ 로 걸어 새 에셋은 출처 한 줄부터 · 통과하면 법적 고지 `SagaCore/Resources/SagaLegal.txt`(92KB, 첫 줄 = 쓰인 출처 id) 를 쓴다: OFL 전문(Noto Sans KR·Noto Emoji·Liberation Sans — 글꼴 name 표에서 저작권 줄을 옮김, Noto Sans KR 의 OFL.txt 엔 저작권 줄이 없었다) + 플레이어 어셈블리·에셋이 든 패키지 16 중 Unity 자체 라이선스가 아닌 것(glTFast Apache 2.0 전문) + 패키지 제3자 고지(Burst·Cinemachine·RP Core·URP·Visual Scripting). 쓰인 출처 8: 우리 것·Mixamo(git 밖이라 `build_deps.txt` 로 셈)·Kenney·Poly Haven·BGM 다섯 곡·Noto·Liberation·Unity — 공방 몸·Quaternius·셰이더 셋은 빌드에 안 들어가 화면에서 빠진다. 타이틀 아래 줄 **크레딧**(스크롤 창 — 머리 두 언어 + 전문, 전문은 줄 묶음 ~2400자마다 글을 나눔·서식 해석 끔). **오류 기록** `SagaCore/SagaCrashLog`: 빌드에서만 예외·오류를 `error_log.txt` 에(최근 40건, 같은 오류는 ×n 으로 합침, 다시 켜면 이어 읽음) — 타이틀 설정 맨 아래 줄 "N건 · 복사"(클립보드). 네이티브 충돌은 스토어 콘솔 몫. **버전**: `PlayerSettings.bundleVersion` 한 곳(타이틀 표시 = `Application.version`), 빌드가 안드로이드 버전 코드를 a·10000+b·100+c 로 셈(0.1.0 → 100). 진단 `PlaytestSagaCredits`(점검·전문·두 언어·버전 코드·오류 기록 합치기/이어 읽기/지우기) · 배치 점검 타이틀 크레딧 창 0건. **6b 앱 정체성·아이콘 완료(2026-09-27, 사용자 결정)** — 앱 id `io.github.smh8627jpg.saga`(GitHub Pages 주소 뒤집기, 하이픈 불가라 뺌 — 안드로이드·PC·iOS) · 회사명 `SAGA Games` · 제품명 SAGA — 상수 한 곳 `SagaPlayerBuild.AppId/Company/Product`, 빌드가 `ApplyIdentity()` 로 맞춘다. 회사명이 PC 저장·PlayerPrefs 위치(LocalLow·레지스트리)를 정해 이 PC 의 옛 `DefaultCompany/SAGA` 저장 다섯·에디터 설정 33 을 새 자리로 복사(옛 것은 백업으로 둠, 실제 사용자는 아직 없어 옮기는 코드는 안 넣음). **아이콘(임시)** = 먹빛 둥근 그러데이션 + 금빛 테 + 금빛 "史"(Noto Sans KR Bold) — `tools/app-icon/make_icon.py`(Blender Cycles, 47초)가 `Assets/Art/Icon/` 세 장(전체·적응형 뒤판·앞판 — 앞판은 안전 영역 66/108 안)을 굽고 `Editor/SagaAppIcon` 이 기본·안드로이드 적응형(뒤+앞)·둥근·옛 칸 18 에 건다(모듈 없는 PC 도 컴파일되게 아이콘 종류는 이름으로). 진단 `PlaytestSagaCredits` 에 정체성·아이콘 검사. 새 APK 는 옛 시험 APK 와 다른 앱으로 깔린다. **6c 영어 검수 목록 완료(2026-09-27)** — `tools/loc-review.mjs`(node): 번역 표 다섯 + 코드의 `SagaUi.L` 짝 = **2091** 을 모아 기계 검사(자리표·서식 태그·앞뒤 공백 — 한국어 조사 붙임은 봐줌·영어에 한글·빈 영어·키 짝·첫 기호·줄 수·**실명**(사가고 도감 id 이름 조각 + 손 목록, 두 언어)·**원작 게임 용어**(웹 사가고 §5 ⑳ 에서 바꾼 것)·판 안 용어) · 같은 짧은 한국어의 다른 영어(흔들림, 동음이의어는 허용 목록) · 순위 1·2 넘침 주의 → `docs/EN_REVIEW.md`(요약, 생성물) + `docs/en_review.tsv`(순위 1 UI 257 · 2 놀면서 1144 · 3 대사·문답 690, **검수** 칸은 사람이 채우고 다시 돌려도 영어가 같으면 지킴), 오류 있으면 exit 1. 첫 결과 오류 99·경고 9·흔들림 8 → **0·0·0**: **국지 문답 실명 12문항**(한·영 둘 다 — 이 트랙 주석이 "교양 퀴즈라 정책 밖"이라 두었던 것을 웹 d9120233 과 같은 가명으로, 코드 폴백도) · **GO 원작 용어**(⑳ 표대로 표시 글자만: 상자 나무·무늬·옻칠·금박, 반응 물안개·터짐·물벼락, 원소 폭발 → 해방, 영어 원소 Fire·Water·Thunder, DUNGEON 번개 창 Lightning Lance — enum·키·세이브 그대로) · 봉래 한마디 로마자 오타 · 용어 맞춤(DUNGEON 난입 = Onslaught·Mini-Boss·황건적 두목, STORY 전직 = class·%p, FOREST 안개유령, 판 사이 떠도는 망자·별바다 손님·황건적) · 공통 단추 Title Case(Quit Game·New Game 등 — 판 설정 창과 같게). 도중 발견: 목표판(폭 900·줄바꿈)이 그날 뽑힌 일과 줄 길이만큼 넓어져 DUNGEON 상태 글과 여유 27px — 영어가 몇 자 늘자 배치 점검 겹침 6 → 폭 540·줄바꿈 없음·자동 크기 22→15 로 날짜·언어 무관하게. 헤이케(가문)·황건적(무리)·지명은 사람 이름이 아니라 둠(웹과 같게). 남음: **사람 검수**(tsv 순위 1부터). **6d 앱 번들 + Play Asset Delivery 완료(2026-09-27, 도구·시험 빌드)** — `SagaPlayerBuild.BuildAndroidAab` → `Build/Android/SAGA.aab`: 이 빌드 동안만 분할(splitApplicationBinary)을 걸어 첫 씬(타이틀)+코드 = base, 나머지 데이터 = **설치 시점 에셋 팩** `UnityDataAssetPack`(설치 때 같이 받아 런타임 코드 없음) · 서명은 환경 변수 `SAGA_KEYSTORE`·`_PASS`·`SAGA_KEY_ALIAS`·`_PASS` 로만(없으면 디버그 서명 = 업로드 불가라고 보고서에 적음), 끝나면 분할·키 설정을 되돌려 ProjectSettings 에 키 경로가 안 남음(`.gitignore` 에 `*.jks`·`*.apks`) · 빌드 뒤 `InspectAab` 가 zip 을 열어 모듈별 압축 크기·서명 파일을 보고서에 적고 base 200MB·팩 1.5GB·설치 시점 4GB 를 넘거나 팩이 없으면 FAIL. 빌드 본체를 `Build()`(결과만 돌려줌)로 떼어 진단이 검사한다. 진단 `PlaytestSagaAab`(타이틀+국지만·자산 검사 끔 — 묶음 없는 PC 에서도): Temp 에 keytool 임시 키 → 환경 변수 길로 서명 → base 36.8MB·팩 22MB·서명 SAGATEST.RSA·설정 원복·bundletool 1.17.2 validate OK·팩 install-time·targetSdk 36. 매니페스트에 Google `asset-delivery 2.1.0` 이 FOREGROUND_SERVICE·DATA_SYNC 를 붙인다(빠른 후속·주문형 추출용, 우리는 안 씀) — 빼는 건 폰 시험 뒤로, 제출 목록에 적음. **제출 목록** `docs/STORE_CHECKLIST.md`(빌드·등록 정보·정책 양식, 사람 칸 표시 — 업로드 키·Play 앱 서명·스크린숏·개인정보처리방침·IARC·비공개 테스트, 결정 필요: Unity 하드웨어 통계 `submitAnalytics: 1`). **6e 템플릿 잔재 정리 완료(2026-09-27)** — 참조 0 인 패키지 넷(Visual Scripting·Multiplayer Center·Collab·AI Navigation)을 manifest 에서 빼고 URP 템플릿 잔재(`TutorialInfo/`·`Readme.asset`·`SampleScene`)를 지움. 법적 고지 92 → 59KB(Visual Scripting 제3자 고지 등), 앱 번들 크기는 그대로(IL2CPP 코드 제거가 이미 뺐다). 내장 모듈은 stripEngineCode 로 이미 빠지고 URP 의존이 얽혀 그대로. **6f 스토어 등록 자료 초안(2026-09-27)** — `docs/store/`: `icon_512.png`·기능 그래픽 `feature_ko/en.png`(1024×500 RGB — `tools/store/make_store_art.py` 가 앱 아이콘 장면 `make_icon.py` 함수를 불러 Blender 로 31초, 임시) · `listing.md`(짧은 설명 45·76자·전체 설명 한·영, 판별 한 줄은 타이틀 카드 것, 원작 이름·실명 없음, 판단 칸: 사가고·사가블로 이름의 원작 연상) · `privacy.md`(개인정보처리방침 한·영 초안 — 수집 없음·기기 안 저장·오류 기록은 사용자가 복사할 때만, Unity 하드웨어 통계는 결정 따라 두 갈래). 남음: **묶음 있는 PC 에서 전체 AAB 실측** · 사람 칸(업로드 키·스크린숏·방침 주소·IARC·비공개 테스트·하드웨어 통계·이름 판단) · 템플릿 잔재 패키지(Visual Scripting·Multiplayer Center·Collab) 빼기 후보(빌드 크기·고지 33KB) |

# FINAL RULE

Claude Code는 이 문서를 한 번에 1~100까지 실행하지 않는다.

```text
현재 Step 확인 → 해당 Step만 실행 → 검증 → 상태 기록 → 다음 Step
```

특히 최초에는:

```text
(레거시 감사는 saga-godot 것 재사용 — 4장)
→ Vertical Slice 설계(Phase 2)
→ Project Foundation(Phase 1)
```

순서로, 둘 다 마친 뒤 Phase 3(3D World)부터 실제 구현에 들어간다.

**완성 게임을 한 번에 만들지 않는다.** 먼저:

> "작지만 그래픽이 좋고, 이동이 좋고, 전투가 재미있고, 탐험하고 싶고,
> 보상을 얻고 다시 플레이하고 싶은 3D 모바일 게임"

을 Unity로 만든다. `saga-godot` 트랙이 같은 목표를 향해 따로 가고 있다는
것을 항상 기억한다 — 서로 코드를 베끼지 않되, 어느 한쪽이 먼저 좋은
해법(예: 땅 경계 블렌딩, 렌더러 이중 프로파일)을 찾으면 **개념만**
참고한다.
