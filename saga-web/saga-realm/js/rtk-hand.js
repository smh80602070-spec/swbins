/**
 * 5천하 한 달 손질 줄이기 (W-0177) — 남은 무장 맡기기 · 명령 결과 지도 숫자 · Enter/N 다음 달 · 달말 카드 한 장
 * ---------------------------------------------------------------
 * 수신함 10-11 "조작이 답답함" — 명령 하나가 무장마다 세 번 누름(명령 고르기→무장→토스트)이고, 다음 달은 단추뿐,
 * 달이 넘어가면 결산·사연 카드가 줄줄이 떠 하나씩 닫아야 했다. `ui-rtk.js` 는 줄 수 상한이라 여기에 모은다.
 *
 *   맡기기        이 달 아직 안 움직인 그 성 무장마다 AI 의 명령 고르기(`rtkAI.pickOrder`·`bestFor`)를 그대로 써
 *                 `rtk.order` 를 부른다 — 사람이 누를 명령을 대신 고를 뿐, 수치·비용은 한 자도 안 바뀐다.
 *                 금이 모자라면 거기서 멈추고 "금 부족 n명 남음". 세력 전체판(상단 🤝 전부)은 내 성 전부
 *   결과 숫자     명령 결과마다 그 성 점 위에 "🌾+3" 이 0.9초 솟아 사라진다(2D 지도 SVG). 3D 지도엔 글자 층이 없어 토스트만
 *   다음 달 키    Enter · N — 시트·카드가 닫혀 있고 단추·입력 칸에 손이 없을 때만(단추에 Enter 면 그 단추가 눌린다)
 *   달말 카드     결산(이번 달 일·재정·다음 달 권고·진척) 아래에 고를 사연·영내 소식을 같은 카드 칸으로 — 고르면 그 자리에
 *                 결과가 서고 "확인" 하나로 닫힌다. 앞 단(설전·일기토)이 있는 사연은 지금처럼 따로 뜬다
 */
(function (global) {
  'use strict';

  function C() { return global.DG.core; }
  function R() { return global.DG.rtk; }
  function AI() { return global.DG.rtkAI; }
  function UI() { return global.DG.ui; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ── 맡기기 ───────────────────────────────────────────── */

  /** 한 성 — { moved, left, poor, results: [{ key, name, amount, text }] } */
  function delegate(cityId) {
    var st = R().state(), me = st.me, c = R().city(cityId), out = { moved: 0, left: 0, poor: false, results: [] };
    if (!c || c.force !== me || st.result) { return out; }
    var guard = 0;
    while (R().readyAt(cityId).length && guard++ < 40) {
      var key = AI().pickOrder(cityId, me), who = AI().bestFor(R().readyAt(cityId), key);
      if (!who) { break; }
      var res = R().order(cityId, who.id, key);
      if (!res.ok) { out.poor = res.why === '금이 모자랍니다'; break; }   // AI 와 같다 — 금이 떨어지면 그 세력은 거기까지
      out.moved++;
      out.results.push({ key: key, name: who.name, amount: res.amount, text: res.text });
      pop(cityId, key, res);
    }
    out.left = R().readyAt(cityId).length;
    return out;
  }
  /** 내 성 전부 — 금이 떨어지면 거기서 멈춘다 */
  function delegateAll() {
    var st = R().state(), list = R().citiesOf(st.me), sum = { moved: 0, left: 0, poor: false, cities: 0 }, i;
    for (i = 0; i < list.length; i++) {
      if (sum.poor) { sum.left += R().readyAt(list[i]).length; continue; }
      var r = delegate(list[i]);
      sum.moved += r.moved; sum.left += r.left; sum.poor = r.poor;
      if (r.moved) { sum.cities++; }
    }
    return sum;
  }
  function summary(r) {
    if (!r.moved && !r.left) { return '이 달에 움직일 무장이 없습니다'; }
    return '🤝 ' + r.moved + '명에게 맡겼다' + (r.cities ? '(성 ' + r.cities + ')' : '') +
      (r.poor ? ' · 금 부족 ' + r.left + '명 남음' : (r.left ? ' · ' + r.left + '명 남음' : ''));
  }

  /* ── 결과 숫자 ────────────────────────────────────────── */

  /** 명령 결과 → 지도에 띄울 짧은 글자. 늘어난 게 없으면 "—" */
  function popText(key, res) {
    var o = R().orderByKey(key);
    var em = o ? o.emoji : '📋';
    if (!res || !res.ok) { return null; }
    if (key === 'search' || key === 'hire') { return em; }
    return em + (res.amount > 0 ? '+' + C().fmt(res.amount) : '—') + (res.crit && res.amount > 0 ? '!' : '');
  }
  var POP_MS = 900, live = [], popSeq = 0;
  /** 살아 있는 글자 하나를 지금 지도에 그린다 — 지난 시간만큼 애니메이션을 앞당겨(지도를 다시 그려도 이어 솟는다) */
  function drawPop(p) {
    var svg = global.document && document.querySelector('#realm .rmap'), d = global.DG.cityData && global.DG.cityData.find(p.cityId);
    if (!svg || !d) { return null; }
    var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('class', 'rpop');
    t.setAttribute('data-city', p.cityId);
    t.setAttribute('data-pid', p.id);
    t.setAttribute('x', d.x);
    t.setAttribute('y', (d.y - 3.2 - p.slot * 2.6).toFixed(2));   // 같은 성에 여럿이면 조금씩 위로 쌓는다
    t.style.animationDelay = -(Date.now() - p.at) + 'ms';
    t.textContent = p.txt;
    svg.appendChild(t);
    return t;
  }
  /** 그 성 점 위에 0.9초 솟는 글자 — 2D 지도(.rmap)에만. 만든 요소(진단용) 또는 null */
  function pop(cityId, key, res) {
    var txt = popText(key, res), now = Date.now();
    if (!txt) { return null; }
    live = live.filter(function (x) { return now - x.at < POP_MS; });
    var p = { id: ++popSeq, cityId: cityId, txt: txt, at: now, slot: live.filter(function (x) { return x.cityId === cityId; }).length };
    live.push(p);
    setTimeout(function () {
      live = live.filter(function (x) { return x !== p; });
      var e = global.document && document.querySelector('.rpop[data-pid="' + p.id + '"]');
      if (e && e.parentNode) { e.parentNode.removeChild(e); }
    }, POP_MS);
    return drawPop(p);
  }
  /** 지도를 통째로 다시 그린 뒤(ui renderMap) 아직 살아 있는 글자를 되살린다 */
  function redraw() {
    var now = Date.now();
    live.forEach(function (p) { if (now - p.at < POP_MS) { drawPop(p); } });
  }

  /* ── 다음 달 키 ───────────────────────────────────────── */

  function canNext() {
    var st = R() && R().state(), enc = global.document && document.getElementById('encounter');
    if (!st || !st.started || st.result) { return false; }
    if (UI() && UI()._tab && UI()._tab()) { return false; }               // 시트가 열려 있다
    if (enc && enc.classList.contains('show')) { return false; }          // 카드가 떠 있다
    return true;
  }
  function keyNext(e) {
    var tag = e.target && e.target.tagName;
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) { return false; }
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A') { return false; }
    var k = e.key;
    if (k !== 'Enter' && k !== 'n' && k !== 'N') { return false; }
    if (!canNext()) { return false; }
    var nb = document.querySelector('#wallet .next-btn');
    UI()._act('next-month', nb);
    return true;
  }

  /* ── 달말 카드 한 장 ──────────────────────────────────── */

  function delta(o) {
    var d = o.to - o.from;
    return '<b>' + C().fmt(o.to) + '</b> <span class="' + (d >= 0 ? 'good' : 'meh') + '">' + (d >= 0 ? '+' : '') + C().fmt(d) + '</span>';
  }
  var EV_AXIS = { atk: '⚔️', def: '🛡️', util: '💡' };
  /** 카드 안에 실을 사연·소식 — 고를 것이 있고 앞 단(설전·일기토)이 없을 때만 */
  function inlineEvent() {
    var E = global.DG.event, v = E && E.view && E.view();
    if (!v || (v.pre && !v.pre.done) || !v.choices || !v.choices.length) { return null; }
    return v;
  }
  function eventHtml(v) {
    var kd = v.kind && global.DG.relData ? global.DG.relData.KINDS[v.kind] : null, h, i;
    var spk = v.speaker && global.DG.off ? global.DG.off.find(v.speaker) : null;
    h = '<div class="rkh-ev" data-rkh-ev><div class="rkh-ev-h">' + v.emoji + ' <b>' + esc(v.name) + '</b> <small class="muted">' +
      (kd ? kd.emoji + ' ' + kd.name + ' · ' : '') + esc(v.tag || (v.step > 1 ? v.step + '번째 이야기' : '사연')) + '</small></div>' +
      (spk ? '<div class="rkh-spk"><b>' + esc(spk.name) + '</b> <i>“' + esc(v.line || '') + '”</i></div>' : '') +
      '<div class="enc-hist">' + esc(v.text) + '</div>';
    for (i = 0; i < v.choices.length; i++) {
      var c = v.choices[i];
      h += '<button class="btn wide' + (c.k === 'atk' ? ' primary' : '') + '" data-rkh-pick="' + c.k + '"' + (c.ok ? '' : ' disabled') + '>' +
        EV_AXIS[c.k] + ' ' + esc(c.label) + '<br><small>' + esc(c.hint) + (c.ok || !c.cost ? '' : ' (금이 모자랍니다)') + '</small></button>';
    }
    return h + '</div>';
  }
  /**
   * 달말 카드 HTML — { html, withEvent }. 결산은 옛 카드 그대로(§5-7), 고를 사연이 있으면 아래 칸으로 싣고
   * "확인" 은 고르기 전엔 잠근다(고르지 않고 닫으면 사연이 밀린다)
   */
  function monthHtml(rp) {
    var html = '<h3 style="margin:0 0 4px;font-size:18px">📅 ' + rp.year + '년 ' + rp.month + '월 <small class="muted">이 달 결산</small></h3>' +
      '<div class="enc-hist">', i;
    for (i = 0; i < rp.lines.length; i++) { html += (i ? '<br>' : '') + esc(rp.lines[i]); }
    html += '</div><div class="enc-hist">🪙 ' + delta(rp.gold) + ' · 🍚 ' + delta(rp.food) + '<br>🪖 ' + delta(rp.troops) +
      ' · 🏯 ' + delta(rp.cities) + '</div>';
    if (rp.next) { html += '<div class="enc-hist"><b>💡 다음 달 권고</b><br>' + esc(rp.next) + '</div>'; }
    var prog = '';
    if (rp.milestone) { prog += '🚩 ' + rp.milestone.idx + '/' + rp.milestone.total + ' ' + esc(rp.milestone.name) + ' ' + rp.milestone.cur + '/' + rp.milestone.need + '<br>'; }
    if (rp.victory) { prog += rp.victory.emoji + ' ' + esc(rp.victory.name) + ' ' + Math.min(100, Math.round(100 * rp.victory.pct)) + '% · ' + esc(rp.victory.note) + '<br>'; }
    if (rp.challenge && !rp.challenge.done) {
      prog += '🎯 도전 ' + rp.challenge.month + '/' + rp.challenge.months + '달 · 점수 ' + rp.challenge.score +
        (rp.challenge.best ? ' · 최고 ' + rp.challenge.best : '') + '<br>';
    }
    if (prog) { html += '<small class="muted">' + prog + '</small>'; }
    var v = inlineEvent();
    if (v) { html += eventHtml(v); }
    html += '<button class="btn primary wide" data-act="close-enc" data-rkh-ok' + (v ? ' disabled' : '') + '>' + (v ? '고르면 닫힙니다' : '확인') + '</button>';
    return { html: html, withEvent: !!v };
  }
  /** 카드 안 사연 고르기 — 그 칸이 결과 글로 바뀌고 확인이 풀린다 */
  function pick(k, root) {
    var E = global.DG.event, r = E.choose(k);
    if (!r.ok) { if (UI() && UI().toast) { UI().toast(r.why); } return r; }
    var box = root && root.querySelector('[data-rkh-ev]'), ok = root && root.querySelector('[data-rkh-ok]');
    if (box) { box.innerHTML = '<div class="enc-hist">📜 ' + esc(r.text) + '</div>'; }
    if (ok) { ok.disabled = false; ok.textContent = '확인'; }
    if (UI()) { UI().renderTop(); UI().renderMap(); UI().renderSheet(); }
    return r;
  }

  /* ── 묶기 ─────────────────────────────────────────────── */

  var bound = false;
  function bind() {
    if (bound || !global.document) { return; }
    bound = true;
    global.addEventListener('keydown', function (e) { if (keyNext(e)) { e.preventDefault(); } });
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('[data-rkh-pick],[data-rkh-del]');
      if (!b) { return; }
      if (b.hasAttribute('data-rkh-pick')) { pick(b.getAttribute('data-rkh-pick'), document.getElementById('encounter')); return; }
      var cid = b.getAttribute('data-rkh-del'), r = cid === '*' ? delegateAll() : delegate(cid);
      if (UI()) { UI().renderTop(); UI().renderMap(); UI().renderSheet(); UI().toast(summary(r)); }
    });
    /* 2D 지도 휠 확대 — 커서 자리를 붙든 채(ui.zoomAt). 3D 는 제 캔버스가 휠을 받는다 */
    var realm = document.getElementById('realm');
    if (realm) {
      realm.addEventListener('wheel', function (e) {
        if (!realm.querySelector('.rmap') || !UI() || !UI().zoomAt) { return; }
        e.preventDefault();
        UI().zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY);
      }, { passive: false });
    }
  }
  if (global.document && document.readyState !== 'loading') { bind(); }
  else if (global.addEventListener) { global.addEventListener('DOMContentLoaded', bind); }

  global.DG = global.DG || {};
  global.DG.rtkHand = {
    POP_MS: POP_MS, delegate: delegate, delegateAll: delegateAll, summary: summary,
    popText: popText, pop: pop, redraw: redraw, canNext: canNext, keyNext: keyNext,
    monthHtml: monthHtml, inlineEvent: inlineEvent, pick: pick, bind: bind
  };
})(window);
