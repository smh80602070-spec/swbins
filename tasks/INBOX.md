# 아이디어 수신함 — 중간에 들어온 말은 여기 한 줄 (절차 `tasks/INTAKE.md`)

형식: `- [ ] 날짜 · "사용자 말 그대로" · 읽은 뜻 · 갈래/판`. 처리(티켓·폐기)는 R-0 세션이 하고 `[x]` + 티켓 번호, 끝난 줄은 `archive/INBOX-HISTORY.md` 로 옮긴다. 소넷은 추가만. (10-30 정리: 아래는 열린 줄 요약, 줄 원문 전부는 보관본 "2026-10-30 정리" 절)
- [ ] 10-25 · (K-0195) GLB `world/` 같은 이름 열(바람개비 등) · 고돗 G-0387 배선 끝, **고돗 .import 필요(자체툴)** · 유니티 U-0242 끝
- [ ] 10-25 · "다섯 판 장비·세트·고유·스킬 다양성(디아블로·PoE 결)·군단" · 웹 W-0435(하위 W-0436~0440)·고돗 G-0398~0402·유니티 U-0244~0246 끝(U-0247·0248 은 유니티 큐)
- [ ] 10-25 · (W-0435) 다섯 판 장비·세트·고유·스킬 이름·수치 표 생성기(판별 목표 수는 보관본) · JSON 산출, 실명·원작 수치 금지 · 자체툴
- [ ] 10-30 · (W-0441) 옛 CC-BY 파일 지우기 — 자체툴이 확인: `credits.py` 는 돌려 OK 지만 **파일을 지우면 404** — 아직 웹 목록이 가리킨다(dungeon `asset3d.js` gear:cape·`asset3d-people.js` pphazmat_man·Soldier2, realm `asset3d.js` gear/helmet·viking_helmet·weapons/brush, 네 판 `assets3d.js` standin/Wizard, go `asset3d.js` Crow·quaternius_rpg/Wizard). 웹이 이 목록 줄을 빼고 `ASSET_LICENSES.md` 해당 절을 고친 뒤 파일 삭제 · 웹
- [ ] 10-25 · (K-0193) 옆보기 발판 키트 GLB → 4종횡 발판·사다리 · 고돗 G-0403 끝(.import 필요, 자체툴)
- [ ] 10-25 · (K-0193) 땅 섞음 결 셋(mud_gravel·path_grass·field_mix)·도형 소품 갈기 · 유니티 U-0241 끝, 웹·고돗 기록 없음
- [ ] 10-25 · "앞모습 됫모습이 있어야지" · 컷아웃이 위아래 걸어도 옆모습 · 웹 임시 W-0446 끝(위아래·대각은 옛 시트), 앞·뒤 rig 는 K-0198
- [ ] 10-25 · "아직 가져온거 쓰느곳은 없나?" · 5천하 무기·좀비·외계인은 자체 짝으로 끝 · 남음: 1만리 fusion 소품·5천하 병사 몸·2나락 시대 손님·3마을 건물 짝 판단
- [ ] 10-25 · (W-0444) 3마을 자체 짝 없는 빌린 것(우주 집·기지·rover·solarPanel·mech·Kenney 초막 셋) · 자체판 · 자체툴
- [ ] 10-26 · "5천하는 … 전략 시물 알피지 처럼" · 조조전식 장 흐름 · 웹 W-0450 끝(`tasks/web/done/W-0450.md`) · 고돗·유니티 같은 흐름으로(G·U 티켓 R-0)
- [ ] 10-30 · (K-0187) 어린이 밑몸 38명 → 어른 키 정본 교체 끝(웹 GLB·2D 시트 올림) · 유니티: engine_characters 다시 + CharactersDex 38 복사(U 티켓) · 고돗: 인물 38 다시 가져오기(G 티켓) · 자체툴 끝
- [ ] 10-30 · (K-0199) 컷아웃 앞·뒤 동작 팩 `_clips/front.json`·`back.json`(각 196, 웹 shared 에 있음) 을 엔진 `cutout2d.js` 가 방향별로 읽게 + `PACK_OK`(지금 13) 밖 클립(지팡이·막기·넘어짐·생활 동작 등 98 중 나머지) 열기 · 웹 · 앞·뒤는 K-0198 대표 눈 ○ 뒤
- [ ] 10-30 · (K-0196 ④) 세트 문양 32px 10개 `saga-assets/icons/mark32/set_<id>.png`(+ `index.json` "세트 id → 파일", license/) 올림 — 웹: 2나락 세트 옷 칸·도감에 세트 이름 옆 표식으로 붙이기(웹 shared 복사는 `place.py` 쪽, 아직 안 함). 세트 아이콘 알맹이에서 코드로 줄인 것이라 새 그림 없음 · 웹
- [ ] 10-30 · (K-0193) 배경 새 에셋 배선 — 4종횡 바닥 변주 `side-cand/floor`(mossy_stone·diag_brick, △ pale_cobble·diag_brick_b)·발판 투명 PNG `side-cand/plat_cut`(wood·stone 4) · 1만리 go_stone_b·c·d 끝(field2d variantOf) · 3D 먼 산 띠 `sky/ridge_go_band.webp`(2048×256, farland3d rim 에 얹기) · 2나락 `sky_sunset_*`·5천하 `realm-ui/castle_s·m·l` 은 있는데 안 씀 · 웹(W-0415 ③) · 고돗도 같은 먼 산 띠 가능
- [ ] 10-30 · (K-0202) UI 2차 A 로 정본 `saga-assets/ui/<판>`(부품 19×5) 교체 끝, 웹은 덮음 · 유니티: `Resources/UI/<판>` 다시 복사(`place --item ui-skin`, .meta 는 안 올림) · 고돗: `assets/ui_skin` 다시 복사 + .import · 웹: 판별 글꼴·모서리 CSS(W 줄) · 자체툴 끝
- [ ] 10-30 · (K-0202) 4종횡 표시 글꼴 `fonts/BlackHanSans-saga.woff2`(웹 shared·종횡 폴더에 있음) — 종횡 `skin-ui.css` `SkinHead` 를 주아→Black Han Sans 로 · 웹
- [ ] 10-30 · (K-0202) 1만리 UI 아이콘 60(`saga-assets/icons/glyph/go/<이름>_128·_64.png`) — js 의 이모지를 이 그림으로(★ 205·🪙 120·⚔ 102 …, 이름은 `tools/ai-art/make_k202_icons.py` LIST) · place 항목 새로(glyph 폴더는 아직 어디에도 안 감) · 웹 · 나머지 네 판은 자체툴이 뒤따라 만듦
- [ ] 10-30 · (K-0202 ④) 이모지 대신 쓸 UI 아이콘 59종 × 다섯 판 `saga-assets/icons/ui5/<판>/<개념>.png`(128)·`_64.png` + `index.json`(개념 → 이모지 짝) — 웹: 다섯 판 UI 의 이모지(📋🪙★⚔📜🌾…)를 판 폴더의 아이콘으로(판마다 결이 다름 — go 지도판·dungeon 철판·forest 천 패치·story 만화·realm 목판). 웹 shared 복사는 place 쪽, 아직 안 함 · 웹
- [ ] 10-31 · "프로젝트 개선점" · 10-30 검토 `tasks/sheets/game-review-20261030.md` 7개(근거·검증은 시트): 웹 ①5천하 장 흐름 복귀 뒤 3D 렌더 안 멈춤(W-0487⑤) ②2나락 무기 look→공격 클립 표 ③1만리 패배 회수 시간 실측 ④3마을 일과→행동 안내·PLAN §4 모순 ⑤4종횡 구역 전환 막(W-0487⑦) ⑥판별 카메라 배율 실측 · 유니티 ⑦U-0247 예산(기존 대기 유지) · 고돗: 첫걸음 실화면·이어하기 · 웹·유니티·고돗
