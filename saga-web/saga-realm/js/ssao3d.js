/**
 * SSAO — 맞닿은 자리에 그늘이 앉는다 (그래픽 보강 17절 6번)
 *
 * **정본은 saga-web/shared/js/ssao3d.js** — 판별 복사본은 tools/sync-shared.mjs 가 만든다(직접 고치지 않는다).
 * 판마다 다른 것은 MEDIUM 등급을 켜느냐뿐이다 — 기본은 끈다(사가나락·사가종횡: LOW→MEDIUM 문턱 비용),
 * 켜는 판은 `core.js` 끝에서 `DG.cfg.ssao = { medium: { on: true, samples: 8, scale: 0.5 } }` 로 준다(사가만리).
 * ---------------------------------------------------------------
 * 후처리 여섯 가지 중 마지막으로 남은 것이다. 앞의 다섯은 `post3d.js` 가 한다.
 *
 * 이 판의 그림자는 **해 그림자 하나**뿐이다(`DirectionalLight` + 그림자 지도).
 * 그래서 해가 안 드는 자리 — 처마 밑, 담과 땅이 만나는 선, 나무 밑동, 성벽이
 * 지면에 닿는 곳 — 이 전부 **똑같이 환하다.** 물건이 땅 위에 얹혀 있지 않고
 * **떠 있는 것처럼** 보이는 까닭이 이것이다. 그 맞닿은 선에만 옅은 그늘을 앉힌다.
 *
 * ── 씬을 한 번 더 안 그린다 ──────────────────────────────
 *
 * `post3d.js` 머리에는 "씬을 한 번 더 그려야 해서 따로 뗀다" 고 적어 두었었다.
 * **안 그래도 됐다.** 후처리가 이미 씬을 렌더 타깃에 그리므로, 그 타깃에
 * **깊이 텍스처(`DepthTexture`)를 하나 붙여** 두면 깊이가 공짜로 남는다.
 * 그래서 이 파일은 **그리기를 한 번도 더 안 한다** — 그 깊이만 읽는다.
 *
 * (three r169 는 표본이 여럿인 타깃도 깊이를 풀어 준다 — `resolveDepthBuffer`.
 *  그래서 MSAA 를 끄지 않아도 된다. 17절 5번 "안티에일리어싱은 지킨다" 와 안 부딪힌다)
 *
 * ── 어떻게 재나 ───────────────────────────────────────────
 *
 *   1 깊이 → **눈 좌표**로 되돌린다 (`projInv`)
 *   2 이웃 둘을 더 되돌려 **법선**을 외적으로 낸다 (미분 확장을 안 쓴다 — 구형 기기)
 *   3 그 법선을 축으로 반구 안에 표본을 흩고, 각 표본이 **가려졌나** 센다
 *   4 얼룩이 지므로 흐린다 (그래서 표본을 적게 써도 된다)
 *
 * **하늘은 절대 안 건드린다.** 깊이가 먼 면(1.0)인 화소는 그늘을 0 으로 둔다 —
 * 안 그러면 하늘이 통째로 어두워져 밤처럼 보인다.
 *
 * 값을 내는 함수(`plan`)는 **three 없이도 돈다** — 자가진단이 그것만 따로 본다.
 * 등급이 LOW 면 통째로 잠든다(`plan().on === false`) — 씬을 두 번 읽는 일이라
 * 느린 기기에서 가장 먼저 뺄 것이다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var CFG = (global.DG.cfg && global.DG.cfg.ssao) || {};

  /* 등급마다 — 표본 수와 재는 해상도 배율.
     절반 해상도로 재고 흐린다: 그늘은 원래 부드러운 것이라 눈에 안 띈다.
     2026-09-08 — 실기기 로그: LOW(post 통째로 꺼짐, ema~17ms 안정)에서
     MEDIUM(post 켜짐)으로 한 단계만 올라가도 끊겼다("뿌옇게 되면
     느려져" 제보). SSAO는 깊이 텍스처를 읽어 표본마다 가려짐을 재고
     흐리는 화면 전체 패스라 이 셋 중 가장 무겁다 — MEDIUM은 꺼서
     LOW→MEDIUM 문턱의 비용을 줄인다. HIGH만 킨다(이 기기가 애초에
     HIGH까지 갈 일은 드물다 — LEVEL_COOLDOWN_UP_MS 참고). */
  var TIER_AO = {
    HIGH:   { on: true,  samples: 12, scale: 0.5 },
    MEDIUM: { on: false, samples: 0,  scale: 0 },
    LOW:    { on: false, samples: 0,  scale: 0 }
  };
  if (CFG.medium) { TIER_AO.MEDIUM = CFG.medium; }   // 판별 설정(사가만리 — MEDIUM 도 켠다)

  function ON() { return core.tuned('ssao3d.on', 1) ? true : false; }
  function RADIUS() { return core.tuned('ssao3d.radius', 2.4); }
  function INTENSITY() { return core.tuned('ssao3d.intensity', 0.85); }
  function BIAS() { return core.tuned('ssao3d.bias', 0.045); }
  function SAMPLES() { return core.tuned('ssao3d.samples', 0); }

  /* ══ 값 층 — three 없이도 돈다 ═══════════════════════════ */

  /**
   * 이 등급·이 창에서 그늘을 어떻게 재나.
   *
   * @param o.tier 'HIGH' | 'MEDIUM' | 'LOW'
   * @param o.w    후처리가 쓰는 렌더 타깃 폭 (px)
   * @param o.h    같은 높이
   */
  function plan(o) {
    o = o || {};
    var tk = TIER_AO[o.tier] ? o.tier : 'HIGH';
    var tp = TIER_AO[tk];
    var live = ON() && tp.on;
    /* 손잡이로 표본 수를 못박을 수 있다(0 이면 등급이 정한 값) */
    var forced = Math.round(SAMPLES());
    var n = live ? (forced > 0 ? forced : tp.samples) : 0;
    var w = live ? Math.max(1, Math.round((o.w || 0) * tp.scale)) : 0;
    var h = live ? Math.max(1, Math.round((o.h || 0) * tp.scale)) : 0;
    /* 창이 아주 작으면 잴 것이 없다 — 흐리기가 화면을 넘어간다 */
    if (live && (w < 16 || h < 16)) { live = false; n = 0; w = 0; h = 0; }
    return {
      on: live, tier: tk, samples: n, scale: tp.scale,
      w: w, h: h,
      radius: Math.max(0.05, RADIUS()),
      intensity: Math.max(0, Math.min(2, INTENSITY())),
      bias: Math.max(0, BIAS())
    };
  }

  /* ══ 그림 층 ══════════════════════════════════════════════ */

  var T = null, rd = null;
  var quadScene = null, quadCam = null, quad = null;
  var rtAO = null, rtBlur = null;
  var matAO = null, matBlur = null;
  var ready = false, failed = false;
  var curW = 0, curH = 0, curN = -1;
  var lastPlan = null, frames = 0;

  var VERT = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* 그늘 재기.
     `AO_SAMPLES` 는 `defines` 로 박아 넣는다 — GLSL ES 1.00 의 for 는 상수 한계만
     받으므로 표본 수를 유니폼으로 넘길 수 없다(넘기면 아예 컴파일이 안 된다) */
  var FRAG_AO = [
    'uniform sampler2D tDepth;',
    'uniform vec2 texel;',
    'uniform mat4 proj;',
    'uniform mat4 projInv;',
    'uniform float radius;',
    'uniform float bias;',
    'uniform float intensity;',
    'varying vec2 vUv;',

    /* 깊이 → 눈 좌표 */
    'vec3 viewAt(vec2 uv, out float raw) {',
    '  raw = texture2D(tDepth, uv).x;',
    '  vec4 clip = vec4(uv * 2.0 - 1.0, raw * 2.0 - 1.0, 1.0);',
    '  vec4 v = projInv * clip;',
    '  return v.xyz / v.w;',
    '}',

    'float hash12(vec2 p) {',
    '  vec3 q = fract(vec3(p.xyx) * 0.1031);',
    '  q += dot(q, q.yzx + 33.33);',
    '  return fract((q.x + q.y) * q.z);',
    '}',

    'void main() {',
    '  float raw;',
    '  vec3 P = viewAt(vUv, raw);',
    /* **하늘은 안 건드린다** — 먼 면은 그늘이 없다 */
    '  if (raw >= 0.9999) { gl_FragColor = vec4(1.0); return; }',
    /* 법선 — 이웃 둘을 더 되돌려 외적. 미분 확장(dFdx)을 안 쓴다 */
    '  float r2;',
    '  vec3 Px = viewAt(vUv + vec2(texel.x, 0.0), r2);',
    '  vec3 Py = viewAt(vUv + vec2(0.0, texel.y), r2);',
    '  vec3 N = normalize(cross(Px - P, Py - P));',
    '  if (N.z < 0.0) { N = -N; }',
    /* 화소마다 돌려 흩는다 — 안 돌리면 같은 무늬가 격자로 남는다 */
    '  float a = hash12(gl_FragCoord.xy) * 6.2831853;',
    '  vec3 rv = vec3(cos(a), sin(a), 0.0);',
    '  vec3 Tn = normalize(rv - N * dot(rv, N));',
    '  vec3 Bn = cross(N, Tn);',
    '  float occ = 0.0;',
    '  for (int i = 0; i < AO_SAMPLES; i++) {',
    '    float fi = (float(i) + 0.5) / float(AO_SAMPLES);',
    '    float ang = float(i) * 2.3999632;',          // 황금각 — 고르게 흩어진다
    '    float rr = sqrt(fi);',
    '    vec3 dir = vec3(cos(ang) * rr, sin(ang) * rr, sqrt(max(0.0, 1.0 - fi)));',
    '    dir = Tn * dir.x + Bn * dir.y + N * dir.z;',
    /* 가까운 쪽에 표본을 더 둔다 — 맞닿은 선이 살아난다 */
    '    vec3 sp = P + dir * (radius * mix(0.22, 1.0, fi));',
    '    vec4 cp = proj * vec4(sp, 1.0);',
    '    vec2 suv = cp.xy / cp.w * 0.5 + 0.5;',
    '    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) { continue; }',
    '    float sr;',
    '    vec3 q = viewAt(suv, sr);',
    '    if (sr >= 0.9999) { continue; }',
    /* 눈 좌표의 z 는 음수다 — **큰 쪽이 가깝다** */
    '    float closer = step(sp.z + bias, q.z);',
    /* 너무 멀리 있는 것에 가려졌다고 치면 물체 뒤로 검은 테가 생긴다 */
    '    float range = smoothstep(0.0, 1.0, radius / max(0.0001, abs(P.z - q.z)));',
    '    occ += closer * range;',
    '  }',
    '  occ = occ / float(AO_SAMPLES);',
    '  gl_FragColor = vec4(vec3(clamp(1.0 - occ * intensity, 0.0, 1.0)), 1.0);',
    '}'
  ].join('\n');

  /* 흐리기 — 4×4 상자 한 번. 표본이 적어 생긴 얼룩을 지운다 */
  var FRAG_BLUR = [
    'uniform sampler2D tSrc;',
    'uniform vec2 texel;',
    'varying vec2 vUv;',
    'void main() {',
    '  float s = 0.0;',
    '  for (int y = -2; y <= 1; y++) {',
    '    for (int x = -2; x <= 1; x++) {',
    '      s += texture2D(tSrc, vUv + vec2(float(x) + 0.5, float(y) + 0.5) * texel).r;',
    '    }',
    '  }',
    '  gl_FragColor = vec4(vec3(s / 16.0), 1.0);',
    '}'
  ].join('\n');

  function shader(frag, uni, defs) {
    return new T.ShaderMaterial({
      uniforms: uni, vertexShader: VERT, fragmentShader: frag,
      defines: defs || {}, depthTest: false, depthWrite: false
    });
  }

  /**
   * 켠다. `post3d` 가 제 렌더러로 부른다 — 여기서 three 를 또 찾지 않는다.
   */
  function init(three, renderer) {
    if (ready || failed) { return ready; }
    if (!three || !renderer) { failed = true; return false; }
    T = three; rd = renderer;
    try {
      quadScene = new T.Scene();
      quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      quad = new T.Mesh(new T.PlaneGeometry(2, 2), null);
      quad.frustumCulled = false;
      quadScene.add(quad);
      matBlur = shader(FRAG_BLUR, {
        tSrc: { value: null }, texel: { value: new T.Vector2() }
      });
    } catch (e) {
      failed = true;
      return false;
    }
    ready = true;
    return true;
  }

  /** 깊이를 담을 텍스처 — `post3d` 가 제 렌더 타깃에 붙인다 */
  function depthTexture(three, w, h) {
    if (!three) { return null; }
    try {
      var d = new three.DepthTexture(Math.max(1, w), Math.max(1, h));
      d.type = three.UnsignedIntType;      // 24비트 — 16비트면 먼 데서 층이 진다
      d.minFilter = three.NearestFilter;
      d.magFilter = three.NearestFilter;
      return d;
    } catch (e) {
      return null;
    }
  }

  function disposeTargets() {
    if (rtAO) { rtAO.dispose(); rtAO = null; }
    if (rtBlur) { rtBlur.dispose(); rtBlur = null; }
    curW = 0; curH = 0;
  }

  function newTarget(w, h) {
    var rt = new T.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
      depthBuffer: false, stencilBuffer: false
    });
    rt.texture.minFilter = T.LinearFilter;
    rt.texture.magFilter = T.LinearFilter;
    rt.texture.generateMipmaps = false;
    return rt;
  }

  /** 표본 수가 바뀌면 셰이더를 다시 짠다 — `defines` 는 컴파일 때 박히기 때문이다 */
  function syncMat(n) {
    if (matAO && curN === n) { return; }
    if (matAO && matAO.dispose) { matAO.dispose(); }
    matAO = shader(FRAG_AO, {
      tDepth: { value: null }, texel: { value: new T.Vector2() },
      proj: { value: new T.Matrix4() }, projInv: { value: new T.Matrix4() },
      radius: { value: 1.6 }, bias: { value: 0.045 }, intensity: { value: 0.6 }
    }, { AO_SAMPLES: n });
    curN = n;
  }

  function blit(mat, target) {
    quad.material = mat;
    rd.setRenderTarget(target || null);
    rd.render(quadScene, quadCam);
  }

  /**
   * 그늘을 잰다.
   *
   * @param depthTex 씬을 그린 렌더 타깃의 깊이 텍스처
   * @param camera   그때 쓴 카메라 (투영 행렬을 읽는다)
   * @param p        `plan()` 이 준 처방
   * @return 그늘 텍스처 (1 = 훤함, 0 = 어두움). 못 재면 null
   */
  function render(depthTex, camera, p) {
    if (!ready || !depthTex || !camera || !p || !p.on) { return null; }
    if (!rtAO || curW !== p.w || curH !== p.h) {
      disposeTargets();
      rtAO = newTarget(p.w, p.h);
      rtBlur = newTarget(p.w, p.h);
      curW = p.w; curH = p.h;
    }
    syncMat(p.samples);

    var u = matAO.uniforms;
    u.tDepth.value = depthTex;
    u.texel.value.set(1 / Math.max(1, p.w), 1 / Math.max(1, p.h));
    u.proj.value.copy(camera.projectionMatrix);
    u.projInv.value.copy(camera.projectionMatrixInverse);
    u.radius.value = p.radius;
    u.bias.value = p.bias;
    u.intensity.value = p.intensity;
    blit(matAO, rtAO);

    matBlur.uniforms.tSrc.value = rtAO.texture;
    matBlur.uniforms.texel.value.set(1 / Math.max(1, p.w), 1 / Math.max(1, p.h));
    blit(matBlur, rtBlur);

    lastPlan = p;
    frames++;
    return rtBlur.texture;
  }

  function stats() {
    var p = lastPlan;
    return {
      on: ON(), ready: ready, failed: failed, frames: frames,
      tier: p ? p.tier : '-',
      samples: p ? p.samples : 0,
      size: rtAO ? (rtAO.width + 'x' + rtAO.height) : '-',
      radius: p ? p.radius : RADIUS(),
      intensity: p ? p.intensity : INTENSITY()
    };
  }

  global.DG = global.DG || {};
  global.DG.ssao3d = {
    TIER_AO: TIER_AO,
    /* 값 층 — three 없이도 돈다 (자가진단이 이것만 따로 본다) */
    plan: plan,
    /* 그림 층 */
    init: init, render: render, depthTexture: depthTexture,
    dispose: disposeTargets, stats: stats,
    available: function () { return ready; },
    last: function () { return lastPlan; }
  };
})(window);
