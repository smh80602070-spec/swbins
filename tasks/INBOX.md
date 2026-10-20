# 아이디어 수신함 — 중간에 들어온 말은 여기 한 줄 (절차 `tasks/INTAKE.md`)

형식: `- [ ] 날짜 · "사용자 말 그대로" · 읽은 뜻 · 갈래/판`. 처리(티켓·폐기)는 R-0 세션(페이블 또는 부감독 오퍼스)이 하고 `[x]` + 티켓 번호, 처리 끝난 줄은 `archive/INBOX-HISTORY.md` 로 옮긴다. 소넷은 추가만.
- [ ] 10-12 · (U-0104 유니티 넘김) · 네 판(2나락·3마을·4종횡·5천하) 효과음은 이제 자체 92종(`SagaSfx`)을 이름으로 먼저 쓰고, 빌린 Kenney 클립(`saga-unity/Assets/Art/Audio/Kenney_*`)은 씬 필드(GameBootstrap·ForestHostileEncounterUi·ForestCollectSpot/FruitTree·StoryEnemy·RealmCommandUi 등)가 아직 가리켜 **대체용으로만** 남음 → 씬 재빌드 때 그 필드·파일 걷기(1만리 옛 Kenney 필드 포함) · 유니티
- [ ] 10-13 · (K-0093 자체툴 넘김) · 자체 PBR 12세트(정본 `saga-assets/textures_real`) — 유니티 사실 재질에 재사용(웹은 W-0196 끝) — **R-0 10-16 유니티 PBR 폴더 교체는 K-0130** · 유니티
- [ ] 10-15 · (K-0110 넘김) · 같은 AI 움직이는 초상이 `saga-godot/assets/portraits/live` 에도 — 켜도 됨 · 고돗
- [ ] 10-15 · (K-0086 넘김) · 사실 몸 verify 통과 — U-0036 B·U-0037 B 씬 재빌드 R-0 가능 · 유니티
- [ ] 10-16 · "추가적으로 요청사항은 메뉴 ui가 전체적으로 변경이 되어야 할것 같아" · 메뉴 UI(창 틀·배치·그림체) 전체 갈아엎기 — 다섯 판 웹 먼저. 자체툴 몫은 창 틀·버튼·아이콘 그림체 C 묶음 · 웹/고돗/유니티/자체툴 — **R-0 10-16 웹 → W-0252~0256**(같은 틀 + 판별 색 옷 K-0040 9-slice · ☰ 메뉴 화면, 정본 제안·거부권) · **웹 끝 10-16** · 3D 둘은 웹 틀 끝난 뒤 각 R-0 가 같은 규격
- [ ] 10-17 · 사용자 "3d,2d 게임성" 참고작 목록(판마다 4~6, 정본 루트 README 표) — README·index 반영 끝 · **웹 설계 W-0274 끝** · 고돗·유니티 PLAN 반영은 각 R-0 · 웹/고돗/유니티
- [ ] 10-17 · (자체툴 K-0127 → 고돗) · 정육면체 잎 나무·바위 → foliage/<id>_real.gltf 14 — 시트 ② · 고돗
- [ ] 10-17 · (자체툴 K-0128 → 고돗) · 2나락 방 킷·섬 밑동 사실판 world/real · KayKit·assets/dungeon 지움 — 시트 ③ · 고돗
- [ ] 10-17 · (자체툴 K-0129 → 유니티) · PolyHaven 테스트 씬만·식물 3·짐승 셋 정리 — 시트 ④ · 유니티
- [ ] 10-17 · (자체툴 K-0128 괴물 → 고돗) · 자체 괴물 몸 111 고돗 배치 끝, monster_body.gd shape→id 표 — 시트 ⑤ · 고돗
- [ ] 10-18 · (자체툴 K-0139 → 고돗) · 같은 파일 `saga-godot/assets/anim_mocap/vroid_mocap_anims.glb` → VRoid 몸 anim_cc0 `_lib.res` 에 12 클립 갈아 끼우기(`.import` 는 고돗 세션) · 고돗
- [ ] 10-18 · (자체툴 K-0137 → 고돗) · 주역 10 몸 바뀜(새 머리카락·뼈 비율·얼굴 레이어 — hl_mukhyang·kr_gyebaek·fu_jongwang·tb_baekgi·ru_geohae·sg_caocao·sg_liubei·sg_lubu·sg_sunquan·sg_zhugeliang) · 원본 `tools/char-forge/_out/vroid/<id>/<id>.glb`·`<id>_anims.glb`(이 PC) → `vroid_intake.sh --only <10>` 로 얼굴 데칼·anim_cc0 `_lib.res` 다시 · 고돗
- [ ] 10-18 · (자체툴 K-0137 → 유니티) · 같은 주역 10 몸 바뀜 — 유니티가 이 열 명을 VRoid 몸으로 쓰는 자리가 있으면 같은 원본으로 갈아 끼우기(없으면 [x]) · 유니티
- [ ] 10-19 · (자체툴 K-0136 → 웹 1만리·2나락) · 3D 땅 타일 8 `shared/assets/tiles/ground/<id>.webp`(512 이음매 없음) — 1만리 `landTexture` 단색 대신 go_*(마을 흙·돌길·들풀·물가), 2나락 `town3d*.js` 바닥에 dg_*(마을 흙·던전 돌·동굴 바위·늪) · 웹
- [ ] 10-19 · (자체툴 K-0135 → 웹 W-0296) · 4종횡 타일 80·소품 50·앞 층 10(`saga-story/assets/web2d/{tile,prop,bg}`, 규격 그대로) + 사람 jump·fall 500(`characters2d8/<id>/`, mode2d 가 이미 읽음) · 웹
- [ ] 10-19 · (자체툴 K-0121 → 웹 2나락) · 종 몸 초상 27+17(K-0144)+10(K-0145)·5천하 용·외계 2·사람 적 18 `portraits-monster/<id>_c.webp` — idOf·foeBody 가 body 의 id 먼저(짝 `tools/ai-art/data/k121_targets.json`) · 웹
- [ ] 10-19 · (자체툴 K-0122·K-0120 → 웹) · 빌린 괴물 → `creatures3d/<id>`(표 `tools/world-forge/data/k122_monsters.json`), `FistR` 는 뼈 아닌 노드 · 펫 `world3d/pet_<id>.glb` + 2D `beast_<펫 id>.png`(1만리 sprite.js 표 `pk_x:'pk_x'`) · 웹
- [ ] 10-19 · (자체툴 K-0143 → 웹 1만리) · 종 몸 2D 시트 95 `shared/assets/creatures2d/<creatures3d id>/`(K-0090 꼴, manifest ortho_m 실제 크기) — 2D 짐승 풀은 종 id 먼저, 없으면 옛 mon_* · 웹
- [ ] 10-19 · (웹 W-0336·W-0339 → 자체툴) · 2D 오딘스피어식 인물 부위 그림(뼈 16·부위 webp, 규격 `shared/js/cutout2d.js` 머리)·장소별 겹 배경 5~7 층 / 3D 원신+파판 규격(`shared/js/look3d.js`)에 맞춘 환경 모델·재질 · 자체툴 — **2D 절반 → K-0150**(10-20), 3D 는 W-0339 뒤
- [ ] 10-19 · (자체툴 K-0138 → 웹) · 16방향 주역 10 `characters2d16/<id>/sheet.json`(역할 9) — gen-assets3d-ids · 웹
- [ ] 10-20 · (고돗 G-0248 → 자체툴) · 원신식 얼굴 SDF 한 장 `saga-godot/assets/face_sdf/face_sdf.png`(VRoid 얼굴 UV 공용, 빛 = 캐릭터 오른쪽 기준 — 반대면 `face_sdf_flip=-1`) + 앞머리 그림자 띠 · 넣으면 바로 켜짐 · 고돗
