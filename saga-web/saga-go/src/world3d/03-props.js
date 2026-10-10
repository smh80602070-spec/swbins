  /* ── 건물 · 나무 — 무엇이 몇 개 서는가 ───────────────────
   * 지도 타일에는 **높이가 없다.** 원작의 도시 감각은 건물이 서 있는 데서 오므로,
   * 지형 격자(`terrainAt`, 48m)를 보고 절차적으로 세운다.
   *
   * 1단계는 격자마다 상자 두셋을 세우는 게 전부였다 — 어느 동네나 똑같이 성겼다.
   * 이제 **격자마다 도심도(都心度)를 뽑아** 밀도를 가른다: 번화한 칸은 높은 집이
   * 여덟 채까지 들어차고, 변두리는 낮은 집 두엇에 나무가 섞인다. 길가에는 등롱을
   * 세우고 빈 들에도 풀·바위를 둔다 — 아무것도 없는 칸이 있으면 그 자리가 구멍처럼 보인다.
   *
   * **자리는 좌표 해시라 같은 땅이면 늘 같다.** 스폰·역참이 그런 것과 같은 규칙이다.
   * 이 함수는 three 를 안 쓴다 — 자가진단이 계획만 따로 굴려 본다.
   */
  var GRID = 48;
  /* 이 거리부터 배우를 키운다 (m) — 그 안쪽은 눈에 보이는 그대로 */
  var FAR_NEAR = 45, FAR_MAX = 4;

  /* 이 판의 core.hash2 는 0~0.5 만 돌려준다(world.js 주석 참고) — 두 배로 편다 */
  function h1(a, b) { return Math.min(0.999999, core.hash2(a, b) * 2); }
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
      n = Math.round((h1(gx * 41, gy * 23) * 3) * dens);
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

  /**
   * 이 칸에 선 **집·높은 집·우물·장터**의 충돌 사각형 — `world.js` 의 벽 충돌과
   * 교전 무대(`duelStage`·`camAim` 의 `duel` 구도)가 함께 쓴다(PLAN 27절,
   * 2026-08-30 우물·장터로 넓힘).
   *
   * **판정에 화면 값을 들이는 유일한 자리다.** 이 저장소는 여태 "화면은 판정에
   * 안 닿는다"를 지켜 왔지만(땅의 높낮이·손으로 그린 강 등), 벽 충돌만은 **눈에
   * 보이는 그 소품과 어긋나면 의미가 없다** — 사용자가 직접 고른 값이다(2026-08-29).
   * `propPlan` 은 순수 함수이므로 여기서도 **같은 좌표·같은 크기**가 나온다.
   *
   * 우물·장터는 `w`·`d`(가로·세로)가 따로 없다 — 크기가 아니라 `h`(키)만 갖고
   * 도는 소품이라, 실제 GLB 모델 발판 크기에 가깝게 `h` 에서 어림잡는다.
   * 정확한 값은 아니지만(모델 자체를 재지는 않는다), **집이 아닌 것에도
   * 카메라·발이 박히던 문제**(2026-08-30, 밀집 마을에서 교전 카메라가 우물/
   * 장터에 박힌 것을 실제로 찍어서 발견했다)를 없애는 데는 이 정도로 충분하다.
   */
  var FOOT_IN = 0.82;       // 모델 바닥 가운데 벽이 서는 몫(처마·지붕 끝 빼고)
  function houseRects(gx, gy) {
    /* 해시로 벽이 되는 소품(집·탑·우물·장터)을 세우는 건 마을 칸뿐이다. 다른 칸은
       손으로 놓은 것(`land.js` deco)만 — 여태는 칸 종류를 안 보고 늘 마을 계획을
       뽑아서, 들판에서도 교전 상대가 **안 보이는 집**을 피해 밀려났고(`duelSpotBlocked`),
       `world.js` 는 마을 칸만 재서 들판에 놓은 deco 집은 뚫고 지나갔다(2026-09-23) */
    var Wd = global.DG.world, RG = global.DG.land;
    var kind = Wd && Wd.terrainAt ? Wd.terrainAt(gx, gy) : 'town';
    /* 2026-09-28 실기 Q3 "몇 집이 벽에서 사라진다" — 기기가 버거우면 perf 가 밀도(PF prop)를 내리는데, 이미 지은 칸은
       다시 안 지어(칸 열쇠에 밀도가 없다) 옛 집이 그대로 보이고 벽만 새 밀도로 집 수·대지가 바뀌었다 → 지은 밀도로 뽑는다 */
    var plan = kind === 'town' ? propPlan('town', gx, gy, false, townDens[gx + ':' + gy])
      : (RG && RG.decoAt ? RG.decoAt(gx, gy) : []);
    var ox = gx * GRID + GRID / 2, oz = gy * GRID + GRID / 2;
    var out = [], i;
    for (i = 0; i < plan.length; i++) {
      var p = plan[i];
      if (p.t === 'house' || p.t === 'tower') {
        var P3h = global.DG.prop3d, hm = P3h && P3h.heightMul ? P3h.heightMul(p.t) : 1, hh = (p.h || 6) * hm;
        /* 2026-09-27 실기 "집을 통과하네 아직도" — 헤드리스로 재 보니 둘이 어긋났다.
           ① 크기: GLB 는 키(hh)로 고르게 늘여 그려 바닥이 p.w·p.d 보다 1.4~2.2배 넓다 → 그 자리 모델의 바닥(prop3d.footprint)
              × hh × FOOT_IN(처마·지붕 끝은 밑으로 걸어 다닌다). 모델이 아직 안 왔으면 옛 p.w·p.d
           ② 돌림: 모델은 rotation.y = rot 로 서는데 벽 사각형 식(lx = dx·cos + dz·sin)은 반대 방향으로 돈다 → -rot */
        var fp = P3h && P3h.footprint && P3h.houseOn && P3h.houseOn() ? P3h.footprint(p.t, gx + Math.round(p.x), gy + Math.round(p.z), undefined, propEra(p.t, ox + p.x, oz + p.z)) : null;
        var fw = fp ? Math.max(p.w, fp.w * hh * FOOT_IN) : p.w, fd = fp ? Math.max(p.d, fp.d * hh * FOOT_IN) : p.d;
        out.push({ x: ox + p.x, z: oz + p.z, w: fw, d: fd, rot: -(p.rot || 0), h: hh });
      } else if (p.t === 'well') {
        out.push({ x: ox + p.x, z: oz + p.z, w: p.h * 1.6, d: p.h * 1.6, rot: 0 });
      } else if (p.t === 'market') {
        out.push({ x: ox + p.x, z: oz + p.z, w: p.h * 2.8, d: p.h * 1.8, rot: p.rot || 0 });
      }
    }
    var FRh = global.DG.frost;                                   // §5 ⑲-27 서리봉 고원 명소 벽(산성 담·관측소·비행선…)
    if (FRh && FRh.rectsIn) { var frr = FRh.rectsIn(gx, gy); for (i = 0; i < frr.length; i++) { out.push(frr[i]); } }
    var SPh = global.DG.skyport;                                 // §5 ⑲-37 은하 나루 명소 벽(계류 탑·객차·틈 문…)
    if (SPh && SPh.rectsIn) { var spr = SPh.rectsIn(gx, gy); for (i = 0; i < spr.length; i++) { out.push(spr[i]); } }
    var AMh = global.DG.amber;                                   // §5 ⑲-57 굳은 거리 명소 벽(결정 막·굳은 자리·시계방·장터 돔·부양탑 심…)
    if (AMh && AMh.rectsIn) { var amr = AMh.rectsIn(gx, gy); for (i = 0; i < amr.length; i++) { out.push(amr[i]); } }
    var VTh = global.DG.vault;                                   // §5 ⑲-61 갈무리 벌 명소 벽(빛 울타리·금고 둥근 벽·동력 기둥·곳간·창고·컨테이너…)
    if (VTh && VTh.rectsIn) { var vtr = VTh.rectsIn(gx, gy); for (i = 0; i < vtr.length; i++) { out.push(vtr[i]); } }
    var FKh = global.DG.fork;                                    // §5 ⑲-65 세갈래 고을 명소 벽(호박 장막·문루·성벽·대장간·기관차·종루·격자 말뚝…)
    if (FKh && FKh.rectsIn) { var fkr = FKh.rectsIn(gx, gy); for (i = 0; i < fkr.length; i++) { out.push(fkr[i]); } }
    var CRh = global.DG.crossing;                                // §5 ⑲-41 틈새 갈림길 명소 벽(시계탑·성문 기둥·틈 문…)
    if (CRh && CRh.rectsIn) { var crr = CRh.rectsIn(gx, gy); for (i = 0; i < crr.length; i++) { out.push(crr[i]); } }
    var SKh = global.DG.sunken;                                  // §5 ⑲-44 잠긴 도읍 명소 벽(정전·돔 둘레·등대·해무 문…)
    if (SKh && SKh.rectsIn) { var skr = SKh.rectsIn(gx, gy); for (i = 0; i < skr.length; i++) { out.push(skr[i]); } }
    var ESh = global.DG.eraSites;                                // §5 ⑲-34 3부 시대 명소 벽(조선소 창고·기중기 다리)
    if (ESh && ESh.rectsIn) { var err = ESh.rectsIn(gx, gy); for (i = 0; i < err.length; i++) { out.push(err[i]); } }
    return out;
  }

  /* 사물의 도형은 **단위 하나씩만** 만들어 배율로 늘린다.
     크기마다 새 도형을 만들면 격자를 지날 때마다 GPU 메모리가 늘어난다. */
  var unit = {};
  function unitGeo(name) {
    if (unit[name]) { return unit[name]; }
    var g;
    if (name === 'box') { g = new T.BoxGeometry(1, 1, 1); }
    else if (name === 'cyl') { g = new T.CylinderGeometry(0.5, 0.5, 1, 8); }
    else if (name === 'cone4') { g = new T.ConeGeometry(0.72, 1, 4); }
    else if (name === 'cone') { g = new T.ConeGeometry(0.5, 1, 7); }
    else if (name === 'sph') { g = new T.SphereGeometry(0.5, 8, 6); }
    else if (name === 'plane') { g = new T.PlaneGeometry(1, 1); }
    else if (name === 'disc') { g = new T.CircleGeometry(1, 20); }   // W-0140 원반 물은 거품을 안 단다 — 원반끼리 겹쳐 놓여 테두리가 물 한가운데 고리로 떴다(촬영으로 확인)
    else if (name.indexOf('shoreW') === 0) { g = shoreGeo(+name.slice(6)); }
    unit[name] = g;
    return g;
  }
  /** 물가 전용 평면(PLAN 부록, "물가 경계도 자연스럽게", 2026-09-07) — 단위
   *  사각형(-0.5~0.5)을 잘게 나누고, `mask`(1=동·2=서·4=북·8=남, `rotation.x=
   *  -90°` 뒤집기를 손으로 풀어 확인한 값)에 켜진 변의 바깥 테두리 정점만
   *  안쪽으로 들쭉날쭉 밀어 넣는다. **꺼진 변(강물끼리 이어지는 자리)은 손
   *  안 댄다** — 옆 칸의 같은 변도 똑같이 안 밀리므로 두 칸이 자로 잰 듯
   *  맞물린다(따로 자리를 맞출 필요가 없다). 마스크당 하나씩만 지어 `unit`에
   *  얹으므로(최대 16장) `box()`의 배율·자리로 그대로 쓸 수 있고, 다른 도형과
   *  같은 값이라 뒤에서 따로 dispose 할 것이 없다(1226행 "도형·재질은 모두가
   *  나눠 쓰는 것" 원칙 그대로). */
  function shoreGeo(mask) {
    var SEG = 10, EAST = 1, WEST = 2, NORTH = 4, SOUTH = 8;
    var g = new T.PlaneGeometry(1, 1, SEG, SEG);
    var pos = g.getAttribute('position');
    var AMP_MIN = 0.07, AMP_RANGE = 0.10, foamA = new Float32Array(pos.count);   // W-0140 foamA — 물가 변에서 0.25 안쪽까지 1→0
    for (var i = 0; i < pos.count; i++) {
      var lx = pos.getX(i), ly = pos.getY(i), nx = lx, ny = ly;
      if ((mask & EAST) && Math.abs(lx - 0.5) < 1e-6) {
        nx = 0.5 - (AMP_MIN + h1(i * 7 + 3, mask * 11 + 1) * AMP_RANGE);
      }
      if ((mask & WEST) && Math.abs(lx + 0.5) < 1e-6) {
        nx = -0.5 + (AMP_MIN + h1(i * 5 + 9, mask * 13 + 2) * AMP_RANGE);
      }
      if ((mask & NORTH) && Math.abs(ly - 0.5) < 1e-6) {
        ny = 0.5 - (AMP_MIN + h1(i * 3 + 17, mask * 17 + 3) * AMP_RANGE);
      }
      if ((mask & SOUTH) && Math.abs(ly + 0.5) < 1e-6) {
        ny = -0.5 + (AMP_MIN + h1(i * 11 + 23, mask * 19 + 4) * AMP_RANGE);
      }
      if (nx !== lx || ny !== ly) { pos.setXY(i, nx, ny); } foamA[i] = Math.max(0, (mask & EAST) ? 1 - (0.5 - lx) / 0.25 : 0, (mask & WEST) ? 1 - (lx + 0.5) / 0.25 : 0, (mask & NORTH) ? 1 - (0.5 - ly) / 0.25 : 0, (mask & SOUTH) ? 1 - (ly + 0.5) / 0.25 : 0);
    }
    pos.needsUpdate = true; g.setAttribute('foam', new T.BufferAttribute(foamA, 1));
    g.computeVertexNormals();
    return g;
  }
  /* 바람 흔들림(PLAN 44절) — 잎·풀·갈대에만 쓰는 재질에 정점 셰이더를 조금
     보탠다. Lambert 의 조명·안개·톤매핑 조각은 손 안 댄다(`#include <begin_vertex>`
     **뒤**에서 자리만 살짝 민다) — `water3d.js` 가 그랬듯 안개를 빼먹으면 안 되므로,
     여기는 안개 조각째 그대로 두고 자리만 보탠 것이다.
     인스턴스마다 다른 위상을 줘야 한 덩이가 통째로 같이 흔들리지 않는다 —
     새 attribute 를 안 늘리려고 `instanceMatrix` 의 이동칸을 씨앗 삼아 해시를 만든다.
     GLB(진짜 모델)에는 안 쓴다 — trunk/leaf 조각이 안 갈려 있어 뿌리까지 흔들리면
     어색하고, 색으로 캐시하는 `prop3d.matCache` 를 건드리면 우연히 같은 색인
     다른 사물까지 흔들릴 수 있다(LOD 밖의 도형 나무·풀만 흔든다) */
  var swayShaders = [], swayClock = 0;
  function swayify(m) {
    m.onBeforeCompile = function (shader) {
      shader.uniforms.uSwTime = { value: swayClock };
      shader.uniforms.uSwAmt = { value: SWAY_AMT() };
      shader.vertexShader = 'uniform float uSwTime;\nuniform float uSwAmt;\n' +
        shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n' +
          '#ifdef USE_INSTANCING\n' +
          '  float swPhase = dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719));\n' +
          '#else\n' +
          '  float swPhase = 0.0;\n' +
          '#endif\n' +
          '  float swLift = (transformed.y + 0.5) * uSwAmt;\n' +
          '  transformed.x += sin(uSwTime * 1.6 + swPhase) * swLift;\n' +
          '  transformed.z += cos(uSwTime * 1.3 + swPhase) * swLift * 0.6;\n');
      swayShaders.push(shader);
    };
    /* 흔들리는 것과 안 흔들리는 재질은 **다른 프로그램**이다 — 캐시 키를 안 가르면
       three 가 컴파일된 프로그램을 서로 나눠 쓰려다 하나만 남는다 */
    m.customProgramCacheKey = function () { return 'sway'; };
  }

  var propMat = {};
  function pmat(hex, opt) {
    var key = hex + '|' + (opt || '');
    if (propMat[key]) { return propMat[key]; }
    var m = new T.MeshLambertMaterial({ color: new T.Color(hex), flatShading: opt === 'flat' });
    /* 수면은 **깊이를 안 적는다** — 적으면 물속에 있는 것(잉어)을 통째로 가린다.
       반투명이라 비쳐 보여야 맞는데, 깊이 버퍼가 먼저 잘라내 아무것도 안 남았다 */
    if (opt === 'water') {
      /* 물결치는 수면이 있으면 그것을 쓴다(`water3d.js`). 없거나 등급이 LOW 면
         null 이 와서 **여태 쓰던 판 한 장**으로 간다 — 그림만 어제로 돌아간다 */
      var wm = global.DG.water3d ? global.DG.water3d.material(T, hex) : null;
      if (wm) { propMat[key] = wm; return wm; }
      m.transparent = true; m.opacity = 0.72; m.depthWrite = false;
    }
    if (opt === 'glow') { m.emissive = new T.Color(hex); m.emissiveIntensity = 0.9; }
    if (opt === 'sway') { swayify(m); }
    /* 연기는 **낱개가 저마다 다른 짙기로 사라졌다 다시 짙어진다** — 재질을
       나눠 쓰면 한 알의 짙기가 바뀔 때 다른 알까지 같이 바뀐다. 그래서
       여기서는 원판만 캐시해 두고, 부르는 쪽(`addLampSmoke`)이 매번 복제해
       쓴다(연기 알갱이 수가 적어 복제 비용이 무시할 만하다) */
    if (opt === 'smoke') { m.transparent = true; m.opacity = 0.32; m.depthWrite = false; }
    /* 폭포 물줄기 — 'water' 와 달리 **세워 놓는 판**이라 water3d 의 수평 수면
       셰이더를 그대로 못 쓴다(그쪽은 위에서 내려다보는 잔물결이 전제다).
       옅은 하늘색 반투명 판 하나로 그친다(PLAN 44절) */
    if (opt === 'fall') { m.transparent = true; m.opacity = 0.5; m.depthWrite = false; }
    propMat[key] = m;
    return m;
  }
  function box(g, geoName, mtl, x, y, z, sx, sy, sz, cast) {
    var m = new T.Mesh(unitGeo(geoName), mtl);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    if (cast) { m.castShadow = true; }
    g.add(m);
    return m;
  }

  /* ── 인스턴싱 (PLAN 16절) ───────────────────────────────
   * 잔 사물은 **같은 도형에 같은 색**이다 — 나무 백 그루가 저마다 자기 Mesh 를
   * 들고 있을 까닭이 없다. 종류마다 `InstancedMesh` 한 덩이를 두고 **자리(slot)만
   * 빌려 준다.** 격자가 사라지면 자리를 돌려받는다.
   *
   * **집·탑·다리는 안 묶는다.** 크기와 색이 제각각이라 한 덩이로 못 모으고,
   * 수도 적어 이득이 없다. 16절이 지목한 것도 "나무·돌·풀·꽃" 이다.
   *
   * 잎 색은 계절이 바꾸므로 **색이 이름의 일부**다 — 가을이 되면 새 덩이가 하나
   * 생기고 옛 덩이는 빈 채로 남는다(넷뿐이라 그냥 둔다).
   */
  function INST_ON() { return core.tuned('world3d.instanced', 1) ? true : false; }
  function INST_CAP() { return core.tuned('world3d.instCap', 1600); }
  /* GLB 조각은 도형이 무거워 창고를 작게 잡는다 — 모양이 여럿이라 나눠 쓴다 */
  function GLB_CAP() { return core.tuned('world3d.glbCap', 260); }

  var instKinds = {};      // 이름 → {mesh, free:[], n, mat, live, sph, ...}
  var instOf = {};         // 격자 키 → [{name, slot}]

  function instBox(name, geoName, hex, opt, cast) {
    return instMake(name, unitGeo(geoName), pmat(hex, opt), cast);
  }

  /** 도형과 재질을 받아 덩이 하나를 만든다 (도형은 `unitGeo` 든 GLB 조각이든 같다) */
  function instMake(name, geo, mtl, cast, cap) {
    if (instKinds[name]) { return instKinds[name]; }
    cap = cap || INST_CAP();
    var m = new T.InstancedMesh(geo, mtl, cap);
    m.name = 'inst:' + name;                // §6.1-B ① 재기(triBreakdown)가 이름으로 가려 본다
    m.instanceMatrix.setUsage(T.DynamicDrawUsage);
    m.castShadow = !!cast;
    m.receiveShadow = false;
    m.frustumCulled = false;          // 자리가 온 세상에 흩어져 있어 상자로 못 자른다 → instCull 이 자리마다 자른다
    var free = [], i;
    for (i = cap - 1; i >= 0; i--) { free.push(i); }
    /* **보이는 것만 그린다.** 자리(slot)의 행렬은 `mat` 에 따로 적어 두고, 매 프레임
       `instCull` 이 카메라·그림자 상자에 걸린 자리만 `instanceMatrix` 앞쪽에 채워
       `count` 를 그 수로 둔다. 전에는 "가장 높이 쓴 자리 + 1" 까지 다 그려서, 격자가
       사라져 크기 0 으로 숨긴 빈 자리와 등 뒤 소품까지 그렸다 — 폰 점검(2026-09-25)
       에서 삼각형 743만 중 살아 있는 것 258만, 시야 안 7만이었다(수풀 한 포기 2.7만) */
    if (!geo.boundingSphere) { geo.computeBoundingSphere(); }
    var bs = geo.boundingSphere;
    m.count = 0;
    propGroup.add(m);
    instKinds[name] = {
      mesh: m, free: free, n: 0, hi: 0,
      mat: new Float32Array(cap * 16),   // 자리마다 행렬
      live: new Uint8Array(cap),         // 자리가 차 있나
      sph: new Float32Array(cap * 4),    // 자리마다 월드 구(중심 xyz·반지름)
      c0: bs.center.clone(), r0: bs.radius, dirty: true
    };
    return instKinds[name];
  }

  var _p = null, _q = null, _s = null, _m4 = null;
  /** 자리 하나를 빌린다 — 창고가 다 차면 false 를 주고, 부르는 쪽이 옛 길로 간다 */
  function instPut(key, name, geoName, hex, opt, cast, x, y, z, sx, sy, sz, rx, ry, rz) {
    return instAt(instBox(name, geoName, hex, opt, cast), key, name,
                  x, y, z, sx, sy, sz, rx, ry, rz);
  }

  /** 덩이 하나에 자리를 하나 적는다 */
  function instAt(K, key, name, x, y, z, sx, sy, sz, rx, ry, rz) {
    if (!K.free.length) { return false; }
    var slot = K.free.pop();
    if (!_p) { _p = new T.Vector3(); _q = new T.Quaternion(); _s = new T.Vector3(); _m4 = new T.Matrix4(); }
    _p.set(x, y, z);
    _q.setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0));
    _s.set(sx, sy, sz);
    _m4.compose(_p, _q, _s);
    _m4.toArray(K.mat, slot * 16);
    K.live[slot] = 1;
    _p.copy(K.c0).applyMatrix4(_m4);
    K.sph[slot * 4] = _p.x; K.sph[slot * 4 + 1] = _p.y; K.sph[slot * 4 + 2] = _p.z;
    K.sph[slot * 4 + 3] = K.r0 * Math.max(Math.abs(sx), Math.abs(sy), Math.abs(sz));
    K.dirty = true;
    if (slot + 1 > K.hi) { K.hi = slot + 1; }
    K.n++;
    if (!instOf[key]) { instOf[key] = []; }
    instOf[key].push({ name: name, slot: slot });
    return true;
  }

  /** 이 격자가 빌린 자리를 다 돌려받는다 */
  function instDrop(key) {
    var list = instOf[key];
    if (!list) { return 0; }
    for (var i = 0; i < list.length; i++) {
      var K = instKinds[list[i].name];
      if (!K) { continue; }
      K.live[list[i].slot] = 0;
      K.dirty = true;
      K.free.push(list[i].slot);
      K.n--;
    }
    delete instOf[key];
    return list.length;
  }

  /**
   * 자리마다 자른다 — 카메라 시야(안개 끝 너머는 안개 색뿐이라 뺀다) 또는
   * 그림자 상자에 걸린 자리만 `instanceMatrix` 앞쪽에 채운다. 화질은 그대로다:
   * 빼는 것은 **화면에도 그림자에도 안 닿는 것**뿐이다. 그림자 상자는 해를 따라
   * 움직이므로 렌더러가 할 계산(`shadow.updateMatrices`)을 한 번 먼저 한다.
   * 카메라·해가 그대로고 자리도 안 바뀌었으면 아무것도 안 올린다(가만히 서 있을 때).
   */
  var cullCam = null, cullSun = null, cullPV = null, cullSV = null, cullLastPV = null, cullLastSV = null;
  var cullStat = { live: 0, drawn: 0, frames: 0 };
  function inFr(fr, x, y, z, r) {
    var pl = fr.planes;
    for (var i = 0; i < 6; i++) {
      var n = pl[i].normal;
      if (n.x * x + n.y * y + n.z * z + pl[i].constant < -r) { return false; }
    }
    return true;
  }
  function instCull() {
    if (!camera || !propGroup) { return; }
    if (!cullCam) {
      cullCam = new T.Frustum(); cullSun = new T.Frustum();
      cullPV = new T.Matrix4(); cullSV = new T.Matrix4();
      cullLastPV = new T.Matrix4(); cullLastSV = new T.Matrix4();
    }
    camera.updateMatrixWorld();
    cullPV.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    cullCam.setFromProjectionMatrix(cullPV);
    var shadowOn = !!(renderer.shadowMap.enabled && sun && sun.castShadow);
    if (shadowOn) {
      sun.updateMatrixWorld();
      sun.target.updateMatrixWorld();
      sun.shadow.updateMatrices(sun);
      cullSV.copy(sun.shadow.matrix);
      cullSun.copy(sun.shadow.getFrustum());
    }
    var moved = !cullPV.equals(cullLastPV) || (shadowOn && !cullSV.equals(cullLastSV));
    cullLastPV.copy(cullPV); cullLastSV.copy(cullSV);
    var fog = scene.fog && scene.fog.isFog ? scene.fog.far : 0;
    var cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    propGroup.updateMatrixWorld();
    var gw = propGroup.matrixWorld.elements;
    var ox = gw[12], oy = gw[13], oz = gw[14];   // 소품 무리는 돌지도 늘지도 않는다(월드 미터) — 옮김만 본다
    var live = 0, drawn = 0, k;
    for (k in instKinds) {
      if (!Object.prototype.hasOwnProperty.call(instKinds, k)) { continue; }
      var K = instKinds[k];
      live += K.n;
      if (!K.dirty && !moved) { drawn += K.mesh.count; continue; }
      var cast = shadowOn && K.mesh.castShadow;
      var arr = K.mesh.instanceMatrix.array, sp = K.sph, j = 0, i;
      for (i = 0; i < K.hi; i++) {
        if (!K.live[i]) { continue; }
        var x = sp[i * 4] + ox, y = sp[i * 4 + 1] + oy, z = sp[i * 4 + 2] + oz, r = sp[i * 4 + 3];
        var see = inFr(cullCam, x, y, z, r);
        if (see && fog) {
          var dx = x - cx, dy = y - cy, dz = z - cz, lim = fog + r;
          if (dx * dx + dy * dy + dz * dz > lim * lim) { see = false; }
        }
        if (!see && !(cast && inFr(cullSun, x, y, z, r))) { continue; }
        arr.set(K.mat.subarray(i * 16, i * 16 + 16), j * 16);
        j++;
      }
      K.mesh.count = j;
      if (j) {
        var im = K.mesh.instanceMatrix;
        if (im.clearUpdateRanges) { im.clearUpdateRanges(); im.addUpdateRange(0, j * 16); }
        im.needsUpdate = true;
      }
      K.dirty = false;
      drawn += j;
    }
    cullStat.live = live; cullStat.drawn = drawn; cullStat.frames++;
  }

  /** 지금 몇 덩이에 몇 자리가 차 있나 — 진단·데모가 값으로 본다 */
  function instStats() {
    var out = { on: INST_ON(), cap: INST_CAP(), kinds: 0, used: 0, by: {} };
    for (var k in instKinds) {
      if (!Object.prototype.hasOwnProperty.call(instKinds, k)) { continue; }
      out.kinds++; out.used += instKinds[k].n; out.by[k] = instKinds[k].n;
    }
    return out;
  }

  /**
   * 잔 사물을 인스턴스로 세운다 — 세웠으면 true.
   * 좌표는 **월드 미터**다(격자 Group 안이 아니라 세상에 바로 놓기 때문).
   */
  /**
   * **GLB 소품** 하나를 세운다 (`prop3d.js`).
   * 나무 한 그루는 줄기와 잎이 다른 재질이라 조각이 둘이다 — 조각마다 덩이를
   * 하나씩 두고 **같은 행렬을 다 적는다.** 화면에서는 한 그루로 보인다.
   *
   * 아직 안 왔으면 false 를 주고, 부르는 쪽이 여태 쓰던 도형으로 간다.
   */
  /* W-0119 땅 시대(고향 = 과거) — 집·등롱·우물만 */ function propEra(want, x, z) { var Bz = global.DG.biome, zn = (want === 'house' || want === 'lamp' || want === 'well') && Bz && Bz.zoneAt ? Bz.zoneAt(x, z) : undefined; return zn === undefined ? null : (zn && zn.era) || 'past'; }  function instGlb(key, want, x, z, h, gx, gy, rot) {
    var P3 = global.DG.prop3d;
    if (!P3) { return false; }
    /* ⑲-33 고원 땅 나무는 눈 재질 — 덩이 이름을 갈라 다른 땅 나무와 안 섞인다 */
    var FRs = global.DG.frost, snow = want === 'tree' && FRs && FRs.treeSnow ? FRs.treeSnow(x, z) : 0;
    var got = P3.parts(want, gx, gy, undefined, snow, propEra(want, x, z));
    if (!got || !got.parts.length) { return false; }
    var tag = got.snow ? '#snow' + got.snow : '';
    /* 자리마다 조금씩 돌려 세운다 — 안 돌리면 나무 백 그루가 같은 쪽을 본다.
       집은 제 회전을 이미 갖고 있으므로(길을 보고 선다) 그것을 그대로 쓴다 */
    var ry = typeof rot === 'number' ? rot : h1(gx * 41 + 7, gy * 83 + 13) * Math.PI * 2;
    var hh = h * P3.heightMul(want);
    var i, ok = true;
    for (i = 0; i < got.parts.length; i++) {
      var K = instMake(got.url + tag + '#' + i, got.parts[i].geometry,
                        got.parts[i].material, P3.casts(want), GLB_CAP());
      ok = instAt(K, key, got.url + tag + '#' + i, x, groundY(x, z), z, hh, hh, hh, 0, ry, 0) && ok;
    }
    return ok;
  }

  function instProp(key, p, ox, oz) {
    if (!INST_ON()) { return false; }
    var x = ox + p.x, z = oz + p.z;
    /* **진짜 모델이 와 있으면 그것으로 세운다** (새 PLAN STEP 4).
       격자 좌표를 같이 넘겨 같은 자리에는 늘 같은 모양이 서게 한다 */
    var gx = Math.round((ox - GRID / 2) / GRID), gy = Math.round((oz - GRID / 2) / GRID);
    /* 왼쪽이 이 판의 소품 이름, 오른쪽이 `prop3d` 표의 이름이다.
       손으로 그린 땅의 일곱(산·등롱·사당·굴·폐허·다리·벼)도 여기서 갈린다 */
    var GLB = { tree: 'tree', rock: 'rock', grass: 'grass', reed: 'grass',
                house: 'house', tower: 'tower',
                peak: 'peak', lamp: 'lamp', shrine: 'shrine', cave: 'cave',
                ruin: 'ruin', bridge: 'bridge', rice: 'rice',
                well: 'well', market: 'market', waterfall: 'waterfall',
                temple: 'temple' };
    /* LOD(PLAN 36절) — 나무·바위·풀·갈대는 `LOD_NEAR` 안에 있을 때만 진짜
       모델을 받는다. 밖이면 곧장 아래의 싼 도형(원뿔·공)으로 간다. 집·탑·
       랜드마크는 칸당 수가 적어 거리를 안 가린다 */
    var natureLod = p.t === 'tree' || p.t === 'rock' || p.t === 'grass' || p.t === 'reed';
    var lodOk = !natureLod ||
      Math.hypot(x - core.save.player.pos.x, z - core.save.player.pos.y) <= LOD_NEAR();
    /* 땅 전용 퓨전 소품('zp_*')은 prop3d 표 이름 그대로다 */
    var glbName = GLB[p.t] || (p.t && p.t.indexOf('zp_') === 0 ? p.t : null);
    if (lodOk && glbName && instGlb(key, glbName, x, z, p.h, gx + Math.round(p.x),
                            gy + Math.round(p.z), p.rot)) {
      return true;
    }
    if (p.t === 'tree') {
      var SS = global.DG.season, FRt = global.DG.frost;
      var leafHex = SS ? SS.leaf(0x2f5a34) : 0x2f5a34;
      if (FRt && FRt.treeSnow && FRt.treeSnow(x, z) > 0) { leafHex = 0xc4d2d8; }   // ⑲-33 먼 곳 원뿔 나무도 눈빛
      var a = instPut(key, 'trunk', 'cyl', 0x4a3a2a, '', true,
        x, p.h * 0.21, z, 1.2, p.h * 0.42, 1.2);
      var bb = instPut(key, 'leaf:' + leafHex, 'cone', leafHex, 'sway', true,
        x, p.h * 0.58, z, p.h * 0.68, p.h * 0.72, p.h * 0.68);
      return a && bb;
    }
    if (p.t === 'rock') {
      return instPut(key, 'rock', 'sph', 0x6b6a72, 'flat', true,
        x, p.h * 0.32, z, p.h * 1.5, p.h * 0.9, p.h * 1.3, 0.3, p.x, 0.2);
    }
    if (p.t === 'grass') {
      return instPut(key, 'grass', 'cone', 0x5d7a44, 'sway', false,
        x, p.h * 0.5, z, p.h * 1.5, p.h, p.h * 1.5);
    }
    if (p.t === 'reed') {
      return instPut(key, 'reed', 'cone', 0x6d7f4a, 'sway', false,
        x, p.h * 0.5, z, 0.5, p.h, 0.5);
    }
    return false;
  }

  /**
   * 등불 한 알. **밤에만 보인다** — 낮에 켜 두면 흰 점으로만 남는다.
   * 지금이 밤인지 여기서 곧바로 정한다: 나중에 걸어 들어온 격자는
   * `syncLamps` 가 이미 훑고 지나간 뒤라 낮에도 켜진 채 남는다.
   */
  function addLampBulb(g, x, y, z, r) {
    var b = box(g, 'sph', pmat(0xffd489, 'glow'), x, y, z, r, r * 1.25, r, false);
    b.userData.lamp = true;
    b.visible = !!(lightNow && lightNow.lamp > 0.2);
    return b;
  }

  /** 등롱 위로 오르는 연기 두 알(PLAN 44절). 불과 같이 밤에만 보인다 —
   * `syncLamps` 가 이 애도 `userData.lamp` 로 함께 여닫는다.
   * **격자 키로 나눠 든다**(`smokeByKey`) — 그래야 그 격자가 부서질 때
   * (`syncProps`·`refreshProps`) 함께 치워 창고가 걸을수록 늘어나지 않는다 */
  var smokeByKey = {};
  /* 여기서 어긋나면 **그 격자를 짓던 `buildProp` 통째로 멎는다**(같은 for 문
   * 안이라, 이 뒤에 올 나무·집도 안 선다) — 그래서 몸만 남기고 조용히 넘어간다 */
  function addLampSmoke(g, key, x, y, z) {
    try {
      var list = smokeByKey[key] || (smokeByKey[key] = []);
      var i;
      for (i = 0; i < 2; i++) {
        var s = box(g, 'sph', pmat(0xb9b9b9, 'smoke').clone(), x, y, z, 0.4, 0.4, 0.4, false);
        s.userData.lamp = true;
        s.userData.smoke = { x: x, baseY: y, z: z, ph: Math.random() * 6.28 + i * Math.PI };
        s.visible = !!(lightNow && lightNow.lamp > 0.2);
        list.push(s);
      }
    } catch (err) {
      if (global.console) { console.error('[world3d] 연기 알갱이를 못 세웠다', err); }
    }
  }

  function buildProp(kind, gx, gy, mapped, key) {
    var g = new T.Group();
    var dens = DENSITY();
    if (kind === 'town') { townDens[gx + ':' + gy] = dens; }
    var plan = propPlan(kind, gx, gy, mapped, dens);
    var ox = gx * GRID + GRID / 2, oz = gy * GRID + GRID / 2;
    var i;
    for (i = 0; i < plan.length; i++) {
      var p = plan[i];
      /* 잔 사물은 인스턴스 덩이가 받는다. 창고가 다 차면 false 가 와서
         아래의 옛 길(제 Mesh 를 만드는 길)로 그대로 흘러간다 */
      var inst = key && instProp(key, p, ox, oz);
      if (inst) {
        /* **불만은 인스턴스가 못 맡는다.** 등롱과 사당의 등은 밤에만 켜지는데
           (`syncLamps` 가 `userData.lamp` 를 훑는다) 인스턴스 덩이는 낱개를
           켜고 끌 수가 없다. 몸은 모델이 세웠으니 **불만 여기서 얹는다** */
        if (p.t === 'lamp') {
          addLampBulb(g, p.x, p.h + 0.25, p.z, 0.8);
          addLampSmoke(g, key, p.x, p.h + 0.7, p.z);
        } else if (p.t === 'shrine') {
          addLampBulb(g, -3.4, 2.8, 4.6, 0.7);
          addLampBulb(g, 3.4, 2.8, 4.6, 0.7);
          addLampSmoke(g, key, -3.4, 3.3, 4.6);
          addLampSmoke(g, key, 3.4, 3.3, 4.6);
        }
        continue;
      }
      if (p.t === 'house' || p.t === 'tower') {
        /* 벽은 밝고 지붕은 짙다 — 한옥이 그렇고, 그래야 지붕선이 보인다.
           둘 다 어두우면 멀리서 회색 덩어리 하나로 뭉친다 */
        var sh = 0.55 + p.shade * 0.42;
        var wall = pmat(((Math.round(sh * 250) << 16) |
                         (Math.round(sh * 244) << 8) |
                          Math.round(sh * 232)));
        var body = box(g, 'box', wall, p.x, p.h / 2, p.z, p.w, p.h, p.d, true);
        body.rotation.y = p.rot;
        body.receiveShadow = true;
        if (p.roof) {
          /* 기와지붕 — 이 판의 건물을 한옥으로 보이게 하는 것은 이 사각뿔 하나다 */
          var roof = box(g, 'cone4', pmat(0x4a5360, 'flat'),
            p.x, p.h + p.w * 0.22, p.z, p.w * 1.28, p.w * 0.55, p.d * 1.28, true);
          roof.rotation.y = p.rot + Math.PI / 4;
        } else {
          box(g, 'box', pmat(0x39404c), p.x, p.h + 0.3, p.z, p.w * 0.9, 0.6, p.d * 0.9, false)
            .rotation.y = p.rot;
        }
      } else if (p.t === 'tree') {
        /* 잎 색은 **계절이 정한다**(`season.js`) — 계절이 꺼져 있으면 예전 초록 */
        var SS = global.DG.season;
        var leafHex = SS ? SS.leaf(0x2f5a34) : 0x2f5a34;
        box(g, 'cyl', pmat(0x4a3a2a), p.x, p.h * 0.21, p.z, 1.2, p.h * 0.42, 1.2, true);
        box(g, 'cone', pmat(leafHex, 'sway'), p.x, p.h * 0.58, p.z, p.h * 0.68, p.h * 0.72, p.h * 0.68, true);
      } else if (p.t === 'rock') {
        var rk = box(g, 'sph', pmat(0x6b6a72, 'flat'), p.x, p.h * 0.32, p.z, p.h * 1.5, p.h * 0.9, p.h * 1.3, true);
        rk.rotation.set(0.3, p.x, 0.2);
      } else if (p.t === 'grass') {
        box(g, 'cone', pmat(0x5d7a44, 'sway'), p.x, p.h * 0.5, p.z, p.h * 1.5, p.h, p.h * 1.5, false);
      } else if (p.t === 'peak') {
        box(g, 'cone', pmat(0x4a4752, 'flat'), p.x, p.h / 2, p.z, GRID * 0.84, p.h, GRID * 0.84, true)
          .receiveShadow = true;
      } else if (p.t === 'water') {
        /* 네모난 수면은 **격자를 그대로 드러낸다** — 한 칸만 물인 자리에 파란 사각형이
           덩그러니 놓인다. 원반으로 깔면 홀로 있으면 못이 되고 이어지면 강이 된다.
           다만 **손으로 그린 강**(p.sq)은 이야기가 다르다 — 이어지라고 그은 물이라
           원반으로 깔면 가장자리가 부채꼴로 패어 강이 아니라 물웅덩이 줄로 보인다.
           그 자리는 격자를 꽉 채우는 네모로 깐다(눈으로 보고 알았다) */
        var wy = 0.12 + (p.rise ? 0.55 : 0);          // 불면 수면이 올라온다
        var wg = p.rise ? 1.06 : 1;
        var whex = p.rise ? 0x2a5f88 : 0x2f6f9e;       // 흙탕물은 더 어둡다
        /* 물가 쪽(마스크가 켜진 변)만 들쭉날쭉한 `shoreW<mask>`를 쓴다 — 강물끼리
           이어지는 변(꺼진 비트)은 안 깎여 있어 옆 칸과 자로 잰 듯 맞물린다.
           마스크가 통째로 0(사방이 물)이면 굳이 새 도형을 안 쓰고 옛 'plane'
           그대로 간다(캐시 낭비 없음, 화면도 똑같다) */
        var wGeo = p.sq ? ((p.shore | 0) ? ('shoreW' + (p.shore | 0)) : 'plane') : 'disc';
        var w = box(g, wGeo, pmat(whex, 'water'), 0, wy, 0, (p.sq ? (GRID + 0.5) : GRID * 0.62) * wg,
          (p.sq ? (GRID + 0.5) : GRID * 0.62) * wg, 1, false);
        w.rotation.x = -Math.PI / 2;
      } else if (p.t === 'field') {
        /* 논 한 뙈기 — 물 댄 낯을 얇게 깔고 두렁을 두른다. 지면보다 조금만 띄운다
           (많이 띄우면 논이 공중에 뜨고, 안 띄우면 지면과 다퉈 얼룩진다) */
        var fld = box(g, 'box', pmat(0x3f6b52), p.x, 0.09, p.z, p.w, 0.18, p.d, false);
        fld.rotation.y = p.rot;
        fld.receiveShadow = true;
        /* 두렁은 **테두리**다. 한 덩이로 덮으면 논이 그 밑에 깔려 흙판만 보인다
           (눈으로 보고 알았다) — 네 변만 두른다 */
        /* **이름을 `lox`·`loz` 로 둔 까닭** — 여기서 `ox`·`oz` 를 쓰면 `var` 가
           함수 범위라 이 함수 맨 위의 **격자 원점**(`ox`·`oz`)을 통째로 덮어쓴다.
           그러면 이 논 뒤에 오는 소품이 전부 원점 근처(9, 0)로 끌려가 사라진다 —
           벼가 안 서던 것이 이것이었다(2026-08-29에 잡았다) */
        var lw = 1.1, li;
        for (li = 0; li < 4; li++) {
          var ax = li < 2 ? p.w + lw : lw, az = li < 2 ? lw : p.d + lw;
          var lox = li === 0 ? 0 : (li === 1 ? 0 : (li === 2 ? -(p.w + lw) / 2 : (p.w + lw) / 2));
          var loz = li === 0 ? -(p.d + lw) / 2 : (li === 1 ? (p.d + lw) / 2 : 0);
          var lv = box(g, 'box', pmat(0x7a6f57), 0, 0.20, 0, ax, 0.22, az, false);
          lv.position.set(p.x + Math.cos(p.rot) * lox - Math.sin(p.rot) * loz, 0.20,
                          p.z + Math.sin(p.rot) * lox + Math.cos(p.rot) * loz);
          lv.rotation.y = p.rot;
        }
      } else if (p.t === 'scare') {
        /* 허수아비 — 장대 하나에 가로대와 삿갓. 논에 사람이 산다는 표다 */
        box(g, 'cyl', pmat(0x6b5a3f), p.x, p.h * 0.5, p.z, 0.16, p.h, 0.16, true);
        box(g, 'box', pmat(0x6b5a3f), p.x, p.h * 0.78, p.z, 1.6, 0.13, 0.13, false);
        box(g, 'cone', pmat(0xa8925f, 'flat'), p.x, p.h + 0.16, p.z, 1.1, 0.5, 1.1, false);
      } else if (p.t === 'bridge') {
        /* 다리 — 강을 **가로질러** 놓는다. 길이 남북이라 상판도 남북으로 길다.
           난간이 없으면 멀리서 물 위의 널빤지로만 보인다.
           **모델을 못 받았을 때만 여기 온다.** 계획은 일곱 칸으로 나뉘어 있으므로
           첫 칸(`seg` 0)에서만 옛 모습대로 48m 상판 하나를 세운다 */
        if (p.seg) { continue; }
        box(g, 'box', pmat(0x7a6a52), 0, 1.7, 0, 7, 0.5, GRID * 1.02, true).receiveShadow = true;
        var bi;
        for (bi = -1; bi <= 1; bi += 2) {
          box(g, 'box', pmat(0x8a7a60), bi * 3.3, 1.7 + 0.75, 0, 0.35, 1.0, GRID * 1.02, false);
        }
        for (bi = -1; bi <= 1; bi += 2) {          // 물속 교각
          box(g, 'cyl', pmat(0x5d5347), 0, 1.7 * 0.5, bi * GRID * 0.28, 1.5, 1.7 * 2, 1.5, false);
        }
      } else if (p.t === 'cave') {
        /* 굴 입구 — 바위 더미에 **검은 반원**을 박는다. 산 사면에 뚫린 구멍으로 보인다 */
        box(g, 'sph', pmat(0x5a5560, 'flat'), 0, p.h * 0.34, 0, p.h * 2.4, p.h * 1.5, p.h * 2.0, true);
        var mouth = box(g, 'disc', pmat(0x0d1014), 0, p.h * 0.34, p.h * 0.98, 2.6, 3.4, 1, false);
        mouth.rotation.set(0, 0, 0);
        box(g, 'box', pmat(0x6b6a72, 'flat'), -3.1, p.h * 0.25, p.h * 0.9, 0.9, p.h * 0.5, 0.9, false);
        box(g, 'box', pmat(0x6b6a72, 'flat'), 3.1, p.h * 0.25, p.h * 0.9, 0.9, p.h * 0.5, 0.9, false);
      } else if (p.t === 'ruin') {
        /* 폐허 — 주춧돌 위에 **부러진 기둥 넷**. 높이를 서로 다르게 해야 폐허로 보인다
           (같으면 짓다 만 집이다) */
        box(g, 'box', pmat(0x5f5a52, 'flat'), 0, 0.2, 0, 13, 0.4, 13, false).receiveShadow = true;
        var rp = [[-4.4, -4.4, 1.0], [4.4, -4.4, 0.55], [-4.4, 4.4, 0.75], [4.4, 4.4, 0.3]], ri;
        for (ri = 0; ri < rp.length; ri++) {
          box(g, 'cyl', pmat(0x8a8378, 'flat'),
            rp[ri][0], 0.4 + p.h * rp[ri][2] * 0.5, rp[ri][1], 1.1, p.h * rp[ri][2], 1.1, true);
        }
        box(g, 'box', pmat(0x7c766c, 'flat'), 1.2, 0.7, 0, 6, 0.7, 1.2, false).rotation.y = 0.4;
      } else if (p.t === 'shrine') {
        /* 옛 사당 — 작은 기와집 하나에 돌계단과 등롱 둘. 숲 속에서 이것만 사람 손이다 */
        box(g, 'box', pmat(0x6a6258, 'flat'), 0, 0.3, 0, 9, 0.6, 9, false).receiveShadow = true;
        box(g, 'box', pmat(0xb9a88c), 0, p.h * 0.42, 0, 5.4, p.h * 0.66, 5.0, true);
        box(g, 'cone4', pmat(0x4a5360, 'flat'), 0, p.h * 0.86, 0, 8.2, p.h * 0.42, 8.2, true)
          .rotation.y = Math.PI / 4;
        var si;
        for (si = -1; si <= 1; si += 2) {
          box(g, 'cyl', pmat(0x3f3a34), si * 3.4, 1.3, 4.6, 0.2, 2.6, 0.2, false);
          var sb = box(g, 'sph', pmat(0xffd489, 'glow'), si * 3.4, 2.8, 4.6, 0.7, 0.9, 0.7, false);
          sb.userData.lamp = true;
          sb.visible = !!(lightNow && lightNow.lamp > 0.2);
        }
      } else if (p.t === 'waterfall') {
        /* 폭포(PLAN 44절) — 절벽에 물줄기 판 하나, 밑에 튄 물이 고인 못.
           흐르는 결은 안 준다(정지 화면) — 세운 판에 물결 셰이더를 억지로
           씌우느니 정지 화면이 낫다 */
        box(g, 'box', pmat(0x5a5560, 'flat'), 0, p.h * 0.5, -2.4, 13, p.h, 6, true)
          .receiveShadow = true;
        box(g, 'box', pmat(0x9fd0e8, 'fall'), 0, p.h * 0.46, 0.3, 4.6, p.h * 0.86, 0.6, false);
        box(g, 'box', pmat(0x6fa8c4, 'water'), 0, 0.15, 3.4, 8, 0.3, 6.5, false);
      } else if (p.t === 'reed') {
        box(g, 'cone', pmat(0x6d7f4a, 'sway'), p.x, p.h * 0.5, p.z, 0.5, p.h, 0.5, false);
      } else if (p.t === 'lamp') {
        box(g, 'cyl', pmat(0x3f3a34), p.x, p.h * 0.5, p.z, 0.24, p.h, 0.24, false);
        /* 등롱의 불은 **밤에만** 켠다 — 낮에 켜 두면 흰 점으로만 보인다 */
        var bulb = box(g, 'sph', pmat(0xffd489, 'glow'), p.x, p.h + 0.25, p.z, 0.8, 1.0, 0.8, false);
        bulb.userData.lamp = true;
        /* 지금이 밤인지 여기서 곧바로 정한다 — 나중에 걸어 들어온 격자는
           `syncLamps` 가 이미 훑고 지나간 뒤라 낮에도 켜진 채 남는다 */
        bulb.visible = !!(lightNow && lightNow.lamp > 0.2);
      } else if (p.t === 'temple') {
        /* 옛 사원 — **GLB(`chengde_temple.glb`)를 못 받았을 때만** 여기 온다.
           2단 지붕집 하나로 "여느 사당보다 훨씬 크다"만 전한다 — 진짜 모양은
           GLB 몫이라 여기서 정교하게 흉내 내지 않는다 */
        box(g, 'box', pmat(0x6a6258, 'flat'), 0, 0.3, 0, 15, 0.6, 15, false).receiveShadow = true;
        box(g, 'box', pmat(0xb08a4a), 0, p.h * 0.28, 0, 10, p.h * 0.5, 9.4, true);
        box(g, 'cone4', pmat(0xc9a24a, 'flat'), 0, p.h * 0.58, 0, 12, p.h * 0.3, 12, true)
          .rotation.y = Math.PI / 4;
        box(g, 'box', pmat(0x8a5a34), 0, p.h * 0.76, 0, 6, p.h * 0.32, 5.6, true);
        box(g, 'cone4', pmat(0x9a2f2a, 'flat'), 0, p.h * 0.96, 0, 7.4, p.h * 0.22, 7.4, true)
          .rotation.y = Math.PI / 4;
      }
    }
    return g;
  }

  /* 사물 격자를 마지막으로 훑은 자리 — **격자를 넘어설 때만** 다시 훑는다.
     여태 매 프레임 11×11 칸을 다 재고 있었다. 한 걸음(8m/s)에 격자(48m)를 넘는 데
     6초가 걸리니, 그 사이 360번쯤은 같은 답을 다시 낸 셈이다 */
  var propScan = null;

  function syncProps(W) {
    var pos = core.save.player.pos;
    var R = PROP_R();
    /* 지도가 깔렸는지 — 깔린 자리와 안 깔린 자리(오프라인·타일 실패)에서
       세우는 것이 다르다. 캐시 키에도 넣어야 상태가 바뀔 때 다시 세운다 */
    var mapped = !!(W.tilesUsable && W.tilesUsable());
    var RG3 = global.DG.land;
    var wkNow = weatherKey();
    var wetNow = WET() && (wkNow === 'rain' || wkNow === 'snow');
    var seasonKey = global.DG.season ? global.DG.season.now().key : '-';
    /* **훑을 까닭이 있을 때만 훑는다.** 격자를 넘었거나 · 지도가 붙거나 떨어졌거나 ·
       비가 오거나 그쳤거나 · 품질이 바뀌었을 때. 그 밖에는 답이 지난 프레임과 같다 */
    var cell = Math.floor(pos.x / GRID) + ':' + Math.floor(pos.y / GRID) +
      ':' + Math.round(R) + ':' + (MESH_ON() ? 1 : 0) + ':' + Math.round(DENSITY() * 100) +
      ':' + (mapped ? 'm' : 'n') + ':' + (wetNow ? 'w' : 'd') +
      ':' + (RG3 && RG3.on() ? 'L' : '-') +
      ':' + seasonKey;
    if (propScan === cell) { return; }
    propScan = cell;
    var g0x = Math.floor((pos.x - R) / GRID), g1x = Math.floor((pos.x + R) / GRID);
    var g0y = Math.floor((pos.y - R) / GRID), g1y = Math.floor((pos.y + R) / GRID);
    var live = {};
    for (var gy = g0y; gy <= g1y; gy++) {
      for (var gx = g0x; gx <= g1x; gx++) {
        var kind = W.terrainAt(gx, gy);
        /* 손으로 그린 땅이 못박아 둔 것은 **찾아가는 표적**이다 — 멀다고 빼면
           폐허가 코앞에서야 솟는다. 표식이 있는 격자는 잔 사물 규칙에서 뺀다 */
        var mk = RG3 ? RG3.markAt(gx, gy) : null;
        if (!mk && global.DG.landform && global.DG.landform.markAt) { mk = global.DG.landform.markAt(gx, gy) ? 'lf' : null; }   // ⑰ 다리·폭포도 표적
        var tileDist = Math.hypot((gx + 0.5) * GRID - pos.x, (gy + 0.5) * GRID - pos.y);
        /* 풀·길의 잔 사물은 가까울 때만 세운다 — 반경 전체에 깔면 격자 백 개가
           한꺼번에 늘어나고, 멀리서는 어차피 한 픽셀이다 */
        var far = tileDist > R * 0.5;
        if (far && !mk && (kind === 'grass' || kind === 'road') &&
            !(RG3 && RG3.hasDeco && RG3.hasDeco(gx, gy))) { continue; }
        /* LOD(36절) 대(帶) — 이 칸이 나무·바위·풀을 세우는 종류(town 은 집·탑뿐이라
           뺀다)라면 문턱(LOD_NEAR) 안쪽인지를 키에 넣는다. 문턱을 건너면 칸이
           다시 지어지고, 그 안에서 `instProp` 이 진짜 모델과 도형을 맞바꾼다.
           안 넣으면 가까이 가도 이미 지은 칸은 도형인 채로 남는다(칸이 안
           다시 지어지므로) */
        var lodBand = kind !== 'town' ? (tileDist <= LOD_NEAR() ? 'n' : 'f') : '-';
        /* 이 땅을 켜고 끄면 같은 격자가 다른 땅이 된다 — 캐시 키에 넣어야 다시 세운다 */
        /* 젖음도 키에 넣는다 — 안 넣으면 비가 그쳐도 강이 분 채로 남는다.
           **계절도 마찬가지다** — 안 넣으면 가을이 됐는데 나무 몇 그루가 초록으로
           남는다(눈으로 보고 알았다). 훑는 조건에만 넣으면 다시 훑기는 하는데
           이미 세워 둔 격자를 그대로 되쓴다 */
        var key = kind + ':' + gx + ':' + gy + ':' + (mapped ? 'm' : 'n') +
          (mk ? ':' + mk : '') + (wetNow ? ':w' : '') + ':' + seasonKey + ':' + lodBand;
        live[key] = 1;
        if (propMeshes[key]) { continue; }
        var node = buildProp(kind, gx, gy, mapped, key);
        /* 격자 한가운데의 땅 높이에 앉힌다. 이 노드 안의 조각들은 제 자리
           (`p.x`·`p.z`)만큼 옆으로 벌어져 있어 그만큼은 어긋나지만, 격자가
           48m 라 한 칸 안에서는 땅이 거의 평평하다 — 눈에 안 띈다 */
        var pcx = gx * GRID + GRID / 2, pcz = gy * GRID + GRID / 2;
        node.position.set(pcx, groundY(pcx, pcz), pcz);
        propGroup.add(node);
        propMeshes[key] = node;
      }
    }
    /* 부수는 반경은 짓는 반경(R)보다 크다(PLAN 42절) — 경계에서 한 걸음
       왕복해도 짓고 부수고를 되풀이하지 않는다 */
    var UR = PROP_UR(R);
    for (var k in propMeshes) {
      if (!Object.prototype.hasOwnProperty.call(propMeshes, k) || live[k]) { continue; }
      /* 이번에 훑은 격자 범위(g0x~g1x, g0y~g1y) **안**인데도 살아 있지 않다면
         — 같은 자리의 내용(계절·젖음·지도 여부 등)이 바뀐 것이니 미룰 것 없이
         바로 갈아 짓는다. UR 히스테리시스는 **범위 밖으로 걸어 나간 것**에만
         쓴다 — 안 그러면 계절이 바뀌어도 헌 사물이 새 것과 겹친 채 남는다 */
      var kp = k.split(':');
      var kgx = +kp[1], kgy = +kp[2];
      if (!(kgx >= g0x && kgx <= g1x && kgy >= g0y && kgy <= g1y)) {
        var leftNode = propMeshes[k];
        var d = Math.hypot(leftNode.position.x - pos.x, leftNode.position.z - pos.y);
        if (d <= UR) { continue; }      // 아직 부수는 반경 안 — 그대로 둔다
      }
      /* 도형·재질은 **모두가 나눠 쓰는 것**이라 여기서 dispose 하지 않는다.
         하나를 버리면 남아 있는 다른 건물의 도형까지 같이 사라진다 */
      propGroup.remove(propMeshes[k]);
      delete propMeshes[k];
      if (kp[0] === 'town') { delete townDens[kp[1] + ':' + kp[2]]; }
      delete smokeByKey[k];           // 이 격자의 연기도 창고에서 함께 뺀다
      instDrop(k);                    // 빌려 준 인스턴스 자리도 돌려받는다
    }
  }

  /** 등롱은 밤에만 켠다 (낮에는 재질을 갈지 않고 눈에 안 띄게 꺼 둔다) */
  function syncLamps() {
    var on = lightNow ? lightNow.lamp > 0.2 : false;
    if (syncLamps.was === on) { return; }
    syncLamps.was = on;
    propGroup.traverse(function (o) {
      if (o.userData && o.userData.lamp) { o.visible = on; }
    });
  }

  /** 잎·풀 흔들림 시계를 굴린다(PLAN 44절) — 꺼져 있으면 마지막 자세로 멎는다.
   * 이 축도 실기기로 못 본 채 나갔던 것이라, `syncFlame`·`syncSmoke`와 같은
   * 이유로 어긋나면 스스로 꺼진다 */
  var swayBroken = false;
  function syncSway(dt) {
    if (!SWAY_ON() || !swayShaders.length || swayBroken) { return; }
    try {
      swayClock += dt;
      var amt = SWAY_AMT(), i;
      for (i = 0; i < swayShaders.length; i++) {
        swayShaders[i].uniforms.uSwTime.value = swayClock;
        swayShaders[i].uniforms.uSwAmt.value = amt;
      }
    } catch (err) {
      swayBroken = true;
      if (global.console) { console.error('[world3d] 잎·풀 흔들림에서 멎어 껐다', err); }
    }
  }

  /** 등롱·사당 불이 일렁인다(PLAN 44절 "불꽃") — 재질을 **모두가 나눠 쓰므로**
   * 한 번만 써도 뜬 등롱 전부가 같이 일렁인다(값싸다).
   * **한 번이라도 어긋나면 스스로 꺼진다** — 이 축은 아직 실기기로 못 본
   * 새 코드라, 여기서 예외가 나 렌더 루프 전체(`world3d.render`)를 끊으면
   * 이동·전투 무대까지 통째로 멎는다(그 아래 줄들이 아예 안 불린다). 장식
   * 하나가 게임 전체를 죽이는 것보다 그 장식만 조용히 빠지는 쪽이 낫다 */
  var flameClock = 0, smokeClock = 0, flameBroken = false, smokeBroken = false;
  function syncFlame(dt) {
    if (!FLAME_ON() || flameBroken) { return; }
    try {
      flameClock += dt;
      var m = pmat(0xffd489, 'glow');
      m.emissiveIntensity = 0.9 + FLAME_AMT() *
        (Math.sin(flameClock * 9.1) * 0.7 + Math.sin(flameClock * 23.7) * 0.3);
    } catch (err) {
      flameBroken = true;
      if (global.console) { console.error('[world3d] 불꽃 일렁임에서 멎어 껐다', err); }
    }
  }

  /** 연기 알갱이를 한 프레임 굴린다(PLAN 44절) — 위로 오르다 다 오르면
   * 다시 밑에서 시작한다(비 알갱이가 상자를 벗어나면 되돌리는 것과 같은 손).
   * **재질을 낱개로 복제해 뒀으니**(`addLampSmoke`) 알갱이마다 다른 짙기로
   * 옅어질 수 있다. 창고가 안 뜬 낮에는 굳이 돌리지 않는다. `syncFlame` 과
   * 같은 이유로 어긋나면 스스로 꺼진다 */
  function syncSmoke(dt) {
    if (!SMOKE_ON() || smokeBroken || !(lightNow && lightNow.lamp > 0.2)) { return; }
    try {
      smokeClock += dt;
      var RISE = 0.4, MAXH = 2.4, k;
      for (k in smokeByKey) {
        if (!Object.prototype.hasOwnProperty.call(smokeByKey, k)) { continue; }
        var list = smokeByKey[k], i;
        for (i = 0; i < list.length; i++) {
          var s = list[i], d = s.userData.smoke;
          var t = (smokeClock * RISE + d.ph) % MAXH;
          var frac = t / MAXH;
          s.position.set(d.x + Math.sin(smokeClock * 0.6 + d.ph) * 0.15, d.baseY + t, d.z);
          var sc = 0.35 + frac * 0.55;
          s.scale.set(sc, sc, sc);
          s.material.opacity = 0.34 * (1 - frac);
        }
      }
    } catch (err) {
      smokeBroken = true;
      if (global.console) { console.error('[world3d] 연기에서 멎어 껐다', err); }
    }
  }

