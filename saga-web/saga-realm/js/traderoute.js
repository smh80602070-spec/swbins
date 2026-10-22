/**
 * 5천하 — 교역로 (W-0301, 장부 realm.md 우선 2 · 유로파 유니버설리스·문명 교역로 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 교역은 사건 카드 한 번뿐이었다 → 내 성에서 내 성(또는 동맹 세력의 성)까지 **우리·동맹 땅만 밟는 길**(보급선 W-0278 과 같은 성 이웃 그래프)이
 * 이어지면 금 COST 로 상단을 띄운다. MONTHS 달 동안 달마다 (두 성 상업 합) × RATE × 경륜도 금 배율 금이 들어온다.
 * 길이 끊기면(적 진이 선 성·남의 땅) 그 달 상단을 잃는다(계략 ✂️ 보급 끊기와 같은 결). 세력당 MAX 개, AI 도 띄운다.
 *
 *   상태 st.trade = { [force]: [{ from, to, left, gold }] } — setup 이 판마다 null 로(상태 객체를 다시 쓰는 함정)
 *   잇기: rtk endMonth(monthly) · rtk-ai(aiStep) · 성 창 myCity 끝(cardHtml) · 2D 지도 svg(금빛 점선) · 3D 는 없음(10-19 방향)
 *   손잡이 rtk.trade(1, 0 = 끔)
 */
(function (global) {
  'use strict';

  var COST = 300, MONTHS = 12, MAX = 2, RATE = 0.1, AI_GOLD = 3, GOLD = '#e8b84a';

  function R() { return global.DG.rtk; }
  function CD() { return global.DG.cityData; }
  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('rtk.trade', 1)); }
  function S() { var st = R().state(); if (!st.trade || typeof st.trade !== 'object') { st.trade = {}; } return st.trade; }
  function listOf(fid) { var t = S(); if (!Array.isArray(t[fid])) { t[fid] = []; } return t[fid]; }
  function cityName(cid) { var d = CD() && CD().find(cid); return d ? d.name : cid; }
  function ally(a, b) { var D = global.DG.diplo; return a === b || !!(D && D.alliedWith && D.alliedWith(a, b)); }
  function enemyCampAt(cid, fid) { var SL = global.DG.supplyLine; return !!(SL && SL.enemyCampAt && SL.enemyCampAt(cid, fid)); }
  function passable(cid, fid) { var c = R().city(cid); return !!(c && c.force && ally(fid, c.force) && !enemyCampAt(cid, fid)); }

  /** 교역 길 — 성 id 목록 [from … to], 우리·동맹 땅만. 못 이으면 null (판정만 읽는다) */
  function path(fid, from, to) {
    if (!R() || !CD() || from === to || !passable(from, fid) || !passable(to, fid)) { return null; }
    var prev = {}, q = [from], seen = {}, cur, adj, i, n;
    seen[from] = true;
    while (q.length) {
      cur = q.shift();
      if (cur === to) { var out = [], k = to; while (k) { out.unshift(k); k = prev[k]; } return out; }
      adj = (CD().find(cur) || {}).adj || [];
      for (i = 0; i < adj.length; i++) { n = adj[i]; if (!seen[n] && passable(n, fid)) { seen[n] = true; prev[n] = cur; q.push(n); } }
    }
    return null;
  }
  /** 한 달 수입(순수 계산) */
  function incomeOf(fid, from, to) {
    var a = R().city(from), b = R().city(to), SC = global.DG.statecraft;
    if (!a || !b) { return 0; }
    return Math.round(((a.comm || 0) + (b.comm || 0)) * RATE * (SC && SC.gold ? (SC.gold(fid) || 1) : 1));
  }
  /** 띄울 수 있나 — 못 하면 이유 문자열, 되면 null */
  function why(fid, from, to) {
    var f = R().force(fid), L = listOf(fid), a = R().city(from);
    if (!on()) { return '교역로가 꺼져 있습니다'; }
    if (!a || a.force !== fid) { return '내 성에서만 띄웁니다'; }
    if (L.length >= MAX) { return '상단은 ' + MAX + '개까지'; }
    if (L.some(function (r) { return (r.from === from && r.to === to) || (r.from === to && r.to === from); })) { return '이미 오가는 길입니다'; }
    if (!f || f.gold < COST) { return '금이 모자랍니다(🪙' + COST + ')'; }
    if (!path(fid, from, to)) { return '우리·동맹 땅으로 이어진 길이 없습니다'; }
    return null;
  }
  function start(fid, from, to) {
    var w = why(fid, from, to);
    if (w) { return { ok: false, why: w }; }
    R().force(fid).gold -= COST;
    listOf(fid).push({ from: from, to: to, left: MONTHS, gold: 0 });
    core().log('🐫 ' + (R().forceName ? R().forceName(fid) : fid) + ' 상단 — ' + cityName(from) + ' ↔ ' + cityName(to), fid === R().me() ? 'good' : 'info');
    return { ok: true, income: incomeOf(fid, from, to) };
  }
  /** 달 끝 — 길이 이어진 상단은 금, 끊긴 상단은 잃음, 다 간 상단은 돌아옴. { paid, lost } */
  function monthly() {
    var st = R().state(), paid = 0, lost = 0;
    if (!st || !st.started || !on()) { return { paid: 0, lost: 0 }; }
    var t = S(), fid, L, keep, i, r, g;
    for (fid in t) {
      if (!Object.prototype.hasOwnProperty.call(t, fid)) { continue; }
      L = t[fid] || []; keep = [];
      for (i = 0; i < L.length; i++) {
        r = L[i];
        if (!R().force(fid) || !path(fid, r.from, r.to)) {
          lost++; core().log('✂️ ' + cityName(r.from) + ' ↔ ' + cityName(r.to) + ' 교역로가 끊겨 상단을 잃었다', fid === R().me() ? 'bad' : 'info');
          if (fid === R().me()) { core().emit('toast', '✂️ 교역로가 끊겼다 — ' + cityName(r.from) + ' ↔ ' + cityName(r.to)); }
          continue;
        }
        g = incomeOf(fid, r.from, r.to); R().force(fid).gold += g; r.gold += g; paid += g; r.left -= 1;
        if (r.left > 0) { keep.push(r); } else if (fid === R().me()) { core().log('🐫 ' + cityName(r.from) + ' ↔ ' + cityName(r.to) + ' 상단이 돌아왔다 — 모두 🪙' + r.gold, 'good'); }
      }
      t[fid] = keep;
    }
    return { paid: paid, lost: lost };
  }
  /** 그 성에서 띄울 만한 상대 — 이어진 우리·동맹 성 중 상업 큰 순 [{ id, income }] */
  function candidates(fid, from, n) {
    var all = (CD() && CD().CITIES) || [], out = [], i, d;
    for (i = 0; i < all.length; i++) { d = all[i]; if (d.id !== from && passable(d.id, fid) && path(fid, from, d.id)) { out.push({ id: d.id, income: incomeOf(fid, from, d.id) }); } }
    out.sort(function (a, b) { return b.income - a.income; });
    return out.slice(0, n || 3);
  }
  /** AI — 금이 COST×AI_GOLD 넘고 자리가 남으면 상업 가장 큰 성에서 가장 벌이 좋은 길 하나 */
  function aiStep(fid) {
    if (!on() || !fid || fid === R().me()) { return null; }
    var f = R().force(fid), cs = R().citiesOf(fid), best = null, i;
    if (!f || f.gold < COST * AI_GOLD || listOf(fid).length >= MAX || !cs.length) { return null; }
    for (i = 0; i < cs.length; i++) { if (!best || (R().city(cs[i]).comm || 0) > (R().city(best).comm || 0)) { best = cs[i]; } }
    var c = candidates(fid, best, 1)[0];
    return c && start(fid, best, c.id).ok ? c.id : null;
  }

  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  /** 성 창 칸(ui-rtk-sheets myCity 끝) */
  function cardHtml(cityId) {
    if (!on() || !R()) { return ''; }
    var me = R().me(), L = listOf(me), html = '<div class="sec"><h4>🐫 교역로 <span class="muted">' + L.length + '/' + MAX + '</span></h4>';
    L.forEach(function (r) { html += '<div class="stat-row"><span>' + esc(cityName(r.from)) + ' ↔ ' + esc(cityName(r.to)) + '</span><b>달마다 🪙' + incomeOf(me, r.from, r.to) + ' · ' + r.left + '달</b></div>'; });
    if (L.length < MAX) {
      var cs = candidates(me, cityId, 3);
      if (!cs.length) { html += '<div class="hint">이 성에서 우리·동맹 땅으로 이어진 성이 없습니다.</div>'; }
      cs.forEach(function (c) { var w = why(me, cityId, c.id); html += '<button class="btn tiny' + (w ? ' ghost' : '') + '" data-trade="' + esc(c.id) + '" data-from="' + esc(cityId) + '"' + (w ? ' disabled title="' + esc(w) + '"' : '') + '>🐫 ' + esc(cityName(c.id)) + ' 까지 · 달마다 🪙' + c.income + ' × ' + MONTHS + '달 (🪙' + COST + ')</button> '; });
    }
    return html + '</div>';
  }
  if (global.document) {
    global.document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-trade]') : null;
      if (!b || b.disabled) { return; }
      var r = start(R().me(), b.getAttribute('data-from'), b.getAttribute('data-trade'));
      core().emit('toast', r.ok ? '🐫 상단을 띄웠다 — 달마다 🪙' + r.income : r.why);
      core().emit('changed'); core().persist();
    });
  }
  /** 2D 지도 — 금빛 점선 */
  function svg() {
    if (!on() || !R() || !R().state || !R().state().trade) { return ''; }
    var t = S(), s = '', fid, i, k, p, a, b;
    for (fid in t) {
      if (!Object.prototype.hasOwnProperty.call(t, fid)) { continue; }
      for (i = 0; i < (t[fid] || []).length; i++) {
        p = path(fid, t[fid][i].from, t[fid][i].to) || [t[fid][i].from, t[fid][i].to];
        for (k = 0; k + 1 < p.length; k++) { a = CD().find(p[k]); b = CD().find(p[k + 1]); if (a && b) { s += '<line class="rtrade" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="' + GOLD + '" stroke-width="3" stroke-dasharray="7 5" opacity="' + (fid === R().me() ? 0.95 : 0.5) + '"/>'; } }
      }
    }
    return s;
  }

  global.DG = global.DG || {};
  global.DG.trade = { COST: COST, MONTHS: MONTHS, MAX: MAX, RATE: RATE, path: path, incomeOf: incomeOf, why: why, start: start, monthly: monthly, candidates: candidates, aiStep: aiStep, cardHtml: cardHtml, svg: svg, list: listOf };
})(window);
