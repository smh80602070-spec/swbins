/**
 * look3d.js — 다섯 판 3D 한 벌 규격(W-0339, 원신+파판). 순수 표 — 그림·three 없음, post3d 가 읽는다.
 *
 * 10-19 사용자: "3D 는 원신+파판, 다섯 판 다 — 캐릭터만 멋짐 · 통일 안 됨". 판마다 빛 체계(시간대·분위기·방 깊이)가 달라
 * 원래 빛 값을 바꿔 끼우면 다섯 판을 하나하나 다시 맞춰야 한다. 그래서 **마지막 한 겹(post3d)** 에서 맞춘다:
 *   ① 한 벌 값(TABLE) — 톤 곡선·블룸·문턱·색보정 세기·림·외곽선 색. post3d·toon3d 기본값이 이 표를 본다
 *   ② 판별 보정(CAL) — 같은 조건(HIGH·맑음·낮) 촬영의 평균 휘도·색온도를 pw-look-compare.mjs 로 재어 맞춘 노출 배수·화이트밸런스.
 *      색은 **절반만** 당긴다(풀밭·돌바닥 같은 바탕색까지 지우면 회색이 된다) — 측정 → 보정 → 재측정으로 정한 숫자다
 * 손잡이: look3d.on(0 = 옛 값 그대로 — 노출 1·wb 1) · look3d.exposure(모든 판 공통 배수) · 판별 숫자는 CAL 만 고친다.
 *
 *   DG.look3d.game()  지금 판 폴더 이름(주소에서) · cal() → { exposure, wb:[r,g,b] } · val(키) → TABLE 값
 */
(function (global) {
  'use strict';
  var TABLE = {
    tone: 'neutral',            // 톤 곡선 — post3d 머리 설명 "ACES 가 아니다"(밤을 뭉갬) 그대로
    bloom: 1, threshold: 0.9, knee: 0.45, grade: 1,
    rim: { color: 0xfff0d8, power: 2.4, intensity: 0.9 },
    outline: { color: 0x14120f }
  };
  /* pw-look-compare.mjs 측정(10-20, Radeon Pro 570X · HIGH · 1280×720 · 정오/낮 고정) → look-calibrate.mjs --target 0.11 --alpha 0.75 네 번.
     전: 휘도 0.236/0.044/0.029/0.050/0.028(1만리만 밝음)·3,800~5,240K → 후: 0.110 근처 차 7.1%·차 542K. 숫자는 손으로 고치지 말고 다시 재서 쓴다 */
  var CAL = {
    'saga-go': { exposure: 0.512, wb: [0.832, 1.051, 0.989] },
    'saga-dungeon': { exposure: 2.089, wb: [0.914, 1.054, 0.722] },
    'saga-forest': { exposure: 3.747, wb: [0.847, 0.986, 1.591] },
    'saga-story': { exposure: 2.16, wb: [1.315, 0.909, 0.971] },
    'saga-realm': { exposure: 1.653, wb: [1.128, 0.977, 0.849] }
  };
  var OFF = { exposure: 1, wb: [1, 1, 1] };
  function tn(k, d) { var C = global.DG && global.DG.core, v = C && C.tuned ? C.tuned(k, d) : d; return v === undefined || v === null ? d : v; }
  function on() { return !!(+tn('look3d.on', 1)); }
  var gameMemo = null;
  function game() {
    if (gameMemo !== null) { return gameMemo; }
    var p = (global.location && global.location.pathname) || '', m = /saga-(go|dungeon|forest|story|realm)/.exec(p);
    gameMemo = m ? 'saga-' + m[1] : '';
    return gameMemo;
  }
  function cal(g) {
    var c = on() ? (CAL[g || game()] || OFF) : OFF, k = on() ? +tn('look3d.exposure', 1) : 1;
    return { exposure: +(c.exposure * (isFinite(k) ? k : 1)).toFixed(3), wb: c.wb.slice() };
  }
  function val(key) { return TABLE[key]; }
  global.DG = global.DG || {};
  global.DG.look3d = { TABLE: TABLE, CAL: CAL, on: on, game: game, cal: cal, val: val };
})(typeof window !== 'undefined' ? window : this);
