/**
 * 사냥터 화면 — 옆에서 보는 2D
 * ---------------------------------------------------------------
 * 여기서는 **계산하지 않는다**. side.js 의 상태를 읽어 그리기만 한다.
 * 사람·짐승은 sprite.js 를 그대로 쓴다 (발 위치를 기준으로 붙는 스탬프라
 * 사이드스크롤에서도 그대로 맞는다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var S = null, SD = null;

  var cv = null, ctx = null, cv3d = null;
  var W = 0, H = 0, dpr = 1;
  var camX = 0;

  /** 화면 확대 — #stage(2D 조작·오버레이) 와 #stage3d(세계) 를 **똑같이** CSS
   *  transform 으로 키우고 줄인다. 두 캔버스는 같은 픽셀 좌표(camX)로 그려지므로
   *  카메라 수식은 한 자도 안 건드리고 이 둘을 나란히 스케일만 해도 그대로 맞는다 —
   *  side-view3d.js 머리말의 "좌표계를 두 벌 관리하지 않는다"를 깨지 않는 길이다 */
  var viewZoom = 1;
  var ZOOM_MIN = 0.65, ZOOM_MAX = 1.9;
  var zoomPointers = {}, pinchDist0 = 0;

  /** 보스전 확대(PLAN 20절) — 사람이 잡은 viewZoom 위에 **덧셈이 아니라 곱셈**으로
   *  얹는다(사람이 이미 줌아웃해 둔 상태라도 그 비율은 그대로 지키면서 살짝 더
   *  당긴다). 위 `applyZoomTransform()`과 같은 원리라 카메라 수식은 안 건드린다 */
  var bossZoomK = 0, lastBossZoomDrawT = 0, lastAppliedBossK = -1;
  var BOSS_ZOOM_EXTRA = 0.10;   // 최대 10% 더 당긴다 — 과하면 체력바가 위로 밀려난다

  function clamp01(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function zoomPointerCount() {
    var n = 0, k;
    for (k in zoomPointers) { if (Object.prototype.hasOwnProperty.call(zoomPointers, k)) { n++; } }
    return n;
  }
  function twoZoomPointerDist() {
    var ks = Object.keys(zoomPointers);
    if (ks.length < 2) { return 0; }
    var a = zoomPointers[ks[0]], b = zoomPointers[ks[1]];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function applyZoomTransform() {
    var t = 'scale(' + (viewZoom * (1 + bossZoomK * BOSS_ZOOM_EXTRA)).toFixed(3) + ')';
    if (cv) { cv.style.transform = t; }
    if (!cv3d) { cv3d = document.getElementById('stage3d'); }
    if (cv3d) { cv3d.style.transform = t; }
  }
  function setZoom(z) {
    viewZoom = clamp01(z, ZOOM_MIN, ZOOM_MAX);
    applyZoomTransform();
  }
  /** 지수 완화 한 걸음 — 순수 계산이라 자가진단이 실제 시간 없이 dt 를 손수
   *  먹여 본다(side-view3d.js 의 updatePerf/_feedPerf 와 같은 요령) */
  function stepBossZoom(hasBoss, dt) {
    var target = hasBoss ? 1 : 0;
    var speed = hasBoss ? 3.2 : 2.0;     // 들어갈 땐 조금 빠르게, 풀 땐 천천히
    bossZoomK += (target - bossZoomK) * Math.min(1, speed * dt);
    if (Math.abs(bossZoomK - target) < 0.002) { bossZoomK = target; }
    return bossZoomK;
  }
  /** 매 draw() 마다 부른다 — 보스가 있으면 서서히 당기고, 없어지면 서서히 푼다.
   *  프레임 간격을 손수 재서(이 파일에 dt 를 넘겨받는 자리가 없다) stepBossZoom 에 먹인다 */
  function updateBossZoom(hasBoss) {
    var now = Date.now();
    var dt = lastBossZoomDrawT ? Math.min(0.25, (now - lastBossZoomDrawT) / 1000) : 0;
    lastBossZoomDrawT = now;
    stepBossZoom(hasBoss, dt);
    if (Math.abs(bossZoomK - lastAppliedBossK) > 0.001) {
      lastAppliedBossK = bossZoomK;
      applyZoomTransform();
    }
  }

  function init(canvas) {
    S = global.DG.side;
    SD = global.DG.sideData;
    cv = canvas;
    ctx = cv.getContext('2d');
    resize();
    global.addEventListener('resize', resize);
    /* 화면 아래쪽 절반을 누르면 그 방향으로 달린다 (손가락 조작) — 손가락이 이미
       하나 걷기를 맡고 있으면 **둘째 손가락은 걷기 존을 건드리지 않는다**(onDown 의
       zoomPointerCount 검사). 그 둘째 손가락으로 핀치하면 확대·축소다.
       **손가락뿐인 기기에서는 이 존이 안 켜진다** — #touchpad(bindPad) 의 보이는
       단추가 대신 맡는다(onDown 의 touchOnly 검사). 핀치 확대·축소는 그대로 산다 */
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('wheel', function (e) {
      setZoom(viewZoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
      e.preventDefault();
    }, { passive: false });
    bindPad();
  }

  /** 손가락 조작판(#touchpad) — 눈에 보이는 단추 넷. 왼쪽 좌우는 그대로 켜고 끄면
   *  되지만, 위(▲)는 상황(줄·문 앞이면 오르기/들어가기, 아니면 점프)에 따라
   *  갈린다 — side-view.js 의 옛 apply('up') 과 같은 판단을 그대로 쓴다. */
  function bindPad() {
    var pad = document.getElementById('touchpad');
    if (!pad) { return; }
    var btns = pad.querySelectorAll('.pad-btn');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        var dir = btn.getAttribute('data-dir');
        var held = false;
        function press(e) {
          e.preventDefault();
          held = true;
          if (dir === 'up') {
            var s = S.status();
            if (s.climbing || s.rope || s.gate || s.npc || s.talk) { S.setInput('up', true); }
            else { S.setInput('jump', true); }
          } else {
            S.setInput(dir, true);
          }
          if (btn.setPointerCapture && e.pointerId !== undefined) {
            try { btn.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
          }
        }
        function release() {
          if (!held) { return; }
          held = false;
          S.setInput(dir, false);   // 'up' 이면 input.up 만 내린다 — jump() 는 누른 순간 이미 끝났다
        }
        btn.addEventListener('pointerdown', press);
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointercancel', release);
        btn.addEventListener('pointerleave', release);
      })(btns[i]);
    }
  }

  function resize() {
    dpr = Math.min(global.devicePixelRatio || 1, 2);
    W = global.innerWidth; H = global.innerHeight;
    miniBotAt = 0;
    cv.width = Math.floor(W * dpr);
    cv.height = Math.floor(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (global.DG.sideView3d) { global.DG.sideView3d.resize(); }
  }

  /**
   * 화면을 넷으로 나눠 읽는다 — **폰에는 방향키도 Space 도 없다.**
   *
   *      ┌─────────────────────┐
   *      │   위 45%  ↑ / 점프   │   줄·문 앞이면 오르기·들어가기, 아니면 점프
   *      ├──────┬───────┬──────┤
   *      │  ←   │   ↓   │  →   │   가운데 22% 가 ↓ 다
   *      └──────┴───────┴──────┘
   *
   * **↓ 자리를 뒤늦게 냈다.** 그전에는 아래쪽이 좌우뿐이라 폰에서 **줄을 타고 내려갈
   * 수도, 앉아 쉴 수도, 발판을 빠져나갈 수도 없었다** — 규칙은 다 있는데 손이 닿지
   * 않는 자리였다. 가운데를 좁게(22%) 잡은 것은 걷다가 잘못 눌리지 않게 하려는 것이다.
   */
  function readZone(e) {
    var r = cv.getBoundingClientRect();
    /* r.width/height 를 쓴다(W/H 가 아니라) — 확대(viewZoom) 로 캔버스가 화면에서
       실제로 차지하는 상자가 커지거나 작아져도 존 경계가 그대로 4:5:1... 비율을 지킨다 */
    var x = e.clientX - r.left, y = e.clientY - r.top;
    if (y < r.height * 0.45) { return 'up'; }
    if (x > r.width * 0.39 && x < r.width * 0.61) { return 'down'; }
    return x < r.width * 0.5 ? 'left' : 'right';
  }

  var zone = null, primaryId = null;

  function apply(z) {
    /* 누르고 있는 자리 하나만 켜 둔다 — 끌어서 옮기면 앞의 것이 꺼진다 */
    S.setInput('left', z === 'left');
    S.setInput('right', z === 'right');
    S.setInput('down', z === 'down');
    if (z === 'up') {
      var s = S.status();
      /* 줄·문 앞이면 오르기·들어가기, 아니면 점프. 점프는 누르는 순간 한 번이다 */
      if (s.climbing || s.rope || s.gate || s.npc || s.talk) { S.setInput('up', true); }
      else { S.setInput('jump', true); }
    } else {
      S.setInput('up', false);
    }
  }

  function onDown(e) {
    zoomPointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (zoomPointerCount() === 2) { pinchDist0 = twoZoomPointerDist(); }
    /* 손가락이 이미 하나 걷기를 맡고 있으면(둘째 손가락) 존은 안 건드린다 — 그 둘째
       손가락은 오직 핀치 확대 몫이다 */
    if (zoomPointerCount() > 1 || !S.active()) { return; }
    /* 손가락뿐인 기기는 #touchpad 의 보이는 단추가 이동을 맡는다 — 숨은 존을 겹쳐
       두면 단추 사이 빈 자리를 눌러도 걷어져 버린다(진단은 키보드 기기로 잡혀
       여기 안 걸린다 — core.touchOnly() 는 늘 false 다) */
    if (core.touchOnly()) { return; }
    primaryId = e.pointerId;
    zone = readZone(e);
    apply(zone);
    /* 손가락이 HUD 위를 지나도 안 끊긴다 (사가의숲에서 같은 자리를 밟았다) */
    if (cv.setPointerCapture && e.pointerId !== undefined) {
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    }
  }

  /** 누른 채 끌면 그쪽으로 — 손가락을 떼지 않고 방향을 바꾼다 */
  function onMove(e) {
    if (zoomPointers[e.pointerId]) { zoomPointers[e.pointerId] = { x: e.clientX, y: e.clientY }; }
    if (zoomPointerCount() === 2) {
      var nd = twoZoomPointerDist();
      if (pinchDist0 > 0 && nd > 0) { setZoom(viewZoom * (nd / pinchDist0)); }
      pinchDist0 = nd;
      return;
    }
    if (!S.active() || zone === null || e.pointerId !== primaryId) { return; }
    var z = readZone(e);
    if (z === zone) { return; }
    /* 끌어서 위로 올라가는 것은 점프로 읽지 않는다 — 걷다가 뛰어 버린다 */
    if (z === 'up' && zone !== 'up') {
      var s = S.status();
      if (!(s.climbing || s.rope || s.gate || s.npc || s.talk)) { return; }
    }
    zone = z;
    apply(zone);
  }

  function onUp(e) {
    if (e && e.pointerId !== undefined) { delete zoomPointers[e.pointerId]; }
    if (zoomPointerCount() < 2) { pinchDist0 = 0; }
    if (e && e.pointerId !== undefined && e.pointerId !== primaryId) { return; }
    primaryId = null;
    zone = null;
    S.setInput('left', false);
    S.setInput('right', false);
    S.setInput('up', false);
    S.setInput('down', false);
  }

  /* ── 그리기 ───────────────────────────────────────────── */

  function draw() {
    if (!ctx) { return; }
    var run = S.raw();
    if (!run) { ctx.clearRect(0, 0, W, H); return; }
    var stg = run.stage, p = run.player;

    updateBossZoom(!!run.boss);
    camX = core.clamp(p.x + S.P_W / 2 - W / 2, 0, Math.max(0, stg.width - W));
    /* 3D 바탕(side-view3d.js)이 살아 있으면 세계는 거기서 그린다 — 여기서는
       하늘·뒷배경·바닥·발판·사람·몹을 건너뛰고 오버레이(미니맵·보스체력·데미지숫자)만 남긴다.
       못 켜지면(WebGL 없음) use3d 가 false 라 옛 2D 가 그대로 돈다 */
    var use3d = !!(global.DG.sideView3d && global.DG.sideView3d.ready());

    /* 화면 흔들림 — **화면 층에만 있다.** side.js 는 'shake' 한 줄을 남길 뿐이고
       세기도 위상도 여기서 정한다. 그래서 흔들림을 꺼도 판정은 한 자도 안 바뀐다.
       (사가고의 duel.js 가 판정 층과 화면 층을 가른 것과 같은 자리다) */
    var sh2 = shakeOf(S.fx()), sx = 0, sy = 0;
    if (sh2 > 0.2) {
      var ph = Date.now() / 18;
      sx = Math.sin(ph) * sh2;
      sy = Math.cos(ph * 1.7) * sh2 * 0.6;
    }
    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));

    if (use3d) {
      ctx.clearRect(0, 0, W, H);
    } else {
      /* 하늘·뒷배경 — 2D 층 그림(K-0020)이 있으면 그것, 없으면(받는 중·자료 없음) 옛 도형 */
      var M2 = global.DG.mode2d, M2c = (global.DG.cfg && global.DG.cfg.mode2d) || {}, rg = (M2c.region || {})[stg.key], tl = (M2c.tile || {})[stg.mood || 'sky'];
      if (!(M2 && rg && M2.drawBg(ctx, { region: rg, camX: camX, W: W, H: H, base: stg.floor, only: null }))) {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, stg.sky[0]);
        g.addColorStop(1, stg.sky[1]);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        drawBackdrop(stg);
      }

      /* 바닥 — 타일이 있으면 타일 */
      ctx.fillStyle = stg.ground;
      ctx.fillRect(0, stg.floor, W, H - stg.floor);
      if (M2 && tl) { M2.fillTile(ctx, { id: tl, x: 0, y: stg.floor, w: W, h: H - stg.floor, dx: camX, scale: 0.25 }); }
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.fillRect(0, stg.floor, W, 5);
      ctx.fillStyle = 'rgba(40,32,24,0.35)';
      ctx.fillRect(0, stg.floor + 5, W, 2);

      /* 발판 */
      for (var i = 0; i < stg.plats.length; i++) {
        var pl = stg.plats[i];
        var x = pl[0] - camX;
        if (x + pl[2] < -40 || x > W + 40) { continue; }
        /* 원작의 발판 — 위에 잔디(밝은 띠) · 아래에 흙, 그리고 진한 테 한 줄 */
        ctx.fillStyle = stg.ground;
        ctx.fillRect(x, pl[1], pl[2], 16);
        ctx.fillStyle = 'rgba(255,255,255,0.34)';
        ctx.fillRect(x, pl[1], pl[2], 4);
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.fillRect(x, pl[1] + 16, pl[2], 6);
        ctx.strokeStyle = 'rgba(40,32,24,0.55)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.5, pl[1] + 0.5, pl[2] - 1, 16);
      }
    }

    drawRopes(stg);
    drawPortals(stg);

    /* 떨어진 것 */
    for (i = 0; i < run.drops.length; i++) {
      var d = run.drops[i];
      var def = SD.DROPS[d.kind];
      ctx.font = '18px "Segoe UI Emoji", system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(def.emoji, d.x - camX, d.y);
    }

    /* 적 */
    if (!(global.DG.sideView3d && global.DG.sideView3d.ready())) { drawDying(); }
    for (i = 0; i < run.enemies.length; i++) { drawEnemy(run.enemies[i]); }

    /* 날아오는 화살·탄환 — 이쪽 기탄과 색을 갈라 둔다(붉은 계열) */
    for (i = 0; i < (run.eshots || []).length; i++) {
      var es = run.eshots[i];
      var ex = es.x - camX;
      if (es.kind === 'magic') {
        /* 마법형(PLAN 13절) 구슬 — 활·탄환과 겹치지 않는 보랏빛, 옅은 테를
           둘러 "쫓아온다"는 느낌을 준다(homing) */
        ctx.beginPath();
        ctx.arc(ex, es.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(150,90,220,0.55)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex, es.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(210,170,255,0.95)';
        ctx.fill();
      } else if (es.kind === 'staff') {
        ctx.beginPath();
        ctx.arc(ex, es.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,190,120,0.95)';
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(240,210,170,0.95)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ex - es.dir * 11, es.y);
        ctx.lineTo(ex + es.dir * 5, es.y);
        ctx.stroke();
        ctx.fillStyle = '#e0705a';
        ctx.beginPath();
        ctx.moveTo(ex + es.dir * 9, es.y);
        ctx.lineTo(ex + es.dir * 3, es.y - 3.5);
        ctx.lineTo(ex + es.dir * 3, es.y + 3.5);
        ctx.closePath();
        ctx.fill();
      }
    }

    /* 기탄 */
    for (i = 0; i < run.shots.length; i++) {
      var sh = run.shots[i];
      var shx = sh.x - camX;
      if (sh.pierce && sh.ox !== undefined) {
        /* 관통 표시선(§5-7) — 화살(점 하나)과 달리, 꿰뚫는 것은 쏜 자리부터
           지금까지가 선으로 남아 "뚫고 지나간다"가 눈에 보인다 */
        var gTr = ctx.createLinearGradient(sh.ox - camX, sh.y, shx, sh.y);
        gTr.addColorStop(0, 'rgba(150,210,255,0)');
        gTr.addColorStop(1, 'rgba(150,210,255,0.45)');
        ctx.strokeStyle = gTr;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sh.ox - camX, sh.y);
        ctx.lineTo(shx, sh.y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(shx, sh.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(150,210,255,0.9)';
      ctx.fill();
    }

    drawMe(p);
    drawFx();
    ctx.restore();

    /* 흔들리지 않는 것 — 조작에 쓰는 것은 흔들리면 안 읽힌다 */
    drawBossBar();
    drawMiniMap(run);
    drawOuch();
    drawBossIntro();
    drawLevelUp();
    drawQuestDone();
    drawFadeOverlay();
  }

  /* 손맛 표준(§5-7) — 흔들림 세기 설정(0 없음·1 약·2 보통). 기본은 2(보통) —
     이 손잡이가 생기기 전부터 있던 세기를 그대로 유지해, 새로 값을 만지지
     않은 사람은 화면이 안 달라진다. side.js 는 'shake' 한 줄만 남기고
     세기·위상·이 설정은 전부 화면 층(여기)이 정한다. */
  function shakeSettings() {
    var s = core.save.settings || (core.save.settings = {});
    if (typeof s.shakeLevel !== 'number') { s.shakeLevel = 2; }
    return s;
  }
  function shakeLevel() { return shakeSettings().shakeLevel; }
  function setShakeLevel(v) {
    var s = shakeSettings();
    s.shakeLevel = Math.max(0, Math.min(2, v | 0));
    core.persist();
    return s.shakeLevel;
  }
  function shakeMul() { var lv = shakeLevel(); return lv === 0 ? 0 : (lv === 1 ? 0.5 : 1); }

  /** 지금 얼마나 흔들려야 하나 — fx 의 남은 목숨에서 곧바로 낸다(따로 상태를 안 둔다).
   *  §5-7(2026-09-19) — side.js 가 `amt`·`span` 을 실어 오면 그 값을 그대로 쓰고
   *  (모든 타격에 2px/80ms, 급소·거함타는 더 크게), 안 실려 있으면(보스킬·피격
   *  같은 옛 호출) `big` 이진값으로 옛 두 단계 그대로 돌아간다 — 그 호출부는
   *  안 건드렸다. */
  function shakeOf(list) {
    var amp = 0, i;
    for (i = 0; i < list.length; i++) {
      var f = list[i];
      if (f.t !== 'shake') { continue; }
      var span = f.span || (f.big ? 0.22 : 0.18);
      var mag = f.amt !== undefined ? f.amt : (f.big ? 8 : 3.6);
      amp = Math.max(amp, mag * Math.min(1, Math.max(0, f.life / span)));
    }
    return amp * shakeMul();
  }

  /** 맞았을 때 화면 가장자리가 붉어진다 — 체력 막대를 안 봐도 안다 */
  function drawOuch() {
    var list = S.fx(), a = 0, i;
    for (i = 0; i < list.length; i++) {
      if (list[i].t === 'ouch') { a = Math.max(a, Math.min(1, list[i].life / 0.45)); }
    }
    if (a <= 0.02) { return; }
    var g2 = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28,
                                      W / 2, H / 2, Math.max(W, H) * 0.62);
    g2.addColorStop(0, 'rgba(200,40,40,0)');
    g2.addColorStop(1, 'rgba(200,40,40,' + (a * 0.42) + ')');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
  }

  /** 사냥터를 넘나들 때 화면 전환(PLAN 16절) — 검게 번쩍 잦아든다.
   *  판정은 side.js 가 'fade' fx 한 줄만 남기고, 세기·모양은 여기서만 정한다 */
  function drawFadeOverlay() {
    var list = S.fx(), a = 0, i;
    for (i = 0; i < list.length; i++) {
      if (list[i].t === 'fade') { a = Math.max(a, Math.min(1, list[i].life / 0.4)); }
    }
    if (a <= 0.02) { return; }
    ctx.fillStyle = 'rgba(6,7,10,' + a + ')';
    ctx.fillRect(0, 0, W, H);
  }

  /** 보스 등장 배너(PLAN 35절) — 사냥터에 들어설 때 안쪽을 지키는 보스가 있으면
   *  잠깐 이름을 크게 띄운다. 들고 나는 것도 **여기서만** 정한다(side.js 는
   *  'bossintro' fx 한 줄과 이름만 남긴다) — fade in 0.3s → 머묾 → fade out 0.3s */
  function drawBossIntro() {
    var list = S.fx(), best = null, i;
    for (i = 0; i < list.length; i++) {
      if (list[i].t === 'bossintro' && (!best || list[i].life > best.life)) { best = list[i]; }
    }
    if (!best) { return; }
    var dur = 1.8, edge = 0.3;
    var a = Math.min(1, (dur - best.life) / edge, best.life / edge);
    if (a <= 0.02) { return; }
    var y = H * 0.34, bandH = 64;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(10,8,12,0.62)';
    ctx.fillRect(0, y - bandH / 2, W, bandH);
    ctx.fillStyle = 'rgba(224,80,31,0.9)';
    ctx.fillRect(0, y - bandH / 2, W, 2);
    ctx.fillRect(0, y + bandH / 2 - 2, W, 2);
    ctx.textAlign = 'center';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(240,226,200,0.95)';
    ctx.fillText('👺 보스 등장', W / 2, y - 8);
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillStyle = '#f0e2c8';
    ctx.fillText(best.name, W / 2, y + 18);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  /** 레벨업 배너(PLAN 35절) — core.gainExp() 가 'levelup' 을 쏘면 뜬다.
   *  보스 배너와 같은 틀에 금빛만 다르다 */
  function drawLevelUp() {
    var list = S.fx(), best = null, i;
    for (i = 0; i < list.length; i++) {
      if (list[i].t === 'levelup' && (!best || list[i].life > best.life)) { best = list[i]; }
    }
    if (!best) { return; }
    var dur = 2.0, edge = 0.3;
    var a = Math.min(1, (dur - best.life) / edge, best.life / edge);
    if (a <= 0.02) { return; }
    var y = H * 0.34, bandH = 64;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(12,10,6,0.62)';
    ctx.fillRect(0, y - bandH / 2, W, bandH);
    ctx.fillStyle = 'rgba(245,196,69,0.9)';
    ctx.fillRect(0, y - bandH / 2, W, 2);
    ctx.fillRect(0, y + bandH / 2 - 2, W, 2);
    ctx.textAlign = 'center';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(240,226,200,0.95)';
    ctx.fillText('🌟 레벨 업', W / 2, y - 8);
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillStyle = '#fff3cf';
    ctx.fillText('Lv.' + best.lv, W / 2, y + 18);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  /** 사명 완료 배너(PLAN 35절) — quest.js 의 turnIn() 이 'questdone' 을 쏘면 뜬다 */
  function drawQuestDone() {
    var list = S.fx(), best = null, i;
    for (i = 0; i < list.length; i++) {
      if (list[i].t === 'questdone' && (!best || list[i].life > best.life)) { best = list[i]; }
    }
    if (!best) { return; }
    var dur = 2.0, edge = 0.3;
    var a = Math.min(1, (dur - best.life) / edge, best.life / edge);
    if (a <= 0.02) { return; }
    var y = H * 0.34, bandH = 64;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(8,12,10,0.62)';
    ctx.fillRect(0, y - bandH / 2, W, bandH);
    ctx.fillStyle = 'rgba(90,200,140,0.9)';
    ctx.fillRect(0, y - bandH / 2, W, 2);
    ctx.fillRect(0, y + bandH / 2 - 2, W, 2);
    ctx.textAlign = 'center';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(226,240,230,0.95)';
    ctx.fillText('📋 사명 완수', W / 2, y - 8);
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillStyle = '#e2f0e6';
    ctx.fillText(best.name, W / 2, y + 18);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  /**
   * 뒷배경 — 원작의 그림 문법을 옮긴 것이다. 에셋은 가져오지 않고 **도형만** 쓴다.
   *   하늘 맵  둥근 언덕 두 겹 + 흰 구름          (원작 초반 들판)
   *   숲 맵    둥근 나무 두 겹                     (원작 숲)
   *   굴 맵    바위 이빨과 종유석                   (원작 동굴)
   * 겹마다 카메라보다 느리게 흘러 깊이가 난다.
   */
  function drawBackdrop(stg) {
    var mood = stg.mood || 'sky';
    var floor = stg.floor, m, mx;

    if (mood === 'cave') {
      /* 위에서 내려온 종유석 · 아래 바위 */
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      var f0 = -camX * 0.3;
      for (m = 0; m < 14; m++) {
        mx = f0 + m * 260;
        ctx.beginPath();
        ctx.moveTo(mx, 0); ctx.lineTo(mx + 60, 0); ctx.lineTo(mx + 30, 150 + (m % 3) * 50);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      var f1 = -camX * 0.5;
      for (m = 0; m < 12; m++) {
        mx = f1 + m * 330;
        ctx.beginPath();
        ctx.moveTo(mx, floor);
        ctx.quadraticCurveTo(mx + 80, floor - 130, mx + 165, floor);
        ctx.closePath(); ctx.fill();
      }
      return;
    }

    if (mood === 'fire') {
      /* 불타는 골짜기(호로곡) — 겹 셋. 뒤로 갈수록 어둡고 크다.
         **에셋은 없다** — 도형과 그러데이션만 쓴다(다른 맵과 같은 규칙).
         불길은 시각으로 흔들리지만 **판정에는 닿지 않는다**(그리기 층에만 있다). */
      var t2 = Date.now() / 620;

      /* ① 멀리 선 검은 산줄기 */
      ctx.fillStyle = 'rgba(24,10,8,0.55)';
      var gf0 = -camX * 0.22;
      for (m = 0; m < 16; m++) {
        mx = gf0 + m * 420;
        ctx.beginPath();
        ctx.moveTo(mx, floor);
        ctx.lineTo(mx + 130, floor - 230 - (m % 3) * 60);
        ctx.lineTo(mx + 270, floor);
        ctx.closePath(); ctx.fill();
      }

      /* ② 골짜기 벽 — 앞쪽 한 겹이 더 진하다 */
      ctx.fillStyle = 'rgba(40,16,10,0.62)';
      var gf1 = -camX * 0.46;
      for (m = 0; m < 14; m++) {
        mx = gf1 + m * 310;
        ctx.beginPath();
        ctx.moveTo(mx, floor);
        ctx.lineTo(mx + 74, floor - 150 - (m % 4) * 44);
        ctx.lineTo(mx + 158, floor);
        ctx.closePath(); ctx.fill();
      }

      /* ③ 바닥에서 오르는 불길 — 두 갈래로 흔들린다 */
      var gf2 = -camX * 0.72;
      for (m = 0; m < 22; m++) {
        mx = gf2 + m * 190;
        if (mx < -80 || mx > W + 80) { continue; }
        var sway = Math.sin(t2 + m) * 14;
        var tall = 150 + (m % 3) * 60 + Math.sin(t2 * 1.7 + m * 2) * 22;
        var fg = ctx.createLinearGradient(0, floor, 0, floor - tall);
        fg.addColorStop(0, 'rgba(255,196,86,0.85)');
        fg.addColorStop(0.35, 'rgba(240,120,40,0.55)');
        fg.addColorStop(0.75, 'rgba(200,52,24,0.22)');
        fg.addColorStop(1, 'rgba(180,40,20,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(mx - 34, floor);
        ctx.quadraticCurveTo(mx + sway, floor - tall, mx + 34, floor);
        ctx.closePath(); ctx.fill();
      }

      /* ④ 떠오르는 불티 — 자리는 해시라 늘 같고, 오르는 것만 시각을 탄다 */
      ctx.fillStyle = 'rgba(255,190,110,0.75)';
      for (m = 0; m < 26; m++) {
        var ex2 = -camX * 0.9 + m * 168;
        if (ex2 < -20 || ex2 > W + 20) { continue; }
        var rise2 = (t2 * 26 + m * 37) % 400;
        ctx.globalAlpha = Math.max(0, 0.85 - rise2 / 400);
        ctx.fillRect(ex2 + Math.sin(t2 * 2 + m) * 16, floor - 40 - rise2, 4, 4);
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (mood === 'forest') {
      /* 둥근 나무 두 겹 — 뒤엣것이 크고 흐리다 */
      var layers = [{ p: 0.28, s: 1.35, a: 0.18, step: 300 },
                    { p: 0.52, s: 1.0, a: 0.26, step: 210 }];
      for (var L = 0; L < layers.length; L++) {
        var lay = layers[L];
        ctx.fillStyle = 'rgba(20,60,30,' + lay.a + ')';
        var fx0 = -camX * lay.p;
        for (m = 0; m < 20; m++) {
          mx = fx0 + m * lay.step;
          var th = 150 * lay.s, tw = 62 * lay.s;
          ctx.fillRect(mx - 7 * lay.s, floor - th * 0.45, 14 * lay.s, th * 0.45);
          ctx.beginPath();
          ctx.ellipse(mx, floor - th * 0.55, tw, tw * 0.82, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return;
    }

    /* 하늘 맵 — 둥근 언덕 두 겹 + 구름 */
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    var cf = -camX * 0.14;
    for (m = 0; m < 12; m++) {
      mx = cf + m * 380 + (m % 3) * 60;
      var cy = 70 + (m % 4) * 46;
      ctx.beginPath();
      ctx.ellipse(mx, cy, 46, 20, 0, 0, Math.PI * 2);
      ctx.ellipse(mx + 38, cy + 6, 32, 15, 0, 0, Math.PI * 2);
      ctx.ellipse(mx - 34, cy + 8, 26, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    var hills = [{ p: 0.24, h: 210, a: 'rgba(120,180,120,0.45)', step: 520 },
                 { p: 0.44, h: 150, a: 'rgba(90,155,95,0.55)', step: 380 }];
    for (var k = 0; k < hills.length; k++) {
      var hl = hills[k];
      ctx.fillStyle = hl.a;
      var hf = -camX * hl.p;
      for (m = 0; m < 16; m++) {
        mx = hf + m * hl.step;
        ctx.beginPath();
        ctx.moveTo(mx, floor);
        ctx.quadraticCurveTo(mx + hl.step * 0.5, floor - hl.h, mx + hl.step, floor);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /** 미니맵의 자리·축척 — **그리기와 떼어 둔다.** 값을 내는 층이라 진단이 붙는다.
   * 2026-09-08 — 원작 오마주였던 좌상단 사각 창을 사가고 스타일
   * (좌하단 원형)로 통일(사용자 요청, 오마주보다 통일 우선으로 명시적 선택).
   * 사냥터는 던전 방처럼 **늘 화면보다 작지 않다**(가로로 넓다) — 원에 내접하는
   * 사각형 크기로 줄여 전체(문·보스 위치까지)가 정보 손실 없이 다 들어오게
   * 한다(사가블로 미니맵과 같은 수법). 좌하단은 조작판(.pad-l, bottom 150px)
   * 보다 아래(0~142px)라 안 겹친다. */
  /* 좁은 화면(780px 이하)은 독이 좌하단부터 가로로 눕는다 — 미니맵 원이 그 밑에 깔려
     반쯤 가렸다(2026-09-27 폰 세로 확인). 독 윗변 위로 올린다. 매 프레임 재지 않고 0.5초마다 */
  var miniBotAt = 0, miniBotV = 0;
  function miniBottom() {
    var now = Date.now();
    if (now - miniBotAt > 500 || !miniBotV) {
      miniBotAt = now;
      miniBotV = H - 14;
      var dk = W <= 780 && global.document && global.document.getElementById('dock');
      if (dk && dk.getClientRects().length) {   // 독은 fixed 라 offsetParent 가 늘 null
        var t = dk.getBoundingClientRect().top;
        if (t > H / 2 && t < H) { miniBotV = Math.min(miniBotV, t - 10); }
      }
    }
    return miniBotV;
  }
  /* 폰 가로(키 500 아래·폭 780 넘음) — 왼쪽 아래는 ◀▶ 조작판과 가로로 누운 독 자리라 원이 그 밑에 깔렸다(2026-09-28,
     실기 보고 Q13). 오른쪽 위, 도구줄(아이콘 한 줄) 밑으로 옮기고 조금 줄인다. CSS 의 가로 규칙과 같은 문턱 */
  function miniLand() { return !!(global.innerHeight && global.innerHeight <= 500 && global.innerWidth > 780 && global.innerWidth > global.innerHeight); }
  function miniBox(stg) {
    var land = miniLand();
    var s = Math.min(land ? 104 : (W <= 560 ? 104 : 128), H - 40);
    var top = 240, bot = stg.floor + 30;          // 세로로 담을 구간
    var hw = Math.max(1, stg.width / 2), hh = Math.max(1, (bot - top) / 2);
    var rad = s / 2 - 3;
    /* 원에 내접하는 사각형 축척 — 네 귀퉁이(hw,hh)가 딱 반지름에 닿는 배수 */
    var scale = rad / Math.sqrt(hw * hw + hh * hh);
    return { cx: land ? W - 12 - s / 2 : 12 + s / 2, cy: land ? 64 + s / 2 : miniBottom() - s / 2, s: s, rad: rad,
             hw: hw, hh: hh, top: top, scale: scale };
  }

  /**
   * 미니맵 — 사냥터 전체를 한 칸에 줄여 담아 **어디로 가야 문·보스가
   * 있는지**를 보여 준다(사가고와 같은 좌하단 원형 스타일).
   */
  function drawMiniMap(run) {
    var stg = run.stage;
    var b = miniBox(stg);
    var cx = b.cx, cy = b.cy, rad = b.rad, scale = b.scale;
    function mx(vx) { return cx + (vx - b.hw) * scale; }
    function my(vy) { return cy + (vy - b.top - b.hh) * scale; }

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(20,23,30,0.82)';
    ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);

    /* 바닥과 발판 */
    ctx.fillStyle = 'rgba(200,205,220,0.4)';
    ctx.fillRect(cx - rad, my(stg.floor), rad * 2, 1.5);
    var i;
    for (i = 0; i < stg.plats.length; i++) {
      var pl = stg.plats[i];
      ctx.fillRect(mx(pl[0]), my(pl[1]), pl[2] * scale, 1.5);
    }
    /* 줄 */
    ctx.strokeStyle = 'rgba(150,110,60,0.55)';
    for (i = 0; i < (stg.ropes || []).length; i++) {
      var r = stg.ropes[i];
      ctx.beginPath();
      ctx.moveTo(mx(r[0]), my(r[1]));
      ctx.lineTo(mx(r[0]), my(r[2]));
      ctx.stroke();
    }
    /* 문 */
    for (i = 0; i < (stg.portals || []).length; i++) {
      var g = stg.portals[i];
      ctx.fillStyle = S.unlocked(g[1]) ? '#3f7fd0' : 'rgba(120,120,135,0.7)';
      ctx.fillRect(mx(g[0]) - 2, my(stg.floor) - 7, 4, 7);
    }
    /* 적 · 보스 · 나 */
    for (i = 0; i < run.enemies.length; i++) {
      var e = run.enemies[i];
      ctx.fillStyle = e.boss ? '#e0501f' : 'rgba(200,60,60,0.9)';
      var d = e.boss ? 4 : 2;
      ctx.fillRect(mx(e.x + e.w / 2) - d / 2, my(e.y + e.h) - d, d, d);
    }
    ctx.fillStyle = '#f0a92b';
    ctx.fillRect(mx(run.player.x + S.P_W / 2) - 2.5, my(run.player.y + S.P_H) - 5, 5, 5);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx(run.player.x + S.P_W / 2) - 2.5, my(run.player.y + S.P_H) - 5, 5, 5);

    ctx.restore();

    /* 테두리와 방위(北) — 사가고 미니맵과 같은 관례(장식적 약속, 실제 나침반 아님) */
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.strokeText('北', cx, cy - rad + 12);
    ctx.fillStyle = 'rgba(255,255,255,.82)';
    ctx.fillText('北', cx, cy - rad + 12);

    ctx.font = '600 9.5px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(232,226,210,.85)';
    ctx.fillText(stg.name, cx - rad, cy + rad + 13);
  }

  /** 밧줄·사다리 — 발판 뒤에 걸린다. 사다리는 가로대가 있고 밧줄은 한 가닥이다 */
  function drawRopes(stg) {
    var list = stg.ropes || [];
    for (var i = 0; i < list.length; i++) {
      var r = list[i], x = r[0] - camX;
      if (x < -30 || x > W + 30) { continue; }
      var top = r[1], bot = r[2], ladder = r[3] === 'ladder';
      if (ladder) {
        ctx.strokeStyle = 'rgba(190,160,110,0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 9, top); ctx.lineTo(x - 9, bot);
        ctx.moveTo(x + 9, top); ctx.lineTo(x + 9, bot);
        ctx.stroke();
        ctx.lineWidth = 2.5;
        for (var y = top + 12; y < bot; y += 22) {
          ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.stroke();
        }
      } else {
        ctx.strokeStyle = 'rgba(205,175,120,0.85)';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke();
        /* 매듭 — 밧줄로 보이게 */
        ctx.fillStyle = 'rgba(160,130,85,0.9)';
        for (var k = top + 16; k < bot; k += 26) { ctx.fillRect(x - 3, k, 6, 3); }
      }
      /* 위쪽 고리 */
      ctx.fillStyle = 'rgba(120,95,60,0.9)';
      ctx.fillRect(x - 12, top - 4, 24, 5);
    }
  }

  /** 문(포탈) — 원작처럼 **↑ 를 누르면** 다음 맵으로 넘어간다. 그 자리를 빛으로 알린다 */
  function drawPortals(stg) {
    var list = stg.portals || [];
    var t = Date.now() / 1000;
    for (var i = 0; i < list.length; i++) {
      var g = list[i], x = g[0] - camX, base = stg.floor;
      if (x < -80 || x > W + 80) { continue; }
      var to = SD.stage(g[1]);
      var open = S.unlocked(g[1]);
      var pulse = 0.55 + Math.sin(t * 2.4 + i) * 0.2;
      var grad = ctx.createLinearGradient(x, base - 96, x, base);
      grad.addColorStop(0, 'rgba(150,215,255,0)');
      grad.addColorStop(1, open ? 'rgba(150,215,255,' + pulse + ')' : 'rgba(150,150,160,0.28)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, base - 44, 30, 52, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = open ? '#dff0ff' : 'rgba(220,220,230,0.6)';
      ctx.fillText((open ? (core.upHint() + ' ') : '🔒 ') + to.name, x, base - 104);
      if (!open) {
        ctx.fillStyle = 'rgba(220,220,230,0.5)';
        ctx.fillText('Lv.' + to.need, x, base - 90);
      }
      ctx.textAlign = 'left';
    }
  }

  /**
   * 보스 체력 — 화면 위에 굵게 하나. 원작에서 보스 방에 들어서면
   * 위쪽에 이름과 체력이 뜨는 그 자리다.
   */
  function drawBossBar() {
    var run = S.raw();
    if (!run || !run.boss) { return; }
    var b = run.boss;
    /* 좁은 폭에서는 상단 UI 가 두 줄로 접힌다(프로필·도구·지갑) — 그 아래로 내린다.
       폰에서 보스 이름이 도구 단추에 가려 "무엇이 달려드는지" 를 못 읽었다. */
    var narrow = W <= 560;
    var w = Math.min(W - 40, 420), x = (W - w) / 2, y = narrow ? 254 : 14;
    var r = Math.max(0, b.hp / b.hpMax);
    ctx.fillStyle = 'rgba(10,12,16,0.72)';
    ctx.fillRect(x - 6, y - 4, w + 12, b.gate ? 46 : 26);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y + 10, w, 8);
    ctx.fillStyle = b.charge > 0 ? '#ffb14a' : (b.gate && b.enraged ? '#ff3a3a' : '#e06565');
    ctx.fillRect(x, y + 10, w * r, 8);
    /* 3단 체력바(§5-4) — 단계별 판정은 없다, 눈에 셋으로 나눠 보이게 금만 긋는다 */
    if (b.gate) {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + w / 3, y + 10); ctx.lineTo(x + w / 3, y + 18);
      ctx.moveTo(x + w * 2 / 3, y + 10); ctx.lineTo(x + w * 2 / 3, y + 18);
      ctx.stroke();
    }
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f0e2c8';
    ctx.fillText((b.gate ? '🏯 ' : '👺 ') + b.ref.name +
      (b.charge > 0 ? ' — 달려든다!' : (b.gate && b.enraged ? ' — 광폭화!' : '')), W / 2, y + 6);
    if (b.gate) {
      /* 방패 — 안 깨졌으면 등 뒤 피해가 얼마나 쌓였는지, 깨졌으면 취약 남은 시간 */
      var shieldR = b.gateShieldBroken ? 1 : Math.min(1, (b.gateShieldHp || 0) / (b.hpMax * 0.30));
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(x, y + 24, w, 6);
      ctx.fillStyle = b.gateShieldBroken ? '#ffd24a' : '#6ab8e0';
      ctx.fillRect(x, y + 24, w * shieldR, 6);
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.fillStyle = b.gateShieldBroken ? '#ffd24a' : '#bcd8ea';
      ctx.fillText(b.gateShieldBroken ? '🛡️💥 취약 ' + Math.ceil(b.gateVulnT || 0) + 's'
        : '🛡️ 등 뒤를 노리면 깨진다', W / 2, y + 34);
      var tLeft = Math.max(0, Math.ceil(run.gateT || 0));
      ctx.textAlign = 'right';
      ctx.fillStyle = tLeft <= 0 ? '#ff6a4a' : '#f0e2c8';
      ctx.fillText('⏱️ ' + Math.floor(tLeft / 60) + ':' + (tLeft % 60 < 10 ? '0' : '') + (tLeft % 60), x + w, y + 6);
    }
    ctx.textAlign = 'left';
  }

  /** 2D 시트(shared/js/mode2d.js)로 적을 그린다 — 풀이 없거나 아직 안 받았으면 false(→ 기존 스탬프). 적 단계(tier)로 풀을 고르고 이름으로 같은 적은 같은 몸을 받는다 */
  function drawSheetEnemy(e, x, y) {
    var M = global.DG.mode2d;
    var bz = e.ref.kind === 'human' ? null : (M && M.beastOf ? M.beastOf(e.ref.name) : null);   // 짐승은 어울리는 몸이 표에 있을 때만(W-0051), 드론·나머지는 기존 스탬프
    if (!M || (e.ref.kind !== 'human' && !bz)) { return false; }
    var pool = bz ? bz.pool : M.pick('t' + (e.ref.tier || 1), e.ref.name);
    if (!pool) { return false; }
    var clip = e.hurt > 0 ? 'hit' : (e.atkAnim > 0 ? 'attack' : 'walk');
    var ms = clip === 'attack' ? (0.28 - e.atkAnim) * 1000 : (clip === 'hit' ? Math.max(0, 0.3 - e.hurt) * 1000 : Date.now() + (e.phase || 0) * 160);
    return M.draw(ctx, { pool: pool, clip: clip, facing: e.dir, ms: ms, x: x, y: y, scale: (bz ? bz.k : 1) * (e.boss ? 1.9 : (e.mini || e.rare ? 1.25 : 1)) });
  }

  /** 죽는 몸짓(run.dying) — 2D 시트의 death 동작. 끝날 무렵 흐려진다. 시트가 없으면 안 그린다(예전에도 안 그렸다) */
  function drawDying() {
    var M = global.DG.mode2d, run = S.raw && S.raw();
    if (!M || !run || !run.dying || !run.dying.length) { return; }
    for (var i = 0; i < run.dying.length; i++) {
      var d = run.dying[i], x = d.x + d.w / 2 - camX, y = d.y + d.h;
      var dz = d.ref.kind === 'human' ? null : (M.beastOf ? M.beastOf(d.ref.name) : null);
      if (x < -80 || x > W + 80 || (d.ref.kind !== 'human' && !dz)) { continue; }
      var pool = dz ? dz.pool : M.pick('t' + (d.ref.tier || 1), d.ref.name);
      if (!pool) { continue; }
      var f = d.dur > 0 ? d.t / d.dur : 1;
      M.draw(ctx, { pool: pool, clip: 'death', facing: d.dir, ms: d.t * 1000, x: x, y: y, scale: (dz ? dz.k : 1) * (d.boss ? 1.9 : (d.mini || d.rare ? 1.25 : 1)), alpha: f > 0.7 ? Math.max(0, 1 - (f - 0.7) / 0.3) : 1 });
    }
  }

  function drawEnemy(e) {
    var x = e.x + e.w / 2 - camX, y = e.y + e.h;
    if (x < -60 || x > W + 60) { return; }
    var human = e.ref.kind === 'human';
    if (!(global.DG.sideView3d && global.DG.sideView3d.ready()) && !drawSheetEnemy(e, x, y)) {
      global.DG.sprite.stamp(ctx, {
        kind: human ? 'human' : 'beast', ref: e.ref, x: x, y: y, s: e.boss ? 1.9 : 0.8,
        facing: e.dir, phase: e.phase, walking: true,
        color: e.ref.color, look: e.ref.look || {},
        form: e.ref.form, rarity: e.boss ? 5 : 2, t: Date.now()
      });
    }
    if (e.boss) {
      /* 발밑 고리 — 몸집만으로는 잡졸과 잘 안 갈린다. 달려드는 동안은 붉게 탄다 */
      var charging = e.charge > 0;
      ctx.globalAlpha = charging ? 0.55 : 0.3;
      ctx.fillStyle = charging ? '#ff7a4a' : '#c94a4a';
      ctx.beginPath();
      ctx.ellipse(x, y, charging ? 40 : 32, charging ? 11 : 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (e.hurt > 0) {                       // 맞은 순간 하얗게 번쩍
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 18, y - 40, 36, 40);
      ctx.globalAlpha = 1;
    }
    /* 남은 체력 — 보스는 화면 위의 큰 바가 대신한다 */
    if (e.boss) { return; }
    var w = 32, r = Math.max(0, e.hp / e.hpMax);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - w / 2, y - 52, w, 4);
    ctx.fillStyle = r > 0.5 ? '#7ec96a' : (r > 0.22 ? '#e8c15a' : '#e06565');
    ctx.fillRect(x - w / 2, y - 52, w * r, 4);
  }

  function drawMe(p) {
    var ref = S.meRef();
    var x = p.x + S.P_W / 2 - camX, y = p.y + S.P_H;
    var MTd = global.DG.mount, mtd = MTd && MTd.active && MTd.active() ? MTd.current() : null;   // 탈것(mount.js) — 2D 는 이모지로
    if (mtd && !(global.DG.sideView3d && global.DG.sideView3d.ready())) {
      ctx.font = '38px "Segoe UI Emoji", system-ui'; ctx.textAlign = 'center';
      ctx.fillText(mtd.emoji, x, y + 4);
      y -= 20;
    }
    if (!(global.DG.sideView3d && global.DG.sideView3d.ready()) && !(global.DG.actor2d && global.DG.actor2d.me(ctx, ref, x, y, S.P_H * 1.12, { facing: p.facing, walking: !!p.vx && p.onGround }))) {
      global.DG.sprite.stamp(ctx, {
        kind: 'human', ref: ref, x: x, y: y, s: 1.05,
        facing: p.facing, phase: p.phase, walking: !!p.vx && p.onGround,
        color: global.DG.data.faction(ref.faction).color,
        look: global.DG.sprite.lookOf(ref),
        rarity: ref.rarity, t: Date.now()
      });
    }
    if (p.hurt > 0) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#e06565';
      ctx.fillRect(x - 20, y - 56, 40, 56);
      ctx.globalAlpha = 1;
    }
    if (p.resting > 0.4) {                  // 앉아 쉬는 중 — 원작의 그 표시
      ctx.font = '15px "Segoe UI Emoji", system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(200,230,255,' + (0.55 + Math.sin(Date.now() / 300) * 0.3) + ')';
      ctx.fillText('💤', x + 18, y - 56);
    }
  }

  function drawFx() {
    var list = S.fx(), i;
    for (i = 0; i < list.length; i++) {
      var f = list[i];
      var x = f.x - camX;
      if (f.t === 'hit') {
        /* 데미지 숫자 — 원작처럼 **굵고 크게, 검은 테를 둘러** 위로 튄다.
           **급소는 한눈에 갈린다** — 더 크고, 붉은 금빛이고, 뒤에 느낌표가 붙고,
           처음 한 박자 부풀었다 가라앉는다(원작의 크리티컬 숫자가 그렇다) */
        var a = Math.min(1, f.life * 2.2);
        var rise = (0.6 - f.life) * 52;
        /* 한 번에 여럿을 치면 숫자가 겹쳐 한 덩어리로 읽힌다(주위를 쓰는 무예가 그렇다.
           실제로 "24"·"42"·"35" 셋이 "244235" 로 보였다). **층을 쌓아 올린다** —
           같은 순간에 가까이서 난 숫자를 세어 그만큼 위로 올린다. 판정에는 닿지 않고,
           세는 값이 fx 목록의 순서라 늘 같은 자리에 선다 */
        var stack = 0, si;
        for (si = 0; si < i; si++) {
          var g0 = list[si];
          if (g0.t === 'hit' && Math.abs(g0.life - f.life) < 0.002 &&
              Math.abs(g0.x - f.x) < 52) { stack++; }
        }
        rise += stack * 21;
        x += (core.hash2(Math.round(f.x), Math.round(f.y)) - 0.5) * 12;
        var big = f.v >= 100 || f.crit;
        var pop = f.crit ? (1 + Math.max(0, f.life - 0.44) * 2.6) : 1;
        var size = (f.crit ? 25 : (big ? 21 : 17)) * pop;
        ctx.font = '900 ' + size.toFixed(1) + 'px "Malgun Gothic", system-ui';
        ctx.textAlign = 'center';
        ctx.lineWidth = f.crit ? 4.5 : 3.5;
        ctx.strokeStyle = 'rgba(30,24,20,' + a + ')';
        var txt = f.crit ? (f.v + '!') : String(f.v);
        ctx.strokeText(txt, x, f.y - rise);
        ctx.fillStyle = (f.crit ? 'rgba(255,150,70,'
                                : (big ? 'rgba(255,196,86,' : 'rgba(255,240,190,')) + a + ')';
        ctx.fillText(txt, x, f.y - rise);
      } else if (f.t === 'fall') {
        /* 죽는 모습 — **뒤로 넘어가며 흐려진다.** 원작에서 몹이 죽던 그 모습이다.
           적을 목록에서 이미 뺀 뒤라 여기서만 그린다(판정에는 없는 몸이다) */
        var span = f.boss ? 1.1 : 0.55;
        var k = 1 - Math.min(1, f.life / span);        // 0 → 1 로 간다
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - k * 1.1);
        ctx.translate(x + f.dir * k * 46, f.y + f.h / 2 + k * k * 40);
        ctx.rotate(f.dir * k * 1.5);
        ctx.fillStyle = (f.ref && f.ref.color) ? f.ref.color : 'rgba(60,48,40,0.85)';
        ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h * 0.9);
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.fillRect(-f.w / 2, -f.h / 2 + f.h * 0.55, f.w, f.h * 0.35);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(-f.w / 2, -f.h / 2, f.w, 4);
        ctx.restore();
      } else if (f.t === 'dust') {
        /* 착지 먼지 — 세게 떨어졌을 때만 인다 */
        var dk = 1 - Math.min(1, f.life / 0.32);
        ctx.globalAlpha = Math.max(0, 0.5 - dk * 0.5);
        ctx.fillStyle = '#d8cbb4';
        for (var dq = -1; dq <= 1; dq += 2) {
          ctx.beginPath();
          ctx.ellipse(x + dq * (6 + dk * 22), f.y - 3 - dk * 5,
                      5 + dk * 9, 3 + dk * 4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (f.t === 'warn') {
        /* 보스가 달려들기 직전 — 소리만으로는 못 듣는 사람이 있다 */
        var wa = Math.min(1, f.life / 0.9);
        ctx.font = '900 17px "Malgun Gothic", system-ui';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = 'rgba(30,10,10,' + wa + ')';
        ctx.strokeText('달려든다!', x, f.y - 26);
        ctx.fillStyle = 'rgba(255,90,70,' + wa + ')';
        ctx.fillText('달려든다!', x, f.y - 26);
      } else if (f.t === 'shake' || f.t === 'ouch') {
        /* 화면 전체에 쓰는 것 — 여기서는 아무것도 안 그린다(위에서 이미 썼다) */
        continue;
      } else if (f.t === 'slash') {
        ctx.fillStyle = 'rgba(255,255,255,' + (f.life * 3) + ')';
        ctx.fillRect(x, f.y, f.w, f.h);
      } else if (f.t === 'ring') {
        ctx.beginPath();
        ctx.arc(x, f.y, f.r * (1.2 - f.life), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(245,180,69,' + Math.min(1, f.life * 3) + ')';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (f.t === 'zonewarn') {
        /* 관문 대장(§5-4) 패턴 2 — 내려찍을 자리를 바닥에 미리 그린다.
           life 가 줄수록(경고 시간이 다 되어 갈수록) 채움이 짙어진다 */
        var zk = 1 - Math.max(0, f.life);
        ctx.beginPath();
        ctx.ellipse(x, f.y, f.r, f.r * 0.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,60,40,' + (0.12 + zk * 0.28) + ')';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,120,70,' + (0.4 + zk * 0.5) + ')';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        if (f.rock) {
          /* 낙석(§5-9) — 떨어질 자리 위로 그림자 기둥이 내려온다(불기둥 §5-10 은 붉게) */
          ctx.fillStyle = f.fire ? 'rgba(255,110,40,' + (0.10 + zk * 0.3) + ')' : 'rgba(60,40,30,' + (0.10 + zk * 0.25) + ')';
          ctx.fillRect(x - f.r * 0.5, 0, f.r, f.y);
        }
      } else if (f.t === 'ringwarn') {
        /* 도넛(§5-10 고유 기술) — 화면 전체가 붉고 보스 곁 원만 초록. 붙어야 산다 */
        var rk = 1 - Math.max(0, f.life / 1.3);
        ctx.fillStyle = 'rgba(200,40,30,' + (0.10 + rk * 0.22) + ')';
        ctx.fillRect(0, 0, Math.max(0, x - f.r), H);
        ctx.fillRect(x + f.r, 0, Math.max(0, W - x - f.r), H);
        ctx.beginPath();
        ctx.ellipse(x, f.y, f.r, f.r * 0.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(80,230,120,' + (0.22 + rk * 0.2) + ')';
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,255,160,.9)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.font = '900 17px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#eaffef';
        ctx.fillText('붙어라!', x, f.y - 90);
        ctx.textAlign = 'left';
      } else if (f.t === 'beamwarn') {
        /* 공중 쇠뇌(§5-10 고유 기술) — 뛴 높이로 가로 띠가 온다. 땅에 붙어 있으면 산다 */
        var bk = 1 - Math.max(0, f.life / 1.1), ba = 0.16 + bk * 0.34;
        ctx.fillStyle = 'rgba(255,70,50,' + ba + ')';
        ctx.fillRect(0, f.y - 60, W, 60);
        ctx.strokeStyle = 'rgba(255,150,110,' + (0.5 + bk * 0.5) + ')';
        ctx.lineWidth = 2;
        ctx.strokeRect(-2, f.y - 60, W + 4, 60);
        ctx.font = '900 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,240,200,' + (0.6 + bk * 0.4) + ')';
        ctx.fillText('⬇ 뛰지 마라! 쇠뇌가 머리 위로', W / 2, f.y - 70);
        ctx.textAlign = 'left';
      } else if (f.t === 'groggy') {
        /* 그로기(§5-10) — 보스 머리 위로 별이 돈다 */
        var ga = Date.now() / 260;
        ctx.font = '700 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        for (var gs = 0; gs < 3; gs++) {
          var gang = ga + gs * 2.094;
          ctx.fillText('⭐', x + Math.cos(gang) * 26, f.y - 14 + Math.sin(gang) * 7);
        }
        ctx.font = '900 15px system-ui, sans-serif';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(20,20,40,.85)';
        ctx.strokeText('그로기 ' + Math.ceil(Math.max(0, f.life)) + '초', x, f.y - 34);
        ctx.fillStyle = '#ffe66a';
        ctx.fillText('그로기 ' + Math.ceil(Math.max(0, f.life)) + '초', x, f.y - 34);
        ctx.textAlign = 'left';
      } else if (f.t === 'quakewarn') {
        /* 지진(§5-9) — 바닥 전체가 떨린다. 점프하거나 발판 위로 */
        var qk = 1 - Math.max(0, f.life), qa = 0.18 + qk * 0.4 + Math.sin(Date.now() / 60) * 0.08;
        ctx.fillStyle = 'rgba(255,90,40,' + qa + ')';
        ctx.fillRect(0, f.y - 10, W, 16);
        ctx.font = '900 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,240,200,' + (0.6 + qk * 0.4) + ')';
        ctx.fillText('⬆ 점프! 땅이 흔들린다', W / 2, f.y - 30);
        ctx.textAlign = 'left';
      } else if (f.t === 'sweepwarn') {
        /* 휩쓸기(§5-9) — 화면이 붉게 물들고 초록 안전지대만 남는다 */
        var wk = 1 - Math.max(0, f.life);
        var sl = x - f.w / 2;
        ctx.fillStyle = 'rgba(200,30,30,' + (0.14 + wk * 0.22) + ')';
        ctx.fillRect(0, 0, Math.max(0, sl), H);
        ctx.fillRect(sl + f.w, 0, Math.max(0, W - sl - f.w), H);
        ctx.fillStyle = 'rgba(80,230,120,' + (0.18 + wk * 0.2) + ')';
        ctx.fillRect(sl, 0, f.w, H);
        ctx.strokeStyle = 'rgba(120,255,160,.9)';
        ctx.lineWidth = 3;
        ctx.strokeRect(sl + 1.5, 1.5, f.w - 3, H - 3);
        ctx.font = '900 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#eaffef';
        ctx.fillText('안전', x, f.y - 70);
        ctx.textAlign = 'left';
      } else if (f.t === 'pop') {
        /* 보스는 목숨을 0.9로 길게 잡는데(잡졸은 0.5) 이 반지름 식은 0.5부터
           줄어든다고만 가정해 뒀었다 — 보스 pop 이 갓 생겨 0.9~0.5 사이인
           동안은 음수가 나와 arc() 가 매 프레임 IndexSizeError 로 죽었다
           (실기기에서 보스를 잡을 때마다 화면이 멈췄을 실제 버그, 2026-09-09 발견) */
        ctx.beginPath();
        ctx.arc(x, f.y, Math.max(0, 20 * (0.5 - f.life) * 2 + 6), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,' + f.life + ')';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (f.t === 'dash') {
        /* 밀고 나간 자리 — 잔상 한 줄 */
        var gd = ctx.createLinearGradient(x, 0, x + f.w, 0);
        gd.addColorStop(0, 'rgba(255,255,255,0)');
        gd.addColorStop(0.5, 'rgba(255,255,255,' + Math.min(0.5, f.life * 2) + ')');
        gd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gd;
        ctx.fillRect(x, f.y, f.w, f.h);
      } else if (f.t === 'ghost') {
        /* 돌진 잔상(§5-7) — 지나간 자리에 몸 그림자 여럿 */
        ctx.globalAlpha = Math.min(0.4, Math.max(0, f.life) * 3);
        ctx.fillStyle = 'rgba(210,230,255,0.9)';
        ctx.fillRect(x - 20, f.y - 56, 40, 56);
        ctx.globalAlpha = 1;
      } else if (f.t === 'impact') {
        /* 착탄 다발(§5-7) — 화살비가 몸에 꽂히는 작은 X 자국, 커지며 사라진다 */
        var ik = 1 - Math.min(1, f.life / 0.3);
        ctx.globalAlpha = Math.max(0, 1 - ik);
        ctx.strokeStyle = 'rgba(220,235,255,0.95)';
        ctx.lineWidth = 2;
        var is = 5 + ik * 5;
        ctx.beginPath();
        ctx.moveTo(x - is, f.y - is); ctx.lineTo(x + is, f.y + is);
        ctx.moveTo(x + is, f.y - is); ctx.lineTo(x - is, f.y + is);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.t === 'rain') {
        ctx.fillStyle = 'rgba(150,200,255,' + Math.min(0.22, f.life * 0.5) + ')';
        ctx.fillRect(x, f.y, f.w, f.h);
        ctx.strokeStyle = 'rgba(220,235,255,' + Math.min(0.9, f.life * 1.8) + ')';
        ctx.lineWidth = 2;
        for (var q = 0; q < 9; q++) {
          var qx = x + (q + 0.5) * (f.w / 9);
          var qy = f.y + ((0.5 - f.life) * 2 + q * 0.07) * f.h;
          ctx.beginPath();
          ctx.moveTo(qx, qy);
          ctx.lineTo(qx - 5, qy - 22);
          ctx.stroke();
        }
      } else if (f.t === 'aim') {
        /* 쏘기 직전 — 원작에서도 사격 몹은 한 박자 티를 낸다 */
        ctx.font = '13px "Segoe UI Emoji", system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,150,110,' + Math.min(1, f.life * 4) + ')';
        ctx.fillText('❗', x, f.y - 12);
      } else if (f.t === 'heal') {
        ctx.font = '20px "Segoe UI Emoji", system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🧪', x, f.y - (0.5 - f.life) * 40);
      } else if (f.t === 'itempop') {
        /* 아이템 획득 팝업(PLAN 35절) — 주운 자리에서 이름표가 위로 뜨며 사라진다.
           목숨은 side.js 의 ITEMPOP_DUR(0.9) 값을 그대로 옮겨 쓴다(bossintro 와 같은 관례) */
        var pDur = 0.9, prise = (pDur - f.life) * 46;
        var pa = Math.min(1, f.life * 3);
        ctx.textAlign = 'center';
        ctx.font = '16px "Segoe UI Emoji", system-ui';
        ctx.globalAlpha = pa;
        ctx.fillText(f.emoji, x, f.y - 30 - prise);
        ctx.font = '700 12px "Malgun Gothic", system-ui';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(20,16,14,' + pa + ')';
        ctx.strokeText(f.text, x, f.y - 12 - prise);
        ctx.fillStyle = 'rgba(255,235,200,' + pa + ')';
        ctx.fillText(f.text, x, f.y - 12 - prise);
        ctx.globalAlpha = 1;
      }
    }
  }

  global.DG = global.DG || {};
  global.DG.sideView = {
    init: init, draw: draw, resize: resize, miniBox: miniBox,
    _cam: function () { return camX; },
    /** 진단용 — **흔들림의 세기는 화면 층이 정한다**(side.js 는 'shake' 한 줄만 남긴다) */
    _shake: shakeOf,
    shakeLevel: shakeLevel, setShakeLevel: setShakeLevel,
    /** 진단용 — 화면의 그 자리가 어느 조작인가 (폰에는 방향키가 없다) */
    _zone: function (x, y) { return readZone({ clientX: x, clientY: y }); },
    /** 진단·QA 전용 — 사람이 핀치·휠로 조절한 화면 확대 배율 */
    viewZoom: function () { return viewZoom; },
    setViewZoom: setZoom,
    /** 진단 전용 — 보스전 확대(PLAN 20절). 순수 계산이라 실제 시간 없이 dt 를 먹인다 */
    _bossZoomK: function () { return bossZoomK; },
    _stepBossZoom: stepBossZoom
  };
})(window);
