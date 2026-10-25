/**
 * 마을 화면 — 원작식 구면(球面) 마을
 * ---------------------------------------------------------------
 * 여기서는 **계산하지 않는다**. village.js 의 상태를 읽어 그리기만 한다.
 *
 * 원작의 그림 문법을 그대로 따른다. 원작이 "원작처럼" 보이는 이유는
 * 귀여운 그림체가 아니라 **투영**에 있다 —
 *
 *   1. 마을이 원통에 감겨 있다. 앞으로 갈수록 땅이 위로 휘어 오르다가
 *      지평선(마루)에서 넘어가 사라진다. 마을 전체를 한눈에 볼 수 없다
 *   2. 좌우 가장자리는 아래로 처진다 (공 위에 서 있는 느낌)
 *   3. 카메라는 늘 사람을 한가운데 둔다. 마을 밖은 바다다 (섬)
 *   4. 위에서 곧게 내려다보지 않는다. y 를 눌러 비스듬히 본다(3/4 시점)
 *
 * 그래서 이 파일의 심장은 project() / unproject() 다. 나머지는 전부
 * "투영된 자리에 무엇을 그리나" 일 뿐이다.
 *
 * 사물은 이모지가 아니라 **도형으로 그린다**. 나무 수관은 계절을 탄다
 * (봄 벚빛 · 여름 초록 · 가을 주황 · 겨울 눈). 사람과 짐승만 sprite.js 를 쓴다.
 *
 * 시간대(새벽·낮·저녁·밤)에 따라 하늘·해·달·별이 바뀐다. 그게 이 게임의 시계다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var V = null, VD = null;

  var cv = null, ctx = null;
  var W = 0, H = 0, dpr = 1;
  var cam = { x: 0, y: 0 };

  /* ── 구면 투영의 상수 ─────────────────────────────────────
   * R    구면 반지름(마을 단위). 작을수록 세게 휜다. 40 단위가 한 칸이니
   *      520 이면 열세 칸쯤 앞에서 지평선이 넘어간다
   * TILT 내려다보는 각. 1 이면 정면, 0 이면 완전한 탑다운
   * BEND 좌우 처짐. 화면 가장자리가 아래로 내려앉는 정도
   * ZOOM 화면 크기에 맞춘 배율 — resize() 가 정한다. 이게 없으면 작은 화면에서
   *      지평선이 화면 위로 밀려 나간다
   */
  var R0 = 520, R = R0;   // W-0133 — R 은 resize 가 R0 ÷ 스타듀 배율(cozy2d)로 줄인다: 배율을 키워도 지평선(마루)이 화면 같은 자리
  var TILT = 0.66;
  var BEND = 0.000155;
  var ZOOM = 1;
  var CX = 0, CY = 0;          // 시선 중심(=사람)이 놓이는 화면 자리
  var horizonY = 0;            // 마루의 높이 (화면 한가운데 기준)
  var A_MAX = 1.32;            // 이 각을 넘으면 마루 너머 — 그리지 않는다

  function init(canvas) {
    V = global.DG.village;
    VD = global.DG.villageData;
    cv = canvas;
    ctx = cv.getContext('2d');
    resize();
    global.addEventListener('resize', resize);
    /* 걷기 입력 — 새 이름은 onDown/onMove/onUp 이다.
       팏만으로는 목표를 한 번 찍고 기다려야 해서 폰에서 걸음이 뚝뚝 끊긴다.
       눌러 있는 동안 손가라 자리를 목표로 계속 갈아 주면 따라 걷는 을이 된다.
       마우스도 같은 길을 쓴다(끌면 따라온다).
       PointerEvent 가 없는 오람 부라우자는 팏으로 돌아간다 */
    if (global.PointerEvent) {
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('pointermove', onMove);
      cv.addEventListener('pointerup', onUp);
      cv.addEventListener('pointercancel', onUp);
    } else {
      cv.addEventListener('click', onClick);
    }
    initJoy();
    /* W-0365 2D 카메라 배율(공용 cam2d) — 휠·두 손가락·＋/－, 폰·PC 따로 기억. 폰 기본 0.7(사용자 10-22 "3번은 화면이 넘 가까워") */
    var C2 = global.DG.cam2d;
    if (C2) {
      cam2 = C2.register('village', { store: 'yeoksa-village/save/cam2d', min: 0.5, max: 1.6, def: 1, defPhone: 0.7, onChange: function () { resize(); } });
      cam2.attach(cv, { onPinchStart: function () { dragging = false; var pl = V.raw().player; V.walkTo(pl.x, pl.y); } });   // 두 번째 손가락이 닿으면 첫 손가락의 걷기 목표를 제자리로
      camBtns = cam2.buttons(document.body);
      global.setInterval(function () { if (camBtns) { camBtns.style.display = getComputedStyle(cv).display === 'none' ? 'none' : ''; } }, 500);   // 3D 마을이면 감춤
      resize();
    }
  }
  var cam2 = null, camBtns = null;

  /* 2026-09-09 — "움직이는 게 너무 힘들다"(모바일 재신고, 사가나락와 같은
     제보). 화면 아무 데나 눌러 그 지점으로 걷는 위 onDown/onMove 방식은
     카메라가 늘 사람을 한가운데 두는 이 판(구면 투영)에서는 특히,
     계속 다시 짚어야 방향이 유지돼 손이 피곤했다. 고정 조이스틱(#vjoy)을
     얹는다 — 이 원 안에서 시작한 손가락만 받고, 원 중심 기준 방향을
     village.js의 setJoy(dx,dy)에 그대로 먹인다. PC 마우스는 기존 드래그
     그대로 쓴다(터치 기기에서만 보이게 한다). */
  function initJoy() {
    var joyEl = document.getElementById('vjoy');
    var joyKnob = document.getElementById('vjoy-knob');
    if (!joyEl || !joyKnob) { return; }
    var isTouch = !!(('ontouchstart' in global) || (navigator.maxTouchPoints > 0));
    if (isTouch) { joyEl.classList.add('show'); }
    initPad(isTouch);
    var joyId = null, joyCX = 0, joyCY = 0;
    var JOY_R = 46, JOY_DEAD = 8;
    function knobAt(dx, dy) { joyKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
    function reset() { joyId = null; knobAt(0, 0); V.setJoy(0, 0); joyEl.classList.remove('held'); }   // W-0364 폰: 받침 원은 누를 때만(.held)
    joyEl.addEventListener('pointerdown', function (e) {
      if (joyId !== null) { return; }
      var r = joyEl.getBoundingClientRect();
      joyCX = r.left + r.width / 2; joyCY = r.top + r.height / 2;
      joyId = e.pointerId; joyEl.classList.add('held');
      joyEl.setPointerCapture && joyEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    joyEl.addEventListener('pointermove', function (e) {
      if (e.pointerId !== joyId) { return; }
      var dx = e.clientX - joyCX, dy = e.clientY - joyCY;
      var len = Math.hypot(dx, dy);
      var kx = len > JOY_R ? dx / len * JOY_R : dx, ky = len > JOY_R ? dy / len * JOY_R : dy;
      knobAt(kx, ky);
      if (len < JOY_DEAD) { V.setJoy(0, 0); return; }
      V.setJoy(dx / len, dy / len);
      e.preventDefault();
    });
    function release(e) { if (e.pointerId === joyId) { reset(); } }
    joyEl.addEventListener('pointerup', release);
    joyEl.addEventListener('pointercancel', release);
    joyEl.addEventListener('pointerleave', release);
  }

  /* 2026-09-09 — "피시에서는 마우스 클릭 버튼으로"(사용자 요청). 조이스틱과
     같은 자리에 터치가 아닐 때만 보이는 네 방향 버튼(#vpad) — 누르고 있는
     동안 그 방향으로 V.setJoy() 를 먹인다(대각선은 두 버튼을 함께 눌러
     낸다, keys 의 결과 방식과 같다). */
  function initPad(isTouchDev) {
    var padEl = document.getElementById('vpad');
    if (!padEl) { return; }
    if (!isTouchDev) { padEl.classList.add('show'); }
    var held = { up: false, down: false, left: false, right: false };
    function apply() {
      var dx = (held.left ? -1 : 0) + (held.right ? 1 : 0);
      var dy = (held.up ? -1 : 0) + (held.down ? 1 : 0);
      var len = Math.hypot(dx, dy);
      V.setJoy(len ? dx / len : 0, len ? dy / len : 0);
    }
    var btns = padEl.querySelectorAll('button[data-dir]');
    for (var pi = 0; pi < btns.length; pi++) {
      (function (btn) {
        var dir = btn.getAttribute('data-dir');
        btn.addEventListener('pointerdown', function (e) {
          held[dir] = true; apply();
          btn.setPointerCapture && btn.setPointerCapture(e.pointerId);
          e.preventDefault();
        });
        function release2() { held[dir] = false; apply(); }
        btn.addEventListener('pointerup', release2);
        btn.addEventListener('pointercancel', release2);
        btn.addEventListener('pointerleave', release2);
      })(btns[pi]);
    }
  }

  function resize() {
    dpr = Math.min(global.devicePixelRatio || 1, 2);
    W = global.innerWidth; H = global.innerHeight;
    cv.width = Math.floor(W * dpr);
    cv.height = Math.floor(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var CZ = global.DG.cozy2d ? global.DG.cozy2d.zoomMul() : 1; ZOOM = core.clamp(H / 620, 0.82, 1.7) * CZ * ((global.innerHeight || 720) < 600 ? 1 : +(global.DG.core && global.DG.core.tuned ? global.DG.core.tuned('mode2d.vwScale', ((global.DG.cfg && global.DG.cfg.mode2d) || {}).vwScale || 1) : 1) || 1) * (cam2 ? cam2.get() : 1); R = R0 / CZ;   // W-0133 스타듀식 큰 인물(손잡이 village.cozyZoom)
    CX = W * 0.5;
    CY = H * 0.62;
    horizonY = CY - R * ZOOM * TILT;
  }

  /* ── 투영 ─────────────────────────────────────────────────
   * 마을 좌표 → 화면 좌표. s 는 그 자리의 크기 배율(멀수록 작다).
   * a 는 원통 위의 각 — 음수면 앞(멀다), 양수면 뒤(가깝다).
   */
  function project(wx, wy) {
    var dy = wy - cam.y;
    var a = dy / R;
    if (a > 1.2) { a = 1.2; }
    var s = 1 / (1 - a * 0.40);
    if (s < 0.42) { s = 0.42; } else if (s > 1.55) { s = 1.55; }
    var sx = CX + (wx - cam.x) * ZOOM * s;
    var d = sx - CX;
    var sy = CY + R * ZOOM * TILT * Math.sin(a) + d * d * BEND;
    return { x: sx, y: sy, s: s, a: a };
  }

  /**
   * 화면 좌표 → 마을 좌표. project 를 되짚는다.
   * 각(a)이 x 에 기대지 않으므로 반복 없이 한 번에 풀린다.
   */
  function unproject(sx, sy) {
    var d = sx - CX;
    var v = (sy - CY - d * d * BEND) / (R * ZOOM * TILT);
    v = core.clamp(v, -0.9999, 0.9999);
    var a = Math.asin(v);
    var s = 1 / (1 - a * 0.40);
    if (s < 0.42) { s = 0.42; } else if (s > 1.55) { s = 1.55; }
    return { x: cam.x + d / (ZOOM * s), y: cam.y + a * R };
  }

  /** 화면에서 눌린 자리를 마을 좌표로 되짚는다 */
  function pointAt(e) {
    var r = cv.getBoundingClientRect();
    var sx = e.clientX - r.left, sy = e.clientY - r.top;
    /* 집 안·동굴 안은 투영이 다르다 — 마을 식으로 되짚으면 엉뚱한 자리를 짚는다 */
    var p = (V.indoors() || V.caveInside()) ? unprojIn(sx, sy) : unproject(sx, sy);
    return p;
  }

  function onClick(e) { var p = pointAt(e); V.walkTo(p.x, p.y); }

  /* 눌러 끌는 동안은 그 자리로 간다 */
  var dragging = false;

  function onDown(e) {
    if (e.button || (cam2 && cam2.pinching())) { return; }   // 가운데·오른쪽 단추·두 손가락 핀치는 짚지 않는다(W-0365)
    dragging = true;
    /* 캡처 — 손가라가 HUD 나 화면 밖으로 나가도 계속 따른다 */
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 안 되면 그대로 */ }
    onClick(e);
  }

  function onMove(e) {
    if (!dragging || (cam2 && cam2.pinching())) { return; }
    e.preventDefault();
    onClick(e);
  }

  function onUp(e) {
    dragging = false;
    try { cv.releasePointerCapture(e.pointerId); } catch (err) { /* 이문 없다 */ }
  }

  /* ── 색 도구 ──────────────────────────────────────────── */

  function mix(c1, c2, t) {
    var a = hex(c1), b = hex(c2);
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
                    Math.round(a[1] + (b[1] - a[1]) * t) + ',' +
                    Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }
  function hex(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function dark(c, t) { return mix(c, '#000000', t); }
  function light(c, t) { return mix(c, '#ffffff', t); }

  /* ── 그리기 ───────────────────────────────────────────── */

  function draw() {
    if (!ctx) { return; } bubbleRects.length = 0;   // W-0144 — 말풍선 자리는 프레임마다 새로
    var raw = V.raw(), p = raw.player;
    var T = V.TILE;
    var now = Date.now();
    var se = VD.season();
    var ph = VD.phaseOf(new Date().getHours());

    /* 집 안은 아주 다른 장면이다 — 하늘도 계절도 없고, 무엇보다 **휘지 않는다** */
    if (V.indoors()) { drawHomeScene(p, ph, now); return; }
    if (V.caveInside()) { drawCaveScene(p, now); return; }

    /* 카메라 — 원작처럼 사람을 늘 한가운데 둔다.
       마을 밖은 tileAt 이 물을 돌려주므로 저절로 섬이 된다 */
    cam.x = p.x; cam.y = p.y;

    ctx.clearRect(0, 0, W, H);
    drawSky(ph, se, now);
    drawFarShore(ph, se);
    drawGround(T, se, now);

    /* 2026-09-09 — "클릭한 곳이 안 보인다"(사가나락와 같은 재신고). walkTo()
       로 찍은 목표를 바닥에 원으로 표시한다 — 도착하거나(V.js의 target=null)
       조이스틱 등 다른 입력이 오면 다음 프레임에 저절로 사라진다. */
    var mtgt = V.moveTarget();
    if (mtgt) {
      var mp = project(mtgt.x, mtgt.y);
      var mr = 13 * mp.s * (1 + Math.sin(now / 140) * 0.14);
      ctx.beginPath();
      ctx.ellipse(mp.x, mp.y, mr, mr * 0.42, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 226, 150, 0.88)';
      ctx.lineWidth = 2.2 * mp.s;
      ctx.stroke();
    }

    /* 사물 · 주민 · 사람을 마을 y 순서로 그린다 (아래쪽이 앞) */
    var draws = [], i;
    for (i = 0; i < raw.props.length; i++) { draws.push({ y: raw.props[i].y, t: 'prop', o: raw.props[i] }); }
    for (i = 0; i < raw.residents.length; i++) { draws.push({ y: raw.residents[i].y, t: 'res', o: raw.residents[i] }); }
    var bl = global.DG.bug ? global.DG.bug.list() : [];
    for (i = 0; i < bl.length; i++) { draws.push({ y: bl[i].y, t: 'bug', o: bl[i] }); }
    var al = raw.animals || [];
    for (i = 0; i < al.length; i++) { draws.push({ y: al[i].y, t: 'animal', o: al[i] }); }
    var nl = (raw.npcs || []).concat(raw.visitors || []);   // 방문객(§5.9)도 NPC 와 같은 그림
    for (i = 0; i < nl.length; i++) { draws.push({ y: nl[i].y, t: 'npc', o: nl[i] }); }
    draws.push({ y: p.y, t: 'me', o: p });
    draws.sort(function (a, b) { return a.y - b.y; });

    var f = V.focus();
    for (i = 0; i < draws.length; i++) {
      var d = draws[i];
      if (d.t === 'prop') { drawProp(d.o, f, se, now); }
      else if (d.t === 'res') { drawResident(d.o, f, now); }
      else if (d.t === 'bug') { drawBug(d.o, f, ph, now); }
      else if (d.t === 'animal') { drawAnimal(d.o, now); }
      else if (d.t === 'npc') { drawNpc(d.o, f, now); }
      else { drawMe(d.o, now); }
    }

    var starHint = SKY().starHint();
    if (starHint) {
      bubble('🌠 흐르는 별 — 소원을 빈다 [' + core.actHint() + ']', starHint.x, starHint.y, '#3a3a5a', '#f2f0ff');
    }

    drawWeather(se, now);
    /* 계절빛 — 아주 옅게 한 겹 (계절이 바뀐 걸 눈이 먼저 안다) */
    ctx.fillStyle = se.tint;
    ctx.fillRect(0, 0, W, H);

    /* 시간대 빛 — 밤이면 어둡게 덮는다 */
    if (global.DG.cozy2d && global.DG.cozy2d.light(ctx, ph, W, H, project(p.x, p.y), ZOOM)) { /* W-0133 아늑한 빛이 대신 덮었다 */ } else if (ph.light !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = ph.light;
      ctx.fillRect(0, 0, W, H);
    }

    /* 백중 밤의 불꽃 — 밤과 저녁에만 오른다. 빛 위에 그린다(W-0133 — 밤 곱하기에 묻히지 않게) */
    if (evTag() === 'fire' && (ph.key === 'night' || ph.key === 'even')) {
      drawFireworks(now);
    }
  }

  /* ── 하늘 — 하늘빛·별·흐르는 별·해달·구름·먼 물가는 js/village-sky.js(R-4) ─────── */
  var skyBind = null;
  function SKY() {
    return global.DG.villageSky.bind(skyBind || (skyBind = { mix: mix, dark: dark, light: light, BEND: BEND,
      view: function () { return { ctx: ctx, W: W, H: H, CX: CX, horizonY: horizonY, VD: VD }; } }));
  }
  function drawSky(ph, se, now) { return SKY().drawSky(ph, se, now); }
  function drawFarShore(ph, se) { return SKY().drawFarShore(ph, se); }
  function wxKey() { return SKY().wxKey(); }
  function evTag() { return SKY().evTag(); }

  /* ── 땅 ───────────────────────────────────────────────────
   * 칸마다 네 귀퉁이를 투영해 사각형(휜 사각형)으로 채운다.
   * 색이 몇 가지 안 되니 **색별로 한 번에 칠한다** — 칸마다 fill 하면
   * 한 화면에 이천 번이 넘어 프레임이 무너진다.
   */
  /* 바닥 타일 그림 — Kenney Roguelike/RPG Pack(CC0, 나무와 같은 시트).
     숲 고리 네 변종(grass_meadow·dark·mush·rocky)은 그림을 따로 안 구하고
     같은 잔디 그림을 각자 색으로 물들여 쓴다(아래 drawGround 의 색 얹기 참고) */
  var TILE_IMG_SRC = {
    grass: 'assets/sprites2d/tile_grass.png',
    grass_meadow: 'assets/sprites2d/tile_grass.png',
    grass_dark: 'assets/sprites2d/tile_grass.png',
    grass_mush: 'assets/sprites2d/tile_grass.png',
    grass_rocky: 'assets/sprites2d/tile_grass.png',
    path: 'assets/sprites2d/tile_dirt.png',
    sand: 'assets/sprites2d/tile_sand.png',
    water: 'assets/sprites2d/tile_water.png',
    stone: 'assets/sprites2d/tile_stone.png',
    floor: 'assets/sprites2d/tile_floor.png'
  };
  var tileImgCache = {};
  function ownTile(kind) { var A3 = global.DG.assets3d; return (kind === 'sand' || kind === 'water') && A3 && A3.root && A3.root() ? A3.root() + 'web2d/tile/forest_' + kind + '.webp' : null; }   // W-0262 모래·물 = 공용 자체 web2d 타일
  function tileImg(kind, se) {
    var M2 = global.DG.mode2d, Z2 = global.DG.cozy2d, src = (Z2 && Z2.tileSrc(kind, se && se.key)) || (M2 && M2.tileUrl(se && se.key === 'winter' && kind.indexOf('grass') === 0 ? 'snow' : kind)) || ownTile(kind) || TILE_IMG_SRC[kind] || TILE_IMG_SRC.grass;   // 2D 모드면 K-0020 타일(겨울엔 풀 → 눈) · W-0142 풀은 계절 타일(K-0091)
    var im = tileImgCache[src];
    if (!im) { im = new Image(); im.src = src; tileImgCache[src] = im; }
    return im;
  }

  /** 타일 그림을 좌상·우상·좌하 세 꼭짓점만 맞춰 아핀 변환으로 그린다.
      구면 투영이라 넷째 꼭짓점(우하)은 근사다 — 타일이 작아 안 띈다.
      `ctx.transform`(누적)을 쓴다 — `setTransform`은 draw() 가 걸어 둔 DPR
      배율을 지워 버린다 */
  /* W-0390 — K-0162 이음 타일(이중 격자, 공용 autotile2d): 가까운 칸 그림을 반 칸 밀린 격자로 — 네 모서리 땅 종류 → 바탕 타일 한 장 / 쌍 아틀라스 칸 / NW 바탕.
     겨울(눈)은 옛 길. 손잡이 village.autotile(1 · 0 = 옛 overlay 그림) */
  var at2 = null;
  function AT() { if (!at2 && global.DG.autotile2d) { at2 = global.DG.autotile2d.make('assets/web2d/tile/'); } return at2; }
  function autotileOn(se) { var C = global.DG.core, A = AT(); return !!(A && !(C && C.tuned && !+C.tuned('village.autotile', 1)) && !(se && se.key === 'winter') && A.ready()); }
  /** 아틀라스 조각(sx, sy, sw, sh)을 칸 세 꼭짓점에 맞춰(아핀) 그린다 — 바탕 그대로(덧씌우기 아님) */
  function drawTileRect(img, sx, sy, sw, sh, a0, a1, a3) {
    if (!img || !img.complete || !img.naturalWidth) { return false; }
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.transform((a1.x - a0.x) / sw, (a1.y - a0.y) / sw, (a3.x - a0.x) / sh, (a3.y - a0.y) / sh, a0.x, a0.y);
    ctx.drawImage(img, sx, sy, sw, sh, -0.5, -0.5, sw + 1, sh + 1);   // 0.5px 겹침 — 칸 사이 실금 방지
    ctx.restore();
    return true;
  }
  function drawTileTexture(img, a0, a1, a3) {
    if (!img.complete || !img.naturalWidth) { return; }
    var iw = img.naturalWidth, ih = img.naturalHeight;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.6;
    ctx.imageSmoothingEnabled = false;
    ctx.transform((a1.x - a0.x) / iw, (a1.y - a0.y) / iw,
                  (a3.x - a0.x) / ih, (a3.y - a0.y) / ih,
                  a0.x, a0.y);
    ctx.drawImage(img, 0, 0, iw, ih);
    ctx.restore();
  }

  function drawGround(T, se, now) {
    var rows = [], batch = {}, key, texList = [];
    var ty0 = Math.floor((cam.y - R * A_MAX) / T) - 1;
    var ty1 = Math.floor((cam.y + R * 0.95) / T) + 1;
    var tufts = [], glints = [];
    var ty, tx, gTex = !!core.tuned('village.groundTex2d', 1);   // W-0406 사용자 10-25 「2d 는 기존 화면이 아닌 에셋 맵이어야」

    for (ty = ty0; ty <= ty1; ty++) {
      var midA = (ty * T + T * 0.5 - cam.y) / R;
      if (midA < -A_MAX) { continue; }
      var sMid = 1 / (1 - core.clamp(midA, -2, 1.2) * 0.40);
      if (sMid < 0.42) { sMid = 0.42; }
      var half = (W * 0.5 + T * 2) / (ZOOM * sMid);
      var tx0 = Math.floor((cam.x - half) / T) - 1;
      var tx1 = Math.floor((cam.x + half) / T) + 1;
      /* 먼 줄은 몇 픽셀로 뭉개진다 — 두 칸씩 건너뛰어도 눈에 띄지 않는다 */
      var step = midA < -0.85 ? 2 : 1;

      for (tx = tx0; tx <= tx1; tx += step) {
        var kind = V.tileAt(tx, ty);
        var t = VD.TILES[kind] || VD.TILES.grass;
        var alt = gTex || ((tx + ty) % 2 + 2) % 2 === 0;   // W-0406 바둑판 두 색은 손잡이 0 일 때만(이제 밑색 한 색 + 전 칸 그림)
        var col = kind === 'grass' ? (alt ? se.grass : se.grass2)
                                   : (alt ? t.color : t.color2);
        var a0 = project(tx * T, ty * T);
        var a1 = project((tx + step) * T, ty * T);
        var a2 = project((tx + step) * T, (ty + 1) * T);
        var a3 = project(tx * T, (ty + 1) * T);
        if (a3.y < -30 || a0.y > H + 40) { continue; }
        if (Math.max(a0.x, a1.x) < -30 || Math.min(a0.x, a3.x) > W + 30) { continue; }

        key = col;
        if (!batch[key]) { batch[key] = []; rows.push(key); }
        batch[key].push(a0, a1, a2, a3);
        /* 그림은 가까운 칸에만 얹는다(step===1) — 먼 줄은 색만으로 충분하고
           칸이 작아 그림을 얹어도 안 보인다. 아핀 근사도 먼 칸일수록 어긋난다 */
        if (step === 1 || gTex) { texList.push({ img: tileImg(kind, se), a0: a0, a1: a1, a3: a3, kind: kind, tx: tx, ty: ty, step: step }); }   // W-0406 먼 줄(두 칸 건너뜀)도 그림

        /* 잔디 술 · 물빛 — 가까운 칸에만 (멀면 지저분해진다) */
        if (midA > -0.75 && step === 1) {
          if (kind.indexOf('grass') === 0 && core.hash2(tx * 7 + 1, ty * 13 + 5) > 0.74) {
            tufts.push(project(tx * T + T * 0.5, ty * T + T * 0.62));
          } else if (kind === 'water' && core.hash2(tx * 3, ty * 11) > 0.55) {
            glints.push({ p: project(tx * T + T * 0.5, ty * T + T * 0.5), k: tx + ty });
          }
        }
      }
    }

    /* 색별로 한 번에 */
    for (var i = 0; i < rows.length; i++) {
      var quads = batch[rows[i]];
      ctx.beginPath();
      for (var j = 0; j < quads.length; j += 4) {
        var q0 = quads[j], q1 = quads[j + 1], q2 = quads[j + 2], q3 = quads[j + 3];
        ctx.moveTo(q0.x - 0.6, q0.y - 0.6);
        ctx.lineTo(q1.x + 0.6, q1.y - 0.6);
        ctx.lineTo(q2.x + 0.6, q2.y + 0.6);
        ctx.lineTo(q3.x - 0.6, q3.y + 0.6);
        ctx.closePath();
      }
      ctx.fillStyle = rows[i];
      ctx.fill();
    }

    /* 그림은 색칠 위에 얹는다 — 밑색이 늘 먼저 채워져 있으니 그림이 아직
       안 실려도(첫 프레임) 빈 칸이 되지 않는다 */
    var useAT = autotileOn(se), A2 = useAT ? AT() : null;   // W-0390 이중 격자(가까운 칸)
    for (var ti = 0; ti < texList.length; ti++) {
      if (useAT && texList[ti].step === 1) {
        var e2 = texList[ti], pk = A2.pick(V.tileAt(e2.tx, e2.ty), V.tileAt(e2.tx + 1, e2.ty), V.tileAt(e2.tx, e2.ty + 1), V.tileAt(e2.tx + 1, e2.ty + 1));
        if (pk && drawTileRect(pk.img, pk.sx, pk.sy, pk.sw, pk.sh, project((e2.tx + 0.5) * T, (e2.ty + 0.5) * T), project((e2.tx + 1.5) * T, (e2.ty + 0.5) * T), project((e2.tx + 0.5) * T, (e2.ty + 1.5) * T))) { continue; }
      }
      drawTileTexture(texList[ti].img, texList[ti].a0, texList[ti].a1, texList[ti].a3);
    }

    if (global.DG.cozy2d) { global.DG.cozy2d.ground(ctx, texList, { project: project, T: T, se: se, zoom: ZOOM, tileAt: V.tileAt, tiles: VD.TILES }); }   /* W-0133 풀 결·꽃 점·흙길 가장자리 덧칠, 그 위에 잔디 술 — 세 갈래 짧은 선 */
    if (tufts.length && !(global.DG.cozy2d && global.DG.cozy2d.on())) {   // W-0133 — 켜져 있으면 cozy2d 풀 결이 대신(배율 따라 커진다)
      ctx.strokeStyle = dark(se.grass, 0.22);
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (var k = 0; k < tufts.length; k++) {
        var g = tufts[k], hgt = 6 * ZOOM * g.s;
        ctx.moveTo(g.x - 3 * g.s, g.y); ctx.lineTo(g.x - 4.5 * g.s, g.y - hgt);
        ctx.moveTo(g.x, g.y); ctx.lineTo(g.x, g.y - hgt * 1.25);
        ctx.moveTo(g.x + 3 * g.s, g.y); ctx.lineTo(g.x + 4.5 * g.s, g.y - hgt);
      }
      ctx.stroke();
    }

    /* 물빛 — 짧은 흰 선이 느리게 흔들린다 */
    if (glints.length) {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (var m = 0; m < glints.length; m++) {
        var w = glints[m], ln = 9 * ZOOM * w.p.s;
        var off = Math.sin(now / 900 + w.k) * 3 * ZOOM;
        ctx.moveTo(w.p.x - ln * 0.5 + off, w.p.y);
        ctx.lineTo(w.p.x + ln * 0.5 + off, w.p.y);
      }
      ctx.stroke();
    }
  }

  /* ── 사물 ─────────────────────────────────────────────── */

  function shadow(x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30,40,25,0.20)';
    ctx.fill(); var Co = global.DG.core; if (!(Co && Co.tuned && !+Co.tuned('mode2d.shadow2', 1))) { ctx.beginPath(); ctx.ellipse(x, y, rx * 0.5, Math.max(1, ry * 0.45), 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(20,26,16,0.30)'; ctx.fill(); }   /* W-0368 발 닿는 진한 핵 */
  }

  function drawProp(prop, f, se, now) {
    var def = VD.PROPS[prop.kind]; var PR = PROPS2D();   // R-4 옛 소품 그림(village-props2d.js)
    if (!def) { return; }
    var p = project(prop.x, prop.y);
    if (p.a < -A_MAX) { return; }
    var k = ZOOM * p.s;
    if (p.x < -140 || p.x > W + 140 || p.y < -180 || p.y > H + 180) { return; }

    var spent = V.spent(prop);
    var big = prop.kind === 'shop' || prop.kind === 'school' ||
              prop.kind === 'home' || prop.kind === 'museum' || prop.kind === 'tailor';   var t2 = big && global.DG.mode2d && global.DG.mode2d.hasKind(prop.kind) ? global.DG.cfg.mode2d.prop2d[prop.kind] : null, tagDrop = t2 && t2.top && global.DG.mode2d.spriteReady && global.DG.mode2d.spriteReady(t2.id) ? Math.max(0, 104 - (t2.h * (256 - t2.top) / 256 + 35)) : 0;   // W-0220 그림 위가 빈 건물(서당·사고·침선방)은 이름표를 보이는 지붕 쪽으로 내린다
    /* 바람 — 자리마다 위상을 달리해 한꺼번에 흔들리지 않게 한다 */
    var sway = Math.sin(now / 1350 + prop.x * 0.021 + prop.y * 0.013) * 0.045;

    if (prop.kind === 'home' && global.DG.livestock) { global.DG.livestock.draw2d(ctx, p.x + 84 * k, p.y + 22 * k, k, now); } if (prop.kind === 'plot' && global.DG.crops && global.DG.crops.draw2d(ctx, prop, p.x, p.y, k, now)) { return; }   // W-0299 집 곁 우리 · W-0431 밭
    ctx.save();
    ctx.globalAlpha = spent && !big ? 0.62 : 1;
    if (!(global.DG.mode2d && global.DG.mode2d.drawKind(ctx, prop.kind, p.x, p.y, kindK(prop.kind, k)) && kindOver(prop.kind, p.x, p.y, k, now))) switch (prop.kind) {   // 2D 모드 통일 스프라이트(W-0019) 먼저 — W-0124 가게·집 크기 성장·우체통 깃발은 그 위에도
      case 'tree':    PR.drawTree(p.x, p.y, k, sway, se, !spent); break;
      case 'pine':    PR.drawPine(p.x, p.y, k, sway, se); break;
      case 'rock':    PR.drawRock(p.x, p.y, k, se); break;
      case 'flower':  PR.drawFlower(p.x, p.y, k, sway, se, prop); break;
      case 'sapling': PR.drawSapling(p.x, p.y, k, sway); break;
      case 'spot':    PR.drawSpot(p.x, p.y, k, now); break;
      case 'board':   PR.drawBoard(p.x, p.y, k); break;
      case 'shop':    PR.drawHanok(p.x, p.y,
                        k * (1 + (global.DG.village.shopLevel().n * 0.10)),
                        '#8a5a3c', def.name); break;
      case 'weed':    PR.drawWeed(p.x, p.y, k, prop, sway); break;
      case 'school':  PR.drawHanok(p.x, p.y, k, '#4a6a8a', def.name); break;
      case 'home':    PR.drawMyHouse(p.x, p.y, k); break;
      case 'mail':    drawMailbox(p.x, p.y, k, now); break;
      /* 간판에는 '사고' 만 쓴다 — 한자까지 넣으면 판을 넘친다 (말풍선이 온 이름을 준다) */
      case 'museum':  PR.drawHanok(p.x, p.y, k * 1.22, '#5c5a78', '사고'); break;
      case 'tailor':  PR.drawHanok(p.x, p.y, k * 0.92, '#8a4a6a', '침선방'); break;
      case 'pole':    drawPole(p.x, p.y, k, now); break;
      case 'dig':     PR.drawDig(p.x, p.y, k, spent); break;
      case 'shell':   PR.drawShell(p.x, p.y, k, prop); break;
      default:
        shadow(p.x, p.y + 4 * k, 14 * k, 5 * k);
        ctx.font = Math.round(30 * k) + 'px "Segoe UI Emoji", system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        (global.DG.mode2d || { mark: function (c, s, x, y) { c.fillText(s, x, y); } }).mark(ctx, def.emoji, p.x, p.y + 6 * k);   // W-0350
    }
    ctx.restore();

    /* 낚시 중인 낚시터 — 찌와 입질 (원작에서 찌를 보고 당기는 그 자리) */
    var fs = V.fishState();
    if (fs && fs.propId === prop.id) {
      var bite = fs.state === 'bite';
      PR.drawFloat(p.x, p.y, k, bite, now);
      if (bite) {
        bubble('입질! — 지금 당긴다 [' + core.actHint() + ']', p.x, p.y - 62 * k + Math.sin(now / 90) * 3, '#ff8a4a', '#fff3e6');
      } else {
        bubble('🎣 기다린다…', p.x, p.y - 52 * k, '#2f6f9a', '#eaf6ff');
      }
      return;
    }

    if (f && f.type === 'prop' && f.obj.id === prop.id) {
      ring(p.x, p.y + 3 * k, k, spent ? 'rgba(190,190,190,.55)' : 'rgba(255,206,92,.95)');
      bubble(spent ? def.name + ' (오늘 몫 끝)' : def.name + ' — ' + def.hint + ' [' + core.actHint() + ']',
        p.x, p.y - (big ? 118 - tagDrop : 74) * k, spent ? '#7a7a7a' : '#8a5a10',
        spent ? '#e9e9e9' : '#fff0c9');
    } else if (big) {
      bubble(def.name, p.x, p.y - (104 - tagDrop) * k, '#54402c', '#f7ecd8');
    }
  }

  /* 나무·소나무·바위·꽃·모종·한옥 도형·풀·땅 파기·조개·내 집 그리기는 village-props2d.js(R-4) — drawProp 이 PR.drawX 로 부른다 */
  var propBind = null;
  function PROPS2D() { return global.DG.villageProps2d.use(propBind || (propBind = { shadow: shadow, evTag: evTag }), ctx); }

  /**
   * 우편함 — **안 읽은 편지가 있으면 깃발이 선다.**
   * 원작의 그 빨간 깃발이다. 우편함까지 걸어가 열어 봐야 아는 건 불친절하다.
   */
  function kindK(kind, k) { return kind === 'shop' ? k * (1 + global.DG.village.shopLevel().n * 0.10) : (kind === 'home' && global.DG.home ? k * (1 + global.DG.home.state().tier * 0.12) : k); }   // W-0124 통일 스프라이트가 그려지면 switch 를 건너뛰어 가게 크기 성장·집 등급·편지 깃발이 사라졌다(d59440063)
  function kindOver(kind, x, y, k, now) { if (kind === 'mail') { mailFlag(x, y, k, now, global.DG.mail ? global.DG.mail.unread() : 0); } if (global.DG.cozy2d) { global.DG.cozy2d.lit(kind, x, y, kindK(kind, k)); } return true; }   // W-0142 밤 창·등불 자리를 빛 목록에
  function drawMailbox(x, y, k, now) {
    var n = global.DG.mail ? global.DG.mail.unread() : 0;
    shadow(x, y + 2 * k, 10 * k, 4 * k);
    ctx.fillStyle = '#6f4e30'; ctx.fillRect(x - 2.5 * k, y - 22 * k, 5 * k, 22 * k);   // 기둥
    ctx.fillStyle = '#c8503c';                     // 함
    ctx.beginPath();
    ctx.moveTo(x - 10 * k, y - 22 * k);
    ctx.lineTo(x - 10 * k, y - 32 * k);
    ctx.quadraticCurveTo(x, y - 40 * k, x + 10 * k, y - 32 * k);
    ctx.lineTo(x + 10 * k, y - 22 * k);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.20)'; ctx.fillRect(x - 10 * k, y - 33 * k, 20 * k, 2.6 * k);
    ctx.fillStyle = '#f4ecd8'; ctx.fillRect(x - 5 * k, y - 28 * k, 10 * k, 2.6 * k);   // 투입구
    mailFlag(x, y, k, now, n);
  }
  function mailFlag(x, y, k, now, n) {
    if (n > 0) {                                   // 깃발 — 살짝 흔들린다
      var w = Math.sin(now / 320) * 1.6 * k;
      ctx.strokeStyle = '#8a6440'; ctx.lineWidth = 1.8 * k;
      ctx.beginPath();
      ctx.moveTo(x + 11 * k, y - 22 * k);
      ctx.lineTo(x + 11 * k, y - 42 * k);
      ctx.stroke();
      ctx.fillStyle = '#e8b23a';
      ctx.beginPath();
      ctx.moveTo(x + 11 * k, y - 42 * k);
      ctx.lineTo(x + 23 * k + w, y - 38 * k);
      ctx.lineTo(x + 11 * k, y - 33 * k);
      ctx.closePath();
      ctx.fill();
      bubble('편지 ' + n + '통', x, y - 54 * k, '#8a2020', '#ffe9e2');
    }
  }

