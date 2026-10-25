/**
 * 3마을 밭 작물 (W-0431 · 정본 유니티 U-0223 · 스타듀 밸리 밭 — 구조만, 이름·수치는 우리 것)
 * ---------------------------------------------------------------
 * 집 곁 고정 자리 밭 네 칸(사물 kind 'plot'):
 *   일굼   처음 한 번 열매 TILL_COST(8)로 네 칸을 일군다(아무 열매나 많은 것부터)
 *   씨     빈 칸에 열매 하나 = 씨(그 열매가 거둘 것이 된다)
 *   물     하루 한 번(두 번 = 한 번) · 비 오는 날 아침엔 씨 뿌린 칸이 저절로 물
 *   자람   물 받은 칸만 아침(rollDay)에 한 단계 — 물 준 날 셋 → 다 자람(새싹·자람·익음) · 빠진 날은 몰아 셈(첫 날만 물이라 한 단계)
 *   거둠   다 자라면 그 열매 +HARVEST(4) · 시들기 없음
 * 세이브 village 상태 s.crops = { tilled, cells: [{ from, stage, water }] } (순수 추가).
 * 붙는 자리(기존 줄 끝): buildProps 우편함 곁 place · interact 사물 갈래 act · rollDay 날짜 갈 때 onDay · drawProp 머리 draw2d.
 * 그림은 K-0195(world2d wheat_sprout/growing/ripe_01 · tile forest_plot/_wet) — 못 받으면 코드 도형. 손잡이 fo.crops(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var CELLS = 4, TILL_COST = 8, HARVEST = 4, RIPE = 3, STAGE_ID = [null, 'wheat_sprout_01', 'wheat_growing_01', 'wheat_ripe_01'];
  var tiles = {};

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('fo.crops', 1)); }
  function V() { return global.DG.village; }
  function VD() { return global.DG.villageData; }
  function st() { var v = V(); return v && v.state ? v.state() : null; }
  function cs(s) {
    s = s || st(); if (!s) { return null; }
    if (!s.crops || !s.crops.cells) { s.crops = { tilled: false, cells: [] }; }
    while (s.crops.cells.length < CELLS) { s.crops.cells.push({ from: null, stage: 0, water: -1 }); }
    return s.crops;
  }
  function itemOf(key) { var D = VD(); return D && D.item ? D.item(key) : null; }
  function fruits(s) { return Object.keys(s.bag || {}).filter(function (k) { var it = itemOf(k); return it && it.cat === 'fruit' && s.bag[k] > 0; }).sort(function (a, b) { return s.bag[b] - s.bag[a]; }); }
  function fruitTotal(s) { return fruits(s).reduce(function (a, k) { return a + s.bag[k]; }, 0); }
  function raining() { var T = global.DG.town; return !!(T && T.raining && T.raining()); }

  /** 밭 칸 세우기 — buildProps 가 집·우편함 자리 바로 뒤에 부른다(집 오른쪽 두 칸 × 두 줄). id 는 crop* — 'pl' 로 시작하면 syncPlanted 가 심은 나무로 알고 걷어낸다 */
  function place(props, cx, cy, TILE) {
    if (!on()) { return; }
    for (var i = 0; i < CELLS; i++) {
      props.push({ id: 'crop' + i, kind: 'plot', cell: i, x: (cx + 5 + (i % 2)) * TILE + TILE * 0.5, y: (cy - 1 + Math.floor(i / 2)) * TILE + TILE * 0.5 });
    }
  }

  /** 손을 썼다 — {kind, text} */
  function act(prop) {
    var s = st(), c = cs(s); if (!c || !on()) { return null; }
    var cell = c.cells[prop.cell || 0], day = s.day;
    if (!c.tilled) {
      if (fruitTotal(s) < TILL_COST) { return { kind: 'no', text: '🌾 열매 ' + TILL_COST + '개가 있으면 밭 네 칸을 일굽니다 (지금 ' + fruitTotal(s) + ')' }; }
      var need = TILL_COST;
      fruits(s).forEach(function (k) { var use = Math.min(need, s.bag[k]); s.bag[k] -= use; need -= use; });
      c.tilled = true;
      return done({ kind: 'plant', text: '🌾 밭 네 칸을 일구었다 — 열매를 심고 날마다 물을 주세요' });
    }
    if (!cell.from) {
      var f = fruits(s)[0]; if (!f) { return { kind: 'no', text: '심을 열매가 없습니다' }; }
      s.bag[f] -= 1; cell.from = f; cell.stage = 0; cell.water = raining() ? day : -1;
      return done({ kind: 'plant', text: '🌱 ' + itemOf(f).name + ' 씨를 뿌렸다' + (raining() ? ' — 비가 물을 줬다' : ' — 물을 주세요') });
    }
    if (cell.stage >= RIPE) {
      var it = itemOf(cell.from), V0 = V();
      if (V0 && V0.bagAdd && it) { V0.bagAdd(it, HARVEST); } else { s.bag[cell.from] = (s.bag[cell.from] || 0) + HARVEST; }
      var nm = it ? it.emoji + ' ' + it.name : cell.from;
      cell.from = null; cell.stage = 0; cell.water = -1;
      if (core().gainFeat) { core().gainFeat(2, '밭 거둠'); }
      return done({ kind: 'gather', text: '🌾 거두었다 — ' + nm + ' ×' + HARVEST });
    }
    if (cell.water === day) { return { kind: 'no', text: '💧 오늘은 이미 물을 줬습니다 (' + cell.stage + '/' + RIPE + ')' }; }
    cell.water = day;
    return done({ kind: 'water', text: '💧 물을 줬다 — 내일 아침 한 단계 (' + cell.stage + '/' + RIPE + ')' });
  }
  function done(r) { var C = core(); if (C.emit) { C.emit('changed'); } if (C.persist) { C.persist(); } return r; }

  /** 아침 — rollDay 가 날짜를 간 뒤(prev = 어제 날짜). 어제 물 받은 칸만 한 단계 · 비 오면 오늘 씨 칸 저절로 물 */
  function onDay(s, today, prev) {
    var c = cs(s); if (!c || !on()) { return 0; }
    var n = 0;
    c.cells.forEach(function (cell) {
      if (!cell.from) { return; }
      if (cell.water === prev && cell.stage < RIPE) { cell.stage += 1; n++; }   // 빠진 날 몰아 셈 — 물은 마지막 날 하루치뿐이라 한 단계
      if (raining()) { cell.water = today; }
    });
    return n;
  }

  function tileImg(id) {
    if (tiles[id]) { return tiles[id]; }
    var im = new global.Image(); im.src = 'assets/web2d/tile/' + id + '.webp'; tiles[id] = im; return im;
  }
  /** drawProp 머리 — 칸 하나(두둑 + 작물). 그렸으면 true */
  function draw2d(ctx, prop, x, y, k, now) {
    var s = st(), c = cs(s); if (!c || !on()) { return false; }
    var cell = c.cells[prop.cell || 0], day = s.day, wet = cell.water === day;
    var sz = 40 * k, im = tileImg(c.tilled ? (wet ? 'forest_plot_wet' : 'forest_plot') : 'forest_plot');
    ctx.save();
    if (!c.tilled) { ctx.globalAlpha = 0.45; }
    if (im.complete && im.naturalWidth) { ctx.drawImage(im, x - sz / 2, y - sz * 0.35, sz, sz * 0.7); }
    else { ctx.fillStyle = wet ? '#5a3f28' : '#7a5636'; ctx.fillRect(x - sz / 2, y - sz * 0.3, sz, sz * 0.6); }
    ctx.globalAlpha = 1;
    var sid = cell.from ? STAGE_ID[cell.stage] : null, M = global.DG.mode2d;
    if (sid && !(M && M.drawSprite && M.drawSprite(ctx, { id: sid, x: x, y: y + 4 * k, h: (14 + 10 * cell.stage) * k, shadow: false }))) {
      ctx.fillStyle = cell.stage >= RIPE ? '#e5c04a' : '#5fae4a'; ctx.fillRect(x - 3 * k, y - (8 + 6 * cell.stage) * k, 6 * k, (8 + 6 * cell.stage) * k);
    } else if (cell.from && cell.stage === 0) { ctx.fillStyle = '#3d2a1a'; for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - 8 * k + i * 8 * k, y, 2 * k, 0, Math.PI * 2); ctx.fill(); } }
    if (!c.tilled && prop.cell === 0) { ctx.font = 'bold ' + Math.round(11 * k) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff3c4'; ctx.strokeStyle = '#000a'; ctx.lineWidth = 3; ctx.strokeText('🌾 밭 자리', x + 20 * k, y - 24 * k); ctx.fillText('🌾 밭 자리', x + 20 * k, y - 24 * k); }
    ctx.restore();
    return true;
  }

  /** 「오늘」 창 — 밭을 일궜고 씨 칸이 있으면 한 줄(물 줄 칸 수) */
  function row() {
    var s = st(), c = cs(s); if (!c || !on() || !c.tilled) { return null; }
    var seeded = c.cells.filter(function (x) { return x.from && x.stage < RIPE; }), wet = seeded.filter(function (x) { return x.water === s.day; }).length, ripe = c.cells.filter(function (x) { return x.from && x.stage >= RIPE; }).length;
    if (!seeded.length && !ripe) { return null; }
    return { label: '밭 물 주기' + (ripe ? ' · 거둘 것 ' + ripe : ''), icon: '🌾', cur: wet, max: seeded.length || 1, done: seeded.length > 0 && wet >= seeded.length };
  }

  global.DG = global.DG || {};
  global.DG.crops = { CELLS: CELLS, TILL_COST: TILL_COST, HARVEST: HARVEST, RIPE: RIPE, place: place, act: act, onDay: onDay, draw2d: draw2d, row: row, state: function () { return cs(); } };
})(window);
