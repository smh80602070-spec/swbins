/**
 * 한 화면 부하를 숫자로 — `probe.js --perf` 가 장면마다 페이지 안에서 부른다(스크린샷 없음).
 *
 *   GLB   지금까지 받은 GLB·VRM 파일 수와 합친 크기(Resource Timing)
 *   배우  뼈대(SkinnedMesh 의 뿌리 뼈 부모) 수 — 보이는 것 / 전체
 *   호출  한 프레임 renderer.render 한 번의 그리기 호출(그림자 패스 포함, 가장 큰 렌더 기준)
 *   삼각  같은 렌더의 삼각형 수
 *   인스  InstancedMesh 가 실제로 그리는 자리 수(`count` 합) / 창고에 적힌 자리 수
 *   힙    JS 힙(performance.memory)
 *
 * 렌더러는 `Object3D.prototype.onBeforeRender` 를 잠깐 가로채 찾는다(판 코드를 안 건드린다). 1.5초씩 두 번 기다린다.
 * 2026-09-25 첫 측정(세로 main): 사가만리 삼각 782만 → 36만 · 사가천하 678만·호출 1060 → 127만·630 · 사가나락 236만 → 17만.
 */
'use strict';

module.exports = function perfProbe() {
  return new Promise(function (res) {
    var THREE = window.THREE;
    var r = performance.getEntriesByType('resource').filter(function (e) { return /\.(glb|vrm|gltf)(\?|$)/i.test(e.name); });
    var glb = 'GLB ' + r.length + '개 ' + (r.reduce(function (a, e) { return a + (e.decodedBodySize || 0); }, 0) / 1048576).toFixed(1) + 'MB';
    var heap = performance.memory ? ' · 힙 ' + (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + 'MB' : '';
    if (!THREE) { res(glb + heap + ' · 3D 없음'); return; }
    var P = THREE.Object3D.prototype, orig = P.onBeforeRender, rs = new Set(), sc = new Set();
    P.onBeforeRender = function (rd) { if (this.isScene) { rs.add(rd); sc.add(this); } return orig.apply(this, arguments); };
    setTimeout(function () {
      P.onBeforeRender = orig;
      var best = { calls: 0, tri: 0 };
      rs.forEach(function (rd) {
        var f = rd.render;
        rd.render = function () {
          f.apply(this, arguments);
          var i = rd.info.render;
          if (i.calls > best.calls) { best.calls = i.calls; best.tri = i.triangles; }
        };
        setTimeout(function () { rd.render = f; }, 1600);
      });
      setTimeout(function () {
        var arm = new Set(), armV = new Set(), idrawn = 0, iall = 0;
        var vis = function (n) { for (var q = n; q; q = q.parent) { if (!q.visible) { return false; } } return true; };
        sc.forEach(function (s) {
          s.traverse(function (n) {
            if (n.isSkinnedMesh && n.skeleton && n.skeleton.bones[0]) {
              var b = n.skeleton.bones[0];
              while (b.parent && b.parent.isBone) { b = b.parent; }
              var a = b.parent || b;
              arm.add(a);
              if (vis(n)) { armV.add(a); }
            }
            if (n.isInstancedMesh && vis(n)) {
              idrawn += n.count;
              var U = n.userData || {};
              iall += U.fic ? U.fic.n : U.cull ? U.cull.n : n.instanceMatrix.count;
            }
          });
        });
        res(glb + ' · 배우 ' + armV.size + '/' + arm.size + ' · 호출 ' + best.calls + ' · 삼각 ' + (best.tri / 1000 | 0) + 'k · 인스 ' + idrawn + '/' + iall + heap);
      }, 1500);
    }, 1500);
  });
};
