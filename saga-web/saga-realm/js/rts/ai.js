/**
 * RTS 적 AI 세력 (W-0063) — 정해진 파도(디펜스)가 아니라, 적 기지가 자기 경제로 병력을 뽑고 모이면 출정하고 맞으면 물러나는 세력.
 * 순수 함수, 난수 없음(같은 판 = 같은 적). 유닛 하나하나의 움직임(집결·수비·공격 목표로 가기)은 combat.js `raiderAI` 가 이 모듈의 상태를 읽어 한다.
 *
 * 판 상태에 더해지는 칸: s.ai { gold, q:[{t,left}], mode:'muster'|'attack'|'retreat', group:[유닛 id], size:출정 때 병력, tgt:노리는 건물 id, made:뽑은 수, rt:후퇴 끝 틱 }
 *   경제  일 소득이 시간에 따라 오른다(난이도 배율). 병종은 내 병력의 가장 많은 쪽을 이기는 것으로 뽑는다. 생산 줄은 시간이 가며 1 → 3(350틱마다).
 *   집결  기지 앞(RALLY)에 모은다. 병력이 기준(2 + 출정 수) × 난이도에 차거나, 다음 출정 시각(s.raid.next)이 되면 출정.
 *   출정  병력이 적으면 내 바깥 건물(농지·주거·시장…) 중 가까운 것부터, 8기 이상이면 거점. 건물을 부수면 다음 건물로.
 *   후퇴  출정한 병력이 절반 밑으로 줄면 물러나 다시 모은다.
 *   수비  기지 둘레 11칸 안에 내 유닛이 보이면 집결 병력이 맞서 싸운다(combat.js).
 * `s.ai` 가 없는 상태(옛 시험 상태)는 combat.js 의 옛 파도 방식(spawnWave)으로 돈다.
 */
(function (global) {
  'use strict';

  var RALLY_DY = 4, GOLD_CAP = 600, BIG = 8, RAID_GAP = 200, FIRST = 250;
  var COUNTER = { cavalry: 'soldier', soldier: 'archer', archer: 'cavalry' };   // 내 가장 많은 병종 → 그걸 이기는 병종
  var ORDER = ['soldier', 'archer', 'cavalry'];
  var TARGETS = ['farm', 'house', 'market', 'workshop', 'barracks', 'well', 'tower'];
  function R() { return global.DG.rts; }

  function create() { return { gold: 0, q: [], mode: 'muster', group: [], size: 0, tgt: 0, made: 0, rt: 0 }; }
  function mult(s) { return R().rules.DIFF.wave[s.diff === 0 || s.diff === 2 ? s.diff : 1]; }
  function stHpMax(s) { return R().rules.DEFS.stronghold.hp * R().rules.DIFF.hp[s.diff === 0 || s.diff === 2 ? s.diff : 1]; }

  function army(s) { var out = [], id; for (id in s.units) { if (s.units[id].team === 1) { out.push(s.units[id]); } } return out; }
  function lines(s) { return Math.min(3, 1 + Math.floor(s.tick / 350)); }
  function cap(s) { return Math.min(40, Math.round((4 + s.tick / 150) * mult(s))); }
  function income(s, sb) { return (0.28 + 0.00065 * s.tick) * mult(s) * (sb.hp < stHpMax(s) ? 1.5 : 1); }   // 맞고 있으면 더 급히 뽑는다
  function rally(sb) { return { x: sb.x + 1.5, y: sb.y + RALLY_DY }; }

  /** 내 병력의 가장 많은 종류를 이기는 종류 — 내 병력이 없으면 차례로 */
  function pickType(s, a) {
    var cnt = { soldier: 0, archer: 0, cavalry: 0 }, id, u, best = null, bc = 0;
    for (id in s.units) { u = s.units[id]; if (u.team === 0 && cnt[u.t] !== undefined) { cnt[u.t]++; } }
    ORDER.forEach(function (t) { if (cnt[t] > bc) { bc = cnt[t]; best = t; } });
    return best ? COUNTER[best] : ORDER[a.made % 3];
  }

  function spawnAt(s, t) {
    var U = R().units, a = s.ai, sb = s.buildings[-1], k = a.made, p, u, wave = Math.max(0, Math.floor((s.tick - FIRST) / RAID_GAP)), r = rally(sb);
    p = U.nearestWalkable(s, sb.x + (k % 4), sb.y + 3 + Math.floor(k / 4) % 3) || { x: sb.x + (k % 4), y: sb.y + 3 };
    u = U.spawn(s, t, 1, p.x + 0.5, p.y + 0.5);
    u.hp = Math.round(u.hp * (1 + 0.1 * wave) * 10) / 10;
    a.made++;
    U.moveTo(s, u, Math.floor(r.x + (k % 3) - 1), Math.floor(r.y));
    return u;
  }

  /** 노릴 건물 — 병력이 적으면 가까운 바깥 건물, 크면(8기 이상)이나 마땅한 게 없으면 거점 */
  function pickTarget(s, g) {
    var cx = 0, cy = 0, id, b, d, bd = 1e9, best = 0, dd, D = R().rules.DEFS;
    g.forEach(function (u) { cx += u.x; cy += u.y; }); cx /= g.length; cy /= g.length;
    if (g.length >= BIG) { return 1; }
    for (id in s.buildings) {
      b = s.buildings[id]; if (TARGETS.indexOf(b.t) < 0) { continue; }
      d = D[b.t]; dd = Math.hypot(b.x + d.w / 2 - cx, b.y + d.h / 2 - cy);
      if (dd < bd) { bd = dd; best = b.id; }
    }
    return best || 1;
  }

  function sortie(s, list) {
    var a = s.ai;
    a.mode = 'attack'; a.group = list.map(function (u) { return u.id; }); a.size = list.length;
    s.raid.n++; s.raid.next = s.tick + RAID_GAP;
    a.tgt = pickTarget(s, list);
    (s.notes = s.notes || []).push('⚠ 적이 출정했다 — ' + list.length + '기');   // 화면이 한 줄 알림으로 띄운다(저장 안 함)
  }

  /** 한 틱 — 소득·생산·상태 전이. 기지가 없으면(무너졌으면) 아무것도 안 한다 */
  function tick(s) {
    var a = s.ai, sb = s.buildings[-1], U = R().units, d, i, alive, th, g;
    if (!a || !sb || sb.hp <= 0) { return; }
    a.gold = Math.min(GOLD_CAP, a.gold + income(s, sb));
    /* 생산 — 줄 수만큼 동시에 진행 */
    for (i = a.q.length - 1; i >= 0; i--) {
      if (i < lines(s)) { a.q[i].left--; if (a.q[i].left <= 0) { spawnAt(s, a.q[i].t); a.q.splice(i, 1); } }
    }
    alive = army(s);
    while (a.q.length < lines(s) && alive.length + a.q.length < cap(s)) {
      var t = pickType(s, a); d = U.UDEF[t];
      if (a.gold < d.gold) { break; }
      a.gold -= d.gold; a.q.push({ t: t, left: Math.round(d.train * 0.75) });
    }
    /* 상태 */
    if (a.mode === 'muster') {
      th = Math.max(2, Math.round((2 + s.raid.n) * mult(s)));
      if (alive.length >= th || (s.tick >= s.raid.next && alive.length >= 1)) { sortie(s, alive); }
    } else if (a.mode === 'attack') {
      g = a.group.map(function (id) { return s.units[id]; }).filter(function (u) { return !!u; });
      a.group = g.map(function (u) { return u.id; });
      if (!g.length) { a.mode = 'muster'; }
      else if (g.length * 2 < a.size) { a.mode = 'retreat'; a.rt = s.tick + 150; }
      else if (!s.buildings[a.tgt] || s.tick % 10 === 0) { a.tgt = pickTarget(s, g); }
    } else if (a.mode === 'retreat') {
      if (s.tick >= a.rt) { a.mode = 'muster'; a.group = []; s.raid.next = Math.max(s.raid.next, s.tick + RAID_GAP / 2); }
    }
  }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.ai = { create: create, tick: tick, rally: rally, pickType: pickType, lines: lines, cap: cap, income: income, BIG: BIG };
})(typeof window !== 'undefined' ? window : this);
