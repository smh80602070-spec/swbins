/**
 * 천하 경륜도(經綸圖) — PoE식 패시브 그물, 세력마다 한 장 · AI 세력도 같은 규칙으로 찍는다 (W-0182)
 * ===============================================================
 * 그물 정의는 js/data-passive.js(생성물 — tools/passive-web/gen.mjs saga-realm), 찍기 규칙은 공용 passive-web.js,
 * 화면은 passive-web-ui.js(둘 다 shared 정본, sync-shared).
 *
 *   save.rtk.forces[세력].passive = { start, taken:[마디 id…], won:{ 성 id: 1 } }   세력 기록에 한 칸
 *
 * 점수 = 1 + 처음 빼앗은 성 수(won — 시작 때 가진 성은 안 센다) + 깬 이정표 단(내 세력만) — 상한 rk.pw.cap 56(마디 377 의 약 15%).
 * AI 는 달마다(rtk-ai runAll) 쌓인 점수를 성향(creed)대로 찍는다 — 시작점은 성향으로, 길은 그 테마의 가장 가까운 이름난 마디로,
 * 찍은 수가 rk.pw.aiKeyAt 을 넘으면 성향 규칙 하나를 노린다.
 *
 * 두 모드가 같은 값을 읽는다: 턴제 경영(index.html — rtk·war·diplo·officer)과 전장(rts.html — rts/econ·rts/units,
 * DG.rtk 없이 save.rtk 를 바로 읽는다). 판 파일은 묻기만 한다(`global.DG.statecraft ? … : 1`).
 *
 * 걸린 자리: rtk goldOf·foodOf·eatOf·order(내정·징병·축성) · war stepRound(공격·수비·성벽 깎기·불 전술)·진 사기(청야) ·
 *   rtk tryHire(등용) · diplo envoyChance(외교)·plotChance·화계 · officer stats(일인지하)·gainExp · rts econ.stats·units.statOf
 * 손잡이 rk.pw.*(cap·dropGold·aiKeyAt·tunjeonEat·tunjeonDraft·cheolgiField·cheolgiSiege·wongyoFar·wongyoNear·ilinTop·ilinRest·
 *   siegeWall·siegeField·muwiFood·muwiGov·fire·cheongyaCamp·cheongyaProd).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var cache = {};

  function PW() { return global.DG.passiveWeb; }
  function def() { return global.DG.passiveDef; }
  function T(k, d) { return core.tuned ? core.tuned('rk.pw.' + k, d) : d; }
  function st() { return core.save && core.save.rtk; }
  function me() { var s = st(); return s ? s.me : null; }

  function store(fid) {
    var s = st(), f = s && s.forces && s.forces[fid];
    if (!f) { return null; }
    if (!f.passive) { f.passive = { start: null, taken: [], won: {} }; }
    if (!f.passive.won) { f.passive.won = {}; }
    return f.passive;
  }
  function count(o) { var n = 0, k; for (k in (o || {})) { if (Object.prototype.hasOwnProperty.call(o, k)) { n++; } } return n; }

  /** 점수 내역 — 기본 1 · 빼앗은 성 · 이정표(내 세력만) */
  function parts(fid) {
    var s = st(), p = store(fid);
    return { base: 1, won: p ? count(p.won) : 0, milestone: s && fid === s.me && s.milestone ? (s.milestone.idx || 0) : 0 };
  }
  function pointsTotal(fid) { var p = parts(fid); return Math.min(T('cap', 56), p.base + p.won + p.milestone); }

  function api(fid) {
    fid = fid || me();
    var p = fid && def() && PW() ? store(fid) : null;
    if (!p) { return null; }
    var c = cache[fid];
    if (!c || c.store !== p || c.def !== def()) {
      c = cache[fid] = { store: p, def: def(), rules: null, sums: null, top: null };
      c.api = PW().make(def(), p, { points: function () { return pointsTotal(fid); } });
      c.api.onChange(function () { c.rules = null; c.sums = null; c.top = null; });
    }
    return c.api;
  }
  /** 규칙·합 — 세력마다 바뀔 때만 다시 센다(off.stats 처럼 자주 불리는 자리가 묻는다) */
  function sums(fid) {
    var a = fid ? api(fid) : null, c = a && cache[fid];
    if (!c) { return null; }
    if (!c.sums) {
      c.sums = {}; c.rules = {};
      c.store.taken.forEach(function (id) {
        var n = a.node(id), k;
        if (!n) { return; }
        if (n.rule) { c.rules[n.rule] = 1; }
        for (k in (n.stats || {})) { if (typeof n.stats[k] === 'number') { c.sums[k] = (c.sums[k] || 0) + n.stats[k]; } }
      });
    }
    return c;
  }
  function sum(fid, key) { var c = sums(fid); return (c ? (c.sums[key] || 0) : 0) + (global.DG.wonder ? global.DG.wonder.pct(fid, key) : 0) + (global.DG.tech ? global.DG.tech.pct(fid, key) : 0); }   // W-0279 불가사의 효과도 같은 배율로 · W-0290 기술 나무도
  function has(fid, rule) { var c = sums(fid); return !!(c && c.rules[rule]); }
  function pct(fid, key) { return 1 + sum(fid, key) / 100; }

  /* ── 턴제 경영(rtk·war·diplo·officer)이 묻는 배율 ── */
  function gold(fid) { return has(fid, 'muwi') ? 0 : pct(fid, 'goldPct') * (has(fid, 'cheongya') ? T('cheongyaProd', 0.8) : 1); }
  function food(fid) { return pct(fid, 'foodPct') * (has(fid, 'muwi') ? T('muwiFood', 2) : 1) * (has(fid, 'cheongya') ? T('cheongyaProd', 0.8) : 1); }
  function eat(fid) { return has(fid, 'tunjeon') ? T('tunjeonEat', 0.5) : 1; }
  /** 명령 성과 — 개간·상업·기술·치안은 내정, 징병·축성은 제 키 */
  function order(fid, key) {
    if (key === 'draft') { return pct(fid, 'troopPct') * (has(fid, 'tunjeon') ? T('tunjeonDraft', 0.7) : 1); }
    if (key === 'wall') { return pct(fid, 'wallPct'); }
    if (key === 'agri' || key === 'comm') { return pct(fid, 'govPct') * (has(fid, 'muwi') ? T('muwiGov', 2) : 1); }
    if (key === 'tech' || key === 'sec') { return pct(fid, 'govPct'); }
    return 1;
  }
  /** 싸움 한 합의 힘 — army.side atk/def, 야전(sortie)·수전(water)·공성 */
  function war(army, sortie, water) {
    var fid = army && army.force;
    if (!fid) { return 1; }
    var m = army.side === 'def' ? pct(fid, 'defPct') : pct(fid, 'atkPct');
    var field = sortie && !water, siege = !sortie && !water && army.side !== 'def';
    if (has(fid, 'cheolgi')) { m *= field ? T('cheolgiField', 1.4) : ((water || siege) ? T('cheolgiSiege', 0.8) : 1); }
    if (has(fid, 'gongseong') && (field || water)) { m *= T('siegeField', 0.85); }
    return m;
  }
  function wallDmg(fid) { return has(fid, 'gongseong') ? T('siegeWall', 2) : 1; }
  /** 비 오는 달 — 6·7월 장마 또는 그 성 수해 */
  function rainy(cityId) {
    var s = st(), c = s && s.cities && s.cities[cityId];
    return !!s && (s.month === 6 || s.month === 7 || !!(c && c.disaster === 'flood'));
  }
  /** 불(화계·불 전술) 배율 — 화공 규칙이면 두 배, 비 오는 달엔 0 */
  function fire(fid, cityId) { return !has(fid, 'hwagong') ? 1 : (rainy(cityId) ? 0 : T('fire', 2)); }
  /** 진 사기 감쇠 — 진을 친 성의 주인이 청야면 두 배로 깎인다 */
  function campDecay(decay, ownerFid) { return has(ownerFid, 'cheongya') ? 1 - (1 - decay) * T('cheongyaCamp', 2) : decay; }
  function hire(fid) { return pct(fid, 'hirePct'); }
  function diplo(fid, near) { return pct(fid, 'diploPct') * (has(fid, 'wongyo') ? (near ? T('wongyoNear', 0.6) : T('wongyoFar', 1.5)) : 1); }
  function plot(fid) { return pct(fid, 'plotPct'); }
  function exp(fid) { return pct(fid, 'expPct'); }

  /** 일인지하 — 군주 다음 으뜸(바탕 능력 합) 하나 ×1.5, 나머지 ×0.9. 군주는 안 건드린다 */
  function offMul(id) {
    var s = st(), r = s && s.officers && s.officers[id], fid = r && r.force;
    if (!fid || !has(fid, 'ilin')) { return 1; }
    var c = cache[fid], off = global.DG.off, H = global.DG.hero;
    if (!c.top || c.top.turn !== s.turn) {
      /* off.ofForce 는 능력순 정렬이라 off.stats → 여기로 되돌아온다 — 기록을 바로 훑고, 바탕 능력(hero.stats)만 본다 */
      var lord = off.lordOf ? off.lordOf(fid) : null, best = null, bv = -1, k, b, v;
      c.top = { turn: s.turn, id: null };
      for (k in s.officers) {
        if (!Object.prototype.hasOwnProperty.call(s.officers, k) || s.officers[k].force !== fid || s.officers[k].dead || k === lord) { continue; }
        b = H.stats(k); v = b ? b.might + b.wisdom + b.command : -1;
        if (v > bv) { bv = v; best = k; }
      }
      c.top.id = best;
    }
    return id === c.top.id ? T('ilinTop', 1.5) : T('ilinRest', 0.9);
  }

  /** 성 첫 점령 — war.capture 가 부른다. 시작 때 가진 성은 안 센다 */
  function won(fid, cityId) {
    var p = fid ? store(fid) : null;
    if (!p || p.won[cityId]) { return false; }
    p.won[cityId] = 1;
    return true;
  }

  /* ── 전장(rts.html) — 내 세력(save.rtk.me) 하나 ── */
  function rtsEcon() {
    var f = me();
    return { food: food(f), gold: pct(f, 'goldPct') * (has(f, 'cheongya') ? T('cheongyaProd', 0.8) : 1), tax: has(f, 'muwi') ? 0 : 1, happy: has(f, 'muwi') ? 15 : 0, grow: has(f, 'muwi') ? 2 : 1 };
  }
  var statCache = {};
  /** 내 유닛 능력 — 공격 % · 철기(기병 +40%·보병 −20%). 바뀌지 않으면 같은 객체 */
  function rtsStat(base, t) {
    var f = me(), m = pct(f, 'atkPct');
    if (has(f, 'cheolgi')) { m *= t === 'cavalry' ? T('cheolgiField', 1.4) : (t === 'soldier' ? T('cheolgiSiege', 0.8) : 1); }
    if (m === 1) { return base; }
    var k = t + ':' + m, c = statCache[k];
    if (!c || c.base !== base) {
      var o = {}, j; for (j in base) { if (Object.prototype.hasOwnProperty.call(base, j)) { o[j] = base[j]; } }
      o.atk = Math.round(base.atk * m * 10) / 10;
      c = statCache[k] = { base: base, out: o };
    }
    return c.out;
  }

  /* ── AI — 성향대로 시작점, 테마 이름난 마디 가까운 것부터, 넉넉해지면 규칙 하나 ── */
  /** 시작점 테마(어휘 realm.vocab.mjs 와 같은 표 — 생성 정의엔 테마가 없다) */
  var THEME = { mokmin: ['goldPct', 'foodPct', 'govPct'], general: ['atkPct', 'defPct', 'troopPct'], diplomat: ['diploPct', 'plotPct', 'goldPct'],
    talent: ['hirePct', 'expPct', 'govPct'], schemer: ['plotPct', 'atkPct', 'expPct'], builder: ['wallPct', 'defPct', 'troopPct'] };
  var CREED_START = { aggressive: ['general', 'schemer'], balanced: ['mokmin', 'talent'], turtle: ['builder', 'diplomat'] };
  var CREED_KEY = { aggressive: ['k_gongseong', 'k_cheolgi'], balanced: ['k_tunjeon', 'k_ilin'], turtle: ['k_cheongya', 'k_wongyo'] };
  function hashOf(sx) { var h = 0, i; for (i = 0; i < sx.length; i++) { h = (h * 31 + sx.charCodeAt(i)) | 0; } return Math.abs(h); }
  function creedOf(fid) { var FD = global.DG.forceData, f = FD && FD.force ? FD.force(fid) : null; return (f && f.creed) || 'balanced'; }
  function aiStart(fid) { var l = CREED_START[creedOf(fid)] || CREED_START.balanced; return l[hashOf(fid) % l.length]; }
  /** 쌓인 점수를 다 찍는다 — 찍은 마디 수를 돌려준다 */
  function aiSpend(fid) {
    var a = api(fid), n = 0, guard = 0;
    if (!a || a.left() <= 0) { return 0; }
    if (!a.start()) { a.setStart(aiStart(fid)); }
    var theme = THEME[a.start()] || [];
    while (a.left() > 0 && guard++ < 80) {
      var target = null;
      if (a.used() >= T('aiKeyAt', 20) && !def().nodes.some(function (x) { return x.k === 'k' && a.isTaken(x.id); })) {
        var ks = CREED_KEY[creedOf(fid)] || CREED_KEY.balanced, kid = ks[hashOf(fid) % ks.length], kp = a.pathTo(kid);
        if (kp && kp.cost <= a.left()) { target = kp; }
      }
      if (!target) {
        var best = null, bestT = null;
        def().nodes.forEach(function (x) {
          if (x.k !== 'n' || a.isTaken(x.id)) { return; }
          var p = a.pathTo(x.id);
          if (!p) { return; }
          var themed = Object.keys(x.stats || {}).some(function (k) { return theme.indexOf(k) >= 0; });
          if (themed && (!bestT || p.cost < bestT.cost)) { bestT = p; }
          if (!best || p.cost < best.cost) { best = p; }
        });
        target = bestT || best;
      }
      if (!target || !target.path.length) { break; }
      var took = 0;
      target.path.forEach(function (id) { if (a.left() > 0 && a.take(id)) { took++; } });
      n += took;
      if (!took) { break; }
    }
    return n;
  }

  /* ── 되돌리기 — 한 마디 금(손잡이), 진·원정이 나가 있으면 못 한다 ── */
  function dropCost(n) { return Math.round(T('dropGold', 150) * (n || 1)); }
  function atWar(fid) { var W = global.DG.war; return !!W && W.campsOf && (W.campsOf(fid).length + W.journeysOf(fid).length) > 0; }
  var pendingReset = 0;
  function guard(action) {
    if (action !== 'drop' && action !== 'reset') { return ''; }
    var fid = me(), f = st().forces[fid], cost = dropCost(action === 'reset' ? api(fid).used() : 1);
    if (atWar(fid)) { return '진·원정이 나가 있는 동안은 되돌릴 수 없다'; }
    if ((f.gold || 0) < cost) { return '금이 모자란다 (' + cost + '금)'; }
    if (action === 'reset') { pendingReset = cost; }
    return '';
  }
  function after(action) {
    var f = st().forces[me()];
    if (action === 'drop') { f.gold -= dropCost(1); }
    if (action === 'reset') { f.gold -= pendingReset; pendingReset = 0; }
    if (core.persist) { core.persist(); }
    core.emit('changed');
  }

  var FMT = {
    goldPct: ['금 수입', '%'], foodPct: ['군량 수확', '%'], govPct: ['내정 성과', '%'], troopPct: ['징병', '%'], wallPct: ['축성', '%'],
    atkPct: ['공격', '%'], defPct: ['수비', '%'], hirePct: ['등용', '%'], diploPct: ['외교', '%'], plotPct: ['계략', '%'], expPct: ['무장 경험', '%'],
  };
  function fmt(stats) {
    return Object.keys(stats || {}).map(function (k) { var f = FMT[k] || [k, ''], v = stats[k]; return f[0] + ' ' + (v > 0 ? '+' : '') + v + f[1]; }).join(' · ');
  }

  function open() {
    var UI = global.DG.passiveWebUI, a = api(me());
    if (!UI || !a) { return null; }
    return UI.open(a, def(), {
      title: '🧭 천하 경륜도',   // 점수 내역(기본·빼앗은 성·이정표)은 parts() — 좁은 폭에서 제목이 잘리지 않게 짧게
      fmt: fmt, guard: function (action) { return guard(action); }, after: function (action) { after(action); },
      onClose: function () { core.emit('changed'); },
    });
  }

  /** 상단 「🧭」 단추 — index.html #btn-gyeong. 남은 점수가 있으면 금빛 테 */
  function wire() {
    var b = global.document && global.document.getElementById('btn-gyeong');
    if (!b || b._sc) { return; }
    b._sc = 1;
    b.addEventListener('click', function () { open(); });
    core.on('changed', function () {
      var a = st() && st().started ? api(me()) : null, left = a ? a.left() : 0;
      b.style.boxShadow = left > 0 ? '0 0 0 2px #f0c050' : '';
      b.title = '경륜도 — 세력의 패시브 그물' + (left > 0 ? ' (남은 점수 ' + left + ')' : '');
    });
  }
  if (global.document) { if (global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', wire); } else { wire(); } }

  global.DG = global.DG || {};
  global.DG.statecraft = {
    store: store, api: api, sum: sum, has: has, parts: parts, pointsTotal: pointsTotal,
    gold: gold, food: food, eat: eat, order: order, war: war, wallDmg: wallDmg, rainy: rainy, fire: fire, campDecay: campDecay,
    hire: hire, diplo: diplo, plot: plot, exp: exp, offMul: offMul, won: won, rtsEcon: rtsEcon, rtsStat: rtsStat,
    aiStart: aiStart, aiSpend: aiSpend, THEME: THEME, dropCost: dropCost, atWar: atWar, guard: guard, fmt: fmt, open: open, wire: wire, T: T,
    _reset: function () { cache = {}; statCache = {}; },
  };
})(window);
