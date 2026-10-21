/**
 * 2나락 끌어 놓기 — W-0362. 공용 dragdrop.js 를 장비 창(ui.js gearDoll·gearGrid)에 잇는다.
 * 가방 칸(data-dd=<uid>) → 인형 칸(data-dd-drop="slot:<부위>", data-hero) = item.equip · 인형 칸(data-dd="eq:<영웅>:<부위>") → 가방(data-dd-drop="bag") = item.unequip.
 * 받을지 판정도 기존 규칙(부위·미확인·요구 수준·가방 자리)만 본다 — 끼기·벗기는 item.js 가 한다. 단추 길(gear-equip·gear-off)은 그대로.
 * 가방은 늘 전투력 순으로 다시 늘어서서 칸끼리 자리 바꾸기는 없다.
 */
(function (global) {
  'use strict';

  function eqOf(s) { var p = String(s).split(':'); return p[0] === 'eq' && p.length >= 3 ? { hero: p[1], slot: p.slice(2).join(':') } : null; }

  function accepts(item, key, el) {
    var I = global.DG.item, e = eqOf(item);
    if (!I) { return false; }
    if (e) { return key === 'bag' && I.bag().length < I.bagCap(); }
    var g = I.find(item), b = g && I.baseOf(g), hero = el && el.getAttribute('data-hero');
    if (!g || !b || I.isUnid(g) || !hero || key !== 'slot:' + b.slot) { return false; }
    return I.meetsReq(hero, g);
  }

  function drop(item, key, el) {
    var I = global.DG.item, e = eqOf(item);
    if (e) { return I.unequip(e.hero, e.slot); }
    return I.equip(el.getAttribute('data-hero'), item);
  }

  function init() { if (global.DG.dragdrop && global.document.body) { global.DG.dragdrop.bind(global.document.body, { accepts: accepts, drop: drop }); } }
  if (global.document) { if (global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', init); } else { setTimeout(init, 0); } }

  global.DG = global.DG || {};
  global.DG.ddAdapter = { accepts: accepts, drop: drop, eqOf: eqOf };
})(window);
