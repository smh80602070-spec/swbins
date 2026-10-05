/**
 * 부트스트랩 & 메인 루프 — 사가스토리 (원작식)
 * ---------------------------------------------------------------
 * 놀이 순환은 셋이다:
 *   뛴다 → 썬다 → 오른다 (레벨이 오르면 다음 사냥터가 열린다)
 *
 * 다른 셋과 **완전히 다른 프로젝트**다. 세이브도 따로 쓴다 (yeoksa-side/save/v1).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var ui = global.DG.ui;
  var S = global.DG.side;

  var lastFrame = 0;
  var uiAcc = 0;
  var saveAcc = 0;
  var booted = false;   // start() 가 끝까지 돌았는지 — retry3d() 가 이걸로 이중 init() 을 막는다

  function start() {
    var fresh = !core.load();

    if (global.DG.sideView3d) { global.DG.sideView3d.init(document.getElementById('stage3d')); }
    global.DG.sideView.init(document.getElementById('stage'));
    if (global.DG.quest) { global.DG.quest.init(); }   // 사명이 'side:kill' 을 듣기 시작한다
    if (global.DG.achieve) { global.DG.achieve.init(); }   // 업적이 'changed' 를 듣기 시작한다(PLAN 33절)
    ui.init();
    bindKeys();

    /* 싸울 몸이 필요하다 — 무인 기질 인물 하나를 앞에 세운다.
       **`fresh`(세이브 자체가 없음) 뿐 아니라 동행이 빈 경우도 잡는다** —
       `↺ 처음부터`는 core.reset() 으로 '있는' 빈 세이브를 새로 쓰고 reload 하므로
       다음 부팅에서 core.load() 가 true 를 돌려줘 fresh 가 거짓이 된다. 그러면
       도감·동행이 영영 빈 채로 남아 다시는 아무도 못 고르는 채로 갇힌다
       (2026-09-01 실기기에서 실제로 밟힌 자리) */
    if (fresh || !core.save.party.length) {
      var pool = global.DG.data.heroes.filter(function (h) {
        return h.trait === 'might' && h.rarity <= 3;
      });
      var me = core.pick(pool.length ? pool : global.DG.data.heroes);
      core.save.dex.heroes[me.id] = { count: 1, firstAt: Date.now() };
      global.DG.hero.ensure(me.id);
      core.save.party = [me.id];
      core.log('사냥을 나갑니다. ' + me.name + ' 의 몸으로 싸웁니다.', 'info');
    }

    /* 오픈월드 — 쉬는 화면(사냥터 고르기 버튼판) 없이 곧장 들판으로 걸어 들어간다.
       동행이 없을 때만 그 안내가 뜬 camp 화면이 남는다.
       **자가진단(DG_NO_ACCOUNT)에서는 부르지 않는다** — 진단은 매 항목이 run=null
       인 채로 시작해 제 손으로 enter() 하는 것을 전제로 짜여 있다. 여기서 미리
       사냥터에 들어가 버리면 씨앗 난수가 밀려 모든 뒷 항목의 수치가 흔들린다 */
    if (!global.DG_NO_ACCOUNT) { S.resume(); }
    if (global.DG.scenario) { global.DG.scenario.init(); }   // 시나리오 장 진행(scenario.js) — 세이브·동행이 다 준비된 뒤

    bindTopbar();
    lastFrame = performance.now();
    requestAnimationFrame(loop);

    global.addEventListener('beforeunload', function () { core.persist(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { core.persist(); }
      else { core.save.lastSeen = Date.now(); }
    });
    global.addEventListener('blur', function () { core.persist(); }); // 포커스만 잃어도 저장
    booted = true;
  }

  /** 로딩 최적화(PLAN 27절) — three.js(vendor, 716KB)를 index.html 에서 `async`
   *  로 받는다. 대부분은 start() 안의 첫 init() 이 이미 THREE 를 물고 성공하지만,
   *  느린 회선에서는 그보다 늦게 도착할 수 있다 — 그때는 start() 가 이미
   *  `ready=false`(2D 대체)로 지나간 뒤이니, vendor 스크립트의 onload 가 이걸
   *  불러 다시 한 번 켠다(side-view.js 는 매 프레임 sideView3d.ready() 를
   *  다시 묻기 때문에 다음 프레임부터 3D 로 자연스럽게 넘어간다).
   *  **booted 가 아직 false 면 아무 것도 안 한다** — start() 가 곧 스스로
   *  init() 을 부를 것이므로, 여기서 먼저 불렀다간 캔버스 하나에 WebGLRenderer
   *  가 두 번 물려 컨텍스트가 샌다 */
  function retry3d() {
    if (!booted) { return; }
    if (global.DG.sideView3d && !global.DG.sideView3d.available()) {
      global.DG.sideView3d.init(document.getElementById('stage3d'));
    }
  }

  /* 2026-09-09 — "키세팅이 있어야겠지"(사가블로·사가의숲과 같은 요청).
     WASD·방향키는 하드코딩 그대로 두고(실수로 못 쓰게 되면 안 된다),
     방향별로 하나 더 쓸 키만 고르게 한다. */
  var KEYMAP_DEFAULT = { up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright' };
  var remapping = null;
  function keymap() {
    var s = core.save && core.save.settings;
    var km = s && s.keymap;
    if (!km) { return KEYMAP_DEFAULT; }
    var out = {}, k;
    for (k in KEYMAP_DEFAULT) { out[k] = km[k] || KEYMAP_DEFAULT[k]; }
    return out;
  }
  function setKeymapKey(action, key) {
    if (!core.save || !core.save.settings) { return; }
    core.save.settings.keymap = keymap();
    core.save.settings.keymap[action] = key;
    core.persist();
  }
  function beginRemap(action) { remapping = action; }

  /* 키보드 — **원작 배치**다.
     ← → 달리기 · ↑ 오르기/문 · ↓ 내려가기 · Space 점프(↓ 와 함께면 발판 빠져나가기) ·
     1~4 스킬 · Q 탕약 · Shift 회피(PLAN 12절, 원작에는 없던 자리라 새로 골랐다).
     ↑ 를 점프로 두면 사다리와 부딪친다. */
  function bindKeys() {
    global.addEventListener('keydown', function (e) {
      if (remapping) {
        if (e.key !== 'Escape') { setKeymapKey(remapping, e.key.toLowerCase()); }
        remapping = null;
        core.emit('dg:keyremap');
        e.preventDefault();
        return;
      }
      /* 첫 발 장면(story.js) 동안은 조작이 안 먹는다 — Space·Enter 다음 줄, Esc 건너뛰기 */
      var ST = global.DG.story;
      if (ST && ST.isOpen()) {
        if (e.key === ' ' || e.key === 'Enter') { ST.next(); }
        else if (e.key === 'Escape') { ST.skip(); }
        else if (e.key === '1' || e.key === '2' || e.key === '3') {   // 고르기 장면 — 숫자로도 고른다
          var cc = ST.current(), oo = cc && cc.pick && cc.choice.options[Number(e.key) - 1];
          if (oo) { ST.pick(oo.key); }
        }
        e.preventDefault();
        return;
      }
      var km = keymap();
      var k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a' || k === km.left) { S.setInput('left', true); }
      else if (k === 'arrowright' || k === 'd' || k === km.right) { S.setInput('right', true); }
      else if (k === 'arrowup' || k === 'w' || k === km.up) { S.setInput('up', true); }
      else if (k === 'arrowdown' || k === 's' || k === km.down) { S.setInput('down', true); }
      else if (k === ' ') { S.setInput('jump', true); }
      else if (k === 'q') { S.drink(); }
      else if (k === 'e') { if (global.DG.party) { global.DG.party.cycle(); } }   // 동료 교대(§5-8)
      else if (k === 'shift') { if (!e.repeat) { S.holdStart(); } }   // §5-1 — 길게 누르면 고유 조작
      else if (k === 'm') { ui.toggleOverworldMap(); }
      else if (k >= '1' && k <= '8') { S.castSkill(parseInt(k, 10) - 1); }
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) >= 0) {
        if (e.target === document.body) { e.preventDefault(); }
      }
    });
    global.addEventListener('keyup', function (e) {
      var km = keymap();
      var k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a' || k === km.left) { S.setInput('left', false); }
      else if (k === 'arrowright' || k === 'd' || k === km.right) { S.setInput('right', false); }
      else if (k === 'arrowup' || k === 'w' || k === km.up) { S.setInput('up', false); }
      else if (k === 'arrowdown' || k === 's' || k === km.down) { S.setInput('down', false); }
      else if (k === 'shift') { S.holdEnd(); }
    });
    global.addEventListener('blur', function () {
      S.setInput('left', false); S.setInput('right', false);
      S.setInput('up', false); S.setInput('down', false);
      S.cancelHold();
    });
  }

  /* ── 도구 서랍 (⋯) — 사가고 UI와 같은 결 ────────────────────
   * 폰 폭에서만 열린다. 넓은 화면에서는 CSS 가 서랍을 풀어(display:contents)
   * 단추가 도구줄에 그대로 서므로 여기서 하는 일은 아무 뜻이 없다.
   */
  function bindTopbar() {
    var moreBtn = document.getElementById('btn-more');
    var drawer = document.getElementById('tools-drawer');
    if (moreBtn && drawer) {
      function closeDrawer() {
        drawer.classList.remove('show');
        moreBtn.classList.remove('on');
        moreBtn.setAttribute('aria-expanded', 'false');
      }
      moreBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = !drawer.classList.contains('show');
        drawer.classList.toggle('show', open);
        moreBtn.classList.toggle('on', open);
        moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      /* 서랍 안의 무엇을 누르든 닫는다 — 눌러 본 결과를 화면에서 봐야 하는데
         서랍이 덮고 있으면 볼 수가 없다 */
      drawer.addEventListener('click', function (e) {
        if (e.target.closest('button, a')) { closeDrawer(); }
      });
      document.addEventListener('click', function (e) {
        if (drawer.classList.contains('show') && !drawer.contains(e.target) && e.target !== moreBtn) {
          closeDrawer();
        }
      });
      global.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closeDrawer(); }
      });
    }

    var mapBtn = document.getElementById('btn-map');
    if (mapBtn) {
      mapBtn.addEventListener('click', function () { ui.toggleOverworldMap(); });
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

    document.getElementById('btn-reset').addEventListener('click', function () {
      if (!confirm('정말 처음부터 다시 시작할까요? 도감·지식 서고가 모두 사라집니다.')) { return; }
      core.reset();
      location.reload();
    });

    var btn3d = document.getElementById('btn-3d');
    if (btn3d && global.DG.sideView3d) {
      var SV3 = global.DG.sideView3d;
      if (!SV3.available()) { btn3d.style.display = 'none'; }
      btn3d.classList.toggle('on', SV3.active());
      btn3d.addEventListener('click', function () {
        var on = SV3.toggle();
        btn3d.classList.toggle('on', on);
        ui.toast(on ? '🧊 3D 바탕 켜짐 (실험)' : '🧊 3D 바탕 꺼짐');
      });
    }

    /* 소리 — 첫 눌림에서 깨어난다(브라우저 규칙). 그 규칙은 sfx.js 가 스스로 걸어 두므로
       여기서는 켜고 끄기만 한다. 끈 상태는 세이브(settings.sound)에 남는다 */
    var soundBtn = document.getElementById('btn-sound');
    if (soundBtn && global.DG.sfx) {
      var syncSoundBtn = function () {
        var on = global.DG.sfx.enabled();
        soundBtn.textContent = on ? '🔊' : '🔇';
        soundBtn.classList.toggle('on', on);
      };
      syncSoundBtn();
      soundBtn.addEventListener('click', function () {
        global.DG.sfx.setEnabled(!global.DG.sfx.enabled());
        syncSoundBtn();
      });
    }

    document.getElementById('btn-help').addEventListener('click', showHelp);

    /* 사냥 화면을 크게 보기 — 도구줄·독·자동 상태 띠를 감춰 사냥 화면만 남긴다
       (사가고 UI와 같은 결). 세이브에는 안 남긴다 — 매번 켜진 채로 열리면
       첫 화면부터 조작을 못 찾는다 */
    var focusBtn = document.getElementById('btn-focus');
    if (focusBtn) {
      focusBtn.addEventListener('click', function () {
        var on = document.body.classList.toggle('focus');
        focusBtn.title = on ? '도구줄 다시 보기' : '사냥 화면을 크게 봅니다 (도구줄 감추기)';
        ui.toast(on ? '⛶ 도구줄을 감췄습니다 — 다시 누르면 돌아옵니다' : '도구줄을 다시 보입니다');
      });
    }
  }

  function showHelp() {
    var el = document.getElementById('encounter');
    el.innerHTML =
      '<div class="enc-card">' +
        '<h3 style="margin:0 0 4px;font-size:18px">🏃 조작 안내</h3>' +
        '<div class="helplist">' +
          (core.touchOnly()
            ? ('<div><b>걷기</b> 화면 아래 <b>◀ ▶</b> 단추를 누르고 있습니다</div>' +
               '<div><b>점프</b> <b>▲</b> 단추 — 발판은 <b>위에서만</b> 밟힙니다</div>' +
               '<div><b>오르내리기</b> 밧줄·사다리 앞에서 <b>▲</b> 를 누르면 오르고, ' +
                 '<b>▼</b> 를 누르면 내려갑니다</div>' +
               '<div><b>앉아 쉬기</b> <b>▼</b> 를 누른 채 가만히 — 체력·기력이 찹니다</div>' +
               '<div><b>내려서기</b> <b>▼</b> 를 누른 채 <b>▲</b> — 밟고 선 발판을 빠져나갑니다</div>' +
               '<div><b>문</b> 사냥터 끝의 빛 앞에서 <b>▲</b> 를 누릅니다</div>' +
               '<div><b>공격</b> 아래 <b>조작 띠</b>의 단추 — 무엇이 놓이는지는 직업과 익힌 ' +
                 '무예에 따릅니다. 🧪 는 탕약입니다</div>' +
               '<div><b>자동 사냥</b> 🤖 — <b>폰에서는 이것이 가장 편합니다</b></div>')
            : ('<div><b>이동</b> ← → (또는 A D) · 화면 아래 좌우를 눌러도 됩니다</div>' +
               '<div><b>점프</b> Space · 화면 위쪽을 누르기 — 발판은 <b>위에서만</b> 밟힙니다</div>' +
               '<div><b>오르기</b> ↑ 밧줄·사다리를 탄다 · ↓ 아래로 내려간다 ' +
                 '(줄 위에서 Space 를 누르면 손을 뗍니다)</div>' +
               '<div><b>내려서기</b> ↓ + Space — 밟고 선 발판을 빠져나갑니다</div>' +
               '<div><b>문</b> 사냥터 끝의 빛 앞에서 ↑ — 옆 사냥터로 걸어 넘어갑니다</div>' +
               '<div><b>공격</b> 1~8 — 무엇이 놓이는지는 직업과 익힌 무예에 따릅니다</div>')) +
          '<div><b>전직</b> Lv.10 에 무사·궁수·협객·방사 중 하나를 고릅니다 (🥋 무예). ' +
            'Lv.25 에 2차, <b>Lv.45 에 3차</b>로 오릅니다 — <b>되돌릴 수 없습니다</b></div>' +
          '<div><b>무예 점수</b> 레벨마다 3점. 무예를 올리면 세지고, ' +
            '<b>찍어야 조작 띠에 놓입니다</b></div>' +
          (core.touchOnly() ? ''
            : '<div><b>탕약</b> Q — 체력 45% 회복. 적을 잡을 때 가끔 떨어집니다</div>') +
          '<div><b>궁수</b> 활·조총을 든 적은 <b>멀리서 쏩니다</b> — 사거리에 들면 ❗ 를 ' +
            '띄우고 다가오지 않습니다. 붙거나 기탄(3)으로 받아치세요</div>' +
          '<div><b>내 몸</b> 앞에 세운 인물의 능력치가 체력·공격력이 됩니다 (📖 도감)</div>' +
          '<div><b>장비</b> 🎒 가방에서 낍니다. 적이 떨구고 🏪 저자에서도 삽니다 — ' +
            '방어는 맞는 값을 깎습니다(6할까지)</div>' +
          '<div><b>주문서</b> 물건에 씁니다. <b>실패해도 물건은 남고</b> 업횟만 닳습니다</div>' +
          '<div><b>쓰러짐</b> 그 판에서 주운 금의 절반만 남습니다</div>' +
          '<div><b>사냥터</b> 레벨이 오르면 열립니다 (들판 → 숲 → 굴혈 → 호로곡)</div>' +
          '<div><b>자동</b> 🤖 를 누르면 대신 사냥합니다 (쉬는 화면에서 세부 설정)</div>' +
        '</div>' +
        '<button class="btn primary wide" id="help-ok">확인</button>' +
      '</div>';
    el.classList.add('show');
    document.getElementById('help-ok').addEventListener('click', function () {
      el.classList.remove('show'); el.innerHTML = '';
    });
  }

  /* 경직(硬直) — 급소가 터지면 손이 한 박자 멎는다. 원작에서 큰 타격에 잠깐
     화면이 멈추던 그 감각이고, 손맛의 절반이 여기서 나온다.
     **판정 층이 아니라 이 루프에만 둔다** — 자가진단과 자동 사냥은 update(dt) 를
     직접 굴리므로 경직에 닿지 않는다. 그래서 균형이 한 자도 안 바뀐다. */
  var freeze = 0;

  /** 프레임 간격 상한(ms, 0 = 상한 없음) — 발열(2026-09-24 "핸드폰 불남"): 90·120Hz 폰은 초당 90·120번 그렸다.
   *  그림은 그대로 두고 **헛그림만** 막는다 — 손잡이 `perf.fps`(기본 60, 0 = 상한 없음).
   *  좁은 화면의 시트는 30, 전체 지도·만남·상세 창이 화면을 통째로 덮으면 10(판정은 dt 로 그대로 흐른다) */
  function sheetOver() {
    var b = document.body;
    return !!(b && b.classList.contains('sheet-open') && (global.innerWidth || 0) <= 780);
  }
  function covered() {
    return !!document.querySelector('#owmap.show, #encounter.show, #detail.show');
  }
  function frameGapMs() {
    var fps = core.tuned ? core.tuned('perf.fps', 60) : 60;
    if (covered()) { fps = fps ? Math.min(fps, 10) : 10; }
    else if (sheetOver()) { fps = fps ? Math.min(fps, 30) : 30; }
    return fps > 0 ? 1000 / fps : 0;
  }

  /* 루프 문지기(W-0066) — 'park' 탭이 숨겨졌다(다음 프레임 예약 없음) · 'wait' 보이지만 창이 포커스를 잃었다(0.5초마다 한 번만 들여다봄) · 'run' */
  function loopGate() {
    if (document.hidden) { return 'park'; }
    return document.hasFocus() ? 'run' : 'wait';
  }
  var parkedLoop = false;
  /** 숨김으로 멈춘 루프를 다시 켠다 — 멈춰 있을 때만(사슬이 둘이 되지 않게) */
  function wakeLoop() {
    if (!parkedLoop || document.hidden) { return; }
    parkedLoop = false; lastFrame = performance.now();
    requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', wakeLoop);
  global.addEventListener('focus', wakeLoop);
  global.addEventListener('pageshow', wakeLoop);

  function loop(now) {
    /* 탭이 숨겨졌거나 창이 포커스를 잃으면 3D 를 완전히 멈춘다 — "화면엔
       보이는데 다른 창을 쓰는 중"은 브라우저가 알아서 안 줄여 준다. 이 판이
       그 상태로 계속 풀가동해 다른 작업 CPU 를 잡아먹는다는 제보로 추가
       (2026-09-08) */
    var gate = loopGate();
    if (gate !== 'run') {
      lastFrame = now;
      if (gate === 'park') { parkedLoop = true; return; }   // 숨김 — 다음 프레임을 예약조차 안 한다(W-0066, visibilitychange 가 깨운다)
      global.setTimeout(function () { requestAnimationFrame(loop); }, 500);
      return;
    }
    var cap = frameGapMs();
    if (cap && now - lastFrame < cap - 2) { requestAnimationFrame(loop); return; }
    var dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;

    /* 오픈월드 — 나온다·쓰러짐으로 쉬는 순간이 와도, 화면에 그리기 전에 곧장
       사냥터로 되돌린다. 그래서 "쉬는 중" 버튼판(camp)은 동행이 하나도 없을
       때만(도감에서 인물을 고르라는 안내) 실제로 보인다.
       자가진단에서는 안 부른다 — 이 루프도 진단 페이지에서 돈다(DG_NO_DRAW 는
       그리기만 건너뛸 뿐이다) — 그대로 두면 낱낱 항목이 만들어 둔 run 을
       프레임 사이에 이 자동복귀가 건드려 버린다 */
    if (!global.DG_NO_ACCOUNT && !S.active()) { S.resume(); }

    /* side.js 가 남긴 'shake' 를 보고 멎는다 — 새 이벤트를 만들지 않았다 */
    if (S.active()) {
      var list = S.fx(), i;
      for (i = 0; i < list.length; i++) {
        if (list[i].t === 'shake' && list[i].big && !list[i].froze) {
          list[i].froze = true;
          freeze = 0.055;
        }
      }
    }
    if (freeze > 0) {
      freeze -= dt;
      dt *= 0.12;                                   // 아주 멎지는 않는다 — 느려질 뿐이다
    }

    /* 첫 발 장면(story.js) 동안은 사냥이 멎는다 — 그림은 계속 그린다 */
    if (!(global.DG.story && global.DG.story.isOpen())) {
      global.DG.auto.update(dt);
      S.update(dt);
    }
    if (!global.DG_NO_DRAW) {
      if (global.DG.mount) { global.DG.mount.paint(); }                            // 탈것 단추(mount.js)
      /* camX 는 sideView.draw() 가 매 프레임 새로 잰다 — 3D 는 그 값을 그대로 받아
         쓰므로(_cam()) 반드시 뒤에 부른다. 그려지는 순서는(캔버스가 둘이라) 상관없다 */
      global.DG.sideView.draw();
      if (global.DG.sideView3d) { global.DG.sideView3d.draw(); }
    }

    uiAcc += dt;
    if (uiAcc >= 0.15) { uiAcc = 0; ui.tickRefresh(); }   // 체력 바는 자주 갱신해야 한다

    saveAcc += dt;
    if (saveAcc >= 10) { saveAcc = 0; core.persist(); }

    requestAnimationFrame(loop);
  }

  global.DG = global.DG || {};
  global.DG.game = {
    boot: boot, start: start, retry3d: retry3d, frameGapMs: frameGapMs,
    keymap: keymap, beginRemap: beginRemap, remapping: function () { return remapping; }, loopGate: loopGate, wakeLoop: wakeLoop, _park: function (v) { parkedLoop = !!v; }, _parked: function () { return parkedLoop; }
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
