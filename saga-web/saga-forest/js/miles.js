/**
 * 3마을 마을 마일 (W-0476 · 정본 고돗 G-0409 · 동물의숲 너굴 마일리지 — 구조만, 이름·수치는 우리 것)
 * ---------------------------------------------------------------
 * 「오늘」 창 줄을 다 하면 줄마다 +PER 마일. 줄마다 하루 한 번(got), 날이 바뀌면 got 만 비우고 pts 는 남는다.
 * 모아 받기 — 「오늘」 창 받기 칸(claim 하나)이 다 된 줄을 한꺼번에 받는다. 마일은 마을 시트 「마일 교환」에서 쓴다.
 *   세이브 village 상태 s.miles = { pts, day, got:[줄 label…] } (순수 추가 — 옛 세이브는 빈 것)
 * 손잡이 fo.miles(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var PER = 100;
  var SHOP = [
    { key: 'apple', n: 5, cost: 150 }, { key: 'iron', n: 3, cost: 200 },
    { key: 'geumnang', n: 1, cost: 400 }, { key: 'stardust', n: 1, cost: 600 }
  ];

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && +C.tuned('fo.miles', 1) === 0); }
  function V() { return global.DG.village; }
  function st() { var v = V(); return v && v.state ? v.state() : null; }
  function ms(s) {
    if (!s) { return null; }
    if (!s.miles) { s.miles = { pts: 0, day: s.day, got: [] }; }
    if (s.miles.day !== s.day) { s.miles.day = s.day; s.miles.got = []; }
    return s.miles;
  }
  function pts() { var m = ms(st()); return m ? m.pts : 0; }
  function todayRows() { var A = global.DG.goalsAdapter, m = A && A.model ? A.model() : null; return m && m.today ? m.today : []; }
  /** 받을 줄(순수) — 다 됐고 오늘 아직 안 받은 label 들 */
  function pending(rows, got) { return (rows || []).filter(function (r) { return r.done && got.indexOf(r.label) < 0; }).map(function (r) { return r.label; }); }
  function claimable(rows) { var m = on() ? ms(st()) : null; return m ? pending(rows, m.got) : []; }
  /** 받기 — 이번에 받은 마일 */
  function earn(rows) {
    var m = on() ? ms(st()) : null; if (!m) { return 0; }
    var L = pending(rows || todayRows(), m.got); if (!L.length) { return 0; }
    L.forEach(function (x) { m.got.push(x); });
    m.pts += L.length * PER;
    var C = core(); if (C && C.emit) { C.emit('toast', '🎟️ 마을 마일 +' + (L.length * PER) + ' (모은 ' + m.pts + ')'); }
    return L.length * PER;
  }
  /** 「오늘」 창 받기 칸 — 줄이 없으면 null */
  function claimModel(rows) {
    if (!on() || !st()) { return null; }
    var m = ms(st()), n = pending(rows, m.got).length, all = (rows || []).length;
    if (!all) { return null; }
    return { label: '마을 마일', state: n ? 'ready' : (m.got.length ? 'paid' : 'wait'), hint: n ? '받을 줄 ' + n + '개 · 모은 ' + m.pts + ' 마일' : '모은 ' + m.pts + ' 마일 — 마을 시트에서 교환', take: function () { earn(rows); } };
  }
  function itemOf(key) {
    var I = global.DG.villageData ? global.DG.villageData.ITEMS : (global.VD && global.VD.ITEMS), c, i;
    if (!I) { return null; }
    for (c in I) { if (Object.prototype.hasOwnProperty.call(I, c)) { for (i = 0; i < I[c].length; i++) { if (I[c][i].key === key) { return I[c][i]; } } } }
    return null;
  }
  /** 교환 — {ok, text} */
  function buy(key) {
    var m = on() ? ms(st()) : null, e = SHOP.filter(function (x) { return x.key === key; })[0], it = e && itemOf(key);
    if (!m || !e || !it) { return { ok: false, text: '바꿀 수 없습니다' }; }
    if (m.pts < e.cost) { return { ok: false, text: '마일이 모자랍니다 (' + e.cost + ' 필요)' }; }
    m.pts -= e.cost; V().bagAdd(it, e.n);
    return { ok: true, text: '🎟️ ' + it.emoji + ' ' + it.name + ' ×' + e.n + ' 로 바꿨습니다 (남은 ' + m.pts + ')' };
  }

  global.DG = global.DG || {};
  global.DG.miles = { PER: PER, SHOP: SHOP, on: on, pts: pts, pending: pending, claimable: claimable, earn: earn, claimModel: claimModel, buy: buy, itemOf: itemOf };
})(window);
