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
  var IBL_SRC = '../shared/assets/sky/ibl_noon_present_1k.hdr';   function iblSrc() { var A = global.DG.assets3d; return (A && A.root && A.root()) ? A.root() + 'sky/ibl_noon_present_1k.hdr' : IBL_SRC; }   // W-0139 — 자체 하늘 C HDR 먼저 · W-0154 — 옛 사진 HDR 지움, 폴백은 같은 파일을 상대 경로로 한 번 더
  function IBL_ON() { return core.tuned('world3d.ibl', 1) ? true : false; }
  /** 얼마나 세게 섞나 — hemi.intensity(대략 1.4~1.7) 에 곱하는 비율.
   *  너무 세면 반사가 재질 색을 삼킨다(눈으로 보고 0.30으로 정함) */
  function IBL_SCALE() { return core.tuned('world3d.iblScale', 0.30); }
  function loadEnvironment() {
    if (!IBL_ON() || !T.RGBELoader || !T.PMREMGenerator || !renderer) { return; }
    var pmrem = new T.PMREMGenerator(renderer), A = global.DG.assets3d;   // W-0139 — 자체 하늘 C 로 구운 HDR(shared/assets/sky)이 먼저, 못 받으면 상대 경로로 한 번 더
    pmrem.compileEquirectangularShader();
    var go = function (src) { new T.RGBELoader().load(src, function (hdr) {
      var envMap = pmrem.fromEquirectangular(hdr).texture;
      if (scene) { scene.environment = envMap; }
      hdr.dispose(); pmrem.dispose();
    }, undefined, function () { if (src !== IBL_SRC) { go(IBL_SRC); } else { pmrem.dispose(); } }); };
    if (A && A.whenSettled) { A.whenSettled(function () { go(iblSrc()); }); } else { go(IBL_SRC); }
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

