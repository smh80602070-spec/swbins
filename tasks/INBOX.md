# 아이디어 수신함 — 중간에 들어온 말은 여기 한 줄 (절차 `tasks/INTAKE.md`)

형식: `- [ ] 날짜 · "사용자 말 그대로" · 읽은 뜻 · 갈래/판`. 처리(티켓·폐기)는 R-0 세션(페이블 또는 부감독 오퍼스)이 하고 `[x]` + 티켓 번호, 처리 끝난 줄은 `archive/INBOX-HISTORY.md` 로 옮긴다. 소넷은 추가만.
- [ ] 10-12 · (U-0104 유니티 넘김) · 네 판(2나락·3마을·4종횡·5천하) 효과음은 이제 자체 92종(`SagaSfx`)을 이름으로 먼저 쓰고, 빌린 Kenney 클립(`saga-unity/Assets/Art/Audio/Kenney_*`)은 씬 필드(GameBootstrap·ForestHostileEncounterUi·ForestCollectSpot/FruitTree·StoryEnemy·RealmCommandUi 등)가 아직 가리켜 **대체용으로만** 남음 → 씬 재빌드 때 그 필드·파일 걷기(1만리 옛 Kenney 필드 포함) · 유니티
- [ ] 10-13 · (K-0093 자체툴 넘김) · 자체 PBR 12세트(정본 `saga-assets/textures_real`) — 유니티 사실 재질에 재사용(웹은 W-0196 끝) — **R-0 10-16 유니티 PBR 폴더 교체는 K-0130** · 유니티
- [ ] 10-15 · (K-0110 넘김) · 같은 AI 움직이는 초상이 `saga-godot/assets/portraits/live` 에도 — 켜도 됨 · 고돗
- [ ] 10-15 · (K-0086 넘김) · 사실 몸 verify 통과 — U-0036 B·U-0037 B 씬 재빌드 R-0 가능 · 유니티
- [ ] 10-16 · "추가적으로 요청사항은 메뉴 ui가 전체적으로 변경이 되어야 할것 같아" · 메뉴 UI(메인·일시정지·가방·설정 등 창 틀·배치·그림체)를 판 하나씩 땜질 말고 전체 갈아엎기 — 어느 판·트랙인지 안 말함, R-0 가 다섯 판 웹 먼저(플래그십 1만리·5천하) + 3D 둘도 같은 틀인지 한 번 묻기. 자체툴 몫은 창 틀·버튼·아이콘 그림체 C 묶음 · 웹/고돗/유니티/자체툴 — **R-0 10-16 웹 → W-0252~0256**(같은 틀 + 판별 색 옷 K-0040 9-slice · ☰ 메뉴 화면, 정본 제안·거부권) · **웹 끝 10-16** · 3D 둘은 웹 틀 끝난 뒤 각 R-0 가 같은 규격
- [ ] 10-17 · 사용자 "3d,2d 게임성" 참고작 목록(판마다 4~6, 정본 루트 README 표) — README·index 반영 끝 · **웹 설계 W-0274 끝** · 고돗·유니티 PLAN 반영은 각 R-0 · 웹/고돗/유니티
- [ ] 10-17 · "등으로 마무리했었으니 · 내가 말하지 않은 게임들도 첨부 해도 됨" · 참고작을 장르 대표작까지 넓혀 판별 격차표·우선순위 → 티켓(W-0276~0285 다음 묶음) · 페이블 R-0 · 웹
- [ ] 10-17 · (자체툴 넘김 묶음, 페이블) · 오늘 K 아홉 장의 웹·유니티 배선 줄 → `tasks/sheets/k-handoff-web-20261017.md`(아이콘 28·짐승 3D 111·mp3 11·2나락 소품 5·152 짝 표·단풍 나무 5·병사·유니티 PBR 28·세계 3D 그리기 다섯) — 웹 R-0 가 묶어 티켓, 유니티는 PBR 줄 하나 · 웹/유니티
- [ ] 10-17 · (자체툴 K-0136 → 웹 2나락) · 표식 상자 → crea:mark_pad_01·cave_hole_01·signpost_01·stele_01 — `tasks/sheets/k-handoff-opus-20261017.md` ① · 웹
- [ ] 10-17 · (자체툴 K-0127 → 고돗) · 정육면체 잎 나무·바위 → foliage/<id>_real.gltf 14 — 시트 ② · 고돗
- [ ] 10-17 · (자체툴 K-0128 → 고돗) · 2나락 방 킷·섬 밑동 사실판 world/real · KayKit·assets/dungeon 지움 — 시트 ③ · 고돗
- [ ] 10-17 · (자체툴 K-0129 → 유니티) · PolyHaven 테스트 씬만·식물 3·짐승 셋 정리 — 시트 ④ · 유니티
- [ ] 10-17 · (자체툴 K-0128 괴물 → 고돗) · 자체 괴물 몸 111 고돗 배치 끝, monster_body.gd shape→id 표 — 시트 ⑤ · 고돗
- [ ] 10-18 · (자체툴 K-0125 → 웹 1만리) · 이야기 지역 코드 도형 → world3d: **짝 24**(`tools/world-forge/data/k125_markers.json` 지역별 `pair` = {id, h(옛 높이 → AS().build mul), n(여러 개), note(코드에 남는 부품)}) + **새 20** `crea:`/world id — frost_fort_01·frost_observatory_01·frost_airship_wreck_01·frost_cableway_01·crossing_clocktower_01·crossing_platform_01·skyport_mooring_tower_01·skyport_station_01·stone_pagoda_01(skyport temple)·sunken_palace_01·sunken_lighthouse_01·amber_clockshop_01·drain_tower_01(amber tower)·vault_seedvault_01·vault_granary_01·fork_locomotive_01·castle_gate_01(fork gate)·bell_tower_01(fork tower)·statue_guard_01(statue 네 지역)·gate_light_pillars_01(crossing·skyport·sunken gate) — 정적 몸만, 도는·여닫는·켜지는 부품(바늘·고리·문짝·빛줄기·김)은 지금 코드 그대로 얹기 · 배치·ids·번들 끝 · 웹
- [ ] 10-18 · (자체툴 K-0139 → 웹) · CMU 모캡 클립 12 `saga-web/shared/assets/anim/vroid_mocap_anims.glb`(VRoid 뼈대 30fps — walk·run·idle·idle_b·turn·sit_stand·pickup·greet·cast·strong·hit·death, 걷기·달리기·서기는 제자리 반복) → asset3d.js 공용 동작(`ANIM_SRC` UAL1)처럼 `retargetInto` 로 입혀 같은 이름 클립을 이 파일 것으로 먼저(손잡이로 옛 UAL 되돌림) · W-0303 pose3d 의 코드 클립보다 우선 · sprint 는 UAL 유지 · 웹
- [ ] 10-18 · (자체툴 K-0139 → 고돗) · 같은 파일 `saga-godot/assets/anim_mocap/vroid_mocap_anims.glb` → VRoid 몸 anim_cc0 `_lib.res` 에 12 클립 갈아 끼우기(`.import` 는 고돗 세션) · 고돗