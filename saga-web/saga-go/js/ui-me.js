/**
 * 1만리 "나" 시트 — 내 프로필(칭호·모험 등급·경험·걸은 거리·도감·공적)과 장비(선두 인물 능력치·무기·보패, 동행 다섯의 장비 한 줄).
 * W-0225(사용자 10-15 "1만리 내 프로필이랑 장비 확인 할 수 있는 정보가 없네?") — 무기·보패는 인물 상세에만 흩어져 있었다.
 * ---------------------------------------------------------------
 * ui.js 가 `view({ esc, pt, titleOf, advText })` 로 부른다(상단 프로필 칸을 누르거나 오른쪽 단추줄 "나"). 읽기만 하고 세이브는 안 바꾼다.
 * 바꾸기(무기 고르기·보패 끼우기)는 인물 상세에서 — 줄을 누르면 그 인물 상세가 열린다(data-act="detail").
 */
(function (global) {
  'use strict';

  function view(h) {
    var esc = h.esc, core = global.DG.core, data = global.DG.data, H = global.DG.hero, WP = global.DG.weapon, AR = global.DG.artifact, MT = global.DG.mount;
    var p = core.save.player, need = core.expNeed(p.level) || 1, pct = Math.min(100, Math.round(p.exp / need * 100));
    var party = (core.save.party || []).filter(Boolean);
    var dexH = Object.keys((core.save.dex && core.save.dex.heroes) || {}).length, dexP = Object.keys((core.save.dex && core.save.dex.pets) || {}).length;
    var line = function (k, v) { return '<div class="dt-line"><span>' + k + '</span><b>' + v + '</b></div>'; };
    var ride = MT && MT.current ? MT.current() : null;
    /* W-0361 — 공용 「내 정보」 패널(입은 칸·들판 전투 수치·성도 단추)을 맨 위에. 어댑터 js/me-adapter.js */
    var MP = global.DG.mePanel, MA = global.DG.meAdapter, pm = MP && MA ? MA.model() : null, l0 = party.length ? data.find(party[0]) : null;
    if (pm && l0) { pm.portrait = h.pt('hero', l0, 56); }
    var out = '<div class="me-sheet">' + (pm ? '<div class="sec"><h4>🧑 내 정보</h4>' + MP.render(pm) + '</div>' : '') +
      '<div class="sec"><h4>🧭 내 프로필</h4>' +
        line('칭호', esc(h.titleOf(p.featTotal))) +
        line('모험 등급', esc(h.advText(p.level)) + ' · 경험 ' + pct + '%') +
        line('걸은 거리', core.fmt(p.distance || 0) + 'm') +
        line('도감', '인물 ' + dexH + '/' + (data.heroes || []).length + ' · 짐승 ' + dexP + '/' + (data.pets || []).length) +
        line('공적', core.fmt(p.featTotal || 0) + ' (쓸 수 있는 ' + core.fmt(p.feat || 0) + ')') +
        line('탈것', ride ? esc(ride.name || ride.id || String(ride)) : '타지 않음') +
      '</div>';

    if (!party.length) { return out + '<div class="sec"><h4>⚔️ 장비</h4><p class="muted">동행이 없습니다 — 인물을 등용해 동행에 넣으면 무기·보패를 낄 수 있습니다.</p></div></div>'; }

    var lead = data.find(party[0]);
    if (lead) {
      var g = H.info(lead.id), bk = H.breakdown(lead.id), fin = bk && bk.final ? bk.final : {};
      out += '<div class="sec"><h4>⭐ 선두 — 내 몸</h4>' +
        '<button class="me-lead" data-act="detail" data-id="' + esc(lead.id) + '">' + h.pt('hero', lead, 64) +
          '<span><b>' + esc(lead.name) + '</b> Lv.' + (g ? g.lv : 1) + '<br><small>무력 ' + (fin.might | 0) + ' · 지력 ' + (fin.wisdom | 0) + ' · 통솔 ' + (fin.command | 0) + '</small></span></button>' +
        (pm ? '' : equipLines(lead.id, WP, AR, esc, true)) + '</div>';   // 칸은 위 패널이 보인다
    }

    out += '<div class="sec"><h4>👥 동행 장비</h4>';
    party.forEach(function (id, i) {
      var r = data.find(id); if (!r) { return; }
      var gi = H.info(id);
      out += '<button class="me-row" data-act="detail" data-id="' + esc(id) + '">' + h.pt('hero', r, 36) +
        '<span><b>' + (i === 0 ? '⭐ ' : '') + esc(r.name) + '</b> Lv.' + (gi ? gi.lv : 1) + '<br><small>' + equipShort(id, WP, AR, esc) + '</small></span></button>';
    });
    return out + '<p class="muted">줄을 누르면 그 인물 상세에서 무기를 고르고 보패를 낍니다.</p></div></div>';
  }

  /** 무기 한 줄 + 보패 다섯 칸(선두는 칸마다, 동행은 한 줄로) */
  function equipLines(id, WP, AR, esc) {
    var out = '';
    if (WP) {
      var wid = WP.equipped(id), w = WP.info(wid), r = WP.rec(wid) || { lv: 1 }, t = WP.typeOf(id);
      out += '<div class="dt-line"><span>' + WP.TYPE_ICON[t] + ' 무기</span><b>★' + w.rarity + ' ' + esc(w.name) + (WP.isShared(wid) ? '' : ' Lv.' + r.lv) + '</b></div>';
    }
    if (AR) {
      var eq = AR.equippedOf(id);
      AR.SLOTS.forEach(function (slot) {
        out += '<div class="dt-line"><span>' + AR.SLOT_ICON[slot] + ' ' + AR.SLOT_NAMES[slot] + '</span><b>' + (eq[slot] ? esc(AR.label(eq[slot]).replace(/^\S+\s/, '')) : '<span class="muted">비움</span>') + '</b></div>';
      });
    }
    return out;
  }
  function equipShort(id, WP, AR, esc) {
    var s = [];
    if (WP) { var wid = WP.equipped(id), w = WP.info(wid); s.push(WP.TYPE_ICON[WP.typeOf(id)] + ' ★' + w.rarity + ' ' + esc(w.name)); }
    if (AR) { var n = Object.keys(AR.equippedOf(id)).length; s.push('🏺 보패 ' + n + '/' + AR.SLOTS.length); }
    return s.join(' · ');
  }

  global.DG = global.DG || {};
  global.DG.meSheet = { view: view, equipShort: equipShort };
})(window);
