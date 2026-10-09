/**
 * 2D 던전 방 — 던전앤파이터식 벨트 스크롤 (W-0128)
 * ---------------------------------------------------------------
 * 옛 2D 는 방(700×440)을 아이소 마름모로 눕혀 그려 인물이 점처럼 섰다(사용자 10-09 "지금은 2d 넘 구림").
 * 이 파일은 **그림만** 바꾼다 — 방 좌표·판정(dungeon.js)은 그대로, dungeon-view 의 `proj()` 가 이 투영을 빌린다.
 *
 *   옆 시점   방 x → 화면 가로(배율 s), 방 y → 화면 아래 깊이 띠(쓸 높이의 42~92%, 납작하게 k)
 *   카메라    나를 가운데 두고 좌우로 흐르다 방 끝에서 멈춘다(방이 화면보다 좁으면 가운데)
 *   인물 크기 s = min(쓸 높이 × 0.0055, 폭 / 240) — 몸(40·s)이 화면 높이 ⅕ 안팎
 *   무대      뒷벽(테마 벽색 + 돌 타일 + 시차) · 바닥 띠(테마 바닥 타일) · 좌우 벽 · 핏자국 · 오른쪽 벽의 문
 *   배경 그림 `DG.cfg.mode2d.beltBg[테마 이름]` = mode2d 층 배경 지역 id 가 있으면 원·중·근 시차 층(K 몫, 없으면 벽색)
 *
 * 마을·들판(W-0131) — 방이 세계 좌표 그대로라 깊이 창(Hwin 440)이 나를 따라 위아래로도 흐른다(나는 창의 55%).
 *   마을은 발판 사각형(anchor + W×H) 안에서 멈추고, 들판(wild)은 멈추지 않는다. 띠 위는 하늘·먼 산 두 겹(시차), 띠는 화면 아래까지.
 * 손잡이 `dg.belt2d` 0 이면 옛 아이소 그대로(`dg.belt2dTown` 0 이면 마을·들판만 옛 아이소). 3D 는 손대지 않는다.
 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};

  function core() { return global.DG.core; }
  function on() { var C = core(); return !!(C && C.tuned ? C.tuned('dg.belt2d', 1) : 1); }

  function townOn() { var C = core(); return !!(C && C.tuned ? C.tuned('dg.belt2dTown', 1) : 1); }
  /** 이 방을 벨트로 그릴까 — 2D 던전 방, 그리고 마을·들판(W-0131) */
  function want(run) {
    return !!(on() && run && run.room && run.player && (run.room.kind !== 'town' || townOn()));
  }
  var HWIN = 440;
  /** 마을·들판 — 깊이 창이 나를 따라 흐른다. 순수 계산(진단이 부른다). ax·ay = 발판 원점, wild = 들판(멈춤 없음) */
  function layoutTown(cw, ch, W, H, px, py, ax, ay, wild, zoom, padBot) {
    var chUse = Math.max(120, ch - (padBot || 0));
    var s = Math.max(0.6, Math.min(chUse * 0.0055, cw / 240)) * (zoom || 1) * 0.78;   // 마을·들판은 조금 물러서 — 집·사람이 함께 보이게
    var top = chUse * 0.40, bot = chUse, k = (bot - top) / HWIN, half = cw / (2 * s), edge = 30, camX = px, y0 = py - HWIN * 0.55;
    if (!wild) {
      if (W + edge * 2 <= half * 2) { camX = ax + W / 2; } else { camX = Math.max(ax + half - edge, Math.min(ax + W - half + edge, px)); }
      if (H + 80 > HWIN) { y0 = Math.max(ay - 40, Math.min(ay + H - HWIN + 40, y0)); } else { y0 = ay + H / 2 - HWIN / 2; }
    }
    return { s: s, k: k, top: top, bot: bot, camX: camX, y0: y0, cw: cw, ch: ch, chUse: chUse, town: true };
  }

  /** 화면 → 배율·띠·카메라. 순수 계산(cw·ch·방 크기·나 x 만 본다) — 진단이 그대로 부른다 */
  function layout(cw, ch, W, H, px, zoom, padBot) {
    var chUse = Math.max(120, ch - (padBot || 0));
    var s = Math.max(0.6, Math.min(chUse * 0.0055, cw / 240)) * (zoom || 1);
    var top = chUse * 0.42, bot = chUse * 0.92, k = (bot - top) / H;
    var half = cw / (2 * s), edge = 30, camX;   // edge — 방 끝 벽·문이 화면 안에 들도록 카메라가 조금 더 간다
    if (W + edge * 2 <= half * 2) { camX = W / 2; } else { camX = Math.max(half - edge, Math.min(W - half + edge, px)); }
    return { s: s, k: k, top: top, bot: bot, camX: camX, cw: cw, ch: ch, chUse: chUse };
  }

  /** dungeon-view 의 metrics() 자리 — m.belt / m.unbelt / m.ellipse 를 단 객체 */
  function metrics(cv, D, zoom, padBot) {
    var run = D.raw(), W = D.ROOM_W, H = D.ROOM_H, town = run && run.room && run.room.kind === 'town', a = (run && run.anchor) || { x: 0, y: 0 };
    var L = town ? layoutTown(cv.clientWidth || 1, cv.clientHeight || 1, W, H, run.player.x, run.player.y, a.x, a.y, !!run.wild, zoom, padBot)
      : layout(cv.clientWidth || 1, cv.clientHeight || 1, W, H, run && run.player ? run.player.x : W / 2, zoom, padBot);
    var y0 = L.y0 || 0;
    var m = { s: L.s, k: L.k, ox: 0, oy: 0, cw: L.cw, ch: L.ch, top: L.top, bot: L.bot, camX: L.camX, y0: y0, town: !!town, px: run && run.player ? run.player.x : 0, py: run && run.player ? run.player.y : 0, W: W, H: H };
    m.belt = function (x, y) { return { x: L.cw / 2 + (x - L.camX) * L.s, y: L.top + (y - y0) * L.k }; };
    m.unbelt = function (px, py) { return { x: L.camX + (px - L.cw / 2) / L.s, y: y0 + (py - L.top) / L.k }; };
    m.ellipse = function (c, x, y, r) { var p = m.belt(x, y); c.ellipse(p.x, p.y, r * L.s, r * L.k, 0, 0, Math.PI * 2); return p; };
    return m;
  }

  function shade(hex, amt) {
    var h = String(hex || '#555').replace('#', ''), n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, t = amt < 0 ? 0 : 255, f = Math.abs(amt);
    return 'rgb(' + Math.round(r + (t - r) * f) + ',' + Math.round(g + (t - g) * f) + ',' + Math.round(b + (t - b) * f) + ')';
  }

  /** 먼 능선 높이 0..1 — 세계 x 의 순수 함수(사인 셋 합) */
  function ridge(x, seed) { return 0.5 + 0.22 * Math.sin(x * 0.0021 + seed) + 0.16 * Math.sin(x * 0.0057 + seed * 2.3) + 0.08 * Math.sin(x * 0.013 + seed * 4.1); }
  /** 마을·들판 무대 — 하늘 · 먼 산 두 겹(시차 0.12·0.3) · 화면 아래까지 땅 띠(테마 바닥 타일, 칸에 붙여 미끄러지지 않게) */
  function townStage(ctx, m, run, theme) {
    var M = global.DG.mode2d, cfg = (global.DG.cfg && global.DG.cfg.mode2d) || {}, cw = m.cw, s = m.s, x, i;
    var sky = ctx.createLinearGradient(0, 0, 0, m.top);
    sky.addColorStop(0, '#1b2233'); sky.addColorStop(0.65, '#3a4256'); sky.addColorStop(1, shade(theme.floor, -0.2));
    ctx.fillStyle = sky; ctx.fillRect(-30, -30, cw + 60, m.top + 32);
    [[0.12, 0.62, 1.7, shade(theme.wall, -0.62)], [0.3, 0.34, 4.2, shade(theme.floor, -0.5)]].forEach(function (L) {
      var par = L[0], hMax = m.top * L[1];
      ctx.fillStyle = L[3]; ctx.beginPath(); ctx.moveTo(-10, m.top + 2);
      for (x = -10; x <= cw + 10; x += 8) { ctx.lineTo(x, m.top - hMax * ridge((m.camX * s * par + x) / Math.max(0.4, s * par * 3), L[2])); }
      ctx.lineTo(cw + 10, m.top + 2); ctx.closePath(); ctx.fill();
    });
    var gr = ctx.createLinearGradient(0, m.top, 0, m.ch);
    gr.addColorStop(0, shade(theme.floor, -0.42)); gr.addColorStop(0.35, shade(theme.floor, -0.1)); gr.addColorStop(1, shade(theme.floor, 0.06));
    ctx.fillStyle = gr; ctx.fillRect(-10, m.top, cw + 20, m.ch - m.top + 10);
    if (M && M.fillIso) {
      ctx.save(); ctx.beginPath(); ctx.rect(-10, m.top, cw + 20, m.ch - m.top + 10); ctx.clip();   // 땅 타일이 하늘을 덮지 않게
      var U = 220, wx0 = Math.floor((m.camX - cw / (2 * s)) / U) * U - U, wy0 = Math.floor((m.y0 - 40) / U) * U, ww = cw / s + U * 3, hh = (m.ch - m.top) / m.k + U * 3;
      M.fillIso(ctx, { id: (cfg.tile || {})[theme.name] || 'dungeon_grass', a: s, b: 0, c: 0, d: m.k, e: cw / 2 + (wx0 - m.camX) * s, f: m.top + (wy0 - m.y0) * m.k, W: ww, H: hh, tint: theme.floor, tintAlpha: 0.8, unit: U });   // 무늬는 옅게(이끼 돌 결이 시끄러웠다)
      ctx.restore();
    }
    var hz = ctx.createLinearGradient(0, m.top - 6, 0, m.top + (m.bot - m.top) * 0.3);
    hz.addColorStop(0, 'rgba(20,24,34,0.75)'); hz.addColorStop(1, 'rgba(20,24,34,0)');
    ctx.fillStyle = hz; ctx.fillRect(-10, m.top - 6, cw + 20, (m.bot - m.top) * 0.3 + 6);
  }

  /** 들판 소품 종류(field3d.chunkAt t) → world2d 그림 [ids, 키(방 좌표 단위)] — 그림만(충돌은 판정이 이미 같은 배열로) */
  var PIECE = { tree: [['tree_pine_01', 'tree_broadleaf_01', 'tree_pine_02', 'tree_broadleaf_02', 'tree_birch_01'], 70], tree_dead: [['tree_dead_01'], 60], rock: [['rock_large_01', 'rock_moss_01', 'rock_large_02'], 22],
    reed: [['grass_tuft_02', 'grass_tuft_01'], 12], pond: [['pond_01'], 18], tent: [['tent_small_01'], 34], fire: [['campfire_logs_01'], 14], altar: [['altar_01'], 30],
    pillar: [['dungeon_pillar_01'], 46], wall: [['low_stone_wall_01', 'wall_piece_01'], 24], post: [['signpost_01'], 26], cavemouth: [['rock_outcrop_01'], 40] };
  function hs(x, y) { var n = (Math.round(x) * 374761393 + Math.round(y) * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  /** 보이는 들판 칸(200)의 소품 — { x, y(=z), id, h } 목록. dungeon-view 가 사람·적과 같은 깊이 정렬에 넣는다(앞 나무가 사람을 가리게) */
  function fieldItems(m) {
    var WM = global.DG.worldMap, F = global.DG.field3d, M = global.DG.mode2d;
    if (!m.town || !WM || !WM.pieces || !F || !M || !M.drawSprite) { return []; }
    var C = F.CHUNK || 200, half = m.cw / (2 * m.s), x0 = m.camX - half - 60, x1 = m.camX + half + 60, y0 = m.y0 - 120, y1 = m.y0 + (m.ch - m.top) / m.k + 60;
    var list = [], cx, cz, i, L, o, P;
    for (cz = Math.floor(y0 / C); cz <= Math.floor(y1 / C); cz++) {
      for (cx = Math.floor(x0 / C); cx <= Math.floor(x1 / C); cx++) {
        L = WM.pieces(cx, cz, m.W, m.H) || [];
        for (i = 0; i < L.length; i++) { o = L[i]; if (PIECE[o.t] && o.x >= x0 && o.x <= x1 && o.z >= y0 && o.z <= y1) { list.push(o); } }
      }
    }
    return list.map(function (q) { P = PIECE[q.t]; return { x: q.x, y: q.z, id: P[0][Math.floor(hs(q.x, q.z) * P[0].length)], h: P[1] * (q.s || 1) }; });
  }
  function drawPiece(ctx, m, o) {
    var p = m.belt(o.x, o.y), M = global.DG.mode2d;
    if (p.y < m.top - 4 || !M) { return false; }
    /* 내 앞에 서서 나를 가리는 소품은 비친다(던파 전경 소품처럼) */
    var cover = o.y > m.py && Math.abs(o.x - m.px) < o.h * 0.6 && o.y - m.py < o.h * 2.4;
    return M.drawSprite(ctx, { id: o.id, x: p.x, y: p.y, h: o.h * m.s, alpha: cover ? 0.38 : undefined });
  }

  /** 무대 — 뒷벽·바닥 띠·좌우 벽·핏자국·문. icons = 문 종류 → 그림 글자(dungeon-view DOOR_ICON) */
  function stage(ctx, m, run, theme, now, gore, icons) {
    if (m.town) { return townStage(ctx, m, run, theme); }
    var M = global.DG.mode2d, cfg = (global.DG.cfg && global.DG.cfg.mode2d) || {};
    var W = m.W, H = m.H, cw = m.cw, s = m.s, i;
    var x0 = m.belt(0, 0).x, x1 = m.belt(W, 0).x;
    var wallTop = 0;   // 벽은 화면 맨 위까지(폰 세로에서 위가 검게 비었다)

    /* 하늘·먼 어둠 — 방 밖 */
    var bg = ctx.createLinearGradient(0, 0, 0, m.ch);
    bg.addColorStop(0, '#07080b'); bg.addColorStop(1, '#0d0f14');
    ctx.fillStyle = bg; ctx.fillRect(-30, -30, cw + 60, m.ch + 60);

    /* 뒷벽 — 배경 그림(시차 층)이 있으면 그것, 없으면 테마 벽색 + 돌 타일 */
    var region = cfg.beltBg && theme && cfg.beltBg[theme.name];
    var drew = region && M && M.drawBg ? M.drawBg(ctx, { region: region, camX: m.camX * s, W: cw, H: m.top, base: m.top }) : false;
    if (!drew) {
      var wg = ctx.createLinearGradient(0, wallTop, 0, m.top);
      wg.addColorStop(0, shade(theme.wall, -0.55)); wg.addColorStop(0.7, shade(theme.wall, -0.18)); wg.addColorStop(1, shade(theme.wall, -0.35));
      ctx.fillStyle = wg; ctx.fillRect(x0, wallTop, x1 - x0, m.top - wallTop);
      var tid = (cfg.tile || {})[theme.name];
      if (tid && M && M.fillTile) {
        ctx.save(); ctx.globalAlpha = 0.45;
        M.fillTile(ctx, { id: tid, x: x0, y: wallTop, w: x1 - x0, h: m.top - wallTop, dx: (m.camX * s * 0.85) % 256, dy: 0, scale: 0.42 * s });
        ctx.restore();
      }
      /* 벽돌 줄눈 — 가로 줄은 벽 높이로, 세로 이음은 시차(0.85)로 흘러 깊이가 읽힌다 */
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1;
      var row = 26 * s * 0.55, colW = 54 * s * 0.55, r, y, xx, off;
      for (r = 0, y = m.top - row; y > wallTop; y -= row, r++) {
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        off = ((m.camX * s * 0.15) + (r % 2) * colW / 2) % colW;
        for (xx = x0 - off; xx < x1; xx += colW) { ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y + row); ctx.stroke(); }
      }
      /* 벽 아래 걸레받이 그림자 */
      var sk = ctx.createLinearGradient(0, m.top - 18 * s, 0, m.top);
      sk.addColorStop(0, 'rgba(0,0,0,0)'); sk.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = sk; ctx.fillRect(x0, m.top - 18 * s, x1 - x0, 18 * s);
    }

    /* 바닥 띠 — 테마 바닥 타일을 벨트 변환으로(가로 s · 세로 k), 앞쪽이 밝고 뒤쪽이 어둡다 */
    var fgr = ctx.createLinearGradient(0, m.top, 0, m.bot);
    fgr.addColorStop(0, shade(theme.floor, -0.35)); fgr.addColorStop(1, shade(theme.floor, 0.04));
    ctx.fillStyle = fgr; ctx.fillRect(x0, m.top, x1 - x0, m.bot - m.top);
    if (M && M.fillIso) {
      M.fillIso(ctx, { id: (cfg.tile || {})[theme.name], a: s, b: 0, c: 0, d: m.k, e: cw / 2 - m.camX * s, f: m.top, W: W, H: H, tint: theme.floor, tintAlpha: 0.45, unit: 120 });
    }
    var dk = ctx.createLinearGradient(0, m.top, 0, m.top + (m.bot - m.top) * 0.45);
    dk.addColorStop(0, 'rgba(0,0,0,0.5)'); dk.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = dk; ctx.fillRect(x0, m.top, x1 - x0, (m.bot - m.top) * 0.45);
    /* 앞 가장자리 — 화면 아래로 떨어지는 턱 */
    ctx.fillStyle = shade(theme.wall, -0.55); ctx.fillRect(x0, m.bot, x1 - x0, Math.max(0, m.ch - m.bot));
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x0, m.bot, x1 - x0, 2);

    /* 좌우 벽 — 방 끝이 화면 안에 들어오면 두꺼운 기둥벽 */
    var sideW = 26 * s;
    [[x0 - sideW, x0], [x1, x1 + sideW]].forEach(function (seg) {
      if (seg[1] < 0 || seg[0] > cw) { return; }
      var sg = ctx.createLinearGradient(seg[0], 0, seg[1], 0);
      sg.addColorStop(0, shade(theme.wall, -0.5)); sg.addColorStop(1, shade(theme.wall, -0.25));
      ctx.fillStyle = sg; ctx.fillRect(seg[0], wallTop, seg[1] - seg[0], m.ch - wallTop);
    });

    /* 핏자국 */
    for (i = 0; gore && i < gore.length; i++) {
      var g0 = gore[i];
      ctx.save(); ctx.globalAlpha = g0.a; ctx.fillStyle = g0.big ? '#4a0a06' : '#380806';
      for (var gj = 0; gj < 3; gj++) {
        ctx.beginPath(); m.ellipse(ctx, g0.x + (g0.s[gj] - 0.5) * g0.r * 1.6, g0.y + (g0.s[gj + 3] - 0.5) * g0.r * 1.6, g0.r * (0.45 + g0.s[gj] * 0.55)); ctx.fill();
      }
      ctx.restore();
    }

    /* 문 — 오른쪽 벽(x = W)의 그 깊이에 선 아치. 열리면 금빛 */
    var open = run.room.cleared;
    for (i = 0; i < run.room.doors.length; i++) {
      var dr = run.room.doors[i], foot = m.belt(W - 26, dr.y), dw = 46 * s * 0.8, dh = 74 * s * 0.8;
      var gx = foot.x - dw * 0.5, gy = foot.y - dh;
      ctx.fillStyle = open ? 'rgba(245,180,69,' + (0.5 + Math.sin(now / 300 + i) * 0.15) + ')' : 'rgba(60,60,70,0.85)';
      ctx.beginPath(); ctx.moveTo(gx, foot.y); ctx.lineTo(gx, gy + dw * 0.5); ctx.arc(gx + dw / 2, gy + dw * 0.5, dw / 2, Math.PI, 0); ctx.lineTo(gx + dw, foot.y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = shade(theme.wall, 0.15); ctx.lineWidth = Math.max(2, 3 * s * 0.5); ctx.stroke();
      ctx.font = Math.round(16 * s * 0.8 + 6) + 'px "Malgun Gothic", system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = open ? 1 : 0.5; ctx.fillStyle = '#fff';
      ctx.fillText((icons && icons[dr.kind]) || '⚔️', gx + dw / 2, gy + dh * 0.45);
      if (dr.title) { ctx.font = '700 ' + Math.round(8 * s * 0.8 + 7) + 'px "Malgun Gothic", system-ui'; ctx.fillStyle = '#f0d9a0'; ctx.fillText(dr.title, gx + dw / 2, gy - 8); }
      ctx.globalAlpha = 1;
    }
  }

  global.DG.belt2d = { on: on, want: want, layout: layout, layoutTown: layoutTown, HWIN: HWIN, ridge: ridge, PIECE: PIECE, fieldItems: fieldItems, drawPiece: drawPiece, metrics: metrics, stage: stage };
})(typeof window !== 'undefined' ? window : this);
