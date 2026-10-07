/**
 * 편집기 공용 "▶ 실행" 창 — 편집기 화면 오른쪽에 게임을 띄운다(편집기 서버의 `/play/<판>/`, gameserve.js).
 *
 *   SagaPlay.open(판, at?)       창을 열고 그 판을 띄운다. 자리를 주면 거기서 시작(받는 판만 — gameserve.js START)
 *                                at = {x, y}(사가만리 미터) · {in, x, y, name}(사가종횡 사냥터·사가나락 마을) · {in, name}(사가천하 성)
 *   SagaPlay.reloadIfOpen()      저장한 뒤 부른다 — 열려 있으면 새로 띄워 고친 것을 곧바로 본다
 *   SagaPlay.mount(el, getGame)  el 안에 [판 고르기][▶ 실행] 단추를 붙인다(판이 정해지지 않은 화면용)
 *
 * 실행 창의 세이브는 **연습용**이다 — 편집기 서버는 출처(포트)가 달라 실제 게임(8791~) 세이브와 섞이지 않는다.
 * 창 안 "세이브 비우기"는 이 출처의 그 판 세이브만 지운다(판별 세이브 키 앞머리, CLAUDE.md 표).
 */
(function () {
  'use strict';

  var GAMES = [
    { id: 'saga-go', name: '사가만리', save: 'deungyong-go/' },
    { id: 'saga-dungeon', name: '사가나락', save: 'yeoksa-dungeon/' },
    { id: 'saga-forest', name: '사가마을', save: 'yeoksa-village/' },
    { id: 'saga-story', name: '사가종횡', save: 'yeoksa-side/' },
    { id: 'saga-realm', name: '사가천하', save: 'saga-realm/' }
  ];
  var panel = null, frame = null, cur = null, phone = false;

  function css() {
    if (document.getElementById('saga-play-css')) { return; }
    var st = document.createElement('style');
    st.id = 'saga-play-css';
    st.textContent = [
      '#saga-play { position: fixed; top: 44px; right: 0; bottom: 0; width: 46vw; min-width: 380px; z-index: 50; display: flex; flex-direction: column;',
      '  background: #15161a; border-left: 2px solid #3f6bd8; box-shadow: -6px 0 18px rgba(0,0,0,0.4); }',
      '#saga-play .bar { display: flex; gap: 6px; align-items: center; padding: 6px 8px; background: #26272b; border-bottom: 1px solid #3a3c42; font-size: 12.5px; color: #e6e6e6; }',
      '#saga-play .bar b { color: #cfd6ff; } #saga-play .bar .sp { flex: 1; } #saga-play .bar .mu { color: #9a9ea6; font-size: 11.5px; }',
      '#saga-play .bar button { background: #2d2f34; color: #e6e6e6; border: 1px solid #3a3c42; border-radius: 5px; padding: 3px 8px; cursor: pointer; font: inherit; }',
      '#saga-play .bar button:hover { border-color: #5b8cff; } #saga-play .bar button.on { background: #34405e; border-color: #5b8cff; }',
      '#saga-play .stage { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; background: #0d0e11; }',
      '#saga-play iframe { border: 0; width: 100%; height: 100%; background: #000; }',
      '#saga-play.phone iframe { width: 390px; height: min(844px, 100%); border: 1px solid #3a3c42; border-radius: 14px; }',
      '#saga-play .grip { position: absolute; left: -5px; top: 0; bottom: 0; width: 8px; cursor: ew-resize; }'
    ].join('\n');
    document.head.appendChild(st);
  }
  function gameOf(id) { for (var i = 0; i < GAMES.length; i++) { if (GAMES[i].id === id) { return GAMES[i]; } } return { id: id, name: id, save: null }; }

  function build() {
    css();
    panel = document.createElement('div');
    panel.id = 'saga-play';
    panel.innerHTML = '<div class="grip" title="끌어서 폭 조절"></div>' +
      '<div class="bar"><b>▶ 실행</b><span class="mu" id="saga-play-name"></span><span class="sp"></span>' +
      '<button data-a="reload" title="다시 띄우기 — 저장한 것을 읽는다">⟳ 다시</button>' +
      '<button data-a="phone" title="폰 화면 크기(390×844)">폰</button>' +
      '<button data-a="wipe" title="이 창(연습용)의 이 판 세이브를 지우고 다시 — 실제 게임 세이브는 안 건드린다">세이브 비우기</button>' +
      '<button data-a="tab" title="새 탭으로">새 탭</button>' +
      '<button data-a="close" title="닫기 (Esc 는 편집기 몫이라 여기선 안 받는다)">✕</button></div>' +
      '<div class="stage"><iframe allow="fullscreen; gamepad; autoplay; geolocation"></iframe></div>';
    document.body.appendChild(panel);
    frame = panel.querySelector('iframe');
    panel.querySelector('.bar').addEventListener('click', function (e) {
      var a = e.target && e.target.getAttribute('data-a');
      if (a === 'reload') { load(); }
      else if (a === 'phone') { phone = !phone; panel.classList.toggle('phone', phone); e.target.classList.toggle('on', phone); }
      else if (a === 'wipe') { wipe(); }
      else if (a === 'tab') { window.open(url(), '_blank', 'noopener'); }
      else if (a === 'close') { close(); }
    });
    /* 폭 끌기 — 끄는 동안 iframe 이 마우스를 삼키지 않게 막는다 */
    var grip = panel.querySelector('.grip');
    grip.addEventListener('pointerdown', function (e) {
      grip.setPointerCapture(e.pointerId); frame.style.pointerEvents = 'none';
      function mv(ev) { panel.style.width = Math.max(320, window.innerWidth - ev.clientX) + 'px'; }
      function up() { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); frame.style.pointerEvents = ''; }
      grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
    });
  }
  function url() {
    var a = cur.at, q = [];
    if (a && a.x != null) { q.push('at=' + Math.round(a.x * 10) / 10 + ',' + Math.round(a.y * 10) / 10); }
    if (a && a.in) { q.push('in=' + encodeURIComponent(a.in)); }
    return '/play/' + cur.game + '/' + (q.length ? '?' + q.join('&') : '');
  }
  function where(a) {
    if (!a) { return ''; }
    var s = a.in ? (a.name || a.in) : '';
    if (a.x != null) { s += (s ? ' ' : '') + '(' + Math.round(a.x) + ', ' + Math.round(a.y) + ')'; }
    return ' · 시작 ' + s;
  }
  function load() {
    if (!cur) { return; }
    var g = gameOf(cur.game);
    document.getElementById('saga-play-name').textContent = g.name + ' · 연습용 세이브' + where(cur.at);
    frame.src = 'about:blank';
    setTimeout(function () { frame.src = url(); }, 30);
  }
  /* 같은 출처(편집기 서버)라 iframe 의 localStorage 는 이 창에서 곧바로 지울 수 있다 */
  function wipe() {
    var g = gameOf(cur.game);
    if (!g.save) { return; }
    var n = 0, keys = [], i;
    try {
      for (i = 0; i < localStorage.length; i++) { keys.push(localStorage.key(i)); }
      keys.forEach(function (k) { if (k && k.indexOf(g.save) === 0) { localStorage.removeItem(k); n++; } });
    } catch (e) { /* 막힌 저장소 — 조용히 넘어간다 */ }
    document.getElementById('saga-play-name').textContent = g.name + ' · 연습용 세이브 ' + n + '개 지움';
    load();
  }
  function open(game, at) {
    if (!panel) { build(); }
    cur = { game: game, at: at || null };
    /* 편집기 윗줄(#top) 밑에 붙인다 — 화면마다 윗줄 높이가 다르다 */
    var top = document.getElementById('top') || document.getElementById('topbar');
    panel.style.top = (top ? Math.round(top.getBoundingClientRect().bottom) : 0) + 'px';
    panel.style.display = 'flex';
    load();
  }
  function close() { if (panel) { panel.style.display = 'none'; frame.src = 'about:blank'; } }
  function isOpen() { return !!(panel && panel.style.display !== 'none'); }
  function reloadIfOpen() { if (isOpen()) { load(); } }

  function mount(el, getGame) {
    var sel = document.createElement('select');
    sel.title = '실행할 판';
    sel.innerHTML = GAMES.map(function (g) { return '<option value="' + g.id + '">' + g.name + '</option>'; }).join('');
    var btn = document.createElement('button');
    btn.textContent = '▶ 실행'; btn.title = 'F5 — 이 편집기 안에서 게임을 띄운다(연습용 세이브)';
    btn.onclick = function () { open(sel.value); };
    if (getGame) { sel.addEventListener('focus', function () { var g = getGame(); if (g) { sel.value = g; } }); var g0 = getGame(); if (g0) { sel.value = g0; } }
    el.appendChild(sel); el.appendChild(btn);
    window.addEventListener('keydown', function (e) {
      if (e.key === 'F5' && !e.ctrlKey) { e.preventDefault(); var g = getGame && getGame(); if (g) { sel.value = g; } open(sel.value); }
    });
    return { select: sel, button: btn };
  }

  window.SagaPlay = { open: open, close: close, isOpen: isOpen, reloadIfOpen: reloadIfOpen, mount: mount, GAMES: GAMES };
})();
