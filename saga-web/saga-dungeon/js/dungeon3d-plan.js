/**
 * 2나락 3D 값을 내는 함수 — 카메라 겨눔·조명 계획·후처리 고도(three 없이도 돈다). dungeon3d.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * 순수 함수 — 바깥에서 받는 것은 손잡이 tuned 하나(dungeon3d.js 가 bind 로 넘김). dungeon3d.js 는 같은 이름 한 줄 넘김으로 부르고
 * DG.dungeon3d.lightPlan·camAim 등 바깥(진단) 이름도 그대로다.
 */
(function (global) {
  'use strict';

  var tuned = function (k, def) { return def; };
  /* ── 값을 내는 함수 (three 없이도 돈다) ────────────────
   * 자가진단이 이것만 따로 굴린다 — 화면이 없어도 카메라와 조명은 값이다.
   */

  /** PerspectiveCamera FOV(도) — §28-5(2026-09-06)에서 34°로 좁혀 봤다가,
   *  narrow FOV가 던전 방 안 주변 몹까지 화면 밖으로 밀어내(방 "대각선"이
   *  화면에 들어가는 것과 "플레이어 주변에서 벌어지는 전투가 다 보이는 것"은
   *  다른 요구였다) 그날 바로 46°로 되돌렸다. **다시 좁힐 거면 반드시 실제
   *  전투 중(적이 여럿·플레이어 주변에 흩어진 상태)에 눈으로 확인부터.** */
  var FOV_DEG = 46;
  /** 던전 쪽 camAim() dist 배수 — FOV_DEG(46°)에 맞춰 눈으로 잡은 값,
   *  건드리지 않는다(§28-5 되돌림 기록 참고). */
  var DUNGEON_DIST_MUL = 1.05;

  /**
   * 앵커가 바뀐 프레임에 카메라를 같은 **세계** 자리로 옮긴다 — 순수 함수다.
   * 들판 한복판에서 `nearestTownId` 가 넘어가면 `run.anchor` 가 다른 마을
   * 것으로 바뀌어 로컬 좌표(세계 − 앵커)가 한 프레임에 통째로 튄다. 그런데
   * camPos·camLook 은 옛 로컬값에 남아 있어 0.14 lerp 가 수천 유닛을 몇 초에
   * 걸쳐 쓸고 가며 화면이 휘청였다(PLAN §7.1-2 "anchor 점프"). 옛 앵커 −
   * 새 앵커만큼 둘 다 밀어 주면 세계 기준으론 제자리라 lerp 가 평소대로 돈다.
   * pos·look 은 {x,y,z}(Vector3 도 된다), 앵커는 {x,y}(y 가 3D 의 z). 옮겼으면 true.
   */
  function rebaseCam(pos, look, oldAnc, newAnc) {
    if (!pos || !look || !oldAnc || !newAnc) { return false; }
    var dx = oldAnc.x - newAnc.x, dz = oldAnc.y - newAnc.y;
    if (!dx && !dz) { return false; }
    pos.x += dx; pos.z += dz;
    look.x += dx; look.z += dz;
    return true;
  }

  /**
   * 카메라가 어디에 서서 어디를 보나 — **순수 함수다.**
   * 방 가운데를 기준으로 플레이어 쪽으로 조금 끌린다(8절 "플레이어를 정확히
   * 따라가되 너무 흔들리지 않게"). 방을 벗어나 흐르지 않게 **가둔다**.
   */
  function camAim(px, py, W, H, zoom, tilt, close, groundY) {
    var z = (zoom === undefined || zoom <= 0) ? 1 : zoom;
    var tl = tilt === undefined ? 0.62 : tilt;
    var gy = groundY || 0;
    /* 방 대각선을 화면에 담을 거리 — 방이 커지면 저절로 물러난다.
       **계수를 눈으로 맞췄다**: 화면에 담기는 세로는 대략 2·dist·tan(fov/2) 인데
       fov 46° 면 0.85·dist 다. 방 대각선(666)을 담으려면 dist 는 그만큼 커야 한다 —
       0.62 로 두었더니 방이 화면 밖으로 나가 어둠만 찍혔다.
       **`close`(마을 전용, 2026-09-02) — 사가마을 쿼터뷰만큼 가깝게 해 달라는
       요청.** 던전 방은 벽 밖이 어둠뿐이라 위 0.62 실패가 그대로 재현되지만,
       마을·필드는 담이 없는 열린 땅이라 화면 밖으로 나가도 그냥 덜 보일 뿐이다
       — 그래서 마을에서만 훨씬 당겨 본다. 던전 쪽 1.05 는 그대로 둔다(연출·조작
       감각이 거기 맞춰져 있다, 2026-09-01 마을 세로화면 건과 같은 원칙) */
    /* §5.19 — 방이 700×440 으로 커지면 카메라도 그만큼(1.24배) 물러난다 — 방을 다 담는 이 설계
       (벽 밖 어둠이 화면을 먹지 않게, 진단 "카메라가 방을 담을 만큼")를 그대로 지킨다. 떼가 한눈에 든다 */
    var span = Math.sqrt(W * W + H * H);
    var dist = span * (close ? 0.4 : DUNGEON_DIST_MUL) * z;
    /* 플레이어를 따라가되 던전 방(!close)에서는 가운데로 **절반만** 당긴다.
       온전히 따라가면 벽에 붙었을 때 방 밖 검은 여백이 화면 절반을 차지한다.
       **§54 후속(2026-09-06, 실기기 제보 "들판 끝으로 가면 캐릭터가 안
       보이고 카메라가 안 따라간다")** — 마을·필드(close)는 담이 없어(주석
       위 참고) 이 절반-당김이 애초에 필요 없는데, `dungeon.js`가 여기 그대로
       기댔다. §28-8(오픈월드 A안)부터 마을 좌표가 방 하나(0..W) 안이 아니라
       세계 전체에 걸쳐 있어서, 방 가운데(W/2)에서 절반만 당기면 플레이어가
       방 밖으로(수백~수천 단위) 나갈수록 카메라가 그 절반만큼씩 계속 뒤처져
       결국 화면 밖으로 밀려났다 — 코너 미니맵과 같은 뿌리(§54)의 다른
       증상이다. close 는 온전히(1.0) 따라가게 한다 — 방(!close)은 회귀 없음. */
    var followMul = close ? 1 : 0.55;
    var cx = W / 2 + (px - W / 2) * followMul;
    var cy = H / 2 + (py - H / 2) * followMul;
    var high = dist * (1 - tl * 0.55);
    var back = dist * tl;
    /* **2026-09-06 실기기 제보** — "바닥 높낮이 때문에 캐릭터가 다 가려지고
       화면이 못 따라간다." 방 밖 들판은 `field3d.js`의 `heightAt()`로 기복이
       진다(언덕·비탈)인데, 카메라는 늘 y=0 바닥을 본다고 가정하고 있었다 —
       플레이어가 언덕에 올라서도 카메라의 `pos`·`look`은 그대로라 캐릭터가
       땅(언덕) 밑에 파묻힌 것처럼 가려졌다. `groundY`(플레이어가 선 자리의
       `heightAt()` 값, 호출부가 넘긴다)를 두 자리에 함께 얹어 카메라 전체가
       그 높이만큼 같이 오르내리게 한다 — 방 안(늘 0)에서는 이 값이 0이라
       회귀가 없다. */
    return {
      pos: { x: cx, y: high + gy, z: cy + back },
      look: { x: cx, y: gy, z: cy },
      dist: dist
    };
  }

  /**
   * 이 층·이 방의 조명 — **순수 함수다.** 층이 깊어질수록 어둡고,
   * 보스 방은 붉게 깔린다(37절 "강한 명암 · 선명한 실루엣").
   */
  function lightPlan(floor, roomKind, dark) {
    var dk = dark === undefined ? 0.82 : dark;
    var deep = Math.min(1, Math.max(0, (floor - 1) / 40));   // 40층에서 가장 깊다
    var boss = roomKind === 'boss';
    /* 마을은 **불을 피워 둔 자리**다 — 던전의 어둠 손잡이를 그대로 물리면
       사람 여섯이 어둠에 잠겨 누가 누구인지 안 보인다. 2D 마을이 어둠을
       0.74 → 0.30 으로 옅게 깔던 그 뜻을 3D 에서도 지킨다. */
    if (roomKind === 'town') {
      /* 2026-09-07 — 실기기(모바일) 재신고: 한 단 올린 것으로도 여전히
         "새까맣게 보인다·너무 느리다" — 사용자가 아예 마을의 "횃불만 켜 둔
         어둠" 컨셉 자체를 없애 달라고 요청(D2 감성보다 눈에 보이는 게 우선).
         배경(`bgHex`, scene.background·fog 색으로 그대로 쓰인다 — 아래
         2130행)이 여전히 어두우면 GLB 가 늦게 실리는 동안(모바일 LTE, 사람
         GLB 여럿) 화면 대부분이 그 어두운 배경 그대로 보이는 시간이 길어져
         "안 보인다" 로 읽힌다. 낮처럼 밝게 — 배경·주변광·직사광 모두 확 올리고
         어두운 색상 자체를 버린다.
         2026-09-09 — 그런데 이번엔 그 밝은 배경 자체가 황갈색(0xb9ab82)이라,
         모바일에서 GLB가 뜨기 전까지 화면 전체가 "갈색"으로 오래 노출되는
         재신고("전체 갈색임·잘안보여"). 사용자가 횃불 톤(조명) 자체가 필요
         없다고 재정정 — torchIntensity를 0으로 내리고, 배경·주변광·직사광의
         색을 호박색(amber) 계열에서 중립(뉴트럴)한 밝은 회백색으로 바꿔
         "갈색"으로 읽히는 색 자체를 없앴다.
         2026-09-09(같은 날 재신고) — 이번엔 "하얀 안개가 화면을 덮는다"로
         뒤집혔다. ambient 2.0 + keyIntensity 1.9 + 거의 흰색인 배경(0xd7dde2,
         RGB 밝기 ~0.86)이 겹쳐 `post3d.js`의 블룸 문턱(threshold 0.9, knee로
         0.45부터 걸린다)을 화면 대부분이 넘겨 버렸다 — 밝은 배경 자체가
         블룸으로 번져 화면 전체에 허연 안개처럼 깔린 것(진짜 `scene.fog`가
         아니라 블룸 블로아웃). 밝기는 유지하되(어둡다는 재신고를 또 부르면
         안 된다) 블룸 문턱을 확실히 넘지 않는 선까지 낮췄다.
         2026-09-11 재신고 — "바닥이 하얀색" (마을 건물 안 바닥·마을 발판·
         마을 들판 셋 다). 블룸이 아니라 **바닥 재질 자체**가 씻기는 것 —
         ambient 1.3 + key 1.2 를 근백색(0xeef1f4·0xf4f7fb)에 곱하면 합이
         2를 훌쩍 넘어, 어두운 층 색(`stone`)을 입힌 바닥도 노출로 밀려
         흰 쪽에 바짝 붙는다. 이번엔 밝기 자체를 낮춘다(어둡다는 재신고가
         또 오면 이 수치가 범인 후보 1순위) — 대신 들판 바닥에 무늬를
         입혀(아래 `groundTex`) 노출이 밀려도 "흰 판"이 아니라 "밝은 땅"으로
         읽히게 같이 손봤다. */
      var ck = Math.max(0, Math.min(1.5, +tuned('dg3d.contrast', 1) || 0)); return {   // W-0202 그늘 대비(1만리 W-0199 — 하늘빛 ≈ 키의 0.45): 옛 1.45·1.25(비 1.16)라 그늘이 없었다. 해 받는 바닥(하늘빛+키)은 2.7 → 3.0 만(밝기 재신고·블룸 문턱 — 바닥 회색 ≈50), 그늘 쪽만 낮춘다. 0 = 옛
        ambient: 1.45 - 0.52 * ck, ambientHex: 0xe7eaed,   // W-0111 — 1.05/0.95 는 물리 조명 기준 마을 평균 밝기 15/255
        keyIntensity: 1.25 + 0.82 * ck, keyHex: 0xecf0f3, keyNW: ck > 0,
        torchIntensity: 0, torchHex: 0xffc070, torchRange: 420,
        fog: { near: 1400, far: 3200 },
        bgHex: 0xaeb4ba, boss: false, deep: 0, town: true
      };
    }
    return {
      /* 바탕 밝기 — 어둠 손잡이와 깊이가 함께 깎는다 */
      ambient: (0.62 - deep * 0.20) * (1 - dk * 0.45),
      ambientHex: boss ? 0x3a1c1c : 0x2a2f3c,
      /* 위에서 내리는 빛 하나 — 실루엣을 만든다 */
      keyIntensity: (1.35 - deep * 0.30) * (1 - dk * 0.30),
      keyHex: boss ? 0xff9a7a : 0xbfd0e8,
      /* 플레이어를 따라다니는 횃불 — 원작에서 방을 도려내는 그 빛.
         **세기가 천 단위인 것은 오타가 아니다.** three 는 r155 부터 점광이 물리
         단위(칸델라)라, 예전 감각으로 2 를 주면 **아무것도 안 밝아진다**.
         이 방의 단위는 미터가 아니라 논리 좌표(방이 560×360)라 더 그렇다 */
      torchIntensity: 2200 + dk * 2600,
      torchHex: 0xffb45a,
      torchRange: 300 - deep * 70,
      /* 안개는 **방을 삼키지 않을 만큼만**. 카메라가 700쯤 밖에 서므로
         far 를 600 으로 두면 방 전체가 안개에 잠긴다(밟아 본 함정) */
      fog: { near: 320, far: 1500 - deep * 300 },
      bgHex: boss ? 0x120708 : 0x070809,
      boss: boss, deep: deep
    };
  }

  /**
   * `post3d.js`(사가만리에서 옮겨 옴)의 색보정·블룸은 **해 고도**(alt, -1~1)로
   * 결을 잡는다 — 이 판(지하)에는 해가 없으니 `lightPlan()`이 이미 낸 깊이·
   * 마을 여부로 흉내 낸 값을 준다. **순수 함수다.**
   *   마을(횃불 켜 둔 밝은 자리) → 노을에 가까운 값(따뜻하게, 블룸은 약하게)
   *   던전 → 늘 밤에 가까운 값(블룸이 세져 횃불·발광 소품이 어둠 속에서 도드라진다),
   *          층이 깊을수록 더 어둡고, 보스방은 한 번 더 어둡다
   */
  function postAlt(L) {
    if (!L) { return -0.5; }
    if (L.town) { return 0.4; }
    var a = 0.5 - (L.deep || 0) * 1.3 - (L.boss ? 0.3 : 0);
    return Math.max(-1, Math.min(1, a));
  }


  global.DG = global.DG || {};
  global.DG.dungeon3dPlan = {
    bind: function (h) { if (h && h.tuned) { tuned = h.tuned; } return global.DG.dungeon3dPlan; },
    FOV_DEG: FOV_DEG, DUNGEON_DIST_MUL: DUNGEON_DIST_MUL,
    rebaseCam: rebaseCam, camAim: camAim, lightPlan: lightPlan, postAlt: postAlt
  };
})(typeof window !== 'undefined' ? window : this);
