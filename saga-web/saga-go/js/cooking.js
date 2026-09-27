/**
 * 채집 · 요리 — 오픈월드 RPG의 채집물·지역 특산물·요리·버프 (PLAN §5 ⑲-6, saga-godot PLAN 106 ⑱)
 * ---------------------------------------------------------------
 *   채집   지역 칸(biome.js, 1.2km)마다 **고정** 자리 — 일반 무리 여섯(바이옴 표) + 특산 무리 둘(바이옴 특산).
 *          1.5m 안(GPS 8m)에 들면 저절로 줍는다. 다시 자라기 일반 30분·특산 1시간(실제 시각).
 *          짐승 고기는 들판 적(멧돼지·반달곰·바위곰)이 떨군다.
 *   솥     역참(world `stationsIn`)마다 곁 3.5m 에 가마솥 + 모닥불. 4m 안(GPS 46m)에서만 조리한다.
 *   요리   여덟 × 품질 셋 — 바늘이 1.6초에 한 번 오가고 요리마다 맛있는 칸이 다르다. 5 번 하면 자동 조리(보통).
 *          회복 셋(한 사람·명단·되살리기, 포만감) · 버프 다섯(공격·방어·모험 계열, 명단 전체 300초, 계열마다 하나)
 *   승급   ★1~5 에 지역 특산물 3·10·20·30·45 — 인물마다 id 해시로 셋 중 하나(`hero.js` rankUpCheck 가 묻는다)
 *   눈꽃   ⑲-32 서리봉 고원 특산물 — 고원 가운데 칸에만 자리 셋(frost `bloomSpots`) × 둘. **해시 풀 SPECIALTIES 셋은 그대로**
 *          (늘리면 있던 인물 특산물이 바뀐다) — 고원 인물만 SPECIALTY_OF 로 눈꽃을 쓴다. 눈꽃 요리는 아직 없다
 *
 * 표·수치는 saga-godot `data/cooking.gd` 그대로(이름도 그쪽 창작). 자리·품질·바늘 판정(`cellPatches`·`qualityAt`·
 * `needleAt`·`specialtyOf`)은 순수 함수. 세이브 `save.cook = { bag, prof, gather }`(읽는 쪽 기본값).
 * 버프·포만감은 이번 판만(세이브 안 함 — Godot 와 같다).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('cooking.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function BM() { var b = global.DG.biome; return b && b.on && b.on() ? b : null; }
  function FC() { return global.DG.fieldCombat || null; }
  function gps() { var W = global.DG.world; return !!(W && W.mode === 'geo'); }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }

  /* ── 표 ─────────────────────────────────────────────── */
  var ITEMS = {
    mint:         { name: '박하',     icon: '🌿', kind: 'common',  color: '#5cc76b', model: 'plant',    h: 0.5 },
    honey_flower: { name: '꿀꽃',     icon: '🌼', kind: 'common',  color: '#fac740', model: 'flower',   h: 0.5 },
    apple:        { name: '산사과',   icon: '🍎', kind: 'common',  color: '#dc332e', model: 'berry',    h: 0.8 },
    mushroom:     { name: '송이버섯', icon: '🍄', kind: 'common',  color: '#9e6b42', model: 'mushroom', h: 0.45 },
    clam:         { name: '바지락',   icon: '🐚', kind: 'common',  color: '#dbccA8', model: 'rock',     h: 0.3 },
    orchid:       { name: '청하란',   icon: '💠', kind: 'special', color: '#b8dbff', model: 'flower',   h: 0.6 },
    conch:        { name: '갯소라',   icon: '🐌', kind: 'special', color: '#ff9e85', model: 'rock',     h: 0.35 },
    ash_flower:   { name: '재꽃',     icon: '🥀', kind: 'special', color: '#ccbde6', model: 'flower',   h: 0.6 },
    snow_bloom:   { name: '눈꽃',     icon: '❄️', kind: 'special', color: '#bfeee6', model: 'flower',   h: 0.55 },
    meat:         { name: '짐승 고기', icon: '🍖', kind: 'drop' }
  };
  var SPECIALTIES = ['orchid', 'conch', 'ash_flower'];          // 해시 풀 — 셋 그대로
  /* 해시 밖 — 그 지역 인물은 그 지역 특산물(saga-godot 106 ㊻-3 SPECIALTY_OF) */
  var SPECIALTY_OF = { story_haram: 'snow_bloom' };
  var SNOW_ITEM = 'snow_bloom';
  /* 바이옴 → 특산물 · 일반 무리 여섯 */
  var SPECIAL_OF = { home: 'orchid', plain: 'orchid', bamboo: 'orchid', marsh: 'conch', canyon: 'ash_flower', ruins: 'ash_flower' };
  var COMMON_OF = {
    home:   ['mint', 'honey_flower', 'apple', 'mushroom', 'clam', 'apple'],
    plain:  ['honey_flower', 'mint', 'apple', 'honey_flower', 'mint', 'mushroom'],
    bamboo: ['mushroom', 'mushroom', 'mint', 'apple', 'honey_flower', 'mint'],
    canyon: ['apple', 'apple', 'mushroom', 'honey_flower', 'mint', 'mushroom'],
    marsh:  ['clam', 'clam', 'clam', 'mint', 'mushroom', 'honey_flower'],
    ruins:  ['mushroom', 'apple', 'honey_flower', 'mint', 'mushroom', 'apple']
  };
  var MEAT_OF = { boar: 1, bear: 1, rockbear: 1 };
  var RESPAWN = { common: 1800, special: 3600 };      // 초(실제 시각)
  var PICK_R = function (g) { return g ? 8 : 1.5; };
  var POT_R = function (g) { return g ? 46 : 4; };
  var POT_OFF = 3.5, RING = 1.4, TILE = 48;

  var QUALITY_NAMES = ['이상한', '보통', '맛있는'];
  var PROF_MAX = 5, BUFF_SEC = 300, FULL_MAX = 100, FULL_PER_DISH = 35, FULL_DECAY = 1;
  var NEEDLE_SEC = 1.6, PERFECT_HALF = 0.07, NORMAL_HALF = 0.2;
  var RANK_SP = [3, 10, 20, 30, 45];                  // 승급 ★1~5

  var RECIPES = {
    honey_cake:   { name: '꿀꽃 떡',       icon: '🍡', effect: 'heal', ratio: [0.14, 0.2, 0.26], flat: [40, 60, 80], ing: { honey_flower: 2, apple: 1 }, zone: 0.62 },
    mush_skewer:  { name: '버섯 꼬치',     icon: '🍢', effect: 'heal_all', ratio: [0.06, 0.09, 0.12], ing: { mushroom: 2, mint: 1 }, zone: 0.45 },
    meat_stew:    { name: '고기 찜',       icon: '🍲', effect: 'revive', ratio: [0.1, 0.15, 0.2], ing: { meat: 2, apple: 1 }, zone: 0.7 },
    mint_stirfry: { name: '박하 고기볶음', icon: '🥘', effect: 'buff', cat: 'attack', stat: 'atk', value: [12, 18, 24], ing: { meat: 1, mint: 2 }, zone: 0.55 },
    orchid_tea:   { name: '청하란 차',     icon: '🍵', effect: 'buff', cat: 'attack', stat: 'crit_rate', value: [0.05, 0.08, 0.1], ing: { orchid: 1, honey_flower: 2 }, zone: 0.38 },
    ash_pancake:  { name: '재꽃 버섯전',   icon: '🥞', effect: 'buff', cat: 'attack', stat: 'crit_dmg', value: [0.1, 0.15, 0.2], ing: { ash_flower: 1, mushroom: 2 }, zone: 0.5 },
    clam_soup:    { name: '바지락탕',      icon: '🥣', effect: 'buff', cat: 'defense', stat: 'def', value: [10, 15, 20], ing: { clam: 2, mint: 1 }, zone: 0.66 },
    conch_grill:  { name: '갯소라 구이',   icon: '🍢', effect: 'buff', cat: 'adventure', stat: 'stamina_save', value: [0.12, 0.18, 0.24], ing: { conch: 1, clam: 1 }, zone: 0.42 }
  };
  var ORDER = ['honey_cake', 'mush_skewer', 'meat_stew', 'mint_stirfry', 'orchid_tea', 'ash_pancake', 'clam_soup', 'conch_grill'];
  var CAT_NAMES = { attack: '공격', defense: '방어', adventure: '모험' };
  var STAT_NAMES = { atk: '공격력', def: '방어력', crit_rate: '치명타 확률', crit_dmg: '치명타 피해', stamina_save: '스태미나 소모 감소' };

  /* ── 순수 판정 ───────────────────────────────────────── */
  function h3(a, b, s) {
    var h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function spot(c, salt, dMin, dMax, terr) {
    var x = c.x, y = c.y, k;
    for (k = 0; k < 7; k++) {
      var a = h3(c.i * 11 + k, c.j * 5 - k, salt) * Math.PI * 2;
      var d = dMin + (dMax - dMin) * h3(c.i - k * 2, c.j + k, salt + 1);
      x = c.x + Math.cos(a) * d; y = c.y + Math.sin(a) * d;
      if (!terr) { break; }
      var t = terr(Math.floor(x / TILE), Math.floor(y / TILE));
      if (t !== 'water' && t !== 'town' && t !== 'road') { break; }
    }
    return { x: x, y: y };
  }
  /** 한 칸의 채집 무리 — 순수 함수. { cell, patches: [{ id, item, x, y, nodes: [{ id, item, x, y, special }] }] } */
  function cellPatches(i, j, terr) {
    var B = BM(), c = B ? B.cellAt(i, j) : { key: i + '_' + j, i: i, j: j, x: i * 1200, y: j * 1200, biome: 'plain' };
    var bio = COMMON_OF[c.biome] ? c.biome : 'plain', home = bio === 'home';
    var list = COMMON_OF[bio].slice(), sp = SPECIAL_OF[bio], n, k, patches = [];
    for (n = 0; n < (home ? 1 : 2); n++) { list.push(sp); }
    for (n = 0; n < list.length; n++) {
      var item = list[n], special = ITEMS[item].kind === 'special';
      var cnt = special ? 2 : 2 + (h3(i, j, 700 + n) < 0.5 ? 1 : 0);
      var p = spot(c, 600 + n * 19, special ? 150 : 80, 520, terr);
      var pid = 'g' + c.key + '_' + n, nodes = [];
      for (k = 0; k < cnt; k++) {
        var a = Math.PI * 2 * k / cnt + 0.6;
        nodes.push({ id: pid + '_' + k, item: item, x: p.x + Math.cos(a) * RING, y: p.y + Math.sin(a) * RING, special: special });
      }
      patches.push({ id: pid, item: item, x: p.x, y: p.y, nodes: nodes });
    }
    /* ⑲-32 서리봉 고원 가운데 칸 — 눈꽃 자리 셋 × 둘(바이옴 무리 뒤에 붙는다, id 는 'g<칸>_s<n>') */
    var FR = global.DG.frost, fc = FR && FR.on && FR.on() && FR.center ? FR.center() : null;
    if (fc && fc.key === c.key) {
      FR.bloomSpots().forEach(function (q, s) {
        var sid = 'g' + c.key + '_s' + s, sn = [];
        for (k = 0; k < 2; k++) {
          var a2 = Math.PI * k + 0.6;
          sn.push({ id: sid + '_' + k, item: SNOW_ITEM, x: q.x + Math.cos(a2) * RING, y: q.y + Math.sin(a2) * RING, special: true });
        }
        patches.push({ id: sid, item: SNOW_ITEM, x: q.x, y: q.y, nodes: sn });
      });
    }
    return { cell: c, patches: patches };
  }
  /** 바늘 자리(0~1, 0→1→0 왕복) */
  function needleAt(t) {
    var p = ((t % NEEDLE_SEC) + NEEDLE_SEC) % NEEDLE_SEC / NEEDLE_SEC * 2;
    return p <= 1 ? p : 2 - p;
  }
  function qualityAt(recipe, needle) {
    var d = Math.abs(needle - RECIPES[recipe].zone);
    return d <= PERFECT_HALF ? 2 : (d <= NORMAL_HALF ? 1 : 0);
  }
  function dishId(recipe, q) { return 'dish_' + recipe + '_' + Math.max(0, Math.min(2, q)); }
  function dishName(recipe, q) { return QUALITY_NAMES[Math.max(0, Math.min(2, q))] + ' ' + RECIPES[recipe].name; }
  function parseDish(id) {
    var m = /^dish_(.+)_([0-2])$/.exec(id || '');
    return m && RECIPES[m[1]] ? { recipe: m[1], q: +m[2] } : null;
  }
  /** 인물 → 승급 특산물(주인공 청하란, 나머지 id 해시 — Godot 식) */
  function specialtyOf(id) {
    if (!id || id === '_me') { return 'orchid'; }
    if (SPECIALTY_OF[id]) { return SPECIALTY_OF[id]; }
    var h = 7;
    for (var i = 0; i < id.length; i++) { h = (h * 31 + id.charCodeAt(i)) & 0x7fffffff; }
    return SPECIALTIES[h % SPECIALTIES.length];
  }
  function effectText(recipe, q) {
    var r = RECIPES[recipe];
    if (r.effect === 'heal') { return '고른 사람 체력 ' + Math.round(r.ratio[q] * 100) + '%+' + r.flat[q] + ' 회복'; }
    if (r.effect === 'heal_all') { return '명단 모두 체력 ' + Math.round(r.ratio[q] * 100) + '% 회복'; }
    if (r.effect === 'revive') { return '쓰러진 사람을 체력 ' + Math.round(r.ratio[q] * 100) + '% 로'; }
    var v = r.value[q];
    return CAT_NAMES[r.cat] + ' · 명단 ' + STAT_NAMES[r.stat] + ' +' + (v < 1 ? Math.round(v * 100) + '%' : v) + ' · ' + BUFF_SEC + '초';
  }

  /* ── 세이브·가방 ─────────────────────────────────────── */
  var nowFn = function () { return Date.now(); };
  function sv() {
    var s = core().save;
    if (!s.cook || typeof s.cook !== 'object') { s.cook = {}; }
    if (!s.cook.bag) { s.cook.bag = {}; }
    if (!s.cook.prof) { s.cook.prof = {}; }
    if (!s.cook.gather) { s.cook.gather = {}; }
    return s.cook;
  }
  /** 가진 수 — 세이브를 만들지 않는 읽기 */
  function count(k) { var c = core().save.cook; return (c && c.bag && c.bag[k]) || 0; }
  function add(k, n) { if (!(n > 0)) { return 0; } var b = sv().bag; b[k] = (b[k] || 0) + n; return n; }
  function spend(k, n) { var b = sv().bag; if ((b[k] || 0) < n) { return false; } b[k] -= n; if (!b[k]) { delete b[k]; } return true; }
  function prof(recipe) { var c = core().save.cook; return (c && c.prof && c.prof[recipe]) || 0; }
  function available(node) {
    var c = core().save.cook, t = c && c.gather && c.gather[node.id];
    return !t || nowFn() - t >= RESPAWN[node.special ? 'special' : 'common'] * 1000;
  }

  var cache = {}, cacheN = 0;
  function patchesOf(i, j) {
    var k = i + '_' + j, it = cache[k];
    if (it) { return it; }
    var W = global.DG.world;
    var terr = W && W.terrainAt ? function (tx, ty) { try { return W.terrainAt(tx, ty); } catch (e) { return null; } } : null;
    it = cellPatches(i, j, terr);
    if (cacheN > 400) { cache = {}; cacheN = 0; }
    cache[k] = it; cacheN++;
    return it;
  }
  /** 둘레 R 안의 채집물(칸 아홉을 훑는다) */
  function near(px, py, R) {
    var B = BM(), out = [];
    if (!B) { return out; }
    var S = B.SIZE, i0 = Math.floor((px + S / 2) / S), j0 = Math.floor((py + S / 2) / S), di, dj, n, k;
    for (dj = -1; dj <= 1; dj++) {
      for (di = -1; di <= 1; di++) {
        var P = patchesOf(i0 + di, j0 + dj).patches;
        for (n = 0; n < P.length; n++) {
          if (Math.hypot(P[n].x - px, P[n].y - py) > R + RING) { continue; }
          for (k = 0; k < P[n].nodes.length; k++) { out.push(P[n].nodes[k]); }
        }
      }
    }
    return out;
  }
  /** 줍는다 — 다시 자라기 전이면 false */
  function pick(node) {
    if (!available(node)) { return false; }
    sv().gather[node.id] = nowFn();
    add(node.item, 1);
    if (global.DG.daily) { global.DG.daily.progress('gather'); }   // ⑲-8 일일 의뢰
    core().emit('cook:gather', { item: node.item, id: node.id });  // ⑲-13 이야기 gather 단계가 본다
    return true;
  }
  /** 다시 자란 기록은 지운다(세이브가 끝없이 안 커지게) */
  function prune() {
    var c = core().save.cook, now = nowFn(), k;
    if (!c || !c.gather) { return; }
    for (k in c.gather) { if (c.gather.hasOwnProperty(k) && now - c.gather[k] >= RESPAWN.special * 1000) { delete c.gather[k]; } }
  }

  /* ── 솥 ───────────────────────────────────────────── */
  function potsNear(px, py, R) {
    var W = global.DG.world, out = [];
    if (!W || !W.stationsIn || !W.REGION_SIZE) { return out; }
    var RS = W.REGION_SIZE, rx = Math.floor(px / RS), ry = Math.floor(py / RS), dx, dy, i;
    for (dy = -1; dy <= 1; dy++) {
      for (dx = -1; dx <= 1; dx++) {
        var L = W.stationsIn(rx + dx, ry + dy);
        for (i = 0; i < L.length; i++) {
          var p = { key: L[i].key, x: L[i].x + POT_OFF, y: L[i].y, name: L[i].name };
          p.dist = Math.hypot(p.x - px, p.y - py);
          if (p.dist <= R) { out.push(p); }
        }
      }
    }
    out.sort(function (a, b) { return a.dist - b.dist; });
    return out;
  }
  function atPot() {
    var pos = core().save.player.pos;
    return potsNear(pos.x, pos.y, POT_R(gps())).length > 0;
  }

  /* ── 조리 ───────────────────────────────────────────── */
  function cookCheck(recipe, anywhere) {
    var r = RECIPES[recipe];
    if (!r) { return { ok: false, why: '없는 요리' }; }
    if (!anywhere && !atPot()) { return { ok: false, why: '솥 곁에서만(역참 곁)' }; }
    for (var k in r.ing) {
      if (r.ing.hasOwnProperty(k) && count(k) < r.ing[k]) { return { ok: false, why: ITEMS[k].name + ' 부족' }; }
    }
    return { ok: true };
  }
  /** 조리 — 재료를 쓰고 그 품질의 요리 하나. anywhere 는 진단용(솥 거리 건너뜀) */
  function cook(recipe, q, anywhere) {
    if (!cookCheck(recipe, anywhere).ok) { return null; }
    var r = RECIPES[recipe], k;
    for (k in r.ing) { if (r.ing.hasOwnProperty(k)) { spend(k, r.ing[k]); } }
    q = Math.max(0, Math.min(2, q | 0));
    var id = dishId(recipe, q);
    add(id, 1);
    var P = sv().prof;
    P[recipe] = Math.min(99, (P[recipe] || 0) + 1);
    core().emit('cook:done', { recipe: recipe, q: q });
    if (global.DG.daily) { global.DG.daily.progress('cook'); }     // ⑲-8 일일 의뢰
    core().persist();
    return id;
  }
  function canAuto(recipe) { return prof(recipe) >= PROF_MAX; }
  function autoCook(recipe, anywhere) { return canAuto(recipe) ? cook(recipe, 1, anywhere) : null; }

  /* ── 먹기·버프·포만감(이번 판만) ─────────────────────── */
  var buffs = {};          // 계열 → { recipe, q, stat, value, t }
  var full = {};           // 인물id → 포만감
  function fullOf(id) { return full[id] || 0; }
  function member(S, id) {
    if (!S) { return null; }
    for (var i = 0; i < S.party.length; i++) { if (S.party[i].id === id) { return S.party[i]; } }
    return null;
  }
  /**
   * 먹는다 — 회복은 들판 명단에(targetId 가 없으면 체력 비율이 가장 낮은 사람·쓰러진 첫 사람). state 는 진단용(들판 상태를 넘긴다).
   * @returns {{ok:boolean, why?:string, text?:string}}
   */
  function eat(dish, targetId, state) {
    var d = parseDish(dish);
    if (!d || count(dish) < 1) { return { ok: false, why: '요리가 없다' }; }
    var r = RECIPES[d.recipe], q = d.q, text;
    if (r.effect === 'buff') {
      buffs[r.cat] = { recipe: d.recipe, q: q, stat: r.stat, value: r.value[q], t: BUFF_SEC };
      text = CAT_NAMES[r.cat] + ' 계열 — ' + STAT_NAMES[r.stat] + ' +' + (r.value[q] < 1 ? Math.round(r.value[q] * 100) + '%' : r.value[q]);
    } else {
      var F = FC(), S = state || (F && F.state ? F.state() : null), i, m;
      if (!S || !S.party || !S.party.length) { return { ok: false, why: '들판 명단이 없다' }; }
      if (r.effect === 'revive') {
        m = targetId ? member(S, targetId) : null;
        if (!m) { for (i = 0; i < S.party.length; i++) { if (S.party[i].down) { m = S.party[i]; break; } } }
        if (!m || !m.down) { return { ok: false, why: '쓰러진 사람이 없다' }; }
        if (fullOf(m.id) + FULL_PER_DISH > FULL_MAX) { return { ok: false, why: m.name + ' 배가 부르다' }; }
        m.down = false; m.hp = Math.max(1, Math.round(m.hpMax * r.ratio[q]));
        full[m.id] = fullOf(m.id) + FULL_PER_DISH;
        text = m.name + ' 일어났다';
      } else if (r.effect === 'heal') {
        m = targetId ? member(S, targetId) : null;
        if (!m) {
          for (i = 0; i < S.party.length; i++) {
            var o = S.party[i];
            if (!o.down && (!m || o.hp / o.hpMax < m.hp / m.hpMax)) { m = o; }
          }
        }
        if (!m || m.down) { return { ok: false, why: '먹일 사람이 없다' }; }
        if (fullOf(m.id) + FULL_PER_DISH > FULL_MAX) { return { ok: false, why: m.name + ' 배가 부르다' }; }
        m.hp = Math.min(m.hpMax, m.hp + Math.round(m.hpMax * r.ratio[q] + r.flat[q]));
        full[m.id] = fullOf(m.id) + FULL_PER_DISH;
        text = m.name + ' 체력 회복';
      } else {
        var anyone = false;
        for (i = 0; i < S.party.length; i++) {
          m = S.party[i];
          if (m.down) { continue; }
          m.hp = Math.min(m.hpMax, m.hp + Math.round(m.hpMax * r.ratio[q]));
          anyone = true;
        }
        if (!anyone) { return { ok: false, why: '먹일 사람이 없다' }; }
        text = '명단 모두 체력 회복';
      }
    }
    spend(dish, 1);
    core().emit('cook:eat', { dish: dish });
    core().persist();
    return { ok: true, text: r.icon + ' ' + dishName(d.recipe, q) + ' — ' + text };
  }
  /** 들판 전투가 더하는 버프 몫 */
  function buffStats() {
    var out = { atk: 0, def: 0, crit_rate: 0, crit_dmg: 0 }, k;
    for (k in buffs) { if (buffs.hasOwnProperty(k) && out.hasOwnProperty(buffs[k].stat)) { out[buffs[k].stat] += buffs[k].value; } }
    return out;
  }
  /** 스태미나 소모 배율(모험 계열) — landform·field-combat 이 곱한다 */
  function staminaMul() { var b = buffs.adventure; return b ? 1 - b.value : 1; }
  function step(dt) {
    var k;
    for (k in buffs) {
      if (buffs.hasOwnProperty(k)) { buffs[k].t -= dt; if (buffs[k].t <= 0) { toast('⌛ ' + RECIPES[buffs[k].recipe].name + ' 효과가 끝났다'); delete buffs[k]; } }
    }
    for (k in full) { if (full.hasOwnProperty(k)) { full[k] = Math.max(0, full[k] - FULL_DECAY * dt); if (!full[k]) { delete full[k]; } } }
  }

  /* ── 승급 특산물(hero.js 가 묻는다) ─────────────────── */
  /** 승급 rank → rank+1 에 드는 특산물 — { item, name, n, have } (세이브를 만들지 않는다) */
  function rankNeed(id, rank) {
    if (!on() || rank < 0 || rank >= RANK_SP.length) { return null; }
    var it = specialtyOf(id);
    return { item: it, name: ITEMS[it].name, icon: ITEMS[it].icon, n: RANK_SP[rank], have: count(it) };
  }
  function spendRank(id, rank) {
    var need = rankNeed(id, rank);
    return !need || spend(need.item, need.n);
  }

  /** 들판 적을 쓰러뜨렸다 — 짐승이면 고기 */
  function onKill(kind) {
    var n = MEAT_OF[kind] || 0;
    if (n) { add('meat', n); return '🍖 +' + n; }
    return '';
  }

  /* ══ 런타임 — 줍기·화면 ═════════════════════════════ */
  var acc = 0, pruneAcc = 0;
  function check() {
    var s = core().save, pos = s.player.pos, g = gps(), N = near(pos.x, pos.y, PICK_R(g) + 1), i, got = {};
    for (i = 0; i < N.length; i++) {
      if (Math.hypot(N[i].x - pos.x, N[i].y - pos.y) > PICK_R(g)) { continue; }
      if (pick(N[i])) { got[N[i].item] = (got[N[i].item] || 0) + 1; }
    }
    var keys = Object.keys(got);
    if (keys.length) {
      toast(keys.map(function (k) { return ITEMS[k].icon + ' ' + ITEMS[k].name + ' +' + got[k]; }).join(' · '));
      sfx('discover');
      core().persist();
    }
  }
  function tick(dt) {
    if (!core() || !core().save) { return; }
    step(dt);
    if (!on()) { clearFx(); return; }
    bindKeys();
    acc += dt; pruneAcc += dt;
    if (acc >= 0.2) { acc = 0; check(); }
    if (pruneAcc >= 60) { pruneAcc = 0; prune(); }
    if (!global.DG_NO_DRAW) { paint(dt); paintBtn(); }
  }

  /* ── 3D 채집물·솥 ───────────────────────────────────── */
  var nodes = {}, glowTex = {}, clock = 0;
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function glow(T3, color) {
    if (glowTex[color]) { return glowTex[color]; }
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    var g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowTex[color] = new T3.CanvasTexture(cv);
    return glowTex[color];
  }
  function sprite(T3, color, size, op) {
    var s = new T3.Sprite(new T3.SpriteMaterial({ map: glow(T3, color), transparent: true, depthWrite: false, opacity: op, blending: T3.AdditiveBlending, fog: false }));
    s.scale.set(size, size, size);
    return s;
  }
  function model(key, h) {
    var A = global.DG.asset3d, n = A && A.build ? A.build(key, { id: key }) : null;
    if (n) { n.scale.set(h, h, h); }
    return n;
  }
  function gy(w, x, y) { return w.groundY ? w.groundY(x, y) : 0; }
  function dropNode(k) { var w = W3(), n = nodes[k]; if (w && n) { w.removeFx(n.root); } delete nodes[k]; }
  function clearFx() { for (var k in nodes) { if (nodes.hasOwnProperty(k)) { dropNode(k); } } }
  function paint(dt) {
    clock += dt || 0;
    var w = W3();
    if (!w) { clearFx(); return; }
    var T3 = w.three();
    if (!T3) { return; }
    var pos = core().save.player.pos, seen = {}, i, N = near(pos.x, pos.y, 70);
    for (i = 0; i < N.length; i++) {
      var nd = N[i];
      if (!available(nd)) { continue; }
      seen[nd.id] = true;
      var o = nodes[nd.id];
      if (!o) {
        var it = ITEMS[nd.item];
        o = nodes[nd.id] = { root: new T3.Group() };
        var m = model('gather:' + it.model, it.h);
        if (m) { o.root.add(m); }
        o.halo = sprite(T3, it.color, nd.special ? 1.9 : 1.2, nd.special ? 0.55 : 0.3);
        o.halo.position.y = it.h * 0.7;
        o.root.add(o.halo);
        o.root.position.set(nd.x, gy(w, nd.x, nd.y), nd.y);
        w.addFx(o.root);
      }
      o.halo.material.opacity = (nd.special ? 0.45 : 0.25) + Math.sin(clock * 2.4 + nd.x) * 0.12;
    }
    var P = potsNear(pos.x, pos.y, 110);
    for (i = 0; i < P.length; i++) {
      var pk = 'pot:' + P[i].key;
      seen[pk] = true;
      if (!nodes[pk]) {
        var g = { root: new T3.Group() };
        var pm = model('cook:pot', 1.1); if (pm) { g.root.add(pm); }
        var fm = model('cook:fire', 0.8); if (fm) { fm.position.set(0, 0, 0); g.root.add(fm); }
        g.halo = sprite(T3, '#ffb347', 2.4, 0.35); g.halo.position.y = 0.9; g.root.add(g.halo);
        g.root.position.set(P[i].x, gy(w, P[i].x, P[i].y), P[i].y);
        w.addFx(g.root);
        nodes[pk] = g;
      }
      nodes[pk].halo.material.opacity = 0.3 + Math.sin(clock * 7) * 0.06;
    }
    for (var kk in nodes) { if (nodes.hasOwnProperty(kk) && !seen[kk]) { dropNode(kk); } }
  }

  /* ── 요리 창(G · 🍲) ───────────────────────────────── */
  var ui = { btn: null, sheet: null, open: false, needle: null, bound: false };
  function hasDish() {
    var c = core().save.cook, k;
    if (!c || !c.bag) { return false; }
    for (k in c.bag) { if (c.bag.hasOwnProperty(k) && k.indexOf('dish_') === 0 && c.bag[k] > 0) { return true; } }
    return false;
  }
  function bindKeys() {
    if (ui.bound || !global.addEventListener) { return; }
    ui.bound = true;
    global.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { return; }
      if (e.key && e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey) { if (ui.open) { closeSheet(); } else { openSheet(); } }
      else if (e.key === 'Escape' && ui.open) { closeSheet(); }
    });
  }
  function paintBtn() {
    if (!document.body) { return; }
    if (!ui.btn) {
      ui.btn = document.createElement('button');
      ui.btn.id = 'ck-btn'; ui.btn.type = 'button';
      ui.btn.setAttribute('aria-label', '요리');
      ui.btn.innerHTML = '<span>🍲</span><em>요리</em>';
      ui.btn.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); if (ui.open) { closeSheet(); } else { openSheet(); } });
      document.body.appendChild(ui.btn);
    }
    var busy = document.body.classList.contains('sheet-open');
    ui.btn.classList.toggle('show', !busy && (atPot() || hasDish()));
    ui.btn.classList.toggle('pot', atPot());
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function render() {
    if (!ui.sheet) { return; }
    var pot = atPot(), bag = sv().bag, out = '', k, i;
    out += '<div class="ck-head"><b>🍲 요리</b><span>' + (pot ? '🔥 솥 곁 — 조리할 수 있다' : '역참 곁 솥에서 조리 · 먹기는 어디서나') + '</span>' +
      '<button class="ck-x" data-ck="close" aria-label="닫기">✕</button></div>';
    var mats = [];
    for (k in ITEMS) { if (ITEMS.hasOwnProperty(k)) { mats.push('<span' + (count(k) ? '' : ' class="dim"') + '>' + ITEMS[k].icon + ' ' + ITEMS[k].name + ' ' + count(k) + '</span>'); } }
    out += '<div class="ck-mats">' + mats.join('') + '</div>';
    if (ui.needle) {
      var R = RECIPES[ui.needle.recipe];
      out += '<div class="ck-cook"><div>' + R.icon + ' ' + esc(R.name) + ' — 바늘이 맛있는 칸에 올 때 불을 끈다</div>' +
        '<div class="ck-bar"><i class="ck-ok" style="left:' + ((R.zone - NORMAL_HALF) * 100) + '%;width:' + (NORMAL_HALF * 200) + '%"></i>' +
        '<i class="ck-best" style="left:' + ((R.zone - PERFECT_HALF) * 100) + '%;width:' + (PERFECT_HALF * 200) + '%"></i><b class="ck-needle"></b></div>' +
        '<button class="btn primary wide" data-ck="stop">🔥 불 끄기</button></div>';
    }
    var buffTxt = Object.keys(buffs).map(function (c) { var b = buffs[c]; return RECIPES[b.recipe].icon + ' ' + CAT_NAMES[c] + ' ' + Math.ceil(b.t) + '초'; });
    if (buffTxt.length) { out += '<div class="ck-buffs">켜진 효과 · ' + buffTxt.join(' · ') + '</div>'; }
    out += '<div class="ck-list">';
    for (i = 0; i < ORDER.length; i++) {
      var id = ORDER[i], r = RECIPES[id], chk = cookCheck(id), ing = [];
      for (k in r.ing) { if (r.ing.hasOwnProperty(k)) { ing.push(ITEMS[k].icon + ' ' + count(k) + '/' + r.ing[k]); } }
      out += '<div class="ck-row"><div class="ck-name">' + r.icon + ' <b>' + esc(r.name) + '</b> <small>' + ing.join(' ') + ' · 숙련 ' + Math.min(PROF_MAX, prof(id)) + '/' + PROF_MAX + '</small>' +
        '<small class="muted">' + esc(effectText(id, 1)) + '</small></div><div class="ck-acts">' +
        '<button class="btn ' + (chk.ok ? 'primary' : 'ghost') + '"' + (chk.ok && !ui.needle ? '' : ' disabled') + ' data-ck="cook" data-r="' + id + '">조리</button>' +
        (canAuto(id) ? '<button class="btn ghost"' + (chk.ok ? '' : ' disabled') + ' data-ck="auto" data-r="' + id + '">자동</button>' : '') + '</div></div>';
      for (var q = 2; q >= 0; q--) {
        var did = dishId(id, q);
        if (!count(did)) { continue; }
        out += '<div class="ck-dish">' + esc(dishName(id, q)) + ' ×' + count(did) + ' <small class="muted">' + esc(effectText(id, q)) + '</small>';
        var F = FC(), S = F && F.state ? F.state() : null;
        if ((r.effect === 'heal' || r.effect === 'revive') && S && S.party) {
          for (var j = 0; j < S.party.length; j++) {
            var m = S.party[j], okm = r.effect === 'revive' ? m.down : !m.down;
            out += '<button class="btn ghost sm"' + (okm ? '' : ' disabled') + ' data-ck="eat" data-d="' + did + '" data-t="' + esc(m.id) + '">' + esc(m.name) +
              ' ' + (m.down ? '쓰러짐' : Math.round(100 * m.hp / m.hpMax) + '%') + '</button>';
          }
        } else {
          out += '<button class="btn ghost sm" data-ck="eat" data-d="' + did + '">먹기</button>';
        }
        out += '</div>';
      }
    }
    out += '</div>';
    ui.sheet.innerHTML = '<div class="ck-card">' + out + '</div>';
  }
  function openSheet() {
    if (!document.body) { return; }
    if (!ui.sheet) {
      ui.sheet = document.createElement('div');
      ui.sheet.id = 'ck-sheet';
      ui.sheet.addEventListener('click', onClick);
      document.body.appendChild(ui.sheet);
    }
    ui.open = true; ui.needle = null;
    ui.sheet.classList.add('show');
    render();
  }
  function closeSheet() { ui.open = false; ui.needle = null; if (ui.sheet) { ui.sheet.classList.remove('show'); } }
  function animNeedle() {
    if (!ui.needle || !ui.open) { return; }
    var el = ui.sheet && ui.sheet.querySelector('.ck-needle');
    if (el) { el.style.left = (needleAt((perfNow() - ui.needle.t0) / 1000) * 100) + '%'; }
    global.requestAnimationFrame(animNeedle);
  }
  function perfNow() { return global.performance && global.performance.now ? global.performance.now() : Date.now(); }
  function onClick(e) {
    var b = e.target.closest ? e.target.closest('[data-ck]') : null;
    if (!b) { if (e.target === ui.sheet) { closeSheet(); } return; }
    var act = b.getAttribute('data-ck'), r = b.getAttribute('data-r');
    if (act === 'close') { closeSheet(); return; }
    if (act === 'cook') { ui.needle = { recipe: r, t0: perfNow() }; render(); global.requestAnimationFrame(animNeedle); return; }
    if (act === 'stop' && ui.needle) {
      var rec = ui.needle.recipe, q = qualityAt(rec, needleAt((perfNow() - ui.needle.t0) / 1000));
      ui.needle = null;
      var got = cook(rec, q);
      toast(got ? RECIPES[rec].icon + ' ' + dishName(rec, q) + ' 완성' : '🍲 ' + cookCheck(rec).why);
      if (got) { sfx(q === 2 ? 'reward' : 'discover'); }
    } else if (act === 'auto') {
      var ga = autoCook(r);
      toast(ga ? RECIPES[r].icon + ' 자동 조리 — ' + dishName(r, 1) : '🍲 ' + cookCheck(r).why);
    } else if (act === 'eat') {
      var er = eat(b.getAttribute('data-d'), b.getAttribute('data-t') || null);
      toast(er.ok ? er.text : '🍲 ' + er.why);
    }
    render();
  }

  global.DG = global.DG || {};
  global.DG.cooking = {
    ITEMS: ITEMS, SPECIALTIES: SPECIALTIES, SPECIAL_OF: SPECIAL_OF, COMMON_OF: COMMON_OF, RECIPES: RECIPES, ORDER: ORDER,
    RESPAWN: RESPAWN, QUALITY_NAMES: QUALITY_NAMES, PROF_MAX: PROF_MAX, BUFF_SEC: BUFF_SEC, FULL_MAX: FULL_MAX, FULL_PER_DISH: FULL_PER_DISH,
    NEEDLE_SEC: NEEDLE_SEC, PERFECT_HALF: PERFECT_HALF, NORMAL_HALF: NORMAL_HALF, RANK_SP: RANK_SP, POT_OFF: POT_OFF,
    /* 판정 층(순수) */
    cellPatches: cellPatches, needleAt: needleAt, qualityAt: qualityAt, dishId: dishId, dishName: dishName, parseDish: parseDish,
    specialtyOf: specialtyOf, SPECIALTY_OF: SPECIALTY_OF, effectText: effectText,
    /* 세이브·가방 */
    count: count, add: add, spend: spend, prof: prof, available: available, near: near, pick: pick, prune: prune,
    potsNear: potsNear, atPot: atPot, cookCheck: cookCheck, cook: cook, canAuto: canAuto, autoCook: autoCook,
    eat: eat, buffStats: buffStats, staminaMul: staminaMul, fullOf: fullOf, step: step,
    rankNeed: rankNeed, spendRank: spendRank, onKill: onKill,
    /* 런타임 */
    tick: tick, check: check, openSheet: openSheet, closeSheet: closeSheet,
    buffs: function () { return buffs; },
    _setNowForTest: function (fn) { nowFn = fn || function () { return Date.now(); }; },
    _resetForTest: function () { buffs = {}; full = {}; cache = {}; cacheN = 0; }
  };
})(window);
