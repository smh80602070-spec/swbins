/**
 * 1만리 근처 대상 패널 — 야생 인물·펫·역참·봉수대·사당·숨은 터·보상 꽃 카드(ui.js 에서 떼어 냄, R-4 줄 수 상한).
 * ---------------------------------------------------------------
 * ui.js 가 `setup({ esc, pt, els, data, SHRINE_NEAR, DOMAIN_NEAR })` 로 손잡이를 넘기고 같은 이름(renderNear·isPhonePortrait)으로 부른다.
 * 다시 그린 열쇠 nearUid·폰 세로 펼침 nearAll 은 여기 하나 — 「+N 더」 단추는 toggleAll().
 */
(function (global) {
  'use strict';

  var esc, pt, els, data, SHRINE_NEAR, DOMAIN_NEAR;
  var api = null;
  function setup(h) {
    esc = h.esc; pt = h.pt; els = h.els; data = h.data; SHRINE_NEAR = h.SHRINE_NEAR; DOMAIN_NEAR = h.DOMAIN_NEAR;
    return api;
  }

  var nearUid = null, nearAll = false;
  /** 폰 세로 폭 — CSS 의 `@media (max-width: 600px)` 와 같은 선 */
  function isPhonePortrait() {
    return !!(global.matchMedia && global.matchMedia('(max-width: 600px)').matches);
  }

  /**
   * "가까이 가기" 표시 — 대상이 사거리 밖일 때 뜬다. **시뮬레이션 이동
   * (`mode === 'keyboard'`)에서는 눌러서 그쪽으로 걸어갈 수 있다** — 지도를
   * 탭해 걷는 것과 같은 길(`world.walkTo`)을 그대로 쓴다. GPS 모드는 실제로
   * 걸어야 움직이는 판이라 손대지 않는다(그대로 안내 문구로만 남는다).
   */
  function approachBtn(x, y) {
    var w = global.DG.world;
    if (w && w.mode === 'keyboard') {
      return '<button class="btn ghost" data-act="approach" data-tx="' + x + '" data-ty="' + y + '">가까이 가기</button>';
    }
    return '<button class="btn ghost" disabled>가까이 가기</button>';
  }

  /** 야생 대상 카드 (등용 · 포획) */
  function nearSpawnCard(n) {
    var s = n.spawn, rar = data.rarity[s.ref.rarity];
    return '<div class="near-card">' +
        '<div class="near-ico" style="border-color:' + rar.color + '">' +
          pt(s.kind === 'hero' ? 'hero' : 'pet', s.ref, 46) + '</div>' +
        '<div class="near-meta"><b>' + esc(s.ref.name) + '</b>' +
          '<small style="color:' + rar.color + '">' + rar.name + ' ' + rar.label + ' · ' +
          (s.kind === 'hero' ? '등용 대상' : '포획 대상') + ' · ' + Math.round(n.dist) + 'm</small></div>' +
        (n.inRange
          ? '<button class="btn primary" data-act="meet">만난다 <b class="ra-k">F</b></button>'
          : approachBtn(s.x, s.y)) +
      '</div>';
  }

  /** 역참 카드 — 원작에서 보급 거점이 늘 근처에 하나쯤 있는 그 자리 */
  function nearStationCard(ns) {
    var st = ns.station, stn = global.DG.station;
    /* 적도가 들어 있으면 보급 카드가 아니라 **경고 카드**다 — 여기서 갈라 두지 않으면
       "보급 있음" 이라 적힌 자리를 눌렀는데 싸움이 열린다(rogue.js) */
    var R = global.DG.rogue;
    var held = R ? R.rankAt(st) : null;
    if (held) {
      return '<div class="near-card">' +
          '<div class="near-ico" style="border-color:#c0463c">🏴</div>' +
          '<div class="near-meta"><b>' + esc(st.name) + '</b>' +
            '<small style="color:#e0837a">적도 ' + held.name + ' 점거 · ' +
            Math.round(ns.dist) + 'm</small></div>' +
          (ns.inRange
            ? '<button class="btn primary" data-act="visit">맞선다 <b class="ra-k">F</b></button>'
            : approachBtn(st.x, st.y)) +
        '</div>';
    }
    var stt = stn.stateOf(st.key);
    var btn = !stt.ready
      ? '<button class="btn ghost" disabled>' + stn.leftLabel(stt.left) + '</button>'
      : (ns.inRange
          ? '<button class="btn primary" data-act="visit">들른다 <b class="ra-k">F</b></button>'
          : approachBtn(st.x, st.y));
    return '<div class="near-card"' + (stt.ready ? '' : ' style="opacity:.62"') + '>' +
        '<div class="near-ico" style="border-color:' + (stt.ready ? '#e8c15a' : 'rgba(150,155,165,.5)') + '">🏮</div>' +
        '<div class="near-meta"><b>' + esc(st.name) + '</b>' +
          '<small style="color:' + (stt.ready ? '#e8c15a' : 'inherit') + '">역참 · ' +
          (stt.ready ? '보급 있음' : '쉬는 중') + ' · ' + Math.round(ns.dist) + 'm</small></div>' +
        btn +
      '</div>';
  }

  /** 봉수대 카드(PLAN §5 ①) — 이미 올린 것은 안 뜬다(더 할 게 없다) */
  function nearBeaconCard(nb) {
    var b = nb.beacon;
    return '<div class="near-card">' +
        '<div class="near-ico" style="border-color:#ff9d3d">🗼</div>' +
        '<div class="near-meta"><b>' + esc(b.name) + ' 봉수대</b>' +
          '<small style="color:#ff9d3d">' + b.region.name + ' 권역 · ' + Math.round(nb.dist) + 'm</small></div>' +
        (nb.inRange
          ? '<button class="btn primary" data-act="beacon">불을 올린다</button>'
          : approachBtn(global.DG.beacon.worldPos(b).x, global.DG.beacon.worldPos(b).y)) +
      '</div>';
  }

  /** 사당 카드(PLAN §5 ②) — 보이는 자리만 뜬다(120m 안·봉수대로 열린 반경·깬 자리) */
  function nearShrineCard(nsh) {
    var s = nsh.shrine, SH = global.DG.shrine, en = SH.entry(s);
    var tag = nsh.state.clears > 0 ? ' · ' + nsh.state.clears + '승' : '';
    var note = en.reason === 'lock' ? ' · 닫힘' : (en.reason === 'daily' ? ' · 오늘은 끝' : '');
    return '<div class="near-card">' +
        '<div class="near-ico" style="border-color:#f0d878">⛩️</div>' +
        '<div class="near-meta"><b>' + esc(s.name) + '</b>' +
          '<small style="color:#f0d878">' + s.region.name + ' 권역 · ' + Math.round(nsh.dist) + 'm' + tag + note + '</small></div>' +
        (nsh.inRange
          ? '<button class="btn primary" data-act="shrine">시련을 받는다</button>'
          : approachBtn(SH.worldPos(s).x, SH.worldPos(s).y)) +
      '</div>';
  }

  /** ⑲-9 숨은 터 입구 — 도전 중이면 안 올린다(위쪽 띠가 대신한다) */
  function nearDomainCard(nd) {
    var DM = global.DG.domain, d = nd.d, kd = DM.KINDS[d.kind];
    return '<div class="near-card">' +
        '<div class="near-ico" style="border-color:' + kd.color + '">' + kd.icon + '</div>' +
        '<div class="near-meta"><b>' + esc(d.name) + '</b>' +
          '<small style="color:' + kd.color + '">' + kd.loot + ' · ' + Math.round(nd.dist) + 'm · 🌙 ' + DM.resin() + '/' + DM.RESIN_MAX + '</small></div>' +
        (nd.inRange
          ? '<button class="btn primary" data-act="domain">숨은 터</button>'
          : approachBtn(d.x, d.y)) +
      '</div>';
  }
  /** ⑲-10 보상 꽃 — 쓰러진 수호자 자리 */
  function nearBloomCard(nb) {
    var FB = global.DG.fieldBoss, b = nb.b, M = FB.MATS[b.mat || b.biome], DM = global.DG.domain;
    return '<div class="near-card">' +
        '<div class="near-ico" style="border-color:#ffb6e1">🌸</div>' +
        '<div class="near-meta"><b>' + esc(b.name) + ' 보상 꽃</b>' +
          '<small style="color:#ffb6e1">' + (M ? M.icon + ' ' + M.name + ' · ' : '') + Math.round(nb.dist) + 'm' + (DM ? ' · 🌙 ' + DM.resin() + '/' + FB.COST : '') + '</small></div>' +
        (nb.inRange
          ? '<button class="btn primary" data-act="bloom">받는다</button>'
          : approachBtn(b.x, b.y)) +
      '</div>';
  }


  function renderNear() {
    var w = global.DG.world;
    var n = w.nearest();
    var ns = w.nearestStation();
    var BC = global.DG.beacon;
    var nb = BC ? BC.nearestUnlit() : null;
    var SHR = global.DG.shrine, nsh = SHR ? SHR.nearest(SHRINE_NEAR) : null;
    var DMN = global.DG.domain, ndm = DMN && !DMN.active() ? DMN.nearest(DOMAIN_NEAR) : null;
    var FBN = global.DG.fieldBoss, nfb = FBN ? FBN.nearest(DOMAIN_NEAR) : null;
    if (!n && !ns && !nb && !nsh && !ndm && !nfb) {
      els.near.classList.remove('show');
      nearUid = null;
      return;
    }
    /* 다시 그리는 값이 실제로 바뀌었을 때만 innerHTML 을 갈아 끼운다
       (매 프레임 갈아 끼우면 버튼을 누르는 순간 노드가 사라진다) */
    var stn = global.DG.station;
    var key = (n ? n.spawn.uid + '|' + n.inRange + '|' + Math.round(n.dist / 5) : '-') + '||' +
      (ns ? ns.station.key + '|' + ns.inRange + '|' + Math.round(ns.dist / 5) + '|' +
        Math.ceil(stn.stateOf(ns.station.key).left / 1000) + '|' +
        (global.DG.rogue && global.DG.rogue.occupied(ns.station) ? 'R' : '-') : '-') + '||' +
      (nb ? nb.beacon.key + '|' + (nb.dist <= BC.HIT_RADIUS) + '|' + Math.round(nb.dist / 5) : '-') + '||' +
      (nsh ? nsh.shrine.key + '|' + nsh.inRange + '|' + Math.round(nsh.dist / 5) + '|' + nsh.state.clears + '|' +
        SHR.entry(nsh.shrine).reason : '-') + '||' +
      (ndm ? ndm.d.id + '|' + ndm.inRange + '|' + Math.round(ndm.dist / 5) + '|' + DMN.resin() : '-') + '||' +
      (nfb ? nfb.b.rk + '|' + nfb.inRange + '|' + Math.round(nfb.dist / 5) : '-');
    var phone = isPhonePortrait();
    key += '||' + (phone ? (nearAll ? 'P+' : 'P') : 'W');
    if (key !== nearUid) {
      nearUid = key;
      var cards = [];
      if (n) { cards.push({ d: n.dist, r: n.inRange, h: nearSpawnCard(n) }); }
      if (ns) { cards.push({ d: ns.dist, r: ns.inRange, h: nearStationCard(ns) }); }
      if (nb) { cards.push({ d: nb.dist, r: nb.dist <= BC.HIT_RADIUS, h: nearBeaconCard({ beacon: nb.beacon, dist: nb.dist, inRange: nb.dist <= BC.HIT_RADIUS }) }); }
      if (nsh) { cards.push({ d: nsh.dist, r: nsh.inRange, h: nearShrineCard(nsh) }); }
      if (ndm) { cards.push({ d: ndm.dist, r: ndm.inRange, h: nearDomainCard(ndm) }); }
      if (nfb) { cards.push({ d: nfb.dist, r: nfb.inRange, h: nearBloomCard(nfb) }); }
      /* 폰 세로 — 카드가 석 장까지 쌓이면 화면 아래 ¼ 을 덮고 조이스틱과 겹쳤다(2026-09-27 실기 신고
         "세로 화면에 뜨는 게 너무 많아 게임 화면이 안 보인다"). 닿는 것 먼저·가까운 것 먼저 한 장만,
         나머지는 "+N" 칩으로 펼친다 */
      var more = '';
      if (phone && cards.length > 1) {
        cards.sort(function (a, b) { return (b.r ? 1 : 0) - (a.r ? 1 : 0) || a.d - b.d; });
        more = '<button class="near-more" data-act="near-more">' + (nearAll ? '접기 ▾' : '+' + (cards.length - 1) + ' 더 ▴') + '</button>';
        if (!nearAll) { cards = cards.slice(0, 1); }
      }
      els.near.innerHTML = more + cards.map(function (c) { return c.h; }).join('');
    }
    els.near.classList.add('show');
  }


  function toggleAll() { nearAll = !nearAll; nearUid = null; }

  api = { setup: setup, render: renderNear, toggleAll: toggleAll, isPhonePortrait: isPhonePortrait };
  global.DG = global.DG || {};
  global.DG.uiNear = api;
})(typeof window !== 'undefined' ? window : this);
