/**
 * 2나락 3D 던전 — 벨트 카메라 (W-0158)
 * ---------------------------------------------------------------
 * 옛 3D 카메라(`dungeon3d` camAim)는 방 대각선(830)을 통째로 담을 만큼(×1.05) 물러나 나를 절반만 따라갔다 —
 * 방 전체가 늘 보이는 대신 인물이 작고, 걸어도 화면이 거의 안 흘렀다.
 * 2D 벨트(W-0128 `belt2d.js`)와 같은 문법을 3D 에:
 *
 *   축      방 x(700, 문은 늘 오른쪽 벽 x=ROOM_W) → 화면 가로. 카메라는 남쪽(+z)에서 북쪽을 본다 — 방을 돌리지 않는다
 *   따라감  x 만 나를 따라가고 방 양 끝에서 멈춘다(보이는 폭이 방보다 넓으면 가운데). z·높이·내려다보는 각은 고정
 *   깊이    앞벽(z = ROOM_H)까지 화면 아래 끝에 들어오게 카메라 z 를 푼다 — 방 깊이 440 전부가 늘 보인다
 *   거리    `dungeon3d.beltDist`(340) × 사람 줌. 세로 화면은 보이는 폭이 260 밑으로 안 줄게 더 물러난다
 *   넘어감  문을 지나 다음 방으로 갈 때는 dungeon3d 의 부드러운 따라감(0.14/프레임 ≈ 0.4초)이 그대로 잇는다
 *
 * 마을·들판(run.town)은 열린 땅이라 옛 카메라 그대로. 판정(dungeon.js)·방 좌표는 한 줄도 안 바꾼다.
 * 손잡이 `dungeon3d.belt` 0 = 옛 카메라 · `dungeon3d.beltPitch` 32(도) · `dungeon3d.beltDist` 340.
 * `beltCam()` 은 three 없이 돈다 — 자가진단이 그것만 본다.
 */
(function (global) {
  'use strict';

  function tuned(k, d) { var C = global.DG && global.DG.core; return C && C.tuned ? C.tuned(k, d) : d; }
  function on() { return !!tuned('dungeon3d.belt', 1); }

  /**
   * @param px,py 내 자리(방 로컬) · W,H 방 크기
   * @param o { aspect, fov(도), pitch(도), dist, zoom, gy(내가 선 땅 높이) }
   * @return { pos, look, dist, hw(보이는 폭 절반), pitch }
   */
  function beltCam(px, py, W, H, o) {
    o = o || {};
    var asp = o.aspect > 0 ? o.aspect : 16 / 9, fov = (o.fov || 46) * Math.PI / 180;
    var pitch = (o.pitch === undefined ? tuned('dungeon3d.beltPitch', 32) : o.pitch) * Math.PI / 180;
    var z = o.zoom > 0 ? o.zoom : 1, gy = o.gy || 0, k = 2 * Math.tan(fov / 2);
    var d = (o.dist === undefined ? tuned('dungeon3d.beltDist', 340) : o.dist) * z;
    d = Math.max(d, 260 / (k * asp));                       // 세로 화면 — 보이는 폭 260 은 남긴다
    var hw = k * d * asp / 2;                                // 바라보는 깊이에서 보이는 폭의 절반
    var cx = W <= 2 * (hw - 30) ? W / 2 : Math.max(hw - 30, Math.min(W - hw + 30, px));   // 양 끝 벽은 30 만큼 보인다
    var camY = d * Math.sin(pitch);
    var camZ = H + 20 + camY / Math.tan(pitch + fov / 2);   // 화면 아래 끝 = 앞벽 + 20
    return {
      pos: { x: cx, y: camY + gy, z: camZ },
      look: { x: cx, y: gy, z: camZ - d * Math.cos(pitch) },
      dist: d, hw: hw, pitch: pitch
    };
  }

  global.DG = global.DG || {};
  global.DG.beltCam3d = { on: on, beltCam: beltCam };
})(window);
