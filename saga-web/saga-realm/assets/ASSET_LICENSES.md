# 에셋 출처와 라이선스 (saga-realm)

이 저장소는 공개다(<https://github.com/smh8627-jpg/swbins>). 새로 넣은 **바깥에서
가져온 에셋**의 출처와 라이선스를 여기 한곳에 적는다. **여기 없는 파일은 이 폴더에
두지 않는다.**

`saga-go`·`saga-dungeon`·`saga-forest`가 이미 확인해 둔 것과 **같은 에셋을 그대로
옮겨 왔다**(PLAN 40절 부록 "다섯 판 공통 방침: 코드로 그리지 말고 에셋으로"). 라이선스를
어떻게 확인했는지(itch.io 미러 등 자세한 확인 경위)는 `../saga-go/assets/ASSET_LICENSES.md`
를 따른다 — 여기서는 **이 판에 실제로 옮긴 파일**만 추린다.

---

## Quaternius — 성채·탑 (`models/buildings/`)

`saga-go`의 `assets/models/buildings/`에서 그대로 옮겼다. `js/asset3d.js`가
성벽(`maxWall`) 값으로 세 등급 중 하나를 골라 세운다 — 등급이 높을수록 큰 탑.

| 항목 | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com>) |
| **라이선스** | **CC0 1.0 Universal** |
| **저작자 표시** | 필요 없다. 그래도 적어 둔다 |
| **재배포** | 허용된다 |

| 파일 | 쓰이는 곳 |
|---|---|
| `Watchtower.glb` | 성채 1등급(`city:t1`) — 성벽이 낮은 작은 성 |
| `Tower.glb` · `PointyTower.glb` | 성채 2등급(`city:t2`) |
| `LargeTower.glb` · `LargeSquareTowerBricks.glb` | 성채 3등급(`city:t3`) — 업(鄴) 같은 대성 |

## Quaternius — 지형·자연물 (`models/nature/`)

`Mountain_1·2.glb`는 `saga-dungeon`에서, 나머지는 `saga-forest`에서 옮겼다.
국토 지도 3D(`js/realm3d.js`)가 성 둘레에 지형(land: mount)이면 산을, 그 밖엔
나무·바위를 몇 개씩 흩어 심는다(자리는 성 id 해시로 고정 — 매번 안 흔들린다).

| 파일 | 쓰이는 곳 |
|---|---|
| `Mountain_1.glb` · `Mountain_2.glb` | 산지(`land: 'mount'`) 성 둘레의 봉우리 |
| `CommonTree_1.glb` · `CommonTree_2.glb` · `PineTree_1.glb` | 성 둘레 나무 |
| `Rock_1.glb` · `Rock_2.glb` | 성 둘레 바위 |

## Quaternius — 잔장식 (`models/nature/`, `models/props/`, `models/buildings/`)

2026-09-01, PLAN 40절 PHASE 4(퀄리티 보강) — 폰 확인 후 "3D인데 퀄리티가 부족하다"는
피드백을 받고, `saga-go`·`saga-forest`가 이미 확인해 둔 같은 CC0 를 옮겼다. 새로
받은 파일은 하나도 없다.

| 파일 | 옮긴 곳 | 쓰이는 곳 |
|---|---|---|
| `Bush_1.glb` · `Bush_2.glb` | `saga-go/assets/models/nature/` | 성 둘레 작은 덤불(잔풀 레이어) |
| `Grass_2.glb` | `saga-go/assets/models/nature/` | 잔풀 레이어, 강가 갈대 |
| `Flowers.glb` | `saga-forest/assets/models/nature/` | 잔풀 레이어의 꽃 |
| `Wall.glb` | `saga-go/assets/models/props/` | 3등급 대성의 성벽 |
| `Temple.glb` | `saga-go/assets/models/props/` | 3등급 대성의 사찰풍 구조물 |
| `WoodenTorch.glb` | `saga-go/assets/models/props/` | 모든 성 성문 앞 횃불 두 개 |
| `MarketStand_1.glb` | `saga-go/assets/models/buildings/` | 3등급 대성의 시장 |
| `Well.glb` | `saga-go/assets/models/buildings/` | 모든 성의 우물 |
| `House_1~4.glb` | `saga-go/assets/models/buildings/` | 성 안 3D 도시 화면(`city3d.js`) — 인구만큼 세는 집 |
| `WoodLog.glb` | `saga-forest/assets/models/nature/` | 성 안 3D 도시 화면 — 군량만큼 쌓는 곳간 통나무 |

만든 이·라이선스는 위 성채·지형과 같다(Quaternius, CC0 1.0 Universal, 저작자 표시
불필요, 재배포 허용).

## Quaternius — RPG Character Pack (2026-09-03, 사람 기본, `models/people/quaternius_rpg/`)

| | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com/packs/rpgcharacters.html>) |
| **라이선스** | CC0 1.0 (재배포 자유, 표시 의무 없음) |
| **받은 곳** | `saga-dungeon/assets/models/people/quaternius_rpg/` 에서 그대로 복사(같은 CC0) |
| **파일** | `Warrior.glb`·`Ranger.glb`·`Rogue.glb`·`Cleric.glb`·`Wizard.glb`·`Monk.glb`(원래 배포된 .gltf 임베드 base64를 바이너리 .glb로 변환 — 파싱 속도·용량 개선, 2026-09-03) |

`js/asset3d.js` 의 `HERO_RECIPES`(공개 기본값)가 이 여섯 벌을 가리킨다. 파일
하나에 몸·텍스처·리깅·걷기·공격·사망 클립이 다 들어 있어 아래 조합형의 옷·머리·
UAL1 몸짓이 필요 없다. 아래 조합형은 `HERO_RECIPES_FALLBACK` 으로 남겨 뒀다
(되돌림 자리).

## Quaternius — 사람 창고 셋, 옛 조합형 (`models/people/regular/` · `models/anim/`)

2026-09-02, 도감 초상을 캔버스 도형 대신 **실제 3D 모델을 오프스크린으로 구운 그림**
으로 바꾸면서(`js/portrait3d.js` 신설) 처음 옮겼다. 이 판은 인물이 걸어 다니지
않아(턴제 지도) 여태 사람 창고가 없었는데, 초상을 구우려면 몸이 있어야 한다.
`saga-dungeon/assets/models/people/regular/`·`models/anim/UAL1_Standard.glb`
에서 그대로 옮겼다 — 몸(Universal Base Characters)·옷(Modular Character
Outfits - Fantasy)·몸짓(Universal Animation Library)이 뼈 이름·순서까지
같아 리타기팅이 필요 없다.

| 항목 | |
|---|---|
| **만든 이** | Quaternius (<https://quaternius.com>) |
| **라이선스** | **CC0 1.0 Universal** |
| **저작자 표시** | 필요 없다 |
| **재배포** | 허용된다 |
| **받은 곳** | `saga-dungeon/assets/models/people/regular/`·`models/anim/UAL1_Standard.glb` 에서 그대로 복사 |

넣은 파일 — 몸 둘(남·여)·옷 넷(평민·순찰대 각 남녀)·머리 여섯·텍스처
(BaseColor만), `models/anim/UAL1_Standard.glb`(몸짓 마흔한 벌). `HERO_RECIPES_FALLBACK`
이 여섯 조합 중 인물 id 해시로 하나를 고르고, `delam()`이 PBR을 벗겨 Lambert로
물들인다 — 표 기본에서는 빠졌다(되돌림 자리로만 남음).

## saga-dungeon — 무기·투구 (2026-09-05, `models/weapons/` · `models/gear/`)

장수 3D 초상(`js/portrait3d.js`)은 QRPG 맨몸(전사·궁수·도적·성직자·마법사·수도승
6종)뿐이었다 — 캔버스 초상(`js/sprite.js`의 `LOOK`·`ruleLook()`)은 장수마다
무기·투구를 갖춰 그리는데 3D 는 오히려 밋밋했다. **새로 받지 않고 사가블로가
이미 갖춘 CC0/CC-BY 무기·장구를 그대로 복사해 왔다** — 출처·라이선스는
`saga-dungeon/assets/ASSET_LICENSES.md`(무기·"몬스터 장구를 실사화" 절)가
원본이고, 여기는 파일만 옮겼다.

| 파일 | 라이선스 | saga-dungeon 원본 경로 |
|---|---|---|
| `models/weapons/sword.glb`·`spear.glb`·`axe.glb`·`bow.glb`·`club.glb`·`staff.glb`·`scroll.glb` | CC0 (Quaternius) | `assets/models/weapons/` |
| `models/weapons/brush.glb` | **CC-BY 3.0**(Poly by Google) | `assets/models/weapons/brush.glb` |
| `models/gear/helmet.glb`·`crown.glb` | CC0 (Quaternius) | `assets/models/gear/` |
| `models/gear/viking_helmet.glb`(`gapju` 대역) | **CC-BY 3.0**(Michael Fuchs) | `assets/models/gear/viking_helmet.glb` |

> **Paint Brush** — © Poly by Google, CC-BY 3.0. **Viking Helmet** — © Michael
> Fuchs, CC-BY 3.0. 둘 다 `poly.pizza`를 거쳐 saga-dungeon 이 먼저 받았고,
> 크기만 다시 맞추었다(형상은 그대로).

`js/asset3d.js`의 `attachAccessories()`가 `sprite.lookOf()`의 무기·투구 값을
그대로 읽어 붙인다 — halberd·guandao 는 spear, fan 은 brush, plume 투구는
helmet 을 대신 쓴다(사가블로 `dungeon3d.js`의 재사용 판단을 그대로 옮김).
scholar·gat·hairpin·monk·braid 투구는 대응 CC0가 없어 맨머리로 남는다 —
"안 맞아도 실제 모델이 도형(빈 자리)보다 낫다"는 사용자 지시에 따라, 무기
여덟 종은 걸고 나머지 다섯 투구 종만 열린 자리로 둔다.

**2026-09-10 재확인 — 여전히 대응 CC0 없음.** 이 판·`saga-dungeon`의
`assets/models/gear/`를 다시 뒤졌다(`helmet.glb`·`crown.glb`·
`viking_helmet.glb`·`armor_leather.glb`·`armor_metal.glb`·`cape.glb` 뿐).
다섯 다 형태가 뚜렷이 다른 머리쓰개(사방관·갓·비녀·승모·변발)라, 무기처럼
"칼이면 다 비슷한 창끝"으로 봐줄 여지가 없다 — 학자에게 바이킹 뿔투구를
씌우면 안 맞는 정도가 아니라 우스꽝스러워져, 여덟 무기 때와 달리 **맨머리
쪽이 여전히 낫다**고 판단해 그대로 둔다. 새 CC0를 인터넷에서 받는 것은
이번 작업 범위 밖이다.

## 동양풍 탑 — 채택 (2026-09-10)

위 "옮기지 않은 것" 문제(탑·사찰이 서양풍 판타지라 결이 안 맞는다)에 동양풍
CC0 후보를 구해 채택했다.

| 항목 | |
|---|---|
| **파일** | `models/buildings/asian/BellStructure.glb` |
| **만든 이** | Polygonal Mind ("lunar-year" 팩 — 설날/중국풍 정자) |
| **라이선스** | **CC0 1.0 Universal** — `github.com/ToxSam/cc0-models-Polygonal-Mind`(GLB 변환본, `License.md`) 확인. 원본은 `github.com/PolygonalMind/initiative-opensource-release` |
| **받은 경위** | GitHub 미러 두 곳(`open-source-3d-assets` JSON 색인 → `cc0-models-Polygonal-Mind` 실 GLB)을 이 세션이 직접 확인·다운로드. `raw.githubusercontent.com` 이라 이 저장소 네트워크 규칙 안에서 받을 수 있었다 |
| **저작자 표시** | 필요 없다(CC0) |
| **재배포** | 허용된다 |
| **용량** | 1.2MB — 지금 쓰는 Quaternius 탑(20~85KB)보다 15~60배 무겁다. 성 하나가 아니라 등급 하나(같은 GLB 를 공유)만 받으므로 총 다운로드량 자체는 크게 안 늘지만, 한 파일이 무겁다는 점은 남는다 |

**2026-09-10에 기본값으로 뒤집었다.** 예외적으로 허용된 헤드리스 스크린샷
한 번으로 1등급 성채(`city:t1`)에 실제로 세워 확인했다 — 붉은 기둥 두
개에 종을 거는 가로대가 얹힌 문(門)/종틀 형태로, 서양풍 Watchtower와
실루엣이 뚜렷이 다르게 선다. `js/asset3d.js`의 `core.tuned('asset3d.asianTower', 1)`
로 기본 켜짐, `_admin.html` 균형 손잡이 탭에서 0으로 내리면 서양풍으로
되돌아간다(코드를 걷어낼 필요가 없다).

**2·3등급 킷배싱 완료(2026-09-23).** `Portal.glb`·`MainAltar.glb`(같은
"lunar-year" 팩)는 여전히 탑이 아니라 제외했고, `Column.glb`·`RoomRoof.glb`
등 그 팩의 나머지 조각도 시험 조립해 보니(오프라인 3뷰 실루엣 비교,
`tools/asset-forge/preview_scene.py` 요령 — 화면·헤드리스와 무관) 방 하나
분량의 큰 부품이라 탑 스케일에 안 맞았다. 대신 **같은 저장소의 다른
프로젝트 "tomb-chaser-2"**(`github.com/ToxSam/cc0-models-Polygonal-Mind/
tree/main/projects/tomb-chaser-2`, 네온웨이브 일본 탑 콘셉트 팩 — 같은
저장소라 License.md 가 그대로 적용되는 CC0)에서 기둥·지붕 둘만 받았다.

| 항목 | |
|---|---|
| **원본 파일** | `models/buildings/asian_parts/TempleColumn_Art.glb`·`TempleRoof01Corner_Art.glb` |
| **만든 이** | Polygonal Mind ("tomb-chaser-2" 팩) |
| **라이선스** | CC0 1.0 Universal(위 BellStructure 와 같은 저장소·같은 License.md) |
| **받은 경위** | GitHub API로 `projects/tomb-chaser-2/` 목록을 확인(TempleBase·Column·Wall·Roof 등 모듈형 절 부품 다수)한 뒤 필요한 둘만 `raw.githubusercontent.com`으로 받았다 |
| **원본 텍스처 문제** | 이 팩은 네온 콘셉트라 원본 색이 보라·시안·분홍이었다(색 샘플로 실측, 화면 확인이 아니라 텍스처 픽셀값 직접 조회) — 그대로 못 써 아래 팔레트로 스냅했다 |
| **조립·팔레트** | `tools/asset-forge/kitbash.py` `city_t2_asian`(기둥 4+지붕 1층)·`city_t3_asian`(그 위에 작은 2층을 더 얹음) 레시피 → `palette.py`에 새 팔레트 `realm_asian_tower`(나무·기와 톤 8색) 추가 → `snap-glb`로 물들임 |
| **다시 칠함(2026-09-23)** | `tools/asset-forge/retex_glb.py` — snap 결과가 기둥 회색·판재 검정+빨간 줄·지붕 민 회색이었고 원본 사이버 팩 광고판(`CyberAd`)이 붙어 있어, 밝기 결만 남기고 기둥 붉은 옻칠(Wood01)·판재 나무색(Wood02)·지붕 남회색(Roof)으로, `CyberAd` 는 알파 0 으로 숨김(1등급 BellStructure 색에 맞춤). 명령은 `saga-web/saga-realm/HANDOFF.md` 같은 날 절 |
| **최종 파일** | `assets/generated/buildings/city_t2_asian.glb`(911KB)·`city_t3_asian.glb`(936KB) — `js/asset3d.js`의 `asset3d.asianTower`(기본 켬) 손잡이로 1등급과 함께 켜지고 꺼진다 |
| **확인 방법** | 부품 배치(회전·간격)와 팔레트 스냅 전후는 오프라인 렌더(trimesh+matplotlib 3뷰 실루엣, `palette.py preview`)로 확인 — 게임 화면·헤드리스 크롬은 이번 세션에 안 띄웠다(스크린샷은 명시적 요청 시에만). **실기 확인 전** — 실제 성 위에서 크기·거리감이 적당한지는 사용자 확인 대상 |

## MPFB2 실사 몸 20종 — 초상 외형 다양화 (2026-09-10, `saga-go`에서 복사)

`js/asset3d.js`의 `HERO_RECIPES`(도감 초상용, `portrait3d.js`가 부른다)가
QRPG 6종뿐이던 것을 saga-go가 2026-09-05에 이미 뽑아 둔 MPFB2 실사 몸
20종(`assets/models/people/mpfb_real/{male,female,v3,v7~v23}.glb`, 각
3.5~4.3MB, 총 74MB)으로 더했다 — **라이선스는 CC0**(MPFB2 도구 자체는
GPLv3이지만 뽑아낸 모델은 `makehuman_system_assets_cc0.zip` 기반 CC0, 자세한
출처·재현 경위는 `saga-go/assets/ASSET_LICENSES.md`의 "MPFB2 +
makehuman_system_assets" 절 참고).

**이 판은 인물이 걷지 않는다** — `buildHero()`를 부르는 곳이 도감 초상 하나뿐이라
몸짓(mixer) 없이 정지 자세로만 서도 된다. 그래서 saga-go처럼 UAL1 몸짓을
뼈대 비례까지 맞춰 리타깃(`retargetInto()`)하지 않고, 각 MPFB 레시피의
`anim`을 **몸 파일 자신**(클립 0개)으로 줬다 — `buildHero()`의
`animC.clips.length` 검사가 그대로 걸러 mixer를 안 만들고 bind pose로
멈춘다. UAL1을 리타깃 없이 그대로 물렸다면 saga-go가 이미 겪은 뼈대 비례
뒤틀림 버그가 초상에 그대로 났을 것이다. 이 판에 걷는 3D 화면이 생기면
그때 `retargetInto` 계열 함수를 옮겨 와야 몸짓이 붙는다.

## Quaternius "Ultimate Monsters Bundle" 9종 — 균열 지역 수비 무장 (2026-09-10)

아홉째 확장(균열, 실제 지명이 아닌 첫 지역 — "너무 삼국지처럼 안 해도 돼,
현대 미래 과거 다 있어" 사용자 지시)의 수비 무장은 사람이 아니라 괴물이다.
`saga-dungeon/assets/models/monsters/quaternius/`가 이미 검증해 둔 CC0
자산을 그대로 복사해 왔다(같은 저장소 안이라 네트워크 재수신 없이 파일만
옮겼다) — 라이선스·출처는 saga-dungeon의
`assets/ASSET_LICENSES.md`("몬스터 — KayKit Skeletons + Quaternius
Ultimate Monsters Bundle" 절)과 완전히 같다.

| 파일 | 만든 이 | 받은 곳 | 라이선스 |
|---|---|---|---|
| `Alien_0bb74be9.glb` · `Alien_b048d82a.glb` · `Blue_Demon_6fbb8914.glb` ·
  `Demon_46b52ba4.glb` · `Goleling_Evolved_d6308fbf.glb` · `Yeti_40a831b3.glb` ·
  `Orc_Enemy_3076c5f7.glb` · `Ghost_Skull_0716bf8e.glb` · `Dragon_Evolved_90ed3740.glb` | Quaternius | `poly.pizza` 미러(saga-dungeon 경유) | **CC0**, 저작자 표시 불필요 |

원작 팩의 몬스터 이름(Alien·Demon 등)은 파일명(내부 식별자)에만 남아 있고
**화면에는 절대 안 뜬다** — 표시 이름(성혼·강마·종왕 등)은 이 판이 새로
지었다(`js/data-force.js` `FUTURE_OFFICERS`). `js/asset3d.js`의
`heroRecipe()`가 무장 데이터의 `monster` 필드(이 GLB들의 경로)를 곧장
몸+몸짓으로 쓴다 — 이미 각 파일에 idle·attack·death 등 클립이 다 박혀
있어(그 팩 자체가 그렇게 만들어졌다) 옷·머리 조합이 필요 없다. 아홉
파일 합쳐 약 1MB — 가볍다.

## Quaternius "Nature Enemies" 8종 + community Slime 1종 — 폐허 지역 수비 무장 (2026-09-11)

열째 확장(폐허, 균열 너머 — "다음 지역/콘텐츠 개발"로 사용자가 방향만
정하고 세부는 세션 재량에 맡긴 자리)의 수비 무장도 사람이 아니다 —
균열과는 다른 팩을 썼다. `saga-dungeon/assets/models/monsters/
quaternius2/`·`community/`가 이미 검증해 둔 CC0 자산을 그대로 복사해
왔다(같은 저장소 안이라 네트워크 재수신 없이 파일만 옮겼다) — 라이선스·
출처는 saga-dungeon의 `assets/ASSET_LICENSES.md`와 완전히 같다.

| 파일 | 만든 이 | 받은 곳 | 라이선스 |
|---|---|---|---|
| `quaternius2/Zombie.glb`·`Giant.glb`·`SkeletonSolo.glb`·`Spider.glb`·
  `Snake.glb`·`Rat.glb`·`FrogEnemy.glb`·`Wasp.glb` | Quaternius | `poly.pizza` 미러(saga-dungeon 경유) | **CC0**, 저작자 표시 불필요 |
| `community/SlimeEnemy.glb` | **Charlie** | `poly.pizza/m/6O6XUMssAW`(saga-dungeon 경유) | **CC-BY** — 저작자 표시 필요 |

> **Slime Enemy** — © **Charlie**, CC-BY(`poly.pizza/m/6O6XUMssAW`). 이
> 저장소에서 이 판이 CC-BY 를 쓰는 유일한 자리다(나머지 여덟은 전부 CC0).

원작 파일명(Zombie·Giant 등)은 여기서도 화면에 안 뜬다 — 표시 이름(부생·
거해·서군 등)은 이 판이 새로 지었다(`js/data-force.js` `RUIN_OFFICERS`).
`Wasp.glb`는 idle 클립이 없고 `Flying`뿐이라(균열 아홉 종엔 없던 경우)
`asset3d.js`의 `WORDS.idle`에 `flying`을 더해 매칭했다(saga-dungeon 쪽은
같은 이유로 `fly`를 넣었다 — 어느 쪽이든 `Wasp_Flying`과 매칭된다) —
안 그러면 벌이 가만히 bind pose로 굳어 있었을 것이다. 아홉 파일 합쳐
약 1.27MB.

## KayKit Character Pack: Skeletons 4종 — 묘역 지역 수비 무장 (2026-09-11)

열한째 확장(묘역, 균열·폐허에 이은 셋째 몬스터 팩)의 수비 무장은 되살아난
해골 병사다. `saga-dungeon/assets/models/monsters/kaykit_skeletons/`가
이미 검증해 둔 CC0 자산을 그대로 복사해 왔다(같은 저장소 안이라 네트워크
재수신 없이 파일만 옮겼다) — 라이선스·출처는 saga-dungeon의
`assets/ASSET_LICENSES.md`("몬스터 — KayKit Skeletons + Quaternius
Ultimate Monsters" 절)와 완전히 같다.

| 파일 | 만든 이 | 받은 곳 | 라이선스 |
|---|---|---|---|
| `kaykit_skeletons/Skeleton_Mage.glb`·`Skeleton_Minion.glb`·
  `Skeleton_Rogue.glb`·`Skeleton_Warrior.glb` | Kay Lousberg(KayKit) | `github.com/KayKit-Game-Assets`(saga-dungeon 경유) | **CC0**, 저작자 표시 불필요(권장) |

**이 팩만 9인이 4종을 나눠 쓴다** — 균열·폐허는 무장 한 명당 GLB 한 개씩
1:1이었는데, 이 팩은 한 벌이 2.5MB 안팎(몸마다 근접·원거리·2인용 무기
애니메이션이 90여 개씩 내장돼 있어서다)이라 9벌을 다 받으면 20MB를
넘는다. `asset3d.js`의 `acquire()` 캐시가 URL 기준이라 같은 GLB 를 쓰는
인물끼리는 실제로 한 번만 받고, tint(세력색)로만 서로 다르게 보인다 —
전투(`battle3d.js` `setupDuel()`)에서 같은 팩 인물끼리 마주 세우면 몸이
겹칠 수 있다는 뜻이다(예: 강해·고전이 둘 다 Warrior). 네 파일 합쳐
약 10.5MB — 균열·폐허(합쳐 약 2.3MB)보다 훨씬 무겁다.

## VRM 애니메 아바타 (2026-09-20, saga-forest 에서 옮김)

`assets/models/people/anime/avatar_{sample_a,sample_b,sample_c,custom_01}.glb` —
VRoid Studio 공식 CC0 샘플 AvatarSample_A/B/C(github.com/madjin/vrm-samples,
저작권 포기·상업 이용 무료·표시 의무 없음) + 이 저장소가 GUI 자동화로 새로
빚은 avatar_custom_01(라이선스는 상업 이용 허가 CC BY로 내보냄). 넷 다
`saga-forest/assets/ASSET_LICENSES.md`의 같은 절과 같은 파일(md5 동일) —
자세한 출처·내보내기 경위는 그쪽 문서 참고. 이 판은 인물이 안 걷어(정지
초상뿐) `anim`을 몸 파일 자신으로 줘 리타깃을 안 건다(위 MPFB와 같은
이유). `js/asset3d.js`의 `HERO_RECIPES_ANIME`(기본 꺼짐, `world3d.animeAvatar`
손잡이)로만 쓰인다.

## VRM 애니메 아바타 가공 (2026-09-20)

`assets/models/people/anime/avatar_*.glb` 넷은 `tools/glb-compress/vrm-slim.mjs` 로 **가공한 파일**이다 —
표정 모프 타깃(54~57개)을 떼고 같은 재질 프리미티브를 합쳤다(정점·뼈·재질·텍스처는 그대로, 용량 25MB → 11MB,
캐릭터당 드로우콜 90~135 → 14~19). 다섯 판 복사본은 같은 파일(md5 동일)이다.

## 시간 틈 사람 아홉 — 사가고에서 복사 + 사이버펑크 주인공 (2026-09-24, `models/people/folk/`, PLAN §5-12)

Quaternius CC0 1.0. 여덟(m_SWAT·m_Worker·m_BusinessMan·w_Suit·m_Hoodie·w_SciFi·s_Astronaut1·s_Astronaut2)은 사가고
`assets/models/people/folk/` 복사(원래 사가블로가 poly.pizza "Ultimate Modular Men/Women Pack"·"Ultimate Space Kit" 에서 받은 것,
이미 Meshopt) — 경위는 사가고 `assets/ASSET_LICENSES.md` "Quaternius — 세 시대 사람·적" 절. `f_Cyber.glb` 는 미러
<https://github.com/trebeljahr/quaternius-showcase> `public/glb/cyberpunk_pack/Character.glb` 를 `tools/glb-compress` 로 Meshopt(850KB → 247KB).
전부 제 클립(걷기·대기·공격·죽음) 내장. `data-force.js` `TIME_OFFICERS` 의 `body` 가 가리킨다.

## 병사 두 벌 — 원정군·전투 무리 (2026-09-25, `models/troops/`, CHARACTER_UNIQUENESS ⑤)

Quaternius CC0 1.0, 사가블로에서 md5 그대로 복사(이미 Meshopt). `Knight_Male.glb` = "Ultimate Animated Character Pack"
(opengameart.org/content/animated-characters-pack, 경위는 사가블로 `assets/ASSET_LICENSES.md` "캐릭터 13차분") —
클립 11개(`CharacterArmature|Idle·Walk·Punch·RecieveHit·Defeat·SitDown`…). `Horse_Farm.glb` = poly.pizza "Farm Animal Pack"
(사가블로 `animals_extra/`, 같은 파일 절) — 클립 `Armature|Idle·Walk·Run·Death`. `js/asset3d.js` `buildTrooper` 가 부른다
(보병 = 기사, 기병 = 짐말 위 기사). 창은 이미 있던 `weapons/spear.glb`.

## AI 생성 도감 초상 (2026-09-29)
| 항목 | 내용 |
|---|---|
| **파일** | `assets/portraits/hero/<id>_s.webp`(192×192)·`<id>_c.webp`(300×344) — 도감 105 인물 |
| **만든 법** | swbins3 로컬 sd-webui + **Animagine XL 4.0 Opt**(CreativeML OpenRAIL++-M, 상업 사용 허용) — `tools/ai-art/gen.py` → `pack_web_portraits.py` |
| **프롬프트** | 인물 이름 없이 문화·역할·성별·나이·머리·눈 묘사만 — `tools/ai-art/batches/web_heroes_105.json` |
| **장수 194 초상** | 사가국지에만 있는 장수 194 명의 초상(`assets/portraits/hero/<id>_s.webp`·`_c.webp`)도 같은 모델·같은 방식 — 공방 몸(`tools/char-forge/recipes/realm`, 입력 전부 CC0) 렌더를 밑그림으로 한 이미지→이미지(`tools/ai-art/batches/web_realm_194_i2i.json`, denoise 0.55), 굽기는 `pack_web_portraits.py --src web_realm_194_i2i --games saga-realm`, 출처(모델·라이선스·씨앗·밑그림 몸)는 같은 `_ai_provenance.json`. 처음 글만으로 만든 판(`web_realm_194.json`)은 이 판으로 대체됨 |
| **밑그림** | 도감 105 인물은 자체 공방 몸(`tools/char-forge`, CC0 재료+레시피) 가슴 위 렌더를 밑그림으로 한 이미지→이미지 생성(`render_busts.py`, `batches/web_heroes_105_i2i.json`, denoise 0.55) — 밑그림 = 공방 몸 렌더 |
| **출처 기록** | `assets/portraits/hero/_ai_provenance.json`(모델·라이선스·씨앗) |
| **주의** | AI 생성물은 저작권 보호가 약하다. 되돌리려면 git 에서 이전 webp 복구 |


## 배경음 (`assets/audio/bgm/`)

2026-10-01 자체 생성 — `swbins3/music-gen`(로컬 ACE-Step 1.5, 코드·가중치 MIT, 상업 사용 허용). 원작 곡명·아티스트 이름은 프롬프트에 쓰지 않았다. 출처 기록 정본: `saga-web/shared/audio/bgm/<판>-<장면>.license.json`.

| 파일 | 만든 말(프롬프트) | 만든 법 | 비고 |
|---|---|---|---|
| `saga-realm-town.ogg` | stately imperial court music, guzheng, bamboo flute, slow dignified 66 bpm, instrumental | 로컬 AI 생성(ACE-Step 1.5, MIT·상업 허용, 씨앗 5101) | 사용자가 후보 a 선택 |
| `saga-realm-field.ogg` | grand strategy map theme, epic slow march, low drums, bowed strings, determined and calm 84 bpm, instrumental | 로컬 AI 생성(ACE-Step 1.5, MIT·상업 허용, 씨앗 5201) | 사용자가 후보 a 선택 |
| `saga-realm-battle.ogg` | war march intensifying, large drums, horns, fast heroic strings, battlefield 140 bpm, instrumental | 로컬 AI 생성(ACE-Step 1.5, MIT·상업 허용, 씨앗 5301) | 사용자가 후보 a 선택 |

## 2D 스프라이트 시트 (`assets/sprites2d_sheets/`)

2026-10-01 자체 제작 — 공방(`tools/char-forge/gear_sprites.py`)이 CC0 VRoid 몸(`tools/char-forge/_src/cc0_vroid`) 위에 절차 생성 장비를 입혀 Blender 로 굽는다(128px·8프레임·방향 3·동작 idle/walk/attack/hit/death, WebP). 병사·장수 4벌: `pool_basem_human_107`, `pool_e_human_131`, `pool_d_human_123`, `pool_basef_human_115`. 벌마다 `manifest.json` 에 몸·종류·규격·출처 문구. 원작 에셋 없음. 이 판은 아직 안 읽는다(W 티켓 — 인물·괴물 id 연결과 `sprite.js` 배선).
