/**
 * 3마을 2D 마을 기 — 깃대·깃발 그림과 무늬(사람이 고른 바탕·무늬로 깃발 그림을 만든다) — village-view.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * village-view.js 가 `bind({ shadow }, ctx)` 로 손잡이와 지금 ctx(부를 때마다)를 넘기고 같은 이름으로 부른다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var G = null, shadow, ctx = null;
  var api = null;
  function bind(g, ctx0) { if (G !== g) { G = g; shadow = g.shadow; } ctx = ctx0; return api; }

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

  api = { bind: bind, drawPole: drawPole, drawFlagSym: drawFlagSym };
  global.DG = global.DG || {};
  global.DG.villageFlag = api;
})(typeof window !== 'undefined' ? window : this);
