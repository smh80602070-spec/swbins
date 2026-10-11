/**
 * 2나락 길목 발견거리 (PLAN §60 후보 2 → W-0175) — 마을 사이 길 위에 고정 좌표로 심는 작은 볼거리
 * ---------------------------------------------------------------
 * 처음(2026-09-10)엔 길 하나에 한 곳(45%)·세 종류였다 — 6400 길(걸어서 약 40초)에 평균 0.75 개라 걸어도 볼 것이 없었다
 * (수신함 10-11 "할 게 없음"). W-0175 부터 **1600 마다 한 곳**(양끝 마을 TOWN_SAFE_R 1300 밖만 — 6400 길이면 2 곳)·여섯 종:
 *
 *   ⛩️ 길가 제단 · 🪦 옛 비석 · 🧎 지친 나그네    금 14·공적 1(예전 그대로)
 *   🌿 약초 덤불                                     회복단(소) 1 · 공적 1
 *   ⚔️ 길목 매복                                     밟으면 로머 한 무리(셋)가 덮친다 — 다 잡으면 📦 상자(금 40·공적 2)
 *   📦 묻힌 궤짝                                     금 30·공적 1
 *
 * 좌표는 `core.hash2`(순수 함수)로만 — 같은 세계 같은 자리, 다른 플레이어라도 같다. 마을(town.js)은 길 선분
 * (`town.roadSegments()`)만 주고, 얹기·보상·매복 추적은 여기서 한다(town.js 는 상한 넘은 파일이라 옮겨 왔다).
 *
 * 세이브 — `save.town.roadMarks[id] = 1`. id 는 `road:<길>:<n>`. 옛 `road:<길>`(길 하나에 한 곳이던 때) 밟은 기록은 n=0 으로 읽는다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  var STEP = 1600, SAFE_R = 1300, JIT = 300, ACTIVE_R = 500;
  var KINDS = [
    { key: 'roadAltar', name: '길가 제단', emoji: '⛩️', verb: '빌었다' },
    { key: 'roadTomb', name: '옛 비석', emoji: '🪦', verb: '읽었다' },
    { key: 'roadStranded', name: '지친 나그네', emoji: '🧎', verb: '도왔다' },
    { key: 'roadHerb', name: '약초 덤불', emoji: '🌿', verb: '캤다' },
    { key: 'roadAmbush', name: '길목 매복', emoji: '⚔️', verb: '덮쳐 왔다' },
    { key: 'roadCache', name: '묻힌 궤짝', emoji: '📦', verb: '파냈다' }
  ];
  var GOLD = 14, FEAT = 1, CACHE_GOLD = 30, BOX_GOLD = 40, BOX_FEAT = 2, AMBUSH_N = 3;

  /**
   * 순수 — 길 선분 목록 → 발견거리 목록. 길 i 의 k 번째 1600 구간 가운데(±300)에 하나, 양끝 1300 안이면 뺀다.
   * 종류는 (i, k) 해시. 진단이 같은 함수로 구간 덮임을 잰다
   */
  function build(segs) {
    var out = [], i, k, h = core().hash2;
    for (i = 0; i < segs.length; i++) {
      var s = segs[i], L = Math.hypot(s.bx - s.ax, s.bz - s.az), n = Math.floor(L / STEP), m = 0;
      for (k = 0; k < n; k++) {
        var at = STEP * (k + 0.5) + (h(i * 13 + k * 7 + 1, i * 17 + k * 5 + 9) - 0.5) * 2 * JIT;
        if (at < SAFE_R || L - at < SAFE_R) { continue; }
        var t = at / L, kind = KINDS[Math.floor(h(i * 19 + k * 3 + 2, i * 23 + k * 11 + 4) * KINDS.length) % KINDS.length];
        out.push({ id: 'road:' + i + ':' + m, seg: i, n: m, at: at, kind: kind, x: s.ax + (s.bx - s.ax) * t, y: s.az + (s.bz - s.az) * t });
        m++;
      }
    }
    return out;
  }
  /** 순수 — 길마다 1600 구간으로 나눠 가운데가 양끝 1300 밖인 구간 중 발견거리가 없는 몫 {cells, empty, rate} */
  function coverage(segs, marks) {
    var cells = 0, empty = 0, i, k, by = {};
    marks.forEach(function (m) { (by[m.seg] = by[m.seg] || []).push(m.at); });
    for (i = 0; i < segs.length; i++) {
      var s = segs[i], L = Math.hypot(s.bx - s.ax, s.bz - s.az), n = Math.ceil(L / STEP), list = by[i] || [];
      for (k = 0; k < n; k++) {
        var a = STEP * k, b = Math.min(L, a + STEP), mid = (a + b) / 2;
        if (mid < SAFE_R || L - mid < SAFE_R) { continue; }
        cells++;
        if (!list.some(function (x) { return x >= a && x < b; })) { empty++; }
      }
    }
    return { cells: cells, empty: empty, rate: cells ? empty / cells : 0 };
  }

  var MARKS = null;
  function all() {
    var T = global.DG.town;
    if (!MARKS && T && T.roadSegments) { MARKS = build(T.roadSegments()); }
    return MARKS || [];
  }
  function done() { var t = core().save.town; return (t && t.roadMarks) || {}; }
  function isDone(m, d) { return !!(d[m.id] || (m.n === 0 && d['road:' + m.seg])); }   // 옛 기록(길 하나에 한 곳)은 n=0

  /* ── 매복 — 밟으면 그 자리에 셋이 덮치고, 셋 다 **쓰러뜨려야** 상자(R-5 리뷰 10-11) ──
   * 진행은 세이브(`save.town.roadAmbush[key] = { x, y }`)에 둔다 — 마크는 밟는 순간 done 이라, 기억을 모듈에만 두면
   * 새로고침·방 다시 짓기에 상자를 영영 잃었다. 무리는 방(room.enemies)에 사는 객체라 방이 갈리면 사라진다 —
   * 그때는 잡은 것으로 치지 않고 다시 500 안에 들면 다시 세운다(예전엔 "목록에 없음"을 처치로 쳐 공짜 상자) */
  var ambush = {};   // key → [enemy…] — 지금 방에 세운 무리(세이브 아님)
  function pending() { var t = core().save.town; return (t && t.roadAmbush) || {}; }
  function spawnAmbush(key, a, ctx) {
    var D = global.DG.dungeon, list = [], k;
    if (!D || !D._spawnEnemy || !ctx || !ctx.room) { return list; }
    for (k = 0; k < AMBUSH_N; k++) {
      var e = D._spawnEnemy(ctx.floor || 0, false, { x: a.x + (k - 1) * 46, y: a.y + (k % 2 ? 30 : -24) });
      e.field = true; e.ambush = key;
      ctx.room.enemies.push(e); list.push(e);
    }
    return list;
  }
  function stepAmbush(ctx, player) {
    var P = pending(), key;
    for (key in P) {
      if (!Object.prototype.hasOwnProperty.call(P, key)) { continue; }
      var a = P[key], foes = ambush[key];
      var gone = !foes || !foes.length || !ctx || !ctx.room || foes.some(function (e) { return e.hp > 0 && ctx.room.enemies.indexOf(e) < 0; });
      if (gone) {                                                       // 아직 안 세웠거나 방이 갈려 사라졌다 — 곁에 오면 다시
        delete ambush[key];
        if (player && Math.hypot(player.x - a.x, player.y - a.y) < ACTIVE_R) { ambush[key] = spawnAmbush(key, a, ctx); }
        continue;
      }
      if (foes.some(function (e) { return e.hp > 0; })) { continue; }
      delete ambush[key];
      delete core().save.town.roadAmbush[key];
      core().save.player.gold += BOX_GOLD;
      core().gainFeat(BOX_FEAT, '길목 매복');
      core().log('📦 매복을 걷어 냈다 — 상자 · 금 +' + BOX_GOLD, 'good');
      core().emit('toast', '📦 매복을 걷어 냈다 · 🪙 +' + BOX_GOLD);
      core().emit('changed');
      core().persist();
    }
  }

  /** 1초마다(town 틱) — 둘레 500 안 아직 안 밟은 것을 room.marks 에 얹고, 매복을 굴린다 */
  function tick(room, player, ctx) {
    if (room && room.marks && player) {
      var d = done(), list = all(), i, j;
      for (i = 0; i < list.length; i++) {
        var rm = list[i];
        if (isDone(rm, d) || Math.hypot(player.x - rm.x, player.y - rm.y) >= ACTIVE_R) { continue; }
        var already = false;
        for (j = 0; j < room.marks.length; j++) { if (room.marks[j].key === rm.id) { already = true; break; } }
        if (already) { continue; }
        room.marks.push({ key: rm.id, roadMark: true, kindKey: rm.kind.key, name: rm.kind.name, emoji: rm.kind.emoji, verb: rm.kind.verb, x: rm.x, y: rm.y });
      }
    }
    stepAmbush(ctx, player);
  }

  /** 밟았다 — `js/ui.js` 가 town:mark(roadMark)에서 town.rewardRoadMark → 여기 */
  function reward(mark, room) {
    var C = core();
    if (!C.save.town) { C.save.town = {}; }
    if (!C.save.town.roadMarks) { C.save.town.roadMarks = {}; }
    if (C.save.town.roadMarks[mark.key]) { return null; }   // 이중 발동 방지
    C.save.town.roadMarks[mark.key] = 1;
    var i = room && room.marks ? room.marks.indexOf(mark) : -1;
    if (i >= 0) { room.marks.splice(i, 1); }
    var k = mark.kindKey, gold = 0, tail;
    if (k === 'roadHerb') {
      var P = global.DG.potion, got = P && P.add ? P.add('heal', 0) : null;
      tail = got && got.ok ? '🍶 회복단 +1' : '물약 띠가 가득';
      C.gainFeat(FEAT, mark.name);
    } else if (k === 'roadAmbush') {
      C.save.town.roadAmbush = C.save.town.roadAmbush || {};
      C.save.town.roadAmbush[mark.key] = { x: Math.round(mark.x), y: Math.round(mark.y) };   // 다음 틱에 곁에 세운다
      tail = '다 잡으면 상자';
    } else {
      gold = k === 'roadCache' ? CACHE_GOLD : GOLD;
      C.save.player.gold += gold;
      C.gainFeat(FEAT, mark.name);
      tail = '🪙 +' + gold;
    }
    C.log(mark.emoji + ' ' + mark.name + ' — ' + mark.verb + ' · ' + tail, k === 'roadAmbush' ? 'warn' : 'good');
    C.emit('toast', mark.emoji + ' ' + mark.name + ' — ' + mark.verb + ' · ' + tail);
    C.emit('changed');
    return { kind: k, gold: gold };
  }

  global.DG = global.DG || {};
  global.DG.roadMarks = {
    KINDS: KINDS, STEP: STEP, SAFE_R: SAFE_R, GOLD: GOLD, CACHE_GOLD: CACHE_GOLD, BOX_GOLD: BOX_GOLD,
    build: build, coverage: coverage, all: all, isDone: isDone, tick: tick, reward: reward,
    ambushes: function () { return pending(); }, _stepAmbush: stepAmbush,
    _reset: function () { MARKS = null; ambush = {}; }
  };
})(window);
