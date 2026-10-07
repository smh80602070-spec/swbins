/**
 * 탈것 — 말을 타고 달리고 날개로 난다 (PLAN §5 탈것 T1·T2, SAGA-DESIGN §15 "탈것·비행" 다섯 판 공통 방향의 사가종횡판 = 메이플식 횡스크롤)
 * ---------------------------------------------------------------
 *   얻기    모험 레벨이 되면(농마 4·갈색 말 12·흰 말 22·학 16·푸른 용 30) 또는 그 펫을 도감에 등록했으면 쓸 수 있다
 *   타기    H = 타고 내리기(단추 🐎) · Shift+H = 다른 탈것으로 고르기. 사냥터·마을 안에서만
 *   지상    걷는 속도 ×mul · 점프 ×jump(말)
 *   비행    kind 'fly' — 날개 탈것은 중력이 ×0.22 로 가볍고(낙하 속도 상한 140) **공중에서도 점프(Space)를 다시 누르면 날갯짓**으로 솟는다(0.16초 쉼).
 *           맨 위 천장(20)에서 멎는다. **보스가 있는 사냥터에선 못 난다**(걷는 배율만 — 보스전은 땅에서)
 *   내림    공격·무예(J·1~8)를 쓰면 · 맞으면 · 자동 사냥이 켜지면 · 줄을 잡으면 · 이야기·대화 · 사냥터를 떠나면 저절로 내린다(메이플의 "탈것 위에선 못 싸운다"를 이 판에 맞춘 것)
 * 판정 층(`unlocked`·`speedMul`·`jumpMul`·`gravMul`)은 순수(세이브·레벨만 읽는다). 세이브 \`save.mount = { sel }\` 한 칸 — 탄 채는 저장 안 함.
 * 손잡이 \`mount.on\` 0 이면 다 사라진다. 그림은 side-view3d(모델 \`critter:*\`)·side-view(2D 이모지).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('mount.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function SD() { return global.DG.side; }
  function toast(msg) { if (core() && core().emit) { core().emit('toast', msg); } }

  /* ── 표 ─────────────────────────────────────────────── */
  /** model = 3D 몸 키(asset3d `critter:*`) · pet = 도감 펫 id · lv = 모험 레벨 문턱 · mul = 걷는 속도 배율 · jump = 점프 배율 */
  var MOUNTS = [
    { id: 'mt_farm',  name: '농마',    model: 'critter:horse_farm',  pet: 'pt_horse_farm',  lv: 4,  mul: 1.35, jump: 1.06, kind: 'ground', emoji: '🐴' },
    { id: 'mt_brown', name: '갈색 말', model: 'critter:horse',       pet: 'pt_horse',       lv: 12, mul: 1.55, jump: 1.10, kind: 'ground', emoji: '🐎' },
    { id: 'mt_white', name: '흰 말',   model: 'critter:white_horse', pet: 'pt_white_horse', lv: 22, mul: 1.75, jump: 1.14, kind: 'ground', emoji: '🐎' },
    { id: 'mt_crane', name: '학',      model: 'critter:crane',       pet: 'pt_crane',       lv: 16, mul: 1.25, jump: 1,    kind: 'fly', emoji: '🕊️' },
    { id: 'mt_dragon', name: '푸른 용', model: 'critter:cheongryong', pet: 'pt_cheongryong', lv: 30, mul: 1.5,  jump: 1,    kind: 'fly', emoji: '🐉' }
  ];
  var FLY_GRAV = 0.22, FLY_FALL = 140, FLAP_VY = 0.8, FLAP_CD = 0.16, CEIL_Y = 20;   // 날개 탈것 — 중력 배율 · 낙하 속도 상한 · 날갯짓 세기(점프 대비)·쉼 · 천장

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
  /** 고른 탈것 — 안 골랐거나 못 쓰면 쓸 수 있는 지상 탈것 중 가장 빠른 것 */
  function selected() {
    var U = unlocked(), sel = def(sv().sel);
    if (sel && isUnlocked(sel)) { return sel; }
    var G = U.filter(function (m) { return !isFly(m); });
    return G.length ? G[G.length - 1] : (U.length ? U[0] : null);
  }

  /* ── 상태(런타임 — 저장 안 함) ──────────────────────── */
  var riding = null, flapT = 0;
  function active() { return !!riding; }
  function current() { return riding; }
  function run() { var S = SD(); return S && S.active && S.active() ? S.raw() : null; }
  function bossHere() { var r = run(); return !!(r && (r.boss || (r.enemies || []).some(function (e) { return e.boss; }))); }
  /** 지금 나는 중인가 — 날개 탈것이고, 보스가 없고, 줄에 안 매달렸다 */
  function flying() { var r = run(); return !!riding && isFly(riding) && !!r && !r.player.climb && !bossHere(); }
  function canRide() {
    var r = run();
    if (!on()) { return { ok: false, why: '탈것이 꺼져 있다' }; }
    if (!selected()) { return { ok: false, why: '아직 탈것이 없다 — 레벨 ' + MOUNTS[0].lv + ' 에 첫 말이 열린다' }; }
    if (!r) { return { ok: false, why: '사냥터·마을 안에서만 탈 수 있다' }; }
    if (r.talk) { return { ok: false, why: '대화 중엔 못 탄다' }; }
    if (r.player.climb) { return { ok: false, why: '줄에 매달린 채로는 못 탄다' }; }
    var A = global.DG.auto;
    if (A && A.active && A.active()) { return { ok: false, why: '자동 사냥 중엔 못 탄다' }; }
    return { ok: true };
  }
  function ride(id) {
    if (id) { var m = def(id); if (!m || !isUnlocked(m)) { return { ok: false, why: '아직 못 쓰는 탈것' }; } sv().sel = id; }
    var c = canRide();
    if (!c.ok) { toast('🐎 ' + c.why); return c; }
    riding = selected(); flapT = 0;
    core().emit('mount:ride', { id: riding.id });
    toast('🐎 ' + riding.name + '에 올라탔다 — ' + (isFly(riding) ? '점프를 거듭 눌러 난다' : '이동 ×' + riding.mul + ' · 점프 ×' + riding.jump) + ' (H 로 내림 · 공격하면 내린다)');
    return { ok: true, mount: riding };
  }
  function dismount(msg) {
    if (!riding) { return false; }
    var was = riding; riding = null; flapT = 0;
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
    if (riding) { riding = nx; flapT = 0; }
    toast('🐎 ' + nx.name + (isFly(nx) ? ' (날개 — 점프를 거듭 눌러 난다)' : ' (×' + nx.mul + ')'));
    core().persist();
    return nx;
  }

  /* ── side.js 가 읽는 값 ─────────────────────────────── */
  function speedMul() { return riding ? K('mul', 1) * riding.mul : 1; }
  function jumpMul() { return riding && !isFly(riding) ? riding.jump : 1; }
  function gravMul() { return flying() ? FLY_GRAV : 1; }
  /** 낙하 속도 상한 — 날개 탈것이 뜬 동안만 걸린다(그 밖엔 무한) */
  function fallCap() { return flying() ? FLY_FALL : Infinity; }
  /** 공중에서 점프를 누르면 날갯짓 — 했으면 true. p = 플레이어(vy 를 위로 준다) */
  function flap(p, jumpV) {
    if (!flying() || flapT > 0) { return false; }
    p.vy = -jumpV * FLAP_VY; p.onGround = false; flapT = FLAP_CD;
    core().emit('mount:flap', {});
    return true;
  }
  /** 천장 — 날개 탈것이 뜬 동안 위로 못 나간다 */
  function ceil(p) { if (flying() && p.y < CEIL_Y) { p.y = CEIL_Y; if (p.vy < 0) { p.vy = 0; } } }
  /** 공격·무예를 쓰면 내린다 / 맞으면 내린다 */
  function onAttack() { return dismount('싸우려고 내렸다'); }
  function onHurt() { return dismount('맞아서 내렸다'); }

  function step(dt) {
    if (flapT > 0) { flapT = Math.max(0, flapT - (dt || 0)); }
    if (!riding) { return; }
    var r = run();
    if (!on() || !r) { dismount(null); return; }
    if (r.talk) { dismount('내렸다'); return; }
    var A = global.DG.auto;
    if (A && A.active && A.active()) { dismount('자동 사냥이라 내렸다'); return; }
    if (r.player.climb && !isFly(riding)) { dismount('줄을 잡아 내렸다'); return; }
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
    btn.classList.toggle('show', on() && touch && !!run() && !!selected());
    btn.classList.toggle('riding', !!riding);
  }
  function frame(dt) { step(dt); paint(); }

  global.DG = global.DG || {};
  global.DG.mount = {
    MOUNTS: MOUNTS, FLY_GRAV: FLY_GRAV, FLY_FALL: FLY_FALL, FLAP_VY: FLAP_VY, FLAP_CD: FLAP_CD, CEIL_Y: CEIL_Y,
    on: on, def: def, isFly: isFly, isUnlocked: isUnlocked, unlocked: unlocked, selected: selected, canRide: canRide,
    ride: ride, dismount: dismount, toggle: toggle, cycle: cycle, active: active, current: current, flying: flying,
    speedMul: speedMul, jumpMul: jumpMul, gravMul: gravMul, fallCap: fallCap, flap: flap, ceil: ceil, onAttack: onAttack, onHurt: onHurt,
    step: step, paint: paint, frame: frame,
    _resetForTest: function () { riding = null; flapT = 0; }
  };
})(window);
