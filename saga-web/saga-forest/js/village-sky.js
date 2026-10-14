/**
 * 3마을 하늘 — 하늘빛·별·흐르는 별(소원)·해와 달·구름·먼 물가. village-view.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * village-view.js 가 `bind({ mix, dark, light, BEND, view })` 로 손잡이를 넘긴다. 캔버스·화면 크기·마루 높이는 창 크기마다 바뀌어서
 * 그리기 함수를 부를 때마다 view() 로 지금 값을 당겨 온다(pull). 흐르는 별 자리 starHint 는 여기 하나 — 말풍선은 starHint() 로 읽는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var G = null, mix, dark, light, BEND;
  var ctx = null, W = 0, H = 0, CX = 0, horizonY = 0, VD = null;
  var api = null;
  function bind(g) { if (G !== g) { G = g; mix = g.mix; dark = g.dark; light = g.light; BEND = g.BEND; } return api; }
  function pull() { var v = G.view(); ctx = v.ctx; W = v.W; H = v.H; CX = v.CX; horizonY = v.horizonY; VD = v.VD; }
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


  api = {
    bind: bind,
    drawSky: function (ph, se, now) { pull(); return drawSky(ph, se, now); },
    drawFarShore: function (ph, se) { pull(); return drawFarShore(ph, se); },
    wxKey: function () { pull(); return wxKey(); },
    evTag: function () { pull(); return evTag(); },
    starHint: function () { return starHint; }
  };
  global.DG = global.DG || {};
  global.DG.villageSky = api;
})(typeof window !== 'undefined' ? window : this);
