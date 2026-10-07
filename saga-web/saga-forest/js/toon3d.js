/**
 * 툰 재질 공용 부품 — SAGA-DESIGN §6.0/§6.1 적용
 * ---------------------------------------------------------------
 * `village-view3d.js`(땅·타일)와 `asset3d.js`(GLB 주민·짐승·소품을 벗기는
 * `delam()`)가 같은 규격의 3단 램프 툰 재질을 쓰게 한다.
 *
 *   ramp()          3단 그라디언트 맵(MeshToonMaterial.gradientMap)
 *   toonify(material) 기존 재질(Lambert 등)을 툰 재질로 바꿔 낸다
 *
 * **물 재질(`waterMaterial()`)은 건드리지 않는다** — `scene.environment`
 * HDRI 반사를 쓰는 `MeshStandardMaterial`이라 툰으로 바꾸면 반사가 죽는다
 * (그 함수 자체의 주석 "반사는 공짜로 얻는다" 참고). `/realistic/` 밑
 * (Renvylle Castle 등, PBR+HDRI)도 `asset3d.js`가 이미 `delam()`을 안 태운다
 * — 그대로 둔다.
 *
 * **외곽선은 이번 손질에서 뺐다** — 땅 타일이 `InstancedMesh`로 수백~수천
 * 칸을 그리는 구조라, 칸마다 외곽선을 더하면 격자 전체가 검은 테두리로
 * 뒤덮여 오히려 "허접해" 보일 위험이 크다(화면 확인 불가능한 세션에서
 * 무릅쓰지 않았다). 배우(주민·짐승)만 골라 붙이는 절충안은 PLAN §6 후속 과제.
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





  /** 배우 하나(root) 안의 툰·Lambert 재질 전부에 림 — `asset3d.js` 가 외곽선을 두르는 자리(사람·짐승)에서 같이 부른다 */
  function rimActor(root) {
    if (!root || !root.traverse) { return; }
    root.traverse(function (o) {
      if (!o.isMesh || !o.material || /_outline$/.test(o.name || '')) { return; }
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(applyRimLight);
    });
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

  var OUTLINE_COLOR = 0x211a14;
  var OUTLINE_K = 0.02;          // 모델에서 가장 큰 부품 반지름의 2% — 사가종횡 1.5%·사가나락 3% 사이(이 판은 3/4 부감으로 인물이 그 중간 크기)
  var OUTLINE_MIN_PART = 0.12;   // 이보다 작은 부품(눈·이빨)은 안 두른다 — 검은 점이 된다
  /* 2026-09-23 — 외곽선 재질을 "메시 배율 1.045 부풀리기"에서 **법선 방향 밀기 셰이더**로 바꿨다(사가종횡
     toon3d.js 에서 옮김, 그쪽은 스크린샷으로 두께·끊김을 맞췄다). 옛 방식은 SkinnedMesh 에서 아무 효과가 없었다 —
     three 의 기본 bindMode('attached')는 매 프레임 bindMatrixInverse = 메시 자신의 matrixWorld 역행렬이라
     복제본에 준 scale 이 스키닝 식에서 그대로 상쇄된다. 그래서 VRoid·QRPG 사람의 외곽선은 원본과 한 치도 안
     어긋나 뒷면에 가려 안 보였다(짐승처럼 스킨이 아닌 것만 보였다). 폭별로 캐싱, 스키닝은 three 가 define 으로 가른다 */
  var matPool = {};
  function outlineMaterial(width) {
    var t = three();
    if (!t) { return null; }
    var key = width.toFixed(5);
    if (matPool[key]) { return matPool[key]; }
    var vert = [
      '#include <common>',
      '#include <skinning_pars_vertex>',
      'uniform float outlineWidth;',
      'attribute vec3 outlineNormal;',
      'void main() {',
      '  vec3 objectNormal = outlineNormal;',
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
    matPool[key] = new t.ShaderMaterial({
      uniforms: { outlineWidth: { value: width }, outlineColor: { value: new t.Color(OUTLINE_COLOR) } },
      vertexShader: vert, fragmentShader: frag, side: t.BackSide
    });
    return matPool[key];
  }

  /** 외곽선용 매끈한 법선 — 로우폴리는 면마다 꼭짓점을 따로 둬 법선이 갈린다. 그대로 밀면 면끼리 벌어져
   *  톱니·점선처럼 끊긴다. 같은 자리 꼭짓점 법선을 평균 내 따로 싣는다(원본 `normal` 은 그대로 — 몸 음영 불변) */
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

  /** 외곽선 손잡이 — 배우(주민·짐승·NPC)에만 쓴다(PLAN §6.1). 땅 타일은
   *  InstancedMesh 격자라 칸마다 붙이면 화면 전체가 검은 테두리로 뒤덮일
   *  위험이 커 일부러 안 건다(§6.1 주석 그대로). 기본은 툰과 같이 켜지지만
   *  손잡이를 따로 둬 외곽선만 되돌릴 길을 남긴다. */
  function OUTLINE_ON() {
    var core = global.DG && global.DG.core;
    if (!TOON_ON()) { return false; }
    return core && core.tuned ? (core.tuned('world3d.outline', 1) ? true : false) : true;
  }

  /**
   * 뒤집힌 헐(inverted-hull) 외곽선 — SkinnedMesh 포함, 몸 하나(root) 안의 메시마다 **법선 방향으로
   * 민** 뒷면 전용(BackSide) 복제를 같은 부모에 덧붙인다. 스킨 메시는 같은 skeleton 에 다시 물려
   * (`bind()`) 걸을 때 몸과 같이 움직인다. 원본 메시는 손 안 댄다 — root 를 버리면 같이 사라진다.
   * `width` 는 **모델에서 가장 큰 부품 반지름에 대한 비율**(기본 OUTLINE_K) — 부품마다 제 반지름으로
   * 재면 얼굴·머리카락이 몸보다 가늘어 들쭉날쭉하다. 투명 재질(속눈썹 등)·아주 작은 부품은 안 두른다.
   */
  function addOutline(root, width) {
    var t = three();
    if (!t || !root || !OUTLINE_ON()) { return 0; }
    var targets = [], maxR = 0;
    root.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !o.parent || /_outline$/.test(o.name || '')) { return; }
      if (o.userData && o.userData._toonOutline) { return; }
      var m0 = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m0 && m0.transparent) { return; }
      if (!o.geometry.boundingSphere) { o.geometry.computeBoundingSphere(); }
      var r = o.geometry.boundingSphere ? o.geometry.boundingSphere.radius : 0;
      targets.push({ o: o, r: r });
      if (r > maxR) { maxR = r; }
    });
    var w = maxR * (width > 0 ? width : OUTLINE_K);
    if (!(w > 0)) { return 0; }
    var mat = outlineMaterial(w), n = 0;
    targets.forEach(function (x) {
      var o = x.o;
      if (x.r < maxR * OUTLINE_MIN_PART) { return; }
      smoothOutlineNormals(o.geometry);
      if (!o.geometry.attributes.outlineNormal) { return; }
      var dup;
      if (o.isSkinnedMesh) {
        dup = new t.SkinnedMesh(o.geometry, mat);
        dup.bind(o.skeleton, o.bindMatrix);
      } else {
        dup = new t.Mesh(o.geometry, mat);
      }
      dup.position.copy(o.position);
      dup.quaternion.copy(o.quaternion);
      dup.scale.copy(o.scale);
      dup.castShadow = false;
      dup.receiveShadow = false;
      dup.renderOrder = (o.renderOrder || 0) - 1;
      dup.name = (o.name || 'mesh') + '_outline';
      o.parent.add(dup);
      o.userData = o.userData || {};
      o.userData._toonOutline = dup;
      n++;
    });
    return n;
  }

  global.DG = global.DG || {};
  global.DG.toon3d = { ramp: ramp, toonify: toonify, lambertLike: lambertLike, TOON_ON: TOON_ON,
    addOutline: addOutline, OUTLINE_ON: OUTLINE_ON, RIM_ON: RIM_ON, applyRimLight: applyRimLight, rimActor: rimActor,
    outlineMaterial: outlineMaterial, OUTLINE_K: OUTLINE_K, OUTLINE_MIN_PART: OUTLINE_MIN_PART };
})(window);
