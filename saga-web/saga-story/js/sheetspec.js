/**
 * sheetspec.js — 2D 인물 시트 규격(W-0311). 순수 함수만(그림·DOM 없음) — mode2d.js 가 부르고 진단이 직접 잰다.
 *
 * 다섯 판 공용 복사본(sync-shared) — 고치는 곳은 shared/ 하나.
 *
 * 두 규격을 섞어 쓴다:
 *   옛 8방향(K-0029) — `characters2d8/<id>/<역할>.webp` 8프레임 × 5행(d0 정면·d1 3/4·d2 옆·d3 뒤 3/4·d4 뒤, 왼쪽은 뒤집기). 표 hero2d8
 *   새 16방향(K, INBOX 10-18) — `characters2d16/<id>/<역할>.webp` 동작마다 한 장(프레임 수가 동작마다 다름) × 9행
 *     (r0 정면 … r4 오른쪽 옆 … r8 뒤, 22.5° 칸, 왼쪽 일곱은 r1~r7 뒤집기). 규격은 폴더의 `sheet.json` 을
 *     tools/gen-assets3d-ids.mjs 가 표 `hero2d16 = { <id>: sheet.json 내용 }` 으로 굽는다 — 실행 중엔 없는 파일을 두드리지 않는다(404 0).
 *     sheet.json = { "dirs": 16, "rows": 9, "px": 192, "cam_z": 1.15, "frames": { "walk": 12, … }, "fps": { … }, "roles": [ … ] } (빠진 칸은 DEFAULT16)
 * 새 시트가 온 인물부터 16방향, 없으면 8방향 그대로(회귀 0). 동작 파일은 그 동작을 처음 그릴 때 받는다(W-0212 늦게 받기).
 *
 * 역할 이름은 모션 묶음 1(W-0303 pose3d)과 같은 낱말 — `Pose_sit` 은 'sit'. 시트에 없는 역할은 NEAR 표로 가까운 것.
 */
(function (global) {
  'use strict';

  /** 새 16방향 기본 — 동작별 프레임 수·빠르기(fps). 한 번 도는 동작은 끝 프레임에 머문다 */
  var DEFAULT16 = {
    dirs: 16, rows: 9, px: 192, cam_z: 1.15,
    frames: { idle: 8, walk: 12, run: 8, attack: 10, attack2: 10, heavy: 14, cast: 12, block: 6, hit: 4, death: 10, knockdown: 10,
      sit: 6, warm: 6, pick: 8, lean: 6, wave: 10, fish: 6, jump: 6, fall: 4, idle_town: 8, walk_town: 12 },
    fps: { idle: 6, walk: 12, run: 12, attack: 16, attack2: 16, heavy: 13, cast: 11, block: 6, hit: 12, death: 10, knockdown: 10,
      sit: 4, warm: 4, pick: 9, lean: 4, wave: 9, fish: 4, jump: 10, fall: 8, idle_town: 6, walk_town: 12 }
  };
  /** 옛 8방향 — 전부 8프레임, 빠르기는 mode2d 옛 FPS 와 같다 */
  var LEGACY8 = { dirs: 8, rows: 5, frames: null, fps: { idle: 6, walk: 10, attack: 14, attack2: 14, heavy: 11, hit: 12, death: 10, knockdown: 10 }, n: 8 };
  var ONCE = { attack: 1, attack2: 1, heavy: 1, cast: 1, hit: 1, death: 1, knockdown: 1, pick: 1, wave: 1, jump: 1 };
  /** 시트에 그 역할이 없을 때 가까운 역할(차례로 시도) — 끝은 늘 idle */
  var NEAR = {
    run: ['walk'], attack2: ['attack'], heavy: ['attack'], cast: ['heavy', 'attack'], block: ['idle'], knockdown: ['death'],
    sit: ['idle'], warm: ['sit', 'idle'], pick: ['attack', 'idle'], lean: ['idle'], wave: ['idle'], fish: ['idle'],
    jump: ['walk'], fall: ['walk'], idle_town: ['idle'], walk_town: ['walk']
  };

  /** 자세·동작 이름 → 역할 낱말(Pose_sit → sit, Pose_idle_look → idle) */
  function roleName(clip) {
    if (!clip) { return 'idle'; }
    var s = String(clip);
    if (s.indexOf('Pose_') === 0) { s = s.slice(5); if (s.indexOf('idle_') === 0) { s = 'idle'; } }
    return s;
  }

  /** 표의 한 줄(sheet.json) → 빈 칸을 기본으로 채운 규격. 없으면 null(→ 옛 8방향) */
  function specOf(raw) {
    if (!raw || typeof raw !== 'object') { return null; }
    var o = { dirs: raw.dirs === 8 ? 8 : 16, rows: raw.rows || (raw.dirs === 8 ? 5 : 9), px: raw.px || DEFAULT16.px, cam_z: raw.cam_z || DEFAULT16.cam_z, frames: {}, fps: {}, roles: null }, k;
    for (k in DEFAULT16.frames) { o.frames[k] = DEFAULT16.frames[k]; o.fps[k] = DEFAULT16.fps[k]; }
    for (k in raw.frames || {}) { o.frames[k] = +raw.frames[k] || o.frames[k]; }
    for (k in raw.fps || {}) { o.fps[k] = +raw.fps[k] || o.fps[k]; }
    if (raw.roles && raw.roles.length) { o.roles = {}; raw.roles.forEach(function (r) { o.roles[r] = 1; }); }
    return o;
  }

  /** 이 시트에 실제로 있는 역할 — roles 목록이 있으면 그 안에서, 없으면 frames 에 있는 것. 없으면 NEAR 를 따라 내려간다 */
  function roleOf(spec, clip) {
    var r = roleName(clip), have = function (x) { return spec && (spec.roles ? !!spec.roles[x] : !!(spec.frames && spec.frames[x])); }, i, n;
    if (have(r)) { return r; }
    n = NEAR[r] || [];
    for (i = 0; i < n.length; i++) { if (have(n[i])) { return n[i]; } }
    return 'idle';
  }

  /** 움직인 쪽(dx, dy — 화면 아래가 +) → 16방향 칸 k(−7~8, 0 정면·4 오른쪽 옆·8 뒤·음수 왼쪽). 둘 다 0 이면 facing 으로 */
  function dirK16(dx, dy, facing) {
    dx = +dx || 0; dy = +dy || 0;
    var k;
    if (dx || dy) { k = Math.round(Math.atan2(dx, dy) / (Math.PI / 8)); }
    else if (facing === 'front') { k = 0; } else if (facing === 'back') { k = 8; }
    else { k = (facing === 'left' || (typeof facing === 'number' && facing < 0)) ? -4 : 4; }
    if (k === -8) { k = 8; }
    return k;
  }
  /** 16방향 → 시트 행·뒤집기 (9행: |k|, 왼쪽은 뒤집기) */
  function dirOf16(dx, dy, facing) { var k = dirK16(dx, dy, facing); return { row: Math.abs(k), flip: k < 0, k: k }; }
  /** 대역(⑦) — 16방향 칸을 옛 8방향 5행 시트의 가장 가까운 행으로(22.5° 홀수 칸은 앞쪽(정면 쪽) 행으로 내림). 코드 길은 16, 그림은 8 */
  function dirOf16as8(dx, dy, facing) { var k = dirK16(dx, dy, facing), a = Math.abs(k), r = Math.floor(a / 2); return { row: r, flip: k < 0, k: k }; }
  /** 규격대로 방향 — spec 이 16 이면 9행, 아니면 대역 */
  function dirFor(spec, dx, dy, facing) { return spec && spec.dirs === 16 ? dirOf16(dx, dy, facing) : dirOf16as8(dx, dy, facing); }

  /** 이 역할의 프레임 수 */
  function framesOf(spec, role) { return spec && spec.frames ? (spec.frames[role] || 8) : 8; }
  /** 몇 번째 프레임 — at(0~1 진행률, 짧은 몸짓) > stride(0~1 보폭 위상, 걷기·달리기) > ms 시계. 한 번 도는 동작은 끝에 머문다 */
  function frameAt(spec, role, ms, at, stride) {
    var n = framesOf(spec, role), fps = (spec && spec.fps && spec.fps[role]) || 8;
    if (at !== undefined && at !== null) { return Math.min(n - 1, Math.max(0, Math.floor(at * n))); }
    if (stride !== undefined && stride !== null && /^(walk|run)/.test(role)) { return Math.floor(stride * n) % n; }
    var i = Math.floor(Math.max(0, +ms || 0) / 1000 * fps);
    return ONCE[role] ? Math.min(n - 1, i) : i % n;
  }
  /** 칸 크기·카메라 높이 [P, camZ] — 받은 그림 폭(natW) ÷ 그 역할 프레임 수로 고친다(cell8 과 같은 꾀) */
  var CAMZ = { 128: 0.95, 192: 1.15 };
  function cellOf(spec, role, natW) {
    var P = spec.px, cz = spec.cam_z, n = framesOf(spec, role), q = natW > 0 ? natW / n : P;
    if (q !== P && q > 0) { cz = CAMZ[q] || cz * q / P; P = q; }
    return [P, cz];
  }

  global.DG = global.DG || {};
  global.DG.sheetspec = {
    DEFAULT16: DEFAULT16, LEGACY8: LEGACY8, NEAR: NEAR, ONCE: ONCE,
    roleName: roleName, specOf: specOf, roleOf: roleOf, dirK16: dirK16, dirOf16: dirOf16, dirOf16as8: dirOf16as8, dirFor: dirFor,
    framesOf: framesOf, frameAt: frameAt, cellOf: cellOf,
    /** 인물 시트 규격 — 표 hero2d16(생성물)에 그 인물이 있으면 규격, 없으면 null(→ mode2d 옛 길) */
    lookup: function (id) { var t = global.DG.assets3dIds && global.DG.assets3dIds.hero2d16; return t && t[id] ? (t[id]._spec || (t[id]._spec = specOf(t[id]))) : null; }
  };
})(typeof window !== 'undefined' ? window : this);
