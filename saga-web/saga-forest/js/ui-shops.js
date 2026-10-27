/**
 * 3마을 소포 접수대·침선방(옷)·사고(史庫) 시트 — ui.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * ui.js 가 `setup({ esc, ico, gradeTag, dexBar })` 로 손잡이를 넘기고 같은 이름(viewParcel·parcelChip·viewWear·viewMuseum·viewTurnip)으로 부른다. 나머지는 DG.* 에서 바로 읽는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var data = global.DG.data;
  var esc, ico, gradeTag, dexBar;
  var api = null;
  function setup(h) { esc = h.esc; ico = h.ico; gradeTag = h.gradeTag; dexBar = h.dexBar; return api; }

  /* ── 침선방 (옷) ──────────────────────────────────────────
   * 원작의 재봉실이다. 사면 옷장에 남고, 옷장에 있는 것만 입는다.
   * 날마다 바뀌는 진열은 두지 않았다 — 옷은 취향이라 "오늘 것" 으로 막으면 답답하다.
   */
  /** 택배 접수대(PLAN §5.7) — 소포 셋 중 하나를 고른다. 셋은 종류(안전·깨지기·시간제한)와 목적지가 다 다르다 */
  function viewParcel() {
    var PC = global.DG.parcel, VDd = global.DG.villageData, stt = PC.status(), html = '', i;
    html += '<div class="sec"><h4>배달 기록</h4><div class="card">' +
      '<div class="stat-row"><span>누적 배달</span><b>📦 ' + stt.n + '건</b></div>' +
      '<div class="stat-row"><span>연속 (깨지거나 늦으면 끊김)</span><b>🔗 ' + stt.chain + '건' +
        (stt.chain + 1 >= PC.CHAIN_AT ? ' — 다음 배달 ×' + PC.CHAIN_MUL : ' (' + PC.CHAIN_AT + '건째부터 ×' + PC.CHAIN_MUL + ')') + '</b></div>' +
      '<div class="stat-row"><span>등급</span><b>🎖️ ' + (stt.grade ? esc(VDd.DELIVERY_GRADES[stt.grade - 1].name) : '견습') + '</b></div>' +
      (stt.next ? '<small class="muted">다음 등급 「' + esc(stt.next.name) + '」까지 ' + (stt.next.at - stt.n) + '건 — ' + esc(stt.next.note) + '</small>'
                : '<small class="muted">배달 등급을 모두 채웠습니다.</small>') +
      '</div></div>';
    if (stt.carrying) {
      var pk = VDd.PARCEL_KINDS[stt.kind];
      html += '<div class="sec"><h4>지금 들고 있는 소포</h4><div class="card">' +
        '<div class="gearname">' + pk.emoji + ' ' + esc(pk.name) + ' → ' + esc(stt.destName) + '</div>' +
        '<small class="muted">' + (stt.broken ? '🥚 깨졌습니다 — 보상이 절반이 됩니다. ' : '') + esc(pk.note) + '</small></div></div>';
      return html;
    }
    var offers = PC.offers();
    html += '<div class="sec"><h4>소포 고르기</h4>';
    for (i = 0; i < offers.length; i++) {
      var o = offers[i], k = VDd.PARCEL_KINDS[o.kind], dd = VDd.DELIVERY_DESTS[o.dest];
      html += '<div class="card gearcard"><div class="gearname">' + k.emoji + ' ' + esc(k.name) + ' → ' + dd.emoji + ' ' + esc(o.destName) + '</div>' +
        '<small class="muted">' + esc(k.note) + (o.limit ? ' · 시한 ' + o.limit + '초' : '') + ' · 거리 ' + o.dist + '칸</small>' +
        '<div class="bagtools"><button class="btn tiny primary" data-act="v-parcel" data-kind="' + o.kind + '" data-dest="' + o.dest +
        '">받는다 (🪙 ' + core.fmt(o.reward) + ')</button></div></div>';
    }
    return html + '</div>';
  }

  /** 상단에 "소포 → 어디" 한 줄 — 들고 있을 때만 */
  function parcelChip() {
    var PC = global.DG.parcel;
    if (!PC) { return ''; }
    var p = PC.status();
    if (!p.carrying) { return ''; }
    var t = '';
    if (p.deadline) { var d = new Date(p.deadline); t = ' ⏱️' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + '까지'; }
    return (p.broken ? '🥚 깨짐' : '📦 소포') + ' → ' + esc(p.destName) + t + ' · ';
  }

  function viewWear() {
    var W2 = global.DG.wear, stt = W2.status();
    var html = '', i, j;

    html += '<div class="sec"><h4>지금 차림</h4><div class="card">' +
      '<div class="stat-row"><span>입은 것</span><b>🧵 ' + esc(stt.name) + '</b></div>' +
      '<small class="muted">고른 것은 마을을 걷는 <b>내 모습</b>에 그대로 나타납니다. ' +
      '도감의 인물 그림은 그대로입니다 — 옷은 내 것이지 그 사람의 것이 아니니까요.' +
      '</small></div></div>';

    for (i = 0; i < stt.parts.length; i++) {
      var p = stt.parts[i];
      html += '<div class="sec"><h4>' + esc(p.part.name) + '</h4>';
      for (j = 0; j < p.list.length; j++) {
        var e = p.list[j];
        html += '<div class="card gearcard' + (e.on ? ' hi' : '') + '">' +
          '<div class="gearname">' +
            (e.it.c ? '<span class="swatch" style="background:' + e.it.c + '"></span>' : ico('wear', e.it.key, 24, '🧵') + ' ') +
            esc(e.it.name) + gradeTag('goods', e.it.price) +
            (e.on ? ' <small class="muted">— 입고 있음</small>' : '') + '</div>' +
          '<div class="bagtools">' +
            (e.own
              ? (e.on
                  ? '<button class="btn tiny ghost" disabled>입고 있음</button>'
                  : '<button class="btn tiny primary" data-act="v-wset" data-kind="' +
                    p.part.key + '" data-id="' + e.it.key + '">입는다</button>')
              : (e.it.unlock
                  ? '<button class="btn tiny ghost" disabled>🔒 배달 ' + e.it.at + '건</button>'
                  : '<button class="btn tiny" data-act="v-wbuy" data-kind="' + p.part.key +
                    '" data-id="' + e.it.key + '">짓는다 (🪙 ' + core.fmt(global.DG.workshop ? global.DG.workshop.cost(e.it.price) : e.it.price) + ')</button>')) +
          '</div></div>';
      }
      html += '</div>';
    }
    return html;
  }

  /* ── 사고(史庫) ───────────────────────────────────────────
   * 원작의 박물관. **도감과 다른 것**이라는 게 눈에 보여야 한다 —
   * 도감은 잡아 본 것이고, 사고는 가방에서 한 점을 실제로 내어 놓은 것이다.
   * 그래서 기증은 사고 **앞에서만** 받는다.
   */
  function viewMuseum() {
    var M = global.DG.museum, VD = global.DG.villageData, V = global.DG.village;
    var stt = M.status(), html = '', i, j;

    html += '<div class="sec"><h4>사고</h4><div class="card">' +
      '<div class="stat-row"><span>등급</span><b>' + esc(stt.grade) + '</b></div>' +
      '<div class="stat-row"><span>들인 것</span><b>🏛️ ' + stt.done + ' / ' + stt.total + '종</b></div>' +
      '<small class="muted">' +
        (stt.near ? '지금 사고 앞입니다 — 아래에서 들일 수 있습니다.'
                  : '기증은 <b>사고(🏛️) 앞에서만</b> 받습니다. 마을 가운데 왼쪽에 있습니다.') +
      ' 들인 것은 가방에서 한 점이 빠집니다. 대신 <b>명성</b>이 오릅니다.</small></div></div>'; if (global.DG.relics) { html += global.DG.relics.sheetHtml(); }   // W-0309 유적 복원

    /* 지금 들일 수 있는 것 */
    html += '<div class="sec"><h4>들일 수 있는 것</h4>';
    if (!stt.offer.length) {
      html += '<div class="hint">가방에 아직 사고에 없는 것이 없습니다 — ' +
        '곤충🦋 · 물고기🐟 · 화석🦴 · 조개🐚 를 모아 오세요.</div>';
    } else {
      for (i = 0; i < stt.offer.length; i++) {
        var e = stt.offer[i];
        html += '<div class="card gearcard">' +
          '<div class="gearname">' + ico('material', e.item.key, 24, e.item.emoji) + ' ' + esc(e.item.name) +
            ' <small class="muted">×' + e.n + ' · 🎖️ +' +
            (20 + Math.floor(e.item.price / 10)) + '</small></div>' +
          '<div class="bagtools">' +
            '<button class="btn tiny ' + (stt.near ? 'primary' : 'ghost') + '"' +
              (stt.near ? '' : ' disabled') +
              ' data-act="v-donate" data-id="' + e.item.key + '">🏛️ 들인다</button>' +
          '</div></div>';
      }
    }
    html += '</div>';

    /* 전시실 — 갈래를 다 채우면 마을에 시설이 서는 번들(PLAN §5.3, 2026-09-17) */
    var bundles = VD.BUNDLES || {};
    for (i = 0; i < stt.cats.length; i++) {
      var c = stt.cats[i], rows = '', bd = bundles[c.cat.key];
      var bundleDone = bd && c.total > 0 && c.done >= c.total;
      for (j = 0; j < c.all.length; j++) {
        var it = c.all[j];
        var has = M.donated(it.key);
        rows += '<span class="biocell' + (has ? '' : ' off') + '" title="' +
          esc(it.name) + (has ? ' — 사고에 있음' : ' — 아직') + '">' +
          (has ? ico('material', it.key, 26, it.emoji) : '❔') + '</span>';
      }
      html += '<div class="sec"><h4>' + c.cat.icon + ' ' + c.cat.name + '</h4>' +
        dexBar(c.done, c.total) + '<div class="biogrid">' + rows + '</div>' +
        (bd ? '<small class="muted">' + (bundleDone ? '✓ 다 채웠습니다 — 마을에 시설이 섰습니다'
                                                     : '다 채우면 마을에 시설이 하나 섭니다') + '</small>' : '') +
        '</div>';
    }
    return html;
  }

  /* ── 순무 장 ──────────────────────────────────────────────
   * 원작에서 유일하게 값이 오르내리는 자리다. 앞일은 보여 주지 않는다 —
   * 지나간 칸만 적어 두고, 팔 때를 고르는 것은 사람 몫이다.
   */
  function viewTurnip() {
    var T = global.DG.turnip, stt = T.status();
    var html = '<div class="sec"><h4>🥬 순무 장</h4><div class="card">';

    if (stt.open) {
      html += '<div class="stat-row"><span>오늘 살 값</span><b>🪙 ' + stt.buyPrice +
          ' / 개</b></div>' +
        '<small class="muted">순무 장은 <b>일요일 오전</b>에만 섭니다. ' +
        '한 주에 ' + stt.MAX_BUY + '개까지, 열 개 묶음으로 삽니다.</small>' +
        '<div class="bagtools">';
      [10, 50, 100, 300].forEach(function (n) {
        var can = core.save.player.gold >= stt.buyPrice * n;
        html += '<button class="btn tiny ' + (can ? 'primary' : 'ghost') + '"' +
          (can ? '' : ' disabled') + ' data-act="v-tbuy" data-n="' + n + '">' +
          n + '개 (🪙 ' + core.fmt(stt.buyPrice * n) + ')</button>';
      });
      html += '</div>';
    } else if (stt.dow === 0) {
      html += '<small class="muted">순무 장은 <b>일요일 오전</b>에만 섭니다 — 오늘은 지났습니다. ' +
        '일요일에는 전방이 순무를 받지도 않습니다.</small>';
    } else {
      html += '<div class="stat-row"><span>지금 시세</span><b>🪙 ' + stt.price + ' / 개</b></div>' +
        '<small class="muted">시세는 <b>하루 두 번</b>(오전·오후) 바뀝니다. ' +
        '다음 일요일이 오면 가진 순무는 썩습니다.</small>';
    }
    html += '</div>';

    if (stt.have) {
      var val = stt.rotten ? T.ROT_PRICE * stt.have : stt.value;
      var gain = val - stt.cost;
      html += '<div class="card' + (stt.rotten ? '' : ' hi') + '">' +
        '<div class="gearname">🥬 가진 순무 ' + stt.have + '개' +
          (stt.rotten ? ' <small class="muted">— 썩었습니다</small>' : '') + '</div>' +
        '<div class="stat-row"><span>산 값</span><b>🪙 ' + stt.bought + ' / 개</b></div>' +
        '<div class="stat-row"><span>지금 팔면</span><b>🪙 ' + core.fmt(val) +
          ' (' + (gain >= 0 ? '+' : '') + core.fmt(gain) + ')</b></div>' +
        '<button class="btn ' + (gain >= 0 ? 'primary' : '') + ' wide" data-act="v-tsell">' +
          '🥬 다 판다</button>' +
        (stt.rotten ? '<small class="muted">썩은 것은 개당 🪙 ' + T.ROT_PRICE +
          ' 에나 나갑니다. 처분해야 새로 살 수 있습니다.</small>' : '') +
        '</div>';
    }

    /* 이번 주 지나간 시세 */
    if (stt.dow !== 0) {
      html += '<div class="card"><div class="gearname">이번 주 시세</div>' +
        '<div class="bagtools">';
      stt.table.forEach(function (c) {
        html += '<span class="chip' + (c.now ? ' on' : '') + '">' + c.label + ' ' +
          (c.price === null ? '—' : '🪙 ' + c.price) + '</span>';
      });
      html += '</div><small class="muted">앞일은 적히지 않습니다. ' +
        '팔 때를 고르는 것이 이 놀이입니다.</small></div>';
    }
    html += '</div>';
    return html + viewMiles();
  }

  /** W-0476 마을 마일 교환 절 — 모은 마일 + 교환 넷(꺼짐이면 빈 글자) */
  function viewMiles() {
    var M = global.DG.miles; if (!M || !M.on()) { return ''; }
    var html = '<div class="sec"><h4>🎟️ 마일 교환</h4><div class="card"><div class="stat-row"><span>모은 마일</span><b>' + M.pts() + '</b></div>' +
      '<small class="muted">「오늘」 창 줄을 다 하고 받으면 줄마다 ' + M.PER + ' 마일.</small><div class="bagtools">';
    M.SHOP.forEach(function (e) {
      var it = M.itemOf(e.key), can = M.pts() >= e.cost;
      if (it) { html += '<button class="btn tiny ' + (can ? 'primary' : 'ghost') + '"' + (can ? '' : ' disabled') + ' data-act="v-mbuy" data-key="' + e.key + '">' + it.emoji + ' ' + it.name + ' ×' + e.n + ' (' + e.cost + ')</button>'; }
    });
    return html + '</div></div></div>';
  }

  api = { setup: setup, viewParcel: viewParcel, parcelChip: parcelChip, viewWear: viewWear, viewMuseum: viewMuseum, viewTurnip: viewTurnip };
  global.DG = global.DG || {};
  global.DG.uiShops = api;
})(typeof window !== 'undefined' ? window : this);
