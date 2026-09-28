/**
 * 보물 상자 · 수집 구슬 · 탑 봉헌 · 기척 보기 — 오픈월드 RPG식 (PLAN §5 ⑲-3, 이름은 §5 ⑳)
 * ---------------------------------------------------------------
 *   자리     지역 칸(biome.js, 1.2km)마다 **고정** — 칸 좌표 해시라 세이브 없이 늘 같은 자리.
 *            상자 넷(나무 둘·무늬·옻칠) + 넷에 하나 꼴로 금박 · 구슬 셋(산마루·강물 위·나무 위, 없으면 들판)
 *   잠금     나무 없음 · 무늬 석등 둘(그 원소 스킬·폭발이 닿으면 켜짐, 첫 불 뒤 20초 안에 다) — 고향 밖 칸 절반은 무늬가
 *            **과녁 셋**(§5 ⑲-22 — 화살·서책·활 기본 공격이 맞히면 10초 금빛, 셋 다 빛나면 풀림) ·
 *            옻칠 무리 · 금박 정예 무리(들판 전투 무리, 키 `tc:<상자>`)
 *   봉헌     찾은 지역 탑 25m 안 — 구슬 둘마다 탑 등급 +1(최대 10) → 들판 기력 상한 +8·금 200·단사 2
 *   시야     V 누르는 동안 / 👁 단추 — 3D 화면 잿빛 + 45m 안 짚기 + 80m 안 가장 가까운 상자·구슬 흔적
 *
 * **자리·잠금·줍기 판정(`cellItems`·`pickable`·`trail`·`levelOf`)은 순수 함수**다. 세이브는
 * `save.chests`(연 시각)·`save.orbs`({got, given})만 쓴다. 손잡이 `treasure.on` 을 0 으로 두면 다 사라진다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('treasure.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function BM() { var b = global.DG.biome; return b && b.on && b.on() ? b : null; }
  function FC() { return global.DG.fieldCombat || null; }

  var GRADES = {
    common:    { key: 'common',    name: '나무', icon: '📦', exp: 5,  gold: 30,  dust: 0 },
    exquisite: { key: 'exquisite', name: '무늬', icon: '🎁', exp: 15, gold: 80,  dust: 1 },
    precious:  { key: 'precious',  name: '옻칠', icon: '💠', exp: 30, gold: 200, dust: 3 },
    luxurious: { key: 'luxurious', name: '금박', icon: '👑', exp: 60, gold: 500, dust: 6 }
  };
  var LOCK_OF = { common: 'none', exquisite: 'lantern', precious: 'camp', luxurious: 'elite' };
  var EL7 = ['fire', 'water', 'elec', 'wind', 'ice', 'rock', 'grass'];
  function OPEN_R(gps) { return gps ? 12 : 3; }
  function ORB_R(gps) { return gps ? 8 : 1.6; }
  var LANTERN_N = 2, LANTERN_R = 5, LANTERN_T = 20;
  /* ⑲-22 과녁 잠금 — 상자에서 9·12·15m 셋(각 2.1 라디안씩), 맞힌 과녁은 TARGET_T 초 금빛, 판 둘레 TARGET_R */
  var TARGET_D = [9, 12, 15], TARGET_T = 10, TARGET_R = 0.75, TARGET_SHARE = 0.5;
  var OFFER_R = 25, LV_MAX = 10, STA_PER_LV = 8, ORBS_PER_LV = 2;
  var SIGHT_R = 45, TRAIL_R = 80, TRAIL_STEP = 2.2, TRAIL_MAX = 14;
  var TILE = 48;

  /* ── 해시(칸 좌표만으로) ─────────────────────────────── */
  function h3(a, b, s) {
    var h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /**
   * 칸 (i, j) 둘레에서 자리 하나 — 가운데(탑)에서 dMin~dMax 떨어진 곳. terr(tx,ty) 가 물·마을·길이면
   * 다른 각으로 여섯 번까지 다시 굴린다(여섯 번 다 막히면 마지막 자리 그대로 — 드물다). 탑 둘레 60m 는 비운다
   */
  function spot(c, salt, dMin, dMax, terr, want) {
    var x = c.x, y = c.y, k;
    for (k = 0; k < 7; k++) {
      var a = h3(c.i * 7 + k, c.j * 13 - k, salt) * Math.PI * 2;
      var d = dMin + (dMax - dMin) * h3(c.i - k, c.j + k * 3, salt + 1);
      x = c.x + Math.cos(a) * d; y = c.y + Math.sin(a) * d;
      if (!terr) { break; }
      var t = terr(Math.floor(x / TILE), Math.floor(y / TILE));
      if (want ? want(t, x, y) : (t !== 'water' && t !== 'town' && t !== 'road')) { break; }
    }
    return { x: x, y: y };
  }

  /**
   * 한 칸의 상자·구슬 — 순수 함수(같은 칸은 늘 같은 답). terr·lf(landform) 를 주면 물을 비키고
   * 산마루·강·숲을 찾는다(진단은 안 줘도 된다 — 그땐 들판 자리)
   */
  function cellItems(i, j, terr, lf) {
    var B = BM(), c = B ? B.cellAt(i, j) : { key: i + '_' + j, i: i, j: j, x: i * 1200, y: j * 1200, biome: 'plain' };
    var home = c.biome === 'home';
    var grades = home ? ['common', 'common', 'exquisite'] : ['common', 'common', 'exquisite', 'precious'];
    if (!home && h3(i, j, 91) < 0.25) { grades.push('luxurious'); }
    var chests = [], orbs = [], n;
    for (n = 0; n < grades.length; n++) {
      var g = grades[n], p = spot(c, 100 + n * 17, home ? 90 : 120, home ? 300 : 480, terr);
      var ch = { id: 'c' + c.key + '_' + n, cell: c.key, grade: g, lock: LOCK_OF[g], x: p.x, y: p.y, lanterns: [] };
      if (g === 'exquisite' && !home && h3(i, j, 97) < TARGET_SHARE) {           // ⑲-22 과녁 잠금
        var ta = h3(i, j, 231 + n) * Math.PI * 2;
        ch.lock = 'target';
        ch.targets = TARGET_D.map(function (d, q) { var aa = ta + q * 2.1; return { x: ch.x + Math.cos(aa) * d, y: ch.y + Math.sin(aa) * d }; });
      }
      if (ch.lock === 'lantern') {
        var e0 = Math.floor(h3(i, j, 201 + n) * 7) % 7, e1 = (e0 + 1 + Math.floor(h3(i, j, 211 + n) * 6)) % 7;
        var a0 = h3(i, j, 221 + n) * Math.PI * 2;
        [e0, e1].forEach(function (e, q) {
          var aa = a0 + q * Math.PI;
          ch.lanterns.push({ x: ch.x + Math.cos(aa) * LANTERN_R, y: ch.y + Math.sin(aa) * LANTERN_R, el: EL7[e] });
        });
      }
      chests.push(ch);
    }
    /* 구슬 셋 — 산마루(정상 곁)·강물 위·나무 위. 제 자리가 없으면 들판(땅+1.8m, 점프로 닿는다) */
    var kinds = ['ridge', 'water', 'tree'];
    for (n = 0; n < 3; n++) {
      var kind = kinds[n], o = null;
      if (kind === 'ridge' && lf && lf.peaks) {
        var pk = lf.peaks(c.x, c.y, 700)[0];
        if (pk) {
          var pa = h3(i, j, 301) * Math.PI * 2;
          o = { x: pk.x + Math.cos(pa) * 12, y: pk.y + Math.sin(pa) * 12, h: 1.2 };
        }
      } else if (kind === 'water' && lf && lf.riverAt) {
        var wp = spot(c, 311, 80, 560, function (t, x, y) { return !!lf.riverAt(x, y); }, null);
        if (lf.riverAt(wp.x, wp.y)) { o = { x: wp.x, y: wp.y, h: 0.6 }; }
      } else if (kind === 'tree' && terr) {
        var tp = spot(c, 321, 80, 520, terr, function (t) { return t === 'forest'; });
        if (terr(Math.floor(tp.x / TILE), Math.floor(tp.y / TILE)) === 'forest') { o = { x: tp.x, y: tp.y, h: 2.4 }; }
      }
      if (!o) { var fp = spot(c, 331 + n * 7, 100, 520, terr); o = { x: fp.x, y: fp.y, h: 1.8 }; kind = 'field'; }
      orbs.push({ id: 'o' + c.key + '_' + n, cell: c.key, kind: kind, x: o.x, y: o.y, h: o.h });
    }
    return { cell: c, chests: chests, orbs: orbs };
  }

  var itemCache = {}, itemCount = 0;
  function itemsOf(i, j) {
    var k = i + '_' + j, it = itemCache[k];
    if (it) { return it; }
    var W = global.DG.world, L = global.DG.landform;
    var terr = W && W.terrainAt ? function (tx, ty) { try { return W.terrainAt(tx, ty); } catch (e) { return null; } } : null;
    it = cellItems(i, j, terr, L && L.on && L.on() ? L : null);
    if (itemCount > 400) { itemCache = {}; itemCount = 0; }
    itemCache[k] = it; itemCount++;
    return it;
  }

  /** 둘레 R 안의 상자·구슬 — 칸 아홉을 훑는다(R 은 칸보다 작다) */
  function near(px, py, R) {
    var B = BM(), out = { chests: [], orbs: [] };
    if (!B) { return out; }
    var S = B.SIZE, i0 = Math.floor((px + S / 2) / S), j0 = Math.floor((py + S / 2) / S), di, dj, n;
    for (dj = -1; dj <= 1; dj++) {
      for (di = -1; di <= 1; di++) {
        var it = itemsOf(i0 + di, j0 + dj);
        for (n = 0; n < it.chests.length; n++) { if (Math.hypot(it.chests[n].x - px, it.chests[n].y - py) <= R) { out.chests.push(it.chests[n]); } }
        for (n = 0; n < it.orbs.length; n++) { if (Math.hypot(it.orbs[n].x - px, it.orbs[n].y - py) <= R) { out.orbs.push(it.orbs[n]); } }
      }
    }
    return out;
  }

  /** 구슬을 줍나 — 순수 함수. 키보드는 1.6m 안 + 높이가 닿아야(1.5m 넘는 구슬은 발밑이 h−1.3 넘게), GPS 는 8m·높이 무시 */
  function pickable(o, px, py, air, gps) {
    var d = Math.hypot(o.x - px, o.y - py);
    if (d > ORB_R(gps)) { return false; }
    return gps || o.h <= 1.5 || (air || 0) >= o.h - 1.3;
  }

  /** 바친 구슬 수 → 탑 등급(최대 10) */
  function levelOf(given) { return Math.min(LV_MAX, Math.floor((given || 0) / ORBS_PER_LV)); }

  /** 기척 보기 흔적 — from 에서 to 쪽으로 2.2m 마다 점, 최대 14. 순수 함수 */
  function trail(fx, fy, tx, ty) {
    var d = Math.hypot(tx - fx, ty - fy), out = [], k;
    if (d < 1e-6) { return out; }
    var n = Math.min(TRAIL_MAX, Math.floor(d / TRAIL_STEP));
    for (k = 1; k <= n; k++) { out.push({ x: fx + (tx - fx) / d * TRAIL_STEP * k, y: fy + (ty - fy) / d * TRAIL_STEP * k }); }
    return out;
  }

  /* ══ 런타임 — 세이브·잠금·화면 ═══════════════════════════ */
  function sv() {
    var s = core().save;
    if (!s.chests || typeof s.chests !== 'object') { s.chests = {}; }
    if (!s.orbs || typeof s.orbs !== 'object') { s.orbs = { got: {}, given: 0 }; }
    if (!s.orbs.got) { s.orbs.got = {}; }
    if (typeof s.orbs.given !== 'number') { s.orbs.given = 0; }
    return s;
  }
  function opened(id) { return !!sv().chests[id]; }
  function held() { var o = sv().orbs; return Object.keys(o.got).length - o.given; }
  function level() { return levelOf(sv().orbs.given); }
  /** 들판 기력 상한에 더할 몫 — landform 이 묻는다 */
  function staBonus() { return core() && core().save && on() ? level() * STA_PER_LV : 0; }

  var unlocked = {};       // 상자id → 잠금이 풀렸다(이번 판)
  var lit = {};            // 상자id → { on: [bool,…], t0 } 석등 불
  var hinted = {};         // 상자id → 안내를 했다
  var shot = {};           // ⑲-22 상자id → [과녁마다 맞힌 시각|null]
  function gps() { var W = global.DG.world; return !!(W && W.mode === 'geo'); }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }

  function lockOpen(ch) { return ch.lock === 'none' || !!unlocked[ch.id]; }

  /** 상자를 연다 — 이미 열었으면 false. 보상·세이브·알림 */
  function open(ch) {
    var s = sv(), c = core();
    if (s.chests[ch.id]) { return false; }
    var G = GRADES[ch.grade];
    s.chests[ch.id] = Date.now();
    s.player.gold = (s.player.gold || 0) + G.gold;
    if (G.dust) { s.dust = (s.dust || 0) + G.dust; }
    if (c.gainExp) { c.gainExp(G.exp); }
    var TL = global.DG.talent, mt = TL ? TL.onChest(ch.grade) : '';   // ⑲-4 무예 책·인연 매듭
    var WPt = global.DG.weapon ? global.DG.weapon.onChest(ch) : '';     // ⑲-5 강화석·무기(옻칠 ★3·금박 ★4)
    var ARt = global.DG.artifact ? global.DG.artifact.onChest(ch.grade) : '';   // ⑲-5 보패
    mt = [mt, WPt, ARt].filter(Boolean).join(' · ');
    toast(G.icon + ' ' + G.name + ' 보물 상자 — 금 +' + G.gold + (G.dust ? ' · 단사 +' + G.dust : '') + ' · 경험 +' + G.exp + (mt ? ' · ' + mt : ''));
    c.log(G.icon + ' ' + G.name + ' 보물 상자를 열었다 — 금 +' + G.gold, 'discover');
    sfx('reward');
    c.emit('treasure:open', { id: ch.id, grade: ch.grade });
    c.persist();
    fx.burst.push({ x: ch.x, y: ch.y, t: 0 });
    return true;
  }

  /** 들판 전투가 원소 스킬·폭발·장판을 쓸 때마다(`field:element`) — 범위에 든 석등을 켠다 */
  /** 돌진·찌르기(x0,y0)는 지나간 선까지 — story.elemDist 와 같은 셈(2026-09-28) */
  function elemDist(e, x, y) { var ST = global.DG.story; return ST && ST.elemDist ? ST.elemDist(e, x, y) : Math.hypot(e.x - x, e.y - y); }
  function onElement(e) {
    if (!on() || !e || !e.el) { return; }
    var L = near(e.x, e.y, (e.r || 3) + LANTERN_R + 3 + (typeof e.x0 === 'number' ? Math.hypot(e.x - e.x0, e.y - e.y0) : 0)).chests, i, q, now = nowSec();
    for (i = 0; i < L.length; i++) {
      var ch = L[i];
      if (ch.lock !== 'lantern' || unlocked[ch.id] || opened(ch.id)) { continue; }
      var st = lit[ch.id] || { on: ch.lanterns.map(function () { return false; }), t0: null };
      var any = false;
      for (q = 0; q < ch.lanterns.length; q++) {
        var ln = ch.lanterns[q];
        if (!st.on[q] && ln.el === e.el && elemDist(e, ln.x, ln.y) <= (e.r || 3) + 1.5) { st.on[q] = true; any = true; }
      }
      if (!any) { continue; }
      lit[ch.id] = st;
      if (st.t0 === null) { st.t0 = now; }
      if (st.on.every(Boolean)) { unlocked[ch.id] = true; delete lit[ch.id]; toast('🏮 석등이 모두 켜졌다 — 상자가 풀렸다'); sfx('discover'); }
      else { toast('🏮 석등 하나 — ' + LANTERN_T + '초 안에 나머지도'); }
    }
  }
  /** ⑲-22 과녁이 선분 (x0,y0)-(x1,y1) 둘레 TARGET_R 안이면 켠다(점이면 x0=x1) — 켠 수. 셋이 다 빛나면 풀림 */
  function segD(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    return Math.hypot(px - ax - dx * t, py - ay - dy * t);
  }
  function shootSeg(x0, y0, x1, y1) {
    if (!on()) { return 0; }
    var L = near((x0 + x1) / 2, (y0 + y1) / 2, Math.hypot(x1 - x0, y1 - y0) / 2 + 20).chests, n = 0, now = nowSec(), i, q;
    for (i = 0; i < L.length; i++) {
      var ch = L[i];
      if (ch.lock !== 'target' || unlocked[ch.id] || opened(ch.id)) { continue; }
      var st = shot[ch.id] || ch.targets.map(function () { return null; }), got = 0;
      for (q = 0; q < ch.targets.length; q++) {
        if (segD(ch.targets[q].x, ch.targets[q].y, x0, y0, x1, y1) <= TARGET_R) { st[q] = now; got++; }
      }
      if (!got) { continue; }
      n += got; shot[ch.id] = st;
      var on3 = st.filter(function (t) { return t !== null && now - t <= TARGET_T; }).length;
      if (on3 >= ch.targets.length) { unlocked[ch.id] = true; delete shot[ch.id]; toast('🎯 과녁 셋이 모두 빛난다 — 상자가 풀렸다'); sfx('discover'); }
      else { toast('🎯 과녁 ' + on3 + '/' + ch.targets.length + ' — ' + TARGET_T + '초 동안 빛난다'); }
    }
    return n;
  }
  /** ⑲-22 조준에 잠길 것 — 둘레 R 안 안 켠 과녁·안 켠 석등 [{kind:'target'|'lantern', x, y, el?}] */
  function aimPoints(px, py, R) {
    if (!on()) { return []; }
    var L = near(px, py, R + 20).chests, out = [], now = nowSec(), i, q;
    for (i = 0; i < L.length; i++) {
      var ch = L[i];
      if (unlocked[ch.id] || opened(ch.id)) { continue; }
      if (ch.lock === 'target') {
        var st = shot[ch.id];
        for (q = 0; q < ch.targets.length; q++) {
          if (!(st && st[q] !== null && now - st[q] <= TARGET_T)) { out.push({ kind: 'target', x: ch.targets[q].x, y: ch.targets[q].y }); }
        }
      } else if (ch.lock === 'lantern') {
        var ls = lit[ch.id];
        for (q = 0; q < ch.lanterns.length; q++) { if (!(ls && ls.on[q])) { out.push({ kind: 'lantern', x: ch.lanterns[q].x, y: ch.lanterns[q].y, el: ch.lanterns[q].el }); } }
      }
    }
    return out.filter(function (o) { return Math.hypot(o.x - px, o.y - py) <= R; });
  }
  /** ⑲-22 서책·활 기본 공격 — 사거리 R 안 가장 가까운 안 켠 과녁(없으면 null) */
  function shootNear(px, py, R) {
    var L = aimPoints(px, py, R).filter(function (o) { return o.kind === 'target'; }), best = null, bd = Infinity;
    for (var i = 0; i < L.length; i++) { var d = Math.hypot(L[i].x - px, L[i].y - py); if (d < bd) { bd = d; best = L[i]; } }
    return best;
  }
  /** 들판 무리를 치웠다(`field:clear`) — 상자 잠금 무리면 풀린다 */
  function onClear(e) {
    if (!e || typeof e.camp !== 'string' || e.camp.indexOf('tc:') !== 0) { return; }
    unlocked[e.camp.slice(3)] = true;
    toast('🔓 지키던 무리를 물리쳤다 — 상자가 풀렸다');
  }
  var clock = 0;
  function nowSec() { return clock; }

  /** 들판 전투 `populate` 가 묻는다 — 둘레 R 안의 안 연·안 풀린 무리 잠금 상자마다 무리 하나 */
  function campsNear(px, py, R) {
    if (!on()) { return []; }
    var F = FC(), B = BM();
    if (!F || !B) { return []; }
    var L = near(px, py, R).chests, out = [], i, k;
    for (i = 0; i < L.length; i++) {
      var ch = L[i];
      if ((ch.lock !== 'camp' && ch.lock !== 'elite') || unlocked[ch.id] || opened(ch.id)) { continue; }
      var bi = B.biomeAt(ch.x, ch.y) || {}, list, cx = ch.x, cy = ch.y;
      if (ch.lock === 'elite') {
        var ei = bi.elites && bi.elites.length ? bi.elites[Math.floor(h3(Math.round(cx), Math.round(cy), 5) * bi.elites.length) % bi.elites.length] : 0;
        list = F.ELITES[ei % F.ELITES.length];
      } else {
        var ti = bi.themes && bi.themes.length ? bi.themes[Math.floor(h3(Math.round(cx), Math.round(cy), 7) * bi.themes.length) % bi.themes.length] : 0;
        list = F.THEMES[ti % F.THEMES.length];
      }
      var foes = [];
      for (k = 0; k < list.length; k++) {
        var a = (k / list.length) * Math.PI * 2 + 0.4;
        foes.push({ kind: list[k], dx: Math.cos(a) * 4.5, dy: Math.sin(a) * 4.5 });
      }
      out.push({ key: 'tc:' + ch.id, x: cx, y: cy, tier: F.tierAt(cx, cy), kind: ch.lock === 'elite' ? 'elite' : 'plain', foes: foes });
    }
    return out;
  }
  /** 들판 전투 HUD 를 띄울까 — 안 켠 석등이 15m 안이면(터치로 스킬을 쓰게) */
  function wantsHud(px, py) {
    if (!on()) { return false; }
    var L = near(px, py, 15 + LANTERN_R).chests;
    for (var i = 0; i < L.length; i++) {
      if ((L[i].lock === 'lantern' || L[i].lock === 'target') && !unlocked[L[i].id] && !opened(L[i].id) && Math.hypot(L[i].x - px, L[i].y - py) <= 15) { return true; }
    }
    return false;
  }

  /** 석등 — 첫 불 뒤 20초가 지나면 다 꺼진다 */
  function stepLit(dt) {
    clock += dt;
    for (var lk in lit) {
      if (lit.hasOwnProperty(lk) && lit[lk].t0 !== null && clock - lit[lk].t0 > LANTERN_T) { delete lit[lk]; toast('🏮 석등이 꺼졌다 — 다시 켜야 한다'); }
    }
    for (var sk in shot) {                                        // ⑲-22 과녁 — 10초 지나면 하나씩 꺼진다
      if (!shot.hasOwnProperty(sk)) { continue; }
      shot[sk] = shot[sk].map(function (t) { return t !== null && clock - t > TARGET_T ? null : t; });
      if (shot[sk].every(function (t) { return t === null; })) { delete shot[sk]; }
    }
  }

  var acc = 0, subbed = false;
  function subscribe() {
    if (subbed || !core() || !core().on) { return; }
    subbed = true;
    core().on('field:element', onElement);
    core().on('field:clear', onClear);
  }

  function tick(dt) {
    if (!core() || !core().save) { return; }
    if (!on()) { clock += dt; clearFx(); return; }
    subscribe();
    stepLit(dt);
    acc += dt;
    if (acc >= 0.2) { acc = 0; check(); }
    if (!global.DG_NO_DRAW) { paint(dt); }
  }

  function check() {
    var s = sv(), pos = s.player.pos, g = gps(), L = global.DG.landform;
    var air = L && L.airH ? L.airH() : 0;
    var N = near(pos.x, pos.y, 30), i;
    for (i = 0; i < N.chests.length; i++) {
      var ch = N.chests[i];
      if (opened(ch.id)) { continue; }
      var d = Math.hypot(ch.x - pos.x, ch.y - pos.y);
      if (d <= OPEN_R(g) && lockOpen(ch)) { open(ch); continue; }
      if (d <= 10 && !lockOpen(ch) && !hinted[ch.id]) {
        hinted[ch.id] = true;
        toast(ch.lock === 'lantern'
          ? '🔒 석등 둘에 원소를 — ' + ch.lanterns.map(function (ln) { var E = FC() && FC().EL[ln.el]; return E ? E.icon + ' ' + E.name : ln.el; }).join(' · ') + ' (' + LANTERN_T + '초 안에)'
          : (ch.lock === 'target' ? '🎯 과녁 셋을 ' + TARGET_T + '초 안에 모두 맞혀라 — 활 조준(R)·서책·활 기본 공격'
            : '🔒 상자를 지키는 무리를 모두 쓰러뜨려라'));
      }
    }
    for (i = 0; i < N.orbs.length; i++) {
      var o = N.orbs[i];
      if (s.orbs.got[o.id] || !pickable(o, pos.x, pos.y, air, g)) { continue; }
      s.orbs.got[o.id] = Date.now();
      toast('✦ 수집 구슬 — 지닌 구슬 ' + held() + ' (찾은 지역 탑에 바친다)');
      sfx('discover');
      core().emit('treasure:orb', { id: o.id });
      core().persist();
    }
    offer(pos);
  }

  /** 찾은 지역 탑 25m 안이면 지닌 구슬을 다 바친다 — 둘마다 등급 +1 */
  function offer(pos) {
    var B = BM(), h = held();
    if (!B || h <= 0 || level() >= LV_MAX) { return false; }
    var lms = B.landmarks(pos.x, pos.y, OFFER_R), i, near1 = null;
    for (i = 0; i < lms.length; i++) { if (B.found(lms[i].key)) { near1 = lms[i]; break; } }
    if (!near1) { return false; }
    var s = sv(), c = core(), lv0 = level();
    s.orbs.given = Math.min(s.orbs.given + h, LV_MAX * ORBS_PER_LV);
    var lv1 = level(), up = lv1 - lv0;
    if (up > 0) {
      s.player.gold = (s.player.gold || 0) + 200 * up;
      s.dust = (s.dust || 0) + 2 * up;
      var mk = global.DG.talent ? global.DG.talent.onShrine(up) : '';   // ⑲-4 등급마다 인연 매듭 1
      toast('🗿 탑 등급 ' + lv1 + ' — 들판 기력 상한 +' + STA_PER_LV * up + ' · 금 +' + 200 * up + (mk ? ' · ' + mk : ''));
      c.log('🗿 ' + near1.name + ' 탑에 구슬을 바쳤다 — 탑 등급 ' + lv1, 'discover');
      sfx('reward');
    } else {
      toast('🗿 구슬을 바쳤다 — 다음 등급까지 ' + (ORBS_PER_LV - s.orbs.given % ORBS_PER_LV));
    }
    c.emit('treasure:offer', { level: lv1 });
    c.persist();
    return true;
  }

  /* ── 화면: 3D 상자·석등·구슬 ─────────────────────────── */
  var nodes = {}, fx = { burst: [] }, glowTex = {};
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function glow(T3, color) {
    if (glowTex[color]) { return glowTex[color]; }
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    var g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    var tx = new T3.CanvasTexture(cv);
    glowTex[color] = tx;
    return tx;
  }
  function sprite(T3, color, size, op) {
    var m = new T3.SpriteMaterial({ map: glow(T3, color), transparent: true, depthWrite: false, opacity: op === undefined ? 1 : op,
      blending: T3.AdditiveBlending, fog: false });
    var s = new T3.Sprite(m); s.scale.set(size, size, size);
    return s;
  }
  function model(key, h) {
    var A = global.DG.asset3d;
    var n = A && A.build ? A.build(key, { id: key }) : null;
    if (n) { n.scale.set(h, h, h); }
    return n;
  }
  function elColor(el) { var F = FC(); return F && F.EL[el] ? F.EL[el].color : '#ffffff'; }
  function dropNode(k) {
    var w = W3(), n = nodes[k];
    if (w && n) { w.removeFx(n.root); }
    delete nodes[k];
  }
  function clearFx() { for (var k in nodes) { if (nodes.hasOwnProperty(k)) { dropNode(k); } } }

  function paint(dt) {
    var w = W3();
    paintSight(w);
    if (!w) { clearFx(); return; }
    var T3 = w.three();
    if (!T3) { return; }
    var pos = core().save.player.pos, N = near(pos.x, pos.y, 110), seen = {}, i, q, t = clock;
    for (i = 0; i < N.chests.length; i++) {
      var ch = N.chests[i], k = ch.id;
      if (opened(k)) { continue; }
      seen[k] = true;
      var nd = nodes[k];
      if (!nd) {
        nd = nodes[k] = { root: new T3.Group(), lamps: [] };
        var cm = model('chest', ch.grade === 'luxurious' ? 1.25 : (ch.grade === 'common' ? 0.85 : 1.0));
        if (cm) { nd.root.add(cm); }
        var gc = { common: '#d9b36a', exquisite: '#8fd8ff', precious: '#c7a0ff', luxurious: '#ffd24a' }[ch.grade];
        nd.halo = sprite(T3, gc, 2.6, 0.45); nd.halo.position.y = 0.9; nd.root.add(nd.halo);
        nd.tgs = [];
        (ch.targets || []).forEach(function (tq) {                     // ⑲-22 과녁 — 기둥 + 판(코드 그림)
          var tg = new T3.Group(), wood = new T3.MeshLambertMaterial({ color: 0x7a5a3a });
          var post = new T3.Mesh(new T3.CylinderGeometry(0.07, 0.09, 1.7, 6), wood); post.position.y = 0.85; tg.add(post);
          var board = new T3.Mesh(new T3.CylinderGeometry(0.55, 0.55, 0.08, 20), new T3.MeshLambertMaterial({ color: 0xe8dcc4 }));
          board.rotation.x = Math.PI / 2; board.position.y = 1.75; tg.add(board);
          var eye = new T3.Mesh(new T3.CylinderGeometry(0.22, 0.22, 0.1, 16), new T3.MeshLambertMaterial({ color: 0xc0392b }));
          eye.rotation.x = Math.PI / 2; eye.position.y = 1.75; tg.add(eye);
          var gl = sprite(T3, '#ffd24a', 1.6, 0.0); gl.position.y = 1.75; tg.add(gl);
          tg.rotation.y = Math.atan2(ch.x - tq.x, ch.y - tq.y);
          tg.position.set(tq.x - ch.x, (w.groundY ? w.groundY(tq.x, tq.y) : 0) - (w.groundY ? w.groundY(ch.x, ch.y) : 0), tq.y - ch.y);
          nd.root.add(tg); nd.tgs.push(gl);
        });
        for (q = 0; q < ch.lanterns.length; q++) {
          var ln = ch.lanterns[q], lg = new T3.Group(), lm = model('lantern', 1.6);
          if (lm) { lg.add(lm); }
          var ls = sprite(T3, elColor(ln.el), 1.4, 0.35); ls.position.y = 1.9; lg.add(ls);
          lg.position.set(ln.x - ch.x, (w.groundY ? w.groundY(ln.x, ln.y) : 0) - (w.groundY ? w.groundY(ch.x, ch.y) : 0), ln.y - ch.y);
          nd.root.add(lg); nd.lamps.push(ls);
        }
        w.addFx(nd.root);
      }
      nd.root.position.set(ch.x, w.groundY ? w.groundY(ch.x, ch.y) : 0, ch.y);
      if (nd.halo) { nd.halo.material.opacity = lockOpen(ch) ? 0.55 + Math.sin(t * 3) * 0.15 : 0.25; }
      var sh = shot[k];
      for (q = 0; q < (nd.tgs || []).length; q++) {
        var tOn = !!(unlocked[k] || (sh && sh[q] !== null));
        nd.tgs[q].material.opacity = tOn ? 0.85 + Math.sin(t * 5 + q) * 0.1 : 0;
      }
      var st = lit[k];
      for (q = 0; q < nd.lamps.length; q++) {
        var onq = !!(unlocked[k] || (st && st.on[q]));
        nd.lamps[q].material.opacity = onq ? 0.95 : 0.3;
        nd.lamps[q].scale.setScalar(onq ? 2.4 + Math.sin(t * 6 + q) * 0.2 : 1.2);
      }
    }
    var og = sv().orbs.got;
    for (i = 0; i < N.orbs.length; i++) {
      var o = N.orbs[i];
      if (og[o.id]) { continue; }
      seen[o.id] = true;
      var on2 = nodes[o.id];
      if (!on2) {
        on2 = nodes[o.id] = { root: new T3.Group() };
        on2.core = sprite(T3, '#9fe6ff', 0.9, 1); on2.root.add(on2.core);
        on2.aura = sprite(T3, '#5ab8ff', 2.4, 0.4); on2.root.add(on2.aura);
        w.addFx(on2.root);
      }
      on2.root.position.set(o.x, (w.groundY ? w.groundY(o.x, o.y) : 0) + o.h + Math.sin(t * 2 + o.x) * 0.12, o.y);
      on2.aura.material.rotation = t;
    }
    for (var kk in nodes) { if (nodes.hasOwnProperty(kk) && !seen[kk]) { dropNode(kk); } }
    /* 연 자리 — 금빛 꽃이 잠깐 퍼진다 */
    for (i = fx.burst.length - 1; i >= 0; i--) {
      var b = fx.burst[i];
      if (!b.node) { b.node = sprite(T3, '#ffe28a', 1, 1); b.node.position.set(b.x, (w.groundY ? w.groundY(b.x, b.y) : 0) + 1.2, b.y); w.addFx(b.node); }
      b.t += dt || 0.016;
      b.node.scale.setScalar(1 + b.t * 9); b.node.material.opacity = Math.max(0, 1 - b.t / 0.8);
      if (b.t > 0.8) { w.removeFx(b.node); b.node.material.dispose(); fx.burst.splice(i, 1); }
    }
  }

  /* ── 기척 보기 ────────────────────────────────────────── */
  var sight = { key: false, toggle: false, on: false, layer: null, dots: [], btn: null, wave: null };
  function sightWanted() {
    if (!(sight.key || sight.toggle)) { return false; }
    var D = global.DG, b = document.body;
    if (b && b.classList.contains('sheet-open')) { return false; }
    if ((D.encounter && D.encounter.active) || (D.duel && D.duel.active) || (D.rogueAction && D.rogueAction.active)) { return false; }
    return true;
  }
  function bindSight() {
    if (sight.bound || !global.addEventListener) { return; }
    sight.bound = true;
    global.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { return; }
      if (e.key && e.key.toLowerCase() === 'v') { sight.key = true; }
    });
    global.addEventListener('keyup', function (e) { if (e.key && e.key.toLowerCase() === 'v') { sight.key = false; } });
    global.addEventListener('blur', function () { sight.key = false; });
  }
  function toScreen(w, x, y, up) {
    var T3 = w.three(), cam = w.camNode ? w.camNode() : null;
    if (!T3 || !cam) { return null; }
    var v = new T3.Vector3(x, (w.groundY ? w.groundY(x, y) : 0) + up, y).project(cam);
    if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) { return null; }
    return { x: (v.x + 1) / 2 * global.innerWidth, y: (1 - v.y) / 2 * global.innerHeight };
  }
  function paintSight(w) {
    if (!document.body) { return; }
    bindSight();
    if (!sight.btn) {
      sight.btn = document.createElement('button');
      sight.btn.id = 'tr-sight'; sight.btn.type = 'button';
      sight.btn.setAttribute('aria-label', '기척 보기');
      sight.btn.innerHTML = '<span>👁</span><em>시야</em>';
      sight.btn.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); sight.toggle = !sight.toggle; });
      document.body.appendChild(sight.btn);
      sight.layer = document.createElement('div');
      sight.layer.id = 'tr-sight-layer';
      document.body.appendChild(sight.layer);
    }
    var touch = !!(('ontouchstart' in global) || (global.navigator && navigator.maxTouchPoints > 0));
    sight.btn.classList.toggle('show', !!w && touch);
    sight.btn.classList.toggle('on', sight.toggle);
    var want = !!w && sightWanted();
    if (want !== sight.on) {
      sight.on = want;
      document.body.classList.toggle('sight-on', want);
      if (want) {
        var wv = document.createElement('i'); wv.className = 'tr-wave';
        sight.layer.appendChild(wv);
        setTimeout(function () { if (wv.parentNode) { wv.parentNode.removeChild(wv); } }, 750);
      }
    }
    var used = 0;
    function dot(x, y, up, color, size, cls) {
      var p = toScreen(w, x, y, up);
      if (!p) { return; }
      var d = sight.dots[used];
      if (!d) { d = sight.dots[used] = document.createElement('b'); sight.layer.appendChild(d); }
      d.className = cls || 'tr-dot';
      d.style.left = Math.round(p.x) + 'px'; d.style.top = Math.round(p.y) + 'px';
      d.style.setProperty('--c', color); d.style.setProperty('--s', size + 'px');
      d.style.display = '';
      used++;
    }
    if (sight.on) {
      var pos = core().save.player.pos, N = near(pos.x, pos.y, TRAIL_R), i, q, best = null, bd = Infinity, og = sv().orbs.got;
      for (i = 0; i < N.chests.length; i++) {
        var ch = N.chests[i];
        if (opened(ch.id)) { continue; }
        var dc = Math.hypot(ch.x - pos.x, ch.y - pos.y);
        if (dc < bd) { bd = dc; best = ch; }
        if (dc > SIGHT_R) { continue; }
        dot(ch.x, ch.y, 1, '#ffd24a', 26);
        for (q = 0; q < ch.lanterns.length; q++) {
          var st = lit[ch.id];
          if (!unlocked[ch.id] && !(st && st.on[q])) { dot(ch.lanterns[q].x, ch.lanterns[q].y, 1.9, elColor(ch.lanterns[q].el), 20); }
        }
        for (q = 0; q < (ch.targets || []).length; q++) {            // ⑲-22 안 맞힌 과녁 흰빛
          var sq = shot[ch.id];
          if (!unlocked[ch.id] && !(sq && sq[q] !== null)) { dot(ch.targets[q].x, ch.targets[q].y, 1.75, '#ffffff', 18); }
        }
      }
      for (i = 0; i < N.orbs.length; i++) {
        var o = N.orbs[i];
        if (og[o.id]) { continue; }
        var dd = Math.hypot(o.x - pos.x, o.y - pos.y);
        if (dd < bd) { bd = dd; best = o; }
        if (dd <= SIGHT_R) { dot(o.x, o.y, o.h, '#9fe6ff', 22); }
      }
      var B = BM();
      if (B) {
        B.landmarks(pos.x, pos.y, SIGHT_R).forEach(function (lm) { if (!B.found(lm.key)) { dot(lm.x, lm.y, 6, '#ffffff', 30); } });
      }
      var L = global.DG.landform;
      if (L && L.peaks) {
        L.peaks(pos.x, pos.y, SIGHT_R).forEach(function (p) { if (!L.peakFound(p.key)) { dot(p.x, p.y, 2, '#ffffff', 26); } });
      }
      var F = FC(), fl = F && F.live ? F.live() : [];
      for (i = 0; i < fl.length; i++) {
        if (fl[i].dead || Math.hypot(fl[i].x - pos.x, fl[i].y - pos.y) > SIGHT_R) { continue; }
        dot(fl[i].x, fl[i].y, 1.2, fl[i].el ? elColor(fl[i].el) : '#ff5a4a', 18);
      }
      if (best) {
        var tr = trail(pos.x, pos.y, best.x, best.y);
        for (i = 0; i < tr.length; i++) { dot(tr[i].x, tr[i].y, 0.3, best.h !== undefined ? '#9fe6ff' : '#ffd24a', 9, 'tr-dot trail'); }
      }
    }
    for (var u = used; u < sight.dots.length; u++) { sight.dots[u].style.display = 'none'; }
  }

  global.DG = global.DG || {};
  global.DG.treasure = {
    GRADES: GRADES, LOCK_OF: LOCK_OF, LANTERN_T: LANTERN_T, LV_MAX: LV_MAX, STA_PER_LV: STA_PER_LV, OFFER_R: OFFER_R,
    TRAIL_STEP: TRAIL_STEP, TRAIL_MAX: TRAIL_MAX, SIGHT_R: SIGHT_R,
    on: on, cellItems: cellItems, itemsAt: itemsOf, near: near, pickable: pickable, levelOf: levelOf, trail: trail,
    campsNear: campsNear, wantsHud: wantsHud, staBonus: staBonus, level: level, held: held, opened: opened,
    TARGET_D: TARGET_D, TARGET_T: TARGET_T, TARGET_R: TARGET_R, shootSeg: shootSeg, aimPoints: aimPoints, shootNear: shootNear, _shot: function () { return shot; },
    tick: tick, check: check, offer: offer, open: open, onElement: onElement, onClear: onClear,
    sightOn: function () { return sight.on; },
    /** 진단 전용 — 잠금·불·캐시를 비운다 */
    _resetForTest: function () { unlocked = {}; lit = {}; hinted = {}; shot = {}; itemCache = {}; itemCount = 0; clock = 0; },
    _unlocked: function () { return unlocked; }, _lit: function () { return lit; }, _stepLit: stepLit
  };
})(window);
