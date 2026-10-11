# 에셋 출처와 라이선스 (saga-dungeon)

> **W-0163(2026-10-11) — 빌린 동물·탈것 3D 를 지웠다.** Poly by Google(Tiger·Bear·Panda·Monkey·Boar·Owl·Crane·Elephant·Rabbit·Squirrel·Duck·Sparrow)·"Charlie" `SlimeEnemy`·Quaternius 말(Horse·White_Horse/Horse_White·Horse_Farm·Donkey·Zebra)·`Mesh_Crow` **GLB 파일은 이 판에 없다** — 게임은 자체 생성판 `saga-web/shared/assets/creatures3d/<id>.glb`(K-0096, 출처는 같은 폴더 `*.license.json`)를 쓴다(`assets3d.creatureFor`). 아래 그 모델들의 출처 표기는 **그 모델로 구웠던 2D 파생물(`beast_*.png`·스프라이트 시트 등)이 남아 있는 동안만** 유지한다 — 자체판으로 다시 구우면 지운다.

이 저장소는 공개다(<https://github.com/smh80602070-spec/swbins>). 새로 넣은 **바깥에서
가져온 에셋**의 출처와 라이선스를 여기 한곳에 적는다. **여기 없는 파일은 이 폴더에
두지 않는다.**

`saga-go`가 이미 확인해 둔 것과 **같은 에셋을 그대로 옮겨 왔다**(PLAN 4·5·6절
"실제 3D 에셋 사용" — "다섯 판 공통 방침: 코드로 그리지 말고 에셋으로"). 자세한
확인 경위(라이선스를 어떻게 확인했는지, itch.io 미러 등)는
`../saga-go/assets/ASSET_LICENSES.md` 를 따른다 — 여기서는 **이 판에 실제로 옮긴
파일**만 추린다.

---

## Poly Haven — 바닥·벽 돌 텍스처 (2026-09-04, `textures/dungeon/`)

| | |
|---|---|
| **만든 이** | Poly Haven (<https://polyhaven.com>) — `monastery_stone_floor`·`stone_tiles_02`·`mixed_rock_tiles`(바닥) · `castle_wall_slates`·`stone_wall_04`·`medieval_blocks_05`(벽) |
| **라이선스** | CC0 1.0 — 재배포 자유, 표시 의무 없음 |
| **받은 곳** | `api.polyhaven.com/files/<slug>`로 1k jpg 원본을 받아(md5를 API 응답과 대조해 확인) 768px로 줄이고 WebP(품질 85)로 재인코딩 |
| **파일** | `textures/dungeon/floor_stone.webp`(92KB)·`floor_stone_2.webp`(114KB, `stone_tiles_02`)·`floor_stone_3.webp`(95KB, `mixed_rock_tiles`) — 방 바닥. `wall_stone.webp`(174KB)·`wall_stone_2.webp`(152KB, `stone_wall_04`)·`wall_stone_3.webp`(150KB, `medieval_blocks_05`) — 방 경계 벽 넷 |

사용자가 "바닥·벽 텍스처부터 받아와서 적용해 달라"고 요청 — 다섯 판 어디에도
재사용할 만한 돌바닥/돌벽 텍스처가 없어서(사가만리 텍스처는 야외 지형용,
사가마을·사가종횡의 `tile_stone.png`는 16×16 픽셀아트) 새로 받았다.
`js/dungeon3d.js`의 `texMat()`이 `THREE.RepeatWrapping`으로 타일링한다 —
diffuse 한 장만 쓰고(노멀·러프니스 맵 없음), 재질은 여전히
`MeshLambertMaterial`이라 다른 소품과 재질 종류가 갈리지 않는다. 색은
층 테마(`stone`)가 텍스처 위에 그대로 곱해져 "층마다 다른 색"이 산다.

**2026-09-04(이어서)** — 처음엔 바닥·벽 각 한 장뿐이라 사용자가 "단조로운
텍스처"라고 짚었다. 나무·바위처럼 방 씨앗(`field3d.seedOf`)으로 셋 중
하나씩 고르게 늘렸다(`pickTex()`) — 판정 없는 순수 장식 선택이라
`buildClutter`와 같은 요령을 그대로 빌렸다.

## Quaternius — RPG Character Pack (2026-09-03, 사람 기본, `models/people/quaternius_rpg/`)

| | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com/packs/rpgcharacters.html>) |
| **라이선스** | CC0 1.0 (재배포 자유, 표시 의무 없음) |
| **받은 곳** | `saga-forest/assets/models/people/quaternius_rpg/` 에서 그대로 복사(같은 CC0) |
| **파일** | `Warrior.glb`·`Ranger.glb`·`Rogue.glb`·`Cleric.glb`·`Wizard.glb`·`Monk.glb`(원래 배포된 .gltf 임베드 base64를 바이너리 .glb로 변환 — 파싱 속도·용량 개선, 2026-09-03) |

`js/asset3d.js` 의 `HERO_RECIPES`(공개 기본값)가 이 여섯 벌을 가리킨다. 파일
하나에 몸·텍스처·리깅·걷기·공격·사망 클립이 다 들어 있어 아래 조합형의 옷·머리·
UAL1 몸짓이 필요 없다. 아래 조합형은 `HERO_RECIPES_FALLBACK` 으로 남겨 뒀다
(되돌림 자리).

## Quaternius — 사람 창고 셋, 옛 조합형 (`models/people/regular/` · `models/anim/`)

`saga-go`가 2026-08-29에 몸이 갈라지는 문제를 근본에서 없애려고 갈아 낀 그 셋이다
— 몸(Universal Base Characters) · 옷(Modular Character Outfits - Fantasy) ·
몸짓(Universal Animation Library)이 뼈 이름·순서(65개)까지 완전히 같아서
리타기팅 없이 그대로 물릴 수 있다.

| 항목 | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com>) |
| **라이선스** | **CC0 1.0 Universal** — 세 팩 다 `License.txt`에 명시 |
| **저작자 표시** | 필요 없다 |
| **재배포** | 허용된다 |
| **받은 곳** | `saga-go/assets/models/people/regular/` · `models/anim/UAL1_Standard.glb`
  에서 그대로 복사(원출처는 itch.io `quaternius.itch.io/*` `[Standard]` 무료 등급) |

넣은 파일 — `models/people/regular/` 한 폴더(`.gltf`는 같은 폴더의 파일을 이름으로
부르므로 흩어 두면 안 된다): 몸 둘(남·여) · 옷 넷(평민·순찰대 각 남녀) · 머리
여섯 · 텍스처(BaseColor만, Normal·Roughness·ORM은 뺐다 — `js/asset3d.js`의
`delam()`이 PBR을 벗기고 Lambert로 갈아 끼운다). `models/anim/UAL1_Standard.glb`는
몸짓 마흔한 벌(기본판, 루트 모션 없음).

## Quaternius — 배우·자연물 (`models/animals/`, `models/nature/`)

같은 만든 이·라이선스(CC0). `saga-go`의 `models/animals/Wolf.glb`(짐승 형
적 중 몸집 작은 쪽 — 들개)와 `Cow.glb`(몸집 큰 쪽 — 남만 코끼리병. 딱 맞는
코끼리는 CC0 로 못 찾아 큰 네발짐승으로 대신한다, 몬스터 다양화)와
`models/nature/CommonTree_1·2·3.glb`·`Rock_1·2·3.glb`(들판 소품 — 나무·바위)를
그대로 복사했다. 2026-09-04, **늪(swamp) Biome**을 새로 얹으며
`models/nature/CommonTree_Dead_1.glb`(고목 — `saga-forest`에서 옮김)도
같은 자리에 더했다. 같은 날 `Rock_Moss_1.glb`(이끼 낀 돌, `saga-forest`·
`saga-story`에서 옮김)도 `rock` 표에 넷째 변형으로 넣었다(PLAN 7절 "이끼").

## Quaternius — 폐허·절벽·제단 소품 (`models/props/`, `models/nature/Mountain_*.glb`)

같은 만든 이·라이선스(CC0). 들판의 나머지 소품(기둥·무너진 벽·절벽·제단)도
`saga-go`가 이미 받아 둔 것을 그대로 옮겼다 — 딱 맞는 낱개 "부러진 돌기둥"
에셋은 없어서, `saga-go`가 `ASSET_LICENSES.md`에 스스로 적어 둔 "사당·폐허의
다른 후보"를 그대로 따랐다.

| 파일 | 이 판에서 쓰는 곳 |
|---|---|
| `models/props/Arch.glb` | **기둥**(`pillar`) — 무너진 아치로 대신한다 |
| `models/props/Wall.glb` | **무너진 벽**(`wall`) |
| `models/props/Temple.glb` | **제단**(`altar`) — `saga-go`가 "사당" 후보로 적어 둔 그것 |
| `models/nature/Mountain_1·2.glb` | **절벽**(`cliff`) |
| `models/props/Mine.glb` | **동굴 입구**(`cavemouth`) — `saga-go`가 "광산 어귀"로 적어 둔 그것 |
| `models/buildings/MarketStand_1.glb` | **행상 좌판**(`stall`) |

## Quaternius — 잡초·모닥불·진짜 텐트 (2026-09-04, `saga-forest`에서 옮김)

같은 만든 이·라이선스(CC0). SAGA WEB.md 지시("풀·꽃·덤불·버섯·통나무" 등
자연물 밀도)를 따라 이 판에 감사(audit)를 돌려 보니 **다른 네 판은 다 갖고
있는데 이 판에만 하나도 없던 자리**였다 — 이미 `saga-forest`가 CC0 라이선스를
확인해 받아 둔 것을 그대로 옮겨 왔다(원 출처는 위 두 절과 같은 GLB 미러:
`nature_pack`·`crops_pack`·`medieval_village_pack`·`survival_pack`).

| 파일 | 이 판에서 쓰는 곳 |
|---|---|
| `models/nature/Grass_2.glb` · `Grass_Short.glb` | **풀**(`grass`) — 들판 잡초 층(`field3d.js` `clutterAt()`) |
| `models/nature/Flowers.glb` | **꽃**(`flower`) |
| `models/nature/Bush_1·2.glb` | **덤불**(`bush`) — 숲 성격에서만 |
| `models/props/Mushroom_1·2.glb` | **버섯**(`mushroom`) — 숲 성격에서만 |
| `models/nature/WoodLog.glb` | **통나무**(`log`) — 숲 성격에서만 |
| `models/props/Tent.glb` | **야영 천막**(`tent`, `survival_pack`) — 들판 캠프(camp)에서 세운다. 예전엔 장터 좌판을 대역으로 썼는데(아래 옛 기록), 그 좌판은 `stall` 키로 옮겨 행상 POI 전용이 됐다 |
| `models/props/Bonfire_Lit.glb` | **모닥불**(`campfire`, `medieval_village_pack`) — 들판 캠프의 불씨. 예전엔 "CC0로 못 찾았다"고 적어 뒀던 자리인데, `saga-forest`가 이미 찾아 둔 것을 몰랐을 뿐이었다 |

옛 기록(참고용, 지금은 위로 대체됨): 천막은 한동안 장터 좌판(MarketStand)을
대역으로 썼고, 모닥불은 도형(잿더미+빛나는 불씨) 그대로였다. 둘 다 GLB 를
못 받으면 여전히 그 도형으로 조용히 돌아간다(fallback).

## Poly Haven — 나무·바위·수풀·통나무 사진측량 스캔 (2026-09-04, `saga-forest`에서 옮김, `models/nature/realistic/`)

| | |
|---|---|
| **만든 이** | Rob Tuytel·Rico Cilliers(`island_tree_02`) · James Ray Cock·Dario Barresi·Rico Cilliers(`dead_quiver_trunk`) · Jenelle van Heerden(`rock_07`) · Dario Barresi·Rico Cilliers(`stone_01`) · Kless Gyzen(`rock_moss_set_01`) · Rico Cilliers(`shrub_04`) · Rob Tuytel(`dead_tree_trunk`) · Jenelle van Heerden·Rico Cilliers(`dead_tree_trunk_02`) — 전부 Poly Haven (<https://polyhaven.com>) |
| **라이선스** | CC0 1.0 — 재배포 자유, 표시 의무 없음 |
| **받은 곳** | `saga-forest`가 2026-09-03에 이미 받아 심플리파이·리사이즈·jpeg 압축까지 끝내 둔 파일을 그대로 복사(md5 동일로 확인). 변환 경위(정점 수·감량률 등 실측)는 `../saga-forest/assets/ASSET_LICENSES.md`의 같은 제목 절 참고 |

사용자가 "사가만리처럼 실사화" 요청 → 조사해 보니 **사람은 막다른 길**이었다
(Mixamo 재배포 금지, 대안 CC0 팩은 애니메이션 0개 — `saga-go/HANDOFF.md`
2026-09-04 절 참고). 대신 사가마을이 이미 검증한 자연물 실사화만 옮겼다.

| 파일 | 이 판에서 쓰는 곳 |
|---|---|
| `models/nature/realistic/IslandTree_02.glb` | **나무**(`tree`) |
| `models/nature/realistic/TreeDead.glb` | **고목**(`tree_dead`) — 늪(swamp) Biome 에도 쓰인다 |
| `models/nature/realistic/Rock_07.glb`·`Stone_01.glb`·`MossRock_a·b·c.glb` | **바위**(`rock`, 다섯 다 한 표) |
| `models/nature/realistic/Shrub_04.glb` | **덤불**(`bush`) |
| `models/nature/realistic/Log_a.glb`·`Log_b.glb` | **통나무**(`log`) |

옛 저다각형 Quaternius 셋(`CommonTree_*`·`Rock_*`·`Bush_*`·`WoodLog.glb`)은
지우지 않았다 — `js/asset3d.js`의 `NATURE_STYLIZED`가 되돌림 자리다.

## Quaternius — 마을(모루골) 건물 (`models/buildings/`)

같은 만든 이·라이선스(CC0). 마을을 3D로 세우며(`town.js`의 `DECOR`) 추가로
옮긴 것 — `saga-go`의 `models/buildings/`에서 그대로 복사했다.

| 파일 | 이 판에서 쓰는 곳 |
|---|---|
| `models/buildings/House_1·2·3·4.glb` | **집**(`house`) — 넷을 자리 씨앗으로 섞어 세운다 |
| `models/buildings/Well.glb` | **우물**(`well`) — 마을 한복판 |
| `models/buildings/Blacksmith.glb` | **대장간**(`blacksmith`) — 야장(冶匠) NPC 뒤에 |
| `models/buildings/Inn.glb` | **여관**(`inn`) — 갈대나루(나루터). `saga-go`가 이미 받아 둔 것을 옮겼다 |
| `models/buildings/Stable.glb` | **마방**(`stable`) — 자작재(산길). 2026-09-04, 같은 `medieval_village_pack`에서 새로 받았다 |
| `models/buildings/Mill.glb` | **방앗간**(`mill`) — 소금벌(염전). 2026-09-04, 같은 팩. 염전 전용 CC0 에셋은 못 찾아 대신한다 |
| ~~`models/buildings/Bell_Tower.glb`~~ | **탑**(`belltower`) — 2026-09-04(이어서) `models/buildings/realistic/tower_round.glb`로 교체됨. 아래 새 절 참고. 옛 파일은 지우지 않았다(되돌림 자리) |

**위성 마을 셋이 왜 서로 다른 건물을 받았나.** 처음엔(2026-09-04 앞선 커밋)
셋 다 집+우물뿐이라 "빈 방"은 면했어도 테마(나루터·산길·염전)가 안 살았다.
`medieval_village_pack`을 다시 훑어 보니 이미 여관·마방·방앗간이 있었다 —
갈대나루엔 나그네가 쉬는 여관, 자작재엔 산길 마방, 소금벌엔(염전 전용은
없어) 방앗간을 대신 앉혔다.

## Poly Haven — 탑 (`modular_fort_01`에서 조각 하나만 추림, 2026-09-04, `models/buildings/realistic/`)

| | |
|---|---|
| **만든 이** | Rico Cilliers — Poly Haven (<https://polyhaven.com>) |
| **라이선스** | CC0 1.0 — 재배포 자유, 표시 의무 없음 |
| **받은 곳** | `api.polyhaven.com` 의 `modular_fort_01`(성채 모듈 키트, 8K, 28,218 폴리곤, 22개 조각) 중 원형 탑 노드(`tower_round`) 하나만 추림 |
| **파일** | `models/buildings/realistic/tower_round.glb`(516KB) |

**다른 건물(집·우물·대장간·여관·마방·방앗간)은 못 찾았다.** Poly Haven
모델 카탈로그(521개) 전수 확인 — `buildings`·`structures` 카테고리엔
현대 공장 파사드·롤러셔터 문·펜스 같은 도시 산업물뿐, 완결된 시골
건물이 없다(성문·철문 조각 정도). OpenGameArt CC0 집 모델도 몇 찾았지만
전부 손으로 그린 텍스처라 지금 실사화한 자연물·바닥·벽 옆에서 여전히
안 어울린다 — 껍데기만 CC0인 저다각형이지 사진측량이 아니다. **탑만은
됐다** — `modular_fort_01`이 성곽 모듈(벽·탑·성문 22조각)이라 그중
`tower_round`(원형 성탑) 하나가 "모루골 표지 건물" 자리에 그대로 맞았다.

**이 판엔 Blender·gltf-transform이 없어 처음으로 직접 변환했다**(다른
실사화는 전부 `saga-forest`가 이미 만들어 둔 파일을 복사만 했다). 순서:

1. `api.polyhaven.com/files/modular_fort_01`로 2k glTF(별도 `.bin`+텍스처
   9장 — wall·trim·plaster 재질별 diffuse·법선·거칠기)를 확인
2. **diffuse 세 장만** 받았다(법선·거칠기는 이 판 재질(`MeshLambertMaterial`)에
   안 쓰인다 — `delam`과 같은 이유, 위 `SAGA-HANDOFF.md` 2026-08-29절 참고).
   md5를 API 응답과 대조해 확인
3. `.gltf`의 각 재질에서 `normalTexture`·`metallicRoughnessTexture`를
   지웠다(Python으로 JSON 직접 편집) — 없는 텍스처를 참조하면 로더가
   깨진다. diffuse만 남은 자리엔 없는 법선·거칠기 파일 자리에 4×4 자리표
   이미지를 채워 넣어(어차피 참조 안 됨) 로더가 파일을 못 찾는 일이 없게 함
4. diffuse 세 장을 768px로 줄이고 jpeg 품질 85로 재압축
5. `trimesh`(Python, `pip install trimesh`)로 `.gltf`를 읽어 `tower_round`
   노드 둘(재질 두 개짜리라 지오메트리가 둘로 갈린다)만 새 Scene으로
   추려 단일 `.glb`로 구웠다 — 나머지 21개 조각(벽·성문 등)은 버렸다
6. 헤드리스 스크린샷(SwiftShader)으로 단독 렌더 확인 → 실제 마을 장면에
   놓고 확인 → 헤드리스 진단 241/241(3회 동일) 회귀 없음

성곽 모듈의 나머지 조각(벽·성문 등)도 CC0로 남아 있다 — 마을 담장·성문
꾸미기 등으로 나중에 더 쓸 수 있다(다음에 필요하면 이어서 추릴 것).

### 남은 건물 여섯(집·우물·대장간·여관·마방·방앗간) 재탐색 — 2026-09-04(이어서), 결론: 여전히 없음

탑에 이어 나머지 여섯도 실사화하려고 **위 셋(Poly Haven 카탈로그·OpenGameArt·
Sketchfab) 말고 다른 출처**를 새로 훑었다. 코드는 한 줄도 안 건드렸다 —
바꿔 끼울 게 없었기 때문이다.

- **Poly Haven — 카탈로그 훑기 대신 검색 API로 재검증.** `api.polyhaven.com/assets?t=models`
  전량(모델 하나하나의 이름·카테고리·태그)을 `well`·`blacksmith`·`smith`·
  `windmill`·`mill`·`inn`·`tavern`·`barn`·`stable`·`cottage`·`farmhouse`·
  `hut`·`village`·`house`·`cabin`·`shed` 로 훑어도 **0건**(`the_shed`라는
  이름의 소품 컬렉션이 하나 걸렸지만 공구 상자류였지 건물이 아니었다).
  앞선 "카탈로그 521개 훑음"이 카테고리 브라우징이었다면 이번엔 전수
  키워드 검색이라 훑는 방법이 달랐는데도 결론은 같았다 — **Poly Haven엔
  이 여섯이 원천적으로 없다.**
- **ambientCG — 이번에 처음 확인.** 텍스처·HDRI 위주 사이트인 줄 알았는데
  "3D Models" 카테고리가 있어 API(`api/v2/full_json`, `type=3DModel`)로
  같은 키워드 조합을 검색 — **0건**. 전체 3D 모델 수 자체가 적고
  (음식·소품류가 대부분) 건물이 아예 없다.
  ambientCG의 텍스처(바닥·벽)는 이미 다른 절에서 쓰고 있으니 헷갈리지 말 것.
- **itch.io — CC0 태그로 찾은 건 다 이미 걸러진 패턴 그대로였다.**
  `KayKit - Medieval Hexagon Pack`(마방·풍차·대장간·여관 다 있다!)과
  `Quaternius Medieval Village MegaKit` 둘 다 CC0에 건물 종류도 맞지만,
  **둘 다 저다각형 스타일(그라디언트 아틀라스 텍스처, 사진측량 아님)** —
  지금 실사화한 나무·바위·바닥·벽·탑 옆에서 다시 안 어울리는 그 문제로
  돌아간다(자연물 스타일 문제와 완전히 같은 이유). `saga-dungeon`이 지금
  집·우물·대장간에 쓰고 있는 `medieval_village_pack`도 사실 이 계열이다.
- **PolyScan(`polyscann.com`) — 이번에 처음 찾은 새 출처, CC0지만 로그인
  장벽에 막혔다.** "8K PBR 텍스처·CC0·로그인 불필요"를 내세우는 사이트라
  기대했지만, 실제 3D 모델 32개 전체가 **"Early Access" 상태로 Patreon
  로그인 뒤에 있다**(집 셋 — `medieval-stone-house`·`medieval-wooden-house`·
  `medieval-stone-and-wood-cottage` — 을 찾았지만 셋 다 이 상태다. 대장간은
  건물이 아니라 모루 소품(`medieval-blacksmith-anvil`) 하나뿐이고 우물·
  마방·방앗간·여관은 카탈로그에 아예 없다). 페이지에 "0일 뒤 공개"라는
  카운트다운이 있었지만 실제 다운로드 버튼은 여전히 Patreon 로그인을
  요구했다(정적 HTML에 직접 다운로드 링크도 없음 — JS+인증으로만 열린다).
  Sketchfab을 보류시킨 것과 같은 원칙("로그인 없이 받는다")으로 지금은
  보류. **나중에 이 사이트의 Early Access 딱지가 실제로 풀리면 다시 볼
  가치가 있다** — 집·오두막 셋은 스타일만 맞으면 후보가 된다.
- **BlendSwap — 새로 걸린 두 가지 장벽으로 기각.** 검색하면 대장간·건물
  모델이 여럿 나오지만(`Medieval House 005/007 - Blacksmith` 등),
  ① **다운로드에 로그인이 필요하다**(계정 없이 정적 페이지만 열면 로그인
  버튼만 보인다), ② 더 근본적으로 **이 자리(saga-dungeon 작업 환경)엔
  Blender가 설치돼 있지 않다** — 탑을 옮길 때 처음 겪은 "Blender 없음"
  제약이 여기서 결정타가 됐다. BlendSwap 모델은 대개 `.blend` 안에
  프로시저럴(노드 기반) 재질이라 **구운 텍스처 파일이 따로 없고**, glTF로
  내보내려면 Blender로 한 번 구워야 한다 — Python `trimesh`만으로는
  프로시저럴 셰이더를 읽을 수 없다. Blender가 없는 한 이 출처는 원천 봉쇄다.

**결론 — 이번 세션도 여섯 다 못 찾았다, 억지로 안 바꿨다.** `house`·`well`·
`blacksmith`·`inn`·`stable`·`mill` 여섯은 여전히 `medieval_village_pack`
(저다각형)을 그대로 쓴다 — 부록 "코드로 그리지 말고 에셋으로"의 원칙대로
"안 되면 안 된다"고 적어 둔다. `js/asset3d.js`의 `DEFAULTS`·`js/dungeon3d.js`의
렌더 분기는 손 안 댔다(둘 다 이미 `BLD_REAL` 자리로 갈아 끼울 준비가 돼
있으니, 다음에 후보가 생기면 탑과 같은 방식으로 한 줄만 바꾸면 된다).

## PolyScan — 집 둘 (2026-09-04, 바로 이어서 — 위 "로그인 장벽" 판단을 뒤집음)

위 절에서 "PolyScan 32개 모델 전부 Patreon Early Access 로그인 뒤"라고
적은 것은 **틀렸다.** 사용자가 "로그인해서 받아봐"라고 지시해 다시
확인해 보니, 자산 상세 페이지의 정적 마크업(WebFetch가 처음 읽은 것)엔
"Early Access" 문구가 남아 있었지만 **실제 다운로드 버튼은 로그인 없이
바로 뜬다** — 헤드리스로 실제 페이지를 렌더링(SwiftShader)해 스크린샷을
찍어 보니 잠금 표시가 없었고, DOM에서 뽑은 CDN 링크(`cdn.polyscann.com`)를
직접 `curl`로 쳐 보니 인증 없이 **200 OK**로 그대로 받아졌다. 페이지 텍스트만
보고 판단한 앞 절의 결론이 실제 동작과 달랐던 사례 — 다음에 비슷한 "로그인
필요" 표시를 만나면 텍스트만 믿지 말고 실제 다운로드 링크를 직접 쳐서
확인할 것.

| | |
|---|---|
| **만든 이** | PolyScan (<https://polyscann.com>) |
| **라이선스** | CC0 1.0 — 사이트가 "재배포·상업적 이용 모두 자유, 표시 의무 없음"으로 명시 |
| **받은 곳** | `https://polyscann.com/asset/medieval-stone-house-5d87ba` · `https://polyscann.com/asset/medieval-wooden-house-9b1b7b` — 로그인·가입 없이 CDN에서 직접 다운로드(`cdn.polyscann.com/PBR+TEXTURE/…`) |
| **파일** | `models/buildings/realistic/house_stone.glb`(285KB) · `house_wooden.glb`(246KB) |
| **원본 형식** | OBJ+MTL+FBX, 4K PBR 텍스처(Albedo/AO/Normal/Roughness/Metallic) 3벌(House·Bucket·Carriage), `.rar`로 묶여 있다(이 작업 환경엔 rar 해제 도구가 전혀 없어 `winget install 7zip.7zip`로 새로 설치해 풀었다) |

**골라낸 것 vs 버린 것.** 원본은 집+양동이+수레가 한 장면에 같이 들어
있다(PolyScan 갤러리 사진에 다 나온다). OBJ를 재질별로 갈라(`House`·
`Wood`·`Bucket`/`Carriage`) **건물 몸체(House)와 지붕·트림(Wood) 둘만**
추리고 양동이·수레는 버렸다 — 탑과 같은 이유로 이 판의 렌더 함수는
건물 하나만 기대한다.

**변환 순서** (탑과 같은 `trimesh` 파이프라인, 이번엔 원본이 이미
glTF/gLB가 아니라 OBJ라 한 단계가 더 늘었다):

1. `.rar` 다운로드 후 7-Zip으로 해제
2. `trimesh.load(..., split_object=True, group_material=True)`로 OBJ를
   재질별로 분리 — **wooden_cabin 쪽은 처음에 재질 이름이 다 뒤섞여
   나왔다**(`material_0`만 잡혔다): obj 안의 `mtllib` 줄이 `House M_F.mtl`을
   가리키는데 실제로 든 파일 이름은 `MEDIEVAL BUILDING.mtl`이라 참조가
   깨져 있었다 — mtl 파일을 참조된 이름으로 복사해 두니 정상적으로
   `House`/`Wood`/`Bucket`/`Carriage` 넷으로 갈렸다. **OBJ를 재질별로 가를
   때 그룹 이름이 이상하게 나오면 먼저 mtllib 참조가 실제 파일명과
   맞는지부터 볼 것**(트림메시가 조용히 fallback해서 겉으로는 에러가
   안 난다)
3. `House_BaseColor.jpg`(집 몸체) · `Wood_BaseColor.jpg`(지붕·트림) diffuse만
   받아 4096→768px로 줄이고 jpeg 품질 85로 재압축(법선·거칠기·금속성 맵은
   `MeshLambertMaterial`엔 안 쓰인다 — 탑과 같은 이유)
4. `House`·`Wood` 지오메트리 둘만 새 Scene에 넣어 단일 `.glb`로 구웠다
5. 격리 렌더(`_inspect_house.html`, 커밋에는 안 들어간다)로 단독 스크린샷
   확인 — 방향(Y-up)·텍스처가 다 정상. **실제 마을 장면(`_demo.html#camp`)
   스크린샷은 이번엔 포기했다** — 옛 stylized 집으로 되돌려도 똑같이
   렌더러가 죽는(`Abnormal renderer termination`, GPU 프로세스
   `exit_code=-1073741819`) **이 환경 고유의 기존 불안정성**(36개 GLB를
   SwiftShader로 한 장면에 올릴 때 생김, 이 세션의 변경과 무관함을 베이스라인
   비교로 확인)이라, 단독 렌더 확인 + 헤드리스 진단(`_test.html` 241/241
   3회 동일, `_admin.html?selftest` ADMIN 12/12)으로 대신했다

**여전히 못 찾은 것** — 우물·대장간·여관·마방·방앗간. PolyScan 카탈로그
32개 중 건물은 이 집 둘뿐이고(대장간은 건물이 아니라 모루 소품 하나),
나머지 넷은 이 사이트에도 아예 없다. 위 "재탐색" 절의 이 부분 결론은
그대로 유효하다.

**실기기 확인 전** — 단독 렌더로만 확인했다. 다음 세션은 마을 화면에서
집 둘이 실제로 걸리는지(자리 씨앗으로 넷 중 둘만 남았으니 등장 빈도가
반으로 줄었다) 실기기로 봐 줄 것.

## KayKit — Dungeon Remastered 소품 (`models/dungeon/`)

**2026-09-01, 방 안 소품 실험적으로 갈아 낌.** 여태 상자를 쌓아 흉내 내던
상자·횃불·기둥·감옥 창살을 실제 던전 소품 팩으로 바꿨다. Quaternius 와는
다른 작가·다른 라이선스 확인 경로다.

| 항목 | |
|---|---|
| **만든 이** | Kay Lousberg (<https://www.kaylousberg.com>) |
| **라이선스** | **CC0 1.0 Universal** — 저장소 `LICENSE.txt` 에 명시 |
| **저작자 표시** | 필요 없다. 그래도 적어 둔다(예의) |
| **재배포** | 허용된다 |
| **받은 곳** | <https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0>
  (Kay Lousberg 본인 GitHub 조직 — itch.io `kaylousberg.itch.io/kaykit-dungeon-remastered`
  페이지가 이 저장소를 그대로 가리킨다) `addons/kaykit_dungeon_remastered/Assets/gltf/` |

`models/dungeon/LICENSE.txt` 에 원문을 그대로 받아 옮겨 뒀다.

### 넣은 파일 — `js/asset3d.js` 의 `dg:` 로 묶은 표에 적혀 있다

| 파일 | 쓰이는 곳 |
|---|---|
| `chest.glb` | **상자**(`dg:chest`, POI: 상자) |
| `torch_mounted.gltf.glb` | **횃불**(`dg:torch`, 방 장식 `decor` 의 `torch`) |
| `pillar.gltf.glb` | **방 안 기둥**(`dg:pillar`, 방 장식 `decor` 의 `pillar`) —
  들판(field)의 `pillar`(Arch.glb, 폐허 조각)와는 **다른 자리**다. 헷갈리지 말 것 |
| `barrier_column.gltf.glb` | **갇힌 우리 창살**(`dg:cage`, POI: 이벤트방 captive) — 넷을 귀퉁이에 둘러 세운다 |
| `barrel_large.gltf.glb` | **술통**(`dg:barrel`, 방 구석 잡동사니) |
| `box_small.gltf.glb` | **상자**(`dg:crate`, 방 구석 잡동사니) — `dg:chest`(POI 보물상자)와는 다른 자리 |
| `crates_stacked.gltf.glb` | **상자 더미**(`dg:crates`, 방 구석 잡동사니) |
| `banner_thin_red.gltf.glb` | **보스방 현수막**(`dg:banner`) — 뒷벽에 둘 건다 |
| `table_long.gltf.glb` | **행상 곁상**(`dg:table`) — 좌판(MarketStand) 옆에 곁들인다 |
| `chair.gltf.glb` | **의자**(`dg:chair`, 방 구석 잡동사니) — 2026-09-04, SAGA WEB.md 소품 감사로 추가 |
| `sword_shield.gltf.glb` | **무기·방패**(`dg:shield`, 방 구석 잡동사니) — 2026-09-04, 같은 감사로 추가 |
| `floor_tile_big_spikes.glb` | **함정**(`dg:spikes`, 방 구석 잡동사니) — PLAN §G "던전" 목록. **판정(피해)은 없다** — 방에 위험한 인상만 주는 순수 장식이다. 실제 피해를 주는 함정 기믹은 밸런스 문제라 사람이 볼 자리로 남겨 뒀다 |
| `bed_decorated.gltf.glb` | **침대**(`dg:bed`, 방 구석 잡동사니) — 2026-09-05, 아래 "침대·책상" 절 참고 |
| `table_small.gltf.glb` | **책상**(`dg:desk`, 방 구석 잡동사니) — `table_long`(행상 곁상, `dg:table`)과는 다른 자리. 2026-09-05 |

**2026-09-01 이어서** — 방 구석 잡동사니(술통·상자·상자 더미)를
`buildClutter()`(`dungeon3d.js`)가 방마다 귀퉁이 넷 중 씨앗으로 고른
둘(다섯 중 셋은 비워 둔다)에 세운다. `field3d.seedOf(floor, roomIdx, 'clutter')`
를 그대로 빌려 써서 같은 방은 늘 같은 자리에 같은 것이 선다. 판정과 무관한
순수 장식이라 **fallback 도형이 없다** — GLB 를 못 받으면 그 귀퉁이는 그냥
빈다(다른 `dg:` 항목과 다른 점).

**2026-09-01 문(`dg:door`)도 걸었다.** 다시 보니 방향 값이 **없는 게
아니라 애초에 필요 없었다** — 2D(`dungeon-view.js`의 `ROOM_W - 10`)·
미니맵(`minimap.js`)이 이미 문을 **늘 동쪽(오른쪽) 벽 하나에만** 그린다
(`dungeon.js`의 `makeDoors`가 y만 정하고 x를 안 정하는 것도 그래서다).
그래서 회전은 문마다 다른 값이 아니라 `dungeon3d.js`에 박아 둔 고정값
(`rotation.y = Math.PI/2`)이다 — 새 판정 값을 보태지 않았다(`dungeon.js`는
한 줄도 안 건드렸다). 별도 검사용 페이지(`_inspect_door.html`, 커밋에는
안 들어간다)로 문 GLB만 떼어 놓고 회전값별 실루엣을 대조해 방향을 확인했다
— 벽이 뻗는 방향(Z축)과 문의 긴 축이 맞아떨어지는 값이 이것이었다.
잠금·해금은 모델을 안 바꾸고 색(tint)만 바꾼다 — 2D가 오래 쓰던 신호
(잠기면 어둡게, 풀리면 금빛 + 작은 발광 표식)를 그대로 지킨다.

**아직 안 옮긴 것도 있다** — 이 팩에 있는 침대·열쇠·접시 따위는 이번에도
손 안 댔다(초·병은 아래 새 절에서 받았다). 방 하나에 다 몰아넣기보다
눈에 잘 띄는 것부터 순서대로 늘리는 중이다.

### 계단 (2026-09-04, `stairs_wide.gltf.glb`)

SAGA WEB.md "G. 던전" 목록의 "계단". `dungeon.js`의 `makeDoors()`가 층의
마지막 방에 내는 문은 `kind: 'stair'`(다음 층으로 내려가는 자리, 2D는
이미 🪜 아이콘으로 표시한다)인데, 3D는 여태 다른 문(전투·보물·우물·사당)과
**완전히 같은 아치**(`dg:door`)로만 그려 이 신호가 3D에는 없었다. 같은
KayKit 팩(이미 CC0 확인됨)에서 `stairs_wide.gltf.glb`를 받아 이 문 하나만
갈아 끼웠다(`dungeon3d.js`의 문 렌더 루프에 `dr.kind === 'stair'` 분기 하나).

- 다른 문과 같은 자리(동쪽 벽, `rotation.y = Math.PI/2`)·같은 잠금 색
  신호(`doorTint` — 잠기면 어둡게, 풀리면 금빛)를 그대로 물려받는다.
  **판정(`dungeon.js`)은 한 줄도 안 건드렸다** — 이미 있던 door 렌더 순수
  장식 갈래에 새 kind 분기 하나를 더한 것뿐이다.
- 격리 렌더(`_inspect_stairs_tmp.html`, 커밋 안 함)로 회전 네 가지를 나란히
  세워 확인 — 정면(steps가 카메라를 향함)이 제일 읽기 쉽지만, 문과 같은
  회전(옆면 쐐기 실루엣)도 계단으로 알아볼 만해 **문과 같은 회전값을
  그대로 썼다**(회전마다 다른 값을 주면 "문 회전은 고정값" 이라는 기존
  원칙이 깨진다). GLB를 못 받으면 다른 문과 같은 아치 도형(fallback)으로
  조용히 돌아간다.
- 자가진단·`_admin.html?selftest`로 회귀 확인, `sw.js` VERSION을 올렸다
  (자세한 수치는 `README.md` 참고).
- **실기기 확인 완료** — 사용자가 1층 마지막 방까지 들어가 직접 확인,
  "잘보여". 확인 중 별도로 "다 네모(GLB 폴백)로 보인다"·"던전이 검은
  화면"이라는 제보가 있었지만, 여러 단계로 좁혀 보니 **이 계단 기능과도,
  이 판 코드와도 무관했다** — 회사 정책이 적용된 그 크롬 프로필(회사
  즐겨찾기가 있는 프로필)의 일반 창에서만 나던 문제였고, 같은 프로필의
  시크릿 창·다른 브라우저(엣지)에서는 처음부터 멀쩡했다. 서비스 워커
  재설정(`_swreset.html`)·3D 손잡이 초기화·확장 프로그램 전부 끄기까지
  다 해보고도 정상 모드만 안 됐던 것이 결정적 단서였다 — 캐시·세이브·
  코드 어느 것도 원인이 아니라는 뜻이다. **다음에 비슷한 "실기기에서만
  안 보인다"는 제보를 받으면, 코드를 의심하기 전에 먼저 시크릿 창이나
  다른 브라우저로 한 번 대조해 볼 것** — 이번처럼 브라우저 프로필
  자체(회사 보안 정책·강제 확장 등)의 문제일 수 있다.

### 초·병 (2026-09-04, 계단 바로 다음)

SAGA WEB.md "F. 소품" 목록의 "초"·"병". 계단과 같은 KayKit 팩에서
`candle_lit.gltf.glb`(불 켠 초)·`bottle_A_green.gltf.glb`(코르크 마개
녹색 병)를 받아 `buildClutter()`의 방 구석 잡동사니 표(`CLUTTER_KIND`)에
더했다 — 술통·상자·의자·방패·함정과 같은 자리(여덟 중 하나, 넷 귀퉁이
중 다섯에 하나꼴로 비운다)에 섞여 든다.

- **같은 팩의 열쇠(`key.gltf.glb`)·접시 더미(`plate_stack.gltf.glb`)는
  이번에도 건너뛰었다** — 치수를 실측해 보니 세로(Y)가 가로(X)보다
  훨씬 짧다(키: x=0.896·y=0.403, 눕혀진 모양). 이 판의 `normalize()`는
  **세로 기준으로 키를 맞추는** 관례라(문·기둥·횃불 등 "서 있는" 소품에
  맞춘 것) 세로가 짧은 걸 그대로 넣으면 배율이 커져 가로가 의도보다
  두 배 넘게 부푼다 — 억지로 넣기보다 부록 "안 되면 안 된다고 보고한다"
  원칙대로 건너뛰었다. 초·병은 반대로 세로가 확실히 가장 긴 치수라
  (초: y=1.051 vs x/z=0.33, 병: y=0.886 vs x/z=0.37) 이 관례에 잘 맞았다.
- 격리 렌더(`_inspect_clutter_tmp.html`, 커밋 안 함)로 둘 다 정상 로딩·
  제 모양(불 켠 초·코르크 병)으로 확인했다.
- 자가진단·`_admin.html?selftest`로 회귀 확인, `sw.js` VERSION을 올렸다.

---

## 도감(펫) 초상 실사화 — 동물 14종 (2026-09-04, `models/animals/`)

`portrait3d.js`는 인물(부대원) 도감 카드는 이미 실제 3D 모델로 굽고 있었는데,
**펫(짐승)은 처음부터 빠져 있었다**(`kind !== 'hero'`면 곧바로 되돌아가게
짜여 있었다). 사용자가 "도감 일러스트 실사화 확인해줘"로 감사를 시작 —
펫 41종을 나눠 보니 신수(神獸) 11종(삼족오·해태·청룡·백호…)과 포켓몬
창작 짐승 16종(방아토끼·뿔도롱…, 옛 오마주 자리)은 창작물이라 CC0 모델이 있을 리 없어 손 안
대고, **실제 동물 14종만** 채웠다(사용자가 이 범위로 골랐다).

### 새로 받은 것 — Poly Pizza (poly.pizza)

이 판 첫 세션들이 "GitHub만 열린다"고 적어 둔 망 제약은 **이제 유효하지
않다** — `quaternius.com`·`poly.pizza`·`api.polyhaven.com`·`opengameart.org`
모두 직접 열린다(2026-09-04 확인). Poly Pizza는 Poly by Google(구글이
접었던 Poly 아카이브)과 Quaternius 등 여러 창작자의 CC0/CC-BY 모델을
`https://static.poly.pizza/<uuid>.glb`로 로그인 없이 바로 받을 수 있는
곳이라 이번에 처음 썼다.

| 파일 | 원본 | 만든 이 | 라이선스 |
|---|---|---|---|
| `ShibaInu.glb` | poly.pizza `/m/y4wdQpg767` | Quaternius | **CC0** |
| `Husky.glb` | poly.pizza `/m/wcWiuEqwzq` | Quaternius | **CC0** |
| `Cat.glb` | poly.pizza `/m/2f54vbV0In` | Quaternius | **CC0** |
| `Tiger.glb` | poly.pizza `/m/5A3w06FXUup` | **Poly by Google** | **CC-BY 3.0** |
| `Bear.glb`("Black bear") | poly.pizza `/m/56ym_pyVnel` | **Poly by Google** | **CC-BY 3.0** |
| `Panda.glb` | poly.pizza `/m/2T6A0o4Kq2h` | **Poly by Google** | **CC-BY 3.0** |
| `Monkey.glb` | poly.pizza `/m/0yRz2AkLuuo` | **Poly by Google** | **CC-BY 3.0** |
| `Boar.glb` | poly.pizza `/m/57fSWum6F1P` | **Poly by Google** | **CC-BY 3.0** |
| `Owl.glb` | poly.pizza `/m/eoAo21aoZHJ` | **Poly by Google** | **CC-BY 3.0** |
| `Crane.glb`("Sandhill crane") | poly.pizza `/m/dazPSSmELaQ` | **Poly by Google** | **CC-BY 3.0** |

> **Tiger · Black bear · Panda · Monkey · Boar · Owl · Sandhill crane** —
> © **Poly by Google**, [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/).
> `poly.pizza`를 거쳐 받았다. 크기·자리만 맞추었고 형상은 그대로다.

**저작자 표시가 필요한 CC-BY 일곱 개다 — `saga-go`의 까치(Crow)와 같은
자리(위 "이 저장소에서 CC-BY는 이것 하나뿐이다" 문구는 이제 이 판에서는
유효하지 않다, 일곱이 더 늘었다). 지우거나 옮길 때 위 문구를 같이 옮길 것.**

**용량 손질** — `poly.pizza`에서 받은 그대로 두면 `Monkey.glb`가 5.6MB
(2048×2048 PNG 텍스처 하나가 대부분)였다. `trimesh`(Python)로 각 재질의
`baseColorTexture`를 512px 넘는 변은 줄이고 재압축해 다시 구웠다 —
Monkey 5.6MB→382KB, Owl 2.7MB→399KB, Crane 1.07MB→239KB, Bear 720KB→160KB.
지오메트리는 손 안 댔다(치수·형상 그대로).

### 이미 있던 것 — 다른 판에서 그대로 옮김

| 파일 | 원본 자리 | 만든 이 | 라이선스 |
|---|---|---|---|
| `Deer.glb` | `saga-go/assets/models/animals/Deer.glb` | Quaternius | CC0 |
| `Koi.glb` | `saga-go/assets/models/animals/Koi.glb` | `cute_fish_pack`(saga-go가 이미 씀) | saga-go 문서에 별도 라이선스 절이 없다 — 재확인이 필요하면 `saga-go/HANDOFF.md` 참고. 이미 공개 저장소에 떠 있는 파일을 그대로 옮긴 것이다 |
| `Mesh_Crow.gltf`+`.bin`, `Tex_Crow.webp` | `saga-go/assets/models/animals/` | **Poly by Google** | **CC-BY 3.0** — `saga-go/assets/ASSET_LICENSES.md` "Poly by Google — 까치" 절의 그 문구를 그대로 적용한다 |
| `Frog.glb` | GitHub `trebeljahr/quaternius-showcase` `public/glb/easy_enemies_pack/Frog.glb`(이 판의 Wolf·Cow·Deer와 같은 미러) | Quaternius | CC0 |

### 펫 → 모델 대응표 (`js/asset3d.js`의 `pet:*`, `js/portrait3d.js`의 `PET_ASSET`)

| 펫 id | 이름 | 모델 |
|---|---|---|
| `pt_jindo` | 진돗개 | ShibaInu |
| `pt_sapsal` | 삽살개 | Husky(북슬북슬한 털이 가장 가까웠다) |
| `pt_tiger` | 백두산호랑이 | Tiger |
| `pt_bear` | 반달가슴곰 | Bear |
| `pt_magpie` | 까치 | Mesh_Crow(까마귀 — 딱 맞는 까치 CC0가 없어 같은 까마귀과로 대신한다, `saga-go`가 이미 같은 선택을 했다) |
| `pt_crane` | 학 | Crane |
| `pt_toad` | 두꺼비 | Frog |
| `pt_carp` | 잉어 | Koi |
| `pt_panda` | 판다 | Panda |
| `pt_monkey` | 원숭이 | Monkey |
| `pt_deer` | 사슴 | Deer |
| `pt_boar` | 멧돼지 | Boar |
| `pt_owl` | 올빼미 | Owl |
| `pt_cat` | 고양이 | Cat |

### 진짜 버그 하나 잡음 — 초상 카메라가 모델 몸통 한복판에 있었다

펫을 얹으려고 `portrait3d.js`의 `camPlan()`(초상 카메라 자리를 정하는
순수 함수)을 보니 주석이 "키 1로 눕힌 모델 기준"이라 적혀 있었는데,
실제로 `bake()`를 부르는 `pump()`는 인물이든 펫이든 **항상 `mul=42`**로
모델을 세운다 — 키가 1이 아니라 42다. 격리 렌더로 직접 확인해 보니
모델 바운딩박스가 `y: 0~42`인데 카메라는 `z=3.7`에 서 있었다 — **카메라가
동물 몸통 한복판(또는 사람 다리 사이)에 파묻힌 채 텅 빈 배경만 찍고
있었다.** 인물 초상도 같은 함수를 쓰므로 이 버그를 처음부터 물려받고
있었다(이번에 펫을 얹으며 픽셀 단위로 직접 확인해 보기 전까지 아무도
몰랐던 자리로 보인다).

**고침**(`js/portrait3d.js`) — `camPlan()`의 `span`·`look`에 `UNIT`(=42,
`pump()`가 주는 그 값과 같다) 상수를 곱해 실제 키 기준으로 맞췄다. 카메라
원거리 클리핑(`far`)도 예전 값(40)이 새 카메라 거리(최대 약 160)보다
작아 물체가 아예 안 잘려 나가던 것을 400으로 올렸다. 격리 렌더로 고치기
전(빈 배경만)·고친 뒤(고양이·호랑이 등 또렷하게 보임)를 직접 대조해
확인했다 — `_inspect_petportrait_tmp.html`·`_inspect_heroportrait_tmp.html`
(둘 다 커밋 안 함).

**펫은 카메라 결도 다르게 얹었다** — 사람은 두 발로 서 있어 "가슴 위"
구도가 맞지만, 짐승은 네 발이라 몸통이 키의 1.5~2배까지 옆으로 길다
(`normalize()`가 키 기준으로만 배율을 매기기 때문). 몸 전체가 잘리지
않도록 펫일 때만 더 물러나고(`span` 키움) 낮은 곳을 보고(`look` 낮춤)
옆모습에 가깝게(`yaw` 키움) 잡는다.

**격리 렌더로 14종 다 확인** — 진돗개·삽살개·까치·두꺼비·판다·사슴·
멧돼지·고양이·호랑이·잉어는 또렷하게 보였다(순서대로, 한 번에 하나씩
구운 것과 여럿을 한꺼번에 부른 것 둘 다 시도). 곰·원숭이·올빼미·학은
**여럿을 한꺼번에 굽게 하면** 이 환경(헤드리스 SwiftShader)이 느려
`portrait3d.js`의 재시도 상한(24회×220ms≈5.3초, 실패를 한 번만 적어 두고
다시 안 시도하는 안전장치, 2026-09-02에 이미 있던 규칙)에 걸려 조용히
포기했지만, **하나씩 격리해 굽게 하면 넷 다 정상적으로 보였다** — 진짜
결함이 아니라 이 헤드리스 환경이 여러 WebGL 컨텍스트를 동시에 못
버티는 익히 알려진 사정이다(실제 사용자 브라우저는 도감을 스크롤하며
하나씩 굽게 되어 있어 이 경합이 거의 안 생긴다).

자가진단 **241/241** 3회 동일, 회귀 없음(펫 초상은 `_test.html`이 값으로
보지 않는 순수 화면 층이라 카운트 자체는 안 바뀐다). `sw.js` VERSION을
올렸다(수치는 `README.md` 참고).

---

## 침대·책상 (2026-09-05, 펫 초상 다음) — "침대는 안 맞는다"던 판단이 틀렸다

`js/asset3d.js`에 `dg:candle`·`dg:bottle`을 넣을 때(위 "초·병" 절) 옆에
적어 둔 주석이 "침대·접시·열쇠는 세로가 주된 치수가 아니라 이 파이프라인과
안 맞는다"였다. 이번에 SAGA WEB.md "F. 소품" 감사를 이어 하려고 실제로
GLB 치수를 재 보니 **키(key, 세로 0.40 : 가로 0.90 = 44%)·접시(plate, 세로
0.13 : 가로 0.97 = 13%)는 정말 거의 눕다시피 납작해 안 맞았지만, 침대는
전혀 다른 비율**(`bed_decorated`: 세로 1.70 : 가로 3.06 = 56%, 이미 이
목록에 쓰고 있는 `dg:chest`의 50%와 같은 급)이었다. 확인 없이 "침대도
비슷하겠지"로 셋을 한 묶음에 넣었던 게 오판 — PolyScan을 "로그인 필요"로
잘못 판단했던 것과 같은 종류의 실수다(텍스트·짐작만 보고 실측을 안 함).

- **쟀다** — GLB의 glTF JSON 청크(`accessors[].min/max`)를 파이썬으로 직접
  읽어 세 파일(`key`·`plate`·`bed_decorated`)의 바운딩박스를 재 대조했다.
  `trimesh`를 새로 설치할 필요 없이 파일 안에 이미 있는 값을 그대로
  읽은 것 — glTF 내보내기는 POSITION accessor에 min/max를 반드시 적는다.
- **`bed_decorated.gltf.glb`**(KayKit Dungeon Remastered, 이미 CC0 확인된
  같은 팩) — 맨 프레임(`bed_frame`)보다 이불·베개가 덮인 완성형을 골랐다.
  한눈에 "침대"로 읽히는 쪽이 맨 나무 뼈대보다 낫다(부록 "코드로 그리지
  말고 에셋으로"의 취지 — 알아볼 수 있어야 장식의 의미가 있다).
- **`table_small.gltf.glb`**(같은 팩) — SAGA WEB.md 같은 목록의 "책상".
  이미 `dg:table`(`table_long`, 행상 곁상 전용)이 있어 겹치지 않게 정사각
  발판(세로:가로:깊이 = 1:1:1)의 작은 것으로 갈랐다 — 이 비율이
  `normalize()`(세로 기준 배율)와 가장 잘 맞는 모양이기도 하다.
- 방 구석 잡동사니 표(`CLUTTER_KIND`, `dungeon3d.js`)에 `dg:bed`(mul 34,
  의자와 같은 급)·`dg:desk`(mul 26, 상자류와 같은 급)로 더했다 — 새 자리를
  만들지 않고 이미 있던 표에 둘만 늘렸다. **판정은 한 줄도 안 건드렸다.**
- 격리 렌더(`_inspect_bed_desk_tmp.html`, 커밋 안 함)로 나란히 세워
  스크린샷 확인 — 침대는 이불·베개가 또렷하고 책상은 두 다리가 대칭으로
  잡혔다. 자가진단 **241/241** 3회 동일(방 구석 장식은 순수 화면 층이라
  카운트는 안 바뀐다), `_admin.html?selftest` **ADMIN 12/12**. `sw.js`
  VERSION → `dungeon-v0.39.1`.
- **다음에 "세로가 짧아 안 맞는다"는 예전 메모를 다시 마주치면, 그
  메모가 실제로 잰 값이었는지부터 의심할 것** — 이번처럼 비슷해 보이는
  것 셋을 한 번에 건너뛰며 하나만 실측하고 나머지는 짐작으로 묶었을
  수 있다.

## 대장간 — 집 계열 세 번째로 (2026-09-05, 침대·책상 다음)

**사용자 지시** — "다른 건물로 변경해도 되니 있는걸로 위주로 해줘." 위
"남은 건물 여섯 재탐색" 절이 적어 둔 뒤로 PolyScan 카탈로그가 늘었는지,
`sitemap.xml`(전체 자산 URL 목록, 로그인 없이 그대로 열린다)을 다시
훑어 보니 그때 없던 항목 몇이 새로 걸려 있었다.

- **새로 걸린 것 확인** — `abandoned-brick-house`·`abandoned-two-story-
  brick-house`·`distressed-concrete-building`·`two-story-urban-brick-house`
  넷은 제목만 보면 건물이지만 실제 미리보기가 "Abandoned Industrial"·
  "Graffiti Tagged Urban Building"(현대 도시 폐건물, 콘크리트·낙서) —
  이 판의 중세 판타지 결과 아예 안 맞아 버렸다(저다각형이라 버렸던 것과
  같은 종류의 결 불일치, 이유만 다르다).
- **`medieval-stone-and-wood-cottage`(Rustic Stone and Wood Cabin)** —
  이건 다르다. 이미 쓰고 있는 `house_stone`·`house_wooden`과 **같은
  집 계열의 세 번째 모델**(돌벽+나무 지붕널, PBR, 로그인 없이 CDN
  직접 다운로드 확인)인데, 지난 재탐색 때는 "Early Access 로그인 필요"로
  오판했던 셋 중 하나였다가(위 "재탐색" 절 참고, 그 판단 자체는 뒤에
  "PolyScan 집 둘" 절에서 이미 뒤집혔다) 실제 변환까지는 이번에 처음 했다.
- **대장간 자리에 앉혔다.** PolyScan에 '대장간 건물'은 여전히 없다(모루
  소품 하나뿐) — 그래서 모양이 안 맞더라도 화기에 강한 석조 건물을
  대장간으로 쓰기로 했다(사용자 지시 그대로). `js/asset3d.js`의
  `'blacksmith'` 키를 `BLD`(medieval_village_pack 저다각형)에서
  `BLD_REAL + 'house_cottage.glb'`로 바꿨다 — `dungeon3d.js`·`town.js`는
  안 건드렸다(이 자리를 부르는 쪽은 이미 문자열 하나만 보므로).

| | |
|---|---|
| **만든 이** | PolyScan (<https://polyscann.com>) |
| **라이선스** | CC0 1.0 |
| **받은 곳** | `https://polyscann.com/asset/medieval-stone-and-wood-cottage-93ddf5` → `cdn.polyscann.com/…/Rustic_Stone_and_Wood_Cabin_3D_Model_01_4k.rar`(로그인 없이 직접 다운로드) |
| **파일** | `models/buildings/realistic/house_cottage.glb`(265KB) |

**변환 — 집 둘과 같은 파이프라인, 이번엔 한 단계 짧았다.** OBJ가
`House`·`Wood` 재질 둘로 이미 깔끔히 나뉘어 있었고(`mtllib` 참조도 실제
파일명과 맞아 있어 지난번 겪은 참조 깨짐이 없었다), 수레·양동이 같은
덤 오브젝트도 없어 **거를 것 자체가 없었다**. `trimesh.load(...,
split_object=True, group_material=True)`로 둘을 갈라 diffuse만
(`House_BaseColor`·`Wood_BaseColor`, 4096→768px jpeg85) 새 PBRMaterial에
얹고 단일 glb로 구웠다. 합친 바운딩박스 세로:가로 = 51~64%(축마다
다름) — 방 소품 정규화가 요구하는 범위(50% 안팎)에 잘 맞는다.

격리 렌더(`_inspect_cottage_tmp.html`, 커밋 안 함)로 단독 확인 — 돌벽·
나무 지붕이 정상 방향(Y-up)으로 텍스처까지 그대로 보였다. 자가진단
**241/241** 3회 동일, `_admin.html?selftest` **ADMIN 12/12**. `sw.js`
VERSION → `dungeon-v0.39.2`.

**남은 것** — 우물·여관·마방·방앗간 넷은 여전히 PolyScan에 그 종류
자체가 없다(집 계열만 있다). **실기기 확인 전** — 다음 세션·실기기에서
모루골 마을의 대장간이 실제로 이 돌집으로 걸리는지 볼 것(마을 화면은
GLB가 많아 이 작업 환경의 헤드리스 SwiftShader로는 안정적으로 못
찍는다 — 위 "PolyScan 집 둘" 절의 같은 한계, 그래서 이번에도 단독
렌더로 대신했다).

## 우물·여관·마방·방앗간 — KayKit 다른 팩에서 (2026-09-05, 대장간 다음)

**사용자 지시가 두 번 더 풀렸다.** 먼저 "다른 건물로 변경해도 되니 있는
걸로 위주로 해줘"(위 대장간 절), 그다음 "꼭 디아블로인 건 아니야 시대가
퓨전이야 여러 가지를 합쳐도 상관없어 완전 모방은 아니야" · "현대적이거나
미래적이거나 고전적이거나 아무거나 상관없어 무조건 맞추지는 마". 즉
**이 판의 실사·저다각형 스타일 통일도, 시대 통일도 더 이상 필수 조건이
아니다.** 이 조건으로 위 "재탐색" 절에서 "CC0에 종류도 맞지만 스타일이
안 맞아 버렸다"고 접어 뒀던 후보가 다시 열렸다.

- **KayKit — Medieval Hexagon Pack.** itch.io 페이지(`kaylousberg.itch.io/
  kaykit-medieval-hexagon`, "Name your own price")는 다운로드가 로그인
  뒤에 있다(`download_url` 엔드포인트가 미인증 요청을 `itch.io/g//`로
  돌려보낸다 — Sketchfab과 같은 부류의 진짜 장벽, PolyScan의 "가짜
  Early Access"와는 다르다). 그런데 **KayKit 던전 소품을 받아 온 바로 그
  경로**(Kay Lousberg 본인이 itch.io 각 팩을 자기 GitHub 조직에 그대로
  미러해 둔다)에 이 팩도 있었다 — `github.com/KayKit-Game-Assets/
  KayKit-Medieval-Hexagon-Pack-1.0`, `api.github.com`으로 조직의 저장소
  열 개를 검색해 이름으로 찾았다(`api.github.com/search/repositories?
  q=org:KayKit-Game-Assets`).
- **라이선스** — CC0 1.0 Universal(저장소 `LICENSE.txt`, itch.io 페이지의
  "Asset license" 항목과 동일).
- **받은 파일** — `addons/kaykit_medieval_hexagon_pack/Assets/gltf/
  buildings/blue/` 안의 `building_well_blue`·`building_tavern_blue`·
  `building_windmill_blue`·`building_barracks_blue`(각 `.gltf`+`.bin`,
  팩 전체가 공유하는 아틀라스 텍스처 `hexagons_medieval.png` 15KB 하나만
  같이 받으면 된다). 진영별 폴더가 blue·red·green·yellow·neutral 다섯인데
  이 판엔 진영 구분이 없어 **blue 하나만** 골랐다.
- **변환이 필요 없었다** — PolyScan 사진측량과 달리 이 팩은 원본 자체가
  이미 `.gltf`+`.bin`+작은 아틀라스로 가벼워, 재질 분리나 텍스처 리사이즈
  단계 없이 `trimesh.load(...).export(...)`로 단일 `.glb`만 다시 구웠다
  (`models/buildings/hexagon/well.glb`·`tavern.glb`·`windmill.glb`·
  `barracks.glb`, 각 60~270KB).
- **역할 배정 — 모양은 안 맞춰도 된다는 지시를 그대로 따랐다.**
  - `well` → `well.glb` — 이건 실제로 우물 모양이다(지붕 덮인 돌우물,
    두레박까지).
  - `inn`(여관) → `tavern.glb` — 이 팩에서 'tavern'은 큰 맥주통이 간판을
    겸하는 모양이다. 정통 여관 도상은 아니지만 이 팩 자체의 표현이고,
    사용자 지시로 정확도를 안 따진다.
  - `mill`(방앗간) → `windmill.glb` — 날개 달린 실제 풍차라 오히려 가장
    잘 맞아떨어졌다.
  - `stable`(마방) → `barracks.glb` — 이 팩엔 '마방'이라는 이름의 건물이
    아예 없다. 성벽 딸린 작은 요새 건물(병영)을 대역으로 앉혔다 —
    사용자 지시("아무거나 상관없어")를 가장 많이 쓴 자리다.
- `js/asset3d.js`에 `BLD_HEX = 'assets/models/buildings/hexagon/'`을
  새로 두고 `well`·`inn`·`stable`·`mill` 네 키를 여기로 옮겼다.
  `dungeon3d.js`·`town.js`는 안 건드렸다(문자열 하나만 보는 자리라서).
- 격리 렌더(`_inspect_hexbuild_tmp.html`, 커밋 안 함)로 넷을 한 화면에
  세워 확인 — 텍스처·형태 다 정상, 검정·깨짐 없음. 자가진단 **241/241**
  3회 동일, `_admin.html?selftest` **ADMIN 12/12**. `sw.js` VERSION →
  `dungeon-v0.39.3`.

**이걸로 SAGA WEB.md "E. 건물" 여섯(집·우물·대장간·여관·마방·방앗간)이
전부 실사 또는 CC0 완성 에셋으로 찼다** — 정확한 모양 일치가 아니라
"코드로 그리지 말고 에셋으로"라는 부록의 원칙만 지킨 결과다. 모양이
안 맞는 자리(대장간·여관·마방)는 위에 그 이유를 남겨 뒀으니, 나중에
진짜 맞는 모양을 찾으면 `asset3d.js`의 그 한 줄만 바꾸면 된다.

## 물(못) — 진짜 텍스처는 없었다, 완성 에셋 + 뒤집힌 면 버그 하나 (2026-09-05)

**사용자 요청 "물 텍스처 실사화"로 시작 — 결론은 "텍스처는 없다"였다.**
Poly Haven·ambientCG 전체 텍스처 카탈로그를 `water`·`pond`·`lake`·`river`
등으로 훑었지만 **타일링되는 물 표면 텍스처가 원천적으로 없다**(물은
사진 텍스처로 잘 안 만드는 소재 — Poly Haven은 아예 없고, ambientCG의
`Ice00x`는 얼어붙은 호수라 못과 안 맞아 걸렀다). KayKit Medieval Hexagon
Pack에 `hex_water` 타일이 있어 받아 봤지만 **단색 팔레트 하나일 뿐**이라
지금 있는 반투명 파란 상자와 실질적으로 다르지 않았다(코드 추가할 값이
없어 안 썼다).

- **poly.pizza에서 완성 diorama를 찾았다.** 'Pond'(Poly by Google,
  CC-BY 3.0 — Tiger·Bear 등에서 이미 쓰는 그 출처)는 바위 고리·연잎·
  기하학적 물결 데칼·물빛까지 다 갖춘 통짜 모델이다. `models/nature/pond.glb`
  로 그대로 옮겼다(재질이 이미 하나뿐이라 재질 분리·텍스처 리사이즈가
  필요 없었다 — 원본 diffuse가 이미 512px).
- **진짜 버그 하나 잡음 — 물 표면이 안 보였다.** `AS3.build('pond', ...)`로
  불러 봤더니 바위·연잎은 다 보이는데 **물 자체가 완전히 안 보였다**
  (배경이 그대로 비쳤다). 검은 재질도 아니고 완전히 투명한 것도 아닌
  "아예 없는 것처럼" 보이는 게 이상해 와이어프레임을 씌워 확인 —
  **지오메트리는 분명히 있었다.** `alphaMode: OPAQUE`,
  `baseColorFactor: [1,1,1,1]`이라 투명도 문제도 아니었다. 남은 설명은
  하나 — **물 사각형 하나만 면이 거꾸로 감겨(winding) 있어 단면 컬링
  (backface culling)에 걸린 것**. `material.side = THREE.DoubleSide`로
  강제하니 바로 보였다.
- **`delam()`(asset3d.js)에 이 처리를 항목으로 넣었다** — `side: m.side`
  (기존 재질의 값, 대개 기본 FrontSide)를 **항상 `THREE.DoubleSide`**로
  바꿨다. 이 판이 받는 CC0/CC-BY 에셋은 출처가 제각각이라 이런 뒤집힌
  면이 또 나올 수 있고, DoubleSide는 맞게 감긴 면에는 아무 영향이
  없다 — 못 하나만의 땜질이 아니라 **`delam()`을 거치는 모든 GLB에
  적용되는 방어적 기본값**으로 넣었다(그리기 비용 증가는 미미하다).
- **`js/dungeon3d.js`의 `pond` 가지를 고쳤다.** `normalize()`는 세로(Y)
  기준으로만 배율을 잡는데 이 에셋은 가로로 넓은 지형물이라, 원본의
  가로:세로 비(약 2.35:1)를 거꾸로 풀어 원하는 가로 폭에서 필요한
  세로 배율(`mul`)을 역산했다(`pondW * 0.4247`). 못 받으면 옛 반투명
  상자로 그대로 되돌아간다(fallback 그대로 유지). `js/asset3d.js`에
  `'pond': NATURE + 'pond.glb'`로 등록.
- 격리 렌더(`_inspect_pond3_tmp.html`, 커밋 안 함)로 상자(`dg:chest`)
  옆에 세워 크기를 눈으로 비교 확인. 자가진단 **241/241** 3회 동일
  (물은 순수 장식이라 진단이 값으로 안 본다), `_admin.html?selftest`
  **ADMIN 12/12**(delam() 변경이 다른 자산도 다 지나가므로 전체 재확인
  차원). `sw.js` VERSION → `dungeon-v0.39.4`.
- **늪(swamp) biome도 같이 좋아진다** — `field3d.js`가 늪의 웅덩이를
  물 쪽 'pond'를 그대로 재사용하므로 이 절 하나로 둘 다 해결된다.

| | |
|---|---|
| **만든 이** | Poly by Google |
| **라이선스** | **CC-BY 3.0** — 저작자 표시 필요 |
| **받은 곳** | `poly.pizza/m/5rf3YuZfJAW`(검색 `poly.pizza/search/pond`) → `static.poly.pizza/7a5a8cfd-9c13-4754-b944-24a8b1ea6fa6.glb` |
| **파일** | `models/nature/pond.glb`(366KB) |

> **Pond** — © **Poly by Google**, [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/).
> `poly.pizza`를 거쳐 받았다. 크기만 맞추었고 형상은 그대로다.

## 표지판(들판의 'post') — 이제 CC0로 찼다 (2026-09-05)

**여러 세션이 "이 팩·다른 네 판 어디에도 CC0로 맞는 게 없다"고 적어 두고
도형(장대+판)으로 남겨 뒀던 자리.** SAGA WEB.md 11절 "표지판"의 마지막
남은 장식 항목이었다.

- poly.pizza에서 `signpost`로 검색해 **Kenney의 'Signpost'**(CC0, Kenney
  에셋은 항상 CC0 — poly.pizza 페이지에도 "Public Domain (CC0)"로 표시)를
  찾았다 — pond와 같은 경로(`static.poly.pizza` 직접 다운로드, 로그인 불필요).
- 원본 비율이 세로(0.46) 대 가로(0.21)로 이미 세로가 최대 치수라, pond처럼
  가로세로를 뒤집어 풀 필요 없이 다른 대다수 소품과 같은 방식으로
  `normalize()`에 그대로 맡겼다(`mul = p.h * 1.15`, `js/dungeon3d.js`
  `post` 가지).
- 재질 하나(`wood`)뿐이라 `delam()`이 그대로 벗겨 쓴다. 못 받으면 옛
  도형(기둥+판)으로 그대로 돌아간다(fallback 유지). `js/asset3d.js`에
  `'post': PROPS + 'signpost.glb'`로 등록.
- 자가진단 **241/241**(표지판은 순수 장식이라 진단이 값으로 안 본다) —
  변경 없음 확인. `sw.js` VERSION → `dungeon-v0.39.5`.

| | |
|---|---|
| **만든 이** | Kenney |
| **라이선스** | **CC0** (Public Domain) |
| **받은 곳** | `poly.pizza/m/3U2lj1gpeH`(검색 `poly.pizza/search/signpost`) → `static.poly.pizza/e9da3a7a-a1c1-4f58-84f5-67e4277a0d01.glb` |
| **파일** | `models/props/signpost.glb`(6.4KB) |

> **Signpost** — © **Kenney**, CC0 (Public Domain). 저작자 표시 불필요.
> `poly.pizza`를 거쳐 받았다. 크기만 맞추었고 형상은 그대로다.

## 몬스터 무기 일곱 — 실사화 (2026-09-05)

**SAGA WEB.md "F. 소품" 목록의 "무기"**. `dungeon3d.js`의 `foeGear()`가
사람 형 적(황건적·왜구·몽골 기병…)에게 `data-enemy.js`의 `look.weapon`대로
무기를 쥐여 주는데, 몸은 이미 실사 GLB(Quaternius QRPG 창고)인데 **무기만
도형(각목·상자)**이었다 — 실사 몸에 각목을 든 채 서 있는 자리.

- poly.pizza에서 **Quaternius**(이 판이 사람 몸·짐승에서 이미 쓰는 그
  출처, CC0)의 무기 낱개들을 찾아 일곱 다 채웠다 — club(뭉툭한 무기)은
  "Doublesided Hammer"로 대신했다(정확히 "club"이라는 이름의 CC0는
  없었다 — 대장간=집 모델과 같은 판단, 역할·모양이 정확히 안 맞아도
  된다).
- **`wpn:halberd`는 `wpn:spear`와 같은 파일을 재사용한다.** "halberd"·
  "poleaxe"란 이름의 CC0 모델 자체가 안 보였고(빙 둘러 찾은 후보는 전부
  Pike·Trident·Pitchfork처럼 결이 다른 무기였다), 이 판의 옛 도형도 이미
  스피어와 할버드가 "장대+날붙이"로 거의 같은 실루엣이었다 — 재사용이
  자연스러운 자리다. `mul`(길이)만 살짝 다르게 줘서(2.6 대 2.8) 완전히
  똑같아 보이진 않게 했다.
- `js/dungeon3d.js`의 `foeGear()`를 고쳐 각 무기 분기가 `AS3.build('wpn:…', ...)`
  를 부르게 했다 — **옛 도형은 지우지 않고 fallback 함수로 그대로 넘긴다**
  (GLB 실패·오프라인이면 각목 그대로 돌아간다). 활만 별도 처리가 필요했다 —
  칼·창은 손 위치에서 **위로만** 자라는 물건인데 활은 손을 **가운데** 두고
  위아래로 뻗는 물건이라, fallback 도형도 GLB와 같은 "바닥이 y=0" 규약에
  맞춰 다시 그려 두 경로(도형/GLB, 비동기라 어느 쪽이 먼저 뜰지 모른다)가
  같은 한 줄로 위치를 맞추게 했다.
- **투구·망토·수염은 이번에 손 안 댔다** — 무기가 실루엣에서 가장 크고
  눈에 띄는 자리라 먼저 골랐다. 남은 자리는 다음 세션 숙제로 남긴다.
- 격리 렌더(`_inspect_wpn_tmp.html`·`_inspect_sword_tmp.html`, 커밋 안 함)로
  일곱 다 GLB로 실제 로딩됨을 확인 — 활은 손 높이를 가운데 두고 위아래로
  걸리는지까지 별도로 확인했다. 자가진단 **241/241** 3회 동일(무기는 순수
  장식이라 진단이 값으로 안 본다), `_admin.html?selftest` **ADMIN 12/12**.
  `sw.js` VERSION → `dungeon-v0.39.6`.
- **실기기 확인 전** — 다음 세션·실기기에서 던전에 들어가 적들이 실제
  무기를 쥔 채 보이는지 볼 것.

| 무기 | 만든 이 | 받은 곳 | 파일 |
|---|---|---|---|
| club(대역: Doublesided Hammer) | Quaternius | `poly.pizza/m/UIXvQ73DS1` | `models/weapons/club.glb`(103KB) |
| axe | Quaternius | `poly.pizza/m/FkzZ6I1zjT` | `models/weapons/axe.glb`(58KB) |
| sword | Quaternius | `poly.pizza/m/cDsobPucFA` | `models/weapons/sword.glb`(26KB) |
| spear · halberd(재사용) | Quaternius | `poly.pizza/m/fH1zmvjPNx` | `models/weapons/spear.glb`(68KB) |
| staff | Quaternius | `poly.pizza/m/PnGRvO4Lwd` | `models/weapons/staff.glb`(13KB) |
| bow | Quaternius | `poly.pizza/m/QnpqjLSKFU` | `models/weapons/bow.glb`(38KB) |

> **일곱 무기 모델** — © **Quaternius**, CC0 (Public Domain). 저작자 표시
> 불필요. `poly.pizza`를 거쳐 받았다. 크기만 맞추었고 형상은 그대로다.

## 투구·왕관 — 실사화, 그 옆 셋(원뿔 투구·망토·수염)은 여전히 못 찾음 (2026-09-05)

**SAGA WEB.md 감사 이어서 — 무기 다음은 몬스터의 나머지 장구.**
`foeGear()`의 `look.helm`(투구)·`look.cape`(망토)·`look.beard`(수염)를
훑어, CC0/CC-BY로 맞는 후보가 있는 것만 골라 채웠다.

- **투구(`helmet`)** — poly.pizza에서 CreativeTechLab의 "Helmet"을 받았다.
  꾸밈없는 일반 병사 투구라 황건적·마적 같은 잡졸에 두루 맞는다.
  **CC-BY 3.0**(저작자 표시 필요, 아래 인용 참고).
- **왕관(`crown`)** — poly.pizza에서 Quaternius의 "Crown"을 받았다. **CC0**.
  금관+붉은 안감이 뚜렷해 "위군 도독" 같은 왕가·최고위 보스에 잘 맞는다.
- 모자류는 칼·창과 달리 **머리를 가운데 두고 씌우는 물건**이라(활과 같은
  사정), `js/dungeon3d.js`의 `wornGear()` 헬퍼를 새로 두어 도형·GLB 두
  경로가 "중심 좌표 − 길이/2"로 항상 같은 자리를 잡게 했다.
- **찾아봤지만 못 찾은 셋** — `gapju`(원뿔형 동아시아 투구, "kabuto"·
  "conical helmet" 다 검색했지만 CC0 계열에 없었다 — 있는 후보는 바이킹
  뿔투구·삿갓뿐이라 어울리지 않는다고 판단해 걸렀다), 망토(대부분 특정
  게임 코스튬 이름을 단 파생물이거나 옷장·행어류 오검색이었다), 수염
  (콧수염 둘뿐, 턱수염 단품은 없었다). 셋 다 옛 도형 그대로 남는다 —
  표지판이 한동안 그랬듯, 안 맞으면 안 맞는다고 여기 적어 둔다.
- 격리 렌더(`_inspect_gear_tmp.html`, 커밋 안 함)로 둘 다 GLB로 실제
  로딩되고 중심 좌표에 자연스럽게 걸리는지 확인. 자가진단 **241/241**
  3회 동일(장구는 순수 장식이라 진단이 값으로 안 본다), `_admin.html?selftest`
  **ADMIN 12/12**. `sw.js` VERSION → `dungeon-v0.39.7`.
- **실기기 확인 전** — 다음 세션·실기기에서 투구 쓴 적·왕관 쓴 보스가
  실제로 보이는지 볼 것.

| 장구 | 만든 이 | 라이선스 | 받은 곳 | 파일 |
|---|---|---|---|---|
| helmet | CreativeTechLab | **CC-BY 3.0** | `poly.pizza/m/uSCGe4LD2v` | `models/gear/helmet.glb`(25KB) |
| crown | Quaternius | CC0 | `poly.pizza/m/i0PZVuVlYv` | `models/gear/crown.glb`(47KB) |

> **Helmet** — © **CreativeTechLab**, [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/).
> `poly.pizza`를 거쳐 받았다. 크기만 맞추었고 형상은 그대로다.
> **Crown** — © **Quaternius**, CC0 (Public Domain). 저작자 표시 불필요.

## 원뿔 투구·망토도 채움, 수염은 진짜 없어서 지움 (2026-09-05, 투구·왕관 다음)

**사용자 지시** — "몬스터는 다양해야 하는거니 있는거로 위주로 해줘 실사화는
지금걸 개조가 안되면 새로운 실사화 한다" · "전체 실사화라는게 현재거 개조
불가 하면 실사화 있는 걸로 대체 한다" · "끝까지 찾아보고 더이상 없다
그러면 삭제 하고 실사화 있는 걸로 추가한다." 요지: **모양이 완전히 안
맞아도 실사 에셋이 도형보다 낫다** — 못 찾은 자리도 끝까지 뒤져서 그래도
없으면 그제서야 도형(가짜)을 지운다.

- **`gapju`(원뿔형 동아시아 투구)** — "kabuto"·"conical helmet"·"gapju"
  어디로도 CC0/CC-BY 후보가 없었다(있는 건 삿갓·바이킹 뿔투구뿐). 사용자
  지시대로 **바이킹 투구**(Michael Fuchs, **CC-BY 3.0**)를 대신 앉혔다 —
  뿔이 있어 원래 뜻(동아시아 원뿔 투구)과는 다르지만, "이 적은 다른
  종류의 투구를 썼다"는 다양성 신호는 준다(대장간=집 모델과 같은 판단).
- **`cape`(망토)** — 표준적인 CC0 "cape" 메시 자체가 존재하지 않았다
  (검색으로 나온 유일한 완성 망토는 특정 게임 코스튬을 본뜬 개인 창작물,
  **CC-BY 3.0** — 이름과 달리 지오메트리는 그 업로더의 원본 저작물이라
  받았다). 이미 붉·금으로 칠해진 모델이라 세력색으로 곱연산 tint를 주면
  탁해져 — **GLB는 tint 없이 그대로**, fallback(도형)만 옛 방식대로
  세력색을 쓴다.
- **`beard`(수염)** — "beard"·"dwarf beard"·"facial hair"까지 다 뒤졌지만
  나온 건 콧수염 둘뿐, 턱수염 낱개는 **끝까지 없었다**. 지시대로 대체할
  실사 에셋이 없으니 **도형(각목) 자체를 지웠다** — `js/dungeon3d.js`
  `foeGear()`의 `look.beard` 분기 삭제. 수염 있던 적(황건 두목·산채
  두령·오랑캐 족장·관문 수호장)은 이제 수염 없이 나온다.
- 격리 렌더(`_inspect_gear2_tmp.html`, 커밋 안 함)로 머리 참조 상자를
  같이 세워 투구가 머리 위에 자연스럽게 걸리는지, 망토가 몸 뒤로 알맞게
  걸리는지 확인. 자가진단 **241/241** 3회 동일(장구는 순수 장식이라
  진단이 값으로 안 본다), `_admin.html?selftest` **ADMIN 12/12**. `sw.js`
  VERSION → `dungeon-v0.39.8`.
- **실기기 확인 전.**

| 장구 | 만든 이 | 라이선스 | 받은 곳 | 파일 |
|---|---|---|---|---|
| gapju(대역: Viking Helmet) | Michael Fuchs | **CC-BY 3.0** | `poly.pizza/m/apPuLbVJ4N5` | `models/gear/viking_helmet.glb`(186KB) |
| cape | (개인 업로더, poly.pizza) | **CC-BY 3.0** | `poly.pizza/m/4bSdFtCi1Xp` | `models/gear/cape.glb`(35KB) |

> **Viking Helmet** — © **Michael Fuchs**, [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/).
> `poly.pizza`를 거쳐 받았다. 크기만 맞추었고 형상은 그대로다.
> **Cape** — © poly.pizza 업로더(원 제목에 타 게임 코스튬 이름이
> 붙어 있으나 지오메트리는 업로더 본인의 창작물, CC-BY 3.0). 크기만
> 맞추었고 형상은 그대로다. 저작자 표시 필요.

## 플레이어 본인의 무기, 그리고 무기 결 넷 더 (2026-09-05, 몬스터 장구 다음)

**실제로 밟은 격차 — 플레이어 자신은 3D 화면에서 무기가 전혀 안 보였다.**
`meShape()`의 칼 도형은 `AS3.buildHero()`가 진짜 QRPG 몸을 다 실은 순간
그 자리를 통째로 갈아 끼워 **함께 사라진다**(placeholder였을 뿐) — 몬스터는
`foeGear()`가 몸과 **별도로** 무기를 `g`에 얹어 이 문제가 없는데, 플레이어
쪽엔 그 짝이 아예 없었다. `foeGear()` 안에 있던 무기 그리기를
`attachWeapon()`으로 뽑아내(`js/dungeon3d.js`) 몬스터·플레이어(`kind==='me'`)
둘 다 같은 함수를 쓰게 했다. 플레이어의 실제 장착 무기는
`meWeaponLook()`이 `core.save.party[0]`(선두)의 장착 무기 →
`IT.baseOf(w).look`으로 읽는다(`js/skill.js`의 `classOf()`가 직업을 정하는
것과 같은 자리, 다만 heroId를 새로 export하지 않고 그 함수가 읽던 저장값을
직접 다시 읽었다).

- **무기 결 넷을 더 받았다** — `data-item.js`의 무기 `look` 열 가지 중
  기존 일곱(club·axe·sword·spear·halberd·staff·bow)에 이어:
  - `guandao`(월도) — CC0 없어 **`wpn:spear`를 그대로 재사용**(halberd와
    같은 판단).
  - `scroll`(병서) — Quaternius, **CC0**. 원본이 가로로 누워 있어(긴 축이
    X) 이 판의 세로로 드는 관례와 안 맞았는데, **Blender 없이 `py -c
    "import trimesh..."`로 직접 90도 돌려 다시 구웠다** — 흔치 않게
    개조만으로 해결된 경우.
  - `fan`(선채)·`brush`(필묵) — 표준 "부채" CC0/CC-BY 단품은 끝까지
    없었다("war fan"·"hand fan"·"japanese fan" 다 검색). 대신 같은 붓
    (paint brush) 모델(**CC-BY 3.0**) 하나를 **둘이 공유**한다 — 붓·부채
    다 "가는 막대를 쥔" 실루엣이라 크게 안 어긋난다는 판단.
- r·hh는 플레이어(mul=42 고정)를 보스급 적(r=12·hh=31.2)과 같은 값으로
  근사했다 — `foeBody`의 mul 계산식(`hh+r*0.95`)을 거꾸로 풀면 그 근방이다.
- 격리 렌더(`_inspect_wpn2_tmp.html`, 커밋 안 함)로 넷 다 실제 GLB로
  걸리고 자리(바닥 기준점)가 맞는지 확인. 자가진단 **241/241** 3회 동일,
  `_admin.html?selftest` **ADMIN 12/12**, 콘솔 에러 0. `sw.js` VERSION →
  `dungeon-v0.40.0`(구조 변경 — `attachWeapon()` 추출 — 이라 마이너 올림).
- **실기기 확인 전** — 다음 세션·실기기에서 던전에 들어가 **플레이어 본인**의
  손에 장착한 무기 종류가 실제로 걸리는지 볼 것(이번 항목의 핵심 체감
  포인트다 — 몬스터 무기와 달리 여태 한 번도 화면에 없던 것이 처음
  나타나는 자리라 꼭 확인이 필요하다).

| 무기 | 만든 이 | 라이선스 | 받은 곳 | 파일 |
|---|---|---|---|---|
| guandao(재사용) | Quaternius | CC0 | (spear.glb 재사용, 위 절 참고) | `models/weapons/spear.glb` |
| scroll | Quaternius | CC0 | `poly.pizza/m/MWGB9nxMIc` | `models/weapons/scroll.glb`(53KB, 직접 90도 회전) |
| fan · brush(공유) | Poly by Google | **CC-BY 3.0** | `poly.pizza/m/bGqEF62Pjze` | `models/weapons/brush.glb`(107KB) |

> **Scroll** — © Quaternius, CC0 (Public Domain). 저작자 표시 불필요.
> **Paint Brush** — © **Poly by Google**, [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/).
> `poly.pizza`를 거쳐 받았다. 크기만 맞추었고(scroll은 회전도) 형상은 그대로다.

## 짐승 형 몬스터 다양화 (2026-09-05, 사용자 요청 — "캐릭터도 더 다양하게")

들판(필드/던전) 짐승 형 적이 들개·코끼리병 둘뿐이라 늘 늑대(Wolf) 아니면
소(Cow) 하나로만 갈렸다. 코끼리 대역을 실제 코끼리로 갈아 끼우고, 이미
도감 초상용으로 받아 둔 Boar·Tiger(위 "도감(펫) 초상 실사화" 절, 둘 다
CC-BY — 새로 받을 것 없이 그대로 재사용)를 새 짐승 두 종(멧돼지·산군,
`data-enemy.js`)에 얹었다.

| 파일 | 원본 | 만든 이 | 라이선스 | 씀 |
|---|---|---|---|---|
| `Elephant.glb` | poly.pizza `/m/a27MA0rXyyj`(검색 `poly.pizza/search/elephant`) → `static.poly.pizza/b8ca84f2-02b2-4c84-92c0-b5f8b0eee90e.glb` | **Poly by Google** | **CC-BY 3.0** | `beast_big`(남만 코끼리병) — 이전엔 Cow.glb 대역 |
| `Boar.glb` | (이미 있음, 위 "도감(펫) 초상" 절) | Poly by Google | CC-BY 3.0 | `beast_boar`(신설 — 멧돼지) |
| `Tiger.glb` | (이미 있음, 위 "도감(펫) 초상" 절) | Poly by Google | CC-BY 3.0 | `beast_tiger`(신설 — 산군) |

> **Elephant** — © **Poly by Google**, [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/).
> `poly.pizza`를 거쳐 받았다. 크기·자리만 맞추었고 형상은 그대로다.

`dungeon3d.js`가 이름 정규식(`/코끼리/`으로 큰 놈만 가르던 것) 대신
`data-enemy.js`의 `body` 필드를 직접 읽는다 — 더 늘어도 이 표와
`data-enemy.js`만 고치면 된다. `_test.html` 241/241 3회 동일, CDP로
네 종(`beast`·`beast_big`·`beast_boar`·`beast_tiger`) 전부 로드 성공·
콘솔 에러 0 확인.

## 플레이어측 인물 몸 다양화 — MPFB 실사 스킨 20벌 이식 (2026-09-05, 이어서)

같은 요청("캐릭터도 더 다양하게")의 둘째 갈래 — 사람 몸이 QRPG 여섯 벌뿐이라
부대원(역사 인물 수십 명)·마을 NPC·인간형 몬스터가 전부 그 여섯 중 하나로만
갈렸다. `saga-go`가 이미 검증해 둔 MPFB2(makehumancommunity.org, CC0 도구)
실사 인물 스무 벌(`male`·`female`·`v3`·`v7`~`v23`)을 **파일 그대로
복사**했다(`saga-go/assets/models/people/mpfb_real/`, 74MB — 눈가 빨갛게
깨지던 버그를 이미 다 고친 최종본이라 이 판에서 다시 겪을 함정이 없다,
경위는 `saga-go/assets/ASSET_LICENSES.md` 참고).

**그런데 파일만 옮겨서는 안 됐다** — 이 판의 `asset3d.js`는 QRPG(몸 파일에
제 클립이 다 든 통짜 스킨)만 겨냥해 짜여 있어서, `retargetInto()`(몸짓을
다른 뼈대 크기에 맞게 다시 굽는 함수)가 아예 없었다. MPFB 몸은 제 클립이
없어 공용 `ANIM_SRC`(UAL1)를 그대로 물리면 뼈 길이가 달라 팔다리가
틀어진다(saga-go가 "팔이 T자로 안 움직인다"로 먼저 밟은 버그) — 그
함수(`sceneHeight`·`boneNameMap`·`retargetInto`)를 saga-go에서 그대로
옮겨 왔다. 세력색 물들이기도 QRPG 전용으로 좁혔다(MPFB 실사 얼굴에 그대로
곱히면 초록·파랑으로 물드는, saga-go가 실기기로 먼저 밟은 그 버그를
`assembleHero()`에 `isQrpg` 문턱 하나로 막았다 — saga-go의 최종 고침을
처음부터 반영한 것이라 이 판은 그 버그 자체를 겪지 않는다).

**CDP로 직접 확인** — `DG.asset3d.register('hero', [...])`로 인물 표를
한 벌짜리로 좁혀 강제로 그 몸이 뽑히게 한 뒤:
- MPFB(`v9.glb`) — `assetState:'glb'`, `mixer` 생성됨, `clipMap`에 idle·
  walk·run·sprint·attack·hit·dodge·death·interaction 아홉 자리 다 채워짐
  (retarget이 UAL1 마흔한 클립 전부를 성공적으로 다시 구웠다는 뜻), 몸
  재질 색은 `ffffff`(세력색 안 물듦 — 의도대로).
- QRPG(`Warrior.glb`, 대조군) — 재질 색이 넘긴 tintHex(`3355ff`)와 정확히
  일치(회귀 없음 — QRPG는 여전히 물든다).
- 둘 다 콘솔 에러 0. `_test.html` 241/241 3회 동일.

**실기기 확인 전** — 던전에 들어가 부대원·마을 NPC·인간형 몬스터 중
실사 얼굴이 실제로 섞여 나오는지, 걷는 동안 팔다리가 안 뒤틀리는지
볼 것(이번 항목의 핵심 체감 포인트 — retarget 결과는 헤드리스로는
"에러 없이 클립이 붙었다"까지만 확인되고, 눈으로 본 모양까지는 아직
아니다).

`sw.js` VERSION → `dungeon-v0.43.0`(스크립트 목록은 안 바뀌었지만
게임 데이터·에셋·렌더 로직이 여럿 바뀌었으니 캐시를 새로 태운다).

## 갑주(tier) — 실사화 (2026-09-06, PLAN §28-8 후속 다음)

`foeGear()`의 `look.armor`(가죽·판금)는 데이터에만 있고 지금까지 아무도
안 그리던 자리였다(적도 플레이어도) — 상자 오버레이로 먼저 두고, 실물
GLB를 이어서 구했다. poly.pizza에서 Quaternius의 "Ultimate RPG Items
Bundle"(CC0) 낱개 조각 둘을 받았다 — 위 무기·투구·왕관과 같은 출처.

| 갑주 | 만든 이 | 받은 곳 | 파일 |
|---|---|---|---|
| leather(가죽) | Quaternius | `poly.pizza/m/na9KfWiKN8`("Armor Leather") | `models/gear/armor_leather.glb`(17KB) |
| plate(판금) | Quaternius | `poly.pizza/m/TMUoxILh9w`("Armor Metal") | `models/gear/armor_metal.glb`(39KB) |

> **갑주 둘** — © **Quaternius**, CC0 (Public Domain). 저작자 표시 불필요.
> `poly.pizza`를 거쳐 받았다(`static.poly.pizza/<uuid>.glb` 직접 다운로드,
> 로그인 불필요 — 위 pond·signpost 때와 같은 경로). 크기·자리만 맞추었고
> 형상은 그대로다.

`js/asset3d.js`의 `DEFAULTS`에 `'gear:armor:leather'`·`'gear:armor:plate'`
로 등록 — `js/dungeon3d.js`의 `foeGear()`가 이미 이 키로 `AS3.build()`를
부르고 있어(2026-09-06, 상자 fallback과 함께 미리 둔 자리) 등록만으로
자동 교체된다. **실기기 확인 전** — 이 세션은 헤드리스 3D 검증 자체가
막혀(같은 세션의 다른 절 참고) CDP 스크린샷으로 확인 못 했다. 다음
세션이 실제로 갑주를 걸친 모습(가죽 vs 판금)을 실기기 또는 헤드리스가
회복된 뒤 확인할 것.

## 사람 — Kenney "Blocky Characters" 열여덟 벌 (2026-09-07, "캐릭터 100개" 목표 첫 벌)

`kenney.nl/assets/blocky-characters`에서 직접 받았다(itch.io 경유 아님,
로그인 불필요). 몸 열여덟 벌(character-a~r.glb) 각각에 애니메이션 클립이
스물일곱 개씩 이미 들어 있다(idle·walk·sprint·attack-melee-left/right·
attack-kick-left/right·die·pick-up·emote-yes/no·interact-left/right·
wheelchair-* 등) — QRPG처럼 리타깃이 필요 없는 자체 애니 몸이다.

| 자산 | 만든 이 | 받은 곳 | 파일 |
|---|---|---|---|
| Blocky Characters 18종 | Kenney(원작 Kay Lousberg) | `kenney.nl/assets/blocky-characters` | `models/people/kenney_blocky/character-a.glb` ~ `character-r.glb` |

> **Blocky Characters** — © **Kenney**(kenney.nl), CC0 (Public Domain).
> 저작자 표시 불필요(권장만). 원본은 GLB 안에 텍스처를 상대경로
> (`Textures/texture-*.png`)로 참조하는 형태라, `tools/glb-compress`로
> 압축하면서 텍스처를 GLB 안에 그대로 박아 파일 하나로 묶었다(용량도
> 111KB→평균 48KB로 줄었다). 원작 캐릭터 표정·수염 등 외형은 그대로 두되
> 게임 안에서 부르는 표시 이름은 다섯 판 공통 이름 정책(`CLAUDE.md`)에 따라
> 가명으로만 노출한다.

`js/asset3d.js`의 `HERO_RECIPES_LIGHT`에 `kenney_a`~`kenney_r`로 등록—
`HERO_RECIPES`(전체 표, `me:` 시드 전용)에는 안 얹었다. `dungeon3d.js`의
`QRPG_SEEDS`가 그 배열 길이를 손으로 확인해 둔 해시값이라, 길이를 바꾸면
그 자리가 틀어진다(위험 회피, 자세한 사정은 asset3d.js 그 자리 주석 참고).
NPC·동행·사람 형 적·초상(`heroKindFor`가 `hero_light`로 보내는 모든 자리)
에서 QRPG 6종과 함께 스물네 벌 중 하나로 고른다.

격리 렌더(`_glbcheck.html`, 신규 — `?f=<glb경로>&anim=<클립이름>&t=<초>`로
임의 GLB를 애니메이션 재생 상태로 스크린샷 찍는 도구, 무거운 전체 장면을
헤드리스가 못 견디는 문제를 우회한다)로 압축 전/후 렌더 동일함을 확인했다.

## 몬스터 — KayKit Skeletons + Quaternius Ultimate Monsters (2026-09-07, "몬스터 100개" 목표 1차분)

**KayKit Character Pack: Skeletons** — `github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0`
(작가 GitHub 조직에서 직접 받음, itch.io 아님 — 던전 소품 받을 때와 같은 경로,
[[saga-dungeon-kaykit-assets]]). 4종(Mage·Minion·Rogue·Warrior), 몸마다
근접·원거리·2인용 무기 애니메이션 90여 개 내장.

**Quaternius "Ultimate Monsters Bundle"** — `poly.pizza/bundle/Ultimate-Monsters-Bundle-5oyGWAmOB6`
(poly.pizza 미러, pond·signpost 받을 때와 같은 경로). 45종, 클립 이름이
`CharacterArmature|Idle`처럼 `|`로 묶여 있는데 `mapClips()`의 `normName()`이
이미 그 구분자를 걷어내게 돼 있어 그대로 받는다.

| 자산 | 만든 이 | 받은 곳 | 파일 |
|---|---|---|---|
| Skeletons 4종 | Kay Lousberg(KayKit) | `github.com/KayKit-Game-Assets` | `models/monsters/kaykit_skeletons/Skeleton_*.glb` |
| Ultimate Monsters 45종 | Quaternius | `poly.pizza` 미러 | `models/monsters/quaternius/*.glb` |

> **Skeletons** — © **Kay Lousberg**(kaylousberg.com), CC0. 저작자 표시 불필요(권장).
> **Ultimate Monsters** — © **Quaternius**, CC0. 저작자 표시 불필요.
> 둘 다 `tools/glb-compress`로 재압축(Skeletons 18.4MB→10.0MB, Ultimate
> Monsters 11.2MB→3.9MB) — 애니메이션이 워낙 많아(특히 Skeletons) 압축률은
> 사람 모델만큼 크지 않다. 격리 렌더(`_glbcheck.html`)로 확인.

`js/asset3d.js`의 `DEFAULTS`에 `monster:skeleton_*`·`monster:<이름>`으로
등록만 해 뒀다 — `data-enemy.js` 배치·밸런스 연결은 아직 안 함(자산만
갖춤). Quaternius 쪽 일부 이름(Alpaking·Armabee·Glub 등)이 포켓몬류를
연상시키는데, 실제 게임에 노출되는 표시 이름은 다섯 판 이름 정책(가명)을
그대로 따른다 — 여기 등록 키는 내부 식별자일 뿐이다.

## 사람 — Quaternius Universal Base Characters + Animation Library 2 (2026-09-07)

itch.io 전용 팩이라 사용자가 직접 받아 전달(`quaternius.itch.io/universal-base-characters`,
`quaternius.itch.io/universal-animation-library-2`). "Standard" 등급 압축본에는
남녀 각 하나("Superhero" 체형)만 들어 있었다. MPFB처럼 제 클립이 없어
UAL2(43개 — Sword_*·Shield_*·Zombie_*·TreeChopping 등 리치 콤보)로
리타깃한다. 원본 텍스처가 유난히 커서(각 15~16MB) 압축이 특히 잘 먹었다
(380·409KB — 텍스처 리사이즈+WebP 효과, 지오메트리 자체는 가벼웠다).

| 자산 | 만든 이 | 받은 곳 | 파일 |
|---|---|---|---|
| Superhero Male/Female 몸 | Quaternius | `quaternius.itch.io/universal-base-characters`(사용자 직접 받음) | `models/people/universal_base/Superhero_{Male,Female}.glb` |
| UAL2 애니메이션 라이브러리 | Quaternius | `quaternius.itch.io/universal-animation-library-2`(사용자 직접 받음) | `models/anim/UAL2_Standard.glb` |

> 둘 다 © **Quaternius**, CC0 (Public Domain). 저작자 표시 불필요.
> 원본 `.gltf`(외부 텍스처 참조)를 압축하며 GLB 하나로 묶었다. 원본 에셋
> 자체에 오탈자가 있었다 — 일부 노멀맵 참조가 `_Normal_png.png`(끝에 확장자가
> 겹친 이름)로 돼 있는데 실제 파일은 `_Normal.png`뿐이라, 압축 전에 그
> 파일을 같은 이름으로 복사해 채워 넣었다(같은 픽셀, 참조만 고침).
> `js/asset3d.js`의 `HERO_RECIPES_LIGHT`에 `universal_male`·`universal_female`
> 로 등록, `anim` 필드로 전역 `ANIM_SRC`(UAL1, MPFB 전용) 대신 UAL2를
> 레시피별로 지정했다 — MPFB·UAL1 쪽은 안 건드림.
> `_retargettest.html`(신규, `?body=<글TF경로>&anim=<글TF경로>&clip=<클립이름>`)로
> `buildHero()`→`retargetInto()` 실전 경로를 그대로 돌려 `Sword_Regular_A`
> 재생 상태를 스크린샷으로 확인 — 팔다리 뒤틀림 없이 정상 리타깃됨.

**itch.io "Animated Characters 1"(사용자가 같이 받아 전달)은 안 씀** —
받아서 열어 보니 FBX뿐(GLB 없음, 변환 도구 필요)이고 애니메이션도
idle·jump·run 세 개뿐이라 이미 있는 QRPG·Kenney Blocky·Universal Base
Characters보다 가치가 낮았다. 압축·통합 없이 그대로 둠.

## 펫 — poly.pizza 동물 번들 셋 (2026-09-07, "펫 100개" 목표 1차분)

poly.pizza 미러 세 번들(전부 Quaternius, CC0). 기존 `animals/`(늑대·사슴·
시바견·허스키 등)와 겹치는 종은 뺐다.

| 번들 | 받은 곳 | 신규 종 |
|---|---|---|
| Farm Animal Pack | `poly.pizza/bundle/Farm-Animal-Pack-1kUvRTPLzT` | 라마·돼지·퍼그·양·말·소·얼룩말 |
| Animated Animal Pack | `poly.pizza/bundle/Animated-Animal-Pack-ILAPXeUYiS` | 당나귀·알파카·황소·여우·수사슴·흰말·소·말 |
| Animated Fish Bundle | `poly.pizza/bundle/Animated-Fish-Bundle-ZkGbjS8m8g` | 물고기 3종·돌고래·상어·고래·쥐가오리 |

> © **Quaternius**, CC0 (Public Domain). 저작자 표시 불필요. `tools/glb-compress`로
> 재압축(22개, 10.1MB→3.2MB). `js/asset3d.js`의 `DEFAULTS`에 `pet:*`로 등록,
> `assets/models/animals_extra/`에 따로 둠(기존 `animals/`와 출처 구분).

## 펫 2차분 — 물고기 대형 번들 + 공룡 (2026-09-07)

| 번들 | 받은 곳 | 신규 종 |
|---|---|---|
| Animated Fish Bundle(대형) | `poly.pizza/bundle/Animated-Fish-Bundle-44zhHN1UbT` | 36종(제브라클라운피시·아머드캣피시·패럿피시·블루탱·베타 등, 소품(낚싯대·부두)은 제외) |
| Animated Dinosaur Bundle | `poly.pizza/bundle/Animated-Dinosaur-Bundle-SmoLdBLO2K` | 파라사우롤로푸스·티렉스·벨로키랍토르·트리케라톱스·스테고사우루스·아파토사우루스 |

> © **Quaternius**, CC0. `assets/models/animals_extra2/`에 따로 둠(이전
> Fish Bundle과 별개 번들이라 상어(Shark) 종이 겹쳐 `pet:shark_2`로 구분).
> `tools/glb-compress`로 재압축(42개, 7.5MB→2.5MB).

## 캐릭터 2차분 — poly.pizza 남성 번들 둘 (2026-09-07)

Kenney Character Assets(4모델·75스킨)는 확인해 보니 **데모만 무료, 전체는
유료**라 최종 제외 — 대신 poly.pizza에서 완전 무료 CC0 대체를 찾았다.

| 번들 | 받은 곳 | 캐릭터 |
|---|---|---|
| Animated Men Pack | `poly.pizza/bundle/Animated-Men-Pack-DAC9SDgMQT` | 4종(정장·평상복 남성 등) |
| Ultimate Modular Men Pack | `poly.pizza/bundle/Ultimate-Modular-Men-Pack-ZiH8muWqwQ` | 11종(모험가·왕·농부·후드티·해변·캐주얼·노동자·펑크·SWAT·비즈니스맨·우주비행사) |

> © **Quaternius**, CC0. 둘 다 제 클립 내장(리타깃 불필요). `assets/models/
> people/polypizza_men/`에 둠. `tools/glb-compress`로 재압축(15개,
> 18.6MB→5.4MB). `HERO_RECIPES_LIGHT`에 `ppmen_*`로 등록.

**itch.io "Monster Pack Animated by Quaternius"(사용자가 같이 받아 전달)는
안 씀** — Bat·Dragon·Skeleton·Slime 4종인데 FBX/OBJ/Blend뿐(GLTF 없음)이고
Dragon·Skeleton·Slime류는 이미 Ultimate Monsters·KayKit Skeletons로 확보돼
있어, 새로 얻는 건 Bat 하나뿐 — FBX 변환 도구(fbx2gltf 등) 셋업 비용 대비
가치가 낮아 보류. 변환 파이프라인이 생기면 재검토.

## 캐릭터 3차분 — poly.pizza 여성 번들 (2026-09-07)

이전 세션에서 "quaternius.com 페이지는 있는데 poly.pizza 미러를 못 찾았다"고
남겨 뒀던 Ultimate Modular Women Pack — 검색어를 바꿔 다시 찾으니 있었다.

| 번들 | 받은 곳 | 캐릭터 |
|---|---|---|
| Ultimate Modular Women Pack | `poly.pizza/bundle/Ultimate-Modular-Women-Pack-aCBDXDdTNN` | 10종(사이파이·마녀·노동자·정장·군인·평상복 여성 2종·펑크·모험가·후드모험가) |

> © **Quaternius**. **한 번들 안에 CC0 5종·CC-BY 5종이 섞여 있다**(페이지에서
> 모델별로 각각 확인) — CC-BY: Sci Fi Character·Witch·Worker·Suit·Soldier.
> CC0: Animated Woman(2종, 이름이 겹쳐 `AnimatedWoman1`/`2`로 구분)·Punk·
> Adventurer·Hooded Adventurer. 제 클립 내장(`CharacterArmature|*` — 위
> Animated Men Pack과 같은 낱말표라 `mapClips()` 그대로 받는다, 리타깃
> 불필요). `assets/models/people/polypizza_women/`에 둠. `tools/
> glb-compress`로 재압축(10개, 15.0MB→4.3MB). `HERO_RECIPES_LIGHT`에
> `ppwomen_*`로 등록.

## 몬스터 2차분 — poly.pizza 개별 몬스터 (2026-09-07)

"몬스터 100개" 1차분(KayKit Skeletons + Ultimate Monsters 49종)에서 정체돼
있던 것을 poly.pizza `/search/monster` 개별 검색으로 이어감. 번들(꾸러미)이
아니라 낱개 모델 검색이라 라이선스를 모델 페이지별로 하나하나 확인했다.

| 모델 | 받은 곳 | 만든이 | 라이선스 |
|---|---|---|---|
| Snake·Wasp·Rat·Spider·Frog(신규 개체) | `poly.pizza/bundle/Animated-Enemies-a53OJwHrhh` | Quaternius | CC0 |
| Zombie | `poly.pizza/m/VlXjG0N8Eg` | Quaternius | CC0 |
| Skeleton(단품) | `poly.pizza/m/DM4QScSmbS` | Quaternius | CC0 |
| Giant | `poly.pizza/m/BldaiPtyJa` | Quaternius | CC0 |
| Slime Enemy | `poly.pizza/m/6O6XUMssAW` | **Charlie** | **CC-BY** — 저작자 표시 필요 |

> Zombie·Skeleton·Giant는 `EnemyArmature|...` 접두어를 셋 다 똑같이 써서(같은
> Quaternius 몬스터 킷 계열) `mapClips()`가 Ultimate Monsters와 같은 낱말표로
> 그대로 받는다. Wasp는 걷기 클립이 없이 Attack·Death·Flying 뿐이라
> `asset3d.js`의 `WORDS.idle`에 'fly'를 보태 가만있을 때도 날갯짓이 돌게
> 했다. **Mimic(Quaternius, CC0)은 받아만 보고 뺐다** — 클립이 하나도 없는
> 정지 메시라 "동작이 형태보다 우선"(모양보다 애니메이션) 원칙에 안 맞음.
> Frog(신규 개체)는 기존 `monster:frog`(Ultimate Monsters 소속, UUID가 다름)
> 와는 다른 별개 모델이라 `monster:frog_enemy`로 구분해 등록.
> `assets/models/monsters/quaternius2/`(Quaternius 8종)·`assets/models/
> monsters/community/`(Charlie 1종)에 나눠 둠. `tools/glb-compress`로 재압축
> (9개, 4.9MB→1.3MB). `data-enemy.js` 배치·밸런스는 아직 안 건드렸다 — 1차분과
> 같은 이유로 자산만 갖춰 둔다.

## 아직 안 옮긴 것

`saga-go`가 든 다른 에셋(탑·성벽 종류·기타 자연물)은 이 판에서 아직 안 쓴다 —
PLAN 4절의 우선순위를 따라 나무·바위·폐허(기둥·벽)·절벽·제단·동굴 입구·마을
건물까지 다 옮겼다. 천막·모닥불도 위 "잡초·모닥불·진짜 텐트" 절에서
실제 GLB(Tent·Bonfire_Lit)로 갈아 끼웠다 — 이 줄이 한동안 그 사실이 반영되기
전 상태로 남아 있었다(2026-09-05 바로잡음). SAGA WEB.md F 소품은 침대·책상까지
채워 다 찼고, E 건물도 대장간·우물·여관·마방·방앗간까지 다 채워(위 두 절
참고, 모양 일치보다 "코드로 그리지 말고 에셋으로"를 우선한 결과) A~G 전
카테고리가 실사 또는 CC0 완성 에셋으로 찼다. 남는 것은 saga-go의 탑·성벽
종류처럼 이 판이 아직 안 쓰기로 한 것뿐이다.

## Lucide — UI 아이콘 (2026-09-08, `js/icon.js`)

`saga-go`의 `js/icon.js`를 그대로 옮겨 도구줄·독·지갑 이모지를 실제 아이콘으로
갈아 끼웠다("사가나락 UI가 사가만리랑 완전히 같지 않다" 제보). SVG 자체가
파일이 아니라 `icon.js` 안에 문자열로 박혀 있다 — 출처·라이선스는
`../saga-go/assets/ASSET_LICENSES.md`의 Lucide 항목을 그대로 따른다
(Lucide, <https://lucide.dev>, **ISC**).

## 캐릭터 3차분 — poly.pizza 개별 검색 (2026-09-09, "캐릭터 100개" 이어감)

45종(2026-09-07)에서 정체돼 있던 것을 `/search/knight`·`/search/samurai`·
`/search/mage` 등 개별 검색으로 이어감. 제 클립을 내장한(정지 메시가
아닌) 것만 골랐다 — 검색에 걸린 다수(Knight·Old Guy·Grandpa 등)는
클립이 없거나 하나뿐이라 스킵.

| 자산 | 받은 곳 | 만든이 | 라이선스 |
|---|---|---|---|
| Characters Matt·Shaun·Sam | `poly.pizza/m/66kQ4dBBC7`·`eJFT9MxzOM`·`UcLErL2W37` | Quaternius | CC0 |
| Adventurer(2번째 개체) | `poly.pizza/m/5EGWBMpuXq` | Quaternius | CC0 |
| Character Animated | `poly.pizza/m/DgOCW9ZCRJ` | Quaternius | CC0 |
| Soldier(2번째 개체) | `poly.pizza/m/oAArCNHjFB` | Quaternius | CC-BY 3.0 |
| Animated Wizard | `poly.pizza/m/kttbFvCl2C` | Quaternius | CC-BY 3.0 |

전부 `CharacterArmature|*` 낱말표(`mapClips()` 그대로 받음, 리타깃
불필요). `assets/models/people/polypizza_more/`에 둠. `tools/
glb-compress`로 압축(7.4MB→2.0MB). `HERO_RECIPES_LIGHT`에 `ppmore_*`로
등록(71→78종). CC-BY 2종(Soldier·Animated Wizard)은 저작자 **Quaternius**
표시.

> **바로잡음(2026-09-09, 같은 세션 이어서)** — 위 "71→78종"은 실측이
> 아니었다. 코드로 `HERO_RECIPES_LIGHT.length`를 직접 세어 보니 이
> 절 작업 **전** 51종·**후** 58종이었다(20종 차이 — `HERO_RECIPES`
> 전체 표에만 들어가는 MPFB 실사 인물 20벌을 착각해 headcount에
> 같이 셌던 것으로 보인다, MPFB는 NPC·동행이 고르는 `hero_light`가
> 아니라 `me:`만 쓰는 `hero`에만 있다). 아래 절부터는 실측값을 쓴다.

## 캐릭터 4차분 — poly.pizza "Animated Women Pack" (2026-09-09, 같은 세션 이어서)

`poly.pizza/u/Quaternius/Lists`에서 지금까지 쓴 `Ultimate Modular Women
Pack`과는 별개인 `Animated Women Pack`(4종)을 찾았다 — 번들 페이지의
`/m/` 링크로 UUID를 직접 대조해 겹침이 없음을 확인했다.

| 자산 | 받은 곳 | 만든이 | 라이선스 |
|---|---|---|---|
| Woman | `poly.pizza/m/AQsd9ngvKU` → `static.poly.pizza/906a0cbe-b0a4-4312-b898-0f974b6f6771.glb` | Quaternius | CC0 |
| Woman Casual | `poly.pizza/m/jpKRgGDxhk` → `static.poly.pizza/51d5abdd-bb87-4b8d-9967-21738ffb8437.glb` | Quaternius | CC0 |
| Woman in Tank Top | `poly.pizza/m/XqzeZGB7iU` → `static.poly.pizza/9a6a3e55-23ce-4d5c-89bc-7d3f30307ed0.glb` | Quaternius | CC0 |
| Woman in Dress | `poly.pizza/m/zMyPlQXBzq` → `static.poly.pizza/a642af96-e239-4c5f-b50d-7661ff51deec.glb` | Quaternius | CC0 |

`HumanArmature|Female_*` 클립 11개씩(Idle·Walk·Run·Jump·Punch·SwordSlash·
Death 등) 내장, `mapClips()` word 표로 그대로 받는다(리타깃 불필요).
`assets/models/people/polypizza_women2/`에 둠, `HERO_RECIPES_LIGHT`에
`ppwomen2_*`로 등록 — **51→58→62종**.

**압축 보류** — `tools/glb-compress`(`../../tools/glb-compress`)의
`package-lock.json`이 사내망 사설 레지스트리(`172.17.1.200:8081`,
`C:\link` 전용) `resolved` URL을 그대로 담고 있어 이 환경에서
`npm install`이 ETIMEDOUT으로 실패했다. lockfile을 고치는 편집 자체도
권한 분류기가 의존성 변경으로 막아, 이번엔 원본 그대로(4종 합쳐
2.0MB — 다른 판에서 이미 압축된 비슷한 세트와 큰 차이 없는 크기) 커밋했다.
**다음 세션이 할 일**: `tools/glb-compress/package-lock.json`의
`http://172.17.1.200:8081/repository/npm_group/`를
`https://registry.npmjs.org/`로 되돌리고(사용자 승인 하에) `npm install`
다시 받은 뒤, 이 폴더(및 압축 안 된 다른 자리)를 마저 압축할 것.

> **처리됨(같은 세션, 뒤이어)** — 사용자 승인 받고 위 lockfile을
> 고쳐 `tools/glb-compress`를 되살렸다. `polypizza_women2/`도 마저
> 압축(2.0MB→0.6MB, 클립 11개 그대로 남음 확인). 아래부터는 그
> 도구로 바로 압축해 등록한다.

## 캐릭터 5차분 — Ultimate Space Kit 우주비행사 3벌 (2026-09-09, 같은 세션 이어서)

`poly.pizza/explore?anim=1&lic=1`(애니메이션·무료 라이선스 필터) 목록을
훑다가 `Ultimate Space Kit` 소속 Astronaut 가 이미 쓴 `ppmen_astronaut`
(Ultimate Modular Men Pack 소속, UUID 다름)와 별개로 3벌 있는 것을
찾았다 — 각 번들의 `/m/` 링크를 서로 대조해 겹치는 UUID(Farmer·Punk·
SWAT·King·BusinessMan·CasualCharacter·BeachCharacter·HoodieCharacter·
Worker·Man 등, Ultimate Modular Men/Animated Men Pack과 이름이 같아
보였던 것들)를 먼저 걸러내고 남은 것.

| 자산 | 받은 곳 | 만든이 | 라이선스 |
|---|---|---|---|
| Astronaut(1) | `poly.pizza/m/0D54W8yfrA` → `static.poly.pizza/f06659f2-e505-43df-a3db-84faec811a57.glb` | Quaternius | CC0 |
| Astronaut(2) | `poly.pizza/m/OgeSH89Nmx` → `static.poly.pizza/29010dcf-84c9-4eaf-a874-c44ef3166f55.glb` | Quaternius | CC0 |
| Astronaut(3) | `poly.pizza/m/zbtPq4dOJL` → `static.poly.pizza/9cd2d5d8-953d-4aee-8e46-f72b12ff5855.glb` | Quaternius | CC0 |

셋 다 같은 뼈대·`CharacterArmature|*` 클립 18개(색·소재 텍스처만 다른
변형) — `mapClips()` 그대로 받는다. `assets/models/people/
polypizza_space/`에 둠, `tools/glb-compress`로 압축(2.1MB→0.6MB),
`HERO_RECIPES_LIGHT`에 `ppspace_*`로 등록 — **62→65종**.

## 캐릭터 6차분 — KayKit Adventurers Character Pack 5벌 (2026-09-09, 같은 세션 이어서)

몬스터 트랙에서 이미 쓴 KayKit Skeletons와 같은 저작자(Kay Lousberg)의
사람 캐릭터 팩. poly.pizza에는 유료로 올라와 있지만(검색으로 확인),
같은 팩을 GitHub 조직(`KayKit-Game-Assets`)이 직접 CC0로 미러해 둔다 —
Skeletons 때와 같은 요령으로 itch.io를 거치지 않고 거기서 받았다.

| 자산 | 받은 곳 | 만든이 | 라이선스 |
|---|---|---|---|
| Barbarian·Knight·Mage·Rogue·Rogue_Hooded | `github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0`, `Characters/gltf/*.glb` | Kay Lousberg(KayKit) | CC0 |

`LICENSE.txt`(저장소에 직접 포함) 확인 — "License: (Creative Commons
Zero, CC0) … free to use in personal, educational and commercial
projects". 저작자 표시 불필요(권장 사항일 뿐).

몸 하나에 제 클립을 **76개**씩 내장 — 이 판이 지금까지 쓴 어떤 사람
자산보다 촘촘하다(Idle·Walking_A/B/C·Running_A/B·Dodge_Forward/Backward/
Left/Right·Hit_A/B·Death_A/B·1H/2H_Melee_Attack_*·Interact·Jump_* 등).
`mapClips()` word 표가 "Walking"·"Running"·"Attack"·"Dodge"·"Hit"·
"Death"·"Interact"를 그대로 하위문자열로 잡아 리타깃 없이 받는다.

`assets/models/people/kaykit_adventurers/`에 둠, `tools/glb-compress`로
압축(17.2MB→9.6MB, 44% 감소 — 클립이 워낙 많아 위 KayKit Skeletons와
비슷한 압축률). 압축 후 1.95~1.97MB/벌 — `HERO_RECIPES_LIGHT`의 기존
최중량 레시피 QRPG(1.6~2.1MB)와 같은 급이라, `hero_light`에서 뺀
MPFB(3.5~4.3MB, 위 §"2026-09-07" 참고)의 무게 함정과는 다른 체급으로
판단해 그대로 얹었다. `HERO_RECIPES_LIGHT`에 `kaykitadv_*`로 등록 —
**65→70종**.

같은 번들의 Enemy Small/Large/Flying·Mech·Rover(로봇/외계생물)는 사람형이
아니라 등록 안 함 — "몬스터 100개" 트랙 후보로 남겨 둠.

## 캐릭터 7차분 — Pirate kit 사람 3종, 클립 이름 깨짐 고쳐서 등록 (2026-09-09, 같은 세션 이어서)

`poly.pizza/bundle/Pirate-kit-0q5ulmIYqQ`(Quaternius, CC0)의 사람형 3종 —
Pirate Captain(`m/sN18LyyHAU`)·Anne(`m/tZYaOQ4l94`)·Henry(`m/yEdSk8tRKc`).
셋 다 CC0, Animated 태그 확인.

> **받는 김에 발견 — 이 번들 특유의 클립 이름 깨짐.** 셋 다 애니메이션
> 트랙 이름이 `CharacterArmature|CharacterArmature|CharacterArmature|
> <어간>|CharacterArmature|<어간을 81자 상한에서 다시 자른 것>` 꼴로
> 나갔다(예: `...Death|CharacterArmature|Dea`, `...HitReact|
> CharacterArmature|`—뒤가 통째로 잘려 빈 문자열). `mapClips()`는 마지막
> `|` 뒤 조각만 보는데 그 조각이 잘린 부스러기(`Dea`·빈 문자열·`Pun`)라
> **death·attack·hit 세 슬롯이 전부 idle로 새 버렸다**(고치기 전 실제로
> `mapClips()`를 직접 돌려 재현·확인). 같은 `CharacterArmature|*` 계열인
> `ppmore_*`·`ppspace_*`는 이 문제가 없다(대조 확인) — 이 번들만의
> 익스포트 문제로 보인다.
>
> **고침** — 3번째 `|` 조각(`...|CharacterArmature|CharacterArmature|
> CharacterArmature|<여기>|...`)은 어느 클립에서도 안 잘리고 온전한
> 진짜 어간이라, 그걸 읽어 `CharacterArmature|<어간>`으로 다시 쓰는
> 세션 임시 스크립트를 한 번 돌렸다. **glTF의 JSON 청크만 다시 쓰고
> BIN 청크(스켈레톤·정점·키프레임)는 바이트 그대로 복사** — 애니메이션
> 실제 동작은 안 건드리고 이름표만 고쳤다. `gltf-transform inspect`로
> 파일이 여전히 유효한지, 고친 뒤 `mapClips()`가 death·attack(Punch)·
> hit(HitReact)까지 실제 클립으로 잡는지(전엔 셋 다 idle 대체) 확인.
> 이 스크립트는 이번 3개에만 한 번 쓰고 커밋하지 않았다 — 같은 문제가
> 또 나오면(이 번들의 다른 사람형을 더 받을 때 등) 이 절의 방법을
> 다시 쓸 것.

`assets/models/people/polypizza_pirate/`에 둠(이름을 고친 뒤 파일),
`tools/glb-compress`로 압축(1.9MB→0.5MB, 72% 감소). `HERO_RECIPES_LIGHT`에
`pppirate_*`로 등록 — **70→73종**.

## 캐릭터 8차분 — Post Apocalypse Pack "Lis" 1종 (2026-09-09, 같은 세션 이어서)

`poly.pizza/bundle/Post-Apocolypse-Pack-jg0We8Clu0`(51종, 대부분 좀비·
차량 소품·표지판)을 훑어 사람형 하나(Lis, `m/gjuwleUT1U` →
`static.poly.pizza/5c3f2a86-c030-49aa-8a4c-86a7a1220801.glb`)를 더
찾았다. Quaternius, CC0, Animated. 클립 20개(Death·Duck·HitReact·Idle·
Idle_Gun·Jump·Jump_Idle·Jump_Land·Punch·Run·Run_Gun·Run_Slash·Run_Stab·
Slash·Stab·Walk·Walk_Gun·Wave 등) — 위 Pirate kit과 달리 이름이 안
깨져 있다(대조 확인, 그 번들만의 문제였음을 재확인).

같은 번들의 "Characters Matt/Shaun/Sam"(이미 `ppmore_*`로 등록됨,
UUID 대조로 확인)·Zombie 3종(몬스터 트랙 후보)·German Shepard·
"Characters Pug"(둘 다 짐승, 펫 트랙 후보)는 스킵.

`assets/models/people/polypizza_apoc/`에 둠, `tools/glb-compress`로 압축
(0.7MB→0.2MB). `HERO_RECIPES_LIGHT`에 `ppapoc_lis`로 등록 — **73→74종**.

**막힌 것** — Quaternius 공식 사이트(`quaternius.com`)에 더 있는 캐릭터
류(Knight Character·Modular Character Outfits Fantasy·Animated Man/
Woman 단품)는 poly.pizza 미러가 없고 전부 Google Drive 폴더로만
배포된다. Drive 폴더를 직접 긁어 파일 ID까지는 뽑았지만(예:
`drive.google.com/drive/folders/1XQ3UpQezkOFDdazv6KK16qp3mBXhO9uO`),
개별 파일이 `.mp4` 미리보기·확인 페이지가 섞여 있어 어떤 게 실제
`.glb`인지 신뢰성 있게 가려내려면 더 손이 간다 — 다음에 이어갈 때
여기부터. `quaternius.itch.io`의 개별 팩(예: `lowpoly-animated-knight`,
CC0 확인됨)도 "이름값 지불"식이라 페이지에 직접 다운로드 링크가 없고
itch.io 결제/받기 흐름(세션·CSRF)을 거쳐야 해 스크립트로는 못 받았다
— 사용자가 UAL2·Universal Base Characters 때처럼 직접 받아 전달해
주면 바로 쓸 수 있다.

## 캐릭터 9차분 — "Hazmat" 두 작가, 두 몸 (2026-09-09, 같은 세션 이어서)

`poly.pizza/search/hazmat`에서 같은 방호복 컨셉을 서로 다른 작가
둘에게서 찾았다 — 몸(리그)이 서로 다르므로 둘 다 등록.

| 자산 | 받은 곳 | 만든이 | 라이선스 |
|---|---|---|---|
| Character Hazmat | `poly.pizza/m/z3TSQYx1Kn` → `static.poly.pizza/484450a4-b76c-4e76-95d2-352337bb41e8.glb` | Quaternius | CC0 |
| Hazmat Man | `poly.pizza/m/y2ygMH3VYx` → `static.poly.pizza/b18bedd3-8afe-45fa-b1f5-43288396cb5d.glb` | Charlie | CC-BY 3.0 |

Character Hazmat은 클립 17개(`CharacterArmature|*`, 안 깨짐 — Pirate kit
문제 대조 확인). Hazmat Man은 클립이 `idle`·`run_anydirection`·`death`
셋뿐이라 얇지만(공격·피격은 FALLBACK으로 idle 대체) 실존하고 몸도
확연히 다르다.

같은 검색에서 걸린 "Blocks Humanoid"(3Donimus)·"Character Base"·
"Low Poly human with tabard"는 poly.pizza가 "Animated" 태그를 달아
뒀지만 실제 GLB엔 애니메이션 클립이 **0개**였다(직접 파싱해 확인) —
스킵. 이 판단 근거를 남겨 둔다: **poly.pizza의 "Animated" 태그는
신뢰할 수 없다** — 다운로드해서 GLB JSON 청크의 `animations` 배열을
직접 세어 보기 전까진 등록하지 않는다(이번 세션 내내 지켜온 방식,
공식화해 적어 둠).

`assets/models/people/polypizza_hazmat/`에 둠, `tools/glb-compress`로
압축(2.1MB→0.5MB, 78% 감소). `HERO_RECIPES_LIGHT`에 `pphazmat_*`로
등록 — **74→76종**.

## 캐릭터 10차분 — 검색어를 넓혀서 (2026-09-09, 같은 세션 이어서)

사용자 요청("poly.pizza 검색 더 넓혀서 계속")으로 queen·sniper·medic·
assassin·paladin·gladiator·boxer·wrestler·santa·orc·troll·giant·angel·
demon·superhero·teacher·lawyer·artist·musician·swordsman·mercenary·
bandit·thief·blacksmith·alchemist·sorcerer·barbarian·peasant·wizard·
necromancer·guard·hunter·druid·elf·dwarf·mummy·sheriff·bride·groom·
cook·librarian·pilot·captain·general·commander·villager·merchant 약
48개 검색어를 훑었다.

**핵심 발견 — poly.pizza의 "Animated" 태그는 못 믿는다.** 이 라운드에서
"Animated" 태그가 달린 후보 10여 개를 실제로 받아 GLB JSON 청크의
`animations` 배열을 직접 세어 봤는데 **대부분 0개**였다(Female
Fighter·Supersup·King 2번째 개체·Voxel Character Male·OLDMAN·
Student·Soldier by madtrollstudio·Tiny Mage — 전부 스킵). 태그만 보고
등록하면 안 되고 반드시 다운로드해서 직접 세어야 한다는 걸 이 세션
내내 지켜 온 방식이 맞았음을 재확인.

실제로 클립이 있던 건 둘, 둘 다 Quaternius·CC0:

| 자산 | 걸린 검색어 | 받은 곳 | 클립 |
|---|---|---|---|
| Character Soldier | superhero | `poly.pizza/m/PpLF4rt4ah` → `static.poly.pizza/1083c1d3-d1d4-4682-adf6-bc516d06ac84.glb` | 14개, `CharacterArmature|*`, 안 깨짐 |
| Wizard | druid(엉뚱한 검색어) | `poly.pizza/m/o87Upt5uHX` → `static.poly.pizza/d206c071-7934-40eb-9091-35ebdf93c317.glb` | 9개(Idle·Walk·Death·HitRecieve·Dance·Bite_Front 등) — attack 슬롯 없어 FALLBACK |

`assets/models/people/polypizza_wide/`에 둠, `tools/glb-compress`로
압축(1.4MB→0.4MB). `HERO_RECIPES_LIGHT`에 `ppwide_*`로 등록 —
**76→78종**.

**남은 전략** — poly.pizza 개별 검색은 Quaternius 것 아니면 거의
전멸(다른 작가는 애니메이션 없는 정지 메시가 압도적으로 많다)이라
수율이 계속 떨어지고 있다. 다음에 이어갈 실질적인 방법은 앞 절에
적어 둔 두 갈래(Quaternius 공식 사이트의 Google Drive 배포,
quaternius.itch.io의 결제 흐름 뒤에 있는 팩들)를 사용자가 직접
받아 전달해 주는 것 — 검색으로는 이 근처가 한계에 가깝다.

## 캐릭터 11차분 — Kenney "Mini Characters" 열두 벌, poly.pizza 밖에서 (2026-09-09, 같은 세션 이어서)

사용자 요청("다른 곳 찾아봐")으로 poly.pizza를 벗어나 다른 CC0 출처를
훑었다. Kenney 공식 사이트(`kenney.nl`)에 이미 쓴 `Blocky Characters`
말고도 사람 캐릭터 팩이 몇 더 있다:

- `Animated Characters Protagonists` — FBX만 주고(GLB 없음) 클립도
  idle·jump·run 셋뿐이라 보류(이 판에 FBX→glTF 변환 도구가 없다,
  기존 "FBX 변환 파이프라인 보류" 결정과 같은 이유).
- `Modular Characters`(425개 파츠) — 몸+옷+머리 조합형이라 등록하려면
  `HERO_RECIPES_FALLBACK`류 조합 로직을 되살려야 한다, 이번엔 손 안 댐.
- **`Mini Characters`(CC0, `kenney.nl/assets/mini-characters`) — 12벌
  (character-female-a~f, character-male-a~f)을 그대로 등록.** `Models/
  GLB format/`에 이미 GLB로 준다, 클립 32개(`static`·`idle`·`walk`·
  `sprint`·`attack-melee-left/right`·`attack-kick-left/right`·`die`·
  `pick-up`·`emote-yes/no`·`interact-left/right`·`wheelchair-*` 등) —
  `Blocky Characters`와 **낱말표가 완전히 같다**(같은 Kenney 캐릭터
  리그 계열), `mapClips()` 그대로 받는다.

**밟은 함정** — 원본 GLB가 텍스처를 밖(`Textures/colormap.png`, 12벌이
공유하는 아틀라스 한 장)에 상대경로로 참조해서, GLB만 떼어 복사했더니
`tools/glb-compress`가 `ENOENT`로 전부 실패했다. 압축 전에 그 텍스처를
같은 폴더에 잠깐 같이 두고 돌리니(압축 과정에서 텍스처가 GLB 안으로
박힌다) 통과 — 끝난 뒤 이제 안 쓰는 원본 `Textures/` 폴더는 지웠다
(`Blocky Characters`도 폴더에 그런 게 안 남아 있는 것과 같은 모양).

`kenney.nl`은 다운로드 버튼이 JS로 그려져 있어 정적 `curl`로는 링크를
못 찾았다 — `WebFetch`로 페이지를 읽어 "Continue without donating…"
버튼 뒤의 `kenney.nl/media/pages/assets/<slug>/<hash>/kenney_<slug>.zip`
URL을 찾아낸 뒤 그 URL은 `curl`로 바로 받혔다(로그인·결제 불필요,
poly.pizza와 달리 zip 통째로 옴).

`assets/models/people/kenney_mini/`에 둠, `tools/glb-compress`로 압축
(2.9MB→0.7MB, 74% 감소). `HERO_RECIPES_LIGHT`에 `kmini_*`로 등록 —
**78→90종**. 남은 10종.

## 캐릭터 12차분 — OpenGameArt에서, FBX 변환 벽을 처음 넘음 (2026-09-09, 같은 세션 이어서, 목표 달성)

`opengameart.org/content/all-cc0-uploader-quaternius`(Quaternius 업로더
페이지)에서 poly.pizza엔 없던 예전 원본 업로드를 찾았다 — poly.pizza가
자체 CDN(glTF/GLB 직접 배포)으로 갈아탄 뒤에도 OpenGameArt엔 Blend/
FBX/OBJ만 있는 옛 zip이 그대로 남아 있다.

> **FBX 변환 벽을 처음 넘었다.** 이 판(과 다른 네 판)은 "FBX 전용
> 자산은 변환 도구가 없어 보류"를 여러 번 반복해 왔다(Kenney Animated
> Characters Protagonists/Retro/Survivors도 이번 세션에 같은 이유로
> 보류함, 위 참고). npm 패키지 `fbx2gltf`(페이스북 공식 `FBX2glTF`
> 바이너리를 그대로 감싼 래퍼)를 세션 스크래치 폴더에 설치해 실제
> 캐릭터 FBX를 돌려 보니 **한 번에 깨끗하게 변환됐다** — 스켈레톤·
> 애니메이션 클립 이름·개수가 그대로 나오고, `gltf-transform inspect`
> 로도 유효한 glTF임을 확인했다. 그동안 "도구가 없어서" 막혔던 게
> 아니라 "도구를 안 찾아봤던 것"이었다. **이 도구 자체는 저장소에
> 커밋하지 않았다** — 세션 스크래치에서 변환에만 쓰고, 결과 GLB만
> 커밋한다. `tools/glb-compress`처럼 다섯 판이 상시 쓰는 도구로
> 정식으로 들이려면 다음에 `tools/fbx2gltf/`를 만들 것(이번엔
> 급한 대로 임시로만 씀 — 재현 방법: `npm install fbx2gltf` 후
> `require('fbx2gltf').convert(src, dest)` 또는 그 패키지의
> `bin/<OS>/FBX2glTF(.exe)`를 직접 실행).

| 자산 | 받은 곳 | 만든이 | 라이선스 |
|---|---|---|---|
| Ultimate Animated Character Pack(50벌 넘음, 15벌만 골라 씀) | `opengameart.org/content/animated-characters-pack` → `ultimate_animated_character_pack_by_quaternius.zip`(48.4MB) | Quaternius | CC0 |
| LowPoly Animated Knight | `opengameart.org/content/lowpoly-animated-knight` → `Knight Character by @Quaternius.zip`(2.5MB) | Quaternius | CC0 |

**Ultimate Animated Character Pack**은 사람형만 50벌 넘게(휴먼·엘프·
좀비·닌자·사무라이 기모노·카우보이·바이킹·해적·고블린·의사·요리사
등) 들어 있다. 다양성 위주로 15벌만 골랐다(좀비·고블린은 몬스터
트랙 후보로 남김, 모자·머리카락 단품 액세서리·이미 가진 것과 이름이
겹치는 Casual/Soldier류는 스킵): Elf·Wizard·Witch·Doctor_Male_Old·
Doctor_Female_Young·Cowboy_Male·Cowboy_Female·Chef_Male·Kimono_Female·
Viking_Male·Pirate_Female·OldClassy_Male·Knight_Golden_Male·Ninja_Sand·
Suit_Male. 클립 11개씩(`CharacterArmature|Defeat·Idle·PickUp·Punch·
RecieveHit·Shoot_OneHanded·SitDown·StandUp·Victory·Walk·Walk_Carry`) —
`mapClips()`가 death·idle·interaction·attack·hit·walk를 실제 클립으로
잡는다(run·sprint·dodge는 walk로 대체). `assets/models/people/
oga_ultimate/`에 둠, `tools/glb-compress`로 압축(8.9MB→2.3MB).
`HERO_RECIPES_LIGHT`에 `ogau_*`로 등록.

**LowPoly Animated Knight**는 poly.pizza에서도(중복 UUID로 스킵),
quaternius.itch.io에서도(결제 흐름 막힘) 못 받았던 바로 그 자산 —
OpenGameArt 원본으로 우회해 받았다. `HumanArmature|*` 낱말표(위 팩과
다른 계열), 클립 12개(Death·Idle·Idle_swordLeft/Right·Jump·Roll·
Roll_sword·Run·Run_swordAttack/Right·swordAttackJump·Walking).
`assets/models/people/oga_knight/`에 둠, 압축(0.4MB→0.1MB).
`HERO_RECIPES_LIGHT`에 `ogaknight_char`로 등록.

**90→106종 — "캐릭터 100개" 목표 달성, 여유분 포함.** `Ultimate
Animated Character Pack`에 아직 안 쓴 사람형이 20벌 넘게 남아 있어
(BlueSoldier·Casual2/3·Goblin·Pirate_Male·Soldier·Viking_Female·
Zombie 등), 나중에 더 늘리고 싶으면 같은 zip(스크래치에 안 남아
있으면 위 URL로 재다운로드)에서 마저 고르면 된다.

## 캐릭터 13차분 — Ultimate Animated Character Pack 나머지 27벌 마저 (2026-09-09, 같은 세션 이어서)

사용자 요청("나머지 20벌도 마저 등록해줘")으로 위 팩에서 안 쓰고
남겨 뒀던 사람형을 전부 등록했다(세어 보니 27벌 — 좀비 2·고블린 2·
동물(Cow·Pug) 2·소품 단품(Chef_Hat·Cowboy_Hair·Ninja_Male_Hair·
VikingHelmet) 4개만 빼면 이만큼 남았다): BaseCharacter·
BlueSoldier_Female/Male·Casual_Bald·Casual_Female/Male·
Casual2_Female/Male·Casual3_Female/Male·Chef_Female·
Doctor_Female_Old·Doctor_Male_Young·Kimono_Male·
Knight_Golden_Female·Knight_Male·Ninja_Female/Male·
Ninja_Sand_Female·OldClassy_Female·Pirate_Male·
Soldier_Female/Male·Suit_Female·Viking_Female·Worker_Female/Male.

같은 팩·같은 클립 11개(`CharacterArmature|Defeat·Idle·PickUp·Punch·
RecieveHit·Shoot_OneHanded·SitDown·StandUp·Victory·Walk·Walk_Carry`),
같은 `fbx2gltf`(세션 스크래치, 저장소엔 미커밋) 변환 경로 — 27벌 전부
변환 종료 코드 0, 클립 개수 그대로 확인(3벌 표본 검사).

`assets/models/people/oga_ultimate/`(기존 폴더에 이어 씀)에 둠,
`tools/glb-compress`로 압축(신규 27벌만 처리, 기존 15벌은 매니페스트로
건너뜀 — 17.5MB→6.4MB, 63% 감소). `HERO_RECIPES_LIGHT`에 `ogau_*`로
등록 — **106→133종**.

이걸로 `Ultimate Animated Character Pack`의 사람형(좀비·고블린 제외)
42벌을 전부 썼다. 좀비 2·고블린 2는 몬스터 트랙 후보로 남겨 둠.

## Quaternius — Animated Dinosaur Pack (2026-09-14, `models/monsters/quaternius_dino/`)

PLAN "3안"(새 CC0 몬스터 에셋 조사, 2안에서 확정된 다음 순서)을 이어감.
2안(위 "몬스터 로스터 확장")은 **기존 몸 재활용**이었는데, 이번엔 실제로
새 GLB 를 받아 왔다.

| | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com>) |
| **라이선스** | CC0 1.0 — `quaternius.itch.io/animated-lowpoly-dinosaurs` 페이지에 "CC0" 명시 |
| **받은 곳** | GitHub `trebeljahr/quaternius-showcase`(이 판이 Frog·Wolf·Cow·Deer 등을 이미 받아 온 그 미러) `public/glb/dinosaurs_pack/` — 파일 크기를 원본과 대조해 확인 |
| **파일** | `Apatosaurus.glb`·`Parasaurolophus.glb`·`Stegosaurus.glb`·`Trex.glb`·`Triceratops.glb`·`Velociraptor.glb`(6종, 전부 idle·walk·run·attack·death·jump 클립 내장) |

**Quaternius 최신 팩 상당수가 QAL(Quaternius Asset License)로 바뀌어
있었다** — "Bestiary - Dungeon Monsters Kit"처럼 매력적인 후보를 찾아도
`quaternius.com/license.html`을 직접 읽어 보니 "스탠드얼론 에셋으로
재배포 금지" 조항이 있어(공개 저장소에 GLB 원본을 커밋하는 것 자체가
재배포에 해당) **못 썼다** — CC0(Easy Enemy Pack·Animated Dinosaur Pack
등, 아직 CC0로 남은 옛 팩)만 후보로 남는다. 팩 이름만 보고 받지 말고
**팩 페이지에서 라이선스를 낱개로 확인할 것**(quaternius.com 홈의 팩
목록에 CC0/QAL 이 안 적혀 있다 — 각 팩 상세 페이지를 열어야 보인다).

`tools/glb-compress`로 재압축(6개, 1.9MB→0.7MB). `js/asset3d.js`
`monster:dino_apato`·`dino_para`·`dino_stego`·`dino_trex`·`dino_tri`·
`dino_raptor`로 등록, `js/data-enemy.js`에 여섯(쾌조룡·볏공룡·판갑룡·
폭룡·삼각뿔룡·장경룡, tier 2~4)을 새로 얹었다. 기존 `monster:dino`
(Ultimate Monsters 소속, '뿔공룡'/'왕뿔공룡'이 쓰던 그 하나뿐인 공룡)와는
다른 개체라 안 건드렸다.

### 같이 잡은 진짜 버그 — `monster:` 네임스페이스가 통째로 안 이어져 있었다

이번 여섯을 실제로 연결하려고 기존 파이프라인을 따라가 보니, "몬스터
100개" 확장(2026-09-07~11)이 `js/asset3d.js` DEFAULTS 에 채운 58종
(KayKit Skeletons·Ultimate Monsters·Animated Enemies 등, 전부
`monster:이름` 접두 키)을 `js/data-enemy.js`의 `body` 필드는 접두어 없이
맨 이름(`'skeleton_minion'`·`'ghost'`·`'dragon_evolved'` 등)으로 적어
왔는데, `dungeon3d.js`가 `body` 값을 그대로 `AS3.build()`에 넘기는
자리엔 그 접두어를 붙이는 코드가 없었다 — `REG[kind]`가 늘 undefined 라
GLB 를 하나도 못 받고 **조용히 상자(fallback shape)로만 그려지고
있었다**(예외가 안 나 자가진단·"500회 스폰" 구조 검사 어느 것도 못 잡는
자리 — 둘 다 "구조가 맞는지"만 보지 "GLB 가 실제로 붙는지"는 안 봤다).
Node `vm`으로 `asset3d.js`+`data-enemy.js`를 그대로 불러 `REG` 대조를
직접 해 보니 짐승형 94개 중 **88개**, 보스 '천룡'(`dragon_evolved`)까지
걸려 있었다.

**고침** — `js/asset3d.js`의 `lookup(kind)`가 맨 이름이 REG 에 없으면
`monster:`를 붙여 한 번 더 찾도록 두 줄 보탰다(REG·DEFAULTS·
data-enemy.js 는 한 글자도 안 건드렸다 — 2026-09-11 주석이 적어 둔 "여기는
안 건드리고 표만 고치면 된다"의 그 "표를 잇는 다리" 쪽이 빠져 있던
것뿐이었다). 고친 뒤 Node `vm`으로 재확인 — 짐승형 94개+보스 11개 전부
`AS3.lookup()`이 성공. 이 여섯 다이노도 이 다리를 그대로 탄다(등록만
해 두면 바로 붙는다는 뜻 — 새로 확인해야 할 건 실기기 렌더뿐).

**아직 확인 못 한 것** — 이번 고침으로 몬스터 88종이 처음으로 실제 GLB
를 받게 되므로, 다음 실기기 확인 때 지금까지 상자로만 보이던 자리들이
실제 모델로 바뀌는지 볼 것(개발 중 헤드리스 스크린샷은 안 찍었다 —
`_test.html` 296/296 3회 동일로만 회귀 확인).

## Quaternius — Cute Animated Monsters (2026-09-14, 같은 세션 이어서, `models/monsters/quaternius_cute/`)

PLAN "3안"을 계속 — 위 공룡 6종에 이어 다섯을 더 받았다.

| | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com>) |
| **라이선스** | CC0 1.0 — `quaternius.com/packs/animatedmonster.html` 페이지에 `creativecommons.org/publicdomain/zero/1.0/` 링크로 명시(itch.io `lowpoly-animated-monsters` 페이지도 CC0로 동일 표시) |
| **받은 곳** | `opengameart.org/content/lowpoly-animated-monsters` → `Animated Monster Pack by @Quaternius.zip`(OGA 미러 — itch.io 원본은 무료 항목도 결제 흐름을 타 curl로 못 받는다, 아래 "안 쓴 것" 참고) |
| **파일** | FBX만 제공(GLTF 없음) — `Cyclops.fbx`·`Crab.fbx`·`Cthulhu.fbx`·`Tree.fbx`·`GreenDemon.fbx` 다섯만 골라 `fbx2gltf`(npm, 세션 스크래치, 저장소엔 미커밋 — "캐릭터 12차분" 절과 같은 도구)로 변환 |

**21종 중 다섯만 골랐다.** 나머지는:
- **Demon·Yeti·Cactus·Mushroom·Skull** — 이미 `PEOPLE_MONSTERS_Q`(Ultimate
  Monsters) 쪽에 같은 개체 콘셉트가 있다(`monster:demon`·`monster:yeti`·
  `monster:cactoro`·`monster:mushnub` 등). 다이노처럼 "다른 팩의 다른
  개체"로 또 얹을 수도 있었지만, 이번엔 로스터에 진짜 빈자리(외눈거인·
  게·나무정령·이 판에 없던 결의 악마·촉수 괴물)부터 채우는 쪽을 골랐다.
- **Alien·Alien_Tall** — 2026-09-11 "몬스터 로스터 확장" 주석과 같은
  이유로 제외(이름 정책·SF풍이 이 판 결에 안 맞는다는 그 결정을 그대로
  따랐다 — `monster:alien`도 이미 REG에 등록만 되고 `data-enemy.js`에는
  안 쓰인 채로 남아 있다).
- **Bat·Bee·Chicken·Deer·Panda·Penguin·Pig** — 순한 동물/새라 "괴물"보다는
  마을 가축 쪽 결이라 이번 범위 밖.

**itch.io "Monster Pack Animated by Quaternius"(위 "캐릭터 2차분" 절에서
이미 검토했던 그 팩, Bat·Dragon·Skeleton·Slime 4종)는 여전히 안 썼다** —
Dragon·Skeleton·Slime은 이번에도 다른 소스로 이미 있고, Bat 하나만 새로울
사정이 그대로라 이번에도 보류(그 절의 판단이 여전히 유효했다).

**애니메이션** — 다섯 모두 같은 리그(`MonsterArmature|*`), 클립 10개
(Idle·Walk·Death·HitRecieve·Bite_Front·Bite_InPlace·Jump·Dance·Yes·No).
`mapClips()` 낱말표에 "bite"가 없어 **attack 슬롯은 idle로 대체**된다
(2026-09-09 "Wizard.glb" 절과 같은 자리 — 그때도 낱말표를 안 건드리고
그대로 받아들였다, 이번에도 공용 엔진 코드는 한 글자도 안 건드렸다).
idle·walk·death·hit 넷은 정확히 잡힌다.

`tools/glb-compress`로 재압축(5개, 0.6MB→0.2MB). `js/asset3d.js`
DEFAULTS에 `monster:cyclops`·`monster:crab`·`monster:cthulhu`·
`monster:treant`·`monster:demon_green`으로 등록, `js/data-enemy.js`에
다섯(풋귀·집게괴·고목정·외눈귀·심연촉수귀, tier 1~4)을 얹었다 — 표시
이름은 전부 새로 지은 민담풍 낱말이라(크툴루 신화의 그 이름은 내부
`body` 식별자에만 남는다) 이름 정책에 걸리지 않는다.

**검증** — Node `vm`으로 `asset3d.js`+`data-enemy.js`를 그대로 불러(1)
적+보스 135개 전부 `lookup(e.body)` 성공(신규 5종 포함, 0 누락), (2) 이름
135개 중복 없음, (3) tier 1~4 유효성, (4) `poolFor()`로 층 1·4·8·15·30
전부 빈 풀 없음 확인. `_test.html`(헤드리스 크롬)은 3회 연속 동일
결과로 회귀만 확인(개수는 안 늘었다 — 이 판의 몬스터 구조 검사는
`_test.html`이 아니라 위 Node 검증으로 한다는 게 2026-09-11부터의
관례). **실기기 확인 전** — 다섯 다 새 몸이라 실제로 붙는 자리(외눈귀는
`form:'ogre'`라 사람 크기 스케일로 나올 텐데 실제 '거인'다운 위압감이
나는지, 게(`crab`)는 `form:'quad'`로 근사했는데 실루엣이 어색하지
않은지)는 사용자가 봐야 한다.

### 정정 — 위 "받은 곳" URL이 실제로는 다른(더 작은) 팩을 가리킨다 (2026-09-14, 다음 세션)

"3안"을 더 이어보려고 위 URL(`opengameart.org/content/lowpoly-animated-monsters`)을
다시 열어 보니, 그 페이지의 실제 zip(`Animated Monster Pack by @Quaternius.zip`,
1.4MB)은 **Bat·Dragon·Skeleton·Slime 4종뿐**이다(바로 위 "itch.io 안 쓴 것" 절이
말하는 그 4종 팩과 같다) — Cyclops·Crab·Cthulhu·Tree·GreenDemon 등 21종은
**여기서 온 게 아니었다.** 실제 21종 팩은 `opengameart.org/content/
textured-cute-monster-pack`(zip 이름 `cute_animated_monsters_-_aug_2020.zip`,
10.2MB, 라이선스는 같은 CC0 — 페이지에 "CC0 - Uploader: quaternius" 명시)이다.
기록을 정정한다 — 다음에 이 팩을 더 열어 볼 때는 `textured-cute-monster-pack`
쪽을 볼 것.

**같은 김에 21종 중 이번에도 안 쓴 나머지를 확인** — `Ghost`·`YellowDragon`
두 종은 위 목록(Demon·Yeti·Cactus·Mushroom·Skull·Alien·Alien_Tall·Bat·Bee·
Chicken·Deer·Panda·Penguin·Pig, 14종)에 안 들어 있었다(2026-09-14 앞 세션이
빠뜨린 것으로 보인다) — 확인해 보니 **둘 다 이유가 있어 뺀다**: `Ghost`는
`monster:ghost`(다른 소스)가 이미 있고, `YellowDragon`은 "천룡(dragon_evolved)은
둘째를 만들면 특별함이 옅어져 제외"(위 "몬스터 로스터 확장" 절)와 같은 이유로
피한다. **이걸로 21종 전부(다섯 종 사용 + 16종 제외 사유 확인)가 설명된다.**

**"3안"을 더 이어가 보려 한 시도와 그 결론** — 이번 세션이 실제로 찾아본 것:
- `trebeljahr/quaternius-showcase`(GitHub, 이미 공룡 6종을 받은 그 GLB 미러)의
  `easy_enemies_pack`(Frog·Rat·Snake·Spider·Wasp)과 `animals_pack`(Alpaca·Bull·
  Cow·Deer·Donkey·Fox·Horse·Husky·ShibaInu·Stag)은 **이미 이 판에 전부 등록돼
  있었다**(`monster:frog`·`monster:rat` 등, `pet:alpaca` 등 — 다른 다운로드
  경로로 먼저 들어와 있었을 뿐).
- OGA `lowpoly-animated-knight`(Quaternius, CC0)의 `KnightCharacter.fbx`는
  `assets/models/people/oga_knight/KnightCharacter.glb`로 **2026-09-09에 이미
  변환·등록돼 있었다**(`ogaknight_char`, 사람형 쪽).
- OGA `lowpoly-animated-farm-animal-pack`(Cow·Horse·Llama·Pig·Pug·Sheep·Zebra,
  2018년 팩)은 FBX/OBJ/Blend뿐이고 애니메이션도 불확실해 보류, 종도 이미 다른
  소스로 다 있다.
- `trebeljahr/quaternius-showcase`의 `fish_pack`(Dolphin·Fish1~3·Manta_ray·
  Shark·Whale)도 이미 `pet:`로 다 등록돼 있었다. `platformer_pack`·
  `platformer_game_pack`은 마리오풍 플랫포머 소품(구름·파이프·동전 등)이라 이
  판 결과 안 맞는다(2026-09-11 Alien 제외와 같은 판단).
- **결론 — 이번엔 새로 쓸 만한 미사용 CC0 "몬스터" 후보를 못 찾았다.** 남은
  합리적인 다음 수는 (a) 위 Bat·Bee·Chicken·Panda·Penguin(Deer·Pig는 이미
  `pet:deer`·`pet:pig`로 있다) 을 **몬스터가 아니라 `pt_*` 도감 펫으로** 얹는
  것인데, `js/data.js`(PETS)는 다섯 판이 **같은 내용으로** 들고 있어야 해서
  saga-dungeon 폴더 하나만 고치는 세션은 손대면 안 된다(`../../CLAUDE.md`) —
  다섯 판을 함께 보는 세션이 맡을 것. (b) `quaternius.com/packs.html`은 목록이
  JS로 그려져 있어 curl로는 안 보인다 — 실제 팩 URL을 하나씩 짐작해 그 상세
  페이지(`quaternius.com/packs/<이름>.html`)를 직접 열어 라이선스(CC0/QAL)를
  낱개 확인하는 수밖에 없다(이번엔 여기까지는 안 갔다).
- **참고 — FBX→glTF 변환 도구가 이 환경에서도 된다.** `npm install fbx2gltf`
  뒤 `node_modules/fbx2gltf/bin/Windows_NT/FBX2glTF.exe`(윈도우 실행 파일이
  postinstall로 같이 깔린다)가 실제로 동작한다(`-i in.fbx -o out --binary`).
  이전 세션들의 "session scratch, 저장소엔 미커밋"이 가리키던 게 이것이다 —
  다음에 이 도구가 있는지부터 다시 찾아 헤매지 않아도 된다.

## 들판 지형 트라이플레이너 텍스처 3장 (2026-09-18, `textures/land/`, PLAN §6.1 항목 5)

새로 CC0 사진을 받아오지 않고 **다섯 판 안에 이미 있는 CC0 1.0 텍스처를
그대로 옮겼다**(saga-forest가 2026-09-XX에 먼저 이 셋을 이렇게 모아 둔
전례를 그대로 따른다 — `saga-forest/assets/ASSET_LICENSES.md`의 같은 절
참고).

| 파일 | 옮겨 온 곳 | 원 출처 |
|---|---|---|
| `assets/textures/land/grass.webp` | `saga-forest/assets/textures/land/grass.webp`(← `saga-go/.../grass1.webp`) | ambientCG `Grass005`(CC0 1.0) |
| `assets/textures/land/dirt.webp` | `saga-forest/assets/textures/land/dirt.webp`(← `saga-go/.../road1.webp`) | ambientCG `Ground081`(CC0 1.0) |
| `assets/textures/land/stone.webp` | 이 폴더 `assets/textures/dungeon/floor_stone.webp`(사본) | polyhaven(CC0 1.0) — 위 "Poly Haven — 바닥·벽 돌 텍스처" 절 |

`js/terrain3d.js`가 `MeshToonMaterial.onBeforeCompile`로 세 장을 셋 다 한
칸(들판 타일)에 실시간 블렌드한다(트라이플레이너 UV + 경사·노이즈 가중,
PLAN §6.1-5) — 방(room) 바닥은 그대로 `groundMat()`(노이즈 반점)을 쓴다,
안 건드렸다.

## VRM 애니메 아바타 (2026-09-20, saga-forest 에서 옮김)

`assets/models/people/anime/avatar_{sample_a,sample_b,sample_c,custom_01}.glb` —
VRoid Studio 공식 CC0 샘플 AvatarSample_A/B/C(github.com/madjin/vrm-samples,
저작권 포기·상업 이용 무료·표시 의무 없음) + 이 저장소가 GUI 자동화로 새로
빚은 avatar_custom_01(라이선스는 상업 이용 허가 CC BY로 내보냄). 넷 다
`saga-forest/assets/ASSET_LICENSES.md`의 같은 절과 같은 파일(md5 동일) —
자세한 출처·내보내기 경위는 그쪽 문서 참고. `js/asset3d.js`의
`HERO_RECIPES_ANIME`(기본 꺼짐, `world3d.animeAvatar` 손잡이)로만 쓰인다.

## VRM 애니메 아바타 가공 (2026-09-20)

`assets/models/people/anime/avatar_*.glb` 넷은 `tools/glb-compress/vrm-slim.mjs` 로 **가공한 파일**이다 —
표정 모프 타깃(54~57개)을 떼고 같은 재질 프리미티브를 합쳤다(정점·뼈·재질·텍스처는 그대로, 용량 25MB → 11MB,
캐릭터당 드로우콜 90~135 → 14~19). 다섯 판 복사본은 같은 파일(md5 동일)이다.

## Kenney — Roguelike Characters Pack (`assets/sprites2d/human_*.png`, 2026-09-20, saga-forest 에서 옮김)

| 항목 | |
|---|---|
| **만든 이** | Kenney (<https://kenney.nl>) |
| **라이선스** | **CC0 1.0 Universal** (퍼블릭 도메인 헌정) |
| **저작자 표시** | 필요 없다. 그래도 적어 둔다 |
| **재배포** | 허용된다 |
| **받은 곳** | <https://kenney.nl/assets/roguelike-characters> — `kenney_roguelike-characters.zip` 안 `Spritesheet/roguelikeChar_transparent.png` |

2D 던전 뷰(`dungeon-view.js` 의 `stamp()` 넷)가 부르는 `sprite.js` 의 `bake()`(`kind==='human'`)가 여태 원·선으로 절차적으로
그리던 **사람**(NPC·동행·주인공·인간형 적)을 이 시트에서 오려 낸 정지 그림 열넷으로 바꿨다(SAGA-DESIGN §11 Phase 2, 사용자가
"사가나락 2D 살려서" 로 Q-2D-2 결정). 파일은 `saga-forest/assets/sprites2d/human_01~14.png` 와 같은 것(md5 동일)이고 자르는 좌표·표도
그쪽 `ASSET_LICENSES.md` 의 같은 절과 같다. **트레이드오프** — 인물별 색·등신·걷기 다리 애니메이션은 못 낸다(고정 그림 한 장).
인물 id 를 해시해 열넷 중 하나를 **늘 같은 얼굴로** 고르고, 좌우 뒤집기와 걸음 통통거림은 그림과 무관하게 산다. 이 판의 양식인
디아블로풍 후처리(`diabloize`, 어둡고 채도 낮게)는 그림에도 그대로 건다. 그림이 아직 안 실린 첫 프레임만 옛 코드 그림으로
채우고 곧 다시 굽는다. 짐승(`beast()`)은 아직 코드 그림이다(Phase 3). 3D 던전 뷰와 도감 초상은 영향이 없다.

## 몬스터 2D 시트 — 3D 몸을 옆모습 걷기 그림으로 미리 구움 (`assets/sprites2d/mon_*.webp`, 2026-09-20)

`tools/bake-portraits/bake.mjs --sprites=monsters` 가 `data-enemy.js` 의 짐승 형 적 몸 60종(`asset3d.js` REG 의 `monster:*`·`beast*` 키)을
**옆에서 본 5컷 가로 시트**(걷기 4 + 서기 1, 컷 128px, 외곽선 끔)로 구운 것이다. 2D 던전 뷰(`sprite.js` 의 `bake()` 짐승 분기)만 쓰고
`mon-manifest.js` 에 적힌 몸만 그린다. **원본은 위 각 절의 GLB 그대로다 — 새로 받은 것이 하나도 없고**, 이 그림은 그 모델을 화면에
찍은 파생물이므로 **각 모델의 라이선스가 그대로 따른다**(표시 의무 포함): Quaternius·KayKit 몬스터·동물은 CC0(표시 불필요),
**Slime Enemy 는 Charlie 의 CC-BY(저작자 표시 필요)**, **Boar·Tiger·Elephant 는 Poly by Google 의 CC-BY 3.0(표시 필요)** — 표시 문구는
위 해당 절과 같고 그대로 이행한다. 이 그림을 다시 뽑거나 모델을 바꾸면 이 절과 위 절을 같이 본다.

## 사람 2D 시트 — 사람마다 3D 몸을 옆모습 걷기 그림으로 미리 구움 (`assets/sprites2d/people/*.webp`, 2026-09-25)

`tools/bake-portraits/bake.mjs --sprites=people` 가 `sprite.peopleList()` 의 174명(도감 인물 135 · 마을 사람 7 · 세 시대 손님 4 · 사람 적 28)을
위 몬스터 시트와 같은 5컷 가로 시트(컷 96px)로 구운 것이다. 2D 던전 뷰의 사람 그림이 Kenney 열넷(위 절)을 해시로 나눠 쓰던 것을
사람마다 제 그림으로 바꾼다(`people-manifest.js` 에 적힌 것만, 없으면 Kenney 그대로). **원본은 위 각 절의 GLB·VRM 그대로다 — 새로 받은
것이 없고**, 이 그림은 파생물이므로 각 모델의 라이선스가 그대로 따른다: VRoid 몸(`people/anime/`)·Quaternius·KayKit·OGA 사람은 위 해당 절,
poly.pizza 의 CC-BY 몸은 **위 절의 저작자 표시를 그대로 이행**한다. 모델을 바꾸면 이 절과 위 절을 같이 본다.

## 도감(펫) 초상 — 3D 굽기가 안 되는 91종을 사가만리 `beast_*.png` 16장으로 일부 채움 (2026-09-22)

`assets/portraits/pet/`(14종, 위 "도감(펫) 초상 실사화" 절)와 `asset3d.js` REG 에 없어 3D 굽기 자체가 안 되는 나머지
91종(SAGA-HANDOFF·이 판 `HANDOFF.md` 2026-09-22 절 — `bake-portraits --kind=pet` 210회 재시도 중 신규분 0회 성공)은
여태 절차적 `beast()` 그림뿐이었다. 그중 **종이 실제로 겹치는 16종**만 `saga-go/assets/sprites2d/beast_*.png`(CC0, 원본
출처는 `../saga-go/assets/ASSET_LICENSES.md` "짐승 도감(펫) 지도 스탬프" 절의 Quaternius GLB 들 — 재배포 조건 없음)을
**그대로 md5 동일 복사**해 썼다: `beast_Fox`·`Dolphin`·`Shark`·`Manta_ray`·`Stag`·`Horse_White`·`Horse`·`Donkey`·`Cow`·
`Bull`·`Stegosaurus`·`Trex`·`Triceratops`·`Velociraptor`·`Koi`·`Alpaca`. 사가만리는 형태(form)별 여럿 중 해시로 아무거나
고르지만(배경 채움용), 이 판 펫은 이름이 있는 특정 종이라 **종 이름이 실제로 맞는 자리에만** 못 박아 썼다(`PET_IMG`,
`js/sprite.js`) — 예: `pt_shark_2`(백상아리)·`pt_horse_farm`(짐말)처럼 정확히 겹치는 파일이 없는 근연종은 같은 계열
그림을 재사용(상어·말)하고, 안 맞는 종(물고기 대다수·신수·포켓몬 오마주)은 그대로 절차적 그림에 남겼다. 96×96 PNG라
장당 3~8KB, 16장 합쳐 76KB. 도감 목록(`portrait()`)·상세화면(`portraitCard()`) 양쪽 다 `diabloize()` 후처리를 그대로
건다(이 판 공통 화풍). 남은 75종(신수 11·포켓몬 16·안 맞는 물고기 등 48)은 여전히 절차적 그림 — 재도전하려면 이 절과
`HANDOFF.md` 2026-09-22 절을 같이 본다.

## Poly Haven — HDRI 환경광 (`assets/hdri/alps_field_1k.hdr`)

| 항목 | |
|---|---|
| **만든 이** | Poly Haven (<https://polyhaven.com>) |
| **라이선스** | **CC0 1.0 Universal** (퍼블릭 도메인 헌정) |
| **저작자 표시** | 필요 없다. 그래도 적어 둔다 |
| **재배포** | 허용된다 |
| **받은 곳** | 사가마을·사가만리와 같은 파일(다섯 판 공용 CC0 자산 — 원본 <https://polyhaven.com/a/alps_field>, 1k `.hdr`) |

`js/dungeon3d.js` 의 `HDRI_SRC` 가 PBR 재질 반사·거칠기용 `scene.environment` 로만 쓴다(배경 하늘은 안 바꾼다).
2026-09-23 `tools/asset-audit` 이 이 판 문서에만 빠진 것을 잡아 채웠다.


## 신수·포켓몬 오마주 대역 모델 — 사가만리에서 복사 (2026-09-23)

`models/standin/` — `Birb.glb`·`Pigeon.glb`·`Snake.glb`·`Snake_angry.glb`·`Orc.gltf`·`Demon.gltf`. 사가만리 `assets/models/animals/` 의 같은 파일을
**그대로 복사**했다(출처·경위는 `saga-web/saga-go/assets/ASSET_LICENSES.md` — Quaternius CC0: 새 둘은 animals pack, 뱀 둘은 easy_enemies_pack,
Orc·Demon 은 Ultimate Monsters). 사용자 결정("사가만리처럼 대역 입히기")으로 신수·오마주 도감 초상에 사가만리와 같은 대역을 입히는 데만 쓴다.

## 세 시대 적 로봇 셋 — 사가만리에서 복사 (2026-09-25, PLAN §5.20)

`models/monsters/robots/` — `Robot_Drone.glb`·`Robot_Walker.glb`·`Robot_Large.glb`. 사가만리 `assets/models/foes/` 의 같은 파일을
**그대로 복사**했다(Quaternius CC0 1.0, 원 출처 cyberpunk pack `Enemy_Flying`·`Enemy_2Legs`·`Enemy_Large` — 경위는
`saga-web/saga-go/assets/ASSET_LICENSES.md` "세 시대 사람·적" 절, Meshopt 압축본). 제 클립(걷기·대기·공격·죽음) 내장.
같은 절의 나머지 몸(폭주 청년 `polypizza_men/Punk`·방역복 `polypizza_hazmat/HazmatMan`·특공대 `polypizza_men/SWAT`·외계 `Alien_0bb74be9`·
장갑벌 `Armabee_Evolved`, 손님 `polypizza_men/Worker`·`polypizza_women/Suit`·`SciFiCharacter`·`polypizza_space/Astronaut1`)은
이 판에 이미 있던 파일이라 위 해당 절 그대로다.

## 신수·오마주·까치 대역 28종 — 종마다 한 벌 (2026-09-25, CHARACTER_UNIQUENESS ④)

이 판은 파일을 새로 들이지 않았다 — 이미 있던 `models/monsters/quaternius/`(Ultimate Monsters, 위 절)와 `models/animals/Elephant.glb`(Poly by Google, CC-BY 3.0, 위 절)를 `pet:*` 표가 가리킨다.

| 펫 | 모델 |
|---|---|
| 삼족오·까치 | Birb · Pigeon |
| 해태 | Goleling(돌정령 — 해태상이 돌 수호수) |
| 청룡 | Dragon_Evolved(날개 용) |
| 백호·구미호·홍염마·섬영마 | Tiger·Fox·Horse·White_Horse(같은 종, 이미 있던 모델) |
| 주작 | Hywirl(날짐승) |
| 현무 | Snake | 
| 도깨비 | Orc |
| 불가사리 | **Elephant**(쇠를 먹는 코끼리 코 짐승) |
| 삿갓동이·뿔도롱·뿔낙지·날주머니·방아토끼·이끼잔나비 | Mushnub·Dino·Squidle·Glub·Bunny·Monkroose |
| 묵방울·어둑귀·눈머리·겹날주머니·고깔도사 | Pink_Slime·Ghost·Yeti·Glub_Evolved·Wizard |
| 누렁날개·노을용·물이무기·별손님·복고양이 | Alpaking·Dragon·Snake_angry·Alien_2(두발 외계인 — 방울형 Alien 은 사가만리 들판 적과 같은 파일이라 피함)·Cat(괴물 고양이) |

## AI 생성 도감 초상 (2026-09-29)
| 항목 | 내용 |
|---|---|
| **파일** | `assets/portraits/hero/<id>_s.webp`(192×192)·`<id>_c.webp`(300×344) — 도감 105 인물 + 사가나락 미래·현대 인물 30(2026-10-09 K-0090 ⑤ 다시: 프롬프트 `batches/web_dungeon_30.json` + 게임이 입히는 빌린 몸의 공방 렌더 밑그림 img2img — `make_dungeon30_i2i.py` → `batches/k90_dungeon30_i2i.json`, `--src k90_dungeon30_i2i`. 옛 판은 글→그림이라 그림체가 달랐다) |
| **만든 법** | swbins3 로컬 sd-webui + **Animagine XL 4.0 Opt**(CreativeML OpenRAIL++-M, 상업 사용 허용) — `tools/ai-art/gen.py` → `pack_web_portraits.py` |
| **프롬프트** | 인물 이름 없이 문화·역할·성별·나이·머리·눈 묘사만 — `tools/ai-art/batches/web_heroes_105.json` |
| **밑그림** | 도감 105 인물은 자체 공방 몸(`tools/char-forge`, CC0 재료+레시피) 가슴 위 렌더를 밑그림으로 한 이미지→이미지 생성(`render_busts.py`, `batches/web_heroes_105_i2i.json`, denoise 0.55) — 밑그림 = 공방 몸 렌더 |
| **출처 기록** | `assets/portraits/hero/_ai_provenance.json`(모델·라이선스·씨앗) |
| **주의** | AI 생성물은 저작권 보호가 약하다. 되돌리려면 git 에서 이전 webp 복구 |

## AI 생성 도감(펫) 초상 (2026-09-29)
| 항목 | 내용 |
|---|---|
| **파일** | `assets/portraits/pet/<id>_s.webp`(192×192)·`<id>_c.webp`(300×344) — 도감 펫 105종(옛 3D 굽기 초상을 교체) |
| **만든 법** | swbins3 로컬 sd-webui + **Animagine XL 4.0 Opt**(CreativeML OpenRAIL++-M, 상업 사용 허용) — `tools/ai-art/gen.py` → `pack_web_pet_portraits.py` |
| **프롬프트** | 원작·펫 이름 없이 종·생김새 묘사만 — `tools/ai-art/batches/web_pets_105.json` (`make_pet_batch.py` 가 만든다) |
| **출처 기록** | `assets/portraits/pet/_ai_provenance.json`(모델·라이선스·씨앗) |
| **주의** | AI 생성물은 저작권 보호가 약하다. 되돌리려면 git 에서 이전 webp 복구 |


## 배경음 (`assets/audio/bgm/`)

2026-10-01 자체 생성 — `swbins3/music-gen`(로컬 ACE-Step 1.5, 코드·가중치 MIT, 상업 사용 허용). 원작 곡명·아티스트 이름은 프롬프트에 쓰지 않았다. 출처 기록 정본: `saga-web/shared/audio/bgm/<판>-<장면>.license.json`.

| 파일 | 만든 말(프롬프트) | 만든 법 | 비고 |
|---|---|---|---|
| `saga-dungeon-town.ogg` | dark gothic hub camp, low cello, distant choir, ember crackle, ominous but calm, slow 60 bpm, instrumental | 로컬 AI 생성(ACE-Step 1.5, MIT·상업 허용, 씨앗 2101) | 사용자가 후보 a 선택 |
| `saga-dungeon-field.ogg` | dark dungeon ambience, deep drones, slow building tension, metallic scrapes, sparse minimal percussion, instrumental | 로컬 AI 생성(ACE-Step 1.5, MIT·상업 허용, 씨앗 2201) | 사용자가 후보 a 선택 |
| `saga-dungeon-battle.ogg` | heavy dark action theme, low distorted guitar riffs, war drums, choir hits, relentless 140 bpm, instrumental | 로컬 AI 생성(ACE-Step 1.5, MIT·상업 허용, 씨앗 2301) | 사용자가 후보 a 선택 |

## 2D 스프라이트 시트 (`assets/sprites2d_sheets/`)

2026-10-01 자체 제작 — 공방(`tools/char-forge/gear_sprites.py`)이 CC0 VRoid 몸(`tools/char-forge/_src/cc0_vroid`) 위에 절차 생성 장비를 입혀 Blender 로 굽는다(128px·8프레임·방향 3·동작 idle/walk/attack/hit/death, WebP). 적 4벌: `pool_basem_demon_104`, `pool_e_orc_125`, `pool_d_goblin_118`, `pool_g_undead_143`. 벌마다 `manifest.json` 에 몸·종류·규격·출처 문구. 원작 에셋 없음. 이 판은 아직 안 읽는다(W 티켓 — 인물·괴물 id 연결과 `sprite.js` 배선).
