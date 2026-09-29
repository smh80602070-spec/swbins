# 에셋 출처와 라이선스 (saga-go)

새 `PLAN.md` **8절**이 시킨 대로, 이 폴더에 넣은 **바깥에서 가져온 에셋**의 출처와
라이선스를 여기 한곳에 적는다. **여기 없는 파일은 이 폴더에 두지 않는다.**

이 저장소는 공개다(<https://github.com/smh8627-jpg/swbins>). 그래서 재배포가
허용되지 않는 에셋은 애초에 받지 않는다.

**폴리곤 수·텍스처 실측 크기·용량 같은 기술 값은 여기 안 적는다** — `SAGA WEB.md`
16절 형식 그대로 `ASSET_CATALOG.md`가 따로 갖고 있다. 여기는 출처·라이선스만.

---

## Quaternius — 저지대 다각형(low-poly) 묶음

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
구워 올려 둔 미러를 썼다(사가고 8절 "Photoshop/Blender 없이" 원칙과 같은 결).

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

## Lucide — UI 아이콘 (`js/icon.js` 안에 적혀 있다)

| 항목 | |
|---|---|
| **만든 이** | Lucide Icons and Contributors (<https://lucide.dev>) |
| **라이선스** | **ISC** — 저작권 문구를 남기면 자유롭게 쓰고 고치고 재배포할 수 있다 |
| **받은 곳** | <https://github.com/lucide-icons/lucide> `icons/*.svg` |

> Lucide — © Lucide Icons and Contributors, [ISC License](https://github.com/lucide-icons/lucide/blob/main/LICENSE).

**파일로 두지 않고 `js/icon.js` 안에 적어 두었다.** 스무 개 남짓이라 3.6KB 뿐이고,
그림 하나에 요청 하나씩 붙으면 첫 화면이 그만큼 늦기 때문이다.

**왜 이모지를 바꿨나.** 이모지는 **폰트가 그리는 것**이라 기기마다 다르게 보인다 —
같은 화면이 아이폰·안드로이드·윈도우에서 셋으로 갈린다. 도구줄·독·지갑만 바꿨고,
손잡이 `icon.on` 을 0 으로 내리면 이모지가 그대로 남는다.

**인물·펫의 이모지는 안 바꿨다.** `data.js` 의 `emoji` 는 아이콘이 아니라
**그 인물의 상징**이다(관우의 칼, 장비의 술). 아이콘 세트에 대응하는 것이 없고,
바꾸면 도감이 밋밋해진다 — 그 자리는 초상(`portrait3d`)이 맡는다.

---

## ambientCG — 땅 소재 텍스처 (`assets/textures/land/`)

| 항목 | |
|---|---|
| **만든 이** | ambientCG (<https://ambientcg.com>) |
| **라이선스** | **CC0 1.0** — 저작자 표시 없이 자유롭게 쓰고 고치고 재배포할 수 있다 |
| **받은 곳** | <https://ambientcg.com>, 1K-JPG 묶음에서 `Color` 맵만 골랐다 |

| 파일 | 원본 자산 |
|---|---|
| `grass1.webp` | Grass005 |
| `forest1.webp` | Ground106 |
| `mount1.webp` | Rocks011 |
| `road1.webp` | Ground081 |
| `town1.webp` | Ground103 |
| `farm1.webp` | Ground109 |

**2026-09-05: 종류마다 변형을 둘씩 더 받았다**(사용자가 "바닥이 네모만 있는게
아니라 다양하게 현실감 있게" 요청 — 한 장을 12m마다 그대로 반복하면 넓은
들판에서 같은 무늬가 계속 되풀이돼 보였다). 마찬가지로 1K-JPG `Color` 맵만
골라 WebP(q82, 1024px)로 재인코딩했다.

| 파일 | 원본 자산 |
|---|---|
| `grass2.webp` / `grass3.webp` | Grass002 / Grass003 |
| `forest2.webp` / `forest3.webp` | Ground084 / Ground037 |
| `mount2.webp` / `mount3.webp` | Rocks012 / Rocks013 |
| `road2.webp` / `road3.webp` | Ground069 / Ground032 |
| `town2.webp` / `town3.webp` | Ground104 / Ground105 |
| `farm2.webp` / `farm3.webp` | Ground048 / Ground110 |

`js/world3d.js`의 `LAND_TEX_VARIANTS`가 종류마다 이 셋을 배열로 들고,
`variantFor(kind, gx, gy)`가 48m 칸 좌표를 해시해 그중 하나를 고정으로
고른다(`landPattern()`에서 씀) — 같은 칸은 다시 구워도 같은 변형을 쓰고,
옆 칸은 보통(2/3 확률로) 다른 변형이라 반복 주기가 훨씬 길어진다. 변환
도구는 이 세션에 `cwebp`가 없어 npm `sharp`(prebuilt binary, 네이티브
컴파일 불필요)로 대신했다 — 다음 세션이 텍스처를 더 늘릴 때도 같은 방법을
쓰면 된다(`sharp('...jpg').resize(1024,1024).webp({quality:82}).toFile(...)`).

`js/world3d.js` 의 `landTexture()` 가 `LAND_COLOR` 표로 색만 칠하던 자리를
이 텍스처로 갈아 끼웠다(2026-08-30). **`water` 는 안 받았다** — 실제 물결은
`water3d.js` 가 따로 그려서 이 칠은 거의 안 보인다. 이 판 재질(`delam`)과 같은
원칙으로 **Color(BaseColor) 한 장만** 받았다 — Normal·Roughness·AO·Displacement
는 원본 zip 에 있지만 옮기지 않았다.

**2026-09-04: 원본 1K-JPG(합계 8.45MB) → WebP(quality 82, 합계 1.35MB, 평균 84%
감소)로 재인코딩했다.** `SAGA WEB.md` 5절의 "텍스처는 WebP 우선" 규칙을 따른
것 — `landTexImg()`(`js/world3d.js`)는 `new Image()`로 그냥 디코드하므로 포맷
전환에 코드 변경이 필요 없었다. 원본 `.jpg`는 지웠다(Git 이력에는 남아 있다).

**2026-09-10: 2D 폴백(`js/world.js`의 `drawFallback`)도 같은 파일을 재사용한다.**
새 파일은 안 받았다 — 3D가 이미 쓰던 18장을 40px 작은 캔버스로 한 번만
다운스케일해 소스로 쓴다(옛 `fillRect(색)`과 비용이 비슷하게 유지하려고).
`water`는 3D와 같은 이유로 안 받았다(색만 그대로). 자세한 것은
`saga-go/README.md`의 "실제 에셋" 절 참고.

**2026-09-05: 사용자가 "바닥은 퀄리티가 없는데?"로 지적 — 사진 자체가 아니라
그걸 화면에 굽는 캔버스가 문제였다.** `landTexture()`·`terrainTexture()`가
땅 타일 하나(`span` ≈ 244m, 이 판 줌 17·위도 기준)를 구울 때 캔버스가
`256px` 고정이었다 — `LAND_TEX_METERS`(12m)마다 반복하는 무늬 한 칸이
캔버스에서 겨우 12.6px 로 뭉개져 1024px 원본 사진의 결이 거의 다 사라졌다.
`LAND_TEX_RES()` 손잡이(`core.tuned('world3d.landTexRes', 768)`)로 빼서
768로 올렸다 — 반복 한 칸이 이제 ~37.8px.

사용자가 "원본 이미지를 GPU에 직접 타일링하면 더 낫지 않냐"고 제안해
검토했다 — **맞는 방향이지만 이 지형에는 안 맞았다.** `terrainAt()`이
48m 격자마다 `core.hash2(tx,ty)`를 독립적으로 굴려(이웃과 안 이어지는
소금·후추 노이즈) 종류를 정하는데, 타일 한 장이 그 격자 49칸(7×7)을
덮는다 — 5000곳을 무작위 표본으로 "49칸이 전부 한 종류인 타일"을 세어
보니 **0/5000(0.000%)**, 가장 흔한 grass(60%)라도 0.6^49 ≈ 0이라 수학적
으로도 당연했다. 그래서 "종류가 균일한 타일만 GPU 반복 타일링으로
건너뛰기" 최적화는 접었다(구현해도 거의 안 걸려 죽은 코드만 남는다) —
캔버스 굽기는 그대로 두고 해상도만 올리는 쪽으로 확정했다. 자세한
수치·판단 근거는 `js/world3d.js`의 `LAND_TEX_RES()` 주석 참고.

**성능은 굽기 루프만 떼어 벤치마크로 확인했다**(GRID=48·span=244, 20회
평균): 256(4.9ms)·768(5.4ms)·1024(5.5ms)까지 사실상 공짜, 1536(7.6ms)부터
눈에 띄고 4096(28.1ms, 텍스처 67MB)에서는 확실히 무겁다. 진짜 비용은
해상도가 아니라 서브셀마다 새로 만드는 `createPattern` 호출 쪽이었다.

**이 과정에서 진짜 메모리 누수를 하나 찾아 고쳤다** — 구운 텍스처를 담는
`landTex` 캐시(`js/world3d.js`)에 지우는 코드가 아예 없었다. 화면 밖으로
나간 땅 **메시**는 지워도 그 메시가 물려 쓰던 텍스처는 캐시에 그대로
남아 GPU 메모리를 계속 붙들었다(256px 땐 한 장 0.3MB라 안 느껴졌겠지만
768px 는 2.4MB). `syncGround()`에 세대 카운터(`syncGen`)를 두어, 한
세대(=한 번의 동기화) 동안 어느 살아있는 타일도 다시 찾지 않은 캐시
항목을 그 세대 끝에서 `dispose()`하고 지우도록 고쳤다 — 계절이 바뀌거나
플레이어가 멀리 걸어도 저절로 청소된다.

**실기기(또는 헤드리스) 화면 확인은 이번에도 못 했다** — 이 세션 내내
헤드리스 크롬이 `--screenshot` 플래그를 쓰면(가벼운 장면조차) 5분 넘게
안 끝나 포기했다(원인 불명, `_test.html` 자가진단은 평소처럼 잘 됨 —
421/423 3회 동일, 회귀 없음). **다음 세션(또는 실기기)이 눈으로 확인할
것** — 잔디가 사진 결로 보이는지, 오래 걸어도 메모리가 안정적인지.

---

## EverFace — 초상 "진지한" 얼굴 (`assets/sprites2d/portrait/serious/`)

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

## nonemo's Character Pack — 초상 "귀여운" 얼굴 (`assets/sprites2d/portrait/cute/`)

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

## OpenGameArt "RPG Sound Pack" — 효과음 (`assets/audio/sfx/`)

**2026-09-04, 오디오 시스템을 처음 들였다.** `SAGA WEB.md` 감사에서 드러난 격차 —
이 판은 소리가 하나도 없었다. artisticdude 가 만든 유명한 CC0 RPG 효과음 묶음(95개
.wav)에서 짧은 다섯 조각만 골라 mp3(모노 44.1kHz, 96kbps)로 옮겼다.

| 항목 | |
|---|---|
| **만든 이** | artisticdude |
| **라이선스** | **CC0** |
| **저작자 표시** | 필요 없다 |
| **재배포** | 허용된다 |
| **받은 곳** | <https://opengameart.org/content/rpg-sound-pack> — `rpg_sound_pack.zip` |

| 파일 | 원본 | 쓰이는 곳(`js/audio.js`) |
|---|---|---|
| `discover.mp3` | `inventory/bubble2.wav` | `codex` 이벤트 — 새 지역·사람·짐승·사건·역사를 처음 봤을 때 |
| `catch.mp3`(파일명 `encounter_win.mp3`) | `battle/magic1.wav` | `dex:new` — 등용·포획 성공 |
| `hit.mp3` | `battle/swing.wav` | `duel:fx` — 교전 중 타격 |
| `reward.mp3` | `inventory/coin.wav` | `feat` — 공적 획득 · `growth:refine` — 펫 연성 성공(재사용, 2026-09-14) |
| `panel_open.mp3` | `world/door.wav` | `duel:open`·`station:request`·`encounter:request`·`fort:request` — 카드/무대가 열릴 때 |
| `levelup.mp3` | `interface/interface6.wav` | `levelup` — 플레이어 레벨업 (2026-09-14 추가) |

**처음엔 다섯만 한 팩에서 골랐다**(10절 "에셋 스타일 통일"). 원본 팩에는 이
말고도 UI 클릭음(`interface/interface1~5.wav`) · 갑옷·금속·병 소리
(`inventory/`) · NPC·몬스터 울음(`NPC/`) 등이 더 있다 — 다음 단계(일반 버튼
탭, 사건 보상 세분화, 전투 시작 신호음 등)에서 더 고를 수 있다. **아직 안
걸었으면 여기 안 넣는다**는 이 문서 맨 위 규칙대로, 이번에 실제로 안 쓰는
조각(`interface2`·`interface4` 등으로 떠 봤던 UI 탭음)은 커밋하지 않았다.

**2026-09-14 — `interface6.wav`를 레벨업 소리로 골랐다.** `levelup` 이벤트
(플레이어 레벨업, 화면 배너는 이미 있었다)에 소리가 없던 것을 마저 채웠다.
이 팩의 `interface/` 여섯 조각 중 마지막 하나를 썼다 — 나머지 다섯(1~5)은
여전히 안 쓴다. **이번에도 실제로 들어보고 고른 게 아니라 폴더 이름(UI
피드백음)으로만 골랐다** — 위 "소리 매핑은 이 팩의 알려진 용례로 골랐을 뿐"
방식 그대로다. 원본은 44.1kHz 스테레오 WAV(0.5초) — 이 세션엔 `ffmpeg`가
없어 대신 Node에 `lamejs`(순수 JS mp3 인코더, npm)를 설치해 스테레오→모노
다운믹스 후 96kbps mp3로 직접 인코딩했다(변환에만 쓰고 저장소엔 안 남겼다,
위 천둥 절과 같은 "필요하지 않은 dependency 를 설치하지 않는다" 원칙).

`js/audio.js` 는 새 판정을 만들지 않았다 — 이미 도는 이벤트버스(`core.on`/`emit`)를
엿듣기만 한다. 손잡이 `audio.on`(0이면 무음) · `audio.vol`(0~1, 기본 0.6). 클립은
`preload="none"`으로 처음 낼 때만 받고(7절), 셋씩 풀로 돌려 써서 짧게 겹쳐도
안 끊긴다.

---

## OpenGameArt "100 CC0 SFX #2" — 천둥 (`assets/audio/sfx/thunder.mp3`)

**2026-09-14.** `js/sky3d.js`가 비 오는 날 번개가 칠 때마다 `sky:thunder`
이벤트를 던지고 있었는데(2026-09-10 "천둥번개도 보이고" 요청 때 넣은 것),
그때는 CC0 천둥 음원을 못 찾아 소리 내는 쪽이 없었다(`js/sky3d.js` 주석에
"아직 천둥 CC0 음원이 없어 소리는 없다"로 남겨 뒀던 자리).

| 항목 | |
|---|---|
| **만든 이** | rubberduck |
| **라이선스** | **CC0** |
| **저작자 표시** | 필요 없다 |
| **재배포** | 허용된다 |
| **받은 곳** | <https://opengameart.org/content/100-cc0-sfx-2> — `sfx_100_v2.zip` 의 `sfx100v2_thunder_01.ogg` |

원본은 48kHz 스테레오 ogg(5.26초)다. 위 RPG Sound Pack 다섯 조각과 같은
규격(모노 44.1kHz 96kbps mp3)으로 옮겨 `thunder.mp3`로 넣었다 — `assets/`에
ffmpeg 변환 스크립트를 따로 두지 않고 이번 변환에만 썼다(8절 "필요하지 않은
dependency 를 설치하지 않는다"와 같은 결로, 저장소에 도구를 남기지 않았다).
`js/audio.js`의 `CLIPS.thunder`가 이 파일을 가리키고 `sky:thunder`를
엿듣는다 — 새 판정은 없다.

---

## Poly Haven — HDRI 환경광 (`assets/hdri/alps_field_1k.hdr`)

| 항목 | |
|---|---|
| **만든 이** | Poly Haven (<https://polyhaven.com>) |
| **라이선스** | **CC0 1.0 Universal** (퍼블릭 도메인 헌정) |
| **저작자 표시** | 필요 없다. 그래도 적어 둔다 |
| **재배포** | 허용된다 |
| **받은 곳** | `saga-forest/assets/hdri/alps_field_1k.hdr` 를 그대로 재사용(같은 CC0 파일, 다섯 판 공용 자산 — 원본은 <https://polyhaven.com/a/alps_field>, 1k `.hdr`) |

2026-09-04, 사용자가 "재질을 실사처럼" 요청해 `world3d.js` 에 IBL(환경광)을 얹었다.
**하늘 색은 안 바꾼다** — `scene.background` 는 그대로 `lightingAt()` 의 시각별
색에 맡기고, `scene.environment` 에만 물려 PBR 재질(GLB 인물·건물)의 반사·
거칠기만 사실적으로 만든다. 세기는 `hemi.intensity`(이미 낮·밤·날씨별로 맞춰
둔 곡선)에 비례해 `syncLight()` 가 매 프레임 같이 낮춘다/올린다 — 예전에 ACES
톤매핑을 걸었다가 밤 화면이 망가진 사고(`post3d.js` 머리말)를 되풀이하지
않으려는 안전장치다. 못 받아도 조용히 넘어가고 옛 조명만으로 돈다.
`RGBELoader.js`(`js/vendor/`)도 같은 이유로 `saga-forest/js/vendor/`에서
그대로 재사용했다 — three.js 코어 빌드엔 없는 애드온이라 두 판이 같은 파일을
쓴다(다섯 판 공용 벤더 파일이지 이 판만의 새 의존성이 아니다).

## Poly Haven — 나무·바위·수풀 사진측량 스캔 (`models/nature/realistic/`)

2026-09-04, 사용자가 "사가블로는 했는데"(사가블로가 같은 것을 먼저 넣었다)로
형평을 요청 — 사가의숲이 검증해 둔 것을 사가블로가 그대로 옮겼던 것과 같은
길로, 이 판에도 옮긴다. 사람 캐릭터 실사화는 다섯 판 어디서도 막힌 벽이었지만
(Mixamo 재배포 금지, 대안 CC0 팩은 애니메이션 0개 — 이 문서 위 절과
`HANDOFF.md` 참고) 자연물은 다르다.

| 항목 | |
|---|---|
| **만든 이** | Rob Tuytel·Rico Cilliers(`island_tree_02`) · Rico Cilliers(`shrub_04`) · Rob Tuytel·Rico Cilliers(`pine_sapling_small`) · Jenelle van Heerden(`rock_07`) · Dario Barresi·Rico Cilliers(`stone_01`) · Kless Gyzen(`rock_moss_set_01`) — 전부 Poly Haven (<https://polyhaven.com>) |
| **라이선스** | **CC0 1.0 Universal** — 재배포 자유, 표시 의무 없음 |
| **받은 곳** | `saga-forest/assets/models/nature/realistic/` 를 그대로 재사용(같은 CC0 파일, md5 동일 확인). 처리 과정(weld·simplify·resize·jpeg 압축)의 자세한 수치는 `saga-forest/assets/ASSET_LICENSES.md` 의 같은 절 참고 — 다섯 판 공용 소재라 그쪽에 한 번만 자세히 적어 뒀다 |

| 이 판 소품 이름 | 파일 |
|---|---|
| `tree`(봄·여름) | `IslandTree_02.glb` |
| `pine` | `PineSapling.glb` |
| `rock` | `Rock_07.glb` · `Stone_01.glb` · `MossRock_a·b·c.glb`(다섯 벌 섞어 쓴다) |
| `grass`(수풀만, 풀잎은 그대로) | `Shrub_04.glb` |

2026-09-28 — `Shrub_04.glb` 를 이 판에서 한 번 더 줄였다(meshoptimizer simplify 0.1: 삼각형 27,327 → 2,601, 942KB → 337KB, 텍스처 그대로). `?perf` 로 재 보니 높음 등급 한 화면에 이 수풀 118그루가 **삼각형 322만 개**(그 프레임 전체의 96%)였다(SAGA-DESIGN §6.1-B). 원본은 `saga-forest` 의 같은 파일.

**가을·눈은 그대로 저다각형이다** — Poly Haven 전체를 뒤져도 가을 단풍·눈 덮인
나무 CC0 모델이 없다는 것은 사가의숲이 이미 확인한 자리라 다시 찾지 않는다.
사가의숲엔 있는 `log`(통나무)·`tree:dead`(고목)는 이 판의 소품 표(`prop3d.js`
`REG`)에 애초에 그 자리가 없어 옮기지 않았다 — 안 쓰는 파일을 공개 저장소에
얹을 까닭이 없다.

옛 Quaternius 저다각형 셋은 지우지 않았다 — `js/prop3d.js` 의
`TREE_STYLIZED`·`PINE_STYLIZED`·`ROCK_STYLIZED`·`BUSH_STYLIZED` 가 되돌림
자리로 들고 있다.

## 집·탑 — PolyScan · Poly Haven (`models/buildings/realistic/`)

2026-09-04, **사가블로가 같은 날 먼저 찾아 검증해 둔 것을 그대로 옮겼다**
(md5 동일 확인) — 아래 "안 가져온 것" 절의 옛 결론("동양풍만 없을 뿐 건물
자체는 CC0 로 있다")과 달리, 그때까지는 **집·탑도 사진측량/PBR 급 CC0 를
못 찾은 상태**였다. 사가블로가 rar 해제·OBJ 재질 분리·trimesh 로 새로
구해 냈다 — 자세한 변환 과정은 `saga-dungeon/assets/ASSET_LICENSES.md`
의 같은 절 참고(다섯 판 공용 소재라 그쪽에 한 번만 적혀 있다).

| 항목 | |
|---|---|
| **만든 이** | PolyScan(<https://polyscann.com>, 돌집·통나무집) · Rico Cilliers — Poly Haven(<https://polyhaven.com>, 탑) |
| **라이선스** | CC0 1.0 — 재배포·상업적 이용 자유, 표시 의무 없음 |
| **받은 곳** | `saga-dungeon/assets/models/buildings/realistic/` 를 그대로 재사용 |
| **파일** | `house_stone.glb`(285KB) · `house_wooden.glb`(246KB) · `tower_round.glb`(516KB, Poly Haven `modular_fort_01` 성채 모듈 키트에서 원형 탑 하나만 추림) |

| 이 판 소품 이름 | 파일 |
|---|---|
| `house`(마을 집) | `house_stone.glb` · `house_wooden.glb` |
| `tower`(들판의 홀로 선 탑) | `tower_round.glb` |

**`asset3d.js`의 역참(`station`)·성채(`fort:t3`)는 뒤이어 실사로 바뀌었다** —
아래 새 절 참고. 성채 등급(보·진) 둘은 그대로 저다각형이다(실사 탑이 한
종류뿐이라 세 등급을 다 못 채운다). 옛 Kenney류 집 다섯·탑 다섯은
지우지 않았다 — `js/prop3d.js` 의 `HOUSE_STYLIZED`·`TOWER_STYLIZED` 가
되돌림 자리로 들고 있다.

## Sketchfab — 아일랜드 문화유산 사진측량 스캔 (`tower_ruin.glb`)

2026-09-04, 사용자가 "역참·성채도 실사로 되는지 찾아봐" → "건물은 현대·미래·
과거 상관없어" → "성채가 아니여도 됨" · "역참도 [아니여도 됨]"으로 범위를
넓혀 요청 — 여관·성채처럼 안 생겨도 된다는 뜻이라 후보가 크게 늘었다.

Poly Haven 전체 521개 모델·PolyScan 중세 카테고리 20개를 다시 훑었지만 새로
쓸 만한 게 없었다(자세한 건 위 두 절과 이 세션 대화 참고 — PolyScan의 나머지
넷은 Patreon 가입이 있어야 받아지는 Early Access라 제외). **Sketchfab에서
찾았다** — Sketchfab REST API(`api.sketchfab.com/v3/search`)를 CC0 라이선스
필터로 돌려 아일랜드·스페인 문화유산 사진측량 스캔 여러 개를 확인했고, 그중
파일 무결성·확장자 호환성까지 검증된 하나만 실제로 옮겼다.

| 항목 | |
|---|---|
| **원본 이름** | Renvylle Castle |
| **만든 이** | Galway3D_DH_Age (Sketchfab) |
| **라이선스** | CC0 Public Domain — Sketchfab API로 확인(`license.slug === 'cc0'`) |
| **받은 곳** | Sketchfab 모델 `f08747faa13348d99a7f5bd2a824f2c2`. **다운로드에 무료 Sketchfab 계정(API 토큰)이 필요했다** — CC0라도 뷰어는 로그인 없이 열리지만 실제 파일 전송은 인증된 API 호출(`GET /v3/models/{uid}/download`)뿐이다. 사용자가 직접 무료 계정을 만들고 토큰을 줬다(계정 생성은 이 세션이 대신 안 한다) |
| **원본 설명** | "13~14세기 탑성(tower house) 폐허, 코네마라 북서쪽 끝" — 4층 중 한쪽 모서리가 무너져 있다 |
| **원본 크기** | GLB 13.4MB, 1,088,019 렌더 버텍스, 확장 없음(`extensionsUsed: none`) |
| **다듬기** | `@gltf-transform/cli`(npm, `optimize` 명령 — simplify ratio 0.03·error 0.01, join+palette, texture-compress webp·1024px) — Blender 없이 Node만으로 다 됐다. 13.4MB → 584.5KB, 단일 메시·단일 재질·단일 webp 이미지로 줄었다 |
| **파일** | `models/buildings/realistic/tower_ruin.glb`(584.5KB) |

같은 검색에서 `Castillo de Montroi`(12세기 아랍 탑)·`Galway City - Spanish
Arch`(1584년 성문)도 CC0로 확인됐지만 **뺐다** — Montroi는
`KHR_materials_pbrSpecularGlossiness`를 **필수 확장자**로 요구하는데 이
판의 `GLTFLoader`엔 그 확장자 플러그인이 없다(glTF 규격상 필수 확장자를
모르는 로더는 파일 전체를 못 읽어야 정상이다 — 위험을 감수할 이유가 없다).
Spanish Arch는 확장자는 깨끗했지만 simplify 오차 허용치를 5%까지 풀어도
23만 삼각형 밑으로 안 줄어(15.6MB) 다른 실사 자산(250~580KB대)과 너무
동떨어졌다 — 둘 다 원본 GLB는 안 남겼다(정제 실패작이라 커밋할 이유가 없다).

`js/asset3d.js`:
- `BLD_REAL` 상수 신설
- `'station'`(역참): `Inn.glb` → `tower_ruin.glb`. 옛 값은 `STATION_STYLIZED`
- `'fort:t3'`(웅진, 최고 등급): `[LargeTower.glb, LargeSquareTowerBricks.glb]`
  → `tower_round.glb`(위 집·탑 절의 그 파일, 재사용) 하나로. 옛 값은
  `FORT_T3_STYLIZED`. 보(`fort:t1`)·진(`fort:t2`)은 그대로 저다각형
- `delam()`(PBR→Lambert로 벗기는 함수, 사람·짐승 재질용)에 `/realistic/`
  경로 검사를 넣어 이 둘은 안 벗긴다 — `prop3d.js`가 나무·집·탑에 이미
  적용해 둔 것과 같은 고침. 이 판에서 `asset3d.js`가 실사 자산을 처음
  받았으므로 이 검사 자체가 새로 필요했다

자가진단 421/423, 3회 동일 — `_test.html`의 역참·성채 필名 검사(`/Inn\.glb$/`
등)도 새 파일명에 맞춰 고쳐 반영했다. **실기기 확인 전이다** — `station`·
`fort:t3`의 크기 손잡이(`asset3d.stationScale` 1.73·`asset3d.fortScale`×tier3
배율 3.27)는 옛 저다각형 기준으로 잡힌 값이라, 방금 탑(`prop3d.towerScale`)
에서 겪은 것과 같은 함정(정규화 키 1당 폭이 넓은 모델은 같은 배율에서 더
커 보인다)을 또 밟을 수 있다 — 다음에 보면서 확인할 것.

## Poly Haven — 산봉우리·등롱 (`mountainside.glb` · `wooden_lantern.glb`)

2026-09-04(역참·성채 바로 뒤이어), 사용자가 "다른 것도 진행해줘"로 계속
요청 — Poly Haven 전체 521개 모델 카탈로그를 `category`·이름으로 다시
훑어 두 개를 더 찾았다.

| 항목 | |
|---|---|
| **만든 이** | Poly Haven(둘 다 CC0, `collection: verdant_trail`·`collection: smugglers_cove`) |
| **라이선스** | CC0 1.0 |
| **받은 곳** | `api.polyhaven.com/files/mountainside` · `.../wooden_lantern_01` — 여러 파일(gltf+bin+텍스처)로 오는 걸 `@gltf-transform/cli optimize`(webp 압축·단일 glb로 묶기)로 한 파일로 구웠다 |
| **원본 크기 → 결과** | mountainside 15.37MB → 1.26MB · wooden_lantern_01 13.99MB → 233KB |
| **파일** | `models/nature/realistic/mountainside.glb` · `models/props/realistic/wooden_lantern.glb` |

| 이 판 소품 이름 | 파일 |
|---|---|
| `peak`(산봉우리) | `mountainside.glb`(절벽·산비탈 사진측량 스캔) |
| `lamp`(등롱) | `wooden_lantern.glb`(`wooden_lantern_01`, 집·탑을 준 `smugglers_cove` 컬렉션과 같은 계열) |

**우물·장터·사당·굴·폐허·다리·벼는 Poly Haven엔 그 모양 자체가 없다**
(우물·장터·사당 같은 작은 랜드마크 건물류는 `buildings` 카테고리 13개
중에도, 이름 검색에도 없었다. 다리는 `modular_wooden_pier`가 있었지만
강을 건너는 다리가 아니라 부두라 어울리지 않아 뺐다). `js/prop3d.js`의
`PEAK_STYLIZED`·`LAMP_STYLIZED`가 되돌림 자리다. 자가진단 421/423 3회
동일 — 회귀 없음. **다섯(우물·장터·사당·굴·폐허) 은 Sketchfab에서 뒤이어
찾았다 — 바로 아래 절.** 다리·벼는 끝내 못 찾았다(이 절 아래에서 계속).

## Sketchfab — 우물·장터·사당·굴·폐허 (다섯 벌 더)

2026-09-04(같은 날, "마저 찾아봐줘"), Poly Haven에 없던 나머지 다섯을
Sketchfab CC0 필터로 찾았다(역참 때 쓴 그 API 토큰·같은 파이프라인 —
`optimize` 명령 하나로 다듬음). **전부 그 물건 자체는 아니다** — 사용자가
"성채가 아니여도 됨"·"역참도 [아니여도 됨]"으로 이미 승인한 범위를 그대로
이어 받았다. 원본 크기는 raw GLB(Sketchfab 다운로드), 결과는 `optimize` 뒤.

| 이 판 소품 | 원본 이름 | 만든 이 / 출처 | 원본→결과 | 파일 |
|---|---|---|---|---|
| `well`(우물) | Ballinsloe Well Low | 아일랜드 문화유산 사진측량(2020년 발굴된 원형 우물) | 16.88MB→917KB | `models/buildings/realistic/well.glb` |
| `market`(장터 좌판) | Athenry - Market Cross | 아일랜드 애슬렌리 중세 시장 십자가 — 좌판은 아니지만 "장터의 랜드마크"라는 뜻은 같다 | 23MB→859KB | `models/buildings/realistic/market_cross.glb` |
| `shrine`(사당) | Wayside shrine "Pensive Christ" | 폴란드 크라쿠프 Seweryn Udziela 민족학박물관 디지털화 프로젝트 | 2.67MB→253KB | `models/props/realistic/wayside_shrine.glb` |
| `cave`(굴 입구) | Toorelectra - Sweathouse | 아일랜드 돌무덤형 한증막(낮은 입구 있는 작은 돌집) — 진짜 광산은 아니지만 굴 입구 자리에 맞는 실루엣 | 4.49MB→1.26MB | `models/props/realistic/sweathouse.glb` |
| `ruin`(폐허) | Arco Romano De Cabanes | 스페인 카스테욘 로마 시대 아치 유적 — 원작 설명 그대로 "무너진 아치" | 33.29MB→1.27MB | `models/props/realistic/roman_arch.glb` |

라이선스는 다섯 다 Sketchfab API로 `license.slug === 'cc0'` 확인. 다운로드는
같은 이유로 API 토큰이 필요했다(사용자가 만든 계정, 역참 때와 같은 토큰
재사용). 확장자는 다섯 다 `extensionsRequired` 가 비어 있어(선택적으로
쓴 `KHR_materials_unlit` 하나만 있었고 이건 three.js가 기본 지원한다)
Montroi 때 겪은 위험이 없다. 다듬은 뒤엔 전부 `EXT_texture_webp` 하나뿐.

같은 검색에서 **다리는 끝내 못 찾았다** — "clapper bridge"·"packhorse
bridge"·"stone footbridge"·"medieval bridge"·"ancient bridge"·"hump
bridge"·"river crossing" 등 15개 넘는 검색어를 다 돌려도 다리 유적
사진측량은 하나도 없었다(이 CC0 풀은 아일랜드·스페인 문화유산 디지털화
프로젝트가 대부분이라 다리 같은 토목 구조물보다는 기념물·석상·건물 쪽에
쏠려 있다). CC0 필터 없이 봐도 "Bridge" 자체는 여럿 있었지만 전부
CC-BY/CC-BY-NC라 뺐다(Poly Pizza·OpenGameArt에도 다리는 있으나 CC0라도
전부 저다각형이라 실사화 취지에 안 맞는다). `js/prop3d.js`의
`SHRINE_STYLIZED`·`CAVE_STYLIZED`·`RUIN_STYLIZED`·`WELL_STYLIZED`·
`MARKET_STYLIZED`가 되돌림 자리다. 자가진단 421/423 3회 동일.

**벼는 무료 생태계 어디에도 작물로서는 없다** — Poly Haven·PolyScan·
Sketchfab CC0·OpenGameArt·Poly Pizza를 전부 확인했지만 "벼"로 걸리는
것은 조리된 쌀(밥그릇·주먹밥·초밥) 소품뿐, 논에서 자라는 식물 모델은
저다각형으로도 존재하지 않는다. 사용자 승인("벼가 없으면 다른 거 해도
돼" → "있는 걸로 채워 줄순 없어?")으로 **새로 안 받고** 이미 받아 둔
`grass`와 같은 파일(`Shrub_04.glb`, Poly Haven CC0, 위 "나무·바위·수풀"
절 참고)을 `rice`에도 그대로 돌려 쓴다. 정확히 벼는 아니지만 "논에 자란
초록"이라는 뜻은 산다. `js/prop3d.js`의 `RICE_STYLIZED`(옛 `Rice_4.glb`)
가 되돌림 자리다.

**다리도 뒤이어 대체했다.** 사용자가 "비슷한 거나 다른 걸로 채워도 됨
· 자연스럽게만 · 콘셉트가 모두 허용"으로 범위를 넓혀 줘서, 실사 다리를
못 찾은 대신 **다리 대신 디딤돌**로 건너는 콘셉트를 택했다 — 이미 받아
둔 `rock`용 `MossRock_a.glb`를 `bridge`에도 재사용한다. `propPlan`이
짧은 칸을 여러 개 이어 강을 건너는 구조라, 건물(집·탑)을 반복하면
어색했겠지만 **바위는 여러 개 늘어서도 자연스럽다**(디딤돌 그 자체가
원래 그런 모양이다). `js/prop3d.js`의 `BRIDGE_STYLIZED`(옛
`Bridge.glb`)가 되돌림 자리다. `sw.js` VERSION → `go-v5.19.12`.

자가진단 421/423 3회 동일(벼·다리 둘 다). **실기기 확인 전이다** —
특히 `Shrub_04`가 논 위에서 어색하게 크거나 작게 서지 않는지, 디딤돌이
강폭에 맞게 자연스럽게 늘어서는지 볼 것.

## Sketchfab — 청더 사원 (`chengde_temple.glb`, 손그린 땅의 단 한 자리뿐인 랜드마크)

2026-09-11, "건물 에셋 확충"(건물이 유럽 중세풍 하나뿐이라는 지적) 요청으로
새로 조사. **한옥(hanok) CC0는 이번에도 못 찾았다** — Sketchfab API를
`hanok`·`korean traditional house`·`korean pagoda`·`joseon`·`minka`·
`old chinese house`·`chinese pavilion`·`asian house`·`tiled roof house`
등으로 CC0 필터 돌려도 결과가 아예 없거나(hanok 태그 자체는 있지만 전부
CC-BY/Standard, 이 저장소는 CC-BY를 이미 다 걷어낸 CC0 전용 정책이라 제외)
가구·장신구뿐이었다. PolyHaven(Chinese 카테고리는 가구뿐)·PolyScan(건물
7종 전부 유럽 중세)도 재확인했지만 건물류는 없었다.

**대신 찾은 유일한 실제 CC0 동양풍 건물** — "chinese temple" 검색에서
스톡홀름 민족박물관(Etnografiska museet) 소장품을 스캔한 모델을 확인.

| 항목 | |
|---|---|
| **원본 이름** | Model of the Golden Temple, Wan fa Gui yi Hall |
| **원본 설명** | 청(淸) 건륭제 시절 지어진 허베이성 청더(承德) 보타종승묘(普陀宗乘之廟)의 완법귀의전(萬法歸一殿)을 본뜬 축소 모형. 스웨덴 탐험가 스벤 헤딘이 1929년 "1933년 시카고 세계박람회에 라마교 사원을 들이겠다"는 목적으로 베이징의 건축가 량쓰청(W. H. Liang) 공방에 의뢰, 1932년에 1:10 축소 모형 두 벌을 제작했다 — 하나는 시카고로, 하나는 스톡홀름 민족박물관으로 갔다. 이 모델은 후자를 사진측량한 것이다 |
| **만든 이 / 출처** | 스톡홀름 민족박물관(SMVK-EM) 소장품 3D 디지털화, Sketchfab uid `97673d5721d743328022c282b77b33ae` |
| **라이선스** | CC0 Public Domain — Sketchfab API로 확인(`license.slug === 'cc0'`) |
| **받은 곳** | `GET /v3/models/{uid}/download` — 사용자가 이 세션에 새 Sketchfab 계정을 만들고 API 토큰을 줬다(토큰 자체는 저장소에 남기지 않는다, 대화에서만 오간 값) |
| **원본 크기** | GLB 200.87MB, 283만 폴리곤·157만 버텍스, **재질(텍스처) 약 70개** — 기둥·문틀·지붕 기와 등 수천 개의 작은 조각이 저마다 제 텍스처를 따로 물고 있다(실제 건물처럼 부재가 다 나뉜 정교한 축소 모형이라 그렇다) |
| **다듬기** | `@gltf-transform/cli optimize`(simplify ratio 0.02·error 0.03, join+palette, texture-compress webp·1024px) — 그런데 **여느 자산과 달리 42MB 밑으로 안 줄었다.** simplify 비율을 0.002까지, 텍스처를 256px까지 내려도 35MB가 바닥이었다 — 원인은 폴리곤이 아니라 **재질 수**다: `palette`는 무늬 없는 단색 재질끼리만 묶어 주는데, 이 모델은 재질 70개가 죄다 저마다의 사진 텍스처를 갖고 있어 병합이 안 먹힌다. 진짜로 합치려면 텍스처 아틀라스를 새로 굽는 Blender 작업이 필요한데, 이 저장소 파이프라인은 지금껏 Blender 없이 `gltf-transform` CLI만으로 다듬어 왔다(사람 캐릭터 절 참고) — 그 선을 넘지 않기로 하고 42.44MB에서 멈췄다 |
| **다시 다듬기(2026-09-23)** | 위 진단은 틀렸다 — 42MB 중 텍스처는 7MB뿐이고 나머지가 지오메트리였다(184만 삼각형이 그대로 남아 있었다). 막은 건 재질 수가 아니라 **사진측량 UV 조각**: 정점이 UV 섬마다 갈라져(정점/삼각형 1.8배) simplify 가 경계를 지키느라 멈췄다(`simplify --error 0.01 --lock-border false` 로도 120만이 바닥). `tools/glb-compress/seam-simplify.mjs`(같은 위치 정점을 하나로 보고 줄인 뒤 UV 둘레가 가장 짧은 원래 정점을 다시 붙임) ratio 0.04·error 0.02 → `resize 512` → `meshopt high`. **40.5MB → 4.0MB, 184만 → 8.3만 삼각형**, 재질·노드 67 그대로, 경계 상자 차이 0.2 단위 이하. 실기기 모양 확인 전 |
| **파일** | `models/buildings/realistic/chengde_temple.glb`(4.0MB, 처음 받을 땐 42.44MB) |

**다른 건물(집·탑·역참 등 500KB~1.3MB대)보다 30~80배 무겁다** — 그래서
**마을에 반복해서 세우는 자리가 아니라, 손그린 땅(`land.js`)에 단 한
자리만 있는 특별 랜드마크**로 다뤘다(마을 house/tower처럼 매 칸 인스턴싱
하는 게 아니라, shrine·cave·ruin과 같은 "그 칸에 다가가야만 한 번 받는"
자리). `sw.js`의 정적 프리캐시 목록에도 안 넣는다(`sw.js` 머리말이 이미
"`assets/models/*.glb`는 일부러 안 넣는다"고 못박아 둠 — 이 자산은 그
규칙 덕에 안 켜진 플레이어의 첫 설치를 안 무겁게 한다).

`js/land.js`: 지도 글자 `X`(숲, mark `temple`) 신설, 마을 남동쪽 숲 한 칸
(`tx:7, ty:9`)에 배치, `places`에 `{ id: 'temple', name: '숲 속 옛 사원',
hidden: true }` 추가 — 46절의 "숨겨진 장소 3개"가 이걸로 넷이 됐다.
`js/prop3d.js`: `REG.temple`(`chengde_temple.glb`) 신설, `casts()`에 추가
(그림자 짐). `EAGER_KIND`엔 안 넣는다(shrine·cave·ruin과 같은 결 — 그
칸에 실제로 다가갈 때만 42MB를 받는다). `js/world3d.js`: `propPlan`의
markAt 분기에 `temple` 추가, GLB 이름표에 `temple: 'temple'` 추가, GLB를
못 받았을 때만 보일 절차적 대체(사당보다 큰 2단 지붕집)를 `buildProp`에
신설.

한옥은 아니고 청 티베트 불교 양식이라 정확한 오마주는 아니지만, 지금
마을 전체가 유럽 중세풍인 것보다는 동양풍에 가깝다 — 사용자가 "그거
아니어도 됨"으로 이미 승인해 온 대체 범위(사당=폴란드 성상, 장터=아일랜드
시장 십자가 등)와 같은 결로 받아들였다.

`_test.html`의 "땅 — 아홉 가지 땅과 숨은 곳" 자가진단을 숨은 곳 3→4·
`@temple` 검사로 갱신, `node -c` 문법 확인 + Node로 `land.js`를 직접
불러 지도 무결성(`validate()`)·새 자리 좌표를 확인함. **실기기 확인
전이다** — 특히 42MB 자산이 실제 기기에서 로딩 시간·프레임에 어떤
영향을 주는지는 걸어가 봐야 안다.

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
막고 있었다 — 사가블로·사가스토리는 진작 pet도 굽는데 이 판만 빠져 있었다
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

## 짐승 2D 그림 (`assets/sprites2d/beast_*.png`, 32장) — 위 3D 모델을 구운 파생물

`tools/bake-icons`(헤드리스 굽기)가 이 판 3D 모델을 그대로 찍어 만든 그림이다 — 새로 받은 바깥 에셋은 없다.
**원본 모델의 라이선스(전부 CC0)가 그대로 따른다.** `js/sprite.js` 의 `beastImgOf()`·`BG_BEAST_FILE` 가 쓴다.

| 그림 | 원본 모델 | 원본 묶음(이 문서 위 절) |
|---|---|---|
| `beast_{Deer,Wolf,Cow,Koi,Pigeon,Birb}.png` | `models/animals/` 같은 이름 | Quaternius 들짐승 다섯 종 + 까치 |
| `beast_{Alpaca,Bull,Donkey,Fox,Husky,ShibaInu,Stag,Horse,Horse_White}.png` | 〃 | Quaternius `animals_pack` |
| `beast_{Frog,Snake,Snake_angry}.png` | 〃 | Quaternius `easy_enemies_pack` |
| `beast_{Trex,Triceratops,Stegosaurus,Velociraptor}.png` | 〃 | Quaternius `dinosaurs_pack` |
| `beast_{Shark,Dolphin,Manta_ray}.png` | 〃 | Quaternius `fish_pack` |
| `beast_{Orc,Demon,BlueDemon}.png` | `Orc.gltf`·`Demon.gltf`·`BlueDemon.gltf`(오우거 형태 절) | Quaternius `Ultimate Monsters` |

같은 도구로 구운 **성채 지도 마커**도 같은 결이다 — `building_Watchtower.png`(성채 1등급)·`building_Tower.png`·`building_PointyTower.png`(2등급) ← `models/buildings/` 같은 이름 GLB(위 건물 표, CC0), `building_tower_round.png`(3등급) ← `models/buildings/realistic/tower_round.glb`(Poly Haven `modular_fort_01`, CC0), `building_Inn.png` ← `Inn.glb`(역참 줄 참고). 2026-09-23 부터 역참 지도 마커는 `building_tower_ruin.png` ← `models/buildings/realistic/tower_ruin.glb`(위 역참 줄의 실사 스캔, CC0) — `building_Inn.png` 은 되돌림 자리로 남김.

2026-09-23 `tools/asset-audit` 이 "출처 문서에 이름이 없다"로 잡아 채웠다(그림은 09-06~07 에 들어왔다).


## 도감 펫 종마다 제 모델 — 사가블로에서 옮김 (2026-09-23)

도감 펫 64종이 형태 표에 없어 네발 모델 열 벌 중 하나를 id 해시로 입던 것(고래가 사슴 등)을 고치려고, 사가블로가 받아 둔 모델을 **그대로 복사**했다(재가공 없음, 파일은 사가블로와 같다). 출처·경위는 `saga-web/saga-dungeon/assets/ASSET_LICENSES.md` "도감(펫) 초상"·"펫 — poly.pizza 동물 번들 셋"·"펫 2차분" 절. `js/asset3d.js` `DEFAULTS` 에 `pet:pt_*` 로 등록.

| 폴더 | 파일 | 원출처 |
|---|---|---|
| `models/animals/` | `Tiger.glb`·`Bear.glb`·`Panda.glb`·`Monkey.glb`·`Boar.glb`·`Owl.glb`·`Cat.glb`·`Crane.glb` | Quaternius 계열 CC0(사가블로 "도감(펫) 초상" 절) |
| `models/animals_extra/` | `Cow_Farm.glb`·`Fish1.glb`·`Fish2.glb`·`Fish3.glb`·`Horse_Farm.glb`·`Llama.glb`·`Pig.glb`·`Pug.glb`·`Sheep.glb`·`Whale.glb`·`Zebra.glb` | poly.pizza Farm Animal Pack·Animated Fish Bundle(Quaternius, CC0) |
| `models/animals_extra2/` | `Anglerfish.glb`·`Apatosaurus.glb`·`Armored_Catfish.glb`·`Betta.glb`·`Black_Lion_Fish.glb`·`Blobfish.glb`·`Blue_Goldfish.glb`·`Blue_Tang.glb`·`Butterfly_Fish.glb`·`Cardinal_Fish.glb`·`Clownfish.glb`·`Coral_Grouper.glb`·`Cowfish.glb`·`Flatfish.glb`·`Flower_Horn.glb`·`Goblin_Shark.glb`·`Goldfish.glb`·`Humphead.glb`·`Koi.glb`·`Lionfish.glb`·`Mandarin_Fish.glb`·`Moorish_Idol.glb`·`Parasaurolophus.glb`·`Parrot_Fish.glb`·`Piranha.glb`·`Puffer.glb`·`Red_Snapper.glb`·`Royal_Gramma.glb`·`Shark.glb`·`Sunfish.glb`·`Swordfish.glb`·`Tang.glb`·`Tetra.glb`·`Tuna.glb`·`Turbot.glb`·`Worm.glb`·`Yellow_Tang.glb`·`Zebra_Clown_Fish.glb` | poly.pizza Animated Fish Bundle(대형)·Animated Dinosaur Bundle(Quaternius, CC0) |

> © **Quaternius**, CC0 (Public Domain). 저작자 표시 불필요. 공룡 넷(Stegosaurus·Triceratops·Velociraptor·T_Rex)은 이 판 `animals/` 에 이미 있어 안 옮겼다.


## 짐승 2D 그림 다시 굽기·늘림 (2026-09-23) — 위 "짐승 2D 그림" 절의 파생물 규칙 그대로

`tools/bake-icons/bake-beasts.mjs`(`view=pet` 옆 3/4 구도)로 기존 28장을 다시 굽고, "도감 펫 종마다 제 모델" 절에서 옮긴 모델 57개를
더 구워 모두 85장. 원본은 전부 이 문서에 적힌 CC0 GLB(Quaternius 계열)이고 `_x2` 는 `models/animals_extra2/` 쪽 같은 이름 모델이다.
파일: `beast_Alpaca.png`·`beast_Anglerfish.png`·`beast_Apatosaurus.png`·`beast_Armored_Catfish.png`·`beast_Bear.png`·`beast_Betta.png`·`beast_Birb.png`·`beast_Black_Lion_Fish.png`·`beast_Blobfish.png`·`beast_BlueDemon.png`·`beast_Blue_Goldfish.png`·`beast_Blue_Tang.png`·`beast_Boar.png`·`beast_Bull.png`·`beast_Butterfly_Fish.png`·`beast_Cardinal_Fish.png`·`beast_Cat.png`·`beast_Clownfish.png`·`beast_Coral_Grouper.png`·`beast_Cow.png`·`beast_Cow_Farm.png`·`beast_Cowfish.png`·`beast_Crane.png`·`beast_Deer.png`·`beast_Demon.png`·`beast_Dolphin.png`·`beast_Donkey.png`·`beast_Fish1.png`·`beast_Fish2.png`·`beast_Fish3.png`·`beast_Flatfish.png`·`beast_Flower_Horn.png`·`beast_Fox.png`·`beast_Frog.png`·`beast_Goblin_Shark.png`·`beast_Goldfish.png`·`beast_Horse.png`·`beast_Horse_Farm.png`·`beast_Horse_White.png`·`beast_Humphead.png`·`beast_Husky.png`·`beast_Koi.png`·`beast_Koi_x2.png`·`beast_Lionfish.png`·`beast_Llama.png`·`beast_Mandarin_Fish.png`·`beast_Manta_ray.png`·`beast_Monkey.png`·`beast_Moorish_Idol.png`·`beast_Orc.png`·`beast_Owl.png`·`beast_Panda.png`·`beast_Parasaurolophus.png`·`beast_Parrot_Fish.png`·`beast_Pig.png`·`beast_Pigeon.png`·`beast_Piranha.png`·`beast_Puffer.png`·`beast_Pug.png`·`beast_Red_Snapper.png`·`beast_Royal_Gramma.png`·`beast_Shark.png`·`beast_Shark_x2.png`·`beast_Sheep.png`·`beast_ShibaInu.png`·`beast_Snake.png`·`beast_Snake_angry.png`·`beast_Stag.png`·`beast_Stegosaurus.png`·`beast_Sunfish.png`·`beast_Swordfish.png`·`beast_Tang.png`·`beast_Tetra.png`·`beast_Tiger.png`·`beast_Trex.png`·`beast_Triceratops.png`·`beast_Tuna.png`·`beast_Turbot.png`·`beast_Velociraptor.png`·`beast_Whale.png`·`beast_Wolf.png`·`beast_Worm.png`·`beast_Yellow_Tang.png`·`beast_Zebra.png`·`beast_Zebra_Clown_Fish.png`

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
| **받은 곳** | 사람 11·쥐·말벌·망자·외계 손님은 **사가블로가 이미 받아 둔 파일을 복사**(`saga-dungeon/assets/models/people/polypizza_men·women·space/`, `monsters/quaternius2/`·`monsters/quaternius/Alien_0bb74be9.glb` — 출처 poly.pizza "Ultimate Modular Men/Women Pack"·"Ultimate Space Kit"·Quaternius 몬스터, 사가블로 `assets/ASSET_LICENSES.md` 해당 절) · 로봇 셋은 미러 <https://github.com/trebeljahr/quaternius-showcase> `public/glb/cyberpunk_pack/`(`Enemy_Flying`·`Enemy_2Legs`·`Enemy_Large`) |
| **가공** | 복사본은 이미 Meshopt. 로봇 셋만 `tools/glb-compress` 로 Meshopt(1.2MB → 0.26MB). 파일 이름: 사람은 `m_`(남)·`w_`(여)·`s_`(우주), 로봇은 `Robot_Drone`·`Robot_Walker`·`Robot_Large`. 전부 제 클립(걷기·대기·공격·죽음) 내장이라 리타깃 없음 |
| **쓰이는 곳** | `js/asset3d.js` `hero:era:folk_*`(땅 사람 `folk.js`) · `pet:fc_*`(들판 적 `field-combat.js` FOES) |

| 자리 | 파일 |
|---|---|
| 사람 — 과거 | m_Farmer · w_Witch (+ 기존 QRPG 여섯 벌) |
| 사람 — 현대 | m_BusinessMan · m_Worker · m_Hoodie · m_SWAT · w_Suit · w_Worker |
| 사람 — 미래 | w_SciFi · s_Astronaut1 · s_Astronaut2 |
| 적 — 현대 | Rat · Wasp · Zombie |
| 적 — 미래 | Robot_Drone · Robot_Walker · Robot_Large · Alien |

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

## 지도 스탬프 추가 — 들판 적·별손님 (2026-09-25, `assets/sprites2d/beast_*.png`)

`beast_Rat`·`Wasp`·`Zombie`·`Robot_Drone`·`Robot_Walker`·`Robot_Large`(들판 적 `assets/models/foes/`, Quaternius CC0)·
`beast_Alien_2`(별손님, Ultimate Monsters CC0)를 `tools/bake-icons/bake-beasts.mjs` 로 구운 파생 그림. 절차 펫은 이미 있던 땅짐승 그림 스물셋을 쓴다.

## 보물 상자 (`models/props/Chest.glb`, PLAN §5 ⑲-3, 2026-09-25)

| 항목 | |
|---|---|
| **만든 이** | Kay Lousberg — KayKit Dungeon Remastered |
| **라이선스** | **CC0 1.0 Universal** |
| **저작자 표시** | 필요 없다 |
| **재배포** | 허용된다 |
| **받은 곳** | `saga-story/assets/models/props/Chest.glb`(= `saga-dungeon/assets/models/dungeon/chest.glb`, md5 같음)를 그대로 복사했다 |

석등은 새 파일이 아니다 — 위 Poly Haven 절의 `wooden_lantern.glb`(CC0)를 `asset3d` 표 `lantern` 으로 한 번 더 가리킨다.
수집 구슬·석등 불빛은 모델이 아니라 효과 층(빛 스프라이트)이다.

## 채집물 — 버섯·꽃·풀숲·열매 덤불 (`models/nature/`, PLAN §5 ⑲-6, 2026-09-25)

| 항목 | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com>) — `crops_pack`(Mushroom_1) · `nature_pack`(Flowers · Plant_1 · BushBerries_1) |
| **라이선스** | **CC0 1.0 Universal** |
| **저작자 표시** | 필요 없다 |
| **재배포** | 허용된다 |
| **받은 곳** | `saga-forest/assets/models/props/Mushroom_1.glb` · `saga-forest/assets/models/nature/{Flowers,Plant_1,BushBerries_1}.glb` 를 그대로 복사했다(그쪽 ASSET_LICENSES 의 Quaternius 절) |

바지락·갯소라 자리는 이미 있는 `nature/Rock_1.glb` 를 작게 쓴다. 솥은 위 퓨전 소품 절의 `Cauldron`·`Bonfire_Lit`(`models/fusion/`)를 한 번 더 가리킨다.

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
