/**
 * 1만리 「내 정보」 어댑터 — W-0361. 공용 me-panel.js 가 그린다(이 판은 기존 「나」 시트 맨 위 — dock: false).
 * 선두 인물 = 내 몸: 무기 1 + 보패 다섯 칸, 전투 수치는 들판 전투가 쓰는 fieldCombat.memberOf 그대로(새 계산 없음), 무/지/통은 hero.breakdown.
 * 칸을 누르면 그 인물 상세(무기 고르기·보패 끼우기) — 「나」 시트의 선두 줄 단추를 누른다.
 */
(function (global) {
  'use strict';

  function model() {
    var D = global.DG, core = D.core, data = D.data, H = D.hero, WP = D.weapon, AR = D.artifact, FC = D.fieldCombat, SC = D.starchart;
    var party = (core.save.party || []).filter(Boolean), lead = party.length ? data.find(party[0]) : null;
    if (!lead) { return { name: '나', sub: '동행이 없습니다', note: '인물을 등용해 동행에 넣으면 선두가 내 몸이 됩니다 — 무기·보패를 낄 수 있습니다.', grow: SC && SC.open ? { label: '✨ 성도에서 올리기', open: SC.open } : null }; }
    var id = lead.id, g = H.info(id), bk = H.breakdown(id), fin = (bk && bk.final) || {}, slots = [];
    var detail = function () { var b = global.document.querySelector('.me-sheet [data-act="detail"][data-id="' + id + '"]'); if (b) { b.click(); } };
    if (WP) { var wid = WP.equipped(id), w = WP.info(wid); slots.push({ label: '무기', icon: WP.TYPE_ICON[WP.typeOf(id)], item: w ? '★' + w.rarity + ' ' + w.name : null, go: detail, dd: w && !WP.isShared(wid) ? 'wp:' + wid : null }); }   // W-0362 dd — 동행 줄로 끌면 그 인물에게
    if (AR) {
      var eq = AR.equippedOf(id);
      AR.SLOTS.forEach(function (s) { slots.push({ label: AR.SLOT_NAMES[s], icon: AR.SLOT_ICON[s], item: eq[s] ? AR.label(eq[s]).replace(/^\S+\s/, '') : null, go: detail, dd: eq[s] ? 'art:' + eq[s] : null }); });
    }
    var m = FC && FC.memberOf ? FC.memberOf(id) : null, stats = [];
    if (m) {
      stats.push({ label: '공격력', value: m.atk }, { label: '체력', value: m.hpMax }, { label: '방어', value: m.def },
        { label: '치명', value: Math.round(m.cr * 100) + '%', detail: '치명 피해 +' + Math.round(m.cdm * 100) + '%' });
    }
    stats.push({ label: '무력 · 지력 · 통솔', value: (fin.might | 0) + ' · ' + (fin.wisdom | 0) + ' · ' + (fin.command | 0) });
    return {
      name: lead.name, sub: 'Lv.' + (g ? g.lv : 1) + ' · 선두(내 몸)', slots: slots, stats: stats,
      note: '공격력·체력·방어는 들판 전투 값 그대로입니다. 칸을 누르면 인물 상세에서 무기를 고르고 보패를 낍니다.',
      grow: SC && SC.open ? { label: '✨ 성도에서 올리기', open: SC.open } : null
    };
  }

  global.DG = global.DG || {};
  global.DG.meAdapter = { model: model, dock: false, title: '내 정보' };
})(window);
