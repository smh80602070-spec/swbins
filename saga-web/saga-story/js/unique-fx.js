/**
 * 4종횡 고유 장비 특수 효과 (W-0437 ② · 디아블로 고유 아이템 — 구조만, 수치는 우리 것)
 * ---------------------------------------------------------------
 * 고유(data-unique 10)는 능력치만 높은 물건이었다 → 낀 동안 사냥터 사건에 걸리는 효과 한 줄씩:
 *   kill   잡몹 처치(side:kill)마다       — hp: 최대 체력 비율 회복 · mp: 기력 더하기
 *   boss   미니보스·보스 처치마다          — hp
 *   cast   무예를 쓸 때마다(side:skill)    — refund: 그 무예 기력 비율 되돌림 · hp
 * FX 표는 고유 key → 효과(K 생성기 표 W-0435 가 오면 줄만 늘린다). 요구 수준 미달이면 안 걸림(gear.bonus 와 같은 규칙).
 * 세이브 안 바뀜. 손잡이 story.uniqueFx(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var FX = {
    u_sword:    { on: 'kill', hp: 0.02, desc: '처치마다 체력 2% 회복' },
    u_ring:     { on: 'kill', mp: 3, desc: '처치마다 기력 +3' },
    u_cape:     { on: 'boss', hp: 0.15, desc: '미니보스·보스를 쓰러뜨리면 체력 15% 회복' },
    u_glove:    { on: 'cast', refund: 0.25, desc: '무예를 쓰면 그 기력의 25% 를 되돌림' },
    u_necklace: { on: 'cast', hp: 0.01, desc: '무예를 쓸 때마다 체력 1% 회복' }
  };

  function core() { return global.DG.core; }
  function on() { var c = core(); return !(c && c.tuned && !+c.tuned('story.uniqueFx', 1)); }
  /** 낀(요구 수준을 채운) 고유의 효과들 */
  function worn() {
    var G = global.DG.gear, C = core(), e = G && G.equipped ? G.equipped() : {}, out = [], k;
    for (k in e) { if (Object.prototype.hasOwnProperty.call(e, k) && e[k] && FX[e[k].key]) { var d = G.defOf ? G.defOf(e[k]) : null; if (d && C.save.player.level >= d.need) { out.push(FX[e[k].key]); } } }
    return out;
  }
  function runOf() { var S = global.DG.side; return S && S.raw ? S.raw() : null; }
  function heal(run, frac) { if (run && run.hpMax) { run.hp = Math.min(run.hpMax, run.hp + Math.round(run.hpMax * frac)); } }
  function addMp(run, n) { if (run && run.mpMax) { run.mp = Math.min(run.mpMax, run.mp + n); } }
  /** 사건 하나 — 걸린 효과 수 */
  function fire(kind, run, extra) {
    if (!on() || !run) { return 0; }
    var n = 0;
    worn().forEach(function (f) {
      if (f.on !== kind) { return; }
      n++;
      if (f.hp) { heal(run, f.hp); }
      if (f.mp) { addMp(run, f.mp); }
      if (f.refund && extra && extra.cost) { addMp(run, Math.round(extra.cost * f.refund)); }
    });
    return n;
  }
  function costOf(key) { var S = global.DG.side, L = S && S.barSkills ? S.barSkills() : []; for (var i = 0; i < L.length; i++) { if (L[i].key === key) { return L[i].cost || 0; } } return 0; }
  function descOf(key) { return FX[key] ? FX[key].desc : ''; }
  /** 「내 정보」 줄 — 낀 고유 효과가 있을 때만 */
  function cardHtml() { if (!on()) { return ''; } var L = worn(); return L.length ? '<div class="sec"><h4>⭐ 고유 효과</h4><div class="card"><small>' + L.map(function (f) { return f.desc; }).join(' · ') + '</small></div></div>' : ''; }

  function init() {
    var C = core(); if (!C || !C.on) { return; }
    C.on('side:kill', function (e) { if (!e || e.hidden) { return; } fire(e.boss || e.mini ? 'boss' : 'kill', runOf()); });
    C.on('side:skill', function (key) { if (typeof key !== 'string' || key.indexOf('sig:') === 0) { return; } fire('cast', runOf(), { cost: costOf(key) }); });
  }
  if (global.DG && global.DG.core) { init(); }

  global.DG = global.DG || {};
  global.DG.uniqueFx = { FX: FX, worn: worn, fire: fire, descOf: descOf, cardHtml: cardHtml };
})(window);
