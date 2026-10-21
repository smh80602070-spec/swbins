/**
 * 밤 불빛 (W-0358) — 등·횃불 GLB(K-0155)의 빛남 재질(`glow_fire`·`glow_lamp`)과 불 자리 노드(`light_point`)를 밤 값에 맞춘다.
 *
 *   DG.nightglow3d.update(scene, camera, night01[, nowMs, glowOnly])   판 3D 루프가 그리기 직전 매 틀 부른다(안에서 1초에 한 번만 일한다)
 *   glowOnly — 제 횃불 점광을 이미 단 판(4종횡)은 빛남만
 *
 * - 빛남 세기: 낮 0.3 · 밤 2(재질 원래 세기에 곱) — 재질은 GLB 한 벌을 놓인 것 전부가 나눠 쓰므로 한 번 바꾸면 다 바뀐다.
 * - 점광: 카메라에서 가까운 불 자리 **최대 4개**. PointLight 수는 처음에 고정해 두고 세기만 0 ↔ 값(켰다 껐다 하면 three 가 셰이더를 다시 짓는다).
 *   판마다 길이 단위가 달라(2나락 수백·4종횡 몇) 불 자리의 월드 크기(GLB 1m 가 판 몇 단위인지)로 반경(5m)·세기(크기²)를 맞춘다(거리 제곱 감쇠).
 *   묶음 그리기(InstancedMesh)로 놓인 등은 노드가 없어 빛남만 산다.
 * - 장면은 4초마다 다시 훑는다(층 바뀜·늦게 받은 GLB). 손잡이 nightglow3d.on(0 = 안 함 · 이미 켠 점광은 0)
 * 판정·세이브에는 안 닿는다.
 */
(function (global) {
  var MAX = 4, DAY = 0.3, NIGHT = 2, RANGE_M = 5, LIGHT = 1;
  var mats = [], spots = [], lights = [], home = null, lastTick = -1e9, lastScan = -1e9, night = 0, vA = null, vB = null, vC = null;

  function on() { var C = global.DG && global.DG.core; return !(C && C.tuned) || !!C.tuned('nightglow3d.on', 1); }
  function clamp01(n) { n = +n || 0; return n < 0 ? 0 : n > 1 ? 1 : n; }

  function isGlow(x) { return !!(x && x.name && x.name.indexOf('glow_') === 0 && x.emissive); }
  /* 묶음(InstancedMesh)으로 놓인 등은 노드가 없다 — glow_ 묶음의 칸마다 불꽃 덩이 가운데를 불 자리로(위치는 안 움직이니 훑을 때 한 번) */
  function instSpots(o, T) {
    if (!o.geometry.boundingSphere) { o.geometry.computeBoundingSphere(); }
    var c = o.geometry.boundingSphere.center, m4 = new T.Matrix4(), out = [], i;
    o.updateWorldMatrix(true, false);
    for (i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld);
      var e = m4.elements, sc = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
      if (sc < 1e-6) { continue; }   // 숨긴 칸(크기 0)
      out.push({ inst: o, p: c.clone().applyMatrix4(m4), sc: sc });
    }
    return out;
  }
  function scan(scene, T) {
    var seen = {}; mats = []; spots = [];
    scene.traverse(function (o) {
      if (o.isLight) { return; }
      if (o.name && o.name.indexOf('light_point') === 0) { spots.push({ node: o }); }
      var m = o.material; if (!m) { return; }
      var ms = Array.isArray(m) ? m : [m], glow = false;
      ms.forEach(function (x) {
        if (!isGlow(x)) { return; }
        glow = true; if (seen[x.uuid]) { return; }
        seen[x.uuid] = 1; x.userData = x.userData || {};
        if (x.userData.glowBase === undefined) { x.userData.glowBase = x.emissiveIntensity === undefined ? 1 : x.emissiveIntensity; }
        mats.push(x);
      });
      if (glow && o.isInstancedMesh && o.count) { spots = spots.concat(instSpots(o, T)); }
    });
  }
  function ensureLights(scene, T) {
    if (home === scene && lights.length) { return; }
    lights.forEach(function (l) { if (l.parent) { l.parent.remove(l); } });
    lights = [];
    for (var i = 0; i < MAX; i++) { var l = new T.PointLight(0xffb060, 0, 1, 2); l.name = 'nightglow_' + i; l.castShadow = false; scene.add(l); lights.push(l); }
    home = scene; lastScan = -1e9;
  }
  function inScene(o, scene) { while (o) { if (o === scene) { return true; } if (o.visible === false) { return false; } o = o.parent; } return false; }

  function update(scene, camera, n01, nowMs, glowOnly) {
    var T = global.THREE; if (!scene || !camera || !T) { return; }
    var now = nowMs || (global.performance ? global.performance.now() : Date.now());
    if (home === scene && now - lastTick < 1000) { return; }
    lastTick = now;
    if (!on()) { lights.forEach(function (l) { l.intensity = 0; }); mats.forEach(function (m) { m.emissiveIntensity = m.userData.glowBase; }); return; }
    night = clamp01(n01);
    if (home !== scene) { lastScan = -1e9; }
    if (!glowOnly && (night > 0.05 || (home === scene && lights.length))) { ensureLights(scene, T); }   // 점광은 처음 밤이 될 때 만든다(낮에는 셰이더 값·다시 짓기 없음)
    if (now - lastScan > 4000) { scan(scene, T); lastScan = now; if (!lights.length) { home = scene; } }
    var k = DAY + (NIGHT - DAY) * night, i;
    for (i = 0; i < mats.length; i++) { mats[i].emissiveIntensity = mats[i].userData.glowBase * k; }
    vA = vA || new T.Vector3(); vB = vB || new T.Vector3();
    camera.getWorldPosition(vA);
    var near = [];
    if (night > 0.05 && !glowOnly) {
      for (i = 0; i < spots.length; i++) {
        var s = spots[i], o = s.node || s.inst; if (!inScene(o, scene)) { continue; }
        if (s.node) { s.node.getWorldPosition(vB); s.node.getWorldScale(vC = vC || new T.Vector3()); near.push({ p: vB.clone(), sc: Math.max(vC.x, vC.y, vC.z), d: vB.distanceToSquared(vA) }); }
        else { near.push({ p: s.p, sc: s.sc, d: s.p.distanceToSquared(vA) }); }
      }
      near.sort(function (a, b) { return a.d - b.d; });
    }
    for (i = 0; i < lights.length; i++) {
      var l = lights[i], h = near[i];
      if (!h) { l.intensity = 0; continue; }
      l.position.copy(h.p); l.distance = RANGE_M * h.sc; l.intensity = LIGHT * night * h.sc * h.sc;   // 거리 제곱 감쇠 — 1m(판 단위 × 크기) 자리 밝기 LIGHT
    }
  }

  function stats(detail) {
    var o = { mats: mats.length, spots: spots.length, lit: lights.filter(function (l) { return l.intensity > 0; }).length, night: night };
    if (detail) { o.lights = lights.map(function (l) { return { i: l.intensity, d: l.distance, p: l.position.toArray() }; }); o.cam = vA ? vA.toArray() : null; }
    return o;
  }

  global.DG = global.DG || {};
  global.DG.nightglow3d = { update: update, stats: stats, MAX: MAX, DAY: DAY, NIGHT: NIGHT, _reset: function () { lastTick = -1e9; lastScan = -1e9; } };
})(typeof window !== 'undefined' ? window : this);
