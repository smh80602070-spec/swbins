/**
 * 사가국지 2D 국토 지도 꾸밈 (W-0023) — `renderMap()`(src/ui-rtk/02.js)이 부르는 SVG 조각 둘:
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
  global.DG.map2d = { terrain: terrain, castle: castle, _reset: function () { settled = false; } };
})(typeof window !== 'undefined' ? window : this);
