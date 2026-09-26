/**
 * 미니맵 — 낮게 깔린 카메라가 못 보는 것을 위에서 한 번에 보여 준다 (PLAN 47절)
 * ---------------------------------------------------------------
 * 3D 로 옮기며 카메라가 사람 뒤 낮은 자리로 내려앉았다. 그림은 좋아졌는데
 * **어디에 무엇이 있는지**가 사라졌다 — 역참이 어느 쪽인지, 성채가 등 뒤인지,
 * 방금 지나친 주민이 어디 섰는지. 넓힌 세상은 길을 잃을 수 있어야 뜻이 있고,
 * 길을 잃지 않으려면 위에서 본 그림이 한 장 있어야 한다.
 *
 *   왼쪽 아래 둥근 판   가운데가 나, 위가 북쪽
 *   바탕                48m 격자의 지형 (`world.terrainAt` — 손으로 그린 땅이 먼저)
 *   점                  조우 대상 · 역참 · 성채 · 주민 · 이름난 자리
 *   가운데(나) 탭        가까이 ↔ 멀리 (180m ↔ 360m)
 *   그 밖의 자리 탭      그 자리로 걷는다 (본 지도의 "빈 땅 탭"과 같다 — `world.walkTo`)
 *   두 번 탭            접는다 (다시 두 번 탭하면 펴진다)
 *
 * **`project`·`cells`·`blips`(값을 내는 함수)는 판정에 한 줄도 닿지 않는다** — 좌표·
 * 상태를 읽기만 하고 **캔버스 없이도 돈다**(자가진단이 그것만 따로 본다). `tap`
 * 은 화면 쪽 함수라 얘기가 다르다 — 본 지도의 탭 이동처럼 `world.walkTo` 를 부른다.
 *
 * 숨은 자리(굴 · 사당 · 폐허)는 **가 본 뒤에만** 찍힌다(`codex.has('place', …)`).
 * 미니맵이 탐험을 대신 해 버리면 숨겨 둔 뜻이 없다.
 *
 * 밖으로 벗어난 역참 · 성채 · 이름난 자리는 **테두리에 붙여** 방향만 알린다
 * (`edge`). 조우 대상과 주민은 범위를 넘으면 그냥 지운다 — 걸어가서 만날 것들이라
 * 방향만 알아도 쓸모가 없고, 테두리가 점으로 뒤덮인다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var GRID = 48;                 // 손으로 그린 땅(`land.js`)의 격자 한 칸 = 48m
  var RANGES = [180, 360];       // 반지름 m — 탭하면 번갈아 든다

  /* 지형 빛깔 — 지도(`world.TERRAIN`)보다 밝다. 128px 안에서 읽혀야 하기 때문이다 */
  var TINT = {
    water: '#2f6591', grass: '#3f5f42', forest: '#2d4c31',
    road: '#8d8674', town: '#68583f', mount: '#57535e', farm: '#586b3d'
  };

  /* 점 — 빛깔과 반지름(px). `edge` 는 테두리에 붙었을 때 쓰는 작은 쪽 */
  var STYLE = {
    spawn:   { c: '#ffd66b', r: 2.5 },
    special: { c: '#ff9d3d', r: 3.6 },
    station: { c: '#7fd0ff', r: 3.2 },
    dark:    { c: '#ff5f6d', r: 3.6 },
    fort:    { c: '#c9a7ff', r: 3.4 },
    mine:    { c: '#8affb0', r: 3.4 },
    npc:     { c: '#e6dccd', r: 2.1 },
    place:   { c: '#f2e4b6', r: 2.6 },
    beacon:      { c: '#ff9d3d', r: 3.2 },
    'beacon-lit': { c: '#ff5a1e', r: 3.6 },
    shrine:      { c: '#f0d878', r: 3.0 },
    stele:       { c: '#d9d2c0', r: 2.2 },
    drop:        { c: '#ffb36b', r: 3.4 },
    story:       { c: '#ffd24a', r: 4.2 },
    wq:          { c: '#5fb8ff', r: 4.2 },
    'q-idle':    { c: '#ffd24a', r: 4.2 },
    'q-avail':   { c: '#5fb8ff', r: 4.2 }
  };

  /** ⑲-23 임무 표식 빛깔 — 이야기 금빛·세계 임무 푸른빛 */
  var QTONE = { story: '#ffd24a', wq: '#5fb8ff' };

  /**
   * ⑲-23 임무 표식 하나 — 미니맵·지도(overworld.js)가 같이 쓴다.
   * kind 'track' 찬 마름모 · 'idle' 빈 마름모 · 'avail' 둥근 판 "!". r = 반지름(px)
   */
  function questIcon(g, x, y, r, kind, tone) {
    var c = QTONE[tone] || QTONE.story;
    g.save();
    g.lineJoin = 'round';
    if (kind === 'avail') {
      g.fillStyle = 'rgba(14,20,30,.88)';
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = c; g.lineWidth = Math.max(1.2, r * 0.28); g.stroke();
      g.fillStyle = c;
      g.font = '800 ' + Math.round(r * 1.5) + 'px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('!', x, y + r * 0.06);
    } else {
      g.beginPath();
      g.moveTo(x, y - r * 1.2); g.lineTo(x + r, y); g.lineTo(x, y + r * 1.2); g.lineTo(x - r, y); g.closePath();
      g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = kind === 'track' ? 1.2 : Math.max(2.6, r * 0.6); g.stroke();
      if (kind === 'track') { g.fillStyle = c; g.fill(); } else { g.strokeStyle = c; g.lineWidth = Math.max(1.4, r * 0.34); g.stroke(); }
    }
    g.restore();
  }

  var node = null, canvas = null, ctx = null;
  var step = 0, folded = false;
  var acc = 0, lastTap = 0;
  var heading = -Math.PI / 2;    // 화면 위쪽(북)을 보고 선다
  var lastPos = null;
  var drawn = 0;                 // 지난번에 찍은 점 수 (데모·진단이 들여다본다)

  function on() { return core.tuned('minimap.on', 1) ? true : false; }
  /** 판의 지름 px — 좁은 화면에서는 저절로 작아진다 (PLAN 31절) */
  function sizePx() {
    var narrow = global.innerWidth && global.innerWidth <= 600;
    return core.tuned('minimap.size', narrow ? 104 : 128);
  }
  function everySec() { return core.tuned('minimap.everySec', 0.16); }

  /** 지금 반지름 m */
  function range() {
    var i = step % RANGES.length;
    return core.tuned('minimap.range', RANGES[i]);
  }

  /* ── 값을 내는 함수 — 캔버스 없이도 돈다 ─────────────────
   * 화면 좌표는 -1~1 로 낸다. y 는 세상과 같은 방향(+가 남쪽 = 아래)이라
   * 그리는 쪽이 뒤집을 것이 없다.
   */

  /**
   * 이 자리를 판 위 어디에 찍나.
   * 범위를 넘으면 테두리에 붙이고 `edge: true` 를 단다.
   * `d` 는 **반지름을 1 로 본 거리**다 — 미터로 보려면 반지름을 곱한다(`blips` 가 그렇게 한다).
   */
  function project(pos, x, y, r) {
    var dx = (x - pos.x) / r, dy = (y - pos.y) / r;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d <= 1) { return { dx: dx, dy: dy, d: d, edge: false }; }
    if (d === 0) { return { dx: 0, dy: 0, d: 0, edge: false }; }
    return { dx: dx / d, dy: dy / d, d: d, edge: true };
  }

  /**
   * 바탕에 깔 지형 칸 — `{tx, ty, kind, dx, dy, w}`.
   * `dx`·`dy` 는 칸 **왼쪽 위** 모서리, `w` 는 한 칸의 폭(둘 다 -1~1 자)이다.
   */
  function cells(pos, r) {
    var W = global.DG.world;
    if (!W || !W.terrainAt) { return []; }
    var w = GRID / r;
    var x0 = Math.floor((pos.x - r) / GRID), x1 = Math.floor((pos.x + r) / GRID);
    var y0 = Math.floor((pos.y - r) / GRID), y1 = Math.floor((pos.y + r) / GRID);
    var out = [], tx, ty;
    for (ty = y0; ty <= y1; ty++) {
      for (tx = x0; tx <= x1; tx++) {
        out.push({
          tx: tx, ty: ty, kind: W.terrainAt(tx, ty),
          dx: (tx * GRID - pos.x) / r, dy: (ty * GRID - pos.y) / r, w: w
        });
      }
    }
    return out;
  }

  /**
   * 판 위에 찍을 것들 — PLAN 47절이 적어 둔 일곱을 다 낸다.
   *
   *   조우 대상(사명)  world.spawns      역참(상점)  world.stationsNear
   *   성채             world.fortsNear   적도(사건)  rogue.occupied
   *   주민             npc.posAt         마을·이름난 자리  land.places
   *   발견한 자리      codex.has('place', …) — 숨은 것은 가 본 뒤에만
   *
   * 어느 모듈이 없어도 그 갈래만 빠지고 나머지는 그대로 난다.
   */
  function blips(pos, r, t) {
    var out = [], i, p, pr;
    var W = global.DG.world, L = global.DG.land, N = global.DG.npc;
    var R = global.DG.rogue, F = global.DG.fort, X = global.DG.codex;
    t = t === undefined ? Date.now() : t;

    function put(kind, x, y, name, keepEdge) {
      pr = project(pos, x, y, r);
      if (pr.edge && !keepEdge) { return null; }
      out.push({ t: kind, x: x, y: y, dx: pr.dx, dy: pr.dy,
                 d: pr.d * r, edge: pr.edge, name: name || '' });
      return out[out.length - 1];
    }

    /* 조우 대상 — 5급(돌파·특별)은 크고 진하게 */
    if (W && W.spawns) {
      for (i = 0; i < W.spawns.length; i++) {
        var s = W.spawns[i];
        var rare = s.ref && s.ref.rarity >= 5;
        put(rare ? 'special' : 'spawn', s.x, s.y, s.ref ? s.ref.name : '');
      }
    }

    /* 역참 — 적도가 들어앉았으면 붉은 점으로 바뀐다 (걸어갈 이유가 반대로 선다) */
    if (W && W.stationsNear) {
      var sts = W.stationsNear();
      for (i = 0; i < sts.length; i++) {
        var held = false;
        try { held = R ? R.occupied(sts[i], t) : false; } catch (e) { held = false; }
        put(held ? 'dark' : 'station', sts[i].x, sts[i].y, sts[i].name, true);
      }
    }

    /* 성채 — 내가 들고 있는 동안은 초록 */
    if (W && W.fortsNear) {
      var fts = W.fortsNear();
      for (i = 0; i < fts.length; i++) {
        var mine = false;
        try { mine = F ? !!F.infoOf(fts[i]).mine : false; } catch (e2) { mine = false; }
        put(mine ? 'mine' : 'fort', fts[i].x, fts[i].y, fts[i].name, true);
      }
    }

    /* 주민 — `posAt` 은 순수하다. `live()` 는 100m 밖을 재우므로 여기서는 안 쓴다 */
    if (N && N.PEOPLE && N.posAt) {
      for (i = 0; i < N.PEOPLE.length; i++) {
        var np = N.posAt(N.PEOPLE[i], t);
        if (np) { put('npc', np.x, np.y, N.PEOPLE[i].name); }
      }
    }

    /* 이름난 자리 — 숨은 것은 도감에 도장이 찍힌 뒤에만.
       손으로 그린 땅(land) 뿐 아니라 실제 지형(geo.js, 실제 지명)도 합친다 */
    if (L && L.places) {
      var ps = L.places();
      for (i = 0; i < ps.length; i++) {
        p = ps[i];
        if (!p) { continue; }
        if (p.hidden && !(X && X.has && X.has('place', p.id))) { continue; }
        put('place', p.x, p.y, p.name, true);
      }
    }
    var G = global.DG.geo;
    if (G && G.places) {
      var gs = G.places();
      for (i = 0; i < gs.length; i++) { put('place', gs[i].x, gs[i].y, gs[i].name, true); }
    }

    /* 봉수대(PLAN §5①) — 27개는 세 나라에 흩어져 있어(수백~수천 km) `project()`
       가 거리와 무관하게 방향만 재는 이 함수에 그냥 넘기면 **먼 나라의 것까지
       늘 테두리에 화살표로 뜬다**(잡음). 그래서 여기서 먼저 6km 안으로 거른다
       — 그 안이면 "가까워지고 있다"는 뜻이고, 밖이면 어차피 걸어갈 거리가 아니다 */
    var BC = global.DG.beacon, NEAR_BEACON = 6000;
    if (BC && BC.list) {
      var bl = BC.list();
      for (i = 0; i < bl.length; i++) {
        var bw = BC.worldPos(bl[i]);
        if (Math.hypot(bw.x - pos.x, bw.y - pos.y) > NEAR_BEACON) { continue; }
        put(BC.lit(bl[i].key) ? 'beacon-lit' : 'beacon', bw.x, bw.y, bl[i].name, true);
      }
    }

    /* 사당(PLAN §5 ②) — 숨은 자리라 **보이는 것만**(120m 안·봉수대 반경·깬 자리), 6km 안에서 */
    var SH = global.DG.shrine;
    if (SH && SH.list) {
      var sl = SH.list();
      for (i = 0; i < sl.length; i++) {
        var sw = SH.worldPos(sl[i]);
        if (Math.hypot(sw.x - pos.x, sw.y - pos.y) > NEAR_BEACON) { continue; }
        if (!SH.visible(sl[i])) { continue; }
        put('shrine', sw.x, sw.y, sl[i].name, true);
      }
    }

    /* 비석(PLAN §5 ⑤) — 발견한 것만(48절), 가까운 600m 안 */
    var STM = global.DG.stela;
    if (STM && STM.foundNear) {
      var fl = STM.foundNear(600);
      for (i = 0; i < fl.length; i++) { put('stele', fl[i].x, fl[i].y, '', false); }
    }

    /* 떨어진 짐(PLAN §5 ⑧) — 10분 안에 되찾을 것이라 테두리에도 붙여 방향을 알린다 */
    var DRP = global.DG.drop;
    if (DRP && DRP.markers) {
      var dl = DRP.markers();
      for (i = 0; i < dl.length; i++) { put('drop', dl[i].x, dl[i].y, '🎒 ' + dl[i].gold, true); }
    }

    /* 임무 표식(PLAN §5 ⑲-12·⑲-23) — 따라가는 것(이야기 금·세계 임무 푸른 찬 마름모)은 테두리에도 붙어 방향을 알린다.
       맡았지만 안 따라가는 것(빈 마름모)·맡을 수 있는 것(!)은 둘레 안일 때만 */
    var STY = global.DG.story, qm = STY && STY.mapMarks ? STY.mapMarks() : [];
    for (i = 0; i < qm.length; i++) {
      var qk = qm[i], track = qk.kind === 'track';
      var qb = put(track ? (qk.tone === 'wq' ? 'wq' : 'story') : 'q-' + qk.kind, qk.x, qk.y, (qk.tone === 'wq' ? '🔷 ' : '📖 ') + qk.text, track);
      if (qb) { qb.q = qk.kind; qb.tone = qk.tone; }
    }

    return out;
  }

  /** 어느 쪽을 보고 섰나 — 움직이면 갱신하고, 멈추면 마지막 방향을 지킨다 */
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
    node.setAttribute('title', '미니맵 — 가운데를 탭하면 배율, 다른 자리를 탭하면 그쪽으로 걷습니다. 두 번 탭하면 접힙니다');
    canvas = global.document.createElement('canvas');
    node.appendChild(canvas);
    var tag = global.document.createElement('b');
    tag.className = 'mm-range';
    node.appendChild(tag);
    global.document.body.appendChild(node);
    node.addEventListener('click', tap);
    return node;
  }

  /** 가운데(나)에서 이 안쪽은 "나"를 짚은 것으로 본다 — 탭하면 배율이 바뀐다.
   * 그 밖은 지면 위 한 자리를 짚은 것이라 그쪽으로 걷는다. */
  var HUB_PX = 14;

  /** 탭한 자리를 판의 중심 기준 픽셀로 낸다. 캔버스가 없으면 null */
  function hitAt(e) {
    if (!canvas) { return null; }
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) { return null; }
    var s = sizePx(), c = s / 2, rad = c - 3;
    var px = (e.clientX - r.left) * (s / r.width) - c;
    var py = (e.clientY - r.top) * (s / r.height) - c;
    return { px: px, py: py, pd: Math.hypot(px, py), rad: rad };
  }

  /** 가운데 밖을 탭한 자리로 걷는다 — 본 지도의 "빈 땅 탭"과 같은 문(`world.walkTo`).
   * 실제 위치(GPS) 모드에서는 본 지도도 탭 이동을 안 듣는다 — 여기도 맞춘다. */
  function walkToHit(hit) {
    var W = global.DG.world;
    if (!W || !W.walkTo || W.mode !== 'keyboard' || !core.save) { return; }
    var pos = core.save.player.pos, r = range();
    var clamp = hit.pd > hit.rad ? hit.rad / hit.pd : 1;   // 판 밖을 짚어도 반지름 안으로 들인다
    var mul = clamp * (r / hit.rad);                        // 픽셀 → 미터
    W.walkTo(pos.x + hit.px * mul, pos.y + hit.py * mul);
  }

  /** 탭 — 가운데는 배율, 그 밖은 이동, 빠르게 두 번은 접기 */
  function tap(e) {
    if (e && e.preventDefault) { e.preventDefault(); }
    var now = Date.now();
    var dbl = now - lastTap < 320;
    lastTap = now;
    if (dbl) { folded = !folded; step = 0; remember(); apply(); draw(); return; }
    if (folded) { folded = false; remember(); apply(); draw(); return; }
    var hit = hitAt(e);
    if (hit && hit.pd > HUB_PX) { walkToHit(hit); return; }
    step = (step + 1) % RANGES.length;
    remember();
    apply();
    draw();
  }

  /** 접힘·배율만 세이브의 설정 칸에 남긴다 (진행에는 닿지 않는다) */
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
    if (tag) { tag.textContent = folded ? '🗺️' : (range() + 'm'); }
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
    if (!on() || folded || !canvas) { return 0; }
    var dpr = resize();
    if (!ctx) { return 0; }

    var pos = core.save.player.pos;
    var r = range(), t = Date.now();
    var s = sizePx(), c = s / 2, rad = c - 3;
    var ang = aim(pos);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s, s);

    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, rad, 0, Math.PI * 2);
    ctx.clip();

    /* 바탕 — 지형 칸. 판 밖은 잘려 나가므로 사각형째 칠하면 된다 */
    ctx.fillStyle = '#161a21';
    ctx.fillRect(0, 0, s, s);
    var cs = cells(pos, r), i;
    for (i = 0; i < cs.length; i++) {
      ctx.fillStyle = TINT[cs[i].kind] || TINT.grass;
      /* 칸 사이에 실선이 비치지 않게 반 픽셀씩 겹쳐 칠한다 */
      ctx.fillRect(c + cs[i].dx * rad - 0.5, c + cs[i].dy * rad - 0.5,
                   cs[i].w * rad + 1, cs[i].w * rad + 1);
    }

    /* 거리 고리 — 반지름의 절반 자리 */
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c, c, rad * 0.5, 0, Math.PI * 2); ctx.stroke();

    /* 점 */
    var bs = blips(pos, r, t), st;
    drawn = bs.length;
    for (i = 0; i < bs.length; i++) {
      st = STYLE[bs[i].t] || STYLE.spawn;
      ctx.globalAlpha = bs[i].edge ? 0.55 : 1;
      if (bs[i].q) {                                   // ⑲-23 임무 표식 — 맨 위에 따로 그린다
        continue;
      }
      ctx.fillStyle = st.c;
      ctx.beginPath();
      /* 테두리에 붙은 것은 조금 안으로 들인다 — 선에 반쯤 잘려 안 보인다 */
      var rr = bs[i].edge ? rad * 0.93 : rad;
      ctx.arc(c + bs[i].dx * rr, c + bs[i].dy * rr,
              bs[i].edge ? st.r * 0.7 : st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < bs.length; i++) {
      if (!bs[i].q) { continue; }
      var qr = bs[i].edge ? rad * 0.9 : rad;
      ctx.globalAlpha = bs[i].edge ? 0.75 : 1;
      questIcon(ctx, c + bs[i].dx * qr, c + bs[i].dy * qr, bs[i].edge ? 3.6 : 4.5, bs[i].q, bs[i].tone);
    }
    ctx.globalAlpha = 1;

    /* 나 — 보고 선 쪽으로 부채꼴을 편다 */
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

    /* 테두리와 북(北) */
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c, c, rad, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.strokeText('北', c, 12);                 // 지형 위에 얹히므로 테를 둘러야 읽힌다
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

  /** 게임 루프가 부른다 — 매 프레임 다시 그리지 않는다 (PLAN 34절) */
  function tick(dt) {
    if (!on() || !node) { return false; }
    acc += dt;
    if (acc < everySec()) { return false; }
    acc = 0;
    draw();
    return true;
  }

  /** 진단·데모가 값으로 들여다보는 창 */
  function stats() {
    return {
      on: on(), folded: folded, range: range(), size: sizePx(),
      mounted: !!node, drawn: drawn
    };
  }

  global.DG = global.DG || {};
  global.DG.minimap = {
    RANGES: RANGES, GRID: GRID, TINT: TINT, STYLE: STYLE,
    /* 값을 내는 함수 — 순수하다 (자가진단이 이것만 따로 본다) */
    project: project, cells: cells, blips: blips, questIcon: questIcon, QTONE: QTONE,
    /* 화면 */
    init: init, tick: tick, draw: draw, resize: resize, stats: stats,
    on: on, range: range,
    get folded() { return folded; },
    /** 데모가 정지 화면을 잡을 때만 쓰는 문 */
    set: function (o) {
      if (!o) { return; }
      if (typeof o.step === 'number') { step = o.step % RANGES.length; }
      if (typeof o.folded === 'boolean') { folded = o.folded; }
      apply(); draw();
    },
    /** 진단이 제 뒤를 치울 때 */
    reset: function () { step = 0; folded = false; lastPos = null; heading = -Math.PI / 2; }
  };
})(window);
