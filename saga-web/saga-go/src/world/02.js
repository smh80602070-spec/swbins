  /* ── 2D·2.5D 줌 ───────────────────────────────────────────
   * 3D 와 같은 결이다 — **화면 값이다.** scale() 에 곱해 넣으므로 지도 타일·
   * 오브젝트·판정(onClick 히트 반경)까지 한 번에 늘고 준다. 좌표·거리·
   * 조우 사거리는 그대로다.
   */
  var ZOOM2_MIN = 0.4, ZOOM2_MAX = 2.2, ZOOM2_DEFAULT = 1;

  function camZoom2d() {
    var raw = core.save.settings ? core.save.settings.camZoom2d : undefined;
    if (raw === undefined || raw === null || raw === '') { raw = ZOOM2_DEFAULT; }
    var z = Number(raw);
    if (!isFinite(z) || z <= 0) { z = ZOOM2_DEFAULT; }
    return core.clamp(z, ZOOM2_MIN, ZOOM2_MAX);
  }
  function setCamZoom2d(z) {
    if (!core.save.settings) { return 1; }
    core.save.settings.camZoom2d = core.clamp(z, ZOOM2_MIN, ZOOM2_MAX);
    core.emit('zoom2d', core.save.settings.camZoom2d);
    return core.save.settings.camZoom2d;
  }
  function nudgeZoom2d(mul) { return setCamZoom2d(camZoom2d() * mul); }

  /**
   * 3인치 모드 — 폰을 멀리 든 것처럼 화면을 확 줄여 넓게 본다(사용자 요청:
   * "3인치 모드 넣어줘" → 카메라 시야 축소 모드). 켜기 전의 배율을 저장해
   * 뒀다가 끄면 그 배율로 그대로 돌아간다. 2D·2.5D·3D 어느 시점에서 켜든
   * 같은 스위치 하나로 그 시점의 배율만 넓힌다.
   */
  function is3inch() { return !!(core.save.settings && core.save.settings.wide3in); }
  function toggle3inch() {
    if (!core.save.settings) { return false; }
    if (is3inch()) {
      if (core.save.settings.zoom2dPrev !== undefined) { setCamZoom2d(core.save.settings.zoom2dPrev); }
      if (core.save.settings.zoom3dPrev !== undefined) { setZoom3d(core.save.settings.zoom3dPrev); }
      core.save.settings.wide3in = false;
    } else {
      core.save.settings.zoom2dPrev = camZoom2d();
      core.save.settings.zoom3dPrev = zoom3d();
      setCamZoom2d(ZOOM2_MIN);
      setZoom3d(ZOOM3_MIN);
      core.save.settings.wide3in = true;
    }
    core.persist();
    return is3inch();
  }

  /** 시점 모드 — 0: 2D · 1: 2.5D · 2: 3D */
  function tiltMode() {
    var t = core.save.settings ? core.save.settings.tilt : 0;
    return t === 2 ? 2 : (t ? 1 : 0);
  }
  function tiltOn() { return tiltMode() > 0; }

  function initCanvas(objEl, groundEl) {
    canvas = objEl; ctx = canvas.getContext('2d');
    gCanvas = groundEl; gCtx = gCanvas.getContext('2d');
    resize();
    global.addEventListener('resize', resize);
    /* PLAN 30절 — resize 만으로도 대개 잡히지만, 회전 직후에는 일부 기기의
       innerWidth/innerHeight 가 아직 예전 값일 수 있다고 알려져 있다.
       orientationchange 도 같이 듣고, 한 번 더 늦춰 잰다 */
    global.addEventListener('orientationchange', function () {
      resize();
      setTimeout(resize, 200);
    });
    canvas.addEventListener('click', onClick);
    bindZoom(canvas);
    /* 3D 렌더러는 **있으면 쓴다.** WebGL 이 없거나 켜다 실패하면 그대로 2D 로 돈다.
       탭 이동(walkTo)은 2D 캔버스가 그대로 받는다 — 3D 캔버스는 그 아래 깔린다. */
    /* 자가진단(DG_NO_DRAW)에서는 **켜지도 않는다.** 헤드리스에도 WebGL 이 있어서
       켜 두면 켜진 것으로 판정되고, 조우 무대 같은 화면 층이 그 값을 보고 갈린다 */
    if (global.DG.world3d && !global.DG_NO_DRAW) {
      global.DG.world3d.init(document.getElementById('map3d'));
      /* 2026-09-27 실기 "이동할 때 3인칭처럼" — 3D 가 켜졌으면 한 번만 3D 시점·가까운 줌(캐릭터 뒤)으로 옮긴다.
         그 뒤 사용자가 바꾼 시점·줌은 그대로 둔다(cam3p 표시) */
      var S3 = core.save.settings;
      if (S3 && !S3.cam3p && global.DG.world3d.active && global.DG.world3d.active()) {
        S3.tilt = 2; S3.zoom3d = ZOOM3_DEFAULT; S3.cam3p = 1; core.persist();
      }
    }
    syncRenderMode();
  }

  /**
   * 지금 시점에 맞는 줌 손잡이를 고른다.
   *
   * **함정이었다** — `world3d`(WebGL) 는 시점 버튼이 2D 든 2.5D 든 3D 든
   * 늘 켜져서(`active()`, `world.render3d` 튜닝이 꺼지지 않는 한) 카메라를
   * 그린다(`world3d.js`의 `syncCamera` 가 `W.tiltMode` 셋 다에서 `W.zoom3d`
   * 를 그대로 쓴다). 그런데 이 손잡이는 처음에 "3D(tiltMode===2)에서만
   * zoom3d, 나머지는 camZoom2d" 로 갈랐다 — 그래서 대부분의 기기(WebGL이
   * 되는 기기)에서는 2D·2.5D 에서 휠을 돌려도 실제로 그려지는 카메라와
   * 무관한 값(camZoom2d)만 바뀌어 화면이 그대로였다("마우스로 확대 축소가
   * 안되네", 2026-08-30 실사용 신고로 발견).
   *
   * `camZoom2d`(→ `scale()`)는 WebGL 이 없거나 꺼졌을 때 쓰는 2D 캔버스
   * 폴백 렌더러(`drawGround`·`drawObjects`)에서만 실제로 읽힌다 — 그때만
   * 골라 쓴다.
   */
  function nudgeCamZoom(mul) {
    var W3 = global.DG.world3d;
    return (W3 && W3.active && W3.active()) ? nudgeZoom(mul) : nudgeZoom2d(mul);
  }

  /** 휠과 두 손가락으로 카메라를 당기고 민다 — 2D·2.5D·3D 어디서든 듣는다 */
  function bindZoom(cv) {
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      nudgeCamZoom(e.deltaY > 0 ? 1.12 : 1 / 1.12);
      core.persist();
    }, { passive: false });

    var pinch = 0;
    function span(t) {
      return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    }
    cv.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) { pinch = span(e.touches); }
    }, { passive: true });
    cv.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 2 || !pinch) { return; }
      var now = span(e.touches);
      if (now > 8) {
        nudgeCamZoom(pinch / now);        // 벌리면 가까이, 오므리면 멀리
        pinch = now;
      }
      e.preventDefault();
    }, { passive: false });
    cv.addEventListener('touchend', function (e) {
      if (e.touches.length < 2 && pinch) { pinch = 0; core.persist(); }
    }, { passive: true });

    /* ── 돌려 보기 (PLAN 7·26절 "마우스/터치 회전") ──────
     * 한 손가락 · 마우스 왼쪽으로 가로로 끌면 카메라가 나를 축으로 돈다.
     * **탭과 구분해야 한다** — 지도를 눌러 걸어가는 조작이 이미 그 자리에 있다.
     * 그래서 **10px 을 넘게 끌어야** 돌기 시작하고, 그때부터는 탭으로 안 친다
     * (`onClick` 이 `dragged` 를 보고 스스로 물러난다).
     */
    var dx0 = 0, dy0 = 0, moved = 0, turning = false;
    function turnBy(px) {
      var W3 = global.DG.world3d;
      if (!W3 || !W3.turn || tiltMode() !== 2) { return; }
      /* 화면 폭의 절반을 끌면 반 바퀴 — 폰에서도 손이 안 아프게.
         2026-09-06, "마우스가 반대다"로 발견 — 오른쪽으로 끌면 여태
         화면 왼쪽에 있던 쪽을 보도록 돌았다(다른 3인칭 게임은 오른쪽으로
         끌면 오른쪽을 본다). 부호를 반대로 뒤집었다 */
      W3.turn(px / Math.max(180, geom ? geom.W : 360) * Math.PI);
    }
    function down(x, y) { dx0 = x; dy0 = y; moved = 0; turning = false; }
    function move(x, y) {
      moved = Math.max(moved, Math.hypot(x - dx0, y - dy0));
      if (!turning && moved > DRAG_MIN) { turning = true; }
      if (!turning) { return false; }
      turnBy(x - dx0);
      dx0 = x; dy0 = y;
      return true;
    }
    cv.addEventListener('mousedown', function (e) { down(e.clientX, e.clientY); });
    cv.addEventListener('mousemove', function (e) {
      if (e.buttons !== 1) { return; }
      if (move(e.clientX, e.clientY)) { dragged = true; }
    });
    cv.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) { down(e.touches[0].clientX, e.touches[0].clientY); }
    }, { passive: true });
    cv.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 1) { return; }
      if (move(e.touches[0].clientX, e.touches[0].clientY)) {
        dragged = true;
        e.preventDefault();
      }
    }, { passive: false });
  }

  /** 이만큼 끌어야 돌리는 것으로 본다(px) — 그 아래는 탭이다 */
  var DRAG_MIN = 10;
  /** 방금 끈 것인가 — `onClick` 이 이걸 보고 물러난다 */
  var dragged = false;

  /** 3D 를 쓰는 동안에는 2D 두 장을 감춘다 (같은 그림을 두 번 그리지 않게) */
  var lastRenderMode = null;
  function syncRenderMode() {
    var on = !!(global.DG.world3d && global.DG.world3d.active());
    /* 발열(2026-09-24) — 여태 매 프레임 body 클래스·style 을 쓰고 화면 전체 2D 캔버스를 지웠다(빈 캔버스를 또 지우고
       다시 합성). 3D 동안 이 캔버스에 그리는 곳은 없다 — 켜짐/꺼짐이 바뀔 때와 크기가 바뀐 뒤(resize 가 lastRenderMode 를 비운다)만 */
    if (on === lastRenderMode) { return on; }
    lastRenderMode = on;
    /* 화면을 덮는 것들(비네트의 가짜 지평선)을 걷어 준다 — css 의 body.r3d */
    if (document.body) { document.body.classList.toggle('r3d', on); }
    var el3 = document.getElementById('map3d');
    if (el3) { el3.style.display = on ? 'block' : 'none'; }
    if (gCanvas) { gCanvas.style.visibility = on ? 'hidden' : 'visible'; }
    /* 오브젝트 캔버스는 **클릭을 받는 자리**라 지우지 않고 비워만 둔다 */
    if (on && ctx && geom) { ctx.clearRect(0, 0, geom.W, geom.H); }
    return on;
  }

  /** 화면을 덮으려면 지면이 얼마나 커야 하는지 역산한다 */
  function computeGeom() {
    var r = canvas.getBoundingClientRect();
    var W = Math.max(1, r.width), H = Math.max(1, r.height);
    var md = tiltMode();
    if (!md) {
      return { W: W, H: H, GW: W, GH: H, ox: W / 2, oy: H / 2,
               cx: W / 2, cy: H / 2, tilt: 0, sin: 0, cos: 1, persp: PERSP, mode: 0 };
    }
    var tiltDeg = md === 2 ? TILT3_DEG : TILT_DEG;
    var persp = md === 2 ? PERSP3 : PERSP;
    var cy = md === 2 ? H * ANCHOR3 : H / 2;      // 플레이어가 서는 화면 세로 위치
    var th = tiltDeg * Math.PI / 180, sin = Math.sin(th), cos = Math.cos(th);
    var upH = cy, downH = H - cy, pad = 80;
    // 화면 위쪽은 멀어져 축소되므로 지면이 훨씬 많이 필요하다 (지평선 근처는 상한을 둔다)
    var denom = Math.max(persp * cos - upH * sin, persp * cos * 0.22);
    var up = Math.min(upH * persp / denom, H * 2.6);
    var down = downH * persp / (persp * cos + downH * sin);
    var GH = up + down + pad * 2, oy = up + pad;
    var sTop = persp / (persp + up * sin);
    var GW = W / sTop + pad * 2;
    return { W: W, H: H, GW: GW, GH: GH, ox: GW / 2, oy: oy,
             cx: W / 2, cy: cy, tilt: tiltDeg, sin: sin, cos: cos, persp: persp, mode: md };
  }

  /** 지면 로컬(플레이어 기준) → 화면 좌표 + 원근 배율 */
  function project(u, v) {
    if (!geom.tilt) { return { x: geom.cx + u, y: geom.cy + v, s: 1 }; }
    var s = geom.persp / Math.max(geom.persp - v * geom.sin, geom.persp * 0.12);
    return { x: geom.cx + u * s, y: geom.cy + v * geom.cos * s, s: s };
  }

  /** 화면 좌표 → 지면 로컬 (클릭 판정용) */
  function unproject(X, Y) {
    if (!geom.tilt) { return { u: X - geom.cx, v: Y - geom.cy }; }
    var dx = X - geom.cx, dy = Y - geom.cy;
    var den = geom.persp * geom.cos + dy * geom.sin;
    if (Math.abs(den) < 1) { den = den < 0 ? -1 : 1; }
    var v = dy * geom.persp / den;
    var s = geom.persp / Math.max(geom.persp - v * geom.sin, geom.persp * 0.12);
    return { u: dx / s, v: v };
  }

  function resize() {
    if (!canvas) { return; }
    lastRenderMode = null;
    if (global.DG.world3d) { global.DG.world3d.resize(); }
    dpr = global.devicePixelRatio || 1;
    geom = computeGeom();

    canvas.width = Math.floor(geom.W * dpr);
    canvas.height = Math.floor(geom.H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 지면은 넓어서 해상도를 1.5배로 묶어 부담을 줄인다
    var gdpr = Math.min(dpr, 1.5);
    gCanvas.width = Math.floor(geom.GW * gdpr);
    gCanvas.height = Math.floor(geom.GH * gdpr);
    gCtx.setTransform(gdpr, 0, 0, gdpr, 0, 0);
    gCanvas.style.width = geom.GW + 'px';
    gCanvas.style.height = geom.GH + 'px';
    gCanvas.style.left = (geom.cx - geom.ox) + 'px';
    gCanvas.style.top = (geom.cy - geom.oy) + 'px';
    gCanvas.style.transformOrigin = geom.ox + 'px ' + geom.oy + 'px';
    gCanvas.style.transform = geom.tilt
      ? 'perspective(' + geom.persp + 'px) rotateX(' + geom.tilt + 'deg)'
      : 'none';
    document.body.classList.toggle('tilted', !!geom.tilt);
    document.body.classList.toggle('tilted3', geom.mode === 2);
  }

  /** 전투성 대화창이 열려 있으면 참 — 그동안은 클릭·키로 세상을 움직이지 않는다.
   *  2026-09-06, "도적이랑 싸울 때 클릭한 데로 이동해서 싸우는 것 같지 않다"로
   *  발견 — `fort.js`·`station.js`·`rogue.js`·`letter.js`는 이미 다들
   *  `encounter.active`를 보고 스스로 멈추는데, `world.js` 자신의 이동만
   *  이 문을 안 보고 있었다(도적 습격은 `rogue.js`의 별도 모달이라
   *  `encounter.active`만 봐서는 안 걸린다 — `rogue.active`도 같이 본다) */
  function inputBlocked() {
    var D = global.DG;
    return !!((D.encounter && D.encounter.active) ||
      (D.rogue && D.rogue.active) || (D.duel && D.duel.active) ||
      (D.fishing && D.fishing.active));                              // §5 ⑲-24 낚시 중엔 선다(이동 키는 고리를 옮긴다)
  }

  function onClick(e) {
    /* 끌어서 돌린 뒤에 오는 클릭은 **탭이 아니다** — 안 걸러내면 시점을 돌릴
       때마다 그쪽으로 걸어간다(터치에서 특히 티가 난다) */
    if (dragged) { dragged = false; return; }
    if (inputBlocked()) { return; }
    var r = canvas.getBoundingClientRect();
    var sc = scale(), pos = core.save.player.pos;
    var loc = unproject(e.clientX - r.left, e.clientY - r.top);
    var ru = loc.u / sc, rv = loc.v / sc;
    /* 3D에서 마우스로 돌려 본(yaw) 뒤에는 화면의 "위"가 더는 세계의 -y가
       아니다 — 2026-09-06, "마우스 돌린 뒤 클릭 이동이 반대로/엉뚱한 데로
       간다"로 발견. `world3d.js`의 `camAim()`이 카메라를 이 yaw만큼 돌리는
       것과 같은 회전을 여기서도 걸어야 화면에서 누른 자리와 실제로 걸어가는
       자리가 맞는다(안 돌린 2D·2.5D에서는 yaw가 늘 0이라 그대로다) */
    var W3 = global.DG.world3d;
    var yw = (W3 && W3.yaw && tiltMode() === 2) ? W3.yaw() : 0;
    var cs = Math.cos(yw), sn = Math.sin(yw);
    var wx = pos.x + (ru * cs - rv * sn), wy = pos.y + (ru * sn + rv * cs);
    /* 3D 가 켜져 있으면 카메라 광선으로 누른 땅을 찾는다(2026-09-27 실기 "클릭한 곳으로 이동도 안 함") —
       원근 3인칭 카메라에선 위 2D 역산이 누른 자리와 어긋난다. 하늘을 누르면(땅에 안 닿으면) 2D 값으로 둔다 */
    var pk = W3 && W3.active && W3.active() && W3.pickGround ? W3.pickGround(e.clientX, e.clientY) : null;
    if (pk) { wx = pk.x; wy = pk.y; }
    clickMarks.push({ x: wx, y: wy, at: Date.now() });
    if (clickMarks.length > 6) { clickMarks.shift(); }
    /* 2D 표시(`clickMarks`)는 3D가 켜지면 숨는 캔버스에만 그려져 안 보인다 —
       2026-09-06, "클릭 자리 표시가 없다"로 발견. 3D 바닥에도 같은 표시를 얹는다 */
    if (W3 && W3.active && W3.active() && W3.clickMark) { W3.clickMark(wx, wy); }
    var hitR = 30 / sc;
    var best = null, bestD = Infinity;
    for (var i = 0; i < spawns.length; i++) {
      var d = Math.hypot(spawns[i].x - wx, spawns[i].y - wy);
      if (d < hitR && d < bestD) { bestD = d; best = spawns[i]; }
    }
    // 성채 — 건물이 커서 히트 범위도 넓다
    var ftHit = null, ftD = Infinity;
    var ftl = fortsNear();
    for (var fj = 0; fj < ftl.length; fj++) {
      var fd = Math.hypot(ftl[fj].x - wx, ftl[fj].y - wy);
      if (fd < hitR * 1.5 && fd < ftD) { ftD = fd; ftHit = ftl[fj]; }
    }
    if (ftHit && (!best || ftD < bestD)) {
      var fdist = Math.hypot(ftHit.x - pos.x, ftHit.y - pos.y);
      if (fdist <= ENCOUNTER_RANGE) { core.emit('fort:request', ftHit); }
      else {
        if (mode === 'keyboard') { walkTo(ftHit.x, ftHit.y); }
        core.emit('toast', '성채가 멉니다 · ' + Math.round(fdist) + 'm · 그쪽으로 걸어갑니다');
      }
      return;
    }

    // 역참도 같은 자리에서 받는다 — 더 가까운 쪽을 고른다
    var stHit = null, stD = Infinity;
    var sts = stationsNear();
    for (var k = 0; k < sts.length; k++) {
      var sd = Math.hypot(sts[k].x - wx, sts[k].y - wy);
      if (sd < hitR * 1.2 && sd < stD) { stD = sd; stHit = sts[k]; }
    }
    if (stHit && (!best || stD < bestD)) {
      var sdist = Math.hypot(stHit.x - pos.x, stHit.y - pos.y);
      if (sdist <= ENCOUNTER_RANGE) { core.emit('station:request', stHit); }
      else {
        if (mode === 'keyboard') { walkTo(stHit.x, stHit.y); }
        core.emit('toast', '역참이 멉니다 · ' + Math.round(sdist) + 'm · 그쪽으로 걸어갑니다');
      }
      return;
    }
    if (!best) {
      /* 스폰·역참·성채가 **아무것도 안 잡혔을 때만** 주민·짐승을 본다(`talk.js`).
         잡고 설득하는 판정의 순서는 한 치도 안 바뀐다 — 여태 그냥 "빈 땅" 으로
         흘러가던 자리에 한 겹이 끼어들 뿐이다 */
      var T = global.DG.talk;
      var folk = T ? T.pick(wx, wy, hitR) : null;
      if (folk) {
        var r2 = T.tap(folk);
        if (r2 === 'walk') {
          if (mode === 'keyboard') { walkTo(folk.it.x, folk.it.y); }
          return;
        }
        if (r2) { return; }
      }
      // 빈 땅을 눌렀다 — 그쪽으로 걸어간다 (손가락으로 하는 이동)
      if (mode === 'keyboard') { walkTo(wx, wy); }
      core.emit('toast', '📍 (' + Math.round(wx) + ', ' + Math.round(wy) + ')');
      return;
    }
    var dist = Math.hypot(best.x - pos.x, best.y - pos.y);
    if (dist <= ENCOUNTER_RANGE) { core.emit('encounter:request', best); }
    else {
      if (mode === 'keyboard') { walkTo(best.x, best.y); }   // 멀면 일단 그쪽으로 걷는다
      core.emit('toast', '너무 멉니다 · ' + Math.round(dist) + 'm · 그쪽으로 걸어갑니다');
    }
  }

  function draw() {
    if (!ctx) { return; }
    var r = canvas.getBoundingClientRect();
    if (!geom || Math.abs(geom.W - r.width) > 1 || Math.abs(geom.H - r.height) > 1) { resize(); }
    if (syncRenderMode()) {
      global.DG.world3d.render();
      return;                                  // 3D 가 그렸다 — 2D 는 건너뛴다
    }
    drawGround();
    drawObjects();
  }

  /* ── 지면 ─────────────────────────────────────────────── */

  function drawGround() {
    var g = geom, sc = scale(), pos = core.save.player.pos;
    gCtx.clearRect(0, 0, g.GW, g.GH);
    gCtx.fillStyle = '#12141a';
    gCtx.fillRect(0, 0, g.GW, g.GH);

    var camX = pos.x - g.ox / sc;      // 지면 좌상단이 가리키는 월드 좌표
    var camY = pos.y - g.oy / sc;

    /* 지도 타일 — 타일 자체는 늘 원래 zoom(ZOOM)레벨로 받아 둔다(다시 받아올
       필요가 없게). camZoom2d 는 그리는 크기만 늘이거나 줄인다 */
    if (tilesUsable()) {
      var cz = camZoom2d(), dTile = TILE_PX * cz;
      var ll = worldToLatLng(camX, camY);
      var px = latLngToPixel(ll.lat, ll.lng);
      var t0x = Math.floor(px.x / TILE_PX), t0y = Math.floor(px.y / TILE_PX);
      var cols = Math.ceil(g.GW / dTile) + 2, rows = Math.ceil(g.GH / dTile) + 2;
      for (var ty = 0; ty < rows; ty++) {
        for (var tx = 0; tx < cols; tx++) {
          var TX = t0x + tx, TY = t0y + ty;
          var img = getTile(TX, TY, ZOOM);
          var dx = (TX * TILE_PX - px.x) * cz, dy = (TY * TILE_PX - px.y) * cz;
          if (img.ready) { gCtx.drawImage(img, dx, dy, dTile, dTile); }
          else { gCtx.fillStyle = '#1a1d24'; gCtx.fillRect(dx, dy, dTile, dTile); }
        }
      }
    } else {
      drawFallback(gCtx, camX, camY, g.GW, g.GH, sc);
    }

    /* 구역 경계선 — 지도에 결을 주는 옅은 격자 (소유 개념은 없다) */
    var r0x = Math.floor(camX / REGION_SIZE), r1x = Math.ceil((camX + g.GW / sc) / REGION_SIZE);
    var r0y = Math.floor(camY / REGION_SIZE), r1y = Math.ceil((camY + g.GH / sc) / REGION_SIZE);
    for (var ry = r0y; ry <= r1y; ry++) {
      for (var rx = r0x; rx <= r1x; rx++) {
        var bx = (rx * REGION_SIZE - camX) * sc, by = (ry * REGION_SIZE - camY) * sc;
        var bs = REGION_SIZE * sc;
        gCtx.strokeStyle = 'rgba(255,255,255,0.05)';
        gCtx.lineWidth = 1;
        gCtx.strokeRect(bx, by, bs, bs);
      }
    }

    /* 발자국 */
    var fnow = Date.now();
    for (var f = 0; f < footprints.length; f++) {
      var fp = footprints[f];
      var life = 1 - (fnow - fp.at) / FOOT_LIFE;
      if (life <= 0) { continue; }
      var fx = (fp.x - camX) * sc, fy = (fp.y - camY) * sc;
      gCtx.beginPath();
      gCtx.ellipse(fx, fy, 4.4 * sc, 7 * sc, 0, 0, Math.PI * 2);
      gCtx.fillStyle = 'rgba(150,220,255,' + (life * 0.5) + ')';
      gCtx.fill();
      gCtx.beginPath();
      gCtx.ellipse(fx, fy, 4.4 * sc, 7 * sc, 0, 0, Math.PI * 2);
      gCtx.strokeStyle = 'rgba(40,60,80,' + (life * 0.35) + ')';
      gCtx.lineWidth = 1;
      gCtx.stroke();
    }

    /* 클릭(탭)한 자리 — 커지며 옅어지는 고리 + 중심 점 */
    for (var m = 0; m < clickMarks.length; m++) {
      var cm = clickMarks[m];
      var clife = 1 - (fnow - cm.at) / CLICK_MARK_LIFE;
      if (clife <= 0) { continue; }
      var mx = (cm.x - camX) * sc, my = (cm.y - camY) * sc;
      var rad = (4 + (1 - clife) * 16) * sc;
      gCtx.beginPath();
      gCtx.arc(mx, my, rad, 0, Math.PI * 2);
      gCtx.strokeStyle = 'rgba(255,214,80,' + (clife * 0.9) + ')';
      gCtx.lineWidth = 2;
      gCtx.stroke();
      gCtx.beginPath();
      gCtx.arc(mx, my, 2.5 * sc, 0, Math.PI * 2);
      gCtx.fillStyle = 'rgba(255,214,80,' + clife + ')';
      gCtx.fill();
    }

    /* 조우 반경 — 눕은 지면 위에 있으므로 자연스럽게 타원으로 보인다 */
    gCtx.beginPath();
    gCtx.arc(g.ox, g.oy, ENCOUNTER_RANGE * sc, 0, Math.PI * 2);
    gCtx.fillStyle = 'rgba(90,200,255,0.09)';
    gCtx.fill();
    gCtx.strokeStyle = 'rgba(120,220,255,0.5)';
    gCtx.lineWidth = 2;
    gCtx.stroke();
  }

  /* ── 역참(驛站) — 원작의 보급 거점 ─────────────
   * 구역마다 둘. 좌표 해시라 **같은 땅은 늘 같은 자리**다.
   * 스폰과 달리 사라지지도 배회하지도 않는다 — 들르면 보급을 주고 쉰다(station.js).
   *
   * 여기 있던 던전 입구는 지웠다. 던전은 딴 게임(saga-dungeon)이 맡고,
   * "지도에 던전 입구를 노출하지 않는다"는 지시도 그대로다. 부르는 곳도 없었다.
   *
   * 주의 — 이 판의 `core.hash2` 는 **0~0.5 만** 돌려준다(마지막 xor 가 부호 있는 `>>`).
   * 지형 문턱값이 그 좁은 범위에 맞춰져 있어 고치지 않기로 한 값이므로,
   * 자리를 고를 때는 여기서 두 배로 펴서 쓴다. 그냥 쓰면 역참이 구역의
   * 왼쪽 위 사분면에만 몰린다.
   */

  function h01(a, b) { return Math.min(0.999999, core.hash2(a, b) * 2); }

  var STATIONS_PER_REGION = 2;
  /* 지도 위 이름표라 짧게 — 한자를 병기하면 구역 이름과 엉켜 읽히지 않는다 */
  var STATION_SIDE = ['동역', '서역'];

  function stationsIn(rx, ry) {
    var out = [];
    for (var i = 0; i < STATIONS_PER_REGION; i++) {
      var hx = h01(rx * 71 + i * 13 + 3, ry * 37 + i * 29 + 5);
      var hy = h01(rx * 53 + i * 17 + 11, ry * 97 + i * 7 + 2);
      out.push({
        key: rx + ',' + ry + '#' + i,
        x: (rx + 0.12 + hx * 0.76) * REGION_SIZE,
        y: (ry + 0.12 + hy * 0.76) * REGION_SIZE,
        name: regionName(rx + ',' + ry) + ' ' + STATION_SIDE[i]
      });
    }
    return out;
  }

  /** 지금 위치 둘레(3×3 구역)의 역참 — 가까운 것부터 */
  function stationsNear() {
    var pos = core.save.player.pos;
    var rx = Math.floor(pos.x / REGION_SIZE), ry = Math.floor(pos.y / REGION_SIZE);
    var out = [];
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        var list = stationsIn(rx + dx, ry + dy);
        for (var i = 0; i < list.length; i++) {
          var d = Math.hypot(list[i].x - pos.x, list[i].y - pos.y);
          if (d <= SPAWN_RADIUS * 1.6) { list[i].dist = d; out.push(list[i]); }
        }
      }
    }
    out.sort(function (a, b) { return a.dist - b.dist; });
    return out;
  }

  function nearestStation() {
    var list = stationsNear();
    if (!list.length) { return null; }
    return { station: list[0], dist: list[0].dist, inRange: list[0].dist <= ENCOUNTER_RANGE };
  }

  /* ── 성채(城砦) — 원작의 체육관 ───────────────
   * 역참보다 훨씬 드물다(구역의 약 4할에 하나). 원작에서도 체육관은
   * 보급 거점보다 성기게 서 있고, 그래서 하나가 사건이 된다.
   * 지키는 세력과 수비대는 fort.js 가 성채 키에서 뽑는다(늘 같은 성채).
   */

  var FORT_CHANCE = 0.4;

  function fortAt(rx, ry) {
    if (h01(rx * 131 + 17, ry * 197 + 23) > FORT_CHANCE) { return null; }
    var hx = h01(rx * 89 + 41, ry * 149 + 7);
    var hy = h01(rx * 173 + 13, ry * 61 + 29);
    return {
      key: 'F' + rx + ',' + ry,
      rx: rx, ry: ry,
      x: (rx + 0.18 + hx * 0.64) * REGION_SIZE,
      y: (ry + 0.18 + hy * 0.64) * REGION_SIZE,
      name: regionName(rx + ',' + ry) + ' 성채'
    };
  }

  /** 지금 위치 둘레(3×3 구역)의 성채 — 가까운 것부터 */
  function fortsNear() {
    var pos = core.save.player.pos;
    var rx = Math.floor(pos.x / REGION_SIZE), ry = Math.floor(pos.y / REGION_SIZE);
    var out = [];
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        var f = fortAt(rx + dx, ry + dy);
        if (!f) { continue; }
        var d = Math.hypot(f.x - pos.x, f.y - pos.y);
        if (d <= SPAWN_RADIUS * 1.6) { f.dist = d; out.push(f); }
      }
    }
    out.sort(function (a, b) { return a.dist - b.dist; });
    return out;
  }

  function nearestFort() {
    var list = fortsNear();
    if (!list.length) { return null; }
    return { fort: list[0], dist: list[0].dist, inRange: list[0].dist <= ENCOUNTER_RANGE };
  }

  /* ── 오브젝트(빌보드) ─────────────────────────────────── */

  function drawObjects() {
    var g = geom, sc = scale(), pos = core.save.player.pos, now = Date.now();
    ctx.clearRect(0, 0, g.W, g.H);

    var items = [];

    // 구역 이름표 — 옛 지명 (지도의 맛)
    var camX = pos.x - g.ox / sc, camY = pos.y - g.oy / sc;
    var r0x = Math.floor(camX / REGION_SIZE), r1x = Math.ceil((camX + g.GW / sc) / REGION_SIZE);
    var r0y = Math.floor(camY / REGION_SIZE), r1y = Math.ceil((camY + g.GH / sc) / REGION_SIZE);
    for (var ry = r0y; ry <= r1y; ry++) {
      for (var rx = r0x; rx <= r1x; rx++) {
        (function (rx, ry) {
          var key = rx + ',' + ry;
          var u = ((rx + 0.5) * REGION_SIZE - pos.x) * sc;
          var v = (ry * REGION_SIZE + 26 - pos.y) * sc;
          items.push({ v: v, draw: function () {
            var p = project(u, v);
            if (p.s < 0.3 || p.y < -30 || p.y > g.H + 30) { return; }
            label(ctx, regionName(key), p.x, p.y, 'rgba(255,255,255,0.28)', 'center', p.s);
          } });
        })(rx, ry);
      }
    }

    // 역참 — 스폰보다 먼저 담아도 v 정렬이 앞뒤를 잡아 준다
    var sts = stationsNear();
    for (var si = 0; si < sts.length; si++) {
      (function (st) {
        var u = (st.x - pos.x) * sc, v = (st.y - pos.y) * sc;
        items.push({ v: v, draw: function () { drawStation(st, u, v, now, pos); } });
      })(sts[si]);
    }

    // 성채
    var fts = fortsNear();
    for (var fi = 0; fi < fts.length; fi++) {
      (function (ft) {
        var u = (ft.x - pos.x) * sc, v = (ft.y - pos.y) * sc;
        items.push({ v: v, draw: function () { drawFort(ft, u, v, now, pos); } });
      })(fts[fi]);
    }

    // 지역 랜드마크 (biome.js, §5 ⑩) — 2D 에선 탑 그림 + 이름
    var BMd = global.DG.biome;
    var lms = BMd && BMd.on() ? BMd.landmarks(pos.x, pos.y, 700) : [];
    for (var li = 0; li < lms.length; li++) {
      (function (lm) {
        var u = (lm.x - pos.x) * sc, v = (lm.y - pos.y) * sc;
        items.push({ v: v, draw: function () { drawLandmark(lm, u, v); } });
      })(lms[li]);
    }

    // 주민 (npc.js) — 스폰보다 먼저 담아도 v 정렬이 앞뒤를 잡아 준다
    var NP = global.DG.npc;
    var ppl = NP ? NP.live(pos) : [];
    if (global.DG.folk) { ppl = ppl.concat(global.DG.folk.live(pos)); }   // ⑱ 탑 둘레 세 시대 사람
    if (global.DG.story) { ppl = ppl.concat(global.DG.story.live(pos)); }  // ⑲-12 이야기 인물 셋
    for (var pi = 0; pi < ppl.length; pi++) {
      (function (n) {
        var u = (n.x - pos.x) * sc, v = (n.y - pos.y) * sc;
        items.push({ v: v, draw: function () { drawNpc(n, u, v, now); } });
      })(ppl[pi]);
    }

    // 짐승 (animal.js)
    var AN = global.DG.animal;
    var bts = AN ? AN.live(pos) : [];
    for (var bi2 = 0; bi2 < bts.length; bi2++) {
      (function (bt) {
        var u = (bt.x - pos.x) * sc, v = (bt.y - pos.y) * sc;
        items.push({ v: v, draw: function () { drawBeast(bt, u, v, now); } });
      })(bts[bi2]);
    }

    // 들판 적 무리 (field-combat.js, §5 ⑨)
    var FCw = global.DG.fieldCombat;
    var fcs = FCw ? FCw.live() : [];
    for (var fci = 0; fci < fcs.length; fci++) {
      (function (fo) {
        if (fo.dead) { return; }
        var u = (fo.x - pos.x) * sc, v = (fo.y - pos.y) * sc;
        items.push({ v: v, draw: function () { drawFieldFoe(fo, u, v, now); } });
      })(fcs[fci]);
    }

    // 스폰
    for (var i = 0; i < spawns.length; i++) {
      (function (s) {
        var u = (s.x - pos.x) * sc, v = (s.y - pos.y) * sc;
        items.push({ v: v, draw: function () { drawSpawn(s, u, v, now, pos); } });
      })(spawns[i]);
    }

    // 플레이어
    items.push({ v: 0, draw: function () { drawPlayer(now, sc); } });

    // 먼 것부터 그려야 겹침이 자연스럽다
    items.sort(function (a, b) { return a.v - b.v; });
    for (var k = 0; k < items.length; k++) { items[k].draw(); }
  }

  /**
   * 성채 한 채. 지키는 세력의 색으로 깃발이 선다 —
   * 내 것이 되면 그 색이 금빛으로 바뀐다(원작에서 체육관이 우리 팀 색으로 도는 그 신호).
   */
  function drawFort(ft, u, v, now, pos) {
    var p = project(u, v);
    if (p.s < 0.25 || p.y < -110 || p.y > geom.H + 110) { return; }
    var z = core.clamp(p.s, 0.5, 1.6);
    var near = Math.hypot(ft.x - pos.x, ft.y - pos.y) <= ENCOUNTER_RANGE;
    var F = global.DG.fort;
    var info = F ? F.infoOf(ft) : null;
    var mine = info && info.mine;
    var color = mine ? '#e8c15a' : (info ? info.faction.color : '#8a8f9a');

    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 22 * z, 9 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = (near ? 3.2 : 2) * z;
    ctx.stroke();
    if (near) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 30 * z, 12 * z, 0, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.24 + Math.abs(Math.sin(now / 460)) * 0.3;
      ctx.lineWidth = 1.6 * z;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    /* 등급(tier)마다 다른 실제 탑 그림 — 2026-09-11 배치 굽기에서 처음엔
       t3(웅진)만 못 구웠다가, 같은 날 이어서 재시도 끝에 마저 구웠다 */
    var sp = global.DG.sprite;
    var fortTier = info && info.tier && info.tier.tier;
    var fortImg = fortTier === 1 ? sp.buildingImg('Watchtower')
      : fortTier === 2 ? sp.buildingImg('Tower')
      : fortTier === 3 ? sp.buildingImg('tower_round')
      : null;
    sp.building(ctx, {
      x: p.x, y: p.y, s: z * 1.15, form: 'wall', color: mine ? '#7a6234' : undefined,
      t: now / 1000, img: fortImg, kind2d: fortTier ? 'fort:t' + fortTier : 'fort'
    });

    /* 깃발 — 지키는 세력의 표식 */
    var fx = p.x, fy = p.y - 44 * z;
    ctx.strokeStyle = 'rgba(230,230,236,0.7)';
    ctx.lineWidth = 1.4 * z;
    ctx.beginPath();
    ctx.moveTo(fx, fy + 16 * z); ctx.lineTo(fx, fy - 8 * z);
    ctx.stroke();
    var wav = Math.sin(now / 380) * 1.8 * z;
    ctx.beginPath();
    ctx.moveTo(fx, fy - 8 * z);
    ctx.lineTo(fx + 15 * z + wav, fy - 4 * z);
    ctx.lineTo(fx, fy + 1 * z);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (info) {
      ctx.font = 'bold ' + (7.5 * z) + 'px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(mine ? '我' : info.faction.mark, fx + 7 * z, fy - 1.5 * z);
      ctx.textAlign = 'left';
    }

    /* 적장이 들었으면 그것이 먼저 보여야 한다 (원작 레이드 알·보스 표시) */
    var raid = global.DG.raid ? global.DG.raid.current(ft) : null;
    if (raid) {
      ctx.font = 'bold ' + (15 * z) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff9a5a';
      ctx.fillText('⚔️', p.x, p.y - 62 * z + Math.sin(now / 380) * 2 * z);
      ctx.textAlign = 'left';
      label(ctx, raid.tier.name + ' · ' + raid.hero.name, p.x, p.y + 15 * z,
        'rgba(255,154,90,0.95)', 'center', z);
      return;
    }

    label(ctx, ft.name + (mine ? ' · 내 것' : ''), p.x, p.y + 15 * z,
      mine ? 'rgba(232,193,90,0.8)' : 'rgba(255,255,255,0.42)', 'center', z);
  }

  /**
   * 역참 한 채. 쉬는 중이면 낮처럼 흐리고, 채워지면 불이 들어온다
   * (원작에서 보급 거점이 보라색으로 가라앉았다가 파랗게 돌아오는 그 신호다).
   */
  function drawStation(st, u, v, now, pos) {
    var p = project(u, v);
    if (p.s < 0.25 || p.y < -80 || p.y > geom.H + 80) { return; }
    var z = core.clamp(p.s, 0.5, 1.6);
    var dist = Math.hypot(st.x - pos.x, st.y - pos.y);
    var near = dist <= ENCOUNTER_RANGE;
    var stn = global.DG.station;
    /* 적도에게 점거된 역참 — 등롱이 꺼지고 검은 깃발이 선다(rogue.js).
       `rankAt` 은 해시만 보는 값싼 문이다. 프레임마다 도감을 훑지 않는다 */
    var R = global.DG.rogue;
    var held = R ? R.rankAt(st) : null;
    var ready = !held && (stn ? stn.stateOf(st.key).ready : true);

    // 발밑 고리 — 채워졌으면 금빛, 점거되었으면 핏빛, 쉬는 중이면 재빛
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 17 * z, 7 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fill();
    ctx.strokeStyle = held ? '#c0463c' : (ready ? '#e8c15a' : 'rgba(150,155,165,0.55)');
    ctx.lineWidth = (near ? 2.8 : 1.6) * z;
    ctx.stroke();
    if (near && (ready || held)) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 24 * z, 10 * z, 0, 0, Math.PI * 2);
      var puls = 0.20 + Math.abs(Math.sin(now / (held ? 300 : 420))) * 0.26;
      ctx.strokeStyle = held
        ? 'rgba(192,70,60,' + puls + ')'
        : 'rgba(232,193,90,' + puls + ')';
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();
    }

    ctx.globalAlpha = held ? 0.72 : (ready ? 1 : 0.55);
    global.DG.sprite.building(ctx, {
      x: p.x, y: p.y, s: z * 0.88, form: 'stable', t: now / 1000,
      kind2d: 'station', img: global.DG.sprite.buildingImg('tower_ruin')     // 3D 역참과 같은 실사 폐허 탑을 구운 그림(tools/bake-icons, 2026-09-23 — 전엔 굽기가 멎어 옛 여관 그림)
    });

    // 채워진 역참에는 등롱 하나, 점거된 역참에는 검은 깃발 — 멀리서도 눈에 든다
    if (ready || held) {
      var bob = Math.sin(now / (held ? 380 : 520)) * 1.6 * z;
      ctx.font = (14 * z) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(held ? '🏴' : '🏮', p.x, p.y - 46 * z + bob);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;

    label(ctx, held ? (st.name + ' · ' + held.name) : st.name, p.x, p.y + 13 * z,
      held ? 'rgba(240,160,150,0.86)' : (ready ? 'rgba(240,225,180,0.72)' : 'rgba(255,255,255,0.30)'),
      'center', z);
  }

  function drawSpawn(s, u, v, now, pos) {
    var p = project(u, v);
    if (p.s < 0.25 || p.y < -80 || p.y > geom.H + 80) { return; }
    var z = core.clamp(p.s, 0.5, 1.6);
    var age = (now - s.bornAt) / SPAWN_LIFE;
    var near = Math.hypot(s.x - pos.x, s.y - pos.y) <= ENCOUNTER_RANGE;
    var sp = global.DG.sprite;
    var isHero = s.kind === 'hero';
    var scale = z * (isHero ? 1.15 : 1.35);      // 짐승은 기준 키가 작아 더 키운다
    var bodyH = (isHero ? 40 : 30) * scale;

    ctx.globalAlpha = age > 0.85 ? core.clamp(1 - (age - 0.85) / 0.15, 0.15, 1) : 1;

    // 발밑 등급 고리
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 15 * z, 6 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = near ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.34)';
    ctx.fill();
    ctx.strokeStyle = data.rarity[s.ref.rarity].color;
    ctx.lineWidth = (near ? 2.8 : 1.6) * z;
    ctx.stroke();
    if (near) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 22 * z, 9 * z, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.18 + Math.abs(Math.sin(now / 420)) * 0.22) + ')';
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.ellipse(p.x, p.y - bodyH * 0.45, bodyH * 0.34, bodyH * 0.52, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();

    if (!(isHero && global.DG.actor2d && global.DG.actor2d.human(ctx, s.ref, null, p.x, p.y, scale, { facing: s.facing, moving: s.moving, phase: s.phase, now: now }))) sp.stamp(ctx, {
      kind: isHero ? 'human' : 'beast', ref: s.ref,
      x: p.x, y: p.y, s: scale, facing: s.facing, phase: s.phase, walking: s.moving,
      color: isHero ? data.faction(s.ref.faction).color : sp.beastColorOf(s.ref),
      look: isHero ? sp.lookOf(s.ref) : null,
      form: isHero ? null : sp.beastFormOf(s.ref),
      divine: !isHero && s.ref.kind === 'divine',
      t: now
    });

    if (p.s > 0.45) {
      ctx.textAlign = 'center';
      ctx.font = '600 ' + Math.round(11 * z) + 'px system-ui, sans-serif';
      var ny = p.y - bodyH * 1.12 - 6 * z;
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillText(s.ref.name, p.x + 1, ny + 1);
      ctx.fillStyle = near ? '#fff' : 'rgba(255,255,255,0.78)';
      ctx.fillText(s.ref.name, p.x, ny);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
  }

  /**
   * 주민 한 사람. **스폰과 눈에 띄게 달라야 한다** — 잡거나 설득할 대상이 아니라
   * 그냥 여기 사는 사람이다. 그래서 발밑 등급 고리를 안 두르고(그림자만 둔다)
   * 이름표도 흐리게 단다. 가까이 가면 이름이 또렷해진다(말이 걸리는 거리다).
   */
  function drawNpc(n, u, v, now) {
    var p = project(u, v);
    if (p.s < 0.25 || p.y < -80 || p.y > geom.H + 80) { return; }
    var z = core.clamp(p.s, 0.5, 1.6);
    var sp = global.DG.sprite;
    var talkR = core.tuned('npc.talkRadius', 14);
    var near = n.dist <= talkR;
    var bodyH = 40 * z * 1.05;

    // 발밑 그림자 (등급 고리는 없다)
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 11 * z, 4.5 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fill();

    if (!(global.DG.actor2d && global.DG.actor2d.human(ctx, n.p, null, p.x, p.y, z * 1.05, { facing: n.x < 0 ? -1 : 1, moving: n.walking, phase: n.phase, now: now }))) sp.stamp(ctx, {
      kind: 'human', ref: n.p,
      x: p.x, y: p.y, s: z * 1.05, facing: n.x < 0 ? -1 : 1,
      phase: n.phase, walking: n.walking,
      /* 옷 색은 계절을 탄다 — 겨울에는 짙고 두껍다 (`season.js`) */
      color: (global.DG.season ? global.DG.season.cloth(n.p.color || '#6b6f78')
                               : (n.p.color || '#6b6f78')),
      look: sp.lookOf(n.p),
      t: now
    });

    if (p.s > 0.45) {
      ctx.textAlign = 'center';
      ctx.font = '600 ' + Math.round(10 * z) + 'px system-ui, sans-serif';
      var ny = p.y - bodyH * 1.10 - 5 * z;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(n.p.name, p.x + 1, ny + 1);
      ctx.fillStyle = near ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.42)';
      ctx.fillText(n.p.name, p.x, ny);
      ctx.textAlign = 'left';
    }
  }

  /**
   * 들·강의 짐승 한 마리. **스폰과 눈에 띄게 달라야 한다** — 잡는 대상이 아니라
   * 그냥 거기 사는 것이다. 등급 고리도 이름표도 없이 그림자와 몸뚱이만 있다.
   * 날아오른 새는 위로 옮겨 그리고 그림자를 줄인다(2D 에서 높이를 읽는 유일한 단서다).
   */
  function drawLandmark(lm, u, v) {
    var p = project(u, v);
    if (p.s < 0.2 || p.y < -160 || p.y > geom.H + 80) { return; }
    var z = core.clamp(p.s, 0.5, 1.8), BMd = global.DG.biome;
    global.DG.sprite.building(ctx, { img: global.DG.sprite.buildingImg('Watchtower'), x: p.x, y: p.y, s: z * 2.2, kind2d: 'landmark:' + lm.biome });
    label(ctx, (BMd.found(lm.key) ? '🌀 ' : '🗼 ') + lm.name, p.x, p.y - 46 * z * 2.2 * 1.3 - 6,
      BMd.BIOMES[lm.biome].color, 'center', z);
  }

  /** 들판 적 — 도감 펫 그림을 빌리고 원소 빛깔 고리를 발밑에 두른다 */
  function drawFieldFoe(fo, u, v, now) {
    var p = project(u, v);
    if (p.s < 0.25 || p.y < -80 || p.y > geom.H + 80) { return; }
    var z = core.clamp(p.s, 0.5, 1.6);
    var sp = global.DG.sprite, EL = global.DG.fieldCombat.EL;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 12 * z * fo.h, 5 * z * fo.h, 0, 0, Math.PI * 2);
    ctx.strokeStyle = fo.el ? EL[fo.el].color : '#d9534f';
    ctx.lineWidth = 2;
    ctx.stroke();
    sp.stamp(ctx, {
      kind: 'beast', ref: fo.ref,
      x: p.x, y: p.y, s: z * 1.25 * fo.h, facing: 1, phase: fo.phase, walking: fo.moving,
      color: sp.beastColorOf(fo.ref), form: sp.beastFormOf(fo.ref), t: now
    });
  }

  function drawBeast(bt, u, v, now) {
    var p = project(u, v);
    if (p.s < 0.25 || p.y < -80 || p.y > geom.H + 80) { return; }
    var z = core.clamp(p.s, 0.5, 1.6);
    var sp = global.DG.sprite;
    var K = bt.kind;
    var lift = (bt.lift || 0) * z * 1.6;          // m → 화면 픽셀 (눈대중)

    // 발밑 그림자 — 뜰수록 작고 흐려진다
    var far = K.lift ? Math.max(0.25, 1 - (bt.lift || 0) / 12) : 1;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 10 * z * far, 4 * z * far, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,' + (0.30 * far).toFixed(2) + ')';
    ctx.fill();

    /* 물속 짐승은 흐리게 — 수면 아래에 있다는 것을 색으로 말한다 */
    ctx.globalAlpha = (K.sink ? 0.62 : 1);
    sp.stamp(ctx, {
      kind: 'beast', ref: global.DG.animal.refOf(K),
      x: p.x, y: p.y - lift, s: z * 1.25 * K.h,
      facing: Math.sin(bt.ang) < 0 ? -1 : 1,
      phase: bt.phase, walking: bt.moving,
      color: K.color, form: K.form, t: now
    });
    ctx.globalAlpha = 1;
  }

  function drawPlayer(now, sc) {
    var X = geom.cx, Y = geom.cy;
    var sp = global.DG.sprite;
    var moving = player.speed > 1.5;
    var lead = core.save.party && core.save.party[0] ? data.find(core.save.party[0]) : null;

    // GPS 오차 범위
    if (mode === 'geo' && geoAccuracy) {
      var rr = Math.min(geoAccuracy * sc, 150);
      ctx.beginPath();
      ctx.ellipse(X, Y, rr, rr * (geom.tilt ? geom.cos : 1), 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(74,163,240,0.10)';
      ctx.fill();
    }

    // 진행 방향 화살표
    if (moving) {
      var ang = Math.atan2(player.vy * (geom.tilt ? geom.cos : 1), player.vx);
      ctx.save();
      ctx.translate(X, Y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(36, 0); ctx.lineTo(22, -8); ctx.lineTo(22, 8);
      ctx.closePath();
      ctx.fillStyle = 'rgba(120,200,255,0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(10,20,30,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 발밑 고리
    var pulse = 1 + Math.sin(now / 500) * 0.07;
    ctx.beginPath();
    ctx.ellipse(X, Y, 17 * pulse, 8 * pulse, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(74,163,240,0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,200,255,0.75)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (!(global.DG.actor2d && global.DG.actor2d.human(ctx, lead, 'player', X, Y, geom.mode === 2 ? 1.5 : 1.25, { facing: player.facing, moving: moving, phase: player.phase, now: now }))) sp.stamp(ctx, {
      kind: 'human', ref: lead, key: lead ? null : 'player',
      // 3D 는 카메라가 낮아 캐릭터를 조금 더 크게 (원작 느낌)
      x: X, y: Y, s: geom.mode === 2 ? 1.5 : 1.25,
      facing: player.facing, phase: player.phase, walking: moving,
      color: lead ? data.faction(lead.faction).color : '#3f6f9f',
      look: lead ? sp.lookOf(lead) : { weapon: 'sword', helm: 'gat', armor: 'robe', cape: true },
      t: now
    });
  }

  function label(ctx, text, x, y, color, align, z) {
    z = core.clamp(z || 1, 0.6, 1.3);
    ctx.textAlign = align || 'left';
    ctx.font = '600 ' + Math.round(12 * z) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  }

  global.DG = global.DG || {};
  global.DG.world = {
    REGION_SIZE: REGION_SIZE, ENCOUNTER_RANGE: ENCOUNTER_RANGE,
    init: function (objEl, groundEl) { initCanvas(objEl, groundEl); bindKeys(); tickSpawns(); },
    update: function (dt) { moveByKeys(dt); updatePlayerMotion(dt); wanderSpawns(dt); tickSpawns(); },
    draw: draw, resize: resize,
    get spawns() { return spawns; },
    removeSpawn: removeSpawn,
    nearest: nearest, maxSpawns: maxSpawns, spawnSpecial: spawnSpecial,
    currentRegionKey: currentRegionKey,
    regionName: regionName,
    stationsIn: stationsIn, stationsNear: stationsNear, nearestStation: nearestStation,
    fortAt: fortAt, fortsNear: fortsNear, nearestFort: nearestFort,
    terrainAt: terrainAt,
    roadIsVertical: roadIsVertical,
    /* 3D 렌더러(world3d.js)가 지면을 스스로 깔 수 있게 내보낸다 */
    ZOOM: ZOOM, TILE_PX: TILE_PX, TERRAIN: TERRAIN,
    metersPerPixel: metersPerPixel, scale: scale,
    getTile: getTile, tileUrl: tileUrl, tilesUsable: tilesUsable,
    latLngToPixel: latLngToPixel, worldToLatLng: worldToLatLng,
    /* `geo.js`(실제 지형)가 Overpass 응답을 세계 좌표로 바꿀 때 쓴다 —
       2026-09-05, 여태 여기 빠져 있어 실제 fetch가 매번 "toWorld is not a
       function"으로 조용히 실패하고 있었다(HTTP는 200이었는데도) */
    latLngToWorld: latLngToWorld,
    useKeyboard: useKeyboard, useGeo: useGeo,
    setStick: setStick, walkTo: walkTo, moveSpeed: moveSpeed, walkingTo: walkingTo, inputBlocked: inputBlocked, camRot: camRot,
    /** 2026-09-27 Q3 — (x, y) 가 벽(집 몸통 + 몸 반지름) 안인가. 진단·확인용 */
    wallAt: function (x, y) { return hitsHouse(x, y, solidRectsNear(x, y)); },
    keymap: keymap, beginRemap: beginRemap, remapping: function () { return remapping; },
    get mode() { return mode; },
    get accuracy() { return geoAccuracy; },
    get origin() { return origin; },
    setOrigin: function (lat, lng) {
      origin.lat = lat; origin.lng = lng; tiles = {}; spawns = [];
      core.save.player.pos.x = 0; core.save.player.pos.y = 0;
    },
    get speedMul() { return speedMul(); },
    get baseSpeed() { return speed; },
    get tilt() { return tiltOn(); },
    get tiltMode() { return tiltMode(); },
    /** 지금 실제로 화면을 그리는 게 WebGL 3D 렌더러인가 — 이게 켜져 있으면
        zoom3d 가 실제 카메라 배율이다(2D·2.5D·3D 어느 시점이든) */
    get render3dOn() { var W3 = global.DG.world3d; return !!(W3 && W3.active && W3.active()); },
    /** 3D 카메라 배율 — 화면 값이다(판정에는 안 닿는다) */
    get zoom3d() { return zoom3d(); },
    setZoom3d: setZoom3d, nudgeZoom: nudgeZoom,
    ZOOM3_MIN: ZOOM3_MIN, ZOOM3_MAX: ZOOM3_MAX, ZOOM3_DEFAULT: ZOOM3_DEFAULT,
    /** 2D·2.5D 카메라 배율 — 화면 값이다(판정에는 안 닿는다) */
    get camZoom2d() { return camZoom2d(); },
    setCamZoom2d: setCamZoom2d, nudgeZoom2d: nudgeZoom2d,
    ZOOM2_MIN: ZOOM2_MIN, ZOOM2_MAX: ZOOM2_MAX, ZOOM2_DEFAULT: ZOOM2_DEFAULT,
    /** 3인치 모드 — 화면을 멀리서 보는 스위치 (2D·2.5D·3D 어디서든 켠다) */
    get wide3in() { return is3inch(); },
    toggle3inch: toggle3inch,
    /** 시점 순환 — 2D → 2.5D → 3D → 2D */
    cycleTilt: function () {
      core.save.settings.tilt = (tiltMode() + 1) % 3;
      resize();
      core.persist();
      return tiltMode();
    },
    toggleTilt: function () {          // 하위 호환 (자가진단이 쓴다)
      core.save.settings.tilt = tiltOn() ? 0 : 1;
      resize();
      core.persist();
      return tiltOn();
    },
    project: project, unproject: unproject,
    get footprints() { return footprints; },
    get motion() { return player; },
    TRAIL_STEP: TRAIL_STEP, TRAIL_MAX: TRAIL_MAX,
    latLng: function () {
      var p = core.save.player.pos;
      return worldToLatLng(p.x, p.y);
    }
  };
})(window);
