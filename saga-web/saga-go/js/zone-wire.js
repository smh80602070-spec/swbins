/**
 * 1만리 구역 넘김 (W-0414) — 이름 붙은 땅이 바뀔 때(biome zone:enter — 배너 뜨는 그 경계)·순간이동(region:teleport) 화면을 곧장 덮고,
 * 3D 면 새 땅 모델 받기가 끝날 때까지(zoneCut.threeBusy) 기다렸다 걷는다. 2D 는 땅 조각을 첫 프레임에 다 구워 0.18초 넘김만.
 * 공용 막 = shared/js/zone-cut.js. 손잡이 zoneCut.on.
 */
(function (global) {
  'use strict';
  /** W-0419 끈끈한 구역 번호(축마다) — 경계를 go.zoneStick(24)m 넘어야 바뀐다. GPS 흔들림·경계 따라 걷기에 막·구역 다시 세우기가 되풀이되던 것(리뷰). 3D 소품·땅·안개 벽·2D 안개·막 다섯 자리가 같이 쓴다 */
  var zCur = [null, null], zM = 0;
  global.DG = global.DG || {};
  global.DG.goZoneIdx = function (p, ax, zm) {
    var v = ax ? p.y : p.x, raw = Math.floor(v / zm + 0.5), C = global.DG.core, st = C && C.tuned ? +C.tuned('go.zoneStick', 24) : 24, c = zCur[ax];
    if (zm !== zM) { zM = zm; zCur = [null, null]; c = null; }
    if (c === null || Math.abs(raw - c) > 1) { zCur[ax] = raw; return raw; }
    if (raw !== c) { var past = raw > c ? v - (c + 0.5) * zm : (c - 0.5) * zm - v; if (past > st) { zCur[ax] = raw; return raw; } }
    return c;
  };
  function init() {
    var C = global.DG && global.DG.core, Z = global.DG && global.DG.zoneCut;
    if (!C || !C.on || !Z) { return; }
    Z.threeBusy();   // 기본 로딩 관리자를 일찍 감싼다
    function wait() { var W3 = global.DG.world3d; return !!(W3 && W3.active && W3.active()) && Z.threeBusy(); }
    /* W-0414 ② 구역 = go.zoneM(576m) 정사각 — 3D 소품은 구역째 세우므로(world3d syncProps) 경계를 넘는 순간 덮는다. 0 이면 옛 이름 붙은 땅(zone:enter) */
    Z.hookKey(function () { var zm = +C.tuned('go.zoneM', 576), p = C.save && C.save.player && C.save.player.pos; if (!(zm > 0) || +C.tuned('go.zoneBuild', 1) !== 1) { return 'off'; } return p ? global.DG.goZoneIdx(p, 0, zm) + ',' + global.DG.goZoneIdx(p, 1, zm) : null; }, { wait: wait });
    C.on('zone:enter', function () { if (!(+C.tuned('go.zoneM', 576) > 0)) { Z.cut({ wait: wait }); } });
    C.on('region:teleport', function () { Z.cut({ wait: wait }); });
  }
  if (global.document && global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', init); } else { global.setTimeout(init, 0); }
})(typeof window !== 'undefined' ? window : this);
