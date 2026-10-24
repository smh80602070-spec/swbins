/**
 * 1만리 3D 땅의 소재 텍스처(땅 종류별 사진결·이음 띠·칸 그림) — world3d.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * world3d.js 가 `bind({ LAND_COLOR, LAND_PAINT, PAINT_A, GRID, h1, gen, three })` 로 손잡이를 넘기고 같은 이름(preloadLandTex·landTexture·
 * terrainTexture)으로 부른다. three 는 init 뒤에야 서므로 부를 때마다 당긴다. 텍스처 캐시 landTex·LAND_TEX_VARIANTS 는 여기 하나(world3d 는 같은 객체를 본다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var G = null, T = null, LAND_COLOR, LAND_PAINT, PAINT_A, GRID, h1;
  var api = null;
  function bind(g) { if (G !== g) { G = g; LAND_COLOR = g.LAND_COLOR; LAND_PAINT = g.LAND_PAINT; PAINT_A = g.PAINT_A; GRID = g.GRID; h1 = g.h1; } T = g.three(); return api; }
  /* ── 땅의 소재 텍스처 (2026-08-30, PLAN 부록 "코드로 그리지 말고 에셋으로") ──
   * 여태 `LAND_COLOR` 로 **색만** 칠했다. ambientCG(CC0) 1K BaseColor 를 종류마다
   * 하나씩 받아 캔버스 패턴으로 반복해 깐다 — `water` 는 뺐다(실제 물결은
   * `water3d.js` 가 따로 그리므로 이 칠은 거의 안 보인다).
   * 아직 못 받았으면(로딩 중·파일 없음) 늘 하던 `shadeHex` 채색으로 물러난다 —
   * 화면이 한 번도 안 빈다(이 저장소의 다른 에셋들과 같은 원칙). */
  /* 2026-09-05, "바닥이 네모만 있는게 아니라 다양하게" — 종류마다 사진을
   * **한 장만** 반복해 깔면 넓은 들판에서 같은 무늬가 계속 되풀이돼(12m마다
   * 정확히 같은 사진) 눈에 "네모"로 보인다. 종류마다 ambientCG(CC0) 사진을
   * 셋씩 받아(출처는 `assets/ASSET_LICENSES.md`), 48m 칸(gx,gy)마다
   * `variantFor()`가 해시로 그중 하나를 고른다 — 같은 칸은 늘 같은 변형을
   * 쓰므로(다시 구워도 안 바뀐다) 반복은 여전히 있지만 그 주기가 훨씬
   * 길고 불규칙해져 덜 눈에 띈다. */
  var LAND_TEX_VARIANTS = {
    grass: ['assets/textures/land_c/grass1.webp', 'assets/textures/land_c/grass2.webp', 'assets/textures/land_c/grass3.webp'],
    forest: ['assets/textures/land_c/forest1.webp', 'assets/textures/land_c/forest2.webp', 'assets/textures/land_c/forest3.webp'],
    mount: ['assets/textures/land_c/mount1.webp', 'assets/textures/land_c/mount2.webp', 'assets/textures/land_c/mount3.webp'],
    road: ['assets/textures/land_c/road1.webp', 'assets/textures/land_c/road2.webp', 'assets/textures/land_c/road3.webp'],
    town: ['assets/textures/land_c/town1.webp', 'assets/textures/land_c/town2.webp', 'assets/textures/land_c/town3.webp'],
    farm: ['assets/textures/land_c/farm1.webp', 'assets/textures/land_c/farm2.webp', 'assets/textures/land_c/farm3.webp']
  };
  var LAND_TEX_IMG = {};
  /* W-0355 자체 땅 타일(K-0136 ③, 공용 tiles/ground 512) — 풀·길·마을 변주에 넷째 장으로 더한다(공용 주소를 안 뒤 한 번, 손잡이 world3d.groundTiles 0 이면 안 더함).
     변주 수가 바뀌면 landTexReadyKey 길이가 바뀌어 타일이 다시 구워진다. 바닷가 모래(go_shore_sand)는 이 판 땅 종류에 물가가 없어 안 씀 */
  var GROUND_ADD = { grass: 'go_field_grass', road: 'go_stone_path', town: 'go_village_dirt' }, groundAdded = false;
  function addGroundTiles() {   // 손잡이를 끄면 넷째 장을 다시 뺀다(비교판·되돌림)
    var A3 = global.DG.assets3d, C = global.DG.core, on = !(C && C.tuned) || +C.tuned('world3d.groundTiles', 1) > 0, k;
    if (on === groundAdded || (on && !(A3 && A3.state && A3.state() === 'ok' && A3.root))) { return; }
    groundAdded = on;
    for (k in GROUND_ADD) { if (GROUND_ADD.hasOwnProperty(k) && LAND_TEX_VARIANTS[k]) { if (on) { LAND_TEX_VARIANTS[k].push(A3.root() + 'tiles/ground/' + GROUND_ADD[k] + '.webp'); } else { LAND_TEX_VARIANTS[k].length = 3; } } }
  }
  function landTexImg(kind, variant) {
    var key = kind + '#' + variant;
    if (LAND_TEX_IMG[key]) { return LAND_TEX_IMG[key]; }
    var img = new Image();
    var urls = LAND_TEX_VARIANTS[kind];
    var url = urls && urls[variant];
    if (url) { img.onload = function () { img.ready = true; }; img.src = url; }
    LAND_TEX_IMG[key] = img;
    return img;
  }
  /** 48m 격자 하나가 어느 변형(사진)을 쓸지 — 칸마다 고정(해시), 옆 칸과는
   *  보통 다르다(3종 중 하나라 1/3 확률로 우연히 같을 수 있다) */
  function variantFor(kind, gx, gy) {
    var n = (LAND_TEX_VARIANTS[kind] || [null]).length;
    if (n <= 1) { return 0; }
    return Math.floor(h1(gx * 53 + 7, gy * 61 + 13) * n);
  }
  /** 텍스처 한 변이 세계에서 몇 m 를 덮나 — 작을수록 촘촘히(확대돼) 반복된다 */
  var LAND_TEX_METERS = 12;
  /** 바닥을 굽는 캔버스 한 변(px) — 손잡이(2026-09-05, "바닥은 퀄리티가 없는데"
   *  로 발견). 타일 한 장(`span`)이 실제로는 `TILE_PX(256) * metersPerPixel`
   *  ≈ 244m 인데, 캔버스는 옛값 256px 그대로였다 — ambientCG 1K 사진을
   *  `LAND_TEX_METERS`(12m)마다 반복해 깔아도 반복 한 칸이 캔버스에서 겨우
   *  12.6px 로 뭉개져(1024px 원본의 디테일이 사실상 다 사라짐) 사진이 아니라
   *  흐린 단색처럼 보였다.
   *
   *  **"타일이 대개 한 종류라 GPU 반복 타일링으로 캔버스를 아예 건너뛸 수
   *  있지 않냐"는 제안을 실측하고 접었다** — 당시 `terrainAt()`이 격자(48m)마다
   *  `core.hash2(tx,ty)` 를 **독립적으로** 굴렸다(이웃 칸과 상관 없는 소금·
   *  후추 노이즈, 값 노이즈처럼 이어지지 않는다). 타일 한 장이 격자 7x7(49칸,
   *  `Math.ceil(span/GRID)+1`)을 덮는데, 5000곳을 무작위로 뽑아 "49칸이
   *  전부 같은 종류인 타일"을 세어 보니 **0/5000(0.000%)** — 수학적으로도
   *  당연하다(제일 흔한 grass 60% 라도 0.6^49 는 사실상 0). 그러니 "균일한
   *  타일만 GPU로 직접 타일링" 최적화는 이 지형에서 거의 절대 안 걸린다 —
   *  구현하면 죽은 코드(seam·계절/밤낮 틴트 이중곱 등 버그 자리만 늘리는)가
   *  된다. **그래서 굽기는 그대로 두고 해상도만 올렸다.**
   *  (2026-09-08 갱신: "필드맵이 바둑판 같다"는 지적으로 `terrainAt()`이
   *  `world.js`의 `terrainNoise()`(이웃과 이어지는 값 노이즈)로 바뀌어 위
   *  "완전히 독립" 전제는 더 이상 안 맞는다 — 이제 숲·산 안쪽처럼 같은 종류가
   *  뭉친 자리는 49칸이 실제로 자주 같을 수 있다. 그래도 GPU 타일링을 다시
   *  켤 근거로는 부족하다 — 마을·경계 자리는 여전히 섞이고, 위 벤치마크가
   *  보여주듯 굽기 자체는 이미 충분히 싸다(프레임당 비용 아님). 다시 잴
   *  필요가 생기면 이 자리부터.)
   *
   *  굽기는 타일이 새로 생길 때만(플레이어가 이동해 캐시 밖으로 나갈 때)
   *  한 번 돌아 매 프레임 비용은 아니다 — 256 vs 768 vs 1024 를 굽기
   *  루프만 떼어 벤치마크해 보니(20회 평균) 1024 까지는 타일당 ~5.5ms 로
   *  거의 차이가 없었고(진짜 비용은 해상도가 아니라 서브셀마다 새로
   *  만드는 `createPattern` 호출 쪽이었다), 1536(7.6ms)부터 눈에 띄게
   *  늘고 4096(28.1ms, 텍스처 67MB)에서는 확실히 무거워진다. 너무 무거우면
   *  `core.setTune('world3d.landTexRes', 256)` 로 되돌린다.
   *
   *  **캐시 자체의 누수는 따로 있었다(같은 날 발견, 고침)** — 이 값을
   *  올리면서 `landTex` 캐시(구운 텍스처를 담아 두는 곳)에 지우는 코드가
   *  전혀 없다는 게 드러났다(256px 때는 한 장 0.3MB라 안 느껴졌겠지만
   *  768px 는 2.4MB). `syncGround()`의 세대 카운터(`syncGen`)로 고쳤다 —
   *  아래 `landTex` 선언부 주석 참고 */
  function LAND_TEX_RES() { return Math.max(64, Math.round(core.tuned('world3d.landTexRes', 768))); }
  /**
   * 이 소재의 반복 무늬 — 세계 좌표(`x0·y0`, m)에 맞춰 위상을 맞춘다.
   * **타일마다 캔버스가 새로 생기므로**, 반복 시작점을 캔버스 원점이 아니라
   * 세계 좌표의 나머지로 잡아야 옆 타일과 이어 붙었을 때 이음매가 안 보인다.
   */
  function landPattern(c, kind, x0, y0, k) {
    var gx = Math.round(x0 / GRID), gy = Math.round(y0 / GRID);
    var img = landTexImg(kind, variantFor(kind, gx, gy));
    if (!img.ready || !img.naturalWidth || !c.createPattern) { return null; }
    var pat = c.createPattern(img, 'repeat');
    if (!pat || !pat.setTransform || typeof DOMMatrix === 'undefined') { return pat; }
    var side = LAND_TEX_METERS * k;
    var tx = -(((x0 % LAND_TEX_METERS) + LAND_TEX_METERS) % LAND_TEX_METERS) * k;
    var ty = -(((y0 % LAND_TEX_METERS) + LAND_TEX_METERS) % LAND_TEX_METERS) * k;
    pat.setTransform(new DOMMatrix([side / img.naturalWidth, 0, 0, side / img.naturalHeight, tx, ty]));
    return pat;
  }

  /**
   * 같은 종류 칸끼리 사진 변형이 다르면 경계 쪽 띠에 이웃 칸 사진을 옅게 겹친다(W-0110).
   * 칸마다 사진(3종)을 통째로 깔아 밝기가 다른 사진이 자로 그은 듯 맞닿았다 — 3D 마을 한가운데 십자 이음매.
   * 사진은 세계 좌표에 맞춰 깔리므로(`landPattern` 위상) 이웃 사진이 그대로 이어져 들어온다. 띠 여섯 줄,
   * 칸 폭의 절반까지 알파 0.5 → 0 — 경계에서 양쪽이 반반이 되어 줄이 사라진다. 계절 물감(곱하기 0.3)도 같이 얹는다.
   * kindAt(gx, gy) = 그 칸 종류(없으면 null). a = 그 칸 진하기
   */
  var SEAM_BANDS = 6, SEAM_ZONE = 0.5;
  function blendVariants(c, kind, gx, gy, x0, y0, k, a, kindAt) {
    if ((LAND_TEX_VARIANTS[kind] || [null]).length <= 1) { return; }
    var me = variantFor(kind, gx, gy), SS = global.DG.season, bc = LAND_COLOR[kind] || LAND_COLOR.grass;
    if (SS) { bc = SS.landColor(kind, bc); }
    var cx = (gx * GRID - x0) * k, cy = (gy * GRID - y0) * k, cw = GRID * k, i, d;
    var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (d = 0; d < 4; d++) {
      var nx = gx + dirs[d][0], ny = gy + dirs[d][1];
      if (kindAt(nx, ny) !== kind || variantFor(kind, nx, ny) === me) { continue; }
      var pat = landPattern(c, kind, nx * GRID, ny * GRID, k);
      if (!pat) { continue; }
      for (i = 0; i < SEAM_BANDS; i++) {
        var t0 = i / SEAM_BANDS * SEAM_ZONE * cw, bw = SEAM_ZONE * cw / SEAM_BANDS, al = a * 0.5 * (1 - (i + 0.5) / SEAM_BANDS);
        var rx = dirs[d][0] < 0 ? cx + t0 : (dirs[d][0] > 0 ? cx + cw - t0 - bw : cx);
        var ry = dirs[d][1] < 0 ? cy + t0 : (dirs[d][1] > 0 ? cy + cw - t0 - bw : cy);
        var rw = dirs[d][0] ? bw : cw, rh = dirs[d][1] ? bw : cw;
        c.globalAlpha = al; c.fillStyle = pat; c.fillRect(rx, ry, rw, rh);
        c.globalAlpha = al * 0.30; c.globalCompositeOperation = 'multiply'; c.fillStyle = bc; c.fillRect(rx, ry, rw, rh);
        c.globalCompositeOperation = 'source-over';
      }
    }
    c.globalAlpha = 1;
  }

  /** 어느 소재가 왔는지 — 지형 텍스처 캐시 키에 넣어, 늦게 온 것도 다음에 반영되게 한다 */
  function landTexReadyKey() {
    var s = '', k, i, urls;
    addGroundTiles();
    for (k in LAND_TEX_VARIANTS) {
      if (!LAND_TEX_VARIANTS.hasOwnProperty(k)) { continue; }
      urls = LAND_TEX_VARIANTS[k];
      for (i = 0; i < urls.length; i++) { s += (LAND_TEX_IMG[k + '#' + i] && LAND_TEX_IMG[k + '#' + i].ready) ? '1' : '0'; }
    }
    return s;
  }
  /** 받아 두기만 한다 — 처음 걸을 때 한 박자씩 바뀌지 않게(`prop3d.preload` 와 같은 자리) */
  function preloadLandTex() {
    var k, i, urls;
    for (k in LAND_TEX_VARIANTS) {
      if (!LAND_TEX_VARIANTS.hasOwnProperty(k)) { continue; }
      urls = LAND_TEX_VARIANTS[k];
      for (i = 0; i < urls.length; i++) { landTexImg(k, i); }
    }
  }

  var landTex = {};
  /** `landTex`를 지우는 세대 카운터(2026-09-05, "바닥 캐시가 안 지워진다" 로
   *  발견) — `syncGround()`가 돌 때마다 하나씩 올리고, 그 안에서
   *  `landTexture()`/`terrainTexture()`가 캐시를 건드릴 때마다(새로 굽든
   *  캐시에서 꺼내 쓰든) 그 텍스처에 `userData.gen = syncGen`을 찍는다.
   *  한 세대가 끝난 뒤(`syncGround()` 맨 끝) `gen`이 이번 세대가 아닌
   *  항목은 **이번에 어느 살아있는 타일도 안 찾은 것**이므로 안전하게
   *  버리고 GPU 텍스처를 `dispose()`한다. 계절이 바뀌거나(키가 달라져
   *  옛 계절 캔버스가 고아가 된다) 플레이어가 멀리 걸어도(타일 자체가
   *  안 그려져 아무도 안 건드린다) 저절로 청소된다 — 별도 LRU가 필요 없다 */
  /* syncGen(세대 카운터)은 world3d.js 에 있다 — syncGround 가 올리고 여기선 G.gen() 으로 읽는다 */

  /** '#rrggbb' 를 조금 밝게·어둡게 (k 는 -1~1) */
  function shadeHex(hex, k) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, bb = n & 255;
    function f(v) { return Math.max(0, Math.min(255, Math.round(v * (1 + k)))); }
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(bb) + ')';
  }

  /**
   * 이 타일이 이 땅과 겹치나 — 겹치면 덧칠한 텍스처를, 아니면 null.
   * `x0·y0` 는 타일 왼쪽 위 모서리의 월드 좌표(m), `span` 은 한 변(m).
   *
   * **`img`(실제 지도 타일)는 더 이상 바탕에 안 그린다** (2026-09-04, "지형이
   * 어색하다" 감사) — 지도 서비스(CartoCDN)가 이제 API 키를 요구해 "API KEY
   * REQUIRED" 라고 적힌 초록 바탕 그림을 돌려주는데, `onload` 는 그래도 불러서
   * `img.ready`가 그대로 true 가 된다. 그걸 12%(1-`PAINT_A`)라도 바탕에 깔면
   * 그 글자가 마을 한복판에 그대로 비쳤다(실제로 찍어서 봤다). 이 판의 세계는
   * 애초에 지도가 모르는 절차적 세계라(제 위치가 실제 그 좌표에 무엇이 있는지와
   * 무관하게 해시로 정해진다) 지도 사진에 기댈 까닭이 없었다 — `terrainTexture`
   * 와 같은 방식(제 색·무늬로 불투명하게)으로 통일한다.
   */
  function landTexture(key, x0, y0, span) {
    var L = global.DG.land;
    if (!LAND_PAINT() || !L || !L.on()) { return null; }
    var g0x = Math.floor(x0 / GRID), g1x = Math.floor((x0 + span) / GRID);
    var g0y = Math.floor(y0 / GRID), g1y = Math.floor((y0 + span) / GRID);
    var gx, gy, any = false;
    for (gy = g0y; gy <= g1y && !any; gy++) {
      for (gx = g0x; gx <= g1x && !any; gx++) { if (L.owns(gx, gy)) { any = true; } }
    }
    if (!any) { return null; }

    /* 계절도 키에 넣는다 — 안 넣으면 계절이 바뀌어도 지난 계절 색이 남는다.
       텍스처가 늦게 도착할 수도 있으니 **어느 것이 왔는지도 키에 넣는다** —
       안 넣으면 도착 후에도 옛(색만 칠한) 캔버스가 캐시에 계속 나온다 */
    var SSk = global.DG.season;
    var ck = key + '|' + landTexReadyKey() +
      '|' + (SSk ? SSk.now().key : '-');
    if (landTex[ck]) { landTex[ck].userData.gen = G.gen(); return landTex[ck]; }

    var S = LAND_TEX_RES();
    var cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    var c = cv.getContext('2d');
    c.fillStyle = '#3a352e'; c.fillRect(0, 0, S, S); var TB = global.DG.world && +core.tuned('go.landUnder', 1) === 1 ? terrainTexture(global.DG.world, x0, y0, span) : null; if (TB && TB.image) { c.drawImage(TB.image, 0, 0, S, S); }   // W-0418 그린 땅이 덮지 않은 칸은 원래 지형 그림 — 어두운 흙 바탕이 그대로 드러나 구역 넘은 들판이 검었다

    var k = S / span;                    // 미터 → 캔버스 픽셀
    var a0 = PAINT_A();
    for (gy = g0y; gy <= g1y; gy++) {
      for (gx = g0x; gx <= g1x; gx++) {
        var at = L.at(gx, gy);
        if (!at) { continue; }
        /* 가장자리 흐리기 — 이웃 넷 중 이 땅인 것의 몫만큼만 진하게.
           **차이를 크게 두면 안 된다**: 칸마다 알파가 다르면 그 경계가 실선으로
           드러난다(눈으로 보고 알았다). 안쪽은 거의 같은 진하기로 두고
           바깥 한 줄만 살짝 옅게 한다 */
        var near = 0;
        if (L.owns(gx + 1, gy)) { near++; }
        if (L.owns(gx - 1, gy)) { near++; }
        if (L.owns(gx, gy + 1)) { near++; }
        if (L.owns(gx, gy - 1)) { near++; }
        c.globalAlpha = a0 * (near === 4 ? 1 : (0.62 + 0.09 * near));
        var SSc = global.DG.season;
        var baseCol = LAND_COLOR[at.kind] || LAND_COLOR.grass;
        if (SSc) { baseCol = SSc.landColor(at.kind, baseCol); }
        var rx = Math.round((gx * GRID - x0) * k);
        var ry = Math.round((gy * GRID - y0) * k);
        var rw = Math.round((gx * GRID + GRID - x0) * k) - rx;
        var rh = Math.round((gy * GRID + GRID - y0) * k) - ry;
        var pat = landPattern(c, at.kind, gx * GRID, gy * GRID, k);
        if (pat) {
          /* 실제 텍스처가 왔다 — 무늬를 깐다. 칸마다 밝기를 흔들던 옛 방식은
             안 쓴다(사진이 이미 자연스러운 결을 갖고 있다 — 흔들면 오히려
             사진 위에 격자가 도드라진다) */
          c.fillStyle = pat;
          c.fillRect(rx, ry, rw, rh);
          /* 계절 빛깔은 그 위에 **옅게 곱하기**로 얹는다 — 사진을 지우지 않고
             물들이기만 한다(겨울 들판이 누렇게 뜨는 정도) */
          var seasonAlpha = c.globalAlpha;
          var SP1 = global.DG.ground3d && global.DG.ground3d.seasonPaint ? global.DG.ground3d.seasonPaint(at.kind) : null; c.globalAlpha = seasonAlpha * (SP1 ? SP1.a : (at.kind === 'road' ? core.tuned('world3d.roadTone', 0.55) : 0.30));   // W-0209 SP1 = 봄·가을·겨울 들 덮어 칠하기   // W-0153 — 길 칸은 제 색을 덮어 칠한다(아래 terrainTexture 와 같은 손잡이)
          c.globalCompositeOperation = at.kind === 'road' || SP1 ? 'source-over' : 'multiply';
          c.fillStyle = baseCol;
          c.fillRect(rx, ry, rw, rh);
          c.globalCompositeOperation = 'source-over';
          c.globalAlpha = seasonAlpha;
        } else {
          /* 아직 못 받았다 — 옛 방식(색만 칠하기)으로 물러난다. 칸마다 밝기를
             아주 조금 흔든다 — 안 흔들면 마을이 흙빛 한 판이 된다. 폭을
             **아주 좁게** 둔다 — 0.16 으로 흔들었더니 들판이 바둑판이 됐다
             (눈으로 보고 알았다). 있는 줄 모를 만큼만 흔드는 것이 맞다 */
          c.fillStyle = shadeHex(baseCol, (h1(gx * 17 + 5, gy * 23 + 9) - 0.5) * 0.06);
          /* **겹쳐 칠하지 않는다** — 알파가 있는 색을 두 번 얹으면 그 줄만 짙어진다.
             칸 경계는 픽셀로 딱 맞춰 자른다 */
          c.fillRect(rx, ry, rw, rh);
        }
      }
    }
    var landKind = function (x, y) { var t = L.at(x, y); return t ? t.kind : null; };
    for (gy = g0y; gy <= g1y; gy++) {
      for (gx = g0x; gx <= g1x; gx++) {
        var atB = L.at(gx, gy);
        if (atB && L.owns(gx + 1, gy) && L.owns(gx - 1, gy) && L.owns(gx, gy + 1) && L.owns(gx, gy - 1)) { blendVariants(c, atB.kind, gx, gy, x0, y0, k, a0, landKind); }
      }
    }
    c.globalAlpha = 1;

    var tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.userData.gen = G.gen();
    landTex[ck] = tex;
    return tex;
  }

  /**
   * 손으로 그린 땅이 없는 **대부분의 자리**(무한한 절차적 세계)도 이제 같은
   * 실사 소재로 깐다 — 여태는 `landTexture`가 손 안 댄 자리에서 실제 지도
   * 이미지(길·건물이 찍힌 항공사진 풍 타일)를 그대로 바닥에 깔았는데, 그 위에
   * 서는 것은 격자 해시가 낸 판타지 마을·숲이라 **실제로 존재하지 않는 자리에
   * 실제 지도가 깔리는 어긋남**이 있었다(2026-09-04, 사용자가 "지형·배치가
   * 어색하다"고 짚어 발견). `terrainAt` 이 이미 이 격자가 무슨 땅인지 알고
   * 있으니, 그 종류에 맞는 실사 소재(land.js 와 같은 ambientCG CC0 텍스처)를
   * 대신 깐다 — 세우는 사물과 밟는 바닥이 드디어 같은 이야기를 한다.
   *
   * `landTexture`와 짝이지만 **소유 검사가 없고**(모든 칸이 대상) **실제 지도
   * 이미지에 안 기댄다** — 여기 깔리는 것은 지도가 모르는 절차적 세계라
   * 지도 사진을 밑에 깔 까닭이 없다(그게 바로 어긋남의 원인이었다). 늘
   * 제 색·제 무늬로 **불투명하게** 채운다. 나머지 흐림·계절·캐시 규칙은
   * `landTexture`와 그대로 같다. 물은 여기서 안 칠한다 — 실제 물결은
   * `water3d.js`가 따로 그리므로 `LAND_COLOR.water`만 옅게 깐다(무늬 없음,
   * `LAND_TEX_VARIANTS`에 water가 없어 자동으로 그리된다).
   */
  function terrainTexture(W, x0, y0, span) {
    if (!LAND_PAINT()) { return null; }
    var g0x = Math.floor(x0 / GRID), g1x = Math.floor((x0 + span) / GRID);
    var g0y = Math.floor(y0 / GRID), g1y = Math.floor((y0 + span) / GRID);
    var gx, gy;

    var SSk = global.DG.season;
    var FRt = global.DG.frost && global.DG.frost.on() ? global.DG.frost : null;   // §5 ⑲-27 서리봉 고원 눈밭
    var ck = 'w|' + g0x + ',' + g0y + '|' + landTexReadyKey() +
      '|' + (SSk ? SSk.now().key : '-') + (FRt ? '|fr' : '');
    if (landTex[ck]) { landTex[ck].userData.gen = G.gen(); return landTex[ck]; }

    var S = LAND_TEX_RES();
    var cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    var c = cv.getContext('2d');
    c.fillStyle = '#3a352e'; c.fillRect(0, 0, S, S);

    var k = S / span;
    /* 경계를 **들쭉날쭉하게** 흐린다 — 칸 하나를 통째로 한 종류로 칠하고
       가장자리 알파만 낮추면(옛 방식) 여전히 자로 그은 듯한 줄이 남는다
       (2026-09-04, 스크린샷으로 실제로 확인). 칸을 잘게 나눠(`SUB`) 조각마다
       "이 종류로 칠할까, 다른 종류가 새어 들어올까"를 해시로 굴린다 —
       경계에 가까운 조각일수록 이웃 종류가 섞여 들어올 확률이 높다.
       실제 생태 경계가 직선이 아니라 서로 스미는 것과 같은 이치다 */
    var SUB = 4, subSpan = GRID / SUB, sx, sy;
    for (gy = g0y; gy <= g1y; gy++) {
      for (gx = g0x; gx <= g1x; gx++) {
        var kind = W.terrainAt(gx, gy);
        var kL = W.terrainAt(gx - 1, gy), kR = W.terrainAt(gx + 1, gy);
        var kT = W.terrainAt(gx, gy - 1), kB = W.terrainAt(gx, gy + 1);
        for (sy = 0; sy < SUB; sy++) {
          for (sx = 0; sx < SUB; sx++) {
            var u = (sx + 0.5) / SUB, v = (sy + 0.5) / SUB;
            var useKind = kind, bestD = 1, bestK = null;
            if (kL !== kind && u < bestD) { bestD = u; bestK = kL; }
            if (kR !== kind && (1 - u) < bestD) { bestD = 1 - u; bestK = kR; }
            if (kT !== kind && v < bestD) { bestD = v; bestK = kT; }
            if (kB !== kind && (1 - v) < bestD) { bestD = 1 - v; bestK = kB; }
            if (bestK) {
              var zone = 0.34;
              if (bestD < zone) {
                var seep = 1 - bestD / zone;
                var jitter = h1(gx * 97 + sx * 13 + 3, gy * 131 + sy * 17 + gx * 11);
                if (jitter < seep * 0.85) { useKind = bestK; }
              }
            }
            var wx = gx * GRID + sx * subSpan, wy = gy * GRID + sy * subSpan;
            var rx = Math.round((wx - x0) * k);
            var ry = Math.round((wy - y0) * k);
            var rw = Math.round((wx + subSpan - x0) * k) - rx;
            var rh = Math.round((wy + subSpan - y0) * k) - ry;
            var baseCol = LAND_COLOR[useKind] || LAND_COLOR.grass;
            if (SSk) { baseCol = SSk.landColor(useKind, baseCol); }
            /* §5 ⑲-27 북방 설산 땅은 눈밭 — 물·길은 그대로, 산은 더 희게 */
            var snowy = FRt && useKind !== 'water' && useKind !== 'road' && FRt.snowCell(gx, gy);
            if (snowy) { baseCol = useKind === 'mount' ? '#e6ebf1' : (useKind === 'forest' ? '#cdd7df' : '#dde5ec'); }
            var pat = snowy ? null : landPattern(c, useKind, gx * GRID, gy * GRID, k);
            if (pat) {
              c.fillStyle = pat;
              c.fillRect(rx, ry, rw, rh);
              var SP2 = global.DG.ground3d && global.DG.ground3d.seasonPaint ? global.DG.ground3d.seasonPaint(useKind) : null; c.globalAlpha = SP2 ? SP2.a : (useKind === 'road' ? core.tuned('world3d.roadTone', 0.55) : 0.30);   // W-0209   // W-0153 — 새 길 무늬(land_c 진한 주황)가 48m 칸 통째라 먼 띠로 보였다: 길 칸만 제 색(옅은 베이지)을 덮어 칠한다
              c.globalCompositeOperation = useKind === 'road' || SP2 ? 'source-over' : 'multiply';
              c.fillStyle = baseCol;
              c.fillRect(rx, ry, rw, rh);
              c.globalCompositeOperation = 'source-over';
              c.globalAlpha = 1;
            } else {
              c.fillStyle = shadeHex(baseCol, (h1(gx * 17 + 5 + sx, gy * 23 + 9 + sy) - 0.5) * 0.06);
              c.fillRect(rx, ry, rw, rh);
            }
          }
        }
      }
    }

    for (gy = g0y; gy <= g1y; gy++) {
      for (gx = g0x; gx <= g1x; gx++) {
        if (FRt && FRt.snowCell(gx, gy)) { continue; }
        blendVariants(c, W.terrainAt(gx, gy), gx, gy, x0, y0, k, 1, W.terrainAt);
      }
    }

    var tex2 = new T.CanvasTexture(cv);
    tex2.colorSpace = T.SRGBColorSpace;
    tex2.anisotropy = 4;
    tex2.userData.gen = G.gen();
    landTex[ck] = tex2;
    return tex2;
  }

  api = { bind: bind, LAND_TEX_VARIANTS: LAND_TEX_VARIANTS, landTex: landTex, preloadLandTex: preloadLandTex, landTexture: landTexture, terrainTexture: terrainTexture };
  global.DG = global.DG || {};
  global.DG.world3dLandTex = api;
})(typeof window !== 'undefined' ? window : this);
