/**
 * 1만리 3D 칸 계획 — 격자 하나에 무엇이 몇 개 서는가(도심도 urbanity·소품 목록 propPlan). world3d.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * 순수 함수 — three 를 안 쓴다(자가진단이 계획만 따로 굴린다). 바깥에서 받는 것은 world3d.js 가 bind 로 넘기는
 * GRID·h1(해시)·DENSITY·LAND_PAINT·WET·weatherKey·PF(성능 배율) 손잡이뿐. world3d.js 는 같은 이름 한 줄 넘김(DG.world3d.propPlan 그대로).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var GRID = 48, h1, DENSITY, LAND_PAINT, WET, weatherKey, PF;
  function bind(h) { GRID = h.GRID; h1 = h.h1; DENSITY = h.DENSITY; LAND_PAINT = h.LAND_PAINT; WET = h.WET; weatherKey = h.weatherKey; PF = h.PF; return api; }
  var api = null;
  /** 땅 전용 퓨전 소품이 설 칸의 몫(§5 ⑰ 넷째) — 0 이면 안 세운다 */
  function ZP_RATE() { return core.tuned('world3d.zoneProps', 0.16); }

  /** 이 격자가 얼마나 번화한가 (0 변두리 ~ 1 도심) */
  function urbanity(gx, gy) {
    /* 넓은 무늬 하나와 잔무늬 하나를 겹친다 — 하나만 쓰면 시가지가 바둑판이 된다 */
    var broad = h1(Math.floor(gx / 5) * 131 + 7, Math.floor(gy / 5) * 197 + 11);
    var fine = h1(gx * 31 + 3, gy * 57 + 5);
    return Math.min(1, broad * 0.72 + fine * 0.42);
  }

  /**
   * 격자 하나에 무엇을 세울지. 좌표만 보고 정하는 **순수 함수**다.
   * 돌려주는 것은 부품 목록 — x·z 는 격자 한가운데 기준(±GRID/2).
   *   house  기와집 (w·d·h, roof 있음)   tower 높은 집
   *   tree   나무    rock 바위   grass 풀덤불   lamp 등롱   water 수면   reed 갈대
   */
  function propPlan(kind, gx, gy, mapped, densAt) {
    var out = [], i, n;
    var u = urbanity(gx, gy);
    var dens = densAt != null ? densAt : DENSITY();
    var half = GRID * 0.42;
    /* 이 격자를 손으로 그린 땅이 맡고 있나 (`land.js`) — 맡은 자리는
       지도에 없는 땅이라 지도가 깔려 있어도 제 지형을 세워야 한다 */
    var RG = global.DG.land;
    var authored = !!(RG && RG.owns(gx, gy));
    /* 젖은 날인가 — 비·눈이면 물이 분다. 화면에만 쓰는 값이다 */
    var wk0 = weatherKey();
    var wet = WET() && (wk0 === 'rain' || wk0 === 'snow');
    /* 손으로 그린 땅이 번화도를 못박아 두었으면 그것을 쓴다 — 작은 마을에
       탑이 솟지 않게 하는 것이 여기다 */
    if (authored) {
      var lu = RG.urbanity(gx, gy);
      if (lu !== null) { u = lu; }
    }
    function spot(seed) {
      return {
        x: (h1(gx * 3 + seed * 13, gy * 7 + seed * 5) * 2 - 1) * half,
        z: (h1(gx * 11 + seed * 3, gy * 17 + seed * 29) * 2 - 1) * half
      };
    }

    if (kind === 'town') {
      n = Math.round((1 + u * 7) * dens);
      /* 마을 배치 — 여태는 칸 안에서 자리·각도 다 완전히 독립된 해시라 "아무렇게나
         흩어 놓은" 것처럼 보였다(2026-09-04, "지형·배치가 어색하다" 지적).
         이제 ① 각도는 **가장 가까운 길**(terrainAt 의 tx%7·ty%9 격자길)에 맞춰
         정렬하고 살짝만 흔들고, ② 자리는 칸을 작은 대지(lot)로 나눠 한 대지에
         한 채씩 앉힌다(대지 안에서만 살짝 흔든다) — 완전히 격자로 딱딱하지
         않게, 옛 마을 골목처럼 살짝 어긋나되 "지어진" 티가 나게 한다.
         집 자체의 위치·판정(houseRects)은 이 함수를 그대로 다시 부르므로
         따로 손댈 것이 없다 — 순수 함수라 자리가 바뀌면 판정도 저절로 따라온다 */
      /* 2026-09-04 — 동네마다 길 축을 하나로 가른 뒤(`W.roadIsVertical`,
         "바둑판" 고침) 부터는 "더 가까운 축"이 아니라 **이 동네에서 실제로
         길이 되는 축**에 맞춰야 한다 — 안 그러면 이 동네엔 없는 축(가상의
         길)을 보고 집이 돈다 */
      var baseRot = global.DG.world.roadIsVertical(gx, gy) ? 0 : Math.PI / 2;
      var lotArea = GRID * 0.82;
      var cols = Math.max(1, Math.ceil(Math.sqrt(n)));
      var rows = Math.max(1, Math.ceil(n / Math.max(1, cols)));
      var lotW = lotArea / cols, lotD = lotArea / rows;
      for (i = 0; i < n; i++) {
        var col = i % cols, row = Math.floor(i / cols);
        var lotX = (col + 0.5) / cols * lotArea - lotArea / 2;
        var lotZ = (row + 0.5) / rows * lotArea - lotArea / 2;
        /* 2026-09-10 — "바둑판 같다" 재지적("삼각형·둥근 라인"·"각을 랜덤으로"·
           "지도 건물 배치처럼"). 대지를 줄·칸으로 나눈 것 자체는 그대로 두되
           (허물면 겹침·충돌 판정을 다시 다 맞춰야 한다), **줄마다 엇갈리게**
           밀어 칸 하나가 "완전한 격자"로 안 보이게 한다 — 벽돌쌓기와 같은
           원리, 옛 마을 골목이 신도시 아파트 단지처럼 안 보이는 이유가 이것이다.
           방향은 칸마다 해시로 갈라 옆 칸과 같은 쪽으로만 안 쏠리게 한다 */
        if (row % 2 === 1) {
          var staggerDir = h1(gx * 41 + row * 7, gy * 43 + row * 5) > 0.5 ? 1 : -1;
          lotX += lotW * 0.3 * staggerDir;
        }
        var jx = (h1(gx * 3 + i * 13, gy * 7 + i * 5) - 0.5) * lotW * 0.5;
        var jz = (h1(gx * 11 + i * 3, gy * 17 + i * 29) - 0.5) * lotD * 0.5;
        var hh = h1(gx * 13 + i, gy * 19 + i * 3);
        var tall = u > 0.62 && hh > 0.55;
        var w = 5 + hh * (tall ? 5 : 7);
        out.push({
          t: tall ? 'tower' : 'house',
          x: lotX + jx, z: lotZ + jz,
          w: w, d: w * (0.8 + hh * 0.5),
          h: tall ? (12 + hh * 22) * (0.6 + u * 0.8) : 4 + hh * 4,
          /* 각도 흔들림 폭을 0.5→0.7로 넓혔다(사용자가 직접 "각을 랜덤으로
             변경" 요청) — baseRot(길 방향)에서 너무 멀어지면 집이 길과
             동떨어져 보이므로 상한은 둔다 */
          rot: baseRot + (h1(gx + i * 7, gy - i * 5) - 0.5) * 0.7,
          shade: 0.30 + hh * 0.46,
          roof: !tall
        });
      }
      /* 번화할수록 길가에 등롱이 늘어선다 — 밤 화면이 여기서 살아난다 */
      n = u > 0.45 ? 2 : 1;
      for (i = 0; i < n; i++) {
        var ls = spot(30 + i);
        out.push({ t: 'lamp', x: ls.x, z: ls.z, h: 3.2 + h1(gx + i, gy + i) * 1.2 });
      }
      /* 우물·장터 — 마을에 하나씩만 서야 랜드마크로 보인다(집처럼 흔하면
         눈에 안 띈다). 번화한 칸일수록 드물게 세운다 */
      if (u > 0.35 && h1(gx * 23 + 5, gy * 29 + 7) > 0.86) {
        var wsp = spot(200);
        out.push({ t: 'well', x: wsp.x, z: wsp.z, h: 1.25 });
      }
      if (u > 0.5 && h1(gx * 31 + 9, gy * 37 + 3) > 0.90) {
        var msp = spot(210);
        out.push({ t: 'market', x: msp.x, z: msp.z, h: 1.3,
                   rot: h1(gx * 3 + 1, gy * 5 + 2) * Math.PI * 2 });
      }
    } else if (kind === 'forest') {
      n = Math.round((3 + h1(gx * 7 + 5, gy * 11 + 3) * 5) * dens);
      for (i = 0; i < n; i++) {
        var fs = spot(i + 40);
        out.push({ t: 'tree', x: fs.x, z: fs.z, h: 5 + h1(gx + i * 5, gy + i * 7) * 7 });
      }
      if (h1(gx * 5, gy * 3) > 0.6) {
        var frs = spot(70);
        out.push({ t: 'rock', x: frs.x, z: frs.z, h: 1.4 + h1(gx, gy) * 1.6 });
      }
    } else if (kind === 'mount') {
      out.push({ t: 'peak', x: 0, z: 0, h: 14 + h1(gx * 3 + 1, gy * 5 + 2) * 22 });
      n = Math.round(2 * dens);
      for (i = 0; i < n; i++) {
        var ms = spot(i + 80);
        out.push({ t: 'rock', x: ms.x, z: ms.z, h: 1.8 + h1(gx + i, gy + i * 3) * 2.6 });
      }
    } else if (kind === 'water') {
      /* **지도가 깔렸으면 물은 이미 지도에 칠해져 있다.** 그 위에 원반을 또 깔면
         지도에 없는 자리에 호수가 떠서 그림이 어긋난다 — 절차적 사물이 맡을 것은
         지도에 없는 **높이**뿐이다. 갈대는 높이라서 남긴다 */
      /* 다만 **손으로 그린 땅**(`land.js`)의 강은 지도에 없는 물이다 —
         지도가 깔려 있어도 여기서 수면을 깔지 않으면 강이 아예 안 보인다 */
      /* **비가 오면 강물이 분다**(PLAN 21절 "강물 수위 변화") — 수면이 올라오고
         조금 넓어진다. 화면에만 쓰는 값이라 건너는 판정은 한 줄도 안 바뀐다 */
      /* 2026-09-07: `LAND_PAINT()`도 물을 켜는 조건에 넣었다 — 위 "지도가
         칠해 준다"는 전제가 2026-09-04 감사 이전 얘기였다. 그 감사 이후로는
         `LAND_PAINT()`가 켜져 있으면(기본값) `terrainTexture()`가 실제 지도
         대신 **제 손으로 칠한 텍스처**를 까는데, 그 함수는 `water`를 일부러
         뺐다("실제 물결은 water3d.js가 따로 그리므로" — 428행 주석). 그런데
         이 조건은 `mapped`(지도 타일이 오는지)만 보고 있어서, 지도가 오긴
         오지만 `LAND_PAINT()`가 그 위를 덮어 버리는 흔한 경우(기본 설정
         그대로)에 **아무도 물을 안 그리는 구멍**이 났다 — 절차적 물 지형이
         밋밋한 단색 사각형(테두리도 각짐)으로만 보이던 원인. 자가진단·
         `_demo.html`로는 늘 `LAND_PAINT()` 기본값(켜짐)에서 보므로 이
         구멍이 회귀 시험에 안 걸렸다. */
      if (!mapped || authored || LAND_PAINT()) {
        /* 2026-09-07: 이어진 강(`sq`, 손으로 그린 물)은 칸을 꽉 채우는 네모라
           물가가 격자에 딱 맞춰 각져 보였다 — 원반(고립된 웅덩이)은 이미
           둥글어 괜찮으니 네모 쪽만 다듬는다. **어느 변이 물가(뭍과 닿음)고
           어느 변이 강물끼리 이어지는지**를 미리 재 둔다(`buildProp`이
           `shoreGeo(mask)`로 그 변만 들쭉날쭉 깎는다) — 물끼리 이어지는 변은
           안 깎아야 두 칸이 빈틈없이 맞물린다(비트: 1=동·2=서·4=북·8=남,
           `gx±1`→동서·`gy±1`→남북과 실제로 맞는지는 `world3d.js`의
           `rotation.x=-90°` 변환식을 손으로 풀어 확인했다). */
        var shoreMask = 0;
        if (authored) {
          var W3t = global.DG.world;
          if (!W3t || W3t.terrainAt(gx + 1, gy) !== 'water') { shoreMask |= 1; }
          if (!W3t || W3t.terrainAt(gx - 1, gy) !== 'water') { shoreMask |= 2; }
          if (!W3t || W3t.terrainAt(gx, gy - 1) !== 'water') { shoreMask |= 4; }
          if (!W3t || W3t.terrainAt(gx, gy + 1) !== 'water') { shoreMask |= 8; }
        }
        out.push({ t: 'water', x: 0, z: 0, h: 0, sq: authored, rise: wet ? 1 : 0, shore: shoreMask });
      }
      /* 물이 불면 갈대가 잠긴다 — 물만 올리고 갈대를 그대로 두면 물 위에 떠 있다 */
      n = h1(gx * 9, gy * 13) > 0.5 ? 3 : 1;
      if (wet) { n = Math.max(0, n - 2); }
      for (i = 0; i < n; i++) {
        var ws = spot(i + 90);
        out.push({ t: 'reed', x: ws.x, z: ws.z,
                   h: (1.2 + h1(gx + i, gy) * 1.0) * (wet ? 0.7 : 1) });
      }
    } else if (kind === 'road') {
      /* 길 — 여태 아무것도 없었다. 길가에 등롱과 나무가 서야 길로 보인다.
         `terrainAt` 은 tx%7===0(세로길, 남북) 이거나 ty%9===0(가로길, 동서)
         이면 이 칸을 길로 낸다 — 여태는 **늘 세로길인 것처럼** 등롱을 고정된
         x 자리에만 세웠다(가로길에서는 등롱이 길과 나란히가 아니라 어긋난
         자리에 섰다는 뜻). 2026-09-04 "배치가 어색하다" 감사로 발견 — 어느
         쪽 조건으로 길이 됐는지 갈라 각각 제 방향으로 세운다(교차로는 둘 다) */
      var roadV = (gx % 7 + 7) % 7 === 0, roadH = (gy % 9 + 9) % 9 === 0;
      /* 이 칸이 실제로 길 격자(위 조건)에 안 걸려도 'road'로 불릴 수 있다 —
         이 함수는 좌표만 보고 짓는 순수 함수라, 부르는 쪽이 임의의 좌표에
         강제로 'road'를 물어도(자가진단이 그렇게 한다) 등롱은 늘 서야 한다.
         그때는 옛 기본값(세로길 모양)으로 물러난다 */
      if (!roadV && !roadH) { roadV = true; }
      if (roadV) {
        out.push({ t: 'lamp', x: -half * 0.8, z: (h1(gx, gy) * 2 - 1) * half, h: 3.4 });
        if (h1(gx * 3 + 2, gy * 5 + 1) > 0.45) {
          out.push({ t: 'lamp', x: half * 0.8, z: (h1(gy, gx) * 2 - 1) * half, h: 3.4 });
        }
      }
      if (roadH) {
        out.push({ t: 'lamp', x: (h1(gx + 1, gy + 1) * 2 - 1) * half, z: -half * 0.8, h: 3.4 });
        if (h1(gx * 5 + 1, gy * 3 + 2) > 0.45) {
          out.push({ t: 'lamp', x: (h1(gy + 2, gx + 2) * 2 - 1) * half, z: half * 0.8, h: 3.4 });
        }
      }
      if (h1(gx * 21, gy * 11) > 0.62) {
        var rs = spot(60);
        out.push({ t: 'tree', x: rs.x, z: rs.z, h: 4 + h1(gx, gy) * 3 });
      }
    } else if (kind === 'farm') {
      /* 논밭 — 손으로 그린 땅이 들고 온 것이다. 물 댄 뙈기를 낮게 깔고 두렁으로 나눈다.
         뙈기는 **네모라서** 사람이 갈아 놓은 티가 난다 — 들의 둥근 풀덤불과 갈린다 */
      n = Math.round((2 + h1(gx * 3 + 7, gy * 5 + 11) * 2) * dens);
      for (i = 0; i < n; i++) {
        var ds = spot(i + 130);
        var fw = 11 + h1(gx + i, gy + i * 3) * 9;
        var fd = 9 + h1(gy + i, gx + i * 5) * 8;
        out.push({ t: 'field', x: ds.x, z: ds.z, w: fw, d: fd,
                   rot: h1(gx * 5 + i, gy * 7 + i) * 0.5 - 0.25 });
        /* **벼를 심는다.** 뙈기 안에 골고루 — 가운데로 몰면 논이 빈 채로 보인다.
           못 받으면 벼만 안 서고 논은 그대로다(되돌림이 저절로 된다) */
        var rn = Math.round(5 * dens), rj;
        for (rj = 0; rj < rn; rj++) {
          var ra = h1(gx * 7 + rj * 5 + i, gy * 11 + rj * 3 + i * 2);
          var rb = h1(gx * 13 + rj * 3 + i * 7, gy * 5 + rj * 11 + i);
          out.push({ t: 'rice',
                     x: ds.x + (ra * 2 - 1) * fw * 0.36,
                     z: ds.z + (rb * 2 - 1) * fd * 0.36,
                     h: 1.4 + ra * 0.7 });
        }
      }
      if (h1(gx * 17 + 3, gy * 13 + 5) > 0.5) {
        var cs = spot(150);
        out.push({ t: 'scare', x: cs.x, z: cs.z, h: 2.2 });
      }
    } else {                                   // grass — 빈 들
      n = Math.round((h1(gx * 41, gy * 23) * 3) * dens * (PF('prop') > 0.3 ? core.tuned('world3d.grassMul', 4) : 1));   // W-0200 빈 들 풀포기 ×4(48m 칸에 0~3 포기라 땅이 비었다) — LOW(prop 0.25)는 옛 무게 그대로
      for (i = 0; i < n; i++) {
        var gs = spot(i + 100);
        out.push({ t: 'grass', x: gs.x, z: gs.z, h: 0.7 + h1(gx + i, gy - i) * 0.6 });
      }
      if (h1(gx * 7 + 9, gy * 3 + 4) > 0.86) {
        var grs = spot(120);
        out.push({ t: 'rock', x: grs.x, z: grs.z, h: 1.2 + h1(gx, gy) * 1.4 });
      }
    }

    /* 손으로 못박아 둔 것 — 다리·굴 입구·무너진 기둥·옛 사당. 해시가 만든 것 **위에**
       얹는다. 자리가 정해져 있으니 격자 한가운데다(찾아가는 표적이라 흔들리면 안 된다) */
    var mk = RG ? RG.markAt(gx, gy) : null;
    if (mk === 'bridge') {
      /* 다리 — 받아 온 모델은 **한 칸짜리**라 강(격자 48m)을 못 건넌다.
         남북으로 이어 놓는다(길이 남북이므로 상판도 남북이다).
         **첫 칸만 `seg` 가 없다** — 모델을 못 받았을 때 도형 다리가 일곱 겹
         겹쳐 서지 않도록, 도형은 그 한 칸만 옛 모습(48m 상판)으로 그린다 */
      /* **키가 곧 이음매다.** 이 모델은 키 1 로 눕히면 깊이가 0.76 이라,
         칸 간격(`GRID/bn`)과 같아지려면 키를 그만큼 잡아야 한다 —
         짧게 잡았더니 아치 사이가 벌어져 사다리처럼 보였다(눈으로 보고 고쳤다) */
      var bn = 7, bj, bh = (GRID / bn) / 0.76;
      for (bj = 0; bj < bn; bj++) {
        out.push({ t: 'bridge', x: 0, z: (bj - (bn - 1) / 2) * (GRID / bn),
                   h: bh, seg: bj });
      }
    }
    else if (mk === 'cave') { out.push({ t: 'cave', x: 0, z: 0, h: 7 }); }
    else if (mk === 'ruin') { out.push({ t: 'ruin', x: 0, z: 0, h: 4.5 }); }
    else if (mk === 'shrine') { out.push({ t: 'shrine', x: 0, z: 0, h: 5 }); }
    else if (mk === 'waterfall') { out.push({ t: 'waterfall', x: 0, z: 0, h: 16 }); }   // PLAN 44절
    /* 옛 사원 — 손그린 땅에 **딱 한 칸**뿐인 특별 랜드마크(2026-09-11).
       shrine·cave·ruin과 같은 결로 markAt 이 답할 때만 세운다 */
    else if (mk === 'temple') { out.push({ t: 'temple', x: 0, z: 0, h: 18 }); }
    /* 지형 설계(landform.js, §5 ⑰) — 여울 다리(강을 가로질러 rot 방향으로 이어 놓는다)·발원지 폭포.
       그림은 위 손그림 땅의 다리·폭포 모델 그대로다. 다리 모델은 실은 이끼 바위(디딤돌, prop3d `bridge`)라
       **줄만** 강을 가로지르게 놓고 바위 하나하나의 돌림은 해시에 맡긴다(같은 쪽을 보면 되풀이가 드러난다) */
    var LFp = !mk ? global.DG.landform : null, lmk = LFp && LFp.markAt ? LFp.markAt(gx, gy) : null;
    if (lmk && lmk.t === 'bridge') {
      var lsl = GRID / 7, lbn = Math.max(5, Math.ceil(lmk.span / lsl)), lbh = lsl / 0.76, lj;
      var ltx = Math.sin(lmk.rot), ltz = Math.cos(lmk.rot);
      for (lj = 0; lj < lbn; lj++) {
        var la = (lj - (lbn - 1) / 2) * lsl;
        out.push({ t: 'bridge', x: lmk.ox + ltx * la, z: lmk.oz + ltz * la, h: lbh, seg: lj });
      }
    } else if (lmk && lmk.t === 'waterfall') {
      out.push({ t: 'waterfall', x: lmk.ox, z: lmk.oz, h: 16, rot: lmk.rot });
    }

    /* 땅 전용 퓨전 소품(PLAN §5 ⑰ 넷째 · SAGA-DESIGN §13) — 이름 있는 땅(biome.js ZONES `props`)의 들·숲
       칸 가운데 ZP_RATE 만큼에 하나. 제 색깔(main) 60% · 다른 시대(mix) 40% — 한 땅 안에 과거·현대·미래가
       다 선다. 손그림 땅·고향·마을·길·물·산은 뺀다. 자리·종류 모두 칸 해시(난수 0) */
    if (!authored && (kind === 'grass' || kind === 'forest') && ZP_RATE() > 0) {
      var BMz = global.DG.biome, P3z = global.DG.prop3d;
      var zz = BMz && BMz.on() && P3z && P3z.FUSION ? BMz.zoneAt((gx + 0.5) * GRID, (gy + 0.5) * GRID) : null;
      if (zz && zz.props && h1(gx * 13 + 7, gy * 19 + 3) < ZP_RATE()) {
        var zl = h1(gx * 5 + 1, gy * 23 + 9) < 0.4 ? zz.props.mix : zz.props.main;
        var zk = zl[Math.floor(h1(gx * 31 + 2, gy * 7 + 11) * zl.length) % zl.length], zs = spot(211);
        if (P3z.FUSION[zk]) { out.push({ t: 'zp_' + zk, x: zs.x, z: zs.z, h: P3z.FUSION[zk].h }); }
      }
    }

    /* 손으로 **놓은** 것(`land.js` deco — 맵 편집기 "3D 배치"가 고친다). 제 자리·키·돌림 그대로
       해시 소품 위에 얹는다. 이 계획을 거치므로 집·탑·우물·장터는 벽 충돌(`houseRects`)도
       저절로 따라온다(마을 칸이 아닌 곳에 놓은 것도 — `houseRects` 가 그 칸의 deco 만 따로 본다) */
    if (authored && RG.decoAt) {
      var dk = RG.decoAt(gx, gy);
      for (i = 0; i < dk.length; i++) { out.push(dk[i]); }
    }

    return out;
  }

  api = { bind: bind, propPlan: propPlan, urbanity: urbanity, ZP_RATE: ZP_RATE };
  global.DG = global.DG || {};
  global.DG.world3dPlan = api;
})(typeof window !== 'undefined' ? window : this);
