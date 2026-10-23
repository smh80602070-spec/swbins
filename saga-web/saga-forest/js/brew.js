/**
 * 3마을 — 물약 양조 (W-0397 ① 웹 역이식 — 정본 고돗 G-0320 · 포션 크래프트 구조만)
 * ---------------------------------------------------------------
 * 약초는 도구·가구 재료뿐이었다 → 집 시트 「⚗️ 물약 달이기」: 약초 1 + 재료 하나(열매·밤잣·꽃·곤충·광석 갈래에서 가방에 있는 것)를 섞으면
 * 처음엔 무엇이 될지 모르고(❔), 한 번 달이면 이름이 밝혀진다. 달이면 곧바로 마셔 오늘 하루 효과 하나 —
 *   🍯 기운(열매: 채집 +1) · 🐚 물빛(밤·잣: 낚시 입질 창 ×1.5) · 🌸 꽃향(꽃: 주민 친밀 오를 때 +1) · 💧 탁한 물약(곤충·광석: 헛방). 새로 마시면 바뀐다.
 *   세이브 마을 상태 brew = { known: { 갈래: 1 }, today: { day, kind } } — 순수 추가. 손잡이 brew.on(1).
 *   걸린 자리(village.js): 채집 수 +bonus('gather') · 낚시 입질 창 ×mul('bite') · 친밀 +bonus('heart') · ui 집 시트 카드(cardHtml, data-brew).
 */
(function (global) {
  'use strict';

  var RECIPES = {
    fruit: { kind: 'vigor', emoji: '🍯', name: '기운', desc: '오늘 채집 +1' },
    nut: { kind: 'tide', emoji: '🐚', name: '물빛', desc: '오늘 낚시 입질 창 ×1.5' },
    flower: { kind: 'scent', emoji: '🌸', name: '꽃향', desc: '오늘 주민 친밀 오를 때 +1' },
    bug: { kind: 'murky', emoji: '💧', name: '탁한 물약', desc: '헛방 — 아무 효과 없음' },
    ore: { kind: 'murky', emoji: '💧', name: '탁한 물약', desc: '헛방 — 아무 효과 없음' },
  };
  var CATS = ['fruit', 'nut', 'flower', 'bug', 'ore'], CAT_NAME = { fruit: '열매', nut: '밤·잣', flower: '꽃', bug: '곤충', ore: '광석' };

  function core() { return global.DG.core; }
  function V() { return global.DG.village; }
  function VD() { return global.DG.villageData; }
  function K(key, def) { var c = core(); return c && c.tuned ? c.tuned('brew.' + key, def) : def; }
  function on() { return K('on', 1) ? true : false; }
  function st() { var s = V().state(); if (!s.brew) { s.brew = { known: {}, today: null }; } return s.brew; }
  function day() { return V().today ? V().today() : Math.floor(Date.now() / 86400000); }
  function itemsOf(cat) { var all = VD().ITEMS[cat] || [], bag = V().state().bag || {}; return all.filter(function (it) { return bag[it.key] > 0; }); }
  function herb() { return itemsOf('herb')[0] || null; }
  function catOf(key) { var c, i, L; for (c in VD().ITEMS) { if (!VD().ITEMS.hasOwnProperty(c)) { continue; } L = VD().ITEMS[c]; for (i = 0; i < L.length; i++) { if (L[i].key === key) { return c; } } } return null; }
  function known(cat) { return !!st().known[cat]; }
  function effectToday() { var b = st(); return b.today && b.today.day === day() ? b.today.kind : null; }
  function bonus(what) { if (!on()) { return 0; } var k = effectToday(); return (what === 'gather' && k === 'vigor') || (what === 'heart' && k === 'scent') ? 1 : 0; }
  function mul(what) { if (!on()) { return 1; } return what === 'bite' && effectToday() === 'tide' ? 1.5 : 1; }
  /** 달이기 — 약초 하나 + 재료 하나(키). 돌아온 값 { ok, recipe, first } */
  function brew(matKey) {
    if (!on()) { return { ok: false, why: '꺼짐' }; }
    var h = herb(), cat = catOf(matKey), r = cat && RECIPES[cat], bag = V().state().bag;
    if (!h) { return { ok: false, why: '약초가 없다' }; }
    if (!r || !(bag[matKey] > 0)) { return { ok: false, why: '섞을 재료가 없다' }; }
    bag[h.key] -= 1; bag[matKey] -= 1;
    var first = !known(cat); st().known[cat] = 1;
    st().today = { day: day(), kind: r.kind };
    if (core().log) { core().log('⚗️ ' + (first ? '처음 보는 물약 — ' : '') + r.emoji + ' ' + r.name + ' — ' + r.desc, r.kind === 'murky' ? 'warn' : 'good'); }
    if (core().persist) { core().persist(); }
    return { ok: true, recipe: r, first: first };
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function cardHtml() {
    if (!on() || !V() || !VD()) { return ''; }
    var h = herb(), k = effectToday(), cur = null, c;
    for (c in RECIPES) { if (RECIPES.hasOwnProperty(c) && RECIPES[c].kind === k) { cur = RECIPES[c]; } }
    var html = '<div class="sec"><h4>⚗️ 물약 달이기 <span class="muted">약초 1 + 재료 하나 · 달이면 곧바로 마셔 오늘 하루</span></h4><div class="card">' +
      '<div class="stat-row"><span>오늘 효과</span><b>' + (cur ? cur.emoji + ' ' + esc(cur.name) + ' — ' + esc(cur.desc) : '없음') + '</b></div>' +
      '<div class="stat-row"><span>약초</span><b>' + (h ? esc(h.name) + ' ' + (V().state().bag[h.key] || 0) : '없음 — 버섯숲 약초밭에서 뜯는다') + '</b></div>';
    CATS.forEach(function (cat) {
      var its = itemsOf(cat), r = RECIPES[cat], it = its[0];
      html += '<div class="stat-row"><span>' + (known(cat) ? r.emoji + ' ' + esc(r.name) : '❔ ' + CAT_NAME[cat] + '을 섞으면?') + ' <small class="muted">' + (known(cat) ? esc(r.desc) : '') + '</small></span>' +
        (it && h ? '<button class="btn tiny' + (known(cat) && r.kind === 'murky' ? ' ghost' : ' primary') + '" data-brew="' + it.key + '">' + esc(it.name) + ' 섞기</button>' : '<span class="muted">' + CAT_NAME[cat] + ' 없음</span>') + '</div>';
    });
    return html + '</div></div>';
  }
  function bind() {
    if (!global.document) { return; }
    global.document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-brew]') : null;
      if (!b) { return; }
      var r = brew(b.getAttribute('data-brew'));
      if (!r.ok && core().emit) { core().emit('toast', r.why); }
      core().emit('changed');
    });
  }
  bind();

  global.DG = global.DG || {};
  global.DG.brew = { RECIPES: RECIPES, CATS: CATS, on: on, state: st, herb: herb, itemsOf: itemsOf, catOf: catOf, known: known, effectToday: effectToday, bonus: bonus, mul: mul, brew: brew, cardHtml: cardHtml };
})(window);
