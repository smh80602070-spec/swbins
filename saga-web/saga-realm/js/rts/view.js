/**
 * RTS 화면 (W-0029, P1) — 캔버스 지도·카메라·도구 막대·HUD·미니맵·시간 루프. 규칙은 rts/rules·econ·state 가 쥐고 여기는 그리고 입력만 받는다.
 *
 *   조작: 이동 도구(기본)에서 끌면 지도가 움직인다 · 휠 확대 · 건물 도구를 고르고 칸을 누르면 짓는다(도로·철거는 끌며 연속)
 *         오른쪽·가운데 버튼이나 Shift+끌기도 이동 · WASD/방향키 이동 · 1~6 건물 · X 철거 · Esc 이동 · Space 일시정지
 *         폰: 한 손가락 끌기(이동 도구) · 두 손가락 핀치(확대) · 도구 단추 누르고 칸 누르기
 *   시간: 10Hz 고정 틱, 하루 = 50틱, 일시정지·1×·2×·4×. 10일마다·떠날 때 저장(`core.save.rts`).
 */
(function (global) {
  'use strict';

  var TILE = 20, TICK_MS = 100, ZMIN = 0.35, ZMAX = 4;
  var COLORS = { 0: ['#6f9b4f', '#689448'], 1: ['#3f6b2e', '#3a6529'], 2: ['#8a8378', '#827b70'], 3: ['#4f8fbf', '#4888b8'] };
  var TOOLS = [{ k: 'pan', n: '이동', i: '✋' }, { k: 'road', n: '도로', i: '🛣️' }, { k: 'house', n: '주거', i: '🏠' }, { k: 'farm', n: '농지', i: '🌾' },
    { k: 'market', n: '시장', i: '🏪' }, { k: 'workshop', n: '공방', i: '🔨' }, { k: 'barracks', n: '군영', i: '⚔️' }, { k: 'erase', n: '철거', i: '🧹' }];

  var R = function () { return global.DG.rts; };
  var S = null, cv, ctx, mini, mctx, miniBase = null, els = {};
  var cam = { x: 80, y: 50, z: 1.4 }, tool = 'pan', hover = null, ptrs = {}, pinch = 0, painting = false, panning = false, panLast = null;
  var acc = 0, lastT = 0, lastHud = 0, lastSaveDay = 0, tipMsg = '', tipUntil = 0, dirty = true;

  function $(id) { return global.document.getElementById(id); }
  function fmt(n) { return String(Math.round(n * 10) / 10).replace(/\.0$/, ''); }
  function size() { return { w: cv.clientWidth, h: cv.clientHeight }; }
  function px() { return TILE * cam.z; }
  function toScreen(x, y) { var z = px(), s = size(); return { x: (x - cam.x) * z + s.w / 2, y: (y - cam.y) * z + s.h / 2 }; }
  function toTile(sx, sy) { var z = px(), s = size(); return { x: Math.floor((sx - s.w / 2) / z + cam.x), y: Math.floor((sy - s.h / 2) / z + cam.y) }; }
  function clampCam() { var g = R().grid; cam.x = Math.max(0, Math.min(g.W, cam.x)); cam.y = Math.max(0, Math.min(g.H, cam.y)); }

  /* ── 그리기 ─────────────────────────────────────────── */

  function resize() {
    var dpr = global.devicePixelRatio || 1, s = size();
    cv.width = Math.round(s.w * dpr); cv.height = Math.round(s.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); dirty = true;
  }

  function draw() {
    var g = R().grid, D = R().rules.DEFS, s = size(), z = px(), x0 = Math.max(0, Math.floor(cam.x - s.w / 2 / z)), x1 = Math.min(g.W - 1, Math.ceil(cam.x + s.w / 2 / z));
    var y0 = Math.max(0, Math.floor(cam.y - s.h / 2 / z)), y1 = Math.min(g.H - 1, Math.ceil(cam.y + s.h / 2 / z)), x, y, p, id, b, d, bp;
    ctx.fillStyle = '#0d1016'; ctx.fillRect(0, 0, s.w, s.h);
    for (y = y0; y <= y1; y++) {
      for (x = x0; x <= x1; x++) {
        p = toScreen(x, y);
        ctx.fillStyle = COLORS[S.tiles[g.idx(x, y)]][(x + y) & 1];
        ctx.fillRect(p.x, p.y, Math.ceil(z), Math.ceil(z));
      }
    }
    if (z >= 14) {
      ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1; ctx.beginPath();
      for (x = x0; x <= x1 + 1; x++) { p = toScreen(x, y0); ctx.moveTo(p.x + .5, p.y); ctx.lineTo(p.x + .5, p.y + (y1 - y0 + 1) * z); }
      for (y = y0; y <= y1 + 1; y++) { p = toScreen(x0, y); ctx.moveTo(p.x, p.y + .5); ctx.lineTo(p.x + (x1 - x0 + 1) * z, p.y + .5); }
      ctx.stroke();
    }
    for (id in S.buildings) {
      b = S.buildings[id]; d = D[b.t];
      if (b.x + d.w < x0 || b.x > x1 + 1 || b.y + d.h < y0 || b.y > y1 + 1) { continue; }
      bp = toScreen(b.x, b.y);
      ctx.fillStyle = d.color; ctx.fillRect(bp.x + 1, bp.y + 1, d.w * z - 2, d.h * z - 2);
      if (!d.road) {
        ctx.strokeStyle = b.conn ? 'rgba(255,255,255,.55)' : '#ff5a4a'; ctx.lineWidth = b.conn ? 1 : 2;
        ctx.strokeRect(bp.x + 1.5, bp.y + 1.5, d.w * z - 3, d.h * z - 3);
        if (z >= 12 && d.icon) { ctx.font = Math.floor(Math.min(d.w, d.h) * z * 0.55) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000'; ctx.fillText(d.icon, bp.x + d.w * z / 2, bp.y + d.h * z / 2); }
        if (!b.conn && z >= 12) { ctx.font = Math.floor(z * 0.7) + 'px sans-serif'; ctx.fillStyle = '#ff5a4a'; ctx.textAlign = 'left'; ctx.fillText('⚠', bp.x + 2, bp.y + z * 0.5); }
      } else if (!b.conn) {
        ctx.fillStyle = 'rgba(255,90,74,.35)'; ctx.fillRect(bp.x + 1, bp.y + 1, z - 2, z - 2);
      }
    }
    if (hover && TOOLS.some(function (t) { return t.k === tool && t.k !== 'pan'; })) { drawGhost(); }
    drawMini(); dirty = false;
  }

  function drawGhost() {
    var D = R().rules.DEFS, g = R().grid, z = px(), p, w = 1, h = 1, ok;
    if (tool === 'erase') {
      var bb = R().rules.buildingAt(S, hover.x, hover.y);
      if (!bb || D[bb.t].fixed) { return; }
      p = toScreen(bb.x, bb.y); ctx.fillStyle = 'rgba(255,90,74,.4)'; ctx.fillRect(p.x, p.y, D[bb.t].w * z, D[bb.t].h * z); return;
    }
    var d = D[tool]; w = d.w; h = d.h;
    ok = R().rules.canPlace(S, tool, hover.x, hover.y).ok;
    p = toScreen(hover.x, hover.y);
    ctx.fillStyle = ok ? 'rgba(120,255,140,.45)' : 'rgba(255,90,74,.45)'; ctx.fillRect(p.x, p.y, w * z, h * z);
    ctx.strokeStyle = ok ? '#9dffae' : '#ff8a7a'; ctx.lineWidth = 2; ctx.strokeRect(p.x + 1, p.y + 1, w * z - 2, h * z - 2);
    void g;
  }

  /** 미니맵 — 지형은 한 번만 굽고 건물·카메라만 매번 */
  function bakeMini() {
    var g = R().grid, c = global.document.createElement('canvas'), cx = c.getContext('2d'), im, x, y, col, k;
    c.width = g.W; c.height = g.H; im = cx.createImageData(g.W, g.H);
    for (y = 0; y < g.H; y++) { for (x = 0; x < g.W; x++) { col = COLORS[S.tiles[g.idx(x, y)]][0]; k = (y * g.W + x) * 4; im.data[k] = parseInt(col.substr(1, 2), 16); im.data[k + 1] = parseInt(col.substr(3, 2), 16); im.data[k + 2] = parseInt(col.substr(5, 2), 16); im.data[k + 3] = 255; } }
    cx.putImageData(im, 0, 0); miniBase = c;
  }
  function drawMini() {
    if (!miniBase) { bakeMini(); }
    var g = R().grid, D = R().rules.DEFS, sx = mini.width / g.W, sy = mini.height / g.H, id, b, s = size(), z = px();
    mctx.imageSmoothingEnabled = false; mctx.drawImage(miniBase, 0, 0, mini.width, mini.height);
    for (id in S.buildings) { b = S.buildings[id]; mctx.fillStyle = b.t === 'castle' ? '#ffd36a' : D[b.t].color; mctx.fillRect(b.x * sx, b.y * sy, Math.max(1.5, D[b.t].w * sx), Math.max(1.5, D[b.t].h * sy)); }
    mctx.strokeStyle = '#ffd36a'; mctx.lineWidth = 1.5;
    mctx.strokeRect((cam.x - s.w / 2 / z) * sx, (cam.y - s.h / 2 / z) * sy, s.w / z * sx, s.h / z * sy);
  }

  /* ── HUD ───────────────────────────────────────────── */

  function hud() {
    var st = R().econ.stats(S), r = S.res;
    els.top.innerHTML = '<b class="rt-day">' + S.day + '일</b>' +
      '<span title="식량">🌾 <b>' + fmt(r.food) + '</b> <em class="' + (st.foodNet < 0 ? 'neg' : 'pos') + '">' + (st.foodNet >= 0 ? '+' : '') + fmt(st.foodNet) + '</em></span>' +
      '<span title="금">🪙 <b>' + fmt(r.gold) + '</b> <em class="' + (st.goldNet < 0 ? 'neg' : 'pos') + '">' + (st.goldNet >= 0 ? '+' : '') + fmt(st.goldNet) + '</em></span>' +
      '<span title="인구 / 수용">👥 <b>' + S.pop + '</b>/' + st.cap + '</span>' +
      '<span title="일하는 사람 / 일자리">⚒️ <b>' + st.workers + '</b>/' + st.jobs + '</span>';
    var btns = els.tools.querySelectorAll('button[data-tool]'), i, t, d;
    for (i = 0; i < btns.length; i++) {
      t = btns[i].getAttribute('data-tool'); d = R().rules.DEFS[t];
      btns[i].classList.toggle('on', t === tool);
      btns[i].classList.toggle('poor', !!(d && d.cost > r.gold));
    }
    var sp = els.speed.querySelectorAll('button'); for (i = 0; i < sp.length; i++) { sp[i].classList.toggle('on', +sp[i].getAttribute('data-speed') === S.speed); }
    els.tip.textContent = Date.now() < tipUntil ? tipMsg : tipFor();
    els.tip.classList.toggle('warn', Date.now() < tipUntil);
  }
  function tipFor() {
    if (!hover) { return '도구를 고르고 칸을 누르세요 · 건물은 도로로 거점에 이어져야 돕니다'; }
    var b = R().rules.buildingAt(S, hover.x, hover.y), D = R().rules.DEFS;
    if (b) { return D[b.t].name + (b.t === 'castle' ? '' : (b.conn ? ' · 돌고 있음' : ' · 도로로 이어지지 않았습니다')); }
    if (tool !== 'pan' && tool !== 'erase') { var c = R().rules.canPlace(S, tool, hover.x, hover.y); return D[tool].name + ' ' + D[tool].cost + '금' + (c.ok ? '' : ' — ' + c.why); }
    return '(' + hover.x + ', ' + hover.y + ')';
  }
  function say(msg) { tipMsg = msg; tipUntil = Date.now() + 1800; }

  /* ── 입력 ───────────────────────────────────────────── */

  function applyAt(t) {
    var rules = R().rules, D = rules.DEFS;
    if (tool === 'erase') {
      var b = rules.buildingAt(S, t.x, t.y);
      if (b && !D[b.t].fixed) { rules.remove(S, b.id); dirty = true; }
      return;
    }
    if (tool === 'pan') { return; }
    var c = rules.canPlace(S, tool, t.x, t.y);
    if (!c.ok) { say(c.why); return; }
    rules.place(S, tool, t.x, t.y); dirty = true;
  }

  function pointerPos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function dist2() { var k = Object.keys(ptrs); return k.length === 2 ? Math.hypot(ptrs[k[0]].x - ptrs[k[1]].x, ptrs[k[0]].y - ptrs[k[1]].y) : 0; }

  function bindInput() {
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('pointerdown', function (e) {
      var p = pointerPos(e); ptrs[e.pointerId] = p; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* noop */ }
      if (Object.keys(ptrs).length === 2) { pinch = dist2(); painting = false; panning = false; return; }
      if (e.button === 1 || e.button === 2 || e.shiftKey || tool === 'pan') { panning = true; panLast = p; return; }
      painting = true; applyAt(toTile(p.x, p.y));
    });
    cv.addEventListener('pointermove', function (e) {
      var p = pointerPos(e), n = Object.keys(ptrs).length;
      hover = toTile(p.x, p.y); dirty = true;
      if (n === 2 && ptrs[e.pointerId]) {
        ptrs[e.pointerId] = p; var d = dist2();
        if (pinch > 0 && d > 0) { cam.z = Math.max(ZMIN, Math.min(ZMAX, cam.z * d / pinch)); }
        pinch = d; return;
      }
      if (ptrs[e.pointerId]) { ptrs[e.pointerId] = p; }
      if (panning && panLast) { cam.x -= (p.x - panLast.x) / px(); cam.y -= (p.y - panLast.y) / px(); panLast = p; clampCam(); return; }
      if (painting && (tool === 'road' || tool === 'erase')) { applyAt(hover); }
    });
    function up(e) { delete ptrs[e.pointerId]; if (!Object.keys(ptrs).length) { painting = false; panning = false; panLast = null; pinch = 0; } }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', function () { hover = null; dirty = true; });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = pointerPos(e), before = toTile(p.x, p.y), f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      var bx = (p.x - size().w / 2) / px() + cam.x, by = (p.y - size().h / 2) / px() + cam.y;
      cam.z = Math.max(ZMIN, Math.min(ZMAX, cam.z * f));
      cam.x = bx - (p.x - size().w / 2) / px(); cam.y = by - (p.y - size().h / 2) / px(); clampCam(); dirty = true; void before;
    }, { passive: false });
    global.addEventListener('resize', resize);
    global.addEventListener('keydown', function (e) {
      var k = e.key, step = 3 / cam.z * 2, n;
      if (k === 'Escape') { tool = 'pan'; }
      else if (k === ' ') { S.speed = S.speed === 0 ? 1 : 0; e.preventDefault(); }
      else if (k === 'x' || k === 'X') { tool = 'erase'; }
      else if (/^[1-6]$/.test(k)) { n = +k; tool = TOOLS[n].k; }
      else if (k === 'ArrowLeft' || k === 'a') { cam.x -= step; } else if (k === 'ArrowRight' || k === 'd') { cam.x += step; }
      else if (k === 'ArrowUp' || k === 'w') { cam.y -= step; } else if (k === 'ArrowDown' || k === 's') { cam.y += step; }
      clampCam(); dirty = true;
    });
    function mini2cam(e) { var r = mini.getBoundingClientRect(), g = R().grid; cam.x = (e.clientX - r.left) / r.width * g.W; cam.y = (e.clientY - r.top) / r.height * g.H; clampCam(); dirty = true; }
    var md = false;
    mini.addEventListener('pointerdown', function (e) { md = true; try { mini.setPointerCapture(e.pointerId); } catch (x) { /* noop */ } mini2cam(e); });
    mini.addEventListener('pointermove', function (e) { if (md) { mini2cam(e); } });
    mini.addEventListener('pointerup', function () { md = false; });
    els.tools.addEventListener('click', function (e) { var b = e.target.closest('button[data-tool]'); if (b) { tool = b.getAttribute('data-tool'); dirty = true; } });
    els.speed.addEventListener('click', function (e) { var b = e.target.closest('button[data-speed]'); if (b) { S.speed = +b.getAttribute('data-speed'); } });
    global.addEventListener('beforeunload', save);
    global.document.addEventListener('visibilitychange', function () { if (global.document.hidden) { save(); } });
  }

  /* ── 저장·시간 ─────────────────────────────────────── */

  function save() {
    var c = global.DG.core; if (!S || !c || !c.save) { return; }
    c.save.rts = R().state.serialize(S); c.persist(); lastSaveDay = S.day;
  }

  function loop(t) {
    var dt = Math.min(250, t - (lastT || t)); lastT = t;
    if (S.speed > 0) {
      acc += dt * S.speed; var n = 0;
      while (acc >= TICK_MS && n < 40) {
        acc -= TICK_MS; n++; S.tick++;
        if (S.tick % R().econ.TICKS_PER_DAY === 0) { R().econ.dayTick(S); dirty = true; if (S.day - lastSaveDay >= 10) { save(); } }
      }
    }
    if (dirty) { draw(); }
    if (t - lastHud > 250) { lastHud = t; hud(); }
    global.requestAnimationFrame(loop);
  }

  /** 입구 — 저장이 있으면 이어서, 없으면 새 판 */
  function init() {
    var doc = global.document, c = global.DG.core;
    doc.body.insertAdjacentHTML('beforeend',
      '<canvas id="rts-map"></canvas><div id="rts-top" class="rt-box"></div>' +
      '<div id="rts-speed" class="rt-box"><button data-speed="0" title="일시정지 (Space)">⏸</button><button data-speed="1">1×</button><button data-speed="2">2×</button><button data-speed="4">4×</button></div>' +
      '<div id="rts-tools" class="rt-box">' + TOOLS.map(function (t, i) { var d = R().rules.DEFS[t.k]; return '<button data-tool="' + t.k + '" title="' + t.n + (i > 0 && i < 7 ? ' (' + i + ')' : '') + '"><span>' + t.i + '</span><small>' + t.n + (d && d.cost ? ' ' + d.cost : '') + '</small></button>'; }).join('') + '</div>' +
      '<canvas id="rts-mini" class="rt-box" width="240" height="150"></canvas><div id="rts-tip" class="rt-box"></div><a id="rts-back" class="rt-box" href="./">턴제로</a>');
    cv = $('rts-map'); ctx = cv.getContext('2d'); mini = $('rts-mini'); mctx = mini.getContext('2d');
    els = { top: $('rts-top'), tools: $('rts-tools'), speed: $('rts-speed'), tip: $('rts-tip') };
    S = (c && c.save && c.save.rts ? R().state.restore(c.save.rts) : null) || R().state.create((Date.now() & 0xffff) + 1);
    lastSaveDay = S.day;
    var cs = R().grid.castleSite(); cam.x = cs.x + 1.5; cam.y = cs.y + 1.5;
    resize(); bindInput(); hud(); global.requestAnimationFrame(loop);
  }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.view = { init: init, save: save, state: function () { return S; }, toScreen: toScreen, toTile: toTile, camera: cam, tool: function (t) { if (t) { tool = t; } return tool; } };
})(typeof window !== 'undefined' ? window : this);
