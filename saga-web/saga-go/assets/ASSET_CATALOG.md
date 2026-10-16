# 에셋 기술 카탈로그 (saga-go)

`SAGA WEB.md` 16절이 요구한 표 — **폴리곤 수 · 텍스처 크기 · 최적화 여부**처럼
성능과 직결되는 기술 값만 모은다. 만든 이 · 출처 · 라이선스 · 재배포 조건 같은
법적 사항은 이미 `assets/ASSET_LICENSES.md`가 자세히 다루므로 **여기서
되풀이하지 않는다** — 그룹 제목 옆에 짧게만 적고, 자세한 근거는 그 문서로
넘긴다. 두 문서가 서로 다른 사실을 담으면 안 되므로, 에셋을 더하거나 뺄 때는
**둘 다** 고친다.

폴리곤 수는 각 GLB/glTF의 `accessors`를 직접 파싱해 얻었다(인덱스가 있으면
인덱스 수/3, 없으면 정점 수/3) — three.js가 화면에 실제로 그리는 삼각형
수와 같다. 텍스처 크기는 GLB에 박힌 이미지를 그대로 디코드해 잰 실측 픽셀이다.

---

## 요약

| 갈래 | 파일 수 | 합계 용량 |
|---|---:|---:|
| 3D 모델 (`models/nature`) | 17 | 1.33 MB |
| 3D 모델 (`models/buildings`) | 13 | 2.76 MB |
| 3D 모델 (`models/props`) | 8 | 0.85 MB |
| 3D 모델 (`models/fusion`, 땅 전용 퓨전 소품 — Quaternius CC0, Meshopt) | 33 | 0.6 MB |
| 3D 모델 (`models/people/folk`, 땅 사람 세 시대 — Quaternius CC0, Meshopt) | 11 | 4.3 MB |
| 3D 모델 (`models/foes`, 들판 적 현대·미래 — Quaternius CC0, Meshopt) | 7 | 0.8 MB |
| 3D 모델 (`models/animals`) | 5종(파일 7개, 까치는 `.gltf`+`.bin`+`.webp`) | 2.07 MB |
| 3D 모델 (`models/people/quaternius_rpg`, 사람 기본) | 6 | 10.8 MB |
| 3D 모델 (`models/people/regular`, 되돌림 자리) | 33(`.gltf`12·`.bin`12·`.webp`8·`.png`1) | 7.7 MB |
| 3D 모델 (`models/anim`, 몸짓 창고) | 1 | 7.27 MB |
| 땅 텍스처 (`textures/land`, WebP) | 6 | 1.30 MB |
| 초상 스프라이트 (`sprites2d/portrait`) | 71 | 0.24 MB |
| 효과음 (`audio/sfx`, mp3) | 7 | 0.11 MB |

**`models/people/regular/`(되돌림 전용, 지금은 표 기본이 아니다)는 2026-09-04
이전엔 26.7MB — 전체 에셋의 절반 가까이였다.** 대부분
`T_Peasant_BaseColor.png`(4.8MB)·`T_Ranger_BaseColor.png`(6.3MB) 같은
**4096×4096 PNG 텍스처** 때문이었다. 이 카탈로그를 쓰다가 실측으로 드러난
값이라, 그 자리에서 여덟 장을 다운스케일 + WebP로 바꿔 **7.7MB로 줄였다**
(아래 표) — SAGA WEB.md 19절 "4K 텍스처 금지"에도 이제 안 걸린다.

**받아서 실제로 쓰는 것 중 가장 무거운 낱개 파일은
`models/anim/UAL1_Standard.glb`(7.27MB)** — 몸짓 마흔한 벌을 다 담은
창고라 한 번만 받으면 인물 여섯 벌이 전부 나눠 쓴다(옷·머리와 뼈대를
공유하므로 리타기팅 없이 그대로 물린다, README '에셋 창고' 절). 낱개
캐릭터(`quaternius_rpg/*.glb`)는 1.6~2.1MB로 **주요 캐릭터 1024~2048px
기준**(SAGA WEB.md 6절) 안에 있다.

---

## Quaternius — 자연물 (`models/nature/`)

[Quaternius, **CC0**](ASSET_LICENSES.md#quaternius--저지대-다각형low-poly-묶음) · `js/prop3d.js`가 `InstancedMesh`로 세운다 · 재질은 받는 순간 PBR→Lambert로 벗긴다(`lambertOf`)

| 이름 | 형식 | 용량 | 폴리곤 | 애니메이션 | 쓰이는 곳 | 최적화 |
|---|---|---:|---:|---|---|---|
| CommonTree_1/2/3 | GLB | 155·158·87 KB | 2,888·2,950·1,584 | 없음 | 활엽수(3종 랜덤) | 텍스처 없음(면색뿐) — 가벼움 |
| CommonTree_Autumn_1/2 | GLB | 155·159 KB | 2,888·2,950 | 없음 | 가을 활엽수 | 철에 맞을 때만 미리 받음(2026-09-04) |
| CommonTree_Snow_1/2 | GLB | 160·165 KB | 2,966·3,048 | 없음 | 겨울 활엽수 | 철에 맞을 때만 미리 받음 |
| PineTree_1/2 | GLB | 104·92 KB | 1,911·1,681 | 없음 | 침엽수 | 양호 |
| Rock_1/2/3 | GLB | 5.4·6·5.7 KB | 70·80·72 | 없음 | 바위 | **매우 가벼움** — 인스턴싱에 이상적 |
| Bush_1/2 · Grass_2 | GLB | 21·16·12 KB | 364·266·192 | 없음 | 덤불·풀 | 매우 가벼움 |
| Mountain_1/2 | GLB | 17·46 KB | 194·628 | 없음 | 산봉우리(`peak`) | 2026-09-04부터 시작 화면엔 미리 안 받음(숨은 곳 아님, 손그림 땅 밖) |

## Quaternius — 건물 (`models/buildings/`)

같은 출처·라이선스 · `js/prop3d.js`(집·탑) 또는 `js/asset3d.js`(역참=Inn, 성채=Tower류)

| 이름 | 형식 | 용량 | 폴리곤 | 쓰이는 곳 | 최적화 |
|---|---|---:|---:|---|---|
| Blacksmith | GLB | 655 KB | 7,659 | 대장간(마을) | 마을엔 한 채뿐이라 부담 적음 |
| House_1~4 | GLB | 401·498·253·200 KB | 5,758·7,162·4,668·3,024 | 민가 4종 랜덤 | 양호 — 마을 시작 화면에 늘 미리 받음 |
| Inn | GLB | 458 KB | 7,756 | **역참**(`asset3d`) | 구역마다 하나, 랜드마크 |
| LargeSquareTowerBricks·LargeTower·PointyTower·Tower·Watchtower | GLB | 42·31·37·39·19 KB | 856·576·654·716·348 | **성채**(등급별) · 마을탑 | 매우 가벼움 |
| Well | GLB | 108 KB | 1,870 | 우물(마을 랜드마크) | 양호 |
| MarketStand_1 | GLB | 83 KB | 1,548 | 장터 좌판(마을 랜드마크) | 양호 |

## Quaternius — 소품 (`models/props/`)

| 이름 | 형식 | 용량 | 폴리곤 | 쓰이는 곳 | 최적화 |
|---|---|---:|---:|---|---|
| Arch | GLB | 235 KB | 4,484 | 폐허(`ruin`, 숨은 곳) | 2026-09-04부터 시작 화면엔 미리 안 받음 |
| Bridge | GLB | 26 KB | 486 | 강 다리(여러 칸 이어 세움) | 2026-09-04부터 미리 안 받음(땅 가장자리) |
| Gazebo | GLB | 51 KB | 698 | 옛 사당(`shrine`, 숨은 곳) | 2026-09-04부터 미리 안 받음 |
| Mine | GLB | 139 KB | 2,294 | 굴 입구(`cave`, 숨은 곳) | 2026-09-04부터 미리 안 받음 |
| Rice_4 | GLB | 107 KB | 1,940 | 논에 자란 벼 | 마을 인접 — 계속 미리 받음 |
| WoodenTorch | GLB | 27 KB | 448 | 등롱(밤에만 점등) | 마을 인접 — 계속 미리 받음 |
| Temple | GLB | 271 KB | 4,828 | **아직 안 걸었다**(받아만 둠) | `ASSET_LICENSES.md` 101행 참고 — 코드가 안 쓰므로 preload 대상도 아님 |
| Wall | GLB | 18 KB | 404 | **아직 안 걸었다**(받아만 둠) | 위와 동일 |

## Quaternius — 동물 (`models/animals/`)

`js/animal.js`(비전투 야생) · Wolf/Cow는 `js/event.js` 교전 무대에서도 재사용

| 이름 | 형식 | 용량 | 폴리곤 | 애니메이션 | 텍스처 |
|---|---|---:|---:|---:|---|
| Cow | GLB | 629 KB | 2,450 | 12벌 | 없음(면색) |
| Deer | GLB | 647 KB | 2,096 | 13벌 | 없음 |
| Wolf | GLB | 594 KB | 1,962 | 12벌 | 없음 |
| Koi | GLB | 161 KB | 1,494 | 6벌(헤엄·튀어오름) | 없음 |
| Mesh_Crow(+.bin+.webp) | glTF | 4 KB(+ WebP 76B) | 682 | 없음(정지 모델) | **32×32 WebP**(2026-09-04, 원래 PNG) — [Poly by Google, CC-BY](ASSET_LICENSES.md#poly-by-google--까치crow) |

## Quaternius — RPG Character Pack, 사람 기본 (`models/people/quaternius_rpg/`)

[Quaternius, **CC0**](ASSET_LICENSES.md#quaternius--rpg-character-pack-2026-09-03-사람-기본-modelspeoplequaternius_rpg) · `HERO_RECIPES`(`js/asset3d.js`) 여섯 벌

| 이름 | 용량 | 메시 | 폴리곤 | 애니메이션 | 텍스처 | 최적화 |
|---|---:|---:|---:|---:|---|---|
| Cleric | 1.92 MB | 4 | 5,104 | 11벌 | 1024²+512² | **기준 안**(6절 1024~2048px) |
| Monk | 1.68 MB | 2 | 6,714 | 11벌 | 1024² | 기준 안 |
| Ranger | 1.86 MB | 6 | 3,806 | 14벌 | 1024² | 기준 안 |
| Rogue | 1.59 MB | 8 | 2,326 | 12벌 | 1024²+512² | 기준 안 |
| Warrior | 1.91 MB | 5 | 5,402 | 13벌 | 1024²+512² | 기준 안 |
| Wizard | 2.06 MB | 6 | 5,376 | 15벌 | 1024²+512² | 기준 안 |

## Quaternius — 사람 창고 셋, 되돌림 자리 (`models/people/regular/`)

[Quaternius, **CC0**](ASSET_LICENSES.md#quaternius--사람-창고-셋-옛-조합형-modelspeopleregular--modelsanim) · `HERO_RECIPES_FALLBACK`(`js/asset3d.js`, 지금은 표 기본이 아니다)

**`.gltf`는 JSON 설명뿐이라 몇 KB다 — 실제 무게는 옆의 `.bin`(정점)과
`.png`(텍스처, 여러 모델이 나눠 쓴다)에 있다.** 아래는 `.gltf`+`.bin`을 합친
실제 용량이다.

| 이름 | 형식 합계(gltf+bin) | 폴리곤 |
|---|---:|---:|
| Superhero_Male_FullBody | 725 KB | 14,318 |
| Superhero_Female_FullBody | 990 KB | 15,060 |
| Male_Peasant | 682 KB | 12,894 |
| Female_Peasant | 664 KB | 13,568 |
| Male_Ranger | 1.69 MB | 26,982 |
| Female_Ranger | 1.90 MB | 26,966 |
| Hair_Beard | 56 KB | 1,034 |
| Hair_Buzzed / Hair_BuzzedFemale | 49·48 KB | 830 |
| Hair_SimpleParted | 66 KB | 1,301 |
| Hair_Long | 194 KB | 2,906 |
| Hair_Buns | 218 KB | 3,284 |

**텍스처(9장, 여러 모델이 나눠 쓴다)**

| 파일 | 이전(PNG) | 지금(WebP q82) | 실측 크기 | 최적화 |
|---|---:|---:|---|---|
| `T_Ranger_BaseColor` | 6.32 MB | **141 KB** | 4096²→**2048²** | 2026-09-04: 옷감, 다운스케일+WebP |
| `T_Peasant_BaseColor` | 4.82 MB | **96 KB** | 4096²→**2048²** | 위와 동일 |
| `T_Hair_2_BaseColor` | 1.65 MB | 39 KB | 2048²→**1024²** | 머리 텍스처 |
| `T_Hair_1_BaseColor` | 1.50 MB | 31 KB | 2048²→**1024²** | 위와 동일 |
| `T_Superhero_Male_Dark` | 1.32 MB | 20 KB | 2048²→**1024²** | 몸 살빛 |
| `T_Superhero_Female_Dark_BaseColor` | 1.26 MB | 20 KB | 2048²→**1024²** | 위와 동일 |
| `T_Regular_Female_Dark_BaseColor` | 1.29 MB | 21 KB | 2048²→**1024²** | 옷 밖 손·팔 살빛 |
| `T_Regular_Male_Dark_BaseColor` | 1.26 MB | 19 KB | 2048²→**1024²** | 위와 동일 |
| `T_Eye_Brown.png` | 35 KB | (안 바꿈) | 256² | 이미 작아 그대로 뒀다 |

**받을 때 이미 Normal·Roughness·ORM 맵은 뺐다**(`ASSET_LICENSES.md` 160행).
남은 BaseColor 여덟 장은 **2026-09-04에 옷감 2048·나머지 1024로
다운스케일 + WebP(q82) 재인코딩**했다 — 합계 **19.4MB → 0.38MB(98%
감소)**. 옷감 둘(`Peasant`·`Ranger`)이 **4096×4096 PNG** 였던 것이
SAGA WEB.md 19절 "4K 텍스처 금지"에 정면으로 걸리던 자리였고, 지금은
전부 2048 이하다. 이 폴더 전체(`.gltf`+`.bin`+텍스처)는 **26.7MB →
7.7MB**로 줄었다. 여전히 화면 기본은 아니다(`HERO_RECIPES_FALLBACK`).

## Quaternius — 몸짓 창고 (`models/anim/UAL1_Standard.glb`)

| 항목 | 값 |
|---|---|
| 용량 | 7.27 MB |
| 메시 | 1(확인용 더미, 화면에 안 그림) |
| 애니메이션 | **41벌**(idle·walk·jog·sprint·roll·sword_attack·hit·death·spell·pistol… ) |
| 텍스처 | 없음 |
| 최적화 | 무압축(Draco 없음 — `file://` 단독판 호환 우선, PLAN.md 방침). 한 번만 받아 인물 여섯 벌이 전부 나눠 쓰므로 **낱개로 보면 무겁지만 전체로 보면 이득**이다 |

---

## ambientCG — 땅 소재 텍스처, WebP (`textures/land/`)

[ambientCG, **CC0**](ASSET_LICENSES.md#ambientcg--땅-소재-텍스처-assetstexturesland) · `js/world3d.js`의 `landTexImg()`가 캔버스 패턴으로 반복

| 이름 | 형식 | 크기 | 용량 | 원본 대비 |
|---|---|---|---:|---|
| grass·forest·mount·town·farm | WebP q82 | 1024×1024 | 308·240·176·256·200 KB | 원본 1K-JPG 대비 평균 **84% 감소** |
| road | WebP q82 | 1024×512 | 144 KB | 위와 동일 |

**2026-09-04 이전엔 jpg**(합계 8.45MB) — SAGA WEB.md 5절 "텍스처는 WebP 우선"에
맞춰 재인코딩(합계 1.30MB). `new Image()`로 디코드해 GLTFLoader를 거치지 않으므로
포맷 전환에 코드 변경이 없었다.

**2026-09-05: 종류마다 변형을 둘씩 더 받아(`grass2/3.webp` 등, 총 18장) 다양성을
늘렸다** — 사진 한 장을 그대로 반복하면 넓은 들판에서 같은 무늬가 계속
되풀이돼 보였다. `js/world3d.js`의 `LAND_TEX_VARIANTS`·`variantFor()`가
48m 칸마다 해시로 셋 중 하나를 고정으로 고른다(자세한 원본 자산·출처는
`ASSET_LICENSES.md` 참고). 추가 12장 합계 3.1MB.

---

## EverFace · nonemo — 초상 스프라이트 (`sprites2d/portrait/`) — **10-16 W-0259 지움(코드 참조 0)**

`js/portrait3d.js`가 조각을 얹어 합성. **PNG** — 아직 WebP로 안 옮겼다(낱장이
1~20KB로 이미 작아 우선순위가 낮다)

| 그룹 | 라이선스 | 파일 수 | 대표 크기 | 합계 | 쓰이는 곳 |
|---|---|---:|---|---:|---|
| `portrait/serious/` (EverFace) | [CC0](ASSET_LICENSES.md#everface--초상-진지한-얼굴-assetssprites2dportraitserious) | 18 | 24×24 | 22 KB | 기본 초상(`portrait3d.cute=0`) |
| `portrait/cute/` (nonemo) | [CC0](ASSET_LICENSES.md#nonemos-character-pack--초상-귀여운-얼굴-assetssprites2dportraitcute) | 53 | 145×143 | 220 KB | 손잡이 `portrait3d.cute=1`일 때 |

**둘 다 `portrait3d.js`가 실제로 조합해 쓴다** — 이전 감사에서 "안 쓰이는
파일"로 잘못 적었던 것을 여기서 바로잡는다(둘 다 진짜 코드 경로다).

---

## OpenGameArt "RPG Sound Pack" — 효과음, mp3 (`audio/sfx/`)

[artisticdude, **CC0**](ASSET_LICENSES.md#opengameart-rpg-sound-pack--효과음-assetsaudiosfx) · `js/audio.js`가 이벤트버스를 엿듣고 재생

| 이름 | 형식 | 길이 | 용량 | 쓰이는 곳 |
|---|---|---:|---:|---|
| discover | mp3 모노 96kbps | 0.47s | 8 KB | `codex`(신규 발견) |
| encounter_win | mp3 모노 96kbps | 0.91s | 12 KB | `dex:new`(등용·포획 성공) |
| hit | mp3 모노 96kbps | 0.26s | 4 KB | `duel:fx`(교전 타격) |
| reward | mp3 모노 96kbps | 0.65s | 12 KB | `feat`(공적 획득) · `growth:refine`(펫 연성 성공, 재사용, 2026-09-14) |
| panel_open | mp3 모노 96kbps | 1.04s | 16 KB | `duel:open`·`*:request`(카드/무대 열림) |

원본은 44.1kHz WAV(95개 중 5개만 골라 옮김). 스테레오→모노 다운믹스로
용량을 더 줄였다 — 짧은 효과음에 스테레오가 필요 없다.

---

## OpenGameArt "100 CC0 SFX #2" — 천둥, mp3 (`audio/sfx/thunder.mp3`)

[rubberduck, **CC0**](ASSET_LICENSES.md#opengameart-100-cc0-sfx-2--천둥-assetsaudiosfxthundermp3) ·
`js/audio.js`가 `sky:thunder`(`js/sky3d.js`의 번개)를 엿듣고 재생 (2026-09-14)

| 이름 | 형식 | 길이 | 용량 | 쓰이는 곳 |
|---|---|---:|---:|---|
| thunder | mp3 모노 96kbps | 5.30s | 62.5 KB | `sky:thunder`(비 오는 날 번개) |

원본은 48kHz 스테레오 ogg. 위 RPG Sound Pack 다섯과 같은 규격(모노
44.1kHz 96kbps mp3)으로 맞춰 옮겼다 — 팩이 다르지만 재생 규격은 통일했다.

---

## OpenGameArt "RPG Sound Pack" — 레벨업, mp3 (`audio/sfx/levelup.mp3`)

[artisticdude, **CC0**](ASSET_LICENSES.md#opengameart-rpg-sound-pack--효과음-assetsaudiosfx) ·
`js/audio.js`가 `levelup`(`core.js`의 플레이어 레벨업)을 엿듣고 재생 (2026-09-14)

| 이름 | 형식 | 길이 | 용량 | 쓰이는 곳 |
|---|---|---:|---:|---|
| levelup | mp3 모노 96kbps | 0.50s | 6.4 KB | `levelup`(플레이어 레벨업) |

원본은 위 다섯 조각과 같은 팩(`interface/interface6.wav`, 44.1kHz 스테레오
WAV) — 이번에 새로 골랐다. 같은 규격(모노 96kbps mp3)으로 맞췄다. ffmpeg가
없는 세션이라 Node(`lamejs`, 순수 JS mp3 인코더)로 직접 다운믹스·인코딩했다.

---

## Lucide — UI 아이콘

파일이 아니라 `js/icon.js` 안에 SVG 문자열로 인라인(3.6KB) — 폴리곤·텍스처
개념이 없어 이 표에서 뺀다. 자세한 내용은
[`ASSET_LICENSES.md`](ASSET_LICENSES.md#lucide--ui-아이콘-jsiconjs-안에-적혀-있다).

---

## 아직 안 받은 것 · 안 걸어 둔 것

`ASSET_LICENSES.md`의 "아직 안 가져온 것" 절과 이 표의 `Temple.glb`·`Wall.glb`
참고. 오디오도 원본 팩의 UI 클릭음·NPC 울음·갑옷 소리 등 90개가 더 남아 있다
(같은 문서, "다음 단계 후보" 절).
