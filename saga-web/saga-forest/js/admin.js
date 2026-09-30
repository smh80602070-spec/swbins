/**
 * 어드민 — QA 운영판 (`_admin.html` 이 부른다)
 * ---------------------------------------------------------------
 * 게임을 켜지 않고 **세이브와 손잡이만** 다룬다. 그림도 루프도 없다.
 *
 *   세이브   재화·도구·가방·진행 비우기
 *   마을     이름·깃발·전방 등급·잡초·주민(친밀도·부탁·이사)
 *   집·사고·옷
 *   때(時)   계절·시간대·날씨·행사를 못 박고, 날짜를 민다
 *   손잡이   규칙 상수 (core.tuned 가 읽는다)
 *   프리셋   확인하려는 상황을 한 번에 만든다 + 스냅샷 세 칸
 *
 * **이 마을은 실제 시계에 크게 기댄다** — 계절·시간대·날씨·행사·요일이 다 날짜에서
 * 나온다. 그래서 이 어드민에서 가장 값진 탭은 '때' 다. 그날을 기다리지 않고 가 본다.
 *
 * 고친 뒤에는 `core.POKE_KEY` 를 두드린다. 게임 창이 열려 있으면 그것을 보고
 * 세이브를 다시 읽는다 — 게임이 10초마다 저장하므로, 안 그러면 곧 덮인다.
 */
(function (global) {
  'use strict';

  var DG = global.DG;
  var C = DG.core, A = DG.account, D = DG.data;
  var V = DG.village, VD = DG.villageData;
  var H = DG.home, M = DG.mail, MU = DG.museum;
  var T = DG.town, F = DG.folk, TN = DG.turnip, WR = DG.wear;
  var VV = DG.villageView;

  /* ── 잔손 ─────────────────────────────────────────── */

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (html !== undefined) { n.innerHTML = html; }
    return n;
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  var logT = null;
  function say(msg) {
    var b = $('log');
    b.textContent = msg;
    b.classList.add('show');
    if (logT) { clearTimeout(logT); }
    logT = setTimeout(function () { b.classList.remove('show'); }, 2600);
  }

  /** 숫자 칸 하나 — 읽고(get) 쓰는(set) 짝을 받는다 */
  function numField(host, label, get, set, step) {
    var f = el('div', 'fld');
    f.appendChild(el('label', null, label));
    var i = el('input');
    i.type = 'number';
    if (step) { i.step = step; }
    i.value = get();
    i.addEventListener('change', function () {
      var v = Number(i.value);
      set(isFinite(v) ? v : 0);
      renderAll();
    });
    f.appendChild(i);
    host.appendChild(f);
    return i;
  }

  /* ── 프로필 ───────────────────────────────────────── */

  function profiles() {
    var l = A.list();
    if (!l.length) { l = [{ id: 'v1', name: '(가입 전 세이브)' }]; }
    return l;
  }
  function keyFor(id) { return id === 'v1' ? (C.SAVE_BASE + '/v1') : A.keyOf(id); }

  function fillProfiles() {
    var sel = $('prof');
    sel.innerHTML = '';
    profiles().forEach(function (p) {
      var o = el('option');
      o.value = p.id; o.textContent = p.name + ' (' + p.id + ')';
      sel.appendChild(o);
    });
    var cur = A.current();
    if (cur) { sel.value = cur.id; }
    openProfile(sel.value);
  }

  function openProfile(id) {
    C.setSaveKey(keyFor(id));
    var ok = C.load();
    /* 마을을 세워야 주민·사물이 생긴다. 게임의 부트와 같은 차례다 */
    try { V.init(); } catch (e) { say('마을을 세우지 못했습니다: ' + e.message); }
    say(ok ? '프로필을 읽었습니다 · ' + C.SAVE_KEY : '세이브가 비어 있어 새 판으로 엽니다');
    renderAll();
  }

  /** 저장 — 게임 창이 열려 있으면 그 창도 다시 읽게 두드린다 */
  function commit(msg) {
    C.persist();
    try { localStorage.setItem(C.POKE_KEY, String(Date.now())); } catch (e) { /* 무시 */ }
    renderAll();
    say(msg || '저장했습니다');
  }

  /* ── 요약 ─────────────────────────────────────────── */

  function renderSummary() {
    var p = C.save.player, s = V.state();
    var st = null;
    try { st = V.status(); } catch (e) { /* 마을이 안 섰으면 건너뛴다 */ }
    var mu = MU.count();
    $('sum').innerHTML =
      'Lv.' + p.level + ' · 🪙 ' + C.fmt(p.gold) + ' · 🎖️ ' + C.fmt(p.fame) +
      ' · 🏅 ' + C.fmt(p.feat) +
      ' · 채집 ' + C.fmt(s.gathered) + ' · 판매 ' + C.fmt(s.sold) +
      ' · 심부름 ' + s.helped + '<br>' +
      (st ? (st.season.icon || '') + st.season.name + ' · ' + st.phase.name +
            ' · ' + st.weather.icon + ' ' + st.weather.name +
            (st.town && st.town.event ? ' · 🎊 ' + st.town.event.name : '') +
            ' · 🏳️ ' + T.name() + '<br>' : '') +
      '주민 ' + s.residents.length + '명 · 📮 ' + M.unread() + '/' + M.list().length +
      ' · 🌿 잡초 ' + V.weedCount() +
      ' · 🏛️ ' + mu.done + '/' + mu.total +
      ' · 🏠 ' + H.status().grade + ' · 🏪 ' + V.shopLevel().name + '<br>' +
      '세이브 키 <code>' + esc(C.SAVE_KEY) + '</code> · 오늘 <code>' + V.today() +
      '</code> (' + ['일', '월', '화', '수', '목', '금', '토'][TN.dow(s.day)] + '요일)';
  }

  /* ── 세이브 탭 ────────────────────────────────────── */

  var BASICS = [
    ['레벨', function () { return C.save.player.level; }, function (v) { C.save.player.level = v; }],
    ['경험', function () { return C.save.player.exp; }, function (v) { C.save.player.exp = v; }],
    ['금 🪙', function () { return C.save.player.gold; }, function (v) { C.save.player.gold = v; }],
    ['명성 🎖️', function () { return C.save.player.fame; }, function (v) { C.save.player.fame = v; }],
    ['공적 🏅', function () { return C.save.player.feat; }, function (v) { C.save.player.feat = v; }],
    ['채집 수', function () { return V.state().gathered; }, function (v) { V.state().gathered = v; }],
    ['판매 수', function () { return V.state().sold; }, function (v) { V.state().sold = v; }],
    ['심부름 수', function () { return V.state().helped; }, function (v) { V.state().helped = v; }]
  ];

  function renderBasics() {
    var host = $('basics');
    host.innerHTML = '';
    BASICS.forEach(function (b) { numField(host, b[0], b[1], b[2]); });
  }

  function renderTools() {
    var host = $('tools');
    host.innerHTML = '';
    var k;
    for (k in VD.TOOLS) {
      if (!Object.prototype.hasOwnProperty.call(VD.TOOLS, k)) { continue; }
      (function (key) {
        var t = VD.TOOLS[key];
        var on = V.hasTool(key);
        var b = el('button', on ? 'on' : '', t.emoji + ' ' + t.name + (on ? ' — 있음' : ' — 없음'));
        b.addEventListener('click', function () {
          V.state().tools[key] = !on;
          commit(t.name + (on ? ' 을(를) 치웠습니다' : ' 을(를) 주었습니다'));
        });
        host.appendChild(b);
      })(k);
    }
  }

  var bagCat = 'fruit';

  function renderBag() {
    var cats = [['fruit', '열매'], ['nut', '씨앗'], ['ore', '광물'], ['flower', '꽃'], ['herb', '약초'],
                ['fish', '물고기'], ['bug', '곤충'], ['fossil', '화석'], ['shell', '조개'], ['ruin', '탑성 조각']];
    var host = $('bagcats');
    host.innerHTML = '';
    cats.forEach(function (c) {
      var b = el('button', bagCat === c[0] ? 'on' : '', c[1]);
      b.addEventListener('click', function () { bagCat = c[0]; renderBag(); });
      host.appendChild(b);
    });
    var all = el('button', '', '이 갈래 전부 10개');
    all.addEventListener('click', function () {
      VD.ITEMS[bagCat].forEach(function (it) { V.state().bag[it.key] = 10; });
      commit(bagCat + ' 를 열 개씩 채웠습니다');
    });
    host.appendChild(all);
    var none = el('button', 'danger', '이 갈래 비우기');
    none.addEventListener('click', function () {
      VD.ITEMS[bagCat].forEach(function (it) { delete V.state().bag[it.key]; });
      commit('비웠습니다');
    });
    host.appendChild(none);

    var box = $('bag');
    box.innerHTML = '';
    VD.ITEMS[bagCat].forEach(function (it) {
      numField(box, it.emoji + ' ' + it.name,
        function () { return V.state().bag[it.key] || 0; },
        function (v) {
          if (v > 0) { V.state().bag[it.key] = v; } else { delete V.state().bag[it.key]; }
        });
    });
  }

  var CLEARS = {
    used: function (s) { s.used = {}; },
    requests: function (s) { s.requests = {}; },
    mail: function (s) { s.mail = []; },
    weeds: function (s) { s.weeds = []; V.buildProps(); V.syncPlanted(); },
    planted: function (s) { s.planted = []; V.syncPlanted(); },
    log: function () { C.save.log = []; },
    village: function () {
      C.save.village = null;
      V.state();
      V.init();
    }
  };

  /* ── 마을 탭 ──────────────────────────────────────── */

  function renderTown() {
    $('townname').value = T.name();
    $('flagimg').src = VV.flagIcon(96);

    var row = $('flagrow');
    row.innerHTML = '';
    [['bg', VD.FLAG_BGS, '바탕'], ['fg', VD.FLAG_FGS, '무늬색'], ['sym', VD.FLAG_SYMS, '무늬']]
      .forEach(function (e) {
        row.appendChild(el('label', null, e[2]));
        var sel = el('select');
        e[1].forEach(function (o) {
          var op = el('option');
          op.value = o.key; op.textContent = o.name;
          sel.appendChild(op);
        });
        sel.value = T.flag()[e[0]];
        sel.addEventListener('change', function () {
          T.setFlag(e[0], sel.value, true);
          commit('깃발을 바꿨습니다');
        });
        row.appendChild(sel);
      });

    var s = V.state();
    $('soldgold').value = s.soldGold || 0;
    var lv = V.shopLevel();
    $('shopnow').textContent = lv.name + ' · 웃돈 +' +
      Math.round((lv.bonus - 1) * 100) + '% · 가구 ' + H.shopToday().length + '점' +
      (lv.next ? ' · 다음까지 🪙 ' + C.fmt(lv.next.at - lv.sold) : ' · 끝');
    $('weedn').value = V.weedCount();
    var b = T.beauty();
    $('beauty').textContent = '마을 평가 ' + b.grade + ' · ' + b.score + '점 (꽃 ' +
      b.flowers + ' · 심은 것 ' + b.planted + ')' + (b.capped ? ' · 상한 걸림(번들 미완)' : '');
  }

  function renderFolks() {
    var host = $('folks');
    host.innerHTML = '';
    var raw = V.raw(), s = V.state();
    raw.residents.forEach(function (res) {
      var ty = F.typeOf(res.id);
      var req = V.requestOf(res.id);
      var it = VD.item(req.want);
      var lv = M.leavingOf(res.id);
      var card = el('div', 'folk');
      card.innerHTML =
        '<img src="' + DG.sprite.portrait('hero', res.ref, 40) + '" alt="">' +
        '<div class="fm"><b>' + esc(res.ref.name) + ' ' + ty.icon + ' ' + esc(ty.name) + '</b>' +
        '<small>친밀도 ' + V.friendOf(res.id) + ' · ' +
          (req.done ? '오늘 부탁 완료' : (it ? it.emoji + ' ' + it.name + ' ×' + req.n : '부탁 없음')) +
          (lv ? ' · 💭 ' + lv.left + '일' : '') + '</small></div>';
      var fb = el('div', 'fb');

      var up = el('button', '', '💗+1');
      up.addEventListener('click', function () {
        s.friend[res.id] = V.friendOf(res.id) + 1;
        commit(res.ref.name + ' 친밀도 ' + s.friend[res.id]);
      });
      fb.appendChild(up);

      var done = el('button', req.done ? 'on' : '', '✔️부탁');
      done.addEventListener('click', function () {
        req.done = !req.done;
        commit(res.ref.name + ' 부탁 ' + (req.done ? '완료' : '되돌림'));
      });
      fb.appendChild(done);

      var fill = el('button', '', '🎒채움');
      fill.addEventListener('click', function () {
        s.bag[req.want] = (s.bag[req.want] || 0) + req.n;
        commit((it ? it.name : '') + ' ' + req.n + '개를 가방에 넣었습니다');
      });
      fb.appendChild(fill);

      var leave = el('button', lv ? 'on' : '', '💭이사');
      leave.addEventListener('click', function () {
        if (lv) { delete s.leaving[res.id]; }
        else { s.leaving[res.id] = s.day + M.NOTICE_DAYS; }
        commit(res.ref.name + (lv ? ' 의 이사를 거두었습니다' : ' 이(가) 떠날 뜻을 비쳤습니다'));
      });
      fb.appendChild(leave);

      var out = el('button', 'danger', '내보냄');
      out.addEventListener('click', function () {
        s.leaving[res.id] = s.day;
        commit(res.ref.name + ' — 다음 날 넘김에서 떠납니다');
      });
      fb.appendChild(out);

      card.appendChild(fb);
      host.appendChild(card);
    });
  }

  /* ── 집 · 사고 · 옷 탭 ────────────────────────────── */

  function renderHome() {
    var sel = $('home-tier');
    if (!sel.options.length) {
      VD.HOME_TIERS.forEach(function (t, i) {
        var o = el('option');
        o.value = i; o.textContent = t.name + ' (' + t.w + '×' + t.h + ')';
        sel.appendChild(o);
      });
    }
    sel.value = H.state().tier;
    $('home-debt').value = H.debt();
    var st = H.status();
    $('home-info').textContent = st.grade + ' · ' + st.score + '점 · 놓은 것 ' + st.n +
      ' · 창고 ' + st.stock.length + '가지 · ' + st.wall.name + ' / ' + st.floor.name;

    var mu = MU.count();
    $('museum-info').textContent = MU.grade().name + ' · ' + mu.done + '/' + mu.total + '종';

    var w = WR.status();
    $('wear-info').textContent = '지금 차림 — ' + w.name;
    var row = $('wearrow');
    row.innerHTML = '';
    w.parts.forEach(function (p) {
      var c = el('span', 'chip on', p.part.name + ' ' + p.now.name);
      row.appendChild(c);
    });
  }

  /* ── 때 탭 ────────────────────────────────────────── */

  var TIME_KNOBS = [
    ['time.season', '계절', function () {
      return VD.SEASONS.map(function (x) { return [x.key, x.name]; });
    }],
    ['time.phase', '시간대', function () {
      return VD.PHASES.map(function (x) { return [x.key, x.name]; });
    }],
    ['time.weather', '날씨', function () {
      var out = [], k;
      for (k in VD.WEATHERS) {
        if (Object.prototype.hasOwnProperty.call(VD.WEATHERS, k)) {
          out.push([k, VD.WEATHERS[k].icon + ' ' + VD.WEATHERS[k].name]);
        }
      }
      return out;
    }],
    ['time.event', '행사', function () {
      return [['none', '(행사 없음으로)']].concat(
        VD.EVENTS.map(function (e) { return [e.key, e.m + '/' + e.d + ' ' + e.name]; }));
    }]
  ];

  function renderTime() {
    var st = V.status();
    var s = V.state();
    var nx = T.next();
    $('timenow').innerHTML =
      st.season.name + ' · ' + st.phase.name + ' · ' + st.weather.icon + ' ' + st.weather.name +
      (st.town.event ? ' · 🎊 ' + st.town.event.name : ' · 여느 날') +
      (nx ? ' (다음 행사 ' + nx.event.name + ' — ' + nx.left + '일 뒤)' : '') + '<br>' +
      '오늘 <code>' + V.today() + '</code> · 세이브의 날 <code>' + s.day + '</code> · ' +
      ['일', '월', '화', '수', '목', '금', '토'][TN.dow(s.day)] + '요일 · ' +
      (TN.marketOpen() ? '🥬 순무 장이 서 있습니다' : '순무 장은 일요일 오전') + '<br>' +
      '흐르는 별 ' + (T.starNow() ? '있음 🌠' : '없음') +
      ' · 오늘 빈 소원 ' + T.wishesOn(s.day) + '번';

    var host = $('timefields');
    host.innerHTML = '';
    TIME_KNOBS.forEach(function (k) {
      var f = el('div', 'fld');
      f.appendChild(el('label', null, k[1]));
      var sel = el('select');
      var none = el('option');
      none.value = ''; none.textContent = '(실제 시계)';
      sel.appendChild(none);
      k[2]().forEach(function (o) {
        var op = el('option');
        op.value = o[0]; op.textContent = o[1];
        sel.appendChild(op);
      });
      sel.value = C.tuned(k[0], '');
      sel.addEventListener('change', function () {
        C.setTune(k[0], sel.value === '' ? null : sel.value);
        renderAll();
        say(k[1] + ' — ' + (sel.value === '' ? '실제 시계로' : sel.value));
      });
      f.appendChild(sel);
      host.appendChild(f);
    });

    $('dayshift').value = C.tuned('time.dayShift', 0);
    $('dayinfo').textContent = '세이브의 날 ' + s.day + ' · 오늘 ' + V.today() +
      (s.day === V.today() ? ' (같음)' : ' — 게임 창은 30초 안에 넘깁니다');
  }

  function shiftDay(n) {
    C.setTune('time.dayShift', C.tuned('time.dayShift', 0) + n);
    renderAll();
    say('날짜를 ' + (n > 0 ? '+' : '') + n + '일 밀었습니다 — 하루를 넘기려면 아래 단추');
  }

  /* ── 손잡이 탭 ────────────────────────────────────── */

  var TUNES = [
    { name: '나무 흔들기', keys: [
      ['shake.bee', '벌집 확률', 0.08, '0.01'],
      ['shake.furn', '가구 확률', 0.06, '0.01'],
      ['shake.gold', '돈주머니 확률', 0.05, '0.01'],
      ['shake.furnMax', '가구 하루 몫', 2]
    ] },
    { name: '곤충', keys: [
      ['bug.max', '한 번에 나오는 수', 7],
      ['bug.wary', '경계 반경', 58],
      ['bug.chaseMs', '벌떼 추격 (ms)', 6000]
    ] },
    { name: '낚시 · 심기', keys: [
      ['fish.castMin', '입질까지 최소 (ms)', 1200],
      ['fish.castVar', '입질 흔들림 (ms)', 2300],
      ['fish.biteWindow', '당길 수 있는 창 (ms)', 700],
      ['plant.days', '묘목이 자라는 날', 3]
    ] },
    { name: '잡초', keys: [
      ['weed.perDay', '하루에 나는 수 (안)', 3],
      ['weed.max', '상한', 40]
    ] },
    /* 공사 — 삯만 잡는다. 무엇을 깔 수 있는지는 규칙이지 손잡이가 아니다 */
    { name: '공사', keys: [
      ['build.costMul', '삯 배수', 1, '0.1']
    ] },
    { name: '이사', keys: [
      ['move.stayMin', '머문 날 문턱', 8],
      ['move.friendKeep', '안 떠나는 친밀도', 3],
      ['move.chance', '하루 판정', 0.12, '0.01'],
      ['move.noticeDays', '비친 뒤 며칠', 3]
    ] },
    { name: '순무 · 소원', keys: [
      ['turnip.maxBuy', '한 주 상한', 900],
      ['star.wishMax', '하룻밤 소원', 3]
    ] },
    /* 숲 고리(PLAN 40절 PHASE 3) — 마을 밖 걸어 나갈 수 있는 폭(타일). 실기기
       성능 보며 줄일 수 있게 뒀다. buildProps() 를 다시 부르는(=새로고침) 곳에서만 듣는다 */
    { name: '숲', keys: [
      ['forest.margin', '숲 고리 폭 (타일)', 32]
    ] },
    /* 3D 화면(PLAN 40절 PHASE 2~7) — village3d.quality 는 버튼 행(질 등급행,
       renderTune 위쪽)에서 따로 다룬다. 여기는 그 밖의 세부 값들 — 등급표
       (QUALITY_PRESET)가 renderR·groundTileR·dpr·shadow 의 **기본값**을 정하고,
       여기서 손잡이를 잡으면(tuned() 가 손잡이를 먼저 본다) 등급과 무관하게
       그 값이 이긴다. 전부 게임 창을 켤 때 한 번만 읽으므로 새로고침이 필요하다 */
    { name: '3D 화면 — 세부', keys: [
      ['village3d.on', '3D 기본 켬(0/1)', 1],
      ['village3d.renderR', '렌더 반경(m)', '등급표'],
      ['village3d.groundTileR', '지형 타일 반경', '등급표'],
      ['village3d.shadowR', '그림자 거리(m, PHASE 7 LOD)', 18],
      ['village3d.camDist', '3인칭 카메라 거리', 7.5, '0.1'],
      ['village3d.camHeight', '3인칭 카메라 높이', 4, '0.1'],
      ['village3d.fov', '화각(FOV)', 55],
      ['village3d.worldScale', '마을 좌표→미터 배율', 0.08, '0.01']
    ] }
  ];

  /** village3d.quality 등급 버튼 — walk.speedMul 버튼 행(renderTune 안)과 같은 결.
   *  숫자가 아니라 문자열(auto/low/medium/high)이라 TUNES 의 숫자 칸으로는 못
   *  담는다 — 그래서 따로 그린다 */
  var QUALITY_LEVELS = [['', 'auto'], ['low', 'low'], ['medium', 'medium'], ['high', 'high']];
  function renderQualityRow() {
    var row = $('qualityrow');
    if (!row) { return; }
    row.innerHTML = '';
    var cur = C.tuned('village3d.quality', '');
    QUALITY_LEVELS.forEach(function (pair) {
      var val = pair[0], label = pair[1];
      var on = cur === val;
      var b = el('button', on ? 'on' : '', esc(label));
      b.addEventListener('click', function () {
        C.setTune('village3d.quality', val === '' ? null : val);
        renderAll();
        say('3D 품질 등급 — ' + label + ' (게임 창 새로고침)');
      });
      row.appendChild(b);
    });
  }

  function renderTune() {
    renderQualityRow();
    var row = $('speedrow');
    row.innerHTML = '';
    [1, 2, 4, 8].forEach(function (m) {
      var on = C.tuned('walk.speedMul', 1) === m;
      var b = el('button', on ? 'on' : '', '×' + m);
      b.addEventListener('click', function () {
        C.setTune('walk.speedMul', m === 1 ? null : m);
        renderAll();
        say('걸음 배속 ×' + m);
      });
      row.appendChild(b);
    });

    var host = $('tunefields');
    host.innerHTML = '';
    TUNES.forEach(function (grp) {
      host.appendChild(el('div', null,
        '<div style="margin:10px 0 4px;font-size:11.5px;color:var(--blue)">' +
        esc(grp.name) + '</div>'));
      var g = el('div', 'grid');
      grp.keys.forEach(function (k) {
        var f = el('div', 'fld');
        f.appendChild(el('label', null, k[1]));
        var i = el('input');
        i.type = 'number';
        if (k[3]) { i.step = k[3]; }
        i.placeholder = String(k[2]);
        var v = C.tune()[k[0]];
        i.value = (v === undefined || v === null) ? '' : v;
        i.addEventListener('change', function () {
          C.setTune(k[0], i.value === '' ? null : Number(i.value));
          renderAll();
          say(k[1] + ' — ' + (i.value === '' ? '기본값' : i.value) + ' (게임 창 새로고침)');
        });
        f.appendChild(i);
        f.appendChild(el('span', 'def', '기본 ' + k[2]));
        g.appendChild(f);
      });
      host.appendChild(g);
    });

    var n = C.tuneCount();
    $('tunesum').textContent = n ? ('잡아 둔 손잡이 ' + n + '개') : '전부 기본값';
    var pill = $('tunepill');
    pill.className = 'pill ' + (n ? 'tuned' : 'clean');
    pill.textContent = n ? ('손잡이 ' + n + '개') : '손잡이 없음';
  }

  /* ── 프리셋 ───────────────────────────────────────── */

  function fillMuseum(leaveOut) {
    var s = V.state();
    s.donated = {};
    VD.MUSEUM_CATS.forEach(function (c) {
      var list = VD.ITEMS[c.key];
      list.forEach(function (it, i) {
        if (leaveOut && i === list.length - 1) { return; }
        s.donated[it.key] = true;
      });
    });
  }

  var PRESETS = [
    { t: '🥬 순무 장 아침', n: '일요일로 밀고 금 20만. 장이 선 상태로 엽니다.',
      f: function () {
        var s = V.state();
        C.setTune('time.dayShift', C.tuned('time.dayShift', 0) - TN.dow(s.day));
        s.day = V.today();
        s.turnip = null;
        C.save.player.gold = 200000;
      } },
    { t: '🐝 벌떼 확인', n: '잠자리채·삽을 주고 벌집 확률을 100% 로 올립니다.',
      f: function () {
        V.state().tools.net = true;
        V.state().tools.spade = true;
        C.setTune('shake.bee', 1);
      } },
    { t: '💭 이사 예고', n: '첫 주민이 떠날 뜻을 비치고, 오늘 부탁은 완료로 둡니다 (붙잡기 확인).',
      f: function () {
        var s = V.state(), id = s.residents[0];
        s.leaving[id] = s.day + M.NOTICE_DAYS;
        V.requestOf(id).done = true;
      } },
    { t: '📮 편지 가득', n: '종류별로 여섯 통을 넣습니다 (선물·답장 확인).',
      f: function () {
        var s = V.state(), ids = s.residents;
        s.mail = [];
        M._put({ from: ids[0], kind: 'thanks', title: '감사장', body: '어제 일은 고마웠소.',
                 gift: { type: 'item', key: 'apple', n: 3 } });
        M._put({ from: ids[1], kind: 'notice', title: '떠날 뜻', body: '떠날까 하오.', gift: null });
        M._put({ from: ids[2], kind: 'answer', title: '답장', body: '편지 잘 받았소.',
                 gift: { type: 'furn', key: 'soban', n: 1 } });
        M._put({ from: 'town', kind: 'hha', title: '집 평가서', body: '정갈하오.',
                 gift: { type: 'gold', n: 900 } });
        M._put({ from: 'town', kind: 'wish', title: '흐르는 별이 남긴 것', body: '떨어져 있었소.',
                 gift: { type: 'item', key: 'stardust', n: 2 } });
        M._put({ from: 'town', kind: 'turnip', title: '순무 장', body: '오늘 오전에만 팝니다.', gift: null });
      } },
    { t: '🏛️ 사고 코앞', n: '갈래마다 한 종만 남기고 다 기증한 것으로 둡니다.',
      f: function () { fillMuseum(true); } },
    { t: '🏠 기와집 + 빚', n: '집을 끝까지 넓히고 빚 12만을 얹습니다.',
      f: function () {
        H.state().tier = VD.HOME_TIERS.length - 1;
        H.state().debt = 120000;
      } },
    { t: '🌿 잡초 마을', n: '잡초를 상한까지 채웁니다 (마을 평가 확인).',
      f: function () {
        var s = V.state();
        s.weeds = [];
        for (var i = 0; i < 200 && s.weeds.length < V.WEED_MAX; i++) {
          s.day += 1; V.growWeeds();
        }
        s.day = V.today();
        V.buildProps(); V.syncPlanted();
      } },
    { t: '🎊 한가위 밤', n: '행사·시간대·날씨를 못 박습니다 (큰 달 확인).',
      f: function () {
        C.setTune({ 'time.event': 'chuseok', 'time.phase': 'night', 'time.weather': 'clear' });
      } },
    { t: '🌠 별똥별 밤', n: '밤·맑음으로 두고 소원을 비웁니다.',
      f: function () {
        C.setTune({ 'time.phase': 'night', 'time.weather': 'clear', 'time.event': 'none' });
        V.state().wish = null;
      } },
    { t: '🌧️ 비 오는 낮', n: '비에만 나오는 것(달팽이·미꾸라지) 확인.',
      f: function () {
        C.setTune({ 'time.weather': 'rain', 'time.phase': 'day', 'time.event': 'none' });
        V.state().tools.net = true;
      } },
    { t: '💰 부자', n: '금 100만. 사는 것들을 한 번에 확인할 때.',
      f: function () { C.save.player.gold = 1000000; } },
    { t: '🪧 공사 채비', n: '개토패와 금 20만. 길·물길을 바로 깔아 볼 때.',
      f: function () {
        V.state().tools.deed = true;
        C.save.player.gold = Math.max(C.save.player.gold, 200000);
      } },
    { t: '🧵 옷장 전부', n: '침선방의 모든 옷을 옷장에 넣습니다.',
      f: function () {
        VD.WEAR_PARTS.forEach(function (p) {
          p.list.forEach(function (it) { WR.state().owned[p.key + ':' + it.key] = true; });
        });
      } },
    { t: '🪑 가구 · 벽지 전부', n: '창고에 가구를 두 벌씩, 벽지·장판을 전부 엽니다.',
      f: function () {
        VD.FURNITURE.forEach(function (f) { H.state().stock[f.key] = 2; });
        VD.WALLS.forEach(function (w) { H.state().walls[w.key] = true; });
        VD.FLOORS.forEach(function (f) { H.state().floors[f.key] = true; });
      } },
    { t: '🗓️ 새 판처럼', n: '마을 진행을 통째로 비웁니다 (도감·재화는 남습니다).',
      f: function () { C.save.village = null; V.state(); V.init(); } }
  ];

  function renderPresets() {
    var host = $('presets');
    host.innerHTML = '';
    PRESETS.forEach(function (p) {
      var b = el('button', 'preset', '<b>' + esc(p.t) + '</b><small>' + esc(p.n) + '</small>');
      b.addEventListener('click', function () {
        try { p.f(); } catch (e) { say('만들지 못했습니다: ' + e.message); return; }
        commit(p.t + ' — 만들었습니다');
      });
      host.appendChild(b);
    });
  }

  /* ── 스냅샷 ───────────────────────────────────────── */

  function snapKey(n) { return C.SAVE_BASE + '/admin/snap' + n; }

  function renderSnaps() {
    var host = $('snaps');
    host.innerHTML = '';
    [1, 2, 3].forEach(function (n) {
      var raw = null;
      try { raw = localStorage.getItem(snapKey(n)); } catch (e) { /* 무시 */ }
      var wrap = el('div', 'row');
      wrap.style.marginBottom = '0';
      wrap.appendChild(el('label', null, n + '번 ' + (raw ? '(있음)' : '(비었음)')));

      var take = el('button', '', '📸 뜬다');
      take.addEventListener('click', function () {
        try {
          localStorage.setItem(snapKey(n), JSON.stringify(C.save));
        } catch (e) { say('자리가 모자랍니다'); return; }
        renderSnaps();
        say(n + '번에 떠 두었습니다');
      });
      wrap.appendChild(take);

      var back = el('button', 'danger', '↩️ 되돌린다');
      back.disabled = !raw;
      back.addEventListener('click', function () {
        try {
          var o = JSON.parse(localStorage.getItem(snapKey(n)));
          localStorage.setItem(C.SAVE_KEY, JSON.stringify(o));
          C.load();
          V.init();
        } catch (e) { say('되돌리지 못했습니다'); return; }
        commit(n + '번으로 되돌렸습니다');
      });
      wrap.appendChild(back);

      var del = el('button', '', '🗑️');
      del.disabled = !raw;
      del.addEventListener('click', function () {
        try { localStorage.removeItem(snapKey(n)); } catch (e) { /* 무시 */ }
        renderSnaps();
      });
      wrap.appendChild(del);
      host.appendChild(wrap);
    });
  }

  /* ── 점검 · 백업 ──────────────────────────────────── */

  function renderUsage() {
    var used = 0, k;
    for (k in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, k)) {
        used += (localStorage[k] || '').length;
      }
    }
    $('usage').textContent = '이 기기의 localStorage 사용량 대략 ' + Math.round(used / 1024) + 'KB';
  }

  /**
   * 어드민 자가점검 — **지금 프로필을 건드리지 않는다.**
   * 따로 만든 칸에서 읽고 쓰고, 끝나면 지운다. 손잡이도 그대로 되돌린다.
   */
  function selfTest() {
    var out = [], okAll = true;
    var keepKey = C.SAVE_KEY;
    var keepTune = JSON.stringify(C.tune());
    var TEST_KEY = C.SAVE_BASE + '/_admintest';

    function t(name, fn) {
      var r;
      try { r = fn(); } catch (e) { r = false; out.push('✖ ' + name + ' — 예외: ' + e.message); okAll = false; return; }
      if (r) { out.push('✔ ' + name + (typeof r === 'string' ? ' — ' + r : '')); }
      else { out.push('✖ ' + name); okAll = false; }
    }

    try {
      localStorage.removeItem(TEST_KEY);
      C.setSaveKey(TEST_KEY);
      C.load();
      V.init();

      t('따로 만든 칸으로 옮겨 연다', function () {
        return C.SAVE_KEY === TEST_KEY && TEST_KEY;
      });

      t('세이브를 고치고 저장하면 그대로 읽힌다', function () {
        C.save.player.gold = 123456;
        C.persist();
        C.load();
        return C.save.player.gold === 123456 && '금 123,456';
      });

      t('마을이 서고 주민이 다섯이다', function () {
        var n = V.raw().residents.length;
        return n === 5 && (n + '명');
      });

      t('손잡이를 잡으면 규칙이 그 값으로 읽힌다', function () {
        C.setTune('walk.speedMul', 8);
        var got = V.speedMul();
        C.setTune('walk.speedMul', null);
        return got === 8 && C.tuned('walk.speedMul', 1) === 1 && '×8 → 놓으면 ×1';
      });

      t('때를 못 박으면 계절·날씨가 그것으로 나온다', function () {
        C.setTune({ 'time.season': 'winter', 'time.weather': 'rain' });
        var a = VD.season().key, b = VD.weather().key;
        C.setTune({ 'time.season': null, 'time.weather': null });
        return a === 'winter' && b === 'rain' && '겨울 · 비';
      });

      t('날짜를 밀면 오늘이 그만큼 간다', function () {
        var a = V.today();
        C.setTune('time.dayShift', 3);
        var b = V.today();
        C.setTune('time.dayShift', null);
        return b - a === 3 && (a + ' → ' + b);
      });

      t('하루를 넘기면 편지가 오고 잡초가 는다', function () {
        var s = V.state();
        s.mail = []; s.weeds = [];
        s.day = V.today() - 1;
        V.rollDay();
        return s.weeds.length > 0 && ('잡초 ' + s.weeds.length + '포기 · 편지 ' + s.mail.length + '통');
      });

      t('프리셋이 예외 없이 돈다', function () {
        var bad = [];
        PRESETS.forEach(function (p) {
          try { p.f(); } catch (e) { bad.push(p.t + '(' + e.message + ')'); }
        });
        return bad.length === 0 ? (PRESETS.length + '개') : ('실패: ' + bad.join(', '));
      });

      t('점검이 실제 프로필을 건드리지 않았다', function () {
        return C.SAVE_KEY === TEST_KEY && '점검 칸에서만 돌았다';
      });
    } finally {
      try { localStorage.removeItem(TEST_KEY); } catch (e) { /* 무시 */ }
      C.clearTune();
      try {
        var back = JSON.parse(keepTune);
        if (back && Object.keys(back).length) { C.setTune(back); }
      } catch (e) { /* 무시 */ }
      C.setSaveKey(keepKey);
      C.load();
      try { V.init(); } catch (e) { /* 무시 */ }
      renderAll();
    }

    $('selfout').innerHTML =
      '<b style="color:' + (okAll ? 'var(--good)' : 'var(--bad)') + '">' +
      (okAll ? '모두 통과' : '실패가 있습니다') + ' — ' + out.length + '항목</b><br>' +
      out.join('<br>');
    say(okAll ? '자가점검 통과' : '자가점검 실패');
  }

  /* ── 탭 ───────────────────────────────────────────── */

  function showTab(name) {
    var bs = document.querySelectorAll('nav button');
    var i;
    for (i = 0; i < bs.length; i++) {
      bs[i].classList.toggle('sel', bs[i].getAttribute('data-tab') === name);
    }
    var ss = document.querySelectorAll('main section');
    for (i = 0; i < ss.length; i++) {
      ss[i].classList.toggle('show', ss[i].id === 'tab-' + name);
    }
    try { location.hash = name; } catch (e) { /* 무시 */ }
  }

  /* ── 오류 (SAGA-DESIGN §8-2) ──────────────────────── */

  function renderErr() {
    var E = global.DG && global.DG.errlog;
    var list = E ? E.list() : [];
    $('err-max').textContent = E ? E.MAX : 50;
    if (!list.length) { $('err-out').value = ''; return; }
    $('err-out').value = list.slice().reverse().map(function (e) {
      var when = e.t ? new Date(e.t).toLocaleString() : '?';
      var head = '[' + when + '] ' + (e.kind || 'error') + ' — ' + (e.msg || '');
      var where = e.src ? ('\n  ' + e.src + ':' + (e.line || 0) + ':' + (e.col || 0)) : '';
      var stack = e.stack ? ('\n' + e.stack) : '';
      return head + where + stack;
    }).join('\n\n');
  }

  /* ── 다시 그리기 ──────────────────────────────────── */

  function renderAll() {
    try {
      renderSummary();
      renderBasics();
      renderTools();
      renderBag();
      renderTown();
      renderFolks();
      renderHome();
      renderTime();
      renderPresets();
      renderTune();
      renderSnaps();
      renderUsage();
      renderErr();
    } catch (e) {
      say('그리는 중에 걸렸습니다: ' + e.message);
    }
  }

  /* ── 배선 ─────────────────────────────────────────── */

  function bind() {
    $('prof').addEventListener('change', function () { openProfile(this.value); });
    $('save').addEventListener('click', function () { commit(); });
    $('reload').addEventListener('click', function () { openProfile($('prof').value); });

    document.querySelector('nav').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]');
      if (b) { showTab(b.getAttribute('data-tab')); }
    });

    document.body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-clear]');
      if (!b) { return; }
      var k = b.getAttribute('data-clear');
      if (k === 'village' && !confirm('마을 진행을 통째로 비웁니다. 계속할까요?')) { return; }
      CLEARS[k](V.state());
      commit('비웠습니다');
    });

    $('townapply').addEventListener('click', function () {
      var r = T.setName($('townname').value);
      commit(r.text);
    });

    $('soldgold').addEventListener('change', function () {
      V.state().soldGold = Number(this.value) || 0;
      commit('전방 누계를 바꿨습니다');
    });
    $('shop-next').addEventListener('click', function () {
      var lv = V.shopLevel();
      if (!lv.next) { say('이미 가장 큰 전방입니다'); return; }
      V.state().soldGold = lv.next.at;
      commit(lv.next.name + ' 이 되었습니다');
    });

    $('weed-apply').addEventListener('click', function () {
      var want = Math.max(0, Math.min(V.WEED_MAX, Number($('weedn').value) || 0));
      var s = V.state();
      s.weeds = [];
      var keep = s.day;
      for (var i = 0; i < 400 && s.weeds.length < want; i++) { s.day += 1; V.growWeeds(); }
      s.weeds = s.weeds.slice(0, want);
      s.day = keep;
      V.buildProps(); V.syncPlanted();
      commit('잡초 ' + s.weeds.length + '포기');
    });

    $('folk-shuffle').addEventListener('click', function () {
      var s = V.state();
      s.residents = []; s.moveIn = {}; s.friend = {}; s.requests = {}; s.leaving = {};
      V.init();
      commit('주민을 새로 뽑았습니다');
    });
    $('folk-love').addEventListener('click', function () {
      var s = V.state();
      s.residents.forEach(function (id) { s.friend[id] = 5; });
      commit('모두 친밀도 5');
    });
    $('folk-done').addEventListener('click', function () {
      var s = V.state();
      s.residents.forEach(function (id) { V.requestOf(id).done = true; });
      commit('오늘 부탁을 모두 완료로 두었습니다');
    });

    $('home-apply').addEventListener('click', function () {
      H.state().tier = Number($('home-tier').value) || 0;
      H.state().debt = Number($('home-debt').value) || 0;
      commit('집을 바꿨습니다');
    });
    $('home-furn').addEventListener('click', function () {
      VD.FURNITURE.forEach(function (f) { H.state().stock[f.key] = 2; });
      commit('창고를 채웠습니다');
    });
    $('home-finish').addEventListener('click', function () {
      VD.WALLS.forEach(function (w) { H.state().walls[w.key] = true; });
      VD.FLOORS.forEach(function (f) { H.state().floors[f.key] = true; });
      commit('벽지·장판을 전부 열었습니다');
    });
    $('home-clear').addEventListener('click', function () {
      H.state().items = [];
      commit('놓은 가구를 치웠습니다');
    });

    $('mu-all').addEventListener('click', function () { fillMuseum(false); commit('사고를 채웠습니다'); });
    $('mu-near').addEventListener('click', function () { fillMuseum(true); commit('한 종만 남겼습니다'); });
    $('mu-none').addEventListener('click', function () {
      V.state().donated = {};
      commit('사고를 비웠습니다');
    });
    $('mu-dex').addEventListener('click', function () {
      var s = V.state();
      VD.MUSEUM_CATS.forEach(function (c) {
        VD.ITEMS[c.key].forEach(function (it) { s.caught[it.key] = s.caught[it.key] || 1; });
      });
      commit('도감을 채웠습니다');
    });

    $('wear-all').addEventListener('click', function () {
      VD.WEAR_PARTS.forEach(function (p) {
        p.list.forEach(function (it) { WR.state().owned[p.key + ':' + it.key] = true; });
      });
      commit('옷장을 전부 열었습니다');
    });
    $('wear-reset').addEventListener('click', function () {
      V.state().wear = null;
      commit('차림을 되돌렸습니다');
    });

    $('time-clear').addEventListener('click', function () {
      C.setTune({ 'time.season': null, 'time.phase': null,
                  'time.weather': null, 'time.event': null });
      renderAll();
      say('때를 놓았습니다 — 실제 시계로 돕니다');
    });
    $('dayshift').addEventListener('change', function () {
      C.setTune('time.dayShift', Number(this.value) || null);
      renderAll();
    });
    $('day1').addEventListener('click', function () { shiftDay(1); });
    $('day7').addEventListener('click', function () { shiftDay(7); });
    $('day0').addEventListener('click', function () {
      C.setTune('time.dayShift', null);
      renderAll();
      say('날짜를 되돌렸습니다');
    });
    $('daysun').addEventListener('click', function () {
      var d = TN.dow(V.state().day);
      shiftDay(d === 0 ? 7 : (7 - d));
    });
    $('rollnow').addEventListener('click', function () {
      C.setTune('time.dayShift', C.tuned('time.dayShift', 0) + 1);
      var rolled = V.rollDay();
      commit(rolled ? '🌅 하루를 넘겼습니다 — 편지·이사·잡초까지' : '날이 바뀌지 않았습니다');
    });

    $('tune-clear').addEventListener('click', function () {
      C.clearTune();
      renderAll();
      say('손잡이를 전부 놓았습니다');
    });

    $('dump').addEventListener('click', function () {
      $('json').value = JSON.stringify(C.save, null, 1);
      say('꺼냈습니다');
    });
    $('load').addEventListener('click', function () {
      var o;
      try { o = JSON.parse($('json').value); } catch (e) { say('조각을 읽지 못했습니다'); return; }
      if (!o || typeof o !== 'object') { say('조각이 이상합니다'); return; }
      if (!confirm('지금 프로필을 이 조각으로 덮습니다. 계속할까요?')) { return; }
      try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(o)); } catch (e) { say('저장하지 못했습니다'); return; }
      C.load();
      V.init();
      commit('덮었습니다');
    });

    $('selftest').addEventListener('click', selfTest);

    $('err-refresh').addEventListener('click', renderErr);
    $('err-copy').addEventListener('click', function () {
      $('err-out').select();
      try { document.execCommand('copy'); say('복사했습니다'); } catch (e) { say('직접 복사해 주세요'); }
    });
    $('err-clear').addEventListener('click', function () {
      var E = global.DG && global.DG.errlog;
      if (E) { E.clear(); }
      renderErr();
      say('비웠습니다');
    });

    /* 게임 창에서 진행이 바뀌면 여기도 따라 읽는다 */
    global.addEventListener('storage', function (e) {
      if (e.key === C.SAVE_KEY) {
        C.load();
        renderAll();
      }
    });
  }

  /* ── 시작 ─────────────────────────────────────────── */

  bind();
  fillProfiles();
  var want = (location.hash || '').replace('#', '');
  /* `#tools!` 로 열면 자가점검을 바로 돌린다 — 헤드리스로 확인할 수 있게 둔 자리다
     (사람이 쓸 때는 점검 탭의 단추를 누르면 된다) */
  if (want.slice(-1) === '!') {
    want = want.slice(0, -1);
    showTab(want || 'tools');
    selfTest();
  } else {
    showTab(want || 'save');
  }
})(window);
