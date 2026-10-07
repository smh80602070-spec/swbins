/**
 * 들판 지형 트라이플레이너 블렌드 — SAGA-DESIGN §6.1, PLAN §6.1 항목 5
 * ---------------------------------------------------------------
 * `dungeon3d.js`의 `buildField()`(`fieldJobChunk()`)가 세우는 들판 타일은
 * 칸(chunk)마다 **독립된 평판**(`groundBox`, 높이 `heightAt()`)이라 계단처럼
 * 놓인다 — 인접 칸끼리 높이가 다르면 그 사이에 옆면(수직에 가까운 면)이
 * 드러난다. 옛 `groundMat()`은 재질에 UV 반복만 주는 단색+반점이라 옆면이든
 * 윗면이든 같은 무늬가 늘어나 붙었다(윗면=자연스러움, 옆면=늘어짐). 이 파일은
 * **세 장(잔디·흙·돌)을 실시간으로 블렌드**해 그 자리를 메운다:
 *
 *   - **트라이플레이너**: 월드 좌표를 XY·YZ·XZ 세 방향으로 각각 투영해
 *     샘플링하고, 월드 노멀 성분(|n.x|,|n.y|,|n.z|)으로 가중합한다 —
 *     UV 없이 지오메트리 방향과 무관하게 늘어짐이 없다(경사면·옆면일수록
 *     자동으로 다른 투영이 섞여 든다).
 *   - **경사(slope) 기반**: 노멀의 수직(y) 성분이 작을수록(=수직에 가까운
 *     면, 계단 옆면) 돌 비중을 올린다 — 칸 윗면(수평)은 잔디·흙, 옆면은
 *     자연히 돌로 갈린다.
 *   - **노이즈 블렌드**: 잔디·흙 사이는 별도 절차 노이즈(fbm 2옥타브,
 *     텍스처 fetch 없이 셰이더 안에서 해시로 계산)로 나눠, 칸 경계가 각지지
 *     않고 얼룩처럼 섞인다.
 *
 * `MeshToonMaterial.onBeforeCompile`로 `map_fragment` 청크 하나만 갈아
 * 끼운다 — 조명·톤매핑·안개·그림자 조각은 옛 청크 그대로 손 안 댄다
 * (사가만리 `world3d.js`의 `swayify()`와 같은 요령, 그 파일 참고). 방(room)
 * 바닥의 `dungeon3d.js` `groundMat()`(노이즈 반점)은 이 파일과 무관하게
 * 그대로 남는다 — PLAN §6.1-5가 가리키는 자리는 `buildField()`(들판)뿐이다.
 *
 * three 가 없으면(자가진단) 아무 것도 안 한다.
 */
(function (global) {
  'use strict';

  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }

  var LAND = 'assets/textures/land/';
  var texCache = {};
  function loadTex(name) {
    if (texCache[name]) { return texCache[name]; }
    var t = three();
    if (!t) { return null; }
    var loader = new t.TextureLoader();
    var tex = loader.load(LAND + name);
    tex.wrapS = tex.wrapT = t.RepeatWrapping;
    if (t.SRGBColorSpace) { tex.colorSpace = t.SRGBColorSpace; }
    texCache[name] = tex;
    return tex;
  }

  /* world unit → 텍스처 반복 스케일. `dungeon3d.js`의 `GROUND_TEX_UNIT`(260)과
     같은 눈금(들판 칸 하나=field-instance.js `CHUNK`, 대략 그 자리 크기에
     한 번 반복)을 따른다 — 방 바닥과 들판이 눈으로 볼 때 같은 결로 보이게. */
  var TEX_SCALE = 1 / 220;
  var NOISE_SCALE = 1 / 340;   // 잔디/흙 전환은 텍스처 반복보다 느슨하게(더 큰 얼룩)

  var TRI_UNIFORM_DECL = [
    'varying vec3 vTriWorldPos;',
    'varying vec3 vTriWorldNormal;',
    'uniform sampler2D uGrassMap;',
    'uniform sampler2D uDirtMap;',
    'uniform sampler2D uStoneMap;',
    'uniform float uTexScale;',
    'uniform float uNoiseScale;',
    '',
    'float triHash(vec2 p) {',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',
    'float triNoise(vec2 p) {',
    '  vec2 i = floor(p), f = fract(p);',
    '  float a = triHash(i), b = triHash(i + vec2(1.0, 0.0));',
    '  float c = triHash(i + vec2(0.0, 1.0)), d = triHash(i + vec2(1.0, 1.0));',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;',
    '}',
    'float triFbm(vec2 p) {',
    '  return triNoise(p) * 0.65 + triNoise(p * 2.13 + 11.0) * 0.35;',
    '}',
    'vec3 triSample(sampler2D tex, vec3 wp, vec3 wn, float scale) {',
    '  vec3 bw = pow(abs(wn), vec3(4.0));',
    '  bw /= (bw.x + bw.y + bw.z + 1e-5);',
    '  vec3 cx = texture2D(tex, wp.yz * scale).rgb;',
    '  vec3 cy = texture2D(tex, wp.xz * scale).rgb;',
    '  vec3 cz = texture2D(tex, wp.xy * scale).rgb;',
    '  return cx * bw.x + cy * bw.y + cz * bw.z;',
    '}'
  ].join('\n');

  var TRI_BLEND_BODY = [
    '  vec3 k_wn = normalize(vTriWorldNormal);',
    '  float k_slope = 1.0 - clamp(abs(k_wn.y), 0.0, 1.0);',
    '  float k_rockW = smoothstep(0.15, 0.45, k_slope);',
    '  float k_n = triFbm(vTriWorldPos.xz * uNoiseScale);',
    '  float k_dirtW = smoothstep(0.35, 0.65, k_n) * (1.0 - k_rockW);',
    '  float k_grassW = (1.0 - k_rockW) - k_dirtW;',
    '  vec3 k_grassC = triSample(uGrassMap, vTriWorldPos, k_wn, uTexScale);',
    '  vec3 k_dirtC = triSample(uDirtMap, vTriWorldPos, k_wn, uTexScale);',
    '  vec3 k_stoneC = triSample(uStoneMap, vTriWorldPos, k_wn, uTexScale);',
    '  vec3 k_blend = k_grassC * k_grassW + k_dirtC * k_dirtW + k_stoneC * k_rockW;',
    '  diffuseColor.rgb *= k_blend;'
  ].join('\n');

  /** `onBeforeCompile`의 본체 — 셰이더 문자열 치환만 하는 순수 로직이라
   *  따로 뽑아 뒀다(자가진단이 실제 material·GPU 없이 이 함수만 불러
   *  치환 결과를 값으로 검증할 수 있게). `shader`는 `{vertexShader,
   *  fragmentShader, uniforms}`만 있으면 된다(three 의 실제 셰이더 객체가
   *  아니어도 통한다). */
  function patchShader(shader, grass, dirt, stone) {
    shader.uniforms.uGrassMap = { value: grass };
    shader.uniforms.uDirtMap = { value: dirt };
    shader.uniforms.uStoneMap = { value: stone };
    shader.uniforms.uTexScale = { value: TEX_SCALE };
    shader.uniforms.uNoiseScale = { value: NOISE_SCALE };
    shader.vertexShader = shader.vertexShader
      .replace('varying vec3 vViewPosition;',
        'varying vec3 vViewPosition;\nvarying vec3 vTriWorldPos;\nvarying vec3 vTriWorldNormal;')
      .replace('#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\n\tvTriWorldNormal = normalize( ( modelMatrix * vec4( objectNormal, 0.0 ) ).xyz );')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\n\tvTriWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    shader.fragmentShader = TRI_UNIFORM_DECL + '\n' +
      shader.fragmentShader.replace('#include <map_fragment>', TRI_BLEND_BODY);
    return shader;
  }

  var matCache = {};
  /** 들판 타일 하나에 쓸 트라이플레이너 재질 — hex 는 층 테마 틴트(마을·던전마다
   *  다른 색조)로, `material.color`에 얹혀 블렌드 결과에 곱해진다(옛
   *  `groundMat()`이 노이즈 반점에 색을 곱하던 것과 같은 자리). */
  function fieldGroundMaterial(hex) {
    var t = three();
    if (!t) { return null; }
    var key = (hex >>> 0).toString(16);
    if (matCache[key]) { return matCache[key]; }
    var grass = loadTex('grass.webp'), dirt = loadTex('dirt.webp'), stone = loadTex('stone.webp');
    if (!grass || !dirt || !stone) { return null; }
    var TN = global.DG.toon3d;
    var m = new t.MeshToonMaterial({ color: new t.Color(hex), gradientMap: TN ? TN.ramp() : null });
    m.onBeforeCompile = function (shader) { patchShader(shader, grass, dirt, stone); };
    /* onBeforeCompile 이 셰이더 구조 자체를 바꾸므로 캐시 키를 갈라야 한다
       (사가만리 `world3d.js` swayify() 와 같은 이유) — 텍스처는 유니폼 값일
       뿐이라 재질끼리(테마 색이 달라도) 프로그램은 그대로 나눠 쓴다. */
    m.customProgramCacheKey = function () { return 'terrain3d'; };
    matCache[key] = m;
    return m;
  }

  global.DG = global.DG || {};
  global.DG.terrain3d = {
    fieldGroundMaterial: fieldGroundMaterial,
    patchShader: patchShader,
    ready: function () { return !!three(); },
    /* 자가진단용 — 셰이더 문자열 없이도 노이즈·트라이플레이너 가중치 산식을
       그대로 돌려 값으로 검증할 수 있게 JS로도 같은 식을 낸다(수치만, 이
       함수는 렌더에는 안 쓰인다). */
    _slopeRockWeight: function (normalY) {
      var slope = 1 - Math.min(1, Math.max(0, Math.abs(normalY)));
      var lo = 0.15, hi = 0.45;
      var x = Math.min(1, Math.max(0, (slope - lo) / (hi - lo)));
      return x * x * (3 - 2 * x);   // smoothstep
    }
  };
})(window);
