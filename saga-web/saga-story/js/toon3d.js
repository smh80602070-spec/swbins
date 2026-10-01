/**
 * 툰 재질 공용 부품 — SAGA-DESIGN §6.0/§6.1, PLAN §6 "MeshToonMaterial + 그라디언트 맵" 적용
 * ---------------------------------------------------------------
 * `side-view3d.js`(하늘·바닥·발판·소품을 `new MeshLambertMaterial({...})`로
 * 곳곳에서 직접 만든다)와 `asset3d.js`(GLB 인물·짐승을 벗기는 `delam()`)가
 * 같은 규격의 3단 램프 툰 재질을 쓰게 한다.
 *
 *   ramp()          3단 그라디언트 맵(MeshToonMaterial.gradientMap)
 *   lambertLike(o)  `new MeshLambertMaterial(o)`을 대신할 자리 — 손잡이가
 *                   켜져 있으면 같은 옵션 객체로 MeshToonMaterial 을 만든다
 *   toonify(m)      이미 만든 재질(Standard/Physical 등)을 툰으로 바꿔 낸다
 *
 *   outline(mesh)   뒤집힌 헐 외곽선 메시를 원본과 **같은 부모**에 얹는다(SkinnedMesh 는
 *                   뼈대를 같이 쓴다). 사가블로 `toon3d.js` 에서 그대로 옮겼다.
 *   recolorOutlines 주인공 외곽선을 장비 세트 등급 색으로(`gear.setGrade`, 손잡이 world3d.gearOutline)
 *
 * **외곽선은 배우(사람·짐승 GLB)만 받는다**(2026-09-23) — `side-view3d.js`의 하늘·바닥·
 * 소품은 낱개 `new Mesh(...)` 라 태그할 자리가 없어, 사가블로처럼 `asset3d.js` `delam()`
 * 이 **GLB 폴더(people/animals)로 걸러** 부른다(`isActorAsset()`). 나무·바위·건물 GLB 는
 * 호출 자체가 안 온다. `world3d.outline`(기본 1) 손잡이로 끈다.
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

  /** 하늘 그라디언트 손잡이 — 0 이면 예전 단색 배경 */
  function SKY_ON() {
    var core = global.DG && global.DG.core;
    return core && core.tuned ? (core.tuned('world3d.skyGrad', 1) ? true : false) : true;
  }

  /**
   * 하늘 그라디언트 배경("고품질 셀 셰이딩급" 요청 2단계, 2026-09-23) — 단색 `scene.background` 를 화면 세로 그라디언트 텍스처로 바꾼다.
   * 사가의숲은 카메라를 따라다니는 구(`makeSkyDome`)를 쓰지만, 여기선 배경 텍스처 한 장이라 드로우콜·카메라 추적이 없다.
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

  /** 외곽선 손잡이 — 0 이면 툰 재질은 그대로 두고 테두리만 뺀다 */
  function OUTLINE_ON() {
    var core = global.DG && global.DG.core;
    return core && core.tuned ? (core.tuned('world3d.outline', 1) ? true : false) : true;
  }

  var OUTLINE_COLOR = 0x14120f;   // 사가블로와 같은 색
  /* 외곽선 재질 — 폭별로 캐싱, 스키닝 유무로 셰이더가 갈린다(법선 방향으로 밀어 자세와 무관하게 같은 두께) */
  var matPool = {};
  function outlineMaterial(width, skinned, color) {
    var t = three();
    var col = color === undefined || color === null ? OUTLINE_COLOR : color;
    var key = (skinned ? 's' : 'p') + ':' + width.toFixed(4) + (col === OUTLINE_COLOR ? '' : ':' + col.toString(16));
    if (matPool[key]) { return matPool[key]; }
    var vert = [
      '#include <common>',
      '#include <skinning_pars_vertex>',
      'uniform float outlineWidth;',
      'attribute vec3 outlineNormal;',
      'void main() {',
      '  vec3 objectNormal = outlineNormal;',   // beginnormal_vertex 대신 — 같은 자리 꼭짓점끼리 평균 낸 법선
      '  #include <skinbase_vertex>',
      '  #include <skinnormal_vertex>',
      '  #include <begin_vertex>',
      /* 스키닝 **전**(지오메트리 공간)에 민다 — 폭을 지오메트리 반지름으로 쟀으니 같은 공간이어야 한다. 스키닝 뒤(메시 지역 공간)에
         밀면 뼈·역바인드 행렬이 배율을 품은 GLB(양자화 Koi 등)에서 공간 배율이 달라 외곽선이 몸의 몇 배로 부푼다(2026-09-23 잉어 초상) */
      '  transformed += normalize(outlineNormal) * outlineWidth;',
      '  #include <skinning_vertex>',
      '  #include <project_vertex>',
      '}'
    ].join('\n');
    var frag = [
      'uniform vec3 outlineColor;',
      'void main() { gl_FragColor = vec4(outlineColor, 1.0); }'
    ].join('\n');
    var m = new t.ShaderMaterial({
      uniforms: { outlineWidth: { value: width }, outlineColor: { value: new t.Color(col) } },
      vertexShader: vert, fragmentShader: frag, side: t.BackSide
    });
    matPool[key] = m;
    return m;
  }

  /**
   * 외곽선용 매끈한 법선 — 로우폴리 GLB 는 면마다 꼭짓점을 따로 두어(각진 음영) 법선이
   * 면을 따라 갈린다. 그대로 밀면 면끼리 벌어져 외곽선이 톱니·점선처럼 끊긴다(짐승에서
   * 스크린샷으로 확인, 2026-09-23). 같은 자리의 꼭짓점 법선을 평균 내 따로 싣는다 —
   * 원본 `normal` 은 안 건드리므로 본 몸의 음영은 그대로다
   */
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

  /** 원본 메시 곁에 외곽선 메시를 하나 얹는다. 이미 얹었으면 다시 안 만든다.
   *  `width` 를 주면 그 폭(기하 단위)으로 — 한 모델의 부품끼리 같은 두께로 맞출 때
   *  (`asset3d.js` delam 이 가장 큰 부품 반지름 × OUTLINE_K 를 넘긴다).
   *  **절대 최소폭을 두지 않는다** — 짐승 GLB 는 기하가 반지름 0.03 으로 작고 뼈대가 900~2000배
   *  키워, 사가블로식 최소 0.006 이 반지름의 20% 가 되어 새까맣게 두꺼웠다(2026-09-23 CDP 실측) */
  function outline(mesh, width) {
    var t = three();
    if (!t || !mesh || !mesh.isMesh || !mesh.geometry || !mesh.parent) { return null; }
    if (mesh.userData && mesh.userData._toonOutline) { return mesh.userData._toonOutline; }
    if (/_outline$/.test(mesh.name || '')) { return null; }
    if (!mesh.geometry.boundingSphere) { mesh.geometry.computeBoundingSphere(); }
    var r = (mesh.geometry.boundingSphere && mesh.geometry.boundingSphere.radius) || 0.3;
    if (!(width > 0)) { width = r * OUTLINE_K; }
    var skinned = !!mesh.isSkinnedMesh;
    smoothOutlineNormals(mesh.geometry);
    if (!mesh.geometry.attributes.outlineNormal) { return null; }
    var mat = outlineMaterial(width, skinned);
    var out;
    if (skinned) {
      out = new t.SkinnedMesh(mesh.geometry, mat);
      out.bind(mesh.skeleton, mesh.bindMatrix);
    } else {
      out = new t.Mesh(mesh.geometry, mat);
    }
    out.position.copy(mesh.position);
    out.quaternion.copy(mesh.quaternion);
    out.scale.copy(mesh.scale);
    out.castShadow = false;
    out.receiveShadow = false;
    out.renderOrder = (mesh.renderOrder || 0) - 1;
    out.name = (mesh.name || 'mesh') + '_outline';
    mesh.parent.add(out);
    mesh.userData = mesh.userData || {};
    mesh.userData._toonOutline = out;
    return out;
  }
  /**
   * 장비 세트 등급 외곽선(PLAN §6 성장 가시화, 2026-09-23) — 이미 두른 외곽선 메시의 재질만
   * **같은 폭·같은 스키닝, 다른 색** 캐시 재질로 바꿔 끼운다. 재질은 배우끼리 나눠 쓰므로
   * uniform 을 바꾸면 모든 배우가 물든다 — 그래서 색마다 따로 캐싱한다.
   *   gradeTint(hex)          등급 색(RARITY)을 검은 외곽선 쪽으로 섞은 값. 1 등급·손잡이 0 이면 기본 검정
   *   recolorOutlines(root,c) root 아래 `_outline` 메시를 색 c 로. 갈아 끼운 수를 돌려준다
   */
  function gradeTint(hex, rank) {
    var core = global.DG && global.DG.core;
    var mix = core && core.tuned ? core.tuned('world3d.gearOutline', 0.75) : 0.75;
    if (!hex || !(rank > 1) || !(mix > 0)) { return OUTLINE_COLOR; }
    var c = parseInt(String(hex).replace('#', ''), 16);
    return isNaN(c) ? OUTLINE_COLOR : mixHex(OUTLINE_COLOR, c, mix);
  }

  /** 0xRRGGBB 두 색을 m(0~1) 만큼 섞는다 — 외곽선 등급 색·전직 차수 옷 색(`side-view3d.js`)이 같이 쓴다 */
  function mixHex(a, b, m) {
    m = Math.max(0, Math.min(1, m || 0));
    var out = 0, sh;
    for (sh = 16; sh >= 0; sh -= 8) {
      var x = (a >> sh) & 255, y = (b >> sh) & 255;
      out |= (Math.round(x + (y - x) * m) & 255) << sh;
    }
    return out;
  }

  /**
   * 전직 차수 → 주인공 옷 빛깔(PLAN §6 성장 가시화, 2026-09-23) — 세력 색에 갈래 색(`jobData.BRANCH_TINT`)을
   * 차수 × `world3d.jobTint`(기본 0.12, 상한 0.6) 만큼 섞는다. 무명(0차)은 세력 색 그대로. `key` 가 바뀌면(전직·교대)
   * `side-view3d.js` draw() 가 주인공 몸을 다시 세운다 — 물들임은 조립할 때 한 번 굽기 때문이다(asset3d applyTint 캐시).
   * three 없이 도는 순수 계산이라 진단이 바로 잰다
   */
  function jobLook(baseCss, jobKey) {
    var J = global.DG && global.DG.job, JD = global.DG && global.DG.jobData, core = global.DG && global.DG.core;
    var hx = function (c) { var n = parseInt(String(c || '').replace('#', ''), 16); return isNaN(n) ? 0 : n; };
    var base = baseCss ? hx(baseCss) : 0xffffff, j = JD ? JD.job(jobKey) : null;   // 세력 색이 없으면 흰 바탕에 섞는다
    var tier = j ? (j.tier || 0) : 0, root = J && J.rootOf ? J.rootOf(jobKey) : null;
    var branch = root && JD.BRANCH_TINT ? hx(JD.BRANCH_TINT[root]) : 0;
    var k = core && core.tuned ? core.tuned('world3d.jobTint', 0.12) : 0.12;
    var m = branch ? Math.min(0.6, tier * k) : 0;
    var color = m > 0 ? mixHex(base, branch, m) : base;
    /* css — actorShell 에 넘길 빛깔. 세력 색도 갈래 색도 없으면 undefined(예전처럼 도형 기본색·GLB 안 물들임) */
    var css = (baseCss || m > 0) ? '#' + ('00000' + color.toString(16)).slice(-6) : undefined;
    return { tier: tier, root: root || 'none', color: color, css: css, key: (root || 'none') + tier + ':' + (css || '-') };
  }

  function recolorOutlines(root, color) {
    if (!three() || !root) { return 0; }
    var n = 0;
    root.traverse(function (o) {
      if (!o.isMesh || !/_outline$/.test(o.name || '')) { return; }
      var u = o.material && o.material.uniforms;
      if (!u || !u.outlineWidth) { return; }
      var m = outlineMaterial(u.outlineWidth.value, !!o.isSkinnedMesh, color);
      if (o.material !== m) { o.material = m; n++; }
    });
    return n;
  }

  var OUTLINE_K = 0.015;    // 바운딩구 반지름의 1.5% — 사가블로(3%)의 절반. 이 판 배우는 화면 키 40px 안팎이라 3% 면 몸이 검게 묻힌다(스크린샷 확인)

  global.DG = global.DG || {};
  global.DG.toon3d = {
    ramp: ramp, lambertLike: lambertLike, toonify: toonify, TOON_ON: TOON_ON, RIM_ON: RIM_ON, applyRimLight: applyRimLight, cloneMat: cloneMat, skyBackground: skyBackground, SKY_ON: SKY_ON,
    outline: outline, OUTLINE_ON: OUTLINE_ON, outlineMaterial: outlineMaterial,
    gradeTint: gradeTint, recolorOutlines: recolorOutlines, OUTLINE_COLOR: OUTLINE_COLOR, mixHex: mixHex, jobLook: jobLook,
    OUTLINE_K: OUTLINE_K, OUTLINE_MIN_PART: 0.12
  };
})(window);
