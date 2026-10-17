# 아이디어 수신함 — 중간에 들어온 말은 여기 한 줄 (절차 `tasks/INTAKE.md`)

형식: `- [ ] 날짜 · "사용자 말 그대로" · 읽은 뜻 · 갈래/판`. 처리(티켓·폐기)는 R-0 세션(페이블 또는 부감독 오퍼스)이 하고 `[x]` + 티켓 번호, 처리 끝난 줄은 `archive/INBOX-HISTORY.md` 로 옮긴다. 소넷은 추가만.
- [ ] 10-12 · (U-0104 유니티 넘김) · 네 판(2나락·3마을·4종횡·5천하) 효과음은 이제 자체 92종(`SagaSfx`)을 이름으로 먼저 쓰고, 빌린 Kenney 클립(`saga-unity/Assets/Art/Audio/Kenney_*`)은 씬 필드(GameBootstrap·ForestHostileEncounterUi·ForestCollectSpot/FruitTree·StoryEnemy·RealmCommandUi 등)가 아직 가리켜 **대체용으로만** 남음 → 씬 재빌드 때 그 필드·파일 걷기(1만리 옛 Kenney 필드 포함) · 유니티
- [ ] 10-13 · (K-0093 자체툴 넘김) · 자체 PBR 12세트(정본 `saga-assets/textures_real`) — 유니티 사실 재질에 재사용(웹은 W-0196 끝) — **R-0 10-16 유니티 PBR 폴더 교체는 K-0130** · 유니티
- [ ] 10-15 · (K-0110 넘김) · 같은 AI 움직이는 초상이 `saga-godot/assets/portraits/live` 에도 — 켜도 됨 · 고돗
- [ ] 10-15 · (K-0086 넘김) · 사실 몸 verify 통과 — U-0036 B·U-0037 B 씬 재빌드 R-0 가능 · 유니티
- [ ] 10-16 · "추가적으로 요청사항은 메뉴 ui가 전체적으로 변경이 되어야 할것 같아" · 메뉴 UI(메인·일시정지·가방·설정 등 창 틀·배치·그림체)를 판 하나씩 땜질 말고 전체 갈아엎기 — 어느 판·트랙인지 안 말함, R-0 가 다섯 판 웹 먼저(플래그십 1만리·5천하) + 3D 둘도 같은 틀인지 한 번 묻기. 자체툴 몫은 창 틀·버튼·아이콘 그림체 C 묶음 · 웹/고돗/유니티/자체툴 — **R-0 10-16 웹 → W-0252~0256**(같은 틀 + 판별 색 옷 K-0040 9-slice · ☰ 메뉴 화면, 정본 제안·거부권) · **웹 끝 10-16** · 3D 둘은 웹 틀 끝난 뒤 각 R-0 가 같은 규격
- [ ] 10-17 · (W-0268 웹 넘김) · `tools/asset-audit/models_inventory.py` 의 쓰임 판정이 파일 줄기만 봐서 코드가 이어 붙이는 경로(`'character-' + letter`·`'avatar_sample_' + n`)와 `asset-forge/kitbash.py` 부품 입력을 "안 씀" 으로 셈(80 중 52 오탐) — 다음 재고 전에 판정 보강 · 자체툴
- [ ] 10-17 · (K-0118 넘김, 페이블) · UI 아이콘 28 정본 도착 `saga-web/shared/assets/icons/icon64/ui_<lucide>_g0.png`(map.json `shared:ui:<lucide 이름>`, 코드 실루엣 CC0) → `shared/js/icon.js` SVG 표(Lucide ISC)를 이 그림으로 갈아 끼우고 Lucide 지움 + 다섯 판 ASSET_LICENSES ISC 줄 지움 · 스킬 224(`<판>:skill:<id>`)·직업 26(`<판>:job:<id>`)·5천하 지도 표식 5(`saga-realm:mapmark:<뜻>`)는 SD 사슬 뒤 같은 map.json 에 들어오니 그때 2나락·4종횡 `emoji:` 자리·5천하 🚩🏕️ 배선 · 웹
- [ ] 10-17 · (K-0133 넘김, 페이블) · 정본 `creatures3d` 111 전부 재질·결 고침(검은 덩어리 → 입력 그림 색) → 웹 shared/creatures3d 222 복사 끝 — 1만리·2나락·3마을 sw VERSION 올리기 · 2D 짐승 그림은 K-0134 뒤 · 웹
- [ ] 10-17 · 사용자 "3d,2d 게임성" 참고작 목록(판마다 4~6, 정본 루트 README 표) — README·index 반영 끝 · **웹 설계 W-0274 끝** · 고돗·유니티 PLAN 반영은 각 R-0 · 웹/고돗/유니티
- [ ] 10-17 · (K-0117 넘김) · 빌린 mp3 11 이 자체 소리로 바뀜(1만리 sfx 7 · 3마을 bgm forest · 4종횡 bgm battle·forest·town, 이름 그대로) → ① ASSET_LICENSES 손 절 지우기(1만리 373~433 OGA "RPG Sound Pack"·"100 CC0 SFX #2" 천둥 절 · 3마을 562~ BGM 절 · 4종횡 207~209 표) ② 세 판 sw VERSION ③ `node tools/qc.mjs --game saga-go` 플레이 "1만리 PC 클릭 이동 walkingTo 0.00" FAIL — 10-17 SD 사슬+Blender 로 4fps 일 때 났다, 부하 없을 때 다시 보고 진짜면 W 티켓 · 웹
- [ ] 10-17 · (K-0116 넘김) · 자체 `world3d/wpn_{club,scroll,fan,brush}_01.glb`·`mill_01.glb` 도착 → 2나락 `asset3d.js` 486·508·528~530 다섯 줄을 새 id 로(fan 은 brush 재사용 끝냄), 옛 weapons/·hexagon windmill 지우기·ASSET_LICENSES · 쥐는 축이 손에 맞는지 화면 확인 · 웹
- [ ] 10-17 · (K-0126 넘김) · 1만리·2나락·5천하 빌린 건물·자연·소품·던전 152 → 자체 world3d 짝 표 `tools/world-forge/data/k126_needs.json`(key·부르는 자리·pair, 새 13 포함) → 판마다 asset3d.js·prop3d.js 경로를 짝 id 로·옛 파일 지우기·ASSET_LICENSES · 웹
- [ ] 10-17 · (K-0130 넘김) · 유니티 `Art/Environment/PBR` 텍스처 28 이 자체 PBR 로 같은 이름 덮어씀(.meta·.mat 그대로) → 재가져오기 뒤 장면 색·결 확인(조약돌이 네모 판석으로, 나무껍질 결 △) · ASSET_GUIDE 의 Poly Haven 줄 · 유니티
- [ ] 10-17 · "등으로 마무리했었으니 · 내가 말하지 않은 게임들도 첨부 해도 됨" · 참고작을 장르 대표작까지 넓혀 판별 격차표·우선순위 → 티켓(W-0276~0285 다음 묶음) · 페이블 R-0 · 웹
- [ ] 10-17 · (K-0115 넘김) · 자체 단풍 나무 5 `shared/assets/world3d/tree_{broadleaf_01,broadleaf_02,broadleaf_03,birch_01,pine_01}_autumn.glb` → 3마을 `core.js:490` reg `tree:*:autumn` 을 새 id 로, 옛 Quaternius 가을 7 지우기·ASSET_LICENSES · 웹
- [ ] 10-17 · (K-0123 넘김) · 5천하 보병 `troops/Knight_Male.glb` 가 자체 병사(코드, 978 삼각형)로 같은 이름 덮어씀 → 3D 원정·전투 화면에서 걷기·찌르기·쓰러짐·기병 앉기 눈 확인 · asset3d.js 736 주석과 ASSET_LICENSES Quaternius 기사 절 정리 · 5천하 sw VERSION · 웹
