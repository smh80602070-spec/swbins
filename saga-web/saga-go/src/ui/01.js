/**
 * UI — 프로필 / 재화 / 근처 대상 / 시트(서당·도감·사관·기록) / 상세 / 토스트
 * ---------------------------------------------------------------
 * 사가고 본편(원작 형태) 화면. 던전·전투·장비 UI 는 js/_expansion/ 으로 뺐고,
 * 경영(영지·태수·건설)은 게임에서 아예 제거했다 (v1.0-full 커밋 94850f8 에 이력이 남아 있다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var data = global.DG.data;

  var els = {};
  var openTab = null;          // 열려 있는 시트 이름 (null 이면 닫힘)
  var openDetailRef = null;    // 열려 있는 상세 화면 { kind, id }

  function hero() { return global.DG.hero; }
  function net() { return global.DG.net; }
  function ai() { return global.DG.ai; }

  function $(id) { return document.getElementById(id); }
  var ico = global.DG.itemicon ? global.DG.itemicon.fn('saga-go') : function (k, i, s, f) { return f || ''; };   /* 아이템 아이콘(W-0025) */ function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  /** 초상 <img> — 실제 빌드는 `portrait3d.img()` 하나로 모았다(다른 화면들과 같은 자리) */
  function pt(kind, ref, size) {
    return global.DG.portrait3d.img(kind, ref, size || 48);
  }

  /** 정사각이 아닌 자리(도감 상세의 150×172)가 제 마크업을 직접 짤 때 쓰는 이름표만 */
  function p3tag(kind, ref, w, h) {
    return global.DG.portrait3d.tag(kind, ref, w, h);
  }

  /** 이미 구워 둔 3D 초상이 있으면 그걸로 바로 시작한다(없으면 fallback 그림) —
   *  `portrait3d.img()`와 같은 이유(2026-09-19, 깜빡임 제보). */
  function p3src(kind, ref, w, h, fallback) {
    var P3 = global.DG.portrait3d;
    var baked = P3 && P3.of ? P3.of(kind, ref, w, h) : null;
    if (baked) { return { src: baked, done: ' data-p3-done="1"' }; }
    /* 3D 로 꼭 갈아 끼워질 자리는 코드 스프라이트 대신 자리표시로 시작한다(SAGA-DESIGN §11 Phase 0) — 못 쓰는 자리는 옛 그림.
       fallback 은 함수라 자리표시일 땐 스프라이트를 아예 안 그린다 */
    if (P3 && P3.willSwap && P3.willSwap(kind, ref, w, h)) { return { src: P3.holder(w, h), done: ' data-p3-holder="1"' }; }
    return { src: typeof fallback === 'function' ? fallback() : fallback, done: '' };
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
    ['profile', 'wallet', 'near', 'autobar', 'dock', 'sheet',
     'sheet-title', 'sheet-body', 'sheet-close', 'scrim', 'toast', 'levelup'].forEach(function (id) {
      els[id] = $(id);
    });
    initStick();

    els.dock.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sheet]');
      if (!b) { return; }
      var name = b.getAttribute('data-sheet');
      if (openTab === name) { closeSheet(); } else { openSheet(name); }
    });
    els.profile.addEventListener('click', function (e) {
      if (!e.target.closest('[data-act="open-quest"]')) { return; }
      openSheet('quest');
    });
    els['sheet-close'].addEventListener('click', closeSheet);
    els.scrim.addEventListener('click', closeSheet);
    global.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') { return; }
      if (openDetailRef) { closeDetail(); return; }
      if (openTab && !global.DG.encounter.active) { closeSheet(); }
    });

    els.near.addEventListener('click', function (e) {
      if (e.target.closest('[data-act="visit"]')) {
        var ns = global.DG.world.nearestStation();
        if (ns && ns.inRange) { core.emit('station:request', ns.station); }
        return;
      }
      if (e.target.closest('[data-act="beacon"]')) {
        var BC = global.DG.beacon, nb = BC && BC.nearest();
        if (nb && nb.inRange) { core.emit('beacon:request', nb.beacon); }
        return;
      }
      if (e.target.closest('[data-act="bloom"]')) {              // ⑲-10 보상 꽃
        var FB0 = global.DG.fieldBoss, nb0 = FB0 && FB0.nearest(DOMAIN_NEAR);
        if (nb0 && nb0.inRange) { core.emit('fieldboss:request', nb0.b); }
        return;
      }
      if (e.target.closest('[data-act="domain"]')) {             // ⑲-9 숨은 터 입구
        var DM0 = global.DG.domain, nd0 = DM0 && DM0.nearest(DOMAIN_NEAR);
        if (nd0 && nd0.inRange) { core.emit('domain:request', nd0.d); }
        return;
      }
      if (e.target.closest('[data-act="shrine"]')) {
        var SH0 = global.DG.shrine, ns0 = SH0 && SH0.nearest(SHRINE_NEAR);
        if (ns0 && ns0.inRange) { core.emit('shrine:request', ns0.shrine); }
        return;
      }
      if (e.target.closest('[data-act="near-more"]')) { nearAll = !nearAll; nearUid = null; renderNear(); return; }
      var appr = e.target.closest('[data-act="approach"]');
      if (appr) {
        var tx = parseFloat(appr.getAttribute('data-tx')), ty = parseFloat(appr.getAttribute('data-ty'));
        if (isFinite(tx) && isFinite(ty)) { global.DG.world.walkTo(tx, ty); }
        return;
      }
      if (!e.target.closest('[data-act="meet"]')) { return; }
      var n = global.DG.world.nearest();
      if (n && n.inRange) { core.emit('encounter:request', n.spawn); }
    });

    els['sheet-body'].addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) { return; }
      var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
      if (act === 'detail') {
        openDetail(b.getAttribute('data-kind') || 'hero', id);
        return;
      }
      if (act === 'fm-preset') {                                         // ⑲-18 편성 여러 벌
        var FMp = global.DG.formation, pr = FMp && FMp.use ? FMp.use(+b.getAttribute('data-i')) : null;
        if (pr && pr.ok) { toast('⚔ 편성 ' + (pr.preset + 1) + ' — ' + (pr.list.length ? pr.list.length + '명' : '나 혼자')); }
        else if (pr && !pr.same) { toast('⚔ ' + pr.why); }
        renderSheet(); renderTop();
        return;
      }
      if (act === 'key-remap') {
        var W0 = global.DG.world;
        if (W0 && W0.beginRemap) { W0.beginRemap(b.getAttribute('data-action')); renderSheet(); }
        return;
      }
      if (act === 'snd-toggle') {
        var AU0 = global.DG.audio;
        if (AU0) { AU0.setEnabled(!AU0.enabled()); renderSheet(); }
        return;
      }
      if (act === 'gq-auto') {
        var PF0 = global.DG.perf;
        if (PF0 && PF0.unpin) { PF0.unpin(); renderSheet(); }
        return;
      }
      if (act === 'gq-set') {
        var PF1 = global.DG.perf;
        if (PF1 && PF1.pin) { PF1.pin(b.getAttribute('data-level')); renderSheet(); }
        return;
      }
      if (act === 'auto-on') {
        global.DG.auto.toggle();
      } else if (act === 'auto-flag') {
        global.DG.auto.toggleFlag(b.getAttribute('data-flag'));
      } else if (act === 'wl-lower' || act === 'wl-restore') {
        var AD = global.DG.adventure, wr = AD ? (act === 'wl-lower' ? AD.lower() : AD.restore()) : null;
        if (wr) { toast(wr.ok ? '🌍 천하 등급 ' + wr.wl + ' — 들판 적이 ' + (act === 'wl-lower' ? '약해졌습니다' : '되돌아왔습니다') : '🌍 ' + wr.why); }
      } else if (act === 'quest-claim') {
        var qr = global.DG.quest.claim(parseInt(b.getAttribute('data-i'), 10));
        if (qr && qr.breakthrough) { closeSheet(); }
      } else if (act === 'bag-use') {
        var ur = global.DG.bag.use(id);
        if (!ur.ok) { toast('쓸 수 없습니다'); }
      } else if (act === 'letter-put') {
        global.DG.letter.put(parseInt(b.getAttribute('data-i'), 10), null);
      } else if (act === 'buddy-feed') {
        var fr = global.DG.buddy.feed();
        if (!fr.ok) { toast('🍖 ' + fr.why); }
      } else if (act === 'purify') {
        var pr = global.DG.rogue ? global.DG.rogue.purify(id) : { ok: false, reason: '없음' };
        if (!pr.ok) {
          toast('✨ ' + pr.reason + (pr.cost ? ' — 단사 ' + pr.cost.dust + ' 필요' : ''));
        }
      } else { return; }
      core.persist(); renderSheet();
    });
    /* 음량 슬라이더 — 끌 때마다(input) 바로 듣고, 값칸만 직접 고쳐 슬라이더가
       손 밑에서 튀지 않게 한다(전체 renderSheet() 는 안 부른다) */
    els['sheet-body'].addEventListener('input', function (e) {
      var el = e.target, act = el.getAttribute('data-act');
      if (act === 'snd-vol') {
        var AU = global.DG.audio;
        if (!AU) { return; }
        var v = AU.setVolume((parseInt(el.value, 10) || 0) / 100);
        var lbl = el.nextElementSibling;
        if (lbl) { lbl.textContent = Math.round(v * 100) + '%'; }
      }
    });

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
      else if (act === 'perk-pick') { if (global.DG.perk) { global.DG.perk.choose(id, b.getAttribute('data-perk')); } }
      else if (act === 'perk-skip') { if (global.DG.perk) { global.DG.perk.decline(id); } }
      else if (act === 'talent-up') {
        var TLu = global.DG.talent, tk = b.getAttribute('data-key');
        if (TLu && !TLu.up(id, tk)) { toast('⚔️ ' + TLu.upCheck(id, tk).why); }
      }
      else if (act === 'wp-up' || act === 'wp-asc') {
        var WPa = global.DG.weapon, wid0 = b.getAttribute('data-wid');
        if (WPa) {
          var okW = act === 'wp-up' ? WPa.up(wid0) : WPa.ascend(wid0);
          if (!okW) { toast('🗡️ ' + (act === 'wp-up' ? WPa.upCheck(wid0) : WPa.ascCheck(wid0)).why); }
        }
      }
      else if (act === 'art-up') {
        var ARu = global.DG.artifact, uid0 = b.getAttribute('data-uid');
        if (ARu && !ARu.up(uid0)) { toast('🏺 ' + ARu.upCheck(uid0).why); }
      }
      else if (act === 'art-salvage4') {
        if (global.DG.artifact && !global.DG.artifact.salvageLoose4()) { toast('🏺 안 낀 ★4 가 없습니다'); }
      }
      else if (act === 'talent-con') {
        var TLc = global.DG.talent;
        if (TLc && !TLc.unlockCon(id)) { toast('🌟 ' + TLc.conCheck(id).why); }
      }
      else if (act === 'buddy-set') { if (buddy()) { buddy().set(id); } }
      else if (act === 'buddy-clear') { if (buddy()) { buddy().clear(); } }
      else if (act === 'buddy-feed') {
        var fr2 = buddy() ? buddy().feed() : { ok: false, why: '반려 없음' };
        if (!fr2.ok) { toast('🍖 ' + fr2.why); }
      }
      else if (act === 'refine') { if (growth()) { growth().refine(id); } }
      else if (act === 'ascend') { if (growth()) { growth().ascend(id); } }
      else if (act === 'join' || act === 'drop' || act === 'party-up' || act === 'party-field') {
        var FMa = global.DG.formation;                                   // ⑲-15 편성
        if (FMa) {
          var fr = FMa.apply({ join: 'put', drop: 'drop', 'party-up': 'up', 'party-field': 'field' }[act], id);
          if (!fr.ok) { toast('⚔ ' + fr.why); }
          else if (fr.swap) { var sh = data.find(fr.swap); toast('⚔ ' + (sh ? sh.name : fr.swap) + '와 자리를 바꿨다'); }
        } else if (act === 'join') {
          if (core.save.party.length < 5 && core.save.party.indexOf(id) < 0) { core.save.party.push(id); }
        } else if (act === 'drop') {
          core.save.party = core.save.party.filter(function (x) { return x !== id; });
          delete core.save.petEquip[id];
        }
      } else { return; }
      core.persist(); renderDetail(); renderSheet(); renderTop();
    });
    host.addEventListener('change', function (e) {
      /* ⑲-5 무기·보패 고르기 */
      var ws = e.target.closest('[data-wp-equip]');
      if (ws) {
        if (global.DG.weapon) { global.DG.weapon.equip(ws.getAttribute('data-wp-equip'), ws.value); }
        renderDetail(); renderSheet();
        return;
      }
      var as = e.target.closest('[data-art-equip]');
      if (as) {
        var AR = global.DG.artifact, hid = as.getAttribute('data-art-equip');
        if (AR) {
          if (as.value) { AR.equip(hid, as.value); }
          else { var cur = AR.equippedOf(hid)[as.getAttribute('data-slot')]; if (cur) { AR.unequip(cur); } }
        }
        renderDetail(); renderSheet();
        return;
      }
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

    /* 균형 손잡이가 잡혀 있으면 **화면에 드러낸다** — 잡아 둔 줄 모르고
       "균형이 이상하다" 고 볼까 봐. 다른 창(어드민)에서 바뀌면 그때도 알린다. */
    core.on('tune', function () {
      toast('🎛️ 균형 손잡이가 바뀌었습니다 — 새로고침하면 규칙에 반영됩니다');
      renderTop();
    });
    core.on('toast', toast);
    core.on('levelup', showLevelUp);
    core.on('changed', function () { renderTop(); renderSheet(); stickSync(); });
    core.on('dg:keyremap', function () { if (openTab === 'keys') { renderSheet(); } });
    core.on('dex:new', function (p) {
      var ent = data.find(p.id);
      if (ent) { toast('📖 도감 신규 등록 · ' + ent.name); }
    });

    renderTop(); renderNear();
  }

  /* ── 시트 ─────────────────────────────────────────────── */

  var SHEET_TITLE = {
    quest: '📋 사명', party: '👤 동행', bag: '🎒 행낭', letters: '✉️ 천거장',
    dex: '📖 도감', oracle: '🔮 사관', log: '📜 기록', keys: '⌨️ 키설정',
    settings: '⚙️ 설정'
  };

  /**
   * 2026-09-10 — 다른 네 판의 ⚙️ 설정 시트와 같은 결. 이 판은 효과음(`js/audio.js`,
   * mp3 다섯 조각)도 그래픽 품질(`js/perf.js`, 기기를 보고 시작해 프레임에 맞춰
   * 스스로 오르내리는 3단)도 **이미 있었다** — 그저 사람이 손댈 자리가 없었을
   * 뿐이다(어드민에서만 손잡이로 만졌다). 새로 만든 것은 이 화면과, `perf.js`의
   * `pin`/`unpin`(고른 등급을 손잡이에 남겨 새로고침해도 유지) 뿐이다.
   */
  var Q_ORDER = ['LOW', 'MEDIUM', 'HIGH'];
  function viewSettings() {
    var AU = global.DG.audio, PF = global.DG.perf, W3 = global.DG.world3d;
    if (!AU) { return '<div class="hint">소리 모듈을 찾을 수 없습니다</div>'; }
    var on = AU.enabled(), vol = Math.round(AU.volume() * 100);
    var gq = '';
    if (PF && W3 && W3.active && W3.active()) {
      var cur = PF.tier(), pinned = PF.pinned(), i;
      gq = '<div class="key-row"><b>그래픽 품질</b><span class="key-cur">' +
        (pinned ? cur.name : '자동(' + cur.name + ')') +
        '</span></div><div class="key-row" style="gap:6px">' +
        '<button class="btn tiny' + (!pinned ? ' primary' : ' ghost') +
          '" data-act="gq-auto">자동</button>';
      for (i = 0; i < Q_ORDER.length; i++) {
        var key = Q_ORDER[i];
        var t = null, j;
        for (j = 0; j < PF.TIERS.length; j++) { if (PF.TIERS[j].key === key) { t = PF.TIERS[j]; } }
        if (!t) { continue; }
        gq += '<button class="btn tiny' + (pinned && cur.key === key ? ' primary' : ' ghost') +
          '" data-act="gq-set" data-level="' + key + '">' + t.name + '</button>';
      }
      gq += '</div><div class="hint">낮음일수록 사물이 성글고 그림자가 꺼져 가벼워집니다. ' +
        '자동은 기기를 보고 시작해 프레임에 맞춰 스스로 오갑니다.</div>';
    }
    return '<div class="hint keyhint">이동 키는 ⌨️ 키설정에 있습니다.</div>' +
      '<div class="key-row"><b>효과음</b>' +
        '<button data-act="snd-toggle">' + (on ? '켜짐' : '꺼짐') + '</button></div>' +
      '<div class="key-row"><b>음량</b>' +
        '<input type="range" min="0" max="100" value="' + vol + '" data-act="snd-vol"' +
        (on ? '' : ' disabled') + '>' +
        '<span class="key-cur">' + vol + '%</span></div>' +
      (global.DG.bgm ? global.DG.bgm.settingsHtml() : '') + gq;
  }

  /** 2026-09-09 — 이동 키 다시 지정(키보드 모의 이동 모드용). WASD·방향키는
   *  코드에 그대로 박혀 있고(실수로 못 쓰게 되지 않게), 여기서는 그 옆에
   *  하나 더 쓸 키만 고른다. */
  function viewKeys() {
    var W = global.DG.world;
    if (!W || !W.keymap) { return '<div class="hint">지금 화면에서는 키를 지정할 수 없습니다</div>'; }
    var km = W.keymap(), rm = W.remapping();
    var rows = [{ a: 'up', t: '위' }, { a: 'down', t: '아래' }, { a: 'left', t: '왼쪽' }, { a: 'right', t: '오른쪽' }];
    var h = '<div class="hint">WASD·방향키는 항상 그대로 됩니다 — 여기서는 그 옆에 더 쓸 키 하나만 고릅니다. ' +
      '(키보드 모의 이동 모드에서만 씁니다 — 실제 GPS로 걸을 땐 안 씁니다)</div>';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      h += '<div class="key-row"><b>' + r.t + '</b><span class="key-cur">' + esc((km[r.a] || '').toUpperCase()) + '</span>' +
        '<button data-act="key-remap" data-action="' + r.a + '">' +
        (rm === r.a ? '키를 누르세요…' : '다시 지정') + '</button></div>';
    }
    return h;
  }

  function openSheet(name) {
    openTab = name; core.emit('sheet:open', { name: name });
    els['sheet-title'].textContent = SHEET_TITLE[name] || name;
    els.sheet.classList.add('show');
    document.body.classList.add('sheet-open');
    if (global.innerWidth <= 780) { els.scrim.classList.add('show'); }
    syncDock();
    renderSheet();
  }

  function closeSheet() {
    openTab = null;
    els.sheet.classList.remove('show');
    document.body.classList.remove('sheet-open');
    els.scrim.classList.remove('show');
    syncDock();
  }

  function syncDock() {
    var bs = els.dock.querySelectorAll('[data-sheet]');
    for (var i = 0; i < bs.length; i++) {
      bs[i].classList.toggle('on', bs[i].getAttribute('data-sheet') === openTab);
    }
  }

  function renderSheet() {
    if (!openTab) { return; }
    var v = openTab === 'quest' ? viewQuest() : openTab === 'party' ? global.DG.partySheet.view({ esc: esc, pt: pt, titleOf: titleOf, advText: advText, presetStrip: presetStrip, buddy: buddy })   // 동행(W-0092) — js/party-sheet.js
          : openTab === 'bag' ? viewBag()
          : openTab === 'letters' ? viewLetters()
          : openTab === 'dex' ? viewDex()
          : openTab === 'oracle' ? viewOracle()
          : openTab === 'keys' ? viewKeys()
          : openTab === 'settings' ? viewSettings() : viewLog();
    els['sheet-body'].innerHTML = v;
  }

  /* ── 상단 ─────────────────────────────────────────────── */

  /**
   * 목표판 3줄(PLAN §5 ④, SAGA-DESIGN 표준 A) — **지금**(가장 가까운 상호작용) ·
   * **이번 세션**(오늘의 일과 중 남은 것) · **이번 주**(주간 이정표 다음 단).
   * 옛 `goalLine()`(사명 한 줄)을 대신한다 — 사명은 탭에서 계속 보인다.
   */

  /** "지금" — 가장 가까운 상호작용. 역참·야생 대상 중 더 가까운 쪽(봉수대·사당·
   *  비석은 PLAN §5 ①②⑤가 서면 여기 후보에 합류한다). 텍스트만 낸다 —
   *  마무리 카드의 "다음" 줄도 이 함수를 그대로 쓴다. */
  function goalNowText() {
    var w = global.DG.world, cands = [], tl = global.DG.tut ? global.DG.tut.line() : ''; if (tl) { return tl; }   // 첫 10분 안내가 남았으면 그 단계가 첫 줄(tutorial.js)
    var n = w.nearest ? w.nearest() : null;
    if (n) {
      cands.push({ d: n.dist, txt: (n.spawn.kind === 'hero' ? '🧑 ' : '🐾 ') + esc(n.spawn.ref.name) +
        (n.inRange ? ' — 만나기' : ' · ' + Math.round(n.dist) + 'm') });
    }
    var ns = w.nearestStation ? w.nearestStation() : null;
    if (ns) {
      var stn = global.DG.station, stt = stn ? stn.stateOf(ns.station.key) : null;
      if (!stt || stt.ready) {
        cands.push({ d: ns.dist, txt: '🏮 ' + esc(ns.station.name) +
          (ns.inRange ? ' — 들르기' : ' · ' + Math.round(ns.dist) + 'm') });
      }
    }
    var BC = global.DG.beacon, nb = BC ? BC.nearestUnlit() : null;
    if (nb) {
      cands.push({ d: nb.dist, txt: '🗼 ' + esc(nb.beacon.name) + ' 봉수대' +
        (nb.dist <= BC.HIT_RADIUS ? ' — 불 올리기' : ' · ' + Math.round(nb.dist) + 'm') });
    }
    var SH1 = global.DG.shrine, nsh = SH1 ? SH1.nearest(SHRINE_NEAR) : null;
    if (nsh) {
      cands.push({ d: nsh.dist, txt: '⛩️ ' + esc(nsh.shrine.name) +
        (nsh.inRange ? ' — 시련 받기' : ' · ' + Math.round(nsh.dist) + 'm') });
    }
    if (!cands.length) { return '걸으면 새로운 것을 만납니다'; }
    cands.sort(function (a, b) { return a.d - b.d; });
    return cands[0].txt;
  }

  /** "이번 세션" — 오늘의 일과(daily.js) 중 첫 미완료 */
  function goalSessionText() {
    var Dl = global.DG.daily;
    if (!Dl) { return ''; }
    var t = Dl.firstUndone(), n = Dl.state().tasks.length, head = '일과 ' + Dl.doneCount() + '/' + n;   // ⑲-8
    if (!t) { return Dl.bonusState() === 'ready' ? head + ' — 역참에서 마무리 보상' : '오늘 일과를 다 했습니다'; }
    return head + ' · ' + esc(t.def.name) + ' <b>' + core.fmt(Math.min(t.got, t.need)) + '/' + core.fmt(t.need) + '</b>';
  }

  /** "이번 주" — 주간 이정표(milestone.js) 다음 단 */
  function goalWeekText() {
    var M = global.DG.milestone;
    if (!M) { return ''; }
    var rungs = M.rungs();
    for (var i = 0; i < rungs.length; i++) {
      if (!rungs[i].got) { return core.fmt(rungs[i].m) + 'm 이정표 <b>' + rungs[i].pct + '%</b>'; }
    }
    return '이번 주 이정표를 다 받았습니다';
  }

  function goalBoard() {
    var Dl = global.DG.daily, M = global.DG.milestone;
    return '<div class="p-goal now">🧭 ' + goalNowText() + '</div>' +
      (Dl ? '<div class="p-goal" data-act="open-quest">🎯 ' + goalSessionText() + '</div>' : '') +
      (M ? '<div class="p-goal" data-act="open-quest">🚩 ' + goalWeekText() + '</div>' : '');
  }

  /** 윗단 등급 글 — ⑲-7 여정 등급·천하 등급(adventure.js 가 없으면 예전 "Lv.N") */
  function advText(lv) {
    var A = global.DG.adventure;
    return A ? '모험 ' + lv + ' · 세계 ' + A.worldLevel() : 'Lv.' + lv;
  }

  function renderTop() {
    var p = core.save.player;
    var need = core.expNeed(p.level);
    var pct = Math.round(p.exp / need * 100);
    var w = global.DG.world;
    var rkey = w.currentRegionKey();

    var wx = global.DG.weather.current();
    els.profile.innerHTML =
      '<div class="avatar" style="--p:' + pct + '%"><i>🧭</i></div>' +
      '<div class="p-meta">' +
        '<div class="p-title">' + titleOf(p.featTotal) + ' · ' + advText(p.level) + '</div>' +
        (core.tuneCount() ? '<div class="p-tune" title="어드민에서 잡아 둔 균형 손잡이가 있습니다">🎛️ 손잡이 ' +
          core.tuneCount() + '개' + (global.DG.world.speedMul > 1 ? ' · 걸음 ×' + global.DG.world.speedMul : '') +
          '</div>' : '') +
        '<div class="p-sub" title="' + esc(wx.text) + '">' + wx.emoji + ' ' + wx.name +
          ' · 📍 ' + esc(w.regionName(rkey)) +
          ' · <b>' + core.fmt(p.distance) + 'm</b> 이동' +
          (net().online() ? ' · <span class="on-dot">🔮</span>' : '') + '</div>' +
        goalBoard() +
      '</div>';

    els.wallet.innerHTML =
      coin('🪙', core.fmt(p.gold), '금', false, 'coins') +
      coin('🎖️', core.fmt(p.fame), '명성', false, 'medal') +
      coin('🏅', core.fmt(p.feat), '공적', true, 'award') +
      coin('📜', core.fmt(core.save.items.scroll), '등용서', false, 'scroll') +
      coin('🍖', core.fmt(core.save.items.feed), '사료', false, 'ham') +
      coin('✨', core.fmt(growth() ? growth().dust() : 0), '단사(丹砂) — 펫 연성에 쓴다', false, 'sparkles');
    /* 지갑은 값이 바뀔 때마다 다시 그려지므로 **그릴 때마다 한 번 훑는다** */
    if (global.DG.icon) { global.DG.icon.sweep(els.wallet); }
  }

  /**
   * 지갑의 한 칸. `ic` 를 주면 그 이름의 아이콘으로 갈린다(`icon.js`) —
   * 안 주거나 손잡이를 내리면 이모지가 그대로 남는다.
   */
  function coin(icon, val, label, hi, ic) {
    var tag = ic ? ' data-icon="' + ic + '"' : '';
    return '<div class="coin' + (hi ? ' hi' : '') + '" title="' + label + '"><span' + tag + '>' + icon + '</span>' + val + '</div>';
  }

  /* ── 근처 대상 ────────────────────────────────────────── */

  var nearUid = null, nearAll = false;
  /** 폰 세로 폭 — CSS 의 `@media (max-width: 600px)` 와 같은 선 */
  function isPhonePortrait() {
    return !!(global.matchMedia && global.matchMedia('(max-width: 600px)').matches);
  }

  /**
   * "가까이 가기" 표시 — 대상이 사거리 밖일 때 뜬다. **시뮬레이션 이동
   * (`mode === 'keyboard'`)에서는 눌러서 그쪽으로 걸어갈 수 있다** — 지도를
   * 탭해 걷는 것과 같은 길(`world.walkTo`)을 그대로 쓴다. GPS 모드는 실제로
   * 걸어야 움직이는 판이라 손대지 않는다(그대로 안내 문구로만 남는다).
   */
  function approachBtn(x, y) {
    var w = global.DG.world;
    if (w && w.mode === 'keyboard') {
      return '<button class="btn ghost" data-act="approach" data-tx="' + x + '" data-ty="' + y + '">가까이 가기</button>';
    }
    return '<button class="btn ghost" disabled>가까이 가기</button>';
  }

  /** 야생 대상 카드 (등용 · 포획) */
  function nearSpawnCard(n) {
    var s = n.spawn, rar = data.rarity[s.ref.rarity];
    return '<div class="near-card">' +
        '<div class="near-ico" style="border-color:' + rar.color + '">' +
          pt(s.kind === 'hero' ? 'hero' : 'pet', s.ref, 46) + '</div>' +
        '<div class="near-meta"><b>' + esc(s.ref.name) + '</b>' +
          '<small style="color:' + rar.color + '">' + rar.name + ' ' + rar.label + ' · ' +
          (s.kind === 'hero' ? '등용 대상' : '포획 대상') + ' · ' + Math.round(n.dist) + 'm</small></div>' +
        (n.inRange
          ? '<button class="btn primary" data-act="meet">만난다</button>'
          : approachBtn(s.x, s.y)) +
      '</div>';
  }

  /** 역참 카드 — 원작에서 보급 거점이 늘 근처에 하나쯤 있는 그 자리 */
  function nearStationCard(ns) {
    var st = ns.station, stn = global.DG.station;
    /* 적도가 들어 있으면 보급 카드가 아니라 **경고 카드**다 — 여기서 갈라 두지 않으면
       "보급 있음" 이라 적힌 자리를 눌렀는데 싸움이 열린다(rogue.js) */
    var R = global.DG.rogue;
    var held = R ? R.rankAt(st) : null;
    if (held) {
      return '<div class="near-card">' +
          '<div class="near-ico" style="border-color:#c0463c">🏴</div>' +
          '<div class="near-meta"><b>' + esc(st.name) + '</b>' +
            '<small style="color:#e0837a">적도 ' + held.name + ' 점거 · ' +
            Math.round(ns.dist) + 'm</small></div>' +
          (ns.inRange
            ? '<button class="btn primary" data-act="visit">맞선다</button>'
            : approachBtn(st.x, st.y)) +
        '</div>';
    }
    var stt = stn.stateOf(st.key);
    var btn = !stt.ready
      ? '<button class="btn ghost" disabled>' + stn.leftLabel(stt.left) + '</button>'
      : (ns.inRange
          ? '<button class="btn primary" data-act="visit">들른다</button>'
          : approachBtn(st.x, st.y));
    return '<div class="near-card"' + (stt.ready ? '' : ' style="opacity:.62"') + '>' +
        '<div class="near-ico" style="border-color:' + (stt.ready ? '#e8c15a' : 'rgba(150,155,165,.5)') + '">🏮</div>' +
        '<div class="near-meta"><b>' + esc(st.name) + '</b>' +
          '<small style="color:' + (stt.ready ? '#e8c15a' : 'inherit') + '">역참 · ' +
          (stt.ready ? '보급 있음' : '쉬는 중') + ' · ' + Math.round(ns.dist) + 'm</small></div>' +
        btn +
      '</div>';
  }

  /** 봉수대 카드(PLAN §5 ①) — 이미 올린 것은 안 뜬다(더 할 게 없다) */
  function nearBeaconCard(nb) {
    var b = nb.beacon;
    return '<div class="near-card">' +
        '<div class="near-ico" style="border-color:#ff9d3d">🗼</div>' +
        '<div class="near-meta"><b>' + esc(b.name) + ' 봉수대</b>' +
          '<small style="color:#ff9d3d">' + b.region.name + ' 권역 · ' + Math.round(nb.dist) + 'm</small></div>' +
        (nb.inRange
          ? '<button class="btn primary" data-act="beacon">불을 올린다</button>'
          : approachBtn(global.DG.beacon.worldPos(b).x, global.DG.beacon.worldPos(b).y)) +
      '</div>';
  }

  /** 사당 카드(PLAN §5 ②) — 보이는 자리만 뜬다(120m 안·봉수대로 열린 반경·깬 자리) */
  function nearShrineCard(nsh) {
    var s = nsh.shrine, SH = global.DG.shrine, en = SH.entry(s);
    var tag = nsh.state.clears > 0 ? ' · ' + nsh.state.clears + '승' : '';
    var note = en.reason === 'lock' ? ' · 닫힘' : (en.reason === 'daily' ? ' · 오늘은 끝' : '');
    return '<div class="near-card">' +
        '<div class="near-ico" style="border-color:#f0d878">⛩️</div>' +
        '<div class="near-meta"><b>' + esc(s.name) + '</b>' +
          '<small style="color:#f0d878">' + s.region.name + ' 권역 · ' + Math.round(nsh.dist) + 'm' + tag + note + '</small></div>' +
        (nsh.inRange
          ? '<button class="btn primary" data-act="shrine">시련을 받는다</button>'
          : approachBtn(SH.worldPos(s).x, SH.worldPos(s).y)) +
      '</div>';
  }

  /** ⑲-9 숨은 터 입구 — 도전 중이면 안 올린다(위쪽 띠가 대신한다) */
  function nearDomainCard(nd) {
    var DM = global.DG.domain, d = nd.d, kd = DM.KINDS[d.kind];
    return '<div class="near-card">' +
        '<div class="near-ico" style="border-color:' + kd.color + '">' + kd.icon + '</div>' +
        '<div class="near-meta"><b>' + esc(d.name) + '</b>' +
          '<small style="color:' + kd.color + '">' + kd.loot + ' · ' + Math.round(nd.dist) + 'm · 🌙 ' + DM.resin() + '/' + DM.RESIN_MAX + '</small></div>' +
        (nd.inRange
          ? '<button class="btn primary" data-act="domain">숨은 터</button>'
          : approachBtn(d.x, d.y)) +
      '</div>';
  }
  var DOMAIN_NEAR = 300;     // m
  /** ⑲-10 보상 꽃 — 쓰러진 수호자 자리 */
  function nearBloomCard(nb) {
    var FB = global.DG.fieldBoss, b = nb.b, M = FB.MATS[b.mat || b.biome], DM = global.DG.domain;
    return '<div class="near-card">' +
        '<div class="near-ico" style="border-color:#ffb6e1">🌸</div>' +
        '<div class="near-meta"><b>' + esc(b.name) + ' 보상 꽃</b>' +
          '<small style="color:#ffb6e1">' + (M ? M.icon + ' ' + M.name + ' · ' : '') + Math.round(nb.dist) + 'm' + (DM ? ' · 🌙 ' + DM.resin() + '/' + FB.COST : '') + '</small></div>' +
        (nb.inRange
          ? '<button class="btn primary" data-act="bloom">받는다</button>'
          : approachBtn(b.x, b.y)) +
      '</div>';
  }

  var SHRINE_NEAR = 500;     // m — 이보다 먼 사당은 (보여도) 근접 패널에 안 올린다

  function renderNear() {
    var w = global.DG.world;
    var n = w.nearest();
    var ns = w.nearestStation();
    var BC = global.DG.beacon;
    var nb = BC ? BC.nearestUnlit() : null;
    var SHR = global.DG.shrine, nsh = SHR ? SHR.nearest(SHRINE_NEAR) : null;
    var DMN = global.DG.domain, ndm = DMN && !DMN.active() ? DMN.nearest(DOMAIN_NEAR) : null;
    var FBN = global.DG.fieldBoss, nfb = FBN ? FBN.nearest(DOMAIN_NEAR) : null;
    if (!n && !ns && !nb && !nsh && !ndm && !nfb) {
      els.near.classList.remove('show');
      nearUid = null;
      return;
    }
    /* 다시 그리는 값이 실제로 바뀌었을 때만 innerHTML 을 갈아 끼운다
       (매 프레임 갈아 끼우면 버튼을 누르는 순간 노드가 사라진다) */
    var stn = global.DG.station;
    var key = (n ? n.spawn.uid + '|' + n.inRange + '|' + Math.round(n.dist / 5) : '-') + '||' +
      (ns ? ns.station.key + '|' + ns.inRange + '|' + Math.round(ns.dist / 5) + '|' +
        Math.ceil(stn.stateOf(ns.station.key).left / 1000) + '|' +
        (global.DG.rogue && global.DG.rogue.occupied(ns.station) ? 'R' : '-') : '-') + '||' +
      (nb ? nb.beacon.key + '|' + (nb.dist <= BC.HIT_RADIUS) + '|' + Math.round(nb.dist / 5) : '-') + '||' +
      (nsh ? nsh.shrine.key + '|' + nsh.inRange + '|' + Math.round(nsh.dist / 5) + '|' + nsh.state.clears + '|' +
        SHR.entry(nsh.shrine).reason : '-') + '||' +
      (ndm ? ndm.d.id + '|' + ndm.inRange + '|' + Math.round(ndm.dist / 5) + '|' + DMN.resin() : '-') + '||' +
      (nfb ? nfb.b.rk + '|' + nfb.inRange + '|' + Math.round(nfb.dist / 5) : '-');
    var phone = isPhonePortrait();
    key += '||' + (phone ? (nearAll ? 'P+' : 'P') : 'W');
    if (key !== nearUid) {
      nearUid = key;
      var cards = [];
      if (n) { cards.push({ d: n.dist, r: n.inRange, h: nearSpawnCard(n) }); }
      if (ns) { cards.push({ d: ns.dist, r: ns.inRange, h: nearStationCard(ns) }); }
      if (nb) { cards.push({ d: nb.dist, r: nb.dist <= BC.HIT_RADIUS, h: nearBeaconCard({ beacon: nb.beacon, dist: nb.dist, inRange: nb.dist <= BC.HIT_RADIUS }) }); }
      if (nsh) { cards.push({ d: nsh.dist, r: nsh.inRange, h: nearShrineCard(nsh) }); }
      if (ndm) { cards.push({ d: ndm.dist, r: ndm.inRange, h: nearDomainCard(ndm) }); }
      if (nfb) { cards.push({ d: nfb.dist, r: nfb.inRange, h: nearBloomCard(nfb) }); }
      /* 폰 세로 — 카드가 석 장까지 쌓이면 화면 아래 ¼ 을 덮고 조이스틱과 겹쳤다(2026-09-27 실기 신고
         "세로 화면에 뜨는 게 너무 많아 게임 화면이 안 보인다"). 닿는 것 먼저·가까운 것 먼저 한 장만,
         나머지는 "+N" 칩으로 펼친다 */
      var more = '';
      if (phone && cards.length > 1) {
        cards.sort(function (a, b) { return (b.r ? 1 : 0) - (a.r ? 1 : 0) || a.d - b.d; });
        more = '<button class="near-more" data-act="near-more">' + (nearAll ? '접기 ▾' : '+' + (cards.length - 1) + ' 더 ▴') + '</button>';
        if (!nearAll) { cards = cards.slice(0, 1); }
      }
      els.near.innerHTML = more + cards.map(function (c) { return c.h; }).join('');
    }
    els.near.classList.add('show');
  }

  /* ── 사명 (원작의 필드 리서치) ────────────────────────── */

  /** 오늘의 일과(daily.js) — 목표판 "이번 세션" 줄이 여는 자리 */
  function dailySection() {
    var Dl = global.DG.daily;
    if (!Dl) { return ''; }
    var s = Dl.state(), list = Dl.list();
    var html = '<div class="sec"><h4>오늘의 일과 ' + Dl.doneCount() + '/' + list.length + ' <small class="muted">' +
      '도장 ' + s.stamps + ' / ' + Dl.STAMPS_FOR_WEEK + '</small></h4>';
    html += '<div class="card"><div class="bar blue"><i style="width:' +
      Math.round(s.stamps / Dl.STAMPS_FOR_WEEK * 100) + '%"></i></div>' +
      '<small class="muted">하나 마칠 때마다 도장을 받습니다. 일곱이면 주간 보상. 새벽 4시에 새로 뽑힙니다.</small></div>';
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      html += '<div class="card' + (t.done ? ' done' : '') + '">' +
        '<div class="stat-row"><span>' + t.def.emoji + ' <b>' + esc(t.def.name) + '</b></span>' +
          '<b>' + (t.done ? '완료' : core.fmt(t.got) + ' / ' + core.fmt(t.need)) + '</b></div>' +
        (t.done ? '' : '<div class="bar sm"><i style="width:' + t.pct + '%"></i></div>' +
          '<small class="muted">' + rewardLine(t.def.reward) + '</small>') +
      '</div>';
    }
    /* ⑲-8 마무리 보상 — 넷을 다 하면 역참에서 */
    var bs = Dl.bonusState();
    html += '<div class="card' + (bs === 'paid' ? ' done' : '') + '">' +
      '<div class="stat-row"><span>📋 <b>마무리 보상</b></span><b>' +
        (bs === 'paid' ? '받음' : (bs === 'ready' ? '역참에 들르면' : Dl.doneCount() + ' / ' + list.length)) + '</b></div>' +
      (bs === 'paid' ? '' : '<small class="muted">' + rewardLine(Dl.BONUS_REWARD).replace('채우면', '다 하고 역참에서') + '</small>') +
    '</div>';
    html += '</div>';
    return html;
  }

  function viewQuest() {
    var Q = global.DG.quest;
    var st = Q.state();
    var list = Q.list();
    var html = (global.DG.adventure ? global.DG.adventure.cardHtml() : '') + dailySection();   // ⑲-7 여정 등급 카드
    if (global.DG.achieve) { html += global.DG.achieve.cardHtml(); }                       // ⑲-25 업적 카드
    if (global.DG.dispatch) { html += global.DG.dispatch.lineHtml(); }                     // ⑲-26 탐사 파견 한 줄
    html += '<div class="sec"><h4>인장(印章) <small class="muted">' +
      st.stamps + ' / ' + Q.STAMPS_FOR_BREAK + '</small></h4><div class="card">' +
      '<div class="bar blue"><i style="width:' +
        Math.round(st.stamps / Q.STAMPS_FOR_BREAK * 100) + '%"></i></div>' +
      '<small class="muted">사명을 거두면 인장이 <b>하루 한 개</b> 찍힙니다. ' +
      '일곱이 모이면 <b>명사(名士)</b> 가 코앞에 나타납니다.' +
      (st.stampedToday ? ' <b>오늘 몫은 이미 받았습니다.</b>' : '') +
      '</small></div></div>';

    html += '<div class="sec"><h4>받은 사명 <small class="muted">' +
      list.length + ' / ' + Q.MAX + '</small></h4>';
    if (!list.length) {
      html += '<div class="card"><small class="muted">역참(🏮)에 들르면 사명을 받습니다.</small></div>';
    }
    for (var i = 0; i < list.length; i++) {
      var q = list[i];
      html += '<div class="card">' +
        '<div class="stat-row"><span>' + q.def.emoji + ' <b>' + esc(q.def.name) + '</b></span>' +
          '<b>' + core.fmt(Math.min(q.got, q.need)) + ' / ' + core.fmt(q.need) + '</b></div>' +
        '<div class="bar sm"><i style="width:' + q.pct + '%"></i></div>' +
        (q.done
          ? '<button class="btn primary wide" data-act="quest-claim" data-i="' + q.i + '">거둔다</button>'
          : '<small class="muted">' + rewardLine(q.def.reward) + '</small>') +
      '</div>';
    }
    html += '</div>';
    html += '<div class="sec"><h4>지금까지</h4><div class="card">' +
      '<div class="stat-row"><span>거둔 사명</span><b>' + (st.done || 0) + '</b></div>' +
      '<div class="stat-row"><span>명사가 찾아온 횟수</span><b>' + (st.breaks || 0) + '</b></div>' +
      '</div></div>';
    html += milestoneSection();
    return html;
  }

  /** 주간 걷기 이정표 — 이번 주 누적 거리 사다리 (축1 다음 후보) */
  function milestoneSection() {
    var M = global.DG.milestone;
    if (!M) { return ''; }
    var walked = M.weekWalked(), rungs = M.rungs();
    var html = '<div class="sec"><h4>이번 주 걸음 <small class="muted">' +
      core.fmt(Math.round(walked)) + 'm</small></h4>';
    for (var i = 0; i < rungs.length; i++) {
      var r = rungs[i];
      html += '<div class="card">' +
        '<div class="stat-row"><span>🚩 ' + core.fmt(r.m) + 'm</span>' +
        '<b>' + (r.got ? '받음' : (r.reach ? '달성!' : r.pct + '%')) + '</b></div>' +
        '<div class="bar sm"><i style="width:' + r.pct + '%"></i></div>' +
        (r.got ? '' : '<small class="muted">' + rewardLine(r.reward) + '</small>') +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  /** 보상 한 줄 */
  function rewardLine(r) {
    var B = global.DG.bag, out = [];
    if (r.gold) { out.push('🪙 ' + r.gold); }
    if (r.exp) { out.push('경험치 ' + r.exp); }
    ['scroll', 'feed', 'treat', 'incense', 'prayer'].forEach(function (k) {
      if (r[k]) { out.push(ico('consumable', k, 18, B.def(k).emoji) + ' ' + r[k]); }
    });
    if (r.party) { out.push('부대 경험 ' + r.party); }        // ⑲-8
    if (r.ore) { out.push('🪨 강화석 ' + r.ore); }
    if (r.note) { out.push('📃 무예 쪽지 ' + r.note); }
    if (r.knot) { out.push('🪢 인연 매듭 ' + r.knot); }
    return '채우면 ' + out.join(' · ');
  }

  /* ── 행낭 (원작의 가방) ───────────────────────────────── */

  function viewBag() {
    var B = global.DG.bag;
    var list = B.list();
    var html = '<div class="sec"><h4>행낭 <small class="muted">' +
      B.total() + ' / ' + B.CAP + '</small></h4><div class="card">' +
      '<div class="bar blue"><i style="width:' +
        Math.round(B.total() / B.CAP * 100) + '%"></i></div>' +
      '<small class="muted">가득 차면 역참이 더 주지 않습니다 — 쓰거나 비워야 합니다.</small>' +
      '</div></div>';

    var live = B.activeBoosts();
    if (live.length) {
      html += '<div class="sec"><h4>지금 걸린 것</h4>';
      for (var k = 0; k < live.length; k++) {
        html += '<div class="card"><div class="stat-row">' +
          '<span>' + live[k].def.emoji + ' ' + esc(live[k].def.name) + '</span>' +
          '<b>' + B.leftLabel(live[k].leftMs) + ' 남음</b></div></div>';
      }
      html += '</div>';
    }

    html += '<div class="sec"><h4>담긴 것</h4>';
    for (var i = 0; i < list.length; i++) {
      var e = list[i], d = e.def;
      var canUse = d.kind === 'use' && e.n > 0;
      html += '<div class="card">' +
        '<div class="stat-row"><span>' + ico('consumable', d.key, 24, d.emoji) + ' <b>' + esc(d.name) + '</b></span>' +
          '<b>' + core.fmt(e.n) + '</b></div>' +
        '<small class="muted">' + esc(d.desc) + '</small>' +
        (d.kind === 'use'
          ? '<button class="btn tiny wide' + (canUse ? ' primary' : '') + '"' +
              (canUse ? '' : ' disabled') + ' data-act="bag-use" data-id="' + d.key + '">' +
              (e.boost ? '더 쓴다 (' + B.leftLabel(e.boost.leftMs) + ' 남음)' : '쓴다') +
            '</button>'
          : '') +
      '</div>';
    }
    return html + '</div>';
  }

  /* ── 천거장 (원작의 알) ───────────────────────────────── */

  /** 남은 거리를 사람이 읽는 단위로 */
  function distLabel(m) {
    return m >= 1000 ? (m / 1000).toFixed(1) + 'km' : Math.round(m) + 'm';
  }

  function viewLetters() {
    var L = global.DG.letter;
    var st = L.state();
    var out = '<div class="sec"><h4>행낭 <small class="muted">— 여기 넣은 것만 거리를 셉니다</small></h4>';

    for (var i = 0; i < L.SLOTS; i++) {
      var pr = L.progress(st.slots[i]);
      if (!pr) {
        out += '<div class="card" style="opacity:.6">' +
          '<div class="stat-row"><span>빈 칸</span><span class="muted">아래에서 넣습니다</span></div></div>';
        continue;
      }
      out += '<div class="card">' +
        '<div class="stat-row"><span>' + pr.grade.emoji + ' ' + esc(pr.grade.name) + '</span>' +
          '<b>' + pr.pct + '%</b></div>' +
        '<div class="bar blue"><i style="width:' + pr.pct + '%"></i></div>' +
        '<div class="stat-row"><span class="muted">' +
          distLabel(pr.walked) + ' / ' + distLabel(pr.need) + '</span>' +
          '<span class="muted">' + (pr.done ? '곧 열립니다' : distLabel(pr.left) + ' 남음') + '</span></div>' +
      '</div>';
    }
    out += '</div>';

    var full = st.slots.indexOf(null) < 0;
    out += '<div class="sec"><h4>받아 둔 천거장 <small class="muted">' +
      st.bag.length + ' / ' + L.BAG_MAX + '</small></h4>';
    if (!st.bag.length) {
      out += '<div class="card"><small class="muted">역참(🏮)에 들르면 이따금 받습니다.</small></div>';
    } else {
      out += '<div class="plist">';
      for (var k = 0; k < st.bag.length; k++) {
        var g = L.gradeOf(st.bag[k]);
        out += '<div class="pcard">' +
          '<div class="stat-row"><span style="color:' + g.color + '">' + g.emoji + ' ' +
            esc(g.name) + '</span>' +
            (full
              ? '<span class="muted">행낭이 찼습니다</span>'
              : '<button class="btn tiny primary" data-act="letter-put" data-i="' + k + '">행낭에 넣기</button>') +
          '</div>' +
          '<small class="muted">' + esc(g.desc) + '</small>' +
        '</div>';
      }
      out += '</div>';
    }
    out += '</div>';

    out += '<div class="sec"><h4>여는 법</h4><div class="card"><small class="muted">' +
      '행낭에 넣은 뒤 <b>걸은 거리</b>가 적힌 만큼 쌓이면 봉이 떨어지고 그 사람이 찾아옵니다.<br>' +
      '받아만 둔 천거장은 걸어도 줄지 않습니다 — 원작의 알과 같습니다.<br>' +
      '먼 천거장일수록 높은 등급의 인물이 옵니다. 지금까지 연 것 <b>' + st.opened + '</b>통.' +
      '</small></div></div>';
    return out;
  }

  /* ── 도감 ─────────────────────────────────────────────── */

  /** 도감 맨 위 — 지금 곁을 걷는 반려 (원작의 버디 칸) */
  function buddyStrip() {
    var B = buddy();
    if (!B) { return ''; }
    var cur = B.current();
    if (!cur) {
      return '<div class="sec"><h4>🐾 반려</h4>' +
        '<div class="hint">펫 카드를 열어 <b>반려로 세우면</b> 함께 걷는 것만으로 그 종의 ' +
        '<b>영초</b>가 나옵니다. 오래 함께할수록 사이가 깊어져 장착 보정도 커집니다.</div></div>';
    }
    return '<div class="sec"><h4>🐾 반려</h4>' +
      '<div class="near-card">' +
        '<div class="near-ico">' + pt('pet', cur.pet, 40) + '</div>' +
        '<div class="near-meta"><b>' + esc(cur.pet.name) + ' ' + cur.bond.def.mark + '</b>' +
          '<small>' + cur.bond.def.name + ' · 함께 ' + core.fmt(cur.log.walked) + 'm · ' +
          '다음 🌿' + cur.herbNext + ' 까지 ' + core.fmt(cur.left) + 'm</small></div>' +
        '<button class="btn" data-act="buddy-feed"' +
          (global.DG.bag.count('feed') < 1 ? ' disabled' : '') + '>🍖</button>' +
      '</div>' +
      '<div class="bar sm" style="margin-top:8px"><i style="width:' + (cur.pct * 100) + '%"></i></div></div>';
  }

  /**
   * 도감 맨 위 — 아직 정화하지 않은 암영(rogue.js).
   * **도감 안에 둔다.** 암영은 "도감에 들기 직전의 것"이라 다른 데 두면
   * 정화할 자리를 못 찾는다(탈환 화면에서 '나중에' 를 누르면 그길로 잊힌다).
   */
  function darkStrip() {
    var R = global.DG.rogue;
    if (!R) { return ''; }
    var list = R.darkList();
    if (!list.length) { return ''; }
    var have = growth() ? growth().dust() : 0;
    var rows = list.map(function (d) {
      var can = have >= d.cost.dust;
      return '<div class="near-card">' +
        '<div class="near-ico dark">' + pt('pet', d.pet, 40) + '</div>' +
        '<div class="near-meta"><b>' + esc(d.pet.name) +
          (d.n > 1 ? ' ×' + d.n : '') + '</b>' +
          '<small>정화하면 도감에 듭니다 · ✨ ' + d.cost.dust + '</small></div>' +
        '<button class="btn' + (can ? ' primary' : '') + '" data-act="purify" data-id="' +
          d.pet.id + '"' + (can ? '' : ' disabled') + '>🌕</button>' +
      '</div>';
    }).join('');
    return '<div class="sec"><h4>🌑 암영(暗影) ' + R.darkCount() + '</h4>' + rows +
      '<div class="hint">적도가 두고 간 것들입니다. <b>단사로 정화</b>해야 도감에 들고, ' +
      '정화하면 그 종의 영초를 얹어 줍니다. 지금 단사 ✨ ' + core.fmt(have) + '</div></div>';
  }

  function viewDex() {
    var hC = data.heroes.filter(function (e) { return core.save.dex.heroes[e.id]; }).length;   // ⑲-15 이야기 동료는 세지 않는다
    var pC = Object.keys(core.save.dex.pets).length;
    var ST = global.DG.story, mem = ST && ST.MEMBERS ? Object.keys(ST.MEMBERS).map(function (k) { return ST.MEMBERS[k]; })
      .filter(function (e) { return core.save.dex.heroes[e.id]; }) : [];
    return darkStrip() + buddyStrip() + rosterStrip() +
           '<div class="sec"><h4>인물</h4>' + dexBar(hC, data.heroes.length) +
             dexGrid(data.heroes, core.save.dex.heroes) + '</div>' +
           (mem.length ? '<div class="sec"><h4>📖 이야기 동료</h4>' + dexGrid(mem, core.save.dex.heroes) + '</div>' : '') +
           '<div class="sec"><h4>펫</h4>' + dexBar(pC, data.pets.length) +
             dexGrid(data.pets, core.save.dex.pets) + '</div>' +
           '<div class="hint">카드를 누르면 열전·승급·펫 장착 화면이 열립니다. ' +
           '같은 인물을 또 등용하면 <b>중복(+n)</b>이 쌓여 승급 재료가 됩니다.</div>';
  }

  /** ⑲-15 들판 명단 한 줄 — 1~4 ⚔ · 5 대기. 누르면 그 인물 상세 */
  function rosterStrip() {
    var FM = global.DG.formation, P = core.save.party || [], out = '', i;
    if (!FM) { return ''; }
    for (i = 0; i < FM.MAX; i++) {
      var h = P[i] ? data.find(P[i]) : null;
      out += h ? '<button class="btn sm' + (i < FM.FIELD ? ' primary' : ' ghost') + '" data-act="detail" data-kind="hero" data-id="' + h.id + '">' +
          (i + 1) + ' ' + esc(h.name) + '</button>'
        : '<button class="btn sm ghost" disabled>' + (i + 1) + ' (빈자리)</button>';
      if (i === FM.FIELD - 1) { out += '<small class="muted">· 대기</small>'; }
    }
    return '<div class="sec"><h4>⚔ 들판 명단</h4>' + presetStrip(FM) + '<div class="roster">' + out + '</div>' +
      '<small class="muted">앞 넷이 들판 전투 명단(숫자 1~4)입니다. 인물을 눌러 자리를 바꿉니다.</small></div>';
  }
  /** ⑲-18 편성 1~4 단추 줄 — 지금 칸 강조, 누르면 그 칸 명단으로(싸우는 중엔 막힘) */
  function presetStrip(FM) {
    if (!FM.use) { return ''; }
    var at = FM.presetAt(), out = '';
    for (var i = 0; i < FM.PRESETS; i++) {
      out += '<button class="btn sm' + (i === at ? ' primary' : ' ghost') + '" data-act="fm-preset" data-i="' + i + '">편성 ' + (i + 1) +
        ' (' + FM.presetOf(i).length + '명)</button>';
    }
    return '<div class="roster fm-presets">' + out + '</div>';
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
    var out = viewCodex();
    if (!log.length) { return out + '<div class="hint">아직 기록이 없습니다.</div>'; }
    out += '<div class="loglist">';
    for (var i = 0; i < log.length; i++) {
      var t = new Date(log[i].t);
      var hh = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
      out += '<div class="lrow ' + log[i].kind + '"><span>' + hh + '</span>' + esc(log[i].text) + '</div>';
    }
    return out + '</div>';
  }

  /**
   * 발견 — 무엇을 보았는지(`codex.js`). 기록 시트 **맨 위**에 붙인다.
   * 새 시트를 만들지 않은 까닭: 기록과 발견은 "지나온 것" 이라는 한 갈래고,
   * 아래 독(dock)에 칸을 더 늘리면 좁은 화면에서 글자가 뭉갠다.
   */
  function viewCodex() {
    var CX = global.DG.codex;
    if (!CX || !CX.on()) { return ''; }
    var r = CX.rate();
    var ts = CX.all();
    var out = '<div class="sec"><h4>발견 <small class="muted">' +
      r.seen + ' / ' + r.total + ' · ' + r.pct + '%</small></h4>' +
      '<div class="bar blue"><i style="width:' + r.pct + '%"></i></div>' +
      '<div class="cx-grid">';
    for (var i = 0; i < ts.length; i++) {
      var t = ts[i];
      if (!t.total) { continue; }
      out += '<div class="cx-cell' + (t.seen === t.total ? ' full' : '') +
        '" title="' + esc(t.rows.filter(function (x) { return x.seen; })
          .map(function (x) { return x.name; }).join(' · ') || '아직 없음') + '">' +
        '<b>' + t.emoji + '</b><span>' + t.name + '</span>' +
        '<small>' + t.seen + '/' + t.total + '</small></div>';
    }
    out += '<div class="cx-cell' + (r.dex.seen === r.dex.total ? ' full' : '') + '">' +
      '<b>📕</b><span>도감</span><small>' + r.dex.seen + '/' + r.dex.total + '</small></div>';
    out += '</div>';
    /* 아직 못 본 것 중 **숨은 곳**만 귀띔한다 — 다 알려 주면 찾을 것이 없다 */
    var hidden = [];
    for (i = 0; i < ts.length; i++) {
      if (ts[i].key !== 'place') { continue; }
      hidden = ts[i].rows.filter(function (x) { return !x.seen && x.hint === '숨은 곳'; });
    }
    if (hidden.length) {
      out += '<small class="muted">아직 못 찾은 숨은 곳이 ' + hidden.length + '군데 있습니다.</small>';
    }
    return out + '</div>';
  }

  /* ── 사관 (온라인 모드) ───────────────────────────────── */

  var aiBusy = null;          // 부르는 중 표시

  function viewOracle() {
    var N = net(), A = ai();
    var st = N.status();
    var a = A.state();
    var html = sectionAuto();

    /* 모드 */
    html += '<div class="sec"><h4>모드</h4><div class="card">' +
      '<div class="modeswitch">' +
        '<button class="btn ' + (st.mode === 'offline' ? 'primary' : 'ghost') + '" data-act="mode-off">' +
          '📴 오프라인</button>' +
        '<button class="btn ' + (st.mode === 'online' ? 'primary' : 'ghost') + '" data-act="mode-on">' +
          '🔮 온라인</button>' +
      '</div>' +
      '<small class="muted">오프라인은 이 기기 안에서만 돌아갑니다 — 세이브도 계산도 전부 로컬입니다.<br>' +
      '온라인은 거기에 <b>사관(AI)</b> 만 더합니다. 서버가 꺼져 있어도 게임은 그대로 돌아갑니다.</small>';

    if (st.mode === 'online') {
      html += '<div class="netrow' + (st.ok ? ' ok' : ' bad') + '">' +
        (st.ok ? '🟢 서버 연결됨 · ' + esc(st.model || '') : '🔴 서버에 닿지 못했습니다') +
        '<button class="btn tiny ghost" data-act="ai-base">주소 바꾸기</button></div>' +
        '<small class="muted">주소: ' + esc(st.base) + '</small>';
    }
    html += '</div></div>';

    if (st.mode !== 'online') {
      html += '<div class="hint">사관을 부르려면 온라인 모드로 바꾸세요. ' +
        '서버 실행은 <b>run-online.bat</b> (또는 <code>node server/dg-server.mjs</code>) 입니다.</div>';
      return html + sectionAiLog(a);
    }

    /* 천기 잔량 */
    if (st.ok) {
      var pct = st.cap ? core.clamp((st.cap - st.used) / st.cap, 0, 1) * 100 : 0;
      html += '<div class="sec"><h4>천기(天機) <small class="muted">= 남은 AI 예산</small></h4><div class="card">' +
        '<div class="bar' + (pct < 20 ? '' : ' blue') + '"><i style="width:' + pct + '%"></i></div>' +
        '<div class="stat-row"><span>오늘 남은 몫</span><b>$' + (st.cap - st.used).toFixed(4) +
          ' / $' + Number(st.cap).toFixed(2) + '</b></div>' +
        '<div class="stat-row"><span>오늘 부른 횟수</span><span class="muted">' + st.calls + '회</span></div>' +
        '<div class="stat-row"><span>누적(이 세이브)</span><span class="muted">' +
          a.calls + '회 · $' + (a.spent || 0).toFixed(4) + '</span></div>' +
        '<small class="muted">부를 때마다 실제 토큰 사용량만큼 깎입니다. ' +
        '한도는 서버가 잡습니다(클라이언트 숫자는 표시용).</small></div></div>';

      var left = A.buffLeft();
      if (left > 0) {
        html += '<div class="hint goodbox">🔮 길조 — <b>' + esc(a.buff.label) + '</b> · ' +
          core.fmtTime(left) + ' 남음</div>';
      }
    }

    /* 기능 */
    html += '<div class="sec"><h4>부를 수 있는 것</h4>';
    if (aiBusy) {
      html += '<div class="hint">⏳ ' + esc(aiBusy) + '</div>';
    }
    html += '<div class="acts">' +
      '<button class="btn wide" data-act="ai-advise">⚖️ 군략 — 다음에 할 일 셋</button>' +
      '<button class="btn wide" data-act="ai-omen">🔮 천기 — 앞길을 점친다 (길조면 보정)</button>' +
      '</div>';

    /* 대화 */
    var ids = Object.keys(core.save.dex.heroes);
    if (ids.length) {
      ids.sort(function (x, y) {
        var A2 = data.find(x), B2 = data.find(y);
        return (B2 ? B2.rarity : 0) - (A2 ? A2.rarity : 0);
      });
      var opt = '';
      for (var i = 0; i < ids.length; i++) {
        var h = data.find(ids[i]);
        if (!h) { continue; }
        opt += '<option value="' + h.id + '">' + esc(h.name) + '</option>';
      }
      html += '<div class="talkbox">' +
        '<div class="row"><span>💬</span><select data-talk-hero>' + opt + '</select></div>' +
        '<input type="text" data-talk-say maxlength="60" placeholder="무엇을 물어보시겠습니까?">' +
        '<button class="btn wide" data-act="ai-talk">말을 건다</button>' +
        '</div>';
    }
    html += '</div>';

    return html + sectionAiLog(a);
  }

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
      '<small class="muted">걷기·조우·문답·던전의 규칙은 <b>손으로 할 때와 같습니다</b> — ' +
      '자동은 무엇을 목표로 삼을지만 고릅니다.<br>' +
      '<b>새 문답은 대신 풀지 않습니다</b> (익힌 문제 복습만). ' +
      '실제 위치(📡)로는 대신 걸을 수 없어 자동을 켜면 지도 이동으로 바뀝니다.<br>' +
      '창을 보고 있는 동안에만 돕니다 — 덮어 두면 멈춥니다.</small>' +
      '</div></div>';
    return html;
  }

  function sectionAiLog(a) {
    if (!a.log || !a.log.length) { return ''; }
    var KIND = { advise: '⚖️ 군략', talk: '💬 대화', omen: '🔮 천기' };
    var out = '<div class="sec"><h4>사관의 말 ' + a.log.length + '건</h4><div class="ailog">';
    for (var i = 0; i < Math.min(a.log.length, 12); i++) {
      var e = a.log[i];
      var t = new Date(e.t);
      var hh = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
      out += '<div class="airow"><div class="ai-top">' +
        '<b>' + (KIND[e.kind] || e.kind) + '</b>' +
        '<small>' + hh + ' · ' + e.inTok + '/' + e.outTok + ' 토큰 · $' +
          (e.cost || 0).toFixed(4) + '</small></div>' +
        '<div class="ai-text">' + esc(e.text).replace(/\n/g, '<br>') + '</div></div>';
    }
    return out + '</div></div>';
  }

