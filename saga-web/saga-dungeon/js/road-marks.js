/**
 * 2나락 길목 발견거리 (PLAN §60 후보 2 → W-0175) + 들판 유적(§60 후보 4)·지도 밝힘 문턱(§60 후보 3, 둘 다 R-4 로 town.js 에서 옮겨 옴) — 마을 사이 길 위·곁 볼거리와 탐험 보상
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

  /* ── 들판 유적(PLAN §60 후보 4, 2026-09-10 — R-4(10-11) 로 town.js 에서 옮김) ─────────────
   * 길목 발견거리와 달리 **길에서 벗어나야** 닿는다 — 디아4의 "릴리스 제단"처럼 정해진 자리 전부를 모으는 도감류 수집.
   * 같은 길 선분을 기준점으로 삼되(새 좌표계를 안 만든다), 선분의 수직 방향으로 180~400 떨어뜨려(길 대역 TOWN_ROAD_BAND=70 밖)
   * "길 옆 숲·바위 사이"에 둔다. 길 30% 에만(길목보다 드물게). 도감(js/ui.js DEX_COMPLETE) 'relics' 갈래 — 세이브 `save.dex.relics[id]`.
   * id `relic:<길>` 은 옛 그대로(옮기며 한 자도 안 바꿈 — 같은 해시·같은 자리) */
  var RELIC_KINDS = [
    { name: '옛 석표(石標)', emoji: '🗿' },
    { name: '이끼 낀 종', emoji: '🔔' },
    { name: '금 간 청동거울', emoji: '🪞' },
    { name: '녹슨 인장', emoji: '🔏' }
  ];
  var RELIC_GOLD = 20, RELIC_FEAT = 4;
  /** 순수 — 길 선분 → 유적 목록(예전 town.js buildFieldRelics 그대로) */
  function buildRelics(segs) {
    var out = [], i, s, t, dx, dz, len, bx, by, side, offR, kind, h = core().hash2;
    for (i = 0; i < segs.length; i++) {
      s = segs[i];
      if (h(i * 31 + 101, i * 37 + 103) >= 0.3) { continue; }
      t = 0.3 + h(i * 41 + 7, i * 43 + 11) * 0.4;
      dx = s.bx - s.ax; dz = s.bz - s.az;
      len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      bx = s.ax + (s.bx - s.ax) * t;
      by = s.az + (s.bz - s.az) * t;
      side = h(i * 53 + 13, i * 59 + 17) < 0.5 ? -1 : 1;
      offR = 180 + h(i * 61 + 19, i * 67 + 23) * 220;   // 180~400, 길 대역(70) 밖
      kind = RELIC_KINDS[Math.floor(h(i * 71 + 29, i * 73 + 31) * RELIC_KINDS.length)];
      out.push({ id: 'relic:' + i, kind: kind, x: bx + (-dz) * offR * side, y: by + dx * offR * side });
    }
    return out;
  }
  var RELICS = null;
  function relics() {
    var T = global.DG.town;
    if (!RELICS && T && T.roadSegments) { RELICS = buildRelics(T.roadSegments()); }
    return RELICS || [];
  }
  /* ── 지도 밝힘 문턱(PLAN §60 후보 3 나머지 절반 "포그오브워 비율 보상", 2026-09-10 — R-4(10-11) 로 town.js 에서 옮김) ──
     세계 전체 면적을 분모로 삼는 "%"는 못 쓴다 — WORLD_LIMIT(60000)
     기준 칸(CHUNK=200) 수가 9만 개에 육박해 분모 자체가 의미가 없고,
     들판 렌더 반경(fieldRadiusUnits)은 그래픽 등급에 따라 흔들려(2/4/6칸)
     "고정된 분모"가 못 된다. 대신 **밝힌 칸 누적 수의 문턱(milestone)**
     으로 간다 — "몇 %" 대신 "지도를 이만큼 밝혔다"는 감각은 같고, 구현은
     `core().save.town.seen`(이미 있음) 길이 하나만 보면 된다. */
  var EXPLORE_MILESTONES = [50, 150, 350, 700, 1200, 2000];
  var EXPLORE_GOLD = 25, EXPLORE_FEAT = 2;
  function exploreCheck() {
    if (!core().save.town || !core().save.town.seen || !core().save.player) { return; }
    var total = 0, k;
    for (k in core().save.town.seen) { if (Object.prototype.hasOwnProperty.call(core().save.town.seen, k)) { total++; } }
    var got = core().save.town.exploreMilestone || 0;
    while (got < EXPLORE_MILESTONES.length && total >= EXPLORE_MILESTONES[got]) {
      core().save.player.gold += EXPLORE_GOLD;
      core().gainFeat(EXPLORE_FEAT, '지도 ' + EXPLORE_MILESTONES[got] + '칸 밝힘');
      core().emit('toast', '🗺️ 지도를 ' + EXPLORE_MILESTONES[got] + '칸 밝혔다 · 🪙 +' + EXPLORE_GOLD);
      got++;
    }
    core().save.town.exploreMilestone = got;
  }

  /** 1초마다(town 틱) — 둘레 500 안 아직 못 찾은 유적을 room.marks 에 얹는다 */
  function tickRelics(room, player) {
    if (!room || !room.marks || !player) { return; }
    var dex = core().save.dex, found = (dex && dex.relics) || {}, list = relics(), i, j;
    for (i = 0; i < list.length; i++) {
      var fr = list[i];
      if (found[fr.id] || Math.hypot(player.x - fr.x, player.y - fr.y) >= ACTIVE_R) { continue; }
      var already = false;
      for (j = 0; j < room.marks.length; j++) { if (room.marks[j].key === fr.id) { already = true; break; } }
      if (!already) { room.marks.push({ key: fr.id, fieldRelic: true, name: fr.kind.name, emoji: fr.kind.emoji, x: fr.x, y: fr.y }); }
    }
  }
  /** 유적 하나를 밟았다 — 도감에 등록·보상·자리에서 치움. `js/ui.js` 가 town:mark(fieldRelic)에서 town.rewardFieldRelic → 여기 */
  function rewardRelic(mark, room) {
    var C = core();
    if (!C.save.dex.relics) { C.save.dex.relics = {}; }
    if (C.save.dex.relics[mark.key]) { return; }   // 이중 발동 방지
    C.save.dex.relics[mark.key] = true;
    var i = room && room.marks ? room.marks.indexOf(mark) : -1;
    if (i >= 0) { room.marks.splice(i, 1); }
    C.save.player.gold += RELIC_GOLD;
    C.gainFeat(RELIC_FEAT, mark.name);
    C.log(mark.emoji + ' ' + mark.name + ' 발견 · 금 +' + C.fmt(RELIC_GOLD), 'good');
    C.emit('toast', mark.emoji + ' 유적 발견 · ' + mark.name);
    C.emit('dex:new', { cat: 'relics', id: mark.key });
    C.emit('changed');
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
    EXPLORE_MILESTONES: EXPLORE_MILESTONES, exploreCheck: exploreCheck,
    RELIC_KINDS: RELIC_KINDS, RELIC_GOLD: RELIC_GOLD, buildRelics: buildRelics, relics: relics, tickRelics: tickRelics, rewardRelic: rewardRelic,
    _reset: function () { MARKS = null; RELICS = null; ambush = {}; }
  };
})(window);
