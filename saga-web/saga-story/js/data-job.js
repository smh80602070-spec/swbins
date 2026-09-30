/**
 * 직업과 무예 — 전직 · 스킬 트리
 * ---------------------------------------------------------------
 * 원작의 성장 골격이다:
 *   1) 처음엔 **무명(초보자)**. 정해진 네 가지만 쓴다
 *   2) Lv.10 에 **1차 전직** — 직업 넷 중 하나를 고른다 (되돌릴 수 없다)
 *   3) Lv.25 에 **2차 전직** — 같은 갈래의 윗자리로 오르고 무예 셋이 열린다
 *   4) Lv.45 에 **3차 전직** — 무예 넷이 더 열린다 (2026-08-26)
 *   5) Lv.70 에 **4차 전직** — 갈래의 끝. 무예 넷이 더 열린다 (2026-09-10)
 *   6) Lv.80 에 **5차 전직** — 원작 문법에 없던 단(2026-09-30, PLAN §10-Q7). 무예는 갈래마다 **둘**뿐 —
 *      4차 무예 사슬 둘의 끝에 붙는 각성기다(효과는 아홉 그대로, 유파도 그 사슬의 것)
 *   7) 레벨마다 **무예 점수(SP)**. 점수를 부어 무예를 올린다(지금은 2점 — §5-2)
 *
 * **SP 는 세이브에 따로 담지 않는다.** 총점은 (레벨-1)×3 이고 쓴 점수는 찍은
 * 무예 레벨의 합이다 — 파생값이라 옛 세이브도 그냥 맞는다(core.js 를 안 건드린다).
 *
 * 무예 하나의 힘은 `mul = [기본, 레벨당]` 이다. 레벨 0 이면 **못 쓴다**(원작 그대로).
 * 무명의 넷만 `max: 0` — 찍지 않아도 늘 쓸 수 있는 고정 무예다.
 */
(function (global) {
  'use strict';

  /* 갈래 넷. tier 1 은 Lv.10, tier 2 는 Lv.25, tier 3 은 Lv.45, tier 4 는 Lv.70 에 오른다.
     **갈래는 늘리지 않았다** — 넷을 다섯으로 늘리면 인물 능력치와 무기가 따라가야 한다.
     대신 각 갈래를 **한 단 더 높였다**(2026-09-10, 3차에 이어 4차까지). 오르는 조건은
     자리마다 무거워진다: 2차는 아랫자리 무예 하나를 5 이상, 3차는 8 이상, 4차는
     **10(만렙) — 3차 무예 하나를 끝까지 익혀야 마지막 자리에 오른다.** */
  var JOBS = [
    { key: 'none', name: '무명(無名)', emoji: '🚶', tier: 0, need: 0, from: null,
      desc: '아직 길을 정하지 않았다' },

    { key: 'warrior', name: '무사(武士)', emoji: '⚔️', tier: 1, need: 10, from: 'none',
      grow: { hp: 40, atk: 2 }, desc: '붙어서 벤다 — 체력이 두텁다' },
    { key: 'archer',  name: '궁수(弓手)', emoji: '🏹', tier: 1, need: 10, from: 'none',
      grow: { hp: 10, atk: 5 }, desc: '멀리서 쏜다 — 궁수 적과 같은 자리에서 싸운다' },
    { key: 'rogue',   name: '협객(俠客)', emoji: '🗡️', tier: 1, need: 10, from: 'none',
      grow: { hp: 18, atk: 4 }, desc: '빠르게 여러 번 벤다' },
    { key: 'mage',    name: '방사(方士)', emoji: '🔮', tier: 1, need: 10, from: 'none',
      grow: { hp: 12, atk: 3, mp: 40 }, desc: '도술을 부린다 — 기력이 깊다' },

    { key: 'general', name: '장군(將軍)', emoji: '🛡️', tier: 2, need: 25, from: 'warrior',
      grow: { hp: 110, atk: 7 }, desc: '무사의 윗자리' },
    { key: 'sniper',  name: '신궁(神弓)', emoji: '🎯', tier: 2, need: 25, from: 'archer',
      grow: { hp: 40, atk: 14 }, desc: '궁수의 윗자리' },
    { key: 'assassin', name: '자객(刺客)', emoji: '🥷', tier: 2, need: 25, from: 'rogue',
      grow: { hp: 55, atk: 11 }, desc: '협객의 윗자리' },
    { key: 'sage',    name: '도사(道士)', emoji: '☯️', tier: 2, need: 25, from: 'mage',
      grow: { hp: 45, atk: 9, mp: 90 }, desc: '방사의 윗자리' },

    /* 3차 — 갈래의 끝(2026-08-26). 이름은 원작 상표를 피해 한국사·삼국지에서 골랐다 */
    { key: 'marshal', name: '원수(元帥)', emoji: '🎖️', tier: 3, need: 45, from: 'general',
      grow: { hp: 190, atk: 13 }, desc: '장군의 윗자리 — 삼군을 거느린다' },
    { key: 'flier',   name: '비장(飛將)', emoji: '🦅', tier: 3, need: 45, from: 'sniper',
      grow: { hp: 70, atk: 26 }, desc: '신궁의 윗자리 — 쏘면 빗나가지 않는다' },
    { key: 'wraith',  name: '귀영(鬼影)', emoji: '🌑', tier: 3, need: 45, from: 'assassin',
      grow: { hp: 95, atk: 20 }, desc: '자객의 윗자리 — 그림자만 남는다' },
    { key: 'immortal', name: '진인(眞人)', emoji: '🧙', tier: 3, need: 45, from: 'sage',
      grow: { hp: 80, atk: 17, mp: 160 }, desc: '도사의 윗자리 — 천지를 부린다' },

    /* 4차 — 갈래의 끝(2026-09-10). 3차와 같은 결로, 원작 상표를 피해 이름을 고르되
       실존 인물이 아니라 범용 칭호(전신·명왕처럼 누구를 딱 집어 가리키지 않는 별칭)만 쓴다 */
    { key: 'warlord', name: '전신(戰神)', emoji: '🔱', tier: 4, need: 70, from: 'marshal',
      grow: { hp: 300, atk: 20 }, desc: '원수의 윗자리 — 싸움 그 자체가 된다' },
    { key: 'falcon', name: '궁성(弓聖)', emoji: '🌌', tier: 4, need: 70, from: 'flier',
      grow: { hp: 115, atk: 39 }, desc: '비장의 윗자리 — 온 하늘이 화살이 된다' },
    { key: 'reaper', name: '명왕(冥王)', emoji: '👑', tier: 4, need: 70, from: 'wraith',
      grow: { hp: 155, atk: 30 }, desc: '귀영의 윗자리 — 저승의 문지기가 된다' },
    { key: 'ascendant', name: '천존(天尊)', emoji: '🌠', tier: 4, need: 70, from: 'immortal',
      grow: { hp: 130, atk: 26, mp: 260 }, desc: '진인의 윗자리 — 하늘과 땅을 굽어본다' },

    /* 5차 — 4차 무예 하나를 끝까지 익힌 사람만(canJoin 은 4차와 같은 10). 범용 칭호만 쓴다 */
    { key: 'godwar', name: '군신(軍神)', emoji: '🏵️', tier: 5, need: 80, from: 'warlord',
      grow: { hp: 420, atk: 27 }, desc: '전신의 윗자리 — 전장이 그의 이름을 따른다' },
    { key: 'skybow', name: '천궁(天弓)', emoji: '🌈', tier: 5, need: 80, from: 'falcon',
      grow: { hp: 160, atk: 52 }, desc: '궁성의 윗자리 — 활을 든 곳이 하늘이다' },
    { key: 'noshadow', name: '무영(無影)', emoji: '🫥', tier: 5, need: 80, from: 'reaper',
      grow: { hp: 210, atk: 40 }, desc: '명왕의 윗자리 — 베이고 난 뒤에야 보인다' },
    { key: 'voidsage', name: '태허(太虛)', emoji: '🪐', tier: 5, need: 80, from: 'ascendant',
      grow: { hp: 175, atk: 35, mp: 360 }, desc: '천존의 윗자리 — 비어 있어서 무엇이든 담는다' }
  ];

  /**
   * 무예. `effect` 가 side.js 가 아는 손잡이다:
   *   melee 앞을 벤다 · aoe 주위 · bolt 꿰뚫는 것 · arrow 첫 하나만 · volley 여러 발
   *   buff 잠깐 세진다 · heal 몸을 추스른다 · dash 밀고 나간다 · rain 앞쪽에 쏟는다
   */
  var SKILLS = [
    /* 무명 — 찍지 않아도 쓰는 넷 (이 판이 처음부터 갖고 있던 그 넷이다) */
    { key: 'slash', job: 'none', name: '연참(連斬)', emoji: '⚔️', cost: 0, cd: 0.36, max: 0,
      effect: 'melee', mul: [1.0, 0], desc: '앞을 벤다 (평타)' },
    { key: 'sweep', job: 'none', name: '횡소(橫掃)', emoji: '🌀', cost: 18, cd: 4, max: 0,
      effect: 'aoe', mul: [1.8, 0], r: 117, desc: '주위를 한 바퀴 벤다' },
    { key: 'bolt', job: 'none', name: '기탄(氣彈)', emoji: '💠', cost: 24, cd: 6, max: 0,
      effect: 'bolt', mul: [2.1, 0], desc: '앞으로 기를 날린다 · 관통' },
    { key: 'brace', job: 'none', name: '기합(氣合)', emoji: '🔥', cost: 30, cd: 14, max: 0,
      effect: 'buff', mul: [0, 0], buff: { sec: 8, atk: 1.35, speed: 1.2 },
      desc: '8초간 공격 +35% · 이동 +20%' },

    /* 무사 → 장군 */
    { key: 'w_cut', job: 'warrior', school: 'w_jung', name: '참격(斬擊)', emoji: '🗡️', cost: 6, cd: 0.5, max: 10,
      effect: 'melee', mul: [1.15, 0.09], desc: '앞을 깊게 벤다' },
    { key: 'w_whirl', job: 'warrior', school: 'w_pae', name: '선풍(旋風)', emoji: '🌪️', cost: 20, cd: 3.6, max: 10,
      effect: 'aoe', mul: [1.6, 0.14], r: 128, desc: '몸을 돌려 주위를 쓸어 벤다' },
    { key: 'w_rush', job: 'warrior', school: 'w_jil', name: '돌진(突進)', emoji: '💨', cost: 24, cd: 6, max: 10,
      effect: 'dash', mul: [1.8, 0.16], dist: 210, desc: '앞으로 밀고 나가며 벤다' },
    { key: 'w_iron', job: 'warrior', school: 'w_su', name: '철갑(鐵甲)', emoji: '🛡️', cost: 28, cd: 16, max: 10,
      effect: 'buff', mul: [0, 0], buff: { sec: 9, atk: 1.2, guard: 0.35 },
      desc: '9초간 덜 맞고 공격 +20%' },
    /* 다섯째 무예(2026-09-10) — 무사 갈래엔 없던 관통이 근접형에게도 견제
       수단이 되어 준다. 새 효과가 아니라 무명의 기탄과 같은 bolt 를 쓴다 */
    { key: 'w_edge', job: 'warrior', school: 'w_pa', name: '파공검(破空劍)', emoji: '🌊', cost: 18, cd: 5, max: 10,
      effect: 'bolt', mul: [1.6, 0.14], desc: '벤 기운을 앞으로 쏘아 보낸다 · 관통' },
    /* 여섯째 무예(2026-09-11) — 무사 갈래엔 없던 자가 치유. 새 효과가 아니라
       방사의 치유와 같은 heal 을 기공(氣功)으로 쓴다 */
    { key: 'w_vital', job: 'warrior', school: 'w_saeng', name: '생기결(生氣訣)', emoji: '💚', cost: 24, cd: 18, max: 10,
      effect: 'heal', mul: [0, 0], heal: [0.14, 0.016], desc: '몸을 다잡는다 (체력 14%+)' },
    { key: 'g_smash', job: 'general', school: 'w_jung', name: '패왕격(霸王擊)', emoji: '💥', cost: 40, cd: 9, max: 10,
      effect: 'melee', mul: [3.4, 0.3], hits: 2, need: { key: 'w_cut', lv: 5 },
      desc: '앞을 두 번 내리친다 — 참격 5' },
    { key: 'g_roar', job: 'general', school: 'w_pae', name: '함성(喊聲)', emoji: '📣', cost: 34, cd: 14, max: 10,
      effect: 'aoe', mul: [2.4, 0.2], r: 190, need: { key: 'w_whirl', lv: 5 },
      desc: '고함으로 사방을 친다 — 선풍 5' },
    { key: 'g_wall', job: 'general', school: 'w_su', name: '철벽(鐵壁)', emoji: '🧱', cost: 38, cd: 20, max: 10,
      effect: 'buff', mul: [0, 0], buff: { sec: 11, atk: 1.15, guard: 0.5 },
      need: { key: 'w_iron', lv: 5 }, desc: '11초간 절반을 막아 낸다 — 철갑 5' },
    { key: 'g_edge', job: 'general', school: 'w_pa', name: '벽공검(劈空劍)', emoji: '🌊', cost: 32, cd: 7, max: 10,
      effect: 'bolt', mul: [2.8, 0.24], need: { key: 'w_edge', lv: 5 },
      desc: '기운이 더 멀리, 더 세게 뻗는다 — 파공검 5' },
    { key: 'g_vital', job: 'general', school: 'w_saeng', name: '회천결(回天訣)', emoji: '💚', cost: 36, cd: 20, max: 10,
      effect: 'heal', mul: [0, 0], heal: [0.26, 0.024], need: { key: 'w_vital', lv: 5 },
      desc: '기운을 되돌린다 (체력 26%+) — 생기결 5' },
    /* 원수 — 무사 갈래의 끝 */
    { key: 'n_heaven', job: 'marshal', school: 'w_jung', name: '천붕격(天崩擊)', emoji: '☄️', cost: 58, cd: 11, max: 10,
      effect: 'melee', mul: [4.6, 0.42], hits: 3, need: { key: 'g_smash', lv: 5 },
      desc: '앞을 세 번 내리찍는다 — 패왕격 5' },
    { key: 'n_quake', job: 'marshal', school: 'w_pae', name: '진각(震脚)', emoji: '💢', cost: 52, cd: 12, max: 10,
      effect: 'aoe', mul: [3.6, 0.32], r: 264, need: { key: 'g_roar', lv: 5 },
      desc: '땅을 밟아 사방을 흔든다 — 함성 5' },
    { key: 'n_charge', job: 'marshal', school: 'w_jil', name: '철기돌격(鐵騎突擊)', emoji: '🐎', cost: 48, cd: 9, max: 10,
      effect: 'dash', mul: [3.2, 0.28], dist: 330, need: { key: 'w_rush', lv: 5 },
      desc: '한달음에 가르며 벤다 — 돌진 5' },
    { key: 'n_banner', job: 'marshal', school: 'w_su', name: '대장기(大將旗)', emoji: '🚩', cost: 56, cd: 24, max: 10,
      effect: 'buff', mul: [0, 0], buff: { sec: 13, atk: 1.55, guard: 0.45, regen: 1.8 },
      need: { key: 'g_wall', lv: 5 }, desc: '13초간 삼군이 따른다 — 철벽 5' },
    { key: 'n_edge', job: 'marshal', school: 'w_pa', name: '천단검(天斷劍)', emoji: '🌊', cost: 44, cd: 9, max: 10,
      effect: 'bolt', mul: [4.0, 0.35], need: { key: 'g_edge', lv: 5 },
      desc: '장수의 기백이 검 끝에 실린다 — 벽공검 5' },
    { key: 'n_vital', job: 'marshal', school: 'w_saeng', name: '불사결(不死訣)', emoji: '💚', cost: 48, cd: 22, max: 10,
      effect: 'heal', mul: [0, 0], heal: [0.4, 0.034], need: { key: 'g_vital', lv: 5 },
      desc: '죽음을 밀어낸다 (체력 40%+) — 회천결 5' },
    /* 전신 — 무사 갈래의 끝(4차) */
    { key: 'o_ruin', job: 'warlord', school: 'w_jung', name: '파멸격(破滅擊)', emoji: '💢', cost: 62, cd: 12, max: 10,
      effect: 'melee', mul: [6.2, 0.57], hits: 4, need: { key: 'n_heaven', lv: 5 },
      desc: '앞을 네 번 내리찍어 부순다 — 천붕격 5' },
    { key: 'o_tremor', job: 'warlord', school: 'w_pae', name: '지열(地裂)', emoji: '🌋', cost: 58, cd: 14, max: 10,
      effect: 'aoe', mul: [4.9, 0.44], r: 340, need: { key: 'n_quake', lv: 5 },
      desc: '땅이 갈라지도록 흔든다 — 진각 5' },
    { key: 'o_smite', job: 'warlord', school: 'w_jil', name: '벽력돌(霹靂突)', emoji: '⚡', cost: 54, cd: 10, max: 10,
      effect: 'dash', mul: [4.5, 0.4], dist: 410, need: { key: 'n_charge', lv: 5 },
      desc: '번개처럼 꿰뚫고 지나간다 — 철기돌격 5' },
    { key: 'o_conquer', job: 'warlord', school: 'w_su', name: '패천기(覇天旗)', emoji: '🚩', cost: 62, cd: 26, max: 10,
      effect: 'buff', mul: [0, 0], buff: { sec: 15, atk: 1.8, guard: 0.5, regen: 2.4 },
      need: { key: 'n_banner', lv: 5 }, desc: '15초간 온 전장을 호령한다 — 대장기 5' },
    { key: 'o_edge', job: 'warlord', school: 'w_pa', name: '파천검(破天劍)', emoji: '🌊', cost: 58, cd: 11, max: 10,
      effect: 'bolt', mul: [5.6, 0.5], need: { key: 'n_edge', lv: 5 },
      desc: '전신의 검기가 하늘까지 닿는다 — 천단검 5' },
    { key: 'o_vital', job: 'warlord', school: 'w_saeng', name: '재생결(再生訣)', emoji: '💚', cost: 60, cd: 24, max: 10,
      effect: 'heal', mul: [0, 0], heal: [0.58, 0.048], need: { key: 'n_vital', lv: 5 },
      desc: '무너진 몸이 다시 선다 (체력 58%+) — 불사결 5' },

    /* 궁수 → 신궁 */
    { key: 'a_shot', job: 'archer', school: 'a_u', name: '사격(射擊)', emoji: '🏹', cost: 8, cd: 0.6, max: 10,
      effect: 'arrow', mul: [1.3, 0.11], desc: '화살 하나를 날린다' },
    { key: 'a_double', job: 'archer', school: 'a_yeon', name: '연사(連射)', emoji: '🎯', cost: 22, cd: 3.4, max: 10,
      effect: 'volley', mul: [1.1, 0.08], shots: 3, desc: '화살 셋을 잇달아 쏜다' },
    { key: 'a_pierce', job: 'archer', school: 'a_gwan', name: '관통시(貫通矢)', emoji: '➶', cost: 26, cd: 6, max: 10,
      effect: 'bolt', mul: [2.0, 0.18], desc: '줄지어 선 것을 꿰뚫는다' },
    { key: 'a_eye', job: 'archer', school: 'a_an', name: '응안(鷹眼)', emoji: '🦅', cost: 30, cd: 16, max: 10,
      effect: 'buff', mul: [0, 0], buff: { sec: 9, atk: 1.4 },
      desc: '9초간 공격 +40%' },
    /* 다섯째 무예(2026-09-10) — 궁수 갈래엔 없던 기동기. 새 효과가 아니라
       무사의 돌진과 같은 dash 를 "물러나며" 쓴다 */
    { key: 'a_retreat', job: 'archer', school: 'a_toe', name: '퇴보사(退步射)', emoji: '🏃', cost: 20, cd: 6, max: 10,
      effect: 'dash', mul: [1.3, 0.11], dist: 180, desc: '뒤로 물러나며 화살을 놓는다' },
    /* 여섯째 무예(2026-09-11) — 궁수 갈래엔 없던 주위 공격. 새 효과가 아니라
       협객의 선풍각과 같은 aoe 를 사방으로 놓는 화살 고리로 쓴다 */
    { key: 'a_burst', job: 'archer', school: 'a_hwan', name: '환시(環矢)', emoji: '💫', cost: 20, cd: 5, max: 10,
      effect: 'aoe', mul: [1.4, 0.12], r: 110, desc: '사방으로 화살을 흩놓는다' },
    { key: 's_rain', job: 'sniper', school: 'a_u', name: '전우(箭雨)', emoji: '🌧️', cost: 42, cd: 10, max: 10,
      effect: 'rain', mul: [2.6, 0.24], need: { key: 'a_shot', lv: 5 },
      desc: '앞쪽에 화살을 쏟는다 — 사격 5' },
    { key: 's_snipe', job: 'sniper', school: 'a_gwan', name: '일점사(一點射)', emoji: '🔭', cost: 36, cd: 8, max: 10,
      effect: 'bolt', mul: [4.0, 0.34], need: { key: 'a_pierce', lv: 5 },
      desc: '한 발에 힘을 모은다 — 관통시 5' },
    { key: 's_split', job: 'sniper', school: 'a_yeon', name: '분시(分矢)', emoji: '🎏', cost: 34, cd: 5, max: 10,
      effect: 'volley', mul: [1.5, 0.12], shots: 4, need: { key: 'a_double', lv: 5 },
      desc: '화살 넷이 갈라져 난다 — 연사 5' },
    { key: 's_retreat', job: 'sniper', school: 'a_toe', name: '활보사(闊步射)', emoji: '🏃', cost: 34, cd: 7, max: 10,
      effect: 'dash', mul: [2.3, 0.2], dist: 240, need: { key: 'a_retreat', lv: 5 },
      desc: '더 크게 물러나며 쏜다 — 퇴보사 5' },
    { key: 's_burst', job: 'sniper', school: 'a_hwan', name: '광환시(廣環矢)', emoji: '💫', cost: 34, cd: 6, max: 10,
      effect: 'aoe', mul: [2.4, 0.21], r: 140, need: { key: 'a_burst', lv: 5 },
      desc: '고리가 더 넓게 퍼진다 — 환시 5' },
    /* 비장 — 궁수 갈래의 끝 */
    { key: 'f_storm', job: 'flier', school: 'a_u', name: '시우(矢雨)', emoji: '⛈️', cost: 60, cd: 12, max: 10,
      effect: 'rain', mul: [4.2, 0.38], need: { key: 's_rain', lv: 5 },
      desc: '앞쪽 하늘을 화살로 덮는다 — 전우 5' },
    { key: 'f_pierce', job: 'flier', school: 'a_gwan', name: '파천시(破天矢)', emoji: '🌠', cost: 54, cd: 9, max: 10,
      effect: 'bolt', mul: [6.4, 0.55], need: { key: 's_snipe', lv: 5 },
      desc: '한 발이 줄지어 선 것을 다 꿴다 — 일점사 5' },
    { key: 'f_volley', job: 'flier', school: 'a_yeon', name: '만시(萬矢)', emoji: '🎆', cost: 50, cd: 7, max: 10,
      effect: 'volley', mul: [1.9, 0.16], shots: 8, need: { key: 's_split', lv: 5 },
      desc: '화살 여덟을 한 손으로 놓는다 — 분시 5' },
    { key: 'f_focus', job: 'flier', school: 'a_an', name: '정심(定心)', emoji: '🧿', cost: 46, cd: 22, max: 10,
      effect: 'buff', mul: [0, 0], buff: { sec: 12, atk: 1.75, speed: 1.15 },
      need: { key: 'a_eye', lv: 5 }, desc: '12초간 공격 +75% — 응안 5' },
    { key: 'f_retreat', job: 'flier', school: 'a_toe', name: '답공사(踏空射)', emoji: '🏃', cost: 46, cd: 8, max: 10,
      effect: 'dash', mul: [3.5, 0.3], dist: 300, need: { key: 's_retreat', lv: 5 },
      desc: '허공을 딛듯 물러나며 꿰뚫는다 — 활보사 5' },
    { key: 'f_burst', job: 'flier', school: 'a_hwan', name: '천환시(天環矢)', emoji: '💫', cost: 46, cd: 7, max: 10,
      effect: 'aoe', mul: [3.6, 0.31], r: 175, need: { key: 's_burst', lv: 5 },
      desc: '하늘 전체가 고리로 뒤덮인다 — 광환시 5' },
    /* 궁성 — 궁수 갈래의 끝(4차) */
    { key: 'h_tempest', job: 'falcon', school: 'a_u', name: '천사우(天射雨)', emoji: '⛈️', cost: 66, cd: 13, max: 10,
      effect: 'rain', mul: [5.6, 0.5], need: { key: 'f_storm', lv: 5 },
      desc: '하늘 전체가 화살비로 뒤덮인다 — 시우 5' },
    { key: 'h_ray', job: 'falcon', school: 'a_gwan', name: '광시(光矢)', emoji: '✨', cost: 60, cd: 10, max: 10,
      effect: 'bolt', mul: [8.4, 0.7], need: { key: 'f_pierce', lv: 5 },
      desc: '빛살 하나가 모든 것을 꿰뚫는다 — 파천시 5' },
    { key: 'h_swarm', job: 'falcon', school: 'a_yeon', name: '십이시(十二矢)', emoji: '🎆', cost: 56, cd: 8, max: 10,
      effect: 'volley', mul: [2.4, 0.2], shots: 12, need: { key: 'f_volley', lv: 5 },
      desc: '화살 열둘이 한 손에서 갈라진다 — 만시 5' },
    { key: 'h_zenith', job: 'falcon', school: 'a_an', name: '궁천합(弓天合)', emoji: '🌠', cost: 52, cd: 24, max: 10,
      effect: 'buff', mul: [0, 0], buff: { sec: 14, atk: 2.0, speed: 1.2 },
      need: { key: 'f_focus', lv: 5 }, desc: '14초간 활이 하늘과 하나가 된다 — 정심 5' },
    { key: 'h_retreat', job: 'falcon', school: 'a_toe', name: '익보사(翼步射)', emoji: '🏃', cost: 58, cd: 9, max: 10,
      effect: 'dash', mul: [5.0, 0.44], dist: 360, need: { key: 'f_retreat', lv: 5 },
      desc: '날개 돋친 듯 물러나며 하늘을 꿴다 — 답공사 5' },
    { key: 'h_burst', job: 'falcon', school: 'a_hwan', name: '극환시(極環矢)', emoji: '💫', cost: 58, cd: 8, max: 10,
      effect: 'aoe', mul: [5.2, 0.44], r: 210, need: { key: 'f_burst', lv: 5 },
      desc: '고리 끝에 하늘이 걸린다 — 천환시 5' },

    /* 협객 → 자객 */
    { key: 'r_twin', job: 'rogue', school: 'r_cham', name: '쌍참(雙斬)', emoji: '⚡', cost: 7, cd: 0.42, max: 10,
      effect: 'melee', mul: [0.72, 0.06], hits: 2, desc: '앞을 두 번 긋는다' },
    { key: 'r_knife', job: 'rogue', school: 'r_hwa', name: '비도(飛刀)', emoji: '🔪', cost: 18, cd: 2.6, max: 10,
      effect: 'volley', mul: [1.0, 0.09], shots: 2, desc: '표창 둘을 던진다' },
    { key: 'r_step', job: 'rogue', school: 'r_bo', name: '은신보(隱身步)', emoji: '👣', cost: 22, cd: 7, max: 10,
      effect: 'dash', mul: [1.2, 0.1], dist: 260, invuln: 0.7,
      desc: '한 걸음에 빠져나간다 — 잠깐 맞지 않는다' },
    { key: 'r_vital', job: 'rogue', school: 'r_hon', name: '급소(急所)', emoji: '🎴', cost: 26, cd: 15, max: 10,
      effect: 'buff', mul: [0, 0], buff: { sec: 8, atk: 1.55 },
      desc: '8초간 공격 +55%' },
    /* 다섯째 무예(2026-09-10) — 협객 갈래엔 없던 주위 공격. 새 효과가 아니라
       무사의 선풍과 같은 aoe 를 몸을 낮춘 발차기로 쓴다 */
    { key: 'r_whirl', job: 'rogue', school: 'r_pung', name: '선풍각(旋風脚)', emoji: '🦵', cost: 20, cd: 5, max: 10,
      effect: 'aoe', mul: [1.4, 0.12], r: 110, desc: '몸을 낮춰 주위를 걷어찬다' },
    /* 여섯째 무예(2026-09-11) — 협객 갈래엔 없던 관통. 새 효과가 아니라
       무사의 파공검과 같은 bolt 를 던지는 암기(暗器)로 쓴다 */
    { key: 'r_dart', job: 'rogue', school: 'r_pyo', name: '관통표(貫通鏢)', emoji: '🎯', cost: 18, cd: 5, max: 10,
      effect: 'bolt', mul: [1.6, 0.14], desc: '표창을 꿰뚫듯 던진다 · 관통' },
    { key: 'x_storm', job: 'assassin', school: 'r_cham', name: '난무(亂舞)', emoji: '🌀', cost: 38, cd: 8, max: 10,
      effect: 'melee', mul: [1.5, 0.13], hits: 4, need: { key: 'r_twin', lv: 5 },
      desc: '앞을 네 번 긋는다 — 쌍참 5' },
    { key: 'x_fan', job: 'assassin', school: 'r_hwa', name: '만천화우(滿天花雨)', emoji: '🎇', cost: 40, cd: 9, max: 10,
      effect: 'volley', mul: [1.4, 0.12], shots: 5, need: { key: 'r_knife', lv: 5 },
      desc: '표창 다섯을 흩뿌린다 — 비도 5' },
    { key: 'x_shadow', job: 'assassin', school: 'r_bo', name: '그림자밟기', emoji: '🕶️', cost: 32, cd: 6, max: 10,
      effect: 'dash', mul: [2.0, 0.17], dist: 300, invuln: 0.9,
      need: { key: 'r_step', lv: 5 }, desc: '그림자를 밟고 지나간다 — 은신보 5' },
    { key: 'x_whirl', job: 'assassin', school: 'r_pung', name: '질풍각(疾風脚)', emoji: '🦵', cost: 34, cd: 6, max: 10,
      effect: 'aoe', mul: [2.4, 0.21], r: 140, need: { key: 'r_whirl', lv: 5 },
      desc: '더 빠르게, 더 넓게 휩쓴다 — 선풍각 5' },
    { key: 'x_dart', job: 'assassin', school: 'r_pyo', name: '암습표(暗襲鏢)', emoji: '🎯', cost: 32, cd: 7, max: 10,
      effect: 'bolt', mul: [2.8, 0.24], need: { key: 'r_dart', lv: 5 },
      desc: '어둠 속에서 꿰뚫는다 — 관통표 5' },
    /* 귀영 — 협객 갈래의 끝 */
    { key: 'v_blur', job: 'wraith', school: 'r_cham', name: '잔영(殘影)', emoji: '👥', cost: 52, cd: 8, max: 10,
      effect: 'melee', mul: [2.2, 0.19], hits: 6, need: { key: 'x_storm', lv: 5 },
      desc: '몸이 남기 전에 여섯 번 긋는다 — 난무 5' },
    { key: 'v_petal', job: 'wraith', school: 'r_hwa', name: '낙화(落花)', emoji: '🌸', cost: 54, cd: 9, max: 10,
      effect: 'volley', mul: [1.8, 0.15], shots: 7, need: { key: 'x_fan', lv: 5 },
      desc: '표창 일곱이 꽃잎처럼 진다 — 만천화우 5' },
    { key: 'v_void', job: 'wraith', school: 'r_bo', name: '허공답보(虛空踏步)', emoji: '🌫️', cost: 44, cd: 7, max: 10,
      effect: 'dash', mul: [3.0, 0.26], dist: 360, invuln: 1.2,
      need: { key: 'x_shadow', lv: 5 }, desc: '허공을 밟고 건너간다 — 그림자밟기 5' },
    { key: 'v_mark', job: 'wraith', school: 'r_hon', name: '사혼(死魂)', emoji: '💀', cost: 48, cd: 20, max: 10,
      effect: 'buff', mul: [0, 0], buff: { sec: 10, atk: 1.95 },
      need: { key: 'r_vital', lv: 5 }, desc: '10초간 공격 +95% — 급소 5' },
    { key: 'v_whirl', job: 'wraith', school: 'r_pung', name: '광풍각(狂風脚)', emoji: '🦵', cost: 46, cd: 7, max: 10,
      effect: 'aoe', mul: [3.6, 0.31], r: 175, need: { key: 'x_whirl', lv: 5 },
      desc: '미친 듯이 휘돌아 찬다 — 질풍각 5' },
    { key: 'v_dart', job: 'wraith', school: 'r_pyo', name: '귀표(鬼鏢)', emoji: '🎯', cost: 44, cd: 9, max: 10,
      effect: 'bolt', mul: [4.0, 0.35], need: { key: 'x_dart', lv: 5 },
      desc: '귀신 들린 듯 파고든다 — 암습표 5' },
    /* 명왕 — 협객 갈래의 끝(4차) */
    { key: 'd_carve', job: 'reaper', school: 'r_cham', name: '팔도(八刀)', emoji: '🔪', cost: 60, cd: 9, max: 10,
      effect: 'melee', mul: [3.0, 0.26], hits: 8, need: { key: 'v_blur', lv: 5 },
      desc: '여덟 번 긋고 나서야 멈춘다 — 잔영 5' },
    { key: 'd_bloom', job: 'reaper', school: 'r_hwa', name: '구화만개(九花滿開)', emoji: '🌺', cost: 62, cd: 10, max: 10,
      effect: 'volley', mul: [2.2, 0.18], shots: 9, need: { key: 'v_petal', lv: 5 },
      desc: '표창 아홉이 지지 않고 흩날린다 — 낙화 5' },
    { key: 'd_veil', job: 'reaper', school: 'r_bo', name: '명계보(冥界步)', emoji: '⚰️', cost: 50, cd: 8, max: 10,
      effect: 'dash', mul: [3.8, 0.32], dist: 420, invuln: 1.5, need: { key: 'v_void', lv: 5 },
      desc: '저승 문턱을 밟고 되돌아온다 — 허공답보 5' },
    { key: 'd_curse', job: 'reaper', school: 'r_hon', name: '명왕부(冥王符)', emoji: '👑', cost: 56, cd: 22, max: 10,
      effect: 'buff', mul: [0, 0], buff: { sec: 12, atk: 2.3 },
      need: { key: 'v_mark', lv: 5 }, desc: '12초간 죽음의 기운을 두른다 — 사혼 5' },
    { key: 'd_whirl', job: 'reaper', school: 'r_pung', name: '절명풍(絶命風)', emoji: '🦵', cost: 58, cd: 8, max: 10,
      effect: 'aoe', mul: [5.2, 0.44], r: 210, need: { key: 'v_whirl', lv: 5 },
      desc: '휘도는 바람이 목숨을 끊는다 — 광풍각 5' },
    { key: 'd_dart', job: 'reaper', school: 'r_pyo', name: '명표(冥鏢)', emoji: '🎯', cost: 58, cd: 11, max: 10,
      effect: 'bolt', mul: [5.6, 0.5], need: { key: 'v_dart', lv: 5 },
      desc: '저승의 기운이 표창 끝에 실린다 — 귀표 5' },

    /* 방사 → 도사 */
    { key: 'm_fire', job: 'mage', school: 'm_seong', name: '화구(火球)', emoji: '🔥', cost: 12, cd: 0.9, max: 10,
      effect: 'bolt', mul: [1.5, 0.13], desc: '불덩이를 굴린다 · 관통' },
    { key: 'm_bolt', job: 'mage', school: 'm_jin', name: '뇌전(雷電)', emoji: '⚡', cost: 26, cd: 4, max: 10,
      effect: 'aoe', mul: [1.9, 0.17], r: 165, desc: '벼락이 주위에 떨어진다' },
    { key: 'm_heal', job: 'mage', school: 'm_saeng', name: '치유(治癒)', emoji: '💚', cost: 34, cd: 11, max: 10,
      effect: 'heal', mul: [0, 0], heal: [0.18, 0.022], desc: '몸을 추스른다 (체력 18%+)' },
    { key: 'm_talis', job: 'mage', school: 'm_bu', name: '부적(符籍)', emoji: '📿', cost: 30, cd: 16, max: 10,
      effect: 'buff', mul: [0, 0], buff: { sec: 10, atk: 1.25, regen: 2.6 },
      desc: '10초간 공격 +25% · 기력이 빨리 찬다' },
    /* 다섯째 무예(2026-09-10) — 방사 갈래엔 없던 기동기. 새 효과가 아니라
       협객의 은신보와 같은 dash(무적 시간 포함)를 도술의 축지로 쓴다 */
    { key: 'm_step', job: 'mage', school: 'm_chuk', name: '축지(縮地)', emoji: '🌀', cost: 22, cd: 7, max: 10,
      effect: 'dash', mul: [1.2, 0.1], dist: 220, invuln: 0.5,
      desc: '땅을 접어 순식간에 나아간다' },
    /* 여섯째 무예(2026-09-11) — 방사 갈래엔 없던 여러 발. 새 효과가 아니라
       궁수의 연사와 같은 volley 를 여러 개의 마탄으로 쓴다 */
    { key: 'm_orb', job: 'mage', school: 'm_tan', name: '마탄(魔彈)', emoji: '🔵', cost: 22, cd: 3.4, max: 10,
      effect: 'volley', mul: [1.1, 0.08], shots: 3, desc: '기운 구슬 셋을 잇달아 놓는다' },
    { key: 'p_quake', job: 'sage', school: 'm_jin', name: '지진(地震)', emoji: '🌋', cost: 44, cd: 10, max: 10,
      effect: 'aoe', mul: [3.2, 0.28], r: 230, need: { key: 'm_bolt', lv: 5 },
      desc: '땅을 흔든다 — 뇌전 5' },
    { key: 'p_beam', job: 'sage', school: 'm_seong', name: '천뢰(天雷)', emoji: '🌩️', cost: 40, cd: 9, max: 10,
      effect: 'rain', mul: [3.0, 0.26], need: { key: 'm_fire', lv: 5 },
      desc: '앞쪽에 벼락을 쏟는다 — 화구 5' },
    { key: 'p_ward', job: 'sage', school: 'm_bu', name: '호신부(護身符)', emoji: '🧧', cost: 36, cd: 18, max: 10,
      effect: 'buff', mul: [0, 0], buff: { sec: 12, atk: 1.1, guard: 0.4, regen: 3.2 },
      need: { key: 'm_talis', lv: 5 }, desc: '12초간 덜 맞고 기력이 샘솟는다 — 부적 5' },
    { key: 'p_step', job: 'sage', school: 'm_chuk', name: '축지술(縮地術)', emoji: '🌀', cost: 36, cd: 8, max: 10,
      effect: 'dash', mul: [2.0, 0.17], dist: 280, invuln: 0.7, need: { key: 'm_step', lv: 5 },
      desc: '땅을 더 크게 접는다 — 축지 5' },
    { key: 'p_orb', job: 'sage', school: 'm_tan', name: '연환탄(連環彈)', emoji: '🔵', cost: 34, cd: 5, max: 10,
      effect: 'volley', mul: [1.5, 0.12], shots: 4, need: { key: 'm_orb', lv: 5 },
      desc: '구슬 넷이 고리처럼 잇는다 — 마탄 5' },
    /* 진인 — 방사 갈래의 끝 */
    { key: 'i_meteor', job: 'immortal', school: 'm_seong', name: '유성(流星)', emoji: '💫', cost: 64, cd: 12, max: 10,
      effect: 'rain', mul: [4.8, 0.42], need: { key: 'p_beam', lv: 5 },
      desc: '앞쪽에 별을 떨군다 — 천뢰 5' },
    { key: 'i_abyss', job: 'immortal', school: 'm_jin', name: '천붕지열(天崩地裂)', emoji: '🌋', cost: 68, cd: 14, max: 10,
      effect: 'aoe', mul: [5.0, 0.44], r: 300, need: { key: 'p_quake', lv: 5 },
      desc: '하늘이 무너지고 땅이 갈라진다 — 지진 5' },
    { key: 'i_mend', job: 'immortal', school: 'm_saeng', name: '회춘(回春)', emoji: '🌿', cost: 50, cd: 13, max: 10,
      effect: 'heal', mul: [0, 0], heal: [0.42, 0.035], need: { key: 'm_heal', lv: 5 },
      desc: '몸을 되돌린다 (체력 42%+) — 치유 5' },
    { key: 'i_tao', job: 'immortal', school: 'm_bu', name: '태극(太極)', emoji: '☯', cost: 58, cd: 22, max: 10,
      effect: 'buff', mul: [0, 0], buff: { sec: 14, atk: 1.5, guard: 0.3, regen: 4.0 },
      need: { key: 'p_ward', lv: 5 }, desc: '14초간 음양이 돈다 — 호신부 5' },
    { key: 'i_step', job: 'immortal', school: 'm_chuk', name: '이형보(移形步)', emoji: '🌀', cost: 48, cd: 9, max: 10,
      effect: 'dash', mul: [3.0, 0.26], dist: 340, invuln: 0.9, need: { key: 'p_step', lv: 5 },
      desc: '형체를 옮기듯 건너간다 — 축지술 5' },
    { key: 'i_orb', job: 'immortal', school: 'm_tan', name: '유성탄(流星彈)', emoji: '🔵', cost: 50, cd: 7, max: 10,
      effect: 'volley', mul: [1.9, 0.16], shots: 6, need: { key: 'p_orb', lv: 5 },
      desc: '별 여섯이 한 손에서 쏟아진다 — 연환탄 5' },
    /* 천존 — 방사 갈래의 끝(4차) */
    { key: 'z_starfall', job: 'ascendant', school: 'm_seong', name: '낙성우(落星雨)', emoji: '💫', cost: 70, cd: 13, max: 10,
      effect: 'rain', mul: [6.5, 0.56], need: { key: 'i_meteor', lv: 5 },
      desc: '별들이 통째로 떨어진다 — 유성 5' },
    { key: 'z_collapse', job: 'ascendant', school: 'm_jin', name: '건곤붕(乾坤崩)', emoji: '🌌', cost: 74, cd: 15, max: 10,
      effect: 'aoe', mul: [6.8, 0.58], r: 330, need: { key: 'i_abyss', lv: 5 },
      desc: '하늘과 땅이 함께 무너진다 — 천붕지열 5' },
    { key: 'z_rebirth', job: 'ascendant', school: 'm_saeng', name: '환생(還生)', emoji: '🌿', cost: 58, cd: 14, max: 10,
      effect: 'heal', mul: [0, 0], heal: [0.65, 0.05], need: { key: 'i_mend', lv: 5 },
      desc: '죽음의 문턱에서 되돌린다 (체력 65%+) — 회춘 5' },
    { key: 'z_eternity', job: 'ascendant', school: 'm_bu', name: '무극(無極)', emoji: '🌠', cost: 64, cd: 24, max: 10,
      effect: 'buff', mul: [0, 0], buff: { sec: 16, atk: 1.65, guard: 0.35, regen: 4.8 },
      need: { key: 'i_tao', lv: 5 }, desc: '16초간 하늘과 땅을 몸에 두른다 — 태극 5' },
    { key: 'z_step', job: 'ascendant', school: 'm_chuk', name: '신행보(神行步)', emoji: '🌀', cost: 62, cd: 10, max: 10,
      effect: 'dash', mul: [4.2, 0.36], dist: 400, invuln: 1.1, need: { key: 'i_step', lv: 5 },
      desc: '신선의 걸음으로 세상을 건넌다 — 이형보 5' },
    { key: 'z_orb', job: 'ascendant', school: 'm_tan', name: '성라탄(星羅彈)', emoji: '🔵', cost: 56, cd: 8, max: 10,
      effect: 'volley', mul: [2.4, 0.2], shots: 8, need: { key: 'i_orb', lv: 5 },
      desc: '별자리 여덟이 한꺼번에 쏟아진다 — 유성탄 5' },

    /* 5차 각성기 — 갈래마다 둘. 4차 사슬 하나의 끝에 붙고(need 5) 그 유파를 그대로 쓴다 */
    { key: 'p_wrath', job: 'godwar', school: 'w_jung', name: '천멸격(天滅擊)', emoji: '☄️', cost: 74, cd: 13, max: 10,
      effect: 'melee', mul: [8.4, 0.76], hits: 5, need: { key: 'o_ruin', lv: 5 },
      desc: '앞을 다섯 번 내리쳐 하늘을 무너뜨린다 — 파멸격 5' },
    { key: 'p_banner', job: 'godwar', school: 'w_su', name: '군신강림(軍神降臨)', emoji: '🏵️', cost: 72, cd: 32, max: 10,
      effect: 'buff', mul: [0, 0], buff: { sec: 20, atk: 2.2, guard: 0.6, regen: 3.4 },
      need: { key: 'o_conquer', lv: 5 }, desc: '20초간 전장의 이름을 몸에 둘렀다 — 패천기 5' },
    { key: 'p_stars', job: 'skybow', school: 'a_yeon', name: '성궁만천(星弓滿天)', emoji: '🌌', cost: 68, cd: 9, max: 10,
      effect: 'volley', mul: [2.9, 0.24], shots: 16, need: { key: 'h_swarm', lv: 5 },
      desc: '화살 열여섯이 별처럼 흩어진다 — 십이시 5' },
    { key: 'p_sun', job: 'skybow', school: 'a_gwan', name: '일월시(日月矢)', emoji: '🌞', cost: 72, cd: 11, max: 10,
      effect: 'bolt', mul: [10.5, 0.85], need: { key: 'h_ray', lv: 5 },
      desc: '해와 달을 한 살에 꿴다 — 광시 5' },
    { key: 'p_afterimage', job: 'noshadow', school: 'r_cham', name: '무영참(無影斬)', emoji: '🫥', cost: 72, cd: 10, max: 10,
      effect: 'melee', mul: [3.6, 0.3], hits: 12, need: { key: 'd_carve', lv: 5 },
      desc: '열두 번 그은 뒤에야 모습이 남는다 — 팔도 5' },
    { key: 'p_gate', job: 'noshadow', school: 'r_bo', name: '유명문(幽冥門)', emoji: '🚪', cost: 62, cd: 9, max: 10,
      effect: 'dash', mul: [4.6, 0.38], dist: 460, invuln: 2, need: { key: 'd_veil', lv: 5 },
      desc: '문을 열고 닫는 사이에 건너간다 — 명계보 5' },
    { key: 'p_void', job: 'voidsage', school: 'm_jin', name: '태허붕(太虛崩)', emoji: '🌑', cost: 88, cd: 16, max: 10,
      effect: 'aoe', mul: [8.2, 0.68], r: 380, need: { key: 'z_collapse', lv: 5 },
      desc: '비어 있던 자리가 한꺼번에 무너져 내린다 — 건곤붕 5' },
    { key: 'p_all', job: 'voidsage', school: 'm_saeng', name: '만상환생(萬象還生)', emoji: '🌱', cost: 70, cd: 15, max: 10,
      effect: 'heal', mul: [0, 0], heal: [0.8, 0.06], need: { key: 'z_rebirth', lv: 5 },
      desc: '모든 모습이 처음으로 돌아간다 (체력 80%+) — 환생 5' }
  ];

  /**
   * 유파(流派, PLAN §5-2) — 갈래마다 사슬 6개를 이름 붙여 묶는다. `SKILLS` 각 행의
   * `school` 이 이 표의 `id` 를 가리킨다(무명 넷은 어느 유파도 아니다 — 전직 전
   * 임시로 쓰는 것들이라 세트에 안 들어간다). 띠(8칸) 안에 **같은 유파가 2개면
   * 소효과, 4개면 대효과**(대체지 누적이 아니다 — `job.js` `schoolBonus()` 참고,
   * `kind:'dash'` 만 예외로 2효과 위에 4효과를 얹는다, 코드 쪽 주석 참고).
   * `kind` 는 어디에 곱하는지를 가리킬 뿐 **새 효과가 아니다**(PLAN 원문 그대로:
   * 기존 배율·쿨·기력·지속만 만진다):
   *   dmg    — 그 무예의 피해 배율(mul)에 곱한다(근접·관통 계열)
   *   aoe    — 그 무예의 반경(r)에 곱한다
   *   buff   — 그 무예가 거는 북돋움의 지속(sec)에 곱한다
   *   heal   — 그 무예의 회복 비율에 곱한다
   *   volley — 그 무예가 놓는 발수(shots)에 더한다(2=+1, 4=+2)
   *   dash   — 2 는 **회피(대시) 재사용 대기**에 곱하고, 4 는 그 위에 얹어
   *            "이 유파의 dash 무예로 때리면 급소가 확정"된다
   */
  var SCHOOLS = [
    { id: 'w_jung', job: 'warrior', name: '정(正)', kind: 'dmg', v2: 1.15, v4: 1.35 },
    { id: 'w_pae', job: 'warrior', name: '패(覇)', kind: 'aoe', v2: 1.15, v4: 1.35 },
    { id: 'w_jil', job: 'warrior', name: '질(疾)', kind: 'dash', v2: 0.8, v4: 1 },
    { id: 'w_su', job: 'warrior', name: '수(守)', kind: 'buff', v2: 1.15, v4: 1.35 },
    { id: 'w_pa', job: 'warrior', name: '파(破)', kind: 'dmg', v2: 1.15, v4: 1.35 },
    { id: 'w_saeng', job: 'warrior', name: '생(生)', kind: 'heal', v2: 1.15, v4: 1.35 },

    { id: 'a_u', job: 'archer', name: '우(雨)', kind: 'dmg', v2: 1.15, v4: 1.35 },
    { id: 'a_gwan', job: 'archer', name: '관(貫)', kind: 'dmg', v2: 1.15, v4: 1.35 },
    { id: 'a_yeon', job: 'archer', name: '연(連)', kind: 'volley', v2: 1, v4: 2 },
    { id: 'a_an', job: 'archer', name: '안(眼)', kind: 'buff', v2: 1.15, v4: 1.35 },
    { id: 'a_toe', job: 'archer', name: '퇴(退)', kind: 'dash', v2: 0.8, v4: 1 },
    { id: 'a_hwan', job: 'archer', name: '환(環)', kind: 'aoe', v2: 1.15, v4: 1.35 },

    { id: 'r_cham', job: 'rogue', name: '참(斬)', kind: 'dmg', v2: 1.15, v4: 1.35 },
    { id: 'r_hwa', job: 'rogue', name: '화(花)', kind: 'volley', v2: 1, v4: 2 },
    { id: 'r_bo', job: 'rogue', name: '보(步)', kind: 'dash', v2: 0.8, v4: 1 },
    { id: 'r_hon', job: 'rogue', name: '혼(魂)', kind: 'buff', v2: 1.15, v4: 1.35 },
    { id: 'r_pung', job: 'rogue', name: '풍(風)', kind: 'aoe', v2: 1.15, v4: 1.35 },
    { id: 'r_pyo', job: 'rogue', name: '표(鏢)', kind: 'dmg', v2: 1.15, v4: 1.35 },

    { id: 'm_seong', job: 'mage', name: '성(星)', kind: 'dmg', v2: 1.15, v4: 1.35 },
    { id: 'm_jin', job: 'mage', name: '진(震)', kind: 'aoe', v2: 1.15, v4: 1.35 },
    { id: 'm_saeng', job: 'mage', name: '생(生)', kind: 'heal', v2: 1.15, v4: 1.35 },
    { id: 'm_bu', job: 'mage', name: '부(符)', kind: 'buff', v2: 1.15, v4: 1.35 },
    { id: 'm_chuk', job: 'mage', name: '축(縮)', kind: 'dash', v2: 0.8, v4: 1 },
    { id: 'm_tan', job: 'mage', name: '탄(彈)', kind: 'volley', v2: 1, v4: 2 }
  ];

  function schoolDef(id) {
    for (var i = 0; i < SCHOOLS.length; i++) { if (SCHOOLS[i].id === id) { return SCHOOLS[i]; } }
    return null;
  }

  /** SP 총량(§5-2) — 레벨당 3→2 로 줄었다. **옛 세이브가 이미 더 찍어 뒀을 수
   *  있다** — `spLeft()`(job.js) 가 `Math.max(0, ...)` 로 막아 두는 것만으로
   *  충분하다: 이미 찍은 것은 그대로 두고(환급·삭제 없음) 새로 못 찍게만 한다.
   *  이 값 자체를 낮추는 것 말고 옛 세이브를 위해 따로 손볼 자리는 없다. */
  var SP_PER_LEVEL = 2;

  function job(key) {
    for (var i = 0; i < JOBS.length; i++) { if (JOBS[i].key === key) { return JOBS[i]; } }
    return JOBS[0];
  }

  function skill(key) {
    for (var i = 0; i < SKILLS.length; i++) { if (SKILLS[i].key === key) { return SKILLS[i]; } }
    return null;
  }

  /** 그 직업이 쓸 수 있는 무예 (윗자리는 아랫자리 것도 그대로 쓴다) */
  function skillsOf(jobKey) {
    var chain = [], j = job(jobKey);
    while (j) { chain.unshift(j.key); j = j.from ? job(j.from) : null; }
    return SKILLS.filter(function (s) { return chain.indexOf(s.job) >= 0; });
  }

  /** 다음 전직 후보 (없으면 빈 배열) */
  function nextJobs(jobKey) {
    return JOBS.filter(function (j) { return j.from === jobKey; });
  }

  /**
   * 스승(§5-1) — 갈래 뿌리(1차 키)마다 넷, `data.js` HEROES 에서 그 갈래
   * 무기·기질에 맞춰 골랐다(faction·stats·emoji 로 고른다는 PLAN 원문을
   * 이 판의 실제 인물 풀에 대면 "직업 이모지·대사와 맞는 인물"이 가장
   * 뚜렷한 기준이었다 — 예: 방사 🔮 는 일본사 히미코(🔮 그대로), 협객 은
   * 일본사 한조(🥷, 암습)). 1~4차 전직마다 하나씩 순서대로 뜬다.
   */
  var MENTORS = {
    warrior: ['sg_lubu', 'kr_gyebaek', 'jp_musashi', 'eu_leonidas'],
    archer: ['sg_huangzhong', 'sg_taishici', 'jp_yoshitsune', 'wd_genghis'],
    rogue: ['jp_hanzo', 'sg_ganning', 'jp_tomoegozen', 'wd_shaka'],
    mage: ['jp_himiko', 'sg_zhugeliang', 'wd_ibnsina', 'eu_davinci']
  };

  /**
   * 고유 조작(§5-1) — 회피를 **길게 누르면** 나오는, 효과 9 밖의 "조작" 하나
   * (side.js 입력 층에서만 판정한다, castSkill() 이 아니다 — §2-1 유지).
   * 갈래 뿌리마다 하나뿐이고 cost·cd 는 공통이다. `*Boost` 필드는 그 갈래
   * 스승 넷 중 하나라도 도감에 있으면 켜진다(job.js `signature()` 참고).
   */
  var SIGNATURE_COST = 12, SIGNATURE_COOL = 6, SIGNATURE_HOLD = 0.18;
  var SIGNATURES = {
    warrior: { key: 'parry', name: '받아치기', emoji: '🛡️',
      window: 0.25, windowBoost: 0.32, nextMul: 1.5,
      desc: '0.25s 안에 맞으면 무효 + 다음 타격 위력 ×1.5' },
    archer: { key: 'pull', name: '당기기', emoji: '🏹',
      minHold: 0.4, maxHold: 1.2, mulMin: 1.0, mulMax: 2.2, mulMaxBoost: 2.5,
      pierceAdd: 1, moveMul: 0.4,
      desc: '누르는 시간(0.4~1.2s)만큼 관통 +1·위력↑, 그 동안 이동 40%' },
    rogue: { key: 'shadow', name: '그림자 걷기', emoji: '🌑',
      dur: 0.5, firstHitMul: 1.8, firstHitMulBoost: 2.1,
      desc: '0.5s 무적 이동(적 통과) + 그 뒤 첫 타 ×1.8' },
    mage: { key: 'elem', name: '원소 전환', emoji: '🔮',
      shots: 3, shotsBoost: 4,
      desc: '다음 화살·마탄·비 3발에 화(지속)·빙(둔화)·전(사슬) 속성' }
  };

  /**
   * 갈래 빛깔(PLAN §6 성장 가시화 "전직 1~4차마다 몸 색", 2026-09-23) — 주인공 GLB 옷 물들임(세력 색)에
   * 차수 × `world3d.jobTint`(기본 0.12) 만큼 섞는다. 4차면 48% 가 갈래 색이다. 보이는 색뿐 — 판정·세이브 무관
   */
  var BRANCH_TINT = { warrior: '#b8412f', archer: '#4f8f3f', rogue: '#5b4a8c', mage: '#2f6fb0' };

  function mentorsOf(rootKey) { return MENTORS[rootKey] || []; }
  function signatureOf(rootKey) { return SIGNATURES[rootKey] || null; }

  global.DG = global.DG || {};
  global.DG.jobData = {
    JOBS: JOBS, SKILLS: SKILLS, SCHOOLS: SCHOOLS, SP_PER_LEVEL: SP_PER_LEVEL,
    MENTORS: MENTORS, SIGNATURES: SIGNATURES, BRANCH_TINT: BRANCH_TINT,
    SIGNATURE_COST: SIGNATURE_COST, SIGNATURE_COOL: SIGNATURE_COOL, SIGNATURE_HOLD: SIGNATURE_HOLD,
    job: job, skill: skill, skillsOf: skillsOf, nextJobs: nextJobs, schoolDef: schoolDef,
    mentorsOf: mentorsOf, signatureOf: signatureOf
  };
})(window);
