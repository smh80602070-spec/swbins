/**
 * UI — 프로필 / 재화 / 근처 대상 / 시트(서당·도감·사관·기록) / 상세 / 토스트
 * ---------------------------------------------------------------
 * 사가고 본편(위치 기반 수집 게임 형태) 화면. 던전·전투·장비 UI 는 js/_expansion/ 으로 뺐고,
 * 경영(영지·태수·건설)은 게임에서 아예 제거했다 (v1.0-full 커밋 94850f8 에 이력이 남아 있다).
 */
/**
 * 화면 — 사가의숲(원작식)
 * ---------------------------------------------------------------
 * 던전 게임의 ui.js 에서 갈라져 나왔다. 도감·상세·승급·서당·기록은 그대로 쓰고,
 * 던전 전용(본영·부대·장비)을 걷어낸 자리에 **손이 닿는 것**(아래 가운데 카드)과
 * 가방·주민 화면을 넣었다.
 *
 * 네 게임은 완전히 별개 프로젝트다 — 여기서 고친 것이 다른 게임에 가지 않는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var data = global.DG.data;

  var els = {};
  var openTab = null;          // 열려 있는 시트 이름 (null 이면 닫힘)
  var openDetailRef = null;    // 열려 있는 상세 화면 { kind, id }
  var mapRefreshTimer = null;  // 전체지도가 열려 있는 동안만 도는 위치 갱신 틈

  function hero() { return global.DG.hero; }
  function net() { return global.DG.net; }
  function ai() { return global.DG.ai; }

  function $(id) { return document.getElementById(id); }
  /** 물건 등급 이름표(`data-village.js` gradeOf) — 색만 입힌 작은 글씨. 등급 이름은 인물·펫과 같다 */
  function gradeTag(kind, price) {
    var VD = global.DG.villageData;
    if (!VD || !VD.gradeOf) { return ''; }
    var g = VD.gradeOf(kind, price);
    return g.name ? ' <small class="rar" style="color:' + g.color + '">' + esc(g.name) + '</small>' : '';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  /**
   * 초상 <img> 에 붙일 이름표. `portrait3d` 가 실제 모델로 그림을 다 구우면
   * 이 표를 보고 `src` 를 갈아 끼운다. 못 쓸 자리(three 없음 · 손잡이 내림)
   * 에서는 빈 문자열이라 **여태 그림이 그대로 남는다**.
   * 2026-09-05 — pet(도감 동물)도 받는다. 대응 GLB 가 없는 종은 `portrait3d`
   * 가 스스로 포기하고 캔버스 그림으로 남으므로 여기서 따로 가릴 필요가 없다.
   */
  function p3tag(kind, ref, w, h) {
    var P3 = global.DG.portrait3d;
    if (!P3 || !P3.ready() || (kind !== 'hero' && kind !== 'pet')) { return ''; }
    if (!p3tag.timer) {
      p3tag.timer = global.setTimeout(function () {
        p3tag.timer = null;
        P3.sweep();
      }, 40);
    }
    return ' data-p3="' + P3.keyOf(kind, ref, w, h) + '"';
  }

  /** 이미 구워 둔 3D 초상이 있으면 그걸로 바로 시작한다 — 없으면 fallback 그림.
   *  매번 캔버스 그림으로 시작했다가 40ms 뒤 갈아 끼우면, 이미 구운 인물도
   *  다시 볼 때마다 2D 그림이 잠깐 비쳤다 3D 로 바뀌어 깜빡이는 것처럼 보였다
   *  (2026-09-19, "초상이 2D 스프라이트랑 겹쳐서 깜빡인다" 제보로 발견). */
  function p3src(kind, ref, w, h, fallback) {
    var P3 = global.DG.portrait3d;
    var baked = P3 && P3.of ? P3.of(kind, ref, w, h) : null;
    if (baked) { return { src: baked, done: ' data-p3-done="1"' }; }
    /* 3D 로 꼭 갈아 끼워질 자리는 코드 스프라이트 대신 자리표시로 시작한다(SAGA-DESIGN §11 Phase 0) — 못 쓰는 자리는 옛 그림.
       fallback 은 함수라 자리표시일 땐 스프라이트를 아예 안 그린다 */
    if (P3 && P3.willSwap && P3.willSwap(kind, ref, w, h)) { return { src: P3.holder(w, h), done: ' data-p3-holder="1"' }; }
    return { src: typeof fallback === 'function' ? fallback() : fallback, done: '' };
  }

  /** 스프라이트 초상 <img> (캐시되므로 목록에 여러 번 써도 가볍다) */
  function pt(kind, ref, size) {
    var sz = size || 48;
    var p = p3src(kind, ref, sz, sz, function () { return global.DG.sprite.portrait(kind, ref, sz); });
    return '<img class="pt" alt=""' + p3tag(kind, ref, sz, sz) + p.done + ' src="' +
      p.src + '">';
  }

  var TITLES = [
    [4000, '패왕(霸王)'], [2000, '제후(諸侯)'], [900, '태수(太守)'],
    [350, '장군(將軍)'], [120, '교위(校尉)'], [30, '유사(有司)'], [0, '무명(無名)']
  ];
  function titleOf(featTotal) {
    for (var i = 0; i < TITLES.length; i++) { if (featTotal >= TITLES[i][0]) { return TITLES[i][1]; } }
    return TITLES[TITLES.length - 1][1];
  }

  function init() {
    ['profile', 'wallet', 'focusbar', 'autobar', 'dock', 'dock-more', 'sheet',
     'sheet-title', 'sheet-body', 'sheet-close', 'scrim', 'toast'].forEach(function (id) {
      els[id] = $(id);
    });

    els.dock.addEventListener('click', function (e) {
      if (e.target.closest('#dock-more-btn')) { toggleMore(); return; }
      var b = e.target.closest('[data-sheet]');
      if (!b) { return; }
      closeMore();
      var name = b.getAttribute('data-sheet');
      if (openTab === name) { closeSheet(); } else { openSheet(name); }
    });
    /* "더보기" 팝오버 바깥을 누르면 닫는다 (독 안쪽 클릭은 위 리스너가 이미 처리) */
    document.addEventListener('click', function (e) {
      if (els['dock-more'] && els['dock-more'].classList.contains('show') && !els.dock.contains(e.target)) {
        closeMore();
      }
    });
    els['sheet-close'].addEventListener('click', closeSheet);
    els.scrim.addEventListener('click', closeSheet);
    els.profile.addEventListener('click', function (e) {
      if (!e.target.closest('[data-act="open-tasks"]')) { return; }
      openSheet('town');
    });
    global.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (els['dock-more'] && els['dock-more'].classList.contains('show')) { closeMore(); return; }
        if (openDetailRef) { closeDetail(); return; }
        if (openTab) { closeSheet(); }
        return;
      }
      /* 전체지도 — 핵앤슬래시 M키식 토글 (PLAN 34-1절). 입력칸에 타자 중이면 무시 */
      if (e.key.toLowerCase() === 'm') {
        var tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') { return; }
        if (openTab === 'map') { closeSheet(); } else { openSheet('map'); }
      }
    });

    /* 아래 가운데 카드의 버튼 — 시트와 같은 data-act 규칙을 쓴다 */
    els.focusbar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) { return; }
      handleAct(b.getAttribute('data-act'), b);
    });

    els['sheet-body'].addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) { return; }
      handleAct(b.getAttribute('data-act'), b);
    });
    /* 음량 슬라이더 — 끌 때마다(input) 바로 듣고, 값칸만 직접 고쳐 슬라이더가
       손 밑에서 튀지 않게 한다(전체 renderSheet() 는 안 부른다) */
    els['sheet-body'].addEventListener('input', function (e) {
      var el = e.target, act = el.getAttribute('data-act');
      if (act === 'snd-vol') {
        var SF = global.DG.sfx;
        if (!SF) { return; }
        var v = SF.setVolume((parseInt(el.value, 10) || 0) / 100);
        var lbl = el.nextElementSibling;
        if (lbl) { lbl.textContent = Math.round(v * 100) + '%'; }
      }
      if (act === 'music-vol') {
        var BG0 = global.DG.bgm;
        if (!BG0) { return; }
        var v2 = BG0.setVolume((parseInt(el.value, 10) || 0) / 100);
        var lbl2 = el.nextElementSibling;
        if (lbl2) { lbl2.textContent = Math.round(v2 * 100) + '%'; }
      }
    });

    bindRest();
  }

  /** 시트·본영에서 눌린 것을 한 곳에서 받는다 */
  function handleAct(act, b) {
    {
      var id = b.getAttribute('data-id');
      if (act === 'detail') {
        openDetail(b.getAttribute('data-kind') || 'hero', id);
        return;
      }
      if (act === 'key-remap') {
        var V0 = global.DG.village;
        if (V0 && V0.beginRemap) { V0.beginRemap(b.getAttribute('data-action')); renderSheet(); }
        return;
      }
      if (act === 'snd-toggle') {
        var SF0 = global.DG.sfx;
        if (SF0) { SF0.setEnabled(!SF0.enabled()); renderSheet(); }
        return;
      }
      if (act === 'music-toggle') {
        var BG1 = global.DG.bgm;
        if (BG1) { BG1.setEnabled(!BG1.enabled()); renderSheet(); }
        return;
      }
      if (act === 'gq-set') {
        var V3s = global.DG.villageView3d;
        if (V3s && V3s.setQuality) { V3s.setQuality(b.getAttribute('data-level')); renderSheet(); }
        return;
      }
      if (act === 'fog-toggle') {
        var V3f = global.DG.villageView3d;
        if (V3f && V3f.setFogOn) { V3f.setFogOn(!V3f.fogOn()); renderSheet(); }
        return;
      }
      if (act === 'v-do') {
        doInteract();
      } else if (act === 'v-sleep') {
        var sl = global.DG.village.sleepNow();
        if (sl) { toast(sl.text); checkDayCard(); }
      } else if (act === 'v-sell') {
        var got = global.DG.village.sell(id, parseInt(b.getAttribute('data-n'), 10) || 1);
        if (got) { toast('🪙 +' + core.fmt(got)); }
      } else if (act === 'v-plant') {
        var pr = global.DG.village.plant(id);
        if (pr) { toast(pr.text); }
      } else if (act === 'v-sellall') {
        var all = global.DG.village.sellAll();
        toast(all ? '🪙 전방에 팔았습니다 · +' + core.fmt(all) : '팔 것이 없습니다 (부탁 몫은 남깁니다)');
      } else if (act === 'v-buytool') {
        var bt = global.DG.village.buyTool(id);
        if (bt) { toast(bt.text); }
      } else if (act === 'v-buyfurn') {
        var bf = global.DG.home.buy(id);
        if (bf) { toast(bf.text); }
      } else if (act === 'v-sellfurn') {
        var sf = global.DG.home.sell(id);
        if (sf) { toast(sf.text); }
      } else if (act === 'v-place') {
        var pl = global.DG.home.place(id);
        if (pl) { toast(pl.text); }
      } else if (act === 'v-expand') {
        var ex = global.DG.home.expand();
        if (ex) { toast(ex.text); }
      } else if (act === 'v-repay') {
        var rp = global.DG.home.repay(parseInt(b.getAttribute('data-n'), 10) || 0);
        if (rp) { toast(rp.text); }
      } else if (act === 'v-tbuy') {
        var tb = global.DG.turnip.buy(parseInt(b.getAttribute('data-n'), 10) || 10);
        if (tb) { toast(tb.text); }
      } else if (act === 'v-tsell') {
        var ts = global.DG.turnip.sellAll();
        if (ts) { toast(ts.text); }
      } else if (act === 'v-buyfin') {
        var bfn = global.DG.home.buyFinish(b.getAttribute('data-kind'), id);
        if (bfn) { toast(bfn.text); }
      } else if (act === 'v-setfin') {
        var sfn = global.DG.home.setFinish(b.getAttribute('data-kind'), id);
        if (sfn) { toast(sfn.text); }
      } else if (act === 'v-donate') {
        var dn = global.DG.museum.donate(id);
        if (dn) { toast(dn.text); if (dn.kind === 'donate' && global.DG.sfx) { global.DG.sfx.play('donate'); } }
      } else if (act === 'v-gift') {
        var gv = global.DG.village.giveGift(b.getAttribute('data-who'), id);
        if (gv) {
          toast('🎁 ' + (gv.name ? gv.name + ' — ' : '') + gv.text);
          if (gv.kind === 'gift' && global.DG.sfx) { global.DG.sfx.play(gv.loved ? 'gift_love' : 'gift_ok'); }
        }
      } else if (act === 'v-follow') {
        var fw = global.DG.village.requestFollow(b.getAttribute('data-who'));
        if (fw) { toast(fw.text); }
      } else if (act === 'v-parcel') {
        var pc = global.DG.village.pickupParcel(b.getAttribute('data-kind'), b.getAttribute('data-dest'));
        if (pc) { toast(pc.text); }
      } else if (act === 'v-wbuy') {
        var wb = global.DG.wear.buy(b.getAttribute('data-kind'), id);
        if (wb) { toast(wb.text); }
      } else if (act === 'v-wset') {
        var ws = global.DG.wear.set(b.getAttribute('data-kind'), id);
        if (ws) { toast(ws.text); }
      } else if (act === 'v-townname') {
        var cur = global.DG.town.name();
        var nm = global.prompt('마을 이름을 무엇으로 할까요? (여덟 자까지)', cur);
        if (nm === null) { return; }
        var nr = global.DG.town.setName(nm);
        if (nr) { toast(nr.text); }
      } else if (act === 'v-flag') {
        var fr = global.DG.town.setFlag(b.getAttribute('data-kind'), id);
        if (fr) { toast(fr.text); }
      } else if (act === 'v-pick') {
        buildSel = { dx: parseInt(b.getAttribute('data-dx'), 10) || 0,
                     dy: parseInt(b.getAttribute('data-dy'), 10) || 0 };
      } else if (act === 'v-build') {
        var bh = global.DG.terrain.cell();
        var bw = global.DG.terrain.work(bh.tx + buildSel.dx, bh.ty + buildSel.dy,
                                        b.getAttribute('data-kind'));
        if (bw) { toast(bw.text); }
      } else if (act === 'v-town') {
        openSheet('town');
        return;
      } else if (act === 'v-museum') {
        openSheet('museum');
        return;
      } else if (act === 'v-mopen') {
        global.DG.mail.open(id);
      } else if (act === 'v-mtake') {
        var tk = global.DG.mail.take(id);
        if (tk) { toast(tk.text); }
      } else if (act === 'v-mwrite') {
        var who = data.find(id);
        var msg = global.prompt('무슨 말을 적으시겠습니까? (예순 자까지)',
          (who ? who.name : '') + ' 께. 요즘 어떠신지요.');
        if (msg === null) { return; }
        var wr = global.DG.mail.write(id, msg);
        if (wr) { toast(wr.text); }
      } else if (act === 'v-mreply') {
        var rl = global.DG.mail.reply(id);
        if (rl) { toast(rl.text); }
      } else if (act === 'v-leave') {
        var lv = global.DG.village.leaveHome();
        if (lv) { toast(lv.text); }
      } else if (act === 'auto-on') {
        global.DG.auto.toggle();
      } else if (act === 'auto-flag') {
        global.DG.auto.toggleFlag(b.getAttribute('data-flag'));
      } else { return; }
      core.persist(); renderSheet(); renderTop(); renderFocus();
    }
  }

  /** 상세 화면·자동 상태줄 배선 + 이벤트 구독 + 첫 렌더.
   *  init() 이 마지막에 한 번 부른다. */
  function bindRest() {
    /* 상세 화면 — 별도 오버레이라 이벤트도 따로 받는다 */
    var host = detailHost();
    host.addEventListener('click', function (e) {
      if (e.target === host) { closeDetail(); return; }
      var b = e.target.closest('[data-act]');
      if (!b) { return; }
      var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
      if (act === 'dt-close') { closeDetail(); return; }
      if (act === 'dt-talk') {
        var say = global.prompt('무엇을 물어보시겠습니까?', '요즘 어떠한가?');
        if (say === null) { return; }
        toast('💬 말을 전하는 중…');
        ai().talk(id, say).then(function (r) {
          if (r && r.error) { toast('⚠️ ' + r.error); return; }
          global.alert((data.find(id) || {}).name + ':\n\n' + (r.text || ''));
        });
        return;
      }
      if (act === 'rankup') { hero().rankUp(id); }
      else if (act === 'join') {
        if (core.save.party.length < 5 && core.save.party.indexOf(id) < 0) { core.save.party.push(id); }
      } else if (act === 'drop') {
        core.save.party = core.save.party.filter(function (x) { return x !== id; });
        delete core.save.petEquip[id];
      } else { return; }
      core.persist(); renderDetail(); renderSheet(); renderTop();
    });
    host.addEventListener('change', function (e) {
      var sel = e.target.closest('[data-equip]');
      if (!sel) { return; }
      var heroId = sel.getAttribute('data-equip');
      if (sel.value) { core.save.petEquip[heroId] = sel.value; }
      else { delete core.save.petEquip[heroId]; }
      core.persist(); renderDetail(); renderSheet();
    });

    if (els.autobar) {
      els.autobar.addEventListener('click', function (e) {
        if (e.target.closest('[data-act="auto-stop"]')) { global.DG.auto.setOn(false); }
      });
    }

    core.on('toast', toast);
    core.on('dg:keyremap', function () { if (openTab === 'keys') { renderSheet(); } });
    /* syncDock 도 여기서 부른다 — 공사 단추는 개토패를 산 순간 서야 한다.
       시트를 여닫을 때만 돌리면, 전방에서 사고 나서 한 번 여닫기 전에는 안 뜬다 */
    core.on('changed', function () { syncDock(); renderTop(); renderSheet(); renderFocus(); });
    syncDock();
    core.on('dex:new', function (p) {
      var ent = data.find(p.id);
      if (ent) { toast('📖 도감 신규 등록 · ' + ent.name); }
    });

    renderTop(); renderFocus();
  }

  /* ── 시트 ─────────────────────────────────────────────── */

  var SHEET_TITLE = {
    bag: '🎒 가방', folks: '🏡 주민', dex: '📖 도감', log: '📜 기록',
    mail: '📮 편지', home: '🏠 집', museum: '🏛️ 사고(史庫)', town: '🏳️ 마을',
    wear: '🧵 침선방', parcel: '📦 택배 접수대', build: '🪧 공사', map: '🗺️ 전체지도', keys: '⌨️ 키설정',
    settings: '⚙️ 설정'
  };

  /** 2026-09-10 — 효과음·그래픽 품질(사가블로·사가스토리 설정 시트와 같은 결).
   *  이 판엔 아직 BGM·진동이 없어(sfx.js 에 그 손잡이 자체가 없다) 그 둘은 뺐다. */
  var QUALITY_LABEL = { auto: '자동', low: '낮음', medium: '보통', high: '높음' };
  function viewSettings() {
    var SF = global.DG.sfx, BG = global.DG.bgm, V3 = global.DG.villageView3d;
    if (!SF) { return '<div class="hint">소리 모듈을 찾을 수 없습니다</div>'; }
    var on = SF.enabled(), vol = Math.round(SF.volume() * 100);
    var mrow = '';
    if (BG) {
      var mon = BG.enabled(), mvol = Math.round(BG.volume() * 100);
      mrow = '<div class="key-row"><b>배경음악</b>' +
        '<button data-act="music-toggle">' + (mon ? '켜짐' : '꺼짐') + '</button></div>' +
        '<div class="key-row"><b>음악 음량</b>' +
        '<input type="range" min="0" max="100" value="' + mvol + '" data-act="music-vol"' +
        (mon ? '' : ' disabled') + '>' +
        '<span class="key-cur">' + mvol + '%</span></div>';
    }
    var gq = '';
    if (V3 && V3.active && V3.active()) {
      var cur = V3.qualityRaw(), lv;
      gq = '<div class="key-row"><b>그래픽 품질</b><span class="key-cur">' +
        (cur === 'auto' ? '자동(' + QUALITY_LABEL[V3.quality()] + ')' : QUALITY_LABEL[cur]) +
        '</span></div><div class="key-row" style="gap:6px">';
      for (lv in QUALITY_LABEL) {
        if (!Object.prototype.hasOwnProperty.call(QUALITY_LABEL, lv)) { continue; }
        gq += '<button class="btn tiny' + (cur === lv ? ' primary' : ' ghost') +
          '" data-act="gq-set" data-level="' + lv + '">' + QUALITY_LABEL[lv] + '</button>';
      }
      gq += '</div><div class="hint">낮음일수록 그림자를 끄고 화면 해상도를 줄여 가벼워집니다. ' +
        '자동은 켤 때 한 번 기기를 보고 고릅니다.</div>';
      /* 안개(2026-09-10, "안개는 중요 하지 않으니 제거 하던지 옵션에 키고
         끄는걸 추가해 끄는게 기본이고") — 기본은 꺼짐. 켜면 먼 사물이
         점점 흐려진다(대기감), 끄면 거리와 무관하게 또렷하다 */
      var fon = V3.fogOn();
      gq += '<div class="key-row"><b>안개</b>' +
        '<button data-act="fog-toggle">' + (fon ? '켜짐' : '꺼짐') + '</button></div>';
    }
    return '<div class="hint keyhint">이동 키는 ⌨️ 키설정에 있습니다.</div>' +
      '<div class="key-row"><b>효과음</b>' +
        '<button data-act="snd-toggle">' + (on ? '켜짐' : '꺼짐') + '</button></div>' +
      '<div class="key-row"><b>음량</b>' +
        '<input type="range" min="0" max="100" value="' + vol + '" data-act="snd-vol"' +
        (on ? '' : ' disabled') + '>' +
        '<span class="key-cur">' + vol + '%</span></div>' +
      mrow + gq;
  }

  /** 2026-09-09 — 이동 키 다시 지정. WASD·방향키는 코드에 그대로 박혀 있고
   *  (실수로 못 쓰게 되지 않게), 여기서는 그 옆에 하나 더 쓸 키만 고른다. */
  function viewKeys() {
    var V = global.DG.village;
    var km = V.keymap(), rm = V.remapping();
    var rows = [{ a: 'up', t: '위' }, { a: 'down', t: '아래' }, { a: 'left', t: '왼쪽' }, { a: 'right', t: '오른쪽' }];
    var h = '<div class="hint">WASD·방향키는 항상 그대로 됩니다 — 여기서는 그 옆에 더 쓸 키 하나만 고릅니다.</div>';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      h += '<div class="key-row"><b>' + r.t + '</b><span class="key-cur">' + esc((km[r.a] || '').toUpperCase()) + '</span>' +
        '<button data-act="key-remap" data-action="' + r.a + '">' +
        (rm === r.a ? '키를 누르세요…' : '다시 지정') + '</button></div>';
    }
    return h;
  }

  function openSheet(name) {
    openTab = name;
    els['sheet-title'].textContent = SHEET_TITLE[name] || name;
    els.sheet.classList.add('show');
    document.body.classList.add('sheet-open');
    if (global.innerWidth <= 780) { els.scrim.classList.add('show'); }
    syncDock();
    renderSheet();
    /* 전체지도는 걷는 동안에도 내 위치가 흘러야 쓸모가 있다 — 'changed' 이벤트는
       걷기만으로는 안 뜨므로, 열려 있는 동안만 따로 짧게 다시 그린다 */
    if (mapRefreshTimer) { clearInterval(mapRefreshTimer); mapRefreshTimer = null; }
    if (name === 'map') {
      mapRefreshTimer = setInterval(function () {
        if (openTab === 'map') { renderSheet(); }
      }, 400);
    }
  }

  function closeSheet() {
    openTab = null;
    els.sheet.classList.remove('show');
    document.body.classList.remove('sheet-open');
    els.scrim.classList.remove('show');
    syncDock();
    if (mapRefreshTimer) { clearInterval(mapRefreshTimer); mapRefreshTimer = null; }
  }

  function syncDock() {
    var bs = els.dock.querySelectorAll('[data-sheet]');
    var inMore = false, mailN = 0;
    for (var i = 0; i < bs.length; i++) {
      var name = bs[i].getAttribute('data-sheet');
      bs[i].classList.toggle('on', name === openTab);
      if (name === openTab && els['dock-more'] && els['dock-more'].contains(bs[i])) { inMore = true; }
      /* 공사 단추는 **개토패를 산 뒤에** 선다 — 못 하는 일을 독에 세워 두지 않는다.
         `hidden` 속성은 #dock button 의 display:grid 에 진다. 그래서 인라인으로 끈다 */
      if (name === 'build') {
        var T = global.DG.terrain;
        bs[i].style.display = (T && T.has()) ? '' : 'none';
      }
      /* 안 읽은 편지는 독에서 바로 보여야 한다 — 우편함까지 걸어가 봐야 아는 건 불친절하다 */
      if (name === 'mail') {
        mailN = global.DG.mail ? global.DG.mail.unread() : 0;
        bs[i].classList.toggle('badge', mailN > 0);
        bs[i].setAttribute('data-badge', mailN > 9 ? '9+' : String(mailN));
      }
    }
    /* 편지가 더보기 뒤에 접혀 있어도 뱃지는 "더보기" 단추로 올라와야 한다 —
       접었다고 안 읽은 편지가 안 보이면 우편함까지 걸어가 봐야 아는 것과 같아진다 */
    var moreBtn = $('dock-more-btn');
    if (moreBtn) {
      moreBtn.classList.toggle('on', inMore);
      moreBtn.classList.toggle('badge', mailN > 0);
      if (mailN > 0) { moreBtn.setAttribute('data-badge', mailN > 9 ? '9+' : String(mailN)); }
    }
  }

  /** 독의 "더보기" 팝오버 — 자주 안 쓰는 시트를 접어 화면 차지를 줄인다 */
  function toggleMore() {
    if (!els['dock-more']) { return; }
    els['dock-more'].classList.toggle('show');
  }
  function closeMore() {
    if (els['dock-more']) { els['dock-more'].classList.remove('show'); }
  }

  function renderSheet() {
    if (!openTab) { return; }
    var v = openTab === 'bag' ? viewBag()
          : openTab === 'folks' ? viewFolks()
          : openTab === 'mail' ? viewMail()
          : openTab === 'home' ? viewHome()
          : openTab === 'museum' ? viewMuseum()
          : openTab === 'town' ? viewTown()
          : openTab === 'wear' ? viewWear()
          : openTab === 'parcel' ? viewParcel()
          : openTab === 'build' ? viewBuild()
          : openTab === 'map' ? viewMap()
          : openTab === 'dex' ? viewDex()
          : openTab === 'keys' ? viewKeys()
          : openTab === 'settings' ? viewSettings() : viewLog();
    els['sheet-body'].innerHTML = v;
  }

  /* ── 상단 ─────────────────────────────────────────────── */

  var PHASE_ICON = { dawn: '🌄', day: '☀️', even: '🌇', night: '🌙' };
  var SEASON_ICON = { spring: '🌸', summer: '🌿', autumn: '🍁', winter: '❄️' };

  /** 화면에 늘 있는 "지금 할 일" 한 줄(§5.1, 표준 A) — 일과 탭을 안 열어도 보인다 */
  function taskGoalLine() {
    var V = global.DG.village;
    if (!V || !V.taskList) { return ''; }
    var list = V.taskList();
    if (!list.length) { return ''; }
    var t = null, i, doneN = 0;
    for (i = 0; i < list.length; i++) {
      if (list[i].done) { doneN++; } else if (!t) { t = list[i]; }
    }
    if (!t) {
      return '<div class="p-goal ready" data-act="open-tasks">🎯 오늘 일과를 다 했습니다(' + doneN + '/' + list.length + ')</div>';
    }
    return '<div class="p-goal" data-act="open-tasks">🎯 ' + esc(t.name) +
      ' <b>' + t.got + '/' + t.need + '</b> · (' + doneN + '/' + list.length + ')</div>';
  }

  function renderTop() {
    var p = core.save.player;
    var need = core.expNeed(p.level);
    var pct = Math.round(p.exp / need * 100);
    var st = global.DG.village.status();

    els.profile.innerHTML =
      '<div class="avatar" style="--p:' + pct + '%"><i>' + (PHASE_ICON[st.phase.key] || '🏡') + '</i></div>' +
      '<div class="p-meta">' +
        '<div class="p-title">' + titleOf(p.featTotal) + ' · Lv.' + p.level + '</div>' +
        '<div class="p-sub">' +
          (st.town ? '🏳️ ' + esc(st.town.name) + ' · ' : '') +
          (st.town && st.town.event ? '🎊 ' + esc(st.town.event.name) + ' · ' : '') +
          parcelChip() +
          (st.stung ? '🐝 쏘임 · ' : '') +
          (st.weeds >= 10 ? '🌿 잡초 ' + st.weeds + ' · ' : '') +
          (st.weather ? st.weather.icon + ' ' + st.weather.name + ' · ' : '') +
          SEASON_ICON[st.season.key] + ' ' + st.season.name +
          ' · ' + st.phase.name + ' · 채집 <b>' + core.fmt(st.gathered) +
          '</b></div>' +
        (global.DG.scenario ? global.DG.scenario.lineHtml() : '') +
        taskGoalLine() +
      '</div>';

    els.wallet.innerHTML =
      coin('🪙', core.fmt(p.gold), '금') +
      coin('🎖️', core.fmt(p.fame), '명성') +
      coin('🏅', core.fmt(p.feat), '공적', true) +
      coin('📜', core.fmt(core.save.items.scroll), '등용서') +
      coin('🍖', core.fmt(core.save.items.feed), '사료');
  }

  function coin(icon, val, label, hi) {
    return '<div class="coin' + (hi ? ' hi' : '') + '" title="' + label + '"><span>' + icon + '</span>' + val + '</div>';
  }

  /* ── 손이 닿는 것 (아래 가운데 카드) ─────────────────────
   * 지도 게임의 '근처 대상' 카드와 같은 자리·같은 역할이다.
   * 무엇에 손이 닿는지 늘 보여 주는 게 이 게임의 안내판이다.
   */

  var focusKey = null, lastResult = null, resultAt = 0;

  /** 손짓 없이 넘어가는 결과 — 대화·시트 열기·문 여닫기처럼 "손을 쓴다"는
   *  느낌이 안 나는 것들. 나머지(나무 흔들기·낚시·상자 열기·잡초 뽑기 등)는
   *  전부 몸짓 한 번을 튼다(`triggerAction()`, 2026-09-10 "더 자연스럽게") */
  var NO_GESTURE_KIND = { open: 1, talk: 1, quest: 1, request: 1, reward: 1, no: 1, leaving: 1, home: 1, cave: 1, locked: 1 };

  /**
   * 채집 손맛(§5.8①) "대상 흔들림 + 수확 팝" — 캔버스·3D 는 안 건드린다.
   * 포커스 카드 자체를 0.25s 흔들고, 그 위로 아이콘 +n 이 0.6s 떠올랐다 사라진다.
   * 흔들림(§5.8①)·효과음(sfx.js `village:gather` 구독)·리듬 보너스(village.js
   * `bumpGatherStreak()`)는 각자 다른 층에서 같은 한 신호(`interact()`의
   * 결과값)를 듣는다 — 여기 쓰는 것은 그중 화면 층 몫뿐이다.
   */
  function gatherFeedback(r) {
    if (els.focusbar) {
      var card = els.focusbar.querySelector('.focus-card');
      if (card) {
        card.classList.remove('gather-pulse');
        void card.offsetWidth;
        card.classList.add('gather-pulse');
      }
    }
    var host = els.focusbar;
    if (!host) { return; }
    var rect = host.getBoundingClientRect();
    var pop = document.createElement('div');
    pop.className = 'gather-pop';
    pop.style.left = (rect.left + rect.width / 2) + 'px';
    pop.style.top = rect.top + 'px';
    pop.textContent = r.item.emoji + ' +' + (r.n || 1) + (r.bonus ? ' 🎵' : '');
    document.body.appendChild(pop);
    global.setTimeout(function () { if (pop.parentNode) { pop.parentNode.removeChild(pop); } }, 650);
  }

  function doInteract() {
    var r = global.DG.village.interact();
    if (!r) { return; }
    lastResult = r; resultAt = Date.now();
    if (!NO_GESTURE_KIND[r.kind] && global.DG.villageView3d && global.DG.villageView3d.triggerAction) {
      global.DG.villageView3d.triggerAction();
    }
    if (r.kind === 'open') { openPlace(r.place || 'shop'); }
    else if (r.kind === 'home' || r.kind === 'pick' || r.kind === 'keep' ||
             r.kind === 'weed' || r.kind === 'wish' || r.kind === 'cave') { toast(r.text); }
    else if (r.kind === 'leaving') { toast('💭 ' + (r.name ? r.name + ' — ' : '') + r.text); }
    else if (r.kind === 'no') { toast(r.text); }
    else if (r.kind === 'request' || r.kind === 'reward' || r.kind === 'talk' ||
             r.kind === 'quest') {
      toast((r.name ? r.name + ' — ' : '') + r.text);
    } else if (r.kind === 'gather' || r.kind === 'furn' || r.kind === 'gold' ||
               r.kind === 'bees' || r.kind === 'treasure' || r.kind === 'note') {
      toast(r.text);
      if (r.kind === 'gather' && r.item) { gatherFeedback(r); }
    } else if (r.kind === 'empty' || r.kind === 'locked') {
      toast(r.text);
    }
    renderTop(); renderFocus(); renderSheet();
  }

  /**
   * 전방·게시판·우편함에 들어간다 — 각각 시트를 연다.
   * **이름이 아니라 종류(place)로 가른다** — 이름을 고치면 조용히 어긋나기 때문이다.
   */
  function openPlace(kind) {
    if (kind === 'shop') { openSheet('bag'); }
    else if (kind === 'mail') { openSheet('mail'); }
    else if (kind === 'museum') { openSheet('museum'); }
    else if (kind === 'town') { openSheet('town'); }
    else if (kind === 'wear') { openSheet('wear'); }
    else if (kind === 'parcel') { openSheet('parcel'); }
    else { openSheet('folks'); }
  }

  function renderFocus() {
    if (!els.focusbar) { return; }
    var V = global.DG.village;
    var f = V.focus();
    if (!f) {
      if (focusKey !== null) { els.focusbar.classList.remove('show'); focusKey = null; }
      return;
    }
    var VD = global.DG.villageData;
    var key, html;
    if (f.type === 'bug') {
      var bref = f.obj.ref;
      var net = global.DG.bug.hasNet();
      key = 'g|' + f.obj.id + '|' + net;
      html = '<div class="focus-card">' +
        '<span class="fc-ico">' + bref.emoji + '</span>' +
        '<span class="fc-meta"><b>' + esc(bref.name) + '</b>' +
          '<small class="muted">' + (net ? '살금살금 다가가 휘두릅니다 — ' + core.actHint()
                                         : '🥅 잠자리채가 없습니다 (전방)') + '</small></span>' +
        '<button class="btn ' + (net ? 'primary' : 'ghost') + '"' + (net ? '' : ' disabled') +
          ' data-act="v-do">휘두른다</button>' +
        '</div>';
      if (key !== focusKey) { focusKey = key; els.focusbar.innerHTML = html; }
      els.focusbar.classList.add('show');
      return;
    }
    if (f.type === 'door') {
      key = 'door';
      html = '<div class="focus-card">' +
        '<span class="fc-ico">🚪</span>' +
        '<span class="fc-meta"><b>문</b><small class="muted">밖으로 나갑니다 — ' + core.actHint() + '</small></span>' +
        '<button class="btn primary" data-act="v-do">나간다</button></div>';
      if (key !== focusKey) { focusKey = key; els.focusbar.innerHTML = html; }
      els.focusbar.classList.add('show');
      return;
    }
    if (f.type === 'cavedoor') {
      key = 'cavedoor';
      html = '<div class="focus-card">' +
        '<span class="fc-ico">🕳️</span>' +
        '<span class="fc-meta"><b>동굴 입구</b><small class="muted">밖으로 나갑니다 — ' + core.actHint() + '</small></span>' +
        '<button class="btn primary" data-act="v-do">나간다</button></div>';
      if (key !== focusKey) { focusKey = key; els.focusbar.innerHTML = html; }
      els.focusbar.classList.add('show');
      return;
    }
    if (f.type === 'chest') {
      var opened = V.chestOpened(f.obj.id);
      var isBoss = f.obj.id === 'bossChest';
      var locked = isBoss && !V.bossUnlocked();
      key = 'ch|' + f.obj.id + '|' + opened + '|' + locked;
      html = '<div class="focus-card">' +
        '<span class="fc-ico">' + (locked ? '👹' : (opened ? '📭' : (isBoss ? '👑' : '📦'))) + '</span>' +
        '<span class="fc-meta"><b>' + (isBoss ? '포자대왕의 보물' : '보물상자') + '</b>' +
          '<small class="muted">' + (locked ? '포자대왕이 지키고 있다 — 다른 상자 셋을 먼저 찾을 것'
            : (opened ? '이미 열어 보았습니다' : '열어 봅니다 — ' + core.actHint())) + '</small></span>' +
        (locked ? '<button class="btn ghost" disabled>봉인됨</button>'
          : opened ? '<button class="btn ghost" disabled>비었음</button>'
                   : '<button class="btn primary" data-act="v-do">연다</button>') +
        '</div>';
      if (key !== focusKey) { focusKey = key; els.focusbar.innerHTML = html; }
      els.focusbar.classList.add('show');
      return;
    }
    if (f.type === 'furn') {
      var fd = VD.furn(f.obj.key);
      key = 'fu|' + f.obj.key + '|' + Math.round(f.obj.x) + '|' + Math.round(f.obj.y);
      if (fd && fd.bed) {
        /* §5.1 트리거 ① — 침구. 거두는 길도 남겨 두되(v-do), 잠드는 쪽을
           기본으로 앞세운다. */
        html = '<div class="focus-card">' +
          '<span class="fc-ico">🛌</span>' +
          '<span class="fc-meta"><b>' + esc(fd.name) + '</b>' +
            '<small class="muted">오늘을 돌아봅니다 — ' + core.actHint() + '</small></span>' +
          '<button class="btn primary" data-act="v-sleep">잠든다</button>' +
          '<button class="btn ghost tiny" data-act="v-do">거둔다</button></div>';
      } else {
        html = '<div class="focus-card">' +
          '<span class="fc-ico">🪑</span>' +
          '<span class="fc-meta"><b>' + esc(fd ? fd.name : '가구') + '</b>' +
            '<small class="muted">거두면 창고로 들어갑니다 — ' + core.actHint() + '</small></span>' +
          '<button class="btn" data-act="v-do">거둔다</button></div>';
      }
      if (key !== focusKey) { focusKey = key; els.focusbar.innerHTML = html; }
      els.focusbar.classList.add('show');
      return;
    }
    if (f.type === 'npc') {
      var ndef = f.obj.def || VD.NPCS[f.obj.kind];   // 방문객(§5.9)은 제 def 를 들고 온다
      var q = VD.QUESTS[f.obj.kind];
      var prog = q ? V.questProgress(f.obj.kind) : null;
      key = 'n|' + f.obj.id + '|' + (prog ? prog.done + '|' + prog.have : '');
      html = '<div class="focus-card">' +
        '<span class="fc-ico">' + ndef.emoji + '</span>' +
        '<span class="fc-meta"><b>' + esc(ndef.name) + '</b>' +
          '<small class="muted">' +
            (prog && !prog.done ? '「' + esc(q.title) + '」 ' + prog.have + '/' + prog.need + ' — ' + core.actHint()
                                 : '말을 건다 — ' + core.actHint()) +
          '</small></span>' +
        '<button class="btn primary" data-act="v-do">말 건다</button></div>';
      if (key !== focusKey) { focusKey = key; els.focusbar.innerHTML = html; }
      els.focusbar.classList.add('show');
      return;
    }
    if (f.type === 'prop') {
      var def = VD.PROPS[f.obj.kind];
      var spent = V.spent(f.obj);
      key = 'p|' + f.obj.id + '|' + spent;
      html = '<div class="focus-card">' +
        '<span class="fc-ico">' + def.emoji + '</span>' +
        '<span class="fc-meta"><b>' + esc(def.name) + '</b>' +
          '<small class="muted">' + (spent ? '오늘 몫은 다 냈습니다' : def.hint + ' — ' + core.actHint()) + '</small></span>' +
        (spent ? '<button class="btn ghost" disabled>비었음</button>'
               : '<button class="btn primary" data-act="v-do">' + esc(def.hint) + '</button>') +
        '</div>';
    } else {
      var res = f.obj;
      var req = V.requestOf(res.id);
      var it = VD.item(req.want);
      var have = V.bagCount(req.want);
      var lv = global.DG.mail ? global.DG.mail.leavingOf(res.id) : null;
      key = 'r|' + res.id + '|' + req.done + '|' + have + '|' + (lv ? lv.left : '');
      html = '<div class="focus-card">' +
        '<span class="fc-ico">' + pt('hero', res.ref, 40) + '</span>' +
        '<span class="fc-meta"><b>' + esc(res.ref.name) + (lv ? ' 💭' : '') + '</b>' +
          '<small class="muted">' +
            (lv ? '떠날 뜻을 비쳤습니다 (' + lv.left + '일) — ' +
                  (req.done ? '지금 말을 걸면 붙잡습니다' : '먼저 부탁을 들어주세요')
                : req.done ? '오늘 부탁은 끝났습니다'
                : it.emoji + ' ' + it.name + ' ' + have + '/' + req.n) +
          '</small></span>' +
        '<button class="btn ' + ((lv && req.done) || (!req.done && have >= req.n) ? 'primary' : '') +
          '" data-act="v-do">말 건다</button>' +
        '</div>';
    }
    if (key !== focusKey) { focusKey = key; els.focusbar.innerHTML = html; }
    els.focusbar.classList.add('show');
  }

  /* ── 가방 (전방) ──────────────────────────────────────── */

  function viewBag() {
    var V = global.DG.village;
    var list = V.bagList(), html = '', i, total = 0;
    for (i = 0; i < list.length; i++) { total += list[i].item.price * list[i].n; }

    html += '<div class="sec"><h4>가방</h4><div class="card">' +
      '<div class="stat-row"><span>모은 것</span><b>' + list.length + '가지</b></div>' +
      '<div class="stat-row"><span>다 팔면</span><b>🪙 ' + core.fmt(total) + '</b></div>' +
      '<button class="btn primary wide" data-act="v-sellall">🏪 전방에 다 판다 (부탁 몫은 남김)</button>' +
      '<small class="muted">주민이 부탁한 것은 남겨 둡니다. 하나씩 팔려면 아래에서 누르세요.</small>' +
      '</div></div>';

    html += viewShop();

    if (!list.length) {
      return html + '<div class="hint">가방이 비었습니다 — 나무를 흔들고 바위를 캐고 물가에서 낚아 보세요.</div>';
    }
    var st = V.status();
    var canPlant = st.canPlant;
    var folk = nearFolk();
    var gifted = folk ? V.giftedToday(folk.id) : false;
    html += '<div class="sec"><h4>모은 것</h4>';
    if (folk) {
      html += '<div class="hint">🎁 지금 <b>' + esc(folk.ref.name) + '</b> 곁입니다 — ' +
        (gifted ? '오늘은 이미 건넸습니다.'
                : '아래에서 하나를 골라 건넬 수 있습니다 (하루 한 번). ' +
                  '<b>좋아하는 갈래</b>를 주면 정이 훨씬 늡니다.') +
        /* §5.4 7♥ 해제 "동행" — 이미 다른 이와 걷고 있으면(folk.followStatus())
           안 보인다, 그쪽이 눌러서 알 일이다 */
        (V.canFollow(folk.id) && !global.DG.folk.followStatus()
          ? ' <button class="btn tiny" data-act="v-follow" data-who="' + folk.id +
              '">🚶 함께 걷기 (' + global.DG.folk.FOLLOW_SEC + '초)</button>'
          : '') + '</div>';
    }
    for (i = 0; i < list.length; i++) {
      var e = list[i];
      var sow = ['fruit', 'nut', 'flower'].indexOf(e.item.cat) >= 0;
      html += '<div class="card gearcard">' +
        '<div class="gearname">' + e.item.emoji + ' ' + esc(e.item.name) + gradeTag('gather', e.item.price) +
          ' <small class="muted">×' + e.n + ' · 낱개 🪙 ' + core.fmt(e.item.price) + '</small></div>' +
        '<div class="bagtools">' +
          '<button class="btn tiny" data-act="v-sell" data-id="' + e.item.key + '" data-n="1">1개 판다</button>' +
          '<button class="btn tiny ghost" data-act="v-sell" data-id="' + e.item.key +
            '" data-n="' + e.n + '">전부 (🪙 ' + core.fmt(e.item.price * e.n) + ')</button>' +
          (sow
            ? '<button class="btn tiny ' + (canPlant.ok ? 'primary' : 'ghost') + '"' +
                (canPlant.ok ? '' : ' disabled') +
                ' data-act="v-plant" data-id="' + e.item.key + '">🌱 심는다</button>'
            : '') +
          (folk && !gifted
            ? '<button class="btn tiny primary" data-act="v-gift" data-who="' + folk.id +
                '" data-id="' + e.item.key + '">🎁 ' + esc(folk.ref.name) + ' 에게</button>'
            : '') +
        '</div></div>';
    }
    html += '</div>';

    html += '<div class="sec"><h4>심기</h4><div class="card">' +
      '<div class="stat-row"><span>심어 둔 것</span><b>🌱 ' + st.planted + '</b></div>' +
      '<small class="muted">' +
        (canPlant.ok
          ? '지금 선 자리에 심을 수 있습니다.'
          : '지금 자리에는 못 심습니다 — ' + esc(canPlant.why) + '.') +
        ' 열매·씨앗·꽃만 심을 수 있고, <b>' + V.PLANT_DAYS + '일</b> 뒤에 자랍니다.' +
      '</small></div></div>';
    return html;
  }

  /* ── 전방의 오늘 물건 ─────────────────────────────────────
   * 도구는 한 번 사면 끝이고, 가구는 **오늘 것이 오늘뿐**이다 —
   * 원작의 그 진열장이다. 그래서 날마다 들러 볼 까닭이 생긴다.
   */
  function viewShop() {
    var V = global.DG.village, VD = global.DG.villageData, Hm = global.DG.home;
    var html = '', k, i;

    html += '<div class="sec"><h4>전방 — 도구</h4>';
    for (k in VD.TOOLS) {
      if (!Object.prototype.hasOwnProperty.call(VD.TOOLS, k)) { continue; }
      var t = VD.TOOLS[k];
      var got = V.hasTool(k);
      html += '<div class="card gearcard">' +
        '<div class="gearname">' + t.emoji + ' ' + esc(t.name) +
          ' <small class="muted">' + esc(t.desc) + '</small></div>' +
        '<div class="bagtools">' +
          (got
            ? '<button class="btn tiny ghost" disabled>가지고 있음</button>'
            : '<button class="btn tiny primary" data-act="v-buytool" data-id="' + k +
              '">산다 (🪙 ' + core.fmt(t.price) + ')</button>') +
        '</div></div>';
    }
    html += '</div>';

    var shop = Hm.shopToday();
    html += '<div class="sec"><h4>전방 — 오늘 들어온 가구</h4>';
    for (i = 0; i < shop.length; i++) {
      var f = shop[i];
      var set = VD.FURN_SETS[f.set];
      html += '<div class="card gearcard">' +
        '<div class="gearname">🪑 ' + esc(f.name) + gradeTag('goods', f.price) +
          ' <small class="muted">' + esc(set ? set.name : '') + ' 계열 · 창고에 ' +
          Hm.stockCount(f.key) + '</small></div>' +
        '<div class="bagtools">' +
          '<button class="btn tiny primary" data-act="v-buyfurn" data-id="' + f.key +
            '">산다 (🪙 ' + core.fmt(f.price) + ')</button>' +
        '</div></div>';
    }
    html += '<small class="muted">오늘 것은 오늘뿐입니다. 산 가구는 창고로 들어가고, ' +
      '집 안에서 선 자리에 놓습니다 (🏠 시트).</small></div>';

    /* 벽지·장판 — 가구보다 먼저 방의 인상을 바꾼다 */
    var fin = Hm.shopFinish();
    html += '<div class="sec"><h4>전방 — 오늘 들어온 벽지·장판</h4>';
    [['wall', fin.wall, '벽지'], ['floor', fin.floor, '장판']].forEach(function (e) {
      var got = Hm.ownsFinish(e[0], e[1].key);
      html += '<div class="card gearcard">' +
        '<div class="gearname">🎨 ' + esc(e[1].name) + gradeTag('goods', e[1].price) +
          ' <small class="muted">' + e[2] + '</small></div>' +
        '<div class="bagtools">' +
          (got
            ? '<button class="btn tiny ghost" disabled>가지고 있음</button>'
            : '<button class="btn tiny primary" data-act="v-buyfin" data-kind="' + e[0] +
              '" data-id="' + e[1].key + '">산다 (🪙 ' + core.fmt(e[1].price) + ')</button>') +
        '</div></div>';
    });
    html += '<small class="muted">산 것은 🏠 집 시트에서 갈아 끼웁니다. ' +
      '갈아 끼우면 집 평가도 오릅니다.</small></div>';

    html += viewTurnip();
    return html;
  }

  /* ── 공사 ─────────────────────────────────────────────────
   * 원작의 길·물길 공사. 손이 닿는 자리는 **선 칸 둘레 3×3** 뿐이라,
   * 고른 칸을 좌표가 아니라 **선 칸에서의 어긋남(dx,dy)** 으로 들고 있는다 —
   * 걸어가면 격자가 따라오고, 고른 칸도 함께 옮겨 간다.
   *
   * 규칙은 하나도 여기 두지 않았다. 무엇이 막는지는 `terrain.can()` 이
   * **말로** 돌려주므로, 화면은 그걸 그대로 단추에 적기만 한다.
   */
  var buildSel = { dx: 0, dy: 0 };

  function viewBuild() {
    var T = global.DG.terrain, V = global.DG.village, VD = global.DG.villageData;
    if (!T.has()) {
      return '<div class="hint">🪧 <b>개토패(開土牌)</b>가 없습니다 — ' +
        '🎒 가방 시트의 전방에서 살 수 있습니다.</div>';
    }
    if (V.indoors() || V.caveInside()) {
      return '<div class="hint">집 안에서는 땅을 고칠 수 없습니다 — 밖으로 나가세요.</div>';
    }

    var here = T.cell(), cells = T.around();
    var sel = { tx: here.tx + buildSel.dx, ty: here.ty + buildSel.dy };
    var selTile = VD.TILES[V.tileAt(sel.tx, sel.ty)];
    var html = '', i;

    html += '<div class="sec"><h4>선 자리</h4><div class="card">' +
      '<div class="stat-row"><span>내가 선 칸</span><b>(' + here.tx + ', ' + here.ty + ')</b></div>' +
      '<div class="stat-row"><span>고쳐 둔 칸</span><b>🪧 ' + T.count() + '</b></div>' +
      '<small class="muted">손이 닿는 것은 <b>선 칸과 그 둘레 여덟 칸</b>뿐입니다. ' +
      '걸어가면 아래 격자도 따라옵니다. 절벽은 이 판에 없습니다 — ' +
      '땅에 높이가 없는 투영이라 넣지 않았습니다.</small></div></div>';

    html += '<div class="sec"><h4>어느 칸</h4><div class="tgrid">';
    for (i = 0; i < cells.length; i++) {
      var c = cells[i];
      var on = c.tx === sel.tx && c.ty === sel.ty;
      var pd = c.prop ? VD.PROPS[c.prop.kind] : null;
      var mark = c.here ? '🧍' : (pd ? pd.emoji : (c.folk ? '🏡' : (c.worked ? '🪧' : '')));
      html += '<button class="tcell' + (on ? ' on' : '') + (c.outside ? ' out' : '') + '"' +
        (c.outside ? ' disabled' : '') +
        ' data-act="v-pick" data-dx="' + (c.tx - here.tx) + '" data-dy="' + (c.ty - here.ty) + '"' +
        ' style="background:' + c.color + '">' +
        '<span class="tc-mark">' + mark + '</span>' +
        '<span class="tc-name">' + esc(c.name) + '</span></button>';
    }
    html += '</div><small class="muted">🧍 내가 선 칸 · 🪧 고쳐 둔 칸 · ' +
      '사물이 선 칸은 그 사물이 뜹니다.</small></div>';

    html += '<div class="sec"><h4>무엇으로 — (' + sel.tx + ', ' + sel.ty + ') ' +
      esc(selTile ? selTile.name : '') + '</h4>';
    for (i = 0; i < T.PAVE.length; i++) {
      var pv = T.PAVE[i];
      var chk = T.can(sel.tx, sel.ty, pv.kind);
      html += '<div class="card gearcard">' +
        '<div class="gearname">' + pv.emoji + ' ' + esc(pv.name) +
          ' <small class="muted">' + esc(pv.desc) + '</small></div>' +
        '<div class="bagtools">' +
          (chk.ok
            ? '<button class="btn tiny primary" data-act="v-build" data-kind="' + pv.kind +
              '">고친다 (🪙 ' + core.fmt(chk.cost) + ')</button>'
            : '<button class="btn tiny ghost" disabled>' + esc(chk.why) + '</button>') +
        '</div></div>';
    }
    html += '<small class="muted">고치면 그 칸의 사물이 다시 짜입니다 — ' +
      '모래펄에는 조개가 나고 낚시터가 설 수 있습니다. 그래서 모래가 가장 비쌉니다. ' +
      '되돌리면 세이브에서도 그 칸이 지워집니다.</small></div>';
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
    return html;
  }

  /** 지금 곁에 있는 주민 (선물을 건넬 수 있는 사람) */
  function nearFolk() {
    var V = global.DG.village;
    if (V.indoors() || V.caveInside()) { return null; }
    var raw = V.raw(), best = null, bd = V.REACH;
    for (var i = 0; i < raw.residents.length; i++) {
      var d = Math.hypot(raw.residents[i].x - raw.player.x,
                         raw.residents[i].y - raw.player.y);
      if (d < bd) { bd = d; best = raw.residents[i]; }
    }
    return best;
  }

  /* ── 주민 ─────────────────────────────────────────────── */

  function viewFolks() {
    var V = global.DG.village, VD = global.DG.villageData;
    var raw = V.raw(), html = '', i;
    html += '<div class="sec"><h4>오늘의 부탁</h4>';
    for (i = 0; i < raw.residents.length; i++) {
      var res = raw.residents[i];
      var req = V.requestOf(res.id);
      var it = VD.item(req.want);
      var have = V.bagCount(req.want);
      var lv = global.DG.mail.leavingOf(res.id);
      var ty2 = global.DG.folk.typeOf(res.id);
      var heart = V.heartOf(res.id), nextU = V.heartNext(res.id);
      var fs = global.DG.folk.followStatus();
      var following = fs && fs.id === res.id;
      html += '<button class="card partyrow" data-act="detail" data-kind="hero" data-id="' + res.id + '">' +
        '<span class="pr-ico">' + pt('hero', res.ref, 44) + '</span>' +
        '<span class="pr-meta"><b>' + esc(res.ref.name) + ' <small class="muted">' +
          ty2.icon + ' ' + esc(ty2.name) + '</small></b>' +
          '<small class="muted">' + (req.done ? '✔️ 오늘 부탁 완료'
            : it.emoji + ' ' + it.name + ' ' + have + '/' + req.n) +
          ' · 💗 ' + heart + '/10' + (nextU ? ' (다음 ' + nextU.at + '♥ — ' + esc(nextU.name) + ')' : ' (다 열었다)') +
          ' · 친밀도 ' + V.friendOf(res.id) +
          ' · 🎁 ' + esc(CAT_NAME[V.giftLike(res.id)] || V.giftLike(res.id)) + ' 를 반긴다' +
          (lv ? ' · 💭 떠날 뜻 (' + lv.left + '일)' : '') +
          (following ? ' · 🚶 함께 걷는 중 (' + Math.ceil(fs.left) + '초)' : '') + '</small></span>' +
        '</button>';
    }
    html += '</div>';
    var ch = global.DG.folk.status();
    html += '<div class="card">' +
      (ch ? '<div class="gearname">💬 ' + esc(ch.a) + ' 와(과) ' + esc(ch.b) +
              ' 가 이야기 중입니다</div><small class="muted">「' + esc(ch.line) + '」 — ' +
              '곁에서 <b>끝까지</b> 들으면 두 사람과 정이 늡니다 (하루 한 번)</small>'
          : '<div class="gearname">💬 주민끼리의 이야기</div>' +
            '<small class="muted">가까이 선 두 사람은 가끔 저희끼리 말을 주고받습니다. ' +
            '곁에서 끝까지 들으면 두 사람과 정이 늡니다 (하루 한 번).</small>') +
      '<button class="btn wide" data-act="v-town">🏳️ 마을 게시판을 본다</button>' +
      '</div>';
    html += '<div class="hint">부탁한 것을 가방에 채우고 그 사람 앞에서 <b>말을 건다</b>를 누르면 건네줍니다. ' +
      '날이 바뀌면 부탁도 새로 받습니다.<br>' +
      '💭 가 붙은 사람은 <b>떠날 뜻</b>을 비친 것입니다 — 그날 부탁을 들어준 뒤 말을 걸면 붙잡습니다. ' +
      '못 붙잡으면 떠나고 새 인물이 이사 옵니다.</div>';
    return html;
  }


  /* ── 편지 (우편함) ────────────────────────────────────────
   * 원작의 우편함. 읽고, 선물을 받고, **답장을 쓴다**(정이 는다).
   * 안 읽은 것이 위에 오도록 굳이 다시 정렬하지 않는다 — 온 순서가 곧 이야기다.
   */
  var CAT_NAME = { fruit: '열매', nut: '씨앗', ore: '광물', flower: '꽃', herb: '약초',
                   fish: '물고기', bug: '곤충', shell: '조개', fossil: '화석', ruin: '탑성 조각' };

  var MAIL_ICON = { thanks: '🎁', hello: '🏡', bye: '🍂', notice: '💭',
                    warm: '✉️', hha: '📐', shop: '🏪', giftback: '🎀',
                    museum: '🏛️', event: '🎊', turnip: '🥬', answer: '📨', wish: '🌠', beauty: '🌾' };

  function viewMail() {
    var M = global.DG.mail, VD = global.DG.villageData;
    var list = M.list(), html = '', i;

    html += '<div class="sec"><h4>우편함</h4><div class="card">' +
      '<div class="stat-row"><span>온 편지</span><b>' + list.length + '통</b></div>' +
      '<div class="stat-row"><span>안 읽은 것</span><b>' + M.unread() + '통</b></div>' +
      '<small class="muted">날이 바뀔 때 배달됩니다. 답장을 쓰면 그 사람과 정이 늡니다 ' +
      '(사람마다 하루 한 번).</small></div></div>';

    /* 내가 먼저 쓰는 편지 — 곁에 없어도 마음을 전한다 */
    var raw = global.DG.village.raw();
    html += '<div class="sec"><h4>편지를 쓴다</h4>';
    for (i = 0; i < raw.residents.length; i++) {
      var r2 = raw.residents[i];
      var sent = M.wroteToday(r2.id);
      var ty = global.DG.folk.typeOf(r2.id);
      html += '<div class="card gearcard">' +
        '<div class="gearname">' + ty.icon + ' ' + esc(r2.ref.name) +
          ' <small class="muted">' + esc(ty.name) + ' · ' + esc(ty.desc) + '</small></div>' +
        '<div class="bagtools">' +
          (sent
            ? '<button class="btn tiny ghost" disabled>오늘은 보냈음</button>'
            : '<button class="btn tiny primary" data-act="v-mwrite" data-id="' + r2.id +
              '">✉️ 편지를 쓴다</button>') +
        '</div></div>';
    }
    html += '<small class="muted">사람마다 하루 한 번. 친밀도가 오르고 ' +
      '<b>다음 날 답장</b>이 옵니다. 답장을 쓰는 것과는 다른 칸입니다.</small></div>';

    if (!list.length) {
      return html + '<div class="hint">아직 온 편지가 없습니다 — 주민의 부탁을 들어주거나 ' +
        '먼저 편지를 부치면 다음 날 답장이 옵니다.</div>';
    }

    html += '<div class="sec"><h4>온 것</h4>';
    for (i = 0; i < list.length; i++) {
      var l = list[i];
      var who = l.from === 'town' ? null : data.find(l.from);
      var gift = l.gift;
      var gtext = '';
      if (gift) {
        if (gift.type === 'furn') {
          var gf = VD.furn(gift.key);
          gtext = '🪑 ' + (gf ? gf.name : gift.key);
        } else if (gift.type === 'gold') {
          gtext = '🪙 ' + core.fmt(gift.n);
        } else {
          var gi = VD.item(gift.key);
          gtext = gi ? gi.emoji + ' ' + gi.name + ' ×' + (gift.n || 1) : '';
        }
      }
      html += '<div class="card gearcard' + (l.read ? '' : ' hi') + '">' +
        '<div class="gearname">' + (MAIL_ICON[l.kind] || '✉️') + ' ' + esc(l.title) +
          (l.read ? '' : ' <small class="muted">· 새 편지</small>') + '</div>' +
        '<small class="muted">' + esc(l.body) + '</small>' +
        '<div class="bagtools">' +
          (l.read ? '' : '<button class="btn tiny" data-act="v-mopen" data-id="' + l.id + '">읽는다</button>') +
          (gift ? '<button class="btn tiny primary" data-act="v-mtake" data-id="' + l.id +
                  '">선물을 받는다 (' + gtext + ')</button>' : '') +
          (who ? '<button class="btn tiny ' + (l.replied ? 'ghost' : '') + '"' +
                 (l.replied ? ' disabled' : '') + ' data-act="v-mreply" data-id="' + l.id +
                 '">' + (l.replied ? '답장함' : '답장을 쓴다') + '</button>' : '') +
        '</div></div>';
    }
    html += '</div>';
    return html;
  }

