# SAGA 프로젝트 — Unity 6 3D 신규 구축 최종 작업지시서
## saga-godot과 나란히 가는 두 번째 엔진 트랙 / Vertical Slice 우선 / Mobile 3D RPG

## 0장 — 읽는 법 (2026-09-16 재편)

- **이야기(시나리오) 정본**: 루트 `../scenario/`(판별 다섯 벌 + 공통 틀 `README.md` — 세 트랙 공통). 다섯 판 모두 이 트랙은 아직 장이 없다. 넣는 자리는 README §6(`Data/ScenarioData.cs`·`ScenarioState.cs`), 판별 "트랙 메모"가 기존 퀘스트를 어느 장에 흡수할지 적었다. 구현하면 §7 진행표를 고친다.
- **이 파일은 정본이지만 통째로 읽지 않는다**(≈75KB). `grep -n "^# \|^## "` 로 장 목차를 뽑고 필요한 장만 `sed -n` 으로 읽는다. 장 번호(1~100·66-1·66-2·101~105)는 `docs/`·코드 주석이 가리키므로 **바꾸지 않는다**.
- **상태**는 `docs/PROJECT_STATE.md`(≤15KB, 세션 끝에 덮어쓴다). **이력**은 `docs/HISTORY.md`(append-only, 날짜·게임명으로 grep). 이 PLAN 에는 날짜 달린 세션 기록을 쓰지 않는다 — 결정이 바뀔 때만 고친다(`../SAGA-DESIGN.md` §9 문서 3층).
- 공통 개편 설계(재미 표준 8·참고 게임·그래픽·에셋·버그)는 `../SAGA-DESIGN.md`. 이 트랙 적용분은 **101~105장**(끝). 다섯 웹 판의 게임성 후보는 `../saga-web/<판>/PLAN.md` §5 — 3D 는 거기서 검증된 것을 옮긴다(101장).
- 규칙(엔진 확인·배치 모드 부작용·GUI 금지·gitignore)은 이 폴더 `CLAUDE.md` 가 정본이고 여기서 반복하지 않는다.
- **긴 스펙은 `docs/spec/`**: 109 표의 줄별 상태 칸·110·101-2·101-3·106·107·3.1 본문은 원문 그대로 옮겼다(tasks U-0008). 제목·번호는 여기 그대로 두고 `> → docs/spec/…` 줄이 가리킨다. 각 spec 첫 줄 주석에 원래 자리가 있다.

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

> → `docs/spec/3-1-vertical-slice.md` (원문 그대로 옮김 — 제목 18개 `## 3.1 Vertical Slice First` … `# 35. 1~100 최종 작업 단계`, tasks U-0008)

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

# 66-2. 아트 방향 — (폐기) 사실적 PBR·FF 기준 → 툰 노선으로 바뀜 (2026-10-02)

> **현재 결정**: saga-unity 도 saga-godot 과 같은 툰(셀) 노선이다. 셰이더 `Assets/Shaders/CelToon.shader`(`Saga/CelToon` — 명암 3단·림·외곽선·정점색), 에셋은 자체툴(K 갈래)이 만들어 `Assets/` 에 놓는다. 아래 사실적 PBR·FF16 기준은 옛 결정이라 읽지 않는다. 규칙: 사실 재질을 CelToon 으로 바꾸는 도구는 `Editor/CelToonConvert.cs`.


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

> → `docs/spec/101-2-web-port-1.md` · `docs/spec/101-2-web-port-2.md` (원문 그대로 옮김 — 본문, tasks U-0008)

## 101-3. 엔진 장점으로 C·G 를 한 단 올리기(웹이 못 하는 것)

> → `docs/spec/101-3-engine-cg.md` (원문 그대로 옮김 — 제목 2개 `## 101-3. 엔진 장점으로 C·G 를 한 단 올리기(웹이 못 하는 ` … `# 102. 그래픽 개편 — 사실적 PBR(66-2 유지) 위에 SAGA`, tasks U-0008)

## 102-1. 아트 바이블(이 트랙 판)
1. 한 스타일: ~~사실적 PBR + 필름틱 LUT~~ → 툰(`Saga/CelToon`, 66-2 머리말). Kenney 로우폴리·VRoid 애니풍과 한 화면에 섞지 않는다(44장 교체가 끝난 판부터 강제).
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

> → `docs/spec/106-lockon-party-1.md` · `docs/spec/106-lockon-party-2.md` (원문 그대로 옮김 — 제목 11개 `## 106-1. 락온·예고·반격 (순서 1)` … `# 107. GO 원신 기준 — 전투 시스템·지도 형태 (2026-09-`, tasks U-0008)

## 107-1. 들판 전투 (①)

> → `docs/spec/107-go-genshin.md` (원문 그대로 옮김 — 제목 8개 `## 107-1. 들판 전투 (①)` … `## 107-8. 지역 사명 사슬 (⑧, 웹 사가고 ⑬)`, tasks U-0008)

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
| 10 | DUNGEON — 5.9 비결 → 5.10 비전 → 5.11 시련 → 5.12 고정 세계 지역 아홉 → 5.13 지역 몬스터·위험도·우두머리 → 5.14 지역 사연 → 5.16 몸짓 → 5.17 동행 서명·합격 → 5.18 명소 주인 고유 수 → 5.19 몰이 사냥 (한 절 = 한 조각) | 사가블로 5.9~5.19 | **10-1 비결 완료(2026-09-25)** → `docs/spec/109-10-status-1.md` (원문 그대로 — 이어 붙이면 원래 칸, tasks U-0008) 다음 = 11번 칸 STORY 5-9 |
| 11 | STORY — 5-9 보스 패턴전 → 5-10 보스 고유 기술·그로기 → 5-11 관문 대장 고유 기술 | 사가스토리 5-9~5-11 | **11-1 보스 패턴전 완료(2026-09-27)** → `docs/spec/109-11-status-1.md` (원문 그대로 — 이어 붙이면 원래 칸, tasks U-0008) |
| 12 | FOREST — 5.9 떠돌이 방문객 → 5.10 새 손님·단골·몸짓 | 사가의숲 5.9·5.10 | **12-1 떠돌이 방문객 완료(2026-09-27)** → `docs/spec/109-12-status-1.md` (원문 그대로 — 이어 붙이면 원래 칸, tasks U-0008) |
| 13 | REALM — 5-11 싸움터 땅 → 5-10 지도 위 실제 인물·모션 | 사가국지 5-11·5-10 | **13-1 싸움터 땅 완료(2026-09-28)** → `docs/spec/109-13-status-1.md` (원문 그대로 — 이어 붙이면 원래 칸, tasks U-0008) |
| 14 | GO — 웹 ⑲(saga-godot 106 이식 순서표, 2026-09-25 추가)가 코드로 옮겨지면 그 줄마다 107 과 대조해 없는 것만 | 사가고 ⑲ | **대기 풀림(2026-09-28 대조 — 웹 ⑲ 1~46 코드분 완료)** → `docs/spec/109-14-status-1.md` · `docs/spec/109-14-status-2.md` · `docs/spec/109-14-status-3.md` · `docs/spec/109-14-status-4.md` · `docs/spec/109-14-status-5.md` (원문 그대로 — 이어 붙이면 원래 칸, tasks U-0008) **이야기와 재대결이 웹 ⑲ 71 까지 다 옮겨졌다 — 다음 = 14-27b·14-1b 괴물 몸·실기 확인(웹 ⑲ 는 71 까지 — 72+ 없음)** |
| 15 | 탈것·비행 — 다섯 판(SAGA-DESIGN §15): GO → DUNGEON → FOREST → STORY → REALM | 각 판 `js/mount.js` | **15-1 GO 완료(2026-09-29)** → `docs/spec/109-15-status-1.md` (원문 그대로 — 이어 붙이면 원래 칸, tasks U-0008) 다음 = 웹 12부 유무 확인·14-27b·14-1b·실기 확인 |
| 16 | 시나리오 「천하와 균열」 — REALM 먼저(scenario/saga-realm.md · 웹 `js/data-scenario.js`) | 사가국지 시나리오 | **16-6 REALM 회차 완료(2026-09-30, 웹 §5-14 이식 — `RealmRound`·세이브 `round`·"다음 달" 두 번 누르기·진단 `PlaytestRealmRound`)** → `docs/spec/109-16-status-1.md` (원문 그대로 — 이어 붙이면 원래 칸, tasks U-0008) 다음 = 전 판 실기 확인 · 14-27b·14-1b · STORY 나머지 16장(사냥터가 생긴 뒤). | 사가국지 시나리오 | 대기 |
| **D. 계속 맞추기** | 웹 PLAN §5 에 새 절이 생기면 이 표 C 끝에 줄을 더한다(세션 시작 때 웹 다섯 PLAN §5 목차를 이 표와 대조). | | 상시 |

# 110. 상용화 — 내놓을 수 있는 게임으로 (2026-09-26 사용자 결정)

> → `docs/spec/110-commercial-1.md` · `docs/spec/110-commercial-2.md` (원문 그대로 옮김 — 제목 2개 `# 110. 상용화 — 내놓을 수 있는 게임으로 (2026-09-26 사` … `# FINAL RULE`, tasks U-0008)
