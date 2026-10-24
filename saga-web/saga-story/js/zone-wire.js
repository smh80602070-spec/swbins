/**
 * 4종횡 구역 넘김 (W-0414) — 무대를 넘을 때(side:travel·side:enter) 옛 0.4초 페이드 위에 막을 덮고, 3D 면 새 무대 모델 받기가
 * 끝날 때까지(zoneCut.threeBusy) 기다렸다 걷는다(옛 페이드는 받기를 안 기다려 3D 무대가 눈앞에서 섰다). 공용 막 = shared/js/zone-cut.js.
 */
(function (global) {
  'use strict';
  function init() {
    var C = global.DG && global.DG.core, Z = global.DG && global.DG.zoneCut;
    if (!C || !C.on || !Z) { return; }
    Z.threeBusy();
    function wait() { var S3 = global.DG.sideView3d; return !!(S3 && S3.ready && S3.ready()) && Z.threeBusy(); }
    ['side:travel', 'side:enter'].forEach(function (ev) { C.on(ev, function () { Z.cut({ wait: wait, min: 300 }); }); });
  }
  if (global.document && global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', init); } else { global.setTimeout(init, 0); }
})(typeof window !== 'undefined' ? window : this);
