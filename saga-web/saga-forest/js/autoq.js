/**
 * autoq.js — 품질 "자동"의 FPS 내리기(W-0302 폰 성능). 순수 상태 기계 — 그림·DOM 없음.
 *
 * 3마을·5천하는 품질 'auto' 를 켤 때 한 번 기기 점수(코어·메모리·화소·터치)로만 골라, 폰도 HIGH 가 나오면 실제 FPS 가 낮아도
 * 끝까지 HIGH 였다(W-0302 측정: 폰 흉내 7~10fps 에 HIGH). 이 부품은 'auto' 일 때만 프레임 간격을 모아 `win` 초 평균 FPS 가
 * `low` 아래면 한 단계 내린다(high → medium → low). 다시 올리진 않는다(오가며 셰이더를 통째로 다시 굽는 게 더 비싸다).
 * 사람이 고른 low/medium/high 는 안 건드린다(HIGH 품질 그대로 — 원신급 기준선).
 *
 * 쓰는 법: var aq = DG.autoq.make('village3d');  매 프레임 if (aq.note(dt, isAuto)) { 다시 적용 }  ·  등급 = aq.lower(기기 등급)
 * 손잡이: <키>.lowFps(기본 26) · <키>.lowWin(초, 기본 3) · autoq.on(0 이면 끔)
 */
(function (global) {
  'use strict';
  var ORDER = ['high', 'medium', 'low'];
  function tn(k, d) { var C = global.DG && global.DG.core, v = C && C.tuned ? +C.tuned(k, d) : d; return isFinite(v) ? v : d; }
  function make(key) {
    var st = { down: 0, t: 0, n: 0, grace: 0 };
    return {
      st: st,
      /** 프레임 하나(dt 초). auto 가 아니면 세지 않는다. 한 단계 내려야 하면 true(부른 쪽이 픽셀비·그림자를 다시 먹인다) */
      note: function (dt, isAuto) {
        if (!isAuto || !(dt > 0) || dt > 1 || !tn('autoq.on', 1) || st.down >= ORDER.length - 1) { st.t = 0; st.n = 0; return false; }
        if (st.grace > 0) { st.grace -= dt; return false; }   // 내린 직후는 다시 굽는 동안 느리다 — 한 창 쉬고 잰다
        st.t += dt; st.n++;
        if (st.t < tn(key + '.lowWin', 3)) { return false; }
        var fps = st.n / st.t; st.t = 0; st.n = 0;
        if (fps >= tn(key + '.lowFps', 26)) { return false; }
        st.down++; st.grace = tn(key + '.lowWin', 3);
        return true;
      },
      /** 기기 등급(high/medium/low)을 내린 단계만큼 낮춘다 */
      lower: function (tier) { var i = ORDER.indexOf(tier); return i < 0 ? tier : ORDER[Math.min(ORDER.length - 1, i + st.down)]; },
      reset: function () { st.down = 0; st.t = 0; st.n = 0; st.grace = 0; }
    };
  }
  global.DG = global.DG || {};
  global.DG.autoq = { make: make, ORDER: ORDER };
})(typeof window !== 'undefined' ? window : this);
