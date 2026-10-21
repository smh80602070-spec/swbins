/**
 * 3마을 「내 정보」 어댑터 — W-0361. 공용 me-panel.js 가 독 단추·창을 붙인다.
 * 이 판엔 싸움이 없다 — 칸은 입은 옷 넷(wear.item · villageData.WEAR_PARTS), 수치는 생활(가진 돈·솜씨 점수) · 읽기만.
 * 칸을 누르면 옷장(wear 시트) · "어디서 올리나" 는 솜씨도.
 */
(function (global) {
  'use strict';
  var PART_ICON = { coat: '👘', head: '🎩', dye: '🎨', cape: '🧥' };

  function model() {
    var D = global.DG, core = D.core, W = D.wear, VD = D.villageData, WS = D.workshop, ui = D.ui;
    var wear = function () { if (ui && ui.openSheet) { ui.openSheet('wear'); } };
    var ico = D.itemicon ? D.itemicon.fn('saga-forest') : null;
    var slots = (VD && W ? VD.WEAR_PARTS : []).map(function (p) {
      var it = W.item(p.key);
      return { label: p.name, icon: it && ico ? ico('wear', it.key, 32, PART_ICON[p.key] || '👕') : (PART_ICON[p.key] || '👕'), item: it ? it.name : null, go: wear };
    });
    var pl = core.save.player || {}, stats = [{ label: '가진 돈', value: core.fmt ? core.fmt(pl.gold || 0) : (pl.gold || 0) }];
    if (WS && WS.pointsTotal) { stats.push({ label: '솜씨 점수', value: WS.pointsTotal(), detail: '채집·낚시·벌레잡기·가구 솜씨를 여는 점수' }); }
    return {
      name: pl.name || '나', sub: '마을 주민', slots: slots, stats: stats,
      note: '이 마을엔 싸움이 없어 전투 수치 대신 생활 수치입니다. 칸을 누르면 옷장이 열립니다.',
      grow: WS && WS.open ? { label: '🛠 솜씨도에서 올리기', open: WS.open } : null
    };
  }

  global.DG = global.DG || {};
  global.DG.meAdapter = { model: model, title: '내 정보' };
})(window);
