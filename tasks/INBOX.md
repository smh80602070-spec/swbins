# 아이디어 수신함 — 중간에 들어온 말은 여기 한 줄 (절차 `tasks/INTAKE.md`)

형식: `- [ ] 날짜 · "사용자 말 그대로" · 읽은 뜻 · 갈래/판`. 처리(티켓·폐기)는 R-0 세션(페이블 또는 부감독 오퍼스)이 하고 `[x]` + 티켓 번호, 처리 끝난 줄은 `archive/INBOX-HISTORY.md` 로 옮긴다. 소넷은 추가만.
- [ ] 10-21 · (K-0162 끝 알림) · 이음 타일 배선 W 필요 — 이웃 비트 규칙 `assets/web2d/tile/tiles.json`(이중 격자: 반 칸 밀린 격자, i=NW1+NE2+SW4+SE8 → 4×4 아틀라스 칸, stride 272·gutter 8), 쌍 폴더 `<쌍>/atlas.webp` — 1만리 5·2나락 4·3마을 5(K-0091 forest_edge 대체)·5천하 4 · 웹/1만리·2나락·3마을·5천하
- [ ] 10-21 · (K-0165 끝 알림) · 그림만 바뀜(자리·이름 같음) — 3마을·5천하 물 바탕 `forest_water`·`realm_water` 새 물빛 + 물 쌍 아틀라스 3 · 4종횡 bg2d 깊은 동굴·숲 · 발판 산 사당·궤도 기지 색 — 캐시 갱신에 sw.js VERSION 올림 필요 · 웹/3마을·4종횡·5천하
- [ ] 10-21 · (K-0161 끝 알림) · 같은 모션 30 팩을 유니티 Humanoid 리타깃(이름 = clips30.json game) + 판별 행동 상태 배선 · 유니티/다섯 판
- [x] 10-21 · (W-0356 끝 알림) → K-0180 · 빌린 괴물 웹 참조 — 5천하·3마을 0, 2나락은 quaternius Alpaking_Evolved·Armabee 둘·Cat·Chicken·Fish 둘만 남음(자체 몸 없음) → 그 일곱 몸 만들면 옛 monsters/ 폴더 지워도 됨(W-0360) · 자체툴
- [x] 10-21 · (G-0282 대기 알림) → K-0176 끝(고돗 anim_mocap 에 clips30 놓음, .import 는 고돗 세션) · K-0161 `saga-assets/characters/anim-src/mocap/vroid_clips30_anims.glb`(+license) 를 고돗 `saga-godot/assets/anim_mocap/` 로 place(asset-place `anim-mocap` 항목에 파일 하나 더) → G-0282 풀림 · 자체툴
- [x] 10-21 · (W-0359 ① 알림) → K-0176 끝(portraits-hero 대상 shared · 묶기 도구 shared, bake.mjs 는 웹 도구라 다시 구울 때 --out shared) · 인물·펫 초상 hero·pet 은 웹 다섯 판이 `saga-web/shared/assets/portraits/{hero,pet}/` 한 벌만 읽음(판 사본 지움) → asset-place `portraits-hero`·펫 초상 targets·bake-portraits 출력 자리를 shared 로(안 고치면 다음 place 가 판 사본 5000 을 되살림) · 자체툴
- [x] 10-21 · (W-0359 ② 알림) → K-0176 끝(bgm 판 대상 뺌) · 웹 bgm ogg 는 `saga-web/shared/audio/bgm/<판>-<때>.ogg` 만 읽음(판 saga-<판>-*.ogg 지움) → asset-place `bgm` 판 dir targets 빼기 · 자체툴
- [ ] 10-21 · (K-0163 끝 알림) · (K-0178 뒤 그 길로 — 3D 몸 밑그림 금지) 나머지 인물 ~470 일러스트 — 같은 도구 `tools/ai-art/k163_illust.py`(cast 표만 판별로 새로) 로 판마다 한 티켓(3D 몸 있는 도감 인물 순, 원격 120장≈50분이라 판당 2~3회), 1만리·3마을 주역부터 · 자체툴
- [ ] 10-21 · (K-0167 끝 알림) · mode2d MARK 표에 25 줄 — `shared/assets/icons/icon64/ui_<이름>_g0.png`, 이모지→이름 표는 `tasks/tools/done/K-0167.md` 메모 · 웹/다섯 판
- [x] 10-22 · (G-0287 대기 알림) → K-0177 끝: **파일엔 모프 있음**(고돗 설치본 299 얼굴 조각 2231 전부 targets = 이름표 11, dj_gapju 77) — 임포트 결과·찾는 쪽 확인 필요(수신함 G 줄) · 고돗 `assets/characters_dex/*.gltf` 모프 targets 0(이름표만, 웹 characters3d 는 77) → Fcl 모프 살려 다시 내보내기 — NPC·주인공 깜박임·표정·입 · 자체툴
- [ ] 10-22 · (K-0169 끝) · 컷아웃 주역 둘 rig 에 무기·attack 끝 자세(코드 그대로) — cutout2d.on 기본값 볼지 · 웹
- [ ] 10-22 · (K-0160 끝) · W-0370: 1만리 sprites2d_sheets beast_* 125(+factory_alias 4) · still 짐승(2나락 셋·4종횡 둘) · 도감 60 은 **shared/assets/sprites2d_sheets** 한 벌(mode2d base 자리 정하기) · 웹
- [ ] 10-22 · (K-0170 끝) · 2나락 적 종 시트 42(+alias 6) — sheetOf 가 body 시트 씀, 코끼리병 body beast_big → `dg_elephant` 짝 한 줄(beast_big = 곰 still) · 웹/2나락
- [ ] 10-22 · (K-0171 끝) · 그림만 바뀜: 바탕 넷+이음 쌍·4종횡 옛 싸움터 far·5천하 rts_inf_ally · 웹
- [x] 10-22 · (K-0171) → K-0179 · 바탕 넷 만화경 무늬(go_sand·go_stone·realm_stone·go_water) → ground_tile · 자체툴
- [ ] 10-22 · (K-0179 끝) · 그림만 바뀜: 1만리 go_sand·go_stone·go_water·5천하 realm_stone 바탕(만화경 → 코드 그림) + 이음 쌍 1만리 4·5천하 2 — 이름·자리 그대로, 웹 코드 안 고침 · 웹
- [x] 10-22 · (K-0179 덤) · 1만리 go_grass 바탕도 비늘 같은 반복 무늬 → 바꿈(K-0179 메모) · 자체툴
- [ ] 10-22 · (K-0179 덤 끝) · 그림만 바뀜: 1만리 go_grass(세로 클로버 반복 → 고른 풀잎) + 풀 이음 쌍 넷 · 웹
- [ ] 10-22 · (K-0168·0172·0173·0174 끝) · 유니티 셋: ① sg_liubei 새 몸 → CharactersDex(U-0156 길) ② 소품 10 `World/<new id>`·rock_moss_01 → SelfPairs 10줄·재빌드·PolyHaven 지움 ③ UI 스킨 95 + 9-slice .meta `Resources/UI/` ④ 깨지는 조각 `World/<모델>_shard_0~3` 16·`Audio/Sfx/sfx_prop_break*` 4(K-0174, 진단 breakable `대신 False`) — 임포트 확인 · 유니티
- [x] 10-22 · (W-0371 막힘 알림) → K-0178(초상 묘사로 다시 — 원인 = 3D 몸 렌더 밑그림) · K-0163 인물 일러스트 30 이 그 인물과 다른 사람(성별·시대·옷 — 장군 kr_gyebaek 하녀 옷 소녀·jp_yoshitsune 노란 점퍼 소녀·rf_kongrong 빨간 드레스 소녀·군주 현대 옷) → 지금 초상(portraits/hero/<id>_c)·3D 몸을 참조로 다시 그리기 · 웹은 배선 끝·illust.on 기본 0 · 자체툴
- [x] 10-22 · (W-0299 알림) → K-0181 · 3마을 가축 — 닭·염소 2D 걷기 그림(우리 안, 지금은 코드 대역)·우리 울타리 소품·산물 아이콘 material:egg·material:milk(icons map.json) → 자체툴 · 웹은 아이콘 진단 K_WAIT 예외를 그때 지움 · 자체툴
