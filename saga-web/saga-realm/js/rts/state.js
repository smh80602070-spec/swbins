/**
 * RTS 판 상태·저장 (W-0029, P1) — 새 판·직렬화·복원. 저장 칸은 `core.save.rts` 하나뿐이다(턴제 `save.rtk` 와 안 섞인다).
 * 지형은 시드로 다시 만들므로 건물 목록과 숫자만 저장한다. 시간은 `tick`(10Hz) 단위, 하루 = 50틱.
 */
(function (global) {
  'use strict';

  var V = 1;
  function R() { return global.DG.rts; }

  /** 새 판 — seed 같으면 지도 같다 */
  function create(seed, diff) {
    var s = { v: V, seed: seed >>> 0, tiles: R().grid.generate(seed), occ: new Int32Array(R().grid.W * R().grid.H),
      buildings: {}, nextId: 2, res: { food: 100, gold: 300 }, pop: 12, day: 1, tick: 0, speed: 1, tax: 1, units: {}, queues: {}, nextUid: 1,
      cHp: 400, raid: { n: 0, next: 250 }, kills: 0, over: false, won: false,
      diff: diff === 0 || diff === 2 ? diff : 1, heroN: 0, fx: [] };
    R().rules.placeCastle(s);
    R().rules.placeStronghold(s);
    R().rules.recompute(s);
    return s;
  }

  /** 시험 프리셋(주소 `?qa=1`, 새 판만) — 자원을 넉넉히 주고 첫 습격을 60틱(1일 남짓) 뒤로 당겨, 건설·생산·전투·영웅을 바로 볼 수 있게 한다 */
  function qaPreset(s) { s.res.gold = 5000; s.res.food = 2000; s.raid.next = s.tick + 60; return s; }

  /** 저장 꼴 — 지형·점유 격자는 뺀다 */
  function serialize(s) {
    var list = [], id, b;
    for (id in s.buildings) { b = s.buildings[id]; if (b.t !== 'castle' && b.t !== 'stronghold') { list.push({ id: b.id, t: b.t, x: b.x, y: b.y }); } }
    list.sort(function (a, c) { return a.id - c.id; });
    return { v: V, seed: s.seed, res: { food: s.res.food, gold: s.res.gold }, pop: s.pop, day: s.day, tick: s.tick, speed: s.speed, tax: s.tax, nextId: s.nextId, buildings: list,
      units: serUnits(s), queues: serQueues(s), nextUid: s.nextUid,
      cHp: Math.round(s.cHp * 10) / 10, raid: { n: s.raid.n, next: s.raid.next }, kills: s.kills, over: !!s.over,
      won: !!s.won, shp: s.buildings[-1] ? Math.round(s.buildings[-1].hp) : 0, diff: s.diff, heroN: s.heroN | 0 };
  }

  function serUnits(s) { var out = [], id, u, o; for (id in s.units) { u = s.units[id]; o = { id: u.id, t: u.t, team: u.team, x: Math.round(u.x * 100) / 100, y: Math.round(u.y * 100) / 100, hp: Math.round(u.hp * 10) / 10 }; if (u.hid) { o.hid = u.hid; o.mhp = u.mhp; } out.push(o); } out.sort(function (a, b) { return a.id - b.id; }); return out; }
  function serQueues(s) { var out = [], id, i; for (id in s.queues) { for (i = 0; i < s.queues[id].length; i++) { out.push(s.queues[id][i].hid ? { b: +id, t: s.queues[id][i].t, left: s.queues[id][i].left, hid: s.queues[id][i].hid } : { b: +id, t: s.queues[id][i].t, left: s.queues[id][i].left }); } } return out; }

  /** 저장 꼴에서 판을 되살린다 — 모르는 건물은 건너뛴다(옛·깨진 저장에도 안 터진다) */
  function restore(o) {
    if (!o || o.v !== V || typeof o.seed !== 'number') { return null; }
    var s = create(o.seed, o.diff), i, b, D = R().rules.DEFS;
    s.res = { food: +o.res.food || 0, gold: +o.res.gold || 0 };
    s.pop = o.pop | 0; s.day = o.day | 0 || 1; s.tick = o.tick | 0; s.speed = o.speed === 0 || o.speed === 2 || o.speed === 4 ? o.speed : 1;
    s.tax = o.tax === 0 || o.tax === 2 ? o.tax : 1;
    s.cHp = o.cHp > 0 ? +o.cHp : (o.over ? 0 : 400); s.kills = o.kills | 0; s.over = !!o.over;   // 옛 저장(전투 전)은 거점 온전·첫 습격 250틱 뒤
    s.heroN = o.heroN | 0;
    s.won = !!o.won; if (s.buildings[-1]) { s.buildings[-1].hp = s.won ? 0 : (o.shp > 0 ? +o.shp : s.buildings[-1].hp); }   // 옛 저장은 기지 온전
    s.raid = o.raid && o.raid.next > 0 ? { n: o.raid.n | 0, next: o.raid.next | 0 } : { n: 0, next: s.tick + 250 };
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
    restoreUnits(s, o);
    R().rules.recompute(s);
    return s;
  }

  /** 유닛·큐 복원 — 모르는 종류·없는 군영은 건너뛴다 */
  function restoreUnits(s, o) {
    var UD = R().units ? R().units.UDEF : null, i, u, q;
    if (!UD) { return; }
    for (i = 0; i < (o.units || []).length; i++) {
      u = o.units[i];
      if (!UD[u.t] || !(u.id > 0)) { continue; }
      s.units[u.id | 0] = { id: u.id | 0, t: u.t, team: u.team | 0, x: +u.x || 0, y: +u.y || 0, hp: +u.hp > 0 ? +u.hp : UD[u.t].hp, path: [], goal: null };
      if (u.t === 'hero' && u.hid && R().heroes) { var hu = s.units[u.id | 0]; hu.hid = u.hid; hu.st = R().heroes.statsOf(u.hid); hu.mhp = +u.mhp > 0 ? +u.mhp : hu.st.hp; }
      s.nextUid = Math.max(s.nextUid, (u.id | 0) + 1);
    }
    for (i = 0; i < (o.queues || []).length; i++) {
      q = o.queues[i];
      if (!s.buildings[q.b] || !UD[q.t]) { continue; }
      (s.queues[q.b] = s.queues[q.b] || []).push(q.hid ? { t: q.t, left: Math.max(1, q.left | 0), hid: q.hid } : { t: q.t, left: Math.max(1, q.left | 0) });
    }
    s.nextUid = Math.max(s.nextUid, o.nextUid | 0);
  }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.state = { V: V, create: create, serialize: serialize, restore: restore, qaPreset: qaPreset };
})(typeof window !== 'undefined' ? window : this);
