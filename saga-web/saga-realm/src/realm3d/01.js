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
  function ON() { return C().tuned('realm3d.on', 0) ? true : false; }   /* 기본은 2D 전략 지도 — 3D 는 🧊 단추로 켠다(W-0027, 2026-10-03) */
  function WORLD_SCALE() { return C().tuned('realm3d.worldScale', 4.5); }
  function FOV() { return C().tuned('realm3d.fov', 50); }
  function PITCH_MIN() { return C().tuned('realm3d.pitchMin', 0.35); }
  function PITCH_MAX() { return C().tuned('realm3d.pitchMax', 1.3); }
  function DIST_MIN() { return C().tuned('realm3d.distMin', 90); }
  function DIST_MAX() { return C().tuned('realm3d.distMax', 900); }
  /** 지도 위 배우(PLAN §5-10) — 0 이면 옛 지도(원정은 🚩 깃발만). 카메라가
   *  `actorLod` 보다 멀면 배우를 숨기고 옛 깃발로 돌아간다 */
  function ACTORS_ON() { return C().tuned('realm3d.actors', 1) ? true : false; }
  function ACTOR_LOD() { return C().tuned('realm3d.actorLod', 480); }
  /** ⑤ 성을 누르면 그 성 태수에게 다가가는 줌 — 0 이면 예전처럼 카메라는 그대로 */
  function CITY_ZOOM() { return C().tuned('realm3d.cityZoom', 1) ? true : false; }
  /** 병사 몸(2026-09-25) — 1 이면 원정군 병사가 CC0 기사·기병(`asset3d.buildTrooper`), 0 이면 옛 도형 */
  function TROOP_MODEL() { return C().tuned('realm3d.troopModel', 1) ? true : false; }

  /**
   * 그래픽 품질 3단(SAGA-DESIGN §8 성능 상한, PLAN §7-2 "성능 상한") — 이 판은
   * 걷는 인물이 없어 saga-forest `village-view3d.js` 처럼 "인물 주변 렌더
   * 반경"을 좁힐 대상이 없다. 대신 값이 큰 두 축만 등급표로 묶는다 —
   * 픽셀 비율(dpr, 폰 GPU 부담의 대부분)과 `scatterField()` 빈 들 소품 밀도
   * (전체 1070개 선 중 가장 큰 덩이). 성 둘레(`scatterAround`/`scatterSmall`,
   * 카메라가 늘 머무는 자리)는 등급과 무관하게 항상 다 세운다 — 그림 손실
   * 체감이 크고 수도 field 쪽보다 훨씬 적어서다. `deviceScore`/`probeDevice`는
   * saga-forest 것과 같은 요령(순수 함수 — three 없이도 헤드리스로 진단된다).
   */
  var QUALITY_PRESET = {
    low:    { dpr: 1,   fieldDensity: 16 },
    medium: { dpr: 1.5, fieldDensity: 24 },
    high:   { dpr: 2,   fieldDensity: 32 }
  };
  function QUALITY() { return C().tuned('realm3d.quality', 'auto'); }
  function deviceScore(o) {
    var s = 0;
    var cores = o.cores || 0, mem = o.mem || 0;
    var px = (o.w || 0) * (o.h || 0) * (o.dpr || 1) * (o.dpr || 1);
    s += cores >= 8 ? 2 : (cores >= 4 ? 1 : (cores > 0 ? 0 : 1));
    s += mem >= 8 ? 2 : (mem >= 4 ? 1 : (mem > 0 ? 0 : 1));
    s += px > 4000000 ? -1 : (px > 1600000 ? 0 : 1);
    if (o.touch) { s -= 1; }
    return s;
  }
  function tierFor(score) { return score >= 3 ? 'high' : (score >= 1 ? 'medium' : 'low'); }
  function probeDevice() {
    var n = global.navigator || {}, sc = global.screen || {};
    return {
      cores: n.hardwareConcurrency || 0, mem: n.deviceMemory || 0,
      w: sc.width || 0, h: sc.height || 0, dpr: global.devicePixelRatio || 1,
      touch: !!(('ontouchstart' in global) || (n.maxTouchPoints > 0))
    };
  }
  var autoTierCache = null;
  function autoTier() {
    if (!autoTierCache) { autoTierCache = tierFor(deviceScore(probeDevice())); }
    return autoTierCache;
  }
  /** 고정 값(low/medium/high)이면 그걸, 'auto'면 켤 때 한 번 잰 등급을 쓴다 */
  function tier() {
    var q = QUALITY();
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
  /* ── 해협(海峽) — 섬을 가르는 진짜 바다 ──────────────────────
   * `CD.isWater()`는 강(river) 지형끼리 맞닿으면 다 물길로 잡는데, 그 안에는
   * 양자강·한수 같은 **내륙 강**도 섞여 있다(실측해 보니 거리로는 못 가른다 —
   * 예컨대 대륙 안 수춘↔시상 19.7 이 김해↔대마도 11.7 보다 오히려 멀다).
   * 진짜로 **뭍을 갈라 섬을 만드는 바다**는 PLAN.md 26-2절에 적힌 이 다섯
   * 구간뿐이다(일본 열도를 대륙·서로 갈라놓는 대한해협·일기해협·간몬해협
   * 셋, 교주의 연안 항로 하나 — 김해↔대마도는 그 시작점) — 그래서 휴리스틱
   * 대신 여기 목록으로 못 박는다. 이 구간 둘레만 지형을 해수면 아래로
   * 파내려, 나머지 물길(내륙 강)은 예전 그대로 얇은 파란 길(addRoad)로 남는다. */
  var STRAITS = [
    ['gimhae', 'tsushima'], ['tsushima', 'iki'], ['iki', 'chikushi'],
    ['chikushi', 'izumo'], ['hepu', 'jiaozhi'],
    /* 2026-09-22 — 대진(안식↔려건, 감영이 실제로 못 건넌 "서해")·
       남해(합포↔주애 경주해협, 주애↔이주 대만해협) 세 구간을 더했다 */
    ['anxi', 'lijian'], ['hepu', 'zhuya'], ['zhuya', 'yizhou']
  ];
  var STRAIT_HALF_WIDTH = 30;      // 해협 폭의 절반(세계 단위) — 이 안쪽이 바다
  var STRAIT_DEPTH = 22;           // 해협 바닥이 SEA_LEVEL 아래로 파이는 깊이
  var STRAIT_LAND_MARGIN = 18;     // 구간 양 끝(=섬 성 그 자체)에서 이만큼은 절대 안 파인다
  var SEA_LEVEL = -6;              // 해수면 높이 — baseNoise 최저치(-NOISE_AMP)보다 낮게 잡아
                                    // 성과 먼 빈 들판이 우연히 물에 잠기지 않도록 한다

  var straitSegs = null;
  function straitSegments() {
    if (straitSegs) { return straitSegs; }
    straitSegs = [];
    var i, a, b;
    for (i = 0; i < STRAITS.length; i++) {
      a = cityData().find(STRAITS[i][0]); b = cityData().find(STRAITS[i][1]);
      if (!a || !b) { continue; }
      var ax = worldX(a.x), az = worldZ(a.y), bx = worldX(b.x), bz = worldZ(b.y);
      straitSegs.push({ ax: ax, az: az, bx: bx, bz: bz, len: Math.hypot(bx - ax, bz - az) });
    }
    return straitSegs;
  }

  /** 가장 가까운 해협 구간까지 거리 → 0(구간 위)~1(폭 밖) 파임 비율.
   *  **두 축을 같이 본다** — ①구간에 대한 수직 거리(폭, STRAIT_HALF_WIDTH)
   *  ②구간을 따라 잰 거리(구간 양 끝에서 STRAIT_LAND_MARGIN 안쪽은 안 판다).
   *  둘째 축이 없으면 구간의 두 끝점 — 대마도·일기도 같은 **섬 성 그 자체** —
   *  이 자기 자리에서 거리 0 으로 잡혀 성이 통째로 물에 잠긴다. 가운데
   *  트인 바다만 파이고, 두 기슭은 smoothstep 으로 매끄럽게 뭍으로 돌아간다 */
  function straitFactor(wx, wz) {
    var segs = straitSegments(), i, s, best = 0;
    for (i = 0; i < segs.length; i++) {
      s = segs[i];
      var dx = s.bx - s.ax, dz = s.bz - s.az, len2 = dx * dx + dz * dz;
      var tt = len2 > 0 ? ((wx - s.ax) * dx + (wz - s.az) * dz) / len2 : 0;
      tt = Math.max(0, Math.min(1, tt));
      var d = Math.hypot(wx - (s.ax + dx * tt), wz - (s.az + dz * tt));
      if (d >= STRAIT_HALF_WIDTH) { continue; }
      var fPerp = 1 - smoothstep(d / STRAIT_HALF_WIDTH);
      var margin = Math.min(STRAIT_LAND_MARGIN, s.len * 0.45);
      var alongEdge = Math.min(tt, 1 - tt) * s.len;
      var fAlong = margin > 0 ? smoothstep(Math.max(0, Math.min(1, alongEdge / margin))) : 1;
      var f = fPerp * fAlong;
      if (f > best) { best = f; }
    }
    return best;
  }

  /** 지형 높이 — 이 함수 하나가 바닥 · 성 · 소품 · 길 · 카메라가 다 같이 읽는
   *  단일 진실 값이다(따로 잰 높이를 쓰면 소품이 바닥에 파묻히거나 뜬다) */
  function elevAt(wx, wz) {
    var normal = baseNoise(wx, wz) * NOISE_AMP + cityBump(wx, wz);
    var f = straitFactor(wx, wz);
    if (!f) { return normal; }
    var seaFloor = SEA_LEVEL - STRAIT_DEPTH;
    return normal + (seaFloor - normal) * f;
  }

  /** 이 자리가 물속인가 — scatterAround·scatterField 등 소품을 흩는 자리마다
   *  물어봐서, 해협 한복판(트인 바다)에 나무·바위·집이 잠겨 서는 일을 막는다 */
  function isSea(wx, wz) { return elevAt(wx, wz) < SEA_LEVEL; }

  /** 바닥 — 단색 한 장이 밋밋해서(퀄리티 피드백) **성 지형(land)마다 다른 색을
   *  그 둘레로 은은하게 물들이고**(들판=풀빛·구릉=흙빛·강가=옅은 청록·산=잿빛),
   *  그 위에 옅은 얼룩 점묘를 얹는다. 실제 사진이 아니라 해시로 찍은 점묘·원이라
   *  매번 같다(진단 결정성과 같은 이유) — `cityData()` 가 성마다의 x·y·land 를
   *  훑을 뿐 새 데이터를 만들지 않는다("코드가 아니라 값을 재사용" 원칙). */
  function groundTexture() {
    var t = three();
    var size = 512;
    var cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    var c = cv.getContext('2d');
    c.fillStyle = BIOME_COLOR.plain;
    c.fillRect(0, 0, size, size);

    function toPx(wx, wz) {
      return { x: (wx + GROUND_SPAN / 2) / GROUND_SPAN * size, y: (wz + GROUND_SPAN / 2) / GROUND_SPAN * size };
    }

    var cities = cityData().CITIES, i;
    for (i = 0; i < cities.length; i++) {
      var city = cities[i];
      var land = city.land || 'plain';
      if (land === 'plain') { continue; }        // 바탕색과 같아 그릴 것이 없다
      var col = BIOME_COLOR[land] || BIOME_COLOR.plain;
      var p = toPx(worldX(city.x), worldZ(city.y));
      var rad = size * 0.085;
      var g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(p.x, p.y, rad, 0, Math.PI * 2); c.fill();
    }

    var n = 3200;
    for (i = 0; i < n; i++) {
      var hh = hashOf('gtex:' + i);
      var x = hh % size, y = (hh >> 9) % size, r = 1.4 + (hh % 3);
      var tone = (hh >> 18) % 3;
      c.fillStyle = tone === 0 ? 'rgba(120,150,70,0.10)' : (tone === 1 ? 'rgba(235,228,175,0.08)' : 'rgba(90,128,58,0.12)');
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }

    var tex = new t.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = t.ClampToEdgeWrapping;
    if (t.SRGBColorSpace) { tex.colorSpace = t.SRGBColorSpace; }
    return tex;
  }

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

  function init(cv) {
    var t = three();
    canvas = cv;
    if (!t || !canvas) { failed = true; return; }
    try {
      renderer = new t.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    } catch (e) { failed = true; return; }
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, DPR()));
    if (global.DG.toon3d && global.DG.toon3d.toneRenderer) { global.DG.toon3d.toneRenderer(renderer); }   // Neutral 톤매핑(2026-09-23)

    scene = new t.Scene();
    scene.background = (global.DG.toon3d && global.DG.toon3d.skyBackground) ? global.DG.toon3d.skyBackground(0x9fd0e8) : new t.Color(0x9fd0e8);   // 하늘 그라디언트(2026-09-23, 아래는 안개색 그대로)
    scene.fog = new t.Fog(0x9fd0e8, 260, 900);

    camera = new t.PerspectiveCamera(FOV(), 1, 0.5, 2400);

    var TNg = global.DG.toon3d, LG = TNg && TNg.lightGain ? TNg.lightGain() : 1;   // 톤매핑을 켜면 빛을 올린다(toon3d.toneRenderer)
    scene.add(new t.HemisphereLight(0xffffff, 0x4a5a3a, 0.95 * LG));
    var sun = new t.DirectionalLight(0xfff4e0, 1.0 * LG);
    sun.position.set(-120, 200, 90);
    scene.add(sun);

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
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    /* 바다 — 해협(STRAITS) 자리만 지형이 SEA_LEVEL 아래로 파여 있어서, 이
     * 평평한 판 한 장을 그 높이에 깔아 두면 파인 곳에서만 바닥을 대신해
     * 드러난다(카메라가 늘 위에서 내려다보므로 나머지는 땅에 가려 안 보인다
     * — 새 좌표계·새 렌더 패스 없이 z-버퍼만으로 해안선이 선다) */
    var sea = new t.Mesh(
      new t.PlaneGeometry(GROUND_SPAN, GROUND_SPAN),
      new t.MeshPhongMaterial({ color: 0x2f7bb0, transparent: true, opacity: 0.88, shininess: 60 })
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
    camera.updateProjectionMatrix();
  }

  function syncVisibility() {
    var map2d = document.getElementById('realm');
    if (!canvas) { return; }
    var on = active();
    canvas.style.display = on ? 'block' : 'none';
    if (map2d) { map2d.style.display = on ? 'none' : ''; }
    if (on) { resize(); startLoop(); rebuild(); }
  }

  function toggle() {
    if (!available()) { return false; }
    C().setTune('realm3d.on', ON() ? 0 : 1);
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
        statShadowInst = new t.InstancedMesh(blobGeo, blobMat, SHADOW_MAX);
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
      shadowInst = new t.InstancedMesh(blobGeo, blobMat, SHADOW_MAX);
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
    if (isStatic) { statPending++; }
    asset3d().build(kind, { id: id }, function (g) {
      if (isStatic) { statPending--; }
      if (!g) { if (isStatic) { maybeFreezeStatic(); } return; }
      if (isStatic) { if (!statGrp) { return; } }
      else if (seq !== rebuildSeq || !dyn) { return; }
      g.position.set(x, elevAt(x, z), z);
      g.rotation.y = rotY || 0;
      g.scale.setScalar(scaleH);
      if (isStatic) { g.userData.instOk = true; }
      g2.add(g);
      addShadow(x, z, scaleH * 0.4, g2);
      if (isStatic) { maybeFreezeStatic(); }
    });
  }

  /* 발열(2026-09-24 "핸드폰 불남") — 정적 소품(나무·바위·집·우물… 약 1,070개)은 저마다 GLB 사본이라 부품마다 따로
     그렸다(그리기 호출 수천 번/프레임). 모두 도착하면 **같은 지오메트리·같은 재질 값**끼리 InstancedMesh 하나로 묶는다 —
     자리·크기·돌림은 원래 행렬 그대로라 그림은 똑같다. 스킨·셰이더 덧대기·빛·스프라이트가 든 것은 안 묶고 그대로 둔다.
     손잡이 `realm3d.staticInst`(기본 1, 0 이면 예전 그대로) */
  var statPending = 0, statFrozen = false, statInst = [];
  function STATIC_INST() { return C().tuned('realm3d.staticInst', 1) ? true : false; }
  function maybeFreezeStatic() {
    if (statPending > 0 || !staticBuilt || statFrozen) { return; }
    freezeStatic();
  }
  function hexOrNo(c) { return c && c.getHex ? c.getHex() : -1; }
  function uuidOrNo(x) { return x ? x.uuid : '-'; }
  /** 재질 값의 지문 — 이 값이 같으면 보이는 모습이 같다 */
  function matSig(m) {
    return [m.type, hexOrNo(m.color), hexOrNo(m.emissive), uuidOrNo(m.map), uuidOrNo(m.gradientMap), uuidOrNo(m.alphaMap),
      m.transparent ? 1 : 0, m.opacity, m.alphaTest, m.side, m.vertexColors ? 1 : 0, m.flatShading ? 1 : 0,
      m.depthWrite ? 1 : 0, m.fog ? 1 : 0, m.wireframe ? 1 : 0].join(',');
  }
  function freezeStatic() {
    var t = three();
    if (!t || !statGrp || !STATIC_INST() || !t.InstancedMesh) { return; }
    statFrozen = true;
    statGrp.updateMatrixWorld(true);
    var inv = new t.Matrix4().copy(statGrp.matrixWorld).invert();
    var groups = {}, order = [], roots = [], own = Object.prototype.hasOwnProperty;
    statGrp.children.slice().forEach(function (root) {
      if (!root.userData || !root.userData.instOk) { return; }
      var ok = true, list = [];
      root.traverse(function (o) {
        if (!ok) { return; }
        if (o.isSkinnedMesh || o.isInstancedMesh || o.isLight || o.isSprite || o.isPoints || o.isLine) { ok = false; return; }
        if (!o.isMesh) { return; }
        var m = o.material;
        if (!m || Array.isArray(m) || m.isShaderMaterial || own.call(m, 'onBeforeCompile') || !o.geometry || o.geometry.morphAttributes && Object.keys(o.geometry.morphAttributes).length) { ok = false; return; }
        if (!o.visible) { return; }
        list.push(o);
      });
      if (!ok || !list.length) { return; }
      list.forEach(function (o) {
        var k = o.geometry.uuid + '|' + matSig(o.material) + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0) + '|' + o.renderOrder;
        var g = groups[k];
        if (!g) { g = groups[k] = { geo: o.geometry, mat: o.material, cast: o.castShadow, recv: o.receiveShadow, ro: o.renderOrder, mats: [] }; order.push(k); }
        g.mats.push(new t.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      });
      roots.push(root);
    });
    order.forEach(function (k) {
      var g = groups[k], im = new t.InstancedMesh(g.geo, g.mat, g.mats.length), i;
      for (i = 0; i < g.mats.length; i++) { im.setMatrixAt(i, g.mats[i]); }
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = g.cast; im.receiveShadow = g.recv; im.renderOrder = g.ro;
      /* 덩이 하나가 지도 끝에서 끝까지 흩어져 있어 덩이째 자르기(경계 구)는 늘 "보임"이다 — 폰 점검(2026-09-25)에서
         삼각형 575만 중 시야 안 38만. 자리마다 행렬·월드 구를 따로 적어 두고 `statCull` 이 카메라가 움직일 때만
         시야(안개 끝 안) 자리를 앞쪽에 채운다. 그림자 지도를 받는 덩이(castShadow)는 안 자른다 */
      if (!g.geo.boundingSphere) { g.geo.computeBoundingSphere(); }
      var bs = g.geo.boundingSphere, all = new Float32Array(g.mats.length * 16), sph = new Float32Array(g.mats.length * 4);
      var cw = new t.Vector3(), ws = new t.Vector3();
      for (i = 0; i < g.mats.length; i++) {
        var mw = new t.Matrix4().multiplyMatrices(statGrp.matrixWorld, g.mats[i]);
        g.mats[i].toArray(all, i * 16);
        cw.copy(bs.center).applyMatrix4(mw);
        ws.setFromMatrixScale(mw);
        sph[i * 4] = cw.x; sph[i * 4 + 1] = cw.y; sph[i * 4 + 2] = cw.z;
        sph[i * 4 + 3] = bs.radius * Math.max(ws.x, ws.y, ws.z);
      }
      im.frustumCulled = false;
      im.userData.cull = { all: all, sph: sph, n: g.mats.length };
      im.userData.staticInst = true;
      statGrp.add(im);
      statInst.push(im);
    });
    roots.forEach(function (r) { statGrp.remove(r); });
    statFreezeStats = { props: roots.length, meshes: order.reduce(function (s, k) { return s + groups[k].mats.length; }, 0), draws: order.length };
    statCullPV = null;     // 다음 프레임에 한 번 자른다
  }
  var statFreezeStats = null;

  /** 묶은 정적 소품을 자리마다 자른다 — 카메라 시야 밖·안개 끝 너머(안개 색뿐)만 뺀다. 그림은 그대로다 */
  var statCullPV = null, statCullFr = null, statCullNow = null, statCullStat = { all: 0, drawn: 0, runs: 0 };
  function statCull() {
    if (!statInst.length) { return; }
    var t = three();
    if (!statCullFr) { statCullFr = new t.Frustum(); statCullNow = new t.Matrix4(); }
    camera.updateMatrixWorld();
    statCullNow.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    var fog = scene.fog && scene.fog.isFog ? scene.fog.far : 0;
    if (statCullPV && statCullPV.equals(statCullNow) && statCullStat.fog === fog) { return; }
    if (!statCullPV) { statCullPV = new t.Matrix4(); }
    statCullPV.copy(statCullNow);
    statCullStat.fog = fog;
    statCullFr.setFromProjectionMatrix(statCullNow);
    var pl = statCullFr.planes, cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    var shadowOn = !!(renderer.shadowMap && renderer.shadowMap.enabled);
    var all = 0, drawn = 0;
    for (var k = 0; k < statInst.length; k++) {
      var im = statInst[k], U = im.userData.cull;
      if (!U) { continue; }
      all += U.n;
      if (shadowOn && im.castShadow) {
        if (im.count !== U.n) { im.instanceMatrix.array.set(U.all); im.count = U.n; im.instanceMatrix.needsUpdate = true; }
        drawn += U.n; continue;
      }
      var arr = im.instanceMatrix.array, sp = U.sph, j = 0;
      for (var i = 0; i < U.n; i++) {
        var x = sp[i * 4], y = sp[i * 4 + 1], z = sp[i * 4 + 2], r = sp[i * 4 + 3], out = false;
        for (var q = 0; q < 6; q++) {
          var nn = pl[q].normal;
          if (nn.x * x + nn.y * y + nn.z * z + pl[q].constant < -r) { out = true; break; }
        }
        if (out) { continue; }
        if (fog) {
          var dx = x - cx, dy = y - cy, dz = z - cz, lim = fog + r;
          if (dx * dx + dy * dy + dz * dz > lim * lim) { continue; }
        }
        arr.set(U.all.subarray(i * 16, i * 16 + 16), j * 16);
        j++;
      }
      im.count = j;
      if (j) {
        var ia = im.instanceMatrix;
        if (ia.clearUpdateRanges) { ia.clearUpdateRanges(); ia.addUpdateRange(0, j * 16); }
        ia.needsUpdate = true;
      }
      drawn += j;
    }
    statCullStat.all = all; statCullStat.drawn = drawn; statCullStat.runs++;
  }

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
    bannerCluster(n, px + 4, pz, col);

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

  /** 원정 하나가 경로 위 지금 어디쯤 있는가(화면 x·y) — `ui-rtk.js` 의
   *  `journeyPos()` 와 같은 구간별 실거리 보간이다(두 파일이 같은 값을
   *  따로 계산한다 — 2D·3D 가 별 모듈이라 공유할 자리가 마땅치 않다) */
  /*  `elapsed`(선택)를 주면 `j.monthsElapsed` 대신 그 값(소수 가능)으로 잰다 —
   *  배우가 지난달 자리→이번 달 자리로 길을 따라 걷는 보간(PLAN §5-10 ①)이
   *  같은 함수를 쓴다. 안 주면 예전 그대로다 */
  function journeyPos(j, elapsed) {
    var CDx = cityData();
    var path = j.path, i;
    if (!path || path.length < 2) {
      var only = path && CDx.find(path[0]);
      return only ? { x: only.x, y: only.y } : null;
    }
    var el = (elapsed === undefined || elapsed === null) ? (j.monthsElapsed || 0) : elapsed;
    var frac = clamp(el / (j.monthsTotal || 1), 0, 0.999);
    var segs = [], total = 0;
    for (i = 0; i < path.length - 1; i++) {
      var a = CDx.find(path[i]), b = CDx.find(path[i + 1]);
      if (!a || !b) { continue; }
      var len = Math.hypot(a.x - b.x, a.y - b.y);
      segs.push({ a: a, b: b, len: len });
      total += len;
    }
    if (!segs.length) { return null; }
    if (!total) { return { x: segs[0].a.x, y: segs[0].a.y }; }
    var target = frac * total, acc = 0;
    for (i = 0; i < segs.length; i++) {
      if (acc + segs[i].len >= target || i === segs.length - 1) {
        var sf = segs[i].len > 0 ? clamp((target - acc) / segs[i].len, 0, 1) : 0;
        return { x: segs[i].a.x + (segs[i].b.x - segs[i].a.x) * sf,
                 y: segs[i].a.y + (segs[i].b.y - segs[i].a.y) * sf };
      }
      acc += segs[i].len;
    }
    return { x: segs[segs.length - 1].b.x, y: segs[segs.length - 1].b.y };
  }

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

