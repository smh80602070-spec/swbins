/**
 * 3마을 3D — 스타듀 고정 시점 + 풀밭 칸 격자 (W-0160)
 * ---------------------------------------------------------------
 * 옛 3D 마을 카메라(`village-view3d` camPose)는 쿼터뷰(camTiltMix 1)로 시작하지만, 가로로 끌면 돌고(mouseYaw)
 * 세로로 끌면 어깨너머 3인칭까지 기울었다 — 화면 위가 늘 북이 아니어서 "어느 칸에 심나"가 안 읽혔다.
 * 스타듀 문법으로:
 *
 *   시점  정남쪽 위 3/4 에 고정 — yaw 0(카메라 +z = 남쪽에서 북을 본다), 내려다보는 각 55°, 거리 14(× 사람 줌).
 *         끌어도 안 돈다(village-view3d 가 이 모드에선 mouseYaw 0·camTiltMix 1 로 묶는다) → 걷기 입력도 화면 위 = 북
 *   격자  심을 수 있는 풀밭 타일(village.js TILE 40, `canPlantHere` 와 같은 'grass')에만, 내 둘레 반지름 4칸 안에 옅은 선(0.25)
 *         — 칸이 바뀔 때만 다시 짓는다. 인물 원점 규칙은 그대로(격자 묶음을 −나 만큼 옮긴다)
 *
 * 구면 2D(village-view.js)는 안 건드린다. 집 안은 3D 가 꺼지므로(indoorSuppressed) 그대로.
 * 손잡이 `village3d.cozyCam`(1 기본, 0 = 옛 끌어 돌리는 카메라) · `village3d.cozyPitch` 55 · `village3d.cozyDist` 14 · `village3d.cozyGrid`(1).
 * pose()·gridCells() 는 three 없이 돈다 — 자가진단이 본다.
 */
(function (global) {
  'use strict';

  function tuned(k, d) { var C = global.DG && global.DG.core; return C && C.tuned ? C.tuned(k, d) : d; }
  function on() { return !!tuned('village3d.cozyCam', 1); }

  /** 카메라 자리(인물 원점 기준) — zoomDiv 가 클수록 가깝다(사람 줌 × 낚시 당김) */
  function pose(zoomDiv, lookY) {
    var p = tuned('village3d.cozyPitch', 55) * Math.PI / 180, d = tuned('village3d.cozyDist', 14) / (zoomDiv > 0 ? zoomDiv : 1);
    return { x: 0, y: (lookY || 0) + Math.sin(p) * d, z: Math.cos(p) * d, yaw: 0, pitch: p, dist: d };
  }

  /** 내 둘레 풀밭 칸 — tileAt(tx, ty) 가 'grass' 인 칸만, 반지름 R 칸(마름모 말고 네모) */
  function gridCells(px, py, tileAt, TILE, R) {
    var cx = Math.floor(px / TILE), cy = Math.floor(py / TILE), out = [], x, y;
    for (y = cy - R; y <= cy + R; y++) {
      for (x = cx - R; x <= cx + R; x++) { if (tileAt(x, y) === 'grass') { out.push({ x: x, y: y }); } }
    }
    return out;
  }

  var grid = null, gridKey = '', gridMat = null;
  /** 한 프레임 — village-view3d step() 이 부른다 */
  function syncGrid(t, scene, V, s) {
    if (!t || !scene || !V || !V.raw || !V.tileAt) { return; }
    var show = on() && !!tuned('village3d.cozyGrid', 1);
    if (!show) { if (grid) { grid.visible = false; } return; }
    var raw = V.raw(), TILE = V.TILE || 40, px = raw.player.x, py = raw.player.y;
    var key = Math.floor(px / TILE) + ',' + Math.floor(py / TILE) + ':' + (raw.mapKey || raw.village || '');
    if (key !== gridKey) {
      gridKey = key;
      var cells = gridCells(px, py, V.tileAt, TILE, 4), pts = [], i, a = 0.03 * TILE, x0, y0, x1, y1;
      for (i = 0; i < cells.length; i++) {
        x0 = (cells[i].x * TILE + a) * s; y0 = (cells[i].y * TILE + a) * s; x1 = ((cells[i].x + 1) * TILE - a) * s; y1 = ((cells[i].y + 1) * TILE - a) * s;
        pts.push(x0, 0, y0, x1, 0, y0, x1, 0, y0, x1, 0, y1, x1, 0, y1, x0, 0, y1, x0, 0, y1, x0, 0, y0);
      }
      if (!gridMat) { gridMat = new t.LineBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.25, depthWrite: false }); }
      var geo = new t.BufferGeometry();
      geo.setAttribute('position', new t.Float32BufferAttribute(pts, 3));
      if (grid) { grid.geometry.dispose(); grid.geometry = geo; }
      else { grid = new t.LineSegments(geo, gridMat); grid.renderOrder = 4; grid.frustumCulled = false; scene.add(grid); }
    }
    grid.visible = true;
    grid.position.set(-px * s, 0.05, -py * s);   // 인물 원점 — 세상이 나를 둘러 옮겨진다
  }

  global.DG = global.DG || {};
  global.DG.cozyCam3d = { on: on, pose: pose, gridCells: gridCells, syncGrid: syncGrid, stats: function () { return { on: on(), grid: !!(grid && grid.visible), key: gridKey, segs: grid ? grid.geometry.attributes.position.count / 2 : 0 }; } };
})(window);
