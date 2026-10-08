/**
 * 사가만리 3D — 시간대 빛 값(순수 함수) · world3d.js 에서 떼어 냄(W-0110 2026-10-08, 큰 파일 줄 수)
 * ---------------------------------------------------------------
 * 몸통은 world3d.js 에 있던 글자 그대로다. world3d.js 가 `DG.w3light` 의 셋(mixHex·lum·lightingAt)을 같은 이름으로 받아 쓴다.
 * 반드시 world3d.js **앞에** 싣는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  function DAYNIGHT() { return core.tuned('world3d.dayNight', 1) ? true : false; }

  function mixHex(a, b, k) {
    k = k < 0 ? 0 : (k > 1 ? 1 : k);
    var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    var br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * k) << 16) |
           (Math.round(ag + (bg - ag) * k) << 8) |
           Math.round(ab + (bb - ab) * k);
  }
  /** 색의 밝기 (0~1) — 진단이 "밤이 더 어둡다" 를 값으로 본다 */
  function lum(hex) {
    return (((hex >> 16) & 255) * 0.299 + ((hex >> 8) & 255) * 0.587 + (hex & 255) * 0.114) / 255;
  }

  /* 다섯 번째 손질(2026-08-30) — 네 번째 손질(세기 대신 색을 밝힘)도 실기기에서
     "아직 어둡다"였다. 사용자가 "요즘 시대엔 조명이 밝다"고 확인 — 밤을
     어둡게 연출하는 무드 자체를 포기하고, **낮에 최대한 가깝게** 밝힌다.
     이 색표만으론 부족해 `lightingAt` 의 세기 최저치(1.4→1.7·1.2→1.4)와
     깊은 밤 추가 감쇠(0.82/0.85/0.42/0.30→0.90/0.90/0.36/0.18)도 같이 올렸다.
     `_test.html` 대비 문턱(한낮/깊은밤 하늘 2배, 밤 지도물감 0.7배)은 여전히
     넉넉히 통과한다(2.36배 · 0.61배) — 남은 차이는 색조(푸른 달빛 톤)뿐이다 */
  /* 여섯 번째 손질(2026-09-27, 헤드리스로 직접 찍어 확인) — 실기 "전체적으로 너무 어두워". 세기는 이미 올라 있어
     어둠의 정체는 **색**이었다: 밤 반구광 땅쪽(0x565f70)·지도 물감(0x939cb6)·짙은 남색 안개가 화면을 덮고,
     낮도 땅쪽 반사(0x53604a)가 어두운 녹갈색이라 벽이 칙칙했다. 밤은 푸른 톤만 남기고 밝히고, 낮 반사도 올린다 */
  var C_NIGHT = { sun: 0xdde6ff, sky: 0x6f86b3, hemiSky: 0x9fb4dc, hemiGnd: 0x7c8496, tint: 0xb4bdd4 };
  var C_GOLD = { sun: 0xffab63, sky: 0xe8946a, hemiSky: 0xf0b48a, hemiGnd: 0x6a5a4c, tint: 0xffd2b0 };
  var C_DAY = { sun: 0xfff0d0, sky: 0x8fb6d8, hemiSky: 0xdce9ff, hemiGnd: 0x7d8466, tint: 0xffffff };

  /**
   * @param ms    시각(생략하면 지금)
   * @param wkey  천후 키(clear·cloud·rain·wind·fog·snow). 생략하면 맑음
   */
  function lightingAt(ms, wkey) {
    var d = new Date(ms === undefined ? Date.now() : ms);
    var hour = d.getHours() + d.getMinutes() / 60;
    /* 해 고도 — 6시에 뜨고 18시에 진다. 실제 천문을 흉내 내지 않는다:
       위도·계절까지 넣으면 값은 정확해지지만 화면은 달라지지 않는다 */
    var alt = Math.sin((hour - 6) / 12 * Math.PI);
    if (!DAYNIGHT()) { alt = 0.9; hour = 12; }

    var phase = alt > 0.30 ? 'day'
      : (alt > 0.04 ? (hour < 12 ? 'dawn' : 'dusk')
        : (alt > -0.14 ? 'twilight'
          /* **깊은 밤** — `PLAN.md` 20절이 콕 집은 02:00 Deep Night 이다.
             자정부터 네 시까지, 밤 중에서도 가장 어두운 때. 23시는 그대로 `night`
             이라 이 갈래를 더해도 여태 값이 안 흔들린다 */
          : ((hour < 4) ? 'deepnight' : 'night')));

    /* 낮섞임(k)과 노을섞임(gold) 둘로 색을 만든다.
       노을은 해가 지평선 가까이 있을 때만 세다 — 한낮에도 섞으면 늘 누렇다 */
    var k = Math.max(0, Math.min(1, (alt + 0.14) / 0.62));
    var gold = Math.max(0, 1 - Math.abs(alt - 0.10) / 0.36);

    function pick(field) {
      var base = mixHex(C_NIGHT[field], C_DAY[field], k);
      return mixHex(base, C_GOLD[field], gold * 0.75);
    }

    var out = {
      hour: hour, alt: alt, phase: phase, night: phase === 'night',
      sun: {
        hex: pick('sun'),
        /* 밤 최저치 — 0.28→0.65→1.0→1.4 를 거쳐 1.7 까지 올렸다(2026-08-30,
           다섯 번째 손질). 세기·색 다 올려도 실기기에서 "아직 어둡다"는 게
           계속 나와, 사용자가 "요즘 시대엔 조명이 밝다" — 즉 무드보다 **밝게
           보이는 것 자체**를 원한다고 확인했다. 낮과의 차이는 이제 색조(푸른
           달빛 톤)만 남기고 세기 차이는 최소로 줄였다 */
        intensity: 1.7 + Math.max(0, alt) * 0.23,
        /* 해는 동(-x)에서 떠 서(+x)로 진다. 밤에는 달이 반대쪽에 뜬 셈 친다 */
        x: -Math.cos((hour - 6) / 12 * Math.PI) * 120,
        y: 40 + Math.abs(alt) * 110,
        z: -70 - Math.max(0, alt) * 40
      },
      /* 밤 최저치 — 위 sun 과 같은 이유·같은 다섯 번의 손질(0.52→0.85→1.2→1.4) */
      hemi: { sky: pick('hemiSky'), ground: pick('hemiGnd'), intensity: 1.95 + k * 0.3 },   // 2026-09-27 그늘진 벽이 거의 검게 — 1.4 → 1.95(헤드리스로 전후 확인)
      bg: pick('sky'),
      tint: pick('tint'),
      fog: { near: 150 + k * 110, far: 520 + k * 240 },       // 2026-09-27 밤 안개를 멀리(짙은 남색 벽이 화면을 덮었다)
      /* 밤에는 배우 발밑에 등불이 켜진다 (원작의 밤 화면에서 아바타가 안 묻히게) */
      lamp: alt < 0.06 ? Math.min(1, (0.06 - alt) * 4) : 0
    };

    /* 깊은 밤은 한 겹 더 어둡다. 대신 **등롱은 더 밝다** — 다 같이 어두워지면
       그냥 안 보이는 화면이 되고, 밤이 깊었다는 것이 안 읽힌다.
       (2026-08-30, 다섯 번째 손질로 이 겹도 옅게 줄였다 — 0.82/0.85/0.42/0.30
       → 0.90/0.90/0.36/0.18. `_test.html` 의 "한낮이 한밤(자정=깊은 밤)보다
       밝다" 문턱(하늘 밝기 비 2배)은 여전히 넉넉히 넘는다) */
    if (phase === 'deepnight') {
      out.sun.intensity *= 0.90;
      out.hemi.intensity *= 0.90;
      out.bg = mixHex(out.bg, 0x05070c, 0.2);
      out.tint = mixHex(out.tint, 0x2a3040, 0.1);
      out.lamp = 1;
    }

    var w = wkey || 'clear';
    if (w === 'rain') {
      out.sun.intensity *= 0.48; out.hemi.intensity *= 0.80;
      out.bg = mixHex(out.bg, 0x55606e, 0.55); out.tint = mixHex(out.tint, 0x8f99a8, 0.45);
      out.fog.far *= 0.46; out.fog.near *= 0.7;
    } else if (w === 'snow') {
      out.sun.intensity *= 0.66; out.hemi.intensity *= 1.05;
      out.bg = mixHex(out.bg, 0xc8d2de, 0.55); out.tint = mixHex(out.tint, 0xe0e8f0, 0.45);
      out.fog.far *= 0.52;
    } else if (w === 'fog') {
      out.sun.intensity *= 0.55; out.hemi.intensity *= 0.92;
      out.bg = mixHex(out.bg, 0xb8bcc0, 0.6); out.tint = mixHex(out.tint, 0xc2c6ca, 0.35);
      out.fog.far *= 0.26; out.fog.near *= 0.35;
    } else if (w === 'cloud') {
      out.sun.intensity *= 0.85; out.hemi.intensity *= 0.97;          // 2026-09-27 흐림이 화면을 칙칙하게 — 0.70 → 0.85
      out.bg = mixHex(out.bg, 0x8a929c, 0.3); out.tint = mixHex(out.tint, 0xb8bec6, 0.16);
      out.fog.far *= 0.78;
    } else if (w === 'wind') {
      out.fog.far *= 1.15;
    }
    out.weather = w;
    return out;
  }

  global.DG = global.DG || {};
  global.DG.w3light = { mixHex: mixHex, lum: lum, lightingAt: lightingAt };
})(window);
