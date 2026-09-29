/**
 * 부트스트랩 & 메인 루프 — 사가블로 (오픈월드 필드 액션 RPG)
 * ---------------------------------------------------------------
 * 기본은 마을·필드를 도는 것이다. 던전(굴혈)은 지도에서 걸어 들어가야
 * 하는 **이벤트 던전** — 처음부터 강제로 내려가는 구조가 아니다.
 * 굴혈 안에서는 원작식 로그라이크가 그대로 돈다:
 *   내려간다 → 방을 치운다 → 은사를 고른다 → 더 내려가거나 챙겨서 나온다
 *
 * 지도를 걷는 게임(deungyong-go)과 **완전히 다른 프로젝트**다. 세이브도 따로 쓴다
 * (yeoksa-dungeon/save/v1). 여기서 고친 것은 다른 게임에 가지 않는다.
 *
 * 인물은 어디서 오나 — 지도가 없으니 조우로 얻을 수 없다. 그래서
 *   시작할 때 출사표로 3명,
 *   보스 층(3층마다)을 답파하면 1명이 합류한다.
 * 도감이 던전으로 자라는 구조다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var ui = global.DG.ui;

  var lastFrame = 0;
  var uiAcc = 0;
  var saveAcc = 0;
  var loopErrShown = {};
  /* 2026-09-08 — "사가블로 끊김" 추적. dungeon3d.js의 render() 안(actors/
     occ/fx/present/room/field/finalize)을 다 재도 dt=300~700ms대 튐이 그
     안에서 안 잡혔다(합쳐도 몇 ms) — 무게가 render() 밖, 즉 이 loop() 자체
     (auto.update/dungeonView.update/minimap.tick/ui.tickRefresh) 에 있다는
     뜻이었다. persist()도 몸통에서 재게 고쳤는데 여전히 안 찍혀 용의선상
     에서 더 밀렸다. 이 loop()의 각 구간도 매 프레임 새로 재 breakdown을
     남긴다 — dungeon3d.js와 같은 요령(즉시-튐, 400ms 쿨다운). */
  var lastLoopWallT = 0, lastSpikeLoopLogT = 0;
  var lastAutoMs = 0, lastViewUpdateMs = 0, lastDrawMs = 0, lastMinimapMs = 0, lastUiMs = 0;

  /* ── 인물 합류 ────────────────────────────────────────── */

  var START_PARTY = 3;

  /** 아직 없는 인물 중 하나 (등급이 낮은 쪽을 먼저 — 처음부터 ★5가 오면 재미가 없다) */
  function pickNewHero(maxRarity) {
    var pool = [], i;
    for (i = 0; i < global.DG.data.heroes.length; i++) {
      var h = global.DG.data.heroes[i];
      if (h.rarity > maxRarity) { continue; }
      if (!core.save.dex.heroes[h.id]) { pool.push(h); }
    }
    if (!pool.length) { return null; }
    return core.pick(pool);
  }

  /** 인물을 도감에 넣고 자리가 있으면 동행에 세운다 */
  function joinHero(h, why) {
    var dex = core.save.dex.heroes;
    if (dex[h.id]) {
      dex[h.id].count += 1;                 // 중복 — 승급 재료
      core.log('✨ ' + h.name + ' 이(가) 또 합류 — 중복 +1 (' + why + ')', 'good');
    } else {
      dex[h.id] = { count: 1, firstAt: Date.now() };
      global.DG.hero.ensure(h.id);
      core.gainFeat(h.rarity * 8, '합류');
      core.log('🤝 ' + h.name + ' 이(가) 합류했다 (' + why + ')', 'good');
      core.emit('dex:new', { cat: 'heroes', id: h.id });
    }
    if (core.save.party.length < 5 && core.save.party.indexOf(h.id) < 0) {
      core.save.party.push(h.id);
    }
    core.emit('changed');
  }

  /** 보스 층을 깼을 때 — 층이 깊을수록 좋은 인물이 온다 */
  function bossReward(floor) {
    var maxRar = floor >= 21 ? 5 : (floor >= 12 ? 4 : (floor >= 6 ? 3 : 2));
    var h = pickNewHero(maxRar);
    if (!h) {                                // 다 모았으면 중복으로 준다
      h = core.pick(global.DG.data.heroes);
    }
    joinHero(h, '제' + floor + '층 보스');
    core.emit('toast', '🤝 ' + h.name + ' 합류!');
  }

  /* ── 부트 ─────────────────────────────────────────────── */

  /* 2026-09-07 — "화면이 갈색(배경색)만 채워지고 아무것도 안 그려진다"는
     제보가 실기기에서 반복됐는데, loop()의 프레임별 catch(§ 위)는 매 프레임
     예외만 잡을 뿐 **부팅 자체가 던지는 예외는 못 잡는다** — start() 안에서
     (특정 세이브 상태에서만) 뭔가 던지면 requestAnimationFrame 이 걸리기도
     전에 조용히 멈춰, 배경만 칠해진 채 토스트도 안 뜨는 이 증상과 정확히
     들어맞는다. 기존 프로필은 account.gate() 가 start() 를 동기로 부르고
     새 프로필은 가입 화면 버튼 클릭 뒤 부르므로, start() 자신을 감싸면 두
     경로 다 잡힌다. */
  function start() {
    try {
      startInner();
    } catch (e) {
      reportBootError(e);
    }
  }

  function reportBootError(e) {
    if (global.console) { global.console.error('[boot] 시작 실패', e); }
    try {
      var msg = String((e && e.stack) || (e && e.message) || e);
      var box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:12px;z-index:99999;background:#2a0f0f;' +
        'color:#ffdada;font:12px/1.5 monospace;padding:14px;border-radius:10px;overflow:auto;' +
        'white-space:pre-wrap;border:1px solid #a33;box-shadow:0 8px 30px rgba(0,0,0,.6)';
      box.textContent = '⚠️ 시작 실패 — 이 화면을 스크린샷으로 남겨 주세요\n\n' + msg;
      document.body.appendChild(box);
    } catch (e2) { /* 이것마저 실패하면 콘솔 로그가 마지막 수단 */ }
  }

  function startInner() {
    var fresh = !core.load();
    /* 옛 `core.reset()` 은 빈 세이브를 그대로 저장해 v:1 이 박혀 있었다 —
       그런 세이브는 load() 가 "있다"고 읽어 fresh 가 false 가 되고, 출사표가
       다시 안 나가 동행·도감이 영영 비어 던전 입장(부대 필요)도 막히는
       갇힌 자리였다. 세이브가 있어도 **동행·도감이 둘 다 빈 채**라면 아직
       한 번도 인물을 못 얻은 것과 같으므로 출사표를 다시 내보낸다 */
    if (!fresh && !core.save.party.length && !Object.keys(core.save.dex.heroes).length) {
      fresh = true;
    }

    /* 행상 — 회차가 끝날 때마다 새 물건이 온다(vendor.js 가 dungeon:end 를 듣는다) */
    if (global.DG.vendor) { global.DG.vendor.init(); }

    /* 목표판(§5.6) — vendor.js 와 같은 자리, 같은 이유로 여기서 켠다 */
    if (global.DG.goals) { global.DG.goals.init(); }
    if (global.DG.scenario) { global.DG.scenario.init(); }   // 시나리오 장 진행(scenario.js) — 마을에 서면 이야기가 이어진다

    /* 던전이 끝나면 마을로 돌아온다.
       **dungeonView.init() 보다 먼저 걸어 둔다** — 화면도 dungeon:end 를 듣고
       스스로 내려가는데, 그때 마을이 이미 켜져 있어야 한 틱 검게 깜빡이지 않는다.
       core.on 은 걸어 둔 순서대로 부르므로, 이 순서가 곧 판정이다. */
    core.on('dungeon:end', function () {
      global.DG.town.enter({ fromDungeon: true });
    });

    /* **장면은 하나만 켜져 있어야 한다.** 둘이 동시에 켜지면 화면(dungeon-view)이
       마을을 그리는 동안 던전이 뒤에서 조용히 흘러간다 — 맞고 있는데 마을이
       보이는 꼴이다. 그 규칙을 여기서 지킨다. dungeon.js 는 마을을 몰라도 된다
       (자동 순행처럼 enter 를 직접 부르는 길이 여럿이라, 부르는 쪽마다
       마을을 끄게 맡기면 반드시 하나가 빠진다). */
    core.on('dungeon:enter', function () { global.DG.town.leave(); });

    ui.init();
    global.DG.dungeonView.init();
    if (global.DG.minimap) { global.DG.minimap.init(); }   // 우상단 미니맵 (PLAN 27절)

    if (fresh) {
      /* 출사표 — 맨몸으로는 던전에 들어갈 수 없으니 셋을 붙여 준다.
         2026-09-11 — 여태는 pickNewHero(3)가 무작위로 골라 조용히
         합류시켰는데, 사용자가 "시작 캐릭터를 직접 고르게" 요청 — 화면으로
         바꾼다(js/starter.js, account.js의 "부트를 멈추고 화면을 띄운 뒤
         콜백으로 이어간다" 패턴을 그대로 본떴다). `finishBoot()`(마을 진입·
         루프 시작)는 그 확인 콜백이 온 뒤에야 돈다 — town.enter() 가 아직
         한 번도 안 불린 시점이라 화면이 잠깐이라도 마을을 보여 준 뒤
         picker가 덮는 일이 없다. */
      global.DG.starter.show(START_PARTY, function (ids) {
        ids.forEach(function (id) {
          var h = global.DG.data.find(id);
          if (h) { joinHero(h, '출사표'); }
        });
        core.log('출사표를 올렸습니다. 아래로 내려가면 될 일입니다.', 'info');
        finishBoot();
      });
    } else {
      finishBoot();
    }
  }

  /** 부트의 나머지 — 출사표가 필요 없거나(기존 세이브), 방금 픽커가
   *  끝난 뒤에 이어진다. 기존 세이브라면 이 함수가 예전처럼 startInner()
   *  본문 그대로 이어지므로 동작이 한 틱도 안 바뀐다. */
  function finishBoot() {
    /* 보스 층을 깨면 인물이 합류한다 — 층을 내려가는 순간에 판정한다 */
    core.on('dungeon:floor', function (floor) {
      var cleared = floor - 1;               // 방금 깬 층
      if (cleared >= 1 && global.DG.dungeonData.isBossFloor(cleared)) {
        bossReward(cleared);
      }
    });

    /* 마을에서 시작한다 — 원작에서 판이 열리면 야영지에 서 있다.
       예전에는 카드 한 장(ui.renderCamp)이 첫 화면이었다. */
    global.DG.town.enter();

    bindTopbar();
    lastFrame = performance.now();
    requestAnimationFrame(loop);

    global.addEventListener('beforeunload', function () { core.persist(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { core.persist(); }
      else { core.save.lastSeen = Date.now(); }
    });
    global.addEventListener('blur', function () { core.persist(); }); // 포커스만 잃어도 저장
  }

  function bindTopbar() {
    /* 도구 서랍 (⋯) — 사가고와 같은 결(js/account.js, js/game.js 참고):
       폰 폭(600px 이하)에서만 닫힌 채로 시작한다. 넓은 화면에서는 CSS 가
       서랍을 풀어(display:contents) 단추가 도구줄에 그대로 서므로 여기서
       하는 일은 아무 뜻이 없다. */
    var moreBtn = document.getElementById('btn-more');
    var drawer = document.getElementById('tools-drawer');
    if (moreBtn && drawer) {
      var closeDrawer = function () {
        drawer.classList.remove('show');
        moreBtn.classList.remove('on');
        moreBtn.setAttribute('aria-expanded', 'false');
      };
      moreBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = !drawer.classList.contains('show');
        drawer.classList.toggle('show', open);
        moreBtn.classList.toggle('on', open);
        moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      /* 서랍 안의 무엇을 누르든 닫는다 — 양식·소리를 눌러 본 결과를 봐야 하는데
         서랍이 덮고 있으면 볼 수가 없다 */
      drawer.addEventListener('click', function (e) {
        if (e.target.closest('button')) { closeDrawer(); }
      });
      document.addEventListener('click', function (e) {
        if (!drawer.classList.contains('show')) { return; }
        if (e.target.closest('.tools')) { return; }
        closeDrawer();
      });
      global.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closeDrawer(); }
      });
    }

    var autoBtn = document.getElementById('btn-auto');
    if (autoBtn) {
      var syncAutoBtn = function () {
        autoBtn.classList.toggle('on', global.DG.auto.active());
      };
      syncAutoBtn();
      autoBtn.addEventListener('click', function () {
        global.DG.auto.toggle();
        syncAutoBtn();
      });
      core.on('changed', syncAutoBtn);
    }

    document.getElementById('btn-reset').addEventListener('click', function () {
      if (!confirm('정말 처음부터 다시 시작할까요? 도감·장비·기록이 모두 사라집니다.')) { return; }
      core.reset();
      location.reload();
    });

    /* 소리 — 원작의 감각에서 큰 몫이라 켠 채로 시작한다(sfx.js).
       브라우저 규칙 때문에 **첫 눌림 전에는 소리가 안 난다** — 이 버튼을 누르는 것이
       대개 그 첫 눌림이 된다. sfx.js 가 스스로 깨어나므로 여기서는 켜고 끄기만 한다. */
    var soundBtn = document.getElementById('btn-sound');
    if (soundBtn && global.DG.sfx) {
      var S = global.DG.sfx;
      var syncSoundBtn = function () {
        var on = S.enabled();
        soundBtn.textContent = on ? '🔊' : '🔇';
        soundBtn.classList.toggle('on', on);
      };
      syncSoundBtn();
      soundBtn.addEventListener('click', function () {
        S.setEnabled(!S.enabled());
        syncSoundBtn();
        ui.toast(S.enabled() ? '🔊 소리를 켰습니다' : '🔇 소리를 껐습니다');
      });
    }

    document.getElementById('btn-help').addEventListener('click', showHelp);
  }

  function showHelp() {
    var el = document.getElementById('encounter');
    el.innerHTML =
      '<div class="enc-card">' +
        '<h3 style="margin:0 0 4px;font-size:18px">🕳️ 조작 안내</h3>' +
        '<div class="helplist">' +
          '<div><b>이동</b> WASD · 방향키 · 화면을 누른 채 끌면 그쪽으로 걷습니다</div>' +
          '<div><b>확대</b> 손가락 둘로 벌리거나 오므립니다(휠도 됩니다) · <b>🎥</b> 로 시점 전환</div>' +
          '<div><b>마을</b> 사람과 표식은 <b>다가서면</b> 말이 걸립니다 — ' +
            '굴혈 🕳️ 로 들어가고, 역참 🌀 으로 밟아 둔 층으로 건너뜁니다</div>' +
          '<div><b>공격</b> 사거리에 들어오면 알아서 칩니다 (평타)</div>' +
          '<div><b>무예</b> Z X C V — <b>직업마다 아홉</b>. 배워서 네 칸에 겁니다 (📜 무예)</div>' +
          '<div><b>직업</b> <b>장착한 무기</b>가 정합니다 — 각궁이면 궁장, 선채면 책사…</div>' +
          '<div><b>단약</b> 1 2 3 4 — 요대에서 꺼내 마십니다 (원작의 그 넉 줄)</div>' +
          '<div><b>방</b> 적을 다 잡으면 문이 열립니다. 다음 방은 골라서 갑니다</div>' +
          '<div><b>은사</b> 층을 내려갈 때 셋 중 하나. <b>회차가 끝나면 사라집니다</b></div>' +
          '<div><b>우물·사당</b> 💧 한 번 체력 40% · ⛩️ 은사 하나를 바로 준다</div>' +
          '<div><b>보스</b> 3층마다 마지막 방. 답파하면 <b>새 인물이 합류</b>합니다</div>' +
          '<div><b>감정</b> 양품 이상은 <b>미확인</b>으로 나옵니다 \u2014 감정서를 태워 엽니다</div>' +
          '<div><b>내구</b> 층마다 닳습니다. 부서지면 값을 못 내니 <b>행상에서 수리</b>합니다</div>' +
          '<div><b>저항</b> 적마다 안 통하는 <b>결</b>이 있습니다 — 위쪽 줄에 뜹니다</div>' +
          '<div><b>요구</b> 좋은 물건은 <b>인물 레벨</b>이 차야 입습니다</div>' +
          '<div><b>역참</b> 5층마다 밟으면 다음부터 거기서 시작합니다</div>' +
          '<div><b>주옥</b> 접사가 <b>굴러 나오는</b> 박을 것 — 부위를 안 가립니다 (🔨 세공)</div>' +
          '<div><b>소리</b> 🔊 로 끕니다. <b>고유</b>가 떨어지면 종소리가 납니다</div>' +
          '<div><b>노획물</b> 층을 내려갈 때·탈출할 때 확정. 쓰러지면 <b>전부 잃습니다</b></div>' +
          '<div><b>자동</b> 🤖 를 누르면 대신 돌아 줍니다 (본영에서 세부 설정)</div>' +
        '</div>' +
        '<button class="btn primary wide" id="help-ok">확인</button>' +
      '</div>';
    el.classList.add('show');
    document.getElementById('help-ok').addEventListener('click', function () {
      el.classList.remove('show'); el.innerHTML = '';
    });
  }

  /* 한 프레임이 예외로 죽어도 다음 프레임을 계속 건다 — 안 그러면 여기서
     requestAnimationFrame 이 다시 안 걸려 화면이 그 자리에 통째로 멈춘다
     (걷는 도중 조우·방 전환처럼 상태 의존적으로만 터지는 예외라 자가진단·
     로딩 확인으로는 못 잡았다, 2026-09-04 "사가블로가 멈춘다" 제보로 확인) */
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
    try {
      var wallNow = performance.now();
      if (lastLoopWallT !== 0) {
        var wallDt = wallNow - lastLoopWallT;
        if (wallDt > 40 && wallDt < 2000 && wallNow - lastSpikeLoopLogT > 400) {
          lastSpikeLoopLogT = wallNow;
          if (global.console) {
            global.console.log('[던전 loop 튐]', 'dt=' + wallDt.toFixed(1) + 'ms' +
              ' auto=' + lastAutoMs.toFixed(1) + ' viewUpdate=' + lastViewUpdateMs.toFixed(1) +
              ' draw=' + lastDrawMs.toFixed(1) + ' minimap=' + lastMinimapMs.toFixed(1) +
              ' ui=' + lastUiMs.toFixed(1));
          }
        }
      }
      lastLoopWallT = wallNow;

      var dt = Math.min((now - lastFrame) / 1000, 0.1);
      lastFrame = now;

      var segT0 = performance.now();
      global.DG.auto.update(dt);
      if (global.DG.mount) { global.DG.mount.frame(); }                      // 탈것 — 내림 판정·단추(mount.js)
      lastAutoMs = performance.now() - segT0;

      segT0 = performance.now();
      global.DG.dungeonView.update(dt);
      lastViewUpdateMs = performance.now() - segT0;

      /* 마을도 같은 화면에 그린다 — 마을과 던전은 한 무대를 나눠 쓴다 */
      segT0 = performance.now();
      if (!global.DG_NO_DRAW &&
          (global.DG.dungeon.active() || global.DG.town.active())) {
        global.DG.dungeonView.draw();
      }
      lastDrawMs = performance.now() - segT0;

      segT0 = performance.now();
      if (!global.DG_NO_DRAW && global.DG.minimap) { global.DG.minimap.tick(dt); }
      lastMinimapMs = performance.now() - segT0;

      uiAcc += dt;
      segT0 = performance.now();
      if (uiAcc >= 0.3) { uiAcc = 0; ui.tickRefresh(); }
      lastUiMs = performance.now() - segT0;

      saveAcc += dt;
      if (saveAcc >= 10) {
        saveAcc = 0;
        /* persist() 자신이 실측·로그를 찍는다(core.js) — 이 호출뿐 아니라
           다른 자리(item.js·hero.js·dungeon.js 등)가 부르는 것도 같이 잡힌다. */
        core.persist();
      }
    } catch (e) {
      lastFrame = now;
      if (global.console) { global.console.error('[loop] 프레임 실패, 다음 프레임으로 넘어감', e); }
      /* 2026-09-07 — 폰 실기기에서 화면이 통째로 비는데(콘솔 볼 도구가 없어)
         원인을 특정 못 하는 제보가 반복됐다. 매 프레임 같은 예외가 반복되면
         화면이 정지 없이 매 틱 비어 보이는 것과 똑같이 보인다 — 이 캐치가
         잡아내는 첫 예외 메시지를 딱 한 번 토스트로 띄워 스크린샷에 실제
         오류문이 찍히게 한다(메시지별 1회만, 도배 방지). */
      try {
        var emsg = String((e && e.message) || e);
        if (ui && ui.toast && !loopErrShown[emsg]) {
          loopErrShown[emsg] = true;
          ui.toast('⚠️ ' + emsg.slice(0, 140));
        }
      } catch (e2) { /* 토스트 자체가 죽어도 루프는 계속 돈다 */ }
    }
    requestAnimationFrame(loop);
  }

  global.DG = global.DG || {};
  /** 자가진단이 합류 규칙을 직접 굴려 볼 수 있게 노출한다 */
  global.DG.game = {
    START_PARTY: START_PARTY, frameGapMs: frameGapMs,
    pickNewHero: pickNewHero, joinHero: joinHero, bossReward: bossReward
  };

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
