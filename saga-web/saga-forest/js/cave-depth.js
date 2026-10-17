/**
 * 3마을 — 땅 아래 층 (W-0285, 테라리아·마인크래프트식 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 동굴은 보물상자 방 하나뿐이었다 → 그 방 깊은 칸의 **사다리**로 1~5층. 층마다 광석 둘(하루 한 번씩 캔다)·짐승 하나(사다리를 지킨다 — 쫓으면 내려갈 수 있다)·
 * 어둠(횃불 받침에서 소나무 1 로 2분 켜면 시야가 넓다) · 5층엔 옛 유물 하나(화석 — 사고에 기증할 수 있다, 한 번뿐).
 * 동굴 안은 집 안과 같은 평평한 2D 실내(구면 투영 없음, 3D 도 안 뜬다 — village-view3d 가 indoors/caveInside 면 숨긴다).
 *
 *   세이브 save.village.cave = { deepest, torchUntil, relic, dug: { day, got: {} } } — 옛 세이브엔 없다(빈 것). 지금 층·쫓은 짐승은 판 안 상태.
 *   잇기(village.js 2260 상한 — 줄 끝): nearest 의 caveChests 줄(층>0 이면 이 파일) · interact 의 chest 줄(type 'cd') · leaveCave 머리(층>0 이면 up) · enterCave 의 caveIn=true(reset)
 *   그림: village-view drawCaveScene — 층>0 이면 order()·darkness(). 자리는 방 좌표(TILE 40, 방 8×9).
 */
(function (global) {
  'use strict';

  var FLOORS = 5, TORCH_MS = 120000, SIGHT_LIT = 260, SIGHT_DARK = 70;
  var ORES = { 1: ['iron', 'shard'], 2: ['copper', 'iron'], 3: ['silver', 'copper'], 4: ['oldcoin', 'silver'], 5: ['fern', 'fishf'] };
  var BEASTS = { 1: { name: '동굴 박쥐', emoji: '🦇' }, 2: { name: '굴 들쥐', emoji: '🐀' }, 3: { name: '어둠 거미', emoji: '🕷️' }, 4: { name: '돌 구렁이', emoji: '🐍' }, 5: { name: '잠든 곰', emoji: '🐻' } };
  var RELIC = { key: 'fishf', name: '땅속 옛 유물(물고기 화석)', emoji: '🏺' };

  var fl = 0, shooed = {};
  function core() { return global.DG.core; }
  function V() { return global.DG.village; }
  function VD() { return global.DG.villageData; }
  function T() { return V().TILE; }
  function st() {
    var s = V().state();
    if (!s.cave || typeof s.cave !== 'object') { s.cave = { deepest: 0, torchUntil: 0, relic: false, dug: { day: -1, got: {} } }; }
    if (!s.cave.dug) { s.cave.dug = { day: -1, got: {} }; }
    return s.cave;
  }
  function floor() { return fl; }
  function reset() { fl = 0; shooed = {}; }
  function deepest() { return st().deepest || 0; }
  function lit() { return st().torchUntil > Date.now(); }
  function torchLeft() { return Math.max(0, Math.ceil((st().torchUntil - Date.now()) / 1000)); }
  function sight() { return lit() ? SIGHT_LIT : SIGHT_DARK; }
  function oresOf(f) { return ORES[f] || ORES[FLOORS]; }
  function beastOf(f) { return BEASTS[f] || BEASTS[FLOORS]; }
  function dug() {
    var d = st().dug, day = V().state().day;
    if (d.day !== day) { d.day = day; d.got = {}; }
    return d.got;
  }

  /** 층 f 의 사물(방 좌표) */
  function objects(f) {
    var t = T(), o = oresOf(f), b = beastOf(f), out = [];
    out.push({ t: 'torch', id: 'torch', x: t * 1.5, y: t * 1.8, emoji: '🔥', name: '횃불 받침' });
    out.push({ t: 'ore', id: 'ore0', key: o[0], x: t * 2.5, y: t * 3.5 });
    out.push({ t: 'ore', id: 'ore1', key: o[1], x: t * 6.5, y: t * 3.5 });
    out.push({ t: 'beast', id: 'beast', x: t * 4.5, y: t * 6.2, emoji: b.emoji, name: b.name });
    if (f < FLOORS) { out.push({ t: 'ladder', id: 'ladder', x: t * 4.5, y: t * 8.1, emoji: '🪜', name: '아래로 내려가는 사다리' }); }
    else { out.push({ t: 'relic', id: 'relic', x: t * 4.5, y: t * 8.1, emoji: RELIC.emoji, name: RELIC.name }); }
    return out;
  }
  function labelOf(o) {
    var it = o.t === 'ore' ? VD().item(o.key) : null;
    if (o.t === 'ore') { return (it ? it.emoji + ' ' + it.name : o.key) + (dug()[fl + ':' + o.id] ? ' (오늘은 다 캤다)' : ' — 캔다'); }
    if (o.t === 'beast') { return o.emoji + ' ' + o.name + (shooed[fl] ? ' (달아났다)' : ' — 쫓는다'); }
    if (o.t === 'torch') { return '🔥 횃불 받침 — ' + (lit() ? torchLeft() + '초 남음' : '소나무 1 로 2분 밝힌다'); }
    if (o.t === 'ladder') { return '🪜 ' + (fl + 1) + '층으로 내려간다' + (shooed[fl] ? '' : ' (짐승이 지킨다)'); }
    if (o.t === 'relic') { return st().relic ? '🏺 유물 자리 (가져갔다)' : '🏺 옛 유물 — 가져간다'; }
    return o.name || o.t;
  }
  /** village.nearest 가 층>0 이면 여기로 — 문은 위로 올라가는 사다리 */
  function nearest(player, door, reach) {
    var objs = objects(fl), best = null, bd = reach, i, d;
    for (i = 0; i < objs.length; i++) {
      d = Math.hypot(objs[i].x - player.x, objs[i].y - player.y);
      if (d < bd) { bd = d; best = { type: 'cd', obj: objs[i], dist: d }; }
    }
    d = Math.hypot(door.x - player.x, door.y - player.y);
    if (d < bd) { best = { type: 'cavedoor', obj: door, dist: d }; }
    return best;
  }
  function act(o) {
    var s = st(), it, n;
    if (o.t === 'torch') {
      if (lit()) { return { kind: 'no', text: '🔥 아직 ' + torchLeft() + '초 탄다' }; }
      if (V().bagCount('pine') < 1) { return { kind: 'no', text: '🌲 소나무가 있어야 횃불을 만든다' }; }
      V().state().bag.pine -= 1;
      s.torchUntil = Date.now() + TORCH_MS;
      core().emit('changed'); core().persist();
      return { kind: 'cave', text: '🔥 횃불을 밝혔다 — 2분' };
    }
    if (o.t === 'ore') {
      if (dug()[fl + ':' + o.id]) { return { kind: 'no', text: '오늘은 다 캤다 — 내일 다시' }; }
      it = VD().item(o.key);
      n = lit() ? 2 : 1;
      dug()[fl + ':' + o.id] = true;
      V().bagAdd(it, n);
      core().gainFeat(1, '동굴 캐기');
      core().log('⛏️ ' + fl + '층에서 ' + it.emoji + ' ' + it.name + ' ×' + n + (lit() ? ' (횃불 덕에 둘)' : ''), 'good');
      core().emit('changed'); core().persist();
      return { kind: 'gather', text: it.emoji + ' ' + it.name + ' +' + n };
    }
    if (o.t === 'beast') {
      if (shooed[fl]) { return { kind: 'no', text: o.emoji + ' 이미 달아났다' }; }
      shooed[fl] = true;
      core().emit('changed');
      return { kind: 'cave', text: o.emoji + ' ' + o.name + '이(가) 어둠 속으로 달아났다 — 사다리가 열렸다' };
    }
    if (o.t === 'ladder') {
      if (!shooed[fl]) { return { kind: 'no', text: beastOf(fl).emoji + ' ' + beastOf(fl).name + '이(가) 사다리를 지킨다 — 먼저 쫓는다' }; }
      return down();
    }
    if (o.t === 'relic') {
      if (s.relic) { return { kind: 'no', text: '유물은 이미 가져갔다' }; }
      s.relic = true;
      V().bagAdd(VD().item(RELIC.key), 1);
      core().gainFeat(5, '옛 유물');
      core().log('🏺 5층 바닥에서 옛 유물(' + VD().item(RELIC.key).name + ')을 찾았다 — 사고에 기증할 수 있다', 'good');
      core().emit('changed'); core().persist();
      return { kind: 'treasure', text: '🏺 옛 유물 — ' + VD().item(RELIC.key).name };
    }
    return null;
  }
  function down() {
    if (fl >= FLOORS) { return { kind: 'no', text: '여기가 맨 아래다' }; }
    fl += 1;
    var s = st(), p = V().raw().player, d = V().caveDoor();
    if (fl > (s.deepest || 0)) { s.deepest = fl; }
    p.x = d.x; p.y = d.y + T() * 0.8;
    core().emit('village:cave', { inside: true, floor: fl });
    core().emit('changed'); core().persist();
    return { kind: 'cave', text: '🪜 지하 ' + fl + '층 — ' + (lit() ? '횃불이 밝다' : '어둡다, 횃불 받침을 찾자') };
  }
  function up() {
    if (fl <= 0) { return null; }
    fl -= 1;
    var p = V().raw().player, t = T();
    p.x = t * 4.5; p.y = (fl > 0 ? t * 8.1 : t * 7.6 + t * 0.5) - t * 0.8;
    core().emit('village:cave', { inside: true, floor: fl });
    core().emit('changed');
    return { kind: 'cave', text: fl > 0 ? '🪜 지하 ' + fl + '층으로 올라왔다' : '🪜 동굴 첫 방으로 올라왔다' };
  }

  /* ── 그림(village-view drawCaveScene) ── */
  function order(p) {
    var objs = objects(fl), out = [], i;
    for (i = 0; i < objs.length; i++) { out.push({ y: objs[i].y, t: 'cd', o: objs[i] }); }
    out.push({ y: p.y, t: 'me', o: p });
    out.sort(function (a, b) { return a.y - b.y; });
    return out;
  }
  function glyph(o) { var it = o.t === 'ore' ? VD().item(o.key) : null; return o.t === 'ore' ? (dug()[fl + ':' + o.id] ? '🪨' : (it ? it.emoji : '⛏️')) : (o.t === 'beast' && shooed[fl] ? '' : o.emoji); }
  function hud() { return '지하 ' + fl + '층 / ' + FLOORS + ' · ' + (lit() ? '🔥 ' + torchLeft() + '초' : '🌑 어둡다') + ' · 가장 깊이 ' + deepest() + '층'; }

  global.DG = global.DG || {};
  global.DG.caveDepth = {
    FLOORS: FLOORS, TORCH_MS: TORCH_MS, SIGHT_LIT: SIGHT_LIT, SIGHT_DARK: SIGHT_DARK, ORES: ORES, BEASTS: BEASTS, RELIC: RELIC,
    floor: floor, reset: reset, deepest: deepest, lit: lit, torchLeft: torchLeft, sight: sight, oresOf: oresOf, beastOf: beastOf,
    objects: objects, labelOf: labelOf, nearest: nearest, act: act, down: down, up: up, order: order, glyph: glyph, hud: hud,
    _go: function (f) { fl = f; }, _shoo: function (f) { shooed[f] = true; }
  };
})(window);
