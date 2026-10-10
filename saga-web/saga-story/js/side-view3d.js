/**
 * 사냥터 화면 — 3D 바탕 (PLAN.md Phase 1: 3D/2.5D 기반)
 * ---------------------------------------------------------------
 * side-view.js 가 하던 것 중 **세계**(하늘·뒷배경·바닥·발판·사람·몹)만 3D 로 세운다.
 * 조작 판정 · 미니맵 · 보스체력 · 데미지숫자 · 밧줄/문 표시는 그대로 side-view.js
 * (2D, #stage) 에 남는다 — 화면 위에 겹쳐 그린다.
 *
 * **좌표를 그대로 쓴다.** side.js 의 x·y 는 이미 픽셀이다. 새 단위를 만들지 않고
 * 카메라를 "그 픽셀이 그 자리에 뜨도록" 맞춘다 — 원근 카메라를 쓰지만 Z=0 평면에서는
 * 화면 픽셀과 1:1 이 되도록 거리(D)를 역산한다. 그래서 2D 오버레이(미니맵·문 이름표)가
 * 쓰는 camX 를 3D 도 그대로 받아 쓸 수 있다 — 좌표계를 두 벌 관리하지 않는다.
 *
 * 못 켜지면(WebGL 없음 · file:// 단독판) **조용히 2D 로 남는다** — 다른 판과 같은 규칙.
 */
(function (global) {
  'use strict';

  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }

  /** SAGA-DESIGN §6.1 — `new MeshLambertMaterial(opts)` 를 쓰던 모든 자리의
   *  대역. `world3d.toon`(기본 1)이 켜져 있으면 `toon3d.lambertLike()`가
   *  같은 옵션으로 3단 램프 MeshToonMaterial 을 만든다. `toon3d.js` 가 아직
   *  없거나(옛 캐시) three 가 없으면(자가진단) 예전 그대로 Lambert. */
  function LM(opts) {
    var TN = global.DG.toon3d;
    if (TN) { return TN.lambertLike(opts); }
    var t = three();
    return t ? new t.MeshLambertMaterial(opts) : null;
  }

  var renderer = null, scene = null, camera = null, ready = false;
  var W = 0, H = 0;
  var lastMood = null, worldGroup = null, actorGroup = null, dirLight = null, ambLight = null;
  var mountMesh = null, mountMeshId = null;   // 탈것(mount.js) 몸 — 탄 동안만 서고 내리면 치운다
  var pendingMesh = null, pendingMeshId = null, pendingT = 0;   // 전직으로 새로 조립 중인 주인공 몸(도착 전엔 옛 몸이 선다)
  var playerMesh = null, playerMeshId = null, enemyPool = [], npcPool = [], gatherPool = [], critterPool = [], chestMesh = null;
  var deadMeshes = {};   // run.dying 의 uid → 배우. 인덱스가 아니라 uid로 붙드므로
                          // 죽는 도중에 다른 적이 그 자리를 이어받지 않는다(side.js kill() 참고)
  var stageGen = 0;   // 사냥터가 바뀔 때마다 올린다 — 늦게 도착한 GLB 응답을 걸러낸다
  var lastDrawT = 0, frameDt = 0;   // 사람 GLB 의 몸짓(뼈대 애니메이션)을 굴리는 델타타임

  function hexOf(css) {
    if (!css) { return 0; }
    var n = parseInt(String(css).replace('#', ''), 16);
    return isNaN(n) ? 0 : n;
  }

  /** 바닥·발판 그림 — 사가마을 `village-view3d.js` 와 같은 요령(Kenney
   *  Roguelike/RPG Pack, CC0)이다. 색 한 장(`MeshLambertMaterial({color})`)이던
   *  것에 도트그림을 얹는다 — mood 별로 잔디·흙·돌을 고르고, `stg.ground` 색으로
   *  그대로 물들여 사냥터마다 색은 갈리게 둔다(부록 "코드로 그리지 말고
   *  에셋으로", 2026-09-04) */
  var GROUND_TEX_SRC = {
    forest: 'assets/sprites2d/tile_dirt.png',
    cave: 'assets/sprites2d/tile_stone.png',
    fire: 'assets/sprites2d/tile_stone.png',
    sky: 'assets/sprites2d/tile_grass.png'
  };
  var TILE_WORLD = 64;   // 타일 그림 한 장이 덮는 세계 좌표 폭(px) — 사람 키(≈60)와 비슷하게
  /** 바닥과 발판마다 반복 횟수가 다르므로 **매번 새 텍스처**를 받는다(16px
   *  그림이라 값싸고, 사냥터를 바꿀 때만 부른다 — 매 프레임이 아니다).
   *  같은 파일은 브라우저가 다시 내려받지 않는다 */
  function groundTexture(mood, repeatX, repeatY) {
    var t = three();
    var src = GROUND_TEX_SRC[mood] || GROUND_TEX_SRC.sky;
    if (!t) { return null; }
    var tex = new t.TextureLoader().load(src);
    tex.magFilter = t.NearestFilter;
    tex.minFilter = t.NearestFilter;
    tex.wrapS = tex.wrapT = t.RepeatWrapping;
    if (t.SRGBColorSpace) { tex.colorSpace = t.SRGBColorSpace; }
    tex.repeat.set(repeatX, repeatY);
    return tex;
  }

  /** 지오메트리·머티리얼·텍스처를 되돌린다 — `Object3D.remove()`는 참조만
   *  끊을 뿐 GPU 자원은 안 놓는다(Three.js 표준 동작). 이 파일이 지우는
   *  자리는 전부 **이 파일이 직접 만든 도형**(GLB 를 못 받았을 때의
   *  캡슐·원뿔 placeholder, 혹은 지형 프리미티브)뿐이라 안전하다 — GLB
   *  자체(모델이 도착한 뒤)는 다시 안 지운다(감사, 2026-09-08) */
  function disposeDeep(obj) {
    obj.traverse(function (n) {
      if (n.geometry) { n.geometry.dispose(); }
      if (n.material) {
        var mats = Array.isArray(n.material) ? n.material : [n.material];
        for (var i = 0; i < mats.length; i++) {
          if (mats[i].map) { mats[i].map.dispose(); }
          mats[i].dispose();
        }
      }
    });
  }

  /** 도형(원뿔·구)을 먼저 세워 두고, GLB 가 도착하면(같은 세대일 때만) 갈아 끼운다.
   *  `holder` 는 이미 화면에 있는 자리(위치)이고, 안에 든 도형만 바뀐다 */
  function swapIn(holder, kind, seed, heightPx, gen) {
    var A = global.DG.asset3d;
    if (!A) { return; }
    A.build(kind, seed, heightPx, function (model) {
      if (!model || gen !== stageGen) { return; }   // 실패했거나, 그새 사냥터가 또 바뀌었다
      while (holder.children.length) { var c = holder.children[0]; disposeDeep(c); holder.remove(c); }
      holder.add(model);
    });
  }

  function ON() {
    if (!global.DG || !global.DG.core) { return true; }
    return !!global.DG.core.tuned('sideView3d.on', 1);
  }

  /** three 자체가 없거나 WebGL 컨텍스트를 못 만들면 false — 손잡이(ON)와는 별개다 */
  function available() { return ready; }
  /** 지금 화면에 이게 그려지고 있나 — 손잡이 + 초기화 성공 둘 다 참이어야 한다 */
  function active() { return ready && ON(); }

  /** 상단 🧊 단추 — 손잡이만 뒤집는다. WebGL 자체가 안 되면(available() false) 못 켠다 */
  function toggle() {
    if (!available() || !global.DG.core) { return ON(); }
    global.DG.core.setTune('sideView3d.on', ON() ? 0 : 1);
    return ON();
  }

  /**
   * 그래픽 품질(PLAN 26·30절) — low/medium/high/auto. 다섯 판 형제 중
   * `saga-dungeon/js/dungeon3d.js`의 QUALITY_PRESET·오토튜닝을 본떴지만,
   * 이 판은 사냥터가 한 판씩 통째로 미리 지어지고 매 프레임 다시 짓는
   * buildField() 류가 없어(구성-측정-등급변경의 되먹임 고리 자체가 없다)
   * 그쪽의 빌드-프레임 제외·상승/하강 비대칭 쿨다운 같은 방어 장치는
   * 덜어냈다 — 단순한 이동평균 + 한 단계씩만 옮기는 규칙 정도면 충분하다.
   * 손잡이는 admin 의 균형 다이얼(core.tuned)이 아니라 **사용자 설정**
   * (core.save.settings.quality)이다 — 소리·진동과 같은 자리에 있다.
   */
  var QUALITY_PRESET = {
    low: { shadow: false, pixelRatio: 1 },
    medium: { shadow: true, pixelRatio: 1.25 },
    high: { shadow: true, pixelRatio: 1.75 }
  };
  function qSettings() {
    var c = global.DG.core;
    if (!c) { return { quality: 'auto' }; }
    var s = c.save.settings || (c.save.settings = {});
    if (s.quality !== 'low' && s.quality !== 'medium' && s.quality !== 'high' && s.quality !== 'auto') {
      s.quality = 'auto';
    }
    return s;
  }
  function quality() { return qSettings().quality; }
  function setQuality(v) {
    var ok = (v === 'low' || v === 'medium' || v === 'high' || v === 'auto');
    qSettings().quality = ok ? v : 'auto';
    if (global.DG.core) { global.DG.core.persist(); }
    return qSettings().quality;
  }

  /** 시작 등급을 기기 스펙으로 어림잡는다(코어 수·메모리·화면 픽셀·터치 여부) —
   *  사가나락의 deviceScore()와 같은 채점, 첫 프레임이 무거워 실측이 늦게
   *  시작되는 기기에서 처음부터 HIGH로 시작해 버벅이는 것을 막는다 */
  /** 채점만 하는 순수 함수 — 자가진단이 실제 기기 없이 이 값으로 바로 잰다
   *  (사가나락 dungeon3d.js 의 deviceScore(o) 와 같은 모양) */
  function deviceScore(o) {
    var cores = o.cores || 0, mem = o.mem || 0, px = o.px || 0;
    var s = 0;
    s += cores >= 8 ? 2 : (cores >= 4 ? 1 : (cores > 0 ? 0 : 1));
    s += mem >= 8 ? 2 : (mem >= 4 ? 1 : (mem > 0 ? 0 : 1));
    s += px > 4000000 ? -1 : (px > 1600000 ? 0 : 1);
    if (o.touch) { s -= 1; }
    return s;
  }
  /** 지금 이 기기 값을 읽어 온다 — deviceScore() 는 이 결과만 받아 채점한다 */
  function probeDevice() {
    var n = global.navigator || {}, sc = global.screen || {};
    return {
      cores: n.hardwareConcurrency || 0, mem: n.deviceMemory || 0,
      px: (sc.width || 0) * (sc.height || 0) * (global.devicePixelRatio || 1) * (global.devicePixelRatio || 1),
      touch: !!(('ontouchstart' in global) || (n.maxTouchPoints > 0))
    };
  }
  function startLevelFor(s) { return s >= 3 ? 'high' : (s >= 1 ? 'medium' : 'low'); }
  var LEVEL_ORDER = ['low', 'medium', 'high'];
  function levelIdx(l) { var i = LEVEL_ORDER.indexOf(l); return i < 0 ? 2 : i; }
  var autoLevel = startLevelFor(deviceScore(probeDevice()));   // AUTO 가 지금 고른 등급
  var perfEma = 16.7;                             // 프레임 시간 이동평균(ms)
  var lastLevelChangeT = 0;
  var LEVEL_COOLDOWN_MS = 2000;                   // 문턱 근처에서 매 프레임 안 뒤집히게

  /** 실측 ms 하나만 보면 어느 등급이 맞는지 — 순수 함수라 자가진단이 프레임 없이 본다 */
  function autoLevelFor(ms) {
    if (ms > 33) { return 'low'; }
    if (ms > 20) { return 'medium'; }
    return 'high';
  }
  function stepTowards(cur, ideal) {
    var ci = levelIdx(cur), ii = levelIdx(ideal);
    if (ii > ci) { return LEVEL_ORDER[ci + 1]; }
    if (ii < ci) { return LEVEL_ORDER[ci - 1]; }
    return cur;
  }
  /** 매 draw() 가 실제 프레임 간격(ms)을 넘겨준다 — 탭 전환 등으로 튄 값은
   *  draw() 가 이미 0~250ms 로 잘라 넘기므로 여기서는 그대로 평균에 얹는다 */
  function updatePerf(dtMs) {
    if (!(dtMs > 0)) { return; }
    /* 프레임 상한(game.js frameGapMs — 시트 30·전체 창 10fps)이 걸리면 간격이 늘 길다 — 그대로 재면 멀쩡한 폰도 LOW 로
       떨어진다. 상한 간격으로 나눠 60fps 기준으로 되돌리고, 10fps 로 묶인 동안은 아예 안 잰다 */
    var G = global.DG.game, cap = G && G.frameGapMs ? G.frameGapMs() : 0;
    if (cap >= 50) { return; }
    if (cap > 16.7) { dtMs = dtMs * 16.7 / cap; }
    perfEma = perfEma * 0.9 + dtMs * 0.1;
    var next = stepTowards(autoLevel, autoLevelFor(perfEma));
    var now = Date.now();
    if (next !== autoLevel && now - lastLevelChangeT >= LEVEL_COOLDOWN_MS) {
      autoLevel = next;
      lastLevelChangeT = now;
    }
  }
  /** quality() 가 low/medium/high 로 고정돼 있으면 그걸, 'auto' 면 방금 잰 등급 */
  function effectiveLevel() {
    var q = quality();
    return (q === 'low' || q === 'medium' || q === 'high') ? q : autoLevel;
  }
  var lastAppliedLevel = null;
  /** 등급이 실제로 바뀐 프레임에서만 렌더러를 건드린다 — 매 프레임 setPixelRatio 를
   *  부르면(값이 같아도) 내부적으로 캔버스 크기를 다시 잰다, 공짜가 아니다 */
  function applyQualityIfChanged() {
    var lv = effectiveLevel();
    if (lv === lastAppliedLevel || !renderer) { return; }
    lastAppliedLevel = lv;
    var pr = QUALITY_PRESET[lv];
    renderer.shadowMap.enabled = pr.shadow;
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, pr.pixelRatio));
    if (dirLight) { dirLight.castShadow = pr.shadow; }
  }

  /* 후처리(PLAN 24절, `post3d.js`)는 `global.DG.perf.tier().key`(대문자
     HIGH/MEDIUM/LOW)로 등급을 묻는다 — saga-dungeon 은 실제 `perf.js`가 있지만
     이 판은 그래픽 품질을 `effectiveLevel()`(소문자) 하나로 이미 정하고 있으니
     새 시스템을 만들지 않고 다리만 놓는다(dungeon3d.js 가 쓴 것과 같은 패턴) */
  if (!global.DG.perf) {
    global.DG.perf = { tier: function () { return { key: effectiveLevel().toUpperCase() }; } };
  }

  function init(canvas) {
    var Tc = three();
    if (!Tc || !canvas) { ready = false; return false; }
    try {
      renderer = new Tc.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 1.75));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = Tc.PCFSoftShadowMap;
    } catch (err) {
      ready = false; return false;               // 오래된 기기·file:// — 조용히 2D 로
    }
    /* 컨텍스트가 끊기면(메모리 부족 등, 실기기에서 흔하다) JS 에러 없이 캔버스만
       불투명 검정으로 굳는다 — alpha:false 라 지워진 드로잉 버퍼가 그렇게 합성된다.
       듣지 않으면 화면이 새까만 채로 영영 안 돌아온다. ready 를 내려 2D 로 떨어뜨리고
       캔버스도 바로 숨긴다(다음 draw() 를 기다리면 그 프레임 동안 검게 보인다) */
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      ready = false;
      canvas.style.display = 'none';
    });
    scene = new Tc.Scene();
    camera = new Tc.PerspectiveCamera(35, 1, 1, 6000);

    ambLight = new Tc.AmbientLight(0xffffff, 0.7);
    scene.add(ambLight);
    dirLight = new Tc.DirectionalLight(0xffffff, 1.0);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    /* 사냥터가 2200~3400 폭이라 원점에 못박아 두면 플레이어가 조금만 걸어도
       그림자 카메라 범위(±700) 밖으로 나가 그림자가 사라진다 — 매 프레임
       플레이어를 따라간다(그림자 카메라만, 조명 각도는 그대로) */
    dirLight.shadow.camera.left = -700; dirLight.shadow.camera.right = 700;
    dirLight.shadow.camera.top = 700; dirLight.shadow.camera.bottom = -700;
    dirLight.shadow.camera.near = 10; dirLight.shadow.camera.far = 1400;
    scene.add(dirLight);
    scene.add(dirLight.target);

    worldGroup = new Tc.Group();          // 지형(사냥터 바뀌면 통째로 다시 세운다)
    scene.add(worldGroup);
    actorGroup = new Tc.Group();          // 사람·몹(사냥터가 바뀌어도 그대로 둔다)
    scene.add(actorGroup);

    /* 후처리(PLAN 24절, saga-dungeon 에서 이식) — 렌더러를 만든 직후, 여기서
       한 번만 켠다(post3d.js 가 톤매핑을 여기서 걸고 다시 안 만진다) */
    if (global.DG.post3d) { global.DG.post3d.init(Tc, renderer); }

    ready = true;
    resize();
    return true;
  }

  /** side-view.js 가 묻는 것은 "지금 3D 로 그려지고 있나" — 손잡이를 끄면 여기서도 꺼진다 */
  function ready_() { return active(); }

  function resize() {
    if (!ready) { return; }
    W = global.innerWidth; H = global.innerHeight;
    /* updateStyle 을 true 로 둔다(3번째 인자 기본값) — false 로 두면 캔버스에
       CSS 폭/높이가 안 실려서, 렌더 해상도(W*pixelRatio)가 그대로 캔버스의
       "고유 크기"가 된다. #stage3d 는 position:fixed 인 교체 요소(canvas)라
       고유 크기가 있으면 inset:0 을 무시하고 그 크기로 뜬다 — 화면보다 커진
       캔버스의 왼쪽 위 한 귀퉁이만 보이고 나머지는 새까맣게 보이던 원인이 이거였다 */
    renderer.setSize(W, H, true);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    if (global.DG.post3d) { global.DG.post3d.resize(); }
  }

  /** Z=0 평면에서 화면 세로 H(px) 이 정확히 보이도록 거리(D)를 역산한다 */
  function camDist() {
    var vfov = camera.fov * Math.PI / 180;
    return (H / 2) / Math.tan(vfov / 2);
  }

  function moodLight(mood, town) {
    if (mood === 'cave') { return { sky: 0x2b2436, amb: 0.5, dir: 0.55, dirCol: 0x8fa2ff, fog: 900 }; }
    if (mood === 'fire') { return { sky: 0x3a1410, amb: 0.55, dir: 0.9, dirCol: 0xff8a4a, fog: 1400 }; }
    if (mood === 'forest') { return { sky: 0x5fa06a, amb: 0.75, dir: 0.95, dirCol: 0xfff6d8, fog: 1800 }; }
    /* 마을의 따뜻한 조명(PLAN 22절) — town:true 인 사냥터(mood 는 'sky' 그대로)만
       하늘·직사광을 노을빛으로 데운다. 색조만 바꾸고 밝기(amb/dir)는 들판과 맞춰
       마을이 유독 어둡거나 밝아 보이지 않게 한다 */
    if (town) { return { sky: 0xe8b878, amb: 0.85, dir: 1.0, dirCol: 0xffdca0, fog: 2200 }; }
    return { sky: 0x79c3e8, amb: 0.85, dir: 1.05, dirCol: 0xfff6d8, fog: 2400 };            // field
  }

  /** 후처리(PLAN 24절)의 `post3d.lookAt(alt, weather)`가 바라는 "해 고도"를
   *  이 판의 무드로 지어낸다 — 이 판에는 해도 날씨도 없다. cave 는 어두운
   *  무드라 밤처럼(블룸이 세지고 살짝 식는다), fire 는 노을 결(gold)이 가장
   *  강한 지점(alt=0.10)에 둬 불타는 골짜기의 따뜻한 빛을 살린다, 나머지
   *  (forest·field·town, moodLight 가 이미 따로 데운다)는 맑은 대낮으로 둔다 */
  function postAlt(mood) {
    if (mood === 'cave') { return -0.6; }
    if (mood === 'fire') { return 0.10; }
    return 0.9;
  }

  /* ── W-0161 시차 층 — 깊이·자리 계산은 `side-layers3d.js`(진단이 본다), 여기는 그림만. 층 그림이 있는 장면은 그 그림이
     대신하는 도형 산·먼 나무를 안 세우고, 인물 앞 z +36 에 낮은 풀(deco grass, 12~18px) 한 줄로 발을 살짝 가린다 ── */
  function SL() { return global.DG.sideLayers3d; }
  function regionOf(stg) { return SL() ? SL().regionOf(stg) : null; }
  function PARALLAX() { return SL() ? SL().on() : false; }
  var layerMeta = {};
  /** 층 셋을 세운다 — layers.json 은 한 번만 받는다(비동기, 늦게 오면 그 세대만) */
  function buildLayers(Tc, stg) {
    var rg = regionOf(stg), gen = stageGen, base = stg.floor, D = camDist();
    if (!rg || !global.fetch) { return; }
    var M = global.DG.cfg.mode2d, dir = M.bgBase || 'assets/web2d/bg/';
    function make(meta) {
      if (gen !== stageGen || !meta) { return; }
      ['far', 'mid', 'near'].forEach(function (name) {
        var L = meta[name];
        if (!L) { return; }
        var r = SL().layerRect(name, L, base, H, D), wide = stg.width + W * 2 * r.f + 400;
        var tx = new Tc.TextureLoader().load(dir + rg + '_' + name + '.webp');
        tx.wrapS = Tc.MirroredRepeatWrapping; tx.repeat.x = wide / r.unitW;
        if (Tc.SRGBColorSpace) { tx.colorSpace = Tc.SRGBColorSpace; }
        var m = new Tc.Mesh(new Tc.PlaneGeometry(wide, Math.max(1, r.top - r.bot)),
          new Tc.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
        m.position.set(stg.width / 2, (r.top + r.bot) / 2, r.z);
        m.userData.layer = name;
        worldGroup.add(m);
      });
    }
    if (layerMeta[rg]) { make(layerMeta[rg]); return; }
    global.fetch(dir + rg + '.layers.json').then(function (q) { return q.ok ? q.json() : null; })
      .then(function (j) { if (j) { layerMeta[rg] = j; } make(j); })['catch'](function () { /* 없으면 옛 도형 그대로 */ });
  }

  /** 지형지물 — 아직 GLB 를 못 받는 자리라 도형으로 세운다(다른 판이 GLB 로 가기 전에
   *  거치던 자리와 같다). 나중에 CC0 모델을 구하면 이 함수만 바꾸면 된다 */
  function buildScenery(Tc, stg) {
    var mood = stg.mood, i, m;
    /* 횃불 Point Light(PLAN 22절) — 사냥터 하나당 최대 3개로 예산을 두고(모바일
       실시간 광원 과용 금지), 저사양(effectiveLevel low)에서는 시각(도형)만 남기고
       실제 광원은 아예 안 켠다 */
    var torchBudget = effectiveLevel() === 'low' ? 0 : 3;
    var farMat = LM({ color: mood === 'forest' ? 0x2c5230
      : mood === 'cave' ? 0x1c1622 : mood === 'fire' ? 0x241010 : 0x8fc48f });
    var nearMat = LM({ color: mood === 'forest' ? 0x3a6b3a
      : mood === 'cave' ? 0x352a3f : mood === 'fire' ? 0x3a1c14 : 0x6fae6f });

    var gen = stageGen, layered = !!regionOf(stg);   // W-0161 — 층 그림이 있으면 산·먼 나무는 그림이 대신한다
    /* 나무(GLB 로 갈리면 tree:near/tree:far, 다는 자리는 지금 세운 원뿔 높이와 맞춘다) */
    function trunk(x, z, h, mat, far) {
      if (layered && far) { return; }
      var holder = new Tc.Group();
      holder.position.set(x, 0, z);
      var trunkMat = LM({ color: 0x4a3524 });
      var tG = new Tc.Mesh(new Tc.CylinderGeometry(3, 4, h * 0.32, 6), trunkMat);
      tG.position.set(0, h * 0.16, 0);
      holder.add(tG);
      var leaf = new Tc.Mesh(new Tc.ConeGeometry(h * 0.34, h * 0.8, 7), mat);
      leaf.position.set(0, h * 0.32 + h * 0.4, 0);
      leaf.castShadow = true;
      holder.add(leaf);
      worldGroup.add(holder);
      swapIn(holder, far ? 'tree:far' : 'tree:near', x + ':' + z, h * 1.1, gen);
    }
    /* 종유석 — 바닥에 선 것만 GLB 바위로 갈린다(천장에 매달린 것은 뒤집힌 바위로는
       안 보이니 도형 그대로 둔다) */
    function stalactite(x, z, h, up) {
      var mat = LM({ color: 0x453a52 });
      var holder = new Tc.Group();
      holder.position.set(x, 0, z);
      var c = new Tc.Mesh(new Tc.ConeGeometry(h * 0.22, h, 6), mat);
      c.position.set(0, up ? 560 - h / 2 : h / 2, 0);
      if (up) { c.rotation.x = Math.PI; }
      holder.add(c);
      worldGroup.add(holder);
      if (!up) { swapIn(holder, 'rock', x + ':' + z, h * 0.9, gen); }
    }
    function hill(x, z, r, mat) {
      if (layered) { return; }
      var holder = new Tc.Group();
      holder.position.set(x, 0, z);
      var g = new Tc.Mesh(new Tc.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      g.position.set(0, -r * 0.35, 0);
      holder.add(g);
      worldGroup.add(holder);
      swapIn(holder, 'hill', x + ':' + z, r * 0.7, gen);
    }
    function flame(x, z, h) {
      var mat = new Tc.MeshBasicMaterial({ color: 0xff8a3c, transparent: true, opacity: 0.55 });
      var c = new Tc.Mesh(new Tc.ConeGeometry(h * 0.22, h, 6), mat);
      c.position.set(x, h / 2, z);
      worldGroup.add(c);
      if (torchBudget > 0) {
        torchBudget--;
        var lt = new Tc.PointLight(0xff8a3c, 1.4, h * 10, 2);
        lt.position.set(x, h * 0.6, z);
        worldGroup.add(lt);
      }
    }
    /** 횃불(PLAN 22절) — 동굴·마을에 세운다. 도형(자루+불머리)은 예산과 무관하게
     *  항상 서고, 실제 PointLight 만 torchBudget 이 남았을 때 켠다 */
    function torch(x, z, h) {
      var holder = new Tc.Group();
      holder.position.set(x, 0, z);
      var pole = new Tc.Mesh(new Tc.CylinderGeometry(2.4, 2.4, h * 0.75, 5),
        LM({ color: 0x3a2a1a }));
      pole.position.set(0, h * 0.38, 0);
      holder.add(pole);
      var head = new Tc.Mesh(new Tc.ConeGeometry(h * 0.18, h * 0.32, 6),
        new Tc.MeshBasicMaterial({ color: 0xffab54 }));
      head.position.set(0, h * 0.75 + h * 0.16, 0);
      holder.add(head);
      worldGroup.add(holder);
      if (torchBudget > 0) {
        torchBudget--;
        var lt = new Tc.PointLight(0xffab54, 1.5, h * 10, 2);
        lt.position.set(0, h * 0.9, 0);
        holder.add(lt);
      }
    }
    /** 발밑 밀도(PLAN 6·7절, 2026-09-04) — 배경 지형지물(z -80~-520)과 달리
     *  사람이 걷는 깊이(z=0) 바로 뒤(z -30~-70)에 놓는 작은 식생. 판정에 닿지
     *  않고, GLB 가 오기 전엔 작은 도형(원뿔)으로 서 있는다 */
    function deco(x, z, h, kind, mat) {
      var holder = new Tc.Group();
      holder.position.set(x, 0, z);
      var g = new Tc.Mesh(new Tc.ConeGeometry(h * 0.32, h, 5), mat);
      g.position.set(0, h / 2, 0);
      holder.add(g);
      worldGroup.add(holder);
      swapIn(holder, kind, x + ':' + z, h, gen);
    }
    /** 마을 정취(PLAN 3절, 2026-09-04) — town:true 인 사냥터만 부른다. 집은
     *  나무·언덕과 같은 배경 깊이(z -180~-260)에, 우물·울타리는 사람이 걷는
     *  깊이 가까이(z -20~-70) 선다 */
    function house(x, z, h, seed) {
      var wallMat = LM({ color: 0x8a6a4a });
      var roofMat = LM({ color: 0x4a3020 });
      var holder = new Tc.Group();
      holder.position.set(x, 0, z);
      var box = new Tc.Mesh(new Tc.BoxGeometry(h * 0.62, h * 0.68, h * 0.5), wallMat);
      box.position.set(0, h * 0.34, 0);
      holder.add(box);
      var roof = new Tc.Mesh(new Tc.ConeGeometry(h * 0.48, h * 0.42, 4), roofMat);
      roof.position.set(0, h * 0.68 + h * 0.21, 0);
      roof.rotation.y = Math.PI / 4;
      holder.add(roof);
      worldGroup.add(holder);
      swapIn(holder, 'house', x + ':' + z + ':' + seed, h, gen);
    }
    function well(x, z, h) {
      var mat = LM({ color: 0x8a8a8a });
      var holder = new Tc.Group();
      holder.position.set(x, 0, z);
      var c = new Tc.Mesh(new Tc.CylinderGeometry(h * 0.42, h * 0.42, h, 8), mat);
      c.position.set(0, h / 2, 0);
      holder.add(c);
      worldGroup.add(holder);
      swapIn(holder, 'well', x + ':' + z, h, gen);
    }
    function fence(x, z, h) {
      var mat = LM({ color: 0x6a4a30 });
      var holder = new Tc.Group();
      holder.position.set(x, 0, z);
      var b = new Tc.Mesh(new Tc.BoxGeometry(h * 1.7, h, 5), mat);
      b.position.set(0, h / 2, 0);
      holder.add(b);
      worldGroup.add(holder);
      swapIn(holder, 'fence', x + ':' + z, h, gen);
    }

    var span = stg.width + 800;
    if (mood === 'forest') {
      for (i = 0, m = -200; m < span; i++, m += 260) { trunk(m, -260, 170 + (i % 3) * 40, farMat, true); }
      for (i = 0, m = -140; m < span; i++, m += 190) { trunk(m, -90, 120 + (i % 3) * 26, nearMat, false); }
    } else if (mood === 'cave') {
      for (i = 0, m = -100; m < span; i++, m += 220) {
        stalactite(m, -140 - (i % 2) * 60, 90 + (i % 4) * 40, true);
        stalactite(m + 90, -160, 70 + (i % 3) * 30, false);
      }
      for (i = 0, m = -40; m < span; i++, m += 480) { torch(m, -40, 60); }
    } else if (mood === 'fire') {
      for (i = 0, m = -260; m < span; i++, m += 340) { hill(m, -420, 220 + (i % 3) * 40, farMat); }
      for (i = 0, m = -160; m < span; i++, m += 210) { flame(m, -80, 90 + (i % 3) * 30); }
    } else if (stg.town) {
      for (i = 0, m = -300; m < span; i++, m += 420) { hill(m, -520, 260 + (i % 3) * 50, farMat); }
      for (i = 0, m = -140; m < span; i++, m += 360) { house(m, -200 - (i % 2) * 50, 170 + (i % 3) * 30, i); }
      for (i = 0, m = -180; m < span; i++, m += 420) { trunk(m, -90, 90 + (i % 3) * 16, nearMat); }
      well(Math.round(span / 2) - 400, -55, 36);
      for (i = 0, m = 60; m < span - 60; i++, m += 150) { fence(m, -22, 24); }
      for (i = 0, m = -100; m < span; i++, m += 520) { torch(m, -40, 55); }
    } else {
      for (i = 0, m = -300; m < span; i++, m += 420) { hill(m, -520, 260 + (i % 3) * 50, farMat); }
      for (i = 0, m = -180; m < span; i++, m += 280) { hill(m, -220, 150 + (i % 3) * 30, nearMat); }
      for (i = 0, m = -220; m < span; i++, m += 300) { trunk(m, -60, 90 + (i % 3) * 20, nearMat); }
    }

    /* 지역별 다른 식생(PLAN 6절) — 숲·초원·마을은 풀·꽃·덤불, 굴혈은 이끼 바위,
       불타는 골짜기는 그대로 민둥(식생 없음, 기존 규칙과 같다) */
    if (mood !== 'cave' && mood !== 'fire') {
      var grassMat = LM({ color: mood === 'forest' ? 0x3d7a3a : 0x6fae4a });
      var bushMat = LM({ color: mood === 'forest' ? 0x2f5c30 : 0x4f8f45 });
      for (i = 0, m = -60; m < span; i++, m += 95) { deco(m, -30 - (i % 3) * 15, 18 + (i % 3) * 6, 'grass', grassMat); }
      for (i = 0, m = -120; m < span; i++, m += 260) { deco(m, -50, 24 + (i % 2) * 8, 'flower', grassMat); }
      for (i = 0, m = -180; m < span; i++, m += 340) { deco(m, -70, 40 + (i % 2) * 12, 'bush', bushMat); }
      if (layered) { for (i = 0, m = -40; m < span; i++, m += 70 + (i % 3) * 25) { deco(m, SL().FRONT_Z, 12 + (i % 3) * 3, 'grass', grassMat); } }   // W-0161 앞 풀 — 발을 살짝 가린다
    } else if (mood === 'cave') {
      for (i = 0, m = -140; m < span; i++, m += 300) { deco(m, -40, 22 + (i % 3) * 8, 'moss_rock', LM({ color: 0x453a52 })); }
    }
  }

  function rebuildStage(stg) {
    var Tc = three();
    stageGen++;   // 늦게 도착한 GLB 응답이 지난 세대의 지형에 잘못 꽂히지 않게 한다
    while (worldGroup.children.length) { var wc = worldGroup.children[0]; disposeDeep(wc); worldGroup.remove(wc); }
    for (var dk in deadMeshes) { actorGroup.remove(deadMeshes[dk]); disposeDeep(deadMeshes[dk]); }
    deadMeshes = {};

    var L = moodLight(stg.mood, stg.town); if (stg.town && SL()) { L = SL().townFog(L, global.DG.core.tuned('story3d.townFog', 0.4)); }   // W-0145 마을 안개 — 계산은 side-layers3d
    scene.background = (global.DG.toon3d && global.DG.toon3d.skyBackground) ? global.DG.toon3d.skyBackground(L.sky) : new Tc.Color(L.sky);   // 하늘 그라디언트(2026-09-23, 아래는 안개색 그대로)
    scene.fog = new Tc.Fog(L.sky, L.fog * (L.nearK || 0.35), L.fog);
    ambLight.intensity = L.amb;
    dirLight.intensity = L.dir;
    dirLight.color.setHex(L.dirCol);

    var groundSpanX = stg.width + 1600, groundSpanZ = 900;
    var groundMat = LM({
      color: stg.ground,
      map: groundTexture(stg.mood, groundSpanX / TILE_WORLD, groundSpanZ / TILE_WORLD)
    });
    var ground = new Tc.Mesh(new Tc.PlaneGeometry(groundSpanX, groundSpanZ), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(stg.width / 2, 0, -80);
    ground.receiveShadow = true;
    worldGroup.add(ground);

    var i, pl;
    for (i = 0; i < stg.plats.length; i++) {
      pl = stg.plats[i];
      var pw = pl[2], py = stg.floor - pl[1];
      var platMat = LM({
        color: stg.ground,
        map: groundTexture(stg.mood, Math.max(1, pw / TILE_WORLD), 46 / TILE_WORLD)
      });
      var box = new Tc.Mesh(new Tc.BoxGeometry(pw, 16, 46), platMat);
      box.position.set(pl[0] + pw / 2, py - 8, 0);
      box.receiveShadow = true; box.castShadow = false;
      worldGroup.add(box);
    }

    buildScenery(Tc, stg);
    buildLayers(Tc, stg);
    rebuildNpcs(Tc, stg);
    rebuildGathers(Tc, stg);
    rebuildCritters(Tc, stg);
    rebuildChest(Tc);
    buildForagePatch(Tc);
    lastMood = stageKey(stg);
  }
  function stageKey(stg) { return stg.mood + '|' + stg.width + '|' + (stg.key || '') + '|' + H + '|' + (PARALLAX() ? 1 : 0); }

  /** 보물상자(PLAN 11절) — `run.chest` 가 있을 때만(사냥터마다 한 자리, 이미
   *  열었으면 `run.gathers` 처럼 알아서 숨는다) 세운다. z 는 채집물과 같은
   *  깊이 — 걷다 지나치면 자연히 눈에 든다 */
  function rebuildChest(Tc) {
    if (chestMesh) { actorGroup.remove(chestMesh); disposeDeep(chestMesh); chestMesh = null; }
    var run = global.DG.side.raw();
    if (!run || !run.chest) { return; }
    var h = 30;
    var holder = new Tc.Group();
    holder.position.set(run.chest.x, 0, -30);
    var prim = new Tc.Mesh(new Tc.BoxGeometry(h * 0.7, h * 0.5, h * 0.5),
      LM({ color: 0xc89a3c }));
    prim.position.set(0, h * 0.25, 0);
    holder.add(prim);
    actorGroup.add(holder);
    swapIn(holder, 'chest', 'chest:' + run.chest.x, h, stageGen);
    chestMesh = holder;
  }

  /** 채집 보너스 지역(PLAN 11절) — `run.forage` 구간 바닥에 옅은 초록 반투명
   *  판을 깐다. `worldGroup`에 얹으므로(자체 dispose 없음) 이 함수를 부르는
   *  `rebuildStage()`가 사냥터를 바꿀 때마다 통째로 지우고 다시 그린다 —
   *  chest처럼 따로 지우지 않아도 된다. 판정에는 안 닿는 화면 층이다 */
  function buildForagePatch(Tc) {
    var run = global.DG.side.raw();
    if (!run || !run.forage) { return; }
    var w = run.forage.x2 - run.forage.x1;
    var mat = new Tc.MeshBasicMaterial({ color: 0x8cf28c, transparent: true, opacity: 0.28, depthWrite: false });
    var patch = new Tc.Mesh(new Tc.PlaneGeometry(w, 160), mat);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set((run.forage.x1 + run.forage.x2) / 2, 0.3, -60);
    worldGroup.add(patch);
  }

  var CRITTER_FLEE_R = 160, CRITTER_FLEE_SPD = 140, CRITTER_WANDER_SPD = 26;

  /** 비전투 동물(PLAN 9절) — 안 싸운다. 들판·숲(mood sky/forest, town 아님)에만
   *  세운다. 뼈대 애니메이션은 안 걸고(사슴·여우 GLB의 클립 이름을 이 판이
   *  아직 안 다룬다) 그냥 미끄러지듯 움직인다 — 플레이어가 가까우면 달아나고,
   *  아니면 제자리 둘레를 어슬렁댄다. 사냥·판정에는 전혀 안 닿는다 */
  function rebuildCritters(Tc, stg) {
    for (var j = 0; j < critterPool.length; j++) { actorGroup.remove(critterPool[j]); disposeDeep(critterPool[j]); }
    critterPool = [];
    if (stg.town || stg.mood === 'cave' || stg.mood === 'fire') { return; }
    var kinds = ['critter:deer', 'critter:fox'];
    for (var i = 0; i < kinds.length; i++) {
      var x = 300 + (stg.width - 600) * ((i + 1) / (kinds.length + 1));
      var holder = new Tc.Group();
      var h = 40;
      holder.position.set(x, 0, -35 - i * 20);
      var prim = new Tc.Mesh(new Tc.CapsuleGeometry(h * 0.2, h * 0.4, 3, 6),
        LM({ color: 0x8a6a45 }));
      prim.position.set(0, h * 0.36, 0);
      holder.add(prim);
      holder.userData.anchor = x;
      holder.userData.phase = i * 2.1;
      actorGroup.add(holder);
      swapIn(holder, kinds[i], kinds[i] + ':' + x, h, stageGen);
      critterPool.push(holder);
    }
  }

  /** 필드 채집물(PLAN 10절) — `side.js` 의 `run.gathers`(살았는지·자리)와
   *  같은 순서로 세운다. GLB 종류는 `sideData.GATHERS[kind].model` 이
   *  가리키는, 이미 있는 자연물 모델(꽃·덤불·이끼바위·바위) 중 하나다 */
  function rebuildGathers(Tc, stg) {
    for (var j = 0; j < gatherPool.length; j++) { actorGroup.remove(gatherPool[j]); disposeDeep(gatherPool[j]); }
    gatherPool = [];
    var list = stg.gathers || [];
    var GD = global.DG.sideData && global.DG.sideData.GATHERS;
    if (!GD) { return; }
    for (var i = 0; i < list.length; i++) {
      var x = list[i][0], info = GD[list[i][1]];
      if (!info) { continue; }
      var h = 26;
      var holder = new Tc.Group();
      holder.position.set(x, 0, -40);
      var prim = new Tc.Mesh(new Tc.ConeGeometry(h * 0.3, h, 5), LM({ color: 0x8fae4a }));
      prim.position.set(0, h / 2, 0);
      holder.add(prim);
      actorGroup.add(holder);
      swapIn(holder, info.model, x + ':' + list[i][1], h, stageGen);
      gatherPool.push(holder);
    }
  }

  /** 마을 사람(PLAN 3·8·16절) — `stg.npcs`([x, key], side.js `run.npcs` 와 같은
   *  자료)가 있는 자리에 세운다. **말을 걸 수 있는 자리와 화면 위 자리가 이제
   *  같은 표에서 나온다** — 판정(TALK_R)은 side.js 가, 서성이는 몸짓만 여기서
   *  덧그린다. `actorShell` 을 그대로 빌려 쓰므로 사람 GLB(Quaternius) 가 이미
   *  하듯 못 받으면 조용히 도형 사람으로 남는다 */
  function rebuildNpcs(Tc, stg) {
    for (var j = 0; j < npcPool.length; j++) { actorGroup.remove(npcPool[j]); disposeDeep(npcPool[j]); }
    npcPool = [];
    var list = stg.npcs || [];
    var NPC_COLORS = ['#c8b090', '#b7c3d8', '#d8b7a0', '#a8c8a0'];
    for (var i = 0; i < list.length; i++) {
      var anchorX = list[i][0];
      var nt = global.DG.sideData && global.DG.sideData.NPC_TALK[list[i][1]];
      /* 2026-09-25 — 몸·옷빛을 자리 번호(i)가 아니라 **역할 키**로 고른다. 전에는 'npc'+i 라 같은 촌로·장사치가
         마을마다 다른 몸으로 섰다(tools/asset-audit/CHARACTER_UNIQUENESS.md) */
      var role = list[i][1], rh = 0, ri;
      for (ri = 0; ri < role.length; ri++) { rh = (rh * 31 + role.charCodeAt(ri)) >>> 0; }
      var npc = actorShell(Tc, 'human', NPC_COLORS[rh % NPC_COLORS.length], false, 'npc:' + role, false, nt && nt.model);
      npc.userData.npcAnchor = anchorX;
      npc.userData.npcPhase = i * 1.7;
      place(npc, anchorX, 0, 1);
      npc.position.z = -20 - (i % 2) * 15;
      actorGroup.add(npc);
      npcPool.push(npc);
    }
  }

  /** 도형(원뿔·구가 아니라 캡슐+구) 사람 — GLB 가 오기 전까지, 혹은 GLB 가 실패하면
   *  끝까지 이 모습이다 */
  function humanoid(Tc, color, boss) {
    var g = new Tc.Group();
    var scale = boss ? 1.9 : 1;
    var bodyMat = LM({ color: color || '#c8b090' });
    var body = new Tc.Mesh(new Tc.CapsuleGeometry(11 * scale, 30 * scale, 4, 8), bodyMat);
    body.position.y = 26 * scale;
    body.castShadow = true;
    g.add(body);
    var head = new Tc.Mesh(new Tc.SphereGeometry(8.5 * scale, 10, 8), bodyMat);
    head.position.y = 50 * scale;
    head.castShadow = true;
    g.add(head);
    g.userData.body = body; g.userData.head = head; g.userData.baseColor = new Tc.Color(color || '#c8b090');
    return g;
  }

  /**
   * 배우 하나 — 도형(캡슐)을 먼저 세워 두고, GLB 가 도착하면 갈아 끼운다
   * (지형지물의 `swapIn` 과 같은 요령). `kind` 가 'beast' 면 홑 GLB(늑대·소)로,
   * 아니면 사람 조합(`asset3d.buildHero`)으로 간다.
   *
   * @param color  이 배우의 원래 빛깔 — 도형 표면·사람 GLB 옷의 물들임에 쓴다.
   *               짐승은 제 털빛이 맞으므로 안 물들인다
   */
  function actorShell(Tc, kind, color, boss, seed, big, model) {
    var shell = new Tc.Group();
    var prim = humanoid(Tc, color, boss);
    shell.add(prim);
    shell.userData.body = prim.userData.body;
    shell.userData.head = prim.userData.head;
    shell.userData.baseColor = prim.userData.baseColor;

    /* big — 탱커형(PLAN 13절)·코끼리병을 잡졸보다 눈에 띄게 키운다.
       도형(placeholder) 크기는 그대로 두고(humanoid() 는 boss 만 본다)
       GLB 가 도착했을 때만 커진다 — 과한 손질은 아니다 */
    var heightPx = (boss ? 1.9 : (big ? 1.3 : 1)) * 58;   // 도형 사람의 정수리 높이(50*scale)와 얼추 맞춘다
    function swapActorIn(model) {
      if (!model) { return; }   // GLB 를 못 받았다 — 도형 그대로 남는다
      while (shell.children.length) { var sc = shell.children[0]; disposeDeep(sc); shell.remove(sc); }
      shell.add(model);
      shell.userData.body = null; shell.userData.head = null;   // 이제 도형 물들임은 안 쓴다
      shell.userData.mixer = model.userData.mixer || null;
      shell.userData.actions = model.userData.actions || null;
      shell.userData.clipMap = model.userData.clipMap || null;
      shell.userData.anim = null;
      var A = global.DG.asset3d;
      shell.userData.flashMats = A && A.ownAllMat ? A.ownAllMat(model) : null;
      shell.userData.glb = true;
      shell.userData.olColor = null;   // 새 몸 — 외곽선 색(gearOutline)을 다시 입힌다
    }
    var A = global.DG.asset3d;
    if (A) {
      /* 세 시대 사람·적(PLAN §5-12) — 표 키(`foe:*`·`folk:*`)가 있으면 제 클립 든 그 몸으로 선다(물들이지 않는다) */
      if (model && A.buildModel) { A.buildModel(model, heightPx, swapActorIn); }
      else if (kind === 'beast') { A.build(big ? 'beast_big' : 'beast', seed, heightPx, swapActorIn); }
      else { A.buildHero(seed, heightPx, hexOf(color), swapActorIn); }
    }
    return shell;
  }

  /**
   * 장비 세트 등급 → 주인공 외곽선 색(PLAN §6 성장 가시화, 2026-09-23). 열 부위 중 절반이
   * 상급·희귀·영웅·전설에 닿으면 테두리가 그 등급 색으로 물든다(`gear.setGrade`). 도형(캡슐)엔
   * 외곽선이 없어 GLB 가 도착한 뒤에만, 색이 바뀐 프레임에만 재질을 갈아 끼운다
   */
  function applyGearOutline(shell) {
    var TN = global.DG.toon3d, G = global.DG.gear;
    if (!shell.userData.glb || !TN || !TN.recolorOutlines || !G || !G.setGrade) { return; }
    var g = G.setGrade();
    var col = TN.gradeTint(g.color, g.rank);
    if (shell.userData.olColor === col) { return; }
    TN.recolorOutlines(shell, col);
    shell.userData.olColor = col;
  }

  function place(mesh, x, yFloorOffset, facing) {
    mesh.position.x = x;
    mesh.position.y = yFloorOffset;
    mesh.rotation.y = facing >= 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  /** 몸짓 하나 고르기 — GLB 사람이면 뼈대 애니메이션을 굴리고(걷기/맞음/가만있기),
   *  아직 도형이면 흰빛으로 번쩍이는 예전 방식 그대로다 */
  function stepActor(shell, animName) {
    if (shell.userData.flashMats) {
      var hn = shell.userData.hurtNow || 0;
      var k = hn > 0 ? Math.min(1, hn / (shell.userData.hurtSpan || (1 / 3))) : 0;
      var fm = shell.userData.flashMats, j;
      for (j = 0; j < fm.length; j++) { fm[j].emissive.setRGB(k * 0.9, k * 0.15, k * 0.1); }
    }
    var u = shell.userData;
    if (!u.mixer) { return; }
    if (u.anim !== animName) {
      var clipName = u.clipMap && u.clipMap[animName];
      var next = clipName && u.actions[clipName];
      if (next) {
        var prevClip = u.anim && u.clipMap[u.anim];
        var prev = prevClip && u.actions[prevClip];
        /* death는 한 번만 돌고 마지막 자세에서 멈춘다 — 나머지(걷기·공격 등)처럼
           반복되면 쓰러진 채 다시 일어서는 꼴이 되어 버린다 */
        if (animName === 'death') {
          var Tc0 = three();
          next.clampWhenFinished = true;
          next.setLoop(Tc0.LoopOnce);
        }
        next.reset().play();
        if (prev && prev !== next) { prev.crossFadeTo(next, 0.2, false); }
        u.anim = animName;
      }
    }
    u.mixer.update(frameDt);
  }

  var TINT_WHITE = null;   // tintHurt() 프레임당(배우 수만큼) new Color 하지 않게 재사용
  /**
   * 손맛 표준(§5-7) — `span` 은 이 플래시가 통째로 가시는 시간(초)이다.
   * `hurt`(남은 값)를 `span`으로 나눠 갓 맞은 순간(hurt===span)엔 항상
   * 흰빛이 꽉 차고, 0으로 갈수록 원래 색으로 돌아온다. 호출하는 쪽이 `hurt`
   * 초기값과 이 `span`을 같게 맞춰야 한다(안 맞으면 처음부터 옅거나, 다
   * 꺼지기 전에 흰빛에 눌러앉는다). `span` 을 안 주면(옛 호출부, 플레이어
   * 피격처럼 §5-7 밖의 자리) 예전 계수(`hurt*3`, 대략 0.33 로 정규화)로
   * 그대로 간다 — 그쪽 화면은 이번 손질로 안 바뀐다.
   */
  function tintHurt(g, hurt, span) {
    g.userData.hurtNow = hurt;
    g.userData.hurtSpan = span || (1 / 3);
    if (!g.userData.body) { return; }   // GLB 로 갈렸으면 stepActor 의 flashMats 몫이다
    if (!TINT_WHITE) { TINT_WHITE = new (three()).Color(0xffffff); }
    var k = hurt > 0 ? Math.min(1, hurt / g.userData.hurtSpan) : 0;
    g.userData.body.material.color.copy(g.userData.baseColor).lerp(TINT_WHITE, k);
    g.userData.head.material.color.copy(g.userData.baseColor).lerp(TINT_WHITE, k);
  }

  function draw() {
    if (!active()) { return; }
    var now = Date.now() / 1000;
    frameDt = lastDrawT ? Math.max(0, Math.min(0.25, now - lastDrawT)) : 0;
    lastDrawT = now;
    updatePerf(frameDt * 1000);
    applyQualityIfChanged();
    var S = global.DG.side, SV = global.DG.sideView;
    var run = S.raw();
    if (!run) {
      /* 사냥터 밖(쉬는 중)에는 그릴 세계가 없다. WebGL 은 alpha:false 라 한 번도
         못 그린(혹은 마지막으로 그린) 캔버스가 **불투명한 검정**으로 남는다 —
         뒤에 깔린 #camp-bg 를 완전히 가려 "쉬는 중" 화면이 새까맣게 보이던
         원인이 이거였다. 캔버스 자체를 숨겨 뒤(#camp-bg)가 비치게 한다 */
      renderer.domElement.style.display = 'none';
      return;
    }
    if (renderer.domElement.style.display === 'none') { renderer.domElement.style.display = ''; }
    var Tc = three();
    var stg = run.stage, p = run.player;

    if (stageKey(stg) !== lastMood) { rebuildStage(stg); }

    var camX = SV._cam();
    var D = camDist();
    var lookY = stg.floor - H / 2;
    camera.position.set(camX + W / 2, lookY, D);
    camera.lookAt(camX + W / 2, lookY, 0);

    var focusX = p.x + S.P_W / 2;
    dirLight.position.set(focusX + 260, 460, 360);
    dirLight.target.position.set(focusX, 0, 0);

    /* 동료 교대(§5-8) — 나와 있는 인물이 바뀌면 지난 몸을 치우고 새로 세운다.
       전직으로 옷 빛깔(toon3d jobLook)이 바뀌어도 같다 */
    var meRef = S.meRef();
    var TNl = global.DG.toon3d, fColor = (global.DG.data.faction(meRef.faction) || {}).color;
    var look = TNl && TNl.jobLook ? TNl.jobLook(fColor, global.DG.core.save.job) : { css: fColor, key: '' };
    var meKey = meRef.id + '|' + look.key;
    if (playerMesh && playerMeshId !== meKey) {
      if (playerMesh.userData.glb && playerMeshId.indexOf(meRef.id + '|') === 0) {
        /* 같은 인물의 전직(빛깔만 바뀜) — 새 몸은 화면 밖에서 조립하고, GLB 가 도착하면(못 받으면 4초 뒤)
           그때 바꿔 낀다. 바로 치우면 캡슐이 한 번 비쳤다(2026-09-23 HANDOFF "이어서 6" 흠) */
        if (pendingMesh && pendingMeshId !== meKey) { disposeDeep(pendingMesh); pendingMesh = null; }
        if (!pendingMesh) { pendingMesh = actorShell(Tc, 'human', look.css, false, meRef.id, false); pendingMeshId = meKey; pendingT = now; }
        if (pendingMesh.userData.glb || now - pendingT > 4) {
          actorGroup.remove(playerMesh); disposeDeep(playerMesh);
          playerMesh = pendingMesh; playerMeshId = meKey; actorGroup.add(playerMesh);
          pendingMesh = null;
        }
      } else {
        actorGroup.remove(playerMesh); disposeDeep(playerMesh); playerMesh = null;
        if (pendingMesh) { disposeDeep(pendingMesh); pendingMesh = null; }
      }
    }
    if (!playerMesh) {
      playerMesh = actorShell(Tc, 'human', look.css, false, meRef.id, false);
      playerMeshId = meKey;
      actorGroup.add(playerMesh);
    }
    place(playerMesh, p.x + S.P_W / 2, stg.floor - (p.y + S.P_H), p.facing);
    /* 탈것 — 말·학·용은 발밑에 서고 나는 그 등 높이에 앉는다(mount.js). 날개 탈것은 날갯짓에 맞춰 살짝 출렁 */
    var MTv = global.DG.mount, mtDef = MTv && MTv.active && MTv.active() ? MTv.current() : null;
    if (mountMesh && (!mtDef || mountMeshId !== mtDef.id)) { actorGroup.remove(mountMesh); disposeDeep(mountMesh); mountMesh = null; mountMeshId = null; }
    if (mtDef) {
      var fly = mtDef.kind === 'fly';
      if (!mountMesh) {
        mountMesh = new Tc.Group(); mountMeshId = mtDef.id;
        var mprim = new Tc.Mesh(new Tc.CapsuleGeometry(14, 30, 3, 6), LM({ color: 0x8a6a45 }));
        mprim.rotation.z = Math.PI / 2; mprim.position.set(0, 26, 0); mountMesh.add(mprim);
        actorGroup.add(mountMesh);
        var mkey = mtDef.id, A3 = global.DG.asset3d;
        if (A3) {
          A3.build(mtDef.model, mtDef.id, fly ? 54 : 66, function (model) {
            if (!model || !mountMesh || mountMeshId !== mkey) { return; }
            while (mountMesh.children.length) { var mc = mountMesh.children[0]; disposeDeep(mc); mountMesh.remove(mc); }
            mountMesh.add(model);
            mountMesh.userData.mixer = model.userData.mixer || null; mountMesh.userData.actions = model.userData.actions || null;
            mountMesh.userData.clipMap = model.userData.clipMap || null; mountMesh.userData.anim = null;
          });
        }
      }
      var mbob = fly ? Math.sin(Date.now() / 220) * 3 : 0;
      place(mountMesh, p.x + S.P_W / 2, stg.floor - (p.y + S.P_H) + mbob, p.facing);
      playerMesh.position.y += (fly ? 24 : 30) + mbob;
      if (mountMesh.userData.mixer) { stepActor(mountMesh, (!!p.vx && (p.onGround || fly)) ? 'walk' : 'idle'); }
    }
    tintHurt(playerMesh, p.hurt || 0);
    applyGearOutline(playerMesh);
    var walking = !!p.vx && p.onGround;
    /* 북돋움(buff, PLAN §12)이 걸린 동안은 실제로 더 빠르게 걷는데(side.js의
       mul) 몸짓은 그대로 walk였다 — buffOn()과 같은 조건을 여기서 그대로
       본다(내보낼 필요 없이 p.buff를 직접 읽는다) */
    var running = walking && p.buff && p.buff.until > Date.now() && p.buff.speed > 1;
    /* 몸짓 우선순위(2026-09-10) — 맞는 순간이 늘 가장 세다(구르거나 휘두르던
       중이어도 맞은 티가 나야 한다). interaction(마심·대화)은 걷기·가만있기
       보다는 위, 회피·공격보다는 아래 — 둘 다 그 자리에서 짧게 끝난다 */
    stepActor(playerMesh, (p.hurt || 0) > 0 ? 'hit' :
      ((p.dodgeAnim || 0) > 0 ? 'dodge' :
      ((p.atkCd || 0) > 0 ? 'attack' :
      (((p.drinkAnim || 0) > 0 || !!run.talk) ? 'interaction' :
      (running ? 'run' : (walking ? 'walk' : 'idle'))))));
    var bob = (!playerMesh.userData.mixer && walking) ? Math.abs(Math.sin(Date.now() / 90)) * 3 : 0;
    playerMesh.position.y += bob;

    var i;
    for (i = 0; i < run.enemies.length; i++) {
      var e = run.enemies[i];
      var em = enemyPool[i];
      /* 배우를 새로 만들 때만 필요한 값들 — 두 생성 분기 안으로 옮김(감사, 2026-09-08).
         희귀형(PLAN 11·13절)은 금빛으로 물들이고, 탱커형(코끼리병 포함)은 크게 세운다 */
      /* 미니보스(PLAN 11절, 2026-09-10)도 희귀처럼 물들인다 — 안 그러면
         "미니보스 등장!" 토스트만 뜨고 화면은 잡졸과 똑같아 보인다.
         색을 겹치지 않게 골랐다(희귀=금빛, 미니보스=짙은 자주) */
      var tint = e.rare ? '#f0c040' : (e.mini ? '#a0305a' :
        (e.role === 'magic' ? '#6a4fc0' : e.ref.color));
      var big = e.role === 'tank' || e.mini;
      if (!em) {
        em = actorShell(Tc, e.ref.kind, tint, e.boss, e.ref.name, big, e.ref.model);
        em.userData.boss = !!e.boss; em.userData.rare = !!e.rare;
        em.userData.mini = !!e.mini; em.userData.role = e.role; em.userData.model = e.ref.model || null;
        actorGroup.add(em); enemyPool[i] = em;
      }
      if (em.userData.boss !== !!e.boss || em.userData.rare !== !!e.rare ||
          em.userData.mini !== !!e.mini || em.userData.role !== e.role ||
          em.userData.model !== (e.ref.model || null)) {   // §5-12 — 옛 병졸 칸에 로봇이 오면 몸을 다시 짓는다
        actorGroup.remove(em); disposeDeep(em);   // 다시 짓는 일이 잦아져(§5-12) 옛 몸을 치운다
        em = actorShell(Tc, e.ref.kind, tint, e.boss, e.ref.name, big, e.ref.model);
        em.userData.boss = !!e.boss; em.userData.rare = !!e.rare;
        em.userData.mini = !!e.mini; em.userData.role = e.role; em.userData.model = e.ref.model || null;
        actorGroup.add(em); enemyPool[i] = em;
      }
      em.visible = true;
      place(em, e.x + e.w / 2, stg.floor - (e.y + e.h), e.dir);
      tintHurt(em, e.hurt || 0, 0.08);   // §5-7 표준 80ms(side.js HURT_FLASH 와 같은 값)
      stepActor(em, (e.hurt || 0) > 0 ? 'hit' : ((e.atkAnim || 0) > 0 ? 'attack' : 'walk'));
      if (!em.userData.mixer) {
        var eb = Math.abs(Math.sin((Date.now() + i * 130) / 110)) * 2.4;
        em.position.y += eb;
      }
    }
    for (i = run.enemies.length; i < enemyPool.length; i++) {
      if (enemyPool[i]) { enemyPool[i].visible = false; }
    }

    /* 죽는 몸짓(2026-09-11) — `run.dying`(side.js kill() 참고)을 uid로 붙든
       별도 배우 풀로 세운다. enemyPool처럼 인덱스로 재활용하면 방금 죽은
       자리를 다른 적이 이어받아 death 몸짓 도중 모습이 뒤바뀐다 */
    var dying = run.dying || [], seenDead = {};
    for (i = 0; i < dying.length; i++) {
      var d = dying[i];
      seenDead[d.uid] = true;
      var dm = deadMeshes[d.uid];
      if (!dm) {
        var dtint = d.rare ? '#f0c040' : (d.mini ? '#a0305a' :
          (d.role === 'magic' ? '#6a4fc0' : d.ref.color));
        dm = actorShell(Tc, d.ref.kind, dtint, d.boss, d.ref.name, d.role === 'tank' || d.mini, d.ref.model);   // §5-12 — 쓰러지는 로봇·망자도 제 몸
        actorGroup.add(dm);
        deadMeshes[d.uid] = dm;
      }
      place(dm, d.x + d.w / 2, stg.floor - (d.y + d.h), d.dir);
      stepActor(dm, 'death');
    }
    for (var dk in deadMeshes) {
      if (!seenDead[dk]) {
        actorGroup.remove(deadMeshes[dk]); disposeDeep(deadMeshes[dk]); delete deadMeshes[dk];
      }
    }

    /* 마을 사람 서성임 — 판정에 안 닿는 화면 층뿐이다. 정지 앵커 둘레를 느리게
       오가며, 방향이 바뀔 때만 몸짓도 walk/idle 로 바꾼다(PLAN 8절) */
    for (i = 0; i < npcPool.length; i++) {
      var npc = npcPool[i], u = npc.userData;
      var speed = Math.cos(now * 0.35 + u.npcPhase) * 40;
      place(npc, u.npcAnchor + Math.sin(now * 0.35 + u.npcPhase) * 55, 0, speed >= 0 ? 1 : -1);
      stepActor(npc, Math.abs(speed) > 6 ? 'walk' : 'idle');
    }

    /* 채집물 — 캔 자리는 숨긴다(다시 돋을 때까지). run.gathers 와 같은 순서로
       세웠으므로(rebuildGathers) 인덱스로 맞춘다 */
    for (i = 0; i < gatherPool.length && i < run.gathers.length; i++) {
      gatherPool[i].visible = run.gathers[i].alive;
    }
    if (chestMesh) { chestMesh.visible = !run.chest || !run.chest.opened; }

    /* 비전투 동물 — 플레이어가 다가오면 달아나고, 아니면 제자리를 어슬렁댄다.
       anchor ±260 을 못 벗어나 화면 밖으로 영영 사라지지는 않는다 */
    var pCenterX = p.x + S.P_W / 2;
    for (i = 0; i < critterPool.length; i++) {
      var cr = critterPool[i], cu = cr.userData;
      var dx = cr.position.x - pCenterX;
      var vx;
      if (Math.abs(dx) < CRITTER_FLEE_R) {
        vx = (dx >= 0 ? 1 : -1) * CRITTER_FLEE_SPD;
      } else {
        vx = Math.cos(now * 0.25 + cu.phase) * CRITTER_WANDER_SPD;
      }
      cr.position.x = Math.max(cu.anchor - 260, Math.min(cu.anchor + 260, cr.position.x + vx * frameDt));
      cr.rotation.y = vx >= 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    /* 후처리(PLAN 24절)를 거치거나(켜져 있을 때), 없으면 곧바로 그린다.
       두 길 다 톤매핑은 한 번 걸린다(post3d.js 머리 참고) */
    var P3 = global.DG.post3d;
    if (P3 && P3.draw(renderer, scene, camera, { alt: postAlt(stg.mood), weather: 'clear' })) {
      return;
    }
    if (P3) { renderer.setRenderTarget(null); }   // 후처리가 방금 꺼졌을 수 있다 — 타깃이 물린 채면 화면이 검게 남는다
    renderer.render(scene, camera);
  }

  global.DG = global.DG || {};
  global.DG.sideView3d = {
    init: init, draw: draw, resize: resize, ready: ready_,
    available: available, active: active, toggle: toggle,
    quality: quality, setQuality: setQuality,
    /** 진단·설정 화면용 — 'auto' 일 때 지금 실제로 도는 등급 */
    effectiveLevel: effectiveLevel,
    /** 진단 전용 — 순수 함수들이라 실제 프레임·기기 없이 바로 잰다 */
    _autoLevelFor: autoLevelFor, _deviceScore: deviceScore, _startLevelFor: startLevelFor,
    _feedPerf: updatePerf, _perfEma: function () { return perfEma; },
    _moodLight: moodLight,
    /** 진단 전용 — 씬(재질·빛 살펴보기, 2026-09-28 새까만 사람 적 추적) */
    _scene: function () { return scene; }
  };
})(window);
