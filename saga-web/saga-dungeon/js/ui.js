/**
 * UI — 프로필 / 재화 / 근처 대상 / 시트(서당·도감·사관·기록) / 상세 / 토스트
 * ---------------------------------------------------------------
 * 사가고 본편(위치 기반 수집 게임 형태) 화면. 던전·전투·장비 UI 는 js/_expansion/ 으로 뺐고,
 * 경영(영지·태수·건설)은 게임에서 아예 제거했다 (v1.0-full 커밋 94850f8 에 이력이 남아 있다).
 */
/**
 * 화면 — 사가블로(원작식)
 * ---------------------------------------------------------------
 * 지도를 걷는 게임(deungyong-go)의 ui.js 에서 갈라져 나왔다. 도감·상세·승급·
 * 서당 화면은 그대로 쓰고, 지도에 매달린 것(근처 대상·구역 이름·이동 거리)만
 * 걷어냈다. 대신 이 게임의 첫 화면인 **본영(本營)** 을 여기서 그린다.
 *
 * 네 게임은 완전히 별개 프로젝트다 — 여기서 고친 것이 다른 게임에 가지 않는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var data = global.DG.data;

  var els = {};
  var openTab = null;          // 열려 있는 시트 이름 (null 이면 닫힘)
  var dexEra = 'all';          // 도감 인물 era 필터(§5.7 시대 퓨전) — 'all'|'past'|'modern'|'future'
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
   * CC0 모델이 없는 펫)에서는 빈 문자열이라 **여태 그림이 그대로 남는다**.
   * 2026-09-04 — 펫(`pet`)도 받는다. 신수·창작 짐승(옛 오마주)는 `portrait3d.js`의
   * `PET_ASSET` 표에 없어 실패로 캐시되고 이 그림 그대로 남는다(조용한 되돌림).
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
    ['profile', 'wallet', 'camp', 'autobar', 'loadbar', 'dock', 'dock-more', 'sheet',
     'sheet-title', 'sheet-body', 'sheet-close', 'scrim', 'toast', 'goals'].forEach(function (id) {
      els[id] = $(id);
    });
    if (els.loadbar && !els.loadbar.firstChild) { els.loadbar.innerHTML = '<i></i>'; }

    els.dock.addEventListener('click', function (e) {
      if (e.target.closest('#dock-more-btn')) { toggleMore(); return; }
      var b = e.target.closest('[data-sheet]');
      if (!b) { return; }
      closeMore();
      var name = b.getAttribute('data-sheet');
      /* 오버월드 지도(🧭)는 옆으로 미는 시트가 아니라 M키와 같은 펼친 지도다 —
         encOpen()으로 여는 별개 창이라 openTab 상태를 건드리지 않는다. */
      if (name === 'overworld') { openOverworldMap(); return; }
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
    global.addEventListener('keydown', function (e) {
      if (e.key === 'm' || e.key === 'M') {
        /* 입력칸에 타이핑하는 중이면 지도를 가로채지 않는다 */
        var t = e.target, tag = t && t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') { return; }
        toggleOverworldMap();
        return;
      }
      if (e.key !== 'Escape') { return; }
      if (els['dock-more'] && els['dock-more'].classList.contains('show')) { closeMore(); return; }
      if (openDetailRef) { closeDetail(); return; }
      if (openTab) { closeSheet(); }
    });

    /* 목표판(§5.6) — 폰 폭에서는 첫 줄만 보이다가 탭하면 셋 다 펼쳐진다.
       css 가 실제 접고 펴는 일을 한다(넓은 화면은 처음부터 셋 다 보인다). */
    if (els.goals) {
      els.goals.addEventListener('click', function (e) {
        /* 숨김·보임 단추(✕ / 🎯 칩)는 폰의 접고 펴기와 별개다 — 상태는 손잡이 ui.goalsHidden(세이브)에 남는다 */
        var hb = e.target && e.target.closest ? e.target.closest('[data-goals]') : null;
        if (hb) {
          core.setTune('ui.goalsHidden', hb.getAttribute('data-goals') === 'hide' ? 1 : null);
          renderGoals();
          return;
        }
        els.goals.classList.toggle('open');
      });
    }

    /* 본영(첫 화면)의 버튼들 — 시트와 같은 data-act 규칙을 쓴다 */
    els.camp.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) { return; }
      handleAct(b.getAttribute('data-act'), b);
    });

    els['sheet-body'].addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) { return; }
      handleAct(b.getAttribute('data-act'), b);
    });
    /* 음량 슬라이더 — 끌 때마다(input) 바로 듣고, 값칸은 다시 그리지 않고 직접
       고쳐 슬라이더가 손 밑에서 튀지 않게 한다(전체 renderSheet() 는 안 부른다) */
    els['sheet-body'].addEventListener('input', function (e) {
      var el = e.target, act = el.getAttribute('data-act');
      if (act === 'snd-vol') {
        var SF = global.DG.sfx;
        if (!SF) { return; }
        var v = SF.setVolume((parseInt(el.value, 10) || 0) / 100);
        var lbl = el.nextElementSibling;
        if (lbl) { lbl.textContent = Math.round(v * 100) + '%'; }
      }
      if (act === 'shake-set') {
        var sv = parseFloat(el.value);
        if (isNaN(sv)) { return; }
        core.save.settings.shake = Math.max(0, Math.min(2, sv));
        core.persist();
        var slbl = el.nextElementSibling;
        if (slbl) { slbl.textContent = '×' + core.save.settings.shake; }
      }
    });

    /* 마을 창(역참·결사비)의 눌림도 시트와 같은 data-act 결을 따른다 */
    var enc = $('encounter');
    if (enc) {
      enc.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) { return; }
        handleAct(b.getAttribute('data-act'), b);
      });
    }

    bindTown();
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
      if (act === 'enc-close') { encClose(); return; }
      if (act === 'goals-card-close') { encClose(); return; }
      if (act === 'key-remap') {
        var DV0 = global.DG.dungeonView;
        if (DV0 && DV0.beginRemap) { DV0.beginRemap(b.getAttribute('data-action')); renderSheet(); }
        return;
      }
      if (act === 'snd-toggle') {
        var SF0 = global.DG.sfx;
        if (SF0) { SF0.setEnabled(!SF0.enabled()); renderSheet(); }
        return;
      }
      if (act === 'vib-toggle') {
        var SF2 = global.DG.sfx;
        if (SF2) { SF2.setVibrateEnabled(!SF2.vibrateEnabled()); renderSheet(); }
        return;
      }
      if (act === 'gq-set') {
        var D30 = global.DG.dungeon3d;
        if (D30 && D30.set) { D30.set('dg3d.quality', b.getAttribute('data-level')); renderSheet(); }
        return;
      }
      if (act === 'hitstop-toggle') {
        core.save.settings.hitstop = core.save.settings.hitstop === false;
        core.persist();
        renderSheet();
        return;
      }
      if (act === 'quest-reroll') { global.DG.quest.reroll(); return; }
      if (act === 'dex-era') { dexEra = b.getAttribute('data-era') || 'all'; renderSheet(); return; }
      if (act === 'town-wp') {
        var wf = parseInt(b.getAttribute('data-floor'), 10) || 1;
        encClose();
        closeSheet();
        if (global.DG.town) { global.DG.town.leave(); }
        global.DG.dungeon.enter({ floor: wf });
        return;
      }
      if (act === 'town-travel') {
        var tid = b.getAttribute('data-town');
        if (global.DG.town && global.DG.town.travelToTown(tid)) {
          var tname = global.DG.town.nameOf(tid);
          encClose();
          toast('🗺️ ' + tname + '로 이동했습니다');
        }
        return;
      }
      if (act === 'town-mode') {
        global.DG.dungeon.setMode(b.getAttribute('data-mode'));
        openWaypoint();
        return;
      }
      if (act === 'town-vow') {
        global.DG.dungeon.setHardcore();
        openVow();
        return;
      }
      if (act === 'town-horde') {
        var DH = global.DG.dungeon, TH = global.DG.town;
        encClose();
        closeSheet();
        if (TH) { TH.leave(); }
        DH.enterHorde();
        return;
      }
      if (act === 'gate-normal') {
        var DG1 = global.DG.dungeon, TG1 = global.DG.town;
        encClose();
        closeSheet();
        if (TG1) { TG1.leave(); }
        DG1.enter({ floor: 1 });
        return;
      }
      if (act === 'gate-trial') {
        var DG3 = global.DG.dungeon, TG3 = global.DG.town;
        var tlv = parseInt(b.getAttribute('data-lv'), 10);
        encClose();
        closeSheet();
        if (TG3) { TG3.leave(); }
        if (!DG3.enterTrial(tlv)) { toast('⚠️ 그 단계는 아직 열리지 않았습니다'); }
        return;
      }
      if (act === 'gate-sigil') {
        var DG2 = global.DG.dungeon, TG2 = global.DG.town;
        var sid = b.getAttribute('data-id');
        encClose();
        closeSheet();
        if (TG2) { TG2.leave(); }
        if (!DG2.enterNightmare(sid)) { toast('⚠️ 그 부적을 쓸 수 없습니다'); }
        return;
      }
      if (act === 'field-merchant-buy') {
        var fmi = parseInt(b.getAttribute('data-idx'), 10);
        var row2 = fieldMerchantStock && fieldMerchantStock[fmi];
        if (!row2) { return; }
        var IT2 = global.DG.item;
        if (core.save.player.gold < row2.price) { toast('🪙 금이 모자랍니다'); return; }
        if (IT2.bag().length >= IT2.bagCap()) { toast('🎒 봇짐이 가득 찼습니다'); return; }
        core.save.player.gold -= row2.price;
        IT2.add(row2.item);
        fieldMerchantStock.splice(fmi, 1);
        var SF2 = global.DG.sfx;
        if (SF2) { SF2.play('coin'); }
        core.log('🧺 ' + IT2.name(row2.item) + ' 을(를) 샀다 · 금 -' + core.fmt(row2.price), 'info');
        core.emit('changed');
        if (!fieldMerchantStock.length) { encClose(); fieldMerchantStock = null; }
        else { renderFieldMerchant(); }
        return;
      }
      if (act === 'field-merchant-leave') {
        fieldMerchantStock = null;
        encClose();
        return;
      }
      if (act === 'dg-enter') {
        global.DG.dungeon.enter({ floor: parseInt(b.getAttribute('data-floor'), 10) || 1 });
      } else if (act === 'dg-leave') {
        global.DG.dungeon.leave();
      } else if (act === 'gear-equip') {
        var owner = b.getAttribute('data-hero');
        if (owner) { global.DG.item.equip(owner, id); }
        else { toast('장착할 인물이 없습니다'); }
      } else if (act === 'gear-off') {
        global.DG.item.unequip(b.getAttribute('data-hero'), b.getAttribute('data-slot'));
      } else if (act === 'gear-sell') {
        var got = global.DG.item.sell(id);
        if (got) { toast('🪙 매각 · +' + core.fmt(got)); }
      } else if (act === 'gear-lock') {
        global.DG.item.toggleLock(id);
      } else if (act === 'gear-clean') {
        var r = global.DG.item.autoClean();
        toast(r.sold ? '🧹 ' + r.sold + '점 정리 · 금 +' + core.fmt(r.gold) : '정리할 것이 없습니다');
      } else if (act === 'gear-sel') {
        gearSel = (gearSel === id) ? null : id;
      } else if (act === 'skill-hero') {
        skillHero = b.getAttribute('data-hero');
        skillSlotPick = null;
      } else if (act === 'skill-slot') {
        var si2 = parseInt(b.getAttribute('data-idx'), 10);
        skillSlotPick = (si2 < 0 || skillSlotPick === si2) ? null : si2;
      } else if (act === 'skill-learn') {
        var lr = global.DG.skill.learn(skillHero, b.getAttribute('data-key'));
        if (!lr.ok) {
          toast(lr.reason === 'point' ? '점수가 없습니다 — 인물이 더 커야 합니다'
              : lr.reason === 'max' ? '더 올릴 수 없습니다'
              : lr.reason === 'prereq' ? (lr.need.name + ' 을(를) 먼저 배웁니다')
              : '배울 수 없습니다');
        }
      } else if (act === 'skill-secret') {
        /* 비결(§5.9) — 같은 것을 다시 누르면 푼다 */
        var sr = global.DG.secret.set(skillHero, b.getAttribute('data-key'), b.getAttribute('data-sec'));
        if (!sr.ok) { toast(sr.reason === 'rank' ? sr.need + '단이 되어야 열린다' : '걸 수 없습니다'); }
        else if (sr.key) { var sdd = global.DG.secret.byKey(sr.key); toast(sdd.emoji + ' 비결 「' + sdd.name + '」 — ' + sdd.desc); }
      } else if (act === 'skill-set') {
        if (skillSlotPick !== null) {
          global.DG.skill.setSlot(skillHero, skillSlotPick, b.getAttribute('data-key'));
          skillSlotPick = null;
        }
      } else if (act === 'skill-respec') {
        var cost = global.DG.vendor.respecCost(skillHero);
        if (core.save.player.gold < cost) { toast('금이 모자랍니다'); }
        else {
          core.save.player.gold -= cost;
          var back = global.DG.skill.respec(skillHero);
          toast('\u21BA ' + back + '점을 돌려받았습니다 · 금 -' + core.fmt(cost));
        }
      } else if (act === 'gear-tab') {
        gearTab = b.getAttribute('data-tab');
        gearSel = null;
      } else if (act === 'gear-repair' || act === 'gear-repairall') {
        var it3 = global.DG.item;
        var rr = act === 'gear-repair' ? it3.repair(id) : it3.repairAll();
        if (!rr.ok) {
          toast(rr.reason === 'gold' ? '금이 모자랍니다'
              : rr.reason === 'full' ? '닳은 것이 없습니다' : '없는 물건입니다');
        } else {
          toast('\uD83D\uDD27 수리 · 금 -' + core.fmt(rr.cost));
        }
      } else if (act === 'gear-stash' || act === 'gear-unstash') {
        var it2 = global.DG.item;
        var mr = act === 'gear-stash' ? it2.toStash(id) : it2.fromStash(id);
        if (!mr.ok) {
          toast(mr.reason === 'dungeon' ? '던전 안에서는 창고가 열리지 않습니다'
              : mr.reason === 'full' ? '자리가 없습니다' : '없는 물건입니다');
        } else { gearSel = null; }
      } else if (act === 'gear-hero') {
        gearHero = b.getAttribute('data-hero');
      } else if (act === 'gear-auto') {
        global.DG.item.autoEquip();
        toast('✨ 더 나은 장비로 갈아입혔습니다');
      } else if (act === 'dg-hardcore') {
        /* 되돌릴 수 없는 일이니 한 번 더 묻는다 */
        if (global.confirm('결사(決死)로 바꿉니다. 쓰러지면 이 판이 끝나고 다시 내려갈 수 없습니다. 되돌릴 수 없습니다.')) {
          global.DG.dungeon.setHardcore();
          toast('☠️ 결사 — 이제 쓰러지면 끝입니다');
        }
      } else if (act === 'dg-mode') {
        if (!global.DG.dungeon.setMode(b.getAttribute('data-mode'))) {
          toast('아직 열리지 않았습니다');
        }
      } else if (act === 'craft-pick') {
        /* 재료를 고른다 (다음에 장비를 고르면 박힌다) */
        craftMat = { kind: b.getAttribute('data-kind'), key: b.getAttribute('data-key'),
                     g: parseInt(b.getAttribute('data-g'), 10) || 0 };
      } else if (act === 'craft-cancel') {
        craftMat = null;
      } else if (act === 'craft-into') {
        if (!craftMat) { toast('먼저 박을 것을 고르세요'); }
        else {
          var cr = global.DG.item.socket(id, craftMat.kind, craftMat.key, craftMat.g);
          if (!cr.ok) {
            toast(cr.reason === 'nosocket' ? '빈 구멍이 없습니다' : '박을 수 없습니다');
          } else if (cr.word) {
            toast('《' + cr.word.name + '》 이 이루어졌습니다');
          }
          if (global.DG.item.matCount(craftMat.kind, craftMat.key, craftMat.g) < 1) {
            craftMat = null;
          }
        }
      } else if (act === 'craft-tab') {
        craftTab = b.getAttribute('data-tab');
      } else if (act === 'vendor-tab') {
        vendorTab = b.getAttribute('data-tab');
      } else if (act === 'forge-make') {
        var fr = global.DG.forge.make(b.getAttribute('data-id'));
        if (!fr.ok) {
          toast(fr.reason === 'gem' ? '완(完) 보석이 모자랍니다'
              : fr.reason === 'top' ? '더 올릴 곳이 없습니다' : '재료가 모자랍니다');
        } else if (fr.kept === false) {
          toast('가방이 차서 그 자리에서 금으로 바꿨습니다');
        }
      } else if (act === 'vendor-buy' || act === 'vendor-back') {
        var V2 = global.DG.vendor;
        var vr = act === 'vendor-buy' ? V2.buy(id) : V2.buyBack(id);
        if (!vr.ok) {
          toast(vr.reason === 'gold' ? '금이 모자랍니다'
              : vr.reason === 'bag' ? '가방이 찼습니다 \u2014 먼저 비우세요'
              : '이미 나간 물건입니다');
        }
      } else if (act === 'vendor-sell') {
        var sr = global.DG.vendor.sell(id);
        if (!sr.ok) {
          toast(sr.reason === 'lock' ? '\uD83D\uDD12 잠긴 물건입니다' : '없는 물건입니다');
        } else {
          toast('\uD83E\uDE99 매각 · +' + core.fmt(sr.gold) + ' (되사기에 남습니다)');
        }
      } else if (act === 'gear-ident') {
        var ir = global.DG.item.identify(id);
        if (!ir.ok) { toast(ir.reason === 'scroll' ? '감정서가 없습니다' : '감정할 수 없습니다'); }
        else { toast('\uD83D\uDD0E ' + global.DG.item.name(ir.item)); }
      } else if (act === 'gear-identall') {
        var ar = global.DG.item.identifyAll();
        toast(ar.done ? ('\uD83D\uDD0E ' + ar.done + '점 감정' +
                         (ar.left ? ' · ' + ar.left + '점 남음 (감정서 부족)' : ''))
                      : '감정서가 없습니다');
      } else if (act === 'vendor-scroll') {
        var scr = global.DG.vendor.buyScroll(parseInt(b.getAttribute('data-n'), 10) || 1);
        if (!scr.ok) { toast('금이 모자랍니다'); }
      } else if (act === 'vendor-potion') {
        var pr = global.DG.vendor.buyPotion(b.getAttribute('data-kind'),
                                            parseInt(b.getAttribute('data-g'), 10));
        if (!pr.ok) {
          toast(pr.reason === 'gold' ? '금이 모자랍니다'
              : pr.reason === 'belt' ? '요대가 찼습니다' : '살 수 없습니다');
        }
      } else if (act === 'vendor-gamble') {
        var gr2 = global.DG.vendor.gamble(parseInt(b.getAttribute('data-idx'), 10));
        if (!gr2.ok) {
          toast(gr2.reason === 'gold' ? '금이 모자랍니다'
              : gr2.reason === 'bag' ? '가방이 찼습니다 \u2014 먼저 비우세요'
              : '이미 나간 물건입니다');
        } else {
          toast((gr2.tier >= 3 ? '\uD83C\uDF89 ' : '\uD83C\uDFB2 ') +
                global.DG.item.tierOf(gr2.item).name + ' \u00B7 ' +
                global.DG.item.name(gr2.item));
        }
      } else if (act === 'auto-on') {
        global.DG.auto.toggle();
      } else if (act === 'auto-flag') {
        global.DG.auto.toggleFlag(b.getAttribute('data-flag'));
      } else if (act === 'look-style') {
        core.save.appearance.styleSeed = parseInt(b.getAttribute('data-n'), 10) || 0;
        if (global.DG.dungeon3d) { global.DG.dungeon3d.refreshMe(); }
      } else if (act === 'look-tint') {
        core.save.appearance.tint = b.getAttribute('data-hex');
        if (global.DG.dungeon3d) { global.DG.dungeon3d.refreshMe(); }
      } else if (act === 'look-reset') {
        core.save.appearance.styleSeed = 0;
        core.save.appearance.tint = null;
        if (global.DG.dungeon3d) { global.DG.dungeon3d.refreshMe(); }
      } else { return; }
      core.persist(); renderSheet(); renderTop(); renderCamp();
    }
  }

  /** 도감 완성 — PLAN 34절 "도감 완성 보상도 추가한다". 인물·펫 전원을
   *  등록하면(마지막 한 명이 `dex:new` 를 낼 때) 딱 한 번만 큰 보상을 준다.
   *  `core.save.dex.<cat>Full` 로 지급 여부를 기억한다 — 다 채운 뒤로는
   *  풀에 남는 후보가 없어 그 쪽 `dex:new` 자체가 다시 안 나지만, 혹시라도
   *  같은 이벤트가 두 번 들어와도 이 깃발이 중복 지급을 막는다. */
  var DEX_COMPLETE = {
    heroes:  { gold: 3000, feat: 100, label: '인물' },
    pets:    { gold: 1500, feat: 60,  label: '펫' },
    regions: { gold: 800,  feat: 30,  label: '지역' },
    relics:  { gold: 1200, feat: 50,  label: '유적' },
    boons:   { gold: 1200, feat: 50,  label: '은사첩' }
  };
  function dexTotal(cat) {
    if (cat === 'heroes') { return data.heroes.length; }
    if (cat === 'pets') { return data.pets.length; }
    if (cat === 'regions') { return (global.DG.dungeonData && global.DG.dungeonData.THEMES.length) || 0; }
    if (cat === 'relics') { return (global.DG.town && global.DG.town.fieldRelics) ? global.DG.town.fieldRelics().length : 0; }
    if (cat === 'boons') { return (global.DG.dungeonData && global.DG.dungeonData.BOONS.length) || 0; }
    return 0;
  }
  function checkDexComplete(cat) {
    var cfg = DEX_COMPLETE[cat];
    if (!cfg) { return; }
    var total = dexTotal(cat);
    var owned = Object.keys(core.save.dex[cat] || {}).length;
    if (!total || owned < total || core.save.dex[cat + 'Full']) { return; }
    core.save.dex[cat + 'Full'] = true;
    core.save.player.gold += cfg.gold;
    core.gainFeat(cfg.feat, '도감 완성');
    core.log('📖 도감 완성 · ' + cfg.label + ' 전원 등록! 공적 +' + cfg.feat + ' · 금 +' + cfg.gold, 'good');
    core.emit('toast', '🏆 도감 완성(' + cfg.label + ')! 공적 +' + cfg.feat + ' · 금 +' + cfg.gold);
    core.emit('changed');
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
    core.on('changed', function () { renderTop(); renderSheet(); renderCamp(); renderGoals(); });
    core.on('goals:card', showGoalsCard);
    core.on('dg:keyremap', function () { if (openTab === 'keys') { renderSheet(); } });
    core.on('dungeon:skill', function (v) {
      if (typeof v === 'string' && v.indexOf('sig:') === 0) { sigCutin(v.slice(4)); }
    });
    core.on('dex:new', function (p) {
      var ent = data.find(p.id);
      if (ent) { toast('📖 도감 신규 등록 · ' + ent.name); }
      checkDexComplete(p.cat);
    });

    renderTop(); renderCamp(); renderGoals();
  }

  /* ── 시트 ─────────────────────────────────────────────── */

  var SHEET_TITLE = {
    party: '⚔️ 부대', gear: '🎒 장비', craft: '🔨 세공', skill: '📜 무예', vendor: '\uD83E\uDDFA 행상', dex: '📖 도감', log: '📜 기록', world: '🗺️ 월드맵',
    quest: '🚩 퀘스트', look: '🧑 외모', keys: '⌨️ 키설정', settings: '⚙️ 설정'
  };

  /** 2026-09-10 — 효과음·그래픽 품질(사가스토리 PLAN §30과 같은 결).
   *  이 판엔 아직 BGM이 없어(그 모듈 자체가 없다) 그 줄은 뺐다 — 나중에
   *  생기면 그때 얹는다. **2026-09-14 — 진동은 sfx.js에 손잡이가 생겨
   *  더했다**(지원하는 기기에서만 보인다, 아래 vibrateSupported() 참고). */
  var QUALITY_LABEL = { auto: '자동', low: '낮음', medium: '보통', high: '높음' };
  function viewSettings() {
    var SF = global.DG.sfx, D3 = global.DG.dungeon3d;
    if (!SF) { return '<div class="hint">소리 모듈을 찾을 수 없습니다</div>'; }
    var on = SF.enabled(), vol = Math.round(SF.volume() * 100);
    var vibRow = '';
    if (SF.vibrateSupported && SF.vibrateSupported()) {
      var von = SF.vibrateEnabled();
      vibRow = '<div class="key-row"><b>진동</b>' +
        '<button data-act="vib-toggle">' + (von ? '켜짐' : '꺼짐') + '</button></div>';
    }
    var gq = '';
    if (D3 && D3.active && D3.active()) {
      var cur = D3.tuned('dg3d.quality', 'auto'), lv;
      gq = '<div class="key-row"><b>그래픽 품질</b><span class="key-cur">' +
        (cur === 'auto' ? '자동(' + QUALITY_LABEL[D3.quality()] + ')' : QUALITY_LABEL[cur]) +
        '</span></div><div class="key-row" style="gap:6px">';
      for (lv in QUALITY_LABEL) {
        if (!Object.prototype.hasOwnProperty.call(QUALITY_LABEL, lv)) { continue; }
        gq += '<button class="btn tiny' + (cur === lv ? ' primary' : ' ghost') +
          '" data-act="gq-set" data-level="' + lv + '">' + QUALITY_LABEL[lv] + '</button>';
      }
      gq += '</div><div class="hint">낮음일수록 그림자를 끄고 화면 해상도를 줄여 가벼워집니다. ' +
        '자동은 실제 프레임 속도를 보고 스스로 오갑니다.</div>';
    }
    /* §5.8① 손맛 손잡이(2026-09-18, 멀미 배려) — 화면 흔들림 0~2, 타격 정지 on/off */
    var s = core.save.settings;
    var shakeV = typeof s.shake === 'number' ? s.shake : 1;
    var hitstopOn = s.hitstop !== false;
    return '<div class="hint keyhint">이동 키는 ⌨️ 키설정에 있습니다.</div>' +
      '<div class="key-row"><b>효과음</b>' +
        '<button data-act="snd-toggle">' + (on ? '켜짐' : '꺼짐') + '</button></div>' +
      '<div class="key-row"><b>음량</b>' +
        '<input type="range" min="0" max="100" value="' + vol + '" data-act="snd-vol"' +
        (on ? '' : ' disabled') + '>' +
        '<span class="key-cur">' + vol + '%</span></div>' +
      vibRow + gq +
      '<div class="key-row"><b>화면 흔들림</b>' +
        '<input type="range" min="0" max="2" step="0.5" value="' + shakeV + '" data-act="shake-set">' +
        '<span class="key-cur">×' + shakeV + '</span></div>' +
      '<div class="key-row"><b>타격 정지</b>' +
        '<button data-act="hitstop-toggle">' + (hitstopOn ? '켜짐' : '꺼짐') + '</button></div>' +
      '<div class="hint">멀미가 있으면 화면 흔들림을 0으로, 타격 정지를 꺼짐으로 두세요.</div>';
  }

  /** 2026-09-09 — 이동 키 다시 지정. WASD·방향키는 코드에 그대로 박혀 있고
   *  (실수로 못 쓰게 되지 않게), 여기서는 그 옆에 하나 더 쓸 키만 고른다. */
  function viewKeys() {
    var DV = global.DG.dungeonView;
    if (!DV || !DV.keymap) { return '<div class="hint">지금 화면에서는 키를 지정할 수 없습니다</div>'; }
    var km = DV.keymap(), rm = DV.remapping();
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

  /* 세공에서 지금 고른 재료 (화면 상태라 세이브에 남기지 않는다) */
  var craftMat = null;

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
    var inMore = false;
    for (var i = 0; i < bs.length; i++) {
      var on = bs[i].getAttribute('data-sheet') === openTab;
      bs[i].classList.toggle('on', on);
      if (on && els['dock-more'] && els['dock-more'].contains(bs[i])) { inMore = true; }
    }
    var moreBtn = $('dock-more-btn');
    if (moreBtn) { moreBtn.classList.toggle('on', inMore); }
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
    /* 자동 순행은 본영 카드에 있었다. 카드를 없애면서 **군교**에게 옮겼다 —
       부대를 맡기는 일이니 부대 시트가 그 자리다 */
    var v = openTab === 'party' ? (viewParty() + sectionAuto())
          : openTab === 'gear' ? (gearSection() || '<div class="hint">장비 모듈이 없습니다</div>')
          : openTab === 'craft' ? viewCraft()
          : openTab === 'vendor' ? viewVendor()
          : openTab === 'skill' ? viewSkill()
          : openTab === 'dex' ? viewDex()
          : openTab === 'world' ? viewWorldMap()
          : openTab === 'quest' ? viewQuest()
          : openTab === 'look' ? viewLook()
          : openTab === 'keys' ? viewKeys()
          : openTab === 'settings' ? viewSettings() : viewLog();
    els['sheet-body'].innerHTML = v;
  }

  /* ── 상단 ─────────────────────────────────────────────── */

  function renderTop() {
    var p = core.save.player;
    var need = core.expNeed(p.level);
    var pct = Math.round(p.exp / need * 100);
    var st = global.DG.dungeon.status();

    els.profile.innerHTML =
      '<div class="avatar" style="--p:' + pct + '%"><i>🕳️</i></div>' +
      '<div class="p-meta">' +
        '<div class="p-title">' + titleOf(p.featTotal) + ' · Lv.' + p.level + '</div>' +
        '<div class="p-sub">' +
          (st.active ? '⚔️ 제' + st.floor + '층 · 체력 ' + st.hp + '/' + st.hpMax
                     : '🏯 마을 · 최고 제' + (st.best || 0) + '층') +
          ' · 동행 <b>' + core.save.party.length + '</b>명</div>' +
      '</div>';

    els.wallet.innerHTML =
      coin('🪙', core.fmt(p.gold), '금', false, 'coins') +
      coin('🎖️', core.fmt(p.fame), '명성', false, 'medal') +
      coin('🏅', core.fmt(p.feat), '공적', true, 'award') +
      coin('📜', core.fmt(core.save.items.scroll), '등용서', false, 'scroll') +
      coin('🍖', core.fmt(core.save.items.feed), '사료', false, 'ham');
    /* 지갑은 값이 바뀔 때마다 다시 그려지므로 그릴 때마다 한 번 훑는다 */
    if (global.DG.icon) { global.DG.icon.sweep(els.wallet); }
  }

  /** 목표판(§5.6) — 지금·이번 세션·이번 주 세 줄. 폰에서는 첫 줄만 보이다가
   *  탭하면 펼쳐진다(css .goals.open). */
  /** 시나리오(scenario.js) 지금 할 일 한 줄 — 목표판 맨 윗줄 */
  function scnRow() {
    var SC = global.DG.scenario, h = SC && SC.hint();
    return h ? '<div class="goal-row"><span class="gi">📖</span><span class="gl">' + esc(h.title) + ' — <b>' + esc(h.text) + '</b></span></div>' : '';
  }

  function renderGoals() {
    if (!els.goals) { return; }
    var G = global.DG.goals;
    if (!G) { return; }
    /* 숨겨 두면 작은 칩 하나만 남는다 — 눌러 다시 펼친다(화면이 좁거나 목표판이 커서 거슬릴 때) */
    var hidden = core.tuned('ui.goalsHidden', 0) ? true : false;
    els.goals.classList.toggle('goals-hidden', hidden);
    if (hidden) {
      els.goals.innerHTML = '<button class="goal-chip" data-goals="show" title="목표판 다시 보기">🎯 목표판 ▸</button>';
      return;
    }
    var L = G.lines();
    function row(icon, l) {
      return '<div class="goal-row"><span class="gi">' + icon + '</span>' +
        '<span class="gl">' + esc(l.label) + '</span>' +
        '<span class="gp">' + l.progress + '/' + l.target + '</span></div>';
    }
    els.goals.innerHTML =
      '<button class="goal-hide" data-goals="hide" title="목표판 숨기기">✕</button>' +
      scnRow() + row('⏱️', L.now) + row('🎯', L.session) + row('📅', L.weekly);
  }

  /** 세션 카드 — 탈출·사망·마을 귀환 대신 이 판은 dungeon:end 하나로 셋을
   *  다 잡는다(집에 오는 유일한 길이 굴혈에서 나오는 것뿐이라). 탭 닫기는
   *  goals.js 가 조용히 세션만 마감하고 카드는 안 띄운다(볼 사람이 없다). */
  function showGoalsCard(card) {
    if (!card || card.reason === 'hidden') { return; }
    /* 난입(§5.5) — "층" 이 아니라 "생존 시간"으로 읽는다. 완주(horde)든
       도중 사망(dead + hordeSecs)이든 부제줄은 같은 결이다. */
    var isHorde = card.hordeSecs != null;
    /* 부적 던전(§5.3) — 완주(nightmare)·시간초과(nightmare-fail)·도중
       사망(dead + nmTier) 셋 다 "층" 대신 "티어"로 읽는다. */
    var isNm = card.nmTier != null;
    /* 시련(§5.11) — 완주(trial)·시간 초과(trial-fail) */
    var isTrial = card.trialLv != null;
    var title = card.reason === 'trial' ? '🏆 시련 완주!' :
      card.reason === 'trial-fail' ? '⏱️ 시련 · 시간 초과' :
      card.reason === 'horde' ? '🏆 난입 완주!' :
      isHorde ? '💀 난입 · 쓰러졌다' :
      card.reason === 'nightmare' ? '📜 부적 던전 완주!' :
      card.nmFail ? '⏱️ 부적 던전 · 시간 초과' :
      isNm ? '💀 부적 던전 · 쓰러졌다' :
      card.reason === 'leave' ? '🚪 던전에서 나왔다' : '💀 패퇴했다';
    var sub = isTrial ? ('제' + card.trialLv + '단계' + (card.trialSec != null ? ' · ' + core.fmtTime(card.trialSec) : '') +
        (card.trialRank ? ' · 순위 ' + card.trialRank + '위' : '') + (card.trialOpen ? ' · 제' + card.trialOpen + '단계까지 열림' : '')) :
      isHorde ? (Math.floor(card.hordeSecs / 60) + '분 ' + (card.hordeSecs % 60) + '초 생존') :
      isNm ? ('티어 ' + card.nmTier + (card.nmNext ? ' · 다음 부적 획득' : '')) :
      ('제' + card.floor + '층까지');
    var html = '<div class="enc-card">' +
      '<h3 style="margin:0 0 4px;font-size:18px">' + title + '</h3>' +
      '<small class="muted">' + sub + '</small>' +
      '<div class="sec">';
    if (card.nmFail) {
      html += '<div class="hint">시간을 못 맞춰 그 방까지의 노획물을 못 챙겼습니다 — 부적은 이미 썼습니다.</div>';
    } else if (card.reason === 'leave' || card.reason === 'horde' || card.reason === 'nightmare' ||
               card.reason === 'trial' || card.reason === 'trial-fail') {
      html += '<div>💰 금 ' + (card.gold >= 0 ? '+' : '') + core.fmt(card.gold) + '</div>' +
        '<div>📦 장비 ' + (card.items || 0) + '점</div>';
    } else {
      var toGrave = (card.lostGold || card.lostItems) &&
        card.next && card.next.indexOf('유품 회수') >= 0;
      html += '<div>💰 ' + (toGrave ? '유품으로 남은 금' : '잃은 금') + ' ' +
        core.fmt(card.lostGold || 0) + '</div>' +
        '<div>📦 ' + (toGrave ? '유품으로 남은 장비' : '잃은 장비') + ' ' +
        (card.lostItems || 0) + '점</div>';
    }
    html += '<div>🏅 공적 +' + (card.feat || 0) + '</div>' +
      '<div>📖 도감 ' + card.dexPct + '%</div>' +
      '</div>' +
      '<div class="sec"><h4>다음 할 것</h4><div>' + esc(card.next) + '</div></div>' +
      '<button class="btn primary wide" data-act="goals-card-close">확인</button></div>';
    encOpen(html);
  }

  /** §5.8③ 서명 무예 컷인(2026-09-18) — 발동 0.4초 동안 인물 초상을 잠깐
   *  보여준다. `portrait3d.js`는 정지 이미지를 굽는 유틸일 뿐 애니메이션
   *  API가 없어 재사용할 게 없었다 — 대신 기존 2D 초상(`sprite.portraitCard`,
   *  §5.1 카드·도감이 이미 쓰는 것과 같은 함수)을 얹고 CSS 페이드만 준다.
   *  2D·3D 어느 화면이든 같은 HUD 오버레이라 렌더러와 무관하게 여기 둔다. */
  var sigCutinEl = null, sigCutinTimer = null;
  function sigCutin(heroId) {
    var S = global.DG.sprite;
    var h = data.find(heroId);
    if (!h || !S) { return; }
    if (!sigCutinEl) {
      sigCutinEl = document.createElement('div');
      sigCutinEl.id = 'sig-cutin';
      sigCutinEl.style.cssText = 'position:fixed;left:12px;bottom:120px;width:64px;height:74px;' +
        'border-radius:8px;overflow:hidden;pointer-events:none;z-index:60;opacity:0;' +
        'transition:opacity 0.12s ease-out;box-shadow:0 4px 16px rgba(0,0,0,.5)';
      var img = document.createElement('img');
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      sigCutinEl.appendChild(img);
      document.body.appendChild(sigCutinEl);
    }
    sigCutinEl.firstChild.src = (global.DG.portrait3d && global.DG.portrait3d.of('hero', h, 128, 148)) || S.portraitCard('hero', h, 128, 148);   // 구운 초상(§11 Phase 1)이 있으면 코드 그림 대신
    sigCutinEl.style.opacity = '1';
    if (sigCutinTimer) { global.clearTimeout(sigCutinTimer); }
    sigCutinTimer = global.setTimeout(function () {
      if (sigCutinEl) { sigCutinEl.style.opacity = '0'; }
    }, 400);
  }

  /**
   * 지갑의 한 칸. `ic` 를 주면 그 이름의 아이콘으로 갈린다(`icon.js`) —
   * 안 주거나 손잡이를 내리면 이모지가 그대로 남는다.
   */
  function coin(icon, val, label, hi, ic) {
    var tag = ic ? ' data-icon="' + ic + '"' : '';
    return '<div class="coin' + (hi ? ' hi' : '') + '" title="' + label + '"><span' + tag + '>' + icon + '</span>' + val + '</div>';
  }

  /**
   * 마을 상단 띠(#top)의 실제 높이는 고정이 아니다 — 두 줄(프로필·도구 / 지갑)인데
   * 지갑 칸 수·폭에 따라 늘어난다. `#dg-minimap`(diablo.css, town-open 전용 규칙)이
   * 그걸 모른 채 매직넘버로 박혀 있으면 지갑 줄과 겹친다(실기기 신고로 잡았다,
   * 사가고 `ui.js`의 `syncHeaderStack`과 같은 요령) — 매 갱신마다 실제로 재서
   * CSS 변수로 넘긴다.
   */
  function syncHeaderStack() {
    if (!els.wallet) { return; }
    var bottom = Math.ceil(els.wallet.getBoundingClientRect().bottom);
    if (bottom > 0) { document.documentElement.style.setProperty('--below-header', bottom + 'px'); }
  }

  /**
   * 마을 GLB 로딩 표시(2026-09-07, "화면이 까맣게 보인다" 대응) — 집·사람 모델이
   * 다 실리기 전엔 플레이스홀더 도형만 서 있어 실기기에서 "깨졌다"로 보였다.
   * `asset3d.stats()`(도착한 URL 수 / 요청한 URL 수)를 얇은 띠로만 보여준다 —
   * 마을이 아닐 때(던전 안)는 안 띄운다, 자산 자체를 안 켰으면(GLB_ON 꺼짐 등)
   * total 이 0 이라 곧바로 사라진다.
   */
  function renderLoadbar() {
    var bar = els.loadbar;
    if (!bar) { return; }
    var AS3 = global.DG.asset3d;
    var inTown = document.body.classList.contains('town-open');
    if (!inTown || !AS3) { bar.classList.remove('show'); return; }
    var s = AS3.stats();
    if (!s.total || s.pending <= 0) { bar.classList.remove('show'); return; }
    var pct = Math.max(4, Math.round((s.loaded + s.failed) / s.total * 100));
    bar.firstChild.style.width = pct + '%';
    bar.classList.add('show');
  }

  /* ── 마을 ────────────────────────────────────────────
   * 예전에는 이 자리에 **본영 카드** 한 장을 그렸다. 층을 버튼으로 고르고
   * 난도를 버튼으로 골랐다. 그 카드는 지웠다 — 마을(town.js)이 그 자리를
   * 대신하기 때문이다. 원작에서 바깥은 메뉴가 아니라 **장소**다.
   *
   *   고르다 → 가다
   *   난도 · 밟은 층   →  역참 🌀
   *   결사(決死)       →  결사비 ☠️
   *   자동 순행        →  군교(부대 시트 아래)
   *   진입             →  굴혈 입구 🕳️
   *
   * 같은 것을 두 군데 두면 반드시 어긋난다. 그래서 옮기고 지웠다.
   */
  function renderCamp() {
    if (!els.camp) { return; }
    els.camp.classList.remove('show');
    if (els.camp.innerHTML) { els.camp.innerHTML = ''; }
    /* 마을이 켜진 동안에는 캔버스가 곧 화면이다. 그때 캔버스를 맨 아래로 내리고
       (상단·독이 그 위에 떠야 볼일을 본다) 조작판을 숨긴다 — 돌리는 것은
       css 쪽이다(body.town-open). */
    var T = global.DG.town;
    document.body.classList.toggle('town-open', !!(T && T.active()));
  }

  /* ── 마을에서 닿은 것 ──────────────────────────────────
   * town.js 는 "닿았다" 만 알린다. 그것이 무엇을 뜻하는지는 여기서 정한다 —
   * 마을은 시트를 모르고, 이 파일은 좌표를 모른다.
   */
  /** 시대 손님 사연 — 닿을 때마다 네 토막을 차례로, 끝 토막에 금 한 번(세이브 `folkStory[이름]`). 다 들었으면 false(예전 대사로) */
  function folkStory(o) {
    var sv = core.save, n;
    if (!sv.folkStory || typeof sv.folkStory !== 'object') { sv.folkStory = {}; }
    n = sv.folkStory[o.name] || 0;
    if (n >= o.story.length) { return false; }
    sv.folkStory[o.name] = n + 1;
    var gold = global.DG.town && global.DG.town.FOLK_STORY_GOLD || 0, last = n + 1 === o.story.length;
    if (last) { sv.player.gold = (sv.player.gold || 0) + gold; core.persist(); }
    toast(o.emoji + ' ' + o.name + ' — ' + o.story[n] + ' (사연 ' + (n + 1) + '/' + o.story.length + ')' + (last ? ' · 🪙 +' + core.fmt(gold) : ''));
    return true;
  }

  function bindTown() {
    core.on('town:npc', function (o) {
      /* 들판 방랑 상인(PLAN §60 후보 1 나머지 절반) — 마을 붙박이 NPC와
         달리 시트가 아니라 #encounter 카드로 재고를 고른다(아래
         openFieldMerchant). 대사도 sheet도 없어 일반 갈래로는 못 받는다. */
      if (o.key === 'fieldmerchant') { openFieldMerchant(o); return; }
      /* 세 시대 손님(§5.20) — 볼일(시트) 없이 말만 한다. 대사는 닿을 때마다 돌아간다 */
      if (!o.sheet) {
        if (o.story && o.story.length && folkStory(o)) { return; }          // 시대 손님 사연(정본 side_visitors) — 말 걸 때마다 한 토막씩
        var ln = o.lines && o.lines.length ? o.lines[(o.talkN = ((o.talkN || 0) + 1)) % o.lines.length] : o.line;
        toast(o.emoji + ' ' + o.name + ' — ' + ln);
        return;
      }
      toast(o.emoji + ' ' + o.name + ' — ' + o.line);
      openSheet(o.sheet);
    });
    core.on('town:mark', function (o) {
      /* 굴혈은 마을방 안 고정 표식이 아니라 들길 하나(exit_dungeon)다 —
         이 마을 자체의 enterGate()로 보낸다. 'gate' 키는 옛 마크(이제 안
         세워짐)를 위해 그대로 남겨 둔다(해 될 것 없다). 다른 마을로 건너
         가는 표식은 PLAN §28-8(오픈월드 A안)부터 아예 없다 — 걸어서
         발판에 들어서면 활성 마을이 저절로 갈린다(travel() 은퇴). */
      if (o.key === 'gate' || o.key === 'exit_dungeon') { enterGate(); }
      else if (o.key === 'waypoint') { openWaypoint(); }
      else if (o.key === 'horde') { openHorde(); }
      /* 길 위의 발견거리(PLAN §60 후보 2) — 창을 안 띄운다. 토스트만
         뜨고 그 자리에서 바로 보상까지 끝난다(town.js rewardRoadMark). */
      else if (o.roadMark) { global.DG.town.rewardRoadMark(o); }
      /* 필드 유적(PLAN §60 후보 4) — 도감 'relics'에 등록되며 같은 결로 끝난다. */
      else if (o.fieldRelic) { global.DG.town.rewardFieldRelic(o); }
      /* 지워진 이름의 비석(정본 side_names_*) — 마을마다 한 번 기록·보상 */
      else if (o.nameStone) { global.DG.town.rewardNameStone(o); }
      /* 세계 보스 예고(§5.4) — 순전히 알림이다. 밟아도 여는 창이 없다. */
      else if (o.worldBossNotice) { toast('⚠️ 세계 보스가 곧 나타납니다'); }
      else { openVow(); }
    });
    /* 장면이 바뀌는 순간 곧바로 다시 그린다. tickRefresh(0.3초)를 기다리면
       조작판이 숨은 채로 던전이 시작해서 눈에 띈다. */
    core.on('town:enter', renderCamp);
    core.on('dungeon:enter', renderCamp);
    core.on('dungeon:end', renderCamp);
  }

  /**
   * 굴혈(窟穴) 입구 — 원작의 던전 입구다. 예전엔 "고르는 창이 없다" 고
   * 적혀 있었다(제1층부터 바로 내려갔다) — §5.3(부적 던전, 2026-09-18)이
   * 그 전제를 깼다. 이제 밟으면 일반/부적 중 고르는 카드가 한 장 뜬다.
   * 깊은 층으로 뛰어넘는 것은 여전히 역참의 일이다.
   */
  function enterGate() {
    var D = global.DG.dungeon;
    if (D.fallen()) {
      toast('☠️ 결사로 스러진 판입니다 — 상단 👤 에서 새 이름으로');
      return;
    }
    if (!core.save.party.length) {
      toast('⚠️ 부대가 없습니다 — 군교 ⚔️ 에게 먼저 가세요');
      return;
    }
    openGateChoice();
  }

  /** 일반 던전(제1층부터)과 부적 던전(§5.3, 가진 부적만큼) 중 고른다 */
  function openGateChoice() {
    var IT = global.DG.item;
    var sigs = IT.sigils();
    var html = '<div class="enc-card">' +
      '<h3 style="margin:0 0 4px;font-size:18px">🕳️ 굴혈(窟穴)</h3>' +
      '<small class="muted">어느 길로 내려갈지 고릅니다.</small>' +
      '<button class="btn wide" style="margin-top:10px" data-act="gate-normal">' +
      '🕳️ 일반 던전 · 제1층부터</button>';
    if (sigs.length) {
      /* 변형자는 부적 seed 로 결정적이라(§5.3) 쓰기 전에 미리 보여줄 수
         있다 — 어떤 부적을 쓸지 고르는 데 그게 핵심 정보다. */
      var DD2 = global.DG.dungeonData;
      html += '<div class="sec"><h4>📜 부적 던전</h4>';
      for (var i = 0; i < sigs.length; i++) {
        var sg = sigs[i], preview = DD2 ? DD2.rollMods(sg.seed) : null;
        var modTxt = preview ? preview.mods.map(function (k) {
          var m = DD2.modByKey(k); return m ? m.emoji : '';
        }).join(' ') : '';
        html += '<button class="btn wide ghost" data-act="gate-sigil" data-id="' + sg.id + '" ' +
          'style="text-align:left">티어 <b>' + sg.tier + '</b> 부적' +
          (modTxt ? ' <span style="float:right">' + modTxt + '</span>' : '') + '</button>';
      }
      html += '</div>';
    } else {
      html += '<div class="hint">부적이 없습니다 — 던전 제10층+ 보스나 난입(§5.5) 15분 완주에서 얻습니다.</div>';
    }
    html += trialGateHtml();
    html += '<button class="btn primary wide" data-act="enc-close">물러난다</button></div>';
    encOpen(html);
  }

  /**
   * 시련(試鍊, §5.11) — 대균열식 시간 도전. 열린 단계 가운데 위쪽 셋을 단추로,
   * 순위표(상위 5)를 아래에. 제10층을 밟기 전엔 문턱만 말한다.
   */
  function trialGateHtml() {
    var D = global.DG.dungeon, info = D && D.trialInfo ? D.trialInfo() : null;
    if (!info) { return ''; }
    var html = '<div class="sec"><h4>⏳ 시련(試鍊) · 15분 시간 도전</h4>';
    if (!info.ready) {
      return html + '<div class="hint">던전 제' + info.need + '층을 밟으면 열립니다.</div></div>';
    }
    html += '<div class="hint">진척 막대를 채우면 수호자가 나옵니다 — 쓰러뜨리면 전설 한 점. ' +
      '절반 넘게 남기면 두 단계가 열립니다. 쓰러지면 30초를 잃습니다.</div>';
    for (var lv = info.open; lv >= Math.max(1, info.open - 2); lv--) {
      html += '<button class="btn wide ghost" data-act="gate-trial" data-lv="' + lv + '" style="text-align:left">' +
        '제 <b>' + lv + '</b> 단계' + (lv === info.open ? ' <small class="muted">(새 단계)</small>' : '') +
        '<span style="float:right">적 ×' + (Math.round((1 + 0.35 * lv) * 100) / 100) + '</span></button>';
    }
    if (info.board.length) {
      html += '<div style="font-size:11.5px;margin-top:4px"><b>순위표</b>';
      info.board.slice(0, 5).forEach(function (r, i) {
        var h = global.DG.data && global.DG.data.find ? global.DG.data.find(r.hero) : null;
        html += '<div class="muted">' + (i + 1) + '위 · 제' + r.lv + '단계 · ' + core.fmtTime(r.sec) +
          (h ? ' · ' + esc(h.name) : '') + (r.deaths ? ' · 💀' + r.deaths : '') + '</div>';
      });
      html += '</div>';
    }
    return html + '</div>';
  }

  /**
   * 역참(驛站) — 원작의 웨이포인트. 밟으면 **밟아 둔 곳**이 목록으로 뜬다.
   * 가 보지 않은 층은 뜨지 않는다 — 그게 웨이포인트의 전부다.
   * 난도도 여기서 고른다(예전에는 본영 카드에 있었다).
   */
  function openWaypoint() {
    var D = global.DG.dungeon, T = global.DG.town;
    var wp = D.waypoint(), every = D.WAYPOINT_EVERY;
    var open = D.modesOpen(), cur = D.mode(), mi, f;
    var html = '<div class="enc-card">' +
      '<h3 style="margin:0 0 4px;font-size:18px">🌀 역참(驛站)</h3>' +
      '<small class="muted">' + every + '층마다 밟습니다. 밟아 둔 곳으로 곧장 갑니다.</small>' +
      '<div class="sec"><h4>난도</h4><div class="bagtools">';
    for (mi = 0; mi < D.MODES.length; mi++) {
      var md = D.MODES[mi];
      var opened = open.indexOf(md) >= 0;
      html += '<button class="btn tiny ' +
        (cur.key === md.key ? 'primary' : (opened ? '' : 'ghost')) + '"' +
        (opened ? '' : ' disabled') +
        ' data-act="town-mode" data-mode="' + md.key + '"' +
        ' title="' + esc(md.desc) + '">' + esc(md.name) +
        (opened ? '' : ' 🔒 제' + md.need + '층') + '</button>';
    }
    html += '</div><small class="muted">' + esc(cur.desc) + '</small></div>' +
      '<div class="sec"><h4>어디로</h4>';
    if (wp >= every) {
      for (f = every; f <= wp; f += every) {
        html += '<button class="btn wide" data-act="town-wp" data-floor="' + f + '">' +
          '🪜 제' + f + '층으로</button>';
      }
    } else {
      html += '<div class="hint">아직 밟은 역참이 없습니다 — <b>제' + every +
        '층</b>에 닿으면 여기 뜹니다. 굴혈 🕳️ 로 들어가서 밟으십시오.</div>';
    }
    html += '</div>';
    /* 2026-09-08 — "다른 마을 가기가 너무 불편해"(사용자). 마을 사이는
       여전히 걸어서 이어지지만(§28-8), 이미 가 본 마을은 역참으로 곧장
       갈 수 있게 한다 — 원작 웨이포인트가 "밟은 곳만" 여는 것과 같은 규칙. */
    if (T && T.visitedTownIds) {
      var vids = T.visitedTownIds();
      html += '<div class="sec"><h4>🗺️ 다른 마을로</h4>';
      if (vids.length) {
        for (var vi = 0; vi < vids.length; vi++) {
          html += '<button class="btn wide" data-act="town-travel" data-town="' + vids[vi] + '">' +
            '🏘️ ' + esc(T.nameOf(vids[vi])) + '로</button>';
        }
      } else {
        html += '<div class="hint">아직 가 본 다른 마을이 없습니다 — 걸어서 한 번 닿으면 여기 뜹니다.</div>';
      }
      html += '</div>';
    }
    html += '<button class="btn primary wide" data-act="enc-close">닫는다</button></div>';
    encOpen(html);
  }

  /** 결사비(決死碑) — 원작의 하드코어. 켜면 못 끈다. 그래서 한 번 묻는다 */
  function openVow() {
    var D = global.DG.dungeon;
    var html = '<div class="enc-card">' +
      '<h3 style="margin:0 0 4px;font-size:18px">☠️ 결사비(決死碑)</h3>';
    if (D.fallen()) {
      html += '<div class="hint warn">이 판은 <b>결사로 스러졌습니다.</b> ' +
        '더 내려갈 수 없습니다 — 상단 👤 에서 새 이름으로 시작하세요.</div>';
    } else if (D.hardcore()) {
      html += '<div class="hint">이미 <b>결사(決死)</b> 입니다. 쓰러지면 이 판이 끝납니다.</div>';
    } else {
      html += '<small class="muted">비석에 이름을 새기면 <b>되돌릴 수 없습니다.</b> ' +
        '쓰러지는 순간 이 판이 끝납니다 — 그 대신 무엇도 더 드리지 않습니다. ' +
        '원작의 하드코어가 정확히 그러합니다.</small>' +
        '<button class="btn wide ghost" data-act="town-vow">☠️ 이름을 새긴다</button>';
    }
    html += '<button class="btn primary wide" data-act="enc-close">물러난다</button></div>';
    encOpen(html);
  }

  /** 난입(亂入, §5.5) — 방 하나에서 파도를 버틴다. 결사비와 달리 되돌릴
   *  것도 없어(15분이거나 죽음이거나) 확인만 가볍게 받는다. */
  function openHorde() {
    var D = global.DG.dungeon;
    var hs = D.state().horde || { best: 0, runs: 0 };
    var html = '<div class="enc-card">' +
      '<h3 style="margin:0 0 4px;font-size:18px">⚔️ 난입(亂入)</h3>' +
      '<small class="muted">방 하나에 파도가 30초마다 밀려옵니다. 15분을 버티거나, ' +
      '쓰러질 때까지. 레벨이 오를 때마다(처치 기준) 그 자리에서 하나를 고릅니다.</small>' +
      '<div class="sec"><div>🏆 최고 기록 ' + (hs.best ? Math.floor(hs.best / 60) + '분 ' +
      (hs.best % 60) + '초' : '없음') + '</div><div>🔁 도전 ' + (hs.runs || 0) + '회</div></div>';
    if (D.fallen()) {
      html += '<div class="hint warn">이 판은 결사로 스러졌습니다 — 새 이름으로 시작하세요.</div>';
    } else if (!core.save.party.length) {
      html += '<div class="hint warn">부대가 없습니다 — 먼저 인물을 등용하세요.</div>';
    } else {
      html += '<button class="btn wide ghost" data-act="town-horde">⚔️ 시작한다</button>';
    }
    html += '<button class="btn primary wide" data-act="enc-close">물러난다</button></div>';
    encOpen(html);
  }

  /** 들판 방랑 상인(PLAN §60 후보 1 나머지 절반) — 마주치면 그 자리에서
   *  재고 셋을 굴려 산다. 재고는 `js/dungeon.js`의 `rollMerchantStock`을
   *  그대로 빌려 쓰되(값 매기는 규칙까지 같이), 상태는 `run.merchantChoice`가
   *  아니라 이 파일이 독자로 들고 있는다 — town.js는 이 상인을 dungeon.js의
   *  `run`과 무관하게 자기 필드에서 만나기 때문이다. */
  var fieldMerchantStock = null;
  function openFieldMerchant(npc) {
    var T = global.DG.town, D = global.DG.dungeon;
    if (T && T.consumeFieldMerchant) { T.consumeFieldMerchant(npc); }
    fieldMerchantStock = D.rollMerchantStock(0);
    var SF = global.DG.sfx;
    if (SF) { SF.play('shrine'); }
    renderFieldMerchant();
  }
  function renderFieldMerchant() {
    var IT = global.DG.item;
    var html = '<div class="enc-card"><h3 style="margin:0 0 4px;font-size:18px">' +
      '🧺 방물장수(方物匠手) · 살 것을 고른다</h3>' +
      '<small class="muted">지나가던 사람입니다 — 여기서만 만납니다.</small>' +
      '<div class="sec" style="margin-top:10px">';
    if (!fieldMerchantStock || !fieldMerchantStock.length) {
      html += '<div class="hint">다 팔렸습니다.</div>';
    } else {
      for (var i = 0; i < fieldMerchantStock.length; i++) {
        var row = fieldMerchantStock[i], t = IT.tierOf(row.item);
        var afford = core.save.player.gold >= row.price;
        html += '<button class="btn wide" style="text-align:left;margin-bottom:6px" ' +
          'data-act="field-merchant-buy" data-idx="' + i + '"' + (afford ? '' : ' disabled') + '>' +
          '<b style="color:' + t.color + '">' + IT.name(row.item) + '</b>' +
          ' <small>' + t.name + '</small>' +
          '<span style="float:right">🪙 ' + core.fmt(row.price) + '</span>' +
          '</button>';
      }
    }
    html += '</div><button class="btn primary wide" data-act="field-merchant-leave">떠난다</button></div>';
    encOpen(html);
  }

  /** 마을 창 한 장 — #encounter 를 쓴다 (도움말 창과 같은 자리) */
  function encOpen(html) {
    var el = $('encounter');
    if (!el) { return; }
    el.innerHTML = html;
    el.classList.add('show');
  }

  function encClose() {
    var el = $('encounter');
    if (!el) { return; }
    el.classList.remove('show');
    el.innerHTML = '';
  }

  /* ── 부대 ─────────────────────────────────────────────── */

  function viewParty() {
    var party = core.save.party, html = '', i;
    var pw = hero().partyPower();
    html += '<div class="sec"><h4>부대 <span class="muted">' + party.length + ' / 5</span></h4>' +
      '<div class="card">' +
      '<div class="stat-row"><span>공격력</span><b>' + core.fmt(pw.atk) + '</b></div>' +
      '<div class="stat-row"><span>방어력</span><b>' + core.fmt(pw.def) + '</b></div>' +
      '<small class="muted">던전의 체력은 방어력, 한 타 피해는 공격력에서 나옵니다. ' +
      '인물을 키우고 장비를 맞추면 더 깊이 내려갑니다.</small></div></div>';

    if (!party.length) {
      return html + '<div class="hint">📖 도감에서 인물 카드를 눌러 <b>동행에 넣기</b> 하세요.</div>';
    }
    html += '<div class="sec"><h4>동행</h4>';
    for (i = 0; i < party.length; i++) {
      var h = data.find(party[i]);
      if (!h) { continue; }
      var g = hero().info(party[i]);
      var rar = data.rarity[h.rarity];
      html += '<button class="card partyrow" data-act="detail" data-kind="hero" data-id="' + h.id + '">' +
        '<span class="pr-ico" style="border-color:' + rar.color + '">' + pt('hero', h, 44) + '</span>' +
        '<span class="pr-meta"><b>' + esc(h.name) + '</b>' +
          '<small class="muted">Lv.' + g.lv + rankStars(g.rank) + ' · 됨됨이 ' +
          core.fmt(hero().power(h.id)) + '</small></span>' +
        (i === 0 ? '<span class="tag">선두</span>' : '') +
        '</button>';
    }
    return html + '</div>';
  }

  /* ── 월드맵 (PLAN 28절) ───────────────────────────────────
   * 미니맵(지금 방)과 별도로 **얼마나 내려가 봤는지**를 지역 단위로 보여 준다.
   * 층은 늘 순서대로 내려가므로(원작에도 층 건너뛰기가 없다) 최고 도달
   * 층(`dstate().best`)만 있으면 "그 지역을 밟아 봤는지"가 그대로 나온다 —
   * 따로 세이브 칸을 늘리지 않았다(이미 저장돼 있는 값에서 계산만 한다).
   */
  var THEME_ICON = {
    '고분(古墳)': '🗿', '폐성(廢城)': '🏰', '산채(山寨)': '⛰️',
    '수궁(水宮)': '🌊', '지옥문(地獄門)': '🔥', '천계(天界)': '☁️'
  };

  function viewWorldMap() {
    var DD = global.DG.dungeonData;
    var DN = global.DG.dungeon;
    var st = DN.status();
    var best = st.best || 0;
    var curFloor = st.active ? st.floor : 0;
    var THEMES = DD.THEMES;
    var rows = '';
    for (var i = 0; i < THEMES.length; i++) {
      var th = THEMES[i];
      var to = (i + 1 < THEMES.length) ? THEMES[i + 1].from - 1 : null;
      var explored = best >= th.from;
      var here = curFloor >= th.from && (to === null || curFloor <= to);
      var range = to ? ('제' + th.from + '~' + to + '층') : ('제' + th.from + '층부터');
      rows += '<div class="wm-row' + (explored ? '' : ' locked') + (here ? ' here' : '') + '">' +
        '<span class="wm-ic">' + (explored ? (THEME_ICON[th.name] || '🗺️') : '❔') + '</span>' +
        '<div class="wm-info"><b>' + (explored ? esc(th.name) : '???') + '</b><small>' + range + '</small></div>' +
        (here ? '<span class="wm-here">현재</span>' : (explored ? '<span class="wm-done">답파</span>' : '')) +
        '</div>';
    }
    return '<div class="sec"><h4>🗺️ 월드맵</h4>' +
      '<div class="hint">층을 내려가며 지나온 지역이 열립니다 — 최고 <b>제' + best + '층</b>까지 밟았습니다.</div>' +
      '<div class="wm-list">' + rows + '</div></div>';
  }

  /* ── 전체 지도(자동지도, M키식 토글) ────────────────────────
   * 2026-09-06 — 사용자가 "M키 지도가 점만 보인다"고 지적하고 "원작
   * 처럼·투명으로 보여 줄 수도 있고"라고 요청했다. 예전엔 마을 넷의 고정
   * 배치(상자 그림, 이름만)를 #encounter 카드로 띄웠는데, 그 대신
   * minimap.js 의 큰 판(blips·norm 을 그대로 재사용해 화면 전체를 반투명
   * 하게 덮는다)으로 갈아 끼웠다 — 그쪽이 실제 방·들길 배치를 그대로
   * 보여 줘서 "점만 보인다"는 지적을 정면으로 푼다. #encounter 도, 마을
   * 전용 T.overworld 도 이제 이 화면에서는 안 쓴다(town.js 는 안 건드림 —
   * 다른 자가진단이 그 표를 직접 본다). 마을뿐 아니라 던전 방에서도
   * 켜진다 — 원작의 자동지도도 마을 전용이 아니다. */
  function openOverworldMap() {
    var MM = global.DG.minimap;
    return !!(MM && MM.openBig());
  }
  function closeOverworldMap() {
    var MM = global.DG.minimap;
    if (MM) { MM.closeBig(); }
  }
  function toggleOverworldMap() {
    var MM = global.DG.minimap;
    return !!(MM && MM.toggleBig());
  }

  /* ── 퀘스트 (PLAN 36절) ───────────────────────────────────
   * 넷 — 메인(순서대로 하나씩) · 지역(월드맵 여섯 지역, 닿아야 열린다) ·
   * 이벤트(구출 누적) · 무작위(늘 하나, 끝내면 곧바로 새것). 진행은
   * quest.js 가 dungeon.js 의 사건을 듣고 센다 — 여기는 그 결과만 그린다.
   */
  function qstRow(icon, name, desc, have, need, cls) {
    var pct = need ? Math.round(Math.min(1, have / need) * 100) : 0;
    return '<div class="qst-row' + (cls ? ' ' + cls : '') + '">' +
      '<span class="qst-ic">' + icon + '</span>' +
      '<div class="qst-info"><b>' + esc(name) + '</b><small>' + esc(desc) + '</small>' +
        (need ? '<div class="qst-bar"><i style="width:' + pct + '%"></i></div>' : '') +
      '</div>' +
      (need ? '<span class="qst-n">' + have + '/' + need + '</span>' : '') +
      '</div>';
  }

  function viewQuest() {
    var Q = global.DG.quest;
    if (!Q) { return '<div class="hint">퀘스트 모듈이 없습니다.</div>'; }
    var st = Q.status();
    var html = global.DG.scenario ? global.DG.scenario.cardHtml() : '';

    html += '<div class="sec"><h4>🚩 메인</h4>';
    if (st.mainDone) {
      html += '<div class="hint">메인 퀘스트를 모두 마쳤습니다 (' + st.mainTotal + '/' + st.mainTotal + ').</div>';
    } else {
      html += qstRow('🚩', st.main.name, st.main.desc, st.main.have, st.main.need) +
        '<div class="hint">' + (st.mainIdx + 1) + ' / ' + st.mainTotal + '번째</div>';
    }
    html += '</div>';

    html += '<div class="sec"><h4>🗺️ 지역</h4>';
    for (var i = 0; i < st.regions.length; i++) {
      var r = st.regions[i];
      if (r.locked) {
        html += qstRow('❔', '???', '이 지역에 아직 닿지 않았습니다', 0, 0, 'locked');
      } else {
        html += qstRow(r.done ? '✅' : '⚔️', r.name, r.desc, r.have, r.need, r.done ? 'done' : '');
      }
    }
    html += '</div>';

    /* 지역 사연 사슬(§5.14) — 고정 세계 지도의 지역 아홉, 발 들인 곳만 열린다 */
    if (st.chains && st.chains.length) {
      html += '<div class="sec"><h4>📜 지역 사연 <small>' + st.chainDone + '/' + st.chains.length + ' 평정' +
        (st.chainAll ? ' · 🏳️ 구주 평정' : '') + '</small></h4>';
      st.chains.forEach(function (c) {
        if (c.locked) {
          html += qstRow('❔', c.emoji + ' ' + c.name, '아직 발 들이지 않은 땅', 0, 0, 'locked');
        } else if (c.done) {
          html += qstRow('🏳️', c.emoji + ' ' + c.name + ' · ' + c.title, '평정 — ' + c.desc, 0, 0, 'done');
        } else {
          html += qstRow('📜', c.emoji + ' ' + c.name + ' · ' + c.title + ' (' + (c.step + 1) + '/' + c.steps + ' ' + c.stepName + ')',
            c.desc + ' — ' + c.giver, c.have, c.need);
        }
      });
      html += '</div>';
    }

    html += '<div class="sec"><h4>🙏 이벤트</h4>';
    if (st.eventDone) {
      html += '<div class="hint">이벤트 퀘스트를 모두 마쳤습니다.</div>';
    } else {
      html += qstRow('🙏', st.event.name, st.event.desc, st.event.have, st.event.need);
    }
    html += '</div>';

    html += '<div class="sec"><h4>📋 현상</h4>' +
      qstRow('📋', st.random.name, st.random.desc, st.random.have, st.random.need) +
      '<button class="btn tiny ghost" data-act="quest-reroll">🔄 다시 뽑기</button></div>';

    return html;
  }

  /* ── 도감 ─────────────────────────────────────────────── */

  /** era → 필터 갈래 셋(§5.7). 기존 넷(삼국지·한국사·일본사·세계사)은
   *  전부 '과거' 하나로 묶는다 — 갈래를 다섯 세 개(과거·현대·미래)로만
   *  늘렸다(era 자체를 갈래로 쓰면 4+2=6개라 시트 폭이 좁은 폰에서 버겁다). */
  function eraGroupOf(era) {
    if (era === '현대') { return 'modern'; }
    if (era === '미래') { return 'future'; }
    return 'past';
  }
  /** 인물 카드의 "시대 아이콘"(§5.7 수치 절) — era 문자열 그대로 하나씩. */
  function eraIcon(era) { return era === '현대' ? '🏙️' : (era === '미래' ? '🚀' : '📜'); }
  var DEX_ERA_TABS = [
    { key: 'all', label: '전체' }, { key: 'past', label: '과거' },
    { key: 'modern', label: '현대' }, { key: 'future', label: '미래' }
  ];
  function dexEraBar() {
    var out = '<div class="dexera">', i, t;
    for (i = 0; i < DEX_ERA_TABS.length; i++) {
      t = DEX_ERA_TABS[i];
      out += '<button class="btn tiny' + (dexEra === t.key ? ' on' : ' ghost') +
        '" data-act="dex-era" data-era="' + t.key + '">' + esc(t.label) + '</button>';
    }
    return out + '</div>';
  }

  function viewDex() {
    var heroesShown = dexEra === 'all' ? data.heroes :
      data.heroes.filter(function (h) { return eraGroupOf(h.era) === dexEra; });
    var hC = Object.keys(core.save.dex.heroes).length;
    var pC = Object.keys(core.save.dex.pets).length;
    var themes = (global.DG.dungeonData && global.DG.dungeonData.THEMES) || [];
    var rC = Object.keys(core.save.dex.regions || {}).length;
    var relics = (global.DG.town && global.DG.town.fieldRelics) ? global.DG.town.fieldRelics() : [];
    var lC = Object.keys(core.save.dex.relics || {}).length;
    return '<div class="sec"><h4>인물</h4>' + dexEraBar() + dexBar(hC, data.heroes.length) +
             dexGrid(heroesShown, core.save.dex.heroes) + '</div>' +
           '<div class="sec"><h4>펫</h4>' + dexBar(pC, data.pets.length) +
             dexGrid(data.pets, core.save.dex.pets) + '</div>' +
           '<div class="sec"><h4>지역</h4>' + dexBar(rC, themes.length || 1) +
             regionGrid(themes, core.save.dex.regions || {}) + '</div>' +
           '<div class="sec"><h4>유적</h4>' + dexBar(lC, relics.length || 1) +
             relicGrid(relics, core.save.dex.relics || {}) + '</div>' +
           '<div class="hint">카드를 누르면 열전·승급·펫 장착 화면이 열립니다. ' +
           '같은 인물을 또 등용하면 <b>중복(+n)</b>이 쌓여 승급 재료가 됩니다. ' +
           '지역은 그 층 테마에 처음 들어서면 밝혀집니다. 유적은 길에서 벗어나 ' +
           '들판을 뒤져야 닿습니다.</div>';
  }

  /** 지역 도감 — 인물·펫과 달리 등급색·중복 개념이 없는 단순 목록이다.
   *  같은 `dcell`/`locked`/`de`/`small` 스타일을 그대로 빌려 쓴다(새 CSS 없음). */
  function regionGrid(themes, owned) {
    var out = '<div class="dexgrid">';
    for (var i = 0; i < themes.length; i++) {
      var t = themes[i], have = !!owned[t.name];
      out += '<div class="dcell' + (have ? '' : ' locked') + '" title="' + esc(have ? t.name : '미발견') + '">' +
        (have ? '<span class="de">🗺️</span>' : '<span class="de locked-mark">❔</span>') +
        '<small>' + (have ? esc(t.name) : '???') + '</small></div>';
    }
    return out + '</div>';
  }

  /** 유적 도감(PLAN §60 후보4) — 지역과 같은 단순 목록. 이미 찾은 것만
   *  실제 이름·그림을 보여준다(못 찾은 것은 자리만 있고 정체는 감춘다 —
   *  릴리스 제단처럼 "몇 개 남았는지"만 보이고 어디인지는 안 가르쳐 준다). */
  function relicGrid(relics, owned) {
    var out = '<div class="dexgrid">';
    for (var i = 0; i < relics.length; i++) {
      var r = relics[i], have = !!owned[r.id];
      out += '<div class="dcell' + (have ? '' : ' locked') + '" title="' + esc(have ? r.name : '미발견') + '">' +
        (have ? '<span class="de">' + r.emoji + '</span>' : '<span class="de locked-mark">❔</span>') +
        '<small>' + (have ? esc(r.name) : '???') + '</small></div>';
    }
    return out + '</div>';
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
        esc(e.name + (have ? (dup ? ' · 중복 ' + dup : '') : ' (미획득)')) + '"' +
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

  /* ── 노획 장비 ────────────────────────────────────────────
   * 던전에서 주운 것을 여기서 갈아입힌다. 옛 '가방' 시트를 되살리는 대신
   * 던전 시트 안에 붙였다 — 장비가 나오는 곳이 던전 하나뿐이므로.
   */
  /* ── 장비 — 원작(2편)의 격자 가방과 종이인형 ───────
   *
   * 원작에서 가방은 목록이 아니라 **격자**다. 물건마다 차지하는 칸이 다르고,
   * 이름은 안 보이고 그림과 **등급 테두리**만 보인다. 무엇을 버릴지는 색으로
   * 정하고, 자세한 것은 하나를 짚었을 때 뜨는 검은 쪽지가 말한다.
   * 그 셋(격자 · 등급색 · 쪽지)을 그대로 옮겼다.
   *
   * 칸 수는 원작처럼 종류마다 다르다 — 무기·갑주는 두 칸을 먹고 부적은 한 칸이다.
   * 자리를 세이브에 적지는 않는다(격자 좌표를 저장하면 가방 구조가 통째로 바뀐다).
   * CSS grid 의 dense 배치에 맡기되, 순서를 값어치 순으로 고정해 자리가 안 흔들리게 한다.
   */

  /** 지금 짚어 둔 물건·인물 — 화면에만 사는 값이라 세이브에 넣지 않는다 */
  var gearSel = null, gearHero = null, gearTab = 'bag';

  /** 종류별 그림 — 원작의 물건 그림 자리다 (여기서는 글자 하나로 대신한다) */
  var LOOK_ICON = {
    sword: '\u2694\uFE0F', club: '\uD83D\uDD28', spear: '\uD83D\uDD31',
    guandao: '\uD83D\uDDE1\uFE0F', bow: '\uD83C\uDFF9', axe: '\uD83E\uDE93',
    fan: '\uD83E\uDEAD', staff: '\uD83E\uDD62', brush: '\uD83D\uDD8C\uFE0F',
    scroll: '\uD83D\uDCDC'
  };
  var SLOT_ICON = {
    weapon: '\u2694\uFE0F', armor: '\uD83E\uDD4B', charm: '\uD83D\uDCFF',
    helm: '\uD83E\uDE96', glove: '\uD83E\uDDE4', boot: '\uD83E\uDD7E',
    ring: '\uD83D\uDC8D', neck: '\uD83D\uDCFF'
  };
  var SLOT_SPAN = {
    weapon: 2, armor: 2, charm: 1,
    helm: 1, glove: 1, boot: 1, ring: 1, neck: 1
  };   // 세로로 먹는 칸 수

  function gearIcon(g) {
    var it = global.DG.item, b = it.baseOf(g);
    if (!b) { return '?'; }
    return (b.look && LOOK_ICON[b.look]) || SLOT_ICON[b.slot] || '?';
  }

  /** 효과 목록을 사람 말로 (투장·부문어가 같은 모양을 쓴다) */
  function effLines(list) {
    var it = global.DG.item, out = [], i;
    for (i = 0; i < list.length; i++) {
      var e = list[i];
      var who = e.stat === 'all' ? '전 능력치' : it.statKor(e.stat);
      if (e.kind === 'flat') { out.push(who + ' +' + e.v); }
      else if (e.kind === 'pct') { out.push(who + ' +' + e.v + '%'); }
      else { out.push(it.effKor(e.eff) + ' +' + e.v + '%'); }
    }
    return out;
  }

  /** 검은 쪽지 — 원작에서 물건 위에 뜨는 그것 */
  /** 창고 ↔ 가방 단추 — 쪽지 아래에 늘 붙는다 */
  function stashBtn(g, where) {
    return where === 'stash'
      ? '<button class="btn tiny ghost" data-act="gear-unstash" data-id="' + g.uid +
        '">\uD83C\uDF92 가방으로</button>'
      : '<button class="btn tiny ghost" data-act="gear-stash" data-id="' + g.uid +
        '">\uD83D\uDDC3\uFE0F 창고로</button>';
  }

  function gearTip(g, where) {
    var it = global.DG.item, t = it.tierOf(g), b = it.baseOf(g);
    var sn = it.socketsOf(g).length, se = it.emptySockets(g);
    var own = it.bestOwner(g);

    /* 미확인 — 원작에서 등급색은 보이고 옵션은 안 보인다.
       그 색만 보고 감정서를 태울지 정하는 것이 이 화면의 전부다. */
    if (it.isUnid(g)) {
      var have = it.scrolls();
      return '<div class="d2-tip">' +
        '<b class="d2-nm" style="color:' + t.color + '">' + esc(it.name(g)) + '</b>' +
        '<span class="d2-base">' + esc(b ? b.name : '') + ' \u00b7 ' + t.name +
          '(' + t.hanja + ') \u00b7 <b style="color:#8ec7ff">미확인</b></span>' +
        '<div class="muted">감정해야 옵션이 보입니다. <b>미확인은 입을 수 없습니다.</b></div>' +
        '<div class="d2-act">' +
          (have ? '<button class="btn tiny primary" data-act="gear-ident" data-id="' + g.uid +
                  '">\uD83D\uDD0E 감정 (감정서 ' + have + '장)</button>'
                : '<span class="muted" style="font-size:11px">감정서가 없습니다 — 행상에서 삽니다</span>') +
          '<button class="btn tiny ghost" data-act="gear-lock" data-id="' + g.uid + '">' +
            (g.lock ? '\uD83D\uDD12 잠김' : '\uD83D\uDD13 잠그기') + '</button>' +
          stashBtn(g, where) +
        '</div></div>';
    }

    var html = '<div class="d2-tip">' +
      '<b class="d2-nm" style="color:' + t.color + '">' + esc(it.name(g)) + '</b>' +
      '<span class="d2-base">' + esc(b ? b.name : '') + ' \u00b7 ' + t.name +
        '(' + t.hanja + ') \u00b7 값 ' + it.power(g) + '</span>';
    var ls = it.lines(g), i;
    for (i = 0; i < ls.length; i++) { html += '<div>' + esc(ls[i]) + '</div>'; }
    /* 비전(§5.10) — 전설 한 점에 하나, 그 비결을 건 무예를 키운다 */
    var lore1 = global.DG.secret && global.DG.secret.loreLine ? global.DG.secret.loreLine(g) : '';
    if (lore1) { html += '<div style="color:#f0a53a">' + esc(lore1) + '</div>'; }
    /* 내구 — 부적은 안 닳으므로 줄 자체가 없다 */
    var dmax = it.durMaxOf(g);
    if (dmax) {
      var dn = it.durOf(g), rc = it.repairCost(g);
      html += '<div style="color:' + (it.isBroken(g) ? 'var(--bad)' : 'var(--ink-dim)') + '">' +
        '내구 ' + dn + ' / ' + dmax +
        (it.isBroken(g) ? ' \u00b7 <b>부서짐 — 값을 못 냅니다</b>' : '') +
        (rc ? ' \u00b7 수리 ' + core.fmt(rc) + '금' : '') + '</div>';
    }
    /* 고유 — 이름 아래에 그 물건의 내력을 한 줄 (원작의 유니크가 그렇다) */
    var uq1 = it.uniqOf(g);
    if (uq1) {
      html += '<div style="color:#c7a76c;font-size:11px;margin-top:2px">⭐ ' +
        esc(uq1.desc) + '</div>';
    }

    /* 투장 — 몇 점 걸쳤는지, 지금 붙는 것과 아직 안 붙는 것 */
    var st1 = it.setOf(g);
    if (st1) {
      var worn = 0, hid;
      for (hid in core.save.gear.equip) {
        if (!Object.prototype.hasOwnProperty.call(core.save.gear.equip, hid)) { continue; }
        var c0 = it.setCounts(hid)[st1.key] || 0;
        if (c0 > worn) { worn = c0; }
      }
      html += '<div style="color:#00c000;margin-top:4px">〈' + esc(st1.name) + '〉 ' +
        worn + ' / ' + st1.pieces.length + ' 점</div>' +
        '<div class="muted" style="font-size:11px">' + esc(st1.desc) + '</div>';
      var kk;
      for (kk in st1.bonus) {
        if (!Object.prototype.hasOwnProperty.call(st1.bonus, kk)) { continue; }
        var on = worn >= parseInt(kk, 10);
        html += '<div style="font-size:11px;color:' + (on ? '#00c000' : 'var(--ink-faint)') + '">' +
          kk + '점 — ' + esc(effLines(st1.bonus[kk]).join(' · ')) + '</div>';
      }
      /* 투장 전용 무예(2026-09-10) — 세 점째의 진짜 보상. 아직 못 갖췄어도
         무엇을 노리고 모으는지 미리 보여 준다(원작에서 세트 물건의 다음
         줄이 다 그렇게 흐리게 미리 보인다). */
      if (st1.skill) {
        var skOn = worn >= 3;
        html += '<div style="font-size:11px;color:' + (skOn ? '#00c000' : 'var(--ink-faint)') + '">' +
          '3점 — 무예 ' + st1.skill.emoji + ' ' + esc(st1.skill.name) +
          ' · ' + esc(st1.skill.desc) + '</div>';
      }
    }
    if (sn) {
      html += '<div class="d2-sock">세공 구멍 ' + (sn - se) + ' / ' + sn +
        (se ? ' <span class="muted">(빈 구멍 ' + se + ')</span>' : '') + '</div>';
    }
    html += '<div class="d2-act">' +
      (own ? '<button class="btn tiny primary" data-act="gear-equip" data-id="' + g.uid +
             '" data-hero="' + own.id + '">' + esc((data.find(own.id) || {}).name || '') +
             ' 에게 (\u25b2' + own.gain + ')</button>'
           : '<span class="muted" style="font-size:11px">지금 동행에겐 보탬이 안 됩니다</span>') +
      '<button class="btn tiny ghost" data-act="gear-lock" data-id="' + g.uid + '">' +
        (g.lock ? '\uD83D\uDD12 잠김' : '\uD83D\uDD13 잠그기') + '</button>' +
      (it.repairCost(g) ? '<button class="btn tiny" data-act="gear-repair" data-id="' + g.uid +
        '">\uD83D\uDD27 수리 ' + priceTag(it.repairCost(g)) + '</button>' : '') +
      '<button class="btn tiny ghost" data-act="gear-sell" data-id="' + g.uid + '">' +
        '\uD83E\uDE99 ' + core.fmt(it.price(g)) + '</button>' +
      stashBtn(g, where) +
      '</div></div>';
    return html;
  }

  /** 종이인형 — 고른 인물이 걸치고 있는 것 */
  function gearDoll() {
    var it = global.DG.item;
    var party = core.save.party;
    if (!party.length) { return '<div class="hint">동행이 없습니다.</div>'; }
    if (party.indexOf(gearHero) < 0) { gearHero = party[0]; }
    var h = data.find(gearHero);
    var eq = it.equipped(gearHero);

    function slot(k, kor) {
      var g = eq[k];
      if (!g) {
        return '<div class="d2-dslot"><span class="muted">' + kor +
          '<small>비었다</small></span></div>';
      }
      var t = it.tierOf(g);
      if (it.isBroken(g)) {
        return '<div class="d2-dslot" data-act="gear-off" data-hero="' + gearHero +
          '" data-slot="' + k + '" title="벗는다">' +
          '<span style="color:var(--bad)">\uD83D\uDD27 ' + esc(it.name(g)) +
          '<small>' + kor + ' \u00b7 부서짐 \u2014 수리해야 값을 냅니다</small></span></div>';
      }
      return '<div class="d2-dslot" data-act="gear-off" data-hero="' + gearHero +
        '" data-slot="' + k + '" title="벗는다">' +
        '<span style="color:' + t.color + '">' + esc(it.name(g)) +
        '<small>' + kor + ' \u00b7 눌러 벗기</small></span></div>';
    }

    /* 인물 고르기 — 원작엔 없는 줄이지만 이 판은 동행이 여럿이라 있어야 한다 */
    var tabs = '', i;
    for (i = 0; i < party.length; i++) {
      var ph = data.find(party[i]);
      if (!ph) { continue; }
      tabs += '<button class="btn tiny' + (party[i] === gearHero ? ' primary' : ' ghost') +
        '" data-act="gear-hero" data-hero="' + party[i] + '">' + esc(ph.name) + '</button>';
    }

    return '<div class="bagtools">' + tabs + '</div>' +
      '<div class="d2-doll">' +
        slot('weapon', '무기') +
        '<div class="d2-who">' + pt('hero', h, 46) +
          '<b>' + esc(h ? h.name : '') + '</b>' +
          '<small>Lv.' + (hero().info(gearHero).lv || 1) + '</small></div>' +
        slot('armor', '갑주') +
      '</div>' +
      '<div class="d2-doll" style="grid-template-columns:1fr 1fr">' +
        slot('helm', '투구') + slot('glove', '장갑') +
      '</div>' +
      '<div class="d2-doll" style="grid-template-columns:1fr 1fr">' +
        slot('boot', '신발') + slot('ring', '반지') +
      '</div>' +
      '<div class="d2-doll" style="grid-template-columns:1fr 1fr">' +
        slot('neck', '목걸이') + slot('charm', '부적') +
      '</div>';
  }

  /** 격자 한 판 — 가방이든 창고든 같은 모양으로 그린다 */
  function gearGrid(list, where) {
    var it = global.DG.item;
    var sorted = list.slice().sort(function (a, b) { return it.power(b) - it.power(a); });
    var html = '<div class="d2-inv">', i, sel = null, used = 0;
    for (i = 0; i < sorted.length; i++) {
      var g = sorted[i], t = it.tierOf(g), b = it.baseOf(g);
      var span = SLOT_SPAN[b ? b.slot : 'charm'] || 1;
      var ns = it.socketsOf(g).length;
      used += span;
      if (g.uid === gearSel) { sel = g; }
      html += '<div class="d2-it' + (g.uid === gearSel ? ' on' : '') + (g.lock ? ' lock' : '') +
        '" style="grid-row:span ' + span + ';box-shadow:inset 0 0 0 1px ' + t.color +
        ', inset 0 0 14px rgba(0,0,0,.8)" data-act="gear-sel" data-id="' + g.uid +
        '" data-where="' + where + '" title="' + esc(it.name(g)) + '">' +
        (it.isUnid(g) ? '?' : gearIcon(g)) +
        (it.isBroken(g) ? '<b class="d2-broke">\uD83D\uDD27</b>' : '') +
        (ns ? '<i style="color:' + t.color + '">' + ns + '홈</i>' : '') +
        '</div>';
    }
    var rows = Math.max(4, Math.ceil(used / 10) + 1);
    for (i = used; i < rows * 10; i++) { html += '<div class="d2-slot"></div>'; }
    return { html: html + '</div>', sel: sel };
  }

  /* ── 창고(倉庫) — 원작의 stash ────────────────────────────
   * 자리가 모자라서 두는 게 아니다(가방이 예순 칸이다).
   * 뜻은 하나 — **자동이 손대지 않는 자리**. 그 넷은 전부 bag() 만 훑으므로
   * 창고에 넣는 것만으로 저절로 지켜진다.
   */
  function viewStash() {
    var it = global.DG.item;
    var list = it.stash();
    var html = '<div class="sec"><h4>창고 <span class="muted">' +
      list.length + ' / ' + it.stashCap() + '</span></h4>' +
      '<div class="hint">창고에 넣어 둔 것은 <b>자동이 손대지 않습니다</b> \u2014 ' +
      '자동 정리에 팔리지 않고, 자동 장착·연단·되는 데까지 감정에도 안 씁니다.<br>' +
      '<span class="muted">원작 그대로 <b>던전 안에서는 열리지 않습니다</b>.</span></div>';
    if (!it.stashOpen()) {
      return html + '<div class="card"><small class="muted">던전에 들어가 있습니다 \u2014 ' +
        '나와서 여세요.</small></div></div>';
    }
    if (!list.length) {
      return html + '<div class="hint">비었습니다 \u2014 가방 탭에서 넣습니다.</div></div>';
    }
    var g = gearGrid(list, 'stash');
    html += g.html;
    html += g.sel ? gearTip(g.sel, 'stash')
                  : '<div class="hint">칸을 하나 누르면 그 물건의 쪽지가 뜹니다.</div>';
    return html + '</div>';
  }

  function gearSection() {
    var it = global.DG.item;
    if (!it) { return ''; }
    var head = tabBar('gear-tab', gearTab,
      [['bag', '\uD83C\uDF92 \uAC00\uBC29'], ['stash', '\uD83D\uDDC3\uFE0F \uCC3D\uACE0']]);
    if (gearTab === 'stash') { return head + viewStash(); }

    var bag = it.bag();
    var html = head + '<div class="sec"><h4>장비</h4>' + gearDoll() + '</div>';

    html += '<div class="sec"><h4>가방 <span class="muted">' +
      bag.length + ' / ' + it.bagCap() + '</span></h4>';

    if (!bag.length) {
      return html + '<div class="hint">가방이 비었습니다 \u2014 던전에서 주워 오세요.</div></div>';
    }

    /* 감정 — 미확인이 있으면 가장 먼저 할 일이다 */
    var unid = it.unidList().length, scroll = it.scrolls();
    if (unid) {
      html += '<div class="hint">미확인 <b style="color:#8ec7ff">' + unid + '점</b> · ' +
        '감정서 <b>' + scroll + '장</b><br>' +
        '<span class="muted">미확인은 입을 수 없고, 자동 정리에도 팔리지 않습니다.</span></div>' +
        '<div class="bagtools"><button class="btn tiny primary" data-act="gear-identall"' +
        (scroll ? '' : ' disabled') + '>\uD83D\uDD0E 되는 데까지 감정</button></div>';
    }

    html += '<div class="bagtools">' +
      '<button class="btn tiny" data-act="gear-auto">\u2728 자동 장착</button>' +
      '<button class="btn tiny ghost" data-act="gear-clean">\uD83E\uDDF9 쓸모없는 것 정리</button></div>';

    /* 격자는 gearGrid 하나가 그린다 — 가방과 창고가 같은 모양이어야 한다 */
    if (gearSel && !it.findAnywhere(gearSel)) { gearSel = null; }
    var gr = gearGrid(bag, 'bag');
    html += gr.html;
    html += gr.sel ? gearTip(gr.sel, 'bag')
                   : '<div class="hint">칸을 하나 누르면 그 물건의 쪽지가 뜹니다.</div>';

    return html + '</div>';
  }

  /* ── 외모(2026-09-06) — 플레이어 본인 3D 아바타 커스텀 ─────
   * `core.save.appearance = {styleSeed, tint}` 를 고르면
   * `dungeon3d.js`의 `'me'` 배우가 그 시드/색으로 다시 지어진다.
   * styleSeed 0(기본)은 지금까지의 고정 모습 그대로다.
   * 1~6 은 `dungeon3d.js`의 `QRPG_SEEDS` 여섯 자리(전사·순찰자·도적·
   * 사제·마법사·수도승 몸)만 내준다 — 실사풍(MPFB) 쪽은 색도 안 먹고
   * (dungeon3d.js 주석 참고) 실기기 확인 중 렌더러가 죽는 조합이 있어
   * 뺐다. 그래서 "색이 안 먹을 수 있다"는 캐벗도 필요 없어졌다. */
  var LOOK_STYLE_NAMES = ['기본', '전사', '순찰자', '도적', '사제', '마법사', '수도승'];
  var LOOK_TINTS = ['#c94f4f', '#4f8fc9', '#4fc98f', '#c9a04f', '#8f4fc9', '#5a5a62'];

  function viewLook() {
    var ap = core.save.appearance || { styleSeed: 0, tint: null };
    var i, html = '<div class="sec"><h4>🧑 외모</h4>' +
      '<div class="hint">내 3D 모습(몸·옷 조합)을 고른다. 장비 겉모습과는 별개다.</div>';

    html += '<div class="bagtools">';
    for (i = 0; i < LOOK_STYLE_NAMES.length; i++) {
      html += '<button class="btn tiny' + ((ap.styleSeed || 0) === i ? ' primary' : ' ghost') +
        '" data-act="look-style" data-n="' + i + '">' + LOOK_STYLE_NAMES[i] + '</button>';
    }
    html += '</div>';

    html += '<div class="bagtools">';
    for (i = 0; i < LOOK_TINTS.length; i++) {
      var hex = LOOK_TINTS[i];
      html += '<button class="btn tiny' + (ap.tint === hex ? ' primary' : ' ghost') +
        '" style="background:' + hex + '" data-act="look-tint" data-hex="' + hex + '">&nbsp;</button>';
    }
    html += '<button class="btn tiny ghost" data-act="look-reset">↺ 초기화</button>' +
      '</div></div>';
    return html;
  }

  /* ── 무예(武藝) — 원작의 직업과 스킬 트리 ─────────────────
   * 규칙은 skill.js 가 다 안다. 여기는 나무를 늘어놓고 누른 것을 넘긴다.
   * 인물마다 나무가 다르므로 **누구의 나무인지**를 늘 위에 적어 둔다.
   */

  var skillHero = null;

  /** 이 직업을 여는 무기 이름들 — "무엇을 쥐면 되는지" 를 화면이 알려 준다 */
  function weaponNames(clsKey) {
    var looks = global.DG.skillData.weaponsFor(clsKey);
    var out = [];
    global.DG.itemData.BASES.forEach(function (b) {
      if (b.slot === 'weapon' && looks.indexOf(b.look) >= 0) { out.push(b.name); }
    });
    return out.join('·');
  }

  function viewSkill() {
    var SK = global.DG.skill, SD = global.DG.skillData;
    if (!SK) { return '<div class="hint">무예 모듈이 없습니다</div>'; }
    var party = core.save.party;
    if (!party.length) { return '<div class="hint">동행이 없습니다.</div>'; }
    if (party.indexOf(skillHero) < 0) { skillHero = party[0]; }

    var h = data.find(skillHero);
    var cls = SK.classOf(skillHero);
    var left = SK.pointsLeft(skillHero);

    /* 인물 고르기 — 선두가 던전에서 몸으로 뛴다 */
    var tabs = '', i;
    for (i = 0; i < party.length; i++) {
      var ph = data.find(party[i]);
      if (!ph) { continue; }
      tabs += '<button class="btn tiny' + (party[i] === skillHero ? ' primary' : ' ghost') +
        '" data-act="skill-hero" data-hero="' + party[i] + '">' +
        (i === 0 ? '\u25B6 ' : '') + esc(ph.name) + '</button>';
    }

    var html = '<div class="bagtools">' + tabs + '</div>' +
      '<div class="sec"><h4>' + cls.emoji + ' ' + esc(cls.name) + '(' + cls.hanja + ')</h4>' +
      '<div class="card">' +
        '<div class="stat-row"><span>' + esc(h ? h.name : '') + '</span>' +
          '<b>Lv.' + SK.pointsTotal(skillHero) + ' · 남은 점수 ' + left + '</b></div>' +
        '<small class="muted">' + esc(cls.desc) + '<br>' +
        '직업은 <b>장착한 무기</b>가 정합니다 — ' + esc(weaponNames(cls.key)) +
        ' 를 쥐면 이 나무를 탑니다. <b>무기를 바꾸면 손이 통째로 바뀝니다.</b><br>' +
        '점수와 칸은 직업마다 따로 남으니, 도로 쥐면 예전 손이 살아납니다.<br>' +
        '<b>던전에서 몸으로 뛰는 것은 선두(▶)</b>입니다.' +
        '</small>' +
        (SK.pointsSpent(skillHero)
          ? '<button class="btn tiny ghost wide" data-act="skill-respec">↺ 환원(還元) — ' +
            core.fmt(global.DG.vendor.respecCost(skillHero)) + '금에 점수를 돌려받는다</button>'
          : '') +
        '</div></div>';

    /* 네 칸 */
    var eq = SK.equipped(skillHero);
    var KEYS = ['Z', 'X', 'C', 'V'];
    html += '<div class="sec"><h4>손에 든 넷</h4>' +
      '<div class="hint">배운 것을 <b>네 칸에 걸어야</b> 던전에서 씁니다 — ' +
      '원작에서도 배운 걸 다 손에 들진 못합니다.</div><div class="bagtools">';
    for (i = 0; i < eq.length; i++) {
      html += '<button class="btn tiny' + (skillSlotPick === i ? ' primary' : ' ghost') +
        '" data-act="skill-slot" data-idx="' + i + '">' + KEYS[i] + ' ' +
        (eq[i] ? eq[i].sk.emoji + ' ' + esc(eq[i].sk.name) : '<span class="muted">비었다</span>') +
        '</button>';
    }
    html += '</div>';
    if (skillSlotPick !== null) {
      html += '<div class="hint">' + KEYS[skillSlotPick] +
        ' 칸에 걸 무예를 아래에서 고르세요 (상시 무예는 못 겁니다). ' +
        '<button class="btn tiny ghost" data-act="skill-slot" data-idx="-1">그만두기</button></div>';
    }
    html += '</div>';

    /* 나무 — 갈래 셋 × 단계 셋 */
    var tree = SK.treeOf(skillHero);
    var br;
    for (br = 0; br < 8; br++) {
      var row = tree.filter(function (x) { return x.br === br; })
                    .sort(function (a, b) { return a.row - b.row; });
      if (!row.length) { continue; }
      html += '<div class="sec"><h4>갈래 ' + (br + 1) + '</h4>';
      for (i = 0; i < row.length; i++) {
        var sk = row[i];
        var rank = SK.rankOf(skillHero, sk.key);
        var can = SK.canLearn(skillHero, sk.key);
        var pre = SD.prereqOf(sk);
        var locked = !!(pre && SK.rankOf(skillHero, pre.key) < 1);
        var slotted = eq.filter(function (x) { return x && x.sk.key === sk.key; }).length > 0;
        html += '<div class="grow" style="border-left-color:' +
          (rank ? 'var(--gold)' : (locked ? 'var(--ink-faint)' : 'var(--d2-brass)')) + '">' +
          '<div class="gr-top"><b>' + sk.emoji + ' ' + esc(sk.name) + '</b>' +
          '<span class="gr-lv">' + rank + ' / ' + SD.MAX_RANK + '단' +
            (slotted ? ' · 손에 듦' : '') + '</span></div>' +
          '<div class="gr-opts">' + esc(sk.desc) +
            (sk.shape === 'passive' ? ' <span class="muted">(상시)</span>'
                                    : ' <span class="muted">기력 ' + sk.cost + ' · ' + sk.cd + '초</span>') +
            (rank ? ' <b>지금 ' + fmtSkillValue(sk, SD.valueAt(sk, rank)) + '</b>' : '') +
          '</div>' +
          '<div class="gr-btns">' +
            (locked
              ? '<span class="muted" style="font-size:11px">\uD83D\uDD12 ' + esc(pre.name) + ' 을(를) 먼저</span>'
              : '<button class="btn tiny' + (can.ok ? ' primary' : '') + '" data-act="skill-learn"' +
                ' data-key="' + sk.key + '"' + (can.ok ? '' : ' disabled') + '>+1단</button>') +
            (skillSlotPick !== null && rank > 0 && sk.shape !== 'passive'
              ? '<button class="btn tiny" data-act="skill-set" data-key="' + sk.key +
                '">' + KEYS[skillSlotPick] + ' 에 걸기</button>' : '') +
          '</div>' + secretRow(skillHero, sk, rank) + '</div>';
      }
      html += '</div>';
    }
    return html;
  }

  /**
   * 비결(§5.9, secret.js) 다섯 — 배운 무예 아래에 늘어놓는다. 단수가 모자란 것은 자물쇠.
   * 원작 3편의 룬 자리 — 이 판엔 소켓 룬이 따로 있어 이름을 '비결'로 했다.
   */
  function secretRow(hid, sk, rank) {
    var SC = global.DG.secret;
    if (!SC || !rank || sk.shape === 'passive') { return ''; }
    var cur = SC.of(hid, sk.key), html = '<div class="gr-secret"><small class="muted">비결</small> ';
    var lores = SC.activeLores ? SC.activeLores(hid) : {};
    SC.SECRETS.forEach(function (s) {
      var lock = rank < s.rank;
      /* 비전(§5.10) — 입은 전설이 키우는 비결엔 📜 가 붙는다 */
      html += '<button class="btn tiny' + (cur === s.key ? ' primary' : '') + '" data-act="skill-secret"' +
        ' data-key="' + sk.key + '" data-sec="' + s.key + '" title="' + esc(s.desc + (lores[s.key] ? ' · 📜 비전 위력 ×' + SC.LORE_MUL : '')) + '"' + (lock ? ' disabled' : '') + '>' +
        s.emoji + ' ' + s.name + (lores[s.key] ? '📜' : '') + (lock ? ' 🔒' + s.rank : '') + '</button>';
    });
    if (cur) { html += '<div class="muted" style="font-size:11px">' + esc(SC.byKey(cur).desc) + '</div>'; }
    return html + '</div>';
  }

  /** 상시 무예는 % 로, 나머지는 배수로 읽힌다 */
  function fmtSkillValue(sk, v) {
    if (sk.shape === 'passive') { return '+' + Math.round(v * 10) / 10 + '%'; }
    if (sk.shape === 'buff') { return '+' + Math.round(v) + '% · ' + (sk.sec || 6) + '초'; }
    if (sk.shape === 'heal') { return '체력 ' + Math.round(v) + '%'; }
    if (sk.shape === 'curse') { return '받는 피해 +' + Math.round(v) + '%' + (sk.pull ? ' · 끌어당김' : ''); }
    if (sk.shape === 'summon') { return Math.round(v) + '기 · ' + (sk.sec || 12) + '초'; }
    /* §5.19 2차 — 원뿔(arc)·끌어당김(pull)은 같은 모양 안의 변주라 수치 줄에 꼬리표로 */
    return '위력 ' + Math.round(v * 100) + '%' + (sk.arc ? ' · 앞 부채꼴' : '') + (sk.pull ? ' · 끌어당김' : '');
  }

  /* ── 행상(行商) — 원작의 상인과 도박 ─────────────────────
   * 규칙은 vendor.js 가 다 안다. 여기는 늘어놓고 누른 것을 넘기기만 한다.
   */

  function priceTag(n) {
    var poor = core.save.player.gold < n;
    return '<span style="color:' + (poor ? 'var(--bad)' : 'var(--gold)') +
      '">\uD83E\uDE99 ' + core.fmt(n) + '</span>';
  }

  function viewVendor() {
    if (!global.DG.vendor) { return '<div class="hint">행상 모듈이 없습니다</div>'; }
    var head = tabBar('vendor-tab', vendorTab, [
      ['buy', '\uD83E\uDDFA \uC0AC\uB2E4'], ['sell', '\uD83E\uDE99 \uD314\uB2E4'],
      ['back', '\u21A9\uFE0F \uB418\uC0AC\uAE30'], ['gamble', '\uD83C\uDFB2 \uD22C\uC804']
    ]);
    return head + (vendorTab === 'sell' ? vendorSell()
                 : vendorTab === 'back' ? vendorBack()
                 : vendorTab === 'gamble' ? vendorGamble()
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

  /* ── 세공(細工) ───────────────────────────────────────── */

  /* 세공 시트·행상 시트에서 고른 탭 — 둘 다 화면 상태라 세이브에 안 남긴다 */
  var craftTab = 'socket', vendorTab = 'buy';
  var skillSlotPick = null;

  function tabBar(act, cur, list) {
    var h = '<div class="bagtools">', i;
    for (i = 0; i < list.length; i++) {
      h += '<button class="btn tiny ' + (list[i][0] === cur ? 'primary' : 'ghost') +
        '" data-act="' + act + '" data-tab="' + list[i][0] + '">' + list[i][1] + '</button>';
    }
    return h + '</div>';
  }

  function viewCraft() {
    return tabBar('craft-tab', craftTab,
             [['socket', '\uD83D\uDD28 \uC138\uACF5'], ['forge', '\u2697\uFE0F \uC5F0\uB2E8']]) +
           (craftTab === 'forge' ? viewForge() : viewSocket());
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
    if (craftMat) {
      var d;
      if (craftMat.kind === 'jewel') {
        var jsel = it.jewelById(craftMat.key);
        d = jsel ? GD.jewelName(jsel) : '주옥';
      } else if (craftMat.kind === 'gem') {
        d = GD.grade(craftMat.g).name + ' ' + GD.gemByKey(craftMat.key).name;
      } else {
        d = GD.runeByKey(craftMat.key).glyph + '(' + GD.runeByKey(craftMat.key).name + ')';
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
        var on = craftMat && craftMat.kind === m.kind && craftMat.key === m.key &&
                 (m.kind === 'rune' || craftMat.g === m.g);
        html += '<button class="btn tiny ' + (on ? 'primary' : '') + '" data-act="craft-pick"' +
          ' data-kind="' + m.kind + '" data-key="' + m.key + '" data-g="' + (m.g || 0) + '"' +
          ' style="color:' + (on ? '' : col) + '">' + esc(lab) + ' ×' + m.n + '</button>';
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
      var jon = craftMat && craftMat.kind === 'jewel' && craftMat.key === jw.id;
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
            (gd2 ? gd2.emoji : '●') + '</span>';
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
              ? '<button class="btn tiny ' + (craftMat ? 'primary' : 'ghost') + '"' +
                  (craftMat ? '' : ' disabled') +
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
      '<small class="muted">던전 규칙은 <b>손으로 할 때와 같습니다</b> — ' +
      '자동은 무엇을 목표로 삼을지(적·우물·문·은사)만 고릅니다.<br>' +
      '<b>체력이 22% 밑으로 떨어지면 스스로 탈출합니다</b> — 노획물을 잃지 않게.<br>' +
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
            '<span class="tag">' + eraIcon(h.era) + ' ' + esc(h.era) + '</span>' +
            '<span class="tag" style="color:' + rar.color + '">' + rar.label + '</span>' +
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

      /* 인물별 서명 무예(2026-09-11) — 파일럿 8명만 있다. 없으면 아무것도
         안 그린다("곧 옵니다" 문구로 97명을 도배하지 않는다). */
      var HS = global.DG.heroSkillData && global.DG.heroSkillData.sigOf(h.id);
      if (HS) {
        out += '<div class="dt-sig" style="color:#c7a76c">⭐ 서명 무예 ' + HS.emoji + ' ' +
          '<b>' + esc(HS.name) + '</b>' +
          '<div class="muted" style="font-size:11px">' + esc(HS.desc) + '</div></div>';
      }
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
        '<small class="muted dt-tip">승급은 <b>중복분</b>과 금을 씁니다. 중복은 보스를 잡을 때 ' +
        '이미 있는 인물이 또 합류하면 쌓입니다. 던전에서 층을 깨면 동행 전원이 경험치를 받습니다.</small>';
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
            '<span class="tag" style="color:' + rar.color + '">' + rar.label + '</span>' +
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
