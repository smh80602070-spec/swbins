/**
 * 사가천하 — 격자 전술 규칙 층 (PLAN §5-16, W-0107 리뉴얼 ⑤-2 · 엑스컴 참고)
 * ---------------------------------------------------------------
 * "전투가 구경이다"(§4 구멍 3)를 깨는 **소수 장수 격자 전술**의 규칙만 — 화면·배선은 W-0108.
 *
 *   판      8열 × 6행, 내 편은 둘째·셋째 열·적은 여섯째·일곱째 열에서 선다(첫 턴부터 맞붙게). 칸 = 평지·숲·강·성벽(`war.js` 지형 전술 넷과 같은 이름). 그 성의 땅(`cityData.landOf` —
 *           평야·구릉·강·산)이 섞는 비율을 정하고, 공성이면 수비 쪽 끝에 성벽 줄이 선다. 강 칸은 못 선다(건널목 둘은 늘 남긴다).
 *   엄폐    숲 = 절반 엄폐(피격 명중 −30%p) · 성벽 = 완전 엄폐(−50%p)
 *   유닛    장수: hp = 50 + 통솔 · atk = 10 + 무력/5 · def = 무력/10 · mov 3 · rng 지력 ≥ 무력이면 2(활·책사) 아니면 1
 *           부대(병력): hp = 30 + 병력/200(최대 120) · atk 12 · def 2 · mov 2 · rng 1
 *           (티켓 초안 "병력/1000" 은 hp 5 안팎이라 한 대에 쓰러져 균형 진단 ⑧ 이 안 섰다 — 진단이 이 식을 지킨다)
 *   차례    내 턴(장수마다 이동 한 번 + 공격 한 번, 둘 다 안 해도 된다) → 적 턴(AI) × 3턴
 *   명중    clamp(65 + (atk − def)×2 − 엄폐, 10, 95) %  · 피해 = atk × 피해 배수(`rtk.tacticsDmg` 2) × (0.8~1.2) — 굴림은 판 씨앗 해시(Math.random 안 씀)
 *           (배수 1 이면 3턴에 양쪽 hp 가 35% 씩만 깎여 무승부 92% — 균형 진단 ⑧ 로 2 를 골랐다)
 *   AI      닿는 적 중 명중이 가장 높은 쪽을 친다. 없으면 가장 가까운 적에게 다가가되 같은 거리면 엄폐 칸 먼저, 다가간 뒤 닿으면 친다
 *   결과    적 전멸 = 대승(rout, 공략 승률 +25%p·내 사상 ×0.7) · 3턴 뒤 남은 hp 비율(내/적) ≥ 1.5 = 승(win, +10%p)
 *           · 그 밖 = 무승부(draw, 0) · 내 전멸 = 패(lose, −25%p). 쓰러진 내 장수는 영구 전사(fallen) — 손잡이
 *           `rtk.permadeath` 0 이면 중상(wounded, 3달 출진 불가)
 *
 * **판정 두 벌 금지** — 결과는 `apply()` 가 돌려주는 보정값 객체뿐(공략 판정 `war.js march` 가 받는 쪽, W-0108). 판은 저장하지 않는다.
 * 세이브는 전사 기록 `save.rtk.annals[id] = {at, where, by}` 하나(`annalize`, 열전).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var COLS = 8, ROWS = 6, TURNS = 3, MOV = 3, MOV_TROOP = 2;
  var COVER = { plain: 0, forest: 30, river: 0, wall: 50 };
  var HIT_MIN = 10, HIT_MAX = 95, HIT_BASE = 65;
  var OUT = {
    rout: { kind: 'rout', name: '대승', winPct: 25, lossMul: 0.7 },
    win:  { kind: 'win',  name: '승',   winPct: 10, lossMul: 1 },
    draw: { kind: 'draw', name: '무승부', winPct: 0, lossMul: 1 },
    lose: { kind: 'lose', name: '패',   winPct: -25, lossMul: 1 }
  };
  var WOUND_MONTHS = 3;
  function DMG() { return core.tuned('rtk.tacticsDmg', 2); }

  function OFF() { return global.DG.off; }
  function permadeath() { return core.tuned('rtk.permadeath', 1) ? true : false; }

  /** 작은 결정적 해시 0~1 — 씨앗·소금 */
  function hash(seed, salt) {
    var h = 2166136261 >>> 0, s = String(seed) + '|' + salt, i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= h >>> 13; h = Math.imul(h, 1274126177) >>> 0; h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  /** 판 안의 다음 굴림 — 굴릴 때마다 순번이 오른다(같은 씨앗·같은 수순 = 같은 결과) */
  function roll(b, salt) { b.n = (b.n || 0) + 1; return hash(b.seed, salt + '#' + b.n); }

  /* ── 판 ────────────────────────────────────────────── */

  /** 땅 꼴 → 칸 비율 [숲, 강 줄 있음, 성벽] */
  var MIX = { plain: { forest: 0.12, river: false }, hill: { forest: 0.28, river: false }, river: { forest: 0.1, river: true }, mount: { forest: 0.35, river: false, rocks: 0.08 } };

  /**
   * 판 하나 — terrain = 땅 키(plain|hill|river|mount, 성 id 를 주면 그 성의 땅), siege = 공성이면 수비 쪽(오른쪽 끝) 성벽 줄.
   * **순수 함수**(같은 씨앗 = 같은 판)
   */
  function makeBoard(seed, terrain, siege) {
    var CD = global.DG.cityData, land = terrain;
    if (CD && CD.find && CD.find(terrain)) { land = CD.landOf(terrain).key; }
    var mx = MIX[land] || MIX.plain, cells = [], x, y;
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) {
        var t = 'plain', r = hash(seed, 'c' + x + ',' + y);
        if (x >= 2 && x <= 5 && r < mx.forest) { t = 'forest'; }
        else if (mx.rocks && x >= 2 && x <= 5 && r > 1 - mx.rocks) { t = 'wall'; }
        cells.push(t);
      }
    }
    if (mx.river) {   // 가운데 세로 강 한 줄 — 건널목 둘
      var rx = 3 + (hash(seed, 'rx') < 0.5 ? 0 : 1), f1 = Math.floor(hash(seed, 'f1') * ROWS), f2 = (f1 + 2 + Math.floor(hash(seed, 'f2') * (ROWS - 3))) % ROWS;
      for (y = 0; y < ROWS; y++) { cells[y * COLS + rx] = (y === f1 || y === f2) ? 'plain' : 'river'; }
    }
    if (siege) { for (y = 0; y < ROWS; y++) { if (y % 2 === 0) { cells[y * COLS + (COLS - 2)] = 'wall'; } } }
    return { seed: String(seed), land: land, siege: !!siege, cols: COLS, rows: ROWS, cells: cells, units: [], turn: 1, side: 'me', n: 0, done: null, log: [] };
  }
  function cellAt(b, x, y) { return x < 0 || y < 0 || x >= b.cols || y >= b.rows ? null : b.cells[y * b.cols + x]; }
  function coverAt(b, x, y) { return COVER[cellAt(b, x, y)] || 0; }

  /* ── 유닛 ─────────────────────────────────────────── */

  /** 장수 유닛 — 능력치 선형 변환 한 식. stats 를 주면 그걸(진단용), 아니면 officer.js */
  function officerUnit(id, side, stats) {
    var s = stats || (OFF() ? OFF().stats(id) : { might: 60, wisdom: 60, command: 60 });
    var hp = 50 + s.command;
    return { uid: side + ':' + id, id: id, side: side, kind: 'officer', hp: hp, max: hp, atk: 10 + s.might / 5, def: s.might / 10,
      mov: MOV, rng: s.wisdom >= s.might ? 2 : 1, x: 0, y: 0, moved: false, acted: false };
  }
  /** 부대 유닛 — 병력에서 */
  function troopUnit(n, side, troops) {
    var hp = Math.min(120, Math.round(30 + (troops || 0) / 200));
    return { uid: side + ':troop' + n, id: '', side: side, kind: 'troop', hp: hp, max: hp, atk: 12, def: 2, mov: MOV_TROOP, rng: 1, x: 0, y: 0, moved: false, acted: false };
  }
  /**
   * 판에 두 편을 세운다 — mine = 내 장수 id(셋까지), foes = 적 장수 id, foeTroops = 적 부대 병력 배열(장수와 합쳐 3~5).
   * 내 편은 왼쪽 둘째·셋째 열, 적은 오른쪽 여섯째·일곱째 열(성벽·강이면 옆 칸으로). opts.stats = {id: {might,wisdom,command}}(진단용)
   */
  function unitsOf(b, mine, foes, foeTroops, opts) {
    var st = (opts && opts.stats) || {}, list = [], i;
    (mine || []).slice(0, 3).forEach(function (id) { list.push(officerUnit(id, 'me', st[id])); });
    var fo = (foes || []).slice(0, 3);
    fo.forEach(function (id) { list.push(officerUnit(id, 'foe', st[id])); });
    var tr = (foeTroops || []).slice(0, Math.max(0, 5 - fo.length));
    while (fo.length + tr.length < 3) { tr.push(3000); }
    tr.forEach(function (t, k) { list.push(troopUnit(k, 'foe', t)); });
    var slots = { me: [], foe: [] }, y, x;
    for (y = 0; y < b.rows; y++) {
      for (x = 1; x <= 2; x++) { slots.me.push([x, (y * 2 + 1) % b.rows]); }
      for (x = b.cols - 2; x >= b.cols - 3; x--) { slots.foe.push([x, (y * 2 + 1) % b.rows]); }
    }
    var used = {};
    list.forEach(function (u) {
      var s = slots[u.side];
      for (var k = 0; k < s.length; k++) {
        var key = s[k][0] + ',' + s[k][1], c = cellAt(b, s[k][0], s[k][1]);
        if (used[key] || c === 'river' || c === 'wall') { continue; }
        used[key] = 1; u.x = s[k][0]; u.y = s[k][1]; break;
      }
    });
    b.units = list;
    return list;
  }
  function unit(b, uid) { for (var i = 0; i < b.units.length; i++) { if (b.units[i].uid === uid) { return b.units[i]; } } return null; }
  function alive(b, side) { return b.units.filter(function (u) { return u.hp > 0 && (!side || u.side === side); }); }
  function occupied(b, x, y) { return b.units.some(function (u) { return u.hp > 0 && u.x === x && u.y === y; }); }
  function dist(a, b2) { return Math.abs(a.x - b2.x) + Math.abs(a.y - b2.y); }

  /** 갈 수 있는 칸들(제자리 포함) — 상하좌우 mov 걸음, 강·남이 선 칸은 못 지난다 */
  function moves(b, uid) {
    var u = unit(b, uid);
    if (!u || u.hp <= 0 || u.moved) { return u && u.hp > 0 ? [{ x: u.x, y: u.y }] : []; }
    var seen = {}, out = [], q = [[u.x, u.y, 0]], k = u.x + ',' + u.y;
    seen[k] = 1;
    while (q.length) {
      var c = q.shift();
      out.push({ x: c[0], y: c[1] });
      if (c[2] >= u.mov) { continue; }
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = c[0] + d[0], ny = c[1] + d[1], kk = nx + ',' + ny, t = cellAt(b, nx, ny);
        if (seen[kk] || !t || t === 'river' || occupied(b, nx, ny)) { return; }
        seen[kk] = 1; q.push([nx, ny, c[2] + 1]);
      });
    }
    return out;
  }
  function move(b, uid, x, y) {
    var u = unit(b, uid);
    if (!u || u.side !== b.side || u.moved || b.done) { return false; }
    if (!moves(b, uid).some(function (c) { return c.x === x && c.y === y; })) { return false; }
    u.x = x; u.y = y; u.moved = true;
    return true;
  }

  /** 명중률(%) — 공격자 atk·대상 def·대상 칸 엄폐. **순수 함수** */
  function hitChance(att, tgt, cover) {
    return Math.max(HIT_MIN, Math.min(HIT_MAX, Math.round(HIT_BASE + (att.atk - tgt.def) * 2 - (cover || 0))));
  }
  function inRange(a, t) { return dist(a, t) <= a.rng; }
  /** 친다 — {ok, hit, dmg, killed, chance} */
  function attack(b, uid, tuid) {
    var a = unit(b, uid), t = unit(b, tuid);
    if (!a || !t || a.hp <= 0 || t.hp <= 0 || a.acted || a.side === t.side || a.side !== b.side || b.done || !inRange(a, t)) { return { ok: false }; }
    var ch = hitChance(a, t, coverAt(b, t.x, t.y)), hit = roll(b, 'h') * 100 < ch, dmg = 0;
    if (hit) { dmg = Math.max(1, Math.round(a.atk * DMG() * (0.8 + roll(b, 'd') * 0.4))); t.hp = Math.max(0, t.hp - dmg); }
    a.acted = true; a.moved = true;
    b.log.push({ t: b.turn, a: uid, to: tuid, hit: hit, dmg: dmg, ch: ch });
    check(b);
    return { ok: true, hit: hit, dmg: dmg, killed: t.hp <= 0, chance: ch };
  }

  /* ── AI(같은 규칙을 양쪽이 쓴다 — 진단의 자동 대국도 이것) ── */

  function actAuto(b, u) {
    if (u.hp <= 0 || b.done) { return; }
    var foes = alive(b, u.side === 'me' ? 'foe' : 'me');
    if (!foes.length) { return; }
    function bestTarget() {
      var best = null, bc = -1;
      foes.forEach(function (t) { if (t.hp > 0 && inRange(u, t)) { var c = hitChance(u, t, coverAt(b, t.x, t.y)); if (c > bc) { bc = c; best = t; } } });
      return best;
    }
    var tg = bestTarget();
    if (!tg) {
      var near = foes.slice().sort(function (p, q) { return dist(u, p) - dist(u, q) || (p.uid < q.uid ? -1 : 1); })[0];
      var opts = moves(b, u.uid), pick = null, pd = Infinity, pc = -1;
      opts.forEach(function (c) {
        var d = Math.max(0, dist(c, near) - u.rng), cv = coverAt(b, c.x, c.y);
        if (d < pd || (d === pd && cv > pc)) { pick = c; pd = d; pc = cv; }
      });
      if (pick) { u.x = pick.x; u.y = pick.y; }
      u.moved = true;
      tg = bestTarget();
    }
    if (tg) { attack(b, u.uid, tg.uid); }
  }
  /** 한 편의 차례를 AI 로 둔다 */
  function autoSide(b, side) {
    var s0 = b.side;
    b.side = side;
    alive(b, side).forEach(function (u) { actAuto(b, u); });
    b.side = s0;
  }
  /** 적 턴 — AI 가 다 두고 다음 턴으로(내 유닛 행동 초기화). 3턴이 끝나면 결과가 선다 */
  function aiTurn(b) {
    if (b.done) { return b.done; }
    autoSide(b, 'foe');
    if (b.done) { return b.done; }
    b.turn++;
    b.units.forEach(function (u) { u.moved = false; u.acted = false; });
    b.side = 'me';
    check(b);
    return b.done;
  }
  /** 내 턴 끝 → 적 턴 */
  function endTurn(b) { return aiTurn(b); }

  /* ── 결과 ─────────────────────────────────────────── */

  function hpFrac(b, side) {
    var us = b.units.filter(function (u) { return u.side === side; }), now = 0, max = 0;
    us.forEach(function (u) { now += u.hp; max += u.max; });
    return max ? now / max : 0;
  }
  function check(b) {
    if (b.done) { return b.done; }
    if (!alive(b, 'foe').length) { b.done = 'rout'; }
    else if (!alive(b, 'me').length) { b.done = 'lose'; }
    else if (b.turn > TURNS) {
      var m = hpFrac(b, 'me'), f = hpFrac(b, 'foe');
      b.done = (f <= 0 || m / f >= 1.5) ? 'win' : 'draw';
    }
    return b.done;
  }
  /** 결과 — 끝나지 않았으면 null. fallen(영구 전사)·wounded(중상) 는 쓰러진 **내 장수** id */
  function outcome(b) {
    var k = check(b);
    if (!k) { return null; }
    var down = b.units.filter(function (u) { return u.side === 'me' && u.kind === 'officer' && u.hp <= 0; }).map(function (u) { return u.id; });
    var pd = permadeath(), o = OUT[k];
    return { kind: k, name: o.name, winPct: o.winPct, lossMul: o.lossMul, turn: Math.min(b.turn, TURNS),
      hpMe: Math.round(hpFrac(b, 'me') * 100), hpFoe: Math.round(hpFrac(b, 'foe') * 100),
      fallen: pd ? down : [], wounded: pd ? [] : down, foeDown: b.units.filter(function (u) { return u.side === 'foe' && u.hp <= 0; }).map(function (u) { return u.id || u.uid; }) };
  }
  /**
   * 공략 판정이 받을 보정값 — **판정을 하지 않는다**(W-0108 이 war.js 에 건넨다). marchCtx = {from, to, where} 는 기록용
   */
  function apply(out, marchCtx) {
    if (!out) { return null; }
    var ctx = marchCtx || {};
    return { winPct: out.winPct, lossMul: out.lossMul, kind: out.kind,
      fallen: out.fallen.slice(), wounded: out.wounded.map(function (id) { return { id: id, months: WOUND_MONTHS }; }),
      where: ctx.where || ctx.to || '' };
  }
  /** 전사 기록(열전) — save.rtk.annals[id] = {at, where, by}. W-0108 이 결과를 적용할 때 부른다 */
  function annalize(ids, where, by) {
    var R = global.DG.rtk, st = R && R.state ? R.state() : null;
    if (!st) { return 0; }
    if (!st.annals) { st.annals = {}; }
    (ids || []).forEach(function (id) { st.annals[id] = { at: st.turn || 0, where: where || '', by: by || '' }; });
    return (ids || []).length;
  }

  /* ── 개입형 출진 배선(W-0108) — war.js marchInteractive 의 「♟️ 전술판」 ─────────
   * war.js 는 큰 파일이라(tools/big-files.txt) 몸통은 여기 두고 거기선 한 줄로 부른다.
   * m = { hooks, atk, def, toId, fromId, land, water, sortie, r, lines } — marchInteractive 의 지역 변수 그대로.
   * 판정은 안 한다: atk.grid = { give, take, kind } 를 stepRound 가 **남은 합**의 공·피해 배율에 곱할 뿐(1 + winPct/100 · lossMul).
   */
  /** 판을 연다 — 끝나면 보정·전사를 적용하고 back()(같은 합 다시 묻기). 열 수 없으면(훅 없음·이미 씀·수전) false */
  function marchGrid(m, back) {
    var atk = m.atk, def = m.def, CD = global.DG.cityData, st = global.DG.rtk.state();
    if (!m.hooks.onTactics || atk.grid || m.water) { return false; }
    var foes = def.officers.slice(0, 3), n = Math.max(1, Math.min(2, 5 - foes.length)), ft = [], k;
    for (k = 0; k < n; k++) { ft.push(Math.round(def.troops / n)); }
    atk.grid = { give: 1, take: 1, kind: null };   // 판이 열린 동안 두 번 못 연다
    m.hooks.onTactics({ seed: m.toId + '|' + (st.turn || 0) + '|' + m.r, land: m.land.key, siege: !m.sortie, mine: atk.officers.slice(0, 3),
      foes: foes, foeTroops: ft, to: m.toId, where: CD.find(m.toId).name }, function (out) {
      if (out) { marchApply(m, out); }
      back();
    });
    return true;
  }
  /** 판 결과를 그 출진에 — 보정·전사(dead)·중상(hurt)·열전·사연 카드. 군주는 판이 끝나지 않게 중상으로 돌린다 */
  function marchApply(m, out) {
    var atk = m.atk, A = apply(out, { to: m.toId, where: m.toId }), off = OFF(), R = global.DG.rtk, st = R.state(), CD = global.DG.cityData;
    var by = out.by || {}, foeName = R.forceName(m.def.force) + '군', hurt = A.wounded.slice(), dead = [];
    atk.grid = { give: 1 + A.winPct / 100, take: A.lossMul, kind: A.kind };
    m.lines('♟️ 전술판 ' + out.name + ' — 남은 합 공 위력 ' + (A.winPct >= 0 ? '+' : '') + A.winPct + '%' + (A.lossMul !== 1 ? ' · 받는 피해 ×' + A.lossMul : ''));
    A.fallen.forEach(function (id) { if (off.lordOf(atk.force) === id) { hurt.push({ id: id, months: WOUND_MONTHS }); } else { dead.push(id); } });
    function drop(id) { var i = atk.officers.indexOf(id); if (i >= 0) { atk.officers.splice(i, 1); } }
    dead.forEach(function (id) {
      var rc = off.rec(id), c = rc.city ? R.city(rc.city) : null;
      rc.dead = true;
      if (c && c.gov === id) { c.gov = null; }
      drop(id);
      annalize([id], m.toId, by[id] || foeName);
      m.lines('⚰️ ' + off.find(id).name + ' 이(가) ' + CD.find(m.toId).name + ' 아래에서 쓰러졌다');
    });
    hurt.forEach(function (w) {
      off.rec(w.id).hurt = Math.max(off.rec(w.id).hurt || 0, w.months);
      drop(w.id);
      m.lines('🩹 ' + off.find(w.id).name + ' 이(가) 크게 다쳐 물러났다(' + w.months + '달)');
    });
    /* 열전 사연 카드 한 장(tactics-view.js 가 정의) — 이미 떠 있는 사연이 있으면 덮지 않는다(기록은 annals 에 남았다) */
    var E = global.DG.event;
    if (dead.length && E && E.DEFS && E.DEFS.tac_fallen && st.events && !st.events.pending && atk.force === st.me) {
      st.events.pending = { id: 'tac_fallen', step: 1, ctx: { a: dead[0], b: '', city: m.fromId, where: m.toId, force: atk.force } };
    }
    core.persist();
    return A;
  }

  /** 진단·균형용 — 양쪽 다 AI 로 끝까지 둔다 */
  function autoPlay(b) {
    var guard = 0;
    while (!b.done && guard++ < 20) { autoSide(b, 'me'); check(b); if (b.done) { break; } aiTurn(b); }
    return outcome(b);
  }

  global.DG = global.DG || {};
  global.DG.tactics = {
    COLS: COLS, ROWS: ROWS, TURNS: TURNS, COVER: COVER, OUT: OUT, WOUND_MONTHS: WOUND_MONTHS,
    hash: hash, makeBoard: makeBoard, cellAt: cellAt, coverAt: coverAt, officerUnit: officerUnit, troopUnit: troopUnit, unitsOf: unitsOf,
    unit: unit, alive: alive, moves: moves, move: move, hitChance: hitChance, attack: attack,
    aiTurn: aiTurn, endTurn: endTurn, outcome: outcome, apply: apply, annalize: annalize, autoPlay: autoPlay, permadeath: permadeath,
    marchGrid: marchGrid, marchApply: marchApply
  };
})(window);
