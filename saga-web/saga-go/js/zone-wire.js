/**
 * 1만리 구역 넘김 (W-0414) — 이름 붙은 땅이 바뀔 때(biome zone:enter — 배너 뜨는 그 경계)·순간이동(region:teleport) 화면을 곧장 덮고,
 * 3D 면 새 땅 모델 받기가 끝날 때까지(zoneCut.threeBusy) 기다렸다 걷는다. 2D 는 땅 조각을 첫 프레임에 다 구워 0.18초 넘김만.
 * 공용 막 = shared/js/zone-cut.js. 손잡이 zoneCut.on.
 */
(function (global) {
  'use strict';
  function init() {
    var C = global.DG && global.DG.core, Z = global.DG && global.DG.zoneCut;
    if (!C || !C.on || !Z) { return; }
    Z.threeBusy();   // 기본 로딩 관리자를 일찍 감싼다
    function wait() { var W3 = global.DG.world3d; return !!(W3 && W3.active && W3.active()) && Z.threeBusy(); }
    /* W-0414 ② 구역 = go.zoneM(576m) 정사각 — 3D 소품은 구역째 세우므로(world3d syncProps) 경계를 넘는 순간 덮는다. 0 이면 옛 이름 붙은 땅(zone:enter) */
    Z.hookKey(function () { var zm = +C.tuned('go.zoneM', 576), p = C.save && C.save.player && C.save.player.pos; if (!(zm > 0)) { return 'off'; } return p ? Math.floor(p.x / zm + 0.5) + ',' + Math.floor(p.y / zm + 0.5) : null; }, { wait: wait });
    C.on('zone:enter', function () { if (!(+C.tuned('go.zoneM', 576) > 0)) { Z.cut({ wait: wait }); } });
    C.on('region:teleport', function () { Z.cut({ wait: wait }); });
  }
  if (global.document && global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', init); } else { global.setTimeout(init, 0); }
})(typeof window !== 'undefined' ? window : this);
