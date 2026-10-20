/**
 * 2나락 2D HUD — 위 띠(층·금·쇠)·적 이름 막대·아래 띠(노획·은사)·고르기 창. dungeon-view.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * dungeon-view.js 가 `bind({ d, setTip, show, view })` 로 손잡이를 넘기고 같은 이름(renderHud·renderFoe·renderBottom·renderChoice)으로 부른다.
 * HUD 요소(hud·choiceEl·bottomEl·foeEl·actionsEl)와 shown·keys 는 init·show 때 바뀌므로 부를 때마다 view() 로 당겨 온다(pull).
 * 다시 그리기 판정 열쇠(hudKey·foeKey·lootKey·boonKey·choiceKey)는 여기 하나.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var G = null, d, setTip, show;
  var hud = null, choiceEl = null, bottomEl = null, foeEl = null, actionsEl = null, shown = false, keys = {};
  var api = null;
  function bind(g) { if (G !== g) { G = g; d = g.d; setTip = g.setTip; show = g.show; } return api; }
  function pull() { var v = G.view(); hud = v.hud; choiceEl = v.choiceEl; bottomEl = v.bottomEl; foeEl = v.foeEl; actionsEl = v.actionsEl; shown = v.shown; keys = v.keys; }
  /* HUD (상단) */

  var hudKey = '';
  /** 부적 '암흑'(§5.3) — 화면 가장자리를 어둡게 덮는다. 두 캔버스 바로 뒤(.dg-stage 안)의
   *  DOM 덧씌우기라 2D·3D 어느 쪽이든 같고, HUD(z 6)·조작판(z 20)은 그 위에 남는다 */
  function setDark(on) {
    var el = document.getElementById('dg-dark');
    if (el) { el.classList.toggle('show', !!on); }
  }
  function renderHud() {
    if (!shown) { setDark(false); return; }
    var st = d().status();
    setDark(!!(st.active && st.nightmare && st.nightmare.mods && st.nightmare.mods.indexOf('dark') >= 0));
    if (!st.active) { return; }
    /* 마을은 층도 방도 노획도 없다 — "여기가 어디인가" 만 말한다 */
    if (st.town) {
      var wb = st.wb;
      var kt = 'town|' + (st.best || 0) + '|' + (st.wild ? 1 : 0) + '|' + st.regionKey + '|' + st.dangerLv + '|' +
        (wb ? (wb.phase + '|' + wb.remain + '|' + (wb.hp || 0)) : '');
      if (kt === hudKey) { return; }
      hudKey = kt;
      var wbHtml = '';
      /* 지역(§5.12~13) — 들판이면 지역 이름, 위험도(들판 층)가 0 보다 크면 같이 */
      var WMh = global.DG.worldMap, rgH = WMh && st.regionKey ? WMh.byKey(st.regionKey) : null;
      /* 월드 보스(§5.4) — 예고 중엔 카운트다운만, 전투 중엔 이름·HP%·
         부위 3(무기🗡️·갑주🛡️·머리⛑️, 부서지면 아이콘이 빠진다)·남은 시간 */
      if (wb && wb.phase === 'notice') {
        var nmm = Math.floor(wb.remain / 60), nss = wb.remain % 60;
        wbHtml = '<div class="dg-row1">' +
          '<b class="dg-floor">⚠️ 세계 보스 예고</b>' +
          '<span class="dg-room">' + nmm + ':' + (nss < 10 ? '0' : '') + nss + ' 후 출현</span>' +
        '</div>';
      } else if (wb && wb.phase === 'active') {
        var pct = Math.max(0, Math.round(100 * wb.hp / wb.hpMax));
        var parts = (wb.parts.weapon ? '🗡️' : '') + (wb.parts.armor ? '🛡️' : '') + (wb.parts.helm ? '⛑️' : '');
        wbHtml = '<div class="dg-row1">' +
          '<b class="dg-floor">⚔️ ' + wb.name + '</b>' +
          '<span class="dg-theme">' + pct + '%</span>' +
          '<span class="dg-room">' + parts + ' · ' + wb.remain + 's</span>' +
        '</div>';
      }
      hud.innerHTML =
        '<div class="dg-row1">' +
          '<b class="dg-floor">' + (st.wild && rgH ? rgH.emoji + ' ' + rgH.name : '🏯 마을') + '</b>' +
          '<span class="dg-theme">' + (st.wild ? '가까운 마을 ' : '') + st.theme.name + '</span>' +
          '<span class="dg-room">' + (st.dangerLv ? '<b style="color:' + (st.dangerLv >= 10 ? 'var(--bad)' : '#f0a53a') + '">위험 ' + st.dangerLv + '</b> · ' : '') +
            '최고 제' + (st.best || 0) + '층</span>' +
        '</div>' + wbHtml;
      setTip(true);
      return;
    }
    /* 난입(§5.5) — 층·방 대신 파도·레벨·남은 시간을 말한다 */
    if (st.horde) {
      var kh = 'horde|' + st.horde.wave + '|' + Math.ceil(st.horde.remain) + '|' +
        st.horde.level + '|' + st.loot.gold;
      if (kh === hudKey) { return; }
      hudKey = kh;
      var mm = Math.floor(st.horde.remain / 60), ss = Math.floor(st.horde.remain % 60);
      hud.innerHTML =
        '<div class="dg-row1">' +
          '<b class="dg-floor">⚔️ 파도 ' + st.horde.wave + '</b>' +
          '<span class="dg-theme">Lv.' + st.horde.level + '</span>' +
          '<span class="dg-room">' + mm + ':' + (ss < 10 ? '0' : '') + ss + ' 남음</span>' +
          '<button class="btn tiny ghost dg-leave" data-act="leave" ' +
            'title="지금까지 주운 것을 확정하고 나온다(생존 기록은 안 남는다)">🚪 나간다</button>' +
        '</div>';
      setTip(false);
      return;
    }
    /* 시련(§5.11) — 단계·남은 시계·진척 막대(차면 수호자) */
    if (st.trial) {
      var tr = st.trial, tsec = Math.ceil(tr.t);
      var kt = 'tr|' + tr.lv + '|' + tsec + '|' + tr.prog + '|' + (tr.guardian ? 1 : 0) + '|' + tr.deaths;
      if (kt === hudKey) { return; }
      hudKey = kt;
      var tm = Math.floor(tsec / 60), ts2 = tsec % 60, pct = Math.round(tr.prog / tr.goal * 100);
      hud.innerHTML =
        '<div class="dg-row1">' +
          '<b class="dg-floor">⏳ 시련 ' + tr.lv + '단계</b>' +
          '<span class="dg-theme" style="' + (tsec < 60 ? 'color:var(--bad)' : '') + '">' +
            tm + ':' + (ts2 < 10 ? '0' : '') + ts2 + '</span>' +
          '<span class="dg-room">' + (tr.guardian ? '<b class="ok">수호자!</b>' :
            '<span style="display:inline-block;width:70px;height:7px;background:rgba(0,0,0,.4);vertical-align:middle;border-radius:3px">' +
            '<span style="display:block;height:100%;width:' + pct + '%;background:#f0a53a;border-radius:3px"></span></span> ' + pct + '%') +
            (tr.deaths ? ' · 💀' + tr.deaths : '') + '</span>' +
          '<button class="btn tiny ghost dg-leave" data-act="leave" ' +
            'title="지금까지 주운 것을 확정하고 나온다(기록은 안 남는다)">🚪 탈출</button>' +
        '</div>';
      setTip(false);
      return;
    }
    /* 부적 던전(§5.3) — 층 대신 티어·변형자·(있으면) 방 시계를 말한다 */
    if (st.nightmare) {
      var kn = 'nm|' + st.nightmare.tier + '|' + st.room + '|' +
        Math.ceil(st.nightmare.roomT || 0) + '|' + st.loot.gold;
      if (kn === hudKey) { return; }
      hudKey = kn;
      var DDn = global.DG.dungeonData;
      var modIcons = st.nightmare.mods.map(function (k2) {
        var m = DDn && DDn.modByKey(k2);
        return m ? '<span title="' + m.name + ' — ' + m.desc + '">' + m.emoji + '</span>' : '';
      }).join(' ');
      hud.innerHTML =
        '<div class="dg-row1">' +
          '<b class="dg-floor">📜 티어 ' + st.nightmare.tier + '</b>' +
          '<span class="dg-theme">' + modIcons + '</span>' +
          '<span class="dg-room">' + st.room + ' / ' + st.roomTotal + ' 방' +
            (st.nightmare.roomT != null ? ' · ' + Math.ceil(st.nightmare.roomT) + 's' : '') +
            (st.cleared ? ' · <b class="ok">정리됨</b>' : '') + '</span>' +
          '<button class="btn tiny ghost dg-leave" data-act="leave" ' +
            'title="지금까지 주운 것을 확정하고 나온다">🚪 탈출</button>' +
        '</div>';
      setTip(false);
      return;
    }
    setTip(false);
    var k = st.floor + '|' + st.room + '|' + st.loot.gold + '|' +
            st.loot.items + '|' + JSON.stringify(st.boons) + '|' + (st.cleared ? 1 : 0);
    if (k === hudKey) { return; }
    hudKey = k;

    /* 노획·은사는 조작판이 들고 있다(renderBottom) — 위쪽은 "어디까지 왔나" 만 말한다 */
    hud.innerHTML =
      '<div class="dg-row1">' +
        '<b class="dg-floor">제 ' + st.floor + ' 층</b>' +
        '<span class="dg-theme">' + (st.fixed ? st.fixed.emoji + ' ' + st.fixed.name + ' · ' + st.fixed.title : st.theme.name) + '</span>' +
        '<span class="dg-room">' + st.room + ' / ' + st.roomTotal + ' 방' +
          (st.cleared ? ' · <b class="ok">정리됨</b>' : '') + '</span>' +
        '<button class="btn tiny ghost dg-leave" data-act="leave" ' +
          'title="지금까지 주운 것을 확정하고 나온다">🚪 탈출</button>' +
      '</div>';
  }

  /**
   * 화면 위쪽 가운데 — **지금 겨누고 있는 적**의 이름과 체력.
   * 원작에서 적 머리 위에는 아무것도 없고, 마우스가 가리킨 하나만 위쪽에 뜬다.
   * 그래서 여기서도 "가장 가까운 적" 하나만 올린다.
   * 순수하게 보여 주기만 한다 — 판정은 dungeon.js 몫이고 이 함수는 읽기만 한다.
   */
  var foeKey = '';
  function renderFoe() {
    if (!shown || !foeEl) { return; }
    var run = d().raw();
    if (!run || !run.room) { foeEl.className = ''; foeKey = ''; return; }
    var best = null, bestD = 1e9, i;
    for (i = 0; i < run.room.enemies.length; i++) {
      var e = run.room.enemies[i];
      if (e.hp <= 0) { continue; }
      var dd = Math.hypot(e.x - run.player.x, e.y - run.player.y);
      if (dd < bestD || e === (global.DG.engage && global.DG.engage.targetOf(run.player))) { bestD = e === (global.DG.engage && global.DG.engage.targetOf(run.player)) ? -1 : dd; best = e; }   // W-0175 찍은 적을 먼저 보인다
    }
    if (!best || bestD > 260) { foeEl.className = ''; foeKey = ''; return; }

    /* 저항표(resistOf·eliteOf)는 마을·던전 공용 개념(적 자체의 값)이라 늘
       dungeon.js 것을 직접 쓴다 — d()가 마을일 때 town.js 에는 이 둘이 없어
       'd().resistOf is not a function' 으로 걷다가 멈추던 원인이었다
       (2026-09-04, 마을 필드전투 중 조우 HUD 를 그릴 때 터짐) */
    var DGN = global.DG.dungeon;
    var el = best.elite ? DGN.eliteOf(best.elite) : null;
    var k = best.ref.key + '|' + Math.round(best.hp) + '|' + (best.elite || '') + '|' + (best.boss ? 1 : 0);
    if (k === foeKey) { return; }
    foeKey = k;
    foeEl.className = 'show' + (best.boss ? ' boss' : el ? ' elite' : '');
    /* 저항 — 원작에서 "이놈은 불이 안 통한다" 를 알려 주는 그 줄이다.
       모르면 왜 안 깎이는지 알 길이 없다 */
    var rp = DGN.resistOf(best, 'phys'), rc = DGN.resistOf(best, 'chi');
    var res = [];
    if (rp >= 10) { res.push('칼 −' + Math.round(rp) + '%'); }
    if (rc >= 10) { res.push('기 −' + Math.round(rc) + '%'); }

    foeEl.innerHTML =
      '<div class="d2-fname">' + (global.DG.monsterPortrait ? global.DG.monsterPortrait.html(best.ref, !!best.boss, 40) : '') + '<span>' + (el ? el.name + ' ' : '') + best.ref.name + '</span></div>' +   // 몸 계열 초상(W-0072, 없으면 글자만)
      '<div class="d2-fbar"><i style="width:' +
        (core.clamp(best.hp / (best.hpMax || best.hp || 1), 0, 1) * 100) + '%"></i></div>' +
      (res.length ? '<div class="d2-fres">저항 ' + res.join(' · ') + '</div>' : '') +
      (el ? '<div class="d2-faff">' + el.desc + '</div>' : '');
  }

  /** 조작판 — 매 틱 값만 만진다 (DOM 재생성 없음) */
  var lootKey = '', boonKey = '';
  function renderBottom() {
    if (!shown || !bottomEl) { return; }
    var st = d().status();
    if (!st.active) { return; }
    var globes = bottomEl.querySelectorAll('.d2-globe');
    if (globes.length < 2) { return; }
    var hpPct = st.hpMax ? core.clamp(st.hp / st.hpMax, 0, 1) * 100 : 0;
    var mpPct = st.mpMax ? core.clamp(st.mp / st.mpMax, 0, 1) * 100 : 0;
    globes[0].querySelector('.d2-liq').style.height = hpPct + '%';
    globes[0].querySelector('.d2-gv').textContent = core.fmt(st.hp) + ' / ' + core.fmt(st.hpMax);
    globes[0].classList.toggle('low', hpPct < 30);
    globes[1].querySelector('.d2-liq').style.height = mpPct + '%';
    globes[1].querySelector('.d2-gv').textContent = Math.round(st.mp) + ' / ' + Math.round(st.mpMax);

    /* 경험치 띠 — 원작에서 판 한가운데를 가로지르는 그 줄 */
    var pl = core.save.player;
    var need = core.expNeed(pl.level) || 1;
    var xp = bottomEl.querySelector('.d2-xp');
    if (xp) {
      xp.querySelector('i').style.width = core.clamp(pl.exp / need, 0, 1) * 100 + '%';
      xp.querySelector('span').textContent = 'Lv.' + pl.level;
    }

    /* 회차 노획 — 죽으면 잃는 값이라 늘 보여야 한다 */
    var lk = st.loot.gold + '|' + st.loot.items;
    var lootEl = bottomEl.querySelector('.d2-loot');
    if (lootEl && lk !== lootKey) {
      lootKey = lk;
      lootEl.innerHTML = '💼 금 <b>' + core.fmt(st.loot.gold) + '</b> · 장비 <b>' +
        st.loot.items + '</b>점' +
        '<span class="d2-keys">이동 WASD · 물약 1 2 3 4 · 스킬 Z X C V</span>';
    }

    /* 은사 — 이 회차에만 붙어 있는 것 */
    var bk = JSON.stringify(st.boons);
    var boonEl = bottomEl.querySelector('.d2-boonline');
    if (boonEl && bk !== boonKey) {
      boonKey = bk;
      var bl = '', key;
      for (key in st.boons) {
        if (!Object.prototype.hasOwnProperty.call(st.boons, key)) { continue; }
        var bd = global.DG.dungeonData.boonByKey(key);
        if (!bd) { continue; }
        bl += '<span class="dg-boon" title="' + bd.desc + '">' + bd.emoji +
          (st.boons[key] > 1 ? '<i>' + st.boons[key] + '</i>' : '') + '</span>';
      }
      boonEl.innerHTML = bl || '<span style="color:var(--ink-faint)">은사 없음</span>';
    }

    /* 요대 — 든 것과 개수 */
    var P = global.DG.potion;
    if (P) {
      var cells = bottomEl.querySelectorAll('[data-belt]');
      var bt = P.belt();
      for (var ci = 0; ci < cells.length; ci++) {
        var row = bt[ci];
        var em = cells[ci].querySelector('.d2-pe');
        var nn = cells[ci].querySelector('i');
        cells[ci].classList.toggle('empty', !row);
        if (row) {
          var kd = P.kindOf(row.kind);
          em.textContent = kd ? kd.emoji : '';
          nn.textContent = row.n > 1 ? row.n : '';
          cells[ci].title = P.label(row.kind, row.g) + ' ×' + row.n + '  (' + (ci + 1) + ')';
        } else {
          em.textContent = '';
          nn.textContent = '';
          cells[ci].title = (ci + 1);
        }
      }
    }

    var btns = bottomEl.querySelectorAll('.dg-skill');
    /* W-0330 — 무예 그림(K-0118 sk_dg_*) 먼저, 없으면 이모지. 매 틱 img 를 새로 짓지 않게 무예·비결이 바뀔 때만 다시 쓴다 */
    function skIcon(el, s) {
      var k = (s.key || '') + '|' + (s.emoji || '') + '|' + (s.secretEmoji || ''), IC = global.DG.itemicon, h;
      if (el.getAttribute('data-k') === k) { return; }
      el.setAttribute('data-k', k);
      h = s.key && !s.empty && IC ? IC.html('saga-dungeon', 'skill', s.key, '1.6em', s.emoji) : null;
      if (h) { el.innerHTML = h; el.appendChild(global.document.createTextNode(s.secretEmoji || '')); } else { el.textContent = (s.emoji || '') + (s.secretEmoji || ''); }
    }
    for (var i = 0; i < btns.length && i < st.skills.length; i++) {
      var sk = st.skills[i];
      var cdEl = btns[i].querySelector('.dg-sk-cd');
      var pct = sk.cdMax ? (sk.cd / sk.cdMax) * 100 : 0;
      cdEl.style.height = pct + '%';
      cdEl.textContent = sk.cd > 0.05 ? Math.ceil(sk.cd) : '';
      /* 걸린 무예가 바뀔 수 있으니 그림·값도 매 틱 맞춘다 (선두를 바꾸면 손이 바뀐다) */
      /* 비결(§5.9)을 걸었으면 무예 그림 옆에 작게 — 손에 든 무예가 어떻게 바뀌었는지 */
      skIcon(btns[i].querySelector('.dg-sk-e'), sk);
      btns[i].querySelector('.dg-sk-cost').textContent = sk.empty ? '' : sk.cost;
      btns[i].title = sk.empty ? '무예를 걸어 두세요'
        : (sk.name + ' ' + (sk.rank || 1) + '단' + (sk.secret ? ' · 비결 ' + sk.secretEmoji : '') +
           (sk.secretBoost > 1 ? ' · 📜 비전 ×' + sk.secretBoost : '') + ' — ' + sk.desc);
      btns[i].classList.toggle('empty', !!sk.empty);
      btns[i].classList.toggle('ready', sk.ready);
      btns[i].classList.toggle('nomana', !sk.empty && sk.cd <= 0 && !sk.ready);
    }

    /* 강공격·회피 쿨다운 링 — 스킬바와 같은 계산(위 st.heavy/st.dodgeAct,
       js/dungeon.js status() 참고), 버튼만 다른 자리(data-heavy/data-dodge). */
    var hBtn = actionsEl && actionsEl.querySelector('[data-heavy]');
    if (hBtn && st.heavy) {
      var hCd = hBtn.querySelector('.dg-sk-cd');
      hCd.style.height = (st.heavy.cdMax ? (st.heavy.cd / st.heavy.cdMax) * 100 : 0) + '%';
      hCd.textContent = st.heavy.cd > 0.05 ? Math.ceil(st.heavy.cd) : '';
      hBtn.classList.toggle('ready', st.heavy.cd <= 0);
    }
    var dBtn = actionsEl && actionsEl.querySelector('[data-dodge]');
    if (dBtn && st.dodgeAct) {
      var dCd = dBtn.querySelector('.dg-sk-cd');
      dCd.style.height = (st.dodgeAct.cdMax ? (st.dodgeAct.cd / st.dodgeAct.cdMax) * 100 : 0) + '%';
      dCd.textContent = st.dodgeAct.cd > 0.05 ? Math.ceil(st.dodgeAct.cd) : '';
      dBtn.classList.toggle('ready', st.dodgeAct.cd <= 0);
    }
    /* W-0281 무기 바꿔 들기(Q) — 을이 없으면 'empty'로 흐리게, 쿨 1초 링, 그림은 다음에 들 무기 */
    var wBtn = actionsEl && actionsEl.querySelector('[data-swap]'), WS = global.DG.wpnSwap;
    if (wBtn && WS) {
      var wi = WS.info(), wCd = wBtn.querySelector('.dg-sk-cd');
      wCd.style.height = (wi.cdMax ? (wi.cd / wi.cdMax) * 100 : 0) + '%';
      wBtn.querySelector('.dg-sk-e').textContent = wi.has ? wi.next : '🔁';
      wBtn.classList.toggle('empty', !wi.has);
      wBtn.classList.toggle('ready', wi.can);
      wBtn.title = wi.has ? '무기 바꿔 들기 (Q) — ' + wi.hand + ' → ' + wi.next + ' · 첫 타 ×' + WS.FIRST_MUL : '무기 을(乙)이 없다 — 장비 창에서 "을에 들기"';
    }
    /* 투장 전용 무예 — 세 점을 못 갖추면 'empty'로 흐리게(스킬 넷의 빈 칸과
       같은 결). 갖췄으면 어느 벌인지에 따라 그림·이름이 매 틱 바뀐다
       (선두를 바꾸면 손이 통째로 바뀐다, 위 무예와 같은 규칙). */
    var sBtn = actionsEl && actionsEl.querySelector('[data-setsk]');
    if (sBtn && st.setSkill) {
      var ssk = st.setSkill;
      var sCd = sBtn.querySelector('.dg-sk-cd');
      sBtn.querySelector('.dg-sk-e').textContent = ssk.avail ? ssk.emoji : '✨';
      sCd.style.height = (ssk.avail && ssk.cdMax ? (ssk.cd / ssk.cdMax) * 100 : 0) + '%';
      sCd.textContent = ssk.avail && ssk.cd > 0.05 ? Math.ceil(ssk.cd) : '';
      sBtn.title = ssk.avail
        ? ('〈' + ssk.setName + '〉 ' + ssk.name + ' (F) — ' + ssk.desc)
        : '투장 무예 (F) — 무기·갑주·부적 세 점을 한 벌로 갖추면 열립니다';
      sBtn.classList.toggle('empty', !ssk.avail);
      sBtn.classList.toggle('ready', ssk.avail && ssk.cd <= 0);
    }
    /* 인물별 서명 무예(2026-09-11) — 위 투장 무예와 완전히 같은 요령.
       파일럿 8명 밖 인물이 선두면 'empty'로 계속 흐리다. */
    var gBtn = actionsEl && actionsEl.querySelector('[data-sigsk]');
    if (gBtn && st.sigSkill) {
      var gsk = st.sigSkill;
      var gCd = gBtn.querySelector('.dg-sk-cd');
      gBtn.querySelector('.dg-sk-e').textContent = gsk.avail ? gsk.emoji : '🌟';
      gCd.style.height = (gsk.avail && gsk.cdMax ? (gsk.cd / gsk.cdMax) * 100 : 0) + '%';
      gCd.textContent = gsk.avail && gsk.cd > 0.05 ? Math.ceil(gsk.cd) : '';
      gBtn.title = gsk.avail
        ? (gsk.emoji + ' ' + gsk.name + ' (G) — ' + gsk.desc)
        : '서명 무예 (G) — 아직 이 인물만의 무예가 없습니다';
      gBtn.classList.toggle('empty', !gsk.avail);
      gBtn.classList.toggle('ready', gsk.avail && gsk.cd <= 0);
    }
  }

  var choiceKey = '';
  function renderChoice() {
    if (!shown) { return; }
    var st = d().status();
    var c = st.active ? st.choice : null;
    var mc = st.active ? st.merchantChoice : null;
    var gc = st.active ? st.graveChoice : null;
    var k = c ? 'b:' + c.join(',') :
      (mc ? 'm:' + mc.map(function (r) { return r.item.uid; }).join(',') :
      (gc ? 'g:' + gc.items.map(function (it) { return it.uid; }).join(',') + '|' + gc.picked.join(',') : ''));
    if (k === choiceKey) { return; }
    choiceKey = k;
    if (!c && !mc && !gc) { choiceEl.classList.remove('show'); choiceEl.innerHTML = ''; return; }
    var html;
    if (c) {
      /* §5.1 — 축 아이콘(무예🗡·인물👤·세계🌐)과 희귀도 테두리색(TIERS 재사용:
         common=상품, rare=명품, legendary=전설). */
      var AXIS_ICON = { skill: '🗡️', hero: '👤', world: '🌐' };
      var RARITY_TIER = { common: 0, rare: 2, legendary: 4 };
      var IT2 = global.DG.itemData;
      html = '<div class="dg-choice-in"><h4>축복(祝福)을 하나 고른다</h4><div class="dg-cards">';
      for (var i = 0; i < c.length; i++) {
        var b = global.DG.dungeonData.boonByKey(c[i]);
        if (!b) { continue; }
        var tierColor = (IT2 && IT2.TIERS[RARITY_TIER[b.rarity]]) ? IT2.TIERS[RARITY_TIER[b.rarity]].color : '#d0c8b8';
        html += '<button class="dg-card" data-boon="' + b.key + '" style="border-color:' + tierColor + '">' +
          '<span class="dg-ce">' + (AXIS_ICON[b.axis] || '') + b.emoji + '</span>' +
          '<b style="color:' + tierColor + '">' + b.name + '</b>' +
          '<small>' + b.desc + '</small>' +
          '</button>';
      }
      html += '</div><button class="dg-card" data-reject-boon style="margin-top:10px">거절한다 (금 -' +
        core.fmt(30 * st.floor) + ')</button>' +
        '<small class="muted">축복은 이 회차에만 남습니다 — 죽거나 나가면 사라집니다 (' +
        (st.boonPicks || 0) + '/' + (st.boonMax || 8) + ')</small></div>';
    } else if (mc) {
      /* 행상(POI: Merchant) — 은사와 같은 석판 틀을 쓰되 물건·값을 보여 준다 */
      var IT = global.DG.item;
      html = '<div class="dg-choice-in"><h4>🧺 행상 · 살 것을 고른다</h4><div class="dg-cards">';
      for (var j = 0; j < mc.length; j++) {
        var row = mc[j], t = IT.tierOf(row.item);
        var afford = core.save.player.gold >= row.price;
        html += '<button class="dg-card" data-buy="' + j + '"' + (afford ? '' : ' disabled') + '>' +
          '<b style="color:' + t.color + '">' + IT.name(row.item) + '</b>' +
          '<small>' + t.name + '</small>' +
          '<i class="dg-have">금 ' + core.fmt(row.price) + '</i>' +
          '</button>';
      }
      html += '</div><button class="dg-card" data-leave-merchant style="margin-top:10px">' +
        '떠난다</button>' +
        '<small class="muted">이 행상은 여기서만 만난다 — 놓치면 다시 안 옵니다</small></div>';
    } else {
      /* 유품(§5.2) — 금은 자동(100%), 장비는 눌러서 3점까지 고른다.
         고른 카드는 테두리로 표시한다(picked 배열에 있으면 .on). */
      var IT3 = global.DG.item, graveMax = d().GRAVE_ITEM_MAX || 3;
      html = '<div class="dg-choice-in"><h4>🪦 유품 · 되찾을 것을 고른다 (최대 ' +
        graveMax + ')</h4><div class="dg-cards">';
      for (var gi = 0; gi < gc.items.length; gi++) {
        var git = gc.items[gi], gt = IT3.tierOf(git);
        var on = gc.picked.indexOf(gi) >= 0;
        html += '<button class="dg-card' + (on ? ' on' : '') + '" data-grave-toggle="' + gi +
          '" style="border-color:' + gt.color + '">' +
          '<b style="color:' + gt.color + '">' + IT3.name(git) + '</b>' +
          '<small>' + gt.name + '</small>' +
          (on ? '<i class="dg-have">되찾는다</i>' : '') +
          '</button>';
      }
      html += '</div><button class="dg-card" data-grave-confirm style="margin-top:10px">확인 · 금 ' +
        core.fmt(gc.gold) + ' + 장비 ' + gc.picked.length + '점</button>' +
        '<small class="muted">고르지 않은 장비는 사라집니다 — 금은 늘 전부 돌아옵니다</small></div>';
    }
    choiceEl.innerHTML = html;
    choiceEl.classList.add('show');
  }

  api = { bind: bind, renderHud: function () { pull(); return renderHud.apply(null, arguments); }, renderFoe: function () { pull(); return renderFoe.apply(null, arguments); }, renderBottom: function () { pull(); return renderBottom.apply(null, arguments); }, renderChoice: function () { pull(); return renderChoice.apply(null, arguments); } };
  global.DG = global.DG || {};
  global.DG.dungeonViewHud = api;
})(typeof window !== 'undefined' ? window : this);
