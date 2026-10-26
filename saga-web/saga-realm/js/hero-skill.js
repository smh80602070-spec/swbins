/**
 * 5천하 장수 고유 스킬 (W-0453, 사용자 10-26 「장수마다 특정 스킬이 있고 장비 아이템도 있고 해야해」)
 * ---------------------------------------------------------------
 * 장수 500명 각자에 격자 SRPG 에서 실제로 터지는 스킬 하나 — 능력치 모양(무·지·통)·특성으로 갈래를 고르고 id 해시로 그 안에서 하나(같은 장수는 늘 같다).
 * ★5 는 「·극」(수치 1.5배). 이름·수치는 이 판 것(원작 특기 이름을 옮기지 않음). three·DOM 없이 돈다(진단이 본다).
 *
 *   DG.heroSkill.of(id)               { key, name, desc, k(세기 배수) } | null
 *   DG.heroSkill.unit(u)              officerUnit 끝 — u.skill 을 달고 늘 붙는 것(이동·사거리·체력)을 얹고 장비(DG.realmGear)도
 *   DG.heroSkill.mods(b, att, tgt, out)  hitMods 끝 — 명중 보정 [이름, %p]
 *   DG.heroSkill.dmg(b, a, t, dmg)    친 피해에 — 치명·선봉·호령·철벽·불굴
 *   DG.heroSkill.after(b, a, t, hit, dmg)  친 뒤 — 흡혈·반격·연격·처단 · 터진 이름 목록
 *   DG.heroSkill.turnStart(b)         내 턴이 열릴 때 — 치유·인덕(양쪽)
 * 손잡이 rtk.heroSkill(1, 0 = 끔).
 */
(function (global) {
  'use strict';
  function C() { return global.DG.core; }
  function on() { var c = C(); return !(c && c.tuned && !+c.tuned('rtk.heroSkill', 1)); }
  function T() { return global.DG.tactics; }

  /* 갈래별 스킬 — p = 기본 세기(확률 % · 배수 · 양) */
  var SK = {
    ilgyeok:  { name: '일격',   g: 'might', p: 22, desc: '공격 22% 확률로 피해 1.6배' },
    yeongyeok:{ name: '연격',   g: 'might', p: 28, desc: '공격 뒤 28% 확률로 한 번 더 친다' },
    dolpa:    { name: '돌파',   g: 'might', p: 30, desc: '부대를 칠 때 피해 +30%' },
    bangyeok: { name: '반격',   g: 'might', p: 60, desc: '맞고 버티면 사거리 안의 공격자에게 60% 힘으로 되받아친다' },
    maengjin: { name: '맹진',   g: 'might', p: 1,  desc: '이동 +1' },
    heupyeol: { name: '흡혈',   g: 'might', p: 35, desc: '준 피해의 35% 만큼 체력 회복' },
    cheodan:  { name: '처단',   g: 'might', p: 1,  desc: '적을 쓰러뜨리면 한 턴에 한 번 다시 움직인다' },
    myeonggung:{ name: '명궁',  g: 'wisdom', p: 15, desc: '두 칸 떨어진 적을 칠 때 명중 +15%p' },
    myochaek: { name: '묘책',   g: 'wisdom', p: 1,  desc: '책략 한 판 +1번' },
    ganpa:    { name: '간파',   g: 'wisdom', p: 10, desc: '모든 공격 명중 +10%p' },
    jinbeop:  { name: '진법',   g: 'wisdom', p: 8,  desc: '곁(상하좌우)의 아군을 노리는 적 명중 −8%p' },
    chiyu:    { name: '치유',   g: 'wisdom', p: 10, desc: '내 턴이 열릴 때 곁 아군 체력 +10' },
    sageori:  { name: '원사',   g: 'wisdom', p: 1,  desc: '사거리 +1(최대 3)' },
    cheolbyeok:{ name: '철벽',  g: 'command', p: 25, desc: '받는 피해 −25%' },
    horyeong: { name: '호령',   g: 'command', p: 15, desc: '곁 아군이 주는 피해 +15%' },
    indeok:   { name: '인덕',   g: 'command', p: 8,  desc: '내 턴이 열릴 때 자기 체력 +8' },
    suho:     { name: '수호',   g: 'command', p: 10, desc: '나를 노리는 적 명중 −10%p' },
    gima:     { name: '기마',   g: 'command', p: 10, desc: '이동 +1 · 뒤치기 명중 +10%p' },
    bulgul:   { name: '불굴',   g: 'command', p: 1,  desc: '쓰러질 피해를 한 판 한 번 체력 1로 버틴다' },
    seonbong: { name: '선봉',   g: 'command', p: 50, desc: '그 판 첫 공격 피해 +50%' }
  };
  var BY = { might: [], wisdom: [], command: [] };
  Object.keys(SK).forEach(function (k) { BY[SK[k].g].push(k); });

  function hashS(s) { var h = 2166136261, i; s = String(s); for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  var cache = {};
  /** 장수 → 스킬 — 가장 높은 능력 갈래(덕 특성은 통솔 갈래로), 갈래 안에서는 id 해시 */
  function of(id) {
    if (!id) { return null; }
    if (cache[id] !== undefined) { return cache[id]; }
    var D = global.DG.data, h = D && D.find ? D.find(id) : null, s = (h && h.stats) || null;
    if (!s) { cache[id] = null; return null; }
    var g = h.trait === 'virtue' ? 'command' : (s.wisdom >= s.might && s.wisdom >= s.command ? 'wisdom' : (s.might >= s.command ? 'might' : 'command'));
    var list = BY[g], key = list[hashS(id) % list.length], d = SK[key], top = (h.rarity || 0) >= 5;
    cache[id] = { key: key, name: d.name + (top ? '·극' : ''), desc: d.desc + (top ? ' (극 — 1.5배)' : ''), k: top ? 1.5 : 1, g: g };
    return cache[id];
  }
  function P(u, key) { return u && u.skill && u.skill.key === key ? SK[key].p * u.skill.k : 0; }
  function rnd(b, salt) { b.hsN = (b.hsN || 0) + 1; return T().hash(b.seed, 'hs' + salt + '#' + b.hsN); }
  function proc(b, u) { (b.hsProc = b.hsProc || []).push(u.skill.name); }
  function near(b, u, side) { return b.units.filter(function (o) { return o !== u && o.hp > 0 && o.side === side && Math.abs(o.x - u.x) + Math.abs(o.y - u.y) === 1; }); }

  function unit(u) {
    if (!u || u.kind !== 'officer') { return u; }
    if (on()) {
      u.skill = of(u.id);
      if (u.skill) {
        var k = u.skill.key;
        if (k === 'maengjin' || k === 'gima') { u.mov += 1; }
        if (k === 'sageori') { u.rng = Math.min(3, u.rng + 1); }
      }
    }
    var G = global.DG.realmGear;
    return G && G.apply ? G.apply(u) : u;
  }
  function mods(b, att, tgt, out) {
    if (!on()) { return; }
    var d = Math.abs(att.x - tgt.x) + Math.abs(att.y - tgt.y), v;
    if ((v = P(att, 'myeonggung')) && d >= 2) { out.push([att.skill.name, Math.round(v)]); }
    if ((v = P(att, 'ganpa'))) { out.push([att.skill.name, Math.round(v)]); }
    if ((v = P(att, 'gima')) && T().isBack && T().isBack(att, tgt)) { out.push([att.skill.name, Math.round(v)]); }
    if ((v = P(tgt, 'suho'))) { out.push([tgt.skill.name, -Math.round(v)]); }
    near(b, tgt, tgt.side).forEach(function (o) { var w = P(o, 'jinbeop'); if (w) { out.push([o.skill.name, -Math.round(w)]); } });
    if (att.gearHit) { out.push(['장비', att.gearHit]); }
  }
  function dmg(b, a, t, x) {
    if (!on()) { return x; }
    var v;
    if ((v = P(a, 'ilgyeok')) && rnd(b, 'crit') * 100 < v) { x *= 1.6; proc(b, a); }
    if ((v = P(a, 'dolpa')) && t.kind === 'troop') { x *= 1 + v / 100; proc(b, a); }
    if ((v = P(a, 'seonbong')) && !a.hsFirst) { a.hsFirst = 1; x *= 1 + v / 100; proc(b, a); }
    if (a.gearCrit && rnd(b, 'gcrit') * 100 < a.gearCrit) { x *= 1.5; }
    near(b, a, a.side).forEach(function (o) { var w = P(o, 'horyeong'); if (w) { x *= 1 + w / 100; } });
    if ((v = P(t, 'cheolbyeok'))) { x *= Math.max(0.3, 1 - v / 100); proc(b, t); }
    if (t.gearDef) { x *= Math.max(0.4, 1 - t.gearDef / 100); }
    x = Math.max(1, Math.round(x));
    if (P(t, 'bulgul') && !t.hsUg && t.hp - x <= 0 && t.hp > 1) { t.hsUg = 1; x = t.hp - 1; proc(b, t); }
    return x;
  }
  /** 친 뒤 — 흡혈·반격·연격·처단. 반격·연격은 attack 을 다시 부르지 않고 같은 셈(명중·피해)을 짧게 — 기록은 b.log 에 같은 꼴로 */
  function strike(b, a, t, mul, tag) {
    var ch = T().hitChanceB(b, a, t), hit = rnd(b, tag + 'h') * 100 < ch, d = 0;
    if (hit) { d = dmg(b, a, t, Math.max(1, Math.round(a.atk * (C().tuned ? C().tuned('rtk.tacticsDmg', 2) : 2) * (0.8 + rnd(b, tag + 'd') * 0.4) * mul))); t.hp = Math.max(0, t.hp - d); }
    b.log.push({ t: b.turn, a: a.uid, to: t.uid, hit: hit, dmg: d, ch: ch, skill: a.skill ? a.skill.name : '' });
    return hit;
  }
  function after(b, a, t, hit, d) {
    var out = b.hsProc || [], v;
    b.hsProc = [];
    if (!on()) { return out; }
    if (hit && (v = P(a, 'heupyeol')) && d > 0) { a.hp = Math.min(a.max, a.hp + Math.round(d * v / 100)); out.push(a.skill.name); }
    if (t.hp > 0 && (v = P(t, 'bangyeok')) && Math.abs(a.x - t.x) + Math.abs(a.y - t.y) <= t.rng) { out.push(t.skill.name); strike(b, t, a, v / 100, 'cnt'); }
    if (t.hp > 0 && a.hp > 0 && (v = P(a, 'yeongyeok')) && rnd(b, 'dbl') * 100 < v) { out.push(a.skill.name); strike(b, a, t, 1, 'dbl'); }
    if (t.hp <= 0 && a.hp > 0 && P(a, 'cheodan') && a.hsAgain !== b.turn) { a.hsAgain = b.turn; a.acted = false; a.moved = false; out.push(a.skill.name); }
    return out.concat(b.hsProc || []).filter(function (x, i, arr) { return arr.indexOf(x) === i; });
  }
  function turnStart(b) {
    if (!on()) { return; }
    b.units.forEach(function (u) {
      if (u.hp <= 0) { return; }
      var v;
      if ((v = P(u, 'indeok'))) { u.hp = Math.min(u.max, u.hp + Math.round(v)); }
      if ((v = P(u, 'chiyu'))) { near(b, u, u.side).forEach(function (o) { o.hp = Math.min(o.max, o.hp + Math.round(v)); }); }
    });
  }
  function plotsBonus(b) { if (!on()) { return 0; } return b.units.some(function (u) { return u.side === 'me' && u.hp > 0 && u.skill && u.skill.key === 'myochaek'; }) ? 1 : 0; }

  global.DG = global.DG || {};
  global.DG.heroSkill = { SK: SK, of: of, unit: unit, mods: mods, dmg: dmg, after: after, turnStart: turnStart, plotsBonus: plotsBonus, on: on };
})(typeof window !== 'undefined' ? window : this);
