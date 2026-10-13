/**
 * 1만리 3D 땅 손질(W-0200) — 어깨 너머 카메라(W-0198)로 당기니 땅이 칸마다 구운 그림 한 장(≈3px/m)이라 뭉개지고,
 * 지평선이 맨 안개 띠라 깊이가 없었다. world3d.js 는 큰 파일 상한이라 여기 두고 거기선 한 줄씩만 부른다.
 *
 *   detail(mat)        땅 재질(Lambert)에 가까운 결을 더한다 — 자체 PBR 바위(K-0093 rock 512 — 흙 dirt 는 밝기 표준편차 0.008 로 무늬가 없었다)의 **밝기만** m 당 한 번 반복해 곱하고,
 *                      카메라에서 멀어지면(near~far) 사라진다. 잔결(detailRep 2.2m)만이면 11m 뒤 카메라에서 픽셀보다 작아 평균색이 돼 큰 얼룩(detailMacro 7m)을 겹친다. 색은 아래 칸 그림 그대로라 풀·흙·모래 어디에 깔려도 결만 생긴다.
 *   ridge(scene)       600~850m 고리에 절차 산 실루엣 두 겹(노이즈 높이) — 안개색에 섞어 지평선만 가린다.
 *   follow(pos, fogHex) 고리를 나를 따라 옮기고 안개색으로 물들인다(매 프레임 — 값 대입뿐).
 * 손잡이: world3d.detail(1 켬)·detailAmt 0.6·detailNear 18·detailFar 46·detailRep 2.2·detailMacro 7(m) · sky3d.ridge(1 켬)
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
    if (ring || !scene || !RIDGE_ON() || !T()) { return ring; }
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

  global.DG = global.DG || {};
  global.DG.ground3d = { detail: detail, weightAt: weightAt, ridge: ridge, ridgeH: ridgeH, follow: follow };
})(window);
