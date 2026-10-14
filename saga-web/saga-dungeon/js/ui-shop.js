/**
 * 2나락 행상(行商)·세공(細工)·연단(鍊丹) 화면 — ui.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * ui.js 가 `setup({ esc, ico, priceTag, tabBar, S })` 로 손잡이를 넘기고 같은 이름(viewVendor·viewCraft)으로 부른다.
 * 탭·고른 재료(craftTab·vendorTab·craftMat)는 ui.js 클릭 처리가 바꾸므로 거기 두고 S 게터로만 읽는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var data = global.DG.data;
  var esc, ico, priceTag, tabBar, S;
  var api = null;
  function setup(h) {
    esc = h.esc; ico = h.ico; priceTag = h.priceTag; tabBar = h.tabBar; S = h.S;
    return api;
  }

  function viewVendor() {
    if (!global.DG.vendor) { return '<div class="hint">행상 모듈이 없습니다</div>'; }
    var head = tabBar('vendor-tab', S.vendorTab(), [
      ['buy', '\uD83E\uDDFA \uC0AC\uB2E4'], ['sell', '\uD83E\uDE99 \uD314\uB2E4'],
      ['back', '\u21A9\uFE0F \uB418\uC0AC\uAE30'], ['gamble', '\uD83C\uDFB2 \uD22C\uC804']
    ]);
    return head + (S.vendorTab() === 'sell' ? vendorSell()
                 : S.vendorTab() === 'back' ? vendorBack()
                 : S.vendorTab() === 'gamble' ? vendorGamble()
                 : vendorBuy());
  }

  /** 물건 한 줄 — 이름(등급색) · 옵션 · 오른쪽에 단추 */
  function gearRow(g, btn) {
    var it = global.DG.item, t = it.tierOf(g);
    var ns = it.socketsOf(g).length;
    return '<div class="grow" style="border-left-color:' + t.color + '">' +
      '<div class="gr-top"><b style="color:' + t.color + '">' + esc(it.name(g)) + '</b>' +
      '<span class="gr-lv">' + t.name + (ns ? ' \u00B7 ' + ns + '\uD640' : '') + '</span></div>' +
      '<div class="gr-opts">' + esc(it.lines(g).join(' \u00B7 ')) + '</div>' +
      (global.DG.secret && global.DG.secret.loreLine && global.DG.secret.loreLine(g)
        ? '<div class="gr-opts" style="color:#f0a53a">' + esc(global.DG.secret.loreLine(g)) + '</div>' : '') +
      '<div class="gr-btns">' + btn + '</div></div>';
  }

  /** 단약 — 원작의 상인은 물약이 떨어지지 않는다. 재고 목록을 안 탄다 */
  function vendorPotions() {
    var V = global.DG.vendor, P = global.DG.potion;
    if (!P) { return ''; }
    var list = V.potionsForSale(), i;
    var html = '<div class="sec"><h4>단약(丹藥) <span class="muted">요대 ' +
      P.total() + ' / ' + (P.SLOTS * P.STACK) + '</span></h4>' +
      '<div class="hint">물약은 <b>떨어지지 않습니다</b> — 늘 살 수 있습니다. ' +
      '던전에서 <b>1 2 3 4</b> 로 마십니다.<br>' +
      '<span class="muted">파는 등급은 내려가 본 깊이를 탑니다.</span></div>' +
      '<div class="bagtools" style="flex-wrap:wrap">';
    /* 감정서 — 원작의 감정 주문서. 막는 관문이 아니라 거쳐 가는 자리라 싸다 */
    html += '<button class="btn tiny" data-act="vendor-scroll" data-n="1">' +
      '\uD83D\uDD0E 감정서 ' + priceTag(V.scrollPrice()) + '</button>' +
      '<button class="btn tiny" data-act="vendor-scroll" data-n="10">' +
      '\uD83D\uDD0E ×10 ' + priceTag(V.scrollPrice() * 10) + '</button>';
    for (i = 0; i < list.length; i++) {
      var row = list[i], kd = P.kindOf(row.kind);
      html += '<button class="btn tiny" data-act="vendor-potion" data-kind="' + row.kind +
        '" data-g="' + row.g + '" style="color:' + kd.color + '">' +
        kd.emoji + ' ' + esc(P.label(row.kind, row.g)) + ' ' + priceTag(row.price) +
        '</button>';
    }
    return html + '</div></div>';
  }

  /** 수리 — 원작에서 마을에 들르는 이유의 절반이 이것이다 */
  function vendorRepair() {
    var it = global.DG.item;
    var need = it.repairList(), cost = it.repairAllCost();
    var html = '<div class="sec"><h4>수리(修理)</h4>' +
      '<div class="hint">장비는 <b>층을 내려갈 때마다</b> 닳습니다. ' +
      '다 닳으면 <b>부서져 아무 값도 못 냅니다</b> \u2014 없어지지는 않습니다.<br>' +
      '<span class="muted">부적은 닳지 않습니다.</span></div>';
    if (!need.length) {
      return html + '<div class="card"><small class="muted">닳은 것이 없습니다.</small></div></div>';
    }
    html += '<div class="bagtools"><button class="btn tiny primary" data-act="gear-repairall">' +
      '\uD83D\uDD27 모두 수리 ' + priceTag(cost) + '</button></div>';
    var i;
    for (i = 0; i < need.length; i++) {
      var g = need[i].item, t = it.tierOf(g);
      html += '<div class="grow" style="border-left-color:' +
        (it.isBroken(g) ? 'var(--bad)' : t.color) + '">' +
        '<div class="gr-top"><b style="color:' + t.color + '">' + esc(it.name(g)) + '</b>' +
        '<span class="gr-lv">' + esc((data.find(need[i].hero) || {}).name || '') + '</span></div>' +
        '<div class="gr-opts' + (it.isBroken(g) ? ' warn' : '') + '">내구 ' +
          it.durOf(g) + ' / ' + it.durMaxOf(g) +
          (it.isBroken(g) ? ' · 부서짐' : '') + '</div>' +
        '<div class="gr-btns"><button class="btn tiny" data-act="gear-repair" data-id="' +
          g.uid + '">\uD83D\uDD27 ' + priceTag(it.repairCost(g)) + '</button></div></div>';
    }
    return html + '</div>';
  }

  function vendorBuy() {
    var V = global.DG.vendor, list = V.stock(), i;
    var html = vendorRepair() + vendorPotions() +
      '<div class="sec"><h4>사다 <span class="muted">수준 ' + V.ilvl() + '</span></h4>' +
      '<div class="hint">재고는 <b>회차가 끝날 때마다</b> 새로 옵니다 \u2014 ' +
      '마음에 안 들면 한 판 더 돌고 오세요. 새로 고치는 단추는 없습니다.<br>' +
      '<span class="muted">보물·전설은 팔지 않습니다. 그건 던전과 투전에서만 나옵니다.</span></div>';
    if (!list.length) {
      html += '<div class="card"><small class="muted">물건을 다 샀습니다 \u2014 ' +
        '다음 회차에 새로 옵니다.</small></div>';
    }
    for (i = 0; i < list.length; i++) {
      html += gearRow(list[i],
        '<button class="btn tiny primary" data-act="vendor-buy" data-id="' + list[i].uid + '">' +
        priceTag(V.buyPrice(list[i])) + ' 사기</button>');
    }
    return html + '</div>';
  }

  function vendorSell() {
    var it = global.DG.item, bag = it.bag(), i;
    var html = '<div class="sec"><h4>팔다 <span class="muted">' + bag.length + '점</span></h4>' +
      '<div class="hint">판 것은 <b>되사기</b>에 남습니다 \u2014 판 값 그대로 되살 수 있습니다. ' +
      '다만 <b>회차가 끝나면 사라집니다</b>.</div>';
    var sorted = bag.slice().sort(function (a, b) { return it.power(a) - it.power(b); });
    if (!sorted.length) {
      html += '<div class="card"><small class="muted">가방이 비었습니다.</small></div>';
    }
    for (i = 0; i < sorted.length; i++) {
      var g = sorted[i];
      html += gearRow(g, g.lock
        ? '<span class="muted" style="font-size:11px">\uD83D\uDD12 잠겨 있습니다</span>'
        : '<button class="btn tiny" data-act="vendor-sell" data-id="' + g.uid + '">' +
          '\uD83E\uDE99 ' + core.fmt(it.price(g)) + ' 에 팔기</button>');
    }
    return html + '</div>';
  }

  function vendorBack() {
    var V = global.DG.vendor, list = V.backlog(), i;
    var html = '<div class="sec"><h4>되사기</h4>' +
      '<div class="hint">방금 판 것들입니다. <b>판 값 그대로</b> 되살 수 있습니다.</div>';
    if (!list.length) {
      html += '<div class="card"><small class="muted">아직 판 것이 없습니다.</small></div>';
    }
    for (i = 0; i < list.length; i++) {
      html += gearRow(list[i].item,
        '<button class="btn tiny primary" data-act="vendor-back" data-id="' +
        list[i].item.uid + '">' + priceTag(list[i].price) + ' 되사기</button>');
    }
    return html + '</div>';
  }

  function vendorGamble() {
    var V = global.DG.vendor, D = global.DG.itemData, list = V.gambleList(), i;
    var html = '<div class="sec"><h4>투전(投錢)</h4>' +
      '<div class="hint"><b>무엇이 나올지는 사고 나서 압니다.</b> 부위와 종류만 알려 줍니다.<br>' +
      '값은 비싸지만 <b>좋은 등급이 훨씬 잘 나옵니다</b> \u2014 던전 드랍보다 위쪽이 두껍습니다.<br>' +
      '<span class="muted">한 칸을 사면 그 자리에 새 물건이 놓입니다.</span></div>';
    for (i = 0; i < list.length; i++) {
      var row = list[i];
      var b = D.baseByKey(row.base);
      if (!b) { continue; }
      html += '<div class="grow" style="border-left-color:#6b5836">' +
        '<div class="gr-top"><b>' + esc(b.name) + '</b>' +
        '<span class="gr-lv">' + D.slotKor(b.slot) + ' \u00B7 수준 ' + row.lv + '</span></div>' +
        '<div class="gr-opts muted">등급도 옵션도 알 수 없습니다.</div>' +
        '<div class="gr-btns"><button class="btn tiny primary" data-act="vendor-gamble" ' +
          'data-idx="' + i + '">' + priceTag(row.price) + ' 걸기</button></div></div>';
    }
    return html + '</div>';
  }


  function viewCraft() {
    return tabBar('craft-tab', S.craftTab(),
             [['socket', '\uD83D\uDD28 \uC138\uACF5'], ['forge', '\u2697\uFE0F \uC5F0\uB2E8']]) +
           (S.craftTab() === 'forge' ? viewForge() : viewSocket());
  }

  /* ── 연단(鍊丹) — 원작의 조합 상자 ────────────────────
   * 규칙은 forge.js 가 다 안다. 여기는 그 표를 읽어 늘어놓기만 한다.
   */
  function viewForge() {
    var F = global.DG.forge;
    if (!F) { return '<div class="hint">연단 모듈이 없습니다</div>'; }
    var html = '<div class="sec"><h4>연단(鍊丹)</h4><div class="card">' +
      '<small class="muted">여럿을 넣으면 <b>더 나은 하나</b>가 나옵니다. ' +
      '재료는 <b>그 자리에서 사라집니다</b> \u2014 잠근 것은 재료로 쓰지 않습니다.<br>' +
      '<b>구멍은 뚫을 수 없습니다</b> \u2014 구멍은 장비가 나올 때 정해집니다.</small>' +
      '</div></div>';

    var groups = F.all(), i, j, any = false;
    for (i = 0; i < groups.length; i++) {
      var r = groups[i].recipe, rows = groups[i].rows;
      html += '<div class="sec"><h4>' + r.emoji + ' ' + esc(r.name) + '</h4>' +
        '<div class="hint">' + esc(r.need) + '<br><span class="muted">' +
        esc(r.desc) + '</span></div>';
      if (!rows.length) {
        html += '<div class="card"><small class="muted">지금은 넣을 것이 없습니다.</small></div>';
      } else {
        any = true;
        for (j = 0; j < rows.length; j++) {
          var row = rows[j];
          html += '<div class="grow" style="border-left-color:' + row.color + '">' +
            '<div class="gr-top"><b>' + esc(row.label) + '</b>' +
            '<span class="gr-lv">\u2192 <span style="color:' + row.color + '">' +
              esc(row.into) + '</span></span></div>' +
            '<div class="gr-btns"><button class="btn tiny primary" data-act="forge-make" ' +
              'data-id="' + esc(row.id) + '">\u2697\uFE0F 넣는다</button>' +
            (row.have > 1 ? '<span class="muted" style="font-size:11px">가진 것 ' +
              row.have + '</span>' : '') +
            '</div></div>';
        }
      }
      html += '</div>';
    }
    if (!any) {
      html += '<div class="hint">재료가 더 모이면 여기에 뜹니다 \u2014 ' +
        '같은 보석 셋, 같은 부문 셋, 같은 부위·등급의 장비 셋.</div>';
    }
    return html;
  }

  function viewSocket() {
    var it = global.DG.item, GD = global.DG.gemData;
    var mats = it.matList();
    var html = '<div class="sec"><h4>세공</h4><div class="card">' +
      '<small class="muted">박을 것을 고르고, 아래에서 <b>박을 장비</b>를 고릅니다. ' +
      '<b>한 번 박은 것은 뺄 수 없습니다.</b><br>' +
      '부문(符文)은 <b>박은 순서</b>가 맞아야 부문어(符文語)가 이루어집니다.<br>' +
      '<b>주옥(珠玉)</b>은 접사가 굴러 나옵니다 — 보석과 달리 <b>부위를 안 가립니다</b>.</small>';
    if (S.craftMat()) {
      var d;
      if (S.craftMat().kind === 'jewel') {
        var jsel = it.jewelById(S.craftMat().key);
        d = jsel ? GD.jewelName(jsel) : '주옥';
      } else if (S.craftMat().kind === 'gem') {
        d = GD.grade(S.craftMat().g).name + ' ' + GD.gemByKey(S.craftMat().key).name;
      } else {
        d = GD.runeByKey(S.craftMat().key).glyph + '(' + GD.runeByKey(S.craftMat().key).name + ')';
      }
      html += '<div class="stat-row"><span>고른 것</span><b>' + esc(d) + '</b></div>' +
        '<button class="btn tiny ghost wide" data-act="craft-cancel">고른 것을 놓는다</button>';
    }
    html += '</div></div>';

    /* 가진 재료 */
    html += '<div class="sec"><h4>가진 것</h4>';
    if (!mats.length) {
      html += '<div class="card"><small class="muted">아직 없습니다 — 던전에서 나옵니다. ' +
        '부문은 층이 깊어야 나옵니다.</small></div>';
    } else {
      html += '<div class="bagtools">';
      for (var i = 0; i < mats.length; i++) {
        var m = mats[i];
        if (m.kind === 'jewel') { continue; }        // 주옥은 아래에 낱개로 늘어놓는다
        var lab = m.kind === 'gem'
          ? (m.grade.name + ' ' + m.def.name)
          : (m.def.glyph + '(' + m.def.name + ')');
        var col = m.kind === 'gem' ? m.grade.color : '#f0a53a';
        var on = S.craftMat() && S.craftMat().kind === m.kind && S.craftMat().key === m.key &&
                 (m.kind === 'rune' || S.craftMat().g === m.g);
        html += '<button class="btn tiny ' + (on ? 'primary' : '') + '" data-act="craft-pick"' +
          ' data-kind="' + m.kind + '" data-key="' + m.key + '" data-g="' + (m.g || 0) + '"' +
          ' style="color:' + (on ? '' : col) + '">' + (m.kind === 'gem' ? ico('gem', m.key, 18, '') : '') + esc(lab) + ' ×' + m.n + '</button>';
      }
      html += '</div>';
    }

    /* 주옥(珠玉) — 낱개라 개수로 못 묶는다. 하나하나가 딴 물건이므로
       무엇이 붙었는지 **줄로 보여 준다** — 그걸 보고 어디에 박을지 정한다 */
    var jl = it.jewels();
    html += '<div><h4 style="margin:10px 0 4px;font-size:13px">' +
      '◈ 주옥(珠玉) <small class="muted">' + jl.length + ' / ' + it.jewelCap() +
      '</small></h4>';
    if (!jl.length) {
      html += '<div class="card"><small class="muted">아직 없습니다 — ' +
        '<b>제4층부터</b> 드물게 나옵니다. 보석과 달리 <b>부위를 안 가립니다</b>.</small></div>';
    }
    for (var jx = 0; jx < jl.length; jx++) {
      var jw = jl[jx];
      var jon = S.craftMat() && S.craftMat().kind === 'jewel' && S.craftMat().key === jw.id;
      var jlines = [], je = GD.jewelEff(jw), jy;
      for (jy = 0; jy < je.length; jy++) { jlines.push(it.effLine(je[jy])); }
      html += '<div class="card gearcard">' +
        '<div class="gearname" style="color:#f07ac0">◈ ' + esc(GD.jewelName(jw)) + '</div>' +
        '<div class="muted" style="font-size:11.5px">' + esc(jlines.join(' · ')) + '</div>' +
        '<button class="btn tiny ' + (jon ? 'primary' : 'ghost') + '" data-act="craft-pick"' +
          ' data-kind="jewel" data-key="' + esc(jw.id) + '" data-g="0">' +
          (jon ? '고른 것' : '고른다') + '</button>' +
      '</div>';
    }
    html += '</div>';
    html += '</div>';

    /* 구멍이 있는 장비 — 장착한 것과 가방을 함께 */
    var targets = [];
    var party = core.save.party, k, j;
    for (j = 0; j < party.length; j++) {
      var eq = it.equipped(party[j]);
      for (k in eq) {
        if (Object.prototype.hasOwnProperty.call(eq, k) && eq[k] && it.socketsOf(eq[k]).length) {
          targets.push({ g: eq[k], who: (data.find(party[j]) || {}).name || '' });
        }
      }
    }
    var bagList = it.bag();
    for (j = 0; j < bagList.length; j++) {
      if (it.socketsOf(bagList[j]).length) { targets.push({ g: bagList[j], who: null }); }
    }

    html += '<div class="sec"><h4>구멍 있는 장비 <small class="muted">' +
      targets.length + '점</small></h4>';
    if (!targets.length) {
      html += '<div class="card"><small class="muted">구멍은 장비가 나올 때 정해집니다 — ' +
        '좋은 등급일수록 뚫려 나오기 쉽습니다.</small></div>';
    }
    for (j = 0; j < Math.min(14, targets.length); j++) {
      var tg = targets[j], gitem = tg.g, tier = it.tierOf(gitem);
      var sock = it.socketsOf(gitem), cells = '';
      for (var c = 0; c < sock.length; c++) {
        var s0 = sock[c];
        if (!s0) { cells += '<span class="sockcell empty">·</span>'; continue; }
        if (s0.t === 'jewel') {
          cells += '<span class="sockcell" style="color:#f07ac0">◈</span>';
        } else if (s0.t === 'rune') {
          var rd = GD.runeByKey(s0.key);
          cells += '<span class="sockcell rune">' + (rd ? rd.glyph : '符') + '</span>';
        } else {
          var gd2 = GD.gemByKey(s0.key);
          cells += '<span class="sockcell" style="color:' + GD.grade(s0.g).color + '">' +
            (gd2 ? ico('gem', s0.key, 20, gd2.emoji) : '●') + '</span>';
        }
      }
      var word = it.wordOf(gitem);
      html += '<div class="card gearcard">' +
        '<div class="gearname" style="color:' + (word ? '#f0a53a' : tier.color) + '">' +
          esc(it.name(gitem)) +
          (tg.who ? ' <small class="muted">— ' + esc(tg.who) + '</small>' : '') + '</div>' +
        '<div class="socks">' + cells + '</div>' +
        '<div class="muted" style="font-size:11.5px">' + esc(it.lines(gitem).join(' · ')) + '</div>' +
        (word
          ? '<small style="color:#f0a53a">《' + esc(word.name) + '》 ' + esc(word.desc) + '</small>'
          : (it.emptySockets(gitem)
              ? '<button class="btn tiny ' + (S.craftMat() ? 'primary' : 'ghost') + '"' +
                  (S.craftMat() ? '' : ' disabled') +
                  ' data-act="craft-into" data-id="' + gitem.uid + '">여기에 박는다 (빈 구멍 ' +
                  it.emptySockets(gitem) + ')</button>'
              : '<small class="muted">구멍이 다 찼습니다</small>')) +
      '</div>';
    }
    html += '</div>';

    /* 부문어 표 — 무엇을 노릴지 보이게 */
    html += '<div class="sec"><h4>부문어(符文語)</h4>';
    for (var w = 0; w < GD.WORDS.length; w++) {
      var wd = GD.WORDS[w];
      var glyphs = wd.runes.map(function (rk) {
        var r = GD.runeByKey(rk);
        return r ? r.glyph : '?';
      }).join(' ');
      html += '<div class="card"><div class="stat-row">' +
        '<span><b>' + esc(wd.name) + '</b></span>' +
        '<b style="font-size:15px">' + glyphs + '</b></div>' +
        '<small class="muted">' + esc(wd.desc) +
        (wd.slot ? ' · <b>' + (wd.slot === 'weapon' ? '무기' : wd.slot) + '</b> 에만' : '') +
        '</small></div>';
    }
    return html + '</div>';
  }

  api = { setup: setup, viewVendor: viewVendor, viewCraft: viewCraft };
  global.DG = global.DG || {};
  global.DG.uiShop = api;
})(typeof window !== 'undefined' ? window : this);
