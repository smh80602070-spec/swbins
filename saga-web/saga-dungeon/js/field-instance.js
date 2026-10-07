/**
 * 들판 자연물 인스턴싱 — 2026-09-06, PLAN §18/SAGA WEB.md §6 "draw call 최소화 ·
 * Instancing 적극 활용"
 * ---------------------------------------------------------------
 * `field3d.js`(chunkAt/clutterAt)가 뱉는 나무·죽은나무·바위·덤불·풀·꽃·버섯·
 * 통나무는 여태 `dungeon3d.js`의 `piece()`가 하나씩 `asset3d.build()`로 세웠다 —
 * GLB 하나 세울 때마다 씬 전체를 클론해 **개별 draw call**을 만드는 방식이다.
 * HIGH 등급(`FIELD_R()`=6 → 13×13=169 조각)이면 숲 조각 하나에 나무만 7~14그루라
 * 순식간에 드로우콜이 수백~천 단위로 붙는 자리였다.
 *
 * 이 여덟 가지는 전부 **뼈대 애니메이션이 없는 정적 장식**이고, 전투 피격
 * 번쩍임(`asset3d.ownAllMat`/`flashAllMat`)도 안 걸린다(그건 배우 — 사람·짐승
 * 에만 쓰인다) — 그래서 재질을 인스턴스마다 따로 건드릴 필요가 없다.
 * `THREE.InstancedMesh` 로 묶기에 가장 안전한 자리다.
 *
 * **사람·몬스터는 여기서 다루지 않는다** — `asset3d.buildHero`/`build`(걷기·
 * 공격 애니메이션이 있는 것들)는 개체마다 뼈대 포즈가 달라 인스턴싱이 안
 * 통한다. 개체 수도 적어(적 몇 + 플레이어 1) 급하지 않다. 폐허 기둥·벽·절벽·
 * 제단·천막·모닥불·표지판·연못·길 같은 나머지 들판 소품도 이번엔 손 안 댔다
 * (조각당 개수가 1~4개뿐이라 이득이 작고, 일부는 인스턴스마다 다른 장식을
 * 덧붙인다 — 제단의 떠 있는 구슬, 모닥불의 불빛 등 — 순수 반복 소품이 아니다).
 *
 * ── 좌표 합성 ──────────────────────────────────────────
 * 옛 `piece()`는 shell(월드 배치) 안에 asset3d 의 `normalize()`(키 1 로 맞추는
 * 오프셋·스케일)를 넣고, 그 안에 원본 GLB 씬을 넣는 3단 중첩이었다. 인스턴스
 * 하나의 최종 행렬은 그 세 단을 그대로 곱한 것과 같다:
 *
 *   최종 = 월드배치(위치·Y회전) × 정규화(오프셋·스케일) × 부위행렬(GLB 안에서의 위치)
 *
 * `ensureParts()`가 GLB 하나당 "부위행렬"(각 메시의 matrixWorld, 씬 루트 기준)과
 * "정규화 값"(`asset3d.fit()`)을 **한 번만** 계산해 캐시해 둔다 — 그 뒤로는
 * 인스턴스마다 행렬 곱셈만 하면 된다. **GLB 루트 자체의 회전·스케일은 없다고
 * 가정한다** — `asset3d.js`의 `normalize()`도 같은 가정으로 짜여 있고, 지금까지
 * 받은 CC0/CC-BY 에셋 전부가 그렇다.
 *
 * `frustumCulled = false` 로 둔다 — 씬 하나에 흩어진 인스턴스 전체의 경계구를
 * three 버전에 따라 제대로 못 잡는 경우가 있어(개별 draw call 로 나눠 그리던
 * 옛 방식은 물체마다 컬링이 정확했다), 안전하게 끈다. 대신 **자리마다** 자른다
 * (`cull()`, 2026-09-25): 덩이마다 행렬·경계구를 따로 적어 두고, 카메라가 움직일 때
 * 시야(안개 끝 안)에 걸린 자리만 `instanceMatrix` 앞쪽에 채운다. 폰 점검에서 마을
 * 첫 화면이 시야 밖 자연물 삼각형 138만을 그리고 있었다. 이 덩이들은 그림자를
 * 안 드리운다(castShadow 끔) — 그림자 상자는 안 본다.
 */
(function (global) {
  'use strict';

  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }

  var gen = 0;                  // build() 세대 — 방이 바뀌면 늘어난다. 옛 콜백은 무시한다
  var partsCache = {};           // url -> {ready:true, parts:[{geometry,material,matrix}], fit} | {ready:false, waiting:[]}
  var lastStats = { kinds: 0, meshes: 0, instances: 0, fallback: 0 };
  var liveMeshes = [];           // 지금 세대의 덩이들 — cull() 이 자리마다 자른다
  var cullStat = { all: 0, drawn: 0, runs: 0 };

  /** 덩이에 자리별 원본 행렬·경계구(덩이 지역 좌표)를 적어 둔다 */
  function keepForCull(mesh) {
    var n = mesh.count, g = mesh.geometry;
    if (!g.boundingSphere) { g.computeBoundingSphere(); }
    var bs = g.boundingSphere, all = new Float32Array(mesh.instanceMatrix.array.subarray(0, n * 16));
    var sph = new Float32Array(n * 4), m = new (three().Matrix4)(), c = bs.center.clone(), v = new (three().Vector3)();
    for (var i = 0; i < n; i++) {
      m.fromArray(all, i * 16);
      v.copy(c).applyMatrix4(m);
      sph[i * 4] = v.x; sph[i * 4 + 1] = v.y; sph[i * 4 + 2] = v.z;
      sph[i * 4 + 3] = bs.radius * m.getMaxScaleOnAxis();
    }
    mesh.userData.fic = { all: all, sph: sph, n: n };
    liveMeshes.push(mesh);
  }

  var cullFr = null, cullPV = null, cullLast = null, cullFog = -1;
  function cull(camera, scene) {
    var t = three();
    if (!t || !camera || !liveMeshes.length) { return; }
    if (!cullFr) { cullFr = new t.Frustum(); cullPV = new t.Matrix4(); cullLast = new t.Matrix4(); }
    camera.updateMatrixWorld();
    cullPV.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    var fog = scene && scene.fog && scene.fog.isFog ? scene.fog.far : 0;
    var fresh = false, k;
    for (k = 0; k < liveMeshes.length; k++) { if (!liveMeshes[k].userData.ficDone) { fresh = true; break; } }
    if (!fresh && cullPV.equals(cullLast) && fog === cullFog) { return; }
    cullLast.copy(cullPV); cullFog = fog;
    cullFr.setFromProjectionMatrix(cullPV);
    var pl = cullFr.planes, cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    var all = 0, drawn = 0;
    for (k = 0; k < liveMeshes.length; k++) {
      var mesh = liveMeshes[k], U = mesh.userData.fic;
      if (!mesh.parent) { continue; }                 // 방이 바뀌어 떨어져 나간 덩이
      mesh.updateMatrixWorld();
      var e = mesh.matrixWorld.elements, sc = mesh.matrixWorld.getMaxScaleOnAxis();
      var arr = mesh.instanceMatrix.array, sp = U.sph, j = 0;
      all += U.n;
      for (var i = 0; i < U.n; i++) {
        var lx = sp[i * 4], ly = sp[i * 4 + 1], lz = sp[i * 4 + 2], r = sp[i * 4 + 3] * sc;
        var x = e[0] * lx + e[4] * ly + e[8] * lz + e[12];
        var y = e[1] * lx + e[5] * ly + e[9] * lz + e[13];
        var z = e[2] * lx + e[6] * ly + e[10] * lz + e[14];
        var out = false;
        for (var q = 0; q < 6; q++) {
          var nn = pl[q].normal;
          if (nn.x * x + nn.y * y + nn.z * z + pl[q].constant < -r) { out = true; break; }
        }
        if (out) { continue; }
        if (fog) {
          var dx = x - cx, dy = y - cy, dz = z - cz, lim = fog + r;
          if (dx * dx + dy * dy + dz * dz > lim * lim) { continue; }
        }
        arr.set(U.all.subarray(i * 16, i * 16 + 16), j * 16);
        j++;
      }
      mesh.count = j;
      mesh.userData.ficDone = true;
      if (j) {
        var ia = mesh.instanceMatrix;
        if (ia.clearUpdateRanges) { ia.clearUpdateRanges(); ia.addUpdateRange(0, j * 16); }
        ia.needsUpdate = true;
      }
      drawn += j;
    }
    cullStat.all = all; cullStat.drawn = drawn; cullStat.runs++;
  }

  function extractParts(scene) {
    var out = [];
    scene.updateMatrixWorld(true);
    scene.traverse(function (o) {
      if (!o.isMesh) { return; }
      out.push({
        geometry: o.geometry,
        material: Array.isArray(o.material) ? o.material[0] : o.material,
        matrix: o.matrixWorld.clone()
      });
    });
    return out;
  }

  /** url 하나당 부위·정규화 값을 한 번만 계산해 캐시한다(사가만리류 acquire() 와 같은 요령) */
  function ensureParts(url, done) {
    var c = partsCache[url];
    if (c) {
      if (c.ready !== undefined) { done(c); } else { c.waiting.push(done); }
      return;
    }
    c = partsCache[url] = { waiting: [done] };
    var AS = global.DG.asset3d, t = three();
    if (!AS || !AS.rawScene || !t) { c.ready = false; flush(); return; }
    AS.rawScene(url, function (scene) {
      if (!scene) { c.ready = false; flush(); return; }
      var b = new t.Box3().setFromObject(scene);
      c.fit = AS.fit({ minX: b.min.x, maxX: b.max.x, minY: b.min.y, maxY: b.max.y, minZ: b.min.z, maxZ: b.max.z });
      c.parts = extractParts(scene);
      c.ready = true;
      flush();
    });
    function flush() { var w = c.waiting; c.waiting = []; for (var i = 0; i < w.length; i++) { w[i](c); } }
  }

  /* ── 행렬 합성 — 스크래치를 재사용해 매 인스턴스 할당(GC)을 줄인다.
   * `setMatrixAt()`가 그 자리에서 값을 배열에 복사하므로 다음 인스턴스에서
   * 덮어써도 안전하다(참조를 들고 있지 않는다). */
  var _pos = null, _quat = null, _scale = null, _axisY = null, _m1 = null, _m2 = null;
  function scratch(t) {
    if (_pos) { return; }
    _pos = new t.Vector3(); _quat = new t.Quaternion(); _scale = new t.Vector3();
    _axisY = new t.Vector3(0, 1, 0); _m1 = new t.Matrix4(); _m2 = new t.Matrix4();
  }
  function trs(t, out, x, y, z, rotY, sx, sy, sz) {
    /* 2026-09-06 — `out`은 대개 호출부가 `_m1`/`_m2`를 인자로 넘긴 것인데,
       그 값은 이 함수에 들어오기 **전에** 평가된다 — 세션에서 이 함수가
       한 번도 안 불렸을 때(첫 인스턴싱)는 `_m1`/`_m2`가 아직 null이라
       `out`도 null로 넘어와, 아래서 `scratch(t)`가 모듈 변수를 채워도 이미
       넘어온 `out`은 그대로 null이라 `out.compose()`가 터졌다("인스턴싱
       실패" 콘솔 에러). 호출부가 `_m1`/`_m2`를 인자로 평가하기 **전에**
       미리 채워 둬야 한다 — buildFallback()/buildGlbGroup() 진입 시점에도
       한 번 부른다(아래). 여기 이 줄은 그 안전망일 뿐이다(회귀 없음). */
    scratch(t);
    _pos.set(x, y, z);
    _quat.setFromAxisAngle(_axisY, rotY || 0);
    _scale.set(sx, sy, sz);
    out.compose(_pos, _quat, _scale);
    return out;
  }

  /**
   * 옛 `piece()`의 makeShape()가 그리던 것과 같은 상자(나무만 둘 — 줄기·수관).
   * **이 색·비율은 옛 코드를 그대로 옮긴 것이다** — 바위만 예외로, 원래
   * 방 테마색(`mix(stone,...)`)을 썼던 것을 고정 회색으로 단순화했다(이
   * 폴백은 GLB 가 아직 안 왔거나 못 받는 자리에서만 잠깐 또는 계속
   * 보이는 자리라 — 다른 대체품과 같은 판단, "정확히 안 맞아도 된다").
   */
  function fallbackParts(kind, h, s) {
    if (kind === 'tree') {
      return [
        { color: 0x3a2c1e, x: 0, y: h * 0.22, z: 0, sx: 9 * s, sy: h * 0.44, sz: 9 * s },
        { color: 0x24361f, x: 0, y: h * 0.68, z: 0, sx: h * 0.62 * s, sy: h * 0.7, sz: h * 0.62 * s }
      ];
    }
    if (kind === 'tree_dead') {
      return [{ color: 0x2a2016, x: 0, y: h * 0.5, z: 0, sx: 7 * s, sy: h, sz: 7 * s }];
    }
    if (kind === 'rock') {
      return [{ color: 0x55524a, x: 0, y: h * 0.4, z: 0, sx: h * 1.3 * s, sy: h * 0.9, sz: h * 1.1 * s }];
    }
    if (kind === 'log') {
      return [{ color: 0x4a3826, x: 0, y: h / 2, z: 0, sx: h * 2.2, sy: h, sz: h * 0.9 }];
    }
    var col = kind === 'flower' ? 0xd88fc0 : (kind === 'mushroom' ? 0xc94f4f : 0x3f5a34); // bush·grass
    return [{ color: col, x: 0, y: h / 2, z: 0, sx: h * 0.7, sy: h, sz: h * 0.7 }];
  }

  var unitBoxGeo = null;
  function unitBox(t) { if (!unitBoxGeo) { unitBoxGeo = new t.BoxGeometry(1, 1, 1); } return unitBoxGeo; }
  var fbMatCache = {};
  function fallbackMat(t, hex) {
    var k = 'fb|' + hex;
    if (!fbMatCache[k]) { fbMatCache[k] = new t.MeshLambertMaterial({ color: new t.Color(hex), flatShading: true }); }
    return fbMatCache[k];
  }

  /** 폴백 상자를 인스턴싱한다 — 파트가 여럿(나무: 줄기·수관)이면 파트마다 하나씩 */
  function buildFallback(t, group, kind, list) {
    if (!list.length) { return; }
    scratch(t);           // _m1/_m2를 미리 채운다 — 아래서 trs(t, _m1, ...)로 넘기기 전에
    var sample = fallbackParts(kind, list[0].h, list[0].s);
    var pi, i;
    for (pi = 0; pi < sample.length; pi++) {
      var mesh = new t.InstancedMesh(unitBox(t), fallbackMat(t, sample[pi].color), list.length);
      for (i = 0; i < list.length; i++) {
        var it = list[i];
        var part = fallbackParts(kind, it.h, it.s)[pi];
        trs(t, _m1, it.x, it.y, it.z, it.rot, 1, 1, 1);
        trs(t, _m2, part.x, part.y, part.z, 0, part.sx, part.sy, part.sz);
        mesh.setMatrixAt(i, _m1.multiply(_m2));
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      keepForCull(mesh);
      group.add(mesh);
      lastStats.meshes++; lastStats.instances += list.length; lastStats.fallback++;
    }
  }

  /** GLB 부위를 인스턴싱한다 — 파트(서브메시)마다 InstancedMesh 하나 */
  function buildGlbGroup(t, root, c, items) {
    scratch(t);           // _m1/_m2를 미리 채운다 — 아래서 trs(t, _m1, ...)로 넘기기 전에
    var pi, i;
    for (pi = 0; pi < c.parts.length; pi++) {
      var part = c.parts[pi];
      var mesh = new t.InstancedMesh(part.geometry, part.material, items.length);
      for (i = 0; i < items.length; i++) {
        var it = items[i];
        trs(t, _m1, it.x, it.y, it.z, it.rot, 1, 1, 1);
        trs(t, _m2, c.fit.dx * it.mul, c.fit.dy * it.mul, c.fit.dz * it.mul, 0,
          c.fit.scale * it.mul, c.fit.scale * it.mul, c.fit.scale * it.mul);
        mesh.setMatrixAt(i, _m1.multiply(_m2).multiply(part.matrix));
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      keepForCull(mesh);
      root.add(mesh);
      lastStats.meshes++; lastStats.instances += items.length;
    }
  }

  function buildKind(t, root, kind, list, myGen, AS) {
    /* 같은 kind 라도 자리마다 다른 파일일 수 있다(바위 5종·풀 2종 등) — url 별로 다시 묶는다 */
    var byUrl = {}, i, it, url, key;
    for (i = 0; i < list.length; i++) {
      it = list[i];
      url = (AS && AS.wants(kind, it.seed)) ? AS.urlOf(kind, it.seed) : null;
      key = url || '#none';
      if (!byUrl[key]) { byUrl[key] = { url: url, items: [] }; }
      byUrl[key].items.push(it);
    }
    var keys = Object.keys(byUrl), kk;
    for (kk = 0; kk < keys.length; kk++) {
      var bucket = byUrl[keys[kk]];
      try {
        if (!bucket.url) { buildFallback(t, root, kind, bucket.items); continue; }
        var cached = partsCache[bucket.url];
        if (cached && cached.ready === true) { buildGlbGroup(t, root, cached, bucket.items); continue; }
        if (cached && cached.ready === false) { buildFallback(t, root, kind, bucket.items); continue; }
        /* 아직 모른다(첫 로드) — 폴백을 먼저 보여주고, 오면 통째로 바꿔친다 */
        var fbGroup = new t.Group();
        buildFallback(t, fbGroup, kind, bucket.items);
        root.add(fbGroup);
        (function (fbGroup, items, bucketUrl) {
          ensureParts(bucketUrl, function (c) {
            if (myGen !== gen) { return; }             // 방이 이미 바뀌었다 — 버려진 그룹, 손 안 댐
            try {
              root.remove(fbGroup);
              if (c.ready) { buildGlbGroup(t, root, c, items); } else { buildFallback(t, root, kind, items); }
            } catch (e2) {
              if (global.console) { global.console.error('[fieldInstance] GLB 교체 실패(' + kind + ')', e2); }
            }
          });
        })(fbGroup, bucket.items, bucket.url);
      } catch (e) {
        /* 이 kind·이 url-묶음 하나만 포기한다 — 다른 종류(kind)까지 통째로
           멈추지 않는다(옛 piece() 방식과 같은 "하나 실패해도 나머지는 선다"). */
        if (global.console) { global.console.error('[fieldInstance] 인스턴싱 실패(' + kind + ')', e); }
      }
    }
  }

  /**
   * items: [{kind, seed, x, y, z, rot, h, s, mul}, …] — `dungeon3d.js`의
   * `buildField()`가 chunkAt()/clutterAt() 결과 중 자연물 여덟 가지만 추려 넘긴다.
   *   seed  asset3d.urlOf()/oneOf() 가 변형(바위 5종 등)을 고르는 데 쓰는 문자열
   *         — 옛 piece() 와 똑같이 `seed + ':' + round(x) + ':' + round(z)`
   *   h,s   폴백 상자 크기 계산용(옛 makeShape 의 p.h·p.s 그대로)
   *   mul   GLB 를 정규화(normalize)할 때 맞출 키 — 옛 piece() 가 넘기던 mul 그대로
   */
  function build(items) {
    var t = three();
    var root = t ? new t.Group() : null;
    if (!t || !root) { return { children: [] }; }   // three 없는 자리는 애초에 안 불린다(방어적)
    if (!items || !items.length) { return root; }
    var myGen = ++gen;
    lastStats = { kinds: 0, meshes: 0, instances: 0, fallback: 0 };
    liveMeshes = [];
    var AS = global.DG.asset3d;

    var byKind = {}, i, it;
    for (i = 0; i < items.length; i++) {
      it = items[i];
      if (!byKind[it.kind]) { byKind[it.kind] = []; }
      byKind[it.kind].push(it);
    }
    var kinds = Object.keys(byKind), k;
    lastStats.kinds = kinds.length;
    for (k = 0; k < kinds.length; k++) {
      try { buildKind(t, root, kinds[k], byKind[kinds[k]], myGen, AS); }
      catch (e) { if (global.console) { global.console.error('[fieldInstance] kind 처리 실패(' + kinds[k] + ')', e); } }
    }
    return root;
  }

  global.DG = global.DG || {};
  global.DG.fieldInstance = {
    build: build,
    stats: function () { return lastStats; },
    cull: cull,
    cullStats: function () { return { all: cullStat.all, drawn: cullStat.drawn, runs: cullStat.runs }; },
    clear: function () { partsCache = {}; }
  };
})(window);
