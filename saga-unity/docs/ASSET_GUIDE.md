# ASSET_GUIDE

PLAN.md 34장에서 만들기로 해 놓고 안 만들었던 문서 — 2026-09-12, 첫 GLB
에셋(캐릭터 4종) 교체를 하면서 같이 만들었다. saga-godot의 같은 이름
문서와 형식을 맞춘다 — **무엇을 왜 골랐는지**만 짧게 적는다.

## 출처 — Kenney.nl, CC0, saga-godot 트랙과 같은 파일 재사용

루트 CLAUDE.md "하지 말 것"의 "원작사의 실제 에셋 가져다 넣기" 금지는
포켓몬GO·디아블로 같은 원작 IP의 실제 리소스를 뜻한다. Kenney의
CC0(퍼블릭 도메인) 킷은 그 원작들과 무관한 제3자 소재라 해당하지
않는다(PLAN.md 8장·`saga-godot/docs/ASSET_GUIDE.md`와 같은 근거).

**두 트랙이 같은 파일을 그대로 재사용한다** — PLAN.md 0장 "기획만 같이
본다"는 코드 얘기고, CC0 소재는 라이선스가 같으니 새로 받을 이유가 없다
(PLAN.md 8장이 이미 그렇게 정해 둠). `saga-godot/assets/characters/*.glb`
4개(character-a~d) + `Textures/texture-{a,b,c,d}.png`를 그대로 복사해
`Assets/Art/Characters/`에 넣었다.

| 킷 | 받은 날(saga-godot 기준) | saga-unity 도입일 | 용도 |
|---|---|---|---|
| [Blocky Characters](https://kenney.nl/assets/blocky-characters) 2.0 | 2026-09-11 | 2026-09-12 | 플레이어·NPC·산적 |
| [Nature Kit](https://kenney.nl/assets/nature-kit) 2.1 | 2026-09-11 | 2026-09-12 | 나무·바위 |
| [Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit) 2.0 | 2026-09-11 | 2026-09-12 | 마을집 벽/지붕·폐허 기둥·다리 |
| [Modular Cave Kit](https://kenney.nl/assets/modular-cave-kit) 1.0 | 2026-09-11 | 2026-09-12 | 굴 입구 |

라이선스: CC0 — 출처 표시 의무 없음.

## Unity에 GLB를 불러오려면 패키지가 하나 더 필요하다

PLAN.md 8장은 "FBX, GLB/GLTF (Unity 임포터가 직접 지원)"이라고 적어
뒀는데 이건 **틀린 전제였다** — Unity 6000.3.23f1 기본 설치엔 glTF
임포터가 없다(`Packages/manifest.json`에 아무 것도 없었음, `.glb` 파일을
Assets에 넣어도 그냥 무시된다). Unity 공식 패키지
`com.unity.cloud.gltfast`(6.9.0)를 `manifest.json`에 추가해 해결했다 —
URP를 기본으로 지원하고(머티리얼이 자동으로 `Universal Render
Pipeline/Lit`로 들어옴), Unity 공식 레지스트리에서 바로 받아진다(추가
scoped registry 불필요). 다음에 FBX가 아니라 GLB 에셋을 새로 받을 때
"임포터가 없어서 안 된다" 싶으면 이 패키지가 실제로 있는지부터 확인할 것
(saga-godot의 URP Sky/Fog 오판과 같은 종류의 실수 — PLAN.md 문서의 가정을
실제로 확인 없이 믿지 말 것).

## 실측값 (MeasureCharacterGlb.cs로 확인 후 삭제 — 일회성 도구)

`Renderer.bounds`를 인스턴스화해 직접 실측했다(추측 아님, saga-godot의
`get_aabb()` 실측과 같은 방법):

| 파일 | 실측 크기(m) | 피벗 |
|---|---|---|
| `character-{a,b,c,d}.glb` (넷 다 같은 골격) | 1.6 × 2.7 × 0.8 | 바닥(발밑, min.y=0) |

saga-godot의 실측(1.6×2.7×0.8)과 정확히 일치 — 같은 파일이니 당연하다.
**피벗이 바닥**이라 primitive capsule(중앙 피벗이라 `height*0.5`만큼
띄워야 했음)과 달리 위치 계산에 y 오프셋이 필요 없다.

## 스케일·배치 — `CharacterVisual.cs`(공용 로직)

기존 primitive capsule 시절 목표 높이(`CharacterController.height`=3.4,
Player·NPC·산적 전부 동일)에 맞춰 `targetHeight / NativeHeight`
(3.4/2.7 ≈ 1.259)로 균일 스케일한다. 색조는 URP Lit의 `_BaseColor`를
`MaterialPropertyBlock`으로 덮어써(공유 머티리얼 자체는 안 건드림) 같은
모델을 여러 배역에 색만 다르게 재사용한다 — 킷을 4종만 받아서 배역은
5개(플레이어·촌장·상인·나그네·산적)라 나그네는 상인과 같은 모델
(character-c)을 색조만 다르게 재사용한다.

| 배역 | 모델 | 색조 |
|---|---|---|
| 플레이어 | character-a | 없음(원본 텍스처 그대로) |
| 마을 촌장 | character-b | 파랑 계열 |
| 떠돌이 상인 | character-c | 갈색 계열 |
| 나그네 | character-c (상인과 모델 재사용) | 회색 계열 |
| 산적 | character-d | 어두운 빨강(전투 텔레그래프 때 주황으로 덮어씀) |

## GLB 에셋이 없을 때의 대비 — 폴백

다른 PC에 이 GLB 파일들이 아직 없는 상태로 `BuildTestVillageScene.Build()`
를 돌리면(예: 새 클론 직후, 또는 나중에 다른 배역용 GLB를 깜빡 안 받아온
경우) `CharacterVisual.SpawnFallbackCapsule()`이 예전 primitive capsule로
대신 채워 씬 빌드 자체는 안 깨지게 한다 — saga-godot의 "동굴 입구 GLB
못 받아 오면 이전 박스로 대체" 관례와 같다.

## 환경/건물 GLB (2026-09-12, 캐릭터 다음 조각)

`VegetationBuilder.cs`(나무·바위)·`LandmarksBuilder.cs`(굴 입구·마을집·
폐허·다리)에 Kenney Nature/Fantasy Town/Modular Cave Kit GLB를 넣었다.
saga-godot 실측표(위 표와 같은 파일)를 그대로 신뢰해 재실측 없이 스케일을
가져다 썼다(같은 TileSize=48 세계 축척이라 유효) — `MeasureCharacterGlb.cs`
로 한 번 더 재확인만 하고(값 100% 일치) 지웠다.

| 파일 | 실측 크기(m) | 스케일 | 쓰는 곳 |
|---|---|---|---|
| `vegetation/tree_oak.glb` | 0.64×1.23×0.74 | ×4.5×(개체별 0.7~1.3) | 숲 타일, 타일당 3그루 |
| `rocks/rock_largeA.glb` | 0.78×0.26×1.02 | ×2.6×(개체별 변주) | 산 타일 절반 |
| `rocks/rock_smallA.glb` | 0.36×0.19×0.36 | ×3.5×(개체별 변주) | 산 타일 나머지 절반 |
| `buildings/wall-block.glb` | 1×1×1 | 비균등=bodySize(10,4,10) 그대로 | 마을집 벽 |
| `buildings/roof-gable.glb` | 1.1×0.57×1.07 | 균일 ×10 | 마을집 지붕(콜라이더 없음) |
| `buildings/pillar-stone.glb` | 0.16×1.0×0.16 | 균일=목표 높이 | 폐허 기둥 3개 |
| `buildings/planks.glb` | 1×0.06×1 | 비균등(폭 6, 길이는 44개 등분) | 다리 덱 |
| `dungeon/gate-rock.glb` | 4.00×4.05×2.45 | 균일 ×1.48(목표 높이 6m) | 굴 입구 |
| `shrine/altar-stone.glb` | 1.04×0.49×0.65 | 균일 ×2.5(목표 높이 약 1.23m) | 산신당 제단(재설계, 아래 절 참고) |

**GLB엔 물리 콜라이더가 없다** — glTF 포맷 자체가 충돌체를 안 담는다.
굴 입구·마을집 벽·기둥류는 실측 로컬 AABB(위 표) 그대로
`BoxCollider`/`CapsuleCollider`를 코드로 직접 얹었다(캐릭터는 트리거
판정만 있어 콜라이더가 없어도 됐지만, 이 랜드마크들은 "지나갈 수 없는
장애물"이라 필요) — 지붕·다리 덱은 원래도 콜라이더가 없던 자리라 그대로
안 얹었다(지붕은 밟는 자리가 아니고, 다리는 TerrainBuilder가 'B' 타일에
이미 별도로 막아 뒀다, 두 곳이 각자 만들면 겹친다는 기존 원칙 그대로).

## 산신당 재설계 (2026-09-12, 환경/건물 GLB 다음 후속 조각)

**산신당('S' 타일, `LandmarksBuilder.BuildShrine()`)은 그때(위 절) "형태가
많이 달라 재설계 필요"로 미뤄 뒀다가 같은 날 처리했다.** 예전 구조(받침대
박스 5×0.6×5 + `pillar-stone.glb` 기둥 4개)를 통째로 걷어내고,
saga-godot `landmarks_builder.gd`의 `SHRINE_SIZE`(1.04×0.49×0.65)·
`SHRINE_SCALE`(2.5, 균일)을 그대로 옮겨 **`shrine/altar-stone.glb`
제단 하나**로 바꿨다 — saga-godot도 옛 사당을 이 파일 하나로만 짓는다
(같은 이유: 실제 돌 표면 굴곡이 있는 조각이라 gate-rock.glb처럼 균일
스케일만 쓴다). 최종 크기 약 2.6×1.23×1.63m, 바닥 중앙 피벗이라
`gate-rock.glb`·`altar-stone.glb`처럼 위치 계산에 y 오프셋이 필요 없다.
`shrine/altar-stone.glb` + `shrine/Textures/colormap.png`를
saga-godot에서 그대로 복사(다른 GLB들과 같은 재사용 원칙). GLB가 없을 때의
폴백도 예전 받침대+기둥 구조 대신 이 크기 그대로의 단일 박스로 바꿨다.
`MountainShrine.cs`(트리거·보상 로직)는 안 건드림 — 이건 순전히
`LandmarksBuilder.cs`의 시각 담당 쪽 변경이다.

## Props 도입 (2026-09-12, 산신당 재설계 다음 후속 조각)

PLAN.md 44~49장 우선순위(Player→주요 Enemy→Boss→Environment→Building→
Vegetation→**Props**→Animals→VFX)의 다음 칸. 새 킷을 찾지 않고 이미 쓰고
있는 `Fantasy Town Kit 2.0`(CC0, `LandmarksBuilder.cs`가 wall-block·
roof-gable 등에 쓰는 그 킷)에서 그때 안 받았던 파일 세 개만 추가로
받았다 — 이 킷 하나에 160개가 넘는 모듈이 들었는데 처음엔 건물에 필요한
4개만 골라 왔었다(zip을 `opengameart.org`의 미러 링크로 다시 받아
`Models/GLB format/` 안에서 골랐다 — Kenney 공식 페이지는 다운로드
버튼이 JS라 직접 URL을 못 뽑았다). 텍스처는 새로 안 받고 기존
`Assets/Art/Buildings/Textures/colormap.png`와 바이트가 100% 같은 걸
md5로 확인했다(같은 킷·같은 아틀라스라 당연) — 그래도 `Buildings/`와
분리해 관리하려고 `Assets/Art/Props/Textures/`에 한 벌 더 뒀다(PLAN.md
8장이 나열한 `Art/Props/` 카테고리를 그대로 따름, `Dungeon/`·`Shrine/`도
각자 텍스처를 따로 갖고 있는 것과 같은 결 — 바이트 중복보다 "무엇이
어떤 자산에 속하는지" 폴더로 바로 보이는 쪽을 택함).

| 파일 | 실측 크기(m) | 스케일 | 쓰는 곳 |
|---|---|---|---|
| `props/lantern.glb` | 0.216×1.556×0.224 | ×1(그대로) | 마을집 두 채 사이 가로등 2개 |
| `props/stall-red.glb` | 1×1.237×1 | 균일 ×2 | 떠돌이 상인 옆 시장 좌판 |
| `props/fence.glb` | 0.075×0.38×1(비중앙 피벗, x∈[0.425,0.5]) | 균일 ×2 | 논밭 소 옆 울타리 3칸 |
| `props/fence-gate.glb` | 0.519×0.55×1 | 균일 ×2 | 위 울타리 줄 가운데 문 1칸 |

**소품 셋을 기존 콘텐츠 옆에 붙였다** — 새 자리를 만들지 않고 이미 있는
곳을 꾸미는 것만으로 "허전함"을 줄인다는 PLAN.md 9~10장 원칙:
- 가로등 2개 — 마을집(격자 2,3·3,3) 사이 공터를 마주 보게.
- 시장 좌판 1개 — 떠돌이 상인(격자 4,3) 옆, 거래 자리처럼 보이게.
- 울타리 3칸+문 1칸 — 논밭 소(cow_1, 격자 3,9) 옆에 한 줄로. **실제로
  소를 가두지는 않는다** — `WanderingAnimal`의 24유닛 배회 반경을 다
  두르려면 수십 칸이 필요해 장식 목적과 안 맞다(PLAN.md 3장 "테스트 안
  된 추측성 변경" 회피) — "목장 한구석" 느낌만 준다. 콜라이더도 일부러
  안 둠(반 토막짜리 줄을 막아 버리면 오히려 걸린 것처럼 보인다).

`PropsBuilder.cs`(신규) — `LandmarksBuilder.cs`와 같은 결(자리마다 상수,
GLB 없으면 primitive로 대체, `childCount>0`이면 `Awake()`에서 다시 안
지음). `BuildTestVillageScene.cs`에 `BuildProps()` 훅 추가(Landmarks
다음, Animals 전).

## 동물 GLB — 2026-09-12 조사 결과 (아직 도입 안 함)

saga-godot도 "어울리는 동물 GLB가 없다"고 남겨 둔 항목이라 다시
찾아봤다. **결론: CC0 소스는 찾았지만 자동으로 받을 수 없어 사람의 확인이
필요하다.**

- **Kenney**엔 사슴·소·늑대를 갖춘 3D 킷이 없다 — "Animal Pack"·"Animal
  Pack Redux" 둘 다 **2D 스프라이트**였다(직접 opengameart.org 미러로
  확인).
- **Quaternius**(PLAN.md 8장이 이미 허용해 둔 소스)의 "Animated Animal
  Pack"(poly.pizza 번들 `Animated-Animal-Pack-ILAPXeUYiS`)이 정확히
  **Cow·Deer·Wolf**를 포함한다(+ Donkey·Alpaca·Bull·Fox·Shiba Inu·
  Stag·Husky·Horse 등 12종, 걷기·달리기 등 애니메이션 포함, CC0,
  glTF/FBX). **다만 poly.pizza는 개별 모델 다운로드에 계정/API 키가
  필요하고, quaternius.com 원본 페이지는 Discord `#pack-claim`·Patreon
  클레임 절차를 거치게 돼 있어 — 계정 생성·로그인은 대신 해 줄 수 없는
  영역이라 파일을 직접 못 받아 왔다.**
- 로그인 없이 바로 받아지는 대안(`quaternius.itch.io/lowpoly-animated-
  animals`, CC0, "Name your own price" 무료)도 있지만 Cow·Horse·Llama·
  Pig·Pug뿐이라 **사슴·늑대가 빠진다** — 지금 갖춘 세 종(사슴·소·늑대)을
  다 못 채운다.

**다음 세션이 이어갈 것**: 사용자가 직접 poly.pizza 계정을 만들거나
Quaternius Discord/Patreon 클레임으로 위 팩을 받아 스크래치패드나
저장소 어딘가에 놔두면, 그 다음부터는 지금까지와 같은 방식(실측→
`AnimalBuilder.cs`에 스케일·콜라이더 반영→md5 확인)으로 이어받을 수
있다. 그때까지는 사슴·소·흰 늑대 모두 primitive로 남는다.

## DUNGEON 환경/건물 GLB (2026-09-12, 여섯 번째 세션)

`VERTICAL_SLICE_DUNGEON.md` "환경/건물 GLB" 후보 — `saga-godot/assets/
dungeon/`에서 corridor.glb·gate.glb만 마저 복사해 `Assets/Art/Dungeon/`
(SagaGo가 이미 gate-rock.glb·colormap.png를 둔 그 폴더)에 넣었다.
같은 Modular Cave Kit(위 표), 새 다운로드 없음.

| 파일 | 실측 크기(m, saga-godot ASSET_GUIDE 기준) | 스케일(최초 도입 당시) | 쓰는 곳 |
|---|---|---|---|
| `dungeon/corridor.glb` | 4.0×4.05×4.0, 바닥 중앙 피벗 | X=DoorWidth/4.0=0.75, Y=WallHeight/4.05≈0.988, Z=1(그대로) | DUNGEON 복도 셋, 타일 2장(4.0×2=Length 8과 정확히 일치 — Z축 안 늘림) |
| `dungeon/gate.glb` | 4.4×4.4×1.4, 바닥 중앙 피벗 | X=문 폭(3)/4.4≈0.682, Y·Z=1 | DUNGEON 방 넷의 문 6곳(아치는 앞뒤 대칭이라 방향 안 따짐) |

**room-small.glb(방 셸, 12.0×4.4×12.0)는 이번엔 안 씀** — DUNGEON 방
치수(20×14×4)와 비율이 많이 달라(X 1.667배·Z 1.167배·Y 0.909배로 축마다
제각각) 비균등 스케일 시 벽 질감이 뚜렷하게 뒤틀릴 걸로 보인다.
`saga-godot/games/saga_dungeon/world/test_room.gd`는 이 문제를 **방
치수를 GLB 원본(12×12, 스케일 없음)에 맞추는 쪽으로 풀었다** — Unity
쪽도 같은 길을 가려면 이미 있는 방 넷의 모든 스폰 좌표(적·상자·행상·
소품 등)를 전부 다시 잡아야 하는 파급 큰 재설계라 다음 슬라이스로
미뤘다.

**GLB엔 콜라이더가 없다**(위 원칙과 같음, `saga-godot/games/saga_dungeon/
world/test_room.gd`도 같은 이유로 StaticBody3D를 따로 둔다) — 기존
primitive Floor/Wall을 그대로 두되 `corridorModel`이 채워져 있으면
`MeshRenderer.enabled = false`로 안 보이는 충돌체로만 남긴다. 문 아치
(`gate.glb`)는 실제로 지나다니는 자리라 애초에 콜라이더를 안 붙인다.
색은 `CharacterVisual.Tint()`(캐릭터 GLB 슬라이스가 만든 `_BaseColor`
MaterialPropertyBlock 유틸)를 그대로 재사용해 복도 타일을 폐허 톤으로
물들인다 — 새 유틸을 안 만들고 이미 있는 것을 다른 용도로 재사용.

## DUNGEON 방 셸 GLB (2026-09-12, 여덟 번째 세션 — 위 절 뒤이음)

**바로 위 절의 "이번엔 안 씀" 결정을 뒤집었다.** 비균등 스케일(축마다
다른 배율)이 문제였지, room-small.glb 자체를 못 쓸 이유는 없었다 —
**"방을 GLB 원본의 정사각(12×12) 비율에 맞추는 균일 스케일"**로 풀었다:
기존 폭(RoomWidth=20)을 그대로 지키려면 배율은 20/12=5/3, 정사각형이라
같은 배율을 깊이에도 적용하면 자동으로 20이 나온다(왜곡 없음) —
`DungeonRoomBuilder.RoomDepth`를 14→20으로 올린 이유. 방 넷의 기존
콘텐츠는 전부 X축 기준 좌표라 **하나도 안 옮겼다** — 깊이만 넉넉해져
오히려 여유가 늘었다. 복도 간 이동 거리(Room2/3/4 중심 z좌표)만 새
halfD(10)에 맞춰 다시 계산했다(`BuildTestDungeonScene.cs` 주석 참고).

| 파일 | 실측 크기(m) | 스케일(이 슬라이스로 바뀜) | 비고 |
|---|---|---|---|
| `dungeon/room-small.glb` | 12.0×4.4×12.0, 바닥 중앙 피벗 | 균일 5/3(=RoomWidth/12) | 방 넷의 바닥·벽 셸, 색은 바이옴 톤으로 틴트 |
| `dungeon/gate.glb` | 4.4×4.4×1.4 | 균일 5/3(문 폭도 4.4×5/3≈7.33로 넓어짐) | 예전엔 X만 좁히는 비균등이었는데 셸과 짝을 맞추며 균일로 개선됨 |
| `dungeon/corridor.glb` | 4.0×4.05×4.0 | **스케일 없음(1,1,1)** | `DoorWidth`를 3→4.0(corridor.glb 실측 폭)으로 올려 완전히 무왜곡이 됨 |

**문 폭(RoomDoorWidth≈7.33)이 복도 폭(4.0)보다 넓어 문턱에 살짝 좁아지는
단이 생긴다** — saga-godot도 `gate.glb`(4.4)·`corridor.glb`(4.0) 사이에
같은 종류 차이를 그대로 두고 문서화해 둔 것과 같은 트레이드오프, 이
프로젝트도 그대로 받아들인다.

**확인 안 된 가정 — room-small.glb의 실제 문 구멍 폭이 gate.glb(4.4)와
같다.** 메시를 직접 열어 본 게 아니라 saga-godot `test_room.gd`가
`GATE_HALF_WIDTH`(gate.glb 폭의 절반)로 방 벽 틈을 계산하는 코드 구조에서
역으로 추론한 값이다 — 사람이 실제로 걸어서 문 자리를 확인하기 전까진
셸의 시각적 문 구멍과 콜라이더 문 폭이 정확히 겹치는지 100% 확신 못 함
(아래 GUI 확인 목록 참고).

컴파일·씬 재빌드(`room childCount` 13→14, Room1에 셸(Shell) 하나 추가)·
PlaytestDungeonHeadless 전부 통과, 실제 화면 확인은 미정(실기 확인
방침에 따라 사람이 직접 할 몫).

## 이번에 발견해 같이 고친 것 — Awake() 중복 생성

`NpcBuilder.cs`·`BanditEncounter.cs`가 `Awake()`에서 조건 없이
`Build()`를 다시 불러서, 편집기 빌드 스크립트가 이미 저장해 둔 씬을 실제
Play(헤드리스든 사람이 직접 하든)로 열면 시각·UI가 두 벌씩 겹쳐 생기는
잠재 버그였다(`Gatherable.cs`·`HiddenTreasure.cs` 등은 이미 방어가
있었는데 이 둘만 빠져 있었음). 캐릭터 GLB로 바꾸며 두 파일을 어차피
손대는 김에 `transform.Find("Visual") != null`이면 다시 안 짓게 방어를
넣었다. 환경/건물 GLB 조각(`VegetationBuilder.cs`·`LandmarksBuilder.cs`)도
어차피 다시 쓰는 김에 `transform.childCount > 0`이면 건너뛰는 같은 방어를
추가해 뒀다. 나머지 `AnimalBuilder.cs`·`RareWolfEncounter.cs`·
`HiddenTreasure.cs`·`MountainShrine.cs`·`EastGroveRelic.cs`·
`LuckyCairn.cs` 여섯 곳은 **후속 세션(2026-09-12)이 정리했다** —
자세한 내용(그 중 `RareWolfEncounter`·`BanditEncounter`에서 찾은 더 깊은
NRE 버그 포함)은 `docs/PROJECT_STATE.md` 참고.

## 2026-09-13 — 아트 방향 전환, 이 문서의 Kenney 킷들은 순차 교체 대상

`saga-godot/docs/ASSET_GUIDE.md`와 같은 결정 — 원신(Genshin Impact) 같은
애니메이션 셀셰이딩 그래픽을 목표로, 위 Kenney CC0 킷들은 순차 교체
대상이 됐다. 세부 사항은 `PLAN.md` **66-2장** 참고(saga-godot 66-2장과
같은 결정, Unity 고유 차이만 이 프로젝트 66-2장에 따로 적음). 이 문서는
지우지 않는다 — 교체가 끝나기 전까지는 여전히 유효한 현재 상태 기록이다.

## 2026-09-13 — VRoid 샘플 아바타, Unity 임포트 검증

saga-godot이 VRoid Studio에서 내보낸 파이프라인 검증용 임시 자산(자세한
경위는 `saga-godot/docs/ASSET_GUIDE.md` 2026-09-13 항목 — 커스터마이징
없는 pixiv 기본 샘플 `AvatarSample_A`, 라이선스는 상업 이용·재배포·수정
전부 허용으로 바꿔 내보냄)을 이 프로젝트에도 그대로 미러링했다 —
`Assets/Art/CharactersVroid/AvatarSample_A.vrm`(원본, 참고용) +
`.glb`(같은 내용을 복사한 사본).

**gltFast로 바로 확인됨 — 별도 UniVRM 없이도 임포트된다.** `.vrm`
확장자는 Unity가 `DefaultImporter`(포맷을 모르는 파일용 기본 처리)로
받아 3D 모델로 인식하지 못했지만, `.glb` 사본은 기존 Kenney GLB들
(`character-a.glb`·`gate-rock.glb`)과 똑같이 `com.unity.cloud.gltfast`의
`ScriptedImporter`로 잡혀 정상 임포트됐다(배치 모드 로그 확인, 관련
오류·예외 없음). 66-2장에 "UniVRM 경유·gltFast 경유 두 경로 중 아직 안
정함"이라고 적어 뒀던 것 — **gltFast 경로로 정한다.** 이미 프로젝트에
들어 있는 패키지라 추가 설치가 필요 없고, 지금까지 GLB 자산 전부가 이
경로를 쓰고 있어 일관성도 있다. UniVRM은 VRM 고유 확장(스프링본·
휴머노이드 매핑 등)이 필요해지면 그때 다시 검토한다.

**주의 — 배치 모드 실행이 프로젝트 설정을 건드렸다.** 이 PC에 설치된
Unity 에디터(6000.3.24f1)가 프로젝트가 고정해 둔 버전(6000.3.23f1)보다
최신이라, 열자마자 `ProjectSettings/ProjectVersion.txt`를 새 버전으로
덮어썼고 `Packages/manifest.json`의 `com.unity.cloud.gltfast`도
6.9.0→6.14.1로 자동 갱신됐다(`packages-lock.json`도 같이). 이번 작업과
무관한 부작용이라 `git checkout`으로 전부 되돌렸다 — saga-godot
CLAUDE.md가 헤드리스 임포트 뒤 `project.godot`/`*.import`를 확인하라고
경고하는 것과 같은 종류의 함정이다. **다음에 이 PC에서 Unity 배치
모드를 돌릴 때도 실행 후 반드시 `git status`/`git diff`로 `ProjectSettings/`·
`Packages/`를 훑을 것.**

## 정정(2026-09-13, 같은 날 다시) — saga-unity는 원신이 아니라 사실적 방향

바로 위 두 항목("아트 방향 전환"·"VRoid 샘플 아바타")은 "saga-godot과
같은 결정(원신류 셀셰이딩)"을 전제로 적었는데, 사용자가 "saga-unity는
사실적인 걸로, 엔진마다 다른 점이 필요해"로 방향을 갈랐다. 자세한 내용은
`PLAN.md` 66-2장(다시 씀) 참고. **이 문서의 위 두 항목을 지우지 않는
이유** — VRoid 샘플이 gltFast로 임포트된다는 것·배치 모드가 프로젝트
설정을 건드릴 수 있다는 것은 그래픽 스타일과 무관한 엔진 사실이라
여전히 유효하다. 다만 "이 방향(원신)으로 에셋을 채워 간다"는 전제는
더 이상 맞지 않으니, 그 부분만 걸러서 읽을 것.

## 2026-09-13 — Poly Haven PBR 텍스처 후보 (66-2장 ② 환경 조사)

`Assets/Art/EnvironmentPBR_candidates/`(`PolyHaven_CobblestoneFloor01/`·
`PolyHaven_CastleWallSlates/`) — **Poly Haven**(CC0, 공개 API로 로그인
없이 정적 URL 다운로드) 재질 두 벌. 1k JPG로 diffuse·normal(OpenGL)·
roughness·AO 네 맵. `LICENSE.txt`에 출처 URL(`polyhaven.com/a/<slug>`)
적어 둠. **아직 후보일 뿐 — 어느 씬에도 안 물렸다.**

`BuildEnvironmentPbrSample.cs`(에디터 도구)로 URP `Lit` 머티리얼 2개를
지어 실제로 파이프라인이 도는지만 확인했다(diffuse→BaseMap,
normal→BumpMap, AO→OcclusionMap). **Roughness 맵은 아직 안 씀** — URP
Lit의 Metallic 워크플로가 Smoothness를 별도 슬롯이 아니라 Metallic맵
알파로만 받아서, 지금은 상수(0.3~0.35)로 근사만 해 뒀다. 실제 지형/벽에
쓸 때는 커스텀 Shader Graph로 Poly Haven의 `arm`(ORM 팩) 텍스처를
풀어 쓸 것 — 자세한 내용은 `PLAN.md` 66-2장 "② 환경 PBR 텍스처 킷 조사"
참고, 여기서 반복하지 않는다.

배치 모드 실행 후 `ProjectSettings/`·`Packages/` 버전 자동 갱신
부작용(위 항목과 같은 함정, 2026-09-13 두 번째 발생) 확인 후
`git checkout`으로 되돌림.

## 2026-09-13 — 캐릭터 에셋 조사(66-2장 ③): Mixamo가 선례다

새로 조사하지 않고 4장 원칙대로 웹 판 기록을 재사용했다 —
`saga-web/saga-forest/assets/ASSET_LICENSES.md` "Mixamo (Adobe)" 절이
이미 2026-09-02에 같은 문제(사실적 사람 소스)를 풀어 뒀다. 결론:
**Mixamo(무료 Adobe 계정)가 최선**이지만 (1) mixamo.com에 공개 API가
없어 사람이 직접 브라우저로 캐릭터·애니메이션을 골라 받아야 하고
(2) 약관상 원본 재배포 금지라 **변환 결과물을 이 공개 저장소에
커밋하지 않는다** — `Assets/Art/CharactersRealistic/`를 `.gitignore`에
미리 추가해 뒀다(폴더 자체는 아직 없음). Unity는 FBX를 네이티브로
읽고 Mixamo 표준 리그를 Humanoid Avatar로 바로 매핑하므로, 웹 판이
필요로 했던 `FBX2glTF`+`gltf-transform` 변환 파이프라인은 **필요 없다**
— 받은 FBX를 폴더에 넣고 Rig 탭에서 Humanoid로 지정하기만 하면 된다.
자세한 받는 절차·헤어카드/SSS 셰이더 조사 결과는 `PLAN.md` 66-2장
"③ 캐릭터 에셋 조사" 참고, 여기서 반복하지 않는다.

## 2026-09-13 — 캐릭터 셰이더 후보 세 벌 반입 (66-2장 ④/⑤)

`Assets/Art/CharacterShaders_candidates/`(`SSS_CiaranSimpson/`·
`AnisoHair_cathyhlshih/`·`HairCards_itsFulcrum/`) — 위 ③이 조사만 해
뒀던 URP 헤어카드(이방성)·SSS 스킨 셰이더를 라이선스 확인(MIT/MIT/
CC0-1.0) 후 실제로 `git clone`해 받았다. 아직 후보일 뿐 — 캐릭터가
없어 어느 머티리얼/씬에도 안 물렸다. `SSS_CiaranSimpson`은 재사용
서브그래프만 가져오고 원본 데모 그래프는 뺐다(이 프로젝트 Unity
6000.3 Shader Graph 패키지에서 임포트 오류) — 자세한 내용은
`CharacterShaders_candidates/LICENSE.txt`·`PLAN.md` 66-2장 ④/⑤ 참고.

## 2026-09-13 — Poly Haven PBR 텍스처 추가 세 벌 (66-2장 ⑥)

`Assets/Art/EnvironmentPBR_candidates/`에 `PolyHaven_GrassPath2/`(흙길)·
`PolyHaven_LeafyGrass/`(초목 바닥)·`PolyHaven_DarkWoodenPlanks/`(목재)
세 벌을 추가로 받았다(전부 CC0, 1k JPG 네 맵). 위 "Poly Haven PBR
텍스처 후보" 항목이 대표 둘(바닥·벽)만 확인한 것에 이어 44장 우선순위
대로 넓힌 것 — 출처는 `LICENSE.txt`, 자세한 내용은 `PLAN.md` 66-2장
⑥ 참고. 여전히 후보일 뿐, 어느 씬에도 안 물렸다.

## 2026-09-14 — 사운드 첫 벌(Kenney, CC0) — PLAN.md 67장 첫 슬라이스

FOREST 포자괴물 "밀어내기" 미니게임(같은 날 앞서 추가된 전투 콘텐츠)에
쓸 SFX 두 개를 opengameart.org의 Kenney CC0 미러에서 받았다(Kenney
공식 페이지는 다운로드 버튼이 JS라 직접 URL을 못 뽑는다는 게 위 Props
항목의 결론 그대로라 이번에도 같은 미러를 썼다):

| 파일 | 출처 팩 | 쓰는 곳 |
|---|---|---|
| `Assets/Art/Audio/Kenney_RPGSounds/chop.ogg` | [RPG sounds](https://opengameart.org/content/50-rpg-sound-effects)(50 RPG Sound Effects) | 밀어내기 버튼 누를 때마다 |
| `Assets/Art/Audio/Kenney_InterfaceSounds/confirmation_001.ogg` | [Interface Sounds](https://opengameart.org/content/interface-sounds) | 대치 해소(성공/타임아웃 공통) |

라이선스: CC0 — 두 폴더의 `LICENSE.txt` 참고. 각 팩 전체(수십~수백
파일)를 받지 않고 실제로 쓰는 파일만 골라 커밋했다(Props 항목과 같은
절제 — 킷 하나를 통째로 받지 않는다). `Saga.Forest.Audio.ForestAudio`
(신규)가 재생을 맡는다 — 진짜 Unity AudioMixer 에셋(카테고리별 볼륨을
Mixer로 분리하는 것)은 에디터 GUI로 사람이 노드를 잇는 방식이라 배치
모드로 못 만들어서, 이번엔 코드로 볼륨만 곱해 흉내 냈다(자세한 내용은
`ForestAudio.cs` 클래스 주석). FOREST 하나에만 만들었다 — 다른 네 판은
필요해질 때 각자 복사해 붙일 것.

## 2026-09-14 — GO "사운드"도 착수 — 같은 chop.ogg 재사용

`BanditEncounter.cs`의 강타/피격 화면 플래시에 위 `Kenney_RPGSounds/
chop.ogg`를 그대로 재사용(새 다운로드 없음 — `Assets/Art/Audio`는
`Characters/`·`Buildings/`처럼 다섯 판이 공유하는 원본 자산 트리라
그대로 참조한다). `Saga.Go.Audio.GoAudio`(신규, `ForestAudio.cs`와 같은
결)가 재생 담당. **승리/패배 음악(징글)은 일부러 안 붙였다** —
Kenney "Short jingles" 팩(`jingles_HIT/NES/PIZZA/SAX/STEEL`, 각 17개)을
받아는 봤지만 어느 인덱스가 "이김"이고 어느 게 "짐"인지 파일 이름만으론
구분이 안 되고, 이 세션은 소리를 직접 들을 방법이 없어 잘못 고르면
승리 장면에 패배 음악이 깔리는 사고가 날 수 있다 — **사람이 직접 들어
보고 골라야 하는 몫**으로 남겨 뒀다(받아 둔 zip은 커밋 안 함, 필요하면
다음에 같은 URL로 다시 받을 것: `https://opengameart.org/sites/default/files/jingleSounds_Kenney.zip`,
CC0).

## 2026-09-14 — 사운드를 REALM·STORY로 확장 — `error_001.ogg` 새로 받음

같은 날 "묻지 말고 이어해"로 계속 진행 — PROJECT_STATE.md가 남겨 둔
"Dungeon·Story·Realm 사운드 미착수" 중 STORY·REALM 두 판을 마저 붙였다
(DUNGEON은 이미 `SfxPlayer.cs`가 절차적 합성 톤으로 먼저 들어가 있었다는
걸 이번에 확인 — 그쪽은 그대로 둔다, 자세한 내용은 PROJECT_STATE.md
2026-09-14 항목).

| 파일 | 출처 팩 | 쓰는 곳 |
|---|---|---|
| `Assets/Art/Audio/Kenney_InterfaceSounds/error_001.ogg` | [Interface Sounds](https://opengameart.org/content/interface-sounds)(같은 킷, 새 파일만 추가) | REALM 명령/문답/공격/계략 실패·오답 |

`error_001.ogg`는 위 두 SFX와 달리 **이 세션이 이름만 보고 새로 골랐다**
(`kenney_interfaceSounds.zip`을 통째로 받아 목록만 확인, 실제로 쓰는
파일 하나만 커밋 — 위 절제 원칙 그대로). GO 잉글 보류와 달리 감정가
있는 선곡이 아니라(승리/패배 음악처럼 곡 전체의 무드를 판단해야 하는
게 아니라 "삑 - 짧은 오류음"이라는 기능 하나만 확인하면 되는 UI blip)
파일 이름(`error_001`)만으로 오인식 위험이 낮다고 판단해 사람 확인 없이
바로 썼다 — 다음에 비슷한 "감정가 없는 UI 사운드"를 고를 땐 이 기준을
써도 된다(반대로 승리/패배/BGM처럼 무드가 있는 선곡은 여전히 사람 몫).

- **STORY** — `Saga.Story.Audio.StoryAudio`(신규, 같은 결). `StoryEnemy.cs`
  (잡졸·두목 공용 컴포넌트)의 `TakeDamage()`에 `chop.ogg`(재사용), `Die()`에
  `confirmation_001.ogg`(재사용 — "대치가 풀렸다"는 인상을 이미 FOREST가
  쓴 것과 같은 취지로 재사용, 새 사운드를 안 만들었다). 클립은
  `StoryEnemySpawner.cs`를 거쳐 `BuildTestStoryScene.cs`가 배선한다.
- **REALM** — `Saga.Realm.Audio.RealmAudio`(신규). REALM은 타격감이 아니라
  명령·문답·공격·계략 네 판정 결과 UI가 중심이라 confirm/error 두 갈래로만
  나눴다(`RealmCommandUi.cs` 클래스 주석 참고) — `confirmation_001.ogg`
  (재사용)/`error_001.ogg`(신규)를 `BuildTestCityScene.cs`가 배선한다.
  소패 함락(승)도 confirm, 퇴각(패)도 error 한 갈래로 묶었다(`RealmWarState.
  AttackResult`에 `Won` 필드를 새로 노출해 UI가 구분).

검증: 배치 모드 컴파일 → 두 씬 재빌드(`BuildTestStoryScene`·
`BuildTestCityScene`) → `PlaytestStorySlice`(전투 경로가 실제로
`TakeDamage`/`Die`를 타 SFX 호출을 그대로 통과) 3연속 통과 →
`PlaytestRealmSlice`는 UI 버튼을 안 눌러(정적 API 직접 호출 방식) 원래
`RealmCommandUi.PlayOutcomeSfx()`를 못 봐, confirm/error 클립이 실제로
배선됐는지 + 헤드리스에서 `RealmAudio.PlaySfx`가 예외 없이 도는지 직접
확인하는 단계를 새로 추가해 3연속 통과 → 회귀 확인으로 GO
`PlaytestHeadless`·FOREST `PlaytestForestCreatures` 1회씩 재확인(무관함
확인). ProjectSettings/EditorSettings.asset이 배치 모드 실행 후 diff로
떴으나 실제 내용 변경 없이 CRLF/LF 차이뿐이라 되돌렸다(루트 CLAUDE.md
"git autocrlf 가짜 diff"와 같은 함정).

## 2026-09-14 — DUNGEON도 절차적 합성→실클립으로 통일(사용자 확정)

위 항목에서 "DUNGEON은 이미 절차적 합성 톤이 있어 그대로 뒀다"고 적었는데,
사용자에게 직접 물어보니(AskUserQuestion) **"실제 클립으로 교체"** 를
골랐다 — 다섯 판 사운드 방식을 통일하는 쪽. `SfxPlayer.cs`의 옛 합성
로직(사인파+감쇠 봉투)을 지우고 다른 네 판과 같은 클립 재생 방식으로
바꿨다. 공개 API(`PlayHit()` 등 인자 없는 다섯 메서드)는 그대로 둬
`PlayerCombat.cs`·`DungeonEnemy.cs`·`DungeonSecretStash.cs`·
`GameBootstrap.cs` 네 호출부는 안 건드렸다 — 이미 씬에 하나뿐이던
`GameBootstrap`이 [SerializeField] 클립 다섯 개를 받아 `SfxPlayer.
Configure()`를 한 번 부르는 방식(`RealmCommandUi`류의 "호출부가 클립을
들고 있는" 패턴과 다르게, 호출부가 넷으로 흩어져 있어 이번엔 이미 있던
싱글턴 부트스트랩에 모았다).

| 카테고리 | 파일 | 비고 |
|---|---|---|
| hit(평타) | `Kenney_RPGSounds/chop.ogg` | 재사용(GO/STORY와 동일) |
| heavyHit(강공격/급소 대용) | `Kenney_RPGSounds/knifeSlice.ogg` | 신규 — RPG sounds 킷(이미 zip 통째로 받아 둔 상태)에서 chop과 결이 다른 "날카로운" 소리로 골라 hit과 구분 |
| enemyDeath | `Kenney_InterfaceSounds/confirmation_001.ogg` | 재사용(FOREST/STORY와 같은 "대치 해소" 취지) |
| levelUp | `Kenney_InterfaceSounds/confirmation_002.ogg` | 신규 — 이미 받아 둔 interfaceSounds.zip의 confirmation 변종 |
| discovery(비밀 지역) | `Kenney_InterfaceSounds/confirmation_003.ogg` | 신규 — 위와 같음, levelUp과 다른 변종으로 구분만 |

heavyHit/levelUp/discovery 셋 다 **이 세션이 파일 이름·소속 팩만 보고
새로 골랐다**(zip 자체는 REALM의 `error_001.ogg`를 받을 때 이미 통째로
내려받아 둔 상태라 새 다운로드 없이 압축만 다시 풀었다) — REALM
`error_001.ogg`와 같은 기준("감정가 없는 UI/임팩트 블립은 사람 확인 없이
이름만 보고 골라도 된다")을 그대로 적용했다. 다섯 판 모두 실클립
방식으로 통일됐고, **BGM은 다섯 판 전부 여전히 없다** — 사용자가 이번엔
"보류"를 골라 다음으로 미뤘다(감정가 있는 선곡이라 사람이 직접 들어야
한다는 원칙 그대로).

검증: 배치 모드 컴파일 → `BuildTestDungeonScene` 재빌드 →
`PlaytestDungeonHeadless`(스모크) 3연속 통과 →
`PlaytestDungeonFloorProgression`(실제 `TakeDamage`로 적을 죽여 hit/death
SFX 호출 경로를 실제로 태움, 12개 방 진행 중 레벨업도 자연히 발생)
3연속 통과. ProjectSettings/EditorSettings.asset은 이번에도 CRLF/LF
차이만 뜨고 실제 변경은 없어 되돌렸다.

## 2026-09-15 — BGM 다섯 곡 전부 착수 — "묻지말고 순서대로 진행해"로 보류 해제

위에서 몇 차례 보류돼 온 BGM을, 사용자가 이번엔 "순서대로 진행해"로
직접 진행을 지시해 착수했다. 여태 보류 사유는 **승리/패배처럼 "어느
쪽인지 들어야 아는 곡"을 잘못 고르는 사고**였지(`GoAudio.cs`·
`RealmAudio.cs` 클래스 주석 참고) 상시 배경 루프 자체가 막힌 적은
없었다 — 그래서 이번엔 승패 구분 없는 **판마다 상시 배경 루프 한
곡씩**만 붙였다(그 제약을 피해 가는 것이지 어기는 게 아니다). 사람이
직접 들어야 하는 감정가 있는 선곡(승리 팡파레·패배 음악 등)은 여전히
안 건드렸다 — 그대로 사람 몫.

곡은 opengameart.org에서 **CC0 라이선스로 필터링해**(고급 검색 —
Art Type=Music, License=CC0) 찾고, 제목·태그만으로 판마다 어울리는
곡을 골랐다(오디오를 못 듣는 건 여전해서 — Kenney "Short jingles"의
승패 구분 문제와 달리, 이번엔 제목 자체가 이미 명확한 곡만 썼다):

| 게임 | 파일 | 원제 · 작곡가 | 출처 |
|---|---|---|---|
| 사가고 | `Assets/Art/Audio/CC0_BGM/go_town_theme.mp3` | "Town Theme (RPG)" · cynicmusic | <https://opengameart.org/content/town-theme-rpg> |
| 사가블로 | `Assets/Art/Audio/CC0_BGM/dungeon_ambience.ogg` | "Dungeon Ambience" · yd | <https://opengameart.org/content/dungeon-ambience> |
| 사가의숲 | `Assets/Art/Audio/CC0_BGM/forest_peaceful_town.ogg` | "Peaceful Town" · aroachifoundonmypillow | <https://opengameart.org/content/peaceful-town> |
| 사가스토리 | `Assets/Art/Audio/CC0_BGM/story_fight_run_breath_deeply.mp3` | "…Fight, run, breath deeply" · Komiku | <https://opengameart.org/content/fight-run-breath-deeply> |
| 사가국지 | `Assets/Art/Audio/CC0_BGM/realm_war_theme.ogg` | "War Theme" · spring-spring | <https://opengameart.org/content/war-theme> |

라이선스: 다섯 곡 전부 CC0 — 다섯 명 서로 다른 작곡가라 Kenney 킷처럼
팩 전체에 딸린 `LICENSE.txt` 한 장이 없어서, 이번엔
`Assets/Art/Audio/CC0_BGM/LICENSE.txt`에 곡마다 원제·작곡가·출처 URL을
직접 적어 넣었다(CC0라 표시 의무는 없지만 추적 목적으로 남김).

**인프라** — `XxxAudio.PlayBgm(clip)`/`RefreshBgmVolume()`를 다섯 벌
(DUNGEON은 `SfxPlayer.cs`) 추가, 루프 재생(`AudioSource.loop = true`)
전용 소스를 SFX와 분리해 새로 둔다(이미 있던 `BgmVolume` PlayerPref를
그대로 씀 — 애초에 이걸 예비해 뒀던 자리). 클립 자체는 다른 실클립과
같은 결로 `GameBootstrap`(REALM은 `RealmCommandUi`가 아니라 별도
`World/GameBootstrap.cs`)의 `[SerializeField]`에 씬 빌드 스크립트가
`AssetDatabase.LoadAssetAtPath`로 채운다.

**설정 패널에 여섯째 줄 "BGM" 추가** — 다섯 판 전부 기존 줄(효과음/
진동/UI 크기/그래픽 품질/언어)은 그대로 두고 맨 끝에 이어 붙였다(줄
순서를 안 바꿔 기존 y좌표를 안 건드림) — 패널 높이 680×720→680×820.
`settings.bgm` 로컬라이즈 키(ko "배경음악"/en "Music") 다섯 벌 추가.

검증: 배치 모드 컴파일 → 다섯 씬 전부 재빌드(클립 못 찾음 경고 없음
확인) → `PlaytestHeadless`(GO)·`PlaytestDungeonHeadless`·
`PlaytestForestHeadless`·`PlaytestStorySlice`·`PlaytestRealmSlice`
전부 3연속 통과 → `PlaytestDungeonFloorProgression` 재검증(SfxPlayer.
Configure() 시그니처에 bgmClip 인자가 늘어난 것의 회귀 확인) 통과.
BGM 자체가 실제로 들리는지는(음량·루프 이음매 등) 여전히 사람 확인
몫 — 헤드리스는 "에러 없이 재생 호출이 걸리는지"까지만 확인한다.

## 2026-09-21 — Rocks/Vegetation procgen 교체 (PLAN.md 102-4·103-1)

GO `VegetationBuilder.cs`의 Kenney `tree_oak.glb`·`rock_largeA/smallA.glb`
단일 모델을 `tools/asset-forge/procgen.py`가 찍은 나무 12벌·바위 10벌
(`Assets/Art/Generated/SagaGo/`, 시드는 `Generated/_seed/
saga_go_vegetation.json`)로 교체했다. procgen 메시는 UV가 없어(trimesh가
안 만든다) 새 셰이더 `Saga/VertexColorTriplanarLit`(정점색 바탕 + 월드
위치·법선 기반 트라이플레이너 디테일 곱색)을 짰다 — 정점색은 procgen.py가
직접 굽는다(몸통 갈색·수관 초록·바위 회색, 씨앗마다 살짝 다르게). 디테일
텍스처는 Poly Haven `bark_willow_02`·`rock_boulder_dry`의 diffuse만
1k JPG로 받았다(`Assets/Art/Environment/PBR/PolyHaven_{BarkWillow02,
RockBoulderDry}/`, LICENSE.txt에 출처 추가) — normal/roughness는 이
셰이더가 안 받아 안 받았다. 머티리얼 둘(`TriplanarDetail_Bark`,
`TriplanarDetail_RockBoulder`)은 `BuildVegetationTriplanarMaterials.cs`
(`Saga/Build Vegetation Triplanar Materials` 메뉴)가 코드로 짓고
`Assets/Art/Generated/SagaGo/`에 커밋한다.

FOREST는 이번 스코프 밖(`ForestFruitTree.cs`가 별개 컴포넌트로 tree_oak.glb를
직접 참조 — 다음 단계 몫).

검증: `tools/unity-batch.sh` 컴파일(오류 0) → `BuildVegetationTriplanarMaterials.
Build` → `BuildTestVillageScene.Build`(재질 못 찾음 경고 없음) →
`PlaytestHeadless`(GO) 3연속 OK. 실제 화면 톤(트라이플레이너 이음매·
바크/바위 디테일 강도)은 사람 확인 몫 — `docs/PROJECT_STATE.md` "실기
확인 대기"에 추가.

## 2026-09-21 — FOREST 과일나무도 procgen으로 (102-4 이어서)

`ForestFruitTree.cs`(과일 채집 상호작용 오브젝트)의 `tree_oak.glb`를
GO와 같은 procgen 나무로 바꿨다 — 단, GO의 12종 변종 풀과 달리 **씨앗
하나(`tree_s1_01.glb`) 고정**만 쓴다: 이 나무는 "흔들면 과일이 나온다"는
플레이어 인지가 걸린 게임플레이 오브젝트라 모양을 들쭉날쭉하게 두면
그 인지가 흐려질 위험이 있다는 사용자 판단. 재질은 GO가 이미 지어 둔
`TriplanarDetail_Bark.mat`을 그대로 재사용(새로 안 지음). `TreeScale`을
옛 Kenney 배율(4.5, tree_oak.glb 실측 기준)에서 procgen의 "실제 미터"
치수에 맞는 1.0으로 내렸다.

검증: 컴파일(오류 0) → `BuildTestVillageForestScene.Build`(재질 못 찾음
경고 없음) → `PlaytestForestHeadless` 3연속 OK + `Creatures`·`Finish`·
`Furniture`·`HouseTransition` 재검증(회귀 없음).

## 2026-09-21 — GO 마을집 곁채·굴뚝 (103-1 "건물 모듈" 배가, 새 부품 없이)

`LandmarksBuilder.BuildVillage()`가 두 집(gx=2,3)을 똑같은 박스 하나씩으로
짓던 걸, 기존 `wall-block.glb`·`roof-gable.glb`·`pillar-stone.glb` 3종을
재조합해 서로 다르게 만들었다 — 새 Kenney 부품을 더 안 받고 "배치 조합"만
바꿨다(103-1 문구 그대로). 몸통 크기도 집마다 해시로 0.9~1.1배 흔들고,
한 집(gx=2)에는 곁채(작은 wall+roof 한 벌 더, `BuildHouseBody()` 재사용)를
붙이고, 두 집 다 굴뚝(`pillar-stone.glb` 재사용, `SpawnPillar()`와 같은
호출)을 얹었다. `VegetationBuilder.Hash()`를 `internal`로 열어
`LandmarksBuilder`도 같은 결정적 해시를 쓴다.

검증: 컴파일(오류 0) → `BuildTestVillageScene.Build`(재질 못 찾음 경고
없음) → `PlaytestHeadless` 3연속 OK. 실루엣이 실제로 어떻게 보이는지는
사람 확인 몫.

## 2026-09-24 — GO 지역 전용 소품: Poly Haven 사진측량 모델 열 벌 (PLAN.md 108 ①)

- 받은 곳: Poly Haven 공개 API(CC0), glTF 1k 원본 그대로 → `Assets/Art/Props/PolyHaven/<id>/`(목록·쓰임은 그 폴더 `LICENSE.txt`). 다시 받기 `py -3.12 tools/fetch_polyhaven_models.py`.
- **웹 판의 같은 스캔(`saga-web/*/assets/models/*/realistic/`)은 못 쓴다** — 웹용으로 `EXT_meshopt_compression`·`EXT_texture_webp` 압축돼 있어 glTFast 가 안 읽는다(meshopt 해제 패키지 없음·WebP 미지원). 원본을 새로 받았다.
- 사진측량 원본이 무겁다(쓰러진 통나무 10만 삼각형) → `tools/polyhaven_lod1.py`(Blender 5.2 배치 decimate)로 `<id>_lod1.glb` 여섯 벌, `RegionPropsBuilder` 가 LODGroup(화면 높이 25% 넘을 때만 원본, 0.4% 밑이면 안 그림). 텍스처·가까이 모양은 원본 그대로.
- 합계 약 29MB(텍스처가 대부분). 치수는 실측 미터 → `GoRegionProps.WorldScale`(1.9, 사람 키 3.4 기준) 배.

## 2026-09-26 — 사실 몸 폴더를 PC 사이로 나르기 (PLAN.md 110 ④)

- `Assets/Art/CharactersRealistic/`(Mixamo 원본 + 그 안에서 구운 프리팹·재질·셰이더 그래프, 4.2GB·1520파일)는 계속 gitignore. **다시 받기로는 같은 빌드가 안 된다** — 커밋된 씬·컨트롤러가 그 폴더 `.meta` 의 GUID 를 물고 있어, Mixamo 에서 새로 받으면 GUID 가 새로 나 참조가 끊긴다. 그래서 받은 결과 폴더를 통째로 나른다.
- `tools/realistic-pack.sh`: `manifest`(해시 목록 `tools/realistic/manifest.sha256`, 커밋) · `pack <보관함>`(목록 순서대로 tar, 1900MB 조각 `saga-unity-realistic-<목록 해시 12자>.tar.NN`) · `fetch <보관함>`(`.utmp/` 에 풀어 대조 → 제자리) · `verify`.
- 보관함은 **비공개** — 기본 `~/OneDrive/saga-assets`(사용자 결정, `SAGA_ASSET_STORE` 로 바꿈). Mixamo 약관상 원본을 공개로 재배포하지 않는다 — 공유 링크를 만들지 않는다.
- 빌드 문지기 `Editor/SagaAssetGate.cs`(빌드마다 먼저): ① 폴더 = 목록 ② 빌드 씬이 쓰는 그 폴더 파일 ⊂ 목록 ③ `tools/realistic/build_deps.txt`(빌드가 쓰던 몸 576) ⊂ 지금 쓰는 몸 — 줄면 씬이 몸 없는 PC 에서 지어져 폴백 ④ 빌드 씬·텍스트 의존의 끊긴 GUID 0.
- 몸을 더하거나 고치면: 받기·`Saga/Setup …` → `realistic-pack.sh manifest` → `pack <보관함>` → `push` → `Saga/Build/Write Asset Gate Deps` → 목록 둘 커밋.
- 구글 드라이브 사본(2026-09-28): `push [원격] [보관함]`·`pull [원격] [보관함]` — rclone, 원격 기본 `gdrive:saga-assets`(`SAGA_ASSET_REMOTE`). 이 목록 묶음만 옮기고 `rclone check` 로 크기·md5 대조(드라이브가 md5 를 준다), `pull` 은 이어서 `fetch`. PC 마다 `winget install Rclone.Rclone` → `rclone config create gdrive drive scope=drive`(승인은 사람). rclone 공용 client_id 는 2026 중 끊긴다고 경고한다 — 끊기면 자기 client_id 를 만들어 `rclone config update gdrive client_id=… client_secret=…`(https://rclone.org/drive/#making-your-own-client-id, 구글 클라우드 콘솔 작업은 사람 몫).
  - **자기 client_id 만들기**(무료·10분, 사람 몫 — 만든 값은 비밀번호 관리자에만, 공개 저장소·대화에 넣지 않는다):
    1. <https://console.cloud.google.com/> (드라이브와 같은 계정) → 새 프로젝트 `saga-rclone` → 그 프로젝트 선택.
    2. API 및 서비스 → 라이브러리 → Google Drive API → 사용.
    3. OAuth 동의 화면(Google Auth Platform) → 시작하기: 앱 이름 `saga-rclone`·지원 이메일·**대상 = 외부**·연락처 이메일 → 만들기. 데이터 액세스 → 범위 `https://www.googleapis.com/auth/drive` 추가. 대상 → **앱 게시**(프로덕션) — "테스트" 로 두면 승인이 7일마다 풀려 push/pull 이 실패한다. 심사는 필요 없다(확인되지 않은 앱으로 본인만 쓴다).
    4. 클라이언트 → 클라이언트 만들기 → 유형 **데스크톱 앱** → ID·보안 비밀번호 복사(JSON 도 받아 둔다 — 비밀번호는 만들 때만 보일 수 있다).
    5. 새 터미널: `rclone config update gdrive client_id=<ID> client_secret=<비밀번호>` → `rclone config reconnect gdrive:` (브라우저 승인, "확인되지 않은 앱" → 고급 → 이동 → 허용).
    6. 확인: `realistic-pack.sh push` 가 `4 matching files`·`OK 올림` 이고 `shared Google Drive client_id … being retired` 경고가 사라진다.
    7. 다른 PC 는 같은 값으로 처음부터: `rclone config create gdrive drive scope=drive client_id=<ID> client_secret=<비밀번호>`.
- Mixamo 에서 처음부터 다시 받아야 할 때(보관함을 잃었을 때)는 `tools/mixamo_automation/README.md` 레시피 표 — 그 뒤 씬·컨트롤러를 다시 지어야 하고 빌드는 달라진다.
