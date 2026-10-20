# 에셋 출처와 라이선스 (saga-go)

> **W-0163(2026-10-11) — 빌린 동물·탈것 3D 를 지웠다.** Poly by Google(Tiger·Bear·Panda·Monkey·Boar·Owl·Crane·Elephant·Rabbit·Squirrel·Duck·Sparrow)·"Charlie" `SlimeEnemy`·Quaternius 말(Horse·White_Horse/Horse_White·Horse_Farm·Donkey·Zebra)·`Mesh_Crow` **GLB 파일은 이 판에 없다** — 게임은 자체 생성판 `saga-web/shared/assets/creatures3d/<id>.glb`(K-0096, 출처는 같은 폴더 `*.license.json`)를 쓴다(`assets3d.creatureFor`). 아래 그 모델들의 출처 표기는 **그 모델로 구웠던 2D 파생물(`beast_*.png`·스프라이트 시트 등)이 남아 있는 동안만** 유지한다 — 자체판으로 다시 구우면 지운다.
>
> **W-0194(2026-10-13) — 빌린 물고기 3D(Quaternius CC0)를 지웠다.** `animals_extra2/` 물고기 34종(Puffer 만 남김)·`animals_extra/` Dolphin·MantaRay·Shark·`animals/` Koi(1만리는 Shark·Dolphin 도) — 게임은 자체 생성판 `shared/assets/creatures3d/<id>.glb`(K-0096 ⑤)를 쓴다. 남은 빌린 물고기 = Puffer·Whale·Fish1(자체판 없음)·Fish2·Fish3(자체판이 three 에서 안 보여 `CREATURE_SKIP`, K 다시 굽기). 아래 표의 지운 파일 이름은 옛 기록이다.
> **W-0206(2026-10-14) — 남은 빌린 물고기 다섯도 지웠다.** `animals_extra/` Whale·Fish1·Fish2·Fish3·`animals_extra2/` Puffer — 게임은 자체판 `shared/assets/creatures3d/` whale·fish_a·fish_b·fish_c·puffer(K-0102·K-0096). 아래 표의 그 이름은 이력이다.

> **W-0200(2026-10-14) — 자체 생성 바위 결 한 장.** `textures/land/real_rock_512.webp`(+`.license.json`) = K-0093 자체 PBR(z-image-turbo Apache-2.0, `tools/ai-art`) 고돗 `tiles_real/rock_512.webp` 복사 — 3D 가까운 땅 결(밝기만). 바깥 에셋 아님.

새 `PLAN.md` **8절**이 시킨 대로, 이 폴더에 넣은 **바깥에서 가져온 에셋**의 출처와
라이선스를 여기 한곳에 적는다. **여기 없는 파일은 이 폴더에 두지 않는다.**

이 저장소는 공개다(<https://github.com/smh80602070-spec/swbins>). 그래서 재배포가
허용되지 않는 에셋은 애초에 받지 않는다.

**폴리곤 수·텍스처 실측 크기·용량 같은 기술 값은 여기 안 적는다** — `SAGA WEB.md`
16절 형식 그대로 `ASSET_CATALOG.md`가 따로 갖고 있다. 여기는 출처·라이선스만.

---

## Quaternius — 저지대 다각형(low-poly) 묶음

> W-0322 — 이 절의 `Grass_2`·`Blacksmith`·`Tower`·`PointyTower`·`LargeTower`·`Watchtower`·`LargeSquareTowerBricks`·`Inn`·`Well`·`MarketStand_1`·`Bridge`·`Mine`·`Gazebo`·`Arch`·`WoodenTorch`·`Rice_4`·`Temple`·`Wall`·`Mountain_1`·`Mountain_2` 는 지웠다(자체 world3d 짝, K-0126). 남은 파일만 아래 출처가 해당한다.

| 항목 | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com>) |
| **라이선스** | **CC0 1.0 Universal** (퍼블릭 도메인 헌정) |
| **저작자 표시** | 필요 없다. 그래도 적어 둔다 — 예의이고, 나중에 출처를 다시 찾을 때 필요하다 |
| **재배포** | 허용된다 (CC0 는 조건이 없다) |
| **받은 곳** | <https://github.com/trebeljahr/quaternius-showcase> `public/glb/` (GLB 미러) |

### 라이선스를 무엇으로 확인했나

Quaternius 원 사이트(`quaternius.com`)는 이 망에서 안 열린다. 그래서 **CC0 라고
못박아 둔 다른 미러**로 확인했다:

- <https://github.com/weftspun/quaternius-stage> — 저장소 라이선스가 **CC0-1.0**,
  README 첫 줄이 *"OpenUSD (.usda) copy of [Quaternius](https://quaternius.com)
  CC0 low-poly packs"*
- <https://github.com/Malcolmnixon/Quaternius-Modular-Scifi-Pack> 등 여러 이식본이
  모두 저장소 라이선스로 **CC0-1.0** 을 달고 있다

**받아 온 미러(`trebeljahr/quaternius-showcase`) 자신의 `LICENSE` 는 MIT 인데,
그것은 그 저장소의 데모 코드에 걸린 것이고 모델에 걸린 것이 아니다.** 모델의
라이선스는 위의 Quaternius 배포 조건(CC0)이다. 헷갈리기 쉬운 자리라 적어 둔다.

### 넣은 파일

`models/nature/` — 소품. `js/prop3d.js` 가 `InstancedMesh` 로 세운다

| 파일 | 쓰이는 곳 |
|---|---|
| `CommonTree_1·2·3.glb` | 나무 (봄·여름) |
| `CommonTree_Autumn_1·2.glb` | 나무 (가을) — `season.js` 가 철을 정한다 |
| `CommonTree_Snow_1·2.glb` | 나무 (겨울) |
| `PineTree_1·2.glb` | 침엽수 |
| `Rock_1·2·3.glb` | 바위 |
| `Grass_2.glb` · `Bush_1·2.glb` | 풀덤불 · 갈대 자리 |

`models/animals/` — 배우. `js/asset3d.js` 표에 적혀 있다

| 파일 | 쓰이는 곳 |
|---|---|
| `Deer.glb` | 사슴 (`animal.js` 의 `deer`) |
| `Wolf.glb` | 늑대 (`wolf`) |
| `Cow.glb` | 소 (`ox`) |
| `Koi.glb` | 잉어 (`carp`) — `cute_fish_pack` 에서. 헤엄·튀어오름 여섯 클립 |
| `Pigeon.glb` · `Birb.glb` | **까치** (`magpie`) — 아래 "같은 날 조금 더 뒤" 절 참고, 2026-09-07에 바뀌었다 |

셋 다 뼈대 애니메이션을 열두어 개씩 들고 있다(Idle · Walk · Gallop · Eating …).
`asset3d.js` 의 `mapClips` 가 이름을 씻어 자리에 맞춘다.

**2026-09-07 — 도감 펫(`js/data.js` 의 `PETS`, 41종) 3D 확장.** 여태 도감 펫은
들짐승 다섯 종(사슴·늑대·소·잉어·까치) 모델을 형태(`form`)별로 돌려 썼다 —
말·두꺼비·용 형태는 대응 모델이 없어 전부 사슴 모습이었다. 같은 미러
(`trebeljahr/quaternius-showcase`, CC0)에서 열여섯 종을 더 받아 채웠다:

| 파일 | 형태(`pet:form:*`) | 어느 묶음에서 |
|---|---|---|
| `Alpaca.glb`·`Bull.glb`·`Donkey.glb`·`Fox.glb`·`Husky.glb`·`ShibaInu.glb`·`Stag.glb` | `quad` (네발 짐승, 기존 사슴·늑대·소와 섞어 쓴다) | `animals_pack` |
| `Horse.glb`·`Horse_White.glb` | `horse` (적토마·절영) | `animals_pack` |
| `Frog.glb` | `toad` (두꺼비) | `easy_enemies_pack` |
| `Trex.glb`·`Triceratops.glb`·`Stegosaurus.glb`·`Velociraptor.glb` | `dragon` (청룡·누렁날개·노을용·물이무기) — CC0 용 모델이 없어 파충류로 가장 가까운 공룡으로 대신했다 | `dinosaurs_pack` |
| `Shark.glb`·`Dolphin.glb`·`Manta_ray.glb` | `fish` (잉어와 섞어 쓴다) | `fish_pack` |

**같은 날 조금 뒤 — 오우거 형태(`pet:form:ogre`) 채움.**

| 항목 | |
|---|---|
| **원본** | Quaternius `Ultimate Monsters` 팩 (<https://quaternius.com/packs/ultimatemonsters.html>) |
| **라이선스** | **CC0** — 원본 페이지·독립된 배포 소개(itch.io·gamedev 블로그)에서 "50 fully animated monsters, free for personal and commercial use, CC0"로 확인 |
| **받은 곳** | <https://github.com/511action/descent-3d-assets> `models/` — 원본은 FBX/OBJ/Blend 인데, 이 저장소가 이미 glTF 로 구워 올려 뒀다(저장소 설명 자체가 "CC0 monster models (Quaternius Ultimate Monsters pack, public domain)") |
| **넣은 파일** | `Orc.gltf`·`Demon.gltf`·`BlueDemon.gltf` — 셋 다 같은 뼈대(Idle·Walk·Run·Punch·Death·HitReact 등 14클립), 사람 모양이라 도깨비·어둑귀 같은 오우거 형태 펫에 사슴보다 훨씬 잘 맞는다 |

이 환경엔 Blender 가 없어 원본(FBX)을 직접 구울 수 없었다 — 이미 glTF 로
구워 올려 둔 미러를 썼다(사가만리 8절 "Photoshop/Blender 없이" 원칙과 같은 결).

**같은 날 조금 더 뒤 — 거북 형태(`pet:form:turtle`)까지 채워 일곱 형태
전부(quad·bird·fish·horse·toad·dragon·ogre) 실제 모델이 섰다.** 처음엔
사용자가 poly.pizza 에서 받아 준 정지 모델(Poly by Google → Polygonal
Mind, 둘 다 CC0/CC-BY 이지만 클립이 없었다)을 썼는데, **poly.pizza·
Quaternius·OpenGameArt·Kenney 를 다 뒤져도 리깅된 거북을 못 찾았다**
(등딱지가 표준 리그 틀에 안 맞아서인 듯). 사용자가 "꼭 거북 모양일 필요
없다, 움직이는 게 낫다"고 정해 **뱀으로 바꿨다** — 현무가 애초에 신화에서
"거북과 뱀"을 합친 신수라 결이 어긋나지 않는다.

| 항목 | |
|---|---|
| **파일** | `Snake.glb` · `Snake_angry.glb` (색만 다른 두 벌 — 섞어서 조금 갈린다) |
| **원본** | Quaternius `easy_enemies_pack` — 위 "Quaternius — 저지대 다각형 묶음" 절과 같은 CC0 |
| **클립** | `Idle`·`Walk`·`Attack`·`Jump` 넷 — 실제로 움직인다 |

**같은 날 조금 더 뒤 — 까치(`pet:an_magpie`·`pet:form:bird`)도 정지에서
애니메이션 있는 것으로 바꿨다.** 배경 짐승 넷(사슴·늑대·소·잉어)은 전부
애니메이션이 있는데 까치만 정지 모델(Poly by Google `Crow`, CC-BY)이었던
불균형이기도 했다. Quaternius 가 만든 작은 새 두 벌(poly.pizza CC0)로 갈았다.

| 항목 | |
|---|---|
| **파일** | `Pigeon.glb` · `Birb.glb` |
| **원본** | Quaternius, poly.pizza 경유 — `<https://poly.pizza/m/9NGlBTpDEr>` · `<https://poly.pizza/m/gZ2ExU9OAB>`, **CC0**(Public Domain) |
| **클립** | `Idle`·`Walk`·`Jump`·`Death`·`HitRecieve`·`Bite_Front`·`Dance`·`Yes`·`No` 아홉 — 원래 까치보다 훨씬 잘 움직인다 |

**이걸로 `Crow`(까치)·`Turtle`(거북) 두 CC-BY/정지 모델은 이 폴더에서 빠졌다
— 이 저장소에 CC-BY 자산이 더 이상 없다.**

`models/buildings/` — 마을은 `js/prop3d.js` 가 `InstancedMesh` 로,
**역참·성채는 `js/asset3d.js` 가 배우로** 세운다. 같은 파일이 양쪽에 걸려 있다

| 파일 | 쓰이는 곳 |
|---|---|
| `House_1·2·3·4.glb` · `Blacksmith.glb` | 민가 (`prop3d` 의 `house`) |
| `Tower.glb` · `PointyTower.glb` · `LargeTower.glb` · `Watchtower.glb` · `LargeSquareTowerBricks.glb` | 마을의 높은 집 (`prop3d` 의 `tower`) |
| `Inn.glb` | **역참** (`asset3d` 의 `station`) · 2D 지도 마커 `sprites2d/building_Inn.png`(이 모델을 `tools/bake-icons` 로 구운 파생 그림, 같은 CC0) |
| `Watchtower.glb` | **성채 1등급 · 보(堡)** (`asset3d` 의 `fort:t1`) |
| `Tower.glb` · `PointyTower.glb` | **성채 2등급 · 진(鎭)** (`fort:t2`) |
| `LargeTower.glb` · `LargeSquareTowerBricks.glb` | **성채 3등급 · 웅진(雄鎭)** (`fort:t3`) |
| `Well.glb` | **우물** (`prop3d` 의 `well`) — 마을 칸에 드물게(14%) 세운다 |
| `MarketStand_1.glb` | **장터 좌판** (`prop3d` 의 `market`) — 마을 칸에 드물게(10%) 세운다 |

**`Inn.glb` 는 마을 목록에서 뺐다.** 그 여관이 이제 역참이다 — 마을에도 같은 여관이
서면, 들판에서 여관 모양을 보고 역참인 줄 알고 걸어갔다가 그냥 남의 집이 된다.

**우물·장터를 `house` 표에 섞지 않은 까닭.** `prop3d` 는 무엇이든 **키 1 로 눕히고**
(`normalize`) 세우는 쪽이 배율을 준다. 그런데 원본 키가 여관 3.49m · 우물 1.25m ·
좌판 1.05m 로 **셋에 하나까지 차이 난다** — 한 줄에 섞으면 우물이 여관만 해진다.
**키가 비슷한 것끼리만 한 줄에 묶는다** — `well`·`market` 을 `house`·`tower` 와
나란한 제 이름으로 따로 두고, `p.h` 도 1.2~1.3m 로 작게 준다(2026-08-29).

**받아 온 탑·여관에는 깃발이 없다.** 도형으로 세우던 역참에는 노란 깃발이,
성채에는 세력 빛깔 배너가 달려 있었고 **그것이 멀리서 알아보는 유일한 표식**이었다.
그대로 갈아 끼우면 성채가 어느 세력인지 화면에서 사라지므로, `asset3d.markOf` ·
`addMark` 가 깃발만 다시 얹는다(손잡이 `asset3d.mark` 를 0 으로 내리면 안 얹는다).

`models/props/` — **손으로 그린 땅**(`land.js`)의 것들. `js/prop3d.js` 가 세운다.
여태 코드가 상자·원뿔을 쌓아 만들던 자리다(사용자 방침: "스크립트로 그리는 것은 다 에셋으로")

| 파일 | 쓰이는 곳 | 어느 묶음에서 |
|---|---|---|
| `Bridge.glb` | **다리** — 한 칸짜리라 일곱을 이어 강(48m)을 건넌다 | `modular_medieval_buildings_pack` |
| `Mine.glb` | **굴 입구** (광산 어귀) | `real_time_strategy_pack` |
| `Gazebo.glb` | **옛 사당** (정자) | `medieval_village_pack` |
| `Arch.glb` | **폐허** (무너진 아치) | `modular_dungeon_1` |
| `WoodenTorch.glb` | **등롱** — 불은 코드가 얹는다(밤에만 켜야 한다) | `survival_pack` |
| `Rice_4.glb` | **벼** — 논 위에 심는다. 논바닥·두렁은 코드가 깐다 | `crops_pack` |
| `Temple.glb` · `Wall.glb` | 아직 안 걸었다 — 사당·폐허의 다른 후보 | `real_time_strategy_pack` |

`models/nature/` 에 **산봉우리**도 더했다 — `Mountain_1.glb` · `Mountain_2.glb`
(`real_time_strategy_pack`). 여태 원뿔 하나였다.

**허수아비만 CC0 로 못 찾았다.** 미러 1545 개를 다 훑어도 없다 —
그 자리는 코드가 그대로 그린다(장대 + 가로대 + 삿갓).

`models/people/` — **옛 인물 표(Knight · King · Casual · Farmer · Worker · Lady,
`modular_men`/`modular_women` 팩)는 2026-08-29 에 통째로 걷어 냈다.** 걷는 동안
몸이 갈라지는 근본 원인(부위마다 뼈대가 따로였다)이 그 팩 자체의 설계였다 —
아래 새 팩으로 갈아 끼웠다.

---

## Quaternius — RPG Character Pack (2026-09-03, 사람 기본, `models/people/quaternius_rpg/`)

| | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com/packs/rpgcharacters.html>) |
| **라이선스** | CC0 1.0 (재배포 자유, 표시 의무 없음) |
| **받은 곳** | 팩 페이지의 구글드라이브 링크(zip 직링크 없음, 사용자가 직접 받음) — 자세한
  사정은 `saga-forest/assets/ASSET_LICENSES.md` 와 [[saga-forest-hero-fallback-fix]] 참고,
  같은 여섯 파일을 그대로 복사해 왔다 |
| **파일** | `Warrior.glb`·`Ranger.glb`·`Rogue.glb`·`Cleric.glb`·`Wizard.glb`·`Monk.glb`(원래 배포된 .gltf 임베드 base64를 바이너리 .glb로 변환 — 파싱 속도·용량 개선, 2026-09-03) |

아래 조합형(몸+옷+머리)이 그림체가 밋밋하다는 지적에 사람 기본을 이걸로 바꿨다.
`js/asset3d.js` 의 `HERO_RECIPES`(공개 기본값, 인물 여섯 벌)가 이 파일들을 가리킨다.
파일 하나에 몸·텍스처·리깅에 더해 걷기·달리기·공격·피격·구르기·사망 클립까지
전부 들어 있어 옷·머리·UAL 몸짓이 필요 없다. 아래 조합형은 지우지 않고
`HERO_RECIPES_FALLBACK` 으로 남겨 뒀다(되돌림 자리, `register('hero', ...)` 로
되돌릴 수 있다).

---

## Quaternius — 사람 창고 셋, 옛 조합형 (`models/people/regular/` · `models/anim/`)

**2026-08-29, 몸이 갈라지던 문제를 근본에서 없애려고 갈아 끼웠다.** 옛 `modular_men`/
`modular_women` 팩은 부위(몸통·머리·다리)마다 뼈대가 **따로** 붙어 있어, 몸짓을
옮겨 입혀도 뼈대 하나만 움직이고 나머지는 제자리에 남아 걷는 동안 찢어졌다
(세 겹으로 고쳐 봤지만 실기기에서 끝내 못 잡았다 — `SAGA-HANDOFF.md` 참고).

새 셋은 **몸(Universal Base Characters) · 옷(Modular Character Outfits - Fantasy) ·
몸짓(Universal Animation Library)** 이 뼈 이름·순서(65개)까지 한 글자도 안 다르게
같은 뼈대로 나온다(직접 대조했다) — 옷·머리를 몸의 뼈대에 그대로 `bind()` 하면
되고, 리타기팅이 아예 필요 없다.

| 항목 | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com>) |
| **라이선스** | **CC0 1.0 Universal** (퍼블릭 도메인 헌정) — 세 팩 다 `License.txt` 에 명시 |
| **저작자 표시** | 필요 없다. 그래도 적어 둔다 |
| **재배포** | 허용된다 |
| **받은 곳** | itch.io — `quaternius.itch.io/universal-base-characters` ·
  `quaternius.itch.io/universal-animation-library` ·
  `quaternius.itch.io/modular-character-outfits-fantasy` (셋 다 `[Standard]` 무료 등급.
  `quaternius.com` 이 이 망에서 직접 열려 itch.io 페이지까지 갔다 — 예전 세션이
  적어 둔 "GitHub 미러만 열린다" 는 이제 안 맞는다) |

### 넣은 파일 — **텍스처는 BaseColor 만** 골라 넣었다

이 판의 재질(`asset3d.delam`)은 GLB 를 받는 순간 PBR 을 벗겨 **빛깔(BaseColor)만
남기고 Lambert 로 갈아 끼운다** — Normal·Roughness·ORM 맵은 애초에 안 쓴다. 그래서
원본 zip 에서 그 셋을 빼고 받았다(`Peasant` 한 벌만 해도 Normal 14MB·ORM 9.9MB를
아꼈다) — `.gltf` 의 `materials[].normalTexture`·`.occlusionTexture`·
`.pbrMetallicRoughness.metallicRoughnessTexture` 를 지우고 그 이미지 파일은
아예 옮기지 않았다(GLTFLoader 는 참조가 없으면 그 이미지를 안 받는다).

`models/people/regular/` (한 폴더 — `.gltf` 는 같은 폴더의 파일을 이름으로 부르므로
흩어 두면 안 된다)

| 파일 | 쓰이는 곳 |
|---|---|
| `Superhero_Male_FullBody.gltf`·`.bin` | 남자 몸(얼굴·눈·눈썹 포함) — Universal Base Characters |
| `Superhero_Female_FullBody.gltf`·`.bin` | 여자 몸 |
| `Male_Peasant.gltf`·`.bin` · `Female_Peasant.gltf`·`.bin` | 평민 옷(팔·몸통·다리·발) — Modular Character Outfits - Fantasy |
| `Male_Ranger.gltf`·`.bin` · `Female_Ranger.gltf`·`.bin` | 순찰대 옷 |
| `Hair_Buzzed`·`Hair_Beard`·`Hair_Long`·`Hair_Buns`·`Hair_SimpleParted`·`Hair_BuzzedFemale` (각 `.gltf`+`.bin`) | 머리 — "Rigged to Head Bone" 판(머리뼈에 물려 애니메이션을 따라간다) |
| `T_Superhero_Male_Dark.webp`·`T_Superhero_Female_Dark_BaseColor.webp` | 몸 살빛 |
| `T_Peasant_BaseColor.webp`·`T_Ranger_BaseColor.webp` | 옷감 |
| `T_Regular_Male_Dark_BaseColor.webp`·`T_Regular_Female_Dark_BaseColor.webp` | 옷 밖으로 나온 손·팔 살빛(옷 쪽 재질이 이걸 쓴다 — 몸 쪽 살빛과 톤만 맞추면 되므로 옷이 몸을 그대로 덮는다) |
| `T_Hair_1_BaseColor.webp`·`T_Hair_2_BaseColor.webp` | 머리카락·눈썹(몸 파일의 눈썹도 이 둘을 같이 쓴다) |
| `T_Eye_Brown.png` | 눈동자(256² — 그대로 뒀다) |

**2026-09-04: 이 여덟 장을 WebP로 다운스케일했다.** `ASSET_CATALOG.md`를
쓰다가 실측해 보니 옷감 둘(`Peasant`·`Ranger`)이 **4096×4096 PNG**였다 —
`SAGA WEB.md` 19절이 못박은 "4K 텍스처 금지"에 정면으로 걸린다. 옷감은
2048로, 나머지(몸 살빛·손팔 살빛·머리)는 2048 원본을 1024로 낮추고
WebP(q82)로 다시 구웠다 — 8장 합계 **19.4MB → 0.38MB(98% 감소)**.
지금은 화면에 안 나오는 되돌림 전용 자리지만, 다음에 표 기본으로
되돌아갈 때 이미 규격 안이 되도록 미리 손봤다. `.gltf` 12개의
`images[].uri`·`mimeType`만 고쳤다(정점 데이터는 그대로).

`models/anim/UAL1_Standard.glb` — **몸짓 마흔한 벌**(idle·walk·jog·sprint·roll·
sword_attack·hit·death…). `_RM`(root motion 포함) 이 아니라 **기본판**을 받았다 —
루트 모션이 있으면 애니메이션 자체가 캐릭터를 밀어서 이 판이 좌표로 옮기는 것과
겹친다. 이미지가 없어(도형 확인용 메시 하나뿐) 그대로 통째로 받았다.

`js/asset3d.js` 의 `HERO_RECIPES_FALLBACK` 이 몸·옷·머리 조합 여섯 벌(남 셋·여 셋)을
인물 id 해시로 나눠 준다(지금은 표 기본이 아니다 — 위 RPG Character Pack 참고).
그 위에 `asset3d.tintOf` 가 세력 빛깔을 입힌다(QRPG 몸에도 같이 걸린다).

---

## Poly by Google — 까치(`Crow`) · 거북(`Turtle`) — 2026-09-07 자로 폐기됨

이 폴더에 한동안 CC-BY 3.0 인 Poly by Google `Crow`(까치, 정지 모델)와
`Turtle`(거북, 정지 모델)이 있었다 — 위 도감 펫 절의 "같은 날 조금 더 뒤"에
적었듯, 움직이는 CC0 대체(까치→Quaternius `Pigeon`/`Birb`, 거북→Quaternius
`Snake`/`Snake_angry`)를 찾아 둘 다 빼냈다. **이 저장소에 지금은 CC-BY
자산이 없다.** 되돌릴 일이 있으면 이 절의 과거 버전(git 이력)을 참고할 것.

---

## UI 아이콘 — 자체(W-0321)

도구줄·독 아이콘 28은 자체 그림 `assets/icons/icon64/ui_<이름>_g0.png`(K-0118, 출처 `shared/assets/icons/license/`). 예전 Lucide(ISC) SVG 는 지웠다.

## EverFace — 초상 "진지한" 얼굴 (`assets/sprites2d/portrait/serious/`) — **10-16 W-0259 지움(코드 참조 0)**

| 항목 | |
|---|---|
| **만든 이** | Efilheim |
| **라이선스** | **CC0** |
| **저작자 표시** | 필요 없다 |
| **재배포** | 허용된다 |
| **받은 곳** | <https://opengameart.org/content/everface> (`everface1.0.png`, 432×24, 24×24 초상 18장) |

`portrait3d.js` 가 인물 id 해시로 열여덟 장 중 하나를 고른다(`recipe().serious`).
아래 "귀여운" 조합형과 달리 **한 장을 그대로 쓴다** — 층층이 쌓지 않는다.
파일 이름은 `face_00.png` ~ `face_17.png`(시트를 24px 씩 그대로 자른 것).

## nonemo's Character Pack — 초상 "귀여운" 얼굴 (`assets/sprites2d/portrait/cute/`) — **10-16 W-0259 지움(코드 참조 0)**

| 항목 | |
|---|---|
| **만든 이** | nonemo (<https://nonemo.itch.io>) |
| **라이선스** | **CC0** |
| **저작자 표시** | 필요 없다(있으면 반갑다고 적혀 있다) |
| **재배포** | 허용된다 |
| **받은 곳** | <https://nonemo.itch.io/character-creation-asset-pack> — itch.io 가 이 망에서
  막혀 있어 **사용자가 직접 받아 전달**했다 |

원본 팩은 머리·피부·표정·옷·바지까지 다 갖춘 훨씬 큰 팩이다. 초상은 가슴 위만
담으므로(도감 카드 규격) **옷·바지·안경·수염은 빼고** 다음만 옮겼다 —
수염을 얹어 보니 아기 얼굴에 털만 붙은 꼴이라 뺐다(2026-09-02):

| 폴더 | 옮긴 것 |
|---|---|
| `skin/tint_1·2·3/head.png` | 피부색 셋 |
| `hairs/front/{chupchik,curly,elegant}.{아홉 빛깔}.png` | 앞머리 세 모양 × 아홉 빛깔 |
| `hairs/back/{curly,long}.{아홉 빛깔}.png` | 뒷머리 두 모양 × 아홉 빛깔 |
| `faces/{smile,willing,cute,laughs,gloating}.png` | 표정 다섯 |

`portrait3d.js` 가 인물 id 해시로 이 넷(피부·뒷머리·표정·앞머리 순으로 겹친다)을
골라 합친다. 손잡이 `portrait3d.cute` 를 1 로 올려야 이 조합이 나온다(기본은
EverFace).

## Kenney — Roguelike Characters Pack (`assets/sprites2d/human_*.png`, 2026-09-10)

| 항목 | |
|---|---|
| **만든 이** | Kenney (<https://kenney.nl>) |
| **라이선스** | **CC0 1.0 Universal** (퍼블릭 도메인 헌정) |
| **저작자 표시** | 필요 없다. 그래도 적어 둔다 |
| **재배포** | 허용된다 |
| **받은 곳** | `saga-forest/assets/sprites2d/human_*.png`에서 그대로 복사(선례,
  2026-09-02) — 원 출처는 <https://kenney.nl/assets/roguelike-characters>,
  `kenney_roguelike-characters.zip` 안 `Spritesheet/roguelikeChar_transparent.png`.
  같은 CC0 파일을 다섯 판 사이 재사용하는 것은 이미 있던 관례다(`saga-dungeon`
  게시판·우편함 하드링크 절 참고) |

**2026-09-10, 사용자 요청("2D 모드 캐릭터를 실제 에셋으로")**으로 2D 지도
화면의 **사람**(`sprite.js` 의 `bake()`, `kind==='human'`)이 도형으로 절차적으로
그리던 것을 이 시트에서 오려 낸 정지 초상 그림으로 바뀌었다. 3D 전환이 끝난
판이라 이 2D 화면은 **저사양 폴백/2D 모드 전용**이다 — 조우·전투·초상(이미
`portrait3d.js`)에는 안 닿는다.

**트레이드오프를 saga-forest 선례와 똑같이 그대로 적는다** — 이 그림은 인물마다
다른 색(세력색·옷·계절 물듦)·등신 4단계·그림 양식 3가지·다리 걷기 애니메이션을
못 낸다(고정 그림 한 장이라). 인물 id 를 해시해 열넷 중 하나를 **늘 같은
얼굴로** 고른다. 좌우 뒤집기(`stamp()` 의 `ctx.scale(-1,1)`)와 걸음
통통거림(bounce)은 그림과 무관하게 그대로 산다. 스폰(조우 대상)의 등급은
발밑 고리 색으로 이미 따로 표시되므로(`drawSpawn`) 몸 색을 잃어도 등급 구분은
남는다.

파일 이름·시트 좌표는 saga-forest 문서(같은 파일, `human_01.png` ~
`human_14.png`)와 완전히 같다 — 다시 적지 않는다.

## 효과음 — 자체(K-0117, W-0321) (`assets/audio/sfx/`)

효과음 7(`discover`·`encounter_win`·`hit`·`levelup`·`panel_open`·`reward`·`thunder`.mp3)은 자체 소리로 같은 이름을 덮어썼다(K-0117 — 자체 효과음 ogg 를 mp3 로, 천둥은 코드 합성). 출처 정본 `saga-assets/sfx/web-mp3/<이름>.license.json`. 예전 OpenGameArt "RPG Sound Pack"·"100 CC0 SFX #2" 조각은 남지 않았다.

---

## MPFB2 + makehuman_system_assets — 사람 캐릭터 실사화 (2026-09-05, QRPG에 추가 변형으로 통합됨)

다섯 판 어디서도 못 뚫었던 "사람 지오메트리 실사화"(Mixamo 재배포 금지·CC0
대안은 애니메이션 0개, 위 HANDOFF 참고)를 **CC0 완제품이 아니라 CC0 도구로
직접 뽑아서** 처음 뚫었다. 남녀 각 한 벌(`assets/models/people/mpfb_real/
male.glb`·`female.glb`, 512px 텍스처로 최적화, 각 3.9~4.1MB)을
`js/asset3d.js`의 `DEFAULTS.hero`(`HERO_RECIPES`)에 **QRPG 여섯 종에 더한
추가 변형으로** 올렸다 — QRPG(전사·궁수·도적·성직자·마법사·수도승, 각자
클립 보유)를 대체하지 않고 그대로 둔 채 여덟 벌 중 두 벌이 됐다. 완전
대체는 QRPG의 직업별 시각 다양성을 잃는 트레이드오프라 사용자 판단이
필요했는데, 몸이 옷·머리 없이 두 벌뿐이라 **완전 대체보다 추가가 더 안전한
선택**이었다.

**`assets/models/_mpfb_test/`(빌드 스크립트·`.blend`·`.glb`·스크린샷)는
이 저장소에 커밋하지 않았다** — 작업 뒤 지웠다, 로컬에도 없다. 최종 GLB
둘만 `assets/models/people/mpfb_real/`에 커밋돼 있다. 아래 "재현 스크립트"
절이 처음부터 다시 뽑을 때 필요한 전체 파이썬 코드를 그대로 들고 있다 —
재현하려면 그 코드를 파일로 저장해 `blender --background --python
build_character.py -- male`(또는 `female`)로 돌리면 된다.

| | |
|---|---|
| **도구** | MPFB2(makehumancommunity.org) — 코드 GPLv3, Blender 확장. 이 PC에
  이미 깐 채로 다음 세션이 재사용할 수 있다(`%APPDATA%\Blender Foundation\Blender\5.2\extensions\`) |
| **번들 에셋** | `makehuman_system_assets_cc0.zip`(267MB) — **CC0**. `files2.makehumancommunity.org`
  에서 받았다(피부·머리·눈썹·눈썹속눈썹·눈·이·혀·옷) |
| **뼈대** | MPFB의 `game_engine` 리그 프리셋 — `Root`→`root`, `head`→`Head`
  두 곳만 대소문자를 고치면 게임의 `assets/models/anim/UAL1_Standard.glb`
  (Quaternius, UE 마네킹 명명)와 53/53 뼈 이름이 그대로 겹친다 |
| **뽑은 조합** | 남 = `young_asian_male` 피부 + `short01` 머리 + `male_casualsuit01` 옷,
  여 = `young_asian_female` 피부 + `long01` 머리 + `female_casualsuit01` 옷
  (둘 다 `eyebrow001`·`eyelashes01`·`low-poly` 눈·`teeth_shape01`·`tongue01`) |

### 2026-09-05 세션이 마저 잡은 버그 둘

지난 세션이 남긴 "머리카락·얼굴 깨짐"·"팔이 안 움직인다" 둘 다 **리깅
자체가 아니라 코드 두 곳**이 원인이었다(직접 재현해 찾았다):

1. **`js/asset3d.js` `buildHero()`가 조합형 몸(제 클립이 없어 `ANIM_SRC`를
   빌리는 몸)에 UAL1의 원본 클립을 리타깃 없이 그대로 물리고 있었다.**
   `ANIM_SRC`(UAL1) 클립은 뼈마다 **position까지** 매 프레임 굽는데, 이걸
   raw로 물리면 이 몸의 뼈 길이가 UAL1의 것으로 매 프레임 덮어써진다 —
   뼈 이름·비례가 UAL1과 완전히 같은 옛 Quaternius 조합형에서만 우연히
   맞았을 뿐, 실제 인체 비례로 뽑은 MPFB 몸에서는 팔다리가 뒤틀렸다.
   `retargetInto()`(이미 있던 리타깃 함수, 476행)로 다시 굽도록 고쳤다 —
   위치는 이 몸의 것을 그대로 지키고 회전만 세계 좌표로 옮겨 입으므로
   뼈 길이가 달라도 맞는다. 몸마다 한 번만 굽도록 `parts.body.heroClips`
   에 캐싱한다.
2. **`retargetInto()`가 만드는 애니메이션 클립의 트랙 이름이
   `.bones[뼈이름].quaternion` 식(스켈레톤 상대 주소)인데, three의
   `AnimationMixer`는 이 형식을 뿌리가 SkinnedMesh 자신일 때만 푼다** —
   이 창고는 어디서든 `new AnimationMixer(model)`의 `model`이 SkinnedMesh를
   감싼 Group이라 뼈까지 못 내려가 **에러도 없이 조용히 얼어붙는다**. 이게
   "팔이 T자로 안 움직인다"의 진짜 원인이었다(다리도 같은 매커니즘으로
   깨져 있었어야 정상인데, 지난 세션은 옛 raw 클립 경로로 다리만 우연히
   맞았던 걸 "다리는 된다"로 오인했다). 뼈 이름은 장면 전체에서 유일하므로
   `뼈이름.quaternion`평범한 이름으로 바꿔 주면 Group 뿌리에서도 먹힌다 —
   이 수정은 `retargetInto()` 자체에 있어 마을 사람 등 다른 배우의
   리타깃에도 함께 적용된다(전에는 그쪽도 조용히 안 움직이고 있었을
   가능성이 있다 — 확인 못 함, 다음 세션이 마을 사람도 볼 것).
3. **머리카락·눈썹·피부의 "얼굴이 깨진다"는 Blender 5.x glTF 익스포터가
   더 이상 `Material.blend_method`를 안 본다**("Alpha mode is determined
   by the nodes too" — 익스포터 소스 주석). MPFB가 물려 주는 Alpha 입력은
   텍스처 알파를 그대로 잇기만 해서 익스포터가 못 알아보고 전부
   `alphaMode:BLEND`로 떨어졌다(직접 확인) — three는 투명 오브젝트를
   **오브젝트 단위로만 정렬**해서, 머리카락·눈썹처럼 겹친 BLEND 메시가
   그리는 순서가 어긋나 "대머리로 보이고 입 주변에 붉은 텍스처"로 보였다.
   내보내기 직전 파이썬으로 Alpha 입력 앞에 `Math: Greater Than`(문턱
   0.5) 노드를 끼워 넣으면 익스포터가 그 패턴을 **알파 클립**(정렬이
   필요 없는 `alphaMode:MASK`)으로 알아본다 — 여덟 재질 전부 이렇게
   고쳤다(피부의 눈·입 구멍도 원래 이 방식의 알파컷이라 스킨도 예외가
   아니다).

### 버그 4 (같은 날 이어서 고침) — 옷을 입히면 걷는 동안 손·발이 소매·바지 끝에서 떨어진다

버그 1~3을 고친 뒤 실기(headless) 렌더로 다시 보니, 맨몸(피부+머리만)은
걷기 자세가 완전히 정상인데 옷(`male_casualsuit01`)을 입힌 순간만 소매·
바지 끝과 손·발 사이에 눈에 띄는 간격이 생겼다. **원인**: MPFB의
`HumanService.add_mhclo_asset()`는 옷·머리·눈·이·혀를 basemesh에 그냥
OBJECT 부모로만 붙이고 **뼈 가중치를 아예 안 만든다** — 직접 확인
(`Human.male_casualsuit01`의 `vertex_groups`가 0개, `Human`은 205개).
`Armature` 모디파이어도 없이 `Subdivision`만 있으니, 걷는 동안 몸은
스키닝으로 변형되지만 옷은 바인드 포즈에 그대로 얼어붙어 손발이 소매
끝을 앞질러 나간 것처럼 보였다(휴식 자세에선 우연히 안 보였을 뿐).

**시도 1(실패)**: 몸의 가중치를 옷으로 최근접 표면 보간(`Object > Data
Transfer`, `vert_mapping='POLYINTERP_NEAREST'`)으로 옮겼더니 사타구니·
겨드랑이처럼 몸의 서로 다른 부위가 가까이 붙는 자리에서 **최근접 탐색이
반대쪽으로 건너뛰어** 엉뚱한 뼈에 가중치가 잡히고, 다리·팔을 벌리면
거대한 삼각형 "날개"로 늘어났다. `'POLYINTERP_VNORPROJ'`(법선 투영)로
바꿔도 자리만 바뀌어(겨드랑이→엉덩이 쪽으로 스파이크) 근본 문제는
그대로였다 — 둘 다 **몸 표면에서 최근접점을 찾는 방식이라 옷과 무관한
몸의 다른 부위를 건너뛸 수 있다**는 게 공통 결함이었다.

**시도 2(성공)**: Blender 자체의 "Automatic Weights"(뼈 열확산,
`bpy.ops.object.parent_set(type='ARMATURE_AUTO')`, GUI로는 `Object >
Parent > With Automatic Weights`)로 바꿨다 — 이건 **옷 메시 자신의
연결된 표면 안에서만** 열확산 방정식을 풀어 뼈마다 가중치를 매기므로,
소매·바지단처럼 닫힌(연결된) 통 모양이면 몸의 다른 부위로 새어 나갈
수가 없다. 걷기 사이클 네 지점(t=0.15/0.45/0.75/1.05)을 실제 게임
리타깃 코드로 렌더해 날개·간격 둘 다 없는 걸 확인했다.

**곁가지 문제**: 자동 가중치는 머리카락(`short01`)에서 "Bone Heat
Weighting: failed to find solution for one or more bones" 경고와 함께
완전히 실패했다(열확산이 안 붙는 얇고 동떨어진 캡 모양이라 그런 듯 —
정확한 원인 미확인) — glTF 익스포터가 "has no skin, skipping"으로
넘겨서 스킨 자체가 안 실렸다(버그 4의 첫 증상과 같은 종류: 가중치가
아예 없어 뻣뻣하게 얼어붙는 것). 머리카락·눈썹·속눈썹·눈·이·혀는 애초에
변형될 필요가 없는(머리와 함께 강체로만 움직이면 되는) 부위라, 이런
것들은 열확산 대신 **`Head` 버텍스 그룹 하나에 가중치 1.0을 직접
줘서** 고쳤다(옷처럼 다중 뼈 변형이 필요한 것만 자동 가중치를 쓴다).

### 재현 스크립트 (`assets/models/_mpfb_test/build_character.py`, 커밋 안 함 — 여기 전문을 남긴다)

```python
import bpy, os, sys

bpy.ops.wm.read_factory_settings(use_empty=True)
from bl_ext.user_default.mpfb.services.humanservice import HumanService

GENDER = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'male'
D = r"C:\Users\Windows\AppData\Roaming\Blender Foundation\Blender\5.2\extensions\.user\user_default\mpfb\data"

if GENDER == 'female':
    skin = D + r"\skins\young_asian_female\young_asian_female.mhmat"
    hair = D + r"\hair\long01\long01.mhclo"
    clothes = D + r"\clothes\female_casualsuit01\female_casualsuit01.mhclo"
else:
    skin = D + r"\skins\young_asian_male\young_asian_male.mhmat"
    hair = D + r"\hair\short01\short01.mhclo"
    clothes = D + r"\clothes\male_casualsuit01\male_casualsuit01.mhclo"

eyebrow = D + r"\eyebrows\eyebrow001\eyebrow001.mhclo"
eyelash = D + r"\eyelashes\eyelashes01\eyelashes01.mhclo"
eyes = D + r"\eyes\low-poly\low-poly.mhclo"
teeth = D + r"\teeth\teeth_shape01\teeth_shape01.mhclo"
tongue = D + r"\tongue\tongue01\tongue01.mhclo"

basemesh = HumanService.create_human(scale=0.1)
HumanService.set_character_skin(skin, basemesh, skin_type="GAMEENGINE")

for mhclo, atype in [
    (eyes, "Eyes"), (eyebrow, "Eyebrows"), (eyelash, "Eyelashes"),
    (teeth, "Teeth"), (tongue, "Tongue"),
    (hair, "Hair"), (clothes, "Clothes"),
]:
    HumanService.add_mhclo_asset(mhclo, basemesh, asset_type=atype)

armature = HumanService.add_builtin_rig(basemesh, "game_engine")

bpy.context.view_layer.objects.active = armature
bpy.ops.object.mode_set(mode='EDIT')
for b in armature.data.edit_bones:
    if b.name == 'Root':
        b.name = 'root'
    elif b.name == 'head':
        b.name = 'Head'
bpy.ops.object.mode_set(mode='OBJECT')

# 버그 3(머리카락·얼굴 깨짐) 고치기 — Blender 5.x 익스포터는 알파모드를
# 셰이더 노드로 판정한다. 텍스처 알파를 그대로 잇기만 한 배선은 다
# alphaMode:BLEND로 떨어져 정렬이 어긋난다 — 알파클립 노드를 끼워 MASK로.
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf:
        continue
    alpha_in = bsdf.inputs.get('Alpha')
    if not alpha_in or not alpha_in.is_linked:
        continue
    src_socket = alpha_in.links[0].from_socket
    clip = nt.nodes.new('ShaderNodeMath')
    clip.name = clip.label = 'AlphaClip'
    clip.operation = 'GREATER_THAN'
    clip.inputs[1].default_value = 0.5
    nt.links.new(src_socket, clip.inputs[0])
    nt.links.new(clip.outputs[0], alpha_in)

# 버그 4(옷이 몸을 안 따라감) 고치기 — 옷은 자동(뼈 열확산) 가중치,
# 변형이 필요 없는 부위(머리카락·눈썹·속눈썹·눈·이·혀)는 Head에 강체 고정.
rigid_to_head = set()
for p in (eyes, eyebrow, eyelash, teeth, tongue, hair):
    rigid_to_head.add('Human.' + os.path.splitext(os.path.basename(p))[0])

for o in list(bpy.data.objects):
    if o.type != 'MESH' or o is basemesh:
        continue
    if any(m.type == 'ARMATURE' for m in o.modifiers):
        continue
    if o.name in rigid_to_head:
        vg = o.vertex_groups.new(name='Head')
        vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE')
        mod = o.modifiers.new('Armature', 'ARMATURE')
        mod.object = armature
        mod.use_vertex_groups = True
        continue
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

bpy.ops.wm.save_as_mainfile(filepath=r"...\char_{0}.blend".format(GENDER))
out = r"...\char_{0}.glb".format(GENDER)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type in ('MESH', 'ARMATURE'):
        o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_apply=True)
```

내보낸 뒤 `npx @gltf-transform/cli resize char_male.glb char_male.512.glb
--width 512 --height 512`(원본 2048×2048·18~20MB → 512×512·약
3.9~4.1MB)로 줄이고, `assets/models/people/mpfb_real/male.glb`(또는
`female.glb`)로 옮기면 끝이다.

### 2026-09-05(이어서) — 마을 사람 다양성 늘리기(3벌 추가, 4벌 중 하나는 새 버그로 뺌)

사용자가 "다양성부터 늘리기"를 확정해 위 남녀 두 벌에 더 얹었다. 옷
라이브러리엔 판타지 갑옷·로브가 없어(현대 정장류뿐, `clothes/` 폴더
확인 — 캐주얼/엘레강트/스포츠 정장과 페도라뿐이다) QRPG 직업 교체용은
아니고, 그냥 실사 인물 표본을 넓히는 것이다.

처음 넷을 뽑았다: `middleage_african_male`+`afro01`+`male_worksuit01`,
`young_caucasian_female`+`ponytail01`+`female_elegantsuit01`,
`old_asian_male`+`short02`+`male_casualsuit03`,
`young_caucasian_female2`+`bob01`+`female_sportsuit01`. 실제 게임
리타깃 코드(간이 확인 페이지로 UAL1 클립을 `retargetInto()`와 같은
방식으로 입혀 헤드리스 크롬 스크린샷)로 넷 다 확인했더니 **셋에서
눈가가 빨갛게 깨지는 새 버그**가 나왔다 — `young_caucasian_female`·
`young_caucasian_female2`·`old_asian_male` 피부 전부. `middleage_african_male`
(넷 중 하나, 이번에 처음 써 본 피부)만 멀쩡했다.

**원인은 뒤이은 세션이 확정했다(`HANDOFF.md` "캐릭시안/노년 아시아 '눈가
빨갛게' 원인 확정" 절 참고) — 코드 버그가 아니다.** MakeHuman 스킨 텍스처는
실물 얼굴 사진이라 눈 부위에 눈동자·눈꺼풀이 이미 사실적으로(붉은기 포함)
그려져 있는데, 게임은 눈알을 별도 3D 메시로 얼굴 위에 얹는 구조라 텍스처의
"가짜 눈"과 실제 눈알이 겹쳐 보인다 — 이건 모든 스킨에 다 있는 현상이고,
저 세 스킨은 사진 속 눈이 유난히 사실적·고대비라 겹침이 두드러질 뿐이다.
알파모드·노드 배선은 두 경우(정상/버그) 사이에 완전히 같았다(GLB를 직접
파싱해 확인). 고치려면 문제 스킨의 눈 UV 영역을 피부색으로 덮어 칠하는
이미지 편집이 필요하다 — 아직 안 함, 지금은 이 스킨들을 안 쓰는 것으로
피한다.

버그를 피해 안전이 확인된 계열(`young_asian_*`, `middleage_african_male`)
쪽으로 둘을 더 뽑아 최종 셋을 실었다:

| key | 피부 | 머리 | 옷 |
|---|---|---|---|
| `mpfb_v3` | `middleage_african_male` | `afro01` | `male_worksuit01` |
| `mpfb_v7` | `young_african_female` | `braid01` | `female_casualsuit02` |
| `mpfb_v8` | `old_african_male` | `short03` | `male_casualsuit04` |

셋 다 헤드리스 크롬으로 확인(휴식·걷기 자세 모두 정상, 옷 가중치·
머리 강체 고정·알파클립 다 문제없었다). **아시아·아프리카 피부 계열만
안전이 확인된 상태다 — 캐릭시안·노년 아시아 계열은 위 눈 버그를 고치기
전엔 더 안 뽑는다.** `js/asset3d.js`의 `HERO_RECIPES`에 추가 변형으로
등록해(QRPG 여섯 종은 그대로) 총 열한 벌이 됐다. `_test.html`의
"인물 N 벌이 갖춰져 있다" 자가진단도 11로 갱신(421/423 3회 동일,
남은 둘은 무관한 기존 하늘 테스트). 실기기 확인은 못 했다.

### 2026-09-05(더 이어서) — 뺐던 캐릭시안·노년 아시아 스킨 셋을 눈 마스킹으로 마저 뽑음

`HANDOFF.md`가 확정한 원인(코드 버그 아님 — MakeHuman 스킨 사진에 눈이
이미 그려져 있어 3D 눈알과 겹쳐 보이는 것) 그대로, **문제 스킨 셋의
diffuse 텍스처에서 눈 UV 영역만 이미지 편집으로 지웠다.**

**방법**: `python`/`python3`는 이 PC에서 Windows Store 스텁이라 못 쓴다
(`py` 런처도 없음) — 대신 **Blender 5.2 자체 Python**을 썼다
(`blender --background --python script.py`, `bpy.data.images.load()` →
`image.pixels` 직접 조작). 세 스킨(`young_caucasian_female`·
`young_caucasian_female2`·`old_asian_male`) 다 **같은 베이스 메시·같은
UV 레이아웃**을 쓰므로(직접 크롭해 확인 — 세 텍스처 다 2048×2048, 눈이
정확히 같은 픽셀 자리에 있었다) 좌표 하나를 셋에 그대로 재사용할 수
있었다. 얼굴 UV 아일랜드는 "귀-눈-코입-눈-귀-턱"이 세로로 이어진
한 조각이라(머리 가죽을 정수리부터 뒤로 갈라 펼친 모양) 눈이 정확히
두 자리(위쪽 눈, 아래쪽 눈)뿐이었다 — 처음엔 얼굴 사진이 "3"자 모양으로
세 번 겹친 걸로 착각했으나(전체 텍스처 맵에서 얼굴이 차지하는 조각이
크고 좌우 대칭이라 그렇게 보인다), 실제로 눈이 있는 곳은 두 곳뿐이었다.

원본 2048×2048 픽셀 좌표(위쪽 눈 중심 `(1690, 970)`, 아래쪽 눈 중심
`(1690, 1132)`, 각각 rx=65·ry=40 타원)에 **테두리 바깥쪽 픽셀 색을
평균해** 채움색으로 삼고, 타원 경계에서 1.5배 반경까지 `smoothstep`
으로 알파를 0까지 페더링해 칠했다 — 하드 엣지·패치 자국이 안 보이게.
눈썹 라인은 타원 반경을 눈두덩이만 딱 덮게 잡아 최대한 보존했다(일부
스킨은 원래 눈썹이 연해서 약간 옅어지긴 했으나 눈에 띄지 않는다).

원본 파일(MPFB 확장 데이터, `%APPDATA%\Blender Foundation\Blender\5.2\
extensions\.user\user_default\mpfb\data\skins\<스킨>\`)을 스크래치패드에
`.orig`로 백업한 뒤 마스킹된 PNG로 덮어썼다 — **이 저장소 밖의 파일이라
git엔 안 잡힌다.** 다음 세션이 같은 스킨으로 다시 뽑을 일이 있으면
이미 마스킹된 텍스처를 쓰게 된다(원본 미가공 사진이 필요하면 지금은
백업이 없으니 makehuman_system_assets_cc0.zip을 다시 받아야 한다).

**export**: 위 재현 스크립트(`build_character.py`)를 스킨·머리·옷을
인자로 받게 일반화해(`build_character2.py`, 로직은 완전히 같음)
원래 처음 뽑았던 조합 그대로 셋을 다시 만들었다: `young_caucasian_female`
+`ponytail01`+`female_elegantsuit01`(`mpfb_v9`), `old_asian_male`+
`short02`+`male_casualsuit03`(`mpfb_v10`), `young_caucasian_female2`+
`bob01`+`female_sportsuit01`(`mpfb_v11`). `gltf-transform resize`로
512×512까지 줄여 3.8~4.1MB — 기존 v3/v7/v8과 같은 크기대다.

**검증**: Blender EEVEE로 각 캐릭터를 직접 렌더(카메라를 머리 높이에
맞춰 자동 배치)해 눈으로 확인 — 셋 다 빨간 눈가 없이 자연스럽게
나왔다(스크린샷은 이 세션 스크래치패드에만 남기고 커밋 안 함). 마스킹
경계도 렌더에서 안 보였다. `js/asset3d.js`의 `HERO_RECIPES`에 셋을
더 얹어(QRPG 6 + MPFB 실사 8) **총 열네 벌**이 됐고, `_test.html`의
"인물 N 벌이 갖춰져 있다" 진단도 14로 갱신, `sw.js` → `go-v5.20.1`.
자가진단 423/423 3회 동일(회귀 없음, near 패널 좌표 지터만 다름).
실기기 확인은 여전히 못 했다.

### 2026-09-05(또 이어서) — 남은 MPFB 스킨 열두 종을 예방적 마스킹으로 마저 뽑음

"이건 사실 모든 스킨에 다 있는 현상"이라는 결론에 따라, 빨간기가 실제로
보이든 안 보이든 아직 안 쓴 스킨 열두 종 전부에 같은 눈 마스킹을 선적용하고
export했다 — `middleage_african_female`·`middleage_asian_female`·
`middleage_asian_male`·`middleage_caucasian_female`·`middleage_caucasian_male`·
`old_african_female`·`old_asian_female`·`old_caucasian_female`·
`old_caucasian_male`·`young_african_male`·`young_caucasian_male`·
`young_caucasian_male2`. `toon01`(비실사)과 `_special_suit` 계열 둘
(캐릭시안 남/녀 각 1, 의상 특화 변형이라 다양성 목적에 안 맞음)은 뺐다.

**좌표 재검증**: 열두 개를 무작정 같은 좌표로 밀어붙이기 전에 인종·연령이
갈리는 셋(`middleage_asian_male`·`old_african_female`·
`young_caucasian_male2`)을 먼저 크롭해 눈 위치를 직접 봤다 — 지난번
셋과 완전히 같은 UV 레이아웃, 같은 좌표 `(1690,970)`·`(1690,1132)`가
그대로 맞았다. 나머지 아홉도 같은 좌표로 일괄 마스킹했다(원본은 전부
스크래치패드에 `.orig`로 백업 후 AppData 설치 데이터를 직접 덮어씀 —
저장소 밖이라 git엔 안 잡힌다, 세션 끝나면 백업도 사라진다).

**머리·옷 조합**(모두 `build_character2.py`로 export, `gltf-transform
resize` 512×512 → 3.6~4.3MB, 기존 v3~v11과 같은 크기대):

| 스킨 | 머리 | 옷 | 파일 |
|---|---|---|---|
| middleage_african_female | bob02 | female_casualsuit01 | v12.glb |
| middleage_asian_female | short04 | female_casualsuit02 | v13.glb |
| middleage_asian_male | short01 | male_casualsuit02 | v14.glb |
| middleage_caucasian_female | long01 | female_elegantsuit01 | v15.glb |
| middleage_caucasian_male | short02 | male_casualsuit05 | v16.glb |
| old_african_female | braid01 | female_sportsuit01 | v17.glb |
| old_asian_female | bob01 | female_casualsuit01 | v18.glb |
| old_caucasian_female | ponytail01 | female_casualsuit02 | v19.glb |
| old_caucasian_male | short03 | male_casualsuit06 | v20.glb |
| young_african_male | afro01 | male_worksuit01 | v21.glb |
| young_caucasian_male | short04 | male_elegantsuit01 | v22.glb |
| young_caucasian_male2 | long01 | male_casualsuit01 | v23.glb |

머리·옷 라이브러리가 한정적이라(머리 10종·여성용 옷 4종·남성용 옷
6종) 몇몇 조합은 기존 여덟 벌과 같은 부품을 재사용했다 — 스킨 자체가
다 다르므로 캐릭터는 여전히 다 갈린다. `young_caucasian_male2`에
`long01`(원래 여성형 실루엣에 가까운 긴 머리)을 썼더니 렌더에서 남성
캐릭터가 다소 여성스러워 보이는데, 이건 머리 라이브러리 자체의 한계다
(다양성 목적엔 문제없다고 판단해 그대로 뒀다).

**검증**: 열두 개 다 export·리사이즈까지 마쳤고, 그중 일곱 개
(`v12`·`v14`·`v16`·`v17`·`v19`·`v20`·`v23` — 인종·연령·성별을 고루
커버)를 Blender EEVEE로 렌더해 직접 확인 — 전부 빨간 눈가 없이
자연스러웠다. `js/asset3d.js`의 `HERO_RECIPES`에 열두 개를 더 얹어
(QRPG 6 + MPFB 실사 20) **총 스물여섯 벌**이 됐다.

**부가로 잡은 진단 버그**: `_test.html`의 "인물이 여섯 벌의 몸을 나눠
입는다" 테스트가 `Object.keys(seen).length === A.DEFAULTS.hero.length`로
70명 전원이 고른 몸이 **풀 전체를 하나도 안 빠뜨리고 다 커버해야** 통과였다
— 풀이 작을 때(6~14벌)는 70명이면 거의 항상 다 걸렸지만, 스물여섯 벌로
늘리고 나니 확률상(70명/26벌, 기대 미사용 개수 ≈1.8개) 하나가 실제로 안
걸려 422/423으로 깨졌다. **코드 버그가 아니라 테스트의 암묵적 가정이 깨진
것** — id 해시 자체는 여전히 결정적이고 골고루 퍼진다. 완전 커버리지
대신 "풀 크기 − 5 이상 걸림"(직접 측정 25/26, 여유 있게 통과하되 해시가
고장나 하나로 뭉치는 실제 회귀는 여전히 잡는다)으로 완화하고 제목도
"여섯 벌"(이미 8·11·14벌이 되고도 안 고쳐졌던 옛 이름)에서 일반화했다.

`sw.js` → `go-v5.21.0`. 자가진단 423/423 3회 동일(회귀 없음, near 패널
좌표 지터만 다름). 실기기 확인은 여전히 못 했고, 열두 개 중 다섯 개
(`v13`·`v15`·`v18`·`v21`·`v22`)는 렌더 확인을 안 했다(export·리사이즈는
다 됐다 — 눈으로 보고 싶으면 위 표로 스킨·머리·옷을 알 수 있으니 필요할
때 렌더하면 된다).

### 밟은 함정 (다시 겪지 않도록)

- **`ExportService.create_character_copy(basemesh, ...)`를 쓰지 말 것.**
  MPFB는 옷·머리·눈을 basemesh의 자식으로 붙이고 `add_builtin_rig`가
  basemesh를 다시 아마추어의 자식으로 만드는데(2단 부모),
  `create_character_copy`는 바로 아래 자식만(재귀 없이) 복제해 옷·머리가
  통째로 빠진다. 대신 `bpy.data.objects`에서 MESH 전부 + 아마추어를
  직접 선택해 `export_scene.gltf(use_selection=True, export_apply=True)`
- **Blender 4.4+의 새 Action(레이어) API에서 `action.fcurves`가 없어졌다**
  (`AttributeError`) — 클립이 애니메이션을 실제로 갖고 있는지 확인하려면
  `bpy.data.actions`를 파고들지 말고 **glTF 파일 자체를 gltf-transform 등
  으로 까 보는 쪽**이 버전에 안 흔들린다
- **파일이 크면(20MB대) 헤드리스 크롬이 진짜 느리다** — 위 HANDOFF의
  120초 조언은 여전히 유효하다. 이번엔 그 위에 헤드리스 인스턴스를 여럿
  겹쳐 띄우면(이전 인스턴스가 안 끝난 채 새로 띄우면) 소프트웨어 렌더
  경합으로 같은 페이지가 어떤 때는 4초, 어떤 때는 몇 분씩 걸리는 것도
  겪었다 — 스크린샷이 안 나오면 먼저 겹쳐 뜬 헤드리스가 없는지 볼 것
- **`--virtual-time-budget`가 붙은 헤드리스 크롬에서 `requestAnimationFrame`
  기반 폴링 루프는 딱 한 번만 돈다.** `setTimeout`은 가상 시간을 정확히
  따라가는데(직접 재 봄 — 5초짜리 `setTimeout`이 가상 시간 8초 예산
  안에서 정확히 발동했다) `requestAnimationFrame`은 실제 페인트에
  묶여 있어 가상 시간이 흘러도 두 번째 프레임이 안 온다 — 로딩 중
  스크린샷을 확인하는 테스트 페이지는 rAF 재귀 폴링이 아니라 `setTimeout`
  폴링을 써야 한다(안 그러면 "로딩 중" 그대로 찍힌 스크린샷만 계속
  나오는데, 정작 `--dump-dom`으로 보면 페이지 자체는 멀쩡히 다 실행된
  뒤라 원인을 오인하기 쉽다)
- **`DG.asset3d.register(key, recipe)`에 조합 객체(`{key,body,...}`)를
  줄 때 배열로 감싸지 않으면 `oneOf()`가 `list.length`가 `undefined`인
  일반 객체를 "빈 배열"로 오인해 조용히 `null`을 돌려준다** — 문자열
  URL이나 배열만 받는 함수라 `register('hero:x', {...})`가 아니라
  `register('hero:x', [{...}])`로 감싸야 한다(둘 다 에러 없이 그냥
  아무것도 안 뜬다 — 헤드리스로 원인 찾을 때 `window.onerror` 하나만
  걸어 두면 이런 조용한 실패는 안 잡히니, HUD 텍스트에 `assetState`를
  직접 찍어서 확인하는 편이 낫다)
- **`_test.html`의 "인물 N 벌이 갖춰져 있다" 자가진단이 `DEFAULTS.hero`
  개수(옛 6)와 각 레시피의 모양(`(outfit&&hair)||anim` 필수)을 하드
  코딩하고 있었다** — 새 레시피를 추가하면 이 테스트가 반드시 깨진다
  (직접 겪음: 421/423 → 420/423). 몸만 있고 outfit·hair·anim이 다 없는
  레시피(ANIM_SRC를 빌리는 새 MPFB 조합)도 유효하다는 걸 테스트 조건에
  추가해 8벌 기준으로 갱신했다 — **`HERO_RECIPES`를 늘릴 때마다 이
  테스트도 같이 봐야 한다**는 걸 여기 적어 둔다

## Vitruvian Project + Mesh2Motion — 사진측량 실사 인물 첫 벌 (2026-09-06, `models/people/vitruvian/`)

| 항목 | |
|---|---|
| **몸(스캔 메시·텍스처)** | Vitruvian Project — CC0 1.0 Universal (itch.io `withinamnesia/vitruvian-project-cc0`) |
| **리그·애니메이션** | Mesh2Motion (mesh2motion.org) — MIT(도구) + CC0(제공 스켈레톤·애니메이션 라이브러리) |
| **저작자 표시** | 필요 없다(둘 다 CC0/MIT). 그래도 출처를 적어 둔다 |
| **재배포** | 허용된다 |
| **넣은 파일** | `vitruvian_v1.glb` — 몸 African 스킨(얼굴·몸통·팔) + Mesh2Motion Human 스켈레톤(28본) + 자체 애니메이션 6종(Fighting_Idle·Walk·Run_Female·Sword_Attack·Hit_Chest·Death_A) |

**만든 방법**: `VitruvianProject142.blend`(3.7만 정점 원본을 약 9%로 데시메이트) +
4K 텍스처 zip에서 뽑은 BaseColor를 Mesh2Motion에 올려 자동 리깅한 뒤, 어깨·팔꿈치·
손·엉덩이·무릎·발 관절을 손으로 맞추고 CC0 애니메이션 라이브러리(162종 중 6개,
Mixamo 안 거침)를 얹어 export했다.

**다리 피부색 불일치 — 2026-09-06에 고침**: Vitruvian 4K/8K 텍스처 zip 어디에도
African Legs BaseColor가 없어서(Face·Torso·Arms만 있다) 다리만 범용 Utility
텍스처를 썼던 것이 몸통보다 밝게 튀었다. 코드가 아니라 **텍스처 자체를
고쳤다** — 다리 JPEG의 평균 RGB를 Torso·Arms African 텍스처 평균에 맞춰
채널별로 스케일(곱)했다(`r×0.41 · g×0.33 · b×0.30`, 어둡거나(<12) 밝은(>248)
이상치 픽셀은 평균 계산에서 뺐다 — 세부 음영·주름 텍스처는 그대로 두고
전체 톤만 옮기는 색 전이). glTF BIN 청크에서 이 이미지가 **맨 끝**이라 다른
bufferView 오프셋을 하나도 안 건드리고 그 뒤 바이트만 갈아 끼웠다. 실제
화면(`_demo.html#people`)으로 앞뒤를 비교해 다리·몸통이 이제 같은 톤으로
보이는 것을 확인했다. 원본 자료(`.blend`·텍스처 zip)는
`assets/_wip/vitruvian-test/README.md`에 실제 디스크 경로가 남아 있다.

**게임 코드에 문 자리**: `js/asset3d.js`의 `HERO_RECIPES` — `key: 'vitruvian_v1'`,
QRPG와 같은 결로 `anim`을 `body`와 같은 파일로 줘(제 클립을 그대로 쓴다) 리타깃이
필요 없다. 클립 이름이 `mapClips()`의 idle·walk·run·attack·hit·death 키워드에
그대로 걸리는 것을 헤드리스로 확인했다(`glb-inspect` 임시 스크립트로 애니메이션·
스켈레톤 28본을 직접 읽음 — three.js 없이 GLB 바이너리 JSON 청크만 파싱).

**이 파이프라인을 더 쓸지**: 인물 한 벌당 관절 맞추기가 수작업(5~10분)이라
대량 생산엔 안 맞는다. "이 캐릭터만은 꼭 실사로" 싶은 한둘에 쓰는 게 현실적 —
다음에 더 뽑을지는 그때 다시 판단한다.

## 도감 펫 초상 — 이미 있는 들짐승 다섯 종을 형태별로 재사용 (2026-09-05)

새 파일은 하나도 안 받았다 — **표(`asset3d.js` `DEFAULTS`) 등록만 늘렸다.**

`portrait3d.js`(초상을 실제 모델로 굽는 자리)는 `hero`만 가리고 `pet`은 아예
막고 있었다 — 사가나락·사가종횡는 진작 pet도 굽는데 이 판만 빠져 있었다
(코드 감사로 드러남). 막힌 문은 열었지만, **정작 도감 펫(`pt_*`·`pk_*`)을
가리키는 GLB가 표에 하나도 없었다** — 위 `pet:an_deer` 등 다섯 줄은
`animal.js`의 **배경 들짐승**(잡는 대상이 아니다) 전용이라 도감 펫과 id가
안 겹친다.

**사용자 지시** — "초상화를 더 가져올 수 있나 맞출 필요 없이 있으면 교체
하거나 하면 됨, 구지 캐릭터에 맞출 필요 없음." 그래서 새로 구하러 가지 않고
**이미 라이선스가 있는 다섯 종을 `pet:form:*`로 돌려 쓴다**(`beastFormOf()`가
매기는 quad·bird·fish·turtle·dragon·horse·toad·ogre 여덟 형태 중 실제로
있는 셋만 맞춰 걸고, 나머지 다섯 형태는 마지막 `pet` 한 줄로 다 같이 받는다):

**(2026-09-05 당시 기록 — 이제 낡았다.** 그때는 `quad`·`bird`·`fish` 셋만
채워지고 나머지 다섯 형태는 사슴류로 떨어졌다. **2026-09-07에 나머지 다섯
(`horse`·`toad`·`dragon`·`ogre`·`turtle`)까지 전부 채워 여덟 형태 중 실제
있는 일곱 — `turtle`은 뱀으로 대신했으므로 정확히는 `beastFormOf()`가
매기는 형태 그대로가 아니라 결이 통하는 대타다 — 어디에도 사슴 대타가
안 남았다.** 지금 표는 위 "도감 펫 3D 확장" 절 참고, 여기 아래 표는
지우지 않고 역사로 남긴다.)**

| 형태(form) | 실제 모델(2026-09-05 당시) | 비고 |
|---|---|---|
| `quad`(제일 많다) | Deer·Wolf·Cow 셋을 섞어 씀(`oneOf()`가 id 해시로 고정 배정) | 해태·백호·구미호·호랑이·곰·판다 등 |
| `bird` | Mesh_Crow(까치, 지금은 Pigeon·Birb로 바뀜) | 삼족오·주작·학·까치·올빼미 |
| `fish` | Koi(잉어) | 잉어 |
| 그 외(`turtle`·`dragon`·`horse`·`toad`·`ogre`) | 마지막 `pet` 한 줄(Deer·Wolf·Cow) | 당시엔 대응 CC0 없음 — 지금은 다 채워짐(위 절 참고) |

모양이 원래 뜻과 안 맞는 자리가 많았다(거북 도감에 사슴이 뜨는 식) — 갓·투구를
대역으로 쓴 다른 판들과 같은 판단이다: **사람이 그린 그림보다 실제 모델이
우선**이라는 게 사용자 지시다.

## 아직 안 가져온 것 — 왜 안 가져왔나

- **허수아비.** Quaternius 미러 1545 개를 다 훑어도 없다. 그 자리는 코드가 그대로
  그린다(장대 + 가로대 + 삿갓)
- **인물 일흔의 초상 일러스트.** 애초에 존재하지 않는다 — 관우·이순신·세종의
  그림을 CC0 로 받아 올 곳이 없다. 그래서 **이미 가진 인물 GLB 를 오프스크린으로
  렌더해 초상을 굽는다**(`js/portrait3d.js`). 코드가 그린 그림이 아니라 에셋으로
  만든 그림이고, 덤으로 지도 위의 그 사람과 도감의 그 사람이 같아졌다
- **동양풍 건물.** 없다. 받을 수 있는 CC0 건물은 전부 유럽 중세다.
  **사용자가 그것을 알고 품질을 먼저 골랐다**(2026-08-28) — 그래서 얹었다.
  되돌리려면 손잡이 `prop3d.house` 를 0 으로 내리면 기와지붕 코드로 돌아간다

## VRM 애니메 아바타 (2026-09-20, saga-forest 에서 옮김)

`assets/models/people/anime/avatar_{sample_a,sample_b,sample_c,custom_01}.glb` —
VRoid Studio 공식 CC0 샘플 AvatarSample_A/B/C(github.com/madjin/vrm-samples,
저작권 포기·상업 이용 무료·표시 의무 없음) + 이 저장소가 GUI 자동화로 새로
빚은 avatar_custom_01(라이선스는 상업 이용 허가 CC BY로 내보냄). 넷 다
`saga-forest/assets/ASSET_LICENSES.md`의 같은 절과 같은 파일(md5 동일) —
자세한 출처·내보내기 경위는 그쪽 문서 참고. `js/asset3d.js`의
`HERO_RECIPES_ANIME`(기본 꺼짐, `world3d.animeAvatar` 손잡이)로만 쓰인다.

---

## 이 폴더에 절대 넣지 말 것

- **원작사(포켓몬GO · 디아블로 · 동물의숲 · 메이플스토리 · 삼국지)의 실제 에셋.**
  이 저장소는 문법만 따르고 그림은 스스로 구한다 — 루트 `CLAUDE.md` 참고
- 라이선스가 불분명한 것. "무료" 는 라이선스가 아니다
- 저작자 표시가 **필수**인 것(CC-BY 등)을 표시 없이

## VRM 애니메 아바타 가공 (2026-09-20)

`assets/models/people/anime/avatar_*.glb` 넷은 `tools/glb-compress/vrm-slim.mjs` 로 **가공한 파일**이다 —
표정 모프 타깃(54~57개)을 떼고 같은 재질 프리미티브를 합쳤다(정점·뼈·재질·텍스처는 그대로, 용량 25MB → 11MB,
캐릭터당 드로우콜 90~135 → 14~19). 다섯 판 복사본은 같은 파일(md5 동일)이다.

## 짐승 2D 그림 (`assets/sprites2d/beast_*.png`) — 2026-10-16 자체 렌더로 다시 구움(K-0114)

`beast_*.png` 111장 중 103장은 자체 `shared/assets/creatures3d` 몸을 Blender 로 구운 그림(`saga-assets/sprites2d-creatures/beast`)으로 바뀌었다. 출처·도구·모델은 맨 아래 "자체 산출 사본 (자동)" 절과 정본 옆 `license.json` 이 정본이다.
옛 3D 파생물로 **남은 8장**(사람꼴 괴물 — 자체 몸 없음, K-0120·K-0122 대기): `beast_Alien`·`beast_Alien_2`·`beast_BlueDemon`·`beast_Demon`·`beast_Orc`·`beast_Wizard`·`beast_Yeti`·`beast_Zombie` — 원본은 Quaternius `Ultimate Monsters`·들판 적 `models/foes/`(CC0, 위 절들)를 `tools/bake-icons/bake-beasts.mjs` 로 구운 파생 그림이라 원본 라이선스(CC0)를 따른다.

같은 도구로 구운 **성채 지도 마커**(`building_Watchtower.png`·`building_Tower.png`·`building_PointyTower.png` ← `models/buildings/` 같은 이름 GLB, CC0)도 같은 결이다.

옛 "다시 굽기·늘림(09-23)"·"지도 스탬프 추가(09-25)" 절은 그 그림이 다 위로 바뀌어 지웠다(W-0269).

## 도감 펫 종마다 제 모델 — 사가나락에서 옮김 (2026-09-23)

도감 펫 64종이 형태 표에 없어 네발 모델 열 벌 중 하나를 id 해시로 입던 것(고래가 사슴 등)을 고치려고, 사가나락가 받아 둔 모델을 **그대로 복사**했다(재가공 없음, 파일은 사가나락와 같다). 출처·경위는 `saga-web/saga-dungeon/assets/ASSET_LICENSES.md` "도감(펫) 초상"·"펫 — poly.pizza 동물 번들 셋"·"펫 2차분" 절. `js/asset3d.js` `DEFAULTS` 에 `pet:pt_*` 로 등록.

| 폴더 | 파일 | 원출처 |
|---|---|---|
| `models/animals/` | `Tiger.glb`·`Bear.glb`·`Panda.glb`·`Monkey.glb`·`Boar.glb`·`Owl.glb`·`Cat.glb`·`Crane.glb` | Quaternius 계열 CC0(사가나락 "도감(펫) 초상" 절) |
| `models/animals_extra/` | `Cow_Farm.glb`·`Fish1.glb`·`Fish2.glb`·`Fish3.glb`·`Horse_Farm.glb`·`Llama.glb`·`Pig.glb`·`Pug.glb`·`Sheep.glb`·`Whale.glb`·`Zebra.glb` | poly.pizza Farm Animal Pack·Animated Fish Bundle(Quaternius, CC0) |
| `models/animals_extra2/` | `Anglerfish.glb`·`Apatosaurus.glb`·`Armored_Catfish.glb`·`Betta.glb`·`Black_Lion_Fish.glb`·`Blobfish.glb`·`Blue_Goldfish.glb`·`Blue_Tang.glb`·`Butterfly_Fish.glb`·`Cardinal_Fish.glb`·`Clownfish.glb`·`Coral_Grouper.glb`·`Cowfish.glb`·`Flatfish.glb`·`Flower_Horn.glb`·`Goblin_Shark.glb`·`Goldfish.glb`·`Humphead.glb`·`Koi.glb`·`Lionfish.glb`·`Mandarin_Fish.glb`·`Moorish_Idol.glb`·`Parasaurolophus.glb`·`Parrot_Fish.glb`·`Piranha.glb`·`Puffer.glb`·`Red_Snapper.glb`·`Royal_Gramma.glb`·`Shark.glb`·`Sunfish.glb`·`Swordfish.glb`·`Tang.glb`·`Tetra.glb`·`Tuna.glb`·`Turbot.glb`·`Worm.glb`·`Yellow_Tang.glb`·`Zebra_Clown_Fish.glb` | poly.pizza Animated Fish Bundle(대형)·Animated Dinosaur Bundle(Quaternius, CC0) |

> © **Quaternius**, CC0 (Public Domain). 저작자 표시 불필요. 공룡 넷(Stegosaurus·Triceratops·Velociraptor·T_Rex)은 이 판 `animals/` 에 이미 있어 안 옮겼다.


## Quaternius — 땅 전용 퓨전 소품 서른셋 (2026-09-24, `models/fusion/`, PLAN §5 ⑰ 넷째)

| 항목 | |
|---|---|
| **만든 이** | Quaternius — 맨 위 "Quaternius — 저지대 다각형" 절과 같은 배포(CC0 1.0, 재배포 허용) |
| **받은 곳** | 같은 미러 <https://github.com/trebeljahr/quaternius-showcase> `public/glb/` — 묶음 여덟 |
| **가공** | `tools/glb-compress` 로 Meshopt(+WebP). 우주 묶음(`*-transformed.glb`)은 원본이 **Draco** 라 이 판 로더(Meshopt 디코더만)가 못 읽어 gltf-transform `meshopt` 로 다시 쌌다. 파일 이름에서 `-transformed` 는 뗐다 |
| **쓰이는 곳** | `js/prop3d.js` `FUSION` 표 → `biome.js` 땅 열여섯 `props`(제 시대 + 다른 시대, SAGA-DESIGN §13 전체 퓨전) → `world3d.propPlan` |

| 묶음 | 파일 |
|---|---|
| `real_time_strategy_pack` | Windmill_FirstAge · Wall_FirstAge · Barrel · Crate_Stack1 |
| `medieval_village_pack` | Hay · Cart · Bonfire_Lit · Cauldron |
| `survival_pack` | Tent · PropaneTank |
| `street_pack` | Streetlight_Single · TrafficLight · Sign_Stop |
| `cyberpunk_pack` | AC_Stacked · Light_Street_2 · Antenna_2 · Tank · Turret_Cannon · Support_Long |
| `ultimate_space_pack` | SolarPanel_Structure · SolarPanel_Ground · GeodesicDome · House_Cylinder · Roof_Radar · Rover_1 · Tree_Floating_1 · Tree_Light_1 · Tree_Lava_1 · Tree_Spiral_1 |
| `nature_pack` | Cactus_2 · PalmTree_2 · PineTree_Snow_2 · Rock_Snow_2 |

## Quaternius — 세 시대 사람·적 (2026-09-24, `models/people/folk/`·`models/foes/`, PLAN §5 ⑱)

| 항목 | |
|---|---|
| **만든 이** | Quaternius — CC0 1.0(재배포 허용, 저작자 표시 불필요) |
| **받은 곳** | 사람 11·쥐·말벌·망자·외계 손님은 **사가나락가 이미 받아 둔 파일을 복사**(`saga-dungeon/assets/models/people/polypizza_men·women·space/`, `monsters/quaternius2/`·`monsters/quaternius/Alien_0bb74be9.glb` — 출처 poly.pizza "Ultimate Modular Men/Women Pack"·"Ultimate Space Kit"·Quaternius 몬스터, 사가나락 `assets/ASSET_LICENSES.md` 해당 절) · 로봇 셋은 미러 <https://github.com/trebeljahr/quaternius-showcase> `public/glb/cyberpunk_pack/`(`Enemy_Flying`·`Enemy_2Legs`·`Enemy_Large`) |
| **가공** | 복사본은 이미 Meshopt. 로봇 셋만 `tools/glb-compress` 로 Meshopt(1.2MB → 0.26MB). 파일 이름: 사람은 `m_`(남)·`w_`(여)·`s_`(우주), 로봇은 `Robot_Drone`·`Robot_Walker`·`Robot_Large`. 전부 제 클립(걷기·대기·공격·죽음) 내장이라 리타깃 없음 |
| **쓰이는 곳** | `js/asset3d.js` `hero:era:folk_*`(땅 사람 `folk.js`) · `pet:fc_*`(들판 적 `field-combat.js` FOES) |

| 자리 | 파일 |
|---|---|
| 사람 — 과거 | m_Farmer · w_Witch (+ 기존 QRPG 여섯 벌) |
| 사람 — 현대 | m_BusinessMan · m_Worker · m_Hoodie · m_SWAT · w_Suit · w_Worker |
| 사람 — 미래 | w_SciFi · s_Astronaut1 · s_Astronaut2 |
| 적 — 현대 | Rat · Wasp · Zombie |
| 적 — 미래 | Robot_Drone · Robot_Walker · Robot_Large · Alien |

## 사람 적·마을 사람 제 몸 — 사가나락에서 복사 (2026-09-25)

`models/people/fixed/` — 사가나락 `assets/models/people/` 의 hero_light 창고 파일을 **그대로 복사**했다(파일 이름 = 원래 폴더_파일).
출처·라이선스는 전부 사가나락 `assets/ASSET_LICENSES.md` 의 해당 절: `oga_ultimate_*`(Quaternius Ultimate Animated Character Pack, CC0 —
OpenGameArt), `polypizza_*`(Quaternius Ultimate Modular Men/Women·Pirate·Apocalypse·Wide 묶음, CC0 — poly.pizza), `kaykit_adventurers_*`
(KayKit Adventurers, CC0), `oga_knight_*`(Lowpoly Animated Knight, CC0). 전부 제 클립 내장. 쓰는 곳: `js/asset3d.js` FIXED_HERO.

## 신수·오마주·까치 대역 28종 — 종마다 한 벌 (2026-09-25, CHARACTER_UNIQUENESS ④)

Quaternius "Ultimate Monsters"(CC0, 사가나락 `assets/models/monsters/quaternius/` 에서 md5 그대로 복사 — 출처는 그쪽 `assets/ASSET_LICENSES.md` "Ultimate Monsters 45종" 절) 열여덟 벌을 `models/standin/<이름>.glb` 로(해시 꼬리만 뗌).

> **Elephant** (`models/standin/Elephant.glb`) — © **Poly by Google**, [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/). poly.pizza `/m/a27MA0rXyyj`, 사가나락 `models/animals/Elephant.glb` 복사. **저작자 표시 필요** — 이 문구가 그 표시다.

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


## 배경음 (`assets/audio/bgm/`)

2026-10-01 자체 생성 — `swbins3/music-gen`(로컬 ACE-Step 1.5, 코드·가중치 MIT, 상업 사용 허용). 원작 곡명·아티스트 이름은 프롬프트에 쓰지 않았다. 출처 기록 정본: `saga-web/shared/audio/bgm/<판>-<장면>.license.json`.

| 파일 | 만든 말(프롬프트) | 만든 법 | 비고 |
|---|---|---|---|
| `saga-go-field.ogg` | open world exploration, hopeful orchestral theme with erhu and light electronic arpeggio, adventurous mid tempo, instrumental | 로컬 AI 생성(ACE-Step 1.5, MIT·상업 허용, 씨앗 1201) | 사용자가 후보 a 선택 |
| `saga-go-battle.ogg` | energetic battle theme, taiko drums, brass stabs, fast driving strings, electronic pulse, 150 bpm, instrumental | 로컬 AI 생성(ACE-Step 1.5, MIT·상업 허용, 씨앗 1301) | 사용자가 후보 a 선택 |

## 2D 스프라이트 시트 (`assets/sprites2d_sheets/`)

2026-10-01 자체 제작 — 공방(`tools/char-forge/gear_sprites.py`)이 CC0 VRoid 몸(`tools/char-forge/_src/cc0_vroid`) 위에 절차 생성 장비를 입혀 Blender 로 굽는다(128px·8프레임·방향 3·동작 idle/walk/attack/hit/death, WebP). 인물·적 4벌: `pool_f_human_139`, `pool_g_human_147`, `pool_e_demon_128`, `pool_e_undead_127`. 벌마다 `manifest.json` 에 몸·종류·규격·출처 문구. 원작 에셋 없음. 이 판은 아직 안 읽는다(W 티켓 — 인물·괴물 id 연결과 `sprite.js` 배선).

## VRM 애니메 아바타 d~z (`assets/models/people/anime/avatar_sample_d~z.glb`, 2026-10-02)

VRoid 샘플(pixiv VRoid Project, VRM 1.0 — 상업·재배포·개작 허용, 크레딧 불필요) 중 `t` 를 뺀 22벌이다. `avatar_sample_t` 는 개작 허용·개작본 재배포 불가라 웹에 넣지 않았다. `tools/glb-compress/vrm-slim.mjs`(모프 제거·프리미티브 합침) 뒤 `compress.mjs`(Meshopt + 텍스처 WebP 1024px)로 줄인 파일이다 — 약 270MB → 17MB(벌당 약 0.8MB). 뼈·재질·메시 수는 그대로, VRMC_* 확장은 웹이 안 읽어 떨어졌다. 웹 3D 는 Pages 용량(1GB 한도) 때문에 이 한 판에만 둔다(K-0022 3b) — 다른 판에서 쓰려면 이 폴더 파일을 복사한다.

<!-- self-made:auto (tools/asset-audit/self_docs.py, K-0119) — 손으로 고치지 말 것 -->
## 자체 산출 사본 — saga-assets 정본과 md5 같은 파일 (자동)

이 판 `assets/` 안에서 정본(`saga-assets/`)과 내용이 같은 파일. 출처·도구·모델은 정본 옆 `*.license.json` 이 정본이고, 묶음별 라이선스 모음은 `saga-assets/CREDITS.md`.

| 파일 | 수 | 정본 | 도구·모델 | 라이선스 |
|---|---|---|---|---|
| `audio/bgm/*` | 2 | `saga-assets/bgm` | music-gen · ACE-Step/Ace-Step1.5 (acestep-v15-turbo) | MIT |
| `icons/icon64/*` | 22 | `saga-assets/icons/icon64` | gen.py · animagine-xl-4.0-opt | CreativeML OpenRAIL++-M |
| `sprites2d/*_x2.png`, `beast_Alpaca.png`, `beast_Alpaking.png`, `beast_Anglerfish.png`, `beast_Apatosaurus.png`, `beast_Armored_Catfish.png`, `beast_Bear.png`, `beast_Betta.png`, `beast_Birb.png`, `beast_Black_Lion_Fish.png`, `beast_Blobfish.png`, `beast_Blue_Goldfish.png`, `beast_Blue_Tang.png`, 외 89 | 103 | `saga-assets/sprites2d-creatures/beast` | beast2d_rebake.py (Blender render_sprite.py) | CC0-1.0 |
| `sprites2d_sheets/pool_e_demon_128/*` | 6 | `saga-assets/sprites2d/pool_e_demon_128` | 자체 도구 | CC0 VRoid 몸 + 절차 생성 장비(자체) — 출처 tools/char-forge/_src/cc0_vr |
| `sprites2d_sheets/pool_e_undead_127/*` | 6 | `saga-assets/sprites2d/pool_e_undead_127` | 자체 도구 | CC0 VRoid 몸 + 절차 생성 장비(자체) — 출처 tools/char-forge/_src/cc0_vr |
| `sprites2d_sheets/pool_f_human_139/*` | 6 | `saga-assets/sprites2d/pool_f_human_139` | 자체 도구 | CC0 VRoid 몸 + 절차 생성 장비(자체) — 출처 tools/char-forge/_src/cc0_vr |
| `sprites2d_sheets/pool_g_human_147/*` | 6 | `saga-assets/sprites2d/pool_g_human_147` | 자체 도구 | CC0 VRoid 몸 + 절차 생성 장비(자체) — 출처 tools/char-forge/_src/cc0_vr |
| `store/*` | 2 | `saga-assets/store/go` | gen.py · Illustrious-XL-v2.0 | CreativeML OpenRAIL-M — 상업 사용 가능(저자 HF 토론 2025-04, 2026-10-0 |
| `textures/land_c/*` | 18 | `saga-assets/land-go` | gen.py (ComfyUI) · z-image-turbo | Apache-2.0 |
| `ui/*` | 19 | `saga-assets/ui/dungeon`, `saga-assets/ui/go` | uigen.py | CC0-1.0 |
| `web2d/moving/hero_f/*` | 3 | `saga-assets/web2d/moving/hero_f` | gen.py (ComfyUI) · animagine-xl-4.0-opt | CreativeML OpenRAIL++-M |
| `web2d/moving/hero_m/*` | 3 | `saga-assets/web2d/moving/hero_m` | gen.py (ComfyUI) · animagine-xl-4.0-opt | CreativeML OpenRAIL++-M |
| `web2d/moving/villager_a/*` | 3 | `saga-assets/web2d/moving/villager_a` | gen.py (ComfyUI) · animagine-xl-4.0-opt | CreativeML OpenRAIL++-M |
| `web2d/moving/villager_b/*` | 3 | `saga-assets/web2d/moving/villager_b` | gen.py (ComfyUI) · animagine-xl-4.0-opt | CreativeML OpenRAIL++-M |
| `web2d/moving/villager_c/*` | 3 | `saga-assets/web2d/moving/villager_c` | gen.py (ComfyUI) · animagine-xl-4.0-opt | CreativeML OpenRAIL++-M |
| `web2d/tile/*` | 6 | `saga-assets/web2d/tile` | gen.py · sd_xl_base_1.0 | CreativeML OpenRAIL++-M |
<!-- /self-made:auto -->
