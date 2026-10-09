/**
 * RTS 화면 (W-0029, P1) — 캔버스 지도·카메라·도구 막대·HUD·미니맵·시간 루프. 규칙은 rts/rules·econ·state 가 쥐고 여기는 그리고 입력만 받는다.
 *
 *   조작: 이동 도구(기본)에서 끌면 지도가 움직인다 · 휠 확대 · 건물 도구를 고르고 칸을 누르면 짓는다(도로·철거는 끌며 연속)
 *         오른쪽·가운데 버튼이나 Shift+끌기도 이동 · WASD/방향키 이동 · 1~6 건물 · X 철거 · Esc 이동 · Space 일시정지
 *         폰: 한 손가락 끌기(이동 도구) · 두 손가락 핀치(확대) · 도구 단추 누르고 칸 누르기
 *   시간: 10Hz 고정 틱, 하루 = 50틱, 일시정지·1×·2×·4×. 10일마다·떠날 때 저장(`core.save.rts`).
 *
 * 턴 전투 모드(W-0081, 기본) — 건설·생산·실시간 틱 없이 rts/tactics.js 의 조조전식 턴 전투를 그린다. 옛 RTS 는 주소 `?mode=rts` 로만.
 *   조작: 내 유닛 누르기 → 파란 칸(이동)·빨간 적(공격) · 빨간 적을 바로 누르면 다가가 친다 · 끌면 지도 이동 · 턴 끝·자동 단추
 *   그림: 규칙은 한 번에 끝나고, 화면은 그 전 모습(ghost)에서 기록 줄을 하나씩 따라 움직여 보인다. 저장 `core.save.rtsTb`(옛 `save.rts` 안 건드림)
 */
(function (global) {
  'use strict';

  var TILE = 20, TICK_MS = 100, ZMIN = 0.35, ZMAX = 4;
  var COLORS = { 0: ['#6f9b4f', '#689448'], 1: ['#3f6b2e', '#3a6529'], 2: ['#8a8378', '#827b70'], 3: ['#4f8fbf', '#4888b8'] };
  var ICONS = { tower: 'tower', wall: 'wall' };   // K-0061 아이콘이 있는 도구(없으면 이모지)
  var TOOLS = [{ k: 'select', n: '선택', i: '🖱️' }, { k: 'pan', n: '이동', i: '✋' }, { k: 'road', n: '도로', i: '🛣️' }, { k: 'house', n: '주거', i: '🏠' }, { k: 'farm', n: '농지', i: '🌾' },
    { k: 'market', n: '시장', i: '🏪' }, { k: 'workshop', n: '공방', i: '🔨' }, { k: 'barracks', n: '군영', i: '⚔️' }, { k: 'well', n: '우물', i: '💧' }, { k: 'tower', n: '망루', i: '🗼' }, { k: 'wall', n: '성벽', i: '🧱' }, { k: 'erase', n: '철거', i: '🧹' }];

  var R = function () { return global.DG.rts; };
  var S = null, cv, ctx, mini, mctx, miniBase = null, els = {}, diffOpen = false;
  var cam = { x: 80, y: 50, z: 1.4 }, tool = 'select', hover = null, ptrs = {}, pinch = 0, painting = false, panning = false, panLast = null;
  var fogSt = null, fogOn = true, lastFog = 0;   // 전장 안개(W-0062) — js/rts/fog.js
  var amMode = false, edgeP = null, groups = {};   // 공격 이동 대기(A) · 마우스 위치(가장자리 스크롤) · 부대 번호 1~9 → 유닛 id 모음(W-0061, 저장 안 함)
  var sel = {}, selB = 0, box = null, down = null;   // 고른 유닛 id 모음 · 고른 군영 id · 끌고 있는 선택 상자 · 눌린 자리
  var acc = 0, lastT = 0, lastHud = 0, lastSaveDay = 0, tipMsg = '', tipUntil = 0, dirty = true, overlay = 0, lastStats = null, overSeen = false, pokeUntil = 0;
  var OVERLAYS = ['보기: 없음', '보기: 행복', '보기: 닿는 범위'];
  /* 턴 전투(W-0081) — 고른 유닛·표식·그림 줄(ghost 위에서 기록 줄을 하나씩) */
  var TB = false, tsel = 0, tReach = null, tTargets = [], tDanger = {}, ghost = null, anim = null, queue = [], busy = false, enemyAnim = false, animDone = null, floats = [], AK = 1;
  var SLIDE_T = 90, SLIDE_MAX = 520, HIT_T = 380, GAP_T = 80;

  function $(id) { return global.document.getElementById(id); }
  function fmt(n) { return String(Math.round(n * 10) / 10).replace(/\.0$/, ''); }
  function ic(n, e) { return R().art.icon(n, e); }
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
    if (!art.terrain(ctx, S.tiles, g, x0, x1, y0, y1, p00.x, p00.y, z, s.w, s.h, global.devicePixelRatio || 1)) {   // 새 타일 그림(art.js) — 못 받았으면 옛 색 칸
      for (y = y0; y <= y1; y++) {
        for (x = x0; x <= x1; x++) {
          p = toScreen(x, y);
          ctx.fillStyle = COLORS[S.tiles[g.idx(x, y)]][(x + y) & 1];
          ctx.fillRect(p.x, p.y, Math.ceil(z), Math.ceil(z));
        }
      }
    }
    if (z >= 14 && ((isBuildTool(tool) && tool !== 'erase') || TB)) {   // 격자선은 짓는 중에만(실시간이라 평소엔 안 보인다) · 턴 전투는 늘
      ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1; ctx.beginPath();
      for (x = x0; x <= x1 + 1; x++) { p = toScreen(x, y0); ctx.moveTo(p.x + .5, p.y); ctx.lineTo(p.x + .5, p.y + (y1 - y0 + 1) * z); }
      for (y = y0; y <= y1 + 1; y++) { p = toScreen(x0, y); ctx.moveTo(p.x, p.y + .5); ctx.lineTo(p.x + (x1 - x0 + 1) * z, p.y + .5); }
      ctx.stroke();
    }
    for (id in S.buildings) {
      b = S.buildings[id]; d = D[b.t];
      if (b.x + d.w < x0 || b.x > x1 + 1 || b.y + d.h < y0 || b.y > y1 + 1) { continue; }
      if (fogOn && b.t === 'stronghold' && !R().fog.seenAt(fogSt, b.x + d.w / 2, b.y + d.h / 2)) { continue; }   // 못 본 적 기지(W-0062)
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
    if (!art.roadsAuto(ctx, S, g, roadRects, p00.x, p00.y, z) && !art.roads(ctx, roadRects, p00.x, p00.y, z)) {   // 길 조각(K-0061) → 흙 타일 → 옛 회색 칸
      ctx.fillStyle = D.road.color;
      roadRects.forEach(function (r) { var q = toScreen(r[0], r[1]); ctx.fillRect(q.x + 1, q.y + 1, z - 2, z - 2); });
    }
    roadBad.forEach(function (q) { ctx.fillStyle = 'rgba(255,90,74,.35)'; ctx.fillRect(q.x + 1, q.y + 1, z - 2, z - 2); });
    art.decor(ctx, S.tiles, g, x0, x1, y0, y1, p00.x, p00.y, z, S.occ);   // 숲 나무·언덕 바위(점유 칸은 건너뜀)
    art.sprites(ctx, spr, z, S);   // 건물 그림(y 순)
    spr.forEach(function (e) {
      if (e.b.conn) { return; }
      ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 2; ctx.strokeRect(e.x + 1.5, e.y + 1.5, e.d.w * z - 3, e.d.h * z - 3);
      if (z >= 12) { ctx.font = Math.floor(z * 0.7) + 'px sans-serif'; ctx.fillStyle = '#ff5a4a'; ctx.textAlign = 'left'; ctx.fillText('⚠', e.x + 2, e.y + z * 0.5); }
    });
    if (fogOn && fogSt && fogSt.cv && !S.won && !S.over) { ctx.imageSmoothingEnabled = true; ctx.drawImage(fogSt.cv, p00.x, p00.y, g.W * z, g.H * z); }   // 전장 안개(W-0062) — 본 건물·유닛 밑, 유닛·표식 위
    if (overlay) { drawOverlay(); }
    if (TB) { drawMarks(); }
    drawUnits();
    art.fxs(ctx, S, toScreen, z, Date.now());   // 타격 불꽃·화살·불
    if (TB) { drawFloats(); }
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
    var U = R().units, id, u, p, z = px(), r = z * 0.34, d, gp, all = ghost || S.units;
    for (id in all) {
      u = all[id]; d = U.statOf(u); p = toScreen(u.x, u.y);
      if (fogOn && u.team === 1 && !S.won && !S.over && !R().fog.visibleAt(fogSt, u.x, u.y)) { continue; }   // 안개 속 적(W-0062)
      if (p.x < -20 || p.y < -20 || p.x > size().w + 20 || p.y > size().h + 20) { continue; }
      ctx.globalAlpha = TB && !ghost && u.team === 0 && S.tb.side === 0 && S.tb.acted[id] ? 0.5 : 1;   // 턴 전투: 행동 끝난 아군은 흐리게
      if (TB && +id === tsel && !busy) { ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, 6.2832); ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 3; ctx.stroke(); }
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
      var mh = u.mhp || d.hp; if (u.hp < mh) { ctx.fillStyle = '#300'; ctx.fillRect(p.x - r, p.y - r - 7, r * 2, 4); ctx.fillStyle = '#6fe07a'; ctx.fillRect(p.x - r, p.y - r - 7, r * 2 * Math.max(0, u.hp) / mh, 4); }
    }
    ctx.globalAlpha = 1;
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
    for (id in S.buildings) { b = S.buildings[id]; if (fogOn && b.t === 'stronghold' && !R().fog.seenAt(fogSt, b.x + 1, b.y + 1)) { continue; } mctx.fillStyle = b.t === 'castle' ? '#ffd36a' : D[b.t].color; mctx.fillRect(b.x * sx, b.y * sy, Math.max(1.5, D[b.t].w * sx), Math.max(1.5, D[b.t].h * sy)); }
    if (fogOn && fogSt && fogSt.cv && !S.won && !S.over) { mctx.imageSmoothingEnabled = true; mctx.drawImage(fogSt.cv, 0, 0, mini.width, mini.height); }
    mctx.strokeStyle = '#ffd36a'; mctx.lineWidth = 1.5;
    mctx.strokeRect((cam.x - s.w / 2 / z) * sx, (cam.y - s.h / 2 / z) * sy, s.w / z * sx, s.h / z * sy);
  }

  /* ── HUD ───────────────────────────────────────────── */

  function hud() {
    if (TB) { hudTurn(); return; }
    if (S.notes && S.notes.length) { say(S.notes.shift()); }   // 적 출정·건물 파괴 알림(W-0063)
    var st = R().econ.stats(S), r = S.res;
    els.top.innerHTML = '<b class="rt-day">' + S.day + '일</b>' +
      '<span title="식량">' + ic('food', '🌾') + ' <b>' + fmt(r.food) + '</b> <em class="' + (st.foodNet < 0 ? 'neg' : 'pos') + '">' + (st.foodNet >= 0 ? '+' : '') + fmt(st.foodNet) + '</em></span>' +
      '<span title="금">' + ic('gold', '🪙') + ' <b>' + fmt(r.gold) + '</b> <em class="' + (st.goldNet < 0 ? 'neg' : 'pos') + '">' + (st.goldNet >= 0 ? '+' : '') + fmt(st.goldNet) + '</em></span>' +
      '<span title="인구 / 수용">' + ic('pop', '👥') + ' <b>' + S.pop + '</b>/' + st.cap + '</span>' +
      '<span title="일하는 사람 / 일자리">' + ic('work', '⚒️') + ' <b>' + st.workers + '</b>/' + st.jobs + '</span>' +
      '<span title="행복 — 우물·망루가 닿고 식량이 넉넉하고 세율이 낮을수록 높다. 25 미만이면 사람이 떠난다">' + ic('happy', '😊') + ' <b class="' + (st.happy < 25 ? 'neg' : st.happy >= 60 ? 'pos' : '') + '">' + Math.round(st.happy) + '</b></span>' +
      '<span title="병력 — 유닛 1기당 식량 0.2/일">' + ic('troop', '🛡️') + ' <b>' + st.army + '</b></span>' +
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
      if (n) { h += '<div class="sl-h"><b>선택 ' + n + '기</b></div><div class="sl-u">' + Object.keys(kinds).map(function (t) { return U.UDEF[t].icon + ' ' + U.UDEF[t].name + ' ' + kinds[t]; }).join(' · ') + '</div><small>우클릭(폰은 땅을 눌러)으로 이동</small><div class="sl-row"><div class="sl-btns"><button data-stop="1" title="정지 (S)"><span>✋</span><small>정지<br>S</small></button><button data-am="1" title="공격 이동 (A) — 갈 곳을 클릭"><span>⚔️</span><small>공격 이동<br>A</small></button></div>' + R().heroes.skillBtn(S, sel) + '</div>'; }
      else if (U.count(S, 0)) { h += '<div class="sl-btns"><button data-all="1" title="내 군대 전부 고르기"><span>🛡️</span><small>전군<br>선택</small></button></div>'; }
    }
    /* W-0125 — 진행 막대 폭·일격 쿨다운 글자가 매 hud(250ms)마다 달라 단추 줄을 통째로 갈았고, 누르는 사이 단추 노드가 바뀌어 클릭이 자주 먹혔다.
       구성(이 두 값을 뺀 꼴)이 바뀔 때만 다시 쓰고, 두 값은 그 자리만 고친다 */
    var pw = /<u style="width:(\d+)%">/.exec(h), cdt = /<em class="cd">([^<]*)<\/em>/.exec(h), key = h.replace(/<u style="width:\d+%">/g, '<u>').replace(/<em class="cd">[^<]*<\/em>/g, '<em class="cd"></em>'), el;
    if (key !== els.sel.__h) { els.sel.innerHTML = h; els.sel.__h = key; }
    else { if (pw && (el = els.sel.querySelector('.sl-q u'))) { el.style.width = pw[1] + '%'; } if (cdt && (el = els.sel.querySelector('em.cd'))) { el.textContent = cdt[1]; } }
    els.sel.classList.toggle('show', !!h);
  }

  function dem(label, v) { return '<i class="dm"><u>' + label + '</u><b style="width:' + Math.round(v * 100) + '%"></b></i>'; }
  function tipFor() {
    if (!hover) { return R().guide.text(S) || '도구를 고르고 칸을 누르세요 · 건물은 도로로 거점에 이어져야 돕니다'; }   // 다음 할 일(guide.js)
    var b = R().rules.buildingAt(S, hover.x, hover.y), D = R().rules.DEFS;
    if (b && b.t === 'stronghold' && fogOn && !R().fog.seenAt(fogSt, hover.x, hover.y)) { b = null; }
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
    ids.forEach(function (id) { S.units[id].amGoal = null; });
    R().units.moveGroup(S, ids.map(Number), t.x, t.y); dirty = true;
  }

  var EDGE = 12;   // px — 화면 가장자리 스크롤 띠
  /** 마우스가 지도 가장자리에 붙어 있으면 지도를 민다(데스크톱, W-0061) */
  function edgeScroll(dt) {
    if (!edgeP || panning || pinch) { return; }
    var r = cv.getBoundingClientRect(), dx = 0, dy = 0, v;
    if (edgeP.x < r.left || edgeP.x > r.right || edgeP.y < r.top || edgeP.y > r.bottom) { return; }
    if (edgeP.x < r.left + EDGE) { dx = -1; } else if (edgeP.x > r.right - EDGE) { dx = 1; }
    if (edgeP.y < r.top + EDGE) { dy = -1; } else if (edgeP.y > r.bottom - EDGE) { dy = 1; }
    if (!dx && !dy) { return; }
    v = 14 / Math.sqrt(cam.z) * dt / 1000; cam.x += dx * v; cam.y += dy * v; clampCam(); dirty = true;
  }

  function liveIds() { return Object.keys(sel).filter(function (id) { return S.units[id]; }).map(Number); }
  /** A 뒤 클릭 — 가다가 적이 보이면 맞서 싸우고, 끝나면 이어 간다 */
  function attackMove(p) {
    var ids = liveIds(), t = toTile(p.x, p.y);
    if (!ids.length || !R().grid.inBounds(t.x, t.y)) { return; }
    R().units.moveGroup(S, ids, t.x, t.y);
    ids.forEach(function (id) { var u = S.units[id], g = u.want || u.goal; u.amGoal = g ? { x: g.x + 0.5, y: g.y + 0.5 } : { x: t.x + 0.5, y: t.y + 0.5 }; });   // W-0125 제 자리(moveGroup 이 둘레로 흩은 칸) — 전엔 모두 가운데라 도착 뒤 한 칸으로 뭉쳤다
    say('공격 이동'); dirty = true;
  }
  /** A 키·공격 이동 단추 — 다음 왼쪽 클릭을 공격 이동으로 받는다 */
  function startAttackMove() {
    if (liveIds().length) { amMode = true; say('공격 이동 — 갈 곳을 왼쪽 클릭 (우클릭·Esc 취소)'); } else { say('공격 이동 — 먼저 유닛을 고르세요'); }
  }
  /** S — 멈춘다 */
  function stopSel() {
    liveIds().forEach(function (id) { var u = S.units[id]; u.path = []; u.want = null; u.goal = null; u.amGoal = null; });
    dirty = true;
  }
  /** Shift·Ctrl + 1~9 부대 지정 / 1~9 호출(지정된 번호가 없으면 false → 건설 단축키) */
  function setGroup(n) { var ids = liveIds(); if (!ids.length) { return; } groups[n] = ids; say(n + '번 부대 지정 · ' + ids.length + '명'); }
  function recallGroup(n) {
    var g = (groups[n] || []).filter(function (id) { return S.units[id]; });
    if (!g.length) { return false; }
    sel = {}; selB = 0; g.forEach(function (id) { sel[id] = true; }); dirty = true; return true;
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
    diffOpen = true;   // W-0125 — 고르기 전 임시 판(보통·일시정지)이 숨김·닫기 저장으로 남아, 다음에 난이도를 안 묻고 열리던 것
    box2.id = 'rts-diff'; box2.className = 'rt-box';
    if (TB) {
      box2.innerHTML = (end ? '<h3>' + (S.won ? '🏆 승리' : '💀 패배') + '</h3><p>' + S.tb.why + ' · ' + S.tb.turn + '턴 · 쓰러뜨린 적 ' + (S.kills || 0) + ' — 난이도를 골라 새 전투를 시작하세요.</p>'
        : '<h3>난이도</h3><p>적군이 두 거점 사이에 진을 쳤다. 차례대로 움직여 적을 쓸어내거나 적 기지를 무너뜨리면 이긴다.</p>') + names.map(function (n, i) { return '<button data-diff="' + i + '"' + (i === 1 ? ' class="on"' : '') + '>' + n + '</button>'; }).join('');
      global.document.body.appendChild(box2);
      box2.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-diff]'); if (!b) { return; }
        var auto = !!S.tb.auto;
        S = TT().start(end ? (Date.now() & 0xffff) + 1 : S.seed, +b.getAttribute('data-diff')); S.tb.auto = auto && !end ? auto : false;
        overSeen = false; floats = []; pick(0); if (fogOn) { fogSt = R().fog.create(); R().fog.update(fogSt, S); }
        diffOpen = false; miniBase = null; camToArmy(); box2.parentNode.removeChild(box2); save(); hud();
      });
      return;
    }
    box2.innerHTML = (end ? '<h3>' + (S.won ? '🏆 평정!' : '💀 거점이 무너졌다') + '</h3><p>' + S.day + '일 · 막아 낸 파도 ' + Math.max(0, S.raid.n - (S.over ? 1 : 0)) + ' · 쓰러뜨린 적 ' + (S.kills || 0) + ' — 난이도를 골라 새 판을 시작하세요.</p>'
      : '<h3>난이도</h3><p>적 기지가 멀리 서 있다. 군대를 키워 쳐부수거나, 거점이 먼저 무너지면 진다.</p>') + names.map(function (n, i) { return '<button data-diff="' + i + '"' + (i === 1 ? ' class="on"' : '') + '>' + n + '</button>'; }).join('');
    global.document.body.appendChild(box2); S.speed = 0;
    box2.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-diff]'); if (!b) { return; }
      S = R().state.create(end ? (Date.now() & 0xffff) + 1 : S.seed, +b.getAttribute('data-diff')); if (/[?&]qa=1/.test(global.location ? global.location.search : '')) { R().state.qaPreset(S); }
      lastSaveDay = S.day; sel = {}; selB = 0; overSeen = false; groups = {}; if (fogOn) { fogSt = R().fog.create(); R().fog.update(fogSt, S); }
      var cs2 = R().grid.castleSite(); cam.x = cs2.x + 1.5; cam.y = cs2.y + 1.5;
      diffOpen = false; miniBase = null; box2.parentNode.removeChild(box2); dirty = true; hud();   // W-0125 새 판은 시드가 바뀌니 미니맵 지형도 다시 굽는다
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
      if (TB) { if (e.button === 2) { pick(0); down = null; return; } down.touch = true; panning = true; panLast = p; return; }   // 턴 전투: 끌면 지도 이동, 짧게 누르면(클릭) 고르기·이동·공격 · 우클릭 = 풀기
      if (e.button === 2) { if (tool !== 'select') { tool = 'select'; hud(); } amMode = false; return; }   // 우클릭은 명령(up) — 끌어도 지도는 안 움직인다(W-0061)
      if (amMode && e.button === 0) { amMode = false; attackMove(p); return; }
      if (e.button === 1 || e.shiftKey || tool === 'pan') { panning = true; panLast = p; return; }
      if (tool === 'select' && e.pointerType === 'touch') { down.touch = true; panning = true; panLast = p; return; }   // 폰: 끌면 지도 이동, 짧게 누르면 고르기·명령
      if (tool === 'select') { box = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; return; }
      painting = true; applyAt(toTile(p.x, p.y));
    });
    cv.addEventListener('pointermove', function (e) {
      var p = pointerPos(e), n = Object.keys(ptrs).length;
      edgeP = e.pointerType === 'mouse' ? { x: e.clientX, y: e.clientY } : null;
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
      if (down && down.btn === 2) { commandMove(p); }
      else if (down && down.touch && !down.moved) { if (TB) { tapTurn(p); } else { tapAt(p); } dirty = true; }
      if (box) { finishBox(p); }
      down = null; delete ptrs[e.pointerId];
      if (!Object.keys(ptrs).length) { painting = false; panning = false; panLast = null; pinch = 0; }
    }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', function () { hover = null; edgeP = null; dirty = true; });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = pointerPos(e), before = toTile(p.x, p.y), f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      var bx = (p.x - size().w / 2) / px() + cam.x, by = (p.y - size().h / 2) / px() + cam.y;
      cam.z = Math.max(ZMIN, Math.min(ZMAX, cam.z * f));
      cam.x = bx - (p.x - size().w / 2) / px(); cam.y = by - (p.y - size().h / 2) / px(); clampCam(); dirty = true; void before;
    }, { passive: false });
    global.addEventListener('resize', resize);
    global.addEventListener('keydown', function (e) {
      var k = e.key, step = 3 / cam.z * 2, n, code = e.code || '', tl;
      if (TB) {
        if (k === 'Escape') { pick(0); } else if (k === 'e' || k === 'E') { endTurnPlay(); }
        else if (k === 'ArrowLeft') { cam.x -= step; } else if (k === 'ArrowRight') { cam.x += step; } else if (k === 'ArrowUp') { cam.y -= step; } else if (k === 'ArrowDown') { cam.y += step; }
        clampCam(); dirty = true; return;
      }
      if (k === 'Escape') { tool = 'select'; sel = {}; selB = 0; amMode = false; }
      else if (k === ' ') { S.speed = S.speed === 0 ? 1 : 0; e.preventDefault(); }
      else if (k === 'x' || k === 'X') { tool = 'erase'; }
      else if (k === 'q' || k === 'Q') { castSel(); }
      else if ((k === 'a' || k === 'A') && !e.ctrlKey && !e.metaKey) { startAttackMove(); }
      else if ((k === 's' || k === 'S') && !e.ctrlKey && !e.metaKey) { stopSel(); }
      else if (/^Digit[1-9]$/.test(code)) { n = +code.slice(5); if (e.ctrlKey || e.shiftKey) { setGroup(n); e.preventDefault(); } else if (!recallGroup(n)) { tl = TOOLS.filter(function (t) { return !!R().rules.DEFS[t.k]; })[n - 1]; if (tl) { tool = tl.k; } } }
      else if (k === 'ArrowLeft') { cam.x -= step; } else if (k === 'ArrowRight') { cam.x += step; }
      else if (k === 'ArrowUp') { cam.y -= step; } else if (k === 'ArrowDown') { cam.y += step; }
      clampCam(); dirty = true;
    });
    function mini2cam(e) { var r = mini.getBoundingClientRect(), g = R().grid; cam.x = (e.clientX - r.left) / r.width * g.W; cam.y = (e.clientY - r.top) / r.height * g.H; clampCam(); dirty = true; }
    var md = false;
    mini.addEventListener('pointerdown', function (e) { md = true; try { mini.setPointerCapture(e.pointerId); } catch (x) { /* noop */ } mini2cam(e); });
    mini.addEventListener('pointermove', function (e) { if (md) { mini2cam(e); } });
    mini.addEventListener('pointerup', function () { md = false; });
    global.addEventListener('beforeunload', save);
    global.document.addEventListener('visibilitychange', function () { if (global.document.hidden) { save(); } });
    if (TB) {
      els.sel.addEventListener('click', function (e) { var b = e.target.closest('button[data-tact]'); if (b && !b.disabled) { tAct(b.getAttribute('data-tact')); } });
      els.turn.addEventListener('click', function (e) {
        if (e.target.closest('button[data-end]')) { endTurnPlay(); return; }
        if (e.target.closest('button[data-auto]')) { S.tb.auto = !S.tb.auto; save(); hud(); if (S.tb.auto) { autoGo(); } }
      });
      return;
    }
    els.tools.addEventListener('click', function (e) { var b = e.target.closest('button[data-tool]'); if (b) { tool = b.getAttribute('data-tool'); dirty = true; } });
    els.sel.addEventListener('click', function (e) {
      var al = e.target.closest('button[data-all]');
      if (al) { var k; sel = {}; selB = 0; for (k in S.units) { if (S.units[k].team === 0) { sel[k] = true; } } dirty = true; hud(); return; }
      if (e.target.closest('button[data-stop]')) { stopSel(); hud(); return; }
      if (e.target.closest('button[data-am]')) { startAttackMove(); return; }
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
  }

  /* ── 턴 전투(W-0081) ───────────────────────────────── */

  function TT() { return R().tactics; }
  function now() { return global.performance && global.performance.now ? global.performance.now() : Date.now(); }
  function tileOf(u) { return { x: Math.floor(u.x), y: Math.floor(u.y) }; }
  function sameT(a, b) { return a.kind === b.kind && (a.kind === 'base' || a.id === b.id); }
  function inT(list, t) { return list.some(function (x) { return sameT(x, t); }); }
  function visibleFoe(u) { return !fogOn || R().fog.visibleAt(fogSt, u.x, u.y); }

  /** 고른다(0 = 풀기) — 닿는 칸·지금 칠 것·닿는 칸에서 칠 수 있는 적(빨간 테두리)을 다시 구한다 */
  function pick(id) {
    var u = id ? S.units[id] : null, i, j, l;
    tsel = u ? u.id : 0; tReach = null; tTargets = []; tDanger = {};
    if (u) {
      tReach = TT().reach(S, u); tTargets = TT().targets(S, u);
      if (!S.tb.moved[u.id]) { for (i = 0; i < tReach.length; i++) { l = TT().targets(S, u, tReach[i].x, tReach[i].y); for (j = 0; j < l.length; j++) { tDanger[l[j].kind === 'base' ? 'base' : l[j].id] = 1; } } }
    }
    dirty = true; hud();
  }

  /** 파란 칸(이동) · 빨간 칸(지금 칠 수 있는 적) · 빨간 테두리(다가가면 칠 수 있는 적) */
  function drawMarks() {
    if (!tsel || busy || !S.units[tsel]) { return; }
    var z = px(), i, p, id, v, sb = S.buildings[-1], D = R().rules.DEFS;
    if (tReach && !S.tb.moved[tsel]) { ctx.fillStyle = 'rgba(70,150,255,.32)'; ctx.strokeStyle = 'rgba(140,200,255,.6)'; ctx.lineWidth = 1; for (i = 0; i < tReach.length; i++) { p = toScreen(tReach[i].x, tReach[i].y); ctx.fillRect(p.x + 1, p.y + 1, z - 2, z - 2); ctx.strokeRect(p.x + 1.5, p.y + 1.5, z - 3, z - 3); } }
    for (id in tDanger) { if (id === 'base') { continue; } v = S.units[id]; if (!v || !visibleFoe(v)) { continue; } p = toScreen(Math.floor(v.x), Math.floor(v.y)); ctx.strokeStyle = 'rgba(255,90,74,.9)'; ctx.lineWidth = 2; ctx.strokeRect(p.x + 2, p.y + 2, z - 4, z - 4); }
    for (i = 0; i < tTargets.length; i++) {
      if (tTargets[i].kind === 'base') { if (sb) { p = toScreen(sb.x, sb.y); ctx.fillStyle = 'rgba(255,70,50,.35)'; ctx.fillRect(p.x, p.y, D.stronghold.w * z, D.stronghold.h * z); } continue; }
      v = S.units[tTargets[i].id]; if (!v) { continue; } p = toScreen(Math.floor(v.x), Math.floor(v.y)); ctx.fillStyle = 'rgba(255,70,50,.45)'; ctx.fillRect(p.x + 1, p.y + 1, z - 2, z - 2);
    }
  }

  /** 피해 숫자 — 위로 떠오르며 사라진다 */
  function drawFloats() {
    var t = now(), z = px(), i, f, k, p;
    floats = floats.filter(function (x) { return t - x.t0 < 1100; });
    for (i = 0; i < floats.length; i++) {
      f = floats[i]; k = (t - f.t0) / 1100; p = toScreen(f.x, f.y);
      ctx.globalAlpha = 1 - k * k; ctx.font = 'bold ' + Math.max(13, Math.floor(z * 0.6)) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(f.txt, p.x, p.y - z * (0.6 + k)); ctx.fillStyle = f.col; ctx.fillText(f.txt, p.x, p.y - z * (0.6 + k));
    }
    ctx.globalAlpha = 1;
    if (floats.length) { dirty = true; }
  }
  function floatAt(x, y, txt, col) { floats.push({ x: x, y: y, txt: txt, col: col || '#ff8a7a', t0: now() }); }

  /** 지금 모습 사본 — 그림 줄이 이 위에서 움직인다 */
  function snap() { var o = {}, id, u, k, c; for (id in S.units) { u = S.units[id]; c = {}; for (k in u) { c[k] = u[k]; } c.path = []; c.cd = 0; o[id] = c; } return o; }

  /** 기록 줄을 하나씩 그린다 — 끝나면 ghost 를 버리고 done() */
  function play(log, before, done, enemy) {
    ghost = before; queue = log.slice(); busy = true; enemyAnim = !!enemy; animDone = done || null; nextAnim();
  }
  function nextAnim() {
    var r, g, pts, i, path;
    while (queue.length) {
      r = queue.shift(); g = ghost[r.id];
      if (!g) { continue; }
      pts = [{ x: r.from.x + 0.5, y: r.from.y + 0.5 }];
      if (r.from.x !== r.to.x || r.from.y !== r.to.y) { path = R().units.findPath(S, r.from.x, r.from.y, r.to.x, r.to.y); for (i = 0; i < path.length; i++) { pts.push(path[i]); } if (!path.length || Math.floor(path[path.length - 1].x) !== r.to.x || Math.floor(path[path.length - 1].y) !== r.to.y) { pts.push({ x: r.to.x + 0.5, y: r.to.y + 0.5 }); } }
      anim = { r: r, g: g, pts: pts, t0: now(), slide: pts.length > 1 ? Math.min(SLIDE_MAX, SLIDE_T * (pts.length - 1)) * AK * (S.tb.auto ? 0.6 : 1) : 0, hit: r.act === 'wait' ? 0 : HIT_T * AK * (S.tb.auto ? 0.6 : 1), done: false };
      if (enemyAnim && fogOn && !R().fog.visibleAt(fogSt, r.to.x + 0.5, r.to.y + 0.5) && !R().fog.visibleAt(fogSt, r.from.x + 0.5, r.from.y + 0.5) && r.act === 'wait') { anim.slide = 0; }   // 안개 속 적의 그냥 걸음은 건너뛴다
      return;
    }
    anim = null; ghost = null; busy = false; enemyAnim = false; dirty = true;
    var d = animDone; animDone = null; if (d) { d(); }
  }
  function stepAnim() {
    var a = anim; if (!a) { return; }
    var e = now() - a.t0, g = a.g, r = a.r, k, seg, i, n = a.pts.length - 1, f;
    if (e < a.slide) {
      k = e / a.slide * n; i = Math.min(n - 1, Math.floor(k)); f = k - i; seg = [a.pts[i], a.pts[i + 1]];
      g.x = seg[0].x + (seg[1].x - seg[0].x) * f; g.y = seg[0].y + (seg[1].y - seg[0].y) * f; g.path = [1];
      if (seg[1].x !== seg[0].x) { g.face = seg[1].x > seg[0].x ? 1 : -1; }
    } else {
      g.x = r.to.x + 0.5; g.y = r.to.y + 0.5; g.path = [];
      if (a.hit && !a.done) { a.done = true; hitGhost(r); }
      g.cd = a.hit && e - a.slide < 300 ? 9 : 0;   // art.unit — cd 7 이상이면 공격 몸짓
    }
    dirty = true;
    if (e >= a.slide + a.hit + (a.hit ? GAP_T * AK : 0)) { g.cd = 0; anim = null; nextAnim(); }
  }
  /** 그림 줄 한 칸의 결과를 ghost 에 — 피해 숫자·쓰러짐 */
  function hitGhost(r) {
    var g = ghost[r.id], id, v, sb = S.buildings[-1], cs = S.buildings[1];
    function baseAt(team) { var b = team === 0 ? sb : cs; if (b) { floatAt(b.x + 1.5, b.y + 1, '-' + r.dmg, '#ffd36a'); } }
    if (r.act === 'attack' && r.target) {
      if (r.target.kind === 'base') { baseAt(r.team); return; }
      v = ghost[r.target.id]; if (!v) { return; }
      if (Math.floor(v.x) !== Math.floor(g.x)) { g.face = v.x > g.x ? 1 : -1; }
      v.hp -= r.dmg; floatAt(v.x, v.y, '-' + r.dmg, r.team === 0 ? '#ffe08a' : '#ff8a7a');
      if (r.killed || v.hp <= 0) { delete ghost[v.id]; }
      if (r.counter) { g.hp -= r.counter; floatAt(g.x, g.y, '-' + r.counter, '#ffb0a0'); if (g.hp <= 0) { delete ghost[g.id]; } }
    } else if (r.act === 'cast') {
      floatAt(g.x, g.y, '일격!', '#ffd36a');
      for (id in ghost) { v = ghost[id]; if (v.team !== r.team && Math.abs(Math.floor(v.x) - r.to.x) + Math.abs(Math.floor(v.y) - r.to.y) <= TT().CAST_R) { v.hp -= r.dmg; floatAt(v.x, v.y, '-' + r.dmg, '#ffe08a'); if (v.hp <= 0) { delete ghost[id]; } } }
    }
  }

  /** 아군 한 수(이동·공격·일격)를 그림 줄 하나로 */
  function act1(u, rec, before, then) { play([rec], before, function () { afterAct(u); if (then) { then(); } }); }
  function afterAct(u) {
    save();
    if (S.won || S.over) { pick(0); finishTurnGame(); return; }
    if (u && S.units[u.id] && !S.tb.acted[u.id]) { pick(u.id); } else { pick(0); }
    if (!TT().left(S)) { say('남은 행동이 없습니다 — 턴 끝을 누르세요'); }
  }
  function tMove(u, x, y, then) {
    var before = snap(), from = tileOf(u), r = TT().move(S, u, x, y);
    if (!r.ok) { say(r.why); return; }
    act1(u, { id: u.id, team: 0, from: from, to: { x: x, y: y }, act: 'wait' }, before, function () {
      if (then) { then(); return; }
      if (!TT().targets(S, u).length && !(u.t === 'hero' && !(S.tb.cd[u.id] > 0) && castable(u))) { TT().wait(S, u); afterAct(u); }   // 칠 게 없으면 바로 대기
    });
  }
  function castable(u) { var id, v, x = Math.floor(u.x), y = Math.floor(u.y); for (id in S.units) { v = S.units[id]; if (v.team !== u.team && Math.abs(Math.floor(v.x) - x) + Math.abs(Math.floor(v.y) - y) <= TT().CAST_R) { return true; } } return false; }
  function tAttack(u, tg) {
    var before = snap(), at = tileOf(u), r = TT().attack(S, u, tg);
    if (!r.ok) { say(r.why); return; }
    act1(u, { id: u.id, team: 0, from: at, to: at, act: 'attack', target: tg, dmg: r.dmg, counter: r.counter, killed: r.killed }, before);
  }
  function tCast(u) {
    var before = snap(), at = tileOf(u), r = TT().cast(S, u);
    if (!r.ok) { say('일격 — ' + r.why); return; }
    act1(u, { id: u.id, team: 0, from: at, to: at, act: 'cast', target: null, dmg: r.dmg, n: r.n }, before);
  }
  /** 다가가 칠 칸 — 닿는 칸 중 그 대상을 칠 수 있는 곳, 이동력 적게 드는 곳 → 숲·언덕 */
  function bestSpot(u, tg) {
    var best = null, i, p, g = R().grid, land;
    for (i = 0; i < (tReach || []).length; i++) {
      p = tReach[i]; if (!inT(TT().targets(S, u, p.x, p.y), tg)) { continue; }
      land = S.tiles[g.idx(p.x, p.y)] === g.T.FOREST || S.tiles[g.idx(p.x, p.y)] === g.T.HILL;
      if (!best || p.c < best.c || (p.c === best.c && land && !best.land)) { best = { x: p.x, y: p.y, c: p.c, land: land }; }
    }
    return best;
  }
  /** 누른 칸의 적(보이는 유닛)이나 적 기지 */
  function foeAt(t) {
    var v = TT().unitAt(S, t.x, t.y), sb = S.buildings[-1], D = R().rules.DEFS.stronghold;
    if (v && v.team === 1 && visibleFoe(v)) { return { kind: 'unit', id: v.id }; }
    if (sb && sb.hp > 0 && t.x >= sb.x && t.x < sb.x + D.w && t.y >= sb.y && t.y < sb.y + D.h && (!fogOn || R().fog.seenAt(fogSt, t.x, t.y))) { return { kind: 'base' }; }
    return null;
  }

  /** 짧게 누름(마우스 클릭도) — 고르기 · 이동 · 공격 · 풀기 */
  function tapTurn(p) {
    if (busy || S.won || S.over || S.tb.side !== 0) { return; }
    var t = toTile(p.x, p.y), u = tsel ? S.units[tsel] : null, at = TT().unitAt(S, t.x, t.y), tg, spot;
    if (at && at.team === 0) {
      if (u && at.id === u.id) { if (!S.tb.moved[u.id]) { tMove(u, t.x, t.y); } return; }   // 제자리 한 번 더 = 여기 선다
      if (S.tb.acted[at.id]) { say('이번 턴에 이미 움직였다'); return; }
      pick(at.id); return;
    }
    tg = foeAt(t);
    if (!u) { if (tg && tg.kind === 'unit') { var v = S.units[tg.id], st = R().units.statOf(v); say('적 ' + (st.name || R().units.UDEF[v.t].name) + ' · 체력 ' + Math.ceil(v.hp) + ' · 이동 ' + TT().mv(v)); } return; }
    if (tg) {
      if (inT(TT().targets(S, u), tg)) { tAttack(u, tg); return; }
      if (!S.tb.moved[u.id]) { spot = bestSpot(u, tg); if (spot) { tMove(u, spot.x, spot.y, function () { tAttack(u, tg); }); return; } }
      say('닿지 않는다'); return;
    }
    if (!S.tb.moved[u.id] && tReach && tReach.some(function (q) { return q.x === t.x && q.y === t.y; })) { tMove(u, t.x, t.y); return; }
    if (S.tb.moved[u.id]) { say('움직인 뒤엔 공격하거나 대기를 누르세요'); return; }
    pick(0);
  }

  /** 턴 끝 → 적 차례 그림 → (자동이면) 다음 아군 차례 */
  function endTurnPlay() {
    if (busy || S.won || S.over || S.tb.side !== 0) { return; }
    pick(0);
    var before = snap(), log = TT().endTurn(S);
    save();
    play(log, before, function () { if (S.won || S.over) { finishTurnGame(); return; } save(); hud(); if (S.tb.auto) { autoGo(); } }, true);
  }
  function autoGo() {
    if (!S.tb.auto || busy || S.won || S.over || S.tb.side !== 0) { return; }
    pick(0);
    var before = snap(), log = TT().autoTurn(S, 0);
    play(log, before, function () { if (S.won || S.over) { save(); finishTurnGame(); return; } endTurnPlay(); });
  }
  function finishTurnGame() {
    if (overSeen) { return; }
    overSeen = true; var c = global.DG.core; if (c && c.save) { c.save.rtsTb = null; c.persist(); }
    hud(); askDiff(true);
  }

  function hudTurn() {
    var tb = S.tb, sb = S.buildings[-1], turn = enemyAnim ? tb.turn - (S.won || S.over ? 0 : 1) : tb.turn, mine = 0, id, k;
    for (id in S.units) { if (S.units[id].team === 0) { mine++; } }
    els.top.innerHTML = '<b class="rt-day">' + Math.max(1, turn) + '턴</b>' +
      '<span class="tb-side ' + (enemyAnim ? 'neg' : 'pos') + '">' + (S.won ? '승리' : S.over ? '패배' : enemyAnim ? '적 차례' : '아군 차례') + '</span>' +
      '<span title="이번 턴에 아직 안 움직인 아군 / 아군">남은 행동 <b>' + TT().left(S) + '</b>/' + mine + '</span>' +
      '<span title="거점 체력 — 0 이 되면 진다">🏯 <b class="' + (S.cHp < 150 ? 'neg' : '') + '">' + Math.ceil(S.cHp) + '</b></span>' +
      (sb ? '<span title="적 기지 체력 — 0 이 되면 이긴다">🏴 <b>' + Math.ceil(sb.hp) + '</b></span>' : '') +
      '<span title="쓰러뜨린 적">⚔️ <b>' + (S.kills || 0) + '</b></span>';
    var eb = els.turn.querySelector('[data-end]'), ab = els.turn.querySelector('[data-auto]');
    eb.disabled = busy || S.won || S.over; eb.classList.toggle('hot', !busy && !TT().left(S) && !S.won && !S.over);
    ab.classList.toggle('on', !!tb.auto);
    var u = tsel ? S.units[tsel] : null, h = '';
    if (u && !busy) {
      var st = R().units.statOf(u), rg = TT().rangeOf(u), cd = S.tb.cd[u.id] | 0;
      h = '<div class="sl-h"><b>' + (st.name || R().units.UDEF[u.t].name) + '</b> <small class="tb-hp">체력 ' + Math.ceil(u.hp) + '/' + (u.mhp || st.hp) + '</small></div>' +
        '<div class="sl-u">이동 ' + TT().mv(u) + ' · 사거리 ' + (rg[0] === rg[1] ? rg[0] : rg[0] + '~' + rg[1]) + ' · 공격 ' + st.atk + (S.tb.moved[u.id] ? ' · 움직임 끝' : '') + '</div><div class="sl-btns">' +
        '<button data-tact="attack"' + (tTargets.length ? '' : ' disabled') + '><span>⚔️</span><small>공격</small></button>' +
        (u.t === 'hero' ? '<button data-tact="cast"' + (cd > 0 ? ' disabled' : '') + ' title="둘레 2칸의 적 전부"><span>💥</span><small>일격' + (cd > 0 ? '<br>' + cd + '턴' : '') + '</small></button>' : '') +
        '<button data-tact="wait"><span>⏸</span><small>대기</small></button><button data-tact="cancel"><span>✖</span><small>취소</small></button></div>';
    }
    if (h !== els.sel.__h) { els.sel.innerHTML = h; els.sel.__h = h; }
    els.sel.classList.toggle('show', !!h);
    k = S.won ? '승리 — ' + tb.why : S.over ? '패배 — ' + tb.why : busy ? (enemyAnim ? '적 차례…' : tb.auto ? '자동 진행 중 — 자동을 누르면 멈춥니다' : '…')
      : Date.now() < tipUntil ? tipMsg : u ? (S.tb.moved[u.id] ? '빨간 적을 눌러 공격 · 대기' : '파란 칸을 눌러 이동 · 빨간 테두리 적을 누르면 다가가 칩니다')
      : TT().left(S) ? '유닛을 눌러 움직이세요' : '남은 행동이 없습니다 — 턴 끝을 누르세요';
    els.tip.textContent = k; els.tip.classList.toggle('warn', S.over || S.won || Date.now() < tipUntil);
  }
  /** 패널 단추 — 공격(가장 약한 대상)·일격·대기·취소 */
  function tAct(k) {
    var u = tsel ? S.units[tsel] : null; if (!u || busy) { return; }
    if (k === 'cancel') { pick(0); return; }
    if (k === 'wait') { var r = TT().wait(S, u); if (!r.ok) { say(r.why); } afterAct(u); return; }
    if (k === 'cast') { tCast(u); return; }
    if (k === 'attack' && tTargets.length) {
      var best = tTargets[0], i, v, bv = 1e9;
      for (i = 0; i < tTargets.length; i++) { v = tTargets[i].kind === 'unit' ? S.units[tTargets[i].id] : null; if (v && v.hp < bv) { bv = v.hp; best = tTargets[i]; } }
      tAttack(u, best);
    }
  }
  /** 아군 무리 가운데로 카메라 */
  function camToArmy() {
    var n = 0, sx = 0, sy = 0, id; for (id in S.units) { if (S.units[id].team === 0) { n++; sx += S.units[id].x; sy += S.units[id].y; } }
    if (n) { cam.x = sx / n; cam.y = sy / n; } else { var cs = R().grid.castleSite(); cam.x = cs.x + 1.5; cam.y = cs.y + 1.5; }
    clampCam(); dirty = true;
  }

  /* ── 저장·시간 ─────────────────────────────────────── */

  function save() {
    var c = global.DG.core;
    if (diffOpen) { return; }
    if (TB) { if (!S || !c || !c.save) { return; } c.save.rtsTb = S.over || S.won ? null : TT().serialize(S); c.persist(); return; }   // 턴 전투는 수마다(옛 save.rts 는 안 건드림)
    if (!S || !c || !c.save || S.over || S.won) { return; }
    c.save.rts = R().state.serialize(S); c.persist(); lastSaveDay = S.day;
  }

  function loop(t) {
    var dt = Math.min(250, t - (lastT || t)); lastT = t;
    if (!pokeUntil) { pokeUntil = t + 10000; }
    if (t < pokeUntil) { dirty = true; }   // 새 그림(타일·건물·몸)이 받아지는 동안
    if (TB) { stepAnim(); }
    else if (S.speed > 0) {
      acc += dt * S.speed; var n = 0;
      while (acc >= TICK_MS && n < 40) {
        acc -= TICK_MS; n++; S.tick++; R().units.tick(S); R().combat.tick(S); dirty = true;
        if ((S.over || S.won) && !overSeen) { overSeen = true; var cc = global.DG.core; if (cc && cc.save) { cc.save.rts = null; cc.persist(); } askDiff(true); }   // 판이 끝났다 — 저장을 비우고 결과 창에서 새 판을 고른다
        if (S.tick % R().econ.TICKS_PER_DAY === 0) { R().econ.dayTick(S); dirty = true; if (S.day - lastSaveDay >= 10) { save(); } }
      }
    }
    edgeScroll(dt);
    if (fogOn && t - lastFog > 200) { lastFog = t; if (R().fog.update(fogSt, S)) { dirty = true; } }
    if (dirty) { draw(); }
    if (t - lastHud > 250) { lastHud = t; hud(); }
    global.requestAnimationFrame(loop);
  }

  /** 입구 — 저장이 있으면 이어서, 없으면 새 판 */
  function init() {
    var doc = global.document, c = global.DG.core, q = global.location ? global.location.search : '';
    TB = !/[?&]mode=rts(&|$)/.test(q) && !!R().tactics;
    if (TB) { initTurn(doc, c, q); return; }
    doc.body.insertAdjacentHTML('beforeend',
      '<canvas id="rts-map"></canvas><div id="rts-top" class="rt-box"></div>' +
      '<div id="rts-speed" class="rt-box"><button data-speed="0" title="일시정지 (Space)">⏸</button><button data-speed="1">1×</button><button data-speed="2">2×</button><button data-speed="4">4×</button></div>' +
      '<div id="rts-tools" class="rt-box">' + TOOLS.map(function (t, i) { var d = R().rules.DEFS[t.k]; return '<button data-tool="' + t.k + '" title="' + t.n + (R().rules.DEFS[t.k] ? ' (' + (i - 1) + ')' : '') + '"><span>' + (ICONS[t.k] ? ic(ICONS[t.k], t.i) : t.i) + '</span><small>' + t.n + (d && d.cost ? ' ' + d.cost : '') + '</small></button>'; }).join('') + '</div>' +
      '<canvas id="rts-mini" class="rt-box" width="240" height="150"></canvas><div id="rts-tip" class="rt-box"></div><div id="rts-sel" class="rt-box"></div><div id="rts-opts" class="rt-box"><span>세율</span><button data-tax="0">낮음</button><button data-tax="1">보통</button><button data-tax="2">높음</button><button data-view="1" class="vw">보기: 없음</button></div><a id="rts-back" class="rt-box" href="./">턴제로</a>');
    cv = $('rts-map'); ctx = cv.getContext('2d'); mini = $('rts-mini'); mctx = mini.getContext('2d');
    els = { top: $('rts-top'), tools: $('rts-tools'), speed: $('rts-speed'), tip: $('rts-tip'), opts: $('rts-opts'), sel: $('rts-sel') };
    var saved = c && c.save && c.save.rts ? R().state.restore(c.save.rts) : null;
    S = saved || R().state.create((Date.now() & 0xffff) + 1, diffFromUrl());
    if (!saved && /[?&]qa=1/.test(global.location ? global.location.search : '')) { R().state.qaPreset(S); }   // 시험 프리셋(?qa=1)
    lastSaveDay = S.day;
    fogOn = !/[?&]fog=0/.test(global.location ? global.location.search : ''); fogSt = R().fog.create(); R().fog.update(fogSt, S);
    var cs = R().grid.castleSite(); cam.x = cs.x + 1.5; cam.y = cs.y + 1.5;
    resize(); bindInput(); hud(); global.requestAnimationFrame(loop);
    if (!saved && !/[?&]diff=/.test(global.location ? global.location.search : '')) { askDiff(); }
  }
  /** 턴 전투 입구 — 저장(`save.rtsTb`)이 있으면 이어서, 없으면 새 전투. 주소 `fast=1` 은 그림 줄을 거의 건너뛴다(시험용) */
  function initTurn(doc, c, q) {
    doc.body.classList.add('rt-tb');
    doc.body.insertAdjacentHTML('beforeend',
      '<canvas id="rts-map"></canvas><div id="rts-top" class="rt-box"></div>' +
      '<div id="rts-turn" class="rt-box"><button data-end="1" title="턴 끝 (E)">턴 끝</button><button data-auto="1" title="자동 — 아군도 컴퓨터가 둔다">자동</button></div>' +
      '<canvas id="rts-mini" class="rt-box" width="240" height="150"></canvas><div id="rts-tip" class="rt-box"></div><div id="rts-sel" class="rt-box"></div><a id="rts-back" class="rt-box" href="./">턴제로</a>');
    cv = $('rts-map'); ctx = cv.getContext('2d'); mini = $('rts-mini'); mctx = mini.getContext('2d');
    els = { top: $('rts-top'), tip: $('rts-tip'), sel: $('rts-sel'), turn: $('rts-turn') };
    AK = /[?&]fast=1/.test(q) ? 0.03 : 1;
    var saved = c && c.save && c.save.rtsTb ? TT().restore(c.save.rtsTb) : null;
    S = saved || TT().start((Date.now() & 0xffff) + 1, diffFromUrl());
    fogOn = !/[?&]fog=0/.test(q); fogSt = R().fog.create(); R().fog.update(fogSt, S);
    camToArmy(); resize(); bindInput(); hud(); global.requestAnimationFrame(loop);
    if (!saved && !/[?&]diff=/.test(q)) { askDiff(); } else if (S.tb.auto) { autoGo(); }
  }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.view = { init: init, save: save, state: function () { return S; }, toScreen: toScreen, toTile: toTile, camera: cam, tool: function (t) { if (t) { tool = t; } return tool; },
    turn: function () { return { on: TB, busy: busy, sel: tsel, reach: tReach ? tReach.length : 0, targets: tTargets.length, danger: Object.keys(tDanger).length }; } };   // 턴 전투 시험용(W-0081)
})(typeof window !== 'undefined' ? window : this);
