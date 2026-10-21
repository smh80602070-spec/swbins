  /* ── 인물 · 펫 상세 — js/ui-detail.js(R-4). 같은 이름 한 줄 넘김 ───────────────── */
  var udH = null; function UD() { return global.DG.uiDetail.setup(udH || (udH = { $: $, esc: esc, els: els, hero: hero, net: net, eraIcon: eraIcon, p3src: p3src, p3tag: p3tag })); }
  function detailHost() { return UD().host(); }
  function openDetail(kind, id) { UD().open(kind, id); }
  function closeDetail() { UD().close(); }
  function renderDetail() { UD().render(); }
  function rankStars(rank) { return UD().rankStars(rank); }

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
    renderAutoBar();
    syncHeaderStack();
    renderLoadbar();
    var a = document.activeElement;
    if (a && (a.tagName === 'SELECT' || a.tagName === 'INPUT') && els['sheet-body'].contains(a)) { return; }
    if (openTab === 'party' || openTab === 'gear') { renderSheet(); }
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
    openTab: function () { return openTab; },   // §5.16 몸짓 — 닿아 연 시트가 아직 열려 있나
    openDetail: openDetail, closeDetail: closeDetail,
    renderPanel: renderSheet, renderHud: renderTop, renderCamp: renderCamp, renderGoals: renderGoals
  };
})(window);
