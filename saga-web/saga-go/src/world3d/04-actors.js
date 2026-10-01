  /* ── 배우 (사람 · 짐승 · 건물) ───────────────────────────
   * `actor3d.js` 가 도형으로 조립한 입체를 세운다. 조립이 안 되면(three 가 없거나
   * 손잡이를 껐으면) 1단계의 빌보드로 돌아간다 — 그림은 `sprite.js` 것을 그대로 쓴다.
   */
  function spriteTexture(kind, ref, px) {
    var key = kind + '/' + (ref.id || ref.key || ref.name) + '/' + px + '/flat';
    if (texCache[key]) { return texCache[key]; }
    /* 네 번째 인자가 **종이 바탕 없이** 굽게 한다 — 3D 에서는 배경이 사각형으로 남는다 */
    var url = global.DG.sprite.portrait(kind, ref, px, true);
    var img = new Image();
    var tex = new T.Texture(img);
    tex.colorSpace = T.SRGBColorSpace;
    img.onload = function () { tex.needsUpdate = true; };
    img.src = url;
    texCache[key] = tex;
    return tex;
  }

  var shadowGeo = null, shadowMat = null;
  function groundShadow() {
    if (!shadowGeo) {
      shadowGeo = new T.CircleGeometry(1, 18);
      shadowMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false });
    }
    var m = new T.Mesh(shadowGeo, shadowMat);
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  /** 배우 하나 — 있으면 쓰고 없으면 만든다 */
  /** 같은 자리(key)에 다른 사람이 서야 하면 옛 배우를 치운다 — actorOf 는 key 로만 캐시한다 */
  function dropActorIfNot(key, who) {
    var a = actors[key];
    if (!a || a.who === undefined || a.who === who) { return; }
    actorGroup.remove(a.node);
    actorGroup.remove(a.shadow);
    delete actors[key];
  }

  function actorOf(key, kind, ref, px) {
    var a = actors[key];
    if (a) { a.seen = frame; return a; }
    var A = global.DG.actor3d;
    var node = null, mesh = false;
    if (MESH_ON() && A && A.ready()) {
      node = A.build(kind === 'building' ? (ref.key === 'wall' ? 'fort' : (ref.key === 'landmark' ? 'landmark' : 'station')) : kind, ref);
      mesh = !!node;
    }
    if (!node) {
      var mat = new T.SpriteMaterial({ map: spriteTexture(kind, ref, px), transparent: true });
      node = new T.Sprite(mat);
    }
    var sh = groundShadow();
    actorGroup.add(node); actorGroup.add(sh);
    a = actors[key] = {
      node: node, shadow: sh, seen: frame, mesh: mesh, kind: kind,
      /* 처음에는 카메라를 등지고 선다(북쪽). 마주 보고 서 있으면 지도 위의 내가
         나를 쳐다보는 꼴이 된다 — 원작은 늘 아바타의 뒤통수를 본다 */
      ang: Math.PI, lx: null, ly: null, vanish: 0
    };
    return a;
  }

  /**
   * 배우를 자리에 놓는다.
   *   h     키(m)
   *   bob   위아래 흔들림(빌보드용 — 메시는 자기 다리로 걷는다)
   *   walk  걷는 중인가
   */
  /**
   * 멀리 있는 배우는 **원근 그대로 두면 점**이다. 이 판의 야생 대상은 70~320m 밖에
   * 서므로(원작은 코앞에 나온다) 줌을 빼도 안 보인다. 거리에 따라 조금씩 키워
   * 지도 위의 표식처럼 남게 한다 — 크기는 화면 값이라 판정에 안 닿는다.
   */
  function farBoost(x, y) {
    if (!camPos) { return 1; }
    var d = Math.hypot(x - camPos.x, y - camPos.z);
    if (d < FAR_NEAR) { return 1; }
    /* 지수가 1 이면 **화면에서 같은 크기**로 유지된다(원근을 완전히 무른다).
       0.85 는 거의 유지하되 멀수록 아주 조금 작아 보이게 남긴 값이다 —
       완전히 무르면 3D 공간의 깊이가 사라진다 */
    return Math.min(FAR_MAX, Math.pow(d / FAR_NEAR, 0.85));
  }

  function placeActor(a, x, y, h, bob, walk, phase, now) {
    /* **땅에 앉힌다.** 땅이 굽었으므로 y=0 에 세우면 산에서는 발이 묻히고
       골짜기에서는 허공에 뜬다(PLAN 14절) */
    var gy0 = groundY(x, y) + skyLift(x, y, a.sky);        // ⑲-20 섬 층이면 섬 윗면
    if (a.mesh) {
      a.node.scale.set(h, h, h);
      a.node.position.set(x, gy0, y);
      /* 방향 — 지난 프레임과의 차이로 정한다. 판정에는 방향이 없으니
         (world.js 는 좌표만 준다) 화면 층에서 만들어 쓴다 */
      if (a.lx !== null) {
        var dx = x - a.lx, dz = y - a.ly;
        if (dx * dx + dz * dz > 0.0004) {
          var want = Math.atan2(dx, dz);
          var diff = want - a.ang;
          while (diff > Math.PI) { diff -= Math.PI * 2; }
          while (diff < -Math.PI) { diff += Math.PI * 2; }
          a.ang += diff * 0.22;                 // 홱 돌지 않고 미끄러지듯 돈다
        }
      }
      a.lx = x; a.ly = y;
      a.node.rotation.y = a.ang;
      /* 교전 몸짓(`playAnim`) 이 걸려 있으면 그 자리 이름을 준다 — 끝나면
         (`animUntil` 지나면) 도로 걷기/서기로 돌아간다. 클립이 없으면
         `asset3d.play` 가 조용히 실패하니 여기서 따로 안 가른다 */
      var animNow = (a.animUntil && now < a.animUntil) ? a.animName : undefined;
      global.DG.actor3d.step(a.node, { t: now / 1000, walking: walk, phase: phase, anim: animNow });
    } else {
      a.node.scale.set(h, h, 1);
      a.node.position.set(x, gy0 + h / 2 + (bob || 0), y);
    }
    a.shadow.position.set(x, gy0 + 0.06, y);
    a.shadow.scale.setScalar(h * 0.30);
  }

  /** 목표점을 향해 매 프레임 조금씩 다가간다 — 배우 객체(`a`)에 `fx`/`fy` 로
   *  마지막 자리를 적어 둬 다음 프레임도 이어 쓴다. 순간이동이 아니라
   *  **뒤에서 따라오는** 느낌을 내는 전부다(레이스 게임의 카메라 lerp와 같다) */
  function followPos(a, tx, ty, rate) {
    if (a.fx === undefined) { a.fx = tx; a.fy = ty; }
    a.fx += (tx - a.fx) * rate;
    a.fy += (ty - a.fy) * rate;
    return { x: a.fx, y: a.fy };
  }

  /**
   * 동행(부대 2번째 인물)·펫(선두가 장착한 것) — **실제로 곁에서 따라다닌다**
   * (2026-09-06, "펫도 따라다니고 등용한 인물도 따라 다니고" 요청). 전투력은
   * 이미 `hero.partyPower()`(hero.js)가 부대 전체를 합산해 판정에 넣고 있으니
   * 여기서 새로 더할 것이 없다 — 이 함수는 순전히 화면 층이다.
   *
   *   탐험 중  플레이어 뒤쪽으로 처져서 트레일링(동행·펫이 서로 다른 자리)
   *   교전 중  플레이어 옆에 나란히 서서 같이 상대를 본다(`duelFoe` 기준
   *            좌우로 갈라선다 — 축을 `meAng` 대신 "나→적" 벡터로 잡아야
   *            내가 예고를 피하려고 옆으로 물러나도 대형이 안 흐트러진다)
   */
  function syncBuddies(pos, meAng, h, now) {
    var party = core.save.party || [];
    var FCb = global.DG.fieldCombat, fcLead = FCb && FCb.leadId();
    var allyId = fcLead && fcLead === party[1] ? party[0] : party[1];
    var petEquip = core.save.petEquip || {};
    var petId = party[0] ? petEquip[party[0]] : null;
    if (!allyId && !petId) { return; }

    var backX = -Math.sin(meAng), backY = -Math.cos(meAng);
    var sideX = Math.cos(meAng), sideY = -Math.sin(meAng);
    if (duelFoe) {
      var fdx = duelFoe.x - pos.x, fdy = duelFoe.y - pos.y;
      var flen = Math.hypot(fdx, fdy) || 1;
      sideX = -fdy / flen; sideY = fdx / flen;   // 나→적 축에 수직
    }

    if (allyId) {
      var allyRef = global.DG.data.find(allyId);
      if (allyRef) {
        dropActorIfNot('ally', allyRef.id);
        var aa = actorOf('ally', 'hero', allyRef, 96);
        aa.who = allyRef.id; aa.sky = meSky();
        var atx = duelFoe ? pos.x + sideX * 1.5 : pos.x + backX * 2.2 + sideX * 0.9;
        var aty = duelFoe ? pos.y + sideY * 1.5 : pos.y + backY * 2.2 + sideY * 0.9;
        var af = followPos(aa, atx, aty, duelFoe ? 0.12 : 0.06);
        var amoved = aa.lx === null || Math.hypot(af.x - aa.lx, af.y - aa.ly) > 0.01;
        placeActor(aa, af.x, af.y, h * farBoost(af.x, af.y), 0, amoved, now / 480, now);
        if (duelFoe && aa.mesh) {
          var aax = duelFoe.x - af.x, aaz = duelFoe.y - af.y;
          aa.node.rotation.y = Math.atan2(aax, aaz);
          aa.ang = aa.node.rotation.y;
        }
      }
    }

    if (petId) {
      var petRef = global.DG.data.find(petId);
      if (petRef) {
        var pa = actorOf('petbuddy', 'pet', petRef, 96);
        pa.sky = meSky();
        var ptx = duelFoe ? pos.x - sideX * 1.5 : pos.x + backX * 1.4 - sideX * 0.8;
        var pty = duelFoe ? pos.y - sideY * 1.5 : pos.y + backY * 1.4 - sideY * 0.8;
        var pf = followPos(pa, ptx, pty, duelFoe ? 0.12 : 0.08);
        var pmoved = pa.lx === null || Math.hypot(pf.x - pa.lx, pf.y - pa.ly) > 0.01;
        placeActor(pa, pf.x, pf.y, h * 0.6 * farBoost(pf.x, pf.y), 0, pmoved, now / 380, now);
        if (duelFoe && pa.mesh) {
          var ppx = duelFoe.x - pf.x, ppz = duelFoe.y - pf.y;
          pa.node.rotation.y = Math.atan2(ppx, ppz);
          pa.ang = pa.node.rotation.y;
        }
      }
    }
  }

  /** 사라지는 배우 — 잡혔거나 달아났다. 빛으로 흩어지며 지워진다 */
  function sweepActors(dt) {
    for (var k in actors) {
      if (!Object.prototype.hasOwnProperty.call(actors, k)) { continue; }
      var a = actors[k];
      if (a.seen === frame) { continue; }
      /* 무대에 선 상대는 판정에서 이미 사라졌더라도(잡혔다·달아났다) 무대가 닫힐
         때까지 그 자리에 세워 둔다 — 던진 것이 날아가는 중에 상대가 먼저 없어지면
         허공에 사료를 던지는 그림이 된다 */
      if (stageAt && k === 'sp' + stageAt.uid) { a.seen = frame; continue; }
      /* 곧바로 지우면 잡은 순간 상대가 **점멸하듯** 없어진다. 원작은 잡히는 순간을
         보여 준다 — 여기서는 떠오르며 작아지는 0.7초를 둔다 */
      a.vanish += dt;
      var t = Math.min(1, a.vanish / 0.7);
      a.node.position.y += dt * 2.4;
      a.node.scale.multiplyScalar(1 - dt * 1.1);
      a.shadow.scale.multiplyScalar(1 - dt * 2.2);
      if (t >= 1) {
        actorGroup.remove(a.node);
        actorGroup.remove(a.shadow);
        delete actors[k];
      }
    }
  }

  /* ── 지도 위 동행 모션 — 교체 연출(PLAN §5 ⑭) ─────────────────────────
   * 들판 전투에서 교체하면(`fieldCombat.leadId()` 가 바뀌면) 예전엔 옛 몸을 지우고 새 몸이
   * 그 자리에 뚝 섰다. 이제 옛 몸은 지우지 않고 'swapout' 으로 옮겨 옆뒤로 물러나게 한 뒤
   * (`sweepActors` 의 떠오르며 흩어지기로) 사라지고, 새 몸은 곁(옆 1.6m)에서 걸어 나와
   * 제자리에 선다. 판정·카메라는 그대로 `pos` — 화면 층만 움직인다 */
  var SWAP_IN_MS = 350, SWAP_OUT_MS = 600, SWAP_LIFE_MS = 900, SWAP_SIDE = 1.6, SWAP_BACK = 2.4;
  /** 순수 함수 — 교체 뒤 ms 에 새 몸이 옆으로 남은 거리·옛 몸이 물러난 거리 */
  function swapMotion(ms) {
    var i = Math.max(0, Math.min(1, ms / SWAP_IN_MS)), o = Math.max(0, Math.min(1, ms / SWAP_OUT_MS));
    function ease(k) { return 1 - (1 - k) * (1 - k); }
    return { inSide: SWAP_SIDE * (1 - ease(i)), outBack: SWAP_BACK * ease(o), done: ms >= SWAP_LIFE_MS };
  }
  var lastLead = null, swapFx = null;

  /**
   * 활공 날개(§5 ⑰ 다음) — 저장소에 CC0 날개 에셋이 없어 **코드로** 짓는다(SAGA-DESIGN §7 허용):
   * 머리 위 천 두 장이 V 자로 벌어진 모양, 한 번 지어 두고 켜고 끈다. 판정에는 안 닿는다
   */
  var gliderMesh = null;
  function gliderOf() {
    if (gliderMesh) { return gliderMesh; }
    var g = new T.BufferGeometry();
    /* 가운데 막대(0,0,±0.3)에서 좌우 끝(±1.6)으로, 끝이 조금 올라가고 뒤로 처진다 */
    var v = new Float32Array([
      0, 0, 0.35, -1.6, 0.35, -0.25, 0, 0, -0.45,
      0, 0, 0.35, 0, 0, -0.45, 1.6, 0.35, -0.25
    ]);
    g.setAttribute('position', new T.BufferAttribute(v, 3));
    g.computeVertexNormals();
    var m = new T.MeshLambertMaterial({ color: 0xe8dcc0, side: T.DoubleSide });
    gliderMesh = new T.Mesh(g, m);
    gliderMesh.visible = false;
    actorGroup.add(gliderMesh);
    return gliderMesh;
  }
  function syncGlider(meA, on, x, y, air, h) {
    if (!on && !gliderMesh) { return; }
    var gm = gliderOf();
    gm.visible = !!on && air > 0.05;
    if (!gm.visible) { return; }
    var s = Math.max(1, h / 1.7);
    gm.scale.set(s, s, s);
    gm.position.set(x, standY(x, y) + air + h * 1.12, y);
    gm.rotation.y = meA.ang || 0;
  }

  function syncActors(W, now) {
    var pos = core.save.player.pos;

    /* 나 — 동행 선두가 지도 위 내 모습이다(2D 화면과 같은 규칙) */
    /* 들판 전투(§5 ⑨)에서 교체하면 지도 위 내 모습도 그 사람으로 바뀐다 */
    var FCd = global.DG.fieldCombat;
    var lead = (FCd && FCd.leadId()) || (core.save.party && core.save.party[0]);
    var me = lead ? global.DG.data.find(lead) : null;
    var meRef = me || { id: '_me', name: '나', faction: '조선', rarity: 3, trait: 'virtue' };
    if (lastLead !== null && meRef.id !== lastLead && actors.me && actors.me.who === lastLead) {
      if (actors.swapout) { actorGroup.remove(actors.swapout.node); actorGroup.remove(actors.swapout.shadow); }
      actors.swapout = actors.me;                       // 옛 몸을 지우지 않고 넘긴다 — 다시 안 짓는다
      delete actors.me;
      swapFx = { t0: now, ang: actors.swapout.ang || 0, x: pos.x, y: pos.y };
    }
    lastLead = meRef.id;
    dropActorIfNot('me', meRef.id);
    var meA = actorOf('me', 'hero', meRef, 96);
    meA.who = meRef.id;
    var mot = W.motion;
    var h = ACTOR_H();
    var walking = mot.speed > 1.5;
    var MTr = global.DG.mount, mtRef = MTr && MTr.petRef ? MTr.petRef() : null;   // ⑲-61 탄 말 — 몸은 말이 걷고 나는 위에 앉는다
    var walkBob = walking
      ? Math.abs(Math.sin(mot.phase)) * h * 0.045
      : Math.sin(now / 700) * h * 0.016;
    /* 나에게도 같은 보정을 준다 — 안 그러면 크게 당겼을 때 **나만 점**이 되고
       야생 대상이 나보다 크게 보인다 */
    var mx = pos.x, my = pos.y;
    if (swapFx) {
      var sm = swapMotion(now - swapFx.t0);
      var sx = Math.cos(swapFx.ang), sy = -Math.sin(swapFx.ang), bx = -Math.sin(swapFx.ang), by = -Math.cos(swapFx.ang);
      mx += sx * sm.inSide; my += sy * sm.inSide;
      var so = actors.swapout;
      if (so && !sm.done) {
        so.seen = frame; so.sky = meSky();
        var ox = swapFx.x + bx * sm.outBack - sx * sm.outBack * 0.35, oy = swapFx.y + by * sm.outBack - sy * sm.outBack * 0.35;
        placeActor(so, ox, oy, h * farBoost(ox, oy), 0, sm.outBack < SWAP_BACK - 1e-3, now / 480, now);
      }
      if (sm.done) { swapFx = null; }             // 이제 swapout 은 안 먹여져 sweepActors 가 흩어 지운다
      walking = walking || sm.inSide > 0.05;
    }
    /* §5 ⑰ 점프 — 뛰어오른 높이만큼 몸을 띄우고 jump 몸짓(없으면 asset3d 가 idle 로 물러난다) */
    var LFa = global.DG.landform, air = LFa ? LFa.airH() : 0;
    if (air > 0) { meA.animName = 'jump'; meA.animUntil = now + 120; }
    meA.sky = meSky();
    placeActor(meA, mx, my, h * farBoost(mx, my), walkBob + air, walking && !air && !mtRef, mot.phase, now);
    if (air > 0 && meA.mesh) { meA.node.position.y += air; }
    if (mtRef) {                                                                     // ⑲-61 말 — 같은 자리·같은 걸음, 나는 등 높이로
      var mtA = actorOf('mount', 'pet', mtRef, 96);
      mtA.sky = meSky();
      var mtAlt = MTr.altitude ? MTr.altitude() : 0, fl = mtAlt >= MTr.AIR_MIN;
      placeActor(mtA, mx, my, h * farBoost(mx, my) * MTr.SCALE, 0, (walking || fl) && !air, mot.phase, now);
      if (fl && mtA.mesh) { mtA.node.position.y += mtAlt + Math.sin(now / 260) * 0.25; }   // ⑲-62 뜬 높이 — 날갯짓에 맞춰 살짝 출렁
      if (meA.mesh) { meA.node.position.y += h * farBoost(mx, my) * MTr.RIDER_LIFT + (fl ? mtAlt + Math.sin(now / 260) * 0.25 : 0); }
    }
    /* ⑰ 여울 다리 — 상판 위면 몸을 상판 높이에 세운다(땅은 물 바닥이라 안 올리면 다리 밑을 걷는다) */
    var deck = LFa && LFa.deckAt ? LFa.deckAt(mx, my) : null;
    if (deck !== null && meA.mesh && !air) {
      var gyMe = groundY(mx, my);
      if (deck > gyMe) { meA.node.position.y += deck - gyMe; }
    }
    syncGlider(meA, LFa && LFa.gliding && LFa.gliding(), mx, my, air, h);
    /* ⑲-22 조준 중엔 몸이 겨눈 쪽을 본다 */
    var FCme = global.DG.fieldCombat, AVme = FCme && FCme.aimView ? FCme.aimView() : null;
    if (AVme && meA.mesh) { meA.ang = Math.atan2(AVme.dx, AVme.dy); meA.node.rotation.y = meA.ang; }
    /* ⑲-13 대화 — 나는 대화 상대를 돌아보고, 내 줄(고른 대답)이면 손짓·입. 깜박임은 늘(talkface.js) */
    var TSm = talkShot(), TFm = global.DG.talkface;
    var tdt = talkNow ? Math.min(0.1, Math.max(0, (now - talkNow) / 1000)) : 0;
    talkNow = now;
    if (TSm && meA.mesh) {
      var npq = TSm.who === 'me' ? TSm.lst : TSm.spk;
      var mdd = Math.atan2(npq.x - mx, npq.y - my) - meA.ang;
      meA.ang += Math.atan2(Math.sin(mdd), Math.cos(mdd)) * 0.18;
      meA.node.rotation.y = meA.ang;
    }
    if (TFm && meA.mesh) {
      var meTalk = !!(TSm && TSm.who === 'me');
      TFm.pose(T, meA.node, { speaking: meTalk && TSm.speaking, vowel: meTalk ? TSm.vowel : null, open: meTalk ? TSm.open : 0,
        emo: null, t: now / 1000, dt: tdt, seed: 7 });
    }

    /* 교전 상대(`duelStage()` 로 세운 임시 배우) — `spawns` 에 없으니 여기서
       직접 먹인다. 코앞이라 `farBoost` 는 안 준다(늘 가까이서 마주 선다) */
    if (duelFoe) {
      var dfa = actorOf('duelfoe', duelFoe.kind, duelFoe.ref, 96);
      placeActor(dfa, duelFoe.x, duelFoe.y, h * (duelFoe.kind === 'pet' ? 0.86 : 1), 0, false, 0, now);
      /* 상대는 **나를 마주 본다.** 걷지 않으니 `placeActor` 의 진행-방향 회전으로는
         절대 안 돌아간다 — 새로 세운 순간의 기본값(뒤짐, PLAN 49절)이 그대로
         남아 계속 등을 보이게 된다. 야생 대상의 무대 회전(위 `onStage`)과 같은 계산 */
      if (dfa.mesh) {
        var fax = pos.x - duelFoe.x, faz = pos.y - duelFoe.y;
        dfa.node.rotation.y = Math.atan2(fax, faz);
        dfa.ang = dfa.node.rotation.y;
      }
      /* **나도 상대를 본다.** `placeActor(meA,...)` 는 이동 방향으로만 도는데,
         실시간 교전(rogue-action.js) 은 사거리 안에 서서 자동으로 때리는 게
         기본이라 — 가만히 선 채 마지막으로 걸어온 방향을 계속 보고 있으면
         적을 등지거나 옆으로 보고 때리는 것처럼 보인다(2026-09-06, 실기기
         확인 중 "어딜 보고 때림?" 로 지적됨). 위 `placeActor` 가 정한 회전을
         여기서 덮어써 늘 상대 쪽을 보게 한다 */
      if (meA.mesh) {
        var max = duelFoe.x - pos.x, maz = duelFoe.y - pos.y;
        if (max * max + maz * maz > 0.01) {
          meA.node.rotation.y = Math.atan2(max, maz);
          meA.ang = meA.node.rotation.y;
        }
      }
    }

    syncBuddies(pos, meA.ang, h, now);

    /* 야생 대상 */
    var sp = W.spawns, i;
    var FCs = global.DG.fieldCombat, duelUid = FCs && FCs.duelSpawn ? FCs.duelSpawn() : null;
    for (i = 0; i < sp.length; i++) {
      var s = sp[i];
      if (duelUid !== null && s.uid === duelUid) { continue; }   // ⑯ 겨루는 동안엔 들판 전투 몸(fc)이 대신 선다
      var kind = s.kind === 'hero' ? 'hero' : 'pet';
      var a = actorOf('sp' + s.uid, kind, s.ref, 96);
      var bob = s.moving
        ? Math.abs(Math.sin(s.phase)) * h * 0.04
        : Math.sin(now / 620 + s.uid) * h * 0.02;
      var onStage = stageAt && stageAt.uid === s.uid;
      var boost = onStage ? 1 : farBoost(s.x, s.y);
      placeActor(a, s.x, s.y, h * (kind === 'hero' ? 1 : 0.86) * boost,
        onStage ? 0 : bob, onStage ? false : !!s.moving, s.phase || 0, now);
      if (onStage) {
        /* 무대 소품(조준 고리)이 상대의 크기에 맞게 서도록 키를 적어 둔다 —
           뿔낙지와 여포에 같은 크기의 고리를 씌우면 하나는 묻히고 하나는 넘친다 */
        stageAt.h = h * (kind === 'hero' ? 1 : 0.86);
        /* **자리도 따라간다.** 조우 중에도 판정 층의 배회는 그대로 돌아서(world.js),
           열 때의 좌표에 카메라를 붙박아 두면 상대가 걸어 나가고 빈 땅만 남는다 */
        stageAt.x = s.x;
        stageAt.y = s.y;
      }
      if (onStage && a.mesh) {
        /* 무대에 선 상대는 **나를 본다.** 등을 돌린 채 설득당하거나 잡히면
           누구를 만나는지가 화면에서 사라진다 */
        var ax = camera.position.x - s.x, az = camera.position.z - s.y;
        a.node.rotation.y = Math.atan2(ax, az);
        a.ang = a.node.rotation.y;
        a.node.position.y = stageAt.lift || 0;
        /* 무대 위의 물러섬·다가섬은 **뒤로 가는 것**이지 뜨는 것이 아니다.
           위로만 띄웠더니 놓친 상대가 공중에 뜬 것처럼 보였다.
           그림자도 같이 옮긴다 — 안 옮기면 발과 그림자가 따로 논다 */
        if (stageAt.back) {
          var bl = Math.max(0.5, Math.hypot(ax, az));
          var ox = -ax / bl * stageAt.back, oz = -az / bl * stageAt.back;
          a.node.position.x = s.x + ox;
          a.node.position.z = s.y + oz;
          a.shadow.position.x = s.x + ox;
          a.shadow.position.z = s.y + oz;
        }
      }
    }

    /* 주민 — 이 땅에 사는 열 사람(`npc.js`). 스폰과 달리 **잡히지 않는 사람들**이라
       발밑 등급 고리를 안 두르고, 조우 무대에도 오르지 않는다 */
    var NP = global.DG.npc;
    var people = NP ? NP.live(pos, now) : [];
    for (i = 0; i < people.length; i++) {
      var n = people[i];
      var na = actorOf('np' + n.p.id, 'hero', n.p, 96);
      var nbob = n.walking
        ? Math.abs(Math.sin(n.phase)) * h * 0.04
        : Math.sin(now / 700 + i) * h * 0.014;
      placeActor(na, n.x, n.y, h * 0.94 * farBoost(n.x, n.y), nbob, n.walking, n.phase, now);
    }
    /* ⑱ 땅 사람 — 탑 둘레 과거·현대·미래 셋(`folk.js`). 주민처럼 잡히지 않는다. 서 있을 땐 탑을 본다 */
    var FK = global.DG.folk, TSf = TSm, TFf = TFm;
    var folks = FK ? FK.live(pos, now) : [];
    if (global.DG.story) { folks = folks.concat(global.DG.story.live(pos, now)); }   // ⑲-12 이야기 인물 셋
    for (i = 0; i < folks.length; i++) {
      var fk = folks[i];
      /* ⑲-21 배달 기계처럼 pet 이면 사람 몸 대신 들판 적 몸(pet:fc_<pet>) */
      var fka = fk.p.pet ? actorOf('fk' + fk.p.id, 'pet', { id: 'fc_' + fk.p.pet, name: fk.p.name, kind: 'beast', rarity: 2, form: 'boar' }, 96)
        : actorOf('fk' + fk.p.id, 'hero', fk.p, 96);
      fka.sky = !!fk.sky;                                   // ⑲-20 구름섬에 선 이야기 인물
      placeActor(fka, fk.x, fk.y, h * 0.94 * farBoost(fk.x, fk.y), fk.walking ? 0 : Math.sin(now / 700 + i) * h * 0.014, fk.walking, fk.phase, now);
      if (!fk.walking && fka.mesh) {
        var fkd = Math.PI / 2 - fk.ang - fka.ang;          // placeActor 규약(atan2(dx,dz))으로 탑 쪽 — 미끄러지듯 돈다
        fkd = Math.atan2(Math.sin(fkd), Math.cos(fkd));
        fka.ang += fkd * 0.08; fka.node.rotation.y = fka.ang;
      }
      /* ⑲-13 이야기 인물 — 말하는 동안 손짓·끄덕임(QRPG 라 입은 없다), 나그네는 흰 가면 */
      if (fk.p.story && !fk.p.pet && fka.mesh && TFf) {
        if (fk.p.mask) { TFf.mask(T, fka.node, typeof fk.p.mask === 'string' ? fk.p.mask : 'white'); }   // ⑲-19 해솔은 금 간 가면
        var fkTalk = !!(TSf && TSf.who === fk.p.story);
        TFf.pose(T, fka.node, { speaking: fkTalk && TSf.speaking, vowel: fkTalk ? TSf.vowel : null, open: fkTalk ? TSf.open : 0,
          emo: fkTalk ? TSf.emo : null, t: now / 1000, dt: tdt, seed: i + 3 });
      }
    }

    /* 짐승 — 들·강의 다섯 종(`animal.js`). 잡는 대상이 아니라 **거기 사는 것**이라
       등급 고리도 이름표도 없다. 새는 뜨고 물고기는 잠기므로 세운 뒤 높이를 준다 */
    var AN = global.DG.animal;
    var beasts = AN ? AN.live(pos, now) : [];
    for (i = 0; i < beasts.length; i++) {
      var bt = beasts[i];
      var ba = actorOf('an' + bt.m.id, 'pet', AN.refOf(bt.kind), 96);
      var bh = h * bt.kind.h * farBoost(bt.x, bt.y);
      placeActor(ba, bt.x, bt.y, bh, 0, bt.moving, bt.phase, now);
      if (bt.lift) {
        /* 날아오른 새는 **그림자가 작아지고 흐려진다** — 높이만 주면 지면에 붙어
           보인다(발밑 그림자가 그대로면 눈이 높이를 못 읽는다) */
        ba.node.position.y = bt.lift;
        ba.shadow.scale.setScalar(bh * 0.30 * Math.max(0.25, 1 - bt.lift / 12));
      }
      if (bt.kind.act !== null && bt.alarm > 0.05) {
        /* 놀랐거나 쫓는 짐승은 그쪽을 본다 — 옆을 보고 도망치면 도망으로 안 보인다 */
        ba.node.rotation.y = bt.ang;
        ba.ang = bt.ang;
      }
    }

    /* 들판 적 무리(`field-combat.js`, §5 ⑨) — 쓰러지면 1초 동안 가라앉으며 줄어든다 */
    var FC = global.DG.fieldCombat;
    var fcs = FC ? FC.live() : [];
    for (i = 0; i < fcs.length; i++) {
      var fo = fcs[i];
      var foa = actorOf('fc' + fo.uid, fo.hero ? 'hero' : 'pet', fo.ref, 96);
      foa.sky = !!fo.sky;                                   // ⑲-20 구름섬 무리
      /* ⑯ 굴복한 인물은 사라지지 않고 무릎 꿇는다(키를 낮춘다) */
      var foh = h * fo.h * (fo.dead ? Math.max(0.05, 1 - fo.deadT) : (fo.yielded ? 0.72 : 1));
      placeActor(foa, fo.x, fo.y, foh, 0, fo.moving && !fo.dead, fo.phase, now);
      if (foa.mesh) { foa.node.rotation.z = fo.stun ? Math.sin(now / 90) * 0.12 : 0; }
      if (fo.mask && foa.mesh && TFf) { TFf.mask(T, foa.node, fo.mask); }   // ⑲-14 이야기 보스 검은 가면
    }

    /* 역참 · 성채 */
    var sts = W.stationsNear ? W.stationsNear() : [];
    for (i = 0; i < sts.length; i++) {
      var st = sts[i];
      /* sprite.building 의 form 이름을 그대로 쓴다 — 빌보드로 돌아갔을 때
         2D 화면과 같은 그림이어야 한다 */
      var sa = actorOf('st' + st.key, 'building',
        { key: 'stable', id: 'st_' + st.key, color: '#e8c15a' }, 128);
      placeActor(sa, st.x, st.y, h * 1.7 * farBoost(st.x, st.y), 0, false, 0, now);
    }
    /* 지역 랜드마크(biome.js, §5 ⑩) — 1.35km 안이면 선다(빛기둥은 biome.js 가 얹는다) */
    var BMw = global.DG.biome;
    var lms = BMw && BMw.on() ? BMw.landmarks(pos.x, pos.y, 1350) : [];
    for (i = 0; i < lms.length; i++) {
      var lm = lms[i];
      var la = actorOf('lm' + lm.key, 'building',
        { key: 'landmark', id: 'lm_' + lm.key, biome: lm.biome, color: BMw.BIOMES[lm.biome].color }, 128);
      placeActor(la, lm.x, lm.y, h * 2.4 * farBoost(lm.x, lm.y), 0, false, 0, now);
    }
    var fts = W.fortsNear ? W.fortsNear() : [];
    for (i = 0; i < fts.length; i++) {
      var ft = fts[i];
      var fs = fortStyle(ft);
      var fa = actorOf('ft' + ft.key, 'building',
        { key: 'wall', id: 'ft_' + ft.key, color: ft.color || fs.color, tier: fs.tier }, 128);
      placeActor(fa, ft.x, ft.y, h * 2.4 * farBoost(ft.x, ft.y), 0, false, 0, now);
    }
  }

  /**
   * 성채의 **겉모습** — 등급과 지키는 세력의 빛깔.
   *
   * 여태 성채는 화면에서 다 같았다(늘 보라색 배너에 같은 크기). 등급 셋(보·진·웅진)도
   * 세력도 판정 층은 알고 있는데 화면이 안 물어봤을 뿐이다. 물어보고 나면
   * **걸어가기 전에 멀리서 세기와 임자를 가늠**할 수 있다.
   *
   * **키로 캐시한다.** `factionNameOf` 는 도감 일흔을 훑으므로 프레임마다 부르면
   * 안 된다. 같은 성채의 등급·세력은 늘 같으니(해시로 정해진다) 캐시가 맞다 —
   * 점령 여부만 바뀌는데 그것은 여기서 안 쓴다.
   */
  var fortStyleCache = {};
  function fortStyle(ft) {
    if (fortStyleCache[ft.key]) { return fortStyleCache[ft.key]; }
    var F = global.DG.fort, D = global.DG.data;
    var o = { tier: 2, color: '#8a5cc0' };
    try {
      if (F && F.tierOf) {
        o.tier = F.tierOf(ft).tier;
        var fc = D && D.faction ? D.faction(F.factionNameOf(ft)) : null;
        if (fc && fc.color) { o.color = fc.color; }
      }
    } catch (e) { /* 판정 층이 아직 없으면 옛 빛깔 그대로 — 화면은 안 빈다 */ }
    fortStyleCache[ft.key] = o;
    return o;
  }

  /* ── 조우 연출 ────────────────────────────────────────────
   * 원작에서 대상을 누르면 화면이 그쪽으로 넘어간다. 여기서는 조우 창이 HTML 이라
   * 3D 는 **뒤에서 카메라를 돌려** 그 순간을 만든다. 잡히면 빛기둥이 선다.
   * 창이 열렸는지는 DOM 을 보고 안다 — `encounter.js` 를 고치지 않으려는 것이다.
   */
  /* ── 전투 연출 (PLAN 23절) ────────────────────────────
   * 소품은 `battle3d.js` 가 만든다. 여기 있는 것은 **카메라가 하는 일**뿐이다 —
   * 줌인 · 흔들림 · 잠깐 멎기(hit-stop). 셋 다 화면에만 쓴다.
   */
  var yaw = 0;             // 돌려 본 각(라디안) — 드래그로 바꾼다
  var talkNow = 0;         // ⑲-13 대화 몸짓 — 지난 프레임 시각(ms)
  /** ⑲-13 이야기 대화 중이면 연출 값(story.talkShot) — 카메라·몸짓이 읽는다 */
  function talkShot() { var S = global.DG.story; return S && S.talkShot && global.DG.talkface ? S.talkShot() : null; }
  /** ⑲-22 조준 구도(순수) — 오른 어깨 너머(뒤 2.6m·옆 0.7m·몸 키 1.25배 높이), 앞 14m 를 본다. av = {dx, dy} 겨눈 쪽 */
  function aimCam(p, av, h) {
    var fx = av.dx, fz = av.dy, rx = -fz, rz = fx;                  // 앞 (fx, fz) 을 볼 때 화면 오른쪽
    return { pos: { x: p.x - fx * 2.6 + rx * 0.7, y: h * 1.25, z: p.y - fz * 2.6 + rz * 0.7 },
      look: { x: p.x + fx * 14, y: h * 0.85, z: p.y + fz * 14 } };
  }
  var battleOn = false;    // 교전 중인가
  var shakeAmp = 0;        // 남은 흔들림 세기(m)
  var holdUntil = 0;       // 이때까지 화면이 멎는다 (performance.now 기준)

  var focusAt = null;      // {x, y} 조우 중인 대상
  var stageAt = null;      // {x, y, uid} 조우 무대 — 대상 앞에 카메라를 세운다
  var beams = [];          // 빛기둥
  var clickRings = [];     // 클릭(탭)한 자리 표시 — 2026-09-06, 3D에선 안 보이던 것을 채움

  /* ── 교전 상대를 실제로 세운다 (PLAN 23절 다음, 2026-08-30) ──────────
   * `duel.js` 는 여태 카드 안의 이모지로만 싸웠다 — 3D 지도에는 아무도 안 섰다.
   * `battle3d.js` 가 `duel:open` 때 `duelStage()` 를 불러 상대를 실제로 세우면,
   * 배우는 늘 있던 `actors['me']`(동행 선두) 옆에서 진짜로 마주 선다.
   * 상대는 `spawns` 목록에 없는 임시 배우라 `syncActors()` 가 따로 먹여야 한다. */
  var duelFoe = null;      // {kind, ref, x, y} — 없으면 교전 중이 아니거나 3D 상대가 없다

  /** 사건이 조명을 잠깐 죽인다(2026-09-06, "비전투 이벤트 3D 무대 연출" —
   *  밤 사건의 긴장). 0(평소)~1. `battle3d.js`가 `duel:open`(늑대 무리·
   *  적군 정찰병처럼 `eerie` 딱지가 붙은 사건)·`duel:close`에서 두드린다.
   *  **`lightingAt()`이 내는 값 자체는 안 건드린다**(캐시일 수도 있고,
   *  미니맵 등 다른 곳도 같은 값을 본다) — `syncLight()`가 적용하는
   *  자리에서만 깎는다, 사건이 끝나면 다음 프레임에 저절로 원래 밝기로
   *  돌아간다(`setEventMood(0)`이 지운다) */
  var eventDark = 0;

  /** 이 자리가 집 몸통 안인가 — `world.js` 의 `hitsHouse` 와 같은 계산이지만
      독립된 사본이다(world3d 가 world.js 를 되받아 부르지 않게 한다).
      `margin` 은 여유(m) — 상대가 설 자리는 발이 벽에 안 묻힐 만큼(기본 1),
      카메라가 설 자리는 그보다 훨씬 넉넉해야 한다(벽에 바짝 붙으면 근접
      절단면이 벽 텍스처로 화면을 채운다) */
  function duelSpotBlocked(x, y, margin) {
    var m = margin === undefined ? 1 : margin;
    var gx0 = Math.floor(x / GRID), gy0 = Math.floor(y / GRID), gx, gy, rs, i, r;
    for (gy = gy0 - 1; gy <= gy0 + 1; gy++) {
      for (gx = gx0 - 1; gx <= gx0 + 1; gx++) {
        rs = houseRects(gx, gy);
        for (i = 0; i < rs.length; i++) {
          r = rs[i];
          var dx = x - r.x, dz = y - r.z;
          var c = Math.cos(r.rot), s = Math.sin(r.rot);
          var lx = dx * c + dz * s, lz = -dx * s + dz * c;
          if (Math.abs(lx) < r.w / 2 + m && Math.abs(lz) < r.d / 2 + m) { return true; }
        }
      }
    }
    return false;
  }

  /** 상대를 세운다 — `x, y` 는 나에게서 6m 남쪽(`battle3d.spot()` 과 같은 자리)이
      먼저다. 그 자리가 집 안이면(마을 한복판에서 걸린 사건) 부채꼴로 돌며
      가장 가까운 트인 자리를 대신 쓴다 — 안 그러면 상대가 벽 뒤에 완전히
      가려진다(2026-08-30, 실기기 확인 중 발견) */
  function duelStage(kind, ref) {
    if (!kind || !ref) { return false; }
    var pos = core.save.player.pos;
    var OFF = [[0, -6], [-6, -6], [6, -6], [-6, 0], [6, 0], [0, 6], [-6, 6], [6, 6]];
    var fx = pos.x + OFF[0][0], fy = pos.y + OFF[0][1], i;
    for (i = 0; i < OFF.length; i++) {
      var tx = pos.x + OFF[i][0], ty = pos.y + OFF[i][1];
      if (!duelSpotBlocked(tx, ty)) { fx = tx; fy = ty; break; }
    }
    duelFoe = { kind: kind, ref: ref, x: fx, y: fy };
    focusAt = { x: duelFoe.x, y: duelFoe.y };
    return true;
  }

  /** 상대를 내린다 — `sweepActors()` 가 알아서 사라지게 두지 않고 바로 지운다
   *  (교전 결과 카드가 곧바로 그 자리를 쓰므로 사라지는 연출은 필요 없다) */
  function duelUnstage() {
    var a = actors.duelfoe;
    if (a) {
      actorGroup.remove(a.node);
      actorGroup.remove(a.shadow);
      delete actors.duelfoe;
    }
    duelFoe = null;
  }

  /** 나 또는 상대에게 몸짓을 하나 재생한다(공격·피격·회피) — `who` 는 'me'·'foe'.
   *  클립이 없는 몸(도형 배우, 아직 안 받은 GLB)이면 조용히 아무 일도 안 한다. */
  function playAnim(who, name, ms) {
    var key = who === 'foe' ? 'duelfoe' : (who === 'ally' ? 'ally' : (actors[who] ? who : 'me'));
    var a = actors[key];
    if (!a) { return false; }
    a.animName = name;
    a.animUntil = (global.performance ? performance.now() : Date.now()) + (ms || 300);
    return true;
  }

  function bindEvents() {
    core.on('encounter:request', function (spawn) {
      if (spawn) { focusAt = { x: spawn.x, y: spawn.y }; }
    });
    core.on('station:request', function (st) {
      if (st) { focusAt = { x: st.x, y: st.y }; }
    });
    core.on('fort:request', function (ft) {
      if (ft) { focusAt = { x: ft.x, y: ft.y }; }
    });
    /* 도감에 새 줄이 생겼다 = 잡았다. 마지막으로 보던 자리에 빛기둥을 세운다 */
    core.on('dex:new', function () {
      /* 승화(growth.js)도 같은 이벤트를 낸다 — 조우 창이 열려 있을 때만 세운다.
         안 그러면 도감 화면에서 승화시켰는데 지도 한복판에 빛기둥이 선다 */
      var f = focusLive();
      if (f) { beam(f.x, f.y); }
    });
  }

  /** 조우 창이 아직 열려 있는가 — 닫혔으면 카메라를 놓아 준다.
      역참·성채·교전도 **같은 `#encounter` 한 칸**을 쓴다(station.js·fort.js·duel.js). */
  function focusLive() {
    if (!focusAt) { return null; }
    var el = document.getElementById('encounter');
    if (el && el.classList.contains('show')) { return focusAt; }
    focusAt = null;
    return null;
  }

  function beam(x, y) {
    if (!available()) { return; }
    var geo = unitGeo('cyl');
    var m = new T.Mesh(geo, new T.MeshBasicMaterial({
      color: 0xffe6a8, transparent: true, opacity: 0.85, depthWrite: false
    }));
    m.position.set(x, 6, y);
    m.scale.set(2.6, 12, 2.6);
    fxGroup.add(m);
    beams.push({ mesh: m, t: 0 });
  }

  function syncBeams(dt) {
    var i;
    for (i = beams.length - 1; i >= 0; i--) {
      var b = beams[i];
      b.t += dt;
      var k = b.t / 0.9;
      b.mesh.scale.x = b.mesh.scale.z = 2.6 + k * 5;
      b.mesh.material.opacity = Math.max(0, 0.85 * (1 - k));
      if (k >= 1) {
        fxGroup.remove(b.mesh);
        b.mesh.material.dispose();      // 이 재질은 이 기둥만 쓴다
        beams.splice(i, 1);
      }
    }
  }

  /** 클릭(탭)한 자리 — `world.js`의 2D 고리(커지며 옅어짐)와 같은 그림을
   *  3D 바닥에도 놓는다. 2026-09-06, "클릭 자리 표시가 없다"로 발견 —
   *  2D `clickMarks`는 3D가 켜지면 숨는 캔버스(`gCtx`)에만 그려져서
   *  3D에서는 눌러도 아무 반응이 안 보였다. `beam()`과 같은 자기 관리
   *  fx 패턴(`fxGroup`에 직접 얹고 `syncClickMark`가 나이 먹여 지운다) */
  function clickMark(x, y) {
    if (!available()) { return; }
    var m = new T.Mesh(
      new T.TorusGeometry(0.6, 0.12, 8, 28),
      new T.MeshBasicMaterial({ color: 0xffd650, transparent: true, opacity: 0.9, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;         // 눕혀서 바닥에 깐다
    m.position.set(x, groundY(x, y) + 0.05, y);
    fxGroup.add(m);
    clickRings.push({ mesh: m, t: 0 });
  }

  function syncClickMark(dt) {
    var i;
    for (i = clickRings.length - 1; i >= 0; i--) {
      var c = clickRings[i];
      c.t += dt;
      var k = c.t / 0.6;
      var s = 1 + k * 1.8;
      c.mesh.scale.set(s, 1, s);
      c.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
      if (k >= 1) {
        fxGroup.remove(c.mesh);
        c.mesh.material.dispose();
        clickRings.splice(i, 1);
      }
    }
  }

