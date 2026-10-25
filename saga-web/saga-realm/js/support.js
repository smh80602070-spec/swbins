/**
 * 5천하 — 지원 단계 (W-0425 · 파이어 엠블렘·영걸전 지원 — 구조만, 이름·수치는 우리 것)
 * ---------------------------------------------------------------
 * 격자 SRPG 전술판에서 장수끼리 **나란히 설 이유**:
 *   셈      내 장수가 칠 때 상하좌우 이웃(거리 1)에 선 내 장수 쌍을 그 판에 적어 두고, 판이 끝나면(outcome 첫 결과) 쌍마다 +1 — 한 판 한 번
 *   단계    점수 3·7·12 → C·B·A · 의형제(relData sworn)는 점수 없이도 B 부터 · 원수(foe)는 안 오름·보너스 없음
 *   보너스  칠 때 이웃에 지원 쌍이 있으면 명중 +5·+10·+15, 맞을 때 대상 이웃에 지원 쌍이 있으면 그만큼 명중 깎음(회피) — 쌍 여럿이면 가장 큰 것 하나
 *   세이브  save.rtk.support = { 'a|b'(id 사전순): 점수 } (순수 추가)
 * tactics.js 기존 줄 끝에서 부른다(attack 의 acted 줄 onAct · hitMods 의 뒤 줄 mods · outcome 첫 결과 onEnd). 내 편(side 'me') 장수만.
 * 장수 상세 시트 줄은 rowHtml(id). 손잡이 rtk.support(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var STEPS = [3, 7, 12], NAMES = ['C', 'B', 'A'], BONUS = [5, 10, 15];

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('rtk.support', 1)); }
  function st() { var R = global.DG.rtk, s = R && R.state ? R.state() : null; if (!s) { return null; } if (!s.support || typeof s.support !== 'object') { s.support = {}; } return s.support; }
  function key(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  function relKind(a, b) {
    var RD = global.DG.relData, L = RD && RD.all ? RD.all() : [];
    for (var i = 0; i < L.length; i++) { var p = L[i]; if ((p.a === a && p.b === b) || (p.a === b && p.b === a)) { if (p.kind === 'sworn' || p.kind === 'foe') { return p.kind; } } }
    return '';
  }
  function points(a, b) { var s = st(); return s ? s[key(a, b)] || 0 : 0; }
  /** 단계 0(없음)·1 C·2 B·3 A */
  function level(a, b) {
    if (!a || !b || a === b) { return 0; }
    var rk = relKind(a, b); if (rk === 'foe') { return 0; }
    var p = points(a, b), lv = 0;
    for (var i = 0; i < STEPS.length; i++) { if (p >= STEPS[i]) { lv = i + 1; } }
    return rk === 'sworn' ? Math.max(2, lv) : lv;
  }
  function nameOf(lv) { return lv ? NAMES[lv - 1] : ''; }
  function bonusOf(lv) { return lv ? BONUS[lv - 1] : 0; }

  function mates(b, u) {
    return (b.units || []).filter(function (o) { return o !== u && o.hp > 0 && o.side === u.side && o.kind === 'officer' && o.id && Math.abs(o.x - u.x) + Math.abs(o.y - u.y) === 1; });
  }
  /** u 의 이웃 중 가장 높은 지원 단계 */
  function bestNear(b, u) {
    if (!u || u.kind !== 'officer' || u.side !== 'me') { return 0; }
    var best = 0; mates(b, u).forEach(function (o) { best = Math.max(best, level(u.id, o.id)); });
    return best;
  }

  /** 내 장수가 쳤다 — 이웃 쌍을 그 판에 적는다 */
  function onAct(b, a) {
    if (!on() || !a || a.side !== 'me' || a.kind !== 'officer' || !a.id) { return; }
    if (!b.supPairs) { b.supPairs = {}; }
    mates(b, a).forEach(function (o) { if (relKind(a.id, o.id) !== 'foe') { b.supPairs[key(a.id, o.id)] = 1; } });
  }
  /** 판 끝 — 쌍마다 +1. 오른 단계를 돌려준다 [{a, b, lv}] */
  function onEnd(b) {
    var s = st(), up = [];
    if (!on() || !s || !b.supPairs) { return up; }
    Object.keys(b.supPairs).forEach(function (k) {
      var ab = k.split('|'), before = level(ab[0], ab[1]);
      s[k] = (s[k] || 0) + 1;
      var after = level(ab[0], ab[1]);
      if (after > before) { up.push({ a: ab[0], b: ab[1], lv: after }); }
    });
    b.supUp = up;
    return up;
  }
  /** 명중 보정 — hitMods 가 out 에 더한다 */
  function mods(b, att, tgt, out) {
    if (!on()) { return; }
    var la = bestNear(b, att), lt = bestNear(b, tgt);
    if (la) { out.push(['지원 ' + nameOf(la), bonusOf(la)]); }
    if (lt) { out.push(['지원 막음 ' + nameOf(lt), -bonusOf(lt)]); }
  }

  /** 전술판 칸 왼쪽 아래 「🤝C」 — 지금 이웃에 지원 쌍이 있는 내 장수만(tactics-view 가 부른다) */
  function svgMark(b, u, x0, y0, cell) {
    var lv = on() ? bestNear(b, u) : 0; if (!lv) { return ''; }
    return '<text x="' + (x0 + 4) + '" y="' + (y0 + cell - 5) + '" font-size="10" font-weight="700" fill="#ffe08a" stroke="#000a" stroke-width="2.5" paint-order="stroke" pointer-events="none">🤝' + nameOf(lv) + '</text>';
  }
  /** 장수 상세 시트 한 줄 — 지원 쌍(단계 있는 것만) */
  function rowHtml(id) {
    var s = st(); if (!on() || !s || !id) { return ''; }
    var D = global.DG.data, seen = {}, items = [];
    Object.keys(s).forEach(function (k) { var ab = k.split('|'); if (ab[0] === id || ab[1] === id) { seen[ab[0] === id ? ab[1] : ab[0]] = 1; } });
    (global.DG.relData && global.DG.relData.all ? global.DG.relData.all() : []).forEach(function (p) { if (p.kind === 'sworn' && (p.a === id || p.b === id)) { seen[p.a === id ? p.b : p.a] = 1; } });
    Object.keys(seen).forEach(function (o) {
      var lv = level(id, o); if (!lv) { return; }
      var h = D && D.find ? D.find(o) : null;
      items.push('<b>' + nameOf(lv) + '</b> ' + (h ? h.name : o));
    });
    if (!items.length) { return ''; }
    return '<div class="stat-row"><span>🤝 지원</span><span>' + items.join(' · ') + '</span></div>';
  }

  global.DG = global.DG || {};
  global.DG.support = { STEPS: STEPS, NAMES: NAMES, BONUS: BONUS, key: key, points: points, level: level, nameOf: nameOf, bonusOf: bonusOf, bestNear: bestNear, onAct: onAct, onEnd: onEnd, mods: mods, rowHtml: rowHtml, svgMark: svgMark };
})(window);
