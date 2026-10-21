/**
 * ☰ 메뉴 화면 — W-0253 (정본 shared/js/menu-grid.js → tools/sync-shared.mjs 가 판 js/ 로 복사)
 *
 * 아래 독에 단추 10~14개가 한 줄로 늘어서던 것을 — 독엔 자주 쓰는 몇 개(`DG.cfg.menu.keep`) + ☰ 만 남기고,
 * ☰(또는 열린 창이 없을 때 Esc)를 누르면 화면을 덮는 메뉴 화면(색 옷 카드 격자)이 열린다.
 * 격자는 **열 때마다 독 단추에서 만든다**(아이콘·이름·배지 그대로 복사) — 칸을 누르면 메뉴를 닫고 원래 독 단추를 click() 한다.
 * 그래서 판별 openSheet·데이터를 안 건드리고 다섯 판에 같은 파일로 붙는다. 숨긴 독 단추는 DOM 에 그대로 남는다
 * (다른 코드가 `#dock button[data-sheet=x]` 를 찾는다). `DG.cfg.menu` 가 없으면 아무것도 안 한다.
 * 겉모양은 ui-kit.css 의 "메뉴 화면" 절(W-0252 공용 창 틀).
 */
(function (global) {
  'use strict';
  var doc = global.document, root = null, btn = null, keyOn = false;

  function cfg() { return global.DG && global.DG.cfg && global.DG.cfg.menu; }
  function keyOf(b) { return b.getAttribute('data-sheet') || b.id || ''; }
  function dockButtons() { var d = doc.getElementById('dock'); return d ? [].slice.call(d.querySelectorAll('button')).filter(function (b) { return b !== btn; }) : []; }
  function shown(b) { return b.style.display !== 'none' && !b.hidden; }   // 아직 안 열린 칸(3마을 공사 — syncDock 이 인라인으로 숨김)은 격자에도 안 낸다

  /** 다른 창이 열려 있나 — 그때 Esc 는 그 창 몫이다(시트·조우·상세·큰 지도·패시브 그물·이야기 대화) */
  function otherOpen() {
    if (doc.querySelector('#sheet.show, #encounter.show, #detail.show, #overworld-map.show, #top-more.show, #tools-drawer.show, #me-panel.show')) { return true; }   // #top-more·#tools-drawer = 좁은 화면 도구 서랍
    var D = global.DG || {};
    if (D.minimap && D.minimap.isBig && D.minimap.isBig()) { return true; }   // 2나락 큰 지도(M)
    return !!((D.passiveWebUI && D.passiveWebUI.isOpen && D.passiveWebUI.isOpen()) || (D.scenario && D.scenario.isOpen && D.scenario.isOpen()) || (D.story && D.story.isOpen && D.story.isOpen()));
  }

  function isOpen() { return !!(root && root.classList.contains('show')); }

  function build() {
    var grid = root.querySelector('.mg-grid'), list = dockButtons().filter(shown), i;
    grid.innerHTML = '';
    for (i = 0; i < list.length; i++) {
      var b = list[i], c = doc.createElement('button');
      c.type = 'button'; c.className = 'mg-cell' + (b.classList.contains('on') ? ' on' : '');
      c.setAttribute('data-for', keyOf(b)); c.innerHTML = b.innerHTML;
      if (b.classList.contains('badge') && b.getAttribute('data-badge')) { c.classList.add('badge'); c.setAttribute('data-badge', b.getAttribute('data-badge')); }   // 뱃지를 단추 클래스로 다는 판(3마을 편지)
      if (b.title) { c.title = b.title; }
      if (b.disabled) { c.disabled = true; }
      c.addEventListener('click', (function (src) { return function () { close(); src.click(); }; })(b));
      grid.appendChild(c);
    }
    return list.length;
  }

  /** 독에서 접힌 단추에 뱃지가 있거나 켜져(.on) 있으면 ☰ 에 알림 점·켜짐 — 접었다고 안 읽은 편지가 안 보이면 안 된다 */
  function sync() {
    if (!btn) { return; }
    var hid = dockButtons().filter(function (b) { return b.hasAttribute('data-menu-only') && shown(b); });
    btn.classList.toggle('mg-alert', hid.some(function (b) { return b.classList.contains('badge') || !!b.querySelector('i.badge, .badge, .dot'); }));
    btn.classList.toggle('on', hid.some(function (b) { return b.classList.contains('on'); }));
  }

  function open() { if (!root) { return 0; } var n = build(); root.classList.add('show'); var f = root.querySelector('.mg-cell'); if (f) { f.focus(); } return n; }
  function close() { if (root) { root.classList.remove('show'); } }
  function toggle() { if (isOpen()) { close(); } else { open(); } }

  /** 열린 동안 화살표로 칸을 옮긴다(Enter·Space 는 단추 기본 동작) */
  function move(e) {
    var cells = [].slice.call(root.querySelectorAll('.mg-cell')), i = cells.indexOf(doc.activeElement), cols = 1;
    if (cells.length > 1) { var t0 = cells[0].offsetTop; while (cols < cells.length && cells[cols].offsetTop === t0) { cols++; } }
    var d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (!d) { return; }
    e.preventDefault();
    var j = i < 0 ? 0 : Math.max(0, Math.min(cells.length - 1, i + d));
    if (cells[j]) { cells[j].focus(); }
  }

  function init() {
    var c = cfg(), dock = doc.getElementById('dock');
    if (!c || !dock || root) { return false; }
    var keep = c.keep || [];
    dockButtons().forEach(function (b) { if (keep.indexOf(keyOf(b)) < 0) { b.setAttribute('data-menu-only', '1'); } });
    btn = doc.createElement('button');
    btn.id = 'btn-menu'; btn.type = 'button'; btn.title = '메뉴 (Esc)';
    btn.innerHTML = '<span>☰</span><small>메뉴</small>';
    btn.addEventListener('click', toggle);
    dock.appendChild(btn);
    if (global.MutationObserver) { new global.MutationObserver(sync).observe(dock, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-badge', 'style'] }); }
    sync();
    root = doc.createElement('div');
    root.id = 'menu-grid';
    root.innerHTML = '<div class="mg-panel" role="dialog" aria-label="메뉴"><div class="mg-head"><h3>메뉴</h3><small class="muted">Esc 로 닫기</small><button type="button" class="icon-btn sm mg-x" title="닫기">✕</button></div><div class="mg-grid"></div></div>';
    root.addEventListener('click', function (e) { if (e.target === root || e.target.closest('.mg-x')) { close(); } });
    root.addEventListener('keydown', function (e) { move(e); });
    doc.body.appendChild(root);
    /* 캡처 단계 — 판별 Esc 처리(버블)가 시트를 닫기 **전에** 본다. 다른 창이 열려 있으면 그쪽 몫, 글 칸에선 안 함 */
    if (!keyOn) { keyOn = true; global.addEventListener('keydown', onEsc, true); }   // 한 번만(진단이 _reset 뒤 다시 init 한다)
    return true;
  }

  function onEsc(e) {
    if (e.key !== 'Escape' || e.repeat) { return; }
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) { return; }
    if (isOpen()) { close(); e.stopPropagation(); return; }
    if (root && !otherOpen()) { open(); }
  }

  /** 진단용 — 붙인 것을 걷어 다시 init 할 수 있게(숨긴 독 단추도 되살림) */
  function reset() { close(); if (root) { root.remove(); } if (btn) { btn.remove(); } [].slice.call(doc.querySelectorAll('#dock button[data-menu-only]')).forEach(function (b) { b.removeAttribute('data-menu-only'); }); root = btn = null; }

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', init); } else { setTimeout(init, 0); }

  global.DG = global.DG || {};
  global.DG.menuGrid = { init: init, open: open, close: close, isOpen: isOpen, _otherOpen: otherOpen, _reset: reset, _sync: sync };
})(window);
