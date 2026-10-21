  /* ── 가방 · 저자 ──────────────────────────────────────── */

  function optLine(s) {
    var bits = [];
    if (s.atk) { bits.push('공격 +' + s.atk); }
    if (s.def) { bits.push('방어 +' + s.def); }
    if (s.hp) { bits.push('체력 +' + s.hp); }
    return bits.join(' · ') || '—';
  }

  /** 그 물건에 쓸 수 있는, 지금 가진 주문서 버튼들 */
  function scrollButtons(G, it) {
    var d = G.defOf(it);
    var kind = d.slot === 'weapon' ? 'weapon' : 'armor';
    var list = global.DG.gearData.SCROLLS, html = '';
    for (var i = 0; i < list.length; i++) {
      var sc = list[i];
      if (sc['for'] !== kind) { continue; }
      var n = G.scrollCount(sc.key);
      if (n <= 0) { continue; }
      html += '<button class="btn tiny" data-act="g-scroll" data-uid="' + it.uid +
        '" data-scroll="' + sc.key + '" title="' + esc(sc.name + ' — ' + sc.desc) + '">' + ico('consumable', sc.key, 18, '📜') + ' ' +
        Math.round(sc.rate * 100) + '% ×' + n + '</button> ';
    }
    return html;
  }

  function viewBag() {
    var G = global.DG.gear, GD = global.DG.gearData;
    var S = global.DG.side;
    var eq = G.equipped(), bo = G.bonus(), pw = S.power();
    var i, html = '';

    html += '<div class="sec"><h4>낀 것</h4><div class="card">';
    for (i = 0; i < GD.SLOTS.length; i++) {
      var sl = GD.SLOTS[i], it = eq[sl.key];
      html += '<div class="stat-row" data-dd-drop="slot:' + sl.key + '"' + (it ? ' data-dd="eq:' + sl.key + '"' : '') + '><span>' + sl.emoji + ' ' + esc(sl.name) + '</span>';   // W-0362 끌어 놓기 칸
      if (it) {
        html += '<span>' + ico('equip', it.key, 24, '') + '<b>' + esc(G.nameOf(it)) + '</b>' + gradeTag(GD, G.defOf(it)) + ' <small class="muted">' +
          esc(optLine(G.statsOf(it))) + '</small> ' +
          '<button class="btn tiny ghost" data-act="g-unequip" data-slot="' + sl.key +
          '">벗기</button></span>';
      } else {
        html += '<span class="muted">비어 있음</span>';
      }
      html += '</div>';
    }
    html += '<div class="stat-row" style="border-top:1px solid rgba(255,255,255,.12);padding-top:6px">' +
      '<span>합</span><b>공격 +' + bo.atk + ' · 방어 +' + bo.def + ' · 체력 +' + bo.hp + '</b></div>' +
      '<div class="stat-row"><span>지금 몸</span><b>체력 ' + core.fmt(pw.hp) +
        ' · 공격 ' + core.fmt(pw.atk) + '</b></div>' +
      '<small class="muted">방어는 맞는 값을 깎습니다 — 아무리 높아도 <b>6할까지</b>. ' +
      '지금 ' + Math.round(G.cut(bo.def) * 100) + '% 덜 맞습니다.</small>' +
      '</div></div>';

    var inv = G.inv();
    html += '<div class="sec" data-dd-drop="bag"><h4>가방 <small class="muted">' + inv.length + ' / ' + G.BAG +
      '</small></h4>';
    if (!inv.length) {
      html += '<div class="hint">아직 아무것도 없습니다. 적이 가끔 떨구고, 🏪 저자에서도 삽니다.</div>';
    }
    for (i = 0; i < inv.length; i++) {
      var g = inv[i], d = G.defOf(g), on = G.isEquipped(g.uid);
      var canWear = core.save.player.level >= d.need;
      html += '<div class="card' + (on ? ' on' : '') + '"' + (on ? '' : ' data-dd="' + g.uid + '"') + '>' +
        '<div class="stat-row"><span>' + ico('equip', g.key, 24, '') + '<b>' + esc(G.nameOf(g)) + '</b>' + gradeTag(GD, d) +
          (on ? ' <small class="muted">— 끼고 있음</small>' : '') + '</span>' +
          '<span class="muted">' + esc(GD.slot(d.slot).name) + ' · Lv.' + d.need + '</span></div>' +
        '<div class="stat-row"><span class="muted">' + esc(optLine(G.statsOf(g))) + '</span>' +
          '<span class="muted">업횟 ' + g.left + '</span></div>' +
        (G.isUnique(g) && d.desc ? '<div class="hint">' + esc(d.desc) + '</div>' : '') +
        '<div class="btn-row">' +
          (on ? '' : (canWear
            ? '<button class="btn tiny primary" data-act="g-equip" data-uid="' + g.uid + '">낀다</button> '
            : '<button class="btn tiny ghost" disabled>🔒 Lv.' + d.need + '</button> ')) +
          (g.left > 0 ? scrollButtons(G, g) : '<small class="muted">업횟 없음 </small>') +
          (on ? '' : '<button class="btn tiny ghost" data-act="g-sell" data-uid="' + g.uid +
            '">팔기 🪙' + core.fmt(Math.round(d.price * G.SELL_RATE)) + '</button>') +
        '</div></div>';
    }
    html += '</div>';

    /* 가진 주문서 */
    var sc = GD.SCROLLS.filter(function (s) { return G.scrollCount(s.key) > 0; });
    html += '<div class="sec"><h4>주문서</h4>';
    if (!sc.length) {
      html += '<div class="hint">주문서는 적이 떨구거나 🏪 저자에서 삽니다. ' +
        '<b>실패해도 물건은 남습니다</b> — 닳는 것은 업횟뿐입니다.</div>';
    } else {
      html += '<div class="card">';
      for (i = 0; i < sc.length; i++) {
        html += '<div class="stat-row"><span>' + ico('consumable', sc[i].key, 22, '📜') + ' ' + esc(sc[i].name) + '</span>' +
          '<b>×' + G.scrollCount(sc[i].key) + '</b></div>';
      }
      html += '<small class="muted">물건 아래의 📜 단추로 씁니다. 실패해도 물건은 남고 ' +
        '업횟만 닳습니다.</small></div>';
    }
    html += '</div>';

    /* 캔 것(PLAN 10절) — 필드에 서 있는 것을 지나가면 줍는다. 칸을 차지하지
       않는 카운터라 가방과는 딴 줄에 둔다 */
    var SD = global.DG.sideData, mats = S.state().mats || {}, gk = Object.keys(SD.GATHERS);
    var got = gk.filter(function (k) { return mats[k] > 0; });
    html += '<div class="sec"><h4>캔 것</h4>' + (global.DG.life ? global.DG.life.ranksHtml() : '');   // W-0283 생활 랭크 셋
    if (!got.length) {
      html += '<div class="hint">사냥터를 걷다 보면 꽃·열매·광물이 서 있습니다. 지나가면 줍습니다.</div>';
    } else {
      html += '<div class="card">';
      for (i = 0; i < got.length; i++) {
        var gi = SD.GATHERS[got[i]];
        html += '<div class="stat-row"><span>' + gi.emoji + ' ' + esc(gi.name) + '</span>' +
          '<b>×' + mats[got[i]] + '</b></div>';
      }
      html += '<small class="muted">🏪 저자 아래 "캔 것으로 만들기"에서 탕약·주문서로 바꿉니다.</small></div>';
    }
    html += '</div>';
    return html;
  }

  /* 🥋 무예 시트 그리기는 js/ui-job.js(R-4) — 같은 이름 한 줄 넘김 */
  var ujH = null; function UJ() { return global.DG.uiJob.setup(ujH || (ujH = { esc: esc, pt: pt })); }
  function viewJob() { return UJ().viewJob(); }

  function viewShop() {
    var G = global.DG.gear, GD = global.DG.gearData;
    var list = G.shopList();
    var gold = core.save.player.gold;
    var i, html = '<div class="sec"><h4>가진 것</h4><div class="card">' +
      '<div class="stat-row"><span>금</span><b>🪙 ' + core.fmt(gold) + '</b></div>' +
      '<div class="stat-row"><span>탕약</span><b>🧪 ' +
        global.DG.side.status().potions + '</b></div>' +
      '<div class="stat-row"><span>가방</span><b>' + (G.BAG - G.bagLeft()) + ' / ' + G.BAG +
        '</b></div></div></div>';

    html += '<div class="sec"><h4>탕약</h4><div class="card">' +
      '<div class="stat-row"><span>🧪 탕약</span><span class="muted">🪙 ' +
        list.potion.price + ' / 개</span></div>' +
      '<div class="btn-row">' +
        '<button class="btn tiny primary" data-act="sh-potion" data-n="1">1개</button> ' +
        '<button class="btn tiny" data-act="sh-potion" data-n="10">10개 🪙' +
          core.fmt(list.potion.price * 10) + '</button>' +
      '</div></div></div>';

    html += '<div class="sec"><h4>물건 <small class="muted">— 수준이 오르면 목록이 늡니다</small></h4>';
    for (i = 0; i < list.gears.length; i++) {
      var g = list.gears[i];
      html += '<div class="card"><div class="stat-row">' +
        '<span><b>' + esc(g.name) + '</b>' + gradeTag(GD, g) + ' <small class="muted">' +
          esc(GD.slot(g.slot).name) + ' · Lv.' + g.need + '</small></span>' +
        '<span class="muted">' + esc(optLine(g)) + '</span></div>' +
        '<button class="btn tiny ' + (gold >= g.price ? 'primary' : 'ghost') + '"' +
          ' data-act="sh-gear" data-key="' + g.key + '">🪙 ' + core.fmt(g.price) + ' 에 산다</button>' +
        '</div>';
    }
    html += '</div>';

    html += '<div class="sec"><h4>주문서</h4>';
    for (i = 0; i < list.scrolls.length; i++) {
      var s = list.scrolls[i];
      html += '<div class="card"><div class="stat-row">' +
        '<span><b>📜 ' + esc(s.name) + '</b></span>' +
        '<span class="muted">' + esc(optLine(s)) + ' · 가진 것 ' +
          G.scrollCount(s.key) + '</span></div>' +
        '<div class="stat-row"><span class="muted">' + esc(s.desc) + '</span>' +
          '<button class="btn tiny ' + (gold >= s.price ? 'primary' : 'ghost') + '"' +
          ' data-act="sh-scroll" data-key="' + s.key + '">🪙 ' + core.fmt(s.price) + '</button>' +
        '</div></div>';
    }
    html += '</div>';
    /* 캔 것으로 만들기(data-side.js RECIPES) — 금 대신 사냥터에서 주운 것으로 */
    var SD = global.DG.sideData, mats = global.DG.side.state().mats || {};
    html += '<div class="sec"><h4>🧺 캔 것으로 만들기 <small class="muted">— 사냥터에서 주운 꽃·열매·광물</small></h4>';
    for (i = 0; i < SD.RECIPES.length; i++) {
      var r = SD.RECIPES[i], can = !Object.keys(G.craftLack(r.key)).length, parts = [], k;
      for (k in r.need) {
        if (r.need.hasOwnProperty(k)) {
          parts.push(SD.GATHERS[k].emoji + ' ' + (mats[k] || 0) + '/' + r.need[k]);
        }
      }
      var out = r.give.potion ? '🧪 탕약 ×' + r.give.potion : '📜 ' + GD.scroll(r.give.scroll).name;
      html += '<div class="card"><div class="stat-row">' +
        '<span><b>' + esc(r.name) + '</b> <small class="muted">→ ' + esc(out) + '</small></span>' +
        '<span class="muted">' + parts.join(' · ') + '</span></div>' +
        '<button class="btn tiny ' + (can ? 'primary' : 'ghost') + '"' +
          ' data-act="sh-craft" data-key="' + r.key + '">만든다</button></div>';
    }
    html += '</div>';
    html += '<small class="muted">파는 값은 산 값의 3할입니다. 끼고 있는 것은 못 팝니다.</small>';
    return html;
  }

  /* ── 도감 ─────────────────────────────────────────────── */


  function viewDex() {
    var hC = Object.keys(core.save.dex.heroes).length;
    var pC = Object.keys(core.save.dex.pets).length;
    return '<div class="sec"><h4>인물</h4>' + dexBar(hC, data.heroes.length) +
             dexGrid(data.heroes, core.save.dex.heroes) + '</div>' +
           '<div class="sec"><h4>펫</h4>' + dexBar(pC, data.pets.length) +
             dexGrid(data.pets, core.save.dex.pets) + '</div>' +
           '<div class="hint">카드를 누르면 열전·승급·펫 장착 화면이 열립니다. ' +
           '같은 인물을 또 등용하면 <b>중복(+n)</b>이 쌓여 승급 재료가 됩니다.</div>';
  }

  function dexBar(n, total) {
    return '<div class="dexbar"><div class="bar"><i style="width:' + (n / total * 100) + '%"></i></div>' +
      '<small>' + n + ' / ' + total + '</small></div>';
  }

  function dexGrid(list, owned) {
    var out = '<div class="dexgrid">';
    var sorted = list.slice().sort(function (a, b) {
      return b.rarity - a.rarity || a.name.localeCompare(b.name, 'ko');
    });
    for (var i = 0; i < sorted.length; i++) {
      var e = sorted[i], have = !!owned[e.id], rar = data.rarity[e.rarity];
      var kind = e.stats ? 'hero' : 'pet';
      var dup = have ? owned[e.id].count - 1 : 0;
      out += '<button class="dcell' + (have ? '' : ' locked') + '" style="border-color:' +
        (have ? rar.color : 'transparent') + '" title="' +
        esc(e.name + ' · ' + rar.name + (have ? (dup ? ' · 중복 ' + dup : '') : ' (미획득)')) + '"' +
        ' data-act="detail" data-kind="' + kind + '" data-id="' + e.id + '">' +
        (have ? '<span class="de">' + pt(kind, e, 52) + '</span>'
              : '<span class="de locked-mark">❔</span>') +
        '<small>' + (have ? esc(e.name) : '???') + '</small>' +
        (dup > 0 ? '<i class="cnt">+' + dup + '</i>' : '') + '</button>';
    }
    return out + '</div>';
  }

  /* ── 기록 ─────────────────────────────────────────────── */

  function viewLog() {
    var log = core.save.log;
    if (!log.length) { return '<div class="hint">아직 기록이 없습니다.</div>'; }
    var out = '<div class="loglist">';
    for (var i = 0; i < log.length; i++) {
      var t = new Date(log[i].t);
      var hh = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
      out += '<div class="lrow ' + log[i].kind + '"><span>' + hh + '</span>' + esc(log[i].text) + '</div>';
    }
    return out + '</div>';
  }

  /* ── 사관 (온라인 모드) ───────────────────────────────── */


  /* ── 자동 순행 ────────────────────────────────────────────
   * 사관 시트에 뒀지만 **오프라인에서도 그대로 돈다** — 판단은 규칙이고,
   * AI(사관)를 쓰는 건 '길조 유지' 하나뿐이다. 그 점을 화면에 적어 둔다.
   */
  function sectionAuto() {
    var A = global.DG.auto;
    var stt = A.status();
    var html = '<div class="sec"><h4>자동 순행</h4><div class="card">' +
      '<button class="btn wide ' + (stt.on ? 'primary' : '') + '" data-act="auto-on">' +
        (stt.on ? '⏸️ 자동 순행 멈춤' : '🤖 자동 순행 시작') + '</button>';
    if (stt.on) {
      html += '<div class="stat-row"><span>지금</span><b>' + esc(stt.doing || '…') + '</b></div>';
    }
    html += '<div class="autoflags">';
    for (var i = 0; i < A.FLAGS.length; i++) {
      var f = A.FLAGS[i];
      var onf = A.on(f.key);
      html += '<button class="btn tiny ' + (onf ? 'primary' : 'ghost') + '" ' +
        'data-act="auto-flag" data-flag="' + f.key + '" title="' + esc(f.desc) + '">' +
        f.emoji + ' ' + f.name + '</button>';
    }
    html += '</div>' +
      '<small class="muted">사냥 규칙은 <b>손으로 할 때와 같습니다</b> — ' +
      '자동은 어느 적을 칠지·언제 탕약을 마실지만 고릅니다.<br>' +
      '<b>새 문답은 대신 풀지 않습니다</b> (익힌 문제 복습만).<br>' +
      '창을 보고 있는 동안에만 돕니다 — 덮어 두면 멈춥니다.</small>' +
      '</div></div>';
    return html;
  }


  /* ── 인물 · 펫 상세 — js/ui-detail.js(R-4). 같은 이름 한 줄 넘김 ───────────────── */
  function UD() { return global.DG.uiDetail.setup({ $: $, esc: esc, p3tag: p3tag, p3src: p3src, els: els, hero: hero, net: net }); }
  function detailHost() { return UD().host(); }
  function openDetail(kind, id) { UD().open(kind, id); }
  function closeDetail() { UD().close(); }
  function renderDetail() { UD().render(); }

  /* ── 오버월드 전체 지도 (2026-09-02, M키식 토글) ─────────────
   * 지금 어디 있는지 + 마을(🏘️)·사냥터(⚔️)가 어떤 순서로 이어지는지 한눈에.
   * 걸어서 문을 통해 실제로 오가는 것과는 별개로, 상태만 보여 주는 읽기 전용 판이다. */
  var OW_CHAIN = ['sinya', 'heodo', 'field', 'gangneungjin', 'forest',
                  'namjeongseong', 'cave', 'gisanchae', 'gorge', 'ruin', 'deepcave',
                  'beyond_past', 'beyond_now', 'beyond_future'];

  function owmapHost() {
    var el = $('owmap');
    if (!el) {                       // 자가진단 페이지처럼 뼈대가 없는 곳에서도 동작하게
      el = document.createElement('div');
      el.id = 'owmap';
      document.body.appendChild(el);
      els.owmap = el;
    }
    return el;
  }

  function renderOverworldMap() {
    var SD = global.DG.sideData, S = global.DG.side;
    var here = S.status().stage.key;
    var html = '<div class="ow-card">' +
      '<button class="icon-btn sm ow-x" data-act="ow-close">✕</button>' +
      '<h3>🗺️ 오버월드</h3><div class="ow-chain">';
    for (var i = 0; i < OW_CHAIN.length; i++) {
      var stg = SD.stage(OW_CHAIN[i]);
      var open = S.unlocked(stg.key);
      var cls = (stg.key === here ? ' cur' : '') + (open ? ' open' : ' locked') +
        (stg.town ? ' town' : ' field');
      html += '<div class="ow-node' + cls + '">' +
        '<i>' + (stg.town ? '🏘️' : '⚔️') + '</i><b>' + esc(stg.name) + '</b>' +
        (open ? (stg.town ? '<small>안전지대</small>' : '<small>적 Lv.' + stg.enemyLv + (global.DG.sideHand ? global.DG.sideHand.mapTag(stg) : '') + '</small>')   // W-0176 조각·숨은 자리
              : '<small>🔒 Lv.' + stg.need + '</small>') +
        '</div>';
      if (i < OW_CHAIN.length - 1) { html += '<div class="ow-link' + (open ? ' open' : '') + '"></div>'; }
    }
    html += '</div><small class="muted">지금 있는 곳이 금빛으로 빛납니다. ' +
      '마을(🏘️)은 안전지대, 사냥터(⚔️)는 몬스터가 있는 곳입니다.</small></div>';
    owmapHost().innerHTML = html;
  }

  function openOverworldMap() {
    renderOverworldMap();
    owmapHost().classList.add('show');
  }

  function closeOverworldMap() {
    owmapHost().classList.remove('show');
  }

  function toggleOverworldMap() {
    if (owmapHost().classList.contains('show')) { closeOverworldMap(); }
    else { openOverworldMap(); }
  }

  /* ── 토스트 ───────────────────────────────────────────── */

  var toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, global.innerWidth <= 520 ? 2500 : 2600);   // W-0364 폰은 맨 위 한 줄 2.5초
  }

  /** 매 프레임이 아니라 주기적으로만 갱신한다 */
  function tickRefresh() {
    renderTop();
    renderCamp();
    renderHudBar();
    renderTalkBox();
    renderAutoBar();
    var a = document.activeElement;
    if (a && (a.tagName === 'SELECT' || a.tagName === 'INPUT') && els['sheet-body'].contains(a)) { return; }
    if (openTab === 'field') { renderSheet(); }
  }

  /* ── 자동 순행 상태줄 ─────────────────────────────────── */

  var autoKey = null;
  function renderAutoBar() {
    var bar = els.autobar;
    if (!bar) { return; }
    var A = global.DG.auto;
    if (!A || !A.active()) {
      if (autoKey !== null) { bar.classList.remove('show'); bar.innerHTML = ''; autoKey = null; }
      return;
    }
    var stt = A.status();
    var key = stt.doing;
    if (key !== autoKey) {
      autoKey = key;
      bar.innerHTML = '<div class="auto-card"><b>🤖 자동 순행</b>' +
        '<span>' + esc(stt.doing || '…') + '</span>' +
        '<button class="btn tiny ghost" data-act="auto-stop">멈춤</button></div>';
    }
    bar.classList.add('show');
  }

  global.DG = global.DG || {};
  global.DG.ui = {
    init: init, toast: toast, tickRefresh: tickRefresh,
    openSheet: openSheet, closeSheet: closeSheet,
    openDetail: openDetail, closeDetail: closeDetail,
    renderPanel: renderSheet, renderHud: renderTop,
    renderCamp: renderCamp, renderHudBar: renderHudBar, renderTalkBox: renderTalkBox,
    openOverworldMap: openOverworldMap, closeOverworldMap: closeOverworldMap,
    toggleOverworldMap: toggleOverworldMap
  };
})(window);
