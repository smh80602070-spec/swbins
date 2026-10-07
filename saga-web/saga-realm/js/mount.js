/**
 * 명마·비행 — 장수에게 말을 얹고, 국토를 날아 둘러본다 (PLAN 탈것, SAGA-DESIGN §15 "탈것·비행" 다섯 판 공통 방향의 사가천하판 = 코에이식 경영)
 * ---------------------------------------------------------------
 *   얻기    다스리는 성이 늘면 열린다 — 농마 2성·갈색 말 4성·흰 말 7성 · 학 5성·푸른 용 9성(또는 그 펫을 도감에 등록했으면)
 *   명마    kind 'ground' — **장수에게 장착**한다(장수 카드의 🐎 단추). 한 필은 한 사람만, 한 사람은 한 필만.
 *           그 장수가 든 부대는 **땅 위 싸움**(수전 ✕)에서 부대의 힘이 ×mul(1.03·1.06·1.10) — armyPower 가 곱한다.
 *           3D 전장에서는 그 군이 더 빨리 달려 붙는다(돌격 배율 = 1 + (mul-1)×3, battle3d 가 읽는다).
 *           우리 세력 장수만 — 떠나거나 죽으면 말은 저절로 마구간(비장착)으로 돌아온다
 *   비행    kind 'fly' — 경영 판이라 싸움에는 안 쓴다. **국토 3D 지도의 둘러보기 카메라**만 바꾼다:
 *           H = 날기/내리기(지도 위 단추 🕊️) · Shift+H = 학·용 고르기. 나는 동안 카메라가 낮게 기울고 이동이 ×fly 로 빨라진다
 * 판정 층(`unlocked`·`powerMul`·`chargeOf`)은 순수(세이브·성 수만 읽는다). 세이브 `save.mount = { sel, eq:{장수id:탈것id} }` — 나는 상태는 저장 안 함.
 * 손잡이 `mount.on` 0 이면 다 사라진다(장착도 효과가 없다).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('mount.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function toast(msg) { if (core() && core().emit) { core().emit('toast', msg); } }
  function R() { return global.DG.rtk || null; }
  function OF() { return global.DG.off || null; }

  /* ── 표 ─────────────────────────────────────────────── */
  /** lv = 다스리는 성 수 문턱 · mul = 땅 싸움에서 부대 힘 배율(명마) · fly = 나는 동안 지도 이동 배율(비행) */
  var MOUNTS = [
    { id: 'mt_farm',   name: '농마',    pet: 'pt_horse_farm',  lv: 2, mul: 1.03, kind: 'ground', emoji: '🐴' },
    { id: 'mt_brown',  name: '갈색 말', pet: 'pt_horse',       lv: 4, mul: 1.06, kind: 'ground', emoji: '🐎' },
    { id: 'mt_white',  name: '흰 말',   pet: 'pt_white_horse', lv: 7, mul: 1.10, kind: 'ground', emoji: '🐎' },
    { id: 'mt_crane',  name: '학',      pet: 'pt_crane',       lv: 5, mul: 1,    kind: 'fly', fly: 1.7, emoji: '🕊️' },
    { id: 'mt_dragon', name: '푸른 용', pet: 'pt_cheongryong', lv: 9, mul: 1,    kind: 'fly', fly: 2.4, emoji: '🐉' }
  ];
  var CHARGE_K = 3;                    // 돌격 속도 = 1 + (mul-1) × CHARGE_K
  var FLY_PITCH = 0.34, FLY_DIST = 130;   // 나는 동안 카메라 기울기(라디안)·거리

  /* ── 판정(순수) ─────────────────────────────────────── */
  function def(id) { for (var i = 0; i < MOUNTS.length; i++) { if (MOUNTS[i].id === id) { return MOUNTS[i]; } } return null; }
  function isFly(m) { return !!m && m.kind === 'fly'; }
  function cityCount() {
    try {
      var r = R(); if (!r || !r.state || !r.me) { return 0; }
      var st = r.state(); if (!st || !st.cities) { return 0; }
      return r.citiesOf(r.me()).length;
    } catch (e) { return 0; }
  }
  function hasPet(pet) { var d = core().save && core().save.dex; return !!(d && d.pets && d.pets[pet]); }
  function isUnlocked(m) { return !!m && (cityCount() >= m.lv || hasPet(m.pet)); }
  function unlocked() { return MOUNTS.filter(isUnlocked); }
  function sv() {
    var s = core().save;
    if (!s.mount || typeof s.mount !== 'object') { s.mount = {}; }
    if (typeof s.mount.sel !== 'string' || !def(s.mount.sel)) { s.mount.sel = ''; }
    if (!s.mount.eq || typeof s.mount.eq !== 'object') { s.mount.eq = {}; }
    return s.mount;
  }
  /** 비행 탈것 고르기 — 저장된 것이 열려 있으면 그것, 아니면 열린 것 중 가장 빠른 것 */
  function selected() {
    var F = unlocked().filter(isFly), sel = def(sv().sel);
    if (sel && isFly(sel) && isUnlocked(sel)) { return sel; }
    return F.length ? F[F.length - 1] : null;
  }

  /* ── 명마(장착) ─────────────────────────────────────── */
  /** 이 장수가 우리 세력이고 살아 있나 — 아니면 말이 효과를 못 낸다 */
  function mine(officerId) {
    var r = R(), o = OF();
    try { return !!(r && o && o.has(officerId) && o.rec(officerId).force === r.me() && !o.rec(officerId).dead); } catch (e) { return false; }
  }
  /** 이 장수가 탄 명마(땅 탈것) 정의 — 없거나 못 쓰면 null */
  function mountOf(officerId) {
    if (!on() || !officerId) { return null; }
    var id = sv().eq[officerId], m = id ? def(id) : null;
    if (!m || isFly(m) || !isUnlocked(m) || !mine(officerId)) { return null; }
    return m;
  }
  function riderOf(mountId) {
    var eq = sv().eq, k;
    for (k in eq) { if (Object.prototype.hasOwnProperty.call(eq, k) && eq[k] === mountId) { return k; } }
    return null;
  }
  /** 이 장수에게 쓸 수 있는 명마 목록 — 열려 있고 다른 사람이 안 탄 것(자기가 탄 것 포함) */
  function freeFor(officerId) {
    return unlocked().filter(function (m) { return !isFly(m) && (!riderOf(m.id) || riderOf(m.id) === officerId); });
  }
  function equip(officerId, mountId) {
    if (!on()) { return { ok: false, why: '탈것이 꺼져 있다' }; }
    if (!mine(officerId)) { return { ok: false, why: '우리 세력 장수만 말을 탄다' }; }
    var s = sv();
    if (!mountId) { if (!s.eq[officerId]) { return { ok: false, why: '탄 말이 없다' }; } delete s.eq[officerId]; core().persist(); return { ok: true, mount: null }; }
    var m = def(mountId);
    if (!m || isFly(m)) { return { ok: false, why: '장수에게 얹는 건 명마뿐이다' }; }
    if (!isUnlocked(m)) { return { ok: false, why: '아직 못 쓰는 말 — 다스리는 성 ' + m.lv + '곳이 되면 열린다' }; }
    var other = riderOf(m.id);
    if (other && other !== officerId) { return { ok: false, why: '이미 다른 장수가 탄 말이다' }; }
    s.eq[officerId] = m.id;
    core().persist();
    return { ok: true, mount: m };
  }
  /** 장수 카드의 🐎 단추 — 말 없음 → 쓸 수 있는 다음 말 → … → 말 없음 */
  function cycleEquip(officerId) {
    var cur = sv().eq[officerId] || null, F = freeFor(officerId), i, nx = null;
    if (!F.length) { return { ok: false, why: '쓸 수 있는 말이 없다 — 다스리는 성 ' + MOUNTS[0].lv + '곳이 되면 첫 말이 열린다' }; }
    if (!cur) { nx = F[0]; }
    else { for (i = 0; i < F.length; i++) { if (F[i].id === cur) { nx = F[i + 1] || null; break; } } }
    return equip(officerId, nx ? nx.id : null);
  }
  /** 부대(장수 id 목록)의 가장 좋은 명마 — 땅 싸움에서만. 없으면 null */
  function bestFor(officerIds, water) {
    if (water || !officerIds) { return null; }
    var best = null, i, m;
    for (i = 0; i < officerIds.length; i++) {
      m = mountOf(officerIds[i]);
      if (m && (!best || m.mul > best.m.mul)) { best = { m: m, id: officerIds[i] }; }
    }
    return best;
  }
  /** war.armyPower 가 곱한다 — 안 탔으면 1(예전 계산과 같다) */
  function powerMul(officerIds, water) { var b = bestFor(officerIds, water); return b ? K('mul', 1) * b.m.mul : 1; }
  /** 3D 전장(battle3d)이 읽는다 — 그 군의 돌격 달리기 배율. mountId(문자열) 로 받는다 */
  function chargeOf(mountId) { var m = def(mountId); return m && !isFly(m) && on() ? 1 + (m.mul - 1) * CHARGE_K : 1; }
  /** 싸움 기록 한 줄 — 없으면 '' */
  function note(officerIds, water) {
    var b = bestFor(officerIds, water), o = OF(), h = b && o && o.find ? o.find(b.id) : null;
    return b ? b.m.emoji + ' ' + (h ? h.name : '장수') + '이(가) ' + b.m.name + '을(를) 타고 앞장선다 — 부대의 힘 ×' + b.m.mul : '';
  }
  function bestId(officerIds, water) { var b = bestFor(officerIds, water); return b ? b.m.id : null; }

  /* ── 비행(런타임 — 저장 안 함) ──────────────────────── */
  var riding = null;
  function active() { return !!riding; }
  function current() { return riding; }
  function flying() { return !!riding && isFly(riding); }
  function R3() { return global.DG.realm3d || null; }
  function mapReady() { var r3 = R3(); return !!(r3 && r3.active && r3.active() && r3.setFlight); }
  function canRide() {
    if (!on()) { return { ok: false, why: '탈것이 꺼져 있다' }; }
    if (!selected()) { return { ok: false, why: '아직 날 것이 없다 — 다스리는 성 ' + MOUNTS[3].lv + '곳이 되면 학이 열린다' }; }
    if (!mapReady()) { return { ok: false, why: '3D 국토 지도에서만 난다' }; }
    return { ok: true };
  }
  function applyCam() { var r3 = R3(); if (r3 && r3.setFlight) { r3.setFlight(flying() ? { pan: riding.fly, pitch: FLY_PITCH, dist: FLY_DIST } : null); } }
  function ride(id) {
    if (id) { var m = def(id); if (!m || !isFly(m) || !isUnlocked(m)) { return { ok: false, why: '아직 못 쓰는 탈것' }; } sv().sel = id; }
    var c = canRide();
    if (!c.ok) { toast('🕊️ ' + c.why); return c; }
    riding = selected();
    applyCam();
    core().emit('mount:ride', { id: riding.id });
    toast(riding.emoji + ' ' + riding.name + '을(를) 타고 국토를 난다 — 이동 ×' + riding.fly + ' (H 로 내림)');
    return { ok: true, mount: riding };
  }
  function dismount(msg) {
    if (!riding) { return false; }
    var was = riding; riding = null;
    applyCam();
    core().emit('mount:dismount', { id: was.id });
    if (msg) { toast('🕊️ ' + msg); }
    return true;
  }
  function toggle() { return riding ? (dismount('내렸다'), { ok: true, mounted: false }) : ride(); }
  function cycle() {
    var F = unlocked().filter(isFly);
    if (!F.length) { toast('🕊️ 아직 날 것이 없다'); return null; }
    var cur = selected(), nx = F[(F.indexOf(cur) + 1) % F.length];
    sv().sel = nx.id;
    if (riding) { riding = nx; applyCam(); }
    toast(nx.emoji + ' ' + nx.name + ' (이동 ×' + nx.fly + ')');
    core().persist();
    return nx;
  }
  /** realm3d 가 읽는다 — 안 날면 1 */
  function panMul() { return riding && isFly(riding) ? K('fly', 1) * riding.fly : 1; }

  function step() {
    if (!riding) { return; }
    if (!on()) { dismount(null); return; }
    if (!mapReady()) { dismount(null); return; }        // 2D 지도로 돌아가면 내린다
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
      btn.id = 'mt-ride'; btn.type = 'button'; btn.setAttribute('aria-label', '비행');
      btn.innerHTML = '<span>🕊️</span><em>날기</em>';
      btn.addEventListener('pointerdown', function (e) { e.preventDefault(); toggle(); });
      global.document.body.appendChild(btn);
    }
    btn.classList.toggle('show', on() && mapReady() && !!selected());
    btn.classList.toggle('riding', !!riding);
  }
  function frame() { step(); paint(); }

  global.DG = global.DG || {};
  global.DG.mount = {
    MOUNTS: MOUNTS, CHARGE_K: CHARGE_K, FLY_PITCH: FLY_PITCH, FLY_DIST: FLY_DIST,
    on: on, def: def, isFly: isFly, isUnlocked: isUnlocked, unlocked: unlocked, selected: selected, cityCount: cityCount,
    mountOf: mountOf, riderOf: riderOf, freeFor: freeFor, equip: equip, cycleEquip: cycleEquip,
    bestFor: bestFor, bestId: bestId, powerMul: powerMul, chargeOf: chargeOf, note: note,
    canRide: canRide, ride: ride, dismount: dismount, toggle: toggle, cycle: cycle, active: active, current: current, flying: flying,
    panMul: panMul, step: step, paint: paint, frame: frame,
    _resetForTest: function () { riding = null; }
  };
})(window);
