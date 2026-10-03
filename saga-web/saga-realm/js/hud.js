/**
 * 전략 화면 머리판 (W-0027 단계 3) — 위 가운데 **날짜 배너**와 오른쪽 아래 **전체 지도(미니맵)**.
 *
 *   · 배너: "194년 1월 · 초봄" + 시나리오 이름. 판이 시작된 뒤에만 보인다.
 *   · 미니맵: 전체 지도 위에 성을 세력 색 점으로, 지금 보이는 창을 금색 사각형으로. 누르거나 끌면 그 자리로 지도를 옮긴다
 *     (`DG.ui.centerAt`). 2D 지도·넓은 화면에서만 보인다(CSS) — 폰·3D 는 예전 그대로.
 * 순수 조각 `bannerHtml()`·`miniSvg()` 는 진단이 부른다. 세이브·판 설정은 안 건드린다.
 */
(function (global) {
  'use strict';

  var MAP = { x: -140, y: -55, w: 380, h: 205 };   // renderMap 의 전체 지도 범위(MAP_VB)와 같다
  var SEASON = ['', '초봄', '봄', '늦봄', '초여름', '여름', '늦여름', '초가을', '가을', '늦가을', '초겨울', '겨울', '늦겨울'];
  var bannerEl = null, miniEl = null, lastView = '', dragging = false;

  function DGx() { return global.DG || {}; }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function started() { var R = DGx().rtk; return !!(R && R.state && R.state().started); }

  /** 배너 안쪽 — 판이 안 열렸으면 빈 문자열 */
  function bannerHtml() {
    var D = DGx(), R = D.rtk;
    if (!started()) { return ''; }
    var st = R.state(), cur = D.forceData && D.forceData.current ? D.forceData.current() : null;
    return '<b class="bn-date">' + st.year + '년 ' + st.month + '월</b>' +
      '<span class="bn-season">' + SEASON[st.month] + '</span>' +
      (cur && cur.name ? '<small class="bn-scen">' + esc(cur.name) + '</small>' : '');
  }

  /** 미니맵 SVG — 성 점(세력 색) 과 보이는 창 사각형. view = "x y w h" */
  function miniSvg(view) {
    var D = DGx(), R = D.rtk, CD = D.cityData, FD = D.forceData;
    if (!started() || !CD) { return ''; }
    var st = R.state(), me = R.me(), s = '', i, d, c, f, v = (view || '').split(' ');
    s += '<svg viewBox="' + MAP.x + ' ' + MAP.y + ' ' + MAP.w + ' ' + MAP.h + '" preserveAspectRatio="xMidYMid meet">';
    for (i = 0; i < CD.CITIES.length; i++) {
      d = CD.CITIES[i]; c = st.cities[d.id];
      if (!c) { continue; }
      f = c.force ? FD.force(c.force) : null;
      s += '<circle cx="' + d.x + '" cy="' + d.y + '" r="' + (c.force === me ? 3.6 : 2.6) + '" fill="' + (f ? f.color : '#5b6572') + '"' +
        (c.force === me ? ' stroke="#fff" stroke-width=".8"' : '') + '/>';
    }
    if (v.length === 4) {
      s += '<rect class="mm-view" x="' + v[0] + '" y="' + v[1] + '" width="' + v[2] + '" height="' + v[3] + '" fill="none" stroke="#ffd36a" stroke-width="2.4"/>';
    }
    return s + '</svg>';
  }

  function viewNow() {
    var svg = global.document.querySelector('#realm .rmap');
    return svg ? svg.getAttribute('viewBox') : '';
  }

  function ensure() {
    var doc = global.document;
    if (!bannerEl) {
      bannerEl = doc.createElement('div'); bannerEl.id = 'banner'; doc.body.appendChild(bannerEl);
      miniEl = doc.createElement('div'); miniEl.id = 'minimap'; miniEl.title = '전체 지도 — 누르거나 끌면 그 자리로';
      doc.body.appendChild(miniEl);
      miniEl.addEventListener('pointerdown', function (e) { dragging = true; try { miniEl.setPointerCapture(e.pointerId); } catch (ex) { /* noop */ } goto(e); });
      miniEl.addEventListener('pointermove', function (e) { if (dragging) { goto(e); } });
      miniEl.addEventListener('pointerup', function () { dragging = false; });
      miniEl.addEventListener('pointercancel', function () { dragging = false; });
    }
  }

  /** 미니맵 좌표 → 지도 좌표로 옮긴다 */
  function goto(e) {
    var svg = miniEl.querySelector('svg'), ui = DGx().ui;
    if (!svg || !ui || !ui.centerAt) { return; }
    var r = svg.getBoundingClientRect(), scale = Math.min(r.width / MAP.w, r.height / MAP.h);
    var offX = (r.width - MAP.w * scale) / 2, offY = (r.height - MAP.h * scale) / 2;
    ui.centerAt(MAP.x + (e.clientX - r.left - offX) / scale, MAP.y + (e.clientY - r.top - offY) / scale);
    lastView = '';   // 다음 틱에 사각형을 다시 그린다
  }

  function render() {
    var b = bannerHtml();
    if (!b && !bannerEl) { return; }
    ensure();
    bannerEl.innerHTML = b; bannerEl.classList.toggle('show', !!b);
    lastView = viewNow();
    miniEl.innerHTML = miniSvg(lastView); miniEl.classList.toggle('show', !!b);
  }

  /** 보이는 창이 바뀌면(조이스틱·확대·끌기) 사각형만 갱신 — 점은 `changed` 때만 */
  function tick() {
    if (!miniEl || !miniEl.classList.contains('show')) { return; }
    var v = viewNow();
    if (v === lastView) { return; }
    lastView = v;
    var rect = miniEl.querySelector('.mm-view'), p = v.split(' ');
    if (!rect) { miniEl.innerHTML = miniSvg(v); return; }   /* 지도가 첫 그림보다 늦게 그려졌으면 사각형을 이제 만든다 */
    if (p.length === 4) { rect.setAttribute('x', p[0]); rect.setAttribute('y', p[1]); rect.setAttribute('width', p[2]); rect.setAttribute('height', p[3]); }
  }

  if (global.DG && global.DG.core && global.DG.core.on) {
    global.DG.core.on('changed', render);
    global.setInterval(tick, 200);
  }
  global.DG = global.DG || {};
  global.DG.hud = { bannerHtml: bannerHtml, miniSvg: miniSvg, render: render };
})(typeof window !== 'undefined' ? window : this);
