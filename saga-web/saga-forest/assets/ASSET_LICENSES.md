# 에셋 출처와 라이선스 (saga-forest)

`PLAN.md` 32절이 시킨 대로, 이 폴더에 넣은 **바깥에서 가져온 에셋**의 출처와
라이선스를 여기 한곳에 적는다. **여기 없는 파일은 이 폴더에 두지 않는다.**

이 저장소는 공개다(<https://github.com/smh8627-jpg/swbins>). 그래서 재배포가
허용되지 않는 에셋은 애초에 받지 않는다.

---

## Quaternius — 저지대 다각형(low-poly) 묶음

| 항목 | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com>) |
| **라이선스** | **CC0 1.0 Universal** (퍼블릭 도메인 헌정) |
| **저작자 표시** | 필요 없다. 그래도 적어 둔다 |
| **재배포** | 허용된다 (CC0 는 조건이 없다) |
| **받은 곳** | <https://github.com/trebeljahr/quaternius-showcase> `public/glb/` (GLB 미러) —
  라이선스 확인 근거는 `../../saga-go/assets/ASSET_LICENSES.md` 에 이미 적어 두었다
  (원 사이트가 이 망에서 안 열려 다른 CC0 이식본 여럿으로 교차 확인했다) |

### 넣은 파일 — 새로 받은 것 (`nature_pack` · PLAN 8절 숲 오브젝트)

`models/nature/` — 랜덤 배치될 소품. 아직 세우는 렌더러는 없다(PHASE 3 몫) — 지금은
`asset3d.js` 표에서 골라지는 자리만 있다.

| 파일 | 쓰이는 곳 |
|---|---|
| `CommonTree_1·2·3.glb` | 큰 나무 (봄·여름, `TREE_STYLIZED` 되돌림 자리 — 지금 봄·여름 기본은 실사 `IslandTree_02.glb`) |
| `CommonTree_Autumn_1·2.glb` | 큰 나무 (가을 — `tree:common:autumn`. `_1·2`는 예전 32종 확보 때부터 있었지만 이 키를 부르는 코드가 없어 죽어 있었다) |
| `CommonTree_Autumn_3.glb` | 큰 나무 (가을, 2026-09-09 새로 받음 — 위 죽은 키를 되살리며 변종을 하나 더 보탰다) |
| `CommonTree_Snow_1·2.glb` | 큰 나무 (겨울 — `tree:common:snow`, `_1·2` 사정은 Autumn과 같다) |
| `CommonTree_Snow_3.glb` | 큰 나무 (겨울, 2026-09-09 새로 받음) |
| `CommonTree_Dead_1.glb` | 고목 |
| `PineTree_1·2.glb` | 침엽수 (봄·여름, 되돌림 자리 — 지금 기본은 실사 `PineSapling.glb`) |
| `PineTree_Autumn_1·2.glb` | 침엽수 (가을 — `tree:pine:autumn`, 2026-09-09 새로 받음) |
| `PineTree_Snow_1·2.glb` | 침엽수 (겨울 — `tree:pine:snow`, 2026-09-09 새로 받음) |
| `BirchTree_1·2.glb` | 자작나무 (`tree:birch` — 예전부터 있었지만 아직 어느 SCATTER_KIND 도 안 부르는 되돌림/확장 자리) |
| `BirchTree_Autumn_1·2.glb` | 자작나무 (가을 — `tree:common:autumn` 풀에 섞임, 2026-09-09 새로 받음) |
| `BirchTree_Snow_1·2.glb` | 자작나무 (겨울 — `tree:common:snow` 풀에 섞임, 2026-09-09 새로 받음) |
| `Bush_1·2.glb` · `BushBerries_1.glb` | 덤불 |
| `Rock_1·2·3.glb` | 돌·바위 |
| `Rock_Moss_1.glb` | 이끼 낀 돌 |
| `Grass_2.glb` · `Grass_Short.glb` | 풀 |
| `Flowers.glb` | 꽃 |
| `Plant_1·2.glb` | 작은 풀숲 |
| `TreeStump.glb` · `TreeStump_Moss.glb` | 그루터기 |
| `WoodLog.glb` · `WoodLog_Moss.glb` | 통나무 · 쓰러진 나무 |

`models/props/` — 새로 받은 것

| 파일 | 어느 팩 | 쓰이는 곳 |
|---|---|---|
| `Mushroom_1·2.glb` | `crops_pack` | 버섯 |
| `Bench_1.glb` | `medieval_village_pack` | 벤치 |
| `Fence.glb` | `medieval_village_pack` | 울타리 — 등록만 되어 있다가 2026-09-11 우주기지(spaceBaseSpot, PLAN 45절)에서 처음 쓴다 |
| `Cart.glb` | `medieval_village_pack` | 카트 — 위와 같은 날, 같은 우주기지에서 처음 쓴다 |
| `Bonfire_Lit.glb` | `medieval_village_pack` | 캠프파이어 |
| `Tent.glb` | `survival_pack` | 작은 천막 |

`models/buildings/` — 2026-09-09, PLAN 6절 "작은 마을" 착수. 새로 받지 않고
`saga-dungeon`이 이미 확인해 둔 같은 CC0 를 **하드링크**로 옮겼다(md5 동일,
`saga-dungeon/assets/ASSET_LICENSES.md`의 같은 파일명 절 참고 — 만든 이·출처가
전부 위 Quaternius 표와 같다)

| 파일 | 어느 팩 | 쓰이는 곳 |
|---|---|---|
| `House_1·2·3·4.glb` | `medieval_village_pack` | `House_2`는 첫 캠프(hamletSpot)의 오두막(`hamletHouse`), `House_1`은 같은 캠프의 움집(`hamletHut`), `House_3`은 같은 캠프의 흙집(`hamletShed`), `House_4`는 두 번째 캠프(hamlet2Spot)의 외딴집(`hamlet2House`) — 넷 다 2026-09-09에 실제로 쓰였다 |
| `MarketStand_1.glb` | `medieval_village_pack` | **전방**(`shop`) |

`models/animals/` — 새로 받은 것

| 파일 | 어느 팩 | 쓰이는 곳 |
|---|---|---|
| `Fox.glb` | `animals_pack` | 여우 |

## Poly by Google — 토끼·다람쥐·오리·새 (poly.pizza 경유, 2026-09-09)

PLAN 16절 "아직 못 찾은 CC0"였던 넷을 채웠다 — `data-village.js`의 `ANIMALS`
에 새 kind로 등록(사슴·여우·늑대와 나란히, 숲 배경 짐승용). 위 Quaternius·
saga-go 쪽과 달리 이 넷은 **저작자 표시가 필요한 CC-BY 3.0**이다(`saga-dungeon`이
이미 Tiger·Bear 등 일곱 마리를 이 경로로 받아 둔 것과 같은 출처).

| 항목 | |
|---|---|
| **만든 이** | Poly by Google |
| **라이선스** | **CC-BY 3.0** — 저작자 표시 필요 |
| **받은 곳** | `poly.pizza`(Google Poly 아카이브 미러), `static.poly.pizza/<uuid>.glb` 직접 다운로드, 로그인 불필요 |

| 파일 | poly.pizza | 이 판에서 쓰는 곳 |
|---|---|---|
| `models/animals/Rabbit.glb`("Cottontail rabbit") | `/m/3vvONbRCuEF` | **토끼**(`rabbit`) |
| `models/animals/Squirrel.glb` | `/m/2WqY_AFEn-M` | **다람쥐**(`squirrel`) |
| `models/animals/Duck.glb` | `/m/6HpauUCfIAb` | **오리**(`duck`) |
| `models/animals/Bird.glb`("Sparrow") | `/m/eVTHotZ9Bc_` | **새**(`bird`) |

> **Cottontail rabbit · Squirrel · Duck · Sparrow** — © **Poly by Google**,
> [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/). `poly.pizza`를
> 거쳐 받았다. 크기만 맞추었고 형상은 그대로다.

**용량 손질** — 받은 그대로는 텍스처가(Rabbit·Squirrel·Bird) 2048×2048 PNG라
3.8MB/2.0MB/2.3MB였다. `gltf-transform`으로 `resize`(768px) →
`jpeg --formats png`(품질 85, **`--formats png` 를 안 주면 조용히 아무것도
안 바뀐다** — 기본값이 "이미 jpeg인 텍스처만 다시 압축"이라 원본 PNG를
그냥 지나친다, 이번에 직접 겪었다)로 줄였다 — Rabbit 3.82MB→157KB,
Squirrel 2.02MB→126KB, Bird 2.27MB→101KB. Duck 은 텍스처가 아예 없어(단색
버텍스 컬러, 27KB) 그대로 뒀다. 지오메트리는 넷 다 가벼워(수천 정점)
심플리파이 없이 텍스처만 줄였다. 넷 다 애니메이션 클립이 없다(원본
자체에 없음).

**2026-09-10 바로 위 문단 정정 — "클립이 있든 없든 화면상 차이는 없다"는
더 이상 안 맞다.** `Deer.glb`·`Fox.glb`·`Wolf.glb`(Quaternius)엔 실제로
Idle·Walk 등 클립이 열둘 넘게 있는데(직접 GLB 를 열어 확인), 그동안
`village-view3d.js`의 스캐터 렌더러가 짐승을 나무·바위처럼 정지 오브젝트로만
세워(mixer 를 안 만들었다, `hero`만 재생했다) 있는 클립을 안 썼다 —
"움직이는 모션을 더 자연스럽게" 요청으로 `asset3d.js`의 `buildGeneric()`이
원본에 클립이 있으면 `hero`와 같은 결로 mixer·actions 를 실어 주게 고쳐서
이제 사슴·여우·늑대도 걸을 때 실제로 다리가 움직인다(`syncScatter()`가
매 프레임 재생). **토끼·다람쥐·오리·새 넷은 여전히 원본 자체에 클립이
없어 정지 모형 그대로다** — 이건 자산의 한계지 렌더러 탓이 아니다.

### 넣은 파일 — saga-go 에서 그대로 옮긴 것 (**md5 동일**, 새로 받지 않았다)

이미 사가고에서 CC0 로 확인된 파일을 그대로 복사했다 — 세 벌째(사가블로) 복사와
같은 요령이다. 자세한 출처·이식 경위는 `../../saga-go/assets/ASSET_LICENSES.md` 참고.

| 파일 | 원본 위치 |
|---|---|
| `models/animals/Deer.glb` | `saga-go/assets/models/animals/Deer.glb` |
| `models/animals/Wolf.glb` | `saga-go/assets/models/animals/Wolf.glb` |
| `models/animals/Frog.glb` | `saga-go/assets/models/animals/Frog.glb` — Quaternius `easy_enemies_pack`, CC0. 클립 넷(Idle·Attack·Death·Jump, 걷기 대신 뜀), 2026-09-10 "동물들도 찾아봐"로 mushroom·dark 바이옴에 보탰다 |
| `models/animals/Snake.glb` | `saga-go/assets/models/animals/Snake.glb` — Quaternius `easy_enemies_pack`, CC0. 클립 넷(Idle·Attack·Jump·**Walk**), 2026-09-10 같은 요청으로 rocky·dark 바이옴에 보탰다 |
| `models/nature/Mountain_1·2.glb` | `saga-go/assets/models/nature/` |
| `models/props/WoodenTorch.glb` | `saga-go/assets/models/props/WoodenTorch.glb` (랜턴 대타) |
| `models/props/Well.glb` | `saga-go/assets/models/buildings/Well.glb` |
| `models/props/Bridge.glb` | `saga-go/assets/models/props/Bridge.glb` (나무다리) |
| `models/props/Gazebo.glb` | `saga-go/assets/models/props/Gazebo.glb` — 등록만 되어 있다가 2026-09-11 폐허(ruinSpot, PLAN 46-2절)에서 처음 쓴다 |
| `models/people/regular/*` (몸 둘·옷 넷·머리 여섯, gltf+bin+png) | `saga-go/assets/models/people/regular/` — Player 3D(PHASE 4) 에 쓸 인물 뼈대. 조합 규칙도 그대로: `saga-go/js/asset3d.js` 의 `HERO_RECIPES` 주석 참고 |
| `models/anim/UAL1_Standard.glb` (Quaternius Universal Animation Library, 몸짓 마흔한 벌) | `saga-go/assets/models/anim/UAL1_Standard.glb` — 위 인물 뼈대와 이름까지 같은 뼈라 옮겨 입히기 없이 그대로 물린다 |

---

## Kenney — Roguelike/RPG Pack (`assets/sprites2d/`)

| 항목 | |
|---|---|
| **만든 이** | Kenney (<https://kenney.nl>) |
| **라이선스** | **CC0 1.0 Universal** (퍼블릭 도메인 헌정) |
| **저작자 표시** | 필요 없다. 그래도 적어 둔다 |
| **재배포** | 허용된다 |
| **받은 곳** | <https://opengameart.org/content/roguelikerpg-pack-1700-tiles> (Kenney 본인 업로드,
  `Roguelike pack.zip` 안 `Spritesheet/roguelikeSheet_transparent.png`) |

2D 마을 화면(`village-view.js`)의 **나무**(`drawTree`, PLAN "코드로 그리지 말고
에셋으로" 방침)가 여태 겹친 원으로 수관을 그리던 것을 이 시트에서 오려 낸
그림으로 바꿨다(2026-09-02). 시트에서 16x15px 셋을 그대로 잘라 파일로 저장했다 —
계절마다 다른 그림, 흔들림은 회전으로, 벚꽃·눈·열매 배지는 여전히 코드가 얹는다
(상태 표시라서 그림이 아니라 코드 몫으로 남긴다).

| 파일 | 원본 시트 좌표(px) | 쓰이는 곳 |
|---|---|---|
| `tree_spring.png` | (221,154)-(236,168) 초록 둥근 나무 | 봄·여름 |
| `tree_autumn.png` | (238,154)-(253,168) 주황 둥근 나무 | 가을 |
| `tree_winter.png` | (255,154)-(270,168) 청록 둥근 나무 | 겨울(눈 배지는 코드가 그 위에 얹는다) |
| `pine_green.png` | (272,154)-(286,168) 초록 침엽수 | 봄·여름·가을 소나무(`drawPine`) — 줄기는 여전히 코드가 긋는다 |
| `pine_winter.png` | (306,154)-(320,168) 청록 침엽수 | 겨울 소나무 — 눈덩이 배지는 코드가 얹는다 |

**바닥 타일**(`village-view.js` 의 `drawGround`, 2026-09-02) — 여태 타일마다 단색
사각형(`fillStyle`)만 채우던 것을 이 그림으로 바꿨다. **밑에는 여전히 원래 색
채우기가 먼저 깔린다**(`TILES[].color`, 철·체크무늬 색 구분이 그대로 산다) —
그 위에 타일 그림을 `globalCompositeOperation='overlay'`·투명도 0.6 으로 얹어
질감만 더한다. 색이 먼저 깔리므로 그림이 아직 안 실린 첫 프레임에도 빈 칸이
안 생긴다. 구면 투영이라 타일이 평행사변형에 가깝게 휘는데, 캔버스 2D 는
사각형(quad) 텍스처를 못 그리므로 세 꼭짓점(좌상·우상·좌하)만 맞춘 아핀
변환으로 그린다(넷째 꼭짓점은 근사 — 타일이 작아 안 띈다). 숲 고리의 네 변종
(`grass_meadow`·`grass_dark`·`grass_mush`·`grass_rocky`)은 따로 그림을 안
구하고 같은 `tile_grass.png` 위에 각자 색을 얹어 쓴다.

| 파일 | 원본 시트 좌표(px) | 쓰이는 곳 |
|---|---|---|
| `tile_grass.png` | (85,0)-(101,16) 풀 | `grass` 및 숲 고리 네 변종(물들여 쓴다) |
| `tile_dirt.png` | (102,0)-(118,16) 흙 | `path`(흙길) |
| `tile_sand.png` | (136,0)-(152,16) 모래 | `sand` |
| `tile_water.png` | (187,136)-(203,152) 물 | `water` |
| `tile_stone.png` | (102,34)-(118,50) 돌바닥 | `stone`(돌길) |
| `tile_floor.png` | (136,34)-(152,50) 나무 바닥 | `floor`(마루) |

**3D 마을 화면**(`village-view3d.js` 의 `initTerrain`, 2026-09-02)의 땅 타일도
한때 **같은 파일**을 그대로 썼다 — 색 한 장(`MeshLambertMaterial({color})`)이던
것에 `map` 으로 얹었다("3D 타일이 디테일하지 않다", 사용자). `floor`(방 안
마루)는 3D 마을 바닥에 안 나와 빠졌다.

**2026-09-10 — 3D 쪽만 다른 CC0 사진으로 교체.** 사용자가 "바닥 그래픽이
왜 이래, 사가고·사가블로처럼 바꿔 달라" 고 신고해 실제 파일을 열어 보니
위 `tile_grass.png`·`tile_dirt.png`·`tile_stone.png` 가 16x16 에 색이
**둘뿐인** 거의 단색 조각이었다 — 위 문단이 "시트에서 오려 낸 그림"이라
적어 둔 것과 실물이 안 맞았다(자르는 과정이 그때 깨졌던 것으로 보인다).
2D 화면(`village-view.js`)은 원래 색 채우기가 먼저 깔리고 그 위에 그림을
옅게(0.6) 얹는 구조라 티가 덜 났지만, 3D는 그림이 재질의 전부라 거의
단색 사각형으로 보였던 것 — "NPC가 안 보인다"는 신고와 같이 들어온
"바닥이 왜 이러냐"는 바로 이 문제였다.

새로 CC0 사진을 받아오는 대신 **이 저장소 안에 이미 있는 CC0 1.0 텍스처를
그대로 옮겼다**(둘 다 재배포 제약 없는 CC0라 출처만 옮겨 적으면 된다) —
`models/props/*`·`Kenney·KayKit` 절처럼 다섯 판 사이 재사용은 이미 있던
관례다:

| 파일 | 옮겨 온 곳 | 원 출처 |
|---|---|---|
| `assets/textures/land/grass.webp` | `saga-go/assets/textures/land/grass1.webp` | ambientCG `Grass005`(CC0 1.0) — `saga-go/assets/ASSET_LICENSES.md` 참고 |
| `assets/textures/land/dirt.webp` | `saga-go/assets/textures/land/road1.webp` | ambientCG `Ground081`(CC0 1.0), 흙길에 씀 |
| `assets/textures/land/stone.webp` | `saga-dungeon/assets/textures/dungeon/floor_stone.webp` | polyhaven(CC0 1.0) — `saga-dungeon/assets/ASSET_LICENSES.md` 참고 |

`grass`·`grass_meadow`·`grass_dark`·`grass_mush`·`grass_rocky`(숲 고리 네
변종)는 여전히 같은 `grass.webp` 한 장을 재질 색(`color`)으로 물들여 쓴다.
`path`는 `dirt.webp`, `stone`은 `stone.webp`로 바뀌었다. **`sand`·`water`는
이번엔 손 안 댔다** — 맞는 CC0 사진이 이 저장소 어디에도 아직 없다(물은
`waterMaterial()`의 파동·반사가 이미 덧입혀져 기본 그림 비중이 작아 우선
순위를 낮췄다). 다음에 바닥을 더 손보게 되면 이 둘부터.

`tileTexture()`의 필터도 픽셀아트 보존용 `NearestFilter`에서
`LinearFilter`+밉맵으로 바꿨다 — 이제 대부분 실사 사진이라 흐려져야
자연스럽다. 2D 화면(`village-view.js`)과 `tile_grass.png`·`tile_dirt.png`·
`tile_stone.png` 원본 파일은 **이번엔 안 건드렸다** — 2D 캔버스는 매 프레임
`drawImage`로 다시 그리므로 큰 사진(수백 KB)을 얹으면 저사양에서 느려질
위험이 있어, 3D(한 번 구워 두는 `InstancedMesh` 재질)만 우선 바꿨다.

---

## Kenney — Roguelike Characters Pack (`assets/sprites2d/human_*.png`)

| 항목 | |
|---|---|
| **만든 이** | Kenney (<https://kenney.nl>) |
| **라이선스** | **CC0 1.0 Universal** (퍼블릭 도메인 헌정) |
| **저작자 표시** | 필요 없다. 그래도 적어 둔다 |
| **재배포** | 허용된다 |
| **받은 곳** | <https://kenney.nl/assets/roguelike-characters> — `kenney_roguelike-characters.zip` 안
  `Spritesheet/roguelikeChar_transparent.png` |

2D 마을 화면의 **사람**(`sprite.js` 의 `bake()`, `kind==='human'`)이 여태 원·선으로
절차적으로 그리던 것을 이 시트에서 오려 낸 정지 초상 그림으로 바꿨다(2026-09-02,
"전체 변경" 사용자 승인). **트레이드오프를 그대로 적는다** — 이 그림은 인물마다
다른 색(피부·옷·머리)·등신 4단계·그림 양식 3가지·다리 걷기 애니메이션을 못 낸다
(고정 그림 한 장이라). 인물 id 를 해시해 열넷 중 하나를 **늘 같은 얼굴로** 고른다.
좌우 뒤집기(`stamp()` 의 `ctx.scale(-1,1)`)와 걸음 통통거림(bounce)은 그림과
무관하게 그대로 산다. 도감·상세 카드의 인물 초상은 이 그림이 아니라 이미
3D(`portrait3d.js`)로 가 있어 영향이 없다 — **지도 위에서 걸어 다니는 모습만**
바꿨다.

**2026-09-10 — 숲 NPC 여섯도 같은 그림을 쓴다.** `village-view.js`의
`drawNpc()`가 이모지 대신 residents 와 똑같이 `sprite.js`의 `stamp()`를
부른다. HEROES 로스터는 안 물린다 — `ref`에 `{id: npc.id}`(예: `npc_keeper`)
만 넘겨 `humanIndexOf()`가 그 문자열을 해시해 열넷 중 하나를 고정으로
고르게 했다(사연 있는 다른 역사 인물이 튀어나오지 않는다).

시트에서 사람 여덟 줄 × 두 칸(첫 넉 줄의 오우거·오크 몬스터 줄은 건너뛴다,
이 판의 사람이 아니다)을 16x16px 그대로 잘라 저장했다.

| 파일 | 원본 시트 좌표(px) |
|---|---|
| `human_01.png`·`human_02.png` | (0,85)-(16,101) · (17,85)-(33,101) — 금발 전사 · 백발 마법사 |
| `human_03.png`·`human_04.png` | (0,102)-(16,118) · (17,102)-(33,118) — 맨몸 전사 · 청록 갑주 |
| `human_05.png`·`human_06.png` | (0,119)-(16,135) · (17,119)-(33,135) — 갈색옷 궁수 둘 |
| `human_07.png`·`human_08.png` | (0,136)-(16,152) · (17,136)-(33,152) — 검은 두건 · 보라 바지 |
| `human_09.png`·`human_10.png` | (0,153)-(16,169) · (17,153)-(33,169) — 흰수염 로브 · 회색조끼 |
| `human_11.png`·`human_12.png` | (0,170)-(16,186) · (17,170)-(33,186) — 청록 두건 궁수 · 주황 셔츠 |
| `human_13.png`·`human_14.png` | (0,187)-(16,203) · (17,187)-(33,203) — 청록 방패 기사 · 흰 로브 |

### 아직 못 채운 자리 (PLAN 16절 동물 콘텐츠) — 3D 는 다 채워졌다

이 문단이 말하던 **토끼·다람쥐·오리·새**의 3D 모델은 2026-09-09에 Poly by
Google(위 78절)에서 따로 구해 이미 채웠다. 2D 쪽(동물 정지 초상이 아니라
지도 위 걷는 그림)은 아래 "OpenGameArt — Seasons of Forest Animal Pack"
절 참고 — 사슴·여우·다람쥐·개구리·새 다섯만 채웠고, 늑대·토끼·오리·뱀
넷은 2026-09-10 시점에도 맞는 CC0 를 못 찾았다.

---

## OpenGameArt — Seasons of Forest Animal Pack, 무료 샘플 (`assets/sprites2d/animals/`, 2026-09-10)

| 항목 | |
|---|---|
| **만든 이** | inkbubi (<https://inkbubi.itch.io/seasons-of-forest-animal-pack>의 무료 샘플) |
| **라이선스** | **CC0 1.0 Universal** (퍼블릭 도메인 헌정) — 받은 zip 안 `license.txt`에
  "This work has been dedicated to the public domain under the Creative Commons
  CC0 license. No credit is required, but it's appreciated." 라고 명시 |
| **저작자 표시** | 필요 없다. 그래도 적어 둔다 |
| **재배포** | 허용된다 — 이 무료 샘플만 CC0 다(유료 정식판은 라이선스가 다르다,
  이 판에는 무료 샘플만 받았다) |
| **받은 곳** | <https://opengameart.org/content/free-sample-16x16-pixel-forest-animal-pack-%E2%80%93-top-down-rpg-style> —
  `seasons_of_forest_animal_pack_free_v1.zip` |

원본은 여우(fox)·암사슴(doe)·올빼미(owl)·다람쥐(squirle)·개구리(frog) 다섯 종을
idle·run 애니메이션으로 4방향(전·후·좌·우)씩 준다. 이 게임은 `a.facing`이
좌/우(-1/1)만 추적해서 **좌·우 두 방향만** 골라 받았다 — 직접 PIL 로 종별
아틀라스 한 장씩(4행: idleLeft·idleRight·runLeft·runRight × 최대 4열)으로
다시 구웠다(원본 앞/뒤 프레임은 안 옮겼다).

| 원본 폴더 | 이 판의 kind(`VD.ANIMALS`) | 파일 |
|---|---|---|
| `doe` | `deer`(사슴) | `deer.png` |
| `fox` | `fox`(여우) | `fox.png` |
| `squirle` | `squirrel`(다람쥐) | `squirrel.png` |
| `frog` | `frog`(개구리) | `frog.png` |
| `owl` | `bird`(새) — 올빼미가 참새 등 다른 새를 대신한다 | `bird.png` |

`village-view.js`의 `drawAnimal()`이 `ANIMAL_SPRITE` 표에 있는 다섯 종만 이
아틀라스로 그린다 — 나머지 넷(늑대·토끼·오리·뱀)은 표에 없어 그대로 emoji
fallback을 탄다(자동, 새 분기 없음). 이미지가 아직 안 실렸으면(첫 프레임)
같은 fallback을 잠깐 탄다.

---

## Poly Haven — HDRI 환경광 (`assets/hdri/alps_field_1k.hdr`)

| 항목 | |
|---|---|
| **만든 이** | Poly Haven (<https://polyhaven.com>) |
| **라이선스** | **CC0 1.0 Universal** (퍼블릭 도메인 헌정) |
| **저작자 표시** | 필요 없다. 그래도 적어 둔다 |
| **재배포** | 허용된다 |
| **받은 곳** | <https://polyhaven.com/a/alps_field> — 1k `.hdr` (api.polyhaven.com 으로 직접 받음) |

2026-09-02, 사용자가 "사실처럼 보이는" 을 요청해 `village-view3d.js` 의 3D 마을에
IBL(환경광)을 얹었다. **하늘 색은 안 바꾼다** — `scene.background` 는 그대로
바이옴별 단색(`syncFog`)에 맡기고, `scene.environment` 에만 물려 PBR 재질의
반사·거칠기만 사실적으로 만든다(자세한 사정은 `village-view3d.js` 의
`loadEnvironment()` 주석 참고). 못 받아도 조용히 넘어가고 옛 조명만으로 돈다.

파싱에 필요한 `RGBELoader` 는 번들(`js/vendor/three.iife.js`, 사가고·사가블로와
md5 까지 같은 그 파일)엔 없어서, three.js r169 예제 소스를 esbuild 로 따로
번들해 `js/vendor/RGBELoader.js` 로 얹었다(전역 `THREE.RGBELoader`) — three
본체 파일은 안 건드렸다.

---

## Quaternius — RPG Character Pack (2026-09-03, 공개 기본 사람)

| | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com/packs/rpgcharacters.html>) |
| **라이선스** | CC0 1.0 (<https://creativecommons.org/publicdomain/zero/1.0/>) — 재배포 자유, 표시 의무 없음 |
| **받은 곳** | quaternius.com 팩 페이지의 구글드라이브 링크(zip 직링크 없음, 사용자가 직접 받음) |
| **파일** | `assets/models/people/quaternius_rpg/{Warrior,Ranger,Rogue,Cleric,Wizard,Monk}.glb(원래 배포된 .gltf 임베드 base64를 바이너리 .glb로 변환 — 파싱 속도·용량 개선, 2026-09-03)` |

Mixamo 실사(아래 절)가 재배포 금지라 공개 저장소에서 캐릭터가 통째로 안 보이던
문제(`.gitignore`된 파일이 없는 기기는 몸이 안 실림)를 고치려고 새로 들였다.
**이제 `js/asset3d.js` 의 `HERO_RECIPES`(공개 기본값)가 이 여섯 벌이다.** 파일
하나에 몸·텍스처·리깅에 더해 걷기·달리기·공격·피격·구르기·사망 등 클립 열세 개가
전부 들어 있어 saga-go 식 몸+옷+머리 조합이나 별도 UAL 몸짓이 필요 없다 —
`anim` 을 `body` 와 같은 파일로 주면 그 안의 클립을 그대로 쓴다(`buildHeroDefault()`
참고). 카툰풍 음영이 있는 스타일이라 기존 평범한 조합형(`HERO_RECIPES_FALLBACK`,
그대로 남아 있음)보다 그림체가 낫다.

---

## Mixamo (Adobe) — 실사풍 사람, 로컬 전용 보너스 (2026-09-02, 사용자가 직접 받음)

**⚠️ 이 절만 예외다 — 실제 파일은 이 저장소에 없다.** 2026-09-03부터 **공개
기본값이 아니다** — 위 Quaternius RPG Character Pack 이 기본이고, 이 실사
캐릭터는 로컬에 파일이 있고 `_admin.html` 등에서 `world3d.mixamoReal` 손잡이를
켰을 때만(기본 0) 우선 시도된다(`js/asset3d.js` 의 `HERO_RECIPES_MIXAMO`·
`wantsMixamoReal()`). Mixamo 약관은
"캐릭터·애니메이션 원본 파일을 독립 에셋으로 재배포"하는 것을 금지한다
(<https://community.adobe.com> 여러 글에서 일관되게 확인). 이 저장소는
공개(GitHub Pages 로 그대로 서빙됨)라, 위 "재배포가 허용되지 않는 에셋은
애초에 받지 않는다" 원칙에 따라 **변환한 glb 를 커밋하지 않는다** —
`saga-forest/.gitignore` 가 `assets/models/people/realistic/` 와
`assets/models/anim/mixamo_realistic.glb` 를 막고 있다.

사용자 기기 로컬엔 그대로 있어서 게임은 정상 동작한다. 다른 기기·세션에서
다시 만들려면:

1. <https://www.mixamo.com> (무료 Adobe 계정)에서 사실적인 캐릭터 하나를
   고른다(이번엔 **Maria**) → Download, Format **FBX Binary**, Pose T-pose로
   몸체 한 번
2. 같은 캐릭터로 아래 여덟 애니메이션을 각각 받는다(Format FBX Binary,
   가능하면 Skin: Without Skin — 훨씬 가볍다):
   `Action Idle To Fight Idle`(→idle) · `Walking`(→walk, In Place) ·
   `Running`(→run, In Place) · `Sword And Shield Slash`(→attack) ·
   `Hit Reaction`(→hit) · `Stand To Roll`(→dodge) · `Death`(→death) ·
   `Picking Up`(→interaction)
3. `npm install fbx2gltf @gltf-transform/core` (아무 스크래치 폴더에서)
4. 몸: `FBX2glTF --binary --pbr-metallic-roughness -i "Maria....fbx" -o body`,
   그다음 `gltf-transform resize body.glb body_r.glb --width 1024 --height 1024`,
   `gltf-transform jpeg body_r.glb maria_body.glb --quality 88 --formats png`
   (baseColorTexture·normalTexture 를 jpeg 로 눌러 10.6MB → 1.35MB)
5. 애니메이션 여덟 개는 각각 `FBX2glTF --binary --anim-framerate bake30`,
   그다음 이 폴더의 `tools/mixamo/slim_anim.js`(메시·스킨 떼고 이름 바꿈) →
   `tools/mixamo/merge_anims.js`(여덟 파일을 클립 여덟 개짜리 하나로) →
   `tools/mixamo/detrend_root.js`(구르기·죽음처럼 제자리가 아닌 클립의
   Hips 수평 이동을 되돌림) 순서로 돌린다
6. `maria_body.glb` → `assets/models/people/realistic/maria_body.glb`,
   합친 애니메이션 → `assets/models/anim/mixamo_realistic.glb`

`js/asset3d.js` 의 `HERO_RECIPES_MIXAMO`·`ANIM_SRC_REAL` 이 이 두 파일을 가리킨다
(`world3d.mixamoReal` 손잡이를 켰을 때만 쓰인다). 옛 Quaternius 조합형(몸+옷+머리
넷)은 `HERO_RECIPES_FALLBACK` 으로 여전히 살아 있다 — 위 RPG Character Pack마저
못 실릴 때 마지막으로 한 번 더 시도하는 안전망이다(그 쪽 파일들은
`models/people/regular/` 에 그대로 있고 CC0 라 재배포 문제는 없다).

---

## Poly Haven — 바위 사진측량 스캔 (`models/nature/realistic/`, 2026-09-03)

"자연물도 실사로" 첫 항목 — 바위류부터(나무는 폴리곤이 너무 무거워 다음 몫으로
남겼다, PLAN 40절 부록 참고).

| 항목 | |
|---|---|
| **만든 이** | Kless Gyzen(`rock_moss_set_01`) · Jenelle van Heerden(`rock_07`) · Dario Barresi·Rico Cilliers(`stone_01`) — 전부 Poly Haven (<https://polyhaven.com>) |
| **라이선스** | **CC0 1.0 Universal** — 재배포 자유, 표시 의무 없음 |
| **받은 곳** | <https://polyhaven.com/a/rock_07> · <https://polyhaven.com/a/stone_01> · <https://polyhaven.com/a/rock_moss_set_01> — 1k glTF(api.polyhaven.com 으로 직접 받음) |

| 파일 | 원본 | 처리 |
|---|---|---|
| `Rock_07.glb` | `rock_07` | `gltf-transform copy` → `resize`(768px) → `jpeg`(품질 85) |
| `Stone_01.glb` | `stone_01` | 위와 동일 |
| `MossRock_a·b·c.glb` | `rock_moss_set_01`(여섯 바위가 한 장면에 격자로 놓인 세트) 중 세 개를 `@gltf-transform/core` 스크립트로 각각 떼어냄(`prune()`으로 나머지 다섯 지운다) → `resize` → `jpeg` | |

**함정 — 이 GLB 들을 `--virtual-time-budget` 헤드리스로 확인하면 몇 분째 안 뜬
것처럼 보인다.** 실제 브라우저(puppeteer 로 실측)에서는 GLTFLoader 파싱이
30~40ms 면 끝난다 — 헤드리스 가상 시간이 텍스처 디코드 같은 진짜 CPU 작업을
제대로 못 앞당겨서 생긴 착시다. 반면 `EXT_texture_webp` 압축은 **진짜 문제였다**
— 이 판 three.js 번들엔 그 확장 이름표만 있고 실제 파서가 없어서
`extensionsRequired` 로 박히면 glTF 규격상 영영 안 뜬다(정상 동작이다, 로더
버그가 아니다). 그래서 압축은 jpeg 까지만 쓴다. 자세한 사정과 재현 방법은
`js/asset3d.js` 의 `rock`/`rock:moss` 항목 주석 참고.

옛 Quaternius 저다각형 셋(`Rock_1·2·3.glb`·`Rock_Moss_1.glb`)은 지우지 않았다
— `js/asset3d.js` 의 `ROCK_STYLIZED` 가 되돌림 자리로 들고 있다.

---

## Poly Haven — 나무·수풀 사진측량 스캔 (`models/nature/realistic/`, 2026-09-03)

"자연물도 실사로" 둘째 항목 — 나무는 원본이 780만 폴리곤·478MB 급이라(위 바위 절
참고) 이번엔 `@gltf-transform/cli` 의 `simplify`(meshopt 기반 감량)를 새로 거쳤다.

| 항목 | |
|---|---|
| **만든 이** | Rob Tuytel·Rico Cilliers(`island_tree_02`) · Rico Cilliers(`shrub_04`) — 전부 Poly Haven (<https://polyhaven.com>) |
| **라이선스** | **CC0 1.0 Universal** — 재배포 자유, 표시 의무 없음 |
| **받은 곳** | <https://polyhaven.com/a/island_tree_02> · <https://polyhaven.com/a/shrub_04> — 1k glTF(api.polyhaven.com 으로 직접 받음) |

| 파일 | 원본 | 처리 |
|---|---|---|
| `IslandTree_02.glb` | `island_tree_02`(874,494 정점·40.7MB bin) | `gltf-transform copy`(텍스처 번들) → `weld` → `simplify --ratio 0.05 --error 0.02`(102,208 정점, 88% 감량) → `resize`(768px) → `jpeg`(품질 85) — 46.2MB → **4.86MB** |
| `Shrub_04.glb` | `shrub_04`(47,813 폴리곤·0.7MB bin) | 지오메트리는 가벼워 그대로, `resize`(768px) → `jpeg`(품질 85) — 1.91MB → **0.96MB** |

**나무 후보로 살펴본 것과 왜 뺐는지** — Poly Haven 의 나무는 폴리곤 수와 무관하게
실제 내보낸 지오메트리(.bin) 가 훨씬 크다(잎이 카드가 아니라 개별 지오메트리로
펼쳐져 나온다): `jacaranda_tree` 312K 폴리곤인데도 .bin 208MB, `tree_small_02`
95MB, `island_tree_01/03` 60~80MB. 그중 가장 가벼운 `island_tree_02`(40.7MB)를
골라 `simplify` 로 깎았다. **meshopt 심플리파이는 정점을 줄이되 잎이 통째로
사라지지 않고 성글어지는 쪽으로 깎여서**(실제 스크린샷으로 확인, 구멍·깨짐 없음)
88% 감량에도 실루엣이 살아 있었다.

**수풀 후보로 살펴본 것과 왜 뺐는지** — `shrub_02`·`shrub_03`·`fern_02`·
`shrub_sorrel_01`·`wild_rooibos_bush` 도 받아 처리해 봤지만 전부 **원본이 옆으로
퍼지는 바닥형**(세로 폭이 좁다)이었다. 이 판의 `asset3d.js` `normalize()`는
사물을 세로 키 1 로 맞추고 그 비율 그대로 다시 키우므로, 세로로 낮고 옆으로
넓은 원본은 정규화하면 옆으로 몇 배씩 부풀어 화면을 뚫고 나간다(실제로
스크린샷에서 확인 — `_treecheck.html` 스크래치 페이지로 세로 정규화까지
재현해 걸러냈다, 페이지 자체는 커밋 안 함). **`shrub_04`(작은 나뭇가지 넷이
위로 선 다발) 만 세로 비율이 맞아 썼다** — 나머지는 다음에 '나무·수풀'이 아니라
'꽃·풀숲 바닥 장식'(PLAN 8절의 `flower`/`plant`) 축으로 다시 볼 만하다
(`shrub_sorrel_01`은 특히 예쁜 토끼풀꽃이라 아깝다).

옛 Quaternius `Bush_1·2.glb`·`BushBerries_1.glb`, `CommonTree_1·2·3.glb`는
지우지 않았다 — `js/asset3d.js` 의 `TREE_STYLIZED`·`BUSH_STYLIZED` 가 되돌림
자리로 들고 있다. 가을·눈·고목·소나무·자작나무는 이번 항목에 안 들어가
아직 저다각형이다.

---

## Poly Haven — 고목·소나무·통나무 사진측량 스캔 (`models/nature/realistic/`, 2026-09-03 이어서)

"자연물도 실사로" 나무·수풀 항목의 나머지 — `tree:dead`·`tree:pine`, 그리고
그 과정에서 나온 부산물로 `log`까지 갈아 끼웠다.

| 항목 | |
|---|---|
| **만든 이** | Rob Tuytel·Rico Cilliers(`pine_sapling_small`) · James Ray Cock·Dario Barresi·Rico Cilliers(`dead_quiver_trunk`) · Rob Tuytel(`dead_tree_trunk`) · Jenelle van Heerden·Rico Cilliers(`dead_tree_trunk_02`) — 전부 Poly Haven (<https://polyhaven.com>) |
| **라이선스** | **CC0 1.0 Universal** — 재배포 자유, 표시 의무 없음 |
| **받은 곳** | <https://polyhaven.com/a/pine_sapling_small> · <https://polyhaven.com/a/dead_quiver_trunk> · <https://polyhaven.com/a/dead_tree_trunk> · <https://polyhaven.com/a/dead_tree_trunk_02> — 1k glTF(api.polyhaven.com 으로 직접 받음) |

| 파일 | 원본 | 처리 |
|---|---|---|
| `TreeDead.glb` | `dead_quiver_trunk`(33,706 폴리곤·2.3MB 원본) | 지오메트리가 가벼워 그대로, `resize`(768px) → `jpeg`(품질 85) — 2.27MB → **0.70MB** |
| `PineSapling.glb` | `pine_sapling_small`(정점 406,356·bin 17.8MB) | `weld` → `simplify --ratio 0.08 --error 0.02`(정점 56,364, 86% 감량) → `resize`(768px) → `jpeg`(품질 85) — 21.9MB → **2.71MB** |
| `Log_a.glb` | `dead_tree_trunk`(101,802 폴리곤·2.3MB bin) | 지오메트리가 가벼워 그대로, `resize`(768px) → `jpeg`(품질 85) — 4.79MB → **2.72MB** |
| `Log_b.glb` | `dead_tree_trunk_02`(155,864 폴리곤·2.0MB bin) | 위와 동일 — 4.91MB → **2.48MB** |

**`tree:dead`에 `dead_tree_trunk`를 안 쓴 까닭** — 이름과 태그(`nature`,
`trees`)만 보면 고목처럼 보이지만, 실제로 받아 렌더해 보니 `dead_tree_trunk`·
`dead_tree_trunk_02` 둘 다 **가지 없이 옆으로 누운 통나무**였다(스크린샷으로
확인). `tree:dead`는 이 판에서 **선 채로 마른 나무** 자리라 안 맞는다 — 대신
누운 모양 그대로 쓸 수 있는 `log` 표로 돌렸다. `tree:dead`는 별도로
`dead_quiver_trunk`(퀴버 나무, 아프리카 알로에 계통이 죽으면 남기는 가지
없는 마른 줄기)를 찾아 썼다 — 세로로 곧게 서 있어 이 판의 정규화(세로 키 1)와도
잘 맞는다.

**`tree:pine`에 성긴 어린 나무를 쓴 까닭** — Poly Haven 의 성숙한 소나무·전나무는
전부 무거웠다(`pine_tree_01` 1740만 폴리곤, `fir_tree_01` 785만, `pine_sapling_medium`
978만). 가장 가벼운 `pine_sapling_small`도 폴리곤 수(398,144)와 실제 정점 수
(406,356)가 거의 같은데 반해 `.bin`은 17.8MB — 바늘잎 하나하나가 낱장
지오메트리로 펼쳐져 나오기 때문이다(나무 실사 전반의 공통 사정, `tree:common`
절 참고). `simplify`로 86% 줄여 썼다 — 원작 저다각형(굵고 빽빽한 원뿔)보다
가늘고 성긴 어린 나무 모양이 됐지만, 실제 게임 화면(puppeteer, `#pinetest`)에서
확인한 결과 다른 실사 나무·바위와 어울렸다.

옛 Quaternius `PineTree_1·2.glb`·`CommonTree_Dead_1.glb`는 지우지 않았다 —
`js/asset3d.js`의 `TREE_STYLIZED`가 되돌림 자리로 들고 있고, `WoodLog.glb`·
`WoodLog_Moss.glb`는 `LOG_STYLIZED`가 들고 있다.

**여전히 못 채운 자리** — Poly Haven 전체(`t=models`)를 뒤져도 **가을 단풍·흰
줄기 자작나무·눈 덮인 나무** 태그를 가진 CC0 모델이 없었다(가문비·소나무·야자
계열 사진측량뿐이다). `tree:common:autumn`·`tree:common:snow`·`tree:birch`는
이번 항목에서 못 채웠다 — 다른 CC0 출처(OpenGameArt 등)가 나오면 다음에 다시 볼 것.

## PolyScan — 마을 3D 건물(집 셋), 하드링크 (2026-09-09, `saga-dungeon`에서 옮김) — **2026-09-19 이 판에서 교체됨**

PLAN 6절 "작은 마을" 착수 때 `home`(집)·`tailor`(침선방)·`museum`(사고)
셋에 썼던 것. **2026-09-19 부로 이 판(`saga-forest`)에서는 세 파일을
지우고 아래 "Kenney Fantasy Town Kit" 절의 킷배싱 조립물로 갈아 끼웠다**
— §6.2 가 우려하던 대로 사진측량 PBR 텍스처가 툰 셰이딩과 안 어울려서다.
`saga-dungeon`·`saga-story`·`saga-realm`은 여전히 이 파일들을 그대로
쓴다(하드링크라 그쪽 사본은 안 건드렸다) — 이 절은 그 판들을 위해 남겨
둔다.

| 항목 | |
|---|---|
| **만든 이** | PolyScan (<https://polyscann.com>) |
| **라이선스** | CC0 1.0 — 사이트가 "재배포·상업적 이용 모두 자유, 표시 의무 없음"으로 명시 |
| **받은 곳** | `saga-dungeon/assets/models/buildings/realistic/`에서 하드링크(원 출처는 `polyscann.com`, 로그인 없이 CDN 직접 다운로드) |

| 파일(다른 판에서 계속 씀) | 이 판에서 쓰던 곳(2026-09-19 이전) |
|---|---|
| `models/buildings/realistic/house_wooden.glb` | 집(`home`) |
| `models/buildings/realistic/house_stone.glb` | 사고(`museum`) |
| `models/buildings/realistic/house_cottage.glb` | 침선방(`tailor`) |

## Kenney — Fantasy Town Kit(CC0), 부품 다운로드 + 킷배싱 (2026-09-19)

위 PolyScan 사진측량 집 셋을 대체한다. `home`·`tailor`·`museum` 은 툰
셰이딩에 맞춘 스타일라이즈드 저폴리 모듈로 다시 지었다 — 사용자 요청
("에셋 자체를 새로 구함")에 따라 원본 CC0 팩을 새로 받아 쓴 첫 사례.

| 항목 | |
|---|---|
| **만든 이** | Kenney (<https://kenney.nl>) |
| **라이선스** | CC0 1.0(Creative Commons Zero) — 상업 이용 포함 자유, 표시 의무 없음 |
| **받은 곳** | `https://kenney.nl/assets/fantasy-town-kit` 직접 zip(로그인 불필요), GLB 포맷 사용 |
| **원본 개수** | 856개 파일(모듈 벽·지붕·굴뚝·분수·수레 등) 중 이 판은 벽 6종 + 지붕 3종 + 굴뚝 1종만 골라 씀 |

부품 원본은 `models/buildings/kenney_parts/`(공유 텍스처
`Textures/colormap.png` 포함, 512×512 하나를 856개 부품이 공용). 조립
결과(§10-Q4 커밋 방식대로 `assets/generated/`)는
`assets/generated/buildings/`:

| 생성 파일 | 이 판에서 쓰는 곳 | 조립 레시피(`tools/asset-forge/kitbash.py` RECIPES) |
|---|---|---|
| `house_wood_home.glb` | 집(`home`) | wall-wood-door + wall-wood×2 + wall-wood-window-round(0/90/180/270°) + roof-gable + chimney |
| `house_wood_cottage.glb` | 침선방(`tailor`) | wall-wood-door + wall-wood-window-round + wall-wood×2 + roof-high-gable(더 뾰족한 지붕으로 실루엣 구분) |
| `house_stone_museum.glb` | 사고(`museum`) | wall-door + wall×2 + wall-window-stone(석재 벽) + roof-flat(곳간 느낌) |

텍스처는 `tools/asset-forge/palette.py`(`forest_green` 팔레트, PLAN.md
§6.3 green 바이옴 base8 그대로)로 스냅해 세계 색감에 맞췄다 — Kenney
원본 colormap.png 는 이 셋 말고도 캐릭터 피부색·깃발 등 다른 색을 함께
담고 있어 그대로 두면 어색했다. **재현 방법**: `kitbash.py build-all`
→ `palette.py snap-glb`(자세한 순서는 두 스크립트의 docstring). 렌더된
실제 화면(외곽선·명암과 잘 어울리는지)은 이번에도 미확인 —
`SAGA-HANDOFF.md`/이 판 `HANDOFF.md` 2026-09-19 절 "실기 확인 대기" 참고.

## Kenney·KayKit — 게시판·우편함·마을기 대역, 하드링크 (2026-09-09, `saga-dungeon`에서 옮김)

`board`(게시판)·`mail`(편지함)·`pole`(마을기) 셋은 정확히 맞는 CC0 모델이
없어(공고판·우편함·깃대만 따로 파는 팩을 못 찾았다) 크기·쓰임새가 가까운
소품으로 대신했다 — 표시 이름은 그대로고 3D 모양만 근사치다.

| 항목 | |
|---|---|
| **만든 이** | `signpost.glb`는 Kenney, `box_small.gltf.glb`·`banner_thin_red.gltf.glb`는 Kay Lousberg(KayKit) |
| **라이선스** | 둘 다 CC0 1.0 |
| **받은 곳** | `saga-dungeon/assets/models/props/signpost.glb`·`saga-dungeon/assets/models/dungeon/box_small.gltf.glb`·`banner_thin_red.gltf.glb`에서 하드링크. 원 출처·라이선스 확인 근거는 `../../saga-dungeon/assets/ASSET_LICENSES.md`의 같은 파일명 절 참고(Kenney 는 `poly.pizza` 경유, KayKit 은 `github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0`) |

| 파일 | 이 판에서 쓰는 곳 |
|---|---|
| `models/props/signpost.glb` | **게시판**(`board`) |
| `models/props/box_small.gltf.glb` | **편지함**(`mail`) — 원래 던전 방 잡동사니 상자, 작은 나무 상자라 편지함 대역으로 썼다. 2026-09-11 — 같은 파일을 새 키(`crate`)로 한 번 더 등록해 우주기지(PLAN 45절)의 보급 상자·택배 접수대(`courierPost`)에도 그대로 썼다(새 파일 안 받음) |
| `models/props/banner_thin_red.gltf.glb` | **마을기**(`pole`) — 원래 보스방 현수막, 깃발 달린 기둥이라 마을기 대역으로 썼다 |

## Sketchfab — 아일랜드 문화유산 사진측량 스캔, 하드링크 (2026-09-11, `saga-go`에서 옮김)

폐허(§43·46-2, `ruinSpot`)에 아치·이끼바위뿐이던 것을 실제 탑성 폐허로
키웠다. 원 출처·CC0 확인·정제 경위는 `saga-go`가 이미 다 적어 뒀다 —
여기서는 이 판에 옮긴 파일만 추린다.

| 항목 | |
|---|---|
| **원본 이름** | Renvylle Castle — 13~14세기 탑성(tower house) 폐허, 아일랜드 코네마라 |
| **만든 이** | Galway3D_DH_Age (Sketchfab) |
| **라이선스** | CC0 Public Domain |
| **받은 곳** | `saga-go/assets/models/buildings/realistic/tower_ruin.glb`에서 하드링크(md5 동일). 원 출처·정제 경위(13.4MB → 584.5KB, gltf-transform) 자세한 것은 `../../saga-go/assets/ASSET_LICENSES.md`의 "Sketchfab — 아일랜드 문화유산 사진측량 스캔" 절 참고 |

| 파일 | 이 판에서 쓰는 곳 |
|---|---|
| `models/buildings/realistic/tower_ruin.glb` | **무너진 탑성**(`ruinTower`, PLAN 46-2절) — 폐허(ruinSpot)의 새 중심 건물 |

## MPFB2 실사 몸 20종 — 외형 다양화, 표 기본에 적용됨 (2026-09-10, `saga-go`에서 복사)

`saga-go`가 2026-09-05에 뽑아 둔 MPFB2 실사 몸 20종(`assets/models/people/
mpfb_real/{male,female,v3,v7~v23}.glb`, 각 3.5~4.3MB, 총 74MB)을 이 판에도
복사해 뒀다 — **라이선스는 CC0**(출처·재현 경위는 `saga-go/assets/
ASSET_LICENSES.md`의 "MPFB2 + makehuman_system_assets" 절 참고).

`js/asset3d.js`에 `HERO_RECIPES_MPFB`로 선언하고 **`DEFAULTS.hero`에도
얹었다**(같은 날 뒤이어 완료) — 이 MPFB 몸은 제 클립이 0개라 saga-go의
`retargetInto()`처럼 UAL1 몸짓을 뼈대 비례까지 맞춰 다시 구워 입혀야
하는데, saga-go의 리타깃 계열 함수(`firstSkinned`·`boneNameMap`·
`sceneHeight`·`retargetInto`)를 이 파일로 옮겨 오고 `loadHeroRecipe()`의
`assemble()`에서 몸마다 한 번만 다시 굽도록 이어 붙였다. 이 판은 아직
이 표를 실제로 세우는 3D 화면(PLAN PHASE 2, world3d)이 없어 지금은 화면에
영향이 없다 — 그 화면이 생기면 이 20종이 뒤틀리지 않고 걷는 인물로 선다.

---

## 배경음악(BGM) — `forest.mp3` (2026-09-10, `saga-story`에서 옮김)

"다른 게임을 참조해서 개선해 달라"는 요청으로 다섯 판 중 소리(효과음)만
있고 배경음악은 없던 이 판에 음악을 얹었다. 새로 받지 않고 `saga-story`가
이미 갖고 있던 CC0 트랙을 그대로 옮겼다 — 곡 이름부터 이 판과 맞는다.

| 항목 | |
|---|---|
| **곡명** | Peaceful forest |
| **만든 이** | Samza |
| **라이선스** | **CC0 1.0 Universal** — 저작자 표시 필요 없다, 재배포 허용된다 |
| **받은 곳** | <https://opengameart.org/content/peaceful-forest> (Samza 본인 업로드).
  이 판은 `saga-story/assets/audio/bgm/forest.mp3`에서 하드링크로 받았다 —
  원 출처·라이선스 확인 근거는 `../../saga-story/assets/ASSET_LICENSES.md`의
  같은 절 참고 |
| **파일** | `assets/audio/bgm/forest.mp3`(2.4MB) |

`js/bgm.js` 신설 — `saga-story/js/bgm.js`를 본으로 삼되, 이 판은 마을
하나뿐이고 전투가 없어 town/forest/battle 세 트랙을 가릴 필요가 없다.
**트랙 하나만 늘 돌린다**(단순하게 시작). `core.save.settings.music`
(기본 켜짐)·`musicVol`(기본 0.35)에 저장되고, 브라우저 자동재생 정책 때문에
`sfx.js`와 같은 요령으로 첫 클릭/터치/키 입력 뒤에야 실제로 울린다. ⚙️ 설정
시트에 "배경음악" on/off·음량 슬라이더를 효과음 항목 바로 아래 얹었다.
자가진단(`_test.html`)에 세 항목(모듈·기본값 확인 / 첫 눌림 전엔 안 풀림 /
음량 0~1 끊김) 추가, 245→248(3회 동일).

**실기기 확인 전** — 실제로 음악이 나오는지, 효과음과 볼륨 균형이 맞는지는
사용자가 직접 들어봐야 한다.

---

## Quaternius "Ultimate Monsters Bundle" — 포자괴물(Mushnub), 하드링크 (2026-09-10, `saga-dungeon`에서 옮김)

사용자가 "완전 모방 할 필요 없어 — 괴물이 나와도 되고, 퓨전이야"로 방향을
넓혀(퓨전 방향, PLAN 20절 "몬스터 습격" 예시) 처음 들인 몬스터. 새로 받지
않고 `saga-dungeon`이 "몬스터 100개" 작업(2026-09-07)에서 이미 CC0 확인해
둔 것 중 버섯숲(mushroom) 바이옴에 맞는 것 하나만 옮겼다.

| 항목 | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com>) |
| **라이선스** | **CC0 1.0 Universal** — 저작자 표시 필요 없다, 재배포 허용된다 |
| **받은 곳** | `poly.pizza/bundle/Ultimate-Monsters-Bundle-5oyGWAmOB6` 미러 —
  원 출처·라이선스 확인 근거는 `../../saga-dungeon/assets/ASSET_LICENSES.md`
  "몬스터 — KayKit Skeletons + Quaternius Ultimate Monsters" 절 참고 |
| **파일** | `assets/models/monsters/Mushnub_55c64684.glb`(30KB, md5 동일 — 그대로
  복사만 했다) — `saga-dungeon/assets/models/monsters/quaternius/Mushnub_55c64684.glb`
  와 같은 파일 |

원본 클립(`CharacterArmature|Idle`·`Walk`·`Bite_Front`·`Death` 등)이 있어
`asset3d.js`의 `buildGeneric()`이 다른 짐승과 같은 결로 mixer 를 태운다 —
지금은 idle/walk 만 쓴다(공격·죽음 클립은 이 판에 전투가 없어 안 쓴다).

`data-village.js`의 `VD.ANIMALS.mushnub`(이름 '포자괴물', biomes:['mushroom'],
`rare:true`)로 등록 — `village.js`의 `buildAnimals()`가 버섯숲 바이옴 칸에서
아주 드물게만(8%, `MONSTER_BIOME` 표) 여우 대신 세운다. 새 전투 시스템은
안 만들었다 — 다른 짐승과 똑같은 idle/wander/flee 만 탄다(발견하면 놀랍지만
싸우지는 않는, "만나면 반가운 희귀 존재" 쪽). 2D는 맞는 CC0 스프라이트가
없어 emoji(🍄)로 뜬다.

---

## Quaternius — 무너진 아치(Arch.glb), 하드링크 (2026-09-10, `saga-go`에서 옮김)

퓨전 방향("시대 혼합 소품·폐허")으로 처음 채운 PLAN 10절 "폐허" 예시. 새로
받지 않고 `saga-go`·`saga-dungeon`이 이미 CC0 확인해 둔 것을 그대로 복사했다.

| 항목 | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com>) |
| **라이선스** | **CC0 1.0 Universal** — 저작자 표시 필요 없다, 재배포 허용된다 |
| **받은 곳** | <https://github.com/trebeljahr/quaternius-showcase> `public/glb/modular_dungeon_1/` —
  원 출처·라이선스 확인 근거는 `../../saga-go/assets/ASSET_LICENSES.md`의
  같은 파일명 절 참고 |
| **파일** | `assets/models/props/Arch.glb`(234KB, md5 `saga-go` 쪽과 동일 — 그대로
  복사만 했다) |

`village.js`에 `ruinSpot()`/`inRuin()` 신설(호수·캠프·동굴이 다 찬 뒤 남은
서북쪽) — `buildProps()`가 아치 하나 + 이끼바위(`mossyRock`, 기존 등록)
둘로 "옛날에 뭔가 있었던 자리" 느낌만 준다. **전부 순수 장식**(`deco:true`)
— 새 상호작용은 없다. `js/asset3d.js`에 `ruin:arch` 한 줄, `village-view3d.js`의
`SCATTER_KIND`·`SCATTER_H`에 한 줄, `ui.js`의 `MAP_PROP_ICON`·범례·전체지도
마크에도 각각 한 줄(🏚️ — 사고 🏛️와 안 겹치게 다른 이모지를 썼다).

**당장 "미래적" 소품은 못 채웠다** — 이 저장소가 지금까지 CC0 확인해 둔
자산 중에 SF/미래풍 폐허가 없다(다섯 판 다 사극·판타지·현대 배경이라
그런 자산을 받은 적이 없다). 다음에 그런 CC0 자산을 찾으면 같은 `ruinSpot()`
자리에 더 얹거나 새 자리를 열면 된다.

---

## Quaternius "Ultimate Space Kit" — 배달원 우주복 (2026-09-14, `saga-dungeon`에서 옮김)

PLAN §46 "다음에 이어갈 것" 셋째 항목(배달원에게 우주비행사 외형을 입혀
다른 여섯 NPC와 다른 실루엣으로 보이게 하기)을 채웠다. 새로 받지 않고
`saga-dungeon`이 "캐릭터 5차분"(2026-09-09)에서 이미 CC0 확인해 둔
Astronaut 3벌 중 1벌만 옮겼다.

| 항목 | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com>) |
| **라이선스** | **CC0 1.0 Universal** — 저작자 표시 필요 없다, 재배포 허용된다 |
| **받은 곳** | `poly.pizza/m/0D54W8yfrA` → `static.poly.pizza/f06659f2-e505-43df-a3db-84faec811a57.glb` —
  원 출처·라이선스 확인 근거는 `../../saga-dungeon/assets/ASSET_LICENSES.md`의
  "캐릭터 5차분 — Ultimate Space Kit 우주비행사 3벌" 절 참고 |
| **파일** | `assets/models/people/space/Astronaut1.glb`(208KB, md5
  `saga-dungeon/assets/models/people/polypizza_space/Astronaut1.glb` 쪽과 동일 —
  그대로 복사만 했다) |

셋 다 같은 뼈대·`CharacterArmature|*` 클립(색·소재 텍스처만 다른 변형)이라
1벌만으로 충분 — 이 판은 우주비행사 역할이 배달원 하나뿐이다. `EXT_meshopt_compression`
확장으로 압축돼 있는데 `asset3d.js`가 2026-09-09부터 `GLTFLoader`에
`MeshoptDecoder`를 이미 물려 둔 상태라 별도 작업 없이 그대로 풀린다.

`js/asset3d.js`의 `DEFAULTS['hero:npc_courier']`로 등록 — `village.js`의
`npcAt('courier', ...)`가 주는 `id: 'npc_courier'`를 `keysFor()`가 `'hero'`보다
먼저 찾아 이 좁은 키가 걸린다. 다른 NPC·마을 주민·플레이어는 그대로
`HERO_RECIPES`(QRPG·MPFB 섞음) 해시를 탄다 — 배달원만 예외로 갈랐다. 새
상호작용·판정은 안 건드렸다(순전히 외형).

---

## Quaternius "Ultimate Space Kit" — 우주기지 확충: 건물·로버·메카 (2026-09-14)

PLAN §46-3 "다음에 이어갈 것" 둘째 항목(우주기지 §45~46 를 지금까지 fence·
cart·crate·lantern — **전부 이 팩과 무관한 다른 자리에서 빌린 소품** —
로만 채웠던 것에, 이 팩 자체의 건물·차량·메카를 처음 얹는다).

**§46-2 가 "poly.pizza 직접 다운로드는 이 환경에서 SSL 로 막혀 있다"고
적어 둔 것을 이번에 다시 확인**했다 — `curl`로 `poly.pizza`·
`static.poly.pizza` 모두 이번 세션엔 200 으로 응답했다(막혔던 것이 상시가
아니라 그때그때 환경 사정이었던 듯). 그래도 이 저장소가 이미 Frog.glb 등에
써 온 **GitHub 미러**(`trebeljahr/quaternius-showcase`, saga-go·
saga-dungeon 도 같은 미러를 쓴다)로 그대로 받았다 — 배달원 우주복
(위 절)과 **같은 Ultimate Space Kit 팩**(Quaternius, CC0)이라 출처 확인은
이미 이 판·saga-dungeon 양쪽에 서 있다.

| 자산 | 받은 곳 | 파일 | 크기 |
|---|---|---|---|
| 본관(Base_Large) | `github.com/trebeljahr/quaternius-showcase` `public/glb/ultimate_space_pack/Base_Large-transformed.glb` | `assets/models/buildings/space/Base_Large.glb` | 13.4KB |
| 숙소(House_Single) | 〃 `House_Single-transformed.glb` | `assets/models/buildings/space/House_Single.glb` | 6.3KB |
| 측지돔(GeodesicDome) | 〃 `GeodesicDome-transformed.glb` | `assets/models/buildings/space/GeodesicDome.glb` | 9.7KB |
| 태양광판(SolarPanel_Ground) | 〃 `SolarPanel_Ground-transformed.glb` | `assets/models/props/space/SolarPanel_Ground.glb` | 3.6KB |
| 탐사차(Rover_1) | 〃 `Rover_1-transformed.glb` | `assets/models/props/space/Rover_1.glb` | 28.0KB |
| 메카(Mech_FinnTheFrog) | 〃 `Mech_FinnTheFrog-transformed.glb` | `assets/models/props/space/Mech_FinnTheFrog.glb` | 181.3KB |

만든 이 Quaternius, 라이선스 **CC0 1.0 Universal**(저작자 표시 불필요,
재배포 허용) — 위 절과 동일. 여섯 다 합쳐도 240KB 남짓이라 PLAN 31절
"적은 수의 좋은 에셋" 원칙 그대로다.

`js/asset3d.js`에 `building:spaceBase`·`building:spaceHouse`·
`building:spaceDome`·`rover`·`solarPanel`·`mech` 로 등록,
`js/village.js`의 우주기지 자리(spaceBaseSpot)에 전부 `deco:true`(순전히
장식, 새 상호작용 없음)로 놓았다. `js/village-view3d.js`의
`SCATTER_KIND`/`SCATTER_H`, `js/data-village.js`의 `VD.PROPS`(2D 대체
이모지 — 3D 가 꺼진 기기·프로필을 위한 되돌림 자리)에도 짝을 맞춰 넣었다.
메카(Mech_FinnTheFrog)는 PLAN 45절 표가 미리 적어 둔 대로 "세워 두고
살펴보는 장식" — 새 탈것·전투 시스템은 안 늘렸다.

자가진단 261/265(3회 동일 — 공사(工事) 테스트 넷은 이 변경과 무관한
기존 실패, `PLAN.md` §46-3 이 이미 같은 261/265 를 기준선으로 적어
뒀다). 우주기지 deco 소품 수를 세는 기존 테스트를 5 → 11 개로 맞춰
고쳤다(`_test.html`).

**다음에 이어갈 것** (PLAN §45 표 갱신)
- 현대(도시) 목적지 — 여전히 CC0 자산 미확보
- 이 팩에 남은 것 — Connector·Roof_*·MetalSupport·Stairs·Ramp 같은 결합용
  조각(본관 하나로도 "기지" 느낌은 나서 이번엔 안 받았다), Enemy_*(포자괴물과
  같은 결의 우주기지 전용 희귀 몬스터 후보, PLAN §45 표 참고), Pickup_*
  (택배 소포 모양을 상자 대신 이걸로 바꾸는 안)
- 실기 확인 전 — 우주기지가 실제로 그 자리에 서는지, 여섯 새 소품이 3D
  화면에서 서로 겹치지 않고 자연스럽게 보이는지는 사용자가 직접 봐야 한다

---

## Quaternius "Ultimate Space Kit" — 우주기지 전용 희귀 몬스터 "성간충" (2026-09-14)

바로 위 절이 "다음에 이어갈 것"으로 남긴 셋(현대 목적지·이 팩의 남은 조각·
Enemy_*) 중 `Enemy_*`(포자괴물과 같은 결의 우주기지 전용 희귀 몬스터 후보)를
채웠다. 같은 GitHub 미러(`trebeljahr/quaternius-showcase`)에서 이번엔
`ultimate_space_pack/Enemy_Small-transformed.glb`를 받았다.

| 항목 | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com>) |
| **라이선스** | **CC0 1.0 Universal** — 저작자 표시 필요 없다, 재배포 허용된다 |
| **받은 곳** | `github.com/trebeljahr/quaternius-showcase` `public/glb/ultimate_space_pack/Enemy_Small-transformed.glb`(같은 Ultimate Space Kit 팩, 위 두 절과 출처 동일) |
| **파일** | `assets/models/monsters/space/EnemySmall.glb`(41.2KB) |

`js/asset3d.js`에 `monster:spacebug`로 등록. `js/data-village.js`의
`VD.ANIMALS.spacebug`(표시 이름 '성간충', `rare:true`)로 등록했지만,
우주기지는 `BIOME_CELL`(22칸) 격자보다 작은 자리(7×7)라 포자괴물이 쓰는
`MONSTER_BIOME` 경유 뽑기에는 안 걸린다 — `js/village.js`의
`buildAnimals()`가 배달원(courier)과 같은 방식(고정 위치, 세이브 시드별
확률 — 40%)으로 따로 심는다. 새 전투 시스템은 안 만들었다 — 다른 짐승과
똑같이 idle/wander/flee만 탄다. `js/village-view3d.js`의
`SCATTER_KIND`/`TURNING_KIND`/`SCATTER_H`에도 다른 짐승과 같은 결로 한
줄씩 보탰다(원본에 Idle·Walk·Attack 클립이 있어 걷는 몸짓이 그대로 탄다).
2D는 맞는 CC0 스프라이트가 없어 이모지(👾)로 뜬다(다른 미매핑 짐승과 같은
자동 대체 경로).

자가진단에 "여러 씨앗을 돌며 나타날 때만·항상 우주기지 안"을 확인하는
항목을 새로 추가(40개 씨앗을 돌려 봄, 40% 근방으로 나타나고 벗어난 자리는
0개 확인), 기존 TURNING_KIND·짐승 종 완결성 검사 두 개도 새 종에 맞춰
`need` 배열을 고쳤다. `node -c`로 손댄 네 스크립트(asset3d.js·
data-village.js·village.js·village-view3d.js) 구문 확인, `_test.html`
인라인 스크립트도 마찬가지.

**다음에 이어갈 것** (PLAN §45 표 갱신)
- 현대(도시) 목적지 — 여전히 CC0 자산 미확보
- 이 팩에 남은 것 — Connector·Roof_*·MetalSupport·Stairs·Ramp 같은 결합용
  조각, Pickup_*(택배 소포 모양을 상자 대신 이걸로 바꾸는 안)
- 실기 확인 전 — 성간충이 실제로 우주기지 안에서 자연스럽게 보이는지,
  이모지(👾) 폴백이 어색하지 않은지는 사용자가 직접 봐야 한다

## VRoid Studio 공식 샘플 아바타 — 애니메 비례 인물 시험 (2026-09-19)

사용자가 "원신급이 나와야해"로 그래픽 기대치를 밀어붙여, 인물 쪽(§"원신급"
요청 ②) 레버로 받았다. VRoid Hub 자체는 Cloudflare 로 막혀 있어(curl 로
403) GitHub 미러(`madjin/vrm-samples`, 이 저장소도 CC0/조건부 라이선스를
파일별로 구분해 문서화해 둠)를 거쳤다.

| 항목 | |
|---|---|
| **만든 이** | Pixiv Inc.(VRoid Studio) |
| **라이선스** | CC0(저작권 포기) — VRoid 공식 FAQ("Do VRoid Studio's sample models come with conditions of use?") 및 `github.com/madjin/vrm-samples` README "CC0 license models" 절 확인. `AvatarSample_A·B·C` 세 개가 이 CC0 부류(VRoid 자체 제공 `VRoidPreset_A~Z` 프리셋과는 다른 라이선스이니 혼동 주의 — 그쪽은 저작권 비포기 "조건부 사용" 부류) |
| **받은 곳** | `https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/stable/AvatarSample_{A,B,C}.vrm` |
| **원본 크기** | A 15.1MB · B 15.4MB · C 13.1MB(대부분 텍스처) |

**가공**: VRM(=glTF 2.0 GLB + VRM 확장)의 텍스처만 pygltflib 로 직접
줄였다(`tools/asset-forge/`에 아직 스크립트로 올리지 않음 — 임시
스크래치패드 1회성, 필요하면 재작성). `pbrMetallicRoughness.baseColorTexture`
로 실제 쓰이는 이미지 15장만 최대 512px 로 Pillow 재인코딩, 나머지(노멀맵·
MToon 매트캡/스펙큘러·썸네일 등 plain `THREE.GLTFLoader`가 안 읽는 채널)는
8×8 자리표시자로 비웠다 — 인덱스는 안 바꿔 JSON 재배선 위험이 없다. 스킨·
메시·애니메이션이 걸린 220~261개 bufferView 는 원본과 바이트가 같은지
스크립트 자체 검증(전부 OK). 결과 4.7~5.6MB — 여전히 이 판 다른 GLB보다
크다(원본이 VRoid 통짜 캐릭터라 메시·블렌드셰이프 자체가 무겁다, Draco·
메시 단순화는 이번엔 손 안 댐, 다음 후보).

| 파일 | 이 판에서 쓰는 곳 |
|---|---|
| `models/people/anime/avatar_sample_a.glb` | `hero` kind, key `anime_avatar_a`(`world3d.animeAvatar` 손잡이, 기본 꺼짐) |
| `models/people/anime/avatar_sample_b.glb` | 〃 `anime_avatar_b` |
| `models/people/anime/avatar_sample_c.glb` | 〃 `anime_avatar_c` |

**뼈 이름**: VRM Humanoid 표준(`J_Bip_C/L/R_*`)이라 이 판의 공용 애니메이션
(UAL1/UE 마네킹 이름)과 하나도 안 겹친다 — `asset3d.js`의 `boneNameMap()`에
`VRM_TO_UAL1_BONES` 보충표(핵심 22뼈, 손가락 제외)를 추가해 기존
`retargetInto()` 파이프라인(MPFB 20종이 이미 쓰는 그 경로)을 그대로
태웠다. 재질은 VRM 이 `KHR_materials_unlit`로 내보내 `delam()`이 놓치는
`MeshBasicMaterial`을 전용 `toonifyAnime()`으로 따로 받는다(`delam()` 자체는
안 건드림 — 그 함수를 쓰는 다른 700여 개 GLB에 영향 없게).

**의도적으로 기본 꺼짐**: `world3d.animeAvatar`(기본 0) — 렌더 확인이
전혀 안 되는 채로 만든 새 몸이라, 손잡이를 켜기 전엔 기존 주민·NPC
배정에 전혀 안 끼어든다(`HERO_RECIPES_MIXAMO`/`wantsMixamoReal()`과
같은 결). **실기 확인 전 — 손잡이를 켜고 실제로 걷는 모습·비례·재질이
이 판 톤(§6.1 툰+외곽선+림 라이트)과 어울리는지는 전부 미확인.**

## VRoid Studio GUI 자동화로 직접 빚은 커스텀 아바타 (2026-09-19)

사용자가 "GUI 조작 도구 설치해서 해줘"로 요청 — PowerShell(.NET
`System.Drawing`/`user32.dll` P/Invoke, 별도 설치 없이 이미 되는 기능)로
스크린샷·마우스 클릭 루프를 짜서 VRoid Studio 2.14.0(이 PC에 이미 설치돼
있었음, `AppData\Local\Programs\VRoidStudio\2.14.0\`)을 직접 조작해
캐릭터 하나를 처음부터 새로 만들었다 — 위 공식 샘플 셋과 달리 "완성품을
받은" 게 아니라 이 세션이 직접 빚은 첫 캐릭터.

| 항목 | |
|---|---|
| **만든 방식** | VRoid Studio 2.14.0 GUI 자동화(여성 베이스 → 얼굴 세트 변경 → 헤어 세트 변경 → 전신 세트(하와이안 셔츠+데님 반바지) 적용 → VRM0.0 내보내기) |
| **라이선스** | 내보내기 시 직접 설정: 상업 이용 허가 체크, 라이선스 유형 "Creative Commons CC BY"(재배포·수정 허용, 표시 요구) — VRM 파일 메타데이터에 그대로 저장됨. 밑에 깔린 얼굴·헤어·의상 파츠 자체는 VRoid Studio 번들 프리셋(공식 배포물)이다 |
| **가공** | 위 AvatarSample 셋과 같은 방식으로 pygltflib 텍스처 축소(15장 중 실제 baseColorTexture 만 512px, 나머지 자리표시자) — 원본 17.7MB → 9.0MB. 이미지 자체는 803KB뿐이라 나머지는 메시·블렌드셰이프 무게(원본 51,946 폴리곤, VRoid 자체 폴리곤 감량 슬라이더는 이번엔 안 씀 — 다음에 줄일 여지) |
| **뼈·재질** | 위 AvatarSample 절과 동일(`J_Bip_*`→UAL1 리타겟, `toonifyAnime()`) — 같은 VRoid 파이프라인 산출물이라 구조가 같다 |

| 파일 | 이 판에서 쓰는 곳 |
|---|---|
| `models/people/anime/avatar_custom_01.glb` | `hero` kind, key `anime_avatar_custom01`(`world3d.animeAvatar` 손잡이, 기본 꺼짐) |

**GUI 자동화 메모**(다음에 이어갈 때 참고): VRoid Studio 는 Unity 빌드라
버튼·슬라이더가 네이티브 Windows 컨트롤이 아니라 캔버스 그림이라 좌표
클릭만 된다 — 창이 포커스를 잃으면(같은 데스크톱의 다른 세션이 자기
창을 앞으로 가져올 때 등) 좌표가 안 맞을 수 있어 매 클릭 전에
`SetForegroundWindow`+스크린샷 재확인이 필요했다. VRM 내보내기는
프로젝트를 먼저 "다른 이름으로 저장"(`.vroid`)해야 상단 공유 아이콘에
"VRM 내보내기" 항목이 나타난다(저장 전엔 계정 메뉴만 보인다). **실기
확인 전**: 위 샘플 셋과 마찬가지로 렌더된 모습은 미확인.

## 옷 색 물들인 숲 NPC 전용 애니메 아바타 (2026-09-19, `assets/generated/`)

제보 "마을 배경이랑 이질감 있는 게 제일 크다"(§6.5 다음 단계 결정) 뒤로
방향을 좁혔다: 위 두 절(AvatarSample A/B/C·커스텀01)의 몸은 그대로 두고,
**이름 있는 숲 NPC 7명에만** 적용하면서 옷 색만 이 판의 `forest_green`
판별 팔레트(PLAN.md §6.3)로 물들였다. 원본(`models/people/anime/*.glb`)은
전혀 안 건드리고, 출력만 `assets/generated/`에 새로 둔다(§7.2 결).

**만든 방식**: `tools/asset-forge/palette.py tint-glb --only-suffix CLOTH`.
VRoid 는 material.name 끝에 `FACE`/`EYE`/`SKIN`/`HAIR`/`CLOTH` 범주를 붙여
내보내(`avatar_custom_01.glb`처럼 GUI로 병합한 것은 끝에 `(Instance)`가
더 붙는다 — `_CLOTH` 토큰 검사로 잡음) `_CLOTH` 재질(Tops·Bottoms·Shoes)
텍스처만 골라 물들이고 얼굴·피부·머리는 원본 그대로 둔다. 처음엔 기존
`snap-glb`(최근접 색 스냅)로 시도했다가 **부드럽게 음영진 천이 얼룩덜룩한
패치워크로 뭉개지는 걸 확인**(`preview` 비교 PNG로 눈으로 봄, 스크린샷
금지 규칙과 무관한 평면 이미지 비교)하고 `tint-glb`(명도는 원본 유지,
색상·채도만 목표 색으로 — 새로 추가한 함수)로 방향을 바꿨다.

| NPC id | 몸(원본) | 팔레트 role | 채도 배율 |
|---|---|---|---|
| keeper(숲지기) | avatar_sample_a | leaf(잎, 초록) | 0.7 |
| angler(낚시꾼) | avatar_sample_b | water(물, 파랑) | 0.75 |
| merchant(상인) | avatar_sample_c | path(길, 황갈) | 0.9 |
| explorer(탐험가) | avatar_custom_01 | stone(돌, 회색) | 0.85 |
| herbalist(약초꾼) | avatar_sample_a | stem(줄기, 갈색) | 0.85 |
| wanderer(나그네) | avatar_sample_b | accent(강조, 산호빛) | 0.6 |
| courier(배달원) | avatar_sample_c | sky(하늘, 옅은 파랑) | 0.7 |

**라이선스**: 위 두 절과 동일(원본이 CC0 또는 CC BY) — 색만 바꾼 파생물이라
같은 라이선스가 그대로 적용된다.

| 파일 | 이 판에서 쓰는 곳 |
|---|---|
| `generated/people/anime/npc_<id>.glb`(7개) | `asset3d.js` `HERO_RECIPES_ANIME_NPC[id]` — `world3d.animeAvatar` 손잡이(기본 꺼짐)를 켜면 위 표의 숲 NPC 7명에게만 적용, 마을 주민(residents)은 그대로 QRPG 저폴리 |

**실기 확인 전**: 옷 색이 실제로 배경과 어울리는지, 채도 배율(0.6~0.9)이
적당한지는 화면이 있어야 판단 가능 — 위 표는 눈대중 배정이라 조정 여지가
있다.

## 첫 캠프 집 3채 — 킷배싱 + 지붕 색 물들임 (2026-09-19, `assets/generated/`)

PLAN.md §6.4 "주민 집 외형 3종(집 GLB + 지붕 색)". 첫 캠프(hamletSpot)의
세 채(hamletHouse·hamletHut·hamletShed)를 Quaternius `medieval_village_pack`
(House_1~3, 위 "models/buildings/" 절)에서 위 "Kenney Fantasy Town Kit"
절과 같은 킷배싱 계열로 갈아 끼웠다 — home·tailor·museum과 같은 자산
계열로 통일된다. House_1~3.glb 파일 자체는 지우지 않았다(되돌림 자리).

**만든 방식**: 벽 배치는 `house_wood_home`과 완전히 같다(문벽+벽×2+둥근창벽,
0/90/180/270° + 굴뚝). 세 채를 서로 다르게 보이려고 **지붕만** 다른 색으로
물들였다 — `roof-gable.glb`(원본, 위 Kenney 절과 동일 출처)를
`palette.py tint-glb`로 미리 물들인 뒤(`roof-gable-stem/stone/accent.glb`,
`models/buildings/kenney_parts/`에 둔다), `kitbash.py`(`house_camp_a/b/c`
레시피)로 조립했다. 조립 직후엔 지붕만 텍스처 내용이 달라 다른 부품과
재질이 안 합쳐지는데(트리메시가 내용이 같은 재질은 자동으로 합친다 —
바로 이 성질 때문에 지붕에 다른 색을 먼저 입혀 둬야 뒤에도 안 섞인다),
이 상태로 `palette.py snap-glb`를 그냥 돌리면 전체 텍스처가 다시 8색으로
스냅되며 지붕색까지 지워진다 — 그래서 `snap-glb`에 새 `--exclude-node-prefix`
인자를 추가해 `roof`로 시작하는 씬 그래프 노드(kitbash.py가 부품 파일명으로
붙인 이름, 예: `roof-gable-stem_5`)만 건너뛰게 했다. 재질 이름(`_material_matches`)
이 아니라 **노드 이름** 기준인 이유 — 이 조립물은 부품 7개가 전부 같은
`colormap` 재질 하나를 공유해(Kenney 킷 공통 스와치 아틀라스) 재질
이름으로는 부품을 구분할 수 없었다.

| 항목 | |
|---|---|
| **만든 이·라이선스** | 원본(`roof-gable.glb`·벽·굴뚝)은 위 "Kenney — Fantasy Town Kit" 절과 동일(CC0). 색만 바꾼 파생물이라 같은 라이선스가 그대로 적용된다 |

| 생성 파일 | 이 판에서 쓰는 곳 | 지붕 색(팔레트 role, `forest_green`) |
|---|---|---|
| `generated/buildings/house_camp_a.glb` | `hamletHouse`(오두막) | stem(줄기, 갈색) |
| `generated/buildings/house_camp_b.glb` | `hamletHut`(움집) | stone(돌, 옅은 회색·채도 0.6) |
| `generated/buildings/house_camp_c.glb` | `hamletShed`(흙집) | accent(강조, 산호빛·채도 0.75) |

**실기 확인 전**: 세 지붕 색이 실제 화면에서 서로 잘 구분되고 forest_green
벽·툰 외곽선과 어울리는지는 렌더가 있어야 판단 가능.

**바로잡음 — 캠프 소품(천막·모닥불·벤치·우물·등롱) 배치 현황**: 이 문서·
PLAN.md 양쪽에 "캠프 소품이 미착수"로 적힌 옛 기록이 있었는데, 실제로는
`village.js` `buildProps()`에 세 캠프 자리(hamletSpot·hamlet2Spot·ruinSpot)
모두 이미 배치돼 있다(천막 2+모닥불+벤치 2+우물+등롱 2 — 첫 캠프 기준).
다만 그 소품들의 GLB(`Tent.glb`·`Bench_1.glb`·`Well.glb`·`WoodenTorch.glb`,
위 "models/props/" 절)는 여전히 옛 팩 그대로라 이번 킷배싱·팔레트 스냅
대상에서는 뺐다 — 집 세 채만 이번 범위다.

## VRM 애니메 아바타 가공 (2026-09-20)

`assets/models/people/anime/avatar_*.glb` 넷은 `tools/glb-compress/vrm-slim.mjs` 로 **가공한 파일**이다 —
표정 모프 타깃(54~57개)을 떼고 같은 재질 프리미티브를 합쳤다(정점·뼈·재질·텍스처는 그대로, 용량 25MB → 11MB,
캐릭터당 드로우콜 90~135 → 14~19). 다섯 판 복사본은 같은 파일(md5 동일)이다.


## 도감 펫 초상 105종 — 사가블로·사가고에서 복사 (2026-09-24)

여태 펫 105종이 늑대·사슴·여우 셋을 돌려 입던 것을 고치려고 **그대로 복사**했다(재가공 없음). `js/asset3d.js` `pet:pt_*` 로 등록.
실제 동물은 사가블로(출처 `saga-web/saga-dungeon/assets/ASSET_LICENSES.md` "도감(펫) 초상"·"펫 — poly.pizza 동물 번들 셋"·"펫 2차분"),
신수·포켓몬 오마주 대역은 사가고(출처 `saga-web/saga-go/assets/ASSET_LICENSES.md`, 사용자 결정 "사가고처럼 대역 입히기"). 전부 Quaternius 계열 CC0.

| 폴더 | 파일 |
|---|---|
| `models/animals/` | `Tiger.glb`·`Bear.glb`·`Panda.glb`·`Monkey.glb`·`Boar.glb`·`Owl.glb`·`Cat.glb`·`Crane.glb`·`Koi.glb`·`Husky.glb`·`ShibaInu.glb`·`Mesh_Crow.gltf`·`Mesh_Crow.bin`·`Tex_Crow.webp` |
| `models/animals_extra/` | `Alpaca.glb`·`Bull.glb`·`Cow.glb`·`Cow_Farm.glb`·`Dolphin.glb`·`Donkey.glb`·`Fish1.glb`·`Fish2.glb`·`Fish3.glb`·`Fox.glb`·`Horse.glb`·`Horse_Farm.glb`·`Llama.glb`·`MantaRay.glb`·`Pig.glb`·`Pug.glb`·`Shark.glb`·`Sheep.glb`·`Stag.glb`·`Whale.glb`·`White_Horse.glb`·`Zebra.glb` |
| `models/animals_extra2/` | `Anglerfish.glb`·`Apatosaurus.glb`·`Armored_Catfish.glb`·`Betta.glb`·`Black_Lion_Fish.glb`·`Blobfish.glb`·`Blue_Goldfish.glb`·`Blue_Tang.glb`·`Butterfly_Fish.glb`·`Cardinal_Fish.glb`·`Clownfish.glb`·`Coral_Grouper.glb`·`Cowfish.glb`·`Flatfish.glb`·`Flower_Horn.glb`·`Goblin_Shark.glb`·`Goldfish.glb`·`Humphead.glb`·`Koi.glb`·`Lionfish.glb`·`Mandarin_Fish.glb`·`Moorish_Idol.glb`·`Parasaurolophus.glb`·`Parrot_Fish.glb`·`Piranha.glb`·`Puffer.glb`·`Red_Snapper.glb`·`Royal_Gramma.glb`·`Shark.glb`·`Stegosaurus.glb`·`Sunfish.glb`·`Swordfish.glb`·`T_Rex.glb`·`Tang.glb`·`Tetra.glb`·`Triceratops.glb`·`Tuna.glb`·`Turbot.glb`·`Velociraptor.glb`·`Worm.glb`·`Yellow_Tang.glb`·`Zebra_Clown_Fish.glb` |
| `models/standin/` | `Birb.glb`·`Demon.gltf`·`Orc.gltf`·`Pigeon.glb`·`Snake_angry.glb` (사가고에서) |

## 세 시대 손님 몸 (2026-09-24, PLAN §5.13) — 사가고·사가블로에서 복사

| 자리 | 파일 | 원본 |
|---|---|---|
| `models/foes/` | `Robot_Walker.glb` | 사가고(quaternius-showcase 미러 `cyberpunk_pack/Enemy_2Legs`, Meshopt) |
| `models/people/folk/` | `m_Worker.glb`·`m_Hoodie.glb` | 사가고(원래 사가블로 poly.pizza "Ultimate Modular Men Pack") |
| `models/monsters/` | `Ghost.glb` | 사가블로 `monsters/quaternius/Ghost_810f60a2.glb`(Ultimate Monsters) |

전부 © Quaternius, CC0 1.0. 제 클립 내장. 경위는 사가고 `assets/ASSET_LICENSES.md` "Quaternius — 세 시대 사람·적" 절.

## 신수·오마주·까치 대역 28종 — 종마다 한 벌 (2026-09-25, CHARACTER_UNIQUENESS ④)

Quaternius "Ultimate Monsters"(CC0, 사가블로 `assets/models/monsters/quaternius/` 에서 md5 그대로 복사 — 출처는 그쪽 `assets/ASSET_LICENSES.md` "Ultimate Monsters 45종" 절) 열여덟 벌을 `models/standin/<이름>.glb` 로(해시 꼬리만 뗌).

> **Elephant** (`models/standin/Elephant.glb`) — © **Poly by Google**, [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/). poly.pizza `/m/a27MA0rXyyj`, 사가블로 `models/animals/Elephant.glb` 복사. **저작자 표시 필요** — 이 문구가 그 표시다.

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
| 누렁날개·노을용·물이무기·별손님·복고양이 | Alpaking·Dragon·Snake_angry·Alien_2(두발 외계인 — 방울형 Alien 은 사가고 들판 적과 같은 파일이라 피함)·Cat(괴물 고양이) |

## 들짐승 2D 시트 여섯 — 3D 모델을 옆에서 구운 것 (2026-09-25, `assets/sprites2d/animals/`)

`wolf`·`snake`·`mushnub`·`spacebug`.png 는 각 3D 모델(Quaternius CC0 — 위 절들)을, `rabbit`·`duck`.png 는 **Poly by Google**
"Cottontail rabbit"·"Duck"(CC-BY 3.0, 위 절)을 `tools/bake-portraits/bake.mjs saga-forest --sprites=animals` 로 구운 파생 그림이다.
> **rabbit.png · duck.png** — © **Poly by Google**, [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/) 모델에서 렌더. **저작자 표시 필요** — 이 문구가 그 표시다.

## AI 생성 도감 초상 (2026-09-29)
| 항목 | 내용 |
|---|---|
| **파일** | `assets/portraits/hero/<id>_s.webp`(192×192)·`<id>_c.webp`(300×344) — 도감 105 인물 |
| **만든 법** | swbins3 로컬 sd-webui + **Animagine XL 4.0 Opt**(CreativeML OpenRAIL++-M, 상업 사용 허용) — `tools/ai-art/gen.py` → `pack_web_portraits.py` |
| **프롬프트** | 인물 이름 없이 문화·역할·성별·나이·머리·눈 묘사만 — `tools/ai-art/batches/web_heroes_105.json` |
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
