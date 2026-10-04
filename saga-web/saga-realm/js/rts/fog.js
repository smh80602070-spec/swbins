/**
 * RTS 전장 안개 (W-0062) — 화면 층. 규칙(길찾기·교전·습격)은 안 건드린다.
 *   시야  내 거점·건물·유닛 둘레(원)만 보인다. 한 번 본 땅은 "봤던 곳"(어둡게)으로 남고, 못 본 땅은 검다.
 *   가림  적 유닛은 보이는 칸에서만 그린다. 적 기지는 한 번 본 뒤에야 그린다(봤던 곳이면 서 있는 채로).
 *   그림  지도 한 칸 = 한 픽셀짜리 작은 캔버스 하나를 확대해 얹는다(가장자리가 부드럽게 번진다) — 본 화면·미니맵이 같이 쓴다.
 * 저장하지 않는다 — 불러오면 거점 둘레만 다시 열린다. 주소 `?fog=0` 이면 끈다(시험용).
 */
(function (global) {
  'use strict';

  var W = 160, H = 100;
  var B_R = { castle: 10, tower: 8, barracks: 5, house: 4, market: 4, workshop: 4, farm: 3, well: 3, wall: 2 };   // 건물 시야(칸). 길은 없다
  var U_R = { soldier: 6, archer: 7, cavalry: 8, hero: 8 };

  function R() { return global.DG.rts; }
  function create() { return { seen: new Uint8Array(W * H), vis: new Uint8Array(W * H), cv: null, rev: 0 }; }

  function reveal(f, cx, cy, r) {
    var x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r)), x, y, k, r2 = r * r;
    for (y = y0; y <= y1; y++) {
      for (x = x0; x <= x1; x++) {
        if ((x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy) <= r2) { k = y * W + x; f.vis[k] = 1; f.seen[k] = 1; }
      }
    }
  }

  /** 지금 시야를 다시 센다. 바뀐 칸이 있으면 true */
  function update(f, s) {
    var D = R().rules.DEFS, prev = f.vis.slice(0), id, b, d, u, r, k, changed = false;
    f.vis.fill(0);
    for (id in s.buildings) {
      b = s.buildings[id]; d = D[b.t]; r = B_R[b.t];
      if (!r || +id < 0) { continue; }
      reveal(f, b.x + d.w / 2, b.y + d.h / 2, r);
    }
    for (id in s.units) { u = s.units[id]; if (u.team === 0) { reveal(f, u.x, u.y, U_R[u.t] || 6); } }
    for (k = 0; k < W * H; k++) { if (prev[k] !== f.vis[k]) { changed = true; break; } }
    if (changed || !f.cv) { paint(f); f.rev++; }
    return changed;
  }

  /** 안개 그림 — 못 본 곳 짙게, 봤던 곳 옅게, 보이는 곳 투명 */
  function paint(f) {
    var doc = global.document, im, x, k, a;
    if (!doc) { return; }
    if (!f.cv) { f.cv = doc.createElement('canvas'); f.cv.width = W; f.cv.height = H; f.im = f.cv.getContext('2d').createImageData(W, H); }
    im = f.im;
    for (k = 0, x = 0; k < W * H; k++, x += 4) {
      a = f.vis[k] ? 0 : (f.seen[k] ? 120 : 238);
      im.data[x] = 6; im.data[x + 1] = 8; im.data[x + 2] = 14; im.data[x + 3] = a;
    }
    f.cv.getContext('2d').putImageData(im, 0, 0);
  }

  function idx(x, y) { return Math.floor(y) * W + Math.floor(x); }
  function inB(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
  /** 지금 보이는 칸인가 */
  function visibleAt(f, x, y) { return inB(x, y) && f.vis[idx(x, y)] === 1; }
  /** 한 번이라도 본 칸인가 */
  function seenAt(f, x, y) { return inB(x, y) && f.seen[idx(x, y)] === 1; }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.fog = { create: create, update: update, visibleAt: visibleAt, seenAt: seenAt, B_R: B_R, U_R: U_R };
})(typeof window !== 'undefined' ? window : this);
