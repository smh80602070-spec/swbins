# 아이디어 수신함 — 중간에 들어온 말은 여기 한 줄 (절차 `tasks/INTAKE.md`)

형식: `- [ ] 날짜 · "사용자 말 그대로" · 읽은 뜻 · 갈래/판`. 처리(티켓·폐기)는 R-0 세션(페이블 또는 부감독 오퍼스)이 하고 `[x]` + 티켓 번호, 처리 끝난 줄은 `archive/INBOX-HISTORY.md` 로 옮긴다. 소넷은 추가만.
- [ ] 10-21 · (K-0162 끝 알림) · **→ W-0390(10-24)** · 이음 타일 배선 W 필요 — 이웃 비트 규칙 `assets/web2d/tile/tiles.json`(이중 격자: 반 칸 밀린 격자, i=NW1+NE2+SW4+SE8 → 4×4 아틀라스 칸, stride 272·gutter 8), 쌍 폴더 `<쌍>/atlas.webp` — 1만리 5·2나락 4·3마을 5(K-0091 forest_edge 대체)·5천하 4 · 웹/1만리·2나락·3마을·5천하
- [ ] 10-21 · (K-0161 끝 알림) · **→ U-0200(10-24)** · 같은 모션 30 팩을 유니티 Humanoid 리타깃(이름 = clips30.json game) + 판별 행동 상태 배선 · 유니티/다섯 판
- [ ] 10-21 · (K-0163 끝 알림) · **→ 티켓 K-0183·0184·0185(10-23 R-0, K-0185 끝에 [x])** · (K-0178 뒤 그 길로 — 3D 몸 밑그림 금지) 나머지 인물 ~470 일러스트 — 같은 도구 `tools/ai-art/k163_illust.py`(cast 표만 판별로 새로) 로 판마다 한 티켓(3D 몸 있는 도감 인물 순, 원격 120장≈50분이라 판당 2~3회), 1만리·3마을 주역부터 · 자체툴
- [x] 10-21 · (K-0167 끝 알림) · **→ W-0391(10-24)** · mode2d MARK 표에 25 줄 — `shared/assets/icons/icon64/ui_<이름>_g0.png`, 이모지→이름 표는 `tasks/tools/done/K-0167.md` 메모 · 웹/다섯 판 · 끝 W-0391(10-25)
- [x] 10-22 · (K-0169 끝) · **→ W-0391(10-24)** · 컷아웃 주역 둘 rig 에 무기·attack 끝 자세(코드 그대로) — cutout2d.on 기본값 볼지 · 웹 · 끝 W-0391(10-25)
- [ ] 10-22 · (K-0160 끝) · **→ W-0394(10-24)** · W-0370: 1만리 sprites2d_sheets beast_* 125(+factory_alias 4) · still 짐승(2나락 셋·4종횡 둘) · 도감 60 은 **shared/assets/sprites2d_sheets** 한 벌(mode2d base 자리 정하기) · 웹
- [ ] 10-22 · (K-0170 끝) · **→ W-0392(10-24)** · 2나락 적 종 시트 42(+alias 6) — sheetOf 가 body 시트 씀, 코끼리병 body beast_big → `dg_elephant` 짝 한 줄(beast_big = 곰 still) · 웹/2나락
- [ ] 10-22 · (K-0168·0172·0173·0174 끝) · **→ U-0200(10-24)** · 유니티 셋: ① sg_liubei 새 몸 → CharactersDex(U-0156 길) ② 소품 10 `World/<new id>`·rock_moss_01 → SelfPairs 10줄·재빌드·PolyHaven 지움 ③ UI 스킨 95 + 9-slice .meta `Resources/UI/` ④ 깨지는 조각 `World/<모델>_shard_0~3` 16·`Audio/Sfx/sfx_prop_break*` 4(K-0174, 진단 breakable `대신 False`) — 임포트 확인 · 유니티
- [ ] 10-22 · (K-0181 끝 알림) · **→ W-0393(10-24)** · 3마을 가축 그림 옴 — 2D 시트 `saga-forest/assets/sprites2d_sheets/farm_hen`·`farm_goat`(96px·5방향·idle·walk·run·hit, 공장 manifest) · 울타리 `shared/assets/world2d/pen_fence_01`(가로 이음)·`pen_gate_01` · 아이콘 material:egg·milk → fo_egg_g0·fo_milk_g0(itemicon-ids) → livestock.js draw2d 배선·`_test.html` K_WAIT 지움 · 웹 3마을
- [ ] 10-23 · (K-0180 끝) · **→ W-0392(10-24)** · W-0356: 2나락 빌린 괴물 일곱 → 자체 몸 `shared/assets/creatures3d` armored_alpaca·bumble_knight·bumble_puff·tabby_ball·hen_ball·gape_fish·finback_brute(동작 7) — 짝 `tools/world-forge/data/k122_monsters.json` built, 웹 참조 바꾸기 · 웹/2나락
- [ ] 10-23 · (G-0311 고돗 3마을 가축) · **→ K-0186(이미 있음)(10-24)** · 닭·염소 몸 `saga-assets/creatures3d/farm_hen·farm_goat.glb` 을 고돗 `assets/creatures/` 에 놓기(지금 코드 도형 대역 — `games/saga_forest/world/forest_livestock_view.gd` `_body` 만 바꾸면 됨) · 자체툴
- [ ] 10-23 · (K-0183 끝) · **→ W-0394(10-24)** · illust 한 벌 shared — `saga-web/shared/assets/illust` 116명, 다섯 판 manifest 새로(1만리·3마을 manifest 도 새로, base `../shared/assets/illust/`) · illust.js 가 base 따름 · 웹
