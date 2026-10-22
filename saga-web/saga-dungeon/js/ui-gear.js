/**
 * 2나락 장비 시트(격자 가방·종이인형·창고) — ui.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * ui.js 가 `setup({ esc, ico, pt, tabBar, priceTag, GS })` 로 손잡이를 넘기고 같은 이름(gearSection)으로 부른다.
 * 짚은 물건·인물·탭(GS.sel·hero·tab)은 ui.js 의 handleAct 가 갈아 끼우므로 상태는 ui.js 에 두고 객체째 받는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var data = global.DG.data;
  function hero() { return global.DG.hero; }
  var esc, ico, pt, tabBar, priceTag, GS;
  var api = null;
  function setup(h) { esc = h.esc; ico = h.ico; pt = h.pt; tabBar = h.tabBar; priceTag = h.priceTag; GS = h.GS; return api; }

  /* ── 노획 장비 ────────────────────────────────────────────
   * 던전에서 주운 것을 여기서 갈아입힌다. 옛 '가방' 시트를 되살리는 대신
   * 던전 시트 안에 붙였다 — 장비가 나오는 곳이 던전 하나뿐이므로.
   */
  /* ── 장비 — 원작(2편)의 격자 가방과 종이인형 ───────
   *
   * 원작에서 가방은 목록이 아니라 **격자**다. 물건마다 차지하는 칸이 다르고,
   * 이름은 안 보이고 그림과 **등급 테두리**만 보인다. 무엇을 버릴지는 색으로
   * 정하고, 자세한 것은 하나를 짚었을 때 뜨는 검은 쪽지가 말한다.
   * 그 셋(격자 · 등급색 · 쪽지)을 그대로 옮겼다.
   *
   * 칸 수는 원작처럼 종류마다 다르다 — 무기·갑주는 두 칸을 먹고 부적은 한 칸이다.
   * 자리를 세이브에 적지는 않는다(격자 좌표를 저장하면 가방 구조가 통째로 바뀐다).
   * CSS grid 의 dense 배치에 맡기되, 순서를 값어치 순으로 고정해 자리가 안 흔들리게 한다.
   */


  /** 종류별 그림 — 원작의 물건 그림 자리다 (여기서는 글자 하나로 대신한다) */
  var LOOK_ICON = {
    sword: '\u2694\uFE0F', club: '\uD83D\uDD28', spear: '\uD83D\uDD31',
    guandao: '\uD83D\uDDE1\uFE0F', bow: '\uD83C\uDFF9', axe: '\uD83E\uDE93',
    fan: '\uD83E\uDEAD', staff: '\uD83E\uDD62', brush: '\uD83D\uDD8C\uFE0F',
    scroll: '\uD83D\uDCDC'
  };
  var SLOT_ICON = {
    weapon: '\u2694\uFE0F', armor: '\uD83E\uDD4B', charm: '\uD83D\uDCFF',
    helm: '\uD83E\uDE96', glove: '\uD83E\uDDE4', boot: '\uD83E\uDD7E',
    ring: '\uD83D\uDC8D', neck: '\uD83D\uDCFF'
  };
  var SLOT_SPAN = {
    weapon: 2, armor: 2, charm: 1,
    helm: 1, glove: 1, boot: 1, ring: 1, neck: 1
  };   // 세로로 먹는 칸 수

  function gearIcon(g) {
    var it = global.DG.item, b = it.baseOf(g);
    if (!b) { return '?'; }
    return ico('equip', g.uniq || g.base, '92%', (b.look && LOOK_ICON[b.look]) || SLOT_ICON[b.slot] || '?');
  }

  /** 효과 목록을 사람 말로 (투장·부문어가 같은 모양을 쓴다) */
  function effLines(list) {
    var it = global.DG.item, out = [], i;
    for (i = 0; i < list.length; i++) {
      var e = list[i];
      var who = e.stat === 'all' ? '전 능력치' : it.statKor(e.stat);
      if (e.kind === 'flat') { out.push(who + ' +' + e.v); }
      else if (e.kind === 'pct') { out.push(who + ' +' + e.v + '%'); }
      else { out.push(it.effKor(e.eff) + ' +' + e.v + '%'); }
    }
    return out;
  }

  /** 검은 쪽지 — 원작에서 물건 위에 뜨는 그것 */
  /** 창고 ↔ 가방 단추 — 쪽지 아래에 늘 붙는다 */
  function stashBtn(g, where) {
    return where === 'stash'
      ? '<button class="btn tiny ghost" data-act="gear-unstash" data-id="' + g.uid +
        '">\uD83C\uDF92 가방으로</button>'
      : '<button class="btn tiny ghost" data-act="gear-stash" data-id="' + g.uid +
        '">\uD83D\uDDC3\uFE0F 창고로</button>';
  }

  function gearTip(g, where) {
    var it = global.DG.item, t = it.tierOf(g), b = it.baseOf(g);
    var sn = it.socketsOf(g).length, se = it.emptySockets(g);
    var own = it.bestOwner(g);

    /* 미확인 — 원작에서 등급색은 보이고 옵션은 안 보인다.
       그 색만 보고 감정서를 태울지 정하는 것이 이 화면의 전부다. */
    if (it.isUnid(g)) {
      var have = it.scrolls();
      return '<div class="d2-tip">' +
        '<b class="d2-nm" style="color:' + t.color + '">' + esc(it.name(g)) + '</b>' +
        '<span class="d2-base">' + esc(b ? b.name : '') + ' \u00b7 ' + t.name +
          '(' + t.hanja + ') \u00b7 <b style="color:#8ec7ff">미확인</b></span>' +
        '<div class="muted">감정해야 옵션이 보입니다. <b>미확인은 입을 수 없습니다.</b></div>' +
        '<div class="d2-act">' +
          (have ? '<button class="btn tiny primary" data-act="gear-ident" data-id="' + g.uid +
                  '">\uD83D\uDD0E 감정 (감정서 ' + have + '장)</button>'
                : '<span class="muted" style="font-size:11px">감정서가 없습니다 — 행상에서 삽니다</span>') +
          '<button class="btn tiny ghost" data-act="gear-lock" data-id="' + g.uid + '">' +
            (g.lock ? '\uD83D\uDD12 잠김' : '\uD83D\uDD13 잠그기') + '</button>' +
          stashBtn(g, where) +
        '</div></div>';
    }

    var html = '<div class="d2-tip">' +
      '<b class="d2-nm" style="color:' + t.color + '">' + esc(it.name(g)) + '</b>' +
      '<span class="d2-base">' + esc(b ? b.name : '') + ' \u00b7 ' + t.name +
        '(' + t.hanja + ') \u00b7 값 ' + it.power(g) + '</span>';
    var ls = it.lines(g), i;
    for (i = 0; i < ls.length; i++) { html += '<div>' + esc(ls[i]) + '</div>'; }
    /* 비전(§5.10) — 전설 한 점에 하나, 그 비결을 건 무예를 키운다 */
    var lore1 = global.DG.secret && global.DG.secret.loreLine ? global.DG.secret.loreLine(g) : '';
    if (lore1) { html += '<div style="color:#f0a53a">' + esc(lore1) + '</div>'; }
    /* 내구 — 부적은 안 닳으므로 줄 자체가 없다 */
    var dmax = it.durMaxOf(g);
    if (dmax) {
      var dn = it.durOf(g), rc = it.repairCost(g);
      html += '<div style="color:' + (it.isBroken(g) ? 'var(--bad)' : 'var(--ink-dim)') + '">' +
        '내구 ' + dn + ' / ' + dmax +
        (it.isBroken(g) ? ' \u00b7 <b>부서짐 — 값을 못 냅니다</b>' : '') +
        (rc ? ' \u00b7 수리 ' + core.fmt(rc) + '금' : '') + '</div>';
    }
    /* 고유 — 이름 아래에 그 물건의 내력을 한 줄 (원작의 유니크가 그렇다) */
    var uq1 = it.uniqOf(g);
    if (uq1) {
      html += '<div style="color:#c7a76c;font-size:11px;margin-top:2px">⭐ ' +
        esc(uq1.desc) + '</div>';
    }

    /* 투장 — 몇 점 걸쳤는지, 지금 붙는 것과 아직 안 붙는 것 */
    var st1 = it.setOf(g);
    if (st1) {
      var worn = 0, hid;
      for (hid in core.save.gear.equip) {
        if (!Object.prototype.hasOwnProperty.call(core.save.gear.equip, hid)) { continue; }
        var c0 = it.setCounts(hid)[st1.key] || 0;
        if (c0 > worn) { worn = c0; }
      }
      html += '<div style="color:#00c000;margin-top:4px">〈' + esc(st1.name) + '〉 ' +
        worn + ' / ' + st1.pieces.length + ' 점</div>' +
        '<div class="muted" style="font-size:11px">' + esc(st1.desc) + '</div>';
      var kk;
      for (kk in st1.bonus) {
        if (!Object.prototype.hasOwnProperty.call(st1.bonus, kk)) { continue; }
        var on = worn >= parseInt(kk, 10);
        html += '<div style="font-size:11px;color:' + (on ? '#00c000' : 'var(--ink-faint)') + '">' +
          kk + '점 — ' + esc(effLines(st1.bonus[kk]).join(' · ')) + '</div>';
      }
      /* 투장 전용 무예(2026-09-10) — 세 점째의 진짜 보상. 아직 못 갖췄어도
         무엇을 노리고 모으는지 미리 보여 준다(원작에서 세트 물건의 다음
         줄이 다 그렇게 흐리게 미리 보인다). */
      if (st1.skill) {
        var skOn = worn >= 3;
        html += '<div style="font-size:11px;color:' + (skOn ? '#00c000' : 'var(--ink-faint)') + '">' +
          '3점 — 무예 ' + st1.skill.emoji + ' ' + esc(st1.skill.name) +
          ' · ' + esc(st1.skill.desc) + '</div>';
      }
    }
    if (sn) {
      html += '<div class="d2-sock">세공 구멍 ' + (sn - se) + ' / ' + sn +
        (se ? ' <span class="muted">(빈 구멍 ' + se + ')</span>' : '') + '</div>';
    }
    html += '<div class="d2-act">' +
      (own ? '<button class="btn tiny primary" data-act="gear-equip" data-id="' + g.uid +
             '" data-hero="' + own.id + '">' + esc((data.find(own.id) || {}).name || '') +
             ' 에게 (\u25b2' + own.gain + ')</button>'
           : '<span class="muted" style="font-size:11px">지금 동행에겐 보탬이 안 됩니다</span>') +
      '<button class="btn tiny ghost" data-act="gear-lock" data-id="' + g.uid + '">' +
        (g.lock ? '\uD83D\uDD12 잠김' : '\uD83D\uDD13 잠그기') + '</button>' + (global.DG.wpnSwap ? global.DG.wpnSwap.bagBtn(g) : '') +   // W-0281 을에 들기
      (it.repairCost(g) ? '<button class="btn tiny" data-act="gear-repair" data-id="' + g.uid +
        '">\uD83D\uDD27 수리 ' + priceTag(it.repairCost(g)) + '</button>' : '') +
      '<button class="btn tiny ghost" data-act="gear-sell" data-id="' + g.uid + '">' +
        '\uD83E\uDE99 ' + core.fmt(it.price(g)) + '</button>' +
      stashBtn(g, where) +
      '</div></div>';
    return html;
  }

  /** 종이인형 — 고른 인물이 걸치고 있는 것 */
  function gearDoll() {
    var it = global.DG.item;
    var party = core.save.party;
    if (!party.length) { return '<div class="hint">동행이 없습니다.</div>'; }
    if (party.indexOf(GS.hero) < 0) { GS.hero = party[0]; }
    var h = data.find(GS.hero);
    var eq = it.equipped(GS.hero);

    function slot(k, kor) {
      var g = eq[k];
      if (!g) {
        return '<div class="d2-dslot" data-dd-drop="slot:' + k + '" data-hero="' + GS.hero + '"><span class="muted">' + kor +
          '<small>비었다</small></span></div>';
      }
      var t = it.tierOf(g);
      if (it.isBroken(g)) {
        return '<div class="d2-dslot" data-act="gear-off" data-hero="' + GS.hero +
          '" data-slot="' + k + '" data-dd-drop="slot:' + k + '" data-dd="eq:' + GS.hero + ':' + k + '" title="벗는다">' +
          '<span style="color:var(--bad)">\uD83D\uDD27 ' + esc(it.name(g)) +
          '<small>' + kor + ' \u00b7 부서짐 \u2014 수리해야 값을 냅니다</small></span></div>';
      }
      return '<div class="d2-dslot" data-act="gear-off" data-hero="' + GS.hero +
        '" data-slot="' + k + '" data-dd-drop="slot:' + k + '" data-dd="eq:' + GS.hero + ':' + k + '" title="벗는다">' +
        '<span style="color:' + t.color + '">' + esc(it.name(g)) +
        '<small>' + kor + ' \u00b7 눌러 벗기</small></span></div>';
    }

    /* 인물 고르기 — 원작엔 없는 줄이지만 이 판은 동행이 여럿이라 있어야 한다 */
    var tabs = '', i;
    for (i = 0; i < party.length; i++) {
      var ph = data.find(party[i]);
      if (!ph) { continue; }
      tabs += '<button class="btn tiny' + (party[i] === GS.hero ? ' primary' : ' ghost') +
        '" data-act="gear-hero" data-hero="' + party[i] + '">' + esc(ph.name) + '</button>';
    }

    return '<div class="bagtools">' + tabs + '</div>' +
      '<div class="d2-doll">' +
        slot('weapon', '무기') +
        '<div class="d2-who">' + pt('hero', h, 46) +
          '<b>' + esc(h ? h.name : '') + '</b>' +
          '<small>Lv.' + (hero().info(GS.hero).lv || 1) + '</small></div>' +
        slot('armor', '갑주') +
      '</div>' + (global.DG.wpnSwap ? global.DG.wpnSwap.slotHtml(GS.hero) : '') +   // W-0281 무기 을 칸
      '<div class="d2-doll" style="grid-template-columns:1fr 1fr">' +
        slot('helm', '투구') + slot('glove', '장갑') +
      '</div>' +
      '<div class="d2-doll" style="grid-template-columns:1fr 1fr">' +
        slot('boot', '신발') + slot('ring', '반지') +
      '</div>' +
      '<div class="d2-doll" style="grid-template-columns:1fr 1fr">' +
        slot('neck', '목걸이') + slot('charm', '부적') +
      '</div>';
  }

  /** 격자 한 판 — 가방이든 창고든 같은 모양으로 그린다 */
  function gearGrid(list, where) {
    var it = global.DG.item;
    var sorted = list.slice().sort(function (a, b) { return it.power(b) - it.power(a); });
    var html = '<div class="d2-inv"' + (where === 'bag' ? ' data-dd-drop="bag"' : '') + '>', i, sel = null, used = 0;   // W-0362 가방 = 벗기 받는 자리
    for (i = 0; i < sorted.length; i++) {
      var g = sorted[i], t = it.tierOf(g), b = it.baseOf(g);
      var span = SLOT_SPAN[b ? b.slot : 'charm'] || 1;
      var ns = it.socketsOf(g).length;
      used += span;
      if (g.uid === GS.sel) { sel = g; }
      html += '<div class="d2-it' + (g.uid === GS.sel ? ' on' : '') + (g.lock ? ' lock' : '') +
        '" style="grid-row:span ' + span + ';box-shadow:inset 0 0 0 1px ' + t.color +
        ', inset 0 0 14px rgba(0,0,0,.8)" data-act="gear-sel" data-id="' + g.uid + (where === 'bag' && !it.isUnid(g) ? '" data-dd="' + g.uid : '') +
        '" data-where="' + where + '" title="' + esc(it.name(g)) + '">' +
        (it.isUnid(g) ? '?' : gearIcon(g)) +
        (it.isBroken(g) ? '<b class="d2-broke">\uD83D\uDD27</b>' : '') +
        (ns ? '<i style="color:' + t.color + '">' + ns + '홈</i>' : '') +
        '</div>';
    }
    var rows = Math.max(4, Math.ceil(used / 10) + 1);
    for (i = used; i < rows * 10; i++) { html += '<div class="d2-slot"></div>'; }
    return { html: html + '</div>', sel: sel };
  }

  /* ── 창고(倉庫) — 원작의 stash ────────────────────────────
   * 자리가 모자라서 두는 게 아니다(가방이 예순 칸이다).
   * 뜻은 하나 — **자동이 손대지 않는 자리**. 그 넷은 전부 bag() 만 훑으므로
   * 창고에 넣는 것만으로 저절로 지켜진다.
   */
  function viewStash() {
    var it = global.DG.item;
    var list = it.stash();
    var html = '<div class="sec"><h4>창고 <span class="muted">' +
      list.length + ' / ' + it.stashCap() + '</span></h4>' +
      '<div class="hint">창고에 넣어 둔 것은 <b>자동이 손대지 않습니다</b> \u2014 ' +
      '자동 정리에 팔리지 않고, 자동 장착·연단·되는 데까지 감정에도 안 씁니다.<br>' +
      '<span class="muted">원작 그대로 <b>던전 안에서는 열리지 않습니다</b>.</span></div>';
    if (!it.stashOpen()) {
      return html + '<div class="card"><small class="muted">던전에 들어가 있습니다 \u2014 ' +
        '나와서 여세요.</small></div></div>';
    }
    if (!list.length) {
      return html + '<div class="hint">비었습니다 \u2014 가방 탭에서 넣습니다.</div></div>';
    }
    var g = gearGrid(list, 'stash');
    html += g.html;
    html += g.sel ? gearTip(g.sel, 'stash')
                  : '<div class="hint">칸을 하나 누르면 그 물건의 쪽지가 뜹니다.</div>';
    return html + '</div>';
  }

  function gearSection() {
    var it = global.DG.item;
    if (!it) { return ''; }
    var head = tabBar('gear-tab', GS.tab,
      [['bag', '\uD83C\uDF92 \uAC00\uBC29'], ['stash', '\uD83D\uDDC3\uFE0F \uCC3D\uACE0']]);
    if (GS.tab === 'stash') { return head + viewStash(); }

    var bag = it.bag();
    var html = head + '<div class="sec"><h4>장비</h4>' + gearDoll() + '</div>';

    html += '<div class="sec"><h4>가방 <span class="muted">' +
      bag.length + ' / ' + it.bagCap() + '</span></h4>';

    if (!bag.length) {
      return html + '<div class="hint">가방이 비었습니다 \u2014 던전에서 주워 오세요.</div></div>';
    }

    /* 감정 — 미확인이 있으면 가장 먼저 할 일이다 */
    var unid = it.unidList().length, scroll = it.scrolls();
    if (unid) {
      html += '<div class="hint">미확인 <b style="color:#8ec7ff">' + unid + '점</b> · ' +
        '감정서 <b>' + scroll + '장</b><br>' +
        '<span class="muted">미확인은 입을 수 없고, 자동 정리에도 팔리지 않습니다.</span></div>' +
        '<div class="bagtools"><button class="btn tiny primary" data-act="gear-identall"' +
        (scroll ? '' : ' disabled') + '>\uD83D\uDD0E 되는 데까지 감정</button></div>';
    }

    html += '<div class="bagtools">' +
      '<button class="btn tiny" data-act="gear-auto">\u2728 자동 장착</button>' +
      '<button class="btn tiny ghost" data-act="gear-clean">\uD83E\uDDF9 쓸모없는 것 정리</button></div>';

    /* 격자는 gearGrid 하나가 그린다 — 가방과 창고가 같은 모양이어야 한다 */
    if (GS.sel && !it.findAnywhere(GS.sel)) { GS.sel = null; }
    var gr = gearGrid(bag, 'bag');
    html += gr.html;
    html += gr.sel ? gearTip(gr.sel, 'bag')
                   : '<div class="hint">칸을 하나 누르면 그 물건의 쪽지가 뜹니다.</div>';

    return html + '</div>';
  }

  api = { setup: setup, gearSection: gearSection, gearIcon: gearIcon };
  global.DG = global.DG || {};
  global.DG.uiGear = api;
})(typeof window !== 'undefined' ? window : this);
