/**
 * 1만리 3D 땅 손질(W-0200) — 어깨 너머 카메라(W-0198)로 당기니 땅이 칸마다 구운 그림 한 장(≈3px/m)이라 뭉개지고,
 * 지평선이 맨 안개 띠라 깊이가 없었다. world3d.js 는 큰 파일 상한이라 여기 두고 거기선 한 줄씩만 부른다.
 *
 *   detail(mat)        땅 재질(Lambert)에 가까운 결을 더한다 — 자체 PBR 바위(K-0093 rock 512 — 흙 dirt 는 밝기 표준편차 0.008 로 무늬가 없었다)의 **밝기만** m 당 한 번 반복해 곱하고,
 *                      카메라에서 멀어지면(near~far) 사라진다. 잔결(detailRep 2.2m)만이면 11m 뒤 카메라에서 픽셀보다 작아 평균색이 돼 큰 얼룩(detailMacro 7m)을 겹친다. 색은 아래 칸 그림 그대로라 풀·흙·모래 어디에 깔려도 결만 생긴다.
 *   ridge(scene)       600~850m 고리에 절차 산 실루엣 두 겹(노이즈 높이) — 안개색에 섞어 지평선만 가린다.
 *   follow(pos, fogHex) 고리를 나를 따라 옮기고 안개색으로 물들인다(매 프레임 — 값 대입뿐).
 *   turf(scene, pos)   나 둘레 풀 칸에 잔풀(1.5m 칸마다 한 포기, InstancedMesh 하나) — 5m 움직일 때만 다시 깐다.
 * 손잡이: world3d.detail(1 켬)·detailAmt 0.6·detailNear 18·detailFar 46·detailRep 2.2·detailMacro 7(m) · sky3d.ridge(1 켬) · world3d.turf(1 켬)·turfR 40(m, MEDIUM ×0.65, LOW 없음) · world3d.turfSeason(1, W-0209)·turfSway 0.07·seasonGround 0.5 · world3d.windMul(1 — 바람 ×2.2·비 ×1.4, W-0210)
 */
(function (global) {
  'use strict';
  var core = global.DG.core;
  function T() { return global.THREE; }
  function tn(k, d) { var v = core && core.tuned ? core.tuned(k, d) : d; return v; }
  function DETAIL_ON() { return !!+tn('world3d.detail', 1); }
  function RIDGE_ON() { return !!+tn('sky3d.ridge', 1); }

  var detailTex = null;
  function detailMap() {
    if (detailTex || !T()) { return detailTex; }
    detailTex = new (T().TextureLoader)().load('assets/textures/land/real_rock_512.webp');
    detailTex.wrapS = detailTex.wrapT = T().RepeatWrapping;
    if (T().SRGBColorSpace) { detailTex.colorSpace = T().NoColorSpace; }   // 밝기만 쓴다 — 감마 변환 없이
    return detailTex;
  }

  /** 순수 — 거리 d(m)에서 결이 얼마나 먹나(0~amt). 진단이 그대로 부른다 */
  function weightAt(d, amt, near, far) {
    if (!(far > near)) { return 0; }
    var t = Math.max(0, Math.min(1, (d - near) / (far - near)));
    return amt * (1 - t * t * (3 - 2 * t));
  }

  /** 땅 재질에 결을 단다(한 번만 — 셰이더 이어 붙이기는 재질마다 한 번) */
  function detail(mat) {
    if (!mat || mat.userData.groundDetail || !DETAIL_ON() || !T()) { return false; }
    var map = detailMap();
    if (!map) { return false; }
    mat.userData.groundDetail = true;
    var U = {
      gDetail: { value: map },
      gAmt: { value: +tn('world3d.detailAmt', 0.6) },
      gNear: { value: +tn('world3d.detailNear', 18) },
      gFar: { value: +tn('world3d.detailFar', 46) },
      gRep: { value: 1 / Math.max(0.2, +tn('world3d.detailRep', 2.2)) },
      gMac: { value: 1 / Math.max(1, +tn('world3d.detailMacro', 7)) }
    };
    mat.onBeforeCompile = function (sh) {
      for (var k in U) { if (Object.prototype.hasOwnProperty.call(U, k)) { sh.uniforms[k] = U[k]; } }
      sh.vertexShader = 'varying vec3 vGW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n  vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform sampler2D gDetail;\nuniform float gAmt, gNear, gFar, gRep, gMac;\nvarying vec3 vGW;\n' +
        sh.fragmentShader.replace('#include <map_fragment>', [
          '#include <map_fragment>',
          '  {',
          '    float gd = distance(vGW, cameraPosition);',
          '    float gt = clamp((gd - gNear) / max(1.0, gFar - gNear), 0.0, 1.0);',
          '    float gw = gAmt * (1.0 - gt * gt * (3.0 - 2.0 * gt));',
          '    float gl = dot(texture2D(gDetail, vGW.xz * gRep).rgb, vec3(0.2126, 0.7152, 0.0722));',
          '    float gm = dot(texture2D(gDetail, vGW.zx * gMac + 0.37).rgb, vec3(0.2126, 0.7152, 0.0722));',
          '    float gv = (gl - 0.56) * 2.0 + (gm - 0.56) * 1.6;',   // 잔결 2.2m + 큰 얼룩 7m(엇갈린 축) — 바위 평균 밝기 ≈0.56 을 0 으로
          '    diffuseColor.rgb *= mix(1.0, clamp(1.0 + gv, 0.45, 1.6), gw);',
          '  }'].join('\n'));
    };
    mat.customProgramCacheKey = function () { return 'ground3d-detail'; };
    mat.needsUpdate = true;
    return true;
  }

  /* ── 먼 산 고리 ───────────────────────────────────────── */
  function h1(i, s) { var x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); }
  function noise1(a, s) { var i = Math.floor(a), f = a - i, u = f * f * (3 - 2 * f); return h1(i, s) * (1 - u) + h1(i + 1, s) * u; }
  /** 순수 — 고리 각 θ(0~2π)에서 산 높이(m). 겹 layer 0 은 가깝고 낮게, 1 은 멀고 높게 */
  function ridgeH(theta, layer) {
    var a = theta / (Math.PI * 2) * 48, s = layer * 31 + 7;
    var v = noise1(a, s) * 0.6 + noise1(a * 2.3, s + 3) * 0.3 + noise1(a * 5.1, s + 9) * 0.1;
    return (layer ? 70 : 38) + v * (layer ? 150 : 85);
  }

  var ring = null;
  function ridge(scene) {
    if (ring) { if (scene && ring.parent !== scene) { scene.add(ring); } return ring; }   // 씬을 다시 지으면 옛 씬에 남지 않게
    if (!scene || !RIDGE_ON() || !T()) { return ring; }
    var t = T(), g = new t.Group(), SEG = 180;
    for (var L = 0; L < 2; L++) {
      var R = L ? 850 : 640, pos = [], idx = [], i;
      for (i = 0; i <= SEG; i++) {
        var th = i / SEG * Math.PI * 2, x = Math.cos(th) * R, z = Math.sin(th) * R;
        pos.push(x, -20, z, x, ridgeH(th, L), z);
        if (i < SEG) { var b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
      }
      var geo = new t.BufferGeometry();
      geo.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      var m = new t.Mesh(geo, new t.MeshBasicMaterial({ color: 0x8a96a6, side: t.DoubleSide, fog: false, depthWrite: false }));
      m.renderOrder = -2 + L; m.frustumCulled = false; m.userData.layer = L;
      g.add(m);
    }
    g.name = 'ridge3d';
    scene.add(g);
    ring = g;
    return ring;
  }

  var tmpA = null, tmpB = null;
  function follow(pos, fogHex, bgHex) {
    if (!ring || !pos) { return; }
    ring.visible = RIDGE_ON();
    ring.position.set(pos.x, 0, pos.y);
    if (!T()) { return; }
    tmpA = tmpA || new (T().Color)(); tmpB = tmpB || new (T().Color)();
    tmpA.setHex(fogHex || 0x9aa6b5); tmpB.setHex(bgHex || fogHex || 0x9aa6b5);
    for (var i = 0; i < ring.children.length; i++) {
      var m = ring.children[i];
      m.material.color.copy(tmpA).lerp(tmpB, m.userData.layer ? 0.55 : 0.2).multiplyScalar(m.userData.layer ? 0.86 : 0.74);   // 가까운 겹이 더 짙다(대기 원근)
    }
  }

  /* ── 발밑 잔풀 ─────────────────────────────────────────
     칸(48m)마다 세우는 풀덤불은 ×4 해도 0~12 포기라 들이 비어 보였다(옛/새 촬영 차이 거의 없음).
     나 둘레만 1.5m 칸마다 한 포기씩 — InstancedMesh 하나, 5m 움직일 때만 다시 깐다. HIGH 40m · MEDIUM 26m · LOW 없음 */
  var TURF_STEP = 1.5;
  function TURF_R() {
    var P = global.DG.perf, m = P && P.mul ? P.mul('prop') : 1;
    if (!+tn('world3d.turf', 1) || m < 0.3) { return 0; }
    return +tn('world3d.turfR', 40) * (m >= 1 ? 1 : 0.65);
  }
  /** 순수 — (cx,cz) 둘레 R 안 잔풀 자리. isGrass(x,z) 참인 곳만, 칸마다 6할 · s = 크기(가장자리 1/4 에서 줄어 둥근 테가 안 보이게) */
  function turfSpots(cx, cz, R, isGrass, cap) {
    var out = [], st = TURF_STEP, i0 = Math.floor((cx - R) / st), i1 = Math.ceil((cx + R) / st), j0 = Math.floor((cz - R) / st), j1 = Math.ceil((cz + R) / st), i, j;
    for (i = i0; i <= i1; i++) {
      for (j = j0; j <= j1; j++) {
        if (h1(i * 1.7, j * 3.1) > 0.6) { continue; }
        var x = (i + h1(i, j + 5)) * st, z = (j + h1(i + 9, j)) * st, d = Math.hypot(x - cx, z - cz);
        if (d > R || !isGrass(x, z)) { continue; }
        var e = d / R, edge = e < 0.75 ? 1 : Math.max(0.15, 1 - (e - 0.75) / 0.25);
        out.push({ x: x, z: z, s: (0.6 + h1(i + 3, j + 7) * 0.7) * edge, r: h1(i + 11, j + 13) * 6.283, c: h1(i + 5, j + 2) });
        if (out.length >= cap) { return out; }
      }
    }
    return out;
  }
  /** 다섯 잎 한 포기 — 밑은 어둡고 끝은 밝게(정점색), 법선은 위로(땅과 같은 빛을 받게) · 잎 한 장 = 삼각형 앞뒤 둘 */
  function bladeGeo() {
    var t = T(), pos = [], col = [], nor = [], k;
    for (k = 0; k < 5; k++) {
      var a = k / 5 * Math.PI * 2 + 0.3, ca = Math.cos(a), sa = Math.sin(a), w = 0.07, h = 0.5 + (k % 3) * 0.17, ln = 0.24 * h, bx = ca * 0.06, bz = sa * 0.06;
      var L0 = [bx + sa * w, 0, bz - ca * w], R0 = [bx - sa * w, 0, bz + ca * w], TP = [bx + ca * ln, h, bz + sa * ln];
      pos.push.apply(pos, L0.concat(R0, TP, R0, L0, TP));   // 앞뒤 두 장 — DoubleSide 는 뒷면 법선을 아래로 뒤집어 한쪽이 검었다
      col.push(0.72, 0.72, 0.72, 0.72, 0.72, 0.72, 1, 1, 1, 0.72, 0.72, 0.72, 0.72, 0.72, 0.72, 1, 1, 1);
      for (var nn = 0; nn < 6; nn++) { nor.push(0, 1, 0); }
    }
    var g = new t.BufferGeometry();
    g.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new t.Float32BufferAttribute(col, 3));
    g.setAttribute('normal', new t.Float32BufferAttribute(nor, 3));
    return g;
  }
  /** W-0209 순수 — 계절 열쇠 → 잔풀 밑·끝 색. 여름 = W-0200 옛 값 그대로 · 손잡이 world3d.turfSeason 0 이면 늘 여름 */
  var TURF_PAL = { spring: [0x67a238, 0xb2d65e], summer: [0x5e9c2e, 0x9cc94a], autumn: [0x8a7a32, 0xc9b25c], winter: [0x76806c, 0xb3baa6] };
  function turfPal(key) { var p = (+tn('world3d.turfSeason', 1) && TURF_PAL[key]) || TURF_PAL.summer; return { lo: p[0], hi: p[1] }; }
  function seasonKey() { var S = global.DG.season; return S && S.now ? S.now().key : 'summer'; }
  /** W-0210 순수 — 천후 열쇠 → 흔들림 배율(바람 2.2·비 1.4·그 밖 1). 잔풀과 도형 나무·풀덤불(world3d SWAY_AMT)이 같이 쓴다 · 손잡이 world3d.windMul 0 이면 늘 1 */
  function windMul(wx) { return +tn('world3d.windMul', 1) ? (wx === 'wind' ? 2.2 : (wx === 'rain' ? 1.4 : 1)) : 1; }
  var windMemo = { k: null, v: '' };
  function windNow() {
    var WX = global.DG.weather; if (!WX || !WX.current) { return ''; }
    var k = (WX.forced ? WX.forced.key : '-') + ':' + Math.floor(Date.now() / 10000);   // 천후는 3시간 칸 — 10초에 한 번 다시 물어도 충분, 강제는 바로
    if (windMemo.k !== k) { var c = WX.current(); windMemo = { k: k, v: c ? c.key : '' }; }
    return windMemo.v;
  }
  /** W-0209 순수 — 천후 열쇠 → 잔풀 흔들림 폭(정점 높이 배율). world3d.sway 0 이면 0 */
  function turfSway(wx) {
    if (!+tn('world3d.sway', 1)) { return 0; }
    return Math.max(0, +tn('world3d.turfSway', 0.07) || 0) * windMul(wx);
  }
  /** W-0209 — 땅 그림(world3d terrainTexture)이 칸 무늬 위에 계절 색을 얹는 법. 봄·가을·겨울 들·논밭만 덮어 칠하기(손잡이 world3d.seasonGround 0.5),
   *  그 밖(여름·길·숲·산·물·계절 꺼짐)은 null — 옛 곱하기 30% 그대로 */
  function seasonPaint(kind, key) {
    var S = global.DG.season, a = +tn('world3d.seasonGround', 0.5) || 0;
    key = key || (S && S.on && S.on() ? seasonKey() : 'summer');
    return (kind === 'grass' || kind === 'farm') && key !== 'summer' && TURF_PAL[key] && a > 0 ? { a: Math.min(1, a), op: 'source-over' } : null;
  }
  var swayU = null;
  function swayTurf(mat) {
    swayU = { uT: { value: 0 }, uA: { value: 0 } };
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uTfT = swayU.uT; sh.uniforms.uTfA = swayU.uA;
      sh.vertexShader = 'uniform float uTfT;\nuniform float uTfA;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n' +
        '#ifdef USE_INSTANCING\n  float tfPh = dot(instanceMatrix[3].xz, vec2(0.37, 0.53));\n#else\n  float tfPh = 0.0;\n#endif\n' +
        '  float tfL = transformed.y * transformed.y * uTfA;\n' +   // 밑동은 그대로, 끝일수록 크게
        '  transformed.x += (sin(uTfT * 2.1 + tfPh) + 0.35 * sin(uTfT * 5.3 + tfPh * 1.7)) * tfL;\n' +
        '  transformed.z += cos(uTfT * 1.7 + tfPh) * tfL * 0.6;\n');
    };
    mat.customProgramCacheKey = function () { return 'turf-sway'; };
  }
  var turfMesh = null, turfAt = null, turfCells = {}, TURF_CAP = 1800;
  function cellGrass(x, z) {
    var gx = Math.floor(x / 48), gy = Math.floor(z / 48), k = gx + ':' + gy;
    if (!(k in turfCells)) {
      var W = global.DG.world, FR = global.DG.frost;
      turfCells[k] = !!(W && W.terrainAt && W.terrainAt(gx, gy) === 'grass') && !(FR && FR.treeSnow && FR.treeSnow((gx + 0.5) * 48, (gy + 0.5) * 48) > 0);
    }
    return turfCells[k];
  }
  function turf(scene, pos) {
    var R = TURF_R();
    if (!scene || !pos || !T()) { return 0; }
    if (!R) { if (turfMesh) { turfMesh.visible = false; } return 0; }
    var t = T();
    if (!turfMesh) {
      var tm = new t.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }); swayTurf(tm);
      turfMesh = new t.InstancedMesh(bladeGeo(), tm, TURF_CAP);
      turfMesh.name = 'turf3d'; turfMesh.frustumCulled = false; turfMesh.receiveShadow = true; turfMesh.count = 0;
    }
    if (turfMesh.parent !== scene) { scene.add(turfMesh); turfAt = null; }
    turfMesh.visible = true;
    var now = global.performance ? global.performance.now() : Date.now();   // W-0209 바람 — 값 대입뿐(매 프레임)
    swayU.uT.value = (now / 1000) % 3600; swayU.uA.value = turfSway(windNow());
    var sk = seasonKey();
    if (turfAt && turfAt.R === R && turfAt.sk === sk && Math.hypot(pos.x - turfAt.x, pos.y - turfAt.y) < 5) { return turfMesh.count; }
    turfAt = { x: pos.x, y: pos.y, R: R, sk: sk };   // W-0209 계절이 바뀌면 서 있어도 다시 깐다(색)
    if (Object.keys(turfCells).length > 400) { turfCells = {}; }
    var pal = turfPal(sk), sp = turfSpots(pos.x, pos.y, R, cellGrass, TURF_CAP), RL = global.DG.relief3d, m4 = new t.Matrix4(), q = new t.Quaternion(), up = new t.Vector3(0, 1, 0), v = new t.Vector3(), sc = new t.Vector3(), c = new t.Color(), lo = new t.Color(pal.lo), hi = new t.Color(pal.hi), i;
    for (i = 0; i < sp.length; i++) {
      var p = sp[i];
      q.setFromAxisAngle(up, p.r); v.set(p.x, RL && RL.heightAt ? RL.heightAt(p.x, p.z) : 0, p.z); sc.set(p.s, p.s * (0.8 + p.c * 0.5), p.s);
      turfMesh.setMatrixAt(i, m4.compose(v, q, sc));
      turfMesh.setColorAt(i, c.copy(lo).lerp(hi, p.c));
    }
    turfMesh.count = sp.length;
    turfMesh.instanceMatrix.needsUpdate = true;
    if (turfMesh.instanceColor) { turfMesh.instanceColor.needsUpdate = true; }
    return sp.length;
  }

  global.DG = global.DG || {};
  global.DG.ground3d = { detail: detail, weightAt: weightAt, ridge: ridge, ridgeH: ridgeH, follow: follow, turf: turf, turfSpots: turfSpots, turfPal: turfPal, turfSway: turfSway, seasonPaint: seasonPaint, windMul: windMul, windNow: windNow };
})(window);
