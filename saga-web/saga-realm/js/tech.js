/**
 * 5천하 — 기술 나무 (W-0290, 문명·AoE 식 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 세력 단위 연구. 표는 data-tech.js(농·상·군·학 × 6). 달마다(rtk endMonth → monthly) 연구점이 쌓이고,
 * 쌓인 점으로 갈래의 다음 마디를 산다(앞 마디가 문). 효과는 세 가지 길로 나간다:
 *   stats  → statecraft.sum 이 tech.pct 를 더한다(불가사의와 같은 자리) — 금·군량·내정·공격·수비 배율
 *   cost   → rtk.order 가 tech.cost(force, orderKey, gold) 로 명령 비용을 묻는다(조선 -20% 등)
 *   rule   → 'study' 연구점 +1/달 · 'wonder' 불가사의 문(wonder.why 가 tech.wonderOpen 으로 묻는다)
 *   연구점  달마다 BASE(1) + 지력 85 이상 무장 수(넷까지) + 'study'
 *   AI     성향(creed)대로 갈래 차례를 정해 점이 차면 산다(aiStep — rtk-ai runAll 끝)
 *   상태   save.rtk.tech = { [force]: { pts, done: [id…] } } — 옛 세이브엔 없다(빈 것)
 */
(function (global) {
  'use strict';

  function R() { return global.DG.rtk; }
  function core() { return global.DG.core; }
  function TD() { return global.DG.techData; }

  function S() {
    var st = R().state();
    if (!st.tech) { st.tech = {}; }
    return st.tech;
  }
  function rec(fid) {
    var t = S();
    if (!t[fid]) { t[fid] = { pts: 0, done: [] }; }
    if (!t[fid].done) { t[fid].done = []; }
    return t[fid];
  }
  function peek(fid) { var st = R() && R().state && R().state(); return st && st.tech && st.tech[fid] ? st.tech[fid] : null; }
  function has(fid, id) { var r = peek(fid); return !!(r && r.done.indexOf(id) >= 0); }
  function doneCount(fid, branch) {
    var r = peek(fid), n = 0; if (!r) { return 0; }
    r.done.forEach(function (id) { var nd = TD().node(id); if (nd && nd.branch === branch) { n++; } });
    return n;
  }
  /** 갈래의 다음 마디(다 끝났으면 null) */
  function nextOf(fid, branch) {
    var b = TD().branch(branch); if (!b) { return null; }
    var n = doneCount(fid, branch);
    return n < b.nodes.length ? b.nodes[n] : null;
  }

  /* ── 효과 ── */
  /** 세력이 연구한 마디의 그 키 합(%) — statecraft.sum 이 더한다 */
  function pct(fid, key) {
    var r = peek(fid), n = 0; if (!fid || !r) { return 0; }
    r.done.forEach(function (id) { var nd = TD().node(id); if (nd && nd.stats && typeof nd.stats[key] === 'number') { n += nd.stats[key]; } });
    return n;
  }
  /** 명령 비용 — 연구한 cost 마디를 곱한다 */
  function cost(fid, orderKey, gold) {
    var r = peek(fid), m = 1; if (!r) { return gold; }
    r.done.forEach(function (id) { var nd = TD().node(id); if (nd && nd.cost && nd.cost.order === orderKey) { m *= nd.cost.mul; } });
    return Math.round(gold * m);
  }
  function hasRule(fid, rule) {
    var r = peek(fid), ok = false; if (!r) { return false; }
    r.done.forEach(function (id) { var nd = TD().node(id); if (nd && nd.rule === rule) { ok = true; } });
    return ok;
  }
  /** 불가사의 문 — 학 3마디('wonder' 마디) */
  function wonderOpen(fid) { return hasRule(fid, 'wonder'); }

  /* ── 연구점 ── */
  function scholars(fid) {
    var off = global.DG.off; if (!off || !off.ofForce) { return 0; }
    var ids = off.ofForce(fid) || [], n = 0, i;
    for (i = 0; i < ids.length; i++) { var id = ids[i] && ids[i].id ? ids[i].id : ids[i]; var s = off.stats(id); if (s && s.wisdom >= TD().SCHOLAR_WIS) { n++; } }
    return Math.min(TD().SCHOLAR_MAX, n);
  }
  function ptsPerMonth(fid) { return TD().BASE_PTS + scholars(fid) + (hasRule(fid, 'study') ? 1 : 0); }

  /** 한 달 — rtk endMonth 가 부른다. 살아 있는 세력마다 연구점 */
  function monthly() {
    var st = R().state();
    if (!st || !st.started) { return; }
    R().liveForces().forEach(function (fid) { rec(fid).pts += ptsPerMonth(fid); });
  }

  /* ── 연구 ── */
  function why(fid, branch) {
    var nd = nextOf(fid, branch);
    if (!nd) { return '이 갈래는 다 연구했습니다'; }
    if (rec(fid).pts < nd.pts) { return '연구점이 모자랍니다(' + rec(fid).pts + '/' + nd.pts + ')'; }
    return null;
  }
  function research(fid, branch) {
    var w = why(fid, branch);
    if (w) { return { ok: false, why: w }; }
    var nd = nextOf(fid, branch), r = rec(fid), b = TD().branch(branch);
    r.pts -= nd.pts;
    r.done.push(nd.id);
    if (global.DG.statecraft && global.DG.statecraft.invalidate) { global.DG.statecraft.invalidate(fid); }
    core().log(b.emoji + ' ' + (R().forceName ? R().forceName(fid) : fid) + ' 이(가) 「' + nd.name + '」 을(를) 연구했다 — ' + nd.desc, fid === R().me() ? 'good' : 'info');
    if (fid === R().me()) { core().emit('toast', b.emoji + ' 「' + nd.name + '」 — ' + nd.desc); }
    return { ok: true, node: nd };
  }

  /** AI 한 세력 — 성향 차례대로 점이 차는 갈래를 산다(한 달 하나) */
  function aiStep(fid) {
    if (!fid || fid === R().me()) { return null; }
    var f = R().force(fid); if (!f) { return null; }
    var FD = global.DG.forceData, def = FD && FD.FORCES ? FD.FORCES.filter(function (x) { return x.id === fid; })[0] : null;
    var order = TD().CREED_ORDER[(def && def.creed) || 'balanced'] || TD().CREED_ORDER.balanced, i;
    for (i = 0; i < order.length; i++) {
      var nd = nextOf(fid, order[i]);
      if (nd && rec(fid).pts >= nd.pts) { var r = research(fid, order[i]); return r.ok ? nd.id : null; }
    }
    return null;
  }

  /* ── 성 창 칸(ui-rtk-sheets myCity 끝, 불가사의 칸 뒤) ── */
  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function cardHtml() {
    if (!R() || !R().state().started) { return ''; }
    var me = R().me(), r = rec(me);
    var html = '<div class="sec"><h4>📜 기술 나무 <span class="muted">연구점 ' + r.pts + ' · 달마다 +' + ptsPerMonth(me) + '(학자 ' + scholars(me) + ')</span></h4>';
    TD().BRANCHES.forEach(function (b) {
      var n = doneCount(me, b.key), nd = nextOf(me, b.key), w = nd ? why(me, b.key) : null;
      var dots = b.nodes.map(function (x, i) { return '<span title="' + esc(x.name + ' — ' + x.desc) + '">' + (i < n ? '●' : '○') + '</span>'; }).join('');
      html += '<div class="card"><div class="stat-row"><span>' + b.emoji + ' <b>' + esc(b.name) + '</b> <small class="muted">' + esc(b.desc) + '</small></span><span>' + dots + ' ' + n + '/' + b.nodes.length + '</span></div>' +
        (nd ? '<small class="muted">다음: ' + esc(nd.name) + ' — ' + esc(nd.desc) + ' (' + nd.pts + '점)</small>' +
              '<button class="btn tiny wide' + (w ? '' : ' primary') + '"' + (w ? ' disabled title="' + esc(w) + '"' : '') + ' data-tech="' + b.key + '">' + (w ? esc(w) : '연구 (' + nd.pts + '점)') + '</button>'
            : '<small class="muted">다 연구했다</small>') + '</div>';
    });
    return html + '</div>';
  }
  if (global.document) {
    global.document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-tech]') : null;
      if (!b || b.disabled) { return; }
      var r = research(R().me(), b.getAttribute('data-tech'));
      if (!r.ok) { core().emit('toast', r.why); }
      core().emit('changed'); core().persist();
    });
  }

  global.DG = global.DG || {};
  global.DG.tech = { rec: rec, has: has, doneCount: doneCount, nextOf: nextOf, pct: pct, cost: cost, hasRule: hasRule, wonderOpen: wonderOpen,
    scholars: scholars, ptsPerMonth: ptsPerMonth, monthly: monthly, why: why, research: research, aiStep: aiStep, cardHtml: cardHtml };
})(window);
