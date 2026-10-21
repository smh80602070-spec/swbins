/**
 * 「내 정보」 창 — W-0361 (정본 shared/js/me-panel.js → tools/sync-shared.mjs 가 판 js/ 로 복사)
 *
 * 사용자 10-20 "다섯판 내 장비랑 내 상태가 보는데 없어" — 입은 장비 칸과 전투(3마을은 생활) 수치를 한 창에.
 * 판마다 `js/me-adapter.js` 가 `DG.meAdapter = { model(), dock, title }` 를 둔다(기존 함수 값만 읽는다 — 새 계산·세이브 쓰기 없음).
 *   model = { name, sub, portrait(html), slots: [{ label, icon(html), item, go() }], stats: [{ label, value, detail }], note, grow: { label, open() } }
 * dock 이 false 가 아니면 독에 「내 정보」 단추(id btn-me — data-sheet 가 없어 판별 시트 단추 처리에 안 걸린다)와 덮개 창(#me-panel)을 붙인다.
 * 1만리는 기존 「나」 시트(data-sheet="me") 맨 위에 render() 를 끼운다(dock: false).
 * 칸·"어디서 올리나" 단추는 문서 전체 위임으로 받는다 — 덮개든 판 시트든 마지막에 그린 model 의 go/open 을 부른다.
 * 겉모양은 ui-kit.css 의 "내 정보" 절(메뉴 화면과 같은 틀).
 */
(function (global) {
  'use strict';
  var doc = global.document, root = null, btn = null, last = null;

  function A() { return global.DG && global.DG.meAdapter; }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /** model → HTML(순수). 칸 아이콘·초상은 어댑터가 만든 HTML 그대로(판의 itemicon·초상 함수 결과) */
  function render(m) {
    m = m || {}; last = m;
    var slots = (m.slots || []).map(function (s, i) {
      return '<button type="button" class="mp-slot' + (s.item ? '' : ' empty') + '" data-mp-slot="' + i + '"' + (s.go ? '' : ' disabled') + '>' +
        '<span class="mp-ico">' + (s.icon || '') + '</span><span class="mp-txt"><small>' + esc(s.label) + '</small>' +
        (s.item ? '<b>' + esc(s.item) + '</b>' : '<i class="muted">비움</i>') + '</span></button>';
    }).join('');
    var stats = (m.stats || []).map(function (s) {
      return '<div class="mp-stat"><span>' + esc(s.label) + '</span><b>' + esc(s.value) + '</b>' + (s.detail ? '<small class="muted">' + esc(s.detail) + '</small>' : '') + '</div>';
    }).join('');
    return '<div class="me-panel">' +
      '<div class="mp-who">' + (m.portrait || '') + '<div><b>' + esc(m.name || '나') + '</b>' + (m.sub ? '<small class="muted">' + esc(m.sub) + '</small>' : '') + '</div></div>' +
      '<div class="mp-body"><div class="mp-slots">' + (slots || '<p class="muted">입는 칸이 없습니다</p>') + '</div><div class="mp-stats">' + stats + '</div></div>' +
      (m.note ? '<p class="muted mp-note">' + esc(m.note) + '</p>' : '') +
      (m.grow ? '<button type="button" class="mp-grow" data-mp-grow="1">' + esc(m.grow.label) + '</button>' : '') +
      '</div>';
  }

  function model() { var a = A(); if (!a || !a.model) { return null; } try { return a.model(); } catch (e) { return { name: '내 정보', note: '아직 읽을 수 없습니다 — ' + (e && e.message) }; } }
  function isOpen() { return !!(root && root.classList.contains('show')); }
  function open() {
    if (!root) { return false; }
    var m = model(); if (!m) { return false; }
    root.querySelector('.mp-host').innerHTML = render(m);
    root.classList.add('show');
    var x = root.querySelector('.mg-x'); if (x) { x.focus(); }
    return true;
  }
  function close() { if (root) { root.classList.remove('show'); } }

  /* 칸·성장 단추 — 덮개 안이든 1만리 「나」 시트 안이든 */
  function onClick(e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-mp-slot],[data-mp-grow]') : null;
    if (!t || !last) { return; }
    var f = t.hasAttribute('data-mp-grow') ? (last.grow && last.grow.open) : ((last.slots || [])[+t.getAttribute('data-mp-slot')] || {}).go;
    if (typeof f !== 'function') { return; }
    e.preventDefault(); close(); f();
  }

  function init() {
    var a = A(), dock = doc && doc.getElementById('dock');
    /* Esc — stopImmediatePropagation: ☰ 메뉴의 Esc(같은 창 캡처)가 이어서 메뉴를 열지 않게 */
    if (doc && !init.wired) { init.wired = true; doc.addEventListener('click', onClick); global.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) { close(); e.stopImmediatePropagation(); } }, true); }
    if (!a || a.dock === false || !dock || root) { return false; }
    btn = doc.createElement('button');
    btn.id = 'btn-me'; btn.type = 'button'; btn.title = (a.title || '내 정보') + ' — 입은 장비·능력치';
    btn.innerHTML = '<span data-icon="user">🧑</span><small>' + esc(a.title || '내 정보') + '</small>';
    btn.addEventListener('click', open);
    var mb = doc.getElementById('btn-menu');
    if (mb) { dock.insertBefore(btn, mb); } else { dock.appendChild(btn); }
    var mc = global.DG.cfg && global.DG.cfg.menu;
    if (mc && (mc.keep || []).indexOf('btn-me') < 0) { btn.setAttribute('data-menu-only', '1'); }   // ☰ 격자로(menu-grid 가 먼저 섰어도 같은 꼴)
    if (global.DG.icon && global.DG.icon.sweep) { global.DG.icon.sweep(dock); }
    root = doc.createElement('div');
    root.id = 'me-panel';
    root.innerHTML = '<div class="mg-panel" role="dialog" aria-label="' + esc(a.title || '내 정보') + '"><div class="mg-head"><h3>' + esc(a.title || '내 정보') + '</h3><small class="muted">Esc 로 닫기</small><button type="button" class="icon-btn sm mg-x" title="닫기">✕</button></div><div class="mp-host"></div></div>';
    root.addEventListener('click', function (e) { if (e.target === root || e.target.closest('.mg-x')) { close(); } });
    doc.body.appendChild(root);
    return true;
  }

  /* 판 어댑터가 뒤에 실려도 되게 — 이미 읽혔으면 한 박자 뒤 */
  if (doc) { if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', init); } else { setTimeout(init, 0); } }

  global.DG = global.DG || {};
  global.DG.mePanel = { render: render, open: open, close: close, isOpen: isOpen, init: init, model: model, _last: function () { return last; } };
})(window);
