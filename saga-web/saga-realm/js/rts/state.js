/**
 * RTS 판 상태·저장 (W-0029, P1) — 새 판·직렬화·복원. 저장 칸은 `core.save.rts` 하나뿐이다(턴제 `save.rtk` 와 안 섞인다).
 * 지형은 시드로 다시 만들므로 건물 목록과 숫자만 저장한다. 시간은 `tick`(10Hz) 단위, 하루 = 50틱.
 */
(function (global) {
  'use strict';

  var V = 1;
  function R() { return global.DG.rts; }

  /** 새 판 — seed 같으면 지도 같다 */
  function create(seed) {
    var s = { v: V, seed: seed >>> 0, tiles: R().grid.generate(seed), occ: new Int32Array(R().grid.W * R().grid.H),
      buildings: {}, nextId: 2, res: { food: 100, gold: 300 }, pop: 12, day: 1, tick: 0, speed: 1 };
    R().rules.placeCastle(s);
    R().rules.recompute(s);
    return s;
  }

  /** 저장 꼴 — 지형·점유 격자는 뺀다 */
  function serialize(s) {
    var list = [], id, b;
    for (id in s.buildings) { b = s.buildings[id]; if (b.t !== 'castle') { list.push({ id: b.id, t: b.t, x: b.x, y: b.y }); } }
    list.sort(function (a, c) { return a.id - c.id; });
    return { v: V, seed: s.seed, res: { food: s.res.food, gold: s.res.gold }, pop: s.pop, day: s.day, tick: s.tick, speed: s.speed, nextId: s.nextId, buildings: list };
  }

  /** 저장 꼴에서 판을 되살린다 — 모르는 건물은 건너뛴다(옛·깨진 저장에도 안 터진다) */
  function restore(o) {
    if (!o || o.v !== V || typeof o.seed !== 'number') { return null; }
    var s = create(o.seed), i, b, D = R().rules.DEFS;
    s.res = { food: +o.res.food || 0, gold: +o.res.gold || 0 };
    s.pop = o.pop | 0; s.day = o.day | 0 || 1; s.tick = o.tick | 0; s.speed = o.speed === 0 || o.speed === 2 || o.speed === 4 ? o.speed : 1;
    s.nextId = Math.max(2, o.nextId | 0);
    for (i = 0; i < (o.buildings || []).length; i++) {
      b = o.buildings[i];
      if (!D[b.t] || D[b.t].fixed) { continue; }
      var keep = s.res.gold; s.res.gold = 1e9;   // 복원은 비용을 안 낸다
      R().rules.place(s, b.t, b.x | 0, b.y | 0, b.id | 0 || undefined);
      s.res.gold = keep;
    }
    for (i in s.buildings) { s.nextId = Math.max(s.nextId, s.buildings[i].id + 1); }
    s.nextId = Math.max(s.nextId, o.nextId | 0);
    R().rules.recompute(s);
    return s;
  }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.state = { V: V, create: create, serialize: serialize, restore: restore };
})(typeof window !== 'undefined' ? window : this);
