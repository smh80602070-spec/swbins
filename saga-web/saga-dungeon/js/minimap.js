/**
 * 미니맵 — 지금 있는 방을 위에서 본 그림 (PLAN 27절)
 * ---------------------------------------------------------------
 * 이 판(사가나락)은 사가만리처럼 넓은 지도를 걷는 게임이 아니다 — 방 하나(560×360
 * 논리 좌표, `dungeon.js` `ROOM_W`·`ROOM_H`)를 아이소메트릭으로 비스듬히 보여 준다.
 * 그래서 "어디로 가야 하나" 가 화면 각도 때문에 헷갈릴 수 있다 — 미니맵은 그 방을
 * **똑바로 위에서** 본 작은 판이다. 방이 바뀌면(`goRoom`) 다음 그리기에서 저절로
 * 새 방 내용으로 갈린다 — 따로 비울 것이 없다.
 *
 *   오른쪽 위 네모 판   방 하나 전체가 늘 다 들어간다(사가만리 미니맵과 달리
 *                       반경·테두리 clamp 가 없다 — 방이 화면보다 안 크다)
 *   점                  적(빨강) · 정예(보라) · 보스(굵은 빨강) · NPC(하늘)
 *                       · 상자·우물·사당·광맥·퍼즐·채집(금) · 문(회색, 오른쪽 벽)
 *   나                  가운데가 아니라 **방 안 실제 자리**에 금빛 점으로 선다
 *   탭                  접는다 (다시 탭하면 펴진다)
 *
 * **판정에는 한 줄도 닿지 않는다** — `dungeon.raw()` 를 읽기만 한다(사가만리
 * 미니맵과 같은 원칙). 값을 내는 함수(`blips`)는 캔버스 없이도 돈다.
 *
 * 마을(town.js)에서도 켠다(2026-09-02, PLAN 28-1절 오버월드 뒤 추가) — 마을
 * 필드로 다른 마을을 향해 걸을 때 "들길"(exit_*, 초록색 점)이 방 밖에 있어
 * 방향을 못 찾겠다는 피드백이 있었다. norm() 의 클램프(-0.06~1.06)가 방
 * 밖 먼 점을 자연히 화면 가장자리에 붙여 주므로, 들길이 아직 안 보여도
 * 어느 쪽 가장자리에 점이 있는지로 방향을 알 수 있다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var STYLE = {
    enemy: { c: '#e2564a', r: 2.4 },
    elite: { c: '#c98cff', r: 3.0 },
    boss:  { c: '#ff2d2d', r: 4.0 },
    npc:   { c: '#7fd0ff', r: 2.6 },
    poi:   { c: '#f5c451', r: 2.8 },
    door:  { c: '#9a8f78', r: 2.2 },
    exit:  { c: '#3ddc84', r: 3.4 }        // 마을 들길 — dungeon3d.js 표식 팻말과 같은 초록
  };

  var node = null, canvas = null, ctx = null;
  var folded = false, lastTap = 0;
  var acc = 0;
  var drawn = 0;                 // 지난번에 찍은 점 수 (진단이 들여다본다)

  function everySec() { return 0.16; }
  function sizePx() {
    var narrow = global.innerWidth && global.innerWidth <= 600;
    return narrow ? 96 : 128;
  }

  /* ── 값을 내는 함수 — 캔버스 없이도 돈다 ─────────────────
   * 방 안 실제 좌표(WALL~ROOM_W-WALL, WALL~ROOM_H-WALL)를 0~1 로 편다.
   * 방은 늘 화면 안에 다 들어가므로(사가만리 세상과 달리 반경이 없다)
   * clamp·edge 처리가 필요 없다 — 그래서 사가만리보다 훨씬 짧다.
   */
  /** 지금 켜져 있는 쪽(던전 또는 마을) — 마을이 있고 마을이 활성이면 그쪽,
   *  아니면(자가진단처럼 마을 스크립트가 없을 수도 있다) 늘 하던 대로 던전 */
  function activeMod() {
    var T = global.DG.town;
    if (T && T.active && T.active()) { return T; }
    return global.DG.dungeon;
  }
  /** PLAN §28-8(오픈월드 A안) — 마을(town.js) 좌표는 이제 방마다 로컬
   *  (0..ROOM_W)이 아니라 세계 좌표다. 던전은 늘 (0,0)(방 하나뿐이라
   *  회귀 없음) — 마을만 창의 왼쪽위 기준점을 정해야 한다.
   *
   *  §28-8 후속(2026-09-06) — 예전엔 그 기준점이 `currentAnchor()`(그
   *  마을의 고정 앵커)였다. 마을 발판 **안**에서는 플레이어가 그 앵커
   *  근처에 있어 문제가 안 됐지만, 들판 한복판을 걸으면 "가장 가까운
   *  마을"의 고정 앵커가 그대로 창을 잡아 플레이어가 창 가장자리로
   *  밀리다 결국 클램프에 눌렸다(README "코너 판이 플레이어 중심이
   *  아니다" 항목). `drawBigWorld()`(M키 큰 지도)는 처음부터 플레이어를
   *  화면 중심에 고정하고 그 둘레를 그렸는데 — 코너 판·blips()는 아직
   *  그 방식이 아니었다. 창 크기(iw×ih)는 그대로 두고, **기준점만
   *  플레이어가 늘 창 한가운데(0.5, 0.5)에 오게** 다시 잡았다 — 새
   *  좌표계가 아니라 원점 계산 하나만 바꾼 것이다. */
  function windowOrigin(M) {
    if (M === global.DG.town) {
      var W = M.ROOM_W, H = M.ROOM_H, WALL = M.WALL;
      var iw = Math.max(1, W - WALL * 2), ih = Math.max(1, H - WALL * 2);
      var run = M.raw();
      if (run && run.player) {
        return { x: run.player.x - WALL - iw / 2, y: run.player.y - WALL - ih / 2 };
      }
      if (M.currentAnchor) { return M.currentAnchor(); }
    }
    return { x: 0, y: 0 };
  }
  function norm(x, y) {
    var M = activeMod();
    var W = M.ROOM_W, H = M.ROOM_H, WALL = M.WALL;
    var o = windowOrigin(M);
    var iw = Math.max(1, W - WALL * 2), ih = Math.max(1, H - WALL * 2);
    return {
      nx: core.clamp((x - o.x - WALL) / iw, -0.06, 1.06),
      ny: core.clamp((y - o.y - WALL) / ih, -0.06, 1.06)
    };
  }

  /**
   * 지금 방에 찍을 것들. `dungeon.raw()` 의 방 모양(POI 마다 다른 필드)을
   * 그대로 훑는다 — 없는 POI 는 그 필드가 `null` 이라 자연히 건너뛴다.
   */
  function blips(run) {
    var out = [];
    if (!run || !run.room) { return out; }
    var room = run.room, i;

    function put(kind, x, y) {
      var n = norm(x, y);
      out.push({ t: kind, nx: n.nx, ny: n.ny });
    }

    /* 부적 '암흑'(§5.3) — 시야 반경 밖의 적은 점을 안 찍는다 */
    var darkR = (run.nightmare && run.nightmare.mods && run.nightmare.mods.indexOf('dark') >= 0 && run.player)
      ? ((global.DG.dungeon && global.DG.dungeon.NM_DARK_R) || 150) : 0;
    for (i = 0; i < room.enemies.length; i++) {
      var e = room.enemies[i];
      if (e.hp <= 0) { continue; }
      if (darkR && Math.hypot(e.x - run.player.x, e.y - run.player.y) > darkR) { continue; }
      put(e.boss ? 'boss' : (e.elite ? 'elite' : 'enemy'), e.x, e.y);
    }
    if (room.chest && !room.chest.taken) { put('poi', room.chest.x, room.chest.y); }
    if (room.well && !room.well.used) { put('poi', room.well.x, room.well.y); }
    if (room.shrine && !room.shrine.used) { put('poi', room.shrine.x, room.shrine.y); }
    if (room.vein && !room.vein.used) { put('poi', room.vein.x, room.vein.y); }
    if (room.merchant) { put('npc', room.merchant.x, room.merchant.y); }
    if (room.captive && !room.captive.freed) { put('npc', room.captive.x, room.captive.y); }
    if (room.puzzle) {
      for (i = 0; i < room.puzzle.pods.length; i++) {
        var pod = room.puzzle.pods[i];
        if (!pod.lit) { put('poi', pod.x, pod.y); }
      }
    }
    if (room.forage) {
      for (i = 0; i < room.forage.herbs.length; i++) {
        var herb = room.forage.herbs[i];
        if (!herb.picked) { put('poi', herb.x, herb.y); }
      }
      if (room.forage.pond && !room.forage.pond.used) { put('poi', room.forage.pond.x, room.forage.pond.y); }
    }
    if (room.doors) {
      var D = global.DG.dungeon;
      for (i = 0; i < room.doors.length; i++) { put('door', D.ROOM_W - D.WALL, room.doors[i].y); }
    }
    /* 마을(town.js) 전용 — 들길(exit_*)은 초록, 그 밖 표식(굴혈·역참·결사비)과
       사람은 기존 poi·npc 색을 그대로 쓴다. 던전 방에는 marks·npcs 가 아예
       없으니(위 room.doors 처럼 필드 자체가 undefined) 안전하게 건너뛴다. */
    if (room.marks) {
      for (i = 0; i < room.marks.length; i++) {
        var mk = room.marks[i];
        put(mk.key && mk.key.indexOf('exit_') === 0 ? 'exit' : 'poi', mk.x, mk.y);
      }
    }
    if (room.npcs) {
      for (i = 0; i < room.npcs.length; i++) { put('npc', room.npcs[i].x, room.npcs[i].y); }
    }
    return out;
  }

  /* ── 화면 ─────────────────────────────────────────────── */

  function mount() {
    if (node || !global.document) { return null; }
    node = global.document.createElement('div');
    node.id = 'dg-minimap';
    node.setAttribute('title', '미니맵 — 탭하면 접힙니다');
    canvas = global.document.createElement('canvas');
    node.appendChild(canvas);
    var tag = global.document.createElement('b');
    tag.className = 'mm-tag';
    node.appendChild(tag);
    node.style.display = 'none';           // tick() 이 던전일 때만 'block' 으로 켠다
    global.document.body.appendChild(node);
    node.addEventListener('click', tap);
    return node;
  }

  function tap(e) {
    if (e && e.preventDefault) { e.preventDefault(); }
    var now = Date.now();
    folded = !folded;
    lastTap = now;
    apply();
    draw();
  }

  function apply() {
    if (!node) { return; }
    node.classList.toggle('folded', folded);
    var tag = node.querySelector('.mm-tag');
    if (tag && folded) { tag.textContent = '🗺️'; }
  }

  /* 2026-09-08 — 사가만리처럼 좌하단 **원형**으로 통일(사용자 요청). 이 판은
     방 하나가 늘 화면(사각) 안에 다 들어가던 옛 그림이라, 사각을 그대로
     원에 욱여넣으면 네 귀퉁이가 잘린다. 대신 **원에 내접하는 사각형**
     크기로 축소해 방 전체(네 귀퉁이까지)가 항상 원 안에 다 들어오게
     맞춘다 — 정보 손실 없이 모양만 사가만리와 같은 원이 된다. */
  var INSCRIBE = Math.SQRT2;   // 원에 내접하는 정사각형의 반변 배수(0.5*√2 = 대각 반지름)

  function resize() {
    if (!canvas) { return 0; }
    var s = sizePx();             // 정사각 캔버스(사가만리와 같은 원형 판)
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(s * dpr) || canvas.height !== Math.round(s * dpr)) {
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
    var M = activeMod();
    if (!M || !M.active() || folded || !canvas) { return 0; }
    var run = M.raw();
    if (!run || !run.room) { return 0; }
    var dpr = resize();
    if (!ctx) { return 0; }

    var s = sizePx(), c = s / 2, rad = c - 3;
    var k = rad * INSCRIBE;   // norm() 0~1 좌표 → 원 중심 기준 픽셀 배수
    function px(n) { return c + (n - 0.5) * k; }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s, s);

    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, rad, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(10,8,5,.72)';
    ctx.fillRect(0, 0, s, s);

    /* 코너 미니맵 지형(PLAN §28-8 후속, 2026-09-06) — 마을일 때만, 밝힌
       칸 위에 실제 지형색을 덧칠한다(안 밝힌 칸은 위 민무늬 배경이 그대로
       "안개" 노릇을 한다). 던전은 세계 좌표·포그오브워 개념이 없어(방
       하나뿐) 그대로 옛 민무늬 배경이다 — 회귀 없음. */
    if (M === global.DG.town) {
      var tiles = smallWorldTiles(M, k, k), ti;
      for (ti = 0; ti < tiles.length; ti++) {
        ctx.fillStyle = tiles[ti].color;
        ctx.fillRect(c - k / 2 + tiles[ti].x, c - k / 2 + tiles[ti].y, tiles[ti].w, tiles[ti].h);
      }
      /* 소품 점(2026-09-11) — 큰 지도(M키)가 이미 하던 걸 코너에도 얹는다 */
      var props = smallWorldProps(M, k, k), pi;
      for (pi = 0; pi < props.length; pi++) {
        ctx.fillStyle = props[pi].color;
        ctx.beginPath();
        ctx.arc(c - k / 2 + props[pi].x, c - k / 2 + props[pi].y, props[pi].r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    var bs = blips(run), i, st;
    drawn = bs.length;
    for (i = 0; i < bs.length; i++) {
      st = STYLE[bs[i].t] || STYLE.enemy;
      ctx.fillStyle = st.c;
      ctx.beginPath();
      ctx.arc(px(bs[i].nx), px(bs[i].ny), st.r, 0, Math.PI * 2);
      ctx.fill();
    }

    /* 나 — 방 안 실제 자리 */
    var pn = norm(run.player.x, run.player.y);
    ctx.fillStyle = '#f5b445';
    ctx.beginPath();
    ctx.arc(px(pn.nx), px(pn.ny), 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    /* 지역 경계 — 방 벽(내접 사각형 그대로) */
    ctx.strokeStyle = 'rgba(212,178,110,.55)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(px(0), px(0), k, k);

    ctx.restore();

    /* 테두리와 방위(北) — 사가만리 미니맵과 같은 관례(이 판은 위=북 고정,
       실제 나침반 방위가 아니라 "위가 늘 북"이라는 장식적 약속이다) */
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

    var tag = node.querySelector('.mm-tag');
    if (tag) { tag.textContent = M === global.DG.town ? '마을' : ('B' + (run.floor || 1)); }

    return drawn;
  }

  /* ── 전체 지도(자동지도) — 원작 M키식 ────────────────────
   * 사용자가 "마을 M키 지도가 점만 보인다"고 지적한 뒤 "원작처럼·
   * 투명으로 보여 줄 수도 있고"라고 요청했다(2026-09-06). 그전엔 M키가
   * 마을 넷의 고정 배치(상자 그림)만 보여 줬는데, 그 대신 **위 미니맵과
   * 같은 계산(blips·norm)을 그대로 재사용해 화면 전체를 반투명하게
   * 덮는 큰 판**으로 바꿨다 — 새 좌표계를 만들지 않는다. 마을·던전
   * 어디서나 같은 함수(activeMod())로 켜진다.
   */
  var bigNode = null, bigCanvas = null, bigCtx = null, bigOn = false;

  function mountBig() {
    if (bigNode || !global.document) { return null; }
    bigNode = global.document.createElement('div');
    bigNode.id = 'dg-automap';
    bigNode.setAttribute('title', '전체 지도 — 탭하면 닫힙니다');
    bigCanvas = global.document.createElement('canvas');
    bigNode.appendChild(bigCanvas);
    global.document.body.appendChild(bigNode);
    bigNode.addEventListener('click', closeBig);
    return bigNode;
  }

  function resizeBig() {
    if (!bigCanvas) { return 0; }
    var w = global.innerWidth, h = global.innerHeight;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    if (bigCanvas.width !== Math.round(w * dpr) || bigCanvas.height !== Math.round(h * dpr)) {
      bigCanvas.width = Math.round(w * dpr);
      bigCanvas.height = Math.round(h * dpr);
      bigCtx = null;
    }
    if (!bigCtx) { bigCtx = bigCanvas.getContext('2d'); }
    return dpr;
  }

  /** 자가진단용 순수 계산 — 방 비율에 맞춰 화면 안쪽에 지도 사각형을 잡는다.
   *  canvas 없이도 돈다(진단이 이 값만 따로 확인할 수 있게). */
  function bigLayout(winW, winH, roomW, roomH, wall) {
    var pad = Math.min(winW, winH) * 0.08;
    var boxW = Math.max(1, winW - pad * 2), boxH = Math.max(1, winH - pad * 2);
    var ratio = Math.max(0.1, (roomW - wall * 2) / (roomH - wall * 2));
    var mapW, mapH;
    if (boxW / boxH > ratio) { mapH = boxH; mapW = boxH * ratio; }
    else { mapW = boxW; mapH = boxW / ratio; }
    return { ox: (winW - mapW) / 2, oy: (winH - mapH) / 2, w: mapW, h: mapH };
  }

  /** 지형 종류별 색(PLAN §28-8 Phase 2) — field3d.kindOf()가 내는 이름
   *  그대로 키를 쓴다. dungeon3d.js가 실제로 입히는 색과 완전히 같을
   *  필요는 없다(자동지도는 요약이지 그림 그대로가 아니다) — 성격(숲=
   *  초록·물=파랑·바위=회색 등)만 한눈에 갈리면 된다. */
  var KIND_COLOR = {
    forest: '#3a5f3a', rock: '#6b6b64', ruin: '#7a6f5a',
    road: '#8a7a5a', water: '#2f5a78', cave: '#201d1a', altar: '#5a4a78',
    camp: '#7a5030', swamp: '#4a5a3a'
  };

  /** 소품 점 색(2026-09-10, "점만 보여" 해결) — field3d.chunkAt()이 내는
   *  t 값 그대로 키를 쓴다. 단색 칸(KIND_COLOR) 위에 이 점들을 얹으면
   *  "실제 화면을 축소한 것"에 가까워진다 — dungeon3d.js가 그 자리에
   *  세우는 것과 같은 소품이다(같은 산식으로 뽑으니 자리도 같다). */
  var PROP_COLOR = {
    tree: '#5fae5f', tree_dead: '#8a7050', rock: '#9a9a92',
    pillar: '#b8ab8c', wall: '#b8ab8c', altar: '#c9a4f5',
    cavemouth: '#0c0a08', fire: '#f0a244', tent: '#c9915a',
    pond: '#6fb4e8', reed: '#7fbf7f', post: '#d8c48a',
    /* §5.7 시대 퓨전(2026-09-18) — biome당 하나뿐이라 자동지도에서도
       "여기 있다"는 눈에 띄어야 한다(field3d.js eraLayerAt 참고). */
    t_factory: '#5a3a30', t_solar: '#1c3a5e', t_tower: '#9a5a2e',
    t_pylon: '#7a7f88', t_hologram: '#5adfe8'
    /* path(길)는 이미 road 칸 색으로 충분해 점을 안 찍는다 — 안 그러면
       길이 온통 점으로 덮여 오히려 abstract해진다. */
  };
  /** '#rrggbb' 에 0xRRGGBB 를 k 만큼 섞는다 */
  function tintHex(hex, rgb, k) {
    var n = parseInt(String(hex).slice(1), 16);
    var r = ((n >> 16) & 255) * (1 - k) + ((rgb >> 16) & 255) * k;
    var g = ((n >> 8) & 255) * (1 - k) + ((rgb >> 8) & 255) * k;
    var b = (n & 255) * (1 - k) + (rgb & 255) * k;
    return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1);
  }
  var WORLD_VIEW_HALF = 3200;   // 화면 중심(플레이어) 기준 세계 좌표로 이만큼(±) 보여준다

  /** 코너(상시) 미니맵 지형 — 순수 계산(캔버스 없이, 자가진단이 값으로
   *  본다). norm()과 **똑같은 좌표틀**(ax,ay·iw,ih·클램프 여유 0.06)을
   *  거꾸로 써서, 그 방(과 클램프 여유만큼의 방 밖)에 걸치는 지형 칸을
   *  화면 좌표 사각형으로 낸다. blips()가 이미 이 틀로 점을 찍고 있어서
   *  (norm() 참고) 지형과 점이 서로 안 어긋난다. 안 밝힌 칸(`T.isSeen`
   *  거짓)은 아예 안 낸다 — draw()의 민무늬 배경이 그대로 안개 노릇을
   *  한다(M키 큰 지도의 포그오브워와 같은 규칙, PLAN §28-8 Phase 2). */
  function smallWorldTiles(T, s, h) {
    var F = global.DG.field3d;
    if (!F || !T.worldKindAt || !T.isSeen) { return []; }
    var W = T.ROOM_W, H = T.ROOM_H, WALL = T.WALL;
    var o = windowOrigin(T), ax = o.x, ay = o.y;
    var iw = Math.max(1, W - WALL * 2), ih = Math.max(1, H - WALL * 2);
    var MARGIN = 0.06;
    var scaleX = s / iw, scaleY = h / ih;
    var offX = -(ax + WALL) * scaleX, offY = -(ay + WALL) * scaleY;
    var CHUNK = F.CHUNK;
    var x0 = ax + WALL - iw * MARGIN, x1 = ax + WALL + iw * (1 + MARGIN);
    var y0 = ay + WALL - ih * MARGIN, y1 = ay + WALL + ih * (1 + MARGIN);
    var cx0 = Math.floor(x0 / CHUNK) - 1, cx1 = Math.floor(x1 / CHUNK) + 1;
    var cz0 = Math.floor(y0 / CHUNK) - 1, cz1 = Math.floor(y1 / CHUNK) + 1;
    var tw = CHUNK * scaleX + 1, th = CHUNK * scaleY + 1;   // +1 — 이음매(반올림 틈) 안 뜨게
    var out = [], cx, cz;
    for (cz = cz0; cz <= cz1; cz++) {
      for (cx = cx0; cx <= cx1; cx++) {
        if (!T.isSeen(cx, cz)) { continue; }
        var kind = T.worldKindAt(cx, cz);
        var col = kind === 'town' ? '#5a4a30' : (KIND_COLOR[kind] || '#3a3a3a');
        out.push({ x: cx * CHUNK * scaleX + offX, y: cz * CHUNK * scaleY + offY, w: tw, h: th, color: col });
      }
    }
    return out;
  }

  /** 코너(상시) 미니맵 소품 점(2026-09-11) — `drawBigWorld()`가 이미 하는
   *  일(`worldPropsAt`+`PROP_COLOR`)을 코너 미니맵에도 그대로 얹는다.
   *  과거 세션이 "칸이 너무 작아 점이 안 보일 것 같다"며 미뤄 뒀었는데,
   *  실측하니 이 칸(`tw`/`th`, 위 `smallWorldTiles` 계산과 동일)이 데스크톱
   *  ~17-41px·폰 ~26-41px 로 `drawBigWorld`의 8px 문턱을 이미 넉넉히
   *  넘는다 — 안 보일 거라는 추측이 틀렸다. `smallWorldTiles`는 손 안 댄다
   *  (`_test.html`이 그 반환 모양에 기대고 있다) — 대신 같은 좌표 변환을
   *  그대로 복붙한다(이 파일이 이미 `drawBigWorld`/`smallWorldTiles`로
   *  쓰고 있는 "복붙이지만 나란히 유지" 관례). */
  function smallWorldProps(T, s, h) {
    var F = global.DG.field3d;
    if (!F || !T.worldKindAt || !T.worldPropsAt || !T.isSeen) { return []; }
    var W = T.ROOM_W, H = T.ROOM_H, WALL = T.WALL;
    var o = windowOrigin(T), ax = o.x, ay = o.y;
    var iw = Math.max(1, W - WALL * 2), ih = Math.max(1, H - WALL * 2);
    var MARGIN = 0.06;
    var scaleX = s / iw, scaleY = h / ih;
    var offX = -(ax + WALL) * scaleX, offY = -(ay + WALL) * scaleY;
    var CHUNK = F.CHUNK;
    var x0 = ax + WALL - iw * MARGIN, x1 = ax + WALL + iw * (1 + MARGIN);
    var y0 = ay + WALL - ih * MARGIN, y1 = ay + WALL + ih * (1 + MARGIN);
    var cx0 = Math.floor(x0 / CHUNK) - 1, cx1 = Math.floor(x1 / CHUNK) + 1;
    var cz0 = Math.floor(y0 / CHUNK) - 1, cz1 = Math.floor(y1 / CHUNK) + 1;
    var tw = CHUNK * scaleX + 1, th = CHUNK * scaleY + 1;
    var drawProps = Math.min(tw, th) >= 8;    // drawBigWorld()와 같은 문턱
    if (!drawProps) { return []; }
    var out = [], cx, cz, pr;
    for (cz = cz0; cz <= cz1; cz++) {
      for (cx = cx0; cx <= cx1; cx++) {
        if (!T.isSeen(cx, cz)) { continue; }
        var kind = T.worldKindAt(cx, cz);
        if (kind === 'town') { continue; }    // 마을 발판 — 건물은 따로 그려진다
        var props = T.worldPropsAt(cx, cz);
        for (pr = 0; pr < props.length; pr++) {
          var pc = PROP_COLOR[props[pr].t];
          if (!pc) { continue; }
          out.push({
            x: props[pr].x * scaleX + offX, y: props[pr].z * scaleY + offY,
            r: Math.max(1, Math.min(tw, th) * 0.12), color: pc
          });
        }
      }
    }
    return out;
  }

  /** 마을(town.js) 전용 — 진짜 지형 기반 자동지도(PLAN §28-8 Phase 2).
   *  "점만 보인다"던 지적을 구조적으로 푼다: 방 하나가 아니라 **밝힌
   *  들판 칸(포그오브워)의 실제 지형**을 세계 좌표 그대로 그린다. 던전은
   *  안 건드린다(아래 drawBig()이 따로 가른다) — 던전은 여전히 방 하나뿐인
   *  옛 방식 그대로.
   */
  function drawBigWorld(T, W, H) {
    var F = global.DG.field3d;
    var run = T.raw();
    if (!run || !run.player || !F) { return false; }
    var p = run.player;
    /* WORLD_VIEW_HALF 은 "짧은 쪽 화면 절반"이 세계 좌표로 얼마인지만
       정한다 — scale 은 그 짧은 쪽 기준으로 잡되, 칸을 훑는 범위(cx0..cx1
       등)는 **실제 화면 W·H 전체**로 다시 재야 한다. 안 그러면 화면이
       정사각형이 아닐 때(대개 그렇다) 긴 쪽 여백이 그냥 안 그려진 채로
       남는다 — 실제로 그렇게 비어 보였다(CDP 스크린샷으로 확인). */
    var half = WORLD_VIEW_HALF;
    var scale = Math.min(W, H) * 0.92 / (half * 2);
    var ox = W / 2, oy = H / 2;
    function toScreen(wx, wy) { return { x: ox + (wx - p.x) * scale, y: oy + (wy - p.y) * scale }; }

    var CHUNK = F.CHUNK;
    var halfX = (W / 2) / scale, halfY = (H / 2) / scale;
    var cx0 = Math.floor((p.x - halfX) / CHUNK) - 1, cx1 = Math.floor((p.x + halfX) / CHUNK) + 1;
    var cz0 = Math.floor((p.y - halfY) / CHUNK) - 1, cz1 = Math.floor((p.y + halfY) / CHUNK) + 1;
    var tilePx = Math.max(1, CHUNK * scale) + 1;   // +1 — 인접 칸 사이 이음매(반올림 틈)가 안 뜨게
    /* 소품 점 — 칸이 화면에서 너무 작아지면(축소를 많이 했을 때) 점이
       서로 뭉개져 오히려 지저분해지므로, 칸 하나가 8px는 넘을 때만 찍는다. */
    var drawProps = tilePx >= 8 && !!T.worldPropsAt;
    var cx, cz, pr, WMb = global.DG.worldMap;
    for (cz = cz0; cz <= cz1; cz++) {
      for (cx = cx0; cx <= cx1; cx++) {
        if (!T.isSeen(cx, cz)) { continue; }        // 안 밝힌 칸은 안개 그대로
        var kind = T.worldKindAt(cx, cz);
        var col = kind === 'town' ? '#5a4a30' : (KIND_COLOR[kind] || '#3a3a3a');
        /* 고정 세계 지도(§5.12) — 지역 땅빛을 35% 섞어 지역 경계가 지도에서도 읽히게 */
        if (WMb && kind !== 'town') { col = tintHex(col, WMb.regionAt(cx * CHUNK + CHUNK / 2, cz * CHUNK + CHUNK / 2).ground, 0.35); }
        var s = toScreen(cx * CHUNK, cz * CHUNK);
        bigCtx.fillStyle = col;
        bigCtx.fillRect(s.x, s.y, tilePx, tilePx);
        if (drawProps && kind !== 'town') {
          var props = T.worldPropsAt(cx, cz);
          for (pr = 0; pr < props.length; pr++) {
            var pc = PROP_COLOR[props[pr].t];
            if (!pc) { continue; }
            var ps = toScreen(props[pr].x, props[pr].z);
            bigCtx.fillStyle = pc;
            bigCtx.beginPath(); bigCtx.arc(ps.x, ps.y, Math.max(1, tilePx * 0.07), 0, Math.PI * 2); bigCtx.fill();
          }
        }
      }
    }

    /* 지금 선 지역 이름 — 원작 지도 머리의 지역명 자리 */
    if (WMb) {
      var rgn = WMb.regionAt(p.x, p.y);
      bigCtx.font = '700 15px system-ui, sans-serif';
      bigCtx.textBaseline = 'top';
      bigCtx.fillStyle = 'rgba(0,0,0,0.55)';
      bigCtx.fillRect(10, 10, Math.min(W - 20, 30 + (rgn.name.length + rgn.hanja.length + 2) * 15), 26);
      bigCtx.fillStyle = '#f0d9a0';
      bigCtx.fillText(rgn.emoji + ' ' + rgn.name + '(' + rgn.hanja + ') · 위험 ' + WMb.levelAt(p.x, p.y), 18, 15);
      /* 지역 우두머리 자리(§5.13) — 늘 보인다(어디로 갈지가 보여야 한다). 쉬는 중이면 흐리게 */
      var DGm = global.DG.dungeon, rbs = DGm && DGm.regionBossState ? DGm.regionBossState() : {};
      bigCtx.font = '600 12px system-ui, sans-serif';
      bigCtx.textBaseline = 'middle';
      WMb.REGIONS.forEach(function (rr) {
        var sp = WMb.bossSpot(rr.key);
        if (!sp) { return; }
        var q = toScreen(sp.x, sp.y);
        if (q.x < -40 || q.y < -20 || q.x > W + 40 || q.y > H + 20) { return; }
        var st = rbs[rr.key], resting = st && st.lastAt && Date.now() - st.lastAt < (DGm.RB_CD_MS || 600000);
        bigCtx.globalAlpha = resting ? 0.45 : 1;
        bigCtx.fillStyle = '#e06565';
        bigCtx.fillText('☠️ ' + rr.boss.name + (st && st.kills ? ' ✓' : ''), q.x - 8, q.y);
        bigCtx.globalAlpha = 1;
      });
      /* 지역 사연(§5.14) — 흔적 걸음에 선 사슬의 흔적 자리 🔍 */
      var QM = global.DG.quest, clues = QM && QM.clueSpots ? QM.clueSpots() : [];
      bigCtx.fillStyle = '#9fd3ff';
      clues.forEach(function (c) {
        var q = toScreen(c.x, c.y);
        if (q.x < -40 || q.y < -20 || q.x > W + 40 || q.y > H + 20) { return; }
        bigCtx.fillText('🔍 ' + c.emoji + ' ' + c.name, q.x - 8, q.y);
      });
    }
    /* 마을 위치는 늘 보인다(존재 자체는 이미 아는 정보 — 옛 오버월드 창이
       고정 배치를 늘 보여 주던 것과 같은 생각) — 화면 밖이면 건너뛴다. */
    var towns = T.overworld.list(), i;
    bigCtx.font = '600 13px system-ui, sans-serif';
    bigCtx.textBaseline = 'middle';
    for (i = 0; i < towns.length; i++) {
      var tw = towns[i], a = tw.anchor || T.anchorOf(tw.id);
      var cxw = a.x + T.ROOM_W / 2, cyw = a.y + T.ROOM_H / 2;
      var s2 = toScreen(cxw, cyw);
      if (s2.x < -30 || s2.x > W + 30 || s2.y < -30 || s2.y > H + 30) { continue; }
      bigCtx.fillStyle = STYLE.exit.c;
      bigCtx.beginPath(); bigCtx.arc(s2.x, s2.y, 5, 0, Math.PI * 2); bigCtx.fill();
      bigCtx.textAlign = s2.x <= W / 2 ? 'left' : 'right';
      bigCtx.fillText(tw.name, s2.x + (s2.x <= W / 2 ? 10 : -10), s2.y);
    }

    /* 지금 방(마을 안이면 NPC·표식, 들판이면 빈 배열) 점 — 예전과 같은 blips() */
    var bs = blips(run), st;
    for (i = 0; i < bs.length; i++) {
      st = STYLE[bs[i].t] || STYLE.enemy;
      var eo = run.anchor || { x: 0, y: 0 };
      /* blips() 는 norm()(0~1, 방 기준)을 낸다 — 세계 좌표로 되돌리려면
         그 방(anchor~anchor+ROOM)의 실제 폭으로 다시 편다. */
      var ewx = eo.x + bs[i].nx * T.ROOM_W, ewy = eo.y + bs[i].ny * T.ROOM_H;
      var es = toScreen(ewx, ewy);
      bigCtx.fillStyle = st.c;
      bigCtx.beginPath(); bigCtx.arc(es.x, es.y, st.r * 2.3, 0, Math.PI * 2); bigCtx.fill();
    }

    /* 나 — 화면 중심에 고정 */
    bigCtx.fillStyle = '#f5b445';
    bigCtx.beginPath(); bigCtx.arc(ox, oy, 7, 0, Math.PI * 2); bigCtx.fill();
    bigCtx.strokeStyle = 'rgba(0,0,0,.7)'; bigCtx.lineWidth = 2; bigCtx.stroke();
    return true;
  }

  /** 안내문("탭하면 닫힙니다") 뒤에 옅은 배경을 깔아, 마을에 따라 들길
   *  라벨이 화면 아래쪽에 몰릴 때도(§52 "남은 것") 안내문이 늘 읽히게 한다.
   *  라벨 쪽 배치는 그대로 두고(정보를 숨기지 않는다) 안내문만 위에 뜬다. */
  function fillFooter(ctx, text, x, y) {
    var w = ctx.measureText(text).width;
    ctx.save();
    ctx.fillStyle = 'rgba(6, 8, 14, .72)';
    ctx.fillRect(x - w / 2 - 10, y - 12, w + 20, 24);
    ctx.restore();
    ctx.fillStyle = 'rgba(232,226,210,.8)';
    ctx.fillText(text, x, y);
  }

  function drawBig() {
    var M = activeMod();
    if (!M || !M.active() || !bigOn || !bigCanvas) { return false; }
    var run = M.raw();
    if (!run || !run.room) { return false; }
    var dpr = resizeBig();
    if (!bigCtx) { return false; }
    var W = global.innerWidth, H = global.innerHeight;
    bigCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bigCtx.clearRect(0, 0, W, H);

    /* 반투명 — 게임 화면을 완전히 안 가린다("투명으로 보여 줄 수도 있고") */
    bigCtx.fillStyle = 'rgba(6, 8, 14, .62)';
    bigCtx.fillRect(0, 0, W, H);

    /* 마을(town.js) — 진짜 지형 기반 세계 지도(PLAN §28-8 Phase 2). 던전은
       옛 "방 하나짜리 판" 그대로 아래로 내려간다(회귀 없음). */
    if (M === global.DG.town) {
      var ok = drawBigWorld(M, W, H);
      bigCtx.font = '600 14px system-ui, sans-serif';
      bigCtx.textAlign = 'center';
      fillFooter(bigCtx, '탭하면 닫힙니다', W / 2, H - 20);
      return ok;
    }

    var L = bigLayout(W, H, M.ROOM_W, M.ROOM_H, M.WALL);
    bigCtx.strokeStyle = 'rgba(212, 178, 110, .75)';
    bigCtx.lineWidth = 2;
    bigCtx.strokeRect(L.ox, L.oy, L.w, L.h);

    var bs = blips(run), i, st;
    for (i = 0; i < bs.length; i++) {
      st = STYLE[bs[i].t] || STYLE.enemy;
      bigCtx.fillStyle = st.c;
      bigCtx.beginPath();
      bigCtx.arc(L.ox + bs[i].nx * L.w, L.oy + bs[i].ny * L.h, st.r * 2.3, 0, Math.PI * 2);
      bigCtx.fill();
    }

    /* 마을 들길은 어디로 가는지 이름을 옆에 적는다 — 예전 오버월드 창이
       하던 일(마을 이름 보여 주기)을 이 판 하나로 합쳤다. */
    if (run.room.marks) {
      bigCtx.font = '600 13px system-ui, sans-serif';
      bigCtx.textBaseline = 'middle';
      for (i = 0; i < run.room.marks.length; i++) {
        var mk = run.room.marks[i];
        if (!mk.key || mk.key.indexOf('exit_') !== 0) { continue; }
        var n = norm(mk.x, mk.y);
        var lx = L.ox + n.nx * L.w, ly = L.oy + n.ny * L.h;
        var right = n.nx <= 0.5;
        bigCtx.textAlign = right ? 'left' : 'right';
        bigCtx.fillStyle = STYLE.exit.c;
        bigCtx.fillText((mk.emoji || '') + ' ' + (mk.name || ''), lx + (right ? 12 : -12), ly);
      }
    }

    /* 나 */
    var pn = norm(run.player.x, run.player.y);
    bigCtx.fillStyle = '#f5b445';
    bigCtx.beginPath();
    bigCtx.arc(L.ox + pn.nx * L.w, L.oy + pn.ny * L.h, 7, 0, Math.PI * 2);
    bigCtx.fill();
    bigCtx.strokeStyle = 'rgba(0,0,0,.7)';
    bigCtx.lineWidth = 2;
    bigCtx.stroke();

    bigCtx.font = '600 14px system-ui, sans-serif';
    bigCtx.textAlign = 'center';
    fillFooter(bigCtx, '탭하면 닫힙니다', W / 2, L.oy + L.h + 24);
    return true;
  }

  function openBig() {
    var M = activeMod();
    if (!M || !M.active()) { return false; }
    mountBig();
    bigOn = true;
    if (bigNode) { bigNode.style.display = 'block'; }
    drawBig();
    return true;
  }
  function closeBig() {
    bigOn = false;
    if (bigNode) { bigNode.style.display = 'none'; }
  }
  function toggleBig() {
    if (bigOn) { closeBig(); return false; }
    return openBig();
  }

  function init() {
    mount();
    apply();
    draw();
    return true;
  }

  /** 게임 루프가 부른다 — 매 프레임 다시 그리지 않는다 */
  function tick(dt) {
    if (!node) { return false; }
    var M = activeMod();
    var show = !!(M && M.active());
    /* `''` 는 인라인 스타일만 지운다 — CSS 시트의 `display: none;` 이 그대로
       이겨서 계속 안 보였다(실기기 검증 중 발견). 'block' 으로 확실히 덮는다 */
    node.style.display = show ? 'block' : 'none';
    if (!show) { return false; }
    acc += dt;
    if (acc < everySec()) { return false; }
    acc = 0;
    draw();
    return true;
  }

  /** 진단·데모가 값으로 들여다보는 창 */
  function stats() {
    return { folded: folded, size: sizePx(), mounted: !!node, drawn: drawn };
  }

  global.DG = global.DG || {};
  global.DG.minimap = {
    STYLE: STYLE,
    /* 값을 내는 함수 — 순수하다 (자가진단이 이것만 따로 본다) */
    norm: norm, blips: blips,
    /* 화면 */
    init: init, tick: tick, draw: draw, resize: resize, stats: stats,
    get folded() { return folded; },
    set: function (o) { if (o && typeof o.folded === 'boolean') { folded = o.folded; } apply(); draw(); },
    reset: function () { folded = false; },
    /* 전체 지도(자동지도) — M키/🧭가 부른다 */
    openBig: openBig, closeBig: closeBig, toggleBig: toggleBig,
    /** 자가진단용 — 순수 계산만(캔버스 없이) */
    _bigLayout: bigLayout,
    _smallWorldTiles: smallWorldTiles,
    _smallWorldProps: smallWorldProps,
    get bigOn() { return bigOn; }
  };
})(window);
