/**
 * 사가천하 — 격자 전술 화면 (PLAN §5-16, W-0108 리뉴얼 ⑤-3)
 * ---------------------------------------------------------------
 * 개입형 전투의 「♟️ 전술판」 명령이 여는 판. **화면 층만** — 칸·이동·명중·적 AI·결과는 전부 `DG.tactics`(W-0107).
 *
 *   그리기   8열 × 6행 SVG. 폭이 좁으면(폰 세로) 눕혀 6열 × 8행으로 — 내 편이 아래, 적이 위. 칸 ≥ 44px
 *   입력     내 장수 누르기 → 갈 칸 밝힘·닿는 적 위에 명중 % → 빈 칸 누르면 이동, 적 누르면 공격
 *   차례     「턴 끝」 → 적 턴(AI) → 다음 턴. 3턴이 끝나거나 한쪽이 전멸하면 결과
 *   물러나기 판을 그 자리에서 무승부로 닫는다(보정 0). 이미 쓰러진 장수는 그대로 쓰러진 것이다
 *   결과     전술 결과 한 줄 + 보정값 → 「▶ 전황으로」 가 done(outcome) 을 부른다(보정 적용은 war.js 몫)
 *
 * open(host, opts, done) — opts = { seed, land(땅 키|성 id), siege, mine[], foes[], foeTroops[], where,
 *                                   name(id)→이름, face(id)→초상 주소 }
 */
(function (global) {
  'use strict';

  var CELL = 50;
  var COL = { plain: '#c8b47a', forest: '#5f8446', river: '#4f86b3', wall: '#857563' };
  var NAME = { plain: '평지', forest: '숲', river: '강', wall: '성벽' };
  var cur = null;

  function T() { return global.DG.tactics; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /** 판 좌표 → 화면 칸. 눕힌 판(vert)은 내 편(왼쪽)이 아래로 온다 */
  function scr(v, x, y) { return v.vert ? { c: y, r: v.b.cols - 1 - x } : { c: x, r: y }; }
  function brd(v, c, r) { return v.vert ? { x: v.b.cols - 1 - r, y: c } : { x: c, y: r }; }

  function offName(id) { var h = global.DG.off && global.DG.off.find(id); return h ? h.name : id; }
  function nameOf(v, u) { return u.kind === 'troop' ? '부대' : (v.opts.name || offName)(u.id); }

  /** 지금 고른 장수가 할 수 있는 것 — 갈 칸·칠 수 있는 적(명중 %) */
  function reach(v) {
    var b = v.b, u = v.sel ? T().unit(b, v.sel) : null, out = { moves: [], hits: {} };
    if (!u || u.hp <= 0 || b.done) { return out; }
    if (!u.moved) { out.moves = T().moves(b, u.uid); }
    if (!u.acted) {
      T().alive(b, 'foe').forEach(function (t) {
        if (Math.abs(u.x - t.x) + Math.abs(u.y - t.y) <= u.rng) { out.hits[t.uid] = T().hitChance(u, t, T().coverAt(b, t.x, t.y)); }
      });
    }
    return out;
  }

  function unitSvg(v, u, hit) {
    var p = scr(v, u.x, u.y), cx = p.c * CELL + CELL / 2, cy = p.r * CELL + CELL / 2, rr = CELL * 0.38;
    var me = u.side === 'me', ring = me ? '#3d8bd9' : '#d24b3c', s = '';
    var spent = me && u.moved && u.acted;
    s += '<g class="tv-unit' + (spent ? ' spent' : '') + (v.sel === u.uid ? ' sel' : '') + '" data-uid="' + u.uid + '">';
    var face = u.kind === 'officer' && v.opts.face ? v.opts.face(u.id) : '';
    if (face) {
      s += '<clipPath id="tvc-' + esc(u.uid.replace(/[^a-z0-9]/gi, '_')) + '"><circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '"/></clipPath>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="#222"/>' +
        '<image href="' + esc(face) + '" x="' + (cx - rr) + '" y="' + (cy - rr) + '" width="' + (rr * 2) + '" height="' + (rr * 2) +
        '" clip-path="url(#tvc-' + esc(u.uid.replace(/[^a-z0-9]/gi, '_')) + ')" preserveAspectRatio="xMidYMid slice"/>';
    } else {
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="' + (me ? '#26445f' : '#5a2a24') + '"/>' +
        '<text x="' + cx + '" y="' + (cy + 6) + '" text-anchor="middle" font-size="18">' + (u.kind === 'troop' ? '🪖' : (u.rng > 1 ? '🏹' : '⚔️')) + '</text>';
    }
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="none" stroke="' + ring + '" stroke-width="' + (v.sel === u.uid ? 4 : 2.5) + '"/>';
    /* hp 띠 */
    var w = CELL * 0.8, fx = cx - w / 2, fy = p.r * CELL + CELL - 7, f = Math.max(0, u.hp / u.max);
    s += '<rect x="' + fx + '" y="' + fy + '" width="' + w + '" height="5" rx="2" fill="#0009"/>' +
      '<rect x="' + fx + '" y="' + fy + '" width="' + (w * f) + '" height="5" rx="2" fill="' + (f > 0.5 ? '#5bd16a' : (f > 0.25 ? '#e3c33f' : '#e2553f')) + '"/>';
    if (hit != null) {
      s += '<rect x="' + (cx - 19) + '" y="' + (p.r * CELL + 1) + '" width="38" height="15" rx="4" fill="#000c"/>' +
        '<text class="tv-hit" x="' + cx + '" y="' + (p.r * CELL + 13) + '" text-anchor="middle" font-size="12" fill="#ffd75e">' + hit + '%</text>';
    }
    return s + '</g>';
  }

  function boardSvg(v) {
    var b = v.b, W = (v.vert ? b.rows : b.cols) * CELL, H = (v.vert ? b.cols : b.rows) * CELL, s = '', x, y;
    var rc = reach(v), mv = {};
    rc.moves.forEach(function (m) { mv[m.x + ',' + m.y] = 1; });
    for (y = 0; y < b.rows; y++) {
      for (x = 0; x < b.cols; x++) {
        var t = T().cellAt(b, x, y), p = scr(v, x, y);
        s += '<rect class="tv-cell" data-x="' + x + '" data-y="' + y + '" x="' + (p.c * CELL) + '" y="' + (p.r * CELL) + '" width="' + CELL + '" height="' + CELL +
          '" fill="' + COL[t] + '" stroke="#0004"/>';
        if (t === 'forest') { s += '<text x="' + (p.c * CELL + 8) + '" y="' + (p.r * CELL + 16) + '" font-size="11" opacity="0.7" pointer-events="none">🌲</text>'; }
        else if (t === 'wall') { s += '<text x="' + (p.c * CELL + 6) + '" y="' + (p.r * CELL + 16) + '" font-size="11" opacity="0.7" pointer-events="none">🧱</text>'; }
        if (mv[x + ',' + y]) {
          s += '<rect x="' + (p.c * CELL + 3) + '" y="' + (p.r * CELL + 3) + '" width="' + (CELL - 6) + '" height="' + (CELL - 6) +
            '" rx="5" fill="#7fd0ff44" stroke="#7fd0ff" stroke-width="2" pointer-events="none"/>';
        }
      }
    }
    b.units.forEach(function (u) { if (u.hp > 0) { s += unitSvg(v, u, rc.hits[u.uid]); } });
    return '<svg class="tv-svg" viewBox="0 0 ' + W + ' ' + H + '" style="width:min(100%,' + (W * 1.2) + 'px);aspect-ratio:' + W + '/' + H + '">' + s + '</svg>';
  }

  function logLines(v) {
    var b = v.b, last = b.log.slice(-4), out = [];
    last.forEach(function (e) {
      var a = T().unit(b, e.a), t = T().unit(b, e.to);
      if (!a || !t) { return; }
      out.push((a.side === 'me' ? '🔵 ' : '🔴 ') + esc(nameOf(v, a)) + ' → ' + esc(nameOf(v, t)) + ' · ' +
        (e.hit ? '명중 −' + e.dmg : '빗나감') + ' <span class="muted">(' + e.ch + '%)</span>' + (t.hp <= 0 && e.hit ? ' 💀' : ''));
    });
    return out.join('<br>');
  }

  function selInfo(v) {
    var u = v.sel ? T().unit(v.b, v.sel) : null;
    if (!u) { return '내 장수를 누르십시오 — 이동 한 번·공격 한 번씩. 숲은 피격 −30%p, 성벽은 −50%p.'; }
    return '<b>' + esc(nameOf(v, u)) + '</b> 체력 ' + u.hp + '/' + u.max + ' · 공 ' + Math.round(u.atk) + ' · 사거리 ' + u.rng +
      ' · ' + NAME[T().cellAt(v.b, u.x, u.y)] + (u.moved ? ' · 이동함' : '') + (u.acted ? ' · 공격함' : '');
  }

  function resultHtml(v) {
    var o = v.out, A = T().apply(o, { where: v.opts.where });
    var line = o.kind === 'rout' ? '🏆 적을 모두 꺾었다' : o.kind === 'win' ? '✅ 판을 쥐었다' : o.kind === 'lose' ? '💀 우리 장수가 모두 쓰러졌다' : '➖ 승부가 나지 않았다';
    var mod = '공 위력 ' + (A.winPct >= 0 ? '+' : '') + A.winPct + '%' + (A.lossMul !== 1 ? ' · 받는 피해 ×' + A.lossMul : '');
    /* 군주는 판이 끝나지 않게 중상으로 돌린다(tactics.marchApply) — 카드 글도 그렇게 */
    var lord = global.DG.off && global.DG.rtk ? global.DG.off.lordOf(global.DG.rtk.me()) : '', nm = v.opts.name || offName;
    var dead = o.fallen.filter(function (id) { return id !== lord; }), hurt = o.wounded.concat(o.fallen.filter(function (id) { return id === lord; }));
    return '<div class="tv-res ' + (A.winPct > 0 ? 'good' : (A.winPct < 0 ? 'bad' : '')) + '"><b>♟️ 전술 ' + esc(o.name) + '</b> — ' + line +
      '<br><small>남은 체력 아군 ' + o.hpMe + '% · 적 ' + o.hpFoe + '% → 남은 합에 ' + mod + '</small>' +
      (dead.length ? '<br><small>⚰️ 전사 ' + dead.map(function (id) { return esc(nm(id)); }).join(', ') + '</small>' : '') +
      (hurt.length ? '<br><small>🩹 중상 ' + hurt.map(function (id) { return esc(nm(id)); }).join(', ') + '</small>' : '') + '</div>' +
      '<button class="btn primary wide" data-tv="go">▶ 전황으로</button>';
  }

  function render() {
    var v = cur;
    if (!v || !v.host) { return; }
    var b = v.b, done = !!b.done || !!v.out;
    v.host.innerHTML = '<div class="tv">' +
      '<div class="tv-head"><b>♟️ 전술판</b> <span class="muted">' + Math.min(b.turn, T().TURNS) + ' / ' + T().TURNS + '턴 · ' + esc(NAME[b.land] || '') +
        (b.siege ? ' · 공성' : '') + '</span></div>' +
      '<div class="tv-board">' + boardSvg(v) + '</div>' +
      (done ? resultHtml(v) :
        '<div class="tv-info">' + selInfo(v) + '</div>' +
        '<div class="tv-log">' + logLines(v) + '</div>' +
        '<div class="brow tv-acts"><button class="btn tiny primary" data-tv="end">⏭ 턴 끝</button>' +
        '<button class="btn tiny ghost" data-tv="auto" title="남은 턴을 맡긴다">🎲 맡기기</button>' +
        '<button class="btn tiny ghost" data-tv="quit" title="무승부로 판을 닫는다(보정 0)">↩️ 물러나기</button></div>') +
      '</div>';
  }

  function settle() {
    var v = cur;
    if (!v || v.out || !v.b.done) { return; }
    v.out = T().outcome(v.b);
    v.out.by = killers(v);
    v.sel = null;
  }
  /** 쓰러진 내 장수 id → 마지막으로 벤 쪽 이름(열전의 "누구에게") */
  function killers(v) {
    var b = v.b, by = {};
    b.log.forEach(function (e) {
      var t = T().unit(b, e.to), a = T().unit(b, e.a);
      if (t && a && t.side === 'me' && t.kind === 'officer' && e.hit && t.hp <= 0) { by[t.id] = nameOf(v, a); }
    });
    return by;
  }

  /** 칸·유닛 누르기 */
  function tap(x, y) {
    var v = cur;
    if (!v || v.b.done) { return; }
    var b = v.b, here = null;
    b.units.forEach(function (u) { if (u.hp > 0 && u.x === x && u.y === y) { here = u; } });
    var sel = v.sel ? T().unit(b, v.sel) : null;
    if (here && here.side === 'me') { v.sel = here.uid; render(); return; }
    if (here && here.side === 'foe' && sel) {
      var r = T().attack(b, sel.uid, here.uid);
      if (r.ok) { settle(); }
      render();
      return;
    }
    if (!here && sel && T().move(b, sel.uid, x, y)) { render(); return; }
    v.sel = null;
    render();
  }

  function endTurn() {
    var v = cur;
    if (!v || v.b.done) { return; }
    v.sel = null;
    T().endTurn(v.b);
    settle();
    render();
  }
  /** 남은 판을 양쪽 AI 로 끝까지(진단·「맡기기」) */
  function auto() {
    var v = cur;
    if (!v) { return null; }
    if (!v.b.done) { T().autoPlay(v.b); }
    settle();
    render();
    return v.out;
  }
  function quit() {
    var v = cur;
    if (!v) { return null; }
    if (!v.b.done) { v.b.done = 'draw'; }
    settle();
    render();
    return v.out;
  }
  function go() {
    var v = cur;
    if (!v || !v.out) { return; }
    cur = null;
    if (v.host) { v.host.innerHTML = ''; v.host.classList.remove('show'); }
    if (v.done) { v.done(v.out); }
  }

  function onClick(e) {
    var t = e.target, btn = t.closest ? t.closest('[data-tv]') : null;
    if (btn) {
      var k = btn.getAttribute('data-tv');
      if (k === 'end') { endTurn(); } else if (k === 'auto') { auto(); } else if (k === 'quit') { quit(); } else if (k === 'go') { go(); }
      return;
    }
    var g = t.closest ? t.closest('[data-uid]') : null;
    if (g && cur) { var u = T().unit(cur.b, g.getAttribute('data-uid')); if (u) { tap(u.x, u.y); } return; }
    if (t.getAttribute && t.getAttribute('data-x') != null) { tap(+t.getAttribute('data-x'), +t.getAttribute('data-y')); }
  }

  /**
   * 판을 연다 — host 는 그릴 자리(그 안을 갈아 끼운다). done(outcome) 은 「▶ 전황으로」 때 한 번
   */
  function open(host, opts, done) {
    var b = T().makeBoard(opts.seed, opts.land, opts.siege);
    T().unitsOf(b, opts.mine, opts.foes, opts.foeTroops);
    var wide = host && host.clientWidth ? host.clientWidth : 0;
    cur = { host: host, opts: opts, done: done, b: b, sel: null, out: null,
      vert: wide > 0 && wide < b.cols * 46 };
    if (host) {
      host.classList.add('show');
      if (!host.__tvBound) { host.addEventListener('click', onClick); host.__tvBound = true; }
    }
    render();
    return cur;
  }

  /** 열전(명부 시트 끝) — 전술판에서 쓰러진 우리 장수들. 언제(몇째 달)·어디서·누구에게. pt = 초상 <img> 짓는 ui 함수 */
  function annalsHtml(pt) {
    var R = global.DG.rtk, CD = global.DG.cityData, an = R.state().annals || {}, ids = Object.keys(an);
    if (!ids.length) { return ''; }
    ids.sort(function (a, b) { return (an[b].at || 0) - (an[a].at || 0); });
    var html = '<div class="sec annals"><h4>⚰️ 열전 <span class="muted">' + ids.length + '명</span></h4>';
    ids.forEach(function (id) {
      var h = global.DG.off.find(id), e = an[id], wh = e.where && CD.find(e.where) ? CD.find(e.where).name : (e.where || '');
      html += '<div class="stat-row">' + (h ? pt(h, 28) + ' <b>' + esc(h.name) + '</b>' : esc(id)) +
        '<span class="muted">' + (e.at || 0) + '째 달 · ' + esc(wh) + ' 아래 · ' + esc(e.by || '') + '에게</span></div>';
    });
    return html + '</div>';
  }

  /* ── 열전 사연 카드 — 전술판에서 우리 장수가 쓰러지면 한 장(war.js 가 pending 에 직접 올린다). 효과는 event.h 손잡이뿐 ── */
  var E = global.DG.event;
  if (E && E.addDef) {
    E.addDef({
      id: 'tac_fallen', name: '쓰러진 장수', emoji: '⚰️', tag: '열전', chain: true, annal: true,   // chain — pickNew 순번엔 안 든다 · annal — 사연 표 진단에서 따로(전술판 몫)
      valid: function (c) { return c; },
      text: function (c) {
        var wh = global.DG.cityData && global.DG.cityData.find(c.where) ? global.DG.cityData.find(c.where).name : '';
        return E.h.nm(c.a) + ', ' + wh + ' 아래에서 쓰러지다 — 장수들이 말없이 칼을 거두었다. 남은 이들이 그를 어떻게 보낼지 기다린다.';
      },
      choices: [
        { k: 'atk', label: '원수를 갚자', hint: '출진한 성 훈련 +8', go: function (c) { E.h.adjust(c.city, 'train', 8, 0, 100); return { text: E.h.nm(c.a) + '의 이름을 걸고 군사들이 이를 갈았다' }; } },
        { k: 'def', label: '조용히 장사 지낸다', hint: '출진한 성 민심 +5', go: function (c) { E.h.adjust(c.city, 'sec', 5, 0, 100); return { text: '백성들이 길가에 나와 상여를 배웅했다' }; } },
        { k: 'util', label: '유족을 돌본다', hint: '금 300 · 출진한 성 민심 +3 · 훈련 +3', cost: 300,
          go: function (c) { E.h.adjust(c.city, 'sec', 3, 0, 100); E.h.adjust(c.city, 'train', 3, 0, 100); return { text: '남은 식구에게 녹을 잇게 했다 — 장수들이 그 뜻을 보았다' }; } }
      ]
    });
  }

  global.DG = global.DG || {};
  global.DG.tacticsView = {
    open: open, tap: tap, endTurn: endTurn, auto: auto, quit: quit, go: go, annalsHtml: annalsHtml,
    cur: function () { return cur; }, scr: scr, brd: brd
  };
})(window);
