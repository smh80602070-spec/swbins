/**
 * 4종횡 버닝 사냥터 (W-0484 · 메이플스토리 버닝 필드 — 구조만, 이름·수치는 우리 것)
 * ---------------------------------------------------------------
 * 오래 안 간 사냥터일수록 「버닝」 단계가 쌓인다 — 마지막으로 들어선 뒤 HOUR_PER 시간마다 1단계(최대 MAX), 처음 가는 곳은 FIRST.
 * 단계마다 처치 경험치 +STEP(10%). 들어선 순간 단계가 정해지고, 그 사냥터에서 PER_STEP 마리 잡을 때마다 1단계씩 꺼진다.
 * 세이브: core.save.side.burn = { <사냥터 key>: 마지막으로 들어선 시각(ms) } — 순수 추가 칸(옛 세이브는 빈 것).
 * side.js update 맨 앞 tick(run) · 처치 경험치 곱 killMul(run). 손잡이 story.burning(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var MAX = 10, STEP = 0.1, HOUR_PER = 1, FIRST = 3, PER_STEP = 40, H = 3600000;

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('story.burning', 1)); }
  function toast(m) { var C = core(); if (C && C.emit) { C.emit('toast', m); } }
  function store() { var C = core(); if (!C || !C.save) { return null; } var s = C.save.side = C.save.side || {}; return s.burn = s.burn || {}; }

  /** 들어설 때 단계(순수) — last 없으면 FIRST */
  function stageAt(last, now) {
    if (!last) { return FIRST; }
    return Math.max(0, Math.min(MAX, Math.floor((now - last) / (HOUR_PER * H))));
  }

  function tick(run, now) {
    if (!run || !run.stage || run.rift) { return; }
    var key = run.stage.key;
    if (run.burn && run.burn.key === key) { return; }
    var st = store(), t = now || Date.now(), stage = on() && st ? stageAt(st[key], t) : 0;
    if (st) { st[key] = t; }
    run.burn = { key: key, stage: stage, kills: 0 };
    if (stage > 0) { toast('🔥 버닝 사냥터 ' + stage + '단계 — 경험치 +' + Math.round(stage * STEP * 100) + '%'); }
  }

  /** 처치 한 번 — 이번 처치의 경험치 곱을 돌려주고 단계를 깎는다 */
  function killMul(run) {
    var b = run && run.burn; if (!on() || !b || b.stage <= 0) { return 1; }
    var mul = 1 + b.stage * STEP;
    b.kills += 1;
    if (b.kills >= PER_STEP) { b.kills = 0; b.stage -= 1; toast(b.stage > 0 ? '🔥 버닝 ' + b.stage + '단계로 내려감' : '버닝이 꺼졌다'); }
    return mul;
  }

  global.DG = global.DG || {};
  global.DG.burning = { MAX: MAX, STEP: STEP, FIRST: FIRST, PER_STEP: PER_STEP, stageAt: stageAt, tick: tick, killMul: killMul };
})(window);
