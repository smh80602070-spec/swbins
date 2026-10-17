/**
 * 3마을 — 입주 조건 (W-0284, 테라리아·스타바운드식 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 누가 오는지에 내 꾸미기가 안 닿았다 → 제작대(🔨 레시피 lot)로 **작은 빈 집**(최대 3)을 짓고, 집 창고의 가구를 넣는다.
 * 가구마다 태그(data-village LOT_TAGS — 서재·악기·부엌·안방·뜰·바다·밤·별·길, 없으면 계열) 가 있고, 한 집에 **서로 다른 태그 셋 이상**이면
 * 그 태그를 둘 이상 좋아하는(LOT_LIKES) 아직 안 눌러앉은 떠돌이 방문객(visitor.js §5.9 명단)이 **다음 날** 눌러앉는다 · 하루 한 명.
 * 눌러앉기는 visitor.js 의 visitSettled 그대로(광장 곁 자리·선물·사연) — 이 파일은 "누가·왜" 만 정한다.
 *
 *   세이브 save.village.lots = [{ furn: [가구 key…], who: 방문객 key|null, day }] — 옛 세이브엔 없다(빈 것)
 *   잇기: craft.js kind 'lot' · ui/02 꾸미기 창 "창고" 앞 sheetHtml() · village rollDay 끝 rollDay()
 */
(function (global) {
  'use strict';

  var MAX = 3, FURN_MAX = 6, NEED_TAGS = 3, NEED_LIKE = 2;

  function core() { return global.DG.core; }
  function V() { return global.DG.village; }
  function VD() { return global.DG.villageData; }
  function VI() { return global.DG.visitor; }
  function HM() { return global.DG.home; }
  function st() {
    var s = V().state();
    if (!Array.isArray(s.lots)) { s.lots = []; }
    return s.lots;
  }
  function list() { return st(); }
  function count() { return st().length; }
  function tagOf(key) { var D = VD(), f = D.furn(key); return D.LOT_TAGS[key] || (f ? f.set : null); }
  function tagName(t) { var D = VD(); return D.LOT_TAG_NAMES[t] || (D.FURN_SETS && D.FURN_SETS[t] ? D.FURN_SETS[t].name : t); }
  /** 집 i 의 서로 다른 태그 */
  function tagsOf(i) {
    var lot = st()[i], out = [], j, t;
    if (!lot) { return out; }
    for (j = 0; j < lot.furn.length; j++) { t = tagOf(lot.furn[j]); if (t && out.indexOf(t) < 0) { out.push(t); } }
    return out;
  }
  function build() {
    if (count() >= MAX) { return { ok: false, why: '빈 집은 ' + MAX + '채까지' }; }
    st().push({ furn: [], who: null, day: V().state().day });
    core().emit('changed');
    return { ok: true, i: count() - 1 };
  }
  /** 집 창고 → 집 i */
  function put(i, key) {
    var lot = st()[i];
    if (!lot) { return { ok: false, why: '없는 집' }; }
    if (lot.who) { return { ok: false, why: '이미 사람이 산다' }; }
    if (lot.furn.length >= FURN_MAX) { return { ok: false, why: '가구는 ' + FURN_MAX + '점까지' }; }
    if (HM().stockCount(key) < 1) { return { ok: false, why: '창고에 없다' }; }
    HM().state().stock[key] -= 1;
    lot.furn.push(key);
    core().emit('changed');
    return { ok: true, tags: tagsOf(i) };
  }
  /** 집 i → 집 창고 */
  function take(i, key) {
    var lot = st()[i], j;
    if (!lot || lot.who) { return { ok: false }; }
    j = lot.furn.indexOf(key);
    if (j < 0) { return { ok: false }; }
    lot.furn.splice(j, 1);
    HM().stockAdd(key, 1);
    core().emit('changed');
    return { ok: true };
  }
  /** 집 i 에 어울리는 손님 — 좋아하는 태그가 가장 많이 든 아직 안 눌러앉은 방문객 { d, score, miss } */
  function matchFor(i) {
    var tags = tagsOf(i), D = VD(), vis = VI(), best = null, k, d, likes, score, miss, j;
    if (!vis) { return null; }
    for (k = 0; k < vis.VISITORS.length; k++) {
      d = vis.VISITORS[k];
      if (vis.settled().indexOf(d.key) >= 0) { continue; }
      likes = D.LOT_LIKES[d.key] || [];
      score = 0; miss = [];
      for (j = 0; j < likes.length; j++) { if (tags.indexOf(likes[j]) >= 0) { score += 1; } else { miss.push(likes[j]); } }
      if (!best || score > best.score) { best = { d: d, score: score, miss: miss }; }
    }
    return best;
  }
  function ready(i) { var m = matchFor(i); return tagsOf(i).length >= NEED_TAGS && !!m && m.score >= NEED_LIKE ? m : null; }
  /** 날이 바뀌었다 — 조건 맞는 빈 집 하나에 손님이 눌러앉는다(하루 한 명). 눌러앉은 key 또는 null */
  function rollDay() {
    var lots = st(), vis = VI(), s = V().state(), i, m;
    if (!vis) { return null; }
    for (i = 0; i < lots.length; i++) {
      if (lots[i].who) { continue; }
      m = ready(i);
      if (!m) { continue; }
      if (vis.settled().length >= vis.SETTLE_SPOTS.length) { return null; }
      if (!Array.isArray(s.visitSettled)) { s.visitSettled = []; }
      s.visitSettled.push(m.d.key);
      lots[i].who = m.d.key;
      core().log('🏡 ' + m.d.emoji + ' ' + m.d.name + '이(가) ' + (i + 1) + '번째 빈 집에 눌러앉았다 — ' + tagsOf(i).map(tagName).join('·'), 'good');
      core().emit('toast', '🏡 ' + m.d.emoji + ' ' + m.d.name + '이(가) 꾸며 둔 집에 눌러앉았다');
      core().emit('village:settle', { key: m.d.key, lot: i });
      core().emit('changed');
      return m.d.key;
    }
    return null;
  }

  /* ── 꾸미기 창 ── */
  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function hintFor(i) {
    var tags = tagsOf(i), m = matchFor(i);
    if (!m) { return '이제 올 손님이 없다';
    }
    if (tags.length < NEED_TAGS) { return '태그가 ' + tags.length + '/' + NEED_TAGS + ' — 서로 다른 태그 가구를 더'; }
    if (m.score >= NEED_LIKE) { return m.d.emoji + ' ' + m.d.name + ' 이(가) 내일 눌러앉는다'; }
    return m.d.emoji + ' ' + m.d.name + ' 이(가) 어울린다 — ' + m.miss.map(tagName).join('·') + ' 가구가 있으면';
  }
  function sheetHtml() {
    var D = VD(), vis = VI(), lots = st(), html = '<div class="sec"><h4>작은 빈 집 <span class="muted">' + lots.length + '/' + MAX + '</span></h4>';
    if (!lots.length) { return html + '<div class="hint">🔨 제작대에서 "작은 빈 집"을 지으면 가구를 넣어 손님을 부를 수 있습니다 — 서로 다른 태그 셋이면 다음 날 눌러앉습니다.</div></div>'; }
    var stock = HM().stockList ? HM().stockList() : [];
    lots.forEach(function (lot, i) {
      var who = lot.who && vis ? vis.byKey(lot.who) : null, tags = tagsOf(i);
      html += '<div class="card"><div class="stat-row"><span>🏠 ' + (i + 1) + '번째 집</span><b>' + (who ? who.emoji + ' ' + esc(who.name) : esc(hintFor(i))) + '</b></div>' +
        '<small class="muted">태그: ' + (tags.length ? tags.map(tagName).map(esc).join(' · ') : '없음') + '</small><div class="life-chips">';
      lot.furn.forEach(function (k) { var f = D.furn(k); html += '<button class="btn tiny ghost" data-lot="take" data-i="' + i + '" data-key="' + esc(k) + '"' + (who ? ' disabled' : '') + ' title="창고로">🪑 ' + esc(f ? f.name : k) + ' <small>' + esc(tagName(tagOf(k))) + '</small></button>'; });
      html += '</div>';
      if (!who && lot.furn.length < FURN_MAX && stock.length) {
        html += '<div class="life-chips"><small class="muted">넣기:</small>';
        stock.forEach(function (sr) { var k = sr.furn ? sr.furn.key : sr; var f = D.furn(k); if (!f) { return; } html += '<button class="btn tiny" data-lot="put" data-i="' + i + '" data-key="' + esc(k) + '">' + esc(f.name) + ' <small>' + esc(tagName(tagOf(k))) + '</small></button>'; });
        html += '</div>';
      }
      html += '</div>';
    });
    return html + '</div>';
  }
  if (global.document) {
    global.document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-lot]') : null, r, i;
      if (!b || b.disabled) { return; }
      i = parseInt(b.getAttribute('data-i'), 10);
      if (b.getAttribute('data-lot') === 'put') { r = put(i, b.getAttribute('data-key')); core().emit('toast', r.ok ? '🪑 넣었다 — ' + hintFor(i) : r.why); }
      else { r = take(i, b.getAttribute('data-key')); core().emit('toast', r.ok ? '🪑 창고로 거두었다' : '못 거둔다'); }
      core().persist();
    });
  }

  global.DG = global.DG || {};
  global.DG.lots = {
    MAX: MAX, FURN_MAX: FURN_MAX, NEED_TAGS: NEED_TAGS, NEED_LIKE: NEED_LIKE,
    list: list, count: count, build: build, put: put, take: take, tagOf: tagOf, tagName: tagName, tagsOf: tagsOf, matchFor: matchFor, ready: ready, rollDay: rollDay,
    hintFor: hintFor, sheetHtml: sheetHtml
  };
})(window);
