/**
 * 2나락 「내 정보」 어댑터 — W-0361. 공용 me-panel.js 가 독 단추·창을 붙인다.
 * 선두 영웅(부대 첫째)의 여덟 칸(item.equipped) · 무/지/통(hero.stats) · 개인 전투력(hero.power) · 부대 공/방(hero.partyPower) — 읽기만.
 * 칸을 누르면 기존 장비 창(gear) · "어디서 올리나" 는 그 영웅의 경락도.
 */
(function (global) {
  'use strict';
  var SLOT_ICON = { weapon: '⚔️', armor: '🥋', helm: '🪖', glove: '🧤', boot: '🥾', ring: '💍', neck: '📿', charm: '📿' };

  function model() {
    var D = global.DG, core = D.core, data = D.data, H = D.hero, I = D.item, ID = D.itemData, MR = D.meridian, ui = D.ui;
    var id = (core.save.party || [])[0], h = id ? data.find(id) : null;
    var gear = function () { if (ui && ui.openSheet) { ui.openSheet('gear'); } };
    if (!h) { return { name: '나', sub: '부대가 비었습니다', note: '영웅을 부대에 넣으면 그 영웅의 장비·능력치가 보입니다.' }; }
    var eq = I && I.equipped ? I.equipped(id) : {}, ico = D.itemicon ? D.itemicon.fn('saga-dungeon') : null;
    var slots = (ID ? ID.SLOTS : []).map(function (s) {
      var it = eq[s];
      return { label: ID.slotKor(s), icon: it && ico ? ico('equip', it.uniq || it.base, 32, SLOT_ICON[s]) : SLOT_ICON[s], item: it ? I.name(it) : null, go: gear };
    });
    var st = H.stats(id), pp = H.partyPower ? H.partyPower() : null;
    var stats = [
      { label: '무력 · 지력 · 통솔', value: st.might + ' · ' + st.wisdom + ' · ' + st.command, detail: '장비·펫·성장이 다 든 값' },
      { label: '개인 전투력', value: H.power(id) }
    ];
    if (pp) { stats.push({ label: '부대 공격', value: pp.atk }, { label: '부대 방어', value: pp.def, detail: '던전의 체력·공격력이 이 값에서 나옵니다' }); }
    var g = H.info ? H.info(id) : null;
    return {
      name: h.name, sub: (g && g.lv ? 'Lv.' + g.lv + ' · ' : '') + '부대 선두', slots: slots, stats: stats,
      note: '칸을 누르면 장비 창이 열립니다.',
      grow: MR && MR.open ? { label: '☯ 경락도에서 올리기', open: function () { MR.open(id); } } : null
    };
  }

  global.DG = global.DG || {};
  global.DG.meAdapter = { model: model, title: '내 정보' };
})(window);
