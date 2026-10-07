/**
 * 장비 데이터 — 부위 · 물건 · 주문서
 * ---------------------------------------------------------------
 * 원작의 장비 판을 옮긴 것이다. 원작의 뼈대는 셋이다:
 *   1) 부위마다 하나씩 낀다        (무기 · 투구 · 갑옷 · 하의 · 신 · 수갑 · 망토)
 *   2) 요구 수준(Lv)이 있다        — 레벨이 모자라면 못 낀다
 *   3) **주문서로 올린다**          — 업그레이드 가능 횟수(업횟)를 쓰고 확률로 붙는다
 *
 * 이 판에는 '터지는' 규칙을 넣지 않았다. 초기 원작도 실패하면 **업횟만** 닳았다.
 *
 * 물건 한 줄 = [key, slot, 이름, 요구Lv, 공격, 방어, 체력, 값, 업횟]
 * 사냥터가 Lv.1 · 5 · 12 로 열리므로 장비도 그 결에 맞춰 네 단(1·5·12·20)이다.
 *
 * 장신구 셋(2026-09-11, "장비 종류도 늘려줘") — 원작의 반지·목걸이·귀걸이
 * 자리다. 옷·무기 자리와 값 크기가 겹치지 않게 **절반가량으로 작게** 잡았다
 * (일곱 자리를 다 채우고 얹는 여벌 자리라, 옷 한 벌만큼 세면 장비 전체가
 * 그만큼 세져 버린다). 반지=공격 중심·목걸이=체력 중심·귀걸이=공격·방어
 * 고르게 — 이렇게 나눠 다는 재미(어디에 힘을 몰아줄지)를 준다.
 */
(function (global) {
  'use strict';

  var SLOTS = [
    { key: 'weapon', name: '무기',       emoji: '🗡️' },
    { key: 'hat',    name: '투구',       emoji: '🪖' },
    { key: 'top',    name: '갑옷',       emoji: '🥋' },
    { key: 'bottom', name: '전군(戰裙)', emoji: '👖' },
    { key: 'shoes',  name: '전화(戰靴)', emoji: '👢' },
    { key: 'glove',  name: '수갑(手甲)', emoji: '🧤' },
    { key: 'cape',   name: '망토',       emoji: '🧣' },
    { key: 'ring',      name: '반지',   emoji: '💍' },
    { key: 'necklace',  name: '목걸이', emoji: '📿' },
    { key: 'earring',   name: '귀걸이', emoji: '💎' }
  ];

  var RAW = [
    /* 무기 — 이 판의 공격력은 인물 능력치에서 나오고, 무기는 그 위에 얹는다 */
    ['sword1', 'weapon', '목검(木劍)',     1,  4, 0,  0,   240, 5],
    ['sword2', 'weapon', '환도(環刀)',     5, 11, 0,  0,  1100, 6],
    ['sword3', 'weapon', '청강검(靑鋼劍)', 12, 22, 0,  0,  4200, 7],
    ['sword4', 'weapon', '용린도(龍鱗刀)', 20, 38, 1,  0, 13000, 7],

    /* 투구 */
    ['hat1', 'hat', '가죽 두건',   1, 0, 2,  6,   180, 5],
    ['hat2', 'hat', '철투구',      5, 0, 5, 14,   820, 5],
    ['hat3', 'hat', '봉시투구',   12, 0, 9, 26,  3100, 6],
    ['hat4', 'hat', '금장 갑주투', 20, 1, 15, 44, 9800, 7],

    /* 갑옷 */
    ['top1', 'top', '무명 저고리', 1, 0, 3,  10,   220, 5],
    ['top2', 'top', '가죽 갑옷',   5, 0, 7,  22,   980, 6],
    ['top3', 'top', '찰갑(札甲)', 12, 0, 12, 40,  3600, 6],
    ['top4', 'top', '두정갑',     20, 1, 19, 66, 11500, 7],

    /* 하의 */
    ['bot1', 'bottom', '무명 바지', 1, 0, 2,  8,   160, 5],
    ['bot2', 'bottom', '가죽 전군', 5, 0, 5, 16,   760, 5],
    ['bot3', 'bottom', '철엽 전군', 12, 0, 9, 30,  2900, 6],
    ['bot4', 'bottom', '용문 전군', 20, 0, 14, 50, 9200, 6],

    /* 신 */
    ['shoe1', 'shoes', '짚신',       1, 0, 1,  4,   120, 5],
    ['shoe2', 'shoes', '가죽 전화',  5, 0, 4, 10,   640, 5],
    ['shoe3', 'shoes', '철갑 전화', 12, 0, 7, 20,  2400, 6],
    ['shoe4', 'shoes', '비룡화',    20, 1, 11, 34, 7600, 6],

    /* 수갑 — 원작의 장갑이 그렇듯 공격이 조금 붙는다 */
    ['glv1', 'glove', '무명 팔찌',  1, 1, 1,  2,   200, 5],
    ['glv2', 'glove', '가죽 수갑',  5, 3, 3,  6,   900, 5],
    ['glv3', 'glove', '철갑 수갑', 12, 6, 5, 12,  3300, 6],
    ['glv4', 'glove', '용조 수갑', 20, 11, 8, 20, 10500, 7],

    /* 망토 */
    ['cap1', 'cape', '베 망토',     1, 0, 1,  8,   150, 5],
    ['cap2', 'cape', '가죽 망토',   5, 0, 3, 18,   700, 5],
    ['cap3', 'cape', '수달피 망토', 12, 1, 6, 32,  2700, 6],
    ['cap4', 'cape', '흑룡 망토',   20, 2, 10, 54, 8900, 7],

    /* 반지 — 장신구, 공격 중심(2026-09-11) */
    ['ring1', 'ring', '무명 지환',   1,  2, 0,  3,   160, 5],
    ['ring2', 'ring', '은지환',      5,  5, 0,  8,   750, 5],
    ['ring3', 'ring', '옥지환',     12,  9, 1, 16,  2800, 6],
    ['ring4', 'ring', '금룡지환',   20, 16, 2, 28,  8800, 7],

    /* 목걸이 — 장신구, 체력 중심(2026-09-11) */
    ['neck1', 'necklace', '나무 목걸이',  1, 0, 1,  6,   150, 5],
    ['neck2', 'necklace', '은 목걸이',    5, 0, 2, 14,   700, 5],
    ['neck3', 'necklace', '옥 목걸이',   12, 0, 4, 26,  2600, 6],
    ['neck4', 'necklace', '금 목걸이',   20, 1, 7, 44,  8200, 7],

    /* 귀걸이 — 장신구, 공격·방어 고르게(2026-09-11) */
    ['ear1', 'earring', '나무 귀걸이',  1, 1, 1,  2,   150, 5],
    ['ear2', 'earring', '은 귀걸이',    5, 2, 2,  6,   700, 5],
    ['ear3', 'earring', '옥 귀걸이',   12, 4, 4, 12,  2600, 6],
    ['ear4', 'earring', '금 귀걸이',   20, 7, 7, 20,  8200, 7]
  ];

  var GEAR = RAW.map(function (r) {
    return { key: r[0], slot: r[1], name: r[2], need: r[3],
             atk: r[4], def: r[5], hp: r[6], price: r[7], up: r[8] };
  });

  /**
   * 주문서 — 원작의 그 물건이다.
   * `for` 는 붙일 수 있는 곳: 'weapon'(무기) · 'armor'(무기가 아닌 나머지).
   * rate 가 낮을수록 붙는 값이 크다 — 10% 주문서가 상징인 이유다.
   * **실패해도 물건은 남는다. 닳는 것은 업횟뿐이다.**
   */
  var SCROLLS = [
    { key: 'atk100', name: '공격력 주문서 100%', for: 'weapon', rate: 1.0,
      atk: 1, price: 900,  desc: '반드시 붙지만 조금 붙는다' },
    { key: 'atk60',  name: '공격력 주문서 60%',  for: 'weapon', rate: 0.6,
      atk: 3, price: 1800, desc: '열에 여섯' },
    { key: 'atk10',  name: '공격력 주문서 10%',  for: 'weapon', rate: 0.1,
      atk: 8, price: 4200, desc: '열에 하나 — 붙으면 크다' },
    { key: 'def100', name: '물리방어 주문서 100%', for: 'armor', rate: 1.0,
      def: 1, price: 500,  desc: '반드시 붙는다' },
    { key: 'def60',  name: '물리방어 주문서 60%',  for: 'armor', rate: 0.6,
      def: 3, price: 1100, desc: '열에 여섯' },
    { key: 'hp60',   name: '체력 주문서 60%',      for: 'armor', rate: 0.6,
      hp: 18, price: 1300, desc: '체력을 올린다' },
    { key: 'hp10',   name: '체력 주문서 10%',      for: 'armor', rate: 0.1,
      hp: 55, price: 3600, desc: '열에 하나 — 붙으면 크다' }
  ];

  function slot(key) {
    for (var i = 0; i < SLOTS.length; i++) { if (SLOTS[i].key === key) { return SLOTS[i]; } }
    return SLOTS[0];
  }

  function find(key) {
    for (var i = 0; i < GEAR.length; i++) { if (GEAR[i].key === key) { return GEAR[i]; } }
    return null;
  }

  function scroll(key) {
    for (var i = 0; i < SCROLLS.length; i++) { if (SCROLLS[i].key === key) { return SCROLLS[i]; } }
    return null;
  }

  /** 그 수준에서 나올 만한 물건들 (드랍·상점이 함께 쓴다) */
  function poolFor(lv) {
    var out = GEAR.filter(function (g) { return g.need <= lv + 3; });
    return out.length ? out : GEAR.filter(function (g) { return g.need === 1; });
  }

  /**
   * 등급(아이템·장비 등급 체계 — 사용자 요청 2026-09-10, 이 판 적용 2026-09-20) — 이 판엔 접사가 없어 등급을 굴리지 않고
   * **표에서 읽는다**: 요구 Lv 단 1·5·12·20 → 기본·상급·희귀·영웅, 이름 있는 고유(`base` 가 있는 물건)는 전설.
   * 이름·색·별은 도감 인물·펫이 쓰는 `data.js` 의 `RARITY` 와 같다(사가만리·사가나락 상품→전설과 같은 결).
   * 값·세이브에는 안 닿는다 — 보이는 이름표뿐이다.
   */
  function grade(d) {
    var r = !d ? 1 : (d.base ? 5 : d.need >= 20 ? 4 : d.need >= 12 ? 3 : d.need >= 5 ? 2 : 1);
    var R = global.DG && global.DG.data && global.DG.data.rarity && global.DG.data.rarity[r];
    return { rank: r, name: R ? R.name : '', color: R ? R.color : '#9aa4b2', label: R ? R.label : '' };
  }

  global.DG = global.DG || {};
  global.DG.gearData = {
    SLOTS: SLOTS, GEAR: GEAR, SCROLLS: SCROLLS,
    slot: slot, find: find, scroll: scroll, poolFor: poolFor, grade: grade
  };
})(window);
