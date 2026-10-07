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
  var SPAWN_RADIUS = 320;     // 스폰 반경 (m)
  var ENCOUNTER_RANGE = 46;   // 조우 가능 거리 (m)
  var REGION_SIZE = 576;      // 구역 한 변 (m)
  var MAX_SPAWNS = 10;
  var SPAWN_LIFE = 100000;

  var spawns = [];
  /**
   * 키보드 이동 속도 (m/s). 프로토타입 값은 34 였는데, 그것은 122km/h 라 걷는 게임의
   * 거리 보상(250m 마다 보급)이 7초에 한 번씩 터졌다. 8m/s 는 자전거보다 조금 빠른
   * 정도로, 보급이 31초(달리면 14초)에 한 번 온다. 스폰 반경 320m 안의 목표까지
   * 걸어가는 데 25초쯤 걸려 조우를 고르는 맛도 남는다.
   * GPS 모드(useGeo)는 실제 위치를 쓰므로 이 값과 무관하다.
   */
  var speed = 8;

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
      if (d < 500) { core.save.player.distance += d; }   // 튐 방지
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
  function moveSpeed(run) {
    var MT = global.DG.mount;
    return speed * speedMul() * (MT && MT.speedMul ? MT.speedMul() : 1) * (run ? 2.2 : 1);
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
    var step = moveSpeed(run) * dt;
    var ux = dx / len, uy = dy / len;
    /* §5 ⑰ 오르기·헤엄·점프 — 능선 오르막은 절반(기력이 다하면 0), 강은 0.6. 능선·강 밖은 늘 1 */
    var LFm = global.DG.landform, MTf = global.DG.mount, flyOn = !!(MTf && MTf.flying && MTf.flying());
    if (LFm && !flyOn) { step *= LFm.moveMul(pos.x, pos.y, ux, uy, dt); }               // ⑲-62 뜬 동안은 강·능선 감속이 없다
    var nx = pos.x + ux * step, ny = pos.y + uy * step;
    var rects = (LFm && LFm.onPole && LFm.onPole()) || (MTf && MTf.overRoofs && MTf.overRoofs()) ? [] : solidRectsNear(pos.x, pos.y);   // ⑲-34 들보 위는 벽 위다 · ⑲-62 6m 넘게 뜨면 지붕을 넘는다
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
    core.save.player.distance += moved;
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
      if (player.footAcc >= 6) {
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
  function wanderSpawns(dt) {
    var pos = core.save.player.pos, now = Date.now();
    for (var i = 0; i < spawns.length; i++) {
      var s = spawns[i];
      var near = Math.hypot(s.x - pos.x, s.y - pos.y) <= ENCOUNTER_RANGE;

      if (near) {
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
        var rad = Math.random() * WANDER_R;
        s.tx = s.homeX + Math.cos(ang) * rad;
        s.ty = s.homeY + Math.sin(ang) * rad;
        continue;
      }
      var step = WANDER_SPEED * dt;
      s.x += dx / d * step;
      s.y += dy / d * step;
      s.moving = true;
      if (Math.abs(dx) > 0.4) { s.facing = dx > 0 ? 1 : -1; } s.dirX = dx; s.dirY = dy;
      s.phase += dt * 7.5;
    }
  }

  /* ── 지도 타일 ────────────────────────────────────────── */

  var tiles = {};              // "z/x/y" → Image
  var tileFail = 0, tileOk = 0;
  /* 지도 타일 주소 한 곳(W-0059) — 2026-10 CARTO 가 키 없는 공개 타일을 막아 "API KEY REQUIRED" 자리표시 그림(2049B)만 준다.
     키 없이 실제 지도를 주는 OpenStreetMap 표준 타일로 옮겼다(@2x 는 없다 — 256px 한 종류). 다른 서버로 바꿀 땐 이 줄만:
     {z}{x}{y}. 과하게 받으면 막힐 수 있다(OSM 이용 정책) — 화면 둘레 몇십 장만 받고 sw.js 가 캐시한다. */
  var TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  function tileUrl(x, y, z) {
    return TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  }

  function getTile(x, y, z) {
    var key = z + '/' + x + '/' + y;
    var t = tiles[key];
    if (t) { return t; }
    var img = new Image();
    /* 3D 렌더러(world3d.js)가 이 이미지를 **WebGL 텍스처**로 올린다.
       cross-origin 이미지는 crossOrigin 없이는 텍스처로 못 쓴다(SecurityError).
       2D 캔버스 쪽에는 아무 영향이 없다. */
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = function () { img.ready = true; tileOk++; };
    img.onerror = function () { img.failed = true; tileFail++; };
    img.src = tileUrl(x, y, z);
    tiles[key] = img;
    // 캐시가 너무 커지면 오래된 것부터 버린다
    var ks = Object.keys(tiles);
    if (ks.length > 500) { for (var i = 0; i < 120; i++) { delete tiles[ks[i]]; } }
    return img;
  }

  /** 타일을 한 장도 못 받은 상태면 프로시저럴 지형으로 폴백 */
  function tilesUsable() { return !(tileFail > 6 && tileOk === 0); }

  /* ── 프로시저럴 폴백 지형 ─────────────────────────────── */

  var TERRAIN = {
    water: '#16324f', grass: '#243528', forest: '#1d2f22',
    road: '#3a3f4a', town: '#3a352e', mount: '#333039',
    /* 손으로 그린 땅이 들고 온 것 (`land.js`) — 논밭은 들보다 밝고 누르스름하다 */
    farm: '#2f3a26'
  };

  /** 2026-09-08 — 지형 노이즈: `core.hash2`를 그대로 쓰면 칸마다 완전히
   *  독립이라(소금·후추 노이즈) 숲 한 칸·산 한 칸이 뿔뿔이 흩어져 "바둑판
   *  같다"는 지적을 받았다(사용자, `saga-go/HANDOFF.md` 2026-09-07 큐 —
   *  세계 격자무늬 길·구역 이름과는 별개 원인이었다). `core.noise2()`로
   *  이웃 칸과 이어 붙인다 — 굵은 결(9칸≈432m 폭)에 가는 결(3칸≈144m 폭)을
   *  얹어(2옥타브 값 노이즈) 뭉치되 경계가 너무 매끈하지만은 않게 했다.
   *  두 번째 옥타브는 좌표를 +500 밀어 첫 옥타브와 우연히 겹치지 않게 한다. */
  function terrainNoise(tx, ty) {
    return core.noise2(tx, ty, 9) * 0.65 + core.noise2(tx + 500, ty + 500, 3) * 0.35;
  }
  /** 문턱값 — 예전에 `core.hash2`를 직접 문턱 매길 때와 **같은 비율**(물14%·
   *  산18%·숲36%·마을12%·들20%)이 나오도록 위 `terrainNoise`를 400만 표본
   *  뽑아 분위수로 다시 잰 값이다(옥타브를 섞으면 평균 쪽으로 쏠려 옛 문턱을
   *  그대로 쓰면 숲만 태반이고 물·들은 거의 안 나온다 — 실측 후 보정). 겉보기만
   *  자연스러워지고 종류별 넓이 비율은 그대로다. */
  var TERRAIN_BAND = {
    water: [0, 0.1614], mount: [0.1614, 0.2106],
    forest: [0.2106, 0.2905], town: [0.2905, 0.3211]
  };

  /** 2026-09-04 — 이 칸(또는 바로 옆 네 칸)에 마을이 있나. `terrainAt`의
   *  격자무늬 길이 "마을 근처에서만" 서게 가르는 문턱이다. 마을 판정은
   *  `terrainAt`이 쓰는 것과 **같은 노이즈·같은 문턱**(`TERRAIN_BAND.town`)을
   *  그대로 재사용한다 — 다른 기준을 새로 만들면 집이 실제로 서는 자리
   *  (`propPlan('town', gx, gy, ...)`가 `terrainAt(gx,gy)==='town'`인 칸에
   *  얹힌다)와 길이 어긋난다.
   *
   *  **넓이를 두 번 실측하고 골랐다** — 자가진단 없이는 안 보이는 자리라
   *  임시 헤드리스 표본 페이지로 -200..200 범위를 직접 세었다:
   *  자기 칸만(반경 0) 2.85%, **십자 다섯 칸(자기+상하좌우) 11.20%**,
   *  3x3(반경 1) 16.21%, 5x5(반경 2) 22.90%(옛 격자 23.8%와 거의 같다 —
   *  이 폭은 "거의 전부"라 마을 근처 제한이 사실상 무효화된다). 반경 0은
   *  마을 칸 자신이 격자선에 정확히 걸릴 때만 길이 서서 마을에도 길이
   *  거의 안 남았다. **십자 다섯 칸**을 골랐다 — 옛 값의 절반 아래로
   *  줄면서도 마을 안팎에 길이 끊기지 않을 만큼은 남는다. */
  function nearTown(tx, ty) {
    var pts = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]], i, h, b;
    for (i = 0; i < pts.length; i++) {
      h = terrainNoise(tx + pts[i][0], ty + pts[i][1]);
      b = bandFor(tx + pts[i][0], ty + pts[i][1]);
      if (h >= b.forest && h < b.town) { return true; }
    }
    return false;
  }

  /** 2026-09-24 — 지역(biome.js, PLAN §5 ⑩)마다 노이즈 문턱이 다르다. 모듈이 없거나
   *  꺼져 있으면 옛 문턱 그대로(고향 지역은 켜져 있어도 옛 비율과 같다) */
  var LEGACY_BAND = { water: TERRAIN_BAND.water[1], mount: TERRAIN_BAND.mount[1],
    forest: TERRAIN_BAND.forest[1], town: TERRAIN_BAND.town[1], clear: false };
  var bandCache = {}, bandCount = 0;
  function bandFor(tx, ty) {
    var BM = global.DG.biome;
    if (!BM || !BM.on()) { return LEGACY_BAND; }
    /* 칸마다 한 번만 — 미니맵·기복·소품이 같은 칸을 수백 번 묻는다(아홉 지역 가중이 싸지 않다) */
    var k = tx + ',' + ty, b = bandCache[k];
    if (b) { return b; }
    if (bandCount > 30000) { bandCache = {}; bandCount = 0; }
    b = bandCache[k] = BM.bandAt((tx + 0.5) * 48, (ty + 0.5) * 48);
    bandCount++;
    return b;
  }

  /** 2026-09-04 — 마을 근처 길을 tx%7 과 ty%9 **둘 다** 세우니 십자로 겹쳐
   *  "바둑판 같다"는 지적이 반경을 좁힌 뒤에도(마을 안은 여전히 그대로라)
   *  남았다. 당시엔 town 판정이 칸마다 독립인 해시라(퍼진 소금·후추 무늬)
   *  실제 마을 하나를 묶어 줄 값이 없었다 — 대신 `ROAD_REGION` 칸짜리 성긴
   *  구역으로 세상을 나눠 구역마다 축(세로만 또는 가로만)을 하나씩 고정했다.
   *  (2026-09-08 갱신: `terrainAt`이 `terrainNoise`로 바뀌면서 town 판정도
   *  이제 이웃과 뭉친다 — 그래도 동네 하나가 몇 칸씩 걸치면 축이 안 맞을 수
   *  있어 이 구역별 고정은 그대로 둔다, 손해는 없다.)
   *  `core.hash2` 는 실측상 0~0.5 만 돌려주므로(다른 자리의 h1 참고) 문턱은
   *  그 절반인 0.25. 이 값도 그리는 데만 쓴다. */
  var ROAD_REGION = 16;
  function roadIsVertical(tx, ty) {
    var rx = Math.floor(tx / ROAD_REGION), ry = Math.floor(ty / ROAD_REGION);
    return core.hash2(rx * 8321 + 17, ry * 5023 + 41) < 0.25;
  }

  /**
   * 이 격자가 무슨 땅이냐. **그리는 데만 쓴다** — 스폰·거리·조우는 이 값을 안 본다.
   *
   * 원래는 좌표를 넣으면 답이 나오는 **무한한 해시**뿐이었다. 지금은 세 겹이다 —
   * **손으로 그린 땅**(`land.js`, 원점 둘레 1km) → **실제 지형**(`geo.js`,
   * OpenStreetMap, 2026-09-05 "지도가 허접하다" 사용자 지적으로 추가) →
   * 그래도 안 정해지면(오프라인이거나 아직 못 받아 온 자리) 여태 하던 대로
   * 좌표 해시가 답한다. 아무 레이어도 없거나 다 꺼져 있으면 이 함수는
   * 예전과 한 글자도 다르지 않다.
   *
   * 2026-09-04 — 여태 길(`tx%7===0‖ty%9===0`)이 **세상 전체에 무조건** 섰다.
   * 실사 소재를 깔고 나니 이 완전한 격자가 "바둑판 같다"고 눈에 띄었다
   * (사용자 지적) — 실사 도로 텍스처(`road.webp`, 이미 사진이다) 자체는
   * 문제가 아니었다, 배치가 문제였다. **마을 근처(자기 칸+상하좌우)에서만** 서게
   * 가른다 — 마을 사이 빈 들판은 이제 격자 없이 해시가 그대로 답한다
   * (숲·산·물·들로 자연스럽게 갈린다). `nearTown()` 참고. 이 값은 그리는
   * 데만 쓰여 스폰·거리·조우·`land.js` 시험판(그쪽은 손으로 그린 별도
   * 지도라 안 건드림)에는 안 닿는다 — 회귀 위험이 낮다.
   *
   * 그런데도 마을 **안**에서는 여전히 두 축이 겹쳐 바둑판으로 보였다(같은
   * 지적, 반경을 좁힌 뒤 재확인). `roadIsVertical()` 로 동네(`ROAD_REGION`
   * 구역)마다 한 축만 서게 갈라 십자 교차를 없앤다 — 동네마다 세로길
   * 동네만 또는 가로길 동네만 되어 "마을마다 방향이 다르게" 보인다.
   *
   * 2026-09-08 — 그런데도 "바둑판 같다"는 지적이 다시 나왔다. 길이 아니라
   * **지형 종류 자체**가 원인이었다 — `core.hash2(tx,ty)`를 곧바로 문턱
   * 매기면 칸마다 완전히 독립이라 숲·산·물이 한 칸씩 흩어진다(위 `terrainNoise`
   * 주석 참고). `terrainNoise()`(이웃과 이어지는 값 노이즈)로 바꿔 숲은
   * 숲대로, 산은 산줄기로, 물은 호수·강으로 뭉치게 했다. */
  function terrainAt(tx, ty) {
    var R = global.DG.land;
    if (R) {
      var authored = R.terrainAt(tx, ty);
      if (authored) { return authored; }
    }
    /* 손으로 그린 땅 밖은 실제 지형(geo.js, OpenStreetMap)이 있으면 그쪽을
       쓴다 — 아직 안 받아 왔으면(또는 꺼져 있으면) null 이라 밑의 노이즈가 그대로 답한다 */
    var G = global.DG.geo;
    if (G) {
      var real = G.terrainAt(tx, ty);
      if (real) { return real; }
    }
    var h = terrainNoise(tx, ty), band = bandFor(tx, ty);
    if (band.clear) { return 'grass'; }          // 지역 랜드마크 둘레는 비운다(§5 ⑩)
    /* §5 ⑰ 지형 설계 — 손으로 그은 강·호수·산맥(고향 1.3km 밖). 없으면 null 이라 노이즈가 답한다 */
    var LF = global.DG.landform;
    if (LF) {
      var shaped = LF.kindAt(tx, ty);
      if (shaped) { return shaped; }
    }
    var road = roadIsVertical(tx, ty) ? (tx % 7 === 0) : (ty % 9 === 0);
    if (road && nearTown(tx, ty)) { return 'road'; }
    if (h < band.water) { return 'water'; }
    if (h < band.mount) { return 'mount'; }
    if (h < band.forest) { return 'forest'; }
    if (h < band.town) { return 'town'; }
    return 'grass';
  }

  /** 2026-09-10 — 2D 폴백 지형도 실제 사진으로. 3D(`world3d.js`의
   *  `landTexture`)가 이미 받아 둔 ambientCG CC0 땅 사진(`assets/textures/
   *  land/`)을 그대로 재사용한다 — `water`는 3D처럼 뺀다(맞는 CC0 사진이
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
    grass: ['assets/textures/land/grass1.webp', 'assets/textures/land/grass2.webp', 'assets/textures/land/grass3.webp'],
    forest: ['assets/textures/land/forest1.webp', 'assets/textures/land/forest2.webp', 'assets/textures/land/forest3.webp'],
    mount: ['assets/textures/land/mount1.webp', 'assets/textures/land/mount2.webp', 'assets/textures/land/mount3.webp'],
    road: ['assets/textures/land/road1.webp', 'assets/textures/land/road2.webp', 'assets/textures/land/road3.webp'],
    town: ['assets/textures/land/town1.webp', 'assets/textures/land/town2.webp', 'assets/textures/land/town3.webp'],
    farm: ['assets/textures/land/farm1.webp', 'assets/textures/land/farm2.webp', 'assets/textures/land/farm3.webp']
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
          patCache[kind] = (LAND_TEX_VARIANTS[kind] || global.DG.mode2d.tileUrl(kind)) ? landPattern2D(ctx, kind, camX, camY, sc) : null;
        }
        var pat = patCache[kind];
        if (pat) {
          ctx.fillStyle = pat;
          ctx.fillRect(sx, sy, T + 1, T + 1);
        } else {
          ctx.fillStyle = TERRAIN[kind];
          ctx.fillRect(sx, sy, T + 1, T + 1);
        }
      }
    }
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

  var spawnSeq = 0;

  function makeSpawn() {
    var pos = core.save.player.pos;
    var ang = Math.random() * Math.PI * 2;
    var dist = 70 + Math.random() * (SPAWN_RADIUS - 70);
    /* 비 오는 날은 짐승이, 바람 부는 날은 사람이 더 많다 */
    var wb = global.DG.weather ? global.DG.weather.heroBias() : 0;
    var isHero = Math.random() < core.clamp(0.42 + wb, 0.08, 0.9);
    var rar = rarityRoll();
    var sx = pos.x + Math.cos(ang) * dist;
    var sy = pos.y + Math.sin(ang) * dist;
    var region = genRegionAt(sx, sy);
    return {
      uid: ++spawnSeq,
      kind: isHero ? 'hero' : 'pet',
      ref: isHero ? pickHero(rar, region) : pickPet(rar, region),
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
  function maxSpawns() {
    var lure = global.DG.bag && global.DG.bag.lured();
    var few = global.DG.weather && global.DG.weather.fewer();
    return Math.max(4, MAX_SPAWNS + (lure ? 6 : 0) - (few ? 3 : 0));
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
  var ZOOM3_MIN = 0.7, ZOOM3_MAX = 9;
  /* 기본 배율 — 원작만 한 배율(×1, 아바타가 화면의 1/8)로 열면 **한 마리도 안 보인다.**
     야생 대상이 70m 밖부터 생기기 때문이다. 켜자마자 보이는 자리에서 시작하고,
     가까이 보고 싶으면 휠로 당긴다. 옛 세이브에는 이 칸이 없으니 여기서 채운다 */
  var ZOOM3_DEFAULT = 1.4;   // 2026-09-27 실기 "3인칭처럼" — ×4(높이 멀리)에서 캐릭터 뒤 가까이로. 옛 세이브는 아래 cam3p 로 한 번 옮긴다

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

