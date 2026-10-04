/**
 * RTS 전투·습격 (W-0033, P3b) — 사거리 교전·상성·망루 발사·성벽 방어·적 파도·거점 체력. 순수 함수, 난수 없음.
 *
 * 판 상태 `s` 에 더해지는 칸: s.cHp(거점 체력) · s.raid { n: 막은 파도 수, next: 다음 습격 틱 } · s.kills · s.over(거점 함락).
 * 유닛 임시 칸(저장 안 함): u.cd(공격 쿨다운 틱) · u.rp(길 다시 찾기까지 틱). team 0 = 내 쪽, 1 = 적.
 */
(function (global) {
  'use strict';

  var CASTLE_HP = 400, WALL_HP = 40, CD = 10, SIGHT = 8, TOWER_RANGE = 7, TOWER_DMG = 6, CASTLE_RANGE = 6, CASTLE_DMG = 5, BEAT = 1.5, BOUNTY = 8;
  var FIRST_RAID = 250, RAID_GAP = 200, TICKS_PER_DAY = 50, SKILL_R = 2.5, SKILL_CD = 150;
  function R() { return global.DG.rts; }

  /** 상성 배율 — 공격하는 쪽이 받는 쪽을 이기는 종류면 ×1.5 */
  function mult(att, def) { return R().units.UDEF[att].beats === def ? BEAT : 1; }

  function dist(u, v) { return Math.hypot(u.x - v.x, u.y - v.y); }

  /** 가장 가까운 상대 유닛(없으면 null) — 같은 거리면 id 가 작은 쪽 */
  function nearestFoe(s, u, maxD, fromX, fromY) {
    var best = null, bd = maxD + 1e-9, id, v, d, px = fromX === undefined ? u.x : fromX, py = fromY === undefined ? u.y : fromY, team = u.team === undefined ? 0 : u.team;
    for (id in s.units) {
      v = s.units[id];
      if (v.team === team) { continue; }
      d = Math.hypot(v.x - px, v.y - py);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  /** 유닛 하나를 죽인다 — 적이면 현상금 */
  function kill(s, v, killerTeam) {
    delete s.units[v.id];
    if (v.team === 1 && killerTeam === 0) { s.res.gold += BOUNTY; s.kills = (s.kills || 0) + 1; }
  }
  function hit(s, v, dmg, killerTeam) { v.hp -= dmg; if (v.hp <= 0) { kill(s, v, killerTeam); return true; } return false; }

  /** 건물 직사각형까지의 거리(안이면 0) */
  function rectDist(b, x, y) {
    var D = R().rules.DEFS[b.t], dx = Math.max(b.x - x, 0, x - (b.x + D.w)), dy = Math.max(b.y - y, 0, y - (b.y + D.h));
    return Math.hypot(dx, dy);
  }
  function castleDist(s, x, y) { return rectDist(s.buildings[1], x, y); }

  /** 적 기지를 무너뜨렸다 — 승리: 멈추고 남은 적을 지운다 */
  function win(s) {
    var id; s.won = true; s.speed = 0; s.raid.next = 1e12;
    for (id in s.units) { if (s.units[id].team === 1) { delete s.units[id]; } }
  }

  /** 내 유닛이 적 기지를 친다 — 사거리 안이면 치고, 시야 안에서 가만히 있다면 다가간다 */
  function baseAI(s, u, d) {
    var sb = s.buildings[-1];
    if (!sb || sb.hp <= 0) { return; }
    var bd = rectDist(sb, u.x, u.y);
    if (bd <= d.range + 0.3) {
      if (u.cd <= 0) { sb.hp -= d.atk; u.cd = CD; if (sb.hp <= 0) { sb.hp = 0; win(s); } }
      if (!u.path.length) { u.goal = null; }
    } else if (!u.path.length && bd <= SIGHT) {
      approach(s, u, sb.x + 1, sb.y + 1);
    }
  }

  /** 가장 가까운 성벽(없으면 null) */
  function nearestWall(s, x, y, maxD) {
    var best = null, bd = maxD, id, b, d;
    for (id in s.buildings) {
      b = s.buildings[id];
      if (b.t !== 'wall') { continue; }
      d = Math.hypot(b.x + 0.5 - x, b.y + 0.5 - y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  function hitWall(s, w, dmg) {
    if (w.hp === undefined) { w.hp = WALL_HP; }
    w.hp -= dmg;
    if (w.hp <= 0) { var d = R().rules.DEFS.wall; R().rules.remove(s, w.id); s.res.gold -= Math.floor(d.cost / 2); return true; }
    return false;
  }

  /** 길을 너무 자주 구하지 않는다 — 목표가 2칸 넘게 달라졌거나 길이 비었을 때, 10틱에 한 번만 */
  function approach(s, u, tx, ty) {
    if (u.rp > 0) { return; }
    var g = u.goal;
    if (!u.path.length || !g || Math.hypot(g.x - tx, g.y - ty) > 2) { R().units.moveTo(s, u, tx, ty); u.rp = 10; }
  }

  /** 내 유닛 — 사거리에 적이 있으면 쏘고, 가만히 있다면 시야 안의 적에게 다가간다. 이동 명령 중이면 걸으며 쏜다 */
  function playerAI(s, u, d) {
    var foe = nearestFoe(s, u, u.path.length ? d.range : SIGHT);
    if (!foe) { baseAI(s, u, d); return; }
    if (dist(u, foe) <= d.range) {
      if (u.cd <= 0) { hit(s, foe, d.atk * mult(u.t, foe.t), 0); u.cd = CD; }
      if (!u.path.length) { u.goal = null; }
    } else if (!u.path.length) {
      approach(s, u, Math.floor(foe.x), Math.floor(foe.y));
    }
  }

  /** 적 유닛 — 사거리의 내 유닛을 먼저, 거점에 닿으면 거점, 길이 막히면 성벽을 부순다. 아니면 거점으로 간다 */
  function raiderAI(s, u, d) {
    var foe = nearestFoe(s, u, d.range), c = s.buildings[1], cd = castleDist(s, u.x, u.y), w;
    if (foe) { if (u.cd <= 0) { hit(s, foe, d.atk * mult(u.t, foe.t), 1); u.cd = CD; } return; }
    if (cd <= d.range + 0.6) {
      if (u.cd <= 0) { s.cHp -= d.atk; u.cd = CD; if (s.cHp <= 0) { s.cHp = 0; s.over = true; s.speed = 0; } }
      return;
    }
    if (!u.path.length) {
      w = nearestWall(s, u.x, u.y, 1.9);
      if (w) { if (u.cd <= 0) { hitWall(s, w, d.atk); u.cd = CD; } return; }
      approach(s, u, c.x + 1, c.y + 1);
      return;
    }
    foe = nearestFoe(s, u, 3);   // 가던 길에 사거리 밖이어도 코앞에 내 유닛이 있으면 멈춰 맞선다
    if (foe && dist(u, foe) <= d.range + 1.5) { u.path = []; }
  }

  /** 망루·거점·적 기지가 사거리 안의 적을 쏜다(기지는 내 유닛을 쏜다) */
  function fortFire(s) {
    var id, b, foe, mine;
    for (id in s.buildings) {
      b = s.buildings[id];
      if (b.t !== 'tower' && b.t !== 'castle' && b.t !== 'stronghold') { continue; }
      if (b.cd > 0) { b.cd--; continue; }
      if (b.t === 'tower') { foe = nearestFoe(s, { team: 0 }, TOWER_RANGE, b.x + 0.5, b.y + 0.5); }
      else { foe = nearestFoe(s, { team: b.t === 'castle' ? 0 : 1 }, CASTLE_RANGE, b.x + 1.5, b.y + 1.5); }
      if (foe) { hit(s, foe, b.t === 'tower' ? TOWER_DMG : CASTLE_DMG, b.t === 'stronghold' ? 1 : 0); b.cd = CD; }
    }
  }

  /** 이 번째 파도의 편성 — (2 + n) × 난이도 배율 기, 보병·궁병·기병 차례로, 파도마다 체력 +10% */
  function waveOf(n, diff) {
    var list = [], total = Math.max(1, Math.round((2 + n) * R().rules.DIFF.wave[diff === 0 || diff === 2 ? diff : 1])), i, order = ['soldier', 'archer', 'cavalry'];
    for (i = 0; i < total; i++) { list.push(order[(i + n) % 3]); }
    return list;
  }

  /** 파도를 적 기지 앞에 낸다(기지가 없으면 더는 안 온다) */
  function spawnWave(s) {
    var U = R().units, n = s.raid.n, list = waveOf(n, s.diff), sb = s.buildings[-1], i, p, u;
    if (!sb || sb.hp <= 0) { s.raid.next = 1e12; return; }
    for (i = 0; i < list.length; i++) {
      p = U.nearestWalkable(s, sb.x + (i % 4), sb.y + 3 + Math.floor(i / 4)) || { x: sb.x + (i % 4), y: sb.y + 3 };
      u = U.spawn(s, list[i], 1, p.x + 0.5, p.y + 0.5);
      u.hp = Math.round(u.hp * (1 + 0.1 * n) * 10) / 10;
      U.moveTo(s, u, s.buildings[1].x + 1, s.buildings[1].y + 1);
    }
    s.raid.n++;
    s.raid.next = s.tick + RAID_GAP;
  }

  /** 한 틱 — 쿨다운, 교전, 망루·거점 발사, 습격 시각 */
  function tick(s) {
    if (s.over || s.won) { return; }
    var id, u, d, UD = R().units.UDEF;
    if (s.raid && s.tick >= s.raid.next) { spawnWave(s); }
    for (id in s.units) {
      u = s.units[id];
      if (!u) { continue; }
      d = R().units.statOf(u);
      if (u.skillCd > 0) { u.skillCd--; }
      if (u.cd > 0) { u.cd--; } else { u.cd = 0; }
      if (u.rp > 0) { u.rp--; } else { u.rp = 0; }
      if (u.team === 1) { raiderAI(s, u, d); } else { playerAI(s, u, d); }
      if (s.over || s.won) { return; }
    }
    fortFire(s);
    if (s.won) { return; }
  }

  /** 영웅의 일격 — 둘레 2.5칸 적(과 기지)에 공격×(1+지력/100)×2. 맞힌 게 있을 때만 쿨다운 15초. 맞힌 수를 돌려준다 */
  function cast(s, u) {
    if (!u || u.t !== 'hero' || u.skillCd > 0 || s.over || s.won) { return 0; }
    var st = R().units.statOf(u), dmg = Math.round(st.atk * (1 + (st.wis || 0) / 100) * 2 * 10) / 10, id, v, n = 0, sb = s.buildings[-1];
    for (id in s.units) { v = s.units[id]; if (v && v.team !== u.team && dist(u, v) <= SKILL_R) { hit(s, v, dmg, u.team); n++; } }
    if (sb && sb.hp > 0 && rectDist(sb, u.x, u.y) <= SKILL_R) { sb.hp -= dmg; n++; if (sb.hp <= 0) { sb.hp = 0; win(s); } }
    if (n) { u.skillCd = SKILL_CD; }
    return n;
  }

  /** 다음 습격까지 남은 날(올림), 습격이 없으면 -1 */
  function daysToRaid(s) { return s.raid && !s.won ? Math.max(0, Math.ceil((s.raid.next - s.tick) / TICKS_PER_DAY)) : -1; }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.combat = { CASTLE_HP: CASTLE_HP, WALL_HP: WALL_HP, CD: CD, SIGHT: SIGHT, TOWER_RANGE: TOWER_RANGE, FIRST_RAID: FIRST_RAID, RAID_GAP: RAID_GAP, BOUNTY: BOUNTY,
    mult: mult, nearestFoe: nearestFoe, waveOf: waveOf, spawnWave: spawnWave, castleDist: castleDist, rectDist: rectDist, win: win, cast: cast, SKILL_R: SKILL_R, SKILL_CD: SKILL_CD, hitWall: hitWall, tick: tick, daysToRaid: daysToRaid };
})(typeof window !== 'undefined' ? window : this);
