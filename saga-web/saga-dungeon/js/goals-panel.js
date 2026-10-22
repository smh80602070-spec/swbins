/**
 * 「오늘」 창 — W-0380 (정본 shared/js/goals-panel.js → tools/sync-shared.mjs 가 판 js/ 로 복사)
 *
 * 일일·주간 거리가 판마다 다른 창에 흩어져 있던 것(1만리 일과·2나락 목표판·3마을 일과·4종횡 일일 사명·5천하 도전)을 한 창에 같은 틀로 모아 본다.
 * 판마다 `js/goals-adapter.js` 가 `DG.goalsAdapter = { model(), title }` 를 둔다(기존 함수 값만 읽는다 — 새 계산·세이브 쓰기 없음).
 *   model = { resetIn(초 — 다음 날 갈림, 없으면 null), today: [row], week: [row], claim: { label, state('wait'|'ready'|'paid'|'auto'), hint, take() } | null, note }
 *   row   = { label, icon(글자), cur, max, done, go() }   — go 가 있으면 줄을 눌러 판의 원래 창으로
 * 판정·보상은 판 그대로 — 받기 단추는 판의 기존 받기 함수(take)만 부른다(1만리처럼 "역참에서" 받는 판은 take 없이 hint 만).
 * 독 단추 btn-goals(「오늘」)는 판 cfg.menu.keep 에 없으면 ☰ 격자로만. 겉모양은 ui-kit.css 의 「오늘」 절(내 정보와 같은 덮개).
 */
(function (global) {
  'use strict';
  var doc = global.document, root = null, btn = null, last = null;

  function A() { return global.DG && global.DG.goalsAdapter; }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(n) { var C = global.DG && global.DG.core; return C && C.fmt ? C.fmt(n) : String(n); }

  /** 남은 시간 글 — 초 → "3시간 12분" · "12분" (순수) */
  function left(sec) {
    if (sec === null || sec === undefined || !(sec >= 0)) { return ''; }
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h ? h + '시간 ' + m + '분' : Math.max(1, m) + '분';
  }

  function rowHtml(r, key) {
    var max = Math.max(1, r.max || 1), cur = Math.min(max, Math.max(0, r.cur || 0)), pct = r.done ? 100 : Math.round(cur / max * 100);
    return '<button type="button" class="gp-row' + (r.done ? ' done' : '') + '" data-gp-row="' + key + '"' + (r.go ? '' : ' disabled') + '>' +
      '<span class="gp-ico">' + esc(r.icon || '•') + '</span>' +
      '<span class="gp-txt"><b>' + esc(r.label) + '</b><span class="gp-bar"><i style="width:' + pct + '%"></i></span></span>' +
      '<span class="gp-n">' + (r.done ? '✔' : num(cur) + ' / ' + num(max)) + '</span></button>';
  }
  function section(title, rows, pre, empty) {
    var body = (rows || []).map(function (r, i) { return rowHtml(r, pre + i); }).join('');
    return '<div class="gp-sec"><h4>' + esc(title) + ' <small class="muted">' + (rows || []).filter(function (r) { return r.done; }).length + ' / ' + (rows || []).length + '</small></h4>' +
      (body || '<p class="muted gp-none">' + esc(empty) + '</p>') + '</div>';
  }

  /** model → HTML(순수 — 진단이 부른다) */
  function render(m) {
    m = m || {}; last = m;
    var c = m.claim, cl = '';
    if (c) {
      var st = c.state || 'wait', word = st === 'paid' ? '받음' : st === 'ready' ? (c.take ? '받기' : '받을 수 있음') : st === 'auto' ? '다 하면 저절로' : '아직';
      cl = '<div class="gp-claim ' + st + '"><span>🎁 <b>' + esc(c.label || '다 하면 받는 보상') + '</b>' + (c.hint ? '<small class="muted">' + esc(c.hint) + '</small>' : '') + '</span>' +
        (st === 'ready' && c.take ? '<button type="button" class="gp-take" data-gp-take="1">' + word + '</button>' : '<em>' + word + '</em>') + '</div>';
    }
    return '<div class="goals-panel">' +
      (m.resetIn !== null && m.resetIn !== undefined ? '<p class="muted gp-reset">⏳ 다음 갈림까지 ' + left(m.resetIn) + '</p>' : '') +
      section('오늘', m.today, 't', '이 판엔 오늘 거리가 없습니다') +
      section('이번 주', m.week, 'w', '이 판엔 이번 주 거리가 없습니다') +
      cl + (m.note ? '<p class="muted gp-note">' + esc(m.note) + '</p>' : '') + '</div>';
  }

  function model() { var a = A(); if (!a || !a.model) { return null; } try { return a.model(); } catch (e) { return { today: [], week: [], note: '아직 읽을 수 없습니다 — ' + (e && e.message) }; } }
  function isOpen() { return !!(root && root.classList.contains('show')); }
  function paint() { var m = model(); if (!m || !root) { return false; } root.querySelector('.gp-host').innerHTML = render(m); return true; }
  function open() {
    if (!root || !paint()) { return false; }
    root.classList.add('show');
    var x = root.querySelector('.mg-x'); if (x) { x.focus(); }
    return true;
  }
  function close() { if (root) { root.classList.remove('show'); } }

  function onClick(e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-gp-row],[data-gp-take]') : null;
    if (!t || !last || !root || !root.contains(t)) { return; }
    e.preventDefault();
    if (t.hasAttribute('data-gp-take')) { if (last.claim && last.claim.take) { last.claim.take(); paint(); } return; }
    var k = t.getAttribute('data-gp-row'), r = ((k.charAt(0) === 't' ? last.today : last.week) || [])[+k.slice(1)];
    if (r && typeof r.go === 'function') { close(); r.go(); }
  }

  function init() {
    var a = A(), dock = doc && doc.getElementById('dock');
    if (doc && !init.wired) { init.wired = true; doc.addEventListener('click', onClick); global.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) { close(); e.stopImmediatePropagation(); } }, true); }
    if (!a || !dock || root) { return false; }
    btn = doc.createElement('button');
    btn.id = 'btn-goals'; btn.type = 'button'; btn.title = (a.title || '오늘') + ' — 오늘·이번 주 할 일';
    btn.innerHTML = '<span data-icon="clipboard">📋</span><small>' + esc(a.title || '오늘') + '</small>';
    btn.addEventListener('click', open);
    var mb = doc.getElementById('btn-menu');
    if (mb) { dock.insertBefore(btn, mb); } else { dock.appendChild(btn); }
    var mc = global.DG.cfg && global.DG.cfg.menu;
    if (mc && (mc.keep || []).indexOf('btn-goals') < 0) { btn.setAttribute('data-menu-only', '1'); }   // ☰ 격자로(독 단추 수 그대로)
    if (global.DG.icon && global.DG.icon.sweep) { global.DG.icon.sweep(dock); }
    root = doc.createElement('div');
    root.id = 'goals-panel';
    root.innerHTML = '<div class="mg-panel" role="dialog" aria-label="' + esc(a.title || '오늘') + '"><div class="mg-head"><h3>' + esc(a.title || '오늘') + '</h3><small class="muted">Esc 로 닫기</small><button type="button" class="icon-btn sm mg-x" title="닫기">✕</button></div><div class="gp-host"></div></div>';
    root.addEventListener('click', function (e) { if (e.target === root || e.target.closest('.mg-x')) { close(); } });
    doc.body.appendChild(root);
    return true;
  }

  if (doc) { if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', init); } else { setTimeout(init, 0); } }

  global.DG = global.DG || {};
  global.DG.goalsPanel = { render: render, open: open, close: close, isOpen: isOpen, init: init, model: model, left: left, _last: function () { return last; } };
})(window);
