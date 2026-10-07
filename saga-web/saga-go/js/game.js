/**
 * 부트스트랩 & 메인 루프 — 사가만리 본편 (위치 기반 수집 + 실시간 사냥 형태)
 * ---------------------------------------------------------------
 * 본편의 놀이 순환은 셋뿐이다:
 *   걷는다  → 일정 거리마다 보급(등용서·사료·명성)을 받는다
 *   만난다  → 인물 등용 · 펫 포획 → 도감이 쌓인다
 *
 * 여기에 한 축이 더 붙어 있다:
 *   자동    자동 순행(auto.js) — 걷지 못하는 동안 판단만 대신한다
 *
 * **네 게임 중 하나다.** 던전은 yeoksa-dungeon, 문답은 yeoksa-quiz,
 * 마을은 yeoksa-village, 사냥터는 yeoksa-side 가 맡는다 — 여기는 걷고 만나는 축만.
 * 경영(영지·태수·교역)은 완전히 뺐다 — 되살리지 않는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var world = global.DG.world;
  var ui = global.DG.ui;

  var lastFrame = 0;
  var uiAcc = 0;
  var saveAcc = 0;

  /* ── 걷기 보급 — 보급 거점 대신, 걸음 자체가 보급이다 ──── */

  /* 어드민이 잡을 수 있는 손잡이다(`core.tuned`). 켤 때 한 번 읽으므로
     바꾼 뒤에는 게임 창을 새로고침해야 듣는다. */
  var SUPPLY_STEP = core.tuned('game.supplyStep', 250);   // m 마다 보급 한 번
  var SUPPLY_GOLD = core.tuned('game.supplyGold', 8);     // 보급마다 딸려오는 금

  function tickSupply() {
    var p = core.save.player;
    if (p.supplyMark > p.distance) { p.supplyMark = p.distance; }
    var got = 0, scrolls = 0;
    while (p.distance - p.supplyMark >= SUPPLY_STEP) {
      p.supplyMark += SUPPLY_STEP;
      p.supplyCount = (p.supplyCount || 0) + 1;
      global.DG.bag.add('feed', 1);
      global.DG.quest.progress('walk', SUPPLY_STEP);
      p.fame += 10;
      p.gold += SUPPLY_GOLD;
      got += 1;
      if (p.supplyCount % 2 === 0) {       // 500m 마다 등용서
        global.DG.bag.add('scroll', 1);
        scrolls += 1;
      }
    }
    if (got) {
      var msg = '🎒 보급 — 🍖 +' + got + ' · 🎖️ +' + (got * 10) + ' · 🪙 +' + (got * SUPPLY_GOLD) +
        (scrolls ? ' · 📜 +' + scrolls : '');
      core.log(msg + ' (누적 ' + core.fmt(p.distance) + 'm)', 'good');
      core.emit('toast', msg);
      core.emit('changed');
    }
  }

  /* ── 세션 스냅샷 & 마무리 카드 (PLAN §5 ④, 표준 B) ──────
   * "세션 시작 시 세이브 스냅샷을 메모리에 두고 차이로 계산한다" — 세이브엔
   * 안 남는다. 셋 중 아무 신호에서나 부른다: 탭이 숨겨질 때(돌아오면 보여준다)
   * ·5분 무입력·자동 순행을 껐을 때.
   */
  var sessionSnap = null;
  var pendingCard = null;      // 숨겨진 동안 잰 diff — 돌아오면 보여주고 비운다
  var lastInputAt = 0;
  var idleFired = false;
  var IDLE_MS = core.tuned('game.idleMs', 5 * 60 * 1000);

  function snapshotSession() {
    var p = core.save.player;
    sessionSnap = { distance: p.distance, gold: p.gold };
    if (global.DG.daily) { global.DG.daily.resetSession(); }
    idleFired = false;
  }

  function sessionDiff() {
    if (!sessionSnap) { return null; }
    var p = core.save.player;
    return {
      steps: Math.max(0, Math.round(p.distance - sessionSnap.distance)),
      gold: Math.max(0, p.gold - sessionSnap.gold),
      meet: global.DG.daily ? global.DG.daily.sessionMeetCount() : 0
    };
  }

  /** 아무 일도 없었으면(막 켰다 끄기 등) 카드를 안 띄운다 */
  function maybeShowSessionCard() {
    var diff = sessionDiff();
    if (!diff || (!diff.steps && !diff.gold && !diff.meet)) { snapshotSession(); return; }
    if (global.DG.event && global.DG.event.live) { return; }   // 다른 조우가 열려 있으면 건너뛴다
    if (ui.showSessionCard) { ui.showSessionCard(diff); }
    snapshotSession();
  }

  function markInput() { lastInputAt = Date.now(); idleFired = false; }

  function initIdleWatch() {
    lastInputAt = Date.now();
    ['keydown', 'pointerdown', 'touchstart'].forEach(function (ev) {
      global.addEventListener(ev, markInput, { passive: true });
    });
  }

  function tickIdle() {
    if (idleFired || document.hidden) { return; }
    if (Date.now() - lastInputAt < IDLE_MS) { return; }
    idleFired = true;
    maybeShowSessionCard();
  }

  /* 주소에 #fps 를 붙이면 프레임 수를 표시한다 (성능 확인용) */
  var fpsBox = null, fpsFrames = 0, fpsAcc = 0, fpsWorst = 0;
  function initFps() {
    if (global.location.hash.indexOf('fps') < 0) { return; }
    fpsBox = document.createElement('div');
    fpsBox.style.cssText = 'position:fixed;left:12px;top:96px;z-index:90;padding:6px 10px;' +
      'border-radius:10px;background:rgba(10,12,16,.82);border:1px solid rgba(255,255,255,.12);' +
      'font:600 11px ui-monospace,Consolas,monospace;color:#9fe8b0;pointer-events:none';
    fpsBox.textContent = 'fps …';
    document.body.appendChild(fpsBox);
  }
  function tickFps(dt) {
    if (!fpsBox) { return; }
    fpsFrames++; fpsAcc += dt;
    if (dt * 1000 > fpsWorst) { fpsWorst = dt * 1000; }
    if (fpsAcc >= 0.5) {
      var fps = fpsFrames / fpsAcc;
      fpsBox.textContent = 'fps ' + fps.toFixed(0) + ' · 최악 ' + fpsWorst.toFixed(0) + 'ms' +
        ' · 대상 ' + world.spawns.length + ' · ' + (['2D', '2.5D', '3D'][world.tiltMode]);
      fpsBox.style.color = fps >= 50 ? '#9fe8b0' : (fps >= 30 ? '#e8d48a' : '#f09a9a');
      fpsFrames = 0; fpsAcc = 0; fpsWorst = 0;
    }
  }

  function start() {
    var fresh = !core.load();

    // 옛 세이브: 보급 기준점이 없으면 지금 거리에서 시작 (누적분 몰아주기 방지)
    if (!core.save.player.supplyMark && core.save.player.distance > 0) {
      core.save.player.supplyMark = core.save.player.distance;
    }
    // 옛 세이브: 연성·승화가 없던 때 잡아 둔 마리수를 영초로 환산한다 (한 번만)
    if (global.DG.growth) { global.DG.growth.migrate(); }

    world.init(document.getElementById('map'), document.getElementById('map-ground'));
    ui.init();
    global.DG.minimap.init();          // 좌하단 미니맵 — 화면에만 쓰는 층이라 판정 뒤에 붙인다
    global.DG.overworld.init();        // 전체 지도(M키) — 마찬가지로 화면 층
    if (global.DG.fieldCombat) { global.DG.fieldCombat.init(); }   // 들판 전투 키(J·E·Q·␣·1~4)
    if (global.DG.adventure) { global.DG.adventure.init(); }       // 여정 등급 보상·천하 등급(§5⑲-7)
    if (global.DG.story) { global.DG.story.init(); }               // 이야기 임무 1~2장(§5⑲-12) — F·O 키

    if (fresh) {
      core.log('여정을 시작합니다. 걸으면 보급을 받고, 만나면 도감이 쌓입니다.', 'info');
    }

    bindTopbar();
    initFps();
    snapshotSession();
    initIdleWatch();
    // 온라인 모드로 저장돼 있으면 서버가 살아 있는지 조용히 확인한다
    if (global.DG.net.mode() === 'online') { global.DG.net.probe(true); }
    lastFrame = performance.now();
    requestAnimationFrame(loop);

    global.addEventListener('beforeunload', function () { core.persist(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        core.persist();
        pendingCard = sessionDiff();
      } else {
        core.save.lastSeen = Date.now();
        var d = pendingCard; pendingCard = null;
        if (d && (d.steps || d.gold || d.meet) && !(global.DG.event && global.DG.event.live)) {
          if (ui.showSessionCard) { ui.showSessionCard(d); }
        }
        snapshotSession();
        wakeLoop();
      }
    });
    global.addEventListener('focus', wakeLoop);
    global.addEventListener('pageshow', wakeLoop);
    global.addEventListener('blur', function () { core.persist(); }); // 포커스만 잃어도 저장
  }

  function bindTopbar() {
    var geoBtn = document.getElementById('btn-geo');
    geoBtn.addEventListener('click', function () {
      if (world.mode === 'geo') {
        world.useKeyboard();
        geoBtn.classList.remove('on');
        ui.toast('키보드 이동으로 돌아갑니다');
        if (ui.syncStick) { ui.syncStick(); }
        return;
      }
      ui.toast('위치 권한을 허용하면 지금 있는 곳의 지도로 이동합니다');
      world.useGeo(function (msg) {
        geoBtn.classList.remove('on');
        ui.toast('⚠️ 위치를 못 받았습니다 · ' + msg);
      }, function (c) {
        geoBtn.classList.add('on');
        ui.toast('📡 현재 위치로 이동 · 오차 ±' + Math.round(c.accuracy) + 'm');
        core.emit('changed');
      });
    });

    var autoBtn = document.getElementById('btn-auto');
    if (autoBtn) {
      var syncAutoBtn = function () {
        autoBtn.classList.toggle('on', global.DG.auto.active());
      };
      syncAutoBtn();
      autoBtn.addEventListener('click', function () {
        var nowOn = global.DG.auto.toggle();
        syncAutoBtn();
        /* 자동 순행을 **껐을 때만** — 켤 때는 막 돌아온 참이라 diff 가 비어 있다 */
        if (!nowOn) { maybeShowSessionCard(); }
      });
      core.on('changed', syncAutoBtn);
    }

    document.getElementById('btn-reset').addEventListener('click', function () {
      if (!confirm('정말 처음부터 다시 시작할까요? 도감·지식 서고가 모두 사라집니다.')) { return; }
      core.reset();
      location.reload();
    });

    /* 지도를 크게 보기 — 도구줄·독·근처 패널을 감춰 지도(캔버스)만 남긴다.
       세이브에는 안 남긴다 — 매번 켜진 채로 열리면 첫 화면부터 조작을 못 찾는다 */
    var focusBtn = document.getElementById('btn-mapfocus');
    if (focusBtn) {
      focusBtn.addEventListener('click', function () {
        var on = document.body.classList.toggle('mapfocus');
        focusBtn.title = on ? '도구줄 다시 보기' : '지도를 크게 봅니다 (도구줄 감추기)';
        ui.toast(on ? '🗺️ 도구줄을 감췄습니다 — 다시 누르면 돌아옵니다' : '도구줄을 다시 보입니다');
      });
    }

    var TILT_LABEL = ['2D', '2.5D', '3D'];
    var TILT_MSG = [
      '🗺️ 2D — 위에서 내려다봅니다',
      '⛰️ 2.5D — 지면을 눕혔습니다',
      '🎥 3D — 등 뒤에서 따라가는 카메라'
    ];
    var tiltBtn = document.getElementById('btn-tilt');
    if (tiltBtn) {
      /* 배율을 라벨에 달아 둔다 — 걸음 배속을 늘 `×n` 으로 보여 주는 것과 같은
         이유다(당겨 놓고 잊으면 왜 안 보이는지 모른다). WebGL 3D 렌더러가 켜져
         있으면(대부분의 기기) 2D·2.5D·3D 어느 시점이든 zoom3d 가 실제로 그려지는
         카메라 배율이다 — 폴백(2D 캔버스)일 때만 camZoom2d 를 보여 준다 */
      var tiltLabel = function () {
        var m = world.tiltMode;
        var z = world.render3dOn ? world.zoom3d : world.camZoom2d;
        return TILT_LABEL[m] + ' ×' + z.toFixed(1);
      };
      tiltBtn.textContent = tiltLabel();
      tiltBtn.classList.toggle('on', world.tilt);
      tiltBtn.addEventListener('click', function () {
        var m = world.cycleTilt();
        tiltBtn.textContent = tiltLabel();
        tiltBtn.classList.toggle('on', m > 0);
        ui.toast(TILT_MSG[m] + ' · 휠·두 손가락·+/- 로 당깁니다');
      });
      core.on('zoom', function () { tiltBtn.textContent = tiltLabel(); });
      core.on('zoom2d', function () { tiltBtn.textContent = tiltLabel(); });
    }

    /* 3인치 모드 — 폰을 멀리 든 것처럼 화면을 확 줄여 넓게 본다 */
    var inchBtn = document.getElementById('btn-3inch');
    if (inchBtn) {
      inchBtn.classList.toggle('on', world.wide3in);
      inchBtn.addEventListener('click', function () {
        var on = world.toggle3inch();
        inchBtn.classList.toggle('on', on);
        ui.toast(on ? '🔍 3인치 모드 — 화면을 멀리서 봅니다' : '🔍 3인치 모드 해제 — 원래 배율로 돌아갑니다');
        if (tiltBtn) { tiltBtn.textContent = tiltLabel(); }
      });
    }

    document.getElementById('btn-help').addEventListener('click', showHelp);
    bindMore();
  }

  /* ── 도구 서랍 (⋯) ────────────────────────────────────────
   * 폰 폭에서만 열린다. 넓은 화면에서는 CSS 가 서랍을 풀어(display:contents)
   * 단추가 도구줄에 그대로 서므로 여기서 하는 일은 아무 뜻이 없다.
   * 단추를 옮기지 않는다 — 옮기면 위에서 건 이벤트를 다시 걸어야 한다.
   */
  function bindMore() {
    var more = document.getElementById('btn-more');
    var drawer = document.getElementById('tools-drawer');
    if (!more || !drawer) { return; }
    function close() {
      drawer.classList.remove('show');
      more.classList.remove('on');
      more.setAttribute('aria-expanded', 'false');
    }
    more.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !drawer.classList.contains('show');
      drawer.classList.toggle('show', open);
      more.classList.toggle('on', open);
      more.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    /* 서랍 안의 무엇을 누르든 닫는다 — 시점·양식은 눌러 본 결과를 지도에서
       봐야 하는데 서랍이 덮고 있으면 볼 수가 없다 */
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('button')) { close(); }
    });
    document.addEventListener('click', function (e) {
      if (!drawer.classList.contains('show')) { return; }
      if (e.target.closest('.tools')) { return; }
      close();
    });
  }

  function showHelp() {
    var el = document.getElementById('encounter');
    el.innerHTML =
      '<div class="enc-card">' +
        '<h3 style="margin:0 0 4px;font-size:18px">🧭 조작 안내</h3>' +
        '<div class="helplist">' +
          '<div><b>이동</b> WASD · 방향키 (Shift 달리기) · 빈 땅을 탭하면 그쪽으로 걷습니다</div>' +
          '<div><b>지도</b> 실제 지도. 📡 를 누르면 지금 있는 곳으로 이동합니다</div>' +
          '<div><b>크게 보기</b> ⛶ 를 누르면 도구줄을 감추고 지도만 남깁니다</div>' +
          '<div><b>시점</b> 2D → 2.5D → 3D 버튼으로 순환합니다 (3D는 내 등 뒤에서 앞길을 내다봅니다)</div>' +
          '<div><b>양식</b> 🖌️ 전통 → 📗 그림책 → 🎴 만화 순으로 그림이 바뀝니다</div>' +
          '<div><b>보급</b> ' + SUPPLY_STEP + 'm 걸을 때마다 사료·명성, 500m 마다 등용서를 받습니다</div>' +
          '<div><b>배속</b> 걸음을 빠르게 하려면 <b>_admin.html</b> 의 균형 손잡이에서 올립니다 (규칙은 그대로)</div>' +
          '<div><b>역참</b> 🏮 지도 위 고정 지점. 들르면 등용서·사료·금을 줍니다 (5분마다 다시 참)</div>' +
          '<div><b>천거</b> ✉️ 역참에서 받은 천거장을 행낭에 넣고 그만큼 걸으면 그 사람이 찾아옵니다</div>' +
          '<div><b>반려</b> 🐾 펫 하나를 곁에 세웁니다. 함께 걸으면 그 종의 영초가 나오고 사이가 깊어집니다</div>' +
          '<div><b>성채</b> 🏯 다른 세력이 지킵니다. 동행 부대로 밀어내면 열두 시간 동안 공물이 들어옵니다</div>' +
          '<div><b>토벌</b> ⚔️ 성채에 적장이 45분간 듭니다. 격문을 쓰고 이기면 그 자리에서 등용 기회</div>' +
          '<div><b>사명</b> 📋 역참에서 받습니다. 채우면 보상과 인장 — 인장 일곱이면 명사가 찾아옵니다</div>' +
          '<div><b>행낭</b> 🎒 별미·향·축문을 씁니다. 가득 차면 역참이 물건을 주지 않습니다</div>' +
          '<div><b>천후</b> 세 시간마다 바뀝니다. 비엔 짐승이, 바람엔 사람이, 안개엔 신수가 많습니다</div>' +
          '<div><b>조우</b> 파란 원 안의 대상을 클릭하거나 아래 <b>만난다</b></div>' +
          '<div><b>등용</b> 기질에 맞는 어필로 호감도 100 달성 (★4 이상은 기질이 숨겨져 있음)</div>' +
          '<div><b>포획</b> 바늘이 초록 구간일 때 스페이스 — 성공하면 명성도 받습니다</div>' +
          '<div><b>도감</b> 모은 인물·펫. 카드를 누르면 열전과 승급 화면이 열립니다</div>' +
          '<div><b>동행</b> 등용한 인물이 함께 걷습니다 — 선두가 지도 위 내 모습이 됩니다</div>' +
          '<div><b>자동</b> 🤖 를 누르면 대신 걷고 만납니다. 세부 설정은 🔮 사관 시트</div>' +
          '<div><b>사관</b> 🔮 온라인 모드에서 군략·대화·천기 (AI 토큰이 자원)</div>' +
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
   *  좁은 화면에서 시트가 게임을 덮으면 30(판정은 dt 로 그대로 흐른다). 만남 창(#encounter)은 3D 가 이 루프에서
   *  돌므로(world3d → encounter3d.tick) 묶지 않는다 */
  function frameGapMs() {
    var fps = core.tuned ? core.tuned('perf.fps', 60) : 60;
    var b = document.body;
    if (b && b.classList.contains('sheet-open') && (global.innerWidth || 0) <= 780) { fps = fps ? Math.min(fps, 30) : 30; }
    return fps > 0 ? 1000 / fps : 0;
  }

  /* 루프 문지기(W-0066) — 'park' 탭이 숨겨졌다: 다음 프레임을 예약조차 안 한다(visibilitychange 가 깨운다)
     · 'wait' 보이지만 창이 포커스를 잃었다: 0.5초마다 한 번만 들여다본다 · 'run' 돈다 */
  function loopGate() {
    if (document.hidden) { return 'park'; }
    return document.hasFocus() ? 'run' : 'wait';
  }
  var parked = false;
  /** 숨김으로 멈춘 루프를 다시 켠다 — 멈춰 있을 때만(사슬이 둘이 되지 않게) */
  function wakeLoop() {
    if (!parked || document.hidden) { return; }
    parked = false; lastFrame = performance.now();
    requestAnimationFrame(loop);
  }

  function loop(now) {
    /* 탭이 숨겨졌거나 창이 포커스를 잃으면 3D 를 완전히 멈춘다 — 브라우저가
       알아서 줄여 주는 건 "다른 탭으로 전환"뿐이고, "화면엔 보이는데 다른
       창을 쓰는 중"은 안 줄여 준다. 이 판이 그 상태로 계속 풀가동해 다른
       작업 CPU 를 잡아먹는다는 제보로 추가(2026-09-08) */
    var gate = loopGate();
    if (gate !== 'run') {
      lastFrame = now;
      if (gate === 'park') { parked = true; return; }
      global.setTimeout(function () { requestAnimationFrame(loop); }, 500);
      return;
    }
    var cap = frameGapMs();
    if (cap && now - lastFrame < cap - 2) { requestAnimationFrame(loop); return; }
    var dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;

    global.DG.auto.update(dt);          // 자동 순행 — 조작을 대신 넣어 준다
    world.update(dt);
    tickSupply();
    global.DG.letter.tick();            // 다 걸은 천거장을 연다
    global.DG.buddy.tick();             // 곁을 걷는 반려가 영초를 물어 온다
    global.DG.fort.tick();              // 사기가 다한 성채에서 손을 뗀다
    global.DG.npc.tick();               // 이 땅에 사는 열 사람 — 가까이 가면 한 마디 한다
    if (global.DG.folk) { global.DG.folk.tick(); }   // ⑱ 탑 둘레 세 시대 사람 — 가까이 가면 한 마디
    global.DG.animal.tick();            // 들·강의 짐승 — 늑대가 붙으면 알린다
    global.DG.event.tick();             // 걷다가 만나는 사건 — 거리로 잰다
    global.DG.ambient.tick();           // 그 사이를 메우는 풍경·발자국(축1)
    global.DG.milestone.tick();         // 이번 주 누적 거리 사다리(축1 다음 후보)
    global.DG.codex.tick();             // 지나가며 본 것에 도장을 찍는다
    if (global.DG.beacon) { global.DG.beacon.tick(dt); }   // 봉수대 3초 홀드(§5①)
    if (global.DG.stela) { global.DG.stela.tick(dt); }     // 15m 안 비석을 저절로 발견(§5⑤)
    if (global.DG.drop) { global.DG.drop.tick(dt); }       // 흩어진 짐을 걷는다(§5⑧)
    if (global.DG.bond) { global.DG.bond.tick(); }         // 함께 걸은 거리로 인연이 쌓인다(§5⑥)
    if (global.DG.fieldCombat) { global.DG.fieldCombat.tick(dt); }   // 들판 적 무리와 싸운다(§5⑨)
    if (global.DG.biome) { global.DG.biome.tick(dt); }               // 지역 이름 띠·랜드마크 발견(§5⑩)
    if (global.DG.landform) { global.DG.landform.tick(dt); }         // 기력·점프·정상 발견(§5⑰)
    if (global.DG.treasure) { global.DG.treasure.tick(dt); }         // 보물 상자·수집 구슬·기척 보기(§5⑲-3)
    if (global.DG.track) { global.DG.track.tick(dt); }               // 흔적·큰 짐승 사냥 의뢰(§5㉑)
    if (global.DG.weapon && global.DG.weapon.paintGlow) { global.DG.weapon.paintGlow(); }   // 무기 빛 → 선두 외곽선(§5㉑)
    if (global.DG.cooking) { global.DG.cooking.tick(dt); }           // 채집·솥·요리 버프(§5⑲-6)
    if (global.DG.fishing) { global.DG.fishing.tick(dt); }           // 낚시터·줄다리기·낚시 조합(§5⑲-24)
    if (global.DG.achieve) { global.DG.achieve.tick(dt); }           // 업적 셈·알림(§5⑲-25)
    if (global.DG.dispatch) { global.DG.dispatch.tick(dt); }         // 탐사 파견 — 역참 게시판·다 된 알림(§5⑲-26)
    if (global.DG.frost) { global.DG.frost.tick(dt); }               // 서리봉 고원 — 발견·눈·명소(§5⑲-27)
    if (global.DG.fork) { global.DG.fork.tick(dt); }                                                  // 세갈래 고을 — 발견·명소·이야기 상태(§5⑲-65)
    if (global.DG.vault) { global.DG.vault.tick(dt); }                                                // 갈무리 벌 — 발견·명소·이야기 상태(§5⑲-61)
    if (global.DG.amber) { global.DG.amber.tick(dt); }                                           // 굳은 거리 — 발견·명소·이야기 상태(§5⑲-57)
    if (global.DG.skyport) { global.DG.skyport.tick(dt); }           // 은하 나루 — 발견·명소·틈 문(§5⑲-37)
    if (global.DG.crossing) { global.DG.crossing.tick(dt); }         // 틈새 갈림길 — 발견·명소·틈 문(§5⑲-41)
    if (global.DG.sunken) { global.DG.sunken.tick(dt); }             // 잠긴 도읍 — 발견·명소·해무 문(§5⑲-44)
    if (global.DG.mount) { global.DG.mount.tick(dt); }                                           // 탈것 — 내림 판정·단추(§5⑲-61)
    if (global.DG.nightEcho) { global.DG.nightEcho.tick(dt); }                                   // 결말 뒤 밤의 잔불(§5⑲-56)
    if (global.DG.stormEye) { global.DG.stormEye.tick(dt); }                                     // 8부 먹구름 눈·여섯 매듭(§5⑲-52)
    if (global.DG.skyRoute) { global.DG.skyRoute.tick(dt); }         // 구름 위 항로 — 섬 셋·바람 기둥·발견(§5⑲-48)
    if (global.DG.eraSites) { global.DG.eraSites.tick(dt); }         // 3부 시대 명소 — 조선소 발견·그림(§5⑲-34)
    if (global.DG.domain) { global.DG.domain.tick(dt); }             // 숨은 터·원기·주간 보스(§5⑲-9)
    if (global.DG.fieldBoss) { global.DG.fieldBoss.tick(dt); }       // 들판 보스 보상 꽃(§5⑲-10)
    if (global.DG.story) { global.DG.story.tick(dt); }               // 이야기 임무 — 목표·대화·금빛 기둥(§5⑲-12)
    if (global.DG.skyIsle) { global.DG.skyIsle.tick(dt); }           // 구름섬·바람 기둥(§5⑲-20)
    if (!global.DG_NO_DRAW) {
      world.draw();
      global.DG.minimap.tick(dt);      // 미니맵은 매 프레임이 아니라 제 박자로 다시 그린다
      global.DG.overworld.tick(dt);    // 전체 지도는 열려 있을 때만 다시 그린다
    }

    uiAcc += dt;
    if (uiAcc >= 0.3) { uiAcc = 0; ui.tickRefresh(); tickIdle(); }

    tickFps(dt);
    global.DG.perf.tick(dt);            // 버거우면 스스로 품질을 낮춘다

    saveAcc += dt;
    if (saveAcc >= 10) { saveAcc = 0; core.persist(); }

    requestAnimationFrame(loop);
  }

  global.DG = global.DG || {};
  /** 자가진단이 걷기 보급을 직접 굴려 볼 수 있게 노출한다 */
  global.DG.game = {
    tickSupply: tickSupply, SUPPLY_STEP: SUPPLY_STEP, frameGapMs: frameGapMs,
    /** 자가진단이 5분 실제로 안 기다리고도 마무리 카드 경로를 재볼 수 있게 */
    snapshotSession: snapshotSession, sessionDiff: sessionDiff, maybeShowSessionCard: maybeShowSessionCard,
    /** 자가진단용(W-0066) — 문지기 판정과 숨김 정지·깨우기. 실제 루프는 건드리지 않는다 */
    loopGate: loopGate, wakeLoop: wakeLoop, _park: function (v) { parked = !!v; }, _parked: function () { return parked; }
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
