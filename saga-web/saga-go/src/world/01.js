/**
 * 월드 — 위치 공급자 / 실제 지도 타일 / 스폰 / 시점(2D·2.5D·3D) 렌더
 * ---------------------------------------------------------------
 * 지도는 실제 지도 타일(CARTO basemap)을 깐다. 타일을 받지 못하는 환경이면
 * 자동으로 프로시저럴 지형 렌더로 폴백한다.
 *
 * 좌표계
 *   - 게임 로직은 전부 "원점(origin)에서 몇 미터" 인 평면 좌표를 쓴다.
 *   - 화면에 그릴 때만 미터 → 화면 픽셀로 환산한다 (scale = px/m).
 *   - 그래서 키보드 이동이든 실제 GPS든 같은 코드가 그대로 통한다.
 *
 * 위치 공급자
 *   'keyboard' : PC 프로토타입용 가짜 이동 (WASD/방향키)
 *   'geo'      : 실제 GPS. 켜는 순간 현재 위치로 지도가 이동한다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var data = global.DG.data;

  /* 지도를 켜면 처음 보게 될 기본 위치 (GPS 를 켜면 실제 위치로 대체된다) */
  var DEFAULT_ORIGIN = { lat: 37.39465, lng: 127.11138 };   // 판교역 일대

  var ZOOM = 17;
  var TILE_PX = 256;
  var SPAWN_RADIUS = 320, SPAWN_MIN = 25;   // 스폰 반경·최소 거리 (m)
  var ENCOUNTER_RANGE = 46;   // 조우 가능 거리 (m)
  var REGION_SIZE = 576;      // 구역 한 변 (m)
  var MAX_SPAWNS = 14;        // W-0174 10 → 14 — 첫 10분 집 둘레가 비었다(재미표준 E)
  var SPAWN_LIFE = 100000;

  var spawns = [];
  /**
   * 키보드 이동 속도 (m/s). 프로토타입 값은 34 였는데, 그것은 122km/h 라 걷는 게임의
   * 거리 보상(250m 마다 보급)이 7초에 한 번씩 터졌다. 8m/s 는 자전거보다 조금 빠른
   * 정도로, 보급이 31초(달리면 14초)에 한 번 온다. 스폰 반경 320m 안의 목표까지
   * 걸어가는 데 25초쯤 걸려 조우를 고르는 맛도 남는다.
   * GPS 모드(useGeo)는 실제 위치를 쓰므로 이 값과 무관하다.
   */
  var speed = 8, credit2d = 1;   // credit2d — W-0226 걸은 거리 셈 배율(2D 가 빨라진 만큼 나눠 시간당 보상은 3D 와 같게)

  /**
   * 걸음 배속 — **눈으로 확인하려고 두는 손잡이**다. 반려(1~5km)·천거장(2~10km)처럼
   * 킬로미터 단위로 걷는 축을 손으로 보려면 8m/s 로는 한 몫에 10분이 든다.
   * **규칙은 하나도 건드리지 않는다** — 보급 주기·거리 문턱은 그대로고 이동만 곱한다.
   * 그래서 배속으로 걸어도 얻는 것은 그 거리를 실제로 걸었을 때와 같다.
   *
   * 값은 어드민(`_admin.html`)이 잡는다. **매 프레임 읽으므로 곧바로 듣는다** —
   * 어드민에서 올리면 게임 창을 새로고침하지 않아도 그 자리에서 빨라진다.
   * GPS 모드(useGeo)는 실제 위치라 이 값과 무관하다.
   */
  function speedMul() { return core.clamp(core.tuned('world.speedMul', 1), 0.1, 64); }

  var keys = {};
  var stick = { dx: 0, dy: 0, run: false };   // 화면 스틱(터치)
  var walkTarget = null;                      // 탭한 지점 (도착하면 지워진다)
  var mode = 'keyboard';
  var geoWatchId = null;
  var origin = { lat: DEFAULT_ORIGIN.lat, lng: DEFAULT_ORIGIN.lng };
  var geoAccuracy = null;

  /* 플레이어 걸음 상태 — 키보드든 GPS든 "위치가 얼마나 변했는지"로만 판단하므로
     이동 방식이 바뀌어도 애니메이션 코드는 그대로 쓴다. */
  var player = {
    prev: null,      // 직전 위치
    vx: 0, vy: 0,    // 초당 이동 (m/s)
    speed: 0,
    facing: 1,       // 1 오른쪽 / -1 왼쪽
    phase: 0,        // 걸음 위상
    footAcc: 0,      // 발자국 간격 누적 거리
    footSide: 1,
    trailAcc: 0      // 발자취(전체 지도용) 간격 누적 거리
  };
  var footprints = [];         // { x, y, at, side }
  var FOOT_LIFE = 7000;        // 발자국이 사라지기까지 (ms)
  var clickMarks = [];         // { x, y, at } — 클릭(탭)한 자리 표시
  var CLICK_MARK_LIFE = 850;   // 클릭 표시가 사라지기까지 (ms)
  var WANDER_R = 15;           // 야생 대상이 배회하는 반경 (m)
  var WANDER_SPEED = 2.6;      // 배회 속도 (m/s)
  var TRAIL_STEP = 40;         // 발자취를 한 점 남기는 간격 (m) — PLAN 25-1절
  var TRAIL_MAX = 400;         // 발자취 최대 점 수 (넘으면 오래된 것부터 지운다)

  /* ── 좌표 변환 ────────────────────────────────────────── */

  function metersPerPixel() {
    return 156543.03392 * Math.cos(origin.lat * Math.PI / 180) / Math.pow(2, ZOOM);
  }
  /** px per meter — 2D·2.5D 화면 확대 배율(camZoom2d)을 얹는다. 지도 타일은
      원래 zoom 레벨(ZOOM)대로 받아 두고 그리는 크기만 이 배율로 늘이거나
      줄인다(drawGround) — 다시 받아올 필요가 없다 */
  function scale() { return (1 / metersPerPixel()) * camZoom2d(); }

  /** 위경도 → 월드 미터 좌표 */
  function latLngToWorld(lat, lng) {
    var mPerLat = 111320;
    var mPerLng = 111320 * Math.cos(origin.lat * Math.PI / 180);
    return { x: (lng - origin.lng) * mPerLng, y: -(lat - origin.lat) * mPerLat };
  }
  /** 월드 미터 좌표 → 위경도 */
  function worldToLatLng(x, y) {
    var mPerLat = 111320;
    var mPerLng = 111320 * Math.cos(origin.lat * Math.PI / 180);
    return { lat: origin.lat - y / mPerLat, lng: origin.lng + x / mPerLng };
  }
  /** 위경도 → 지도 전역 픽셀 (Web Mercator, ZOOM 기준) */
  function latLngToPixel(lat, lng) {
    var n = Math.pow(2, ZOOM) * TILE_PX;
    var x = (lng + 180) / 360 * n;
    var s = Math.sin(lat * Math.PI / 180);
    var y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
    return { x: x, y: y };
  }

  /* ── 위치 공급자 ──────────────────────────────────────── */

  function useKeyboard() {
    if (geoWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(geoWatchId);
      geoWatchId = null;
    }
    mode = 'keyboard';
    geoAccuracy = null;
    core.log('이동 방식: 키보드(모의 이동)', 'info');
  }

  /**
   * 실제 GPS 로 전환. 처음 좌표를 받는 순간 그 지점을 원점으로 잡아
   * 지도가 "지금 있는 동네"로 이동한다.
   */
  function useGeo(onFail, onOk) {
    if (!navigator.geolocation) {
      if (onFail) { onFail('이 브라우저는 위치 기능을 지원하지 않습니다.'); }
      return;
    }
    var first = true;
    geoWatchId = navigator.geolocation.watchPosition(function (p) {
      mode = 'geo';
      geoAccuracy = p.coords.accuracy;
      if (first) {
        // 현재 위치를 원점으로 재설정 → 플레이어는 (0,0), 지도는 현 위치로 점프
        origin.lat = p.coords.latitude;
        origin.lng = p.coords.longitude;
        core.save.player.pos.x = 0;
        core.save.player.pos.y = 0;
        tiles = {};                       // 지역이 바뀌었으니 타일 캐시 비움
        spawns = [];                      // 주변 대상도 새로 뽑는다
        first = false;
        core.log('📡 GPS 연결 — 현재 위치로 이동했습니다 (오차 ±' + Math.round(p.coords.accuracy) + 'm)', 'info');
        if (onOk) { onOk(p.coords); }
        return;
      }
      var w = latLngToWorld(p.coords.latitude, p.coords.longitude);
      var pos = core.save.player.pos;
      var d = Math.hypot(w.x - pos.x, w.y - pos.y);
      if (d < 500) { core.save.player.distance += d; } credit2d = 1;   // 튐 방지 · GPS 는 실제 걸음 그대로
      pos.x = w.x; pos.y = w.y;
    }, function (err) {
      mode = 'keyboard';
      if (onFail) { onFail(err.message); }
    }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 });
  }

  /* 2026-09-09 — "키세팅이 있어야겠지"(사가나락·사가마을·사가종횡와 같은
     요청). WASD·방향키는 하드코딩 그대로 두고(실수로 못 쓰게 되면 안
     된다), 방향별로 하나 더 쓸 키만 고르게 한다. 키보드(모의 이동) 모드
     에서만 의미가 있다 — 실제 GPS 모드는 이 입력 자체를 안 본다. */
  var KEYMAP_DEFAULT = { up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright' };
  var remapping = null;
  function keymap() {
    var s = core.save && core.save.settings;
    var km = s && s.keymap;
    if (!km) { return KEYMAP_DEFAULT; }
    var out = {}, k;
    for (k in KEYMAP_DEFAULT) { out[k] = km[k] || KEYMAP_DEFAULT[k]; }
    return out;
  }
  function setKeymapKey(action, key) {
    if (!core.save || !core.save.settings) { return; }
    core.save.settings.keymap = keymap();
    core.save.settings.keymap[action] = key;
    core.persist();
  }
  function beginRemap(action) { remapping = action; }

  function bindKeys() {
    global.addEventListener('keydown', function (e) {
      if (remapping) {
        if (e.key !== 'Escape') { setKeymapKey(remapping, e.key.toLowerCase()); }
        remapping = null;
        core.emit('dg:keyremap');
        e.preventDefault();
        return;
      }
      keys[e.key.toLowerCase()] = true;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) >= 0) {
        if (e.target === document.body) { e.preventDefault(); }
      }
    });
    global.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
    /* PC 단독판에는 휠 없는 노트북도 있다 — 키로도 당기고 민다 */
    global.addEventListener('keydown', function (e) {
      if (e.key === '+' || e.key === '=') { nudgeCamZoom(1 / 1.2); core.persist(); }
      else if (e.key === '-' || e.key === '_') { nudgeCamZoom(1.2); core.persist(); }
    });
    global.addEventListener('blur', function () { keys = {}; });
  }

  /**
   * 벽 충돌 — 마을의 집·높은 집과 부딪히면 못 지나간다(PLAN 27절, 2026-08-29,
   * 사용자가 실기기로 발견: "벽이라는 개념이 없네").
   *
   * **판정에 화면 값을 들이는 유일한 자리다.** 이 저장소는 "화면은 판정에
   * 안 닿는다"를 지켜 왔지만(땅의 높낮이·손으로 그린 강 등), 벽만은 **눈에
   * 보이는 그 집과 어긋나면 의미가 없어** 사용자가 그 값을 직접 골랐다 —
   * `world3d.houseRects` 가 돌려주는 사각형은 `propPlan` 이 그리는 것과
   * **완전히 같은 좌표**다(순수 함수라 gx·gy 만 같으면 늘 같은 답이 나온다).
   *
   * GPS 모드(`mode === 'geo'`)에서는 이 함수 자체가 안 불린다 — 실제로 걸을
   * 때는 가상의 집이 실제 걸음을 막을 수 없으니 손대지 않는다.
   */
  function COLLIDE_ON() { return core.tuned('world.collide', 1) ? true : false; }
  var PLAYER_R = 0.5;         // 사람 폭(0.9m, asset3d 규약)의 절반

  var solidCache = [], solidCacheCell = null;
  function solidRectsNear(x, y) {
    if (!COLLIDE_ON()) { return []; }
    var W3 = global.DG.world3d;
    if (!W3 || !W3.houseRects) { return []; }
    var gx0 = Math.floor(x / 48), gy0 = Math.floor(y / 48);
    /* 2026-09-27 실기 "집을 통과" — 칸만 열쇠로 삼으면 집 모델이 늦게 와 벽이 제 크기로 커져도(prop3d.footprint)
       그 칸을 떠날 때까지 옛 작은 벽을 썼고, 이야기로 열리는 문도 늦게 반영됐다. 모델 도착 수·1초마다 다시 잰다 */
    var P3c = global.DG.prop3d;
    var cell = gx0 + ':' + gy0 + ':' + (P3c && P3c.arrivedCount ? P3c.arrivedCount() : 0) + ':' + Math.floor(Date.now() / 1000);
    if (solidCacheCell === cell) { return solidCache; }
    solidCacheCell = cell;
    var out = [], gx, gy, i, rs;
    for (gy = gy0 - 1; gy <= gy0 + 1; gy++) {
      for (gx = gx0 - 1; gx <= gx0 + 1; gx++) {
        rs = W3.houseRects(gx, gy);          // 마을 칸 밖이면 손으로 놓은 집(deco)만 온다
        for (i = 0; i < rs.length; i++) { out.push(rs[i]); }
      }
    }
    solidCache = out;
    return out;
  }

  /** 이 점이 집 몸통(반지름만큼 파고든 자리 포함) 안인가 — 회전한 사각형은
      점을 거꾸로 돌려 재면 축에 나란한 사각형과 같은 셈이 된다 */
  function hitsHouse(x, y, rects) {
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      var dx = x - r.x, dz = y - r.z;
      var c = Math.cos(r.rot), s = Math.sin(r.rot);
      var lx = dx * c + dz * s, lz = -dx * s + dz * c;
      var hw = r.w / 2, hd = r.d / 2;
      var cx = core.clamp(lx, -hw, hw), cz = core.clamp(lz, -hd, hd);
      var ddx = lx - cx, ddz = lz - cz;
      if (ddx * ddx + ddz * ddz < PLAYER_R * PLAYER_R) { return true; }
    }
    return false;
  }

  /**
   * 이동 — 키보드 · 화면 스틱 · 탭한 지점 중 무엇이든 하나로 모은다.
   * GPS 모드에서는 아무것도 하지 않는다(실제로 걸어야 움직인다).
   *
   * 손가락으로 하는 조작을 여기 한 곳에 모아 둔 이유는, 걸음 애니메이션이
   * "위치 변화만 보고" 만들어지기 때문이다 — 입력이 늘어도 그쪽은 안 고친다.
   */
  /** 실시간 위치전투(`rogue-action.js`)가 도는 중인가 — 이때만 아래에서
   *  `inputBlocked()`를 건너뛴다. 강타를 원 밖으로 벗어나 피하는 그 설계가
   *  실제로 되려면 몸(WASD·스틱)은 움직일 수 있어야 한다(2026-09-06,
   *  "포획을 실시간 위치 사냥식 실시간 전투로" 작업 중 발견 — `rogue.active`가
   *  전투 내내 켜져 있어 `moveByKeys` 전체가 막혀 있었다. 탭-이동만은 계속
   *  막는다 — 그걸 막으려고 넣은 바로 위 `inputBlocked()` 자체는 그대로 둔다). */
  function liveDuel() {
    var ra = global.DG.rogueAction;
    return !!(ra && ra.active);
  }

  /** 화면 기준 (u, v)(오른쪽 +u, 아래 +v)를 세계 (x, y) 로 — 3D 로 돌려 본(yaw) 만큼 돌린다. 2D·2.5D 는 그대로 */
  function camRot(u, v) {
    var W3 = global.DG.world3d;
    var yw = (W3 && W3.yaw && W3.active && W3.active()) ? W3.yaw() : 0;   // 카메라는 시점 모드와 상관없이 yaw 를 쓴다(camAim)
    var cs = Math.cos(yw), sn = Math.sin(yw);
    return { x: u * cs - v * sn, y: u * sn + v * cs };
  }

  /** 걷는 속도(m/초) — 손잡이 배율 × 탈것(⑲-61, 안 탔으면 1) × 달리기 */
  function moveSpeed(run) {   // W-0226 — 2D(평면·2.5D)는 화면 몸 높이/초로(field2d.walkMps), 3D 는 8m/초 · W-0233 들판 전투도 2D 배율로 돌아 싸움 중에도 그대로
    var MT = global.DG.mount, W3s = global.DG.world3d, F2s = global.DG.field2d, FCs = global.DG.fieldCombat, b = speed; if (F2s && F2s.walkMps && geom && !(W3s && W3s.active && W3s.active())) { b = F2s.walkMps((geom.mode === 2 ? 1.5 : 1.25) * bodyK() * 48 / scale(), speed); } credit2d = speed / b;
    return b * speedMul() * (MT && MT.speedMul ? MT.speedMul() : 1) * (run ? 2.2 : 1) * (global.DG.starchart ? global.DG.starchart.move() : 1);   // × 성도(W-0181)
  }
  function moveByKeys(dt) {
    if (mode !== 'keyboard') { return; }
    var live = liveDuel();
    if (inputBlocked() && !live) { return; }
    var km = keymap();
    var dx = 0, dy = 0, run = !!keys.shift;
    if (keys.w || keys.arrowup || keys[km.up]) { dy -= 1; }
    if (keys.s || keys.arrowdown || keys[km.down]) { dy += 1; }
    if (keys.a || keys.arrowleft || keys[km.left]) { dx -= 1; }
    if (keys.d || keys.arrowright || keys[km.right]) { dx += 1; }

    if (!dx && !dy && (stick.dx || stick.dy)) {   // 화면 스틱
      dx = stick.dx; dy = stick.dy; run = stick.run;
    }
    /* 3인칭 — 키·스틱은 **카메라 기준**이다(2026-09-27 실기 "화면 움직이면 키보드 방향으로 움직여야 함 · 역방향으로 움직임").
       마우스로 돌린 yaw 만큼 돌려야 W 가 늘 화면 앞(카메라가 보는 쪽)으로 간다 — 클릭 이동(onClick)과 같은 회전 */
    if (dx || dy) { var kr = camRot(dx, dy); dx = kr.x; dy = kr.y; }

    var pos = core.save.player.pos;
    if (!dx && !dy && walkTarget && !live) {      // 탭한 지점으로 걸어간다 (전투 중엔 안 됨)
      var tx = walkTarget.x - pos.x, ty = walkTarget.y - pos.y;
      var td = Math.hypot(tx, ty);
      if (td < 2) { walkTarget = null; }
      else { dx = tx / td; dy = ty / td; run = !!walkTarget.run; }
    } else if (dx || dy) {
      walkTarget = null;                          // 직접 조작하면 목표를 버린다
    }

    if (!dx && !dy) { return; }
    var len = Math.hypot(dx, dy) || 1;
    var step = moveSpeed(run && !(global.DG.stealth && global.DG.stealth.crouched())) * dt; if (global.DG.stealth) { step *= global.DG.stealth.moved(run); }   // W-0286 웅크리기 걸음 ×0.5·움직임 기록
    var ux = dx / len, uy = dy / len;
    /* §5 ⑰ 오르기·헤엄·점프 — 능선 오르막은 절반(기력이 다하면 0), 강은 0.6. 능선·강 밖은 늘 1 */
    var LFm = global.DG.landform, MTf = global.DG.mount, flyOn = !!(MTf && MTf.flying && MTf.flying());
    if (LFm && !flyOn) { step *= LFm.moveMul(pos.x, pos.y, ux, uy, dt); }               // ⑲-62 뜬 동안은 강·능선 감속이 없다
    var nx = pos.x + ux * step, ny = pos.y + uy * step;
    var rects = (LFm && LFm.onPole && LFm.onPole()) || (MTf && MTf.overRoofs && MTf.overRoofs()) ? [] : solidRectsNear(pos.x, pos.y); var F2t = global.DG.field2d; if (F2t && F2t.treeRects && !flyOn && !(global.DG.world3d && global.DG.world3d.active && global.DG.world3d.active())) { rects = rects.concat(F2t.treeRects(pos.x, pos.y, terrainAt)); }   /* W-0372 2D 나무 줄기 */   // ⑲-34 들보 위는 벽 위다 · ⑲-62 6m 넘게 뜨면 지붕을 넘는다
    /* 2026-09-28 — 이미 벽 안이면(모델이 와서 벽이 커졌거나·품질이 올라 집이 새로 섰거나·순간이동) 사방이 막혀
       영영 갇혔다 → 안에서는 막지 않는다(걸어 나가게) */
    if (rects.length && hitsHouse(pos.x, pos.y, rects)) { rects = []; }
    var moved = 0;
    if (!hitsHouse(nx, ny, rects)) {
      pos.x = nx; pos.y = ny; moved = step;
    } else if (!hitsHouse(nx, pos.y, rects)) {
      /* 벽을 따라 미끄러진다 — 한 축만 막혔으면 나머지 축은 그대로 간다 */
      pos.x = nx; moved = Math.abs(ux * step);
    } else if (!hitsHouse(pos.x, ny, rects)) {
      pos.y = ny; moved = Math.abs(uy * step);
    } else {
      /* 구석에 완전히 막혔다 — 탭 이동은 목표를 버린다. 안 버리면 벽에 붙어
         제자리걸음만 치는 것처럼 보인다(자동 순행도 이 길로 온다) */
      walkTarget = null;
    }
    core.save.player.distance += moved * credit2d;
  }

  /** 화면 스틱 입력 (-1~1). touch 쪽에서 넣어 준다 */
  function setStick(dx, dy, run) {
    stick.dx = dx || 0;
    stick.dy = dy || 0;
    stick.run = !!run;
    if (stick.dx || stick.dy) { walkTarget = null; }
  }

  /** 그 지점까지 걸어간다 (탭 이동) */
  /** 그 자리로 걸어간다 — run 이면 달린다(×2.2, 자동 이야기의 추격·먼 길) */
  function walkTo(wx, wy, run) {
    walkTarget = { x: wx, y: wy, run: !!run };
  }

  function walkingTo() { return walkTarget; }

  /** 위치 변화를 보고 걸음 애니메이션 상태를 갱신한다 */
  function updatePlayerMotion(dt) {
    var pos = core.save.player.pos;
    if (!player.prev) { player.prev = { x: pos.x, y: pos.y }; }
    var dx = pos.x - player.prev.x, dy = pos.y - player.prev.y;
    var dist = Math.hypot(dx, dy);
    player.prev.x = pos.x; player.prev.y = pos.y;

    if (dt > 0) {
      // 급격한 변화를 부드럽게 (GPS 튐 완화)
      var nvx = dx / dt, nvy = dy / dt;
      player.vx += (nvx - player.vx) * Math.min(1, dt * 8);
      player.vy += (nvy - player.vy) * Math.min(1, dt * 8);
    }
    player.speed = Math.hypot(player.vx, player.vy);

    if (Math.abs(player.vx) > 1.2) { player.facing = player.vx > 0 ? 1 : -1; } if (player.speed > 1.5) { player.dirX = player.vx; player.dirY = player.vy; }   // 2D 앞·뒤 모습(W-0073)
    if (player.speed > 1.5) {
      player.phase += dt * (4.2 + player.speed * 0.10);
      // 일정 거리마다 좌우 번갈아 발자국을 남긴다
      player.footAcc += dist;
      if (player.footAcc >= (credit2d < 1 ? 2.7 / credit2d : 6)) {   // W-0226 2D 는 반 보폭마다
        player.footAcc = 0;
        player.footSide = -player.footSide;
        var ang = Math.atan2(player.vy, player.vx) + Math.PI / 2;
        footprints.push({
          x: pos.x + Math.cos(ang) * 3.2 * player.footSide,
          y: pos.y + Math.sin(ang) * 3.2 * player.footSide,
          at: Date.now(), side: player.footSide
        });
        if (footprints.length > 90) { footprints.shift(); }
      }
    }
    // 수명이 지난 발자국 정리
    var now = Date.now();
    while (footprints.length && now - footprints[0].at > FOOT_LIFE) { footprints.shift(); }
    while (clickMarks.length && now - clickMarks[0].at > CLICK_MARK_LIFE) { clickMarks.shift(); }

    trackTrail(dist);
  }

  /**
   * 전체 지도(overworld.js)가 보여줄 발자취 — 실제 GPS 든 키보드 이동이든
   * "지금 위치"를 위경도로 환산해 일정 간격(`TRAIL_STEP`)마다 한 점씩 남긴다.
   * 위경도(절대값)로 저장하므로, GPS 를 다시 켜서 원점(`origin`)이 바뀌어도
   * 이미 남긴 점은 그대로 유효하다(x·y 상대좌표였다면 원점이 바뀔 때 어긋난다).
   */
  function trackTrail(dist) {
    player.trailAcc += dist;
    if (player.trailAcc < TRAIL_STEP) { return; }
    player.trailAcc = 0;
    var pos = core.save.player.pos;
    var ll = worldToLatLng(pos.x, pos.y);
    var trail = core.save.player.trail;
    trail.push({
      lat: ll.lat, lng: ll.lng,
      kind: terrainAt(Math.floor(pos.x / 48), Math.floor(pos.y / 48)),
      at: Date.now()
    });
    if (trail.length > TRAIL_MAX) { trail.shift(); }
  }

  /** 야생 인물·펫이 제자리 주변을 어슬렁거린다 */
  function wanderSpawns(dt) {   // W-0228 — 2D(평면·2.5D)는 빠르기·반경을 화면 몸 높이로(field2d.wander) — 15m·2.6m/초는 2D 에서 32px 안에서 5px/초라 서 있는 것 같았다
    var pos = core.save.player.pos, now = Date.now(), W3w = global.DG.world3d, F2w = global.DG.field2d, w2 = F2w && F2w.wander && geom && !(W3w && W3w.active && W3w.active()) ? F2w.wander((geom.mode === 2 ? 1.5 : 1.25) * bodyK() * 48 / scale()) : null;
    var STw = global.DG.stealth; if (STw) { STw.step(dt, spawns, pos); } for (var i = 0; i < spawns.length; i++) {   // W-0286 들킴·달아남·덤빔
      var s = spawns[i];
      var near = Math.hypot(s.x - pos.x, s.y - pos.y) <= ENCOUNTER_RANGE;

      if (near && !(STw && STw.free(s))) {   // W-0286 안 들킨 짐승은 돌아보지 않는다
        // 눈이 마주치면 멈춰서 플레이어를 바라본다
        s.moving = false;
        s.facing = (pos.x >= s.x) ? 1 : -1;
        s.pause = Math.max(s.pause, 400);
        continue;
      }
      if (s.pause > 0) {
        s.pause -= dt * 1000;
        s.moving = false;
        continue;
      }
      var dx = s.tx - s.x, dy = s.ty - s.y;
      var d = Math.hypot(dx, dy);
      if (d < 1.2) {
        // 도착 — 잠시 쉬고 다음 목적지를 고른다
        s.pause = 500 + Math.random() * 2600;
        s.moving = false;
        var ang = Math.random() * Math.PI * 2;
        var rad = Math.random() * (w2 ? Math.max(WANDER_R, w2.r) : WANDER_R);
        s.tx = s.homeX + Math.cos(ang) * rad;
        s.ty = s.homeY + Math.sin(ang) * rad;
        continue;
      }
      var step = (w2 ? Math.max(WANDER_SPEED, w2.v) : WANDER_SPEED) * dt;
      s.x += dx / d * step;
      s.y += dy / d * step;
      s.moving = true;
      if (Math.abs(dx) > 0.4) { s.facing = dx > 0 ? 1 : -1; } s.dirX = dx; s.dirY = dy;
      s.phase += dt * 7.5;
    }
  }

  /* ── 지도 타일 ────────────────────────────────────────── */

  /* 지도 타일 — **OpenStreetMap 타일 서버를 안 쓴다**(W-0207, 사용자 10-14). 2D 는 들판(field2d)·절차 지형(drawFallback), 3D 땅은
     지형 재질(terrainTexture·landTexture)이라 그림으로는 이미 안 쓰고 있었다 — 받기만 하던 헛일·이용 정책 문제(429)를 없앤다.
     부르는 쪽이 그대로 돌게 이름만 남긴다: 주소·그림 없음, "지도 받았나" 는 늘 거짓. (W-0059 의 CARTO → OSM 이력은 archive) */
  function tileUrl() { return null; }
  function getTile() { return null; }
  function tilesUsable() { return false; }

  /* ── 프로시저럴 폴백 지형 — 땅 종류 표·노이즈·띠·길·terrainAt 은 js/world-terrain.js(R-4). 같은 이름 한 줄 넘김 ── */
  var WTR = global.DG.worldTerrain;
  var TERRAIN = WTR.TERRAIN;
  function terrainAt(tx, ty) { return WTR.terrainAt(tx, ty); }
  function roadIsVertical(tx, ty) { return WTR.roadIsVertical(tx, ty); }

  /** 2026-09-10 — 2D 폴백 지형도 실제 사진으로. 3D(`world3d.js`의
   *  `landTexture`)가 이미 받아 둔 땅 그림을 그대로 재사용한다(W-0154 — 옛 ambientCG
   *  사진 `land/` 은 지우고 3D 와 같은 손그림 `assets/textures/land_c/`) — `water`는 3D처럼 뺀다(맞는 CC0 사진이
   *  없어 옅은 색 그대로 둔다, 실제 물결도 없는 자리라 색만으로 충분하다).
   *
   *  **첫 버전(칸마다 같은 사진을 통째로 욱여넣기)은 오히려 "바둑판" 을
   *  더 도드라지게 했다** (2026-09-10, 바로 이어서 재지적) — 칸마다 독립된
   *  도장을 찍는 꼴이라 48px 마다 똑같은 사진이 뚝뚝 끊겨 반복됐다. 3D의
   *  `landPattern()`과 같은 원리로 바꾼다: 사진 한 장을 **세계 좌표에
   *  붙박아 이어 반복**시키는 `CanvasPattern`(+`setTransform`) 하나를
   *  종류마다 두고, 칸은 그 패턴을 그대로 오려 붙이기만 한다 — 옆 칸과
   *  사진이 이어지므로 칸 경계에 이음매가 안 생긴다. 종류당 변형이 셋
   *  있지만(3D와 같은 파일) 2D는 **첫 번째만** 쓴다 — 변형을 칸마다
   *  섞으면 그 경계마다 다시 이음매가 생겨 도로아미타불이다.
   */
  var LAND_TEX_VARIANTS = {
    grass: ['assets/textures/land_c/grass1.webp', 'assets/textures/land_c/grass2.webp', 'assets/textures/land_c/grass3.webp'],
    forest: ['assets/textures/land_c/forest1.webp', 'assets/textures/land_c/forest2.webp', 'assets/textures/land_c/forest3.webp'],
    mount: ['assets/textures/land_c/mount1.webp', 'assets/textures/land_c/mount2.webp', 'assets/textures/land_c/mount3.webp'],
    road: ['assets/textures/land_c/road1.webp', 'assets/textures/land_c/road2.webp', 'assets/textures/land_c/road3.webp'],
    town: ['assets/textures/land_c/town1.webp', 'assets/textures/land_c/town2.webp', 'assets/textures/land_c/town3.webp'],
    farm: ['assets/textures/land_c/farm1.webp', 'assets/textures/land_c/farm2.webp', 'assets/textures/land_c/farm3.webp']
  };
  /** 사진 한 변이 세계에서 덮는 폭(m) — 3D(12m)보다 성기다. 2D는 화면이
   *  작고 확대도 자주 안 해 더 촘촘히 반복하면 오히려 무늬가 흐물거린다 */
  var LAND_TEX_METERS_2D = 24;
  var landTexImg2D = {};   // kind → Image
  var landPat2D = {};      // kind → CanvasPattern (한 번 만들어 계속 쓴다)

  function landTexImg2DGet(kind) {
    if (landTexImg2D[kind]) { return landTexImg2D[kind]; }
    var img = new Image();
    landTexImg2D[kind] = img;
    var tl = global.DG.mode2d && global.DG.mode2d.tileUrl(kind), urls = tl ? [tl] : LAND_TEX_VARIANTS[kind];
    if (urls && urls[0]) {
      img.onload = function () { img.ready = true; };
      img.src = urls[0];
    }
    return img;
  }

  /** 이 종류의 패턴을 지금 카메라 기준으로 맞춰 돌려준다. 못 받았으면 null —
   *  그러면 옛 색칠로 물러난다(화면이 안 빈다) */
  function landPattern2D(ctx, kind, camX, camY, sc) {
    var img = landTexImg2DGet(kind);
    if (!img.ready || !img.naturalWidth || !ctx.createPattern) { return null; }
    var pat = landPat2D[kind];
    if (!pat) { pat = ctx.createPattern(img, 'repeat'); landPat2D[kind] = pat; }
    if (pat && pat.setTransform && typeof DOMMatrix !== 'undefined') {
      var M = LAND_TEX_METERS_2D, side = M * sc;
      var wx0 = Math.floor(camX / M) * M, wy0 = Math.floor(camY / M) * M;
      var tx = (wx0 - camX) * sc, ty = (wy0 - camY) * sc;
      pat.setTransform(new DOMMatrix([side / img.naturalWidth, 0, 0, side / img.naturalHeight, tx, ty]));
    }
    return pat;
  }

  function drawFallback(ctx, camX, camY, W, H, sc) {
    var T = 48 * sc;
    var t0x = Math.floor(camX / 48) - 1, t1x = Math.ceil((camX + W / sc) / 48) + 1;
    var t0y = Math.floor(camY / 48) - 1, t1y = Math.ceil((camY + H / sc) / 48) + 1;
    var patCache = {};   // 이번 프레임엔 종류당 한 번만 구한다(패턴 변환 값 재사용)
    for (var ty = t0y; ty <= t1y; ty++) {
      for (var tx = t0x; tx <= t1x; tx++) {
        var kind = terrainAt(tx, ty);
        var sx = (tx * 48 - camX) * sc, sy = (ty * 48 - camY) * sc;
        if (!(kind in patCache)) {
          patCache[kind] = !(global.DG.field2d && global.DG.field2d.on()) && (LAND_TEX_VARIANTS[kind] || global.DG.mode2d.tileUrl(kind)) ? landPattern2D(ctx, kind, camX, camY, sc) : null;   // W-0130 — 들판은 타일 그림(벽처럼 보임) 대신 맑은 색 + 잔결
        }
        var pat = patCache[kind];
        if (pat) {
          ctx.fillStyle = pat;
          ctx.fillRect(sx, sy, T + 1, T + 1);
        } else {
          ctx.fillStyle = global.DG.field2d && global.DG.field2d.on() ? global.DG.field2d.color(kind) : TERRAIN[kind];
          ctx.fillRect(sx, sy, T + 1, T + 1);
        }
      }
    }
    if (global.DG.field2d) { global.DG.field2d.decorate(ctx, camX, camY, W, H, sc, terrainAt); }   // W-0130 — 칸 결·경계·소품(나무·바위·풀포기)
  }

  /* ── 스폰 ─────────────────────────────────────────────── */

  function rarityRoll() {
    var bonus = core.effect('spawnRarePct') / 100;
    var r = Math.random() * (1 + bonus);
    if (r > 0.985) { return 5; }
    if (r > 0.92) { return 4; }
    if (r > 0.74) { return 3; }
    if (r > 0.42) { return 2; }
    return 1;
  }

  /** 절차적 권역 풀(saga-go 전용) — rarity 1~2는 원래 HEROES/PETS에 아무도
   *  없던 자리라(105명은 3~5만 쓴다) 여길 채워도 기존 등급 분포와 안
   *  부딪힌다. 나라가 둘로 늘면서(한국·일본, 2026-09-11) 두 나라의
   *  `REGIONS`를 **그냥 하나로 합쳐 통째로 최근접 탐색**한다 — 나라별
   *  대표 중심끼리 먼저 비교하는 방식을 시도했다가, 규슈(한국에 가까운
   *  일본 변두리)가 "일본 9곳 평균 중심"보다 "한국 9곳 평균 중심"에 더
   *  가까워져 한국으로 잘못 판정되는 걸 실측으로 확인하고 버렸다
   *  (`region-kr.js` 머리말 참고). 18개 대표점 중 가장 가까운 하나를
   *  그냥 고르는 쪽이 더 정확하고 코드도 더 짧다. region이 안 잡히면
   *  (모듈 미로딩) 예전처럼 정적 풀로 그냥 간다 — 구조를 건드리지 않는다.
   *  **2026-09-11 — 셋째 나라(중국, region-cn.js)가 붙어 27개 대표점이
   *  됐다.** 나라 수가 늘어도 이 "그냥 다 합쳐 최근접" 방식은 그대로
   *  안전하다(위 규슈 오류가 나라별 평균 중심 비교에서만 나던 문제였다).
   *  **2026-09-23 — 넷째(서역, region-xy.js)가 붙어 36개.** 같은 방식 그대로. */
  function genRegionAt(x, y) {
    var RK = global.DG.regionKr, RJ = global.DG.regionJp, RC = global.DG.regionCn, RX = global.DG.regionXy;
    if (!RK && !RJ && !RC && !RX) { return null; }
    var ll = worldToLatLng(x, y);
    var all = (RK ? RK.REGIONS : []).concat(RJ ? RJ.REGIONS : []).concat(RC ? RC.REGIONS : []).concat(RX ? RX.REGIONS : []);
    var cosLat = Math.cos(ll.lat * Math.PI / 180);
    var best = null, bestD = Infinity;
    for (var i = 0; i < all.length; i++) {
      var r = all[i];
      var dLat = ll.lat - r.center.lat, dLng = (ll.lng - r.center.lng) * cosLat;
      var d = dLat * dLat + dLng * dLng;
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }

  /** region.country('kr'/'jp'/'cn')에 맞는 생성기를 고른다 */
  function gencharOf(region) {
    if (!region) { return null; }
    if (region.country === 'jp') { return global.DG.gencharJp || null; }
    if (region.country === 'cn') { return global.DG.gencharCn || null; }
    if (region.country === 'xy') { return global.DG.gencharXy || null; }
    return global.DG.genchar || null;
  }

  function pickHero(rar, region) {
    var GC = gencharOf(region);
    if (region && GC && rar <= 2 && Math.random() < 0.85) {
      var h = GC.hero(region.code, rar, Math.floor(Math.random() * 1e6));
      if (h) { return h; }
    }
    var pool = data.heroes.filter(function (h) { return h.rarity === rar; });
    if (!pool.length) { pool = data.heroes.filter(function (h) { return h.rarity <= rar; }); }
    if (!pool.length) { return core.pick(data.heroes); }
    /* 천후가 미는 기질이 있으면 그쪽에서 자주 나온다 (원작의 날씨 부스트) */
    var W = global.DG.weather;
    var want = W ? W.favorTrait() : null;
    if (want && Math.random() < 0.6) {
      var favored = pool.filter(function (h) { return h.trait === want; });
      if (favored.length) { return core.pick(favored); }
    }
    return core.pick(pool);
  }

  function pickPet(rar, region) {
    var W = global.DG.weather;
    var wantDivine = Math.random() <
      (0.18 + core.effect('divinePct') / 100 + (W ? W.divineBias() : 0));
    var GC = gencharOf(region);
    if (region && GC && rar <= 2 && !wantDivine && Math.random() < 0.85) {
      var p = GC.pet(region.code, rar, Math.floor(Math.random() * 1e6));
      if (p) { return p; }
    }
    var pool = data.pets.filter(function (p) {
      return p.rarity === rar && (wantDivine ? p.kind === 'divine' : p.kind === 'beast');
    });
    if (!pool.length) { pool = data.pets.filter(function (p) { return p.rarity <= rar; }); }
    return pool.length ? core.pick(pool) : core.pick(data.pets);
  }

  var spawnSeq = 0; function vSpawnMin() { var k = +core.tuned('go.spawnOutView', 1), W3 = global.DG.world3d, F2 = global.DG.field2d; if (!(k > 0) || !geom || !(F2 && F2.on && F2.on()) || (W3 && W3.active && W3.active())) { return SPAWN_MIN; } var rm = Math.hypot(geom.W, geom.H) / 2 / scale() * (geom.tilt ? 1.2 : 1) * k; return Math.max(SPAWN_MIN, Math.min(rm, SPAWN_RADIUS * 0.85)); }   /* 10-29 2D 는 화면 밖 고리에서만 스폰(사용자 "몬스터 개체수 아직 많아 2처럼") — 2나락 W-0327 과 같은 결, go.spawnOutView 0 = 옛 */

  function makeSpawn() {
    var pos = core.save.player.pos;
    var ang = Math.random() * Math.PI * 2;
    var sMin = vSpawnMin(), dist = Math.sqrt(sMin * sMin + Math.random() * (SPAWN_RADIUS * SPAWN_RADIUS - sMin * sMin));   // W-0174 70 → 25 — 기본 확대에서 하나쯤은 보이게 · W-0369 반경 고르게 → 넓이 고르게(예전엔 가운데가 r 에 반비례로 빽빽 — 첫 화면에 짐승·사람이 몰렸다)
    /* 비 오는 날은 짐승이, 바람 부는 날은 사람이 더 많다 */
    var wb = global.DG.weather ? global.DG.weather.heroBias() : 0;
    var isHero = Math.random() < core.clamp(0.42 + wb, 0.08, 0.9);
    var rar = rarityRoll(), nc = nearCap(); if (dist < NEAR_R && nearCount(pos, isHero ? 'hero' : 'pet') >= nc) { dist = NEAR_R + Math.random() * (SPAWN_RADIUS - NEAR_R); }   // W-0369 내 둘레 120m 안 짐승·사람 따로 상한(go.nearCap 4) — 수는 그대로, 자리만 밖으로
    var sx = pos.x + Math.cos(ang) * dist;
    var sy = pos.y + Math.sin(ang) * dist;
    var region = genRegionAt(sx, sy), ref = isHero ? pickHero(rar, region) : pickPet(rar, region), SPf = global.DG.sprite;
    /* W-0152 — 물고기 꼴 펫은 물 칸에만. 산·들에 선 잉어·붕어가 3D 에서 먼 언덕 위 = 지붕 높이 공중 물고기로 보였다 */
    for (var tr = 0; !isHero && tr < 8 && SPf && SPf.beastFormOf && SPf.beastFormOf(ref) === 'fish' && terrainAt(Math.floor(sx / 48), Math.floor(sy / 48)) !== 'water'; tr++) { ref = pickPet(rar, region); }
    return {
      uid: ++spawnSeq,
      kind: isHero ? 'hero' : 'pet',
      ref: ref,
      x: sx, y: sy,
      homeX: sx, homeY: sy,          // 배회 중심
      tx: sx, ty: sy,                // 현재 목적지
      moving: false, pause: Math.random() * 1800,
      facing: Math.random() < 0.5 ? 1 : -1,
      phase: Math.random() * Math.PI * 2,
      bornAt: Date.now(),
      wob: Math.random() * Math.PI * 2
    };
  }

  /** 지금 깔아 둘 대상 수 — 향(🕯️)을 피우면 늘어난다 */
  var NEAR_R = 120; function nearCap() { var c = +core.tuned('go.nearCap', 4), DM = global.DG.deviceMode; if (DM && DM.want3d && !DM.want3d() && !global.DG_NO_DRAW) { c = Math.min(c, +core.tuned('go.nearCap2d', 2)); } /* W-0468 2D 는 화면이 내 둘레를 거의 다 담아 들짐승이 몰려 보인다 — 2D 둘레 상한 2 */ return Math.max(0, c); } function nearCount(pos, kind) { var n = 0; for (var i = 0; i < spawns.length; i++) { if (spawns[i].kind === kind && Math.hypot(spawns[i].x - pos.x, spawns[i].y - pos.y) < NEAR_R) { n++; } } return n; }   /* W-0369 */ function maxSpawns() {
    var lure = global.DG.bag && global.DG.bag.lured();
    var few = global.DG.weather && global.DG.weather.fewer();
    return Math.round(Math.max(4, MAX_SPAWNS + (lure ? 6 : 0) - (few ? 3 : 0)) * (global.DG.starchart ? global.DG.starchart.spawn() : 1));   // 큰 그물(성도 규칙) 두 배
  }

  function tickSpawns() {
    var now = Date.now(), pos = core.save.player.pos;
    spawns = spawns.filter(function (s) {
      if (now - s.bornAt > SPAWN_LIFE) { return false; }
      return Math.hypot(s.x - pos.x, s.y - pos.y) < SPAWN_RADIUS * 1.6;
    });
    while (spawns.length < maxSpawns()) { spawns.push(makeSpawn()); }
  }

  /**
   * 명사(名士) 하나를 코앞에 세운다 — 사명의 인장 일곱이 부른다(quest.js).
   * 보통 스폰과 같은 모양이라 조우·자동은 손댈 것이 없다.
   * `ref` 를 주면 그 인물을 세운다(사당 시련 — 그 권역의 인물, shrine.js).
   */
  function spawnSpecial(rarity, ref) {
    var pos = core.save.player.pos;
    var want = rarity || 5;
    var pool = ref ? [ref] : data.heroes.filter(function (h) { return h.rarity === want; });
    if (!pool.length) { pool = data.heroes.filter(function (h) { return h.rarity >= 4; }); }
    if (!pool.length) { pool = data.heroes.slice(); }
    var ang = Math.random() * Math.PI * 2;
    var dist = 30 + Math.random() * 20;              // 바로 곁에 세운다
    var sx = pos.x + Math.cos(ang) * dist;
    var sy = pos.y + Math.sin(ang) * dist;
    var s = {
      uid: ++spawnSeq, kind: 'hero', ref: core.pick(pool),
      x: sx, y: sy, homeX: sx, homeY: sy, tx: sx, ty: sy,
      moving: false, pause: 0, facing: 1, phase: 0,
      bornAt: Date.now(), wob: 0, special: true
    };
    spawns.push(s);
    return s;
  }

  function removeSpawn(uid) {
    spawns = spawns.filter(function (s) { return s.uid !== uid; });
  }

  function nearest() {
    var pos = core.save.player.pos, best = null, bd = Infinity;
    for (var i = 0; i < spawns.length; i++) {
      var d = Math.hypot(spawns[i].x - pos.x, spawns[i].y - pos.y);
      if (d < bd) { bd = d; best = spawns[i]; }
    }
    return best ? { spawn: best, dist: bd, inRange: bd <= ENCOUNTER_RANGE } : null;
  }

  /* ── 구역 이름 ────────────────────────────────────────────
   * 옛 지명은 지도의 맛일 뿐이다 — 경영(영지 소유)은 게임에서 뺐다.
   * 좌표 해시로 뽑으므로 같은 구역은 항상 같은 이름이다.
   */

  var REGION_NAMES = [
    '한중', '형주', '익주', '서량', '허창', '업성', '건업', '강릉', '합비', '장안',
    '평양', '국내성', '한성', '금성', '사비', '개경', '한양', '전주', '경주', '의주',
    '동래', '진주', '남원', '철령', '압록', '두만', '탐라', '강화', '수원', '충주'
  ];

  function regionKeyOf(x, y) {
    return Math.floor(x / REGION_SIZE) + ',' + Math.floor(y / REGION_SIZE);
  }
  function currentRegionKey() {
    var pos = core.save.player.pos;
    return regionKeyOf(pos.x, pos.y);
  }
  /* core.hash2 는 0~0.5 만 돌려준다(h01 머리말 참고) — 그냥 쓰면 역참과 같은
   * 사고로 REGION_NAMES 뒤 절반(한양·경주·전주 등 15개)이 영영 안 뽑힌다.
   * h01 로 두 배로 펴서 30개 전부가 나오게 한다. */
  function regionName(key) {
    var p = key.split(',');
    var idx = Math.floor(h01(parseInt(p[0], 10) * 31 + 7, parseInt(p[1], 10) * 17 + 3) * REGION_NAMES.length);
    return REGION_NAMES[core.clamp(idx, 0, REGION_NAMES.length - 1)];
  }

  /* ── 렌더 (2.5D) ──────────────────────────────────────
   * 지면(지도·구역 격자)은 지면 캔버스에 그린 뒤 CSS perspective + rotateX 로 눕힌다.
   * 캐릭터·라벨은 눕히면 읽을 수 없으므로 별도 캔버스에 정면(빌보드)으로 그리고,
   * 각자의 화면 위치는 CSS 와 똑같은 원근 식으로 직접 계산한다.
   * 기울기를 끄면 두 면이 같은 평면이 되어 예전 2D 와 완전히 동일해진다.
   */

  var canvas, ctx;            // 오브젝트(빌보드) 캔버스 — 화면 크기
  var gCanvas, gCtx;          // 지면 캔버스 — 더 크게 잡고 CSS 로 눕힌다
  var dpr = 1;
  var TILT_DEG = 44;          // 2.5D — 지면을 눕히는 각도
  var PERSP = 1200;           // 2.5D — 원근 거리(px). 클수록 왜곡이 약하다
  /* 3D 모드 — 원작식 카메라: 더 깊게 눕히고, 원근을 세게, 캐릭터는 화면 아래쪽 */
  var TILT3_DEG = 57;
  var PERSP3 = 860;
  var ANCHOR3 = 0.64;         // 3D 에서 플레이어가 서는 화면 세로 위치 (0=위, 1=아래)
  var geom = null;

  /* ── 3D 줌 ────────────────────────────────────────────────
   * 3D 는 카메라가 낮게 깔려 **27m 앞**을 본다. 그런데 야생 대상은 70~320m 밖에
   * 생기므로(SPAWN_RADIUS) 기본 시야에는 한 마리도 안 들어온다 — 손으로 걸어 보고
   * 나온 지적이다. 원작에도 지도를 오므렸다 폈다 하는 조작이 있다.
   *
   * **화면 값이다.** 배율은 카메라 거리에만 곱하고 좌표·거리·판정은 그대로다.
   */
  /* 최대를 크게 잡아 둔다 — 야생 대상은 70~320m 밖에 서므로(SPAWN_RADIUS),
     원작만 한 배율로는 한 마리도 화면에 안 들어온다. 끝까지 당기면 반경 150m 쯤을
     내려다본다. **판정은 그대로다** — 스폰 거리도 조우 사거리도 안 건드렸다. */
  var ZOOM3_MIN = 0.12, ZOOM3_MAX = 9, ZOOM3_WIDE3 = 0.7;   // W-0324 코앞(0.12 — 에셋 확인용, 사용자 10-18)·3인치 모드는 옛 0.7
  /* 기본 배율 — 원작만 한 배율(×1, 아바타가 화면의 1/8)로 열면 **한 마리도 안 보인다.**
     야생 대상이 70m 밖부터 생기기 때문이다. 켜자마자 보이는 자리에서 시작하고,
     가까이 보고 싶으면 휠로 당긴다. 옛 세이브에는 이 칸이 없으니 여기서 채운다 */
  var ZOOM3_DEFAULT = 1.0;   // 2026-09-27 실기 "3인칭처럼" — ×4(높이 멀리)에서 캐릭터 뒤 가까이로(1.4). 옛 세이브는 아래 cam3p 로 한 번 옮긴다
  // W-0119(10-09) 1.4 → 1.0 — 촬영에서 인물이 화면 높이 1/10 이라 "작다" — 1/7 로. 이미 옮긴 세이브(cam3p)의 값은 안 건드린다

  function zoom3d() {
    var raw = core.save.settings ? core.save.settings.zoom3d : undefined;
    if (raw === undefined || raw === null || raw === '') { raw = ZOOM3_DEFAULT; }
    var z = Number(raw);
    if (!isFinite(z) || z <= 0) { z = ZOOM3_DEFAULT; }
    return core.clamp(z, ZOOM3_MIN, ZOOM3_MAX);
  }
  function setZoom3d(z) {
    if (!core.save.settings) { return 1; }
    core.save.settings.zoom3d = core.clamp(z, ZOOM3_MIN, ZOOM3_MAX);
    core.emit('zoom', core.save.settings.zoom3d);
    return core.save.settings.zoom3d;
  }
  function nudgeZoom(mul) { return setZoom3d(zoom3d() * mul); }

