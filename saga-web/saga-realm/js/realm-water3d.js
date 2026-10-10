/**
 * 5천하 3D 지도 — 바다·강 물결 (W-0141)
 * ---------------------------------------------------------------
 * 해협 바다는 퐁 재질 판 한 장(0x2f7bb0), 내륙 강은 얇은 파란 상자(MeshBasic)였다 —
 * 해가 어디 있든 같은 파랑이 가만히 누워 있었다.
 *
 * 1만리 `saga-go/js/water3d.js` 의 셰이더를 **판별 복사**했다(다섯 벌 규칙 — 합치지 않는다).
 * 다른 점 셋:
 *   1. 날씨가 없다(턴제 지도) — 물결·윤슬은 하늘 모듈(`realm-sky3d`)이 건 해·반구 빛만 받는다
 *   2. 지도 한 칸이 크다(바다 폭 60) — 물결 좌표에 `uScale` 을 곱해 결을 잘게 한다(손잡이 `realm3d.waveScale`)
 *   3. 폰(품질 등급 low·medium = DPR ≤1.5)은 **반사를 끈다** — 하늘빛 섞기(프레넬)·윤슬 0, 물결 결만 남는다
 *
 * 되돌아가는 길: 손잡이 `realm3d.real` 0 이면 `material()` 이 null — realm3d 는 옛 판(퐁·Basic)으로 간다.
 * `plan()` 은 three 없이 돈다 — 자가진단이 그것만 본다.
 *
 * 셰이더를 손으로 짤 때 지킬 것(1만리 머리말 그대로): 안개·톤매핑·색공간 조각을 직접 넣고, 물결은 월드 좌표로 센다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  function ON() { return core.tuned('realm3d.real', 1) ? true : false; }
  function SCALE() { return core.tuned('realm3d.waveScale', 2.6); }

  /* ══ 값 층 — three 없이도 돈다 ═══════════════════════════ */

  /** @param o.tier 'low'|'medium'|'high'(realm3d.tier) · o.alt 해 고도 0~1(sunDir().y) */
  function plan(o) {
    o = o || {};
    var tier = o.tier === 'low' || o.tier === 'medium' ? o.tier : 'high';
    var refl = tier === 'high';                       // DPR 2 등급만 반사
    var alt = typeof o.alt === 'number' ? o.alt : 0.8;
    var low = Math.max(0, 1 - Math.abs(alt - 0.3) / 0.6);   // 해가 낮을수록 윤슬이 길다(1만리 노을 규칙, 지도는 고도 25° 밑으로 안 내려간다)
    return {
      on: ON(), tier: tier, reflect: refl,
      wave: tier === 'low' ? 0.7 : 1,
      glint: refl ? +(0.55 + low * 0.45).toFixed(4) : 0,
      sky: refl ? 1 : 0,
      scale: SCALE(),
      opacity: 0.86
    };
  }

  /* ══ 그림 층 ═════════════════════════════════════════════ */

  var T = null, mats = {}, clock = 0, ticks = 0, lastPlan = null, why = '-';

  var VERT = [
    'varying vec3 vWorld;',
    '#include <fog_pars_vertex>',
    'void main() {',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWorld = wp.xyz;',
    '  vec4 mvPosition = viewMatrix * wp;',
    '  gl_Position = projectionMatrix * mvPosition;',
    '  #include <fog_vertex>',
    '}'
  ].join('\n');

  var FRAG = [
    'uniform float uTime;',
    'uniform vec3  uDeep;',
    'uniform vec3  uSky;',
    'uniform vec3  uSun;',
    'uniform vec3  uSunDir;',
    'uniform vec3  uAmbient;',
    'uniform float uSunPow;',
    'uniform float uWave;',
    'uniform float uGlint;',
    'uniform float uSkyMix;',
    'uniform float uOpacity;',
    'uniform float uScale;',
    'varying vec3 vWorld;',
    '#include <fog_pars_fragment>',
    'vec3 waveNormal(vec2 p, float t) {',
    '  vec2 g = vec2(0.0);',
    '  vec2 d1 = normalize(vec2( 1.00,  0.35));',
    '  vec2 d2 = normalize(vec2(-0.40,  1.00));',
    '  vec2 d3 = normalize(vec2( 0.80, -0.70));',
    '  vec2 d4 = normalize(vec2(-0.90, -0.20));',
    '  g += d1 * 0.115 * 1.00 * cos(dot(p, d1) * 0.115 + t * 0.90);',
    '  g += d2 * 0.190 * 0.62 * cos(dot(p, d2) * 0.190 + t * 1.35);',
    '  g += d3 * 0.360 * 0.32 * cos(dot(p, d3) * 0.360 + t * 2.10);',
    '  g += d4 * 0.620 * 0.16 * cos(dot(p, d4) * 0.620 + t * 3.00);',
    '  return normalize(vec3(-g.x * uWave * 14.0, 1.0, -g.y * uWave * 14.0));',
    '}',
    'void main() {',
    '  vec3 N = waveNormal(vWorld.xz * uScale, uTime);',
    '  vec3 V = normalize(cameraPosition - vWorld);',
    '  float f = pow(1.0 - clamp(dot(V, N), 0.0, 1.0), 3.2);',
    '  f = clamp(0.04 + f * 0.55, 0.0, 1.0) * uSkyMix;',
    '  vec3 body = mix(uDeep, uSky, f);',
    '  float ndl = max(dot(N, uSunDir), 0.0);',
    '  vec3 col = body * (uAmbient + uSun * (uSunPow * ndl));',
    '  vec3 H = normalize(uSunDir + V);',
    '  float spec = pow(max(dot(N, H), 0.0), 42.0);',
    '  col += uSun * spec * uGlint * ndl * 0.9;',
    '  float crest = smoothstep(0.86, 0.96, N.y) - smoothstep(0.972, 1.0, N.y);',
    '  col += mix(uDeep, uSky, 0.6) * crest * 0.30 * uWave * (0.35 + 0.65 * ndl);',
    '  col *= 1.0 - (1.0 - smoothstep(0.80, 0.93, N.y)) * 0.20 * uWave;',
    '  gl_FragColor = vec4(col, mix(uOpacity, 0.94, f * 0.7));',
    '  #include <tonemapping_fragment>',
    '  #include <colorspace_fragment>',
    '  #include <fog_fragment>',
    '}'
  ].join('\n');

  /** 이 물빛의 재질 — 없으면 만든다. null 이면 부르는 쪽이 옛 판으로 간다 */
  function material(three, hex) {
    if (!three) { why = 'three 없음'; return null; }
    if (!ON()) { why = '손잡이 0'; return null; }
    T = three;
    var key = String(hex);
    if (mats[key]) { return mats[key]; }
    try {
      var uni = T.UniformsUtils.merge([T.UniformsLib.fog, {
        uTime: { value: 0 }, uDeep: { value: new T.Color(hex) }, uSky: { value: new T.Color(0x9fc4e8) },
        uSun: { value: new T.Color(0xfff0c8) }, uSunDir: { value: new T.Vector3(0.4, 0.8, -0.4) },
        uAmbient: { value: new T.Color(0x6a7a88) }, uSunPow: { value: 0.6 }, uWave: { value: 1 }, uGlint: { value: 1 },
        uSkyMix: { value: 1 }, uOpacity: { value: 0.86 }, uScale: { value: 2.6 }
      }]);
      mats[key] = new T.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG, transparent: true, fog: true, depthWrite: false });
      why = 'ok';
      return mats[key];
    } catch (e) {
      why = e && e.message ? e.message : '만들다 실패';
      return null;
    }
  }

  var _v = null;
  /**
   * 한 프레임 — realm3d 가 그리기 직전에 부른다.
   * @param tms   rAF 시각(ms)
   * @param scene 지도 씬(하늘 그림·안개색에서 하늘빛을 읽는다)
   * @param tier  realm3d.tier()
   */
  function tick(tms, scene, tier) {
    if (!T) { return false; }
    var k, n = 0;
    for (k in mats) { if (Object.prototype.hasOwnProperty.call(mats, k)) { n++; } }
    if (!n) { return false; }
    clock = (tms || 0) / 1000;
    var RS = global.DG.realmSky3d, L = RS && RS.lights ? RS.lights() : {}, sun = L.sun || null, hemi = L.hemi || null;   // 매 프레임 씬을 훑지 않는다
    if (!_v) { _v = new T.Vector3(); }
    if (sun) { _v.copy(sun.position).normalize(); }
    var p = lastPlan = plan({ tier: tier, alt: sun ? _v.y : undefined });
    for (k in mats) {
      if (!Object.prototype.hasOwnProperty.call(mats, k)) { continue; }
      var u = mats[k].uniforms;
      u.uTime.value = clock; u.uWave.value = p.wave; u.uGlint.value = p.glint; u.uSkyMix.value = p.sky;
      u.uOpacity.value = p.opacity; u.uScale.value = p.scale;
      if (scene && scene.fog) { u.uSky.value.copy(scene.fog.color); }
      if (sun) { u.uSun.value.copy(sun.color); u.uSunDir.value.copy(_v); u.uSunPow.value = sun.intensity * 0.46; }
      if (hemi) { u.uAmbient.value.copy(hemi.color).multiplyScalar(hemi.intensity * 0.42); }
    }
    ticks++;
    return true;
  }

  global.DG = global.DG || {};
  global.DG.realmWater3d = {
    plan: plan, material: material, tick: tick,
    stats: function () { var n = 0, k; for (k in mats) { if (Object.prototype.hasOwnProperty.call(mats, k)) { n++; } } return { on: ON(), mats: n, ticks: ticks, why: why, reflect: lastPlan ? lastPlan.reflect : '-' }; }
  };
})(window);
