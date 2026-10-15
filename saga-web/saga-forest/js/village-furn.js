/**
 * 3마을 집 안 가구 그리기(종류별 도형·고른 가구 고리·이름 말풍선) — village-view.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * village-view.js 가 `bind({ shadow, ring, bubble, projIn, roundRect }, ctx, VD, inSc)` 로 손잡이와 지금 ctx·VD·inSc(부를 때마다)를 넘기고 같은 이름으로 부른다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var G = null, shadow, ring, bubble, projIn, roundRect, ctx = null, VD = null, inSc = null;
  var api = null;
  function bind(g, ctx0, VD0, inSc0) { if (G !== g) { G = g; shadow = g.shadow; ring = g.ring; bubble = g.bubble; projIn = g.projIn; roundRect = g.roundRect; } ctx = ctx0; VD = VD0; inSc = inSc0; return api; }

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

  api = { bind: bind, drawFurn: drawFurn };
  global.DG = global.DG || {};
  global.DG.villageFurn = api;
})(typeof window !== 'undefined' ? window : this);
