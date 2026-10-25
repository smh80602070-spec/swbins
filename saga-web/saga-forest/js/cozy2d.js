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
 * W-0142 K 산출 배선(cfg.mode2d 의 tileSeason·seam·prop2d.night·lit — 그림이 아직 안 왔으면 옛 도형 그대로):
 *   tileSrc(kind,seKey)    풀 칸의 계절 타일 주소(없으면 null → 옛 표)
 *   seamPick(kind,nb8,seKey) 맨땅 칸 둘레 풀 → 이음 조각 [{id, rot, side|corner}] (순수 — 변 rot 0~3 = 북·동·남·서, 모서리 0~3 = 북서·북동·남동·남서)
 *   propId(kind,night)     그 소품의 낮/밤 그림 id · lit(kind,x,y,k) 밤이면 창·등불 자리를 이 프레임 빛 목록에(light 가 더해 그린다)
 * 공용 Math.random 은 먹지 않는다. 그림(에셋)은 만들지 않는다 — 도형만.
 */
(function (global) {
  'use strict';

  function C() { return global.DG && global.DG.core; }
  function M() { return (global.DG && global.DG.cfg && global.DG.cfg.mode2d) || {}; }
  function m2on() { var m = global.DG && global.DG.mode2d; return !!(m && m.isOn && m.isOn()); }
  function on() { var c = C(); return !!(c && c.tuned ? c.tuned('village.cozy2d', 1) : 1); }
  /** 10-26 사용자 「3번 2d는 배경이 1번,2번 처럼」 — 실사 땅(계절 풀·흙·돌 타일 + 이음 조각)만: 꽃 무늬 이음 아틀라스(village-view autotile)·풀 결·꽃 점·자갈·톱니 가장자리 덧칠을 끈다. 손잡이 village.realGround(1, 0 = 옛 만화 땅) */
  function real() { var c = C(); return !!(c && c.tuned ? +c.tuned('village.realGround', 1) : 1); }
  function wantZoom() {
    if (!on()) { return 1; }
    var c = C(), z = c && c.tuned ? c.tuned('village.cozyZoom', 2.1) : 2.1;   // W-0204 1.35 → 2.1(몸 75 → ≈117px/720 — RPG 처럼 1/6)
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
    glowQ.length = 0;   // W-0142 밤 빛 목록은 프레임마다 새로(소품이 다시 채운다)
    if (!on() || !list || !list.length) { return; }
    var P = o.project, T = o.T, se = o.se || {}, Z = o.zoom || 1, key = se.key || 'summer';
    /* 풀색 — 맨풀은 village-view 처럼 바둑판((x+y) 짝수 grass · 홀수 grass2), 숲 고리 풀은 제 색(계절 안 탐) */
    var grassCol = function (k, x, y) {
      if (k === 'grass') { return ((x + y) % 2 + 2) % 2 === 0 ? (se.grass || '#63b04a') : (se.grass2 || se.grass || '#6fbb52'); }
      return (o.tiles && o.tiles[k] && o.tiles[k].color) || se.grass || '#63b04a';
    };
    var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
    var bladeD = {}, bladeL = {}, flowers = [], pebbles = [], snows = [], specksD = [], fringes = {}, foams = [], seams = [];
    var i, j, it, sp, q, p, bk, sm, done, rl = real();
    for (i = 0; i < list.length; i++) {
      it = list[i];
      if (!it.a0 || it.a0.a < -0.8) { continue; }   // 먼 줄은 몇 픽셀 — 덧칠하면 지저분하다
      sp = rl ? [] : specksOf(it.kind, it.tx, it.ty, key);
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
        sm = seamPick(it.kind, nb8(o.tileAt, it.tx, it.ty), key); done = {};
        for (j = 0; j < sm.length; j++) {   // W-0142 이음 타일 — 구운 조각이 선 변만 옛 도형을 끈다(R-5: 풀 무늬를 못 받으면 옛 톱니 그대로)
          var cv = seamTint(sm[j].id, grassCol(sm[j].g, it.tx + sm[j].dx, it.ty + sm[j].dy), tileSrc(sm[j].g, key), sm[j].corner !== undefined);
          if (!cv) { continue; }
          seams.push({ it: it, s: sm[j], cv: cv });
          if (sm[j].side !== undefined) { done[sm[j].side] = 1; }
        }
        for (j = 0; j < rr.length; j++) {
          if (done[rr[j].side]) { continue; }
          if (rr[j].t === 'grass') { if (rl) { continue; } bk = grassCol(rr[j].g, it.tx + DX[rr[j].side], it.ty + DY[rr[j].side]); (fringes[bk] = fringes[bk] || []).push({ tx: it.tx, ty: it.ty, side: rr[j].side }); }
          else { foams.push({ tx: it.tx, ty: it.ty, side: rr[j].side }); }
        }
      }
    }
    ctx.save();
    ctx.lineCap = 'round';
    /* W-0142 이음 타일 — 맨땅 칸 위에 풀 가장자리 조각을 돌려 얹는다(옆 풀 색 + 같은 덧씌움이라 이웃 칸과 이어진다) */
    for (i = 0; i < seams.length; i++) { drawSeam(ctx, seams[i], P, T); }
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
    if (ph.key === 'night' && glowQ.length) { drawGlows(ctx); }   // W-0142 창·등불 — 어둡게 덮은 뒤 더한다
    var lay = layer(ph.key, L, W, H);
    if (lay) { ctx.drawImage(lay, 0, 0, W, H); }
    ctx.restore();
    return true;
  }

  /* ── W-0142 K 산출 배선 ───────────────────────────────── */
  /** 풀 칸의 계절 타일 주소 — 2D 모드·표에 있을 때만, 아니면 null(옛 표) */
  function tileSrc(kind, seKey) {
    var m = M(), id = isGrass(kind) && m.tile && m.tile[kind] === m.tile.grass && m.tileSeason && m.tileSeason[seKey];   // R-5 풀 그림을 쓰는 칸만(바위 지대 grass_rocky 는 돌길 그대로)
    if (!id || !m2on()) { return null; }
    return (m.tileBase || 'assets/web2d/tile/') + id + '.webp';
  }
  /** 여덟 이웃 [북, 동, 남, 서, 북동, 남동, 남서, 북서] */
  function nb8(at, x, y) { return [at(x, y - 1), at(x + 1, y), at(x, y + 1), at(x - 1, y), at(x + 1, y - 1), at(x + 1, y + 1), at(x - 1, y + 1), at(x - 1, y - 1)]; }
  var SDX = [0, 1, 0, -1], SDY = [-1, 0, 1, 0], CDX = [-1, 1, 1, -1], CDY = [-1, -1, 1, 1], CNB = [7, 4, 5, 6];   // 모서리 0~3 = 북서·북동·남동·남서 → nb8 칸
  /** 맨땅 칸(kind) 둘레 풀 → 이음 조각. 변: 그 변 이웃이 풀. 모서리: 대각 이웃만 풀(맞닿은 두 변은 풀 아님). 겨울은 없음(눈 이음 그림이 없다) */
  function seamPick(kind, nb, seKey) {
    var tab = M().seam, v = tab && tab['grass|' + kind], out = [], r, a, b;
    if (!v || seKey === 'winter' || !nb) { return out; }
    for (r = 0; r < 4; r++) { if (isGrass(nb[r])) { out.push({ id: 'forest_edge_' + v, rot: r, side: r, g: nb[r], dx: SDX[r], dy: SDY[r] }); } }
    for (r = 0; r < 4; r++) {
      a = (r + 3) % 4; b = r;   // 모서리 r 에 맞닿은 두 변: 북서 = 서·북, 북동 = 북·동, 남동 = 동·남, 남서 = 남·서
      if (isGrass(nb[CNB[r]]) && !isGrass(nb[a]) && !isGrass(nb[b])) { out.push({ id: 'forest_corner_' + v, rot: r, corner: r, g: nb[CNB[r]], dx: CDX[r], dy: CDY[r] }); }
    }
    return out;
  }
  var imgs = {};
  function imgAt(url) {
    if (!url || typeof Image === 'undefined') { return null; }
    var e = imgs[url];
    if (!e) { e = imgs[url] = { img: new Image(), ok: false }; e.img.onload = function () { e.ok = true; }; e.img.src = url; }
    return e.ok ? e.img : null;
  }
  function seamImg(id) { return m2on() ? imgAt((M().tileBase || 'assets/web2d/tile/') + id + '.webp') : null; }
  /** 이음 조각이 칸을 덮는 깊이(1 = 그림 그대로 — 풀이 칸 ⅓ 을 먹어 한 칸 흙길이 실처럼 가늘어진다) */
  function seamDepth() { var c = C(), d = c && c.tuned ? c.tuned('village.seamDepth', 0.5) : 0.5; return Math.max(0.2, Math.min(1, Number(d) || 0.5)); }
  /* 조각 → 한 번 구운 캔버스: 이웃 풀 칸과 **같은 밑색 + 같은 계절 풀 무늬(overlay 0.6)** 에 조각 알파만 빌린다(조각 무늬는 여름 풀이라 그대로 쓰면 가을·봄에 혼자 푸르다).
     깊이 d — 변은 세로만, 모서리는 가로세로 다 d 배로 줄인 알파 */
  var seamCv = {}, seamCvN = 0;
  function seamTint(id, col, gsrc, corner) {
    var d = seamDepth(), rl = real(), k = id + '|' + col + '|' + gsrc + '|' + d + '|' + rl, c = seamCv[k], img = seamImg(id), gimg = imgAt(gsrc), g, w, h;
    if (c || !img || typeof document === 'undefined') { return c || null; }
    if (gsrc && !gimg) { return null; }   // 풀 무늬를 기다린다(그동안 옛 톱니가 아니라 그냥 빈 변 — 한두 프레임)
    if (seamCvN > 96) { seamCv = {}; seamCvN = 0; }
    w = img.naturalWidth; h = img.naturalHeight;
    c = document.createElement('canvas'); c.width = Math.max(1, Math.round(corner ? w * d : w)); c.height = Math.max(1, Math.round(h * d)); g = c.getContext('2d');
    if (!(rl && gimg)) { g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); }   // 10-26 실사 땅 — 단색 + 덧씌움 대신 계절 풀 그림을 그대로 이음 모양으로 자른다
    if (gimg) { g.globalCompositeOperation = rl ? 'source-over' : 'overlay'; g.globalAlpha = rl ? 1 : 0.6; g.drawImage(gimg, 0, 0, w, h); }
    g.globalCompositeOperation = 'destination-in'; g.globalAlpha = 1; g.drawImage(img, 0, 0, c.width, c.height);
    c.u = c.width / w; c.v = d;   // 칸에서 차지하는 비율
    seamCv[k] = c; seamCvN++;
    return c;
  }
  /** 돌림 r(시계 방향 90°×r) — 그림 왼위·오른위·왼아래가 칸의 어느 꼭짓점(0~1)에 가나 */
  var ROT = [[[0, 0], [1, 0], [0, 1]], [[1, 0], [1, 1], [0, 0]], [[1, 1], [0, 1], [1, 0]], [[0, 1], [0, 0], [1, 1]]];
  function drawSeam(ctx, e, P, T) {
    var cv = e.cv, R = ROT[e.s.rot], it = e.it;
    var ax = R[0][0], ay = R[0][1], bx = ax + (R[1][0] - ax) * cv.u, by = ay + (R[1][1] - ay) * cv.u, cx = ax + (R[2][0] - ax) * cv.v, cy = ay + (R[2][1] - ay) * cv.v;
    var a = P((it.tx + ax) * T, (it.ty + ay) * T), b = P((it.tx + bx) * T, (it.ty + by) * T), c = P((it.tx + cx) * T, (it.ty + cy) * T);
    ctx.save();
    ctx.transform((b.x - a.x) / cv.width, (b.y - a.y) / cv.width, (c.x - a.x) / cv.height, (c.y - a.y) / cv.height, a.x, a.y);
    ctx.drawImage(cv, 0, 0);
    ctx.restore();
  }

  /* 밤인가 — 소품마다 불리니 1초에 한 번만 센다(R-5: 소품마다 new Date) */
  var nightAt = -1e9, nightV = false;
  function isNight() {
    var t = Date.now(), VD;
    if (t - nightAt < 1000) { return nightV; }
    nightAt = t; VD = global.DG && global.DG.villageData;
    nightV = !!(VD && VD.phaseOf && VD.phaseOf(new Date(t).getHours()).key === 'night');
    return nightV;
  }
  /** 소품 그림 id — 밤이고 밤 변종이 있으면 그것, 아니면 낮 id */
  function propId(kind, night) {
    var p = M().prop2d && M().prop2d[kind];
    if (!p) { return null; }
    var day = p.day || p.id;
    return night && p.night ? p.night : day;
  }
  /* prop2d 의 id 를 밤엔 밤 변종으로 — mode2d.drawKind 가 p.id 를 읽는다(공용 파일은 안 고침).
     밤 그림이 아직 안 섰으면 낮 그림(빈 프레임·옛 도형 깜빡임 없게) */
  (function wireNight() {
    var t = M().prop2d, k;
    if (!t) { return; }
    for (k in t) {
      if (!Object.prototype.hasOwnProperty.call(t, k) || !t[k].night || t[k].day) { continue; }
      (function (p, kind) {
        p.day = p.id;
        Object.defineProperty(p, 'id', { enumerable: true, configurable: true, get: function () {
          if (!on() || !isNight()) { return p.day; }
          var md = global.DG.mode2d;
          return md && md.spriteReady && md.spriteReady(p.night) ? p.night : p.day;
        } });
      })(t[k], k);
    }
  })();

  /* 밤 빛 목록 — 소품을 그릴 때 채우고(lit) light() 가 더해 그린다 */
  var glowQ = [], boxes = {};
  function boxOf(id) {
    var e = boxes[id], A = global.DG && global.DG.assets3d, u;
    if (e) { return e.box; }
    u = A && A.spriteUrl && A.spriteUrl(id);
    if (!u || typeof Image === 'undefined' || typeof document === 'undefined') { return null; }
    e = boxes[id] = { box: null, img: new Image() };
    e.img.onload = function () {   // mode2d 와 같은 자름(알파 있는 범위) — 그 상자 안 좌표로 옮긴다
      try {
        var im = e.img, w = im.naturalWidth, h = im.naturalHeight, c = document.createElement('canvas'), g, d, x, y, x0 = w, y0 = h, x1 = -1, y1 = -1;
        c.width = w; c.height = h; g = c.getContext('2d'); g.drawImage(im, 0, 0); d = g.getImageData(0, 0, w, h).data;
        for (y = 0; y < h; y++) { for (x = 0; x < w; x++) { if (d[(y * w + x) * 4 + 3] > 16) { if (x < x0) { x0 = x; } if (x > x1) { x1 = x; } if (y < y0) { y0 = y; } if (y > y1) { y1 = y; } } } }
        e.box = x1 >= 0 ? { sx: x0, sy: y0, sw: x1 - x0 + 1, sh: y1 - y0 + 1 } : { sx: 0, sy: 0, sw: w, sh: h };
      } catch (err) { e.box = { sx: 0, sy: 0, sw: e.img.naturalWidth, sh: e.img.naturalHeight }; }
    };
    e.img.src = u;
    return null;
  }
  /** 그림 픽셀 점들 → 화면 점(발 밑 가운데 x,y · 키 h) — 순수 */
  function litPoints(pts, box, x, y, h) {
    var w = h * box.sw / box.sh, out = [], i;
    for (i = 0; i < pts.length; i++) { out.push({ x: x - w / 2 + (pts[i][0] - box.sx) / box.sw * w, y: y - h + (pts[i][1] - box.sy) / box.sh * h, r: pts[i][2] * h / box.sh }); }
    return out;
  }
  function lit(kind, x, y, k) {
    if (!on() || !isNight()) { return 0; }
    var p = M().prop2d && M().prop2d[kind], day = p && (p.day || p.id), pts = day && M().lit && M().lit[day], box;
    if (!pts || !(box = boxOf(day))) { return 0; }
    var add = litPoints(pts, box, x, y, p.h * (k || 1));
    for (var i = 0; i < add.length && glowQ.length < 200; i++) { glowQ.push(add[i]); }
    return add.length;
  }
  function drawGlows(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < glowQ.length; i++) {
      var q = glowQ[i], r = Math.max(4, q.r * 2.4), g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 3);
      g.addColorStop(0, 'rgba(255,214,140,0.85)'); g.addColorStop(1 / 3, 'rgba(255,170,80,0.32)'); g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g; ctx.fillRect(q.x - r * 3, q.y - r * 3, r * 6, r * 6);
    }
    ctx.globalCompositeOperation = 'source-over';
    glowQ.length = 0;
  }

  global.DG = global.DG || {};
  global.DG.cozy2d = { on: on, real: real, zoomMul: zoomMul, wantZoom: wantZoom, sync: sync, specks: specks, rims: rims, ground: ground, lightSpec: lightSpec, light: light, _hash: hh,
    tileSrc: tileSrc, seamPick: seamPick, seamDepth: seamDepth, nb8: nb8, propId: propId, lit: lit, litPoints: litPoints, ROT: ROT, _glows: function () { return glowQ.length; } };
})(window);
