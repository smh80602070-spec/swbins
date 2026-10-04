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
  var TOOLS = [{ k: 'select', n: '선택', i: '🖱️' }, { k: 'pan', n: '이동', i: '✋' }, { k: 'road', n: '도로', i: '🛣️' }, { k: 'house', n: '주거', i: '🏠' }, { k: 'farm', n: '농지', i: '🌾' },
    { k: 'market', n: '시장', i: '🏪' }, { k: 'workshop', n: '공방', i: '🔨' }, { k: 'barracks', n: '군영', i: '⚔️' }, { k: 'well', n: '우물', i: '💧' }, { k: 'tower', n: '망루', i: '🗼' }, { k: 'wall', n: '성벽', i: '🧱' }, { k: 'erase', n: '철거', i: '🧹' }];

  var R = function () { return global.DG.rts; };
  var S = null, cv, ctx, mini, mctx, miniBase = null, els = {};
  var cam = { x: 80, y: 50, z: 1.4 }, tool = 'select', hover = null, ptrs = {}, pinch = 0, painting = false, panning = false, panLast = null;
  var sel = {}, selB = 0, box = null, down = null;   // 고른 유닛 id 모음 · 고른 군영 id · 끌고 있는 선택 상자 · 눌린 자리
  var acc = 0, lastT = 0, lastHud = 0, lastSaveDay = 0, tipMsg = '', tipUntil = 0, dirty = true, overlay = 0, lastStats = null, overSeen = false, pokeUntil = 0;
  var OVERLAYS = ['보기: 없음', '보기: 행복', '보기: 닿는 범위'];

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
    var art = R().art, p00 = toScreen(0, 0), roadRects = [], roadBad = [], spr = [];
    if (!art.terrain(ctx, S.tiles, g, x0, x1, y0, y1, p00.x, p00.y, z)) {   // 새 타일 그림(art.js) — 못 받았으면 옛 색 칸
      for (y = y0; y <= y1; y++) {
        for (x = x0; x <= x1; x++) {
          p = toScreen(x, y);
          ctx.fillStyle = COLORS[S.tiles[g.idx(x, y)]][(x + y) & 1];
          ctx.fillRect(p.x, p.y, Math.ceil(z), Math.ceil(z));
        }
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
      if (d.road) { roadRects.push([b.x, b.y]); if (!b.conn) { roadBad.push(bp); } continue; }   // 길은 아래에서 흙길 타일로 한꺼번에
      if (art.spriteReady(b.t)) { spr.push({ b: b, d: d, x: bp.x, y: bp.y }); ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(bp.x + 1, bp.y + 1, d.w * z - 2, d.h * z - 2); continue; }   // 그림이 있으면 그림으로
      ctx.fillStyle = d.color; ctx.fillRect(bp.x + 1, bp.y + 1, d.w * z - 2, d.h * z - 2);
      if (!d.road) {
        ctx.strokeStyle = b.conn ? 'rgba(255,255,255,.55)' : '#ff5a4a'; ctx.lineWidth = b.conn ? 1 : 2;
        ctx.strokeRect(bp.x + 1.5, bp.y + 1.5, d.w * z - 3, d.h * z - 3);
        if (z >= 12 && d.icon) { ctx.font = Math.floor(Math.min(d.w, d.h) * z * 0.55) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000'; ctx.fillText(d.icon, bp.x + d.w * z / 2, bp.y + d.h * z / 2); }
        if (!b.conn && z >= 12) { ctx.font = Math.floor(z * 0.7) + 'px sans-serif'; ctx.fillStyle = '#ff5a4a'; ctx.textAlign = 'left'; ctx.fillText('⚠', bp.x + 2, bp.y + z * 0.5); }
      }
    }
    if (!art.roads(ctx, roadRects, p00.x, p00.y, z)) {   // 흙길 타일 — 못 받았으면 옛 회색 칸
      ctx.fillStyle = D.road.color;
      roadRects.forEach(function (r) { var q = toScreen(r[0], r[1]); ctx.fillRect(q.x + 1, q.y + 1, z - 2, z - 2); });
    }
    roadBad.forEach(function (q) { ctx.fillStyle = 'rgba(255,90,74,.35)'; ctx.fillRect(q.x + 1, q.y + 1, z - 2, z - 2); });
    art.sprites(ctx, spr, z);   // 건물 그림(y 순)
    spr.forEach(function (e) {
      if (e.b.conn) { return; }
      ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 2; ctx.strokeRect(e.x + 1.5, e.y + 1.5, e.d.w * z - 3, e.d.h * z - 3);
      if (z >= 12) { ctx.font = Math.floor(z * 0.7) + 'px sans-serif'; ctx.fillStyle = '#ff5a4a'; ctx.textAlign = 'left'; ctx.fillText('⚠', e.x + 2, e.y + z * 0.5); }
    });
    if (overlay) { drawOverlay(); }
    drawUnits();
    if (hover && isBuildTool(tool)) { drawGhost(); }
    if (box) { ctx.fillStyle = 'rgba(120,220,255,.14)'; ctx.strokeStyle = '#7fdcff'; ctx.lineWidth = 1; ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0); ctx.strokeRect(box.x0 + .5, box.y0 + .5, box.x1 - box.x0, box.y1 - box.y0); }
    drawMini(); dirty = false;
  }

  /** 보기 겹침 — 1 행복(주거 색: 빨강→초록) · 2 시설 닿는 범위(우물·망루 원, 닿은 주거 초록 테두리) */
  function drawOverlay() {
    var D = R().rules.DEFS, E = R().econ, z = px(), id, b, d, bp, h, cov, gl = lastStats ? lastStats.globalHappy : 0;
    for (id in S.buildings) {
      b = S.buildings[id]; d = D[b.t]; bp = toScreen(b.x, b.y);
      if (overlay === 1 && b.t === 'house') {
        h = E.houseHappy(S, b, gl); ctx.fillStyle = 'hsla(' + Math.round(h * 1.2) + ',85%,48%,.62)'; ctx.fillRect(bp.x + 1, bp.y + 1, d.w * z - 2, d.h * z - 2);
        if (z >= 14) { ctx.font = Math.floor(z * 0.7) + 'px sans-serif'; ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(Math.round(h), bp.x + d.w * z / 2, bp.y + d.h * z / 2); }
      } else if (overlay === 2) {
        if (d.radius && d.happy) {
          ctx.beginPath(); ctx.arc(bp.x + d.w * z / 2, bp.y + d.h * z / 2, d.radius * z, 0, 6.2832);
          ctx.fillStyle = b.t === 'well' ? 'rgba(90,167,214,.18)' : 'rgba(201,115,58,.18)'; ctx.fill(); ctx.strokeStyle = b.t === 'well' ? '#5aa7d6' : '#c9733a'; ctx.lineWidth = 1.5; ctx.stroke();
        } else if (b.t === 'house') {
          cov = E.coverage(S, b); ctx.strokeStyle = cov > 0 ? '#7be08a' : 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.strokeRect(bp.x + 2, bp.y + 2, d.w * z - 4, d.h * z - 4);
        }
      }
    }
  }

  function isBuildTool(k) { return !!R().rules.DEFS[k] || k === 'erase'; }

  /** 유닛 — 색 원+글자, 고른 유닛은 금빛 고리와 목적지 선, 다친 유닛은 체력 막대 */
  function drawUnits() {
    var U = R().units, id, u, p, z = px(), r = z * 0.34, d, gp;
    for (id in S.units) {
      u = S.units[id]; d = U.statOf(u); p = toScreen(u.x, u.y);
      if (p.x < -20 || p.y < -20 || p.x > size().w + 20 || p.y > size().h + 20) { continue; }
      if (sel[id]) {
        if (u.path && u.path.length && u.goal) { gp = toScreen(u.goal.x + .5, u.goal.y + .5); ctx.strokeStyle = 'rgba(255,230,120,.55)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(gp.x, gp.y); ctx.stroke(); ctx.setLineDash([]); }
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 3, 0, 6.2832); ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 2; ctx.stroke();
      }
      if (R().art.unit(ctx, u, p, z, Date.now())) {   // 새 몸 그림(art.js) — 발 밑에 팀색 고리
        ctx.beginPath(); ctx.ellipse(p.x, p.y + z * 0.32, r * 0.95, r * 0.38, 0, 0, 6.2832); ctx.strokeStyle = u.team === 0 ? '#2b8fe8' : '#e8402b'; ctx.lineWidth = 2; ctx.stroke();
      } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fillStyle = d.color; ctx.fill(); ctx.strokeStyle = u.team === 0 ? '#2b6fb8' : '#b83a2b'; ctx.lineWidth = 2; ctx.stroke();
      if (z >= 14) { ctx.font = Math.floor(r * 1.3) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000'; ctx.fillText(d.icon, p.x, p.y + 1); }
      }
      var mh = u.mhp || d.hp; if (u.hp < mh) { ctx.fillStyle = '#300'; ctx.fillRect(p.x - r, p.y - r - 7, r * 2, 4); ctx.fillStyle = '#6fe07a'; ctx.fillRect(p.x - r, p.y - r - 7, r * 2 * u.hp / mh, 4); }
    }
    if (selB && S.buildings[selB]) { var b = S.buildings[selB], D = R().rules.DEFS[b.t], bp = toScreen(b.x, b.y); ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 2.5; ctx.strokeRect(bp.x - 1, bp.y - 1, D.w * z + 2, D.h * z + 2); }
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
    if (d.radius) { ctx.beginPath(); ctx.arc(p.x + w * z / 2, p.y + h * z / 2, d.radius * z, 0, 6.2832); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
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
      '<span title="일하는 사람 / 일자리">⚒️ <b>' + st.workers + '</b>/' + st.jobs + '</span>' +
      '<span title="행복 — 우물·망루가 닿고 식량이 넉넉하고 세율이 낮을수록 높다. 25 미만이면 사람이 떠난다">😊 <b class="' + (st.happy < 25 ? 'neg' : st.happy >= 60 ? 'pos' : '') + '">' + Math.round(st.happy) + '</b></span>' +
      '<span title="병력 — 유닛 1기당 식량 0.2/일">🛡️ <b>' + st.army + '</b></span>' +
      '<span title="거점 체력 — 0 이 되면 진다">🏯 <b class="' + (S.cHp < 150 ? 'neg' : '') + '">' + Math.ceil(S.cHp) + '</b></span>' +
      '<span class="rt-raid" title="다음 습격까지 남은 날 · 쓰러뜨린 적">⚔️ <b class="' + (R().combat.daysToRaid(S) <= 1 ? 'neg' : '') + '">' + (S.won ? '끝' : R().combat.daysToRaid(S) + '일') + '</b> · ' + (S.kills || 0) + '승</span>' +
      (S.buildings[-1] ? '<span title="적 기지 체력 — 쓰러뜨리면 이긴다(거점에서 ' + (S.buildings[-1].x > R().grid.castleSite().x ? '동쪽' : '서쪽') + ' 멀리)">🏴 <b>' + Math.ceil(S.buildings[-1].hp) + '</b> ' + (S.buildings[-1].x > R().grid.castleSite().x ? '→' : '←') + '</span>' : '') +
      '<span class="rt-dem" title="수요 — 막대가 길수록 그걸 더 지어야 한다">' + dem('주거', st.demand.housing) + dem('일터', st.demand.work) + dem('식량', st.demand.food) + '</span>';
    lastStats = st;
    var btns = els.tools.querySelectorAll('button[data-tool]'), i, t, d;
    for (i = 0; i < btns.length; i++) {
      t = btns[i].getAttribute('data-tool'); d = R().rules.DEFS[t];
      btns[i].classList.toggle('on', t === tool);
      btns[i].classList.toggle('poor', !!(d && d.cost > r.gold));
    }
    var sp = els.speed.querySelectorAll('button'); for (i = 0; i < sp.length; i++) { sp[i].classList.toggle('on', +sp[i].getAttribute('data-speed') === S.speed); }
    var tx = els.opts.querySelectorAll('button[data-tax]'); for (i = 0; i < tx.length; i++) { tx[i].classList.toggle('on', +tx[i].getAttribute('data-tax') === S.tax); }
    els.opts.querySelector('button[data-view]').textContent = OVERLAYS[overlay];
    selPanel();
    els.tip.textContent = S.won ? '적 기지를 무너뜨렸다 — 평정!' : S.over ? '거점이 무너졌다' : Date.now() < tipUntil ? tipMsg : tipFor();
    els.tip.classList.toggle('warn', S.over || S.won || Date.now() < tipUntil);
  }
  /** 고른 군영(생산 단추·큐)이나 고른 유닛 수 — 왼쪽 아래 상자 */
  function selPanel() {
    var U = R().units, h = '', n = 0, id, kinds = {}, b = selB ? S.buildings[selB] : null, q, i;
    if (b && b.t === 'barracks') {
      q = S.queues[selB] || [];
      h += '<div class="sl-h"><b>군영</b> <small>' + (b.conn ? '' : '— 도로로 이어지지 않았습니다') + '</small></div><div class="sl-btns">';
      U.UNIT_ORDER.forEach(function (t) { var d = U.UDEF[t]; h += '<button data-train="' + t + '" title="' + d.name + ' ' + d.gold + '금 ' + d.food + '식량"><span>' + d.icon + '</span><small>' + d.name + '<br>' + d.gold + '금 ' + d.food + '식</small></button>'; });
      h += R().heroes.recruitBtn(S) + '</div><div class="sl-q">';
      for (i = 0; i < U.QUEUE_MAX; i++) { h += q[i] ? '<i title="' + U.UDEF[q[i].t].name + '">' + U.UDEF[q[i].t].icon + (i === 0 ? '<u style="width:' + Math.round(100 - q[0].left / U.UDEF[q[0].t].train * 100) + '%"></u>' : '') + '</i>' : '<i class="e"></i>'; }
      h += '</div>';
    } else {
      for (id in sel) { if (S.units[id]) { n++; kinds[S.units[id].t] = (kinds[S.units[id].t] || 0) + 1; } }
      if (n) { h += '<div class="sl-h"><b>선택 ' + n + '기</b></div><div class="sl-u">' + Object.keys(kinds).map(function (t) { return U.UDEF[t].icon + ' ' + U.UDEF[t].name + ' ' + kinds[t]; }).join(' · ') + '</div><small>우클릭(폰은 땅을 눌러)으로 이동</small>' + R().heroes.skillBtn(S, sel); }
      else if (U.count(S, 0)) { h += '<div class="sl-btns"><button data-all="1" title="내 군대 전부 고르기"><span>🛡️</span><small>전군<br>선택</small></button></div>'; }
    }
    if (h !== els.sel.__h) { els.sel.innerHTML = h; els.sel.__h = h; }
    els.sel.classList.toggle('show', !!h);
  }

  function dem(label, v) { return '<i class="dm"><u>' + label + '</u><b style="width:' + Math.round(v * 100) + '%"></b></i>'; }
  function tipFor() {
    if (!hover) { return R().guide.text(S) || '도구를 고르고 칸을 누르세요 · 건물은 도로로 거점에 이어져야 돕니다'; }   // 다음 할 일(guide.js)
    var b = R().rules.buildingAt(S, hover.x, hover.y), D = R().rules.DEFS;
    if (b && b.t === 'stronghold') { return D.stronghold.name + ' · 체력 ' + Math.ceil(b.hp) + ' — 유닛으로 쳐서 무너뜨리면 이긴다'; }
    if (b) { return D[b.t].name + (b.t === 'castle' ? '' : (b.conn ? ' · 돌고 있음' : ' · 도로로 이어지지 않았습니다')); }
    if (isBuildTool(tool) && tool !== 'erase') { var c = R().rules.canPlace(S, tool, hover.x, hover.y); return D[tool].name + ' ' + D[tool].cost + '금' + (c.ok ? '' : ' — ' + c.why); }
    return '(' + hover.x + ', ' + hover.y + ')';
  }
  function say(msg) { tipMsg = msg; tipUntil = Date.now() + 1800; }

  /* ── 입력 ───────────────────────────────────────────── */

  function applyAt(t) {
    var rules = R().rules, D = rules.DEFS;
    if (tool === 'erase') {
      var b = rules.buildingAt(S, t.x, t.y);
      if (b && !D[b.t].fixed) { rules.remove(S, b.id); if (selB === b.id) { selB = 0; } dirty = true; }
      return;
    }
    if (!isBuildTool(tool)) { return; }
    var c = rules.canPlace(S, tool, t.x, t.y);
    if (!c.ok) { say(c.why); return; }
    rules.place(S, tool, t.x, t.y); dirty = true;
  }

  /** 상자(작게 끌면 클릭) 선택 — 유닛 먼저, 없으면 군영·건물 */
  function finishBox(p) {
    var b = box, U = R().units, id, u, sp; box = null; dirty = true;
    if (!down || !down.moved) {
      var t = toTile(p.x, p.y), best = null, bd = 0.8, dd;
      for (id in S.units) { u = S.units[id]; if (u.team !== 0) { continue; } dd = Math.hypot(u.x - (p.x - size().w / 2) / px() - cam.x, u.y - (p.y - size().h / 2) / px() - cam.y); if (dd < bd) { bd = dd; best = u; } }
      sel = {}; selB = 0;
      if (best) { sel[best.id] = true; return; }
      var bb = R().rules.buildingAt(S, t.x, t.y); if (bb && bb.t === 'barracks') { selB = bb.id; }
      return;
    }
    var x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
    sel = {}; selB = 0;
    for (id in S.units) { u = S.units[id]; if (u.team !== 0) { continue; } sp = toScreen(u.x, u.y); if (sp.x >= x0 && sp.x <= x1 && sp.y >= y0 && sp.y <= y1) { sel[id] = true; } }
    void U;
  }

  /** 폰에서 짧게 누름 — 내 유닛이면 고르고, 군영이면 군영을 고르고, 아니면 고른 유닛이 있을 때 그 칸으로 보낸다 */
  function tapAt(p) {
    var id, u, best = null, bd = 0.8, dd, t = toTile(p.x, p.y), bb;
    for (id in S.units) { u = S.units[id]; if (u.team !== 0) { continue; } dd = Math.hypot(u.x - (p.x - size().w / 2) / px() - cam.x, u.y - (p.y - size().h / 2) / px() - cam.y); if (dd < bd) { bd = dd; best = u; } }
    if (best) { sel = {}; selB = 0; sel[best.id] = true; return; }
    bb = R().rules.buildingAt(S, t.x, t.y);
    if (bb && bb.t === 'barracks') { sel = {}; selB = bb.id; return; }
    if (Object.keys(sel).some(function (k) { return S.units[k]; })) { commandMove(p); return; }
    sel = {}; selB = 0;
  }

  /** 우클릭(끌지 않음) — 고른 유닛을 그 칸으로 보낸다(둘레에 흩어서) */
  function commandMove(p) {
    var ids = Object.keys(sel).filter(function (id) { return S.units[id]; }), t = toTile(p.x, p.y);
    if (!ids.length) { return; }
    if (!R().grid.inBounds(t.x, t.y)) { return; }
    R().units.moveGroup(S, ids.map(Number), t.x, t.y); dirty = true;
  }

  /** 고른 영웅들이 일격(Q) — 맞힌 적이 없으면 안내 */
  function castSel() {
    var n = 0, id;
    for (id in sel) { if (S.units[id]) { n += R().combat.cast(S, S.units[id]); } }
    if (!n) { say('일격 — 2.5칸 안에 적이 없거나 쿨다운 중'); }
    dirty = true; hud();
  }
  /** 새 판을 열 때 난이도를 묻는다 — 고르기 전엔 멈춰 있다. 이어하기·주소의 ?diff= 가 있으면 안 묻는다 */
  function askDiff(end) {
    var box2 = global.document.createElement('div'), names = R().rules.DIFF.names;
    box2.id = 'rts-diff'; box2.className = 'rt-box';
    box2.innerHTML = (end ? '<h3>' + (S.won ? '🏆 평정!' : '💀 거점이 무너졌다') + '</h3><p>' + S.day + '일 · 막아 낸 파도 ' + Math.max(0, S.raid.n - (S.over ? 1 : 0)) + ' · 쓰러뜨린 적 ' + (S.kills || 0) + ' — 난이도를 골라 새 판을 시작하세요.</p>'
      : '<h3>난이도</h3><p>적 기지가 멀리 서 있다. 군대를 키워 쳐부수거나, 거점이 먼저 무너지면 진다.</p>') + names.map(function (n, i) { return '<button data-diff="' + i + '"' + (i === 1 ? ' class="on"' : '') + '>' + n + '</button>'; }).join('');
    global.document.body.appendChild(box2); S.speed = 0;
    box2.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-diff]'); if (!b) { return; }
      S = R().state.create(end ? (Date.now() & 0xffff) + 1 : S.seed, +b.getAttribute('data-diff')); if (/[?&]qa=1/.test(global.location ? global.location.search : '')) { R().state.qaPreset(S); }
      lastSaveDay = S.day; sel = {}; selB = 0; overSeen = false;
      var cs2 = R().grid.castleSite(); cam.x = cs2.x + 1.5; cam.y = cs2.y + 1.5;
      box2.parentNode.removeChild(box2); dirty = true; hud();
    });
  }
  function diffFromUrl() { var m = /[?&]diff=([012])/.exec(global.location ? global.location.search : ''); return m ? +m[1] : 1; }

  function pointerPos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function dist2() { var k = Object.keys(ptrs); return k.length === 2 ? Math.hypot(ptrs[k[0]].x - ptrs[k[1]].x, ptrs[k[0]].y - ptrs[k[1]].y) : 0; }

  function bindInput() {
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('pointerdown', function (e) {
      var p = pointerPos(e); ptrs[e.pointerId] = p; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* noop */ }
      if (Object.keys(ptrs).length === 2) { pinch = dist2(); painting = false; panning = false; return; }
      down = { btn: e.button, x: p.x, y: p.y, moved: false };
      if (e.button === 1 || e.button === 2 || e.shiftKey || tool === 'pan') { panning = true; panLast = p; return; }
      if (tool === 'select' && e.pointerType === 'touch') { down.touch = true; panning = true; panLast = p; return; }   // 폰: 끌면 지도 이동, 짧게 누르면 고르기·명령
      if (tool === 'select') { box = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; return; }
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
      if (down && Math.abs(p.x - down.x) + Math.abs(p.y - down.y) > 5) { down.moved = true; }
      if (box) { box.x1 = p.x; box.y1 = p.y; return; }
      if (panning && panLast) { cam.x -= (p.x - panLast.x) / px(); cam.y -= (p.y - panLast.y) / px(); panLast = p; clampCam(); return; }
      if (painting && (tool === 'road' || tool === 'erase')) { applyAt(hover); }
    });
    function up(e) {
      var p = pointerPos(e);
      if (down && down.btn === 2 && !down.moved) { commandMove(p); }
      else if (down && down.touch && !down.moved) { tapAt(p); dirty = true; }
      if (box) { finishBox(p); }
      down = null; delete ptrs[e.pointerId];
      if (!Object.keys(ptrs).length) { painting = false; panning = false; panLast = null; pinch = 0; }
    }
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
      if (k === 'Escape') { tool = 'select'; sel = {}; selB = 0; }
      else if (k === ' ') { S.speed = S.speed === 0 ? 1 : 0; e.preventDefault(); }
      else if (k === 'x' || k === 'X') { tool = 'erase'; }
      else if (k === 'q' || k === 'Q') { castSel(); }
      else if (/^[1-9]$/.test(k)) { n = +k; tool = TOOLS.filter(function (t) { return !!R().rules.DEFS[t.k]; })[n - 1].k; }
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
    els.sel.addEventListener('click', function (e) {
      var al = e.target.closest('button[data-all]');
      if (al) { var k; sel = {}; selB = 0; for (k in S.units) { if (S.units[k].team === 0) { sel[k] = true; } } dirty = true; hud(); return; }
      var hb = e.target.closest('button[data-hero]'), sk = e.target.closest('button[data-skill]');
      if (hb && selB) { var hr = R().heroes.train(S, selB); if (!hr.ok) { say(hr.why); } hud(); return; }
      if (sk) { castSel(); return; }
      var b = e.target.closest('button[data-train]'); if (!b || !selB) { return; }
      var r = R().units.train(S, selB, b.getAttribute('data-train'));
      if (!r.ok) { say(r.why); } hud();
    });
    els.opts.addEventListener('click', function (e) {
      var t = e.target.closest('button[data-tax]'), v = e.target.closest('button[data-view]');
      if (t) { S.tax = +t.getAttribute('data-tax'); }
      if (v) { overlay = (overlay + 1) % OVERLAYS.length; }
      dirty = true; hud();
    });
    els.speed.addEventListener('click', function (e) { var b = e.target.closest('button[data-speed]'); if (b) { S.speed = +b.getAttribute('data-speed'); } });
    global.addEventListener('beforeunload', save);
    global.document.addEventListener('visibilitychange', function () { if (global.document.hidden) { save(); } });
  }

  /* ── 저장·시간 ─────────────────────────────────────── */

  function save() {
    var c = global.DG.core; if (!S || !c || !c.save || S.over || S.won) { return; }
    c.save.rts = R().state.serialize(S); c.persist(); lastSaveDay = S.day;
  }

  function loop(t) {
    var dt = Math.min(250, t - (lastT || t)); lastT = t;
    if (!pokeUntil) { pokeUntil = t + 10000; }
    if (t < pokeUntil) { dirty = true; }   // 새 그림(타일·건물·몸)이 받아지는 동안
    if (S.speed > 0) {
      acc += dt * S.speed; var n = 0;
      while (acc >= TICK_MS && n < 40) {
        acc -= TICK_MS; n++; S.tick++; R().units.tick(S); R().combat.tick(S); dirty = true;
        if ((S.over || S.won) && !overSeen) { overSeen = true; var cc = global.DG.core; if (cc && cc.save) { cc.save.rts = null; cc.persist(); } askDiff(true); }   // 판이 끝났다 — 저장을 비우고 결과 창에서 새 판을 고른다
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
      '<div id="rts-tools" class="rt-box">' + TOOLS.map(function (t, i) { var d = R().rules.DEFS[t.k]; return '<button data-tool="' + t.k + '" title="' + t.n + (R().rules.DEFS[t.k] ? ' (' + (i - 1) + ')' : '') + '"><span>' + t.i + '</span><small>' + t.n + (d && d.cost ? ' ' + d.cost : '') + '</small></button>'; }).join('') + '</div>' +
      '<canvas id="rts-mini" class="rt-box" width="240" height="150"></canvas><div id="rts-tip" class="rt-box"></div><div id="rts-sel" class="rt-box"></div><div id="rts-opts" class="rt-box"><span>세율</span><button data-tax="0">낮음</button><button data-tax="1">보통</button><button data-tax="2">높음</button><button data-view="1" class="vw">보기: 없음</button></div><a id="rts-back" class="rt-box" href="./">턴제로</a>');
    cv = $('rts-map'); ctx = cv.getContext('2d'); mini = $('rts-mini'); mctx = mini.getContext('2d');
    els = { top: $('rts-top'), tools: $('rts-tools'), speed: $('rts-speed'), tip: $('rts-tip'), opts: $('rts-opts'), sel: $('rts-sel') };
    var saved = c && c.save && c.save.rts ? R().state.restore(c.save.rts) : null;
    S = saved || R().state.create((Date.now() & 0xffff) + 1, diffFromUrl());
    if (!saved && /[?&]qa=1/.test(global.location ? global.location.search : '')) { R().state.qaPreset(S); }   // 시험 프리셋(?qa=1)
    lastSaveDay = S.day;
    var cs = R().grid.castleSite(); cam.x = cs.x + 1.5; cam.y = cs.y + 1.5;
    resize(); bindInput(); hud(); global.requestAnimationFrame(loop);
    if (!saved && !/[?&]diff=/.test(global.location ? global.location.search : '')) { askDiff(); }
  }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.view = { init: init, save: save, state: function () { return S; }, toScreen: toScreen, toTile: toTile, camera: cam, tool: function (t) { if (t) { tool = t; } return tool; } };
})(typeof window !== 'undefined' ? window : this);
