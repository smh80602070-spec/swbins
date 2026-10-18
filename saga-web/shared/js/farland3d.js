/**
 * farland3d — 지평선까지(W-0310 ④): 타일 밖 먼 땅 고리(지형 LOD) + 먼 숲 임포스터(8방향 빌보드) — 안개 없이 2km.
 *
 *   타일(world3d.tileSpan 3 → 약 ±860m) 밖은 여태 안개와 산 실루엣 고리(ground3d.ridge 600~850m)가 가렸다. 여기서는
 *   ① 먼 땅 고리: 극좌표 격자(부채꼴 S × 고리 N — 멀수록 칸이 넓어지는 LOD)를 안쪽 반지름(타일 끝)부터 바깥(km)까지 한 덩이로 세우고
 *      정점마다 relief3d.heightAt(땅 높이) × 과장(안쪽 1 → 바깥 far3d.relief, 이음새는 그대로) · 지형 종류(relief3d.kindAt) 색을 준다 — 그리기 1.
 *   ② 숲 임포스터: 덤불 한 덩이(원뿔 셋 + 줄기)를 8 방향에서 한 번 구워(RenderTarget 1024×128) InstancedBufferGeometry 하나로 숲 칸마다
 *      세운다 — 정점 셰이더가 카메라 방위와 제 yaw 로 8 칸 중 하나를 고르고 카메라를 향해 돌린다(원통 빌보드) — 그리기 1.
 *   단일체(ground3d.ridge 처럼): world3d 05-render 가 매 프레임 `follow(scene, pos, camera, L)` 한 줄로 부른다(손잡이 far3d.on 이 0 이면 아무것도 안 한다).
 *   순수 부분 ringPlan(안쪽·바깥·S·N)·viewOf(상대각, 8) 는 three 없이 돈다 — 자가진단이 본다.
 *   ③ 산 테(rim): 바깥 반지름 너머 세 고리(+150·+420·+760m)에 노이즈 높이(60~300m)의 먼 산맥 — **따로 한 덩이, 안개 없음**, 색은 매 프레임 안개색 × 겹별 밝기
 *      (옛 ridge 가 그랬듯 — 안개를 받으면 지평선 하늘(= 안개색)에 녹아 안 보인다, 10-18 확인). 옛 ridge 의 '지평선 가리기'를 2km 밖에서.
 *   손잡이: far3d.on(본 게임 기본 0 — 시연 #limitless 가 켠다) · far3d.km(2.2) · far3d.relief(10, 바깥 산 과장) · far3d.rim(1) · far3d.trees(2500) · far3d.fogFar(2300, 0 이면 판 안개 그대로) · far3d.sectors(96) · far3d.rings(20)
 */
(function (global) {
  'use strict';

  function tn(k, d) { var c = global.DG && global.DG.core; return c && c.tuned ? c.tuned(k, d) : d; }
  function ON() { return tn('far3d.on', 0) ? true : false; }
  function KM() { return +tn('far3d.km', 2.2); }
  function RELIEF() { return +tn('far3d.relief', 10); }
  function RIM() { return tn('far3d.rim', 1) ? true : false; }
  function TREES() { return Math.max(0, Math.round(+tn('far3d.trees', 2500))); }
  function fogFar() { return ON() ? +tn('far3d.fogFar', RIM() ? 3300 : 2300) : 0; }   // 산 테가 있으면 그 너머까지
  var VIEWS = 8, CELL = 48;
  var PAL = { grass: 0x7d9a52, forest: 0x486f3c, mount: 0x8d877a, water: 0x3f6f9a, town: 0x9a8c74, road: 0x8f8a7c, farm: 0xa0a455 };
  var RIM_R = [150, 420, 760], RIM_SHADE = [0.62, 0.72, 0.82];   // 산 테 세 고리(바깥 반지름에 더하는 m)·안개색에 곱하는 밝기(가까운 겹이 짙다 — 대기 원근)
  function noise1(a, s) { var x = Math.sin(a * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); }
  function smooth1(a, s) { var i = Math.floor(a), f = a - i, u = f * f * (3 - 2 * f); return noise1(i, s) * (1 - u) + noise1(i + 1, s) * u; }
  /** 산 테 높이(m) — 각(라디안)·고리 번호로 결정적 노이즈 */
  function rimH(th, layer) { var a = th / (Math.PI * 2) * 40, s = layer * 17 + 3; var v = smooth1(a, s) * 0.55 + smooth1(a * 2.7, s + 5) * 0.3 + smooth1(a * 6.1, s + 11) * 0.15; return (40 + layer * 30) + v * (120 + layer * 90); }

  /** 극좌표 격자 계획 — 돌아오는 값: { r: 고리 반지름들(N+1), S, N, verts, tris } (멀수록 간격이 넓다: (i/N)^1.4) */
  function ringPlan(inner, outer, S, N) {
    var r = [], i; for (i = 0; i <= N; i++) { r.push(inner + (outer - inner) * Math.pow(i / N, 1.4)); }
    return { r: r, S: S, N: N, verts: (N + 1) * S, tris: N * S * 2 };
  }
  /** 상대각(카메라 방위 − 제 yaw, 라디안) → 8 칸 중 번호 */
  function viewOf(rel, views) {
    views = views || VIEWS;
    var f = rel / (Math.PI * 2); f -= Math.floor(f);
    return Math.floor((f + 0.5 / views) * views) % views;
  }
  /** 과장 — 이음새(안쪽)는 1, 바깥으로 갈수록 k */
  function exag(d, inner, outer, k) { var u = Math.max(0, Math.min(1, (d - inner) / Math.max(1, outer - inner))); return 1 + (k - 1) * u * u; }

  var st = { group: null, ring: null, rim: null, trees: null, atlas: null, cx: NaN, cz: NaN, inner: 0, outer: 0, ms: 0, nTrees: 0, camFar0: 0, mat: null, scene: null };

  function innerRadius() {
    var W = global.DG.world, span = 0;
    try { span = W.TILE_PX * W.metersPerPixel(); } catch (e) { span = 245; }
    return (tn('world3d.tileSpan', 3) + 0.5) * span - 12;   // 타일 끝 조금 안쪽에서 시작해 틈이 없게
  }

  function buildRing(t, cx, cz) {
    var R = global.DG.relief3d, inner = st.inner, outer = st.outer, S = Math.max(24, Math.round(+tn('far3d.sectors', 96))), N = Math.max(4, Math.round(+tn('far3d.rings', 20)));
    var plan = ringPlan(inner, outer, S, N), NT = N, k = RELIEF(), pos = new Float32Array((NT + 1) * S * 3), col = new Float32Array((NT + 1) * S * 3), idx = [], c = new t.Color(), i, j, v = 0;
    for (i = 0; i <= N; i++) {
      for (j = 0; j < S; j++) {
        var th = j / S * Math.PI * 2, d = plan.r[i], x = cx + Math.cos(th) * d, z = cz + Math.sin(th) * d;
        var kind = R && R.kindAt ? (R.kindAt(Math.floor(x / CELL), Math.floor(z / CELL)) || 'grass') : 'grass', h = R && R.on && R.on() ? R.heightAt(x, z) : 0;   // kindAt 은 48m 격자 번호
        pos[v * 3] = x; pos[v * 3 + 1] = h * exag(d, inner, outer, k) - 0.3; pos[v * 3 + 2] = z;
        c.setHex(PAL[kind] || PAL.grass); col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
        v++;
      }
    }
    for (i = 0; i < NT; i++) { for (j = 0; j < S; j++) { var a = i * S + j, b = i * S + (j + 1) % S, c2 = a + S, d2 = b + S; idx.push(a, c2, b, b, c2, d2); } }
    var geo = new t.BufferGeometry();
    geo.setAttribute('position', new t.BufferAttribute(pos, 3)); geo.setAttribute('color', new t.BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    var m = new t.Mesh(geo, new t.MeshLambertMaterial({ vertexColors: true })); m.name = 'farland3d:ring'; m.frustumCulled = false; m.receiveShadow = false; m.renderOrder = -3;
    return m;
  }

  /** 산 테 — 바깥 반지름에 바닥 줄(땅 밑) + 세 고리, 안개 없는 Basic 재질(색은 follow 가 안개색으로), 정점색 = 겹별 밝기 */
  function buildRim(t, cx, cz) {
    var S = Math.max(24, Math.round(+tn('far3d.sectors', 96))), outer = st.outer, rows = RIM_R.length + 1, pos = new Float32Array(rows * S * 3), col = new Float32Array(rows * S * 3), idx = [], i, j, v = 0;
    for (i = 0; i < rows; i++) {
      for (j = 0; j < S; j++) {
        var th = j / S * Math.PI * 2, d = outer + (i === 0 ? 0 : RIM_R[i - 1]), y = i === 0 ? -30 : rimH(th, i - 1) * (i === 1 ? 0.7 : 1), sh = RIM_SHADE[Math.max(0, i - 1)];
        pos[v * 3] = cx + Math.cos(th) * d; pos[v * 3 + 1] = y; pos[v * 3 + 2] = cz + Math.sin(th) * d; col[v * 3] = col[v * 3 + 1] = col[v * 3 + 2] = sh; v++;
      }
    }
    for (i = 0; i < rows - 1; i++) { for (j = 0; j < S; j++) { var a = i * S + j, b = i * S + (j + 1) % S, c2 = a + S, d2 = b + S; idx.push(a, c2, b, b, c2, d2); } }
    var geo = new t.BufferGeometry(); geo.setAttribute('position', new t.BufferAttribute(pos, 3)); geo.setAttribute('color', new t.BufferAttribute(col, 3)); geo.setIndex(idx);
    var m = new t.Mesh(geo, new t.MeshBasicMaterial({ vertexColors: true, fog: false, side: t.DoubleSide })); m.name = 'farland3d:rim'; m.frustumCulled = false; m.renderOrder = -3;
    return m;
  }

  /** 덤불 한 덩이(원뿔 셋 + 줄기)를 8 방향에서 구워 아틀라스 하나 */
  function bakeAtlas(t, renderer) {
    var W = 128, rt = new t.WebGLRenderTarget(W * VIEWS, W, { minFilter: t.LinearFilter, magFilter: t.LinearFilter });
    var sc = new t.Scene(), g = new t.Group();
    var leaf = new t.MeshLambertMaterial({ color: 0x3b6a37 }), bark = new t.MeshLambertMaterial({ color: 0x4a3a2a });
    var cones = [[0, 0.55, 0, 0.32, 0.8], [0.22, 0.4, 0.1, 0.24, 0.55], [-0.2, 0.42, -0.14, 0.22, 0.5]];
    for (var i = 0; i < cones.length; i++) { var cn = cones[i], mc = new t.Mesh(new t.ConeGeometry(cn[3], cn[4], 7), leaf); mc.position.set(cn[0], cn[1], cn[2]); g.add(mc); }
    var tr = new t.Mesh(new t.CylinderGeometry(0.04, 0.06, 0.3, 6), bark); tr.position.set(0, 0.15, 0); g.add(tr);
    sc.add(g); sc.add(new t.HemisphereLight(0xcfe3ff, 0x6b5a44, 1.0)); var dl = new t.DirectionalLight(0xfff2dc, 1.2); dl.position.set(1, 2, 1.5); sc.add(dl);
    var cam = new t.OrthographicCamera(-0.5, 0.5, 1, 0, 0.1, 10);
    var keep = { rt: renderer.getRenderTarget(), clear: renderer.getClearColor(new t.Color()), alpha: renderer.getClearAlpha(), auto: renderer.autoClear };
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.autoClear = true; renderer.clear();
    for (var vI = 0; vI < VIEWS; vI++) {
      var a = vI / VIEWS * Math.PI * 2; cam.position.set(Math.sin(a) * 5, 0.5, Math.cos(a) * 5); cam.lookAt(0, 0.5, 0); cam.updateProjectionMatrix();
      renderer.setViewport(vI * W, 0, W, W); renderer.setScissor(vI * W, 0, W, W); renderer.setScissorTest(true);
      renderer.render(sc, cam);
    }
    renderer.setScissorTest(false); renderer.setRenderTarget(keep.rt); renderer.setClearColor(keep.clear, keep.alpha); renderer.autoClear = keep.auto;
    var sz = renderer.getSize(new t.Vector2()); renderer.setViewport(0, 0, sz.x, sz.y);
    leaf.dispose(); bark.dispose(); g.traverse(function (o) { if (o.geometry) { o.geometry.dispose(); } });
    return rt;
  }

  var VS = [
    'attribute vec3 iPos; attribute float iScale; attribute float iYaw;',
    'uniform vec3 uCam; varying vec2 vUv;',
    '#include <fog_pars_vertex>',
    'void main() {',
    '  vec3 toCam = uCam - iPos; float ang = atan(toCam.x, toCam.z); float rel = ang - iYaw;',
    '  float f = rel / 6.2831853; f -= floor(f); float view = floor(mod((f + 0.5 / 8.0) * 8.0, 8.0));',
    '  vUv = vec2((uv.x + view) / 8.0, uv.y);',
    '  vec3 fwd = normalize(vec3(toCam.x, 0.0, toCam.z)); vec3 right = vec3(fwd.z, 0.0, -fwd.x);',
    '  vec3 wp = iPos + right * position.x * iScale + vec3(0.0, position.y * iScale, 0.0);',
    '  vec4 mvPosition = viewMatrix * vec4(wp, 1.0); gl_Position = projectionMatrix * mvPosition;',
    '#include <fog_vertex>',
    '}'].join('\n');
  var FS = [
    'uniform sampler2D map; uniform vec3 uTint; varying vec2 vUv;',
    '#include <fog_pars_fragment>',
    'void main() {',
    '  vec4 c = texture2D(map, vUv); if (c.a < 0.5) discard;',
    '  gl_FragColor = vec4(c.rgb * uTint, 1.0);',
    '#include <fog_fragment>',
    '}'].join('\n');

  function buildTrees(t, cx, cz) {
    var R = global.DG.relief3d, n = TREES(), inner = st.inner, outer = st.outer, cap = n, list = [], rnd = seeded(Math.round(cx) * 73856093 ^ Math.round(cz) * 19349663);
    var c0x = Math.floor((cx - outer) / CELL), c1x = Math.ceil((cx + outer) / CELL), c0z = Math.floor((cz - outer) / CELL), c1z = Math.ceil((cz + outer) / CELL);
    for (var gz = c0z; gz <= c1z && list.length < cap; gz++) {
      for (var gx = c0x; gx <= c1x && list.length < cap; gx++) {
        var x = (gx + 0.5) * CELL, z = (gz + 0.5) * CELL, d = Math.hypot(x - cx, z - cz);
        if (d < inner + 20 || d > outer - 30) { continue; }
        var kind = R && R.kindAt ? R.kindAt(gx, gz) : 'grass'; if (kind !== 'forest') { continue; }
        var jx = (rnd() - 0.5) * CELL * 0.8, jz = (rnd() - 0.5) * CELL * 0.8, px = x + jx, pz = z + jz;
        var h = R && R.on && R.on() ? R.heightAt(px, pz) : 0;
        list.push(px, h * exag(d, inner, outer, RELIEF()) - 0.2, pz, 14 + rnd() * 10, rnd() * Math.PI * 2);
      }
    }
    var m = list.length / 5, geo = new t.InstancedBufferGeometry(), plane = new t.PlaneGeometry(1, 1); plane.translate(0, 0.5, 0);
    geo.index = plane.index; geo.attributes.position = plane.attributes.position; geo.attributes.uv = plane.attributes.uv;
    var pos = new Float32Array(m * 3), scl = new Float32Array(m), yaw = new Float32Array(m);
    for (var i = 0; i < m; i++) { pos[i * 3] = list[i * 5]; pos[i * 3 + 1] = list[i * 5 + 1]; pos[i * 3 + 2] = list[i * 5 + 2]; scl[i] = list[i * 5 + 3]; yaw[i] = list[i * 5 + 4]; }
    geo.setAttribute('iPos', new t.InstancedBufferAttribute(pos, 3)); geo.setAttribute('iScale', new t.InstancedBufferAttribute(scl, 1)); geo.setAttribute('iYaw', new t.InstancedBufferAttribute(yaw, 1));
    geo.instanceCount = m;
    if (!st.mat) {
      st.mat = new t.ShaderMaterial({ uniforms: t.UniformsUtils.merge([t.UniformsLib.fog, { map: { value: null }, uCam: { value: new t.Vector3() }, uTint: { value: new t.Color(0xffffff) } }]), vertexShader: VS, fragmentShader: FS, fog: true, transparent: false });
      st.mat.uniforms.map.value = st.atlas.texture;
    }
    var mesh = new t.Mesh(geo, st.mat); mesh.frustumCulled = false; mesh.name = 'farland3d:trees'; mesh.renderOrder = -2;
    st.nTrees = m;
    return mesh;
  }

  function seeded(s) { s = s | 0; return function () { s = (s + 0x6D2B79F5) | 0; var x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }

  function rebuild(t, scene, renderer, cx, cz) {
    var t0 = performance.now();
    st.inner = innerRadius(); st.outer = KM() * 1000;
    if (st.ring) { st.group.remove(st.ring); st.ring.geometry.dispose(); st.ring.material.dispose(); }
    if (st.rim) { st.group.remove(st.rim); st.rim.geometry.dispose(); st.rim.material.dispose(); st.rim = null; }
    if (st.trees) { st.group.remove(st.trees); st.trees.geometry.dispose(); }
    if (!st.atlas && renderer) { st.atlas = bakeAtlas(t, renderer); }
    st.ring = buildRing(t, cx, cz); st.group.add(st.ring);
    if (RIM()) { st.rim = buildRim(t, cx, cz); st.group.add(st.rim); }
    if (st.atlas && TREES() > 0) { st.trees = buildTrees(t, cx, cz); st.group.add(st.trees); } else { st.trees = null; st.nTrees = 0; }
    st.cx = cx; st.cz = cz; st.ms = +(performance.now() - t0).toFixed(1);
  }

  /** 매 프레임(world3d 05-render 한 줄) — 켜져 있으면 세우고 120m 움직이면 다시 짓는다, 꺼지면 치운다 */
  function follow(scene, pos, camera, L) {
    var t = global.THREE; if (!t || !scene || !pos) { return false; }
    if (!ON()) { if (st.group) { off(); } return false; }
    if (!st.group) { st.group = new t.Group(); st.group.name = 'farland3d'; st.scene = scene; scene.add(st.group); st.camFar0 = camera ? camera.far : 0; }
    if (st.group.parent !== scene) { scene.add(st.group); st.scene = scene; }
    var W3 = global.DG.world3d, renderer = W3 && W3.rendererNode ? W3.rendererNode() : null;
    if (isNaN(st.cx) || Math.hypot(pos.x - st.cx, pos.y - st.cz) > 120 || st.outer !== KM() * 1000) { rebuild(t, scene, renderer, pos.x, pos.y); }
    var needFar = st.outer + (RIM() ? RIM_R[RIM_R.length - 1] + 300 : 300); if (camera && camera.far < needFar) { camera.far = needFar; camera.updateProjectionMatrix(); }
    if (st.rim && scene.fog && scene.fog.color) { st.rim.material.color.copy(scene.fog.color); }
    if (st.mat && camera) { st.mat.uniforms.uCam.value.copy(camera.position); if (L && L.tint !== undefined) { st.mat.uniforms.uTint.value.setHex(L.tint); } }
    return true;
  }

  function off() {
    if (!st.group) { return; }
    if (st.group.parent) { st.group.parent.remove(st.group); }
    if (st.ring) { st.ring.geometry.dispose(); st.ring.material.dispose(); } if (st.rim) { st.rim.geometry.dispose(); st.rim.material.dispose(); } if (st.trees) { st.trees.geometry.dispose(); }
    var W3 = global.DG.world3d, cam = W3 && W3.camNode ? W3.camNode() : null; if (cam && st.camFar0) { cam.far = st.camFar0; cam.updateProjectionMatrix(); }
    st.group = null; st.ring = null; st.rim = null; st.trees = null; st.cx = NaN; st.nTrees = 0;
  }

  function stats() { return { on: ON(), inner: Math.round(st.inner), outer: st.outer, trees: st.nTrees, buildMs: st.ms, atlas: !!st.atlas, rim: RIM(), relief: RELIEF(), sectors: +tn('far3d.sectors', 96), rings: +tn('far3d.rings', 20) }; }

  global.DG = global.DG || {};
  global.DG.farland3d = { follow: follow, off: off, stats: stats, fogFar: fogFar, ON: ON, KM: KM, ringPlan: ringPlan, viewOf: viewOf, exag: exag, rimH: rimH, PAL: PAL, VIEWS: VIEWS };
})(window);
