/**
 * 5천하 격자 전투 — 지휘관·용병(W-0455, 사용자 10-26 「랑그릿사나 창세기전 같은 턴 방식이고 잼나야함」)
 * ---------------------------------------------------------------
 * 장수(양쪽) 하나가 휘하 용병 둘을 이끈다. 병력 덩어리(부대)는 용병으로 나뉜다.
 *   용병     장수당 둘(장 흐름은 9장부터 내 쪽 셋 — 커 가는 맛) · 체력 = clamp(18 + 병력/(장수 수×2)/50, 20, 60) · 공 9 · 방 1 · 이동 2 · 병종 창·기·궁(기 이동 3 · 궁 사거리 2 · 창 방 +2)
 *   지휘 범위 = 2 + 통솔/45 칸 — 범위 안 용병은 칠 때 명중 +(6+통솔/10)%p, 맞을 때 같은 만큼 −
 *   궤주     지휘관이 쓰러지면 그 용병이 모두 흩어진다(b.fled)
 *   보급     턴이 열릴 때 지휘관과 맞닿은 용병 체력 +25%
 *   반격     맞닿아 맞고 버티면 50% 힘으로 되받아친다(두 칸 공격엔 없음 · 고유 스킬 「반격」은 그 스킬로)
 *   맡김     내 턴 끝에 이번 턴 손대지 않은 내 용병은 AI 로
 * 판 규칙 층(tactics.js)이 한 줄씩 부른다. three·DOM 없이 돈다(진단이 본다). 손잡이 rtk.command(1, 0 = 옛 판).
 *
 *   DG.command.setup(b, opts)          unitsOfSrpg 끝 — 부대를 용병으로 · opts.mercs = {장수 id: [병종, 병종]} · opts.mercMul = 내 용병 체력 배수 · opts.mercN = 내 장수당 용병 수(장 흐름 9장부터 셋)
 *   DG.command.foeArms(seed, foes)     적 장수별 병종 [[a,a]…](진영 「적 편성」 미리 보기와 같은 셈)
 *   DG.command.mods(b, att, tgt, out)  hitMods 끝 — ['지휘', ±%p]
 *   DG.command.counter(b, a, t)        attack 뒤 — 반격 기록(b.log) · {hit, dmg} | null
 *   DG.command.sweep(b)                check 앞 — 궤주
 *   DG.command.turnStart(b) / autoMercs(b) / range(b, uid) / nameOf(b, u, offName)
 */
(function (global) {
  'use strict';
  function C() { return global.DG.core; }
  function T() { return global.DG.tactics; }
  function on() { var c = C(); return !(c && c.tuned && !+c.tuned('rtk.command', 1)); }

  var PER = 2, ARMS = ['spear', 'cav', 'bow'], ARM_FULL = { spear: '창병', cav: '기병', bow: '궁병' };
  var COUNTER_MUL = 0.5, RESUPPLY = 0.25;
  function knob(k, d) { var c = C(); return c && c.tuned ? +c.tuned(k, d) : d; }   // 손잡이 rtk.cmdCounter(반격 %)·rtk.cmdAura(지휘 덤 %)·rtk.cmdPrio(AI 가 지휘관을 노리는 덤 %p)

  function cmdOf(id, st) {
    var s = (st && st[id]) || (global.DG.off && global.DG.off.stats ? global.DG.off.stats(id) : null);
    return s && s.command != null ? s.command : 60;
  }
  function foeArms(seed, foes) {
    return (foes || []).map(function (id, i) { var h = T().hash(String(seed), 'ma' + i); return [ARMS[Math.floor(h * 3)], ARMS[(Math.floor(h * 3) + 1 + Math.floor(T().hash(String(seed), 'mb' + i) * 2)) % 3]]; });
  }
  function free(b, x, y) { var c = T().cellAt(b, x, y); return c && c !== 'river' && c !== 'wall' && c !== 'gate' && !b.units.some(function (u) { return u.hp > 0 && u.x === x && u.y === y; }); }
  /** 지휘관 곁 빈 칸(가까운 순 · 자기 편 쪽 열 먼저) */
  function spot(b, o) {
    var best = null, bd = 1e9, x, y, back = o.side === 'me' ? -1 : 1;
    for (y = 0; y < b.rows; y++) { for (x = 0; x < b.cols; x++) {
      if (!free(b, x, y)) { continue; }
      var d = Math.abs(x - o.x) + Math.abs(y - o.y) + ((x - o.x) * back > 0 ? 0.3 : 0) + (x - o.x === 0 ? 0.1 : 0);
      if (d < bd) { bd = d; best = [x, y]; }
    } }
    return best;
  }
  function merc(b, o, n, arm, hp) {
    var u = { uid: o.side + ':m' + o.id + '#' + n, id: '', side: o.side, kind: 'troop', merc: true, cmd: o.uid, hp: hp, max: hp, atk: 9, def: 1, mov: 2, rng: 1,
      x: o.x, y: o.y, moved: false, acted: false, fx: o.fx, fy: 0, arm: arm };
    if (arm === 'cav') { u.mov = 3; } else if (arm === 'bow') { u.rng = 2; } else { u.def += 2; }
    var p = spot(b, o);
    if (!p) { return null; }
    u.x = p[0]; u.y = p[1];
    return u;
  }
  function setup(b, opts) {
    if (!on() || !b.srpg) { return; }
    opts = opts || {};
    var st = opts.stats, sides = ['me', 'foe'], pool = { me: opts.myTroops || [], foe: opts.foeTroops || [] };
    sides.forEach(function (sd) {
      var offs = b.units.filter(function (u) { return u.side === sd && u.kind === 'officer'; });
      if (!offs.length) { return; }   // 장수 없는 편은 옛 부대 그대로
      var total = pool[sd].reduce(function (s, x) { return s + (+x || 0); }, 0) || 3000 * offs.length;
      b.units = b.units.filter(function (u) { return !(u.side === sd && u.kind === 'troop'); });
      var hp = Math.max(20, Math.min(60, Math.round(18 + total / (offs.length * PER) / 50)));
      if (sd === 'me' && opts.mercMul) { hp = Math.round(hp * opts.mercMul); }   // 장 흐름 — 내 용병은 진영에서 다진 정예
      var fa = sd === 'foe' ? foeArms(b.seed, offs.map(function (o) { return o.id; })) : null;
      offs.forEach(function (o, i) {
        var c = cmdOf(o.id, st);
        o.cmdR = 2 + Math.floor(c / 45); o.cmdA = Math.round(6 + c / 10); o.squad = i + 1;
        var arms = sd === 'me' ? ((opts.mercs || {})[o.id] || [ARMS[i % 3], ARMS[(i + 1) % 3], ARMS[(i + 2) % 3]]) : fa[i];
        for (var k = 0; k < (sd === 'me' && opts.mercN ? opts.mercN : PER); k++) { var m = merc(b, o, k, ARMS.indexOf(arms[k]) >= 0 ? arms[k] : 'spear', hp); if (m) { m.squad = o.squad; b.units.push(m); } }
      });
    });
    b.command = true;
  }
  function boss(b, u) { if (!u || !u.cmd) { return null; } var o = T().unit(b, u.cmd); return o && o.hp > 0 ? o : null; }
  function inCmd(b, u) { var o = boss(b, u); return o && Math.abs(o.x - u.x) + Math.abs(o.y - u.y) <= o.cmdR ? o : null; }
  function mods(b, att, tgt, out) {
    if (!b.command) { return; }
    var o = inCmd(b, att), k = knob('rtk.cmdAura', 100) / 100; if (o && k) { out.push(['지휘', Math.round(o.cmdA * k)]); }
    o = inCmd(b, tgt); if (o && k) { out.push(['지휘', -Math.round(o.cmdA * k)]); }
  }
  function counter(b, a, t) {
    var cm = knob('rtk.cmdCounter', COUNTER_MUL * 100) / 100;
    if (!b.command || !cm || t.hp <= 0 || a.hp <= 0 || t.confused || Math.abs(a.x - t.x) + Math.abs(a.y - t.y) !== 1) { return null; }
    if (a.noCounter) { return null; }   // W-0457 비장 — 맞붙어 쳐도 반격 안 받음
    if (t.skill && t.skill.key === 'bangyeok' && global.DG.heroSkill && global.DG.heroSkill.on()) { return null; }   // 고유 스킬 반격이 대신
    var ch = T().hitChanceB(b, t, a), hit = T().hash(b.seed, 'ct#' + b.log.length) * 100 < ch, d = 0;
    if (hit) { d = Math.max(1, Math.round(t.atk * (C().tuned ? +C().tuned('rtk.tacticsDmg', 2) : 2) * cm * (0.8 + T().hash(b.seed, 'cd#' + b.log.length) * 0.4))); a.hp = Math.max(0, a.hp - d); }
    b.log.push({ t: b.turn, a: t.uid, to: a.uid, hit: hit, dmg: d, ch: ch, counter: true });
    return { hit: hit, dmg: d, killed: a.hp <= 0 };
  }
  function sweep(b) {
    if (!b.command) { return; }
    b.units.forEach(function (u) {
      if (u.merc && u.hp > 0) { var o = T().unit(b, u.cmd); if (o && o.hp <= 0) { u.hp = 0; u.fled = true; (b.fled = b.fled || []).push(u.uid); } }
    });
  }
  function turnStart(b) {
    if (!b.command) { return; }
    b.units.forEach(function (u) { var o = boss(b, u); if (o && u.hp > 0 && Math.abs(o.x - u.x) + Math.abs(o.y - u.y) === 1) { u.hp = Math.min(u.max, u.hp + Math.round(u.max * RESUPPLY)); } });
  }
  /** 내 턴 끝 — 손대지 않은 내 용병을 AI 로(actAuto) */
  function autoMercs(b) {
    if (!b.command || b.done || !on()) { return 0; }
    var n = 0;
    b.units.forEach(function (u) { if (u.merc && u.side === 'me' && u.hp > 0 && !u.moved && !u.acted && !b.done) { T().actAuto(b, u); n++; } });
    return n;
  }
  /** 지휘 범위 칸 {'x,y':1} — 장수를 고르면 그 범위, 용병을 고르면 그 지휘관 범위 */
  function range(b, uid) {
    var out = {}, u = uid ? T().unit(b, uid) : null, o = u && u.kind === 'officer' ? u : boss(b, u), x, y;
    if (!b.command || !o || !o.cmdR) { return out; }
    for (y = 0; y < b.rows; y++) { for (x = 0; x < b.cols; x++) { if (Math.abs(x - o.x) + Math.abs(y - o.y) <= o.cmdR) { out[x + ',' + y] = 1; } } }
    return out;
  }
  /** AI 가 고를 때 지휘관 덤(%p) — 지휘관을 잡으면 휘하가 흩어지니까 */
  function prio(b, t) { return b.command && t.kind === 'officer' ? knob('rtk.cmdPrio', 10) : 0; }
  function nameOf(b, u, offName) {
    if (!u.merc) { return null; }
    var o = T().unit(b, u.cmd);
    return (o ? offName(o.id) + ' 휘하 ' : '') + (ARM_FULL[u.arm] || '용병');
  }

  /** 장수 카드 한 줄 — 지휘관 = 범위·덤·남은 휘하, 용병 = 지휘관·범위 안팎 */
  function cardLine(b, u, offName) {
    if (!b.command) { return ''; }
    if (u.kind === 'officer' && u.cmdR) { var n = b.units.filter(function (m) { return m.cmd === u.uid && m.hp > 0; }).length; return '<br><span style="color:#f3d27a">⚑ 지휘 ' + u.cmdR + '칸 · 휘하 명중 ±' + u.cmdA + '%p · 남은 용병 ' + n + '</span>'; }
    if (u.merc) { var o = T().unit(b, u.cmd); return '<br><span style="color:#f3d27a">⚑ 지휘관 ' + (o ? offName(o.id) : '?') + (inCmd(b, u) ? ' — 범위 안(±' + o.cmdA + '%p)' : ' — 범위 밖') + '</span>'; }
    return '';
  }

  global.DG = global.DG || {};
  global.DG.command = { on: on, PER: PER, ARMS: ARMS, ARM_FULL: ARM_FULL, COUNTER_MUL: COUNTER_MUL, setup: setup, foeArms: foeArms, mods: mods, counter: counter,
    sweep: sweep, turnStart: turnStart, autoMercs: autoMercs, range: range, prio: prio, nameOf: nameOf, cardLine: cardLine, inCmd: inCmd };
})(typeof window !== 'undefined' ? window : this);
