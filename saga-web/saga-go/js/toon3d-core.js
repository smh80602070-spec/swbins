/**
 * 툰 재질 공용 부품의 **뼈대** — 3단 램프 · 툰/림 손잡이 · 프레넬 림 라이트.
 * SAGA-DESIGN §6.0/§6.1. 다섯 판 `toon3d.js` 에 글자까지 똑같이 들어 있던 네 함수를 한 곳으로 뺐다
 * (W-0019 1단계 — 렌더 결과·손잡이 `world3d.toon`·`world3d.rim` 불변).
 *
 * **정본은 saga-web/shared/js/toon3d-core.js** — 판별 복사본은 tools/sync-shared.mjs 가 만든다(직접 고치지 않는다).
 * 각 판 `toon3d.js` 는 이 파일 뒤에 로드돼 `DG.toon3dCore` 를 받아 쓴다(외곽선·하늘·톤매핑처럼 판마다
 * 갈라진 부분은 각 판 `toon3d.js` 에 그대로 남는다).
 *
 * three 가 없으면(자가진단) 아무 것도 안 한다.
 */
(function (global) {
  'use strict';

  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }

  /** 3단 램프 — 어둠·중간·밝음. `NearestFilter` 라 사이가 안 섞이고 계단으로 진다 */
  var rampTex = null;
  function ramp() {
    if (rampTex) { return rampTex; }
    var t = three();
    if (!t) { return null; }
    var data = new Uint8Array([80, 80, 80, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
    rampTex = new t.DataTexture(data, 3, 1, t.RGBAFormat);
    rampTex.magFilter = t.NearestFilter;
    rampTex.minFilter = t.NearestFilter;
    rampTex.needsUpdate = true;
    return rampTex;
  }

  /** 툰 손잡이 — 0 이면 예전 재질 그대로(되돌림용) */
  function TOON_ON() {
    var core = global.DG && global.DG.core;
    return core && core.tuned ? (core.tuned('world3d.toon', 1) ? true : false) : true;
  }

  /** 림 라이트 손잡이(2026-09-23, 사가의숲에서 옮김) — 툰이 꺼지면 같이 꺼진다 */
  function RIM_ON() {
    var core = global.DG && global.DG.core;
    if (!TOON_ON()) { return false; }
    return core && core.tuned ? (core.tuned('world3d.rim', 1) ? true : false) : true;
  }

  /**
   * 프레넬 림 라이트("고품질 셀 셰이딩급" 요청 2단계, 2026-09-23) — 사가의숲 `toon3d.js` 에서 옮기되 한 가지를 바꿨다:
   * 그쪽은 빛과 무관하게 따뜻한 흰빛을 **더해** 어두운 곳(던전·밤)에서도 가장자리가 형광처럼 뜰 수 있어,
   * 여기서는 **그 자리의 밝기에 비례해** 가장자리를 밝힌다 — 어두우면 거의 안 보인다. 안개·톤매핑 전
   * (`opaque_fragment` 바로 뒤)에 넣어 멀리 안개에 묻힌 인물 테두리가 안개색으로 번지지 않게 했다.
   * 법선은 스키닝을 거친 `objectNormal` 을 쓴다(걷는 팔다리에도 맞는 테두리). **배우(사람·짐승)에만** 건다 —
   * 땅에 걸면 낮은 카메라에서 먼 지면 전체가 스치는 각도라 지평선이 통째로 뿌옇게 뜬다.
   * 이미 다른 셰이더 덧대기(`onBeforeCompile`)가 있는 재질은 건너뛴다(프로그램 캐시 키가 섞이지 않게).
   * 렌더 결과(두께·세기)는 화면 없이는 못 본다 — 실기 확인 몫.
   */
  function applyRimLight(mat) {
    var t = three();
    if (!t || !mat || !RIM_ON() || (mat.userData && mat.userData.rimApplied)) { return mat; }
    if (!mat.isMeshToonMaterial && !mat.isMeshLambertMaterial) { return mat; }
    if (Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile')) { return mat; }
    mat.userData = mat.userData || {};
    mat.userData.rimApplied = true;
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.rimColor = { value: new t.Color(0xfff0d8) };
      shader.uniforms.rimPower = { value: 2.4 };
      shader.uniforms.rimIntensity = { value: 0.9 };
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vRimN;\nvarying vec3 vRimV;'
      ).replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvRimN = normalize( normalMatrix * objectNormal );\nvRimV = normalize( -mvPosition.xyz );'
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nuniform vec3 rimColor;\nuniform float rimPower;\nuniform float rimIntensity;\nvarying vec3 vRimN;\nvarying vec3 vRimV;'
      ).replace(
        '#include <opaque_fragment>',
        '#include <opaque_fragment>\nfloat rimF = pow( 1.0 - clamp( abs( dot( normalize( vRimN ), normalize( vRimV ) ) ), 0.0, 1.0 ), rimPower );\ngl_FragColor.rgb += gl_FragColor.rgb * rimColor * ( rimIntensity * rimF );'
      );
    };
    return mat;
  }

  global.DG = global.DG || {};
  global.DG.toon3dCore = { ramp: ramp, TOON_ON: TOON_ON, RIM_ON: RIM_ON, applyRimLight: applyRimLight };
})(window);
