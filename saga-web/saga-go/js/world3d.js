/**
 * 3D 렌더러 — 원작의 화면을 WebGL 로 옮긴다
 * ---------------------------------------------------------------
 * 여태 화면은 캔버스 2D 였다. 2.5D·3D 모드도 스프라이트를 원근으로 **세워 그린**
 * 가짜였다(`world.js` 의 `project()`). 원작은 지도 위에 진짜 3D 가 서 있고,
 * 그림자가 지면에 지고, 카메라가 낮게 깔려 따라다닌다. 그 층을 여기 만든다.
 *
 *   지면    실제 지도 타일을 **평면에 텍스처로** 깐다 (타일을 못 받으면 절차적 지형)
 *   사물    지도에 높이 정보가 없으니 `terrainAt` 격자로 **절차적으로 세운다**(`propPlan`)
 *   인물·짐승  `actor3d.js` 가 **도형으로 조립한 입체**를 세운다 (빌보드는 되돌림용)
 *   조명    시각과 천후를 보고 해가 뜨고 진다 (`lightingAt`)
 *   카메라  플레이어를 뒤에서 낮게 본다. 조우가 열리면 그쪽으로 다가간다
 *
 * **판정에는 한 줄도 닿지 않는다.** 좌표·스폰·거리는 전부 `world.js` 의 것을 읽기만
 * 하고, 여기서 만든 값은 화면에만 쓴다. 그래서 자가진단(`DG_NO_DRAW`)은 이 파일을
 * 켜지도 않고, 켜지지 않아도 게임은 그대로 돈다 — 대신 **값을 내는 함수**
 * (`lightingAt`·`propPlan`·`camAim`)는 three 없이도 돌아 진단이 그것만 따로 본다.
 *
 * WebGL 이 없거나 켜다 실패하면 **조용히 2D 로 돌아간다**(`available()` 이 false).
 * three.js 는 `js/vendor/three.iife.js` 한 덩이로 들어 있다 — PC 단독판이 `file://`
 * 로 열리는데 거기서는 `<script type="module">` 이 막히기 때문이다(그래서 IIFE 다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var T = null;                 // THREE (없으면 이 모듈은 통째로 잠든다)
  var renderer = null, scene = null, camera = null;
  var sun = null, sky = null;
  var groundGroup = null, propGroup = null, actorGroup = null, fxGroup = null;
  var tileMeshes = {};          // 지면 타일 { key: Mesh }
  var propMeshes = {};          // 건물·나무 { key: Object3D }
  var townDens = {};            // 'gx:gy' → 그 마을 칸을 지을 때 쓴 밀도(houseRects 가 보이는 집과 같은 계획을 뽑게)
  var actors = {};              // 배우 { key: {node, shadow, seen, …} }
  var texCache = {};            // 캔버스/이미지 텍스처
  var ready = false, failed = false;
  var canvas = null;
  var frame = 0;
  var lightNow = null;          // 이번 프레임의 조명 (probe 가 들여다본다)

  /* ── 규칙 값 (화면에만 쓰는 값이라 손잡이로 열어 둔다) ── */

  function TILE_SPAN() { return core.tuned('world3d.tileSpan', 3); }      // 타일 반경(장)
  /** 버거우면 스스로 깎는 배수 (`perf.js`) — 없으면 1 이라 예전과 같다 */
  function PF(key) { var P = global.DG.perf; return P ? P.mul(key) : 1; }
  function PROP_R() { return core.tuned('world3d.propRadius', 260) * PF('radius'); }
  /* 부수는 반경 — 짓는 반경(R)보다 크게 잡아 경계에서 왕복해도 짓고 부수고를
     되풀이하지 않는다 (PLAN 42절 ACTIVE/VISIBLE/UNLOAD) */
  function PROP_UR(R) { return R * core.tuned('world3d.unloadRadius', 1.4); }
  /** 잔 사물(나무·바위·풀)의 **진짜 모델**을 받는 거리(m, PLAN 36절 LOD).
   * 이 밖은 곧장 싼 도형(원뿔·공)으로 선다 — 진짜 모델은 도형보다 삼각형이
   * 백 배다(`prop3d.js` 의 `ON()` 과 같은 사정이지만, 그건 기기 등급으로
   * 가르고 이건 **거리**로 가른다) */
  function LOD_NEAR() { return core.tuned('world3d.lodNear', 90) * PF('radius'); }
  /** 잎·풀이 바람에 흔들릴까(PLAN 44절) — 0 이면 정지 화면(느린 기기용) */
  function SWAY_ON() { return core.tuned('world3d.sway', 1) ? true : false; }
  /** 흔들리는 폭(정점 좌표 배율) — 크면 과장되게 흔든다 */
  function SWAY_AMT() { return core.tuned('world3d.swayAmt', 0.06); }
  /** 등롱·사당 불이 일렁일까(PLAN 44절 "불꽃") — 0 이면 고정 밝기 */
  function FLAME_ON() { return core.tuned('world3d.flame', 1) ? true : false; }
  /** 일렁이는 폭(emissiveIntensity 배율) */
  function FLAME_AMT() { return core.tuned('world3d.flameAmt', 0.18); }
  /** 등롱·사당 위에 연기가 오를까(PLAN 44절) — 불과 같은 밤에만 보인다 */
  function SMOKE_ON() { return core.tuned('world3d.smoke', 1) ? true : false; }
  function CAM_DIST() { return core.tuned('world3d.camDist', 40); }       // 카메라 거리(m)
  function CAM_HIGH() { return core.tuned('world3d.camHeight', 15); }     // 카메라 높이(m)
  /** 사람 키(m) — 원작처럼 지도 위에서는 실제보다 크게 세운다(1.8m 면 안 보인다) */
  function ACTOR_H() { return core.tuned('world3d.actorH', 3.4); }
  /** 배우를 도형으로 세울까 — 0 이면 1단계의 빌보드로 돌아간다 */
  function MESH_ON() {
    var P = global.DG.perf;
    if (P && !P.meshOk()) { return false; }      // 가장 버거울 때는 빌보드로 돌아간다
    return core.tuned('world3d.mesh', 1) ? true : false;
  }
  /** 건물 밀도 배수 — 기기가 버거우면 여기를 내린다 */
  function DENSITY() { return core.tuned('world3d.density', 1) * PF('prop'); }
  /** 시각을 따라 해가 뜨고 질까 — 0 이면 늘 한낮.
   * 2026-08-30에 기본을 껐었다 — 밤을 다섯 번 밝혀도(색·세기·깊은밤 감쇠
   * 다 낮 수준까지 밀었다) 사용자가 실기기에서 계속 어둡다고 했고, 결국
   * "밤을 낮으로 바꿔 달라"고 해서 아예 밤 자체를 없앴었다.
   * **2026-09-10, 다시 켰다** — "지도도 더 자연스럽게 … 별도 보이고" 요청으로
   * 별(`sky3d.js`)을 넣으려면 밤이 실제로 뜻이 있어야 했다. 사용자가 "밤이라도
   * 밝게 해, 잘 보이게"로 확인 — 그래서 그날 최대한 밝혀 둔 밤 세기·색은
   * 한 글자도 안 건드렸다(아래 `lightingAt` 의 밤 최저치 주석 그대로), 사이클
   * 자체만 되살렸다. 손잡이는 그대로 있으니 0 으로 내리면 다시 늘 한낮이다 */
  function DAYNIGHT() { return core.tuned('world3d.dayNight', 1) ? true : false; }
  /** 비·눈에 강물이 불까 — 0 이면 늘 마른 날의 그림이다 */
  function WET() { return core.tuned('world3d.wetRiver', 1) ? true : false; }
  /** 세로 화면에서 카메라를 물릴까 — 0 이면 옛 그림(폰에서 지형지물이 화면을 덮는다) */
  function PORTRAIT_FIT() { return core.tuned('world3d.portraitFit', 1) ? true : false; }
  /** 물리는 정도의 상한(배) — 1 이면 안 물린다 */
  function PORTRAIT_MAX() { return core.tuned('world3d.portraitMax', 1.8); }

  /** 기본 시야각(도) — 가로 화면에서 쓰던 값 */
  function FOV() { return core.tuned('world3d.fov', 52); }
  /** 세로 화면에서 벌릴 수 있는 시야각의 상한(도) */
  function FOV_MAX() { return core.tuned('world3d.fovMax', 80); }

  /* 이 판의 거리·높이 값은 **PC 가로 화면**에서 잡혔다. three 의 fov 는 세로
     기준이라, 세로로 긴 폰(가로세로비 0.53)에서는 가로 시야가 PC 의 절반 밑으로
     좁아진다 — 같은 자리인데 건물과 나무가 화면을 덮는다.
     **카메라를 물리지는 않는다.** 물려 봤더니 안개(lightingAt 의 fog)가 가로
     화면 거리에 맞춰져 있어 화면이 통째로 하얘졌다 — 실제로 찍어 보고 접은 길이다.
     대신 **시야각만 벌린다**: 카메라는 제자리라 안개도 그림자 상자도 그대로다.
     REF 는 그 거리 값들이 잡힌 화면의 가로세로비다. */
  var REF_ASPECT = 1.5;
  var DEG = 180 / Math.PI;
  /** 이 화면에서 쓸 시야각(도). 가로 화면이면 기본값 그대로 */
  function fovFor(w, h) {
    var base = FOV();
    if (!PORTRAIT_FIT() || !w || !h) { return base; }
    var a = w / h;
    if (a >= REF_ASPECT) { return base; }
    /* 제곱근을 쓴다 — 가로 시야를 그대로 되찾으려면 폰에서 112도가 되어 휜다 */
    var mul = Math.min(PORTRAIT_MAX(), Math.sqrt(REF_ASPECT / a));
    var t = Math.tan(base / 2 / DEG) * mul;
    return Math.min(FOV_MAX(), 2 * Math.atan(t) * DEG);
  }

  /** 3D 로 그릴까 — 손잡이로 끌 수 있다(0 이면 예전 2D 화면) */
  function wanted() { var S = core.save && core.save.settings; return core.tuned('world.render3d', 1) && !(S && S.tilt === 0) ? true : false; }   // 시점 2D(tilt 0) = 2D 캔버스 판(W-0019 — "2D 단추를 누르면 전체가 2D")

  function available() { return ready && !failed; }
  function active() { return available() && wanted(); }

  /* ── 시간대 조명 ──────────────────────────────────────────
   * 원작에서 저녁에 나가면 화면이 저녁이다. 그 하나가 "지금 밖에 있다" 를 만든다.
   * 여기서는 **시각과 천후만 보고** 값을 낸다 — three 도 세이브도 안 본다.
   * 그래서 자가진단이 이 함수만 따로 굴려 볼 수 있다.
   */
  /* 시간대 빛 값(mixHex·lum·색 표·lightingAt)은 순수 함수라 world3d-light.js 로 떼어 냈다(W-0110, 큰 파일 줄 수) */
  var W3L = global.DG.w3light, mixHex = W3L.mixHex, lum = W3L.lum, lightingAt = W3L.lightingAt;

  /* 데모가 밤·노을을 눈으로 확인할 때 쓰는 문 — 게임에서는 늘 null 이라 진짜 시계를 본다
     (`weather.force` 와 같은 방식이다: 밖에서 함수를 갈아 끼우면 안쪽 호출이 안 바뀐다) */
  var forcedMs = null;
  function forceTime(ms) {
    forcedMs = (ms === null || ms === undefined) ? null : ms;
    return forcedMs;
  }

  function weatherKey() {
    var FRw = global.DG.frost;
    if (FRw && FRw.snowingHere && FRw.snowingHere()) { return 'snow'; }   // §5 ⑲-27 서리봉 고원 안에서만 눈
    var W = global.DG.weather;
    return W ? W.current().key : 'clear';
  }

  /**
   * HDRI 환경광(IBL) — Poly Haven CC0 "Alps Field"(사가마을이 이미 쓰는 파일을
   * 그대로 재사용, `assets/ASSET_LICENSES.md` 참고). 2026-09-04, 사용자가
   * "재질을 실사처럼" 요청해 얹는다. **하늘 색은 안 바꾼다** — `scene.background`
   * 는 그대로 `lightingAt()` 의 시각별 색에 맡기고, `scene.environment` 에만
   * 물려 PBR 재질(GLB 인물·건물)의 반사·거칠기만 사실적으로 만든다.
   *
   * **밤에 대낮 하늘이 그대로 비치면 안 된다** — 이 판은 예전에 ACES
   * 톤매핑을 걸었다가 밤 화면이 통째로 날아간 사고를 겪었다(`post3d.js`
   * 머리말 "ACES 로 갔다가 물러섰다" 참고). 같은 사고를 되풀이하지 않으려고
   * 톤매핑 곡선은 손 안 대고, 대신 환경광 **세기 자체**를 `syncLight()` 에서
   * `hemi.intensity`(이미 낮·밤·날씨별로 손으로 맞춰 둔 그 곡선)에 비례해
   * 매 프레임 같이 낮춘다/올린다 — 이 판의 밤은 원래도 그리 어둡지 않게
   * 맞춰져 있어(`lightingAt` 의 밤 최저치 주석 참고) 낮과 크게 다투지 않는다.
   * 못 받아도(느린 회선·file:// 단독판 등) 조용히 넘어가고 옛 조명만으로 돈다.
   */
  var IBL_SRC = 'assets/hdri/alps_field_1k.hdr';
  function IBL_ON() { return core.tuned('world3d.ibl', 1) ? true : false; }
  /** 얼마나 세게 섞나 — hemi.intensity(대략 1.4~1.7) 에 곱하는 비율.
   *  너무 세면 반사가 재질 색을 삼킨다(눈으로 보고 0.30으로 정함) */
  function IBL_SCALE() { return core.tuned('world3d.iblScale', 0.30); }
  function loadEnvironment() {
    if (!IBL_ON() || !T.RGBELoader || !T.PMREMGenerator || !renderer) { return; }
    var pmrem = new T.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    new T.RGBELoader().load(IBL_SRC, function (hdr) {
      var envMap = pmrem.fromEquirectangular(hdr).texture;
      if (scene) { scene.environment = envMap; }
      hdr.dispose();
      pmrem.dispose();
    }, undefined, function () { pmrem.dispose(); });
  }

  /* ── 켜기 ─────────────────────────────────────────────── */

  function init(cv) {
    if (ready || failed) { return available(); }
    T = global.THREE || null;
    canvas = cv || document.getElementById('map3d');
    if (!T || !canvas) { failed = true; return false; }
    try {
      /* `preserveDrawingBuffer` — 평소에는 끈다(빠르다). 헤드리스 스크린샷에서는
         **켜야 한다**: WebGL 은 그린 직후 버퍼를 비우므로, rAF 가 거의 돌지 않는
         그 환경에서는 캡처 시점에 빈 캔버스가 찍힌다(밟아 본 함정이다).
         데모 페이지가 `DG_3D_PRESERVE` 로 켠다. */
      renderer = new T.WebGLRenderer({
        canvas: canvas, antialias: true, alpha: false,
        preserveDrawingBuffer: !!global.DG_3D_PRESERVE
      });
      /* SAGA-DESIGN §6.1 "저비용 통일" — 픽셀 비율 상한 1.5(옛 2는 폰에서 과잉 렌더) */
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = T.SRGBColorSpace;
      /* 디버그: 그림자·안개를 끊어 원인을 좁힐 수 있게 (DG_3D_DEBUG) */
      if (!(global.DG_3D_DEBUG || {}).noShadow) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
      }
    } catch (e) {
      failed = true;
      return false;
    }

    scene = new T.Scene();
    /* 카메라가 낮으면 지평선 위가 보인다 — 검정이 아니라 하늘이 있어야 한다.
       안개는 그 하늘색으로 멀리서 스며들게 해 경계가 드러나지 않게 한다. */
    var L0 = lightingAt(undefined, weatherKey());
    var skyCol = new T.Color(L0.bg);
    scene.background = skyCol;
    renderer.setClearColor(skyCol, 1);       // background 와 별개로 못박아 둔다
    if (!(global.DG_3D_DEBUG || {}).noFog) {
      scene.fog = new T.Fog(L0.bg, L0.fog.near, L0.fog.far);
    }

    camera = new T.PerspectiveCamera(
      fovFor(canvas.clientWidth || global.innerWidth, canvas.clientHeight || global.innerHeight),
      1, 0.5, 1400);

    /* 빛은 둘뿐이다 — 하늘/땅에서 오는 반사광과, 그림자를 만드는 해 하나 */
    sky = new T.HemisphereLight(L0.hemi.sky, L0.hemi.ground, L0.hemi.intensity);
    scene.add(sky);
    sun = new T.DirectionalLight(L0.sun.hex, L0.sun.intensity);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -140;
    sun.shadow.camera.right = 140;
    sun.shadow.camera.top = 140;
    sun.shadow.camera.bottom = -140;
    sun.shadow.bias = -0.0012;
    scene.add(sun);
    scene.add(sun.target);
    /* 배우를 따라다니며 머리 위에 뜨던 등롱 불빛은 뺐다(2026-08-29) — 사용자가
       실기기에서 허공에 뜬 빛 덩이로 보인다고 지적했다. 밤 자체가 이제
       충분히 밝아(위 lightingAt 의 최저치) 따로 안 켜도 배우가 묻히지 않는다 */

    /* 후처리 — 톤매핑·블룸·색보정 (`post3d.js`, 그래픽 보강 16~18절).
       **렌더러를 만든 직후 켜야 한다** — 여기서 `toneMapping` 을 한 번 켜 두면
       뒤에 만드는 재질이 모두 그 상태로 컴파일된다. 늦게 켜면 씬 전체가
       한 번 다시 컴파일되며 화면이 멎는다 */
    if (global.DG.post3d) { global.DG.post3d.init(T, renderer); }
    loadEnvironment();

    groundGroup = new T.Group(); scene.add(groundGroup);
    propGroup = new T.Group(); scene.add(propGroup);
    actorGroup = new T.Group(); scene.add(actorGroup);
    fxGroup = new T.Group(); scene.add(fxGroup);

    bindEvents();
    /* 소품 모델(나무·바위·풀)을 미리 받아 둔다 — 안 받아 두면 처음 몇 초 동안
       원뿔 나무가 서 있다가 툭 바뀐다 (`prop3d.js`) */
    if (global.DG.prop3d) { global.DG.prop3d.preload(); }
    preloadLandTex();
    ready = true;
    resize();
    return true;
  }

  function resize() {
    if (!available() || !canvas) { return; }
    var w = canvas.clientWidth || global.innerWidth;
    var h = canvas.clientHeight || global.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.fov = fovFor(w, h);
    camera.updateProjectionMatrix();
    if (global.DG.post3d) { global.DG.post3d.resize(); }
  }

  /* 좌표 — world.js 는 미터 평면(x 동쪽, y 남쪽)이고 3D 는 y 가 높이다.
     **(x, y) → (x, 0, y)** 로 그대로 눕힌다. 축을 다시 정의하지 않는다. */

  /* ── 지면 ─────────────────────────────────────────────── */

  function tileTexture(img) {
    if (!img || !img.ready) { return null; }
    var key = img.src;
    if (texCache[key]) { return texCache[key]; }
    var tex = new T.Texture(img);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    texCache[key] = tex;
    return tex;
  }

  /* ── 손으로 그린 땅을 지면에 칠한다 ─────────────────
   * 여태 이 땅(`land.js`)은 **사물로만** 드러났다 — 판교 지도 위에 하북 마을의
   * 기와집이 서 있는 꼴이었다. 지면 그림 자체를 맞춘다.
   *
   * 지도 타일을 캔버스에 그대로 굽고, 그 위에 **48m 격자마다 제 색을 덧칠**한다.
   * 지도가 안 왔으면 색만 칠한다 — 오프라인에서도 이 땅은 이 땅으로 보인다.
   *
   * **가장자리는 흐린다.** 딱 잘리면 종이를 오려 붙인 것으로 보인다 —
   * 이웃 넷 중 몇이 이 땅인지 세어 그만큼만 진하게 칠한다.
   */
  var LAND_COLOR = {
    grass: '#8fae6a', forest: '#5c7f4e', mount: '#9a9188',
    water: '#4a7fa6', road: '#c9bfa8', town: '#c2b49a', farm: '#7f9c5e'
  };
  /** 덧칠을 할까 — 0 이면 예전처럼 실제 지도만 깔린다 */
  function LAND_PAINT() { return core.tuned('world3d.landPaint', 1) ? true : false; }
  /** 얼마나 진하게 — 1 이면 지도가 아예 안 비친다 */
  function PAINT_A() { return core.tuned('world3d.landPaintAlpha', 0.88); }

  /* ── 땅의 소재 텍스처 (2026-08-30, PLAN 부록 "코드로 그리지 말고 에셋으로") ──
   * 여태 `LAND_COLOR` 로 **색만** 칠했다. ambientCG(CC0) 1K BaseColor 를 종류마다
   * 하나씩 받아 캔버스 패턴으로 반복해 깐다 — `water` 는 뺐다(실제 물결은
   * `water3d.js` 가 따로 그리므로 이 칠은 거의 안 보인다).
   * 아직 못 받았으면(로딩 중·파일 없음) 늘 하던 `shadeHex` 채색으로 물러난다 —
   * 화면이 한 번도 안 빈다(이 저장소의 다른 에셋들과 같은 원칙). */
  /* 2026-09-05, "바닥이 네모만 있는게 아니라 다양하게" — 종류마다 사진을
   * **한 장만** 반복해 깔면 넓은 들판에서 같은 무늬가 계속 되풀이돼(12m마다
   * 정확히 같은 사진) 눈에 "네모"로 보인다. 종류마다 ambientCG(CC0) 사진을
   * 셋씩 받아(출처는 `assets/ASSET_LICENSES.md`), 48m 칸(gx,gy)마다
   * `variantFor()`가 해시로 그중 하나를 고른다 — 같은 칸은 늘 같은 변형을
   * 쓰므로(다시 구워도 안 바뀐다) 반복은 여전히 있지만 그 주기가 훨씬
   * 길고 불규칙해져 덜 눈에 띈다. */
  var LAND_TEX_VARIANTS = {
    grass: ['assets/textures/land/grass1.webp', 'assets/textures/land/grass2.webp', 'assets/textures/land/grass3.webp'],
    forest: ['assets/textures/land/forest1.webp', 'assets/textures/land/forest2.webp', 'assets/textures/land/forest3.webp'],
    mount: ['assets/textures/land/mount1.webp', 'assets/textures/land/mount2.webp', 'assets/textures/land/mount3.webp'],
    road: ['assets/textures/land/road1.webp', 'assets/textures/land/road2.webp', 'assets/textures/land/road3.webp'],
    town: ['assets/textures/land/town1.webp', 'assets/textures/land/town2.webp', 'assets/textures/land/town3.webp'],
    farm: ['assets/textures/land/farm1.webp', 'assets/textures/land/farm2.webp', 'assets/textures/land/farm3.webp']
  };
  var LAND_TEX_IMG = {};
  function landTexImg(kind, variant) {
    var key = kind + '#' + variant;
    if (LAND_TEX_IMG[key]) { return LAND_TEX_IMG[key]; }
    var img = new Image();
    var urls = LAND_TEX_VARIANTS[kind];
    var url = urls && urls[variant];
    if (url) { img.onload = function () { img.ready = true; }; img.src = url; }
    LAND_TEX_IMG[key] = img;
    return img;
  }
  /** 48m 격자 하나가 어느 변형(사진)을 쓸지 — 칸마다 고정(해시), 옆 칸과는
   *  보통 다르다(3종 중 하나라 1/3 확률로 우연히 같을 수 있다) */
  function variantFor(kind, gx, gy) {
    var n = (LAND_TEX_VARIANTS[kind] || [null]).length;
    if (n <= 1) { return 0; }
    return Math.floor(h1(gx * 53 + 7, gy * 61 + 13) * n);
  }
  /** 텍스처 한 변이 세계에서 몇 m 를 덮나 — 작을수록 촘촘히(확대돼) 반복된다 */
  var LAND_TEX_METERS = 12;
  /** 바닥을 굽는 캔버스 한 변(px) — 손잡이(2026-09-05, "바닥은 퀄리티가 없는데"
   *  로 발견). 타일 한 장(`span`)이 실제로는 `TILE_PX(256) * metersPerPixel`
   *  ≈ 244m 인데, 캔버스는 옛값 256px 그대로였다 — ambientCG 1K 사진을
   *  `LAND_TEX_METERS`(12m)마다 반복해 깔아도 반복 한 칸이 캔버스에서 겨우
   *  12.6px 로 뭉개져(1024px 원본의 디테일이 사실상 다 사라짐) 사진이 아니라
   *  흐린 단색처럼 보였다.
   *
   *  **"타일이 대개 한 종류라 GPU 반복 타일링으로 캔버스를 아예 건너뛸 수
   *  있지 않냐"는 제안을 실측하고 접었다** — 당시 `terrainAt()`이 격자(48m)마다
   *  `core.hash2(tx,ty)` 를 **독립적으로** 굴렸다(이웃 칸과 상관 없는 소금·
   *  후추 노이즈, 값 노이즈처럼 이어지지 않는다). 타일 한 장이 격자 7x7(49칸,
   *  `Math.ceil(span/GRID)+1`)을 덮는데, 5000곳을 무작위로 뽑아 "49칸이
   *  전부 같은 종류인 타일"을 세어 보니 **0/5000(0.000%)** — 수학적으로도
   *  당연하다(제일 흔한 grass 60% 라도 0.6^49 는 사실상 0). 그러니 "균일한
   *  타일만 GPU로 직접 타일링" 최적화는 이 지형에서 거의 절대 안 걸린다 —
   *  구현하면 죽은 코드(seam·계절/밤낮 틴트 이중곱 등 버그 자리만 늘리는)가
   *  된다. **그래서 굽기는 그대로 두고 해상도만 올렸다.**
   *  (2026-09-08 갱신: "필드맵이 바둑판 같다"는 지적으로 `terrainAt()`이
   *  `world.js`의 `terrainNoise()`(이웃과 이어지는 값 노이즈)로 바뀌어 위
   *  "완전히 독립" 전제는 더 이상 안 맞는다 — 이제 숲·산 안쪽처럼 같은 종류가
   *  뭉친 자리는 49칸이 실제로 자주 같을 수 있다. 그래도 GPU 타일링을 다시
   *  켤 근거로는 부족하다 — 마을·경계 자리는 여전히 섞이고, 위 벤치마크가
   *  보여주듯 굽기 자체는 이미 충분히 싸다(프레임당 비용 아님). 다시 잴
   *  필요가 생기면 이 자리부터.)
   *
   *  굽기는 타일이 새로 생길 때만(플레이어가 이동해 캐시 밖으로 나갈 때)
   *  한 번 돌아 매 프레임 비용은 아니다 — 256 vs 768 vs 1024 를 굽기
   *  루프만 떼어 벤치마크해 보니(20회 평균) 1024 까지는 타일당 ~5.5ms 로
   *  거의 차이가 없었고(진짜 비용은 해상도가 아니라 서브셀마다 새로
   *  만드는 `createPattern` 호출 쪽이었다), 1536(7.6ms)부터 눈에 띄게
   *  늘고 4096(28.1ms, 텍스처 67MB)에서는 확실히 무거워진다. 너무 무거우면
   *  `core.setTune('world3d.landTexRes', 256)` 로 되돌린다.
   *
   *  **캐시 자체의 누수는 따로 있었다(같은 날 발견, 고침)** — 이 값을
   *  올리면서 `landTex` 캐시(구운 텍스처를 담아 두는 곳)에 지우는 코드가
   *  전혀 없다는 게 드러났다(256px 때는 한 장 0.3MB라 안 느껴졌겠지만
   *  768px 는 2.4MB). `syncGround()`의 세대 카운터(`syncGen`)로 고쳤다 —
   *  아래 `landTex` 선언부 주석 참고 */
  function LAND_TEX_RES() { return Math.max(64, Math.round(core.tuned('world3d.landTexRes', 768))); }
  /**
   * 이 소재의 반복 무늬 — 세계 좌표(`x0·y0`, m)에 맞춰 위상을 맞춘다.
   * **타일마다 캔버스가 새로 생기므로**, 반복 시작점을 캔버스 원점이 아니라
   * 세계 좌표의 나머지로 잡아야 옆 타일과 이어 붙었을 때 이음매가 안 보인다.
   */
  function landPattern(c, kind, x0, y0, k) {
    var gx = Math.round(x0 / GRID), gy = Math.round(y0 / GRID);
    var img = landTexImg(kind, variantFor(kind, gx, gy));
    if (!img.ready || !img.naturalWidth || !c.createPattern) { return null; }
    var pat = c.createPattern(img, 'repeat');
    if (!pat || !pat.setTransform || typeof DOMMatrix === 'undefined') { return pat; }
    var side = LAND_TEX_METERS * k;
    var tx = -(((x0 % LAND_TEX_METERS) + LAND_TEX_METERS) % LAND_TEX_METERS) * k;
    var ty = -(((y0 % LAND_TEX_METERS) + LAND_TEX_METERS) % LAND_TEX_METERS) * k;
    pat.setTransform(new DOMMatrix([side / img.naturalWidth, 0, 0, side / img.naturalHeight, tx, ty]));
    return pat;
  }

  /**
   * 같은 종류 칸끼리 사진 변형이 다르면 경계 쪽 띠에 이웃 칸 사진을 옅게 겹친다(W-0110).
   * 칸마다 사진(3종)을 통째로 깔아 밝기가 다른 사진이 자로 그은 듯 맞닿았다 — 3D 마을 한가운데 십자 이음매.
   * 사진은 세계 좌표에 맞춰 깔리므로(`landPattern` 위상) 이웃 사진이 그대로 이어져 들어온다. 띠 여섯 줄,
   * 칸 폭의 절반까지 알파 0.5 → 0 — 경계에서 양쪽이 반반이 되어 줄이 사라진다. 계절 물감(곱하기 0.3)도 같이 얹는다.
   * kindAt(gx, gy) = 그 칸 종류(없으면 null). a = 그 칸 진하기
   */
  var SEAM_BANDS = 6, SEAM_ZONE = 0.5;
  function blendVariants(c, kind, gx, gy, x0, y0, k, a, kindAt) {
    if ((LAND_TEX_VARIANTS[kind] || [null]).length <= 1) { return; }
    var me = variantFor(kind, gx, gy), SS = global.DG.season, bc = LAND_COLOR[kind] || LAND_COLOR.grass;
    if (SS) { bc = SS.landColor(kind, bc); }
    var cx = (gx * GRID - x0) * k, cy = (gy * GRID - y0) * k, cw = GRID * k, i, d;
    var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (d = 0; d < 4; d++) {
      var nx = gx + dirs[d][0], ny = gy + dirs[d][1];
      if (kindAt(nx, ny) !== kind || variantFor(kind, nx, ny) === me) { continue; }
      var pat = landPattern(c, kind, nx * GRID, ny * GRID, k);
      if (!pat) { continue; }
      for (i = 0; i < SEAM_BANDS; i++) {
        var t0 = i / SEAM_BANDS * SEAM_ZONE * cw, bw = SEAM_ZONE * cw / SEAM_BANDS, al = a * 0.5 * (1 - (i + 0.5) / SEAM_BANDS);
        var rx = dirs[d][0] < 0 ? cx + t0 : (dirs[d][0] > 0 ? cx + cw - t0 - bw : cx);
        var ry = dirs[d][1] < 0 ? cy + t0 : (dirs[d][1] > 0 ? cy + cw - t0 - bw : cy);
        var rw = dirs[d][0] ? bw : cw, rh = dirs[d][1] ? bw : cw;
        c.globalAlpha = al; c.fillStyle = pat; c.fillRect(rx, ry, rw, rh);
        c.globalAlpha = al * 0.30; c.globalCompositeOperation = 'multiply'; c.fillStyle = bc; c.fillRect(rx, ry, rw, rh);
        c.globalCompositeOperation = 'source-over';
      }
    }
    c.globalAlpha = 1;
  }

  /** 어느 소재가 왔는지 — 지형 텍스처 캐시 키에 넣어, 늦게 온 것도 다음에 반영되게 한다 */
  function landTexReadyKey() {
    var s = '', k, i, urls;
    for (k in LAND_TEX_VARIANTS) {
      if (!LAND_TEX_VARIANTS.hasOwnProperty(k)) { continue; }
      urls = LAND_TEX_VARIANTS[k];
      for (i = 0; i < urls.length; i++) { s += (LAND_TEX_IMG[k + '#' + i] && LAND_TEX_IMG[k + '#' + i].ready) ? '1' : '0'; }
    }
    return s;
  }
  /** 받아 두기만 한다 — 처음 걸을 때 한 박자씩 바뀌지 않게(`prop3d.preload` 와 같은 자리) */
  function preloadLandTex() {
    var k, i, urls;
    for (k in LAND_TEX_VARIANTS) {
      if (!LAND_TEX_VARIANTS.hasOwnProperty(k)) { continue; }
      urls = LAND_TEX_VARIANTS[k];
      for (i = 0; i < urls.length; i++) { landTexImg(k, i); }
    }
  }

  var landTex = {};
  /** `landTex`를 지우는 세대 카운터(2026-09-05, "바닥 캐시가 안 지워진다" 로
   *  발견) — `syncGround()`가 돌 때마다 하나씩 올리고, 그 안에서
   *  `landTexture()`/`terrainTexture()`가 캐시를 건드릴 때마다(새로 굽든
   *  캐시에서 꺼내 쓰든) 그 텍스처에 `userData.gen = syncGen`을 찍는다.
   *  한 세대가 끝난 뒤(`syncGround()` 맨 끝) `gen`이 이번 세대가 아닌
   *  항목은 **이번에 어느 살아있는 타일도 안 찾은 것**이므로 안전하게
   *  버리고 GPU 텍스처를 `dispose()`한다. 계절이 바뀌거나(키가 달라져
   *  옛 계절 캔버스가 고아가 된다) 플레이어가 멀리 걸어도(타일 자체가
   *  안 그려져 아무도 안 건드린다) 저절로 청소된다 — 별도 LRU가 필요 없다 */
  var syncGen = 0;

  /** '#rrggbb' 를 조금 밝게·어둡게 (k 는 -1~1) */
  function shadeHex(hex, k) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, bb = n & 255;
    function f(v) { return Math.max(0, Math.min(255, Math.round(v * (1 + k)))); }
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(bb) + ')';
  }

  /**
   * 이 타일이 이 땅과 겹치나 — 겹치면 덧칠한 텍스처를, 아니면 null.
   * `x0·y0` 는 타일 왼쪽 위 모서리의 월드 좌표(m), `span` 은 한 변(m).
   *
   * **`img`(실제 지도 타일)는 더 이상 바탕에 안 그린다** (2026-09-04, "지형이
   * 어색하다" 감사) — 지도 서비스(CartoCDN)가 이제 API 키를 요구해 "API KEY
   * REQUIRED" 라고 적힌 초록 바탕 그림을 돌려주는데, `onload` 는 그래도 불러서
   * `img.ready`가 그대로 true 가 된다. 그걸 12%(1-`PAINT_A`)라도 바탕에 깔면
   * 그 글자가 마을 한복판에 그대로 비쳤다(실제로 찍어서 봤다). 이 판의 세계는
   * 애초에 지도가 모르는 절차적 세계라(제 위치가 실제 그 좌표에 무엇이 있는지와
   * 무관하게 해시로 정해진다) 지도 사진에 기댈 까닭이 없었다 — `terrainTexture`
   * 와 같은 방식(제 색·무늬로 불투명하게)으로 통일한다.
   */
  function landTexture(key, x0, y0, span) {
    var L = global.DG.land;
    if (!LAND_PAINT() || !L || !L.on()) { return null; }
    var g0x = Math.floor(x0 / GRID), g1x = Math.floor((x0 + span) / GRID);
    var g0y = Math.floor(y0 / GRID), g1y = Math.floor((y0 + span) / GRID);
    var gx, gy, any = false;
    for (gy = g0y; gy <= g1y && !any; gy++) {
      for (gx = g0x; gx <= g1x && !any; gx++) { if (L.owns(gx, gy)) { any = true; } }
    }
    if (!any) { return null; }

    /* 계절도 키에 넣는다 — 안 넣으면 계절이 바뀌어도 지난 계절 색이 남는다.
       텍스처가 늦게 도착할 수도 있으니 **어느 것이 왔는지도 키에 넣는다** —
       안 넣으면 도착 후에도 옛(색만 칠한) 캔버스가 캐시에 계속 나온다 */
    var SSk = global.DG.season;
    var ck = key + '|' + landTexReadyKey() +
      '|' + (SSk ? SSk.now().key : '-');
    if (landTex[ck]) { landTex[ck].userData.gen = syncGen; return landTex[ck]; }

    var S = LAND_TEX_RES();
    var cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    var c = cv.getContext('2d');
    c.fillStyle = '#3a352e'; c.fillRect(0, 0, S, S);

    var k = S / span;                    // 미터 → 캔버스 픽셀
    var a0 = PAINT_A();
    for (gy = g0y; gy <= g1y; gy++) {
      for (gx = g0x; gx <= g1x; gx++) {
        var at = L.at(gx, gy);
        if (!at) { continue; }
        /* 가장자리 흐리기 — 이웃 넷 중 이 땅인 것의 몫만큼만 진하게.
           **차이를 크게 두면 안 된다**: 칸마다 알파가 다르면 그 경계가 실선으로
           드러난다(눈으로 보고 알았다). 안쪽은 거의 같은 진하기로 두고
           바깥 한 줄만 살짝 옅게 한다 */
        var near = 0;
        if (L.owns(gx + 1, gy)) { near++; }
        if (L.owns(gx - 1, gy)) { near++; }
        if (L.owns(gx, gy + 1)) { near++; }
        if (L.owns(gx, gy - 1)) { near++; }
        c.globalAlpha = a0 * (near === 4 ? 1 : (0.62 + 0.09 * near));
        var SSc = global.DG.season;
        var baseCol = LAND_COLOR[at.kind] || LAND_COLOR.grass;
        if (SSc) { baseCol = SSc.landColor(at.kind, baseCol); }
        var rx = Math.round((gx * GRID - x0) * k);
        var ry = Math.round((gy * GRID - y0) * k);
        var rw = Math.round((gx * GRID + GRID - x0) * k) - rx;
        var rh = Math.round((gy * GRID + GRID - y0) * k) - ry;
        var pat = landPattern(c, at.kind, gx * GRID, gy * GRID, k);
        if (pat) {
          /* 실제 텍스처가 왔다 — 무늬를 깐다. 칸마다 밝기를 흔들던 옛 방식은
             안 쓴다(사진이 이미 자연스러운 결을 갖고 있다 — 흔들면 오히려
             사진 위에 격자가 도드라진다) */
          c.fillStyle = pat;
          c.fillRect(rx, ry, rw, rh);
          /* 계절 빛깔은 그 위에 **옅게 곱하기**로 얹는다 — 사진을 지우지 않고
             물들이기만 한다(겨울 들판이 누렇게 뜨는 정도) */
          var seasonAlpha = c.globalAlpha;
          c.globalAlpha = seasonAlpha * 0.30;
          c.globalCompositeOperation = 'multiply';
          c.fillStyle = baseCol;
          c.fillRect(rx, ry, rw, rh);
          c.globalCompositeOperation = 'source-over';
          c.globalAlpha = seasonAlpha;
        } else {
          /* 아직 못 받았다 — 옛 방식(색만 칠하기)으로 물러난다. 칸마다 밝기를
             아주 조금 흔든다 — 안 흔들면 마을이 흙빛 한 판이 된다. 폭을
             **아주 좁게** 둔다 — 0.16 으로 흔들었더니 들판이 바둑판이 됐다
             (눈으로 보고 알았다). 있는 줄 모를 만큼만 흔드는 것이 맞다 */
          c.fillStyle = shadeHex(baseCol, (h1(gx * 17 + 5, gy * 23 + 9) - 0.5) * 0.06);
          /* **겹쳐 칠하지 않는다** — 알파가 있는 색을 두 번 얹으면 그 줄만 짙어진다.
             칸 경계는 픽셀로 딱 맞춰 자른다 */
          c.fillRect(rx, ry, rw, rh);
        }
      }
    }
    var landKind = function (x, y) { var t = L.at(x, y); return t ? t.kind : null; };
    for (gy = g0y; gy <= g1y; gy++) {
      for (gx = g0x; gx <= g1x; gx++) {
        var atB = L.at(gx, gy);
        if (atB && L.owns(gx + 1, gy) && L.owns(gx - 1, gy) && L.owns(gx, gy + 1) && L.owns(gx, gy - 1)) { blendVariants(c, atB.kind, gx, gy, x0, y0, k, a0, landKind); }
      }
    }
    c.globalAlpha = 1;

    var tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.userData.gen = syncGen;
    landTex[ck] = tex;
    return tex;
  }

  /**
   * 손으로 그린 땅이 없는 **대부분의 자리**(무한한 절차적 세계)도 이제 같은
   * 실사 소재로 깐다 — 여태는 `landTexture`가 손 안 댄 자리에서 실제 지도
   * 이미지(길·건물이 찍힌 항공사진 풍 타일)를 그대로 바닥에 깔았는데, 그 위에
   * 서는 것은 격자 해시가 낸 판타지 마을·숲이라 **실제로 존재하지 않는 자리에
   * 실제 지도가 깔리는 어긋남**이 있었다(2026-09-04, 사용자가 "지형·배치가
   * 어색하다"고 짚어 발견). `terrainAt` 이 이미 이 격자가 무슨 땅인지 알고
   * 있으니, 그 종류에 맞는 실사 소재(land.js 와 같은 ambientCG CC0 텍스처)를
   * 대신 깐다 — 세우는 사물과 밟는 바닥이 드디어 같은 이야기를 한다.
   *
   * `landTexture`와 짝이지만 **소유 검사가 없고**(모든 칸이 대상) **실제 지도
   * 이미지에 안 기댄다** — 여기 깔리는 것은 지도가 모르는 절차적 세계라
   * 지도 사진을 밑에 깔 까닭이 없다(그게 바로 어긋남의 원인이었다). 늘
   * 제 색·제 무늬로 **불투명하게** 채운다. 나머지 흐림·계절·캐시 규칙은
   * `landTexture`와 그대로 같다. 물은 여기서 안 칠한다 — 실제 물결은
   * `water3d.js`가 따로 그리므로 `LAND_COLOR.water`만 옅게 깐다(무늬 없음,
   * `LAND_TEX_VARIANTS`에 water가 없어 자동으로 그리된다).
   */
  function terrainTexture(W, x0, y0, span) {
    if (!LAND_PAINT()) { return null; }
    var g0x = Math.floor(x0 / GRID), g1x = Math.floor((x0 + span) / GRID);
    var g0y = Math.floor(y0 / GRID), g1y = Math.floor((y0 + span) / GRID);
    var gx, gy;

    var SSk = global.DG.season;
    var FRt = global.DG.frost && global.DG.frost.on() ? global.DG.frost : null;   // §5 ⑲-27 서리봉 고원 눈밭
    var ck = 'w|' + g0x + ',' + g0y + '|' + landTexReadyKey() +
      '|' + (SSk ? SSk.now().key : '-') + (FRt ? '|fr' : '');
    if (landTex[ck]) { landTex[ck].userData.gen = syncGen; return landTex[ck]; }

    var S = LAND_TEX_RES();
    var cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    var c = cv.getContext('2d');
    c.fillStyle = '#3a352e'; c.fillRect(0, 0, S, S);

    var k = S / span;
    /* 경계를 **들쭉날쭉하게** 흐린다 — 칸 하나를 통째로 한 종류로 칠하고
       가장자리 알파만 낮추면(옛 방식) 여전히 자로 그은 듯한 줄이 남는다
       (2026-09-04, 스크린샷으로 실제로 확인). 칸을 잘게 나눠(`SUB`) 조각마다
       "이 종류로 칠할까, 다른 종류가 새어 들어올까"를 해시로 굴린다 —
       경계에 가까운 조각일수록 이웃 종류가 섞여 들어올 확률이 높다.
       실제 생태 경계가 직선이 아니라 서로 스미는 것과 같은 이치다 */
    var SUB = 4, subSpan = GRID / SUB, sx, sy;
    for (gy = g0y; gy <= g1y; gy++) {
      for (gx = g0x; gx <= g1x; gx++) {
        var kind = W.terrainAt(gx, gy);
        var kL = W.terrainAt(gx - 1, gy), kR = W.terrainAt(gx + 1, gy);
        var kT = W.terrainAt(gx, gy - 1), kB = W.terrainAt(gx, gy + 1);
        for (sy = 0; sy < SUB; sy++) {
          for (sx = 0; sx < SUB; sx++) {
            var u = (sx + 0.5) / SUB, v = (sy + 0.5) / SUB;
            var useKind = kind, bestD = 1, bestK = null;
            if (kL !== kind && u < bestD) { bestD = u; bestK = kL; }
            if (kR !== kind && (1 - u) < bestD) { bestD = 1 - u; bestK = kR; }
            if (kT !== kind && v < bestD) { bestD = v; bestK = kT; }
            if (kB !== kind && (1 - v) < bestD) { bestD = 1 - v; bestK = kB; }
            if (bestK) {
              var zone = 0.34;
              if (bestD < zone) {
                var seep = 1 - bestD / zone;
                var jitter = h1(gx * 97 + sx * 13 + 3, gy * 131 + sy * 17 + gx * 11);
                if (jitter < seep * 0.85) { useKind = bestK; }
              }
            }
            var wx = gx * GRID + sx * subSpan, wy = gy * GRID + sy * subSpan;
            var rx = Math.round((wx - x0) * k);
            var ry = Math.round((wy - y0) * k);
            var rw = Math.round((wx + subSpan - x0) * k) - rx;
            var rh = Math.round((wy + subSpan - y0) * k) - ry;
            var baseCol = LAND_COLOR[useKind] || LAND_COLOR.grass;
            if (SSk) { baseCol = SSk.landColor(useKind, baseCol); }
            /* §5 ⑲-27 북방 설산 땅은 눈밭 — 물·길은 그대로, 산은 더 희게 */
            var snowy = FRt && useKind !== 'water' && useKind !== 'road' && FRt.snowCell(gx, gy);
            if (snowy) { baseCol = useKind === 'mount' ? '#e6ebf1' : (useKind === 'forest' ? '#cdd7df' : '#dde5ec'); }
            var pat = snowy ? null : landPattern(c, useKind, gx * GRID, gy * GRID, k);
            if (pat) {
              c.fillStyle = pat;
              c.fillRect(rx, ry, rw, rh);
              c.globalAlpha = 0.30;
              c.globalCompositeOperation = 'multiply';
              c.fillStyle = baseCol;
              c.fillRect(rx, ry, rw, rh);
              c.globalCompositeOperation = 'source-over';
              c.globalAlpha = 1;
            } else {
              c.fillStyle = shadeHex(baseCol, (h1(gx * 17 + 5 + sx, gy * 23 + 9 + sy) - 0.5) * 0.06);
              c.fillRect(rx, ry, rw, rh);
            }
          }
        }
      }
    }

    for (gy = g0y; gy <= g1y; gy++) {
      for (gx = g0x; gx <= g1x; gx++) {
        if (FRt && FRt.snowCell(gx, gy)) { continue; }
        blendVariants(c, W.terrainAt(gx, gy), gx, gy, x0, y0, k, 1, W.terrainAt);
      }
    }

    var tex2 = new T.CanvasTexture(cv);
    tex2.colorSpace = T.SRGBColorSpace;
    tex2.anisotropy = 4;
    tex2.userData.gen = syncGen;
    landTex[ck] = tex2;
    return tex2;
  }

  /* ── 땅의 높낮이 (PLAN 14절) ─────────────────────────
   * 값은 `relief3d.js` 가 낸다(순수 함수). 여기 있는 것은 **그 값을 화면에
   * 바르는 일**뿐이다 — 지면 정점을 밀고, 배우를 앉히고, 카메라를 띄운다.
   * `world.js` 의 좌표·거리·스폰은 여전히 평면 2D 라 **균형이 안 움직인다.**
   */
  function RELIEF() { return global.DG.relief3d || null; }
  function RELIEF_ON() { var R = RELIEF(); return !!(R && R.on()); }
  /** 타일 한 장을 몇 칸으로 나누나 — 클수록 곱지만 정점이 제곱으로 는다 */
  function RELIEF_SEG() { return Math.max(1, Math.round(core.tuned('relief3d.seg', 8))); }

  /** 그 자리의 땅 높이(m). 높낮이가 꺼져 있으면 0 — 부르는 쪽은 몰라도 된다 */
  function groundY(x, z) {
    var R = RELIEF();
    return R ? R.heightAt(x, z) : 0;
  }
  /**
   * §5 ⑲-20 구름섬 — 섬 층(sky)에 선 몸은 섬 윗면에 선다. 섬 밑 땅은 그대로라 층을 모르면 안 올린다.
   * standY 의 sky 를 안 주면 **내 층**(landform.onSky) — 예고 원·광역 고리처럼 내 곁에 그리는 것
   */
  function meSky() { var LF = global.DG.landform; return !!(LF && LF.onSky && LF.onSky()); }
  function skyLift(x, z, sky) {
    var SK = global.DG.skyIsle, pd;
    if (!sky || !SK || !SK.layerOn || !SK.layerOn() || !(pd = SK.padAt(x, z))) { return 0; }   // ⑲-35 그 자리 발판(섬·관측대)
    return Math.max(0, pd.top - groundY(x, z));
  }
  function standY(x, z, sky) { return groundY(x, z) + skyLift(x, z, sky === undefined ? meSky() : sky); }
  /**
   * 화면 점(clientX, clientY) → 땅 위 세계 자리 {x, y} (2026-09-27 실기 "마우스로 클릭한 곳으로 이동도 안 함").
   * 3인칭 원근 카메라라 2D 캔버스 역산(world.unproject)으로는 누른 자리와 어긋난다 — 카메라 광선을 쏴서
   * 땅(높낮이·내 층 발판 포함)에 처음 닿는 자리를 찾는다. 2m 씩 나아가다 넘으면 반으로 좁힌다. 땅에 안 닿으면 null
   */
  function pickGround(cx, cy) {
    if (!camera || !canvas || !T) { return null; }
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) { return null; }
    var nx = (cx - r.left) / r.width * 2 - 1, ny = -((cy - r.top) / r.height) * 2 + 1;
    camera.updateMatrixWorld();
    var o = camera.position.clone(), d = new T.Vector3(nx, ny, 0.5).unproject(camera).sub(o).normalize();
    var sky = meSky(), prev = 0, t, i;
    function above(s) { var x = o.x + d.x * s, z = o.z + d.z * s; return o.y + d.y * s - standY(x, z, sky); }
    if (above(0) < 0) { return null; }
    for (t = 2; t <= 900; t += 2) {
      if (above(t) <= 0) {
        var lo = prev, hi = t;
        for (i = 0; i < 12; i++) { var mid = (lo + hi) / 2; if (above(mid) > 0) { lo = mid; } else { hi = mid; } }
        return { x: o.x + d.x * hi, y: o.z + d.z * hi };
      }
      prev = t;
    }
    return null;
  }

  /**
   * 타일 한 장의 정점을 실제 높이로 민다.
   *
   * **눕히기 전 좌표계라 y 가 아니라 z 를 민다.** 이 메시는 `rotation.x = -90°`
   * 로 눕혀 놓았으므로, 로컬의 +z 가 월드의 +y 다. 여기서 y 를 밀면 땅이
   * 옆으로 밀린다(한 번 밟았다).
   *
   * 같은 자리에 다시 깔릴 때는 **건너뛴다** — 타일은 격자를 넘을 때마다 재활용되는데
   * 매번 정점 수백 개를 다시 재면 걸을 때마다 화면이 걸린다.
   */
  function liftTile(mesh, x0, z0, span) {
    if (!RELIEF_ON()) { return false; }
    var mark = Math.round(x0) + '/' + Math.round(z0) + '/' + Math.round(span);
    if (mesh.userData.lifted === mark) { return false; }
    var pos = mesh.geometry.getAttribute('position');
    if (!pos) { return false; }
    var i;
    for (i = 0; i < pos.count; i++) {
      /* 로컬 x·y → 월드 x·z (눕히기 전이므로 로컬 y 가 월드 z 의 **반대**다) */
      var lx = pos.getX(i), ly = pos.getY(i);
      var wx = x0 + span / 2 + lx;
      var wz = z0 + span / 2 - ly;
      pos.setZ(i, groundY(wx, wz));
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.userData.lifted = mark;
    return true;
  }

  /** 지도 타일을 카메라 둘레에만 깐다 (멀어진 것은 지운다) */
  /* 발열(2026-09-24 "핸드폰 불남") — 가만히 서 있어도 매 프레임 49장 × (열쇠 문자열·계절·landTexture 의 땅 소유 검사 ~36번)을
     다시 돌았다. 선 칸·배율·물감·반경이 그대로고 지난번에 모든 장이 칠해졌으면 건너뛴다(계절·손으로 그린 땅이 바뀌는
     경우를 위해 5초에 한 번은 그대로 다시 돈다) */
  var groundKey = '', groundAt = 0, GROUND_REFRESH_MS = 5000;
  function syncGround(W) {
    var mpp = W.metersPerPixel();
    var span = W.TILE_PX * mpp;                     // 타일 한 장이 덮는 미터
    var pos = core.save.player.pos;
    var ll = W.worldToLatLng(pos.x, pos.y);
    var px = W.latLngToPixel(ll.lat, ll.lng);
    var cx = Math.floor(px.x / W.TILE_PX), cy = Math.floor(px.y / W.TILE_PX);
    var R = TILE_SPAN(), live = {};
    /* 밤에는 지도 자체가 어두워야 한다 — 타일 색에 조명의 물감을 곱한다.
       (지도 이미지는 늘 한낮 그림이라, 안 곱하면 밤에 땅만 대낮이다) */
    var tint = lightNow ? lightNow.tint : 0xffffff;
    var gk = cx + '/' + cy + '/' + mpp + '/' + tint + '/' + R + '/' + (RELIEF_ON() ? 1 : 0), gNow = Date.now();
    if (gk === groundKey && gNow - groundAt < GROUND_REFRESH_MS) { return; }
    var groundPending = false;
    syncGen++;

    for (var dy = -R; dy <= R; dy++) {
      for (var dx = -R; dx <= R; dx++) {
        var tx = cx + dx, ty = cy + dy;
        var key = tx + '/' + ty;
        live[key] = 1;
        var mesh = tileMeshes[key];
        var corner = worldOfLatLng(tile2lat(ty, W), tile2lng(tx, W));
        if (!mesh) {
          /* **한 장을 잘게 나눈다.** 여태 네 꼭짓점뿐이라 아무리 높이를 줘도
             땅이 기울 뿐 굽지 않았다. 241m 타일을 `RELIEF_SEG` 칸으로 나누면
             한 칸이 30m 남짓 — 지형 격자(48m)보다 촘촘해 경사가 살아난다 */
          var seg = RELIEF_ON() ? RELIEF_SEG() : 1;
          var geo = new T.PlaneGeometry(span, span, seg, seg);
          var mat = new T.MeshLambertMaterial({ color: 0x1a1f28 });
          mesh = new T.Mesh(geo, mat);
          mesh.rotation.x = -Math.PI / 2;           // 눕힌다
          mesh.receiveShadow = true;
          groundGroup.add(mesh);
          tileMeshes[key] = mesh;
          mesh.userData.lifted = '';
        }
        /* 타일의 왼쪽 위 모서리를 월드 미터로 환산해 한가운데에 놓는다 */
        mesh.position.set(corner.x + span / 2, -0.02, corner.y + span / 2);
        liftTile(mesh, corner.x, corner.y, span);

        var img = W.getTile(tx, ty, W.ZOOM);
        /* 이 땅과 겹치는 자리(손으로 그린 땅)는 여전히 실제 지도와 섞어 칠한다.
           그 밖의 **거의 모든 자리**(절차적 세계)는 `terrainTexture` 가 실제
           지도 대신 이 칸이 무슨 땅인지(`terrainAt`)로 실사 소재를 깐다
           (2026-09-04, "지형·배치가 어색하다" 감사). `img` 는 그래도 받아
           둔다 — `tilesUsable()`(= `mapped`)가 물 렌더링 갈림길에 여전히 쓴다 */
        var tex = landTexture(key, corner.x, corner.y, span, img) ||
          terrainTexture(W, corner.x, corner.y, span) || tileTexture(img);
        if (tex) {
          if (mesh.material.map !== tex) {
            mesh.material.map = tex;
            mesh.material.needsUpdate = true;
          }
          mesh.material.color.setHex(tint);
        } else {
          /* 아직 지도가 안 온 자리. 지형색으로 칠하면 **242m 짜리 색 덩어리**가 생겨
             지도가 그렇게 생긴 줄 알게 된다 — 옅은 종이색으로 비워 둔다.
             타일이 오면 위에서 곧바로 갈아 끼운다. */
          mesh.material.color.setHex(mixHex(0xd7dbe0, tint, 0.85));
          groundPending = true;                    // 아직 안 온 장이 있다 — 다음 프레임도 다시 본다
        }
      }
    }
    groundKey = groundPending ? '' : gk; groundAt = gNow;
    for (var k in tileMeshes) {
      if (!Object.prototype.hasOwnProperty.call(tileMeshes, k) || live[k]) { continue; }
      var m = tileMeshes[k];
      groundGroup.remove(m);
      m.geometry.dispose();
      m.material.dispose();
      delete tileMeshes[k];
    }
    /* `landTex` 청소(2026-09-05, "바닥 텍스처가 안 지워진다" 로 발견) — 위
       루프가 화면 밖 **메시**는 지우지만, 그 메시가 물려 쓰던 구운
       `CanvasTexture`는 `landTex` 캐시에 그대로 남아 GPU 메모리를 붙들고
       있었다(플레이어가 걸을수록 무한정 쌓임). 이번 세대(`syncGen`)에
       위에서 아무 살아있는 타일도 다시 찾지 않은 항목은 이제 어느 메시도
       참조하지 않는다는 뜻이므로 안전하게 버린다 */
    for (var ck in landTex) {
      if (!Object.prototype.hasOwnProperty.call(landTex, ck)) { continue; }
      if (landTex[ck].userData.gen === syncGen) { continue; }
      landTex[ck].dispose();
      delete landTex[ck];
    }
  }

  function tile2lng(x, W) { return x / Math.pow(2, W.ZOOM) * 360 - 180; }
  function tile2lat(y, W) {
    var n = Math.PI - 2 * Math.PI * y / Math.pow(2, W.ZOOM);
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }
  function worldOfLatLng(lat, lng) {
    var o = global.DG.world.origin;
    var mPerLat = 111320;
    var mPerLng = 111320 * Math.cos(o.lat * Math.PI / 180);
    return { x: (lng - o.lng) * mPerLng, y: -(lat - o.lat) * mPerLat };
  }

  /* ── 건물 · 나무 — 무엇이 몇 개 서는가 ───────────────────
   * 지도 타일에는 **높이가 없다.** 원작의 도시 감각은 건물이 서 있는 데서 오므로,
   * 지형 격자(`terrainAt`, 48m)를 보고 절차적으로 세운다.
   *
   * 1단계는 격자마다 상자 두셋을 세우는 게 전부였다 — 어느 동네나 똑같이 성겼다.
   * 이제 **격자마다 도심도(都心度)를 뽑아** 밀도를 가른다: 번화한 칸은 높은 집이
   * 여덟 채까지 들어차고, 변두리는 낮은 집 두엇에 나무가 섞인다. 길가에는 등롱을
   * 세우고 빈 들에도 풀·바위를 둔다 — 아무것도 없는 칸이 있으면 그 자리가 구멍처럼 보인다.
   *
   * **자리는 좌표 해시라 같은 땅이면 늘 같다.** 스폰·역참이 그런 것과 같은 규칙이다.
   * 이 함수는 three 를 안 쓴다 — 자가진단이 계획만 따로 굴려 본다.
   */
  var GRID = 48;
  /* 이 거리부터 배우를 키운다 (m) — 그 안쪽은 눈에 보이는 그대로 */
  var FAR_NEAR = 45, FAR_MAX = 4;

  /* 이 판의 core.hash2 는 0~0.5 만 돌려준다(world.js 주석 참고) — 두 배로 편다 */
  function h1(a, b) { return Math.min(0.999999, core.hash2(a, b) * 2); }
  /** 땅 전용 퓨전 소품이 설 칸의 몫(§5 ⑰ 넷째) — 0 이면 안 세운다 */
  function ZP_RATE() { return core.tuned('world3d.zoneProps', 0.16); }

  /** 이 격자가 얼마나 번화한가 (0 변두리 ~ 1 도심) */
  function urbanity(gx, gy) {
    /* 넓은 무늬 하나와 잔무늬 하나를 겹친다 — 하나만 쓰면 시가지가 바둑판이 된다 */
    var broad = h1(Math.floor(gx / 5) * 131 + 7, Math.floor(gy / 5) * 197 + 11);
    var fine = h1(gx * 31 + 3, gy * 57 + 5);
    return Math.min(1, broad * 0.72 + fine * 0.42);
  }

  /**
   * 격자 하나에 무엇을 세울지. 좌표만 보고 정하는 **순수 함수**다.
   * 돌려주는 것은 부품 목록 — x·z 는 격자 한가운데 기준(±GRID/2).
   *   house  기와집 (w·d·h, roof 있음)   tower 높은 집
   *   tree   나무    rock 바위   grass 풀덤불   lamp 등롱   water 수면   reed 갈대
   */
  function propPlan(kind, gx, gy, mapped, densAt) {
    var out = [], i, n;
    var u = urbanity(gx, gy);
    var dens = densAt != null ? densAt : DENSITY();
    var half = GRID * 0.42;
    /* 이 격자를 손으로 그린 땅이 맡고 있나 (`land.js`) — 맡은 자리는
       지도에 없는 땅이라 지도가 깔려 있어도 제 지형을 세워야 한다 */
    var RG = global.DG.land;
    var authored = !!(RG && RG.owns(gx, gy));
    /* 젖은 날인가 — 비·눈이면 물이 분다. 화면에만 쓰는 값이다 */
    var wk0 = weatherKey();
    var wet = WET() && (wk0 === 'rain' || wk0 === 'snow');
    /* 손으로 그린 땅이 번화도를 못박아 두었으면 그것을 쓴다 — 작은 마을에
       탑이 솟지 않게 하는 것이 여기다 */
    if (authored) {
      var lu = RG.urbanity(gx, gy);
      if (lu !== null) { u = lu; }
    }
    function spot(seed) {
      return {
        x: (h1(gx * 3 + seed * 13, gy * 7 + seed * 5) * 2 - 1) * half,
        z: (h1(gx * 11 + seed * 3, gy * 17 + seed * 29) * 2 - 1) * half
      };
    }

    if (kind === 'town') {
      n = Math.round((1 + u * 7) * dens);
      /* 마을 배치 — 여태는 칸 안에서 자리·각도 다 완전히 독립된 해시라 "아무렇게나
         흩어 놓은" 것처럼 보였다(2026-09-04, "지형·배치가 어색하다" 지적).
         이제 ① 각도는 **가장 가까운 길**(terrainAt 의 tx%7·ty%9 격자길)에 맞춰
         정렬하고 살짝만 흔들고, ② 자리는 칸을 작은 대지(lot)로 나눠 한 대지에
         한 채씩 앉힌다(대지 안에서만 살짝 흔든다) — 완전히 격자로 딱딱하지
         않게, 옛 마을 골목처럼 살짝 어긋나되 "지어진" 티가 나게 한다.
         집 자체의 위치·판정(houseRects)은 이 함수를 그대로 다시 부르므로
         따로 손댈 것이 없다 — 순수 함수라 자리가 바뀌면 판정도 저절로 따라온다 */
      /* 2026-09-04 — 동네마다 길 축을 하나로 가른 뒤(`W.roadIsVertical`,
         "바둑판" 고침) 부터는 "더 가까운 축"이 아니라 **이 동네에서 실제로
         길이 되는 축**에 맞춰야 한다 — 안 그러면 이 동네엔 없는 축(가상의
         길)을 보고 집이 돈다 */
      var baseRot = global.DG.world.roadIsVertical(gx, gy) ? 0 : Math.PI / 2;
      var lotArea = GRID * 0.82;
      var cols = Math.max(1, Math.ceil(Math.sqrt(n)));
      var rows = Math.max(1, Math.ceil(n / Math.max(1, cols)));
      var lotW = lotArea / cols, lotD = lotArea / rows;
      for (i = 0; i < n; i++) {
        var col = i % cols, row = Math.floor(i / cols);
        var lotX = (col + 0.5) / cols * lotArea - lotArea / 2;
        var lotZ = (row + 0.5) / rows * lotArea - lotArea / 2;
        /* 2026-09-10 — "바둑판 같다" 재지적("삼각형·둥근 라인"·"각을 랜덤으로"·
           "지도 건물 배치처럼"). 대지를 줄·칸으로 나눈 것 자체는 그대로 두되
           (허물면 겹침·충돌 판정을 다시 다 맞춰야 한다), **줄마다 엇갈리게**
           밀어 칸 하나가 "완전한 격자"로 안 보이게 한다 — 벽돌쌓기와 같은
           원리, 옛 마을 골목이 신도시 아파트 단지처럼 안 보이는 이유가 이것이다.
           방향은 칸마다 해시로 갈라 옆 칸과 같은 쪽으로만 안 쏠리게 한다 */
        if (row % 2 === 1) {
          var staggerDir = h1(gx * 41 + row * 7, gy * 43 + row * 5) > 0.5 ? 1 : -1;
          lotX += lotW * 0.3 * staggerDir;
        }
        var jx = (h1(gx * 3 + i * 13, gy * 7 + i * 5) - 0.5) * lotW * 0.5;
        var jz = (h1(gx * 11 + i * 3, gy * 17 + i * 29) - 0.5) * lotD * 0.5;
        var hh = h1(gx * 13 + i, gy * 19 + i * 3);
        var tall = u > 0.62 && hh > 0.55;
        var w = 5 + hh * (tall ? 5 : 7);
        out.push({
          t: tall ? 'tower' : 'house',
          x: lotX + jx, z: lotZ + jz,
          w: w, d: w * (0.8 + hh * 0.5),
          h: tall ? (12 + hh * 22) * (0.6 + u * 0.8) : 4 + hh * 4,
          /* 각도 흔들림 폭을 0.5→0.7로 넓혔다(사용자가 직접 "각을 랜덤으로
             변경" 요청) — baseRot(길 방향)에서 너무 멀어지면 집이 길과
             동떨어져 보이므로 상한은 둔다 */
          rot: baseRot + (h1(gx + i * 7, gy - i * 5) - 0.5) * 0.7,
          shade: 0.30 + hh * 0.46,
          roof: !tall
        });
      }
      /* 번화할수록 길가에 등롱이 늘어선다 — 밤 화면이 여기서 살아난다 */
      n = u > 0.45 ? 2 : 1;
      for (i = 0; i < n; i++) {
        var ls = spot(30 + i);
        out.push({ t: 'lamp', x: ls.x, z: ls.z, h: 3.2 + h1(gx + i, gy + i) * 1.2 });
      }
      /* 우물·장터 — 마을에 하나씩만 서야 랜드마크로 보인다(집처럼 흔하면
         눈에 안 띈다). 번화한 칸일수록 드물게 세운다 */
      if (u > 0.35 && h1(gx * 23 + 5, gy * 29 + 7) > 0.86) {
        var wsp = spot(200);
        out.push({ t: 'well', x: wsp.x, z: wsp.z, h: 1.25 });
      }
      if (u > 0.5 && h1(gx * 31 + 9, gy * 37 + 3) > 0.90) {
        var msp = spot(210);
        out.push({ t: 'market', x: msp.x, z: msp.z, h: 1.3,
                   rot: h1(gx * 3 + 1, gy * 5 + 2) * Math.PI * 2 });
      }
    } else if (kind === 'forest') {
      n = Math.round((3 + h1(gx * 7 + 5, gy * 11 + 3) * 5) * dens);
      for (i = 0; i < n; i++) {
        var fs = spot(i + 40);
        out.push({ t: 'tree', x: fs.x, z: fs.z, h: 5 + h1(gx + i * 5, gy + i * 7) * 7 });
      }
      if (h1(gx * 5, gy * 3) > 0.6) {
        var frs = spot(70);
        out.push({ t: 'rock', x: frs.x, z: frs.z, h: 1.4 + h1(gx, gy) * 1.6 });
      }
    } else if (kind === 'mount') {
      out.push({ t: 'peak', x: 0, z: 0, h: 14 + h1(gx * 3 + 1, gy * 5 + 2) * 22 });
      n = Math.round(2 * dens);
      for (i = 0; i < n; i++) {
        var ms = spot(i + 80);
        out.push({ t: 'rock', x: ms.x, z: ms.z, h: 1.8 + h1(gx + i, gy + i * 3) * 2.6 });
      }
    } else if (kind === 'water') {
      /* **지도가 깔렸으면 물은 이미 지도에 칠해져 있다.** 그 위에 원반을 또 깔면
         지도에 없는 자리에 호수가 떠서 그림이 어긋난다 — 절차적 사물이 맡을 것은
         지도에 없는 **높이**뿐이다. 갈대는 높이라서 남긴다 */
      /* 다만 **손으로 그린 땅**(`land.js`)의 강은 지도에 없는 물이다 —
         지도가 깔려 있어도 여기서 수면을 깔지 않으면 강이 아예 안 보인다 */
      /* **비가 오면 강물이 분다**(PLAN 21절 "강물 수위 변화") — 수면이 올라오고
         조금 넓어진다. 화면에만 쓰는 값이라 건너는 판정은 한 줄도 안 바뀐다 */
      /* 2026-09-07: `LAND_PAINT()`도 물을 켜는 조건에 넣었다 — 위 "지도가
         칠해 준다"는 전제가 2026-09-04 감사 이전 얘기였다. 그 감사 이후로는
         `LAND_PAINT()`가 켜져 있으면(기본값) `terrainTexture()`가 실제 지도
         대신 **제 손으로 칠한 텍스처**를 까는데, 그 함수는 `water`를 일부러
         뺐다("실제 물결은 water3d.js가 따로 그리므로" — 428행 주석). 그런데
         이 조건은 `mapped`(지도 타일이 오는지)만 보고 있어서, 지도가 오긴
         오지만 `LAND_PAINT()`가 그 위를 덮어 버리는 흔한 경우(기본 설정
         그대로)에 **아무도 물을 안 그리는 구멍**이 났다 — 절차적 물 지형이
         밋밋한 단색 사각형(테두리도 각짐)으로만 보이던 원인. 자가진단·
         `_demo.html`로는 늘 `LAND_PAINT()` 기본값(켜짐)에서 보므로 이
         구멍이 회귀 시험에 안 걸렸다. */
      if (!mapped || authored || LAND_PAINT()) {
        /* 2026-09-07: 이어진 강(`sq`, 손으로 그린 물)은 칸을 꽉 채우는 네모라
           물가가 격자에 딱 맞춰 각져 보였다 — 원반(고립된 웅덩이)은 이미
           둥글어 괜찮으니 네모 쪽만 다듬는다. **어느 변이 물가(뭍과 닿음)고
           어느 변이 강물끼리 이어지는지**를 미리 재 둔다(`buildProp`이
           `shoreGeo(mask)`로 그 변만 들쭉날쭉 깎는다) — 물끼리 이어지는 변은
           안 깎아야 두 칸이 빈틈없이 맞물린다(비트: 1=동·2=서·4=북·8=남,
           `gx±1`→동서·`gy±1`→남북과 실제로 맞는지는 `world3d.js`의
           `rotation.x=-90°` 변환식을 손으로 풀어 확인했다). */
        var shoreMask = 0;
        if (authored) {
          var W3t = global.DG.world;
          if (!W3t || W3t.terrainAt(gx + 1, gy) !== 'water') { shoreMask |= 1; }
          if (!W3t || W3t.terrainAt(gx - 1, gy) !== 'water') { shoreMask |= 2; }
          if (!W3t || W3t.terrainAt(gx, gy - 1) !== 'water') { shoreMask |= 4; }
          if (!W3t || W3t.terrainAt(gx, gy + 1) !== 'water') { shoreMask |= 8; }
        }
        out.push({ t: 'water', x: 0, z: 0, h: 0, sq: authored, rise: wet ? 1 : 0, shore: shoreMask });
      }
      /* 물이 불면 갈대가 잠긴다 — 물만 올리고 갈대를 그대로 두면 물 위에 떠 있다 */
      n = h1(gx * 9, gy * 13) > 0.5 ? 3 : 1;
      if (wet) { n = Math.max(0, n - 2); }
      for (i = 0; i < n; i++) {
        var ws = spot(i + 90);
        out.push({ t: 'reed', x: ws.x, z: ws.z,
                   h: (1.2 + h1(gx + i, gy) * 1.0) * (wet ? 0.7 : 1) });
      }
    } else if (kind === 'road') {
      /* 길 — 여태 아무것도 없었다. 길가에 등롱과 나무가 서야 길로 보인다.
         `terrainAt` 은 tx%7===0(세로길, 남북) 이거나 ty%9===0(가로길, 동서)
         이면 이 칸을 길로 낸다 — 여태는 **늘 세로길인 것처럼** 등롱을 고정된
         x 자리에만 세웠다(가로길에서는 등롱이 길과 나란히가 아니라 어긋난
         자리에 섰다는 뜻). 2026-09-04 "배치가 어색하다" 감사로 발견 — 어느
         쪽 조건으로 길이 됐는지 갈라 각각 제 방향으로 세운다(교차로는 둘 다) */
      var roadV = (gx % 7 + 7) % 7 === 0, roadH = (gy % 9 + 9) % 9 === 0;
      /* 이 칸이 실제로 길 격자(위 조건)에 안 걸려도 'road'로 불릴 수 있다 —
         이 함수는 좌표만 보고 짓는 순수 함수라, 부르는 쪽이 임의의 좌표에
         강제로 'road'를 물어도(자가진단이 그렇게 한다) 등롱은 늘 서야 한다.
         그때는 옛 기본값(세로길 모양)으로 물러난다 */
      if (!roadV && !roadH) { roadV = true; }
      if (roadV) {
        out.push({ t: 'lamp', x: -half * 0.8, z: (h1(gx, gy) * 2 - 1) * half, h: 3.4 });
        if (h1(gx * 3 + 2, gy * 5 + 1) > 0.45) {
          out.push({ t: 'lamp', x: half * 0.8, z: (h1(gy, gx) * 2 - 1) * half, h: 3.4 });
        }
      }
      if (roadH) {
        out.push({ t: 'lamp', x: (h1(gx + 1, gy + 1) * 2 - 1) * half, z: -half * 0.8, h: 3.4 });
        if (h1(gx * 5 + 1, gy * 3 + 2) > 0.45) {
          out.push({ t: 'lamp', x: (h1(gy + 2, gx + 2) * 2 - 1) * half, z: half * 0.8, h: 3.4 });
        }
      }
      if (h1(gx * 21, gy * 11) > 0.62) {
        var rs = spot(60);
        out.push({ t: 'tree', x: rs.x, z: rs.z, h: 4 + h1(gx, gy) * 3 });
      }
    } else if (kind === 'farm') {
      /* 논밭 — 손으로 그린 땅이 들고 온 것이다. 물 댄 뙈기를 낮게 깔고 두렁으로 나눈다.
         뙈기는 **네모라서** 사람이 갈아 놓은 티가 난다 — 들의 둥근 풀덤불과 갈린다 */
      n = Math.round((2 + h1(gx * 3 + 7, gy * 5 + 11) * 2) * dens);
      for (i = 0; i < n; i++) {
        var ds = spot(i + 130);
        var fw = 11 + h1(gx + i, gy + i * 3) * 9;
        var fd = 9 + h1(gy + i, gx + i * 5) * 8;
        out.push({ t: 'field', x: ds.x, z: ds.z, w: fw, d: fd,
                   rot: h1(gx * 5 + i, gy * 7 + i) * 0.5 - 0.25 });
        /* **벼를 심는다.** 뙈기 안에 골고루 — 가운데로 몰면 논이 빈 채로 보인다.
           못 받으면 벼만 안 서고 논은 그대로다(되돌림이 저절로 된다) */
        var rn = Math.round(5 * dens), rj;
        for (rj = 0; rj < rn; rj++) {
          var ra = h1(gx * 7 + rj * 5 + i, gy * 11 + rj * 3 + i * 2);
          var rb = h1(gx * 13 + rj * 3 + i * 7, gy * 5 + rj * 11 + i);
          out.push({ t: 'rice',
                     x: ds.x + (ra * 2 - 1) * fw * 0.36,
                     z: ds.z + (rb * 2 - 1) * fd * 0.36,
                     h: 1.4 + ra * 0.7 });
        }
      }
      if (h1(gx * 17 + 3, gy * 13 + 5) > 0.5) {
        var cs = spot(150);
        out.push({ t: 'scare', x: cs.x, z: cs.z, h: 2.2 });
      }
    } else {                                   // grass — 빈 들
      n = Math.round((h1(gx * 41, gy * 23) * 3) * dens);
      for (i = 0; i < n; i++) {
        var gs = spot(i + 100);
        out.push({ t: 'grass', x: gs.x, z: gs.z, h: 0.7 + h1(gx + i, gy - i) * 0.6 });
      }
      if (h1(gx * 7 + 9, gy * 3 + 4) > 0.86) {
        var grs = spot(120);
        out.push({ t: 'rock', x: grs.x, z: grs.z, h: 1.2 + h1(gx, gy) * 1.4 });
      }
    }

    /* 손으로 못박아 둔 것 — 다리·굴 입구·무너진 기둥·옛 사당. 해시가 만든 것 **위에**
       얹는다. 자리가 정해져 있으니 격자 한가운데다(찾아가는 표적이라 흔들리면 안 된다) */
    var mk = RG ? RG.markAt(gx, gy) : null;
    if (mk === 'bridge') {
      /* 다리 — 받아 온 모델은 **한 칸짜리**라 강(격자 48m)을 못 건넌다.
         남북으로 이어 놓는다(길이 남북이므로 상판도 남북이다).
         **첫 칸만 `seg` 가 없다** — 모델을 못 받았을 때 도형 다리가 일곱 겹
         겹쳐 서지 않도록, 도형은 그 한 칸만 옛 모습(48m 상판)으로 그린다 */
      /* **키가 곧 이음매다.** 이 모델은 키 1 로 눕히면 깊이가 0.76 이라,
         칸 간격(`GRID/bn`)과 같아지려면 키를 그만큼 잡아야 한다 —
         짧게 잡았더니 아치 사이가 벌어져 사다리처럼 보였다(눈으로 보고 고쳤다) */
      var bn = 7, bj, bh = (GRID / bn) / 0.76;
      for (bj = 0; bj < bn; bj++) {
        out.push({ t: 'bridge', x: 0, z: (bj - (bn - 1) / 2) * (GRID / bn),
                   h: bh, seg: bj });
      }
    }
    else if (mk === 'cave') { out.push({ t: 'cave', x: 0, z: 0, h: 7 }); }
    else if (mk === 'ruin') { out.push({ t: 'ruin', x: 0, z: 0, h: 4.5 }); }
    else if (mk === 'shrine') { out.push({ t: 'shrine', x: 0, z: 0, h: 5 }); }
    else if (mk === 'waterfall') { out.push({ t: 'waterfall', x: 0, z: 0, h: 16 }); }   // PLAN 44절
    /* 옛 사원 — 손그린 땅에 **딱 한 칸**뿐인 특별 랜드마크(2026-09-11).
       shrine·cave·ruin과 같은 결로 markAt 이 답할 때만 세운다 */
    else if (mk === 'temple') { out.push({ t: 'temple', x: 0, z: 0, h: 18 }); }
    /* 지형 설계(landform.js, §5 ⑰) — 여울 다리(강을 가로질러 rot 방향으로 이어 놓는다)·발원지 폭포.
       그림은 위 손그림 땅의 다리·폭포 모델 그대로다. 다리 모델은 실은 이끼 바위(디딤돌, prop3d `bridge`)라
       **줄만** 강을 가로지르게 놓고 바위 하나하나의 돌림은 해시에 맡긴다(같은 쪽을 보면 되풀이가 드러난다) */
    var LFp = !mk ? global.DG.landform : null, lmk = LFp && LFp.markAt ? LFp.markAt(gx, gy) : null;
    if (lmk && lmk.t === 'bridge') {
      var lsl = GRID / 7, lbn = Math.max(5, Math.ceil(lmk.span / lsl)), lbh = lsl / 0.76, lj;
      var ltx = Math.sin(lmk.rot), ltz = Math.cos(lmk.rot);
      for (lj = 0; lj < lbn; lj++) {
        var la = (lj - (lbn - 1) / 2) * lsl;
        out.push({ t: 'bridge', x: lmk.ox + ltx * la, z: lmk.oz + ltz * la, h: lbh, seg: lj });
      }
    } else if (lmk && lmk.t === 'waterfall') {
      out.push({ t: 'waterfall', x: lmk.ox, z: lmk.oz, h: 16, rot: lmk.rot });
    }

    /* 땅 전용 퓨전 소품(PLAN §5 ⑰ 넷째 · SAGA-DESIGN §13) — 이름 있는 땅(biome.js ZONES `props`)의 들·숲
       칸 가운데 ZP_RATE 만큼에 하나. 제 색깔(main) 60% · 다른 시대(mix) 40% — 한 땅 안에 과거·현대·미래가
       다 선다. 손그림 땅·고향·마을·길·물·산은 뺀다. 자리·종류 모두 칸 해시(난수 0) */
    if (!authored && (kind === 'grass' || kind === 'forest') && ZP_RATE() > 0) {
      var BMz = global.DG.biome, P3z = global.DG.prop3d;
      var zz = BMz && BMz.on() && P3z && P3z.FUSION ? BMz.zoneAt((gx + 0.5) * GRID, (gy + 0.5) * GRID) : null;
      if (zz && zz.props && h1(gx * 13 + 7, gy * 19 + 3) < ZP_RATE()) {
        var zl = h1(gx * 5 + 1, gy * 23 + 9) < 0.4 ? zz.props.mix : zz.props.main;
        var zk = zl[Math.floor(h1(gx * 31 + 2, gy * 7 + 11) * zl.length) % zl.length], zs = spot(211);
        if (P3z.FUSION[zk]) { out.push({ t: 'zp_' + zk, x: zs.x, z: zs.z, h: P3z.FUSION[zk].h }); }
      }
    }

    /* 손으로 **놓은** 것(`land.js` deco — 맵 편집기 "3D 배치"가 고친다). 제 자리·키·돌림 그대로
       해시 소품 위에 얹는다. 이 계획을 거치므로 집·탑·우물·장터는 벽 충돌(`houseRects`)도
       저절로 따라온다(마을 칸이 아닌 곳에 놓은 것도 — `houseRects` 가 그 칸의 deco 만 따로 본다) */
    if (authored && RG.decoAt) {
      var dk = RG.decoAt(gx, gy);
      for (i = 0; i < dk.length; i++) { out.push(dk[i]); }
    }

    return out;
  }

  /**
   * 이 칸에 선 **집·높은 집·우물·장터**의 충돌 사각형 — `world.js` 의 벽 충돌과
   * 교전 무대(`duelStage`·`camAim` 의 `duel` 구도)가 함께 쓴다(PLAN 27절,
   * 2026-08-30 우물·장터로 넓힘).
   *
   * **판정에 화면 값을 들이는 유일한 자리다.** 이 저장소는 여태 "화면은 판정에
   * 안 닿는다"를 지켜 왔지만(땅의 높낮이·손으로 그린 강 등), 벽 충돌만은 **눈에
   * 보이는 그 소품과 어긋나면 의미가 없다** — 사용자가 직접 고른 값이다(2026-08-29).
   * `propPlan` 은 순수 함수이므로 여기서도 **같은 좌표·같은 크기**가 나온다.
   *
   * 우물·장터는 `w`·`d`(가로·세로)가 따로 없다 — 크기가 아니라 `h`(키)만 갖고
   * 도는 소품이라, 실제 GLB 모델 발판 크기에 가깝게 `h` 에서 어림잡는다.
   * 정확한 값은 아니지만(모델 자체를 재지는 않는다), **집이 아닌 것에도
   * 카메라·발이 박히던 문제**(2026-08-30, 밀집 마을에서 교전 카메라가 우물/
   * 장터에 박힌 것을 실제로 찍어서 발견했다)를 없애는 데는 이 정도로 충분하다.
   */
  var FOOT_IN = 0.82;       // 모델 바닥 가운데 벽이 서는 몫(처마·지붕 끝 빼고)
  function houseRects(gx, gy) {
    /* 해시로 벽이 되는 소품(집·탑·우물·장터)을 세우는 건 마을 칸뿐이다. 다른 칸은
       손으로 놓은 것(`land.js` deco)만 — 여태는 칸 종류를 안 보고 늘 마을 계획을
       뽑아서, 들판에서도 교전 상대가 **안 보이는 집**을 피해 밀려났고(`duelSpotBlocked`),
       `world.js` 는 마을 칸만 재서 들판에 놓은 deco 집은 뚫고 지나갔다(2026-09-23) */
    var Wd = global.DG.world, RG = global.DG.land;
    var kind = Wd && Wd.terrainAt ? Wd.terrainAt(gx, gy) : 'town';
    /* 2026-09-28 실기 Q3 "몇 집이 벽에서 사라진다" — 기기가 버거우면 perf 가 밀도(PF prop)를 내리는데, 이미 지은 칸은
       다시 안 지어(칸 열쇠에 밀도가 없다) 옛 집이 그대로 보이고 벽만 새 밀도로 집 수·대지가 바뀌었다 → 지은 밀도로 뽑는다 */
    var plan = kind === 'town' ? propPlan('town', gx, gy, false, townDens[gx + ':' + gy])
      : (RG && RG.decoAt ? RG.decoAt(gx, gy) : []);
    var ox = gx * GRID + GRID / 2, oz = gy * GRID + GRID / 2;
    var out = [], i;
    for (i = 0; i < plan.length; i++) {
      var p = plan[i];
      if (p.t === 'house' || p.t === 'tower') {
        var P3h = global.DG.prop3d, hm = P3h && P3h.heightMul ? P3h.heightMul(p.t) : 1, hh = (p.h || 6) * hm;
        /* 2026-09-27 실기 "집을 통과하네 아직도" — 헤드리스로 재 보니 둘이 어긋났다.
           ① 크기: GLB 는 키(hh)로 고르게 늘여 그려 바닥이 p.w·p.d 보다 1.4~2.2배 넓다 → 그 자리 모델의 바닥(prop3d.footprint)
              × hh × FOOT_IN(처마·지붕 끝은 밑으로 걸어 다닌다). 모델이 아직 안 왔으면 옛 p.w·p.d
           ② 돌림: 모델은 rotation.y = rot 로 서는데 벽 사각형 식(lx = dx·cos + dz·sin)은 반대 방향으로 돈다 → -rot */
        var fp = P3h && P3h.footprint && P3h.houseOn && P3h.houseOn() ? P3h.footprint(p.t, gx + Math.round(p.x), gy + Math.round(p.z), undefined, propEra(p.t, ox + p.x, oz + p.z)) : null;
        var fw = fp ? Math.max(p.w, fp.w * hh * FOOT_IN) : p.w, fd = fp ? Math.max(p.d, fp.d * hh * FOOT_IN) : p.d;
        out.push({ x: ox + p.x, z: oz + p.z, w: fw, d: fd, rot: -(p.rot || 0), h: hh });
      } else if (p.t === 'well') {
        out.push({ x: ox + p.x, z: oz + p.z, w: p.h * 1.6, d: p.h * 1.6, rot: 0 });
      } else if (p.t === 'market') {
        out.push({ x: ox + p.x, z: oz + p.z, w: p.h * 2.8, d: p.h * 1.8, rot: p.rot || 0 });
      }
    }
    var FRh = global.DG.frost;                                   // §5 ⑲-27 서리봉 고원 명소 벽(산성 담·관측소·비행선…)
    if (FRh && FRh.rectsIn) { var frr = FRh.rectsIn(gx, gy); for (i = 0; i < frr.length; i++) { out.push(frr[i]); } }
    var SPh = global.DG.skyport;                                 // §5 ⑲-37 은하 나루 명소 벽(계류 탑·객차·틈 문…)
    if (SPh && SPh.rectsIn) { var spr = SPh.rectsIn(gx, gy); for (i = 0; i < spr.length; i++) { out.push(spr[i]); } }
    var AMh = global.DG.amber;                                   // §5 ⑲-57 굳은 거리 명소 벽(결정 막·굳은 자리·시계방·장터 돔·부양탑 심…)
    if (AMh && AMh.rectsIn) { var amr = AMh.rectsIn(gx, gy); for (i = 0; i < amr.length; i++) { out.push(amr[i]); } }
    var VTh = global.DG.vault;                                   // §5 ⑲-61 갈무리 벌 명소 벽(빛 울타리·금고 둥근 벽·동력 기둥·곳간·창고·컨테이너…)
    if (VTh && VTh.rectsIn) { var vtr = VTh.rectsIn(gx, gy); for (i = 0; i < vtr.length; i++) { out.push(vtr[i]); } }
    var FKh = global.DG.fork;                                    // §5 ⑲-65 세갈래 고을 명소 벽(호박 장막·문루·성벽·대장간·기관차·종루·격자 말뚝…)
    if (FKh && FKh.rectsIn) { var fkr = FKh.rectsIn(gx, gy); for (i = 0; i < fkr.length; i++) { out.push(fkr[i]); } }
    var CRh = global.DG.crossing;                                // §5 ⑲-41 틈새 갈림길 명소 벽(시계탑·성문 기둥·틈 문…)
    if (CRh && CRh.rectsIn) { var crr = CRh.rectsIn(gx, gy); for (i = 0; i < crr.length; i++) { out.push(crr[i]); } }
    var SKh = global.DG.sunken;                                  // §5 ⑲-44 잠긴 도읍 명소 벽(정전·돔 둘레·등대·해무 문…)
    if (SKh && SKh.rectsIn) { var skr = SKh.rectsIn(gx, gy); for (i = 0; i < skr.length; i++) { out.push(skr[i]); } }
    var ESh = global.DG.eraSites;                                // §5 ⑲-34 3부 시대 명소 벽(조선소 창고·기중기 다리)
    if (ESh && ESh.rectsIn) { var err = ESh.rectsIn(gx, gy); for (i = 0; i < err.length; i++) { out.push(err[i]); } }
    return out;
  }

  /* 사물의 도형은 **단위 하나씩만** 만들어 배율로 늘린다.
     크기마다 새 도형을 만들면 격자를 지날 때마다 GPU 메모리가 늘어난다. */
  var unit = {};
  function unitGeo(name) {
    if (unit[name]) { return unit[name]; }
    var g;
    if (name === 'box') { g = new T.BoxGeometry(1, 1, 1); }
    else if (name === 'cyl') { g = new T.CylinderGeometry(0.5, 0.5, 1, 8); }
    else if (name === 'cone4') { g = new T.ConeGeometry(0.72, 1, 4); }
    else if (name === 'cone') { g = new T.ConeGeometry(0.5, 1, 7); }
    else if (name === 'sph') { g = new T.SphereGeometry(0.5, 8, 6); }
    else if (name === 'plane') { g = new T.PlaneGeometry(1, 1); }
    else if (name === 'disc') { g = new T.CircleGeometry(1, 20); }
    else if (name.indexOf('shoreW') === 0) { g = shoreGeo(+name.slice(6)); }
    unit[name] = g;
    return g;
  }
  /** 물가 전용 평면(PLAN 부록, "물가 경계도 자연스럽게", 2026-09-07) — 단위
   *  사각형(-0.5~0.5)을 잘게 나누고, `mask`(1=동·2=서·4=북·8=남, `rotation.x=
   *  -90°` 뒤집기를 손으로 풀어 확인한 값)에 켜진 변의 바깥 테두리 정점만
   *  안쪽으로 들쭉날쭉 밀어 넣는다. **꺼진 변(강물끼리 이어지는 자리)은 손
   *  안 댄다** — 옆 칸의 같은 변도 똑같이 안 밀리므로 두 칸이 자로 잰 듯
   *  맞물린다(따로 자리를 맞출 필요가 없다). 마스크당 하나씩만 지어 `unit`에
   *  얹으므로(최대 16장) `box()`의 배율·자리로 그대로 쓸 수 있고, 다른 도형과
   *  같은 값이라 뒤에서 따로 dispose 할 것이 없다(1226행 "도형·재질은 모두가
   *  나눠 쓰는 것" 원칙 그대로). */
  function shoreGeo(mask) {
    var SEG = 10, EAST = 1, WEST = 2, NORTH = 4, SOUTH = 8;
    var g = new T.PlaneGeometry(1, 1, SEG, SEG);
    var pos = g.getAttribute('position');
    var AMP_MIN = 0.07, AMP_RANGE = 0.10;
    for (var i = 0; i < pos.count; i++) {
      var lx = pos.getX(i), ly = pos.getY(i), nx = lx, ny = ly;
      if ((mask & EAST) && Math.abs(lx - 0.5) < 1e-6) {
        nx = 0.5 - (AMP_MIN + h1(i * 7 + 3, mask * 11 + 1) * AMP_RANGE);
      }
      if ((mask & WEST) && Math.abs(lx + 0.5) < 1e-6) {
        nx = -0.5 + (AMP_MIN + h1(i * 5 + 9, mask * 13 + 2) * AMP_RANGE);
      }
      if ((mask & NORTH) && Math.abs(ly - 0.5) < 1e-6) {
        ny = 0.5 - (AMP_MIN + h1(i * 3 + 17, mask * 17 + 3) * AMP_RANGE);
      }
      if ((mask & SOUTH) && Math.abs(ly + 0.5) < 1e-6) {
        ny = -0.5 + (AMP_MIN + h1(i * 11 + 23, mask * 19 + 4) * AMP_RANGE);
      }
      if (nx !== lx || ny !== ly) { pos.setXY(i, nx, ny); }
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }
  /* 바람 흔들림(PLAN 44절) — 잎·풀·갈대에만 쓰는 재질에 정점 셰이더를 조금
     보탠다. Lambert 의 조명·안개·톤매핑 조각은 손 안 댄다(`#include <begin_vertex>`
     **뒤**에서 자리만 살짝 민다) — `water3d.js` 가 그랬듯 안개를 빼먹으면 안 되므로,
     여기는 안개 조각째 그대로 두고 자리만 보탠 것이다.
     인스턴스마다 다른 위상을 줘야 한 덩이가 통째로 같이 흔들리지 않는다 —
     새 attribute 를 안 늘리려고 `instanceMatrix` 의 이동칸을 씨앗 삼아 해시를 만든다.
     GLB(진짜 모델)에는 안 쓴다 — trunk/leaf 조각이 안 갈려 있어 뿌리까지 흔들리면
     어색하고, 색으로 캐시하는 `prop3d.matCache` 를 건드리면 우연히 같은 색인
     다른 사물까지 흔들릴 수 있다(LOD 밖의 도형 나무·풀만 흔든다) */
  var swayShaders = [], swayClock = 0;
  function swayify(m) {
    m.onBeforeCompile = function (shader) {
      shader.uniforms.uSwTime = { value: swayClock };
      shader.uniforms.uSwAmt = { value: SWAY_AMT() };
      shader.vertexShader = 'uniform float uSwTime;\nuniform float uSwAmt;\n' +
        shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n' +
          '#ifdef USE_INSTANCING\n' +
          '  float swPhase = dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719));\n' +
          '#else\n' +
          '  float swPhase = 0.0;\n' +
          '#endif\n' +
          '  float swLift = (transformed.y + 0.5) * uSwAmt;\n' +
          '  transformed.x += sin(uSwTime * 1.6 + swPhase) * swLift;\n' +
          '  transformed.z += cos(uSwTime * 1.3 + swPhase) * swLift * 0.6;\n');
      swayShaders.push(shader);
    };
    /* 흔들리는 것과 안 흔들리는 재질은 **다른 프로그램**이다 — 캐시 키를 안 가르면
       three 가 컴파일된 프로그램을 서로 나눠 쓰려다 하나만 남는다 */
    m.customProgramCacheKey = function () { return 'sway'; };
  }

  var propMat = {};
  function pmat(hex, opt) {
    var key = hex + '|' + (opt || '');
    if (propMat[key]) { return propMat[key]; }
    var m = new T.MeshLambertMaterial({ color: new T.Color(hex), flatShading: opt === 'flat' });
    /* 수면은 **깊이를 안 적는다** — 적으면 물속에 있는 것(잉어)을 통째로 가린다.
       반투명이라 비쳐 보여야 맞는데, 깊이 버퍼가 먼저 잘라내 아무것도 안 남았다 */
    if (opt === 'water') {
      /* 물결치는 수면이 있으면 그것을 쓴다(`water3d.js`). 없거나 등급이 LOW 면
         null 이 와서 **여태 쓰던 판 한 장**으로 간다 — 그림만 어제로 돌아간다 */
      var wm = global.DG.water3d ? global.DG.water3d.material(T, hex) : null;
      if (wm) { propMat[key] = wm; return wm; }
      m.transparent = true; m.opacity = 0.72; m.depthWrite = false;
    }
    if (opt === 'glow') { m.emissive = new T.Color(hex); m.emissiveIntensity = 0.9; }
    if (opt === 'sway') { swayify(m); }
    /* 연기는 **낱개가 저마다 다른 짙기로 사라졌다 다시 짙어진다** — 재질을
       나눠 쓰면 한 알의 짙기가 바뀔 때 다른 알까지 같이 바뀐다. 그래서
       여기서는 원판만 캐시해 두고, 부르는 쪽(`addLampSmoke`)이 매번 복제해
       쓴다(연기 알갱이 수가 적어 복제 비용이 무시할 만하다) */
    if (opt === 'smoke') { m.transparent = true; m.opacity = 0.32; m.depthWrite = false; }
    /* 폭포 물줄기 — 'water' 와 달리 **세워 놓는 판**이라 water3d 의 수평 수면
       셰이더를 그대로 못 쓴다(그쪽은 위에서 내려다보는 잔물결이 전제다).
       옅은 하늘색 반투명 판 하나로 그친다(PLAN 44절) */
    if (opt === 'fall') { m.transparent = true; m.opacity = 0.5; m.depthWrite = false; }
    propMat[key] = m;
    return m;
  }
  function box(g, geoName, mtl, x, y, z, sx, sy, sz, cast) {
    var m = new T.Mesh(unitGeo(geoName), mtl);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    if (cast) { m.castShadow = true; }
    g.add(m);
    return m;
  }

  /* ── 인스턴싱 (PLAN 16절) ───────────────────────────────
   * 잔 사물은 **같은 도형에 같은 색**이다 — 나무 백 그루가 저마다 자기 Mesh 를
   * 들고 있을 까닭이 없다. 종류마다 `InstancedMesh` 한 덩이를 두고 **자리(slot)만
   * 빌려 준다.** 격자가 사라지면 자리를 돌려받는다.
   *
   * **집·탑·다리는 안 묶는다.** 크기와 색이 제각각이라 한 덩이로 못 모으고,
   * 수도 적어 이득이 없다. 16절이 지목한 것도 "나무·돌·풀·꽃" 이다.
   *
   * 잎 색은 계절이 바꾸므로 **색이 이름의 일부**다 — 가을이 되면 새 덩이가 하나
   * 생기고 옛 덩이는 빈 채로 남는다(넷뿐이라 그냥 둔다).
   */
  function INST_ON() { return core.tuned('world3d.instanced', 1) ? true : false; }
  function INST_CAP() { return core.tuned('world3d.instCap', 1600); }
  /* GLB 조각은 도형이 무거워 창고를 작게 잡는다 — 모양이 여럿이라 나눠 쓴다 */
  function GLB_CAP() { return core.tuned('world3d.glbCap', 260); }

  var instKinds = {};      // 이름 → {mesh, free:[], n, mat, live, sph, ...}
  var instOf = {};         // 격자 키 → [{name, slot}]

  function instBox(name, geoName, hex, opt, cast) {
    return instMake(name, unitGeo(geoName), pmat(hex, opt), cast);
  }

  /** 도형과 재질을 받아 덩이 하나를 만든다 (도형은 `unitGeo` 든 GLB 조각이든 같다) */
  function instMake(name, geo, mtl, cast, cap) {
    if (instKinds[name]) { return instKinds[name]; }
    cap = cap || INST_CAP();
    var m = new T.InstancedMesh(geo, mtl, cap);
    m.name = 'inst:' + name;                // §6.1-B ① 재기(triBreakdown)가 이름으로 가려 본다
    m.instanceMatrix.setUsage(T.DynamicDrawUsage);
    m.castShadow = !!cast;
    m.receiveShadow = false;
    m.frustumCulled = false;          // 자리가 온 세상에 흩어져 있어 상자로 못 자른다 → instCull 이 자리마다 자른다
    var free = [], i;
    for (i = cap - 1; i >= 0; i--) { free.push(i); }
    /* **보이는 것만 그린다.** 자리(slot)의 행렬은 `mat` 에 따로 적어 두고, 매 프레임
       `instCull` 이 카메라·그림자 상자에 걸린 자리만 `instanceMatrix` 앞쪽에 채워
       `count` 를 그 수로 둔다. 전에는 "가장 높이 쓴 자리 + 1" 까지 다 그려서, 격자가
       사라져 크기 0 으로 숨긴 빈 자리와 등 뒤 소품까지 그렸다 — 폰 점검(2026-09-25)
       에서 삼각형 743만 중 살아 있는 것 258만, 시야 안 7만이었다(수풀 한 포기 2.7만) */
    if (!geo.boundingSphere) { geo.computeBoundingSphere(); }
    var bs = geo.boundingSphere;
    m.count = 0;
    propGroup.add(m);
    instKinds[name] = {
      mesh: m, free: free, n: 0, hi: 0,
      mat: new Float32Array(cap * 16),   // 자리마다 행렬
      live: new Uint8Array(cap),         // 자리가 차 있나
      sph: new Float32Array(cap * 4),    // 자리마다 월드 구(중심 xyz·반지름)
      c0: bs.center.clone(), r0: bs.radius, dirty: true
    };
    return instKinds[name];
  }

  var _p = null, _q = null, _s = null, _m4 = null;
  /** 자리 하나를 빌린다 — 창고가 다 차면 false 를 주고, 부르는 쪽이 옛 길로 간다 */
  function instPut(key, name, geoName, hex, opt, cast, x, y, z, sx, sy, sz, rx, ry, rz) {
    return instAt(instBox(name, geoName, hex, opt, cast), key, name,
                  x, y, z, sx, sy, sz, rx, ry, rz);
  }

  /** 덩이 하나에 자리를 하나 적는다 */
  function instAt(K, key, name, x, y, z, sx, sy, sz, rx, ry, rz) {
    if (!K.free.length) { return false; }
    var slot = K.free.pop();
    if (!_p) { _p = new T.Vector3(); _q = new T.Quaternion(); _s = new T.Vector3(); _m4 = new T.Matrix4(); }
    _p.set(x, y, z);
    _q.setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0));
    _s.set(sx, sy, sz);
    _m4.compose(_p, _q, _s);
    _m4.toArray(K.mat, slot * 16);
    K.live[slot] = 1;
    _p.copy(K.c0).applyMatrix4(_m4);
    K.sph[slot * 4] = _p.x; K.sph[slot * 4 + 1] = _p.y; K.sph[slot * 4 + 2] = _p.z;
    K.sph[slot * 4 + 3] = K.r0 * Math.max(Math.abs(sx), Math.abs(sy), Math.abs(sz));
    K.dirty = true;
    if (slot + 1 > K.hi) { K.hi = slot + 1; }
    K.n++;
    if (!instOf[key]) { instOf[key] = []; }
    instOf[key].push({ name: name, slot: slot });
    return true;
  }

  /** 이 격자가 빌린 자리를 다 돌려받는다 */
  function instDrop(key) {
    var list = instOf[key];
    if (!list) { return 0; }
    for (var i = 0; i < list.length; i++) {
      var K = instKinds[list[i].name];
      if (!K) { continue; }
      K.live[list[i].slot] = 0;
      K.dirty = true;
      K.free.push(list[i].slot);
      K.n--;
    }
    delete instOf[key];
    return list.length;
  }

  /**
   * 자리마다 자른다 — 카메라 시야(안개 끝 너머는 안개 색뿐이라 뺀다) 또는
   * 그림자 상자에 걸린 자리만 `instanceMatrix` 앞쪽에 채운다. 화질은 그대로다:
   * 빼는 것은 **화면에도 그림자에도 안 닿는 것**뿐이다. 그림자 상자는 해를 따라
   * 움직이므로 렌더러가 할 계산(`shadow.updateMatrices`)을 한 번 먼저 한다.
   * 카메라·해가 그대로고 자리도 안 바뀌었으면 아무것도 안 올린다(가만히 서 있을 때).
   */
  var cullCam = null, cullSun = null, cullPV = null, cullSV = null, cullLastPV = null, cullLastSV = null;
  var cullStat = { live: 0, drawn: 0, frames: 0 };
  function inFr(fr, x, y, z, r) {
    var pl = fr.planes;
    for (var i = 0; i < 6; i++) {
      var n = pl[i].normal;
      if (n.x * x + n.y * y + n.z * z + pl[i].constant < -r) { return false; }
    }
    return true;
  }
  function instCull() {
    if (!camera || !propGroup) { return; }
    if (!cullCam) {
      cullCam = new T.Frustum(); cullSun = new T.Frustum();
      cullPV = new T.Matrix4(); cullSV = new T.Matrix4();
      cullLastPV = new T.Matrix4(); cullLastSV = new T.Matrix4();
    }
    camera.updateMatrixWorld();
    cullPV.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    cullCam.setFromProjectionMatrix(cullPV);
    var shadowOn = !!(renderer.shadowMap.enabled && sun && sun.castShadow);
    if (shadowOn) {
      sun.updateMatrixWorld();
      sun.target.updateMatrixWorld();
      sun.shadow.updateMatrices(sun);
      cullSV.copy(sun.shadow.matrix);
      cullSun.copy(sun.shadow.getFrustum());
    }
    var moved = !cullPV.equals(cullLastPV) || (shadowOn && !cullSV.equals(cullLastSV));
    cullLastPV.copy(cullPV); cullLastSV.copy(cullSV);
    var fog = scene.fog && scene.fog.isFog ? scene.fog.far : 0;
    var cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    propGroup.updateMatrixWorld();
    var gw = propGroup.matrixWorld.elements;
    var ox = gw[12], oy = gw[13], oz = gw[14];   // 소품 무리는 돌지도 늘지도 않는다(월드 미터) — 옮김만 본다
    var live = 0, drawn = 0, k;
    for (k in instKinds) {
      if (!Object.prototype.hasOwnProperty.call(instKinds, k)) { continue; }
      var K = instKinds[k];
      live += K.n;
      if (!K.dirty && !moved) { drawn += K.mesh.count; continue; }
      var cast = shadowOn && K.mesh.castShadow;
      var arr = K.mesh.instanceMatrix.array, sp = K.sph, j = 0, i;
      for (i = 0; i < K.hi; i++) {
        if (!K.live[i]) { continue; }
        var x = sp[i * 4] + ox, y = sp[i * 4 + 1] + oy, z = sp[i * 4 + 2] + oz, r = sp[i * 4 + 3];
        var see = inFr(cullCam, x, y, z, r);
        if (see && fog) {
          var dx = x - cx, dy = y - cy, dz = z - cz, lim = fog + r;
          if (dx * dx + dy * dy + dz * dz > lim * lim) { see = false; }
        }
        if (!see && !(cast && inFr(cullSun, x, y, z, r))) { continue; }
        arr.set(K.mat.subarray(i * 16, i * 16 + 16), j * 16);
        j++;
      }
      K.mesh.count = j;
      if (j) {
        var im = K.mesh.instanceMatrix;
        if (im.clearUpdateRanges) { im.clearUpdateRanges(); im.addUpdateRange(0, j * 16); }
        im.needsUpdate = true;
      }
      K.dirty = false;
      drawn += j;
    }
    cullStat.live = live; cullStat.drawn = drawn; cullStat.frames++;
  }

  /** 지금 몇 덩이에 몇 자리가 차 있나 — 진단·데모가 값으로 본다 */
  function instStats() {
    var out = { on: INST_ON(), cap: INST_CAP(), kinds: 0, used: 0, by: {} };
    for (var k in instKinds) {
      if (!Object.prototype.hasOwnProperty.call(instKinds, k)) { continue; }
      out.kinds++; out.used += instKinds[k].n; out.by[k] = instKinds[k].n;
    }
    return out;
  }

  /**
   * 잔 사물을 인스턴스로 세운다 — 세웠으면 true.
   * 좌표는 **월드 미터**다(격자 Group 안이 아니라 세상에 바로 놓기 때문).
   */
  /**
   * **GLB 소품** 하나를 세운다 (`prop3d.js`).
   * 나무 한 그루는 줄기와 잎이 다른 재질이라 조각이 둘이다 — 조각마다 덩이를
   * 하나씩 두고 **같은 행렬을 다 적는다.** 화면에서는 한 그루로 보인다.
   *
   * 아직 안 왔으면 false 를 주고, 부르는 쪽이 여태 쓰던 도형으로 간다.
   */
  /* W-0119 땅 시대(고향 = 과거) — 집·등롱·우물만 */ function propEra(want, x, z) { var Bz = global.DG.biome, zn = (want === 'house' || want === 'lamp' || want === 'well') && Bz && Bz.zoneAt ? Bz.zoneAt(x, z) : undefined; return zn === undefined ? null : (zn && zn.era) || 'past'; }  function instGlb(key, want, x, z, h, gx, gy, rot) {
    var P3 = global.DG.prop3d;
    if (!P3) { return false; }
    /* ⑲-33 고원 땅 나무는 눈 재질 — 덩이 이름을 갈라 다른 땅 나무와 안 섞인다 */
    var FRs = global.DG.frost, snow = want === 'tree' && FRs && FRs.treeSnow ? FRs.treeSnow(x, z) : 0;
    var got = P3.parts(want, gx, gy, undefined, snow, propEra(want, x, z));
    if (!got || !got.parts.length) { return false; }
    var tag = got.snow ? '#snow' + got.snow : '';
    /* 자리마다 조금씩 돌려 세운다 — 안 돌리면 나무 백 그루가 같은 쪽을 본다.
       집은 제 회전을 이미 갖고 있으므로(길을 보고 선다) 그것을 그대로 쓴다 */
    var ry = typeof rot === 'number' ? rot : h1(gx * 41 + 7, gy * 83 + 13) * Math.PI * 2;
    var hh = h * P3.heightMul(want);
    var i, ok = true;
    for (i = 0; i < got.parts.length; i++) {
      var K = instMake(got.url + tag + '#' + i, got.parts[i].geometry,
                        got.parts[i].material, P3.casts(want), GLB_CAP());
      ok = instAt(K, key, got.url + tag + '#' + i, x, groundY(x, z), z, hh, hh, hh, 0, ry, 0) && ok;
    }
    return ok;
  }

  function instProp(key, p, ox, oz) {
    if (!INST_ON()) { return false; }
    var x = ox + p.x, z = oz + p.z;
    /* **진짜 모델이 와 있으면 그것으로 세운다** (새 PLAN STEP 4).
       격자 좌표를 같이 넘겨 같은 자리에는 늘 같은 모양이 서게 한다 */
    var gx = Math.round((ox - GRID / 2) / GRID), gy = Math.round((oz - GRID / 2) / GRID);
    /* 왼쪽이 이 판의 소품 이름, 오른쪽이 `prop3d` 표의 이름이다.
       손으로 그린 땅의 일곱(산·등롱·사당·굴·폐허·다리·벼)도 여기서 갈린다 */
    var GLB = { tree: 'tree', rock: 'rock', grass: 'grass', reed: 'grass',
                house: 'house', tower: 'tower',
                peak: 'peak', lamp: 'lamp', shrine: 'shrine', cave: 'cave',
                ruin: 'ruin', bridge: 'bridge', rice: 'rice',
                well: 'well', market: 'market', waterfall: 'waterfall',
                temple: 'temple' };
    /* LOD(PLAN 36절) — 나무·바위·풀·갈대는 `LOD_NEAR` 안에 있을 때만 진짜
       모델을 받는다. 밖이면 곧장 아래의 싼 도형(원뿔·공)으로 간다. 집·탑·
       랜드마크는 칸당 수가 적어 거리를 안 가린다 */
    var natureLod = p.t === 'tree' || p.t === 'rock' || p.t === 'grass' || p.t === 'reed';
    var lodOk = !natureLod ||
      Math.hypot(x - core.save.player.pos.x, z - core.save.player.pos.y) <= LOD_NEAR();
    /* 땅 전용 퓨전 소품('zp_*')은 prop3d 표 이름 그대로다 */
    var glbName = GLB[p.t] || (p.t && p.t.indexOf('zp_') === 0 ? p.t : null);
    if (lodOk && glbName && instGlb(key, glbName, x, z, p.h, gx + Math.round(p.x),
                            gy + Math.round(p.z), p.rot)) {
      return true;
    }
    if (p.t === 'tree') {
      var SS = global.DG.season, FRt = global.DG.frost;
      var leafHex = SS ? SS.leaf(0x2f5a34) : 0x2f5a34;
      if (FRt && FRt.treeSnow && FRt.treeSnow(x, z) > 0) { leafHex = 0xc4d2d8; }   // ⑲-33 먼 곳 원뿔 나무도 눈빛
      var a = instPut(key, 'trunk', 'cyl', 0x4a3a2a, '', true,
        x, p.h * 0.21, z, 1.2, p.h * 0.42, 1.2);
      var bb = instPut(key, 'leaf:' + leafHex, 'cone', leafHex, 'sway', true,
        x, p.h * 0.58, z, p.h * 0.68, p.h * 0.72, p.h * 0.68);
      return a && bb;
    }
    if (p.t === 'rock') {
      return instPut(key, 'rock', 'sph', 0x6b6a72, 'flat', true,
        x, p.h * 0.32, z, p.h * 1.5, p.h * 0.9, p.h * 1.3, 0.3, p.x, 0.2);
    }
    if (p.t === 'grass') {
      return instPut(key, 'grass', 'cone', 0x5d7a44, 'sway', false,
        x, p.h * 0.5, z, p.h * 1.5, p.h, p.h * 1.5);
    }
    if (p.t === 'reed') {
      return instPut(key, 'reed', 'cone', 0x6d7f4a, 'sway', false,
        x, p.h * 0.5, z, 0.5, p.h, 0.5);
    }
    return false;
  }

  /**
   * 등불 한 알. **밤에만 보인다** — 낮에 켜 두면 흰 점으로만 남는다.
   * 지금이 밤인지 여기서 곧바로 정한다: 나중에 걸어 들어온 격자는
   * `syncLamps` 가 이미 훑고 지나간 뒤라 낮에도 켜진 채 남는다.
   */
  function addLampBulb(g, x, y, z, r) {
    var b = box(g, 'sph', pmat(0xffd489, 'glow'), x, y, z, r, r * 1.25, r, false);
    b.userData.lamp = true;
    b.visible = !!(lightNow && lightNow.lamp > 0.2);
    return b;
  }

  /** 등롱 위로 오르는 연기 두 알(PLAN 44절). 불과 같이 밤에만 보인다 —
   * `syncLamps` 가 이 애도 `userData.lamp` 로 함께 여닫는다.
   * **격자 키로 나눠 든다**(`smokeByKey`) — 그래야 그 격자가 부서질 때
   * (`syncProps`·`refreshProps`) 함께 치워 창고가 걸을수록 늘어나지 않는다 */
  var smokeByKey = {};
  /* 여기서 어긋나면 **그 격자를 짓던 `buildProp` 통째로 멎는다**(같은 for 문
   * 안이라, 이 뒤에 올 나무·집도 안 선다) — 그래서 몸만 남기고 조용히 넘어간다 */
  function addLampSmoke(g, key, x, y, z) {
    try {
      var list = smokeByKey[key] || (smokeByKey[key] = []);
      var i;
      for (i = 0; i < 2; i++) {
        var s = box(g, 'sph', pmat(0xb9b9b9, 'smoke').clone(), x, y, z, 0.4, 0.4, 0.4, false);
        s.userData.lamp = true;
        s.userData.smoke = { x: x, baseY: y, z: z, ph: Math.random() * 6.28 + i * Math.PI };
        s.visible = !!(lightNow && lightNow.lamp > 0.2);
        list.push(s);
      }
    } catch (err) {
      if (global.console) { console.error('[world3d] 연기 알갱이를 못 세웠다', err); }
    }
  }

  function buildProp(kind, gx, gy, mapped, key) {
    var g = new T.Group();
    var dens = DENSITY();
    if (kind === 'town') { townDens[gx + ':' + gy] = dens; }
    var plan = propPlan(kind, gx, gy, mapped, dens);
    var ox = gx * GRID + GRID / 2, oz = gy * GRID + GRID / 2;
    var i;
    for (i = 0; i < plan.length; i++) {
      var p = plan[i];
      /* 잔 사물은 인스턴스 덩이가 받는다. 창고가 다 차면 false 가 와서
         아래의 옛 길(제 Mesh 를 만드는 길)로 그대로 흘러간다 */
      var inst = key && instProp(key, p, ox, oz);
      if (inst) {
        /* **불만은 인스턴스가 못 맡는다.** 등롱과 사당의 등은 밤에만 켜지는데
           (`syncLamps` 가 `userData.lamp` 를 훑는다) 인스턴스 덩이는 낱개를
           켜고 끌 수가 없다. 몸은 모델이 세웠으니 **불만 여기서 얹는다** */
        if (p.t === 'lamp') {
          addLampBulb(g, p.x, p.h + 0.25, p.z, 0.8);
          addLampSmoke(g, key, p.x, p.h + 0.7, p.z);
        } else if (p.t === 'shrine') {
          addLampBulb(g, -3.4, 2.8, 4.6, 0.7);
          addLampBulb(g, 3.4, 2.8, 4.6, 0.7);
          addLampSmoke(g, key, -3.4, 3.3, 4.6);
          addLampSmoke(g, key, 3.4, 3.3, 4.6);
        }
        continue;
      }
      if (p.t === 'house' || p.t === 'tower') {
        /* 벽은 밝고 지붕은 짙다 — 한옥이 그렇고, 그래야 지붕선이 보인다.
           둘 다 어두우면 멀리서 회색 덩어리 하나로 뭉친다 */
        var sh = 0.55 + p.shade * 0.42;
        var wall = pmat(((Math.round(sh * 250) << 16) |
                         (Math.round(sh * 244) << 8) |
                          Math.round(sh * 232)));
        var body = box(g, 'box', wall, p.x, p.h / 2, p.z, p.w, p.h, p.d, true);
        body.rotation.y = p.rot;
        body.receiveShadow = true;
        if (p.roof) {
          /* 기와지붕 — 이 판의 건물을 한옥으로 보이게 하는 것은 이 사각뿔 하나다 */
          var roof = box(g, 'cone4', pmat(0x4a5360, 'flat'),
            p.x, p.h + p.w * 0.22, p.z, p.w * 1.28, p.w * 0.55, p.d * 1.28, true);
          roof.rotation.y = p.rot + Math.PI / 4;
        } else {
          box(g, 'box', pmat(0x39404c), p.x, p.h + 0.3, p.z, p.w * 0.9, 0.6, p.d * 0.9, false)
            .rotation.y = p.rot;
        }
      } else if (p.t === 'tree') {
        /* 잎 색은 **계절이 정한다**(`season.js`) — 계절이 꺼져 있으면 예전 초록 */
        var SS = global.DG.season;
        var leafHex = SS ? SS.leaf(0x2f5a34) : 0x2f5a34;
        box(g, 'cyl', pmat(0x4a3a2a), p.x, p.h * 0.21, p.z, 1.2, p.h * 0.42, 1.2, true);
        box(g, 'cone', pmat(leafHex, 'sway'), p.x, p.h * 0.58, p.z, p.h * 0.68, p.h * 0.72, p.h * 0.68, true);
      } else if (p.t === 'rock') {
        var rk = box(g, 'sph', pmat(0x6b6a72, 'flat'), p.x, p.h * 0.32, p.z, p.h * 1.5, p.h * 0.9, p.h * 1.3, true);
        rk.rotation.set(0.3, p.x, 0.2);
      } else if (p.t === 'grass') {
        box(g, 'cone', pmat(0x5d7a44, 'sway'), p.x, p.h * 0.5, p.z, p.h * 1.5, p.h, p.h * 1.5, false);
      } else if (p.t === 'peak') {
        box(g, 'cone', pmat(0x4a4752, 'flat'), p.x, p.h / 2, p.z, GRID * 0.84, p.h, GRID * 0.84, true)
          .receiveShadow = true;
      } else if (p.t === 'water') {
        /* 네모난 수면은 **격자를 그대로 드러낸다** — 한 칸만 물인 자리에 파란 사각형이
           덩그러니 놓인다. 원반으로 깔면 홀로 있으면 못이 되고 이어지면 강이 된다.
           다만 **손으로 그린 강**(p.sq)은 이야기가 다르다 — 이어지라고 그은 물이라
           원반으로 깔면 가장자리가 부채꼴로 패어 강이 아니라 물웅덩이 줄로 보인다.
           그 자리는 격자를 꽉 채우는 네모로 깐다(눈으로 보고 알았다) */
        var wy = 0.12 + (p.rise ? 0.55 : 0);          // 불면 수면이 올라온다
        var wg = p.rise ? 1.06 : 1;
        var whex = p.rise ? 0x2a5f88 : 0x2f6f9e;       // 흙탕물은 더 어둡다
        /* 물가 쪽(마스크가 켜진 변)만 들쭉날쭉한 `shoreW<mask>`를 쓴다 — 강물끼리
           이어지는 변(꺼진 비트)은 안 깎여 있어 옆 칸과 자로 잰 듯 맞물린다.
           마스크가 통째로 0(사방이 물)이면 굳이 새 도형을 안 쓰고 옛 'plane'
           그대로 간다(캐시 낭비 없음, 화면도 똑같다) */
        var wGeo = p.sq ? ((p.shore | 0) ? ('shoreW' + (p.shore | 0)) : 'plane') : 'disc';
        var w = box(g, wGeo, pmat(whex, 'water'), 0, wy, 0, (p.sq ? (GRID + 0.5) : GRID * 0.62) * wg,
          (p.sq ? (GRID + 0.5) : GRID * 0.62) * wg, 1, false);
        w.rotation.x = -Math.PI / 2;
      } else if (p.t === 'field') {
        /* 논 한 뙈기 — 물 댄 낯을 얇게 깔고 두렁을 두른다. 지면보다 조금만 띄운다
           (많이 띄우면 논이 공중에 뜨고, 안 띄우면 지면과 다퉈 얼룩진다) */
        var fld = box(g, 'box', pmat(0x3f6b52), p.x, 0.09, p.z, p.w, 0.18, p.d, false);
        fld.rotation.y = p.rot;
        fld.receiveShadow = true;
        /* 두렁은 **테두리**다. 한 덩이로 덮으면 논이 그 밑에 깔려 흙판만 보인다
           (눈으로 보고 알았다) — 네 변만 두른다 */
        /* **이름을 `lox`·`loz` 로 둔 까닭** — 여기서 `ox`·`oz` 를 쓰면 `var` 가
           함수 범위라 이 함수 맨 위의 **격자 원점**(`ox`·`oz`)을 통째로 덮어쓴다.
           그러면 이 논 뒤에 오는 소품이 전부 원점 근처(9, 0)로 끌려가 사라진다 —
           벼가 안 서던 것이 이것이었다(2026-08-29에 잡았다) */
        var lw = 1.1, li;
        for (li = 0; li < 4; li++) {
          var ax = li < 2 ? p.w + lw : lw, az = li < 2 ? lw : p.d + lw;
          var lox = li === 0 ? 0 : (li === 1 ? 0 : (li === 2 ? -(p.w + lw) / 2 : (p.w + lw) / 2));
          var loz = li === 0 ? -(p.d + lw) / 2 : (li === 1 ? (p.d + lw) / 2 : 0);
          var lv = box(g, 'box', pmat(0x7a6f57), 0, 0.20, 0, ax, 0.22, az, false);
          lv.position.set(p.x + Math.cos(p.rot) * lox - Math.sin(p.rot) * loz, 0.20,
                          p.z + Math.sin(p.rot) * lox + Math.cos(p.rot) * loz);
          lv.rotation.y = p.rot;
        }
      } else if (p.t === 'scare') {
        /* 허수아비 — 장대 하나에 가로대와 삿갓. 논에 사람이 산다는 표다 */
        box(g, 'cyl', pmat(0x6b5a3f), p.x, p.h * 0.5, p.z, 0.16, p.h, 0.16, true);
        box(g, 'box', pmat(0x6b5a3f), p.x, p.h * 0.78, p.z, 1.6, 0.13, 0.13, false);
        box(g, 'cone', pmat(0xa8925f, 'flat'), p.x, p.h + 0.16, p.z, 1.1, 0.5, 1.1, false);
      } else if (p.t === 'bridge') {
        /* 다리 — 강을 **가로질러** 놓는다. 길이 남북이라 상판도 남북으로 길다.
           난간이 없으면 멀리서 물 위의 널빤지로만 보인다.
           **모델을 못 받았을 때만 여기 온다.** 계획은 일곱 칸으로 나뉘어 있으므로
           첫 칸(`seg` 0)에서만 옛 모습대로 48m 상판 하나를 세운다 */
        if (p.seg) { continue; }
        box(g, 'box', pmat(0x7a6a52), 0, 1.7, 0, 7, 0.5, GRID * 1.02, true).receiveShadow = true;
        var bi;
        for (bi = -1; bi <= 1; bi += 2) {
          box(g, 'box', pmat(0x8a7a60), bi * 3.3, 1.7 + 0.75, 0, 0.35, 1.0, GRID * 1.02, false);
        }
        for (bi = -1; bi <= 1; bi += 2) {          // 물속 교각
          box(g, 'cyl', pmat(0x5d5347), 0, 1.7 * 0.5, bi * GRID * 0.28, 1.5, 1.7 * 2, 1.5, false);
        }
      } else if (p.t === 'cave') {
        /* 굴 입구 — 바위 더미에 **검은 반원**을 박는다. 산 사면에 뚫린 구멍으로 보인다 */
        box(g, 'sph', pmat(0x5a5560, 'flat'), 0, p.h * 0.34, 0, p.h * 2.4, p.h * 1.5, p.h * 2.0, true);
        var mouth = box(g, 'disc', pmat(0x0d1014), 0, p.h * 0.34, p.h * 0.98, 2.6, 3.4, 1, false);
        mouth.rotation.set(0, 0, 0);
        box(g, 'box', pmat(0x6b6a72, 'flat'), -3.1, p.h * 0.25, p.h * 0.9, 0.9, p.h * 0.5, 0.9, false);
        box(g, 'box', pmat(0x6b6a72, 'flat'), 3.1, p.h * 0.25, p.h * 0.9, 0.9, p.h * 0.5, 0.9, false);
      } else if (p.t === 'ruin') {
        /* 폐허 — 주춧돌 위에 **부러진 기둥 넷**. 높이를 서로 다르게 해야 폐허로 보인다
           (같으면 짓다 만 집이다) */
        box(g, 'box', pmat(0x5f5a52, 'flat'), 0, 0.2, 0, 13, 0.4, 13, false).receiveShadow = true;
        var rp = [[-4.4, -4.4, 1.0], [4.4, -4.4, 0.55], [-4.4, 4.4, 0.75], [4.4, 4.4, 0.3]], ri;
        for (ri = 0; ri < rp.length; ri++) {
          box(g, 'cyl', pmat(0x8a8378, 'flat'),
            rp[ri][0], 0.4 + p.h * rp[ri][2] * 0.5, rp[ri][1], 1.1, p.h * rp[ri][2], 1.1, true);
        }
        box(g, 'box', pmat(0x7c766c, 'flat'), 1.2, 0.7, 0, 6, 0.7, 1.2, false).rotation.y = 0.4;
      } else if (p.t === 'shrine') {
        /* 옛 사당 — 작은 기와집 하나에 돌계단과 등롱 둘. 숲 속에서 이것만 사람 손이다 */
        box(g, 'box', pmat(0x6a6258, 'flat'), 0, 0.3, 0, 9, 0.6, 9, false).receiveShadow = true;
        box(g, 'box', pmat(0xb9a88c), 0, p.h * 0.42, 0, 5.4, p.h * 0.66, 5.0, true);
        box(g, 'cone4', pmat(0x4a5360, 'flat'), 0, p.h * 0.86, 0, 8.2, p.h * 0.42, 8.2, true)
          .rotation.y = Math.PI / 4;
        var si;
        for (si = -1; si <= 1; si += 2) {
          box(g, 'cyl', pmat(0x3f3a34), si * 3.4, 1.3, 4.6, 0.2, 2.6, 0.2, false);
          var sb = box(g, 'sph', pmat(0xffd489, 'glow'), si * 3.4, 2.8, 4.6, 0.7, 0.9, 0.7, false);
          sb.userData.lamp = true;
          sb.visible = !!(lightNow && lightNow.lamp > 0.2);
        }
      } else if (p.t === 'waterfall') {
        /* 폭포(PLAN 44절) — 절벽에 물줄기 판 하나, 밑에 튄 물이 고인 못.
           흐르는 결은 안 준다(정지 화면) — 세운 판에 물결 셰이더를 억지로
           씌우느니 정지 화면이 낫다 */
        box(g, 'box', pmat(0x5a5560, 'flat'), 0, p.h * 0.5, -2.4, 13, p.h, 6, true)
          .receiveShadow = true;
        box(g, 'box', pmat(0x9fd0e8, 'fall'), 0, p.h * 0.46, 0.3, 4.6, p.h * 0.86, 0.6, false);
        box(g, 'box', pmat(0x6fa8c4, 'water'), 0, 0.15, 3.4, 8, 0.3, 6.5, false);
      } else if (p.t === 'reed') {
        box(g, 'cone', pmat(0x6d7f4a, 'sway'), p.x, p.h * 0.5, p.z, 0.5, p.h, 0.5, false);
      } else if (p.t === 'lamp') {
        box(g, 'cyl', pmat(0x3f3a34), p.x, p.h * 0.5, p.z, 0.24, p.h, 0.24, false);
        /* 등롱의 불은 **밤에만** 켠다 — 낮에 켜 두면 흰 점으로만 보인다 */
        var bulb = box(g, 'sph', pmat(0xffd489, 'glow'), p.x, p.h + 0.25, p.z, 0.8, 1.0, 0.8, false);
        bulb.userData.lamp = true;
        /* 지금이 밤인지 여기서 곧바로 정한다 — 나중에 걸어 들어온 격자는
           `syncLamps` 가 이미 훑고 지나간 뒤라 낮에도 켜진 채 남는다 */
        bulb.visible = !!(lightNow && lightNow.lamp > 0.2);
      } else if (p.t === 'temple') {
        /* 옛 사원 — **GLB(`chengde_temple.glb`)를 못 받았을 때만** 여기 온다.
           2단 지붕집 하나로 "여느 사당보다 훨씬 크다"만 전한다 — 진짜 모양은
           GLB 몫이라 여기서 정교하게 흉내 내지 않는다 */
        box(g, 'box', pmat(0x6a6258, 'flat'), 0, 0.3, 0, 15, 0.6, 15, false).receiveShadow = true;
        box(g, 'box', pmat(0xb08a4a), 0, p.h * 0.28, 0, 10, p.h * 0.5, 9.4, true);
        box(g, 'cone4', pmat(0xc9a24a, 'flat'), 0, p.h * 0.58, 0, 12, p.h * 0.3, 12, true)
          .rotation.y = Math.PI / 4;
        box(g, 'box', pmat(0x8a5a34), 0, p.h * 0.76, 0, 6, p.h * 0.32, 5.6, true);
        box(g, 'cone4', pmat(0x9a2f2a, 'flat'), 0, p.h * 0.96, 0, 7.4, p.h * 0.22, 7.4, true)
          .rotation.y = Math.PI / 4;
      }
    }
    return g;
  }

  /* 사물 격자를 마지막으로 훑은 자리 — **격자를 넘어설 때만** 다시 훑는다.
     여태 매 프레임 11×11 칸을 다 재고 있었다. 한 걸음(8m/s)에 격자(48m)를 넘는 데
     6초가 걸리니, 그 사이 360번쯤은 같은 답을 다시 낸 셈이다 */
  var propScan = null;

  function syncProps(W) {
    var pos = core.save.player.pos;
    var R = PROP_R();
    /* 지도가 깔렸는지 — 깔린 자리와 안 깔린 자리(오프라인·타일 실패)에서
       세우는 것이 다르다. 캐시 키에도 넣어야 상태가 바뀔 때 다시 세운다 */
    var mapped = !!(W.tilesUsable && W.tilesUsable());
    var RG3 = global.DG.land;
    var wkNow = weatherKey();
    var wetNow = WET() && (wkNow === 'rain' || wkNow === 'snow');
    var seasonKey = global.DG.season ? global.DG.season.now().key : '-';
    /* **훑을 까닭이 있을 때만 훑는다.** 격자를 넘었거나 · 지도가 붙거나 떨어졌거나 ·
       비가 오거나 그쳤거나 · 품질이 바뀌었을 때. 그 밖에는 답이 지난 프레임과 같다 */
    var cell = Math.floor(pos.x / GRID) + ':' + Math.floor(pos.y / GRID) +
      ':' + Math.round(R) + ':' + (MESH_ON() ? 1 : 0) + ':' + Math.round(DENSITY() * 100) +
      ':' + (mapped ? 'm' : 'n') + ':' + (wetNow ? 'w' : 'd') +
      ':' + (RG3 && RG3.on() ? 'L' : '-') +
      ':' + seasonKey;
    if (propScan === cell) { return; }
    propScan = cell;
    var g0x = Math.floor((pos.x - R) / GRID), g1x = Math.floor((pos.x + R) / GRID);
    var g0y = Math.floor((pos.y - R) / GRID), g1y = Math.floor((pos.y + R) / GRID);
    var live = {};
    for (var gy = g0y; gy <= g1y; gy++) {
      for (var gx = g0x; gx <= g1x; gx++) {
        var kind = W.terrainAt(gx, gy);
        /* 손으로 그린 땅이 못박아 둔 것은 **찾아가는 표적**이다 — 멀다고 빼면
           폐허가 코앞에서야 솟는다. 표식이 있는 격자는 잔 사물 규칙에서 뺀다 */
        var mk = RG3 ? RG3.markAt(gx, gy) : null;
        if (!mk && global.DG.landform && global.DG.landform.markAt) { mk = global.DG.landform.markAt(gx, gy) ? 'lf' : null; }   // ⑰ 다리·폭포도 표적
        var tileDist = Math.hypot((gx + 0.5) * GRID - pos.x, (gy + 0.5) * GRID - pos.y);
        /* 풀·길의 잔 사물은 가까울 때만 세운다 — 반경 전체에 깔면 격자 백 개가
           한꺼번에 늘어나고, 멀리서는 어차피 한 픽셀이다 */
        var far = tileDist > R * 0.5;
        if (far && !mk && (kind === 'grass' || kind === 'road') &&
            !(RG3 && RG3.hasDeco && RG3.hasDeco(gx, gy))) { continue; }
        /* LOD(36절) 대(帶) — 이 칸이 나무·바위·풀을 세우는 종류(town 은 집·탑뿐이라
           뺀다)라면 문턱(LOD_NEAR) 안쪽인지를 키에 넣는다. 문턱을 건너면 칸이
           다시 지어지고, 그 안에서 `instProp` 이 진짜 모델과 도형을 맞바꾼다.
           안 넣으면 가까이 가도 이미 지은 칸은 도형인 채로 남는다(칸이 안
           다시 지어지므로) */
        var lodBand = kind !== 'town' ? (tileDist <= LOD_NEAR() ? 'n' : 'f') : '-';
        /* 이 땅을 켜고 끄면 같은 격자가 다른 땅이 된다 — 캐시 키에 넣어야 다시 세운다 */
        /* 젖음도 키에 넣는다 — 안 넣으면 비가 그쳐도 강이 분 채로 남는다.
           **계절도 마찬가지다** — 안 넣으면 가을이 됐는데 나무 몇 그루가 초록으로
           남는다(눈으로 보고 알았다). 훑는 조건에만 넣으면 다시 훑기는 하는데
           이미 세워 둔 격자를 그대로 되쓴다 */
        var key = kind + ':' + gx + ':' + gy + ':' + (mapped ? 'm' : 'n') +
          (mk ? ':' + mk : '') + (wetNow ? ':w' : '') + ':' + seasonKey + ':' + lodBand;
        live[key] = 1;
        if (propMeshes[key]) { continue; }
        var node = buildProp(kind, gx, gy, mapped, key);
        /* 격자 한가운데의 땅 높이에 앉힌다. 이 노드 안의 조각들은 제 자리
           (`p.x`·`p.z`)만큼 옆으로 벌어져 있어 그만큼은 어긋나지만, 격자가
           48m 라 한 칸 안에서는 땅이 거의 평평하다 — 눈에 안 띈다 */
        var pcx = gx * GRID + GRID / 2, pcz = gy * GRID + GRID / 2;
        node.position.set(pcx, groundY(pcx, pcz), pcz);
        propGroup.add(node);
        propMeshes[key] = node;
      }
    }
    /* 부수는 반경은 짓는 반경(R)보다 크다(PLAN 42절) — 경계에서 한 걸음
       왕복해도 짓고 부수고를 되풀이하지 않는다 */
    var UR = PROP_UR(R);
    for (var k in propMeshes) {
      if (!Object.prototype.hasOwnProperty.call(propMeshes, k) || live[k]) { continue; }
      /* 이번에 훑은 격자 범위(g0x~g1x, g0y~g1y) **안**인데도 살아 있지 않다면
         — 같은 자리의 내용(계절·젖음·지도 여부 등)이 바뀐 것이니 미룰 것 없이
         바로 갈아 짓는다. UR 히스테리시스는 **범위 밖으로 걸어 나간 것**에만
         쓴다 — 안 그러면 계절이 바뀌어도 헌 사물이 새 것과 겹친 채 남는다 */
      var kp = k.split(':');
      var kgx = +kp[1], kgy = +kp[2];
      if (!(kgx >= g0x && kgx <= g1x && kgy >= g0y && kgy <= g1y)) {
        var leftNode = propMeshes[k];
        var d = Math.hypot(leftNode.position.x - pos.x, leftNode.position.z - pos.y);
        if (d <= UR) { continue; }      // 아직 부수는 반경 안 — 그대로 둔다
      }
      /* 도형·재질은 **모두가 나눠 쓰는 것**이라 여기서 dispose 하지 않는다.
         하나를 버리면 남아 있는 다른 건물의 도형까지 같이 사라진다 */
      propGroup.remove(propMeshes[k]);
      delete propMeshes[k];
      if (kp[0] === 'town') { delete townDens[kp[1] + ':' + kp[2]]; }
      delete smokeByKey[k];           // 이 격자의 연기도 창고에서 함께 뺀다
      instDrop(k);                    // 빌려 준 인스턴스 자리도 돌려받는다
    }
  }

  /** 등롱은 밤에만 켠다 (낮에는 재질을 갈지 않고 눈에 안 띄게 꺼 둔다) */
  function syncLamps() {
    var on = lightNow ? lightNow.lamp > 0.2 : false;
    if (syncLamps.was === on) { return; }
    syncLamps.was = on;
    propGroup.traverse(function (o) {
      if (o.userData && o.userData.lamp) { o.visible = on; }
    });
  }

  /** 잎·풀 흔들림 시계를 굴린다(PLAN 44절) — 꺼져 있으면 마지막 자세로 멎는다.
   * 이 축도 실기기로 못 본 채 나갔던 것이라, `syncFlame`·`syncSmoke`와 같은
   * 이유로 어긋나면 스스로 꺼진다 */
  var swayBroken = false;
  function syncSway(dt) {
    if (!SWAY_ON() || !swayShaders.length || swayBroken) { return; }
    try {
      swayClock += dt;
      var amt = SWAY_AMT(), i;
      for (i = 0; i < swayShaders.length; i++) {
        swayShaders[i].uniforms.uSwTime.value = swayClock;
        swayShaders[i].uniforms.uSwAmt.value = amt;
      }
    } catch (err) {
      swayBroken = true;
      if (global.console) { console.error('[world3d] 잎·풀 흔들림에서 멎어 껐다', err); }
    }
  }

  /** 등롱·사당 불이 일렁인다(PLAN 44절 "불꽃") — 재질을 **모두가 나눠 쓰므로**
   * 한 번만 써도 뜬 등롱 전부가 같이 일렁인다(값싸다).
   * **한 번이라도 어긋나면 스스로 꺼진다** — 이 축은 아직 실기기로 못 본
   * 새 코드라, 여기서 예외가 나 렌더 루프 전체(`world3d.render`)를 끊으면
   * 이동·전투 무대까지 통째로 멎는다(그 아래 줄들이 아예 안 불린다). 장식
   * 하나가 게임 전체를 죽이는 것보다 그 장식만 조용히 빠지는 쪽이 낫다 */
  var flameClock = 0, smokeClock = 0, flameBroken = false, smokeBroken = false;
  function syncFlame(dt) {
    if (!FLAME_ON() || flameBroken) { return; }
    try {
      flameClock += dt;
      var m = pmat(0xffd489, 'glow');
      m.emissiveIntensity = 0.9 + FLAME_AMT() *
        (Math.sin(flameClock * 9.1) * 0.7 + Math.sin(flameClock * 23.7) * 0.3);
    } catch (err) {
      flameBroken = true;
      if (global.console) { console.error('[world3d] 불꽃 일렁임에서 멎어 껐다', err); }
    }
  }

  /** 연기 알갱이를 한 프레임 굴린다(PLAN 44절) — 위로 오르다 다 오르면
   * 다시 밑에서 시작한다(비 알갱이가 상자를 벗어나면 되돌리는 것과 같은 손).
   * **재질을 낱개로 복제해 뒀으니**(`addLampSmoke`) 알갱이마다 다른 짙기로
   * 옅어질 수 있다. 창고가 안 뜬 낮에는 굳이 돌리지 않는다. `syncFlame` 과
   * 같은 이유로 어긋나면 스스로 꺼진다 */
  function syncSmoke(dt) {
    if (!SMOKE_ON() || smokeBroken || !(lightNow && lightNow.lamp > 0.2)) { return; }
    try {
      smokeClock += dt;
      var RISE = 0.4, MAXH = 2.4, k;
      for (k in smokeByKey) {
        if (!Object.prototype.hasOwnProperty.call(smokeByKey, k)) { continue; }
        var list = smokeByKey[k], i;
        for (i = 0; i < list.length; i++) {
          var s = list[i], d = s.userData.smoke;
          var t = (smokeClock * RISE + d.ph) % MAXH;
          var frac = t / MAXH;
          s.position.set(d.x + Math.sin(smokeClock * 0.6 + d.ph) * 0.15, d.baseY + t, d.z);
          var sc = 0.35 + frac * 0.55;
          s.scale.set(sc, sc, sc);
          s.material.opacity = 0.34 * (1 - frac);
        }
      }
    } catch (err) {
      smokeBroken = true;
      if (global.console) { console.error('[world3d] 연기에서 멎어 껐다', err); }
    }
  }

  /* ── 배우 (사람 · 짐승 · 건물) ───────────────────────────
   * `actor3d.js` 가 도형으로 조립한 입체를 세운다. 조립이 안 되면(three 가 없거나
   * 손잡이를 껐으면) 1단계의 빌보드로 돌아간다 — 그림은 `sprite.js` 것을 그대로 쓴다.
   */
  function spriteTexture(kind, ref, px) {
    var key = kind + '/' + (ref.id || ref.key || ref.name) + '/' + px + '/flat';
    if (texCache[key]) { return texCache[key]; }
    /* 네 번째 인자가 **종이 바탕 없이** 굽게 한다 — 3D 에서는 배경이 사각형으로 남는다 */
    var url = global.DG.sprite.portrait(kind, ref, px, true);
    var img = new Image();
    var tex = new T.Texture(img);
    tex.colorSpace = T.SRGBColorSpace;
    img.onload = function () { tex.needsUpdate = true; };
    img.src = url;
    texCache[key] = tex;
    return tex;
  }

  var shadowGeo = null, shadowMat = null;
  function groundShadow() {
    if (!shadowGeo) {
      shadowGeo = new T.CircleGeometry(1, 18);
      shadowMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false });
    }
    var m = new T.Mesh(shadowGeo, shadowMat);
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  /** 배우 하나 — 있으면 쓰고 없으면 만든다 */
  /** 같은 자리(key)에 다른 사람이 서야 하면 옛 배우를 치운다 — actorOf 는 key 로만 캐시한다 */
  function dropActorIfNot(key, who) {
    var a = actors[key];
    if (!a || a.who === undefined || a.who === who) { return; }
    actorGroup.remove(a.node);
    actorGroup.remove(a.shadow);
    delete actors[key];
  }

  function actorOf(key, kind, ref, px) {
    var a = actors[key];
    if (a) { a.seen = frame; return a; }
    var A = global.DG.actor3d;
    var node = null, mesh = false;
    if (MESH_ON() && A && A.ready()) {
      node = A.build(kind === 'building' ? (ref.key === 'wall' ? 'fort' : (ref.key === 'landmark' ? 'landmark' : 'station')) : kind, ref);
      mesh = !!node;
    }
    if (!node) {
      var mat = new T.SpriteMaterial({ map: spriteTexture(kind, ref, px), transparent: true });
      node = new T.Sprite(mat);
    }
    var sh = groundShadow();
    actorGroup.add(node); actorGroup.add(sh);
    a = actors[key] = {
      node: node, shadow: sh, seen: frame, mesh: mesh, kind: kind,
      /* 처음에는 카메라를 등지고 선다(북쪽). 마주 보고 서 있으면 지도 위의 내가
         나를 쳐다보는 꼴이 된다 — 원작은 늘 아바타의 뒤통수를 본다 */
      ang: Math.PI, lx: null, ly: null, vanish: 0
    };
    return a;
  }

  /**
   * 배우를 자리에 놓는다.
   *   h     키(m)
   *   bob   위아래 흔들림(빌보드용 — 메시는 자기 다리로 걷는다)
   *   walk  걷는 중인가
   */
  /**
   * 멀리 있는 배우는 **원근 그대로 두면 점**이다. 이 판의 야생 대상은 70~320m 밖에
   * 서므로(원작은 코앞에 나온다) 줌을 빼도 안 보인다. 거리에 따라 조금씩 키워
   * 지도 위의 표식처럼 남게 한다 — 크기는 화면 값이라 판정에 안 닿는다.
   */
  function farBoost(x, y) {
    if (!camPos) { return 1; }
    var d = Math.hypot(x - camPos.x, y - camPos.z);
    if (d < FAR_NEAR) { return 1; }
    /* 지수가 1 이면 **화면에서 같은 크기**로 유지된다(원근을 완전히 무른다).
       0.85 는 거의 유지하되 멀수록 아주 조금 작아 보이게 남긴 값이다 —
       완전히 무르면 3D 공간의 깊이가 사라진다 */
    return Math.min(FAR_MAX, Math.pow(d / FAR_NEAR, 0.85));
  }

  function placeActor(a, x, y, h, bob, walk, phase, now) {
    /* **땅에 앉힌다.** 땅이 굽었으므로 y=0 에 세우면 산에서는 발이 묻히고
       골짜기에서는 허공에 뜬다(PLAN 14절) */
    var gy0 = groundY(x, y) + skyLift(x, y, a.sky);        // ⑲-20 섬 층이면 섬 윗면
    if (a.mesh) {
      a.node.scale.set(h, h, h);
      a.node.position.set(x, gy0, y);
      /* 방향 — 지난 프레임과의 차이로 정한다. 판정에는 방향이 없으니
         (world.js 는 좌표만 준다) 화면 층에서 만들어 쓴다 */
      if (a.lx !== null) {
        var dx = x - a.lx, dz = y - a.ly;
        if (dx * dx + dz * dz > 0.0004) {
          var want = Math.atan2(dx, dz);
          var diff = want - a.ang;
          while (diff > Math.PI) { diff -= Math.PI * 2; }
          while (diff < -Math.PI) { diff += Math.PI * 2; }
          a.ang += diff * 0.22;                 // 홱 돌지 않고 미끄러지듯 돈다
        }
      }
      a.lx = x; a.ly = y;
      a.node.rotation.y = a.ang;
      /* 교전 몸짓(`playAnim`) 이 걸려 있으면 그 자리 이름을 준다 — 끝나면
         (`animUntil` 지나면) 도로 걷기/서기로 돌아간다. 클립이 없으면
         `asset3d.play` 가 조용히 실패하니 여기서 따로 안 가른다 */
      var animNow = (a.animUntil && now < a.animUntil) ? a.animName : undefined;
      global.DG.actor3d.step(a.node, { t: now / 1000, walking: walk, phase: phase, anim: animNow });
    } else {
      a.node.scale.set(h, h, 1);
      a.node.position.set(x, gy0 + h / 2 + (bob || 0), y);
    }
    a.shadow.position.set(x, gy0 + 0.06, y);
    a.shadow.scale.setScalar(h * 0.30);
  }

  /** 목표점을 향해 매 프레임 조금씩 다가간다 — 배우 객체(`a`)에 `fx`/`fy` 로
   *  마지막 자리를 적어 둬 다음 프레임도 이어 쓴다. 순간이동이 아니라
   *  **뒤에서 따라오는** 느낌을 내는 전부다(레이스 게임의 카메라 lerp와 같다) */
  function followPos(a, tx, ty, rate) {
    if (a.fx === undefined) { a.fx = tx; a.fy = ty; }
    a.fx += (tx - a.fx) * rate;
    a.fy += (ty - a.fy) * rate;
    return { x: a.fx, y: a.fy };
  }

  /**
   * 동행(부대 2번째 인물)·펫(선두가 장착한 것) — **실제로 곁에서 따라다닌다**
   * (2026-09-06, "펫도 따라다니고 등용한 인물도 따라 다니고" 요청). 전투력은
   * 이미 `hero.partyPower()`(hero.js)가 부대 전체를 합산해 판정에 넣고 있으니
   * 여기서 새로 더할 것이 없다 — 이 함수는 순전히 화면 층이다.
   *
   *   탐험 중  플레이어 뒤쪽으로 처져서 트레일링(동행·펫이 서로 다른 자리)
   *   교전 중  플레이어 옆에 나란히 서서 같이 상대를 본다(`duelFoe` 기준
   *            좌우로 갈라선다 — 축을 `meAng` 대신 "나→적" 벡터로 잡아야
   *            내가 예고를 피하려고 옆으로 물러나도 대형이 안 흐트러진다)
   */
  function syncBuddies(pos, meAng, h, now) {
    var party = core.save.party || [];
    var FCb = global.DG.fieldCombat, fcLead = FCb && FCb.leadId();
    var allyId = fcLead && fcLead === party[1] ? party[0] : party[1];
    var petEquip = core.save.petEquip || {};
    var petId = party[0] ? petEquip[party[0]] : null;
    if (!allyId && !petId) { return; }

    var backX = -Math.sin(meAng), backY = -Math.cos(meAng);
    var sideX = Math.cos(meAng), sideY = -Math.sin(meAng);
    if (duelFoe) {
      var fdx = duelFoe.x - pos.x, fdy = duelFoe.y - pos.y;
      var flen = Math.hypot(fdx, fdy) || 1;
      sideX = -fdy / flen; sideY = fdx / flen;   // 나→적 축에 수직
    }

    if (allyId) {
      var allyRef = global.DG.data.find(allyId);
      if (allyRef) {
        dropActorIfNot('ally', allyRef.id);
        var aa = actorOf('ally', 'hero', allyRef, 96);
        aa.who = allyRef.id; aa.sky = meSky();
        var atx = duelFoe ? pos.x + sideX * 1.5 : pos.x + backX * 2.2 + sideX * 0.9;
        var aty = duelFoe ? pos.y + sideY * 1.5 : pos.y + backY * 2.2 + sideY * 0.9;
        var af = followPos(aa, atx, aty, duelFoe ? 0.12 : 0.06);
        var amoved = aa.lx === null || Math.hypot(af.x - aa.lx, af.y - aa.ly) > 0.01;
        placeActor(aa, af.x, af.y, h * farBoost(af.x, af.y), 0, amoved, now / 480, now);
        if (duelFoe && aa.mesh) {
          var aax = duelFoe.x - af.x, aaz = duelFoe.y - af.y;
          aa.node.rotation.y = Math.atan2(aax, aaz);
          aa.ang = aa.node.rotation.y;
        }
      }
    }

    if (petId) {
      var petRef = global.DG.data.find(petId);
      if (petRef) {
        var pa = actorOf('petbuddy', 'pet', petRef, 96);
        pa.sky = meSky();
        var ptx = duelFoe ? pos.x - sideX * 1.5 : pos.x + backX * 1.4 - sideX * 0.8;
        var pty = duelFoe ? pos.y - sideY * 1.5 : pos.y + backY * 1.4 - sideY * 0.8;
        var pf = followPos(pa, ptx, pty, duelFoe ? 0.12 : 0.08);
        var pmoved = pa.lx === null || Math.hypot(pf.x - pa.lx, pf.y - pa.ly) > 0.01;
        placeActor(pa, pf.x, pf.y, h * 0.6 * farBoost(pf.x, pf.y), 0, pmoved, now / 380, now);
        if (duelFoe && pa.mesh) {
          var ppx = duelFoe.x - pf.x, ppz = duelFoe.y - pf.y;
          pa.node.rotation.y = Math.atan2(ppx, ppz);
          pa.ang = pa.node.rotation.y;
        }
      }
    }
  }

  /** 사라지는 배우 — 잡혔거나 달아났다. 빛으로 흩어지며 지워진다 */
  function sweepActors(dt) {
    for (var k in actors) {
      if (!Object.prototype.hasOwnProperty.call(actors, k)) { continue; }
      var a = actors[k];
      if (a.seen === frame) { continue; }
      /* 무대에 선 상대는 판정에서 이미 사라졌더라도(잡혔다·달아났다) 무대가 닫힐
         때까지 그 자리에 세워 둔다 — 던진 것이 날아가는 중에 상대가 먼저 없어지면
         허공에 사료를 던지는 그림이 된다 */
      if (stageAt && k === 'sp' + stageAt.uid) { a.seen = frame; continue; }
      /* 곧바로 지우면 잡은 순간 상대가 **점멸하듯** 없어진다. 원작은 잡히는 순간을
         보여 준다 — 여기서는 떠오르며 작아지는 0.7초를 둔다 */
      a.vanish += dt;
      var t = Math.min(1, a.vanish / 0.7);
      a.node.position.y += dt * 2.4;
      a.node.scale.multiplyScalar(1 - dt * 1.1);
      a.shadow.scale.multiplyScalar(1 - dt * 2.2);
      if (t >= 1) {
        actorGroup.remove(a.node);
        actorGroup.remove(a.shadow);
        delete actors[k];
      }
    }
  }

  /* ── 지도 위 동행 모션 — 교체 연출(PLAN §5 ⑭) ─────────────────────────
   * 들판 전투에서 교체하면(`fieldCombat.leadId()` 가 바뀌면) 예전엔 옛 몸을 지우고 새 몸이
   * 그 자리에 뚝 섰다. 이제 옛 몸은 지우지 않고 'swapout' 으로 옮겨 옆뒤로 물러나게 한 뒤
   * (`sweepActors` 의 떠오르며 흩어지기로) 사라지고, 새 몸은 곁(옆 1.6m)에서 걸어 나와
   * 제자리에 선다. 판정·카메라는 그대로 `pos` — 화면 층만 움직인다 */
  var SWAP_IN_MS = 350, SWAP_OUT_MS = 600, SWAP_LIFE_MS = 900, SWAP_SIDE = 1.6, SWAP_BACK = 2.4;
  /** 순수 함수 — 교체 뒤 ms 에 새 몸이 옆으로 남은 거리·옛 몸이 물러난 거리 */
  function swapMotion(ms) {
    var i = Math.max(0, Math.min(1, ms / SWAP_IN_MS)), o = Math.max(0, Math.min(1, ms / SWAP_OUT_MS));
    function ease(k) { return 1 - (1 - k) * (1 - k); }
    return { inSide: SWAP_SIDE * (1 - ease(i)), outBack: SWAP_BACK * ease(o), done: ms >= SWAP_LIFE_MS };
  }
  var lastLead = null, swapFx = null;

  /**
   * 활공 날개(§5 ⑰ 다음) — 저장소에 CC0 날개 에셋이 없어 **코드로** 짓는다(SAGA-DESIGN §7 허용):
   * 머리 위 천 두 장이 V 자로 벌어진 모양, 한 번 지어 두고 켜고 끈다. 판정에는 안 닿는다
   */
  var gliderMesh = null;
  function gliderOf() {
    if (gliderMesh) { return gliderMesh; }
    var g = new T.BufferGeometry();
    /* 가운데 막대(0,0,±0.3)에서 좌우 끝(±1.6)으로, 끝이 조금 올라가고 뒤로 처진다 */
    var v = new Float32Array([
      0, 0, 0.35, -1.6, 0.35, -0.25, 0, 0, -0.45,
      0, 0, 0.35, 0, 0, -0.45, 1.6, 0.35, -0.25
    ]);
    g.setAttribute('position', new T.BufferAttribute(v, 3));
    g.computeVertexNormals();
    var m = new T.MeshLambertMaterial({ color: 0xe8dcc0, side: T.DoubleSide });
    gliderMesh = new T.Mesh(g, m);
    gliderMesh.visible = false;
    actorGroup.add(gliderMesh);
    return gliderMesh;
  }
  function syncGlider(meA, on, x, y, air, h) {
    if (!on && !gliderMesh) { return; }
    var gm = gliderOf();
    gm.visible = !!on && air > 0.05;
    if (!gm.visible) { return; }
    var s = Math.max(1, h / 1.7);
    gm.scale.set(s, s, s);
    gm.position.set(x, standY(x, y) + air + h * 1.12, y);
    gm.rotation.y = meA.ang || 0;
  }

  function syncActors(W, now) {
    var pos = core.save.player.pos;

    /* 나 — 동행 선두가 지도 위 내 모습이다(2D 화면과 같은 규칙) */
    /* 들판 전투(§5 ⑨)에서 교체하면 지도 위 내 모습도 그 사람으로 바뀐다 */
    var FCd = global.DG.fieldCombat;
    var lead = (FCd && FCd.leadId()) || (core.save.party && core.save.party[0]);
    var me = lead ? global.DG.data.find(lead) : null;
    var meRef = me || { id: '_me', name: '나', faction: '조선', rarity: 3, trait: 'virtue' };
    if (lastLead !== null && meRef.id !== lastLead && actors.me && actors.me.who === lastLead) {
      if (actors.swapout) { actorGroup.remove(actors.swapout.node); actorGroup.remove(actors.swapout.shadow); }
      actors.swapout = actors.me;                       // 옛 몸을 지우지 않고 넘긴다 — 다시 안 짓는다
      delete actors.me;
      swapFx = { t0: now, ang: actors.swapout.ang || 0, x: pos.x, y: pos.y };
    }
    lastLead = meRef.id;
    dropActorIfNot('me', meRef.id);
    var meA = actorOf('me', 'hero', meRef, 96);
    meA.who = meRef.id;
    var mot = W.motion;
    var h = ACTOR_H();
    var walking = mot.speed > 1.5;
    var MTr = global.DG.mount, mtRef = MTr && MTr.petRef ? MTr.petRef() : null;   // ⑲-61 탄 말 — 몸은 말이 걷고 나는 위에 앉는다
    var walkBob = walking
      ? Math.abs(Math.sin(mot.phase)) * h * 0.045
      : Math.sin(now / 700) * h * 0.016;
    /* 나에게도 같은 보정을 준다 — 안 그러면 크게 당겼을 때 **나만 점**이 되고
       야생 대상이 나보다 크게 보인다 */
    var mx = pos.x, my = pos.y;
    if (swapFx) {
      var sm = swapMotion(now - swapFx.t0);
      var sx = Math.cos(swapFx.ang), sy = -Math.sin(swapFx.ang), bx = -Math.sin(swapFx.ang), by = -Math.cos(swapFx.ang);
      mx += sx * sm.inSide; my += sy * sm.inSide;
      var so = actors.swapout;
      if (so && !sm.done) {
        so.seen = frame; so.sky = meSky();
        var ox = swapFx.x + bx * sm.outBack - sx * sm.outBack * 0.35, oy = swapFx.y + by * sm.outBack - sy * sm.outBack * 0.35;
        placeActor(so, ox, oy, h * farBoost(ox, oy), 0, sm.outBack < SWAP_BACK - 1e-3, now / 480, now);
      }
      if (sm.done) { swapFx = null; }             // 이제 swapout 은 안 먹여져 sweepActors 가 흩어 지운다
      walking = walking || sm.inSide > 0.05;
    }
    /* §5 ⑰ 점프 — 뛰어오른 높이만큼 몸을 띄우고 jump 몸짓(없으면 asset3d 가 idle 로 물러난다) */
    var LFa = global.DG.landform, air = LFa ? LFa.airH() : 0;
    if (air > 0) { meA.animName = 'jump'; meA.animUntil = now + 120; }
    meA.sky = meSky();
    placeActor(meA, mx, my, h * farBoost(mx, my), walkBob + air, walking && !air && !mtRef, mot.phase, now);
    if (air > 0 && meA.mesh) { meA.node.position.y += air; }
    if (mtRef) {                                                                     // ⑲-61 말 — 같은 자리·같은 걸음, 나는 등 높이로
      var mtA = actorOf('mount:' + (mtRef.id || ''), 'pet', mtRef, 96);   // W-0119 — 탈것마다 따로(키 하나면 탄 채 바꿔도 첫 몸이 그대로였다)
      mtA.sky = meSky();
      var mtAlt = MTr.altitude ? MTr.altitude() : 0, fl = mtAlt >= MTr.AIR_MIN;
      placeActor(mtA, mx, my, h * farBoost(mx, my) * MTr.SCALE, 0, (walking || fl) && !air, mot.phase, now);
      if (fl && mtA.mesh) { mtA.node.position.y += mtAlt + Math.sin(now / 260) * 0.25; }   // ⑲-62 뜬 높이 — 날갯짓에 맞춰 살짝 출렁
      if (meA.mesh) { meA.node.position.y += h * farBoost(mx, my) * MTr.RIDER_LIFT + (fl ? mtAlt + Math.sin(now / 260) * 0.25 : 0); }
    }
    /* ⑰ 여울 다리 — 상판 위면 몸을 상판 높이에 세운다(땅은 물 바닥이라 안 올리면 다리 밑을 걷는다) */
    var deck = LFa && LFa.deckAt ? LFa.deckAt(mx, my) : null;
    if (deck !== null && meA.mesh && !air) {
      var gyMe = groundY(mx, my);
      if (deck > gyMe) { meA.node.position.y += deck - gyMe; }
    }
    syncGlider(meA, LFa && LFa.gliding && LFa.gliding(), mx, my, air, h);
    /* ⑲-22 조준 중엔 몸이 겨눈 쪽을 본다 */
    var FCme = global.DG.fieldCombat, AVme = FCme && FCme.aimView ? FCme.aimView() : null;
    if (AVme && meA.mesh) { meA.ang = Math.atan2(AVme.dx, AVme.dy); meA.node.rotation.y = meA.ang; }
    /* ⑲-13 대화 — 나는 대화 상대를 돌아보고, 내 줄(고른 대답)이면 손짓·입. 깜박임은 늘(talkface.js) */
    var TSm = talkShot(), TFm = global.DG.talkface;
    var tdt = talkNow ? Math.min(0.1, Math.max(0, (now - talkNow) / 1000)) : 0;
    talkNow = now;
    if (TSm && meA.mesh) {
      var npq = TSm.who === 'me' ? TSm.lst : TSm.spk;
      var mdd = Math.atan2(npq.x - mx, npq.y - my) - meA.ang;
      meA.ang += Math.atan2(Math.sin(mdd), Math.cos(mdd)) * 0.18;
      meA.node.rotation.y = meA.ang;
    }
    if (TFm && meA.mesh) {
      var meTalk = !!(TSm && TSm.who === 'me');
      TFm.pose(T, meA.node, { speaking: meTalk && TSm.speaking, vowel: meTalk ? TSm.vowel : null, open: meTalk ? TSm.open : 0,
        emo: null, t: now / 1000, dt: tdt, seed: 7 });
    }

    /* 교전 상대(`duelStage()` 로 세운 임시 배우) — `spawns` 에 없으니 여기서
       직접 먹인다. 코앞이라 `farBoost` 는 안 준다(늘 가까이서 마주 선다) */
    if (duelFoe) {
      var dfa = actorOf('duelfoe', duelFoe.kind, duelFoe.ref, 96);
      placeActor(dfa, duelFoe.x, duelFoe.y, h * (duelFoe.kind === 'pet' ? 0.86 : 1), 0, false, 0, now);
      /* 상대는 **나를 마주 본다.** 걷지 않으니 `placeActor` 의 진행-방향 회전으로는
         절대 안 돌아간다 — 새로 세운 순간의 기본값(뒤짐, PLAN 49절)이 그대로
         남아 계속 등을 보이게 된다. 야생 대상의 무대 회전(위 `onStage`)과 같은 계산 */
      if (dfa.mesh) {
        var fax = pos.x - duelFoe.x, faz = pos.y - duelFoe.y;
        dfa.node.rotation.y = Math.atan2(fax, faz);
        dfa.ang = dfa.node.rotation.y;
      }
      /* **나도 상대를 본다.** `placeActor(meA,...)` 는 이동 방향으로만 도는데,
         실시간 교전(rogue-action.js) 은 사거리 안에 서서 자동으로 때리는 게
         기본이라 — 가만히 선 채 마지막으로 걸어온 방향을 계속 보고 있으면
         적을 등지거나 옆으로 보고 때리는 것처럼 보인다(2026-09-06, 실기기
         확인 중 "어딜 보고 때림?" 로 지적됨). 위 `placeActor` 가 정한 회전을
         여기서 덮어써 늘 상대 쪽을 보게 한다 */
      if (meA.mesh) {
        var max = duelFoe.x - pos.x, maz = duelFoe.y - pos.y;
        if (max * max + maz * maz > 0.01) {
          meA.node.rotation.y = Math.atan2(max, maz);
          meA.ang = meA.node.rotation.y;
        }
      }
    }

    syncBuddies(pos, meA.ang, h, now);

    /* 야생 대상 */
    var sp = W.spawns, i;
    var FCs = global.DG.fieldCombat, duelUid = FCs && FCs.duelSpawn ? FCs.duelSpawn() : null;
    for (i = 0; i < sp.length; i++) {
      var s = sp[i];
      if (duelUid !== null && s.uid === duelUid) { continue; }   // ⑯ 겨루는 동안엔 들판 전투 몸(fc)이 대신 선다
      var kind = s.kind === 'hero' ? 'hero' : 'pet';
      var a = actorOf('sp' + s.uid, kind, s.ref, 96);
      var bob = s.moving
        ? Math.abs(Math.sin(s.phase)) * h * 0.04
        : Math.sin(now / 620 + s.uid) * h * 0.02;
      var onStage = stageAt && stageAt.uid === s.uid;
      var boost = onStage ? 1 : farBoost(s.x, s.y);
      placeActor(a, s.x, s.y, h * (kind === 'hero' ? 1 : 0.86) * boost,
        onStage ? 0 : bob, onStage ? false : !!s.moving, s.phase || 0, now);
      if (onStage) {
        /* 무대 소품(조준 고리)이 상대의 크기에 맞게 서도록 키를 적어 둔다 —
           뿔낙지와 여포에 같은 크기의 고리를 씌우면 하나는 묻히고 하나는 넘친다 */
        stageAt.h = h * (kind === 'hero' ? 1 : 0.86);
        /* **자리도 따라간다.** 조우 중에도 판정 층의 배회는 그대로 돌아서(world.js),
           열 때의 좌표에 카메라를 붙박아 두면 상대가 걸어 나가고 빈 땅만 남는다 */
        stageAt.x = s.x;
        stageAt.y = s.y;
      }
      if (onStage && a.mesh) {
        /* 무대에 선 상대는 **나를 본다.** 등을 돌린 채 설득당하거나 잡히면
           누구를 만나는지가 화면에서 사라진다 */
        var ax = camera.position.x - s.x, az = camera.position.z - s.y;
        a.node.rotation.y = Math.atan2(ax, az);
        a.ang = a.node.rotation.y;
        a.node.position.y = stageAt.lift || 0;
        /* 무대 위의 물러섬·다가섬은 **뒤로 가는 것**이지 뜨는 것이 아니다.
           위로만 띄웠더니 놓친 상대가 공중에 뜬 것처럼 보였다.
           그림자도 같이 옮긴다 — 안 옮기면 발과 그림자가 따로 논다 */
        if (stageAt.back) {
          var bl = Math.max(0.5, Math.hypot(ax, az));
          var ox = -ax / bl * stageAt.back, oz = -az / bl * stageAt.back;
          a.node.position.x = s.x + ox;
          a.node.position.z = s.y + oz;
          a.shadow.position.x = s.x + ox;
          a.shadow.position.z = s.y + oz;
        }
      }
    }

    /* 주민 — 이 땅에 사는 열 사람(`npc.js`). 스폰과 달리 **잡히지 않는 사람들**이라
       발밑 등급 고리를 안 두르고, 조우 무대에도 오르지 않는다 */
    var NP = global.DG.npc;
    var people = NP ? NP.live(pos, now) : [];
    for (i = 0; i < people.length; i++) {
      var n = people[i];
      var na = actorOf('np' + n.p.id, 'hero', n.p, 96);
      var nbob = n.walking
        ? Math.abs(Math.sin(n.phase)) * h * 0.04
        : Math.sin(now / 700 + i) * h * 0.014;
      placeActor(na, n.x, n.y, h * 0.94 * farBoost(n.x, n.y), nbob, n.walking, n.phase, now);
    }
    /* ⑱ 땅 사람 — 탑 둘레 과거·현대·미래 셋(`folk.js`). 주민처럼 잡히지 않는다. 서 있을 땐 탑을 본다 */
    var FK = global.DG.folk, TSf = TSm, TFf = TFm;
    var folks = FK ? FK.live(pos, now) : [];
    if (global.DG.story) { folks = folks.concat(global.DG.story.live(pos, now)); }   // ⑲-12 이야기 인물 셋
    for (i = 0; i < folks.length; i++) {
      var fk = folks[i];
      /* ⑲-21 배달 기계처럼 pet 이면 사람 몸 대신 들판 적 몸(pet:fc_<pet>) */
      var fka = fk.p.pet ? actorOf('fk' + fk.p.id, 'pet', { id: 'fc_' + fk.p.pet, name: fk.p.name, kind: 'beast', rarity: 2, form: 'boar' }, 96)
        : actorOf('fk' + fk.p.id, 'hero', fk.p, 96);
      fka.sky = !!fk.sky;                                   // ⑲-20 구름섬에 선 이야기 인물
      placeActor(fka, fk.x, fk.y, h * 0.94 * farBoost(fk.x, fk.y), fk.walking ? 0 : Math.sin(now / 700 + i) * h * 0.014, fk.walking, fk.phase, now);
      if (!fk.walking && fka.mesh) {
        var fkd = Math.PI / 2 - fk.ang - fka.ang;          // placeActor 규약(atan2(dx,dz))으로 탑 쪽 — 미끄러지듯 돈다
        fkd = Math.atan2(Math.sin(fkd), Math.cos(fkd));
        fka.ang += fkd * 0.08; fka.node.rotation.y = fka.ang;
      }
      /* ⑲-13 이야기 인물 — 말하는 동안 손짓·끄덕임(QRPG 라 입은 없다), 나그네는 흰 가면 */
      if (fk.p.story && !fk.p.pet && fka.mesh && TFf) {
        if (fk.p.mask) { TFf.mask(T, fka.node, typeof fk.p.mask === 'string' ? fk.p.mask : 'white'); }   // ⑲-19 해솔은 금 간 가면
        var fkTalk = !!(TSf && TSf.who === fk.p.story);
        TFf.pose(T, fka.node, { speaking: fkTalk && TSf.speaking, vowel: fkTalk ? TSf.vowel : null, open: fkTalk ? TSf.open : 0,
          emo: fkTalk ? TSf.emo : null, t: now / 1000, dt: tdt, seed: i + 3 });
      }
    }

    /* 짐승 — 들·강의 다섯 종(`animal.js`). 잡는 대상이 아니라 **거기 사는 것**이라
       등급 고리도 이름표도 없다. 새는 뜨고 물고기는 잠기므로 세운 뒤 높이를 준다 */
    var AN = global.DG.animal;
    var beasts = AN ? AN.live(pos, now) : [];
    for (i = 0; i < beasts.length; i++) {
      var bt = beasts[i];
      var ba = actorOf('an' + bt.m.id, 'pet', AN.refOf(bt.kind), 96);
      var bh = h * bt.kind.h * farBoost(bt.x, bt.y);
      placeActor(ba, bt.x, bt.y, bh, 0, bt.moving, bt.phase, now);
      if (bt.lift) {
        /* 날아오른 새는 **그림자가 작아지고 흐려진다** — 높이만 주면 지면에 붙어
           보인다(발밑 그림자가 그대로면 눈이 높이를 못 읽는다) */
        ba.node.position.y = bt.lift;
        ba.shadow.scale.setScalar(bh * 0.30 * Math.max(0.25, 1 - bt.lift / 12));
      }
      if (bt.kind.act !== null && bt.alarm > 0.05) {
        /* 놀랐거나 쫓는 짐승은 그쪽을 본다 — 옆을 보고 도망치면 도망으로 안 보인다 */
        ba.node.rotation.y = bt.ang;
        ba.ang = bt.ang;
      }
    }

    /* 들판 적 무리(`field-combat.js`, §5 ⑨) — 쓰러지면 1초 동안 가라앉으며 줄어든다 */
    var FC = global.DG.fieldCombat;
    var fcs = FC ? FC.live() : [];
    for (i = 0; i < fcs.length; i++) {
      var fo = fcs[i];
      var foa = actorOf('fc' + fo.uid, fo.hero ? 'hero' : 'pet', fo.ref, 96);
      foa.sky = !!fo.sky;                                   // ⑲-20 구름섬 무리
      /* ⑯ 굴복한 인물은 사라지지 않고 무릎 꿇는다(키를 낮춘다) */
      var foh = h * fo.h * (fo.dead ? Math.max(0.05, 1 - fo.deadT) : (fo.yielded ? 0.72 : 1));
      placeActor(foa, fo.x, fo.y, foh, 0, fo.moving && !fo.dead, fo.phase, now);
      if (foa.mesh) { foa.node.rotation.z = fo.stun ? Math.sin(now / 90) * 0.12 : 0; }
      if (fo.mask && foa.mesh && TFf) { TFf.mask(T, foa.node, fo.mask); }   // ⑲-14 이야기 보스 검은 가면
    }

    /* 역참 · 성채 */
    var sts = W.stationsNear ? W.stationsNear() : [];
    for (i = 0; i < sts.length; i++) {
      var st = sts[i];
      /* sprite.building 의 form 이름을 그대로 쓴다 — 빌보드로 돌아갔을 때
         2D 화면과 같은 그림이어야 한다 */
      var sa = actorOf('st' + st.key, 'building',
        { key: 'stable', id: 'st_' + st.key, color: '#e8c15a' }, 128);
      placeActor(sa, st.x, st.y, h * 1.7 * farBoost(st.x, st.y), 0, false, 0, now);
    }
    /* 지역 랜드마크(biome.js, §5 ⑩) — 1.35km 안이면 선다(빛기둥은 biome.js 가 얹는다) */
    var BMw = global.DG.biome;
    var lms = BMw && BMw.on() ? BMw.landmarks(pos.x, pos.y, 1350) : [];
    for (i = 0; i < lms.length; i++) {
      var lm = lms[i];
      var la = actorOf('lm' + lm.key, 'building',
        { key: 'landmark', id: 'lm_' + lm.key, biome: lm.biome, color: BMw.BIOMES[lm.biome].color }, 128);
      placeActor(la, lm.x, lm.y, h * 2.4 * farBoost(lm.x, lm.y), 0, false, 0, now);
    }
    var fts = W.fortsNear ? W.fortsNear() : [];
    for (i = 0; i < fts.length; i++) {
      var ft = fts[i];
      var fs = fortStyle(ft);
      var fa = actorOf('ft' + ft.key, 'building',
        { key: 'wall', id: 'ft_' + ft.key, color: ft.color || fs.color, tier: fs.tier }, 128);
      placeActor(fa, ft.x, ft.y, h * 2.4 * farBoost(ft.x, ft.y), 0, false, 0, now);
    }
  }

  /**
   * 성채의 **겉모습** — 등급과 지키는 세력의 빛깔.
   *
   * 여태 성채는 화면에서 다 같았다(늘 보라색 배너에 같은 크기). 등급 셋(보·진·웅진)도
   * 세력도 판정 층은 알고 있는데 화면이 안 물어봤을 뿐이다. 물어보고 나면
   * **걸어가기 전에 멀리서 세기와 임자를 가늠**할 수 있다.
   *
   * **키로 캐시한다.** `factionNameOf` 는 도감 일흔을 훑으므로 프레임마다 부르면
   * 안 된다. 같은 성채의 등급·세력은 늘 같으니(해시로 정해진다) 캐시가 맞다 —
   * 점령 여부만 바뀌는데 그것은 여기서 안 쓴다.
   */
  var fortStyleCache = {};
  function fortStyle(ft) {
    if (fortStyleCache[ft.key]) { return fortStyleCache[ft.key]; }
    var F = global.DG.fort, D = global.DG.data;
    var o = { tier: 2, color: '#8a5cc0' };
    try {
      if (F && F.tierOf) {
        o.tier = F.tierOf(ft).tier;
        var fc = D && D.faction ? D.faction(F.factionNameOf(ft)) : null;
        if (fc && fc.color) { o.color = fc.color; }
      }
    } catch (e) { /* 판정 층이 아직 없으면 옛 빛깔 그대로 — 화면은 안 빈다 */ }
    fortStyleCache[ft.key] = o;
    return o;
  }

  /* ── 조우 연출 ────────────────────────────────────────────
   * 원작에서 대상을 누르면 화면이 그쪽으로 넘어간다. 여기서는 조우 창이 HTML 이라
   * 3D 는 **뒤에서 카메라를 돌려** 그 순간을 만든다. 잡히면 빛기둥이 선다.
   * 창이 열렸는지는 DOM 을 보고 안다 — `encounter.js` 를 고치지 않으려는 것이다.
   */
  /* ── 전투 연출 (PLAN 23절) ────────────────────────────
   * 소품은 `battle3d.js` 가 만든다. 여기 있는 것은 **카메라가 하는 일**뿐이다 —
   * 줌인 · 흔들림 · 잠깐 멎기(hit-stop). 셋 다 화면에만 쓴다.
   */
  var yaw = 0;             // 돌려 본 각(라디안) — 드래그로 바꾼다
  var talkNow = 0;         // ⑲-13 대화 몸짓 — 지난 프레임 시각(ms)
  /** ⑲-13 이야기 대화 중이면 연출 값(story.talkShot) — 카메라·몸짓이 읽는다 */
  function talkShot() { var S = global.DG.story; return S && S.talkShot && global.DG.talkface ? S.talkShot() : null; }
  /** ⑲-22 조준 구도(순수) — 오른 어깨 너머(뒤 2.6m·옆 0.7m·몸 키 1.25배 높이), 앞 14m 를 본다. av = {dx, dy} 겨눈 쪽 */
  function aimCam(p, av, h) {
    var fx = av.dx, fz = av.dy, rx = -fz, rz = fx;                  // 앞 (fx, fz) 을 볼 때 화면 오른쪽
    return { pos: { x: p.x - fx * 2.6 + rx * 0.7, y: h * 1.25, z: p.y - fz * 2.6 + rz * 0.7 },
      look: { x: p.x + fx * 14, y: h * 0.85, z: p.y + fz * 14 } };
  }
  var battleOn = false;    // 교전 중인가
  var shakeAmp = 0;        // 남은 흔들림 세기(m)
  var holdUntil = 0;       // 이때까지 화면이 멎는다 (performance.now 기준)

  var focusAt = null;      // {x, y} 조우 중인 대상
  var stageAt = null;      // {x, y, uid} 조우 무대 — 대상 앞에 카메라를 세운다
  var beams = [];          // 빛기둥
  var clickRings = [];     // 클릭(탭)한 자리 표시 — 2026-09-06, 3D에선 안 보이던 것을 채움

  /* ── 교전 상대를 실제로 세운다 (PLAN 23절 다음, 2026-08-30) ──────────
   * `duel.js` 는 여태 카드 안의 이모지로만 싸웠다 — 3D 지도에는 아무도 안 섰다.
   * `battle3d.js` 가 `duel:open` 때 `duelStage()` 를 불러 상대를 실제로 세우면,
   * 배우는 늘 있던 `actors['me']`(동행 선두) 옆에서 진짜로 마주 선다.
   * 상대는 `spawns` 목록에 없는 임시 배우라 `syncActors()` 가 따로 먹여야 한다. */
  var duelFoe = null;      // {kind, ref, x, y} — 없으면 교전 중이 아니거나 3D 상대가 없다

  /** 사건이 조명을 잠깐 죽인다(2026-09-06, "비전투 이벤트 3D 무대 연출" —
   *  밤 사건의 긴장). 0(평소)~1. `battle3d.js`가 `duel:open`(늑대 무리·
   *  적군 정찰병처럼 `eerie` 딱지가 붙은 사건)·`duel:close`에서 두드린다.
   *  **`lightingAt()`이 내는 값 자체는 안 건드린다**(캐시일 수도 있고,
   *  미니맵 등 다른 곳도 같은 값을 본다) — `syncLight()`가 적용하는
   *  자리에서만 깎는다, 사건이 끝나면 다음 프레임에 저절로 원래 밝기로
   *  돌아간다(`setEventMood(0)`이 지운다) */
  var eventDark = 0;

  /** 이 자리가 집 몸통 안인가 — `world.js` 의 `hitsHouse` 와 같은 계산이지만
      독립된 사본이다(world3d 가 world.js 를 되받아 부르지 않게 한다).
      `margin` 은 여유(m) — 상대가 설 자리는 발이 벽에 안 묻힐 만큼(기본 1),
      카메라가 설 자리는 그보다 훨씬 넉넉해야 한다(벽에 바짝 붙으면 근접
      절단면이 벽 텍스처로 화면을 채운다) */
  function duelSpotBlocked(x, y, margin) {
    var m = margin === undefined ? 1 : margin;
    var gx0 = Math.floor(x / GRID), gy0 = Math.floor(y / GRID), gx, gy, rs, i, r;
    for (gy = gy0 - 1; gy <= gy0 + 1; gy++) {
      for (gx = gx0 - 1; gx <= gx0 + 1; gx++) {
        rs = houseRects(gx, gy);
        for (i = 0; i < rs.length; i++) {
          r = rs[i];
          var dx = x - r.x, dz = y - r.z;
          var c = Math.cos(r.rot), s = Math.sin(r.rot);
          var lx = dx * c + dz * s, lz = -dx * s + dz * c;
          if (Math.abs(lx) < r.w / 2 + m && Math.abs(lz) < r.d / 2 + m) { return true; }
        }
      }
    }
    return false;
  }

  /** 상대를 세운다 — `x, y` 는 나에게서 6m 남쪽(`battle3d.spot()` 과 같은 자리)이
      먼저다. 그 자리가 집 안이면(마을 한복판에서 걸린 사건) 부채꼴로 돌며
      가장 가까운 트인 자리를 대신 쓴다 — 안 그러면 상대가 벽 뒤에 완전히
      가려진다(2026-08-30, 실기기 확인 중 발견) */
  function duelStage(kind, ref) {
    if (!kind || !ref) { return false; }
    var pos = core.save.player.pos;
    var OFF = [[0, -6], [-6, -6], [6, -6], [-6, 0], [6, 0], [0, 6], [-6, 6], [6, 6]];
    var fx = pos.x + OFF[0][0], fy = pos.y + OFF[0][1], i;
    for (i = 0; i < OFF.length; i++) {
      var tx = pos.x + OFF[i][0], ty = pos.y + OFF[i][1];
      if (!duelSpotBlocked(tx, ty)) { fx = tx; fy = ty; break; }
    }
    duelFoe = { kind: kind, ref: ref, x: fx, y: fy };
    focusAt = { x: duelFoe.x, y: duelFoe.y };
    return true;
  }

  /** 상대를 내린다 — `sweepActors()` 가 알아서 사라지게 두지 않고 바로 지운다
   *  (교전 결과 카드가 곧바로 그 자리를 쓰므로 사라지는 연출은 필요 없다) */
  function duelUnstage() {
    var a = actors.duelfoe;
    if (a) {
      actorGroup.remove(a.node);
      actorGroup.remove(a.shadow);
      delete actors.duelfoe;
    }
    duelFoe = null;
  }

  /** 나 또는 상대에게 몸짓을 하나 재생한다(공격·피격·회피) — `who` 는 'me'·'foe'.
   *  클립이 없는 몸(도형 배우, 아직 안 받은 GLB)이면 조용히 아무 일도 안 한다. */
  function playAnim(who, name, ms) {
    var key = who === 'foe' ? 'duelfoe' : (who === 'ally' ? 'ally' : (actors[who] ? who : 'me'));
    var a = actors[key];
    if (!a) { return false; }
    a.animName = name;
    a.animUntil = (global.performance ? performance.now() : Date.now()) + (ms || 300);
    return true;
  }

  function bindEvents() {
    core.on('encounter:request', function (spawn) {
      if (spawn) { focusAt = { x: spawn.x, y: spawn.y }; }
    });
    core.on('station:request', function (st) {
      if (st) { focusAt = { x: st.x, y: st.y }; }
    });
    core.on('fort:request', function (ft) {
      if (ft) { focusAt = { x: ft.x, y: ft.y }; }
    });
    /* 도감에 새 줄이 생겼다 = 잡았다. 마지막으로 보던 자리에 빛기둥을 세운다 */
    core.on('dex:new', function () {
      /* 승화(growth.js)도 같은 이벤트를 낸다 — 조우 창이 열려 있을 때만 세운다.
         안 그러면 도감 화면에서 승화시켰는데 지도 한복판에 빛기둥이 선다 */
      var f = focusLive();
      if (f) { beam(f.x, f.y); }
    });
  }

  /** 조우 창이 아직 열려 있는가 — 닫혔으면 카메라를 놓아 준다.
      역참·성채·교전도 **같은 `#encounter` 한 칸**을 쓴다(station.js·fort.js·duel.js). */
  function focusLive() {
    if (!focusAt) { return null; }
    var el = document.getElementById('encounter');
    if (el && el.classList.contains('show')) { return focusAt; }
    focusAt = null;
    return null;
  }

  function beam(x, y) {
    if (!available()) { return; }
    var geo = unitGeo('cyl');
    var m = new T.Mesh(geo, new T.MeshBasicMaterial({
      color: 0xffe6a8, transparent: true, opacity: 0.85, depthWrite: false
    }));
    m.position.set(x, 6, y);
    m.scale.set(2.6, 12, 2.6);
    fxGroup.add(m);
    beams.push({ mesh: m, t: 0 });
  }

  function syncBeams(dt) {
    var i;
    for (i = beams.length - 1; i >= 0; i--) {
      var b = beams[i];
      b.t += dt;
      var k = b.t / 0.9;
      b.mesh.scale.x = b.mesh.scale.z = 2.6 + k * 5;
      b.mesh.material.opacity = Math.max(0, 0.85 * (1 - k));
      if (k >= 1) {
        fxGroup.remove(b.mesh);
        b.mesh.material.dispose();      // 이 재질은 이 기둥만 쓴다
        beams.splice(i, 1);
      }
    }
  }

  /** 클릭(탭)한 자리 — `world.js`의 2D 고리(커지며 옅어짐)와 같은 그림을
   *  3D 바닥에도 놓는다. 2026-09-06, "클릭 자리 표시가 없다"로 발견 —
   *  2D `clickMarks`는 3D가 켜지면 숨는 캔버스(`gCtx`)에만 그려져서
   *  3D에서는 눌러도 아무 반응이 안 보였다. `beam()`과 같은 자기 관리
   *  fx 패턴(`fxGroup`에 직접 얹고 `syncClickMark`가 나이 먹여 지운다) */
  function clickMark(x, y) {
    if (!available()) { return; }
    var m = new T.Mesh(
      new T.TorusGeometry(0.6, 0.12, 8, 28),
      new T.MeshBasicMaterial({ color: 0xffd650, transparent: true, opacity: 0.9, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;         // 눕혀서 바닥에 깐다
    m.position.set(x, groundY(x, y) + 0.05, y);
    fxGroup.add(m);
    clickRings.push({ mesh: m, t: 0 });
  }

  function syncClickMark(dt) {
    var i;
    for (i = clickRings.length - 1; i >= 0; i--) {
      var c = clickRings[i];
      c.t += dt;
      var k = c.t / 0.6;
      var s = 1 + k * 1.8;
      c.mesh.scale.set(s, 1, s);
      c.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
      if (k >= 1) {
        fxGroup.remove(c.mesh);
        c.mesh.material.dispose();
        clickRings.splice(i, 1);
      }
    }
  }

  /* ── 카메라 · 빛 ──────────────────────────────────────────
   * 시점 버튼(2D → 2.5D → 3D)이 **각도**를 정한다. 원작의 3D 는 카메라가 낮게
   * 깔려 건물 옆면이 보이는 각이라, 3D 모드에서 가장 눕는다.
   */
  var camPos = null, camLook = null;

  /**
   * 카메라가 어디서 무엇을 볼지 — 순수 계산이라 진단이 따로 굴려 본다.
   *
   * 거리는 **사람이 화면에서 차지하는 몫**으로 정했다. 원작에서 아바타는 화면 높이의
   * 1/8쯤이다 — 그보다 크면 인형놀이가 되고 작으면 누군지 안 보인다. 키 3.4m 를
   * 화각 52°로 담으려면 27m 쯤 물러나야 한다(처음엔 16m 라 얼굴이 화면을 채웠다).
   *   2D    거의 머리 위에서 (예전 탑다운과 같은 그림)
   *   2.5D  비스듬히 내려다본다
   *   3D    낮게 깔려 건물 옆면이 보인다 — 원작의 그 각
   */
  var CAM_HIGH_MUL = [2.27, 1.33, 0.80];    // 카메라 높이 배수
  var CAM_BACK_MUL = [0.05, 0.40, 0.60];    // 뒤로 물러나는 거리 배수
  var CAM_AHEAD = [0, 3, 5];                // 시선을 앞으로 던지는 거리(m)

  /** 조우 무대 — 대상 앞 몇 미터에 서서 눈높이로 본다 (원작의 포획 화면).
      거리는 **상대 키에 비례**한다: 사람과 뿔낙지를 같은 자리에서 보면
      하나는 얼굴이 화면을 채우고 하나는 발치에 놓인다 */
  function STAGE_DIST() { return core.tuned('world3d.stageDist', 10.5); }
  /** 교전 상대가 실제로 서 있을 때(`duelFoe`) 카메라가 다가서는 거리 —
      `stage` 보다 낮고 옆에서 본다(둘 다 한 화면에 담아야 한다) */
  function DUEL_DIST() { return core.tuned('world3d.duelDist', 9); }

  function camAim(pos, mode, focus, stage, zoom, battle, yaw, duel) {
    var z = (zoom === undefined || !isFinite(zoom) || zoom <= 0) ? 1 : zoom;
    var yw = yaw || 0;
    /* 교전이 열리면 **약간 줌인**한다(PLAN 23절). 무대(stage)처럼 자리를 통째로
       옮기지는 않는다 — 싸움은 내가 선 자리에서 벌어지고, 카메라만 다가선다 */
    if (battle) { z = z * 0.62; }
    if (!stage && duel) {
      /* 실제 상대가 3D 로 서 있으면(`world3d.duelStage()`) **둘을 옆에서 가까이**
         담는다 — 위에서 내려다보는 기본 구도로는 화면 한복판의 카드에 다 가려진다.
         무대(`stage`)의 "무릎께" 구도와 달리 상대가 아니라 **둘 사이**를 축으로 삼는다 */
      var mx = (pos.x + duel.x) / 2, my = (pos.y + duel.y) / 2;
      var ddx = duel.x - pos.x, ddy = duel.y - pos.y;
      var dlen = Math.max(0.5, Math.hypot(ddx, ddy));
      var px = -ddy / dlen, pz = ddx / dlen;   // 둘을 잇는 선에 수직 — 옆에서 본다
      var DD = DUEL_DIST();
      /* 마을 한복판에서 걸리면 이 낮고 가까운 자리가 **집 안**일 수 있다
         (2026-08-30, 실기기 대신 스크린샷으로 확인하다 발견 — 벽 속에서
         찍은 듯한 그림이 떴다). 반대편을 대신 써 보고, 그마저 막히면 낮게
         깔지 않고 기본 카메라처럼 높이 물러난다(막힌 벽보다 먼 그림이 낫다) */
      var CAM_MARGIN = 7;      // 카메라는 벽에서 이만큼은 떨어져야 근접 절단면이 안 보인다
                                // (지붕은 벽보다 넓게 튀어나오므로 바닥 사각형만으론 부족하다 — 넉넉히 잡는다)
      var side1 = { x: mx + px * DD, z: my + pz * DD };
      var side2 = { x: mx - px * DD, z: my - pz * DD };
      var pick = !duelSpotBlocked(side1.x, side1.z, CAM_MARGIN) ? side1 :
        (!duelSpotBlocked(side2.x, side2.z, CAM_MARGIN) ? side2 : null);
      if (pick) {
        return { pos: { x: pick.x, y: DD * 0.55, z: pick.z }, look: { x: mx, y: 2.2, z: my } };
      }
      /* 마을 한복판이 너무 빽빽해 양옆 다 막히면(2026-08-30, 실제로 찍어서
         걸린 자리를 재현했다 — 낮은 재시도까지 벽에 박혔다) **낮게 다가서는
         것 자체를 포기한다.** 아래 `focus` 구도(늘 안전하다고 확인된, 멀리서
         내려다보는 그림)를 그대로 따라 쓴다 — 상대(`duel`)를 `focus` 자리로
         그대로 꽂아 넣는다 */
      var dback = CAM_DIST() * CAM_BACK_MUL[mode] * z;
      var dhigh = CAM_HIGH() * CAM_HIGH_MUL[mode] * Math.pow(z, 1.12);
      var fdx = duel.x - pos.x, fdy = duel.y - pos.y;
      var flen = Math.max(1, Math.hypot(fdx, fdy));
      var fux = fdx / flen, fuy = fdy / flen;
      var fspan = Math.min(dback * 2.2, Math.max(dback, flen * 0.9));
      return {
        pos: { x: pos.x - fux * fspan * 0.7 - fuy * fspan * 0.45,
               y: dhigh * 0.72,
               z: pos.y - fuy * fspan * 0.7 + fux * fspan * 0.45 },
        look: { x: mx, y: 2.0, z: my }
      };
    }
    if (stage) {
      /* 나와 대상을 잇는 선 위에서, **대상 쪽에서 나를 향해** 물러선 자리다.
         무대에서는 시점 모드를 안 본다 — 조우는 어느 시점에서 열었든 같은 그림이어야 한다 */
      var sx = pos.x - stage.x, sy = pos.y - stage.y;
      var slen = Math.max(0.5, Math.hypot(sx, sy));
      var sh = stage.h || 3.2;
      var D = STAGE_DIST() * (sh / 3.2);
      return {
        pos: { x: stage.x + sx / slen * D, y: sh * 0.95, z: stage.y + sy / slen * D },
        /* 무릎께를 본다 — 상대가 화면 위쪽에 서고 아래는 조우 카드 자리가 된다 */
        look: { x: stage.x, y: sh * 0.45, z: stage.y }
      };
    }
    /* 멀리 물러날수록 **더 내려다본다** — 거리와 높이를 같은 비율로 늘리면
       지평선만 잔뜩 보이고 발밑이 안 보인다 */
    var back = CAM_DIST() * CAM_BACK_MUL[mode] * z;
    var high = CAM_HIGH() * CAM_HIGH_MUL[mode] * Math.pow(z, 1.12);
    if (focus) {
      /* 나와 대상 사이를 본다. 카메라는 **내 뒤 옆쪽**에 서서 둘을 한 화면에 담는다 */
      var dx = focus.x - pos.x, dy = focus.y - pos.y;
      var len = Math.max(1, Math.hypot(dx, dy));
      var ux = dx / len, uy = dy / len;
      /* 멀리 있는 대상이면 더 물러나되 **상한을 둔다** — 조우는 코앞에서만 열리지만
         (ENCOUNTER_RANGE) 데모처럼 먼 대상을 걸면 카메라가 200m 밖으로 날아간다 */
      var span = Math.min(back * 2.2, Math.max(back, len * 0.9));
      return {
        pos: { x: pos.x - ux * span * 0.7 - uy * span * 0.45,
               y: high * 0.72,
               z: pos.y - uy * span * 0.7 + ux * span * 0.45 },
        look: { x: (pos.x + focus.x) / 2, y: 2.0, z: (pos.y + focus.y) / 2 }
      };
    }
    /* **돌려 보기**(PLAN 7·26절 "마우스/터치 회전") — 카메라를 나를 축으로 돌린다.
       보는 곳은 그대로 내 앞이라, 돌려도 **내가 화면 한가운데** 남는다 */
    var cs = Math.cos(yw), sn = Math.sin(yw);
    var ax = 0, az = back;                       // 안 돌렸을 때 카메라가 서는 자리
    var ahead = CAM_AHEAD[mode];
    return {
      pos: { x: pos.x + ax * cs - az * sn, y: high, z: pos.y + ax * sn + az * cs },
      look: { x: pos.x + ahead * sn, y: mode === 0 ? 0.5 : 2.4, z: pos.y - ahead * cs }
    };
  }

  /**
   * 건물 가림 — 오픈월드 RPG처럼 **카메라가 벽 앞으로 당겨 온다**(PLAN §5 ⑯ 곁, 2026-09-24 사용자 "건물 근처로 가면
   * 캐릭터가 안 보여"). 집은 인스턴스로 그려 한 채만 반투명하게 할 수 없어서, 광선 대신 벽 충돌과 같은
   * 사각형(`houseRects`, 키 h 를 실었다)으로 잰다 — 머리(P)에서 카메라(C)로 가는 선이 집 몸통에
   * **지붕보다 낮게** 들어가면, 들어가는 자리 조금 앞(t)까지 당긴다. 순수 함수 — 진단이 값으로 붙든다.
   *   P·C = {x, y, z}(three 좌표, y 가 위) · rects = [{x, z, w, d, rot, h, base}] → t(0.2~1, 1 = 안 가림)
   * 보이는 GLB 는 키로 고르게 늘여 벽 사각형보다 넓다 — 반폭은 max(w/2, 키×0.45)로 넉넉히 잡는다.
   */
  function camOcclude(P, C, rects) {
    var best = 1, i;
    for (i = 0; i < rects.length; i++) {
      var r = rects[i];
      var c = Math.cos(r.rot || 0), sn = Math.sin(r.rot || 0);
      function loc(x, z) { var dx = x - r.x, dz = z - r.z; return [dx * c + dz * sn, -dx * sn + dz * c]; }
      var a = loc(P.x, P.z), b = loc(C.x, C.z);
      var hx = r.exact ? r.w / 2 : Math.max(r.w / 2, r.h * 0.45), hz = r.exact ? r.d / 2 : Math.max(r.d / 2, r.h * 0.45);   // exact = 산봉우리 원뿔(W-0113) — 폭 그대로
      var t0 = 0, t1 = 1, k, lo = [-hx, -hz], hi = [hx, hz], ok = true;
      for (k = 0; k < 2 && ok; k++) {
        var d = b[k] - a[k];
        if (Math.abs(d) < 1e-9) { if (a[k] < lo[k] || a[k] > hi[k]) { ok = false; } continue; }
        var u0 = (lo[k] - a[k]) / d, u1 = (hi[k] - a[k]) / d;
        if (u0 > u1) { var tmp = u0; u0 = u1; u1 = tmp; }
        t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
        if (t0 > t1) { ok = false; }
      }
      if (!ok || t0 <= 0 || t0 >= 1) { continue; }      // 안 지나거나, 머리가 이미 몸통 안(벽에 붙음)
      var y = P.y + (C.y - P.y) * t0, top = (r.base || 0) + r.h;
      if (y < top && t0 < best) { best = t0; }
    }
    return best >= 1 ? 1 : Math.max(0.2, best - 0.04);
  }
  function OCCLUDE_ON() { return core.tuned('world3d.camOcclude', 1) ? true : false; }
  /** 내 둘레 3×3 칸의 집 — 땅 높이(base)를 붙인다(산비탈 마을) */
  function rectsNear(x, y) {
    var gx0 = Math.floor(x / GRID), gy0 = Math.floor(y / GRID), gx, gy, rs, i, out = [];
    for (gy = gy0 - 1; gy <= gy0 + 1; gy++) {
      for (gx = gx0 - 1; gx <= gx0 + 1; gx++) {
        rs = houseRects(gx, gy); if (global.DG.world.terrainAt(gx, gy) === 'mount') { rs = rs.concat([{ x: gx * GRID + GRID / 2, z: gy * GRID + GRID / 2, w: GRID * 0.5, d: GRID * 0.5, rot: 0, h: (14 + h1(gx * 3 + 1, gy * 5 + 2) * 22) * 0.75, exact: true }]); }   // W-0113 산봉우리도 가린다
        for (i = 0; i < rs.length; i++) { if (rs[i].h) { rs[i].base = groundY(rs[i].x, rs[i].z); out.push(rs[i]); } }
      }
    }
    return out;
  }
  var occlT = 1, occlAcc = 9, occlRects = [], occlCell = null;

  function syncCamera(W, dt) {
    var pos = core.save.player.pos;
    /* ⑲-13 이야기 대화 — 듣는 이 어깨 너머에서 말하는 이 얼굴을 본다(talkface.talkAim). 끝나면 아래 보통 구도로 따라 돌아온다 */
    var TS = stageAt ? null : talkShot();
    /* 조우 무대에서는 줌을 무시한다 — 무대는 늘 같은 그림이어야 한다 */
    /* ⑲-22 활 조준 — 오른 어깨 너머에서 겨눈 쪽을 본다(대화·조우 무대가 먼저) */
    var FCv = global.DG.fieldCombat, AV = !TS && !stageAt && FCv && FCv.aimView ? FCv.aimView() : null;
    var aim = TS ? global.DG.talkface.talkAim(TS.spk, TS.lst, ACTOR_H()) : (AV ? aimCam(pos, AV, ACTOR_H()) : camAim(pos, W.tiltMode, focusLive(), stageAt,
      stageAt ? 1 : W.zoom3d, battleOn, stageAt ? 0 : yaw, duelFoe));
    /* **카메라와 시선도 땅을 따라 오른다.** 안 그러면 산에 오를 때 카메라가
       제자리에 남아 땅이 화면을 덮고, 골짜기에서는 하늘만 보인다.
       `camAim` 은 평면 기준으로 값을 내므로 여기서 땅 높이만 얹는다 —
       그쪽은 순수 함수로 남겨 둔다(자가진단이 값으로 붙들고 있다) */
    var camLift = groundY(aim.pos.x, aim.pos.z);
    var lookLift = groundY(aim.look.x, aim.look.z);
    /* 활공(§5 ⑰ 다음) — 몸이 땅 위 수십 m 를 나는 동안은 카메라·시선도 몸 높이를 따라간다 */
    var LFc = global.DG.landform;
    if (LFc && ((LFc.gliding && LFc.gliding()) || meSky() || (LFc.onPole && LFc.onPole()))) {     // ⑲-20 섬 위·⑲-34 기둥 위에서도 몸 높이를 따른다
      var bodyY = standY(pos.x, pos.y) + LFc.airH();
      camLift = Math.max(camLift, bodyY); lookLift = Math.max(lookLift, bodyY);
    }
    var want = new T.Vector3(aim.pos.x, aim.pos.y + camLift, aim.pos.z);
    var look = new T.Vector3(aim.look.x, aim.look.y + lookLift, aim.look.z);
    /* 건물 가림(camOcclude) — 2.5D·3D 에서만(2D 는 머리 위라 안 가린다). 칸이 바뀔 때만 집을 다시 모으고,
       판정은 0.1초마다(폰 발열). 당길 때는 빨리, 풀 때는 천천히 — 벽 너머가 비치는 순간이 없게 */
    var occl = 1;
    if (OCCLUDE_ON() && W.tiltMode >= 1 && !stageAt) {
      var cellK = Math.floor(pos.x / GRID) + ':' + Math.floor(pos.y / GRID);
      if (cellK !== occlCell) { occlCell = cellK; occlRects = rectsNear(pos.x, pos.y); }
      occlAcc += dt;
      /* 대화 중에는 내 머리 대신 말하는 이 얼굴(시선)에서 잰다 */
      var hx = TS ? look.x : pos.x, hz = TS ? look.z : pos.y, hy = TS ? look.y : standY(pos.x, pos.y) + 1.7;
      if (occlAcc > 0.1 && occlRects.length) {
        occlAcc = 0;
        occlT = camOcclude({ x: hx, y: hy, z: hz }, { x: want.x, y: want.y, z: want.z }, occlRects);
      } else if (!occlRects.length) { occlT = 1; }
      occl = occlT;
      if (occl < 1) {
        want.set(hx + (want.x - hx) * occl, hy + (want.y - hy) * occl, hz + (want.z - hz) * occl);
      }
    }
    if (!camPos) { camPos = want.clone(); camLook = look.clone(); }
    /* 카메라는 곧바로 붙지 않고 따라온다 — 원작의 그 미끄러지는 느낌이다.
       교전 중에는 조금 더 빨리 붙는다(줌인이 굼뜨면 때리는 맛이 죽는다) */
    var k = occl < 1 ? Math.min(1, dt * 14) : (TS ? 1 - Math.exp(-7 * dt) : Math.min(1, dt * (battleOn ? 9 : 6.5)));   // 대화는 지수 7/초
    camPos.lerp(want, k);
    camLook.lerp(look, k);
    camera.position.copy(camPos);
    /* 흔들림 — **따라온 자리에 얹기만** 한다. camPos 자체를 흔들면 흔들림이
       다음 프레임의 출발점이 되어 카메라가 조금씩 밀려난다 */
    if (shakeAmp > 0.001 && !TS) {             // 대화 중엔 흔들림을 안 받는다
      var ph = frame * 1.9;
      camera.position.x += Math.sin(ph) * shakeAmp;
      camera.position.y += Math.sin(ph * 1.7 + 1.1) * shakeAmp * 0.6;
      camera.position.z += Math.cos(ph * 1.3) * shakeAmp;
      shakeAmp *= Math.pow(0.02, dt);            // 초당 50분의 1로 잦아든다
    } else { shakeAmp = 0; }
    camera.lookAt(camLook);
  }

  /* 크게 당기면 절두체에 사물이 다 들어와 그림자 맵이 감당하지 못한다.
     그 높이에서는 그림자가 몇 픽셀도 안 되니 **끄는 편이 낫다.**
     경계에서 한 번만 갈아 끼운다 — 프레임마다 바꾸면 셰이더를 다시 컴파일한다 */
  var shadowOn = true;
  function syncShadow(zoom) {
    var P = global.DG.perf;
    var want = zoom < 4 && !(global.DG_3D_DEBUG || {}).noShadow && (!P || P.shadowOk());
    if (want === shadowOn) { return; }
    shadowOn = want;
    renderer.shadowMap.enabled = want;
    scene.traverse(function (o) {
      if (o.isMesh && o.material) { o.material.needsUpdate = true; }
    });
  }

  function syncLight(dt) {
    var L = lightingAt(forcedMs === null ? undefined : forcedMs, weatherKey());
    lightNow = L;
    var pos = core.save.player.pos;
    /* 해는 늘 플레이어 곁을 따라다닌다 — 그림자 상자를 좁게 유지하려고.
       높이·방위만 시각이 정한다 */
    sun.position.set(pos.x + L.sun.x, L.sun.y, pos.y + L.sun.z);
    sun.target.position.set(pos.x, 0, pos.y);
    sun.target.updateMatrixWorld();
    sun.color.setHex(L.sun.hex);
    sun.intensity = L.sun.intensity;
    sky.color.setHex(L.hemi.sky);
    sky.groundColor.setHex(L.hemi.ground);
    /* 사건이 조명을 죽인다 — 태양·하늘빛만 낮추고(색은 그대로 두어 "밤인데
       더 어두워짐"으로 보이게 한다) 안개는 좁혀 "가까이만 보인다"를 낸다 */
    var dk = eventDark;
    sun.intensity = L.sun.intensity * (1 - dk * 0.55);
    sky.intensity = L.hemi.intensity * (1 - dk * 0.45);
    /* IBL 세기도 같은 낮·밤·날씨 곡선을 탄다 — 위 loadEnvironment() 머리말 참고 */
    if (scene.environmentIntensity !== undefined) {
      scene.environmentIntensity = sky.intensity * IBL_SCALE();
    }
    if (scene.background && scene.background.setHex) { scene.background.setHex(L.bg); }
    renderer.setClearColor(L.bg, 1);
    if (scene.fog) {
      scene.fog.color.setHex(L.bg);
      scene.fog.near = L.fog.near * (1 - dk * 0.5);
      scene.fog.far = L.fog.far * (1 - dk * 0.4);
    }
  }

  /* ── 그린다 ───────────────────────────────────────────── */

  /**
   * 화면에 낸다 — 후처리를 거치거나(있고 켜져 있을 때) 곧바로 그린다.
   * **두 길 다 톤매핑은 한 번 걸린다**(`post3d.js` 머리 참고).
   * 그리는 자리가 두 군데(여기와 hit-stop)라 함수로 묶었다 — 한쪽만 고치면
   * 멎는 동안 후처리가 벗겨져 화면이 껌뻑인다.
   */
  /* §6.1-B ① 재기(`?perf`) — 한 프레임에 그린 호출·삼각형을 **후처리 여러 번을 합쳐** 센다(평소엔 마지막 한 번만 남는다) */
  var PERF_ON = /[?&]perf\b/.test((global.location && global.location.search) || '');
  var glFrame = { calls: 0, tris: 0 };
  function present() {
    if (PERF_ON) { renderer.info.autoReset = false; renderer.info.reset(); }
    presentDraw();
    if (PERF_ON) { glFrame.calls = renderer.info.render.calls; glFrame.tris = renderer.info.render.triangles; }
  }
  function presentDraw() {
    var P3 = global.DG.post3d;
    if (P3) {
      if (P3.draw(renderer, scene, camera, lightNow)) { return; }
      /* 후처리가 켜졌다 꺼졌을 수 있다(등급이 LOW 로 내려간 순간).
         마지막으로 쓰던 렌더 타깃이 물려 있으면 캔버스가 검게 남는다 */
      renderer.setRenderTarget(null);
    }
    renderer.render(scene, camera);
  }

  var last = 0;

  /* `game.js` 의 루프는 `world.draw()`(→ 여기)를 부른 **뒤에** requestAnimationFrame
   * 을 다시 잡는다 — 그래서 이 함수 안에서 예외가 하나라도 새면 다음 프레임 자체가
   * 안 잡혀 이동·그리기·전투 무대까지 전부 그 자리에서 멎는다(2026-08-31, 실기기
   * 신고로 찾음). 안에 있는 개별 sync 들은 저마다 제 몫만 어긋나면 스스로 꺼지게
   * 감쌌지만, **여기서 한 번 더 통째로 막는다** — three.js 자체(예: 셰이더 컴파일)
   * 가 던지는 것까지는 개별 감싸기로 못 잡기 때문이다. 잡았을 땐 그린 그림이라도
   * 있어야 검게 안 깜빡이니 `present()` 를 한 번 더 시도한다(그마저 던지면 조용히 넘어간다) */
  function render() {
    if (!active()) { return false; }
    try {
      var W = global.DG.world;
      var now = performance.now();
      var dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016;
      last = now;
      frame++;

      /* hit-stop — 큰 것이 꽂힌 순간 화면이 아주 잠깐 멎는다(PLAN 23절).
         **그린 것을 그대로 한 번 더 낸다** — 아무것도 안 그리면 검게 깜빡인다 */
      if (now < holdUntil) { present(); return true; }

      syncLight(dt);
      syncShadow(W.zoom3d || 1);
      syncGround(W);
      syncProps(W);
      syncLamps();
      syncSway(dt);
      syncFlame(dt);
      syncSmoke(dt);
      syncActors(W, now);
      sweepActors(dt);
      if (global.DG.encounter3d) { global.DG.encounter3d.tick(dt); }
      if (global.DG.battle3d) { global.DG.battle3d.tick(dt); }
      if (global.DG.sky3d) { global.DG.sky3d.tick(dt, lightNow); }
      if (global.DG.water3d) { global.DG.water3d.tick(dt, lightNow); }
      syncBeams(dt);
      syncClickMark(dt);
      syncCamera(W, dt);
      instCull();

      present();
      return true;
    } catch (err) {
      if (global.console) { console.error('[world3d] render() 에서 멎을 뻔해 한 프레임 건너뛴다', err); }
      try { present(); } catch (err2) { /* 그마저 안 되면 이번 프레임은 포기한다 */ }
      return true;
    }
  }

  /**
   * 세워 둔 소품을 통째로 지운다 — 다음 프레임에 다시 선다.
   * `prop3d` 가 GLB 를 다 받은 뒤 한 번 부른다: 그 한 번에 원뿔 나무가
   * 진짜 나무로 바뀐다. 인스턴스 덩이도 같이 비운다(빈 자리를 돌려받아야
   * 새 덩이가 창고를 나눠 쓴다).
   */
  function refreshProps() {
    if (!propGroup) { return 0; }
    var n = 0, k;
    for (k in propMeshes) {
      if (!Object.prototype.hasOwnProperty.call(propMeshes, k)) { continue; }
      instDrop(k);
      propGroup.remove(propMeshes[k]);
      n++;
    }
    propMeshes = {};
    townDens = {};
    smokeByKey = {};          // 통째로 다시 지으니 연기 창고도 같이 비운다
    propScan = null;          // 다음 프레임에 다시 훑는다
    return n;
  }

  /**
   * 세워 둔 배우(사람·짐승)를 통째로 지운다 — `actorOf` 가 한 번 지은 3D 배우는
   * 그대로 붙들고 있으므로, 등신 비례가 바뀌어도 이미 선 배우는 옛 비례 그대로
   * 남는다. 다음 프레임에 지금 비례로 다시 짓도록 비운다(게임.js 의 등신 버튼이
   * 부른다). 2D 빌보드 텍스처는 캐시 키에 등신이 이미 들어 있어 그냥 둬도
   * 저절로 새 비례로 바뀐다.
   */
  function resetActors() {
    if (!actorGroup) { return 0; }
    var n = 0, k;
    for (k in actors) {
      if (!Object.prototype.hasOwnProperty.call(actors, k)) { continue; }
      actorGroup.remove(actors[k].node);
      actorGroup.remove(actors[k].shadow);
      n++;
    }
    actors = {};
    return n;
  }

  global.DG = global.DG || {};
  /**
   * 인스턴스 창고 속 — **어느 덩이에 몇이 서 있나.**
   * "계획은 나오는데 화면에 없다" 를 가를 때 이것 하나면 끝난다(벼에서 밟았다).
   */
  function instReport(filter) {
    var out = [], k;
    for (k in instKinds) {
      if (!Object.prototype.hasOwnProperty.call(instKinds, k)) { continue; }
      if (filter && k.indexOf(filter) < 0) { continue; }
      var K = instKinds[k], m = K.mesh;
      var det = '';
      if (filter) {
        /* 걸러 볼 때는 **속까지** 본다 — 창고에는 있는데 화면에 없을 때
           보이지 않는 이유는 결국 이 넷 중 하나다 */
        var g = m.geometry, pa = g && g.getAttribute('position');
        m.updateMatrixWorld(true);
        var e = m.matrixWorld.elements;
        var m0 = new T.Matrix4();
        if (m.count > 0) { m.getMatrixAt(0, m0); }
        var p0 = new T.Vector3(), q0 = new T.Quaternion(), s0 = new T.Vector3();
        m0.decompose(p0, q0, s0);
        det = ' [보임' + (m.visible ? 1 : 0) +
          ' 재질' + (m.material && m.material.visible ? 1 : 0) +
          ' 투명' + (m.material && m.material.opacity !== undefined ? m.material.opacity : '?') +
          ' 정점' + (pa ? pa.count : '?') +
          ' 부모' + (m.parent ? m.parent.name || 'group' : 'none') +
          ' 월드' + e[12].toFixed(0) + ',' + e[13].toFixed(0) + ',' + e[14].toFixed(0) +
          ' 첫자리' + p0.x.toFixed(0) + ',' + p0.y.toFixed(1) + ',' + p0.z.toFixed(0) +
          ' 배율' + s0.x.toFixed(2) + ']';
      }
      out.push(k.split('/').pop() + '=' + K.n + '/' + m.count + det);
    }
    return out;
  }

  global.DG.world3d = {
    init: init, resize: resize, render: render, refreshProps: refreshProps,
    swapMotion: swapMotion,
    resetActors: resetActors,
    /** 인스턴스 창고 속을 들여다본다(진단·데모용). 이름 조각으로 걸러 볼 수 있다 */
    instReport: instReport,
    /** 배우 한 명의 실제 위치·상태를 들여다본다(진단용) — `actors['me']`·
     *  `'ally'`·`'petbuddy'`·`'duelfoe'` 등 */
    actorPos: function (key) {
      var a = actors[key];
      if (!a) { return null; }
      return {
        x: a.node.position.x, y: a.node.position.y, z: a.node.position.z,
        scale: a.node.scale.x, mesh: a.mesh, visible: a.node.visible
      };
    },
    actorKeys: function () { return Object.keys(actors); }, actorNode: function (key) { return actors[key] ? actors[key].node : null; },   // ㉑ 배우 마디 — weapon.js 무기 빛이 선두 외곽선 색만 고친다
    available: available, active: active, wanted: wanted,
    /* 값을 내는 함수 — three 없이도 돈다(자가진단이 이것만 따로 본다) */
    lightingAt: lightingAt, propPlan: propPlan, urbanity: urbanity, camAim: camAim,
    /** 짓는 반경(R)·부수는 반경(UR, PLAN 42절) — 손잡이로 잡는다 */
    propRadius: PROP_R, unloadRadius: function () { return PROP_UR(PROP_R()); },
    /** 잔 사물이 진짜 모델을 받는 거리(PLAN 36절 LOD) — 손잡이로 잡는다 */
    lodNear: LOD_NEAR,
    /** 잎·풀 흔들림 켬/폭(PLAN 44절) — 손잡이로 잡는다 */
    swayOn: SWAY_ON, swayAmt: SWAY_AMT,
    /** 등롱·사당 불꽃·연기 켬(PLAN 44절) — 손잡이로 잡는다 */
    flameOn: FLAME_ON, flameAmt: FLAME_AMT, smokeOn: SMOKE_ON,
    houseRects: houseRects,
    camOcclude: camOcclude,
    /** 땅 높이(m) — 들판 전투가 예고 원·숫자를 땅에 붙일 때 쓴다 */
    groundY: groundY,
    /** ⑲-20 층을 아는 발 높이 — sky 를 안 주면 내 층(구름섬 위면 섬 윗면) */
    standY: standY,
    aimCam: aimCam,
    /** 지금 쓰는 시야각(도) — 진단·데모가 세로 화면 보정을 값으로 본다 */
    fov: function () { return camera ? camera.fov : FOV(); },
    forceTime: forceTime,
    /* 조우 무대 — `encounter3d.js` 가 켜고 끈다. 여기 있는 것은 **카메라와 자리**뿐이고
       링·사료·빛 같은 소품은 그쪽이 만들어 `addFx` 로 얹는다 */
    stage: function (o) {
      stageAt = o ? { x: o.x, y: o.y, uid: o.uid, lift: 0, back: 0 } : null;
      return stageAt;
    },
    stageAt: function () { return stageAt; },
    three: function () { return T; },
    addFx: function (n) { if (fxGroup && n) { fxGroup.add(n); } return n; },
    removeFx: function (n) { if (fxGroup && n) { fxGroup.remove(n); } },
    /** 클릭(탭)한 자리를 3D 바닥에도 표시 — `world.js`의 `onClick()`이 부른다 */
    clickMark: clickMark,
    camNode: function () { return camera; }, pickGround: pickGround,
    /** 돌려 보기 — 드래그가 두드린다(`world.js`). 라디안을 더한다 */
    turn: function (d) {
      if (talkShot()) { return yaw; }            // ⑲-13 대화 중엔 끌어 돌리기를 안 받는다
      yaw += d || 0;
      while (yaw > Math.PI) { yaw -= Math.PI * 2; }
      while (yaw < -Math.PI) { yaw += Math.PI * 2; }
      return yaw;
    },
    yaw: function (v) { if (v !== undefined) { yaw = v; } return yaw; },
    /* 전투 연출 손잡이 — `battle3d.js` 가 두드린다 (PLAN 23절) */
    battle: function (on) { battleOn = !!on; if (!on) { shakeAmp = 0; } return battleOn; },
    inBattle: function () { return battleOn; },
    /* 교전 상대를 실제로 세운다 — `battle3d.js` 가 duel:open/close 때 두드린다 */
    duelStage: duelStage, duelUnstage: duelUnstage, playAnim: playAnim,
    duelFoe: function () { return duelFoe; },
    /** 사건이 조명을 얼마나 죽이나(0~1) — `battle3d.js`가 `duel:open`·
     *  `duel:close`에서 두드린다. 인자 없이 부르면 지금 값만 읽는다 */
    eventMood: function (v) { if (v !== undefined) { eventDark = Math.max(0, Math.min(1, v)); } return eventDark; },
    /** 카메라를 흔든다. 세기는 m — 여러 번 부르면 센 쪽이 남는다 */
    shake: function (amp) { shakeAmp = Math.max(shakeAmp, amp || 0); return shakeAmp; },
    shakeAmp: function () { return shakeAmp; },
    /** 잠깐 멎는다(ms). 너무 길면 끊긴 것으로 보이므로 상한을 둔다 */
    hold: function (ms) {
      var v = Math.min(180, Math.max(0, ms || 0));
      holdUntil = Math.max(holdUntil, (global.performance ? performance.now() : 0) + v);
      return v;
    },
    lum: lum, GRID: GRID,
    /** 인스턴스 덩이 현황 (PLAN 16절) — 진단·데모가 값으로 본다 */
    instStats: instStats,
    instCullStats: function () { return { live: cullStat.live, drawn: cullStat.drawn, frames: cullStat.frames }; },
    /** 지면에 칠하는 땅 색 — 진단이 빠진 갈래가 없는지 본다 */
    LAND_COLOR: LAND_COLOR,
    /** 지금 조명 (데모·어드민이 들여다본다) */
    light: function () { return lightNow || lightingAt(undefined, weatherKey()); },
    /** 조우 연출을 밖에서 걸어 볼 때 (데모가 쓴다) */
    focus: function (o) { focusAt = o ? { x: o.x, y: o.y } : null; return focusAt; },
    beam: beam,
    /* 눈으로 확인할 때 쓰는 값 */
    /** 지면 타일이 어떤 상태인지 — 색·텍스처·위치를 그대로 뽑는다 */
    tileProbe: function () {
      var ks = Object.keys(tileMeshes);
      if (!ks.length) { return 'none'; }
      var out = [], i;
      for (i = 0; i < Math.min(3, ks.length); i++) {
        var m = tileMeshes[ks[i]];
        out.push(ks[i] + ':col=' + m.material.color.getHexString() +
          ' map=' + (m.material.map ? (m.material.map.image && m.material.map.image.width ? 'img' + m.material.map.image.width : 'empty') : 'no') +
          ' at=' + Math.round(m.position.x) + ',' + Math.round(m.position.z));
      }
      var lights = [];
      scene.traverse(function (o) { if (o.isLight) { lights.push(o.type + ':' + o.intensity.toFixed(2)); } });
      out.push('lights=' + lights.join('/'));
      return out.join(' | ');
    },
    /** 화면 몇 군데의 색을 직접 읽는다 — "검게 나온다" 를 눈이 아니라 값으로 본다 */
    probe: function () {
      if (!available()) { return 'n/a'; }
      var gl = renderer.getContext();
      var w = canvas.width, h = canvas.height;
      function at(px, py) {
        var b = new Uint8Array(4);
        gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
        return b[0] + ',' + b[1] + ',' + b[2];
      }
      /* WebGL 은 왼쪽 **아래**가 원점이다 */
      var read = 'top=' + at(w >> 1, h - 8) + ' mid=' + at(w >> 1, h >> 1) +
        ' bot=' + at(w >> 1, 8) + ' size=' + w + 'x' + h;
      /* 버퍼 읽기 경로가 멀쩡한지 — 마젠타로 지우고 곧바로 읽어 본다 */
      gl.clearColor(1, 0, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      read += ' clearTest=' + at(w >> 1, h >> 1);
      /* 카메라가 무엇을 보고 있는지 */
      read += ' near/far=' + camera.near + '/' + camera.far +
        ' look=' + (camLook ? [camLook.x, camLook.y, camLook.z].map(Math.round).join(',') : '-') +
        ' children=' + scene.children.length;
      return read;
    },
    /** §6.1-B ① 재기(`?perf` 표시가 0.5초마다 읽는다) — 한 프레임 호출·삼각형(`?perf` 일 때만 합산)·GPU 도형·텍스처·셰이더·캔버스 */
    glInfo: function () {
      if (!renderer) { return null; }
      var I = renderer.info;
      return { calls: PERF_ON ? glFrame.calls : I.render.calls, tris: PERF_ON ? glFrame.tris : I.render.triangles,
        geos: I.memory.geometries, texs: I.memory.textures, progs: I.programs ? I.programs.length : 0,
        w: canvas ? canvas.width : 0, h: canvas ? canvas.height : 0, dpr: renderer.getPixelRatio() };
    },
    /** §6.1-B ① 재기 — 씬 최상위 묶음마다 보이는 삼각형·메시 수(그림자 드리우는 몫 따로). 화면 밖 걸러내기 전 값 */
    triBreakdown: function (topN) {
      if (!scene) { return null; }
      var out = {}, byGeo = {};
      if (topN) {
        propGroup.traverseVisible(function (o) {
          if (!o.isMesh || !o.geometry) { return; }
          var g = o.geometry, c = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0), per = Math.round(c / 3);
          var k = g.uuid, e = byGeo[k] || (byGeo[k] = { name: (o.name || (o.parent && o.parent.name) || g.type).slice(0, 60), per: per, n: 0, inst: !!o.isInstancedMesh, cast: !!o.castShadow });
          e.n += o.isInstancedMesh ? o.count : 1;
        });
        out.top = Object.keys(byGeo).map(function (k) { var e = byGeo[k]; e.total = e.per * e.n; return e; })
          .sort(function (a, b) { return b.total - a.total; }).slice(0, topN);
      }
      scene.children.forEach(function (ch, i) {
        var key = ch === groundGroup ? 'ground' : ch === propGroup ? 'prop' : ch === actorGroup ? 'actor' : ch === fxGroup ? 'fx' : (ch.type + i);
        var tris = 0, cast = 0, meshes = 0;
        ch.traverseVisible(function (o) {
          if (!o.isMesh || !o.geometry) { return; }
          var g = o.geometry, c = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
          var t = Math.round(c / 3) * (o.isInstancedMesh ? o.count : 1);
          tris += t; meshes++; if (o.castShadow) { cast += t; }
        });
        if (tris) { out[key] = { tris: tris, cast: cast, meshes: meshes }; }
      });
      return out;
    },
    /** §6.1-B ① 재기 — 배우마다 삼각형 수(큰 것부터 n 개). 어느 몸이 GPU 를 잡아먹는지 본다 */
    heavyActors: function (n) {
      var out = [], a;
      for (a in actors) {
        if (!Object.prototype.hasOwnProperty.call(actors, a) || !actors[a].node) { continue; }
        var tris = 0, meshes = 0;
        actors[a].node.traverse(function (o) {
          if (!o.isMesh || !o.geometry) { return; }
          var g = o.geometry, c = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
          tris += Math.round(c / 3) * (o.isInstancedMesh ? o.count : 1); meshes++;
        });
        var bb = new T.Box3().setFromObject(actors[a].node), sz = bb.getSize(new T.Vector3());
        out.push({ key: a, kind: actors[a].kind, tris: tris, meshes: meshes, vis: actors[a].node.visible, size: [sz.x, sz.y, sz.z].map(function (v) { return +v.toFixed(1); }) });
      }
      out.sort(function (x, y) { return y.tris - x.tris; });
      return out.slice(0, n || 10);
    },
    stats: function () {
      var meshes = 0, a;
      for (a in actors) {
        if (Object.prototype.hasOwnProperty.call(actors, a) && actors[a].mesh) { meshes++; }
      }
      var drawn = 0;
      if (scene) { scene.traverse(function (o) { if (o.isMesh || o.isSprite) { drawn++; } }); }
      var L = lightNow;
      return {
        tiles: Object.keys(tileMeshes).length,
        props: Object.keys(propMeshes).length,
        actors: Object.keys(actors).length,
        meshActors: meshes,
        drawn: drawn,
        frames: frame,
        light: L ? (L.phase + ' ' + L.weather + ' 해' + L.sun.intensity.toFixed(2)) : '-',
        zoom: '×' + (global.DG.world.zoom3d || 1).toFixed(1),
        focus: focusAt ? (Math.round(focusAt.x) + ',' + Math.round(focusAt.y)) : '-',
        stage: stageAt ? (Math.round(stageAt.x) + ',' + Math.round(stageAt.y) +
          ' h' + (stageAt.h || 0).toFixed(1)) : '-',
        enc: (function () {
          var e = global.DG.encounter3d, st = e && e.state();
          return st ? (st.kind + '/' + st.phase + '/t' + st.t + '/사료' + st.pellet) : '-';
        })(),
        size: canvas ? (canvas.width + 'x' + canvas.height) : '-',
        cam: camera ? ([camera.position.x, camera.position.y, camera.position.z]
          .map(function (v) { return Math.round(v); }).join(',')) : '-',
        /* §6.1-B ① 재기 — 그리기 호출·삼각형(마지막 render 한 번)·GPU 에 올린 도형·텍스처·셰이더 수 */
        gl: renderer ? { calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
          geos: renderer.info.memory.geometries, texs: renderer.info.memory.textures,
          progs: renderer.info.programs ? renderer.info.programs.length : 0 } : null,
        failed: failed, ready: ready, wanted: wanted(),
        ibl: scene ? ((scene.environment ? 'on×' + (scene.environmentIntensity || 0).toFixed(2) : 'off')) : '-'
      };
    }
  };
})(window);
