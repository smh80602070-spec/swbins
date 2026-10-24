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
  var COL = { plain: '#c8b47a', forest: '#5f8446', river: '#4f86b3', wall: '#857563', hill: '#a98f5c', gate: '#6e4b2c' };
  var NAME = { plain: '평지', forest: '숲', river: '강', wall: '성벽', hill: '언덕', gate: '성문', mount: '산' };
  /* ── 그림(W-0134 — 파이어 엠블렘 성흔의 비밀·삼국지 조조전): 지형 타일 격자·유닛 그림·공격 컷. 그림이 없으면 옛 색 칸·원·이모지 ── */
  var TILE = { plain: 'realm_grass', forest: 'forest_grass', river: 'realm_water', wall: 'realm_stone', hill: 'realm_grass', gate: 'realm_stone' };   // W-0401 언덕·성문은 같은 타일 + 덧칠·표식
  var PROP = { forest: ['tree_pine_01', 'tree_broadleaf_01', 'tree_pine_02', 'tree_broadleaf_02'], wall: ['city_wall_segment_01'] };
  function cfg2() { return (global.DG.cfg && global.DG.cfg.mode2d) || {}; }
  function art() { var o = global.DG.core; return !(o && o.tuned && !o.tuned('realm.tacArt', 1)); }
  function tileHref(kind) { return TILE[kind] ? (cfg2().tileBase || 'assets/web2d/tile/') + TILE[kind] + '.webp' : ''; }
  function propHref(id) { var A = global.DG.assets3d; return A && A.spriteUrl ? (A.spriteUrl(id) || '') : ''; }
  function stillHref(pool, view) { var A = global.DG && global.DG.assets3d, u = A && A.sharedUrl ? A.sharedUrl('web2d/moving/') : null; return (cfg2().stillBase || u || 'assets/web2d/moving/') + pool + '/' + view + '.webp'; }   // W-0359 shared 한 벌
  function hashS(str) { var h = 2166136261, i; str = String(str); for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  /** 유닛 몸 그림 — 순수(진단이 본다): 장수는 제 VRoid 시트(있으면) 아니면 장수 몸 둘 중 하나, 부대는 진영 색 보병 */
  function bodyOf(u) {
    var A = global.DG.assets3d, me = u.side === 'me';
    if (u.kind === 'officer' && A && A.state && A.state() === 'ok' && A.has && A.has('hero', u.id) && A.root) { return { sheet: A.root() + 'characters2d/' + u.id + '/idle.webp' }; }
    var pool = u.kind === 'officer' ? (hashS(u.id) % 2 ? 'hero_f' : 'hero_m') : (u.rng > 1 ? 'rts_arc_' : 'rts_inf_') + (me ? 'ally' : 'enemy');
    return { still: pool };
  }
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
        if (Math.abs(u.x - t.x) + Math.abs(u.y - t.y) <= u.rng) { out.hits[t.uid] = T().hitChanceB ? T().hitChanceB(b, u, t) : T().hitChance(u, t, T().coverAt(b, t.x, t.y)); }
      });
    }
    if (v.plot && T().canPlot && T().canPlot(b, u.uid)) {   // W-0401 책략 고르는 중 — 이동·공격 대신 그 대상만
      out.moves = []; out.hits = {}; out.plot = {};
      if (v.plot === 'fire') { T().fireCells(b, u.uid).forEach(function (c) { out.plot[c.x + ',' + c.y] = 1; }); }
      else { T().plotTargets(b, u.uid, v.plot).forEach(function (id) { var t = T().unit(b, id); out.plot[t.x + ',' + t.y] = 1; }); }
    }
    return out;
  }
  /** W-0401 SRPG 표식 — 병종(창·기·궁) 글자·대장 👑·혼란 💫 */
  function srpgMarks(u, p, cx) {
    var s = '', A = T().ARM_NAME || {};
    if (u.arm) { s += '<text x="' + (p.c * CELL + 7) + '" y="' + (p.r * CELL + 13) + '" font-size="11" font-weight="700" fill="' + (u.side === 'me' ? '#9fd4ff' : '#ffb3a6') + '" stroke="#000a" stroke-width="2.5" paint-order="stroke" pointer-events="none">' + (A[u.arm] || '') + '</text>'; }
    if (u.leader) { s += '<text x="' + (p.c * CELL + CELL - 9) + '" y="' + (p.r * CELL + 13) + '" font-size="12" text-anchor="middle" pointer-events="none">👑</text>'; }
    if (u.confused) { s += '<text x="' + cx + '" y="' + (p.r * CELL + 24) + '" font-size="13" text-anchor="middle" pointer-events="none">💫</text>'; }
    return s;
  }

  /** W-0234 관직 별 — 관직 1~5 만큼 칸 위에 금빛 ★(재미표준 G). 읽기만(save.heroes) */
  function rankSvg(u, p, cx) {
    var C0 = global.DG.core, g = u.kind === 'officer' && C0 && C0.save && C0.save.heroes ? C0.save.heroes[u.id] : null, rk = g ? Math.max(0, Math.min(5, g.rank | 0)) : 0;
    return rk ? '<text class="tv-rank" x="' + cx + '" y="' + (p.r * CELL + 10) + '" text-anchor="middle" font-size="9" fill="#e0b84a" stroke="#0008" stroke-width="2" paint-order="stroke">' + new Array(rk + 1).join('★') + '</text>' : '';
  }
  function unitSvg(v, u, hit) {
    var p = scr(v, u.x, u.y), cx = p.c * CELL + CELL / 2, cy = p.r * CELL + CELL / 2, rr = CELL * 0.38;
    var me = u.side === 'me', ring = me ? '#3d8bd9' : '#d24b3c', s = '';
    var spent = me && u.moved && u.acted;
    s += '<g class="tv-unit' + (spent ? ' spent' : '') + (v.sel === u.uid ? ' sel' : '') + '" data-uid="' + u.uid + '">';
    if (art()) { return s + bodySvg(v, u, p, cx, me, ring) + rankSvg(u, p, cx) + hpSvg(u, p, cx) + srpgMarks(u, p, cx) + hitSvg(hit, p, cx) + '</g>'; }   // W-0134 몸 그림 · W-0234 관직 별 · W-0401 병종·대장
    var face = u.kind === 'officer' && v.opts.face ? v.opts.face(u.id) : '';
    if (face) {
      var cid = 'tvc-' + u.uid.replace(/[^a-z0-9]/gi, '_');
      s += '<clipPath id="' + cid + '"><circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '"/></clipPath>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="#222"/>' +
        '<image href="' + esc(face) + '" x="' + (cx - rr) + '" y="' + (cy - rr) + '" width="' + (rr * 2) + '" height="' + (rr * 2) +
        '" clip-path="url(#' + cid + ')" preserveAspectRatio="xMidYMid slice"/>';
    } else {
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="' + (me ? '#26445f' : '#5a2a24') + '"/>' +
        '<text x="' + cx + '" y="' + (cy + 6) + '" text-anchor="middle" font-size="18">' + (u.kind === 'troop' ? '🪖' : (u.rng > 1 ? '🏹' : '⚔️')) + '</text>';
    }
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="none" stroke="' + ring + '" stroke-width="' + (v.sel === u.uid ? 4 : 2.5) + '"/>' + rankSvg(u, p, cx) + srpgMarks(u, p, cx);
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

  /** 몸 그림 — 발밑 진영 원판 + 옆모습(내 편은 오른쪽·적은 왼쪽을 본다, 눕힌 판은 내 편 뒤·적 정면) */
  function bodySvg(v, u, p, cx, me, ring) {
    var B = bodyOf(u), foot = p.r * CELL + CELL - 6, sel = v.sel === u.uid, s = '';
    s += '<ellipse cx="' + cx + '" cy="' + foot + '" rx="' + (CELL * 0.36) + '" ry="' + (CELL * 0.12) + '" fill="' + ring + '" fill-opacity="' + (sel ? 0.75 : 0.45) + '" stroke="' + ring + '" stroke-width="' + (sel ? 3 : 1.5) + '"/>';
    var flip = v.vert ? false : !me, view = v.vert ? (me ? 'back' : 'front') : 'side';
    if (B.still) {
      var sz = CELL * 1.12, x = cx - sz / 2, y = foot - sz * 252 / 256;
      s += '<image class="tv-body" href="' + esc(stillHref(B.still, view)) + '" x="' + x + '" y="' + y + '" width="' + sz + '" height="' + sz + '"' + (flip ? ' transform="translate(' + (2 * cx) + ',0) scale(-1,1)"' : '') + '/>';
    } else {
      var fz = CELL * 1.55, row = view === 'front' ? 0 : view === 'back' ? 2 : 1, fx = cx - fz / 2, fy = foot - fz * 0.89;
      s += '<svg x="' + fx + '" y="' + fy + '" width="' + fz + '" height="' + fz + '" viewBox="0 ' + (row * 128) + ' 128 128"' + (flip ? ' transform="translate(' + (2 * cx) + ',0) scale(-1,1)"' : '') + '>' +
        '<image href="' + esc(B.sheet) + '" width="1024" height="384"/>' +
        '<animate attributeName="viewBox" dur="1.2s" repeatCount="indefinite" calcMode="discrete" values="' + [0, 1, 2, 3, 4, 5, 6, 7].map(function (f) { return (f * 128) + ' ' + (row * 128) + ' 128 128'; }).join(';') + '"/></svg>';
    }
    return s;
  }
  function hpSvg(u, p, cx) {
    var w = CELL * 0.8, fx = cx - w / 2, fy = p.r * CELL + CELL - 5, f = Math.max(0, u.hp / u.max);
    return '<rect x="' + fx + '" y="' + fy + '" width="' + w + '" height="4" rx="2" fill="#0009"/>' +
      '<rect x="' + fx + '" y="' + fy + '" width="' + (w * f) + '" height="4" rx="2" fill="' + (f > 0.5 ? '#5bd16a' : (f > 0.25 ? '#e3c33f' : '#e2553f')) + '"/>';
  }
  /** W-0168 엑스컴식 엄폐 표식 — 반 방패(숲 30)·온 방패(성벽 50). 칸 오른쪽 위 구석, 숫자는 깎이는 명중 %p. 손잡이 realm.coverMark 0 = 없음 */
  function coverOn() { var C = global.DG.core; return !(C && C.tuned && !C.tuned('realm.coverMark', 1)); }
  function coverSvg(cov, p, foe) {
    if (!cov || !coverOn()) { return ''; }
    var x = p.c * CELL + CELL - 13, y = p.r * CELL + 11, col = foe ? '#ff9a7a' : '#9fe3ff', full = cov >= 50;
    var d = 'M' + x + ',' + (y - 8) + ' l7,3 l-1,7 q-6,6 -12,0 l-1,-7 z';
    return '<path d="' + d + '" fill="' + (full ? col : '#0008') + '" stroke="' + col + '" stroke-width="1.6" pointer-events="none"/>' +
      (full ? '' : '<path d="M' + x + ',' + (y - 8) + ' l7,3 l-1,7 q-3,3 -6,3 z" fill="' + col + '" pointer-events="none"/>') +
      '<text x="' + x + '" y="' + (y + 13) + '" text-anchor="middle" font-size="8" fill="' + col + '" pointer-events="none">−' + cov + '</text>';
  }

  function hitSvg(hit, p, cx) {
    if (hit == null) { return ''; }
    return '<rect x="' + (cx - 19) + '" y="' + (p.r * CELL + 1) + '" width="38" height="15" rx="4" fill="#000c"/>' +
      '<text class="tv-hit" x="' + cx + '" y="' + (p.r * CELL + 13) + '" text-anchor="middle" font-size="12" fill="#ffd75e">' + hit + '%</text>';
  }

  /** 지형 무늬(SVG pattern) — 칸 하나에 타일 한 장 */
  function defsSvg() {
    var s = '<defs>';
    Object.keys(TILE).forEach(function (k) {
      s += '<pattern id="tvp-' + k + '" patternUnits="userSpaceOnUse" width="' + CELL + '" height="' + CELL + '"><rect width="' + CELL + '" height="' + CELL + '" fill="' + COL[k] + '"/>' +
        '<image href="' + esc(tileHref(k)) + '" width="' + CELL * 3 + '" height="' + CELL * 3 + '" preserveAspectRatio="xMidYMid slice"/>' + (k === 'plain' ? '<rect width="' + CELL + '" height="' + CELL + '" fill="#b9a56a" fill-opacity="0.42"/>' : '')   // 평지 풀은 마른 들빛으로 눌러(쨍한 풀줄무늬) 숲 칸과 갈리게 + '</pattern>';   // 무늬를 2배로(잔줄 줄이기) · 평지는 모래빛을 얹어 다른 칸과 갈리게
    });
    return s + '</defs>';
  }

  function boardSvg(v) {
    var b = v.b, W = (v.vert ? b.rows : b.cols) * CELL, H = (v.vert ? b.cols : b.rows) * CELL, s = '', x, y;
    var rc = reach(v), mv = {};
    rc.moves.forEach(function (m) { mv[m.x + ',' + m.y] = 1; });
    for (y = 0; y < b.rows; y++) {
      for (x = 0; x < b.cols; x++) {
        var t = T().cellAt(b, x, y), p = scr(v, x, y);
        s += '<rect class="tv-cell" data-x="' + x + '" data-y="' + y + '" x="' + (p.c * CELL) + '" y="' + (p.r * CELL) + '" width="' + CELL + '" height="' + CELL +
          '" fill="' + (art() ? 'url(#tvp-' + t + ')' : COL[t]) + '" stroke="#0003"/>';
        if (art()) {   // W-0134 — 숲은 짙은 그늘 + 나무, 성벽은 돌담 그림(이모지 대신)
          if (t === 'forest') { s += '<rect x="' + (p.c * CELL) + '" y="' + (p.r * CELL) + '" width="' + CELL + '" height="' + CELL + '" fill="#0b2a0e" fill-opacity="0.28" pointer-events="none"/>'; }
          var pl = PROP[t], ph = pl ? propHref(pl[hashS(x + ':' + y) % pl.length]) : '';
          if (ph) { s += '<image href="' + esc(ph) + '" x="' + (p.c * CELL + CELL * 0.08) + '" y="' + (p.r * CELL - CELL * (t === 'forest' ? 0.18 : -0.12)) + '" width="' + (CELL * 0.84) + '" height="' + (CELL * (t === 'forest' ? 1.08 : 0.84)) + '" preserveAspectRatio="xMidYMax meet" opacity="0.95" pointer-events="none"/>'; }
        } else if (t === 'forest') { s += '<text x="' + (p.c * CELL + 8) + '" y="' + (p.r * CELL + 16) + '" font-size="11" opacity="0.7" pointer-events="none">🌲</text>'; }
        else if (t === 'wall') { s += '<text x="' + (p.c * CELL + 6) + '" y="' + (p.r * CELL + 16) + '" font-size="11" opacity="0.7" pointer-events="none">🧱</text>'; }
        if (t === 'hill') { s += '<rect x="' + (p.c * CELL) + '" y="' + (p.r * CELL) + '" width="' + CELL + '" height="' + CELL + '" fill="#6b4f22" fill-opacity="0.32" pointer-events="none"/><text x="' + (p.c * CELL + CELL - 8) + '" y="' + (p.r * CELL + CELL - 6) + '" font-size="12" text-anchor="middle" opacity="0.85" pointer-events="none">⛰</text>'; }
        else if (t === 'gate') { s += '<rect x="' + (p.c * CELL + 2) + '" y="' + (p.r * CELL + 2) + '" width="' + (CELL - 4) + '" height="' + (CELL - 4) + '" fill="none" stroke="#f3d27a" stroke-width="2.5" stroke-dasharray="5 3" pointer-events="none"/><text x="' + (p.c * CELL + CELL / 2) + '" y="' + (p.r * CELL + 20) + '" font-size="15" text-anchor="middle" pointer-events="none">🚪</text>'; }
        if (b.fire && b.fire[x + ',' + y]) { s += '<text x="' + (p.c * CELL + CELL / 2) + '" y="' + (p.r * CELL + CELL / 2 + 6) + '" font-size="20" text-anchor="middle" opacity="0.9" pointer-events="none">🔥</text>'; }
        if (rc.plot && rc.plot[x + ',' + y]) { s += '<rect class="tv-plot" x="' + (p.c * CELL + 3) + '" y="' + (p.r * CELL + 3) + '" width="' + (CELL - 6) + '" height="' + (CELL - 6) + '" rx="5" fill="#ff9d3a33" stroke="#ff9d3a" stroke-width="2.5" pointer-events="none"/>'; }
        if (mv[x + ',' + y]) {
          s += '<rect x="' + (p.c * CELL + 3) + '" y="' + (p.r * CELL + 3) + '" width="' + (CELL - 6) + '" height="' + (CELL - 6) +
            '" rx="5" fill="#7fd0ff44" stroke="#7fd0ff" stroke-width="2" pointer-events="none"/>';
          s += coverSvg(T().coverAt(b, x, y), p, false);   // W-0168 갈 칸의 엄폐
        }
      }
    }
    b.units.filter(function (u) { return u.hp > 0; }).sort(function (a, c) { return scr(v, a.x, a.y).r - scr(v, c.x, c.y).r; })   // 위 줄부터 — 앞 줄 몸이 뒤 줄을 가린다
      .forEach(function (u) { s += unitSvg(v, u, rc.hits[u.uid]); if (rc.hits[u.uid] != null) { s += coverSvg(T().coverAt(b, u.x, u.y), scr(v, u.x, u.y), true); } });   // W-0168 노릴 적의 엄폐
    return '<svg class="tv-svg" viewBox="0 0 ' + W + ' ' + H + '" style="width:min(100%,' + (W * 1.2) + 'px);aspect-ratio:' + W + '/' + H + '">' + (art() ? defsSvg() : '') + s + '</svg>';
  }

  function logLines(v) {
    var b = v.b, last = b.log.slice(-4), out = [];
    last.forEach(function (e) {
      var a = T().unit(b, e.a), t = T().unit(b, e.to);
      if (!a || !t) { return; }
      out.push((a.side === 'me' ? '🔵 ' : '🔴 ') + esc(nameOf(v, a)) + ' → ' + esc(nameOf(v, t)) + ' · ' +
        (e.hit ? '명중 −' + e.dmg : '빗나감') + ' <span class="muted">(' + e.ch + '%)</span>' + (t.hp <= 0 && e.hit ? ' 💀' : ''));
    });
    (b.fire_log || []).slice(-2).forEach(function (e) {
      var a = T().unit(b, e.a), t2 = e.to ? T().unit(b, e.to) : null, P = T().PLOT_NAME || {};
      if (!a) { return; }
      out.push('🔵 ' + esc(nameOf(v, a)) + ' · ' + (P[e.plot] || '책략') + (t2 ? ' → ' + esc(nameOf(v, t2)) : '') + ' · ' +
        (e.plot === 'fire' ? (e.lit ? '불길 ' + e.cells.length + '칸' + (e.hits.length ? ' · 덴 ' + e.hits.length : '') : '불씨가 꺼졌다') : e.plot === 'heal' ? '+' + e.amount : (e.hit ? '걸렸다' : '빗나감')));
    });
    return out.join('<br>');
  }

  function selInfo(v) {
    var u = v.sel ? T().unit(v.b, v.sel) : null;
    if (!u) { return v.b.srpg ? '내 장수·부대를 누르십시오 — 이동 뒤 공격. 숲 −30%p · 성벽 −50%p · 언덕 위 +10%p · 상성(창>기>궁>창) ±20%p · 뒤치기 +20%p' : '내 장수를 누르십시오 — 이동 한 번·공격 한 번씩. 숲은 피격 −30%p, 성벽은 −50%p.'; }
    var P = T().PLOT_NAME || {}, A = T().ARM_NAME || {};
    return '<b>' + esc(nameOf(v, u)) + '</b>' + (u.arm ? ' (' + A[u.arm] + ')' : '') + ' 체력 ' + Math.round(u.hp) + '/' + u.max + ' · 공 ' + Math.round(u.atk) + ' · 사거리 ' + u.rng +
      ' · ' + NAME[T().cellAt(v.b, u.x, u.y)] + (u.moved ? ' · 이동함' : '') + (u.acted ? ' · 공격함' : '') +
      (v.plot ? '<br><span style="color:#ffb35c">' + P[v.plot] + ' — 주황 칸을 누르십시오</span>' : '') + plotBtns(v, u);
  }

  /** W-0401 책략 단추 — 지력 70+ 장수가 아직 안 움직였으면(한 판 두 번) */
  function plotBtns(v, u) {
    if (!v.b.srpg || !T().canPlot || !T().canPlot(v.b, u.uid)) { return ''; }
    var P = T().PLOT_NAME, ic = { fire: '🔥', confuse: '🌀', heal: '💚' };
    return '<div class="brow tv-plots" style="margin-top:4px">' + ['fire', 'confuse', 'heal'].map(function (k) { return '<button class="btn tiny ' + (v.plot === k ? 'primary' : 'ghost') + '" data-tv="plot" data-plot="' + k + '">' + ic[k] + ' ' + P[k] + '</button>'; }).join(' ') +
      ' <span class="muted">책략 ' + v.b.plots + '번 남음</span></div>';
  }

  function resultHtml(v) {
    var o = v.out, A = T().apply(o, { where: v.opts.where });
    var line = v.b.srpg && o.kind === 'rout' && v.b.goal !== 'rout' && T().alive(v.b, 'foe').length ? '🏆 ' + esc(T().goalText(v.b)) + ' — 이겼다' : v.b.srpg && o.kind === 'win' && v.b.goal === 'hold' ? '✅ 끝까지 버텼다' : o.kind === 'rout' ? '🏆 적을 모두 꺾었다' : o.kind === 'win' ? '✅ 판을 쥐었다' : o.kind === 'lose' ? '💀 우리 장수가 모두 쓰러졌다' : '➖ 승부가 나지 않았다';
    var mod = v.opts.defend ? '적 위력 ' + (A.winPct > 0 ? '−' : '+') + Math.abs(A.winPct) + '%' + (A.kind === 'rout' ? ' · 적이 받는 피해 ×1.3' : '') :   // W-0403 방어 판
      '공 위력 ' + (A.winPct >= 0 ? '+' : '') + A.winPct + '%' + (A.lossMul !== 1 ? ' · 받는 피해 ×' + A.lossMul : '');
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
      '<div class="tv-head"><b>♟️ 전술판</b> <span class="muted">' + (b.srpg ? b.turn + '턴' : Math.min(b.turn, T().TURNS) + ' / ' + T().TURNS + '턴') + ' · ' + esc(NAME[b.land] || '') +
        (b.siege ? ' · 공성' : '') + '</span>' + (b.srpg ? ' <span class="tv-goal" style="color:#f3d27a;font-weight:700">🎯 ' + esc(T().goalText(b)) + '</span>' : '') + '</div>' +
      '<div class="tv-board">' + boardSvg(v) + cutHtml(v) + '</div>' +
      (done ? resultHtml(v) :
        '<div class="tv-info">' + selInfo(v) + '</div>' +
        '<div class="tv-log">' + logLines(v) + '</div>' +
        '<div class="brow tv-acts"><button class="btn tiny primary" data-tv="end">⏭ 턴 끝</button>' +
        '<button class="btn tiny ghost" data-tv="auto" title="남은 판을 AI 가 끝까지 둔다(내 편도)">' + (b.srpg ? '🤖 자동 전투' : '🎲 맡기기') + '</button>' +
        '<button class="btn tiny ghost" data-tv="quit" title="무승부로 판을 닫는다(보정 0)">↩️ 물러나기</button></div>') +
      '</div>';
    var V3 = global.DG.tacticsView3d;   // W-0159 — 3D 판(손잡이 tactics3d)이면 SVG 를 숨기고 캔버스를 올린다, 아니면 2D 그대로
    if (V3 && v.host.querySelector) { V3.attach(v, v.host.querySelector('.tv-board')); }
  }

  /** 공격 컷(W-0134) — 두 장수가 좌우에서 미끄러져 마주 서고 명중·피해. 판정 결과(r)를 재생만 한다 */
  function cutHtml(v) {
    var c = v.cut;
    if (!c || Date.now() - c.at > 1100) { return ''; }
    function side(u, cls) {
      var f = u.kind === 'officer' && v.opts.face ? v.opts.face(u.id) : '';
      return '<div class="tv-cut-side ' + cls + (u.side === 'me' ? ' me' : ' foe') + '">' + (f ? '<img src="' + esc(f) + '" alt="">' : '<span class="tv-cut-emo">' + (u.kind === 'troop' ? '🪖' : '⚔️') + '</span>') +
        '<b>' + esc(nameOf(v, u)) + '</b></div>';
    }
    return '<div class="tv-cut">' + side(c.a, 'l') + '<div class="tv-cut-mid">' + (c.r.hit ? '−' + c.r.dmg + (c.r.killed ? ' 💀' : '') : '빗나감') + '<small>' + c.r.chance + '%</small></div>' + side(c.t, 'r') + '</div>';
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
    if (v.plot && sel) {   // W-0401 책략 — 불은 칸, 혼란·회복은 유닛
      var pr = v.plot === 'fire' ? T().fire(b, sel.uid, x, y) : (here ? T().plot(b, sel.uid, v.plot, here.uid) : { ok: false });
      v.plot = null;
      if (pr.ok) { v.sel = null; settle(); render(); return; }
    }
    if (here && here.side === 'me') { v.sel = here.uid; v.plot = null; render(); return; }
    if (here && here.side === 'foe' && sel) {
      var r = T().attack(b, sel.uid, here.uid);
      if (r.ok && r.hit && !(global.DG.tacticsView3d && global.DG.tacticsView3d.want()) && global.DG.core && global.DG.core.emit) { global.DG.core.emit('tac:hit', { kill: !!r.killed }); }   // W-0230 2D 판도 타격음(3D 는 맞는 순간에)
      if (r.ok) { v.cut = { a: sel, t: here, r: r, at: Date.now() }; setTimeout(function () { if (cur === v) { v.cut = null; render(); } }, 1150); settle(); }
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
    v.sel = null; v.plot = null;
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
      else if (k === 'plot' && cur) { var pk = btn.getAttribute('data-plot'); cur.plot = cur.plot === pk ? null : pk; render(); }
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
    /* 그릴 자리가 없으면(전장 카드가 다른 카드로 바뀜) 판 없이 곧장 끝낸다 — 안 그러면 출진이 멈춘 채 남는다 */
    if (!host) { cur = null; if (done) { done(null); } return null; }
    var b = opts.srpg && T().makeBoardSrpg ? T().makeBoardSrpg(opts.seed, opts.land, opts.siege, opts.goal) : T().makeBoard(opts.seed, opts.land, opts.siege);   // W-0401 SRPG 본전투 판
    if (b.srpg && opts.defend && T().mirror) { T().mirror(b); }   // W-0403 방어 판 — 성벽이 내 쪽
    if (b.srpg) { T().unitsOfSrpg(b, opts.mine, opts.foes, opts.foeTroops, null, opts.myTroops || []); } else { T().unitsOf(b, opts.mine, opts.foes, opts.foeTroops); }
    host.classList.add('show');   // 먼저 보여야 폭을 잰다(display:none 이면 0)
    if (!host.__tvBound) { host.addEventListener('click', onClick); host.__tvBound = true; }
    var wide = host.clientWidth || 0;
    cur = { host: host, opts: opts, done: done, b: b, sel: null, plot: null, out: null, vert: wide > 0 && wide < b.cols * 46 };
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
    open: open, tap: tap, endTurn: endTurn, auto: auto, quit: quit, go: go, annalsHtml: annalsHtml, plotMode: function (k) { if (cur) { cur.plot = k || null; render(); } },
    _coverSvg: coverSvg,   // W-0168 진단
    cur: function () { return cur; }, scr: scr, brd: brd, bodyOf: bodyOf, tileHref: tileHref
  };
})(window);
