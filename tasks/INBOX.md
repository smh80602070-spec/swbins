# 아이디어 수신함 — 중간에 들어온 말은 여기 한 줄 (절차 `tasks/INTAKE.md`)

형식: `- [ ] 날짜 · "사용자 말 그대로" · 읽은 뜻 · 갈래/판`. 처리(티켓·폐기)는 페이블 큐 세션이 하고 `[x]` + 티켓 번호, 처리 끝난 줄은 `archive/INBOX-HISTORY.md` 로 옮긴다. 소넷은 추가만.

- [ ] 2026-10-05 · "플래그십을 사가국지 웹으로 바꿀지" (제안) — **사용자 결정 대기** · tools/wip.json flagship
- [ ] 2026-10-07 · (G-0060 촬영 관찰, 사용자 말 아님) · 갑옷 조각 eq_* 가 표준 몸(어깨 1.44m) 비율이라 사가고 애니풍 VRoid 몸(배율 k≈1.0)에 가슴판이 허리~턱을 덮는 상자처럼 커 보임 — 몸 비율에 맞춘 크기·모양 손질 필요 · 자체툴(K)
- [ ] 2026-10-07 · "사가고 웹 내 캐릭터 정보 볼수 있는곳이 없어 동행자도 못보고 장비착용여부도" · 사가고 웹에 나·동행 한눈 화면이 없다 — 지금 동행 명단은 도감 탭 맨 위 「들판 명단」(ui.js rosterStrip)에 묻혀 있고 무기·보패는 인물 카드(detailHero)를 하나씩 눌러야 보인다. 독에 「동행」(또는 「나」) 탭: 내 등급·능력·명단 4+대기·각자 무기/보패 낀 것 한 줄 · 웹/사가고(플래그십)
- [x] 2026-10-07 · "K 에게 넘기기"(고돗 세션 질문에 사용자 답) · 고돗 G-0059 선행: `saga-godot/assets/world` 의 mon_ 20·boss_ 12 `.glb.import`(+추출 텍스처)가 한 번도 안 만들어졌다 — K-0043 "한계" 줄은 "엔진 세션이 처음 열 때 만든다", 고돗 큐는 ".import 는 K 몫"이라 서로 미룸. K 가 Godot 로 가져오기(`--import`)해 32벌만 커밋하고 K-0043 한계 줄도 고칠 것 · 자체툴(K) → 고돗 G-0059 · → 10-07 K: 고돗 가져오기로 mon 20·boss 12(+glider_01) `.glb.import` 를 `add -f` 커밋, K-0043 한계 줄 고침
- [ ] 2026-10-07 · (K-0077·K-0078 산출, 사용자 말 아님) · 고돗 몫 셋: ① `assets/world/glider_01.glb`(원점 = 손잡이 막대 가운데·+y 앞, 막대 ±0.66m·손 자리 ±0.52m)로 `go_player.gd` `_build_glider()` 빨간 삼각형 교체 ② 새 폭발 `CF_Burst`(내딛어 두 손 정면 내지르기)로 `anim_cc0/dex_common_lib.res` 다시 — 원본 `tools/char-forge/_out/vroid/dj_haean/dj_haean_anims.glb`(K PC 로컬, 없으면 `vroid_batch.sh --only dj_haean`) ③ 옛 인물 파일(`characters_cf`·`characters/character-*`·`characters_vroid`) 지우기·`wardrobe.gd`/`probe_wardrobe` 정리 — 유니티 원본은 `saga-assets/characters/vroid` 로 옮겨 둠. 참고: dex 몸 299 에 표정 모프 9(`Fcl_MTH_A`·`Fcl_EYE_Close` 등 접두 없는 이름), 도감 45명 성별 맞춘 몸으로 바뀜(엔진판은 `engine_characters.sh --install godot`) · 고돗(G)
