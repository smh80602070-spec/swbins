  /* ── 땅의 소재 텍스처 — js/world3d-landtex.js(R-4). 같은 이름 한 줄 넘김 · 캐시 객체는 같은 것을 본다 ─────────── */
  var syncGen = 0;   // 세대 카운터 — syncGround 가 올리고 텍스처가 userData.gen 에 찍는다(안 쓰인 칸 버리기)
  var ltBind = null, LTXM = global.DG.world3dLandTex, LAND_TEX_VARIANTS = LTXM.LAND_TEX_VARIANTS, landTex = LTXM.landTex;
  function LTX() { return LTXM.bind(ltBind || (ltBind = { LAND_COLOR: LAND_COLOR, LAND_PAINT: LAND_PAINT, PAINT_A: PAINT_A, GRID: GRID, h1: h1, gen: function () { return syncGen; }, three: function () { return T; } })); }
  function preloadLandTex() { return LTX().preloadLandTex.apply(null, arguments); } function landTexture() { return LTX().landTexture.apply(null, arguments); } function terrainTexture() { return LTX().terrainTexture.apply(null, arguments); }

  /* ── 땅의 높낮이 (PLAN 14절) ─────────────────────────
   * 값은 `relief3d.js` 가 낸다(순수 함수). 여기 있는 것은 **그 값을 화면에
   * 바르는 일**뿐이다 — 지면 정점을 밀고, 배우를 앉히고, 카메라를 띄운다.
   * `world.js` 의 좌표·거리·스폰은 여전히 평면 2D 라 **균형이 안 움직인다.**
   */
  function RELIEF() { return global.DG.relief3d || null; }
  function RELIEF_ON() { var R = RELIEF(); return !!(R && R.on()); }
  /** 타일 한 장을 몇 칸으로 나누나 — 클수록 곱지만 정점이 제곱으로 는다 */
  function RELIEF_SEG() { return Math.max(1, Math.round(core.tuned('relief3d.seg', 8))); }

  /** 그 자리의 땅 높이(m). 높낮이가 꺼져 있으면 0 — 부르는 쪽은 몰라도 된다 */
  function groundY(x, z) {
    var R = RELIEF();
    return R ? R.heightAt(x, z) : 0;
  }
  /**
   * §5 ⑲-20 구름섬 — 섬 층(sky)에 선 몸은 섬 윗면에 선다. 섬 밑 땅은 그대로라 층을 모르면 안 올린다.
   * standY 의 sky 를 안 주면 **내 층**(landform.onSky) — 예고 원·광역 고리처럼 내 곁에 그리는 것
   */
  function meSky() { var LF = global.DG.landform; return !!(LF && LF.onSky && LF.onSky()); }
  function skyLift(x, z, sky) {
    var SK = global.DG.skyIsle, pd;
    if (!sky || !SK || !SK.layerOn || !SK.layerOn() || !(pd = SK.padAt(x, z))) { return 0; }   // ⑲-35 그 자리 발판(섬·관측대)
    return Math.max(0, pd.top - groundY(x, z));
  }
  function standY(x, z, sky) { return groundY(x, z) + skyLift(x, z, sky === undefined ? meSky() : sky); }
  /**
   * 화면 점(clientX, clientY) → 땅 위 세계 자리 {x, y} (2026-09-27 실기 "마우스로 클릭한 곳으로 이동도 안 함").
   * 3인칭 원근 카메라라 2D 캔버스 역산(world.unproject)으로는 누른 자리와 어긋난다 — 카메라 광선을 쏴서
   * 땅(높낮이·내 층 발판 포함)에 처음 닿는 자리를 찾는다. 2m 씩 나아가다 넘으면 반으로 좁힌다. 땅에 안 닿으면 null
   */
  function pickGround(cx, cy) {
    if (!camera || !canvas || !T) { return null; }
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) { return null; }
    var nx = (cx - r.left) / r.width * 2 - 1, ny = -((cy - r.top) / r.height) * 2 + 1;
    camera.updateMatrixWorld();
    var o = camera.position.clone(), d = new T.Vector3(nx, ny, 0.5).unproject(camera).sub(o).normalize();
    var sky = meSky(), prev = 0, t, i;
    function above(s) { var x = o.x + d.x * s, z = o.z + d.z * s; return o.y + d.y * s - standY(x, z, sky); }
    if (above(0) < 0) { return null; }
    for (t = 2; t <= 900; t += 2) {
      if (above(t) <= 0) {
        var lo = prev, hi = t;
        for (i = 0; i < 12; i++) { var mid = (lo + hi) / 2; if (above(mid) > 0) { lo = mid; } else { hi = mid; } }
        return { x: o.x + d.x * hi, y: o.z + d.z * hi };
      }
      prev = t;
    }
    return null;
  }

  /**
   * 타일 한 장의 정점을 실제 높이로 민다.
   *
   * **눕히기 전 좌표계라 y 가 아니라 z 를 민다.** 이 메시는 `rotation.x = -90°`
   * 로 눕혀 놓았으므로, 로컬의 +z 가 월드의 +y 다. 여기서 y 를 밀면 땅이
   * 옆으로 밀린다(한 번 밟았다).
   *
   * 같은 자리에 다시 깔릴 때는 **건너뛴다** — 타일은 격자를 넘을 때마다 재활용되는데
   * 매번 정점 수백 개를 다시 재면 걸을 때마다 화면이 걸린다.
   */
  function liftTile(mesh, x0, z0, span) {
    if (!RELIEF_ON()) { return false; }
    var mark = Math.round(x0) + '/' + Math.round(z0) + '/' + Math.round(span);
    if (mesh.userData.lifted === mark) { return false; }
    var pos = mesh.geometry.getAttribute('position');
    if (!pos) { return false; }
    var i;
    for (i = 0; i < pos.count; i++) {
      /* 로컬 x·y → 월드 x·z (눕히기 전이므로 로컬 y 가 월드 z 의 **반대**다) */
      var lx = pos.getX(i), ly = pos.getY(i);
      var wx = x0 + span / 2 + lx;
      var wz = z0 + span / 2 - ly;
      pos.setZ(i, groundY(wx, wz));
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.userData.lifted = mark;
    return true;
  }

  /** 지도 타일을 카메라 둘레에만 깐다 (멀어진 것은 지운다) */
  /* 발열(2026-09-24 "핸드폰 불남") — 가만히 서 있어도 매 프레임 49장 × (열쇠 문자열·계절·landTexture 의 땅 소유 검사 ~36번)을
     다시 돌았다. 선 칸·배율·물감·반경이 그대로고 지난번에 모든 장이 칠해졌으면 건너뛴다(계절·손으로 그린 땅이 바뀌는
     경우를 위해 5초에 한 번은 그대로 다시 돈다) */
  var groundKey = '', groundAt = 0, GROUND_REFRESH_MS = 5000;
  function syncGround(W) {
    var mpp = W.metersPerPixel();
    var span = W.TILE_PX * mpp;                     // 타일 한 장이 덮는 미터
    var pos = core.save.player.pos;
    var ll = W.worldToLatLng(pos.x, pos.y);
    var px = W.latLngToPixel(ll.lat, ll.lng);
    var cx = Math.floor(px.x / W.TILE_PX), cy = Math.floor(px.y / W.TILE_PX);
    var R = TILE_SPAN(), live = {};
    /* 밤에는 지도 자체가 어두워야 한다 — 타일 색에 조명의 물감을 곱한다.
       (지도 이미지는 늘 한낮 그림이라, 안 곱하면 밤에 땅만 대낮이다) */
    var tint = lightNow ? lightNow.tint : 0xffffff;
    var gk = (+core.tuned('go.zoneM', 576) > 0 ? Math.floor(pos.x / +core.tuned('go.zoneM', 576) + 0.5) + 'z' + Math.floor(pos.y / +core.tuned('go.zoneM', 576) + 0.5) + '/' : '') + cx + '/' + cy + '/' + mpp + '/' + tint + '/' + R + '/' + (RELIEF_ON() ? 1 : 0), gNow = Date.now();
    if (gk === groundKey && gNow - groundAt < GROUND_REFRESH_MS) { return; }
    var groundPending = false;
    syncGen++; var gZM = +core.tuned('go.zoneGround', 1) === 1 ? +core.tuned('go.zoneM', 576) : 0, gZP = 160, gZx0 = gZM ? (Math.floor(pos.x / gZM + 0.5) - 0.5) * gZM - gZP : 0, gZy0 = gZM ? (Math.floor(pos.y / gZM + 0.5) - 0.5) * gZM - gZP : 0, gZx1 = gZx0 + gZM + 2 * gZP, gZy1 = gZy0 + gZM + 2 * gZP;

    for (var dy = -R; dy <= R; dy++) {
      for (var dx = -R; dx <= R; dx++) {
        var tx = cx + dx, ty = cy + dy;
        var key = tx + '/' + ty;
        live[key] = 1;
        var mesh = tileMeshes[key];
        var corner = worldOfLatLng(tile2lat(ty, W), tile2lng(tx, W)); if (gZM > 0 && (corner.x + span < gZx0 || corner.x > gZx1 || corner.y + span < gZy0 || corner.y > gZy1)) { delete live[key]; continue; }   // W-0417 구역(go.zoneM)+여유 밖 땅은 안 짓는다 — 폰 발열(49장 → ≈9장), 경계는 안개 벽(zone-wire)
        if (!mesh) {
          /* **한 장을 잘게 나눈다.** 여태 네 꼭짓점뿐이라 아무리 높이를 줘도
             땅이 기울 뿐 굽지 않았다. 241m 타일을 `RELIEF_SEG` 칸으로 나누면
             한 칸이 30m 남짓 — 지형 격자(48m)보다 촘촘해 경사가 살아난다 */
          var seg = RELIEF_ON() ? RELIEF_SEG() : 1;
          var geo = new T.PlaneGeometry(span, span, seg, seg);
          var mat = new T.MeshLambertMaterial({ color: 0x1a1f28 }); if (global.DG.ground3d) { global.DG.ground3d.detail(mat); }   // W-0200 가까운 땅 결
          mesh = new T.Mesh(geo, mat);
          mesh.rotation.x = -Math.PI / 2;           // 눕힌다
          mesh.receiveShadow = true;
          groundGroup.add(mesh);
          tileMeshes[key] = mesh;
          mesh.userData.lifted = '';
        }
        /* 타일의 왼쪽 위 모서리를 월드 미터로 환산해 한가운데에 놓는다 */
        mesh.position.set(corner.x + span / 2, -0.02, corner.y + span / 2);
        liftTile(mesh, corner.x, corner.y, span);

        /* 그림은 제 손으로 칠한 땅(landTexture)·지형 재질(terrainTexture) — OSM 타일은 안 받는다(W-0207) */
        var tex = landTexture(key, corner.x, corner.y, span) ||
          terrainTexture(W, corner.x, corner.y, span);
        if (tex) {
          if (mesh.material.map !== tex) {
            mesh.material.map = tex;
            mesh.material.needsUpdate = true;
          }
          mesh.material.color.setHex(tint);
        } else {
          /* 아직 지도가 안 온 자리. 지형색으로 칠하면 **242m 짜리 색 덩어리**가 생겨
             지도가 그렇게 생긴 줄 알게 된다 — 옅은 종이색으로 비워 둔다.
             타일이 오면 위에서 곧바로 갈아 끼운다. */
          mesh.material.color.setHex(mixHex(0xd7dbe0, tint, 0.85));
          groundPending = true;                    // 아직 안 온 장이 있다 — 다음 프레임도 다시 본다
        }
      }
    }
    groundKey = groundPending ? '' : gk; groundAt = gNow;
    for (var k in tileMeshes) {
      if (!Object.prototype.hasOwnProperty.call(tileMeshes, k) || live[k]) { continue; }
      var m = tileMeshes[k];
      groundGroup.remove(m);
      m.geometry.dispose();
      m.material.dispose();
      delete tileMeshes[k];
    }
    /* `landTex` 청소(2026-09-05, "바닥 텍스처가 안 지워진다" 로 발견) — 위
       루프가 화면 밖 **메시**는 지우지만, 그 메시가 물려 쓰던 구운
       `CanvasTexture`는 `landTex` 캐시에 그대로 남아 GPU 메모리를 붙들고
       있었다(플레이어가 걸을수록 무한정 쌓임). 이번 세대(`syncGen`)에
       위에서 아무 살아있는 타일도 다시 찾지 않은 항목은 이제 어느 메시도
       참조하지 않는다는 뜻이므로 안전하게 버린다 */
    for (var ck in landTex) {
      if (!Object.prototype.hasOwnProperty.call(landTex, ck)) { continue; }
      if (landTex[ck].userData.gen === syncGen) { continue; }
      landTex[ck].dispose();
      delete landTex[ck];
    }
  }

  function tile2lng(x, W) { return x / Math.pow(2, W.ZOOM) * 360 - 180; }
  function tile2lat(y, W) {
    var n = Math.PI - 2 * Math.PI * y / Math.pow(2, W.ZOOM);
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }
  function worldOfLatLng(lat, lng) {
    var o = global.DG.world.origin;
    var mPerLat = 111320;
    var mPerLng = 111320 * Math.cos(o.lat * Math.PI / 180);
    return { x: (lng - o.lng) * mPerLng, y: -(lat - o.lat) * mPerLat };
  }

