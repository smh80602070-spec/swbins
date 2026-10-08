/**
 * 사가천하 — 이정표 (PLAN §5-4) · rtk.js 에서 떼어 냄(R-4 2026-10-08, 1,508줄 → 1,500줄 아래)
 * ---------------------------------------------------------------
 * 같은 이름표(`DG.rtk`)에 붙인다 — 부르는 쪽(ui-rtk·admin·진단)은 그대로 `DG.rtk.milestoneView()` 등.
 * rtk.js 안에서 부르던 넷(ensureMilestone·coreCount·milestoneView·checkMilestones)은 `global.DG.rtk.` 로 부른다.
 * 반드시 rtk.js 바로 뒤에 싣는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var CD = global.DG.cityData;
  var FD = global.DG.forceData;
  var R = global.DG.rtk;
  function state() { return R.state(); }

  /* ── 이정표 (PLAN §5-4) ─────────────────────────────────
   * `save.rtk.milestone = { idx, at, base:{core, cities} }` — idx 는 **깬 단 수**(0~5), at 은 마지막으로
   * 깬 달(turn), base 는 시작 때의 성 수(사다리의 눈금). 옛 세이브는 칸이 없으면 지금을 기준으로 0 에서 시작한다.
   * 표(`FD.milestonesFor`)는 조건과 보상만 갖고, 판정·지급은 여기 한 곳이다.
   */

  function coreCount(st, forceId) {
    var n = 0, k;
    for (k in st.cities) {
      if (!Object.prototype.hasOwnProperty.call(st.cities, k)) { continue; }
      var d = CD.find(k);
      if (st.cities[k].force === forceId && d && !d.garrison) { n++; }
    }
    return n;
  }

  function ensureMilestone(st) {
    if (st.milestone || !st.started || !st.me) { return; }
    var mine = 0, k;
    for (k in st.cities) {
      if (Object.prototype.hasOwnProperty.call(st.cities, k) && st.cities[k].force === st.me) { mine++; }
    }
    st.milestone = { idx: 0, at: st.turn || 0, base: { core: coreCount(st, st.me), cities: mine } };
  }

  /** 이 판의 이정표 표(조건이 풀린 다섯 단) */
  function milestones() {
    var st = state();
    ensureMilestone(st);
    return FD.milestonesFor(st.scen || '194', st.milestone ? st.milestone.base.core : 0);
  }

  /** 조건 하나의 진척 — { cur, need, ok, note } (막대는 cur/need) */
  function condProgress(cond) {
    var st = state(), mine = R.citiesOf(st.me), i, n = 0, tot = 0;
    if (cond.c === 'cities') {
      return { cur: mine.length, need: cond.n, ok: mine.length >= cond.n };
    }
    if (cond.c === 'core') {
      n = coreCount(st, st.me);
      return { cur: n, need: cond.n, ok: n >= cond.n };
    }
    if (cond.c === 'prov') {
      for (i = 0; i < CD.CITIES.length; i++) {
        if (CD.CITIES[i].prov !== cond.prov) { continue; }
        tot++;
        if (st.cities[CD.CITIES[i].id] && st.cities[CD.CITIES[i].id].force === st.me) { n++; }
      }
      var need = cond.all ? tot : 1;
      return { cur: Math.min(n, need), need: need, ok: n >= need };
    }
    if (cond.c === 'city') {
      var has = st.cities[cond.id] && st.cities[cond.id].force === st.me ? 1 : 0;
      return { cur: has, need: 1, ok: !!has };
    }
    if (cond.c === 'rank') {
      var rk = R.ranking(), pos = 0;
      for (i = 0; i < rk.length; i++) { if (rk[i].id === st.me) { pos = i + 1; break; } }
      return { cur: Math.min(mine.length, cond.min), need: cond.min,
               ok: !!pos && pos <= cond.n && mine.length >= cond.min,
               note: pos ? (pos + '위') : '' };
    }
    return { cur: 0, need: 1, ok: false };
  }

  /** 화면용 — 지금 겨냥하는 이정표와 진척. 다 깼으면 cur:null */
  function milestoneView() {
    var st = state();
    if (!st.started || !st.milestone) { return null; }
    var list = milestones(), idx = st.milestone.idx;
    var out = { idx: idx, total: list.length, cur: null, progress: null, list: list };
    if (idx < list.length) {
      out.cur = list[idx];
      out.progress = condProgress(list[idx].cond);
    }
    return out;
  }

  function awardMilestone(m, idx) {
    var st = state(), f = R.myForce(), off = global.DG.off, ID = global.DG.item;
    var got = { idx: idx, name: m.name, desc: m.desc, gold: m.gold || 0, found: [], relic: null };
    if (f && m.gold) { f.gold += m.gold; }
    var i;
    for (i = 0; i < (m.reveal || 0); i++) {
      var h = R.revealFree('이정표 「' + m.name + '」 — 소문이 돌아');
      if (h) { got.found.push(h.name); }
    }
    if (m.relic && ID) {
      var it = ID.randomItem(), team = off.ofForce(st.me), who = null;
      for (i = 0; i < team.length; i++) { if (!off.rec(team[i].id).item) { who = team[i]; break; } }
      if (!who && team.length) { who = team[0]; }
      if (who) {
        off.equip(who.id, it.id);
        got.relic = { emoji: it.emoji, name: it.name, who: who.name };
      }
    }
    core.log('🚩 이정표 ' + (idx + 1) + '/5 「' + m.name + '」 — ' + m.desc +
      ' (금 +' + core.fmt(got.gold) + ')', 'good');
    return got;
  }

  /**
   * 다음 달로 넘어갈 때(그리고 어드민이 부를 때) 깬 이정표를 지급한다.
   * 한 번에 여러 단을 깨면 차례로 모두 준다. 승패가 난 판은 세지 않는다.
   * @returns 이번에 깬 단들의 결과 배열
   */
  function checkMilestones() {
    var st = state(), out = [];
    if (!st.started || st.result || !st.milestone) { return out; }
    var list = milestones();
    while (st.milestone.idx < list.length) {
      var m = list[st.milestone.idx];
      if (!condProgress(m.cond).ok) { break; }
      out.push(awardMilestone(m, st.milestone.idx));
      st.milestone.idx += 1;
      st.milestone.at = st.turn;
    }
    if (out.length) { core.emit('rtk:milestone', out); core.emit('changed'); }
    return out;
  }

  R.milestones = milestones; R.milestoneView = milestoneView; R.condProgress = condProgress; R.checkMilestones = checkMilestones;
  R.ensureMilestone = ensureMilestone; R.coreCount = coreCount;
})(window);
