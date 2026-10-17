/**
 * 1만리 — 몰래 다가가 포획 (W-0286, 포켓몬 레전드 아르세우스식 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 포획은 타이밍 한 가지였다 → 들판 짐승(world.js 스폰 중 펫)마다 시야 부채꼴(앞 100°·12m).
 *   풀숲(지형 forest) 안이거나 시야 밖(뒤)에서 다가가 포획하면 → 타이밍 창 ×1.6 · 포획 확률 +15%(실전 포획도 +15%)
 *   시야 안에서 움직이면(달리거나, 풀숲 밖에서 걸으면) 들킴 → 겁 많은 종은 달아나 사라지고, 사나운 종(신수·희귀 4 이상)은 덤빈다(3m 안이면 조우)
 *   웅크리기(X · 폰 🫥 단추) — 걸음 ×0.5, 달리기 안 됨, 시야 안에서도 안 들킴
 * 들키지 않은 짐승은 46m 안에서도 나를 돌아보지 않고 제 갈 길을 간다(그래야 "뒤"가 생긴다) — world.js wanderSpawns 의 near 가지.
 *
 *   세이브엔 아무것도 안 남긴다(스폰 칸 s.spotted·s.fleeing·s.charging 은 판 안 상태)
 *   잇기(world.js 1921 상한 — 줄 끝): moveByKeys 걸음 줄 moved() · wanderSpawns for 앞 step() · near 가지 free() · 2D 몸 그림자 줄 mark2d() · 3D syncActors placeActor 줄 mark3d()
 *          encounter.js: startPetTimer 창 ×1.6 · renderPet 안내 · throwFeed·finishPetLive 확률 +0.15
 */
(function (global) {
  'use strict';

  var FOV_DEG = 100, RANGE = 12, ZONE_MUL = 1.6, FIRST_ADD = 0.15, CROUCH_MUL = 0.5, FLEE_SPEED = 7, CHARGE_SPEED = 6, CHARGE_HIT = 3, MOVE_MS = 200;
  var crouch = false, lastMove = 0, lastRun = false;

  function core() { return global.DG.core; }
  function W() { return global.DG.world; }
  function pos() { return core().save.player.pos; }
  function isPet(s) { return !!s && s.kind !== 'hero'; }
  function fierce(s) { var r = s && s.ref; return !!r && (r.kind === 'divine' || (r.rarity || 0) >= 4); }
  /** 플레이어가 풀숲(지형 forest) 안인가 — 지형 칸 48m(world.js 와 같은 칸) */
  function inGrass(p) {
    var WT = global.DG.worldTerrain;
    p = p || pos();
    return !!(WT && WT.terrainAt(Math.floor(p.x / 48), Math.floor(p.y / 48)) === 'forest');
  }
  /** 짐승이 보는 쪽(단위 벡터) — 마지막 걸음 방향, 없으면 facing(좌우) */
  function headingOf(s) {
    var x = s.dirX || 0, y = s.dirY || 0, l = Math.hypot(x, y);
    if (l < 1e-6) { return { x: s.facing === -1 ? -1 : 1, y: 0 }; }
    return { x: x / l, y: y / l };
  }
  /** p 가 s 의 시야 부채꼴(앞 100°·12m) 안인가 */
  function inFov(s, p) {
    p = p || pos();
    var rx = p.x - s.x, ry = p.y - s.y, d = Math.hypot(rx, ry);
    if (d > RANGE) { return false; }
    if (d < 1e-6) { return true; }
    var h = headingOf(s), cos = (h.x * rx + h.y * ry) / d;
    return cos >= Math.cos(FOV_DEG / 2 * Math.PI / 180);
  }
  function crouched() { return crouch; }
  function setCrouch(v) {
    crouch = !!v;
    var b = global.document && global.document.getElementById('st-crouch');
    if (b) { b.classList.toggle('on', crouch); }
    core().emit('toast', crouch ? '🫥 웅크렸다 — 걸음 절반 · 시야 안에서도 안 들킨다' : '🧍 일어섰다');
    return crouch;
  }
  /** moveByKeys 가 걸을 때마다 — 걸음 배율을 돌려주고 움직임을 적어 둔다 */
  function moved(run) { lastMove = Date.now(); lastRun = !!run && !crouch; return crouch ? CROUCH_MUL : 1; }
  function moving() { return Date.now() - lastMove < MOVE_MS; }
  /** 이 움직임이 시야 안에서 들킬 움직임인가 — 웅크리면 안 들킴, 달리면 들킴, 걸으면 풀숲 밖일 때만 */
  function loud(run, p) { if (crouch) { return false; } return !!run || !inGrass(p); }
  /** 판정 — 이 짐승이 지금 나를 알아채나(순수: 진단이 값으로 묻는다) */
  function notices(s, p, isMoving, run) { return isPet(s) && !s.spotted && !!isMoving && loud(run, p) && inFov(s, p); }

  function spot(s, p) {
    var rx = p.x - s.x, ry = p.y - s.y, d = Math.max(0.5, Math.hypot(rx, ry)), nm = s.ref && s.ref.name || '짐승';
    s.spotted = Date.now(); s.pause = 0;
    if (fierce(s)) { s.charging = true; core().emit('toast', '❗ ' + nm + '이(가) 알아챘다 — 덤빈다!'); }
    else { s.fleeing = true; s.tx = s.x - rx / d * 40; s.ty = s.y - ry / d * 40; s.homeX = s.tx; s.homeY = s.ty; core().emit('toast', '❗ ' + nm + '이(가) 알아채고 달아난다'); }
  }
  /** wanderSpawns 머리 — 들킴 판정·달아남·덤빔 */
  function step(dt, spawns, p) {
    if (!spawns || !p) { return; }
    var mv = moving(), gone = [], i, s, dx, dy, d, enc = global.DG.encounter;
    for (i = 0; i < spawns.length; i++) {
      s = spawns[i];
      if (!isPet(s)) { continue; }
      if (notices(s, p, mv, lastRun)) { spot(s, p); }
      if (s.fleeing) {
        dx = s.tx - s.x; dy = s.ty - s.y; d = Math.hypot(dx, dy);
        if (d < 1.5) { gone.push(s.uid); continue; }
        s.x += dx / d * FLEE_SPEED * dt; s.y += dy / d * FLEE_SPEED * dt; s.dirX = dx; s.dirY = dy; s.moving = true; s.phase = (s.phase || 0) + dt * 12;
      } else if (s.charging) {
        dx = p.x - s.x; dy = p.y - s.y; d = Math.hypot(dx, dy);
        if (d <= CHARGE_HIT) { s.charging = false; if (!(enc && global.document && global.document.querySelector('#encounter.show'))) { core().emit('encounter:request', s); } continue; }
        s.x += dx / d * CHARGE_SPEED * dt; s.y += dy / d * CHARGE_SPEED * dt; s.dirX = dx; s.dirY = dy; s.moving = true; s.phase = (s.phase || 0) + dt * 12;
      }
    }
    for (i = 0; i < gone.length; i++) { W().removeSpawn(gone[i]); }
  }
  /** wanderSpawns near 가지 — 들키지 않은(또는 달아나는·덤비는) 짐승은 나를 돌아보지 않는다 */
  function free(s) { return isPet(s) && (!s.spotted || s.fleeing || s.charging); }
  /** 포획 창에 몰래 배율을 주나 — 펫·안 들킴·(풀숲 안 또는 시야 밖) */
  function sneakOf(s, p) { p = p || pos(); return isPet(s) && !s.spotted && (inGrass(p) || !inFov(s, p)); }
  function marked(s) { return !!s && !!s.spotted && Date.now() - s.spotted < 4000; }

  /* ── 들킴 표시 — 머리 위 ❗ ── */
  function mark2d(ctx, s, x, y, h) {
    if (!marked(s)) { return; }
    ctx.save(); ctx.font = 'bold ' + Math.max(14, Math.round(h * 0.55)) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText('!', x, y); ctx.fillStyle = '#ffd23a'; ctx.fillText('!', x, y); ctx.restore();
  }
  var tex3 = null;
  function mark3d(a, s, h) {
    var T = global.THREE;
    if (!T || !a || !a.node) { return; }
    if (!a._stMark) {
      if (!marked(s)) { return; }
      if (!tex3) {
        var c = global.document.createElement('canvas'); c.width = 64; c.height = 64;
        var g = c.getContext('2d'); g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText('!', 32, 34); g.fillStyle = '#ffd23a'; g.fillText('!', 32, 34);
        tex3 = new T.CanvasTexture(c);
      }
      a._stMark = new T.Sprite(new T.SpriteMaterial({ map: tex3, transparent: true, depthTest: false }));
      a._stMark.renderOrder = 999;
      if (a.node.parent) { a.node.parent.add(a._stMark); }
    }
    var on = marked(s);
    a._stMark.visible = on;
    if (on) { a._stMark.position.set(a.node.position.x, a.node.position.y + h * 1.25, a.node.position.z); a._stMark.scale.set(h * 0.45, h * 0.45, 1); }
  }

  /* ── 입력 — X 키·폰 단추 ── */
  if (global.document) {
    global.addEventListener('keydown', function (e) {
      if (e.repeat || (e.key || '').toLowerCase() !== 'x') { return; }
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) { return; }
      if (global.document.body.classList.contains('sheet-open')) { return; }
      setCrouch(!crouch);
    });
    var mount = function () {
      if (global.document.getElementById('st-crouch') || !global.document.body) { return; }
      var b = global.document.createElement('button');
      b.id = 'st-crouch'; b.type = 'button'; b.title = '웅크리기 (X) — 걸음 절반 · 안 들킨다'; b.innerHTML = '🫥';
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); setCrouch(!crouch); });
      global.document.body.appendChild(b);
    };
    if (global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', mount); } else { mount(); }
  }

  global.DG = global.DG || {};
  global.DG.stealth = {
    FOV_DEG: FOV_DEG, RANGE: RANGE, ZONE_MUL: ZONE_MUL, FIRST_ADD: FIRST_ADD, CROUCH_MUL: CROUCH_MUL,
    inGrass: inGrass, headingOf: headingOf, inFov: inFov, crouched: crouched, setCrouch: setCrouch, moved: moved, loud: loud, notices: notices,
    step: step, free: free, sneakOf: sneakOf, marked: marked, fierce: fierce, mark2d: mark2d, mark3d: mark3d,
    _reset: function () { crouch = false; lastMove = 0; lastRun = false; }
  };
})(window);
