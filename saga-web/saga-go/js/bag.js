/**
 * 행낭(行囊) — 원작의 가방
 * ---------------------------------------------------------------
 * 원작에서 가방은 볼과 열매, 그리고 **한동안 효과가 이어지는 물건**(향로·행운의 알)을
 * 담는 자리다. 이 판에는 등용서·사료가 지갑에 숫자로만 떠 있었고 쓸 물건이 없었다.
 *
 *   포획구   → 등용서(📜)   나무열매   → 사료(🍖) · 별미(🍯)
 *   향로       → 향(🕯️)       행운의 알  → 축문(🎊)
 *   가방 상한  → 그대로 상한이 있다 (넘치면 역참이 안 준다)
 *
 * **장비(무기·갑주)는 되살리지 않는다.** 그건 이 판에 있었다가 다섯 게임으로 가를 때
 * 던전(saga-dungeon)으로 보낸 축이고, 원작에 없는 축이다.
 * 여기 담는 것은 전부 **쓰면 없어지는 소모품**이다.
 *
 * 효과는 새 통로를 만들지 않는다 — `core.effect()` 가 이미 읽는 키
 * (`catchPct`·`expPct`·`spawnRarePct`)로 낸다. 그래서 조우·포획·경험치 코드는 그대로다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /** 가방 상한 — 원작처럼 무한정 쌓이지 않는다 */
  var CAP = 250;

  /**
   * 담기는 것.
   *   use  가 있으면 쓸 수 있는 물건(소모품), 없으면 조우에서 쓰이는 밑천
   *   sec  효과가 이어지는 시간
   */
  var ITEMS = [
    { key: 'scroll', name: '등용서', emoji: '📜', kind: 'base',
      desc: '인물을 등용할 때 한 장씩 든다.' },
    { key: 'feed', name: '사료', emoji: '🍖', kind: 'base',
      desc: '짐승을 포획할 때 한 줌씩 든다.' },
    /* 사당 시련(shrine.js) 보상 — 조각 셋이 자동으로 인장 하나가 된다. 쓸 곳은 뒤 후보(승급 3택) 몫 */
    { key: 'shard', name: '인장 조각', emoji: '🔖', kind: 'base',
      desc: '사당 시련의 증표. 셋이 모이면 인장이 된다.' },
    { key: 'seal', name: '사당 인장', emoji: '🏵️', kind: 'base',
      desc: '사당 인장 조각 셋을 합친 증표.' },
    { key: 'treat', name: '별미', emoji: '🍯', kind: 'use', sec: 120,
      eff: { catchPct: 25 },
      desc: '2분간 포획이 눈에 띄게 쉬워진다.' },
    { key: 'incense', name: '향(香)', emoji: '🕯️', kind: 'use', sec: 900,
      eff: { spawnRarePct: 12 }, lure: true,
      desc: '15분간 근처에 더 많이, 더 귀한 것이 나타난다.' },
    { key: 'prayer', name: '축문', emoji: '🎊', kind: 'use', sec: 1800,
      eff: { expPct: 100 },
      desc: '30분간 얻는 경험치가 두 배가 된다.' }
  ];

  function def(key) {
    for (var i = 0; i < ITEMS.length; i++) { if (ITEMS[i].key === key) { return ITEMS[i]; } }
    return null;
  }

  /** 세이브 칸이 없던 옛 세이브도 여기서 채운다 */
  function items() {
    if (!core.save.items) { core.save.items = {}; }
    for (var i = 0; i < ITEMS.length; i++) {
      var k = ITEMS[i].key;
      if (typeof core.save.items[k] !== 'number') { core.save.items[k] = 0; }
    }
    if (!core.save.boosts) { core.save.boosts = {}; }
    return core.save.items;
  }

  function boosts() { items(); return core.save.boosts; }

  function count(key) { return items()[key] || 0; }

  /** 지금 가방에 든 것의 총 수 */
  function total() {
    var it = items(), n = 0;
    for (var i = 0; i < ITEMS.length; i++) { n += it[ITEMS[i].key] || 0; }
    return n;
  }

  function capNow() { return CAP + (global.DG.fieldRiddle ? global.DG.fieldRiddle.bagAdd() : 0); }   // W-0426 들판 씨앗 — 상한 +10씩
  function room() { return Math.max(0, capNow() - total()); }
  function full() { return room() <= 0; }

  /**
   * 넣는다. 상한을 넘는 몫은 들어가지 않는다(원작과 같다).
   * @returns {number} 실제로 들어간 수
   */
  function add(key, n) {
    if (!def(key)) { return 0; }
    var give = Math.max(0, Math.min(n || 1, room()));
    if (!give) { return 0; }
    items()[key] += give;
    return give;
  }

  function take(key, n) {
    var have = count(key);
    var use = Math.min(n || 1, have);
    if (!use) { return 0; }
    items()[key] -= use;
    return use;
  }

  /* ── 쓰는 물건 ────────────────────────────────────────── */

  /** 지금 걸려 있는 효과 (없으면 null) */
  function boostOf(key) {
    var b = boosts()[key];
    if (!b || b <= Date.now()) { return null; }
    return { key: key, def: def(key), until: b, leftMs: b - Date.now() };
  }

  /** 걸려 있는 것 전부 */
  function activeBoosts() {
    var out = [];
    for (var i = 0; i < ITEMS.length; i++) {
      var b = boostOf(ITEMS[i].key);
      if (b) { out.push(b); }
    }
    return out;
  }

  /**
   * 쓴다. 이미 걸려 있으면 **남은 시간에 이어 붙인다**(원작 향로처럼 겹쳐 쓰지 않게).
   * @returns {{ok:boolean, reason?:string, leftMs?:number}}
   */
  function use(key) {
    var d = def(key);
    if (!d || d.kind !== 'use') { return { ok: false, reason: 'nouse' }; }
    if (count(key) < 1) { return { ok: false, reason: 'none' }; }
    take(key, 1);
    var b = boosts();
    var from = (b[key] && b[key] > Date.now()) ? b[key] : Date.now();
    b[key] = from + d.sec * 1000;
    core.log(d.emoji + ' ' + d.name + ' 을(를) 썼다 — ' + Math.round(d.sec / 60) + '분', 'good');
    core.emit('toast', d.emoji + ' ' + d.name + ' · ' + d.desc);
    core.emit('changed');
    core.persist();
    return { ok: true, leftMs: b[key] - Date.now() };
  }

  /** 걸린 효과의 합 — core.effect() 가 읽어 간다 */
  function bonus() {
    var out = {};
    for (var i = 0; i < ITEMS.length; i++) {
      var d = ITEMS[i];
      if (!d.eff || !boostOf(d.key)) { continue; }
      for (var k in d.eff) {
        if (Object.prototype.hasOwnProperty.call(d.eff, k)) {
          out[k] = (out[k] || 0) + d.eff[k];
        }
      }
    }
    return out;
  }

  /** 향을 피워 두었나 — world 가 스폰을 늘릴 때 본다 */
  function lured() { return !!boostOf('incense'); }

  /** 남은 시간을 "12분 30초" 로 */
  function leftLabel(ms) {
    var s = Math.ceil(ms / 1000);
    var m = Math.floor(s / 60);
    return m > 0 ? (m + '분 ' + (s % 60) + '초') : (s + '초');
  }

  /** 화면이 뿌릴 목록 */
  function list() {
    var out = [];
    for (var i = 0; i < ITEMS.length; i++) {
      var d = ITEMS[i];
      out.push({
        def: d, key: d.key, n: count(d.key),
        boost: boostOf(d.key)
      });
    }
    return out;
  }

  global.DG = global.DG || {};
  global.DG.bag = {
    ITEMS: ITEMS, CAP: CAP, capNow: capNow,
    def: def, count: count, total: total, room: room, full: full,
    add: add, take: take, use: use,
    boostOf: boostOf, activeBoosts: activeBoosts, bonus: bonus, lured: lured,
    leftLabel: leftLabel, list: list
  };
})(window);
