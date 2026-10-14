/**
 * 1만리 들판 전투 — 적 종류 표(FOES)·우두머리 공격 차례(ROT). field-combat.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * 순수 데이터 — field-combat.js 가 같은 객체를 `DG.fieldCombat.FOES` 로 그대로 내보낸다(fieldboss·shrine·story·track·진단이 거기서 읽음).
 * ref 는 도감 펫 id — 이미 구워 둔 3D 몸·2D 그림을 그대로 빌린다(새 에셋 없음).
 * type: melee(코앞) · spit(내가 서 있던 자리에 떨어진다) · slam(제 둘레 원)
 */
(function (global) {
  'use strict';

  var FOES = {
    boar:   { name: '멧돼지',     ref: 'pt_boar',         el: null,    hp: 1.0, atk: 1.0, spd: 5.5, reach: 2.0, type: 'melee', wind: 0.6,  cd: 1.8, h: 0.95, exp: 1 },
    imp:    { name: '불도깨비',   ref: 'pt_dokkaebi',     el: 'fire',  hp: 0.9, atk: 1.1, spd: 4.5, reach: 2.2, type: 'melee', wind: 0.7,  cd: 1.9, h: 1.25, exp: 1 },
    toad:   { name: '물두꺼비',   ref: 'pt_toad',         el: 'water', hp: 1.1, atk: 0.9, spd: 3.2, reach: 6.5, type: 'spit',  wind: 0.9,  cd: 2.4, h: 0.9,  exp: 1, r: 1.8 },
    raptor: { name: '번개날쌘용', ref: 'pt_velociraptor', el: 'elec',  hp: 0.8, atk: 1.0, spd: 7.0, reach: 2.0, type: 'melee', wind: 0.45, cd: 1.5, h: 1.15, exp: 1 },
    bear:   { name: '반달곰',     ref: 'pt_bear',         el: null,    hp: 2.2, atk: 1.5, spd: 4.0, reach: 3.2, type: 'slam',  wind: 1.0,  cd: 2.6, h: 1.35, exp: 2, r: 3.4 },
    /* 정예 — 원소 방패 */
    ember:  { name: '홍염마',     ref: 'pt_jeoktoma',     el: 'fire',  hp: 1.8, atk: 1.3, spd: 5.0, reach: 2.4, type: 'melee', wind: 0.7,  cd: 1.8, h: 1.5,  exp: 3, shield: 'fire',  sh: 1.2 },
    tortoise: { name: '물거북 장수', ref: 'pt_hyeonmu',   el: 'water', hp: 2.2, atk: 1.2, spd: 3.0, reach: 7.0, type: 'spit',  wind: 1.0,  cd: 2.4, h: 1.4,  exp: 3, shield: 'water', sh: 1.5, r: 2.2 },
    bolt:   { name: '섬영마',     ref: 'pt_jeolyeong',    el: 'elec',  hp: 1.6, atk: 1.2, spd: 7.5, reach: 2.2, type: 'melee', wind: 0.5,  cd: 1.5, h: 1.5,  exp: 3, shield: 'elec',  sh: 1.0 },
    /* ⑲-1 새 원소 괴물 넷(saga-godot PLAN 106 ⑮) — 보통 무리지만 제 원소 방패를 얇게 두른다(light: 정예 보상 없음).
       몸은 들판 적이 안 쓰던 도감 펫(부엉이·여우·판다·성난 뱀) */
    hawk:   { name: '회오리매',   ref: 'pt_owl',          el: 'wind',  hp: 0.8, atk: 1.0, spd: 7.2, reach: 2.2, type: 'melee', wind: 0.5,  cd: 1.6, h: 1.1,  exp: 2, shield: 'wind',  sh: 0.5,  light: true },
    snowfox:{ name: '눈여우',     ref: 'pt_fox',          el: 'ice',   hp: 1.0, atk: 1.0, spd: 6.4, reach: 2.0, type: 'melee', wind: 0.6,  cd: 1.7, h: 1.0,  exp: 2, shield: 'ice',   sh: 0.6,  light: true },
    rockbear:{ name: '바위곰',    ref: 'pt_panda',        el: 'rock',  hp: 1.9, atk: 1.3, spd: 3.8, reach: 3.0, type: 'slam',  wind: 1.0,  cd: 2.5, h: 1.35, exp: 2, shield: 'rock',  sh: 0.8,  light: true, r: 3.2 },
    vine:   { name: '덩굴뱀',     ref: 'pk_gyarados',     el: 'grass', hp: 1.0, atk: 0.9, spd: 3.6, reach: 6.0, type: 'spit',  wind: 0.9,  cd: 2.3, h: 1.0,  exp: 2, shield: 'grass', sh: 0.55, light: true, r: 1.8 },
    /* ⑱ 세 시대 적(SAGA-DESIGN §13) — 위 짐승·도깨비가 "과거", 아래가 현대·미래. 도감에 없는 종이라 ref 가 비고
       몸은 `asset3d` 의 `pet:fc_<종류>` 다(Quaternius CC0). 힘은 과거 보통 무리와 같은 결 */
    rat:    { name: '잿빛 떼쥐',   ref: null, era: 'modern', el: null,    hp: 0.7, atk: 0.8, spd: 6.2, reach: 1.8, type: 'melee', wind: 0.45, cd: 1.4, h: 0.7,  exp: 1 },
    wasp:   { name: '벼락 말벌',   ref: null, era: 'modern', el: 'elec',  hp: 0.6, atk: 0.9, spd: 6.8, reach: 2.0, type: 'melee', wind: 0.5,  cd: 1.6, h: 0.9,  exp: 1 },
    zombie: { name: '떠도는 망자', ref: null, era: 'modern', el: null,    hp: 1.5, atk: 1.1, spd: 3.0, reach: 2.2, type: 'melee', wind: 0.9,  cd: 2.2, h: 1.15, exp: 1 },
    drone:  { name: '정찰 드론',   ref: null, era: 'future', el: 'elec',  hp: 0.7, atk: 0.9, spd: 5.5, reach: 7.0, type: 'spit',  wind: 0.8,  cd: 2.2, h: 1.0,  exp: 1, r: 1.6 },
    walker: { name: '경비 보행기', ref: null, era: 'future', el: 'fire',  hp: 1.3, atk: 1.1, spd: 4.2, reach: 2.4, type: 'melee', wind: 0.7,  cd: 1.9, h: 1.2,  exp: 1 },
    alien:  { name: '별바다 손님', ref: null, era: 'future', el: 'water', hp: 1.0, atk: 1.0, spd: 5.0, reach: 2.0, type: 'melee', wind: 0.55, cd: 1.6, h: 1.0,  exp: 1 },
    hulk:   { name: '강철 거신',   ref: null, era: 'future', el: 'fire',  hp: 2.4, atk: 1.4, spd: 3.6, reach: 3.4, type: 'slam',  wind: 1.0,  cd: 2.6, h: 1.9,  exp: 3, r: 3.4, shield: 'elec', sh: 1.4 },
    /* 우두머리 — 멀리서만 */
    rex:    { name: '폭군용',     ref: 'pt_t_rex',        el: null,    hp: 6.0, atk: 2.0, spd: 4.5, reach: 4.5, type: 'slam',  wind: 1.2,  cd: 2.8, h: 2.4,  exp: 8, r: 4.8, boss: true },
    /* 싸워서 등용(PLAN §5 ⑯) — 들판 인물이 **제 기질대로** 싸운다. 몸은 도감 인물 그대로(world3d 가 hero 로 그린다),
       원소는 동행이 됐을 때와 같은 elementOf(id). 체력·공격·방패는 희귀도로 정한다(duelCamp). 쓰러지지 않고 **굴복**한다 */
    h_might:  { name: '무인', ref: null, hero: true, el: null, hp: 1, atk: 1, spd: 5.0, reach: 3.4, type: 'slam',  wind: 0.9,  cd: 2.1, h: 1.0, exp: 4, r: 3.6 },
    h_wisdom: { name: '책사', ref: null, hero: true, el: null, hp: 1, atk: 1, spd: 4.2, reach: 7.5, type: 'spit',  wind: 0.9,  cd: 2.0, h: 1.0, exp: 4, r: 2.4 },
    h_virtue: { name: '덕장', ref: null, hero: true, el: null, hp: 1, atk: 1, spd: 6.0, reach: 2.4, type: 'melee', wind: 0.55, cd: 1.4, h: 1.0, exp: 4 },
    /* ⑪ 지역 수호자 — 랜드마크 탑 곁에 하나씩, 바이옴마다 몸·원소가 다르다. 방패가 **두 겹**
       (`shields`, 겉 → 속)이라 한 원소로는 둘째 겹이 안 깨진다 — 겉을 깬 뒤 속 방패의 상성
       원소를 가진 동행으로 바꿔 들어가야 하는 퍼즐. 겹마다 방패량은 같다(sh) */
    g_plain:  { name: '벌판 수호 뿔룡',   ref: 'pt_triceratops', el: 'elec',  hp: 7.0, atk: 1.7, spd: 4.2, reach: 4.2, type: 'slam',  wind: 1.1, cd: 2.6, h: 2.3, exp: 12, r: 4.6, boss: true, guard: true, shields: ['elec', 'water'], sh: 1.3 },
    g_bamboo: { name: '대숲 수호 백호',   ref: 'pt_baekho',      el: 'water', hp: 6.5, atk: 1.9, spd: 6.0, reach: 2.8, type: 'melee', wind: 0.8, cd: 1.9, h: 2.1, exp: 12, boss: true, guard: true, shields: ['water', 'fire'], sh: 1.3 },
    g_canyon: { name: '협곡 수호 주작',   ref: 'pt_jujak',       el: 'fire',  hp: 6.0, atk: 1.8, spd: 4.8, reach: 8.0, type: 'spit',  wind: 1.0, cd: 2.3, h: 2.2, exp: 12, r: 2.8, boss: true, guard: true, shields: ['fire', 'elec'], sh: 1.3 },
    g_marsh:  { name: '늪 수호 청룡',     ref: 'pt_cheongryong', el: 'water', hp: 6.5, atk: 1.8, spd: 4.5, reach: 7.5, type: 'spit',  wind: 1.0, cd: 2.4, h: 2.4, exp: 12, r: 3.0, boss: true, guard: true, shields: ['water', 'elec'], sh: 1.3 },
    g_ruins:  { name: '성터 수호 불가사리', ref: 'pt_bulgasari', el: 'elec',  hp: 7.5, atk: 1.9, spd: 3.8, reach: 4.4, type: 'slam',  wind: 1.2, cd: 2.7, h: 2.3, exp: 12, r: 4.8, boss: true, guard: true, shields: ['elec', 'fire'], sh: 1.3 },
    /* ⑲-31 서리봉 고원(frost.js) 가운데 칸만 — 바이옴 수호자 대신 선다(saga-godot 106 ㊻-1). 반달곰 몸을 크게, 암.
       겉은 만년설 딱지(빙 → 화로 깬다), 속은 바위(암 → 초로 깬다, 물리로도 제대로 깎인다). 공격은 차례(rot):
       내려찍기·물기·눈사태(tide 줄 넷)·고리(halo) — 가장 센 수호자라 체력·공격을 한 칸 올렸다 */
    g_frost:  { name: '만년설 바위곰왕', ref: 'pt_bear', el: 'rock', hp: 8.5, atk: 2.0, spd: 4.0, reach: 4.4, type: 'slam', wind: 1.2, cd: 2.6, h: 2.6, exp: 14, r: 5.0, boss: true, guard: true,
                shields: ['ice', 'rock'], sh: 1.4, rot: ['slam', 'melee', 'tide', 'slam', 'halo', 'melee'] },
    /* §5 ⑲-9 주간 보스(domain.js 먹구름 제단) — 청룡 몸을 빌린 뇌 이무기. 2단계 뇌 방패는 domain.js 가 두른다 */
    w_imugi:  { name: '먹구름 이무기',   ref: 'pt_cheongryong', el: 'elec',  hp: 20,  atk: 2.2, spd: 4.5, reach: 4.4, type: 'slam',  wind: 1.2, cd: 3.5, h: 2.6, exp: 0,  r: 5.0, boss: true, weekly: true },
    /* §5 ⑲-14 이야기 보스(story.js 6장) — 사람 몸(body = asset3d 고정 몸 id)·검은 가면. 공격이 `rot` 차례로 바뀐다(ROT).
       2단계 뇌 방패·졸개는 story.js 가 두른다 */
    b_mask:   { name: '검은 가면',       ref: null, body: 'story_blackmask', mask: 'black', el: 'elec', hp: 10, atk: 1.9, spd: 5.6, reach: 2.4, type: 'melee', wind: 0.6, cd: 1.6, h: 1.0, exp: 0,
                boss: true, rot: ['shadow', 'spit', 'melee', 'slam', 'shadow', 'melee'] },
    /* ⑲-16 7장 금 간 검은 가면 — 같은 몸, 가면 왼쪽에 흰 금. 물 · 밀물(원 넷). 2단계 물 방패·졸개는 story.js 가 두른다 */
    b_mask2:  { name: '금 간 검은 가면', ref: null, body: 'story_blackmask', mask: 'crack', el: 'water', hp: 11.5, atk: 2.0, spd: 5.6, reach: 2.4, type: 'melee', wind: 0.6, cd: 1.6, h: 1.0, exp: 0,
                boss: true, rot: ['tide', 'shadow', 'melee', 'tide', 'slam', 'shadow'] },
    /* ⑲-20 9장 구름섬 — 먹구름 가면을 쓴 해솔(해솔 몸·금 간 가면, 뇌) · 먹구름 임금(사람 몸 1.9배·왕관·어두운 가면, 뇌 — 고리 halo).
       2단계 방패·졸개는 story.js 가 두른다 */
    haesol_mask: { name: '먹구름 가면 해솔', ref: null, body: 'story_haesol', mask: 'crack', el: 'elec', hp: 13, atk: 2.1, spd: 5.8, reach: 2.4, type: 'melee', wind: 0.6, cd: 1.5, h: 1.0, exp: 0,
                boss: true, rot: ['shadow', 'spit', 'tide', 'melee', 'slam', 'shadow'] },
    storm_king:  { name: '먹구름 임금', ref: null, body: 'story_blackmask', mask: 'storm', el: 'elec', hp: 17, atk: 2.3, spd: 4.8, reach: 3.4, type: 'melee', wind: 0.7, cd: 1.7, h: 1.9, exp: 0,
                boss: true, rot: ['slam', 'halo', 'spit', 'melee', 'shadow', 'tide', 'halo'] },
    /* ⑲-51 26장 궤도 정거장 조각 — 가면 그림자가 불러낸 먹구름 임금의 그림자(같은 몸·먹빛 왕관, 뇌, 더 단단하다). 2단계 뇌 방패(불로 깬다)·졸개는 story.js */
    storm_shadow: { name: '먹구름 임금의 그림자', ref: null, body: 'story_blackmask', mask: 'shadow', el: 'elec', hp: 21, atk: 2.5, spd: 4.4, reach: 3.4, type: 'melee', wind: 0.8, cd: 1.6, h: 2.0, exp: 0,
                boss: true, rot: ['slam', 'halo', 'spit', 'shadow', 'melee', 'tide', 'halo', 'spit'] },
    /* ⑲-60 32장 부양탑 밑 광장 — 거리 시간을 등딱지에 굳혀 온 호박 등딱지 거북(현무 펫 몸을 크게, 암). 2단계 암 방패(초로 깬다)·졸개는 story.js */
    amber_turtle: { name: '호박 등딱지 거북', ref: 'pt_hyeonmu', el: 'rock', hp: 24, atk: 2.6, spd: 3.2, reach: 4.4, type: 'slam', wind: 1.1, cd: 1.7, h: 3.2, exp: 0, r: 4.6,
                boss: true, rot: ['slam', 'tide', 'melee', 'halo', 'slam', 'spit'] },
    /* ⑲-68 38장 세갈래 길목 — 틈이 처음 찢어지던 순간 하늘을 찢고 멈췄던 처음의 별까마귀(삼족오 몸, 뇌 — 20장 틈 삼킨 별까마귀의 온전한 몸). 있는 패턴만 — 틈새 질주·고리·침·내려찍기·밀물 줄.
       2단계 뇌 방패(불로 깬다)·졸개는 story.js 가 두른다 */
    first_crow:  { name: '처음의 별까마귀', ref: 'pt_samjogo', el: 'elec', hp: 30, atk: 3.0, spd: 5.6, reach: 3.6, type: 'slam', wind: 0.9, cd: 1.6, h: 3.4, exp: 0, r: 4.6,
                boss: true, rot: ['rift', 'halo', 'spit', 'slam', 'tide', 'rift', 'halo'] },
    /* ⑲-68 38장 세갈래 길목 — 격자를 몸에 두른 갈무리 참몸(도깨비 몸을 크게, 암 — 합금·호박빛). 있는 패턴만 — 내려찍기·고리·휘두름·밀물 줄·침.
       2단계 암 방패(초로 깬다)·졸개는 story.js 가 두른다 */
    garmuri_true: { name: '갈무리 참몸', ref: 'pt_dokkaebi', el: 'rock', hp: 34, atk: 3.2, spd: 4.8, reach: 4.0, type: 'slam', wind: 1.0, cd: 1.7, h: 4.2, exp: 0, r: 4.8,
                boss: true, rot: ['slam', 'halo', 'melee', 'tide', 'slam', 'spit', 'halo'] },
    /* ⑲-70 41장 세갈래 고을 마당 — 갈무리의 마지막 마음이 자란 싹(도깨비 몸을 크게, 초). 있는 패턴만 — 내려찍기·침·고리·휘두름·밀물 줄.
       2단계 초 방패(풍으로 깬다)·졸개는 story.js 가 두른다 */
    seed_giant: { name: '갈무리의 싹', ref: 'pt_dokkaebi', el: 'grass', hp: 38, atk: 3.3, spd: 4.6, reach: 4.2, type: 'slam', wind: 1.0, cd: 1.7, h: 4.4, exp: 0, r: 5.0,
                boss: true, rot: ['slam', 'spit', 'halo', 'melee', 'tide', 'slam', 'halo'] },
    /* ⑲-64 35장 금고 앞 — 금고 관리 인공지능이 문 밖으로 내보낸 금고 파수 드론 여왕(정찰 드론 몸을 크게, 풍). 있는 패턴만 — 틈새 질주·고리·침·내려찍기·밀물 줄.
       2단계 풍 방패(암으로 깬다)·졸개는 story.js 가 두른다 */
    vault_queen: { name: '금고 파수 드론 여왕', ref: null, el: 'wind', hp: 28, atk: 2.8, spd: 5.4, reach: 3.8, type: 'slam', wind: 0.9, cd: 1.6, h: 3.6, exp: 0, r: 4.2,
                boss: true, rot: ['rift', 'halo', 'spit', 'slam', 'tide', 'rift'] },
    /* ⑲-55 29장 먹구름 눈 — 먹구름 임금의 참몸(사람 몸 2.4배·먹빛 왕관·흰 처음 가면, 뇌, 8부 끝 보스). 2단계 뇌 방패(불로 깬다)·졸개는 story.js */
    storm_king_true: { name: '먹구름 임금', ref: null, body: 'story_blackmask', mask: 'first', el: 'elec', hp: 26, atk: 2.7, spd: 4.2, reach: 3.8, type: 'melee', wind: 0.8, cd: 1.5, h: 2.4, exp: 0, r: 3.0,
                boss: true, rot: ['slam', 'halo', 'spit', 'shadow', 'melee', 'tide', 'halo', 'slam', 'spit'] },
    /* ⑲-30 12장 서리봉 고원 얼음굴 앞 — 시간 틈에서 나온 아홉 꼬리 여우(구미호 펫 몸, 빙). 틈새 질주 rift.
       2단계 빙 방패·졸개는 story.js 가 두른다 */
    rift_fox:    { name: '틈새 서리 구미호', ref: 'pt_gumiho', el: 'ice', hp: 15, atk: 2.2, spd: 6.0, reach: 3.0, type: 'melee', wind: 0.6, cd: 1.5, h: 2.2, exp: 0,
                boss: true, rot: ['rift', 'melee', 'spit', 'rift', 'slam', 'halo'] },
    /* ⑲-36 15장 옛 역참 길 — 12장에 달아난 구미호가 옛 시대 여우불을 먹었다(화). 같은 몸·틀, 2단계 화 방패·졸개는 story.js */
    rift_fox_ember: { name: '여우불 구미호', ref: 'pt_gumiho', el: 'fire', hp: 16, atk: 2.3, spd: 6.0, reach: 3.0, type: 'melee', wind: 0.6, cd: 1.4, h: 2.3, exp: 0,
                boss: true, rot: ['rift', 'shadow', 'melee', 'rift', 'tide', 'halo'] },
    /* ⑲-39 17장 옛 절터 — 틈에서 기어 나와 떨어진 종에 똬리를 틀고 수백 년 이끼를 먹은 이무기(먹구름 이무기와 같은 청룡 몸, 초 — 덩굴뱀 몸은 새 원소 괴물 몫).
       있는 패턴만 — 이끼 침·밀물 원·내려치기·고리. 2단계 초 방패(풍으로 깬다)·졸개는 story.js 가 두른다 */
    moss_serpent: { name: '이끼 이무기', ref: 'pt_cheongryong', el: 'grass', hp: 17, atk: 2.3, spd: 4.2, reach: 4.0, type: 'slam', wind: 1.0, cd: 1.8, h: 2.6, exp: 0, r: 4.4,
                boss: true, rot: ['spit', 'tide', 'slam', 'melee', 'halo', 'spit'] },
    /* ⑲-42 19장 틈새 갈림길 — 선장이 멈춰 둔 시간 속에서 깨어난 파수꾼(사람 몸 2배·금빛 가면, 풍). 있는 패턴만.
       2단계 풍 방패(암으로 깬다)·졸개는 story.js 가 두른다 */
    time_warden: { name: '멈춘 시간의 파수꾼', ref: null, body: 'story_blackmask', mask: 'gold', el: 'wind', hp: 18, atk: 2.4, spd: 4.8, reach: 3.4, type: 'melee', wind: 0.7, cd: 1.6, h: 2.0, exp: 0,
                boss: true, rot: ['halo', 'tide', 'slam', 'shadow', 'melee', 'halo', 'spit'] },
    /* ⑲-43 20장 갈림길 끝 — 세 갈래 선로를 삼키려다 틈을 찢고 갇혔던 별까마귀(삼족오 몸 크게, 빙). 그림자 뺀 있는 패턴 —
       틈새 질주·고리·침·내려찍기·밀물 줄. 2단계 빙 방패(화로 깬다)·졸개는 story.js 가 두른다 */
    rift_crow:   { name: '틈 삼킨 별까마귀', ref: 'pt_samjogo', el: 'ice', hp: 20, atk: 2.5, spd: 5.2, reach: 3.4, type: 'slam', wind: 1.0, cd: 1.7, h: 3.0, exp: 0, r: 4.4,
                boss: true, rot: ['rift', 'halo', 'spit', 'slam', 'tide', 'rift'] },
    /* ⑲-46 22장 빛 돔 안 — 돔에 숨어 빛을 먹던 심해 등불아귀(아귀 몸 크게, 수). 있는 패턴만 — 침·밀물 줄·고리·내려찍기·그림자.
       2단계 수 방패(뇌로 깬다)·졸개는 story.js 가 두른다 */
    abyss_angler: { name: '심해 등불아귀', ref: 'pt_anglerfish', el: 'water', hp: 21, atk: 2.5, spd: 4.6, reach: 3.6, type: 'spit', wind: 0.9, cd: 1.7, h: 3.2, exp: 0, r: 3.0,
                boss: true, rot: ['spit', 'tide', 'halo', 'slam', 'shadow', 'spit'] },
    /* ⑲-47 23장 빛 돔 안 — 기록을 지운 자의 명령으로 깨어난 바위 거인(도깨비 몸 크게, 암). 있는 패턴만 — 내려찍기·고리·휘두름·밀물 줄·침.
       2단계 암 방패(초로 깬다)·졸개는 story.js 가 두른다 */
    dome_colossus: { name: '돔 파수 거신', ref: 'pt_dokkaebi', el: 'rock', hp: 22, atk: 2.6, spd: 4.4, reach: 3.6, type: 'slam', wind: 1.0, cd: 1.8, h: 3.6, exp: 0, r: 4.2,
                boss: true, rot: ['slam', 'halo', 'melee', 'tide', 'slam', 'spit'] }
  };
  /* ⑲-14 공격 차례(`rot`)의 한 수씩 — reach 안이면 휘두른다. shadow 는 내 등 뒤 SHADOW_BACK m 로 옮겨 붙어 제 둘레 원 */
  var ROT = {
    shadow: { reach: 14,  wind: 0.8,  r: 3.2, mul: 1.4 },
    spit:   { reach: 9,   wind: 1.0,  r: 2.4, mul: 1.0 },
    melee:  { reach: 2.4, wind: 0.55, r: 0,   mul: 1.0 },
    slam:   { reach: 3.8, wind: 1.1,  r: 4.2, mul: 1.2 },
    tide:   { reach: 11,  wind: 1.1,  r: 2.0, mul: 1.3, n: 4, from: 2.5, gap: 3 },   // ⑲-16 밀물 — 나를 향해 원 넷 줄지어
    halo:   { reach: 8,   wind: 1.3,  r: 9,   mul: 1.5, inner: 3 },                    // ⑲-20 고리 — 제 둘레 3~9m. 곁(3m 안)으로 파고들거나 9m 밖으로
    rift:   { reach: 12,  wind: 1.0,  r: 2.0, mul: 1.5, n: 5, from: 2, gap: 2.4 }      // ⑲-30 틈새 질주 — 원 다섯 줄 예고, 칠 때 줄 끝으로 옮긴다
  };

  global.DG = global.DG || {};
  global.DG.fieldFoes = { FOES: FOES, ROT: ROT };
})(typeof window !== 'undefined' ? window : this);
