/**
 * 국토 지도 — 3D (PLAN 40절 PHASE 1~3: 엔진 연결 · 카메라 · 월드)
 * ---------------------------------------------------------------
 * `ui-rtk.js` 의 `renderMap()`(svg 평면 지도)는 이 파일이 있는지도 모른다 —
 * **한 줄도 안 건드렸다.** 대신 `#realm3d` 캔버스에 별개의 WebGL 화면을 올리고,
 * 손잡이(`realm3d.on`)가 켜져 있을 때만 `#realm`(svg)을 숨기고 이쪽을 보여 준다.
 * 꺼지면(기본값) 예전 그대로다 — saga-forest 의 `village-view3d.js` 와 같은 요령.
 *
 * 이 판은 **턴제 지도 화면**이다(인물이 걸어 다니지 않는다) — 그래서 카메라는
 * 플레이어를 따라가는 대신, 성 서른 곳이 놓인 국토 전체를 내려다보는
 * **궤도 카메라**(드래그로 돌리고 · 휠/핀치로 당긴다)로 잡는다.
 *
 * **판정은 한 줄도 여기 없다.** 성의 주인·병력·포위 여부는 전부
 * `rtk.state()` · `war.besieged()` 를 그대로 읽기만 한다. 성을 탭하면
 * `ui.openCity()` — 2D 지도가 부르는 그 함수를 그대로 부른다. 그래서 시트가
 * 열고 닫는 방식, 명령을 고르는 방식은 2D 와 완전히 같다.
 *
 * 좌표는 `data-city.js` 의 x·y(0~100, 지도 비율)를 그대로 쓴다 — 새 좌표계를
 * 만들지 않는다. `WORLD_SCALE()` 배만큼 늘려 3D 세계 단위(대략 미터)로 삼는다.
 */
(function (global) {
  'use strict';

  var core = null;
  function C() { if (!core) { core = global.DG.core; } return core; }
  var A3 = null;
  function asset3d() { if (!A3) { A3 = global.DG.asset3d; } return A3; }
  var CD = null;
  function cityData() { if (!CD) { CD = global.DG.cityData; } return CD; }
  var FD = null;
  function forceData() { if (!FD) { FD = global.DG.forceData; } return FD; }
  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }
  function R() { return global.DG.rtk; }
  function W() { return global.DG.war; }

  /** 손잡이 — 2026-09-11부터 기본으로 켠다("아직도 2D 지도가 남아있다"는
   *  신고 — svg 지도는 이제 🧊 버튼으로 되돌아갈 때만 쓰는 대체 화면이다).
   *  세이브에 값이 있으면(사용자가 직접 껐던 적이 있으면) 그 값을 존중한다 */
  function ON() { var v = C().tuned('realm3d.on', 1) ? true : false; return global.DG.deviceMode ? global.DG.deviceMode.want3d('r3', v) : v; }   // 10-19 폰은 2D · PC 기본 3D(사용자 "웹은 3D" — 옛 W-0027 기본 2D 를 바꿈)   /* 기본은 2D 전략 지도 — 3D 는 🧊 단추로 켠다(W-0027, 2026-10-03) */
  function WORLD_SCALE() { return C().tuned('realm3d.worldScale', 4.5); }
  function FOV() { return C().tuned('realm3d.fov', 50); }
  function PITCH_MIN() { return C().tuned('realm3d.pitchMin', 0.35); }
  function PITCH_MAX() { return C().tuned('realm3d.pitchMax', 1.3); }
  function DIST_MIN() { return C().tuned('realm3d.distMin', 15); }   // W-0324 코앞 15m(에셋 확인용, 사용자 10-18)
  function DIST_MAX() { return C().tuned('realm3d.distMax', 1800); }   // W-0324 멀리 1800m(camera far 2400 안)
  /** 지도 위 배우(PLAN §5-10) — 0 이면 옛 지도(원정은 🚩 깃발만). 카메라가
   *  `actorLod` 보다 멀면 배우를 숨기고 옛 깃발로 돌아간다 */
  function ACTORS_ON() { return C().tuned('realm3d.actors', 1) ? true : false; }
  function ACTOR_LOD() { return C().tuned('realm3d.actorLod', 480); }
  /** ⑤ 성을 누르면 그 성 태수에게 다가가는 줌 — 0 이면 예전처럼 카메라는 그대로 */
  function CITY_ZOOM() { return C().tuned('realm3d.cityZoom', 1) ? true : false; }
  /** 병사 몸(2026-09-25) — 1 이면 원정군 병사가 CC0 기사·기병(`asset3d.buildTrooper`), 0 이면 옛 도형 */
  function TROOP_MODEL() { return C().tuned('realm3d.troopModel', 1) ? true : false; }

  /* 그래픽 품질 3단 — 등급표·기기 점수·기기 재기는 realm3d-quality.js(DG.realm3dQuality, R-4 로 뗌) · 여기는 고르기·손잡이 */
  function QQ() { return global.DG.realm3dQuality; } var QUALITY_PRESET = QQ().PRESET; function deviceScore(o) { return QQ().deviceScore(o); } function tierFor(sc) { return QQ().tierFor(sc); } function probeDevice() { return QQ().probeDevice(); }
  function QUALITY() { return C().tuned('realm3d.quality', 'auto'); }
  var autoTierCache = null, aqV = null; function AQ() { return aqV || (global.DG.autoq ? (aqV = global.DG.autoq.make('realm3d')) : null); }   /* W-0302 자동 품질 FPS 내리기(shared/js/autoq.js) */ function isAutoQ() { var q = QUALITY(); return q !== 'low' && q !== 'medium' && q !== 'high'; }
  function autoTier() {
    if (!autoTierCache) { autoTierCache = tierFor(deviceScore(probeDevice())); }
    return AQ() ? AQ().lower(autoTierCache) : autoTierCache;   // W-0302 실제 FPS 가 낮으면 한 단계씩 내린 등급
  }
  /** 고정 값(low/medium/high)이면 그걸, 'auto'면 켤 때 한 번 잰 등급을 쓴다 */
  function tier() {
    var q = QUALITY(); if (global.DG.deviceMode && global.DG.deviceMode.phone()) { return 'low'; }   // W-0333 폰 3D = low 고정(DPR 1·후처리·그림자·PBR 땅 0 — post3d·shadow·pbrground 가 이 등급을 따른다, 아이폰 탭 죽음)
    return (q === 'low' || q === 'medium' || q === 'high') ? q : autoTier();
  }
  function DPR() { return C().tuned('realm3d.dpr', QUALITY_PRESET[tier()].dpr); }
  function FIELD_DENSITY() { return C().tuned('realm3d.fieldDensity', QUALITY_PRESET[tier()].fieldDensity); }
  /** 설정 시트(⚙️)에서 고른다 — `village3d.quality` 와 같은 결로 세이브 손잡이
   *  (`core.setTune`)에 남는다. `scatterField()`(빈 들 소품)는 `buildStaticOnce()`
   *  가 게임을 켤 때 **딱 한 번만** 도는 정적 소품이라 실시간으로는 안 바뀐다
   *  — 새로고침해야 반영된다(`GROUND_SPAN`류와 같은 사정). 렌더러가 이미 서
   *  있으면 픽셀비만 즉시 다시 먹인다. */
  function setQuality(level) {
    C().setTune('realm3d.quality', level);
    if (renderer) { renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, DPR())); }
    return tier();
  }

  function forceColor(id) {
    var f = forceData().force(id);
    return f ? f.color : '#5b6572';
  }

  function hashOf(s) {
    s = String(s || '');
    var h = 0, i;
    for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return h;
  }

  var GROUND_SPAN = 2200;         // buildGround() 의 PlaneGeometry 한 변과 같아야 한다
  var BIOME_COLOR = { plain: '#cfe0a0', hill: '#d3c88f', river: '#a9d6bd', mount: '#b3aca3' };

  /* ── 높낮이 지형 (heightmap) ──────────────────────────────
   * 평면 좌표계(worldX/worldZ)는 그대로 두고, **y 값만** 여기서 얹는다 —
   * 새 좌표계를 만들지 않는다는 원래 원칙과 같은 결이다. 두 층을 더한다:
   *  1) 결이 낮은 값잡음(baseNoise) — 격자 모서리를 해시로 찍고 bilinear로
   *     매끄럽게 잇는다. 지도 전역에 은은한 굴곡을 준다(평야도 완전히 평평하진 않다)
   *  2) 성마다의 land 로 정한 봉우리(cityBump) — 산은 높게, 구릉은 낮게,
   *     강은 살짝 파이게, 평야는 얹지 않는다. 성 반경 안에서만 값하고
   *     smoothstep 으로 부드럽게 꺼진다
   * 둘 다 해시 기반이라 항상 같은 그림이 선다(진단 결정성과 같은 이유).
   * 이 값은 성 좌표(x·y·land)에만 물려 있어 달이 넘어가도(rebuild) 안 변한다
   * — 그래서 바닥 지오메트리는 init() 때 딱 한 번만 굳힌다. */
  var NOISE_GRID = 44, NOISE_AMP = 4;
  var LAND_PEAK = { mount: 34, hill: 13, river: -3, plain: 0 };
  var BUMP_RADIUS = 42;

  function noiseCorner(gx, gz) {
    var hh = hashOf('terr:' + gx + ':' + gz);
    return ((hh % 1000) / 1000) * 2 - 1;
  }
  function smoothstep(x) { return x * x * (3 - 2 * x); }
  function baseNoise(wx, wz) {
    var gx = Math.floor(wx / NOISE_GRID), gz = Math.floor(wz / NOISE_GRID);
    var fx = smoothstep(wx / NOISE_GRID - gx), fz = smoothstep(wz / NOISE_GRID - gz);
    var v00 = noiseCorner(gx, gz), v10 = noiseCorner(gx + 1, gz);
    var v01 = noiseCorner(gx, gz + 1), v11 = noiseCorner(gx + 1, gz + 1);
    var a = v00 + (v10 - v00) * fx, b = v01 + (v11 - v01) * fx;
    return a + (b - a) * fz;
  }
  function cityBump(wx, wz) {
    var cities = cityData().CITIES, i, sum = 0;
    for (i = 0; i < cities.length; i++) {
      var c = cities[i], peak = LAND_PEAK[c.land] || 0;
      if (!peak) { continue; }
      var d = Math.hypot(wx - worldX(c.x), wz - worldZ(c.y));
      if (d > BUMP_RADIUS) { continue; }
      sum += peak * smoothstep(1 - d / BUMP_RADIUS);
    }
    return sum;
  }
  /* ── 해협(海峽) · 땅 높이 · 땅 그림 — js/realm3d-strait.js(R-4). 같은 이름 한 줄 넘김 ───────── */
  var SEA_LEVEL = -6;              // 해수면 높이 — baseNoise 최저치(-NOISE_AMP)보다 낮게 잡아
  var realm3dStraitBind = null;
  function STRAIT() { return global.DG.realm3dStrait.bind(realm3dStraitBind || (realm3dStraitBind = { cityData: cityData, three: three, hashOf: hashOf, GROUND_SPAN: GROUND_SPAN, BIOME_COLOR: BIOME_COLOR, NOISE_AMP: NOISE_AMP, smoothstep: smoothstep, baseNoise: baseNoise, cityBump: cityBump, worldX: worldX, worldZ: worldZ, SEA_LEVEL: SEA_LEVEL })); }
  function straitFactor(wx, wz) { return STRAIT().straitFactor(wx, wz); } function elevAt(wx, wz) { return STRAIT().elevAt(wx, wz); } function isSea(wx, wz) { return STRAIT().isSea(wx, wz); }
  function groundTexture() { return STRAIT().groundTexture(); }

  /* ── 등급 · 배치 ──────────────────────────────────────── */

  /** 성벽(maxWall) 값으로 탑 등급을 가른다 — 30 성의 실제 분포(3400~6800) 기준 */
  function cityTier(city) {
    var w = city.maxWall || city.wall || 0;
    if (w >= 5600) { return 't3'; }
    if (w >= 4600) { return 't2'; }
    return 't1';
  }
  var TIER_H = { t1: 7, t2: 10, t3: 14 };

  function worldX(x) { return (x - 50) * WORLD_SCALE(); }
  function worldZ(y) { return (y - 50) * WORLD_SCALE(); }

  /* ── 장면 ─────────────────────────────────────────────── */

  var canvas = null, renderer = null, scene = null, camera = null;
  var ready = false, failed = false, loopRunning = false;
  var dyn = null;              // `core.on('changed')`마다 다시 짓는 그룹 — 성 타워·길·진·원정
  var statGrp = null;          // 성이 바뀌어도 안 변하는 그룹 — 지형 소품(나무·바위·성 둘레
                                // 장식 등, PLAN 27절 성능 최적화 2026-09-14 이어서). 페이지
                                // 생애 동안 딱 한 번만 짓는다 — `buildStaticOnce()` 참고
  var staticBuilt = false;
  var hitMeshes = [];          // 탭 판정용 투명 원기둥들
  var pulseRings = [];         // 포위 표시 — 숨쉬듯 커졌다 작아진다
  var floaters = [];           // 재해 그림문자 — 천천히 위아래로 떠다닌다
  var rebuildSeq = 0;          // 늦게 도착한 옛 build() 콜백을 거른다(dyn 몫만 — statGrp 은
                                // 한 번 짓고 나면 다시 안 지으니 이 검사가 필요 없다)
  var fx = null;                // `dyn`과 별도 그룹(2026-09-22) — 출진 행군 등 짧은 연출.
                                 // `core.on('changed')`(무장 등용 등 판정마다 울린다)가 `dyn`을
                                 // 통째로 다시 지어도 이 그룹은 안 건드려 연출이 안 끊긴다
  var marches = [];             // showMarch() 로 띄운, 지금 이동 중인 행군 연출들
  var actorGrp = null;          // 지도 위 배우(PLAN §5-10) — `dyn`과 별도 그룹. `rebuild()`는
                                 // 배우를 허물지 않고 `syncActors()`로 목표 자리만 갈아 준다
                                 // (판정마다 장수 GLB 를 다시 받으면 걷기가 끊긴다)
  var actorCache = {};          // 배우 id → { grp, hero, soldiers, lastElapsed, tween… }
  var journeyFlags = {};        // 원정 id → 🚩 스프라이트(dyn 몫) — 배우를 못 보일 때(멀리·손잡이 0·모델 준비 전) 대신 선다

  var yaw = 0, pitch = 0.85, dist = 260;
  var targetYaw = 0, targetPitch = 0.85, targetDist = 260;
  var pivotY = 0;                 // 카메라가 도는 중심의 지형 높이(elevAt(0,0)) — init()에서 한 번 잰다

  /* ── 조이스틱 이동(pan, 2026-09-10) ────────────────────────
   * 궤도 중심은 원래 늘 원점(0,0)이었다 — 세계가 삼국지 한 판이던 때는 그걸로
   * 충분했지만, 한국·일본·교주 등으로 늘어난 지금은 원점 언저리만 보여서는
   * 다른 지역(내 땅)이 어디 있는지 알 길이 없다. `pivotX`·`pivotZ` 를 원점에서
   * 옮겨 궤도 중심 자체를 그 자리로 옮긴다 — 카메라 회전·확대(yaw·pitch·dist)는
   * 그대로 그 중심을 도는 것뿐이라 한 줄도 안 건드린다 */
  var pivotX = 0, pivotZ = 0, targetPivotX = 0, targetPivotZ = 0;
  var PAN_LIMIT = 950;             // GROUND_SPAN(2200)의 절반보다 살짝 좁게 — 가장자리 밖으로 안 나간다
  var PAN_SPEED = 9;               // 조이스틱을 완전히 기울였을 때 프레임당 이동(world 단위)

  function clampPan(v) { return Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, v)); }

  /** 조이스틱 한 프레임 분 — dx·dy 는 -1~1(정규화, 화면 기준: 오른쪽·아래가 양수),
   *  지금 카메라가 보는 방향(yaw)으로 돌려 세계 좌표에 얹는다(궤도 카메라라
   *  늘 수평이므로 pitch는 무시) */
  function panBy(dx, dy) {
    var s = Math.sin(yaw), c = Math.cos(yaw);
    var pm = PAN_SPEED * (global.DG.mount && global.DG.mount.panMul ? global.DG.mount.panMul() : 1);   // 학·용을 타고 날면 빨라진다(mount.js)
    targetPivotX = clampPan(targetPivotX + (dx * c + dy * s) * pm);
    targetPivotZ = clampPan(targetPivotZ + (dy * c - dx * s) * pm);
  }

  /* 비행 둘러보기(mount.js) — 타면 카메라가 낮게 기울고 다가선다, 내리면 타기 전 자리로. 판정은 없다(그림만) */
  var flightOn = false, flightSaved = null;
  function setFlight(cfg) {
    if (cfg) {
      if (!flightOn) { flightSaved = { pitch: targetPitch, dist: targetDist }; }
      flightOn = true;
      targetPitch = clamp(cfg.pitch, PITCH_MIN(), PITCH_MAX());
      targetDist = clamp(cfg.dist, DIST_MIN(), DIST_MAX());
    } else if (flightOn) {
      flightOn = false;
      if (flightSaved) { targetPitch = flightSaved.pitch; targetDist = flightSaved.dist; flightSaved = null; }
    }
  }
  function flying() { return flightOn; }

  /** 절대 이동 — 지도 좌표(0~100대, data-city.js 와 같은 잣대)를 받아 그 자리로
   *  궤도 중심을 옮긴다("내 땅으로" 버튼·범례 탭이 부른다).
   *
   *  2026-09-10 — `spanUnits`(내 땅의 실제 넓이, ui-rtk.js 지도 단위)를 같이
   *  받으면 거리(dist)도 그만큼만 당긴다. 예전엔 `fitCameraToMap()`이 세계
   *  전체(성 60곳 안팎)가 다 들어오도록 늘 멀리 잡아 둔 거리를 안 건드려서,
   *  panTo() 로 중심만 내 땅으로 옮겨도 여전히 세계 절반이 함께 보였다 —
   *  "시작시 너무 멀리서 시작한다"는 신고의 원인. 조이스틱·드래그·핀치로
   *  얼마든 더 물러날 수 있으니, 기본은 내 땅만 꽉 차게 당기는 쪽으로 바꿨다 */
  function panTo(mapX, mapY, spanUnits) {
    targetPivotX = clampPan(worldX(mapX));
    targetPivotZ = clampPan(worldZ(mapY));
    if (spanUnits) {
      targetDist = clamp(spanUnits * WORLD_SCALE() * 0.9, DIST_MIN(), DIST_MAX());
    }
  }

  function available() { return !!three() && !failed; }
  function active() { return ON() && ready; }

  var lazy = false;   // 10-26 2D 고름이면 렌더러를 안 짓고 미룬다(폰 메모리 — W-0447 남은 것) · 🧊 로 켤 때 syncVisibility 가 init
  function init(cv) {
    var t = three();
    canvas = cv;
    if (cv && !ON() && !renderer && t) { lazy = true; syncVisibility(); return; }
    lazy = false;
    if (!t || !canvas) { failed = true; return; }
    try {
      renderer = new t.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    } catch (e) { failed = true; return; }
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, DPR()));
    if (global.DG.toon3d && global.DG.toon3d.toneRenderer) { global.DG.toon3d.toneRenderer(renderer); } if (global.DG.post3d) { global.DG.post3d.init(t, renderer); }   // W-0292 후처리·SSAO(공용)   // Neutral 톤매핑(2026-09-23)

    scene = new t.Scene();
    scene.background = (global.DG.toon3d && global.DG.toon3d.skyBackground) ? global.DG.toon3d.skyBackground(0x9fd0e8) : new t.Color(0x9fd0e8);   // 하늘 그라디언트(2026-09-23, 아래는 안개색 그대로)
    scene.fog = new t.Fog(0x9fd0e8, 260, 900);

    camera = new t.PerspectiveCamera(FOV(), 1, 0.5, 2400);

    var TNg = global.DG.toon3d, LG = TNg && TNg.lightGain ? TNg.lightGain() : 1;   // 톤매핑을 켜면 빛을 올린다(toon3d.toneRenderer)
    var hemi = new t.HemisphereLight(0xffffff, 0x4a5a3a, 0.95 * LG); scene.add(hemi);
    var sun = new t.DirectionalLight(0xfff4e0, 1.0 * LG);
    sun.position.set(-120, 200, 90);
    scene.add(sun); if (global.DG.realmSky3d) { global.DG.realmSky3d.attach(t, scene, sun, hemi); } if (global.DG.realmShadow3d) { global.DG.realmShadow3d.attach(t, renderer, scene, sun, tier()); }   // W-0141 하늘 그림·그림 속 해 자리 빛·지평선 안개색(realm-sky3d.js)

    /* PlaneGeometry는 XY 평면에 눕고, rotation.x=-90°로 눕히면 로컬 (x,y,z)가
     * 세계 (x, z, -y)로 간다 — 로컬 y ↔ 세계 z 가 **부호가 뒤집힌다.** elevAt()은
     * 세계 좌표(worldX/worldZ)로 부르는 함수라 그대로 넣으면 산이 지도의 반대쪽에
     * 선다(성은 안 움직이고 땅만 어긋난다) — 그래서 -gp.getY(gi)로 뒤집어 넣는다 */
    var groundGeo = new t.PlaneGeometry(GROUND_SPAN, GROUND_SPAN, 128, 128);
    var gp = groundGeo.attributes.position, gi;
    for (gi = 0; gi < gp.count; gi++) {
      gp.setZ(gi, elevAt(gp.getX(gi), -gp.getY(gi)));
    }
    groundGeo.computeVertexNormals();
    var groundTN = global.DG.toon3d;
    var ground = new t.Mesh(
      groundGeo,
      groundTN ? groundTN.lambertLike({ color: 0xffffff, map: groundTexture() })
        : new t.MeshLambertMaterial({ color: 0xffffff, map: groundTexture() })
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; if (global.DG.pbrground3d) { ground.material = global.DG.pbrground3d.standardFrom(t, ground.material, { tier: tier(), tune: 'realm3d', set: C().tuned('realm3d.fieldMix', 1) ? 'field_mix' : 'grass', tile: 18, w: GROUND_SPAN, h: GROUND_SPAN, gain: C().tuned('realm3d.pbrGain', 1.18), detail: C().tuned('realm3d.fieldMix', 1) ? C().tuned('realm3d.detailMix', 0.7) : 0 }); }   // W-0295 지역 색 지도는 그대로 + 자체 PBR 법선·거칠기(LOW 옛 재질) · W-0415 들판 섞음 결 field_mix(K-0193) 법선 + 바탕 결 곱(지역 색 보존), 손잡이 realm3d.fieldMix 0 = 옛 풀   // W-0293 해 그림자를 받는 땅(realm-shadow3d.js)
    scene.add(ground);

    /* 바다 — 해협(STRAITS) 자리만 지형이 SEA_LEVEL 아래로 파여 있어서, 이
     * 평평한 판 한 장을 그 높이에 깔아 두면 파인 곳에서만 바닥을 대신해
     * 드러난다(카메라가 늘 위에서 내려다보므로 나머지는 땅에 가려 안 보인다
     * — 새 좌표계·새 렌더 패스 없이 z-버퍼만으로 해안선이 선다) */
    var sea = new t.Mesh(
      new t.PlaneGeometry(GROUND_SPAN, GROUND_SPAN),
      (global.DG.realmWater3d && global.DG.realmWater3d.material(t, 0x2f7bb0)) || new t.MeshPhongMaterial({ color: 0x2f7bb0, transparent: true, opacity: 0.88, shininess: 60 })   // W-0141 물결(realm-water3d.js), 손잡이 0 이면 옛 판
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = SEA_LEVEL;
    scene.add(sea);

    pivotY = elevAt(0, 0);

    dyn = new t.Group();
    scene.add(dyn);
    statGrp = new t.Group();
    scene.add(statGrp);
    fx = new t.Group();
    scene.add(fx);
    actorGrp = new t.Group();
    scene.add(actorGrp);

    fitCameraToMap();
    yaw = targetYaw; pitch = targetPitch; dist = targetDist;

    bindPointer();
    resize();
    global.addEventListener('resize', resize);
    ready = true;
    syncVisibility();
    rebuild();
  }

  /** 30 성 전체가 화면에 들어오도록 초기 거리를 잡는다 */
  function fitCameraToMap() {
    var cities = cityData().CITIES, i, r, maxR = 60;
    for (i = 0; i < cities.length; i++) {
      r = Math.hypot(worldX(cities[i].x), worldZ(cities[i].y));
      if (r > maxR) { maxR = r; }
    }
    targetDist = Math.max(DIST_MIN(), Math.min(DIST_MAX(), maxR * 1.7));
  }

  function resize() {
    if (!renderer || !camera) { return; }
    var w = canvas.clientWidth || global.innerWidth;
    var h = canvas.clientHeight || global.innerHeight;
    if (!w || !h) { return; }
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix(); if (global.DG.post3d) { global.DG.post3d.resize(); }   // W-0292
  }

  function syncVisibility() {
    var map2d = document.getElementById('realm');
    if (!canvas) { return; }
    if (lazy && ON()) { init(canvas); return; }   // init 끝에서 다시 불린다
    var on = active();
    canvas.style.display = on ? 'block' : 'none';
    if (map2d) { map2d.style.display = on ? 'none' : ''; }
    if (on) { resize(); startLoop(); rebuild(); }
  }

  function toggle() {
    if (!available()) { return false; }
    var nx = !ON(); C().setTune('realm3d.on', nx ? 1 : 0); if (global.DG.deviceMode) { global.DG.deviceMode.mark('r3', nx); }
    syncVisibility();
    return ON();
  }

  /* ── 성·길·지형 세우기 ────────────────────────────────── */

  function clearDyn() {
    var t = three();
    dyn.clear();
    hitMeshes = [];
    pulseRings = [];
    floaters = [];
    shadowInst = null;
    shadowCount = 0;
    journeyFlags = {};
  }

  /** 재해 그림문자 — 캔버스에 이모지를 한 번 찍어 텍스처로 굳힌다(문자마다 캐시) */
  var emojiTexCache = {};
  function emojiSprite(emoji, size) {
    var t = three();
    if (!emojiTexCache[emoji]) {
      var cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      var c = cv.getContext('2d');
      c.font = '46px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(emoji, 32, 36);
      emojiTexCache[emoji] = new t.CanvasTexture(cv);
    }
    var spr = new t.Sprite(new t.SpriteMaterial({ map: emojiTexCache[emoji], transparent: true, depthTest: false }));
    spr.scale.setScalar(size || 4);
    return spr;
  }

  /** 발밑 그림자 — 실제 shadow map 대신 값싼 원 데칼을 깐다. 궤도 카메라로
   *  국토 전체를 내려다보는 화면이라(멀리서도 항상 선명해야 한다) 진짜
   *  그림자맵보다 이 편이 싸고 확실하다(saga-go 배우 그림자와 같은 요령).
   *
   *  2026-09-14 — 성능 최적화(PLAN.md 27절). 지역이 열한 곳(성 100여 곳 +
   *  scatterField 소품 1천여 개)으로 늘면서, 소품마다 하나씩 찍던 이 데칼이
   *  달마다(rebuild) 개별 Mesh 수천 개 = 드로우콜 수천 개로 쌓였다. 안
   *  움직이고 서로 안 겹쳐도 되는 정적 원판이라, 하나의 InstancedMesh 에
   *  인스턴스로 눕혀 드로우콜 하나로 합친다 — 지오메트리·머티리얼은 그대로
   *  공유하던 것을 이어 쓴다(눈에 보이는 그림은 그대로, 그리는 방식만
   *  바뀐다). `clearDyn()`이 달마다 `shadowInst`(dyn 몫)를 비워 다시 짓는다.
   *
   *  2026-09-14 이어서 — `grp`(대상 그룹)를 받아 **정적 소품용 인스턴스를
   *  따로** 둔다(`statShadowInst`, `statGrp`에 얹는다). dyn 몫은 여전히
   *  `clearDyn()`마다 다시 짓지만, `statGrp`는 `clearDyn()`이 안 건드려서
   *  거기 얹은 인스턴스도 한 번 채우면 그대로 남는다 — 바로 아래
   *  "지형 소품을 한 번만 짓는다" 절 참고. */
  var blobGeo = null, blobMat = null;
  var shadowInst = null, shadowCount = 0, shadowDummy = null;
  var statShadowInst = null, statShadowCount = 0;
  var SHADOW_MAX = 6000;
  function addShadow(x, z, r, grp) {
    var t = three();
    if (!t) { return; }
    var isStatic = grp === statGrp;
    if (isStatic ? !statGrp : !dyn) { return; }
    if (!blobGeo) {
      blobGeo = new t.CircleGeometry(1, 16);
      blobMat = new t.MeshBasicMaterial({ color: 0x14140c, transparent: true, opacity: 0.3, depthWrite: false });
    }
    if (!shadowDummy) { shadowDummy = new t.Object3D(); }
    shadowDummy.position.set(x, elevAt(x, z) + 0.015, z);
    shadowDummy.rotation.set(-Math.PI / 2, 0, 0);
    shadowDummy.scale.setScalar(Math.max(0.4, r));
    shadowDummy.updateMatrix();
    if (isStatic) {
      if (!statShadowInst) {
        statShadowInst = new t.InstancedMesh(blobGeo, blobMat, SHADOW_MAX); statShadowInst.name = 'blob';
        statShadowInst.count = 0;
        statShadowCount = 0;
        statGrp.add(statShadowInst);
      }
      if (statShadowCount >= SHADOW_MAX) { return; }
      statShadowInst.setMatrixAt(statShadowCount, shadowDummy.matrix);
      statShadowCount++;
      statShadowInst.count = statShadowCount;
      statShadowInst.instanceMatrix.needsUpdate = true;
      return;
    }
    if (!shadowInst) {
      shadowInst = new t.InstancedMesh(blobGeo, blobMat, SHADOW_MAX); shadowInst.name = 'blob';
      shadowInst.count = 0;
      shadowCount = 0;
      dyn.add(shadowInst);
    }
    if (shadowCount >= SHADOW_MAX) { return; }   // 안전판 — 넘치면 조용히 그만둔다(그림자 몇 개 없어도 안 티난다)
    shadowInst.setMatrixAt(shadowCount, shadowDummy.matrix);
    shadowCount++;
    shadowInst.count = shadowCount;
    shadowInst.instanceMatrix.needsUpdate = true;
  }

  /** GLB 소품 하나를 세운다(비동기) — cityDressing·scatterSmall·riverPond 가 같이 쓴다.
   *  `grp`(대상 그룹, 기본값 dyn)가 `statGrp`면 **정적 소품** 취급 —
   *  `rebuildSeq`로 거르지 않는다(`statGrp`는 `buildStaticOnce()`가 딱 한 번만
   *  채우고 다시 안 비우므로 늦게 온 콜백을 걱정할 일이 없다). 그 외엔
   *  예전 그대로 `seq`가 다시 지어진 뒤(늦게 온 콜백)면 조용히 버린다 */
  function addProp(kind, id, x, z, scaleH, rotY, seq, grp) {
    var g2 = grp || dyn;
    var isStatic = g2 === statGrp;
    if (isStatic) { ST().pend(1); }
    asset3d().build(kind, { id: id }, function (g) {
      if (isStatic) { ST().pend(-1); }
      if (!g) { if (isStatic) { maybeFreezeStatic(); } return; }
      if (isStatic) { if (!statGrp) { return; } }
      else if (seq !== rebuildSeq || !dyn) { return; }
      g.position.set(x, elevAt(x, z), z);
      g.rotation.y = rotY || 0;
      g.scale.setScalar(scaleH);
      if (isStatic) { g.userData.instOk = true; }
      g2.add(global.DG.realmSky3d ? global.DG.realmSky3d.realify(g) : g);   // W-0141 표준(PBR) 재질 — 지도 사본만
      addShadow(x, z, scaleH * 0.4, g2);
      if (isStatic) { maybeFreezeStatic(); }
    });
  }

  /* 발열 — 정적 소품 묶기(InstancedMesh)·자리 자르기는 js/realm3d-static.js(R-4). 도착 대기 수·묶음·자르기 통계는 그 파일이 갖는다 */
  var stEnv = {}; function stE() { stEnv.statGrp = statGrp; stEnv.staticBuilt = staticBuilt; stEnv.camera = camera; stEnv.scene = scene; stEnv.renderer = renderer; return stEnv; }
  var stH = null; function ST() { return global.DG.realm3dStatic.setup(stH || (stH = { three: three, C: C, env: stE })); }
  function maybeFreezeStatic() { ST().maybeFreezeStatic(); } function statCull() { ST().statCull(); } function matSig(m) { return ST().matSig(m); }

  /** 성 둘레 잔장식 — 우물 · 횃불 두 개. 3등급 대성은 성벽 · 시장 · 사찰까지
   *  더해 "이 나라의 큰 성" 임이 한눈에 보이도록 한다.
   *  전부 tier·h·footprint(모두 static 값 — `cityTier()`가 읽는 `maxWall`은
   *  세력이 바뀌어도 안 변한다)로만 정해지고 소유(force)와 무관하다 —
   *  2026-09-14, `buildStaticOnce()`가 성마다 한 번만 부른다(`grp`는 늘
   *  `statGrp`). */
  function cityDressing(city, tier, h, footprint, seq, grp) {
    var cx = worldX(city.x), cz = worldZ(city.y);
    addProp('well', city.id + ':well', cx - footprint * 1.3, cz + footprint * 0.4, h * 0.5, 0, seq, grp);
    addProp('torch', city.id + ':torchL', cx + footprint * 1.1, cz + footprint * 0.55, h * 0.45, 0, seq, grp);
    addProp('torch', city.id + ':torchR', cx + footprint * 1.1, cz - footprint * 0.55, h * 0.45, 0, seq, grp);
    if (tier === 't3') {
      addProp('wall', city.id + ':wallA', cx, cz + footprint * 1.5, h * 0.6, 0, seq, grp);
      addProp('wall', city.id + ':wallB', cx, cz - footprint * 1.5, h * 0.6, Math.PI, seq, grp);
      addProp('market', city.id + ':market', cx + footprint * 1.8, cz + footprint * 0.9, h * 0.55, 0, seq, grp);
      addProp('temple', city.id + ':temple', cx + footprint * 1.8, cz - footprint * 0.9, h * 0.6, 0, seq, grp);
    }
  }

  /** 강가 성 — 물웅덩이 하나 + 갈대 삼아 풀 두 포기. `land: 'river'` 뿐(static) */
  function riverPond(city, seq, grp) {
    if (city.land !== 'river') { return; }
    var t = three();
    var g2 = grp || dyn;
    var cx = worldX(city.x), cz = worldZ(city.y);
    var hh = hashOf(city.id + ':pond');
    var ang = ((hh % 360) / 360) * Math.PI * 2;
    var r = 5 + (hh % 3);
    var px = cx + Math.cos(ang) * 9, pz = cz + Math.sin(ang) * 9;
    if (isSea(px, pz)) { return; }     // 해협 기슭 성이면 진짜 바다가 바로 곁이라 안 그린다
    var pond = new t.Mesh(
      new t.CircleGeometry(r, 20),
      new t.MeshBasicMaterial({ color: 0x5aa9d8, transparent: true, opacity: 0.75 })
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(px, elevAt(px, pz) + 0.04, pz);
    g2.add(pond);
    addProp('grass', city.id + ':reed1', px + r * 0.6, pz, 0.7, 0, seq, grp);
    addProp('grass', city.id + ':reed2', px - r * 0.5, pz + r * 0.3, 0.6, 0.8, seq, grp);
  }

  /** 작은 덤불 · 풀 · 꽃 — 나무/바위 큰 레이어 위에 얹는 잔풀 레이어(PLAN 33절
   *  "큰→중간→작은"). 산지는 암석 지대라 뺀다(static) */
  function scatterSmall(city, seq, grp) {
    if (city.land === 'mount') { return; }
    var cx = worldX(city.x), cz = worldZ(city.y);
    var n = 4, i;
    for (i = 0; i < n; i++) {
      var hh = hashOf(city.id + ':sm:' + i);
      var ang = ((hh % 360) / 360) * Math.PI * 2;
      var r = 3 + (hh % 4);
      var px = cx + Math.cos(ang) * r, pz = cz + Math.sin(ang) * r;
      if (isSea(px, pz)) { continue; }
      var pick = hh % 3;
      var kind = pick === 0 ? 'bush' : (pick === 1 ? 'grass' : 'flower');
      var scaleH = kind === 'bush' ? (0.8 + (hh % 6) / 10) : (0.5 + (hh % 5) / 10);
      addProp(kind, city.id + ':' + kind + ':' + hh, px, pz, scaleH, (hh % 628) / 100, seq, grp);
    }
  }

  /** 병력 한 무리를 어림잡아 세우는 깃발 — `battle3d.js`와 같은 요령(막대+천을
   *  직접 짓는다, GLB 가 아니다). 진(陣)의 크기를 숫자 그대로가 아니라 다발로 본다 */
  function banner(color) {
    var t = three();
    var bannerTN = global.DG.toon3d;
    var g = new t.Group();
    var pole = new t.Mesh(
      new t.CylinderGeometry(0.07, 0.07, 2.3, 5),
      bannerTN ? bannerTN.lambertLike({ color: 0x6b5533 }) : new t.MeshLambertMaterial({ color: 0x6b5533 })
    );
    pole.position.y = 1.15;
    g.add(pole);
    var cloth = new t.Mesh(
      new t.BoxGeometry(0.85, 1.1, 0.05),
      bannerTN ? bannerTN.lambertLike({ color: new t.Color(color) }) : new t.MeshLambertMaterial({ color: new t.Color(color) })
    );
    cloth.position.set(0.48, 2.0, 0);
    g.add(cloth);
    return g;
  }

  /** 출진할 때 성에서 성으로 짧게 행군하는 모습(2026-09-22, "보는 재미" 요청) —
   *  war.js 는 이미 결과를 다 정한 뒤다(판정 없음). `dyn`(판정마다 통째로
   *  다시 짓는 그룹)이 아니라 `fx`에 얹어, 행군 도중 다른 성의 등용·거래 같은
   *  무관한 판정이 지도를 다시 지어도 이 연출은 안 끊긴다. `ms` 뒤 저절로
   *  사라진다 — 부르는 쪽(`ui-rtk.js`)이 그 시간만큼 전투 화면을 늦게 연다. */
  function showMarch(fromId, toId, ms, color) {
    var t = three();
    if (!ready || !fx || !t) { return; }
    var a = cityData().find(fromId), b = cityData().find(toId);
    if (!a || !b) { return; }
    var ax = worldX(a.x), az = worldZ(a.y), bx = worldX(b.x), bz = worldZ(b.y);
    var grp = new t.Group(), n = 3, i;
    for (i = 0; i < n; i++) {
      var bnr = banner(color || '#d8dee0');
      bnr.position.set((i - (n - 1) / 2) * 1.3, 0, 0);
      grp.add(bnr);
    }
    grp.rotation.y = Math.atan2(bx - ax, bz - az);
    grp.position.set(ax, elevAt(ax, az), az);
    fx.add(grp);
    marches.push({ grp: grp, ax: ax, az: az, bx: bx, bz: bz, t0: now(), dur: Math.max(200, ms || 1100) });
  }
  function now() { return (global.performance && global.performance.now) ? global.performance.now() : Date.now(); }

  function bannerCluster(n, cx, cz, color) {
    var i, cols = Math.min(4, Math.max(1, n));
    for (i = 0; i < n; i++) {
      var row = Math.floor(i / cols), col = i % cols;
      var x = cx + (col - (cols - 1) / 2) * 1.4;
      var z = cz - row * 1.4;
      var b = banner(color);
      b.position.set(x, elevAt(x, z), z);
      dyn.add(b);
      addShadow(x, z, 0.4);
    }
  }

  /** 진(陣) — 성 밖에 진 친 부대. 성문 쪽(from→to 사이, to 에 가깝게)에 천막과
   *  세력 색 깃발 다발을 세운다. 내 진영이면 탭해서 진영 탭을 연다 */
  function buildCamp(cp, seq) {
    var t = three();
    var from = cityData().find(cp.from), to = cityData().find(cp.to);
    if (!from || !to) { return; }
    var fx = worldX(from.x), fz = worldZ(from.y);
    var tx = worldX(to.x), tz = worldZ(to.y);
    var frac = 0.82;
    var px = fx + (tx - fx) * frac, pz = fz + (tz - fz) * frac;
    var dx = tx - fx, dz = tz - fz, len = Math.hypot(dx, dz) || 1;
    var side = 5;
    px += (-dz / len) * side; pz += (dx / len) * side;
    var col = forceColor(cp.force);

    addProp('tent', cp.id + ':tent', px, pz, 5, Math.atan2(dx, dz) + Math.PI, seq);
    var n = clamp(Math.round((cp.troops || 0) / 1200), 2, 10);
    bannerCluster(n, px + 4, pz, col); if (global.DG.supplyLine) { global.DG.supplyLine.segs3d(cp).forEach(function (sg) { addRoad(sg.a, sg.b, { color: sg.color, opacity: sg.good ? 0.7 : 0.9, width: 1.1, y: 0.14 }); }); }   // W-0278 보급 길(초록·빨강)

    if (cp.force === R().me()) {
      var hit = new t.Mesh(
        new t.CylinderGeometry(4.5, 4.5, 5, 10),
        new t.MeshBasicMaterial({ visible: false })
      );
      hit.position.set(px, elevAt(px, pz) + 2.5, pz);
      hit.userData.campId = cp.id;
      dyn.add(hit);
      hitMeshes.push(hit);
    }
  }

  /** 원정이 경로 위 지금 어디쯤(화면 x·y) — 순수 함수, js/realm3d-plan.js(R-4). elapsed(소수 달) 를 주면 그 값으로 잰다 */
  function journeyPos(j, elapsed) { return RP().journeyPos(j, elapsed); }

  /** 가고 있는 원정 — 경로 위 지금 자리에 깃발 하나(2D 지도의 🚩 마커와 같은
   *  자리, 2026-09-04). GLB 소품 없이 이모지 스프라이트로 충분하다(재해
   *  그림문자와 같은 요령) */
  function buildJourney(j, seq) {
    var pos = journeyPos(j);
    if (!pos || seq !== rebuildSeq) { return; }
    var wx = worldX(pos.x), wz = worldZ(pos.y);
    var flag = emojiSprite('🚩', 9);
    flag.position.set(wx, elevAt(wx, wz) + 9, wz);
    dyn.add(flag);
    journeyFlags[j.id] = flag;
  }

  /* ── 지도 위 배우(PLAN §5-10 "리얼리티") ───────────────────
   * ① 원정군 — 🚩 하나 대신 이끄는 장수(일기토와 같은 3D 몸, 세력색)와 병사
   * 3~5가 길 위에 선다. ▶ 다음 달로 원정이 한 달 나아가면 ACTOR_TWEEN_MS 동안
   * 지난달 자리 → 이번 달 자리로 **길을 따라** 걷는다(`journeyPos(j, 소수 달)`)
   * — 판정은 war.js 가 이미 끝냈고 여기선 화면만 움직인다. 누가·어디서·무슨
   * 클립인지는 순수 함수 `actorPlan(state)`가 정하고(three 없이 진단된다),
   * 그리는 쪽(`syncActors`·`tickActors`)은 그 목록대로 배우를 만들고·옮기고·
   * 지울 뿐이다. 배우는 `dyn` 이 아니라 `actorGrp` 에 산다 — `changed`(판정
   * 하나마다 울린다)로 `rebuild()` 가 돌 때마다 장수 GLB 를 다시 받으면 걷던
   * 걸음이 끊기기 때문이다. */
  var ACTOR_MAX = 24;               // 한 화면 배우 상한(원정 장수 우선 → 태수 → 재야, §5-10 수치)
  var ACTOR_TWEEN_MS = 1500;        // 지난달 자리 → 이번 달 자리 걷기
  var HERO_SCALE = 5;               // 몸 키 1(normalize) → 성 탑(7~14) 옆에서 사람 크기로 읽히게
  var SOLDIER_SCALE = 1.7;          // 병사 도형(키 약 1.8) → 장수보다 살짝 작게
  var TROOP_SCALE = 4.2;            // 병사 몸(키 1, 기병은 말 키 1.2) → 장수(5)보다 살짝 작게

  /* 배우 계획(원정 앞장·병종·몸짓 표·떠돌이·싸움 자리·태수 후보·걷기 보간) — js/realm3d-plan.js(R-4). 같은 이름 한 줄 넘김 */
  var RP0 = global.DG.realm3dPlan, ORDER_GESTURES = RP0.ORDER_GESTURES, GESTURE_EVERY = RP0.GESTURE_EVERY, GESTURE_ON = RP0.GESTURE_ON, WANDER_MAX = RP0.WANDER_MAX, WANDER_REACH = RP0.WANDER_REACH, WANDER_PERIOD = RP0.WANDER_PERIOD, BATTLE_MAX = RP0.BATTLE_MAX, BOUT_S = RP0.BOUT_S;
  var rpH = null; function RP() { return RP0.setup(rpH || (rpH = { asset3d: asset3d, ACTORS_ON: ACTORS_ON, W: W, clamp: clamp, R: R, cityData: cityData, hashOf: hashOf, cityTier: cityTier, WORLD_SCALE: WORLD_SCALE, ACTOR_MAX: ACTOR_MAX, TIER_H: TIER_H })); }
  function leaderOf(ids) { return RP().leaderOf(ids); } function soldierTypes(n, mix) { return RP().soldierTypes(n, mix); } function actorPlan(st, opt) { return RP().actorPlan(st, opt); } function wanderPlan(st, opt) { return RP().wanderPlan(st, opt); } function wanderPos(a, s) { return RP().wanderPos(a, s); }
  function battlePlan(st, opt) { return RP().battlePlan(st, opt); } function battleBeat(result, s) { return RP().battleBeat(result, s); } function governorPlan(st, opt) { return RP().governorPlan(st, opt); } function actorPos(a, frac, fromEl) { return RP().actorPos(a, frac, fromEl); }

  /* 병사 — 몸통·머리·창(기병은 말 몸통을 더한다). 모양·재질은 전부 공유.
   * 2026-09-25 부터는 몸(`asset3d.buildTrooper`)이 올 때까지 서 있는 자리 표시일 뿐이다 */
  var soldierGeo = null, soldierMats = {};
  function soldierMat(hex) {
    var t = three(), TN = global.DG.toon3d;
    if (!soldierMats[hex]) {
      soldierMats[hex] = TN ? TN.lambertLike({ color: hex }) : new t.MeshLambertMaterial({ color: hex });
    }
    return soldierMats[hex];
  }
  function soldierMesh(color, kind) {
    var t = three();
    if (!soldierGeo) {
      soldierGeo = {
        body: new t.CylinderGeometry(0.3, 0.38, 1.25, 6),
        head: new t.SphereGeometry(0.27, 8, 6),
        spear: new t.CylinderGeometry(0.035, 0.035, 2.4, 4),
        horse: new t.BoxGeometry(0.55, 0.7, 1.55)
      };
    }
    var g = new t.Group(), lift = kind === 'cav' ? 0.75 : 0;
    var hex = new t.Color(color).getHex();
    if (kind === 'cav') {
      var horse = new t.Mesh(soldierGeo.horse, soldierMat(0x5a4028));
      horse.position.y = 0.5;
      g.add(horse);
    }
    var body = new t.Mesh(soldierGeo.body, soldierMat(hex));
    body.position.y = 0.62 + lift;
    g.add(body);
    var head = new t.Mesh(soldierGeo.head, soldierMat(0xe8c9a0));
    head.position.y = 1.5 + lift;
    g.add(head);
    var spear = new t.Mesh(soldierGeo.spear, soldierMat(0x6b5533));
    spear.position.set(0.42, 1.2 + lift, 0.1);
    g.add(spear);
    return g;
  }

  function makeActor(a) {
    var t = three();
    var grp = new t.Group(), col = a.kind === 'wander' ? (a.spy ? SPY_TINT : WANDER_TINT) : forceColor(a.force), k;
    var c = { grp: grp, hero: null, soldiers: [], lastElapsed: a.elapsed, fromEl: a.elapsed, t0: null, plan: a, dead: false,
              sig: actorSig(a), badge: null, badgeKey: null, gOn: false, seed: (hashOf(a.id) % 100) / 37 };
    var sl = a.soldiers || [], rowZ = -3.6, rowD = 0;
    for (k = 0; k < sl.length; k++) {
      /* 두 줄씩 — 줄 깊이는 말이 끼면 말 길이만큼(몸 키 1.2 × 1.33 × TROOP_SCALE ≈ 6.7) */
      if (k % 2 === 0) {
        rowZ -= rowD;
        rowD = (sl[k] === 'cav' || sl[k + 1] === 'cav') ? 7 : 3;
      }
      /* 병사 자리(s) 하나에 도형을 먼저 세우고, 몸이 오면 도형을 걷어 몸으로 바꾼다 */
      var s = new t.Group(), prim = soldierMesh(col, sl[k]);
      prim.scale.setScalar(SOLDIER_SCALE);
      s.add(prim);
      /* 장수 뒤로 두 줄 — 로컬 +z 가 걸어가는 쪽(아래 rotation.y 와 짝). 기병은 말 길이만큼 한 칸 더 옆 */
      s.userData.ox = (k % 2 ? 1 : -1) * (sl[k] === 'cav' ? 2.6 : 2.1);
      s.userData.oz = rowZ - (rowD - 3) / 2;
      s.userData.seed = k * 1.7;
      grp.add(s);
      c.soldiers.push(s);
      if (TROOP_MODEL() && asset3d() && asset3d().buildTrooper) { dressSoldier(c, s, prim, sl[k], col); }
    }
    if (blobGeo) {
      var blob = new t.Mesh(blobGeo, blobMat);
      blob.rotation.x = -Math.PI / 2;
      blob.position.y = 0.05;
      blob.scale.setScalar(1.8);
      grp.add(blob);
    }
    actorGrp.add(grp);
    var O = global.DG.off;
    if (a.kind === 'battle') { makeDuelists(c, a, O); return c; }
    var ref = (O && O.find && a.officer) ? O.find(a.officer) : null;
    if (ref && asset3d() && asset3d().buildHero) {
      asset3d().buildHero(ref, col, function (m) {
        if (c.dead || !m) { return; }
        m.scale.setScalar(HERO_SCALE);
        grp.add(m); if (global.DG.realmShadow3d) { global.DG.realmShadow3d.mark(m); }
        c.hero = m;
      });
    }
    return c;
  }
  function dressSoldier(c, s, prim, kind, col) {
    asset3d().buildTrooper(kind, col, function (m) {
      if (c.dead || !m) { return; }
      m.scale.setScalar(TROOP_SCALE);
      s.remove(prim);
      s.add(m); if (global.DG.realmShadow3d) { global.DG.realmShadow3d.mark(m); }
      s.userData.model = m;
    });
  }
  /** 싸움 자리 — 두 지휘관을 마주 세운다(공격군 로컬 -z·수비군 +z, 그룹은 공격군이 보는
   *  쪽으로 돈다). 결과 깃발은 이긴 쪽 색(비기면 ⛺) — 연출이 끝날 때까지 숨겨 둔다 */
  var DUEL_GAP = 2.0;
  function makeDuelists(c, a, O) {
    c.t0 = now();
    c.duel = { a: null, d: null, bout: -2 };
    var A3 = asset3d();
    [['a', a.a, a.force, -DUEL_GAP, 0], ['d', a.d, a.defForce, DUEL_GAP, Math.PI]].forEach(function (s) {
      var ref = (O && O.find) ? O.find(s[1]) : null;
      if (!ref || !A3 || !A3.buildHero) { return; }
      A3.buildHero(ref, forceColor(s[2]), function (m) {
        if (c.dead || !m) { return; }
        m.scale.setScalar(HERO_SCALE);
        m.position.z = s[3];
        m.rotation.y = s[4];
        c.grp.add(m); if (global.DG.realmShadow3d) { global.DG.realmShadow3d.mark(m); }
        c.duel[s[0]] = m;
        if (s[0] === 'a') { c.hero = m; }
      });
    });
    if (a.result === 'draw') {
      c.flag = emojiSprite('⛺', 4.2);
      c.flag.position.set(2.6, 3.4, 0);
    } else {
      c.flag = banner(forceColor(a.result === 'atk' ? a.force : a.defForce));
      c.flag.scale.setScalar(2.2);
      c.flag.position.set(2.6, 0, 0);
    }
    c.flag.visible = false;
    c.grp.add(c.flag);
  }
  /** 떠돌이·세작 — 세력이 없어 흙빛(재야), 세작은 밤빛에 몸을 어둡게 */
  var WANDER_TINT = '#8a7a5c', SPY_TINT = '#2c3148';
  function tickWander(c, a, tms, A3) {
    var p = wanderPos(a, tms / 1000);
    var wx = worldX(p.x), wz = worldZ(p.y);
    c.grp.position.set(wx, elevAt(wx, wz), wz);
    var hx = worldX(a.x1) - worldX(a.x0), hz = worldZ(a.y1) - worldZ(a.y0);
    if (!p.out) { hx = -hx; hz = -hz; }
    if (hx * hx + hz * hz > 1e-6) { c.grp.rotation.y = Math.atan2(hx, hz); }
    if (c.hero && A3 && A3.step) { A3.step(c.hero, { anim: p.moving ? a.clip : ((c.hero.userData.ownBody && global.DG.pose3d ? global.DG.pose3d.life(c, tms / 1000, true) : null) || a.rest), t: tms / 1000 }); }   // W-0303 떠돌이도 쉬면 둘러보기·앉기
  }
  function tickBattle(c, a, tms, A3) {
    var wx = worldX(a.x), wz = worldZ(a.y);
    c.grp.position.set(wx, elevAt(wx, wz), wz);
    c.grp.rotation.y = Math.atan2(a.dx, a.dy);   // 로컬 +z = 공격군이 성 쪽으로 보는 방향
    var beat = battleBeat(a.result, (tms - c.t0) / 1000);
    var fresh = beat.bout !== c.duel.bout;
    c.duel.bout = beat.bout;
    if (c.flag) { c.flag.visible = beat.flag; }
    if (!A3 || !A3.step) { return; }
    if (c.duel.a) { A3.step(c.duel.a, { anim: beat.a, force: fresh, t: tms / 1000 }); }
    if (c.duel.d) { A3.step(c.duel.d, { anim: beat.d, force: fresh, t: tms / 1000 }); }
  }

  /** 같은 id 라도 사람·세력이 바뀌면(태수 교체·성 함락) 몸을 새로 지어야 한다 */
  function actorSig(a) {
    return a.kind + '|' + a.officer + '|' + a.force + (a.kind === 'battle' ? '|' + a.d + '|' + a.result : '') +
      (a.kind === 'wander' ? '|' + (a.spy ? 'spy' : '') : '');
  }
  /** 태수 머리 위 명령 그림문자 — 명령이 바뀔 때만 갈아 끼운다 */
  function syncBadge(c, a) {
    var key = a.kind === 'governor' ? a.order : (a.kind === 'wander' && a.spy ? 'spy' : null);
    if (c.badgeKey === key) { return; }
    if (c.badge) { c.grp.remove(c.badge); c.badge = null; }
    c.badgeKey = key;
    if (key === 'spy') {
      c.badge = emojiSprite('🌙', 3.2);
      c.badge.position.y = HERO_SCALE + 2.0;
      c.grp.add(c.badge);
      return;
    }
    if (key && a.emoji) {
      c.badge = emojiSprite(a.emoji, 3.4);
      c.badge.position.y = HERO_SCALE + 2.2;
      c.grp.add(c.badge);
    }
  }
  /** 몸에 실제로 있는 첫 슬롯(별칭으로 떨어진 것은 건너뛴다) — 없으면 null */
  /* W-0303 — 자체 몸짓 몸(ownBody)이면 명령마다 상황·전투·생활 몸짓을 먼저(진단이 보는 ORDER_GESTURES 표준 슬롯은 그대로 둔다) */ var ORDER_POSE = { agri: 'Pose_pick', comm: 'Pose_wave', tech: 'Pose_heavy', sec: 'Pose_idle_look', wall: 'Pose_heavy', draft: 'Pose_cast', train: 'Pose_heavy', ships: 'Pose_heavy', search: 'Pose_pick', hire: 'Pose_wave' }; function poseFor(model, order) { var u = model && model.userData; return u && u.ownBody && global.DG.pose3d ? ORDER_POSE[order] || null : null; } function gestureSlot(model, clips) {
    var cm = model && model.userData && model.userData.clipMap, i;
    if (!cm) { return null; }
    for (i = 0; i < clips.length; i++) {
      if (cm[clips[i]] && !(cm.alias && cm.alias[clips[i]])) { return clips[i]; }
    }
    return null;
  }
  function dropActor(id) {
    var c = actorCache[id];
    if (!c) { return; }
    c.dead = true;
    if (c.hero && c.hero.userData.mixer) { c.hero.userData.mixer.stopAllAction(); }
    (c.soldiers || []).forEach(function (s) {
      var m = s.userData.model;
      if (m && m.userData.mixer) { m.userData.mixer.stopAllAction(); }
    });
    if (c.duel && c.duel.d && c.duel.d.userData.mixer) { c.duel.d.userData.mixer.stopAllAction(); }
    actorGrp.remove(c.grp);
    delete actorCache[id];
  }

  /** ⑤ 순수 함수 — 성을 눌렀을 때 카메라가 갈 곳(세계 좌표 x·z, 거리, 기울기). 태수가 있으면
   *  성문 앞 태수 자리, 없으면 성 한가운데. 가깝게(ZOOM_DIST) 낮게(ZOOM_PITCH) 다가가
   *  사람 키가 읽히게 한다. 없는 성이면 null */
  var ZOOM_DIST = 105, ZOOM_PITCH = 0.62;
  function zoomFor(cityId, st) {
    var cd = cityData().find(cityId);
    if (!cd) { return null; }
    var mx = cd.x, my = cd.y;
    var g = st ? governorPlan(st, { pin: cityId, orders: {} }).filter(function (a) { return a.city === cityId; })[0] : null;
    if (g) { mx = g.x; my = g.y; }
    return { x: clampPan(worldX(mx)), z: clampPan(worldZ(my)),
             dist: clamp(ZOOM_DIST, DIST_MIN(), DIST_MAX()), pitch: clamp(ZOOM_PITCH, PITCH_MIN(), PITCH_MAX()) };
  }
  var pinCity = null;               // 방금 누른 성(태수 자리를 보장한다)
  function zoomToCity(cityId) {
    if (!CITY_ZOOM() || !ACTORS_ON()) { return; }
    var st = R() && R().state ? R().state() : null;
    var z = zoomFor(cityId, st);
    if (!z) { return; }
    pinCity = cityId;
    targetPivotX = z.x; targetPivotZ = z.z; targetDist = z.dist; targetPitch = z.pitch;
    if (st) { syncActors(st); }
  }

  /** 카메라 궤도 중심(세계 좌표) → 지도 좌표 — 태수는 가까운 성부터 뽑는다 */
  function focusMap() { return { x: pivotX / WORLD_SCALE() + 50, y: pivotZ / WORLD_SCALE() + 50 }; }
  var lastSyncX = 0, lastSyncZ = 0;
  var RESYNC_PAN = 60;              // 궤도 중심이 이만큼(세계 단위) 옮겨 가면 태수를 다시 뽑는다

  /** `rebuild()` 끝에서 — 목록대로 배우를 두고, 원정이 한 달 나아갔으면 걷기를 건다 */
  function syncActors(st) {
    if (!actorGrp || !three()) { return; }
    var plan = actorPlan(st, { focus: focusMap(), pin: pinCity }), seen = {}, i, id;
    lastSyncX = pivotX; lastSyncZ = pivotZ;
    for (i = 0; i < plan.length; i++) {
      var a = plan[i], c = actorCache[a.id];
      seen[a.id] = true;
      if (c && c.sig !== actorSig(a)) { dropActor(a.id); c = null; }
      if (!c) { c = actorCache[a.id] = makeActor(a); }
      syncBadge(c, a);
      if (a.elapsed !== c.lastElapsed) {
        /* 걷는 도중 또 한 달이 넘어가면(빨리 누르기) 지금 선 자리에서 이어 걷는다 */
        c.fromEl = (c.t0 !== null && typeof c.curEl === 'number') ? c.curEl : c.lastElapsed;
        c.t0 = now();
        c.lastElapsed = a.elapsed;
      }
      c.plan = a;
    }
    for (id in actorCache) {
      if (Object.prototype.hasOwnProperty.call(actorCache, id) && !seen[id]) { dropActor(id); }
    }
  }

  /** 태수 — 성문 앞에 서서, 이 달 명령이 있으면 GESTURE_EVERY 마다 그 몸짓을 한 번 */
  function tickGovernor(c, a, tms, A3) {
    var wx = worldX(a.x), wz = worldZ(a.y);
    c.grp.position.set(wx, elevAt(wx, wz), wz);
    c.grp.rotation.y = 0;                       // 로컬 +z = 기본 카메라 쪽을 본다
    if (c.badge) { c.badge.position.y = HERO_SCALE + 2.2 + Math.sin(tms / 420 + c.seed) * 0.35; }
    if (!c.hero || !A3 || !A3.step) { return; }
    var slot = a.order ? (poseFor(c.hero, a.order) || gestureSlot(c.hero, a.clips)) : null;
    var on = !!slot && ((tms / 1000 + c.seed) % GESTURE_EVERY) < GESTURE_ON;
    var start = on && !c.gOn;
    c.gOn = on;
    A3.step(c.hero, { anim: on ? slot : a.rest, force: start, t: tms / 1000 });
  }

  /** 매 프레임 — 멀면(LOD) 배우를 숨기고 🚩 로 돌아간다. 보일 때만 mixer 를 돌린다 */
  function tickActors(tms) {
    if (!actorGrp) { return; }
    var lod = !ACTORS_ON() || dist > ACTOR_LOD(), id;
    actorGrp.visible = !lod;
    for (id in journeyFlags) {
      if (!Object.prototype.hasOwnProperty.call(journeyFlags, id)) { continue; }
      var ac = actorCache[id];
      journeyFlags[id].visible = lod || !(ac && ac.hero);
    }
    if (lod) { return; }
    if (Math.hypot(pivotX - lastSyncX, pivotZ - lastSyncZ) > RESYNC_PAN && R() && R().state) { syncActors(R().state()); }
    var A3 = asset3d();
    for (id in actorCache) {
      if (!Object.prototype.hasOwnProperty.call(actorCache, id)) { continue; }
      var c = actorCache[id], a = c.plan;
      if (a.kind === 'governor') { tickGovernor(c, a, tms, A3); continue; }
      if (a.kind === 'battle') { tickBattle(c, a, tms, A3); continue; }
      if (a.kind === 'wander') { tickWander(c, a, tms, A3); continue; }
      var moving = c.t0 !== null;
      var frac = moving ? Math.min(1, (tms - c.t0) / ACTOR_TWEEN_MS) : 1;
      var el = moving ? c.fromEl + (a.elapsed - c.fromEl) * frac : a.elapsed;
      c.curEl = el;
      var jj = { path: a.path, monthsTotal: a.total };
      var p = journeyPos(jj, el), ahead = journeyPos(jj, el + 0.05);
      if (!p) { continue; }
      var wx = worldX(p.x), wz = worldZ(p.y), gy = elevAt(wx, wz);
      var hx = worldX(ahead.x) - wx, hz = worldZ(ahead.y) - wz;
      if (hx * hx + hz * hz > 1e-6) { c.grp.rotation.y = Math.atan2(hx, hz); }
      c.grp.position.set(wx, gy, wz);
      /* 병사 발을 제 자리 지형에 붙인다(언덕에서 뜨거나 묻히지 않게). 몸이 온 병사는 걷기 클립, 도형은 걸을 때 까딱 */
      var ry = c.grp.rotation.y, cs = Math.cos(ry), sn = Math.sin(ry), k;
      for (k = 0; k < c.soldiers.length; k++) {
        var s = c.soldiers[k], u = s.userData;
        var sx = wx + u.ox * cs + u.oz * sn, sz = wz - u.ox * sn + u.oz * cs;
        var bob = (moving && !u.model) ? Math.abs(Math.sin(tms / 150 + u.seed)) * 0.45 : 0;
        s.position.set(u.ox, elevAt(sx, sz) - gy + bob, u.oz);
        if (u.model && A3 && A3.step) { A3.step(u.model, { anim: moving ? a.clip : a.rest, t: tms / 1000 + u.seed }); }
      }
      if (c.hero && A3 && A3.step) { A3.step(c.hero, { anim: moving ? a.clip : a.rest, t: tms / 1000 }); }
      if (moving && frac >= 1) { c.t0 = null; }
    }
  }

  /** 성과 성 사이 길 — 평지 구간은 예전처럼 한 토막, 언덕·산을 지나는 긴
   *  구간은 몇 토막으로 나눠 지형을 따라 오르내리게 한다(2026-09-04, 높낮이
   *  지형을 얹으며 — 안 나누면 길이 산허리를 그대로 뚫고 지나간다). 토막마다
   *  3D 로 기울여야 해서 Y 축(방향) 뿐 아니라 X 축(오르내림 경사)도 돌린다 */
  /* 성이 바뀔 때마다(core.on('changed')) 지도 전체를 다시 지어서, 길
     토막마다(30여 개 성의 인접 관계 × 최대 8토막) 매번 지오메트리·머티리얼을
     새로 만들었다 — 단위 박스 하나를 스케일만 바꿔 재사용하고, 머티리얼은
     (색·투명도) 조합별로 캐시한다(감사, 2026-09-08) */
  var roadBoxGeo = null, roadMats = {};
  function addRoadSegment(p1, p2, opt) {
    var t = three();
    if (!roadBoxGeo) { roadBoxGeo = new t.BoxGeometry(1, 1, 1); }
    var dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z;
    var flat = Math.hypot(dx, dz), len = Math.hypot(flat, dy) || 0.001;
    var mkey = opt.color + ':' + opt.opacity;
    var mat = roadMats[mkey];
    if (!mat) { mat = roadMats[mkey] = (opt.water && global.DG.realmWater3d && global.DG.realmWater3d.material(t, 0x3f8cbf)) || new t.MeshBasicMaterial({ color: new t.Color(opt.color), transparent: true, opacity: opt.opacity }); }   // W-0141 강은 물결
    var mesh = new t.Mesh(roadBoxGeo, mat);
    mesh.scale.set(opt.width, 0.06, len);
    mesh.position.set((p1.x + p2.x) / 2, (p1.y + p2.y) / 2 + opt.y, (p1.z + p2.z) / 2);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = Math.atan2(dx, dz);
    mesh.rotation.x = -Math.atan2(dy, flat || 0.001); mesh.userData.noShadow = 1;
    dyn.add(mesh);
  }

  function addRoad(a, b, opt) {
    var ax = worldX(a.x), az = worldZ(a.y), bx = worldX(b.x), bz = worldZ(b.y);
    var flatLen = Math.hypot(bx - ax, bz - az);
    var n = clamp(Math.round(flatLen / 40), 2, 8), i;
    var prev = { x: ax, y: elevAt(ax, az), z: az };
    for (i = 1; i <= n; i++) {
      var f = i / n;
      var px = ax + (bx - ax) * f, pz = az + (bz - az) * f;
      var cur = { x: px, y: elevAt(px, pz), z: pz };
      addRoadSegment(prev, cur, opt);
      prev = cur;
    }
  }

  /** 지형지물 — 산은 봉우리, 구릉은 낮은 둔덕, 나머지는 나무·바위를 몇 개 흩는다.
   *  같은 성은 늘 같은 자리에 같은 것이 선다(해시 기반 — 매번 안 흔들린다, static) */
  function scatterAround(city, seq, grp) {
    var cx = worldX(city.x), cz = worldZ(city.y);
    /* 2026-09-10 — "맵이 텅 비어 보인다" 피드백으로 성 하나당 1개씩 늘렸다.
       카메라가 가장 오래 머무는 자리(성 바로 곁)라 여기를 조금만 늘려도
       체감이 크고, 성 하나당 늘어난 수(93성 × 1)도 저 아래 scatterField
       증가분보다 훨씬 적어 성능 부담이 작다.
       2026-09-11 — "아직도 텅 비어 보인다"는 재지적으로 한 번 더 늘렸다. */
    var n = city.land === 'mount' ? 4 : (city.land === 'hill' ? 4 : 5);
    var i;
    for (i = 0; i < n; i++) {
      var hh = hashOf(city.id + ':' + i);
      var ang = ((hh % 360) / 360) * Math.PI * 2;
      var r = 6 + (hh % 5);
      var px = cx + Math.cos(ang) * r, pz = cz + Math.sin(ang) * r;
      if (isSea(px, pz)) { continue; }
      var kind = city.land === 'mount' ? 'mount' : (((hh >> 4) % 3) === 0 ? 'rock' : 'tree');
      var scaleH = kind === 'mount' ? (7 + (hh % 5)) : (kind === 'rock' ? 0.9 : (2.2 + (hh % 12) / 10));
      addProp(kind, city.id + ':' + kind + ':' + i, px, pz, scaleH, (hh % 628) / 100, seq, grp);
    }
  }

  /** 성 사이 빈 들 — 성마다 두르는 `scatterAround`/`scatterSmall` 는 성 둘레
   *  6~13 유닛에만 꽂혀서, 그 사이 넓은 빈칸은 늘 판판했다(퀄리티 피드백,
   *  2026-09-04). 성 좌표를 담는 사각형을 격자로 훑으며 **가장 가까운 성의
   *  land** 를 물려받아 그 결에 맞는 소품을 흩는다. 성 발밑(반경 16유닛)은
   *  건너뛴다 — `cityDressing`이 이미 그 자리를 쓴다. 칸 좌표 하나로 심을지·
   *  무엇을·어디에를 다 정해 늘 같은 그림이 선다.
   *
   *  2026-09-10 — "맵이 아직 텅 빈 것 같다, 자연스럽고 아름답게" 피드백으로
   *  칸마다 확률을 18%→26%로 올렸다(칸 크기는 그대로 18 — 성능을 생각해
   *  칸 수 자체는 안 늘리고 당첨률만 올렸다, 전체 소품 수는 약 605→874개
   *  선이다). 또한 평야·강가 들판 당첨 칸의 12%는 나무 대신 **작은 화전
   *  마을**(집 한 채 + 우물)을 세운다 — `cityDressing`이 이미 쓰는 CC0
   *  집·우물을 그대로 재사용한다("건물이나 주변 환경이나" 다 비어 보인다는
   *  지적에 자연물만이 아니라 사람 손길도 보태려는 것).
   *
   *  2026-09-11 — 같은 재지적으로 확률을 26%→32%, 화전 마을 비율도
   *  12%→16%로 한 번 더 올렸다(전체 소품 수는 약 874→1070개 선).
   *
   *  전부 성 좌표·land(둘 다 static)만으로 정해진다(static) — 2026-09-14,
   *  `buildStaticOnce()`가 한 번만 부른다. */
  function scatterField(seq, grp) {
    var cities = regCities(), i, k;   // W-0400 지역 경계 안만
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (i = 0; i < cities.length; i++) {
      var wx = worldX(cities[i].x), wz = worldZ(cities[i].y);
      if (wx < minX) { minX = wx; } if (wx > maxX) { maxX = wx; }
      if (wz < minZ) { minZ = wz; } if (wz > maxZ) { maxZ = wz; }
    }
    var pad = 30, cell = 18;
    minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;

    for (var gx = minX; gx < maxX; gx += cell) {
      for (var gz = minZ; gz < maxZ; gz += cell) {
        var hh = hashOf('field:' + Math.round(gx) + ':' + Math.round(gz));
        if (hh % 100 >= FIELD_DENSITY()) { continue; }
        var jx = gx + ((hh >> 6) % cell) - cell / 2;
        var jz = gz + ((hh >> 12) % cell) - cell / 2;
        if (isSea(jx, jz)) { continue; }   // 해협 트인 바다 — 여기엔 안 심는다

        var near = null, nd = Infinity;
        for (k = 0; k < cities.length; k++) {
          var d = Math.hypot(jx - worldX(cities[k].x), jz - worldZ(cities[k].y));
          if (d < nd) { nd = d; near = cities[k]; }
        }
        if (!near || nd < 16) { continue; }

        var land = near.land || 'plain';
        var pick = (hh >> 18) % 10;
        var kind, scaleH;
        /* 화전 마을 — 평야·강가에서만, 당첨 칸의 16%(hh 상위 비트를 또 하나
           쓴다 — 위치·종류 결정과 안 겹치게) */
        if ((land === 'plain' || land === 'river') && ((hh >> 22) % 100) < 16) {
          addProp('house', 'field:' + Math.round(jx) + ':' + Math.round(jz) + ':house',
            jx, jz, 1.6 + (hh % 5) / 10, (hh % 628) / 100, seq, grp);
          addProp('well', 'field:' + Math.round(jx) + ':' + Math.round(jz) + ':well',
            jx + 2.4, jz + 1.6, 0.7, 0, seq, grp);
          continue;
        }
        if (land === 'mount') {
          kind = pick < 6 ? 'rock' : 'mount';
          scaleH = kind === 'mount' ? (5 + (hh % 4)) : 0.8;
        } else if (land === 'hill') {
          kind = pick < 5 ? 'rock' : (pick < 8 ? 'bush' : 'tree');
          scaleH = kind === 'tree' ? (1.8 + (hh % 8) / 10) : 0.8;
        } else if (land === 'river') {
          kind = pick < 6 ? 'grass' : (pick < 9 ? 'bush' : 'tree');
          scaleH = kind === 'tree' ? (2 + (hh % 8) / 10) : 0.7;
        } else {
          kind = pick < 7 ? 'tree' : (pick < 9 ? 'bush' : 'flower');
          scaleH = kind === 'tree' ? (2 + (hh % 14) / 10) : 0.7;
        }
        addProp(kind, 'field:' + Math.round(jx) + ':' + Math.round(jz), jx, jz, scaleH, (hh % 628) / 100, seq, grp);
      }
    }
  }

  function buildCity(city, cst, me) {
    var t = three();
    var mine = cst.force === me;
    var tier = cityTier(city);
    var h = TIER_H[tier];
    var col = forceColor(cst.force);
    var seq = rebuildSeq;
    asset3d().build('city:' + tier, { id: city.id, tint: col, flag: col }, function (g) {
      if (seq !== rebuildSeq || !g || !dyn) { return; }
      var cx = worldX(city.x), cz = worldZ(city.y), gy = elevAt(cx, cz);
      g.position.set(cx, gy, cz);
      g.scale.setScalar(h);
      dyn.add(global.DG.realmSky3d ? global.DG.realmSky3d.realify(g) : g); if (global.DG.realmShadow3d) { global.DG.realmShadow3d.mark(g); }   // W-0141 · W-0293 성은 비동기로 붙어 rebuild 끝 mark 를 놓친다

      var footprint = Math.max(3.2, h * 0.5);
      addShadow(cx, cz, footprint * 0.9);
      /* 성 둘레 잔장식(우물·횃불·성벽 등)은 소유(force)와 무관한 정적 소품이라
         2026-09-14부터 여기서 안 짓는다 — `buildStaticOnce()`가 성마다 한 번만
         짓는다(PLAN 27절 성능 최적화, 아래 그 함수 머리말 참고). */
      var hitGeo = new t.CylinderGeometry(footprint, footprint, h, 10);
      var hit = new t.Mesh(hitGeo, new t.MeshBasicMaterial({ visible: false }));
      hit.position.set(cx, gy + h / 2, cz);
      hit.userData.cityId = city.id;
      dyn.add(hit);
      hitMeshes.push(hit);

      /* 내 성은 밑동에 밝은 고리를 둘러 눈에 띄게 한다 */
      if (mine) {
        var ring = new t.Mesh(
          new t.RingGeometry(footprint * 1.05, footprint * 1.35, 24),
          new t.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: t.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(cx, gy + 0.08, cz);
        dyn.add(ring);
      }

      /* 포위 — 숨쉬는 다홍 고리 */
      if (W() && W().besieged(city.id)) {
        var pr = new t.Mesh(
          new t.RingGeometry(footprint * 1.5, footprint * 1.75, 24),
          new t.MeshBasicMaterial({ color: 0xe0663f, transparent: true, opacity: 0.7, side: t.DoubleSide })
        );
        pr.rotation.x = -Math.PI / 2;
        pr.position.set(cx, gy + 0.09, cz);
        dyn.add(pr);
        pulseRings.push({ mesh: pr, base: footprint * 1.6 });
      }

      /* 재해·풍년 — 고리(포위보다 바깥) + 떠다니는 그림문자. rtk.js 가 이미
         `cst.disaster` 로 매기고 있는 것을 그대로 읽을 뿐이다 */
      if (cst.disaster) {
        var dInfo = R().disasterByKey(cst.disaster);
        if (dInfo) {
          var dr = new t.Mesh(
            new t.RingGeometry(footprint * 1.9, footprint * 2.15, 24),
            new t.MeshBasicMaterial({
              color: dInfo.good ? 0xf3d24a : 0x8a5a2a, transparent: true, opacity: 0.55, side: t.DoubleSide
            })
          );
          dr.rotation.x = -Math.PI / 2;
          dr.position.set(cx, gy + 0.1, cz);
          dyn.add(dr);

          var spr = emojiSprite(dInfo.emoji, h * 0.9);
          var baseY = gy + h * 1.25;
          spr.position.set(cx, baseY, cz);
          dyn.add(spr);
          floaters.push({ mesh: spr, baseY: baseY, amp: h * 0.12, seed: hashOf(city.id) % 100 });
        }
      }
    });
  }

  /** 지형 소품(나무·바위·잔풀·성 둘레 장식·강가 웅덩이·빈 들의 화전 마을 등)을
   *  **딱 한 번만** 짓는다 — 2026-09-14, 성능 최적화(PLAN 27절 "필요하지 않은
   *  오브젝트 업데이트 중지"). 전부 성 좌표·land·maxWall처럼 세력이 바뀌어도
   *  안 변하는 static 값만으로 정해지는데, 예전엔 `rebuild()`가
   *  `core.on('changed')`(무장 등용·시장 거래·행군 등 판정 하나마다 울린다,
   *  달 넘김 뿐이 아니다)마다 이 소품들(지역 열한 곳 기준 2천 개 안팎)을
   *  통째로 허물고 다시 지었다 — `scatterField()`만 해도 격자 칸 수 ×
   *  성 수(90여 곳)만큼 최근접 성을 다시 찾는 반복이라, 화면과 무관한 명령
   *  하나에도 그 계산과 GLB 인스턴스 생성이 고스란히 다시 돌았다. `statGrp`는
   *  `clearDyn()`이 안 건드리는 별도 그룹이라 여기 얹은 것은 게임이 끝날
   *  때까지(페이지가 살아있는 동안) 그대로 남는다 — 성 목록 자체가
   *  시나리오·세력이 바뀌어도 안 바뀌므로 다시 지을 이유가 없다. */
  var staticRid = null; function regNow() { var V = global.DG.regionView; return V && V.on() ? V.current() : ''; } function regCities() { var V = global.DG.regionView, rid = regNow(), all = cityData().CITIES; return rid ? all.filter(function (c) { return V.regionOf(c.id) === rid; }) : all; } function regionFocus() { var V = global.DG.regionView, b = V && regNow() ? V.bbox(regNow()) : null; if (b) { panTo(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h)); } }   /* W-0400 지역 단위 — 3D 도 지금 지역 성만(손잡이 realm.regionView 0 = 옛 전체) */ function buildStaticOnce() {
    if (!statGrp || (staticBuilt && staticRid === regNow())) { return; } if (staticBuilt) { ST().reset(); statGrp.clear(); } staticRid = regNow();   // W-0400 지역이 바뀌면 정적 층을 그 지역으로 다시
    ST().pend(1);                       // 다 부르기 전에 묶이지 않게(동기로 떨어지는 도형 소품이 있다)
    staticBuilt = true;
    var cities = regCities(), i;
    for (i = 0; i < cities.length; i++) {
      var city = cities[i];
      var tier = cityTier(city), h = TIER_H[tier], footprint = Math.max(3.2, h * 0.5);
      cityDressing(city, tier, h, footprint, 0, statGrp);
      scatterAround(city, 0, statGrp);
      scatterSmall(city, 0, statGrp);
      riverPond(city, 0, statGrp);
    }
    scatterField(0, statGrp);
    ST().pend(-1);
    maybeFreezeStatic();
  }

  /** 성·길·진영을 다시 짓는다 — 세력이 바뀌거나(정벌) 달이 넘어갈 때(`changed`
   *  가 울릴 때마다). 2026-09-14부터 지형 소품은 여기 없다 — `buildStaticOnce()`
   *  가 따로, 한 번만 짓는다(위 머리말 참고). */
  function rebuild() {
    if (!ready) { return; }
    rebuildSeq++;
    clearDyn();
    var st = R().state();
    if (!st || !st.started) { syncActors(null); return; }
    buildStaticOnce();
    var cities = regCities(), i, j, drawn = {}, inReg = {}; cities.forEach(function (c) { inReg[c.id] = 1; });

    for (i = 0; i < cities.length; i++) {
      var a = cities[i];
      for (j = 0; j < a.adj.length; j++) {
        var b = cityData().find(a.adj[j]);
        if (!b || !inReg[b.id]) { continue; }   // W-0400 지역 밖 길은 안 그림
        var key = a.id < b.id ? a.id + b.id : b.id + a.id;
        if (drawn[key]) { continue; }
        drawn[key] = true;
        var fa = st.cities[a.id].force, fb = st.cities[b.id].force;
        var same = fa && fa === fb;
        var water = cityData().isWater(a.id, b.id);
        if (water) {
          addRoad(a, b, { color: '#5aa9d8', opacity: 0.75, width: 3.2, y: 0.03, water: 1 });
        } else if (same) {
          addRoad(a, b, { color: forceColor(fa), opacity: 0.6, width: 1.6, y: 0.05 });
        } else {
          addRoad(a, b, { color: '#9aa3ad', opacity: 0.22, width: 1.2, y: 0.05 });
        }
      }
    }

    var seq = rebuildSeq;
    for (i = 0; i < cities.length; i++) {
      buildCity(cities[i], st.cities[cities[i].id], st.me);
    }

    /* 진(陣) — 물러나지 않고 성 밖에 진 친 부대. 내 것·남의 것 다 세운다
       (이 판은 애초에 안 가린 정보라 — enemyCity() 도 적 성 살림을 그대로 보여준다) */
    var camps = W() ? W().camps() : [];
    for (i = 0; i < camps.length; i++) { buildCamp(camps[i], seq); }

    /* 원정 — 가고 있는 중인 부대(2026-09-04). camp 와 달리 아직 어느 성도
       에워싸지 않은, 오가는 중인 상태다 */
    var journeys = W() ? W().journeys() : [];
    for (i = 0; i < journeys.length; i++) { buildJourney(journeys[i], seq); }

    /* 배우(PLAN §5-10) — 다시 짓지 않고 목표만 갈아 준다 */
    syncActors(st); if (global.DG.realmShadow3d && dyn) { global.DG.realmShadow3d.mark(dyn); }   // W-0293 성·진·원정(dyn)이 해 그림자를 드리운다(길은 noShadow)
  }

  /* ── 카메라 조작 (드래그 회전 · 휠/핀치 확대) ─────────── */

  var pointers = {};
  var dragMoved = false, pinchDist = 0;
  var ROT_SPEED = 0.006, ZOOM_SPEED = 0.6, WHEEL_SPEED = 0.15;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function pointerCount() {
    var n = 0, k;
    for (k in pointers) { if (pointers.hasOwnProperty(k)) { n++; } }
    return n;
  }

  /** 탄 것의 표(userData) 그대로 넘긴다 — `.cityId` 아니면 `.campId` */
  function pickHit(clientX, clientY) {
    var t = three();
    if (!t || !camera || !hitMeshes.length) { return null; }
    var rect = canvas.getBoundingClientRect();
    var ndc = new t.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    var ray = new t.Raycaster();
    ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObjects(hitMeshes);
    return hits.length ? hits[0].object.userData : null;
  }

  function bindPointer() {
    canvas.addEventListener('pointerdown', function (e) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { canvas.setPointerCapture(e.pointerId); } catch (ex) { /* noop */ }
      if (pointerCount() === 1) { dragMoved = false; }
      if (pointerCount() === 2) { pinchDist = twoPointerDist(); }
    });
    canvas.addEventListener('pointermove', function (e) {
      var p = pointers[e.pointerId];
      if (!p) { return; }
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (pointerCount() === 1) {
        targetYaw -= dx * ROT_SPEED;
        targetPitch = clamp(targetPitch + dy * ROT_SPEED, PITCH_MIN(), PITCH_MAX());
        if (Math.abs(dx) + Math.abs(dy) > 2) { dragMoved = true; }
      } else if (pointerCount() === 2) {
        var nd = twoPointerDist();
        targetDist = clamp(targetDist - (nd - pinchDist) * ZOOM_SPEED, DIST_MIN(), DIST_MAX());
        pinchDist = nd;
        dragMoved = true;
      }
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    });
    function endPointer(e) {
      var p = pointers[e.pointerId];
      delete pointers[e.pointerId];
      if (p && !dragMoved && pointerCount() === 0) {
        var hit = pickHit(e.clientX, e.clientY);
        if (hit && hit.campId && global.DG.ui) { global.DG.ui.openSheet('camp'); }
        else if (hit && hit.cityId && global.DG.ui) { zoomToCity(hit.cityId); global.DG.ui.openCity(hit.cityId); }
      }
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('wheel', function (e) {
      targetDist = clamp(targetDist + e.deltaY * WHEEL_SPEED, DIST_MIN(), DIST_MAX());
      e.preventDefault();
    }, { passive: false });
  }

  function twoPointerDist() {
    var ks = Object.keys(pointers);
    if (ks.length < 2) { return 0; }
    var a = pointers[ks[0]], b = pointers[ks[1]];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /* ── 루프 ─────────────────────────────────────────────── */

  function startLoop() {
    if (loopRunning) { return; }
    loopRunning = true;
    requestAnimationFrame(tick);
  }

  /* 발열(2026-09-24 "핸드폰 불남") — 턴제 지도인데 멈춰 있어도 초당 60·120번 다시 그렸다. 그림은 그대로 두고 헛그림만 막는다:
     상한 60(손잡이 `perf.fps`, 0 = 상한 없음) · 카메라가 멎고 행군·배우 보간이 없으면 30(숨 쉬는 몸짓·깃발 까딱은 그대로 움직인다)
     · 좁은 화면에서 시트가 덮으면 30 · 전투·만남 창(#encounter, 화면 전체)이 덮으면 10 */
  var lastTickT = 0;
  function mapBusy() {
    var e = 1e-3;
    if (Math.abs(targetYaw - yaw) > e || Math.abs(targetPitch - pitch) > e || Math.abs(targetDist - dist) > 0.05 ||
        Math.abs(targetPivotX - pivotX) > 0.05 || Math.abs(targetPivotZ - pivotZ) > 0.05) { return true; }
    if (marches.length) { return true; }
    for (var id in actorCache) { if (Object.prototype.hasOwnProperty.call(actorCache, id) && actorCache[id].t0 !== null) { return true; } }
    return false;
  }
  function tickGapMs() {
    var fps = C().tuned ? C().tuned('perf.fps', 60) : 60;
    var enc = document.getElementById('encounter');
    if (enc && enc.classList.contains('show')) { return 100; }
    var b = document.body;
    var sheet = b && b.classList.contains('sheet-open') && (global.innerWidth || 0) <= 780;
    if (sheet || !mapBusy()) { fps = fps ? Math.min(fps, 30) : 30; } var pc = global.DG.deviceMode && global.DG.deviceMode.fpsCap ? global.DG.deviceMode.fpsCap() : 0; if (pc) { fps = fps ? Math.min(fps, pc) : pc; }   // W-0417 폰 30fps 상한(발열)
    return fps > 0 ? 1000 / fps : 0;
  }

  function tick(now) {
    if (!active()) { loopRunning = false; return; }
    /* 화면에 보이는 채로 다른 창을 쓰는 중이면 렌더를 쉰다 — 안 그러면
       천천히 도는 카메라만으로도 계속 GPU 를 잡아먹는다(2026-09-08) */
    if (document.hidden || !document.hasFocus() || (document.body && document.body.classList.contains('cpg-on'))) {   // 10-31 장 흐름 화면이 위에 떠 있으면 뒤 3D 지도는 쉰다(검토 시트 ①)
      global.setTimeout(function () { requestAnimationFrame(tick); }, 500);
      return;
    }
    var gap = tickGapMs();
    if (gap && (now || 0) - lastTickT < gap - 2) { requestAnimationFrame(tick); return; }
    var dtq = lastTickT && now ? (now - lastTickT) / 1000 : 0; lastTickT = now || 0; if (AQ() && AQ().note(dtq * 16.7 / Math.max(16.7, gap || 16.7), isAutoQ()) && renderer) { renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, DPR())); }   /* W-0302 자동 품질 — 일부러 30·10fps 로 낮춘 간격(gap) 대비로 환산해 잰다 */
    yaw += (targetYaw - yaw) * 0.15;
    pitch += (targetPitch - pitch) * 0.15;
    dist += (targetDist - dist) * 0.15;
    pivotX += (targetPivotX - pivotX) * 0.15;
    pivotZ += (targetPivotZ - pivotZ) * 0.15;

    if (global.DG.mount && global.DG.mount.frame) { global.DG.mount.frame(); }       // 비행 단추·내림 판정(mount.js)
    var flyBob = flightOn ? Math.sin((now || 0) / 800) * 2.2 : 0;                  // 나는 동안 살짝 출렁
    camera.position.set(
      pivotX + Math.cos(pitch) * Math.sin(yaw) * dist,
      Math.sin(pitch) * dist + pivotY + 6 + flyBob,
      pivotZ + Math.cos(pitch) * Math.cos(yaw) * dist
    );
    camera.lookAt(pivotX, pivotY + 6, pivotZ);
    /* 안개는 카메라 거리를 따라간다 — 260~900 으로 고정해 두면 멀리 물러날 때
       (dist 최대 900) 중심(피벗)까지가 이미 안개 끝이라 지도 전체가 뿌옇다.
       바닥값은 예전 값이라 가까이서 볼 때는 그대로다 */
    if (scene.fog) {
      scene.fog.near = Math.max(260, dist * 1.15);
      scene.fog.far = Math.max(900, dist * 3.4);
    }

    var t = now || 0;
    for (var i = 0; i < pulseRings.length; i++) {
      var s = 1 + Math.sin(t / 400 + i) * 0.08;
      pulseRings[i].mesh.scale.setScalar(s);
    }
    for (var j = 0; j < floaters.length; j++) {
      var fl = floaters[j];
      fl.mesh.position.y = fl.baseY + Math.sin(t / 450 + fl.seed) * fl.amp;
    }
    for (var m = marches.length - 1; m >= 0; m--) {
      var mm = marches[m];
      /* tick(now) 의 매개변수 now 가 모듈 함수 now() 를 가린다(같은 단위 —
         rAF 타임스탬프도 performance.now() 기준이라 매개변수를 그대로 쓴다) */
      var frac = Math.min(1, (t - mm.t0) / mm.dur);
      var mx = mm.ax + (mm.bx - mm.ax) * frac, mz = mm.az + (mm.bz - mm.az) * frac;
      mm.grp.position.set(mx, elevAt(mx, mz), mz);
      if (frac >= 1) { fx.remove(mm.grp); marches.splice(m, 1); }
    }
    tickActors(t);
    statCull(); if (global.DG.nightglow3d) { var RSn = global.DG.realmSky3d, todN = RSn && RSn.todOf && RSn.current ? RSn.todOf(RSn.current().month) : 'noon'; global.DG.nightglow3d.update(scene, camera, ({ night: 1, sunset: 0.4, dawn: 0.4 })[todN] || 0); }   // W-0358 밤 불빛

    if (global.DG.realmWater3d) { global.DG.realmWater3d.tick(t, scene, tier()); } if (global.DG.realmSky3d && global.DG.realmSky3d.tick) { global.DG.realmSky3d.tick(camera); } if (global.DG.realmShadow3d) { global.DG.realmShadow3d.follow(pivotX, pivotZ, tier()); } if (global.DG.post3d) { global.DG.post3d.present(renderer, scene, camera, { alt: 0.9, weather: 'clear' }); } else { renderer.render(scene, camera); }   // W-0141 물결 시계
    requestAnimationFrame(tick);
  }

  global.DG = global.DG || {}; global.DG.perf = global.DG.perf || { tier: function () { return { key: String(tier()).toUpperCase() }; } };   // W-0292 post3d 가 등급을 읽는 자리(로드 때 정의)
  global.DG.realm3d = {
    available: available,
    active: active,
    /** 10-26 사용자가 3D 지도를 골랐나(2D 고름이면 전황·전술판·초상·성도 2D — battle3d·tactics-view3d·portrait3d·city3d 가 본다) */
    wants3d: ON, _lazy: function () { return { lazy: lazy, ready: ready, failed: failed, canvas: !!canvas, renderer: !!renderer }; },   // 진단
    /** 진단 — 정적 소품 묶기 결과 {props, meshes, draws} (아직이면 null)·순수 재질 지문 */
    staticInstStats: function () { return ST().stats(); },
    staticCullStats: function () { return ST().cullStats(); }, _matSig: matSig, _tickGapMs: tickGapMs,
    init: init,
    toggle: toggle,
    rebuild: rebuild,
    showMarch: showMarch,
    /* PLAN §5-10 지도 위 배우 — three 없이 도는 순수 함수(_test.html) */
    actorPlan: actorPlan,
    actorPos: actorPos,
    journeyPos: journeyPos,
    ACTOR_MAX: ACTOR_MAX,
    ORDER_GESTURES: ORDER_GESTURES,
    battleBeat: battleBeat,
    wanderPos: wanderPos,
    zoomFor: zoomFor,
    WANDER_MAX: WANDER_MAX,
    BATTLE_MAX: BATTLE_MAX,
    panBy: panBy,
    setFlight: setFlight,
    flying: flying,
    focusMap: focusMap,
    panTo: panTo,
    /* SAGA-DESIGN §7-2 "3D 진단 공백" — three 없이도 도는 순수 함수라 _test.html 이 부른다 */
    elevAt: elevAt,
    straitFactor: straitFactor,
    isSea: isSea,
    /* SAGA-DESIGN §8 성능 상한(PLAN §7-2) — 품질 등급 손잡이, 순수 함수도 같이 */
    setQuality: setQuality,
    tier: tier,
    deviceScore: deviceScore,
    tierFor: tierFor,
    qualityPreset: function () { return QUALITY_PRESET; }
  };

  /* 세력이 바뀌거나(정벌·외교) 달이 넘어가면 다시 짓는다 — 켜져 있을 때만.
   * core.js 는 이 스크립트보다 앞서 실려 있다(index.html 순서) */
  global.DG.core.on('changed', function () { if (active()) { rebuild(); } }); global.DG.core.on('region', function () { if (active()) { rebuild(); regionFocus(); } });   // W-0400 지역을 넘기면 3D 도
})(window);
