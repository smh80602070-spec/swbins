/**
 * 시작 캐릭터 선택 — 새 세이브일 때 플레이어가 직접 셋을 고른다
 * ---------------------------------------------------------------
 * 여태는 `game.js`의 `pickNewHero(3)`가 등급 3 이하(12명) 중 무작위로 셋을
 * 뽑아 조용히 합류시켰다("출사표"). 사용자가 "시작 캐릭터를 직접 고르게"
 * 요청 — 그 자동 배정을 화면으로 바꾼다.
 *
 * `js/account.js`의 "부트를 멈추고 화면을 띄운 뒤, 끝나면 콜백으로 이어간다"
 * 패턴을 그대로 본뜬다(이 판에서 유일한 전례). 다만 계정 정체성이 아니라
 * 게임 콘텐츠를 고르는 화면이라 완전히 별개 모듈로 둔다 — `core.save`는
 * 절대 안 건드리고, 고른 인물 id만 콜백으로 돌려준다(합류 처리는 지금처럼
 * `game.js`의 `joinHero`가 전담).
 *
 * 게임 코드는 이 파일을 **한 곳에서만** 부른다: `game.js`의 `startInner()`.
 */
(function (global) {
  'use strict';

  var CAP_RARITY = 3;    // 지금 출사표와 같은 등급 상한 — 밸런스 의도를 그대로 유지
  var host = null, picked = [];

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** 후보 풀 — 등급 3 이하 전부. 12명이면 무작위 셔플 없이 다 보여줘도
   *  화면이 넘치지 않는다(재뽑기 개념 자체가 필요 없다).
   *  W-0115 — 도감에 붙은 사가천하 장수 사본(`realm: true`, 등급 3 이하 131)은 빼서 예전 26명 그대로 둔다. */
  function candidates() {
    var D = global.DG.data, out = [], i;
    for (i = 0; i < D.heroes.length; i++) {
      if (D.heroes[i].rarity <= CAP_RARITY && !D.heroes[i].realm) { out.push(D.heroes[i]); }
    }
    return out;
  }

  function style() {
    if (document.getElementById('starter-style')) { return; }
    var st = document.createElement('style');
    st.id = 'starter-style';
    st.textContent = [
      /* account.js의 #acc-host(z-index 60)보다 위 — 드문 경합(새 프로필 직후
         showTitle()이 곧바로 뜨는 경우)에도 이 화면이 가려지지 않는다 */
      '#starter-host{position:fixed;inset:0;z-index:65;display:none;place-items:center;',
      'background:radial-gradient(ellipse at 50% -10%,#2b3c58 0%,#141824 55%,#0a0b0f 100%);',
      'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overflow:auto;padding:24px 0}',
      '#starter-host.show{display:grid}',
      '.stc-shell{display:flex;flex-direction:column;align-items:center;gap:14px;',
      'width:min(640px,calc(100% - 28px))}',
      '.stc-head{text-align:center}',
      '.stc-head h3{margin:0 0 2px;font:800 20px "Malgun Gothic",system-ui;color:#f5b445}',
      '.stc-head p{margin:0;font-size:12px;color:#9aa3b2}',
      '.stc-count{margin-top:6px;font:700 13px "Malgun Gothic",system-ui;color:#eef1f6}',
      '.stc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));',
      'gap:9px;width:100%}',
      '.stc-cell{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 6px;',
      'border-radius:14px;background:rgba(255,255,255,.05);border:2px solid rgba(255,255,255,.10);',
      'cursor:pointer;font:400 11px "Malgun Gothic",system-ui;color:#eef1f6}',
      '.stc-cell img{width:64px;height:74px;border-radius:8px;object-fit:cover}',
      '.stc-cell b{font-size:12px}',
      '.stc-cell .hanja{font-size:11px;color:#9aa3b2}',
      '.stc-cell .tag{font-size:11px;font-weight:700}',
      '.stc-cell.picked{border-color:#f5b445;background:rgba(245,180,69,.14)}',
      '.stc-btn{padding:11px 16px;border-radius:12px;cursor:pointer;width:100%;',
      'font:700 13px "Malgun Gothic",system-ui;background:#f5b445;border:1px solid #f5b445;',
      'color:#22190a}',
      '.stc-btn[disabled]{opacity:.4;cursor:default}'
    ].join('');
    document.head.appendChild(st);
  }

  function mount() {
    style();
    if (!host) {
      host = document.getElementById('starter-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'starter-host';
        document.body.appendChild(host);
      }
    }
    return host;
  }

  function cardHtml(h) {
    var D = global.DG.data;
    var rar = D.rarity[h.rarity] || D.rarity[3];
    var img = (global.DG.portrait3d && global.DG.portrait3d.of('hero', h, 96, 110)) || (global.DG.sprite ? global.DG.sprite.portraitCard('hero', h, 96, 110) : '');   // 구운 초상(§11 Phase 1)이 있으면 코드 그림 대신
    return '<button class="stc-cell" data-id="' + esc(h.id) + '">' +
      (img ? '<img src="' + img + '" alt="">' : '') +
      '<b>' + esc(h.name) + '</b>' +
      (h.hanja ? '<span class="hanja">' + esc(h.hanja) + '</span>' : '') +
      '<span class="tag" style="color:' + rar.color + '">' + rar.label + '</span>' +
      '</button>';
  }

  function renderCount(need) {
    var el = host.querySelector('.stc-count');
    if (el) { el.textContent = picked.length + ' / ' + need + ' 선택'; }
    var btn = host.querySelector('.stc-btn');
    if (btn) { btn.disabled = picked.length !== need; }
  }

  function close() {
    if (host) { host.classList.remove('show'); host.innerHTML = ''; }
  }

  /**
   * @param need      정확히 몇 명을 고르게 할지 (game.js가 START_PARTY를 넘긴다)
   * @param onConfirm function(chosenIds: string[]) — 정확히 한 번 불린다
   */
  function show(need, onConfirm) {
    /* 자가진단(_test.html)은 화면을 안 띄운다 — account.js의 DG_NO_ACCOUNT를
       그대로 빌린다("헤드리스·진단 모드"라는 뜻이 이미 이 값에 있다). 예전
       pickNewHero(3) 과 같은 무작위 통계로 즉시 뽑아 넘긴다. */
    if (global.DG_NO_ACCOUNT) {
      var pool = candidates().slice(), chosen = [], i;
      for (i = 0; i < need && pool.length; i++) {
        chosen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
      }
      onConfirm(chosen);
      return;
    }

    picked = [];
    var h = mount();
    var list = candidates();
    h.innerHTML = '<div class="stc-shell">' +
      '<div class="stc-head"><h3>출사표 — 함께할 셋을 고르세요</h3>' +
      '<p>맨몸으로는 던전에 들어갈 수 없습니다. 정확히 ' + need + '명을 고르세요.</p>' +
      '<div class="stc-count">0 / ' + need + ' 선택</div></div>' +
      '<div class="stc-grid">' + list.map(cardHtml).join('') + '</div>' +
      '<button class="stc-btn" disabled>이 셋으로 출사표를 올린다</button>' +
      '</div>';
    h.classList.add('show');
    renderCount(need);

    h.addEventListener('click', function (e) {
      var cell = e.target.closest('.stc-cell');
      if (cell) {
        var id = cell.getAttribute('data-id');
        var idx = picked.indexOf(id);
        if (idx >= 0) {
          picked.splice(idx, 1);
          cell.classList.remove('picked');
        } else if (picked.length < need) {
          picked.push(id);
          cell.classList.add('picked');
        }
        renderCount(need);
        return;
      }
      if (e.target.closest('.stc-btn') && picked.length === need) {
        var ids = picked.slice();
        close();
        onConfirm(ids);
      }
    });
  }

  global.DG = global.DG || {};
  global.DG.starter = { show: show, candidates: candidates };
})(window);
