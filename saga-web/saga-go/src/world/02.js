  /* ── 2D·2.5D 줌 ───────────────────────────────────────────
   * 3D 와 같은 결이다 — **화면 값이다.** scale() 에 곱해 넣으므로 지도 타일·
   * 오브젝트·판정(onClick 히트 반경)까지 한 번에 늘고 준다. 좌표·거리·
   * 조우 사거리는 그대로다.
   */
  var ZOOM2_MIN = 0.4, ZOOM2_MAX = 2.2, ZOOM2_DEFAULT = (global.DG.cam2d && global.DG.cam2d.STD.def) || 0.8;   // W-0487 ③ 공용 멀게 기본

  function camZoom2d() {
    var raw = core.save.settings ? core.save.settings.camZoom2d : undefined;
    if (raw === undefined || raw === null || raw === '') { raw = ZOOM2_DEFAULT; }
    var z = Number(raw);
    if (!isFinite(z) || z <= 0) { z = ZOOM2_DEFAULT; }
    return core.clamp(z, ZOOM2_MIN, ZOOM2_MAX) * (global.DG.field2d && global.DG.field2d.on() && core.save.settings && core.save.settings.tilt === 0 ? global.DG.field2d.zoomMul() * ((global.innerHeight || 720) < 600 ? 1 : +(global.DG.core && global.DG.core.tuned ? global.DG.core.tuned('mode2d.vwScale', ((global.DG.cfg && global.DG.cfg.mode2d) || {}).vwScale || 1) : 1) || 1) : 1);   // W-0130 — 2D 들판만 가깝게(2.5D 는 그대로)
  }
  function setCamZoom2d(z) {
    if (!core.save.settings) { return 1; }
    core.save.settings.camZoom2d = core.clamp(z, ZOOM2_MIN, ZOOM2_MAX); if (cam2) { cam2.set(core.save.settings.camZoom2d); }   // W-0365 폰·PC 따로도 기억(공용 cam2d)
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
      setZoom3d(ZOOM3_WIDE3);
      core.save.settings.wide3in = true;
    }
    core.persist();
    return is3inch();
  }

  /** 시점 모드 — 0: 2D · 1: 2.5D · 2: 3D */
  function tiltMode() {
    var t = core.save.settings ? core.save.settings.tilt : 0; if (global.DG.deviceMode && !global.DG.deviceMode.want3d('go', true)) { return 0; }   // 10-19 폰은 시점 2D 로 연다
    return t === 2 ? 2 : (t ? 1 : 0);
  }
  function tiltOn() { return tiltMode() > 0; }
  /** 2D 깊이 원근(사용자 10-29 "3마을처럼" W-0495) — 손잡이 go.depth2d = 땅을 눕히는 각도(0 = 평평한 옛 2D 그대로). 3D 는 안 켠다(settings.tilt 는 그대로 0) */
  function depth2dDeg() { var d = +core.tuned('go.depth2d', 34), W3 = global.DG.world3d; return d > 0 && global.DG.field2d && global.DG.field2d.on() && !(W3 && W3.active && W3.active()) ? d : 0; }

  function initCanvas(objEl, groundEl) {
    canvas = objEl; ctx = canvas.getContext('2d');
    gCanvas = groundEl; gCtx = gCanvas.getContext('2d');
    resize();
    global.addEventListener('resize', resize);
    if (core.on) { core.on('perf', function () { resize(); }); }   // W-0389 ③-4 — 품질 단계가 바뀌면 2D dpr 상한도 따라간다
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
    return (W3 && W3.active && W3.active()) ? nudgeZoom(mul) : nudgeZoom2d(1 / mul);   // W-0155 — mul 은 3D 거리 뜻(>1 멀리), 2D 줌은 배율(>1 가까이)이라 뒤집는다
  }

  /** 휠과 두 손가락으로 카메라를 당기고 민다 — 2D·2.5D·3D 어디서든 듣는다 */ var cam2 = null; function bindCam2() { var C2 = global.DG.cam2d, s = core.save.settings; if (!C2 || cam2) { return; } cam2 = C2.register('field', { store: 'deungyong-go/save/cam2d', min: ZOOM2_MIN, max: ZOOM2_MAX, def: ZOOM2_DEFAULT, onChange: function (v) { var s2 = core.save.settings; if (s2 && Math.abs((s2.camZoom2d || ZOOM2_DEFAULT) - v) > 0.051) { s2.camZoom2d = v; core.emit('zoom2d', v); core.persist(); } } }); if (s && (s.camZoom2d == null || s.camZoom2d === '' || (s.camZoom2d === 1 && cam2.get() !== 1))) { s.camZoom2d = cam2.get(); }   /* 10-29 새 계정 기본 1 이 공용 멀게 기본을 가렸다 — 이 기기에 저장된 줌이 따로 없으면(get 이 1 아님) 기기값·기본을 쓴다 */ var box = cam2.buttons(document.body), W3 = global.DG.world3d; if (box) { global.setInterval(function () { box.style.display = W3 && W3.active && W3.active() ? 'none' : ''; }, 500); } }   /* W-0365 공용 cam2d — 이 판의 휠·핀치·+/− 키·3인치는 그대로, 기기별 기억(세이브에 없으면 이 기기 값으로 연다)과 ＋/－ 단추(3D 때 감춤)만 더한다 */
  function bindZoom(cv) { bindCam2();
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
      turnBy(x - dx0); if (global.DG.landmark3d && tiltMode() === 2) { global.DG.landmark3d.tilt(y - dy0, geom ? geom.H : 480); }   // W-0162 세로로 끌면 멀리 보기
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
    var md = tiltMode() || (depth2dDeg() ? 3 : 0);
    if (!md) {
      return { W: W, H: H, GW: W, GH: H, ox: W / 2, oy: H / 2,
               cx: W / 2, cy: H / 2, tilt: 0, sin: 0, cos: 1, persp: PERSP, mode: 0 };
    }
    var tiltDeg = md === 3 ? depth2dDeg() : (md === 2 ? TILT3_DEG : TILT_DEG);
    var persp = md === 3 ? 1500 : (md === 2 ? PERSP3 : PERSP);
    var cy = md === 3 ? H * 0.6 : (md === 2 ? H * ANCHOR3 : H / 2);      // 플레이어가 서는 화면 세로 위치
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

  /** W-0389 ③-4 — 2D 들판(3D 비활성)의 캔버스 dpr 상한: 손잡이 perf.dpr2dLow·perf.dpr2dMed(0 = 안 묶음, 기본)(390×844@2 는 2.6M 화소라 폰 걷기의 (program) 몫이 컸다).
   *  3D 땐 HUD 글자가 흐려지니 안 묶는다. A/B 는 같은 호출 안에서만 믿는다 */
  function dprCap2d() {
    var W3 = global.DG.world3d, P = global.DG.perf, t = P && P.tier ? P.tier() : null, k = t && t.key;
    if (!k || (W3 && W3.active && W3.active())) { return 99; }
    var v = k === 'LOW' ? core.tuned('perf.dpr2dLow', 0) : (k === 'MEDIUM' ? core.tuned('perf.dpr2dMed', 0) : 0);
    return v > 0 ? v : 99;   // 0 = 안 묶음(기본 — 10-25 A/B 가 같은 날 2~3배 흔들려 판정 못 함, 손잡이로만 남김)
  }
  function resize() {
    if (!canvas) { return; }
    lastRenderMode = null;
    if (global.DG.world3d) { global.DG.world3d.resize(); }
    dpr = Math.min(global.devicePixelRatio || 1, dprCap2d());   // W-0389 ③-4 — 2D 들판은 품질 단계로 화소 수를 묶는다
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
      var sq = !pk && spawnOff && spawnOff.get(spawns[i]), d = sq ? Math.hypot(pos.x + sq.u / sc - wx, pos.y + sq.v / sc - wy) : Math.hypot(spawns[i].x - wx, spawns[i].y - wy);   // W-0408 그린 자리로 누른다
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
        if (mode === 'keyboard') { walkTo(ftHit.x, ftHit.y); core.emit('walk:meet', { ev: 'fort:request', it: ftHit }); }   // W-0174 닿으면 저절로 연다(keys.js)
        core.emit('toast', '성채가 멉니다 · ' + Math.round(fdist) + 'm · 걸어가서 닿으면 맞섭니다');
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
        if (mode === 'keyboard') { walkTo(stHit.x, stHit.y); core.emit('walk:meet', { ev: 'station:request', it: stHit }); }
        core.emit('toast', '역참이 멉니다 · ' + Math.round(sdist) + 'm · 걸어가서 닿으면 들릅니다');
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
      if (mode === 'keyboard') { walkTo(best.x, best.y); core.emit('walk:meet', { ev: 'encounter:request', it: best }); }   // 멀면 걸어가서 닿으면 만난다
      core.emit('toast', '너무 멉니다 · ' + Math.round(dist) + 'm · 걸어가서 닿으면 만납니다');
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

    drawFallback(gCtx, camX, camY, g.GW, g.GH, sc);   // W-0207 — OSM 타일 안 씀: 늘 들판(field2d)·절차 지형

    /* 구역 경계선 — 지도에 결을 주는 옅은 격자 (소유 개념은 없다) */
    var r0x = Math.floor(camX / REGION_SIZE), r1x = Math.ceil((camX + g.GW / sc) / REGION_SIZE);
    var r0y = Math.floor(camY / REGION_SIZE), r1y = Math.ceil((camY + g.GH / sc) / REGION_SIZE);
    for (var ry = r0y; ry <= r1y && !(global.DG.field2d && global.DG.field2d.on()); ry++) {   // 지도 격자는 지도일 때만
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

    var RSn = global.DG.restSite ? global.DG.restSite.sitesNear(pos.x, pos.y, 700) : []; for (var rsi = 0; rsi < RSn.length; rsi++) { (function (rs) { var u = (rs.x - pos.x) * sc, v = (rs.y - pos.y) * sc; items.push({ v: v, draw: function () { var p = project(u, v); if (p.s < 0.2 || p.y < -120 || p.y > geom.H + 80) { return; } var z = core.clamp(p.s, 0.5, 1.8) * bodyK(); global.DG.restSite.draw2d(ctx, p.x, p.y, z, rs.lit, now); label(ctx, (rs.at ? '🔥 쉼터 ✦' : '🔥 쉼터'), p.x, p.y - 44 * z, rs.lit ? '#ffcf7a' : '#c9c1b2', 'center', core.clamp(p.s, 0.5, 1.8)); } }); })(RSn[rsi]); } if (global.DG.windGuide) { global.DG.windGuide.draw2d(ctx, pos, sc, project, now, items); } if (global.DG.fieldRiddle) { global.DG.fieldRiddle.draw2d(ctx, pos, sc, project, now, items, bodyK()); }   /* W-0297 쉼터 · W-0395 ① 바람 길잡이 */   // 지역 랜드마크 (biome.js, §5 ⑩) — 2D 에선 탑 그림 + 이름
    var BMd = global.DG.biome;
    var lms = BMd && BMd.on() ? BMd.landmarks(pos.x, pos.y, 700) : [];
    for (var li = 0; li < lms.length; li++) {
      (function (lm) {
        var u = (lm.x - pos.x) * sc, v = (lm.y - pos.y) * sc;
        items.push({ v: v, draw: function () { drawLandmark(lm, u, v); } });
      })(lms[li]);
    }

    var TPs = global.DG.field2d && global.DG.field2d.tall && global.DG.field2d.on() && !(global.DG.world3d && global.DG.world3d.active && global.DG.world3d.active()) ? global.DG.field2d.tall() : []; for (var tpi = 0; tpi < TPs.length; tpi++) { (function (t) { var u = (t.wx - pos.x) * sc, v = (t.wy - pos.y) * sc; items.push({ v: v, draw: function () { var p = project(u, v); if (p.y > -200 && p.y < geom.H + 300) { global.DG.mode2d.drawSprite(ctx, { id: t.id, x: p.x, y: p.y, h: t.k * 48 * sc * p.s, shadow: !t.sb }); } } }); })(TPs[tpi]); } var FEs = global.DG.fieldEnv ? global.DG.fieldEnv.fires() : []; for (var fei = 0; fei < FEs.length; fei++) { (function (c) { var u = ((c.tx + 0.5) * 48 - pos.x) * sc, v = ((c.ty + 0.6) * 48 - pos.y) * sc; items.push({ v: v, draw: function () { var p = project(u, v); global.DG.fieldEnv.draw2d(ctx, p.x, p.y, 48 * sc * p.s, c, now); } }); })(FEs[fei]); }   /* W-0372 나무 — 발 y 로 인물과 함께 정렬 · W-0374 불길 칸 */   // 주민 (npc.js) — 스폰보다 먼저 담아도 v 정렬이 앞뒤를 잡아 준다
    var NP = global.DG.npc;
    var ppl = NP ? NP.live(pos) : [];
    if (global.DG.folk) { ppl = ppl.concat(global.DG.folk.live(pos)); }   // ⑱ 탑 둘레 세 시대 사람
    if (global.DG.story) { ppl = ppl.concat(global.DG.story.live(pos)); }  // ⑲-12 이야기 인물 셋
    var sf2 = +core.tuned('go.spreadFoe', 1) === 1 && !(global.DG.world3d && global.DG.world3d.active && global.DG.world3d.active()), idleF = sf2 && global.DG.fieldCombat ? global.DG.fieldCombat.live().filter(function (f) { return !f.dead && f.st === 'idle'; }) : [], uvsA = spreadUV(sf2 ? ppl.concat(spawns, idleF) : ppl, pos, sc, ppl.length + spawns.length), uvs = uvsA.slice(0, ppl.length); spawnOff = null; if (sf2) { spawnOff = new Map(); for (var soi = 0; soi < spawns.length + idleF.length; soi++) { spawnOff.set(soi < spawns.length ? spawns[soi] : idleF[soi - spawns.length], uvsA[ppl.length + soi]); } }   /* W-0408 들판 대상도 사람과 같은 벌림 — 촌장 위에 짐승이 겹쳐 서던 것(그리기 자리만, 누르기는 그린 자리로) */ for (var pi = 0; pi < ppl.length; pi++) {
      (function (n, q) {
        var u = q.u, v = q.v;
        items.push({ v: v, draw: function () { drawNpc(n, u, v, now); } });
      })(ppl[pi], uvs[pi]);
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
        var q = spawnOff && spawnOff.get(fo), u = q ? q.u : (fo.x - pos.x) * sc, v = q ? q.v : (fo.y - pos.y) * sc;   // W-0408 쉬는 적은 사람과 벌린 자리
        items.push({ v: v, draw: function () { drawFieldFoe(fo, u, v, now); } });
      })(fcs[fci]);
    }

    // 스폰
    for (var i = 0; i < spawns.length; i++) {
      (function (s) {
        var q = spawnOff && spawnOff.get(s), u = q ? q.u : (s.x - pos.x) * sc, v = q ? q.v : (s.y - pos.y) * sc;
        items.push({ v: v, draw: function () { drawSpawn(s, u, v, now, pos, sc); } });
      })(spawns[i]);
    }

    // 플레이어
    items.push({ v: 0, draw: function () { drawPlayer(now, sc); } });

    // 먼 것부터 그려야 겹침이 자연스럽다
    items.sort(function (a, b) { return a.v - b.v; });
    tagQ.length = 0; for (var k = 0; k < items.length; k++) { items[k].draw(); } flushTags(); zoneFog2d(pos, sc);   // W-0417 구역 밖 안개   // W-0144 — 이름표는 몸을 다 그린 뒤 겹침을 풀어 한 번에
  }

  /** W-0417 2D 구역(go.zoneM) 밖을 안개로 — 경계 안쪽 띠에서 점점 짙어져 밖은 덮음. 시점 기울기 없을 때만(평면 2D, 폰 기본) · 손잡이 zoneCut.fog2d 1 */ function zoneFogTilt(q, W, H, col) { var c = ctx, i, w, pth = function () { c.beginPath(); c.moveTo(q[0].x, q[0].y); for (i = 1; i < 4; i++) { c.lineTo(q[i].x, q[i].y); } c.closePath(); }; c.save(); c.fillStyle = 'rgba(' + col + ',0.92)'; c.beginPath(); c.rect(0, 0, W, H); c.moveTo(q[0].x, q[0].y); for (i = 1; i < 4; i++) { c.lineTo(q[i].x, q[i].y); } c.closePath(); c.fill('evenodd'); pth(); c.clip(); c.lineJoin = 'round'; c.strokeStyle = 'rgba(' + col + ',0.26)'; [240, 150, 70].forEach(function (lw) { c.lineWidth = lw; pth(); c.stroke(); }); c.restore(); }   /* 눕힌 2D(깊이 원근) — 구역 사각형을 투영한 사다리꼴 바깥을 덮고 안쪽 띠를 세 겹으로 옅게 */ function zoneFog2d(pos, sc) { var zm = +core.tuned('go.zoneM', 576); if (!(zm > 0) || !+core.tuned('zoneCut.fog2d', 1) || (global.DG.world3d && global.DG.world3d.active && global.DG.world3d.active())) { return; } var zx = ((global.DG.goZoneIdx ? global.DG.goZoneIdx(pos, 0, zm) : Math.floor(pos.x / zm + 0.5)) - 0.5) * zm, zy = ((global.DG.goZoneIdx ? global.DG.goZoneIdx(pos, 1, zm) : Math.floor(pos.y / zm + 0.5)) - 0.5) * zm,   /* 구역 격자는 반 칸 밀림 — 출발 마을(0,0)이 구역 한가운데 */ a = project((zx - pos.x) * sc, (zy - pos.y) * sc), b = project((zx + zm - pos.x) * sc, (zy + zm - pos.y) * sc), W = geom.W, H = geom.H, band = 120, col = '200,210,218', x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y; if (geom.tilt) { if (+core.tuned('zoneCut.fogTilt', 0)) { zoneFogTilt([a, project((zx + zm - pos.x) * sc, (zy - pos.y) * sc), b, project((zx - pos.x) * sc, (zy + zm - pos.y) * sc)], W, H, col); } return; } if (x0 > 0 || y0 > 0 || x1 < W || y1 < H) { ctx.save(); ctx.fillStyle = 'rgba(' + col + ',0.92)'; if (x0 > 0) { ctx.fillRect(0, 0, Math.min(W, x0), H); } if (x1 < W) { ctx.fillRect(Math.max(0, x1), 0, W - Math.max(0, x1), H); } if (y0 > 0) { ctx.fillRect(Math.max(0, x0), 0, Math.min(W, x1) - Math.max(0, x0), Math.min(H, y0)); } if (y1 < H) { ctx.fillRect(Math.max(0, x0), Math.max(0, y1), Math.min(W, x1) - Math.max(0, x0), H - Math.max(0, y1)); } var g; if (x0 > -band) { g = ctx.createLinearGradient(x0 + band, 0, x0, 0); g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(1, 'rgba(' + col + ',0.92)'); ctx.fillStyle = g; ctx.fillRect(x0, y0, band, y1 - y0); } if (x1 < W + band) { g = ctx.createLinearGradient(x1 - band, 0, x1, 0); g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(1, 'rgba(' + col + ',0.92)'); ctx.fillStyle = g; ctx.fillRect(x1 - band, y0, band, y1 - y0); } if (y0 > -band) { g = ctx.createLinearGradient(0, y0 + band, 0, y0); g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(1, 'rgba(' + col + ',0.92)'); ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, band); } if (y1 < H + band) { g = ctx.createLinearGradient(0, y1 - band, 0, y1); g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(1, 'rgba(' + col + ',0.92)'); ctx.fillStyle = g; ctx.fillRect(x0, y1 - band, x1 - x0, band); } ctx.restore(); } }
  /* W-0144 — 이름표 겹침 풀기(순수). items [{x, y, w, h, dist, pri}] → 각 줄에 y(옮긴 자리)·oy(원래)·alpha·lead. 우선(pri 큰 것) → 가까운 것 순으로 제자리,
     겹치면 위로 h+2 씩 넷째 자리까지(W-0205, 옛 셋), 그래도 겹치면 숨김(alpha 0) — 첫째는 늘 보인다. 둘째 단 넘게 밀리면 lead(머리와 잇는 가는 선) */
  var tagQ = [];
  function layoutLabels(items) { if (global.DG.mode2d && global.DG.mode2d.labels) { return global.DG.mode2d.labels(items); }   // W-0348 공용 — 먼 이름표는 겹치면 숨김, 가까운·퀘스트 대상만 위로 쌓음
    var order = items.slice().sort(function (a, b) { return ((b.pri || 0) - (a.pri || 0)) || ((a.dist || 0) - (b.dist || 0)); }), placed = [], i, s, y;
    for (i = 0; i < order.length; i++) {
      var it = order[i], hit = function (q) { return Math.abs(q.x - it.x) * 2 < q.w + it.w && Math.abs(q.y - y) < (q.h + it.h) / 2; };
      for (s = 0, it.alpha = 0, it.oy = it.oy === undefined ? it.y : it.oy; s < 4 && !it.alpha; s++) { y = it.oy - s * (it.h + 2); if (i === 0 || !placed.some(hit)) { it.y = y; it.alpha = 1; it.lead = s >= 2; placed.push(it); } }
    }
    return items;
  }
  function flushTags() {
    ctx.textAlign = 'center';
    tagQ.forEach(function (q) { q.w = txtWidth(q.t, q.px) + 4; q.h = q.px + 5; });   // W-0205 줄 사이 여유(옛 +2 — 붙어 보였다)
    layoutLabels(tagQ).forEach(function (q) { if (!q.alpha) { return; } ctx.globalAlpha = q.ga || 1; if (q.lead) { ctx.strokeStyle = q.shade; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(q.x, q.y + 3); ctx.lineTo(q.x, q.oy - q.h * 0.7); ctx.stroke(); } txtDraw(ctx, q.t, q.px, q.fill, q.shade, q.x, q.y, 'center'); });
    ctx.textAlign = 'left'; ctx.globalAlpha = 1; tagQ.length = 0;
  }

  /* 성채·역참 한 채 그리기는 js/world-sites2d.js(R-4) — 같은 이름으로 넘긴다 */
  var spawnOff = null; var sitesObj = null; function SI() { return sitesObj || (sitesObj = global.DG.worldSites2d.make({ ctx: function () { return ctx; }, geom: function () { return geom; }, project: project, label: label, bodyK: bodyK, ENCOUNTER_RANGE: ENCOUNTER_RANGE })); }
  function drawFort(ft, u, v, now, pos) { return SI().drawFort(ft, u, v, now, pos); }
  function drawStation(st, u, v, now, pos) { return SI().drawStation(st, u, v, now, pos); }

  /** W-0204 2D 몸 배율 — 확대(camZoom2d, 2D 들판 확대 포함)를 몸도 따른다(옛: 땅만 커지고 사람은 60px 그대로), 1~2.5 */
  /** xL �0� 8\ U�  2D Jt 0�0�  D� 1xt Tt� \ ��x�(0.8 H). xL ��t ��| h| �tX �D ޘ� */ function strideVK() { var a = project(0, 0), b = project(0, -10); return geom.tilt ? Math.max(0.3, Math.min(1, Math.abs(a.y - b.y) / 10)) : 1; }
  function bodyK() { return core.clamp(camZoom2d(), 1, 2.5); }
  function drawSpawn(s, u, v, now, pos, wsc) {   // wsc = 세계 배율(W-0203 보폭 — 안의 scale 은 지역 숫자라 scale() 을 못 부른다)
    var p = project(u, v);
    if (p.s < 0.25 || p.y < -80 || p.y > geom.H + 80) { return; }
    var z = core.clamp(p.s, 0.5, 1.6) * bodyK();   // W-0204
    var age = (now - s.bornAt) / SPAWN_LIFE;
    var near = Math.hypot(s.x - pos.x, s.y - pos.y) <= ENCOUNTER_RANGE;
    var sp = global.DG.sprite;
    var isHero = s.kind === 'hero';
    var scale = z * (isHero ? 1.15 : 1.35), bk = isHero || !sp.beastK ? 1 : sp.beastK(s.ref);      // 짐승은 기준 키가 작아 더 키운다 · W-0349 종마다 크기(곰 1.15·토끼 0.42…)
    var bodyH = (isHero ? 40 : 30 * bk) * scale;

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
    ctx.ellipse(p.x, p.y - bodyH * 0.45, bodyH * 0.34, bodyH * 0.52, 0, 0, Math.PI * 2); if (global.DG.stealth) { global.DG.stealth.mark2d(ctx, s, p.x, p.y - bodyH * 1.15, bodyH); }   // W-0286 들킴 ❗
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    if (!(global.DG.mode2d && global.DG.mode2d.scaleOn && global.DG.mode2d.scaleOn())) { ctx.fill(); } else if (global.DG.mode2d.shadow) { global.DG.mode2d.shadow(ctx, p.x, p.y, bodyH * 0.62, { a: 0.3 }); }   /* W-0368 발 닿는 두 겹 그림자 */   // W-0349 몸 뒤 검은 타원(종이 오린 듯한 테두리) — 새 표에선 발밑 고리만

    if (!(isHero && global.DG.actor2d && global.DG.actor2d.human(ctx, s.ref, null, p.x, p.y, scale, { facing: s.facing, dirX: s.dirX, dirY: s.dirY, moving: s.moving, phase: s.phase, now: now, wx: s.x, wy: s.y * strideVK(), ppu: (wsc || 1) * p.s, pk: 'sp:' + (s.id || (s.ref && s.ref.id) + ':' + s.bornAt) }))) sp.stamp(ctx, {
      kind: isHero ? 'human' : 'beast', ref: s.ref, bk: bk,
      x: p.x, y: p.y, s: scale, facing: s.facing, phase: s.phase, walking: s.moving,
      color: isHero ? data.faction(s.ref.faction).color : sp.beastColorOf(s.ref),
      look: isHero ? sp.lookOf(s.ref) : null,
      form: isHero ? null : sp.beastFormOf(s.ref),
      divine: !isHero && s.ref.kind === 'divine',
      t: now
    });

    if (p.s > 0.45) { tagQ.push({ t: s.ref.name, x: p.x, y: p.y - bodyH * 1.12 - 6 * z, px: Math.round(11 * Math.min(z, 1.4)), shade: 'rgba(0,0,0,0.62)', fill: near ? '#fff' : 'rgba(255,255,255,0.78)', dist: Math.hypot(s.x - pos.x, s.y - pos.y), pri: near ? 3 : 1, ga: ctx.globalAlpha }); }   // W-0144 — flushTags 가 그린다 · W-0205 글자는 몸 배율(bodyK)을 1.4 까지만 · 우선 가까운 영웅 > 영웅 > 가까운 주민 > 주민
    ctx.globalAlpha = 1;
  }

  /**
   * 주민 한 사람. **스폰과 눈에 띄게 달라야 한다** — 잡거나 설득할 대상이 아니라
   * 그냥 여기 사는 사람이다. 그래서 발밑 등급 고리를 안 두르고(그림자만 둔다)
   * 이름표도 흐리게 단다. 가까이 가면 이름이 또렷해진다(말이 걸리는 거리다).
   */
  /** W-0369 화면에서만 사람끼리·나와 몸 폭만큼 벌린다(세계 자리·대화 거리 그대로) — 출발 자리에 촌장·상인·역참지기가 나와 한 덩어리로 겹쳐 "나"가 안 보였다. 손잡이 go.spreadPx(0 = 끔) · 나(0,0)는 안 움직임 */ function spreadUV(list, pos, sc, meFrom) { var out = [], i, j, it, a, b, dx, dy, d, k, m = +core.tuned('go.spreadPx', 46) * bodyK(); for (i = 0; i < list.length; i++) { out.push({ u: (list[i].x - pos.x) * sc, v: (list[i].y - pos.y) * sc }); } if (!(m > 0)) { return out; } for (it = 0; it < 4; it++) { for (i = 0; i < out.length; i++) { a = out[i]; for (j = -1; j < out.length; j++) { if (j === i) { continue; } if (j < 0 && meFrom != null && i >= meFrom) { continue; } b = j < 0 ? { u: 0, v: 0 } : out[j]; dx = a.u - b.u; dy = (a.v - b.v) * 1.6; d = Math.hypot(dx, dy); if (d >= m) { continue; } if (d < 0.01) { dx = i % 2 ? 1 : -1; dy = 0.3; d = Math.hypot(dx, dy); } k = (m - d) / d * (j < 0 ? 1 : 0.5); a.u += dx * k; a.v += dy * k / 1.6; } } } return out; } function drawNpc(n, u, v, now) {
    var p = project(u, v);
    if (p.s < 0.25 || p.y < -80 || p.y > geom.H + 80) { return; }
    var z = core.clamp(p.s, 0.5, 1.6) * bodyK();   // W-0204
    var sp = global.DG.sprite;
    var talkR = core.tuned('npc.talkRadius', 14);
    var near = n.dist <= talkR;
    var bodyH = 40 * z * 1.05;

    // 발밑 그림자 (등급 고리는 없다)
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 11 * z, 4.5 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    if (global.DG.mode2d && global.DG.mode2d.shadow) { global.DG.mode2d.shadow(ctx, p.x, p.y, 22 * z, { a: 0.3 }); } else { ctx.fill(); }   /* W-0368 두 겹 */

    if (!(global.DG.actor2d && global.DG.actor2d.human(ctx, n.p, null, p.x, p.y, z * 1.05, { facing: n.x < 0 ? -1 : 1, moving: n.walking, phase: n.phase, now: now, wx: n.x, wy: n.y * strideVK(), ppu: scale() * p.s, pk: 'npc:' + (n.id || ((n.p && n.p.id) || '') + ':' + n.phase) }))) sp.stamp(ctx, {
      kind: 'human', ref: n.p,
      x: p.x, y: p.y, s: z * 1.05, facing: n.x < 0 ? -1 : 1,
      phase: n.phase, walking: n.walking,
      /* 옷 색은 계절을 탄다 — 겨울에는 짙고 두껍다 (`season.js`) */
      color: (global.DG.season ? global.DG.season.cloth(n.p.color || '#6b6f78')
                               : (n.p.color || '#6b6f78')),
      look: sp.lookOf(n.p),
      t: now
    });

    if (p.s > 0.45) { tagQ.push({ t: n.p.name, x: p.x, y: p.y - bodyH * 1.10 - 5 * z, px: Math.round(10 * Math.min(z, 1.4)), shade: 'rgba(0,0,0,0.55)', fill: near ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.7)', dist: n.dist, keep: !!n.p.goal, pri: n.p.goal ? 4 : near ? 2 : 0 }); }   // W-0144 · W-0205 먼 주민 0.42 → 0.7(밝은 돌바닥에서 안 읽혔다)
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
    var bh = global.DG.sprite.building(ctx, { img: global.DG.sprite.buildingImg('Watchtower'), x: p.x, y: p.y, s: z * 2.2, k2d: z * bodyK(), kind2d: 'landmark:' + lm.biome });
    label(ctx, (BMd.found(lm.key) ? '🌀 ' : '🗼 ') + lm.name, p.x, p.y - (bh > 0 ? bh + 8 : 46 * z * 2.2 * 1.3) - 6,
      BMd.BIOMES[lm.biome].color, 'center', z);
  }

  /** 들판 적 — 도감 펫 그림을 빌리고 원소 빛깔 고리를 발밑에 두른다 */
  function drawFieldFoe(fo, u, v, now) {
    var p = project(u, v);
    if (p.s < 0.25 || p.y < -80 || p.y > geom.H + 80) { return; }
    var z = core.clamp(p.s, 0.5, 1.6);
    var sp = global.DG.sprite, EL = global.DG.fieldCombat.EL, an2 = global.DG.fieldCombat.anim2d ? global.DG.fieldCombat.anim2d('fc' + fo.uid) : null, ph2 = an2 ? 1 - an2.left / an2.dur : 0, fa2 = !an2 ? { dx: 0, dy: 0, k: 1, a: 1 } : an2.clip === 'hit' ? { dx: Math.sin(ph2 * 9.4) * 4 * z, dy: 0, k: 0.96, a: (ph2 * 10 | 0) % 2 ? 0.45 : 1 } : { dx: 0, dy: -Math.sin(Math.min(1, ph2) * Math.PI) * 8 * z, k: 1 + 0.12 * Math.sin(Math.min(1, ph2) * Math.PI), a: 1 }; ctx.globalAlpha = fa2.a;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 12 * z * fo.h * bodyK(), 5 * z * fo.h * bodyK(), 0, 0, Math.PI * 2);   // W-0233 적 몸도 나처럼 bodyK
    ctx.strokeStyle = fo.el ? EL[fo.el].color : '#d9534f';
    ctx.lineWidth = 2;
    ctx.stroke();
    sp.stamp(ctx, {
      kind: 'beast', ref: fo.ref,
      x: p.x + fa2.dx, y: p.y + fa2.dy, s: z * 1.25 * fo.h * bodyK(), dk: fa2.k, facing: 1, phase: fo.phase, walking: fo.moving,   // W-0224 덮치기·맞음
      color: sp.beastColorOf(fo.ref), form: sp.beastFormOf(fo.ref), t: now
    }); ctx.globalAlpha = 1;
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

  var meT0 = 0; function meArrow(x, y, now) { if (!meT0) { meT0 = now; } var left = +core.tuned('go.meArrowMs', 10000) - (now - meT0); if (!(left > 0)) { return false; } var b = Math.sin(now / 220) * 4, a = Math.min(1, left / 1500); ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(x, y + b); ctx.lineTo(x - 9, y - 12 + b); ctx.lineTo(x + 9, y - 12 + b); ctx.closePath(); ctx.fillStyle = '#7fd0ff'; ctx.fill(); ctx.strokeStyle = 'rgba(10,25,40,0.8)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); return true; }   /* W-0369 "나" — 처음 10초 머리 위 작은 화살표(go.meArrowMs) — 사람 사이에서 나를 못 찾았다 */ function drawPlayer(now, sc) {
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
    var pulse = 1 + Math.sin(now / 500) * 0.07; if (global.DG.mode2d && global.DG.mode2d.shadow) { global.DG.mode2d.shadow(ctx, X, Y, 26, { a: 0.32 }); }   /* W-0368 푸른 고리 밑 발 닿는 그림자 */
    ctx.beginPath();
    ctx.ellipse(X, Y, 17 * pulse, 8 * pulse, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(74,163,240,0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,200,255,0.75)';
    ctx.lineWidth = 2;
    ctx.stroke(); meArrow(X, Y - 62 * bodyK(), now);

    if (!(global.DG.actor2d && global.DG.actor2d.human(ctx, lead, 'player', X, Y, (geom.mode === 2 ? 1.5 : 1.25) * bodyK(), { facing: player.facing, dirX: player.dirX, dirY: player.dirY, moving: moving, phase: player.phase, now: now, wx: core.save.player.pos.x, wy: core.save.player.pos.y * strideVK(), ppu: sc || scale() }))) sp.stamp(ctx, {
      kind: 'human', ref: lead, key: lead ? null : 'player',
      // 3D 는 카메라가 낮아 캐릭터를 조금 더 크게 (원작 느낌)
      x: X, y: Y, s: (geom.mode === 2 ? 1.5 : 1.25) * bodyK(),
      facing: player.facing, phase: player.phase, walking: moving,
      color: lead ? data.faction(lead.faction).color : '#3f6f9f',
      look: lead ? sp.lookOf(lead) : { weapon: 'sword', helm: 'gat', armor: 'robe', cape: true },
      t: now
    });
  }

  /* W-0389 ③-4 — 이름표 글자(그림자 + 글자, 프레임당 50여 번 fillText·글꼴 지정)를 작은 캔버스에 한 번 그려 두고 붙인다(캔버스 배율로 굽기).
     글자 폭(measureText)도 기억 · 손잡이 world.labelCache 0 = 옛 길 */
  var txtC = {}, txtN = 0, txtWs = {}, txtWN = 0, txtM = null;
  function txtFont(px) { return '600 ' + px + 'px system-ui, sans-serif'; }
  function txtOn() { return !!+core.tuned('world.labelCache', 1) && typeof document !== 'undefined'; }
  function txtWidth(t, px) {
    var k = t + '\u0001' + px, w = txtWs[k];
    if (w === undefined) { if (!txtM) { txtM = document.createElement('canvas').getContext('2d'); } if (txtWN > 800) { txtWs = {}; txtWN = 0; } txtM.font = txtFont(px); w = txtWs[k] = txtM.measureText(t).width; txtWN++; }
    return w;
  }
  function txtDraw(c, t, px, fill, shade, x, y, align) {
    if (!txtOn()) { c.textAlign = align || 'left'; c.font = txtFont(px); c.fillStyle = shade; c.fillText(t, x + 1, y + 1); c.fillStyle = fill; c.fillText(t, x, y); c.textAlign = 'left'; return; }
    var tf = c.getTransform ? c.getTransform() : null, kk = tf && tf.a > 0 ? tf.a : 1, key = t + '\u0001' + px + '\u0001' + fill + '\u0001' + shade + '\u0001' + kk, e = txtC[key];
    if (!e) {
      if (txtN > 600) { txtC = {}; txtN = 0; }
      var cv = document.createElement('canvas'), g = cv.getContext('2d'), m, asc, dsc, w, h;
      g.font = txtFont(px); m = g.measureText(t);
      asc = Math.ceil(m.actualBoundingBoxAscent > 0 ? m.actualBoundingBoxAscent : px * 0.95) + 1; dsc = Math.ceil(m.actualBoundingBoxDescent > 0 ? m.actualBoundingBoxDescent : px * 0.3) + 3; w = Math.ceil(m.width) + 4; h = asc + dsc;
      cv.width = Math.max(1, Math.ceil(w * kk)); cv.height = Math.max(1, Math.ceil(h * kk));
      g = cv.getContext('2d'); g.scale(kk, kk); g.font = txtFont(px);
      g.fillStyle = shade; g.fillText(t, 2, asc + 1); g.fillStyle = fill; g.fillText(t, 1, asc);
      e = txtC[key] = { cv: cv, w: w, h: h, asc: asc, tw: m.width }; txtN++;
    }
    c.drawImage(e.cv, x - (align === 'center' ? 1 + e.tw / 2 : align === 'right' ? 1 + e.tw : 1), y - e.asc, e.w, e.h);
  }
  function label(ctx, text, x, y, color, align, z) {
    z = core.clamp(z || 1, 0.6, 1.3);
    if (txtOn()) { txtDraw(ctx, text, Math.round(12 * z), color, 'rgba(0,0,0,0.6)', x, y, align || 'left'); return; }
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
    draw: draw, resize: resize, layoutLabels: layoutLabels, _makeSpawn: makeSpawn, _spreadUV: spreadUV, _spawnOff: function () { return spawnOff; }, _landTex2D: function () { return LAND_TEX_VARIANTS; },   // W-0144·W-0152·W-0154 진단
    get spawns() { return spawns; },
    removeSpawn: removeSpawn,
    nearest: nearest, maxSpawns: maxSpawns, MAX_SPAWNS: MAX_SPAWNS, spawnSpecial: spawnSpecial,
    /** ㉑ 반경 R 안 흔적 수(track.js) — 재미표준 E 가 상호작용 수에 더한다 */
    trackCells: function (R, x, y) { return global.DG.track ? global.DG.track.trackCells(R, x, y) : 0; },
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
    /* 위경도 ↔ 세계 좌표(GPS 걸음·진단). 옛 geo.js(W-0208 에서 지움)도 썼다 */
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
    get baseSpeed() { return speed; }, body2dM: function () { var W3b = global.DG.world3d; return geom && !(W3b && W3b.active && W3b.active()) ? (geom.mode === 2 ? 1.5 : 1.25) * bodyK() * 48 / scale() : null; },   // W-0232 2D 화면 몸 높이(m) — 3D 면 null
    get tilt() { return tiltOn(); },
    get tiltMode() { return tiltMode(); },
    /** 지금 실제로 화면을 그리는 게 WebGL 3D 렌더러인가 — 이게 켜져 있으면
        zoom3d 가 실제 카메라 배율이다(2D·2.5D·3D 어느 시점이든) */
    get render3dOn() { var W3 = global.DG.world3d; return !!(W3 && W3.active && W3.active()); },
    /** 3D 카메라 배율 — 화면 값이다(판정에는 안 닿는다) */
    get zoom3d() { return zoom3d(); },
    setZoom3d: setZoom3d, nudgeZoom: nudgeZoom,
    ZOOM3_MIN: ZOOM3_MIN, ZOOM3_MAX: ZOOM3_MAX, ZOOM3_WIDE3: ZOOM3_WIDE3, ZOOM3_DEFAULT: ZOOM3_DEFAULT,
    /** 2D·2.5D 카메라 배율 — 화면 값이다(판정에는 안 닿는다) */
    get camZoom2d() { return camZoom2d(); },
    setCamZoom2d: setCamZoom2d, nudgeZoom2d: nudgeZoom2d, _bindZoom: bindZoom,   // W-0155 진단
    ZOOM2_MIN: ZOOM2_MIN, ZOOM2_MAX: ZOOM2_MAX, ZOOM2_DEFAULT: ZOOM2_DEFAULT,
    /** 3인치 모드 — 화면을 멀리서 보는 스위치 (2D·2.5D·3D 어디서든 켠다) */
    get wide3in() { return is3inch(); },
    toggle3inch: toggle3inch,
    /** 시점 순환 — 2D → 2.5D → 3D → 2D */
    cycleTilt: function () {
      core.save.settings.tilt = (tiltMode() + 1) % 3; if (global.DG.deviceMode) { global.DG.deviceMode.mark('go', core.save.settings.tilt > 0); }
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
