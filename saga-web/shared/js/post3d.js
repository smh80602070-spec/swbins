/**
 * 후처리 — 톤매핑 · 블룸 · 색보정 (그래픽 보강 16~18절)
 *
 * **정본은 saga-web/shared/js/post3d.js** — 판별 복사본은 tools/sync-shared.mjs 가 만든다(직접 고치지 않는다).
 * 판마다 다른 것은 MEDIUM 등급의 몫뿐이다 — 기본은 사가고 값이고, 더 낮게 잡은 판(사가블로·사가스토리)은
 * `core.js` 끝에서 `DG.cfg.post = { medium: { post, mips, msaa, scale } }` 로 준다. 판마다 달랐던 머리 설명(사가블로·사가스토리 판의
 * 이식 사정·카메라 사정)은 git 이력의 옛 판별 post3d.js 에 있다.
 * ---------------------------------------------------------------
 * 3D 는 PHASE 1~13 으로 다 섰는데, 화면에 **마지막 한 겹**이 없었다. 그린 그림을
 * 그대로 캔버스에 낸다 — 밝은 것이 번지지 않고, 밝기 곡선이 없어 한낮은 들뜨고
 * 밤은 뭉갠다. 등롱 전구가 밤에 **1픽셀짜리 노란 점**으로만 찍히던 것이 그 탓이다.
 *
 * `saga-go 3D graphics up.md` 17절이 준 순서가 과녁이다:
 *
 *   1 Tone Mapping   ← 여기 (**ACES 가 아니다.** 아래 '어느 곡선인가')
 *   2 Bloom          ← 여기
 *   3 Vignette       ← **이미 있다**(`css/style.css` 의 `#vignette`). 셰이더에 또
 *                       넣으면 두 겹이 되어 화면 네 귀가 새까매진다. 손대지 않았다
 *   4 Color Grading  ← 여기 (채도 · 색온도 · 검은 자리 들기)
 *   5 Anti Aliasing  ← **지키는 쪽**이다. 아래 'MSAA' 참고
 *   6 SSAO           ← 다음 단계. 씬을 한 번 더 그려야 해서 따로 뗀다
 *   7 Depth of Field ← 안 넣는다. 이 판의 카메라는 45~60° 로 멀리서 내려다보므로
 *                       초점 밖이 없다 — 넣으면 흐린 것만 늘고 17절의 "게임 화면이
 *                       선명해야 한다" 와 부딪힌다
 *
 * ── three 코어만 쓴다 ────────────────────────────────────
 *
 * `js/vendor/three.iife.js` 는 **코어 빌드**다(r169). `EffectComposer`·`RenderPass`·
 * `UnrealBloomPass` 가 들어 있지 않다(직접 세어 봤다: 0번). 애드온을 새로 받아
 * 넣지 않고 **손으로 짰다** — 그래픽 문서의 "필요하지 않은 dependency 를 설치하지
 * 않는다" 와 이 저장소의 "원작사 에셋을 안 가져온다" 가 같은 줄기다.
 *
 * ── 왜 렌더 타깃을 거치면 순서가 맞나 ────────────────────
 *
 * three r169 의 `WebGLPrograms` 는 이렇게 판단한다(번들에서 확인했다):
 *
 *   toneMapping = NoToneMapping
 *   if (재질이 toneMapped && 지금 그리는 곳이 **캔버스**) toneMapping = renderer.toneMapping
 *
 * 즉 **렌더 타깃에 그릴 때는 톤매핑이 안 걸린다.** 그래서
 *
 *   씬 → 렌더 타깃 : 선형 HDR 이 그대로 남는다(1.0 을 넘는 값이 살아 있다)
 *   합성 → 캔버스  : 여기서 딱 한 번 ACES 를 건다
 *
 * 가 저절로 성립한다. **블룸은 톤매핑 앞에서 더해야 한다** — 뒤에서 더하면 밝은
 * 것이 이미 1.0 으로 눌려 있어 번질 여력이 없다(문턱을 넘는 화소가 사라진다).
 *
 * 덕분에 `renderer.toneMapping` 을 **한 번만 켜고 두 번 다시 안 만진다.** 켜고
 * 끄면 그때마다 씬의 모든 셰이더가 다시 컴파일돼 화면이 한 박자 멎는다
 * (`syncShadow` 가 경계에서 한 번만 갈아 끼우는 그 이유와 같다).
 * 후처리를 끈 자리(LOW 등급 · 손잡이 0)에서도 톤매핑은 그대로 걸린다 —
 * 캔버스에 바로 그리는 길이라 three 가 알아서 건다. **17절 1번은 늘 켜져 있다.**
 *
 * ── 어느 곡선인가 — ACES 로 갔다가 물러섰다 ──────────────
 *
 * 처음에 `ACESFilmicToneMapping` 으로 걸었다. **밤 화면이 망가졌다.** 하늘이
 * 옅은 파랑으로 들려 올라가고 그 앞의 지붕은 그대로 검어서, 마을이 통째로
 * 사라졌다. 등롱의 노란 불은 흰 점이 됐다. 둘을 나란히 찍어 보고서야 알았다.
 *
 * 까닭은 분명하다 — **이 판의 색은 이미 화면색으로 손으로 맞춰 둔 것**이다.
 * `lightingAt` 의 `bg`·`hemi`·`sun` 은 앞선 세션들이 캔버스에 바로 그린 그림을
 * 눈으로 보며 고른 값이다. ACES 는 밝은 실사 장면(1.0 을 훌쩍 넘는 값이 흔한
 * 곳)을 화면에 맞추려고 중간 아래를 눌러 놓는 곡선이라, 이미 맞아 있는 그림에
 * 한 번 더 걸면 대비가 뒤집힌다. 게다가 `/0.6` 이 안에 박혀 있어 노출을 1 로
 * 두어도 실제로는 1.67 배다.
 *
 * 그래서 **`NeutralToneMapping`**(Khronos PBR Neutral)으로 간다. 0.76 아래는
 * 손대지 않고, 그 위만 흰색으로 굴려 준다. 즉
 *
 *   여태의 그림   그대로 남는다
 *   1.0 을 넘던 것  하얗게 잘리지 않고 굴러간다 ← 블룸이 붙을 자리가 생긴다
 *
 * 손잡이 `post3d.tone` 으로 갈아 볼 수 있다(`neutral`·`aces`·`agx`·`cineon`·
 * `reinhard`·`linear`·`none`). **켤 때 한 번만 읽는다** — 도는 중에 바꾸면 씬의
 * 모든 셰이더가 다시 컴파일된다.
 *
 * 색보정도 같은 까닭으로 **속삭이는 세기**다. 채도·색온도를 세게 밀면 앞선
 * 세션들이 맞춰 둔 시각대별 색이 지워진다 — 여기서 할 일은 그 색을 살짝
 * 도드라지게 하는 것뿐이다.
 *
 * ── MSAA — 렌더 타깃을 거치면 계단이 돌아온다 ────────────
 *
 * `WebGLRenderer({ antialias: true })` 는 **캔버스의** 기본 프레임버퍼에만 걸린다.
 * 렌더 타깃으로 우회하는 순간 그 혜택이 사라져 지붕 모서리가 톱니가 된다.
 * `rt.samples` 로 되살린다(등급마다 4 · 2 · 0). 17절 5번은 새로 얻는 것이 아니라
 * **잃지 않는 것**이다.
 *
 * ── 블룸은 어떻게 흐리나 ─────────────────────────────────
 *
 * 가로·세로 가우시안을 층마다 두 장씩 두면 렌더 타깃이 여덟 장이 된다. 대신
 * **내려가며 흐리고 올라오며 더한다**(downsample → upsample-add). 층마다 타깃이
 * 한 장이면 되고, 올라오는 길은 가산 혼합이라 따로 합치는 패스도 없다.
 *
 *   씬 ─(문턱)→ mip0 ─→ mip1 ─→ mip2 ─→ mip3
 *                 ↑더함   ↑더함   ↑더함
 *
 * 문턱은 **무릎(knee)을 둔 부드러운 문턱**이다. 딱 잘라내면 밝기가 조금 흔들릴 때
 * 화소가 문턱을 넘나들며 블룸이 껌뻑인다(걷는 화면에서 바로 보인다).
 *
 * ── 18절 "강한 빛에만" ───────────────────────────────────
 *
 * 문턱을 선형 0.9 근처에 둔다. 이 판에서 그 위로 올라가는 것은
 * **등롱 전구 · 사당 구슬 · 후광 · 빛기둥 · 가산 혼합으로 그린 검기**뿐이다
 * (`pmat(hex,'glow')` 와 `battle3d` 의 `AdditiveBlending`). 햇빛 받은 지붕·흙길은
 * 0.5~0.8 에 머물러 안 번진다 — 재질 값을 한 줄도 안 고치고 18절이 지켜졌다.
 *
 * ── 판정에는 한 줄도 안 닿는다 ───────────────────────────
 *
 * 자가진단(`DG_NO_DRAW`)은 three 를 켜지 않는다. 그래서 이 파일도 다른 3D 파일과
 * 같은 꼴로 갈랐다 — **처방을 내는 함수는 three 없이도 돈다**:
 *
 *   plan(o)              등급·해 고도·천후 → 무엇을 얼마나 걸까
 *   lookAt(alt, wkey)    시각과 날씨의 결 (노출 · 채도 · 색온도 · 검은 자리)
 *   soft(l, thr, knee)   그 밝기가 얼마나 번지나 (문턱 곡선 그 자체)
 *   mipSizes(w, h, n)    층마다의 크기
 *
 * 진단은 이 넷만 값으로 본다. `init`·`draw` 는 three 가 있을 때만 산다.
 * 손잡이 `post3d.on` 을 0 으로 두면 톤매핑만 남고 나머지는 예전 화면 그대로다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var CFG = (global.DG.cfg && global.DG.cfg.post) || {};

  /* ══ 값 층 — three 없이 돈다 ═══════════════════════════════ */

  /** 후처리를 걸까 — 0 이면 톤매핑만 남는다(캔버스에 바로 그리는 길) */
  function ON() { return core.tuned('post3d.on', 1) ? true : false; }
  /** 블룸 세기 배수. 0 이면 블룸만 뺀다 */
  function BLOOM() { return core.tuned('post3d.bloom', 1); }
  /** 번지기 시작하는 밝기(선형). 올리면 아주 강한 빛만 번진다 */
  function THRESHOLD() { return core.tuned('post3d.threshold', 0.9); }
  /** 문턱의 무릎 — 넓을수록 부드럽게 번지기 시작한다 */
  function KNEE() { return core.tuned('post3d.knee', 0.45); }
  /** 노출 배수. 1 이 '여태 그대로' 다 — 곡선이 중간을 안 건드리므로 */
  function EXPOSURE() { return core.tuned('post3d.exposure', 1); }
  /** 어느 톤매핑 곡선인가 — 켤 때 한 번만 읽는다(바꾸면 셰이더가 다 다시 컴파일된다) */
  function TONE() { return core.tuned('post3d.tone', 'neutral'); }
  /** 색보정 세기 0~1. 0 이면 톤매핑만 걸고 색은 안 만진다 */
  function GRADE() { return core.tuned('post3d.grade', 1); }
  /** 카툰(셀셰이딩) 밝기 단수 — 0 이면 끔(기본). 3~6 정도면 만화풍으로 계단진다.
   *  2026-09-06, 사용자 요청("카툰렌더링으로 변경도 되나?") — 재질을 다 바꾸는
   *  대신 이미 있는 합성 셰이더(FRAG_OUT) 맨 끝, 색보정 다음(화면색)에 밝기를
   *  N단으로 양자화하는 한 줄을 얹었다. 손잡이 하나로 켜고 끌 수 있어 기존
   *  사실적인 그림을 그대로 두고 고를 수 있다(그림자·물·후처리는 안 바꿨다). */
  function TOON() { return core.tuned('post3d.toon', 0); }
  /** 렌더 타깃 배율 — 등급이 정한 값에 곱한다(29절의 resolution scale) */
  function SCALE() { return core.tuned('post3d.scale', 1); }

  /**
   * 등급마다 무엇을 켜나 (28·29절).
   *   post   후처리 자체를 걸까
   *   mips   블룸 층 수 — 적으면 번짐이 좁다
   *   msaa   렌더 타깃 표본 수
   *   scale  렌더 타깃 배율
   */
  var TIER_POST = {
    HIGH: { post: 1, mips: 4, msaa: 4, scale: 1 },
    MEDIUM: { post: 1, mips: 3, msaa: 2, scale: 0.85 },
    LOW: { post: 0, mips: 0, msaa: 0, scale: 1 }
  };
  if (CFG.medium) { TIER_POST.MEDIUM = CFG.medium; }   // 판별 설정(사가블로·사가스토리 — MEDIUM 을 LOW 쪽으로 낮춘다)

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /**
   * 시각과 날씨의 결 — **순수 함수다.**
   *
   * `world3d.lightingAt` 이 내는 해 고도(`alt`, -1~1)를 그대로 받는다. 시각대
   * 이름(`phase`)이 아니라 고도로 가르는 까닭: 이름으로 가르면 `day`→`dusk`
   * 경계에서 화면이 **한 프레임에 툭 바뀐다**. 고도는 이어져 있다.
   *
   * @param alt   해 고도 (-1 ~ 1)
   * @param wkey  천후 키 (clear·cloud·rain·wind·fog·snow)
   */
  function lookAt(alt, wkey) {
    var a = (typeof alt === 'number' && isFinite(alt)) ? Math.max(-1, Math.min(1, alt)) : 0.9;
    /* 낮섞임 — `lightingAt` 과 같은 식을 쓴다(따로 정하면 조명과 어긋난다) */
    var k = clamp01((a + 0.14) / 0.62);
    var night = 1 - k;
    /* 노을섞임 — 해가 지평선 가까이 있을 때만 세다 */
    var gold = Math.max(0, 1 - Math.abs(a - 0.10) / 0.36);

    /* **값이 작다.** 앞선 세션들이 시각대마다 맞춰 둔 색을 지우지 않고
       살짝 도드라지게만 한다 — ACES 로 세게 걸었다가 밤을 망가뜨린 그 교훈이다 */
    var out = {
      /* 노출 — 1 이 '여태 그대로'. 노을에만 살짝 올려 역광을 살린다 */
      exposure: 1 + gold * 0.05,
      /* 채도 — 노을에 조금 올리고 밤에 조금 내린다(어두운 데서 눈은 색을 덜 본다) */
      sat: 1 + gold * 0.07 - night * 0.05,
      /* 색온도 — 양수면 따뜻하게(노을), 음수면 차갑게(밤).
         셰이더에서 0.055 를 다시 곱하므로 화면에서는 최대 1.5% 쯤 움직인다 */
      temp: gold * 0.30 - night * 0.14,
      /* 검은 자리 들기 — 밤에 새까만 면이 넓으면 깊이가 안 읽힌다 */
      lift: night * 0.008,
      /* 블룸 세기 결 — 어두울수록 빛이 도드라진다 (여기는 세게 가도 된다.
         문턱을 넘은 것만 번지므로 이미 맞아 있는 색을 안 건드린다) */
      bloom: 0.9 + night * 0.70 + gold * 0.30
    };

    var w = wkey || 'clear';
    if (w === 'rain') {
      /* 젖은 날은 채도가 죽고 차갑다. 대신 **빛이 더 번진다**(물방울) */
      out.sat *= 0.94; out.temp -= 0.08; out.bloom *= 1.25;
    } else if (w === 'snow') {
      /* 눈은 밝아서 노출을 내려야 흰 면이 안 날아간다 */
      out.sat *= 0.96; out.temp -= 0.04; out.bloom *= 1.15; out.exposure *= 0.96;
    } else if (w === 'fog') {
      /* 안개는 이미 뿌옇다 — 번짐을 더하면 형체가 사라진다 */
      out.sat *= 0.92; out.bloom *= 0.65; out.lift += 0.006;
    } else if (w === 'cloud') {
      out.sat *= 0.97; out.bloom *= 0.90;
    }

    out.sat = Math.max(0.4, Math.min(1.6, out.sat));
    out.temp = Math.max(-1, Math.min(1, out.temp));
    out.exposure = Math.max(0.5, Math.min(2.2, out.exposure));
    out.bloom = Math.max(0, out.bloom);
    return out;
  }

  /**
   * 이 밝기가 얼마나 번지나 — **순수 함수다.** 셰이더의 문턱과 같은 식이다.
   * 값이 0 이면 안 번지고, 1 이면 제 밝기 그대로 번진다.
   *
   * 무릎 구간(문턱 앞뒤 `knee`)에서는 이차로 부드럽게 올라간다. 그 위는 그냥
   * 문턱을 넘은 만큼이다.
   */
  function soft(l, thr, knee) {
    var t = (thr === undefined) ? THRESHOLD() : thr;
    var kn = (knee === undefined) ? KNEE() : knee;
    if (!(l > 0)) { return 0; }
    if (kn <= 0) { return l > t ? (l - t) / l : 0; }
    var s = Math.max(0, Math.min(2 * kn, l - t + kn));
    s = s * s / (4 * kn);
    return Math.max(s, l - t) / l;
  }

  /**
   * 블룸 층마다의 크기 — **순수 함수다.** 첫 층이 절반이고 그 아래는 계속 절반이다.
   * 4픽셀보다 작아지면 거기서 멈춘다(1픽셀 타깃은 흐리는 뜻이 없다).
   */
  function mipSizes(w, h, n) {
    var out = [], cw = Math.max(1, Math.floor(w)), ch = Math.max(1, Math.floor(h));
    for (var i = 0; i < (n || 0); i++) {
      cw = Math.max(1, cw >> 1); ch = Math.max(1, ch >> 1);
      if (cw < 4 || ch < 4) { break; }
      out.push({ w: cw, h: ch });
    }
    return out;
  }

  /**
   * 후처리 처방 — **순수 함수다.** three 도 캔버스도 없이 돈다.
   *
   * @param o { tier:'HIGH'|'MEDIUM'|'LOW', alt:해 고도, weather:천후키, w, h }
   */
  function plan(o) {
    o = o || {};
    var tk = TIER_POST[o.tier] ? o.tier : 'HIGH';
    var tp = TIER_POST[tk];
    var look = lookAt(o.alt, o.weather);
    var scale = Math.max(0.5, Math.min(1, tp.scale * SCALE()));
    var w = Math.max(1, Math.round((o.w || 0) * scale));
    var h = Math.max(1, Math.round((o.h || 0) * scale));
    /* 등급이 후처리를 안 켜면 톤매핑만 남는다 — 그때도 노출은 걸린다 */
    var live = ON() && !!tp.post;
    var bl = BLOOM() * look.bloom;
    var mips = live && bl > 0 ? mipSizes(w, h, tp.mips) : [];
    return {
      on: live,
      tier: tk,
      /* 누가 톤매핑을 하나 — 어느 쪽이든 ACES 한 번이다 */
      tone: live ? 'quad' : 'canvas',
      exposure: look.exposure * EXPOSURE(),
      bloom: {
        on: live && mips.length > 0,
        threshold: THRESHOLD(),
        knee: KNEE(),
        /* 층을 올라오며 더한 것을 마지막에 이만큼 섞는다 */
        strength: 0.26 * bl,
        mips: mips
      },
      grade: {
        amount: clamp01(GRADE()),
        sat: look.sat, temp: look.temp, lift: look.lift
      },
      toon: Math.max(0, TOON()),
      msaa: live ? tp.msaa : 0,
      /* 맞닿은 자리의 그늘 — `ssao3d.js` 가 잰다. 여기서는 **켤지 말지**만 안다
         (씬을 그린 타깃에 깊이를 붙여 둬야 하므로 처방에 들어와야 한다) */
      ao: live ? aoPlan(tk, w, h) : { on: false },
      scale: scale, w: w, h: h
    };
  }

  /** 그늘 처방을 `ssao3d` 에게 받는다 — 그 파일이 없으면 그냥 안 건다 */
  function aoPlan(tier, w, h) {
    var A = global.DG.ssao3d;
    if (!A || !A.plan) { return { on: false }; }
    return A.plan({ tier: tier, w: w, h: h });
  }

  /* ══ 그림 층 — three 가 있을 때만 산다 ═════════════════════ */

  var T = null, rd = null;
  var quadScene = null, quadCam = null, quad = null;
  var rtScene = null, mips = [];
  var matBright = null, matDown = null, matUp = null, matOut = null;
  var ready = false, failed = false;
  var curW = 0, curH = 0, curMsaa = -1, curMips = -1, curAO = null;
  var lastPlan = null, drawn = 0;

  var VERT = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}'
  ].join('\n');

  var LUM = 'float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }';

  /* 문턱 패스 — 절반으로 줄이며 밝은 것만 남긴다.
     네 점을 화소 사이에서 뽑으면 겹치는 이중선형 보간이 공짜 흐림을 준다 */
  var FRAG_BRIGHT = [
    'uniform sampler2D tSrc;',
    'uniform vec2 texel;',
    'uniform float threshold;',
    'uniform float knee;',
    'varying vec2 vUv;',
    LUM,
    'void main() {',
    '  vec3 c = texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb;',
    '  c += texture2D(tSrc, vUv + texel * vec2( 1.0, -1.0)).rgb;',
    '  c += texture2D(tSrc, vUv + texel * vec2(-1.0,  1.0)).rgb;',
    '  c += texture2D(tSrc, vUv + texel * vec2( 1.0,  1.0)).rgb;',
    '  c *= 0.25;',
    '  float l = lum(c);',
    /* 무릎을 둔 문턱 — 값 층의 `soft()` 와 같은 식이다 */
    '  float kn = max(knee, 1e-4);',
    '  float s = clamp(l - threshold + kn, 0.0, 2.0 * kn);',
    '  s = s * s / (4.0 * kn);',
    '  float w = max(s, l - threshold) / max(l, 1e-4);',
    '  gl_FragColor = vec4(c * clamp(w, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  /* 내려가는 패스 — 문턱 없이 절반으로 줄이며 흐린다 */
  var FRAG_DOWN = [
    'uniform sampler2D tSrc;',
    'uniform vec2 texel;',
    'varying vec2 vUv;',
    'void main() {',
    '  vec3 c = texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb;',
    '  c += texture2D(tSrc, vUv + texel * vec2( 1.0, -1.0)).rgb;',
    '  c += texture2D(tSrc, vUv + texel * vec2(-1.0,  1.0)).rgb;',
    '  c += texture2D(tSrc, vUv + texel * vec2( 1.0,  1.0)).rgb;',
    '  gl_FragColor = vec4(c * 0.25, 1.0);',
    '}'
  ].join('\n');

  /* 올라오는 패스 — 3×3 천막(tent) 필터로 키우며 **가산 혼합으로 더한다**.
     따로 합치는 패스가 없는 까닭이 이것이다 */
  var FRAG_UP = [
    'uniform sampler2D tSrc;',
    'uniform vec2 texel;',
    'uniform float amount;',
    'varying vec2 vUv;',
    'void main() {',
    '  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;',
    '  c += texture2D(tSrc, vUv + vec2( texel.x, 0.0)).rgb * 2.0;',
    '  c += texture2D(tSrc, vUv + vec2(-texel.x, 0.0)).rgb * 2.0;',
    '  c += texture2D(tSrc, vUv + vec2(0.0,  texel.y)).rgb * 2.0;',
    '  c += texture2D(tSrc, vUv + vec2(0.0, -texel.y)).rgb * 2.0;',
    '  c += texture2D(tSrc, vUv + vec2( texel.x,  texel.y)).rgb;',
    '  c += texture2D(tSrc, vUv + vec2(-texel.x,  texel.y)).rgb;',
    '  c += texture2D(tSrc, vUv + vec2( texel.x, -texel.y)).rgb;',
    '  c += texture2D(tSrc, vUv + vec2(-texel.x, -texel.y)).rgb;',
    '  gl_FragColor = vec4(c * (amount / 16.0), 1.0);',
    '}'
  ].join('\n');

  /**
   * 마지막 합성 — 캔버스에 낸다. 순서가 중요하다:
   *
   *   1 블룸을 더한다      (아직 선형 HDR — 눌리기 전에 더해야 번짐이 산다)
   *   2 톤매핑             (`<tonemapping_fragment>` — three 가 곡선과
   *                        `renderer.toneMappingExposure` 를 같이 물려 준다)
   *   3 감마              (`<colorspace_fragment>` — three 의 sRGB 곡선.
   *                        직접 pow(1/2.2) 로 쓰면 텍스처 해독과 어긋난다)
   *   4 색보정             ← **감마 뒤다.** 여기가 함정이었다
   *
   * 색보정을 3번 앞(선형)에 두었더니 **밤 화면에 파란 안개가 깔렸다.** 까닭:
   * 검은 자리 들기 `lift = 0.008` 을 선형 값에 더하면 sRGB 로 감마를 거치며
   * **0.075(19/255)** 로 부풀어 오른다. 색온도의 0.0077 도 똑같이 부푼다.
   * 눈에는 "화면 전체가 뿌옇게 들렸다" 로만 보이는데 숫자는 0.008 이라 코드만
   * 봐서는 안 잡힌다 — 두 장을 나란히 찍어 보고 알았다.
   *
   * 감마 뒤로 옮기면 0.008 은 화면에서도 0.008(2/255)이다. 채도·색온도·들기는
   * 원래 **화면색을 만지는 일**이므로(실제 색보정 LUT 도 화면색에 걸린다)
   * 이 자리가 옳다.
   */
  var FRAG_OUT = [
    'uniform sampler2D tScene;',
    'uniform sampler2D tBloom;',
    'uniform sampler2D tAO;',
    'uniform float hasAO;',
    'uniform float strength;',
    'uniform float gradeAmt;',
    'uniform float sat;',
    'uniform float temp;',
    'uniform float lift;',
    'uniform float hasBloom;',
    'uniform float toon;',
    'varying vec2 vUv;',
    LUM,
    'void main() {',
    '  vec3 c = texture2D(tScene, vUv).rgb;',
    /* 그늘은 **번지기 전에** 곱한다 — 뒤에 곱하면 어둡게 만든 자리가
       이미 번져 나가 테두리만 밝게 남는다 */
    '  c *= mix(1.0, texture2D(tAO, vUv).r, hasAO);',
    '  c += texture2D(tBloom, vUv).rgb * (strength * hasBloom);',
    '  gl_FragColor = vec4(c, 1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <colorspace_fragment>',
    /* ── 여기부터는 **화면색(sRGB)** 이다. 색보정은 이 자리에서 한다 ── */
    '  vec3 g = gl_FragColor.rgb;',
    '  float l = lum(g);',
    '  vec3 done = mix(vec3(l), g, sat);',
    /* 색온도 — 따뜻하면 붉은 쪽을 올리고 푸른 쪽을 내린다 */
    '  done += vec3(temp, temp * 0.10, -temp) * 0.055;',
    '  done = done * (1.0 - lift) + lift;',
    '  vec3 graded = clamp(mix(g, done, gradeAmt), 0.0, 1.0);',
    /* 카툰 — 밝기를 N단으로 계단지게 양자화한다(색상비는 그대로 두어 색은
       안 바뀌고 명암만 판판해진다). toon<=0.5 면 그대로(끔) */
    '  if (toon > 0.5) {',
    '    float gl = max(lum(graded), 0.0001);',
    '    float steps = toon;',
    '    float qgl = floor(gl * steps + 0.5) / steps;',
    '    graded *= qgl / gl;',
    '  }',
    '  gl_FragColor.rgb = clamp(graded, 0.0, 1.0);',
    '}'
  ].join('\n');

  /** 손잡이 글자 → three 의 곡선 상수. 모르는 이름이면 기본(neutral) */
  function toneOf(name) {
    var m = {
      neutral: 'NeutralToneMapping', aces: 'ACESFilmicToneMapping',
      agx: 'AgXToneMapping', cineon: 'CineonToneMapping',
      reinhard: 'ReinhardToneMapping', linear: 'LinearToneMapping',
      none: 'NoToneMapping'
    };
    var k = m[String(name || '').toLowerCase()];
    if (k && T[k] !== undefined) { return T[k]; }
    return T.NeutralToneMapping !== undefined ? T.NeutralToneMapping : T.LinearToneMapping;
  }

  function shader(frag, uni) {
    return new T.ShaderMaterial({
      uniforms: uni, vertexShader: VERT, fragmentShader: frag,
      depthTest: false, depthWrite: false
    });
  }

  function newTarget(w, h, msaa, depth, wantDepthTex) {
    var rt = new T.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
      type: T.HalfFloatType,          // 1.0 을 넘는 밝기를 담아야 블룸이 산다
      depthBuffer: !!depth,
      stencilBuffer: false
    });
    /* **그늘을 재려면 깊이를 텍스처로 남겨야 한다.** 여기 한 줄 덕분에
       `ssao3d` 는 씬을 한 번도 더 안 그린다 — 이미 그린 것의 깊이를 읽을 뿐이다.
       표본이 여럿인 타깃(MSAA)도 three 가 깊이를 풀어 준다(`resolveDepthBuffer`) */
    if (depth && wantDepthTex) {
      var A = global.DG.ssao3d;
      var dt = A && A.depthTexture ? A.depthTexture(T, w, h) : null;
      if (dt) { rt.depthTexture = dt; }
    }
    rt.texture.minFilter = T.LinearFilter;
    rt.texture.magFilter = T.LinearFilter;
    rt.texture.generateMipmaps = false;
    if (msaa) { rt.samples = msaa; }
    return rt;
  }

  /**
   * 켠다. `world3d` 가 렌더러를 만든 직후 부른다.
   * @param three  THREE (world3d 가 들고 있는 그것 — 여기서 또 찾지 않는다)
   * @param renderer  WebGLRenderer
   */
  function init(three, renderer) {
    if (ready || failed) { return ready; }
    if (!three || !renderer) { failed = true; return false; }
    T = three; rd = renderer;
    try {
      /* 톤매핑을 **여기서 한 번만** 켠다. 후처리를 끄든 켜든 곡선은 늘 걸린다 —
         캔버스에 바로 그리면 three 가, 렌더 타깃을 거치면 마지막 합성이 건다 */
      rd.toneMapping = toneOf(TONE());
      rd.toneMappingExposure = 1;

      quadScene = new T.Scene();
      quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      quad = new T.Mesh(new T.PlaneGeometry(2, 2), null);
      quad.frustumCulled = false;
      quadScene.add(quad);

      matBright = shader(FRAG_BRIGHT, {
        tSrc: { value: null }, texel: { value: new T.Vector2() },
        threshold: { value: 0.9 }, knee: { value: 0.45 }
      });
      matDown = shader(FRAG_DOWN, {
        tSrc: { value: null }, texel: { value: new T.Vector2() }
      });
      matUp = shader(FRAG_UP, {
        tSrc: { value: null }, texel: { value: new T.Vector2() },
        amount: { value: 1 }
      });
      matUp.blending = T.AdditiveBlending;   // 올라오는 길에서 **더한다**
      matOut = shader(FRAG_OUT, {
        tScene: { value: null }, tBloom: { value: null },
        tAO: { value: null }, hasAO: { value: 0 },
        strength: { value: 0.26 }, gradeAmt: { value: 1 },
        sat: { value: 1 }, temp: { value: 0 }, lift: { value: 0 },
        hasBloom: { value: 1 }, toon: { value: 0 }
      });
    } catch (e) {
      failed = true;
      return false;
    }
    /* 그늘도 같은 렌더러로 켠다 — 못 켜지면 조용히 없는 셈 친다 */
    if (global.DG.ssao3d) { global.DG.ssao3d.init(T, rd); }
    ready = true;
    return true;
  }

  function disposeTargets() {
    if (rtScene) { rtScene.dispose(); rtScene = null; }
    for (var i = 0; i < mips.length; i++) { mips[i].dispose(); }
    mips = [];
    curW = 0; curH = 0; curMsaa = -1; curMips = -1; curAO = null;
  }

  /**
   * 렌더 타깃을 처방에 맞춘다. 크기·표본·층수가 그대로면 아무것도 안 한다 —
   * 프레임마다 타깃을 다시 만들면 그것만으로 화면이 멎는다.
   */
  function syncTargets(p) {
    var n = p.bloom.mips.length;
    var wantAO = !!(p.ao && p.ao.on);
    if (rtScene && curW === p.w && curH === p.h && curMsaa === p.msaa &&
        curMips === n && curAO === wantAO) {
      return;
    }
    disposeTargets();
    rtScene = newTarget(p.w, p.h, p.msaa, true, wantAO);
    curAO = wantAO;
    for (var i = 0; i < n; i++) {
      mips.push(newTarget(p.bloom.mips[i].w, p.bloom.mips[i].h, 0, false));
    }
    curW = p.w; curH = p.h; curMsaa = p.msaa; curMips = n;
  }

  /** 전면 사각형을 한 번 그린다 */
  function blit(mat, target, additive) {
    quad.material = mat;
    rd.setRenderTarget(target || null);
    if (additive) { rd.autoClear = false; }
    rd.render(quadScene, quadCam);
    if (additive) { rd.autoClear = true; }
  }

  function texelOf(rt, out) {
    out.set(1 / Math.max(1, rt.width), 1 / Math.max(1, rt.height));
    return out;
  }

  var tmpTexel = null;

  /**
   * 이번 프레임을 후처리로 낸다.
   *
   * @return true 면 이미 화면에 냈다. false 면 부르는 쪽이 곧바로 그려야 한다
   *         (등급이 LOW 거나 손잡이가 0 이거나, 켜지지 못했을 때)
   */
  /** SAGA-DESIGN §8-6 — 렌더 타깃·셰이더가 실패하면(폰 GPU 드라이버 등) 후처리를
   *  영구히 끄고 바로 그리는 길로 돌려보낸다. "갈색/녹색 화면" 류가 이 자리다.
   *  실제 처리는 `drawInner`, 여기는 그 둘레의 그물이다 */
  function draw(renderer, scene, camera, light) {
    if (!ready || !renderer || !scene || !camera) { return false; }
    try {
      return drawInner(renderer, scene, camera, light);
    } catch (e) {
      disposeTargets();
      ready = false;
      failed = true;
      var E = global.DG.errlog;
      if (E) { E.record({ kind: 'post3d', msg: (e && e.message) || String(e), stack: (e && e.stack) || '' }); }
      return false;
    }
  }

  function drawInner(renderer, scene, camera, light) {
    var P = global.DG.perf;
    var size = renderer.getDrawingBufferSize(new T.Vector2());
    var p = plan({
      tier: P ? P.tier().key : 'HIGH',
      alt: light ? light.alt : undefined,
      weather: light ? light.weather : undefined,
      w: size.x, h: size.y
    });
    lastPlan = p;
    /* 노출은 어느 길로 가든 여기서 물린다 — three 가 톤매핑에 같이 넘긴다 */
    renderer.toneMappingExposure = p.exposure;
    if (!p.on) {
      /* 후처리를 안 건다. 타깃을 붙들고 있을 까닭이 없으니 놓아 준다 */
      if (rtScene) { disposeTargets(); }
      return false;
    }
    if (!tmpTexel) { tmpTexel = new T.Vector2(); }
    syncTargets(p);
    if (!rtScene) { return false; }

    /* ① 씬 → 렌더 타깃. 톤매핑이 **안 걸린다**(선형 HDR 이 남는다) */
    renderer.setRenderTarget(rtScene);
    renderer.render(scene, camera);

    /* ①' 그늘 — 방금 그린 것의 **깊이만** 읽는다 (씬을 또 그리지 않는다) */
    var aoTex = null;
    var A = global.DG.ssao3d;
    if (A && p.ao && p.ao.on && rtScene.depthTexture) {
      aoTex = A.render(rtScene.depthTexture, camera, p.ao);
    }

    /* ② 문턱 → 첫 층 */
    var n = mips.length, i;
    if (n > 0) {
      matBright.uniforms.tSrc.value = rtScene.texture;
      matBright.uniforms.threshold.value = p.bloom.threshold;
      matBright.uniforms.knee.value = p.bloom.knee;
      texelOf(rtScene, matBright.uniforms.texel.value);
      blit(matBright, mips[0]);

      /* ③ 내려간다 */
      for (i = 0; i < n - 1; i++) {
        matDown.uniforms.tSrc.value = mips[i].texture;
        texelOf(mips[i], matDown.uniforms.texel.value);
        blit(matDown, mips[i + 1]);
      }
      /* ④ 올라오며 더한다 */
      for (i = n - 1; i > 0; i--) {
        matUp.uniforms.tSrc.value = mips[i].texture;
        texelOf(mips[i], matUp.uniforms.texel.value);
        matUp.uniforms.amount.value = 1;
        blit(matUp, mips[i - 1], true);
      }
    }

    /* ⑤ 합성 → 캔버스 */
    matOut.uniforms.tScene.value = rtScene.texture;
    matOut.uniforms.tAO.value = aoTex || rtScene.texture;
    matOut.uniforms.hasAO.value = aoTex ? 1 : 0;
    matOut.uniforms.tBloom.value = n > 0 ? mips[0].texture : rtScene.texture;
    matOut.uniforms.hasBloom.value = n > 0 ? 1 : 0;
    matOut.uniforms.strength.value = p.bloom.strength;
    matOut.uniforms.gradeAmt.value = p.grade.amount;
    matOut.uniforms.sat.value = p.grade.sat;
    matOut.uniforms.temp.value = p.grade.temp;
    matOut.uniforms.lift.value = p.grade.lift;
    matOut.uniforms.toon.value = p.toon;
    blit(matOut, null);

    drawn++;
    return true;
  }

  /** 창이 바뀌었다 — 다음 프레임에 타깃을 다시 잡게 한다 */
  function resize() { curW = 0; curH = 0; }

  function stats() {
    var p = lastPlan;
    return {
      ready: ready, failed: failed, frames: drawn,
      on: p ? p.on : ON(),
      tier: p ? p.tier : '-',
      tone: TONE(),
      size: rtScene ? (rtScene.width + 'x' + rtScene.height) : '-',
      msaa: curMsaa < 0 ? '-' : curMsaa,
      mips: mips.length,
      exposure: p ? +p.exposure.toFixed(2) : '-',
      bloom: p ? +p.bloom.strength.toFixed(3) : '-',
      ao: p && p.ao && p.ao.on ? (p.ao.samples + '표본 ' + p.ao.w + 'x' + p.ao.h) : 'off',
      sat: p ? +p.grade.sat.toFixed(2) : '-',
      temp: p ? +p.grade.temp.toFixed(2) : '-'
    };
  }

  global.DG = global.DG || {};
  global.DG.post3d = {
    /* 값 층 — three 없이도 돈다(자가진단이 이것만 따로 본다) */
    plan: plan, lookAt: lookAt, soft: soft, mipSizes: mipSizes,
    TIER_POST: TIER_POST,
    /* 그림 층 */
    init: init, draw: draw, resize: resize, stats: stats,
    available: function () { return ready; },
    /** 지금 처방 (데모·어드민이 들여다본다) */
    last: function () { return lastPlan; },
    dispose: disposeTargets
  };
})(window);
