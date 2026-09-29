/**
 * 부트스트랩 & 메인 루프 — 사가의숲 (원작식)
 * ---------------------------------------------------------------
 * 놀이 순환은 셋이다:
 *   걷는다 → 모은다(나무·바위·꽃·물가) → 나눈다(주민 부탁 · 전방)
 *
 * 지도를 걷는 게임·던전 게임과 **완전히 다른 프로젝트**다. 세이브도 따로 쓴다
 * (yeoksa-village/save/v1).
 *
 * 시간은 실제 시계를 본다. 날이 바뀌면 채집물이 다시 여물고 부탁이 새로 붙는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var ui = global.DG.ui;
  var V = global.DG.village;

  var lastFrame = 0;
  var uiAcc = 0;
  var saveAcc = 0;
  var dayAcc = 0;

  function start() {
    var fresh = !core.load();

    V.init();
    V.bindKeys();
    global.DG.villageView.init(document.getElementById('map'));
    if (global.DG.villageView3d && !global.DG_NO_DRAW) {
      global.DG.villageView3d.init(document.getElementById('map3d'));
    }
    if (global.DG.minimap) { global.DG.minimap.init(); }
    ui.init();

    if (fresh) {
      /* 마을에는 내 모습이 필요하다 — 인물 하나를 나로 삼는다 (선두가 내 아바타) */
      var me = core.pick(global.DG.data.heroes);
      core.save.dex.heroes[me.id] = { count: 1, firstAt: Date.now() };
      global.DG.hero.ensure(me.id);
      core.save.party = [me.id];
      core.log('마을에 도착했습니다. 나무를 흔들고, 부탁을 들어주세요.', 'info');
      core.log('🏡 ' + me.name + ' 의 모습으로 지냅니다 (도감에서 바꿀 수 있습니다)', 'info');
    }

    bindTopbar();
    lastFrame = performance.now();
    /* 자가진단은 **루프를 켜지 않는다**(`DG_NO_LOOP`).
       헤드리스에서 프레임 수는 실행마다 다르고, 그 프레임이 주민을 움직이고 벌레를
       내보내므로 항목마다 딛는 자리가 흔들린다. 진단은 필요한 만큼 update 를
       직접 굴린다 — 그게 이 저장소가 처음부터 쓰던 방식이다 */
    if (!global.DG_NO_LOOP) { requestAnimationFrame(loop); }

    global.addEventListener('beforeunload', function () { core.persist(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { core.persist(); }
      else { core.save.lastSeen = Date.now(); V.rollDay(); core.emit('changed'); }
    });
    global.addEventListener('blur', function () { core.persist(); }); // 포커스만 잃어도 저장
  }

  function bindTopbar() {
    /* "더보기" — 살금살금·3D·시점·도움말·어드민·리셋은 자주 안 쓰니
       접어 둔다(사가스토리·사가국지와 같은 결). 자동·손쓰기만 붙박이로 남는다 */
    var moreBtn = document.getElementById('btn-more');
    var more = document.getElementById('top-more');
    if (moreBtn && more) {
      moreBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        more.classList.toggle('show');
      });
      document.addEventListener('click', function (e) {
        if (more.classList.contains('show') && !more.contains(e.target) && e.target !== moreBtn) {
          more.classList.remove('show');
        }
      });
      global.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { more.classList.remove('show'); }
      });
    }

    var autoBtn = document.getElementById('btn-auto');
    if (autoBtn) {
      var syncAutoBtn = function () { autoBtn.classList.toggle('on', global.DG.auto.active()); };
      syncAutoBtn();
      autoBtn.addEventListener('click', function () {
        global.DG.auto.toggle();
        syncAutoBtn();
      });
      core.on('changed', syncAutoBtn);
    }

    var doBtn = document.getElementById('btn-do');
    if (doBtn) {
      doBtn.addEventListener('click', function () { ui.doInteract(); });
    }

    /* 살금살금 — Shift 를 누르고 있어도 같다. 벌레 앞에서만 뜻이 있다 */
    var sneakBtn = document.getElementById('btn-sneak');
    if (sneakBtn) {
      var syncSneak = function () { sneakBtn.classList.toggle('on', V.sneaking()); };
      syncSneak();
      sneakBtn.addEventListener('click', function () { V.toggleSneak(); syncSneak(); });
      core.on('changed', syncSneak);
    }

    document.getElementById('btn-reset').addEventListener('click', function () {
      if (!confirm('정말 처음부터 다시 시작할까요? 마을·가방·도감이 모두 사라집니다.')) { return; }
      core.reset();
      location.reload();
    });

    var soundBtn = document.getElementById('btn-sound');
    if (soundBtn && global.DG.sfx) {
      var SFX = global.DG.sfx;
      var syncSoundBtn = function () {
        soundBtn.textContent = SFX.enabled() ? '🔊' : '🔇';
        soundBtn.classList.toggle('on', SFX.enabled());
      };
      syncSoundBtn();
      soundBtn.addEventListener('click', function () {
        SFX.setEnabled(!SFX.enabled());
        syncSoundBtn();
      });
    }

    var btn3d = document.getElementById('btn-3d');
    if (btn3d && global.DG.villageView3d) {
      var VV3 = global.DG.villageView3d;
      if (!VV3.available()) { btn3d.style.display = 'none'; }
      btn3d.classList.toggle('on', VV3.active());
      btn3d.addEventListener('click', function () {
        var on = VV3.toggle();
        btn3d.classList.toggle('on', on);
        core.persist();
      });
    }

    /* 3D 시점 — 어깨너머(0) ↔ 3/4 부감/쿼터뷰(1) 을 한 번에 뒤집는다. 세로 드래그로도
       그 사이를 이을 수 있지만(camTiltMix 연속값), 실기기에서 드래그 감이 잡히기 전에
       확실하게 끝까지 갈 수 있는 손잡이를 따로 달라는 요청 — 2026-09-02. 버튼은 지금
       값이 반(0.5) 미만이면 부감으로, 아니면 어깨너머로 딱 잘라 보낸다 */
    var camBtn = document.getElementById('btn-camview');
    if (camBtn && global.DG.villageView3d) {
      var VV3b = global.DG.villageView3d;
      if (!VV3b.available()) { camBtn.style.display = 'none'; }
      var syncCamBtn = function () {
        var iso = VV3b.camTiltMix() >= 0.5;
        camBtn.classList.toggle('on', iso);
        camBtn.title = iso ? '3D 시점 (3/4 부감 — 눌러서 어깨너머로)'
                            : '3D 시점 (어깨너머 — 눌러서 3/4 부감으로)';
      };
      syncCamBtn();
      camBtn.addEventListener('click', function () {
        if (!VV3b.active()) { ui.toast('먼저 🧊 로 3D 를 켜야 시점을 바꿀 수 있습니다'); return; }
        VV3b.setCamTiltMix(VV3b.camTiltMix() >= 0.5 ? 0 : 1);
        syncCamBtn();
        ui.toast(VV3b.camTiltMix() >= 0.5 ? '🎥 3/4 부감' : '🎥 어깨너머');
      });
    }

    document.getElementById('btn-help').addEventListener('click', showHelp);
  }

  function showHelp() {
    var el = document.getElementById('encounter');
    el.innerHTML =
      '<div class="enc-card">' +
        '<h3 style="margin:0 0 4px;font-size:18px">🏡 조작 안내</h3>' +
        '<div class="helplist">' +
          /* 폰에는 WASD 가 없다 — 손가락뿐인 기기에는 끌어서 걷는 법을 알려 준다 */
          (core.touchOnly()
            ? '<div><b>이동</b> 갈 자리를 누릅니다 · <b>누른 채 끌면</b> 손가락을 따라 걷습니다</div>'
            : '<div><b>이동</b> WASD · 방향키 · 빈 땅을 누르거나 끌면 그쪽으로 걸어갑니다</div>') +
          '<div><b>손</b> ' + core.actHint() + ' (또는 아래 카드의 버튼) — 흔들기·캐기·낚기·말 걸기</div>' +
          '<div><b>채집</b> 나무🌳 소나무🌲 바위🪨 꽃🌸 은 <b>하루 한 번</b>, 낚시터🎣 는 몇 번이든</div>' +
          '<div><b>주민</b> ❗ 가 붙은 사람은 부탁이 있습니다. 채워 가면 금·친밀도를 줍니다</div>' +
          '<div><b>곤충</b> 🦋 잠자리채(전방)가 있어야 잡습니다. ' +
            '<b>살금살금(' + (core.touchOnly() ? '🐾 단추' : 'Shift · 🐾') +
            ')</b> 다가가지 않으면 달아납니다. 계절·시간대를 탑니다</div>' +
          '<div><b>집</b> 🏠 안에 들어가 <b>선 자리에</b> 가구를 놓습니다. ' +
            '증축은 빚을 지고 넓힌 뒤 갚습니다</div>' +
          '<div><b>편지</b> 📮 날이 바뀌면 배달됩니다. <b>답장</b>을 쓰면 정이 늡니다</div>' +
          '<div><b>이사</b> 💭 를 비친 사람은 사흘 뒤 떠납니다. ' +
            '그날 부탁을 들어주고 말을 걸면 붙잡습니다</div>' +
          '<div><b>공사</b> 🪧 개토패(전방)를 사면 <b>선 자리 둘레 3×3</b> 의 땅을 길·물길로 고칩니다</div>' +
          '<div><b>전방</b> 🏪 에서 가방을 팝니다 (부탁 몫은 남겨 둡니다) · 도구와 가구를 삽니다</div>' +
          '<div><b>서당</b> 📚 문답 — 맞히면 금·명성, 지식은 서고에 쌓입니다</div>' +
          '<div><b>시간</b> 실제 시계를 봅니다. 날이 바뀌면 마을이 다시 여뭅니다</div>' +
          '<div><b>자동</b> 🤖 를 누르면 대신 돌아다니며 모으고 나눠 줍니다</div>' +
        '</div>' +
        '<button class="btn primary wide" id="help-ok">확인</button>' +
      '</div>';
    el.classList.add('show');
    document.getElementById('help-ok').addEventListener('click', function () {
      el.classList.remove('show'); el.innerHTML = '';
    });
  }

  /** 프레임 간격 상한(ms, 0 = 상한 없음) — 발열(2026-09-24 "핸드폰 불남"): 90·120Hz 폰은 초당 90·120번 그렸다.
   *  그림은 그대로 두고 **헛그림만** 막는다 — 손잡이 `perf.fps`(기본 60, 0 = 상한 없음).
   *  좁은 화면에서 시트가 게임을 덮으면 30(판정은 dt 로 그대로 흐른다) */
  function frameGapMs() {
    var fps = core.tuned ? core.tuned('perf.fps', 60) : 60;
    var b = document.body;
    if (b && b.classList.contains('sheet-open') && (global.innerWidth || 0) <= 780) { fps = fps ? Math.min(fps, 30) : 30; }
    return fps > 0 ? 1000 / fps : 0;
  }

  function loop(now) {
    /* 탭이 숨겨졌거나 창이 포커스를 잃으면 3D 를 완전히 멈춘다 — "화면엔
       보이는데 다른 창을 쓰는 중"은 브라우저가 알아서 안 줄여 준다. 이 판이
       그 상태로 계속 풀가동해 다른 작업 CPU 를 잡아먹는다는 제보로 추가
       (2026-09-08) */
    if (document.hidden || !document.hasFocus()) {
      lastFrame = now;
      global.setTimeout(function () { requestAnimationFrame(loop); }, 500);
      return;
    }
    /* 발열(2026-09-24 "핸드폰 불남") — 120Hz 폰은 상한 없이 초당 120번을 그렸다.
       터치 기기는 초당 30번, 시트가 화면을 덮으면 10번만 돈다(dt 는 쌓인 만큼 그대로) */
    var cap = frameGapMs();
    if (cap && now - lastFrame < cap - 2) { requestAnimationFrame(loop); return; }
    var dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;

    global.DG.auto.update(dt);
    V.update(dt);
    if (global.DG.mount) { global.DG.mount.step(); if (!global.DG_NO_DRAW) { global.DG.mount.paint(); } }   // 탈것 — 내림 판정·단추(mount.js)
    if (!global.DG_NO_DRAW) {
      var VV3 = global.DG.villageView3d;
      /* 3D 가 켜져 있으면 2D 캔버스는 display:none 인데도 매 프레임 하늘·땅·사람을 다 그렸다 — 카메라만 맞춘다 */
      if (VV3 && VV3.active()) { global.DG.villageView.syncCam(); } else { global.DG.villageView.draw(); }
      if (VV3) { VV3.step(dt); }
      if (global.DG.minimap) { global.DG.minimap.tick(dt); }
    }

    /* 날이 바뀌는 순간을 놓치지 않게 30초마다 본다 */
    dayAcc += dt;
    if (dayAcc >= 30) {
      dayAcc = 0;
      if (V.rollDay()) { core.emit('changed'); }
    }

    uiAcc += dt;
    if (uiAcc >= 0.3) { uiAcc = 0; ui.tickRefresh(); }

    saveAcc += dt;
    if (saveAcc >= 10) { saveAcc = 0; core.persist(); }

    requestAnimationFrame(loop);
  }

  global.DG = global.DG || {};
  global.DG.game = { boot: boot, start: start };

  /** 진입 — **가입(프로필)이 정해진 뒤에** 게임을 켠다.
   *  account.gate() 가 세이브 키를 정하고 start() 를 돌린다. */
  function boot() {
    global.DG.account.gate(start);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
