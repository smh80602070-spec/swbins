/**
 * weather3d — 날씨·빛 (W-0310 ②): GPU 파티클 비·눈 2만 + 바람 + 번개 섬광 + 해 빛줄기.
 *
 *   파티클은 `Points` 한 덩이 — 자리·떨어짐·바람은 전부 정점 셰이더가 시간(uTime)으로 계산하고, CPU 는 프레임마다
 *   uniform 셋(시간·중심·바람)만 쓴다(2만 개라도 그리기 1번). 상자(폭 W·높이 H)는 카메라를 따라다니고,
 *   y 는 mod 로 되감겨 끝없이 내린다. 비는 세로 줄(gl_PointSize 작고 길쭉한 알파), 눈은 둥근 점이 좌우로 흔들린다.
 *   번개: 비일 때 6~14초마다 두 번 깜빡이는 AmbientLight(0.15초) — 빛줄기: 해 방향으로 누운 가산(additive) 판 8장,
 *   흐림·안개·비·눈에서만 보이고(맑음은 0) 해가 낮으면 길어진다.
 *
 *   쓰는 법:  var w = DG.weather3d.make(three, { n: 20000 });  W3.addFx(w.group);
 *            매 프레임 w.update(dt, camera, light, kind)   (kind = DG.weather 의 key: clear·cloud·rain·wind·fog·snow)
 *   손잡이: weather3d.on(본 게임 기본 0 — 시연·W-0310 ⑧ 뒤 켠다) · weather3d.n(20000) · weather3d.shafts(1) · weather3d.bolt(1)
 */
(function (global) {
  'use strict';

  function tn(k, d) { var c = global.DG && global.DG.core; return c && c.tuned ? c.tuned(k, d) : d; }
  function ON() { return tn('weather3d.on', 0) ? true : false; }
  function N() { return tn('weather3d.n', 20000); }
  function SHAFTS() { return tn('weather3d.shafts', 1) ? true : false; }
  function BOLT() { return tn('weather3d.bolt', 1) ? true : false; }

  var VERT = [
    'uniform float uTime; uniform vec3 uCenter; uniform vec3 uWind; uniform float uKind; uniform float uFall; uniform float uSize; uniform float uW; uniform float uH;',
    'attribute float aSeed;',
    'varying float vAlpha;',
    'void main() {',
    '  vec3 p = position;',
    '  float t = uTime * uFall * (0.7 + 0.6 * aSeed);',
    '  float sway = uKind > 0.5 ? sin(uTime * 1.3 + aSeed * 31.0) * 0.6 : 0.0;',
    '  p.x += uWind.x * uTime + sway; p.z += uWind.z * uTime;',
    '  p.y -= t;',
    '  p.x = mod(p.x - uCenter.x + uW * 0.5, uW) - uW * 0.5 + uCenter.x;',
    '  p.z = mod(p.z - uCenter.z + uW * 0.5, uW) - uW * 0.5 + uCenter.z;',
    '  p.y = mod(p.y - uCenter.y + uH, uH) + uCenter.y;',   // 카메라 높이 위 0~H 에서 되감긴다
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  float d = -mv.z;',
    '  gl_PointSize = uSize * (uKind > 0.5 ? 0.7 + 0.6 * aSeed : 1.0) * clamp(40.0 / max(d, 1.0), 0.5, uKind > 0.5 ? 2.2 : 4.0);',   // 눈은 코앞에서도 2.2배까지만(큰 덩어리 방지)
    '  vAlpha = clamp(1.0 - d / (uW * 0.75), 0.0, 1.0) * (0.55 + 0.45 * aSeed);',
    '  gl_Position = projectionMatrix * mv;',
    '}'].join('\n');
  var FRAG = [
    'uniform float uKind; uniform vec3 uColor; uniform float uOpacity;',
    'varying float vAlpha;',
    'void main() {',
    '  vec2 c = gl_PointCoord - 0.5;',
    '  float a;',
    '  if (uKind > 0.5) { a = smoothstep(0.5, 0.15, length(c)); }',                       // 눈 — 둥글고 부드럽게
    '  else { a = smoothstep(0.5, 0.0, abs(c.x) * 6.0) * smoothstep(0.5, 0.35, abs(c.y)); }',   // 비 — 가늘고 긴 세로 줄
    '  gl_FragColor = vec4(uColor, a * vAlpha * uOpacity);',
    '  if (gl_FragColor.a < 0.02) discard;',
    '}'].join('\n');

  var SHAFT_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  var SHAFT_FRAG = 'uniform float uA; uniform vec3 uColor; varying vec2 vUv; void main(){ float x = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x); float y = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.6, vUv.y); gl_FragColor = vec4(uColor, uA * x * y); }';

  function make(t, o) {
    o = o || {};
    var n = o.n || N(), W = o.width || 70, H = o.height || 36;
    var geo = new t.BufferGeometry(), pos = new Float32Array(n * 3), seed = new Float32Array(n), rnd = o.rnd || Math.random;
    for (var i = 0; i < n; i++) { pos[i * 3] = (rnd() - 0.5) * W; pos[i * 3 + 1] = rnd() * H; pos[i * 3 + 2] = (rnd() - 0.5) * W; seed[i] = rnd(); }
    geo.setAttribute('position', new t.BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new t.BufferAttribute(seed, 1));
    var mat = new t.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCenter: { value: new t.Vector3() }, uWind: { value: new t.Vector3() }, uKind: { value: 0 }, uFall: { value: 14 }, uSize: { value: 2.2 }, uW: { value: W }, uH: { value: H }, uColor: { value: new t.Color(0xdfe8f5) }, uOpacity: { value: 0.75 } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: true, blending: t.NormalBlending
    });
    var points = new t.Points(geo, mat); points.frustumCulled = false; points.visible = false; points.name = 'weather3d:drops';
    var group = new t.Group(); group.name = 'weather3d'; group.add(points);
    /* 번개 — 장면 전체를 잠깐 밝힌다 */
    var bolt = new t.AmbientLight(0xeaf0ff, 0); group.add(bolt);
    /* 빛줄기 8장 — 해 방향으로 누운 긴 판, 가산 */
    var shafts = new t.Group(); shafts.name = 'weather3d:shafts'; group.add(shafts);
    var shaftMat = new t.ShaderMaterial({ uniforms: { uA: { value: 0 }, uColor: { value: new t.Color(0xfff2cc) } }, vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG, transparent: true, depthWrite: false, blending: t.AdditiveBlending, side: t.DoubleSide });
    var shaftGeo = new t.PlaneGeometry(3, 60), k;
    for (k = 0; k < 8; k++) { var pl = new t.Mesh(shaftGeo, shaftMat); pl.frustumCulled = false; shafts.add(pl); }
    var time = 0, nextBolt = 6 + Math.random() * 8, boltT = -1, kindNow = 'clear', center = new t.Vector3(), sunDir = new t.Vector3(0, 1, 0);

    function setKind(kind) {
      kindNow = kind;
      var rain = kind === 'rain', snow = kind === 'snow', wind = kind === 'wind';
      points.visible = rain || snow;
      mat.uniforms.uKind.value = snow ? 1 : 0;
      mat.uniforms.uFall.value = snow ? 1.6 : 14;
      mat.uniforms.uSize.value = snow ? 3.2 : 2.2;
      mat.uniforms.uOpacity.value = snow ? 0.9 : 0.7;
      mat.uniforms.uColor.value.set(snow ? 0xffffff : 0xd8e4f4);
      mat.uniforms.uWind.value.set(wind || rain ? 4.5 : (snow ? 1.2 : 0), 0, wind ? 3.5 : 0.8);
    }
    function update(dt, camera, light, kind) {
      if (kind !== kindNow) { setKind(kind); }
      time += dt; mat.uniforms.uTime.value = time;
      if (camera) {
        /* 상자 중심 = 카메라 앞 10m, 높이는 카메라 밑 6m 부터(화면 아래 땅까지 내린다) */
        var dir = new t.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
        center.copy(camera.position).addScaledVector(dir, 12); center.y = camera.position.y - 6;
        mat.uniforms.uCenter.value.copy(center);
      }
      /* 번개 — 비에서만. 두 번 깜빡(0.08 + 0.07초) */
      if (BOLT() && kindNow === 'rain') {
        if (boltT < 0) { nextBolt -= dt; if (nextBolt <= 0) { boltT = 0; nextBolt = 6 + Math.random() * 8; } }
        else { boltT += dt; var f = boltT < 0.08 ? 1 : (boltT < 0.13 ? 0.15 : (boltT < 0.2 ? 0.8 : 0)); bolt.intensity = f * 2.4; if (boltT > 0.25) { boltT = -1; bolt.intensity = 0; } }
      } else { bolt.intensity = 0; }
      /* 빛줄기 — 해가 떠 있고(alt>0.08) 흐림·안개·비·눈일 때. 해 방향으로 눕히고 카메라 둘레 반경 12~30m 에 둥글게 */
      var L = light, alt = L && L.sun ? L.sun.y / Math.max(1, Math.hypot(L.sun.x, L.sun.y, L.sun.z)) : 0;
      var want = SHAFTS() && alt > 0.08 && (kindNow === 'cloud' || kindNow === 'fog' || kindNow === 'rain' || kindNow === 'snow') ? (kindNow === 'fog' ? 0.22 : 0.14) * (1 - Math.min(1, alt)) * 1.6 : 0;
      shaftMat.uniforms.uA.value += (want - shaftMat.uniforms.uA.value) * Math.min(1, dt * 2);
      shafts.visible = shaftMat.uniforms.uA.value > 0.005;
      if (shafts.visible && L && L.sun) {
        sunDir.set(L.sun.x, L.sun.y, L.sun.z).normalize();
        for (k = 0; k < 8; k++) {
          var pl = shafts.children[k], a = k / 8 * Math.PI * 2 + time * 0.01, r = 14 + (k % 3) * 7;
          pl.position.set(center.x + Math.cos(a) * r, center.y + 6 + 18, center.z + Math.sin(a) * r);
          pl.quaternion.setFromUnitVectors(new t.Vector3(0, 1, 0), sunDir);
          pl.rotateY(a);
        }
      }
    }
    function dispose() { geo.dispose(); mat.dispose(); shaftGeo.dispose(); shaftMat.dispose(); }
    setKind('clear');
    return { group: group, update: update, dispose: dispose, n: n, kind: function () { return kindNow; }, _points: points, _shafts: shafts, _bolt: bolt };
  }

  global.DG = global.DG || {};
  global.DG.weather3d = { make: make, ON: ON, N: N, SHAFTS: SHAFTS, BOLT: BOLT };
})(window);
