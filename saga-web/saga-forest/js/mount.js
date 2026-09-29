/**
 * 탈것 — 마을을 달리고 떠서 건넌다 (PLAN 탈것 T1·T2, SAGA-DESIGN §15 "탈것·비행" 다섯 판 공통 방향의 사가의숲판 = 동물의숲식 구면 마을)
 * ---------------------------------------------------------------
 *   얻기    모험 레벨이 되면(사슴 3·갈색 말 8·흰 말 14 · 학 10·푸른 용 18) 또는 그 펫을 도감에 등록했으면 쓸 수 있다
 *   타기    H = 타고 내리기(단추 🐎) · Shift+H = 다른 탈것으로 고르기. 마을 밖(집·동굴 안 아님)에서만
 *   지상    걷는 속도 ×mul — 사슴 ×1.4·갈색 말 ×1.7·흰 말 ×1.95(달리다 벌레가 놀라 달아난다 — 벌레는 살금살금 걸어야 잡는다)
 *   비행    kind 'fly' — 학·푸른 용은 **마을 위를 낮게 떠서 간다**: 물·바위·나무(걷는 칸이 아닌 곳)를 넘어 섬과 바다를 건넌다(마을 둘레 EDGE_TILES 칸 밖 바다까지).
 *           떠 있는 동안 손이 닿는 일(줍기·말 걸기·낚시·벌레)은 못 한다 — Space(손 뻗기)를 누르면 **먼저 내려앉는다**(물 위였으면 가장 가까운 뭍으로)
 *   내림    Space(상호작용) · 집·동굴 · 낚시 · 배송/축제 손님과 말 걸기 등 손이 필요한 일 · H
 * 판정 층(\`unlocked\`·\`speedMul\`·\`canFly\`)은 순수(세이브·레벨만 읽는다). 세이브 \`save.mount = { sel }\` 한 칸 — 탄 채는 저장 안 함.
 * 손잡이 \`mount.on\` 0 이면 다 사라진다. 그림은 village-view3d(펫 모델을 발밑에 세우고 나를 얹는다)·village-view(2D 이모지).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('mount.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function V() { return global.DG.village || null; }
  function toast(msg) { if (core() && core().emit) { core().emit('toast', msg); } }

  /* ── 표 ─────────────────────────────────────────────── */
  /** pet = 3D 몸(도감 펫 id) · lv = 모험 레벨 문턱 · mul = 걷는 속도 배율 */
  var MOUNTS = [
    { id: 'mt_deer',  name: '사슴',    pet: 'pt_stag',        lv: 3,  mul: 1.4,  kind: 'ground', emoji: '🦌' },
    { id: 'mt_brown', name: '갈색 말', pet: 'pt_horse',       lv: 8,  mul: 1.7,  kind: 'ground', emoji: '🐎' },
    { id: 'mt_white', name: '흰 말',   pet: 'pt_white_horse', lv: 14, mul: 1.95, kind: 'ground', emoji: '🐎' },
    { id: 'mt_crane', name: '학',      pet: 'pt_crane',       lv: 10, mul: 1.5,  kind: 'fly', emoji: '🕊️' },
    { id: 'mt_dragon', name: '푸른 용', pet: 'pt_cheongryong', lv: 18, mul: 1.8,  kind: 'fly', emoji: '🐉' }
  ];
  var EDGE_TILES = 8;                 // 떠서 마을 둘레 이만큼(타일) 밖 바다까지 나갈 수 있다
  var HOVER = 0.9, SCALE = 0.95, RIDER_LIFT = 0.5;   // 뜬 높이·말 몸 배율·나를 얹는 높이(모두 인물 키 PLAYER_H 배수)

  /* ── 판정(순수) ─────────────────────────────────────── */
  function def(id) { for (var i = 0; i < MOUNTS.length; i++) { if (MOUNTS[i].id === id) { return MOUNTS[i]; } } return null; }
  function level() { var p = core().save && core().save.player; return (p && p.level) || 1; }
  function hasPet(pet) { var d = core().save && core().save.dex; return !!(d && d.pets && d.pets[pet]); }
  function isUnlocked(m) { return !!m && (level() >= m.lv || hasPet(m.pet)); }
  function unlocked() { return MOUNTS.filter(isUnlocked); }
  function isFly(m) { return !!m && m.kind === 'fly'; }
  function sv() {
    var s = core().save;
    if (!s.mount || typeof s.mount !== 'object') { s.mount = {}; }
    if (typeof s.mount.sel !== 'string' || !def(s.mount.sel)) { s.mount.sel = ''; }
    return s.mount;
  }
  function selected() {
    var U = unlocked(), sel = def(sv().sel);
    if (sel && isUnlocked(sel)) { return sel; }
    var G = U.filter(function (m) { return !isFly(m); });
    return G.length ? G[G.length - 1] : (U.length ? U[0] : null);
  }
  /** 떠서 이 자리에 갈 수 있나 — 마을(타일 W×H)과 그 둘레 EDGE_TILES 칸 안 */
  function canFly(x, y) {
    var v = V(); if (!v) { return false; }
    var T = v.TILE, w = v.W * T, h = v.H * T, m = EDGE_TILES * T;
    return x > -m && y > -m && x < w + m && y < h + m;
  }

  /* ── 상태(런타임 — 저장 안 함) ──────────────────────── */
  var riding = null;
  function active() { return !!riding; }
  function current() { return riding; }
  function flying() { return !!riding && isFly(riding); }
  function inHouse() { var v = V(); return !!(v && ((v.indoors && v.indoors()) || (v.caveInside && v.caveInside()))); }
  function canRide() {
    var v = V();
    if (!on()) { return { ok: false, why: '탈것이 꺼져 있다' }; }
    if (!selected()) { return { ok: false, why: '아직 탈것이 없다 — 레벨 ' + MOUNTS[0].lv + ' 에 첫 사슴이 열린다' }; }
    if (!v) { return { ok: false, why: '마을이 없다' }; }
    if (inHouse()) { return { ok: false, why: '집·동굴 안에선 못 탄다' }; }
    var raw = v.raw ? v.raw() : null;
    if (raw && raw.fishing) { return { ok: false, why: '낚시 중엔 못 탄다' }; }
    return { ok: true };
  }
  function ride(id) {
    if (id) { var m = def(id); if (!m || !isUnlocked(m)) { return { ok: false, why: '아직 못 쓰는 탈것' }; } sv().sel = id; }
    var c = canRide();
    if (!c.ok) { toast('🐎 ' + c.why); return c; }
    riding = selected();
    core().emit('mount:ride', { id: riding.id });
    toast('🐎 ' + riding.name + '에 올라탔다 — ' + (isFly(riding) ? '마을 위를 떠서 물·나무를 넘는다' : '걷는 속도 ×' + riding.mul) + ' (Space·H 로 내림)');
    return { ok: true, mount: riding };
  }
  function dismount(msg) {
    if (!riding) { return false; }
    var was = riding; riding = null;
    var v = V();
    if (was && isFly(was) && v && v.snapToLand) { v.snapToLand(); }         // 물·바위 위에서 내리면 가장 가까운 뭍으로
    core().emit('mount:dismount', { id: was.id });
    if (msg) { toast('🐎 ' + msg); }
    return true;
  }
  function toggle() { return riding ? (dismount('내렸다'), { ok: true, mounted: false }) : ride(); }
  function cycle() {
    var U = unlocked();
    if (!U.length) { return null; }
    var cur = selected(), nx = U[(U.indexOf(cur) + 1) % U.length];
    sv().sel = nx.id;
    if (riding) { var was = riding; riding = nx; if (isFly(was) && !isFly(nx)) { var v = V(); if (v && v.snapToLand) { v.snapToLand(); } } }
    toast('🐎 ' + nx.name + (isFly(nx) ? ' (마을 위를 뜬다)' : ' (×' + nx.mul + ')'));
    core().persist();
    return nx;
  }
  /** village.js 가 읽는다 */
  function speedMul() { return riding ? K('mul', 1) * riding.mul : 1; }
  /** 손이 필요한 일을 하려 하면 — 먼저 내린다. 내렸으면 true(호출한 쪽은 그대로 이어 한다) */
  function onInteract() { return riding ? dismount('내려서 손을 뻗는다') : false; }
  /** 3D 그림이 읽는다 */
  function petRef() { return riding ? { id: riding.pet, name: riding.name } : null; }

  function step() {
    if (!riding) { return; }
    if (!on()) { dismount(null); return; }
    if (inHouse()) { dismount('집에 들어가 내렸다'); return; }
    var v = V(), raw = v && v.raw ? v.raw() : null;
    if (raw && raw.fishing) { dismount('낚시를 하려고 내렸다'); return; }
    if (!isUnlocked(riding)) { dismount(null); }
  }

  var bound = false;
  function bind() {
    if (bound || !global.document) { return; }
    bound = true;
    global.addEventListener('keydown', function (e) {
      if (e.repeat || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) { return; }
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { return; }
      if (!e.key || e.key.toLowerCase() !== 'h') { return; }
      e.preventDefault();
      if (e.shiftKey) { cycle(); } else { toggle(); }
    });
  }
  var btn = null;
  function paint() {
    if (!global.document || !global.document.body) { return; }
    bind();
    if (!btn) {
      btn = global.document.createElement('button');
      btn.id = 'mt-ride'; btn.type = 'button'; btn.setAttribute('aria-label', '탈것');
      btn.innerHTML = '<span>🐎</span><em>탈것</em>';
      btn.addEventListener('pointerdown', function (e) { e.preventDefault(); toggle(); });
      global.document.body.appendChild(btn);
    }
    var touch = !!(('ontouchstart' in global) || (global.navigator && global.navigator.maxTouchPoints > 0));
    btn.classList.toggle('show', on() && touch && !!selected() && !inHouse());
    btn.classList.toggle('riding', !!riding);
  }
  function frame() { step(); paint(); }

  global.DG = global.DG || {};
  global.DG.mount = {
    MOUNTS: MOUNTS, EDGE_TILES: EDGE_TILES, HOVER: HOVER, SCALE: SCALE, RIDER_LIFT: RIDER_LIFT,
    on: on, def: def, isFly: isFly, isUnlocked: isUnlocked, unlocked: unlocked, selected: selected, canRide: canRide, canFly: canFly,
    ride: ride, dismount: dismount, toggle: toggle, cycle: cycle, active: active, current: current, flying: flying,
    speedMul: speedMul, onInteract: onInteract, petRef: petRef, step: step, paint: paint, frame: frame,
    _resetForTest: function () { riding = null; }
  };
})(window);
