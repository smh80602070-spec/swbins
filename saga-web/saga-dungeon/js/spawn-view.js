/**
 * 2나락 — 화면 밖 스폰 거리(W-0327). 사용자 10-18 "이동하면 몹들이 갑자기 생긴다".
 * ---------------------------------------------------------------
 * 들판 보충 스폰(04-field spawnFieldEncounters)은 플레이어 둘레 (벽+60)≈86 유닛부터 무리를 놓았다 — 카메라가 보는 반경(수백 유닛)보다 훨씬
 * 안쪽이라 보충 무리가 화면 한가운데서 "툭" 생겼다. 여기서 **지금 화면이 덮는 땅의 반경**을 재서 스폰 하한으로 쓴다.
 *
 *   radius()   3D 면 화면 가운데·가장자리 여덟 점을 땅(y=0)에 쏘아 가운데 점에서 가장 먼 거리(유닛 = 3D 세계 단위, 집·적이 같은 자리 수를 쓴다).
 *              모서리가 지평선 위(땅에 안 맞음)면 Infinity. 2D 면 화면 반대각선 ÷ 1유닛 화소. 화면이 없으면 0.
 *   minDist()  radius × dg.spawnOffMul(1.2), Infinity 면 dg.spawnOffMax(1400) — 이 너머는 들판이 안 깔려 자리를 못 찾는다.
 *   ring(base, R) → { lo, hi } — 옛 하한 base·들판 반경 R 과 합친 스폰 고리(하한이 R 을 넘으면 상한을 하한 + 240 으로 늘린다).
 *   appearK(en, now) 0→1 — 화면 안에 놓을 수밖에 없었던 적(en.bornAt)의 등장 연출 진행(0.6초). 3D 는 땅에서 솟고 2D 는 투명→불투명.
 * 순수 부분(ring·appearK)은 three 없이 돈다 — 자가진단이 본다.
 */
(function (global) {
  'use strict';
  function tuned(k, d) { var D3 = global.DG && global.DG.dungeon3d; return D3 && D3.tuned ? D3.tuned(k, d) : d; }
  var APPEAR = 0.6;
  var ray = null, pl = null, hit = null, c0 = null, ndc = null;
  var PTS = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [-1, 0], [1, 0]];

  function radius3d() {
    var D3 = global.DG && global.DG.dungeon3d, T = global.THREE, cam = D3 && D3.camNode ? D3.camNode() : null;
    if (!D3 || !D3.active || !D3.active() || !cam || !T) { return null; }
    ray = ray || new T.Raycaster(); pl = pl || new T.Plane(new T.Vector3(0, 1, 0), 0);
    hit = hit || new T.Vector3(); c0 = c0 || new T.Vector3(); ndc = ndc || new T.Vector2();
    cam.updateMatrixWorld();
    ndc.set(0, 0); ray.setFromCamera(ndc, cam); if (!ray.ray.intersectPlane(pl, c0)) { return Infinity; }
    var r = 0, i;
    for (i = 0; i < PTS.length; i++) {
      ndc.set(PTS[i][0], PTS[i][1]); ray.setFromCamera(ndc, cam);
      if (!ray.ray.intersectPlane(pl, hit)) { return Infinity; }
      r = Math.max(r, hit.distanceTo(c0));
    }
    return r;
  }
  function radius2d() {
    var V = global.DG && global.DG.dungeonView; if (!V || !V.shown || !V.shown() || !V._proj) { return null; }
    var a = V._proj(0, 0), b = V._proj(100, 0), c = V._proj(0, 100);
    var ppu = Math.min(Math.hypot(b.x - a.x, b.y - a.y), Math.hypot(c.x - a.x, c.y - a.y)) / 100;
    if (!(ppu > 0)) { return null; }
    return Math.hypot(global.innerWidth || 1280, global.innerHeight || 720) / 2 / ppu;
  }
  function radius() { var r = radius3d(); if (r === null) { r = radius2d(); } return r === null ? 0 : r; }
  function minDist() {
    var r = radius();
    if (!isFinite(r)) { return +tuned('dg.spawnOffMax', 1400); }
    return Math.min(+tuned('dg.spawnOffMax', 1400), r * +tuned('dg.spawnOffMul', 1.2));
  }
  /** 순수 — 스폰 고리. base = 옛 하한(벽+60), R = 들판 반경, md = 화면 밖 하한 */
  function ring(base, R, md) {
    var lo = Math.max(base, md || 0), hi = Math.max(R, lo + 40);
    if (md && lo > R - 40) { hi = lo + 240; }
    return { lo: lo, hi: hi };
  }
  /** 순수 — 등장 연출 진행(0 = 막 생김 → 1 = 다 섬). bornAt 없으면 1 */
  function appearK(en, now) {
    if (!en || !en.bornAt) { return 1; }
    var k = (now - en.bornAt) / 1000 / APPEAR;
    return k >= 1 ? 1 : (k <= 0 ? 0 : k);
  }
  function now() { return (global.performance && global.performance.now) ? global.performance.now() : Date.now(); }

  global.DG = global.DG || {};
  global.DG.spawnView = { radius: radius, radius3d: radius3d, radius2d: radius2d, minDist: minDist, ring: ring, appearK: appearK, now: now, APPEAR: APPEAR, on: function () { return !!+tuned('dg.spawnOff', 1); } };
})(window);
