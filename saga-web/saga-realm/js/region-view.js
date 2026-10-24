/**
 * 지역 단위 전략 지도 (W-0400 · PLAN §5-17, 사용자 10-25 "전략 지도를 전체 보여주지 말고 나라 지역마다 나오게")
 *
 * 한 화면 = 한 지역(나라). 성의 prov(data-city.js) 를 묶는다 — 세 트랙 같은 표(고돗 G-0347 ① `realm_regions.gd` 가 먼저 정한 것을 그대로):
 *   확장 지역은 prov 하나 = 지역 하나 · 중국 주는 이웃 주끼리 넷(하북·중원·서촉·강남).
 * 이웃 지역 = 두 지역 성 사이에 길(CITIES[].adj)이 하나라도 있으면. 표는 처음 부를 때 한 번 센다(순수 — 데이터만 봄).
 * 지금 지역은 세이브 `save.rtk.view.region` — 없거나 모르는 값이면 내 성이 가장 많은 지역(옛 세이브도 그대로 열림).
 * 손잡이 `realm.regionView` 1(0 = 옛 전체 지도).
 *
 * DG.regionView = { on, REGIONS, regionOf(cityId), cities(rid), neighbors(rid), bbox(rid), name(rid), current(), set(rid), home(), links(rid) }
 */
(function (global) {
  'use strict';

  var REGIONS = [
    { id: 'hebei', name: '하북', provs: ['you', 'ji', 'bing', 'qing'] },
    { id: 'zhongyuan', name: '중원', provs: ['yan', 'si', 'yu', 'xu'] },
    { id: 'xishu', name: '서촉', provs: ['liang', 'yong', 'yi'] },
    { id: 'jiangnan', name: '강남', provs: ['jing', 'yang'] },
    { id: 'kr', name: '한국', provs: ['kr'] },
    { id: 'jp', name: '일본', provs: ['jp'] },
    { id: 'jiao', name: '교주', provs: ['jiao'] },
    { id: 'xi', name: '서역', provs: ['xi'] },
    { id: 'nz', name: '남중', provs: ['nz'] },
    { id: 'tz', name: '천축', provs: ['tz'] },
    { id: 'mb', name: '막북', provs: ['mb'] },
    { id: 'cp', name: '임읍', provs: ['cp'] },
    { id: 'fu', name: '균열', provs: ['fu'] },
    { id: 'pf', name: '폐허', provs: ['pf'] },
    { id: 'my', name: '묘역', provs: ['my'] },
    { id: 'dj', name: '대진', provs: ['dj'] },   // 웹에만 있는 넷(성 25, 09-22 확장) — 고돗·유니티엔 없는 지역
    { id: 'xb', name: '선비', provs: ['xb'] },
    { id: 'sl', name: '실크로드', provs: ['sl'] },
    { id: 'nh', name: '남해', provs: ['nh'] }
  ];
  var PAD = 9;   // 지역 경계 여백(지도 단위) — 이름표·가장자리 화살표 자리

  function CD() { return global.DG && global.DG.cityData; }
  function core() { return global.DG && global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('realm.regionView', 1)); }

  var built = null;   // { of: {cityId: rid}, cities: {rid: [city]}, nb: {rid: [rid]}, box: {rid: {x,y,w,h}}, out: {rid: [{from, to, rid}]} }
  function build() {
    if (built) { return built; }
    var D = CD(), provRegion = {}, b = { of: {}, cities: {}, nb: {}, box: {}, out: {} }, i, j, r, c, o;
    if (!D || !D.CITIES) { return null; }
    for (i = 0; i < REGIONS.length; i++) { r = REGIONS[i]; b.cities[r.id] = []; b.nb[r.id] = []; b.out[r.id] = []; for (j = 0; j < r.provs.length; j++) { provRegion[r.provs[j]] = r.id; } }
    for (i = 0; i < D.CITIES.length; i++) { c = D.CITIES[i]; r = provRegion[c.prov] || ''; b.of[c.id] = r; if (r) { b.cities[r].push(c); } }
    for (i = 0; i < D.CITIES.length; i++) {
      c = D.CITIES[i]; r = b.of[c.id];
      for (j = 0; j < (c.adj || []).length; j++) {
        o = D.find ? D.find(c.adj[j]) : null; if (!o) { continue; }
        var r2 = b.of[o.id];
        if (!r || !r2 || r === r2) { continue; }
        if (b.nb[r].indexOf(r2) < 0) { b.nb[r].push(r2); }
        b.out[r].push({ from: c, to: o, rid: r2 });
      }
    }
    for (i = 0; i < REGIONS.length; i++) {
      var L = b.cities[REGIONS[i].id], x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (j = 0; j < L.length; j++) { x0 = Math.min(x0, L[j].x); y0 = Math.min(y0, L[j].y); x1 = Math.max(x1, L[j].x); y1 = Math.max(y1, L[j].y); }
      if (L.length) { b.box[REGIONS[i].id] = { x: x0 - PAD, y: y0 - PAD, w: x1 - x0 + PAD * 2, h: y1 - y0 + PAD * 2 }; }
    }
    built = b;
    return b;
  }
  function regionOf(cityId) { var b = build(); return (b && b.of[cityId]) || ''; }
  function cities(rid) { var b = build(); return (b && b.cities[rid]) || []; }
  function neighbors(rid) { var b = build(); return ((b && b.nb[rid]) || []).slice(); }
  function links(rid) { var b = build(); return (b && b.out[rid]) || []; }
  function bbox(rid) { var b = build(); return (b && b.box[rid]) || null; }
  function name(rid) { for (var i = 0; i < REGIONS.length; i++) { if (REGIONS[i].id === rid) { return REGIONS[i].name; } } return ''; }

  function st() { var R = global.DG && global.DG.rtk; return R && R.state ? R.state() : null; }
  /** 내 성이 가장 많은 지역(같으면 표 순서 앞) — 없으면 표 첫 지역 */
  function home() {
    var s = st(), b = build(), best = REGIONS[0].id, bn = -1, i, n, j, L;
    if (!s || !b || !s.me) { return best; }
    for (i = 0; i < REGIONS.length; i++) {
      L = b.cities[REGIONS[i].id]; n = 0;
      for (j = 0; j < L.length; j++) { if (s.cities[L[j].id] && s.cities[L[j].id].force === s.me) { n++; } }
      if (n > bn) { bn = n; best = REGIONS[i].id; }
    }
    return best;
  }
  function valid(rid) { return !!(rid && bbox(rid)); }
  function current() {
    var s = st(), v = s && s.view && s.view.region;
    return valid(v) ? v : home();
  }
  function set(rid) {
    var s = st();
    if (!s || !valid(rid)) { return false; }
    if (!s.view || typeof s.view !== 'object') { s.view = {}; }
    if (s.view.region === rid) { return false; }
    s.view.region = rid;
    var C = core(); if (C && C.persist) { C.persist(); }
    if (C && C.emit) { C.emit('region', rid); }
    return true;
  }

  global.DG = global.DG || {};
  global.DG.regionView = { on: on, REGIONS: REGIONS, regionOf: regionOf, cities: cities, neighbors: neighbors, links: links, bbox: bbox, name: name, current: current, set: set, home: home, _reset: function () { built = null; } };
})(typeof window !== 'undefined' ? window : this);
