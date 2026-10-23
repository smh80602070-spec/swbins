/**
 * 5천하 — 나라(國) 세 축: 국세(國勢)·국가 방침·법령 (W-0399 웹 역이식 — 정본 수치는 고돗 G-0329·G-0336·G-0321)
 * ---------------------------------------------------------------
 *   국세   🌫️ 난세 → 🧱 기틀 → 🏯 치세 → 🌅 성세. 다음 단계 = 우리 성 수(4·7·12) + 연구한 기술 마디(4·9·15) + 금(1500·3000·6000, 낸다).
 *          단계마다 금 수입·수확 +5%(경륜도 배율 자리에 더해짐). 법령 자리 = 1 + 단계.
 *   방침   몇 달짜리 국책을 하나씩 — 🏯 근본(3달·300) → 💰 부국 / ⚔️ 강병 (갈림길 — 하나를 고르면 반대쪽은 닫힘)
 *          → 🌾 둔전 확장(부국 뒤) · 🎯 조련(강병 뒤) → 🧑‍🎓 인재(둘 중 하나 뒤) → 📜 대계(인재 뒤). 끝낸 방침의 효과는 영구.
 *   법령   득실이 함께 오는 법 넷 — 한 번 내리면 거둘 수 없다(📯 징병령·💰 상세령·📚 권학령·🛡️ 수성령). 자리 수는 국세가 연다.
 *
 *   상태 save.rtk.polity = { age, focus: { done:[id…], cur, left, closed:[id…] }, laws:[id…] } — 옛 세이브엔 없다(빈 것 = 난세·방침 없음·법 없음)
 *   내 세력(save.rtk.me)만 쓴다(고돗과 같음 — AI 세력은 금이 없다). 손잡이 rk.polity.on(0 이면 꺼짐 — 배율 0·칸 없음).
 *   걸린 자리: statecraft.sum(배율) · rtk endMonthRaw(monthly) · ui-rtk-sheets myCity(cardHtml, 기술 나무 칸 뒤)
 */
(function (global) {
  'use strict';

  var AGES = [
    { key: 'nanse', emoji: '🌫️', name: '난세' },
    { key: 'gitl', emoji: '🧱', name: '기틀', cities: 4, tech: 4, gold: 1500 },
    { key: 'chise', emoji: '🏯', name: '치세', cities: 7, tech: 9, gold: 3000 },
    { key: 'seongse', emoji: '🌅', name: '성세', cities: 12, tech: 15, gold: 6000 },
  ];
  var AGE_PCT = 5;   // 단계마다 goldPct·foodPct +5
  var FOCUS = [
    { id: 'root', emoji: '🏯', name: '나라의 근본', months: 3, gold: 300, needs: [], stats: {}, desc: '나라의 방향을 세운다 — 모든 방침의 첫걸음' },
    { id: 'rich', emoji: '💰', name: '부국', months: 4, gold: 500, needs: ['root'], fork: 'army', stats: { goldPct: 10 }, desc: '금 수입 +10%' },
    { id: 'army', emoji: '⚔️', name: '강병', months: 4, gold: 500, needs: ['root'], fork: 'rich', stats: { troopPct: 15 }, desc: '징병 +15%' },
    { id: 'farm', emoji: '🌾', name: '둔전 확장', months: 4, gold: 500, needs: ['rich'], stats: { foodPct: 10 }, desc: '수확 +10%' },
    { id: 'drill', emoji: '🎯', name: '조련', months: 4, gold: 500, needs: ['army'], stats: { expPct: 10 }, desc: '무장 경험 +10%' },
    { id: 'talent', emoji: '🧑‍🎓', name: '인재 등용', months: 5, gold: 800, needsAny: ['farm', 'drill'], stats: { hirePct: 15 }, desc: '등용 +15%' },
    { id: 'grand', emoji: '📜', name: '대계', months: 6, gold: 1200, needs: ['talent'], stats: { govPct: 10 }, desc: '내정 성과 +10%' },
  ];
  var LAWS = [
    { id: 'draft', emoji: '📯', name: '징병령', stats: { troopPct: 15, foodPct: -5 }, desc: '징병 +15% · 수확 −5%' },
    { id: 'trade', emoji: '💰', name: '상세령', stats: { goldPct: 12, hirePct: -10 }, desc: '금 수입 +12% · 등용 −10%' },
    { id: 'study', emoji: '📚', name: '권학령', stats: { expPct: 15, goldPct: -5 }, desc: '무장 경험 +15% · 금 수입 −5%' },
    { id: 'guard', emoji: '🛡️', name: '수성령', stats: { defPct: 10, atkPct: -5 }, desc: '수비 +10% · 공격 −5%' },
  ];

  function core() { return global.DG.core; }
  function R() { return global.DG.rtk; }
  function on() { var c = core(); return !c || !c.tuned || +c.tuned('rk.polity.on', 1) !== 0; }
  function st() {
    var s = R() && R().state();
    if (!s) { return null; }
    if (!s.polity) { s.polity = { age: 0, focus: { done: [], cur: null, left: 0, closed: [] }, laws: [] }; }
    return s.polity;
  }
  function mine(fid) { return !!(fid && R() && fid === R().me()); }
  function byId(list, id) { for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } } return null; }

  /* ── 배율(경륜도 sum 에 더해지는 %) ── */
  function pct(fid, key) {
    if (!on() || !mine(fid)) { return 0; }
    var p = st(), n = 0;
    if (!p) { return 0; }
    if (key === 'goldPct' || key === 'foodPct') { n += p.age * AGE_PCT; }
    p.focus.done.forEach(function (id) { var f = byId(FOCUS, id); if (f && typeof f.stats[key] === 'number') { n += f.stats[key]; } });
    p.laws.forEach(function (id) { var l = byId(LAWS, id); if (l && typeof l.stats[key] === 'number') { n += l.stats[key]; } });
    return n;
  }

  /* ── 국세 ── */
  function age() { var p = st(); return AGES[p ? p.age : 0]; }
  function techDone(fid) { var T = global.DG.tech, n = 0; if (!T) { return 0; } var b = global.DG.techData && global.DG.techData.BRANCHES; if (b) { b.forEach(function (x) { n += T.doneCount(fid, x.key); }); } else { n = T.rec(fid).done.length; } return n; }
  function ageWhy() {
    var p = st(), nx = AGES[p.age + 1], me = R().me(), f = R().force(me);
    if (!nx) { return '끝 단계'; }
    var c = R().citiesOf(me).length, t = techDone(me), bad = [];
    if (c < nx.cities) { bad.push('성 ' + c + '/' + nx.cities); }
    if (t < nx.tech) { bad.push('기술 ' + t + '/' + nx.tech); }
    if (!f || f.gold < nx.gold) { bad.push('금 ' + (f ? f.gold : 0) + '/' + nx.gold); }
    return bad.length ? '모자람 — ' + bad.join(' · ') : '';
  }
  function advanceAge() {
    var p = st(), nx = AGES[p.age + 1], why = ageWhy();
    if (!nx || why) { return { ok: false, why: why || '끝 단계' }; }
    R().force(R().me()).gold -= nx.gold; p.age += 1;
    core().log(nx.emoji + ' 국세가 「' + nx.name + '」에 이르렀다 — 금·수확 +' + (p.age * AGE_PCT) + '% · 법령 자리 ' + lawSlots(), 'good');
    return { ok: true };
  }

  /* ── 방침 ── */
  function focusState(id) {
    var p = st(), f = byId(FOCUS, id);
    if (!f) { return 'none'; }
    if (p.focus.done.indexOf(id) >= 0) { return 'done'; }
    if (p.focus.cur === id) { return 'cur'; }
    if (p.focus.closed.indexOf(id) >= 0) { return 'closed'; }
    var okNeeds = (f.needs || []).every(function (n) { return p.focus.done.indexOf(n) >= 0; }),
        okAny = !f.needsAny || f.needsAny.some(function (n) { return p.focus.done.indexOf(n) >= 0; });
    return okNeeds && okAny ? 'open' : 'locked';
  }
  function focusWhy(id) {
    var p = st(), f = byId(FOCUS, id), s = focusState(id), me = R().force(R().me());
    if (!f) { return '없는 방침'; }
    if (s === 'done') { return '완수'; }
    if (s === 'cur') { return p.focus.left + '달 남음'; }
    if (s === 'closed') { return '갈림길 — 닫힘'; }
    if (s === 'locked') { return (f.needs || []).concat(f.needsAny || []).map(function (n) { return byId(FOCUS, n).name; }).join(f.needsAny ? ' 또는 ' : '·') + ' 먼저'; }
    if (p.focus.cur) { return byId(FOCUS, p.focus.cur).name + ' 진행 중'; }
    if (!me || me.gold < f.gold) { return '금 ' + f.gold + ' 모자람'; }
    return '';
  }
  function startFocus(id) {
    var p = st(), f = byId(FOCUS, id), why = focusWhy(id);
    if (!f || why) { return { ok: false, why: why || '없는 방침' }; }
    R().force(R().me()).gold -= f.gold; p.focus.cur = id; p.focus.left = f.months;
    if (f.fork && p.focus.closed.indexOf(f.fork) < 0) { p.focus.closed.push(f.fork); }
    core().log(f.emoji + ' 방침 「' + f.name + '」 — ' + f.months + '달', 'info');
    return { ok: true };
  }
  function monthly() {
    if (!on()) { return; }
    var p = st(), f;
    if (!p || !p.focus.cur) { return; }
    p.focus.left -= 1;
    if (p.focus.left <= 0) {
      f = byId(FOCUS, p.focus.cur); p.focus.done.push(p.focus.cur); p.focus.cur = null; p.focus.left = 0;
      if (f) { core().log(f.emoji + ' 방침 「' + f.name + '」 완수 — ' + f.desc, 'good'); }
    }
  }

  /* ── 법령 ── */
  function lawSlots() { var p = st(); return 1 + (p ? p.age : 0); }
  function lawWhy(id) {
    var p = st(), l = byId(LAWS, id);
    if (!l) { return '없는 법'; }
    if (p.laws.indexOf(id) >= 0) { return '시행 중(거둘 수 없다)'; }
    if (p.laws.length >= lawSlots()) { return '자리 ' + p.laws.length + '/' + lawSlots() + ' — 국세를 올려야'; }
    return '';
  }
  function enact(id) {
    var p = st(), l = byId(LAWS, id), why = lawWhy(id);
    if (!l || why) { return { ok: false, why: why || '없는 법' }; }
    p.laws.push(id);
    core().log(l.emoji + ' 법령 「' + l.name + '」 — ' + l.desc, 'warn');
    return { ok: true };
  }

  /* ── 성 창 칸(내 성 — 기술 나무 칸 뒤) ── */
  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function btn(act, label, why, primary) {
    return '<button class="btn tiny wide' + (!why && primary ? ' primary' : '') + '"' + (why ? ' disabled title="' + esc(why) + '"' : '') + ' data-polity="' + act + '">' + esc(why || label) + '</button>';
  }
  function cardHtml() {
    if (!on() || !R() || !R().state().started) { return ''; }
    var p = st(), a = age(), nx = AGES[p.age + 1], w = nx ? ageWhy() : '끝 단계';
    var html = '<div class="sec"><h4>' + a.emoji + ' 나라 <span class="muted">국세 ' + a.name + ' · 금·수확 +' + (p.age * AGE_PCT) + '% · 법령 자리 ' + p.laws.length + '/' + lawSlots() + '</span></h4>';
    html += '<div class="card"><div class="stat-row"><span>' + AGES.map(function (x, i) { return (i <= p.age ? '<b>' : '<span class="muted">') + x.emoji + x.name + (i <= p.age ? '</b>' : '</span>'); }).join(' → ') + '</span></div>' +
      (nx ? '<small class="muted">▶ ' + nx.name + ' 올리기 — 성 ' + nx.cities + ' · 기술 ' + nx.tech + ' · 금 ' + nx.gold + '</small>' + btn('age', nx.emoji + ' ' + nx.name + ' 올리기', w, true) : '<small class="muted">성세에 이르렀다</small>') + '</div>';
    html += '<div class="card"><div class="stat-row"><span>🎯 <b>국가 방침</b> ' + p.focus.done.length + '/' + FOCUS.length + '</span></div>';
    FOCUS.forEach(function (f) {
      var s = focusState(f.id), why = focusWhy(f.id);
      html += '<div class="stat-row"><span>' + f.emoji + ' ' + esc(f.name) + ' <small class="muted">' + esc(f.desc) + '</small></span><span>' +
        (s === 'done' ? '✓ 완수' : s === 'cur' ? '⏳ ' + p.focus.left + '달' : s === 'closed' ? '<span class="muted">닫힘</span>' : s === 'locked' ? '<span class="muted">' + esc(why) + '</span>' : btn('focus:' + f.id, f.months + '달 · 금 ' + f.gold, why, !p.focus.cur)) + '</span></div>';
    });
    html += '</div><div class="card"><div class="stat-row"><span>📜 <b>법령</b> <small class="muted">득실이 함께 — 한 번 내리면 거둘 수 없다</small></span></div>';
    LAWS.forEach(function (l) {
      var why = lawWhy(l.id), live = p.laws.indexOf(l.id) >= 0;
      html += '<div class="stat-row"><span>' + l.emoji + ' ' + esc(l.name) + ' <small class="muted">' + esc(l.desc) + '</small></span><span>' + (live ? '✓ 시행' : btn('law:' + l.id, '내리기', why, false)) + '</span></div>';
    });
    return html + '</div></div>';
  }
  function act(a) {
    if (a === 'age') { return advanceAge(); }
    if (a.indexOf('focus:') === 0) { return startFocus(a.slice(6)); }
    if (a.indexOf('law:') === 0) { return enact(a.slice(4)); }
    return { ok: false, why: '?' };
  }
  if (global.document) {
    global.document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-polity]') : null;
      if (!b || b.disabled) { return; }
      var r = act(b.getAttribute('data-polity'));
      if (!r.ok) { core().emit('toast', r.why); }
      if (global.DG.statecraft && global.DG.statecraft._reset) { global.DG.statecraft._reset(); }
      core().emit('changed'); core().persist();
    });
  }

  global.DG = global.DG || {};
  global.DG.polity = { AGES: AGES, FOCUS: FOCUS, LAWS: LAWS, AGE_PCT: AGE_PCT, state: st, pct: pct, age: age, ageWhy: ageWhy, advanceAge: advanceAge,
    focusState: focusState, focusWhy: focusWhy, startFocus: startFocus, monthly: monthly, lawSlots: lawSlots, lawWhy: lawWhy, enact: enact, act: act, cardHtml: cardHtml };
})(typeof window !== 'undefined' ? window : this);
