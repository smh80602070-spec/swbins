/**
 * 미니맵 — 마을·숲 고리를 위에서 본 작은 판 (사가만리 minimap.js와 같은 얼개)
 * ---------------------------------------------------------------
 * 이 판(사가마을)은 사가만리처럼 **플레이어 중심 반경**으로 세상을 본다 —
 * 마을(30×20칸)에 숲 고리(margin)까지 걸쳐 있어 한 판에 다 담기엔 넓다.
 * 그래서 dungeon(방 하나짜리, 늘 화면보다 작다)과 달리 반경을 넘는 자리는
 * 사가만리처럼 테두리에 붙인다(edge).
 *
 *   왼쪽 아래 둥근 판   가운데가 나, 위가 북쪽(장식적 관례 — 실제 나침반 아님)
 *   바탕                village.tileAt() 이 낸 지형 칸
 *   점                  주민 · 동물 · 붙박이 NPC(굴지기·낚시꾼 등)
 *   가운데(나) 탭        가까이 ↔ 멀리
 *   두 번 탭            접는다
 *
 * `project`·`cells`·`blips`(값을 내는 함수)는 판정에 한 줄도 안 닿는다 —
 * `village.raw()`를 읽기만 하고 캔버스 없이도 돈다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var RANGES = [10, 18];         // 반경(칸) — 탭하면 번갈아 든다

  var TINT = {
    path: '#8d8674', water: '#2f6591', sand: '#cfc08a',
    grass: '#3f5f42', grass_meadow: '#5a7a3f', grass_dark: '#2d4c31',
    grass_mush: '#4a5a6e', grass_rocky: '#5c584f'
  };

  var STYLE = {
    resident: { c: '#f2e4b6', r: 2.6 },
    animal:   { c: '#8affb0', r: 2.2 },
    npc:      { c: '#7fd0ff', r: 3.2 },
    hint:     { c: '#ffd75a', r: 3.6 }       // 나그네가 일러 준 정령의 터(금빛 원) — PLAN §5.5 ①
  };

  var node = null, canvas = null, ctx = null;
  var step = 0, folded = false;
  var acc = 0, lastTap = 0;
  var heading = -Math.PI / 2;
  var lastPos = null;
  var drawn = 0;

  function V() { return global.DG.village; }
  function on() { return core.tuned('minimap.on', 1) ? true : false; }
  function sizePx() {
    var narrow = global.innerWidth && global.innerWidth <= 600;
    return core.tuned('minimap.size', narrow ? 104 : 128);
  }
  function everySec() { return core.tuned('minimap.everySec', 0.16); }
  function tileSize() { var v = V(); return v ? v.TILE : 40; }

  /** 지금 반지름(월드 단위) — RANGES는 칸 수, 실제 계산은 TILE을 곱한다 */
  function range() {
    var i = step % RANGES.length;
    return core.tuned('minimap.range', RANGES[i]) * tileSize();
  }

  function project(pos, x, y, r) {
    var dx = (x - pos.x) / r, dy = (y - pos.y) / r;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d <= 1) { return { dx: dx, dy: dy, d: d, edge: false }; }
    if (d === 0) { return { dx: 0, dy: 0, d: 0, edge: false }; }
    return { dx: dx / d, dy: dy / d, d: d, edge: true };
  }

  function cells(pos, r) {
    var v = V();
    if (!v || !v.tileAt) { return []; }
    var T = tileSize(), w = T / r;
    var x0 = Math.floor((pos.x - r) / T), x1 = Math.floor((pos.x + r) / T);
    var y0 = Math.floor((pos.y - r) / T), y1 = Math.floor((pos.y + r) / T);
    var out = [], tx, ty;
    for (ty = y0; ty <= y1; ty++) {
      for (tx = x0; tx <= x1; tx++) {
        out.push({
          tx: tx, ty: ty, kind: v.tileAt(tx, ty),
          dx: (tx * T - pos.x) / r, dy: (ty * T - pos.y) / r, w: w
        });
      }
    }
    return out;
  }

  /** 판 위에 찍을 것들 — 주민·동물·붙박이 NPC. `village.raw()`가 낸 목록을 그대로 훑는다 */
  function blips(pos, r, run) {
    var out = [], i, pr;
    function put(kind, x, y, keepEdge) {
      pr = project(pos, x, y, r);
      if (pr.edge && !keepEdge) { return; }
      out.push({ t: kind, dx: pr.dx, dy: pr.dy, d: pr.d * r, edge: pr.edge });
    }
    if (run.residents) { for (i = 0; i < run.residents.length; i++) { put('resident', run.residents[i].x, run.residents[i].y, true); } }
    if (run.animals) { for (i = 0; i < run.animals.length; i++) { put('animal', run.animals[i].x, run.animals[i].y); } }
    if (run.npcs) { for (i = 0; i < run.npcs.length; i++) { put('npc', run.npcs[i].x, run.npcs[i].y, true); } }
    var hn = global.DG.grid && global.DG.grid.hint ? global.DG.grid.hint() : null;
    if (hn) { put('hint', hn.x, hn.y, true); out[out.length - 1].hr = hn.r; }
    return out;
  }

  function aim(pos) {
    if (lastPos) {
      var dx = pos.x - lastPos.x, dy = pos.y - lastPos.y;
      if (dx * dx + dy * dy > 0.04) { heading = Math.atan2(dy, dx); }
    }
    lastPos = { x: pos.x, y: pos.y };
    return heading;
  }

  /* ── 화면 ─────────────────────────────────────────────── */

  function mount() {
    if (node || !global.document) { return null; }
    node = global.document.createElement('div');
    node.id = 'minimap';
    node.className = 'glass';
    node.setAttribute('title', '미니맵 — 가운데를 탭하면 배율, 두 번 탭하면 접힙니다');
    canvas = global.document.createElement('canvas');
    node.appendChild(canvas);
    var tag = global.document.createElement('b');
    tag.className = 'mm-range';
    node.appendChild(tag);
    global.document.body.appendChild(node);
    node.addEventListener('click', tap);
    return node;
  }

  function tap(e) {
    if (e && e.preventDefault) { e.preventDefault(); }
    var now = Date.now();
    var dbl = now - lastTap < 320;
    lastTap = now;
    if (dbl) { folded = !folded; step = 0; remember(); apply(); draw(); return; }
    if (folded) { folded = false; remember(); apply(); draw(); return; }
    step = (step + 1) % RANGES.length;
    remember();
    apply();
    draw();
  }

  function remember() {
    if (!core.save || !core.save.settings) { return; }
    core.save.settings.minimap = (folded ? -1 : step);
  }
  function recall() {
    var v = core.save && core.save.settings ? core.save.settings.minimap : undefined;
    if (v === undefined || v === null) { return; }
    if (v < 0) { folded = true; step = 0; } else { folded = false; step = v % RANGES.length; }
  }

  function apply() {
    if (!node) { return; }
    node.classList.toggle('folded', folded);
    var tag = node.querySelector('.mm-range');
    if (tag) { tag.textContent = folded ? '🗺️' : (RANGES[step % RANGES.length] + '칸'); }
  }

  function resize() {
    if (!canvas) { return 0; }
    var s = sizePx();
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(s * dpr)) {
      canvas.width = Math.round(s * dpr);
      canvas.height = Math.round(s * dpr);
      canvas.style.width = s + 'px';
      canvas.style.height = s + 'px';
      ctx = null;
    }
    if (!ctx) { ctx = canvas.getContext('2d'); }
    return dpr;
  }

  function draw() {
    var v = V();
    if (!on() || folded || !canvas || !v) { return 0; }
    var run = v.raw();
    if (!run || !run.player) { return 0; }
    /* 실내(indoors)·동굴 안에서는 마을 좌표가 없다 — 접어 둔 것처럼 그냥 안 그린다 */
    if (v.indoors && v.indoors()) { return 0; }
    if (v.caveInside && v.caveInside()) { return 0; }
    var dpr = resize();
    if (!ctx) { return 0; }

    var pos = run.player;
    var r = range(), t = Date.now();
    var s = sizePx(), c = s / 2, rad = c - 3;
    var ang = aim(pos);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s, s);

    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, rad, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#161a21';
    ctx.fillRect(0, 0, s, s);
    var cs = cells(pos, r), i;
    for (i = 0; i < cs.length; i++) {
      ctx.fillStyle = TINT[cs[i].kind] || TINT.grass;
      ctx.fillRect(c + cs[i].dx * rad - 0.5, c + cs[i].dy * rad - 0.5,
                   cs[i].w * rad + 1, cs[i].w * rad + 1);
    }

    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c, c, rad * 0.5, 0, Math.PI * 2); ctx.stroke();

    var bs = blips(pos, r, run), st;
    drawn = bs.length;
    for (i = 0; i < bs.length; i++) {
      st = STYLE[bs[i].t] || STYLE.resident;
      ctx.globalAlpha = bs[i].edge ? 0.55 : 1;
      ctx.fillStyle = st.c;
      ctx.beginPath();
      var rr = bs[i].edge ? rad * 0.93 : rad;
      if (bs[i].t === 'hint' && !bs[i].edge) {          // 힌트는 점이 아니라 원 — 그 안 어딘가에 터가 있다
        ctx.strokeStyle = st.c; ctx.lineWidth = 1.6;
        ctx.arc(c + bs[i].dx * rr, c + bs[i].dy * rr, Math.max(4, bs[i].hr / r * rad), 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      ctx.arc(c + bs[i].dx * rr, c + bs[i].dy * rr,
              bs[i].edge ? st.r * 0.7 : st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(245,180,69,.22)';
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, rad * 0.42, ang - 0.5, ang + 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5b445';
    ctx.beginPath(); ctx.arc(c, c, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c, c, rad, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.strokeText('北', c, 12);
    ctx.fillStyle = 'rgba(255,255,255,.82)';
    ctx.fillText('北', c, 12);

    return drawn;
  }

  function init() {
    if (!on()) { return false; }
    recall();
    mount();
    apply();
    draw();
    return true;
  }

  function tick(dt) {
    if (!on() || !node) { return false; }
    acc += dt;
    if (acc < everySec()) { return false; }
    acc = 0;
    draw();
    return true;
  }

  function stats() {
    return { on: on(), folded: folded, range: range(), size: sizePx(), mounted: !!node, drawn: drawn };
  }

  global.DG = global.DG || {};
  global.DG.minimap = {
    RANGES: RANGES, TINT: TINT, STYLE: STYLE,
    project: project, cells: cells, blips: blips,
    init: init, tick: tick, draw: draw, resize: resize, stats: stats,
    on: on, range: range,
    get folded() { return folded; },
    set: function (o) {
      if (!o) { return; }
      if (typeof o.step === 'number') { step = o.step % RANGES.length; }
      if (typeof o.folded === 'boolean') { folded = o.folded; }
      apply(); draw();
    },
    reset: function () { step = 0; folded = false; lastPos = null; heading = -Math.PI / 2; }
  };
})(window);
