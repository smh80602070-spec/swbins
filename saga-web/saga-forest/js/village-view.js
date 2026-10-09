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
  }

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
    function reset() { joyId = null; knobAt(0, 0); V.setJoy(0, 0); }
    joyEl.addEventListener('pointerdown', function (e) {
      if (joyId !== null) { return; }
      var r = joyEl.getBoundingClientRect();
      joyCX = r.left + r.width / 2; joyCY = r.top + r.height / 2;
      joyId = e.pointerId;
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

    var CZ = global.DG.cozy2d ? global.DG.cozy2d.zoomMul() : 1; ZOOM = core.clamp(H / 620, 0.82, 1.7) * CZ; R = R0 / CZ;   // W-0133 스타듀식 큰 인물(손잡이 village.cozyZoom)
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
    if (e.button) { return; }              // 가운대·오른쪽 단추는 짚지 않는다
    dragging = true;
    /* 캡처 — 손가라가 HUD 나 화면 밖으로 나가도 계속 따른다 */
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 안 되면 그대로 */ }
    onClick(e);
  }

  function onMove(e) {
    if (!dragging) { return; }
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
    if (!ctx) { return; }
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

    if (starHint) {
      bubble('🌠 흐르는 별 — 소원을 빈다 [' + core.actHint() + ']', starHint.x, starHint.y, '#3a3a5a', '#f2f0ff');
    }

    drawWeather(se, now);
    /* 백중 밤의 불꽃 — 밤과 저녁에만 오른다 */
    if (evTag() === 'fire' && (ph.key === 'night' || ph.key === 'even')) {
      drawFireworks(now);
    }

    /* 계절빛 — 아주 옅게 한 겹 (계절이 바뀐 걸 눈이 먼저 안다) */
    ctx.fillStyle = se.tint;
    ctx.fillRect(0, 0, W, H);

    /* 시간대 빛 — 밤이면 어둡게 덮는다 */
    if (global.DG.cozy2d && global.DG.cozy2d.light(ctx, ph, W, H, project(p.x, p.y), ZOOM)) { /* W-0133 아늑한 빛이 대신 덮었다 */ } else if (ph.light !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = ph.light;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ── 하늘 ─────────────────────────────────────────────────
   * 마루 위쪽은 전부 하늘이다. 위는 짙고 지평선 가까이는 옅다 —
   * 원작의 그 부드러운 띠.
   */
  function drawSky(ph, se, now) {
    var top = ph.sky;
    var g = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizonY + H * 0.22));
    g.addColorStop(0, dark(top, 0.08));
    g.addColorStop(0.55, top);
    g.addColorStop(1, light(top, ph.key === 'night' ? 0.16 : 0.42));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, Math.max(1, horizonY + H * 0.24));

    var wx = wxKey();
    /* 흐리거나 비가 오면 해도 별도 가려진다 */
    if (wx === 'clear') {
      if (ph.key === 'night' || ph.key === 'dawn') { drawStars(ph); }
      drawSunMoon(ph);
      drawShootingStar();
    }
    drawClouds(ph, now);
  }

  /** 오늘의 하늘 — 화면이 여러 곳에서 본다 */
  function wxKey() {
    return global.DG.town ? global.DG.town.weather().key : 'clear';
  }

  /** 오늘의 행사 (없으면 null) — 화면이 여러 곳에서 본다 */
  function evTag() {
    var e = global.DG.town ? global.DG.town.event() : null;
    return e ? e.tag : null;
  }

  /** 별 — 자리는 해시로 고정한다. 매 프레임 흔들리면 눈이 아프다 */
  function drawStars(ph) {
    /* 칠석 밤에는 별이 갑절이다 — 견우직녀가 만나는 밤이니 */
    var n = evTag() === 'star' ? 150 : 70, i;
    ctx.fillStyle = ph.key === 'night' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)';
    for (i = 0; i < n; i++) {
      var hx = core.hash2(i * 13 + 3, 7);
      var hy = core.hash2(11, i * 29 + 5);
      var x = hx * W;
      var y = hy * Math.max(20, horizonY);
      var r = 0.6 + core.hash2(i, i * 3) * 1.1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * 흐르는 별 — 밤하늘을 가로지른다. 그 사이에 손을 쓰면 소원을 빈다.
   * 언제 흐를지는 town.js 가 **시각을 잘라 해시로** 정한다(난수를 쓰지 않는다).
   */
  var starHint = null;

  function drawShootingStar() {
    var T = global.DG.town;
    starHint = null;
    if (!T) { return; }
    var st2 = T.starNow();
    if (!st2) { return; }
    /* 하늘 띠가 얇다(지평선이 높다) — 별은 그 안에서 흐르고, 안내는 별 **아래**에 붙인다.
       위에 붙였더니 상단 띠에 가려 아무것도 안 보였다 */
    var band = Math.max(70, horizonY);
    var x = st2.x * W + st2.t * W * 0.18;
    var y = 10 + st2.y * band * 0.62 + st2.t * band * 0.30;
    var len = 82;
    var a = 1 - Math.abs(st2.t - 0.5) * 1.6;

    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    var g = ctx.createLinearGradient(x - len, y - len * 0.45, x, y);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.95)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - len, y - len * 0.42);
    ctx.lineTo(x, y);
    ctx.stroke();
    var gl = ctx.createRadialGradient(x, y, 0, x, y, 16);
    gl.addColorStop(0, 'rgba(255,255,240,0.95)');
    gl.addColorStop(1, 'rgba(255,255,220,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    /* 안내는 **땅을 다 그린 뒤에** 얹는다 — 하늘에 얹었더니 바다 띠에 덮였다 */
    starHint = { x: x, y: y + 30 };
  }

  /** 해와 달 — 시각에 따라 하늘을 가로지른다 */
  function drawSunMoon(ph) {
    var d = new Date();
    var hr = d.getHours() + d.getMinutes() / 60;
    var sun = hr >= 5 && hr < 20;
    var t = sun ? (hr - 5) / 15 : ((hr >= 20 ? hr - 20 : hr + 4) / 9);
    t = core.clamp(t, 0, 1);
    var x = W * 0.12 + t * W * 0.76;
    var top = Math.max(24, horizonY);
    var y = top - Math.sin(t * Math.PI) * top * 0.62 + top * 0.10;
    var r = sun ? 26 : 20;
    /* 대보름·한가위 — 달이 크고 둥글다. 그 하루가 눈에 보여야 한다 */
    var bigMoon = !sun && evTag() === 'moon';
    if (bigMoon) { r = 38; }

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = sun ? '#ffe9a8' : '#e8eeff';
    ctx.beginPath(); ctx.arc(x, y, r * 2.1, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = sun ? '#ffdf7a' : '#f2f5ff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (!sun && !bigMoon) {                       // 달은 한쪽을 깎아 초승으로
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(x + r * 0.42, y - r * 0.26, r * 0.86, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  /** 구름 — 아주 느리게 흐른다. 뭉게뭉게 세 덩이가 한 조각 */
  function drawClouds(ph, now) {
    var wx = wxKey();
    var n = wx === 'clear' ? 5 : 11, i;
    var drift = now / 52000;
    ctx.save();
    ctx.fillStyle = wx === 'rain' ? 'rgba(120,132,150,0.92)'
                  : wx === 'snow' ? 'rgba(210,220,232,0.92)'
                  : wx === 'cloud' ? 'rgba(196,206,220,0.90)'
                  : ph.key === 'night' ? 'rgba(180,195,225,0.30)'
                  : ph.key === 'even' ? 'rgba(255,222,205,0.85)'
                  : 'rgba(255,255,255,0.88)';
    for (i = 0; i < n; i++) {
      var sp = 0.35 + core.hash2(i * 7 + 1, 2) * 0.5;
      var x = (((core.hash2(i, 21) + drift * sp) % 1) + 1) % 1;
      x = x * (W + 320) - 160;
      var y = 26 + core.hash2(3, i * 17) * Math.max(30, horizonY * 0.62);
      var k = 0.7 + core.hash2(i * 5, 9) * 0.7;
      puff(x, y, k);
    }
    ctx.restore();
  }
  function puff(x, y, k) {
    ctx.beginPath();
    ctx.arc(x - 26 * k, y + 4 * k, 17 * k, 0, Math.PI * 2);
    ctx.arc(x, y - 6 * k, 24 * k, 0, Math.PI * 2);
    ctx.arc(x + 28 * k, y + 5 * k, 19 * k, 0, Math.PI * 2);
    ctx.rect(x - 26 * k, y + 3 * k, 55 * k, 12 * k);
    ctx.fill();
  }

  /**
   * 마루 너머 — 먼 바다와 산.
   * 좌우 처짐(BEND)과 같은 곡선을 타야 땅과 하늘이 어긋나 보이지 않는다.
   */
  function drawFarShore(ph, se) {
    var step = 26, x;
    var hz = function (sx) { var d = sx - CX; return horizonY + d * d * BEND; };

    /* 먼 바다 — 지평선 바로 아래의 옅은 띠 */
    ctx.beginPath();
    ctx.moveTo(-40, hz(-40));
    for (x = -40; x <= W + 40; x += step) { ctx.lineTo(x, hz(x)); }
    ctx.lineTo(W + 40, H + 40);
    ctx.lineTo(-40, H + 40);
    ctx.closePath();
    ctx.fillStyle = light(VD.TILES.water.color, ph.key === 'night' ? 0.02 : 0.20);
    ctx.fill();

    /* 먼 산 — 마루 위로 살짝 솟은 실루엣 */
    var hills = [
      { c: 0.16, w: 240, h: 52 }, { c: 0.34, w: 300, h: 74 },
      { c: 0.58, w: 270, h: 62 }, { c: 0.82, w: 320, h: 80 }
    ];
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = se.key === 'winter' ? '#c9d6de' : dark(mix(ph.sky, '#3f6b4a', 0.55), 0.05);
    for (var i = 0; i < hills.length; i++) {
      var hi = hills[i];
      var cx0 = hi.c * W;
      var by = hz(cx0);
      ctx.beginPath();
      ctx.moveTo(cx0 - hi.w * 0.5, by + 2);
      ctx.quadraticCurveTo(cx0 - hi.w * 0.22, by - hi.h, cx0, by - hi.h * 0.92);
      ctx.quadraticCurveTo(cx0 + hi.w * 0.26, by - hi.h * 0.72, cx0 + hi.w * 0.5, by + 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

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
  function tileImg(kind, se) {
    var M2 = global.DG.mode2d, src = (M2 && M2.tileUrl(se && se.key === 'winter' && kind.indexOf('grass') === 0 ? 'snow' : kind)) || TILE_IMG_SRC[kind] || TILE_IMG_SRC.grass;   // 2D 모드면 K-0020 타일(겨울엔 풀 → 눈)
    var im = tileImgCache[src];
    if (!im) { im = new Image(); im.src = src; tileImgCache[src] = im; }
    return im;
  }

  /** 타일 그림을 좌상·우상·좌하 세 꼭짓점만 맞춰 아핀 변환으로 그린다.
      구면 투영이라 넷째 꼭짓점(우하)은 근사다 — 타일이 작아 안 띈다.
      `ctx.transform`(누적)을 쓴다 — `setTransform`은 draw() 가 걸어 둔 DPR
      배율을 지워 버린다 */
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
    var ty, tx;

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
        var alt = ((tx + ty) % 2 + 2) % 2 === 0;
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
        if (step === 1) { texList.push({ img: tileImg(kind, se), a0: a0, a1: a1, a3: a3, kind: kind, tx: tx, ty: ty }); }

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
    for (var ti = 0; ti < texList.length; ti++) {
      drawTileTexture(texList[ti].img, texList[ti].a0, texList[ti].a1, texList[ti].a3);
    }

    if (global.DG.cozy2d) { global.DG.cozy2d.ground(ctx, texList, { project: project, T: T, se: se, zoom: ZOOM, tileAt: V.tileAt, tiles: VD.TILES }); }   /* W-0133 풀 결·꽃 점·흙길 가장자리 덧칠, 그 위에 잔디 술 — 세 갈래 짧은 선 */
    if (tufts.length) {
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
    ctx.fill();
  }

  function drawProp(prop, f, se, now) {
    var def = VD.PROPS[prop.kind];
    if (!def) { return; }
    var p = project(prop.x, prop.y);
    if (p.a < -A_MAX) { return; }
    var k = ZOOM * p.s;
    if (p.x < -140 || p.x > W + 140 || p.y < -180 || p.y > H + 180) { return; }

    var spent = V.spent(prop);
    var big = prop.kind === 'shop' || prop.kind === 'school' ||
              prop.kind === 'home' || prop.kind === 'museum' || prop.kind === 'tailor';
    /* 바람 — 자리마다 위상을 달리해 한꺼번에 흔들리지 않게 한다 */
    var sway = Math.sin(now / 1350 + prop.x * 0.021 + prop.y * 0.013) * 0.045;

    ctx.save();
    ctx.globalAlpha = spent && !big ? 0.62 : 1;
    if (!(global.DG.mode2d && global.DG.mode2d.drawKind(ctx, prop.kind, p.x, p.y, kindK(prop.kind, k)) && kindOver(prop.kind, p.x, p.y, k, now))) switch (prop.kind) {   // 2D 모드 통일 스프라이트(W-0019) 먼저 — W-0124 가게·집 크기 성장·우체통 깃발은 그 위에도
      case 'tree':    drawTree(p.x, p.y, k, sway, se, !spent); break;
      case 'pine':    drawPine(p.x, p.y, k, sway, se); break;
      case 'rock':    drawRock(p.x, p.y, k, se); break;
      case 'flower':  drawFlower(p.x, p.y, k, sway, se, prop); break;
      case 'sapling': drawSapling(p.x, p.y, k, sway); break;
      case 'spot':    drawSpot(p.x, p.y, k, now); break;
      case 'board':   drawBoard(p.x, p.y, k); break;
      case 'shop':    drawHanok(p.x, p.y,
                        k * (1 + (global.DG.village.shopLevel().n * 0.10)),
                        '#8a5a3c', def.name); break;
      case 'weed':    drawWeed(p.x, p.y, k, prop, sway); break;
      case 'school':  drawHanok(p.x, p.y, k, '#4a6a8a', def.name); break;
      case 'home':    drawMyHouse(p.x, p.y, k); break;
      case 'mail':    drawMailbox(p.x, p.y, k, now); break;
      /* 간판에는 '사고' 만 쓴다 — 한자까지 넣으면 판을 넘친다 (말풍선이 온 이름을 준다) */
      case 'museum':  drawHanok(p.x, p.y, k * 1.22, '#5c5a78', '사고'); break;
      case 'tailor':  drawHanok(p.x, p.y, k * 0.92, '#8a4a6a', '침선방'); break;
      case 'pole':    drawPole(p.x, p.y, k, now); break;
      case 'dig':     drawDig(p.x, p.y, k, spent); break;
      case 'shell':   drawShell(p.x, p.y, k, prop); break;
      default:
        shadow(p.x, p.y + 4 * k, 14 * k, 5 * k);
        ctx.font = Math.round(30 * k) + 'px "Segoe UI Emoji", system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(def.emoji, p.x, p.y + 6 * k);
    }
    ctx.restore();

    /* 낚시 중인 낚시터 — 찌와 입질 (원작에서 찌를 보고 당기는 그 자리) */
    var fs = V.fishState();
    if (fs && fs.propId === prop.id) {
      var bite = fs.state === 'bite';
      drawFloat(p.x, p.y, k, bite, now);
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
        p.x, p.y - (big ? 118 : 74) * k, spent ? '#7a7a7a' : '#8a5a10',
        spent ? '#e9e9e9' : '#fff0c9');
    } else if (big) {
      bubble(def.name, p.x, p.y - 104 * k, '#54402c', '#f7ecd8');
    }
  }

  /**
   * 나무 — Kenney "Roguelike/RPG Pack"(CC0, `assets/sprites2d/`)의 나무
   * 그림을 그대로 그린다. 계절별로 다른 그림을 고르고, 흔들림은 회전으로
   * 낸다 — 벚꽃·눈·열매는 여전히 코드가 얹는다(그림이 아니라 그때그때
   * 바뀌는 상태 표시라서, `saga-assets-over-script` 방침에서도 이런
   * 배지류는 코드 몫으로 남겨 둔다).
   */
  var CANOPY = {
    spring: { bloom: '#f6b4d0' },
    summer: { bloom: null },
    autumn: { bloom: null },
    winter: { bloom: null }
  };
  var TREE_SRC = {
    spring: 'assets/sprites2d/tree_spring.png',
    summer: 'assets/sprites2d/tree_spring.png',
    autumn: 'assets/sprites2d/tree_autumn.png',
    winter: 'assets/sprites2d/tree_winter.png'
  };
  var treeImgCache = {};
  function treeImg(key) {
    var w2 = global.DG.fs2d ? global.DG.fs2d.tree(key) : null; if (w2) { return w2; } var src = TREE_SRC[key] || TREE_SRC.summer;   // W-0114 그림체 C 먼저
    var im = treeImgCache[src];
    if (!im) { im = new Image(); im.src = src; treeImgCache[src] = im; }
    return im;
  }

  function drawTree(x, y, k, sway, se, ripe) {
    /* 삼짇날 — 계절과 무관하게 나무마다 벚빛이 돈다 (꽃놀이 가는 날이다) */
    var seKey = evTag() === 'blossom' ? 'spring' : (se.key || 'summer');
    var cp = CANOPY[seKey] || CANOPY.summer;
    shadow(x, y + 3 * k, 26 * k, 9 * k);

    /* 그림 — 16x15 픽셀아트를 확대해 그린다. 흔들림은 밑동을 축으로 살짝
       돌리는 것으로 낸다(원본이 트임·줄기까지 한 그림이라 따로 휘지 않는다) */
    var img = treeImg(seKey);
    var sc = img.__h ? img.__h * k / img.naturalHeight : 3.5 * k;   // 256px 그림체 C 는 높이 기준(W-0114)
    var iw = img.naturalWidth || 16, ih = img.naturalHeight || 15;
    var dw = iw * sc, dh = ih * sc;
    ctx.save();
    ctx.imageSmoothingEnabled = !!img.__h;
    ctx.translate(x, y + 2 * k);
    ctx.rotate(sway * 0.6);
    if (img.complete && img.naturalWidth) {
      ctx.drawImage(img, -dw / 2, -dh, dw, dh);
    }
    ctx.restore();

    /* 열매·눈·벚꽃 배지 자리 — 그림 수관 한복판께를 어림한다 */
    var rr = dw * 0.42;
    var cx = x + sway * 46 * k;
    var cy = y - dh * 0.56;

    /* 봄이면 벚빛 꽃송이가 수관에 얹힌다 */
    if (cp.bloom) {
      ctx.fillStyle = cp.bloom;
      var bl = [[-0.70, -0.10], [-0.20, -0.62], [0.34, -0.52], [0.78, 0.06],
                [0.10, 0.40], [-0.48, 0.44]];
      for (var b = 0; b < bl.length; b++) {
        ctx.beginPath();
        ctx.arc(cx + rr * bl[b][0], cy + rr * bl[b][1], rr * 0.20, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (se.key === 'winter') {                      // 눈을 얹는다
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#f4f9fb';
      ctx.beginPath();
      ctx.arc(cx - rr * 0.48, cy - rr * 0.50, rr * 0.42, 0, Math.PI * 2);
      ctx.arc(cx + rr * 0.42, cy - rr * 0.48, rr * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* 열매 — 아직 여물었을 때만 (딴 나무는 비어 있다) */
    if (ripe) {
      var fr = se.key === 'winter' ? '#f2d24a' : se.key === 'autumn' ? '#e8663c' : '#e04b4b';
      var pos = [[-0.62, 0.30], [0.64, 0.18], [0.04, 0.74]];
      for (var i = 0; i < pos.length; i++) {
        ctx.beginPath();
        ctx.arc(cx + rr * pos[i][0], cy + rr * pos[i][1], 4.4 * k, 0, Math.PI * 2);
        ctx.fillStyle = fr;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + rr * pos[i][0] - 1.4 * k, cy + rr * pos[i][1] - 1.4 * k, 1.5 * k, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fill();
      }
    }
  }

  /** 소나무 — Kenney Roguelike/RPG Pack(CC0)의 침엽수 그림. 줄기는 그대로
   *  코드가 긋고(간단한 사각형이라 굳이 에셋을 안 쓴다), 잎은 그림 한 장이다.
   *  겨울엔 청록 그림으로 갈아 끼우고 눈덩이를 얹는다. */
  var PINE_SRC = { winter: 'assets/sprites2d/pine_winter.png' };
  var PINE_DEFAULT_SRC = 'assets/sprites2d/pine_green.png';
  var pineImgCache = {};
  function pineImg(key) {
    var w2 = global.DG.fs2d ? global.DG.fs2d.pine(key) : null; if (w2) { return w2; } var src = PINE_SRC[key] || PINE_DEFAULT_SRC;   // W-0114
    var im = pineImgCache[src];
    if (!im) { im = new Image(); im.src = src; pineImgCache[src] = im; }
    return im;
  }

  function drawPine(x, y, k, sway, se) {
    shadow(x, y + 3 * k, 20 * k, 7 * k);
    /* 줄기는 잎보다 **먼저·길게** 그린다. 짧게 그렸다가 잎과 밑동이
       뚝 떨어져 보인 적이 있다 */
    ctx.fillStyle = '#7a5636';
    if (!pineImg(se.key).__h) { ctx.fillRect(x - 4.5 * k, y - 34 * k, 9 * k, 36 * k); }   // 그림체 C 소나무는 줄기까지 한 그림

    var img = pineImg(se.key);
    var sc = img.__h ? img.__h * k / img.naturalHeight : 4.6 * k;
    var iw = img.naturalWidth || 15, ih = img.naturalHeight || 15;
    var dw = iw * sc, dh = ih * sc;
    ctx.save();
    ctx.imageSmoothingEnabled = !!img.__h;
    ctx.translate(x, img.__h ? y + 2 * k : y - 30 * k);
    ctx.rotate(sway * 0.7);
    if (img.complete && img.naturalWidth) {
      ctx.drawImage(img, -dw / 2, -dh, dw, dh);
    }
    ctx.restore();

    if (se.key === 'winter') {                      // 눈덩이를 끝자락에 얹는다
      var rr = dw * 0.42;
      var cx = x, cy = y - 30 * k - dh * 0.5;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#eef6f9';
      ctx.beginPath();
      ctx.arc(cx - rr * 0.30, cy - rr * 0.60, rr * 0.30, 0, Math.PI * 2);
      ctx.arc(cx + rr * 0.34, cy - rr * 0.10, rr * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** 바위 — 둥근 덩이 + 위쪽 밝은 면 */
  function drawRock(x, y, k, se) {
    shadow(x, y + 2 * k, 17 * k, 6 * k); if (global.DG.fs2d && global.DG.fs2d.drawRock(ctx, x, y, k, se)) { return; }   // W-0114 그림체 C 바위
    ctx.beginPath();
    ctx.moveTo(x - 16 * k, y);
    ctx.quadraticCurveTo(x - 18 * k, y - 14 * k, x - 6 * k, y - 19 * k);
    ctx.quadraticCurveTo(x + 6 * k, y - 23 * k, x + 14 * k, y - 13 * k);
    ctx.quadraticCurveTo(x + 19 * k, y - 5 * k, x + 15 * k, y);
    ctx.closePath();
    ctx.fillStyle = '#9aa0a6';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 9 * k, y - 15 * k);
    ctx.quadraticCurveTo(x - 2 * k, y - 22 * k, x + 8 * k, y - 16 * k);
    ctx.quadraticCurveTo(x - 1 * k, y - 12 * k, x - 9 * k, y - 15 * k);
    ctx.closePath();
    ctx.fillStyle = '#bcc2c8';
    ctx.fill();
    if (se.key === 'winter') {
      ctx.save(); ctx.globalAlpha = 0.75; ctx.fillStyle = '#eef6f9';
      ctx.beginPath();
      ctx.moveTo(x - 12 * k, y - 13 * k);
      ctx.quadraticCurveTo(x, y - 25 * k, x + 13 * k, y - 12 * k);
      ctx.quadraticCurveTo(x, y - 17 * k, x - 12 * k, y - 13 * k);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }

  /** 꽃 — 다섯 잎 + 노란 술. 색은 자리마다 다르다 */
  var PETAL = ['#f4738f', '#f2a83c', '#e8e04a', '#9a7de0', '#f2f2f2', '#68b9e8'];

  function drawFlower(x, y, k, sway, se, prop) {
    var c = PETAL[Math.floor(core.hash2(prop.x, prop.y) * PETAL.length) % PETAL.length];
    if (se.key === 'autumn') { c = '#e0703a'; }
    /* 교배로 핀 것은 한눈에 다르게 — 심어 놓고 사흘 뒤에 와서 알아볼 수 있어야 한다 */
    if (prop.hybrid) { c = '#d24a86'; }
    shadow(x, y + 1 * k, 8 * k, 3 * k);
    var hx = x + sway * 22 * k, hy = y - 14 * k;
    ctx.strokeStyle = '#4f8a3f';
    ctx.lineWidth = 1.8 * k;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sway * 12 * k, y - 8 * k, hx, hy);
    ctx.stroke();
    ctx.fillStyle = c;
    for (var i = 0; i < 5; i++) {
      var a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(hx + Math.cos(a) * 4.4 * k, hy + Math.sin(a) * 4.4 * k,
        3.6 * k, 3.0 * k, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(hx, hy, 2.6 * k, 0, Math.PI * 2);
    ctx.fillStyle = prop.hybrid ? '#fff0a0' : '#f7d84a';
    ctx.fill();
    if (prop.hybrid) {                               // 반짝임 한 점
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#fff6cc';
      ctx.beginPath();
      ctx.arc(hx + 6 * k, hy - 6 * k, 1.6 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** 묘목 — 떡잎 둘 (사흘 뒤면 나무가 된다) */
  function drawSapling(x, y, k, sway) {
    shadow(x, y + 1 * k, 7 * k, 2.5 * k);
    ctx.strokeStyle = '#5b9a48';
    ctx.lineWidth = 2 * k;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + sway * 14 * k, y - 10 * k);
    ctx.stroke();
    ctx.fillStyle = '#6fbf55';
    ctx.beginPath();
    ctx.ellipse(x - 4 * k + sway * 14 * k, y - 12 * k, 5 * k, 3 * k, -0.5, 0, Math.PI * 2);
    ctx.ellipse(x + 4 * k + sway * 14 * k, y - 12 * k, 5 * k, 3 * k, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /** 낚시터 — 물 위의 물결과 그림자 진 고기 */
  function drawSpot(x, y, k, now) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.8 * k;
    for (var i = 0; i < 3; i++) {
      var t = ((now / 1500 + i / 3) % 1);
      ctx.globalAlpha = 0.7 * (1 - t);
      ctx.beginPath();
      ctx.ellipse(x, y, (6 + t * 20) * k, (2.4 + t * 8) * k, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#12405a';
    var fx = x + Math.sin(now / 1100) * 9 * k;
    ctx.beginPath();
    ctx.ellipse(fx, y + 2 * k, 8 * k, 3 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 찌 — 던져 놓은 자리. 입질이면 붉게 잠긴다 */
  function drawFloat(x, y, k, bite, now) {
    var bob = bite ? Math.sin(now / 70) * 3 * k : Math.sin(now / 420) * 1.4 * k;
    ctx.save();
    ctx.strokeStyle = 'rgba(240,245,250,0.75)';
    ctx.lineWidth = 1.4 * k;
    ctx.beginPath();
    ctx.moveTo(x - 22 * k, y - 34 * k);
    ctx.quadraticCurveTo(x - 8 * k, y - 18 * k, x, y - 6 * k + bob);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y - 3 * k + bob, 4.2 * k, 0, Math.PI * 2);
    ctx.fillStyle = bite ? '#f4603c' : '#f0f4f8';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1 * k;
    ctx.stroke();
    ctx.restore();
  }

  /** 게시판 — 기둥 둘에 나무판, 종이 몇 장 */
  function drawBoard(x, y, k) {
    shadow(x, y + 2 * k, 18 * k, 6 * k);
    ctx.fillStyle = '#7a5636';
    ctx.fillRect(x - 13 * k, y - 22 * k, 4 * k, 24 * k);
    ctx.fillRect(x + 9 * k, y - 22 * k, 4 * k, 24 * k);
    ctx.fillStyle = '#a9793f';
    ctx.fillRect(x - 18 * k, y - 42 * k, 36 * k, 22 * k);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(x - 18 * k, y - 24 * k, 36 * k, 4 * k);
    ctx.fillStyle = '#f6f1e4';
    ctx.fillRect(x - 13 * k, y - 38 * k, 12 * k, 9 * k);
    ctx.fillRect(x + 2 * k, y - 36 * k, 11 * k, 8 * k);
  }

  /**
   * 한옥 — 전방과 서당.
   * 원작의 상점 자리를 이 게임의 옷으로 갈아입힌 것이다.
   * 기와 지붕의 처마가 양끝에서 위로 들리는 게 핵심 — 그 곡선이 없으면
   * 그냥 상자가 된다.
   */
  function drawHanok(x, y, k, wall, name) {
    var bw = 58 * k, bh = 40 * k;
    shadow(x, y + 4 * k, bw * 0.86, 11 * k);

    /* 몸체 */
    ctx.fillStyle = '#efe3cd';
    ctx.fillRect(x - bw * 0.78, y - bh, bw * 1.56, bh);
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(x - bw * 0.78, y - bh * 0.30, bw * 1.56, bh * 0.30);

    /* 기둥 */
    ctx.fillStyle = wall;
    var cols = [-0.78, -0.28, 0.24, 0.70];
    for (var i = 0; i < cols.length; i++) {
      ctx.fillRect(x + bw * cols[i], y - bh, 6 * k, bh);
    }
    /* 창호문 — 격자 */
    ctx.fillStyle = '#f6efdd';
    ctx.fillRect(x - 15 * k, y - bh * 0.86, 30 * k, bh * 0.78);
    ctx.strokeStyle = 'rgba(120,90,60,0.55)';
    ctx.lineWidth = 1.2 * k;
    for (var g = 1; g < 4; g++) {
      ctx.beginPath();
      ctx.moveTo(x - 15 * k + (30 * k / 4) * g, y - bh * 0.86);
      ctx.lineTo(x - 15 * k + (30 * k / 4) * g, y - bh * 0.08);
      ctx.stroke();
    }
    for (var r2 = 1; r2 < 3; r2++) {
      ctx.beginPath();
      ctx.moveTo(x - 15 * k, y - bh * 0.86 + (bh * 0.78 / 3) * r2);
      ctx.lineTo(x + 15 * k, y - bh * 0.86 + (bh * 0.78 / 3) * r2);
      ctx.stroke();
    }

    /* 지붕 — 처마가 들린 기와 */
    var ry = y - bh;
    var rw = bw * 1.20;
    ctx.beginPath();
    ctx.moveTo(x - rw, ry + 3 * k);
    ctx.quadraticCurveTo(x - rw * 0.86, ry - 8 * k, x - rw * 0.42, ry - 18 * k);
    ctx.lineTo(x - rw * 0.16, ry - 30 * k);
    ctx.lineTo(x + rw * 0.16, ry - 30 * k);
    ctx.lineTo(x + rw * 0.42, ry - 18 * k);
    ctx.quadraticCurveTo(x + rw * 0.86, ry - 8 * k, x + rw, ry + 3 * k);
    ctx.closePath();
    ctx.fillStyle = '#5a6570';
    ctx.fill();
    /* 용마루 */
    ctx.fillStyle = '#78838e';
    ctx.fillRect(x - rw * 0.20, ry - 33 * k, rw * 0.40, 5 * k);
    /* 기왓골 */
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 1.4 * k;
    for (var t = -3; t <= 3; t++) {
      ctx.beginPath();
      ctx.moveTo(x + rw * 0.055 * t, ry - 29 * k);
      ctx.lineTo(x + rw * 0.26 * t, ry - 1 * k);
      ctx.stroke();
    }

    /* 간판 */
    ctx.fillStyle = wall;
    ctx.fillRect(x - 17 * k, ry + 6 * k, 34 * k, 13 * k);
    ctx.fillStyle = '#fff6e2';
    ctx.font = '700 ' + Math.round(10 * k) + 'px "Malgun Gothic", system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x, ry + 13 * k);
    ctx.textBaseline = 'alphabetic';
  }

  /** 잡초 — 뾰족한 잎 몇 장. 마을이 거칠어 보여야 뽑고 싶어진다 */
  function drawWeed(x, y, k, prop, sway) {
    var h = core.hash2(prop.x, prop.y);
    shadow(x, y + 1 * k, 7 * k, 2.4 * k);
    ctx.strokeStyle = h > 0.5 ? '#5f7a3a' : '#6f8a42';
    ctx.lineWidth = 2 * k;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (var i = -2; i <= 2; i++) {
      var lean = i * 0.26 + sway * 3;
      ctx.moveTo(x + i * 2.4 * k, y);
      ctx.quadraticCurveTo(x + i * 4 * k + lean * 4 * k, y - 9 * k,
                           x + i * 6 * k + lean * 9 * k, y - 15 * k);
    }
    ctx.stroke();
  }

  /**
   * 갈라진 자리 — 원작에서 삽을 들고 파던 그 자리다.
   * **날마다 자리가 바뀐다.** 파고 나면 메운 흙이 남는다.
   */
  function drawDig(x, y, k, spent) {
    ctx.beginPath();
    ctx.ellipse(x, y, 15 * k, 6 * k, 0, 0, Math.PI * 2);
    ctx.fillStyle = spent ? '#8a6a48' : '#6a4e33';
    ctx.fill();
    if (spent) {                                   // 메운 자리 — 흙이 봉긋하다
      ctx.beginPath();
      ctx.ellipse(x, y - 2 * k, 11 * k, 4.5 * k, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#9a7a56';
      ctx.fill();
      return;
    }
    ctx.strokeStyle = '#3f2c1c';                   // 갈라진 금 — 별 모양으로 뻗는다
    ctx.lineWidth = 1.6 * k;
    ctx.lineCap = 'round';
    for (var i = 0; i < 5; i++) {
      var a = (i / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 12 * k, y + Math.sin(a) * 5 * k);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.ellipse(x, y - 1.6 * k, 13 * k, 4.4 * k, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  /** 조개 — 모래밭에 떨어져 있다. 부챗살이 있어야 조개로 보인다 */
  function drawShell(x, y, k, prop) {
    var tint = core.hash2(prop.x, prop.y);
    var c = tint > 0.66 ? '#f0d8c4' : tint > 0.33 ? '#e8c8b0' : '#f4e6d2';
    shadow(x, y + 1 * k, 8 * k, 3 * k);
    ctx.beginPath();
    ctx.moveTo(x - 9 * k, y);
    ctx.quadraticCurveTo(x - 9 * k, y - 13 * k, x, y - 13 * k);
    ctx.quadraticCurveTo(x + 9 * k, y - 13 * k, x + 9 * k, y);
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,110,80,0.45)';
    ctx.lineWidth = 1 * k;
    for (var i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y - 12 * k);
      ctx.lineTo(x + i * 4 * k, y - 0.5 * k);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - 9 * k, y); ctx.lineTo(x + 9 * k, y);
    ctx.stroke();
  }

  /**
   * 내 집 — **넓힐수록 겉모습이 달라진다.**
   * 단칸방은 초가지붕이고, 증축하면 기와가 올라간다. 원작에서 집이 커지는 그 재미가
   * 안에만 있으면 반쪽이다 — 마을을 걷다가 눈에 들어와야 한다.
   */
  function drawMyHouse(x, y, k) {
    var t = global.DG.home ? global.DG.home.state().tier : 0;
    var bw = (38 + t * 7) * k, bh = (30 + t * 3) * k;
    var thatch = t === 0;
    shadow(x, y + 4 * k, bw * 0.9, 9 * k);

    ctx.fillStyle = '#efe3cd';                     // 흙벽
    ctx.fillRect(x - bw * 0.8, y - bh, bw * 1.6, bh);
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(x - bw * 0.8, y - bh * 0.28, bw * 1.6, bh * 0.28);
    ctx.fillStyle = '#8a6440';                     // 기둥
    ctx.fillRect(x - bw * 0.8, y - bh, 5 * k, bh);
    ctx.fillRect(x + bw * 0.8 - 5 * k, y - bh, 5 * k, bh);
    ctx.fillStyle = '#f6efdd';                     // 문
    ctx.fillRect(x - 11 * k, y - bh * 0.82, 22 * k, bh * 0.74);
    ctx.strokeStyle = 'rgba(120,90,60,0.5)';
    ctx.lineWidth = 1.1 * k;
    ctx.beginPath();
    ctx.moveTo(x, y - bh * 0.82); ctx.lineTo(x, y - bh * 0.08);
    ctx.stroke();

    var ry = y - bh, rw = bw * 1.18;
    if (thatch) {                                  // 초가 — 둥글게 얹은 볏짚
      ctx.beginPath();
      ctx.moveTo(x - rw, ry + 3 * k);
      ctx.quadraticCurveTo(x - rw * 0.62, ry - 26 * k, x, ry - 27 * k);
      ctx.quadraticCurveTo(x + rw * 0.62, ry - 26 * k, x + rw, ry + 3 * k);
      ctx.closePath();
      ctx.fillStyle = '#c8a25c';
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,110,50,0.45)';
      ctx.lineWidth = 1.2 * k;
      for (var i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + rw * 0.10 * i, ry - 24 * k);
        ctx.lineTo(x + rw * 0.30 * i, ry + 1 * k);
        ctx.stroke();
      }
    } else {                                       // 기와
      ctx.beginPath();
      ctx.moveTo(x - rw, ry + 3 * k);
      ctx.quadraticCurveTo(x - rw * 0.84, ry - 7 * k, x - rw * 0.40, ry - 16 * k);
      ctx.lineTo(x - rw * 0.14, ry - 26 * k);
      ctx.lineTo(x + rw * 0.14, ry - 26 * k);
      ctx.lineTo(x + rw * 0.40, ry - 16 * k);
      ctx.quadraticCurveTo(x + rw * 0.84, ry - 7 * k, x + rw, ry + 3 * k);
      ctx.closePath();
      ctx.fillStyle = '#5a6570';
      ctx.fill();
      ctx.fillStyle = '#78838e';
      ctx.fillRect(x - rw * 0.18, ry - 29 * k, rw * 0.36, 4.5 * k);
      ctx.strokeStyle = 'rgba(255,255,255,0.13)';
      ctx.lineWidth = 1.3 * k;
      for (var j = -3; j <= 3; j++) {
        ctx.beginPath();
        ctx.moveTo(x + rw * 0.05 * j, ry - 25 * k);
        ctx.lineTo(x + rw * 0.25 * j, ry - 1 * k);
        ctx.stroke();
      }
    }
  }

  /**
   * 우편함 — **안 읽은 편지가 있으면 깃발이 선다.**
   * 원작의 그 빨간 깃발이다. 우편함까지 걸어가 열어 봐야 아는 건 불친절하다.
   */
  function kindK(kind, k) { return kind === 'shop' ? k * (1 + global.DG.village.shopLevel().n * 0.10) : (kind === 'home' && global.DG.home ? k * (1 + global.DG.home.state().tier * 0.12) : k); }   // W-0124 통일 스프라이트가 그려지면 switch 를 건너뛰어 가게 크기 성장·집 등급·편지 깃발이 사라졌다(d59440063)
  function kindOver(kind, x, y, k, now) { if (kind === 'mail') { mailFlag(x, y, k, now, global.DG.mail ? global.DG.mail.unread() : 0); } return true; }
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
    if (!(global.DG.actor2d && global.DG.actor2d.draw(ctx, 'me', me.ref, 'me', p.x, p.y - lift, 1 * k, { facing: p0.facing, dirX: p0.dirX, dirY: p0.dirY, moving: p0.walking, phase: p0.phase, now: now }))) global.DG.sprite.stamp(ctx, {
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
      ctx.fillText('🐾', p.x - 22 * k, p.y + 6 * k);
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
  function bubble(text, x, y, fg, bg) {
    ctx.save();
    ctx.font = '700 12.5px "Malgun Gothic", system-ui';
    var w = ctx.measureText(text).width + 18;
    var h = 21, rr = h * 0.5;
    var l = x - w * 0.5, t = y - h * 0.5;

    ctx.beginPath();
    ctx.moveTo(l + rr, t);
    ctx.lineTo(l + w - rr, t);
    ctx.quadraticCurveTo(l + w, t, l + w, t + rr);
    ctx.lineTo(l + w, t + h - rr);
    ctx.quadraticCurveTo(l + w, t + h, l + w - rr, t + h);
    ctx.lineTo(x + 5, t + h);
    ctx.lineTo(x, t + h + 6);
    ctx.lineTo(x - 5, t + h);
    ctx.lineTo(l + rr, t + h);
    ctx.quadraticCurveTo(l, t + h, l, t + h - rr);
    ctx.lineTo(l, t + rr);
    ctx.quadraticCurveTo(l, t, l + rr, t);
    ctx.closePath();

    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.save(); ctx.translate(0, 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = bg || '#ffffff';
    ctx.fill();

    ctx.fillStyle = fg || '#39414c';
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
    switch (ref.form) {
      case 'butterfly': bugButterfly(cx, cy, k, ref, b, now); break;
      case 'ladybug':   bugLadybug(cx, cy, k, ref); break;
      case 'beetle':    bugBeetle(cx, cy, k, ref); break;
      case 'dragonfly': bugDragonfly(cx, cy, k, ref, b, now); break;
      case 'firefly':   bugFirefly(cx, cy, k, ref, b, ph, now); break;
      case 'cicada':    bugCicada(cx, cy, k, ref); break;
      case 'wasp':      bugWasp(cx, cy, k, ref, b, now); break;
      case 'snail':     bugSnail(cx, cy, k, ref); break;
      case 'hopper':    bugHopper(cx, cy, k, ref); break;
      default:          bugSpider(cx, cy, k, ref);
    }
    ctx.restore();

    if (b.chase) {
      bubble('벌떼! 달아나거나 ' + core.actHint() + ' 로 받아친다', cx, cy - 36 * k, '#8a2020', '#ffe2e2');
    } else if (f && f.type === 'bug' && f.obj === b) {
      var net = global.DG.bug.hasNet();
      ring(cx, p.y + 2 * k, k * 0.8, net ? 'rgba(255,240,150,.95)' : 'rgba(220,120,120,.9)');
      bubble(net ? ref.name + ' — 휘두른다 [' + core.actHint() + ']' : '🥅 잠자리채가 없다 (전방)',
        cx, cy - 34 * k, net ? '#6a5200' : '#8a2020', net ? '#fff6cc' : '#ffe2e2');
    } else if (b.state === 'flee') {
      bubble('달아난다!', cx, cy - 30 * k, '#8a2020', '#ffe2e2');
    }
  }

  function bugButterfly(x, y, k, ref, b, now) {
    var flap = Math.abs(Math.sin(now / 95 + b.wob));
    var ww = 8 * k * (0.30 + 0.70 * flap);
    ctx.fillStyle = ref.wing;
    ctx.beginPath();
    ctx.ellipse(x - ww * 0.85, y - 2 * k, ww, 6.5 * k, -0.3, 0, Math.PI * 2);
    ctx.ellipse(x + ww * 0.85, y - 2 * k, ww, 6.5 * k, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dark(ref.wing, 0.18);
    ctx.beginPath();
    ctx.ellipse(x - ww * 0.72, y + 4 * k, ww * 0.72, 4 * k, -0.2, 0, Math.PI * 2);
    ctx.ellipse(x + ww * 0.72, y + 4 * k, ww * 0.72, 4 * k, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ref.body;
    ctx.beginPath();
    ctx.ellipse(x, y, 1.7 * k, 6 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ref.body;
    ctx.lineWidth = 0.9 * k;
    ctx.beginPath();
    ctx.moveTo(x - 0.6 * k, y - 5 * k); ctx.lineTo(x - 3.4 * k, y - 9 * k);
    ctx.moveTo(x + 0.6 * k, y - 5 * k); ctx.lineTo(x + 3.4 * k, y - 9 * k);
    ctx.stroke();
  }

  function bugLadybug(x, y, k, ref) {
    ctx.fillStyle = ref.wing;
    ctx.beginPath();
    ctx.ellipse(x, y, 6 * k, 6.6 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ref.body;
    ctx.lineWidth = 1 * k;
    ctx.beginPath(); ctx.moveTo(x, y - 6 * k); ctx.lineTo(x, y + 6 * k); ctx.stroke();
    ctx.fillStyle = ref.body;
    var sp = [[-2.6, -1.6], [2.6, -1.2], [-2.2, 2.6], [2.4, 2.4]];
    for (var i = 0; i < sp.length; i++) {
      ctx.beginPath();
      ctx.arc(x + sp[i][0] * k, y + sp[i][1] * k, 1.3 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y - 6 * k, 3 * k, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  function bugBeetle(x, y, k, ref) {
    ctx.fillStyle = ref.wing;
    ctx.beginPath();
    ctx.ellipse(x, y + 1 * k, 6 * k, 8.5 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = light(ref.wing, 0.20);
    ctx.beginPath();
    ctx.ellipse(x - 2.2 * k, y - 1 * k, 2 * k, 5 * k, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ref.body;
    ctx.beginPath();
    ctx.ellipse(x, y - 7 * k, 4 * k, 3.4 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ref.body;
    ctx.lineWidth = 1.4 * k;
    ctx.lineCap = 'round';
    if (ref.horn) {                       /* 장수풍뎅이 — 앞으로 뻗은 뿔 */
      ctx.beginPath();
      ctx.moveTo(x, y - 9 * k);
      ctx.quadraticCurveTo(x + 1 * k, y - 15 * k, x - 1.6 * k, y - 17 * k);
      ctx.stroke();
    } else if (ref.jaw) {                 /* 사슴벌레 — 벌어진 큰턱 */
      ctx.beginPath();
      ctx.moveTo(x - 2.4 * k, y - 9 * k);
      ctx.quadraticCurveTo(x - 6 * k, y - 13 * k, x - 2.6 * k, y - 16 * k);
      ctx.moveTo(x + 2.4 * k, y - 9 * k);
      ctx.quadraticCurveTo(x + 6 * k, y - 13 * k, x + 2.6 * k, y - 16 * k);
      ctx.stroke();
    }
    ctx.lineWidth = 1 * k;
    for (var i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 5 * k, y + i * 3.4 * k); ctx.lineTo(x - 9 * k, y + i * 3.4 * k - 1.6 * k);
      ctx.moveTo(x + 5 * k, y + i * 3.4 * k); ctx.lineTo(x + 9 * k, y + i * 3.4 * k - 1.6 * k);
      ctx.stroke();
    }
  }

  function bugDragonfly(x, y, k, ref, b, now) {
    var flap = Math.sin(now / 55 + b.wob) * 0.28;
    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = ref.wing;
    var wing = function (dx, dy, ang) {
      ctx.beginPath();
      ctx.ellipse(x + dx * k, y + dy * k, 10 * k, 2.4 * k, ang, 0, Math.PI * 2);
      ctx.fill();
    };
    wing(-8, -3, -0.18 + flap); wing(8, -3, 0.18 - flap);
    wing(-8, 2, 0.16 + flap);   wing(8, 2, -0.16 - flap);
    ctx.restore();
    ctx.fillStyle = ref.body;
    ctx.beginPath();
    ctx.ellipse(x, y + 4 * k, 1.5 * k, 9 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - 6 * k, 3 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(x - 1.2 * k, y - 7 * k, 1 * k, 0, Math.PI * 2);
    ctx.fill();
  }

  function bugFirefly(x, y, k, ref, b, ph, now) {
    var night = ph.key === 'night' || ph.key === 'even' || ph.key === 'dawn';
    var pulse = 0.45 + 0.55 * Math.abs(Math.sin(now / 520 + b.wob));
    if (night) {
      var g = ctx.createRadialGradient(x, y + 3 * k, 0, x, y + 3 * k, 22 * k);
      g.addColorStop(0, 'rgba(246,240,150,' + (0.85 * pulse).toFixed(2) + ')');
      g.addColorStop(0.45, 'rgba(200,230,120,' + (0.30 * pulse).toFixed(2) + ')');
      g.addColorStop(1, 'rgba(180,220,110,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y + 3 * k, 22 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = ref.body;
    ctx.beginPath();
    ctx.ellipse(x, y, 2.2 * k, 5 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = night ? 'rgba(250,246,170,' + (0.6 + 0.4 * pulse).toFixed(2) + ')' : '#c8c86a';
    ctx.beginPath();
    ctx.ellipse(x, y + 3.4 * k, 2 * k, 2.6 * k, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function bugCicada(x, y, k, ref) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = ref.wing;
    ctx.beginPath();
    ctx.moveTo(x, y - 6 * k); ctx.lineTo(x - 6 * k, y + 8 * k); ctx.lineTo(x + 1 * k, y + 7 * k);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - 6 * k); ctx.lineTo(x + 6 * k, y + 8 * k); ctx.lineTo(x - 1 * k, y + 7 * k);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = ref.body;
    ctx.beginPath();
    ctx.ellipse(x, y, 3 * k, 7 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - 6.4 * k, 3 * k, 0, Math.PI * 2);
    ctx.fill();
  }

  function bugHopper(x, y, k, ref) {
    ctx.fillStyle = ref.wing;
    ctx.beginPath();
    ctx.ellipse(x, y, 3 * k, 8.5 * k, 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ref.body;
    ctx.beginPath();
    ctx.ellipse(x + 2.4 * k, y - 6.5 * k, 2.6 * k, 3.4 * k, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ref.body;
    ctx.lineWidth = 1.6 * k;
    ctx.lineCap = 'round';
    ctx.beginPath();                       /* 뒷다리 — 방아깨비의 그 각진 다리 */
    ctx.moveTo(x - 1 * k, y + 1 * k);
    ctx.lineTo(x - 6 * k, y - 3 * k);
    ctx.lineTo(x - 4 * k, y + 8 * k);
    ctx.stroke();
    ctx.lineWidth = 1 * k;
    ctx.beginPath();
    ctx.moveTo(x + 1 * k, y + 2 * k); ctx.lineTo(x + 5 * k, y + 7 * k);
    ctx.moveTo(x + 2 * k, y - 3 * k); ctx.lineTo(x + 6 * k, y - 1 * k);
    ctx.stroke();
  }

  /**
   * 말벌 — 한 마리가 아니라 **떼**다. 작은 놈 넷이 성을 내며 붙어 다닌다.
   * 쫓아오는 중이니 뒤에 성난 획 두 줄을 남긴다.
   */
  /** 달팽이 — 비 오는 날의 그것. 껍데기 소용돌이가 있어야 달팽이로 보인다 */
  function bugSnail(x, y, k, ref) {
    ctx.fillStyle = ref.body;                        // 몸
    ctx.beginPath();
    ctx.moveTo(x - 9 * k, y);
    ctx.quadraticCurveTo(x - 11 * k, y - 5 * k, x - 6 * k, y - 5 * k);
    ctx.lineTo(x + 7 * k, y - 3 * k);
    ctx.quadraticCurveTo(x + 10 * k, y, x + 7 * k, y + 1 * k);
    ctx.lineTo(x - 8 * k, y + 1 * k);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ref.body;                      // 더듬이
    ctx.lineWidth = 1 * k;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 8 * k, y - 4 * k); ctx.lineTo(x - 11 * k, y - 9 * k);
    ctx.moveTo(x - 5 * k, y - 5 * k); ctx.lineTo(x - 6 * k, y - 10 * k);
    ctx.stroke();
    ctx.fillStyle = ref.wing;                        // 껍데기
    ctx.beginPath();
    ctx.arc(x + 2 * k, y - 5 * k, 6 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,90,60,0.6)';
    ctx.lineWidth = 1.1 * k;
    ctx.beginPath();
    for (var a = 0; a < Math.PI * 3.2; a += 0.25) {   // 소용돌이
      var rr = 0.9 * k + a * 0.9 * k;
      var px = x + 2 * k + Math.cos(a) * rr;
      var py = y - 5 * k + Math.sin(a) * rr;
      if (a === 0) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
    }
    ctx.stroke();
  }

  function bugWasp(x, y, k, ref, b, now) {
    var i;
    ctx.save();
    ctx.strokeStyle = 'rgba(40,30,20,0.35)';
    ctx.lineWidth = 1.6 * k;
    ctx.beginPath();
    ctx.moveTo(x - 20 * k, y - 6 * k); ctx.lineTo(x - 9 * k, y - 4 * k);
    ctx.moveTo(x - 18 * k, y + 4 * k); ctx.lineTo(x - 8 * k, y + 3 * k);
    ctx.stroke();
    for (i = 0; i < 4; i++) {
      var a = now / 130 + i * Math.PI * 0.5 + b.wob;
      var bx = x + Math.cos(a) * 8 * k;
      var by = y + Math.sin(a * 1.3) * 6 * k;
      ctx.fillStyle = ref.wing;                      // 노란 몸통
      ctx.beginPath();
      ctx.ellipse(bx, by, 3.2 * k, 2.4 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ref.body;                      // 검은 줄과 머리
      ctx.fillRect(bx - 0.8 * k, by - 2.4 * k, 1.6 * k, 4.8 * k);
      ctx.beginPath();
      ctx.arc(bx - 3.4 * k, by, 1.6 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(240,246,250,0.65)';      // 날개
      ctx.beginPath();
      ctx.ellipse(bx + 0.5 * k, by - 3 * k, 3 * k, 1.2 * k, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function bugSpider(x, y, k, ref) {
    ctx.strokeStyle = ref.wing;
    ctx.lineWidth = 1.1 * k;
    ctx.lineCap = 'round';
    for (var i = 0; i < 4; i++) {
      var yy = y - 3 * k + i * 2.2 * k;
      var sp = 6 * k + i * 0.6 * k;
      ctx.beginPath();
      ctx.moveTo(x - 2 * k, yy);
      ctx.quadraticCurveTo(x - sp, yy - 4 * k, x - sp - 1.5 * k, yy + 3 * k);
      ctx.moveTo(x + 2 * k, yy);
      ctx.quadraticCurveTo(x + sp, yy - 4 * k, x + sp + 1.5 * k, yy + 3 * k);
      ctx.stroke();
    }
    ctx.fillStyle = ref.body;
    ctx.beginPath();
    ctx.ellipse(x, y + 1 * k, 4.4 * k, 5 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - 4.6 * k, 2.6 * k, 0, Math.PI * 2);
    ctx.fill();
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
    order.push({ y: p.y, t: 'me', o: p });
    order.sort(function (a, b) { return a.y - b.y; });

    var f = V.focus();
    for (i = 0; i < order.length; i++) {
      if (order[i].t === 'f') { drawFurn(order[i].o, f, now); }
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

    var f = V.focus();
    for (i = 0; i < order.length; i++) {
      if (order[i].t === 'c') { drawChest(order[i].o, u); }
      else if (order[i].t === 'guard') { drawBossGuard(order[i].o, u); }
      else { drawMeIn(order[i].o, now); }
    }

    if (f && f.type === 'cavedoor') {
      bubble('밖으로 나간다 [' + core.actHint() + ']', dx, dtop - 14 * u, '#2a2622', '#e8dfce');
    }

    /* 어둑함 — 방 전체가 늘 밤이다(등잔이 없다) */
    ctx.fillStyle = 'rgba(8,6,4,0.38)';
    ctx.fillRect(0, 0, W, H);
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
    ctx.fillText('👹', q.x, q.y + 10 * u);
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
    if (!(global.DG.actor2d && global.DG.actor2d.draw(ctx, 'me', me.ref, 'me', q.x, q.y, k, { facing: p0.facing, dirX: p0.dirX, dirY: p0.dirY, moving: p0.walking, phase: p0.phase, now: now }))) global.DG.sprite.stamp(ctx, {
      kind: 'human', ref: me.ref, x: q.x, y: q.y, s: k,
      facing: p0.facing, phase: p0.phase, walking: p0.walking,
      color: me.color, look: me.look,
      rarity: me.rarity, t: now
    });
  }

  /* ── 가구 ─────────────────────────────────────────────────
   * 이모지가 아니라 도형이다 — 마을의 사물과 같은 규칙이다.
   * 치수는 방 단위(한 칸 40)로 적고 inSc 로 함께 커진다.
   */
  function drawFurn(item, f, now) {
    var d = VD.furn(item.key);
    if (!d) { return; }
    var q = projIn(item.x, item.y);
    var u = inSc;
    var focused = f && f.type === 'furn' && f.obj === item;

    shadow(q.x, q.y + 2 * u, 15 * u, 5 * u);
    var set = VD.FURN_SETS[d.set] || { color: '#a07850' };
    switch (d.form) {
      case 'table':    furnTable(q.x, q.y, u, d); break;
      case 'chest':    furnChest(q.x, q.y, u, d); break;
      case 'vase':     furnVase(q.x, q.y, u, d); break;
      case 'screen':   furnScreen(q.x, q.y, u); break;
      case 'scroll':   furnScroll(q.x, q.y, u); break;
      case 'brazier':  furnBrazier(q.x, q.y, u, now); break;
      case 'lamp':     furnLamp(q.x, q.y, u, now); break;
      case 'plant':    furnPlant(q.x, q.y, u); break;
      case 'cushion':  furnCushion(q.x, q.y, u, set); break;
      case 'bedding':  furnBedding(q.x, q.y, u, set); break;
      default:         furnGayageum(q.x, q.y, u); break;
    }
    if (focused) {
      ring(q.x, q.y + 2 * u, u * 0.8, 'rgba(255,206,92,.95)');
      var actLabel = d.bed ? '잠든다' : '거둔다';
      bubble(d.name + ' — ' + actLabel + ' [' + core.actHint() + ']', q.x, q.y - 52 * u, '#8a5a10', '#fff0c9');
    }
  }

  function furnTable(x, y, u, d) {
    var w = d.key === 'badukpan' ? 28 : 24;
    ctx.fillStyle = '#7a5030';
    ctx.fillRect(x - w * 0.42 * u, y - 8 * u, 3 * u, 8 * u);
    ctx.fillRect(x + w * 0.42 * u - 3 * u, y - 8 * u, 3 * u, 8 * u);
    ctx.fillStyle = '#b5793f';
    roundRect(x - w * 0.5 * u, y - 15 * u, w * u, 8 * u, 3 * u);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(x - w * 0.5 * u + 2 * u, y - 14 * u, w * u - 4 * u, 2.6 * u, 1.2 * u);
    ctx.fill();
    if (d.key === 'badukpan') {                     /* 바둑판 — 줄까지 긋는다 */
      ctx.strokeStyle = 'rgba(60,40,20,0.45)';
      ctx.lineWidth = 0.8 * u;
      for (var i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(x - w * 0.5 * u + (w * u / 5) * i, y - 14.4 * u);
        ctx.lineTo(x - w * 0.5 * u + (w * u / 5) * i, y - 7.6 * u);
        ctx.stroke();
      }
    }
  }

  function furnChest(x, y, u, d) {
    var h = d.key === 'bandaji' ? 24 : 20;
    ctx.fillStyle = '#8a5a34';
    roundRect(x - 14 * u, y - h * u, 28 * u, h * u, 2 * u);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(x - 14 * u, y - h * 0.42 * u, 28 * u, 1.6 * u);
    ctx.fillStyle = '#c8a25c';                      /* 장석 */
    ctx.fillRect(x - 3 * u, y - h * 0.52 * u, 6 * u, 5 * u);
    ctx.beginPath();
    ctx.arc(x, y - h * 0.30 * u, 2.4 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x - 14 * u, y - h * u, 28 * u, 2.4 * u);
  }

  function furnVase(x, y, u, d) {
    var tall = d.key === 'mulhang' ? 22 : 26;
    ctx.beginPath();
    ctx.moveTo(x - 4 * u, y - tall * u);
    ctx.quadraticCurveTo(x - 13 * u, y - tall * 0.62 * u, x - 9 * u, y - 2 * u);
    ctx.lineTo(x + 9 * u, y - 2 * u);
    ctx.quadraticCurveTo(x + 13 * u, y - tall * 0.62 * u, x + 4 * u, y - tall * u);
    ctx.closePath();
    ctx.fillStyle = d.key === 'mulhang' ? '#8a6a4a' : '#dfe6e2';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(x - 4 * u, y - tall * 0.52 * u, 2.2 * u, 6 * u, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,90,110,0.35)';
    ctx.lineWidth = 1 * u;
    ctx.beginPath();
    ctx.ellipse(x, y - tall * u, 4 * u, 1.6 * u, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function furnScreen(x, y, u) {
    var pw = 12, ph2 = 34;
    for (var i = -1; i <= 1; i++) {
      var px = x + i * pw * 0.94 * u;
      var lean = Math.abs(i) * 2 * u;
      ctx.fillStyle = '#6f4e30';
      ctx.fillRect(px - pw * 0.5 * u, y - ph2 * u + lean, pw * u, ph2 * u - lean);
      ctx.fillStyle = '#efe4cc';
      ctx.fillRect(px - pw * 0.5 * u + 1.6 * u, y - ph2 * u + lean + 1.6 * u,
                   pw * u - 3.2 * u, ph2 * u - lean - 3.2 * u);
      ctx.strokeStyle = 'rgba(70,90,80,0.45)';      /* 산수 몇 획 */
      ctx.lineWidth = 1 * u;
      ctx.beginPath();
      ctx.moveTo(px - 3 * u, y - ph2 * 0.42 * u);
      ctx.quadraticCurveTo(px, y - ph2 * 0.62 * u, px + 3 * u, y - ph2 * 0.40 * u);
      ctx.stroke();
    }
  }

  function furnScroll(x, y, u) {
    ctx.fillStyle = '#6f4e30';                      /* 걸이 */
    ctx.fillRect(x - 1.5 * u, y - 12 * u, 3 * u, 12 * u);
    ctx.fillRect(x - 9 * u, y - 2 * u, 18 * u, 2.4 * u);
    ctx.fillRect(x - 8 * u, y - 34 * u, 16 * u, 2.6 * u);
    ctx.fillStyle = '#f4ecd8';
    ctx.fillRect(x - 6.5 * u, y - 32 * u, 13 * u, 20 * u);
    ctx.fillStyle = '#6f4e30';
    ctx.fillRect(x - 8 * u, y - 12.6 * u, 16 * u, 2.2 * u);
    ctx.strokeStyle = 'rgba(60,50,40,0.55)';        /* 글씨 한 줄 */
    ctx.lineWidth = 1.1 * u;
    ctx.beginPath();
    ctx.moveTo(x, y - 29 * u); ctx.lineTo(x, y - 16 * u);
    ctx.stroke();
  }

  function furnBrazier(x, y, u, now) {
    ctx.strokeStyle = '#5a4436';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(x - 7 * u, y - 6 * u); ctx.lineTo(x - 9 * u, y);
    ctx.moveTo(x + 7 * u, y - 6 * u); ctx.lineTo(x + 9 * u, y);
    ctx.stroke();
    ctx.fillStyle = '#7a6a5a';
    roundRect(x - 11 * u, y - 16 * u, 22 * u, 11 * u, 3 * u);
    ctx.fill();
    ctx.fillStyle = '#3a2a20';
    ctx.beginPath();
    ctx.ellipse(x, y - 16 * u, 10 * u, 3.4 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    var fl = 0.8 + Math.abs(Math.sin(now / 180)) * 0.5;
    ctx.fillStyle = 'rgba(255,150,60,0.9)';
    ctx.beginPath();
    ctx.ellipse(x, y - 18 * u, 5 * u, 4 * u * fl, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,225,140,0.9)';
    ctx.beginPath();
    ctx.ellipse(x, y - 18 * u, 2.4 * u, 2.2 * u * fl, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function furnLamp(x, y, u, now) {
    ctx.fillStyle = '#6a5a48';
    ctx.beginPath();
    ctx.ellipse(x, y - 2 * u, 7 * u, 2.6 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 1.6 * u, y - 22 * u, 3.2 * u, 20 * u);
    ctx.fillStyle = '#8a7a64';
    ctx.beginPath();
    ctx.ellipse(x, y - 23 * u, 7 * u, 2.8 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    var fl = 0.75 + Math.abs(Math.sin(now / 220)) * 0.45;
    ctx.fillStyle = 'rgba(255,200,110,0.95)';
    ctx.beginPath();
    ctx.moveTo(x, y - 34 * u * fl);
    ctx.quadraticCurveTo(x + 3.4 * u, y - 26 * u, x, y - 24 * u);
    ctx.quadraticCurveTo(x - 3.4 * u, y - 26 * u, x, y - 34 * u * fl);
    ctx.fill();
  }

  function furnPlant(x, y, u) {
    ctx.fillStyle = '#a8613c';
    ctx.beginPath();
    ctx.moveTo(x - 8 * u, y - 12 * u);
    ctx.lineTo(x + 8 * u, y - 12 * u);
    ctx.lineTo(x + 6 * u, y);
    ctx.lineTo(x - 6 * u, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c07349';
    ctx.fillRect(x - 9 * u, y - 14 * u, 18 * u, 3 * u);
    ctx.fillStyle = '#4f9a44';
    for (var i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(x + i * 6 * u, y - 22 * u - Math.abs(i) * -2 * u,
        4 * u, 9 * u, i * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function furnCushion(x, y, u, set) {
    ctx.fillStyle = set.color;
    roundRect(x - 13 * u, y - 8 * u, 26 * u, 9 * u, 3.5 * u);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    roundRect(x - 11 * u, y - 7 * u, 22 * u, 3 * u, 1.5 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,200,0.7)';      /* 술 */
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath();
    ctx.moveTo(x - 13 * u, y - 3 * u); ctx.lineTo(x - 16 * u, y - 1 * u);
    ctx.moveTo(x + 13 * u, y - 3 * u); ctx.lineTo(x + 16 * u, y - 1 * u);
    ctx.stroke();
  }

  /** §5.1 침구(요) — 넓게 편 요 위에 개켜 둔 이불, 머리맡에 베개 */
  function furnBedding(x, y, u, set) {
    ctx.fillStyle = set.color;
    roundRect(x - 20 * u, y - 9 * u, 40 * u, 11 * u, 4 * u);
    ctx.fill();
    ctx.fillStyle = '#f4ece0';                        /* 베개 */
    roundRect(x - 20 * u, y - 16 * u, 13 * u, 8 * u, 2.5 * u);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';         /* 개켜 둔 이불 */
    roundRect(x + 1 * u, y - 12 * u, 18 * u, 6 * u, 2 * u);
    ctx.fill();
  }

  function furnGayageum(x, y, u) {
    ctx.fillStyle = '#a8763f';
    ctx.beginPath();
    ctx.moveTo(x - 20 * u, y - 6 * u);
    ctx.quadraticCurveTo(x, y - 13 * u, x + 20 * u, y - 7 * u);
    ctx.lineTo(x + 19 * u, y - 1 * u);
    ctx.quadraticCurveTo(x, y - 7 * u, x - 19 * u, y - 1 * u);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(250,240,220,0.75)';
    ctx.lineWidth = 0.8 * u;
    for (var i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 19 * u, y - 5 * u + i * 1.1 * u);
      ctx.quadraticCurveTo(x, y - 11 * u + i * 1.1 * u, x + 19 * u, y - 6 * u + i * 1.1 * u);
      ctx.stroke();
    }
    ctx.fillStyle = '#6a4a2c';
    for (var j = -1; j <= 1; j++) {
      ctx.fillRect(x + j * 9 * u, y - 9 * u, 2 * u, 5 * u);
    }
  }


  /* ── 마을 기 ──────────────────────────────────────────────
   * 원작에서 마을 어귀에 서 있던 그 깃발이다. 바탕·무늬·무늬색 셋으로 그린다.
   * 바람에 흔들리는 것은 오른쪽으로 갈수록 크게 흔들리는 사인 하나면 충분하다.
   */
  function drawPole(x, y, k, now) {
    var T = global.DG.town;
    if (!T) { return; }
    var bg = T.flagBg(), fg = T.flagFg(), sym = T.flagSym();
    var h = 74 * k;

    shadow(x, y + 2 * k, 9 * k, 3.4 * k);
    ctx.fillStyle = '#8a6440';                       // 깃대
    ctx.fillRect(x - 2 * k, y - h, 4 * k, h);
    ctx.beginPath();                                 // 꼭대기 구슬
    ctx.arc(x, y - h - 3 * k, 3.4 * k, 0, Math.PI * 2);
    ctx.fillStyle = '#d8a63c';
    ctx.fill();

    /* 깃발 — 위아래 가장자리를 흔들어 천처럼 만든다 */
    var fw = 46 * k, fh = 30 * k, top = y - h + 6 * k;
    var wav = function (t) { return Math.sin(now / 260 + t * 3.4) * 3.2 * k * t; };
    ctx.beginPath();
    ctx.moveTo(x + 2 * k, top);
    for (var i = 0; i <= 8; i++) {
      var t = i / 8;
      ctx.lineTo(x + 2 * k + fw * t, top + wav(t));
    }
    for (var j = 8; j >= 0; j--) {
      var t2 = j / 8;
      ctx.lineTo(x + 2 * k + fw * t2, top + fh + wav(t2));
    }
    ctx.closePath();
    ctx.fillStyle = bg.c;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1 * k;
    ctx.stroke();

    ctx.save();
    ctx.clip();
    drawFlagSym(sym.key, x + 2 * k + fw * 0.5, top + fh * 0.5 + wav(0.5), fh * 0.34, fg.c);
    ctx.restore();
  }

  /** 깃발 무늬 한 점 — (cx, cy) 를 가운데로 반지름 r */
  function drawFlagSym(key, cx, cy, r, c) {
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    var i, a;
    switch (key) {
      case 'taegeuk':
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
        ctx.arc(cx, cy + r * 0.5, r * 0.5, Math.PI / 2, -Math.PI / 2, true);
        ctx.arc(cx, cy - r * 0.5, r * 0.5, Math.PI / 2, -Math.PI / 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'pine':
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.10, cy + r);
        ctx.lineTo(cx + r * 0.10, cy + r);
        ctx.lineTo(cx + r * 0.10, cy);
        ctx.lineTo(cx - r * 0.10, cy);
        ctx.closePath();
        ctx.fill();
        for (i = 0; i < 3; i++) {
          var yy = cy + r * 0.1 - i * r * 0.46;
          var wd = r * (0.9 - i * 0.22);
          ctx.beginPath();
          ctx.moveTo(cx - wd, yy);
          ctx.lineTo(cx + wd, yy);
          ctx.lineTo(cx, yy - r * 0.62);
          ctx.closePath();
          ctx.fill();
        }
        break;
      case 'crane':
        ctx.beginPath();                             // 나는 학 — 몸통과 두 날개
        ctx.ellipse(cx, cy + r * 0.1, r * 0.30, r * 0.60, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.1, cy);
        ctx.quadraticCurveTo(cx - r * 1.0, cy - r * 0.8, cx - r * 0.95, cy - r * 0.1);
        ctx.quadraticCurveTo(cx - r * 0.5, cy - r * 0.2, cx - r * 0.1, cy + r * 0.15);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + r * 0.1, cy);
        ctx.quadraticCurveTo(cx + r * 1.0, cy - r * 0.8, cx + r * 0.95, cy - r * 0.1);
        ctx.quadraticCurveTo(cx + r * 0.5, cy - r * 0.2, cx + r * 0.1, cy + r * 0.15);
        ctx.fill();
        ctx.beginPath();                             // 목
        ctx.moveTo(cx, cy - r * 0.35);
        ctx.quadraticCurveTo(cx + r * 0.35, cy - r * 0.9, cx + r * 0.6, cy - r * 0.75);
        ctx.stroke();
        break;
      case 'mount':
        ctx.beginPath();
        ctx.moveTo(cx - r, cy + r * 0.7);
        ctx.lineTo(cx - r * 0.32, cy - r * 0.55);
        ctx.lineTo(cx + r * 0.05, cy + r * 0.05);
        ctx.lineTo(cx + r * 0.42, cy - r * 0.85);
        ctx.lineTo(cx + r, cy + r * 0.7);
        ctx.closePath();
        ctx.fill();
        break;
      case 'wave':
        for (i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(cx - r, cy - r * 0.5 + i * r * 0.55);
          ctx.quadraticCurveTo(cx - r * 0.5, cy - r * 0.95 + i * r * 0.55,
                               cx, cy - r * 0.5 + i * r * 0.55);
          ctx.quadraticCurveTo(cx + r * 0.5, cy - r * 0.05 + i * r * 0.55,
                               cx + r, cy - r * 0.5 + i * r * 0.55);
          ctx.stroke();
        }
        break;
      case 'star':
        ctx.beginPath();
        for (i = 0; i < 10; i++) {
          a = -Math.PI / 2 + i * Math.PI / 5;
          var rr = i % 2 ? r * 0.42 : r;
          if (i === 0) { ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
          else { ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 'tiger':
        ctx.beginPath();                             // 범 발자국 — 발바닥과 발가락 넷
        ctx.ellipse(cx, cy + r * 0.35, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        for (i = 0; i < 4; i++) {
          a = -Math.PI * 0.82 + i * Math.PI * 0.21;
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72 + r * 0.1,
            r * 0.20, r * 0.26, a + Math.PI / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'stele':
        ctx.beginPath();                             // 사고비 — 윗머리가 둥근 비석과 새긴 글줄 셋
        ctx.moveTo(cx - r * 0.62, cy + r);
        ctx.lineTo(cx - r * 0.62, cy - r * 0.35);
        ctx.arc(cx, cy - r * 0.35, r * 0.62, Math.PI, 0);
        ctx.lineTo(cx + r * 0.62, cy + r);
        ctx.closePath();
        ctx.stroke();
        for (i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(cx - r * 0.3, cy - r * 0.3 + i * r * 0.4);
          ctx.lineTo(cx + r * 0.3, cy - r * 0.3 + i * r * 0.4);
          ctx.stroke();
        }
        break;
      default:
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }
  }

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
    flagIcon: flagIcon, flagIconOf: flagIconOf,
    init: init, draw: draw, resize: resize,
    /** 3D 가 켜져 2D 를 안 그릴 때도 카메라(좌표 변환 기준)는 사람을 따라간다 — 발열 대책(2026-09-24) */
    syncCam: function () { var p = V.raw().player; cam.x = p.x; cam.y = p.y; },
    /** 자가진단용 */
    _cam: function () { return cam; },
    _animalSprite: function (kind) { return ANIMAL_SPRITE[kind] || null; },
    _project: project,
    _unproject: unproject,
    _projectIn: projIn,
    _unprojectIn: unprojIn
  };
})(window);
