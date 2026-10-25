/**
 * 3마을 낚시 대회 (W-0422 ① · 정본 고돗 G-0373 · 동물의숲 낚시 대회 — 구조만, 이름·수치는 우리 것)
 * ---------------------------------------------------------------
 * 있는 낚시(찌·입질·당기기)에 일요일 목표 하나:
 *   크기   대회 날 낚으면 입질 곧바로 당길수록 큼 — MIN~MAX(15~55cm, 입질 창 안 늦을수록 작아짐) + 운 0~LUCK(15, 그날·몇 번째 해시)
 *   상     그날 큰 셋 합이 TIERS(90·120·150cm)를 넘을 때마다 동·은·금상 금 PRIZE(300·800·2000), 상마다 하루 한 번
 *   세이브 village 상태 s.derby = { day, sizes: [큰 셋], paid: n } (순수 추가 — 다음 일요일엔 새로)
 * 요일은 turnip.dow(0 = 일요일 — 순무 장과 같은 날). village.js hookLine 잡은 줄 끝에서 onCatch(당긴 시각 − 입질, 입질 창).
 * 「오늘」 창은 goals-adapter 가 row() 로 한 줄. 손잡이 fo.derby(1, 0 = 끔 · 2 = 날마다 대회 — 확인용).
 */
(function (global) {
  'use strict';

  var MIN = 15, MAX = 55, LUCK = 15, TIERS = [90, 120, 150], PRIZE = [300, 800, 2000], NAMES = ['🥉 동상', '🥈 은상', '🥇 금상'];

  function core() { return global.DG.core; }
  function mode() { var C = core(); return C && C.tuned ? +C.tuned('fo.derby', 1) : 1; }
  function V() { return global.DG.village; }
  function st() { var v = V(); return v && v.state ? v.state() : null; }
  function dow(day) { var T = global.DG.turnip; return T && T.dow ? T.dow(day) : (((day + 4) % 7) + 7) % 7; }
  function isDay(day) { var m = mode(); return m === 2 || (m === 1 && dow(day) === 0); }
  function h01(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }
  /** 크기(순수) — react 당긴 시각 − 입질(ms), win 입질 창(ms), luck01 0~1 */
  function sizeOf(react, win, luck01) {
    var f = win > 0 ? Math.max(0, Math.min(1, react / win)) : 1;
    return Math.round(MAX - (MAX - MIN) * f + LUCK * (luck01 || 0));
  }
  function today(s) { return s && s.day != null ? s.day : 0; }
  function dstate(s) { var d = today(s); if (!s.derby || s.derby.day !== d) { s.derby = { day: d, sizes: [], paid: 0, n: 0 }; } return s.derby; }
  function sum3(sizes) { return sizes.slice(0, 3).reduce(function (a, b) { return a + b; }, 0); }

  /** 낚았다 — 대회 날이면 {size, total, prize:[이번에 받은 상 이름]}, 아니면 null */
  function onCatch(react, win) {
    var s = st(); if (!s || !isDay(today(s))) { return null; }
    var d = dstate(s); d.n += 1;
    var size = sizeOf(react, win, h01('derby:' + d.day + ':' + d.n));
    d.sizes.push(size); d.sizes.sort(function (a, b) { return b - a; }); d.sizes.length = Math.min(3, d.sizes.length);
    var total = sum3(d.sizes), got = [], C = core();
    while (d.paid < TIERS.length && total >= TIERS[d.paid]) {
      if (C && C.save && C.save.player) { C.save.player.gold = (C.save.player.gold || 0) + PRIZE[d.paid]; }
      got.push(NAMES[d.paid] + ' 금 ' + PRIZE[d.paid]); d.paid += 1;
    }
    if (got.length && C && C.emit) { C.emit('toast', '🎣 낚시 대회 ' + got.join(' · ') + ' (큰 셋 ' + total + 'cm)'); }
    return { size: size, total: total, prize: got };
  }
  /** 「오늘」 창 한 줄 — 대회 날만 */
  function row() {
    var s = st(); if (!s || !isDay(today(s))) { return null; }
    var d = dstate(s), next = d.paid < TIERS.length ? TIERS[d.paid] : TIERS[TIERS.length - 1];
    return { label: '낚시 대회 ' + (d.paid ? NAMES[d.paid - 1].slice(3) + ' · ' : '') + '큰 셋 ' + sum3(d.sizes) + 'cm', icon: '🎣', cur: Math.min(next, sum3(d.sizes)), max: next, done: d.paid >= TIERS.length };
  }

  global.DG = global.DG || {};
  global.DG.fishDerby = { MIN: MIN, MAX: MAX, LUCK: LUCK, TIERS: TIERS, PRIZE: PRIZE, isDay: isDay, sizeOf: sizeOf, onCatch: onCatch, row: row };
})(window);
