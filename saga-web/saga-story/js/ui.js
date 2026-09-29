/**
 * UI — 프로필 / 재화 / 근처 대상 / 시트(서당·도감·사관·기록) / 상세 / 토스트
 * ---------------------------------------------------------------
 * 사가고 본편(위치 기반 수집 게임 형태) 화면. 던전·전투·장비 UI 는 js/_expansion/ 으로 뺐고,
 * 경영(영지·태수·건설)은 게임에서 아예 제거했다 (v1.0-full 커밋 94850f8 에 이력이 남아 있다).
 */
/**
 * 화면 — 사가스토리(원작식)
 * ---------------------------------------------------------------
 * 던전 게임의 ui.js 에서 갈라져 나왔다. 도감·상세·승급·서당·기록은 그대로 쓰고,
 * 던전 전용(본영·부대·장비)을 걷어낸 자리에 **사냥터 고르는 판**(가운데)과
 * **아래 조작 띠**(체력·기력·스킬·탕약)를 넣었다.
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

  function hero() { return global.DG.hero; }
  function net() { return global.DG.net; }
  function ai() { return global.DG.ai; }

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  /**
   * 초상 <img> 에 붙일 이름표. `portrait3d` 가 실제 모델로 그림을 다 구우면
   * 이 표를 보고 `src` 를 갈아 끼운다. 못 쓸 자리(three 없음 · 손잡이 내림 ·
   * 3D 짝이 없는 펫 — `portrait3d.PET_MAP` 참고)에서는 빈 문자열이라
   * **여태 그림이 그대로 남는다**.
   */
  /** 장비 등급 이름표 — 밑줄 없이 색만 입힌 작은 글씨(`data-gear.js` grade). 등급 이름은 인물·펫과 같다 */
  function gradeTag(GD, d) {
    if (!GD || !GD.grade || !d) { return ''; }
    var g = GD.grade(d);
    return g.name ? ' <small class="rar" style="color:' + g.color + '">' + esc(g.name) + '</small>' : '';
  }

  function p3tag(kind, ref, w, h) {
    var P3 = global.DG.portrait3d;
    if (!P3 || !P3.ready() || !P3.supports(kind, ref)) { return ''; }
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
    ['profile', 'wallet', 'goalboard', 'camp', 'hud', 'talkbox', 'touchpad', 'autobar', 'dock',
     'sheet', 'sheet-title', 'sheet-body', 'sheet-close', 'scrim', 'toast'].forEach(function (id) {
      els[id] = $(id);
    });

    els.dock.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sheet]');
      if (!b) { return; }
      var name = b.getAttribute('data-sheet');
      if (openTab === name) { closeSheet(); } else { openSheet(name); }
    });
    els['sheet-close'].addEventListener('click', closeSheet);
    els.scrim.addEventListener('click', closeSheet);
    global.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') { return; }
      if (openDetailRef) { closeDetail(); return; }
      if (owmapHost().classList.contains('show')) { closeOverworldMap(); return; }
      if (openTab) { closeSheet(); }
    });

    /* 사냥터 고르는 판 · 아래 조작 띠 — 시트와 같은 data-act 규칙을 쓴다 */
    els.camp.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) { return; }
      handleAct(b.getAttribute('data-act'), b);
    });
    if (els.hud) {
      els.hud.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) { return; }
        handleAct(b.getAttribute('data-act'), b);
      });
    }
    if (els.talkbox) {
      els.talkbox.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) { return; }
        handleAct(b.getAttribute('data-act'), b);
      });
    }

    els['sheet-body'].addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) { return; }
      handleAct(b.getAttribute('data-act'), b);
    });
    /* 음량 슬라이더 — 끌 때마다(input) 바로 듣고, 값칸은 다시 그리지 않고 직접 고쳐
       슬라이더가 손 밑에서 튀지 않게 한다(전체 renderSheet() 는 change 에서만) */
    els['sheet-body'].addEventListener('input', function (e) {
      var el = e.target, act = el.getAttribute('data-act');
      if (act === 'snd-vol') {
        var SF = global.DG.sfx;
        if (!SF) { return; }
        var v = SF.setVolume((parseInt(el.value, 10) || 0) / 100);
        var lbl = el.nextElementSibling;
        if (lbl) { lbl.textContent = Math.round(v * 100) + '%'; }
        return;
      }
      if (act === 'bgm-vol') {
        var BG0 = global.DG.bgm;
        if (!BG0) { return; }
        var v2 = BG0.setVolume((parseInt(el.value, 10) || 0) / 100);
        var lbl2 = el.nextElementSibling;
        if (lbl2) { lbl2.textContent = Math.round(v2 * 100) + '%'; }
        return;
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
      if (act === 'ow-open') { openOverworldMap(); return; }
      if (act === 'ow-close') { closeOverworldMap(); return; }
      if (act === 'key-remap') {
        var G0 = global.DG.game;
        if (G0 && G0.beginRemap) { G0.beginRemap(b.getAttribute('data-action')); renderSheet(); }
        return;
      }
      if (act === 'snd-toggle') {
        var SF0 = global.DG.sfx;
        if (SF0) { SF0.setEnabled(!SF0.enabled()); renderSheet(); }
        return;
      }
      if (act === 'bgm-toggle') {
        var BG1 = global.DG.bgm;
        if (BG1) { BG1.setEnabled(!BG1.enabled()); renderSheet(); }
        return;
      }
      if (act === 'vib-toggle') {
        var SF1 = global.DG.sfx;
        if (SF1) { SF1.setVibrateEnabled(!SF1.vibrateEnabled()); renderSheet(); }
        return;
      }
      if (act === 'gq-set') {
        var SV3 = global.DG.sideView3d;
        if (SV3) { SV3.setQuality(b.getAttribute('data-level')); renderSheet(); }
        return;
      }
      if (act === 'shake-set') {
        var SV1 = global.DG.sideView;
        if (SV1) { SV1.setShakeLevel(parseInt(b.getAttribute('data-level'), 10) || 0); renderSheet(); }
        return;
      }
      if (act === 's-enter') {
        global.DG.side.enter(b.getAttribute('data-stage'));
      } else if (act === 's-gate') {
        if (!global.DG.side.challengeGate(b.getAttribute('data-stage'))) {
          toast('🔒 지금은 도전할 수 없습니다 — 이번 주 완료했거나 오늘 이미 도전했습니다');
        }
      } else if (act === 'rift-open') {
        openSheet('rift');
      } else if (act === 'rift-begin') {
        global.DG.rift.begin();
      } else if (act === 'rift-boon') {
        global.DG.rift.pickBoon(b.getAttribute('data-key'));
      } else if (act === 'rift-node') {
        global.DG.rift.choose(parseInt(b.getAttribute('data-i'), 10) || 0);
      } else if (act === 'rift-ev') {
        global.DG.rift.pickEvent(b.getAttribute('data-key'));
      } else if (act === 'rift-up-hp') {
        global.DG.rift.buyHp();
      } else if (act === 'rift-unlock') {
        global.DG.rift.unlockBoon(b.getAttribute('data-key'));
      } else if (act === 'rift-quit') {
        riftQuitAsk = true; renderSheet();
      } else if (act === 'rift-quit-no') {
        riftQuitAsk = false; renderSheet();
      } else if (act === 'rift-quit-yes') {
        riftQuitAsk = false; global.DG.rift.abandon(); renderSheet();
      } else if (act === 's-leave') {
        global.DG.side.leave();
      } else if (act === 's-swap') {
        global.DG.party.swap(parseInt(b.getAttribute('data-i'), 10) || 0, false);
      } else if (act === 's-skill') {
        global.DG.side.castSkill(parseInt(b.getAttribute('data-i'), 10) || 0);
      } else if (act === 's-drink') {
        if (!global.DG.side.drink()) { toast('탕약이 없거나 체력이 가득합니다'); }
      } else if (act === 'talk-close') {
        global.DG.side.closeTalk();
      } else if (act === 'talk-shop') {
        global.DG.side.closeTalk();
        openSheet('shop');
      } else if (act === 'auto-on') {
        global.DG.auto.toggle();
      } else if (act === 'auto-flag') {
        global.DG.auto.toggleFlag(b.getAttribute('data-flag'));
      } else if (act === 'g-equip') {
        global.DG.gear.equip(parseInt(b.getAttribute('data-uid'), 10));
      } else if (act === 'g-unequip') {
        global.DG.gear.unequip(b.getAttribute('data-slot'));
      } else if (act === 'g-sell') {
        var got = global.DG.gear.sell(parseInt(b.getAttribute('data-uid'), 10));
        if (got) { toast('🪙 +' + core.fmt(got)); }
      } else if (act === 'g-scroll') {
        var r = global.DG.gear.apply(parseInt(b.getAttribute('data-uid'), 10),
                                     b.getAttribute('data-scroll'));
        if (!r.ok) { toast('⚠️ ' + r.why); }
      } else if (act === 'q-take') {
        global.DG.quest.take(b.getAttribute('data-q'));
      } else if (act === 'q-turn') {
        global.DG.quest.turnIn(b.getAttribute('data-q'));
      } else if (act === 'j-join') {
        global.DG.job.join(b.getAttribute('data-job'));
      } else if (act === 'j-reset') {
        if (confirm('전직을 되돌릴까요? 무명으로 돌아가고 찍은 무예 점수를 전부 되찾습니다.')) {
          global.DG.job.resetJob();
        }
      } else if (act === 'j-raise') {
        global.DG.job.raise(b.getAttribute('data-skill'));
      } else if (act === 'sh-gear') {
        global.DG.gear.buyGear(b.getAttribute('data-key'));
      } else if (act === 'sh-scroll') {
        global.DG.gear.buyScroll(b.getAttribute('data-key'));
      } else if (act === 'sh-potion') {
        global.DG.gear.buyPotion(parseInt(b.getAttribute('data-n'), 10) || 1);
      } else if (act === 'sh-craft') {
        global.DG.gear.craft(b.getAttribute('data-key'));
      } else { return; }
      core.persist(); renderSheet(); renderTop(); renderCamp();
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

    /* 오버월드 지도 — 별도 오버레이라 이벤트도 따로 받는다 */
    var owHost = owmapHost();
    owHost.addEventListener('click', function (e) {
      if (e.target === owHost) { closeOverworldMap(); return; }
      var b = e.target.closest('[data-act]');
      if (b && b.getAttribute('data-act') === 'ow-close') { closeOverworldMap(); }
    });

    core.on('toast', toast);
    core.on('changed', function () { renderTop(); renderSheet(); renderCamp(); });
    core.on('dg:keyremap', function () { if (openTab === 'keys') { renderSheet(); } });
    core.on('side:end', openSessionCard);   // 세션 마무리 카드(§5-6)
    core.on('story:change', renderStoryBox);   // 첫 발 장면(story.js)
    /* 비경(§5-3) — 고를 차례(축복·지도·이벤트)가 오면 시트가 저절로 열리고, 싸움이 시작되면 닫힌다 */
    core.on('rift:phase', function (r) {
      if (!r) { if (openTab === 'rift') { renderSheet(); } return; }
      if (r.phase === 'fight') { if (openTab === 'rift') { closeSheet(); } return; }
      if (openTab !== 'rift') { openSheet('rift'); }
    });
    core.on('dex:new', function (p) {
      var ent = data.find(p.id);
      if (ent) { toast('📖 도감 신규 등록 · ' + ent.name); }
    });
    core.on('mentor', function (p) {
      var h = data.find(p.heroId);
      if (h) { toast('🎓 스승 ' + h.name + '(' + h.hanja + ') — "' + h.quote + '"'); }
    });

    renderTop(); renderCamp();
  }

  /* ── 시트 ─────────────────────────────────────────────── */

  var SHEET_TITLE = {
    field: '🏃 사냥터', bag: '🎒 가방', job: '🥋 무예', shop: '🏪 저자',
    dex: '📖 도감', log: '📜 기록', keys: '⌨️ 키설정', settings: '⚙️ 설정',
    achieve: '🏅 업적', sessionEnd: '🚪 이번 사냥 요약', rift: '🌀 비경', story: '📚 이야기'
  };

  /** 이야기(scenario.js) — 장마다 끝남·지금·기다림. 지금 장은 할 일 한 줄이 붙는다 */
  function viewStory() {
    var SC = global.DG.scenario;
    if (!SC || !SC.on()) { return '<div class="hint">이야기가 꺼져 있습니다</div>'; }
    var titles = SC.titles(), h = SC.hint(), list = SC.list();
    var html = '<div class="hint">1부 <b>무명</b> — 이름 없는 떠돌이가 사냥터를 지나며 이름을 얻습니다.' +
      (titles.length ? '<br>🏷️ ' + titles.map(function (t) { return '「' + esc(t) + '」'; }).join(' ') : '') + '</div>';
    for (var i = 0; i < list.length; i++) {
      var c = list[i].ch, st = list[i].state;
      html += '<div class="card' + (st === 'done' ? ' on' : '') + '">' +
        '<div class="stat-row"><span><b>제' + c.no + '장 · ' + esc(c.title) + '</b></span>' +
          '<span class="muted">' + (st === 'done' ? '✅ 끝' : st === 'now' ? '▶ 지금' : (c.need > 1 ? 'Lv.' + c.need : '')) + '</span></div>' +
        '<div class="stat-row"><span class="muted">' + esc(c.blurb) + '</span></div>' +
        (st === 'now' && h && h.ch === c ? '<div class="stat-row"><b>' + esc(h.text) + '</b></div>' : '') +
        '</div>';
    }
    if (!SC.current()) { html += '<div class="hint">지금 있는 이야기는 여기까지입니다. 다음 부는 곧 이어집니다.</div>'; }
    return html;
  }

  /** 업적(PLAN 33절) — 사명과 달리 한 번 이루면 다시 안 없어진다.
   *  누르는 단추가 없다(스스로 'changed' 를 듣고 터진다) — 여기는 훑어보기만 */
  function viewAchieve() {
    var A = global.DG.achieve;
    if (!A) { return '<div class="hint">업적 모듈을 찾을 수 없습니다</div>'; }
    var list = A.list();
    var html = '<div class="hint">한 번 이루면 다시 안 없어집니다.</div>';
    for (var i = 0; i < list.length; i++) {
      var a = list[i], d = a.ref;
      html += '<div class="card' + (a.done ? ' on' : '') + '">' +
        '<div class="stat-row"><span><b>' + d.emoji + ' ' + esc(d.name) + '</b></span>' +
        '<span class="muted">' + a.value + ' / ' + d.need + '</span></div>' +
        '<div class="stat-row"><span class="muted">' + esc(d.desc) + '</span>' +
        '<span class="muted">' + (a.done ? '✅ 달성' : '') + '</span></div></div>';
    }
    return html;
  }

  /* ── 세션 마무리 카드(§5-6) ─────────────────────────────
   * 시트(도감·서당 등과 같은 DOM)를 재사용한다 — 새 열만 하나(sessionEnd).
   * 사냥터를 나가거나 죽으면 openSessionCard() 가 열고, 5초 뒤 저 혼자
   * 닫힌다(그 사이 사람이 다른 시트를 열면 타이머는 그걸 안 건드린다 —
   * openTab 이 'sessionEnd' 일 때만 닫으려 든다). */
  var sessionCardData = null;
  var sessionCardTimer = null;
  function openSessionCard(got) {
    sessionCardData = got;
    openSheet('sessionEnd');
    if (sessionCardTimer) { global.clearTimeout(sessionCardTimer); }
    sessionCardTimer = global.setTimeout(function () {
      sessionCardTimer = null;
      if (openTab === 'sessionEnd') { closeSheet(); }
    }, 5000);
  }

  function viewSessionEnd() {
    var g = sessionCardData || {};
    var html = '';
    if (g.dead) {
      html += '<div class="hint">💀 쓰러졌습니다 — 주운 금은 절반만 남았습니다.</div>';
    }
    html += '<div class="stat-row"><span>사냥터</span><b>' + esc(g.stage || '-') + '</b></div>' +
      '<div class="stat-row"><span>잡은 수</span><b>' + (g.kills || 0) + '마리</b></div>' +
      '<div class="stat-row"><span>경험치</span><b>' + core.fmt(g.exp || 0) + '</b></div>' +
      '<div class="stat-row"><span>금</span><b>🪙 ' + core.fmt(g.gold || 0) + '</b></div>';
    if (g.gear) { html += '<div class="stat-row"><span>주운 장비</span><b>📦 ' + g.gear + '</b></div>'; }
    if (g.rift) {
      html += '<div class="stat-row"><span>🌀 비경</span><b>' +
        (g.rift.clear ? '정복!' : (g.rift.floors + '층 통과')) + ' · 🧩 +' + g.rift.shards +
        ' · 축복 ' + g.rift.boons + '</b></div>';
    }
    if (g.feat) { html += '<div class="stat-row"><span>업적 진척</span><b>🏅 +' + g.feat + '</b></div>'; }
    html += '<div class="card on"><div class="stat-row"><span><b>다음에 할 것</b></span></div>' +
      '<div class="stat-row"><span>' + esc(g.next || '🏃 사냥터로 돌아가기') + '</span></div></div>';
    return html;
  }

  /** 2026-09-09(PLAN 30절) — 효과음·진동·그래픽 품질. **BGM 손잡이는 같은 날
   *  이어서(PLAN 34절, 실제 배경음악 곡이 생긴 뒤) 추가했다.** 조작 감도·화면
   *  방향은 여전히 없다(이 판의 조작은 방향키 넷뿐이라 "감도"가 걸릴 자리가
   *  없다) */
  var QUALITY_LABEL = { auto: '자동', low: '낮음', medium: '보통', high: '높음' };
  var SHAKE_LABEL = ['없음', '약', '보통'];
  function viewSettings() {
    var SF = global.DG.sfx, SV3 = global.DG.sideView3d, SV = global.DG.sideView, BG = global.DG.bgm;
    if (!SF) { return '<div class="hint">소리 모듈을 찾을 수 없습니다</div>'; }
    var on = SF.enabled(), vol = Math.round(SF.volume() * 100);
    var vib = SF.vibrateEnabled();
    var bgmRow = '';
    if (BG) {
      var bgOn = BG.enabled(), bgVol = Math.round(BG.volume() * 100);
      bgmRow = '<div class="key-row"><b>배경음악</b>' +
        '<button data-act="bgm-toggle">' + (bgOn ? '켜짐' : '꺼짐') + '</button></div>' +
        '<div class="key-row"><b>BGM 음량</b>' +
        '<input type="range" min="0" max="100" value="' + bgVol + '" data-act="bgm-vol"' +
        (bgOn ? '' : ' disabled') + '>' +
        '<span class="key-cur">' + bgVol + '%</span></div>';
    }
    var vibRow = (global.navigator && navigator.vibrate)
      ? '<div class="key-row"><b>진동</b>' +
        '<button data-act="vib-toggle">' + (vib ? '켜짐' : '꺼짐') + '</button></div>'
      : '<div class="hint">이 기기는 진동을 지원하지 않습니다</div>';
    var gq = '';
    if (SV3 && SV3.available()) {
      var cur = SV3.quality(), lv;
      gq = '<div class="key-row"><b>그래픽 품질</b><span class="key-cur">' +
        (cur === 'auto' ? '자동(' + QUALITY_LABEL[SV3.effectiveLevel()] + ')' : QUALITY_LABEL[cur]) +
        '</span></div><div class="key-row" style="gap:6px">';
      for (lv in QUALITY_LABEL) {
        if (!Object.prototype.hasOwnProperty.call(QUALITY_LABEL, lv)) { continue; }
        gq += '<button class="btn tiny' + (cur === lv ? ' primary' : ' ghost') +
          '" data-act="gq-set" data-level="' + lv + '">' + QUALITY_LABEL[lv] + '</button>';
      }
      gq += '</div><div class="hint">낮음일수록 그림자를 끄고 화면 해상도를 줄여 가벼워집니다. ' +
        '자동은 실제 프레임 속도를 보고 스스로 오갑니다.</div>';
    }
    /* 손맛 표준(§5-7) — 화면 흔들림 세기. 멀미 배려용이라 감각(그래픽)
       설정이지 소리 설정이 아니다 — gq 와 같은 버튼 3개짜리 자리에 둔다. */
    var shakeRow = '';
    if (SV) {
      var slv = SV.shakeLevel();
      shakeRow = '<div class="key-row"><b>화면 흔들림</b><span class="key-cur">' +
        SHAKE_LABEL[slv] + '</span></div><div class="key-row" style="gap:6px">';
      for (var sl = 0; sl < SHAKE_LABEL.length; sl++) {
        shakeRow += '<button class="btn tiny' + (slv === sl ? ' primary' : ' ghost') +
          '" data-act="shake-set" data-level="' + sl + '">' + SHAKE_LABEL[sl] + '</button>';
      }
      shakeRow += '</div>';
    }
    return '<div class="hint keyhint">이동 키는 ⌨️ 키설정에 있습니다.</div>' +
      '<div class="key-row"><b>효과음</b>' +
        '<button data-act="snd-toggle">' + (on ? '켜짐' : '꺼짐') + '</button></div>' +
      '<div class="key-row"><b>음량</b>' +
        '<input type="range" min="0" max="100" value="' + vol + '" data-act="snd-vol"' +
        (on ? '' : ' disabled') + '>' +
        '<span class="key-cur">' + vol + '%</span></div>' +
      bgmRow + vibRow + gq + shakeRow;
  }

  /** 2026-09-09 — 이동 키 다시 지정. WASD·방향키는 코드에 그대로 박혀 있고
   *  (실수로 못 쓰게 되지 않게), 여기서는 그 옆에 하나 더 쓸 키만 고른다. */
  function viewKeys() {
    var G = global.DG.game;
    if (!G || !G.keymap) { return '<div class="hint">지금 화면에서는 키를 지정할 수 없습니다</div>'; }
    var km = G.keymap(), rm = G.remapping();
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

  /* ── 비경(§5-3) ─────────────────────────────────────────
   * 시트 하나(rift)가 문 앞(기억 조각 강화·축복 풀)·축복 3택·노드 지도·이벤트를 다 그린다.
   * 상태는 전부 rift.js(save.rift)에 있고 여기는 그리기만 한다. */
  var riftQuitAsk = false;
  var RIFT_AXIS = { atk: '⚔️ 공격', def: '🛡️ 방어', util: '🧭 유틸' };

  function viewRiftEntry() {
    var R = global.DG.rift;
    if (!R) { return ''; }
    var f = R.info();
    return '<div class="sec"><h4>🌀 비경</h4><div class="card">' +
      '<div class="stat-row"><span>5층 노드 지도 · 층마다 축복</span>' +
        '<span class="muted">' + (f.pending ? (f.floor + 1) + '층 진행 중' : '정복 ' + f.clears + '회') + '</span></div>' +
      (f.available.ok
        ? '<button class="btn ' + (f.pending ? 'primary ' : '') + 'wide" data-act="rift-open">' +
          (f.pending ? '🌀 갈림길 열기' : '🌀 비경 문으로') + '</button>'
        : '<button class="btn ghost wide" disabled>🔒 ' + esc(f.available.reason) + '</button>') +
      '</div></div>';
  }

  function riftBoonLine(key) {
    var RD = global.DG.riftData, R = global.DG.rift, b = RD.boon(key);
    return b ? esc(R.boonLabel(b)) : esc(key);
  }

  function viewRift() {
    var R = global.DG.rift, RD = global.DG.riftData;
    if (!R || !RD) { return '<div class="hint">비경 모듈을 찾을 수 없습니다</div>'; }
    var f = R.info(), i, k, html = '';
    if (!f.pending) { riftQuitAsk = false; }

    html += '<div class="card"><div class="stat-row"><span>🧩 기억 조각</span><b>' + f.shards + '</b></div>' +
      '<div class="stat-row"><span class="muted">' + f.variant.emoji + ' 이번 주 · ' + esc(f.variant.name) + '</span>' +
        '<span class="muted">' + esc(f.variant.desc) + '</span></div></div>';

    if (!f.pending) {
      html += '<div class="hint">갈림길을 골라 5층을 내려갑니다. 층마다 <b>전투·정예·보물·휴식·이벤트</b> 중 하나를 고르고, ' +
        '진입 직후와 정예를 쓰러뜨린 뒤 <b>축복</b> 3택이 나옵니다. 5층은 관문 수호장입니다. ' +
        '쓰러지면 나가고 축복은 사라지지만, 받은 <b>기억 조각</b>은 남습니다.</div>';
      html += '<div class="stat-row"><span>도전 / 정복 / 가장 깊이</span><b>' +
        f.runs + ' / ' + f.clears + ' / ' + f.best + '층</b></div>';
      html += f.available.ok
        ? '<button class="btn primary wide" data-act="rift-begin">🌀 비경에 들어간다</button>'
        : '<button class="btn ghost wide" disabled>🔒 ' + esc(f.available.reason) + '</button>';

      html += '<div class="sec"><h4>기억 조각 강화</h4><div class="card">' +
        '<div class="stat-row"><span>최대 체력 +' + Math.round(RD.MEM_HP_STEP * 100) + '% / 단 (' + f.memHp + '/' + RD.MEM_HP_MAX + '단)</span>' +
        (f.memHp >= RD.MEM_HP_MAX
          ? '<b>최고</b>'
          : '<button class="btn tiny" data-act="rift-up-hp">🧩 ' + f.hpCost + ' 로 올린다</button>') +
        '</div></div>';
      var lockedAny = false;
      for (i = 0; i < RD.BOONS.length; i++) {
        var b = RD.BOONS[i];
        if (!b.locked) { continue; }
        lockedAny = true;
        html += '<div class="card"><div class="stat-row"><span>' + RIFT_AXIS[b.axis] + ' · ' + riftBoonLine(b.key) + '</span>' +
          (f.open[b.key]
            ? '<span class="muted">열림</span>'
            : '<button class="btn tiny ghost" data-act="rift-unlock" data-key="' + b.key + '">🧩 ' + RD.UNLOCK_COST + ' 로 연다</button>') +
          '</div><small class="muted">' + esc(b.desc) + '</small></div>';
      }
      if (lockedAny) { html = html.replace('<div class="sec"><h4>기억 조각 강화</h4>', '<div class="sec"><h4>기억 조각 강화 · 축복 풀</h4>'); }
      html += '</div>';
      return html;
    }

    /* 진행 중 */
    html += '<div class="stat-row"><span>지금</span><b>' + Math.min(f.floor + 1, RD.FLOORS) + '층 / ' + RD.FLOORS +
      ' · 이번 판 🧩 +' + f.gained + '</b></div>';
    if (f.boons.length) {
      html += '<div class="card">';
      for (i = 0; i < f.boons.length; i++) {
        var bb = RD.boon(f.boons[i]);
        html += '<div class="stat-row"><span>✨ ' + riftBoonLine(f.boons[i]) + '</span><small class="muted">' +
          esc(bb ? bb.desc : '') + '</small></div>';
      }
      html += '</div>';
    }

    if (f.phase === 'boon' && f.offer) {
      html += '<div class="sec"><h4>✨ 축복을 고르세요</h4>';
      for (i = 0; i < f.offer.length; i++) {
        var ob = RD.boon(f.offer[i]);
        html += '<button class="btn wide" data-act="rift-boon" data-key="' + ob.key + '" style="text-align:left">' +
          '<b>' + RIFT_AXIS[ob.axis] + ' · ' + riftBoonLine(ob.key) + '</b><br><small>' + esc(ob.desc) + '</small></button>';
      }
      html += '</div>';
    } else if (f.phase === 'event' && f.ev) {
      var ed = R.eventDef(f.ev.key);
      html += '<div class="sec"><h4>' + ed.emoji + ' ' + esc(ed.name) + '</h4><div class="hint">' + esc(ed.text) + '</div>';
      for (i = 0; i < ed.opts.length; i++) {
        html += '<button class="btn wide" data-act="rift-ev" data-key="' + ed.opts[i].key + '" style="text-align:left">' +
          '<b>' + esc(ed.opts[i].label) + '</b><br><small>' + esc(ed.opts[i].hint) + '</small></button>';
      }
      html += '</div>';
    } else if (f.phase === 'fight') {
      var c = f.cur || {};
      html += '<div class="hint">⚔️ 싸우는 중 — ' + esc((RD.KINDS[c.kind] || {}).name || '') +
        (c.kind === 'battle' ? ' (' + c.kills + '/' + c.goal + ')' : '') + '. 시트를 닫고 싸우세요.</div>';
    }

    /* 노드 지도 — 위가 5층 */
    html += '<div class="sec"><h4>지도</h4>';
    for (k = RD.FLOORS - 1; k >= 0; k--) {
      var row = f.map[k], chosen = f.path[k];
      html += '<div class="stat-row"><span class="muted">' + (k + 1) + '층</span><span>';
      for (i = 0; i < row.length; i++) {
        var kd = RD.KINDS[row[i].kind];
        var here = (k === f.floor && f.phase === 'map');
        var was = k < f.floor && chosen === i;
        html += '<button class="btn tiny ' + (was ? 'primary' : 'ghost') + '"' +
          (here ? ' data-act="rift-node" data-i="' + i + '" title="' + esc(kd.desc) + '"' : ' disabled') +
          ' style="margin-left:4px' + (k < f.floor && !was ? ';opacity:.4' : '') + '">' +
          kd.emoji + ' ' + esc(kd.name) + '</button>';
      }
      html += '</span></div>';
    }
    html += '</div>';

    html += riftQuitAsk
      ? '<div class="card"><div class="hint">정말 포기할까요? 축복과 층은 사라지고, 받은 기억 조각만 남습니다.</div>' +
        '<button class="btn wide" data-act="rift-quit-yes">포기한다</button>' +
        '<button class="btn ghost wide" data-act="rift-quit-no">계속한다</button></div>'
      : '<button class="btn tiny ghost wide" data-act="rift-quit">🚪 비경을 포기하고 나간다</button>';
    return html;
  }

  function openSheet(name) {
    openTab = name;
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
    var v = openTab === 'field' ? viewField()
          : openTab === 'bag' ? viewBag()
          : openTab === 'job' ? viewJob()
          : openTab === 'shop' ? viewShop()
          : openTab === 'dex' ? viewDex()
          : openTab === 'keys' ? viewKeys()
          : openTab === 'settings' ? viewSettings()
          : openTab === 'achieve' ? viewAchieve()
          : openTab === 'rift' ? viewRift()
          : openTab === 'story' ? viewStory()
          : openTab === 'sessionEnd' ? viewSessionEnd() : viewLog();
    els['sheet-body'].innerHTML = v;
  }

  /* ── 상단 ─────────────────────────────────────────────── */

  function renderTop() {
    var p = core.save.player;
    var need = core.expNeed(p.level);
    var pct = Math.round(p.exp / need * 100);
    var st = global.DG.side.status();

    els.profile.innerHTML =
      '<div class="avatar" style="--p:' + pct + '%"><i>🏃</i></div>' +
      '<div class="p-meta">' +
        '<div class="p-title">' + titleOf(p.featTotal) + ' · Lv.' + p.level + '</div>' +
        '<div class="p-sub">' +
          (st.active ? esc(st.stage.name) + ' · ' + st.kills + '마리 · 🪙 ' + core.fmt(st.gold)
                     : '🏕️ 쉬는 중 · 누적 ' + core.fmt(st.kills) + '마리') +
          ' · 🧪 ' + st.potions + '</div>' +
        /* 체력·기력 — 예전엔 사냥 중에만 뜨는 #hud 안에만 있어, 쉬는 동안은
           에너지(기력)를 어디서도 볼 수 없었다. 캐릭 정보 카드에 상시 붙여 둔다 */
        '<div class="p-bars">' +
          '<div class="p-bar hp"><i style="width:' + (st.hp / st.hpMax * 100) + '%"></i></div>' +
          '<div class="p-bar mp"><i style="width:' + (st.mp / st.mpMax * 100) + '%"></i></div>' +
        '</div>' +
      '</div>';

    els.wallet.innerHTML =
      coin('🪙', core.fmt(p.gold), '금', false, 'coins') +
      coin('🎖️', core.fmt(p.fame), '명성', false, 'medal') +
      coin('🏅', core.fmt(p.feat), '공적', true, 'award') +
      coin('📜', core.fmt(core.save.items.scroll), '등용서', false, 'scroll') +
      coin('🍖', core.fmt(core.save.items.feed), '사료', false, 'ham');
    /* 지갑은 값이 바뀔 때마다 다시 그려지므로 그릴 때마다 한 번 훑는다 */
    if (global.DG.icon) { global.DG.icon.sweep(els.wallet); }

    renderGoals();
  }

  /**
   * 목표판(§5-6) — HUD 상단 3줄. renderTop() 과 같은 결로 돈다('changed' +
   * tickRefresh() 0.15s 주기) — 사냥 중 킬마다 'changed' 가 안 뜨는 것들도
   * (잡기 수 등) 이 주기 덕에 몇 프레임 안에 눈에 붙는다.
   * 3줄: ① 추적 사명 ② 이번 접속 목표 ③ 다음 예고(§5-4 관문 대장 전까지의 대역).
   */
  function renderGoals() {
    if (!els.goalboard) { return; }
    var Q = global.DG.quest;
    if (!Q) { els.goalboard.innerHTML = ''; return; }
    var SC = global.DG.scenario, sh = SC && SC.hint();
    var t = Q.trackedInfo();
    var s = Q.sessionGoalInfo();
    var n = Q.nextInfo();
    els.goalboard.innerHTML =
      (sh ? '<div class="goal-row goal-scn">' + esc(sh.title) + ' — <b>' + esc(sh.text) + '</b></div>' : '') +
      '<div class="goal-row">📋 ' +
        (t ? esc(t.name) + ' <b>' + t.n + '/' + t.goal + '</b>' : '추적 중인 사명이 없습니다') +
      '</div>' +
      '<div class="goal-row goal-sess">⏱️ 이번 접속: ' + esc(s.label) + ' <b>' + s.n + '/' + s.goal + '</b></div>' +
      '<div class="goal-row goal-next">🔜 ' +
        (n ? '다음: ' + esc(n.name) + ' (Lv.' + n.need + ')' : '다음 목표 없음 — 레벨을 올리세요') +
      '</div>';
  }

  /**
   * 지갑의 한 칸. `ic` 를 주면 그 이름의 아이콘으로 갈린다(`icon.js`) —
   * 안 주거나 손잡이를 내리면 이모지가 그대로 남는다.
   */
  function coin(icon, val, label, hi, ic) {
    var tag = ic ? ' data-icon="' + ic + '"' : '';
    return '<div class="coin' + (hi ? ' hi' : '') + '" title="' + label + '"><span' + tag + '>' + icon + '</span>' + val + '</div>';
  }

  /* ── 사냥터 고르는 판 (가운데) ─────────────────────────
   * 사냥 중에는 숨고, 쉬는 동안에만 나온다.
   */

  var campKey = null;
  function renderCamp() {
    if (!els.camp) { return; }
    var S = global.DG.side;
    var st = S.status();
    if (st.active) {
      els.camp.classList.remove('show');
      campKey = null;
      return;
    }
    var pw = S.power();
    var me = S.meRef();
    var bossFlags = st.stages.map(function (e) {
      return e.ref.boss ? (S.bossReady(e.ref.key) ? '1' : '0') : '-';
    }).join('');
    var gateFlags = st.stages.map(function (e) {
      var gi = e.ref.gateBoss ? S.gateInfo(e.ref.key) : null;
      return gi ? (gi.ready ? '1' : (gi.wonThisWeek ? 'w' : 'd')) : '-';
    }).join('');
    var RF = global.DG.rift;
    var key = [core.save.player.level, st.kills, st.deaths, st.potions, st.bosses, bossFlags, gateFlags,
               RF && RF.pending() ? 'r1' : 'r0',
               me && me.id, global.DG.auto.active(), global.DG.auto.status().doing].join('|');
    if (key === campKey) { els.camp.classList.add('show'); return; }
    campKey = key;

    var html = '<div class="camp-card">' +
      '<div class="camp-head"><b>🏕️ 쉬는 중</b>' +
        '<span class="muted">누적 ' + core.fmt(st.kills) + '마리 · 쓰러짐 ' + st.deaths + '</span></div>';
    if (me) {
      html += '<div class="stat-row"><span>' + esc(me.name) + ' 의 몸</span>' +
        '<b>체력 ' + core.fmt(pw.hp) + ' · 공격 ' + core.fmt(pw.atk) + '</b></div>';
    } else {
      html += '<div class="hint">📖 도감에서 인물을 골라 <b>동행에 넣기</b> 하세요 — 그 인물의 몸으로 싸웁니다.</div>';
    }
    var list = st.stages;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var bmark = (e.open && e.ref.boss && S.bossReady(e.ref.key)) ? ' 👺' : '';
      var gi2 = (e.open && e.ref.gateBoss) ? S.gateInfo(e.ref.key) : null;
      html += '<button class="btn ' + (e.open ? (i === 0 ? 'primary' : '') : 'ghost') + ' wide"' +
        (e.open ? '' : ' disabled') + ' data-act="s-enter" data-stage="' + e.ref.key + '">' +
        (e.open ? '🏃 ' : '🔒 ') + esc(e.ref.name) + bmark + (gi2 && gi2.ready ? ' 🏯' : '') +
        (e.open ? '' : ' (Lv.' + e.ref.need + ' 부터)') + '</button>';
      if (gi2 && gi2.ready) {
        html += '<button class="btn tiny ghost wide" data-act="s-gate" data-stage="' + e.ref.key + '">' +
          '🏯 ' + esc(gi2.name) + ' 도전</button>';
      }
    }
    if (RF && RF.available().ok) {
      html += '<button class="btn tiny ghost wide" data-act="rift-open">🌀 비경' +
        (RF.pending() ? ' — 진행 중' : '') + '</button>';
    }
    html += '<div class="camp-auto">' + sectionAuto() + '</div>';
    html += '<small class="muted">쓰러지면 그 판에서 주운 금의 <b>절반만</b> 남습니다. ' +
      '레벨이 오르면 다음 사냥터가 열립니다.</small>';
    els.camp.innerHTML = html + '</div>';
    els.camp.classList.add('show');
  }

  /* ── 아래 조작 띠 (사냥 중) ───────────────────────────── */

  /* 회피 단추 — 짧게 누르면 dodge(), 길게 누르면 직업별 고유 조작(§5-1).
   * click 이 아니라 pointerdown/up 으로 직접 여닫는다(click 을 그대로 두면
   * 누를 때마다 dodge() 가 한 번 더 불려 "회피 + 고유 조작"이 겹친다).
   * DOM 이 renderHudBar() 에서 다시 만들어질 때마다 새로 붙인다. */
  function bindDodgeHold() {
    var btn = document.getElementById('hud-dodge');
    if (!btn) { return; }
    var S = global.DG.side;
    var down = false;
    btn.addEventListener('pointerdown', function (e) {
      down = true; e.preventDefault(); S.holdStart();
    });
    var up = function () { if (down) { down = false; S.holdEnd(); } };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  }

  var hudKey = null;
  function renderHudBar() {
    if (!els.hud) { return; }
    var S = global.DG.side;
    var st = S.status();
    if (!st.active) {
      if (hudKey !== null) { els.hud.classList.remove('show'); els.hud.innerHTML = ''; hudKey = null; }
      if (els.touchpad) { els.touchpad.classList.remove('show'); }
      return;
    }
    var i, sk;
    /* "스킬은 자동으로 써주면 공격 버튼만 보여도 되지 않나?"(사용자, 2026-09-02) —
       나머지 무예는 auto.js 의 tickSkillsOnly 가 조건 맞춰 알아서 쓰므로,
       조작 띠에는 손이 쥐는 "공격"(쿨 가장 짧은 자리) 한 칸만 남긴다. */
    var atkI = st.attackIdx;
    var pty = st.party && st.party.list.length > 1 ? st.party : null;
    var key = st.skills.length + ':' + atkI + ':' + (pty ? pty.list.map(function (m) { return m.id; }).join(',') : '');
    if (hudKey === null || hudKey !== key) {
      var html = '<div class="hud-card">' +
        '<div class="hud-hint" id="hud-hint"></div>' +
        '<div class="hud-skills">';
      if (atkI >= 0 && st.skills[atkI]) {
        sk = st.skills[atkI];
        html += '<button class="hud-sk" data-act="s-skill" data-i="' + atkI + '" title="' +
          esc(sk.name + ' — ' + sk.desc) + '"><b>' + sk.emoji + '</b><u></u></button>';
      }
      if (pty) {
        for (i = 0; i < pty.list.length; i++) {
          var pm = pty.list[i];
          html += '<button class="hud-sk pty" data-act="s-swap" data-i="' + i + '" title="' +
            esc(pm.name + ' — 서명 ' + pm.sig + ' (E: 다음 동료)') + '"><b>' + esc(pm.emoji) + '</b><u></u></button>';
        }
      }
      html += '<button class="hud-sk potion" data-act="s-drink" title="탕약을 마신다 (Q)">' +
        '<b>🧪</b><small class="pn"></small></button>' +
        '<button class="hud-sk" id="hud-dodge" ' +
        'title="회피 — 짧게 (Shift) · 길게 누르면 직업별 고유 조작(§5-1)">' +
        '<b>💨</b><u></u><i class="hold"></i></button>' +
        '<button class="btn tiny ghost hud-out" data-act="s-leave">🚪 나온다</button>' +
        '</div></div>';
      els.hud.innerHTML = html;
      hudKey = key;
      bindDodgeHold();
    }
    var atkBtn = els.hud.querySelector('.hud-sk[data-i="' + atkI + '"]');
    if (atkBtn && atkI >= 0 && st.skills[atkI]) {
      sk = st.skills[atkI];
      atkBtn.classList.toggle('ready', sk.ready);
      atkBtn.querySelector('u').style.height = (sk.cdMax ? (sk.cd / sk.cdMax * 100) : 0) + '%';
    }
    if (pty) {
      var pbs = els.hud.querySelectorAll('.hud-sk.pty');
      for (i = 0; i < pbs.length && i < pty.list.length; i++) {
        var pmm = pty.list[i];
        pbs[i].classList.toggle('active', pmm.active);
        pbs[i].classList.toggle('dead', pmm.dead);
        pbs[i].classList.toggle('ready', !pmm.active && !pmm.dead && pty.cd <= 0);
        /* 어두운 덮개는 잃은 체력만큼 — 쿨다운 칸(u)과 같은 결 */
        pbs[i].querySelector('u').style.height = (pmm.hpMax ? (1 - pmm.hp / pmm.hpMax) * 100 : 100) + '%';
      }
    }
    var dodgeBtn = document.getElementById('hud-dodge');
    if (dodgeBtn && st.dodge) {
      dodgeBtn.classList.toggle('ready', st.dodge.ready);
      dodgeBtn.querySelector('u').style.height =
        (st.dodge.cdMax ? (st.dodge.cd / st.dodge.cdMax * 100) : 0) + '%';
      /* 고유 조작(§5-1) 게이지 — armed 뒤에는 꽉 채워 "터졌다"를 보여 준다.
         st.hold.hasSig 가 거짓(무명)이면 눌러도 그냥 회피만 된다 */
      var hd = st.hold || {};
      var pct = hd.armed ? 100 : (hd.thresh ? Math.min(100, (hd.t / hd.thresh) * 100) : 0);
      dodgeBtn.classList.toggle('armed', !!hd.armed);
      var holdEl = dodgeBtn.querySelector('i.hold');
      if (holdEl) { holdEl.style.width = (hd.hasSig ? pct : 0) + '%'; }
    }
    var pn = els.hud.querySelector('.pn');
    if (pn) { pn.textContent = st.potions; }
    /* 줄·문 안내 — 원작에서 사다리와 포탈 앞에 서면 무엇을 누를지 알려 주는 자리다 */
    var hint = els.hud.querySelector('.hud-hint');
    if (hint) {
      var msg = '';
      /* 폰에는 ↑ 도 Space 도 없다 — 손가락뿐인 기기에는 누를 자리를 알려 준다.
         키보드가 있으면 예전 문구 그대로다(진단 출력도 그래서 안 바뀐다) */
      var UP = core.upHint(), ACT = core.actHint();
      if (st.climbing) { msg = UP + ' ' + core.downHint() + ' 오르내리기 · ' + ACT + ' 손 떼기'; }
      else if (st.talk) { msg = UP + ' 대화를 닫는다'; }
      else if (st.gate) {
        msg = st.gate.open ? (UP + ' → ' + st.gate.name) : ('🔒 ' + st.gate.name + ' — Lv.' + st.gate.need + ' 부터');
      } else if (st.rope) { msg = UP + ' 줄을 탄다'; }
      else if (st.npc) { msg = UP + ' ' + esc(st.npc.name) + '에게 말을 건다'; }
      hint.textContent = msg;
      hint.classList.toggle('show', !!msg);
    }
    els.hud.classList.add('show');
    if (els.touchpad) { els.touchpad.classList.add('show'); }
  }

  /** 마을 사람 대화창(PLAN 16절) — 이름·대사 한 줄 + 닫는다 단추 */
  var talkKey = null;
  function renderTalkBox() {
    if (!els.talkbox) { return; }
    var t = global.DG.side.status().talk;
    if (!t) {
      if (talkKey !== null) { els.talkbox.classList.remove('show'); els.talkbox.innerHTML = ''; talkKey = null; }
      return;
    }
    var key = t.name + '|' + t.text;
    if (key !== talkKey) {
      talkKey = key;
      els.talkbox.innerHTML = '<div class="talk-card">' +
        '<b>' + esc(t.emoji || '💬') + ' ' + esc(t.name) + '</b><p>' + esc(t.text) + '</p>' +
        '<div class="btn-row">' +
          (t.shop ? '<button class="btn tiny primary" data-act="talk-shop">🏪 저자를 연다</button>' : '') +
          '<button class="btn ghost" data-act="talk-close">닫는다</button>' +
        '</div></div>';
    }
    els.talkbox.classList.add('show');
  }

  /** 첫 발 장면(story.js) — 위아래 검은 띠(body.cine) + 초상·감정·대사 한 줄씩.
   *  누르면 다음 줄, 마지막 줄에서 누르면 닫힌다. 건너뛰기는 이 장면만 닫는다 */
  function storyHost() {
    var el = $('storybox');
    if (!el) {                       // 뼈대가 없는 곳(자가진단)에서도 동작하게
      el = document.createElement('div');
      el.id = 'storybox';
      document.body.appendChild(el);
      el.addEventListener('click', function (e) {
        var ST = global.DG.story;
        if (!ST) { return; }
        var b = e.target.closest('[data-act]');
        if (b && b.getAttribute('data-act') === 'story-skip') { ST.skip(); } else { ST.next(); }
      });
    }
    return el;
  }

  function renderStoryBox() {
    var ST = global.DG.story, el = storyHost();
    var c = ST && ST.current();
    document.body.classList.toggle('cine', !!c);
    if (!c) { el.classList.remove('show'); el.innerHTML = ''; return; }
    var SD = global.DG.sideData, ln = c.lines[c.i], who = ln[0];
    var emo = SD.EMOTES[ln[1]] || SD.EMOTES.calm;
    var face, name, SCD = global.DG.scenarioData;
    var mentor = null;
    if ((who === 'mentor' || who === 'mentor+') && global.DG.job) {   // 시나리오 — 전직한 갈래의 스승(도감 가명). 'mentor+' 는 다음 차수(전직 전 장면)
      var ml = global.DG.job.mentors(), jt = (global.DG.job.cur().tier || 0) + (who === 'mentor+' ? 1 : 0);
      mentor = ml.length ? global.DG.data.find(ml[Math.min(Math.max(jt, 1), ml.length) - 1]) : null;
    }
    if (who === 'me') {
      var me = global.DG.side.meRef();
      face = pt('hero', me, 72); name = me.name;
    } else if (mentor) {
      face = pt('hero', mentor, 72); name = mentor.name;
    } else {
      var npc = SD.NPC_TALK[who] || (SCD && SCD.CAST[who]) || { name: '?', emoji: '💬' };
      face = '<span class="story-emoji">' + npc.emoji + '</span>'; name = npc.name;
    }
    el.innerHTML = '<div class="story-title">' + esc(c.title) + '</div>' +
      '<div class="story-card emo-' + esc(ln[1] || 'calm') + (who === 'me' ? ' me' : '') + '">' +
        '<div class="story-face">' + face +
          (emo.mark ? '<i class="story-mark" title="' + esc(emo.name) + '">' + emo.mark + '</i>' : '') +
        '</div>' +
        '<div class="story-say"><b>' + esc(name) + '</b><p>' + esc(ln[2]) + '</p>' +
          '<small class="muted">' + (c.i + 1) + ' / ' + c.lines.length + ' · 누르면 다음</small></div>' +
        '<button class="btn tiny ghost" data-act="story-skip">건너뛰기</button>' +
      '</div>';
    el.classList.add('show');
  }

  /* ── 사냥터 시트 ──────────────────────────────────────── */

  /** 보스가 다시 나오기까지 */
  function bossLeftLabel(ms) {
    var m = Math.ceil(ms / 60000);
    return m >= 60 ? (Math.floor(m / 60) + '시간 ' + (m % 60) + '분') : (m + '분');
  }

  function viewField() {
    var S = global.DG.side;
    var st = S.status();
    var pw = S.power();
    var html = '<div class="sec"><h4>내 몸</h4><div class="card">' +
      '<div class="stat-row"><span>체력</span><b>' + core.fmt(pw.hp) + '</b></div>' +
      '<div class="stat-row"><span>공격력</span><b>' + core.fmt(pw.atk) + '</b></div>' +
      '<div class="stat-row"><span>탕약</span><b>🧪 ' + st.potions + '</b></div>' +
      '<small class="muted">앞에 세운 인물의 능력치가 그대로 몸이 됩니다. ' +
      '도감에서 다른 인물을 앞에 세우거나 승급하면 세집니다.</small></div></div>';

    html += '<div class="sec"><h4>사냥터 <button class="btn tiny ghost" data-act="ow-open" ' +
      'style="float:right;margin-top:-2px">🗺️ 전체 지도 (M)</button></h4>';
    var list = st.stages;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var bossLine = '';
      if (e.ref.boss) {
        var ready = S.bossReady(e.ref.key);
        var left = S.bossLeft(e.ref.key);
        bossLine = '<div class="stat-row"><span class="muted">👺 ' + esc(e.ref.boss.name) + '</span>' +
          '<span style="color:' + (ready ? '#e8c15a' : 'inherit') + '">' +
          (ready ? '지키고 있음' : bossLeftLabel(left) + ' 뒤 다시 나옴') + '</span></div>';
      }
      /* 관문 대장(§5-4) — 마을에만 있다. 주 1회, 지면 내일 다시(일일 1회) */
      var gateLine = '', gateBtn = '';
      var gi = e.open ? S.gateInfo(e.ref.key) : null;
      if (gi) {
        var gstate = gi.wonThisWeek ? '이번 주 완료' : (gi.triedToday ? '내일 다시' : '도전 가능');
        gateLine = '<div class="stat-row"><span class="muted">🏯 ' + esc(gi.name) + '</span>' +
          '<span style="color:' + (gi.ready ? '#e8c15a' : 'inherit') + '">' + gstate + '</span></div>';
        gateBtn = gi.ready
          ? '<button class="btn wide" data-act="s-gate" data-stage="' + e.ref.key + '">🏯 관문 대장에 도전</button>'
          : '';
      }
      html += '<div class="card">' +
        '<div class="stat-row"><span><b>' + (e.ref.town ? '🏘️ ' : '') + esc(e.ref.name) + '</b></span>' +
          '<span class="muted">' + (e.ref.town ? '안전지대 · 쉼터'
            : '적 Lv.' + e.ref.enemyLv + ' · ' + e.ref.spawn + '마리') + '</span></div>' +
        bossLine + gateLine +
        (e.open
          ? '<button class="btn primary wide" data-act="s-enter" data-stage="' + e.ref.key + '">들어간다</button>'
          : '<button class="btn ghost wide" disabled>🔒 Lv.' + e.ref.need + ' 부터</button>') +
        gateBtn +
        '</div>';
    }
    html += '</div>';

    html += viewRiftEntry();
    html += sectionAuto();
    html += viewQuestSection();

    html += '<div class="sec"><h4>규칙</h4><div class="rulelist">' +
      (core.touchOnly()
        ? ('<div><b>이동</b> 화면 좌우 아래의 <b>◀ ▶</b> 단추를 누르고 있으면 걷습니다</div>' +
           '<div><b>▲</b> 점프 — 밧줄·사다리·문 앞에서는 <b>오르기·들어가기</b>가 됩니다</div>' +
           '<div><b>▼</b> 줄에서 내려가고, 가만히 있으면 앉아 쉬고, 발판을 빠져나갑니다</div>')
        : ('<div><b>이동</b> ← → · 점프 Space — 발판은 위에서만 밟힙니다</div>' +
           '<div><b>오르기</b> ↑ 밧줄·사다리 · ↓ 내려가기 · ↓+Space 발판 빠져나가기</div>' +
           '<div><b>문</b> 사냥터 끝의 빛 앞에서 ↑ — 옆 사냥터로 걸어 넘어갑니다 ' +
             '(체력·기력·주운 금은 그대로 이어집니다)</div>')) +
      '<div><b>공격</b> 조작 띠의 단추 ' +
        (core.touchOnly() ? '을 누릅니다' : '· 키 1~8') + '. 기력을 씁니다</div>' +
      '<div><b>탕약</b> ' + (core.touchOnly() ? '🧪 단추' : 'Q') +
        ' — 체력 45% 회복. 잡을 때 가끔 떨어집니다</div>' +
      '<div><b>궁수</b> 활·조총을 든 적은 멀리서 쏘고, 사거리 안에서는 다가오지 ' +
        '않습니다 (❗ 가 뜨면 화살이 옵니다)</div>' +
      '<div><b>쓰러짐</b> 주운 금의 절반만 남습니다 (사냥터는 그대로)</div>' +
      '<div><b>성장</b> 잡으면 경험치. 레벨이 오르면 사냥터가 열립니다</div>' +
      '<div><b>보스</b> 사냥터 <b>오른쪽 끝</b>을 지킵니다. 뜸을 들이다 달려듭니다 — ' +
        '잡으면 경험치·금이 크게 들어오고 탕약 3개를 떨굽니다 (한동안 다시 안 나옵니다)</div>' +
      '</div></div>';
    html = html.replace('<h4>내 몸</h4>', '<h4>내 몸 <small class="muted">— 토벌 ' +
      st.bosses + '회</small></h4>');
    return html;
  }

  /** 📋 사명 — 사냥터 시트 안에 산다 (원작에서도 퀘스트는 따로 도는 축이 아니다) */
  function viewQuestSection() {
    var Q = global.DG.quest;
    if (!Q) { return ''; }
    var list = Q.list();
    var html = '<div class="sec"><h4>📋 사명</h4>';
    if (!list.length) {
      html += '<div class="hint">지금 받을 사명이 없습니다. 레벨이 오르면 새로 뜹니다.</div></div>';
      return html;
    }
    for (var i = 0; i < list.length; i++) {
      var q = list[i], d = q.ref;
      var bits = [];
      if (d.reward.exp) { bits.push('경험치 ' + core.fmt(d.reward.exp)); }
      if (d.reward.gold) { bits.push('🪙 ' + core.fmt(d.reward.gold)); }
      if (d.reward.potion) { bits.push('🧪 ' + d.reward.potion); }
      if (d.reward.scroll) { bits.push('📜 ' + global.DG.gearData.scroll(d.reward.scroll).name); }
      html += '<div class="card' + (q.full ? ' on' : '') + '">' +
        '<div class="stat-row"><span><b>' + esc(d.name) + '</b>' +
          (d.daily ? ' <small class="muted">— 일일 사명' +
            (q.done ? ' · 누적 ' + q.done + '회' : '') + '</small>'
          : d.repeat ? ' <small class="muted">— 되받는 사명' +
            (q.done ? ' · ' + q.done + '회' : '') + '</small>' : '') + '</span>' +
          '<span class="muted">' + (q.taken ? q.n + ' / ' + q.goal : 'Lv.' + d.need) + '</span></div>' +
        '<div class="stat-row"><span class="muted">' + esc(d.desc) + '</span>' +
          '<span class="muted">' + esc(bits.join(' · ')) + '</span></div>' +
        (q.lockedToday
          ? '<button class="btn ghost wide" disabled>✅ 오늘은 이미 마쳤습니다 — 자정이 지나면 다시</button>'
          : q.taken
          ? (q.full
            ? '<button class="btn primary wide" data-act="q-turn" data-q="' + d.key + '">바친다</button>'
            : '<button class="btn ghost wide" disabled>아직 ' + (q.goal - q.n) + ' 남았다</button>')
          : '<button class="btn wide" data-act="q-take" data-q="' + d.key + '">받는다</button>') +
        '</div>';
    }
    html += '<small class="muted">받은 뒤부터 셉니다. 장비·무예·금처럼 <b>보면 알 수 있는 것</b>은 ' +
      '지금 값을 그대로 봅니다.</small></div>';
    return html;
  }

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
        '" data-scroll="' + sc.key + '" title="' + esc(sc.name + ' — ' + sc.desc) + '">📜 ' +
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
      html += '<div class="stat-row"><span>' + sl.emoji + ' ' + esc(sl.name) + '</span>';
      if (it) {
        html += '<span><b>' + esc(G.nameOf(it)) + '</b>' + gradeTag(GD, G.defOf(it)) + ' <small class="muted">' +
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
    html += '<div class="sec"><h4>가방 <small class="muted">' + inv.length + ' / ' + G.BAG +
      '</small></h4>';
    if (!inv.length) {
      html += '<div class="hint">아직 아무것도 없습니다. 적이 가끔 떨구고, 🏪 저자에서도 삽니다.</div>';
    }
    for (i = 0; i < inv.length; i++) {
      var g = inv[i], d = G.defOf(g), on = G.isEquipped(g.uid);
      var canWear = core.save.player.level >= d.need;
      html += '<div class="card' + (on ? ' on' : '') + '">' +
        '<div class="stat-row"><span><b>' + esc(G.nameOf(g)) + '</b>' + gradeTag(GD, d) +
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
        html += '<div class="stat-row"><span>📜 ' + esc(sc[i].name) + '</span>' +
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
    html += '<div class="sec"><h4>캔 것</h4>';
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

  /** 🥋 무예 — 전직과 스킬 트리. 원작의 스킬창 자리다 */
  function viewJob() {
    var J = global.DG.job, JD = global.DG.jobData;
    var me = J.cur(), left = J.spLeft();
    var i, html = '';

    html += '<div class="sec"><h4>지금 자리</h4><div class="card">' +
      '<div class="stat-row"><span>' + me.emoji + ' <b>' + esc(me.name) + '</b></span>' +
        '<span class="muted">Lv.' + core.save.player.level + '</span></div>' +
      '<div class="stat-row"><span class="muted">' + esc(me.desc) + '</span>' +
        '<b>무예 점수 ' + left + '</b></div>' +
      '<small class="muted">점수는 레벨마다 ' + JD.SP_PER_LEVEL + '점씩 늘어납니다 ' +
        '(쓴 것 ' + J.spSpent() + ' / 모두 ' + J.spTotal() + '). ' +
        '<b>찍은 무예만 조작 띠에 놓입니다.</b></small>' +
      (me.key !== 'none'
        ? '<div class="btn-row"><button class="btn ghost" data-act="j-reset">🔄 전직을 되돌린다</button></div>'
        : '') +
      '</div></div>';

    /* 고유 조작 + 스승(§5-1) — 회피를 길게 눌러 쓰는 조작 하나와, 1~4차 전직마다
       하나씩 만난 스승 넷. 스승 중 하나라도 도감(등용)에 있으면 수치가 오른다. */
    var sig = J.signature();
    if (sig) {
      var mlist = J.mentors(), dex = core.save.dex.heroes;
      html += '<div class="sec"><h4>고유 조작 <small class="muted">— 회피를 길게 누르면</small></h4>' +
        '<div class="card">' +
        '<div class="stat-row"><span>' + sig.emoji + ' <b>' + esc(sig.name) + '</b></span>' +
          '<span class="muted">기력 ' + sig.cost + ' · 쿨 ' + sig.cd + 's</span></div>' +
        '<div class="stat-row"><span class="muted">' + esc(sig.desc) + '</span>' +
          '<b>' + (sig.boost ? '🎓 스승 보정 ON' : '스승 보정 OFF') + '</b></div>' +
        '<div class="mentor-row">' +
        mlist.map(function (id, mi) {
          var h = data.find(id);
          if (!h) { return ''; }
          var got = !!dex[id];
          return '<div class="mentor-chip' + (got ? ' on' : '') + '">' + pt('hero', h, 40) +
            '<small>' + (mi + 1) + '차 · ' + esc(h.name) + (got ? ' ✅' : '') + '</small></div>';
        }).join('') +
        '</div></div></div>';
    }

    /* 전직 */
    var nexts = JD.nextJobs(me.key);
    if (nexts.length) {
      html += '<div class="sec"><h4>전직 <small class="muted">— 오르는 것 자체는 그대로지만, ' +
        '위 "전직을 되돌린다"로 무명에 돌아가 다른 길을 다시 고를 수 있습니다</small></h4>';
      for (i = 0; i < nexts.length; i++) {
        var nj = nexts[i], why = J.canJoin(nj.key);
        html += '<div class="card"><div class="stat-row">' +
          '<span>' + nj.emoji + ' <b>' + esc(nj.name) + '</b></span>' +
          '<span class="muted">Lv.' + nj.need + ' 부터</span></div>' +
          '<div class="stat-row"><span class="muted">' + esc(nj.desc) + '</span>' +
            '<span class="muted">체력 +' + (nj.grow ? nj.grow.hp : 0) +
            ' · 공격 +' + (nj.grow ? nj.grow.atk : 0) +
            (nj.grow && nj.grow.mp ? ' · 기력 +' + nj.grow.mp : '') + '</span></div>' +
          (why
            ? '<button class="btn ghost wide" disabled>🔒 ' + esc(why) + '</button>'
            : '<button class="btn primary wide" data-act="j-join" data-job="' + nj.key +
              '">이 길로 간다</button>') +
          '</div>';
      }
      html += '</div>';
    }

    /* 무예 목록 — 유파(§5-2)별로 묶는다. 띠(bar)에 같은 유파가 2/4개 있으면
       그 유파 전체(무예 카드 + 아래 조작 띠 슬롯)가 색을 받는다(.set2/.set4) */
    var mine = JD.skillsOf(me.key).filter(function (s) { return s.max > 0; });
    var active = J.activeSchools();
    html += '<div class="sec"><h4>무예</h4>';
    if (!mine.length) {
      html += '<div class="hint">아직 익힐 무예가 없습니다. <b>Lv.10</b> 에 전직하면 열립니다 — ' +
        '그때까지는 연참·횡소·기탄·기합 넷을 씁니다.</div>';
    }
    var groups = JD.SCHOOLS.filter(function (s) {
      return mine.some(function (m) { return m.school === s.id; });
    });
    for (var gi = 0; gi < groups.length; gi++) {
      var def = groups[gi], tier = active[def.id] || 0;
      html += '<div class="school-head' + (tier ? ' set' + tier : '') + '">' +
        '<b>' + esc(def.name) + ' 유파</b> <span class="muted">— ' +
        (tier ? tier + '세트 발동 중' : '띠에 2개면 소효과, 4개면 대효과') + '</span></div>';
      var list = mine.filter(function (s) { return s.school === def.id; });
      for (i = 0; i < list.length; i++) {
        var sk = list[i], lv = J.levelOf(sk.key), why2 = J.canRaise(sk.key);
        var mul = J.mulOf(sk);
        html += '<div class="card' + (lv > 0 ? ' on' : '') + (tier ? ' set' + tier : '') + '">' +
          '<div class="stat-row"><span>' + sk.emoji + ' <b>' + esc(sk.name) + '</b></span>' +
            '<b>' + lv + ' / ' + sk.max + '</b></div>' +
          '<div class="stat-row"><span class="muted">' + esc(sk.desc) + '</span>' +
            '<span class="muted">기력 ' + sk.cost + ' · 쿨 ' + sk.cd + 's</span></div>' +
          (lv > 0 && sk.mul[0]
            ? '<div class="stat-row"><span class="muted">지금 힘</span><b>공격력 ×' +
              mul.toFixed(2) + '</b></div>'
            : '') +
          '<div class="btn-row">' +
            (why2
              ? '<button class="btn tiny ghost" disabled>' + esc(why2) + '</button>'
              : '<button class="btn tiny primary" data-act="j-raise" data-skill="' + sk.key +
                '">＋ 한 점 붓는다</button>') +
          '</div></div>';
      }
    }
    html += '</div>';

    /* 지금 조작 띠 */
    var bar = J.bar();
    html += '<div class="sec"><h4>조작 띠</h4><div class="card">';
    for (i = 0; i < bar.length; i++) {
      var bDef = bar[i].school ? JD.schoolDef(bar[i].school) : null;
      var bTier = bDef ? (active[bDef.id] || 0) : 0;
      html += '<div class="stat-row' + (bTier ? ' set' + bTier : '') + '"><span>' + (i + 1) + ' · ' +
        bar[i].emoji + ' ' + esc(bar[i].name) +
        (bDef ? ' <small class="muted">[' + esc(bDef.name) + ']</small>' : '') +
        '</span><span class="muted">' +
        (bar[i].max ? '레벨 ' + J.levelOf(bar[i].key) : '고정') + '</span></div>';
    }
    var onNames = Object.keys(active).map(function (id) {
      var d = JD.schoolDef(id);
      return (d ? d.name : id) + ' ' + active[id] + '세트';
    });
    if (onNames.length) {
      html += '<div class="stat-row"><span class="muted">지금 켜진 세트</span><b>' +
        onNames.join(' · ') + '</b></div>';
    }
    html += '<small class="muted">키 1~8 · 화면 아래 단추. 자리가 여덟을 넘으면 ' +
      '<b>윗자리 무예부터</b> 놓입니다 — 4차까지 열리면 한 갈래가 열다섯입니다.</small></div></div>';
    return html;
  }

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


  /* ── 인물 · 펫 상세 ───────────────────────────────────────
   * 도감 카드에서 열린다. 능력치는 hero.breakdown() 이 계산해 준 값만 보여준다.
   */

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

  /* ── 오버월드 전체 지도 (2026-09-02, M키식 토글) ─────────────
   * 지금 어디 있는지 + 마을(🏘️)·사냥터(⚔️)가 어떤 순서로 이어지는지 한눈에.
   * 걸어서 문을 통해 실제로 오가는 것과는 별개로, 상태만 보여 주는 읽기 전용 판이다. */
  var OW_CHAIN = ['sinya', 'heodo', 'field', 'gangneungjin', 'forest',
                  'namjeongseong', 'cave', 'gisanchae', 'gorge', 'ruin', 'deepcave'];

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
        (open ? (stg.town ? '<small>안전지대</small>' : '<small>적 Lv.' + stg.enemyLv + '</small>')
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

  function renderDetail() {
    if (!openDetailRef) { return; }
    var host = detailHost();
    var ref = data.find(openDetailRef.id);
    if (!ref) { closeDetail(); return; }
    host.innerHTML = openDetailRef.kind === 'pet' ? detailPet(ref) : detailHero(ref);
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
        '<img class="dt-portrait" alt=""' + p3tag('hero', h, 150, 172) + p3h.done + ' src="' +
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
        '<div class="dt-line"><span>인물 됨됨이</span><b>' + core.fmt(hero().power(h.id)) + '</b></div>';

      out += '<div class="dt-pet"><span>🐾 펫</span>' +
        '<select data-equip="' + h.id + '">' + petOptions(h.id) + '</select>' +
        (bk.pet ? '<small class="muted">' + esc(bk.pet.name) + ' · ' +
          statKor(bk.pet.bonus.stat) + ' +' + bk.pet.bonus.value + '</small>'
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
          ' · 🪙 ' + core.fmt(cost.gold) + '</button>';
      }
      if (net().online()) {
        out += '<button class="btn wide" data-act="dt-talk" data-id="' + h.id + '">💬 말을 건다 (사관)</button>';
      }
      out += (inParty
        ? '<button class="btn ghost wide" data-act="drop" data-id="' + h.id + '">동행에서 뺀다</button>'
        : '<button class="btn wide"' + (core.save.party.length >= 5 ? ' disabled' : '') +
          ' data-act="join" data-id="' + h.id + '">동행에 넣는다' +
          (core.save.party.length >= 5 ? ' (가득 찼음)' : '') + '</button>');
      out += '</div>' +
        '<small class="muted dt-tip">맨 앞에 세운 인물이 <b>내 몸</b>이 됩니다 — 그 능력치로 싸웁니다. ' +
        '승급은 중복분과 금을 씁니다.</small>';
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

  function detailPet(p) {
    var d = core.save.dex.pets[p.id];
    var owned = !!d;
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
      '<div class="dt-line"><span>장착 보정</span><b>' + statKor(p.bonus.stat) + ' +' + p.bonus.value + '</b></div>' +
      '<p class="dt-bio">' + esc(p.desc || '') + '</p>' +
      '<small class="muted dt-tip">펫은 인물에게 하나씩 장착합니다. 인물 상세 화면에서 고르세요.</small>' +
      '</div>';
  }

  /* ── 토스트 ───────────────────────────────────────────── */

  var toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, 2600);
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
