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
      cam2 = C2.register('village', { store: 'yeoksa-village/save/cam2d', min: 0.5, max: 1.6, def: 0.7, defPhone: 0.5, onChange: function () { resize(); } });
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
  /** W-0500 ③ 평면 탑다운(구면 걷음)(사용자 10-31). 손잡이 village.flat2d 0 = 옛 구면 */ function flat() { return +core.tuned('village.flat2d', 1) > 0; }
  function project(wx, wy) {
    var dy = wy - cam.y;
    var a = dy / R;
    if (a > 1.2) { a = 1.2; }
    if (flat()) { return { x: CX + (wx - cam.x) * ZOOM, y: CY + dy * ZOOM * TILT, s: 1, a: a }; }
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
    if (flat()) { return { x: cam.x + (sx - CX) / ZOOM, y: cam.y + (sy - CY) / (ZOOM * TILT) }; }
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
    if (!flat()) { drawSky(ph, se, now); drawFarShore(ph, se); }   // W-0500 ③ 평면은 지평선·하늘 띠 없음 — 땅이 화면을 다 덮는다
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
  function autotileOn(se) { var C = global.DG.core, A = AT(); return !!(A && !(C && C.tuned && !+C.tuned('village.autotile', 1)) && !(se && se.key === 'winter') && !(global.DG.cozy2d && global.DG.cozy2d.real && global.DG.cozy2d.real()) && A.ready()); }   // 10-26 실사 땅이면 꽃 무늬 아틀라스 안 씀
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
    var Z2r = global.DG.cozy2d && global.DG.cozy2d.real && global.DG.cozy2d.real();   // 10-26 실사 땅 — 덧씌움(overlay 0.6)이면 결이 씻겨 단색이 된다 → 그림 그대로
    ctx.globalCompositeOperation = Z2r ? 'source-over' : 'overlay';
    ctx.globalAlpha = Z2r ? 1 : 0.6;
    ctx.imageSmoothingEnabled = !!Z2r;
    ctx.transform((a1.x - a0.x) / iw, (a1.y - a0.y) / iw,
                  (a3.x - a0.x) / ih, (a3.y - a0.y) / ih,
                  a0.x, a0.y);
    var ov = Z2r ? iw * 0.03 : 0; ctx.drawImage(img, -ov, -ov, iw + ov * 2, ih + ov * 2);   // 실사 땅은 이웃 칸과 3% 겹쳐 틈(밑색 줄)을 막는다
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
      var sMid = flat() ? 1 : 1 / (1 - core.clamp(midA, -2, 1.2) * 0.40);
      if (sMid < 0.42) { sMid = 0.42; }
      var half = (W * 0.5 + T * 2) / (ZOOM * sMid);
      var tx0 = Math.floor((cam.x - half) / T) - 1;
      var tx1 = Math.floor((cam.x + half) / T) + 1;
      /* 먼 줄은 몇 픽셀로 뭉개진다 — 두 칸씩 건너뛰어도 눈에 띄지 않는다 */
      var step = midA < -0.85 && !flat() ? 2 : 1;

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

  /** 건물 발치 마름모 접지 그림자(그림 폭 w ≈ 높이 bh, 아랫 꼭지 (x, y), 오른쪽 아래로 살짝) */
  function groundDiamond(x, y, bh) { var w = bh * 0.97, hw = w * 0.52, dl = w * 0.29, dr = w * 0.26, i, e, ox, oy; for (i = 0; i < 2; i++) { e = i ? 0 : w * 0.07; ox = w * 0.035 + e * 0.3; oy = w * 0.012 + e * 0.5; ctx.beginPath(); ctx.moveTo(x + ox, y + oy + e * 0.6); ctx.lineTo(x - hw - e + ox, y - dl + oy); ctx.lineTo(x + ox, y - dl - dr + oy - e * 0.2); ctx.lineTo(x + hw + e + ox, y - dr + oy); ctx.closePath(); ctx.fillStyle = i ? 'rgba(14,18,10,0.30)' : 'rgba(20,26,16,0.14)'; ctx.fill(); } }
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
    var gy = 0, gnd = t2 && global.DG.mode2d.spriteReady(t2.id) && +global.DG.core.tuned('fs.ground2d', 1) > 0, bh = gnd ? (t2.h || 74) * kindK(prop.kind, k) : 0; if (gnd) { gy = bh * 0.03; groundDiamond(p.x, p.y + gy, bh); }   /* 집이 떠 보인다(사용자 10-29) — 건물 그림은 마름모 발치라 둥근 타원 그림자 대신 마름모 접지 그림자, 그림을 3% 가라앉힌다(fs.ground2d 0 = 옛) */
    if (!(global.DG.mode2d && (gnd ? global.DG.mode2d.drawSprite(ctx, { id: t2.id, x: p.x, y: p.y + gy, h: bh, shadow: false }) : global.DG.mode2d.drawKind(ctx, prop.kind, p.x, p.y, kindK(prop.kind, k))) && kindOver(prop.kind, p.x, p.y, k, now))) switch (prop.kind) {   // 2D 모드 통일 스프라이트(W-0019) 먼저 — W-0124 가게·집 크기 성장·우체통 깃발은 그 위에도
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

  /* ── 사람 ─────────────────────────────────────────────── */

  function drawResident(res, f, now) {
    var p = project(res.x, res.y);
    if (p.a < -A_MAX) { return; }
    if (p.x < -120 || p.x > W + 120 || p.y < -140 || p.y > H + 140) { return; }
    var k = ZOOM * p.s;
    var s = global.DG.village.state();
    var req = s.requests[res.id];

    shadow(p.x, p.y + 2 * k, 13 * k, 4.6 * k);
    if (!(global.DG.actor2d && global.DG.actor2d.draw(ctx, 'adult', res.ref, null, p.x, p.y, 0.92 * k, { facing: res.facing, moving: false, now: now }))) global.DG.sprite.stamp(ctx, {
      kind: 'human', ref: res.ref, x: p.x, y: p.y, s: 0.92 * k,
      facing: res.facing, phase: 0, walking: false,
      color: global.DG.data.faction(res.ref.faction).color,
      look: global.DG.sprite.lookOf(res.ref),
      rarity: res.ref.rarity, t: now
    });

    var pending = !(req && req.done);
    /* 저희끼리 말을 주고받는 중이면 **그 말**을 띄운다 — 이름은 그 아래로 내린다.
       마을이 살아 있다고 느껴지는 것은 이 한 줄에서 온다 */
    var line = global.DG.folk ? global.DG.folk.lineOf(res.id) : null;
    if (line) {
      bubble(line, p.x, p.y - 82 * k, '#2f3a46', '#fffdf4');
      bubble(res.ref.name, p.x, p.y - 60 * k, '#5a6472', '#f2f4f8');
    } else {
      bubble(res.ref.name, p.x, p.y - 62 * k, '#3c4450', '#ffffff');
    }
    if (pending && !line) { mark(p.x + 26 * k, p.y - 70 * k, k, now); }
    if (f && f.type === 'resident' && f.obj.id === res.id) {
      ring(p.x, p.y + 2 * k, k, 'rgba(120,205,255,.95)');
      bubble('말을 건다 [' + core.actHint() + ']', p.x, p.y - 84 * k, '#0d5b86', '#e6f5ff');
    }
  }

  /**
   * 지금 내 모습 — **침선방에서 고른 차림을 입힌다.**
   * 스탬프 캐시가 `ref.id` 로만 갈리므로 **차림표를 붙인 가짜 id** 를 넘긴다.
   * 안 그러면 갈아입어도 옛 그림이 그대로 나온다 (실제로 그랬다).
   */
  function meStamp() {
    var lead = core.save.party[0];
    var ref = lead ? global.DG.data.find(lead) : null;
    if (!ref) { ref = global.DG.data.heroes[0]; }
    var W2 = global.DG.wear;
    var look = global.DG.sprite.lookOf(ref);
    var color = global.DG.data.faction(ref.faction).color;
    if (!W2) { return { ref: ref, look: look, color: color }; }
    return {
      ref: { id: ref.id + '#' + W2.sig(), rarity: ref.rarity },
      look: W2.applyLook(look),
      color: W2.color(color),
      rarity: ref.rarity
    };
  }

  function drawMe(p0, now) {
    var p = project(p0.x, p0.y);
    var k = ZOOM * p.s;
    var me = meStamp();
    shadow(p.x, p.y + 2 * k, 14 * k, 5 * k);
    var MTd = global.DG.mount, mtd = MTd && MTd.active && MTd.active() ? MTd.current() : null, lift = 0;   // 탈것(mount.js) — 2D 는 이모지로
    if (mtd) {
      lift = 16 * k + (MTd.isFly(mtd) ? 12 * k + Math.sin(now / 240) * 2 * k : 0);
      ctx.font = Math.round(34 * k) + 'px "Segoe UI Emoji", system-ui'; ctx.textAlign = 'center';
      ctx.fillText(mtd.emoji, p.x, p.y - (MTd.isFly(mtd) ? 12 * k : 0) + 2 * k);
    }
    if (!(global.DG.actor2d && global.DG.actor2d.draw(ctx, 'me', me.ref, 'me', p.x, p.y - lift, 1 * k, { facing: p0.facing, dirX: p0.dirX, dirY: p0.dirY, moving: p0.walking, phase: p0.phase, now: now, wx: p0.x, wy: p0.y, ppu: k, pk: 'me' }))) global.DG.sprite.stamp(ctx, {
      kind: 'human', ref: me.ref, x: p.x, y: p.y - lift, s: 1 * k,
      facing: p0.facing, phase: p0.phase, walking: p0.walking,
      color: me.color, look: me.look,
      rarity: me.rarity, t: now
    });
    /* 살금살금 — 발밑에 발자국을 띄운다. 켜져 있는지 눈으로 알아야 한다 */
    if (V.sneaking()) {
      ctx.save();
      ctx.globalAlpha = 0.75 + Math.sin(now / 420) * 0.2;
      ctx.font = Math.round(15 * k) + 'px "Segoe UI Emoji", system-ui';
      ctx.textAlign = 'center';
      (global.DG.mode2d || { mark: function (c, s, x, y) { c.fillText(s, x, y); } }).mark(ctx, '🐾', p.x - 22 * k, p.y + 6 * k);   // W-0350
      ctx.restore();
    }
  }

  /** 부탁이 있는 주민 머리 위 — 통통 튀는 느낌표 */
  function mark(x, y, k, now) {
    var bob = Math.sin(now / 260) * 3 * k;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y + bob, 9 * k, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd24a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,0,0.5)';
    ctx.lineWidth = 1.4 * k;
    ctx.stroke();
    ctx.fillStyle = '#7a4a00';
    ctx.font = '900 ' + Math.round(13 * k) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', x, y + bob + 0.5 * k);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  /** 발밑 고리 — 손이 닿는 것 표시 */
  function ring(x, y, k, color) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, 24 * k, 9 * k, 0, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6 * k;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 말풍선 — 원작의 그 둥근 이름표.
   * 화면에 글자를 그냥 얹지 않는다. 흰 판에 얹고 아래에 꼬리를 단다.
   */
  /* W-0144 — 말풍선 겹침 풀기(순수). rects = 이 프레임에 이미 그린 자리(draw() 첫머리에서 비움). 겹치면 위로 h+2 씩 넷째 자리까지(W-0205, 옛 셋 — 둘째 단 넘게 밀리면 머리와 가는 선),
     그래도 겹치면 null(숨김) — 행동 안내(keep, 글에 [키])는 안 숨기고 마지막 자리에 */
  var bubbleRects = [];
  function bubbleSlot(rects, x, y, w, h, keep) {
    for (var s = 0, ny; s < 4; s++) { ny = y - s * (h + 2); if (!rects.some(function (q) { return Math.abs(q.x - x) * 2 < q.w + w && Math.abs(q.y - ny) < h; })) { rects.push({ x: x, y: ny, w: w }); return ny; } }
    return keep ? (rects.push({ x: x, y: ny, w: w }), ny) : null;
  }
  function bubble(text, x, y, fg, bg) {
    ctx.save();
    ctx.font = '700 12.5px "Malgun Gothic", system-ui';
    var w = ctx.measureText(text).width + 18;
    var h = 21, rr = h * 0.5;
    var y0 = y; y = bubbleSlot(bubbleRects, x, y, w, h + 6, String(text).indexOf('[') >= 0);
    if (y === null) { ctx.restore(); return; }
    var l = x - w * 0.5, t = y - h * 0.5;
    ctx.beginPath();
    ctx.moveTo(l + rr, t); ctx.lineTo(l + w - rr, t); ctx.quadraticCurveTo(l + w, t, l + w, t + rr); ctx.lineTo(l + w, t + h - rr);
    ctx.quadraticCurveTo(l + w, t + h, l + w - rr, t + h); ctx.lineTo(x + 5, t + h); ctx.lineTo(x, t + h + 6); ctx.lineTo(x - 5, t + h);
    ctx.lineTo(l + rr, t + h); ctx.quadraticCurveTo(l, t + h, l, t + h - rr); ctx.lineTo(l, t + rr); ctx.quadraticCurveTo(l, t, l + rr, t);
    ctx.closePath();

    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.save(); ctx.translate(0, 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = bg || '#ffffff';
    ctx.fill();

    ctx.fillStyle = fg || '#39414c'; if (y !== null && y0 - y > 2 * (h + 8) - 1) { ctx.save(); ctx.strokeStyle = 'rgba(57,65,76,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, t + h + 6); ctx.lineTo(x, y0 + h * 0.5); ctx.stroke(); ctx.restore(); }   // W-0205 많이 밀린 말풍선은 원래 자리(머리)와 잇는다
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }

  /* ── 날씨 ─────────────────────────────────────────────────
   * 겨울엔 눈, 봄엔 꽃잎이 흩날린다. 자리는 해시로 고정하고 시간만 흘린다 —
   * 매 프레임 새로 뽑으면 깜박인다.
   */
  /**
   * 하늘에서 내리는 것 — **계절이 아니라 날씨를 본다.**
   * 겨울이라고 늘 눈이 오지 않는다. 그게 맞고, 그래야 눈 오는 날이 반갑다.
   * 봄의 꽃잎과 삼짇날의 꽃보라만 계절·행사를 탄다.
   */
  function drawWeather(se, now) {
    var wx = wxKey();
    var blossom = evTag() === 'blossom';

    if (wx === 'rain') { drawRain(now); }
    if (wx === 'cloud' || wx === 'rain' || wx === 'snow') {
      ctx.fillStyle = wx === 'rain' ? 'rgba(52,62,84,0.24)'
                    : wx === 'snow' ? 'rgba(180,196,216,0.16)'
                    : 'rgba(90,100,118,0.13)';
      ctx.fillRect(0, 0, W, H);
    }

    var snow = wx === 'snow';
    var petal = blossom || (se.key === 'spring' && wx !== 'rain');
    if (!snow && !petal) { return; }
    var n = snow ? 54 : blossom ? 62 : 34;
    ctx.save();
    ctx.fillStyle = snow ? 'rgba(255,255,255,0.86)' : 'rgba(248,190,214,0.80)';
    for (var i = 0; i < n; i++) {
      var sp = 0.4 + core.hash2(i * 3 + 1, 5) * 0.8;
      var t = ((now / (snow ? 9000 : 7000)) * sp + core.hash2(i, 17)) % 1;
      var x = (core.hash2(7, i * 11) * W + Math.sin(now / 1400 + i) * 26 + W) % W;
      var y = t * (H + 40) - 20;
      var r = (snow ? 1.6 : 2.2) + core.hash2(i * 5, i) * 1.6;
      ctx.beginPath();
      if (snow) { ctx.arc(x, y, r, 0, Math.PI * 2); }
      else { ctx.ellipse(x, y, r, r * 0.6, now / 700 + i, 0, Math.PI * 2); }
      ctx.fill();
    }
    ctx.restore();
  }

  /** 비 — 기운 빗줄기와 땅에 튀는 자국 */
  function drawRain(now) {
    var n = 110, i;
    ctx.save();
    ctx.strokeStyle = 'rgba(200,220,240,0.55)';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (i = 0; i < n; i++) {
      var sp = 0.7 + core.hash2(i * 5 + 2, 9) * 0.6;
      var t = ((now / 900) * sp + core.hash2(i, 23)) % 1;
      var x = core.hash2(11, i * 7) * (W + 160) - 80 + t * 90;
      var y = t * (H + 60) - 30;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 9, y + 22);
    }
    ctx.stroke();
    /* 땅에 튀는 자국 — 몇 개만. 많으면 지저분해진다 */
    ctx.strokeStyle = 'rgba(220,238,255,0.40)';
    ctx.lineWidth = 1.1;
    for (i = 0; i < 22; i++) {
      var pt = ((now / 620) + core.hash2(i * 3, 31)) % 1;
      var px = core.hash2(5, i * 13) * W;
      var py = core.hash2(i * 17, 3) * H * 0.7 + H * 0.28;
      ctx.beginPath();
      ctx.ellipse(px, py, 3 + pt * 11, (3 + pt * 11) * 0.34, 0, 0, Math.PI * 2);
      ctx.globalAlpha = Math.max(0, 1 - pt) * 0.7;
      ctx.stroke();
    }
    ctx.restore();
  }


  /* ── 짐승(PLAN 40절 PHASE 4 첫 칸, PLAN 16절) ────────────────────
   * 3D 는 asset3d.js 에 등록된 실제 모델(사슴·여우·늑대·토끼·다람쥐·오리·새·
   * 개구리·뱀)이 선다. 2D 는 2026-09-10까지 emoji 뿐이었다 — 사슴·여우·
   * 다람쥐·개구리·새 다섯은 OpenGameArt "Seasons of Forest Animal Pack"
   * (CC0, `assets/sprites2d/animals/`, `ASSET_LICENSES.md` 참고)의 실제
   * 4방향 idle/run 그림으로 바꿨다. 원본은 앞/뒤 방향도 있지만 이 게임은
   * 좌/우(facing -1/1)만 추적하므로 그 둘만 골라 담았다(ANIMAL_SPRITE 표).
   * 나머지 넷(늑대·토끼·오리·뱀)은 맞는 CC0 를 못 찾아 emoji 였다 — 2026-09-25 부터 3D 에 서는 **그 모델**을 옆에서 구운
   * 같은 모양 시트(`tools/bake-portraits/bake.mjs saga-forest --sprites=animals`, 컷 44×36). 정지 모델(토끼·오리)은 달리기 줄이
   * 깡충 뛰는 높이 차다. 희귀 괴물 둘(포자괴물·성간충)도 같은 길. ANIMAL_SPRITE 에 없는 kind 만 emoji 로 떨어진다.
   */
  var ANIMAL_SPRITE = {
    deer:     { w: 41, h: 33, idleFrames: 4, runFrames: 4, idleMs: 300, runMs: 150 },
    fox:      { w: 35, h: 32, idleFrames: 4, runFrames: 4, idleMs: 300, runMs: 150 },
    squirrel: { w: 30, h: 28, idleFrames: 4, runFrames: 4, idleMs: 300, runMs: 150 },
    frog:     { w: 24, h: 21, idleFrames: 2, runFrames: 4, idleMs: 600, runMs: 150 },
    bird:     { w: 28, h: 24, idleFrames: 4, runFrames: 4, idleMs: 300, runMs: 150 },
    wolf:     { w: 44, h: 36, idleFrames: 4, runFrames: 4, idleMs: 300, runMs: 150 },
    rabbit:   { w: 44, h: 36, idleFrames: 1, runFrames: 4, idleMs: 300, runMs: 120 },
    duck:     { w: 44, h: 36, idleFrames: 1, runFrames: 4, idleMs: 300, runMs: 150 },
    snake:    { w: 44, h: 36, idleFrames: 4, runFrames: 4, idleMs: 300, runMs: 170 },
    mushnub:  { w: 44, h: 36, idleFrames: 1, runFrames: 4, idleMs: 300, runMs: 150 },   // 희귀 괴물 둘 — 3D 의 monster:<종류>
    spacebug: { w: 44, h: 36, idleFrames: 4, runFrames: 4, idleMs: 300, runMs: 150 }
  };
  var animalImgCache = {};
  function animalImg(kind) {
    var im = animalImgCache[kind];
    if (!im) {
      im = new Image();
      im.src = 'assets/sprites2d/animals/' + kind + '.png';
      animalImgCache[kind] = im;
    }
    return im;
  }
  var ANIMAL_DISPLAY_H = 30;   // emoji 글자 높이(27px)와 맞춘 눈대중 값

  function drawAnimal(a, now) {
    var def = VD.ANIMALS[a.kind];
    if (!def) { return; }
    var p = project(a.x, a.y);
    if (p.a < -A_MAX) { return; }
    if (p.x < -100 || p.x > W + 100 || p.y < -140 || p.y > H + 140) { return; }
    var k = ZOOM * p.s;
    shadow(p.x, p.y + 4 * k, 11 * k, 4 * k);
    ctx.save();
    if (a.state === 'flee') { ctx.globalAlpha = 0.85; }

    var sp = ANIMAL_SPRITE[a.kind];
    var img = sp && animalImg(a.kind);
    if (sp && img.complete && img.naturalWidth) {
      var moving = a.state === 'wander' || a.state === 'flee';
      var right = a.facing >= 0;
      var row = moving ? (right ? 3 : 2) : (right ? 1 : 0);
      var frames = moving ? sp.runFrames : sp.idleFrames;
      var ms = moving ? sp.runMs : sp.idleMs;
      var frame = Math.floor(now / ms) % frames;
      var dh = ANIMAL_DISPLAY_H * k, dw = dh * (sp.w / sp.h);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, frame * sp.w, row * sp.h, sp.w, sp.h,
        p.x - dw / 2, p.y + 7 * k - dh, dw, dh);
    } else {
      ctx.font = Math.round(27 * k) + 'px "Segoe UI Emoji", system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.translate(p.x, 0);
      ctx.scale(a.facing < 0 ? -1 : 1, 1);
      ctx.fillText(def.emoji, 0, p.y + 7 * k);
    }
    ctx.restore();
  }

  /* ── 숲 NPC(PLAN 40절 PHASE 4 NPC 칸) ────────────────────────
   * 아직 말을 걸 수는 없다(Interaction·Quest 몫) — 가까이 가면 인사말
   * 한 줄이 뜬다. residents 처럼 이름표는 늘 띄운다.
   */
  var NPC_TALK_DIST = 130;
  function drawNpc(n, f, now) {
    var def = n.def || VD.NPCS[n.kind];
    if (!def) { return; }
    var p = project(n.x, n.y);
    if (p.a < -A_MAX) { return; }
    if (p.x < -120 || p.x > W + 120 || p.y < -140 || p.y > H + 140) { return; }
    var k = ZOOM * p.s;
    shadow(p.x, p.y + 3 * k, 12 * k, 4.4 * k);
    /* 방문객 몸짓(§5.10) — 곁에 서면 나를 본다, 부탁을 다 들어준 날은 깡충 춤 */
    var raw0 = V.raw(), gNear = n.gesture && Math.hypot(raw0.player.x - n.x, raw0.player.y - n.y) < NPC_TALK_DIST * 1.6;
    var hop = n.gesture === 'dance' ? Math.abs(Math.sin(now / 170)) * 7 * k : 0;
    var face = gNear ? (raw0.player.x < n.x ? -1 : 1) : (n.gesture === 'dance' ? (Math.sin(now / 700) < 0 ? -1 : 1) :
      (n.faceX !== undefined ? (n.faceX < n.x ? -1 : 1) : n.facing));
    /* 2026-09-10 — 이모지 대신 residents 와 같은 사람 스탬프(Kenney CC0,
       sprite.js 의 stamp())를 쓴다. HEROES 로스터를 안 물리려고 ref 를
       {id:'npc_'+kind} 만 준다 — humanIndexOf() 가 이 문자열을 해시해
       14종 중 하나를 고정으로 고른다(같은 NPC는 늘 같은 얼굴) */
    if (!(global.DG.actor2d && global.DG.actor2d.draw(ctx, n.kid ? 'kid' : 'adult', { id: n.id }, null, p.x, p.y - hop, (n.kid ? 0.62 : 0.86) * k, { facing: face, moving: n.gesture === 'dance', now: now }))) global.DG.sprite.stamp(ctx, {
      kind: 'human', ref: { id: n.id }, x: p.x, y: p.y - hop, s: (n.kid ? 0.62 : 0.86) * k,
      facing: face, phase: 0, walking: n.gesture === 'dance', t: now
    });
    if (gNear && n.gesture === 'wave') {
      ctx.font = Math.round(15 * k) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👋', p.x + face * 14 * k, p.y - 44 * k + Math.sin(now / 120) * 3 * k);
      ctx.textAlign = 'left';
    }

    var raw = V.raw();
    var near = Math.hypot(raw.player.x - n.x, raw.player.y - n.y) < NPC_TALK_DIST;
    var focused = f && f.type === 'npc' && f.obj.id === n.id;
    if (focused) {
      ring(p.x, p.y + 3 * k, k, 'rgba(120,205,255,.95)');
      bubble('말을 건다 [' + core.actHint() + ']', p.x, p.y - 82 * k, '#0d5b86', '#e6f5ff');
      bubble(def.name, p.x, p.y - 60 * k, '#5a6472', '#f2f4f8');
    } else if (near) {
      bubble(n.chat && n.x <= n.faceX ? n.chat : (n.chat ? '…' : def.line), p.x, p.y - 82 * k, '#2f3a46', '#fffdf4');
      bubble(def.name, p.x, p.y - 60 * k, '#5a6472', '#f2f4f8');
    } else {
      bubble(def.name, p.x, p.y - 62 * k, '#3c4450', '#ffffff');
    }
  }

  /* ── 곤충 ─────────────────────────────────────────────────
   * 사물과 달리 살아 움직인다. 나는 것은 땅에서 떠 있고 그림자가 옅다.
   * 반딧불이는 **밤에 빛난다** — 그 하나 때문에 시간대가 놀이가 된다.
   */
  function drawBug(b, f, ph, now) {
    var p = project(b.x, b.y);
    if (p.a < -A_MAX) { return; }
    if (p.x < -80 || p.x > W + 80 || p.y < -80 || p.y > H + 80) { return; }
    var k = ZOOM * p.s;
    var ref = b.ref;
    var flies = ref.form === 'butterfly' || ref.form === 'dragonfly' || ref.form === 'firefly';
    var hover = flies ? -15 * k + Math.sin(now / 230 + b.wob) * 4 * k : 0;
    var cx = p.x, cy = p.y + hover;

    if (!flies && !b.perch) {
      shadow(cx, p.y + 1 * k, 6 * k, 2.4 * k);
    } else if (flies) {
      ctx.save(); ctx.globalAlpha = 0.5;
      shadow(cx, p.y + 1 * k, 4 * k, 1.6 * k);
      ctx.restore();
    }

    ctx.save();
    if (b.state === 'flee') { ctx.globalAlpha = 0.75; }
    global.DG.bugPaint.paint(ctx, ref.form, cx, cy, k, ref, b, ph, now);   // 몸 그리기 열 가지는 bug-paint.js(R-4)
    ctx.restore();

    if (b.chase) {
      bubble('벌떼! 달아나거나 ' + core.actHint() + ' 로 받아친다', cx, cy - 36 * k, '#8a2020', '#ffe2e2');
    } else if (f && f.type === 'bug' && f.obj === b) {
      var net = global.DG.bug.hasNet() || !!(global.DG.workshop && global.DG.workshop.noTool());   // 솜씨도 맨손(W-0184)
      ring(cx, p.y + 2 * k, k * 0.8, net ? 'rgba(255,240,150,.95)' : 'rgba(220,120,120,.9)');
      bubble(net ? ref.name + ' — 휘두른다 [' + core.actHint() + ']' : '🥅 잠자리채가 없다 (전방)',
        cx, cy - 34 * k, net ? '#6a5200' : '#8a2020', net ? '#fff6cc' : '#ffe2e2');
    } else if (b.state === 'flee') {
      bubble('달아난다!', cx, cy - 30 * k, '#8a2020', '#ffe2e2');
    }
  }


  /* ── 집 안 ────────────────────────────────────────────────
   * 마을과 **아주 다른 장면**이다. 하늘도 계절도 없고, 무엇보다 **휘지 않는다** —
   * 방은 평평한 3/4 시점이다. 원작도 그렇고, 그 차이가 "안에 들어왔다" 를 만든다.
   *
   * 방 전체가 늘 한 화면에 들어온다(카메라가 따라다니지 않는다). 그래서 어디에
   * 무엇을 놓을지 한눈에 보인다 — 꾸미는 놀이는 그게 있어야 성립한다.
   */
  var IN_TILT = 0.60;          // 실내의 내려다보는 각
  var IN_WALL = 118;           // 뒷벽 높이 (방 단위)
  var inSc = 1, inOx = 0, inOy = 0;

  function projIn(wx, wy) {
    return { x: inOx + wx * inSc, y: inOy + wy * IN_TILT * inSc };
  }
  function unprojIn(sx, sy) {
    return { x: (sx - inOx) / inSc, y: (sy - inOy) / (IN_TILT * inSc) };
  }

  function setupIn(rm) {
    var pad = 34;
    var sc = Math.min((W - pad * 2) / rm.w,
                      (H - pad * 2 - 80) / (IN_WALL + rm.h * IN_TILT));
    inSc = core.clamp(sc, 0.4, 3.2);
    inOx = (W - rm.w * inSc) * 0.5;
    inOy = (H - (rm.h * IN_TILT * inSc + IN_WALL * inSc)) * 0.5 + IN_WALL * inSc - 8;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawHomeScene(p, ph, now) {
    var Hm = global.DG.home;
    var rm = Hm.room();
    setupIn(rm);
    var u = inSc;
    var fw = rm.w * u, fh = rm.h * IN_TILT * u, wh = IN_WALL * u;
    var top = inOy - wh, T = V.TILE;

    /* 방 바깥 — 어스름한 마루 밑. 방이 화면 한가운데 떠 보이게 한다 */
    ctx.fillStyle = '#211a15';
    ctx.fillRect(0, 0, W, H);

    var wl = Hm.wallNow(), fl = Hm.floorNow();

    /* 뒷벽 — 고른 벽지에 나무 기둥 */
    ctx.fillStyle = wl.c;
    ctx.fillRect(inOx, top, fw, wh);
    var g = ctx.createLinearGradient(0, top, 0, top + wh);
    g.addColorStop(0, 'rgba(0,0,0,0.10)');
    g.addColorStop(0.6, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(inOx, top, fw, wh);

    ctx.fillStyle = wl.trim;                       // 위 도리와 아래 인방
    ctx.fillRect(inOx, top, fw, 9 * u);
    ctx.fillRect(inOx, inOy - 7 * u, fw, 7 * u);
    ctx.fillRect(inOx, top, 8 * u, wh);            // 좌우 기둥
    ctx.fillRect(inOx + fw - 8 * u, top, 8 * u, wh);

    /* 창 둘 — 문 좌우로 */
    var dr = Hm.door();
    var dx = inOx + dr.x * u;
    window_(dx - fw * 0.30, top + wh * 0.32, 42 * u, 30 * u);
    window_(dx + fw * 0.30, top + wh * 0.32, 42 * u, 30 * u);

    /* 문 — 미닫이 두 짝. 여기서 손을 쓰면 밖으로 나간다 */
    var dw = 62 * u, dh = wh * 0.66;
    var dtop = inOy - dh - 5 * u;
    ctx.fillStyle = wl.trim;
    ctx.fillRect(dx - dw * 0.5 - 3 * u, dtop - 3 * u, dw + 6 * u, dh + 6 * u);
    for (var s2 = 0; s2 < 2; s2++) {
      var px = dx - dw * 0.5 + s2 * dw * 0.5;
      ctx.fillStyle = '#f6efdd';
      ctx.fillRect(px, dtop, dw * 0.5, dh);
      ctx.strokeStyle = 'rgba(120,90,60,0.5)';
      ctx.lineWidth = 1.1 * u;
      for (var gx = 1; gx < 3; gx++) {
        ctx.beginPath();
        ctx.moveTo(px + (dw * 0.5 / 3) * gx, dtop);
        ctx.lineTo(px + (dw * 0.5 / 3) * gx, dtop + dh);
        ctx.stroke();
      }
      for (var gy = 1; gy < 4; gy++) {
        ctx.beginPath();
        ctx.moveTo(px, dtop + (dh / 4) * gy);
        ctx.lineTo(px + dw * 0.5, dtop + (dh / 4) * gy);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#6f4e30';
    ctx.fillRect(dx - 1.5 * u, dtop + dh * 0.42, 3 * u, dh * 0.18);

    /* 바닥 — 고른 장판. 칸 금은 아주 옅게 남긴다 (어디 놓을지 눈으로 재야 한다) */
    ctx.fillStyle = fl.a;
    ctx.fillRect(inOx, inOy, fw, fh);
    var ty;
    for (ty = 0; ty < rm.th; ty++) {
      if (ty % 2) { continue; }
      ctx.fillStyle = fl.b;
      ctx.fillRect(inOx, inOy + ty * T * IN_TILT * u, fw, T * IN_TILT * u);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 1;
    for (var tx = 1; tx < rm.tw; tx++) {
      ctx.beginPath();
      ctx.moveTo(inOx + tx * T * u, inOy);
      ctx.lineTo(inOx + tx * T * u, inOy + fh);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.16)';            // 벽 밑 그늘
    ctx.fillRect(inOx, inOy, fw, 5 * u);

    /* 놓인 것과 사람 — 방 좌표의 y 순서로 */
    var items = Hm.state().items;
    var order = [], i;
    for (i = 0; i < items.length; i++) { order.push({ y: items[i].y, t: 'f', o: items[i] }); }
    order.push({ y: p.y, t: 'me', o: p }); if (global.DG.partner && global.DG.partner.homeSpot()) { order.push({ y: global.DG.partner.homeSpot().y, t: 'pt', o: null }); }   // W-0288 동반자
    order.sort(function (a, b) { return a.y - b.y; });

    var f = V.focus();
    for (i = 0; i < order.length; i++) {
      if (order[i].t === 'f') { drawFurn(order[i].o, f, now); }
      else if (order[i].t === 'pt') { global.DG.partner.drawIn(ctx, projIn, inSc, now, shadow, bubble); }   // W-0288
      else { drawMeIn(order[i].o, now); }
    }

    /* 놓을 자리 — 지금 선 칸을 옅게 그려 준다 (심기와 같은 규칙이라 눈으로 보여야 한다) */
    var can = Hm.canPlaceHere();
    var ctx0 = Math.floor(p.x / T) * T, cty0 = Math.floor(p.y / T) * T;
    var a0 = projIn(ctx0, cty0), a1 = projIn(ctx0 + T, cty0 + T);
    ctx.strokeStyle = can.ok ? 'rgba(255,225,130,0.85)' : 'rgba(220,120,120,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(a0.x + 2, a0.y + 2, a1.x - a0.x - 4, a1.y - a0.y - 4);

    /* 문 앞에 서면 안내 */
    if (f && f.type === 'door') {
      bubble('밖으로 나간다 [' + core.actHint() + ']', dx, dtop - 14 * u, '#54402c', '#f7ecd8');
    }

    /* 시간대 빛 — 방 안에서도 밤은 밤이다. 등잔·화로가 있으면 그 언저리만 따뜻하다 */
    if (ph.light !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = ph.light;
      ctx.fillRect(0, 0, W, H);
      for (i = 0; i < items.length; i++) {
        var fd = VD.furn(items[i].key);
        if (!fd || (fd.form !== 'lamp' && fd.form !== 'brazier')) { continue; }
        var q = projIn(items[i].x, items[i].y);
        var lg = ctx.createRadialGradient(q.x, q.y - 14 * u, 0, q.x, q.y - 14 * u, 96 * u);
        lg.addColorStop(0, 'rgba(255,214,130,0.34)');
        lg.addColorStop(1, 'rgba(255,200,110,0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(q.x, q.y - 14 * u, 96 * u, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * 동굴 안 — home 의 실내 투영(setupIn/projIn/unprojIn)을 그대로 빌려 쓴다
   * (둘 다 "휘지 않는 평평한 방"이라 기계는 같다). 벽지·장판 갈아입히기가
   * 없는 만큼 훨씬 단순하다 — 바위 벽·바닥 한 벌뿐이고, 상자 셋과 문만 있다.
   */
  function drawCaveScene(p, now) {
    var rm = V.caveRoom();
    setupIn(rm);
    var u = inSc;
    var fw = rm.w * u, fh = rm.h * IN_TILT * u, wh = IN_WALL * u;
    var top = inOy - wh, T = V.TILE;

    ctx.fillStyle = '#0c0a08';
    ctx.fillRect(0, 0, W, H);

    /* 바위 벽 */
    ctx.fillStyle = '#3d372f';
    ctx.fillRect(inOx, top, fw, wh);
    var g = ctx.createLinearGradient(0, top, 0, top + wh);
    g.addColorStop(0, 'rgba(0,0,0,0.32)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(inOx, top, fw, wh);

    /* 문(입구) — 뒷벽 가운데 어두운 틈 */
    var dr = V.caveDoor();
    var dx = inOx + dr.x * u;
    var dw = 66 * u, dh = wh * 0.72;
    var dtop = inOy - dh - 5 * u;
    ctx.fillStyle = '#050403';
    ctx.fillRect(dx - dw * 0.5, dtop, dw, dh);

    /* 바닥 — 거친 돌바닥, 칸 금만 살짝 */
    ctx.fillStyle = '#4c463d';
    ctx.fillRect(inOx, inOy, fw, fh);
    var ty;
    for (ty = 0; ty < rm.th; ty++) {
      if (ty % 2) { continue; }
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(inOx, inOy + ty * T * IN_TILT * u, fw, T * IN_TILT * u);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(inOx, inOy, fw, 5 * u);

    /* 상자와 사람 — 방 좌표의 y 순서로. 보스방(2026-09-10) 이후 보스 상자도
       V.caveChests() 가 그대로 끼워 주므로 이 루프는 안 건드렸다 —
       가디언(👹)만 한 자리 더 그린다 */
    var chests = V.caveChests();
    var order = [], i;
    for (i = 0; i < chests.length; i++) { order.push({ y: chests[i].y, t: 'c', o: chests[i] }); }
    var bc = V.caveBossChest();
    order.push({ y: bc.y - 26, t: 'guard', o: bc });
    order.push({ y: p.y, t: 'me', o: p });
    order.sort(function (a, b) { return a.y - b.y; });

    var CDv = window.DG.caveDepth, deep = !!(CDv && CDv.floor() > 0);   // W-0285 지하 층 — 상자 대신 그 층 사물
    if (deep) { order = CDv.order(p); }
    var f = V.focus();
    for (i = 0; i < order.length; i++) {
      if (order[i].t === 'c') { drawChest(order[i].o, u); } else if (order[i].t === 'cd') { drawCd(order[i].o, u); }
      else if (order[i].t === 'guard') { drawBossGuard(order[i].o, u); }
      else { drawMeIn(order[i].o, now); }
    }

    if (f && f.type === 'cavedoor') {
      bubble((deep ? '위로 올라간다 [' : '밖으로 나간다 [') + core.actHint() + ']', dx, dtop - 14 * u, '#2a2622', '#e8dfce');
    }
    if (f && f.type === 'cd' && CDv) { var qf = projIn(f.obj.x, f.obj.y); bubble(CDv.labelOf(f.obj) + ' [' + core.actHint() + ']', qf.x, qf.y - 34 * u, '#2a2622', '#e8dfce'); }   // W-0285

    /* 어둑함 — 방 전체가 늘 밤이다(등잔이 없다). W-0285 지하 층은 횃불 시야 밖이 캄캄하다 */
    if (deep) {
      var qp = projIn(p.x, p.y), rr = CDv.sight() * u;
      var dg = ctx.createRadialGradient(qp.x, qp.y - 12 * u, rr * 0.35, qp.x, qp.y - 12 * u, rr);
      dg.addColorStop(0, 'rgba(8,6,4,0.15)'); dg.addColorStop(1, 'rgba(4,3,2,0.94)');
      ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);
      ctx.font = 'bold ' + Math.round(13 * u) + 'px sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = '#e8dfce';
      ctx.fillText(CDv.hud(), inOx + fw - 6 * u, inOy + fh + 22 * u);   // 방 아래 오른쪽 — 왼쪽 위 상태 카드와 안 겹친다
    } else {
      ctx.fillStyle = 'rgba(8,6,4,0.38)';
      ctx.fillRect(0, 0, W, H);
    }
  }
  /** W-0285 지하 층 사물 — 광석·짐승·사다리·횃불·유물은 글자 그림(2D 되돌림과 같은 결) */
  function drawCd(o, u) {
    var CDv = window.DG.caveDepth, g = CDv ? CDv.glyph(o) : '', q = projIn(o.x, o.y);
    if (!g) { return; }
    shadow(q.x, q.y + 2 * u, 14 * u, 5 * u);
    ctx.font = Math.round(26 * u) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff';
    ctx.fillText(g, q.x, q.y - 4 * u);
  }

  /**
   * 보물상자 하나 — 이모지 대신 우편함·게시판(drawMailbox·drawBoard)과
   * 같은 결로 나무 궤·뚜껑·띠·자물쇠를 직접 그린다. 연 것은 뚜껑이 열린
   * 채 빛바래고, 보스 상자(bossChest, 2026-09-10)는 더 크고 금빛 띠로
   * 갈라 도드라지게 한다.
   * **2026-09-11(PLAN 46-2절)** — "동굴 보물상자를 실제 3D 모델로" 아이디어를
   * 조사하다, 동굴 안은 3D 자체를 안 그린다는 걸 확인했다(`indoorSuppressed()`
   * — 실내는 2D 전용). GLB를 갖다 놔도 안 쓰이므로, 대신 이 판의 다른
   * 소품들과 같은 방식(캔버스 직접 그리기)으로 "이모지 한 글자"보다 나은
   * 모습을 준다 — 새 에셋 없이 같은 목표(제대로 된 상자로 보이기)를 이뤘다.
   */
  function drawChest(c, u) {
    var q = projIn(c.x, c.y);
    var opened = V.chestOpened(c.id);
    var boss = c.id === 'bossChest';
    var s = (boss ? 1.35 : 1) * u;
    var bw = 30 * s, bh = 15 * s, lid = 11 * s;
    var bx = q.x - bw * 0.5, by = q.y - bh;

    shadow(q.x, q.y + 2 * s, (boss ? 20 : 16) * u, (boss ? 7 : 6) * u);

    ctx.save();
    ctx.globalAlpha = opened ? 0.55 : 1;

    var wood = boss ? '#8a5a20' : '#7a5230';
    var band = boss ? '#e8c04a' : '#4a3420';

    /* 몸통 */
    ctx.fillStyle = wood;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(bx, by + bh - 3 * s, bw, 3 * s);

    /* 뚜껑 — 열렸으면 뒤로 젖혀진 모양, 안 열렸으면 몸통 위에 반원으로 얹힌다 */
    ctx.fillStyle = wood;
    ctx.beginPath();
    if (opened) {
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + bw * 0.15, by - lid * 1.3, bx + bw * 0.55, by - lid * 1.1);
      ctx.lineTo(bx + bw * 0.78, by - lid * 0.25);
      ctx.lineTo(bx, by);
    } else {
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(q.x, by - lid, bx + bw, by);
    }
    ctx.closePath();
    ctx.fill();

    /* 테두리 띠 — 몸통 가운데 세로 둘, 보스는 금빛 */
    ctx.fillStyle = band;
    ctx.fillRect(bx + bw * 0.26, by, 2.6 * s, bh);
    ctx.fillRect(bx + bw * 0.74 - 2.6 * s, by, 2.6 * s, bh);

    /* 자물쇠 — 안 열렸을 때만 */
    if (!opened) {
      ctx.fillStyle = band;
      ctx.fillRect(q.x - 3 * s, by + bh * 0.32, 6 * s, 6 * s);
    }

    ctx.restore();
  }

  /** 보스방 가디언(포자대왕, 2026-09-10) — 순전히 장식이다(새 전투 없음).
   *  상자 셋을 다 열기 전엔 위압적으로 서 있고, 다 열면 길을 내준 듯 흐려진다 */
  function drawBossGuard(bc, u) {
    var q = projIn(bc.x, bc.y - 42);
    var unlocked = V.bossUnlocked();
    shadow(q.x, q.y + 6 * u, 22 * u, 7 * u);
    ctx.font = Math.round(46 * u) + 'px "Segoe UI Emoji", system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = unlocked ? 0.45 : 1;
    (global.DG.mode2d || { mark: function (c, s, x, y) { c.fillText(s, x, y); } }).mark(ctx, '👹', q.x, q.y + 10 * u);
    ctx.globalAlpha = 1;
    if (!unlocked) {
      bubble('포자대왕이 지키고 있다', q.x, q.y - 40 * u, '#3a1414', '#ffe2d8');
    }
  }

  /** 창호 창 하나 */
  function window_(cx, cy, w, h) {
    ctx.fillStyle = global.DG.home.wallNow().trim;
    ctx.fillRect(cx - w * 0.5 - 2, cy - h * 0.5 - 2, w + 4, h + 4);
    ctx.fillStyle = '#f7f2e2';
    ctx.fillRect(cx - w * 0.5, cy - h * 0.5, w, h);
    ctx.strokeStyle = 'rgba(120,90,60,0.45)';
    ctx.lineWidth = 1.1;
    for (var i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.5 + (w / 3) * i, cy - h * 0.5);
      ctx.lineTo(cx - w * 0.5 + (w / 3) * i, cy + h * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.5, cy - h * 0.5 + (h / 3) * i);
      ctx.lineTo(cx + w * 0.5, cy - h * 0.5 + (h / 3) * i);
      ctx.stroke();
    }
  }

  function drawMeIn(p0, now) {
    var q = projIn(p0.x, p0.y);
    var k = core.clamp(inSc * 0.95, 0.65, 1.9);
    var me = meStamp();
    shadow(q.x, q.y + 2 * k, 14 * k, 5 * k);
    if (!(global.DG.actor2d && global.DG.actor2d.draw(ctx, 'me', me.ref, 'me', q.x, q.y, k, { facing: p0.facing, dirX: p0.dirX, dirY: p0.dirY, moving: p0.walking, phase: p0.phase, now: now, wx: p0.x, wy: p0.y, ppu: inSc, pk: 'me:in' }))) global.DG.sprite.stamp(ctx, {
      kind: 'human', ref: me.ref, x: q.x, y: q.y, s: k,
      facing: p0.facing, phase: p0.phase, walking: p0.walking,
      color: me.color, look: me.look,
      rarity: me.rarity, t: now
    });
  }

  /* ── 가구(집 안) — js/village-furn.js(R-4). 같은 이름 한 줄 넘김 ───────── */
  var villageFurnBind = null;
  function FURN() { return global.DG.villageFurn.bind(villageFurnBind || (villageFurnBind = { shadow: shadow, ring: ring, bubble: bubble, projIn: projIn, roundRect: roundRect }), ctx, VD, inSc); }
  function drawFurn(item, f, now) { return FURN().drawFurn(item, f, now); }


  /* ── 마을 기(깃대·깃발 무늬) — js/village-flag.js(R-4). 같은 이름 한 줄 넘김 ───────── */
  var villageFlagBind = null;
  function FLAG() { return global.DG.villageFlag.bind(villageFlagBind || (villageFlagBind = { shadow: shadow }), ctx); }
  function drawPole(x, y, k, now) { return FLAG().drawPole(x, y, k, now); } function drawFlagSym(key, cx, cy, r, c) { return FLAG().drawFlagSym(key, cx, cy, r, c); }

  /* ── 행사 ─────────────────────────────────────────────────
   * 백중 밤의 불꽃. 씨앗 대신 **시각을 잘라** 터지는 자리를 정한다 —
   * 매 프레임 새로 뽑으면 깜박이고, 아주 고정하면 죽은 그림이 된다.
   */
  function drawFireworks(now) {
    var n = 3, i, j;
    for (i = 0; i < n; i++) {
      var cycle = 2600 + i * 700;
      var t = ((now + i * 900) % cycle) / cycle;      // 0 → 1 로 한 번 터진다
      var seed = Math.floor((now + i * 900) / cycle);
      var cx = (0.18 + core.hash2(seed, i * 7 + 1) * 0.64) * W;
      var cy = (0.10 + core.hash2(i * 13 + 3, seed) * 0.34) * Math.max(80, horizonY + 60);
      var hue = ['#ffd36a', '#ff8a7a', '#8fd0ff', '#c6a8ff', '#9ce8a0'][seed % 5];

      if (t < 0.22) {                                 // 올라가는 불씨
        var up = 1 - t / 0.22;
        ctx.fillStyle = 'rgba(255,220,150,0.9)';
        ctx.beginPath();
        ctx.arc(cx, cy + up * 180, 2.4, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      var k = (t - 0.22) / 0.78;
      var rad = 12 + k * 92;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k) * 0.95;
      ctx.strokeStyle = hue;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      for (j = 0; j < 14; j++) {
        var a = (j / 14) * Math.PI * 2 + seed;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * rad * 0.72, cy + Math.sin(a) * rad * 0.72);
        ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /**
   * 깃발 한 장을 그림 파일로 뽑아 준다 — 시트에서 고를 때 미리 보여 주려는 것이다.
   * 모듈의 ctx 를 잠깐 빌려 쓴다(한 가닥으로 도는 코드라 겹칠 일이 없다).
   */
  function flagIconOf(bgKey, fgKey, symKey, size) {
    var VDx = global.DG.villageData;
    var pick = function (list, key) {
      var f = list.filter(function (x) { return x.key === key; });
      return f[0] || list[0];
    };
    var bg = pick(VDx.FLAG_BGS, bgKey), fg = pick(VDx.FLAG_FGS, fgKey);
    var w = size || 42, h = Math.round(w * 0.66);
    var cv2 = document.createElement('canvas');
    cv2.width = w; cv2.height = h;
    var keep = ctx;
    ctx = cv2.getContext('2d');
    ctx.fillStyle = bg.c;
    ctx.fillRect(0, 0, w, h);
    drawFlagSym(symKey, w / 2, h / 2, h * 0.34, fg.c);
    ctx.strokeStyle = 'rgba(0,0,0,0.30)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx = keep;
    return cv2.toDataURL();
  }

  function flagIcon(size) {
    var T = global.DG.town;
    return flagIconOf(T.flag().bg, T.flag().fg, T.flag().sym, size);
  }

  global.DG = global.DG || {};
  global.DG.villageView = {
    autotile: function () { return AT(); }, autotileOn: autotileOn,   // W-0390
    flagIcon: flagIcon, flagIconOf: flagIconOf,
    init: init, draw: draw, resize: resize,
    /** 3D 가 켜져 2D 를 안 그릴 때도 카메라(좌표 변환 기준)는 사람을 따라간다 — 발열 대책(2026-09-24) */
    syncCam: function () { var p = V.raw().player; cam.x = p.x; cam.y = p.y; },
    /** 자가진단용 */
    _cam: function () { return cam; },
    _animalSprite: function (kind) { return ANIMAL_SPRITE[kind] || null; },
    _project: project, _bubbleSlot: bubbleSlot,   // W-0144 진단
    _unproject: unproject,
    _projectIn: projIn,
    _unprojectIn: unprojIn
  };
})(window);
