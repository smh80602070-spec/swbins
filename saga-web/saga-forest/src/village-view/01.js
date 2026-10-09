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

