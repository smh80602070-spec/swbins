/**
 * 지도 장치(W-0298, 장부 dungeon.md 우선 2) — 부적(§5.3)에 변형자를 새겨 끝판 지도를 만든다.
 * ---------------------------------------------------------------
 * 부적은 이미 "티어 + 결정적 변형자 2~3"인 지도다(data-dungeon rollMods). 여기는 그 위에 한 층:
 *   새김     굴혈 부적 목록에서 ✒️ — 금 COST×티어×(새긴 수+1) 를 내고 변형자 하나를 더 새긴다(부적 seed·새긴 수로 결정적, 이미 있는 것은 빼고).
 *            부적마다 MAX_EXTRA(3)까지. 새긴 것은 부적에 `extra: [key…]` 로 남는다(없으면 빈 것 — 옛 세이브 그대로)
 *   들어가기  enter() 가 rollMods 결과에 merge(sig, base) 를 덮어 변형자가 그 판 전체에 걸린다('resist' 를 새기면 원소도 결정적으로)
 *   보상     새긴 수만큼 노획 배율 × (1 + LOOT_PER × 새긴 수) — nmLootMul 이 묻는다. 부적은 쓰면 사라진다(옛 규칙 그대로)
 * 구조만 패스 오브 엑자일 2 아틀라스·라스트 에포크 모놀리스에서(이름·수치·그림은 이 판 것). 손잡이 dg.atlas(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var MAX_EXTRA = 3, COST = 150, LOOT_PER = 0.2;
  var MOD_ELEMS = ['fire', 'cold', 'lit', 'pois', 'emp'];

  function core() { return global.DG.core; }
  function DD() { return global.DG.dungeonData; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('dg.atlas', 1)); }
  function extraOf(sig) { return sig && Array.isArray(sig.extra) ? sig.extra : []; }
  function cost(sig) { return COST * Math.max(1, (sig && sig.tier) || 1) * (extraOf(sig).length + 1); }

  /** 부적 + 기본 굴림 → 새긴 것까지 합친 { mods, resistElem, extraN } (순수) */
  function merge(sig, base) {
    var mods = ((base && base.mods) || []).slice(), ex = on() ? extraOf(sig) : [], n = 0, i, re = base ? base.resistElem : null;
    for (i = 0; i < ex.length; i++) { if (mods.indexOf(ex[i]) < 0) { mods.push(ex[i]); n++; } }
    if (!re && mods.indexOf('resist') >= 0) { re = MOD_ELEMS[Math.floor(core().hash2(sig.seed || 0, 141) * MOD_ELEMS.length)]; }
    return { mods: mods, resistElem: re, extraN: n };
  }
  function preview(sig) { return merge(sig, DD() ? DD().rollMods(sig.seed) : { mods: [], resistElem: null }); }

  /** 다음에 새길 변형자 — 부적 seed·새긴 수로 결정적, 이미 걸린 것은 건너뜀. 없으면 null (순수) */
  function nextMod(sig) {
    var M = DD() ? DD().MODS : [], have = preview(sig).mods, n = extraOf(sig).length, g, k;
    for (g = 0; g < 40; g++) {
      k = M[Math.floor(core().hash2((sig.seed || 0) * 7 + n, 150 + g) * M.length)];
      if (k && have.indexOf(k.key) < 0) { return k.key; }
    }
    return null;
  }

  /** 새김 — { ok, key, cost } 또는 { ok:false, reason: off|nosig|max|gold|none } */
  function inscribe(id) {
    var IT = global.DG.item, sig = IT && IT.sigilById ? IT.sigilById(id) : null, s = core().save, c, k;
    if (!on()) { return { ok: false, reason: 'off' }; }
    if (!sig) { return { ok: false, reason: 'nosig' }; }
    if (extraOf(sig).length >= MAX_EXTRA) { return { ok: false, reason: 'max' }; }
    c = cost(sig);
    if ((s.gold || 0) < c) { return { ok: false, reason: 'gold', cost: c }; }
    k = nextMod(sig);
    if (!k) { return { ok: false, reason: 'none' }; }
    s.gold -= c; sig.extra = extraOf(sig).concat([k]);
    core().emit('atlas:inscribe', { id: id, key: k, cost: c });
    if (core().persist) { core().persist(); }
    return { ok: true, key: k, cost: c };
  }
  /** 노획 배율(부적 던전 nightmare 객체의 extraN) */
  function lootMul(nm) { return on() && nm ? 1 + LOOT_PER * Math.max(0, nm.extraN || 0) : 1; }

  /** 굴혈 부적 단추 곁 — 새김 단추 HTML(못 새기면 이유) */
  function buttonHtml(sig) {
    if (!on() || !sig) { return ''; }
    var n = extraOf(sig).length;
    if (n >= MAX_EXTRA) { return '<small class="muted" style="display:block;margin:-4px 0 6px 8px">✒️ 새김 가득(' + n + '/' + MAX_EXTRA + ') · 노획 ×' + (1 + LOOT_PER * n).toFixed(1) + '</small>'; }
    return '<button class="btn tiny ghost" style="margin:-4px 0 6px 8px" data-act="atlas-inscribe" data-id="' + sig.id + '">✒️ 변형자 새기기 ' + cost(sig) + '금 (' + n + '/' + MAX_EXTRA + ') · 노획 ×' + (1 + LOOT_PER * (n + 1)).toFixed(1) + '</button>';
  }
  function reasonText(r) {
    return { off: '지도 장치가 꺼져 있습니다', nosig: '그 부적을 찾을 수 없습니다', max: '더 새길 자리가 없습니다(최대 ' + MAX_EXTRA + ')', gold: '금이 모자랍니다(' + (r.cost || '') + '금)', none: '새길 변형자가 남지 않았습니다' }[r.reason] || '새길 수 없습니다';
  }

  global.DG = global.DG || {};
  global.DG.atlas = { MAX_EXTRA: MAX_EXTRA, COST: COST, LOOT_PER: LOOT_PER, cost: cost, extraOf: extraOf, merge: merge, preview: preview, nextMod: nextMod, inscribe: inscribe, lootMul: lootMul, buttonHtml: buttonHtml, reasonText: reasonText };
})(window);
