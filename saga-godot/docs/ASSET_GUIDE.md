# ASSET_GUIDE

PLAN.md 34장에서 만들기로 해 놓고 안 만들었던 문서 — 2026-09-11, 첫 GLB
에셋 교체(41·43~46·51장)를 하면서 같이 만들었다. master.md 33장 "토큰
절약 규칙 10"대로 여기는 **무엇을 왜 골랐는지**만 짧게 적는다. 각 빌더
스크립트의 주석에 세부 스케일 계산이 이미 있으니 여기서 반복하지 않는다.

## 출처 — 전부 Kenney.nl, CC0

루트 CLAUDE.md "하지 말 것"의 "원작사의 실제 에셋 가져다 넣기" 금지는
포켓몬GO·디아블로 같은 **원작 IP의 실제 리소스**를 뜻한다. Kenney의
CC0(퍼블릭 도메인) 범용 로우폴리 킷은 그 원작들과 무관한 제3자 소재라
해당하지 않는다 — PLAN.md 8장이 애초에 saga-godot은 실제 GLB 에셋
기반이라고 정해 둔 것과도 맞는다.

| 킷 | 버전 | 받은 날 | 용도 |
|---|---|---|---|
| [Nature Kit](https://kenney.nl/assets/nature-kit) | 2.1 | 2026-09-11 | 나무·바위 |
| [Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit) | 2.0 | 2026-09-11 | 마을집·폐허 기둥·다리 |
| [Blocky Characters](https://kenney.nl/assets/blocky-characters) | 2.0 | 2026-09-11 | 플레이어·NPC·산적 |
| [Modular Cave Kit](https://kenney.nl/assets/modular-cave-kit) | 1.0 | 2026-09-11 | 동굴 입구 |
| [Nature Kit](https://kenney.nl/assets/nature-kit) (재다운로드, 밀 이랑만 추가) | - | 2026-09-12 | 논밭 작물 |
| [Graveyard Kit](https://kenney.nl/assets/graveyard-kit) | 5.0 | 2026-09-12 | 옛 사당 제단 |

라이선스: CC0 (Creative Commons Zero) — 출처 표시 의무 없음. 그래도
각 킷 폴더에 원본 `License.txt`를 그대로 두지 않고 이 문서에 요약해
둔다(라이선스 텍스트 자체는 재배포 안 해도 되는 게 CC0의 요점).

**Graveyard Kit에서 딱 하나만 골라 쓴 이유** — 이름은 "묘지"지만 킷 안의
`altar-stone.glb`(석재 제단)는 십자가·해골 같은 서구 묘지 도상이 전혀
없는 밋밋한 돌 제단이라, GO의 "옛 사당"(한국 전통 사당 오마주) 자리에
그대로 써도 이질감이 없다. 무덤·관·좀비 같은 킷의 나머지 조각은 이번에
전혀 안 받았다(altar-stone.glb + 그 텍스처 한 장만 추출).

## 폴더 매핑 (master.md 8장 구조와 다른 점만)

master.md 8장은 `characters/enemies/bosses/animals/buildings/environment/
vegetation/rocks/props/weapons/armor/effects/UI/audio`를 권장 구조로 든다.
지금은 그중 실제로 채운 4개 + 기존 `environment/`(66-1장, .tres 전용)뿐이다:

```text
assets/
├── characters/   character-{a,b,c,d}.glb + Textures/texture-{a,b,c,d}.png
├── vegetation/   tree_oak.glb · crops_wheatStageB.glb
├── rocks/        rock_largeA.glb · rock_smallA.glb
├── buildings/    wall-block.glb · roof-gable.glb · pillar-stone.glb ·
│                 planks.glb + Textures/colormap.png
├── dungeon/      gate-rock.glb + Textures/colormap.png (동굴 입구)
├── shrine/       altar-stone.glb + Textures/colormap.png (옛 사당)
└── environment/  env_pc.tres · env_mobile.tres (66-1장, GLB 아님)
```

텍스처가 있는 GLB는 `Textures/<파일>.png`를 **glb와 같은 폴더 밑에** 둬야
한다 — glTF가 `"uri":"Textures/xxx.png"`처럼 자기 위치 기준 상대경로로
참조하기 때문이다(킷 하나 안에서 여러 모델이 텍스처 하나를 공유하는 구조).

## 텍스처 임포트 설정 (2026-09-11⑨, Mobile Performance Pass)

새 텍스처를 헤드리스로 처음 받으면 Godot 기본값 그대로 **무압축
(Lossless) + 밉맵 없음**으로 들어온다 — 에디터에서 "이 텍스처는 3D에
쓰인다, VRAM 압축으로 바꿀까?" 프롬프트가 뜨는 자동 감지가 헤드리스
CLI로는 한 번도 안 걸렸기 때문이다(사람이 인스펙터를 직접 열어야 뜨는
프롬프트). 실제로 `colormap.png`(buildings·dungeon 공용) ·
`texture-{a,b,c,d}.png`(characters) 여섯 장 전부 이 상태였던 걸 확인하고
`compress/mode=2`(VRAM Compressed) + `mipmaps/generate=true`로
바꿨다 — 3D 월드에서 멀리 보이는 나무·건물·인물 텍스처에 밉맵이 없으면
GPU 대역폭도 더 먹고 앨리어싱(반짝임)도 더 심해진다.

앞으로 새 킷을 받을 때 같은 구멍이 안 생기도록 `project.godot`에
`[importer_defaults]`로 텍스처 임포트 기본값 자체를 바꿔 뒀다 — 이제
새로 받는 텍스처는 처음부터 VRAM Compressed + 밉맵으로 들어온다.

## 쓴 파일과 실측값

Godot 4.7.2 콘솔 빌드로 각 GLB를 실제로 인스턴스화해서 `VisualInstance3D.
get_aabb()`를 합쳐 실측했다(추측 아님) — 아래 스케일은 그 실측치를
기존 primitive 크기에 맞춰 역산한 것이다.

| 파일 | 실측 크기(m) | 피벗 | 쓰는 곳 |
|---|---|---|---|
| `vegetation/tree_oak.glb` | 0.64 × 1.23 × 0.74 | 중앙(대략) | 숲 타일, ×4.5 스케일 |
| `rocks/rock_largeA.glb` | 0.78 × 0.26 × 1.02 | 바닥 | 산 타일 절반, ×2.6 |
| `rocks/rock_smallA.glb` | 0.36 × 0.19 × 0.36 | 바닥 | 산 타일 나머지 절반, ×3.5 |
| `buildings/wall-block.glb` | 1 × 1 × 1 | 바닥 | 마을집 벽, 10×10 발자국 둘레에 4층 격자 조립(스케일 없음) |
| `buildings/roof-gable.glb` | 1.1 × 0.57 × 1.07 | 바닥 | 마을집 지붕, ×10 |
| `buildings/pillar-stone.glb` | 0.16 × 1.0 × 0.16 | 바닥 | 폐허 기둥, 높이=스케일값 |
| `buildings/planks.glb` | 1 × 0.06 × 1 | 바닥 | 다리(44개 이어 붙임) |
| `characters/character-a.glb` | 1.6 × 2.7 × 0.8 | 바닥 | 플레이어, ×1.25 |
| `characters/character-b.glb` | (a와 같은 골격 — 실측 생략) | 바닥 | 마을 촌장, ×1.25 |
| `characters/character-c.glb` | (a와 같은 골격 — 실측 생략) | 바닥 | 떠돌이 상인, ×1.25 |
| `characters/character-d.glb` | (a와 같은 골격 — 실측 생략) | 바닥 | 산적, ×1.25 |
| `dungeon/gate-rock.glb` | 4.0 × 4.05 × 2.454 | 바닥 | 동굴 입구, 균일 ×(6/4.05≈1.48) |
| `vegetation/crops_wheatStageB.glb` | 0.54 × 0.53 × 0.45 | 바닥 중앙 | 논밭 타일, ×2.5(개체별 0.8~1.2 추가 배율) |
| `shrine/altar-stone.glb` | 1.04 × 0.49 × 0.65 | 바닥 중앙 | 옛 사당, 균일 ×2.5 |
| `dungeon/room-small.glb` | 12.0 × 4.4 × 12.0 | 바닥 중앙 | DUNGEON 첫 방(고분 테마), 스케일 없음 — VERTICAL_SLICE_DUNGEON.md |
| `dungeon/gate.glb` | 4.4 × 4.4 × 1.4 | 바닥 중앙 | DUNGEON 방 출구, 스케일 없음 |
| `dungeon/corridor.glb` | 4.0 × 4.05 × 4.0 | 바닥 중앙 | DUNGEON 방 사이 복도 타일, 스케일 없음 — 여러 방 연결(2026-09-12) |

"피벗 바닥"은 원점(0,0,0)이 모델의 발밑이라는 뜻 — primitive였을 때는
대부분 중앙 피벗(BoxMesh/SphereMesh/CylinderMesh 기본값)이라 `height*0.5`
만큼 띄워야 했는데, 이 킷들은 그럴 필요가 없다. 빌더 스크립트를 볼 때
이 차이를 헷갈리지 말 것.

## 마을집 — 처음엔 비균등 스케일, 지금은 실제 모듈 조립

`wall-block.glb`는 1×1×1 모듈 조각 하나다. 처음 GLB 교체(41·45·46장)
때는 "primitive 자리를 GLB로 바꾼다"는 범위였지 벽 타일링 시스템을
새로 만드는 게 아니라서 **비균등 스케일(10,4,10)로 늘려 기존 박스 자리를
그대로 대체**했었다 — 색 아틀라스(`colormap.png`)가 단순 색면이라 늘려도
눈에 띄게 이상하진 않았지만, 진짜 벽돌·판자 디테일이 있는 킷이었다면 이
방법은 안 통했을 것이다.

**완료(2026-09-11⑤).** 그 뒤 이어서 `landmarks_builder.gd::
_build_wall_perimeter()`로 실제 모듈형 조립으로 바꿨다 — `wall-block.glb`
를 늘리지 않고(스케일 1) 10×10 발자국(1m 칸) **둘레**에만 4층을 쌓아
이어 붙인다(안쪽 칸은 비움 — 어차피 못 들어가는 장식용 외형이라 밖에서
보면 꽉 찬 벽과 구별 안 되고, 400칸을 다 채우는 것보다 훨씬 가볍다).
집 하나당 36칸×4층=144개 인스턴스지만 MultiMesh 하나라 draw call은
집마다 여전히 1회(다리 planks.glb와 같은 방식). 충돌·지붕 배치는 기존과
동일한 발자국(`WALL_FOOTPRINT`, 예전 `body_size`와 같은 값)을 그대로
써서 바뀌지 않았다.

## 이번에 안 바꾼 것

- **사슴·까치·잉어·소(2026-09-12③⑤⑥, `animal_builder.gd`)** — 웹판
  동물 생태(늑대 제외 넷 다) 이식인데 어울리는 동물 GLB가 없어(동물
  킷을 새로 안 받음) 박스 조합으로 대체했다(사슴·소=몸통+머리, 까치=
  박스 하나, 잉어=납작한 박스). 다음에 CC0 동물 킷(예: Kenney Animal
  Pack이 있는지 확인)을 받으면 `_build_deer_body()`/`_build_magpie_body()`/
  `_build_carp_body()`/`_build_ox_body()`만 바꾸면 된다 — 위치·행동
  (배회·도주·앉았다 날아오르기·헤엄·정지) 로직은 시각과 분리돼 있어
  안 건드려도 된다. 이제 GO 동물 생태는 늑대(이미 전투 사건으로 있음)
  빼고 웹판 다섯 종을 다 옮긴 상태.
- ~~동굴 입구~~ — **완료(2026-09-11④).** Nature/Fantasy Town Kit엔
  어울리는 조각이 없어 CC0 Kenney Modular Cave Kit(신규 다운로드)의
  `gate-rock.glb`(아치형 바위 문, 바닥 피벗)를 받아 `assets/dungeon/`에
  넣고 균일 스케일(≈1.48)로 교체했다. wall-block처럼 단순 색 아틀라스가
  아니라 실제 바위 굴곡이 있는 조각이라 **비균등 스케일은 안 썼다**(위
  실측표 참고). 못 받아 왔을 때는 bridge와 같은 방식으로 예전 primitive
  박스로 대체(fallback). 동굴 입구는 여전히 지나갈 수 있는 통로가 아니라
  랜드마크 장애물(충돌 박스 그대로) — 실제 동굴 내부(방·복도)는 이 킷에
  있는 room/corridor 조각들로 나중에 할 일(Phase 3 이후, 아직 계획 없음).
  **후속(2026-09-12⑫)** — "나중에"가 왔다. GO가 아니라 DUNGEON 첫 방
  (`games/saga_dungeon/world/test_room.gd`)에서 `room-small.glb`·
  `gate.glb`를 이 킷에서 마저 뽑아 썼다 — 새 다운로드 없이 스크래치패드
  에 남아 있던 압축 해제본(`%TEMP%/cave_kit/extracted/`)에서 그대로
  복사(위 실측표 참고). 킷엔 `room-large`·`corridor-*`·`stairs`·
  `ladder` 등도 있어 방이 여러 개로 늘어날 때 계속 이 킷에서 가져오면
  된다 — VERTICAL_SLICE_DUNGEON.md가 제외한 "층 전체(여러 방 연결)"가
  다음에 여기로 이어진다.
  **후속(2026-09-12⑰)** — 그 "다음"이 왔다. 같은 압축 해제본에서
  `corridor.glb`(직선 복도 한 칸)만 추가로 뽑아 방 둘을 잇는 데 썼다
  (자세한 내용은 `docs/PROJECT_STATE.md` 2026-09-12⑰ 항목). 킷엔
  `corridor-corner`·`corridor-junction`·`room-large` 등 아직 안 쓴
  조각이 더 있다 — 방이 셋 이상으로 늘어나거나 갈림길이 생길 때 거기서
  더 가져오면 된다.
- ~~NPC(촌장·상인)·산적~~ — **완료(2026-09-11②).** 마을 촌장=
  `character-b.glb`, 떠돌이 상인=`character-c.glb`, 산적=
  `character-d.glb`. 같은 킷이라 추가 다운로드 없이 미리 받아 둔
  `chars/Models/GLB format/`에서 바로 골랐다. 산적 쪽은 "강타 예고"
  텔레그래프(몸 전체를 잠깐 물들이는 연출)가 캡슐 시절 `material_override`
  하나로 되던 걸, GLB는 몸통·팔·다리·머리가 각각 다른 MeshInstance3D라
  `GLBUtils.find_all_mesh_instances()`로 전부 찾아 같이 바꾸게 고쳤다
  (`bandit_encounter.gd::_set_visual_color`/`_clear_visual_color`) —
  평소엔 override를 안 걸어 텍스처가 그대로 보이고, 텔레그래프 순간만
  색을 입혔다가 원래 텍스처로 되돌린다.
- **모바일 프로파일에서 이 에셋들이 실기(저사양 기기)에서 어떻게
  보이는지** — 66-1장 실기 확인 방침대로 몰아서 할 일.

## 새 GLB 하나를 더 추가할 때

**뼈대 없는 단순 소품**(나무·바위·건물 조각처럼 "루트 하나 + MeshInstance3D
하나"): `games/saga_go/world/glb_utils.gd`의 `GLBUtils.extract_mesh(path)`
로 `Mesh` 리소스만 뽑아 기존처럼 `MultiMesh`에 태운다. 칸마다 노드를
만들지 않는다는 master.md 35장 원칙을 지키는 유일한 이유가 이거다.

**뼈대 있는 캐릭터**(`assets/characters/*`처럼 AnimationPlayer가 딸린 것):
Mesh만 뽑지 않고 **씬 전체를 그대로 인스턴스**한다(`Player.tscn`의
`Visual` 노드 예시 참고) — 애니메이션이 여러 노드의 Transform을 함께
움직이는 구조라 Mesh 하나만 떼어내면 못 쓴다.

## 검증

`--headless --editor --quit`(임포트) → `--headless --quit-after 5
--verbose`(TestVillage 완주) 둘 다 exit 0, error/warning/missing 로그
0건. verbose 로그로 GLB 8개 + PNG 2개 전부 정상 로드 확인. 실제 GUI
스크린샷으로도 확인 — 캐릭터가 텍스처까지 정상 렌더링(핑크색 "텍스처
없음" 표시 없음), 그림자 정상, 배경에 나무·지붕 형태 확인됨. 자세한
경위는 `docs/PROJECT_STATE.md` 2026-09-11 항목 참고.

**마을집 모듈 조립(2026-09-11⑤) 검증**: 새 GLB·텍스처 추가 없이 스크립트
로직만 바꾼 것이라 재임포트는 안 필요했고, `--headless --quit-after 5`를
연속 3번 돌려 **셋 다 exit 0·error/warn/missing 로그 0건** 확인. 집
하나당 인스턴스 144개(36칸×4층)로 계산이 맞는지는 코드 리뷰로 확인,
MultiMesh 인스턴스 수·충돌 박스 크기가 예전(`body_size` 10×4×10)과
그대로인지도 같이 확인. GUI 스크린샷 확인은 안 함(사용자 명시적 요청
없었음 — 실기기 확인은 몰아서 할 일에 쌓아 둠, 벽이 진짜 격자로 이어
붙어 보이는지는 다음에 몰아서 확인할 것).

**동굴 입구 교체(2026-09-11④) 검증**: `--headless --editor --quit`(임포트,
gate-rock.glb + colormap.png 재임포트 로그 확인) → `--headless
--quit-after 5`를 연속 3번 돌려 **셋 다 exit 0·error/warn/missing 로그
0건**(루트 CLAUDE.md "세 번 돌려 출력이 한 줄도 다르지 않은지" 습관대로).
`--verbose` 로그로 `res://assets/dungeon/gate-rock.glb`·
`res://assets/dungeon/Textures/colormap.png` 둘 다 정상 로드 확인. GUI
스크린샷 확인은 이번엔 안 함(사용자 명시적 요청 없었음 — 실기기 확인은
몰아서 할 일에 쌓아 둠).

**논밭·옛 사당 GLB 교체(2026-09-12) 검증**: `--headless --editor --quit`
(임포트, crops_wheatStageB.glb·altar-stone.glb·colormap.png 재임포트 로그
확인) → `--headless --quit-after 5`를 연속 3번, **셋 다 exit 0·
error/warn/missing/invalid/cannot 0건**. `--script`로 직접 인스턴스화해
두 GLB의 실측 AABB를 구했다(추측 아님, 위 실측표 값의 출처). 씬을 정식
경로(`--quit-after`, autoload 정상 초기화)로 돌렸을 때 `ShrineAltar`의
`global_position`이 `world_pos(2,1)` 계산값과 정확히 일치하는 것과
`Crops` MultiMesh의 인스턴스 수가 12(농지 2칸×6)인 것을 확인했다. **발견
— MultiMesh 인스턴스별 transform은 헤드리스 null 렌더러에서 `get_instance_
transform()`으로 읽으면 항상 identity로 나온다**(최소 재현: 빈 프로젝트
스크립트로 set/get 왕복만 해도 재현됨) — 렌더링 서버 쪽 버퍼가 헤드리스
더미 드라이버에서 안 채워지는 것으로 보이는 엔진 한계이지, 이번에 추가한
코드의 버그가 아니다(기존 나무/바위/다리/벽 MultiMesh도 같은 패턴이라
똑같이 이 한계에 걸릴 것). 그래서 이번엔 transform 자체가 아니라 위치
계산값(`pos0`)과 인스턴스 개수로 정확성을 확인했다 — 다음에 MultiMesh
배치를 다시 검증할 일이 있으면 `get_instance_transform()` 값을 믿지 말
것. GUI 실기 확인은 안 함(아래 다음 세션 목록에 추가).

**NPC·산적 교체(같은 날 뒤 이어 진행) 검증**: character-b/c/d.glb +
texture-{b,c,d}.png 추가 후 헤드리스 임포트 중 `f.is_null()` 오류가 한
번 떴다 — 새 텍스처 4장이 한꺼번에 재임포트되며 생긴 일회성 경합으로
보이고(같은 조건으로 바로 재실행하니 재현 안 됨), 실제 씬 실행 로그
(`--quit-after 5`)에는 애초에 안 뜬 적 없다. `--headless --quit-after 5`를
연속 3번 돌려 **셋 다 exit 0·오류 0건** 확인(루트 CLAUDE.md "세 번 돌려
출력이 한 줄도 다르지 않은지" 습관대로). GUI 스크린샷에서는 카메라가
마침 마을 촌장·상인·산적이 있는 자리를 비추지 않아 이번엔 눈으로는
확인 못 했다 — 헤드리스 로그로 네 캐릭터 GLB·텍스처 전부 정상 로드된
것만 확인됐다.

## 2026-09-13 — 아트 방향 전환, 이 문서의 Kenney 킷들은 순차 교체 대상

사용자가 원신(Genshin Impact) 같은 애니메이션 셀셰이딩 그래픽을 요청해,
위에 기록된 Kenney CC0 로우폴리 킷(각진 블로키 캐릭터·단순 색면 텍스처)은
이 방향과 안 맞는다고 판단했다. 결정·새 에셋 소스(VRoid Studio·Quaternius·
KayKit)·셰이더 계획·마이그레이션 순서는 `PLAN.md` **66-2장**에 적었다 —
여기서 반복하지 않는다. 이 문서(위 내용)는 지우지 않는다 — 지금 게임이
실제로 쓰고 있는 에셋의 출처 기록이고, 교체가 끝나기 전까지는 여전히
유효한 현재 상태다.

## 2026-09-13 — VRoid Studio 첫 캐릭터, 파이프라인 검증용 임시 에셋

`assets/characters_vroid/AvatarSample_A.vrm`(+ Godot 임포트용 `.glb`
사본) — pixiv VRoid Studio(무료, 공식 배포 인스톨러로 설치)가 기본
제공하는 샘플 아바타 4종(AvatarSample_A~D) 중 A를 **커스터마이징 없이
그대로** VRM으로 내보낸 것. 사용자가 "실제 캐릭터 외형은 누가 고를까"
질문(AskUserQuestion)에 "기본 프리셋 그대로 임시 내보내기"를 선택해
이렇게 했다 — **최종 캐릭터가 아니라 모델→임포트 파이프라인이 실제로
되는지 확인하기 위한 자리 표시자**다. 실제 플레이어·NPC 외형은 나중에
사람이 VRoid Studio를 직접 열어 디자인해서 교체한다.

내보내기 시 라이선스(VRM 퍼블릭 라이선스, 파일에 내장되는 메타데이터)를
VRoid Studio 기본값(제작자 한정·개인 비영리·재배포 금지)에서 **모든
유저·개인 및 법인 상업 이용 허용·재배포 허용·수정 허용**으로 바꿔
저장했다 — 게임에 실제로 넣어 배포할 가능성을 열어 둔 것. VRoid Studio
자체 이용약관도 동의 완료(pixiv 공식 안내: 상업적 게임 사용에 별도 제약
없음, 단 "VRoid로 만든 모델을 자동 생성·변형해 내보내는 앱"을 만드는 건
별도 라이선스 필요 — 우리는 그런 앱이 아니라 에디터로 완성한 캐릭터를
그대로 쓰는 것뿐이라 해당 없음).

**VRoid Studio 자체가 Unity 기반 GUI 앱이라 네이티브 접근성 트리(UI
Automation)가 안 잡힌다** — 버튼을 이름으로 찾아 누르는 방식이 안
되고, PowerShell에서 `user32.dll`의 `SetCursorPos`+`mouse_event`를
P/Invoke로 불러 좌표를 직접 클릭하고, 그때그때 화면을 캡처해(Read
툴로 확인) 다음 좌표를 잡는 방식으로만 조작했다. "샘플 모델 열기 →
내보내기 메뉴 → VRM 내보내기 설정(포맷·라이선스) → 파일 저장 대화상자"
전 과정이 이렇게 자동화됐다 — 이 저장소 CLAUDE.md에 있던 "VRoid는 GUI
전용이라 자동화 불가"라는 기존 판단은 **"실제 얼굴·헤어·옷 조형"에는
여전히 맞지만, "이미 있는 프리셋을 내보내기"까지는 자동화된다**로
정정한다.

**막힌 점 하나** — 파일 저장 대화상자(Unity 자체 구현으로 보임, 네이티브
Windows 공용 대화상자가 아님)에 절대경로(예:
`C:/Users/user/AppData/Local/Temp/.../AvatarSample_A.vrm`)를 통째로
타이핑하면 "파일 이름이 올바르지 않습니다" 오류가 났다 — 경로 구분자가
포함된 문자열을 파일명으로만 취급하는 것으로 보인다. 우회: 파일명만
단순하게(`AvatarSample_A.vrm`) 넣고 대화상자가 기본으로 여는 폴더(이번엔
`다운로드`)에 저장한 뒤, 저장된 파일을 찾아 원하는 경로로 직접 복사했다.
다음에 VRoid Studio에서 또 내보낼 때 이 문제를 다시 만나면 같은 우회를
쓸 것.

**Godot 임포트 검증** — Godot은 `.vrm` 확장자를 3D 씬으로 인식하지 않아
(glTF 임포터가 확장자로만 판별하고, `.vrm`은 내부적으로 표준 glTF
바이너리 컨테이너라 내용은 문제없음) 같은 파일을 `.glb`로 복사해야
했다. `Godot_v4.7.2-stable_win64_console.exe --headless --editor
--path <프로젝트> --quit`로 헤드리스 임포트 — **오류·경고 0건, 씬으로
정상 변환**(폴리곤 29542·재질 16·본 91 그대로 인식). 임포트 후
`project.godot`·`*.import` 의도치 않은 변경 없는지 `git diff`로 확인,
무관한 `texture-a.png.import` 줄바꿈 변경만 있어 `git checkout`으로
되돌렸다(루트 CLAUDE.md 경고대로 매번 확인하는 습관).

**다음에 이어서**: 실제 셀셰이더를 이 모델에 붙여 보는 것, 그리고
saga-unity 쪽에서도 같은 `.glb` 사본으로 임포트가 되는지 확인하는 것
(진행 상황은 `saga-unity/docs/ASSET_GUIDE.md` 참고).

## 2026-09-13 — KayKit/Quaternius 후보, 형태 비교용

`assets/_candidates_66-2/kaykit_medieval_hex/`(건물 2종·자연물 2종) —
**KayKit Medieval Hexagon Pack**(CC0, Kay Lousberg) 공식 GitHub 미러
(`github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0`)에서
`raw.githubusercontent.com` 직접 다운로드. itch.io 페이지를 거치지 않아
로그인·클릭 자동화가 필요 없었다(VRoid보다 훨씬 수월했다). `LICENSE.txt`
동봉. 헤드리스 임포트 오류 0건. **아직 후보일 뿐 — 어느 씬에도 안 물려
있다.** 자세한 형태 비교 결론(건물은 Kenney와 비슷한 각진 저폴리라
메시 교체 효과가 작고, KayKit 쪽 자연물도 각짐 — Quaternius 나무가
painterly 목표에 더 맞음)은 `PLAN.md` 66-2장 "Quaternius/KayKit 후보
다운로드 + 형태 비교" 참고.

**Quaternius Stylized Nature MegaKit**은 이번엔 실제 파일을 못 받았다 —
itch.io의 name-your-own-price 배포 페이지가 JS 렌더링 SPA라 정적
다운로드 URL이 없다(버튼을 사람이 브라우저로 눌러야 하는 자동화 불가
지점, 로그인은 불필요). 대신 `quaternius.com`의 정적 프리뷰 이미지만
받아 형태 판단에 참고했다 — 실제 모델 파일은 다음에 사람이 itch.io에서
한 번 받아 주면 이어서 임포트한다.

## 2026-09-19 — Mixamo 모션(idle/walk/run/attack/hit/dodge/death/pickup)

103-4 Mixamo 항목. 사람이 Adobe 계정으로 직접 받아 준 원본(Maria WProp
J J Ong 캐릭터의 애니메이션 전용 FBX 8개, 메시·텍스처 없이 뼈대+키프레임만,
saga-unity `Assets/Art/CharactersRealistic/`에 먼저 받아 둔 걸 재사용)을
`assets/_mixamo_src/`로 복사. **라이선스: Mixamo 표준(게임 사용 허용,
재배포 금지)** — saga-unity `CharactersRealistic`과 같은 이유로 원본도
산출물도 로컬 전용(`.gitignore`: `assets/_mixamo_src/`·
`assets/characters_vroid/anim/`), 다른 PC/세션은 원본을 다시 받아
`tools/mixamo_retarget.gd`를 돌려야 한다.

가져온 건 **동작(뼈대 회전 키프레임)뿐**이다 — Maria의 메시·텍스처(사실적
스타일)는 복사하지 않았다. `tools/mixamo_retarget.gd`가 GUI Bone Map
대화상자 없이 순수 계산으로 VRM Humanoid(`J_Bip_*`, GO `AvatarSample_A`·
FOREST `saga_forest_avatar_01`)에 리타겟한다 — 원리·검증 방법(부모 체인
1:1 대조, FK로 직접 발 높이 확인)은 스크립트 헤더 주석과 `docs/HISTORY.md`
이 날짜 항목 참고. `player.gd`(GO·FOREST 공용)가 기대하는 이름
(idle/walk/sprint)으로 묶은 `*_lib.res`를 `Player.tscn`/`ForestPlayer.tscn`의
`AnimationPlayer`에 물렸다. DUNGEON/STORY는 아직 안 건드림(DUNGEON은
character-a.glb 자체 애니로 충분, STORY 플레이어는 VRoid 아님).

## 2026-09-19 — Modular Cave 굴혈 mood 3(흙·석회·용암), 103-3 표

DUNGEON엔 GO의 `terrain_builder` LEGEND 같은 "이미 화면에 승인된" 기준색이
없어서(102-6 판정과 달리 procgen 색 자체가 없다), `tools/asset-forge/palette.py`의
`dungeon_dirt`·`dungeon_limestone`·`dungeon_lava` base8은 **새로 지어낸 첫
시안**이다(셋 다 "shadow" 롤만 go_ruins의 `cave_dark`를 재사용해 새 색을
최소화). `assets/dungeon/` 4종(corridor·gate·gate-rock·room-small) 전부
스냅 → `assets/generated/variants/*__dungeon_{dirt,limestone,lava}.glb`
12개, 헤드리스 임포트 오류 0. **씬엔 안 물렸다** — 103-5 절차대로 사람이
톤을 먼저 봐야 한다(비교 PNG는 res:// 트리 밖 스크래치패드에만 뒀다,
Godot이 불필요한 `.import`를 만들지 않게). 예비 판단: 용암 쪽은 스냅
결과가 주황/회색 위주로 나와 "용암 동굴"보다는 그냥 밝은 얼룩으로 보인다
— 더 어두운 벽·바닥 톤으로 재작업이 필요해 보인다(사람 확인 후 반영).

## 2026-09-20 — Quaternius Stylized Nature MegaKit(Standard, CC0) 실제 확보

사람이 `quaternius.itch.io/stylized-nature-megakit`에서 무료 Standard 버전
(68/116 모델, `Stylized Nature MegaKit[Standard].zip`, 99MB)을 직접 받아
`C:\Users\user\Downloads\`에 뒀다 — 09-13·09-19 때 자동 다운로드가 안 됐던
그 팩. 라이선스: `License_Standard.txt` 동봉, **CC0 1.0 Universal**(Kenney와
동일 계열, 출처 표시 의무 없음).

- 패키지 안엔 FBX·glTF·OBJ 세 포맷이 다 있다 — **glTF+.bin**을 썼다(기존
  관례와 같은 포맷, FBX 리타겟 이슈 회피).
- 이번엔 나무·덤불류만 골라 받았다(HISTORY 09-13 결론 "자연물 교체가
  건물보다 비용 대비 효과 큼" 그대로): `CommonTree_1~5`·`Pine_1~5`·
  `TwistedTree_1~5`·`DeadTree_1~5`·`Bush_Common`·`Bush_Common_Flowers`
  (22종) + 참조 텍스처 9장(`Bark_NormalTree(_Normal)`·`Leaves_NormalTree_C`·
  `Leaf_Pine_C`·`Bark_TwistedTree(_Normal)`·`Leaves_TwistedTree_C`·
  `Bark_DeadTree(_Normal)`·`Flowers`) 그대로 `assets/vegetation/`에 플랫
  배치(기존 Kenney `tree_oak.glb`·`crops_wheatStageB.glb`와 파일명 충돌
  없음). 바위(`Rock_Medium_*`)·잔디·꽃·이끼 등 나머지 46종은 이번엔 안
  받음 — 필요해지면 같은 zip(스크래치패드에 이미 풀려 있던 것은 세션
  종료로 사라짐, 원본 zip은 Downloads에 그대로 있으니 다시 풀면 됨)에서
  더 가져올 수 있다.
- 헤드리스 임포트(`--headless --editor --quit`) 오류 0, `.import` 34개
  정상 생성. `godot_regress.sh` 재실행 — 다섯 대표 씬 md5 완전히 불변
  (아직 씬에 안 물렸으니 당연), `.import`/`project.godot` 잡음 없음.
- **아직 어느 씬에도 안 물렸다** — 103-5 판정 절차대로 fit_height 스케일·
  실루엣 확인·팔레트 스냅은 다음 단계, 실제 배치는 102 그래픽 개편과
  같이 사람이 톤을 볼 때(§8-1).

## 2026-09-20 — Quaternius 나무 5종 × GO/FOREST 팔레트 4종 스냅(103-5 3~4단계)

`assets/vegetation/`의 Quaternius 나무(CommonTree_1·Pine_1·TwistedTree_1·
DeadTree_1·Bush_Common, 각 계열의 대표 1종)를 `palette.py snap-glb`로
go_village·go_coast·go_ruins·forest_green(신규 build) 4개 팔레트에 스냅
— 20개 GLB를 `assets/generated/variants/`에, 비교 PNG 20장은 res:// 트리
밖 스크래치패드에만 뒀다(103-3 dungeon 사례와 같은 이유).

- **눈으로 직접 확인(평면 PNG 비교, 3D 스크린샷 금지 규칙과 무관)**:
  DeadTree_1×go_ruins 는 어두운 회갈색으로 자연스럽게 낙착 — 폐허 톤에
  맞는다. CommonTree/Pine(정상 계열) 나무껍질은 원본 적갈색이 각 팔레트의
  가장 가까운 색(대개 village_wall/shrine_wood 계열 황갈색)으로 스냅되어
  괜찮아 보인다.
- **원본 잎 텍스처 확인**: `Leaves_NormalTree_C.png`(CommonTree/Pine 계열)는
  원래부터 초록, `Leaves_TwistedTree_C.png`(TwistedTree/Bush 계열)는 원래
  부터 빨강 — 버그가 아니라 종별로 다른 원작 색.
- **알아낸 제약**: 이 팩 GLB는 `COLOR_0`(정점색) 속성이 텍스처와 같이
  있는데(잎·나무껍질 둘 다), `palette.py`가 쓰는 trimesh 의 gltf 로더가
  로드 단계에서부터 이미 `COLOR_0`을 버린다(스냅 전 원본을 그냥 다시
  로드만 해봐도 동일 — 우리 스냅 로직 탓이 아니라 trimesh 자체 한계).
  그래서 `assets/generated/variants/`의 스냅 결과물은 정점색 정보가 없다.
  반면 `assets/vegetation/`의 원본 `.gltf`는 Godot이 직접 읽으므로
  `COLOR_0`이 그대로 살아 있다 — **원본은 안전, 스냅 변형본만 정점색 없음**.
  잎 색 자체는 텍스처가 이미 정하고 있어(위 항목) 큰 결함은 아닐 가능성이
  높지만, 실제 명암 차이는 GUI 로만 확인 가능 — 다음에 사람이 톤을 볼 때
  같이 봐야 한다.
- 헤드리스 임포트 오류 0, `godot_regress.sh` 통과(다섯 대표 씬 md5 불변,
  `.import`/`project.godot` 잡음 없음). **씬엔 안 물렸다**(§8-1).

## 2026-09-20 — Quaternius 나무 22종 전부 팔레트 스냅 완료(103-5 3~4단계 마무리)

09-20⑫에서 대표 5종만 하던 걸 나머지 17종(CommonTree_2~5·Pine_2~5·
TwistedTree_2~5·DeadTree_2~5·Bush_Common_Flowers)까지 같은 4팔레트
(go_village·go_coast·go_ruins·forest_green)로 마저 스냅 — 총 88개(22×4)
`assets/generated/variants/`에 확보. 새로 6개 조합을 더 눈으로 확인:

- CommonTree_2×go_coast·Pine_3×go_ruins·DeadTree_2×forest_green·
  Bush_Common_Flowers×go_village 는 자연스러움.
- **TwistedTree_2×go_village 는 애매함** — 원본 나무껍질이 잿빛이라
  go_village 팔레트의 가장 가까운 역할이 `mountain_stone`(회색)이 돼
  나무가 아니라 돌기둥처럼 보인다. 버그는 아니고(최근접 8색의 구조적
  한계), 102 그래픽 개편 때 사람이 이 조합을 쓸지 판단해야 한다.
- 헤드리스 임포트 오류 0(88개 전부)·`godot_regress.sh` 통과, 씬엔 안 물림.

## 2026-09-20 — Quaternius 나머지 46종(잔디·꽃·이끼·바위) 확보(Standard 68/68 전부)

09-20⑪에서 나무·덤불 22종만 받았던 것에 이어, 같은 zip(Downloads에 그대로
있음)에서 나머지 46종을 마저 꺼냈다 — 이제 Standard 버전 68종 전부
res:// 트리에 있다.

- **`assets/vegetation/`에 추가(21종)**: Clover 2·Fern 1·Flower_3/4
  Group/Single 4·Grass_Common/Wispy Short/Tall 4·Mushroom_Common/
  Laetiporus 2·Petal 5·Plant_1/1_Big/7/7_Big 4 + 텍스처 3장(`Grass.png`·
  `Leaves.png`·`Mushrooms.png`, `Flowers.png`는 이미 있음).
- **`assets/rocks/`에 추가(25종)**: Pebble_Round 5·Pebble_Square 6·
  Rock_Medium 3·RockPath_Round/Square(Small×3+Thin+Wide 각 계열) 11 +
  텍스처 2장(`PathRocks_Diffuse.png`·`Rocks_Diffuse.png`).
- 헤드리스 임포트 오류 0(46종 전부), `godot_regress.sh` 통과 — 다섯 대표
  씬 md5 불변, `.import`/`project.godot` 잡음 없음.
- **팔레트 스냅·씬 배치는 안 함** — 나무 22종과 달리 이번 46종은 아직
  "어디에 쓸지" 조차 결정된 바 없다(잔디·꽃은 FOREST 기존 꽃 교배
  시스템과 겹칠 수 있어 판단 필요, 바위는 이미 procgen.py 대안이 있어
  중복 여부도 확인해야 함). 다음 세션이나 102 개편 때 판단할 몫으로
  "확보·임포트 검증 끝" 상태로만 남겨 둔다.

## 2026-09-20 — Quaternius 바위 계열 대표 5종 팔레트 스냅(103-5 3~4단계)

`assets/rocks/`의 Quaternius 바위(Rock_Medium_1·Pebble_Round_1·
Pebble_Square_1·RockPath_Round_Wide·RockPath_Square_Wide)를 GO 3팔레트+
forest_green 에 스냅 — 20개 `assets/generated/variants/`.

- **눈으로 확인**: Rock_Medium×go_ruins 는 원본 이끼 낀 회녹색 바위가
  자연스러운 폐허 톤으로. Pebble_Round×go_coast 는 원본 배경의 초록
  잔디가 어색했는데 스냅 후 갈색 모래톤이 돼 오히려 해변에 더 맞게
  고쳐졌다. Pebble_Square×go_village·RockPath_Round_Wide×forest_green·
  RockPath_Square_Wide×go_village 전부 조약돌 길처럼 자연스럽다(마을
  정원길·숲길 후보로 쓸 만함). Pebble_Square 와 RockPath_Square_Wide 는
  같은 원본 텍스처(`PathRocks_Diffuse.png`)를 공유해 결과가 동일하다.
  다섯 조합 다 결함 없음 — 나무 때(TwistedTree×go_village 애매)와 달리
  이번엔 전부 무난.
- 헤드리스 임포트 오류 0(20개), `godot_regress.sh` 통과. **씬엔 안
  물렸다**(§8-1) — Pebble/RockPath 는 "정원·산책로 장식" 용도로 procgen
  바위(101-1 E 빈칸 채우기)와 다른 자리라 중복이 아니다, 다음에 배치
  판단.

## 2026-09-20 — Quaternius 잔디·꽃·이끼 계열 대표 5종 팔레트 스냅(시험, 용도 미확정)

`assets/vegetation/`의 잔디·꽃 계열(Fern_1·Grass_Common_Short·
Flower_3_Group·Mushroom_Common·Plant_1)도 나무·바위와 같은 절차로 시험
스냅 — 20개 `assets/generated/variants/`. **이건 "이 종을 실제로 쓴다"는
결정이 아니라 파이프라인이 이 종류에도 무리 없이 도는지 확인하는
시험이다** — FOREST 꽃 교배·마을 번들과 겹칠지는 여전히 미정.

- Fern_1·Flower_3_Group·Plant_1 은 전부 같은 공유 텍스처(`Leaves.png`,
  잎사귀·클로버·깃털 모양이 한 시트에 다색으로 모여 있는 아틀라스)를
  쓴다 — 원본의 초록/파랑/빨강/보라 다색이 스냅 후에도 각 팔레트의
  가장 가까운 역할(leaf/water/village_wall/mountain_stone 등)로 분산
  배정돼 다양성이 유지된다. 결함 없음.
- Grass_Common_Short 텍스처는 대부분 투명(알파 0)인 좁은 그라데이션
  띠라, 스냅 후 안 보이는 영역이 하늘색으로 바뀌어도 실제 렌더에는
  영향 없다(알파로 가려짐).
- Mushroom_Common 은 원본 주황 갓이 forest_green 의 "accent"(진분홍)로
  스냅돼 꽤 튀는 색이 된다 — 결함은 아니지만 "환상적인 버섯" 톤을
  원하는지는 사람이 볼 때 판단.
- 헤드리스 임포트 오류 0, `godot_regress.sh` 통과. **씬엔 안 물렸다**,
  이 종류를 실제로 쓸지는 FOREST 겹침 여부 결정 후.

## 2026-09-20 — Quaternius 바위 24종 전부 팔레트 스냅 완료

09-20⑮ 대표 5종에 이어 나머지 19종(Pebble_Round_2~5·Pebble_Square_2~6·
Rock_Medium_2~3·RockPath_Round_Small×3+Thin·RockPath_Square_Small×3+Thin)
까지 마저 스냅 — 바위 24종×4팔레트=96개 `assets/generated/variants/`
완비(나무 22종과 합쳐 총 229개 GLB).

- 새 조합 3개 확인: Rock_Medium_2×go_coast(이끼 바위→driftwood/보트그레이
톤, 무난)·Pebble_Round_3×go_ruins·RockPath_Round_Small_1×forest_green
둘 다 앞서 본 것과 같은 패턴으로 무난. 새 결함 없음.
- 헤드리스 임포트 오류 0(96개 전부), `godot_regress.sh` 통과. **씬엔
안 물렸다**(§8-1).

## 2026-09-20 — Quaternius 잔디·꽃 22종 전부 팔레트 스냅 완료 + 용도 판단

09-20⑯ 시험 5종(Fern_1·Grass_Common_Short·Flower_3_Group·Mushroom_Common·
Plant_1)에 이어 나머지 17종(Clover_1~2·Flower_3_Single·Flower_4_Group/
Single·Grass_Common_Tall·Grass_Wispy_Short/Tall·Mushroom_Laetiporus·
Petal_1~5·Plant_1_Big·Plant_7·Plant_7_Big)까지 마저 스냅 — 잔디·꽃류
22종×4팔레트=88개 `assets/generated/variants/` 완비(나무 22+바위 24+
잔디꽃 22=68종×4=272개, 기존 dungeon/props 25개 합쳐 총 297개).

- **용도 판단(사용자 승인)**: "FOREST 꽃 교배 시스템과 겹칠 우려"는 실제
  코드를 보니 근거 없음으로 확인 — `forest_planting.gd`의 심은 꽃은
  지금 3D 모델 없이 색 입힌 `SphereMesh` placeholder다(교배 단계별
  분홍/자홍/금빛 tint만). 즉 이 22종은 심은 꽃의 모델 후보가 될 수는
  있어도 지금 당장 경합하는 시스템이 없다 — 마을 번들 장식·바이옴
  지면 채움 등 순수 장식 용도로 스냅만 먼저 끝내고, 실제로 어디에
  박을지(심은 꽃 모델 교체 포함)는 여전히 102 그래픽 개편 때 사람 몫.
- `py` 런처로 처음 돌렸을 때 원인 불명 오류(exit 49, cp949 콘솔 인코딩과
  얽힌 argparse 출력 실패로 추정)로 68개 전부 실패 — Python 3.12
  `python.exe`를 직접 호출(`PYTHONIOENCODING=utf-8`)해 재실행해 해결.
  이 프로젝트에서 `palette.py` 등 한글 docstring이 있는 스크립트는 `py`
  런처 대신 python.exe 직접 경로를 쓸 것.
- 헤드리스 임포트 오류 0(88개 전부), `godot_regress.sh` 통과(다섯 대표
  씬 md5 불변, `.import`/`project.godot` 잡음 없음). **씬엔 안 물렸다**
  (§8-1) — 이걸로 Quaternius 나무·바위·잔디꽃(68종) 팔레트 스냅 4단계는
  전부 끝, 5단계(씬 배치)만 102 사람 몫으로 남는다.

## 2026-09-20 — KayKit Adventurers 무기 4종 확보 + 등급 5색 킷배싱(101-3 G)

`103-3` 표 "무기 kitbash" 항목 착수. 사람/세션 판단으로 자루·날·장식
모듈 대신 **완성 무기 4종**(1인 검·1인 도끼·단검·지팡이)을 골랐다 —
DUNGEON에 지금 무기 3D 메시가 전혀 없어(추상 아이템 데이터+토스트뿐)
"성장 가시화" 최소 요건(등급 1→4 스냅샷 비교)엔 이걸로 충분.

- **KayKit : Adventurers Character Pack**(Kay Lousberg, CC0) GitHub 미러
  (`github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0`)
  에서 `raw.githubusercontent.com` 직접 다운로드(2026-09-13 Medieval
  Hexagon Pack과 같은 방식, itch.io 로그인·JS 렌더링 불필요). glTF+
  bin 4쌍(`sword_1handed`·`axe_1handed`·`dagger`·`staff`) + 각각이
  참조하는 캐릭터 아틀라스 텍스처 4장(knight/barbarian/rogue/mage)을
  `assets/weapons/`에 신설 배치. 무기마다 아틀라스가 달라 4장 다 받아야
  했다(각 무기 UV가 자기 몫 아틀라스만 참조).
- **등급 색은 새로 안 지어냄** — `games/saga_dungeon/data/dungeon_items.gd`
  GRADES(key 0~4, 상품/양품/명품/보물/전설)의 기존 hex를 그대로
  `palette.py` `PALETTES["dungeon_grade"]`(role g0~g4)로 옮겨 24색
  JSON 빌드. `tint-glb`(색상·채도만 바꾸고 명도는 원본 그대로 둬 그라디언트
  안 깨짐, VRoid 옷과 같은 방식)로 무기 4종×등급 5색=20개
  `assets/generated/variants/`.
- 평면 비교 PNG(`tint-preview`, 3D 스크린샷 아님)로 sword_1handed g1(양품,
  파랑)·g4(전설, 금빛) 확인 — 명도 그라디언트 유지된 채 색상만 자연스럽게
  갈아 끼워짐, 결함 없음. g0(상품)은 원본 톤과 거의 같아(팔레트 자체가
  원본 hex라 당연) 기준점 역할.
- 헤드리스 임포트 오류 0(무기 원본 8개+변형 20개), `godot_regress.sh`
  통과(다섯 대표 씬 md5 불변, 잡음 없음). **씬엔 안 물렸다**(§8-1) —
  실제로 플레이어/적 손에 붙이는 건 102 그래픽 개편 때 사람 몫.
- 자루3×날4×장식3=36 조합의 나머지(도끼/지팡이 등급별 변형 등)는 필요해
  지면 같은 팔레트로 이어서 낼 수 있다 — 이번엔 "무기 하나당 등급별 GLB
  4개(101-3 G 요건)"를 검증하는 최소 스코프로 좁혔다.

## 2026-09-20 — Quaternius·무기 킷배싱을 실제 Test 씬에 배선(§8-1 예외, 사용자 명시 지시)

"실기 확인 전엔 새 콘텐츠 안 얹는다"(§8-1)를 사용자가 "오늘 만든 것도
Test 씬에 적용해줘"로 명시 override — 지금까지 "확보·스냅만" 해 두고
안 물렸던 나무·바위·잔디꽃·무기를 실제로 물렸다.

- **GO** `vegetation_builder.gd`: `tree_oak`/`rock_largeA`/`rock_smallA`
  (Kenney)를 `CommonTree_1`(village)·`DeadTree_1`(ruins)·`Rock_Medium_1`
  (큰)·`Rock_Medium_2`(작은, Quaternius)로 교체. Pebble·RockPath 계열은
  HISTORY 09-20⑰에서 이미 "산책로 장식" 용도로 못박아 뒀으니 산 바위
  자리엔 안 씀. Quaternius는 실척 모델이라 종별로 다른 배율이 필요해
  `REGION_TREE_SCALE`(트리마다) 신설 — 옛 최종 크기(tree_oak 5.52m·
  rock_largeA 0.675m·rock_smallA 0.669m)에 실측(trimesh) 역산해 맞춰
  승인판 손맛(이동·충돌 반경)을 그대로 지켰다. `_scatter_clutter()`
  신설(평지 6칸 중 1개꼴, 순수 시각·충돌 없음) — 잔디꽃 22종의 첫
  실사용(village/coast=Clover_1, ruins=Grass_Wispy_Short).
- **FOREST**: `forest_vegetation_builder.gd`·`forest_biome_scatter.gd`
  "rocky" — 나무·바위를 `vertex_color_material`로 완전히 덮어 칠하는
  판이라(구면 곡률 셰이더 요구) 텍스처 팔레트는 안 보인다 — 그래서 스냅
  변형이 아니라 `assets/vegetation|rocks/` **원본** gltf(CommonTree_1·
  Rock_Medium_1)를 그대로 쓰고, 스케일만 옛 크기에 맞춰 역산.
- **DUNGEON** `loot_pickup.gd`: 무기 노획물이 등급색 박스 대신 실제
  KayKit 무기 GLB를 쓴다. `dungeon_items.gd` BASES의 `look`을 4종으로
  근사 매핑(WEAPON_LOOK_KIND). **버그 하나 발견·수정** — 처음엔
  `load(path % tier)`를 굴림 직후 불렀는데, `--verbose` 헤드리스 로그에
  실제로 읽은 파일 경로가 그대로 찍혀 굴림(RNG)마다 로그가 달라져
  `godot_regress.sh` md5 비교가 깨짐(DUNGEON만 3회 중 섞여 나옴 확인).
  `GLBUtils.extract_mesh_from_scene()` 신설 + 무기 20종 전부 `preload()`
  로 미리 실어(늘 같은 순서로 로드) 해결 — 이 판단 근거는 코드 주석에도
  남겼다.
- **회귀 확인**: 헤드리스 임포트 오류 0, `godot_regress.sh` 3판(GO·
  DUNGEON·FOREST) md5 내부 일관 + issues=0(STORY·REALM은 안 건드려
  그대로). `project.godot`/`.import` 잡음 없음.
- **PC 빌드로 실행 파일 확인**(사용자 요청) — `saga-go`·`saga-dungeon`·
  `saga-forest` 세 판을 내보내(4.7.2 export 템플릿, HOW_TO_PLAYTEST.md
  §8 절차) 각각 올바른 Test 씬을 로드하는지 헤드리스로 확인, GUI로도
  직접 띄워 확인.
- **별개로 발견한 기존 버그(오늘 변경과 무관, 회귀 아님)** — GO
  TestVillage를 켜면 카메라가 스폰 직후 한동안 마을 건물 벽에 바짝
  붙어 뚫고 들어간 각도로 잡힌다(대각선 격자무늬 벽면이 화면을 거의
  채움, 캐릭터는 낙하 자세로 붕 떠 보임). **오늘 만든 변경을 전부
  스택시켜 되돌린 순정 코드에서도 똑같이 재현돼 사전 존재 버그로 확인**
  — 카메라 스폰 초기화 순서 문제로 추정, 별도 조사 필요. PROJECT_STATE
  "알려진 오류"에 남긴다.

## 2026-09-22 — procgen 비석(stele)을 GO 폐허에 실제 배선(§8-1 재override)

09-20⑥ `procgen.py`가 만들어 두고 씬엔 한 번도 안 물렸던 `stele_s1_01`/
`stele_s2_02`(1.6m, 실제 미터 — 별도 스케일 역산 불필요)를
`vegetation_builder.gd::_scatter_ruins_debris()`로 GO 폐허(ruins) 지역
폐허 바닥("R") 칸에만 순수 시각 장식으로 흩뿌렸다(충돌 없음, rock·
clutter와 같은 결). 폐허 지도가 7×7이라 "R" 칸이 21개뿐 — clutter와
같은 1/6 밀도로는 실측 1개만 나와 1/3로 올려 5개로 확정. 헤드리스
회귀 REGRESS OK, `.import`/`project.godot` 잡음 없음.

## 2026-09-23 — Quaternius Standard 팩 파일 대조 패턴 (`tools/asset-audit` 용)

09-20 절들이 문장으로 적은 파일(`RockPath_Round_Small×3+Thin`·`Flower_3/4` 등)을 점검 도구가 이름으로 대조할 수 있게
패턴으로 다시 적는다 — 출처는 위 "Quaternius Stylized Nature MegaKit(Standard, CC0)" 절 그대로다.
`rocks/RockPath_*.gltf` · `rocks/Pebble_*.gltf` · `rocks/Rock_Medium_*.gltf` · `vegetation/Flower_*.gltf` · `vegetation/Grass_*.gltf`

## 2026-09-24 — CC0 동작 묶음(`assets/characters_vroid/anim_cc0/`) — Mixamo 동작 갈음

- 출처: Quaternius **Universal Animation Library [Standard]**(CC0-1.0, opengameart.org/content/universal-animation-library), 받기·sha256 은 `../tools/char-forge/sources.json`.
- 만드는 법: `../tools/char-forge/README.md` §3 · 이 판 쪽은 `tools/ual_lib_build.gd`. 다른 PC 는 원본이 없어도 된다(.res 가 커밋돼 있다). 다시 굽을 때만 `py tools/char-forge/fetch_sources.py`.
- `AvatarSample_A`·`saga_forest_avatar_01`·`dungeon_hero_01` 셋 × 여덟 동작(idle·walk·sprint·attack·hit·dodge·death·pickup). 몸(VRoid)은 그대로다.
- 옛 `anim/`(Mixamo 리타겟, 로컬 전용)은 이제 어느 씬도 안 부른다.

## 2026-09-25 — 공방 툰 몸 셋(`assets/characters_cf/`) — 비교용, 게임엔 아직 안 씀

- 출처: Quaternius Universal Base Characters(머리)·Modular Character Outfits - Fantasy(옷)·Universal Animation Library(동작) — 전부 CC0-1.0, 받기·sha256 은 `../tools/char-forge/sources.json`. 파일마다 옆에 `*.license.json`(쓴 입력 목록).
- `cmp_go_01`(순찰자 여·긴 머리) · `cmp_forest_01`(농부 여·올린 머리) · `cmp_dungeon_01`(순찰자 남·가르마) — 레시피 `../tools/char-forge/recipes/_cmp_*.json`. 추출 텍스처(`cmp_*_T_*.png`)는 Godot 임포트가 만든 것.
- 쓰는 곳: `tools/compare/CharCompare.tscn`(지금 VRoid 와 나란히). 사람이 "못하지 않다"고 판정한 짝만 게임 몸을 바꾼다.

## 2026-10-01 — 옷 무늬 타일 64종(`assets/wardrobe/patterns/`) · 배경음 15곡(`assets/audio/bgm/`)

- 무늬: 로컬 AI(`sd_xl_base_1.0`, CreativeML OpenRAIL++-M — 상업 사용 허용)로 만든 640px 천·무늬 → 256px 이음매 타일 webp 64장(과거 20·현대 20·미래 20·문장 4). 사람·원작·작가 이름 없이 천·무늬 묘사만. 출처 `_provenance.json`, 표 `patterns.json`, 만드는 법 `../tools/ai-art/pack_patterns64.py`. 읽는 쪽(`world/wardrobe.gd`)은 아직 안 읽는다(G 티켓), `.import` 는 Godot 에서 한 번 열어 만든다.
- 배경음: 로컬 ACE-Step 1.5(코드·가중치 MIT, 상업 허용)로 만든 곡 15개(판 5 × 마을·들판·전투), 곡 키 = 파일 이름(`go-town` 등, `saga_core/audio/bgm.gd` 규약). 곡마다 `<키>.license.json`(프롬프트·씨앗·`edited_by_human`). 원작 곡명·아티스트 이름은 프롬프트에 안 썼다. 지금 `go-town`·`go-field` 만 연결돼 있다(`world/go_bgm.gd`), 나머지는 G 티켓.
