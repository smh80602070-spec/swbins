# 아이디어 수신함 — 중간에 들어온 말은 여기 한 줄 (절차 `tasks/INTAKE.md`)

형식: `- [ ] 날짜 · "사용자 말 그대로" · 읽은 뜻 · 갈래/판`. 처리(티켓·폐기)는 R-0 세션(페이블 또는 부감독 오퍼스)이 하고 `[x]` + 티켓 번호, 처리 끝난 줄은 `archive/INBOX-HISTORY.md` 로 옮긴다. 소넷은 추가만.
- [ ] 10-21 · (K-0158 끝 알림) · 2D 공장 규격 고정 — 192px·5방향·10동작·발 0.88·manifest(`tools/char-forge/README.md` §13), 시험 3풀 hero_m·villager_a·beast_wolf 이 2나락 `assets/sprites2d_sheets/` + index.json `factory` 에 있음 → W-0370 이 읽으면 됨 · 웹/2나락
- [ ] 10-21 · (K-0162 끝 알림) · 이음 타일 배선 W 필요 — 이웃 비트 규칙 `assets/web2d/tile/tiles.json`(이중 격자: 반 칸 밀린 격자, i=NW1+NE2+SW4+SE8 → 4×4 아틀라스 칸, stride 272·gutter 8), 쌍 폴더 `<쌍>/atlas.webp` — 1만리 5·2나락 4·3마을 5(K-0091 forest_edge 대체)·5천하 4 · 웹/1만리·2나락·3마을·5천하
- [ ] 10-21 · (K-0159 끝 알림) · W-0370 시작 가능 — 공장 사람 시트 9풀(hero_m·hero_f·villager_b·villager_c·companion_warrior·companion_archer·rts_inf_enemy·rts_arc_ally·rts_arc_enemy)이 다섯 판 `assets/sprites2d_sheets/<풀>/` + index.json `factory` 에 있음(무기 풀은 manifest px 256·384 — px_per_m 같음, 발 0.88). villager_a·companion_mage·rts_inf_ally·rts_cav_* 는 still 그대로 · 2나락 옛 시험 villager_a 는 지움 · 웹/다섯 판
- [ ] 10-21 · (K-0164 끝 알림) · W-0366 그림 옴 — 4종횡 사냥터 10 `assets/web2d/bg2d/story_<사냥터>/layers.json`(sky·far·near·front, 2016×1152 원본·top/h 잘림, 홀수 칸 뒤집기 이음) + 발판 `assets/web2d/tile/side_<사냥터>/tiles.json`(칸 128, top·end_l·end_r 512×128 · side 512×512, 칸 = 세계 칸 x mod 4·y mod 4) — 옛 bg/·story-tile 대신 배선 · 웹/4종횡
- [ ] 10-21 · (K-0165 끝 알림) · 그림만 바뀜(자리·이름 같음) — 3마을·5천하 물 바탕 `forest_water`·`realm_water` 새 물빛 + 물 쌍 아틀라스 3 · 4종횡 bg2d 깊은 동굴·숲 · 발판 산 사당·궤도 기지 색 — 캐시 갱신에 sw.js VERSION 올림 필요 · 웹/3마을·4종횡·5천하
- [ ] 10-21 · (K-0161 끝 알림) · 같은 모션 30 팩을 유니티 Humanoid 리타깃(이름 = clips30.json game) + 판별 행동 상태 배선 · 유니티/다섯 판
- [ ] 10-21 · (W-0356 끝 알림) · 빌린 괴물 웹 참조 — 5천하·3마을 0, 2나락은 quaternius Alpaking_Evolved·Armabee 둘·Cat·Chicken·Fish 둘만 남음(자체 몸 없음) → 그 일곱 몸 만들면 옛 monsters/ 폴더 지워도 됨(W-0360) · 자체툴
- [ ] 10-21 · (G-0282 대기 알림) · K-0161 `saga-assets/characters/anim-src/mocap/vroid_clips30_anims.glb`(+license) 를 고돗 `saga-godot/assets/anim_mocap/` 로 place(asset-place `anim-mocap` 항목에 파일 하나 더) → G-0282 풀림 · 자체툴
- [ ] 10-21 · (W-0359 ① 알림) · 인물·펫 초상 hero·pet 은 웹 다섯 판이 `saga-web/shared/assets/portraits/{hero,pet}/` 한 벌만 읽음(판 사본 지움) → asset-place `portraits-hero`·펫 초상 targets·bake-portraits 출력 자리를 shared 로(안 고치면 다음 place 가 판 사본 5000 을 되살림) · 자체툴
- [ ] 10-21 · (W-0359 ② 알림) · 웹 bgm ogg 는 `saga-web/shared/audio/bgm/<판>-<때>.ogg` 만 읽음(판 saga-<판>-*.ogg 지움) → asset-place `bgm` 판 dir targets 빼기 · 자체툴
- [ ] 10-21 · (K-0163 끝 알림) · W-0371 시작 가능 — 인물 일러스트 주역 30 `assets/illust/<id>/stand.webp`(전신 세로 1024 투명)·`neutral|happy|angry|sad.webp`(반신 512 투명) + 판별 `assets/illust/manifest.js`(`SAGA.illust.ids`) — 2나락 1(hl_mukhyang)·4종횡 16(스승)·5천하 13(1막 군주·이계 군주). 1만리·3마을은 아직 0(대역 = 초상) · 웹/2나락·4종횡·5천하
- [ ] 10-21 · (K-0163 끝 알림) · 나머지 인물 ~470 일러스트 — 같은 도구 `tools/ai-art/k163_illust.py`(cast 표만 판별로 새로) 로 판마다 한 티켓(3D 몸 있는 도감 인물 순, 원격 120장≈50분이라 판당 2~3회), 1만리·3마을 주역부터 · 자체툴
- [ ] 10-21 · (K-0167 끝 알림) · mode2d MARK 표에 25 줄 — `shared/assets/icons/icon64/ui_<이름>_g0.png`, 이모지→이름 표는 `tasks/tools/done/K-0167.md` 메모 · 웹/다섯 판
- [ ] 10-22 · 2D폰: 1만리 나무 밟음·2나락 마을 화면 바뀜 · 웹
- [ ] 10-22 · (G-0287 대기 알림) · 고돗 `assets/characters_dex/*.gltf` 모프 targets 0(이름표만, 웹 characters3d 는 77) → Fcl 모프 살려 다시 내보내기 — NPC·주인공 깜박임·표정·입 · 자체툴
- [ ] 10-22 · (G-0302 알림) · 고돗 `characters_dex/hl_geumsil.gltf` 희소 접근자 78 인덱스 bufferView 크기가 count×성분 크기와 안 맞음 → Godot 임포트 ERROR 78(모프 값 의심) — 다시 내보내기 · 자체툴
- [ ] 10-22 · (K-0168 끝 알림) · sg_liubei 새 몸(어른 키) — 유니티 CharactersDex 갈아 끼우기(U-0156 과 같은 decode.mjs --only sg_liubei 길) · 유니티
- [ ] 10-22 · (K-0169 끝 알림) · 컷아웃 주역 둘(sg_zhugeliang 단검·hl_mukhyang 지팡이) rig.json 에 무기 부위(extra weapon)·attack 끝 자세·walk/idle 클립이 들어옴 — cutout2d.js 가 그대로 읽음(코드 안 고침), `shared/assets/web2d/cutout`. cutout2d.on 기본값(지금 0) 다시 볼지 · 웹/2나락·4종횡
