/**
 * 3마을 2D 소품 그리기 — 나무·소나무·바위·꽃·모종·채집 자리·찌·게시판·한옥 도형·풀·땅 파기·조개·내 집. village-view.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * village-view.js 의 drawProp 이 `use({ shadow, evTag }, ctx)` 로 손잡이와 지금 캔버스를 넘기고 PR.drawX 로 부른다(통일 스프라이트가 없을 때의 옛 그림).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var G = null, shadow, evTag, ctx = null;
  var api = null;
  function use(g, c) { if (G !== g) { G = g; shadow = g.shadow; evTag = g.evTag; } ctx = c; return api; }
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

  api = { use: use, drawTree: drawTree, drawPine: drawPine, drawRock: drawRock, drawFlower: drawFlower, drawSapling: drawSapling, drawSpot: drawSpot, drawFloat: drawFloat, drawBoard: drawBoard, drawHanok: drawHanok, drawWeed: drawWeed, drawDig: drawDig, drawShell: drawShell, drawMyHouse: drawMyHouse };
  global.DG = global.DG || {};
  global.DG.villageProps2d = api;
})(typeof window !== 'undefined' ? window : globalThis);
