/**
 * 4종횡 「내 정보」 어댑터 — W-0361. 공용 me-panel.js 가 독 단추·창을 붙인다.
 * 몸 열 칸(gear.equipped · gearData.SLOTS) · 공격·체력·방어·기력(side.power — 사냥터가 쓰는 값 그대로) · 무/지/통(hero.stats) — 읽기만.
 * 칸을 누르면 가방 창 · "어디서 올리나" 는 사방 성좌도.
 */
(function (global) {
  'use strict';

  function model() {
    var D = global.DG, core = D.core, G = D.gear, GD = D.gearData, S = D.side, CN = D.constellation, ui = D.ui;
    var bag = function () { if (ui && ui.openSheet) { ui.openSheet('bag'); } };
    var eq = G && G.equipped ? G.equipped() : {}, ico = D.itemicon ? D.itemicon.fn('saga-story') : null;
    var slots = (GD ? GD.SLOTS : []).map(function (s) {
      var it = eq[s.key];
      return { label: s.name, icon: it && ico ? ico('equip', it.key, 32, s.emoji) : s.emoji, item: it ? G.nameOf(it) : null, go: bag };
    });
    var p = S && S.power ? S.power() : null, stats = [];
    if (p) { stats.push({ label: '공격력', value: p.atk, detail: '맨몸 ' + p.bare.atk }, { label: '체력', value: p.hp }, { label: '방어', value: p.def }, { label: '기력', value: p.mp }); }
    var id = (core.save.party || [])[0] || null, st = id && D.hero ? D.hero.stats(id) : null;
    if (st) { stats.push({ label: '무력 · 지력 · 통솔', value: st.might + ' · ' + st.wisdom + ' · ' + st.command }); }
    var pl = core.save.player || {}, me = id && D.data ? D.data.find(id) : null;
    return {
      name: me ? me.name : '나', sub: 'Lv.' + (pl.level || 1), slots: slots, stats: stats,
      note: '공격력·체력은 사냥터 값 그대로입니다(장비·무예·성좌도가 든 값). 칸을 누르면 가방이 열립니다.',
      grow: CN && CN.open ? { label: '✦ 성좌도에서 올리기', open: CN.open } : null
    };
  }

  global.DG = global.DG || {};
  global.DG.meAdapter = { model: model, title: '내 정보' };
})(window);
