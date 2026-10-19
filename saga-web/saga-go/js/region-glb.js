/**
 * 이야기 지역 코드 도형 → 자체 world3d GLB (W-0319, 표 = region-glb-table.js · 원본 K-0125·K-0141 k125_markers.json)
 *
 * 지역 js(frost·crossing·…)의 build() 끝에서 한 줄로 부른다:  DG.regionGlb.apply('<지역>', st.model, g, o)
 *   ① 표에 그 model 이 있고 GLB 주소가 잡히면 `asset3d.build`(껍데기 먼저 → 받으면 갈아 끼움 · 툰·외곽선·캐시)로 GLB 를 세운다
 *   ② 높이 = 표의 h(m), 없으면 코드 도형(움직이는 부품 뺀 몸통)의 실제 높이 — 발은 땅(y 0), 가운데 맞춤
 *   ③ GLB 가 **다 받아진 뒤에만** 코드 몸통을 숨긴다 — 못 받으면(폰 가벼운 표·끈 손잡이·파일 없음) 코드 도형 그대로
 *   ④ o 에 쥔 것(깜빡이 등·도는 바늘·문·출렁 조각 = o.blink·o.spin·o.bob·o.flame·…)은 **남긴다** — 움직임·판정은 코드 몫.
 *      몸통인데 o 에 쥔 묶음은 표의 hide 로 숨긴다(설원 비행선 hull). parent 를 주면 GLB 를 그 묶음 안에 넣는다(같이 움직임)
 * 손잡이 `regionGlb.on`(1, 0 = 옛 코드 도형) · 판정 몸(충돌 사각형)은 지역 js 그대로라 안 바뀐다.
 */
(function (global) {
  'use strict';
  var pend = [], timer = 0, stats = { asked: 0, glb: 0, fail: 0, skip: 0 };
  function C() { return global.DG && global.DG.core; }
  function ON() { var c = C(); return !(c && c.tuned && !c.tuned('regionGlb.on', 1)); }
  function entry(region, model) { var t = global.DG.regionGlbTable || {}; return (t[region] && t[region][model]) || null; }

  /** 순수 — o 에서 남길 것(움직이는 부품) 목록. 배열 칸은 원소마다 · root·hide 이름·Object3D 아닌 값은 뺀다 */
  function keepOf(o, root, hide) {
    var out = [], k, v, i, add = function (x) { if (x && x.isObject3D && x !== root && out.indexOf(x) < 0) { out.push(x); } };
    for (k in o) {
      if (!Object.prototype.hasOwnProperty.call(o, k) || k === 'root' || (hide && hide.indexOf(k) >= 0)) { continue; }
      v = o[k];
      if (Array.isArray(v)) { for (i = 0; i < v.length; i++) { add(v[i]); } } else { add(v); }
    }
    return out;
  }
  function under(x, list) { for (var p = x; p; p = p.parent) { if (list.indexOf(p) >= 0) { return true; } } return false; }
  /** 코드 몸통(남길 것 빼고)의 높이 — m */
  function bodyHeight(T, g, keep) {
    g.updateMatrixWorld(true);
    var b = new T.Box3(), one = new T.Box3(), any = false;
    g.traverse(function (x) {
      if (!x.isMesh || under(x, keep)) { return; }
      if (!x.geometry.boundingBox) { x.geometry.computeBoundingBox(); }
      one.copy(x.geometry.boundingBox).applyMatrix4(x.matrixWorld); b.union(one); any = true;
    });
    return any ? Math.max(0.2, b.max.y - Math.max(b.min.y, g.position.y - 0.5)) : 0;
  }
  function hideBody(p) {
    p.g.traverse(function (x) { if ((x.isMesh || x.isPoints || x.isLine) && !under(x, p.keep) && !under(x, [p.shell])) { x.visible = false; } });
  }
  function watch() {
    var now = Date.now(), i, p, s;
    for (i = pend.length - 1; i >= 0; i--) {
      p = pend[i]; s = p.shell.userData.assetState;
      if (s === 'glb') { hideBody(p); stats.glb++; pend.splice(i, 1); }
      else if (s === 'fail' || now - p.t > 90000) { stats.fail++; if (p.shell.parent) { p.shell.parent.remove(p.shell); } pend.splice(i, 1); }
    }
    if (!pend.length && timer) { global.clearInterval(timer); timer = 0; }
  }

  /** 지역 build() 끝에서 — g 는 아직 제자리(원점)에 놓이기 전. 세운 껍데기(또는 null) */
  function apply(region, model, g, o) {
    var e = entry(region, model);
    if (!e) { return null; }
    stats.asked++;
    var D = global.DG, A3 = D.asset3d, AS = D.assets3d, T = global.THREE;
    var url = ON() && AS && AS.url ? AS.url('world', e.id) : null;
    if (!url || !A3 || !A3.build || !A3.register || !T) { stats.skip++; return null; }
    var keep = keepOf(o || {}, g, e.hide);
    var h = e.h || bodyHeight(T, g, keep);
    if (!(h > 0)) { stats.skip++; return null; }
    var kind = 'rglb_' + e.id;
    A3.register(kind, url);
    var shell = A3.build(kind, { id: e.id }, function () { return new T.Group(); });
    if (!shell) { stats.skip++; return null; }
    shell.scale.setScalar(h);
    var host = (e.parent && o && o[e.parent] && o[e.parent].isObject3D) ? o[e.parent] : g;
    host.add(shell);
    pend.push({ g: g, shell: shell, keep: keep, t: Date.now() });
    if (!timer) { timer = global.setInterval(watch, 300); }
    return shell;
  }

  global.DG = global.DG || {};
  global.DG.regionGlb = { apply: apply, entry: entry, keepOf: keepOf, ON: ON, stats: function () { return { asked: stats.asked, glb: stats.glb, fail: stats.fail, skip: stats.skip, pending: pend.length }; } };
})(window);
