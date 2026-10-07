/**
 * 사냥 의뢰 — 흔적 → 큰 짐승 → 부위 → 소재 → 벼림 (PLAN §5 ㉑, W-0101 리뉴얼 ①)
 * ---------------------------------------------------------------
 * 걸어도 만나는 것이 드물던 빈칸(재미표준 E)을 **흔적**으로 메우고, 흔적이 가리키는 큰 짐승을 잡아
 * 무기를 벼릴 소재를 얻는다. 새 보스는 없다 — 큰 짐승은 ⑪ 지역 수호자(field-combat `guardianAt`)다.
 *
 *   흔적     60m 칸마다 해시 < SHARE 면 하나(발자국·긁힌 나무·깃털·뜯긴 풀·물가 발자국·부러진 가지).
 *            고향 300m 안·물 위는 없다. 종류는 그 칸 지역(고향이면 둘째로 가까운 이웃 지역)의 수호자 꼴에 따른다.
 *            늘 같은 자리(세이브 없이) — `treasure.js` 가 지역 칸 해시로 상자를 놓는 방식 그대로
 *   읽기     10m 안 F(걸어서 밟으면 저절로) → 그날은 사라진다(`save.track.read[칸키] = 날짜`)
 *   추적선   같은 날 셋을 읽으면 셋째 흔적이 가리킨 지역 수호자가 **오늘의 큰 짐승** — 미니맵 표식·목표판 "지금" 줄
 *   의뢰     하루 하나(`save.track.hunt = {day, region, boss, broke, parts, done}`). 그 수호자의 방패를 깬 겹 + 쓰러뜨림
 *            = 부위(최대 3) → 부위×4 단사(raid.js 부위 파괴와 같은 식) + 강화석 2(weapon.js upCost 의 ore)
 *
 * 판정(`cellAt`·`cellsNear`·`kindOf`·`trackCells`)은 순수 함수다. 세이브는 `save.track` 한 칸(읽는 쪽 기본값 —
 * 옛 세이브 그대로 열린다). 손잡이 `track.on` 0 이면 흔적·의뢰가 다 사라진다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('track.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function BM() { var b = global.DG.biome; return b && b.on && b.on() ? b : null; }
  function FC() { return global.DG.fieldCombat || null; }

  var CELL = 60, JIT = 20, HOME_R = 300, READ_R = 10, NEED = 3, DUST_PER_PART = 4, HUNT_ORE = 2, PARTS_MAX = 3;
  function SHARE() { return K('share', 0.42); }
  function AUTO_R(gps) { return gps ? 12 : 3; }

  var KINDS = {
    foot:    { key: 'foot',    name: '발자국',      icon: '🐾', color: '#e0b070' },
    claw:    { key: 'claw',    name: '긁힌 나무',   icon: '🪵', color: '#ff9a5a' },
    feather: { key: 'feather', name: '깃털',        icon: '🪶', color: '#ff6a4a' },
    graze:   { key: 'graze',   name: '뜯긴 풀',     icon: '🌿', color: '#9ad86a' },
    wade:    { key: 'wade',    name: '물가 발자국', icon: '💧', color: '#6ec8ff' },
    twig:    { key: 'twig',    name: '부러진 가지', icon: '🌾', color: '#c7a0ff' }
  };
  /* 수호자 꼴(바이옴)마다 흔적 둘 — 뿔룡은 밟고 뜯고, 백호는 긁고 꺾고, 주작은 깃과 불탄 자국… 다섯 바이옴이 여섯 종을 다 낸다 */
  var BY_BIOME = {
    plain: ['foot', 'graze'], bamboo: ['claw', 'twig'], canyon: ['feather', 'claw'],
    marsh: ['wade', 'feather'], ruins: ['twig', 'foot']
  };

  /* ── 해시(칸 좌표만으로) ─────────────────────────────── */
  function h3(a, b, s) {
    var h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /** 흔적이 가리키는 지역 칸 — 고향이면 둘째로 가까운 이웃 지역(고향엔 수호자가 없다) */
  function targetCell(x, y) {
    var B = BM();
    if (!B) { return null; }
    var r = B.regionAt(x, y), c = r.cell;
    if (c.biome === 'home') { c = r.second; }
    return c && BY_BIOME[c.biome] ? c : null;
  }
  /** 종류 — 그 지역 수호자 꼴의 흔적 둘 중 하나(칸 해시) */
  function kindOf(i, j, cell) {
    var pair = cell && BY_BIOME[cell.biome];
    return pair ? pair[h3(i, j, 31) < 0.5 ? 0 : 1] : null;
  }

  /**
   * 60m 칸 (i, j) 의 흔적 — 없으면 null. **순수 함수**(같은 칸은 늘 같은 답).
   * terr(tx,ty) 를 주면 물 위를 비킨다(세 번 다시 굴려 다 물이면 없음)
   */
  function cellAt(i, j, terr) {
    if (h3(i, j, 17) >= SHARE()) { return null; }
    var x = 0, y = 0, k, ok = false;
    for (k = 0; k < 3; k++) {
      x = (i + 0.5) * CELL + (h3(i + k, j, 23) - 0.5) * 2 * JIT;
      y = (j + 0.5) * CELL + (h3(i, j - k, 29) - 0.5) * 2 * JIT;
      if (Math.hypot(x, y) < HOME_R) { return null; }
      if (!terr || terr(Math.floor(x / 48), Math.floor(y / 48)) !== 'water') { ok = true; break; }
    }
    if (!ok) { return null; }
    var cell = targetCell(x, y), kind = kindOf(i, j, cell);
    if (!kind) { return null; }
    return { key: i + '_' + j, i: i, j: j, x: x, y: y, kind: kind, region: cell.key, biome: cell.biome };
  }

  function terrFn() {
    var W = global.DG.world;
    return W && W.terrainAt ? function (tx, ty) { try { return W.terrainAt(tx, ty); } catch (e) { return null; } } : null;
  }
  var cache = {}, cacheN = 0;
  function cellOf(i, j) {
    var k = i + '_' + j;
    if (cache.hasOwnProperty(k)) { return cache[k]; }
    if (cacheN > 4000) { cache = {}; cacheN = 0; }
    cacheN++;
    return (cache[k] = cellAt(i, j, terrFn()));
  }

  /** (x, y) 반경 R 안의 흔적들(실제 자리 — 물 비킴). 읽은 것도 들어 있다 */
  function cellsNear(x, y, R) {
    var out = [], i0 = Math.floor((x - R) / CELL), i1 = Math.floor((x + R) / CELL);
    var j0 = Math.floor((y - R) / CELL), j1 = Math.floor((y + R) / CELL), i, j;
    for (j = j0; j <= j1; j++) {
      for (i = i0; i <= i1; i++) {
        var c = cellOf(i, j);
        if (c && Math.hypot(c.x - x, c.y - y) <= R) { out.push(c); }
      }
    }
    return out;
  }

  /**
   * 재미표준 E 측정용 — 반경 R 안 흔적 수의 평균(고향 300m 밖 표본 열여섯 곳: 1.5km·3km 고리 × 방위 여덟).
   * x, y 를 주면 그 자리 하나만 센다
   */
  function trackCells(R, x, y) {
    if (!on()) { return 0; }
    if (x !== undefined) { return cellsNear(x, y, R).length; }
    var sum = 0, n = 0, a, ring;
    for (ring = 1; ring <= 2; ring++) {
      for (a = 0; a < 8; a++) {
        var ang = a * Math.PI / 4 + ring * 0.3;
        sum += cellsNear(Math.cos(ang) * 1500 * ring, Math.sin(ang) * 1500 * ring, R).length;
        n++;
      }
    }
    return sum / n;
  }

  /* ── 세이브 ───────────────────────────────────────────── */

  function today() {
    var D = global.DG.daily;
    if (D && D.dayKey) { return D.dayKey(); }
    var d = new Date(Date.now() - 4 * 3600000);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  /** `save.track` — 없으면 빈 칸. 날이 바뀌면 읽은 흔적을 비운다(흔적은 다시 선다) */
  function sv() {
    var s = core().save;
    if (!s.track || typeof s.track !== 'object') { s.track = {}; }
    var t = s.track, d = today();
    if (!t.read || typeof t.read !== 'object') { t.read = {}; }
    if (t.day !== d) { t.day = d; t.read = {}; }
    return t;
  }
  function isRead(key) { var t = core().save.track; return !!(t && t.day === today() && t.read && t.read[key]); }
  function readCount() { var t = sv(), n = 0; for (var k in t.read) { if (t.read.hasOwnProperty(k)) { n++; } } return n; }

  /** 오늘의 의뢰(없으면 null) */
  function hunt() {
    var t = sv(), h = t.hunt;
    return h && h.day === t.day ? h : null;
  }
  function guardOf(regionKey) {
    var B = BM(), F = FC();
    if (!B || !F || !F.guardianAt) { return null; }
    var pr = regionKey.split('_'), cell = B.cellAt(+pr[0], +pr[1]);
    var g = F.guardianAt(cell);
    if (!g) { return null; }
    var fo = F.FOES && F.FOES[g.foes[0].kind];
    return { x: g.x, y: g.y, name: fo ? fo.name : '큰 짐승', place: cell.name, kind: g.foes[0].kind, key: g.key };
  }
  /** 수호자가 지금 서 있나 — 쓰러뜨렸고 꽃을 받은 지 150초가 안 됐으면 아직 없다 */
  function guardUp(regionKey) {
    var fs = core().save.field, F = FC();
    if (!fs || !fs.guards || !fs.guards[regionKey]) { return true; }
    return !!(F && F.guardBack && F.guardBack(fs, regionKey, Date.now()));
  }

  /** 흔적 하나를 읽는다 — 셋째면 오늘의 큰 짐승이 선다. 반환 { ok, n, hunt? } */
  function read(c) {
    if (!on() || !c) { return { ok: false }; }
    var t = sv();
    if (t.read[c.key]) { return { ok: false, why: '이미 읽음' }; }
    t.read[c.key] = t.day;
    var n = readCount(), K1 = KINDS[c.kind], g = guardOf(c.region), made = null;
    if (n >= NEED && !hunt() && g) {
      made = t.hunt = { day: t.day, region: c.region, boss: g.kind, broke: 0, parts: 0, done: false };
      toast('🐾 추적선 — 오늘의 큰 짐승 ' + g.name + ' (' + g.place + ') — 미니맵에 표식');
      core().log('🐾 흔적 셋을 읽었다 — ' + g.place + ' 의 ' + g.name + ' 을(를) 쫓는다', 'discover');
      sfx('discover');
    } else {
      toast(K1.icon + ' ' + K1.name + (g ? ' — ' + g.name + ' 이(가) 지나갔다' : '') + (hunt() ? '' : ' · 흔적 ' + Math.min(n, NEED) + '/' + NEED));
    }
    core().emit('track:read', { key: c.key, n: n });
    core().persist();
    return { ok: true, n: n, hunt: made };
  }

  /** 큰 짐승을 쓰러뜨렸다 — 부위 수만큼 단사, 강화석 2. 오늘 의뢰가 없거나 끝났으면 아무것도 안 한다 */
  function onKill(parts) {
    var h = hunt();
    if (!on() || !h || h.done) { return null; }
    var p = Math.max(0, Math.min(PARTS_MAX, parts | 0));
    var G = global.DG.growth, WP = global.DG.weapon;
    var dust = G ? G.addDust(p * DUST_PER_PART) : 0, ore = WP ? WP.addOre(HUNT_ORE) : 0;
    h.parts = p; h.done = true;
    toast('🏹 사냥 의뢰 끝 — 부위 ' + p + '/' + PARTS_MAX + ' · 단사 +' + dust + ' · 🪨 강화석 +' + ore + ' (무기 강화·벼림)');
    core().log('🏹 큰 짐승 사냥 — 부위 ' + p + ' · 단사 +' + dust + ' · 강화석 +' + ore, 'good');
    core().emit('track:hunt', { region: h.region, parts: p });
    core().persist();
    return { dust: dust, ore: ore, parts: p };
  }

  /* 수호자 방패 한 겹 = 부위 하나, 쓰러뜨림 = 하나 더(최대 셋) */
  function onBreak(e) {
    var h = hunt();
    if (h && !h.done && e && e.camp === 'g:' + h.region) { h.broke = Math.min(PARTS_MAX - 1, (h.broke || 0) + 1); }
  }
  function onGuard(e) {
    var h = hunt();
    if (h && !h.done && e && e.region === h.region) { onKill((h.broke || 0) + 1); }
  }
  var subbed = false;
  function subscribe() {
    if (subbed || !core() || !core().on) { return; }
    subbed = true;
    core().on('field:break', onBreak);
    core().on('field:guard', onGuard);
  }

  /* ── 목표판·미니맵 ────────────────────────────────────── */

  /** 목표판 "지금" 줄 — 의뢰 중이면 큰 짐승, 아니면 10m 안 흔적. 없으면 '' */
  function goalText(pos) {
    if (!on() || !core().save) { return ''; }
    var h = hunt();
    if (h && !h.done) {
      var g = guardOf(h.region);
      if (g) {
        var d = Math.round(Math.hypot(g.x - pos.x, g.y - pos.y));
        return '🐾 큰 짐승을 쫓는다 ─ ' + g.name + (guardUp(h.region) ? '' : ' (보상 꽃을 받으면 다시 선다)') + ' · ' + d + 'm';
      }
    }
    var n = nearestUnread(pos, READ_R);
    if (n) { return KINDS[n.kind].icon + ' ' + KINDS[n.kind].name + ' — 읽기 (F)'; }
    return '';
  }
  function nearestUnread(pos, R) {
    var cs = cellsNear(pos.x, pos.y, R), best = null, bd = Infinity;
    for (var i = 0; i < cs.length; i++) {
      if (isRead(cs[i].key)) { continue; }
      var d = Math.hypot(cs[i].x - pos.x, cs[i].y - pos.y);
      if (d < bd) { bd = d; best = cs[i]; }
    }
    return best;
  }
  /** 미니맵 점 — 안 읽은 흔적(둘레 안만)·오늘의 큰 짐승(테두리에도) */
  function marks(pos, R) {
    if (!on() || !core().save) { return []; }
    var out = [], cs = cellsNear(pos.x, pos.y, R), i;
    for (i = 0; i < cs.length; i++) { if (!isRead(cs[i].key)) { out.push({ t: 'trail', x: cs[i].x, y: cs[i].y, name: KINDS[cs[i].kind].icon }); } }
    var h = hunt(), g = h && !h.done ? guardOf(h.region) : null;
    if (g) { out.push({ t: 'hunt', x: g.x, y: g.y, name: '🐾 ' + g.name, edge: true }); }
    return out;
  }

  /* ── 틱·입력·3D 표식 ──────────────────────────────────── */

  function gps() { var W = global.DG.world; return !!(W && W.mode === 'geo'); }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }
  function busy() {
    var D = global.DG, b = global.document && global.document.body;
    if (b && b.classList.contains('sheet-open')) { return true; }
    return !!((D.encounter && D.encounter.active) || (D.duel && D.duel.active) || (D.fishing && D.fishing.active) ||
      (D.story && D.story.nearTalk && D.story.nearTalk()));
  }

  var acc = 0, bound = false;
  function bind() {
    if (bound || !global.addEventListener) { return; }
    bound = true;
    global.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.repeat || !on()) { return; }
      if ((e.key || '').toLowerCase() !== 'f' || busy()) { return; }
      var n = nearestUnread(core().save.player.pos, READ_R);
      if (n) { read(n); }
    });
  }

  function tick(dt) {
    if (!core() || !core().save) { return; }
    if (!on()) { clearFx(); return; }
    subscribe();
    bind();
    acc += dt || 0;
    if (acc >= 0.25) {
      acc = 0;
      var n = busy() ? null : nearestUnread(core().save.player.pos, AUTO_R(gps()));
      if (n) { read(n); }
    }
    if (!global.DG_NO_DRAW) { paint(); }
  }

  var nodes = {}, glowTex = {}, clock = 0;
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function glow(T3, color) {
    if (glowTex[color]) { return glowTex[color]; }
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    var g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (glowTex[color] = new T3.CanvasTexture(cv));
  }
  function dropNode(k) { var w = W3(), n = nodes[k]; if (w && n) { w.removeFx(n); } delete nodes[k]; }
  function clearFx() { for (var k in nodes) { if (nodes.hasOwnProperty(k)) { dropNode(k); } } }
  /** 안 읽은 흔적마다 땅에 낮게 깔린 빛 한 점(종류 빛깔) — 에셋 없이 */
  function paint() {
    var w = W3();
    if (!w) { clearFx(); return; }
    var T3 = w.three();
    if (!T3) { return; }
    clock += 0.016;
    var pos = core().save.player.pos, cs = cellsNear(pos.x, pos.y, 90), seen = {}, i;
    for (i = 0; i < cs.length; i++) {
      var c = cs[i];
      if (isRead(c.key)) { continue; }
      seen[c.key] = true;
      var nd = nodes[c.key];
      if (!nd) {
        var m = new T3.SpriteMaterial({ map: glow(T3, KINDS[c.kind].color), transparent: true, depthWrite: false, opacity: 0.7,
          blending: T3.AdditiveBlending, fog: false });
        nd = nodes[c.key] = new T3.Sprite(m);
        nd.scale.set(1.6, 1.6, 1.6);
        nd.position.set(c.x, (w.groundY ? w.groundY(c.x, c.y) : 0) + 0.35, c.y);
        w.addFx(nd);
      }
      nd.material.opacity = 0.5 + 0.3 * Math.sin(clock * 3 + c.i);
    }
    for (var k in nodes) { if (nodes.hasOwnProperty(k) && !seen[k]) { dropNode(k); } }
  }

  global.DG = global.DG || {};
  global.DG.track = {
    KINDS: KINDS, BY_BIOME: BY_BIOME, CELL: CELL, HOME_R: HOME_R, READ_R: READ_R, NEED: NEED, DUST_PER_PART: DUST_PER_PART, HUNT_ORE: HUNT_ORE,
    on: on, share: SHARE, cellAt: cellAt, cellsNear: cellsNear, kindOf: kindOf, targetCell: targetCell, trackCells: trackCells,
    today: today, read: read, isRead: isRead, readCount: readCount, hunt: hunt, onKill: onKill, onBreak: onBreak, onGuard: onGuard,
    guardOf: guardOf, goalText: goalText, marks: marks, nearestUnread: nearestUnread, tick: tick,
    /** 진단 전용 — 칸 캐시를 비운다 */
    _resetForTest: function () { cache = {}; cacheN = 0; }
  };
})(window);
