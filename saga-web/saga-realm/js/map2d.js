/**
 * 사가천하 2D 국토 지도 꾸밈 (W-0023) — `renderMap()`(src/ui-rtk/02.js)이 부르는 SVG 조각 둘:
 *   terrain(cities)   지도 밑에 깔 지형 바닥(`<defs>` 무늬 + 바탕 + 성 둘레 땅 종류별 번짐) — K-0020 `realm_*` 타일
 *   castle(d, rad)    성 점 위에 얹는 성 그림(`<image>`) — K-0017 `world2d` 스프라이트, 병력(rad) 단계로 고른다
 * 둘 다 **2D 모드(3D 가 안 서 있음)이고 자료를 받았을 때만** 문자열을 돌려주고, 아니면 빈 문자열 — 지도는 옛 모양 그대로(오류 0).
 * 판 설정 `DG.cfg.mode2d`: `tile`(땅 종류 land → 타일 id)·`prop2d`(`city:s|m|l` → { id }). 주소는 `mode2d.tileUrl`·`assets3d.spriteUrl`.
 * 성 점(`rhit`·병력 점)은 그대로 둔다 — 손가락 목표와 병력 크기 표시라서. 그림은 `pointer-events:none`.
 */
(function (global) {
  'use strict';

  var VB = { x: -140, y: -55, w: 380, h: 205 };   // renderMap 의 전체 지도 범위(MAP_VB)와 같다
  var TILE = 80;                                   // 타일 한 장이 덮는 지도 단위 폭
  var settled = false;

  function M() { return global.DG && global.DG.mode2d; }
  function cfg() { return (global.DG && global.DG.cfg && global.DG.cfg.mode2d) || {}; }

  /** 시험이 끝났을 때 한 번 지도를 다시 그리게 한다(처음 그릴 땐 아직 주소를 모른다) */
  function arm() {
    var A = global.DG && global.DG.assets3d;
    if (settled || !A) { return; }
    settled = true;
    A.whenSettled(function (ok) { if (ok && global.DG.core && global.DG.core.emit) { global.DG.core.emit('changed'); } });
  }

  function kindsOf(cities) {
    var seen = {}, list = [], i, k;
    for (i = 0; i < cities.length; i++) { k = cities[i].land; if (k && !seen[k]) { seen[k] = 1; list.push(k); } }
    return list;
  }

  function terrain(cities) {
    arm();
    var m = M();
    if (!m || !cities || !m.isOn()) { return ''; }
    var kinds = kindsOf(cities), urls = {}, ok = 0, i, s = '<defs>';
    for (i = 0; i < kinds.length; i++) { urls[kinds[i]] = m.tileUrl(kinds[i]); if (urls[kinds[i]]) { ok++; } }
    if (!ok) { return ''; }
    for (i = 0; i < kinds.length; i++) {
      if (!urls[kinds[i]]) { continue; }
      s += '<pattern id="rtp-' + kinds[i] + '" patternUnits="userSpaceOnUse" width="' + TILE + '" height="' + TILE + '">' +
        '<image href="' + urls[kinds[i]] + '" width="' + TILE + '" height="' + TILE + '"/></pattern>';
    }
    s += '<filter id="rtblur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter></defs>';
    var base = urls.plain ? 'plain' : kinds.filter(function (k) { return urls[k]; })[0];
    s += '<g class="rterrain" pointer-events="none"><rect x="' + VB.x + '" y="' + VB.y + '" width="' + VB.w + '" height="' + VB.h +
      '" fill="url(#rtp-' + base + ')" opacity="0.45"/><g filter="url(#rtblur)" opacity="0.7">';
    for (i = 0; i < cities.length; i++) {
      if (cities[i].land && urls[cities[i].land]) {
        s += '<circle cx="' + cities[i].x + '" cy="' + cities[i].y + '" r="11" fill="url(#rtp-' + cities[i].land + ')"/>';
      }
    }
    return s + '</g></g>';
  }

  /** 세력 영토 면(W-0027, 전략 시뮬 지도) — 같은 세력의 성을 굵은 둥근 선·원으로 이어 한 덩어리로 칠한다.
   *  덩어리마다 한 번에 투명하게 합쳐(겹쳐도 진해지지 않음) 살짝 번지게 하고, 같은 모양에서 바깥 테두리(국경선)만 따로 그린다.
   *  물길로 이어진 성끼리는 잇지 않는다. colorOf(세력 id) → 색. 2D 모드가 아니거나 자료가 없으면 빈 문자열 */
  function territory(cities, st, colorOf) {
    var m = M(), CDd = global.DG && global.DG.cityData, byForce = {}, order = [], i, j, k, d, c, n, col, shape, s;
    if (!m || !CDd || !cities || !st || !st.cities || !colorOf || !m.isOn()) { return ''; }
    for (i = 0; i < cities.length; i++) {
      d = cities[i]; c = st.cities[d.id];
      if (!c || !c.force) { continue; }
      if (!byForce[c.force]) { byForce[c.force] = []; order.push(c.force); }
      byForce[c.force].push(d);
    }
    if (!order.length) { return ''; }
    s = '<defs><filter id="rtmerge" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.4"/></filter>' +
      '<filter id="rtedge" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceGraphic" operator="dilate" radius="0.7" result="d"/>' +
      '<feComposite in="d" in2="SourceAlpha" operator="out" result="ring"/>' +
      '<feColorMatrix in="ring" type="matrix" values="0.6 0 0 0 0  0 0.6 0 0 0  0 0 0.6 0 0  0 0 0 1 0"/></filter></defs>';
    var fills = '', edges = '';
    for (k = 0; k < order.length; k++) {
      col = colorOf(order[k]); shape = '';
      for (i = 0; i < byForce[order[k]].length; i++) {
        d = byForce[order[k]][i];
        shape += '<circle cx="' + d.x + '" cy="' + d.y + '" r="6.5" stroke="none"/>';
        for (j = 0; j < d.adj.length; j++) {
          n = st.cities[d.adj[j]];
          if (!n || n.force !== order[k] || d.id > d.adj[j] || (CDd.isWater && CDd.isWater(d.id, d.adj[j]))) { continue; }
          n = CDd.find(d.adj[j]);
          shape += '<line x1="' + d.x + '" y1="' + d.y + '" x2="' + n.x + '" y2="' + n.y + '"/>';
        }
      }
      fills += '<g class="rterr-f" fill="' + col + '" stroke="' + col + '" stroke-width="11" stroke-linecap="round" opacity="0.46">' + shape + '</g>';
      edges += '<g fill="' + col + '" stroke="' + col + '" stroke-width="11" stroke-linecap="round">' + shape + '</g>';
    }
    return s + '<g class="rterr" pointer-events="none"><g filter="url(#rtmerge)">' + fills + '</g><g filter="url(#rtedge)" opacity="0.85">' + edges + '</g></g>';
  }

  /** 성 그림 — rad 는 renderMap 의 점 반지름(1.5~3.7, 병력 단계) */
  function castle(d, rad) {
    var m = M(), A = global.DG && global.DG.assets3d, t = cfg().prop2d;
    if (!m || !A || !t || !m.isOn()) { return ''; }
    var p = t[rad < 2.4 ? 'city:s' : rad < 3.2 ? 'city:m' : 'city:l'], u = p && A.spriteUrl(p.id);
    if (!u) { return ''; }
    var hh = 3.2 + rad * 1.5;
    return '<image class="rcastle" pointer-events="none" href="' + u + '" x="' + (d.x - hh / 2).toFixed(2) + '" y="' + (d.y - hh * 0.92).toFixed(2) +
      '" width="' + hh.toFixed(2) + '" height="' + hh.toFixed(2) + '"/>';
  }

  global.DG = global.DG || {};
  global.DG.map2d = { terrain: terrain, territory: territory, castle: castle, _reset: function () { settled = false; } };
})(typeof window !== 'undefined' ? window : this);
