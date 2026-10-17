/**
 * 5천하 — 보급선 (W-0278, 하츠 오브 아이언식 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 진(陣, war.js camps)은 치중 달수만 보았다. 이제 **출진한 성에서 진까지 우리 땅 길이 이어져야** 보급이 닿는다.
 *
 *   이어짐  출진한 성(cp.from)이 우리 것이고 적 진에 에워싸이지 않았으며, 거기서 우리 성만 밟아(적 진이 선 성은 못 지남)
 *           진이 에워싼 성(cp.to)에 맞닿은 우리 성까지 갈 수 있다 — 성 이웃 그래프(cityData adj) BFS
 *   끊김    위가 안 되거나 계략 "보급 끊기"를 맞았다(cp.cutT 달 남음) → 그 달 사기 ×0.85 · 병력 -5%(war.resolveCamp 가 부른다)
 *   계략    ✂️ 보급 끊기 — 적 성을 고르면 그 성에서 나갔거나 그 성을 지나 보급받는 적 진이 2달 끊긴다. 성공률은 다른 계략과 같은
 *           지력 차 판정(diplo.plotChance)
 *   지도    2D(svg)·3D 지도에 진 뒤 보급 길을 초록(이어짐)·빨강 점선(끊김)으로
 *
 * 판정은 cityData·rtk·war 를 읽기만 하고, 바꾸는 것은 진(cp)의 morale·troops·cutT 뿐이다. 세이브 키 안 바꿈(cp.cutT 는 없으면 0).
 */
(function (global) {
  'use strict';

  var MORALE = 0.85, TROOPS = 0.05, CUT_MONTHS = 2;

  function R() { return global.DG.rtk; }
  function CD() { return global.DG.cityData; }
  function W() { return global.DG.war; }
  function core() { return global.DG.core; }

  /** 그 성에 다른 세력(forceId 아닌)의 진이 서 있나 */
  function enemyCampAt(cityId, forceId) {
    var list = W() && W().camps ? W().camps() : [], i;
    for (i = 0; i < list.length; i++) { if (list[i].to === cityId && list[i].force !== forceId) { return true; } }
    return false;
  }
  function own(cityId, forceId) { var c = R().city(cityId); return !!(c && c.force === forceId); }
  function passable(cityId, forceId) { return own(cityId, forceId) && !enemyCampAt(cityId, forceId); }

  /**
   * 보급 길 — 성 id 목록 [출진 성 … 맞닿은 우리 성, 진이 에워싼 성]. 못 이으면 null.
   * 계략으로 끊긴 것은 여기서 안 본다(길은 있어도 끊긴 것 — ok() 가 따로 본다)
   */
  function path(cp) {
    if (!cp || !R() || !CD()) { return null; }
    var f = cp.force, start = cp.from;
    if (!start || !passable(start, f)) { return null; }
    var goal = {}, adjTo = (CD().find(cp.to) || {}).adj || [], i;
    for (i = 0; i < adjTo.length; i++) { goal[adjTo[i]] = true; }
    var prev = {}, q = [start], seen = {}, cur, adj, n;
    seen[start] = true;
    while (q.length) {
      cur = q.shift();
      if (goal[cur]) {
        var out = [cp.to], k = cur;
        while (k) { out.unshift(k); k = prev[k]; }
        return out;
      }
      adj = (CD().find(cur) || {}).adj || [];
      for (i = 0; i < adj.length; i++) {
        n = adj[i];
        if (seen[n] || !passable(n, f)) { continue; }
        seen[n] = true; prev[n] = cur; q.push(n);
      }
    }
    return null;
  }

  /** 보급이 닿나 — 길이 있고 계략에 안 끊겼다 */
  function ok(cp) { return !!(cp && !(cp.cutT > 0) && path(cp)); }

  /** 한 달 — war.resolveCamp 가 치중을 먹은 뒤 부른다. 끊겼으면 사기·병력이 준다. 끊겼으면 true */
  function monthly(cp) {
    if (!cp) { return false; }
    var cut = !ok(cp);
    if (cp.cutT > 0) { cp.cutT -= 1; }
    if (!cut) { return false; }
    var lost = Math.round((cp.troops || 0) * TROOPS);
    cp.morale = (cp.morale || 1) * MORALE;
    cp.troops = Math.max(0, (cp.troops || 0) - lost);
    var C = core(), to = CD().find(cp.to);
    if (C && C.log) { C.log('✂️ ' + (R().forceName ? R().forceName(cp.force) : cp.force) + ' 의 ' + (to ? to.name : cp.to) + ' 진 — 보급선이 끊겨 사기가 꺾이고 병사 ' + (C.fmt ? C.fmt(lost) : lost) + ' 이 흩어졌다', 'warn'); }
    return true;
  }

  /** 계략 "보급 끊기" 의 표적 — 그 성(적 성)에서 나갔거나 그 성을 지나 보급받는 그 성 주인의 진 */
  function campsVia(cityId) {
    var c = R() && R().city(cityId), list = W() && W().camps ? W().camps() : [], out = [], i, p;
    if (!c || !c.force) { return out; }
    for (i = 0; i < list.length; i++) {
      if (list[i].force !== c.force) { continue; }
      p = list[i].from === cityId ? [cityId] : path(list[i]);
      if (p && p.indexOf(cityId) >= 0) { out.push(list[i]); }
    }
    return out;
  }
  /** 계략이 맞았다 — 그 진들을 CUT_MONTHS 달 끊는다. 끊은 수 */
  function cutVia(cityId) {
    var cs = campsVia(cityId), i;
    for (i = 0; i < cs.length; i++) { cs[i].cutT = Math.max(cs[i].cutT || 0, CUT_MONTHS); }
    return cs.length;
  }

  /* ── 지도 ── */
  var GREEN = '#6fdc7a', RED = '#ff5a4a';
  /** 2D 지도(svg) 선 — renderMap 이 </svg> 앞에 붙인다 */
  function svg() {
    var list = W() && W().camps ? W().camps() : [], s = '', i, k, p, a, b, good;
    for (i = 0; i < list.length; i++) {
      p = path(list[i]); good = !!p && !(list[i].cutT > 0);
      if (!p) { p = [list[i].from, list[i].to]; }
      for (k = 0; k + 1 < p.length; k++) {
        a = CD().find(p[k]); b = CD().find(p[k + 1]);
        if (!a || !b) { continue; }
        s += '<line class="rsupply' + (good ? '' : ' cut') + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="' + (good ? GREEN : RED) + '"/>';
      }
    }
    return s;
  }
  /** 3D 지도 — 진 하나의 보급 길 마디 [{a, b, color}] (realm3d buildCamp 가 길 띠로 그린다) */
  function segs3d(cp) {
    var p = path(cp), good = !!p && !(cp.cutT > 0), out = [], k;
    if (!p) { p = [cp.from, cp.to]; }
    for (k = 0; k + 1 < p.length; k++) { out.push({ a: CD().find(p[k]), b: CD().find(p[k + 1]), color: good ? GREEN : RED, good: good }); }
    return out.filter(function (x) { return x.a && x.b; });
  }

  global.DG = global.DG || {};
  global.DG.supplyLine = {
    MORALE: MORALE, TROOPS: TROOPS, CUT_MONTHS: CUT_MONTHS,
    path: path, ok: ok, monthly: monthly, campsVia: campsVia, cutVia: cutVia, enemyCampAt: enemyCampAt,
    svg: svg, segs3d: segs3d
  };
})(window);
