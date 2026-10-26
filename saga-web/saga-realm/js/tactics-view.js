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
  /* ── W-0452 SRPG 겉모습(사용자 10-26 「턴방식 화면 수정해줘 누가 이거 보고 하게?」) — 판이 화면을 꽉 채우고 위 띠(턴·조건)·왼쪽 아래 장수 카드·오른쪽 아래 명령,
     이어진 땅 질감(칸마다 같은 타일 반복 대신)·옅은 격자·숲 나무 무리·들판 덤불·판 밖 어둑한 땅, 몸 1.35배, 턴 띠·피해 숫자. 손잡이 tactics.skin(1, 0 = 옛 모습) ── */
  function skin() { var o = global.DG.core; return !(o && o.tuned && !+o.tuned('tactics.skin', 1)); }
  function groundHref(name) { var A = global.DG.assets3d, u = A && A.sharedUrl ? A.sharedUrl('ground/') : null; return (u || '../shared/assets/ground/') + name + '_512.webp'; }
  function skinCss() {
    if (!global.document || global.document.getElementById('tvs-css')) { return; }
    var st = global.document.createElement('style'); st.id = 'tvs-css';
    st.textContent = '.tacview:has(.tvs){padding:0;background:#0b0a08}.tv.tvs{max-width:none;width:100%;margin:0;display:block;gap:0}.tvs{position:relative;height:100%;min-height:100%;color:#f1e6cc;overflow:hidden;background:radial-gradient(ellipse at 50% 40%,#2b2a1e 0%,#12110c 75%)}' +
      '.tvs-board{position:absolute;left:0;right:0;top:48px;bottom:74px;display:flex;align-items:center;justify-content:center}.tvs-board .tv-svg{width:100%!important;height:100%!important;aspect-ratio:auto!important;filter:drop-shadow(0 10px 24px #000a)}' +
      '.tvs-top{position:absolute;left:10px;right:118px;top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;pointer-events:none}.tvs-chip{background:linear-gradient(#3a2c18ee,#21180ccc);border:1px solid #9a7840;border-radius:999px;padding:5px 12px;font-weight:700;font-size:13px;letter-spacing:.03em;box-shadow:0 2px 8px #0008}' +
      '.tvs-chip.turn{font-size:15px}.tvs-chip.me{border-color:#4f9be0;background:linear-gradient(#1e3a5aee,#12243acc)}.tvs-chip.goal{color:#f3d27a}' +
      '.tvs-card{position:absolute;left:10px;bottom:10px;width:min(380px,calc(100% - 20px));display:flex;gap:10px;align-items:flex-start;background:linear-gradient(#211a10f2,#120e08f2);border:1px solid #9a7840;border-radius:12px;padding:9px 10px;box-shadow:0 6px 20px #000b;font-size:13px;line-height:1.45}' +
      '.tvs-card img{width:58px;height:58px;border-radius:9px;border:2px solid #4f9be0;flex:none;background:#222}.tvs-card.foe img{border-color:#d24b3c}.tvs-card b{font-size:15px}.tvs-hp{height:7px;border-radius:4px;background:#0009;overflow:hidden;margin:4px 0 3px}.tvs-hp i{display:block;height:100%}' +
      '.tvs-card .muted{color:#c9b48a}.tvs-acts{position:absolute;right:10px;bottom:10px;display:flex;gap:6px}.tvs-acts .btn{min-height:44px;padding:8px 14px;font-weight:700}' +
      '.tvs-log{position:absolute;right:10px;top:46px;width:min(300px,42%);font-size:12px;line-height:1.5;background:#0007;border-radius:8px;padding:5px 8px;pointer-events:none}.tvs-log:empty{display:none}' +
      '.tvs-banner{position:absolute;left:0;right:0;top:38%;text-align:center;pointer-events:none;font:800 30px/1.2 serif;letter-spacing:.12em;color:#fff3d0;text-shadow:0 3px 12px #000;animation:tvsBan 1.3s ease-out forwards}' +
      '.tvs-banner span{display:inline-block;padding:10px 40px;background:linear-gradient(90deg,transparent,#1d3550e6 20%,#1d3550e6 80%,transparent)}.tvs-banner.foe span{background:linear-gradient(90deg,transparent,#5a1e18e6 20%,#5a1e18e6 80%,transparent)}' +
      '@keyframes tvsBan{0%{opacity:0;transform:translateX(-30px)}18%{opacity:1;transform:none}75%{opacity:1}100%{opacity:0}}' +
      '.tvs-float{animation:tvsFl .95s ease-out forwards;font-weight:800;paint-order:stroke;stroke:#000;stroke-width:3px}@keyframes tvsFl{0%{opacity:0;transform:translateY(6px)}15%{opacity:1}100%{opacity:0;transform:translateY(-22px)}}' +
      '.tvs .tv-unit.sel .tv-body{filter:drop-shadow(0 0 4px #ffe08a)}.tvs .tv-unit.spent{filter:grayscale(.85) brightness(.8)}' +
      '.tvs-res{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,calc(100% - 24px));background:linear-gradient(#211a10f7,#120e08f7);border:1px solid #c9a35a;border-radius:14px;padding:16px;box-shadow:0 10px 40px #000c}' +
      '.tvs-cut{position:absolute;inset:0;pointer-events:none;z-index:4}.tvs-cut *{animation-delay:var(--e)!important}.tvs-cut-band{position:absolute;left:0;right:0;top:22%;height:52%;background:linear-gradient(180deg,transparent,#0b0906e6 14%,#0b0906e6 86%,transparent);animation:tvsBand 1.3s ease-out both}' +
      '.tvs-cut-a,.tvs-cut-t{position:absolute;top:20%;height:56%;width:46%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}.tvs-cut-a{left:2%;animation:tvsInL 1.3s cubic-bezier(.2,.9,.3,1) both}.tvs-cut-t{right:2%;animation:tvsInR 1.3s cubic-bezier(.2,.9,.3,1) both}' +
      '.tvs-cut-a img,.tvs-cut-t img{height:82%;max-width:100%;object-fit:contain;filter:drop-shadow(0 6px 14px #000c)}.tvs-cut-t img{transform:scaleX(-1)}.tvs-cut-emo{font-size:64px}' +
      '.tvs-cut-nm{margin-top:4px;padding:3px 12px;border-radius:999px;font-size:13px;background:#1d3550e6;border:1px solid #4f9be0}.tvs-cut-t .tvs-cut-nm,.tvs-cut-a.foe .tvs-cut-nm{background:#5a1e18e6;border-color:#d24b3c}.tvs-cut-a.foe .tvs-cut-nm{background:#5a1e18e6}.tvs-cut-t.me .tvs-cut-nm{background:#1d3550e6;border-color:#4f9be0}' +
      '.tvs-cut-hp{position:relative;width:min(220px,80%);height:12px;margin-top:5px;background:#000a;border-radius:6px;overflow:hidden;border:1px solid #fff3}.tvs-cut-hp i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#e2553f,#f0c34f);animation:tvsHp 1.3s ease-out both}.tvs-cut-hp span{position:absolute;inset:0;text-align:center;font-size:10px;line-height:12px;color:#fff;text-shadow:0 1px 2px #000}' +
      '.tvs-cut-slash{position:absolute;left:44%;top:30%;width:12%;height:36%;background:linear-gradient(115deg,transparent 42%,#fff 49%,#ffe9a0 51%,transparent 58%);animation:tvsSl 1.3s ease-out both;filter:drop-shadow(0 0 10px #ffd27a)}' +
      '.tvs-cut-num{position:absolute;left:0;right:0;top:40%;text-align:center;font:900 46px/1 serif;color:#ffe27a;text-shadow:0 3px 0 #7a2a10,0 6px 18px #000;animation:tvsNum 1.3s ease-out both}.tvs-cut-num.miss{color:#cfd8e3;text-shadow:0 3px 10px #000;font-size:34px}.tvs-cut-num small{display:block;font-size:18px;color:#ff8a6a;margin-top:4px}.tvs-cut-num em{display:block;font:600 12px/1.6 sans-serif;color:#d8c9a2;font-style:normal}' +
      '.tvs-cut-sk{display:inline-block;margin-top:6px;padding:3px 12px;border-radius:999px;background:#3a2c18ee;border:1px solid #f3d27a;font:800 15px/1.4 sans-serif;color:#ffe9a0;text-shadow:none}' +
      '@keyframes tvsBand{0%{opacity:0;transform:scaleY(.2)}12%{opacity:1;transform:none}82%{opacity:1}100%{opacity:0}}@keyframes tvsInL{0%{opacity:0;transform:translateX(-40%)}20%{opacity:1;transform:none}82%{opacity:1}100%{opacity:0}}@keyframes tvsInR{0%{opacity:0;transform:translateX(40%)}20%{opacity:1;transform:none}82%{opacity:1}100%{opacity:0}}' +
      '@keyframes tvsSl{0%,24%{opacity:0;transform:translate(-40%,-30%) scale(.6)}32%{opacity:1;transform:none}48%{opacity:0;transform:translate(40%,30%)}100%{opacity:0}}@keyframes tvsNum{0%,30%{opacity:0;transform:scale(1.8)}40%{opacity:1;transform:none}82%{opacity:1}100%{opacity:0;transform:translateY(-12px)}}' +
      '@keyframes tvsHp{0%,34%{width:var(--from)}62%,100%{width:var(--to)}}' +
      '@media (max-width:700px){.tvs-cut-a,.tvs-cut-t{top:27%;height:40%}.tvs-cut-band{top:25%;height:46%}.tvs-cut-num{top:36%;font-size:40px}.tvs-board{top:44px;bottom:176px}.tvs-acts{left:10px;right:10px;bottom:10px}.tvs-acts .btn{flex:1}.tvs-card{bottom:64px}.tvs-log{display:none}}';
    global.document.head.appendChild(st);
  }
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
  function nameOf(v, u) { var CM = global.DG.command, m = CM && v.b ? CM.nameOf(v.b, u, v.opts.name || offName) : null; return m || (u.kind === 'troop' ? '부대' : (v.opts.name || offName)(u.id)); }   // W-0455 「○○ 휘하 창병」

  /** 지금 고른 장수가 할 수 있는 것 — 갈 칸·칠 수 있는 적(명중 %) */
  function reach(v) {
    var b = v.b, u = v.sel ? T().unit(b, v.sel) : null, out = { moves: [], hits: {} };
    if (!u || u.hp <= 0 || b.done) { return out; }
    if (v.ult && global.DG.ultimate) { out.plot = {}; global.DG.ultimate.cells(b, u.uid).forEach(function (c) { out.plot[c.x + ',' + c.y] = 1; }); return out; }   // W-0456 필살 대상 칸
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
    if (art()) { return s + bodySvg(v, u, p, cx, me, ring) + rankSvg(u, p, cx) + hpSvg(u, p, cx) + srpgMarks(u, p, cx) + (global.DG.support ? global.DG.support.svgMark(v.b, u, p.c * CELL, p.r * CELL, CELL) : '') + hitSvg(hit, p, cx) + '</g>'; }   // W-0134 몸 그림 · W-0234 관직 별 · W-0401 병종·대장
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
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="none" stroke="' + ring + '" stroke-width="' + (v.sel === u.uid ? 4 : 2.5) + '"/>' + rankSvg(u, p, cx) + srpgMarks(u, p, cx) + (global.DG.support ? global.DG.support.svgMark(v.b, u, p.c * CELL, p.r * CELL, CELL) : '');
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
      var sz = CELL * (skin() ? 1.5 : 1.12), x = cx - sz / 2, y = foot - sz * 252 / 256;
      s += '<image class="tv-body" href="' + esc(stillHref(B.still, view)) + '" x="' + x + '" y="' + y + '" width="' + sz + '" height="' + sz + '"' + (flip ? ' transform="translate(' + (2 * cx) + ',0) scale(-1,1)"' : '') + '/>';
    } else {
      var fz = CELL * (skin() ? 2.05 : 1.55), row = view === 'front' ? 0 : view === 'back' ? 2 : 1, fx = cx - fz / 2, fy = foot - fz * 0.89;
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

  /** W-0452 이어진 땅 — 패턴을 칸 넷 크기로(userSpaceOnUse 라 칸끼리 결이 이어진다) · 판 밖 테두리 땅 · 옅은 격자 · 숲 나무 무리 · 들판 덤불 */
  var GROUND = { plain: 'plain', hill: 'plain', forest: 'forest', gate: 'gate' };   // 판 타일(realm_grass·forest_grass·realm_stone)을 칸 넷 크기로 — 섞음 결(field_mix)은 이 척도에서 흙얼룩투성이
  function boardSkin(v) {
    var b = v.b, cols = v.vert ? b.rows : b.cols, rows = v.vert ? b.cols : b.rows, W = cols * CELL, H = rows * CELL, M = CELL * 0.9, s = '', x, y, k, P = CELL * 4;
    var defs = '<defs>';
    ['plain', 'hill', 'forest', 'gate'].forEach(function (t) { defs += '<pattern id="tvs-' + t + '" patternUnits="userSpaceOnUse" width="' + P + '" height="' + P + '"><rect width="' + P + '" height="' + P + '" fill="' + COL[t] + '"/><image href="' + esc(tileHref(GROUND[t])) + '" width="' + P + '" height="' + P + '" preserveAspectRatio="xMidYMid slice"/></pattern>'; });
    ['river', 'wall'].forEach(function (t) { defs += '<pattern id="tvs-' + t + '" patternUnits="userSpaceOnUse" width="' + CELL * 2 + '" height="' + CELL * 2 + '"><rect width="' + CELL * 2 + '" height="' + CELL * 2 + '" fill="' + COL[t] + '"/><image href="' + esc(tileHref(t)) + '" width="' + CELL * 2 + '" height="' + CELL * 2 + '" preserveAspectRatio="xMidYMid slice"/></pattern>'; });
    defs += '<radialGradient id="tvs-vig" cx="50%" cy="50%" r="70%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".55"/></radialGradient></defs>';
    /* 판 밖 — 같은 땅을 어둡게 깔아 네모로 뚝 끊기지 않게 */
    s += '<rect x="' + (-M) + '" y="' + (-M) + '" width="' + (W + 2 * M) + '" height="' + (H + 2 * M) + '" fill="url(#tvs-plain)" pointer-events="none"/><rect x="' + (-M) + '" y="' + (-M) + '" width="' + (W + 2 * M) + '" height="' + (H + 2 * M) + '" fill="#0d0b06" fill-opacity=".62" pointer-events="none"/>';
    for (k = 0; k < 14; k++) { var ex = (hashS('ex' + k) % 1000) / 1000, side = k % 4, px = side < 2 ? ex * W : (side === 2 ? -M * 0.8 : W + M * 0.1), py = side < 2 ? (side === 0 ? -M * 0.95 : H + M * 0.05) : ex * H, ph0 = propHref(PROP.forest[k % PROP.forest.length]); if (ph0) { s += '<image href="' + esc(ph0) + '" x="' + px + '" y="' + py + '" width="' + M * 0.9 + '" height="' + M * 0.9 + '" opacity=".55" pointer-events="none"/>'; } }
    var rc = reach(v), mv = {}, deco = '', trees = [], cr = global.DG.command ? global.DG.command.range(b, v.sel) : {};   // W-0455 지휘 범위
    rc.moves.forEach(function (m) { mv[m.x + ',' + m.y] = 1; });
    for (y = 0; y < b.rows; y++) {
      for (x = 0; x < b.cols; x++) {
        var t = T().cellAt(b, x, y), p = scr(v, x, y), X = p.c * CELL, Y = p.r * CELL, h = hashS(x + ':' + y);
        s += '<rect class="tv-cell" data-x="' + x + '" data-y="' + y + '" x="' + X + '" y="' + Y + '" width="' + (CELL + 0.5) + '" height="' + (CELL + 0.5) + '" fill="url(#tvs-' + (GROUND[t] || t === 'river' || t === 'wall' ? t : 'plain') + ')"/>';
        if (t === 'forest') { s += '<rect x="' + X + '" y="' + Y + '" width="' + CELL + '" height="' + CELL + '" fill="#0b2a0e" fill-opacity=".3" pointer-events="none"/>'; for (k = 0; k < 3; k++) { trees.push({ x: X + CELL * (0.05 + ((h >> (k * 3)) % 5) * 0.12), y: Y + CELL * (-0.32 + k * 0.22), sz: CELL * (0.62 + ((h >> (k * 5)) % 4) * 0.06), id: PROP.forest[(h >> k) % PROP.forest.length] }); } }
        else if (t === 'hill') { s += '<path d="M' + (X - CELL * 0.08) + ',' + (Y + CELL) + ' Q' + (X + CELL / 2) + ',' + (Y - CELL * 0.05) + ' ' + (X + CELL * 1.08) + ',' + (Y + CELL) + ' Z" fill="#7a5a2a" fill-opacity=".5" pointer-events="none"/><path d="M' + (X + CELL * 0.18) + ',' + (Y + CELL * 0.7) + ' Q' + (X + CELL / 2) + ',' + (Y + CELL * 0.3) + ' ' + (X + CELL * 0.82) + ',' + (Y + CELL * 0.7) + '" fill="none" stroke="#e8d3a0" stroke-opacity=".35" stroke-width="2" pointer-events="none"/>'; }
        else if (t === 'river') { s += '<rect x="' + X + '" y="' + Y + '" width="' + CELL + '" height="' + CELL + '" fill="#9fd4ff" fill-opacity=".12" pointer-events="none"/>'; }
        else if (t === 'wall') { var pw = propHref(PROP.wall[0]); if (pw) { deco += '<image href="' + esc(pw) + '" x="' + (X - CELL * 0.05) + '" y="' + (Y - CELL * 0.25) + '" width="' + CELL * 1.1 + '" height="' + CELL * 1.1 + '" pointer-events="none"/>'; } }
        else if (t === 'gate') { s += '<rect x="' + (X + 3) + '" y="' + (Y + 3) + '" width="' + (CELL - 6) + '" height="' + (CELL - 6) + '" rx="4" fill="none" stroke="#f3d27a" stroke-width="2.5" stroke-dasharray="6 4" pointer-events="none"/><text x="' + (X + CELL / 2) + '" y="' + (Y + CELL / 2 + 6) + '" text-anchor="middle" font-size="18" pointer-events="none">🚪</text>'; }
        else if (t === 'plain' && h % 100 < 13) { var bh = propHref(h % 3 ? 'bush_0' + (1 + h % 2) : 'flower_patch_01'); if (bh) { deco += '<image href="' + esc(bh) + '" x="' + (X + CELL * (0.1 + (h % 7) * 0.08)) + '" y="' + (Y + CELL * (0.35 + (h % 5) * 0.06)) + '" width="' + CELL * 0.42 + '" height="' + CELL * 0.42 + '" opacity=".9" pointer-events="none"/>'; } }
        if (b.fire && b.fire[x + ',' + y]) { deco += '<text x="' + (X + CELL / 2) + '" y="' + (Y + CELL / 2 + 6) + '" font-size="22" text-anchor="middle" pointer-events="none">🔥</text>'; }
        if (rc.plot && rc.plot[x + ',' + y]) { deco += '<rect class="tv-plot" x="' + (X + 3) + '" y="' + (Y + 3) + '" width="' + (CELL - 6) + '" height="' + (CELL - 6) + '" rx="6" fill="#ff9d3a33" stroke="#ff9d3a" stroke-width="2.5" pointer-events="none"/>'; }
        if (cr[x + ',' + y]) { deco += '<rect x="' + (X + 1) + '" y="' + (Y + 1) + '" width="' + (CELL - 2) + '" height="' + (CELL - 2) + '" fill="#f3d27a14" stroke="#f3d27a" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="3 3" pointer-events="none"/>'; }
        if (mv[x + ',' + y]) { deco += '<rect x="' + (X + 2) + '" y="' + (Y + 2) + '" width="' + (CELL - 4) + '" height="' + (CELL - 4) + '" rx="6" fill="#5fb8ff3d" stroke="#8fd0ff" stroke-width="2" pointer-events="none"/>' + coverSvg(T().coverAt(b, x, y), p, false); }
      }
    }
    /* 옅은 격자 */
    var g = '<g stroke="#000" stroke-opacity=".16" stroke-width="1" pointer-events="none">';
    for (x = 1; x < cols; x++) { g += '<line x1="' + x * CELL + '" y1="0" x2="' + x * CELL + '" y2="' + H + '"/>'; }
    for (y = 1; y < rows; y++) { g += '<line x1="0" y1="' + y * CELL + '" x2="' + W + '" y2="' + y * CELL + '"/>'; }
    s += g + '</g><rect width="' + W + '" height="' + H + '" fill="url(#tvs-vig)" pointer-events="none"/><rect x="-1.5" y="-1.5" width="' + (W + 3) + '" height="' + (H + 3) + '" fill="none" stroke="#c9a35a" stroke-opacity=".7" stroke-width="2" rx="3" pointer-events="none"/>' + deco;
    /* 나무·장수 — 위 줄부터(앞이 뒤를 가린다) */
    var items = trees.map(function (tr) { return { y: tr.y + tr.sz, h: '<image href="' + esc(propHref(tr.id)) + '" x="' + tr.x + '" y="' + tr.y + '" width="' + tr.sz + '" height="' + tr.sz + '" pointer-events="none"/>' }; });
    v.pos = v.pos || {}; var nowP = Date.now();
    b.units.filter(function (u) { return u.hp > 0; }).forEach(function (u) {
      var p2 = scr(v, u.x, u.y), old = v.pos[u.uid], us = unitSvg(v, u, rc.hits[u.uid]);
      if (old && (old.c !== p2.c || old.r !== p2.r)) { v.pos[u.uid] = { c: p2.c, r: p2.r, fc: old.c, fr: old.r, at: nowP }; } else if (!old) { v.pos[u.uid] = { c: p2.c, r: p2.r }; }
      var mv0 = v.pos[u.uid], dl = mv0.at ? (nowP - mv0.at) / 1000 : 9, delay = u.side === 'foe' && v.foeBan && nowP - v.foeBan < 400 ? 0.25 : 0;   // 적은 적군 차례 띠 뒤로 조금 늦게
      if (mv0.at && dl < 0.4) { us = us.replace(/<\/g>$/, '<animateTransform attributeName="transform" type="translate" from="' + ((mv0.fc - mv0.c) * CELL) + ' ' + ((mv0.fr - mv0.r) * CELL) + '" to="0 0" begin="' + delay + 's" dur="0.35s" fill="freeze"/></g>'); if (delay) { us = us.replace('<g class="tv-unit', '<g transform="translate(' + ((mv0.fc - mv0.c) * CELL) + ' ' + ((mv0.fr - mv0.r) * CELL) + ')" class="tv-unit'); } }
      items.push({ y: p2.r * CELL + CELL, h: us + (rc.hits[u.uid] != null ? coverSvg(T().coverAt(b, u.x, u.y), p2, true) : '') });
    });
    items.sort(function (a, c) { return a.y - c.y; }).forEach(function (it) { s += it.h; });
    s += floatsSvg(v);
    return '<svg class="tv-svg" viewBox="' + (-M) + ' ' + (-M) + ' ' + (W + 2 * M) + ' ' + (H + 2 * M) + '" preserveAspectRatio="xMidYMid meet">' + defs + s + '</svg>';
  }
  /** W-0452 피해 숫자 — 새 기록마다 0.95초 떠오름(render 마다 다시 그려도 처음 본 때로 잰다) */
  function floatsSvg(v) {
    var b = v.b, now = Date.now(), s = '', i;
    v.fl = v.fl || []; v.flN = v.flN == null ? b.log.length : v.flN;
    for (i = v.flN; i < b.log.length; i++) { var e = b.log[i], t = T().unit(b, e.to); if (t) { v.fl.push({ x: t.x, y: t.y, txt: (e.counter ? '반격 ' : '') + (e.hit ? '−' + e.dmg : '빗나감'), col: e.hit ? (t.side === 'me' ? '#ff8a6a' : '#ffe27a') : '#cfd8e3', at: now }); } var sa = e.skills && e.skills.length ? T().unit(b, e.a) : null; if (sa) { v.fl.push({ x: sa.x, y: sa.y - 0.45, txt: '✦ ' + e.skills.join('·'), col: '#f3d27a', at: now }); } }
    v.flN = b.log.length; v.fl = v.fl.filter(function (q) { return now - q.at < 1000; });
    v.fl.forEach(function (q) { var p = scr(v, q.x, q.y); s += '<text class="tvs-float" x="' + (p.c * CELL + CELL / 2) + '" y="' + (p.r * CELL + 4) + '" text-anchor="middle" font-size="17" fill="' + q.col + '" pointer-events="none">' + q.txt + '</text>'; });
    if (v.fl.length && !v.flT) { v.flT = global.setTimeout(function () { v.flT = null; if (cur === v) { render(); } }, 1000); }
    return s;
  }
  function boardSvg(v) {
    if (skin() && art()) { return boardSkin(v); }
    var b = v.b, W = (v.vert ? b.rows : b.cols) * CELL, H = (v.vert ? b.cols : b.rows) * CELL, s = '', x, y;
    var rc = reach(v), mv = {}, cr = global.DG.command ? global.DG.command.range(b, v.sel) : {};   // W-0455 지휘 범위
    rc.moves.forEach(function (m) { mv[m.x + ',' + m.y] = 1; });
    for (y = 0; y < b.rows; y++) {
      for (x = 0; x < b.cols; x++) {
        var t = T().cellAt(b, x, y), p = scr(v, x, y);
        if (cr[x + ',' + y]) { s += '<rect x="' + (p.c * CELL + 1) + '" y="' + (p.r * CELL + 1) + '" width="' + (CELL - 2) + '" height="' + (CELL - 2) + '" fill="none" stroke="#f3d27a" stroke-opacity=".55" stroke-dasharray="3 3" pointer-events="none"/>'; }
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
    if (skin() && art()) { renderSkin(v, b, done); return; }
    v.host.innerHTML = '<div class="tv">' +
      '<div class="tv-head"><b>♟️ 전술판</b> <span class="muted">' + (b.srpg ? b.turn + '턴' : Math.min(b.turn, T().TURNS) + ' / ' + T().TURNS + '턴') + ' · ' + esc(NAME[b.land] || '') +
        (b.siege ? ' · 공성' : '') + '</span>' + (b.srpg ? ' <span class="tv-goal" style="color:#f3d27a;font-weight:700">🎯 ' + esc(T().goalText(b)) + '</span>' : '') + '</div>' +
      '<div class="tv-board">' + boardSvg(v) + cutHtml(v) + (global.DG.battleEvent ? global.DG.battleEvent.html(v, function (u) { return cutArt(v, u); }, function () { if (cur === v) { render(); } }) : '') + '</div>' +
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

  /** W-0452 SRPG 배치 — 판이 꽉 차고 위 띠·장수 카드·명령·기록·턴 띠가 위에 뜬다(판정·클릭 길은 옛 render 와 같다) */
  function renderSkin(v, b, done) {
    skinCss();
    var turnTxt = b.srpg ? '제 ' + b.turn + ' 턴' : Math.min(b.turn, T().TURNS) + ' / ' + T().TURNS + ' 턴';
    if (v.banT !== b.turn) { v.banT = b.turn; v.banAt = Date.now(); }
    var foeB = v.foeBan && Date.now() - v.foeBan < 2400;
    var html = '<div class="tv tvs"><div class="tv-board tvs-board">' + boardSvg(v) + cutHtml(v) + (global.DG.battleEvent ? global.DG.battleEvent.html(v, function (u) { return cutArt(v, u); }, function () { if (cur === v) { render(); } }) : '') + '</div>' +
      '<div class="tvs-top"><span class="tvs-chip turn me">⚔ ' + esc(turnTxt) + ' · 아군 차례</span>' + (b.srpg ? '<span class="tvs-chip goal tv-goal">🎯 ' + esc(T().goalText(b)) + '</span>' : '') + '<span class="tvs-chip">' + esc(NAME[b.land] || '') + (b.siege ? ' · 공성' : ' · 들판') + '</span></div>';
    /* 다시 그려도(피해 숫자 지우기 등) 띠가 처음부터 다시 돌지 않게 — 지난 시간만큼 animation-delay 를 당긴다 */
    var eF = foeB ? (Date.now() - v.foeBan) / 1000 : 0, eA = (Date.now() - v.banAt) / 1000;
    if (!done && foeB) { html += (eF < 1.3 ? '<div class="tvs-banner foe" style="animation-delay:' + (-eF).toFixed(2) + 's"><span>적군 차례</span></div>' : '') + '<div class="tvs-banner" style="animation-delay:' + (1 - eF).toFixed(2) + 's;animation-fill-mode:both"><span>' + esc(turnTxt) + ' — 아군 차례</span></div>'; }
    else if (!done && eA < 1.3) { html += '<div class="tvs-banner" style="animation-delay:' + (-eA).toFixed(2) + 's"><span>' + esc(turnTxt) + ' — 아군 차례</span></div>'; }
    if (done) { html += '<div class="tvs-res">' + resultHtml(v) + '</div>'; }
    else {
      html += '<div class="tvs-log">' + logLines(v) + '</div>' + cardHtml(v) +
        '<div class="tvs-acts"><button class="btn primary" data-tv="end">⏭ 턴 끝</button><button class="btn ghost" data-tv="auto">' + (b.srpg ? '🤖 자동 전투' : '🎲 맡기기') + '</button><button class="btn ghost" data-tv="quit">↩ 물러나기</button></div>';
    }
    v.host.innerHTML = html + '</div>';
    var V3 = global.DG.tacticsView3d;
    if (V3 && v.host.querySelector) { V3.attach(v, v.host.querySelector('.tv-board')); }
  }
  /** 고른 장수 카드 — 초상·이름·병종·체력 막대·공·사거리·지형·책략 단추. 안 골랐으면 짧은 안내 */
  function cardHtml(v) {
    var u = v.sel ? T().unit(v.b, v.sel) : null, A = T().ARM_NAME || {};
    if (!u) { return '<div class="tvs-card"><div>🔵 <b>내 장수를 누르십시오</b><br><span class="muted">파란 칸으로 이동 → 빨간 적을 눌러 공격 · 숲 −30%p · 언덕 위 +10%p · 상성 창>기>궁>창 · 뒤치기 +20%p' + (v.b.command ? '<br>⚑ 장수마다 용병 둘 — 금빛 지휘 범위 안이면 강해지고, 지휘관이 쓰러지면 휘하가 흩어진다 · 맞닿아 치면 반격을 받는다(궁·책사 두 칸은 안전)' : '') + '</span></div></div>'; }
    var f = Math.max(0, u.hp / u.max), col = f > 0.5 ? '#5bd16a' : (f > 0.25 ? '#e3c33f' : '#e2553f'), face = u.kind === 'officer' && v.opts.face ? v.opts.face(u.id) : '';
    return '<div class="tvs-card' + (u.side === 'me' ? '' : ' foe') + '">' + (face ? '<img src="' + esc(face) + '" alt="">' : '<span style="font-size:40px;width:58px;text-align:center">' + (u.kind === 'troop' ? '🪖' : '⚔️') + '</span>') +
      '<div style="flex:1;min-width:0"><b>' + esc(nameOf(v, u)) + '</b>' + (u.arm ? ' <span class="muted">' + esc(A[u.arm] || '') + '</span>' : '') + (u.leader ? ' 👑' : '') +
      '<div class="tvs-hp"><i style="width:' + Math.round(f * 100) + '%;background:' + col + '"></i></div>' +
      '<span class="muted">체력 ' + Math.round(u.hp) + '/' + u.max + ' · 공 ' + Math.round(u.atk) + ' · 사거리 ' + u.rng + ' · ' + esc(NAME[T().cellAt(v.b, u.x, u.y)] || '') + (u.moved ? ' · 이동함' : '') + (u.acted ? ' · 공격함' : '') + '</span>' + (u.skill ? '<br><span style="color:#f3d27a">✦ ' + esc(u.skill.name) + '</span> <span class="muted">' + esc(u.skill.desc) + '</span>' : '') +
      (v.plot ? '<br><span style="color:#ffb35c">' + esc((T().PLOT_NAME || {})[v.plot] || '') + ' — 주황 칸을 누르십시오</span>' : '') + (global.DG.command ? global.DG.command.cardLine(v.b, u, function (id) { return (v.opts.name || offName)(id); }) : '') + (global.DG.realmClass ? global.DG.realmClass.cardLine(u) : '') + (global.DG.ultimate ? global.DG.ultimate.cardHtml(v.b, u, v.ult) : '') + plotBtns(v, u) + '</div></div>';   // W-0455 지휘
  }
  /** 공격 컷(W-0134) — 두 장수가 좌우에서 미끄러져 마주 서고 명중·피해. 판정 결과(r)를 재생만 한다 */
  /** W-0452 공격 컷 SRPG 겉모습 — 가운데 띠 위로 두 장수 반신(일러스트 → 카드 초상 → 작은 초상)이 미끄러져 들어오고 · 베기 섬광 · 큰 피해 숫자 · 맞은 쪽 체력 막대가 줄어든다 */
  function cutArt(v, u) {
    if (u.kind !== 'officer') { return ''; }
    var I = global.DG.illust, P3 = global.DG.portrait3d, h = global.DG.off && global.DG.off.find(u.id);
    if (I && I.has && I.has(u.id)) { return I.url(u.id, 'neutral'); }
    var c = h && P3 && P3.of ? P3.of('hero', h, 150, 172) : null;
    return c || (v.opts.face ? v.opts.face(u.id) : '');
  }
  function cutSkin(v, c) {
    var e = (Date.now() - c.at) / 1000, A = T().ARM_NAME || {}, t = c.t, r = c.r, hp1 = Math.max(0, Math.round(t.hp)), hp0 = Math.min(t.max, hp1 + (r.hit ? r.dmg : 0));
    function side(u, cls) {
      var src = cutArt(v, u);
      return '<div class="tvs-cut-' + cls + (u.side === 'me' ? ' me' : ' foe') + '">' + (src ? '<img src="' + esc(src) + '" alt="">' : '<span class="tvs-cut-emo">' + (u.kind === 'troop' ? '🪖' : '⚔️') + '</span>') +
        '<div class="tvs-cut-nm"><b>' + esc(nameOf(v, u)) + '</b>' + (u.arm ? ' · ' + esc(A[u.arm] || '') : '') + '</div>' +
        (cls === 't' ? '<div class="tvs-cut-hp"><i style="--from:' + Math.round(100 * hp0 / t.max) + '%;--to:' + Math.round(100 * hp1 / t.max) + '%"></i><span>' + hp1 + ' / ' + t.max + '</span></div>' : '') + '</div>';
    }
    return '<div class="tvs-cut" style="--e:' + (-e).toFixed(2) + 's"><div class="tvs-cut-band"></div>' + side(c.a, 'a') + side(t, 't') + (r.hit ? '<div class="tvs-cut-slash"></div>' : '') +
      '<div class="tvs-cut-num' + (r.hit ? '' : ' miss') + '">' + (r.hit ? '−' + r.dmg + (r.killed ? '<small>격파</small>' : '') : '빗나감') + '<em>명중 ' + r.chance + '%</em>' + ((r.skills || []).length ? '<b class="tvs-cut-sk">✦ ' + r.skills.map(esc).join(' · ') + '</b>' : '') + '</div></div>';
  }
  function cutHtml(v) {
    var UL = global.DG.ultimate, uc = UL ? UL.cutFor(v, function (u) { return cutArt(v, u); }, function (u) { return nameOf(v, u); }, function () { if (cur === v) { render(); } }) : '';   // W-0456 필살 컷인이 먼저
    if (uc) { return uc; }
    var c = v.cut;
    if (!c || Date.now() - c.at > (skin() && art() ? 1300 : 1100)) { return ''; }
    if (skin() && art()) { return cutSkin(v, c); }
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
    if (v.ult && sel && global.DG.ultimate) { var ur = global.DG.ultimate.use(b, sel.uid, x, y); v.ult = false; if (ur.ok) { v.sel = null; settle(); } render(); return; }   // W-0456 필살 — 대상이 아니면 풀기만
    if (v.plot && sel) {   // W-0401 책략 — 불은 칸, 혼란·회복은 유닛
      var pr = v.plot === 'fire' ? T().fire(b, sel.uid, x, y) : (here ? T().plot(b, sel.uid, v.plot, here.uid) : { ok: false });
      v.plot = null;
      if (pr.ok) { v.sel = null; settle(); }
      render(); return;   // 대상이 아니면 책략만 풀고 끝 — 같은 누르기가 이동·공격으로 흘러가 행동을 써 버렸다
    }
    if (here && here.side === 'me') { v.sel = here.uid; v.plot = null; v.ult = false; render(); return; }
    if (here && here.side === 'foe' && sel) {
      var r = T().attack(b, sel.uid, here.uid);
      if (r.ok && r.hit && !(global.DG.tacticsView3d && global.DG.tacticsView3d.want()) && global.DG.core && global.DG.core.emit) { global.DG.core.emit('tac:hit', { kill: !!r.killed }); }   // W-0230 2D 판도 타격음(3D 는 맞는 순간에)
      if (r.ok) { v.cut = { a: sel, t: here, r: r, at: Date.now() }; setTimeout(function () { if (cur === v) { v.cut = null; render(); } }, skin() && art() ? 1320 : 1150); settle(); }
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
    v.foeBan = Date.now();   // W-0452 적군 차례 띠 → 아군 차례 띠
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
      else if (k === 'ult' && cur && global.DG.ultimate) { var UL = global.DG.ultimate, su = cur.sel ? T().unit(cur.b, cur.sel) : null; if (su && UL.kindOf(su) === 'chonggong') { if (UL.use(cur.b, su.uid, su.x, su.y).ok) { cur.sel = null; settle(); } } else { cur.ult = !cur.ult; cur.plot = null; } render(); }   // W-0456 총공격은 바로
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
    if (b.srpg) { T().unitsOfSrpg(b, opts.mine, opts.foes, opts.foeTroops, { mercs: opts.mercs, mercMul: opts.mercMul, mercN: opts.mercN }, opts.myTroops || []); } else { T().unitsOf(b, opts.mine, opts.foes, opts.foeTroops); }
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
