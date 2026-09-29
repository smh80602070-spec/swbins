/**
 * 지형 설계(地形) — 오픈월드 RPG식 강·호수·산맥·정상 + 오르기·헤엄·점프 (PLAN §5 ⑰)
 * ---------------------------------------------------------------
 * ⑩·⑮ 로 땅마다 이름과 바이옴은 생겼지만, 지형은 여전히 노이즈 문턱의 **뭉치**였다 —
 * 산은 16m 언덕, 물은 흩어진 웅덩이. "저 산을 넘으면 뭐가 있을까"가 없었다(사용자
 * "맵이 오픈월드 RPG식 맞아?"). 여기서 **손으로 그은 고정 지형**을 얹는다.
 *
 *   강 셋    은하강(설산 → 고향 동쪽 → 갈대 나루 → 소금 갯벌 하구) · 붉은내(용의 협곡 → 가마골)
 *            · 달빛내(옛 성터 → 달그림자 호수). 굽이는 고정 노이즈 — 해시만, 난수 0
 *   호수 하나 달그림자 호수
 *   산맥 일곱 땅마다 제 산 — 설산맥·솔숲 고개·붉은 벼랑·용의 협곡·성터 능선·서역 사구·구름 산.
 *            능선 높이 34~140m(옛 산 16m), 허리가 가장 가파르다(smoothstep 단면)
 *   정상     능선 위 이름 있는 봉우리 — 30m 안에 오르면 발견(보상·기록). save.peaks
 *
 * 판정 층(`kindAt`·`riverAt`·`ridgeAt`·`liftAt`·`peaks`)은 순수 함수다. `world.terrainAt`
 * 이 손그림 땅·실제 지형(OSM) 다음, 노이즈 앞에서 이것을 묻는다. **고향(원점 1.3km)은
 * 안 닿는다** — 옛 지형·진단 그대로.
 *
 * ── 몸 (키보드 모드만 — GPS 로 걷는 중엔 실제 몸이 걷는다) ──────────
 *   오르기  능선 위 가파른 오르막(기울기 0.28 넘게)은 걸음이 절반, 기력이 준다. 다하면 못 오른다
 *   헤엄    강·호수에선 걸음 0.6, 기력이 준다(여울은 얕아 걸어 건너고, 가운데 다리가 선다)
 *   점프    스페이스 / 점프 단추 — 1.3m 뛴다(화면 층). 오르는 중에 뛰면 기력 20 으로 4m 도약
 *   활공    뛰어오른 채 한 번 더 누르면 천 날개를 편다 — 초당 2.4m 가라앉으며 걸음 ×1.7, 기력 초당 4.
 *           기력이 다하면 초당 9m, 한 번 더 누르면 접고 떨어진다(초당 14m). 땅에 닿으면 끝(⑰ 다음)
 *   순간이동 오른 정상은 전체 지도(M)의 순간이동 지점이 된다 — 정상으로 날아가 활공으로 내려온다
 *   구름섬  §5 ⑲-20 — 바람 기둥(skyisle.js) 안 공중이면 저절로 활공하며 솟는다(접으면 기둥을 나갈 때까지 안 편다).
 *           섬 윗면에 내리면 `body.sky` — 섬 위에선 강·비탈을 안 보고, 난간 밖으로는 뛰어넘어야(점프) 나간다(나가면 날개를 편다)
 *           §5 ⑲-35 — 섬만이 아니라 skyisle 발판 목록(`padAt`: 구름섬·관측대)과 상승 기류 목록(`draftAt`: 바람 기둥·시간 기둥)을 본다
 *   다리·폭포 여울마다 강을 가로지르는 다리 하나(걸으면 상판 위에 선다), 은하강·붉은내 발원지에 폭포.
 *           그림은 손그림 땅(land.js 'B'·'W')의 다리·폭포 모델을 그대로 빌린다(`markAt`)
 *   기력    100 — 가만히·평지면 초당 25 찬다. 들판 전투 기력(⑨)과는 따로다(싸움 중엔 그쪽)
 *   기둥 타기 §5 ⑲-34 — 구조물 다리(era-sites `poles`, 조선소 기중기)를 마주 보고 밀면 붙잡고 초당 POLE_UP m 오른다(기력 초당 POLE_DRAIN).
 *           안 밀면 매달려 초당 POLE_HANG 만 준다 · 기력이 다하면 미끄러져 내려온다 · 오르는 중 점프 = LEAP m 도약(기력 20) ·
 *           등지면 손을 놓고 떨어진다. 꼭대기(top)에 닿으면 들보 위에 선다 — 들보 길 밖으로는 못 걷고, 뛰면 날개를 편다.
 *           자동 순행 중엔 안 붙잡는다. §5 ⑲-38 — 은하 나루 계류 탑(skyport `poles`)도 같은 몸으로 탄다(꼭대기 네모 위에 선다).
 *           기둥이 제 글(grab·perchText·edgeText)을 가지면 그것을 쓴다
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('landform.' + key, def); }
  function on() { return K('on', 1) ? true : false; }

  var CELL = 48;              // world.terrainAt 격자
  var HOME_R = 1300;          // 고향 둘레는 안 건드린다
  var STEP = 60;              // 선을 이만큼마다 잘게 쪼갠다(굽이)
  var BUCKET = 500;           // 찾기 칸

  /* ── 고정 지형 표 ─────────────────────────────────────────
   * 좌표는 m(+x 동쪽·+y 남쪽 — biome.js 방위와 같다: 0 청풍(동)·90 대숲(남)·180 성터(서)·270 솔숲(북)).
   * 강 w = 반폭(m) — 칸(48m) 가운데가 강줄기에서 34m 까지 벗어나도 끊기지 않게 판정은 최소 35 */
  var RIVERS = [
    { key: 'eunha', name: '은하강', hanja: '銀河江', emoji: '🌊', w: 30, wEnd: 52, meander: 170,
      desc: '설산 눈물이 모여 고향 동쪽을 지나 갯벌로 흘러간다',
      pts: [[700, -7800], [900, -5200], [1600, -2800], [1900, -900], [1850, 800], [2300, 2200], [3300, 3400], [5200, 5100], [7300, 7400], [9600, 9700]] },
    { key: 'jeok', name: '붉은내', hanja: '赤川', emoji: '🔥', w: 30, wEnd: 34, meander: 140,
      desc: '용의 협곡 불비를 삼킨 붉은 물 — 가마골을 지나 서쪽으로 꺾인다',
      pts: [[600, 8800], [200, 6600], [-900, 4800], [-2200, 3600], [-3300, 2500], [-4200, 1700], [-4650, 1050]] },
    { key: 'dalbit', name: '달빛내', hanja: '月川', emoji: '🌙', w: 32, wEnd: 40, meander: 120,
      desc: '성터 언덕 밑에서 붉은내를 받아 달그림자 호수로 든다',
      pts: [[-4650, 1050], [-4300, -400], [-3900, -1700], [-3450, -2750]] }
  ];
  var LAKES = [
    { key: 'dalho', name: '달그림자 호수', hanja: '月影湖', emoji: '🌙', x: -3350, y: -3250, r: 460 }
  ];
  /* 산맥 — pts 는 [x, y, 능선 높이 m, 정상 이름?]. hw = 반폭(m) */
  var RANGES = [
    { key: 'seolsan', name: '설산맥', hanja: '雪山脈', emoji: '🏔️', hw: 560,
      pts: [[-3600, -8000, 60], [-1200, -9200, 125, '만년설 봉'], [1400, -8700, 100, '북풍 봉'], [3800, -7800, 65]] },
    { key: 'solryeong', name: '솔숲 고개', hanja: '松嶺', emoji: '🌲', hw: 300,
      pts: [[-2800, -4300, 40], [-1100, -3950, 70, '솔바람 봉'], [200, -3650, 38]] },
    { key: 'noeul', name: '붉은 벼랑', hanja: '赤壁', emoji: '🏺', hw: 300,
      pts: [[-1700, 4900, 34], [-3000, 4700, 64, '노을 봉'], [-4200, 4000, 36]] },
    { key: 'dragon', name: '용의 등줄기', hanja: '龍脊', emoji: '🐉', hw: 480,
      pts: [[1800, 7000, 55], [2600, 9000, 110, '화산 봉'], [1900, 11200, 70]] },
    { key: 'seongteo', name: '성터 능선', hanja: '城址稜', emoji: '🏯', hw: 300,
      pts: [[-5200, 1700, 34], [-5700, 0, 60, '봉화 봉'], [-5100, -1700, 36]] },
    { key: 'sagu', name: '서역 사구', hanja: '西域砂丘', emoji: '🐫', hw: 480,
      pts: [[-8800, -2200, 45], [-10000, 0, 90, '모래탑 봉'], [-9000, 2300, 50]] },
    { key: 'gureum', name: '구름 산', hanja: '雲山', emoji: '☁️', hw: 520,
      pts: [[-6100, -7400, 60], [-7300, -8300, 140, '구름 봉'], [-8600, -8700, 80]] }
  ];

  /* ── 잘게 쪼개기(굽이) — 한 번만 ─────────────────────────── */
  var SEGS = null, GRIDX = null, PEAKS = null, MARKS = null, FORDS = null;
  var DECK = 1.9;             // 다리 상판 높이(m) — 도형 다리 상판 윗면(1.7 + 0.25)과 같은 자리
  var FALLS = [{ river: 'eunha', name: '설산 폭포' }, { river: 'jeok', name: '용소 폭포' }];
  function wig(s, seed, amp) {
    /* 이 판 core.noise2 는 0~0.5 — *4-1 로 −1~1 */
    return (core().noise2(s / STEP, seed * 37 + 5, 14) * 4 - 1) * amp;
  }
  function densify(pts, seed, amp, hasH) {
    var out = [], s = 0, i;
    for (i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      var nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, n = Math.max(1, Math.round(L / STEP)), k;
      for (k = 0; k < n; k++) {
        var t = k / n, e = (i === 0 && k === 0) ? 0 : wig(s, seed, amp);
        out.push({ x: a[0] + (b[0] - a[0]) * t + nx * e, y: a[1] + (b[1] - a[1]) * t + ny * e,
          h: hasH ? a[2] + (b[2] - a[2]) * t : 0, s: s });
        s += L / n;
      }
    }
    var z = pts[pts.length - 1];
    out.push({ x: z[0], y: z[1], h: hasH ? z[2] : 0, s: s });
    return out;
  }
  function addSeg(seg, R) {
    var x0 = Math.floor((Math.min(seg.ax, seg.bx) - R) / BUCKET), x1 = Math.floor((Math.max(seg.ax, seg.bx) + R) / BUCKET);
    var y0 = Math.floor((Math.min(seg.ay, seg.by) - R) / BUCKET), y1 = Math.floor((Math.max(seg.ay, seg.by) + R) / BUCKET);
    for (var gy = y0; gy <= y1; gy++) {
      for (var gx = x0; gx <= x1; gx++) {
        var k = gx + ',' + gy;
        (GRIDX[k] || (GRIDX[k] = [])).push(seg);
      }
    }
  }
  function build() {
    if (SEGS) { return; }
    SEGS = []; GRIDX = {}; PEAKS = [];
    RIVERS.forEach(function (rv, ri) {
      var d = densify(rv.pts, 11 + ri, rv.meander, false), tot = d[d.length - 1].s, i;
      for (i = 0; i < d.length - 1; i++) {
        var u = d[i].s / tot, w = rv.w + (rv.wEnd - rv.w) * u;
        /* 여울 — 1.8km 마다 한 조각은 걸어서 건넌다(길이 끊기지 않게). 양 끝 400m 는 뺀다 */
        var ford = d[i].s > 400 && d[i].s < tot - 400 && Math.floor(d[i].s / 1800) !== Math.floor(d[i + 1].s / 1800);
        var sg = { type: 'river', f: rv, ax: d[i].x, ay: d[i].y, bx: d[i + 1].x, by: d[i + 1].y, w: w, ford: ford };
        SEGS.push(sg); addSeg(sg, w + 40);
      }
    });
    buildMarks();
    RANGES.forEach(function (rg, gi) {
      var d = densify(rg.pts, 41 + gi, rg.hw * 0.22, true), i;
      for (i = 0; i < d.length - 1; i++) {
        var sg = { type: 'ridge', f: rg, ax: d[i].x, ay: d[i].y, bx: d[i + 1].x, by: d[i + 1].y, ha: d[i].h, hb: d[i + 1].h, w: rg.hw };
        SEGS.push(sg); addSeg(sg, rg.hw + 10);
      }
      rg.pts.forEach(function (p) {
        if (p[3]) { PEAKS.push({ key: rg.key + '_' + Math.round(p[0]) + '_' + Math.round(p[1]), name: p[3], range: rg, x: p[0], y: p[1], h: p[2] }); }
      });
    });
  }

  /**
   * 다리·폭포 자리 — 여울 조각이 이어진 무리마다 **가운데 조각**에 다리 하나(강을 가로지르는 방향),
   * 강 첫 조각에 폭포(물이 흘러가는 쪽을 본다). 격자 칸 → 표식. 판정은 riverAt 의 ford 그대로다
   */
  function buildMarks() {
    MARKS = {}; FORDS = [];
    var byRiver = {};
    SEGS.forEach(function (sg) { if (sg.type === 'river') { (byRiver[sg.f.key] || (byRiver[sg.f.key] = [])).push(sg); } });
    Object.keys(byRiver).forEach(function (key) {
      var list = byRiver[key], i = 0;
      while (i < list.length) {
        if (!list[i].ford) { i++; continue; }
        var j = i;
        while (j + 1 < list.length && list[j + 1].ford) { j++; }
        var sg = list[Math.floor((i + j) / 2)];
        var cx = (sg.ax + sg.bx) / 2, cy = (sg.ay + sg.by) / 2, L = Math.hypot(sg.bx - sg.ax, sg.by - sg.ay) || 1;
        var fx = (sg.bx - sg.ax) / L, fy = (sg.by - sg.ay) / L;     // 물 흐르는 쪽
        var ford = { x: cx, y: cy, fx: fx, fy: fy, tx: -fy, ty: fx, span: sg.w * 2 + 16, river: key };
        FORDS.push(ford);
        putMark(cx, cy, { t: 'bridge', rot: Math.atan2(ford.tx, ford.ty), span: ford.span });
        i = j + 1;
      }
    });
    FALLS.forEach(function (fl) {
      var list = byRiver[fl.river];
      if (!list || !list.length) { return; }
      var sg = list[0], L = Math.hypot(sg.bx - sg.ax, sg.by - sg.ay) || 1;
      putMark(sg.ax, sg.ay, { t: 'waterfall', rot: Math.atan2((sg.bx - sg.ax) / L, (sg.by - sg.ay) / L), name: fl.name });
    });
  }
  function putMark(x, y, mk) {
    var gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
    mk.ox = x - (gx + 0.5) * CELL; mk.oz = y - (gy + 0.5) * CELL;   // 칸 가운데에서 얼마나 비켜 섰나
    MARKS[gx + ',' + gy] = mk;
  }
  /** 이 칸에 설 다리·폭포 — { t, rot, ox, oz, span? } 또는 null(`world3d.propPlan` 이 묻는다) */
  function markAt(gx, gy) {
    if (!on()) { return null; }
    build();
    return MARKS[gx + ',' + gy] || null;
  }
  /** 다리 상판 위면 그 높이(m), 아니면 null — 내 몸을 상판에 세운다(화면 층) */
  function deckAt(x, y) {
    if (!on()) { return null; }
    build();
    for (var i = 0; i < FORDS.length; i++) {
      var f = FORDS[i], dx = x - f.x, dy = y - f.y;
      if (Math.abs(dx * f.tx + dy * f.ty) <= f.span / 2 && Math.abs(dx * f.fx + dy * f.fy) <= 3.5) { return DECK; }
    }
    return null;
  }

  /** 점 → 선분 거리와 선분 위 비율 */
  function segDist(sg, x, y) {
    var dx = sg.bx - sg.ax, dy = sg.by - sg.ay, L2 = dx * dx + dy * dy || 1;
    var t = ((x - sg.ax) * dx + (y - sg.ay) * dy) / L2;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return { d: Math.hypot(x - sg.ax - dx * t, y - sg.ay - dy * t), t: t };
  }
  function near(x, y) {
    build();
    return GRIDX[Math.floor(x / BUCKET) + ',' + Math.floor(y / BUCKET)] || null;
  }

  /** 이 자리의 강(반폭 안이면) — { f, d, w, ford } 또는 null. 호수도 여기서 답한다 */
  function riverAt(x, y) {
    if (!on()) { return null; }
    var list = near(x, y), best = null, i;
    if (list) {
      for (i = 0; i < list.length; i++) {
        var sg = list[i];
        if (sg.type !== 'river') { continue; }
        var q = segDist(sg, x, y);
        if (q.d <= Math.max(sg.w, 35) && (!best || q.d < best.d)) { best = { f: sg.f, d: q.d, w: sg.w, ford: sg.ford }; }
      }
    }
    if (best) { return best; }
    for (i = 0; i < LAKES.length; i++) {
      var L = LAKES[i], a = Math.atan2(y - L.y, x - L.x);
      var rr = L.r * (0.86 + core().noise2(a * 3 + 50, 7, 1) * 0.56);   // 물가가 둥글지 않게
      if (Math.hypot(x - L.x, y - L.y) <= rr) { return { f: L, d: 0, w: rr, lake: true, ford: false }; }
    }
    return null;
  }

  function smooth(t) { return t * t * (3 - 2 * t); }

  /** 이 자리의 능선 — { f, t(0 발치 ~ 1 등성), h(m) } 또는 null. 겹치면 높은 쪽 */
  function ridgeAt(x, y) {
    if (!on()) { return null; }
    var list = near(x, y), best = null, i;
    if (!list) { return null; }
    for (i = 0; i < list.length; i++) {
      var sg = list[i];
      if (sg.type !== 'ridge') { continue; }
      var q = segDist(sg, x, y);
      if (q.d >= sg.w) { continue; }
      var t = 1 - q.d / sg.w, H = sg.ha + (sg.hb - sg.ha) * q.t, h = H * smooth(t);
      if (!best || h > best.h) { best = { f: sg.f, t: t, h: h }; }
    }
    return best;
  }

  var kindCache = {}, kindCount = 0;
  /** 격자 한 칸의 땅(`world.terrainAt` 가 묻는다) — 'water'(여울 포함) | 'mount' | null(노이즈가 답한다) */
  function kindAt(tx, ty) {
    if (!on()) { return null; }
    var k = tx + ',' + ty;
    if (kindCache.hasOwnProperty(k)) { return kindCache[k]; }
    var x = (tx + 0.5) * CELL, y = (ty + 0.5) * CELL, out = null;
    if (Math.hypot(x, y) >= HOME_R) {
      var rv = riverAt(x, y);
      if (rv) { out = 'water'; }                   // 여울도 물이다 — 가운데 다리가 건너고, 걸음은 ford 로 얕은 물을 걷는다
      else {
        var rg = ridgeAt(x, y);
        if (rg && rg.t > 0.28) { out = 'mount'; }
      }
    }
    if (kindCount > 40000) { kindCache = {}; kindCount = 0; }
    kindCache[k] = out; kindCount++;
    return out;
  }

  /** 기복에 얹을 능선 높이(m) — `relief3d.levelAt` 가 칸 가운데로 묻는다. 고향이면 0 */
  function liftAt(x, y) {
    if (!on() || Math.hypot(x, y) < HOME_R) { return 0; }
    var rg = ridgeAt(x, y);
    return rg ? rg.h : 0;
  }

  /** 정상 목록(가까운 순, R 안) */
  /** 진단용 — 굽이를 넣은 강·능선 줄기 점들(키로) */
  function line(key) {
    build();
    var out = [];
    SEGS.forEach(function (sg) { if (sg.f.key === key) { out.push({ x: sg.ax, y: sg.ay }); } });
    return out;
  }

  function peaks(x, y, R) {
    build();
    var out = [], i;
    for (i = 0; i < PEAKS.length; i++) {
      var p = PEAKS[i], d = Math.hypot(p.x - x, p.y - y);
      if (R === undefined || d <= R) { out.push({ key: p.key, name: p.name, range: p.range.name, emoji: p.range.emoji, x: p.x, y: p.y, h: p.h, dist: d }); }
    }
    out.sort(function (a, b) { return a.dist - b.dist; });
    return out;
  }

  /* ── 정상 발견 ─────────────────────────────────────────── */
  var PEAK_R = 30;
  function peakSave() {
    var s = core().save;
    if (!s.peaks || typeof s.peaks !== 'object') { s.peaks = {}; }
    return s.peaks;
  }
  function peakFound(key) { return !!peakSave()[key]; }
  function discoverPeak(p) {
    if (!p || peakFound(p.key)) { return false; }
    var c = core();
    peakSave()[p.key] = Date.now();
    var gold = 80 + Math.round(p.h);
    c.save.player.gold = (c.save.player.gold || 0) + gold;
    c.save.dust = (c.save.dust || 0) + 2;
    if (c.gainExp) { c.gainExp(50); }
    c.log('⛰️ 정상 — ' + p.name + ' (' + Math.round(p.h) + 'm · 금 +' + gold + ')', 'discover');
    if (global.DG.ui && global.DG.ui.toast) { global.DG.ui.toast('⛰️ ' + p.name + ' 정상! ' + Math.round(p.h) + 'm — 멀리까지 보인다'); }
    if (global.DG.audio) { try { global.DG.audio.play('discover'); } catch (e) { /* 소리는 없어도 된다 */ } }
    c.emit('peak:found', { key: p.key, name: p.name });
    c.persist();
    return true;
  }

  /* ── 몸: 기력·오르기·헤엄·점프 (키보드 모드만) ──────────────── */
  function STA_MAX() {
    var TR = global.DG.treasure;                                   // §5 ⑲-3 탑 봉헌 — 등급마다 +8
    return K('sta', 100) + (TR && TR.staBonus ? TR.staBonus() : 0);
  }
  var CLIMB_G = 0.28;         // 이보다 가파른 오르막이 '오르기'(안쪽 산 허리 ≈0.33, 바깥 산 ≈0.43)
  var CLIMB_MUL = 0.5, SWIM_MUL = 0.6, TIRED_SWIM = 0.3, SLIDE_MUL = 1.2;
  var CLIMB_DRAIN = 12, SWIM_DRAIN = 6, REGEN = 25;
  var JUMP_T = 0.55, JUMP_H = 1.3, LEAP = 4, LEAP_COST = 20;
  /* 활공 — 125m 봉우리에서 기력 100 이면 25초(≈60m 내려옴) 날고, 그 뒤 초당 9m 로 떨어진다 */
  var GLIDE_MUL = 1.7, GLIDE_SINK = 2.4, GLIDE_TIRED_SINK = 9, GLIDE_FALL = 14, GLIDE_DRAIN = 4, GLIDE_OPEN_T = 0.12;
  /* §5 ⑲-2 낙하 공격 — 활공 중 발밑 2.5m 넘을 때 공격을 누르면 초당 30m 로 내리꽂는다(착지 판정은 field-combat) */
  var PLUNGE_MIN_H = 2.5, PLUNGE_SINK = 30;
  /** ⑲-6 요리 모험 계열(갯소라 구이) — 스태미나 소모 배율 */
  function SAVE_MUL() { var C = global.DG.cooking; return C && C.staminaMul ? C.staminaMul() : 1; }
  function freshBody() { return { sta: -1, state: 'walk', busy: false, climbT: 0, jumpT: -1, tired: false, ux: 0, uy: 0, glide: null, sky: false, draftBan: false, railT: 0, pole: null }; }
  /* ⑲-34 기둥 타기 — 오르기 초당 m · 기력(초당) 오르기·매달리기 · 미끄러짐 초당 m · 붙잡는 거리(다리 겉에서) · 마주 봄(내적) · 들보 위 걸음 */
  var POLE_UP = 2.2, POLE_DRAIN = 14, POLE_HANG = 3, POLE_SLIDE = 6, POLE_REACH = 1.2, POLE_FACE = 0.5, BEAM_MUL = 0.6;
  var body = freshBody();

  function sta() { if (body.sta < 0) { body.sta = STA_MAX(); } return body.sta; }
  function keyMode() { var W = global.DG.world; return !!(W && W.mode === 'keyboard'); }
  function reliefH(x, y) { var R = global.DG.relief3d; return R ? R.heightAt(x, y) : 0; }
  /** §5 ⑲-20 구름섬 — 층이 있을 때만(키보드 판) */
  function SKY() { var s = global.DG.skyIsle; return s && s.layerOn && s.layerOn() ? s : null; }
  var RAIL_LOOK = 0.8;        // 난간 — 이만큼 앞이 섬 밖이면 걸어서는 못 나간다
  /** 내 발밑 높이 — 발판(섬·관측대) 위에 서 있으면 그 윗면, 아니면 화면 기복 */
  function groundH(x, y) { var S = SKY(), pd = body.sky && S ? S.padAt(x, y) : null; return pd ? pd.top : reliefH(x, y); }

  /**
   * 걸음 배수 — `world.moveByKeys` 가 한 걸음마다 묻는다(ux·uy = 걷는 방향 단위벡터).
   * 오르막 기울기는 화면 기복(`relief3d`)으로 잰다 — 보이는 산과 오르는 산이 같아야 해서.
   * 능선 밖(노이즈 언덕·고향)에선 늘 1 — 옛 걸음 그대로
   */
  function moveMul(x, y, ux, uy, dt) {
    if (!on() || !keyMode()) { return 1; }
    sta();
    /* §5 ⑲-22 활 조준 중엔 걷지 않고 방향 키가 겨눈 쪽을 돌린다 */
    var FCa = global.DG.fieldCombat;
    if (FCa && FCa.aiming && FCa.aiming()) { FCa.aimSteerRt(ux, uy, dt); body.state = 'walk'; return 0; }
    body.ux = ux; body.uy = uy;
    var SK = SKY(), air = body.jumpT >= 0;
    /* ⑲-34 기둥 — 붙잡은 동안은 여기서 끝난다. 땅에서 다리를 마주 보고 밀면 붙잡는다 */
    if (body.pole) { return poleMove(x, y, ux, uy, dt); }
    if (!air && !body.glide && !body.sky) {
      var pa = poleAhead(x, y, ux, uy);
      if (pa) {
        body.pole = { id: pa.id, h: 0, perch: false, push: 0 };
        tell(pa.grab || '🧗 기중기 다리를 붙잡았다 — 계속 밀면 오른다 · 점프 = 도약 · 등지면 손을 놓는다');
        core().emit('landform:pole', { id: pa.id, grab: true });
        return poleMove(x, y, ux, uy, dt);
      }
    }
    if (SK) {
      var nx = x + ux * RAIL_LOOK, ny = y + uy * RAIL_LOOK, pdN = SK.padAt(nx, ny);
      /* ⑲-20 섬(⑲-35 발판) 위 — 난간 밖으로는 뛰어올랐거나 날개를 편 채로만 */
      if (body.sky && !pdN && !air && !body.glide) {
        var pdH = SK.padAt(x, y);
        if (body.railT <= 0) { body.railT = 4; tell('🧱 ' + (pdH ? pdH.name : '구름섬') + ' 난간 — 뛰어넘으면(점프) 날개를 펴고 내려간다'); }
        return 0;
      }
      /* 발판 밖에서 윗면보다 낮게 날아 들면 발판 밑면에 막힌다 */
      if (!body.sky && body.glide && pdN && !SK.padAt(x, y) && body.glide.alt < pdN.top && body.glide.alt > pdN.top - pdN.slab) { return 0; }
    }
    if (body.glide) { body.state = 'glide'; return body.glide.fall ? 1 : GLIDE_MUL; }   // 날개를 편 동안은 강·비탈을 안 본다
    if (body.sky) { body.state = 'walk'; return air ? 1.15 : 1; }                          // ⑲-20 섬(⑲-35 관측대) 윗면은 평평하다
    var mul = 1;
    var rv = riverAt(x, y);
    if (rv && !rv.ford && !air) {
      body.state = 'swim'; body.busy = true;
      body.sta = Math.max(0, body.sta - SWIM_DRAIN * SAVE_MUL() * dt);
      return body.sta > 0 ? SWIM_MUL : TIRED_SWIM;
    }
    if (ridgeAt(x, y)) {
      var g = (reliefH(x + ux * 3, y + uy * 3) - reliefH(x, y)) / 3;
      if (g > CLIMB_G) {
        body.state = 'climb'; body.climbT = 0.35;
        /* 다하면 30% 찰 때까지 못 오른다 — 그동안은 숨을 고르며 찬다(busy 를 안 켠다). 안 그러면 오르막을
           계속 미는 자동 순행이 영영 못 움직인다 */
        if (body.sta <= 0 || body.tired) {
          if (!body.tired) { body.tired = true; tell('😮‍💨 기력이 다했다 — 잠깐 숨을 고르자'); }
          return 0;
        }
        body.busy = true;
        body.sta = Math.max(0, body.sta - CLIMB_DRAIN * (0.6 + g) * SAVE_MUL() * dt);
        return CLIMB_MUL;
      }
      if (g < -CLIMB_G) { mul = SLIDE_MUL; }       // 가파른 내리막은 미끄러지듯 빨리
    }
    body.state = 'walk';
    return air ? mul * 1.15 : mul;
  }

  /* ── ⑲-34 기둥 타기 ─────────────────────────────────── */
  function ES() { var e = global.DG.eraSites; return e && e.on && e.on() && e.poles ? e : null; }
  function SPP() { var s = global.DG.skyport; return s && s.on && s.on() && s.poles ? s : null; }
  function CRP() { var c = global.DG.crossing; return c && c.on && c.on() && c.poles ? c : null; }
  function SKP() { var k = global.DG.sunken; return k && k.on && k.on() && k.poles ? k : null; }
  function AMP() { var a = global.DG.amber; return a && a.on && a.on() && a.poles ? a : null; }   // ⑲-57 굳은 거리 부양탑 심
  function FKP() { var a = global.DG.fork; return a && a.on && a.on() && a.poles ? a : null; }   // ⑲-65 세갈래 고을 종루
  function VTP() { var a = global.DG.vault; return a && a.on && a.on() && a.poles ? a : null; }   // ⑲-61 갈무리 벌 기록 기둥
  /** ⑲-38 타는 기둥 모두 — 조선소 기중기 다리(era-sites) + 은하 나루 계류 탑(skyport) + ⑲-41 틈새 갈림길 시계탑·섬돌(crossing) + ⑲-44 옛 등대(sunken) */
  function polesAll() {
    var E = ES(), S = SPP(), X = CRP(), U = SKP(), A = AMP(), V = VTP(), Fk = FKP();
    return (E ? E.poles() : []).concat(S ? S.poles() : []).concat(X ? X.poles() : []).concat(U ? U.poles() : []).concat(A ? A.poles() : []).concat(V ? V.poles() : []).concat(Fk ? Fk.poles() : []);
  }
  function poleById(id) { var L = polesAll(); for (var i = 0; i < L.length; i++) { if (L[i].id === id) { return L[i]; } } return null; }
  /** (x,y) 가 기둥 꼭대기 걷는 길 위인가 — 길 선분에서 폭 절반 안(era-sites.onBeam 과 같은 셈) */
  function onBeamOf(p, x, y) {
    var b = p && p.beam;
    if (!b) { return false; }
    var vx = b.bx - b.ax, vy = b.by - b.ay, L2 = vx * vx + vy * vy || 1, t = ((x - b.ax) * vx + (y - b.ay) * vy) / L2;
    if (t < 0 || t > 1) { return false; }
    return Math.hypot(x - (b.ax + vx * t), y - (b.ay + vy * t)) <= b.w / 2;
  }
  /** 붙잡은 기둥에서 떨어진 거리가 말이 안 되나 — 들보 위면 들보 선에서 3m, 오르는 중이면 기둥 겉에서 POLE_REACH + 2m 넘게 */
  function poleFar(pl, P, x, y) {
    var b = pl.beam;
    if (P.perch && b) {
      var vx = b.bx - b.ax, vy = b.by - b.ay, L2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((x - b.ax) * vx + (y - b.ay) * vy) / L2));
      return Math.hypot(x - (b.ax + vx * t), y - (b.ay + vy * t)) > b.w / 2 + 3;
    }
    return Math.hypot(pl.x - x, pl.y - y) > pl.r + POLE_REACH + 2;
  }
  function perchOfP(p) { var E = ES(); return p.perch || (E ? E.perchOf(p) : { x: p.x, y: p.y }); }
  function autoOn() { var A = global.DG.auto; return !!(A && A.active && A.active()); }
  /** 🤖 자동 이야기가 지금 그 기둥을 오르려는가 — climb(pole: true·id)·light(perch: id) 단계(2026-09-28, ⑲-47 — 자동 중엔 기둥을 아예 안 붙잡아
   *  기중기·계류 탑·시계탑·등대 오르기가 자동으로 안 풀렸다) */
  function autoWants(id) {
    var ST = global.DG.story, st = ST && ST.step ? ST.step() : null;
    if (!st) { return false; }
    if (st.type === 'climb' && st.pole) { return st.pole === true || st.pole === id; }
    return st.type === 'light' && st.perch === id;
  }
  /** 마주 보고 미는 다리 — 다리 겉에서 POLE_REACH m 안, 걷는 방향이 다리 쪽. 자동 순행 중엔 이야기가 그 기둥을 원할 때만 */
  function poleAhead(x, y, ux, uy) {
    var L = polesAll(), auto = autoOn();
    if (!L.length || (!ux && !uy)) { return null; }
    for (var i = 0; i < L.length; i++) {
      var p = L[i], dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
      if (auto && !autoWants(p.id)) { continue; }
      if (d > p.r + POLE_REACH) { continue; }
      if (d > 1e-6 && (dx * ux + dy * uy) / d < POLE_FACE) { continue; }
      return p;
    }
    return null;
  }
  function poleOf() { return body.pole ? poleById(body.pole.id) : null; }
  /** 손을 놓는다 — 높이가 있으면 그 높이에서 떨어진다(날개 접은 채) */
  function letGo() {
    var P = body.pole, pos = core().save.player.pos;
    body.pole = null;
    if (P && P.h > 0.3) { body.glide = { alt: groundH(pos.x, pos.y) + P.h, fall: true }; body.state = 'glide'; }
    core().emit('landform:pole', { id: P ? P.id : null, grab: false });
  }
  function perchOn(pl) {
    var P = body.pole, pos = core().save.player.pos, q = perchOfP(pl);
    P.h = pl.top; P.perch = true;
    pos.x = q.x; pos.y = q.y;
    body.tired = false;
    tell(pl.perchText || '🏗️ 들보 위에 올라섰다 — 들보를 따라 걸을 수 있다 · 뛰면 날개를 편다');
    core().emit('landform:perch', { id: pl.id });
  }
  function poleMove(x, y, ux, uy, dt) {
    var P = body.pole, pl = poleOf();
    if (!pl) { body.pole = null; return 1; }
    /* 기둥에서 멀리 떨어졌다(지도 순간이동·이야기 이동) — 손을 놓는다. 전엔 기둥 상태가 남아 새 자리에서 한 걸음도 못 걸었다(2026-09-28) */
    if (poleFar(pl, P, x, y)) { body.pole = null; body.state = 'walk'; core().emit('landform:pole', { id: pl.id, grab: false }); return 1; }
    if (P.perch) {
      body.state = 'walk';
      if (!onBeamOf(pl, x + ux * RAIL_LOOK, y + uy * RAIL_LOOK)) {
        if (body.railT <= 0) { body.railT = 4; tell(pl.edgeText || '🏗️ 들보 끝 — 뛰어내리면(점프) 날개를 편다'); }
        return 0;
      }
      return BEAM_MUL;
    }
    var dx = pl.x - x, dy = pl.y - y, d = Math.hypot(dx, dy) || 1, face = (dx * ux + dy * uy) / d;
    if (face < -POLE_FACE) { letGo(); return 0; }              // 등지면 놓는다
    if (face < POLE_FACE) { return 0; }                         // 옆으로 밀면 그대로 매달려 있다
    body.state = 'climb'; body.climbT = 0.35; body.busy = true;
    if (body.sta <= 0 || body.tired) {
      if (!body.tired) { body.tired = true; tell('😮‍💨 기력이 다했다 — 미끄러진다'); }
      return 0;
    }
    P.push = 0.2;
    P.h = Math.min(pl.top, P.h + POLE_UP * dt);
    body.sta = Math.max(0, body.sta - POLE_DRAIN * (pl.drain || 1) * SAVE_MUL() * dt);   // ⑲-38 기둥마다 소모 배율(계류 탑 0.75)
    if (P.h >= pl.top) { perchOn(pl); }
    return 0;
  }
  /** 매 박자 — 안 밀면 매달려 기력이 조금씩, 다하면 미끄러져 내려온다(땅에 닿으면 놓는다) */
  function stepPole(dt) {
    var P = body.pole;
    if (!P || P.perch) { return; }
    body.busy = true;
    if (P.push > 0) { P.push -= dt; } else if (!body.tired) { body.sta = Math.max(0, body.sta - POLE_HANG * SAVE_MUL() * dt); body.state = 'climb'; }
    if (body.sta <= 0 && !body.tired) { body.tired = true; tell('😮‍💨 기력이 다했다 — 미끄러진다'); }
    if (body.tired) {
      P.h = Math.max(0, P.h - POLE_SLIDE * dt);
      if (P.h <= 0) { body.pole = null; body.state = 'walk'; core().emit('landform:pole', { id: P.id, grab: false }); }
    }
  }

  /** ⑲-43 솟구치기(별배 견인줄) — 땅 위(섬·기둥 아님)에서 h m 위로 날개를 편 채 띄운다. 키보드 판만. 되면 true */
  function launch(h) {
    if (!on() || !keyMode() || body.pole || body.sky) { return false; }
    var pos = core().save.player.pos;
    body.glide = { alt: groundH(pos.x, pos.y) + Math.max(airH(), h || 0), fall: false };
    body.jumpT = -1; body.state = 'glide';
    core().emit('landform:glide', { open: true, launch: true });
    return true;
  }
  function tell(msg) {
    if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); }
  }

  /**
   * 점프 — 스페이스·점프 단추. 오르는 중(0.35초 안에 오르막을 밟았다)이면 기력 20 으로
   * 오르막 쪽 4m 도약, 아니면 제자리에서 1.3m(화면 층 — 판정 좌표는 그대로). 되면 true
   */
  function jump() {
    if (!on() || !keyMode()) { return false; }
    var W = global.DG.world;
    if (W && W.inputBlocked && W.inputBlocked()) { return false; }
    var MTj = global.DG.mount;                                       // ⑲-61 탄 채로 점프 = 말에서 뛰어내린다(그 자리에서 내리기만)
    if (MTj && MTj.active && MTj.active()) {
      if (MTj.isFly && MTj.isFly(MTj.current())) { return true; }              // ⑲-62 나는 탈것 — Space 는 오르기(mount.js 가 누르는 동안 본다)
      MTj.dismount('말에서 뛰어내렸다'); return true;
    }
    sta();
    var pos = core().save.player.pos;
    var FCj = global.DG.fieldCombat;
    if (FCj && FCj.aimCancel) { FCj.aimCancel(); }                  // ⑲-22 뛰면 조준이 풀린다
    /* ⑲-34 기둥 — 들보 위면 뛰어내리며 날개를 편다, 오르는 중이면 도약 */
    if (body.pole) {
      var Pj = body.pole, plj = poleOf();
      if (Pj.perch || !plj) {
        if (body.sta <= 0) { tell('😮‍💨 날개를 펼 기력이 없다'); return false; }
        body.pole = null;
        body.glide = { alt: groundH(pos.x, pos.y) + (plj ? plj.top : 0), fall: false };
        body.state = 'glide';
        core().emit('landform:glide', { open: true });
        return true;
      }
      if (body.tired || body.sta < LEAP_COST * SAVE_MUL()) { tell('😮‍💨 도약할 기력이 없다'); return false; }
      body.sta -= LEAP_COST * SAVE_MUL();
      Pj.h = Math.min(plj.top, Pj.h + LEAP);
      core().emit('landform:leap', {});
      if (Pj.h >= plj.top) { perchOn(plj); }
      return true;
    }
    /* 활공 중에 누르면 날개를 접고 떨어진다 */
    if (body.glide) {
      if (body.glide.fall) { return false; }
      body.glide.fall = true;
      if (body.glide.draft) { body.draftBan = true; }             // ⑲-20 기둥 안에서 접으면 나갈 때까지 안 편다
      core().emit('landform:glide', { open: false });
      return true;
    }
    /* 뛰어오른 채(0.12초 뒤) 다시 누르면 날개를 편다 — 기력이 조금이라도 있어야 한다 */
    if (body.jumpT >= 0) {
      if (body.jumpT < GLIDE_OPEN_T || body.sta <= 0) { return false; }
      body.glide = { alt: groundH(pos.x, pos.y) + airH(), fall: false };
      body.jumpT = -1;
      body.state = 'glide';
      core().emit('landform:glide', { open: true });
      return true;
    }
    if (body.climbT > 0 && (body.ux || body.uy)) {
      if (body.sta < LEAP_COST * SAVE_MUL()) { tell('😮‍💨 도약할 기력이 없다'); return false; }
      body.sta -= LEAP_COST * SAVE_MUL();
      pos.x += body.ux * LEAP; pos.y += body.uy * LEAP;
      core().emit('landform:leap', {});
    }
    body.jumpT = 0;
    core().emit('landform:jump', {});
    return true;
  }

  /** §5 ⑲-2 낙하 공격 시작 — 활공 중이고 발밑이 2.5m 넘으면 날개를 접고 내리꽂는다. 되면 true(이미 내리꽂는 중이면 false) */
  function startPlunge() {
    if (!on() || !keyMode() || !body.glide || body.glide.plunge !== undefined) { return false; }
    if (airH() < PLUNGE_MIN_H) { return false; }
    body.glide.fall = true;
    body.glide.plunge = body.glide.alt;
    core().emit('landform:plunge', {});
    return true;
  }

  /** 지금 뛰어오른 높이(m) — `world3d` 가 내 몸에 얹는다 */
  function airH() {
    if (body.pole) { return body.pole.h; }                    // ⑲-34 기둥·들보 위
    if (body.glide) {
      var gp = core().save.player.pos;
      return Math.max(0, body.glide.alt - groundH(gp.x, gp.y));
    }
    if (body.jumpT < 0) { return 0; }
    var u = body.jumpT / JUMP_T;
    return 4 * JUMP_H * u * (1 - u);
  }

  var acc = 0;
  function tick(dt) {
    if (!on() || !core() || !core().save) { return; }
    sta();
    if (body.jumpT >= 0) { body.jumpT += dt; if (body.jumpT >= JUMP_T) { body.jumpT = -1; } }
    if (body.climbT > 0) { body.climbT -= dt; }
    if (body.railT > 0) { body.railT -= dt; }
    stepPole(dt);
    stepSky();
    if (body.glide) { stepGlide(dt); }
    if (!body.busy) {
      body.sta = Math.min(STA_MAX(), body.sta + REGEN * dt);
      if (body.sta >= STA_MAX() * 0.3) { body.tired = false; }
      if (body.state !== 'walk' && body.climbT <= 0) { body.state = 'walk'; }
    }
    body.busy = false;
    acc += dt;
    if (acc >= 0.25) {
      acc = 0;
      var pos = core().save.player.pos, list = peaks(pos.x, pos.y, PEAK_R);
      if (list.length) { discoverPeak(list[0]); }
    }
    if (!global.DG_NO_DRAW) { paint(); }
  }

  /**
   * ⑲-20 구름섬·바람 기둥 한 박자 — 난간을 뛰어넘어 섬 밖이면 날개를 편다(순간이동으로 멀리 갔으면 그냥 내린다).
   * 기둥 안 공중(뛰어올랐거나 발밑 DRAFT_MIN_AIR 넘게)이면 저절로 날개를 펴고 솟는다. 기둥을 나가면 다시 펼 수 있다
   */
  function stepSky() {
    var SK = SKY(), pos = core().save.player.pos;
    if (!SK) { body.sky = false; return; }
    if (body.sky && !SK.padAt(pos.x, pos.y)) {
      var np = SK.nearPad(pos.x, pos.y), near = !!np && np.d <= 6, up = (np ? np.pad.top : 0) + airH();
      body.sky = false;
      if (near && !body.glide) {
        body.glide = { alt: up, fall: false }; body.jumpT = -1; body.state = 'glide';
        core().emit('landform:glide', { open: true });
        tell('🪂 난간을 넘어 날개를 폈다');
      }
    }
    if (!SK.draftAt(pos.x, pos.y)) { body.draftBan = false; if (body.glide) { body.glide.draft = false; } return; }
    if (!body.glide && !body.draftBan && (body.jumpT >= 0 || airH() >= SK.DRAFT_MIN_AIR)) {
      body.glide = { alt: groundH(pos.x, pos.y) + airH(), fall: false }; body.jumpT = -1; body.state = 'glide';
      core().emit('landform:glide', { open: true, draft: true });
    }
    if (body.glide) { body.glide.draft = !body.glide.fall && body.glide.plunge === undefined; }
  }

  /** 활공 한 걸음 — 가라앉고 기력을 쓰다가, 땅(화면 기복)에 닿으면 내린다. 강 위에 내리면 그대로 헤엄.
   *  ⑲-20 바람 기둥 안이면 기력을 안 쓰고 솟는다(기둥 끝에서 멎는다) · 위에서 섬 윗면에 닿으면 섬에 선다 */
  function stepGlide(dt) {
    var g = body.glide, pos = core().save.player.pos, SK = SKY();
    var dr = g.draft && SK ? SK.draftAt(pos.x, pos.y) : null;
    if (dr) {
      g.alt = Math.min(dr.top, g.alt + dr.rise * dt);
      body.busy = true; body.state = 'glide';
      return;
    }
    var sink = g.plunge !== undefined ? PLUNGE_SINK : (g.fall ? GLIDE_FALL : (body.sta > 0 ? GLIDE_SINK : GLIDE_TIRED_SINK));
    var was = g.alt;
    g.alt -= sink * dt;
    if (!g.fall) { body.sta = Math.max(0, body.sta - GLIDE_DRAIN * SAVE_MUL() * dt); body.busy = true; }
    body.state = 'glide';
    var pd = SK ? SK.padAt(pos.x, pos.y) : null, onIsle = !!(pd && was >= pd.top - 0.02);
    var ground = onIsle ? pd.top : groundH(pos.x, pos.y);
    if (g.alt <= ground + 0.02) {
      body.glide = null;
      body.state = 'walk';
      if (onIsle) { body.sky = true; }
      var fell = g.plunge !== undefined ? Math.max(0, g.plunge - ground) : null;
      core().emit('landform:land', { x: pos.x, y: pos.y, plunge: fell });
      var FC = global.DG.fieldCombat;
      if (fell !== null && FC && FC.plungeLand) { FC.plungeLand(fell); }
    }
  }

  /** 순간이동 — 오른 정상으로(키보드 모드만, biome.teleport 와 같은 규칙). 되면 true */
  function teleport(key) {
    var W = global.DG.world;
    if (!on() || !W || W.mode !== 'keyboard' || !peakFound(key)) { return false; }
    build();
    var p = null, i;
    for (i = 0; i < PEAKS.length; i++) { if (PEAKS[i].key === key) { p = PEAKS[i]; } }
    if (!p) { return false; }
    var pos = core().save.player.pos;
    pos.x = p.x; pos.y = p.y + 6;
    body.glide = null; body.jumpT = -1; body.sky = false;
    if (W.walkTo) { W.walkTo(pos.x, pos.y); }
    core().log('🌀 순간이동 — ' + p.name + ' 정상', 'move');
    core().emit('region:teleport', { key: 'pk:' + key });
    return true;
  }

  /** 순간이동 지점으로 쓸 오른 정상들 — { key:'pk:…', x, y, name } */
  function waypoints() {
    return peaks(0, 0).filter(function (p) { return peakFound(p.key); }).map(function (p) {
      return { key: 'pk:' + p.key, x: p.x, y: p.y, name: '⛰️ ' + p.name };
    });
  }

  /* ── 화면: 기력 고리·점프 단추 ────────────────────────────── */
  var staEl = null, jumpEl = null, bound = false;
  function bind() {
    if (bound || !global.addEventListener) { return; }
    bound = true;
    /* 스페이스 — 들판 전투가 회피로 먼저 먹었으면(preventDefault) 뛰지 않는다. 그쪽 듣개가 먼저 붙는다(init 순서) */
    global.addEventListener('keydown', function (e) {
      if (e.key !== ' ' || e.repeat || e.defaultPrevented) { return; }
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') { return; }
      if (jump()) { e.preventDefault(); }
    });
  }
  function paint() {
    if (!global.document || !document.body) { return; }
    bind();
    if (!staEl) {
      staEl = document.createElement('div');
      staEl.id = 'lf-sta';
      staEl.innerHTML = '<i></i><span></span>';
      document.body.appendChild(staEl);
      jumpEl = document.createElement('button');
      jumpEl.id = 'lf-jump';
      jumpEl.type = 'button';
      jumpEl.setAttribute('aria-label', '점프');
      jumpEl.innerHTML = '<span>⤒</span><em>점프</em>';
      jumpEl.addEventListener('pointerdown', function (e) { e.preventDefault(); jump(); });
      document.body.appendChild(jumpEl);
    }
    var km = keyMode(), full = body.sta >= STA_MAX() - 0.01;
    staEl.classList.toggle('show', km && !full);
    staEl.classList.toggle('low', body.sta < STA_MAX() * 0.25);
    if (km && !full) {
      staEl.style.setProperty('--p', Math.round(100 * body.sta / STA_MAX()));
      staEl.querySelector('span').textContent = body.state === 'climb' ? '🧗' : (body.state === 'swim' ? '🏊' : (body.glide ? '🪂' : ''));
    }
    /* 뛰어오른 동안·활공 중엔 단추가 제 다음 할 일을 말한다 */
    var lab = body.glide ? (body.glide.fall ? '낙하' : '접기') : (body.jumpT >= GLIDE_OPEN_T ? '활공' : '점프');
    if (jumpEl.getAttribute('data-l') !== lab) {
      jumpEl.setAttribute('data-l', lab);
      jumpEl.innerHTML = '<span>' + ({ 점프: '⤒', 활공: '🪂', 접기: '⤓', 낙하: '💨' })[lab] + '</span><em>' + lab + '</em>';
    }
    var touch = !!(('ontouchstart' in global) || (global.navigator && navigator.maxTouchPoints > 0));
    jumpEl.classList.toggle('show', km && touch && !document.body.classList.contains('fc-on'));
  }

  global.DG = global.DG || {};
  global.DG.landform = {
    RIVERS: RIVERS, LAKES: LAKES, RANGES: RANGES, HOME_R: HOME_R, CELL: CELL,
    CLIMB_G: CLIMB_G, CLIMB_MUL: CLIMB_MUL, SWIM_MUL: SWIM_MUL, LEAP: LEAP, LEAP_COST: LEAP_COST, JUMP_T: JUMP_T, JUMP_H: JUMP_H,
    on: on, line: line, riverAt: riverAt, markAt: markAt, deckAt: deckAt, fords: function () { build(); return FORDS.slice(); }, DECK: DECK, ridgeAt: ridgeAt, kindAt: kindAt, liftAt: liftAt, peaks: peaks,
    peakFound: peakFound, discoverPeak: discoverPeak,
    moveMul: moveMul, jump: jump, airH: airH, tick: tick, teleport: teleport, waypoints: waypoints,
    startPlunge: startPlunge, PLUNGE_MIN_H: PLUNGE_MIN_H, PLUNGE_SINK: PLUNGE_SINK,
    GLIDE_MUL: GLIDE_MUL, GLIDE_SINK: GLIDE_SINK, GLIDE_DRAIN: GLIDE_DRAIN, GLIDE_OPEN_T: GLIDE_OPEN_T,
    gliding: function () { return !!body.glide; },
    /** ⑲-34 기둥을 붙잡았나(들보 위 포함) · 들보 위면 그 다리 id · 기둥 높이 */
    onPole: function () { return !!body.pole; }, perched: function () { return body.pole && body.pole.perch ? body.pole.id : null; },
    poleH: function () { return body.pole ? body.pole.h : 0; }, poleAhead: poleAhead, polesAll: polesAll, poleById: poleById,
    POLE_UP: POLE_UP, POLE_DRAIN: POLE_DRAIN, POLE_HANG: POLE_HANG, POLE_SLIDE: POLE_SLIDE, POLE_REACH: POLE_REACH, BEAM_MUL: BEAM_MUL,
    /** ⑲-20 섬 위에 서 있나(날개를 편 채 섬 위도) · 불러오기에서 섬에 올린다(skyisle.boot) */
    onSky: function () { return !!body.sky; }, setSky: function (v) { body.sky = !!v; }, groundH: groundH, glideAlt: function () { return body.glide ? body.glide.alt : null; },
    launch: launch,
    stamina: function () { return sta(); }, state: function () { return body.state; },
    /** 진단 전용 — 몸 상태와 캐시를 비운다 */
    _resetForTest: function () {
      body = freshBody();
      kindCache = {}; kindCount = 0;
    }
  };
})(window);
