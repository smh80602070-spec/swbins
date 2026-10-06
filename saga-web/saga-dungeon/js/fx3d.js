/**
 * 3D 전투 연출 — 때린 맛과 스킬의 그림 (3D 전환 3단계)
 * ---------------------------------------------------------------
 * 1·2단계로 방과 들판이 입체로 섰다. 그런데 **3D 를 켜면 타격감이 사라졌다** —
 * 칼궤적·격파 고리·데미지 숫자를 그리는 코드가 `dungeon-view.js` 의 캔버스 2D
 * 안에만 있어서(`drawFxUnder`·`drawFxOver`), 3D 가 그리는 프레임에는 통째로
 * 건너뛰어졌다. 이 파일이 그 자리를 메운다.
 *
 * `PLAN.md` 51·52·53절이 과녁이다:
 *
 *   51절  Hit Flash · Screen Shake · Particles · Trail · Impact · Damage Number
 *   52절  숫자는 **Object Pool** 로 — 아무리 쏟아져도 노드를 새로 만들지 않는다
 *   53절  Attack → Hit → Flash → Particle → Sound → Damage 순의 즉각 피드백
 *
 * ── 판정은 한 줄도 안 건드렸다 ──────────────────────────────
 *
 * 40·41절("정상 작동하는 코드는 수정하지 않는다")을 지킬 수 있었던 것은
 * 이 판이 처음부터 판정과 화면을 갈라 두었기 때문이다. `dungeon.js` 는 이미
 * 연출용 이벤트를 배열 하나에 흘려 준다(`DG.dungeon.fx()`):
 *
 *   hit    피해 숫자   { x, y, v, crit, resist, foe, el, life }
 *   elem   원소 피해   { x, y, v, el, color, dot, life }
 *   get    획득 문구   { x, y, text, color, life }
 *   slash  칼궤적      { x, y, a, crit, life }
 *   pop    격파 고리   { x, y, boss, life }
 *   burst  죽음 파편   { x, y, boss, color, seed, life }
 *   whirl  회전참      { x, y, r, life }
 *   ring   기공 파문   { x, y, life }
 *   trail  돌진 잔상   { x, y, life }
 *
 * 2D 층이 이 아홉을 그리던 그 정보 그대로 입체로 세운다. **새 이벤트를 판정에
 * 넣지 않았다** — 그러면 판정 파일을 고쳐야 하고, 진단 182개가 흔들린다.
 * (그래서 스킬의 원소 색은 `run.shots` 가 이미 들고 있는 `el`·`color` 에서만
 * 읽는다. 회전참·파문에 색을 입히려고 판정에 필드를 더하지는 않았다)
 *
 * ── 값 층과 그림 층을 다시 한 번 가른다 ──────────────────────
 *
 * 자가진단(`DG_NO_DRAW`)은 three 를 켜지 않는다. 그래서 이 파일도 1·2단계와
 * 같은 꼴로 지었다 — **처방을 내는 함수는 three 없이도 돈다**:
 *
 *   plan(f)        fx 한 개 → 무엇을 · 어떤 색으로 · 얼마나 크게 · 얼마나 진하게
 *   textOf(f)      hit·elem·get → 화면에 뜰 글자
 *   glyphs(text)   글자 → 글리프판(아틀라스) 칸 번호
 *   shakeOf(f)     이 이벤트가 화면을 얼마나 흔드나 (51절 "과하지 않게")
 *   pool(make,cap) Object Pool 그 자체 (52절)
 *   flashOf·shotHex·hurtTint
 *
 * 진단은 이것만 따로 굴려 본다. `init`·`step` 은 three 가 있을 때만 산다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /* ══ 값 층 — three 없이 돈다 ═══════════════════════════════ */

  /** 글리프판에 굽는 글자 열여섯 (4×4). 숫자와 몇 개의 기호뿐이다 —
   *  한글은 여기 없다. `get` 문구는 따로 그려 붙인다(아래 `textTex`) */
  var GLYPHS = '0123456789★+-()';

  /** fx 가 태어날 때의 수명. 2D 층이 쓰던 그 값이다(같은 속도로 사그라져야 한다) */
  var FULL = {
    hit: 0.6, elem: 0.6, get: 1.1, slash: 0.16,
    pop: 0.45, burst: 0.5, whirl: 0.3, ring: 0.55, trail: 0.22, fan: 0.26, pull: 0.35
  };

  /** 흔들림 상한. 51절이 "Screen Shake 는 과하지 않게" 라고 못박았다 */
  var SHAKE_MAX = 14;

  function full(f) {
    if (f.t === 'zone') { return f.max || 1; }   // 예고 원(§5.18)은 길이가 제각각 — 태어날 때 life 를 max 로 싣는다
    /* 플레이어가 맞은 숫자는 0.7 로 태어난다(적을 때린 것은 0.6) */
    if (f.t === 'hit' && f.foe) { return 0.7; }
    return FULL[f.t] || 0.5;
  }

  function hexOf(css, def) {
    if (!css) { return def; }
    var s = String(css).replace('#', '');
    var n = parseInt(s, 16);
    return isNaN(n) ? def : n;
  }

  /** 글자 → 글리프판 칸 번호. 판에 없는 글자는 -1 (그 자리는 비운다) */
  function glyphs(text) {
    var out = [], i;
    var s = String(text === undefined || text === null ? '' : text);
    for (i = 0; i < s.length; i++) { out.push(GLYPHS.indexOf(s.charAt(i))); }
    return out;
  }

  /** 화면에 뜰 글자. 2D 층과 한 글자도 다르지 않아야 한다 —
   *  같은 판을 2D 로 보다가 3D 로 켰을 때 숫자가 달라 보이면 안 된다 */
  function textOf(f) {
    if (f.t === 'hit') { return (f.crit ? '★' : '') + f.v; }
    if (f.t === 'elem') { return f.dot ? '(' + f.v + ')' : '' + f.v; }
    if (f.t === 'get') { return String(f.text === undefined ? '' : f.text); }
    return '';
  }

  /** 숫자·문구의 색. 저항에 깎인 타격은 **잿빛**이다 — 숫자만 보고 "안 통한다" 를 안다 */
  function numHex(f) {
    if (f.t === 'elem') { return hexOf(f.color, 0xffffff); }
    if (f.t === 'get') { return hexOf(f.color, 0xf0c45a); }
    if (f.foe) { return 0xff7878; }
    if (f.crit) { return 0xff8c3c; }   /* §5.8① 크리 숫자는 뚜렷한 주황(2026-09-18, 옛 0xffdc78 은 노랑에 가까웠다) */
    if (f.resist) { return 0x9696a0; }
    return 0xffffff;
  }

  /**
   * fx 한 개 → 처방.
   *
   *   kind   'num' | 'text' | 'slash' | 'ring' | 'burst' | 'trail'
   *   hex    색 · alpha 진하기 · k 진행도(0 갓 태어남 → 1 사라짐)
   *   r      반지름(ring) · rise 뜨는 높이(num·text) · size 글자 크기
   *
   * 모르는 종류에는 null 을 준다 — 판정이 새 이벤트를 흘려도 조용히 넘긴다.
   */
  /* 숫자 칸(W-0077) — 0.35초 안에 같은 몸(±24)에서 뜬 피해 숫자는 0~3 칸으로 나눠 좌우 번갈아·한 단씩 위로 비킨다.
     갓 태어난 fx 에 한 번만 `nslot` 을 적는다(shake3d 와 같은 방식). 3D step·2D 층이 같은 값을 쓴다 */
  var SLOT_R = 24, SLOT_AGE = 0.35, SLOT_N = 4;
  function isNumFx(f) { return !!f && (f.t === 'hit' || f.t === 'elem'); }
  function slotOf(fxs, i) {
    var f = fxs && fxs[i], n = 0, j, g;
    if (!isNumFx(f)) { return 0; }
    if (f.nslot !== undefined) { return f.nslot; }
    for (j = 0; j < i; j++) {
      g = fxs[j];
      if (isNumFx(g) && g.nslot !== undefined && Math.abs(g.x - f.x) < SLOT_R && Math.abs(g.y - f.y) < SLOT_R && full(g) - g.life < SLOT_AGE) { n++; }
    }
    return (f.nslot = n % SLOT_N);
  }
  /** 칸 → 옆 비킴(글자 크기 size 단위 1.6배 — 세 자리 숫자 폭 1.5배보다 넓게: 1 칸 오른쪽·2 칸 왼쪽·3 칸 오른쪽 두 배) · 위 비킴(한 칸 = size×0.9) */
  function slotDx(ns, size) { ns = ns || 0; return ns ? (ns % 2 ? 1 : -1) * Math.ceil(ns / 2) * size * 1.6 : 0; }
  function slotUp(ns, size) { return (ns || 0) * size * 0.9; }

  function plan(f) {
    if (!f || !f.t) { return null; }
    var fu = full(f);
    var a = core.clamp(f.life / fu, 0, 1);
    var k = core.clamp(1 - f.life / fu, 0, 1);

    if (f.t === 'hit' || f.t === 'elem') {
      /* 2D 는 픽셀로 26·22 만큼 띄웠다. 3D 는 월드 단위라 그대로 쓰면 된다 —
         방 하나가 대략 900×600 이고 사람 키가 40 이니 눈에 잘 든다 */
      return {
        kind: 'num', hex: numHex(f), alpha: a, k: k,
        text: textOf(f),
        size: f.crit ? 28 : (f.t === 'elem' ? 17 : 20),   /* §5.8① 크리 1.4배(20×1.4=28, 2026-09-18) */
        rise: 34 + (fu - f.life) * (f.t === 'elem' ? 40 : 46) + slotUp(f.nslot, f.crit ? 28 : (f.t === 'elem' ? 17 : 20)),
        dx: slotDx(f.nslot, f.crit ? 28 : (f.t === 'elem' ? 17 : 20)),   /* W-0077 숫자 칸 — 글자 크기 단위로 좌우·위로 비킨다 */
        glow: !!f.crit
      };
    }
    if (f.t === 'get') {
      return {
        kind: 'text', hex: numHex(f), alpha: core.clamp(f.life, 0, 1), k: k,
        text: textOf(f), size: 17, rise: 30 + (fu - f.life) * 22, glow: false
      };
    }
    if (f.t === 'slash') {
      /* 투영이 눕어 있어 각을 죽여야 했던 2D 와 달리 3D 는 **진짜 각도**를 쓴다.
         **결이 있는 무예**(el)는 그 원소 색으로 벤다 — 강타(暴)와 같은 흰 궤적으로
         뭉뚱그리면 화·빙·뇌를 눈으로 못 가른다. 강타(crit)는 그래도 금빛이 우선이다. */
      return {
        kind: 'slash', hex: f.crit ? 0xffdc78 : hexOf(f.color, 0xf0f5ff),
        alpha: a * (f.crit ? 1 : 0.85), k: k,
        r: (f.crit ? 46 : 36) * (0.7 + k * 0.6), ang: f.a || 0, glow: true
      };
    }
    if (f.t === 'pop') {
      return {
        kind: 'ring', hex: 0xffdc96, alpha: a, k: k,
        r: (FULL.pop - f.life) * (f.boss ? 141 : 70),
        thick: f.boss ? 0.10 : 0.14, lift: 2, glow: true
      };
    }
    if (f.t === 'whirl') {
      /* 회전참(swing) — 결이 있으면(el) 그 색, 없으면(맨 무기) 예전 하늘빛 */
      return {
        kind: 'ring', hex: hexOf(f.color, 0x96dcff), alpha: a * 0.8, k: k,
        r: (f.r || 60) * (1.15 - a * 0.4),
        thick: 0.09, lift: 6, glow: true, spin: true
      };
    }
    if (f.t === 'fan') {
      /* §5.19 2차 원뿔 무예 — 부채꼴을 긋는 큰 획. slash 판을 크게 돌려 쓴다(새 지오메트리 없음) */
      return {
        kind: 'slash', hex: hexOf(f.color, 0xc8ecff), alpha: a * 0.9, k: k,
        r: (f.r || 50) * (0.75 + k * 0.45), ang: f.a || 0, glow: true
      };
    }
    if (f.t === 'pull') {
      /* §5.19 2차 끌어당기기 — ring 과 반대로 **바깥에서 발밑으로 오그라든다** */
      return {
        kind: 'ring', hex: hexOf(f.color, 0xb48cff), alpha: 0.35 + 0.65 * a, k: k,
        r: Math.max(8, (f.r || 150) * (1 - k)), thick: 0.08, lift: 5, glow: true
      };
    }
    if (f.t === 'zone') {
      /* 예고 원(§5.18 명소 주인 고유 수) — 퍼지지 않고 제 크기에 서서, 터질 때가 다가올수록 진해진다.
         불바닥(pool)은 고르게 깔려 있다가 마지막 1초에 옅어진다 */
      return {
        kind: 'ring', hex: hexOf(f.color, 0xff6a3a), k: k,
        alpha: f.pool ? core.clamp(f.life, 0, 1) * 0.6 : 0.35 + 0.65 * k,
        r: f.r || 40, thick: f.pool ? 0.2 : 0.08, lift: 3, glow: true
      };
    }
    if (f.t === 'ring') {
      /* 파문(nova·buff·curse 공용) — nova 만 결 색을 싣는다(sk.el),
         버프·저주는 색이 안 실려 오므로 예전 금빛 그대로다 */
      return {
        kind: 'ring', hex: hexOf(f.color, 0xf0b45a), alpha: a, k: k,
        r: (FULL.ring - f.life) * 170,
        thick: 0.07, lift: 4, glow: true, wall: true
      };
    }
    if (f.t === 'burst') {
      return {
        kind: 'burst', hex: hexOf(f.color, 0xc9a83a), alpha: a, k: k,
        n: f.boss ? 10 : 6, seed: f.seed || 0,
        spread: f.boss ? 46 : 26, grain: f.boss ? 7 : 5, glow: false
      };
    }
    if (f.t === 'trail') {
      return {
        kind: 'trail', hex: hexOf(f.color, 0x96dcff), alpha: a * 0.44, k: k,
        r: 14 * a, glow: false
      };
    }
    return null;
  }

  /** §5.8① 화면 흔들림 배율(0~2, 기본 1) — PLAN "UI·조작" 손잡이. 0 이면
   *  이 함수가 부르는 모든 흔들림이 0으로 죽는다(끈 것처럼 보인다). */
  function shakeMul() {
    var s = core.save && core.save.settings;
    var v = s && typeof s.shake === 'number' ? s.shake : 1;
    return Math.max(0, Math.min(2, v));
  }

  /**
   * 이 이벤트가 화면을 얼마나 흔드나. 2D 층이 쓰던 그 수치다 —
   * 격파 4(보스 12) · 내가 맞으면 6. 스킬 파문은 살짝만 얹는다.
   * §5.8①(2026-09-18) — 내가 때릴 때(평타 1.5·크리 4)도 흔들리게 채웠다.
   */
  function shakeOf(f) {
    if (!f) { return 0; }
    var m = shakeMul();
    if (f.t === 'pop') { return (f.boss ? 12 : 4) * m; }
    if (f.t === 'hit' && f.foe) { return 6 * m; }
    /* 2026-09-10 — "전투가 심심하다"(사용자) 대응. 여태 이쪽(적을 때린 쪽)엔
       흔들림이 전혀 없었다 — 맞았을 때만(위 foe) 흔들렸다. §5.8①로 평타도
       살짝 흔들리게(1.5px 급) 됐다 — 크리는 그보다 뚜렷하게(4px 급). */
    if (f.t === 'hit' && !f.foe) { return (f.crit ? 4 : 1.5) * m; }
    if (f.t === 'ring') { return 3 * m; }
    return 0;
  }

  /** 흔들림은 초당 42 씩 죽는다(2D 의 프레임당 0.7 과 같은 속도) */
  function shakeStep(cur, dt) {
    return Math.max(0, (cur || 0) - 42 * (dt || 0));
  }

  /** 맞은 직후의 번쩍임 0→1. `hurt` 는 적이 0.2 · 사람이 0.28 에서 줄어든다 */
  function flashOf(hurt, span) {
    if (!hurt || hurt <= 0) { return 0; }
    return core.clamp(hurt / (span || 0.2), 0, 1);
  }

  /** 기공파 색 — 판정이 이미 원소 색을 들고 있다(`run.shots[].color`) */
  function shotHex(sh) {
    return hexOf(sh && sh.color, 0x9fe8ff);
  }

  /**
   * 피격·위기의 붉은 기운. 2D 는 캔버스 위에 붉은 막을 덮었는데,
   * 3D 에서 막을 하나 더 얹는 대신 **바탕색과 안개를 붉게 섞는다** —
   * 그림이 한 겹 늘지 않고, 어두운 방일수록 더 잘 읽힌다.
   */
  function hurtTint(hex, hurt, lowHp) {
    var k = core.clamp(flashOf(hurt, 0.28) * 0.5 + (lowHp || 0) * 0.35, 0, 0.6);
    if (k <= 0) { return hex; }
    var r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
    return (Math.round(r + (200 - r) * k) << 16) |
           (Math.round(g + (40 - g) * k) << 8) |
            Math.round(b + (40 - b) * k);
  }

  /**
   * Object Pool (52절). 노드를 **만들어 두고 돌려 쓴다.**
   *
   * 한 프레임의 흐름은 `reset()` → `take()` 여러 번 → `hide(fn)` 이다.
   * 커서만 0 으로 되돌리는 꼴이라 반납을 잊을 자리가 없고, 쓰레기도 안 남는다.
   * **cap 을 넘으면 `null`** 을 준다 — 그 프레임의 그 연출은 그냥 안 그린다.
   * 숫자가 쏟아지는 순간에 노드를 새로 만들기 시작하면 그때 프레임이 끊긴다.
   */
  function pool(make, cap) {
    var items = [], idx = 0, peak = 0, dropped = 0;
    return {
      reset: function () { idx = 0; },
      take: function () {
        if (idx >= cap) { dropped++; return null; }
        if (!items[idx]) { items[idx] = make(idx); }
        var it = items[idx++];
        if (idx > peak) { peak = idx; }
        return it;
      },
      /** 이 프레임에 안 쓰인 것들을 재운다 */
      hide: function (fn) {
        for (var i = idx; i < items.length; i++) { if (items[i]) { fn(items[i]); } }
      },
      stats: function () {
        return { made: items.length, used: idx, cap: cap, peak: peak, dropped: dropped };
      }
    };
  }

  /* ══ 그림 층 — three 가 있을 때만 산다 ═══════════════════════ */

  var T = null, host = null, cam = null;
  var ready = false;
  var atlas = null;                 // 글리프판 텍스처
  var glyphGeo = [];                // 칸마다 UV 를 구운 판 열여섯
  var ringGeo = null, slashGeo = null, boxGeo = null, wallGeo = null;
  var ringGeos = {};
  var pools = {};
  var texCache = {}, texOrder = [];  // `get` 문구 텍스처 (한글은 판에 못 굽는다)
  var TEX_CAP = 32;
  var shake = 0, last = 0;
  var counters = { frames: 0, drawn: 0 };

  /** 글리프판 — 캔버스 한 장에 열여섯 글자를 굽는다. 텍스처는 이 한 장뿐이다 */
  function buildAtlas() {
    var S = 64, cv = global.document.createElement('canvas');
    cv.width = S * 4; cv.height = S * 4;
    var c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '700 44px Cinzel, Georgia, "Nanum Myeongjo", "Batang", serif';
    for (var i = 0; i < GLYPHS.length; i++) {
      var col = i % 4, row = Math.floor(i / 4);
      c.fillText(GLYPHS.charAt(i), col * S + S / 2, row * S + S / 2 + 2);
    }
    var tx = new T.CanvasTexture(cv);
    tx.minFilter = T.LinearFilter;
    tx.generateMipmaps = false;
    return tx;
  }

  /** 칸 하나만 보이도록 UV 를 구운 판. 재질을 색마다 만들지 않으려면 이 길뿐이다 */
  function bakeGlyph(i) {
    var g = new T.PlaneGeometry(1, 1);
    var col = i % 4, row = Math.floor(i / 4);
    var u0 = col / 4, v0 = 1 - (row + 1) / 4, s = 0.25;
    var uv = g.attributes.uv;
    /* PlaneGeometry 의 uv 순서는 좌상·우상·좌하·우하다 */
    uv.setXY(0, u0, v0 + s);
    uv.setXY(1, u0 + s, v0 + s);
    uv.setXY(2, u0, v0);
    uv.setXY(3, u0 + s, v0);
    uv.needsUpdate = true;
    return g;
  }

  /** `get` 문구 — 한글이 섞이므로 글자마다 캔버스를 구워 캐시한다(스물넷까지) */
  function textTex(text) {
    var key = String(text);
    if (texCache[key]) { return texCache[key]; }
    var cv = global.document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    var c = cv.getContext('2d');
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '600 30px Cinzel, Georgia, "Nanum Myeongjo", "Batang", serif';
    c.fillText(key, 128, 34);
    var tx = new T.CanvasTexture(cv);
    tx.minFilter = T.LinearFilter;
    tx.generateMipmaps = false;
    texCache[key] = tx;
    texOrder.push(key);
    while (texOrder.length > TEX_CAP) {
      var old = texOrder.shift();
      if (texCache[old]) { texCache[old].dispose(); delete texCache[old]; }
    }
    return tx;
  }

  /* ── 풀에 담을 노드들 ─────────────────────────────────
   * **재질은 노드마다 따로** 갖는다. 진하기(opacity)가 하나하나 다르기 때문에
   * 공유하면 숫자 열 개가 같은 진하기로 뭉쳐 뜬다. 실제로 한 번 밟았다.
   */

  var NUM_LEN = 7;                  // 숫자 한 덩이의 최대 글자 수

  function makeNum() {
    var g = new T.Group();
    var m = new T.MeshBasicMaterial({
      map: atlas, transparent: true, depthWrite: false, depthTest: false,
      side: T.DoubleSide, fog: false
    });
    var i;
    for (i = 0; i < NUM_LEN; i++) {
      var q = new T.Mesh(glyphGeo[0], m);
      q.visible = false;
      g.add(q);
    }
    g.userData.mat = m;
    g.renderOrder = 30;             // 숫자는 벽 뒤에서도 읽혀야 한다
    host.add(g);
    return g;
  }

  function makeText() {
    var m = new T.SpriteMaterial({
      transparent: true, depthWrite: false, depthTest: false, fog: false
    });
    var s = new T.Sprite(m);
    s.visible = false;
    s.renderOrder = 30;
    host.add(s);
    return s;
  }

  function makeRing() {
    var m = new T.MeshBasicMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide,
      blending: T.AdditiveBlending, fog: false
    });
    var q = new T.Mesh(ringGeo, m);
    q.rotation.x = -Math.PI / 2;    // 바닥에 눕힌다
    q.visible = false;
    host.add(q);
    return q;
  }

  function makeWall() {
    /* 파문이 솟는 껍질. 얇은 빛줄기라 가산 혼합이 맞다(밝은 바닥에서도 안 뭉친다) */
    var m = new T.MeshBasicMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide,
      blending: T.AdditiveBlending, fog: false
    });
    var q = new T.Mesh(wallGeo, m);
    q.visible = false;
    host.add(q);
    return q;
  }

  function makeSlash() {
    var m = new T.MeshBasicMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide,
      blending: T.AdditiveBlending, fog: false
    });
    var q = new T.Mesh(slashGeo, m);
    q.rotation.x = -Math.PI / 2;
    q.visible = false;
    q.renderOrder = 20;
    host.add(q);
    return q;
  }

  var GRAIN = 10;                   // 파편 한 덩이의 조각 수 (보스가 10 이다)

  function makeBurst() {
    var g = new T.Group();
    var m = new T.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false });
    for (var i = 0; i < GRAIN; i++) {
      var q = new T.Mesh(boxGeo, m);
      q.visible = false;
      g.add(q);
    }
    g.userData.mat = m;
    g.visible = false;
    host.add(g);
    return g;
  }

  function makeTrail() {
    var m = new T.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false });
    var q = new T.Mesh(boxGeo, m);
    q.visible = false;
    host.add(q);
    return q;
  }

  /**
   * three 를 넘겨받아 판과 풀을 세운다. `dungeon3d.init` 이 부른다 —
   * 실패하면 조용히 죽고(`ready` 가 false), 3D 는 연출 없이 그대로 돈다.
   */
  function init(three, group) {
    if (ready) { return true; }
    if (!three || !group || !global.document) { return false; }
    T = three; host = group;
    try {
      atlas = buildAtlas();
      var i;
      for (i = 0; i < GLYPHS.length; i++) { glyphGeo.push(bakeGlyph(i)); }
      ringGeo = ringGeoOf(0.12);
      slashGeo = new T.RingGeometry(0.74, 1, 16, 1, -0.7, 1.4);
      boxGeo = new T.BoxGeometry(1, 1, 1);
      wallGeo = new T.CylinderGeometry(1, 1, 1, 40, 1, true);
      pools.num = pool(makeNum, 40);
      pools.text = pool(makeText, 14);
      pools.ring = pool(makeRing, 36);   // §5.18 천뢰 십자가 예고 원 스물을 한꺼번에 깐다
      pools.wall = pool(makeWall, 6);
      pools.slash = pool(makeSlash, 20);
      pools.burst = pool(makeBurst, 8);
      pools.trail = pool(makeTrail, 24);
    } catch (e) { ready = false; return false; }
    ready = true;
    return true;
  }

  /** 두께가 다른 고리를 필요한 만큼만 굽는다 — 넓게 퍼진 파문은 더 얇아야 한다 */
  function ringGeoOf(thick) {
    var k = core.clamp(thick || 0.12, 0.04, 0.4);
    var key = Math.round(k * 100);
    if (!ringGeos[key]) { ringGeos[key] = new T.RingGeometry(1 - key / 100, 1, 44); }
    return ringGeos[key];
  }

  function tint(m, hex, alpha) {
    m.color.setHex(hex);
    m.opacity = core.clamp(alpha, 0, 1);
  }

  /** 숫자 한 덩이를 앉힌다 — 글자 수만큼만 판을 켜고 가운데로 모은다 */
  function putNum(node, pl, x, y, z) {
    var gs = glyphs(pl.text), n = Math.min(gs.length, NUM_LEN), i;
    var w = pl.size * 0.5;
    var x0 = -(n - 1) * w / 2 + (pl.dx || 0);   // 칸 비킴은 빌보드 안에서 — 화면 가로 그대로(W-0077)
    for (i = 0; i < NUM_LEN; i++) {
      var q = node.children[i];
      if (i >= n || gs[i] < 0) { q.visible = false; continue; }
      q.geometry = glyphGeo[gs[i]];
      q.position.set(x0 + i * w, 0, 0);
      q.scale.set(pl.size, pl.size, 1);
      q.visible = true;
    }
    node.position.set(x, y + pl.rise, z);
    if (cam) { node.quaternion.copy(cam.quaternion); }   // 빌보드
    tint(node.userData.mat, pl.hex, pl.alpha * (pl.glow ? 1 : 0.92));
    node.visible = true;
  }

  function putText(node, pl, x, y, z) {
    node.material.map = textTex(pl.text);
    tint(node.material, pl.hex, pl.alpha);
    node.position.set(x, y + pl.rise, z);
    node.scale.set(pl.size * 6.4, pl.size * 1.6, 1);
    node.visible = true;
  }

  function putRing(node, pl, x, z) {
    var r = Math.max(1, pl.r);
    node.geometry = ringGeoOf(pl.thick);
    node.position.set(x, pl.lift, z);
    node.scale.set(r, r, 1);
    if (pl.spin) { node.rotation.z = counters.frames * 0.22; }
    tint(node.material, pl.hex, pl.alpha);
    node.visible = true;
  }

  function putWall(node, pl, x, z) {
    var r = Math.max(1, pl.r);
    var h = 10 + pl.k * 34;
    node.position.set(x, h / 2, z);
    node.scale.set(r, h, r);
    tint(node.material, pl.hex, pl.alpha * (1 - pl.k) * 0.8);
    node.visible = true;
  }

  function putSlash(node, pl, x, y, z) {
    var r = Math.max(1, pl.r);
    node.position.set(x, y + 16, z);
    node.rotation.z = -pl.ang;      // 눕힌 판이라 z 가 곧 지면 위의 각이다
    node.scale.set(r, r, 1);
    tint(node.material, pl.hex, pl.alpha);
    node.visible = true;
  }

  /** 파편 — 솟았다 떨어진다. 자리는 씨앗과 진행도로만 정해 상태를 안 남긴다 */
  function putBurst(node, pl, x, z) {
    var n = Math.min(pl.n, GRAIN), i;
    for (i = 0; i < GRAIN; i++) {
      var q = node.children[i];
      if (i >= n) { q.visible = false; continue; }
      var ang = pl.seed + i * (6.283 / n);
      var rr = 8 + pl.k * pl.spread;
      var s = pl.grain * (1 - pl.k * 0.6);
      q.position.set(Math.cos(ang) * rr, 10 + pl.k * 46 - pl.k * pl.k * 62,
                     Math.sin(ang) * rr);
      q.scale.set(s, s, s);
      q.rotation.set(ang, ang * 1.7, 0);
      q.visible = true;
    }
    node.position.set(x, 0, z);
    tint(node.userData.mat, pl.hex, pl.alpha);
    node.visible = true;
  }

  function putTrail(node, pl, x, z) {
    var r = Math.max(1, pl.r);
    node.position.set(x, 14, z);
    node.scale.set(r, r * 1.8, r);
    tint(node.material, pl.hex, pl.alpha);
    node.visible = true;
  }

  function hideOne(n) { n.visible = false; }

  function hideAll() {
    var k;
    for (k in pools) {
      if (!Object.prototype.hasOwnProperty.call(pools, k)) { continue; }
      pools[k].hide(hideOne);
    }
  }

  /**
   * 한 프레임. `dungeon3d.render` 가 배우를 세운 뒤에 부른다.
   *
   * 매 프레임 **모든 풀의 커서를 0 으로 되돌리고** 살아 있는 fx 를 다시 앉힌다.
   * fx 마다 어느 노드를 쓰는지 기억하지 않아도 되고(판정이 배열을 splice 한다),
   * 파편 자리까지 수명으로만 정해 두었으니 상태가 어긋날 자리가 없다.
   */
  function step(run, fxs, camera) {
    if (!ready || !fxs) { return 0; }
    cam = camera || null;
    var now = Date.now();
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    counters.frames++;

    var k;
    for (k in pools) {
      if (Object.prototype.hasOwnProperty.call(pools, k)) { pools[k].reset(); }
    }

    shake = shakeStep(shake, dt);
    var drawn = 0, i;

    for (i = 0; i < fxs.length; i++) {
      var f = fxs[i];
      /* 갓 태어난 것만 화면을 흔든다. 표시를 fx 에 남긴다 —
         2D 층도 `goreDone` 을 같은 자리에 남긴다(판정은 life 만 본다) */
      if (!f.shake3d) {
        f.shake3d = 1;
        var s = shakeOf(f);
        if (s > shake) { shake = Math.min(SHAKE_MAX, s); }
      }
      slotOf(fxs, i);
      var pl = plan(f);
      if (!pl) { continue; }
      var node = null;
      if (pl.kind === 'num') {
        node = pools.num.take();
        if (node) { putNum(node, pl, f.x, 30, f.y); }
      } else if (pl.kind === 'text') {
        node = pools.text.take();
        if (node) { putText(node, pl, f.x, 26, f.y); }
      } else if (pl.kind === 'ring') {
        node = pools.ring.take();
        if (node) { putRing(node, pl, f.x, f.y); }
        if (pl.wall) {
          var w = pools.wall.take();
          if (w) { putWall(w, pl, f.x, f.y); }
        }
      } else if (pl.kind === 'slash') {
        node = pools.slash.take();
        if (node) { putSlash(node, pl, f.x, 0, f.y); }
      } else if (pl.kind === 'burst') {
        node = pools.burst.take();
        if (node) { putBurst(node, pl, f.x, f.y); }
      } else if (pl.kind === 'trail') {
        node = pools.trail.take();
        if (node) { putTrail(node, pl, f.x, f.y); }
      }
      if (node) { drawn++; }
    }

    hideAll();
    counters.drawn = drawn;
    return drawn;
  }

  /** 카메라를 얼마나 흔들지. `dungeon3d` 가 자리를 정한 뒤 얹는다 */
  function shakeAmt() { return shake; }
  function shakeNudge(v) { if (v > shake) { shake = Math.min(SHAKE_MAX, v); } return shake; }

  function stats() {
    var out = { ready: ready, shake: Math.round(shake * 10) / 10,
                drawn: counters.drawn, frames: counters.frames,
                tex: texOrder.length };
    var k;
    for (k in pools) {
      if (Object.prototype.hasOwnProperty.call(pools, k)) { out[k] = pools[k].stats(); }
    }
    return out;
  }

  global.DG = global.DG || {};
  global.DG.fx3d = {
    /* 그림 층 */
    init: init, step: step, stats: stats,
    shakeAmt: shakeAmt, shakeNudge: shakeNudge,
    ready: function () { return ready; },
    /* 값 층 — three 없이도 돈다 (자가진단이 이것만 따로 본다) */
    plan: plan, slotOf: slotOf, slotDx: slotDx, slotUp: slotUp, textOf: textOf, glyphs: glyphs, numHex: numHex,
    shakeOf: shakeOf, shakeStep: shakeStep, flashOf: flashOf,
    shotHex: shotHex, hurtTint: hurtTint, pool: pool,
    GLYPHS: GLYPHS, FULL: FULL, SHAKE_MAX: SHAKE_MAX
  };
})(window);
