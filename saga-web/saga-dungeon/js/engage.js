/**
 * 2나락 적 찍기 (W-0175) — 적을 짧게 누르면 그 적을 쫓아가 치고, 벽에 막혀 못 가면 목표를 버린다
 * ---------------------------------------------------------------
 * 수신함 10-11 "조작이 답답함" — 공격은 사거리(34) 안 가장 가까운 적에게만 저절로 나가서, 적을 눌러도 그 자리로
 * 걸어갈 뿐이었고(도착하면 섬), 벽에 걸리면 목표를 쥔 채 계속 밀었다. 던전·마을 판정(dungeon.js·town.js)은 상한을 넘은
 * 큰 파일이라 줄 수를 안 늘리려고 판단만 여기 두고, 그쪽은 한 줄씩만 부른다:
 *
 *   걷기      찍은 적이 있으면 걷기 목표를 매 틱 그 적 자리로(`goal`) — 사거리 안이면 목표 없음(선다)
 *   자동 공격 가장 가까운 적 대신 찍은 적(`pick`) — 죽거나 방을 나가면 풀린다
 *   벽        2초 동안 0.5 도 못 가면 걷기 목표·찍은 적을 버린다(`stuck`). 벽 미끄러지기는 boundPlayer 가 축마다 따로 본다
 *   표시      찍은 적 발밑 금빛 고리(`mark` — 2D 는 dungeon-view, 3D 는 dungeon3d 의 걷기 목표 고리를 그 적에게)
 *
 * 찍은 적은 플레이어 객체에 안 붙이고 WeakMap 에 둔다 — 마을 플레이어는 세이브에 실리는 객체라 적 객체를 매달면 안 된다.
 */
(function (global) {
  'use strict';

  var PICK_R = 28;                                   // 누른 자리에서 이 안(+적 반지름)이면 적을 찍은 것
  var STUCK_SEC = 2, STUCK_MOVE = 0.5;
  var tg = typeof WeakMap === 'function' ? new WeakMap() : null, stk = typeof WeakMap === 'function' ? new WeakMap() : null;

  function mode() { var T = global.DG.town; return (T && T.active && T.active()) ? T : global.DG.dungeon; }
  function raw() { var m = mode(); return m && m.raw ? m.raw() : null; }
  function reach() { var D = global.DG.dungeon, s = D && D.status ? D.status() : null; return s && s.reach ? s.reach : 34; }

  function targetOf(p) { return p && tg ? tg.get(p) || null : null; }
  function drop(p) { if (p && tg) { tg.delete(p); } }
  /** 살아 있고 지금 목록에 있으면 그 적, 아니면 풀고 null */
  function pick(p, enemies) {
    var e = targetOf(p);
    if (!e) { return null; }
    if (e.hp > 0 && enemies && enemies.indexOf(e) >= 0) { return e; }
    drop(p);
    return null;
  }
  /** 걷기 목표 — 찍은 적 자리, 사거리 안이면 null(선다). 찍은 적이 없어졌으면 풀고 null */
  function goal(p, enemies) {
    var e = pick(p, enemies);
    if (!e) { return null; }
    var d = Math.hypot(e.x - p.x, e.y - p.y) - (e.r || 0);
    return d <= reach() * 0.85 ? null : { x: e.x, y: e.y };
  }
  /** 누른 자리(방 좌표) 둘레 적 — 가장 가까운 산 적 또는 null */
  function foeAt(x, y, R) {
    var r = raw(), best = null, bd = 1e9, i;
    if (!r || !r.room || !r.room.enemies) { return null; }
    for (i = 0; i < r.room.enemies.length; i++) {
      var e = r.room.enemies[i];
      if (e.hp <= 0) { continue; }
      var d = Math.hypot(e.x - x, e.y - y) - (e.r || 0);
      if (d <= (R === undefined ? PICK_R : R) && d < bd) { bd = d; best = e; }
    }
    return best;
  }
  /** 적을 찍는다 — 그쪽으로 걷기 시작하고(moveTo 가 찍은 적을 풀므로 뒤에 쥔다), 사거리 안이면 그 적만 친다 */
  function engage(e) {
    var m = mode(), r = raw();
    if (!e || !r || !r.player || !tg) { return false; }
    m.moveTo(e.x, e.y);
    tg.set(r.player, e);
    if (stk) { stk.delete(r.player); }
    return true;
  }
  /** 지금 찍힌 적(표시용) — { x, y, r } 또는 null */
  function mark() {
    var r = raw(), e = r && r.player ? pick(r.player, r.room && r.room.enemies) : null;
    return e ? { x: e.x, y: e.y, r: e.r || 12 } : null;
  }
  /**
   * 벽에 막힘 — 걷기 목표가 있는 틱마다 부른다. 2초 창에서 0.5 도 못 갔으면 true(찍은 적도 푼다).
   * 0.3초 넘게 안 불렸으면(목표가 없던 사이) 창을 새로 연다
   */
  function stuck(p, x0, y0, dt) {
    if (!p || !stk) { return false; }
    var now = Date.now(), s = stk.get(p);
    if (!s || now - s.at > 300) { s = { x: x0, y: y0, t: 0, at: now }; stk.set(p, s); }
    s.at = now; s.t += dt || 0;
    if (s.t < STUCK_SEC) { return false; }
    var moved = Math.hypot(p.x - s.x, p.y - s.y);
    stk.delete(p);
    if (moved >= STUCK_MOVE) { return false; }
    drop(p);
    return true;
  }

  global.DG = global.DG || {};
  global.DG.engage = {
    PICK_R: PICK_R, STUCK_SEC: STUCK_SEC, STUCK_MOVE: STUCK_MOVE,
    targetOf: targetOf, drop: drop, pick: pick, goal: goal, foeAt: foeAt, engage: engage, mark: mark, stuck: stuck
  };
})(window);
