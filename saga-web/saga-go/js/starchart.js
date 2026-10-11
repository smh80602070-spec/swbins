/**
 * 만리 성도(星圖) — PoE식 패시브 그물, 주인공(계정) 하나가 찍고 부대 전체에 걸린다 (W-0181)
 * ===============================================================
 * 동료는 수백이라 인물마다 두지 않는다 — 인물 몫은 특성 카드(perk)·재능(talent)이고, 성도는 **그 위 곱셈 하나**다.
 * 그물 정의는 js/data-passive.js(생성물 — tools/passive-web/gen.mjs saga-go), 찍기 규칙은 공용 passive-web.js,
 * 화면은 passive-web-ui.js(둘 다 shared 정본, sync-shared).
 *
 *   save.passive = { start, taken:[마디 id…] }      계정에 한 장
 *
 * 점수 = 첫 별 1 + 불 올린 봉수대 수 + ⌊깬 사당 자리/2⌋ + ⌊도감 종/10⌋ (상한 go.pw.cap 56 = 마디 377 의 약 15%).
 * 첫 점은 시작하자마자 있다 — 첫 10분 안내(tutorial.js) 마지막 줄이 "성도에 1점 찍기".
 *
 * 걸린 자리(판 파일은 묻기만 한다 — `global.DG.starchart ? … : 1`):
 *   이동 world.js moveSpeed · 조우 수 world.js maxSpawns · 들판 공격·체력 field-combat memberOf · 받는 피해 hurt ·
 *   동행 수 create · 등용 설득 encounter doAppeal · 토벌 공격·방어·시간 fort.js · 영초·단사 growth.js ·
 *   천거장 걸음 letter.js · 인연 배율 bond.js · 탈것 mount.js · 포획·경험·귀한 조우·기 = core.effect(bonus)
 * 손잡이 go.pw.*(cap·dropGold·onepath·barefootMove·barefootEgg·nightUp·dayDown·blitzSec·blitzAtk·unboundHerb·unboundExp·
 *   ironTake·ironMove·bignetSpawn·bignetRecruit·windFly·windGround).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var cache = null;

  function PW() { return global.DG.passiveWeb; }
  function def() { return global.DG.passiveDef; }
  function T(k, d) { return core.tuned ? core.tuned('go.pw.' + k, d) : d; }

  function store() {
    var s = core.save;
    if (!s.passive) { s.passive = { start: null, taken: [] }; }
    return s.passive;
  }
  function count(o, fn) { var n = 0, k; for (k in (o || {})) { if (Object.prototype.hasOwnProperty.call(o, k) && (!fn || fn(o[k]))) { n++; } } return n; }
  /** 점수 — 첫 별 + 봉수대 + 사당 + 도감 */
  function parts() {
    var s = core.save, dex = s.dex || {};
    return {
      base: 1,
      beacon: count(s.beacons, function (v) { return !!v; }),
      shrine: Math.floor(count(s.shrines, function (v) { return v && v.clears > 0; }) / 2),
      dex: Math.floor((count(dex.heroes) + count(dex.pets)) / 10),
    };
  }
  function pointsTotal() { var p = parts(); return Math.min(T('cap', 56), p.base + p.beacon + p.shrine + p.dex); }

  function api() {
    if (!def() || !PW()) { return null; }
    var st = store();
    if (!cache || cache.store !== st || cache.def !== def()) {
      cache = { store: st, def: def(), api: PW().make(def(), st, { points: pointsTotal }) };
    }
    return cache.api;
  }
  function sum(key) { var a = api(); return a ? a.sum(key) : 0; }
  function has(rule) { var a = api(); return a ? a.has(rule) : false; }
  function pct(key) { return 1 + sum(key) / 100; }

  /* ── 판이 묻는 배율 ── */
  function move() { return pct('movePct') * (has('barefoot') ? T('barefootMove', 1.25) : 1) * (has('ironwall') ? T('ironMove', 0.85) : 1); }
  function spawn() { return has('bignet') ? T('bignetSpawn', 2) : 1; }
  function fieldAtk() { return pct('atkPct') * (has('onepath') ? T('onepath', 1.6) : 1); }
  function fieldHp() { return pct('hpPct') * (has('onepath') ? T('onepath', 1.6) : 1); }
  function partyMax(n) { return has('onepath') ? 1 : n; }
  function take() { return has('ironwall') ? T('ironTake', 0.7) : 1; }
  function isNight(at) { var h = new Date(at || Date.now()).getHours(); return h >= 21 || h < 4; }
  function recruit(at) {
    var m = pct('recruitPct');
    if (has('nightowl')) { m *= isNight(at) ? T('nightUp', 1.4) : T('dayDown', 0.8); }
    if (has('bignet')) { m *= T('bignetRecruit', 0.75); }
    return m;
  }
  function raidSec(base) { return has('blitz') ? T('blitzSec', 45) : base; }
  function raidAtk() { return pct('atkPct') * (has('blitz') ? T('blitzAtk', 1.35) : 1); }
  function raidDef() { return pct('hpPct'); }
  function herb() { return pct('herbPct') * (has('unbound') ? T('unboundHerb', 0.5) : 1); }
  function egg() { return Math.max(0.4, 1 - sum('eggPct') / 100) * (has('barefoot') ? T('barefootEgg', 0.7) : 1); }
  function bond() { return pct('bondPct'); }
  /** 탈것 — 맨발이면 못 탄다('' 면 탄다) */
  function rideBlock() { return has('barefoot') ? '맨발(성도 규칙) — 탈것을 타지 않는다' : ''; }
  function mountMul(flying) { return has('windroad') ? (flying ? T('windFly', 1.3) : T('windGround', 0.7)) : 1; }
  /** core.effect 원천 — 포획·경험·귀한 조우·기 */
  function bonus() {
    var o = {}, c = sum('catchPct'), e = sum('expPct') + (has('unbound') ? T('unboundExp', 50) : 0), r = sum('spawnRarePct'), k = sum('kiPct');
    if (c) { o.catchPct = c; } if (e) { o.expPct = e; } if (r) { o.spawnRarePct = r; } if (k) { o.kiPct = k; }
    return o;
  }

  /* ── 되돌리기 — 한 마디 금화(손잡이), 전부는 찍은 수만큼 ── */
  function dropCost(n) { return Math.round(T('dropGold', 120) * (n || 1)); }
  var pendingReset = 0;
  function guard(action) {
    if (action === 'drop' || action === 'reset') {
      var cost = dropCost(action === 'reset' ? api().used() : 1);
      if ((core.save.player.gold || 0) < cost) { return '금이 모자란다 (' + cost + '금)'; }
      if (action === 'reset') { pendingReset = cost; }
    }
    return '';
  }
  function after(action) {
    if (action === 'drop') { core.save.player.gold -= dropCost(1); }
    if (action === 'reset') { core.save.player.gold -= pendingReset; pendingReset = 0; }
    if (action === 'take' || action === 'start') { core.emit('star:take', { used: api().used() }); }
    if (core.persist) { core.persist(); }
    core.emit('changed');
  }

  var FMT = {
    movePct: ['이동', '%'], atkPct: ['토벌·들판 공격', '%'], hpPct: ['부대 체력', '%'], recruitPct: ['등용 설득', '%'],
    catchPct: ['포획', '%p'], expPct: ['경험', '%'], spawnRarePct: ['귀한 조우', '%'], herbPct: ['영초·단사', '%'],
    eggPct: ['천거장 걸음 줄임', '%'], bondPct: ['인연 몫', '%'], kiPct: ['기', '%'],
  };
  function fmt(stats) {
    return Object.keys(stats || {}).map(function (k) { var f = FMT[k] || [k, ''], v = stats[k]; return f[0] + ' ' + (v > 0 ? '+' : '') + v + f[1]; }).join(' · ');
  }

  function open() {
    var UI = global.DG.passiveWebUI, a = api();
    if (!UI || !a) { return null; }
    return UI.open(a, def(), {
      title: '✨ 만리 성도',   // 점수 내역(첫 별·봉수대·사당·도감)은 parts() — 좁은 폭에서 제목이 잘리지 않게 짧게
      fmt: fmt, guard: function (action) { return guard(action); }, after: function (action) { after(action); },
      onClose: function () { core.emit('changed'); },
    });
  }

  /** 주 메뉴(독) 「성도」 단추 — index.html #btn-star */
  function wire() {
    var b = global.document && global.document.getElementById('btn-star');
    if (b && !b._sc) { b._sc = 1; b.addEventListener('click', function () { open(); }); }
  }
  if (global.document) { if (global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', wire); } else { wire(); } }

  global.DG = global.DG || {};
  global.DG.starchart = {
    store: store, api: api, sum: sum, has: has, parts: parts, pointsTotal: pointsTotal,
    move: move, spawn: spawn, fieldAtk: fieldAtk, fieldHp: fieldHp, partyMax: partyMax, take: take, recruit: recruit, isNight: isNight,
    raidSec: raidSec, raidAtk: raidAtk, raidDef: raidDef, herb: herb, egg: egg, bond: bond, rideBlock: rideBlock, mountMul: mountMul,
    bonus: bonus, dropCost: dropCost, guard: guard, fmt: fmt, open: open, wire: wire, T: T,
    _reset: function () { cache = null; },
  };
})(window);
