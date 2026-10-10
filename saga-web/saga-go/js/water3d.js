/**
 * 물 — 수면이 실제로 움직인다 (그래픽 보강 12절)
 * ---------------------------------------------------------------
 * 여태 강과 못은 **파란 판 한 장**이었다. `pmat(hex, 'water')` 가 만든
 * `MeshLambertMaterial` 에 `opacity 0.72` 를 준 것이 전부라, 해가 지든 비가 오든
 * 같은 파랑이 같은 자리에 가만히 누워 있었다. 다리를 건너도, 잉어가 튀어도
 * 물은 한 번도 흔들리지 않았다.
 *
 * 여기서 그 판 한 장을 **셰이더 한 장**으로 바꾼다. 텍스처는 쓰지 않는다 —
 * 이 저장소는 그림을 코드가 그린다.
 *
 *   물결   방향이 다른 사인 넷을 겹쳐 **기울기**를 낸다. 그 기울기가 법선이다
 *   빛깔   비스듬히 볼수록 하늘빛(프레넬), 내려다볼수록 물빛
 *   윤슬   해 쪽으로 반짝인다. 해가 낮을수록 길고 세다 (노을의 그 빛)
 *   때·천후 `lightingAt` 이 준 것을 그대로 받는다 — 밤에는 잦아들고
 *          비 오면 잘게 일고, 눈 오는 날은 가라앉는다
 *
 * **판정에는 한 줄도 닿지 않는다.** 건너는 것도, 잉어가 사는 자리도 그대로다.
 * 값을 내는 함수(`plan`)는 **three 없이도 돈다** — 자가진단이 그것만 따로 본다.
 *
 * 되돌아가는 길: 등급이 LOW 거나 손잡이가 0 이면 `material()` 이 null 을 주고,
 * `world3d` 는 **여태 쓰던 Lambert 판**으로 간다. 그림이 어제로 돌아갈 뿐 안 깨진다.
 *
 * ── 셰이더를 손으로 짤 때 지킨 것 셋 ─────────────────────
 *
 * 1. **안개를 직접 넣어야 한다.** 씬에 안개가 걸려 있어도 `ShaderMaterial` 은
 *    저절로 안 받는다(`fog: true` + `UniformsLib.fog` + 세 조각). 안 넣으면
 *    먼 강만 안개를 뚫고 새파랗게 떠오른다
 * 2. **톤매핑·색공간 조각도 직접 넣는다.** 내장 재질은 프래그먼트 끝에서 그 둘을
 *    거친다 — 빼면 물만 다른 밝기로 나온다(후처리를 끈 LOW 에서 특히)
 * 3. **물결은 월드 좌표로 센다.** 격자마다 수면이 따로 서 있어 지역 좌표로 세면
 *    칸 경계마다 물결이 끊긴다. `modelMatrix` 를 거친 자리로 세면 이어진다
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /* 등급마다 얼마나 물을 들이나 — LOW 는 통째로 안 쓴다(옛 판으로 돌아간다) */
  var TIER_WATER = {
    HIGH:   { on: true,  wave: 1.00, glint: 1.00, refl: true },
    MEDIUM: { on: true,  wave: 0.80, glint: 0.75, refl: false },   // W-0140 폰(MEDIUM)은 하늘 그림 반사를 끈다 — 단색 하늘빛 프레넬로
    LOW:    { on: false, wave: 0,    glint: 0,    refl: false }
  };

  function ON() { return core.tuned('water3d.on', 1) ? true : false; }
  function WAVE() { return core.tuned('water3d.wave', 1); }
  function GLINT() { return core.tuned('water3d.glint', 1); }
  function OPACITY() { return core.tuned('water3d.opacity', 0.78); }
  function REFL() { return core.tuned('water3d.refl', 1) ? true : false; }     // W-0140 하늘 그림을 비춘다
  function FINE() { return core.tuned('water3d.fine', 1); }                     // W-0140 잔물결 두 겹 세기
  function FOAM() { return core.tuned('water3d.foam', 1); }                     // W-0140 물가 거품 띠 세기

  /* ══ 값 층 — three 없이도 돈다 ═══════════════════════════ */

  /**
   * 이 때·이 날씨의 물은 어떤가.
   *
   * @param o.tier    'HIGH' | 'MEDIUM' | 'LOW'
   * @param o.alt     해 고도 -1~1 (`lightingAt().alt`)
   * @param o.weather 'clear' | 'rain' | 'snow' | 'fog' | 'wind' | 'cloud'
   */
  function plan(o) {
    o = o || {};
    var tk = TIER_WATER[o.tier] ? o.tier : 'HIGH';
    var tp = TIER_WATER[tk];
    var alt = typeof o.alt === 'number' ? o.alt : 0.8;
    var w = o.weather || 'clear';

    var wave = tp.wave * WAVE();
    var glint = tp.glint * GLINT();
    var ripple = 0;

    /* 해가 낮을수록 윤슬이 길고 세다 — 노을의 그 빛이다.
       한낮에는 바로 위에서 내리쬐어 한 점으로만 반짝인다.
       **보태는 폭을 좁게 잡았다** — 처음에 0.55+low*0.9 로 두었더니 노을에
       주황 줄기가 불길처럼 번져 강이 타는 것처럼 보였다(눈으로 보고 알았다).
       노을 햇빛 자체가 이미 진한 주황이라 여기서 또 키우면 두 번 키우는 셈이다 */
    var low = Math.max(0, 1 - Math.abs(alt - 0.16) / 0.5);
    glint *= 0.55 + low * 0.45;

    /* 밤 — 달빛만 남는다. 물결도 잦아든다 */
    if (alt < 0.02) {
      var deep = Math.min(1, (0.02 - alt) * 3.2);
      glint *= 1 - deep * 0.78;
      wave *= 1 - deep * 0.24;
    }

    if (w === 'rain') { wave *= 1.45; ripple = 1; glint *= 0.34; }
    else if (w === 'wind') { wave *= 1.38; glint *= 0.82; }
    else if (w === 'snow') { wave *= 0.58; glint *= 0.48; }
    else if (w === 'fog') { wave *= 0.72; glint *= 0.26; }
    else if (w === 'cloud') { glint *= 0.62; }

    return {
      on: ON() && tp.on,
      tier: tk,
      wave: +Math.max(0, wave).toFixed(4),
      glint: +Math.max(0, glint).toFixed(4),
      ripple: ripple,
      /* W-0140 — 하늘 그림 반사(등급·손잡이)·잔물결·물가 거품. 비 오면 흙탕이라 거품이 짙고, 눈 오면 가라앉는다 */
      refl: !!(REFL() && tp.refl),
      fine: +Math.max(0, FINE() * (w === 'rain' ? 1.3 : (w === 'snow' ? 0.6 : 1))).toFixed(4),
      foam: +Math.max(0, FOAM() * (w === 'rain' ? 1.25 : (w === 'snow' ? 0.7 : 1))).toFixed(4),
      /* 비 오는 흙탕물은 덜 비친다 — 하늘을 덜 섞는다 */
      sky: w === 'rain' ? 0.62 : (w === 'fog' ? 0.72 : 1),
      opacity: Math.max(0, Math.min(1, OPACITY()))
    };
  }

  /* ══ 그림 층 — three 가 있을 때만 산다 ═════════════════════ */

  var T = null;
  var mats = {};                 // 물빛(hex) → ShaderMaterial
  var lastPlan = null, ticks = 0;
  /** 판을 못 만들었으면 왜 그랬나 — 데모·진단이 값으로 본다 */
  var why = '-';
  var asks = 0;
  var clock = 0;

  var VERT = [
    'attribute float foam;',     // W-0140 물가 정점 1(03-props unitGeo 의 disc·shoreW) — 없는 판은 0(defaultAttributeValues)
    'varying float vFoam;',
    'varying vec3 vWorld;',
    '#include <fog_pars_vertex>',
    'void main() {',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWorld = wp.xyz;',
    '  vFoam = foam;',
    '  vec4 mvPosition = viewMatrix * wp;',
    '  gl_Position = projectionMatrix * mvPosition;',
    '  #include <fog_vertex>',
    '}'
  ].join('\n');

  /* 물결 — 방향이 다른 사인 넷.
     높이는 안 쓰고 **기울기(cos)만** 쓴다. 판을 실제로 밀어 올리려면 판이
     잘게 나뉘어 있어야 하는데(지금은 한 장짜리 판이다), 이 카메라 높이에서는
     법선만 흔들어도 물결로 보인다 — 세로로 재는 눈이 없기 때문이다. */
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
    'uniform float uRipple;',
    'uniform float uSkyMix;',
    'uniform float uOpacity;',
    'uniform sampler2D uPano;',
    'uniform float uPanoOn;',
    'uniform float uPanoH;',
    'uniform float uFine;',
    'uniform float uFoam;',
    'varying float vFoam;',
    'varying vec3 vWorld;',
    '#include <fog_pars_fragment>',

    'vec3 waveNormal(vec2 p, float t) {',
    '  vec2 g = vec2(0.0);',
    /* 방향·잔결·빠르기·크기 — 넷을 겹쳐 되풀이가 눈에 안 띄게 한다 */
    '  vec2 d1 = normalize(vec2( 1.00,  0.35));',
    '  vec2 d2 = normalize(vec2(-0.40,  1.00));',
    '  vec2 d3 = normalize(vec2( 0.80, -0.70));',
    '  vec2 d4 = normalize(vec2(-0.90, -0.20));',
    '  g += d1 * 0.115 * 1.00 * cos(dot(p, d1) * 0.115 + t * 0.90);',
    '  g += d2 * 0.190 * 0.62 * cos(dot(p, d2) * 0.190 + t * 1.35);',
    '  g += d3 * 0.360 * 0.32 * cos(dot(p, d3) * 0.360 + t * 2.10);',
    '  g += d4 * 0.620 * 0.16 * cos(dot(p, d4) * 0.620 + t * 3.00);',
    /* 빗방울 — 잔결만 아주 잘게 하나 더 얹는다 (파문 하나하나를 세지 않는다) */
    '  if (uRipple > 0.0) {',
    '    vec2 d5 = normalize(vec2(0.30, 0.95));',
    '    g += d5 * 1.700 * 0.10 * uRipple * cos(dot(p, d5) * 1.700 + t * 7.0);',
    '    vec2 d6 = normalize(vec2(-1.00, 0.20));',
    '    g += d6 * 2.300 * 0.07 * uRipple * cos(dot(p, d6) * 2.300 + t * 9.0);',
    '  }',
    /* W-0140 잔물결 두 겹 — 큰 결 넷 위에 잘게 흐르는 결을 엇갈린 방향으로 얹는다. 멀리선 줄인다(먼 물이 지글거리지 않게) */
    '  float nearF = 1.0 - smoothstep(22.0, 85.0, length(cameraPosition - vWorld));',
    '  vec2 q1 = p * 1.9 + vec2(t * 0.35, t * 0.21);',
    '  vec2 q2 = mat2(0.8, -0.6, 0.6, 0.8) * p * 3.1 - vec2(t * 0.27, -t * 0.40);',
    '  g += (vec2(cos(q1.x + sin(q1.y * 1.3)), cos(q1.y * 1.1 + sin(q1.x * 0.9))) * 0.020 +',
    '        vec2(cos(q2.x * 1.2 + sin(q2.y)), cos(q2.y + sin(q2.x * 1.4))) * 0.012) * nearF * uFine;',
    '  return normalize(vec3(-g.x * uWave * 14.0, 1.0, -g.y * uWave * 14.0));',
    '}',

    'void main() {',
    '  vec3 N = waveNormal(vWorld.xz, uTime);',
    '  vec3 V = normalize(cameraPosition - vWorld);',
    /* 프레넬 — 비스듬히 볼수록 하늘이 비친다. 다만 **절반만 연다** —
       활짝 열면 강이 통째로 하늘색 띠가 된다(눈으로 보고 알았다) */
    '  float f = pow(1.0 - clamp(dot(V, N), 0.0, 1.0), 3.2);',
    '  f = clamp(0.04 + f * 0.55, 0.0, 1.0) * uSkyMix;',
    '  vec3 body = mix(uDeep, uSky, f);',
    /* W-0140 하늘 그림 반사 — 반사 방향의 방위·고도로 그림을 읽는다(skypano3d 규약: 북 +z·동 −x, u = 방위/360, 고도 0 = 그림 지평선 행 uPanoH).
       반사는 해·하늘빛을 또 곱하지 않는다(이미 빛이 든 하늘이다) — 물 몸통만 빛을 받는다 */
    '  vec3 Rf = reflect(-V, N);',
    '  vec2 ruv = vec2(fract(atan(-Rf.x, Rf.z) * 0.15915494), 1.0 - uPanoH * (1.0 - asin(clamp(Rf.y, 0.02, 1.0)) * 0.63661977));',
    '  vec3 refl = texture2D(uPano, ruv).rgb;',
    /* **빛을 물린다.** 이것이 빠지면 물만 빛과 무관한 밝은 파랑으로 떠오른다 —
       옆의 땅은 Lambert 로 해와 하늘을 받는데 물만 안 받기 때문이다.
       처음에 빠뜨렸고, 강이 납작한 파란 띠로 찍혀 나와서 알았다 */
    '  float ndl = max(dot(N, uSunDir), 0.0);',
    '  vec3 lit = uAmbient + uSun * (uSunPow * ndl);',
    '  vec3 col = uPanoOn > 0.5 ? mix(uDeep * lit, refl * 0.92, clamp(f * 1.25, 0.0, 0.8)) : body * lit;',
    /* 윤슬 — 해 쪽으로 반짝인다. 결이 보이라고 봉우리를 넓게 잡았다 */
    '  vec3 H = normalize(uSunDir + V);',
    '  float spec = pow(max(dot(N, H), 0.0), 42.0);',
    /* **해가 닿는 만큼만 반짝인다**(`ndl`). 이걸 안 곱하면 해가 지평선에
       걸린 노을에서 해를 등진 물결까지 반짝여 강이 통째로 주황 불길이 된다 —
       실제로 그렇게 찍혀 나왔다 */
    '  col += uSun * spec * uGlint * ndl * 0.9;',
    /* 물결의 마루를 살짝 들어 준다 — 없으면 결이 색으로만 남아 안 읽힌다 */
    '  float crest = smoothstep(0.86, 0.96, N.y) - smoothstep(0.972, 1.0, N.y);',
    '  col += uSky * crest * 0.30 * uWave * (0.35 + 0.65 * ndl);',
    /* 골은 반대로 눌러 준다 — 마루만 들면 물이 뿌옇게 뜨기만 한다 */
    '  col *= 1.0 - (1.0 - smoothstep(0.80, 0.93, N.y)) * 0.20 * uWave;',
    /* W-0140 물가 거품 띠 — 물가 정점에서 안으로 옅어진다. 결 따라 끊겨 흐르게 사인 둘로 흩는다 */
    '  float fb = smoothstep(0.55, 1.0, vFoam) * uFoam;',
    '  float brk = 0.5 + 0.5 * sin(vWorld.x * 1.7 + uTime * 0.8 + sin(vWorld.z * 1.3 + uTime * 0.5) * 2.0);',
    '  float fa = clamp(fb * (0.5 + 0.5 * brk), 0.0, 1.0);',
    '  col = mix(col, vec3(0.86, 0.91, 0.92) * lit, fa * 0.8);',
    '  gl_FragColor = vec4(col, max(mix(uOpacity, 0.92, f * 0.7), fa * 0.9));',
    '  #include <tonemapping_fragment>',
    '  #include <colorspace_fragment>',
    '  #include <fog_fragment>',
    '}'
  ].join('\n');

  function hexToVec(hex) {
    return new T.Color(hex);
  }

  /**
   * 이 물빛의 재질을 준다 — 없으면 만들고, 있으면 그것을 그대로 준다.
   * **null 을 주면 부르는 쪽이 옛 Lambert 판으로 간다**(되돌아가는 길).
   */
  function material(three, hex) {
    asks++;
    if (!three) { why = 'three 없음'; return null; }
    if (!ON()) { why = '손잡이 0'; return null; }
    var P = global.DG.perf;
    var tier = P && P.tier ? P.tier().key : 'HIGH';
    if (!TIER_WATER[tier] || !TIER_WATER[tier].on) { why = '등급 ' + tier; return null; }
    T = three;
    var key = String(hex);
    if (mats[key]) { return mats[key]; }
    try {
      var uni = T.UniformsUtils.merge([
        T.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uDeep: { value: new T.Color(0x2f6f9e) },
          uSky: { value: new T.Color(0x9fc4e8) },
          uSun: { value: new T.Color(0xfff0c8) },
          uSunDir: { value: new T.Vector3(0.4, 0.8, -0.4) },
          uAmbient: { value: new T.Color(0x6a7a88) },
          uSunPow: { value: 0.6 },
          uWave: { value: 1 },
          uGlint: { value: 1 },
          uRipple: { value: 0 },
          uSkyMix: { value: 1 },
          uOpacity: { value: 0.78 },
          uPano: { value: null },
          uPanoOn: { value: 0 },
          uPanoH: { value: 0.68 },
          uFine: { value: 1 },
          uFoam: { value: 1 }
        }
      ]);
      uni.uDeep.value = hexToVec(hex);
      var m = new T.ShaderMaterial({
        uniforms: uni,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        fog: true,
        /* 옛 판과 같은 이유로 깊이를 안 적는다 — 적으면 물속의 잉어가 통째로 잘린다 */
        depthWrite: false
      });
      m.defaultAttributeValues.foam = [0];   // W-0140 물가 표시 없는 판(plane)은 거품 0
      mats[key] = m;
      return m;
    } catch (e) {
      why = e && e.message ? e.message : '만들다 실패';
      return null;      // 못 만들면 조용히 옛 판으로 (단독판·구형 기기)
    }
  }

  var _sun = null;

  /**
   * 한 프레임 — `world3d` 가 그리기 직전에 부른다.
   * @param dt    초
   * @param light `lightingAt()` 이 준 것 (없으면 아무것도 안 한다)
   */
  function tick(dt, light) {
    if (!T) { return false; }
    var n = 0, k;
    for (k in mats) { if (mats.hasOwnProperty(k)) { n++; } }
    if (!n) { return false; }

    clock += (dt || 0);
    var P = global.DG.perf;
    var p = plan({
      tier: P && P.tier ? P.tier().key : 'HIGH',
      alt: light ? light.alt : undefined,
      weather: light ? light.weather : undefined
    });
    lastPlan = p;

    if (!_sun) { _sun = new T.Vector3(); }
    if (light && light.sun) {
      _sun.set(light.sun.x, light.sun.y, light.sun.z).normalize();
    }

    for (k in mats) {
      if (!mats.hasOwnProperty(k)) { continue; }
      var u = mats[k].uniforms;
      u.uTime.value = clock;
      u.uWave.value = p.wave;
      u.uGlint.value = p.glint;
      u.uRipple.value = p.ripple;
      u.uSkyMix.value = p.sky;
      u.uOpacity.value = p.opacity;
      u.uFine.value = p.fine;
      u.uFoam.value = p.foam;
      /* W-0140 — skypano3d 가 L.pano 에 실어 준 그림을 비춘다(없거나 폰이면 옛 단색 프레넬) */
      var pano = p.refl && light && light.pano ? light.pano : null;
      u.uPano.value = pano; u.uPanoOn.value = pano ? 1 : 0; u.uPanoH.value = (light && light.panoH) || 0.68;
      if (light) {
        /* 하늘빛·햇빛은 그때그때 받아 쓴다 — 물이 저녁이면 저녁빛을 비춘다 */
        u.uSky.value.setHex(light.bg);
        u.uSun.value.setHex(light.sun.hex);
        u.uSunDir.value.copy(_sun);
        /* 옆의 땅과 같은 빛을 받게 한다. 세기는 three 의 Lambert 가 쓰는 1/π 언저리로
           잡고 눈으로 맞췄다 — 똑같을 필요는 없고 **물만 따로 밝지 않으면** 된다 */
        u.uAmbient.value.setHex(light.hemi.sky).multiplyScalar(light.hemi.intensity * 0.42);
        u.uSunPow.value = light.sun.intensity * 0.46;
      }
    }
    ticks++;
    return true;
  }

  function stats() {
    var p = lastPlan, n = 0, k;
    for (k in mats) { if (mats.hasOwnProperty(k)) { n++; } }
    return {
      on: ON(), mats: n, ticks: ticks, why: why, asks: asks,
      wave: p ? p.wave : '-', glint: p ? p.glint : '-',
      ripple: p ? p.ripple : '-', tier: p ? p.tier : '-'
    };
  }

  function dispose() {
    for (var k in mats) {
      if (mats.hasOwnProperty(k) && mats[k].dispose) { mats[k].dispose(); }
    }
    mats = {};
  }

  global.DG = global.DG || {};
  global.DG.water3d = {
    TIER_WATER: TIER_WATER,
    /* 값 층 — three 없이도 돈다 (자가진단이 이것만 따로 본다) */
    plan: plan,
    /* 그림 층 */
    material: material, tick: tick, stats: stats, dispose: dispose,
    /** 진단이 제 뒤를 치울 때 */
    reset: function () { clock = 0; ticks = 0; lastPlan = null; }
  };
})(window);
