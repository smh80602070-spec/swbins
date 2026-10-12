/**
 * 3마을 곤충 몸 그리기 열 가지(나비·무당벌레·딱정벌레·잠자리·반딧불이·매미·말벌·달팽이·메뚜기·거미) — village-view.js 에서 떼어 냄(R-4)
 * ---------------------------------------------------------------
 * 그리는 자리·그림자·말풍선·고리는 village-view.js `drawBug` 가 맡고, 여기는 (x, y, 크기 k) 에 몸만 그린다.
 * `paint(ctx, form, x, y, k, ref, b, ph, now)` — form 은 data-village 곤충의 `form`, 모르는 것은 거미.
 */
(function (global) {
  'use strict';

  var ctx = null;

  /* 색 도구 — village-view.js 와 같은 식(그쪽 것은 땅·사물도 쓴다) */
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

  function paint(c, form, x, y, k, ref, b, ph, now) {
    ctx = c;
    switch (form) {
      case 'butterfly': bugButterfly(x, y, k, ref, b, now); break;
      case 'ladybug':   bugLadybug(x, y, k, ref); break;
      case 'beetle':    bugBeetle(x, y, k, ref); break;
      case 'dragonfly': bugDragonfly(x, y, k, ref, b, now); break;
      case 'firefly':   bugFirefly(x, y, k, ref, b, ph, now); break;
      case 'cicada':    bugCicada(x, y, k, ref); break;
      case 'wasp':      bugWasp(x, y, k, ref, b, now); break;
      case 'snail':     bugSnail(x, y, k, ref); break;
      case 'hopper':    bugHopper(x, y, k, ref); break;
      default:          bugSpider(x, y, k, ref);
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

  global.DG = global.DG || {};
  global.DG.bugPaint = { paint: paint };
})(window);
