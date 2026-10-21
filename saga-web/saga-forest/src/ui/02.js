  /* ── 집 ───────────────────────────────────────────────────
   * 창고에서 고르고, **선 자리에 놓는다**(심기와 같은 규칙).
   * 넓히려면 증축을 신청하고 빚을 갚는다 — 원작의 융자다.
   */
  function viewHome() {
    var Hm = global.DG.home, V = global.DG.village, VD = global.DG.villageData;
    var stt = Hm.status(), html = '', i;
    var can = Hm.canPlaceHere();

    html += '<div class="sec"><h4>' + esc(stt.room.name) + '</h4><div class="card">' +
      '<div class="stat-row"><span>집 평가</span><b>' + esc(stt.grade) + ' · ' + stt.score + '점</b></div>' +
      '<div class="stat-row"><span>놓은 것</span><b>🪑 ' + stt.n + '점 · 어울림 ' + stt.bonus + '</b></div>' +
      '<div class="stat-row"><span>방 크기</span><b>' + stt.room.tw + ' × ' + stt.room.th + '</b></div>' +
      (stt.debt
        ? '<div class="stat-row"><span>남은 빚</span><b>🪙 ' + core.fmt(stt.debt) + '</b></div>'
        : '') +
      '<small class="muted">같은 계열을 셋 이상 놓으면 어울림 점수가 붙습니다. ' +
      '날이 바뀌면 평가서가 편지로 옵니다.</small></div></div>';

    /* 증축(융자) */
    html += '<div class="sec"><h4>증축</h4><div class="card">';
    if (stt.debt) {
      html += '<div class="stat-row"><span>갚아야 할 빚</span><b>🪙 ' + core.fmt(stt.debt) + '</b></div>' +
        '<button class="btn primary wide" data-act="v-repay" data-n="0">🪙 갚을 수 있는 만큼 갚는다</button>' +
        '<small class="muted">빚을 다 갚아야 다음 증축을 신청할 수 있습니다.</small>';
    } else if (stt.next) {
      html += '<div class="stat-row"><span>다음</span><b>' + esc(stt.next.name) +
          ' (' + stt.next.w + ' × ' + stt.next.h + ')</b></div>' +
        '<div class="stat-row"><span>빚</span><b>🪙 ' + core.fmt(stt.next.cost) + '</b></div>' +
        '<button class="btn primary wide" data-act="v-expand">🏠 증축을 신청한다</button>' +
        '<small class="muted">신청하면 그 자리에서 넓어지고 빚이 생깁니다.</small>';
    } else {
      html += '<small class="muted">이미 가장 큰 집입니다.</small>';
    }
    html += '</div></div>';

    /* 벽지와 장판 — 가진 것 중에서 고른다 */
    html += '<div class="sec"><h4>벽지와 장판</h4><div class="card">' +
      '<div class="stat-row"><span>지금</span><b>🎨 ' + esc(stt.wall.name) +
        ' · ' + esc(stt.floor.name) + '</b></div>' +
      '<div class="stat-row"><span>평가에 보탠 것</span><b>+' + stt.finish + '점</b></div>' +
      '</div>';
    [['wall', stt.walls, stt.wall, '벽'], ['floor', stt.floors, stt.floor, '바닥']]
      .forEach(function (e) {
        html += '<div class="card gearcard"><div class="gearname">' + e[3] + '</div>' +
          '<div class="bagtools">';
        for (var i = 0; i < e[1].length; i++) {
          var f = e[1][i], on = f.key === e[2].key;
          html += '<button class="btn tiny ' + (on ? 'primary' : 'ghost') + '"' +
            (on ? ' disabled' : '') + ' data-act="v-setfin" data-kind="' + e[0] +
            '" data-id="' + f.key + '">' + esc(f.name) + (on ? ' ✔' : '') + '</button>';
        }
        html += '</div></div>';
      });
    html += '<small class="muted">전방(🎒 가방 시트)에 날마다 벽지 한 벌 · 장판 한 벌이 ' +
      '들어옵니다. 기본이 아닌 것을 바르면 집 평가가 각각 +12 오릅니다.</small></div>';

    /* 창고 → 놓기 */
    html += global.DG.lots ? global.DG.lots.sheetHtml() : '';   // W-0284 작은 빈 집
    html += '<div class="sec"><h4>창고</h4>';
    if (!stt.stock.length) {
      html += '<div class="hint">창고가 비었습니다 — 전방(🎒 가방 시트)에 날마다 가구 넉 점이 들어옵니다.</div>';
    } else {
      for (i = 0; i < stt.stock.length; i++) {
        var e = stt.stock[i];
        var set = VD.FURN_SETS[e.furn.set];
        html += '<div class="card gearcard">' +
          '<div class="gearname">' + ico('furniture', e.furn.key, 24, '🪑') + ' ' + esc(e.furn.name) + gradeTag('goods', e.furn.price) +
            ' <small class="muted">×' + e.n + ' · ' + esc(set ? set.name : '') +
            ' · 🪙 ' + core.fmt(e.furn.price) + '</small></div>' +
          '<div class="bagtools">' +
            '<button class="btn tiny ' + (can.ok ? 'primary' : 'ghost') + '"' +
              (can.ok ? '' : ' disabled') +
              ' data-act="v-place" data-id="' + e.furn.key + '">여기 놓는다</button>' +
            '<button class="btn tiny ghost" data-act="v-sellfurn" data-id="' + e.furn.key +
              '">되판다 (🪙 ' + core.fmt(Math.floor(e.furn.price / 2)) + ')</button>' +
          '</div></div>';
      }
      html += '<div class="hint">' +
        (stt.inside
          ? (can.ok ? '지금 선 자리에 놓을 수 있습니다.' : '지금 자리에는 못 놓습니다 — ' + esc(can.why) + '.')
          : '집 안에 들어가야 놓을 수 있습니다 (🏠 앞에서 ' + core.actHint() + ').') +
        ' 놓인 것 곁에서 <b>' + core.actHint() + '</b> 를 누르면 다시 거둡니다.</div>';
    }
    html += '</div>';
    return html;
  }



  /* ── 마을 (게시판 · 깃대) · 전체지도 — js/ui-town.js(R-4). 같은 이름 한 줄 넘김 ───────────── */
  var utH = null; function UT() { return global.DG.uiTown.setup(utH || (utH = { esc: esc })); }
  function viewTown() { return UT().viewTown(); }
  function viewMap() { return UT().viewMap(); }

  /* ── 소포 접수대 · 침선방 · 사고 · 순무 장 — js/ui-shops.js(R-4). 같은 이름 한 줄 넘김 ───────────── */
  var usH = null; function US() { return global.DG.uiShops.setup(usH || (usH = { esc: esc, ico: ico, gradeTag: gradeTag, dexBar: dexBar })); }
  function viewParcel() { return US().viewParcel(); } function parcelChip() { return US().parcelChip(); } function viewWear() { return US().viewWear(); } function viewMuseum() { return US().viewMuseum(); } function viewTurnip() { return US().viewTurnip(); }

  /* ── 도감 ─────────────────────────────────────────────── */


  function viewDex() {
    var hC = Object.keys(core.save.dex.heroes).length;
    var pC = Object.keys(core.save.dex.pets).length;
    return '<div class="sec"><h4>인물</h4>' + dexBar(hC, data.heroes.length) +
             dexGrid(data.heroes, core.save.dex.heroes) + '</div>' +
           '<div class="sec"><h4>펫</h4>' + dexBar(pC, data.pets.length) +
             dexGrid(data.pets, core.save.dex.pets) + '</div>' +
           bioDex() +
           '<div class="hint">카드를 누르면 열전·승급·펫 장착 화면이 열립니다. ' +
           '같은 인물을 또 등용하면 <b>중복(+n)</b>이 쌓여 승급 재료가 됩니다.</div>';
  }

  /* ── 채집 도감 ────────────────────────────────────────────
   * 한 번이라도 손에 넣은 것은 여기 남는다 — **팔아도 지워지지 않는다**.
   * 곤충과 물고기는 계절·시간대를 타므로, 다 채우려면 일 년을 돌아야 한다.
   * 원작의 박물관이 하던 일을 이 한 절이 대신한다.
   */
  function bioDex() {
    var V = global.DG.village, VD = global.DG.villageData;
    var cats = [{ key: 'bug', name: '곤충', icon: '🦋' },
                { key: 'fish', name: '물고기', icon: '🐟' }];
    var html = '', c, i;
    for (c = 0; c < cats.length; c++) {
      var all = VD.ITEMS[cats[c].key], got = 0, rows = '';
      for (i = 0; i < all.length; i++) {
        var n = V.caughtCount(all[i].key);
        if (n) { got++; }
        rows += '<span class="biocell' + (n ? '' : ' off') + '" title="' +
          esc(all[i].name) + (n ? ' ×' + n : ' — 아직') + '">' +
          (n ? all[i].emoji : '❔') + '</span>';
      }
      html += '<div class="sec"><h4>' + cats[c].icon + ' ' + cats[c].name + '</h4>' +
        dexBar(got, all.length) + '<div class="biogrid">' + rows + '</div></div>';
    }
    var mu = global.DG.museum.count();
    html += '<div class="sec"><div class="card">' +
      '<div class="stat-row"><span>사고에 들인 것</span><b>🏛️ ' + mu.done + ' / ' + mu.total + '종</b></div>' +
      '<button class="btn wide" data-act="v-museum">🏛️ 사고를 열어 본다</button>' +
      '<small class="muted">도감은 <b>잡아 본 것</b>이고 사고는 <b>들여 놓은 것</b>입니다 — ' +
      '다른 자리입니다.</small></div></div>';
    return html;
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
      '<small class="muted">마을 규칙은 <b>손으로 할 때와 같습니다</b> — ' +
      '자동은 어디로 갈지(아직 여문 사물·부탁을 채운 주민)만 고릅니다.<br>' +
      '<b>새 문답은 대신 풀지 않습니다</b> (익힌 문제 복습만).<br>' +
      '창을 보고 있는 동안에만 돕니다 — 덮어 두면 멈춥니다.</small>' +
      '</div></div>';
    return html;
  }


  /* ── 인물 · 펫 상세 — 몸은 ui-detail.js(R-4). 안에서 부르던 이름 그대로 넘긴다 ── */
  function UD() { return global.DG.uiDetail.setup({ $: $, esc: esc, p3tag: p3tag, p3src: p3src, els: els, hero: hero, net: net }); }
  function detailHost() { return UD().host(); }
  function openDetail(kind, id) { UD().open(kind, id); }
  function closeDetail() { UD().close(); }
  function renderDetail() { UD().render(); }

  /* ── 토스트 ───────────────────────────────────────────── */

  var toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, global.innerWidth <= 520 ? 2500 : 2600);   // W-0364 폰은 맨 위 한 줄 2.5초
  }

  /**
   * 하루 마무리 카드(§5.2, 표준 B) — 자정 넘겨 첫 부팅(=`rollDay()`가 실제로 돈
   * 뒤) 딱 한 번 뜬다. `#encounter`(이 판에선 안 쓰던 자리)를 빌려 쓴다.
   * 8초 뒤 저절로 닫히거나 눌러서 닫는다 — 닫히면 `dayLogSeen()`으로 다시 안 뜨게 한다.
   */
  var dayCardTimer = null;
  function showDayCard(info) {
    var el = $('encounter');
    if (!el) { return; }
    var ratingUp = info.ratingAfter - info.ratingBefore;
    var metLine = info.metId && global.DG.data ? global.DG.data.find(info.metId) : null;
    var warn = global.DG.town && global.DG.town.beautyWarning ? global.DG.town.beautyWarning() : null;
    el.innerHTML =
      '<div class="enc-card">' +
        '<h3 style="margin:0 0 6px;font-size:17px">🌙 어제 하루</h3>' +
        '<div class="stat-row"><span>채집</span><b>' + core.fmt(info.gathered) + '</b></div>' +
        '<div class="stat-row"><span>금</span><b>🪙 ' + (info.gold >= 0 ? '+' : '') + core.fmt(info.gold) + '</b></div>' +
        (info.donated ? '<div class="stat-row"><span>기증</span><b>' + info.donated + '</b></div>' : '') +
        '<div class="stat-row"><span>마을 평가</span><b>' + (ratingUp >= 0 ? '+' : '') + ratingUp + '</b></div>' +
        (metLine ? '<div class="stat-row"><span>가장 가까워진 사람</span><b>' + esc(metLine.name) + '</b></div>' : '') +
        (warn ? '<div class="p-goal" style="margin-top:8px;color:var(--bad,#c0392b)">⚠ ' + esc(warn.text) + '</div>' : '') +
        (info.next ? '<div class="p-goal" style="margin-top:8px">오늘 · 🎯 ' + esc(info.next) + '</div>' : '') +
        '<button class="btn primary wide" id="daylog-ok">확인</button>' +
      '</div>';
    el.classList.add('show');
    var close = function () {
      el.classList.remove('show'); el.innerHTML = '';
      if (dayCardTimer) { clearTimeout(dayCardTimer); dayCardTimer = null; }
    };
    var btn = $('daylog-ok');
    if (btn) { btn.addEventListener('click', close); }
    if (dayCardTimer) { clearTimeout(dayCardTimer); }
    dayCardTimer = setTimeout(close, 8000);
    global.DG.village.dayLogSeen();
  }

  function checkDayCard() {
    var V = global.DG.village;
    if (!V || !V.dayLogPending || !V.dayLogPending()) { return; }
    showDayCard(V.dayLogInfo());
  }

  /** 매 프레임이 아니라 주기적으로만 갱신한다 */
  function tickRefresh() {
    renderTop();
    renderFocus();
    renderAutoBar();
    checkDayCard();
    var a = document.activeElement;
    if (a && (a.tagName === 'SELECT' || a.tagName === 'INPUT') && els['sheet-body'].contains(a)) { return; }
    /* 공사 시트는 **선 칸을 가운데로 한 3×3** 을 보여 준다 — 걸어가면 따라와야 한다.
       안 그러면 화면에 그린 칸과 실제로 고쳐지는 칸이 어긋난다 */
    if (openTab === 'bag' || openTab === 'folks' || openTab === 'build') { renderSheet(); }
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
    renderPanel: renderSheet, renderHud: renderTop, renderFocus: renderFocus,
    doInteract: doInteract
  };
})(window);
