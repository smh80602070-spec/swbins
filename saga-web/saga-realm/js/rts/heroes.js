/**
 * RTS 영웅 (W-0035, P4b) — 장수 한 명이 유닛이 된다. 순수 함수(화면·저장과 무관), 난수 없음.
 *
 * 장수 자료는 판의 도감(`DG.data.heroes`, 희귀도 4 이상)에서 읽는다 — 이름은 이미 가명이다. 능력치 → 체력·공격·속도, 지력 → 일격 위력.
 * 영웅은 군영에서 모집(큐 한 칸, 200틱), 최대 3명(큐 포함). 유닛 칸: u.t='hero' · u.hid(장수 id) · u.st(능력치, 저장 안 함) · u.mhp(최대 체력).
 */
(function (global) {
  'use strict';

  var COST = { gold: 150, food: 50 }, TRAIN = 200, MAX = 3, MIN_RARITY = 4;
  function R() { return global.DG.rts; }

  var cache = null;
  /** 모집 후보 — 희귀도 4 이상, id 순(같은 도감이면 늘 같은 순서) */
  function roster() {
    var list = (global.DG.data && global.DG.data.heroes) || [];
    if (cache && cache.n === list.length) { return cache.list; }
    cache = { n: list.length, list: list.filter(function (h) { return h.rarity >= MIN_RARITY && h.stats; }).sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }) };
    return cache.list;
  }
  function find(hid) { var l = roster(), i; for (i = 0; i < l.length; i++) { if (l[i].id === hid) { return l[i]; } } return null; }

  /** 장수 id → 전투 능력(없으면 평범한 영웅) — 체력 70+통솔×1.3 · 공격 5+무력×0.13 · 속도 2.4+무력/200 · 사거리 1.4 */
  function statsOf(hid) {
    var h = find(hid), st = h ? h.stats : { might: 70, wisdom: 60, command: 70 };
    return { name: h ? h.name : '영웅', hp: Math.round(70 + st.command * 1.3), atk: Math.round((5 + st.might * 0.13) * 10) / 10, range: 1.4,
      speed: Math.round((2.4 + st.might / 200) * 100) / 100, wis: st.wisdom, icon: h && h.emoji ? h.emoji : '⭐', color: '#ffd36a', beats: null, gold: COST.gold, food: COST.food, train: TRAIN };
  }

  /** 지금 판에 있는 영웅 + 큐에 선 영웅 */
  function countAll(s) {
    var n = 0, id, i;
    for (id in s.units) { if (s.units[id].t === 'hero') { n++; } }
    for (id in s.queues) { for (i = 0; i < s.queues[id].length; i++) { if (s.queues[id][i].t === 'hero') { n++; } } }
    return n;
  }
  function taken(s, hid) {
    var id, i;
    for (id in s.units) { if (s.units[id].hid === hid) { return true; } }
    for (id in s.queues) { for (i = 0; i < s.queues[id].length; i++) { if (s.queues[id][i].hid === hid) { return true; } } }
    return false;
  }
  /** 다음 장수 — 판 시드와 모집 횟수로 정해 후보를 돈다(이미 나온 사람은 건너뜀) */
  function pickFor(s) {
    var l = roster(), i, h;
    if (!l.length) { return null; }
    for (i = 0; i < l.length; i++) { h = l[((s.seed >>> 0) + (s.heroN | 0) * 7 + i) % l.length]; if (!taken(s, h.id)) { return h; } }
    return null;
  }

  /** 군영 큐에 영웅을 넣는다 — { ok, why }. 비용은 넣을 때 낸다 */
  function train(s, barracksId) {
    var b = s.buildings[barracksId], q, h;
    if (!b || b.t !== 'barracks') { return { ok: false, why: '군영이 아니다' }; }
    if (!b.conn) { return { ok: false, why: '도로로 이어진 군영만 돈다' }; }
    q = s.queues[barracksId] || (s.queues[barracksId] = []);
    if (q.length >= R().units.QUEUE_MAX) { return { ok: false, why: '큐가 가득 찼다' }; }
    if (countAll(s) >= MAX) { return { ok: false, why: '영웅은 ' + MAX + '명까지' }; }
    if (s.res.gold < COST.gold) { return { ok: false, why: '금이 모자란다' }; }
    if (s.res.food < COST.food) { return { ok: false, why: '식량이 모자란다' }; }
    h = pickFor(s);
    if (!h) { return { ok: false, why: '모집할 장수가 없다' }; }
    s.res.gold -= COST.gold; s.res.food -= COST.food; s.heroN = (s.heroN | 0) + 1;
    q.push({ t: 'hero', left: TRAIN, hid: h.id });
    return { ok: true, why: '' };
  }

  function ico(n, e) { var A = global.DG.rts.art; return A && A.icon ? A.icon(n, e) : e; }
  function recruitBtn(s) {
    var h = pickFor(s), nm = h ? h.name : '';
    return '<button data-hero="1" title="영웅 모집 ' + COST.gold + '금 ' + COST.food + '식량 — 장수 한 명(능력치가 체력·공격이 되고 Q 로 일격). ' + (nm ? '다음: ' + nm : '') + '"><span>' + ico('hero', '⭐') + '</span><small>영웅<br>' + COST.gold + '금 ' + COST.food + '식</small></button>';
  }
  function skillBtn(s, sel) {
    var id, n = 0, cd = 0, u;
    for (id in sel) { u = s.units[id]; if (u && u.t === 'hero') { n++; cd = Math.max(cd, u.skillCd | 0); } }
    if (!n) { return ''; }
    return '<div class="sl-btns"><button data-skill="1" title="일격 — 둘레 2.5칸 적에게 큰 피해(쿨다운 15초) · Q"><span>' + ico('strike', '💥') + '</span><small>일격 Q<br>' + (cd > 0 ? Math.ceil(cd / 10) + '초' : '준비') + '</small></button></div>';
  }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.heroes = { COST: COST, TRAIN: TRAIN, MAX: MAX, roster: roster, find: find, statsOf: statsOf, countAll: countAll, pickFor: pickFor, train: train, recruitBtn: recruitBtn, skillBtn: skillBtn };
})(typeof window !== 'undefined' ? window : this);
