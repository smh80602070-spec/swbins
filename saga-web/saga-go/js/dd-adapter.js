/**
 * 1만리 끌어 놓기 — W-0362. 이 판은 장비를 인물 상세의 고르기 칸(<select>)으로 낀다 — 끌 가방 격자가 없다.
 * 그래서 「나」 시트(ui-me.js)에서 선두의 무기·보패 칸(me-panel data-dd="wp:<무기>"·"art:<보패>")을
 * 동행 줄(data-dd-drop="hero:<인물>")에 놓으면 그 인물에게 옮긴다 = 기존 weapon.equip·artifact.equip(먼저 든 인물에게선 빠진다).
 * 무기는 종류가 맞는 인물만(검은 검 쓰는 인물에게) · 수련용(공용) 무기는 끌지 않는다. 고르기 칸 길은 그대로.
 */
(function (global) {
  'use strict';

  function parse(s) { var i = String(s).indexOf(':'); return i > 0 ? { kind: s.slice(0, i), id: s.slice(i + 1) } : null; }

  function accepts(item, key) {
    var D = global.DG, p = parse(item), t = parse(key);
    if (!p || !t || t.kind !== 'hero' || !D.core.save.dex.heroes[t.id]) { return false; }
    if (p.kind === 'wp') { var WP = D.weapon, w = WP && WP.info(p.id); return !!(w && !WP.isShared(p.id) && w.type === WP.typeOf(t.id) && WP.equipped(t.id) !== p.id); }
    if (p.kind === 'art') { var AR = D.artifact, a = AR && AR.list()[p.id]; return !!(a && a.owner !== t.id); }
    return false;
  }

  function drop(item, key) {
    var D = global.DG, p = parse(item), t = parse(key);
    if (p.kind === 'wp') { return D.weapon.equip(t.id, p.id); }
    return D.artifact.equip(t.id, p.id);
  }

  function init() { if (global.DG.dragdrop && global.document.body) { global.DG.dragdrop.bind(global.document.body, { accepts: accepts, drop: drop }); } }
  if (global.document) { if (global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', init); } else { setTimeout(init, 0); } }

  global.DG = global.DG || {};
  global.DG.ddAdapter = { accepts: accepts, drop: drop };
})(window);
