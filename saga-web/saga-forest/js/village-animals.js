/**
 * 3마을 짐승 자리 잡기 — village.js buildAnimals() 몸통을 떼어 냄(R-4 10-24). 글자 그대로, 바깥 것은 E 로 받는다:
 *   E.seed·W·H·TILE·CELL(BIOME_CELL)·margin(forestMargin)·biomeAt(tx,ty)·spaceBase(spaceBaseSpot())
 *   E.free(tx,ty) — 마을 시설(오두막 터·동굴·유적·우주기지) 밖이고 풀 계열 땅인가
 * 순수 함수(세이브·화면 안 건드림) — 같은 E 면 같은 짐승 목록. village.js 앞에 싣는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var VD = global.DG.villageData;
  /** 짐승 자리 잡기(PLAN 40절 PHASE 4 첫 칸) — BIOME_CELL 한 칸에 한 마리
   *  꼴로, 그 칸 바이옴에 사는 짐승 중 하나를 (좌표+seed 해시로) 고른다.
   *  절반이 넘는 칸은 비워 둔다 — 다 채우면 숲이 동물원이 된다. 마을·
   *  캠프·동굴 자리와 물 위에는 안 세운다. 거동(어슬렁·달아남)은
   *  animal.js 가 매 프레임 맡는다 — 여기서는 **터(home)만** 정한다 */
  function place(E) {
    var s = { seed: E.seed }, W = E.W, H = E.H, TILE = E.TILE, BIOME_CELL = E.CELL, biomeAt = E.biomeAt;
    var animals = [];
    var m = E.margin;
    var cxMin = Math.floor(-m / BIOME_CELL), cxMax = Math.ceil((W + m) / BIOME_CELL);
    var cyMin = Math.floor(-m / BIOME_CELL), cyMax = Math.ceil((H + m) / BIOME_CELL);
    var cx, cy;
    for (cy = cyMin; cy <= cyMax; cy++) {
      for (cx = cxMin; cx <= cxMax; cx++) {
        var tx = cx * BIOME_CELL + Math.floor(BIOME_CELL / 2);
        var ty = cy * BIOME_CELL + Math.floor(BIOME_CELL / 2);
        if (tx >= -m && ty >= -m && tx < W + m && ty < H + m &&
            !(tx >= 0 && ty >= 0 && tx < W && ty < H) &&
            E.free(tx, ty)) {
          var hgate = core.hash2(cx * 211 + s.seed % 701, cy * 179 + (s.seed >> 4) % 659);
          if (hgate > 0.55) { continue; }              // 칸의 절반 넘게는 비워 둔다
          var biome = biomeAt(tx, ty);
          var pool = [], k;
          for (k in VD.ANIMALS) {
            if (VD.ANIMALS.hasOwnProperty(k) && !VD.ANIMALS[k].rare &&
                VD.ANIMALS[k].biomes.indexOf(biome) >= 0) { pool.push(k); }
          }
          if (!pool.length) { continue; }
          var hpick = core.hash2(cx * 97 + 3, cy * 131 + 5);
          var kind = pool[Math.floor(hpick * pool.length) % pool.length];
          /* 몬스터(2026-09-10) — 일반 뽑기 뒤에 아주 드물게만(8%) 덮어쓴다.
             새 난수 스트림 없이 다른 좌표 계수의 hash2 하나만 더 쓴다 —
             기존 hgate·hpick 흐름은 그대로라 여우 등 기존 짐승 수·자리는
             안 흔들린다(그 칸이 몬스터로 바뀔 때만 대신 선다) */
          var monKind = VD.MONSTER_BIOME && VD.MONSTER_BIOME[biome];
          if (monKind) {
            var hmon = core.hash2(cx * 53 + 17 + s.seed % 331, cy * 61 + 29 + (s.seed >> 3) % 293);
            if (hmon < 0.08) { kind = monKind; }
          }
          var wx = tx * TILE + TILE * 0.5, wy = ty * TILE + TILE * 0.5;
          animals.push({ id: 'a' + cx + '_' + cy, kind: kind, x: wx, y: wy,
                         home: { x: wx, y: wy }, facing: 1, state: 'idle', aim: null, pause: 0 });
        }
      }
    }
    /* 우주기지 전용 희귀 몬스터(2026-09-14, PLAN 46-4 "다음에 이어갈 것" —
       Enemy_*, 성간충). 우주기지(spaceBaseSpot)는 BIOME_CELL(22칸)보다 작은
       자리(7×7)라 위 격자 뽑기에는 안 걸린다 — courier NPC(§45)와 같은
       방식(고정 위치, 세이브 시드별 확률)으로 따로 심는다. 새 전투는
       없다(다른 짐승과 같은 idle/wander/flee) */
    var sb2 = E.spaceBase;
    if (sb2 && VD.ANIMALS.spacebug) {
      var hbug = core.hash2((s.seed % 733) + 11, ((s.seed >> 5) % 691) + 19);
      if (hbug < 0.4) {
        var sbx2 = sb2.tx * TILE + TILE * 0.5, sby2 = sb2.ty * TILE + TILE * 0.5;
        var bx = sbx2 + TILE * 0.6, by = sby2 + TILE * 2.3;
        animals.push({ id: 'spacebug', kind: 'spacebug', x: bx, y: by,
                       home: { x: bx, y: by }, facing: 1, state: 'idle', aim: null, pause: 0 });
      }
    }

    /* 짐승 무리(PLAN §5.5 ①) — 격자 칸 하나가 "무리" 로 뽑히면 그 바이옴 짐승 셋이 모여 선다.
       위 BIOME_CELL 뽑기와 별개(같은 흐름·난수를 안 건드려 기존 짐승 수·자리는 그대로) */
    var GRDH = global.DG.grid;
    if (GRDH) {
      GRDH.herds().forEach(function (hc) {
        var pool = [], k;
        for (k in VD.ANIMALS) {
          if (VD.ANIMALS.hasOwnProperty(k) && !VD.ANIMALS[k].rare && VD.ANIMALS[k].biomes.indexOf(hc.biome) >= 0) { pool.push(k); }
        }
        if (!pool.length) { return; }
        var hk = pool[Math.floor(core.hash2(hc.cx * 83 + 1 + s.seed % 353, hc.cy * 79 + 2) * pool.length) % pool.length];
        var offs = [[-1.2, 0], [1.2, 0.6], [0, -1.2]], oi;
        for (oi = 0; oi < offs.length; oi++) {
          var hx = (hc.tx + 0.5 + offs[oi][0]) * TILE, hy = (hc.ty + 0.5 + offs[oi][1]) * TILE;
          animals.push({ id: 'ah' + hc.key + '_' + oi, kind: hk, x: hx, y: hy,
                         home: { x: hx, y: hy }, facing: 1, state: 'idle', aim: null, pause: 0 });
        }
      });
    }
    return animals;
  }

  global.DG = global.DG || {};
  global.DG.villageAnimals = { place: place };
})(window);
