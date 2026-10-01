/**
 * 던전 화면 — 표현 전용 (아이소메트릭)
 * ---------------------------------------------------------------
 * dungeon.js 가 굴리는 상태를 **그리고 입력만 넘긴다**. 여기서 계산하지 않는다.
 * (battle-view.js 와 같은 원칙 — 계산이 화면으로 새면 규칙이 두 벌이 된다)
 *
 * v1.0 — 원작 감성:
 *   아이소메트릭   논리 좌표(ROOM_W×H 직사각형)는 그대로 두고, 그릴 때만
 *                  마름모로 투영한다. proj()/unproj() 는 선형이라 역변환이 정확하다.
 *   조명           어둠 레이어에 플레이어·횃불·기공파 자리만 구멍을 뚫는다.
 *   오브 HUD       HP/기력 구슬 + 스킬 4버튼 (키보드 1~4, 터치 가능)
 *   전리품 이름표  바닥에 떨어진 장비에 등급색 이름이 뜬다
 *
 *   #dungeon        전체화면 오버레이 (없으면 만든다)
 *   #dg-canvas      방 하나를 그리는 캔버스
 *   #dg-hud         층 · 노획물 · 은사 · 탈출
 *   #dg-bottom      HP 오브 · 스킬바 · 기력 오브
 *   #dg-choice      은사 셋 중 하나 고르기
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var DG_ = null;                      // dungeon 모듈 (부트 후에 잡는다)
  var DD = null;

  var host = null, cv = null, ctx = null, hud = null, choiceEl = null;
  var bottomEl = null, foeEl = null, actionsEl = null;
  var lightCv = null, lightCtx = null;         // 어둠 레이어 (오프스크린)
  var shown = false;
  var keys = {};
  /* 2026-09-09 — "키세팅이 있어야겠지"(사용자 요청). WASD·방향키는 **항상
     그대로 산다**(하드코딩 폴백) — 여기 이 맵은 그 위에 얹는 "추가 키"만
     고른다. 그래서 잘못 지정해도 이동 자체가 막히지 않는다. */
  var KEYMAP_DEFAULT = { up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright' };
  var remapping = null;   // 지금 다시 지정 받는 중인 방향('up'/'down'/'left'/'right') 또는 null
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
  var shake = 0;
  /** §5.8① 화면 흔들림 배율(0~2, 기본 1) — 3D fx3d.js `shakeMul()` 과 같은 값 */
  function shakeMul() {
    var s = core.save && core.save.settings;
    var v = s && typeof s.shake === 'number' ? s.shake : 1;
    return Math.max(0, Math.min(2, v));
  }
  var lastHp = 0;
  /* 바닥에 남는 핏자국 — 원작에서 방을 치우고 나면 남는 그 자국이다.
     판정과 무관한 순수 장식이라 세이브에도 run 에도 넣지 않는다(방이 바뀌면 사라진다). */
  var gore = [], goreRoom = null;
  var GORE_MAX = 60;

  /* 아이소메트릭 상수 — u=(x−y)·IX, v=(x+y)·IY. 2:1 마름모보다 살짝 눕혔다 */
  var IX = 0.84, IY = 0.46;
  var WALLH = 58;                              // 뒷벽을 위로 뽑는 높이 (논리 단위)
  /* 확대율 — 원작은 방 전체가 아니라 인물 언저리를 크게 보여 준다.
     1 이면 방이 화면에 딱 맞고(=예전), 키우면 바짝 붙는다. 1.5 넘게 주면
     이 방(560×360)에서는 적이 화면 밖으로 나가 손으로 놀기가 답답해진다. */
  /* 캔버스에 찍는 글자도 CSS 와 같은 결이어야 한다 — 로마자·숫자는 Cinzel,
     한글은 명조로 떨어진다(diablo.css 가 심어 둔 글꼴). 캔버스는 매 프레임 다시
     그리므로 글꼴이 늦게 올라와도 다음 프레임에 제대로 나온다. */
  var D2_FONT = 'Cinzel, Georgia, "Nanum Myeongjo", "Batang", serif';

  var ZOOM = 1.20;
  /**
   * 사람이 핀치·휠로 조절하는 확대. `core.save.settings.camZoom` 에 저장돼
   * 프로필마다 남는다 — 손가락을 벌리면(=확대) 커진다(`ZOOM` 과 같은 결).
   * `dungeon3d.js`(3D)는 같은 값을 읽되 **거리에는 나눠서** 먹인다(그쪽 주석
   * 참고) — 두 화면에서 손가락을 벌리는 동작이 똑같이 느껴져야 하기 때문이다.
   */
  /* 2026-09-07 — 마을이 3D 에서 "너무 가깝게(크게) 잡혀 화면을 못 쓴다"는
     실기기 신고. 마을은 `dungeon3d.js`의 camAim이 `close`(사가의숲 쿼터뷰
     당김, 2026-09-02)를 얹어 거리에 0.4 를 곱하는데, 이 손잡이(camZoom)의
     아래 한계가 0.55 라 아무리 오므려도 마을에서는 충분히 물러나지 못했다.
     0.32 로 낮춰 최대로 오므리면 마을도 던전만큼(또는 그 이상) 물러나게 한다. */
  var CAM_ZOOM_MIN = 0.32, CAM_ZOOM_MAX = 2.0;
  function userZoom() {
    var v = core.save && core.save.settings ? core.save.settings.camZoom : 1;
    if (v === undefined || v === null) { v = 1; }
    return core.clamp(v, CAM_ZOOM_MIN, CAM_ZOOM_MAX);
  }
  function setUserZoom(v) {
    if (!core.save || !core.save.settings) { return; }
    core.save.settings.camZoom = core.clamp(v, CAM_ZOOM_MIN, CAM_ZOOM_MAX);
    core.persist();
  }
  /* 화면 아래 조작판이 가리는 높이 — 무대를 그 위로 밀어 올린다.
     이 값을 빼지 않으면 인물이 판 뒤에 숨는다. */
  var PAD_BOT = 92;

  /**
   * 지금 그리는 장면 — 마을이거나 던전이다.
   *
   * 둘은 **같은 모양의 상태**를 내놓기로 약속돼 있다(raw · status · fx ·
   * setInput · moveTo · update). 그래서 아래 그리기·조작 코드는 자기가 마을을
   * 그리는지 던전을 그리는지 몰라도 된다 — 이 한 줄이 그 약속의 전부다.
   */
  function d() {
    var T = global.DG.town;
    return (T && T.active()) ? T : global.DG.dungeon;
  }
  function shade(c, amt) { return global.DG.sprite.shade(c, amt); }

  function build() {
    host = document.getElementById('dungeon');
    if (!host) {
      host = document.createElement('div');
      host.id = 'dungeon';
      document.body.appendChild(host);
    }
    host.innerHTML =
      '<div class="dg-wrap">' +
        '<div id="dg-hud"></div>' +
        '<div class="dg-stage"><canvas id="dg3d"></canvas><canvas id="dg-canvas"></canvas><div id="dg-dark"></div>' +
          '<div id="d2-foe"></div>' +
          '<div id="dg-choice"></div>' +
          '<div id="dg-joy"><div id="dg-joy-knob"></div></div>' +
          '<div id="dg-pad">' +
            '<button data-dir="up">▲</button>' +
            '<button data-dir="left">◀</button>' +
            '<button data-dir="down">▼</button>' +
            '<button data-dir="right">▶</button>' +
          '</div>' +
          /* 강공격·회피(2026-09-10) — 조이스틱(왼쪽)과 대칭인 오른쪽 자리.
             #dg-bottom(HUD 바, 폭 예산이 이미 390px 실측으로 빠듯하게 짜여
             있다)에 끼워 넣지 않는다 — 무대 위에 따로 띄운다. */
          '<div id="dg-actions">' +
            '<button class="dg-skill" data-heavy title="강공격 (Shift)">' +
              '<span class="dg-sk-e">💥</span><i class="dg-sk-cd"></i></button>' +
            '<button class="dg-skill" data-dodge title="회피 (Space)">' +
              '<span class="dg-sk-e">💨</span><i class="dg-sk-cd"></i></button>' +
            /* 투장 전용 무예(2026-09-10) — 세 점을 다 갖춰야 손에 잡힌다.
               강공격·회피와 같은 자리, 셋째 자리. 못 갖췄으면 'empty'로 흐리게
               그린다(renderBottom) — 스킬 넷의 빈 칸과 같은 결. */
            '<button class="dg-skill empty" data-setsk title="투장 무예 (F)">' +
              '<span class="dg-sk-e">✨</span><i class="dg-sk-cd"></i></button>' +
            /* 인물별 서명 무예(2026-09-11) — 투장 무예 옆, 넷째 자리. 파일럿
               8명 밖 인물이면 계속 흐린 채(empty)로 남는다. */
            '<button class="dg-skill empty" data-sigsk title="서명 무예 (G)">' +
              '<span class="dg-sk-e">🌟</span><i class="dg-sk-cd"></i></button>' +
          '</div>' +
        '</div>' +
        '<div id="dg-bottom"></div>' +
        '<div class="dg-tip">이동 <b>WASD</b> · 물약 <b>1 2 3 4</b> · 스킬 <b>Z X C V</b> · ' +
          '강공격 <b>Shift</b> · 회피 <b>Space</b> · 투장 무예 <b>F</b> · 서명 무예 <b>G</b> · ' +
          '<b>화면을 누른 채 끌면</b> 그쪽으로 걷습니다 · ' +
          '<b>손가락 둘로 벌리거나 오므리면</b> 확대·축소</div>' +
      '</div>';
    cv = document.getElementById('dg-canvas');
    ctx = cv.getContext('2d');
    /* 3D 층은 **있으면 쓴다.** WebGL 이 없거나 켜다 실패하면 그대로 2D 로 돈다
       (`dungeon3d.js`). 조작판·입력·시트는 그대로 이쪽 DOM 이 받는다.
       자가진단(DG_NO_DRAW)에서는 켜지도 않는다 — 헤드리스에도 WebGL 이 있어서
       켜 두면 켜진 것으로 판정되고, 화면 층이 그 값을 보고 갈린다 */
    if (global.DG.dungeon3d && !global.DG_NO_DRAW) {
      global.DG.dungeon3d.init(document.getElementById('dg3d'));
    }
    hud = document.getElementById('dg-hud');
    choiceEl = document.getElementById('dg-choice');
    bottomEl = document.getElementById('dg-bottom');
    foeEl = document.getElementById('d2-foe');
    lightCv = document.createElement('canvas');
    lightCtx = lightCv.getContext('2d');
    buildBottom();

    /* 조작 — 누르고 있으면 손가락 쪽으로 계속 걷는다(폰), 짧게 누르면 그 지점으로(마우스).
       손가락 둘이면 걷기가 아니라 **핀치 확대**다 — 벌리면 커진다(userZoom). */
    var steering = false, downAt = 0, downPt = null;
    var pointers = {};                      // pointerId → {x,y} (지금 닿아 있는 것)
    var pinchStart = null, pinchZoom0 = null;

    function pointerCount() {
      var n = 0, k;
      for (k in pointers) { if (Object.prototype.hasOwnProperty.call(pointers, k)) { n++; } }
      return n;
    }
    function pinchDist() {
      var ids = Object.keys(pointers);
      if (ids.length < 2) { return null; }
      var a = pointers[ids[0]], b = pointers[ids[1]];
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function steer(e) {
      var r = cv.getBoundingClientRect();
      var p = toRoom(e.clientX - r.left, e.clientY - r.top);
      var run = d().raw();
      if (!run) { return; }
      var dx = p.x - run.player.x, dy = p.y - run.player.y;
      var len = Math.hypot(dx, dy);
      if (len < 14) { d().setInput(0, 0); return; }
      d().setInput(dx / len, dy / len);
    }

    cv.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button === 2) { return; }   // 오른쪽 버튼은 걷지 않는다
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (pointerCount() === 2) {
        /* 둘째 손가락이 닿는 순간 걷기는 멈춘다 — 걸으면서 동시에 확대하면
           손도 헷갈리고, 판정도 "어느 손가락이 걷는 손가락인지" 를 몰라 애매하다 */
        steering = false;
        d().setInput(0, 0);
        pinchStart = pinchDist();
        pinchZoom0 = userZoom();
        e.preventDefault();
        return;
      }
      if (pointerCount() > 2) { return; }   // 셋째 손가락은 못 본 척한다
      steering = true;
      downAt = Date.now();
      downPt = { x: e.clientX, y: e.clientY };
      cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      steer(e);
      e.preventDefault();
    });
    cv.addEventListener('pointermove', function (e) {
      if (pointers[e.pointerId]) { pointers[e.pointerId] = { x: e.clientX, y: e.clientY }; }
      if (pointerCount() === 2 && pinchStart) {
        var d2 = pinchDist();
        if (d2) { setUserZoom(pinchZoom0 * (d2 / pinchStart)); }
        e.preventDefault();
        return;
      }
      if (!steering) { return; }
      steer(e);
    });
    function release(e) {
      delete pointers[e.pointerId];
      if (pointerCount() < 2) { pinchStart = null; }
      if (!steering) { return; }
      steering = false;
      d().setInput(0, 0);
      var quick = Date.now() - downAt < 200;
      var moved = downPt ? Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y) : 99;
      if (quick && moved < 12) {
        var r = cv.getBoundingClientRect();
        var p = toRoom(e.clientX - r.left, e.clientY - r.top);
        d().moveTo(p.x, p.y);
      }
    }
    cv.addEventListener('pointerup', release);
    cv.addEventListener('pointercancel', function (e) {
      delete pointers[e.pointerId];
      if (pointerCount() < 2) { pinchStart = null; }
      steering = false; d().setInput(0, 0);
    });
    cv.addEventListener('pointerleave', function (e) { if (steering) { release(e); } });
    /* 마우스 휠(데스크톱) — 폰의 핀치와 같은 자리를 대신한다 */
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      setUserZoom(userZoom() * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
    }, { passive: false });

    /* 2026-09-09 — "움직이는 게 너무 힘들다"(모바일 재신고). 지금까지는
       화면 아무 데나 눌러 그 쪽으로 계속 걷는 방식(steer, 위)뿐이었는데,
       손가락이 캔버스 위 아무 데나 닿아야 해 카메라가 따라오며 그 지점이
       계속 바뀌면 방향을 가늠하기 어려웠다. PLAN §21·24가 원래 요구하던
       고정 조이스틱을 얹는다 — 이 원(#dg-joy) 안에서 시작한 손가락만 받고,
       원 중심에서 잰 방향을 d().setInput()에 그대로 먹인다(steer()와 같은
       API라 그 아래 걷기 로직은 손 안 댄다). 터치 기기에서만 보인다 —
       마우스는 기존 드래그 조작 그대로 쓴다. */
    var joyEl = document.getElementById('dg-joy');
    var joyKnob = document.getElementById('dg-joy-knob');
    var isTouch = !!(('ontouchstart' in global) || (navigator.maxTouchPoints > 0));
    if (isTouch) { joyEl.classList.add('show'); }
    initPad(isTouch);
    var joyId = null, joyCX = 0, joyCY = 0;
    var JOY_R = 46;         // 원(118px) 반지름보다 살짝 작게 — 손잡이가 테두리 밖으로 안 나가게
    var JOY_DEAD = 8;
    function joyKnobAt(dx, dy) {
      joyKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    }
    function joyReset() {
      joyId = null;
      joyKnobAt(0, 0);
      d().setInput(0, 0);
    }
    joyEl.addEventListener('pointerdown', function (e) {
      if (joyId !== null) { return; }        // 이미 다른 손가락이 잡고 있다
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
      joyKnobAt(kx, ky);
      if (len < JOY_DEAD) { d().setInput(0, 0); return; }
      d().setInput(dx / len, dy / len);
      e.preventDefault();
    });
    function joyRelease(e) {
      if (e.pointerId !== joyId) { return; }
      joyReset();
    }
    joyEl.addEventListener('pointerup', joyRelease);
    joyEl.addEventListener('pointercancel', joyRelease);
    joyEl.addEventListener('pointerleave', function (e) { if (e.pointerId === joyId) { joyRelease(e); } });

    /* 2026-09-09 — "피시에서는 마우스 클릭 버튼으로"(사용자 요청). 조이스틱과
       같은 자리를 쓰되 터치가 아닐 때만 보인다(#dg-pad) — 네 방향 버튼을
       누르고 있는 동안 keys.w/a/s/d 를 그대로 세워 pushInput() 을 부른다,
       WASD 와 완전히 같은 자리라 걷기 로직은 하나도 안 늘어난다. */
    function initPad(isTouchDev) {
      var padEl = document.getElementById('dg-pad');
      if (!padEl) { return; }
      if (!isTouchDev) { padEl.classList.add('show'); }
      var DIR_KEY = { up: 'w', down: 's', left: 'a', right: 'd' };
      var btns = padEl.querySelectorAll('button[data-dir]');
      for (var pi = 0; pi < btns.length; pi++) {
        (function (btn) {
          var k = DIR_KEY[btn.getAttribute('data-dir')];
          btn.addEventListener('pointerdown', function (e) {
            keys[k] = true; pushInput();
            btn.setPointerCapture && btn.setPointerCapture(e.pointerId);
            e.preventDefault();
          });
          function release() { keys[k] = false; pushInput(); }
          btn.addEventListener('pointerup', release);
          btn.addEventListener('pointercancel', release);
          btn.addEventListener('pointerleave', release);
        })(btns[pi]);
      }
    }

    hud.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) { return; }
      if (b.getAttribute('data-act') === 'leave') { d().leave(); }
    });

    choiceEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-boon]');
      if (b) { d().pickBoon(b.getAttribute('data-boon')); renderChoice(); return; }
      var rj = e.target.closest('[data-reject-boon]');
      if (rj) { d().rejectBoon(); renderChoice(); return; }
      var m = e.target.closest('[data-buy]');
      if (m) { d().buyMerchant(Number(m.getAttribute('data-buy'))); renderChoice(); return; }
      var lv = e.target.closest('[data-leave-merchant]');
      if (lv) { d().leaveMerchant(); renderChoice(); return; }
      var gt = e.target.closest('[data-grave-toggle]');
      if (gt) { d().toggleGraveItem(Number(gt.getAttribute('data-grave-toggle'))); renderChoice(); return; }
      var gf = e.target.closest('[data-grave-confirm]');
      if (gf) { d().claimGrave(); renderChoice(); }
    });


    bottomEl.addEventListener('pointerdown', function (e) {
      var bl = e.target.closest('[data-belt]');
      if (bl) { drink(parseInt(bl.getAttribute('data-belt'), 10)); return; }
      var b = e.target.closest('[data-skill]');
      if (!b) { return; }
      d().castSkill(parseInt(b.getAttribute('data-skill'), 10));
      e.preventDefault();
    });

    actionsEl = document.getElementById('dg-actions');
    if (actionsEl) {
      actionsEl.addEventListener('pointerdown', function (e) {
        if (e.target.closest('[data-heavy]')) { d().heavyAttack(); e.preventDefault(); return; }
        if (e.target.closest('[data-dodge]')) { d().doDodge(); e.preventDefault(); return; }
        if (e.target.closest('[data-setsk]')) { pressSetSkill(); e.preventDefault(); return; }
        if (e.target.closest('[data-sigsk]')) { pressSigSkill(); e.preventDefault(); }
      });
    }

    global.addEventListener('keydown', onKey);
    global.addEventListener('keyup', onKeyUp);
  }

  /* 조작 안내 한 줄 — 마을과 던전은 손이 다르다. 바뀔 때만 건드린다 */
  var tipTown = null;
  function setTip(town) {
    if (tipTown === town) { return; }
    tipTown = town;
    var el = host && host.querySelector('.dg-tip');
    if (!el) { return; }
    /* 폰(손가락만)이면 키 설명은 뺀다(2026-09-28, 실기 보고 Q13 — 키보드 없는 폰에 "WASD" 가 떴다) */
    var touchOnly = !!(global.matchMedia && global.matchMedia('(hover: none) and (pointer: coarse)').matches);
    el.innerHTML = town
      ? (touchOnly ? '' : '이동 <b>WASD</b> · ') + '<b>화면을 누른 채 끌면</b> 그쪽으로 걷습니다 · ' +
        '사람과 표식은 <b>다가서면</b> 말이 걸립니다'
      : (touchOnly ? '<b>화면을 누른 채 끌면</b> 그쪽으로 걷습니다 · 스킬은 오른쪽 단추'
        : '이동 <b>WASD</b> · 물약 <b>1 2 3 4</b> · 스킬 <b>Z X C V</b> · ' +
        '<b>화면을 누른 채 끌면</b> 그쪽으로 걷습니다');
  }

  /**
   * 하단 조작판 — 원작(2편)의 그 판이다.
   *
   *   [체력 구슬]  [스킬 넷]  [경험치 띠 · 노획 · 은사]  [기력 구슬]
   *
   * 구슬을 쓴 이유는 멋이 아니다. 원작에서 체력은 **숫자가 아니라 양(量)** 으로
   * 읽힌다 — 곁눈질로 "얼마나 남았나" 를 보게 하려고 둥근 그릇에 액체를 채운다.
   * 막대(dg-hpbar)는 그래서 감췄다(diablo.css).
   *
   * DOM 은 여기서 한 번만 만들고 renderBottom 이 값만 만진다.
   */
  /* 스킬 키 — 원작은 F1~F8 인데 브라우저가 F1 을 도움말로 가로챈다.
     1 2 3 4 는 **벨트(물약)** 에 내줬으므로(원작 그대로), 스킬은 WASD 왼쪽 아래
     Z X C V 로 내렸다. 왼손이 이동에서 손을 안 떼고 닿는 자리다. */
  var SKILL_KEYS = ['Z', 'X', 'C', 'V'];

  function buildBottom() {
    /* 칸은 넷이다. **무엇이 걸려 있는지는 매 틱 renderBottom 이 채운다** —
       선두를 바꾸면 손이 통째로 바뀌므로 여기서 구워 두지 않는다 */
    var n = global.DG.dungeon.SKILL_SLOTS || 4;
    var html =
      '<div class="d2-globe life"><i class="d2-liq"></i><span class="d2-gv"></span></div>' +
      '<div class="d2-plate d2-left"><div class="d2-skills">';
    for (var i = 0; i < n; i++) {
      html += '<button class="dg-skill" data-skill="' + i + '">' +
        '<span class="dg-sk-e"></span>' +
        '<i class="dg-sk-cd"></i>' +
        '<b class="dg-sk-key">' + SKILL_KEYS[i] + '</b>' +
        '<small class="dg-sk-cost"></small>' +
        '</button>';
    }
    html += '</div></div>' +
      '<div class="d2-plate d2-mid">' +
        '<div class="d2-xp"><i style="width:0%"></i><span></span></div>' +
        '<div class="d2-line d2-loot"></div>' +
        '<div class="d2-line"><div class="d2-belt">' + beltCells() + '</div>' +
          '<span class="d2-boonline"></span></div>' +
      '</div>' +
      '<div class="d2-globe mana"><i class="d2-liq"></i><span class="d2-gv"></span></div>';
    bottomEl.innerHTML = html;
  }

  /** 요대(腰帶) 넷 — 원작의 벨트. 값은 renderBottom 이 채운다 */
  function beltCells() {
    var P = global.DG.potion;
    var n = P ? P.SLOTS : 4, h = '', i;
    for (i = 0; i < n; i++) {
      h += '<button class="d2-cell empty" data-belt="' + i + '" title="' + (i + 1) + '">' +
        '<span class="d2-pe"></span><i></i></button>';
    }
    return h;
  }

  function onKey(e) {
    if (!shown) { return; }
    if (remapping) {
      if (e.key !== 'Escape') { setKeymapKey(remapping, e.key.toLowerCase()); }
      remapping = null;
      core.emit('dg:keyremap');
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape') { return; }              // 탈출은 버튼으로만 (실수 방지)
    var k = e.key.toLowerCase();
    /* 1 2 3 4 는 **벨트**다 (원작 그대로). 스킬은 Z X C V 로 내렸다. */
    if (k >= '1' && k <= '4') {
      drink(parseInt(k, 10) - 1);
      e.preventDefault();
      return;
    }
    var si = SKILL_KEYS.indexOf(k.toUpperCase());
    if (si >= 0) {
      d().castSkill(si);
      e.preventDefault();
      return;
    }
    /* 강공격·회피(2026-09-10) — 스킬 넷(Z X C V)과 안 겹치는 자리.
       Shift 는 누르고 있어도 keydown 이 반복 안 되게(브라우저 auto-repeat)
       e.repeat 로 거른다 — 안 그러면 쥐고만 있어도 강공격이 연타된다. */
    if (k === ' ') { d().doDodge(); e.preventDefault(); return; }
    if (k === 'shift' && !e.repeat) { d().heavyAttack(); e.preventDefault(); return; }
    /* 투장 전용 무예(2026-09-10) — 강공격·회피와 같은 자리, F 하나 더. */
    if (k === 'f') { pressSetSkill(); e.preventDefault(); return; }
    /* 인물별 서명 무예(2026-09-11) — 같은 자리, G 하나 더. */
    if (k === 'g') { pressSigSkill(); e.preventDefault(); return; }
    keys[k] = true;
    pushInput();
    var km = keymap();
    if (['w', 'a', 's', 'd', km.up, km.down, km.left, km.right].indexOf(k) >= 0) {
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    keys[e.key.toLowerCase()] = false;
    pushInput();
  }
  /** 투장 전용 무예를 쓴다 — 세 점을 못 갖췄을 때만 그 까닭을 알려 준다
   *  (쿨다운 중이면 heavyAttack처럼 조용히 실패 — 버튼 위 쿨다운 링이 이미
   *  말해 준다). 2026-09-10 */
  function pressSetSkill() {
    if (d().castSetSkill()) { return; }
    var st = d().status();
    if (st.active && st.setSkill && !st.setSkill.avail) {
      core.emit('toast', '투장(세트) 세 점을 한 인물이 다 걸쳐야 손에 잡힙니다');
    }
  }

  /** 서명 무예를 쓴다 — 위 pressSetSkill과 같은 요령(2026-09-11) */
  function pressSigSkill() {
    if (d().castSigSkill()) { return; }
    var st = d().status();
    if (st.active && st.sigSkill && !st.sigSkill.avail) {
      core.emit('toast', '이 인물은 아직 서명 무예가 없습니다');
    }
  }

  /** 한 칸 마신다 — 실패한 까닭을 짧게 알려 준다(빈 칸을 계속 누르게 두지 않는다) */
  function drink(slot) {
    var P = global.DG.potion;
    if (!P) { return; }
    var r = P.use(slot);
    if (r.ok) { return; }
    if (r.reason === 'empty') { core.emit('toast', '그 칸은 비었습니다'); }
    else if (r.reason === 'full') { core.emit('toast', '이미 가득합니다 — 아껴 둡니다'); }
  }

  function pushInput() {
    if (!shown) { return; }
    var km = keymap();
    var dx = 0, dy = 0;
    if (keys.a || keys.arrowleft || keys[km.left]) { dx -= 1; }
    if (keys.d || keys.arrowright || keys[km.right]) { dx += 1; }
    if (keys.w || keys.arrowup || keys[km.up]) { dy -= 1; }
    if (keys.s || keys.arrowdown || keys[km.down]) { dy += 1; }
    d().setInput(dx, dy);
  }

  /* ── 좌표 변환 (아이소메트릭) ─────────────────────────── */

  /**
   * 논리 방(직사각형)을 마름모로 투영해 캔버스에 맞춘다.
   * uMin 은 마름모의 왼쪽 끝 (x=0, y=H 모서리).
   */
  function metrics() {
    var W = d().ROOM_W, H = d().ROOM_H;
    var cw = cv.clientWidth || 1, ch = cv.clientHeight || 1;
    var uw = (W + H) * IX;                     // 마름모 가로폭
    var vh = (W + H) * IY;                     // 마름모 세로높이
    /* 뒷벽 자리 + 조금. 적 머리 위 이름표를 없앤 뒤로 여유가 덜 든다 */
    var padTop = WALLH + 16;
    var chUse = Math.max(120, ch - PAD_BOT);   // 조작판에 가리지 않는 높이
    var fit = Math.min(cw / (uw + 20), chUse / (vh + padTop + 14));
    var s = fit * ZOOM * userZoom();
    var uMin = -H * IX, uMax = W * IX, vMax = (W + H) * IY;

    /* 카메라 — 원작은 인물을 화면 한가운데 붙들고 방이 그 밖으로 흘러간다.
       다만 방 밖의 검은 여백이 보이면 무대가 아니라 그림판처럼 보이므로,
       마름모의 네 끝이 화면 안쪽으로 들어오지 않게 **가둔다**.
       가둘 수 없을 만큼(=방이 화면보다 작을 때) 이면 그냥 가운데에 놓는다. */
    var run = d() && d().raw();
    var ox, oy;
    if (run && run.player) {
      ox = cw / 2 - (run.player.x - run.player.y) * IX * s;
      oy = chUse * 0.50 - (run.player.x + run.player.y) * IY * s;
    } else {
      ox = (cw - uw * s) / 2 - uMin * s;
      oy = (chUse - (vh + padTop + 14) * s) / 2 + padTop * s;
    }
    var oxLo = cw - uMax * s, oxHi = -uMin * s;
    ox = oxLo <= oxHi ? core.clamp(ox, oxLo, oxHi) : (cw - uw * s) / 2 - uMin * s;
    var oyLo = chUse - vMax * s, oyHi = padTop * s;
    oy = oyLo <= oyHi ? core.clamp(oy, oyLo, oyHi)
                      : (chUse - (vh + padTop + 14) * s) / 2 + padTop * s;

    return { s: s, ox: ox, oy: oy, cw: cw, ch: ch };
  }

  function proj(m, x, y) {
    return { x: m.ox + (x - y) * IX * m.s, y: m.oy + (x + y) * IY * m.s };
  }

  function toRoom(px, py) {
    var m = metrics();
    var u = (px - m.ox) / m.s, v = (py - m.oy) / m.s;
    return { x: (u / IX + v / IY) / 2, y: (v / IY - u / IX) / 2 };
  }

  /** 논리 공간의 원 → 화면의 납작한 타원 (그림자·조명·범위 표시에 쓴다) */
  function isoEllipse(c, m, x, y, r) {
    var p = proj(m, x, y);
    c.ellipse(p.x, p.y, r * 1.414 * IX * m.s, r * 1.414 * IY * m.s, 0, 0, Math.PI * 2);
    return p;
  }

  /* ── 보이기 / 숨기기 ─────────────────────────────────── */

  function show() {
    if (!host) { build(); }
    shown = true;
    host.classList.add('show');
    document.body.classList.add('dungeon-open');
    resize();
    renderHud();
    renderChoice();
  }

  function hide() {
    shown = false;
    keys = {};
    if (host) { host.classList.remove('show'); }
    document.body.classList.remove('dungeon-open');
    if (d()) { d().setInput(0, 0); }
  }

  function resize() {
    if (!cv) { return; }
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.max(1, Math.floor(w * dpr));
    cv.height = Math.max(1, Math.floor(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lightCv.width = cv.width;
    lightCv.height = cv.height;
    lightCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── HUD (상단) ──────────────────────────────────────── */

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
      if (dd < bestD) { bestD = dd; best = e; }
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
      '<div class="d2-fname">' + (el ? el.name + ' ' : '') + best.ref.name + '</div>' +
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
    for (var i = 0; i < btns.length && i < st.skills.length; i++) {
      var sk = st.skills[i];
      var cdEl = btns[i].querySelector('.dg-sk-cd');
      var pct = sk.cdMax ? (sk.cd / sk.cdMax) * 100 : 0;
      cdEl.style.height = pct + '%';
      cdEl.textContent = sk.cd > 0.05 ? Math.ceil(sk.cd) : '';
      /* 걸린 무예가 바뀔 수 있으니 그림·값도 매 틱 맞춘다 (선두를 바꾸면 손이 바뀐다) */
      /* 비결(§5.9)을 걸었으면 무예 그림 옆에 작게 — 손에 든 무예가 어떻게 바뀌었는지 */
      btns[i].querySelector('.dg-sk-e').textContent = sk.emoji + (sk.secretEmoji || '');
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

