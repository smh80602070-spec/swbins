/**
 * 툰 재질 공용 부품 — SAGA-DESIGN §6.0/§6.1 적용
 * ---------------------------------------------------------------
 * `realm3d.js`(지형·바다·소품)·`battle3d.js`(깃발·전장 바닥)·`city3d.js`(성 안
 * 바닥)와 `asset3d.js`(GLB 인물·짐승·건물을 벗기는 `delam()`, 대역 프리미티브,
 * 세력 깃발)가 같은 규격의 3단 램프 툰 재질을 쓰게 한다.
 *
 *   ramp()            3단 그라디언트 맵(MeshToonMaterial.gradientMap)
 *   lambertLike(opts)  `new MeshLambertMaterial(opts)` 자리를 그대로 대신한다
 *   toonify(material)  이미 만든 재질(Standard/Physical 등)을 툰으로 바꿔 낸다
 *
 * **바다·강(`MeshPhongMaterial`)과 길·안개 등 `MeshBasicMaterial` 자리는
 * 건드리지 않는다** — 반투명·언라이트 표현이라 툰 램프와 무관하다.
 *
 * 외곽선은 2026-09-23 에 넣었다 — 사람·짐승(스킨 메시 GLB)만, 아래 `outline()` 머리말 참고.
 * 톤매핑(`toneRenderer`)도 같은 날 — 세 화면이 렌더러를 만든 직후 부른다.
 *
 * three 가 없으면(자가진단) 아무 것도 안 한다 — 판정에는 한 줄도 안 닿는다.
 */
(function (global) {
  'use strict';

  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }

  /* 램프·툰/림 손잡이·림 라이트는 shared/js/toon3d-core.js (W-0019) */
  var K = global.DG.toon3dCore;
  var ramp = K.ramp, TOON_ON = K.TOON_ON, RIM_ON = K.RIM_ON, applyRimLight = K.applyRimLight;





  /** 재질 사본 — three 의 `clone()` 은 `onBeforeCompile`(림·VRoid 얼굴 그림자 셰이더)을 안 옮겨 사본이 맨 툰으로
   *  떨어진다(2026-09-23). 맞으면 번쩍이는 사본(`ownAllMat`)·반투명 사본 등 배우 재질을 떼어 올 때 이걸 쓴다 */
  function cloneMat(src) {
    var m = src.clone();
    var own = Object.prototype.hasOwnProperty;
    if (own.call(src, 'onBeforeCompile')) { m.onBeforeCompile = src.onBeforeCompile; }
    if (own.call(src, 'customProgramCacheKey')) { m.customProgramCacheKey = src.customProgramCacheKey; }
    return m;
  }

  /**
   * 톤매핑("고품질 셀 셰이딩급" 3단계, 2026-09-23) — 다른 네 판은 `post3d`/마을 화면에서 Neutral 을 켜 두었는데 이 판 세 화면
   * (국토 지도·전투 디오라마·성 안)만 톤매핑 없이 약한 빛(반구 0.95·해 1.0)으로 그려 전체가 탁한 올리브빛이었다.
   * Neutral(Khronos PBR Neutral)은 0.76 아래를 거의 그대로 두고 밝은 쪽만 눌러 주므로 빛을 `lightGain()` 배 올려도
   * 하이라이트가 하얗게 안 날아간다. ACES 는 VRoid 살색을 탈색시켜(초상 스크린샷) 안 쓴다.
   * 손잡이: `world3d.tone`(0 이면 예전 그대로 — 톤매핑 없음·빛 배수 1), `world3d.exposure`, `world3d.lightGain`.
   */
  function TONE_ON() {
    var core = global.DG && global.DG.core;
    return core && core.tuned ? (core.tuned('world3d.tone', 1) ? true : false) : true;
  }
  function toneRenderer(renderer) {
    var t = three(), core = global.DG && global.DG.core;
    if (!t || !renderer || !TONE_ON() || t.NeutralToneMapping === undefined) { return renderer; }
    renderer.toneMapping = t.NeutralToneMapping;
    renderer.toneMappingExposure = core && core.tuned ? core.tuned('world3d.exposure', 1) : 1;
    return renderer;
  }
  function lightGain() {
    var core = global.DG && global.DG.core;
    if (!TONE_ON()) { return 1; }
    return core && core.tuned ? core.tuned('world3d.lightGain', 1.5) : 1.5;
  }

  /** 하늘 그라디언트 손잡이 — 0 이면 예전 단색 배경 */
  function SKY_ON() {
    var core = global.DG && global.DG.core;
    return core && core.tuned ? (core.tuned('world3d.skyGrad', 1) ? true : false) : true;
  }

  /**
   * 하늘 그라디언트 배경("고품질 셀 셰이딩급" 요청 2단계, 2026-09-23) — 단색 `scene.background` 를 화면 세로 그라디언트 텍스처로 바꾼다.
   * 사가마을은 카메라를 따라다니는 구(`makeSkyDome`)를 쓰지만, 여기선 배경 텍스처 한 장이라 드로우콜·카메라 추적이 없다.
   * 아래 35% 는 지평선색(= 이 판이 안개색으로 쓰는 그 색) 그대로라 안개와 이음매가 안 생기고, 위로 갈수록 짙어진다 —
   * 밝은 하늘은 깊은 파랑 쪽으로, 어두운 하늘(굴·불 골짜기)은 같은 색을 반쯤 어둡게. 색마다 한 장만 만들어 캐싱한다.
   * 손잡이가 꺼져 있거나 three 가 없으면 예전과 같은 `Color` 를 돌려준다. 렌더 결과는 실기 확인 몫.
   */
  var skyCache = {};
  function skyBackground(hex) {
    var t = three();
    if (!t) { return null; }
    if (!SKY_ON() || !t.DataTexture) { return new t.Color(hex); }
    var key = String(hex >>> 0);
    if (skyCache[key]) { return skyCache[key]; }
    var H = 64, data = new Uint8Array(H * 4), i;
    var r0 = (hex >> 16) & 255, g0 = (hex >> 8) & 255, b0 = hex & 255;
    var lum = (0.299 * r0 + 0.587 * g0 + 0.114 * b0) / 255, r1, g1, b1;
    if (lum > 0.35) { r1 = r0 + (0x3a - r0) * 0.55; g1 = g0 + (0x6c - g0) * 0.55; b1 = b0 + (0xc8 - b0) * 0.55; }
    else { r1 = r0 * 0.5; g1 = g0 * 0.5; b1 = b0 * 0.5; }
    for (i = 0; i < H; i++) {
      var v = i / (H - 1), s = v < 0.35 ? 0 : (v - 0.35) / 0.65;
      s = s * s * (3 - 2 * s);
      data[i * 4] = Math.round(r0 + (r1 - r0) * s);
      data[i * 4 + 1] = Math.round(g0 + (g1 - g0) * s);
      data[i * 4 + 2] = Math.round(b0 + (b1 - b0) * s);
      data[i * 4 + 3] = 255;
    }
    var tex = new t.DataTexture(data, 1, H, t.RGBAFormat);   // 0 번 줄 = 화면 아래(지평선)
    tex.magFilter = t.LinearFilter;
    tex.minFilter = t.LinearFilter;
    if (t.SRGBColorSpace) { tex.colorSpace = t.SRGBColorSpace; }
    tex.needsUpdate = true;
    tex.userData = { skyHorizon: hex >>> 0 };
    skyCache[key] = tex;
    return tex;
  }

  /** 기존 재질 하나를 3단 툰 재질로 — 빛깔·맵·투명만 옮긴다(PBR 값은 버린다) */
  function toonify(src) {
    var t = three();
    if (!t || !src) { return src; }
    if (Array.isArray(src)) { return src.map(toonify); }
    if (src.isMeshToonMaterial) { return src; }
    return new t.MeshToonMaterial({
      color: src.color ? src.color.clone() : new t.Color(0xffffff),
      map: src.map || null,
      vertexColors: !!src.vertexColors,
      transparent: !!src.transparent,
      opacity: src.opacity === undefined ? 1 : src.opacity,
      alphaTest: src.alphaTest || 0,
      side: src.side === undefined ? t.FrontSide : src.side,
      gradientMap: ramp()
    });
  }

  /* ── 외곽선("고품질 셀 셰이딩급" 3단계, 2026-09-23) ─────────────────────────────────────────────────────────
   * 다섯 판 중 이 판만 판 외곽선이 없었다(VRoid 장수는 `vroid-variant.js` 가 제 외곽선을 따로 두른다).
   * 사가종횡 `toon3d.js` 방식을 그대로 옮겼다 — 뒤집힌 헐을 **매끈한 외곽선 법선**(같은 자리 꼭짓점끼리 평균)
   * 방향으로 밀어 로우폴리 면이 벌어져 톱니·점선이 되지 않게. 폭만 다르다 — 사가종횡처럼 지오메트리 단위(부품 반지름 × K)로
   * 밀었더니 몬스터 GLB 에서 몸의 몇십 배로 부풀어(스크린샷) **뷰 공간에서 시야 거리에 비례**(= 화면에서 늘 같은 두께)로 민다.
   * `asset3d.js` delam 이 **스킨 메시가 있는 GLB(사람·짐승)** 에만 두른다 — 국토 지도의 성·집·나무에 두르면
   * 멀리서 격자처럼 검게 뒤덮인다(사가마을이 땅 타일에 안 두른 것과 같은 판단). 손잡이 `world3d.outline`. */
  function OUTLINE_ON() {
    var core = global.DG && global.DG.core;
    return core && core.tuned ? (core.tuned('world3d.outline', 1) ? true : false) : true;
  }
  var OUTLINE_COLOR = 0x14120f;   // 사가종횡·사가나락와 같은 색
  var OUTLINE_K = 0.015;          // 부품 거르기용(가장 큰 부품 대비) — 폭 자체는 아래 OUTLINE_VIEW
  var OUTLINE_VIEW = 0.0022;      // 폭 = 시야 거리 × 0.22% (화면 높이 800px·시야각 44° 에서 약 2px, 초상 172px 에서 약 1px)
  var linePool = {};
  function outlineMaterial(width, skinned) {
    var t = three();
    var key = (skinned ? 's' : 'p') + ':' + width.toFixed(5);
    if (linePool[key]) { return linePool[key]; }
    var m = new t.ShaderMaterial({
      uniforms: { outlineWidth: { value: width }, outlineColor: { value: new t.Color(OUTLINE_COLOR) } },
      vertexShader: [
        '#include <common>', '#include <skinning_pars_vertex>',
        'uniform float outlineWidth;', 'attribute vec3 outlineNormal;',
        'void main() {',
        '  vec3 objectNormal = outlineNormal;',
        '  #include <skinbase_vertex>', '  #include <skinnormal_vertex>',
        '  #include <begin_vertex>', '  #include <skinning_vertex>',
        /* 뷰 공간에서 시야 거리에 비례해 민다 = 화면에서 늘 같은 두께. 지오메트리 단위로 밀면 메시 배율·뼈 보정이 얽힌
           몬스터 GLB(Quaternius: 메시 배율 100 을 뼈가 되돌린다)에서 외곽선이 몸의 몇십 배로 부풀어 화면을 덮었다 */
        '  vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );',
        '  vec3 olN = normalize( normalMatrix * objectNormal );',
        '  mvPosition.xyz += olN * outlineWidth * max( -mvPosition.z, 0.0 );',
        '  gl_Position = projectionMatrix * mvPosition;',
        '}'
      ].join('\n'),
      fragmentShader: 'uniform vec3 outlineColor;\nvoid main() { gl_FragColor = vec4(outlineColor, 1.0); }',
      side: t.BackSide
    });
    linePool[key] = m;
    return m;
  }
  function smoothOutlineNormals(geo) {
    var t = three();
    if (geo.attributes.outlineNormal) { return; }
    var pos = geo.attributes.position, nor = geo.attributes.normal;
    if (!pos || !nor) { return; }
    var n = pos.count, acc = {}, keys = new Array(n), i, k, a;
    for (i = 0; i < n; i++) {
      k = Math.round(pos.getX(i) * 1e4) + ',' + Math.round(pos.getY(i) * 1e4) + ',' + Math.round(pos.getZ(i) * 1e4);
      keys[i] = k;
      a = acc[k] || (acc[k] = [0, 0, 0]);
      a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i);
    }
    var out = new Float32Array(n * 3);
    for (i = 0; i < n; i++) {
      a = acc[keys[i]];
      var l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1;
      out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
    }
    geo.setAttribute('outlineNormal', new t.BufferAttribute(out, 3));
  }
  /** 원본 메시 곁에 외곽선 메시 하나. 이미 둘렀거나(VRoid 포함 `_toonOutline`) 외곽선 메시 자신이면 건너뛴다 */
  function outline(mesh, width) {
    var t = three();
    if (!t || !mesh || !mesh.isMesh || !mesh.geometry || !mesh.parent) { return null; }
    if (mesh.userData && mesh.userData._toonOutline) { return null; }
    if (/_outline$/.test(mesh.name || '')) { return null; }
    if (!mesh.geometry.boundingSphere) { mesh.geometry.computeBoundingSphere(); }
    var core = global.DG && global.DG.core;
    width = OUTLINE_VIEW * (core && core.tuned ? core.tuned('world3d.outlineW', 1) : 1);   // 화면 기준 한 폭(인자 width 는 옛 호출 호환용, 안 쓴다)
    smoothOutlineNormals(mesh.geometry);
    if (!mesh.geometry.attributes.outlineNormal) { return null; }
    var skinned = !!mesh.isSkinnedMesh, mat = outlineMaterial(width, skinned), out;
    if (skinned) { out = new t.SkinnedMesh(mesh.geometry, mat); out.bind(mesh.skeleton, mesh.bindMatrix); }
    else { out = new t.Mesh(mesh.geometry, mat); }
    out.position.copy(mesh.position); out.quaternion.copy(mesh.quaternion); out.scale.copy(mesh.scale);
    out.castShadow = false; out.receiveShadow = false;
    out.renderOrder = (mesh.renderOrder || 0) - 1;
    out.name = (mesh.name || 'mesh') + '_outline';
    out.userData._toonOutline = true;
    mesh.parent.add(out);
    mesh.userData = mesh.userData || {};
    mesh.userData._toonOutline = out;
    return out;
  }

  /** `new MeshLambertMaterial(opts)` 자리를 그대로 대신한다 — opts 는 손 안 댄다 */
  function lambertLike(opts) {
    var t = three();
    if (!t) { return null; }
    if (!TOON_ON()) { return new t.MeshLambertMaterial(opts); }
    var o = {}, k;
    for (k in opts) { if (Object.prototype.hasOwnProperty.call(opts, k)) { o[k] = opts[k]; } }
    o.gradientMap = ramp();
    return new t.MeshToonMaterial(o);
  }

  global.DG = global.DG || {};
  global.DG.toon3d = { ramp: ramp, toonify: toonify, lambertLike: lambertLike, TOON_ON: TOON_ON, RIM_ON: RIM_ON, applyRimLight: applyRimLight, cloneMat: cloneMat, skyBackground: skyBackground, SKY_ON: SKY_ON, TONE_ON: TONE_ON, toneRenderer: toneRenderer, lightGain: lightGain,
    OUTLINE_ON: OUTLINE_ON, outline: outline, outlineMaterial: outlineMaterial, OUTLINE_K: OUTLINE_K, OUTLINE_MIN_PART: 0.12 };
})(window);
