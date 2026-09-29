/**
 * 탈것 — 말을 타고 달린다 (PLAN §5 ⑲-61, SAGA-DESIGN §12 "탈것·비행", 다섯 판 공통 방향의 사가고 첫 조각)
 * ---------------------------------------------------------------
 *   얻기    모험 레벨이 되면(농마 5·갈색 말 15·흰 말 30) 또는 그 말을 도감에 등록했으면(길들인 말 = `dex.pets`) 쓸 수 있다
 *   타기    H = 타고 내리기(단추 🐎) · Shift+H = 다른 말로 고르기. 키보드 판만(GPS 판은 실제 걸음이라 탈것이 없다)
 *   효과    걷는 속도 × MOUNT.mul(농마 1.6·갈색 말 1.85·흰 말 2.1). 달리기(Shift) 배율은 그대로 겹친다
 *   내림    싸움이 붙으면(들판 전투 교전·조우) · 뛰거나 날개를 펴면 · 기둥·벽을 붙잡거나 섬 위·다른 층이면 · GPS 판이면 저절로 내린다
 *   그림    world3d 가 말을 배우로 세우고(`petRef`) 나는 그 위에 얹힌다(`RIDER_LIFT`·`SCALE`, 인물 키 기준 배율)
 * 비행    ⑲-62 T2 — 학(레벨 20)·푸른 용(40)은 날 수 있다(kind 'fly'). Space 누르고 있으면 오르고 Z 누르고 있으면 내린다(터치 ▲▼), 손 떼면 그 높이에 떠 있다.
 *         높이 alt(지면 위 m)는 ceil 까지. 땅에선 걷는 속도 mul, 2m 넘게 뜨면 fly 배율(더 빠름) · 집·담(지붕 6m 넘게)은 넘고 강·산 오르막 감속은 없다.
 *         **이야기 임무 중엔 못 난다**(오르기·섬·배·따라가기·쫓기·보스·지키기·무리 단계) — 떠 있다가 그런 단계가 되면 천천히 내려 내린다. 싸움이 붙으면 그 자리서 내린다
 * 판정 층(`unlocked`·`canRide`·`speedMul`)은 순수(세이브·레벨만 읽는다). 세이브 `save.mount = { sel }` 한 칸 — 탄 채로는 저장하지 않는다
 * (새로 열면 내린 채). 손잡이 `mount.on` 0 이면 다 사라진다. 비행 탈것은 다음 조각(같은 카탈로그에 kind: 'fly').
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('mount.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }

  /* ── 표 ─────────────────────────────────────────────── */
  /** 탈것 목록 — pet = 3D 몸(도감 펫 id) · lv = 모험 레벨 문턱 · mul = 걷는 속도 배율 */
  var MOUNTS = [
    { id: 'mt_farm',  name: '농마',      pet: 'pt_horse_farm',  lv: 5,  mul: 1.6,  kind: 'ground', desc: '짐 나르던 튼튼한 말 — 첫 탈것' },
    { id: 'mt_brown', name: '갈색 말',   pet: 'pt_horse',       lv: 15, mul: 1.85, kind: 'ground', desc: '발 빠른 갈색 말' },
    { id: 'mt_white', name: '흰 말',     pet: 'pt_white_horse', lv: 30, mul: 2.1,  kind: 'ground', desc: '바람처럼 달리는 흰 말' },
    /* ⑲-62 비행 탈것 — fly = 뜬 동안 걷는 속도 배율 · ceil = 오를 수 있는 높이(m) */
    { id: 'mt_crane', name: '학',        pet: 'pt_crane',       lv: 20, mul: 1.5,  kind: 'fly', fly: 2.6, ceil: 40, desc: '긴 날개로 낮게 나는 학' },
    { id: 'mt_dragon', name: '푸른 용',  pet: 'pt_cheongryong', lv: 40, mul: 1.7,  kind: 'fly', fly: 3.4, ceil: 70, desc: '구름 위까지 오르는 푸른 용' }
  ];
  var RISE = 10, FALL = 14, AIR_MIN = 2, ROOF_H = 6, LAND_RATE = 14;      // 오르는·내리는 속도(m/초) · 뜬 것으로 치는 높이 · 지붕을 넘는 높이 · 이야기 구간에서 내려오는 속도
  var BLOCK_TYPES = { sky: 1, climb: 1, sail: 1, follow: 1, chase: 1, duel: 1, defend: 1, kill: 1 };   // 날면 안 되는 이야기 단계 종류
  var SCALE = 0.95, RIDER_LIFT = 0.5;       // 말 몸 배율·나를 얹는 높이(둘 다 배우 키 h 기준)

  /* ── 판정(순수) ─────────────────────────────────────── */
  function def(id) { for (var i = 0; i < MOUNTS.length; i++) { if (MOUNTS[i].id === id) { return MOUNTS[i]; } } return null; }
  function level() { var p = core().save && core().save.player; return (p && p.level) || 1; }
  function hasPet(pet) { var d = core().save && core().save.dex; return !!(d && d.pets && d.pets[pet]); }
  /** 이 탈것을 쓸 수 있나 — 레벨이 됐거나 그 말을 도감에 등록했으면 */
  function isUnlocked(m) { return !!m && (level() >= m.lv || hasPet(m.pet)); }
  function unlocked() { return MOUNTS.filter(isUnlocked); }
  function sv() {
    var s = core().save;
    if (!s.mount || typeof s.mount !== 'object') { s.mount = {}; }
    if (typeof s.mount.sel !== 'string' || !def(s.mount.sel)) { s.mount.sel = ''; }
    return s.mount;
  }
  /** 고른 탈것 — 안 골랐거나 못 쓰면 쓸 수 있는 것 중 가장 빠른 것 */
  function selected() {
    var U = unlocked(), sel = def(sv().sel);
    if (sel && isUnlocked(sel)) { return sel; }
    var G = U.filter(function (m) { return m.kind === 'ground'; });
    return G.length ? G[G.length - 1] : (U.length ? U[0] : null);      // 안 골랐으면 지상 탈것 중 가장 빠른 것(비행은 Shift+H 로 고른다)
  }

  /* ── 상태(런타임 — 저장 안 함) ──────────────────────── */
  var riding = null;                          // 탄 탈것 정의 또는 null
  var alt = 0, lift = 0;                      // ⑲-62 뜬 높이(지면 위 m) · 오르내림 입력(-1 내림·0 멈춤·1 오름)
  function isFly(m) { return !!m && m.kind === 'fly'; }
  function flying() { return !!riding && isFly(riding) && alt >= AIR_MIN; }
  function altitude() { return riding ? alt : 0; }
  /** 이야기가 날기를 막는 단계인가 */
  function storyBlocks() {
    var S = global.DG.story, st = S && S.on && S.on() && S.step ? S.step() : null;
    return !!(st && BLOCK_TYPES[st.type]);
  }
  /** 지붕·담을 넘을 만큼 높이 떴나 — world.js 가 벽 판정을 건너뛴다 */
  function overRoofs() { return !!riding && isFly(riding) && alt >= ROOF_H; }
  function active() { return !!riding; }
  function current() { return riding; }
  function keyMode() { var W = global.DG.world; return !!(W && W.mode === 'keyboard'); }
  function LF() { var l = global.DG.landform; return l && l.on && l.on() ? l : null; }
  function FCs() { var F = global.DG.fieldCombat; return F && F.state && F.state() ? F : null; }
  function fighting() {
    var F = FCs(), p = core().save.player.pos;
    if (!F) { return false; }
    var S = F.state();
    return !!(F.inCombat && F.inCombat(S, p.x, p.y));
  }
  function busy() {
    var enc = global.DG.encounter, du = global.DG.duel;
    return !!((enc && enc.active) || (du && du.active && du.active()));
  }
  /** 지금 탈 수 있나 — { ok, why } */
  function canRide() {
    if (!on()) { return { ok: false, why: '탈것이 꺼져 있다' }; }
    if (!selected()) { return { ok: false, why: '아직 탈것이 없다 — 모험 레벨 ' + MOUNTS[0].lv + ' 에 첫 말이 열린다' }; }
    if (!keyMode()) { return { ok: false, why: 'GPS 판은 실제 걸음이라 탈것이 없다' }; }
    var l = LF();
    if (l && (l.onPole() || l.gliding() || l.airH() > 0 || l.onSky())) { return { ok: false, why: '지금은 탈 수 없다(오르는 중·공중·섬 위)' }; }
    if (fighting() || busy()) { return { ok: false, why: '싸우는 중엔 못 탄다' }; }
    return { ok: true };
  }
  function ride(id) {
    if (id) { var m = def(id); if (!m || !isUnlocked(m)) { return { ok: false, why: '아직 못 쓰는 탈것' }; } sv().sel = id; }
    var c = canRide();
    if (!c.ok) { toast('🐎 ' + c.why); return c; }
    riding = selected(); alt = 0; lift = 0;
    core().emit('mount:ride', { id: riding.id });
    toast('🐎 ' + riding.name + '에 올라탔다 — 걷는 속도 ×' + riding.mul + ' (H 로 내림)');
    return { ok: true, mount: riding };
  }
  function dismount(msg) {
    if (!riding) { return false; }
    var was = riding; riding = null; alt = 0; lift = 0;
    core().emit('mount:dismount', { id: was.id });
    if (msg) { toast('🐎 ' + msg); }
    return true;
  }
  function toggle() { return riding ? (dismount('말에서 내렸다'), { ok: true, mounted: false }) : ride(); }
  /** 다음 탈것으로 — 타고 있으면 그 자리에서 바꾼다 */
  function cycle() {
    var U = unlocked();
    if (!U.length) { return null; }
    var cur = selected(), i = U.indexOf(cur), nx = U[(i + 1) % U.length];
    sv().sel = nx.id;
    if (riding) { if (isFly(riding) && !isFly(nx)) { alt = 0; lift = 0; } riding = nx; }
    toast('🐎 ' + nx.name + ' (×' + (isFly(nx) ? nx.mul + ' · 날면 ×' + nx.fly : nx.mul) + ')');
    core().persist();
    return nx;
  }
  /** world.js 가 곱한다 — 안 탔으면 1 */
  function speedMul() { return riding ? K('mul', 1) * (flying() ? riding.fly : riding.mul) : 1; }
  /** 오르내림 입력 — 키·단추가 준다(1 오름·-1 내림·0 멈춤). 날 수 없으면 무시(이유를 한 번 알린다) */
  function setLift(v) {
    lift = v > 0 ? 1 : (v < 0 ? -1 : 0);
    if (lift > 0 && riding && isFly(riding) && storyBlocks()) { lift = 0; toast('🐎 이야기 임무 중엔 날 수 없다'); }
    if (lift > 0 && (!riding || !isFly(riding))) { lift = 0; }
  }
  /** world3d 가 읽는다 — 말 몸 참조(도감 펫 id)·배율·나를 얹는 높이 */
  function petRef() { return riding ? { id: riding.pet, name: riding.name } : null; }

  var acc = 0;
  /** 높이 한 걸음 — 입력대로 오르내리고, 이야기가 막으면 저절로 내려온다. 매 프레임 */
  function stepAlt(dt) {
    if (!riding || !isFly(riding)) { alt = 0; return; }
    var d = dt || 0;
    if (alt > 0 && storyBlocks()) {
      alt = Math.max(0, alt - LAND_RATE * d);
      if (alt <= 0) { dismount('이야기 임무라 내렸다'); }
      return;
    }
    if (lift > 0) { alt = Math.min(riding.ceil, alt + RISE * d); }
    else if (lift < 0) { alt = Math.max(0, alt - FALL * d); }
  }
  function tick(dt) {
    if (!core() || !core().save) { return; }
    if (!riding) { return; }
    stepAlt(dt);
    if (!riding) { return; }
    acc += dt || 0;
    if (acc < 0.2) { return; }
    acc = 0;
    if (!on()) { dismount(null); return; }
    if (!keyMode()) { dismount('걸음 판이라 내렸다'); return; }
    var l = LF();
    if (l && (l.onPole() || l.gliding() || l.airH() > 0 || l.onSky())) { dismount('말에서 내렸다'); return; }
    if (fighting() || busy()) { dismount('싸움이 붙어 내렸다'); return; }
    if (!isUnlocked(riding)) { dismount(null); }
  }

  var bound = false;
  function bind() {
    if (bound || !global.document) { return; }
    bound = true;
    global.addEventListener('keyup', function (e) {
      if (!riding || !isFly(riding) || !e.key) { return; }
      var k = e.key.toLowerCase();
      if ((k === ' ' && lift > 0) || (k === 'z' && lift < 0)) { setLift(0); }
    });
    global.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) { return; }
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') { return; }
      if (riding && isFly(riding) && e.key && (e.key === ' ' || e.key.toLowerCase() === 'z')) {   // 나는 동안 Space = 오름 · Z = 내림(누르는 동안)
        e.preventDefault(); setLift(e.key === ' ' ? 1 : -1); return;
      }
      if (e.repeat) { return; }
      if (!e.key || e.key.toLowerCase() !== 'h') { return; }
      if (global.document.body.classList.contains('fc-on') && !riding) { /* 들판 전투 중에도 타기는 canRide 가 막는다 */ }
      e.preventDefault();
      if (e.shiftKey) { cycle(); } else { toggle(); }
    });
  }
  var btn = null, liftEl = null;
  function paint() {
    if (!global.document || !global.document.body) { return; }
    bind();
    if (!btn) {
      btn = global.document.createElement('button');
      btn.id = 'mt-ride'; btn.type = 'button'; btn.setAttribute('aria-label', '말 타기');
      btn.innerHTML = '<span>🐎</span><em>말</em>';
      btn.addEventListener('pointerdown', function (e) { e.preventDefault(); toggle(); });
      global.document.body.appendChild(btn);
    }
    var touch = !!(('ontouchstart' in global) || (global.navigator && global.navigator.maxTouchPoints > 0));
    btn.classList.toggle('show', on() && keyMode() && touch && !!selected() && !global.document.body.classList.contains('fc-on'));
    btn.classList.toggle('riding', !!riding);
    if (!liftEl) {
      liftEl = global.document.createElement('div');
      liftEl.id = 'mt-lift';
      liftEl.innerHTML = '<button type="button" data-l="1" aria-label="오르기">▲</button><em></em><button type="button" data-l="-1" aria-label="내리기">▼</button>';
      Array.prototype.forEach.call(liftEl.querySelectorAll('button'), function (b) {
        b.addEventListener('pointerdown', function (e) { e.preventDefault(); setLift(+b.getAttribute('data-l')); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { setLift(0); }); });
      });
      global.document.body.appendChild(liftEl);
    }
    var showLift = on() && keyMode() && touch && !!riding && isFly(riding);
    liftEl.classList.toggle('show', showLift);
    if (showLift) { liftEl.querySelector('em').textContent = Math.round(alt) + 'm'; }
  }
  function frame(dt) { tick(dt); if (!global.DG_NO_DRAW) { paint(); } }

  global.DG = global.DG || {};
  global.DG.mount = {
    MOUNTS: MOUNTS, SCALE: SCALE, RIDER_LIFT: RIDER_LIFT,
    on: on, def: def, isUnlocked: isUnlocked, unlocked: unlocked, selected: selected, canRide: canRide,
    ride: ride, dismount: dismount, toggle: toggle, cycle: cycle, active: active, current: current, speedMul: speedMul, petRef: petRef,
    RISE: RISE, FALL: FALL, AIR_MIN: AIR_MIN, ROOF_H: ROOF_H, BLOCK_TYPES: BLOCK_TYPES,
    isFly: isFly, flying: flying, altitude: altitude, overRoofs: overRoofs, storyBlocks: storyBlocks, setLift: setLift,
    tick: frame, step: tick,
    _resetForTest: function () { riding = null; acc = 0; alt = 0; lift = 0; }
  };
})(window);
