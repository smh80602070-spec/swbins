/**
 * 4종횡 끌어 놓기 — W-0362. 공용 dragdrop.js 를 가방 창(ui.js viewBag)에 잇는다.
 * 가방 카드(data-dd=<uid>) → 낀 것 줄(data-dd-drop="slot:<부위>") = gear.equip · 낀 것 줄(data-dd="eq:<부위>") → 가방(data-dd-drop="bag") = gear.unequip.
 * 받을지 판정은 기존 규칙(부위·요구 수준)만 — 끼기·벗기는 gear.js 가 한다. 단추 길(g-equip·g-unequip)은 그대로.
 */
(function (global) {
  'use strict';

  function accepts(item, key) {
    var G = global.DG.gear, core = global.DG.core;
    if (!G) { return false; }
    if (String(item).indexOf('eq:') === 0) { return key === 'bag'; }
    var g = G.byUid(parseInt(item, 10)), d = g && G.defOf(g);
    return !!(d && key === 'slot:' + d.slot && core.save.player.level >= d.need && !G.isEquipped(g.uid));
  }

  function drop(item) {
    var G = global.DG.gear;
    if (String(item).indexOf('eq:') === 0) { return G.unequip(String(item).slice(3)); }
    return G.equip(parseInt(item, 10));
  }

  function init() { if (global.DG.dragdrop && global.document.body) { global.DG.dragdrop.bind(global.document.body, { accepts: accepts, drop: drop }); } }
  if (global.document) { if (global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', init); } else { setTimeout(init, 0); } }

  global.DG = global.DG || {};
  global.DG.ddAdapter = { accepts: accepts, drop: drop };
})(window);
