# 에셋 출처와 라이선스 (saga-story)

`PLAN.md` 부록("코드로 그리지 말고 에셋으로")이 시킨 대로, 이 폴더에 넣은
**바깥에서 가져온 에셋**의 출처와 라이선스를 여기 한곳에 적는다.
**여기 없는 파일은 이 폴더에 두지 않는다.**

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
| **받은 곳** | `saga-forest/assets/models/nature/` 에 이미 받아 둔 것을 그대로 복사했다
  (같은 CC0 라이선스이므로 재배포에 문제 없다 — 근거는 그쪽
  `ASSET_LICENSES.md` 와 `saga-go` 쪽 원본 확인 기록) |

### 넣은 파일 — PLAN 36절 Phase 2 (지형지물)

`models/nature/` — 사냥터 배경(`side-view3d.js`)의 나무·바위·먼 산이 이 GLB 로 선다.
그 전까지는 도형(원뿔·구)이었다.

| 파일 | 쓰이는 곳 |
|---|---|
| `CommonTree_1·2·3.glb` | 오림 숲(forest) 사냥터 — 가까운 나무 |
| `PineTree_1·2.glb` | 오림 숲(forest) 사냥터 — 먼 나무 |
| `Rock_1·2·3.glb` | 한중 굴혈(cave) 사냥터 — 바닥·천장 바위(종유석 자리) |
| `Mountain_1·2.glb` | 허창 들판(field)·호로곡(fire) 사냥터 — 먼 언덕 |

**아직 안 채운 것** — 불타는 골짜기(fire)의 불길·불티는 그대로 절차적 이펙트다
(모델이 아니라 색·투명도로 흔들리는 연출이라 애초에 "지형지물"이 아니다).

### 넣은 파일 — 사람 기본, Quaternius RPG Character Pack (2026-09-03)

| | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com/packs/rpgcharacters.html>) |
| **라이선스** | CC0 1.0 (재배포 자유, 표시 의무 없음) |
| **받은 곳** | `saga-forest/assets/models/people/quaternius_rpg/` 에 이미 받아 둔 것을
  그대로 복사(같은 CC0) — 자세한 사정은 그쪽 `ASSET_LICENSES.md` 참고 |
| **파일** | `models/people/quaternius_rpg/{Warrior,Ranger,Rogue,Cleric,Wizard,Monk}.glb(원래 배포된 .gltf 임베드 base64를 바이너리 .glb로 변환 — 파싱 속도·용량 개선, 2026-09-03)` |

주인공·사람 형 적이 이제 이 여섯 벌로 선다(`js/asset3d.js` 의 `HERO_RECIPES`,
공개 기본값). 파일 하나에 몸·텍스처·리깅·걷기·공격·사망 클립이 다 들어 있어
옷·머리·UAL1 몸짓이 필요 없다. 아래 옛 조합형은 `HERO_RECIPES_FALLBACK` 으로
남겨 뒀다(되돌림 자리).

### 넣은 파일 — 옛 조합형, PLAN 36절 Phase 2 (사람·짐승)

`models/people/regular/` — 지금은 표 기본이 아니다(위 QRPG 참고). 몸+옷+머리를 한
뼈대에 묶는 조합형, `js/asset3d.js` 의 `HERO_RECIPES`). saga-forest·saga-dungeon
이 이미 쓰는 그 창고에서 **실제로 쓰는 조합 넉 줄(남/여 × 평민/사냥꾼)이 필요로
하는 파일만** 추려 복사했다(전체 people/regular 폴더의 27MB가 아니라 필요한
낱장만) — 몸(Superhero_Male/Female_FullBody) · 옷(Male/Female_Peasant,
Male/Female_Ranger) · 머리(Hair_Buzzed·Long·Buns·SimpleParted)와 그 텍스처.
`models/anim/UAL1_Standard.glb` — 몸짓(걷기·맞음·가만있기) 클립, 넷이 전부 같은
뼈대라 옮겨 입히기 없이 그대로 물린다. `models/animals/` — 짐승 형 적(들개·
코끼리병)의 대역으로 saga-dungeon 의 Wolf.glb·Cow.glb 를 그대로 복사했다
(코끼리는 CC0 로 못 찾아 몸집 큰 소로 대신한다).

**무게 참고** — 사람 쪽(gltf+bin+텍스처+UAL1 애니메이션)만 약 34MB다. 사냥터에
처음 들어설 때 한 번 받고 캐시되며, saga-forest·saga-dungeon 이 이미 같은 무게를
지고 있다(이 판만의 새 결정이 아니다). GLB 를 못 받으면(느린 회선·file:// 단독판)
조용히 도형 캡슐로 남는다 — 판정은 안 바뀐다.

사람(주인공·적)의 피격 번쩍임은 GLB 로 갈리면 도형 시절의 색-보간 대신
**emissive(자체발광) 물들임**으로 바꿨다 — 옷 텍스처의 원래 색을 곱셈으로
지우지 않기 위해서다(`js/asset3d.js` 의 `ownAllMat`/`applyTint`, saga-dungeon과
같은 요령).

---

## Kenney — Roguelike/RPG Pack (`assets/sprites2d/tile_*.png`, 2026-09-04)

| 항목 | |
|---|---|
| **만든 이** | Kenney (<https://kenney.nl>) |
| **라이선스** | **CC0 1.0 Universal** (퍼블릭 도메인 헌정) |
| **저작자 표시** | 필요 없다. 그래도 적어 둔다 |
| **재배포** | 허용된다 |
| **받은 곳** | `saga-forest/assets/sprites2d/` 에 이미 받아 둔 것을 그대로 복사했다
  (같은 CC0 라이선스이므로 재배포에 문제 없다 — 그쪽 `ASSET_LICENSES.md` 와
  원본 확인 기록 참고: <https://opengameart.org/content/roguelikerpg-pack-1700-tiles>) |

**3D 사냥터 바닥·발판**(`js/side-view3d.js` 의 `rebuildStage`, PLAN 부록
"코드로 그리지 말고 에셋으로")이 여태 색 한 장(`MeshLambertMaterial({color})`)
이던 것에 이 도트그림을 얹었다. `stg.ground` 색은 그대로 재질 색으로 남아
사냥터마다(마을/들판/숲/굴혈/골짜기) 색은 갈리고, 그 위에 그림만 mood 별로
바뀐다.

| 파일 | mood | 쓰이는 곳 |
|---|---|---|
| `tile_grass.png` | `sky`(마을·들판, 기본값) | 잔디 바닥 |
| `tile_dirt.png` | `forest`(오림 숲) | 흙 바닥 |
| `tile_stone.png` | `cave`(한중 굴혈) · `fire`(호로곡) | 돌 바닥 — 골짜기는 `stg.ground`(적갈색)로 물들여 구분한다 |

`RepeatWrapping` 으로 64px 마다 한 장씩 반복한다(사람 키와 비슷한 크기).
`NearestFilter` 로 도트그림이 흐려지지 않게 했다. GLB 지형지물(나무·바위·
언덕)과 달리 이 텍스처는 순수 이미지라 `file://` 단독판에서도 그대로 뜬다
(GLB 처럼 브라우저가 막는 요청이 아니다).

---

## Quaternius — 저다각형(low-poly) 자연물 (`models/nature/`, 발밑 밀도, 2026-09-04)

| 항목 | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com>) |
| **라이선스** | **CC0 1.0 Universal** (퍼블릭 도메인 헌정) |
| **저작자 표시** | 필요 없다. 그래도 적어 둔다 |
| **재배포** | 허용된다 |
| **받은 곳** | `saga-forest/assets/models/nature/` 에 이미 받아 둔 것을 그대로 복사했다
  (같은 CC0 라이선스, 앞서 나무·바위·언덕 셋과 같은 근거) |

PLAN 6·7절("맵을 볼 때 매번 똑같은 나무만 반복", "지역별 다른 식생")에 맞춰
**발밑 밀도**를 넣었다 — 여태 배경 지형지물(나무·바위·언덕, z -80~-520)만
있고 사람이 걷는 깊이(z=0) 가까이는 빈 바닥이었다. `js/side-view3d.js` 의
`buildScenery`에 `deco()`를 새로 두어 z -30~-70 사이에 작은 식생을 흩뿌린다
(판정에 닿지 않는다 — 순수 장식).

| 파일 | 쓰이는 곳(REG 키) |
|---|---|
| `Grass_2.glb` · `Grass_Short.glb` | `grass` — 숲·마을·들판 바닥, 가장 촘촘 |
| `Flowers.glb` | `flower` — 같은 자리, 더 성기게 |
| `Bush_1.glb` · `Bush_2.glb` | `bush` — 같은 자리, 가장 성기게 |
| `Rock_Moss_1.glb` | `moss_rock` — 한중 굴혈(cave) 전용 |

호로곡(fire, 불타는 골짜기)은 원래 규칙대로 식생 없이 그대로 둔다(원래도
"에셋은 없다" 로 적힌 민둥 골짜기 컨셉과 맞는다). GLB 를 못 받으면 조용히
작은 원뿔 도형으로 남는다 — 다른 지형지물과 같은 규칙.

---

## Quaternius — 건물·소품 (`models/buildings/`·`models/props/`, 마을 정취, 2026-09-04)

| 항목 | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com>) |
| **라이선스** | **CC0 1.0 Universal** (퍼블릭 도메인 헌정) |
| **저작자 표시** | 필요 없다. 그래도 적어 둔다 |
| **재배포** | 허용된다 |
| **받은 곳** | 집·우물은 `saga-dungeon/assets/models/buildings/`, 울타리는
  `saga-forest/assets/models/props/` 에 이미 받아 둔 것을 그대로 복사했다
  (같은 CC0 라이선스) |

PLAN 3절("시작 마을 — NPC·상점·집·우물·나무·꽃·울타리·표지판")에 맞춰
`town:true` 인 사냥터(신야성·허도·강릉진·남정성·기산채) 배경에 집·우물·
울타리를 세웠다(`js/side-view3d.js`의 `house()`·`well()`·`fence()`, PLAN 부록
"코드로 그리지 말고 에셋으로"). 순수 배경일 뿐 판정에는 닿지 않는다 — 문
(portal)·발판·적 배치는 그대로다.

| 파일 | REG 키 | 쓰이는 곳 |
|---|---|---|
| `House_1~4.glb` | `house` | 마을 배경(z -200~-250), 자리마다 넷 중 하나를 고른다 |
| `Well.glb` | `well` | 마을 한가운데(z -55) 하나 |
| `Fence.glb` | `fence` | 마을 길 앞(z -22)을 따라 줄지어 선다 |

무게는 집 넷 + 우물 합쳐 약 1.5MB(울타리는 12KB) — 마을에 처음 들어설 때
한 번 받고 캐시되며, GLB 를 못 받으면 조용히 상자·원기둥 도형으로 남는다.
**퀘스트 NPC·상점 NPC 는 아직 없다** — 이번은 배경(그림)만이고, PLAN Phase 3
나머지(NPC 대화·상점·표지판)는 다음 차례다.

## 비전투 동물 (`models/animals/`, PLAN 9절, 2026-09-09)

| 항목 | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com>) |
| **라이선스** | **CC0 1.0 Universal** |
| **저작자 표시** | 필요 없다 |
| **재배포** | 허용된다 |
| **받은 곳** | `saga-forest/assets/models/animals/`에 이미 받아 둔 `Deer.glb`·
  `Fox.glb`를 그대로 복사했다(위 63행의 Wolf.glb·Cow.glb와 같은 창고) |

들판·숲(마을·굴혈·호로곡 제외)에 안 싸우는 사슴·여우를 세웠다. `side.js`는
이 존재를 모른다 — `js/side-view3d.js`의 `critterPool`이 화면 층에서만
플레이어가 다가오면 물러나고 아니면 어슬렁대게 한다.

## 보물상자 (`models/props/Chest.glb`, PLAN 11절, 2026-09-09)

| 항목 | |
|---|---|
| **만든 이** | Kay Lousberg — KayKit Dungeon Remastered |
| **라이선스** | **CC0 1.0 Universal** |
| **저작자 표시** | 필요 없다 |
| **재배포** | 허용된다 |
| **받은 곳** | `saga-dungeon/assets/models/dungeon/chest.glb`를 그대로 복사했다 |

## 배경음악 (`assets/audio/bgm/`, PLAN 34절, 2026-09-09)

다섯 판 중 이 판이 처음 BGM을 들인다 — 옮겨 올 선례가 없어 OpenGameArt.org에서
CC0(저작자 표시 불필요) 곡만 새로 찾았다. **직접 들어보고 어울리는지 판단하지
못했다** — 태그·제목으로만 골랐다, 다음 세션이 실제로 들어보고 바꿀 수 있다.

| 파일 | 곡명 | 만든 이 | 받은 곳 |
|---|---|---|---|
| `town.mp3` | Quaint Town | neonarkade | <https://opengameart.org/content/quaint-town> |
| `forest.mp3` | Peaceful forest | Samza | <https://opengameart.org/content/peaceful-forest> |
| `battle.mp3` | Battle Theme A | cynicmusic | <https://opengameart.org/content/battle-theme-a> |

셋 다 **CC0 1.0 Universal** — 저작자 표시 필요 없다, 재배포 허용된다(위
각 링크의 라이선스 아이콘으로 직접 확인했다).

## 도감 초상 3D화 — 개과(`models/animals/ShibaInu.glb`·`Husky.glb`, 2026-09-14)

| 항목 | |
|---|---|
| **만든 이** | Quaternius (poly.pizza) |
| **라이선스** | **CC0 1.0 Universal** |
| **저작자 표시** | 필요 없다 |
| **재배포** | 허용된다 |
| **받은 곳** | `saga-dungeon/assets/models/animals/`에 이미 받아 둔 `ShibaInu.glb`
  (poly.pizza `/m/y4wdQpg767`) · `Husky.glb`(poly.pizza `/m/wcWiuEqwzq`)를
  그대로 복사했다(위 174행 사슴·여우와 같은 창고) |

`js/portrait3d.js`의 `PET_MAP`에 `pt_jindo`(진돗개)→`critter:shiba`,
`pt_sapsal`(삽살개)→`critter:husky`를 얹었다 — saga-dungeon이 같은 두
GLB로 먼저 정한 짝(진돗개=시바견 체형, 삽살개="북슬북슬한 털이 가장
가까웠다")을 그대로 따른다. **발바리(`pt_pug`)는 뺐다** — 다섯 판을
다 훑어도 소형 애완견 체형 CC0 모델이 없다(있는 개는 셰퍼드~시바
체급뿐), 억지로 물리면 오히려 더 어긋나 보여 2D 도감 그림 그대로 둔다.

## Lucide — UI 아이콘 (2026-09-08, `js/icon.js`)

`saga-go`의 `js/icon.js`를 그대로 옮겨 도구줄·독·지갑 이모지를 실제 아이콘으로
갈아 끼웠다("사가스토리 UI가 사가고랑 완전히 같지 않다" 제보). SVG 자체가
파일이 아니라 `icon.js` 안에 문자열로 박혀 있다 — 출처·라이선스는
`../saga-go/assets/ASSET_LICENSES.md`의 Lucide 항목을 그대로 따른다
(Lucide, <https://lucide.dev>, **ISC**).

## MPFB2 실사 몸 20종 — 외형 다양화, 표 기본에 적용됨 (2026-09-10, `saga-go`에서 복사)

`saga-go`가 2026-09-05에 뽑아 둔 MPFB2 실사 몸 20종(`assets/models/people/
mpfb_real/{male,female,v3,v7~v23}.glb`, 각 3.5~4.3MB, 총 74MB)을 이 판에도
복사해 뒀다 — **라이선스는 CC0**(출처·재현 경위는 `saga-go/assets/
ASSET_LICENSES.md`의 "MPFB2 + makehuman_system_assets" 절 참고).

`js/asset3d.js`에 `HERO_RECIPES_MPFB`로 선언하고 **`DEFAULTS.hero`에도
얹었다**(같은 날 뒤이어 완료) — **이 판은 `side-view3d.js`가
`asset3d.buildHero()`를 실제 플레이 화면에서 살아 있게 부른다**
(saga-forest·saga-realm과 달리 죽은 자리가 아니다). 이 MPFB 몸은 제
클립이 0개라 saga-go의 리타깃 계열 함수(`firstSkinned`·`boneNameMap`·
`sceneHeight`·`retargetInto`)를 이 파일로 옮겨 오고 `buildHero()`의
`assemble()`에서 몸마다 한 번만 다시 구워 입히도록 이어 붙였다 — 뼈
길이가 다른 UAL1 몸짓을 raw로 물리면 팔다리가 뒤틀리던(saga-go가 먼저
겪은) 문제를 피한다. 이 판은 배우마다 `heightPx`(58·75.4·110.2 등)가
달라 **정규화(normalize) 전의 원본 몸을 기준으로 재고 굽는다** — 이미
정규화된 모델을 기준으로 하면 캐시가 처음 잰 배율에 고정돼 다른 배율로
부른 다음 배우가 뒤틀린다(`js/asset3d.js`의 `retargetInto` 주석 참고,
saga-forest와 다른 점 — 그 판은 hero 배율이 늘 1이라 이 문제가 없다).

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

옆면 뷰의 2D 폴백(`side-view.js` 가 `sideView3d` 를 못 쓸 때)이 부르는 `sprite.js` 의 `bake()`(`kind==='human'`)가
여태 원·선으로 절차적으로 그리던 **사람**을 이 시트에서 오려 낸 정지 그림 열넷으로 바꿨다(SAGA-DESIGN §11 Phase 2).
파일은 `saga-forest/assets/sprites2d/human_01~14.png` 와 같은 것(md5 동일)이고 자르는 좌표·표도 그쪽
`ASSET_LICENSES.md` 의 같은 절과 같다. **트레이드오프** — 인물별 색·등신·걷기 다리 애니메이션은 못 낸다(고정 그림 한 장).
인물 id 를 해시해 열넷 중 하나를 **늘 같은 얼굴로** 고르고, 좌우 뒤집기와 걸음 통통거림은 그림과 무관하게 산다.
그림이 아직 안 실린 첫 프레임만 옛 코드 그림으로 채우고 곧 다시 굽는다. 3D 옆면 뷰(`sideView3d`)와 도감 초상은 영향이 없다.

## 몬스터 2D 시트 셋 (`assets/sprites2d/mon_beast*.webp`, 2026-09-20, saga-dungeon 에서 옮김)

옆면 뷰의 2D 폴백이 짐승 형 적(들개·승냥이 → 늑대, 코끼리병 → 코끼리, 산짐승 무리 → 멧돼지)을 그리는 그림이다.
`saga-dungeon/assets/sprites2d/mon_beast.webp`·`mon_beast_big.webp`·`mon_beast_boar.webp` 와 같은 파일(md5 동일)이며, 사가블로 `bake-portraits
--sprites=monsters` 가 3D 동물 모델(`Wolf.glb` **Quaternius CC0**, `Elephant.glb`·`Boar.glb` **Poly by Google CC-BY 3.0 — 저작자 표시 필요**)을
옆모습 걷기 시트로 구운 파생물이다. **원본 모델의 라이선스가 그대로 따른다** — 출처·표시 문구는
`saga-dungeon/assets/ASSET_LICENSES.md` 의 "몬스터 2D 시트"·"짐승 형 몬스터 다양화"·"도감(펫) 초상 실사화" 절과 같다.
이 판 3D 뷰가 쓰는 `Wolf.glb`·`Cow.glb` 와는 별개로, 코끼리·멧돼지는 이 판에 GLB 가 없고 그림만 들어온다.


## 도감 펫 초상 — 실제 동물 전부, 사가블로에서 복사 (2026-09-23)

사가블로가 받아 둔 모델을 **그대로 복사**했다(재가공 없음). 출처·경위는 `saga-web/saga-dungeon/assets/ASSET_LICENSES.md`
"도감(펫) 초상"·"펫 — poly.pizza 동물 번들 셋"·"펫 2차분" 절. `js/asset3d.js` `critter:*` 로 등록, `js/portrait3d.js` `PET_MAP` 이 고른다.

| 폴더 | 파일 | 원출처 |
|---|---|---|
| `models/animals/` | `Tiger.glb`·`Bear.glb`·`Panda.glb`·`Monkey.glb`·`Boar.glb`·`Owl.glb`·`Cat.glb`·`Crane.glb`·`Koi.glb`·`Frog.glb`·`Mesh_Crow.gltf`·`Mesh_Crow.bin`·`Tex_Crow.webp` | Quaternius 계열 CC0 · 까마귀(`Mesh_Crow`)는 사가블로 문서의 표기를 따른다 |
| `models/animals_extra/` | `Alpaca.glb`·`Bull.glb`·`Cow.glb`·`Cow_Farm.glb`·`Dolphin.glb`·`Donkey.glb`·`Fish1.glb`·`Fish2.glb`·`Fish3.glb`·`Fox.glb`·`Horse.glb`·`Horse_Farm.glb`·`Llama.glb`·`MantaRay.glb`·`Pig.glb`·`Pug.glb`·`Shark.glb`·`Sheep.glb`·`Stag.glb`·`Whale.glb`·`White_Horse.glb`·`Zebra.glb` | poly.pizza 동물 번들 셋(Quaternius, CC0) |
| `models/animals_extra2/` | `Anglerfish.glb`·`Apatosaurus.glb`·`Armored_Catfish.glb`·`Betta.glb`·`Black_Lion_Fish.glb`·`Blobfish.glb`·`Blue_Goldfish.glb`·`Blue_Tang.glb`·`Butterfly_Fish.glb`·`Cardinal_Fish.glb`·`Clownfish.glb`·`Coral_Grouper.glb`·`Cowfish.glb`·`Flatfish.glb`·`Flower_Horn.glb`·`Goblin_Shark.glb`·`Goldfish.glb`·`Humphead.glb`·`Koi.glb`·`Lionfish.glb`·`Mandarin_Fish.glb`·`Moorish_Idol.glb`·`Parasaurolophus.glb`·`Parrot_Fish.glb`·`Piranha.glb`·`Puffer.glb`·`Red_Snapper.glb`·`Royal_Gramma.glb`·`Shark.glb`·`Stegosaurus.glb`·`Sunfish.glb`·`Swordfish.glb`·`T_Rex.glb`·`Tang.glb`·`Tetra.glb`·`Triceratops.glb`·`Tuna.glb`·`Turbot.glb`·`Velociraptor.glb`·`Worm.glb`·`Yellow_Tang.glb`·`Zebra_Clown_Fish.glb` | poly.pizza 물고기 대형·공룡 번들(Quaternius, CC0) |


## 신수·포켓몬 오마주 대역 모델 — 사가고에서 복사 (2026-09-23)

`models/standin/` — `Birb.glb`·`Pigeon.glb`·`Snake.glb`·`Snake_angry.glb`·`Orc.gltf`·`Demon.gltf`. 사가고 `assets/models/animals/` 의 같은 파일을
**그대로 복사**했다(출처·경위는 `saga-web/saga-go/assets/ASSET_LICENSES.md` — Quaternius CC0: 새 둘은 animals pack, 뱀 둘은 easy_enemies_pack,
Orc·Demon 은 Ultimate Monsters). 사용자 결정("사가고처럼 대역 입히기")으로 신수·오마주 도감 초상에 사가고와 같은 대역을 입히는 데만 쓴다.

## 세 시대 사람·적 — 사가고에서 복사 (2026-09-24, `models/foes/`·`models/people/folk/`, PLAN §5-12)

Quaternius CC0 1.0. 사가고 `assets/models/foes/`(7: Rat·Wasp·Zombie·Alien·Robot_Drone·Robot_Walker·Robot_Large)·
`assets/models/people/folk/`(5: m_Worker·m_Hoodie·m_SWAT·w_SciFi·s_Astronaut1)를 그대로 복사(이미 Meshopt, 제 클립 내장).
받은 곳·가공 경위는 사가고 `assets/ASSET_LICENSES.md` "Quaternius — 세 시대 사람·적" 절(사람·쥐·말벌·망자·외계는
원래 사가블로가 poly.pizza 에서 받은 것, 로봇 셋은 quaternius-showcase 미러 `cyberpunk_pack`).

## 사람 적·마을 사람 제 몸 — 사가블로에서 복사 (2026-09-25)

`models/people/fixed/` — 사가블로 `assets/models/people/` 의 hero_light 창고 파일을 **그대로 복사**했다(파일 이름 = 원래 폴더_파일).
출처·라이선스는 전부 사가블로 `assets/ASSET_LICENSES.md` 의 해당 절: `oga_ultimate_*`(Quaternius Ultimate Animated Character Pack, CC0 —
OpenGameArt), `polypizza_*`(Quaternius Ultimate Modular Men/Women·Pirate·Apocalypse·Wide 묶음, CC0 — poly.pizza), `kaykit_adventurers_*`
(KayKit Adventurers, CC0), `oga_knight_*`(Lowpoly Animated Knight, CC0). 전부 제 클립 내장. 쓰는 곳: `js/asset3d.js` FIXED_HERO.

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

## AI 생성 도감 초상 (2026-09-29)
| 항목 | 내용 |
|---|---|
| **파일** | `assets/portraits/hero/<id>_s.webp`(192×192)·`<id>_c.webp`(300×344) — 도감 105 인물 |
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

## 2D 스프라이트 시트 (`assets/sprites2d_sheets/`)

2026-10-01 자체 제작 — 공방(`tools/char-forge/gear_sprites.py`)이 CC0 VRoid 몸(`tools/char-forge/_src/cc0_vroid`) 위에 절차 생성 장비를 입혀 Blender 로 굽는다(128px·8프레임·방향 3·동작 idle/walk/attack/hit/death, WebP). 적·동료 4벌: `pool_f_demon_136`, `pool_g_orc_141`, `pool_e_goblin_126`, `pool_basef_undead_111`. 벌마다 `manifest.json` 에 몸·종류·규격·출처 문구. 원작 에셋 없음. 이 판은 아직 안 읽는다(W 티켓 — 인물·괴물 id 연결과 `sprite.js` 배선).
