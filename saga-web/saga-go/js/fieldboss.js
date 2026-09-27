/**
 * 들판 보스 — 보상 꽃 · 다시 서기 · 승급 재료 (PLAN §5 ⑲-10, 수치는 §5 ⑳)
 * ---------------------------------------------------------------
 * 새 보스를 세우지 않는다 — ⑪ 지역 수호자(바이옴 다섯 꼴)가 들판 보스다.
 *   꽃       수호자를 쓰러뜨리면 그 자리에 보상 꽃(수호자 원소 빛). 곁에서 원기 30(⑲-9)을 써서 받는다.
 *            모자라면 꽃이 남는다. 받으면 150초 뒤 수호자가 다시 선다(field-combat `guardBack`).
 *            다시 쓰러뜨리면 토벌 금·단사·경험 없이 꽃만 다시 핀다.
 *   재료     바이옴마다 보스 재료 하나. 인물은 id 해시로 하나를 쓴다 — 승급 ★2~★5 에 2·4·8·12.
 *            ⑲-31 서리봉 고원 가운데의 만년설 바위곰왕(field-combat `g_frost`)은 여섯째 재료 만년설 바위 심장 —
 *            **해시 풀(MAT_KEYS 다섯)에는 안 넣는다**(늘리면 있던 인물 재료가 바뀐다). 고원 인물만 BOSS_OF 로 이것을 쓴다.
 *
 * 꽃이 피는 조건은 세이브만 읽는다: `save.field.guards[지역]`(쓰러뜨림) 이 있고 `guardPaid[지역]`(받음) 이 없다.
 * 보상·재료 계산(`bossOf`·`rankNeed` 표·`rewardOf`)은 순수 함수다. 세이브는 `save.bossMat` 과
 * field-combat 이 만든 `save.field.guardPaid` 뿐. 손잡이 `fieldboss.on` 0 이면 꽃·재료 요구가 사라진다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('fieldboss.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function BM() { var b = global.DG.biome; return b && b.on && b.on() ? b : null; }
  function FC() { return global.DG.fieldCombat || null; }
  function DM() { return global.DG.domain || null; }

  var MATS = {
    plain:  { key: 'plain',  name: '뿔룡 뿔',        icon: '🦏', boss: 'g_plain' },
    bamboo: { key: 'bamboo', name: '백호 발톱',      icon: '🐯', boss: 'g_bamboo' },
    canyon: { key: 'canyon', name: '주작 깃',        icon: '🪶', boss: 'g_canyon' },
    marsh:  { key: 'marsh',  name: '청룡 진주',      icon: '🫧', boss: 'g_marsh' },
    ruins:  { key: 'ruins',  name: '불가사리 쇳조각', icon: '⚙️', boss: 'g_ruins' },
    frost:  { key: 'frost',  name: '만년설 바위 심장', icon: '🧊', boss: 'g_frost' }
  };
  var MAT_KEYS = ['plain', 'bamboo', 'canyon', 'marsh', 'ruins'];   // 해시 풀 — 다섯 그대로
  var ALL_KEYS = MAT_KEYS.concat(['frost']);
  /* 해시 밖 — 그 지역 인물은 그 지역 보스 재료(saga-godot 106 ㊻-1 BOSS_OF) */
  var BOSS_OF = { story_haram: 'frost' };
  var RANK_BOSS = [0, 2, 4, 8, 12];                    // 승급 ★1~★5 (★1 은 없음)
  var COST = 30;
  var BASE_MAT = 2, ART_RARITY = 4, GOLD_PER_TIER = 100, PARTY_EXP = 60;
  function CLAIM_R(gps) { return gps ? 12 : 3; }

  /* ── 재료(순수) ───────────────────────────────────────── */

  function strHash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) { h = ((h * 33) ^ s.charCodeAt(i)) | 0; }
    return h >>> 0;
  }
  /** 이 인물이 승급에 쓰는 보스 재료 — id 해시로 다섯 중 하나. **순수 함수** */
  function bossOf(id) { return BOSS_OF[id] || MAT_KEYS[strHash('boss:' + id) % MAT_KEYS.length]; }

  function bag() {
    var s = core().save;
    if (!s.bossMat || typeof s.bossMat !== 'object') { s.bossMat = {}; }
    for (var i = 0; i < ALL_KEYS.length; i++) { if (typeof s.bossMat[ALL_KEYS[i]] !== 'number') { s.bossMat[ALL_KEYS[i]] = 0; } }
    return s.bossMat;
  }
  function count(k) { var b = core().save.bossMat; return (b && b[k]) || 0; }
  function add(k, n) { if (!MATS[k] || !(n > 0)) { return 0; } bag()[k] += n; return n; }

  /** 승급 rank → rank+1 에 드는 보스 재료 — 없으면 null(★1·손잡이 꺼짐) */
  function rankNeed(id, rank) {
    if (!on() || rank < 0 || rank >= RANK_BOSS.length || !RANK_BOSS[rank]) { return null; }
    var k = bossOf(id);
    return { item: k, name: MATS[k].name, icon: MATS[k].icon, n: RANK_BOSS[rank], have: count(k) };
  }
  function spendRank(id, rank) {
    var need = rankNeed(id, rank);
    if (!need) { return true; }
    if (need.have < need.n) { return false; }
    bag()[need.item] -= need.n;
    return true;
  }

  /** 꽃 보상 — 재료 키(바이옴 또는 'frost')·등급·천하 등급 → 묶음. **순수 함수** */
  function rewardOf(mat, tier, wl, lootMul) {
    return { mat: mat, n: BASE_MAT + Math.floor(Math.max(0, wl | 0) / 3), art: ART_RARITY,
             gold: Math.round(GOLD_PER_TIER * Math.max(1, tier | 0) * (lootMul || 1)), party: PARTY_EXP };
  }
  function rewardText(r) {
    var M = MATS[r.mat];
    return (M ? M.icon + ' ' + M.name + ' ' + r.n + ' · ' : '') + '★' + r.art + ' 보패 1 · 🪙 ' + r.gold + ' · 부대 경험 ' + r.party;
  }

  /* ── 꽃 ──────────────────────────────────────────────── */

  function gps() { var W = global.DG.world; return !!(W && W.mode === 'geo'); }
  function fs() { return (core().save && core().save.field) || null; }

  /** 이 지역의 꽃 — 쓰러뜨렸고 아직 안 받았으면 { rk, x, y, biome, mat, name, el, tier }, 아니면 null.
      mat 은 쓰러진 수호자의 재료(고원 가운데면 'frost', 아니면 바이옴) */
  function bloomAt(rk) {
    var f = fs(), B = BM(), F = FC();
    if (!on() || !f || !f.guards || !f.guards[rk] || (f.guardPaid && f.guardPaid[rk]) || !B || !F) { return null; }
    var p = rk.split('_'), cell = B.cellAt(+p[0], +p[1]), g = F.guardianAt(cell);
    if (!g) { return null; }
    var kind = g.foes[0].kind, foe = F.FOES[kind], mat = kind === 'g_frost' ? 'frost' : cell.biome;
    return { rk: rk, x: g.x, y: g.y, biome: cell.biome, mat: mat, region: cell.name, name: foe ? foe.name : '수호자', el: foe ? foe.el : null, tier: g.tier };
  }
  /** 피어 있는 꽃 전부 */
  function blooms() {
    var f = fs(), out = [];
    if (!f || !f.guards) { return out; }
    for (var rk in f.guards) { if (f.guards.hasOwnProperty(rk)) { var b = bloomAt(rk); if (b) { out.push(b); } } }
    return out;
  }
  /** maxD 안의 가장 가까운 꽃 — { b, dist, inRange } */
  function nearest(maxD) {
    var L = blooms(), p = core().save.player.pos, best = null, bd = maxD === undefined ? Infinity : maxD;
    for (var i = 0; i < L.length; i++) {
      var d = Math.hypot(L[i].x - p.x, L[i].y - p.y);
      if (d <= bd) { bd = d; best = L[i]; }
    }
    return best ? { b: best, dist: bd, inRange: bd <= CLAIM_R(gps()) } : null;
  }

  function wl() { var A = global.DG.adventure; return A ? A.worldLevel() : 0; }
  function lootMul() { var A = global.DG.adventure; return A ? A.lootMul(wl()) : 1; }

  /** 받는다 — 원기 30. { ok, why?, reward?, text? } */
  function claim(rk) {
    var b = bloomAt(rk), D = DM();
    if (!b) { return { ok: false, why: '꽃이 없다' }; }
    if (!D) { return { ok: false, why: '원기가 없다' }; }
    if (D.resin() < COST) { return { ok: false, why: '원기가 모자라다(' + D.resin() + '/' + COST + ')', cost: COST }; }
    D.spendResin(COST);
    var r = rewardOf(b.mat, b.tier, wl(), lootMul()), c = core(), H = global.DG.hero, AR = global.DG.artifact;
    add(r.mat, r.n);
    var art = AR && AR.add ? AR.label(AR.add(r.art)) : '';
    c.save.player.gold = (c.save.player.gold || 0) + r.gold;
    if (H && H.awardParty) { H.awardParty(r.party); }
    fs().guardPaid[rk] = Date.now();
    var txt = rewardText(r);
    c.log('🌸 ' + b.region + ' ' + b.name + ' 보상 꽃 — 원기 ' + COST + ' · ' + txt + (art ? ' · ' + art : ''), 'good');
    c.emit('toast', '🌸 ' + txt);
    c.emit('fieldboss:claim', { rk: rk, biome: b.biome, mat: b.mat });
    c.emit('changed');
    c.persist();
    return { ok: true, cost: COST, reward: r, text: txt, art: art };
  }

  /* ── 화면: 꽃 카드 ────────────────────────────────────── */

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function host() { return global.document && global.document.getElementById('encounter'); }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }
  function closeCard() { var el = host(); if (el) { el.classList.remove('show'); el.innerHTML = ''; } core().emit('changed'); }

  function openCard(b) {
    var el = host(), D = DM();
    if (!el || !b || (global.DG.encounter && global.DG.encounter.active)) { return; }
    var r = rewardOf(b.mat, b.tier, wl(), lootMul()), have = D ? D.resin() : 0;
    el.innerHTML =
      '<div class="enc-card">' +
        '<div class="enc-big"><span style="font-size:56px">🌸</span></div>' +
        '<h3>보상 꽃</h3>' +
        '<p class="quote">' + esc(b.region) + ' — 쓰러진 ' + esc(b.name) + ' 자리에 꽃이 피었다.</p>' +
        '<div class="enc-reward">' + esc(rewardText(r)) + '</div>' +
        '<div class="enc-reward">🌙 원기 ' + have + '/' + (D ? D.RESIN_MAX : 120) + ' · 받으면 150초 뒤 수호자가 다시 선다</div>' +
        (have >= COST
          ? '<button class="btn primary wide" data-act="claim">🌙 원기 ' + COST + ' 쓰고 받는다</button>'
          : '<div class="enc-reward">원기가 모자라다 — 꽃은 그대로 남는다</div>') +
        '<button class="btn ghost wide" data-act="ok">둔다</button>' +
      '</div>';
    el.classList.add('show');
    var cl = el.querySelector('[data-act="claim"]');
    if (cl) { cl.addEventListener('click', function () { closeCard(); var res = claim(b.rk); if (!res.ok) { toast('🌸 ' + res.why); } }); }
    el.querySelector('[data-act="ok"]').addEventListener('click', closeCard);
  }

  /* ── 화면: 3D 꽃 ──────────────────────────────────────── */

  var nodes = {}, glowTex = {}, clock = 0;
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function glow(T3, color) {
    if (glowTex[color]) { return glowTex[color]; }
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    var g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowTex[color] = new T3.CanvasTexture(cv);
    return glowTex[color];
  }
  function dropNode(k) { var w = W3(), n = nodes[k]; if (w && n) { w.removeFx(n.root); } delete nodes[k]; }
  function clearFx() { for (var k in nodes) { if (nodes.hasOwnProperty(k)) { dropNode(k); } } }

  function paint(dt) {
    clock += dt || 0;
    var w = W3();
    if (!w) { clearFx(); return; }
    var T3 = w.three(), F = FC();
    if (!T3) { return; }
    var p = core().save.player.pos, L = blooms(), seen = {}, i;
    for (i = 0; i < L.length; i++) {
      var b = L[i];
      if (Math.hypot(b.x - p.x, b.y - p.y) > 150) { continue; }
      seen[b.rk] = true;
      var nd = nodes[b.rk];
      if (!nd) {
        nd = nodes[b.rk] = { root: new T3.Group() };
        var A = global.DG.asset3d, m = A && A.build ? A.build('gather:flower', { id: 'gather:flower' }) : null;
        if (m) { m.scale.set(1.6, 1.6, 1.6); nd.root.add(m); }
        var col = F && b.el && F.EL[b.el] ? F.EL[b.el].color : '#ffd9f0';
        var sm = new T3.SpriteMaterial({ map: glow(T3, col), transparent: true, depthWrite: false, opacity: 0.6, blending: T3.AdditiveBlending, fog: false });
        nd.halo = new T3.Sprite(sm); nd.halo.scale.set(3, 3, 3); nd.halo.position.y = 1.2; nd.root.add(nd.halo);
        w.addFx(nd.root);
      }
      nd.root.position.set(b.x, w.groundY ? w.groundY(b.x, b.y) : 0, b.y);
      nd.halo.material.opacity = 0.45 + Math.sin(clock * 2.4) * 0.15;
    }
    for (var k in nodes) { if (nodes.hasOwnProperty(k) && !seen[k]) { dropNode(k); } }
  }

  var subbed = false;
  function tick(dt) {
    if (!core() || !core().save) { return; }
    if (!subbed && core().on) { subbed = true; core().on('fieldboss:request', function (b) { openCard(b); }); }
    if (!on()) { clearFx(); return; }
    if (!global.DG_NO_DRAW) { paint(dt); }
  }

  global.DG = global.DG || {};
  global.DG.fieldBoss = {
    MATS: MATS, MAT_KEYS: MAT_KEYS, ALL_KEYS: ALL_KEYS, BOSS_OF: BOSS_OF, RANK_BOSS: RANK_BOSS, COST: COST, CLAIM_R: CLAIM_R,
    /* 판정(순수) */
    bossOf: bossOf, rewardOf: rewardOf, rewardText: rewardText,
    /* 세이브 */
    bag: bag, count: count, add: add, rankNeed: rankNeed, spendRank: spendRank,
    bloomAt: bloomAt, blooms: blooms, nearest: nearest, claim: claim,
    /* 화면 */
    openCard: openCard, tick: tick
  };
})(window);
