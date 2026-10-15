/**
 * 4종횡 달 사명 — 달마다 하나, 놓쳐도 벌칙 없는 월간 목표 (W-0242, 재미표준 H "계절/월간 1개")
 * ---------------------------------------------------------------
 * 이번 달(YYYY-MM) 안에 어느 사냥터에서든 몹 TARGET 마리 — **이달의 사냥터**에서 잡으면 두 마리로 센다.
 * 다 채우면 그 달의 '달 문장' 하나를 모은다(문장 = 도감처럼 모으는 것, 힘은 안 붙는다 — 보상은 도감·외형 쪽, 규격 H).
 * 이달의 사냥터는 달 열쇠 해시로 고른다(앞쪽 사냥터 여섯 중 — 레벨 낮아도 갈 수 있는 곳이 늘 섞이게).
 * 달이 바뀌면 셈은 새로 — 지난달 못 채워도 잃는 것 없다.
 *
 * 세이브 `save.side.monthly = { key, n, done, badges: [달 열쇠…] }` — 읽기는 세이브를 만들지 않는다.
 * 손잡이 `monthly.target`(300) · `monthly.featMul`(2).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var POOL = ['field', 'forest', 'cave', 'gorge', 'ruin', 'deepcave'];

  function TARGET() { return Math.max(1, Math.round(core.tuned('monthly.target', 300))); }
  function FEAT_MUL() { return Math.max(1, Math.round(core.tuned('monthly.featMul', 2))); }

  /** 그 날짜의 달 열쇠 'YYYY-MM' — 순수 */
  function keyOf(d) {
    d = d || new Date();
    var m = d.getMonth() + 1;
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m;
  }
  function hash(s) { var h = 2166136261, i; for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  /** 그 달의 이달의 사냥터 열쇠 — 순수 */
  function featuredOf(key) { return POOL[hash('moon|' + key) % POOL.length]; }

  /** 이번 달 상태(읽기만 — 세이브를 안 만든다) */
  function view(d) {
    var key = keyOf(d), st = core.save && core.save.side && core.save.side.monthly, cur = st && st.key === key;
    var SD = global.DG.sideData, fk = featuredOf(key), stg = SD && SD.stage ? SD.stage(fk) : null;
    return { key: key, featured: fk, featuredName: stg ? stg.name : fk, n: cur ? st.n : 0, target: TARGET(), done: !!(cur && st.done), badges: st && st.badges ? st.badges.length : 0 };
  }

  function state(d) {
    var side = core.save.side = core.save.side || {}, key = keyOf(d), st = side.monthly;
    if (!st) { st = side.monthly = { key: key, n: 0, done: false, badges: [] }; }
    if (st.key !== key) { st.key = key; st.n = 0; st.done = false; }   // 새 달 — 셈만 새로, 모은 문장은 그대로
    if (!st.badges) { st.badges = []; }
    return st;
  }

  /** 몹 하나를 잡았다 — 보스 아님. 채우면 문장 하나 */
  function onKill(stageKey, d) {
    var st = state(d);
    if (st.done) { return 0; }
    var add = stageKey === featuredOf(st.key) ? FEAT_MUL() : 1;
    st.n = Math.min(TARGET(), st.n + add);
    if (st.n >= TARGET()) {
      st.done = true;
      if (st.badges.indexOf(st.key) < 0) { st.badges.push(st.key); }
      core.log('🌙 달 사명 완료 — ' + st.key + ' 달 문장을 모았다(모은 문장 ' + st.badges.length + ')', 'good');
      core.emit('toast', '🌙 달 사명 완료 · 달 문장 ' + st.badges.length);
      core.emit('monthly:done', { key: st.key, badges: st.badges.length });
    }
    return add;
  }

  /** 한 줄(카드·목표판) */
  function line(d) {
    var v = view(d);
    return '🌙 달 사명 ' + (v.done ? '완료' : v.n + '/' + v.target) + ' · 이달의 사냥터 ' + v.featuredName + '(두 배)' + (v.badges ? ' · 달 문장 ' + v.badges : '');
  }

  core.on('side:kill', function (e) { if (e && !e.boss) { onKill(e.stage); } });

  global.DG = global.DG || {};
  global.DG.monthly = { keyOf: keyOf, featuredOf: featuredOf, view: view, onKill: onKill, line: line, POOL: POOL, TARGET: TARGET };
})(window);
