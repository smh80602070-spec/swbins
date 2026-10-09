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
 * 손잡이 `dg.belt2d` 0 이면 옛 아이소 그대로. 마을(room.kind 'town')·3D 는 손대지 않는다.
 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};

  function core() { return global.DG.core; }
  function on() { var C = core(); return !!(C && C.tuned ? C.tuned('dg.belt2d', 1) : 1); }

  /** 이 방을 벨트로 그릴까 — 2D 던전 방만 */
  function want(run) {
    return !!(on() && run && run.room && run.room.kind !== 'town' && run.player);
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
    var run = D.raw(), W = D.ROOM_W, H = D.ROOM_H;
    var L = layout(cv.clientWidth || 1, cv.clientHeight || 1, W, H, run && run.player ? run.player.x : W / 2, zoom, padBot);
    var m = { s: L.s, k: L.k, ox: 0, oy: 0, cw: L.cw, ch: L.ch, top: L.top, bot: L.bot, camX: L.camX, W: W, H: H };
    m.belt = function (x, y) { return { x: L.cw / 2 + (x - L.camX) * L.s, y: L.top + y * L.k }; };
    m.unbelt = function (px, py) { return { x: L.camX + (px - L.cw / 2) / L.s, y: (py - L.top) / L.k }; };
    m.ellipse = function (c, x, y, r) { var p = m.belt(x, y); c.ellipse(p.x, p.y, r * L.s, r * L.k, 0, 0, Math.PI * 2); return p; };
    return m;
  }

  function shade(hex, amt) {
    var h = String(hex || '#555').replace('#', ''), n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, t = amt < 0 ? 0 : 255, f = Math.abs(amt);
    return 'rgb(' + Math.round(r + (t - r) * f) + ',' + Math.round(g + (t - g) * f) + ',' + Math.round(b + (t - b) * f) + ')';
  }

  /** 무대 — 뒷벽·바닥 띠·좌우 벽·핏자국·문. icons = 문 종류 → 그림 글자(dungeon-view DOOR_ICON) */
  function stage(ctx, m, run, theme, now, gore, icons) {
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

  global.DG.belt2d = { on: on, want: want, layout: layout, metrics: metrics, stage: stage };
})(typeof window !== 'undefined' ? window : this);
