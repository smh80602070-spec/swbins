/**
 * 전장 턴 전투 (W-0080) — 조조전식. RTS 지도(지형·거점·적 기지)를 그대로 쓰고, 아군·적군이 차례로 움직인다. 순수 함수, 난수 없음.
 *
 *   차례  아군(side 0) → 적군(side 1, 늘 AI) → 턴 +1. 유닛 하나 = 한 턴에 이동 0~1번 + 행동 1번(공격·일격·대기)
 *   이동  이동력 = round(UDEF.speed×2) — 보병 4·궁병 4·기병 7·영웅 5~6. 4방향, 풀 1·숲 2·언덕 2, 물·건물 못 감,
 *         적 칸은 못 지나고 아군 칸은 지나되 멈추지 못한다
 *   공격  사거리(맨해튼) 근접 1 · 궁병 2~3(붙은 적 못 쏨). 피해 = round(공격×3×상성(1.5)×땅) — 맞는 쪽이 숲·언덕이면 ×0.85.
 *         맞은 쪽이 살아 있고 공격자가 제 사거리 안이면 반격 ½ 한 번. 적 기지·내 거점도 칸 거리로 친다
 *   일격  영웅만, 공격 대신. 공격×(1+지력/100)×2 를 둘레 맨해튼 2 의 적 전부(와 상대 거점)에. 맞힌 게 있으면 쿨다운 3턴
 *   승패  승 = 적 전멸 또는 적 기지 체력 0 · 패 = 아군 전멸 또는 거점(s.cHp) 0 또는 30턴 넘김
 *   AI    닿는 칸×대상 중 (준 피해 + 죽이면 50 − 받을 반격) 최대. 칠 게 없으면 가장 가까운 상대 유닛(없으면 거점)으로 길 위 가장 먼 칸
 *
 * 판 상태 `s` 는 rts/state.js 의 create 꼴 위에 s.tb = { turn, side, acted:{uid:1}, moved:{uid:1}, cd:{uid:n}, auto, why } 를 더한다.
 * 건설·경제·생산·실시간 틱은 쓰지 않는다(옛 RTS 는 rts.html?mode=rts).
 */
(function (global) {
  'use strict';

  var DMG_K = 3, LAND_DEF = 0.85, COUNTER = 0.5, KILL = 50, CAST_R = 2, CAST_CD = 3, MAX_TURN = 30, V = 1;
  var ALLY = { soldier: 3, archer: 2, cavalry: 1 }, ORDER = ['soldier', 'archer', 'cavalry'];
  function R() { return global.DG.rts; }
  function G() { return global.DG.rts.grid; }

  /* ── 칸·유닛 도우미 ─────────────────────────────────── */

  function tx(u) { return Math.floor(u.x); }
  function ty(u) { return Math.floor(u.y); }
  function unitAt(s, x, y) { var id, u; for (id in s.units) { u = s.units[id]; if (tx(u) === x && ty(u) === y) { return u; } } return null; }
  function ids(s, team) { var out = [], id; for (id in s.units) { if (team === undefined || s.units[id].team === team) { out.push(+id); } } return out.sort(function (a, b) { return a - b; }); }
  function stat(u) { return R().units.statOf(u); }
  function mv(u) { return Math.round(stat(u).speed * 2); }
  function rangeOf(u) { return u.t === 'archer' ? [2, 3] : [1, 1]; }
  function landCost(s, x, y) { var t = s.tiles[G().idx(x, y)], T = G().T; return t === T.FOREST || t === T.HILL ? 2 : 1; }
  function defLand(s, x, y) { var t = s.tiles[G().idx(x, y)], T = G().T; return t === T.FOREST || t === T.HILL; }
  function man(ax, ay, bx, by) { return Math.abs(ax - bx) + Math.abs(ay - by); }
  /** 칸 → 건물 사각형까지 맨해튼 거리 */
  function rectMan(b, x, y) {
    var D = R().rules.DEFS[b.t], dx = Math.max(b.x - x, 0, x - (b.x + D.w - 1)), dy = Math.max(b.y - y, 0, y - (b.y + D.h - 1));
    return dx + dy;
  }
  /** team 이 칠 수 있는 상대 거점 — 아군은 적 기지(-1), 적은 내 거점(1). 무너졌으면 null */
  function foeBase(s, team) {
    if (team === 0) { var sb = s.buildings[-1]; return sb && sb.hp > 0 ? sb : null; }
    return s.cHp > 0 && s.buildings[1] ? s.buildings[1] : null;
  }
  function hitBase(s, team, dmg) {
    if (team === 0) { var sb = s.buildings[-1]; sb.hp = Math.max(0, sb.hp - dmg); return sb.hp <= 0; }
    s.cHp = Math.max(0, s.cHp - dmg); return s.cHp <= 0;
  }
  /** (x,y) 둘레에서 비어 있고 밟을 수 있는 가장 가까운 칸 */
  function freeNear(s, x, y) {
    var U = R().units, r, dx, dy;
    if (U.walkable(s, x, y) && !unitAt(s, x, y)) { return { x: x, y: y }; }
    for (r = 1; r <= 10; r++) {
      for (dy = -r; dy <= r; dy++) { for (dx = -r; dx <= r; dx++) { if (Math.abs(dx) + Math.abs(dy) === r && U.walkable(s, x + dx, y + dy) && !unitAt(s, x + dx, y + dy)) { return { x: x + dx, y: y + dy }; } } }
    }
    return null;
  }

  /* ── 시작 ─────────────────────────────────────────── */

  /** 한 편을 세운다 — 앞줄(상대 쪽)부터 열마다 세 칸(가운데·위·아래) */
  function deploy(s, team, frontX, face, list) {
    var cy = Math.floor(G().H / 2), rows = [0, -1, 1], i, col, p, u;
    for (i = 0; i < list.length; i++) {
      col = Math.floor(i / 3);
      p = freeNear(s, frontX - face * col, cy + rows[i % 3]);
      if (!p) { continue; }
      u = R().units.spawn(s, list[i].t, team, p.x + 0.5, p.y + 0.5, list[i].hid);
      u.face = face;
    }
  }

  /** 새 전투 — 같은 시드·난이도면 같은 판 */
  function start(seed, diff) {
    var s = R().state.create(seed, diff), c = G().castleSite(), e = G().enemySite(s.seed), cx = c.x + 1, ex = e.x + 1, face = ex > cx ? 1 : -1;
    var roster = R().heroes ? R().heroes.roster() : [], m = R().rules.DIFF.wave[s.diff], i, mine = [], foe = [];
    s.tb = { turn: 1, side: 0, acted: {}, moved: {}, cd: {}, auto: false, why: '' };
    s.ai = null; s.raid.next = 1e12; s.speed = 0;
    /* 아군: 앞줄 보병 셋 → 영웅 셋 → 궁병·기병 */
    ORDER.forEach(function (t) { if (t === 'soldier') { for (i = 0; i < ALLY[t]; i++) { mine.push({ t: t }); } } });
    for (i = 0; i < 3; i++) { mine.push({ t: 'hero', hid: roster[i] ? roster[i].id : null }); }
    for (i = 0; i < ALLY.archer; i++) { mine.push({ t: 'archer' }); }
    for (i = 0; i < ALLY.cavalry; i++) { mine.push({ t: 'cavalry' }); }
    /* 적군: 같은 꼴 병사 × 난이도 배율 + 적장 하나(도감 끝) */
    ORDER.forEach(function (t) { var n = Math.max(1, Math.round(ALLY[t] * m)); for (i = 0; i < n; i++) { if (t === 'soldier') { foe.push({ t: t }); } } });
    foe.push({ t: 'hero', hid: roster.length > 3 ? roster[roster.length - 1].id : null });
    ORDER.forEach(function (t) { var n = Math.max(1, Math.round(ALLY[t] * m)); for (i = 0; i < n; i++) { if (t !== 'soldier') { foe.push({ t: t }); } } });
    deploy(s, 0, cx + face * 6, face, mine);
    var mid = Math.round((cx + ex) / 2);
    deploy(s, 1, mid + face * 4, -face, foe);
    return s;
  }

  /* ── 이동·사거리 ──────────────────────────────────── */

  var D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /** 닿는 칸 — [{x,y,c}] (제자리 포함, c = 든 이동력). 이미 움직였거나 행동했으면 제자리만 */
  function reach(s, u) {
    var x0 = tx(u), y0 = ty(u), out = [{ x: x0, y: y0, c: 0 }];
    if (!s.tb || (s.tb.moved[u.id] || s.tb.acted[u.id])) { return out; }
    var max = mv(u), best = {}, q = [{ x: x0, y: y0, c: 0 }], W = G().W, occ = {}, id, v, cur, i, nx, ny, nc, k, seen = {};
    for (id in s.units) { v = s.units[id]; if (v !== u) { occ[ty(v) * W + tx(v)] = v.team === u.team ? 1 : 2; } }
    best[y0 * W + x0] = 0;
    while (q.length) {
      q.sort(function (a, b) { return a.c - b.c || (a.y * W + a.x) - (b.y * W + b.x); });
      cur = q.shift();
      if (cur.c > best[cur.y * W + cur.x]) { continue; }
      for (i = 0; i < 4; i++) {
        nx = cur.x + D4[i][0]; ny = cur.y + D4[i][1]; k = ny * W + nx;
        if (!R().units.walkable(s, nx, ny) || occ[k] === 2) { continue; }
        nc = cur.c + landCost(s, nx, ny);
        if (nc > max || (best[k] !== undefined && best[k] <= nc)) { continue; }
        best[k] = nc; q.push({ x: nx, y: ny, c: nc });
      }
    }
    for (k in best) {
      k = +k;
      if (k === y0 * W + x0 || occ[k] || seen[k]) { continue; }
      seen[k] = 1; out.push({ x: k % W, y: Math.floor(k / W), c: best[k] });
    }
    out.sort(function (a, b) { return a.c - b.c || (a.y * W + a.x) - (b.y * W + b.x); });
    return out;
  }

  /** (x,y) 에 선 u 가 칠 수 있는 것 — [{kind:'unit', id} | {kind:'base'}]. x,y 를 안 주면 지금 자리 */
  function targets(s, u, x, y) {
    if (x === undefined) { x = tx(u); y = ty(u); }
    var r = rangeOf(u), out = [], id, v, d, b = foeBase(s, u.team);
    for (id in s.units) { v = s.units[id]; if (v.team === u.team) { continue; } d = man(x, y, tx(v), ty(v)); if (d >= r[0] && d <= r[1]) { out.push({ kind: 'unit', id: v.id }); } }
    out.sort(function (a, c) { return a.id - c.id; });
    if (b) { d = rectMan(b, x, y); if (d >= r[0] && d <= r[1]) { out.push({ kind: 'base' }); } }
    return out;
  }

  /** a 가 v(유닛) 를 칠 때 피해 — v 가 null 이면 거점 */
  function damage(s, a, v) {
    var k = R().combat.mult, base = stat(a).atk * DMG_K;
    if (!v) { return Math.round(base); }
    return Math.round(base * (a.t === 'hero' || v.t === 'hero' ? 1 : k(a.t, v.t)) * (defLand(s, tx(v), ty(v)) ? LAND_DEF : 1));
  }
  function castDmg(u) { var st = stat(u); return Math.round(st.atk * (1 + (st.wis || 0) / 100) * 2); }

  /* ── 행동 ─────────────────────────────────────────── */

  function canAct(s, u) { return !!(u && s.tb && !s.over && !s.won && s.tb.side === u.team && !s.tb.acted[u.id]); }

  function check(s) {
    if (s.won || s.over) { return; }
    var sb = s.buildings[-1];
    if (!ids(s, 1).length || (sb && sb.hp <= 0)) { s.won = true; s.tb.why = !ids(s, 1).length ? '적 전멸' : '적 기지 함락'; return; }
    if (!ids(s, 0).length || s.cHp <= 0) { s.over = true; s.tb.why = !ids(s, 0).length ? '아군 전멸' : '거점 함락'; }
  }
  function kill(s, v) { delete s.units[v.id]; delete s.tb.acted[v.id]; delete s.tb.moved[v.id]; delete s.tb.cd[v.id]; }

  /** 닿는 칸으로 옮긴다 — { ok, why } */
  function move(s, u, x, y) {
    if (!canAct(s, u)) { return { ok: false, why: '지금 움직일 수 없다' }; }
    if (s.tb.moved[u.id]) { return { ok: false, why: '이미 움직였다' }; }
    var ok = reach(s, u).some(function (p) { return p.x === x && p.y === y; });
    if (!ok) { return { ok: false, why: '닿지 않는 칸' }; }
    if (x !== tx(u)) { u.face = x > tx(u) ? 1 : -1; }
    u.x = x + 0.5; u.y = y + 0.5; s.tb.moved[u.id] = 1;
    return { ok: true, why: '' };
  }

  /** 친다 — target 은 targets() 의 한 칸. { ok, dmg, counter, killed, why } */
  function attack(s, u, target) {
    if (!canAct(s, u)) { return { ok: false, why: '지금 칠 수 없다' }; }
    var list = targets(s, u), hit = list.some(function (t) { return t.kind === target.kind && (t.kind === 'base' || t.id === target.id); });
    if (!hit) { return { ok: false, why: '사거리 밖' }; }
    var res = { ok: true, dmg: 0, counter: 0, killed: false, why: '' }, v;
    s.tb.acted[u.id] = 1;
    if (target.kind === 'base') { res.dmg = damage(s, u, null); res.killed = hitBase(s, u.team, res.dmg); check(s); return res; }
    v = s.units[target.id]; res.dmg = damage(s, u, v); v.hp -= res.dmg;
    if (tx(v) !== tx(u)) { u.face = tx(v) > tx(u) ? 1 : -1; }
    if (v.hp <= 0) { res.killed = true; kill(s, v); if (u.team === 0) { s.kills = (s.kills | 0) + 1; } }
    else {
      var r = rangeOf(v), d = man(tx(v), ty(v), tx(u), ty(u));
      if (d >= r[0] && d <= r[1]) { res.counter = Math.round(damage(s, v, u) * COUNTER); u.hp -= res.counter; if (u.hp <= 0) { kill(s, u); } }
    }
    check(s);
    return res;
  }

  /** 일격 둘레의 적·거점 */
  function castHits(s, u, x, y) {
    var out = [], id, v, b = foeBase(s, u.team);
    for (id in s.units) { v = s.units[id]; if (v.team !== u.team && man(x, y, tx(v), ty(v)) <= CAST_R) { out.push(v.id); } }
    out.sort(function (a, c) { return a - c; });
    if (b && rectMan(b, x, y) <= CAST_R) { out.push('base'); }
    return out;
  }

  /** 영웅 일격 — { ok, n, dmg, why }. 맞힌 게 없으면 거부(쿨다운 안 씀) */
  function cast(s, u) {
    if (!canAct(s, u)) { return { ok: false, why: '지금 쓸 수 없다' }; }
    if (u.t !== 'hero') { return { ok: false, why: '영웅만' }; }
    if (s.tb.cd[u.id] > 0) { return { ok: false, why: s.tb.cd[u.id] + '턴 뒤' }; }
    var hits = castHits(s, u, tx(u), ty(u)), dmg = castDmg(u), i, v;
    if (!hits.length) { return { ok: false, why: '둘레에 적이 없다' }; }
    for (i = 0; i < hits.length; i++) {
      if (hits[i] === 'base') { hitBase(s, u.team, dmg); continue; }
      v = s.units[hits[i]]; v.hp -= dmg; if (v.hp <= 0) { kill(s, v); if (u.team === 0) { s.kills = (s.kills | 0) + 1; } }
    }
    s.tb.acted[u.id] = 1; s.tb.cd[u.id] = CAST_CD;
    check(s);
    return { ok: true, n: hits.length, dmg: dmg, why: '' };
  }

  function wait(s, u) { if (!canAct(s, u)) { return { ok: false, why: '지금 쉴 수 없다' }; } s.tb.acted[u.id] = 1; return { ok: true, why: '' }; }

  /* ── AI ───────────────────────────────────────────── */

  /** 유닛 하나의 수 — { x, y, act:'attack'|'cast'|'wait', target } */
  function plan(s, u) {
    var W = G().W, rch = reach(s, u), best = null, i, j, p, list, t, v, dmg, sc, back, kills, hits;
    function better(c) {
      if (!best) { return true; }
      if (c.sc !== best.sc) { return c.sc > best.sc; }
      if (c.land !== best.land) { return c.land; }
      if (c.tid !== best.tid) { return c.tid < best.tid; }
      if (c.c !== best.c) { return c.c < best.c; }
      return c.y * W + c.x < best.y * W + best.x;
    }
    for (i = 0; i < rch.length; i++) {
      p = rch[i]; list = targets(s, u, p.x, p.y);
      for (j = 0; j < list.length; j++) {
        t = list[j];
        if (t.kind === 'base') { dmg = damage(s, u, null); sc = dmg + (dmg >= (u.team === 0 ? s.buildings[-1].hp : s.cHp) ? KILL * 10 : 0); }
        else {
          v = s.units[t.id]; dmg = damage(s, u, v); back = 0;
          if (dmg < v.hp) { var r = rangeOf(v), d = man(tx(v), ty(v), p.x, p.y); if (d >= r[0] && d <= r[1]) { back = Math.round(damage(s, v, u) * COUNTER); } }
          sc = Math.min(dmg, v.hp) + (dmg >= v.hp ? KILL : 0) - back;
        }
        var c = { x: p.x, y: p.y, c: p.c, act: 'attack', target: t, sc: sc, land: defLand(s, p.x, p.y), tid: t.kind === 'base' ? 1e9 : t.id };
        if (better(c)) { best = c; }
      }
      if (u.t === 'hero' && !(s.tb.cd[u.id] > 0)) {
        hits = castHits(s, u, p.x, p.y); dmg = castDmg(u); sc = 0; kills = 0;
        for (j = 0; j < hits.length; j++) { if (hits[j] === 'base') { sc += dmg; } else { v = s.units[hits[j]]; sc += Math.min(dmg, v.hp); if (dmg >= v.hp) { kills++; } } }
        sc += kills * KILL;
        var cc = { x: p.x, y: p.y, c: p.c, act: 'cast', target: null, sc: sc, land: defLand(s, p.x, p.y), tid: -1 };
        if (hits.length > 1 && better(cc)) { best = cc; }   // 하나만 맞히면 평타가 낫다(쿨다운 아낌)
      }
    }
    if (best && best.sc > 0) { return { x: best.x, y: best.y, act: best.act, target: best.target }; }
    var go = approach(s, u, rch);
    return { x: go.x, y: go.y, act: 'wait', target: null };
  }

  /** 칠 게 없을 때 — 가장 가까운 상대 유닛(없으면 상대 거점)으로 가는 길 위, 닿는 칸 중 가장 먼 곳 */
  function approach(s, u, rch) {
    var x0 = tx(u), y0 = ty(u), goal = null, bd = 1e9, id, v, d, b, W = G().W, ok = {}, i, path, k;
    for (id in s.units) { v = s.units[id]; if (v.team === u.team) { continue; } d = man(x0, y0, tx(v), ty(v)); if (d < bd) { bd = d; goal = { x: tx(v), y: ty(v) }; } }
    if (!goal) { b = foeBase(s, u.team); if (!b) { return rch[0]; } goal = { x: b.x + 1, y: b.y + 1 }; }
    for (i = 0; i < rch.length; i++) { ok[rch[i].y * W + rch[i].x] = rch[i]; }
    path = R().units.findPath(s, x0, y0, goal.x, goal.y);
    for (i = path.length - 1; i >= 0; i--) { k = Math.floor(path[i].y) * W + Math.floor(path[i].x); if (ok[k]) { return ok[k]; } }
    var pick = rch[0], pd = man(x0, y0, goal.x, goal.y);
    for (i = 1; i < rch.length; i++) { d = man(rch[i].x, rch[i].y, goal.x, goal.y); if (d < pd) { pd = d; pick = rch[i]; } }
    return pick;
  }

  /** 수 하나를 둔다 — 기록 한 줄 { id, from, to, act, target, dmg, counter, killed, n } */
  function apply(s, u, p) {
    var rec = { id: u.id, team: u.team, from: { x: tx(u), y: ty(u) }, to: { x: p.x, y: p.y }, act: p.act, target: p.target, dmg: 0, counter: 0, killed: false, n: 0 }, r;
    if (p.x !== tx(u) || p.y !== ty(u)) { if (!move(s, u, p.x, p.y).ok) { rec.to = rec.from; } }
    if (p.act === 'attack') { r = attack(s, u, p.target); if (r.ok) { rec.dmg = r.dmg; rec.counter = r.counter; rec.killed = r.killed; } else { wait(s, u); rec.act = 'wait'; } }
    else if (p.act === 'cast') { r = cast(s, u); if (r.ok) { rec.dmg = r.dmg; rec.n = r.n; } else { wait(s, u); rec.act = 'wait'; } }
    else { wait(s, u); }
    return rec;
  }

  /** 한 편 전부를 AI 로 — id 순. 기록 줄 배열을 돌려준다(화면이 이걸 따라 그린다) */
  function autoTurn(s, team) {
    var log = [], list = ids(s, team), i, u;
    if (!s.tb || s.tb.side !== team) { return log; }
    for (i = 0; i < list.length; i++) {
      if (s.over || s.won) { break; }
      u = s.units[list[i]];
      if (!u || s.tb.acted[u.id]) { continue; }
      log.push(apply(s, u, plan(s, u)));
    }
    return log;
  }

  /** 아군 차례 끝 → 적 차례(AI) → 다음 턴. 적 차례 기록을 돌려준다 */
  function endTurn(s) {
    if (!s.tb || s.over || s.won || s.tb.side !== 0) { return []; }
    s.tb.side = 1; s.tb.acted = {}; s.tb.moved = {};
    var log = autoTurn(s, 1), id;
    if (s.over || s.won) { return log; }
    s.tb.turn++;
    for (id in s.tb.cd) { if (s.tb.cd[id] > 0) { s.tb.cd[id]--; } }
    s.tb.side = 0; s.tb.acted = {}; s.tb.moved = {};
    if (s.tb.turn > MAX_TURN) { s.over = true; s.tb.why = MAX_TURN + '턴 안에 결판을 못 냄'; }
    return log;
  }

  /** 아군 남은 행동 수 */
  function left(s) { var n = 0; ids(s, 0).forEach(function (id) { if (!s.tb.acted[id]) { n++; } }); return n; }

  /* ── 저장 ─────────────────────────────────────────── */

  function num(a, b) { return a - b; }
  function serialize(s) {
    var tb = s.tb, sb = s.buildings[-1];
    return { v: V, seed: s.seed, diff: s.diff, tb: { turn: tb.turn, side: tb.side, acted: Object.keys(tb.acted).map(Number).sort(num), moved: Object.keys(tb.moved).map(Number).sort(num), cd: tb.cd, auto: !!tb.auto, why: tb.why || '' },
      units: ids(s).map(function (id) { var u = s.units[id], o = { id: u.id, t: u.t, team: u.team, x: Math.floor(u.x), y: Math.floor(u.y), hp: u.hp }; if (u.hid) { o.hid = u.hid; o.mhp = u.mhp; } return o; }),
      nextUid: s.nextUid, cHp: s.cHp, shp: sb ? sb.hp : 0, kills: s.kills | 0, won: !!s.won, over: !!s.over };
  }

  /** 저장 꼴 → 판. 깨졌거나 옛 꼴이면 null */
  function restore(o) {
    if (!o || o.v !== V || typeof o.seed !== 'number' || !o.tb || !Array.isArray(o.units)) { return null; }
    var s = R().state.create(o.seed, o.diff), UD = R().units.UDEF, i, u, n, cd = {}, k;
    s.ai = null; s.raid.next = 1e12; s.speed = 0;
    for (i = 0; i < o.units.length; i++) {
      u = o.units[i]; if (!UD[u.t] || !(u.id > 0)) { continue; }
      n = { id: u.id | 0, t: u.t, team: u.team === 1 ? 1 : 0, x: (u.x | 0) + 0.5, y: (u.y | 0) + 0.5, hp: +u.hp > 0 ? +u.hp : UD[u.t].hp, path: [], goal: null, face: 1 };
      if (u.t === 'hero' && u.hid && R().heroes) { n.hid = u.hid; n.st = R().heroes.statsOf(u.hid); n.mhp = +u.mhp > 0 ? +u.mhp : n.st.hp; }
      s.units[n.id] = n; s.nextUid = Math.max(s.nextUid, n.id + 1);
    }
    s.nextUid = Math.max(s.nextUid, o.nextUid | 0);
    for (k in (o.tb.cd || {})) { if (s.units[k] && o.tb.cd[k] > 0) { cd[k] = o.tb.cd[k] | 0; } }
    s.tb = { turn: Math.max(1, o.tb.turn | 0), side: 0, acted: {}, moved: {}, cd: cd, auto: !!o.tb.auto, why: o.tb.why || '' };
    (o.tb.acted || []).forEach(function (id) { if (s.units[id]) { s.tb.acted[id] = 1; } });
    (o.tb.moved || []).forEach(function (id) { if (s.units[id]) { s.tb.moved[id] = 1; } });
    s.cHp = o.cHp >= 0 ? +o.cHp : 400; if (s.buildings[-1] && o.shp >= 0) { s.buildings[-1].hp = +o.shp; }
    s.kills = o.kills | 0; s.won = !!o.won; s.over = !!o.over;
    return s;
  }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.tactics = { start: start, reach: reach, targets: targets, damage: damage, castDmg: castDmg, move: move, attack: attack, cast: cast, wait: wait,
    plan: plan, apply: apply, autoTurn: autoTurn, endTurn: endTurn, left: left, serialize: serialize, restore: restore, mv: mv, rangeOf: rangeOf, unitAt: unitAt,
    DMG_K: DMG_K, LAND_DEF: LAND_DEF, COUNTER: COUNTER, KILL: KILL, CAST_R: CAST_R, CAST_CD: CAST_CD, MAX_TURN: MAX_TURN, V: V };
})(typeof window !== 'undefined' ? window : this);
