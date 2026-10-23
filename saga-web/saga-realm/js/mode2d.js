/**
 * 2D 모드 공용 부품 — 새 2D 스프라이트 시트(K-0015 산출, 판별 `assets/sprites2d_sheets/`)를 읽어 그린다. (W-0019)
 *
 * 시트 규격: `<풀>/<동작>.webp` 한 장 = 가로 프레임 8 × 세로 방향 3행(0 정면·1 옆·2 뒤, 반대 옆은 좌우 뒤집기),
 * 프레임 128px. 동작 idle/walk/attack/hit/death. `<풀>/manifest.json` 이 규격을, `index.json` 이 그 판이 가진 풀 목록을 준다.
 *
 * **정본은 saga-web/shared/js/mode2d.js** — 판별 복사본은 tools/sync-shared.mjs 가 만든다(직접 고치지 않는다).
 * 판마다 다른 것(풀 ↔ 인물·괴물 종류 표·지금 2D 모드인가)은 각 판 core.js 끝 `DG.cfg.mode2d` 가 준다(부를 때마다 읽으므로 로드 순서는 상관없다):
 *   { base, on(): bool, pools: { <종류>: [풀id…] }, poolH: { <풀id>: 프레임 안 몸 높이(px) }, targetH: 화면에 보일 보통 몸 높이(px), foot: 발 위치(프레임 높이 비율) }
 *   풀마다 몸 크기가 달라(고블린 50px·오크 102px / 프레임 128) poolH 로 같은 높이로 맞춘다. 호출의 scale 은 그 위에 곱하는 배수(보스 등)
 *
 * **자료가 없거나 아직 안 받았으면 아무 것도 안 그리고 false 를 돌려준다** — 부르는 쪽은 그 자리에서 기존 그림(코드 스탬프 등)을 그린다.
 * 즉 에셋이 빠져 있어도 오류 0, 기존 동작 그대로. 이미지는 처음 쓸 때 한 번만 받는다.
 */
(function (global) {
  'use strict';

  /** 판 설정 — 부를 때마다 읽는다(이 파일이 core.js 보다 먼저 로드돼도 된다) */
  function C() { return (global.DG && global.DG.cfg && global.DG.cfg.mode2d) || {}; }
  function base() { return C().base || 'assets/sprites2d_sheets/'; }
  var FRAMES = 8, PX = 128, FPS = { idle: 6, walk: 10, attack: 14, attack2: 14, heavy: 11, hit: 12, death: 10, knockdown: 10 };
  var ONCE = { attack: true, attack2: true, heavy: true, hit: true, death: true, knockdown: true };      // 한 번 돌고 마지막 프레임에 머문다
  var ROW = { front: 0, side: 1, back: 2 };

  var imgs = {};          // 'pool/clip' → { img, ok, fail }
  var index = null, indexTried = false;

  /** 지금 2D 모드인가 — 판이 정한다(없으면 항상 참 — 이 부품을 부른 쪽이 이미 2D 자리에서 부른 것) */
  function isOn() { var c = C(); return c.on ? !!c.on() : true; }

  /** 같은 id 는 늘 같은 풀을 받는다(씨앗 해시) — 판별 표 `pools[종류]` 에서 고른다. 표에 없는 종류는 null(기존 그림) */
  function hashOf(seed) {
    var s = String(seed === undefined || seed === null ? '' : seed), h = 2166136261, i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  /** 짐승형 적 → { pool, k } (W-0051) — 판 cfg.mode2d.beast = { 이름: ['beast_wolf', 몸 배수] } 에 든 어울리는 적만. 없으면 null(옛 스탬프) */
  function beastOf(name) {
    var t = (C().beast || {})[name];
    return t && isStill(t[0]) ? { pool: t[0], k: t[1] || 1 } : null;
  }

  /* ── W-0349 몸 크기 한 기준 — 사람 키 = 1. 종류(SCALE)·짐승 그림 이름(BEAST, 그림의 긴 변 ÷ 사람 키) 표 하나를 다섯 판이 같이 쓰고,
     판 설정 `cfg.mode2d.scale = { <종류>: k, '<종류>:<id>': k }` 가 덮는다. 손잡이 mode2d.scaleTable(1 새 표 · 0 옛 크기 — 비교판용). 그림 크기만, 판정은 그대로 */
  var SCALE = { human: 1, child: 0.72, beast: 1, small: 0.5, mid: 0.8, large: 1.15, horse: 1.3, huge: 1.8, house: 2.6, tower: 4, tree: 2.4, boulder: 1.4, pond: 0.8, stele: 1.3, prop: 0.6 };
  var BEAST = {
    Alien: 0.9, Alien_2: 0.9, Alpaca: 1.05, Alpaking: 1.2, Anglerfish: 0.5, Apatosaurus: 2.4, Armored_Catfish: 0.5, Bear: 1.15, Betta: 0.3, Birb: 0.35, Black_Lion_Fish: 0.4,
    Blobfish: 0.4, BlueDemon: 1, Blue_Goldfish: 0.3, Blue_Tang: 0.35, Boar: 0.8, Bull: 1.3, Bunny: 0.35, Butterfly_Fish: 0.3, Cardinal_Fish: 0.3, Cat: 0.45, Cat_Monster: 0.7,
    Clownfish: 0.3, Coral_Grouper: 0.5, Cow: 1.25, Cowfish: 0.35, Cow_Farm: 1.25, Crane: 0.8, Deer: 1, Demon: 1.1, Dino: 1.3, Dolphin: 1.2, Donkey: 1.05, Dragon: 1.7,
    Dragon_Evolved: 2, Elephant: 1.9, Fish1: 0.4, Fish2: 0.4, Fish3: 0.4, Flatfish: 0.4, Flower_Horn: 0.4, Fox: 0.55, Frog: 0.3, Ghost: 0.9, Glub: 0.5, Glub_Evolved: 0.8,
    Goblin_Shark: 1.2, Goldfish: 0.3, Goleling: 0.6, Horse: 1.3, Horse_Farm: 1.3, Horse_White: 1.3, Humphead: 0.7, Husky: 0.7, Hywirl: 0.6, Koi: 0.45, Koi_x2: 0.5, Lionfish: 0.4,
    Llama: 1.05, Mandarin_Fish: 0.3, Manta_ray: 1.2, Monkey: 0.55, Monkroose: 0.6, Moorish_Idol: 0.3, Mushnub: 0.5, Orc: 1.05, Owl: 0.4, Panda: 1, Parasaurolophus: 1.8,
    Parrot_Fish: 0.45, Pig: 0.65, Pigeon: 0.35, Pink_Slime: 0.5, Piranha: 0.35, Puffer: 0.35, Pug: 0.4, Rat: 0.3, Red_Snapper: 0.5, Robot_Drone: 0.5, Robot_Large: 1.6,
    Robot_Walker: 1.2, Royal_Gramma: 0.3, Shark: 1.4, Shark_x2: 1.5, Sheep: 0.75, ShibaInu: 0.55, Snake: 0.7, Snake_angry: 0.7, Squidle: 0.6, Stag: 1.1, Stegosaurus: 1.9,
    Sunfish: 0.9, Swordfish: 1.2, Tang: 0.35, Tetra: 0.25, Tiger: 1.25, Trex: 2, Triceratops: 1.8, Tuna: 0.8, Turbot: 0.5, Velociraptor: 1, Wasp: 0.3, Whale: 2.4, Wizard: 1,
    Wolf: 0.8, Worm: 0.5, Yellow_Tang: 0.35, Yeti: 1.3, Zebra: 1.25, Zebra_Clown_Fish: 0.3, Zombie: 1,
    pk_alakazam: 0.95, pk_bulbasaur: 0.5, pk_charizard: 1.2, pk_charmander: 0.5, pk_dragonite: 1.4, pk_eevee: 0.4, pk_gengar: 0.8, pk_gyarados: 1.8, pk_lapras: 1.5,
    pk_magikarp: 0.5, pk_mew: 0.4, pk_mewtwo: 1.1, pk_pikachu: 0.4, pk_slowbro: 0.9, pk_snorlax: 1.4, pk_squirtle: 0.5, pt_magpie: 0.4
  };
  function scaleOn() { var Co = global.DG && global.DG.core; return !(Co && Co.tuned) || +Co.tuned('mode2d.scaleTable', 1) > 0; }
  /** 사람 키를 1 로 본 그 종류(·id)의 크기. 판 설정 '종류:id' > 짐승 표(id = 그림 이름) > 판 설정 종류 > 공용 종류 > 1 */
  function scaleOf(kind, id) {
    var o = C().scale || {}, v;
    if (id !== undefined && id !== null) {
      v = o[kind + ':' + id]; if (v !== undefined) { return +v; }
      if (kind === 'beast' && BEAST[id] !== undefined) { return BEAST[id]; }
    }
    v = o[kind]; if (v !== undefined) { return +v; }
    return SCALE[kind] !== undefined ? SCALE[kind] : 1;
  }
  /** 발밑 그림자 한 꼴 — (x, y) 발 밑 가운데, w = 그림자 폭(px). o = { a: 진하기(0.3), fade: 곱(뜰수록 작게) }
   *  W-0368 두 겹(손잡이 mode2d.shadow2, 기본 1 · 0 = 옛 타원 하나): 옅고 큰 퍼짐 + 발이 닿는 진하고 작은 핵 — 옅은 타원 하나라 몸이 떠 보였다 */
  function shadow(ctx, x, y, w, o) {
    o = o || {};
    var f = o.fade === undefined ? 1 : Math.max(0, o.fade), a = (o.a === undefined ? 0.3 : o.a) * f, rx = w / 2 * (0.4 + 0.6 * f);
    if (!ctx || !(rx > 0) || !(a > 0)) { return; }
    ctx.save();
    if (tuneOf('mode2d.shadow2', 1)) {
      ctx.fillStyle = 'rgba(0,0,0,' + (a * 0.55).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(x, y, rx * 1.15, Math.max(1.5, rx * 0.42), 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.7, a * 1.5 * f).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(x, y, rx * 0.5, Math.max(1, rx * 0.17), 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(x, y, rx, Math.max(1.5, rx * 0.38), 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  /* W-0368 환경 톤 — 판이 프레임마다 지금 밝기를 알려 주면(밤·비·던전 어둠) 인물·소품 그림도 같은 만큼 어두워진다(전엔 배경만 어둡고 몸은 낮 색).
     setTone(b, sat) — b 밝기 곱(1 = 그대로), sat 채도 곱(기본 1). 손잡이 mode2d.tone 0 이면 안 씀. ctx.filter 를 모르는 브라우저는 그대로(오류 없음) */
  var toneF = '';
  function setTone(b, sat) {
    b = Math.max(0.2, Math.min(1.2, +b || 1)); sat = Math.max(0, Math.min(1.5, sat === undefined ? 1 : +sat));
    toneF = (Math.abs(b - 1) < 0.02 && Math.abs(sat - 1) < 0.02) || !tuneOf('mode2d.tone', 1) ? '' : 'brightness(' + b.toFixed(2) + ')' + (Math.abs(sat - 1) < 0.02 ? '' : ' saturate(' + sat.toFixed(2) + ')');
    return toneF;
  }
  /* W-0368 ⑤ 발 먼지 — 걷기 위상(stride 0~1, 0·0.5 = 발이 땅에 닿음) 뒤 40% 동안 발 양옆에 옅은 흙먼지 둘이 퍼지며 사라진다.
     상태 없음(위상만 봄 — 몸 따라 같이 움직임) · 손잡이 mode2d.stepDust 1(0 = 끔) · 몸 뒤에 그린다 */
  function stepDust(ctx, o, bodyH) {
    if (!ctx || !o || o.clip !== 'walk' || o.stride === undefined || o.stride === null || !tuneOf('mode2d.stepDust', 1)) { return 0; }
    var q = ((+o.stride * 2) % 1 + 1) % 1, k, i, n = 0, H = Math.max(8, +bodyH || 62), a;
    if (q > 0.4) { return 0; }
    k = q / 0.4; a = 0.24 * (1 - k) * (o.alpha === undefined ? 1 : o.alpha);
    ctx.save(); ctx.fillStyle = 'rgba(196,184,160,' + a.toFixed(3) + ')';
    for (i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.ellipse(o.x + i * H * (0.08 + 0.07 * k), o.y - H * 0.03 * k, H * 0.05 * (0.6 + k), H * 0.025 * (0.6 + k), 0, 0, Math.PI * 2); ctx.fill(); n++; }
    ctx.restore();
    return n;
  }
  function applyTone(ctx) { if (toneF && ctx && 'filter' in ctx) { ctx.filter = toneF; } }

  /* ── W-0350 2D 표식 이모지 → 자체 아이콘(K-0118 ui_*_g0.png, 다섯 판 assets/icons/icon64 — sync-shared 가 복사). ctx.fillText 대신 쓴다:
     글이 짝 있는 이모지로 시작하면 그 이모지만 그림으로(뒤 글은 그대로), 그림을 받기 전·짝 없음·손잡이 mode2d.markIcon 0 이면 옛 fillText.
     짝 없는 이모지는 markMisses() 에 모인다(K 그림 요청 목록) */
  var MARK = {
    '⚔': 'swords', '🗡': 'swords', '⚒': 'hammer', '🔨': 'hammer', '🛠': 'wrench', '🔧': 'wrench', '🚩': 'flag', '🏴': 'flag', '🏳': 'flag', '🎌': 'flag', '⛳': 'flag',
    '🧭': 'compass', '🗺': 'map', '📜': 'scroll', '📃': 'scroll_text', '📄': 'scroll_text', '📝': 'scroll_text', '📖': 'book_open', '📚': 'book_open', '📕': 'book_open',
    '🪙': 'coins', '💰': 'coins', '🏅': 'medal', '🎖': 'medal', '🏆': 'award', '🎒': 'backpack', '📦': 'box', '🎁': 'box', '❓': 'circle_question_mark', '❔': 'circle_question_mark',
    '📋': 'clipboard_list', '✉': 'mail', '📮': 'mail', '📬': 'mail', '👣': 'footprints', '🐾': 'footprints', '🍖': 'ham', '🍗': 'ham', '🎨': 'palette', '✨': 'sparkles', '🌟': 'sparkles',
    '🏪': 'store', '🏬': 'store', '🛒': 'store', '👤': 'user', '❌': 'x', '✖': 'x', '🔄': 'rotate_ccw', '📡': 'satellite_dish', '🤖': 'bot',
    '💧': 'spring', '⛩': 'shrine', '🪜': 'stairs', '💠': 'elite', '👹': 'boss', '⛏': 'mine', '🧺': 'merchant', '🧩': 'puzzle', '🙏': 'event', '🌿': 'herb', '🪧': 'signpost', '🕳': 'pit', '🪨': 'rock', '🌀': 'portal', '☠': 'skull', '↔': 'crossing', '🪦': 'gravestone', '🧎': 'worship', '🗿': 'statue', '🔔': 'bell', '🪞': 'mirror', '🔏': 'seal', '🍶': 'wine', '🧪': 'potion', '🏮': 'lantern'   // W-0391 K-0167 표식 25(장소·사건 — 지도·2D 이름표)
  };
  var markImgs = {}, markMiss = {}, EMO = /^(\p{Extended_Pictographic}(?:️|︎|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*)\s?/u;
  function markOn() { var Co = global.DG && global.DG.core; return !(Co && Co.tuned) || +Co.tuned('mode2d.markIcon', 1) > 0; }
  /** 이모지 하나의 아이콘 주소 — 짝 없으면 null */
  function icoBase() { var A = global.DG && global.DG.assets3d, u = A && A.sharedUrl ? A.sharedUrl('icons/icon64/') : null; return u || 'assets/icons/icon64/'; }   // W-0359 다섯 판 한 벌(shared) — 못 찾으면 판 경로
  function markSrc(e) { var n = MARK[String(e || '').replace(/[️︎]/g, '')]; return n ? icoBase() + 'ui_' + n + '_g0.png' : null; }
  function markImg(src) {
    var e = markImgs[src];
    if (!e) { e = markImgs[src] = { ok: false }; if (global.Image) { var im = new global.Image(); im.onload = function () { e.ok = true; }; im.onerror = function () { e.fail = true; }; im.src = src; e.img = im; } }
    return e.ok ? e.img : null;
  }
  /** fillText 자리 — (x, y) 와 정렬·기준선은 지금 ctx 그대로. 그림으로 그렸으면 true */
  function mark(ctx, s, x, y) {
    s = String(s === undefined || s === null ? '' : s);
    var m = EMO.exec(s), src = m && markSrc(m[1]), im = src && markOn() ? markImg(src) : null;
    if (m && !src) { var k = m[1].replace(/[️︎]/g, ''); markMiss[k] = (markMiss[k] || 0) + 1; }
    if (!im) { ctx.fillText(s, x, y); return false; }
    var fz = /(\d+(?:\.\d+)?)px/.exec(ctx.font || ''), px = (fz ? +fz[1] : 16) * (s.length > m[0].length ? 1.1 : 1.35), rest = s.slice(m[0].length), gap = rest ? px * 0.18 : 0;
    var tw = rest ? ctx.measureText(rest).width : 0, all = px + gap + tw, al = ctx.textAlign, bl = ctx.textBaseline;
    var x0 = al === 'center' ? x - all / 2 : (al === 'right' || al === 'end') ? x - all : x;
    var top = bl === 'middle' ? y - px / 2 : (bl === 'top' || bl === 'hanging') ? y : y - px * 0.86;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = Math.max(2, px * 0.12); ctx.shadowOffsetY = px * 0.04;   // 그림 안 여백·옅은 색이라 땅 위에서 묻히지 않게
    ctx.drawImage(im, x0, top, px, px); ctx.restore();
    if (rest) { ctx.save(); ctx.textAlign = 'left'; ctx.fillText(rest, x0 + px + gap, y); ctx.restore(); }
    return true;
  }

  /* ── VRoid 2D 시트(W-0074 2D) — 사람은 시대 구분 없이 VRoid 로 만든 시트(`shared/assets/characters2d/<id>/`, 규격은 위와 같음)로.
     판 설정 `cfg.mode2d.vroid2d = { kinds: [사람 종류…], h: 프레임 안 몸 높이(px), foot }` 가 있는 판·종류만. 제 시트가 있는 인물(도감·장수 299)은
     제 것, 없는 사람(주민·적·나)은 3D 와 같은 빌린 몸(assets3d.borrowRecipe) — 2D·3D 에서 같은 사람이 같은 몸. 통일 에셋 시험이 안 됐으면 null(옛 풀) */
  var VPRE = 'vroid:';
  function vroidPick(kind, seed) {
    var v = C().vroid2d, A = global.DG && global.DG.assets3d;
    if (!v || (v.kinds || []).indexOf(kind) < 0 || !A || !A.state || A.state() !== 'ok') { return null; }
    var id = String(seed === undefined || seed === null ? '' : seed);
    if (id && A.has('hero', id)) { return VPRE + id; }
    var r = A.borrowRecipe && A.borrowRecipe(id || kind);
    if (!(r && r.key && r.key.indexOf('uni:') === 0)) { return null; }
    var Co = global.DG.core, k = Co && Co.tuned ? +Co.tuned('mode2d.borrowTint', 1) : 1;
    return VPRE + r.key.slice(4) + (k > 0 ? TPRE + tintSlot(id || kind) : '');   // W-0121 — 빌린 몸은 사람마다 옷 색(풀 꼬리 '~칸')
  }
  function isVroid(pool) { return typeof pool === 'string' && pool.indexOf(VPRE) === 0; }

  /* ── 몬스터 2D 시트(W-0129, K-0090 ③) — `shared/assets/creatures2d/<id>/`(id = 3D 몸 id: boss_01..12·mon_<계통>_01..04·mon_sp_*). 사람 시트와 같은 꼴(128px·8프레임·
     행 0 정면·1 오른쪽 옆·2 뒤). 몸마다 찍은 폭이 달라(manifest `ortho_m`, 사람 시트는 2.5m) 배율 = ortho_m÷2.5(상한 CREA_MAX), 발 = anchor_feet_y_px/px.
     manifest 를 받기 전·공용 에셋 주소를 아직 모르면 false(→ 부른 쪽이 옛 그림). 풀 이름 'crea:<id>' */
  var CPRE = 'crea:', CREA_MAX = 2.2, creas = {};
  function isCrea(pool) { return typeof pool === 'string' && pool.indexOf(CPRE) === 0; }
  function creaRoot() { var A = global.DG && global.DG.assets3d; return A && A.state && A.state() === 'ok' && A.root ? A.root() : null; }
  /** manifest → { foot, k } — 순수(진단이 그대로 부른다) */
  function creaFit(man) { var px = (man && man.px) || PX; return { foot: man && man.anchor_feet_y_px ? man.anchor_feet_y_px / px : 0.88, k: Math.min(CREA_MAX, Math.max(0.4, ((man && man.ortho_m) || 2.5) / 2.5)) }; }
  function creaInfo(id) {
    var c = creas[id], r = creaRoot();
    if (c || !r) { return c || null; }
    c = creas[id] = { fit: null, fail: false };
    if (!global.fetch) { c.fail = true; return c; }
    global.fetch(r + 'creatures2d/' + id + '/manifest.json').then(function (x) { return x.ok ? x.json() : null; })
      .then(function (j) { if (j) { c.fit = creaFit(j); } else { c.fail = true; } })['catch'](function () { c.fail = true; });
    return c;
  }
  /** 몸 id → 풀 이름(공용 에셋 주소를 아직 모르면 null) */
  function creaPool(id) { return id && creaRoot() ? CPRE + id : null; }

  /* ── 빌린 몸 옷 색(W-0121) — 빌린 VRoid 시트는 옷이 검정·회색 정장이라 작은 2D 에서 주민이 회색 조각상처럼 섰다. 사람 씨앗으로 색 칸(1~11)을
     정해 풀 이름 꼬리('vroid:<몸>~<칸>')에 싣고, 그릴 때 시트의 어둡고 채도 낮은 화소(옷)만 그 색조로 바꾼다 — 밝은 얼굴·흰 셔츠·피부·윤곽선은 그대로.
     결과는 (시트·칸·프레임·행) 한 칸씩 캐시(매 프레임 새 캔버스 없음). 손잡이 core.tuned('mode2d.borrowTint', 1) — 0 이면 원본, 0~1 은 섞는 세기 */
  var TPRE = '~', TINT_N = 11;
  function tintSlot(seed) { return 1 + hashOf('tint:' + (seed === undefined || seed === null ? '' : seed)) % TINT_N; }
  function bare(pool) { var i = typeof pool === 'string' ? pool.indexOf(TPRE) : -1; return i > 0 ? pool.slice(0, i) : pool; }
  function tintOf(pool) { var i = typeof pool === 'string' ? pool.indexOf(TPRE) : -1; return i > 0 ? (+pool.slice(i + 1) || 0) : 0; }
  function hsl(h, s, l) {
    function f(n) { var q = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(q - 3, 9 - q, 1)); }
    return [f(0), f(8), f(4)];
  }
  /** 화소 하나 → 새 [r, g, b] (순수 함수). 옷 무게 = 어두움(밝기 0.45 아래 다, 0.62 위 없음) × 무채색(채도 0.10 아래 다, 0.20 위 없음) × 윤곽선 아님(밝기 0.03 위).
   *  새 색 = 칸 색조(채도 0.55)에 원래 밝기를 들어 올린 명도 — 검정 정장도 어두운 색 옷이 된다 */
  function tintPx(r, g, b, slot, k) {
    var L = (0.299 * r + 0.587 * g + 0.114 * b) / 255, S = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    var w = Math.min(1, Math.max(0, (0.62 - L) / 0.17)) * Math.min(1, Math.max(0, (0.20 - S) / 0.10)) * Math.min(1, Math.max(0, (L - 0.03) / 0.04)) * (k === undefined ? 1 : k);
    if (!(w > 0) || !(slot > 0)) { return [r, g, b]; }
    var c = hsl((slot - 1) / TINT_N, 0.55, Math.min(0.62, 0.14 + L * 1.05));
    return [Math.round(r + (c[0] * 255 - r) * w), Math.round(g + (c[1] * 255 - g) * w), Math.round(b + (c[2] * 255 - b) * w)];
  }
  /** 세로 무게(W-0195) — 순수. 몸(위 끝 top ~ 아래 끝 bot, 칸 안 행)에서 머리(위 HEAD)·허리(WAIST) 아래는 low, 그 사이 윗옷만 1, 경계는 BAND 만큼 부드럽게.
   *  옷 색 칸이 머리카락·윗옷·하의·신발을 다 같은 색으로 칠해 온몸이 한 빛 실루엣이 되던 것(방문객 회색 원피스 + 올리브 레깅스 → 보라 한 빛) — 윗옷만 칸 색 */
  var HEAD = 0.16, WAIST = 0.45, BAND = 0.08;
  function tintRowW(y, top, bot, low) {
    if (!(bot > top) || low === undefined || low === null || low >= 1) { return 1; }
    var t = (y - top) / (bot - top), h = HEAD - BAND / 2, a = WAIST - BAND / 2;
    if (t <= h) { return low; }
    if (t < h + BAND) { return low + (1 - low) * (t - h) / BAND; }
    return t <= a ? 1 : t >= a + BAND ? low : 1 + (low - 1) * (t - a) / BAND;
  }
  /** RGBA 화소 배열을 제자리에서 바꾼다 — 바뀐 화소 수. P(칸 폭)·low 를 주면 세로 무게(몸 위·아래 끝은 알파로 잰다) */
  function tintData(d, slot, k, P, low) {
    var n = 0, i, p, top = -1, bot = -1, row, wy = 1, lastRow = -1;
    if (P > 0 && low !== undefined && low < 1) {
      for (i = 3; i < d.length; i += 4) { if (d[i] >= 8) { row = Math.floor((i >> 2) / P); if (top < 0) { top = row; } bot = row; } }
    }
    for (i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) { continue; }
      if (top >= 0) { row = Math.floor((i >> 2) / P); if (row !== lastRow) { wy = tintRowW(row, top, bot, low); lastRow = row; } }
      p = tintPx(d[i], d[i + 1], d[i + 2], slot, (k === undefined ? 1 : k) * wy);
      if (p[0] !== d[i] || p[1] !== d[i + 1] || p[2] !== d[i + 2]) { d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; n++; }
    }
    return n;
  }
  var tints = {}, tintPxSum = 0, TINT_CAP = 12e6;   // 칸 캐시 — 화소 합이 상한(≈48MB)을 넘으면 비우고 다시 칠한다
  /** 시트 한 칸(sx, sy, P)을 칸 색으로 칠한 캔버스 — 못 하면(캔버스 없음·읽기 막힘) null → 원본 그대로 */
  function tintCell(e, key, sx, sy, P, slot, k, low) {
    var ck = key + '~' + slot + '@' + k + '/' + low + '|' + sx + ',' + sy, c = tints[ck];
    if (c !== undefined) { return c; }
    if (tintPxSum > TINT_CAP) { tints = {}; tintPxSum = 0; }
    c = null;
    try {
      var doc = global.document, cv = doc && doc.createElement('canvas');
      if (cv && cv.getContext) {
        cv.width = cv.height = P;
        var g = cv.getContext('2d');
        g.drawImage(e.img, sx, sy, P, P, 0, 0, P, P);
        var im = g.getImageData(0, 0, P, P);
        tintData(im.data, slot, k, P, low);
        g.putImageData(im, 0, 0);
        c = cv; tintPxSum += P * P;
      }
    } catch (err) { c = null; }
    tints[ck] = c;
    return c;
  }

  function pick(kind, seed) {
    var vp = vroidPick(kind, seed);
    if (vp) { return vp; }
    var list = (C().pools || {})[kind];
    if (!list || !list.length) { return null; }
    return list[hashOf(seed) % list.length];
  }

  /** 동작 안의 몇 번째 프레임인가 — 순수 함수. 한 번 도는 동작(attack·hit·death)은 마지막 프레임에 머문다 */
  function frameAt(clip, ms) {
    var fps = FPS[clip] || 8, i = Math.floor(Math.max(0, ms) / 1000 * fps);
    return ONCE[clip] ? Math.min(FRAMES - 1, i) : i % FRAMES;
  }

  /* ── 걸음 = 보폭(W-0203) ─────────────────────────────────
     걷기 8칸을 시계(10fps, 속도 무관)로 넘기면 3마을은 다리가 느려 미끄러지고 1만리는 제자리걸음이었다. 키(배우)마다 땅 위를
     움직인 화면 거리를 쌓아 위상을 낸다 — 두 발 한 바퀴 = 몸 높이 × strideK. 세계 좌표를 받으니 카메라가 나를 따라가도(화면 위치 고정) 맞다 */
  var paces = {}, paceN = 0;
  /** W-0347 — 큰 그림(시트 칸 256~512px)을 화면 크기로 줄일 때 기본(low) 필터는 가는 선이 점묘처럼 지글거린다 → high(밉맵·큐빅). 손잡이 mode2d.mip 0 = 옛 그리기(비교판) */
  function hq(ctx) { if (ctx && 'imageSmoothingQuality' in ctx) { ctx.imageSmoothingQuality = tuneOf('mode2d.mip', 1) ? 'high' : 'low'; } return ctx; }
  function tuneOf(k, d) { var Cc = global.DG && global.DG.core, v = Cc && Cc.tuned ? Cc.tuned(k, d) : d; return +v; }
  /** → 걷기 위상 0~1. wx·wy 세계 좌표, ppu 화면 px/세계 단위, bodyPx 화면 몸 높이, ms 지금. 몸 높이 3배 넘게 뛰면 순간이동이라 안 쌓는다.
   *  빠르기 묶음: strideMaxHz(한 바퀴/초, 넘으면 다리 깜박임) · strideMinHz(화면 속도가 아주 느린 1만리도 걷는 티) */
  function pace(key, wx, wy, ppu, bodyPx, ms) {
    var body = Math.max(1, +bodyPx || 1), cyc = Math.max(0.2, tuneOf('mode2d.strideK', 0.9)) * body, now = +ms || 0, s = paces[key];
    if (!s) { if (++paceN % 200 === 0) { for (var k in paces) { if (now - paces[k].ms > 10000) { delete paces[k]; } } } s = paces[key] = { x: wx, y: wy, acc: 0, ms: now }; return 0; }
    var d = Math.hypot(wx - s.x, wy - s.y) * (+ppu || 1), dt = Math.max(0, Math.min(0.25, (now - s.ms) / 1000));
    s.x = wx; s.y = wy; s.ms = now;
    if (d > 0 && d <= 3 * body) { s.acc += Math.max(tuneOf('mode2d.strideMinHz', 0.6) * cyc * dt, Math.min(tuneOf('mode2d.strideMaxHz', 3.2) * cyc * dt, d)); }
    return (s.acc / cyc) % 1;
  }

  /** 움직인 쪽 → 보는 쪽(W-0073 단계 1) — 세로가 가로보다 확실히 크면 'front'(화면 아래로)·'back'(위로), 아니면 좌우 side(±1).
   *  (dx, dy) 는 마지막 이동 방향(멈춰도 남겨 둔 값) — 위로 걷다 서면 뒷모습 그대로. 둘 다 0 이면 side */
  function face(dx, dy, side) {
    dx = +dx || 0; dy = +dy || 0;
    return Math.abs(dy) > Math.abs(dx) * 1.2 ? (dy > 0 ? 'front' : 'back') : side;
  }

  /** 보는 쪽 → 시트의 (행, 좌우 뒤집기). 'left'/'right' 는 옆모습(오른쪽이 기준, 왼쪽은 뒤집기) */
  function dirOf(facing) {
    if (facing === 'front') { return { row: ROW.front, flip: false }; }
    if (facing === 'back') { return { row: ROW.back, flip: false }; }
    var left = facing === 'left' || (typeof facing === 'number' && facing < 0);
    return { row: ROW.side, flip: left };
  }

  /* ── 8방향 무기 시트(W-0073, K-0029 단계 5) — `characters2d8/<id>/<역할>.webp` 8프레임 × 5행(d0 정면·d1 오른쪽 앞 3/4·d2 오른쪽 옆·
     d3 오른쪽 뒤 3/4·d4 뒤, 왼쪽 셋은 d1~d3 좌우 뒤집기). 어느 인물에 있나·칸 크기·카메라 높이는 assets3d-ids `hero2d8 = {id: [px, cam_z]}`
     (폴더에서 생성 — 파일을 두드리지 않아 404 가 없다). 표에 없으면 지금 3행 시트 그대로 */
  var ROLES8 = { idle: 1, walk: 1, attack: 1, attack2: 1, heavy: 1, hit: 1, death: 1, knockdown: 1 };
  /* W-0296 공중 몸짓 — K-0135 가 8방향 폴더에 `jump.webp`·`fall.webp`(옆 한 줄 8프레임)를 둔다. 오기 전·없는 인물은 걷기 시트의 다리 벌린 칸(AIR_T)을 멈춰 쓴다 */
  var AIR = { jump: 1, fall: 1 }, AIR_T = 0.3;
  var PPM = 51.2;   // 1m = 51.2px — 128 칸(2.5m)·192 칸(3.75m) 공통(K-0029 manifest px_per_m)
  function sheet8(pool) {
    var t = isVroid(pool) && global.DG && global.DG.assets3dIds && global.DG.assets3dIds.hero2d8;
    return (t && t[bare(pool).slice(VPRE.length)]) || null;
  }
  /** 동작 이름 → 시트에 있는 역할. 8방향은 8역할, 3행 시트는 idle·walk·attack·hit·death 다섯(나머지는 가까운 것) */
  function roleOf(clip, eight) {
    clip = clip || 'idle';
    if (eight) { return ROLES8[clip] ? clip : clip === 'cast' ? 'heavy' : (/^attack/.test(clip) ? 'attack' : 'idle'); }   // W-0311 cast 는 16방향 시트에만 — 옛 시트는 강공격 칸
    return { attack2: 'attack', heavy: 'attack', cast: 'attack', knockdown: 'death', jump: 'walk', fall: 'walk' }[clip] || (FPS[clip] && clip) || 'idle';   // 3행 시트에 없는 이름은 idle(없는 파일 404 막기)
  }
  /** W-0138 — 마을 맨손 시트(K-0083 ①): 8방향 시트를 가진 사람(hero2d8, 299 전부 idle_town·walk_town 있음)이 o.town 이면
   *  서기·걷기를 맨손 그림으로. 순수(진단이 본다) — 그 밖(공격·피격, 3행 시트, 짐승)은 roleOf 그대로 */
  /** 8방향 칸 크기·카메라 높이 [P, camZ] — 순수. 표(hero2d8)는 싸움 시트 기준인데, 192 칸 인물(318/500)의 마을 시트(idle_town·walk_town)는
   *  128 칸으로 구워져(1024×640) 192 로 자르면 몸이 칸 밖으로 밀리고 이웃 프레임이 끼거나 비었다(W-0190). 받은 그림 폭(natW)으로 고친다 */
  var CAMZ = { 128: 0.95, 192: 1.15 };
  function cell8(s8, natW) {
    var P = s8[0], cz = s8[1], q = natW > 0 ? natW / FRAMES : P;
    if (q !== P && q > 0) { cz = CAMZ[q] || cz * q / P; P = q; }
    return [P, cz];
  }
  function townRole(role, eight, town) { return town && eight && (role === 'idle' || role === 'walk') ? role + '_town' : role; }
  /** 이 풀·동작·마을 여부로 고를 시트 열쇠(받기 전 판단, 진단용) */
  function roleKey(pool, clip, town) { var e8 = !!sheet8(pool); return townRole(roleOf(clip, e8), e8, town); }
  /** 움직인 쪽(dx, dy — 화면 아래가 +) → 8방향 행·뒤집기. 45° 칸. 둘 다 0 이면 facing('front'·'back'·±1·'left'/'right')으로 */
  function dirOf8(dx, dy, facing) {
    dx = +dx || 0; dy = +dy || 0;
    var k;
    if (dx || dy) { k = Math.round(Math.atan2(dx, dy) / (Math.PI / 4)); }      // 0 정면(아래) · 2 오른쪽 · ±4 뒤 · 음수 = 왼쪽
    else if (facing === 'front') { k = 0; } else if (facing === 'back') { k = 4; }
    else { k = (facing === 'left' || (typeof facing === 'number' && facing < 0)) ? -2 : 2; }
    if (k === -4) { k = 4; }
    return { row: Math.abs(k), flip: k < 0 };
  }

  /* 짧은 몸짓(공격 0.2~0.4초·피격 0.3초) — 게임은 "남은 초"만 갖고 있다. 처음 본 값을 길이로 잡아 진행률 0..1 을 돌려준다(8프레임이 그 안에 다 돈다).
     남은 초가 다시 커지거나 0.25초 넘게 안 불렸으면(3D 로 바꿨다 돌아옴·방 옮김 — 묵은 기록을 잇지 않는다) 새 몸짓. 끝났으면(≤0) null → 부른 쪽은 걷기·서기로 */
  var acts = {}, actN = {}, ACT_STALE = 250;   // actN = 그 열쇠의 몸짓이 몇 번째인가(연타 번갈기)
  function actT(key, left) {
    var a = acts[key], now = Date.now();
    if (!(left > 0)) { if (a) { delete acts[key]; } return null; }
    if (!a || left > a.last + 1e-3 || now - a.at > ACT_STALE) { a = acts[key] = { dur: left, n: (actN[key] = (actN[key] || 0) + 1) }; }
    a.last = left; a.at = now;
    return Math.min(1, Math.max(0, 1 - left / a.dur));
  }

  /** 지금 몸짓의 { dur(처음 본 남은 초), n(몇 번째) } — 없으면 null */
  function actInfo(key) { return acts[key] || null; }

  function getImg(pool, clip, eight) {
    pool = bare(pool);   // 옷 색 꼬리(W-0121)는 같은 시트를 쓴다
    var key = pool + '/' + clip + (eight === 16 ? '#16' : eight ? '#8' : ''), e = imgs[key];
    if (e) { return e; }
    e = imgs[key] = { img: null, ok: false, fail: false };
    if (!global.Image) { e.fail = true; return e; }
    var im = new global.Image();
    im.onload = function () { e.ok = true; };
    im.onerror = function () { e.fail = true; };   // 파일이 없으면 영영 기존 그림 — 다시 받으려 들지 않는다
    im.src = isCrea(pool) ? creaRoot() + 'creatures2d/' + pool.slice(CPRE.length) + '/' + clip + '.webp'   // W-0129 몬스터 시트
      : isVroid(pool) ? global.DG.assets3d.root() + (eight === 16 ? 'characters2d16/' : eight ? 'characters2d8/' : 'characters2d/') + pool.slice(VPRE.length) + '/' + clip + '.webp' : base() + pool + '/' + clip + '.webp';
    e.img = im;
    return e;
  }

  /** 풀 하나를 미리 받아 둔다(없으면 조용히 건너뜀) */
  function preload(pool, clips) {
    (clips || ['idle', 'walk', 'attack', 'hit', 'death']).forEach(function (c) { getImg(pool, c); });
  }

  /**
   * 한 프레임을 그린다. o = { pool, clip, facing, ms, x, y(발 밑 가운데), scale(1 = 128px), alpha }
   * 받는 중이거나 파일이 없으면 false(→ 부른 쪽이 기존 그림을 그린다). 그렸으면 true.
   */
  /* ── 16방향·동작별 프레임 시트(W-0311) — 규격·방향·프레임은 sheetspec.js(순수). 표 hero2d16 에 있는 인물만, 그 동작 그림을 받은 뒤에만 이 길.
     받는 중이면 false → draw 가 옛 8방향 길로 그린다(깜박임 0). 역할은 자세(o.pose, W-0303)가 시트에 있으면 그것 — 그럴 땐 기울이기 대역을 안 쓴다 */
  function SS() { return global.DG && global.DG.sheetspec; }
  function spec16(pool) { return SS() && isVroid(pool) ? SS().lookup(bare(pool).slice(VPRE.length)) : null; }
  function role16(spec, o) {
    var S = SS(), pr = o.pose ? S.roleName(o.pose) : null, r = pr && S.roleOf(spec, o.pose) === pr ? pr : S.roleOf(spec, o.clip);
    if (o.town && (r === 'idle' || r === 'walk') && S.roleOf(spec, r + '_town') === r + '_town') { r = r + '_town'; }   // W-0138 마을 맨손
    return r;
  }
  function draw16(ctx, o, spec) {
    var S = SS(), role = role16(spec, o), e = getImg(o.pool, role, 16);
    if (!e.ok) { if (role !== 'idle') { getImg(o.pool, 'idle', 16); } return false; }
    var c = S.cellOf(spec, role, e.img && e.img.naturalWidth), P = c[0], d = S.dirOf16(o.dirX, o.dirY, o.facing), f = S.frameAt(spec, role, o.ms || 0, o.t, o.stride);
    var cf = C(), vr = cf.vroid2d, sc = (vr ? (cf.targetH || 62) / (vr.h || 85) : (cf.scale || 1)) * (o.scale || 1), w = P * sc, h = P * sc, foot = (P / 2 + c[1] * PPM + 1.5) / P;
    stepDust(ctx, o, (cf.targetH || 62) * (o.scale || 1)); ctx.save();
    if (o.alpha !== undefined) { ctx.globalAlpha = o.alpha; }
    ctx.imageSmoothingEnabled = true; hq(ctx); applyTone(ctx);
    if (d.flip) { ctx.translate(o.x, 0); ctx.scale(-1, 1); ctx.translate(-o.x, 0); }
    var P2 = o.pose && S.roleName(o.pose) !== role && global.DG.pose3d && global.DG.pose3d.frame2d ? global.DG.pose3d.frame2d(o.pose) : null;   // 시트에 그 자세가 없을 때만 대역
    if (P2) { ctx.translate(o.x, o.y); ctx.rotate(P2.rot); ctx.scale(P2.sx, P2.sy); ctx.translate(-o.x, -o.y); }
    var slot = tintOf(o.pool), Co = global.DG && global.DG.core, tk = slot && Co && Co.tuned ? Math.min(1, Math.max(0, +Co.tuned('mode2d.borrowTint', 1))) : 1;
    var tl = slot && Co && Co.tuned ? Math.min(1, Math.max(0, +Co.tuned('mode2d.borrowTintLow', 0.25))) : 1;
    var cell = slot && tk > 0 ? tintCell(e, bare(o.pool) + '/' + role + '#16', f * P, d.row * P, P, slot, tk, tl) : null;
    if (cell) { ctx.drawImage(cell, 0, 0, P, P, o.x - w / 2, o.y - h * foot, w, h); }
    else { ctx.drawImage(e.img, f * P, d.row * P, P, P, o.x - w / 2, o.y - h * foot, w, h); }
    ctx.restore();
    return true;
  }

  /* ── 공장 시트(W-0370, K-0158 규격 — K-0159 사람·K-0160 짐승) ──
     `<풀>/<동작>.webp` 한 장 = 가로 프레임 × 세로 방향 5(0 정면·1 앞대각·2 옆·3 뒤대각·4 뒤, 왼쪽은 뒤집기 — dirOf8 과 같은 줄),
     동작 idle/walk/run/attack/attack2/cast/hit/death/sit/talk(없는 것은 manifest missing), 프레임 수·fps 는 manifest 가 준다(hit·death 6), 발 = 위에서 manifest.foot.
     어느 풀이 공장 것인가는 판 index.json 의 `factory` — 목록에 있는 풀만 manifest 를 받는다(404 없음). 몸 높이는 idle 옆 칸의 알파 상자로 재서
     옛 길과 같게 몸 키 = targetH × scale. 받기 전엔 still 풀이면 한 장 그림, 아니면 false(옛 128·3행 길로 공장 그림을 잘못 자르지 않게). 손잡이 mode2d.factory 0 = 옛 */
  var facts = {}, idxDone = false, idxAt = 0, idxN = 0, FALIAS = { heavy: 'attack2', knockdown: 'death', jump: 'run', fall: 'run', sprint: 'run', gather: 'attack' };
  function factOf(pool) {
    var id = bare(pool), f;
    if (typeof id !== 'string' || isVroid(id) || isCrea(id) || !global.fetch || !tuneOf('mode2d.factory', 1)) { return null; }
    if (!idxDone) { if (indexTried && !index && Date.now() - idxAt > 2500) { if (idxN >= 3) { idxDone = true; return null; } indexTried = false; } loadIndex(); return 'wait'; }   // 부팅 때 부른 요청이 안 끝나는 일이 있다(2나락 실측) — 2.5초마다 다시, 세 번이면 공장 없음
    if (!index || !index.factory) { return null; }
    if (!index._fset) { index._fset = {}; index.factory.forEach(function (k) { index._fset[k] = 1; }); }
    if (!index._fset[id]) { return null; }
    f = facts[id];
    if (!f) {
      f = facts[id] = { m: null, fail: false, bh: 0 };
      global.fetch(base() + id + '/manifest.json').then(function (r) { return r.ok ? r.json() : null; })
        .then(function (m) { if (m && m.clips) { f.m = m; } else { f.fail = true; } })['catch'](function () { f.fail = true; });
    }
    return f.fail ? null : (f.m ? f : 'wait');
  }
  /** 동작 이름 → 그 시트에 있는 동작(순수) — 없으면 가까운 것, 끝내 idle */
  function factRole(m, clip) {
    var cl = (m && m.clips) || {}, a;
    clip = clip || 'idle';
    if (cl[clip]) { return clip; }
    a = FALIAS[clip]; if (a && cl[a]) { return a; }
    if (/^attack/.test(clip) && cl.attack) { return 'attack'; }
    if ((clip === 'run' || a === 'run') && cl.walk) { return 'walk'; }
    return 'idle';
  }
  /** 프레임 번호(순수) — t(0..1 짧은 몸짓) > 걷기·달리기 위상 stride > 시각(ms·fps, 반복 아니면 끝에서 멈춤) */
  function factFrame(c, role, o) {
    var n = (c && c.frames) || 8, fr;
    if (o.t !== undefined && o.t !== null) { return Math.min(n - 1, Math.max(0, Math.floor(o.t * n))); }
    if ((role === 'walk' || role === 'run') && o.stride !== undefined && o.stride !== null) { return Math.floor((((+o.stride % 1) + 1) % 1) * n) % n; }
    fr = Math.floor(Math.max(0, +o.ms || 0) / 1000 * ((c && c.fps) || 8));
    return c && c.loop === false ? Math.min(n - 1, fr) : fr % n;
  }
  /** idle 옆 칸(2행 첫 프레임) 알파 상자 높이(px) — 한 번 재 둔다. 못 재면 칸의 0.75 */
  function factBody(f, img, P) {
    if (f.bh) { return f.bh; }
    var bh = 0, cv, g, d, y, x, top = -1, bot = -1;
    try {
      cv = global.document.createElement('canvas'); cv.width = P; cv.height = P; g = cv.getContext('2d');
      g.drawImage(img, 0, 2 * P, P, P, 0, 0, P, P); d = g.getImageData(0, 0, P, P).data;
      for (y = 0; y < P; y++) { for (x = 0; x < P; x++) { if (d[(y * P + x) * 4 + 3] > 40) { if (top < 0) { top = y; } bot = y; break; } } }
      bh = top >= 0 ? bot - top + 1 : 0;
    } catch (err) { bh = 0; }
    f.bh = bh > 8 ? bh : P * 0.75;
    return f.bh;
  }
  function drawFact(ctx, o, f) {
    var m = f.m, role = factRole(m, o.clip), e = getImg(o.pool, role), ei = role === 'idle' ? e : getImg(o.pool, 'idle');
    if (!ei.ok) { return false; }
    if (!e.ok) { e = ei; role = 'idle'; }
    var c = m.clips[role] || m.clips.idle, n = (c && c.frames) || 8, P = (e.img.naturalWidth || 0) / n || m.px || 192;
    var ni = (m.clips.idle && m.clips.idle.frames) || 8, bh = factBody(f, ei.img, (ei.img.naturalWidth || 0) / ni || m.px || 192);
    var fr = factFrame(c, role, o), d = dirOf8(o.dirX, o.dirY, o.facing), row = Math.min(d.row, ((m.dirs && m.dirs.length) || 5) - 1);
    var cf = C(), body = (cf.targetH || 62) * (o.scale || 1), sc = body / bh, w = P * sc, h = P * sc, foot = m.foot || 0.88;
    stepDust(ctx, o, body); ctx.save();
    if (o.alpha !== undefined) { ctx.globalAlpha = o.alpha; }
    ctx.imageSmoothingEnabled = true; hq(ctx); applyTone(ctx);
    if (d.flip && m.mirror !== false) { ctx.translate(o.x, 0); ctx.scale(-1, 1); ctx.translate(-o.x, 0); }
    ctx.drawImage(e.img, fr * P, row * P, P, P, o.x - w / 2, o.y - h * foot, w, h);
    ctx.restore();
    return true;
  }

  function draw(ctx, o) {
    if (!ctx || !o || !o.pool || !isOn()) { return false; }
    if (global.DG.cutout2d && global.DG.cutout2d.drawFor(ctx, o, (C().targetH || 62) * (o.scale || 1))) { return true; }   // W-0336 컷아웃 뼈대(손잡이 cutout2d.on, 기본 0 — 그대로)
    var fa = factOf(o.pool); if (fa) { if (fa !== 'wait' && drawFact(ctx, o, fa)) { return true; } return isStill(o.pool) ? drawStill(ctx, o) : false; }   // W-0370 공장 시트 먼저
    if (isStill(o.pool)) { return drawStill(ctx, o); }      // 한 장 모드 풀(W-0032)
    var s16 = spec16(o.pool); if (s16 && draw16(ctx, o, s16)) { return true; }   // W-0311 16방향 시트가 온 인물부터
    var cr = null;
    if (isCrea(o.pool)) { var ci = creaInfo(o.pool.slice(CPRE.length)); if (!ci || !ci.fit) { return false; } cr = ci.fit; }   // W-0129 — manifest 받기 전엔 옛 그림
    var s8 = sheet8(o.pool), eight = !!s8, role = roleOf(o.clip, eight), e = getImg(o.pool, role, eight);
    var air = !!AIR[o.clip], airRow = false, at = o.t;
    if (air) {   // W-0296 — 시트가 있으면 한 줄 띠(옆), 없으면 걷기의 다리 벌린 칸에 멈춤
      var ea = eight ? getImg(o.pool, o.clip, true) : null;
      if (ea && ea.ok) { e = ea; role = o.clip; airRow = true; } else { role = 'walk'; e = getImg(o.pool, 'walk', eight); at = AIR_T; }
    }
    var tr = townRole(role, eight, o.town), et = tr !== role ? getImg(o.pool, tr, true) : null;   // W-0138 마을 맨손 — 받는 중·없으면 전투 시트 그대로
    if (et && et.ok) { e = et; role = tr; }
    if (eight && !e.ok) {
      /* 8방향이 아직 안 왔으면(받는 중·실패) 같은 사람의 3행 시트로 — 몸이 깜박이지 않게 */
      eight = false; s8 = null; role = roleOf(o.clip, false); e = getImg(o.pool, role, false);
    }
    if (!e.ok) {
      /* 받는 동안 몸이 깜박이지 않게 같은 풀의 idle 이 이미 있으면 그걸로 */
      var base = role !== 'idle' ? imgs[bare(o.pool) + '/idle' + (eight ? '#8' : '')] : null;
      if (!(base && base.ok)) { return false; }
      e = base; role = 'idle';
    }
    var c8 = eight ? cell8(s8, e.img && e.img.naturalWidth) : null, P = eight ? c8[0] : PX, d = airRow ? { row: 0, flip: dirOf(o.facing).flip } : eight ? dirOf8(o.dirX, o.dirY, o.facing) : dirOf(o.facing), f = (at !== undefined && at !== null) ? Math.min(FRAMES - 1, Math.max(0, Math.floor(at * FRAMES))) : (o.stride !== undefined && o.stride !== null && /walk|run/.test(role)) ? Math.floor(o.stride * FRAMES) % FRAMES : frameAt(role, o.ms || 0);   // W-0203 걷기는 보폭 위상
    var cf = C(), vr = (isVroid(o.pool) || cr) && cf.vroid2d, ph = vr ? (vr.h || 85) : (cf.poolH || {})[o.pool], sc = (ph ? (cf.targetH || 62) / ph : (cf.scale || 1)) * (o.scale || 1) * (cr ? cr.k : 1), w = P * sc, h = P * sc;   // 몬스터는 사람 시트 배율 × 찍은 폭 비(W-0129)
    var foot = cr ? cr.foot : eight ? (P / 2 + c8[1] * PPM + 1.5) / P : ((vr && vr.foot) || cf.foot || 0.87);   // 8방향 칸: 가운데 + 카메라 높이(실측 114/128·156/192 와 ±1px)
    stepDust(ctx, o, (cf.targetH || 62) * (o.scale || 1) * (cr ? cr.k : 1)); ctx.save();
    if (o.alpha !== undefined) { ctx.globalAlpha = o.alpha; }
    ctx.imageSmoothingEnabled = true; hq(ctx); applyTone(ctx);
    if (d.flip) { ctx.translate(o.x, 0); ctx.scale(-1, 1); ctx.translate(-o.x, 0); }
    var P2 = o.pose && global.DG.pose3d && global.DG.pose3d.frame2d ? global.DG.pose3d.frame2d(o.pose) : null;   // W-0303 2D 대역 — 동작 프레임(K 시트) 전엔 발 밑 기준으로 기울이고 누른다
    if (P2) { ctx.translate(o.x, o.y); ctx.rotate(P2.rot); ctx.scale(P2.sx, P2.sy); ctx.translate(-o.x, -o.y); }
    var slot = tintOf(o.pool), Co = global.DG && global.DG.core, tk = slot && Co && Co.tuned ? Math.min(1, Math.max(0, +Co.tuned('mode2d.borrowTint', 1))) : 1;
    var tl = slot && Co && Co.tuned ? Math.min(1, Math.max(0, +Co.tuned('mode2d.borrowTintLow', 0.25))) : 1;   // W-0195 허리 아래 세기(1 = 옛 온몸)
    var cell = slot && tk > 0 ? tintCell(e, bare(o.pool) + '/' + role + (eight ? '#8' : ''), f * P, d.row * P, P, slot, tk, tl) : null;
    if (cell) { ctx.drawImage(cell, 0, 0, P, P, o.x - w / 2, o.y - h * foot, w, h); }
    else { ctx.drawImage(e.img, f * P, d.row * P, P, P, o.x - w / 2, o.y - h * foot, w, h); }
    ctx.restore();
    return true;
  }

  /* ── 한 장 모드(W-0032) — K-0056 정면·옆·뒤 정지 그림 3장(256px 알파, 발 밑 y≈251, 몸 높이 ≈240)에 걸음·숨쉬기를 코드로 얹는다.
     `cfg.still = { <풀id>: true }` 인 풀만 이 길로 온다. 그림 `<stillBase>/<풀>/<front|side|back>.webp`(기본 assets/web2d/moving/) — 면이 없으면 side 로 대신 */
  var SPX = 256, SBODY = 240, SFOOT = 252 / 256, SVIEW = ['front', 'side', 'back'];
  var stills = {};        // '풀/면' → { img, ok, fail }
  function w2sh(sub) { var A = global.DG && global.DG.assets3d, u = A && A.sharedUrl ? A.sharedUrl('web2d/' + sub + '/') : null; return u || 'assets/web2d/' + sub + '/'; }   // W-0359 다섯 판 한 벌(shared) — 못 찾으면 판 경로
  function stillBase() { return C().stillBase || w2sh('moving'); }
  function isStill(pool) { var s = C().still; return !!(s && s[pool]); }
  function getStill(pool, view) {
    var key = pool + '/' + view, e = stills[key];
    if (e) { return e; }
    e = stills[key] = { img: null, ok: false, fail: false };
    if (!global.Image) { e.fail = true; return e; }
    var im = new global.Image();
    im.onload = function () { e.ok = true; };
    im.onerror = function () { e.fail = true; };
    im.src = stillBase() + pool + '/' + view + '.webp';
    e.img = im;
    return e;
  }
  /** 동작·시각 → 몸짓 { dx(몸 높이 비율·앞으로), dy(위로 −), rot(라디안), sx, sy, alpha } — 순수 함수.
   *  amp = 걷기·숨쉬기 세기(W-0368 기본 손잡이 mode2d.stillAmp 0.5 — 한 장 그림을 기울이고 눌렀다 펴는 대역이 종이 인형처럼 보였다, 1 = 옛) */
  function stillPose(clip, ms, stride, amp) {
    var p = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, alpha: 1 }, t = Math.max(0, ms || 0), a, k, m = amp === undefined ? 1 : Math.max(0, +amp);
    if (clip === 'walk') {
      a = (stride !== undefined && stride !== null) ? stride * Math.PI * 2 : t / 1000 * Math.PI * 2 * 2.2; k = Math.abs(Math.sin(a));   // W-0203 한 바퀴(두 발) = 출렁 두 번
      p.dy = -0.035 * k * m; p.rot = Math.sin(a) * 0.05 * m; p.sy = 1 + 0.02 * k * m; p.sx = 1 - 0.015 * k * m;
    } else if (clip === 'attack') {
      k = Math.sin(Math.min(1, t / 450) * Math.PI);
      p.dx = 0.14 * k; p.rot = 0.12 * k; p.sx = 1 + 0.06 * k; p.sy = 1 - 0.05 * k;
    } else if (clip === 'hit') {
      k = Math.min(1, t / 400);
      p.dx = Math.sin(k * 30) * 0.03 * (1 - k); p.alpha = 0.6 + 0.4 * Math.abs(Math.cos(k * 18));
    } else if (clip === 'death') {
      k = Math.min(1, t / 800);
      p.rot = 1.45 * k; p.dy = 0.02 * k; p.alpha = 1 - 0.6 * k;
    } else {
      a = Math.sin(t / 1000 * Math.PI * 2 * 0.8);
      p.sy = 1 + 0.015 * a * m; p.sx = 1 - 0.008 * a * m;
    }
    return p;
  }
  /** o = draw 와 같다({ pool, clip, facing, ms, x, y(발 밑 가운데), scale, alpha }). 몸 높이 = targetH × scale. 그림이 없으면 false */
  function drawStill(ctx, o) {
    var d = dirOf(o.facing), e = getStill(o.pool, SVIEW[d.row]);
    if (e.fail && d.row !== 1) { e = getStill(o.pool, 'side'); }
    if (!e.ok) { return false; }
    var cf = C(), bodyH = (cf.targetH || 62) * (o.scale || 1), sc = bodyH / SBODY, w = SPX * sc, h = SPX * sc;
    var ps = stillPose(o.clip || 'idle', o.ms || 0, o.stride, tuneOf('mode2d.stillAmp', 0.5));
    stepDust(ctx, o, bodyH); ctx.save();
    ctx.globalAlpha = (o.alpha !== undefined ? o.alpha : 1) * ps.alpha;
    ctx.imageSmoothingEnabled = true; hq(ctx); applyTone(ctx);
    ctx.translate(o.x, o.y);                         // 발 밑 가운데가 원점
    if (d.flip) { ctx.scale(-1, 1); }
    ctx.translate(ps.dx * bodyH, ps.dy * bodyH);
    ctx.rotate(ps.rot);
    ctx.scale(ps.sx, ps.sy);
    ctx.drawImage(e.img, -w / 2, -h * SFOOT, w, h);
    ctx.restore();
    return true;
  }

  /** 풀 목록(index.json)을 한 번 읽어 둔다 — 진단·미리 받기용. 없어도 오류 없음 */
  function loadIndex(cb) {
    if (index || indexTried || !global.fetch) { if (cb) { cb(index); } return; }
    indexTried = true; idxAt = Date.now(); idxN++;
    global.fetch(base() + 'index.json').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { index = j; idxDone = true; if (cb) { cb(j); } })['catch'](function () { idxDone = true; if (cb) { cb(null); } });
  }

  /* ───── 배경 층·바닥 타일 (K-0020 산출, 판별 `assets/web2d/{bg,tile}/`) ─────
     cfg: { bgBase: 'assets/web2d/bg/', tileBase: 'assets/web2d/tile/' }. 층 규격은 `<지역>.layers.json`
     = { far|mid|near: { y, h, speed, w } } (기준 높이 540 — 그릴 때 화면 높이에 맞춰 비율 환산). 이미지는 `<지역>_<층>.webp`, 좌우 왕복 이음. */
  var LAYERS = ['far', 'mid', 'near'];
  var bgs = {}, tiles = {};          // 지역 → { meta, imgs:{층:{img,ok,fail}}, fail }  /  타일id → { img, ok, fail, pat }
  function bgBase() { return C().bgBase || (C().bgShared ? w2sh('bg') : 'assets/web2d/bg/'); }   // bgShared — 판 배경이 전부 shared 에 있는 판(2나락). 4종횡은 판에만 있는 층이 있어 판 경로
  function tileBase() { return C().tileBase || 'assets/web2d/tile/'; }
  function loadImg(url) {
    var e = { img: null, ok: false, fail: false };
    if (!global.Image) { e.fail = true; return e; }
    var im = new global.Image();
    im.onload = function () { e.ok = true; };
    im.onerror = function () { e.fail = true; };
    im.src = url; e.img = im;
    return e;
  }
  function getBg(region) {
    var b = bgs[region];
    if (b) { return b; }
    b = bgs[region] = { meta: null, imgs: {}, fail: false };
    if (!global.fetch) { b.fail = true; return b; }
    LAYERS.forEach(function (l) { b.imgs[l] = loadImg(bgBase() + region + '_' + l + '.webp'); });
    global.fetch(bgBase() + region + '.layers.json').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) { b.meta = j; } else { b.fail = true; } })['catch'](function () { b.fail = true; });
    return b;
  }
  /** 층 이미지 하나를 가로로 이어 그린다(홀수 칸은 좌우 뒤집어 왕복 — 이음매가 안 보인다). dx = 가로 이동(px) */
  function strip(ctx, img, y, dw, dh, W, dx) {
    var n = Math.floor(dx / dw), off = dx - n * dw, i, x;
    for (i = 0; i * dw - off < W; i++) {
      x = i * dw - off;
      if ((n + i) % 2 !== 0) { ctx.save(); ctx.translate(x + dw, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, y, dw, dh); ctx.restore(); }
      else { ctx.drawImage(img, x, y, dw, dh); }
    }
  }
  /**
   * 층 배경을 그린다 — o = { region, camX, W, H, base(땅 선 y, 기본 H), only: 'near'(그 층만, 없으면 셋 다) }.
   * far 는 하늘(0~base), mid·near 는 땅 선 위로 쌓이는 띠(아래 가장자리가 base). 받는 중이거나 없으면 false(→ 부른 쪽이 기존 하늘·뒷배경을 그린다).
   */
  function drawBg(ctx, o) {
    if (!ctx || !o || !o.region || !isOn()) { return false; }
    if (!o.only && global.DG.parallax2d && global.DG.parallax2d.drawFor(ctx, o)) { return true; }   // W-0336 겹 배경 5~7층(손잡이 parallax2d.on, 기본 0 — 그대로)
    var b = getBg(o.region), m = b.meta;
    if (b.fail || !m) { return false; }
    var names = o.only ? [o.only] : LAYERS, base = o.base || o.H || 540, k = base / 540, any = false, i, L, e, dh, dw, y;
    for (i = 0; i < names.length; i++) {
      L = m[names[i]]; e = b.imgs[names[i]];
      if (!L || !e || !e.ok) { continue; }
      dh = L.h * k; y = base - (540 - L.y) * k; dw = L.w * k;
      if (names[i] === 'far') { dh = base; y = 0; }
      strip(ctx, e.img, y, dw, dh, o.W, (o.camX || 0) * (L.speed || 0));
      any = true;
    }
    return any;
  }

  /** 건물 실내 그림(K-0025, W-0045) — 방 그림과 앞가림 층(투명) 주소. 2D 모드가 아니면 null(3D 는 그림 없이 글만). cfg.interiorBase 로 폴더를 바꾼다 */
  function interiorUrls(id) {
    if (!id || !isOn()) { return null; }
    var b = C().interiorBase || w2sh('interior');
    return { back: b + id + '.webp', front: b + id + '_front.webp' };
  }

  /** 땅 종류 → 타일 주소(cfg.tile 표). 2D 모드가 아니거나 표에 없으면 null — 자기 텍스처 로더가 있는 판(사가만리)이 주소만 빌린다 */
  function tileUrl(kind) { var c = C(); return c.tile && c.tile[kind] && isOn() ? tileBase() + c.tile[kind] + '.webp' : null; }

  /** 바닥 타일 한 장(256px) — 아직 못 받았으면 null */
  function tile(id) {
    var t = tiles[id];
    if (!t) { t = tiles[id] = loadImg(tileBase() + id + '.webp'); t.pat = null; }
    return t.ok ? t.img : null;
  }
  function tilePattern(ctx, id) {
    var im = tile(id), t = tiles[id];
    if (!im) { return null; }
    if (!t.pat && ctx && ctx.createPattern) { t.pat = ctx.createPattern(im, 'repeat'); }
    return t.pat;
  }
  /** 사각형을 타일로 채운다 — o = { id, x, y, w, h, dx, dy(스크롤), scale(기본 0.25 = 64px) }. 받는 중·없음 → false */
  function fillTile(ctx, o) {
    if (!ctx || !o || !isOn()) { return false; }
    var pat = tilePattern(ctx, o.id);
    if (!pat) { return false; }
    var s = o.scale || 0.25, dx = o.dx || 0, dy = o.dy || 0;
    ctx.save();
    ctx.beginPath(); ctx.rect(o.x, o.y, o.w, o.h); ctx.clip();
    ctx.translate(o.x - dx, o.y - dy);
    ctx.scale(s, s);
    ctx.fillStyle = pat;
    ctx.fillRect(dx / s, dy / s, o.w / s, o.h / s);
    ctx.restore();
    return true;
  }

  /**
   * 아이소 바닥(마름모)을 타일로 채운다 — 사가나락. o = { id, a,b,c,d,e,f(방 좌표 → 화면 변환 행렬), W, H(방 크기), unit(타일 한 장이 덮는 방 좌표 폭, 기본 160), tint, tintAlpha }.
   * 타일 위에 tint(테마 바닥색)를 얹어 층 분위기를 남긴다. 그렸으면 true — 부른 쪽은 칸 색칠을 건너뛴다. 못 받았으면 false.
   */
  function fillIso(ctx, o) {
    if (!ctx || !o || !o.id || !isOn()) { return false; }
    var mode = tuneOf('mode2d.isoMode', 1);
    if (mode) { return fillIsoBaked(ctx, o, mode); }
    var pat = tilePattern(ctx, o.id);
    if (!pat) { return false; }
    var s = (o.unit || 160) / 256;
    ctx.save();
    ctx.transform(o.a, o.b, o.c, o.d, o.e, o.f);
    ctx.fillStyle = pat; ctx.save(); ctx.scale(s, s); ctx.fillRect(0, 0, o.W / s, o.H / s); ctx.restore();
    if (o.tint) { ctx.globalAlpha = o.tintAlpha === undefined ? 0.6 : o.tintAlpha; ctx.fillStyle = o.tint; ctx.fillRect(0, 0, o.W, o.H); }
    ctx.restore();
    return true;
  }
  /* W-0376 — 폰에서 이미지 패턴 + 덧칠 전면 채우기가 2나락 마을을 3fps 로 묶었다. 타일을 물들인 채 한 번 굽고(id·색·짙기마다 캔버스 하나)
     mode 1(기본) = 그 캔버스로 패턴(폰 마을 3→45fps) · mode 2 = 낱장 drawImage(가장자리는 원본 일부만 — 옛 그림과 같은 칸). 덧칠 fillRect 는 없어진다 */
  var isoBake = {};
  function bakedTile(id, tint, ta) {
    var key = id + '|' + (tint || '') + '|' + ta, b = isoBake[key], im = tile(id);
    if (b) { return b; }
    if (!im || !global.document) { return null; }
    var c = global.document.createElement('canvas'), g; c.width = im.naturalWidth || 256; c.height = im.naturalHeight || 256; g = c.getContext('2d');
    g.drawImage(im, 0, 0, c.width, c.height);
    if (tint) { g.globalAlpha = ta; g.fillStyle = tint; g.fillRect(0, 0, c.width, c.height); }
    return (isoBake[key] = c);
  }
  function fillIsoBaked(ctx, o, mode) {
    var c = bakedTile(o.id, o.tint, o.tintAlpha === undefined ? 0.6 : o.tintAlpha);
    if (!c) { return false; }
    var u = o.unit || 160, s = u / 256, x, y, w, h;
    ctx.save();
    ctx.transform(o.a, o.b, o.c, o.d, o.e, o.f);
    if (mode === 1) {
      if (!c.pat) { c.pat = ctx.createPattern(c, 'repeat'); }
      ctx.fillStyle = c.pat; ctx.scale(s, s); ctx.fillRect(0, 0, o.W / s, o.H / s);
    } else {
      for (y = 0; y < o.H; y += u) {
        for (x = 0; x < o.W; x += u) {
          w = Math.min(u, o.W - x); h = Math.min(u, o.H - y);
          ctx.drawImage(c, 0, 0, c.width * w / u, c.height * h / u, x, y, w + (w === u ? 0.6 : 0), h + (h === u ? 0.6 : 0));   // 0.6 겹쳐 이음매 실금을 막는다
        }
      }
    }
    ctx.restore();
    return true;
  }

  /* ───── 건물·지물 스프라이트(K-0017 산출, `shared/assets/world2d/<id>.webp`) — 판 설정 `prop2d: { 종류: { id, h } }` ─────
     h = 그 종류가 화면에서 보일 키(px, 확대 k=1 기준). 못 받았거나 표에 없으면 false → 부른 쪽이 옛 그림(코드 도형)을 그린다. */
  var sprites = {};   // id → { img, ok, fail, box:{sx,sy,sw,sh} }
  function spriteOf(id) {
    var A = global.DG && global.DG.assets3d, u = A && A.spriteUrl && A.spriteUrl(id), e = sprites[id];
    if (!u) { return null; }
    if (!e) {
      e = sprites[id] = loadImg(u);
      var im = e.img;
      im.onload = function () {
        try {   // 알파가 있는 범위만 잘라 쓴다(256px 칸에 여백이 있다)
          var c = global.document.createElement('canvas'), x, y, d, w = im.naturalWidth, h = im.naturalHeight, x0 = w, y0 = h, x1 = -1, y1 = -1;
          c.width = w; c.height = h; var g = c.getContext('2d'); g.drawImage(im, 0, 0); d = g.getImageData(0, 0, w, h).data;
          for (y = 0; y < h; y++) { for (x = 0; x < w; x++) { if (d[(y * w + x) * 4 + 3] > 16) { if (x < x0) { x0 = x; } if (x > x1) { x1 = x; } if (y < y0) { y0 = y; } if (y > y1) { y1 = y; } } } }
          e.box = x1 >= 0 ? { sx: x0, sy: y0, sw: x1 - x0 + 1, sh: y1 - y0 + 1 } : { sx: 0, sy: 0, sw: w, sh: h };
        } catch (err) { e.box = { sx: 0, sy: 0, sw: im.naturalWidth, sh: im.naturalHeight }; }
        e.ok = true;
      };
    }
    return e.ok && e.box ? e : null;
  }
  /** 스프라이트 하나를 발 밑 가운데 (x, y) 에 키 h(px) 로 그린다. 그렸으면 그린 키(px, 참), 아니면 false */
  function drawSprite(ctx, o) {
    if (!ctx || !o || !o.id || !isOn()) { return false; }
    var e = spriteOf(o.id);
    if (!e) { return false; }
    var b = e.box, h = o.h, w = h * b.sw / b.sh;
    ctx.save();
    if (scaleOn()) { shadow(ctx, o.x, o.y, w * 0.8, { a: 0.22 }); }   // W-0349 그림자 한 꼴
    else { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(o.x, o.y, w * 0.38, Math.max(2, h * 0.07), 0, 0, Math.PI * 2); ctx.fill(); }   // 옛 발 밑 그림자
    if (o.alpha !== undefined) { ctx.globalAlpha = o.alpha; }
    ctx.imageSmoothingEnabled = true; hq(ctx); applyTone(ctx);
    ctx.drawImage(e.img, b.sx, b.sy, b.sw, b.sh, o.x - w / 2, o.y - h, w, h);
    ctx.restore();
    return h || true;
  }
  /** 판 표(`DG.cfg.mode2d.prop2d`)의 종류 하나를 그린다 — k 는 확대 배율. 표에 없으면 false.
   *  W-0349 — 표 칸에 cls(크기 종류)가 있고 판 설정 unitH(배율 1 의 사람 키 px)가 있으면 키 = unitH × scaleOf(cls, id), 아니면 옛 h */
  function drawKind(ctx, kind, x, y, k, seed) {
    var t = C().prop2d, p = t && t[kind], id = p && (p.ids ? p.ids[hashOf(seed) % p.ids.length] : p.id);   // ids = 여러 모양 중 씨앗 해시로 하나
    var u = C().unitH, h = p && p.cls && u && scaleOn() ? u * scaleOf(p.cls, id) : p && p.h;
    return p ? drawSprite(ctx, { id: id, x: x, y: y, h: h * (k || 1) }) : false;
  }
  /** 표에 이 종류가 있고 2D 모드인가 — 부르는 쪽이 정렬 목록에 넣을지 정할 때 */
  function hasKind(kind) { var t = C().prop2d; return !!(t && t[kind]) && isOn(); }

  /** W-0348 이름표 겹침 풀기 — items [{x, y(글 바닥), w, h, pri, dist, keep}] 을 받아 it.alpha(1 보임·0 숨김)·it.y(옮긴 자리)·it.oy(원래)·it.lead(줄 그을지) 를 채운다.
   *  순서 = keep(퀘스트 대상) > pri 높은 것 > 가까운 것. pri ≥ o.stackPri(2) 이거나 keep 이면 위로 o.stack(3) 칸까지 올려 보고, 나머지는 제자리 하나만 — 겹치면 숨긴다
   *  (옛 1만리 layoutLabels 는 누구나 4칸까지 올려 한 자리에 이름표 탑이 섰다). keep 은 끝까지 안 맞아도 제자리에 보인다 */
  function labels(items, o) {
    o = o || {};
    var stackPri = o.stackPri === undefined ? 2 : o.stackPri, stack = o.stack || 3, gap = o.gap === undefined ? 2 : o.gap, placed = [], i, s, y;
    var order = items.slice().sort(function (a, b) { return ((b.keep ? 1 : 0) - (a.keep ? 1 : 0)) || ((b.pri || 0) - (a.pri || 0)) || ((a.dist || 0) - (b.dist || 0)); });
    for (i = 0; i < order.length; i++) {
      var it = order[i], n = it.keep || (it.pri || 0) >= stackPri ? stack : 1, hit = function (q) { return Math.abs(q.x - it.x) * 2 < q.w + it.w && Math.abs(q.y - y) < (q.h + it.h) / 2; };
      it.oy = it.oy === undefined ? it.y : it.oy; it.alpha = 0; it.lead = false;
      for (s = 0; s < n && !it.alpha; s++) { y = it.oy - s * (it.h + gap); if (!placed.some(hit)) { it.y = y; it.alpha = 1; it.lead = s >= 2; placed.push(it); } }
      if (!it.alpha && it.keep) { it.y = it.oy; it.alpha = 1; placed.push(it); }
    }
    return items;
  }

  global.DG = global.DG || {};
  global.DG.mode2d = {
    labels: labels,
    scaleOf: scaleOf, scaleOn: scaleOn, shadow: shadow, stepDust: stepDust, setTone: setTone, tone: function () { return toneF; }, SCALE: SCALE, BEAST: BEAST,   // W-0368 setTone·tone ·   // W-0349
    mark: mark, markSrc: markSrc, MARK: MARK, markMisses: function () { return Object.assign({}, markMiss); },   // W-0350
    isCrea: isCrea, creaPool: creaPool, creaFit: creaFit, cell8: cell8,   // W-0129 몬스터 2D 시트
    drawSprite: drawSprite, drawKind: drawKind, hasKind: hasKind, spriteReady: function (id) { return !!spriteOf(id); },
    fillIso: fillIso, isoMode: function () { return tuneOf('mode2d.isoMode', 1); }, isoBaked: function () { return Object.keys(isoBake); },   // W-0376
    interiorUrls: interiorUrls,
    drawBg: drawBg, tile: tile, tileUrl: tileUrl, tilePattern: tilePattern, fillTile: fillTile,
    bgReady: function (region) { var b = bgs[region]; return !!(b && b.meta && LAYERS.every(function (l) { return b.imgs[l].ok; })); },
    bgFailed: function (region) { var b = bgs[region]; return b ? b.fail || LAYERS.some(function (l) { return b.imgs[l].fail; }) : null; },
    preloadBg: function (region) { getBg(region); },
    tileOk: function (id) { var t = tiles[id]; return t ? t.ok : null; },
    FRAMES: FRAMES, PX: PX, FPS: FPS, AIR: AIR, AIR_T: AIR_T,
    isOn: isOn, pick: pick, vroidPick: vroidPick, face: face, actT: actT, actInfo: actInfo, dirOf8: dirOf8, roleOf: roleOf, roleKey: roleKey, townRole: townRole, sheet8: sheet8, beastOf: beastOf, frameAt: frameAt, dirOf: dirOf, hashOf: hashOf,
    draw: draw, preload: preload, spec16: spec16, role16: role16, loadIndex: loadIndex, tintSlot: tintSlot, tintPx: tintPx, tintData: tintData, tintRowW: tintRowW, tintOf: tintOf, bare: bare,
    drawStill: drawStill, stillPose: stillPose, factRole: factRole, factFrame: factFrame, factReady: function (pool) { var f = factOf(pool); return f === 'wait' ? null : !!f; }, isStill: isStill, pace: pace,
    stillLoaded: function (pool, view) { var e = stills[pool + '/' + view]; return e ? e.ok : null; },
    /** 진단용 — 그 풀·동작 이미지를 받았나(true/false), 아직 안 불렀으면 null */
    loaded: function (pool, clip) { var e = imgs[bare(pool) + '/' + clip]; return e ? e.ok : null; },
    failed: function (pool, clip) { var e = imgs[bare(pool) + '/' + clip]; return e ? e.fail : null; }
  };
})(typeof window !== 'undefined' ? window : this);
