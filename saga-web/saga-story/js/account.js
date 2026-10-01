/**
 * 계정 — 간단히 가입하고, 그 이름으로 저장한다
 * ---------------------------------------------------------------
 * 서버는 없다. **이 브라우저 안에서만** 도는 가입이다(비밀번호도 없다).
 * 하는 일은 하나 — "누구의 진행인지"를 정해서 세이브 키를 갈라 주는 것이다.
 *
 *   가입    이름을 넣으면 프로필이 만들어진다
 *   저장    그 프로필의 키(`<게임>/save/<프로필id>`)로 세이브가 들어간다
 *   전환    프로필이 여럿이면 골라서 들어간다 (형제·가족이 같은 PC 를 쓸 때)
 *   이어받기 옛 세이브(`…/save/v1`)가 있으면 첫 가입 때 그 진행을 옮겨 준다
 *   타이틀  이미 있는 프로필이라도 매번 한 번 덮는다(로고·캐릭터·이어하기,
 *           온라인 게임의 로그인 화면처럼 — saga-story PLAN 29절과 통일. 이 판엔
 *           아직 설정 시트가 없어 '설정' 버튼은 넣지 않았다)
 *
 * 게임 코드는 이 파일을 **한 곳에서만** 부른다:
 *
 *   game.js  boot() → DG.account.gate(start)
 *
 * gate() 가 프로필을 정해 core.setSaveKey() 를 부른 뒤 start() 를 돌린다.
 * 프로필이 없으면 가입 화면(그 자체가 타이틀 화면을 겸한다)을, 있으면
 * start() 를 먼저 돌려 게임을 밑에서 켠 채로 타이틀 화면(showTitle)을
 * 덮는다 — "이어하기"는 화면만 걷어 낸다.
 *
 * 이 파일은 다섯 게임에 **복사본**으로 들어간다(완전 별개 프로젝트 원칙) — 정본은 saga-web/shared/js/.
 * 게임마다 다른 것(이름·타이틀 그림·진행 조각·설정 단추·서랍)은 `DG.cfg.account` 로 받는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /** 판별 차이는 각 판 core.js 끝의 `DG.cfg.account` 한 덩이다(name·emoji·tag·bit·settings·drawer).
   *  이 파일은 saga-web/shared/js/account.js 정본의 복사본이다 — 직접 고치지 않는다(tools/sync-shared.mjs). */
  var CFG = (global.DG.cfg && global.DG.cfg.account) || {};

  /** 이 게임의 표시 이름 — 가입 화면 제목에 쓴다 (게임마다 다르다) */
  var GAME_NAME = CFG.name || '게임';

  /** 진행 한 조각("Lv.3" 식) — 판이 `CFG.bit(세이브)` 를 주면 그걸로(사가국지: 몇 년 몇 월·성 수) */
  function bit(s) {
    if (CFG.bit) { return CFG.bit(s); }
    return 'Lv.' + (((s && s.player) || {}).level || 1);
  }

  var STORE = core.SAVE_BASE + '/accounts';     // 프로필 목록이 사는 곳
  var LEGACY = core.SAVE_BASE + '/v1';          // 가입 개념이 없던 시절의 세이브
  var MAX = 6;

  var host = null;

  /* ── 프로필 목록 ──────────────────────────────────────── */

  function read() {
    try {
      var raw = localStorage.getItem(STORE);
      var o = raw ? JSON.parse(raw) : null;
      if (!o || !o.list) { return { list: [], cur: null }; }
      return o;
    } catch (e) {
      return { list: [], cur: null };
    }
  }

  function write(o) {
    try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) { /* 사설 모드 등 */ }
  }

  function list() { return read().list.slice(); }

  function current() {
    var o = read();
    for (var i = 0; i < o.list.length; i++) { if (o.list[i].id === o.cur) { return o.list[i]; } }
    return null;
  }

  function keyOf(id) { return core.SAVE_BASE + '/' + id; }

  /** 옛 세이브(가입 전)가 남아 있나 */
  function hasLegacy() {
    try { return !!localStorage.getItem(LEGACY); } catch (e) { return false; }
  }

  function newId() {
    /* 사람이 읽을 필요가 없는 값이라 시각 기반으로 짧게 */
    return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
  }

  /**
   * 가입 — 프로필을 만들고 그 프로필로 들어간다.
   * @param name    이름 (비우면 '무명')
   * @param absorb  옛 세이브를 이 프로필로 옮길지
   */
  function create(name, absorb) {
    var o = read();
    if (o.list.length >= MAX) { return null; }
    var acc = {
      id: newId(),
      name: String(name || '').trim().slice(0, 12) || '무명',
      at: Date.now(), lastSeen: Date.now()
    };
    o.list.push(acc);
    o.cur = acc.id;
    write(o);

    if (absorb && hasLegacy()) {
      try {
        localStorage.setItem(keyOf(acc.id), localStorage.getItem(LEGACY));
        /* 옛 키는 지우지 않는다 — 되돌리고 싶을 때가 있다(용량도 작다) */
        core.log('📦 이전 진행을 ' + acc.name + ' 으로 이어받았다', 'good');
      } catch (e) { /* 옮기지 못해도 새로 시작하면 된다 */ }
    }
    return acc;
  }

  function use(id) {
    var o = read();
    for (var i = 0; i < o.list.length; i++) {
      if (o.list[i].id === id) {
        o.cur = id;
        o.list[i].lastSeen = Date.now();
        write(o);
        return o.list[i];
      }
    }
    return null;
  }

  function rename(id, name) {
    var o = read();
    for (var i = 0; i < o.list.length; i++) {
      if (o.list[i].id === id) {
        o.list[i].name = String(name || '').trim().slice(0, 12) || o.list[i].name;
        write(o);
        return o.list[i];
      }
    }
    return null;
  }

  /** 프로필과 그 세이브를 지운다 (돌이킬 수 없다) */
  function remove(id) {
    var o = read(), out = [];
    for (var i = 0; i < o.list.length; i++) {
      if (o.list[i].id !== id) { out.push(o.list[i]); }
    }
    o.list = out;
    if (o.cur === id) { o.cur = out.length ? out[0].id : null; }
    write(o);
    try { localStorage.removeItem(keyOf(id)); } catch (e) { /* 이미 없으면 됐다 */ }
    return o.cur;
  }

  /** 그 프로필의 진행이 얼마나 되나 (전환 화면에 한 줄로 보여 준다) */
  function summaryOf(id) {
    try {
      var raw = localStorage.getItem(keyOf(id));
      if (!raw) { return '새 판'; }
      var s = JSON.parse(raw);
      var p = s.player || {};
      var bits = [bit(s)];
      var hero = s.dex && s.dex.heroes ? Object.keys(s.dex.heroes).length : 0;
      if (hero) { bits.push('인물 ' + hero); }
      if (s.quiz && s.quiz.learned) {
        var q = Object.keys(s.quiz.learned).length;
        if (q) { bits.push('지식 ' + q); }
      }
      if (p.distance) { bits.push(core.fmt(p.distance) + 'm'); }
      return bits.join(' · ');
    } catch (e) {
      return '읽을 수 없음';
    }
  }

  /* ── 진입 게이트 ──────────────────────────────────────── */

  /**
   * 게임을 시작하기 전에 프로필을 정한다.
   * @param start 프로필이 정해진 뒤 돌릴 함수 (게임의 원래 boot 본문)
   */
  function gate(start) {
    /* 자가진단(_test.html)은 가입 화면을 띄우지 않는다 — 진단용 고정 키로 바로 시작한다.
       그러지 않으면 게임이 켜지지 않아 모든 항목이 줄줄이 실패한다. */
    if (global.DG_NO_ACCOUNT) {
      core.setSaveKey(core.SAVE_BASE + '/test');
      start();
      return null;
    }
    var acc = current();
    if (acc) {
      core.setSaveKey(keyOf(acc.id));
      use(acc.id);
      start();
      injectButton();
      /* 이미 있는 이름이라도 매번 타이틀 화면을 한 번 덮는다("온라인 게임처럼") —
         게임은 이미 밑에서 돈다 */
      showTitle(acc);
      return acc;
    }
    /* 프로필이 없다 — 가입 화면부터 */
    showSignup(function (made) {
      core.setSaveKey(keyOf(made.id));
      start();
      injectButton();
    });
    return null;
  }

  /* ── 화면 ─────────────────────────────────────────────── */

  function style() {
    if (document.getElementById('acc-style')) { return; }
    var st = document.createElement('style');
    st.id = 'acc-style';
    st.textContent = [
      '#acc-host{position:fixed;inset:0;z-index:60;display:none;place-items:center;',
      'background:radial-gradient(ellipse at 50% -10%,#2b3c58 0%,#141824 55%,#0a0b0f 100%);',
      'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overflow:auto;padding:24px 0}',
      '#acc-host.show{display:grid}',
      '.title-wrap{display:flex;flex-direction:column;align-items:center;gap:14px}',
      '.title-char{font-size:56px;filter:drop-shadow(0 10px 16px rgba(0,0,0,.5))}',
      '.title-logo{font:800 28px "Malgun Gothic",system-ui;color:#f5b445;letter-spacing:1px;',
      'text-shadow:0 2px 14px rgba(245,180,69,.35)}',
      '.title-tag{font-size:12px;color:#aab2c2;margin-top:-8px}',
      '.acc-shell{display:flex;flex-direction:column;align-items:center;gap:18px;',
      'width:min(400px,calc(100% - 28px))}',
      '.acc-card{width:100%;padding:20px;border-radius:22px;',
      'background:#171a21;border:1px solid rgba(255,255,255,.12);box-shadow:0 18px 50px rgba(0,0,0,.5);',
      'font:400 13px/1.7 "Malgun Gothic",system-ui;color:#eef1f6}',
      '.acc-card h3{margin:0 0 2px;font-size:17px;color:#f5b445}',
      '.acc-card p.sub{margin:0 0 14px;font-size:12px;color:#9aa3b2}',
      '.acc-card input[type=text]{width:100%;padding:11px 12px;border-radius:12px;',
      'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#eef1f6;',
      'font:600 14px "Malgun Gothic",system-ui;margin-bottom:10px}',
      '.acc-card label.chk{display:flex;gap:8px;align-items:flex-start;font-size:12px;',
      'color:#cfd6e3;margin:2px 0 14px;cursor:pointer}',
      '.acc-row{display:flex;gap:8px;align-items:center;padding:10px 12px;border-radius:14px;',
      'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);margin-bottom:7px}',
      '.acc-row b{font-size:13.5px}.acc-row small{display:block;font-size:11px;color:#9aa3b2}',
      '.acc-row .go{margin-left:auto}',
      '.acc-btn{padding:10px 14px;border-radius:12px;cursor:pointer;font:700 12.5px "Malgun Gothic",system-ui;',
      'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:#eef1f6}',
      '.acc-btn.primary{background:#f5b445;border-color:#f5b445;color:#22190a}',
      '.acc-btn.wide{width:100%;display:block;margin-top:4px}',
      '.acc-btn.tiny{padding:6px 9px;font-size:11px}',
      '.acc-btn.danger{border-color:rgba(224,101,101,.5);color:#f0a9a9}',
      '.acc-foot{margin-top:12px;font-size:11px;color:#7f8796;line-height:1.7}'
    ].join('');
    document.head.appendChild(st);
  }

  function mount() {
    style();
    if (!host) {
      host = document.getElementById('acc-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'acc-host';
        document.body.appendChild(host);
      }
    }
    return host;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function close() {
    if (host) { host.classList.remove('show'); host.innerHTML = ''; }
  }

  /** 로고·캐릭터 — 가입 화면과 타이틀 화면(showTitle)이 같이 쓴다 */
  function titleHero() {
    return '<div class="title-wrap"><div class="title-char">' + esc(CFG.emoji || '🎮') + '</div>' +
      '<div class="title-logo">' + esc(GAME_NAME) + '</div>' +
      '<div class="title-tag">' + esc(CFG.tag || '') + '</div></div>';
  }

  /** 가입 화면 — 프로필이 하나도 없을 때. 이 화면 자체가 타이틀 화면을 겸한다 */
  function showSignup(done) {
    var h = mount();
    var legacy = hasLegacy();
    h.innerHTML = '<div class="acc-shell">' + titleHero() +
      '<div class="acc-card">' +
        '<h3>회원가입</h3>' +
        '<p class="sub">이름을 넣으면 그 이름으로 진행이 저장됩니다.<br>' +
        '이 브라우저 안에만 남습니다 — 비밀번호는 없습니다.</p>' +
        '<input type="text" id="acc-name" maxlength="12" placeholder="이름 (예: 민호)" value="">' +
        (legacy
          ? '<label class="chk"><input type="checkbox" id="acc-absorb" checked>' +
            '<span>지금까지의 진행을 이 이름으로 <b>이어받기</b><br>' +
            '<small style="color:#9aa3b2">' + esc(summaryLegacy()) + '</small></span></label>'
          : '') +
        '<button class="acc-btn primary wide" id="acc-go">시작하기</button>' +
        '<div class="acc-foot">나중에 상단 👤 에서 이름을 바꾸거나 다른 이름으로 새 판을 만들 수 있습니다.</div>' +
      '</div></div>';
    h.classList.add('show');

    var input = document.getElementById('acc-name');
    if (input) { input.focus(); }

    function go() {
      var name = input ? input.value : '';
      var ab = document.getElementById('acc-absorb');
      var acc = create(name, ab ? ab.checked : false);
      if (!acc) { return; }
      close();
      done(acc);
    }
    document.getElementById('acc-go').addEventListener('click', go);
    if (input) {
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { go(); } });
    }
  }

  function summaryLegacy() {
    try {
      var s = JSON.parse(localStorage.getItem(LEGACY));
      var p = s.player || {};
      var hero = s.dex && s.dex.heroes ? Object.keys(s.dex.heroes).length : 0;
      return bit(s) + ' · 인물 ' + hero + ' · 공적 ' + (p.featTotal || 0);
    } catch (e) {
      return '이전 진행';
    }
  }

  /** 타이틀 화면 — 프로필이 이미 있을 때 게임 위에 한 번 덮는다. 게임은 이미
   *  켜진 채로 밑에서 돈다(gate() 가 start() 를 먼저 부른다) — "이어하기"는
   *  화면만 걷어 낸다. (이 판엔 아직 설정 시트가 없어 버튼을 넣지 않았다) */
  function showTitle(acc) {
    var h = mount();
    h.innerHTML = '<div class="acc-shell">' + titleHero() +
      '<div class="acc-card">' +
        '<h3>다시 오셨군요</h3>' +
        '<p class="sub"><b>' + esc(acc.name) + '</b> 님 — ' + esc(summaryOf(acc.id)) + '</p>' +
        '<button class="acc-btn primary wide" id="title-continue">이어하기</button>' +
        '<button class="acc-btn wide" id="title-switch">👤 다른 이름으로</button>' +
        (CFG.settings ? '<button class="acc-btn wide" id="title-settings">⚙️ 설정</button>' : '') +
      '</div></div>';
    h.classList.add('show');

    document.getElementById('title-continue').addEventListener('click', close);
    document.getElementById('title-switch').addEventListener('click', showSwitch);
    if (CFG.settings) {   // 게임은 이미 밑에서 돈다 — 실제 설정 시트를 곧장 연다
      document.getElementById('title-settings').addEventListener('click', function () {
        close();
        if (global.DG.ui) { global.DG.ui.openSheet('settings'); }
      });
    }
  }

  /** 프로필 전환·관리 화면 — 상단 👤 */
  function showSwitch() {
    var h = mount();
    var o = read();
    var cur = o.cur;
    var rows = '';
    for (var i = 0; i < o.list.length; i++) {
      var a = o.list[i];
      rows += '<div class="acc-row">' +
        '<div><b>' + esc(a.name) + (a.id === cur ? ' <span style="color:#f5b445">지금</span>' : '') +
          '</b><small>' + esc(summaryOf(a.id)) + '</small></div>' +
        '<div class="go">' +
          (a.id === cur
            ? '<button class="acc-btn tiny" data-acc-rename="' + a.id + '">이름</button>'
            : '<button class="acc-btn tiny primary" data-acc-use="' + a.id + '">들어가기</button>') +
          ' <button class="acc-btn tiny danger" data-acc-del="' + a.id + '">삭제</button>' +
        '</div></div>';
    }
    h.innerHTML =
      '<div class="acc-shell"><div class="acc-card">' +
        '<h3>👤 누구로 놀까요</h3>' +
        '<p class="sub">' + esc(GAME_NAME) + ' — 이름마다 진행이 따로 저장됩니다.</p>' +
        rows +
        (o.list.length < MAX
          ? '<button class="acc-btn wide" id="acc-new">+ 새 이름으로 시작</button>' : '') +
        '<button class="acc-btn wide" id="acc-close">닫기</button>' +
        '<div class="acc-foot">삭제하면 그 이름의 진행이 사라집니다 — 되돌릴 수 없습니다.</div>' +
      '</div></div>';
    h.classList.add('show');

    h.addEventListener('click', function (e) {
      var b = e.target.closest('[data-acc-use],[data-acc-del],[data-acc-rename]');
      if (b) {
        var id;
        if ((id = b.getAttribute('data-acc-use'))) {
          use(id);
          location.reload();                 // 세이브를 갈아타는 가장 안전한 길
          return;
        }
        if ((id = b.getAttribute('data-acc-del'))) {
          var acc = null, k;
          for (k = 0; k < o.list.length; k++) { if (o.list[k].id === id) { acc = o.list[k]; } }
          if (!confirm('"' + (acc ? acc.name : '') + '" 의 진행을 지울까요? 되돌릴 수 없습니다.')) { return; }
          var next = remove(id);
          if (!next) { location.reload(); return; }   // 다 지웠으면 가입 화면부터
          if (id === cur) { location.reload(); return; }
          showSwitch();
          return;
        }
        if ((id = b.getAttribute('data-acc-rename'))) {
          var now = current();
          var name = global.prompt('새 이름', now ? now.name : '');
          if (name !== null) { rename(id, name); showSwitch(); }
          return;
        }
      }
      if (e.target.id === 'acc-new') {
        var nm = global.prompt('새 이름 (이 이름으로 새 판을 시작합니다)', '');
        if (nm === null) { return; }
        var made = create(nm, false);
        if (made) { use(made.id); location.reload(); }
        return;
      }
      if (e.target.id === 'acc-close' || e.target === h) { close(); }
    });
  }

  /** 상단 도구줄에 👤 를 끼워 넣는다 (index.html 을 고치지 않아도 되게) */
  function injectButton() {
    var tools = document.querySelector('#top .tools');
    if (!tools || document.getElementById('btn-acc')) { return; }
    var b = document.createElement('button');
    b.className = 'icon-btn';
    b.id = 'btn-acc';
    var acc = current();
    b.title = (acc ? acc.name : '프로필') + ' — 이름 바꾸기 · 다른 이름으로 놀기';
    b.textContent = '👤';
    b.addEventListener('click', showSwitch);
    /* 폰에서는 도구가 ⋯ 서랍으로 접힌다 — 👤 도 그 안에 들어가야 한다.
       서랍이 없는 판(옛 index.html)이면 예전처럼 도구줄 맨 앞에 선다 */
    var drawer = CFG.drawer ? document.getElementById('tools-drawer') : null;
    if (drawer) { drawer.insertBefore(b, drawer.firstChild); }
    else { tools.insertBefore(b, tools.firstChild); }
  }

  global.DG = global.DG || {};
  global.DG.account = {
    GAME_NAME: GAME_NAME, MAX: MAX,
    list: list, current: current, keyOf: keyOf, summaryOf: summaryOf, realmBit: CFG.bit,
    hasLegacy: hasLegacy, create: create, use: use, rename: rename, remove: remove,
    gate: gate, showSignup: showSignup, showSwitch: showSwitch, showTitle: showTitle,
    injectButton: injectButton,
    /** 자가진단용 — 화면 없이 프로필만 다룬다 */
    _store: STORE, _legacy: LEGACY, _read: read, _write: write
  };
})(window);
