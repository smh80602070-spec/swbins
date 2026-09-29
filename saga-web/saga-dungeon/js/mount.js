/**
 * 탈것 — 들판·마을을 달리고 날아 넘는다 (PLAN 탈것 T1·T2, SAGA-DESIGN §15 "탈것·비행" 다섯 판 공통 방향의 사가블로판 = 디아블로식 액션)
 * ---------------------------------------------------------------
 *   얻기    모험 레벨이 되면(농마 5·갈색 말 14·흰 말 26 · 학 18·푸른 용 34) 또는 그 펫을 도감에 등록했으면 쓸 수 있다
 *   타기    H = 타고 내리기(단추 🐎) · Shift+H = 다른 탈것으로 고르기. **열린 세계(마을·들판, town.js)에서만** — 던전 방 안에선 못 탄다
 *   지상    걷는 속도 ×mul — 농마 ×1.5·갈색 말 ×1.75·흰 말 ×2.0
 *   비행    kind 'fly' — 학·푸른 용은 **들판의 나무·바위·건물 소품을 넘어** 떠서 간다(fieldBlockedAt 을 건너뜀). ×1.6·×1.9
 *   내림    맞으면 · 적을 치려고 하면(자동 공격이 나갈 때) · 던전에 들어가면 · 자동 전투가 켜지면 · H
 * 판정 층(`unlocked`·`speedMul`·`flying`)은 순수(세이브·레벨만 읽는다). 세이브 \`save.mount = { sel }\` 한 칸 — 탄 채는 저장 안 함. 손잡이 \`mount.on\` 0 이면 다 사라진다.
 * 그림은 dungeon3d(펫 몸 \`pet:*\` 를 발밑에 세우고 나를 등 높이로 — 날개는 뜬 만큼 띄운다).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('mount.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function toast(msg) { if (core() && core().emit) { core().emit('toast', msg); } }

  /* ── 표 ─────────────────────────────────────────────── */
  /** model = 3D 몸 키(asset3d \`pet:*\`) · pet = 도감 펫 id · lv = 모험 레벨 문턱 · mul = 걷는 속도 배율 · fly = 뜬 동안 배율 */
  var MOUNTS = [
    { id: 'mt_farm',  name: '농마',    model: 'pet:horse_farm',  pet: 'pt_horse_farm',  lv: 5,  mul: 1.5,  kind: 'ground', emoji: '🐴' },
    { id: 'mt_brown', name: '갈색 말', model: 'pet:horse',       pet: 'pt_horse',       lv: 14, mul: 1.75, kind: 'ground', emoji: '🐎' },
    { id: 'mt_white', name: '흰 말',   model: 'pet:white_horse', pet: 'pt_white_horse', lv: 26, mul: 2.0,  kind: 'ground', emoji: '🐎' },
    { id: 'mt_crane', name: '학',      model: 'pet:crane',       pet: 'pt_crane',       lv: 18, mul: 1.3,  kind: 'fly', fly: 1.6, emoji: '🕊️' },
    { id: 'mt_dragon', name: '푸른 용', model: 'pet:cheongryong', pet: 'pt_cheongryong', lv: 34, mul: 1.4,  kind: 'fly', fly: 1.9, emoji: '🐉' }
  ];
  var LIFT = 16, HOVER = 22, MOUNT_H = 46, FLY_H = 40;     // 나를 얹는 높이·뜬 높이·말 몸 키·날개 탈것 몸 키(3D 단위)

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

  /* ── 상태(런타임 — 저장 안 함) ──────────────────────── */
  var riding = null;
  function active() { return !!riding; }
  function current() { return riding; }
  function flying() { return !!riding && isFly(riding); }
  /** 열린 세계(마을·들판)에 서 있나 — 던전 방 안은 아니다 */
  function inOpenWorld() { var T = global.DG.town, D = global.DG.dungeon; return !!(T && T.active && T.active()) && !(D && D.active && D.active()); }
  function autoOn() { var A = global.DG.auto; return !!(A && A.active && A.active()); }
  function canRide() {
    if (!on()) { return { ok: false, why: '탈것이 꺼져 있다' }; }
    if (!selected()) { return { ok: false, why: '아직 탈것이 없다 — 레벨 ' + MOUNTS[0].lv + ' 에 첫 말이 열린다' }; }
    if (!inOpenWorld()) { return { ok: false, why: '마을·들판에서만 탈 수 있다(던전 안 ✕)' }; }
    if (autoOn()) { return { ok: false, why: '자동 전투 중엔 못 탄다' }; }
    return { ok: true };
  }
  function ride(id) {
    if (id) { var m = def(id); if (!m || !isUnlocked(m)) { return { ok: false, why: '아직 못 쓰는 탈것' }; } sv().sel = id; }
    var c = canRide();
    if (!c.ok) { toast('🐎 ' + c.why); return c; }
    riding = selected();
    core().emit('mount:ride', { id: riding.id });
    toast('🐎 ' + riding.name + '에 올라탔다 — ' + (isFly(riding) ? '나무·바위 위를 떠서 넘는다' : '걷는 속도 ×' + riding.mul) + ' (맞거나 싸우면 내린다 · H)');
    return { ok: true, mount: riding };
  }
  function dismount(msg) {
    if (!riding) { return false; }
    var was = riding; riding = null;
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
    if (riding) { riding = nx; }
    toast('🐎 ' + nx.name + (isFly(nx) ? ' (떠서 넘는다)' : ' (×' + nx.mul + ')'));
    core().persist();
    return nx;
  }
  /** town.js 가 곱한다 — 안 탔으면 1 */
  function speedMul() { return riding ? K('mul', 1) * (isFly(riding) ? riding.fly : riding.mul) : 1; }
  /** dungeon3d 가 읽는다 — 말 몸(모델 키·키)·나를 얹는 높이(뜬 것은 더) */
  function bodyRef() { return riding ? { id: riding.id, model: riding.model, h: isFly(riding) ? FLY_H : MOUNT_H } : null; }
  function lift() { return riding ? LIFT + (isFly(riding) ? HOVER : 0) : 0; }
  function mountLift() { return riding && isFly(riding) ? HOVER : 0; }
  function onHurt() { return dismount('맞아서 내렸다'); }
  function onAttack() { return dismount('싸우려고 내렸다'); }

  function step() {
    if (!riding) { return; }
    if (!on()) { dismount(null); return; }
    if (!inOpenWorld()) { dismount('던전에 들어가 내렸다'); return; }
    if (autoOn()) { dismount('자동 전투라 내렸다'); return; }
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
    btn.classList.toggle('show', on() && touch && inOpenWorld() && !!selected());
    btn.classList.toggle('riding', !!riding);
  }
  function frame() { step(); paint(); }

  global.DG = global.DG || {};
  global.DG.mount = {
    MOUNTS: MOUNTS, LIFT: LIFT, HOVER: HOVER, MOUNT_H: MOUNT_H, FLY_H: FLY_H,
    on: on, def: def, isFly: isFly, isUnlocked: isUnlocked, unlocked: unlocked, selected: selected, canRide: canRide, inOpenWorld: inOpenWorld,
    ride: ride, dismount: dismount, toggle: toggle, cycle: cycle, active: active, current: current, flying: flying,
    speedMul: speedMul, bodyRef: bodyRef, lift: lift, mountLift: mountLift, onHurt: onHurt, onAttack: onAttack,
    step: step, paint: paint, frame: frame,
    _resetForTest: function () { riding = null; }
  };
})(window);
