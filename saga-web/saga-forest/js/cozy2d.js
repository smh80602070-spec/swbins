/**
 * 사가마을 2D — 스타듀 밸리처럼 큰 인물·세밀한 땅·아늑한 빛 (W-0133)
 * ---------------------------------------------------------------
 * village-view.js 는 큰 파일이라(tools/big-files.txt) 여기 두고 거기선 기존 줄 안에서 부른다.
 * **구면 투영은 그대로** — 배율만 키우고, 구 반지름을 같은 비로 줄여 지평선(마루)이 화면 같은 자리에 남는다.
 *
 *   zoomMul()          배율 곱(손잡이 `village.cozyZoom` 기본 1.35). `village.cozy2d` 0 이면 1 — 옛 모습 그대로
 *   specks(kind,tx,ty,se)  칸 하나의 덧칠(풀 결·꽃 점·자갈·눈 반짝) — 좌표 해시라 프레임마다 안 바뀐다(순수)
 *   rims(kind,n,e,s,w)     흙길·모래 가장자리에 풀이 넘어오는 변 / 물가 거품 변(순수)
 *   ground(ctx,list,o)     village-view drawGround 의 가까운 칸 목록 위에 위 둘을 그린다
 *   lightSpec(key)         시간대 빛(새벽 연노랑·낮 맑음·저녁 주황·밤 남색 곱하기 + 밤엔 내 둘레 등불) — 시간대는 실제 시계(phaseOf)
 *   light(ctx,ph,W,H,me,Z) 그 빛을 덮는다 — 그렸으면 true(village-view 의 옛 시간대 빛 대신)
 * 공용 Math.random 은 먹지 않는다. 그림(에셋)은 만들지 않는다 — 도형만.
 */
(function (global) {
  'use strict';

  function C() { return global.DG && global.DG.core; }
  function on() { var c = C(); return !!(c && c.tuned ? c.tuned('village.cozy2d', 1) : 1); }
  function wantZoom() {
    if (!on()) { return 1; }
    var c = C(), z = c && c.tuned ? c.tuned('village.cozyZoom', 1.35) : 1.35;
    return Math.max(0.6, Math.min(2.5, Number(z) || 1));
  }
  var usedZ = null;   // village-view resize() 가 마지막으로 쓴 배율
  function zoomMul() { usedZ = wantZoom(); return usedZ; }
  /** 손잡이(village.cozy2d·cozyZoom)가 바뀌었으면 village-view 를 다시 잰다 — 창 크기를 안 바꿔도 곧바로(리뷰 R-5) */
  function sync() { if (usedZ !== null && wantZoom() !== usedZ && global.DG.villageView) { global.DG.villageView.resize(); } }

  /* 좌표 해시 — 0~1. 칸(tx,ty)과 몇 번째(n)로만 정해진다 */
  function hh(x, y, n) {
    var s = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(n | 0, 1442695041)) | 0;
    s = Math.imul(s ^ (s >>> 13), 1274126177);
    s ^= s >>> 16;
    return (s >>> 0) / 4294967296;
  }

  var FLOWERS = {
    spring: ['#ffd1e3', '#ffffff', '#f6a5c8', '#fff3a0'],
    summer: ['#fff07a', '#ffffff', '#9ec9ff', '#ff9c7a'],
    autumn: ['#ff9b45', '#e2553a', '#ffd25a', '#c9785a'],
    winter: []
  };
  function isGrass(k) { return typeof k === 'string' && k.indexOf('grass') === 0; }

  /** 칸 하나의 덧칠 — {t:'blade'|'flower'|'pebble'|'snow'|'speck', u, v, c} (u·v = 칸 안 0~1) */
  function specks(kind, tx, ty, seKey) {
    var out = [], i, n;
    if (isGrass(kind)) {
      if (seKey === 'winter') {
        n = 1 + Math.floor(hh(tx, ty, 1) * 3);
        for (i = 0; i < n; i++) { out.push({ t: 'snow', u: hh(tx, ty, 10 + i), v: hh(tx, ty, 20 + i), c: 0 }); }
        return out;
      }
      n = 2 + Math.floor(hh(tx, ty, 1) * 3);
      for (i = 0; i < n; i++) { out.push({ t: 'blade', u: 0.1 + hh(tx, ty, 10 + i) * 0.8, v: 0.15 + hh(tx, ty, 20 + i) * 0.8, c: hh(tx, ty, 30 + i) < 0.55 ? 0 : 1 }); }
      var fl = FLOWERS[seKey] || FLOWERS.summer, pf = kind === 'grass_meadow' ? 0.32 : kind === 'grass_dark' ? 0.02 : 0.08;
      if (fl.length && hh(tx, ty, 2) < pf) { out.push({ t: 'flower', u: 0.2 + hh(tx, ty, 40) * 0.6, v: 0.2 + hh(tx, ty, 41) * 0.6, c: fl[Math.floor(hh(tx, ty, 42) * fl.length)] }); }
      if (hh(tx, ty, 3) < (kind === 'grass_rocky' ? 0.3 : 0.035)) { out.push({ t: 'pebble', u: 0.2 + hh(tx, ty, 50) * 0.6, v: 0.25 + hh(tx, ty, 51) * 0.6, c: 0 }); }
    } else if (kind === 'path') {
      n = Math.floor(hh(tx, ty, 1) * 3);
      for (i = 0; i < n; i++) { out.push({ t: 'pebble', u: 0.15 + hh(tx, ty, 10 + i) * 0.7, v: 0.15 + hh(tx, ty, 20 + i) * 0.7, c: 1 }); }
      if (hh(tx, ty, 4) < 0.5) { out.push({ t: 'speck', u: hh(tx, ty, 60), v: hh(tx, ty, 61), c: 0 }); }
    } else if (kind === 'sand') {
      n = 2 + Math.floor(hh(tx, ty, 1) * 3);
      for (i = 0; i < n; i++) { out.push({ t: 'speck', u: hh(tx, ty, 10 + i), v: hh(tx, ty, 20 + i), c: 1 }); }
    }
    return out;
  }

  /* 칸 덧칠은 (종류·칸·계절)로만 정해진다 — 매 프레임 새로 만들지 않게 담아 둔다 */
  var spCache = {}, spN = 0;
  function specksOf(kind, tx, ty, seKey) {
    var k = kind + '|' + tx + '|' + ty + '|' + seKey, v = spCache[k];
    if (!v) { if (spN > 6000) { spCache = {}; spN = 0; } v = spCache[k] = specks(kind, tx, ty, seKey); spN++; }
    return v;
  }

  /** 가장자리 — 맨땅(흙길·모래·돌길·마루) 옆이 풀이면 풀이 넘어온다('grass'), 물 옆이 땅이면 거품('foam'). 변 순서 n·e·s·w */
  function rims(kind, n, e, s, w) {
    var nb = [n, e, s, w], out = [], i, bare = kind === 'path' || kind === 'sand' || kind === 'stone' || kind === 'floor';
    for (i = 0; i < 4; i++) {
      if (bare && isGrass(nb[i])) { out.push({ side: i, t: 'grass', g: nb[i] }); }
      else if (kind === 'water' && nb[i] && nb[i] !== 'water') { out.push({ side: i, t: 'foam' }); }
    }
    return out;
  }

  function hexRgb(h) {
    h = String(h || '#63b04a').replace('#', '');
    if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function shade(h, t) {   // t<0 어둡게, t>0 밝게
    var c = hexRgb(h), m = t < 0 ? 0 : 255, a = Math.abs(t);
    return 'rgb(' + Math.round(c[0] + (m - c[0]) * a) + ',' + Math.round(c[1] + (m - c[1]) * a) + ',' + Math.round(c[2] + (m - c[2]) * a) + ')';
  }

  /** 가까운 칸 목록 위에 덧칠 — o = { project, T, se, zoom, tileAt, tiles } · list[i] = { kind, tx, ty, a0 } */
  function ground(ctx, list, o) {
    sync();
    if (!on() || !list || !list.length) { return; }
    var P = o.project, T = o.T, se = o.se || {}, Z = o.zoom || 1, key = se.key || 'summer';
    /* 풀색 — 맨풀은 village-view 처럼 바둑판((x+y) 짝수 grass · 홀수 grass2), 숲 고리 풀은 제 색(계절 안 탐) */
    var grassCol = function (k, x, y) {
      if (k === 'grass') { return ((x + y) % 2 + 2) % 2 === 0 ? (se.grass || '#63b04a') : (se.grass2 || se.grass || '#6fbb52'); }
      return (o.tiles && o.tiles[k] && o.tiles[k].color) || se.grass || '#63b04a';
    };
    var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
    var bladeD = {}, bladeL = {}, flowers = [], pebbles = [], snows = [], specksD = [], fringes = {}, foams = [];
    var i, j, it, sp, q, p, bk;
    for (i = 0; i < list.length; i++) {
      it = list[i];
      if (!it.a0 || it.a0.a < -0.8) { continue; }   // 먼 줄은 몇 픽셀 — 덧칠하면 지저분하다
      sp = specksOf(it.kind, it.tx, it.ty, key);
      for (j = 0; j < sp.length; j++) {
        q = sp[j]; p = P((it.tx + q.u) * T, (it.ty + q.v) * T);
        if (q.t === 'blade') { bk = grassCol(it.kind, it.tx, it.ty); ((q.c ? bladeL : bladeD)[bk] = (q.c ? bladeL : bladeD)[bk] || []).push(p); }
        else if (q.t === 'flower') { flowers.push({ p: p, c: q.c }); }
        else if (q.t === 'pebble') { pebbles.push({ p: p, c: q.c }); }
        else if (q.t === 'snow') { snows.push(p); }
        else { specksD.push({ p: p, k: it.kind }); }
      }
      if (o.tileAt && (it.kind === 'path' || it.kind === 'sand' || it.kind === 'stone' || it.kind === 'floor' || it.kind === 'water')) {
        var rr = rims(it.kind, o.tileAt(it.tx, it.ty - 1), o.tileAt(it.tx + 1, it.ty), o.tileAt(it.tx, it.ty + 1), o.tileAt(it.tx - 1, it.ty));
        for (j = 0; j < rr.length; j++) {
          if (rr[j].t === 'grass') { bk = grassCol(rr[j].g, it.tx + DX[rr[j].side], it.ty + DY[rr[j].side]); (fringes[bk] = fringes[bk] || []).push({ tx: it.tx, ty: it.ty, side: rr[j].side }); }
          else { foams.push({ tx: it.tx, ty: it.ty, side: rr[j].side }); }
        }
      }
    }
    ctx.save();
    ctx.lineCap = 'round';
    /* 흙길 가장자리 — 옆 풀이 톱니처럼 넘어온다(칸마다 이빨 다섯, 높이는 해시) */
    var fk, f, n, a, b, t0, t1, ax, ay, bx, by, inx, iny;
    for (fk in fringes) {
      ctx.beginPath();
      for (i = 0; i < fringes[fk].length; i++) {
        f = fringes[fk][i];
        for (n = 0; n < 5; n++) {
          t0 = n / 5; t1 = (n + 1) / 5;
          var dep = 0.08 + hh(f.tx * 4 + f.side, f.ty, 70 + n) * 0.12;
          if (f.side === 0) { a = [t0, 0]; b = [t1, 0]; inx = 0; iny = dep; }
          else if (f.side === 2) { a = [t0, 1]; b = [t1, 1]; inx = 0; iny = -dep; }
          else if (f.side === 1) { a = [1, t0]; b = [1, t1]; inx = -dep; iny = 0; }
          else { a = [0, t0]; b = [0, t1]; inx = dep; iny = 0; }
          ax = (f.tx + a[0]) * T; ay = (f.ty + a[1]) * T; bx = (f.tx + b[0]) * T; by = (f.ty + b[1]) * T;
          var pa = P(ax, ay), pb = P(bx, by), pm = P((ax + bx) / 2 + inx * T, (ay + by) / 2 + iny * T);
          ctx.moveTo(pa.x, pa.y); ctx.lineTo(pm.x, pm.y); ctx.lineTo(pb.x, pb.y); ctx.closePath();
        }
      }
      ctx.fillStyle = fk; ctx.fill();
    }
    /* 물가 거품 — 땅에 닿은 변을 따라 옅은 흰 줄 */
    if (foams.length) {
      ctx.beginPath();
      for (i = 0; i < foams.length; i++) {
        f = foams[i];
        var e0 = f.side === 0 ? [0, 0.1, 1, 0.1] : f.side === 2 ? [0, 0.9, 1, 0.9] : f.side === 1 ? [0.9, 0, 0.9, 1] : [0.1, 0, 0.1, 1];
        var fa = P((f.tx + e0[0]) * T, (f.ty + e0[1]) * T), fb = P((f.tx + e0[2]) * T, (f.ty + e0[3]) * T);
        ctx.moveTo(fa.x, fa.y); ctx.lineTo(fb.x, fb.y);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2.2 * Z; ctx.stroke();
    }
    /* 풀 결 — 짧은 두 갈래 획, 어두운 것·밝은 것 */
    function blades(map, t) {
      for (var bc in map) {
        ctx.beginPath();
        for (var m = 0; m < map[bc].length; m++) {
          var g = map[bc][m], hgt = 5 * Z * g.s, w = 1.6 * Z * g.s;
          ctx.moveTo(g.x - w, g.y); ctx.lineTo(g.x - w * 1.6, g.y - hgt);
          ctx.moveTo(g.x + w * 0.2, g.y); ctx.lineTo(g.x + w * 0.8, g.y - hgt * 1.2);
        }
        ctx.strokeStyle = shade(bc, t); ctx.lineWidth = Math.max(1, 1.3 * Z); ctx.stroke();
      }
    }
    blades(bladeD, -0.26); blades(bladeL, 0.22);
    /* 맨땅 알갱이 */
    if (specksD.length) {
      ctx.fillStyle = 'rgba(110,80,40,0.28)';
      ctx.beginPath();
      for (i = 0; i < specksD.length; i++) { p = specksD[i].p; ctx.moveTo(p.x + 1.4 * Z * p.s, p.y); ctx.arc(p.x, p.y, 1.4 * Z * p.s, 0, Math.PI * 2); }
      ctx.fill();
    }
    /* 자갈 — 회색 알 + 위쪽 빛 */
    for (i = 0; i < pebbles.length; i++) {
      p = pebbles[i].p; var pr = 2.6 * Z * p.s;
      ctx.fillStyle = pebbles[i].c ? '#9a8466' : '#8e8a80'; ctx.beginPath(); ctx.ellipse(p.x, p.y, pr, pr * 0.62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(p.x - pr * 0.25, p.y - pr * 0.22, pr * 0.42, pr * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    }
    /* 꽃 점 — 꽃잎 넷 + 노란 술 */
    for (i = 0; i < flowers.length; i++) {
      p = flowers[i].p; var r = 1.7 * Z * p.s;
      ctx.fillStyle = flowers[i].c;
      ctx.beginPath();
      ctx.arc(p.x - r, p.y, r, 0, Math.PI * 2); ctx.moveTo(p.x + 2 * r, p.y); ctx.arc(p.x + r, p.y, r, 0, Math.PI * 2);
      ctx.moveTo(p.x + r, p.y - r * 0.8); ctx.arc(p.x, p.y - r * 0.8, r, 0, Math.PI * 2); ctx.moveTo(p.x + r, p.y + r * 0.8); ctx.arc(p.x, p.y + r * 0.8, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2b632'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.7, 0, Math.PI * 2); ctx.fill();
    }
    /* 겨울 눈 반짝 */
    if (snows.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      for (i = 0; i < snows.length; i++) { p = snows[i]; ctx.moveTo(p.x + 1.5 * Z * p.s, p.y); ctx.arc(p.x, p.y, 1.5 * Z * p.s, 0, Math.PI * 2); }
      ctx.fill();
    }
    ctx.restore();
  }

  /* ── 빛 ─────────────────────────────────────────────────
   * mul   화면 전체를 곱하는 시간대 색(곱하기라 밝은 풀도 제대로 저문다 — 얹기만 하면 뿌옇게 바랜다)
   * near  밤 — 내 둘레는 이 색으로 덜 곱한다(등불)   glow  등불 빛 번짐
   * warm  해 쪽 따뜻한 빛 번짐(새벽·저녁)            vign  가장자리 어둡게(아늑함)
   */
  var LIGHT = {
    dawn:  { mul: 'rgb(255,238,204)', near: null,              glow: null,                     warm: 'rgba(255,236,170,0.20)', vign: 0.12 },
    day:   { mul: null,               near: null,              glow: null,                     warm: null,                     vign: 0.08 },
    even:  { mul: 'rgb(255,196,150)', near: null,              glow: null,                     warm: 'rgba(255,170,90,0.18)',  vign: 0.18 },
    night: { mul: 'rgb(64,78,150)', a: 0.75, near: 'rgb(214,200,180)', glow: 'rgba(255,190,110,0.22)', warm: null,                     vign: 0.26 }
  };
  function lightSpec(key) { return LIGHT[key] || LIGHT.day; }

  /* 해 쪽(새벽 왼쪽 위·저녁 오른쪽 위) 따뜻한 빛 + 가장자리 어둡게 — 반 크기 화면 밖 캔버스에 한 번 */
  var layC = null, layKey = '';
  function layer(key, L, W, H) {
    if (!L.warm && !L.vign) { return null; }
    var k = key + '|' + W + '|' + H;
    if (layC && layKey === k) { return layC; }
    if (typeof document === 'undefined') { return null; }
    var w = Math.max(1, Math.round(W / 2)), h = Math.max(1, Math.round(H / 2)), cv = layC || document.createElement('canvas'), c, g;
    cv.width = w; cv.height = h; c = cv.getContext('2d');
    c.clearRect(0, 0, w, h);
    if (L.warm) {
      var sx = key === 'dawn' ? w * 0.12 : w * 0.88;
      g = c.createRadialGradient(sx, 0, 0, sx, 0, Math.max(w, h) * 0.75);
      g.addColorStop(0, L.warm); g.addColorStop(1, 'rgba(255,200,120,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
    if (L.vign) {
      g = c.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.78);
      g.addColorStop(0, 'rgba(40,24,10,0)'); g.addColorStop(1, 'rgba(40,24,10,' + L.vign + ')');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
    layC = cv; layKey = k;
    return cv;
  }

  function light(ctx, ph, W, H, me, Z) {
    if (!on() || !ph) { return false; }
    var L = lightSpec(ph.key), z = Z || 1, g, lr = Math.max(150, Math.min(W, H) * 0.42), mx = me ? me.x : W / 2, my = (me ? me.y : H / 2) - 24 * z;
    ctx.save();
    if (L.mul) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = L.a || 1;
      if (L.near) {
        g = ctx.createRadialGradient(mx, my, lr * 0.2, mx, my, lr);
        g.addColorStop(0, L.near); g.addColorStop(1, L.mul);
        ctx.fillStyle = g;
      } else { ctx.fillStyle = L.mul; }
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (L.glow) {
      g = ctx.createRadialGradient(mx, my, 0, mx, my, lr * 0.8);
      g.addColorStop(0, L.glow); g.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    var lay = layer(ph.key, L, W, H);
    if (lay) { ctx.drawImage(lay, 0, 0, W, H); }
    ctx.restore();
    return true;
  }

  global.DG = global.DG || {};
  global.DG.cozy2d = { on: on, zoomMul: zoomMul, wantZoom: wantZoom, sync: sync, specks: specks, rims: rims, ground: ground, lightSpec: lightSpec, light: light, _hash: hh };
})(window);
