/**
 * 5천하 「내 정보」 어댑터 — W-0361. 공용 me-panel.js 가 독 단추·창을 붙인다.
 * 이 판의 나 = 세력, 내 몸 = 군주 장수 한 명. 칸은 지닌 보물 하나(off.rec(id).item), 능력치는 off.stats(RULES 49 — 이 함수만) · 읽기만.
 * 칸을 누르면 무장 창 · "어디서 올리나" 는 경륜도.
 */
(function (global) {
  'use strict';

  function model() {
    var D = global.DG, core = D.core, off = D.off, IT = D.item, SC = D.statecraft, ui = D.ui, data = D.data;
    var me = core.save && core.save.rtk ? core.save.rtk.me : null, lord = me && off ? off.lordOf(me) : null, h = lord && data ? data.find(lord) : null;
    if (!h) { return { name: '나', sub: '아직 세력을 고르지 않았습니다', note: '시나리오와 세력을 고르면 군주의 능력치·보물이 보입니다.' }; }
    var go = function () { if (ui && ui.openSheet) { ui.openSheet('officers'); } };
    var r = off.rec(lord), it = r && r.item && IT && IT.itemById ? IT.itemById(r.item) : null, ico = D.itemicon ? D.itemicon.fn('saga-realm') : null;
    var st = off.stats(lord);
    return {
      name: h.name, sub: '군주', slots: [{ label: '보물', icon: it && ico ? ico('equip', it.id, 32, '💎') : '💎', item: it ? it.name : null, go: go }],
      stats: [{ label: '무력', value: st.might }, { label: '지력', value: st.wisdom }, { label: '통솔', value: st.command }, { label: '전투력', value: off.power(lord) }],
      note: '보물은 한 사람에 하나입니다(장비창 없음). 칸을 누르면 무장 창이 열립니다.',
      grow: SC && SC.open ? { label: '📜 경륜도에서 올리기', open: SC.open } : null
    };
  }

  global.DG = global.DG || {};
  global.DG.meAdapter = { model: model, title: '내 정보' };
})(window);
