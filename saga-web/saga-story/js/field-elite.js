/**
 * 4종횡 사냥터 엘리트 (W-0429 · 메이플스토리 엘리트 몬스터 — 구조만, 수치는 우리 것)
 * ---------------------------------------------------------------
 * 같은 몹을 오래 잡을수록 터지는 작은 사건(비경 rift.js 의 elite 칸은 균열 지도 안 — 사냥터엔 없었다):
 *   엘리트      같은 사냥터 잡몹 처치 EVERY(300, 손잡이 st.fieldElite.every)마다 주인공 앞에 엘리트 하나
 *               — 그 터 몹을 불림(몸 ×1.6·체력 ×15·피해 ×2, 이름 앞 「엘리트」) · 배경 어두움 + 띠 「엘리트 몬스터가 나타났습니다」
 *               잡으면 전리품 셋(장비 표 보스 몫) · 경험치 ×10
 *   엘리트 보스 그 터 엘리트 셋째를 잡으면 — 그 터 대장 몸(×1.3 → 2.5)·체력 ×40·피해 ×2.5 · BOSS_T(60)초 안 못 잡으면 사라짐 · 경험치 ×25
 *   셈          이번 접속만(모듈 메모리 — 세이브 안 함). 비경·관문 대장·마을 무대는 안 셈
 * side.js 처치(경험치 셈 뒤) onKill(run, fx, e) · 경험치 곱 expMul(e) · update 맨 앞 tick(run, dt)(어두운 막 DOM #elite-dim 도 여기서).
 * 손잡이 st.fieldElite(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var EVERY = 300, ELITE_SZ = 1.6, ELITE_HP = 15, ELITE_DMG = 2, ELITE_EXP = 10, LOOT = 3;
  var BOSS_AFTER = 3, BOSS_SZ = 2.5, BOSS_HP = 40, BOSS_DMG = 2.5, BOSS_EXP = 25, BOSS_T = 60;
  var counts = {};   // 사냥터 key → { kills, elites }

  function core() { return global.DG.core; }
  function K(k, d) { var c = core(); return c && c.tuned ? +c.tuned('st.fieldElite' + (k ? '.' + k : ''), d) : d; }
  function on() { return !!K('', 1); }
  function every() { return Math.max(1, K('every', EVERY)); }
  function allowed(run) { var s = run && run.stage; return !!(s && !s.town && !s.rift && !s.gateArena && !run.rift); }
  function cnt(key) { if (!counts[key]) { counts[key] = { kills: 0, elites: 0 }; } return counts[key]; }
  function alive(run, flag) { return (run.enemies || []).filter(function (e) { return e[flag] && e.hp > 0; })[0] || null; }

  /** 기존 몹 하나를 불린다 — side.spawnEnemy(x, boost) 뒤 몸·이름만 덧입힘 */
  function grow(run, boost, sz, name, ref) {
    var S = global.DG.side, p = run.player, f = p && p.facing < 0 ? -1 : 1;
    var x = Math.max(60, Math.min(((run.stage && run.stage.width) || 2000) - 80, (p ? p.x : 400) + f * 260));
    var e = S && S.spawnEnemy ? S.spawnEnemy(x, boost) : null; if (!e) { return null; }
    var w = Math.round(34 * sz); e.y -= (w - e.h); e.w = w; e.h = w; e.sz = sz; e.rare = false; e.mini = false;
    e.ref = Object.assign({}, ref || e.ref, { name: name + ' ' + (ref || e.ref).name });
    return e;
  }
  function banner(run, fx, head, text) {
    if (fx) { fx.push({ t: 'bossintro', head: head, name: text, x: run.player ? run.player.x : 0, y: 0, life: 1.8 }); }
    var C = core(); if (C && C.emit) { C.emit('toast', head + ' — ' + text); }
  }
  function spawnElite(run, fx) {
    var e = grow(run, { hp: ELITE_HP, dmg: ELITE_DMG }, ELITE_SZ, '엘리트'); if (!e) { return null; }
    e.elite = true; banner(run, fx, '⚠️ 엘리트 몬스터가 나타났습니다', e.ref.name); return e;
  }
  function spawnBoss(run, fx) {
    var ed = global.DG.enemyData, st = run.stage, bref = ed && st && st.boss && ed.bossByName ? ed.bossByName(st.boss.name) : null;
    var e = grow(run, { hp: BOSS_HP, dmg: BOSS_DMG }, BOSS_SZ, '엘리트 보스', bref); if (!e) { return null; }
    e.eliteBoss = true; e.eliteT = BOSS_T; banner(run, fx, '☠️ ' + BOSS_T + '초 안에 쓰러뜨려라', e.ref.name); return e;
  }

  /** 처치 하나 — 'elite'·'boss' 를 띄웠으면 그 적 */
  function onKill(run, fx, e) {
    if (!on() || !run || !e || e.boss || !allowed(run)) { return null; }
    var c = cnt(run.stage.key);
    if (e.eliteBoss) { loot(run, e, LOOT + 2); return null; }
    if (e.elite) { loot(run, e, LOOT); c.elites++; if (c.elites % BOSS_AFTER === 0) { return spawnBoss(run, fx); } return null; }
    c.kills++;
    if (c.kills % every() === 0 && !alive(run, 'elite') && !alive(run, 'eliteBoss')) { return spawnElite(run, fx); }
    return null;
  }
  function loot(run, e, n) {
    var G = global.DG.gear, lv = (run.stage && run.stage.enemyLv) || 1, i, got;
    for (i = 0; i < n && G && G.rollDrop; i++) {
      got = G.rollDrop(lv, true);
      if (got) { run.drops.push({ kind: got.kind, key: got.key, uniq: !!got.uniq, x: e.x + e.w / 2 + (i - 1) * 22, y: e.y, vy: -260 - i * 30, n: 1 }); }
    }
  }
  function expMul(e) { return !on() || !e ? 1 : (e.eliteBoss ? BOSS_EXP : (e.elite ? ELITE_EXP : 1)); }
  /** 매 틱 — 엘리트 보스 제한 시간 · 어두운 막 */
  function tick(run, dt) {
    var b = run && run.enemies ? alive(run, 'eliteBoss') : null;
    if (b) {
      b.eliteT -= dt;
      if (b.eliteT <= 0) { run.enemies.splice(run.enemies.indexOf(b), 1); b = null; var C = core(); if (C && C.emit) { C.emit('toast', '💨 엘리트 보스가 사라졌다'); } }
    }
    dim(run && run.enemies ? alive(run, 'elite') : null, b);
  }
  /* 화면 — 엘리트가 살아 있는 동안 배경을 살짝 어둡게(#stage 바로 위 DOM 막, 누름은 통과), 보스면 남은 초.
     캔버스에 칠하면 뒤 층이 덮어 안 보였다 — 사냥터를 나가면(틱이 안 오면) 0.4초 뒤 스스로 숨는다 */
  var veil = null, seen = 0;
  function dim(el, bo) {
    if (typeof document === 'undefined') { return; }
    if (!veil) {
      var st = document.getElementById('stage'); if (!st || !st.parentNode) { return; }
      veil = document.createElement('div'); veil.id = 'elite-dim';
      veil.style.cssText = 'position:fixed;inset:0;z-index:2;pointer-events:none;display:none;transition:background .4s;text-align:center;';
      veil.innerHTML = '<div id="elite-dim-t" style="position:absolute;left:0;right:0;top:20%;font:800 17px system-ui,sans-serif;color:#ffb0b0;text-shadow:0 2px 3px #200008"></div>';
      st.parentNode.insertBefore(veil, st.nextSibling);
      setInterval(function () { if (veil && Date.now() - seen > 400) { veil.style.display = 'none'; } }, 400);
    }
    if (!el && !bo) { veil.style.display = 'none'; return; }
    seen = Date.now(); veil.style.display = ''; veil.style.background = bo ? 'rgba(40,0,20,0.30)' : 'rgba(10,6,24,0.26)';
    veil.firstChild.textContent = bo ? '☠️ 엘리트 보스 ' + Math.ceil(bo.eliteT) + '초' : '';
  }
  function state(key) { return key ? cnt(key) : counts; }

  global.DG = global.DG || {};
  global.DG.fieldElite = { EVERY: EVERY, BOSS_AFTER: BOSS_AFTER, BOSS_T: BOSS_T, ELITE_EXP: ELITE_EXP, BOSS_EXP: BOSS_EXP, every: every, onKill: onKill, expMul: expMul, tick: tick, state: state,
    _reset: function () { counts = {}; } };
})(window);
