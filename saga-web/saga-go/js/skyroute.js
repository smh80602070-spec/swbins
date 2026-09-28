/**
 * 구름 위 항로 — 이야기 7부 무대, 떠 있는 섬 셋 (PLAN §5 ⑲-48, saga-godot PLAN 106 51-1 `world/sky_route.gd`)
 * ---------------------------------------------------------------
 *   자리     고정 지역이 아니다 — **잠긴 도읍 옛 등대(sunken.js) 서쪽 하늘**. 등대에서 서쪽으로 갈수록 높아지는 섬 셋:
 *            하늘 사당 shrine(과거, 윗면 +60m·반지름 18 — 북쪽 기와 사당·바람 방울 장대 넷, 가운데 8m 비움) →
 *            비행선 잔해 wreck(현대, +82m·20 — 조종실·찢어진 기낭·꼬리 날개·프로펠러·풍향계) →
 *            궤도 정거장 조각 orbit(미래, +104m·16 육각 — 태양 날개·9m 안테나·구름 씨앗 장치 셋(반지름 9m)).
 *            높이의 바탕은 등대 자리 땅 높이. 섬 가장자리 사이 틈 GAP m, 난간 1m
 *   보임     23장 등롱에 불을 넣은 뒤(sunken.lighthouseLit)에만 섬이 서고 밟힌다(발판 목록에 든다)
 *   바람 기둥 셋 — 등대 서쪽 7m 땅 → 사당 · 사당 서쪽 가장자리 3.5m 안 → 잔해 · 잔해 서쪽 가장자리 안 → 정거장.
 *            기둥 끝 = 다음 섬 윗면 + DRAFT_OVER, 다음 섬 가장자리까지 활공 약 11.5m. 등대·사당 기둥은 24장 뒤, 잔해 기둥은 25장 뒤
 *            (표에 그 장이 아직 없으면 닫힘 — 손잡이 `skyroute.drafts` 1 이면 늘 열림, 확인용)
 *   몸       skyisle.js 가 발판(`pads`)·상승 기류(`drafts`)를 이 모듈에서도 받는다 — 오르기·활공·착지는 landform 그대로
 *   발견     섬 위에 내려서면 그 섬 발견(금·단사·경험, 세이브 `save.skyroute = { found }`) · 지도·미니맵 표식
 * 그림은 코드 도형(SAGA-DESIGN §7). 판정 층(`isles`·`pads`·`drafts`·`spot`)은 순수(땅 높이·세이브만 읽는다).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('skyroute.' + key, def); }
  function SU() { var s = global.DG.sunken; return s && s.on && s.on() ? s : null; }
  function reliefH(x, y) { var R = global.DG.relief3d; return R && R.heightAt ? R.heightAt(x, y) : 0; }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }

  /* ── 표 ─────────────────────────────────────────────── */
  var ISLES = [
    { id: 'shrine', name: '하늘 사당',        era: '과거', r: 18, up: 60,  slab: 4, hex: false },
    { id: 'wreck',  name: '비행선 잔해',      era: '현대', r: 20, up: 82,  slab: 4, hex: false },
    { id: 'orbit',  name: '궤도 정거장 조각', era: '미래', r: 16, up: 104, slab: 3, hex: true }
  ];
  var GAP = 8, LIGHT_DRAFT = 7, DRAFT_R = 3.5, DRAFT_IN = 3.5, DRAFT_OVER = 9, DRAFT_RISE = 9, GLIDE_TO_EDGE = 12;
  var DRAFT_CH = ['ch24', 'ch24', 'ch25'];                  // 기둥마다 여는 장(그 장을 마친 뒤) — 등대→사당·사당→잔해·잔해→정거장
  var REWARD = { gold: 200, dust: 3, exp: 60 };
  /* 이야기 자리 [섬, m, m](+y 남쪽) — 별배는 사당 남쪽 10m 에 내린다(51-2) */
  var PARTS = { shrine_land: ['shrine', 0, 10], shrine_front: ['shrine', -4, -6], wreck_cockpit: ['wreck', 5, -4], orbit_seed: ['orbit', 0, 0],
    /* ⑲-49 24장 — 무녀는 사당 앞 서쪽(가운데 8m 석등 자리를 비켜) · 한별·반디는 별배 내린 자리 곁 */
    saebyeok: ['shrine', -4.5, -7.5], hanbyeol: ['shrine', 3.5, 11], bandi: ['shrine', -3, 11.5],
    /* ⑲-50 25장 — 하늬는 조종실 동쪽 앞(프로펠러 남쪽) · 기관은 조종실 앞 남동(찢어진 기낭 밖) · 반디는 하늬 곁 */
    haneul: ['wreck', 11, -1], wreck_engine: ['wreck', 8, 3], wreck_bandi: ['wreck', 12, 2.5],
    /* ⑲-51 26장 — 장치 셋은 가운데에서 9m(남동·북·남서 차례) · 가면 그림자는 서쪽 끝 · 보스 자리는 남쪽(안테나·장치를 비켜) · 하늬·반디는 동쪽(태양 날개 안) */
    seed_se: ['orbit', 7.8, 4.5], seed_n: ['orbit', 0, -9], seed_sw: ['orbit', -7.8, 4.5], gamyeon: ['orbit', -12, 0], orbit_duel: ['orbit', 0, 7],
    orbit_haneul: ['orbit', 10, -3], orbit_bandi: ['orbit', 11, 1] };
  var SHRINE_CH = 'ch24', SHRINE_CLEAR = 6, SHRINE_BOOT = [2, 6];   // ⑲-49 방울을 다 울리면(일곱째 단계부터) 사당 위 먹구름이 걷힌다 · 불러오면 섬 위로(셋째~일곱째)
  var ORBIT_CH = 'ch26', ORBIT_BOOT = [2, 8], WRECK_BOOT26 = [0, 1], SEED_OFF_FROM = [4, 5, 6];   // ⑲-51 정거장 섬에 내린 뒤(셋째 단계부터)·불러오면 섬 위로 · 25장 잔해 기둥 타기 전엔 잔해 섬 · 장치는 끈 다음 단계부터 꺼진다(남동·북·남서)
  var WRECK_CH = 'ch25', WRECK_LIVE = 6, WRECK_BOOT = [2, 6], SHRINE_BOOT25 = [0, 1];   // ⑲-50 기관을 지켜 낸 뒤(일곱째 단계부터) 프로펠러가 돈다 · 불러오면 잔해 섬 위로(셋째~일곱째) · 25장 첫 둘은 사당 섬

  /* ── 자리(순수) ─────────────────────────────────────── */
  function storyAt() { var s = core() && core().save ? core().save.story : null; return s || { ch: 0, step: 0 }; }
  function chIndex(id) { var ST = global.DG.story; if (!ST || !ST.CHAPTERS) { return -1; } for (var i = 0; i < ST.CHAPTERS.length; i++) { if (ST.CHAPTERS[i].id === id) { return i; } } return -1; }
  function done(id) { var i = chIndex(id); return i >= 0 && storyAt().ch > i; }
  /** 섬이 섰나 — 23장 등롱 뒤 */
  function on() { var U = SU(); return !!(K('on', 1) && U && U.lighthouseLit && U.lighthouseLit()); }
  function lighthouse() { var U = SU(); return U ? U.siteById('lighthouse') : null; }
  /** 섬 셋 — 등대 서쪽으로 사슬(가장자리 사이 GAP). [{ id, name, era, x, y, r, top, slab, hex }] */
  function isles() {
    var L = lighthouse();
    if (!L) { return []; }
    var base = reliefH(L.x, L.y), out = [], x = L.x - LIGHT_DRAFT - GLIDE_TO_EDGE + DRAFT_R, prevR = 0;
    for (var i = 0; i < ISLES.length; i++) {
      var d = ISLES[i];
      x -= (i ? prevR + GAP : 0) + d.r;
      out.push({ id: d.id, name: d.name, era: d.era, x: x, y: L.y, r: d.r, top: base + d.up, slab: d.slab, hex: d.hex });
      prevR = d.r;
    }
    return out;
  }
  function isleById(id) { var L = isles(); for (var i = 0; i < L.length; i++) { if (L[i].id === id) { return L[i]; } } return null; }
  /** skyisle 발판 목록에 붙는다 — 섬이 섰을 때만 */
  function pads() {
    if (!on()) { return []; }
    var bi = chIndex(SHRINE_CH), wi = chIndex(WRECK_CH), oi = chIndex(ORBIT_CH);
    return isles().map(function (s) {
      var pd = { id: 'sr_' + s.id, name: s.name, x: s.x, y: s.y, r: s.r, top: s.top, slab: s.slab }, bt = [];
      if (s.id === 'shrine' && bi >= 0) { bt.push([bi, SHRINE_BOOT[0], SHRINE_BOOT[1]]); }   // ⑲-49 24장 섬 단계에 불러오면 섬 위로
      if (s.id === 'shrine' && wi >= 0) { bt.push([wi, SHRINE_BOOT25[0], SHRINE_BOOT25[1]]); }   // ⑲-50 25장 기둥 타기 전
      if (s.id === 'wreck' && wi >= 0) { bt.push([wi, WRECK_BOOT[0], WRECK_BOOT[1]]); }
      if (s.id === 'wreck' && oi >= 0) { bt.push([oi, WRECK_BOOT26[0], WRECK_BOOT26[1]]); }   // ⑲-51 26장 기둥 타기 전
      if (s.id === 'orbit' && oi >= 0) { bt.push([oi, ORBIT_BOOT[0], ORBIT_BOOT[1]]); }
      if (bt.length) { pd.boot = bt; }
      return pd;
    });
  }
  /** 바람 기둥 셋의 자리(열림과 무관) — [{ id, x, y, r, top, rise, ch }] */
  function draftSpots() {
    var L = lighthouse(), S = isles();
    if (!L || S.length < 3) { return []; }
    return [
      { id: 'sr_light', x: L.x - LIGHT_DRAFT, y: L.y, r: DRAFT_R, top: S[0].top + DRAFT_OVER, rise: DRAFT_RISE, ch: DRAFT_CH[0] },
      { id: 'sr_shrine', x: S[0].x - S[0].r + DRAFT_IN, y: S[0].y, r: DRAFT_R, top: S[1].top + DRAFT_OVER, rise: DRAFT_RISE, ch: DRAFT_CH[1] },
      { id: 'sr_wreck', x: S[1].x - S[1].r + DRAFT_IN, y: S[1].y, r: DRAFT_R, top: S[2].top + DRAFT_OVER, rise: DRAFT_RISE, ch: DRAFT_CH[2] }
    ];
  }
  function draftOpen(d) { return K('drafts', 0) ? true : done(d.ch); }
  /** 사당 위 먹구름이 걷혔나 — 24장 일곱째 단계(방울을 다 울린 뒤)부터 늘 */
  function shrineClear() { var i = chIndex(SHRINE_CH), s = storyAt(); return i >= 0 && (s.ch > i || (s.ch === i && (s.step || 0) >= SHRINE_CLEAR)); }
  /** ⑲-50 비행선 기관이 살았나 — 25장 일곱째 단계(기관을 지켜 낸 뒤)부터 늘. 그 전엔 프로펠러가 멎어 있다 */
  function wreckLive() { var i = chIndex(WRECK_CH), s = storyAt(); return i >= 0 && (s.ch > i || (s.ch === i && (s.step || 0) >= WRECK_LIVE)); }
  /** ⑲-51 구름 씨앗 장치 i(0 남동·1 북·2 남서)가 꺼졌나 — 26장에서 그 장치를 끈 다음 단계부터(장을 마친 뒤에도) */
  function seederOff(i) { var k = chIndex(ORBIT_CH), s = storyAt(); return k >= 0 && (s.ch > k || (s.ch === k && (s.step || 0) >= SEED_OFF_FROM[i])); }
  /** skyisle 상승 기류 목록에 붙는다 — 섬이 섰고 그 기둥의 장을 마친 뒤 */
  function drafts() { return on() ? draftSpots().filter(draftOpen) : []; }
  function spot(part) {
    var q = PARTS[part], s = q ? isleById(q[0]) : isleById(part);
    if (!s) { return null; }
    return q ? { x: s.x + q[1], y: s.y + q[2] } : { x: s.x, y: s.y };
  }

  /* ── 세이브·발견 ─────────────────────────────────────── */
  function sv() {
    var s = core().save;
    if (!s.skyroute || typeof s.skyroute !== 'object') { s.skyroute = {}; }
    if (!s.skyroute.found || typeof s.skyroute.found !== 'object') { s.skyroute.found = {}; }
    return s.skyroute;
  }
  function found(id) { var f = core().save.skyroute; return !!(f && f.found && f.found[id]); }
  /** 섬 위에 섰으면 그 섬 발견 — 찾은 섬 또는 null */
  function discoverOn(id) {
    var s = isleById(id);
    if (!on() || !s || found(id)) { return null; }
    sv().found[id] = Date.now();
    var c = core(), P = c.save.player;
    P.gold = (P.gold || 0) + REWARD.gold;
    c.save.dust = (c.save.dust || 0) + REWARD.dust;
    if (c.gainExp) { c.gainExp(REWARD.exp); }
    toast('☁️ 구름 위 발견 — ' + s.name + ' (' + s.era + ') · 금 +' + REWARD.gold);
    c.log('☁️ 구름 위 항로 — ' + s.name + ' 발견', 'discover');
    c.emit('skyroute:found', { id: id });
    c.persist();
    return s;
  }
  /** 지도·미니맵 — 섬이 섰으면 셋 다(안 찾으면 흐리게) */
  function marks() {
    if (!on()) { return []; }
    return isles().map(function (s) { return { id: s.id, x: s.x, y: s.y, name: s.name, big: true, found: found(s.id) }; });
  }

  /* ── 3D(코드 도형) ───────────────────────────────────── */
  var fx = {}, live = {}, clock = 0, mats = null;
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function M(T3) {
    if (mats) { return mats; }
    var add = function (c, a) { return new T3.MeshBasicMaterial({ color: c, transparent: true, opacity: a, depthWrite: false, side: T3.DoubleSide, blending: T3.AdditiveBlending, fog: false }); };
    mats = {
      grass: new T3.MeshLambertMaterial({ color: 0x74a65c }), rock: new T3.MeshLambertMaterial({ color: 0x7c7268 }), stone: new T3.MeshLambertMaterial({ color: 0xb8b0a2 }),
      roof: new T3.MeshLambertMaterial({ color: 0x3d4652 }), red: new T3.MeshLambertMaterial({ color: 0x9a3b2c }), wood: new T3.MeshLambertMaterial({ color: 0x6a4d33 }),
      bell: new T3.MeshStandardMaterial({ color: 0xd9b25a, metalness: 0.7, roughness: 0.35 }), cloth: new T3.MeshLambertMaterial({ color: 0xd8d2c0, side: T3.DoubleSide }),
      orange: new T3.MeshLambertMaterial({ color: 0xd9722e }), steel: new T3.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.6, roughness: 0.45 }),
      alloy: new T3.MeshStandardMaterial({ color: 0xd4dbe3, metalness: 0.5, roughness: 0.35 }), panel: new T3.MeshStandardMaterial({ color: 0x23407a, metalness: 0.4, roughness: 0.3 }),
      glow: new T3.MeshBasicMaterial({ color: 0x7ff0ff }), draft: add(0xcff4ff, 0.14), ring: add(0xffffff, 0.5)
    };
    return mats;
  }
  function box(T3, g, m, w, h, d, x, y, z, ry) { var o = new T3.Mesh(new T3.BoxGeometry(w, h, d), m); o.position.set(x, y, z); if (ry) { o.rotation.y = ry; } g.add(o); return o; }
  function cyl(T3, g, m, rt, rb, h, x, y, z, seg) { var o = new T3.Mesh(new T3.CylinderGeometry(rt, rb, h, seg || 12), m); o.position.set(x, y, z); g.add(o); return o; }
  /** 섬 몸 — 풀밭·바위 판·거꾸로 선 뿔·난간(윗면이 y 0) */
  function body(T3, g, s) {
    var m = M(T3), seg = 40;                                                  // ⑲-51 윗면은 늘 둥글게(충돌·난간이 둥글다) — 육각은 아래 뿔·재질로만
    cyl(T3, g, s.hex ? m.alloy : m.grass, s.r, s.r, 0.6, 0, -0.3, 0, seg);
    cyl(T3, g, s.hex ? m.steel : m.rock, s.r, s.r - 2, s.slab, 0, -0.6 - s.slab / 2, 0, seg);
    var cone = new T3.Mesh(new T3.ConeGeometry(s.r - 2, s.hex ? 8 : 18, s.hex ? 6 : 20), s.hex ? m.steel : m.rock);
    cone.rotation.x = Math.PI; cone.position.y = -0.6 - s.slab - (s.hex ? 4 : 9); g.add(cone);
    var rail = new T3.Mesh(new T3.TorusGeometry(s.r - 0.4, 0.08, 4, 64), m.stone); rail.rotation.x = Math.PI / 2; rail.position.y = 1; g.add(rail);
    for (var i = 0; i < 16; i++) { var a = i * Math.PI / 8; box(T3, g, m.stone, 0.2, 1, 0.2, Math.sin(a) * (s.r - 0.4), 0.5, Math.cos(a) * (s.r - 0.4)); }
  }
  function build(T3, s) {
    var m = M(T3), g = new T3.Group(), o = { root: g, spin: [], sway: [] }, i;
    body(T3, g, s);
    if (s.id === 'shrine') {
      box(T3, g, m.stone, 9, 0.5, 6, 0, 0.25, -s.r + 5);                                                          // 북쪽 기와 사당(가운데 8m 비움)
      for (i = 0; i < 4; i++) { cyl(T3, g, m.red, 0.2, 0.2, 3, -3.4 + i * 2.27, 2, -s.r + 7.4, 8); }
      box(T3, g, m.wood, 8, 2.6, 4, 0, 1.8, -s.r + 5);
      var r1 = box(T3, g, m.roof, 9.8, 0.3, 3.2, 0, 3.6, -s.r + 4.1); r1.rotation.x = 0.5;
      var r2 = box(T3, g, m.roof, 9.8, 0.3, 3.2, 0, 3.6, -s.r + 5.9); r2.rotation.x = -0.5;
      for (i = 0; i < 4; i++) {                                                                                  // 바람 방울 장대 넷
        var a = Math.PI / 4 + i * Math.PI / 2, px = Math.sin(a) * (s.r - 5), pz = Math.cos(a) * (s.r - 5);
        cyl(T3, g, m.wood, 0.12, 0.15, 5, px, 2.5, pz, 6);
        var bl = new T3.Group(); bl.position.set(px, 4.6, pz); g.add(bl);
        var bb = cyl(T3, bl, m.bell, 0.25, 0.4, 0.6, 0, -0.4, 0, 10); bb.position.y = -0.4; o.sway.push(bl);
      }
    } else if (s.id === 'wreck') {
      box(T3, g, m.steel, 5, 3, 4, 5, 1.5, -4, 0.3);                                                             // 조종실
      box(T3, g, m.glow, 3.2, 1, 0.08, 5.6, 2.2, -1.9, 0.3);
      var bag = new T3.Mesh(new T3.SphereGeometry(7, 20, 12, 0, Math.PI * 1.4), m.cloth);                         // 찢어진 기낭
      bag.scale.set(1.8, 0.8, 1); bag.position.set(-4, 3.5, 4); bag.rotation.z = 0.35; g.add(bag);
      box(T3, g, m.orange, 0.3, 4, 3, -12, 2, 4, 0.2); box(T3, g, m.orange, 3, 0.3, 5, -12, 0.4, 4, 0.2);          // 꼬리 날개
      var pr = new T3.Group(); pr.position.set(9, 2.2, -4); g.add(pr); o.prop = pr;                                 // 프로펠러(기관이 살면 돈다, ⑲-50)
      box(T3, pr, m.steel, 0.2, 4, 0.4, 0, 0, 0); box(T3, pr, m.steel, 0.2, 0.4, 4, 0, 0, 0);
      cyl(T3, g, m.steel, 0.08, 0.08, 5, -2, 2.5, -8, 6);                                                          // 풍향계
      var vane = new T3.Group(); vane.position.set(-2, 5, -8); g.add(vane); o.spin.push(vane);
      box(T3, vane, m.orange, 1.8, 0.5, 0.06, 0.6, 0, 0);
      var en = PARTS.wreck_engine;                                                                               // ⑲-50 비행선 기관 — 25장 지키기 자리
      box(T3, g, m.steel, 2.4, 1.4, 1.8, en[1], 0.7, en[2] - 1.6); cyl(T3, g, m.orange, 0.5, 0.5, 1.9, en[1], 0.7, en[2] - 1.6, 10).rotation.x = Math.PI / 2;
      o.lamp = box(T3, g, m.glow, 0.5, 0.3, 0.1, en[1], 1.2, en[2] - 0.65);
    } else if (s.id === 'orbit') {
      for (i = -1; i <= 1; i += 2) {                                                                             // 태양 날개 둘
        cyl(T3, g, m.steel, 0.15, 0.15, 6, i * (s.r + 2), 1.5, 0, 6).rotation.z = Math.PI / 2;
        box(T3, g, m.panel, 8, 0.12, 5, i * (s.r + 6), 1.5, 0);
      }
      cyl(T3, g, m.steel, 0.12, 0.2, 9, 0, 4.5, -s.r + 3, 6);                                                      // 9m 안테나
      o.blink = cyl(T3, g, m.glow, 0.25, 0.25, 0.3, 0, 9.1, -s.r + 3, 8);
      for (i = 0; i < 3; i++) {                                                                                  // 구름 씨앗 장치 셋(반지름 9m)
        var sa = i * Math.PI * 2 / 3, sx = Math.sin(sa) * 9, sz = -Math.cos(sa) * 9;
        cyl(T3, g, m.alloy, 0.9, 1.2, 1.6, sx, 0.8, sz, 10);
        var core3 = cyl(T3, g, m.glow, 0.4, 0.4, 1.2, sx, 2.2, sz, 8); o.sway.push(core3); (o.seeds = o.seeds || []).push(core3);
      }
    }
    live[s.id] = o;                                                                                              // 움직이는 조각(spin·sway·blink) — anim 이 돌린다
    return o;
  }
  /** ⑲-49 사당 위 먹구름 덩이 아홉 — 24장 방울을 다 울리기 전까지 */
  function buildCover(T3) {
    var g = new T3.Group(), mat = new T3.MeshBasicMaterial({ color: 0x2b2a38, transparent: true, opacity: 0.6, depthWrite: false });
    for (var i = 0; i < 9; i++) {
      var a = i * 2.39996, r = i ? 5 + (i % 3) * 3.5 : 0, s = 5 + (i % 4) * 1.3;
      var puff = new T3.Mesh(new T3.SphereGeometry(s, 12, 8), mat); puff.scale.y = 0.55;
      puff.position.set(Math.cos(a) * r, 8 + (i % 3) * 1.8, Math.sin(a) * r); g.add(puff);
    }
    return g;
  }
  function buildDraft(T3, h) {
    var m = M(T3), g = new T3.Group();
    var col = new T3.Mesh(new T3.CylinderGeometry(DRAFT_R, DRAFT_R, h, 20, 1, true), m.draft); col.position.y = h / 2; g.add(col);
    for (var i = 0; i < 4; i++) { var ring = new T3.Mesh(new T3.TorusGeometry(DRAFT_R * 0.9, 0.08, 4, 32), m.ring); ring.rotation.x = Math.PI / 2; ring.userData.k = i / 4; g.add(ring); }
    g.userData.h = h;
    return g;
  }
  function paint(dt) {
    clock += dt || 0;
    var w = W3(), p = core().save.player.pos, L = lighthouse();
    var near = !!(w && on() && L && Math.hypot(L.x - p.x, L.y - p.y) < 1800);
    var id;
    if (!near) { if (w) { for (id in fx) { if (fx.hasOwnProperty(id)) { w.removeFx(fx[id].root); } } } fx = {}; live = {}; return; }
    var T3 = w.three();
    if (!T3) { return; }
    isles().forEach(function (s) {
      var o = fx[s.id] || (fx[s.id] = { root: w.addFx(build(T3, s).root) });
      o.root.position.set(s.x, s.top, s.y);
    });
    var sh = isleById('shrine');
    if (sh && !shrineClear()) {
      if (!fx.cover) { fx.cover = { root: w.addFx(buildCover(T3)) }; }
      fx.cover.root.position.set(sh.x, sh.top, sh.y); fx.cover.root.rotation.y = clock * 0.05;
    } else if (fx.cover) { w.removeFx(fx.cover.root); delete fx.cover; }
    var open = drafts(), seen = {};
    open.forEach(function (d) {
      var gy = reliefH(d.x, d.y), S = global.DG.skyIsle, pd = S && S.padAt ? S.padAt(d.x, d.y) : null;
      if (pd) { gy = pd.top; }                                                                                   // 섬 위 기둥은 섬 윗면부터
      var h = d.top - gy, k = 'd:' + d.id;
      seen[k] = true;
      if (!fx[k] || Math.abs(fx[k].root.userData.h - h) > 0.5) { if (fx[k]) { w.removeFx(fx[k].root); } fx[k] = { root: w.addFx(buildDraft(T3, h)) }; }
      fx[k].root.position.set(d.x, gy, d.y);
      fx[k].root.children.forEach(function (mm, i) {
        if (!i) { mm.material.opacity = 0.12 + Math.sin(clock * 2.4) * 0.04; return; }
        var kk = (mm.userData.k + clock * 0.35) % 1; mm.position.y = kk * h;
      });
    });
    for (id in fx) { if (fx.hasOwnProperty(id) && id.indexOf('d:') === 0 && !seen[id]) { w.removeFx(fx[id].root); delete fx[id]; } }
    anim(dt);
  }
  /* 움직이는 조각 — build 가 섬마다 남긴 목록(spin·sway·blink) */
  function anim(dt) {
    Object.keys(live).forEach(function (k) {
      var o = live[k];
      o.spin.forEach(function (n) { n.rotation.x += (dt || 0) * 0.6; });
      if (o.prop) { var liveP = wreckLive(); o.prop.rotation.x += (dt || 0) * (liveP ? 6 : 0); o.lamp.visible = liveP || Math.sin(clock * 4) > 0.6; }
      o.sway.forEach(function (n, i) { n.rotation.z = Math.sin(clock * 1.6 + i) * 0.25; });
      if (o.blink) { o.blink.visible = Math.sin(clock * 3) > 0; }
      if (o.seeds) { o.seeds.forEach(function (n, i) { n.visible = !seederOff(i); }); }   // ⑲-51 끈 장치는 먹구름 알(코어)이 식는다
    });
  }
  var acc = 0;
  function tick(dt) {
    if (!core() || !core().save) { return; }
    acc += dt || 0;
    if (acc >= 0.25) {
      acc = 0;
      var LF = global.DG.landform, S = global.DG.skyIsle, p = core().save.player.pos;
      if (on() && LF && LF.onSky && LF.onSky() && S && S.padAt) {
        var pd = S.padAt(p.x, p.y);
        if (pd && pd.id.indexOf('sr_') === 0) { discoverOn(pd.id.slice(3)); }
      }
    }
    if (!global.DG_NO_DRAW) { paint(dt); } else { fx = {}; live = {}; }
  }

  global.DG = global.DG || {};
  global.DG.skyRoute = {
    ISLES: ISLES, GAP: GAP, LIGHT_DRAFT: LIGHT_DRAFT, DRAFT_R: DRAFT_R, DRAFT_IN: DRAFT_IN, DRAFT_OVER: DRAFT_OVER, DRAFT_RISE: DRAFT_RISE, DRAFT_CH: DRAFT_CH,
    REWARD: REWARD, PARTS: PARTS,
    SHRINE_CH: SHRINE_CH, SHRINE_CLEAR: SHRINE_CLEAR, shrineClear: shrineClear, WRECK_CH: WRECK_CH, WRECK_LIVE: WRECK_LIVE, wreckLive: wreckLive, ORBIT_CH: ORBIT_CH, SEED_OFF_FROM: SEED_OFF_FROM, seederOff: seederOff,
    on: on, isles: isles, isleById: isleById, pads: pads, draftSpots: draftSpots, drafts: drafts, spot: spot, found: found, discoverOn: discoverOn, marks: marks, tick: tick,
    _resetForTest: function () { fx = {}; live = {}; acc = 0; }
  };
})(window);
