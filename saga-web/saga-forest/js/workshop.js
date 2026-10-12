/**
 * 마을살이 솜씨도 — PoE식 패시브 그물, 주민(프로필)마다 한 장 (W-0184)
 * ===============================================================
 * 싸움·경영 수치는 없다 — 하루 손이 바뀌는 것만(채집·낚시·벌레·사고팔기·이웃·걸음·제작·꽃). 그물 정의는 js/data-passive.js
 * (생성물 — tools/passive-web/gen.mjs saga-forest), 찍기 규칙은 공용 passive-web.js, 화면은 passive-web-ui.js(둘 다 shared 정본).
 * 마을 구면 투영은 안 건드린다 — 겹창(passive-web-ui)만 띄운다.
 *
 *   save.passive = { start, taken:[마디 id…], freeDay }
 *
 * 시작점 여섯 = 채집꾼·낚시꾼·벌레박사·장인·꾸밈이·마당발(가운데 없음). 첫 점은 어느 시작점에나.
 * 점수 = 1(첫 날) + 도구 승급(잠자리채·삽 Lv 마다, 최대 6) + 도감 종 st.ws.dexPer(3) 마다 1(68종 → 22) + 이웃 하트 문턱(3·5·7·10)마다 1
 *        — 상한 st.ws.cap 56(마디 392 의 14.3%).
 * 되돌리기 = 집 안에서만, 하루 한 번 무료, 그 뒤 한 마디 벨 st.ws.dropGold(300).
 *
 * 걸린 자리(판 파일은 묻기만 한다):
 *   village interact 채집 수(gatherN)·도구 없이(맨손) · castLine 입질 창(fishWin) · hookLine 물고기 수(fishN) · speedMul 걸음 ·
 *   bumpHeart 하트 · sell 판매가 · buyTool 값 · 전방 열림(올빼미) · markHybrids 교배 · pickupParcel 택배(마을 사랑) /
 *   bug.swing 벌레 수·채 없이 / data-village pick 드문 것 무게·phaseOf 시간대(새벽형) / craft 재료·삯·아낌 / home·wear 사는 값 / parcel.take
 * 손잡이 st.ws.*(cap·dexPer·dropGold·dawnShift·owlMul·bareWalk·onewellRare·onewellCut·bighandNeed·bighandFee·miser·loveMul·gardenerMul)
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var cache = null;

  function PW() { return global.DG.passiveWeb; }
  function def() { return global.DG.passiveDef; }
  function V() { return global.DG.village; }
  function VD() { return global.DG.villageData; }
  function T(k, d) { return core.tuned ? core.tuned('st.ws.' + k, d) : d; }

  function store() {
    var s = core.save;
    if (!s.passive) { s.passive = { start: null, taken: [] }; }
    return s.passive;
  }
  function vs() { var v = V(); return v && v.state ? v.state() : (core.save.village || {}); }

  /** 점수 내역 — 첫 날 · 도구 승급 · 도감 · 이웃 하트 */
  function parts() {
    var s = vs(), tools = s.tools || {}, caught = s.caught || {}, hearts = s.hearts || {}, U = (VD() && VD().HEART_UNLOCKS) || [], k, t;
    var tool = 0, dex = 0, heart = 0;
    for (k in tools) { t = tools[k]; if (t && typeof t === 'object' && t.lv > 1) { tool += t.lv - 1; } }
    for (k in caught) { if (caught[k] > 0) { dex++; } }
    for (k in hearts) { var h = (hearts[k] && hearts[k].h) || 0; U.forEach(function (u) { if (h >= u.at) { heart++; } }); }
    return { first: 1, tool: tool, dex: Math.floor(dex / T('dexPer', 3)), heart: heart };
  }
  function pointsTotal() { var p = parts(); return Math.min(T('cap', 56), p.first + p.tool + p.dex + p.heart); }

  function api() {
    if (!def() || !PW()) { return null; }
    var st = store();
    if (!cache || cache.store !== st || cache.def !== def()) {
      cache = { store: st, def: def(), sums: null, rules: null };
      var c = cache;
      c.api = PW().make(def(), st, { points: pointsTotal });
      c.api.onChange(function () {
        c.sums = null; c.rules = null;
        var v = V(); if (v && v.syncPlanted) { v.syncPlanted(); }   // 교배 꽃 다시 가림
      });
    }
    return cache.api;
  }
  /** 합·규칙 — 바뀔 때만 다시 센다(걸음처럼 프레임마다 묻는 자리가 있다) */
  function tally() {
    var a = api();
    if (!a) { return null; }
    if (!cache.sums) {
      var sums = {}, rules = {};
      cache.store.taken.forEach(function (id) {
        var n = a.node(id), k;
        if (!n) { return; }
        if (n.rule) { rules[n.rule] = 1; }
        for (k in (n.stats || {})) { if (typeof n.stats[k] === 'number') { sums[k] = (sums[k] || 0) + n.stats[k]; } }
      });
      cache.sums = sums; cache.rules = rules;
    }
    return cache;
  }
  function sum(key) { var c = tally(); return c ? (c.sums[key] || 0) : 0; }
  function has(rule) { var c = tally(); return !!(c && c.rules[rule]); }
  function chance(key) { var p = sum(key) / 100; return p > 0 && Math.random() < p ? 1 : 0; }

  /* ── 판 파일이 묻는 것 ── */
  /** 채집 수 — 작은 마디 +1 확률 · 한 우물(낚시 말고 절반) · 정원사(나무 열매 하나 덜) */
  function gatherN(n, kind) {
    n += chance('gatherPct');
    if (has('onewell')) { n = Math.max(1, Math.round(n * T('onewellCut', 0.5))); }
    if (has('gardener') && (kind === 'tree' || kind === 'pine')) { n = Math.max(1, n - 1); }
    return n;
  }
  function night() { var D = VD(); return !!(D && D.phaseOf && D.phaseOf(new Date().getHours()).key === 'night'); }
  /** 물고기 수 — 올빼미면 밤에 두 마리 */
  function fishN(n) { return has('owl') && night() ? n * T('owlMul', 2) : n; }
  /** 벌레 수 — 작은 마디 +1 확률 · 올빼미 밤 두 배 */
  function bugN(n) { n += chance('bugPct'); return has('owl') && night() ? n * T('owlMul', 2) : n; }
  /** 입질 창 배율 */
  function fishWin() { return 1 + sum('fishPct') / 100; }
  /** 드문 것(무게 1~20) 무게 배율 — 한 우물이면 물고기만 두 배 더 */
  function rareMul(cat) { return (1 + sum('rarePct') / 100) * (cat === 'fish' && has('onewell') ? T('onewellRare', 2) : 1); }
  function sellMul() { return (1 + sum('sellPct') / 100) * (has('miser') ? T('miser', 1.25) : 1); }
  /** 사는 값 — 알뜰(최대 −50%) · 구두쇠 +25% */
  function cost(price) { return Math.round(price * Math.max(0.5, 1 - sum('buyPct') / 100) * (has('miser') ? T('miser', 1.25) : 1)); }
  /** 하트 오름 — 마을 사랑 두 배 · 작은 마디 +1 확률(내림은 그대로) */
  function heart(delta) { return delta > 0 ? delta * (has('villagelove') ? T('loveMul', 2) : 1) + chance('heartPct') : delta; }
  function walk() { return (1 + sum('walkPct') / 100) * (has('barehand') ? T('bareWalk', 0.85) : 1); }
  /** 맨손 — 도구 없이 캐고 잡는다 */
  function noTool() { return has('barehand'); }
  /** 교배 문턱 — 옛 0.45(곁에 꽃이 있을 때 55%) 를 배율만큼 넓힌다 */
  function hybridCut() { var m = (1 + sum('flowerPct') / 100) * (has('gardener') ? T('gardenerMul', 2) : 1); return Math.max(0.02, 0.45 - 0.55 * (m - 1)); }
  /** 제작 재료 수 — 손 큰 장인 −30%(최소 1) */
  function need(n) { return has('bighand') ? Math.max(1, Math.round(n * T('bighandNeed', 0.7))) : n; }
  function craftFee() { return has('bighand') ? T('bighandFee', 200) : 0; }
  /** 아낌 — 지은 뒤 재료 하나를 돌려받을 확률 */
  function refund() { return chance('craftPct'); }
  /** 새벽형 — 3~7시를 2시간 당겨 본다(새벽빛 3시·낮 6시) */
  function hourShift(h) { return has('dawn') && h >= 3 && h < 8 ? h + T('dawnShift', 2) : h; }
  /** 올빼미 — 새벽엔 전방이 닫혀 있다 */
  function shopClosed() { var D = VD(); return has('owl') && !!(D && D.phaseOf && D.phaseOf(new Date().getHours()).key === 'dawn'); }
  /** 마을 사랑 — 다른 마을 택배를 받지 않는다 */
  function parcelBlock() { return has('villagelove'); }

  /* ── 되돌리기 — 집 안에서만, 하루 한 번 무료 ── */
  function inHome() { var v = V(); return !!(v && v.inside && v.inside()); }
  function freeToday() { return store().freeDay !== vs().day; }
  function dropCost(n) { return freeToday() ? 0 : Math.round(T('dropGold', 300) * (n || 1)); }
  var pending = 0;
  function guard(action) {
    var a = api();
    if (action === 'drop' || action === 'reset') {
      if (!inHome()) { return '되돌리기는 집 안에서만 된다'; }
      var c = dropCost(action === 'reset' ? a.used() : 1);
      if ((core.save.player.gold || 0) < c) { return '벨이 모자란다 (' + c + '벨)'; }
      pending = c;
    }
    return '';
  }
  function after(action) {
    if (action === 'drop' || action === 'reset') {
      if (freeToday()) { store().freeDay = vs().day; } else { core.save.player.gold -= pending; }
      pending = 0;
    }
    if (core.persist) { core.persist(); }
    core.emit('changed');
  }

  var FMT = {
    gatherPct: ['채집 하나 더', '%'], fishPct: ['입질 창', '%'], bugPct: ['벌레 하나 더', '%'], rarePct: ['드문 것', '%'],
    sellPct: ['파는 값', '%'], buyPct: ['사는 값 줄임', '%'], heartPct: ['하트 하나 더', '%'], walkPct: ['걸음', '%'],
    craftPct: ['재료 아낌', '%'], flowerPct: ['꽃 교배', '%'],
  };
  function fmt(stats) {
    return Object.keys(stats || {}).map(function (k) { var f = FMT[k] || [k, ''], v = stats[k]; return f[0] + ' ' + (v > 0 ? '+' : '') + v + f[1]; }).join(' · ');
  }

  function open() {
    var UI = global.DG.passiveWebUI, a = api();
    if (!UI || !a) { return null; }
    return UI.open(a, def(), {
      title: '🌿 솜씨도',
      fmt: fmt, guard: function (action) { return guard(action); }, after: function (action) { after(action); },
      onClose: function () { core.emit('changed'); },
    });
  }

  /** 독 「더보기」 안 「솜씨」 단추 — index.html #btn-skill */
  function wire() {
    var b = global.document && global.document.getElementById('btn-skill');
    if (b && !b._ws) {
      b._ws = 1;
      b.addEventListener('click', function () {
        var m = global.document.getElementById('dock-more'); if (m) { m.classList.remove('show'); }
        open();
      });
    }
  }
  if (global.document) { if (global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', wire); } else { wire(); } }

  global.DG = global.DG || {};
  global.DG.workshop = {
    store: store, api: api, sum: sum, has: has, parts: parts, pointsTotal: pointsTotal,
    gatherN: gatherN, fishN: fishN, bugN: bugN, fishWin: fishWin, rareMul: rareMul, sellMul: sellMul, cost: cost, heart: heart,
    walk: walk, noTool: noTool, hybridCut: hybridCut, need: need, craftFee: craftFee, refund: refund, hourShift: hourShift,
    shopClosed: shopClosed, parcelBlock: parcelBlock,
    inHome: inHome, freeToday: freeToday, dropCost: dropCost, guard: guard, fmt: fmt, open: open, wire: wire, T: T,
    _after: after, _reset: function () { cache = null; },
  };
})(window);
