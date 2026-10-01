/**
 * 툰 재질 · 외곽선 공용 부품 — SAGA-DESIGN §6.0/§6.1 "저비용 통일" 적용
 *
 * **정본은 saga-web/shared/js/toon3d.js**(사가고·사가블로 두 판) — 판별 복사본은 tools/sync-shared.mjs 가 만든다(직접 고치지
 * 않는다). 사가의숲·사가스토리·사가국지의 `toon3d.js` 는 각자 갈라진 다른 구현(하늘 그라디언트·림 라이트·람베르트 대용 등)이라 아직 합치지 않았다.
 * 사가블로는 외곽선을 **배우 GLB(people/animals/monsters)만** 받는다 — `asset3d.js` `isActorAsset()` 이 걸러 `outline()` 을 부르고,
 * `world3d.outline`(기본 1) 손잡이로 끌 수 있다.
 * ---------------------------------------------------------------
 * `actor3d.js`(도형으로 세운 배우)와 `asset3d.js`(GLB 배우)가 **같은 규격**의
 * 3단 램프 툰 재질과 뒤집힌 헐 외곽선을 쓰게 한다. 지형·소품(`prop3d.js`)은
 * 팔레트 스냅만 받고 이 파일은 안 쓴다(PLAN §6 — "소품은 Quaternius 면색이라
 * 팔레트 스냅만").
 *
 *   ramp()               3단 그라디언트 맵(MeshToonMaterial.gradientMap)
 *   toonify(material)    기존 재질(Lambert·Standard 등)을 툰 재질로 바꿔 낸다.
 *                        map·color·vertexColors·transparent·alphaTest·side 를 옮긴다
 *   outline(mesh)        뒤집힌 헐 외곽선 메시를 만들어 원본과 **같은 부모**에 얹는다.
 *                        SkinnedMesh 는 뼈대를 공유해 같이 움직인다(정점 셰이더에서
 *                        스키닝 뒤 법선 방향으로 밀어내므로 자세가 바뀌어도 안 어긋난다)
 *
 * 외곽선 폭은 "스케일 1.03"(PLAN §6.1)을 지오메트리 바운딩구 반지름의 3%로 환산한다 —
 * 균일 스케일 복제(피벗에서 멀수록 벌어짐)가 아니라 **법선 방향으로 미는** 방식이라
 * 스키닝 자세·원점 위치와 무관하게 항상 같은 두께로 보인다.
 *
 * three 가 없으면(자가진단) 아무 것도 안 한다 — 판정에는 한 줄도 안 닿는다.
 */
(function (global) {
  'use strict';

  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }

  var OUTLINE_COLOR = 0x14120f;

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
  function OUTLINE_ON() {
    var core = global.DG && global.DG.core;
    return core && core.tuned ? (core.tuned('world3d.outline', 1) ? true : false) : true;
  }

  /** 기존 재질 하나를 3단 툰 재질로 — 빛깔·맵·투명만 옮긴다(PBR 값은 버린다) */
  function toonify(src) {
    var t = three();
    if (!t || !src) { return src; }
    if (Array.isArray(src)) { return src.map(toonify); }
    if (src.isMeshToonMaterial) { return src; }
    var out = new t.MeshToonMaterial({
      color: src.color ? src.color.clone() : new t.Color(0xffffff),
      map: src.map || null,
      vertexColors: !!src.vertexColors,
      transparent: !!src.transparent,
      opacity: src.opacity === undefined ? 1 : src.opacity,
      alphaTest: src.alphaTest || 0,
      side: src.side === undefined ? t.FrontSide : src.side,
      gradientMap: ramp()
    });
    return out;
  }

  /* ── 외곽선 재질 — 폭(width)별로 캐싱한다. 스키닝 유무로 셰이더가 갈린다 ── */
  var matPool = {};
  function outlineMaterial(width, skinned) {
    var t = three();
    var key = (skinned ? 's' : 'p') + ':' + width.toFixed(4);
    if (matPool[key]) { return matPool[key]; }

    var vert = [
      '#include <common>',
      '#include <uv_pars_vertex>',
      '#include <skinning_pars_vertex>',
      'uniform float outlineWidth;',
      'attribute vec3 outlineNormal;',
      'void main() {',
      '  #include <uv_vertex>',
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
      'void main() {',
      '  gl_FragColor = vec4(outlineColor, 1.0);',
      '}'
    ].join('\n');

    var m = new t.ShaderMaterial({
      uniforms: {
        outlineWidth: { value: width },
        outlineColor: { value: new t.Color(OUTLINE_COLOR) }
      },
      vertexShader: vert,
      fragmentShader: frag,
      side: t.BackSide   // (옛 `skinning` 속성은 r169 에 없다 — 재질마다 경고만 냈다. 스키닝은 SkinnedMesh 가 알아서 켠다)
    });
    matPool[key] = m;
    return m;
  }

  /**
   * 외곽선용 매끈한 법선(사가스토리에서 옮김, 2026-09-23) — 로우폴리 GLB 는 면마다 꼭짓점을 따로 두어(각진 음영) 법선이
   * 면을 따라 갈린다. 그대로 밀면 면끼리 벌어져 외곽선이 톱니·끊긴 붓질이 된다(늑대 펫 초상 스크린샷). 같은 자리의
   * 꼭짓점 법선을 평균 내 `outlineNormal` 로 따로 싣는다 — 원본 `normal` 은 안 건드려 본 몸 음영은 그대로다
   */
  function smoothOutlineNormals(geo) {
    var t = three();
    if (geo.attributes.outlineNormal) { return; }
    if (!geo.attributes.normal && geo.attributes.position) { geo.computeVertexNormals(); }
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
   *  `width` 를 주면 그 폭(지오메트리 단위) — GLB 는 `asset3d.js` delam 이 **모델 안 가장 큰 부품 반지름 × 2%** 한 폭을 넘긴다.
   *  안 주면 예전 규칙(제 반지름 × 3%, 최소 0.006) — 도형 조립 배우(`actor3d`)용. 2026-09-23: 동물 GLB 는 부품 반지름이
   *  0.002~0.03(뼈·메시 배율 100 으로 키움)이라 최소 0.006 이 부품의 20~300% 가 되어 몸 둘레에 검은 파편이 번졌다(펫 초상 스크린샷) */
  function outline(mesh, width) {
    var t = three();
    if (!t || !mesh || !mesh.isMesh || !mesh.geometry || !mesh.parent) { return null; }
    if (mesh.userData && mesh.userData._toonOutline) { return mesh.userData._toonOutline; }
    if (!mesh.geometry.boundingSphere) { mesh.geometry.computeBoundingSphere(); }
    var r = (mesh.geometry.boundingSphere && mesh.geometry.boundingSphere.radius) || 0.3;
    if (!(width > 0)) { width = Math.max(0.006, r * 0.03); }
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
    out.rotation.copy(mesh.rotation);
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

  global.DG = global.DG || {};
  global.DG.toon3d = {
    ramp: ramp, toonify: toonify, outline: outline,
    TOON_ON: TOON_ON, RIM_ON: RIM_ON, applyRimLight: applyRimLight, cloneMat: cloneMat, OUTLINE_ON: OUTLINE_ON,
    outlineMaterial: outlineMaterial
  };
})(window);
