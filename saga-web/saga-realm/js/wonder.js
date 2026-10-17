/**
 * 5천하 — 불가사의 경쟁 (W-0279, 문명식 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 세상에 하나뿐인 큰 건축 여섯. 아무 세력이나 금과 인부(그 성 병력)를 들여 짓기 시작하고, **먼저 다 지은 세력만**
 * 효과(세력 전체 배율)를 갖는다. 같은 것을 짓던 다른 세력은 들인 금의 반을 돌려받고 인부도 돌아온다. AI 도 금이 남으면 짓는다.
 *
 *   한 세력은 한 번에 하나만 짓는다 · 달마다 1 씩 차고(rtk endMonth → monthly) · 인부는 그 성 병력에서 빠졌다가 끝나면 돌아온다
 *   효과는 경륜도(statecraft.sum)에 더해진다 — 금·군량·내정·계략·수비·공격 배율이 이미 거기서 나온다
 *   상태 save.rtk.wonders = { built: { id: { by, at } }, jobs: { 세력: { id, city, left, gold, men } } } — 옛 세이브엔 없다(빈 것)
 */
(function (global) {
  'use strict';

  var WONDERS = [
    { id: 'wall',   name: '만리 장벽', emoji: '🧱', months: 12, gold: 4000, men: 3000, key: 'defPct',  pct: 10, desc: '세력 전체 수비 +10%' },
    { id: 'canal',  name: '큰 물길',   emoji: '🛶', months: 10, gold: 3600, men: 2500, key: 'goldPct', pct: 8,  desc: '세력 전체 금 수입 +8%' },
    { id: 'star',   name: '별 보는 대', emoji: '🔭', months: 8,  gold: 3000, men: 1500, key: 'plotPct', pct: 10, desc: '계략 성공률 +10%' },
    { id: 'school', name: '큰 배움터', emoji: '📚', months: 9,  gold: 3200, men: 1500, key: 'govPct',  pct: 8,  desc: '내정(개간·상업·기술·치안) +8%' },
    { id: 'farm',   name: '너른 장원', emoji: '🌾', months: 7,  gold: 2600, men: 2000, key: 'foodPct', pct: 10, desc: '세력 전체 군량 +10%' },
    { id: 'bridge', name: '큰 다리',   emoji: '🌉', months: 6,  gold: 2400, men: 2000, key: 'atkPct',  pct: 6,  desc: '세력 전체 공격 +6%' }
  ];
  var REFUND = 0.5, AI_GOLD = 2.5;   // AI 는 비용의 2.5배 금이 있어야 착공 — 1.8 이면 첫 해에 넷을 다 지어 플레이어가 다툴 틈이 없었다(W-0279 진단 기록)

  function R() { return global.DG.rtk; }
  function core() { return global.DG.core; }
  function byId(id) { for (var i = 0; i < WONDERS.length; i++) { if (WONDERS[i].id === id) { return WONDERS[i]; } } return null; }
  function S() {
    var st = R().state();
    if (!st.wonders) { st.wonders = { built: {}, jobs: {} }; }
    if (!st.wonders.built) { st.wonders.built = {}; }
    if (!st.wonders.jobs) { st.wonders.jobs = {}; }
    return st.wonders;
  }
  function name(fid) { return R().forceName ? R().forceName(fid) : fid; }
  function cityName(cid) { var d = global.DG.cityData && global.DG.cityData.find(cid); return d ? d.name : cid; }

  /** 그 세력이 가진 불가사의의 그 키 합(%) — statecraft.sum 이 더한다 */
  function pct(fid, key) {
    if (!fid || !R() || !R().state) { return 0; }
    var st = R().state(), w = st && st.wonders, n = 0, id, W;
    if (!w || !w.built) { return 0; }
    for (id in w.built) { if (Object.prototype.hasOwnProperty.call(w.built, id) && w.built[id].by === fid) { W = byId(id); if (W && W.key === key) { n += W.pct; } } }
    return n;
  }
  function builtBy(id) { var b = S().built[id]; return b ? b.by : null; }
  function jobOf(fid) { return S().jobs[fid] || null; }
  /** 이 불가사의를 짓는 중인 세력들 [{ force, left, months }] */
  function racers(id) {
    var j = S().jobs, out = [], f;
    for (f in j) { if (Object.prototype.hasOwnProperty.call(j, f) && j[f].id === id) { out.push({ force: f, left: j[f].left, months: byId(id).months }); } }
    return out;
  }

  /** 시작할 수 있나 — 못 하면 이유 */
  function why(fid, id, cityId) {
    var W = byId(id), f = R().force(fid), c = R().city(cityId);
    if (!W) { return '없는 불가사의'; }
    if (builtBy(id)) { return '이미 ' + name(builtBy(id)) + ' 이(가) 지었습니다'; }
    if (global.DG.tech && !global.DG.tech.wonderOpen(fid)) { return '학 갈래 「큰 도면」을 먼저 연구해야 합니다'; }   // W-0290 기술 나무가 문
    if (jobOf(fid)) { return '이미 ' + byId(jobOf(fid).id).name + ' 을(를) 짓는 중입니다'; }
    if (!c || c.force !== fid) { return '우리 성에서만 짓습니다'; }
    if (!f || f.gold < W.gold) { return '금이 모자랍니다(🪙' + W.gold + ')'; }
    if (c.troops < W.men + 500) { return '인부(병력 ' + W.men + ')가 모자랍니다'; }
    return null;
  }
  function start(fid, id, cityId) {
    var w = why(fid, id, cityId);
    if (w) { return { ok: false, why: w }; }
    var W = byId(id), f = R().force(fid), c = R().city(cityId);
    f.gold -= W.gold; c.troops -= W.men;
    S().jobs[fid] = { id: id, city: cityId, left: W.months, gold: W.gold, men: W.men };
    core().log(W.emoji + ' ' + name(fid) + ' 이(가) ' + cityName(cityId) + ' 에서 ' + W.name + ' 을(를) 짓기 시작했다 (' + W.months + '달)', 'info');
    return { ok: true, months: W.months };
  }
  function giveBack(fid, job, frac) {
    var f = R().force(fid), c = R().city(job.city);
    if (f && frac > 0) { f.gold += Math.round(job.gold * frac); }
    if (c && c.force === fid) { c.troops += job.men; }       // 성을 잃었으면 인부도 잃는다
  }

  /** 한 달 — rtk endMonth 가 부른다. 다 지은 것 목록 */
  function monthly() {
    var st = R().state();
    if (!st || !st.started) { return []; }
    var w = S(), done = [], f, j, i, k;
    for (f in w.jobs) {
      if (!Object.prototype.hasOwnProperty.call(w.jobs, f)) { continue; }
      j = w.jobs[f];
      if (!R().force(f) || !R().citiesOf(f).length) { delete w.jobs[f]; continue; }   // 망한 세력
      j.left -= 1;
      if (j.left <= 0) { done.push(f); }
    }
    for (i = 0; i < done.length; i++) {
      f = done[i]; j = w.jobs[f];
      if (!j) { continue; }
      delete w.jobs[f];
      var W = byId(j.id);
      if (w.built[j.id]) { giveBack(f, j, REFUND); continue; }   // 같은 달 둘이 끝나면 먼저 센 쪽이 갖는다
      w.built[j.id] = { by: f, at: st.year + '.' + st.month, city: j.city };
      giveBack(f, j, 0);
      core().log('🏛️ ' + name(f) + ' 이(가) ' + W.name + ' 을(를) 다 지었다 — ' + W.desc, f === R().me() ? 'good' : 'warn');
      if (f === R().me()) { core().emit('toast', W.emoji + ' ' + W.name + ' 완공 — ' + W.desc); }
      for (k in w.jobs) {
        if (Object.prototype.hasOwnProperty.call(w.jobs, k) && w.jobs[k].id === j.id) {
          giveBack(k, w.jobs[k], REFUND);
          if (k === R().me()) { core().emit('toast', '😞 ' + W.name + ' — ' + name(f) + ' 이(가) 먼저 지었다. 들인 금의 반을 돌려받았다'); }
          core().log('🏚️ ' + name(k) + ' 의 ' + W.name + ' 공사가 멈췄다 — 금 반을 돌려받았다', 'info');
          delete w.jobs[k];
        }
      }
    }
    return done;
  }

  /** AI 한 세력 — 짓는 중이 아니고 금이 넉넉하면(비용 ×2.5) 아직 아무도 안 지은 것 중 하나를, 병력이 가장 많은 성에서 */
  function aiStep(fid) {
    if (!fid || fid === R().me() || jobOf(fid)) { return null; }
    var f = R().force(fid), cs = R().citiesOf(fid), best = null, i, c;
    if (!f || !cs.length) { return null; }
    for (i = 0; i < cs.length; i++) { c = R().city(cs[i]); if (!best || c.troops > R().city(best).troops) { best = cs[i]; } }
    var free = WONDERS.filter(function (W) { return !builtBy(W.id) && f.gold >= W.gold * AI_GOLD; });
    if (!free.length) { return null; }
    var h = 0, s = String(fid) + R().state().turn; for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    var W = free[Math.abs(h) % free.length], r = start(fid, W.id, best);
    return r.ok ? W.id : null;
  }

  /* ── 성 창 칸(ui-rtk-sheets myCity 끝) ── */
  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function cardHtml(cityId) {
    if (!R() || !R().state().started) { return ''; }
    var me = R().me(), mj = jobOf(me), html = '<div class="sec"><h4>🏛️ 불가사의 <span class="muted">먼저 다 지은 세력만 효과 · 늦으면 금 반 환급</span></h4>';
    WONDERS.forEach(function (W) {
      var by = builtBy(W.id), rs = racers(W.id), line;
      if (by) { line = '<b>' + esc(name(by)) + '</b> 완공'; }
      else if (rs.length) { line = rs.map(function (r) { return esc(name(r.force)) + ' ' + Math.round((1 - r.left / r.months) * 100) + '%'; }).join(' · '); }
      else { line = '아무도 안 짓는 중'; }
      var w = why(me, W.id, cityId), mine = mj && mj.id === W.id;
      html += '<div class="card"><div class="stat-row"><span>' + W.emoji + ' <b>' + esc(W.name) + '</b></span><span class="muted">🪙' + W.gold + ' · 인부 ' + W.men + ' · ' + W.months + '달</span></div>' +
        '<small class="muted">' + esc(W.desc) + ' — ' + line + '</small>' +
        (mine ? '<div class="muted">짓는 중 — ' + mj.left + '달 남음 (' + esc(cityName(mj.city)) + ')</div>'
          : by ? '' : '<button class="btn tiny wide' + (w ? '' : ' primary') + '"' + (w ? ' disabled title="' + esc(w) + '"' : '') + ' data-wonder="' + W.id + '" data-city="' + esc(cityId) + '">' + (w ? esc(w) : '짓기 시작') + '</button>') +
        '</div>';
    });
    return html + '</div>';
  }
  if (global.document) {
    global.document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-wonder]') : null;
      if (!b || b.disabled) { return; }
      var r = start(R().me(), b.getAttribute('data-wonder'), b.getAttribute('data-city'));
      core().emit('toast', r.ok ? '🏛️ 짓기 시작 — ' + r.months + '달' : r.why);
      core().emit('changed'); core().persist();
    });
  }

  global.DG = global.DG || {};
  global.DG.wonder = {
    WONDERS: WONDERS, REFUND: REFUND, AI_GOLD: AI_GOLD, byId: byId,
    pct: pct, builtBy: builtBy, jobOf: jobOf, racers: racers, why: why, start: start, monthly: monthly, aiStep: aiStep, cardHtml: cardHtml
  };
})(window);
