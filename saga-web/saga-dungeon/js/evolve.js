/**
 * 2나락 — 무기 진화 (W-0307 · 뱀파이어 서바이버즈 무기 진화·디아블로 큐브 레시피 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 명품 이상이 쌓여도 쓸 데가 없었다 → 연단(forge.js RECIPES)에 다섯째 조합 "합쳐 진화"를 한 줄 더한다(화면은 표를 읽기만):
 *   재료  같은 밑감(base)·같은 등급(명품 2 ~ 보물 3, 전설 아래) 둘(잠근 것·입은 것 제외) + 부문(符文) 아무 글자 하나(가장 낮은 것부터)
 *   결과  등급 +1 · 두 물건 접사를 합쳐 같은 키는 높은 값, 값 큰 순으로 위 TOP 개(새로 굴린 물건의 접사 수 이상) · 이름 앞 ✦ · 미확인 아님(진화는 보고 고른 것)
 *   하루 DAILY 번(save.evolve = { day, n } — 옛 세이브엔 없다)
 * 전설 둘 + 주옥 → 고유 후보는 이번엔 안 함(고유 표가 판정과 얽혀 다음 티켓). 손잡이 dg.evolve(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var DAILY = 3, TOP = 3, MIN_TIER = 2;   // 2 = 명품

  function core() { return global.DG.core; }
  function it() { return global.DG.item; }
  function D() { return global.DG.itemData; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('dg.evolve', 1)); }
  function today(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function st() { var s = core().save; if (!s.evolve || s.evolve.day !== today()) { s.evolve = { day: today(), n: 0 }; } return s.evolve; }
  function left() { return Math.max(0, DAILY - st().n); }
  function spare() { var b = it().bag(), out = [], i; for (i = 0; i < b.length; i++) { if (!b[i].lock) { out.push(b[i]); } } return out; }
  /** 가장 낮은 부문 하나 — { key } 또는 null */
  function lowRune() {
    var R = global.DG.gemData && global.DG.gemData.RUNES || [], i;
    for (i = 0; i < R.length; i++) { if (it().matCount('rune', R[i].key, 0) > 0) { return R[i]; } }
    return null;
  }
  /** 두 접사 목록 합치기(순수) — 같은 키는 높은 값, 값 큰 순 n 개 */
  function mergeAff(a, b, n) {
    var m = {}, out = [], k;
    (a || []).concat(b || []).forEach(function (x) { if (x && x.k && (!m[x.k] || x.v > m[x.k].v)) { m[x.k] = { k: x.k, v: x.v }; } });
    for (k in m) { if (Object.prototype.hasOwnProperty.call(m, k)) { out.push(m[k]); } }
    out.sort(function (p, q) { return q.v - p.v; });
    return out.slice(0, n);
  }

  function find() {
    if (!on() || !left() || !lowRune()) { return []; }
    var by = {}, list = spare(), top = D().TIERS.length - 1, i, g, k, out = [];
    for (i = 0; i < list.length; i++) { g = list[i]; if (!g.base || g.tier < MIN_TIER || g.tier >= top) { continue; } k = g.base + ':' + g.tier; (by[k] = by[k] || []).push(g); }
    for (k in by) {
      if (!Object.prototype.hasOwnProperty.call(by, k) || by[k].length < 2) { continue; }
      var t = by[k][0].tier, up = D().tier(t + 1);
      out.push({ id: 'evolve:' + k, label: '✦ ' + it().name(by[k][0]) + ' ×2 + 부문 1', into: up.name + ' ✦ (접사 위 ' + TOP + ' · 오늘 ' + left() + '번)', color: up.color, have: by[k].length });
    }
    return out;
  }
  function make(id) {
    if (!on()) { return { ok: false, reason: 'off' }; }
    if (!left()) { return { ok: false, reason: 'daily' }; }
    var p = String(id).split(':'), base = p[1], t = parseInt(p[2], 10), list = spare(), pick = [], i;
    for (i = 0; i < list.length && pick.length < 2; i++) { if (list[i].base === base && list[i].tier === t) { pick.push(list[i]); } }
    if (pick.length < 2) { return { ok: false, reason: 'mat' }; }
    if (t >= D().TIERS.length - 1 || t < MIN_TIER) { return { ok: false, reason: 'top' }; }
    var rune = lowRune();
    if (!rune) { return { ok: false, reason: 'rune' }; }
    var lv = Math.max(pick[0].ilvl || 1, pick[1].ilvl || 1), aff = mergeAff(pick[0].aff, pick[1].aff, 99);
    it().take(pick[0].uid); it().take(pick[1].uid); it().addMat('rune', rune.key, 0, -1);
    var out = it().roll(lv, { base: base, tier: t + 1, sock: 0 });
    out.aff = mergeAff(aff, out.aff, Math.max(TOP, (out.aff || []).length));
    out.unid = false; out.evo = 1;
    var nm = it().name(out); out.aiName = '✦ ' + nm;
    var r = it().add(out);
    st().n += 1;
    core().log('⚗️ 연단 · 합쳐 진화 — ' + out.aiName + ' 이(가) 나왔다', 'good');
    core().emit('changed');
    return { ok: true, out: out, kept: r && r.kept };
  }

  function install() {
    var F = global.DG.forge;
    if (!F || !F.RECIPES || F.recipeByKey('evolve')) { return false; }
    F.RECIPES.push({ key: 'evolve', name: '둘을 합쳐 진화', emoji: '✦', need: '같은 밑감 · 같은 등급(명품+) 2점 + 부문 1 · 하루 ' + DAILY + '번', desc: '한 등급 위로 — 두 물건의 좋은 접사를 이어받고 이름 앞에 ✦ 가 붙는다.', find: find, make: make });
    return true;
  }
  install();

  global.DG = global.DG || {};
  global.DG.evolve = { DAILY: DAILY, TOP: TOP, find: find, make: make, mergeAff: mergeAff, left: left, install: install };
})(window);
