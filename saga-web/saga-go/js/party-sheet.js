/**
 * 사가고 — 👤 동행 시트(W-0092)
 * ---------------------------------------------------------------
 * "내 캐릭터 정보 볼 곳이 없다 — 동행도, 장비 착용여부도"(사용자 2026-10-07).
 * 명단은 도감 맨 위 「들판 명단」에, 무기·보패는 인물 카드 안에 흩어져 있었다 — 여기 한 장에 모은다.
 * 이 시트는 **보기만** 한다. 자리·무기·보패를 바꾸는 일은 카드를 눌러 여는 기존 인물 상세가 그대로 한다
 * (`data-act="detail"` — ui.js 의 시트 클릭이 받는다).
 *
 * ui.js 는 큰 파일 상한(tools/big-files.txt)이라 이 화면을 따로 둔다. ui.js 가 부를 때
 * 제 클로저 도우미(esc·초상·칭호·모험 등급·편성 줄·반려)를 ctx 로 넘긴다 — 같은 그림·같은 글자를 쓴다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  function data() { return global.DG.data; }

  /** @param ctx { esc, pt, titleOf, advText, presetStrip, buddy } — ui.js 클로저 도우미 */
  function view(ctx) {
    var esc = ctx.esc, p = core.save.player, need = core.expNeed(p.level), FM = global.DG.formation;
    var html = '<div class="sec"><h4>🧭 나</h4><div class="pc-me">' +
      '<div class="pc-row"><b>' + esc(ctx.titleOf(p.featTotal)) + '</b><span class="muted">' + esc(ctx.advText(p.level)) + '</span></div>' +
      '<div class="dexbar"><div class="bar"><i style="width:' + core.clamp(p.exp / need * 100, 0, 100) + '%"></i></div>' +
        '<small>경험 ' + core.fmt(p.exp) + ' / ' + core.fmt(need) + '</small></div>' +
      '<div class="pc-row"><span>🪙 ' + core.fmt(p.gold) + '</span><span>🎖️ 명성 ' + core.fmt(p.fame || 0) + '</span>' +
        '<span>공적 ' + core.fmt(p.featTotal || 0) + '</span></div></div></div>';

    var P = core.save.party || [], max = FM ? FM.MAX : 5, field = FM ? FM.FIELD : 4, i, cards = '';
    for (i = 0; i < max; i++) { cards += card(ctx, P[i], i, field); }
    html += '<div class="sec"><h4>⚔ 동행 <span class="muted">' + P.length + ' / ' + max + '</span></h4>' +
      (FM && ctx.presetStrip ? ctx.presetStrip(FM) : '') + '<div class="pc-list">' + cards + '</div>' +
      '<small class="muted">앞 ' + field + '명이 들판 전투 명단입니다. 카드를 누르면 자리·무기·보패를 바꾸는 인물 화면이 열립니다.</small></div>';

    var B = ctx.buddy ? ctx.buddy() : null, cur = B ? B.current() : null;
    if (cur) {
      html += '<div class="sec"><h4>🐾 반려</h4><div class="pc-card" data-act="detail" data-kind="pet" data-id="' + cur.pet.id + '">' +
        '<div class="pc-ico">' + ctx.pt('pet', cur.pet, 40) + '</div>' +
        '<div class="pc-meta"><b>' + esc(cur.pet.name) + ' ' + cur.bond.def.mark + '</b><small>' + esc(cur.bond.def.name) +
          ' · 함께 ' + core.fmt(cur.log.walked) + 'm</small></div></div></div>';
    }
    return html;
  }

  /** 동행 한 칸 — 초상·자리·레벨·능력·무기·보패 한 줄씩. 비었으면 (빈자리) */
  function card(ctx, id, i, field) {
    var esc = ctx.esc, h = id ? data().find(id) : null;
    if (!h) {
      return '<div class="pc-card empty"><div class="pc-ico">' + (i + 1) + '</div><div class="pc-meta"><b class="muted">(빈자리)</b>' +
        '<small>인물을 등용해 명단에 넣으세요</small></div></div>';
    }
    var HR = global.DG.hero, inf = HR ? HR.info(id) : { lv: 1, rank: 0 }, st = HR ? HR.stats(id) : (h.stats || {}), stars = '', k;
    for (k = 0; k < (h.rarity || 0); k++) { stars += '★'; }
    var line1 = 'Lv.' + inf.lv + (inf.rank ? ' · 승급 ' + inf.rank : '') +
      ' · 무 ' + (st.might || 0) + ' · 지 ' + (st.wisdom || 0) + ' · 통 ' + (st.command || 0);
    return '<div class="pc-card" data-act="detail" data-kind="hero" data-id="' + id + '">' +
      '<div class="pc-ico">' + ctx.pt('hero', h, 40) + '</div>' +
      '<div class="pc-meta"><b>' + (i < field ? '⚔' + (i + 1) + ' ' : '대기 ') + esc(h.name) + ' <span class="pc-star">' + stars + '</span></b>' +
        '<small>' + line1 + '</small>' + weapon(esc, id) + artifact(esc, id) + '</div></div>';
  }

  function weapon(esc, id) {
    var WP = global.DG.weapon;
    if (!WP) { return ''; }
    var wid = WP.equipped(id), w = wid ? WP.info(wid) : null, ic = WP.TYPE_ICON[WP.typeOf(id)] || '🗡️';
    if (!w) { return '<small class="pc-gear">' + ic + ' 무기 없음</small>'; }
    var r = WP.rec(wid) || { lv: 1, asc: 0 };
    return '<small class="pc-gear">' + ic + ' ★' + w.rarity + ' ' + esc(w.name) +
      (WP.isShared(wid) ? '' : ' Lv.' + r.lv) + ' · 공격 ' + Math.round(WP.atkAt(wid, r.lv, r.asc)) + '</small>';
  }

  function artifact(esc, id) {
    var AR = global.DG.artifact;
    if (!AR) { return ''; }
    var eq = AR.equippedOf(id) || {}, n = 0, icons = '', i;
    for (i = 0; i < AR.SLOTS.length; i++) {
      var s = AR.SLOTS[i];
      if (eq[s]) { n++; icons += AR.SLOT_ICON[s]; } else { icons += '·'; }
    }
    var sets = (AR.statsOf(id).sets || []).map(function (x) { return AR.SETS[x.id].name + ' ' + x.n; }).join(', ');
    return '<small class="pc-gear">🏺 보패 ' + n + '/' + AR.SLOTS.length + ' ' + icons + (sets ? ' · ◆ ' + esc(sets) : '') + '</small>';
  }

  global.DG = global.DG || {};
  global.DG.partySheet = { view: view };
})(window);
