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
  /** W-0401 손잡이 rtk.srpg — 1(기본) = 출진하면 곧장 SRPG 판(큰 판·승리 조건·내 부대), 0 = 옛 개입형(♟️ 한 번·8×6·3턴) */
  function srpgOn() { return core.tuned('rtk.srpg', 1) ? true : false; }

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
    var u = { uid: side + ':' + id, id: id, side: side, kind: 'officer', hp: hp, max: hp, atk: 10 + s.might / 5, def: s.might / 10,
      mov: MOV, rng: s.wisdom >= s.might ? 2 : 1, x: 0, y: 0, moved: false, acted: false, wis: s.wisdom }; u = global.DG.treasureSet && global.DG.treasureSet.tactic ? global.DG.treasureSet.tactic(u) : u; return global.DG.heroSkill ? global.DG.heroSkill.unit(u) : u;   /* W-0453 장수 고유 스킬·장비 */   /* W-0440 세트 전법 */   // wis — W-0401 책략
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
    if (b.srpg && (x !== u.x || y !== u.y)) { faceTo(u, x + (x - u.x), y + (y - u.y)); }   // W-0401 걸어간 쪽을 본다
    u.x = x; u.y = y; u.moved = true;
    if (b.srpg) { check(b); }   // 성문 칸에 서는 순간 점령(적 턴을 기다리면 그 사이 쓰러져 승리를 놓쳤다)
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
    var ch = hitChanceB(b, a, t);   // W-0401 SRPG 판이면 높이·상성·뒤까지
    if (b.srpg) { faceTo(a, t.x, t.y); }
    var hit = roll(b, 'h') * 100 < ch, dmg = 0;
    var HS = global.DG.heroSkill;   // W-0453 고유 스킬 — 피해 손질(치명·선봉·철벽·불굴…)·친 뒤(흡혈·반격·연격·처단)
    if (hit) { dmg = Math.max(1, Math.round(a.atk * DMG() * (0.8 + roll(b, 'd') * 0.4))); if (HS) { dmg = HS.dmg(b, a, t, dmg); } t.hp = Math.max(0, t.hp - dmg); }
    a.acted = true; a.moved = true; if (global.DG.support) { global.DG.support.onAct(b, a); }   // W-0425 지원 — 이웃 쌍 적기
    var le = { t: b.turn, a: uid, to: tuid, hit: hit, dmg: dmg, ch: ch }; b.log.push(le);
    var sk = HS ? HS.after(b, a, t, hit, dmg) : []; if (sk.length) { le.skills = sk; }
    var ct = global.DG.command ? global.DG.command.counter(b, a, t) : null;   // W-0455 맞붙음 반격
    check(b);
    return { ok: true, hit: hit, dmg: dmg, killed: t.hp <= 0, chance: ch, skills: sk, counter: ct };
  }

  /* ── AI(같은 규칙을 양쪽이 쓴다 — 진단의 자동 대국도 이것) ── */

  function actAuto(b, u) {
    if (u.hp <= 0 || b.done) { return; }
    if (u.confused) { u.confused = false; u.moved = true; u.acted = true; return; }   // W-0401 혼란 — 이번 차례를 쉬고 풀린다
    var foes = alive(b, u.side === 'me' ? 'foe' : 'me');
    if (!foes.length) { return; }
    function bestTarget() {
      var best = null, bc = -1;
      foes.forEach(function (t) { if (t.hp > 0 && inRange(u, t)) { var c = hitChanceB(b, u, t) + (global.DG.command ? global.DG.command.prio(b, t) : 0); if (c > bc) { bc = c; best = t; } } });
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
      if (pick) { if (b.srpg && (pick.x !== u.x || pick.y !== u.y)) { faceTo(u, pick.x + (pick.x - u.x), pick.y + (pick.y - u.y)); } u.x = pick.x; u.y = pick.y; }
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
    burnTick(b);   // 화계 — 불 없으면 아무것도 안 함
    if (b.done) { return b.done; }
    b.turn++;
    b.units.forEach(function (u) { u.moved = false; u.acted = false; });
    b.side = 'me';
    if (global.DG.heroSkill) { global.DG.heroSkill.turnStart(b); }   // W-0453 치유·인덕
    if (global.DG.command) { global.DG.command.turnStart(b); }   // W-0455 지휘관 곁 용병 보급
    check(b);
    return b.done;
  }
  /** 내 턴 끝 → 적 턴 */
  function endTurn(b) { if (global.DG.command) { global.DG.command.autoMercs(b); } return aiTurn(b); }   // W-0455 손대지 않은 용병은 맡김

  /* ── 결과 ─────────────────────────────────────────── */

  function hpFrac(b, side) {
    var us = b.units.filter(function (u) { return u.side === side; }), now = 0, max = 0;
    us.forEach(function (u) { now += u.hp; max += u.max; });
    return max ? now / max : 0;
  }
  function check(b) {
    if (b.done) { return b.done; }
    if (b.command && global.DG.command) { global.DG.command.sweep(b); }   // W-0455 지휘관 격파 → 휘하 궤주
    if (b.srpg) { return checkSrpg(b); }
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
    if (global.DG.support && !b.supDone) { b.supDone = true; global.DG.support.onEnd(b); } var down = b.units.filter(function (u) { return u.side === 'me' && u.kind === 'officer' && u.hp <= 0; }).map(function (u) { return u.id; });
    var pd = permadeath(), o = OUT[k];
    return { kind: k, name: o.name, winPct: o.winPct, lossMul: o.lossMul, turn: b.srpg ? b.turn : Math.min(b.turn, TURNS),
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
    if (!m.hooks.onTactics || atk.grid || m.water || !atk.officers.length) { return false; }
    var foes = def.officers.slice(0, 3), n = Math.max(1, Math.min(2, 5 - foes.length)), ft = [], k, seed = m.toId + '|' + (st.turn || 0) + '|' + m.r, sg = srpgOn();
    for (k = 0; k < n; k++) { ft.push(Math.round(def.troops / n)); }
    atk.grid = { give: 1, take: 1, kind: null };   // 판이 열린 동안 두 번 못 연다
    /* W-0401 SRPG — 목표는 판 씨앗(공성 = 전멸·대장·성문, 들판 = 전멸·대장) · 양쪽 부대 하나씩(고돗 G-0347 ④ 균형: 장수 수 맞춤) */
    var goal = sg ? (!m.sortie ? GOALS.slice(0, 3) : GOALS.slice(0, 2))[Math.floor(hash(seed, 'goal') * (!m.sortie ? 3 : 2))] : '';
    m.hooks.onTactics({ seed: seed, land: m.land.key, siege: !m.sortie, mine: atk.officers.slice(0, 3),
      foes: foes, foeTroops: sg ? [def.troops] : ft, to: m.toId, where: CD.find(m.toId).name, srpg: sg, goal: goal, myTroops: sg ? [atk.troops] : [] }, function (out) {
      if (out) { marchApply(m, out); }
      back();
    });
    return true;
  }
  /** 판에서 쓰러진 내 장수 — 전사(dead)·중상(hurt)·열전. 군주는 판이 끝나지 않게 중상으로 돌린다. 출진(marchApply)·방어(defenseApply) 공용(W-0403) */
  function fallOut(force, A, whereId, by, foeName, line) {
    var off = OFF(), R = global.DG.rtk, CD = global.DG.cityData, hurt = A.wounded.slice(), dead = [];
    A.fallen.forEach(function (id) { if (off.lordOf(force) === id) { hurt.push({ id: id, months: WOUND_MONTHS }); } else { dead.push(id); } });
    dead.forEach(function (id) {
      var rc = off.rec(id), c = rc.city ? R.city(rc.city) : null;
      rc.dead = true;
      if (c && c.gov === id) { c.gov = null; }
      annalize([id], whereId, (by || {})[id] || foeName);
      line('⚰️ ' + off.find(id).name + ' 이(가) ' + CD.find(whereId).name + ' 아래에서 쓰러졌다');
    });
    hurt.forEach(function (w) {
      off.rec(w.id).hurt = Math.max(off.rec(w.id).hurt || 0, w.months);
      line('🩹 ' + off.find(w.id).name + ' 이(가) 크게 다쳐 물러났다(' + w.months + '달)');
    });
    return { dead: dead, hurt: hurt };
  }
  /** 판 결과를 그 출진에 — 보정·전사(dead)·중상(hurt)·열전·사연 카드 */
  function marchApply(m, out) {
    var atk = m.atk, A = apply(out, { to: m.toId, where: m.toId }), R = global.DG.rtk, st = R.state();
    atk.grid = { give: 1 + A.winPct / 100, take: A.lossMul, kind: A.kind };
    m.lines('♟️ 전술판 ' + out.name + ' — 남은 합 공 위력 ' + (A.winPct >= 0 ? '+' : '') + A.winPct + '%' + (A.lossMul !== 1 ? ' · 받는 피해 ×' + A.lossMul : ''));
    var fo = fallOut(atk.force, A, m.toId, out.by, R.forceName(m.def.force) + '군', m.lines), dead = fo.dead;
    function drop(id) { var i = atk.officers.indexOf(id); if (i >= 0) { atk.officers.splice(i, 1); } }
    dead.forEach(drop); fo.hurt.forEach(function (w) { drop(w.id); });
    /* 열전 사연 카드 한 장(tactics-view.js 가 정의) — 이미 떠 있는 사연이 있으면 덮지 않는다(기록은 annals 에 남았다) */
    var E = global.DG.event;
    if (dead.length && E && E.DEFS && E.DEFS.tac_fallen && st.events && !st.events.pending && atk.force === st.me) {
      st.events.pending = { id: 'tac_fallen', step: 1, ctx: { a: dead[0], b: '', city: m.fromId, where: m.toId, force: atk.force } };
    }
    return A;   // 저장은 출진이 끝날 때(finishMarch) 한 번 — 여기서 저장하면 나간 병력만 빠진 반쪽 판이 남는다
  }

  /* ── W-0401 격자 SRPG 본전투(PLAN §5-17 · 고돗 G-0347 ③⑤ 와 같은 수치·같은 굴림) ─────────
   * 옛 판(makeBoard, 8×6·3턴)은 그대로 두고 makeBoardSrpg 로 만든 판(b.srpg)만 아래 규칙을 쓴다.
   *   판      땅 꼴별 크기 SRPG_SIZE(평지 10×8 · 강 11×8 · 구릉 11×9 · 산 12×10) · 언덕 칸(hill — 높이 1, 위에서 치면 명중 +HEIGHT_HIT)
   *           공성이면 성벽 줄 + 가운데 성문 칸(gate — 지나갈 수 있음)
   *   병종    부대마다(내 부대 둘까지도) 창·기·궁(씨앗) — 창>기>궁>창 이기면 +COUNTER_HIT, 지면 −COUNTER_HIT · 기 이동 3 · 궁 사거리 2 · 창 방어 +2
   *   방향    유닛은 걸어간 쪽·친 쪽을 본다(fx, fy). 뒤에서 치면(대상이 보는 방향의 반대편) +BACK_HIT
   *   승리    goal 하나: rout 전멸 · leader 적 대장(첫 적 장수) 격파 · gate 성문 칸 점령 · hold HOLD_TURNS 턴 버팀
   *           내 전멸 = 패 · SRPG_CAP 턴 넘으면 옛 체력 비율 판정. 대장·성문 = 대승(rout) · 버팀 = 승(win)
   *   책략    한 판 PLOTS 번, 지력 FIRE_WIS 이상 내 장수 — 화계(숲에 불, 번짐·두 턴 탐) · 혼란(적 한 차례 쉼) · 회복
   */
  var SRPG_SIZE = { plain: [10, 8], river: [11, 8], hill: [11, 9], mount: [12, 10] };
  var HILL_MIX = { plain: 0.08, river: 0.06, hill: 0.25, mount: 0.2 };
  var HEIGHT_HIT = 10, COUNTER_HIT = 20, BACK_HIT = 20;
  var ARMS = ['spear', 'cav', 'bow'], BEATS = { spear: 'cav', cav: 'bow', bow: 'spear' }, ARM_NAME = { spear: '창', cav: '기', bow: '궁' };
  var GOALS = ['rout', 'leader', 'gate', 'hold'], GOAL_NAME = { rout: '적 전멸', leader: '적 대장 격파', gate: '성문 점령', hold: '%d턴 버티기' };
  var HOLD_TURNS = 6, SRPG_CAP = 30, PLOTS = 2;
  var FIRE_WIS = 70, FIRE_RANGE = 3, FIRE_TURNS = 2, FIRE_DMG = 6, FIRE_SPREAD = 0.5, PLOT_RANGE = 3, HEAL_RANGE = 2, HEAL_BASE = 15;
  var PLOT_NAME = { fire: '화계', confuse: '혼란', heal: '회복' };

  function makeBoardSrpg(seed, terrain, siege, goal) {
    var CD = global.DG.cityData, land = terrain;
    if (CD && CD.find && CD.find(terrain)) { land = CD.landOf(terrain).key; }
    var key = MIX[land] ? land : 'plain', mx = MIX[key], cols = SRPG_SIZE[key][0], rows = SRPG_SIZE[key][1], cells = [], x, y;
    for (y = 0; y < rows; y++) {
      for (x = 0; x < cols; x++) {
        var t = 'plain', r = hash(seed, 'c' + x + ',' + y), h = hash(seed, 'h' + x + ',' + y);
        if (x >= 2 && x <= cols - 3 && r < mx.forest) { t = 'forest'; }
        else if (mx.rocks && x >= 3 && x <= cols - 4 && r > 1 - mx.rocks) { t = 'wall'; }
        else if (x >= 1 && x <= cols - 2 && h < HILL_MIX[key]) { t = 'hill'; }
        cells.push(t);
      }
    }
    if (mx.river) {
      var rx = Math.floor(cols / 2) - 1 + (hash(seed, 'rx') < 0.5 ? 0 : 1), f1 = Math.floor(hash(seed, 'f1') * rows), f2 = (f1 + 2 + Math.floor(hash(seed, 'f2') * (rows - 3))) % rows;
      for (y = 0; y < rows; y++) { cells[y * cols + rx] = (y === f1 || y === f2) ? 'plain' : 'river'; }
    }
    var g = GOALS.indexOf(goal) >= 0 ? goal : 'rout', gate = [-1, -1];
    if (g === 'gate' && !siege) { g = 'rout'; }
    if (siege) {
      for (y = 0; y < rows; y++) { if (y % 2 === 0) { cells[y * cols + (cols - 3)] = 'wall'; } }
      gate = [cols - 3, Math.floor(rows / 2)];
      cells[gate[1] * cols + gate[0]] = 'gate';
    }
    return { seed: String(seed), land: key, siege: !!siege, cols: cols, rows: rows, cells: cells, units: [], turn: 1, side: 'me', n: 0, done: null, log: [],
      srpg: true, goal: g, gate: gate, hold: HOLD_TURNS, plots: PLOTS };
  }
  /** SRPG 판에 두 편 — unitsOf 그대로 세운 뒤 내 부대(둘까지)·병종·방향·대장을 붙인다 */
  function unitsOfSrpg(b, mine, foes, foeTroops, opts, myTroops) {
    var list = unitsOf(b, mine, foes, foeTroops, opts), k, y, i;
    for (k = 0; k < Math.min((myTroops || []).length, 2); k++) {
      var t = troopUnit(k, 'me', myTroops[k]), placed = false;
      for (y = 0; y < b.rows && !placed; y++) {
        var yy = (y * 2 + 1) % b.rows, xs = [1, 2, 0];
        for (i = 0; i < 3; i++) { var c = cellAt(b, xs[i], yy); if (c !== 'river' && c !== 'wall' && !occupied(b, xs[i], yy)) { t.x = xs[i]; t.y = yy; placed = true; break; } }
      }
      list.push(t);
    }
    b.units = list;
    k = 0;
    list.forEach(function (u) {
      u.fx = u.side === 'me' ? 1 : -1; u.fy = 0; u.arm = '';
      if (u.kind === 'troop') {
        var arm = ARMS[(Math.floor(hash(b.seed, 'arm') * 3) + k) % 3]; k++;
        u.arm = arm;
        if (arm === 'cav') { u.mov = 3; } else if (arm === 'bow') { u.rng = 2; } else { u.def += 2; }
      }
    });
    for (i = 0; i < list.length; i++) { if (list[i].side === 'foe' && list[i].kind === 'officer') { list[i].leader = true; break; } }
    if (global.DG.heroSkill && b.plots != null) { b.plots += global.DG.heroSkill.plotsBonus(b); }   // W-0453 묘책
    if (global.DG.command) { global.DG.command.setup(b, { myTroops: myTroops, foeTroops: foeTroops, mercs: opts && opts.mercs, mercMul: opts && opts.mercMul, mercN: opts && opts.mercN, stats: opts && opts.stats }); list = b.units; }   // W-0455 지휘관·용병
    return list;
  }
  function faceTo(u, x, y) {
    var dx = x - u.x, dy = y - u.y;
    if (!dx && !dy) { return; }
    if (Math.abs(dx) >= Math.abs(dy)) { u.fx = Math.sign(dx); u.fy = 0; } else { u.fx = 0; u.fy = Math.sign(dy); }
  }
  function heightAt(b, x, y) { return cellAt(b, x, y) === 'hill' ? 1 : 0; }
  /** 뒤치기 — 공격자가 대상이 보는 방향의 반대편(옆은 아님) */
  function isBack(att, tgt) { return (att.x - tgt.x) * (tgt.fx || 0) + (att.y - tgt.y) * (tgt.fy || 0) < 0; }
  /** 명중 덤 내역 [[이름, %p]…] — 화면 풀이·진단 */
  function hitMods(b, att, tgt) {
    var out = [];
    if (!b.srpg) { return out; }
    if (heightAt(b, att.x, att.y) > heightAt(b, tgt.x, tgt.y)) { out.push(['높이', HEIGHT_HIT]); }
    if (att.arm && tgt.arm) { if (BEATS[att.arm] === tgt.arm) { out.push(['상성', COUNTER_HIT]); } else if (BEATS[tgt.arm] === att.arm) { out.push(['상성', -COUNTER_HIT]); } }
    if (isBack(att, tgt)) { out.push(['뒤', BACK_HIT]); } if (global.DG.support) { global.DG.support.mods(b, att, tgt, out); }   // W-0425 지원 명중·막음
    if (global.DG.heroSkill) { global.DG.heroSkill.mods(b, att, tgt, out); }   // W-0453 고유 스킬·장비 명중
    if (global.DG.command) { global.DG.command.mods(b, att, tgt, out); }   // W-0455 지휘 범위
    return out;
  }
  /** 판을 보는 명중률 — SRPG 판이면 높이·상성·뒤까지(옛 판은 hitChance 그대로) */
  function hitChanceB(b, att, tgt) {
    var base = hitChance(att, tgt, coverAt(b, tgt.x, tgt.y)), mods = hitMods(b, att, tgt), add = 0;
    if (!mods.length) { return base; }
    mods.forEach(function (m) { add += m[1]; });
    return Math.max(HIT_MIN, Math.min(HIT_MAX, base + add));
  }
  function goalText(b) { var g = b.goal || 'rout'; return g === 'hold' ? GOAL_NAME.hold.replace('%d', b.hold) : GOAL_NAME[g]; }
  function checkSrpg(b) {
    if (!alive(b, 'foe').length) { b.done = 'rout'; }
    else if (!alive(b, 'me').length) { b.done = 'lose'; }
    else {
      if (b.goal === 'leader') { if (b.units.some(function (u) { return u.leader && u.hp <= 0; })) { b.done = 'rout'; } }
      else if (b.goal === 'gate') { if (alive(b, 'me').some(function (u) { return u.x === b.gate[0] && u.y === b.gate[1]; })) { b.done = 'rout'; } }
      else if (b.goal === 'hold') { if (b.turn > b.hold) { b.done = 'win'; } }
      if (!b.done && b.turn > SRPG_CAP) { var m = hpFrac(b, 'me'), f = hpFrac(b, 'foe'); b.done = (f <= 0 || m / f >= 1.5) ? 'win' : 'draw'; }
    }
    return b.done;
  }

  /* 책략 — 화계·혼란·회복. 굴림은 판 순번(roll) — 안 쓰면 판·결과가 그대로. 기록은 b.fire_log(공격 log 와 따로) */
  function canPlot(b, uid) {
    var u = unit(b, uid);
    return !!u && u.kind === 'officer' && u.side === 'me' && b.side === 'me' && !b.done && u.hp > 0 && !u.acted && (u.wis || 0) >= FIRE_WIS && (b.plots == null ? PLOTS : b.plots) > 0;
  }
  function fireChance(u) { return Math.max(30, Math.min(90, 40 + Math.trunc(((u.wis || 0) - 60) * 2))); }
  function burning(b) { if (!b.fire) { b.fire = {}; } return b.fire; }
  function fireCells(b, uid) {
    var out = [], u = unit(b, uid), x, y;
    if (!canPlot(b, uid)) { return out; }
    for (y = 0; y < b.rows; y++) { for (x = 0; x < b.cols; x++) { if (cellAt(b, x, y) === 'forest' && Math.abs(x - u.x) + Math.abs(y - u.y) <= FIRE_RANGE && !burning(b)[x + ',' + y]) { out.push({ x: x, y: y }); } } }
    return out;
  }
  function burnUnits(b, dmg) {
    var hits = [];
    b.units.forEach(function (u) { if (u.hp > 0 && burning(b)[u.x + ',' + u.y]) { u.hp = Math.max(0, u.hp - dmg); hits.push({ uid: u.uid, dmg: dmg, killed: u.hp <= 0 }); } });
    return hits;
  }
  function plotDone(b, u, rec) {
    b.plots = (b.plots == null ? PLOTS : b.plots) - 1;
    u.acted = true; u.moved = true;
    if (!b.fire_log) { b.fire_log = []; }
    b.fire_log.push(rec);
    check(b);
  }
  /** 불을 놓는다 — {ok, lit, chance, cells:[[x,y]…], hits:[{uid,dmg,killed}…]} */
  function fire(b, uid, x, y) {
    if (!fireCells(b, uid).some(function (c) { return c.x === x && c.y === y; })) { return { ok: false }; }
    var u = unit(b, uid), ch = fireChance(u), lit = roll(b, 'f') * 100 < ch, cells = [], hits = [], dmg = Math.round(FIRE_DMG + u.wis / 10);
    if (lit) {
      burning(b)[x + ',' + y] = { left: FIRE_TURNS, dmg: dmg }; cells.push([x, y]);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = x + d[0], ny = y + d[1];
        if (nx >= 0 && ny >= 0 && nx < b.cols && ny < b.rows && cellAt(b, nx, ny) === 'forest' && !burning(b)[nx + ',' + ny] && roll(b, 's') < FIRE_SPREAD) { burning(b)[nx + ',' + ny] = { left: FIRE_TURNS, dmg: dmg }; cells.push([nx, ny]); }
      });
      hits = burnUnits(b, dmg);
    }
    plotDone(b, u, { t: b.turn, a: uid, plot: 'fire', lit: lit, cells: cells, hits: hits });
    return { ok: true, lit: lit, chance: ch, cells: cells, hits: hits };
  }
  /** 적 턴 끝 — 불 칸 위 유닛이 타고, 불이 한 번 줄고 0 이면 꺼진다 */
  function burnTick(b) {
    if (!b.fire) { return []; }
    var hits = [];
    Object.keys(b.fire).forEach(function (k) {
      var f = b.fire[k], xy = k.split(',');
      b.units.forEach(function (u) { if (u.hp > 0 && u.x === +xy[0] && u.y === +xy[1]) { u.hp = Math.max(0, u.hp - f.dmg); hits.push({ uid: u.uid, dmg: f.dmg, killed: u.hp <= 0 }); } });
      f.left--; if (f.left <= 0) { delete b.fire[k]; }
    });
    b.burn_last = hits;
    check(b);
    return hits;
  }
  function confuseChance(u, t) { return Math.max(20, Math.min(90, 50 + Math.trunc(((u.wis || 0) - (t.wis == null ? 40 : t.wis)) * 2))); }
  function healAmount(u) { return Math.round(HEAL_BASE + (u.wis || 0) / 5); }
  /** 혼란·회복을 걸 수 있는 대상 [uid…] */
  function plotTargets(b, uid, plot) {
    var out = [], u = unit(b, uid);
    if (!canPlot(b, uid)) { return out; }
    alive(b).forEach(function (t) {
      var d = dist(u, t);
      if (plot === 'confuse' && t.side !== u.side && d <= PLOT_RANGE && !t.confused) { out.push(t.uid); }
      else if (plot === 'heal' && t.side === u.side && d <= HEAL_RANGE && t.hp < t.max) { out.push(t.uid); }
    });
    return out;
  }
  /** 혼란·회복을 건다 — {ok, plot, hit, chance, amount} */
  function plot(b, uid, key, tuid) {
    if (plotTargets(b, uid, key).indexOf(tuid) < 0) { return { ok: false }; }
    var u = unit(b, uid), t = unit(b, tuid), r = { ok: true, plot: key, to: tuid, hit: true, chance: 100, amount: 0 };
    if (key === 'confuse') { r.chance = confuseChance(u, t); r.hit = roll(b, 'cf') * 100 < r.chance; if (r.hit) { t.confused = true; } }
    else { var before = t.hp; t.hp = Math.min(t.max, before + healAmount(u)); r.amount = Math.round(t.hp - before); }
    plotDone(b, u, { t: b.turn, a: uid, plot: key, to: tuid, hit: r.hit, amount: r.amount });
    return r;
  }

  /* ── W-0403 방어전 — 내 성(d.to)을 d.force 가 친다. 내 편 = 그 성 장수 셋(다친 사람 빼고)·성 병력 부대, 적 = 공격 장수·병력.
     목표는 늘 hold(6턴 버티기), 공성 판을 좌우로 뒤집어 성벽이 내 쪽 ── */
  /** 방어 판 열쇠(tacticsView.open 의 opts) — d = { force, from, to, lead, troops } */
  function defenseOpts(d) {
    var R = global.DG.rtk, CD = global.DG.cityData, off = OFF(), to = R.city(d.to), st = R.state();
    var mine = off.atCity(d.to, to.force).filter(function (h) { return !off.rec(h.id).hurt; }).slice(0, 3).map(function (h) { return h.id; });
    return { seed: 'def|' + d.to + '|' + (st.turn || 0), land: CD.landOf(d.to).key, siege: true, defend: true, srpg: true, goal: 'hold',
      mine: mine, foes: (d.lead || []).slice(0, 3), foeTroops: [d.troops], myTroops: [to.troops], to: d.to, where: CD.find(d.to).name };
  }
  /** 판을 좌우로 뒤집는다(성벽·성문이 왼쪽 = 내 쪽) — 유닛 세우기 전에 */
  function mirror(b) {
    var x, y, row, c2 = [];
    for (y = 0; y < b.rows; y++) { row = b.cells.slice(y * b.cols, (y + 1) * b.cols).reverse(); for (x = 0; x < b.cols; x++) { c2.push(row[x]); } }
    b.cells = c2;
    if (b.gate && b.gate[0] >= 0) { b.gate = [b.cols - 1 - b.gate[0], b.gate[1]]; }
    return b;
  }
  /** 방어 판 결과(내 쪽에서 본 outcome) → 공격군 보정 · 쓰러진 내 장수 처리. out 이 없으면(맡김) 보정 없음 */
  function defenseApply(d, out) {
    var lines = [];
    if (!out) { return { grid: null, lines: lines }; }
    var A = apply(out, { to: d.to }), R = global.DG.rtk;
    fallOut(R.me(), A, d.to, out.by, R.forceName(d.force) + '군', function (l) { lines.push(l); });
    lines.unshift('♟️ 방어 판 ' + out.name + ' — 적 위력 ' + (A.winPct > 0 ? '−' : '+') + Math.abs(A.winPct) + '%' + (A.kind === 'rout' ? ' · 적이 받는 피해 ×1.3' : ''));
    var out2 = A.wounded.map(function (w) { return w.id; }).concat(A.fallen);   // 쓰러지거나 다친 내 장수는 이어지는 판정에서 수비에 안 선다(march opts.out)
    return { grid: { give: 1 - A.winPct / 100, take: A.kind === 'rout' ? 1.3 : 1, kind: 'def-' + A.kind }, out: out2, lines: lines, A: A };
  }

  /** 진단·균형용 — 양쪽 다 AI 로 끝까지 둔다 */
  function autoPlay(b) {
    var guard = 0;
    while (!b.done && guard++ < (b.srpg ? SRPG_CAP + 5 : 20)) { autoSide(b, 'me'); check(b); if (b.done) { break; } aiTurn(b); }
    return outcome(b);
  }

  global.DG = global.DG || {};
  global.DG.tactics = {
    COLS: COLS, ROWS: ROWS, TURNS: TURNS, COVER: COVER, OUT: OUT, WOUND_MONTHS: WOUND_MONTHS,
    hash: hash, makeBoard: makeBoard, cellAt: cellAt, coverAt: coverAt, officerUnit: officerUnit, troopUnit: troopUnit, unitsOf: unitsOf,
    unit: unit, alive: alive, actAuto: actAuto, moves: moves, move: move, hitChance: hitChance, attack: attack,
    aiTurn: aiTurn, endTurn: endTurn, outcome: outcome, apply: apply, annalize: annalize, autoPlay: autoPlay, permadeath: permadeath,
    marchGrid: marchGrid, marchApply: marchApply, srpgOn: srpgOn, fallOut: fallOut, defenseOpts: defenseOpts, defenseApply: defenseApply, mirror: mirror,
    SRPG_SIZE: SRPG_SIZE, HEIGHT_HIT: HEIGHT_HIT, COUNTER_HIT: COUNTER_HIT, BACK_HIT: BACK_HIT, ARMS: ARMS, BEATS: BEATS, ARM_NAME: ARM_NAME, GOALS: GOALS, GOAL_NAME: GOAL_NAME,
    HOLD_TURNS: HOLD_TURNS, SRPG_CAP: SRPG_CAP, PLOTS: PLOTS, FIRE_WIS: FIRE_WIS, PLOT_NAME: PLOT_NAME,
    makeBoardSrpg: makeBoardSrpg, unitsOfSrpg: unitsOfSrpg, heightAt: heightAt, isBack: isBack, hitMods: hitMods, hitChanceB: hitChanceB, goalText: goalText,
    canPlot: canPlot, fireCells: fireCells, fire: fire, burnTick: burnTick, plotTargets: plotTargets, plot: plot, confuseChance: confuseChance, healAmount: healAmount
  };
})(window);
