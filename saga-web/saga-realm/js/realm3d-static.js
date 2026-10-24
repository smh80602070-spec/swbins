/**
 * 5천하 지도 정적 소품 묶기(InstancedMesh)·자리 자르기 — 발열 대책(2026-09-24·25). realm3d.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * 상태(도착 대기 수·묶음·자르기 통계)는 이 파일이 갖는다. realm3d.js 가 `setup({ three, C, env })` 로 손잡이를 넘기고
 * pend(+1/-1)·maybeFreezeStatic·statCull·matSig·stats·cullStats 를 부른다. env() 는 지금 statGrp·staticBuilt·camera·scene·renderer 를
 * 담은 같은 객체(매 프레임 새로 안 만든다).
 */
(function (global) {
  'use strict';

  var three, C, env;
  var api = null;
  function setup(h) { three = h.three; C = h.C; env = h.env; return api; }

  /* 발열(2026-09-24 "핸드폰 불남") — 정적 소품(나무·바위·집·우물… 약 1,070개)은 저마다 GLB 사본이라 부품마다 따로
     그렸다(그리기 호출 수천 번/프레임). 모두 도착하면 **같은 지오메트리·같은 재질 값**끼리 InstancedMesh 하나로 묶는다 —
     자리·크기·돌림은 원래 행렬 그대로라 그림은 똑같다. 스킨·셰이더 덧대기·빛·스프라이트가 든 것은 안 묶고 그대로 둔다.
     손잡이 `realm3d.staticInst`(기본 1, 0 이면 예전 그대로) */
  var statPending = 0, statFrozen = false, statInst = [];
  function STATIC_INST() { return C().tuned('realm3d.staticInst', 1) ? true : false; }
  function maybeFreezeStatic() {
    var staticBuilt = env().staticBuilt;
    if (statPending > 0 || !staticBuilt || statFrozen) { return; }
    freezeStatic();
  }
  function hexOrNo(c) { return c && c.getHex ? c.getHex() : -1; }
  function uuidOrNo(x) { return x ? x.uuid : '-'; }
  /** 재질 값의 지문 — 이 값이 같으면 보이는 모습이 같다 */
  function matSig(m) {
    return [m.type, hexOrNo(m.color), hexOrNo(m.emissive), uuidOrNo(m.map), uuidOrNo(m.gradientMap), uuidOrNo(m.alphaMap),
      m.transparent ? 1 : 0, m.opacity, m.alphaTest, m.side, m.vertexColors ? 1 : 0, m.flatShading ? 1 : 0,
      m.depthWrite ? 1 : 0, m.fog ? 1 : 0, m.wireframe ? 1 : 0].join(',');
  }
  function freezeStatic() {
    var statGrp = env().statGrp;
    var t = three();
    if (!t || !statGrp || !STATIC_INST() || !t.InstancedMesh) { return; }
    statFrozen = true;
    statGrp.updateMatrixWorld(true);
    var inv = new t.Matrix4().copy(statGrp.matrixWorld).invert();
    var groups = {}, order = [], roots = [], own = Object.prototype.hasOwnProperty;
    statGrp.children.slice().forEach(function (root) {
      if (!root.userData || !root.userData.instOk) { return; }
      var ok = true, list = [];
      root.traverse(function (o) {
        if (!ok) { return; }
        if (o.isSkinnedMesh || o.isInstancedMesh || o.isLight || o.isSprite || o.isPoints || o.isLine) { ok = false; return; }
        if (!o.isMesh) { return; }
        var m = o.material;
        if (!m || Array.isArray(m) || m.isShaderMaterial || own.call(m, 'onBeforeCompile') || !o.geometry || o.geometry.morphAttributes && Object.keys(o.geometry.morphAttributes).length) { ok = false; return; }
        if (!o.visible) { return; }
        list.push(o);
      });
      if (!ok || !list.length) { return; }
      list.forEach(function (o) {
        var k = o.geometry.uuid + '|' + matSig(o.material) + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0) + '|' + o.renderOrder;
        var g = groups[k];
        if (!g) { g = groups[k] = { geo: o.geometry, mat: o.material, cast: o.castShadow, recv: o.receiveShadow, ro: o.renderOrder, mats: [] }; order.push(k); }
        g.mats.push(new t.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      });
      roots.push(root);
    });
    order.forEach(function (k) {
      var g = groups[k], im = new t.InstancedMesh(g.geo, g.mat, g.mats.length), i;
      for (i = 0; i < g.mats.length; i++) { im.setMatrixAt(i, g.mats[i]); }
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = g.cast; im.receiveShadow = g.recv; im.renderOrder = g.ro;
      /* 덩이 하나가 지도 끝에서 끝까지 흩어져 있어 덩이째 자르기(경계 구)는 늘 "보임"이다 — 폰 점검(2026-09-25)에서
         삼각형 575만 중 시야 안 38만. 자리마다 행렬·월드 구를 따로 적어 두고 `statCull` 이 카메라가 움직일 때만
         시야(안개 끝 안) 자리를 앞쪽에 채운다. 그림자 지도를 받는 덩이(castShadow)는 안 자른다 */
      if (!g.geo.boundingSphere) { g.geo.computeBoundingSphere(); }
      var bs = g.geo.boundingSphere, all = new Float32Array(g.mats.length * 16), sph = new Float32Array(g.mats.length * 4);
      var cw = new t.Vector3(), ws = new t.Vector3();
      for (i = 0; i < g.mats.length; i++) {
        var mw = new t.Matrix4().multiplyMatrices(statGrp.matrixWorld, g.mats[i]);
        g.mats[i].toArray(all, i * 16);
        cw.copy(bs.center).applyMatrix4(mw);
        ws.setFromMatrixScale(mw);
        sph[i * 4] = cw.x; sph[i * 4 + 1] = cw.y; sph[i * 4 + 2] = cw.z;
        sph[i * 4 + 3] = bs.radius * Math.max(ws.x, ws.y, ws.z);
      }
      im.frustumCulled = false;
      im.userData.cull = { all: all, sph: sph, n: g.mats.length };
      im.userData.staticInst = true;
      statGrp.add(im);
      statInst.push(im);
    });
    roots.forEach(function (r) { statGrp.remove(r); });
    statFreezeStats = { props: roots.length, meshes: order.reduce(function (s, k) { return s + groups[k].mats.length; }, 0), draws: order.length };
    statCullPV = null;     // 다음 프레임에 한 번 자른다
  }
  var statFreezeStats = null;
  /** W-0400 지역 단위 — 지역이 바뀌어 정적 층을 다시 지을 때: 굳힌 인스턴스를 떼고 굳힘 표시를 푼다(도형·재질은 공유라 안 버림) */
  function reset() { statInst.forEach(function (im) { if (im.parent) { im.parent.remove(im); } if (im.dispose) { im.dispose(); } }); statInst = []; statFrozen = false; statFreezeStats = null; statCullPV = null; }

  /** 묶은 정적 소품을 자리마다 자른다 — 카메라 시야 밖·안개 끝 너머(안개 색뿐)만 뺀다. 그림은 그대로다 */
  var statCullPV = null, statCullFr = null, statCullNow = null, statCullStat = { all: 0, drawn: 0, runs: 0 };
  function statCull() {
    if (!statInst.length) { return; }
    var en = env(), camera = en.camera, scene = en.scene, renderer = en.renderer;
    var t = three();
    if (!statCullFr) { statCullFr = new t.Frustum(); statCullNow = new t.Matrix4(); }
    camera.updateMatrixWorld();
    statCullNow.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    var fog = scene.fog && scene.fog.isFog ? scene.fog.far : 0;
    if (statCullPV && statCullPV.equals(statCullNow) && statCullStat.fog === fog) { return; }
    if (!statCullPV) { statCullPV = new t.Matrix4(); }
    statCullPV.copy(statCullNow);
    statCullStat.fog = fog;
    statCullFr.setFromProjectionMatrix(statCullNow);
    var pl = statCullFr.planes, cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    var shadowOn = !!(renderer.shadowMap && renderer.shadowMap.enabled);
    var all = 0, drawn = 0;
    for (var k = 0; k < statInst.length; k++) {
      var im = statInst[k], U = im.userData.cull;
      if (!U) { continue; }
      all += U.n;
      if (shadowOn && im.castShadow) {
        if (im.count !== U.n) { im.instanceMatrix.array.set(U.all); im.count = U.n; im.instanceMatrix.needsUpdate = true; }
        drawn += U.n; continue;
      }
      var arr = im.instanceMatrix.array, sp = U.sph, j = 0;
      for (var i = 0; i < U.n; i++) {
        var x = sp[i * 4], y = sp[i * 4 + 1], z = sp[i * 4 + 2], r = sp[i * 4 + 3], out = false;
        for (var q = 0; q < 6; q++) {
          var nn = pl[q].normal;
          if (nn.x * x + nn.y * y + nn.z * z + pl[q].constant < -r) { out = true; break; }
        }
        if (out) { continue; }
        if (fog) {
          var dx = x - cx, dy = y - cy, dz = z - cz, lim = fog + r;
          if (dx * dx + dy * dy + dz * dz > lim * lim) { continue; }
        }
        arr.set(U.all.subarray(i * 16, i * 16 + 16), j * 16);
        j++;
      }
      im.count = j;
      if (j) {
        var ia = im.instanceMatrix;
        if (ia.clearUpdateRanges) { ia.clearUpdateRanges(); ia.addUpdateRange(0, j * 16); }
        ia.needsUpdate = true;
      }
      drawn += j;
    }
    statCullStat.all = all; statCullStat.drawn = drawn; statCullStat.runs++;
  }
  function pend(d) { statPending += d; }

  api = { setup: setup, pend: pend, maybeFreezeStatic: maybeFreezeStatic, statCull: statCull, matSig: matSig,
    stats: function () { return statFreezeStats; },
    reset: reset, cullStats: function () { return { all: statCullStat.all, drawn: statCullStat.drawn, runs: statCullStat.runs }; } };
  global.DG = global.DG || {};
  global.DG.realm3dStatic = api;
})(typeof window !== 'undefined' ? window : this);
