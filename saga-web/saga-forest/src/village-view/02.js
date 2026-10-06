  /* ── 사람 ─────────────────────────────────────────────── */

  function drawResident(res, f, now) {
    var p = project(res.x, res.y);
    if (p.a < -A_MAX) { return; }
    if (p.x < -120 || p.x > W + 120 || p.y < -140 || p.y > H + 140) { return; }
    var k = ZOOM * p.s;
    var s = global.DG.village.state();
    var req = s.requests[res.id];

    shadow(p.x, p.y + 2 * k, 13 * k, 4.6 * k);
    if (!(global.DG.actor2d && global.DG.actor2d.draw(ctx, 'adult', res.ref, null, p.x, p.y, 0.92 * k, { facing: res.facing, moving: false, now: now }))) global.DG.sprite.stamp(ctx, {
      kind: 'human', ref: res.ref, x: p.x, y: p.y, s: 0.92 * k,
      facing: res.facing, phase: 0, walking: false,
      color: global.DG.data.faction(res.ref.faction).color,
      look: global.DG.sprite.lookOf(res.ref),
      rarity: res.ref.rarity, t: now
    });

    var pending = !(req && req.done);
    /* 저희끼리 말을 주고받는 중이면 **그 말**을 띄운다 — 이름은 그 아래로 내린다.
       마을이 살아 있다고 느껴지는 것은 이 한 줄에서 온다 */
    var line = global.DG.folk ? global.DG.folk.lineOf(res.id) : null;
    if (line) {
      bubble(line, p.x, p.y - 82 * k, '#2f3a46', '#fffdf4');
      bubble(res.ref.name, p.x, p.y - 60 * k, '#5a6472', '#f2f4f8');
    } else {
      bubble(res.ref.name, p.x, p.y - 62 * k, '#3c4450', '#ffffff');
    }
    if (pending && !line) { mark(p.x + 26 * k, p.y - 70 * k, k, now); }
    if (f && f.type === 'resident' && f.obj.id === res.id) {
      ring(p.x, p.y + 2 * k, k, 'rgba(120,205,255,.95)');
      bubble('말을 건다 [' + core.actHint() + ']', p.x, p.y - 84 * k, '#0d5b86', '#e6f5ff');
    }
  }

  /**
   * 지금 내 모습 — **침선방에서 고른 차림을 입힌다.**
   * 스탬프 캐시가 `ref.id` 로만 갈리므로 **차림표를 붙인 가짜 id** 를 넘긴다.
   * 안 그러면 갈아입어도 옛 그림이 그대로 나온다 (실제로 그랬다).
   */
  function meStamp() {
    var lead = core.save.party[0];
    var ref = lead ? global.DG.data.find(lead) : null;
    if (!ref) { ref = global.DG.data.heroes[0]; }
    var W2 = global.DG.wear;
    var look = global.DG.sprite.lookOf(ref);
    var color = global.DG.data.faction(ref.faction).color;
    if (!W2) { return { ref: ref, look: look, color: color }; }
    return {
      ref: { id: ref.id + '#' + W2.sig(), rarity: ref.rarity },
      look: W2.applyLook(look),
      color: W2.color(color),
      rarity: ref.rarity
    };
  }

  function drawMe(p0, now) {
    var p = project(p0.x, p0.y);
    var k = ZOOM * p.s;
    var me = meStamp();
    shadow(p.x, p.y + 2 * k, 14 * k, 5 * k);
    var MTd = global.DG.mount, mtd = MTd && MTd.active && MTd.active() ? MTd.current() : null, lift = 0;   // 탈것(mount.js) — 2D 는 이모지로
    if (mtd) {
      lift = 16 * k + (MTd.isFly(mtd) ? 12 * k + Math.sin(now / 240) * 2 * k : 0);
      ctx.font = Math.round(34 * k) + 'px "Segoe UI Emoji", system-ui'; ctx.textAlign = 'center';
      ctx.fillText(mtd.emoji, p.x, p.y - (MTd.isFly(mtd) ? 12 * k : 0) + 2 * k);
    }
    if (!(global.DG.actor2d && global.DG.actor2d.draw(ctx, 'me', me.ref, 'me', p.x, p.y - lift, 1 * k, { facing: p0.facing, dirX: p0.dirX, dirY: p0.dirY, moving: p0.walking, phase: p0.phase, now: now }))) global.DG.sprite.stamp(ctx, {
      kind: 'human', ref: me.ref, x: p.x, y: p.y - lift, s: 1 * k,
      facing: p0.facing, phase: p0.phase, walking: p0.walking,
      color: me.color, look: me.look,
      rarity: me.rarity, t: now
    });
    /* 살금살금 — 발밑에 발자국을 띄운다. 켜져 있는지 눈으로 알아야 한다 */
    if (V.sneaking()) {
      ctx.save();
      ctx.globalAlpha = 0.75 + Math.sin(now / 420) * 0.2;
      ctx.font = Math.round(15 * k) + 'px "Segoe UI Emoji", system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('🐾', p.x - 22 * k, p.y + 6 * k);
      ctx.restore();
    }
  }

  /** 부탁이 있는 주민 머리 위 — 통통 튀는 느낌표 */
  function mark(x, y, k, now) {
    var bob = Math.sin(now / 260) * 3 * k;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y + bob, 9 * k, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd24a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,0,0.5)';
    ctx.lineWidth = 1.4 * k;
    ctx.stroke();
    ctx.fillStyle = '#7a4a00';
    ctx.font = '900 ' + Math.round(13 * k) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', x, y + bob + 0.5 * k);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  /** 발밑 고리 — 손이 닿는 것 표시 */
  function ring(x, y, k, color) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, 24 * k, 9 * k, 0, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6 * k;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 말풍선 — 원작의 그 둥근 이름표.
   * 화면에 글자를 그냥 얹지 않는다. 흰 판에 얹고 아래에 꼬리를 단다.
   */
  function bubble(text, x, y, fg, bg) {
    ctx.save();
    ctx.font = '700 12.5px "Malgun Gothic", system-ui';
    var w = ctx.measureText(text).width + 18;
    var h = 21, rr = h * 0.5;
    var l = x - w * 0.5, t = y - h * 0.5;

    ctx.beginPath();
    ctx.moveTo(l + rr, t);
    ctx.lineTo(l + w - rr, t);
    ctx.quadraticCurveTo(l + w, t, l + w, t + rr);
    ctx.lineTo(l + w, t + h - rr);
    ctx.quadraticCurveTo(l + w, t + h, l + w - rr, t + h);
    ctx.lineTo(x + 5, t + h);
    ctx.lineTo(x, t + h + 6);
    ctx.lineTo(x - 5, t + h);
    ctx.lineTo(l + rr, t + h);
    ctx.quadraticCurveTo(l, t + h, l, t + h - rr);
    ctx.lineTo(l, t + rr);
    ctx.quadraticCurveTo(l, t, l + rr, t);
    ctx.closePath();

    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.save(); ctx.translate(0, 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = bg || '#ffffff';
    ctx.fill();

    ctx.fillStyle = fg || '#39414c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }

  /* ── 날씨 ─────────────────────────────────────────────────
   * 겨울엔 눈, 봄엔 꽃잎이 흩날린다. 자리는 해시로 고정하고 시간만 흘린다 —
   * 매 프레임 새로 뽑으면 깜박인다.
   */
  /**
   * 하늘에서 내리는 것 — **계절이 아니라 날씨를 본다.**
   * 겨울이라고 늘 눈이 오지 않는다. 그게 맞고, 그래야 눈 오는 날이 반갑다.
   * 봄의 꽃잎과 삼짇날의 꽃보라만 계절·행사를 탄다.
   */
  function drawWeather(se, now) {
    var wx = wxKey();
    var blossom = evTag() === 'blossom';

    if (wx === 'rain') { drawRain(now); }
    if (wx === 'cloud' || wx === 'rain' || wx === 'snow') {
      ctx.fillStyle = wx === 'rain' ? 'rgba(52,62,84,0.24)'
                    : wx === 'snow' ? 'rgba(180,196,216,0.16)'
                    : 'rgba(90,100,118,0.13)';
      ctx.fillRect(0, 0, W, H);
    }

    var snow = wx === 'snow';
    var petal = blossom || (se.key === 'spring' && wx !== 'rain');
    if (!snow && !petal) { return; }
    var n = snow ? 54 : blossom ? 62 : 34;
    ctx.save();
    ctx.fillStyle = snow ? 'rgba(255,255,255,0.86)' : 'rgba(248,190,214,0.80)';
    for (var i = 0; i < n; i++) {
      var sp = 0.4 + core.hash2(i * 3 + 1, 5) * 0.8;
      var t = ((now / (snow ? 9000 : 7000)) * sp + core.hash2(i, 17)) % 1;
      var x = (core.hash2(7, i * 11) * W + Math.sin(now / 1400 + i) * 26 + W) % W;
      var y = t * (H + 40) - 20;
      var r = (snow ? 1.6 : 2.2) + core.hash2(i * 5, i) * 1.6;
      ctx.beginPath();
      if (snow) { ctx.arc(x, y, r, 0, Math.PI * 2); }
      else { ctx.ellipse(x, y, r, r * 0.6, now / 700 + i, 0, Math.PI * 2); }
      ctx.fill();
    }
    ctx.restore();
  }

  /** 비 — 기운 빗줄기와 땅에 튀는 자국 */
  function drawRain(now) {
    var n = 110, i;
    ctx.save();
    ctx.strokeStyle = 'rgba(200,220,240,0.55)';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (i = 0; i < n; i++) {
      var sp = 0.7 + core.hash2(i * 5 + 2, 9) * 0.6;
      var t = ((now / 900) * sp + core.hash2(i, 23)) % 1;
      var x = core.hash2(11, i * 7) * (W + 160) - 80 + t * 90;
      var y = t * (H + 60) - 30;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 9, y + 22);
    }
    ctx.stroke();
    /* 땅에 튀는 자국 — 몇 개만. 많으면 지저분해진다 */
    ctx.strokeStyle = 'rgba(220,238,255,0.40)';
    ctx.lineWidth = 1.1;
    for (i = 0; i < 22; i++) {
      var pt = ((now / 620) + core.hash2(i * 3, 31)) % 1;
      var px = core.hash2(5, i * 13) * W;
      var py = core.hash2(i * 17, 3) * H * 0.7 + H * 0.28;
      ctx.beginPath();
      ctx.ellipse(px, py, 3 + pt * 11, (3 + pt * 11) * 0.34, 0, 0, Math.PI * 2);
      ctx.globalAlpha = Math.max(0, 1 - pt) * 0.7;
      ctx.stroke();
    }
    ctx.restore();
  }


  /* ── 짐승(PLAN 40절 PHASE 4 첫 칸, PLAN 16절) ────────────────────
   * 3D 는 asset3d.js 에 등록된 실제 모델(사슴·여우·늑대·토끼·다람쥐·오리·새·
   * 개구리·뱀)이 선다. 2D 는 2026-09-10까지 emoji 뿐이었다 — 사슴·여우·
   * 다람쥐·개구리·새 다섯은 OpenGameArt "Seasons of Forest Animal Pack"
   * (CC0, `assets/sprites2d/animals/`, `ASSET_LICENSES.md` 참고)의 실제
   * 4방향 idle/run 그림으로 바꿨다. 원본은 앞/뒤 방향도 있지만 이 게임은
   * 좌/우(facing -1/1)만 추적하므로 그 둘만 골라 담았다(ANIMAL_SPRITE 표).
   * 나머지 넷(늑대·토끼·오리·뱀)은 맞는 CC0 를 못 찾아 emoji 였다 — 2026-09-25 부터 3D 에 서는 **그 모델**을 옆에서 구운
   * 같은 모양 시트(`tools/bake-portraits/bake.mjs saga-forest --sprites=animals`, 컷 44×36). 정지 모델(토끼·오리)은 달리기 줄이
   * 깡충 뛰는 높이 차다. 희귀 괴물 둘(포자괴물·성간충)도 같은 길. ANIMAL_SPRITE 에 없는 kind 만 emoji 로 떨어진다.
   */
  var ANIMAL_SPRITE = {
    deer:     { w: 41, h: 33, idleFrames: 4, runFrames: 4, idleMs: 300, runMs: 150 },
    fox:      { w: 35, h: 32, idleFrames: 4, runFrames: 4, idleMs: 300, runMs: 150 },
    squirrel: { w: 30, h: 28, idleFrames: 4, runFrames: 4, idleMs: 300, runMs: 150 },
    frog:     { w: 24, h: 21, idleFrames: 2, runFrames: 4, idleMs: 600, runMs: 150 },
    bird:     { w: 28, h: 24, idleFrames: 4, runFrames: 4, idleMs: 300, runMs: 150 },
    wolf:     { w: 44, h: 36, idleFrames: 4, runFrames: 4, idleMs: 300, runMs: 150 },
    rabbit:   { w: 44, h: 36, idleFrames: 1, runFrames: 4, idleMs: 300, runMs: 120 },
    duck:     { w: 44, h: 36, idleFrames: 1, runFrames: 4, idleMs: 300, runMs: 150 },
    snake:    { w: 44, h: 36, idleFrames: 4, runFrames: 4, idleMs: 300, runMs: 170 },
    mushnub:  { w: 44, h: 36, idleFrames: 1, runFrames: 4, idleMs: 300, runMs: 150 },   // 희귀 괴물 둘 — 3D 의 monster:<종류>
    spacebug: { w: 44, h: 36, idleFrames: 4, runFrames: 4, idleMs: 300, runMs: 150 }
  };
  var animalImgCache = {};
  function animalImg(kind) {
    var im = animalImgCache[kind];
    if (!im) {
      im = new Image();
      im.src = 'assets/sprites2d/animals/' + kind + '.png';
      animalImgCache[kind] = im;
    }
    return im;
  }
  var ANIMAL_DISPLAY_H = 30;   // emoji 글자 높이(27px)와 맞춘 눈대중 값

  function drawAnimal(a, now) {
    var def = VD.ANIMALS[a.kind];
    if (!def) { return; }
    var p = project(a.x, a.y);
    if (p.a < -A_MAX) { return; }
    if (p.x < -100 || p.x > W + 100 || p.y < -140 || p.y > H + 140) { return; }
    var k = ZOOM * p.s;
    shadow(p.x, p.y + 4 * k, 11 * k, 4 * k);
    ctx.save();
    if (a.state === 'flee') { ctx.globalAlpha = 0.85; }

    var sp = ANIMAL_SPRITE[a.kind];
    var img = sp && animalImg(a.kind);
    if (sp && img.complete && img.naturalWidth) {
      var moving = a.state === 'wander' || a.state === 'flee';
      var right = a.facing >= 0;
      var row = moving ? (right ? 3 : 2) : (right ? 1 : 0);
      var frames = moving ? sp.runFrames : sp.idleFrames;
      var ms = moving ? sp.runMs : sp.idleMs;
      var frame = Math.floor(now / ms) % frames;
      var dh = ANIMAL_DISPLAY_H * k, dw = dh * (sp.w / sp.h);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, frame * sp.w, row * sp.h, sp.w, sp.h,
        p.x - dw / 2, p.y + 7 * k - dh, dw, dh);
    } else {
      ctx.font = Math.round(27 * k) + 'px "Segoe UI Emoji", system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.translate(p.x, 0);
      ctx.scale(a.facing < 0 ? -1 : 1, 1);
      ctx.fillText(def.emoji, 0, p.y + 7 * k);
    }
    ctx.restore();
  }

  /* ── 숲 NPC(PLAN 40절 PHASE 4 NPC 칸) ────────────────────────
   * 아직 말을 걸 수는 없다(Interaction·Quest 몫) — 가까이 가면 인사말
   * 한 줄이 뜬다. residents 처럼 이름표는 늘 띄운다.
   */
  var NPC_TALK_DIST = 130;
  function drawNpc(n, f, now) {
    var def = n.def || VD.NPCS[n.kind];
    if (!def) { return; }
    var p = project(n.x, n.y);
    if (p.a < -A_MAX) { return; }
    if (p.x < -120 || p.x > W + 120 || p.y < -140 || p.y > H + 140) { return; }
    var k = ZOOM * p.s;
    shadow(p.x, p.y + 3 * k, 12 * k, 4.4 * k);
    /* 방문객 몸짓(§5.10) — 곁에 서면 나를 본다, 부탁을 다 들어준 날은 깡충 춤 */
    var raw0 = V.raw(), gNear = n.gesture && Math.hypot(raw0.player.x - n.x, raw0.player.y - n.y) < NPC_TALK_DIST * 1.6;
    var hop = n.gesture === 'dance' ? Math.abs(Math.sin(now / 170)) * 7 * k : 0;
    var face = gNear ? (raw0.player.x < n.x ? -1 : 1) : (n.gesture === 'dance' ? (Math.sin(now / 700) < 0 ? -1 : 1) :
      (n.faceX !== undefined ? (n.faceX < n.x ? -1 : 1) : n.facing));
    /* 2026-09-10 — 이모지 대신 residents 와 같은 사람 스탬프(Kenney CC0,
       sprite.js 의 stamp())를 쓴다. HEROES 로스터를 안 물리려고 ref 를
       {id:'npc_'+kind} 만 준다 — humanIndexOf() 가 이 문자열을 해시해
       14종 중 하나를 고정으로 고른다(같은 NPC는 늘 같은 얼굴) */
    if (!(global.DG.actor2d && global.DG.actor2d.draw(ctx, n.kid ? 'kid' : 'adult', { id: n.id }, null, p.x, p.y - hop, (n.kid ? 0.62 : 0.86) * k, { facing: face, moving: n.gesture === 'dance', now: now }))) global.DG.sprite.stamp(ctx, {
      kind: 'human', ref: { id: n.id }, x: p.x, y: p.y - hop, s: (n.kid ? 0.62 : 0.86) * k,
      facing: face, phase: 0, walking: n.gesture === 'dance', t: now
    });
    if (gNear && n.gesture === 'wave') {
      ctx.font = Math.round(15 * k) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👋', p.x + face * 14 * k, p.y - 44 * k + Math.sin(now / 120) * 3 * k);
      ctx.textAlign = 'left';
    }

    var raw = V.raw();
    var near = Math.hypot(raw.player.x - n.x, raw.player.y - n.y) < NPC_TALK_DIST;
    var focused = f && f.type === 'npc' && f.obj.id === n.id;
    if (focused) {
      ring(p.x, p.y + 3 * k, k, 'rgba(120,205,255,.95)');
      bubble('말을 건다 [' + core.actHint() + ']', p.x, p.y - 82 * k, '#0d5b86', '#e6f5ff');
      bubble(def.name, p.x, p.y - 60 * k, '#5a6472', '#f2f4f8');
    } else if (near) {
      bubble(n.chat && n.x <= n.faceX ? n.chat : (n.chat ? '…' : def.line), p.x, p.y - 82 * k, '#2f3a46', '#fffdf4');
      bubble(def.name, p.x, p.y - 60 * k, '#5a6472', '#f2f4f8');
    } else {
      bubble(def.name, p.x, p.y - 62 * k, '#3c4450', '#ffffff');
    }
  }

  /* ── 곤충 ─────────────────────────────────────────────────
   * 사물과 달리 살아 움직인다. 나는 것은 땅에서 떠 있고 그림자가 옅다.
   * 반딧불이는 **밤에 빛난다** — 그 하나 때문에 시간대가 놀이가 된다.
   */
  function drawBug(b, f, ph, now) {
    var p = project(b.x, b.y);
    if (p.a < -A_MAX) { return; }
    if (p.x < -80 || p.x > W + 80 || p.y < -80 || p.y > H + 80) { return; }
    var k = ZOOM * p.s;
    var ref = b.ref;
    var flies = ref.form === 'butterfly' || ref.form === 'dragonfly' || ref.form === 'firefly';
    var hover = flies ? -15 * k + Math.sin(now / 230 + b.wob) * 4 * k : 0;
    var cx = p.x, cy = p.y + hover;

    if (!flies && !b.perch) {
      shadow(cx, p.y + 1 * k, 6 * k, 2.4 * k);
    } else if (flies) {
      ctx.save(); ctx.globalAlpha = 0.5;
      shadow(cx, p.y + 1 * k, 4 * k, 1.6 * k);
      ctx.restore();
    }

    ctx.save();
    if (b.state === 'flee') { ctx.globalAlpha = 0.75; }
    switch (ref.form) {
      case 'butterfly': bugButterfly(cx, cy, k, ref, b, now); break;
      case 'ladybug':   bugLadybug(cx, cy, k, ref); break;
      case 'beetle':    bugBeetle(cx, cy, k, ref); break;
      case 'dragonfly': bugDragonfly(cx, cy, k, ref, b, now); break;
      case 'firefly':   bugFirefly(cx, cy, k, ref, b, ph, now); break;
      case 'cicada':    bugCicada(cx, cy, k, ref); break;
      case 'wasp':      bugWasp(cx, cy, k, ref, b, now); break;
      case 'snail':     bugSnail(cx, cy, k, ref); break;
      case 'hopper':    bugHopper(cx, cy, k, ref); break;
      default:          bugSpider(cx, cy, k, ref);
    }
    ctx.restore();

    if (b.chase) {
      bubble('벌떼! 달아나거나 ' + core.actHint() + ' 로 받아친다', cx, cy - 36 * k, '#8a2020', '#ffe2e2');
    } else if (f && f.type === 'bug' && f.obj === b) {
      var net = global.DG.bug.hasNet();
      ring(cx, p.y + 2 * k, k * 0.8, net ? 'rgba(255,240,150,.95)' : 'rgba(220,120,120,.9)');
      bubble(net ? ref.name + ' — 휘두른다 [' + core.actHint() + ']' : '🥅 잠자리채가 없다 (전방)',
        cx, cy - 34 * k, net ? '#6a5200' : '#8a2020', net ? '#fff6cc' : '#ffe2e2');
    } else if (b.state === 'flee') {
      bubble('달아난다!', cx, cy - 30 * k, '#8a2020', '#ffe2e2');
    }
  }

  function bugButterfly(x, y, k, ref, b, now) {
    var flap = Math.abs(Math.sin(now / 95 + b.wob));
    var ww = 8 * k * (0.30 + 0.70 * flap);
    ctx.fillStyle = ref.wing;
    ctx.beginPath();
    ctx.ellipse(x - ww * 0.85, y - 2 * k, ww, 6.5 * k, -0.3, 0, Math.PI * 2);
    ctx.ellipse(x + ww * 0.85, y - 2 * k, ww, 6.5 * k, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dark(ref.wing, 0.18);
    ctx.beginPath();
    ctx.ellipse(x - ww * 0.72, y + 4 * k, ww * 0.72, 4 * k, -0.2, 0, Math.PI * 2);
    ctx.ellipse(x + ww * 0.72, y + 4 * k, ww * 0.72, 4 * k, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ref.body;
    ctx.beginPath();
    ctx.ellipse(x, y, 1.7 * k, 6 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ref.body;
    ctx.lineWidth = 0.9 * k;
    ctx.beginPath();
    ctx.moveTo(x - 0.6 * k, y - 5 * k); ctx.lineTo(x - 3.4 * k, y - 9 * k);
    ctx.moveTo(x + 0.6 * k, y - 5 * k); ctx.lineTo(x + 3.4 * k, y - 9 * k);
    ctx.stroke();
  }

  function bugLadybug(x, y, k, ref) {
    ctx.fillStyle = ref.wing;
    ctx.beginPath();
    ctx.ellipse(x, y, 6 * k, 6.6 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ref.body;
    ctx.lineWidth = 1 * k;
    ctx.beginPath(); ctx.moveTo(x, y - 6 * k); ctx.lineTo(x, y + 6 * k); ctx.stroke();
    ctx.fillStyle = ref.body;
    var sp = [[-2.6, -1.6], [2.6, -1.2], [-2.2, 2.6], [2.4, 2.4]];
    for (var i = 0; i < sp.length; i++) {
      ctx.beginPath();
      ctx.arc(x + sp[i][0] * k, y + sp[i][1] * k, 1.3 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y - 6 * k, 3 * k, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  function bugBeetle(x, y, k, ref) {
    ctx.fillStyle = ref.wing;
    ctx.beginPath();
    ctx.ellipse(x, y + 1 * k, 6 * k, 8.5 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = light(ref.wing, 0.20);
    ctx.beginPath();
    ctx.ellipse(x - 2.2 * k, y - 1 * k, 2 * k, 5 * k, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ref.body;
    ctx.beginPath();
    ctx.ellipse(x, y - 7 * k, 4 * k, 3.4 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ref.body;
    ctx.lineWidth = 1.4 * k;
    ctx.lineCap = 'round';
    if (ref.horn) {                       /* 장수풍뎅이 — 앞으로 뻗은 뿔 */
      ctx.beginPath();
      ctx.moveTo(x, y - 9 * k);
      ctx.quadraticCurveTo(x + 1 * k, y - 15 * k, x - 1.6 * k, y - 17 * k);
      ctx.stroke();
    } else if (ref.jaw) {                 /* 사슴벌레 — 벌어진 큰턱 */
      ctx.beginPath();
      ctx.moveTo(x - 2.4 * k, y - 9 * k);
      ctx.quadraticCurveTo(x - 6 * k, y - 13 * k, x - 2.6 * k, y - 16 * k);
      ctx.moveTo(x + 2.4 * k, y - 9 * k);
      ctx.quadraticCurveTo(x + 6 * k, y - 13 * k, x + 2.6 * k, y - 16 * k);
      ctx.stroke();
    }
    ctx.lineWidth = 1 * k;
    for (var i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 5 * k, y + i * 3.4 * k); ctx.lineTo(x - 9 * k, y + i * 3.4 * k - 1.6 * k);
      ctx.moveTo(x + 5 * k, y + i * 3.4 * k); ctx.lineTo(x + 9 * k, y + i * 3.4 * k - 1.6 * k);
      ctx.stroke();
    }
  }

  function bugDragonfly(x, y, k, ref, b, now) {
    var flap = Math.sin(now / 55 + b.wob) * 0.28;
    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = ref.wing;
    var wing = function (dx, dy, ang) {
      ctx.beginPath();
      ctx.ellipse(x + dx * k, y + dy * k, 10 * k, 2.4 * k, ang, 0, Math.PI * 2);
      ctx.fill();
    };
    wing(-8, -3, -0.18 + flap); wing(8, -3, 0.18 - flap);
    wing(-8, 2, 0.16 + flap);   wing(8, 2, -0.16 - flap);
    ctx.restore();
    ctx.fillStyle = ref.body;
    ctx.beginPath();
    ctx.ellipse(x, y + 4 * k, 1.5 * k, 9 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - 6 * k, 3 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(x - 1.2 * k, y - 7 * k, 1 * k, 0, Math.PI * 2);
    ctx.fill();
  }

  function bugFirefly(x, y, k, ref, b, ph, now) {
    var night = ph.key === 'night' || ph.key === 'even' || ph.key === 'dawn';
    var pulse = 0.45 + 0.55 * Math.abs(Math.sin(now / 520 + b.wob));
    if (night) {
      var g = ctx.createRadialGradient(x, y + 3 * k, 0, x, y + 3 * k, 22 * k);
      g.addColorStop(0, 'rgba(246,240,150,' + (0.85 * pulse).toFixed(2) + ')');
      g.addColorStop(0.45, 'rgba(200,230,120,' + (0.30 * pulse).toFixed(2) + ')');
      g.addColorStop(1, 'rgba(180,220,110,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y + 3 * k, 22 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = ref.body;
    ctx.beginPath();
    ctx.ellipse(x, y, 2.2 * k, 5 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = night ? 'rgba(250,246,170,' + (0.6 + 0.4 * pulse).toFixed(2) + ')' : '#c8c86a';
    ctx.beginPath();
    ctx.ellipse(x, y + 3.4 * k, 2 * k, 2.6 * k, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function bugCicada(x, y, k, ref) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = ref.wing;
    ctx.beginPath();
    ctx.moveTo(x, y - 6 * k); ctx.lineTo(x - 6 * k, y + 8 * k); ctx.lineTo(x + 1 * k, y + 7 * k);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - 6 * k); ctx.lineTo(x + 6 * k, y + 8 * k); ctx.lineTo(x - 1 * k, y + 7 * k);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = ref.body;
    ctx.beginPath();
    ctx.ellipse(x, y, 3 * k, 7 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - 6.4 * k, 3 * k, 0, Math.PI * 2);
    ctx.fill();
  }

  function bugHopper(x, y, k, ref) {
    ctx.fillStyle = ref.wing;
    ctx.beginPath();
    ctx.ellipse(x, y, 3 * k, 8.5 * k, 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ref.body;
    ctx.beginPath();
    ctx.ellipse(x + 2.4 * k, y - 6.5 * k, 2.6 * k, 3.4 * k, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ref.body;
    ctx.lineWidth = 1.6 * k;
    ctx.lineCap = 'round';
    ctx.beginPath();                       /* 뒷다리 — 방아깨비의 그 각진 다리 */
    ctx.moveTo(x - 1 * k, y + 1 * k);
    ctx.lineTo(x - 6 * k, y - 3 * k);
    ctx.lineTo(x - 4 * k, y + 8 * k);
    ctx.stroke();
    ctx.lineWidth = 1 * k;
    ctx.beginPath();
    ctx.moveTo(x + 1 * k, y + 2 * k); ctx.lineTo(x + 5 * k, y + 7 * k);
    ctx.moveTo(x + 2 * k, y - 3 * k); ctx.lineTo(x + 6 * k, y - 1 * k);
    ctx.stroke();
  }

  /**
   * 말벌 — 한 마리가 아니라 **떼**다. 작은 놈 넷이 성을 내며 붙어 다닌다.
   * 쫓아오는 중이니 뒤에 성난 획 두 줄을 남긴다.
   */
  /** 달팽이 — 비 오는 날의 그것. 껍데기 소용돌이가 있어야 달팽이로 보인다 */
  function bugSnail(x, y, k, ref) {
    ctx.fillStyle = ref.body;                        // 몸
    ctx.beginPath();
    ctx.moveTo(x - 9 * k, y);
    ctx.quadraticCurveTo(x - 11 * k, y - 5 * k, x - 6 * k, y - 5 * k);
    ctx.lineTo(x + 7 * k, y - 3 * k);
    ctx.quadraticCurveTo(x + 10 * k, y, x + 7 * k, y + 1 * k);
    ctx.lineTo(x - 8 * k, y + 1 * k);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ref.body;                      // 더듬이
    ctx.lineWidth = 1 * k;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 8 * k, y - 4 * k); ctx.lineTo(x - 11 * k, y - 9 * k);
    ctx.moveTo(x - 5 * k, y - 5 * k); ctx.lineTo(x - 6 * k, y - 10 * k);
    ctx.stroke();
    ctx.fillStyle = ref.wing;                        // 껍데기
    ctx.beginPath();
    ctx.arc(x + 2 * k, y - 5 * k, 6 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,90,60,0.6)';
    ctx.lineWidth = 1.1 * k;
    ctx.beginPath();
    for (var a = 0; a < Math.PI * 3.2; a += 0.25) {   // 소용돌이
      var rr = 0.9 * k + a * 0.9 * k;
      var px = x + 2 * k + Math.cos(a) * rr;
      var py = y - 5 * k + Math.sin(a) * rr;
      if (a === 0) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
    }
    ctx.stroke();
  }

  function bugWasp(x, y, k, ref, b, now) {
    var i;
    ctx.save();
    ctx.strokeStyle = 'rgba(40,30,20,0.35)';
    ctx.lineWidth = 1.6 * k;
    ctx.beginPath();
    ctx.moveTo(x - 20 * k, y - 6 * k); ctx.lineTo(x - 9 * k, y - 4 * k);
    ctx.moveTo(x - 18 * k, y + 4 * k); ctx.lineTo(x - 8 * k, y + 3 * k);
    ctx.stroke();
    for (i = 0; i < 4; i++) {
      var a = now / 130 + i * Math.PI * 0.5 + b.wob;
      var bx = x + Math.cos(a) * 8 * k;
      var by = y + Math.sin(a * 1.3) * 6 * k;
      ctx.fillStyle = ref.wing;                      // 노란 몸통
      ctx.beginPath();
      ctx.ellipse(bx, by, 3.2 * k, 2.4 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ref.body;                      // 검은 줄과 머리
      ctx.fillRect(bx - 0.8 * k, by - 2.4 * k, 1.6 * k, 4.8 * k);
      ctx.beginPath();
      ctx.arc(bx - 3.4 * k, by, 1.6 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(240,246,250,0.65)';      // 날개
      ctx.beginPath();
      ctx.ellipse(bx + 0.5 * k, by - 3 * k, 3 * k, 1.2 * k, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function bugSpider(x, y, k, ref) {
    ctx.strokeStyle = ref.wing;
    ctx.lineWidth = 1.1 * k;
    ctx.lineCap = 'round';
    for (var i = 0; i < 4; i++) {
      var yy = y - 3 * k + i * 2.2 * k;
      var sp = 6 * k + i * 0.6 * k;
      ctx.beginPath();
      ctx.moveTo(x - 2 * k, yy);
      ctx.quadraticCurveTo(x - sp, yy - 4 * k, x - sp - 1.5 * k, yy + 3 * k);
      ctx.moveTo(x + 2 * k, yy);
      ctx.quadraticCurveTo(x + sp, yy - 4 * k, x + sp + 1.5 * k, yy + 3 * k);
      ctx.stroke();
    }
    ctx.fillStyle = ref.body;
    ctx.beginPath();
    ctx.ellipse(x, y + 1 * k, 4.4 * k, 5 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - 4.6 * k, 2.6 * k, 0, Math.PI * 2);
    ctx.fill();
  }


  /* ── 집 안 ────────────────────────────────────────────────
   * 마을과 **아주 다른 장면**이다. 하늘도 계절도 없고, 무엇보다 **휘지 않는다** —
   * 방은 평평한 3/4 시점이다. 원작도 그렇고, 그 차이가 "안에 들어왔다" 를 만든다.
   *
   * 방 전체가 늘 한 화면에 들어온다(카메라가 따라다니지 않는다). 그래서 어디에
   * 무엇을 놓을지 한눈에 보인다 — 꾸미는 놀이는 그게 있어야 성립한다.
   */
  var IN_TILT = 0.60;          // 실내의 내려다보는 각
  var IN_WALL = 118;           // 뒷벽 높이 (방 단위)
  var inSc = 1, inOx = 0, inOy = 0;

  function projIn(wx, wy) {
    return { x: inOx + wx * inSc, y: inOy + wy * IN_TILT * inSc };
  }
  function unprojIn(sx, sy) {
    return { x: (sx - inOx) / inSc, y: (sy - inOy) / (IN_TILT * inSc) };
  }

  function setupIn(rm) {
    var pad = 34;
    var sc = Math.min((W - pad * 2) / rm.w,
                      (H - pad * 2 - 80) / (IN_WALL + rm.h * IN_TILT));
    inSc = core.clamp(sc, 0.4, 3.2);
    inOx = (W - rm.w * inSc) * 0.5;
    inOy = (H - (rm.h * IN_TILT * inSc + IN_WALL * inSc)) * 0.5 + IN_WALL * inSc - 8;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawHomeScene(p, ph, now) {
    var Hm = global.DG.home;
    var rm = Hm.room();
    setupIn(rm);
    var u = inSc;
    var fw = rm.w * u, fh = rm.h * IN_TILT * u, wh = IN_WALL * u;
    var top = inOy - wh, T = V.TILE;

    /* 방 바깥 — 어스름한 마루 밑. 방이 화면 한가운데 떠 보이게 한다 */
    ctx.fillStyle = '#211a15';
    ctx.fillRect(0, 0, W, H);

    var wl = Hm.wallNow(), fl = Hm.floorNow();

    /* 뒷벽 — 고른 벽지에 나무 기둥 */
    ctx.fillStyle = wl.c;
    ctx.fillRect(inOx, top, fw, wh);
    var g = ctx.createLinearGradient(0, top, 0, top + wh);
    g.addColorStop(0, 'rgba(0,0,0,0.10)');
    g.addColorStop(0.6, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(inOx, top, fw, wh);

    ctx.fillStyle = wl.trim;                       // 위 도리와 아래 인방
    ctx.fillRect(inOx, top, fw, 9 * u);
    ctx.fillRect(inOx, inOy - 7 * u, fw, 7 * u);
    ctx.fillRect(inOx, top, 8 * u, wh);            // 좌우 기둥
    ctx.fillRect(inOx + fw - 8 * u, top, 8 * u, wh);

    /* 창 둘 — 문 좌우로 */
    var dr = Hm.door();
    var dx = inOx + dr.x * u;
    window_(dx - fw * 0.30, top + wh * 0.32, 42 * u, 30 * u);
    window_(dx + fw * 0.30, top + wh * 0.32, 42 * u, 30 * u);

    /* 문 — 미닫이 두 짝. 여기서 손을 쓰면 밖으로 나간다 */
    var dw = 62 * u, dh = wh * 0.66;
    var dtop = inOy - dh - 5 * u;
    ctx.fillStyle = wl.trim;
    ctx.fillRect(dx - dw * 0.5 - 3 * u, dtop - 3 * u, dw + 6 * u, dh + 6 * u);
    for (var s2 = 0; s2 < 2; s2++) {
      var px = dx - dw * 0.5 + s2 * dw * 0.5;
      ctx.fillStyle = '#f6efdd';
      ctx.fillRect(px, dtop, dw * 0.5, dh);
      ctx.strokeStyle = 'rgba(120,90,60,0.5)';
      ctx.lineWidth = 1.1 * u;
      for (var gx = 1; gx < 3; gx++) {
        ctx.beginPath();
        ctx.moveTo(px + (dw * 0.5 / 3) * gx, dtop);
        ctx.lineTo(px + (dw * 0.5 / 3) * gx, dtop + dh);
        ctx.stroke();
      }
      for (var gy = 1; gy < 4; gy++) {
        ctx.beginPath();
        ctx.moveTo(px, dtop + (dh / 4) * gy);
        ctx.lineTo(px + dw * 0.5, dtop + (dh / 4) * gy);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#6f4e30';
    ctx.fillRect(dx - 1.5 * u, dtop + dh * 0.42, 3 * u, dh * 0.18);

    /* 바닥 — 고른 장판. 칸 금은 아주 옅게 남긴다 (어디 놓을지 눈으로 재야 한다) */
    ctx.fillStyle = fl.a;
    ctx.fillRect(inOx, inOy, fw, fh);
    var ty;
    for (ty = 0; ty < rm.th; ty++) {
      if (ty % 2) { continue; }
      ctx.fillStyle = fl.b;
      ctx.fillRect(inOx, inOy + ty * T * IN_TILT * u, fw, T * IN_TILT * u);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 1;
    for (var tx = 1; tx < rm.tw; tx++) {
      ctx.beginPath();
      ctx.moveTo(inOx + tx * T * u, inOy);
      ctx.lineTo(inOx + tx * T * u, inOy + fh);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.16)';            // 벽 밑 그늘
    ctx.fillRect(inOx, inOy, fw, 5 * u);

    /* 놓인 것과 사람 — 방 좌표의 y 순서로 */
    var items = Hm.state().items;
    var order = [], i;
    for (i = 0; i < items.length; i++) { order.push({ y: items[i].y, t: 'f', o: items[i] }); }
    order.push({ y: p.y, t: 'me', o: p });
    order.sort(function (a, b) { return a.y - b.y; });

    var f = V.focus();
    for (i = 0; i < order.length; i++) {
      if (order[i].t === 'f') { drawFurn(order[i].o, f, now); }
      else { drawMeIn(order[i].o, now); }
    }

    /* 놓을 자리 — 지금 선 칸을 옅게 그려 준다 (심기와 같은 규칙이라 눈으로 보여야 한다) */
    var can = Hm.canPlaceHere();
    var ctx0 = Math.floor(p.x / T) * T, cty0 = Math.floor(p.y / T) * T;
    var a0 = projIn(ctx0, cty0), a1 = projIn(ctx0 + T, cty0 + T);
    ctx.strokeStyle = can.ok ? 'rgba(255,225,130,0.85)' : 'rgba(220,120,120,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(a0.x + 2, a0.y + 2, a1.x - a0.x - 4, a1.y - a0.y - 4);

    /* 문 앞에 서면 안내 */
    if (f && f.type === 'door') {
      bubble('밖으로 나간다 [' + core.actHint() + ']', dx, dtop - 14 * u, '#54402c', '#f7ecd8');
    }

    /* 시간대 빛 — 방 안에서도 밤은 밤이다. 등잔·화로가 있으면 그 언저리만 따뜻하다 */
    if (ph.light !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = ph.light;
      ctx.fillRect(0, 0, W, H);
      for (i = 0; i < items.length; i++) {
        var fd = VD.furn(items[i].key);
        if (!fd || (fd.form !== 'lamp' && fd.form !== 'brazier')) { continue; }
        var q = projIn(items[i].x, items[i].y);
        var lg = ctx.createRadialGradient(q.x, q.y - 14 * u, 0, q.x, q.y - 14 * u, 96 * u);
        lg.addColorStop(0, 'rgba(255,214,130,0.34)');
        lg.addColorStop(1, 'rgba(255,200,110,0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(q.x, q.y - 14 * u, 96 * u, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * 동굴 안 — home 의 실내 투영(setupIn/projIn/unprojIn)을 그대로 빌려 쓴다
   * (둘 다 "휘지 않는 평평한 방"이라 기계는 같다). 벽지·장판 갈아입히기가
   * 없는 만큼 훨씬 단순하다 — 바위 벽·바닥 한 벌뿐이고, 상자 셋과 문만 있다.
   */
  function drawCaveScene(p, now) {
    var rm = V.caveRoom();
    setupIn(rm);
    var u = inSc;
    var fw = rm.w * u, fh = rm.h * IN_TILT * u, wh = IN_WALL * u;
    var top = inOy - wh, T = V.TILE;

    ctx.fillStyle = '#0c0a08';
    ctx.fillRect(0, 0, W, H);

    /* 바위 벽 */
    ctx.fillStyle = '#3d372f';
    ctx.fillRect(inOx, top, fw, wh);
    var g = ctx.createLinearGradient(0, top, 0, top + wh);
    g.addColorStop(0, 'rgba(0,0,0,0.32)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(inOx, top, fw, wh);

    /* 문(입구) — 뒷벽 가운데 어두운 틈 */
    var dr = V.caveDoor();
    var dx = inOx + dr.x * u;
    var dw = 66 * u, dh = wh * 0.72;
    var dtop = inOy - dh - 5 * u;
    ctx.fillStyle = '#050403';
    ctx.fillRect(dx - dw * 0.5, dtop, dw, dh);

    /* 바닥 — 거친 돌바닥, 칸 금만 살짝 */
    ctx.fillStyle = '#4c463d';
    ctx.fillRect(inOx, inOy, fw, fh);
    var ty;
    for (ty = 0; ty < rm.th; ty++) {
      if (ty % 2) { continue; }
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(inOx, inOy + ty * T * IN_TILT * u, fw, T * IN_TILT * u);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(inOx, inOy, fw, 5 * u);

    /* 상자와 사람 — 방 좌표의 y 순서로. 보스방(2026-09-10) 이후 보스 상자도
       V.caveChests() 가 그대로 끼워 주므로 이 루프는 안 건드렸다 —
       가디언(👹)만 한 자리 더 그린다 */
    var chests = V.caveChests();
    var order = [], i;
    for (i = 0; i < chests.length; i++) { order.push({ y: chests[i].y, t: 'c', o: chests[i] }); }
    var bc = V.caveBossChest();
    order.push({ y: bc.y - 26, t: 'guard', o: bc });
    order.push({ y: p.y, t: 'me', o: p });
    order.sort(function (a, b) { return a.y - b.y; });

    var f = V.focus();
    for (i = 0; i < order.length; i++) {
      if (order[i].t === 'c') { drawChest(order[i].o, u); }
      else if (order[i].t === 'guard') { drawBossGuard(order[i].o, u); }
      else { drawMeIn(order[i].o, now); }
    }

    if (f && f.type === 'cavedoor') {
      bubble('밖으로 나간다 [' + core.actHint() + ']', dx, dtop - 14 * u, '#2a2622', '#e8dfce');
    }

    /* 어둑함 — 방 전체가 늘 밤이다(등잔이 없다) */
    ctx.fillStyle = 'rgba(8,6,4,0.38)';
    ctx.fillRect(0, 0, W, H);
  }

  /**
   * 보물상자 하나 — 이모지 대신 우편함·게시판(drawMailbox·drawBoard)과
   * 같은 결로 나무 궤·뚜껑·띠·자물쇠를 직접 그린다. 연 것은 뚜껑이 열린
   * 채 빛바래고, 보스 상자(bossChest, 2026-09-10)는 더 크고 금빛 띠로
   * 갈라 도드라지게 한다.
   * **2026-09-11(PLAN 46-2절)** — "동굴 보물상자를 실제 3D 모델로" 아이디어를
   * 조사하다, 동굴 안은 3D 자체를 안 그린다는 걸 확인했다(`indoorSuppressed()`
   * — 실내는 2D 전용). GLB를 갖다 놔도 안 쓰이므로, 대신 이 판의 다른
   * 소품들과 같은 방식(캔버스 직접 그리기)으로 "이모지 한 글자"보다 나은
   * 모습을 준다 — 새 에셋 없이 같은 목표(제대로 된 상자로 보이기)를 이뤘다.
   */
  function drawChest(c, u) {
    var q = projIn(c.x, c.y);
    var opened = V.chestOpened(c.id);
    var boss = c.id === 'bossChest';
    var s = (boss ? 1.35 : 1) * u;
    var bw = 30 * s, bh = 15 * s, lid = 11 * s;
    var bx = q.x - bw * 0.5, by = q.y - bh;

    shadow(q.x, q.y + 2 * s, (boss ? 20 : 16) * u, (boss ? 7 : 6) * u);

    ctx.save();
    ctx.globalAlpha = opened ? 0.55 : 1;

    var wood = boss ? '#8a5a20' : '#7a5230';
    var band = boss ? '#e8c04a' : '#4a3420';

    /* 몸통 */
    ctx.fillStyle = wood;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(bx, by + bh - 3 * s, bw, 3 * s);

    /* 뚜껑 — 열렸으면 뒤로 젖혀진 모양, 안 열렸으면 몸통 위에 반원으로 얹힌다 */
    ctx.fillStyle = wood;
    ctx.beginPath();
    if (opened) {
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + bw * 0.15, by - lid * 1.3, bx + bw * 0.55, by - lid * 1.1);
      ctx.lineTo(bx + bw * 0.78, by - lid * 0.25);
      ctx.lineTo(bx, by);
    } else {
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(q.x, by - lid, bx + bw, by);
    }
    ctx.closePath();
    ctx.fill();

    /* 테두리 띠 — 몸통 가운데 세로 둘, 보스는 금빛 */
    ctx.fillStyle = band;
    ctx.fillRect(bx + bw * 0.26, by, 2.6 * s, bh);
    ctx.fillRect(bx + bw * 0.74 - 2.6 * s, by, 2.6 * s, bh);

    /* 자물쇠 — 안 열렸을 때만 */
    if (!opened) {
      ctx.fillStyle = band;
      ctx.fillRect(q.x - 3 * s, by + bh * 0.32, 6 * s, 6 * s);
    }

    ctx.restore();
  }

  /** 보스방 가디언(포자대왕, 2026-09-10) — 순전히 장식이다(새 전투 없음).
   *  상자 셋을 다 열기 전엔 위압적으로 서 있고, 다 열면 길을 내준 듯 흐려진다 */
  function drawBossGuard(bc, u) {
    var q = projIn(bc.x, bc.y - 42);
    var unlocked = V.bossUnlocked();
    shadow(q.x, q.y + 6 * u, 22 * u, 7 * u);
    ctx.font = Math.round(46 * u) + 'px "Segoe UI Emoji", system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = unlocked ? 0.45 : 1;
    ctx.fillText('👹', q.x, q.y + 10 * u);
    ctx.globalAlpha = 1;
    if (!unlocked) {
      bubble('포자대왕이 지키고 있다', q.x, q.y - 40 * u, '#3a1414', '#ffe2d8');
    }
  }

  /** 창호 창 하나 */
  function window_(cx, cy, w, h) {
    ctx.fillStyle = global.DG.home.wallNow().trim;
    ctx.fillRect(cx - w * 0.5 - 2, cy - h * 0.5 - 2, w + 4, h + 4);
    ctx.fillStyle = '#f7f2e2';
    ctx.fillRect(cx - w * 0.5, cy - h * 0.5, w, h);
    ctx.strokeStyle = 'rgba(120,90,60,0.45)';
    ctx.lineWidth = 1.1;
    for (var i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.5 + (w / 3) * i, cy - h * 0.5);
      ctx.lineTo(cx - w * 0.5 + (w / 3) * i, cy + h * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.5, cy - h * 0.5 + (h / 3) * i);
      ctx.lineTo(cx + w * 0.5, cy - h * 0.5 + (h / 3) * i);
      ctx.stroke();
    }
  }

  function drawMeIn(p0, now) {
    var q = projIn(p0.x, p0.y);
    var k = core.clamp(inSc * 0.95, 0.65, 1.9);
    var me = meStamp();
    shadow(q.x, q.y + 2 * k, 14 * k, 5 * k);
    if (!(global.DG.actor2d && global.DG.actor2d.draw(ctx, 'me', me.ref, 'me', q.x, q.y, k, { facing: p0.facing, dirX: p0.dirX, dirY: p0.dirY, moving: p0.walking, phase: p0.phase, now: now }))) global.DG.sprite.stamp(ctx, {
      kind: 'human', ref: me.ref, x: q.x, y: q.y, s: k,
      facing: p0.facing, phase: p0.phase, walking: p0.walking,
      color: me.color, look: me.look,
      rarity: me.rarity, t: now
    });
  }

  /* ── 가구 ─────────────────────────────────────────────────
   * 이모지가 아니라 도형이다 — 마을의 사물과 같은 규칙이다.
   * 치수는 방 단위(한 칸 40)로 적고 inSc 로 함께 커진다.
   */
  function drawFurn(item, f, now) {
    var d = VD.furn(item.key);
    if (!d) { return; }
    var q = projIn(item.x, item.y);
    var u = inSc;
    var focused = f && f.type === 'furn' && f.obj === item;

    shadow(q.x, q.y + 2 * u, 15 * u, 5 * u);
    var set = VD.FURN_SETS[d.set] || { color: '#a07850' };
    switch (d.form) {
      case 'table':    furnTable(q.x, q.y, u, d); break;
      case 'chest':    furnChest(q.x, q.y, u, d); break;
      case 'vase':     furnVase(q.x, q.y, u, d); break;
      case 'screen':   furnScreen(q.x, q.y, u); break;
      case 'scroll':   furnScroll(q.x, q.y, u); break;
      case 'brazier':  furnBrazier(q.x, q.y, u, now); break;
      case 'lamp':     furnLamp(q.x, q.y, u, now); break;
      case 'plant':    furnPlant(q.x, q.y, u); break;
      case 'cushion':  furnCushion(q.x, q.y, u, set); break;
      case 'bedding':  furnBedding(q.x, q.y, u, set); break;
      default:         furnGayageum(q.x, q.y, u); break;
    }
    if (focused) {
      ring(q.x, q.y + 2 * u, u * 0.8, 'rgba(255,206,92,.95)');
      var actLabel = d.bed ? '잠든다' : '거둔다';
      bubble(d.name + ' — ' + actLabel + ' [' + core.actHint() + ']', q.x, q.y - 52 * u, '#8a5a10', '#fff0c9');
    }
  }

  function furnTable(x, y, u, d) {
    var w = d.key === 'badukpan' ? 28 : 24;
    ctx.fillStyle = '#7a5030';
    ctx.fillRect(x - w * 0.42 * u, y - 8 * u, 3 * u, 8 * u);
    ctx.fillRect(x + w * 0.42 * u - 3 * u, y - 8 * u, 3 * u, 8 * u);
    ctx.fillStyle = '#b5793f';
    roundRect(x - w * 0.5 * u, y - 15 * u, w * u, 8 * u, 3 * u);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(x - w * 0.5 * u + 2 * u, y - 14 * u, w * u - 4 * u, 2.6 * u, 1.2 * u);
    ctx.fill();
    if (d.key === 'badukpan') {                     /* 바둑판 — 줄까지 긋는다 */
      ctx.strokeStyle = 'rgba(60,40,20,0.45)';
      ctx.lineWidth = 0.8 * u;
      for (var i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(x - w * 0.5 * u + (w * u / 5) * i, y - 14.4 * u);
        ctx.lineTo(x - w * 0.5 * u + (w * u / 5) * i, y - 7.6 * u);
        ctx.stroke();
      }
    }
  }

  function furnChest(x, y, u, d) {
    var h = d.key === 'bandaji' ? 24 : 20;
    ctx.fillStyle = '#8a5a34';
    roundRect(x - 14 * u, y - h * u, 28 * u, h * u, 2 * u);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(x - 14 * u, y - h * 0.42 * u, 28 * u, 1.6 * u);
    ctx.fillStyle = '#c8a25c';                      /* 장석 */
    ctx.fillRect(x - 3 * u, y - h * 0.52 * u, 6 * u, 5 * u);
    ctx.beginPath();
    ctx.arc(x, y - h * 0.30 * u, 2.4 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x - 14 * u, y - h * u, 28 * u, 2.4 * u);
  }

  function furnVase(x, y, u, d) {
    var tall = d.key === 'mulhang' ? 22 : 26;
    ctx.beginPath();
    ctx.moveTo(x - 4 * u, y - tall * u);
    ctx.quadraticCurveTo(x - 13 * u, y - tall * 0.62 * u, x - 9 * u, y - 2 * u);
    ctx.lineTo(x + 9 * u, y - 2 * u);
    ctx.quadraticCurveTo(x + 13 * u, y - tall * 0.62 * u, x + 4 * u, y - tall * u);
    ctx.closePath();
    ctx.fillStyle = d.key === 'mulhang' ? '#8a6a4a' : '#dfe6e2';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(x - 4 * u, y - tall * 0.52 * u, 2.2 * u, 6 * u, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,90,110,0.35)';
    ctx.lineWidth = 1 * u;
    ctx.beginPath();
    ctx.ellipse(x, y - tall * u, 4 * u, 1.6 * u, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function furnScreen(x, y, u) {
    var pw = 12, ph2 = 34;
    for (var i = -1; i <= 1; i++) {
      var px = x + i * pw * 0.94 * u;
      var lean = Math.abs(i) * 2 * u;
      ctx.fillStyle = '#6f4e30';
      ctx.fillRect(px - pw * 0.5 * u, y - ph2 * u + lean, pw * u, ph2 * u - lean);
      ctx.fillStyle = '#efe4cc';
      ctx.fillRect(px - pw * 0.5 * u + 1.6 * u, y - ph2 * u + lean + 1.6 * u,
                   pw * u - 3.2 * u, ph2 * u - lean - 3.2 * u);
      ctx.strokeStyle = 'rgba(70,90,80,0.45)';      /* 산수 몇 획 */
      ctx.lineWidth = 1 * u;
      ctx.beginPath();
      ctx.moveTo(px - 3 * u, y - ph2 * 0.42 * u);
      ctx.quadraticCurveTo(px, y - ph2 * 0.62 * u, px + 3 * u, y - ph2 * 0.40 * u);
      ctx.stroke();
    }
  }

  function furnScroll(x, y, u) {
    ctx.fillStyle = '#6f4e30';                      /* 걸이 */
    ctx.fillRect(x - 1.5 * u, y - 12 * u, 3 * u, 12 * u);
    ctx.fillRect(x - 9 * u, y - 2 * u, 18 * u, 2.4 * u);
    ctx.fillRect(x - 8 * u, y - 34 * u, 16 * u, 2.6 * u);
    ctx.fillStyle = '#f4ecd8';
    ctx.fillRect(x - 6.5 * u, y - 32 * u, 13 * u, 20 * u);
    ctx.fillStyle = '#6f4e30';
    ctx.fillRect(x - 8 * u, y - 12.6 * u, 16 * u, 2.2 * u);
    ctx.strokeStyle = 'rgba(60,50,40,0.55)';        /* 글씨 한 줄 */
    ctx.lineWidth = 1.1 * u;
    ctx.beginPath();
    ctx.moveTo(x, y - 29 * u); ctx.lineTo(x, y - 16 * u);
    ctx.stroke();
  }

  function furnBrazier(x, y, u, now) {
    ctx.strokeStyle = '#5a4436';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(x - 7 * u, y - 6 * u); ctx.lineTo(x - 9 * u, y);
    ctx.moveTo(x + 7 * u, y - 6 * u); ctx.lineTo(x + 9 * u, y);
    ctx.stroke();
    ctx.fillStyle = '#7a6a5a';
    roundRect(x - 11 * u, y - 16 * u, 22 * u, 11 * u, 3 * u);
    ctx.fill();
    ctx.fillStyle = '#3a2a20';
    ctx.beginPath();
    ctx.ellipse(x, y - 16 * u, 10 * u, 3.4 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    var fl = 0.8 + Math.abs(Math.sin(now / 180)) * 0.5;
    ctx.fillStyle = 'rgba(255,150,60,0.9)';
    ctx.beginPath();
    ctx.ellipse(x, y - 18 * u, 5 * u, 4 * u * fl, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,225,140,0.9)';
    ctx.beginPath();
    ctx.ellipse(x, y - 18 * u, 2.4 * u, 2.2 * u * fl, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function furnLamp(x, y, u, now) {
    ctx.fillStyle = '#6a5a48';
    ctx.beginPath();
    ctx.ellipse(x, y - 2 * u, 7 * u, 2.6 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 1.6 * u, y - 22 * u, 3.2 * u, 20 * u);
    ctx.fillStyle = '#8a7a64';
    ctx.beginPath();
    ctx.ellipse(x, y - 23 * u, 7 * u, 2.8 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    var fl = 0.75 + Math.abs(Math.sin(now / 220)) * 0.45;
    ctx.fillStyle = 'rgba(255,200,110,0.95)';
    ctx.beginPath();
    ctx.moveTo(x, y - 34 * u * fl);
    ctx.quadraticCurveTo(x + 3.4 * u, y - 26 * u, x, y - 24 * u);
    ctx.quadraticCurveTo(x - 3.4 * u, y - 26 * u, x, y - 34 * u * fl);
    ctx.fill();
  }

  function furnPlant(x, y, u) {
    ctx.fillStyle = '#a8613c';
    ctx.beginPath();
    ctx.moveTo(x - 8 * u, y - 12 * u);
    ctx.lineTo(x + 8 * u, y - 12 * u);
    ctx.lineTo(x + 6 * u, y);
    ctx.lineTo(x - 6 * u, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c07349';
    ctx.fillRect(x - 9 * u, y - 14 * u, 18 * u, 3 * u);
    ctx.fillStyle = '#4f9a44';
    for (var i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(x + i * 6 * u, y - 22 * u - Math.abs(i) * -2 * u,
        4 * u, 9 * u, i * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function furnCushion(x, y, u, set) {
    ctx.fillStyle = set.color;
    roundRect(x - 13 * u, y - 8 * u, 26 * u, 9 * u, 3.5 * u);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    roundRect(x - 11 * u, y - 7 * u, 22 * u, 3 * u, 1.5 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,200,0.7)';      /* 술 */
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath();
    ctx.moveTo(x - 13 * u, y - 3 * u); ctx.lineTo(x - 16 * u, y - 1 * u);
    ctx.moveTo(x + 13 * u, y - 3 * u); ctx.lineTo(x + 16 * u, y - 1 * u);
    ctx.stroke();
  }

  /** §5.1 침구(요) — 넓게 편 요 위에 개켜 둔 이불, 머리맡에 베개 */
  function furnBedding(x, y, u, set) {
    ctx.fillStyle = set.color;
    roundRect(x - 20 * u, y - 9 * u, 40 * u, 11 * u, 4 * u);
    ctx.fill();
    ctx.fillStyle = '#f4ece0';                        /* 베개 */
    roundRect(x - 20 * u, y - 16 * u, 13 * u, 8 * u, 2.5 * u);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';         /* 개켜 둔 이불 */
    roundRect(x + 1 * u, y - 12 * u, 18 * u, 6 * u, 2 * u);
    ctx.fill();
  }

  function furnGayageum(x, y, u) {
    ctx.fillStyle = '#a8763f';
    ctx.beginPath();
    ctx.moveTo(x - 20 * u, y - 6 * u);
    ctx.quadraticCurveTo(x, y - 13 * u, x + 20 * u, y - 7 * u);
    ctx.lineTo(x + 19 * u, y - 1 * u);
    ctx.quadraticCurveTo(x, y - 7 * u, x - 19 * u, y - 1 * u);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(250,240,220,0.75)';
    ctx.lineWidth = 0.8 * u;
    for (var i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 19 * u, y - 5 * u + i * 1.1 * u);
      ctx.quadraticCurveTo(x, y - 11 * u + i * 1.1 * u, x + 19 * u, y - 6 * u + i * 1.1 * u);
      ctx.stroke();
    }
    ctx.fillStyle = '#6a4a2c';
    for (var j = -1; j <= 1; j++) {
      ctx.fillRect(x + j * 9 * u, y - 9 * u, 2 * u, 5 * u);
    }
  }


