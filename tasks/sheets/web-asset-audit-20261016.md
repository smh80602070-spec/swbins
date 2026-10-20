# 웹 다섯 판 에셋 감사 — 2026-10-16 (사용자 "더 에셋 변경해야 할게 없는지 확인해봐 많이 있을거야 자세히 잘찾아봐")

**잰 방법**: ① `tools/asset-audit/audit.py --track web`(Blender 번들 파이썬, 36분) ② 실제로 받는 파일 = `saga-web/tools/playcheck/net-log.mjs all` + `--scenes=index`(데모 장면 다섯 + 진짜 index, 서버가 받은 요청) ③ 대역(도형·이모지·코드 그림) 코드 조사 ④ 빌린 출처(ASSET_LICENSES)↔코드 참조 조사 ⑤ 자체툴 배치 표(`tools/asset-place/asset-place.json`)↔판 코드 대조.
**주의**: "코드에 이름이 남음" ≠ "화면에 뜸" — 펫 신수 11종은 W-0148 로 자체 `pet_pt_*` 가 먼저, 빌린 동물 경로는 W-0163 `creatureFor` 가 자체 생물로 바꿔 끼운다. 그래서 A 는 **실제로 받은 것만**.

## A. 실제로 받는 빌린 3D·2D(약 75종) → 웹이 자체 world3d·web2d 로 바꿔 끼움
| 판 | 받는 빌린 것(예) | 바꿀 자체(예) | 티켓 |
|---|---|---|---|
| 1만리 | Quaternius 건물 3(탑)·realistic 건물 6(house_stone·tower_round·market_cross…)·자연 realistic 9(MossRock·Rock_07·Shrub·PineSapling·IslandTree·mountainside)·Bonfire·Cauldron·wayside_shrine·wooden_lantern·Grass_2·Yeti(오마주 펫) | stone_tower_01·eu_house_01·market_stall_01·rock_moss_01·rock_large_0x·bush_0x·tree_pine_0x·mountain_01·campfire_logs_01·kitchen_pot_01·altar_01·stone_lantern_01·grass_tuft_0x | W-0260 |
| 2나락 | KayKit 던전 7(pillar·chair·table·bed·torch·sword_shield·doorway)·Quaternius 소품 7(Arch·Bonfire·Mine·Temple·Tent·Wall·signpost)·자연 11·무기 4(bow·spear·staff·sword)·건물 4·pond(CC-BY)·HDRI alps·괴물 Green_Spiky_Blob | dungeon_pillar_01·chair_wood_01·table_wood_01·bed_wood_01·torch_stand_01·weapon_rack_01·rubble_*·campfire_logs_01·mine_cart_01·temple_roof_01·tent_*·signpost_01·wpn_*_common·pond_01·자체 sky IBL | W-0261 |
| 3마을 | Quaternius 가을 나무 8·TreeStump·Mushroom·Bench·WoodenTorch·banner·signpost·MarketStand·realistic 바위·HDRI alps·Kenney 2D tile_sand/water·human_13 | tree_birch/broadleaf/pine·stump_01·mushroom_01·bench_01·torch_stand_01·banner_pole_01·signpost_01·market_stall_01·rock_*·sky IBL·web2d/tile·characters2d | W-0262 |
| 4종횡 | Quaternius 나무 3·덤불 2·Rock_2·Flowers·Grass·Fence·Well·Kenney 2D tile_grass/stone | tree_broadleaf_0x·bush_0x·rock_*·flower_patch_01·grass_tuft_0x·wood_fence_01·well_01·web2d/tile | W-0263 |
| 5천하 | gear/helmet(CC-BY)·troops/Knight_Male·weapons/spear·props/Wall | eq_past_*_head·characters3d·wpn_spear_common·city_wall_segment_01 | W-0264 |

## B. 자체툴이 만들어 배치했는데 웹이 안 읽는 것 → 웹 배선
- 5천하 `assets/realm-ui` 38(K-0060 — 성 아이콘 3등급·깃발·지방 이름 붓글씨 28·세리프 서체 woff2·옻칠 판) → W-0264
- 표정 초상: 5천하 `portraits/expr` 24(6명)·2나락 4(1명) · 2나락 움직이는 초상 1(hl_mukhyang) → W-0265
- `shared/assets/competition` 70(K-0050 — 랭크 뱃지 8·메달 3·보상 아이콘 12·도전 배너 3·아레나 배경 5) → W-0265(도전 판 결과·순위 카드)
- 다섯 판 UI 세트의 게이지·말풍선·등급 틀 — 자리가 안 맞음(막대 3~6px·말 상자는 입력 칸) — 보류

## C. 대역(늘 도형) → 있는 자체 모델로(웹)
- 2나락 방 소품 무덤·우물·사당·광맥·석판 받침·갈대(src/dungeon3d/01.js:809~859, 02.js:328) → W-0261
- 1만리 이야기 지역 4~10 표지(frost·crossing·skyport·sunken·amber·stormeye·vault·fork·skyroute·skyisle·era-sites)·낚시터·파견 게시판·밤 메아리 불 → W-0260
- 4종횡 횃불·종유석·불꽃(side-view3d.js:434~487) → W-0263
- 5천하 깃발(pole+box)·전장 가장자리 소품(battle3d.js:749~754)·전술판 숲 원뿔 → W-0264
- 3마을 엇맞춤: 비석=이끼 바위·항아리=우물·병=풀·나침반/UFO/상자=우체통·도깨비불=등불·축제 줄=통나무(village3d-kinds.js:20~31) → stele_01·jar_01·vase_tall_01·chest_01·hanging_lantern_01… → W-0262

## D. 새로 그려야 하는 것 → 자체툴(K) — 수신함
1. △ UI 28 은 W-0321(K-0118) 끝 — **아이콘 한 벌(그림체 C)** — 지금 이모지·Lucide(빌린 ISC): 독·☰ 메뉴 칸·HUD 스킬 단추(2나락·4종횡)·근처 대상(1만리)·지도 표식(5천하 🚩🏕️)·떨굼 아이템(4종횡)·스킬·직업 아이콘(없음 — 다섯 판 이모지)
2. 첫 화면 캐릭터 그림 다섯(지금 이모지 🗺️⚔️🌳🏃🏯, shared/js/account.js:281)
3. 오마주 펫 15종 + 까치 몸(지금 Quaternius 괴물 대역 — standin/*)
4. 몬스터 개별 초상(지금 32장을 해시로 나눠 씀)·사람 적 초상 없음
5. 출처 문서 빠짐 39 폴더(감사 🟡license — cutscene·icons·ui·store·vfx·web2d…)
6. 1만리 people/vitruvian_v1.glb 삼각형 10만(폰 예산 2배)
7. 사람 몸이 VRoid 공식 샘플 바탕(characters3d 500·2D 렌더 8500) — 고유 모델은 미착수(메모리 project_vroid_all_characters)
8. ○ W-0321(K-0117) — 1만리 효과음 7(OGA)·Ogg 못 트는 브라우저용 mp3 BGM(OGA) — 자체 SFX 92종으로
9. (W-0260) 1만리 이야기 지역 표지 12곳(frost 비행선·crossing·skyport·sunken·amber 호박 결정·stormeye 매듭·vault 진열장·fork 격자 빛틀·skyroute·skyisle 하늘섬·era-sites 선대·nightecho 보랏불) — 고유 조형이라 world3d 에 짝이 없어 코드 도형 유지. 자체 모델로 바꾸려면 K 가 지역별 세트(≈12) 제작. 게시판 둘(낚시터·파견)은 notice_board_01 로 바꿈
10. ○ W-0321(K-0116) — (W-0261) 2나락 몽둥이(weapons/club — 자체 wpn_* 에 몽둥이 없음)·두루마리·부채·붓·방앗간(hexagon/windmill) — 짝 없어 옛 빌린 경로. 괴물 Green_Spiky_Blob 은 W-0266(몸) 몫
11. ○ W-0321(K-0115) — (W-0262) 3마을 가을 나무(Quaternius CommonTree/Birch/PineTree_Autumn 7) — world3d 에 단풍 변종이 없어 옛 길. K 가 tree_broadleaf·tree_pine·tree_birch 가을판(잎 색) 만들면 core.js reg 'tree:common:autumn'·'tree:pine:autumn' 두 줄. 2D 사람 되돌림 Kenney human_01~14(sprite.js humanImg — 초상 없는 인물 카드)는 characters2d 배선 필요(W-0266 곁)
12. (W-0266) 5천하 괴물 무장 몸 14 — KayKit 해골(Warrior·Mage·Minion·Rogue)·Quaternius 외계인 둘·악마·푸른 악마·오크·예티·거인·SkeletonSolo·좀비·괴물 뱀(data-force.js monster:) — 사람꼴(손에 무기) 자체 몸 필요. 생기면 공용 assets3d CREATURE_OF 에 짝 한 줄씩
13. (W-0266) 5천하 병사 몸 — 지금 Quaternius Knight_Male(troops/). 가벼운 자체 병사 한 벌: 뼈 Hips·FistR(창 쥘 손), 세력 색 칠할 천 재질 하나(이름 Red 또는 asset3d TROOP_TINT 를 바꿀 이름), 걷기·대기·치기·쓰러짐·SitDown 클립 — 무리 수십이 나눠 입으니 삼각형 적게

## E. 안 쓰는 빌린 파일(참조 0, 배치 표에도 없음) → 웹이 지움
1만리 `sprites2d/portrait/serious` 18(EverFace)·`portrait/cute` 3(nonemo)·`assets/_wip/vitruvian-test` · 2나락 Quaternius 건물 9(House_1~4·Blacksmith·Mill·Stable·Well·Bell_Tower)·Mountain_1/2·Tex_Crow · 5천하 `buildings/asian_parts` 2 → W-0259

## 자체툴 재고 시트와 맞춤(10-16 같은 날)
[borrowed-assets-audit-20261016](borrowed-assets-audit-20261016.md) — 2·3·4(웹 3D 사람·괴물, 데모 장면 net-log 엔 덜 잡힘) → **W-0266** · 9(안 쓰는 옛 파일 ≈500) → **W-0259 에 더함**(Kenney 사람 30 은 웹 조사와 엇갈림 — 지우기 전 확인) · 1(Poly Haven 재질) → K-0113 · 7·8·12 → 수신함 그대로.

## 그 밖
- 404 둘(favicon.ico·`_shared/…/altar_01.license.json` — 판 단독 서버용 경로를 먼저 두드리는 설계, 해 없음)
- 감사 ⚪unref 20(2D 시트 hit.webp — 동적 경로, 오탐)
