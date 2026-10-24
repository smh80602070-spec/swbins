/**
 * 3마을 구역 넘김 (W-0414) — 집 안·동굴 드나들기(village:home·village:cave)와 숲 구역이 바뀔 때(forest:enter — 1초 머문 뒤, 경계 깜빡임 없게)
 * 화면을 곧장 덮고, 3D 면 모델 받기가 끝날 때까지(zoneCut.threeBusy) 기다렸다 걷는다. 공용 막 = shared/js/zone-cut.js. 손잡이 zoneCut.on.
 */
(function (global) {
  'use strict';
  function init() {
    var C = global.DG && global.DG.core, Z = global.DG && global.DG.zoneCut;
    if (!C || !C.on || !Z) { return; }
    Z.threeBusy();
    function wait() { var V3 = global.DG.villageView3d; return !!(V3 && V3.active && V3.active()) && Z.threeBusy(); }
    ['village:home', 'village:cave', 'forest:enter'].forEach(function (ev) { C.on(ev, function () { Z.cut({ wait: wait }); }); });
  }
  if (global.document && global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', init); } else { global.setTimeout(init, 0); }
})(typeof window !== 'undefined' ? window : this);
