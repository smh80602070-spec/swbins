/**
 * 2나락 층 현상금 (W-0428 · 디아블로 3 모험 모드 현상금 — 구조만, 이름·수치는 우리 것)
 * ---------------------------------------------------------------
 * 같은 층도 다르게 돌게 — 층에 들면 그 층 씨앗으로 아래 여덟 중 셋(일일 의뢰 = 하루, 지도 장치 = 판 전체와 달리 **층** 단위):
 *   elite 정예·우두머리 하나 · kills 적 15 · nohit 맞지 않고 방 둘 비우기 · skill 무예 8번 · clears 방 셋 비우기
 *   rest 샘·제단 방 들르기 · trove 보물 방 들르기 · hard 정예 방·중간 우두머리 방 비우기
 * 하나마다 금 20×층(발밑에 떨굼), 셋 다 = 🎁 현상금 상자(전리품 둘 — 정예 굴림 bias 25). 다음 층이면 새로 뽑는다(저장 안 함 — 판 안).
 * 사건은 core 의 dungeon:kill·hurt·room·clear·skill 를 듣는다. dungeon update 첫 줄 끝에서 step(run, dt)(층 바뀜·작은 칸 갱신).
 * 작은 칸은 던전 화면 왼쪽(미니맵 밑) — 폰에서도 세 줄, 누름 통과. 손잡이 dungeon.bounty(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var TABLE = [
    { id: 'elite', name: '정예 하나 쓰러뜨리기', goal: 1 },
    { id: 'kills', name: '적 15 쓰러뜨리기', goal: 15 },
    { id: 'nohit', name: '맞지 않고 방 둘 비우기', goal: 2 },
    { id: 'skill', name: '무예 8번 쓰기', goal: 8 },
    { id: 'clears', name: '방 셋 비우기', goal: 3 },
    { id: 'rest', name: '샘·제단 방 들르기', goal: 1 },
    { id: 'trove', name: '보물 방 들르기', goal: 1 },
    { id: 'hard', name: '정예·우두머리 방 비우기', goal: 1 }
  ];
  var PICK = 3, GOLD_PER_FLOOR = 20, BOX_N = 2, BOX_BIAS = 25;
  var hooked = false, box = null;

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('dungeon.bounty', 1)); }
  function D() { return global.DG.dungeon; }
  function runOf() { var d = D(); return d && d.raw ? d.raw() : null; }
  function h01(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }
  /** 그 층의 셋(순수) — seed 는 판마다 다른 수(들어선 시각) */
  function pick(floor, seed) {
    var ids = TABLE.map(function (r) { return r.id; });
    ids.sort(function (a, b) { return h01('bn:' + seed + ':' + floor + ':' + a) - h01('bn:' + seed + ':' + floor + ':' + b); });
    return ids.slice(0, PICK);
  }
  function rowOf(id) { for (var i = 0; i < TABLE.length; i++) { if (TABLE[i].id === id) { return TABLE[i]; } } return null; }
  function fresh(run) {
    if (!run.bountySeed) { run.bountySeed = Date.now() % 100000; }
    run.bounty = { floor: run.floor, list: pick(run.floor, run.bountySeed).map(function (id) { return { id: id, n: 0, done: false }; }), all: false, hurt: false };
    return run.bounty;
  }
  function state(run) {
    if (!run || run.horde || run.trial || run.town) { return null; }
    if (!run.bounty || run.bounty.floor !== run.floor) { fresh(run); }
    return run.bounty;
  }
  function toast(m) { var C = core(); if (C && C.emit) { C.emit('toast', m); } }

  /** 과제 id 에 n 더하기 — 다 차면 덤 */
  function add(run, id, n) {
    var b = state(run); if (!b || !on()) { return false; }
    var got = false;
    b.list.forEach(function (q) {
      if (q.id !== id || q.done) { return; }
      var row = rowOf(id); q.n = Math.min(row.goal, q.n + (n || 1));
      if (q.n >= row.goal) {
        q.done = true; got = true;
        var g = GOLD_PER_FLOOR * Math.max(1, run.floor || 1), p = run.player || { x: 350, y: 220 };
        if (run.room && run.room.drops) { run.room.drops.push({ kind: 'gold', gold: g, x: p.x + 14, y: p.y + 6 }); }
        toast('📜 현상금 — ' + row.name + ' · 금 ' + g);
      }
    });
    if (got && !b.all && b.list.every(function (q) { return q.done; })) {
      b.all = true;
      var DR = D(), pp = run.player || { x: 350, y: 220 };
      for (var i = 0; i < BOX_N; i++) { if (DR && DR._dropItem && run.room) { DR._dropItem(run.room, pp.x, pp.y + 10, BOX_BIAS); } }
      toast('🎁 현상금 상자 — 이 층 현상금을 다 했다 · 전리품 ' + BOX_N);
    }
    return got;
  }

  function hook() {
    var C = core(); if (hooked || !C || !C.on) { return; } hooked = true;
    C.on('dungeon:kill', function (d) { var run = runOf(); if (!run || !d || !d.e) { return; } add(run, 'kills', 1); if (d.e.elite || d.e.boss) { add(run, 'elite', 1); } });
    C.on('dungeon:hurt', function () { var run = runOf(), b = state(run); if (b) { b.hurt = true; } });
    C.on('dungeon:room', function (room) { var run = runOf(), b = state(run); if (!b || !room) { return; } b.hurt = false; if (room.kind === 'well' || room.kind === 'shrine') { add(run, 'rest', 1); } if (room.kind === 'trove') { add(run, 'trove', 1); } });
    C.on('dungeon:clear', function (room) { var run = runOf(), b = state(run); if (!b || !room) { return; } add(run, 'clears', 1); if (!b.hurt) { add(run, 'nohit', 1); } if (room.kind === 'elite' || room.kind === 'miniboss') { add(run, 'hard', 1); } });
    C.on('dungeon:end', function () { if (box) { box.style.display = 'none'; } });
    C.on('dungeon:skill', function (k) { var run = runOf(); if (!run || /^(set|sig|ally):/.test(String(k))) { return; } add(run, 'skill', 1); });
  }
  hook();

  /** 작은 칸 — 던전 화면일 때만 */
  function paint(run) {
    var doc = global.document; if (!doc || !doc.body) { return; } if (box && !box.isConnected) { box = null; }
    var b = on() && run && D() && D().active && D().active() ? state(run) : null;
    if (!box) { box = doc.createElement('div'); box.id = 'dg-bounty'; box.style.cssText = 'position:fixed;left:12px;top:236px;z-index:30;pointer-events:none;font:600 11px/1.45 sans-serif;color:#e9dcc0;background:rgba(14,10,8,.55);border:1px solid rgba(200,160,90,.35);border-radius:8px;padding:5px 8px;max-width:190px;text-shadow:0 1px 2px #000;display:none'; (doc.getElementById('dungeon') || doc.body).appendChild(box); }   // 던전 화면 층 안(body 에 붙이면 #dungeon 층 밑에 깔린다)
    if (!b) { box.style.display = 'none'; return; }
    var html = '<div style="color:#f0c45a">📜 이 층 현상금' + (b.all ? ' ✔' : '') + '</div>';
    b.list.forEach(function (q) { var row = rowOf(q.id); html += '<div style="opacity:' + (q.done ? 0.55 : 1) + '">' + (q.done ? '✔ ' : '· ') + row.name + (row.goal > 1 && !q.done ? ' ' + q.n + '/' + row.goal : '') + '</div>'; });
    if (box.innerHTML !== html) { box.innerHTML = html; }
    box.style.display = 'block';
  }
  var acc = 0;
  function step(run, dt) { hook(); acc += dt || 0; if (acc < 0.25) { return; } acc = 0; if (run) { state(run); } paint(run); }

  global.DG = global.DG || {};
  global.DG.bounty = { TABLE: TABLE, PICK: PICK, GOLD_PER_FLOOR: GOLD_PER_FLOOR, BOX_N: BOX_N, pick: pick, state: state, add: add, step: step, paint: paint };
})(window);
