/**
 * 밤의 잔불 — 결말 뒤 밤에만 타는 보랏빛 불 (PLAN §5 ⑲-56, saga-godot PLAN 106 52-5 `world/night_echoes.gd`)
 * ---------------------------------------------------------------
 *   열림     1차 결말(29장)을 마친 뒤 · 실제 시각 21~4시(밤)에만. 낮이 되면 불이 꺼진다(무리도 거둔다)
 *   자리     이야기가 지나간 일곱 곳마다 잔불 하나 — 폐허 제단 · 서쪽 옛길 · 북쪽 봉우리 · 물마루 곶 · 바위섬 · 서리봉 고원 · 잠긴 도읍 모래밭 (2차 결말 38장 뒤 굳은 네거리·야적장·세갈래 성문 앞 셋 더 = 열 곳)
 *   도전     14m 안에 들면 잔당 셋(들판 전투 무리, 키 `dm:ne:<자리>`) — 60m 넘게 떠나면 거둔다. 다 쓰러뜨리면 그 자리 이야기 인물 한 줄 +
 *            금·무예 교본, 그 자리는 그날(새벽 4시 넘김) 다시 안 탄다
 *   세이브   `save.night_echo = { day, done: { 자리: 1 } }` 한 칸(필드만 더함). 진행 중 무리는 저장하지 않는다
 * 판정(`isNight`·`dayKey`·`spots`·`rewardOf`)은 순수 — 시각은 `_setNowForTest` 로 붙든다. 그림은 코드 도형(빛무리 + 불꽃 조각).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('nightecho.' + key, def); }
  function FC() { return global.DG.fieldCombat || null; }
  function ST() { var s = global.DG.story; return s && s.on && s.on() ? s : null; }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }

  /* ── 표 ─────────────────────────────────────────────── */
  var AFTER_CH = 29;                       // 1차 결말(29장)을 마친 뒤(story.ch >= 29)
  var NIGHT_FROM = 21, NIGHT_TO = 4;       // 실제 시각 21시부터 다음 날 4시 전까지
  var NEAR_R = 14, FAR_R = 60, FOE_RING = 4, SEE_R = 400;
  var REWARD = { gold: 800, mats: { guide: 1 } };
  var TIER = 2, HP_MUL = 2, ATK_MUL = 1.4;
  /** 일곱 자리 — pos: 이야기 이름 붙은 자리 또는 zone(anchorOf) + off · line: 그 자리 이야기 인물 한 줄 · foes: 잔당 셋 */
  var SPOTS = [
    { id: 'ruins', name: '폐허 제단',     zone: 'gojeong', off: [-30, 26], who: '은비',   line: '이 불… 비문 밑에서 올라온 거야. 다 꺼졌으면 좋겠는데.', foes: ['imp', 'imp', 'raptor'] },
    { id: 'road',  name: '서쪽 옛길',     spot: 'altar2',                     who: '나그네', line: '……밤마다 이 길 끝에서 불이 튄다. 임금의 미련이다.',   foes: ['imp', 'hawk', 'raptor'] },
    { id: 'peak',  name: '북쪽 봉우리',   spot: 'peak', off: [-7, -4],        who: '해솔',   line: '노랫소리가 남았어. 이번엔 내가 끝을 맺을게.',         foes: ['hawk', 'raptor', 'imp'] },
    { id: 'cape',  name: '물마루 곶',     spot: 'cape',                       who: '버들',   line: '허, 이 늙은이 노 소리에 잔불도 물러가는군.',         foes: ['imp', 'toad', 'toad'] },
    { id: 'isle',  name: '바위섬',        spot: 'isle',                       who: '버들',   line: '밤 물살이 잔불을 실어 오네. 이제 진짜 끝이겠지.',     foes: ['imp', 'toad', 'hawk'] },
    { id: 'frost', name: '서리봉 고원',   spot: 'fr_center',                  who: '하람',   line: '(무전) 관측소 온도계가 밤마다 튀었는데 — 이 불 때문이었어요.', foes: ['snowfox', 'snowfox', 'hawk'] },
    { id: 'sunken', name: '잠긴 도읍 모래밭', spot: 'sk_sand',                who: '물새',   line: '밤 바다에 보랏빛이 비치더니 — 그게 이거였구려.',       foes: ['toad', 'toad', 'raptor'] },
    /* ⑲-69 2차 결말(38장) 뒤 — 새 지역 셋(9~11부). 자리는 그 지역 이야기 kill 칸 */
    { id: 'amber', name: '굳은 네거리', spot: 'am_cross', off: [0, 8], after: 38, who: '초롱', line: '밤에도 신호등이 초록으로 또렷해요. 시계방 괘종도 제 박자를 찾았고요.', foes: ['rockbear', 'imp', 'bolt'] },
    { id: 'vault', name: '야적장', spot: 'vt_yard', off: [0, 8], after: 38, who: '마루', line: '금고 불이 꺼져도 야적장이 어둡지 않아요. 이 잔불이 가로등 노릇을 했나 봐요.', foes: ['rockbear', 'hawk', 'snowfox'] },
    { id: 'fork', name: '세갈래 성문 앞', spot: 'fk_gate', off: [0, 22], after: 38, who: '벼리', line: '성문 앞에 먹구름 부스러기라니 — 쓸어 줘서 고맙다. 오늘 밤 화덕은 편히 피우겠어.', foes: ['imp', 'bolt', 'snowfox'] }
  ];

  /* ── 판정(순수) ─────────────────────────────────────── */
  var nowFn = function () { return Date.now(); };
  /** 실제 시각(밀리초) — 21~4시면 밤. **순수 함수** */
  function isNight(at) { var h = new Date(at).getHours(); return h >= NIGHT_FROM || h < NIGHT_TO; }
  /** "오늘"의 키 — 새벽 4시에 갈린다. **순수 함수** */
  function dayKey(at) { var d = new Date(at - NIGHT_TO * 3600000); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function open() {
    var S = ST(), v = S && S.state ? S.state() : null;
    return !!(K('on', 1) && v && v.ch >= AFTER_CH);
  }
  /** 지금 잔불이 타나 — 열렸고 밤이다(손잡이 nightecho.night 1 이면 늘 밤, 확인용) */
  function lit() { return open() && (K('night', 0) ? true : isNight(nowFn())); }
  /** 자리 i 의 세계 좌표 — 그 자리를 모르면 null */
  function posOf(i) {
    var d = SPOTS[i], S = ST(), p = null;
    if (!S) { return null; }
    if (d.zone) { var a = S.anchorOf ? S.anchorOf(d.zone) : null; p = a ? { x: a.x + d.off[0], y: a.y + d.off[1] } : null; }
    else { p = S.spotPos ? S.spotPos(d.spot, d.off) : null; }
    return p ? { x: p.x, y: p.y } : null;
  }
  function spots() {
    var out = [], S = ST(), v = S && S.state ? S.state() : null;
    SPOTS.forEach(function (d, i) { if (d.after && !(v && v.ch >= d.after)) { return; } var p = posOf(i); if (p) { out.push({ i: i, id: d.id, name: d.name, x: p.x, y: p.y, who: d.who, line: d.line }); } });
    return out;
  }
  function rewardOf() { return { gold: REWARD.gold, mats: { guide: REWARD.mats.guide } }; }

  /* ── 세이브 ─────────────────────────────────────────── */
  function sv() {
    var s = core().save;
    if (!s.night_echo || typeof s.night_echo !== 'object') { s.night_echo = { day: '', done: {} }; }
    var dk = dayKey(nowFn());
    if (s.night_echo.day !== dk || typeof s.night_echo.done !== 'object') { s.night_echo = { day: dk, done: {} }; }
    return s.night_echo;
  }
  function done(id) { return !!sv().done[id]; }
  /** 아직 안 쓴 잔불 — 열렸고 밤일 때만 */
  function embers() { return lit() ? spots().filter(function (q) { return !done(q.id); }) : []; }

  /* ── 무리(런타임) ───────────────────────────────────── */
  var camps = {};                                     // id → 키
  function keyOf(id) { return 'dm:ne:' + id; }
  function pos() { return core().save.player.pos; }
  function dropCamp(id) {
    var F = FC(), S = F && F.state ? F.state() : null, k = keyOf(id), cp = S ? S.camps[k] : null;
    if (cp) { cp.uids.forEach(function (u) { delete S.foes[u]; }); delete S.camps[k]; }
    if (S && S.cleared) { delete S.cleared[k]; }
    delete camps[id];
  }
  function spawn(q) {
    var F = FC(), S = F && F.state ? F.state() : null, d = SPOTS[q.i];
    if (!S || S.camps[keyOf(q.id)]) { return false; }
    var foes = d.foes.map(function (kind, i) { var a = i / d.foes.length * Math.PI * 2 + 0.5; return { kind: kind, dx: Math.cos(a) * FOE_RING, dy: Math.sin(a) * FOE_RING }; });
    F.spawnCamp(S, { key: keyOf(q.id), x: q.x, y: q.y, tier: TIER, kind: 'domain', foes: foes });
    S.camps[keyOf(q.id)].uids.forEach(function (u) {
      var f = S.foes[u];
      F.applyWorld(f, 0);                             // 천하 등급은 안 받는다 — 잔당 배율만
      f.hpMax = f.hp = Math.round(f.hpMax * HP_MUL); f.atk = Math.round(f.atk * ATK_MUL);
      f.st = 'chase'; f.stT = 0;
    });
    camps[q.id] = keyOf(q.id);
    toast('🔮 밤의 잔불 — ' + q.name + '에서 잔당이 일어났다');
    return true;
  }
  /** 무리를 거둘 때 — 밤이 아니거나 멀어졌거나 이미 쓴 자리 */
  function sweep() {
    var p = pos(), F = FC(), S = F && F.state ? F.state() : null, byId = {};
    spots().forEach(function (q) { byId[q.id] = q; });
    Object.keys(camps).forEach(function (id) {
      var q = byId[id];
      if (!S || !S.camps[camps[id]]) { delete camps[id]; return; }
      if (!q || !lit() || done(id) || Math.hypot(q.x - p.x, q.y - p.y) > FAR_R) { dropCamp(id); }
    });
  }
  function onClear(e) {
    if (!e || typeof e.camp !== 'string' || e.camp.indexOf('dm:ne:') !== 0) { return; }
    var id = e.camp.slice(6), q = spots().filter(function (s) { return s.id === id; })[0];
    if (!q || done(id)) { return; }
    dropCamp(id);
    sv().done[id] = 1;
    var c = core(), r = rewardOf(), TL = global.DG.talent;
    c.save.player.gold = (c.save.player.gold || 0) + r.gold;
    if (TL && TL.addMats) { TL.addMats(r.mats); }
    toast('🔮 잔불이 꺼졌다 — ' + q.who + ': "' + q.line + '" · 🪙 ' + r.gold + ' · 📘 ' + r.mats.guide);
    c.log('🔮 밤의 잔불 — ' + q.name + ' 잔당 정리 · 🪙 ' + r.gold, 'good');
    c.emit('nightecho:clear', { id: id });
    c.persist();
  }
  var subbed = false;
  function subscribe() { if (subbed || !core() || !core().on) { return; } subbed = true; core().on('field:clear', onClear); }

  var acc = 0;
  function step(dt) {
    acc += dt || 0;
    if (acc < 0.5) { return; }
    acc = 0;
    sweep();
    if (!lit()) { return; }
    var p = pos(), F = FC();
    if (!F || !F.state || !F.state()) { return; }
    embers().forEach(function (q) { if (!camps[q.id] && Math.hypot(q.x - p.x, q.y - p.y) <= NEAR_R) { spawn(q); } });
  }

  /* ── 3D(코드 도형) ───────────────────────────────────── */
  var fx = {}, clock = 0, tex = null;
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function glow(T3) {
    if (tex) { return tex; }
    var cv = global.document.createElement('canvas'); cv.width = cv.height = 64;
    var g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, '#b98cff'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    tex = new T3.CanvasTexture(cv);
    return tex;
  }
  function build(T3) {
    var g = new T3.Group(), o = { root: g, flames: [] }, i;
    var halo = new T3.Sprite(new T3.SpriteMaterial({ map: glow(T3), transparent: true, depthWrite: false, opacity: 0.6, blending: T3.AdditiveBlending, fog: false }));
    halo.scale.set(7, 7, 7); halo.position.y = 1.8; g.add(halo); o.halo = halo;
    var mat = new T3.MeshBasicMaterial({ color: 0xb98cff, transparent: true, opacity: 0.85 });
    for (i = 0; i < 3; i++) {
      var f = new T3.Mesh(new T3.ConeGeometry(0.28 - i * 0.05, 1.3 + i * 0.4, 6), mat);
      f.position.set(Math.sin(i * 2.1) * 0.35, 0.65 + i * 0.2, Math.cos(i * 2.1) * 0.35); g.add(f); o.flames.push(f);
    }
    var ring = new T3.Mesh(new T3.TorusGeometry(0.9, 0.06, 4, 20), new T3.MeshBasicMaterial({ color: 0x6f4bd6 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    return o;
  }
  function paint(dt) {
    clock += dt || 0;
    var w = W3(), seen = {}, id;
    if (!w) { fx = {}; return; }
    var T3 = w.three();
    if (!T3) { return; }
    var p = pos();
    embers().forEach(function (q) {
      if (Math.hypot(q.x - p.x, q.y - p.y) > SEE_R) { return; }
      seen[q.id] = true;
      var o = fx[q.id] || (fx[q.id] = build(T3)); if (!o.added) { o.added = true; w.addFx(o.root); }
      o.root.position.set(q.x, w.groundY ? w.groundY(q.x, q.y) : 0, q.y);
      o.halo.material.opacity = 0.45 + Math.sin(clock * 2.4) * 0.15;
      o.flames.forEach(function (f, i) { f.scale.y = 0.8 + Math.sin(clock * 7 + i * 2) * 0.25; });
    });
    for (id in fx) { if (fx.hasOwnProperty(id) && !seen[id]) { w.removeFx(fx[id].root); delete fx[id]; } }
  }
  function tick(dt) {
    if (!core() || !core().save) { return; }
    subscribe();
    step(dt);
    if (!global.DG_NO_DRAW) { paint(dt); } else { fx = {}; }
  }

  global.DG = global.DG || {};
  global.DG.nightEcho = {
    SPOTS: SPOTS, AFTER_CH: AFTER_CH, NIGHT_FROM: NIGHT_FROM, NIGHT_TO: NIGHT_TO, NEAR_R: NEAR_R, FAR_R: FAR_R, REWARD: REWARD,
    isNight: isNight, dayKey: dayKey, open: open, lit: lit, spots: spots, posOf: posOf, rewardOf: rewardOf, done: done, embers: embers,
    camp: function (id) { return camps[id] || null; }, step: step, tick: tick,
    _setNowForTest: function (fn) { nowFn = fn || function () { return Date.now(); }; },
    _resetForTest: function () { Object.keys(camps).forEach(dropCamp); camps = {}; fx = {}; acc = 0; subscribe(); }
  };
})(window);
