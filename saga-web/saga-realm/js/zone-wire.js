/**
 * 5천하 구역 넘김 (W-0414) — 지역을 바꿀 때('region')·전술판을 열고 닫을 때 화면을 곧장 덮고, 3D 면 모델 받기가 끝날 때까지
 * (zoneCut.threeBusy) 기다렸다 걷는다. 지역 지도·전술판은 원래 따로 그리는 화면이라 막만 더한다. 공용 막 = shared/js/zone-cut.js.
 */
(function (global) {
  'use strict';
  function init() {
    var C = global.DG && global.DG.core, Z = global.DG && global.DG.zoneCut;
    if (!C || !C.on || !Z) { return; }
    Z.threeBusy();
    function wait() { var R3 = global.DG.realm3d; return !!(R3 && R3.active && R3.active()) && Z.threeBusy(); }
    C.on('region', function () { Z.cut({ wait: wait }); });
    Z.hookKey(function () { var T = global.DG.tacticsView; return T && T.cur && T.cur() ? 'tac' : 'map'; }, { wait: function () { return Z.threeBusy(); } });
  }
  if (global.document && global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', init); } else { global.setTimeout(init, 0); }
})(typeof window !== 'undefined' ? window : this);
