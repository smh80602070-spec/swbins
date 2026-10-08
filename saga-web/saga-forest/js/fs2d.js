/**
 * 사가마을 2D — 나무·소나무·바위 그림 고르기 (W-0114, K-0083 ③ 그림체 C `world2d`)
 * ---------------------------------------------------------------
 * village-view.js 는 큰 파일이라(tools/big-files.txt) 그림 고르기는 여기 두고 거기선 기존 줄 안에서 부른다.
 *   tree(계절)  활엽수 tree_broadleaf_01(여름)·_spring·_autumn·_winter
 *   pine(계절)  소나무 tree_pine_01 · 겨울 tree_pine_01_snow
 *   drawRock(ctx, x, y, k, se)  바위 rock_small_01·rock_large_01·rock_moss_01(자리 해시) — 그렸으면 true
 * 돌려주는 Image 에는 `__h`(그릴 높이, k 단위)를 단다 — 256px 그림이라 원본 폭 × 배율 대신 높이 기준.
 * 그림이 없거나(이름표에 없음·2D 시험 전) 아직 안 왔으면 null/false — village-view 는 옛 Kenney 픽셀 그림으로 그린다.
 */
(function (global) {
  'use strict';

  var H = { tree: 58, pine: 92, rock_small_01: 22, rock_large_01: 34, rock_moss_01: 28 };
  var ROCKS = ['rock_small_01', 'rock_large_01', 'rock_moss_01'];
  var cache = {};

  function img(id, h) {
    var A = global.DG && global.DG.assets3d, u = A && A.spriteUrl ? A.spriteUrl(id) : null;
    if (!u) { return null; }
    var im = cache[u];
    if (!im) { im = new Image(); im.src = u; im.__h = h; cache[u] = im; }
    return im.complete && im.naturalWidth ? im : null;
  }
  function tree(key) {
    var id = key === 'spring' ? 'tree_broadleaf_01_spring' : key === 'autumn' ? 'tree_broadleaf_01_autumn' : key === 'winter' ? 'tree_broadleaf_01_winter' : 'tree_broadleaf_01';
    return img(id, H.tree);
  }
  function pine(key) { return img(key === 'winter' ? 'tree_pine_01_snow' : 'tree_pine_01', H.pine); }
  function drawRock(ctx, x, y, k, se) {
    var n = Math.abs(Math.round(x * 7 + y * 13)) % ROCKS.length, id = ROCKS[n], im = img(id, H[id]);
    if (!im) { return false; }
    var dh = im.__h * k, dw = dh * im.naturalWidth / im.naturalHeight;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(im, x - dw / 2, y - dh + 2 * k, dw, dh);
    if (se && se.key === 'winter') { ctx.globalAlpha = 0.35; ctx.fillStyle = '#eef6f9'; ctx.beginPath(); ctx.ellipse(x, y - dh * 0.72, dw * 0.32, dh * 0.12, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    return true;
  }

  global.DG = global.DG || {};
  global.DG.fs2d = { tree: tree, pine: pine, drawRock: drawRock, H: H };
})(window);
