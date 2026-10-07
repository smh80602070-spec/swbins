/**
 * UI — 프로필 / 재화 / 근처 대상 / 시트(서당·도감·사관·기록) / 상세 / 토스트
 * ---------------------------------------------------------------
 * 사가만리 본편(원작 형태) 화면. 던전·전투·장비 UI 는 js/_expansion/ 으로 뺐고,
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
    var w = global.DG.world, cands = [], tl = global.DG.tut ? global.DG.tut.line() : ''; if (tl) { return tl; }   // 첫 10분 안내가 남았으면 그 단계가 첫 줄(tutorial.js) var tk = global.DG.track ? global.DG.track.goalText(core.save.player.pos) : ''; if (tk) { return esc(tk); }   // ㉑ 사냥 의뢰 — 큰 짐승을 쫓는 중이거나 흔적이 10m 안
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

  /* ── 인물 · 펫 상세 ───────────────────────────────────────
   * 도감 카드에서 열린다. 능력치는 hero.breakdown() 이 계산해 준 값만 보여준다.
   */

  /** 연성·승화 모듈 (이 판에만 있는 축이라 없을 수도 있다고 보고 쓴다) */
  function growth() { return global.DG.growth || null; }

  /** 반려 모듈 — 위와 같은 이유로 있으면 쓴다 */
  function buddy() { return global.DG.buddy || null; }

  function detailHost() {
    var el = $('detail');
    if (!el) {                       // 자가진단 페이지처럼 뼈대가 없는 곳에서도 동작하게
      el = document.createElement('div');
      el.id = 'detail';
      document.body.appendChild(el);
      els.detail = el;
    }
    return el;
  }

  function openDetail(kind, id) {
    if (!id) { return; }
    openDetailRef = { kind: kind, id: id };
    renderDetail();
    detailHost().classList.add('show');
  }

  function closeDetail() {
    openDetailRef = null;
    var el = detailHost();
    el.classList.remove('show');
    el.innerHTML = '';
  }

  function rankStars(rank) {
    if (!rank) { return ''; }
    var out = ' ';
    for (var i = 0; i < rank; i++) { out += '✦'; }
    return out;
  }

  function statRow(label, base, grown, fin, cap) {
    var pct = core.clamp(fin / cap, 0, 1) * 100;
    var extra = fin - base;
    return '<div class="st">' +
      '<span class="st-l">' + label + '</span>' +
      '<span class="stbar"><i style="width:' + pct + '%"></i>' +
        (grown > base ? '<u style="width:' + (core.clamp(base / cap, 0, 1) * 100) + '%"></u>' : '') +
      '</span>' +
      '<b class="st-v">' + fin + (extra > 0 ? '<em>+' + extra + '</em>' : '') + '</b>' +
    '</div>';
  }

  /** 승급 특성(PLAN §5 ⑦) — 고르지 않은 카드 셋이 있으면 그것을, 아니면 가진 특성을 보인다 */
  function perkBlock(id) {
    var PK = global.DG.perk;
    if (!PK) { return ''; }
    var own = PK.perksOf(id), pend = PK.pending(id), out = '<div class="dt-perks">';
    function axisMark(d) {
      for (var i = 0; i < PK.AXES.length; i++) { if (PK.AXES[i].key === d.axis) { return PK.AXES[i].mark; } }
      return '';
    }
    if (pend) {
      out += '<div class="dt-line"><span>🎴 특성 카드 — 하나를 고른다</span><b>' + own.length + '/' + PK.MAX_PERKS + '</b></div>';
      for (var i = 0; i < pend.length; i++) {
        var d = PK.def(pend[i]);
        out += '<button class="btn wide" data-act="perk-pick" data-id="' + id + '" data-perk="' + d.id + '">' +
          d.emoji + ' <b>' + esc(d.name) + '</b> <small>' + axisMark(d) + ' · ' + esc(d.desc) + '</small></button>';
      }
      out += '<button class="btn ghost wide" data-act="perk-skip" data-id="' + id + '">카드를 물린다 (丹 +' + PK.DECLINE_DAN + ')</button>';
    } else {
      out += '<div class="dt-line"><span>🎴 특성</span><b>' + own.length + '/' + PK.MAX_PERKS + '</b></div>';
      if (own.length) {
        out += '<div class="dt-tags">';
        for (var j = 0; j < own.length; j++) {
          var od = PK.def(own[j]);
          out += '<span class="tag" title="' + esc(od.desc) + '">' + od.emoji + ' ' + esc(od.name) + ' · ' + esc(od.desc) + '</span>';
        }
        out += '</div>';
      } else {
        out += '<small class="muted">승급할 때마다 특성 카드 셋(攻·守·補) 중 하나를 고릅니다.</small>';
      }
    }
    return out + '</div>';
  }

  /** 무기(PLAN §5 ⑲-5) — 종류는 인물마다 정해져 있다, 들판 전투에만 탄다 */
  function weaponBlock(id) {
    var WP = global.DG.weapon;
    if (!WP) { return ''; }
    var wid = WP.equipped(id), w = WP.info(wid), r = WP.rec(wid) || { lv: 1, asc: 0, ref: 1 }, t = WP.typeOf(id), i;
    var out = '<div class="dt-weapon"><div class="dt-line"><span>' + WP.TYPE_ICON[t] + ' 무기 · ' + WP.TYPE_NAMES[t] +
      '</span><b>🪨 ' + WP.ore() + '</b></div>';
    var ch = WP.choicesFor(id), opts = '';
    for (i = 0; i < ch.length; i++) {
      var ci = WP.info(ch[i]), cr = WP.rec(ch[i]), who = WP.holderOf(ch[i]);
      var whoName = who && who !== id ? ' (' + ((data.find(who) || {}).name || who) + ' 사용 중)' : '';
      opts += '<option value="' + ch[i] + '"' + (ch[i] === wid ? ' selected' : '') + '>★' + ci.rarity + ' ' + esc(ci.name) +
        (WP.isShared(ch[i]) ? '' : ' Lv.' + cr.lv) + whoName + '</option>';
    }
    out += '<select data-wp-equip="' + id + '">' + opts + '</select>';
    var line = '공격 ' + Math.round(WP.atkAt(wid, r.lv, r.asc));
    if (w.sub) { line += ' · ' + WP.STAT_NAMES[w.sub] + ' +' + (WP.subAt(wid, r.lv) * 100).toFixed(1) + '%'; }
    if (w.pas) { line += ' · ' + WP.PASSIVE_NAMES[w.pas] + ' +' + Math.round(WP.passiveAt(wid, r.ref) * 100) + '%'; }
    if (!WP.isShared(wid)) { line += ' · Lv.' + r.lv + '/' + WP.cap(r.asc) + ' · 벼림 ' + r.asc + ' · 울림 ' + r.ref; }
    out += '<small class="muted" style="display:block">' + line + '</small>';
    if (!WP.isShared(wid)) {
      var uc = WP.upCheck(wid), ac = WP.ascCheck(wid), c = WP.upCost(r.lv), a = WP.ascCost(r.asc);
      if (r.lv < WP.MAX_LV && r.lv < WP.cap(r.asc)) {
        out += '<button class="btn ' + (uc.ok ? 'primary' : 'ghost') + ' wide"' + (uc.ok ? '' : ' disabled') + ' data-act="wp-up" data-id="' + id + '" data-wid="' + wid + '">' +
          '🔨 강화 Lv.' + (r.lv + 1) + ' · 🪨 ' + WP.ore() + '/' + c.ore + ' · 🪙 ' + core.fmt(c.gold) + '</button>';
      } else if (a) {
        out += '<button class="btn ' + (ac.ok ? 'primary' : 'ghost') + ' wide"' + (ac.ok ? '' : ' disabled') + ' data-act="wp-asc" data-id="' + id + '" data-wid="' + wid + '">' +
          '✨ 무기 벼림 ' + (r.asc + 1) + ' · 🪙 ' + core.fmt(a.gold) + ' · 丹 ' + a.dust + '</button>';
      }
    } else {
      out += '<small class="muted" style="display:block">옻칠·금박 보물 상자에서 ' + WP.TYPE_NAMES[t] + ' ★3·★4 가 나옵니다.</small>';
    }
    return out + '</div>';
  }

  /** 보패(PLAN §5 ⑲-5) — 부위 다섯·켜진 세트 */
  function artifactBlock(id) {
    var AR = global.DG.artifact;
    if (!AR) { return ''; }
    var eq = AR.equippedOf(id), L = AR.list(), all = Object.keys(L), i, j, k;
    var out = '<div class="dt-artifact"><div class="dt-line"><span>🏺 보패 (' + all.length + '/' + AR.CAP + ')</span><b>💎 ' + AR.polish() + '</b></div>';
    for (i = 0; i < AR.SLOTS.length; i++) {
      var slot = AR.SLOTS[i], cur = eq[slot], opts = '<option value="">' + AR.SLOT_ICON[slot] + ' ' + AR.SLOT_NAMES[slot] + ' — 비움</option>';
      var mine = all.filter(function (u) { return L[u].slot === slot; })
        .sort(function (x, y) { return (L[y].rarity - L[x].rarity) || (L[y].lv - L[x].lv); }).slice(0, 40);
      if (cur && mine.indexOf(cur) < 0) { mine.unshift(cur); }
      for (j = 0; j < mine.length; j++) {
        var a = L[mine[j]], own = a.owner && a.owner !== id ? ' (' + ((data.find(a.owner) || {}).name || a.owner) + ')' : '';
        opts += '<option value="' + mine[j] + '"' + (mine[j] === cur ? ' selected' : '') + '>★' + a.rarity + ' +' + a.lv + ' ' +
          esc(AR.SETS[a.set].name) + ' · ' + esc(AR.statText(a.main, AR.mainValue(a))) + own + '</option>';
      }
      out += '<select data-art-equip="' + id + '" data-slot="' + slot + '">' + opts + '</select>';
      if (cur) {
        var ca = L[cur], subs = ca.subs.map(function (s) { return AR.statText(s[0], s[1]); }).join(' · ');
        var uc = AR.upCheck(cur), c = AR.upCost(ca.lv);
        out += '<small class="muted" style="display:block">' + esc(subs) + '</small>';
        if (ca.lv < AR.MAX_LV[ca.rarity]) {
          out += '<button class="btn ' + (uc.ok ? 'primary' : 'ghost') + ' wide"' + (uc.ok ? '' : ' disabled') + ' data-act="art-up" data-id="' + id + '" data-uid="' + cur + '">' +
            '💎 ' + AR.SLOT_NAMES[slot] + ' +' + (ca.lv + 1) + ' · 💎 ' + AR.polish() + '/' + c.polish + ' · 🪙 ' + c.gold + '</button>';
        }
      }
    }
    var st = AR.statsOf(id);
    for (k = 0; k < st.sets.length; k++) {
      var S = AR.SETS[st.sets[k].id];
      out += '<small style="display:block">' + ico('artifact', AR.SET_IDS.indexOf(st.sets[k].id), 18, '') + '◆ ' + esc(S.name) + ' ' + st.sets[k].n + '세트 — ' + esc(S.text2) + (st.sets[k].n >= 4 ? ' · ' + esc(S.text4) : '') + '</small>';
    }
    if (all.some(function (u) { return L[u].rarity === 4 && !L[u].owner; })) {
      out += '<button class="btn ghost wide" data-act="art-salvage4" data-id="' + id + '">🏺 안 낀 ★4 모두 분해 → 연마석</button>';
    }
    return out + '</div>';
  }

  /** ⑲-11 고유·갈래 스킬 — [갈래] 스킬 이름·설명 두 줄(지략은 원소 기본이라 갈래 이름만) */
  function kitLines(id) {
    var FC = global.DG.fieldCombat, KT = global.DG.kits;
    if (!FC || !KT || !FC.kitFor) { return ''; }
    var el = FC.elementOf(id), k = FC.kitFor(id), E = FC.EL[el], lb = KT.labelOf(id, el);
    if (!k) { return lb ? '<small class="muted" style="display:block">[' + lb + '] ' + E.icon + ' 원소 스킬·해방 — 원소 기본(모양은 인물마다)</small>' : ''; }
    return '<small style="display:block">[' + k.label + '] 🌀 <b>' + esc(k.skill.name) + '</b> — ' + esc(k.skill.text) + '</small>' +
      '<small style="display:block">[' + k.label + '] 💥 <b>' + esc(k.burst.name) + '</b> — ' + esc(k.burst.text) + '</small>';
  }
  /** 무예 단계·깨달음(PLAN §5 ⑲-4) — 들판 전투 피해에만 탄다 */
  function talentBlock(id) {
    var TL = global.DG.talent;
    if (!TL) { return ''; }
    var rank = hero().info(id).rank || 0, cap = TL.cap(rank), i, k, out = '<div class="dt-talent">';
    var mt = [];
    for (k in TL.MATS) {
      if (Object.prototype.hasOwnProperty.call(TL.MATS, k)) { mt.push(TL.MATS[k].icon + ' ' + TL.count(k)); }
    }
    out += '<div class="dt-line"><span>⚔️ 무예 (상한 ' + cap + ' · 승급 ★' + rank + ')</span><b>' + mt.join(' ') + '</b></div>';
    out += kitLines(id);                                               // ⑲-11 고유·갈래 스킬 이름·설명
    for (i = 0; i < TL.KINDS.length; i++) {
      var K = TL.KINDS[i], lv = TL.baseLevel(id, K.key), eff = TL.level(id, K.key);
      var chk = TL.upCheck(id, K.key), c = TL.cost(lv), label;
      var head = K.icon + ' ' + K.name + ' <b>' + eff + '</b>' + (eff > lv ? '<small>(+' + (eff - lv) + ')</small>' : '') +
        ' <small>×' + TL.mulAt(eff) + '</small>';
      if (lv >= TL.MAX) { label = head + ' <small>· 최대</small>'; }
      else if (lv >= cap) { label = head + ' <small>· 승급 ★' + TL.nextRankFor(lv + 1) + ' 에 열림</small>'; }
      else {
        label = head + ' <small>· 🪙 ' + core.fmt(c.gold) + ' · ' + TL.MATS[c.book].icon + ' ' + TL.count(c.book) + '/' + c.books +
          ' · 丹 ' + c.dust + (c.scale ? ' · ' + TL.MATS.scale.icon + ' ' + TL.count('scale') + '/' + c.scale : '') + '</small>';
      }
      out += '<button class="btn ' + (chk.ok ? 'primary' : 'ghost') + ' wide"' + (chk.ok ? '' : ' disabled') +
        ' data-act="talent-up" data-id="' + id + '" data-key="' + K.key + '">' + label + '</button>';
    }
    var con = TL.con(id), dots = '';
    for (i = 0; i < TL.CON_MAX; i++) { dots += i < con ? '●' : '○'; }
    out += '<div class="dt-line"><span>🌟 깨달음 ' + dots + '</span><b>' + con + '/' + TL.CON_MAX + '</b></div>';
    for (i = 0; i < TL.CON_MAX; i++) {
      out += '<small class="' + (i < con ? '' : 'muted') + '" style="display:block">' + (i < con ? '◆' : '◇') + ' ' + (i + 1) + '. ' + esc(TL.CON_TEXT[i]) + '</small>';
    }
    if (con < TL.CON_MAX) {
      var ok = TL.conCheck(id).ok;
      out += '<button class="btn ' + (ok ? 'primary' : 'ghost') + ' wide"' + (ok ? '' : ' disabled') + ' data-act="talent-con" data-id="' + id + '">' +
        '🌟 ' + (con + 1) + '번째 깨달음 열기 · ' + TL.MATS.knot.icon + ' ' + TL.count('knot') + '/1</button>';
    }
    return out + '</div>';
  }

  /** 인연(PLAN §5 ⑥) — 등급·다음까지·결이 맞는 동료 */
  function bondBlock(id) {
    var BD = global.DG.bond;
    if (!BD) { return ''; }
    var pg = BD.progressOf(id), hearts = '', i;
    for (i = 0; i < BD.MAX_LV; i++) { hearts += i < pg.lv ? '❤️' : '🤍'; }
    var out = '<div class="dt-bond"><div class="dt-line"><span>🤝 인연 ' + hearts + '</span><b>+' +
      Math.round(pg.lv * BD.STEP * 100) + '%</b></div>';
    if (pg.max) {
      out += '<small class="muted">더할 것이 없는 사이입니다.</small>';
    } else {
      out += '<small class="muted">함께 걸은 ' + distLabel(pg.walk) + ' / ' + distLabel(pg.needWalk) +
        ' · 토벌 승 ' + pg.wins + ' / ' + pg.needWins + ' (먼저 닿는 쪽) — 동행 중일 때만 쌓입니다.</small>';
    }
    var ps = BD.partnersOf(id);
    if (ps.length) {
      out += '<small class="muted"> · 🔗 결 — ' + esc(ps.join(', ')) + ' 와(과) 같은 세력 (필살 기 +' + BD.KI_PCT + '%)</small>';
    }
    return out + '</div>';
  }

  function renderDetail() {
    if (!openDetailRef) { return; }
    var host = detailHost();
    var ref = data.find(openDetailRef.id);
    if (!ref) { closeDetail(); return; }
    host.innerHTML = openDetailRef.kind === 'pet' ? detailPet(ref) : detailHero(ref);
  }

  /**
   * ⑲-15 편성 단추 — 동행이면 자리(⚔ 들판 1~4 · 대기 5)·◀ 앞 자리로·⚔ 들판 명단에 넣기·빼기,
   * 아니면 넣기(꽉 찼으면 다섯째와 바뀜). formation.js 가 없으면 옛 두 단추
   */
  function partyButtons(h) {
    var FM = global.DG.formation, P = core.save.party, i = P.indexOf(h.id);
    if (!FM) {
      return i >= 0 ? '<button class="btn ghost wide" data-act="drop" data-id="' + h.id + '">동행에서 뺀다</button>'
        : '<button class="btn wide"' + (P.length >= 5 ? ' disabled' : '') + ' data-act="join" data-id="' + h.id + '">동행에 넣는다</button>';
    }
    if (i < 0) {
      var sw = FM.putSwap(h.id), sh = sw ? data.find(sw) : null;
      return '<button class="btn wide" data-act="join" data-id="' + h.id + '">동행에 넣는다' +
        (sw ? ' (다섯째 ' + esc(sh ? sh.name : sw) + '와 바꿈)' : '') + '</button>';
    }
    var out = '<div class="stat-row"><span>자리</span><b>' + (i < FM.FIELD ? '⚔ 들판 명단 ' + (i + 1) : '대기 ' + (i + 1)) + '</b></div>';
    if (i > 0) { out += '<button class="btn wide" data-act="party-up" data-id="' + h.id + '">◀ 앞 자리로</button>'; }
    if (i >= FM.FIELD) { out += '<button class="btn wide" data-act="party-field" data-id="' + h.id + '">⚔ 들판 명단에 넣기</button>'; }
    return out + '<button class="btn ghost wide" data-act="drop" data-id="' + h.id + '">동행에서 뺀다</button>';
  }

  function detailHero(h) {
    var owned = !!core.save.dex.heroes[h.id];
    var rar = data.rarity[h.rarity];
    var fac = data.faction(h.faction);
    var g = hero().info(h.id);
    var bk = hero().breakdown(h.id);
    var need = hero().expNeed(g.lv);
    var maxLv = g.lv >= hero().MAX_LV;
    var inParty = core.save.party.indexOf(h.id) >= 0;
    var chk = hero().rankUpCheck(h.id);
    var cost = chk.cost || hero().rankUpCost(g.rank);
    var p3h = p3src('hero', h, 150, 172, function () { return global.DG.sprite.portraitCard('hero', h, 150, 172); });

    var out = '<div class="dt-card">' +
      '<button class="icon-btn sm dt-x" data-act="dt-close">✕</button>' +
      '<div class="dt-top">' +
        '<img class="dt-portrait' + (owned && global.DG.bond && global.DG.bond.lvOf(h.id) >= 3 ? ' bond3' : '') + '" alt=""' + p3tag('hero', h, 150, 172) + p3h.done + ' src="' +
          p3h.src + '">' +
        '<div class="dt-head">' +
          '<div class="dt-name"><b>' + esc(h.name) + '</b>' +
            (h.hanja ? '<span class="hanja">' + esc(h.hanja) + '</span>' : '') + '</div>' +
          '<div class="dt-tags">' +
            '<span class="tag fac" style="background:' + fac.color + '">' + fac.mark + ' ' + esc(h.faction) + '</span>' +
            '<span class="tag">' + esc(h.era) + '</span>' +
            '<span class="tag" style="color:' + rar.color + '">' + rar.name + ' ' + rar.label + '</span>' +
            '<span class="tag">' + data.traitMark[h.trait] + '</span>' +
          '</div>';

    if (owned) {
      out += '<div class="dt-lv">Lv.<b>' + g.lv + '</b>' +
        (maxLv ? ' <span class="tag">최대</span>' : '') +
        (g.rank ? ' <span class="rankmark">승급 ' + rankStars(g.rank).trim() + '</span>' : '') +
        '</div>' +
        '<div class="bar sm"><i style="width:' + (maxLv ? 100 : g.exp / need * 100) + '%"></i></div>' +
        '<small class="muted">' + (maxLv ? '더 오를 곳이 없습니다' : '경험치 ' + g.exp + ' / ' + need) +
          ' · 성장 배율 ×' + bk.mul.toFixed(2) + '</small>' +
        '<div class="dt-where">' + (inParty ? '🧭 동행 중' : '🏠 집에서 대기 중') + '</div>';
    } else {
      out += '<div class="dt-lv muted">아직 등용하지 않은 인물입니다</div>';
    }
    out += '</div></div>';

    if (owned) {
      var cap = 200;      // 능력치 바의 만점 기준 (Lv.30 ★5 까지 자랄 자리를 남긴다)
      out += '<div class="dt-stats">' +
        statRow('무력', bk.base.might, bk.grown.might, bk.final.might, cap) +
        statRow('지력', bk.base.wisdom, bk.grown.wisdom, bk.final.wisdom, cap) +
        statRow('통솔', bk.base.command, bk.grown.command, bk.final.command, cap) +
        '</div>' +
        '<div class="dt-line"><span>인물 됨됨이</span><b>' + core.fmt(hero().power(h.id)) + '</b></div>' +
        perkBlock(h.id) + weaponBlock(h.id) + artifactBlock(h.id) + talentBlock(h.id) + bondBlock(h.id);

      out += '<div class="dt-pet"><span>🐾 펫</span>' +
        '<select data-equip="' + h.id + '">' + petOptions(h.id) + '</select>' +
        (bk.pet ? '<small class="muted">' + esc(bk.pet.name) + ' · ' +
          statKor(bk.pet.bonus.stat) + ' +' +
          (growth() ? growth().bonusOf(bk.pet) : bk.pet.bonus.value) +
          (growth() && growth().lvOf(bk.pet.id) ? ' (연성 ' + growth().lvOf(bk.pet.id) + '단)' : '') +
          '</small>'
                : '<small class="muted">장착하면 능력치가 더해집니다</small>') +
        '</div>';
    }

    var bio = data.bio(h.id);
    if (owned) {
      if (bio) { out += '<p class="dt-bio">' + esc(bio) + '</p>'; }
      out += '<p class="quote">"' + esc(h.quote) + '"</p>';
    } else {
      out += '<p class="dt-bio muted">등용하면 열전이 열립니다.</p>';
    }

    if (owned) {
      out += '<div class="dt-acts">';
      if (g.rank >= hero().MAX_RANK) {
        out += '<button class="btn ghost wide" disabled>✨ 최대 승급 (★' + g.rank + ')</button>';
      } else {
        out += '<button class="btn ' + (chk.ok ? 'primary' : 'ghost') + ' wide"' +
          (chk.ok ? '' : ' disabled') + ' data-act="rankup" data-id="' + h.id + '">' +
          '✨ 승급 ★' + (g.rank + 1) + ' · 중복 ' + hero().dupOf(h.id) + '/' + cost.dup +
          ' · 🪙 ' + core.fmt(cost.gold) +
          (cost.sp ? ' · ' + ico('material', cost.sp.item, 18, cost.sp.icon) + ' ' + cost.sp.have + '/' + cost.sp.n : '') +
          (cost.boss ? ' · ' + cost.boss.icon + ' ' + cost.boss.have + '/' + cost.boss.n : '') + '</button>';   // ⑲-10 보스 재료
      }
      if (net().online()) {
        out += '<button class="btn wide" data-act="dt-talk" data-id="' + h.id + '">💬 말을 건다 (사관)</button>';
      }
      out += partyButtons(h);                                            // ⑲-15 편성 — 넣기·빼기·앞으로·들판으로
      out += '</div>' +
        '<small class="muted dt-tip">승급은 <b>같은 인물을 또 등용해 생긴 중복분</b>과 금을 씁니다. ' +
        '동행 선두가 지도 위 내 모습이 되고, 조우 성공 때 동행 전원이 경험치를 받습니다.</small>';
    }

    return out + '</div>';
  }

  function petOptions(heroId) {
    var owned = Object.keys(core.save.dex.pets);
    var equipped = core.save.petEquip[heroId] || '';
    var used = {}, k;
    for (k in core.save.petEquip) {
      if (Object.prototype.hasOwnProperty.call(core.save.petEquip, k) && k !== heroId) {
        used[core.save.petEquip[k]] = true;
      }
    }
    var out = '<option value="">— 펫 없음 —</option>';
    for (var i = 0; i < owned.length; i++) {
      var p = data.find(owned[i]);
      if (!p || used[p.id]) { continue; }
      out += '<option value="' + p.id + '"' + (equipped === p.id ? ' selected' : '') + '>' +
        p.emoji + ' ' + p.name + ' (' + statKor(p.bonus.stat) + ' +' + p.bonus.value + ')</option>';
    }
    return out;
  }

  function statKor(s) { return ({ might: '무력', wisdom: '지력', command: '통솔', virtue: '덕망' })[s] || s; }

  /**
   * 반려(伴侶) — 원작의 버디 화면.
   * 곁에 세운 짐승 하나만 진행이 돌고, 우애는 **종별로 남는다**(갈아타도 지워지지 않는다).
   */
  function buddyBlock(p, owned) {
    var B = buddy();
    if (!B || !owned) { return ''; }
    var cur = B.current();
    var mine = !!(cur && cur.pet.id === p.id);
    var bd = B.bondOf(p.id);
    var lg = B.info(p.id);

    /* 보정은 **곁에 세워 둔 동안에만** 붙는다 — 세우지 않은 종에 그냥 "+2%" 라고
       적으면 이미 붙어 있는 것처럼 읽힌다 */
    var out = '<div class="dt-line"><span>반려(伴侶)</span><b>' + bd.def.mark + ' ' + bd.def.name +
      (bd.def.mul ? ' <small class="muted">· ' + (mine ? '장착 보정' : '세우면') + ' +' +
        Math.round(bd.def.mul * 100) + '%</small>' : '') +
      '</b></div>' +
      '<div class="dt-line"><span>함께 걸은 거리</span><b>' + core.fmt(lg.walked) + 'm' +
        (lg.fed ? ' <small class="muted">· 사료 ' + lg.fed + '줌</small>' : '') + '</b></div>';
    if (bd.next) {
      out += '<div class="bar sm"><i style="width:' + (bd.pct * 100) + '%"></i></div>' +
        '<small class="muted">' + bd.next.mark + ' ' + bd.next.name + ' 까지 ' + core.fmt(bd.left) + 'm</small>';
    }
    if (mine) {
      out += '<div class="dt-line"><span>다음 영초</span><b>🌿 ' + cur.herbNext + ' · ' +
          core.fmt(cur.left) + 'm 남음</b></div>' +
        '<div class="bar sm"><i style="width:' + (cur.pct * 100) + '%"></i></div>' +
        '<button class="btn wide" data-act="buddy-feed"' +
          (global.DG.bag.count('feed') < 1 ? ' disabled' : '') + '>🍖 사료를 먹인다 · 우애 +' +
          core.fmt(B.FEED_M) + ' (남은 사료 ' + global.DG.bag.count('feed') + ')</button>' +
        '<button class="btn ghost wide" data-act="buddy-clear">🐾 곁에서 물린다</button>';
    } else {
      out += '<button class="btn primary wide" data-act="buddy-set" data-id="' + p.id + '">' +
        '🐾 반려로 세운다 — ' + core.fmt(B.legOf(p)) + 'm 마다 🌿</button>';
    }
    return out;
  }

  /**
   * 연성(강화) · 승화(진화) — 원작의 사탕 화면.
   * 잡지 않은 종에는 아무것도 뜨지 않는다(무엇이 되는지만 흘려 보여 준다).
   */
  function petGrowBlock(p, owned) {
    var G = growth();
    if (!G) { return ''; }
    var gi = G.info(p.id);
    var ch = G.chainOf(p.id);
    var out = '';

    if (!owned) {
      return ch
        ? '<div class="dt-line"><span>승화</span><b class="muted">' +
            esc((data.find(ch.to) || {}).name || '') + ' 이 된다는 이야기가 있다</b></div>'
        : '';
    }

    /* 연성 */
    var rc = G.refineCheck(p.id);
    var cost = rc.cost || G.refineCost(gi.lv);
    out += '<div class="dt-line"><span>연성(鍊成)</span><b>' + gi.lv + ' / ' + G.MAX_LV + '단</b></div>' +
      '<div class="dt-line"><span>모은 영초</span><b>🌿 ' + core.fmt(gi.herb) +
        ' <small class="muted">· 잡을 때마다 +' + G.HERB_PER_CATCH + '</small></b></div>';
    if (gi.lv >= G.MAX_LV) {
      out += '<small class="muted">더 올릴 수 없습니다 — 연성이 끝났습니다.</small>';
    } else {
      out += '<button class="btn primary wide" data-act="refine" data-id="' + p.id + '"' +
        (rc.ok ? '' : ' disabled') + '>🌿 연성 — 영초 ' + cost.herb + ' · ✨ 단사 ' +
        core.fmt(cost.dust) + (rc.ok ? '' : ' (' + rc.why + ')') + '</button>';
    }

    /* 승화 */
    if (ch) {
      var ac = G.ascendCheck(p.id);
      var to = data.find(ch.to);
      out += '<div class="dt-line"><span>승화(昇華)</span><b>' + esc(to ? to.name : '') +
        ' <small class="muted">· ' + esc(ch.why) + '</small></b></div>' +
        '<button class="btn wide" data-act="ascend" data-id="' + p.id + '"' +
        (ac.ok ? '' : ' disabled') + '>✨ 승화 — 영초 ' + ch.herb +
        (ac.ok ? '' : ' (' + ac.why + ')') + '</button>';
    }
    return out;
  }

  function detailPet(p) {
    var d = core.save.dex.pets[p.id];
    var owned = !!d;
    var G = growth();
    var gi = G ? G.info(p.id) : { lv: 0, herb: 0 };
    var rar = data.rarity[p.rarity];
    var wearer = null, k;
    for (k in core.save.petEquip) {
      if (Object.prototype.hasOwnProperty.call(core.save.petEquip, k) &&
          core.save.petEquip[k] === p.id) { wearer = data.find(k); }
    }
    var p3p = p3src('pet', p, 150, 172, function () { return global.DG.sprite.portraitCard('pet', p, 150, 172); });
    return '<div class="dt-card">' +
      '<button class="icon-btn sm dt-x" data-act="dt-close">✕</button>' +
      '<div class="dt-top">' +
        '<img class="dt-portrait" alt=""' + p3tag('pet', p, 150, 172) + p3p.done + ' src="' +
          p3p.src + '">' +
        '<div class="dt-head">' +
          '<div class="dt-name"><b>' + esc(p.name) + '</b></div>' +
          '<div class="dt-tags">' +
            '<span class="tag fac" style="background:' + (p.kind === 'divine' ? '#8a5cc0' : '#5f7a4a') + '">' +
              (p.kind === 'divine' ? '神 신수' : '獸 동물') + '</span>' +
            '<span class="tag" style="color:' + rar.color + '">' + rar.name + ' ' + rar.label + '</span>' +
          '</div>' +
          '<div class="dt-lv">' + (owned
            ? '보유 ' + d.count + '마리' + (wearer ? ' · ' + esc(wearer.name) + ' 장착 중' : ' · 장착 안 됨')
            : '<span class="muted">아직 포획하지 않았습니다</span>') + '</div>' +
          '<small class="muted">기본 포획률 ' + Math.round(p.catchBase * 100) + '%</small>' +
        '</div>' +
      '</div>' +
      '<div class="dt-line"><span>장착 보정</span><b>' + statKor(p.bonus.stat) + ' +' +
        (G ? G.bonusOf(p) : p.bonus.value) +
        (G && gi.lv ? ' <small class="muted">(기본 ' + p.bonus.value + ' · 연성 ' + gi.lv + '단)</small>' : '') +
        '</b></div>' +
      buddyBlock(p, owned) +
      petGrowBlock(p, owned) +
      '<p class="dt-bio">' + esc(p.desc || '') + '</p>' +
      '<small class="muted dt-tip">펫은 인물에게 하나씩 장착합니다. 인물 상세 화면에서 고르세요. ' +
        '<b>반려</b>는 따로입니다 — 곁을 걷는 한 마리이고, 장착과 함께 걸 수 있습니다.</small>' +
      '</div>';
  }

  /* ── 토스트 ───────────────────────────────────────────── */

  /**
   * 갈래 있는 토스트 + 짧은 큐(축1, 2026-09-06 "알림이 약하다").
   * 여태는 문자열 하나뿐이라 늘 같은 금테로 떴다 — `type`('good'|'bad'|'find')을
   * 얹으면 색이 갈리고, `find`(걷다가 무언가 찾은 것)는 더 밝고 오래 뜬다.
   * 옛 호출(`toast(문자열)`, `core.emit('toast', 문자열)`)은 그대로 `info`로 온다.
   * 짧은 사이에 여럿이 몰리면(걷기 흥 토스트가 실제로 그렇다) 그냥 덮어쓰던 것을
   * 큐에 쌓아 하나씩 보여준다 — 안 그러면 스치는 알림이 서로를 지운다.
   */
  var toastTimer = null;
  var toastQueue = [];
  var toastBusy = false;

  function pumpToast() {
    if (toastBusy || !toastQueue.length) { return; }
    var t = toastQueue.shift();
    toastBusy = true;
    els.toast.textContent = t.msg;
    els.toast.className = 'show' + (t.type !== 'info' ? ' t-' + t.type : '');
    if (toastTimer) { clearTimeout(toastTimer); }
    var dur = t.type === 'find' ? 3400 : 2600;
    toastTimer = setTimeout(function () {
      els.toast.classList.remove('show');
      toastBusy = false;
      setTimeout(pumpToast, 140);
    }, dur);
  }

  function toast(msg, type) {
    if (msg && typeof msg === 'object') { type = msg.type; msg = msg.msg; }
    if (!msg) { return; }
    toastQueue.push({ msg: msg, type: type || 'info' });
    while (toastQueue.length > 4) { toastQueue.shift(); }   // 너무 밀리면 오래된 것부터 버린다
    pumpToast();
  }

  /**
   * 레벨 업 — 여태 `core.log`(기록 시트에나 남는 글자 한 줄)뿐이었다(축3,
   * "레벨업도 숫자 말고는 연출이 약하다"). `core.emit('levelup', lv)`는
   * 이미 있었는데 듣는 곳이 없었다 — 화면 가운데 잠깐 뜨는 띠 하나만 붙인다.
   * 조작을 막지 않는다(pointer-events:none) — 걷거나 싸우는 중에도 그냥 지나간다.
   */
  var levelupTimer = null;
  function showLevelUp(lv) {
    if (!els.levelup) { return; }
    els.levelup.innerHTML = '<div class="lv-banner"><b>LEVEL UP</b><span>' + (global.DG.adventure ? '여정 등급 ' : 'Lv.') + lv + '</span></div>';
    els.levelup.classList.remove('show');
    void els.levelup.offsetWidth;               // 리플로우를 강제해 연타 레벨업도 매번 다시 재생한다
    els.levelup.classList.add('show');
    if (levelupTimer) { clearTimeout(levelupTimer); }
    levelupTimer = setTimeout(function () { els.levelup.classList.remove('show'); }, 1800);
  }

  /**
   * 마무리 카드 — PLAN §5 ④, 표준 B(세션 마무리 카드). `visibilitychange hidden`
   * ·5분 무입력·자동 순행 끔에서 game.js 가 diff(걸음·만남·금)를 재서 부른다.
   * `#encounter`(조우 모달)를 그대로 빌려 쓴다 — game.js 가 부르기 전에
   * `event.live`(다른 조우가 열려 있는지)를 먼저 살핀다.
   */
  var sessionCardTimer = null;
  function showSessionCard(diff) {
    var el = $('encounter');
    if (!el) { return; }
    var rate = global.DG.codex ? global.DG.codex.rate() : null;
    el.innerHTML =
      '<div class="enc-card">' +
        '<h3 style="margin:0 0 6px;font-size:17px">🌙 이번 나들이</h3>' +
        '<div class="stat-row"><span>걸음</span><b>' + core.fmt(diff.steps) + 'm</b></div>' +
        '<div class="stat-row"><span>만남</span><b>' + core.fmt(diff.meet) + '</b></div>' +
        '<div class="stat-row"><span>금</span><b>🪙 ' + core.fmt(diff.gold) + '</b></div>' +
        (rate ? '<div class="stat-row"><span>도감</span><b>' + rate.pct + '%</b></div>' : '') +
        '<div class="p-goal now" style="margin-top:8px">다음 · 🧭 ' + goalNowText() + '</div>' +
        '<button class="btn primary wide" id="daily-card-ok">확인</button>' +
      '</div>';
    el.classList.add('show');
    var close = function () {
      el.classList.remove('show'); el.innerHTML = '';
      if (sessionCardTimer) { clearTimeout(sessionCardTimer); sessionCardTimer = null; }
    };
    var btn = $('daily-card-ok');
    if (btn) { btn.addEventListener('click', close); }
    if (sessionCardTimer) { clearTimeout(sessionCardTimer); }
    sessionCardTimer = setTimeout(close, 5000);
  }

  /** 매 프레임이 아니라 주기적으로만 갱신한다 */
  function tickRefresh() {
    renderTop();
    renderNear();
    renderAutoBar();
    syncHeaderStack();
    var a = document.activeElement;
    if (a && (a.tagName === 'SELECT' || a.tagName === 'INPUT') && els['sheet-body'].contains(a)) { return; }
    if (openTab === 'oracle' || openTab === 'dungeon') { renderSheet(); }
  }

  /**
   * 상단 띠(#top)의 실제 높이는 고정이 아니다 — 손잡이 줄(🎛️)이 붙거나 지갑이
   * 두 줄로 접히면 늘어난다. `#autobar`·`#minimap` 이 그걸 모른 채 `top:106px`
   * 같은 값으로 박혀 있으면 그 밑에 겹쳐 버린다(자동 순행 문구가 지갑을 덮은
   * 실기기 신고로 잡았다) — 매 갱신마다 실제로 재서 CSS 변수로 넘긴다.
   */
  function syncHeaderStack() {
    if (!els.wallet) { return; }
    var topBottom = Math.ceil(els.wallet.getBoundingClientRect().bottom);
    document.documentElement.style.setProperty('--top-bottom', topBottom + 'px');
    var belowHeader = topBottom;
    var root = document.documentElement.style, autoH = 0;
    if (els.autobar && els.autobar.classList.contains('show')) {
      var ab = els.autobar.getBoundingClientRect();
      belowHeader = Math.max(belowHeader, Math.ceil(ab.bottom));
      autoH = Math.ceil(ab.height) + 6;
    }
    /* 폰 세로 — 지역 사명·이야기 추적 줄이 `top:58px`·`86px` 고정이라 두 줄로 불어난 윗 카드
       위에 겹쳤다. 자동 순행 띠 밑으로 차례로 쌓고(CSS 600px 규칙), 미니맵은 그 밑으로 */
    if (isPhonePortrait()) {
      root.setProperty('--autobar-h', autoH + 'px');
      var rm = document.getElementById('region-mission'), mh = 0;
      if (rm && rm.style.display !== 'none' && rm.textContent) { mh = Math.ceil(rm.getBoundingClientRect().height) + 4; }
      root.setProperty('--mission-h', mh + 'px');
      ['region-mission', 'story-track'].forEach(function (id) {
        var e = document.getElementById(id);
        if (e && e.style.display !== 'none' && e.textContent) { belowHeader = Math.max(belowHeader, Math.ceil(e.getBoundingClientRect().bottom)); }
      });
    }
    root.setProperty('--below-header', belowHeader + 'px');
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
  /* 2026-09-09 — "움직이는 게 너무 힘들다"(사가나락 등과 같은 재신고).
     이 판은 실제 GPS 로 걷는 게 원작 컨셉이라 오버월드 이동에 조이스틱은
     안 맞지만, PC 프로토타입용 "키보드(모의 이동)" 모드(world.js
     mode==='keyboard')에는 그대로 맞는다 — world.js 에 이미 있던
     setStick(dx,dy) 채널(그때까지 아무 화면도 안 부르고 있었다)에 연결한다.
     GPS 로 전환하면(#btn-geo) 숨긴다 — 실제로 걷는 동안 손가락 조작이
     끼어들면 안 된다. */
  function stickSync() {
    var joyEl = $('gjoy'), padEl = $('gpad');
    if (!joyEl || !padEl) { return; }
    var W = global.DG.world;
    var on = !!(W && W.mode === 'keyboard');
    var isTouch = !!(('ontouchstart' in global) || (navigator.maxTouchPoints > 0));
    joyEl.classList.toggle('show', on && isTouch);
    padEl.classList.toggle('show', on && !isTouch);
  }
  function initStick() {
    var joyEl = $('gjoy'), joyKnob = $('gjoy-knob'), padEl = $('gpad');
    if (!joyEl || !joyKnob || !padEl) { return; }
    stickSync();
    var W = global.DG.world;
    var joyId = null, joyCX = 0, joyCY = 0;
    var JOY_R = 46, JOY_DEAD = 8;
    function knobAt(dx, dy) { joyKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
    function reset() { joyId = null; knobAt(0, 0); W.setStick(0, 0, false); }
    joyEl.addEventListener('pointerdown', function (e) {
      if (joyId !== null) { return; }
      var r = joyEl.getBoundingClientRect();
      joyCX = r.left + r.width / 2; joyCY = r.top + r.height / 2;
      joyId = e.pointerId;
      joyEl.setPointerCapture && joyEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    joyEl.addEventListener('pointermove', function (e) {
      if (e.pointerId !== joyId) { return; }
      var dx = e.clientX - joyCX, dy = e.clientY - joyCY;
      var len = Math.hypot(dx, dy);
      var kx = len > JOY_R ? dx / len * JOY_R : dx, ky = len > JOY_R ? dy / len * JOY_R : dy;
      knobAt(kx, ky);
      if (len < JOY_DEAD) { W.setStick(0, 0, false); return; }
      W.setStick(dx / len, dy / len, false);
      e.preventDefault();
    });
    function release(e) { if (e.pointerId === joyId) { reset(); } }
    joyEl.addEventListener('pointerup', release);
    joyEl.addEventListener('pointercancel', release);
    joyEl.addEventListener('pointerleave', release);

    var held = { up: false, down: false, left: false, right: false };
    function apply() {
      var dx = (held.left ? -1 : 0) + (held.right ? 1 : 0);
      var dy = (held.up ? -1 : 0) + (held.down ? 1 : 0);
      var len = Math.hypot(dx, dy);
      W.setStick(len ? dx / len : 0, len ? dy / len : 0, false);
    }
    var btns = padEl.querySelectorAll('button[data-dir]');
    for (var pi = 0; pi < btns.length; pi++) {
      (function (btn) {
        var dir = btn.getAttribute('data-dir');
        btn.addEventListener('pointerdown', function (e) {
          held[dir] = true; apply();
          btn.setPointerCapture && btn.setPointerCapture(e.pointerId);
          e.preventDefault();
        });
        function rel() { held[dir] = false; apply(); }
        btn.addEventListener('pointerup', rel);
        btn.addEventListener('pointercancel', rel);
        btn.addEventListener('pointerleave', rel);
      })(btns[pi]);
    }
  }

  global.DG.ui = {
    init: init, toast: toast, tickRefresh: tickRefresh,
    openSheet: openSheet, closeSheet: closeSheet,
    openDetail: openDetail, closeDetail: closeDetail,
    renderPanel: renderSheet, renderHud: renderTop,
    syncStick: stickSync,
    goalNowText: goalNowText, showSessionCard: showSessionCard
  };
})(window);
