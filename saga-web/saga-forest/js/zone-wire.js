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
    function wait() { var V3 = global.DG.villageView3d; return !!(V3 && V3.active && V3.active()) && ((V3._scatterPend && V3._scatterPend() > 0) || Z.threeBusy()); }
    /* W-0414 ② 3D 소품은 구역(village3d.zoneM 64m)째 세우므로 그 경계를 넘는 순간도 덮는다(3D 일 때만 — 2D 는 한 장 그림이라 숲 구역·집 드나들기만) */
    Z.hookKey(function () { var V3 = global.DG.villageView3d, V = global.DG.village; if (!(V3 && V3.active && V3.active()) || !V || !V.raw) { return 'off'; } var r = V.raw(), zm = +C.tuned('village3d.zoneM', 64), u = zm / (+C.tuned('village3d.worldScale', 0.08) || 0.08); return zm > 0 && r && r.player ? Math.floor(r.player.x / u) + ',' + Math.floor(r.player.y / u) : 'off'; }, { wait: wait });
    ['village:home', 'village:cave', 'forest:enter'].forEach(function (ev) { C.on(ev, function () { Z.cut({ wait: wait }); }); });
  }
  if (global.document && global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', init); } else { global.setTimeout(init, 0); }
})(typeof window !== 'undefined' ? window : this);
