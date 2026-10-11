/**
 * 패시브 그물 화면 (W-0179) — DG.passiveWeb.make() 가 준 api 와 정의를 캔버스 겹창 하나로 보여 준다.
 * `DG.passiveWebUI.open(api, def, { title, fmt(stats)→글, colors, guard(action,id)→''|까닭, after(action,id), onClose })`
 *   action = 'take'(id = 목표 마디, 길째 찍기) · 'drop' · 'reset' · 'start'. guard 가 글을 돌려주면 그 까닭을 카드에 띄우고 막는다
 *   (판이 "마을에서만·금화" 같은 조건을 건다). after 는 해낸 뒤 부른다(금화 빼기 등).
 * 끌어 옮기기 · 휠/두 손가락 확대(0.4~3) · 찍은 마디 금색, 찍을 수 있는 이웃 밝게, 나머지 흐림 · 누르면 카드 · 위 검색칸.
 * 바뀔 때만 다시 그린다(상시 rAF 없음). 닫기 Esc/✕. 정본 shared/js/passive-web-ui.js (tools/sync-shared.mjs).
 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};

  var KIND = { s: '작은 마디', n: '이름난 마디', k: '규칙 마디', o: '시작점' };
  var COLORS = {
    bg: '#0b0e16', edge: '#283043', edgeCan: '#55739a', edgeTaken: '#e8b84a', dim: '#3a4357', can: '#a6d8ff',
    taken: '#f5c542', hit: '#ff8a3d', sel: '#ffffff', text: '#dfe6f2', path: '#d4ecff',
  };
  var R = { s: 3.4, n: 7.5, k: 9.5, o: 10 };
  var ZMIN = 0.4, ZMAX = 3;
  var CSS = [
    '.pwui{position:fixed;inset:0;z-index:9000;font:14px/1.4 system-ui,-apple-system,"Malgun Gothic",sans-serif;color:#e8ecf4;user-select:none;-webkit-user-select:none}',
    '.pwui-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}',
    '.pwui-top{position:absolute;left:0;right:0;top:0;z-index:2;display:flex;flex-direction:column;gap:6px;padding:8px 12px;padding-top:max(8px,env(safe-area-inset-top));background:linear-gradient(rgba(8,10,16,.95),rgba(8,10,16,.75))}',
    '.pwui-row{display:flex;align-items:center;gap:8px;min-width:0}',
    '.pwui-title{flex:1;min-width:0;font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pwui-pts{color:#f5c542;white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.pwui button{min-height:34px;background:#1d2433;color:#e8ecf4;border:1px solid #3a4560;border-radius:8px;padding:5px 11px;font:inherit;cursor:pointer;white-space:nowrap}',
    '.pwui button:disabled{opacity:.45;cursor:default}',
    '.pwui-q{flex:1;min-width:0;background:#121826;border:1px solid #3a4560;border-radius:8px;color:inherit;padding:7px 10px;font:inherit}',
    '.pwui-hits{color:#ffb27a;font-size:13px;white-space:nowrap}',
    '.pwui-hint{color:#a6d8ff;font-size:13px}',
    '.pwui-card{position:absolute;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));z-index:2;max-width:440px;margin:0 auto;max-height:38vh;overflow:auto;background:rgba(18,22,34,.96);border:1px solid #3a4560;border-radius:12px;padding:12px 14px}',
    '.pwui-card .nm{font-size:16px;font-weight:700}',
    '.pwui-card .kd{font-size:12px;color:#8fa0bf}',
    '.pwui-card .ef{margin:6px 0 0;color:#cfe3ff}',
    '.pwui-card .ds{margin-top:4px;color:#e0c98a;font-size:13px}',
    '.pwui-card .act{display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap}',
    '.pwui-card .go{background:#2f4a24;border-color:#6a9a4a}',
    '.pwui-card .note{font-size:12px;color:#9aa6bd}',
  ].join('\n');

  var cur = null;

  function el(doc, tag, cls, txt) { var e = doc.createElement(tag); if (cls) { e.className = cls; } if (txt != null) { e.textContent = txt; } return e; }
  function fmtDefault(stats) {
    return Object.keys(stats || {}).map(function (k) { var v = stats[k]; return k + ' ' + (v >= 0 ? '+' : '') + v; }).join(' · ');
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function open(api, def, opt) {
    opt = opt || {};
    if (cur) { cur.close(); }
    var doc = global.document, C = {}, k;
    for (k in COLORS) { C[k] = COLORS[k]; }
    for (k in (opt.colors || {})) { C[k] = opt.colors[k]; }
    var fmt = opt.fmt || fmtDefault, guard = opt.guard || function () { return ''; }, after = opt.after || function () {};
    var N = def.nodes, ix = global.DG.passiveWeb.index(def), startColor = {};
    (def.starts || []).forEach(function (s) { startColor[s.key] = s.color; });

    if (!doc.getElementById('pwui-css')) { var st = el(doc, 'style'); st.id = 'pwui-css'; st.textContent = CSS; doc.head.appendChild(st); }
    var root = el(doc, 'div', 'pwui'), cv = el(doc, 'canvas', 'pwui-cv'), top = el(doc, 'div', 'pwui-top');
    root.style.background = C.bg;
    var r1 = el(doc, 'div', 'pwui-row'), title = el(doc, 'span', 'pwui-title', opt.title || '패시브'), pts = el(doc, 'span', 'pwui-pts');
    var bReset = el(doc, 'button', 'pwui-reset', '↺'), bX = el(doc, 'button', 'pwui-x', '✕');
    bReset.title = '전부 되돌리기'; bX.title = '닫기 (Esc)';
    r1.appendChild(title); r1.appendChild(pts); r1.appendChild(bReset); r1.appendChild(bX);
    var r2 = el(doc, 'div', 'pwui-row'), q = el(doc, 'input', 'pwui-q'), hitsEl = el(doc, 'span', 'pwui-hits');
    q.type = 'search'; q.placeholder = '이름·효과 찾기'; q.setAttribute('enterkeyhint', 'search');
    r2.appendChild(q); r2.appendChild(hitsEl);
    var hint = el(doc, 'div', 'pwui-hint', '시작점을 하나 고르세요 — 색 있는 큰 동그라미');
    top.appendChild(r1); top.appendChild(r2); top.appendChild(hint);
    var card = el(doc, 'div', 'pwui-card');
    card.hidden = true;
    root.appendChild(cv); root.appendChild(top); root.appendChild(card);
    doc.body.appendChild(root);

    var ctx = cv.getContext('2d'), W = 0, H = 0, topH = 0, base = 1, dpr = 1;
    var view = { x: 0, y: 0, z: 0.9 }, sel = null, selPath = [], hits = [], hitSet = {}, hitAt = -1, raf = 0, armT = 0;

    function layout() {
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      W = root.clientWidth || global.innerWidth; H = root.clientHeight || global.innerHeight;
      topH = top.offsetHeight || 0;
      base = Math.min(W, H - topH) * 0.42;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      dirty();
    }
    function cyS() { return topH + (H - topH) / 2; }
    function toS(x, y) { return [W / 2 + (x - view.x) * base * view.z, cyS() + (y - view.y) * base * view.z]; }
    function toW(sx, sy) { return [view.x + (sx - W / 2) / (base * view.z), view.y + (sy - cyS()) / (base * view.z)]; }
    function dirty() { if (raf) { return; } var f = global.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); }; raf = f(draw); }

    function shape(x, y, r, kind) {
      ctx.beginPath();
      if (kind === 'k') { for (var i = 0; i < 6; i++) { var a = Math.PI / 6 + i * Math.PI / 3; if (i) { ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } else { ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } } ctx.closePath(); }
      else { ctx.arc(x, y, r, 0, Math.PI * 2); }
    }
    function draw() {
      raf = 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      var i, n, s, pos = [], stt = [], sc = clamp(Math.sqrt(view.z), 0.75, 1.8), inPath = {};
      for (i = 0; i < N.length; i++) { pos.push(toS(N[i].x, N[i].y)); stt.push(api.state(N[i].id)); }
      selPath.forEach(function (id) { inPath[ix.byId[id]] = 1; });
      // 간선
      ctx.lineCap = 'round';
      def.edges.forEach(function (e) {
        var a = e[0], b = e[1], ta = stt[a] === 'taken', tb = stt[b] === 'taken';
        var pa = pos[a], pb = pos[b];
        if ((pa[0] < -40 && pb[0] < -40) || (pa[0] > W + 40 && pb[0] > W + 40) || (pa[1] < -40 && pb[1] < -40) || (pa[1] > H + 40 && pb[1] > H + 40)) { return; }
        var path = (inPath[a] || ta) && (inPath[b] || tb) && (inPath[a] || inPath[b]);
        ctx.strokeStyle = ta && tb ? C.edgeTaken : (path ? C.path : ((ta && stt[b] === 'can') || (tb && stt[a] === 'can') ? C.edgeCan : C.edge));
        ctx.lineWidth = (ta && tb ? 3 : (path ? 2.5 : 1.6)) * sc * 0.8;
        ctx.setLineDash(path && !(ta && tb) ? [4, 4] : []);
        ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
      });
      ctx.setLineDash([]);
      // 마디
      for (i = 0; i < N.length; i++) {
        n = N[i]; s = pos[i];
        var r = R[n.k] * sc;
        if (s[0] < -r - 60 || s[0] > W + r + 60 || s[1] < -r - 20 || s[1] > H + r + 20) { continue; }
        var st = stt[i], fill = st === 'taken' ? C.taken : (st === 'can' ? C.can : C.dim);
        if (n.k === 'o') { fill = startColor[n.s] || fill; ctx.globalAlpha = st === 'taken' || api.start() == null ? 1 : 0.55; }
        if (inPath[i] && st !== 'taken') { fill = C.path; }
        shape(s[0], s[1], r, n.k); ctx.fillStyle = fill; ctx.fill();
        ctx.globalAlpha = 1;
        if (n.k !== 's') { ctx.lineWidth = 2; ctx.strokeStyle = st === 'taken' ? '#fff3c4' : (st === 'can' ? C.can : '#59627a'); shape(s[0], s[1], r + 2.5, n.k); ctx.stroke(); }
        if (hitSet[i]) { ctx.lineWidth = 2.5; ctx.strokeStyle = C.hit; shape(s[0], s[1], r + 6, 'c'); ctx.stroke(); }
        if (sel === n.id) { ctx.lineWidth = 2; ctx.strokeStyle = C.sel; shape(s[0], s[1], r + 9, 'c'); ctx.stroke(); }
      }
      // 이름(시작점·규칙은 늘, 이름난은 가까이서)
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (i = 0; i < N.length; i++) {
        n = N[i];
        if (n.k === 's' || (n.k === 'n' && view.z < 1.3 && sel !== n.id && !hitSet[i])) { continue; }
        s = pos[i];
        if (s[0] < -80 || s[0] > W + 80 || s[1] < -20 || s[1] > H + 20) { continue; }
        ctx.font = (n.k === 'o' ? 'bold 13px' : '11px') + ' system-ui,-apple-system,"Malgun Gothic",sans-serif';
        ctx.fillStyle = n.k === 'k' ? '#f0d79a' : C.text;
        ctx.globalAlpha = stt[i] === 'no' && n.k !== 'o' ? 0.6 : 1;
        ctx.fillText(n.name, s[0], s[1] + R[n.k] * sc + 5);
      }
      ctx.globalAlpha = 1;
    }

    function refreshTop() {
      var noStart = api.start() == null;
      pts.textContent = noStart ? '' : '남은 점수 ' + api.left() + ' / ' + api.points();
      hint.hidden = !noStart;
      bReset.disabled = noStart;
      var h = top.offsetHeight || 0;
      if (h !== topH) { topH = h; base = Math.min(W, H - topH) * 0.42; }
    }
    function button(txt, ok, fn, go) {
      var b = el(doc, 'button', go ? 'go' : '', txt);
      b.disabled = !ok;
      b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
      return b;
    }
    function act(action, id, fn) {
      var why = guard(action, id);
      if (why) { showCard(id, why); return; }
      if (fn()) { after(action, id); }
    }
    function showCard(id, warn) {
      sel = id; selPath = [];
      if (id == null) { card.hidden = true; dirty(); return; }
      var nd = api.node(id);
      if (!nd) { sel = null; card.hidden = true; dirty(); return; }
      card.textContent = '';
      card.appendChild(el(doc, 'div', 'nm', nd.name));
      card.appendChild(el(doc, 'div', 'kd', KIND[nd.k] || ''));
      var eff = fmt(nd.stats || {}, nd);
      if (eff) { card.appendChild(el(doc, 'div', 'ef', eff)); }
      if (nd.desc) { card.appendChild(el(doc, 'div', 'ds', nd.desc)); }
      var row = el(doc, 'div', 'act'), note = '';
      if (api.isTaken(id)) {
        if (nd.k === 'o') { note = '고른 시작점 — 옮기려면 ↺ 로 전부 되돌린다'; }
        else {
          var cd = api.canDrop(id);
          row.appendChild(button('되돌리기', cd, function () { act('drop', id, function () { return api.drop(id); }); }));
          if (!cd) { note = '이 마디를 빼면 다른 찍은 마디가 끊긴다'; }
        }
      } else if (nd.k === 'o') {
        if (api.start() == null) { row.appendChild(button('여기서 시작', true, function () { act('start', id, function () { return api.take(id); }); }, true)); }
        else { note = '다른 시작점 — 옮기려면 ↺ 로 전부 되돌린다'; }
      } else {
        var p = api.pathTo(id);
        if (!p) { note = api.start() == null ? '먼저 시작점을 고르세요' : '닿을 길이 없다'; }
        else {
          selPath = p.path;
          var enough = p.cost <= api.left();
          row.appendChild(button('찍기 (경로 ' + p.cost + '점)', enough, function () { act('take', id, function () { return api.takePath(id); }); }, true));
          if (!enough) { note = '점수가 모자란다 (남은 ' + api.left() + ')'; }
        }
      }
      if (warn) { note = warn; }
      if (note) { row.appendChild(el(doc, 'span', 'note', note)); }
      card.appendChild(row);
      card.hidden = false;
      dirty();
    }
    function pick(sx, sy) {
      var best = null, bd = 1e9, sc = clamp(Math.sqrt(view.z), 0.75, 1.8);
      for (var i = 0; i < N.length; i++) {
        var s = toS(N[i].x, N[i].y), d = Math.hypot(s[0] - sx, s[1] - sy), lim = Math.max(14, R[N[i].k] * sc + 8);
        if (d < lim && d < bd) { bd = d; best = N[i].id; }
      }
      return best;
    }
    function zoomAt(sx, sy, z) {
      var w = toW(sx, sy);
      view.z = clamp(z, ZMIN, ZMAX);
      view.x = w[0] - (sx - W / 2) / (base * view.z); view.y = w[1] - (sy - cyS()) / (base * view.z);
      dirty();
    }
    function centerOn(id, z) { var nd = api.node(id); if (!nd) { return; } view.x = nd.x; view.y = nd.y; if (z) { view.z = clamp(z, ZMIN, ZMAX); } dirty(); }

    // 찾기
    function search() {
      var t = q.value.trim().toLowerCase();
      hits = []; hitSet = {}; hitAt = -1;
      if (t) {
        N.forEach(function (n, i) {
          var hay = (n.name + ' ' + fmt(n.stats || {}, n) + ' ' + (n.desc || '')).toLowerCase();
          if (hay.indexOf(t) >= 0) { hits.push(n.id); hitSet[i] = 1; }
        });
      }
      hitsEl.textContent = t ? hits.length + '곳' : '';
      dirty();
    }
    q.addEventListener('input', search);
    q.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter' && hits.length) { hitAt = (hitAt + 1) % hits.length; centerOn(hits[hitAt], Math.max(view.z, 1.4)); showCard(hits[hitAt]); }
      if (e.key === 'Escape') { if (q.value) { q.value = ''; search(); } else { close(); } e.preventDefault(); }
    });

    // 끌기·확대·누르기
    var ptrs = {}, np = 0, drag = null, pinch = null;
    function pts2() { var a = [], id; for (id in ptrs) { a.push(ptrs[id]); } return a; }
    function startPinch() {
      var a = pts2(), mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
      pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, z: view.z, w: toW(mx, my) };
    }
    function startDrag(p) { drag = { x: p.x, y: p.y, vx: view.x, vy: view.y, moved: drag ? drag.moved : false }; }
    cv.addEventListener('pointerdown', function (e) {
      try { cv.setPointerCapture(e.pointerId); } catch (er) { /* 없는 브라우저 */ }
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; np++;
      if (np === 1) { drag = null; startDrag(ptrs[e.pointerId]); }
      if (np === 2) { startPinch(); if (drag) { drag.moved = true; } }
    });
    cv.addEventListener('pointermove', function (e) {
      if (!ptrs[e.pointerId]) { return; }
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (np >= 2 && pinch) {
        var a = pts2(), mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2, d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
        view.z = clamp(pinch.z * d / pinch.d, ZMIN, ZMAX);
        view.x = pinch.w[0] - (mx - W / 2) / (base * view.z); view.y = pinch.w[1] - (my - cyS()) / (base * view.z);
        dirty();
      } else if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) { drag.moved = true; }
        if (drag.moved) { view.x = drag.vx - dx / (base * view.z); view.y = drag.vy - dy / (base * view.z); dirty(); }
      }
    });
    function up(e) {
      if (!ptrs[e.pointerId]) { return; }
      var tap = np === 1 && drag && !drag.moved;
      delete ptrs[e.pointerId]; np--;
      if (np === 1) { pinch = null; startDrag(pts2()[0]); drag.moved = true; }
      if (np === 0) { pinch = null; }
      if (tap && e.type === 'pointerup') { var id = pick(e.clientX, e.clientY); q.blur(); showCard(id); }
      if (np === 0) { drag = null; }
    }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', function (e) { e.preventDefault(); zoomAt(e.clientX, e.clientY, view.z * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    root.addEventListener('keydown', function (e) { e.stopPropagation(); });

    bX.addEventListener('click', function () { close(); });
    bReset.addEventListener('click', function () {
      if (!armT) {
        bReset.textContent = '한 번 더 = 전부 되돌리기';
        armT = setTimeout(function () { armT = 0; bReset.textContent = '↺'; }, 3000);
        return;
      }
      clearTimeout(armT); armT = 0; bReset.textContent = '↺';
      act('reset', null, function () { api.reset(true); return true; });
      showCard(null);
    });
    function onKey(e) { if (e.key === 'Escape' && doc.activeElement !== q) { e.preventDefault(); e.stopPropagation(); close(); } }
    global.addEventListener('keydown', onKey, true);
    global.addEventListener('resize', layout);

    var unsub = api.onChange(function () { refreshTop(); if (sel != null) { showCard(sel); } dirty(); });
    function close() {
      if (!root.parentNode) { return; }
      unsub(); clearTimeout(armT);
      global.removeEventListener('keydown', onKey, true);
      global.removeEventListener('resize', layout);
      root.parentNode.removeChild(root);
      if (cur && cur.el === root) { cur = null; }
      if (opt.onClose) { opt.onClose(); }
    }

    layout(); refreshTop(); layout();
    if (api.start() != null) { centerOn('o_' + api.start(), 1.6); }
    cur = { close: close, redraw: dirty, el: root, select: showCard, centerOn: centerOn, view: view };
    return cur;
  }

  global.DG.passiveWebUI = { open: open, close: function () { if (cur) { cur.close(); } }, isOpen: function () { return !!cur; }, COLORS: COLORS };
})(typeof window !== 'undefined' ? window : this);
