/**
 * 편성 — 동행 다섯 = 들판 명단 앞 넷 + 대기 하나 · 편성 여러 벌 (PLAN §5 ⑲-15·18, saga-godot PLAN 106 ㉝㊱)
 * ---------------------------------------------------------------
 * 자리 순서가 곧 `save.party` 순서라(들판 전투는 앞 FIELD 명, 숫자키 1~4) 세이브 모양은 그대로다.
 *   넣기       빈자리면 끝에, 꽉 찼으면 마지막(다섯째) 자리와 바뀐다
 *   빼기       자리가 비고 동행이 준다
 *   앞 자리로  바로 앞 사람과 바뀐다
 *   들판으로   대기(다섯째)를 넷째와 바꾼다
 * 싸우는 중이면(`fieldCombat.inCombat` — 30m 안에 나를 쫓거나 치는 적·방금 싸움) 막는다 — 교체 쿨·기력이 흐트러진다.
 * 판정은 순수(`plan`·`pick`) — 세이브를 바꾸는 쪽은 `apply`·`use` 둘.
 *
 * 편성 여러 벌(⑲-18, saga-godot 106 ㊱) — 칸 PRESETS 개. 지금 명단(`save.party`)이 늘 정본이라 지금 칸은 읽을 때마다
 * 지금 명단으로 적힌다(`sync` — 어디서 명단이 바뀌든). 다른 칸을 고르면 그 칸 목록이 지금 명단(없는 인물·겹침 뺌),
 * 빈 칸이면 나 혼자. 세이브 `partyPresets`(목록 넷)·`partyPreset`(0~) — 없으면 지금 명단이 1번.
 */
(function (global) {
  'use strict';

  var MAX = 5, FIELD = 4;
  function core() { return global.DG.core; }
  function party() { var s = core().save; if (!Array.isArray(s.party)) { s.party = []; } return s.party; }

  /**
   * 순수 — 명단 list 에 op(put·drop·up·field)를 id 로 하면 { ok, list, why?, swap? }.
   * swap 은 자리를 내준 사람 id(넣기·앞으로·들판으로)
   */
  function plan(list, op, id) {
    var L = (list || []).slice(), i = L.indexOf(id), sw;
    if (op === 'put') {
      if (i >= 0) { return { ok: false, list: L, why: '이미 동행 중' }; }
      if (L.length < MAX) { L.push(id); return { ok: true, list: L }; }
      sw = L[MAX - 1]; L[MAX - 1] = id;
      return { ok: true, list: L, swap: sw };
    }
    if (i < 0) { return { ok: false, list: L, why: '동행이 아님' }; }
    if (op === 'drop') { L.splice(i, 1); return { ok: true, list: L }; }
    if (op === 'up') {
      if (i === 0) { return { ok: false, list: L, why: '이미 맨 앞' }; }
      sw = L[i - 1]; L[i - 1] = id; L[i] = sw;
      return { ok: true, list: L, swap: sw };
    }
    if (op === 'field') {
      if (i < FIELD) { return { ok: false, list: L, why: '이미 들판 명단' }; }
      sw = L[FIELD - 1]; L[FIELD - 1] = id; L[i] = sw;
      return { ok: true, list: L, swap: sw };
    }
    return { ok: false, list: L, why: '모르는 일' };
  }

  /** 지금 싸우는 중인가 — ⑲-18 inCombat(없으면 옛 engaged) */
  function busy() {
    var F = global.DG.fieldCombat, S = F && F.state ? F.state() : null, p = core().save.player.pos;
    if (!S) { return false; }
    return !!(F.inCombat ? F.inCombat(S, p.x, p.y) : (F.engaged && F.engaged(S)));
  }

  /* ── 편성 여러 벌(⑲-18) ─────────────────────────────── */

  var PRESETS = 4;
  /**
   * 순수 — 칸 목록 list 를 지금 명단으로 쓸 수 있게: 가진 인물(has(id))만·겹침 뺌·MAX 까지
   */
  function pick(list, has) {
    var out = [];
    (list || []).forEach(function (id) { if (typeof id === 'string' && out.indexOf(id) < 0 && out.length < MAX && (!has || has(id))) { out.push(id); } });
    return out;
  }
  function owned(id) {
    var s = core().save, D = global.DG.data;
    return !!(s.dex && s.dex.heroes && s.dex.heroes[id] && (!D || !D.find || D.find(id)));
  }
  /** ⑲-26 탐사 나간 동료(dispatch.js) — 편성에 못 넣는다 */
  function away(id) { var DP = global.DG.dispatch; return !!(DP && DP.away && DP.away(id)); }
  /** 칸 넷과 지금 칸 — 읽을 때마다 지금 칸을 지금 명단으로 적는다. 옛 세이브는 지금 명단이 1번 */
  function sync() {
    var s = core().save, P = party();
    if (!Array.isArray(s.partyPresets)) { s.partyPresets = []; }
    while (s.partyPresets.length < PRESETS) { s.partyPresets.push([]); }
    s.partyPresets.length = PRESETS;
    for (var i = 0; i < PRESETS; i++) { if (!Array.isArray(s.partyPresets[i])) { s.partyPresets[i] = []; } }
    var at = s.partyPreset;
    if (typeof at !== 'number' || at < 0 || at >= PRESETS || at !== Math.floor(at)) { at = s.partyPreset = 0; }
    s.partyPresets[at] = P.slice();
    return { list: s.partyPresets, at: at };
  }
  function presetAt() { return sync().at; }
  /** 칸 i 의 목록(지금 칸이면 지금 명단) */
  function presetOf(i) { var q = sync(); return q.list[i] ? q.list[i].slice() : []; }
  /**
   * 칸 i 로 바꾼다 — 지금 명단은 지금 칸에 남고, 칸 i 목록이 지금 명단이 된다. 들판 전투는 첫 자리 인물이 앞으로.
   * 막히면 { ok:false, why }
   */
  function use(i) {
    if (typeof i !== 'number' || i < 0 || i >= PRESETS) { return { ok: false, why: '없는 편성' }; }
    var q = sync();
    if (i === q.at) { return { ok: false, why: '이미 편성 ' + (i + 1), same: true }; }
    if (busy()) { return { ok: false, why: '싸우는 중에는 편성을 바꿀 수 없다' }; }
    var s = core().save, next = pick(q.list[i], function (id) { return owned(id) && !away(id); });
    s.party = next; s.partyPreset = i; s.partyPresets[i] = next.slice();
    var F = global.DG.fieldCombat, S = F && F.state ? F.state() : null;
    if (S && F.reparty) { F.reparty(S, next); S.active = 0; }
    core().emit('party:changed', { op: 'preset', preset: i });
    core().persist();
    return { ok: true, preset: i, list: next.slice() };
  }
  /** 세이브에 한다 — 막히면 { ok:false, why } */
  function apply(op, id) {
    if (busy()) { return { ok: false, why: '싸우는 중에는 명단을 바꿀 수 없다' }; }
    if (op === 'put' && away(id)) { return { ok: false, why: '탐사 나간 동료다 — 역참 게시판에서 부르거나 받기' }; }
    var r = plan(party(), op, id);
    if (!r.ok) { return r; }
    core().save.party = r.list;
    if (op === 'drop' && core().save.petEquip) { delete core().save.petEquip[id]; }
    core().emit('party:changed', { op: op, id: id, swap: r.swap || null });
    core().persist();
    return r;
  }
  /** 자리 n(0부터)이 들판 명단인가 */
  function onField(id) { var i = party().indexOf(id); return i >= 0 && i < FIELD; }
  /** 이 사람을 넣으면 누구와 바뀌나(꽉 찼을 때) — 없으면 null */
  function putSwap(id) { var r = plan(party(), 'put', id); return r.ok && r.swap ? r.swap : null; }

  global.DG = global.DG || {};
  global.DG.formation = { MAX: MAX, FIELD: FIELD, plan: plan, apply: apply, busy: busy, onField: onField, putSwap: putSwap,
    PRESETS: PRESETS, pick: pick, sync: sync, presetAt: presetAt, presetOf: presetOf, use: use };
})(window);
