/**
 * 성 정보 패널 (W-0027 단계 2) — 전략 시뮬 화면: 지도에서 성을 누르면 시트가 아니라 **지도 옆에 붙는 패널**이 뜬다.
 *
 * 성 이름·세력·살림 수치를 한눈에 보이고, "성 열기" 로 기존 시트(명령·계략·태수)를 연다. 시트는 그대로 두고 앞에 한 겹만 얹었다.
 *   · 넓은 화면(>780px)·2D 지도·판이 시작된 때만 가로챈다(`pick` 이 true). 폰·3D 지도는 예전처럼 곧바로 시트가 열린다.
 *   · 지도가 다시 그려져도(`changed`) 고른 성을 다시 표시하고 패널 수치를 새로 채운다.
 * 순수 조각 `html(id)` 는 진단이 부른다. 판 설정·세이브는 안 건드린다.
 */
(function (global) {
  'use strict';

  var sel = null, wired = false, el = null;

  function DGx() { return global.DG || {}; }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { var c = DGx().core; return c && c.fmt ? c.fmt(n) : String(n); }

  /** 가운데 막대 — 값/상한 */
  function bar(label, v, cap) {
    var pct = cap > 0 ? Math.max(0, Math.min(100, Math.round(v / cap * 100))) : 0;
    return '<div class="cp-bar"><span>' + label + '</span><i><b style="width:' + pct + '%"></b></i><em>' + fmt(v) + '</em></div>';
  }

  /** 패널 안쪽 HTML — 성이 없거나 판이 안 열렸으면 빈 문자열 */
  function html(id) {
    var D = DGx(), R = D.rtk, CD = D.cityData, FD = D.forceData, off = D.off;
    if (!R || !CD || !id) { return ''; }
    var st = R.state();
    if (!st || !st.started) { return ''; }
    var d = CD.find(id), c = R.city(id);
    if (!d || !c) { return ''; }
    var f = c.force ? FD.force(c.force) : null, color = f ? f.color : '#5b6572';
    var mine = c.force && c.force === R.me();
    var gov = c.gov && off ? off.find(c.gov) : null;
    var land = CD.landOf ? CD.landOf(id) : null;
    return '<div class="cp-head"><div class="cp-name"><b>' + esc(d.name) + '</b> <small>' + esc(d.hanja) + '</small></div>' +
      '<span class="cp-force" style="border-color:' + color + ';background:' + color + '33">' + esc(R.forceName(c.force)) + '</span>' +
      '<button class="cp-x" data-cp="close" aria-label="닫기">✕</button></div>' +
      '<div class="cp-sub">' + esc(CD.provName(d.prov)) + (land ? ' · ' + esc(land.name) : '') + (mine ? ' · <b>내 성</b>' : '') + '</div>' +
      '<div class="cp-grid">' +
        '<div><small>인구</small><b>' + fmt(c.pop) + '</b></div>' +
        '<div><small>병력</small><b>' + fmt(c.troops) + '</b></div>' +
        '<div><small>군량</small><b>' + fmt(c.food) + '</b></div>' +
      '</div>' +
      bar('농업', c.agri, R.capOf(id, 'agri')) + bar('상업', c.comm, R.capOf(id, 'comm')) +
      bar('성벽', c.wall, c.maxWall) + bar('치안', c.sec, 100) +
      '<div class="cp-gov"><small>태수</small> <b>' + (gov ? esc(gov.name) : '비어 있음') + '</b></div>' +
      '<button class="cp-open" data-cp="open" data-city="' + esc(id) + '">' + (mine ? '성 열기 · 명령' : '성 열기 · 계략·출진') + '</button>';
  }

  function ensure() {
    if (el) { return el; }
    el = global.document.createElement('aside');
    el.id = 'cpanel';
    global.document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cp]');
      if (!b) { return; }
      if (b.getAttribute('data-cp') === 'close') { clear(); return; }
      if (b.getAttribute('data-cp') === 'open' && DGx().ui) { DGx().ui.openCity(b.getAttribute('data-city')); }
    });
    return el;
  }

  /** 지도 위 고른 성 표시 — 지도가 다시 그려질 때마다 */
  function mark() {
    var doc = global.document, prev = doc.querySelectorAll('.rcity.sel'), i, n;
    for (i = 0; i < prev.length; i++) { prev[i].classList.remove('sel'); }
    if (!sel) { return; }
    n = doc.querySelector('.rcity[data-city="' + sel + '"]');
    if (n) { n.classList.add('sel'); }
  }

  function render() {
    var h = sel ? html(sel) : '';
    if (!el && !h) { return; }
    ensure();
    el.innerHTML = h;
    el.classList.toggle('show', !!h);
    if (!h) { sel = null; }
    mark();
  }

  function clear() { sel = null; render(); }

  /** 지도에서 성을 눌렀을 때 — 이 판이 맡으면 true, 아니면 false(부르는 쪽이 예전처럼 시트를 연다) */
  function pick(id) {
    var D = DGx(), wide = global.innerWidth > 780, r3 = D.realm3d && D.realm3d.active && D.realm3d.active();
    if (!wide || r3 || !D.rtk || !D.rtk.state().started || !html(id)) { return false; }
    sel = id;
    if (!wired && D.core && D.core.on) { wired = true; D.core.on('changed', function () { if (sel) { render(); } }); }
    render();
    return true;
  }

  global.DG = global.DG || {};
  /** 클릭 좌표 밑의 성 요소 — 포인터 캡처로 클릭 대상이 지도 상자로 바뀐 마우스 클릭에서 성을 찾는다. 없으면 null */
  function at(e) {
    var list = global.document.elementsFromPoint ? global.document.elementsFromPoint(e.clientX, e.clientY) : [], i, n;
    for (i = 0; i < list.length; i++) { n = list[i].closest ? list[i].closest('[data-city]') : null; if (n) { return n; } }
    return null;
  }

  global.DG.cpanel = { at: at, html: html, pick: pick, clear: clear, selected: function () { return sel; } };
})(typeof window !== 'undefined' ? window : this);
