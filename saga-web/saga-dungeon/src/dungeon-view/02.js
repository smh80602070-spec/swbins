  /* ── 그리기 ───────────────────────────────────────────── */

  /* 방 종류는 data-dungeon.js 의 ROOMS 가 정본이다 — 여기에 없는 종류를 적어 두면
     영영 안 뜨는 아이콘이 남는다(서고 📖 가 실제로 그렇게 남아 있었다). */
  var DOOR_ICON = { fight: '⚔️', trove: '🎁', well: '💧', shrine: '⛩️', stair: '🪜',
    elite: '💠', miniboss: '👹', cave: '⛏️', merchant: '🧺', puzzle: '🧩', event: '🙏',
    forage: '🌿' };

  /** 3D 를 쓰는 동안에는 2D 캔버스를 비워 둔다 (같은 그림을 두 번 그리지 않게) */
  function sync3d() {
    var on = !!(global.DG.dungeon3d && global.DG.dungeon3d.active());
    var el3 = document.getElementById('dg3d');
    if (el3) { el3.style.display = on ? 'block' : 'none'; }
    /* 2D 캔버스는 **입력을 받는 자리**라 지우지 않고 투명하게만 둔다(css `body.dg3d`) */
    if (document.body) { document.body.classList.toggle('dg3d', on); }
    return on;
  }

  function draw() {
    if (!shown || !ctx) { return; }
    var run = d().raw();
    if (!run) { return; }
    if (sync3d()) {
      /* 3D 가 그렸다 — 2D 방 그림은 건너뛴다. 조작판(HUD)은 DOM 이라 그대로다 */
      var m3 = metrics();
      ctx.clearRect(0, 0, m3.cw, m3.ch);
      global.DG.dungeon3d.resize();
      global.DG.dungeon3d.render();
      return;
    }
    var m = metrics();
    var W = d().ROOM_W, H = d().ROOM_H, WALLT = d().WALL;
    var theme = run.theme || DD.themeOf(run.floor);
    var now = Date.now();
    var i, p;

    if (run.room !== goreRoom) { goreRoom = run.room; gore = []; }

    ctx.clearRect(0, 0, m.cw, m.ch);
    ctx.save();

    /* §5.8③ 콤보 12+ 화면 채도 +10%(2026-09-18) — ctx.restore() 가 되돌리므로
       이 draw() 호출 안에서만 걸린다. 3D 는 후처리(post3d.js)에 채도 조절
       패스 자체가 없어(톤매핑·블룸·비네트뿐) 이번엔 2D만 — 손대려면 셰이더
       패스를 새로 추가해야 해 손맛(연출) 범위를 넘는다고 판단해 스킵했다. */
    if ((run.combo || 0) >= 12) { ctx.filter = 'saturate(1.1)'; }

    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake -= 0.7;
    }

    /* 방 밖 배경 — 돌 어둠 */
    var bg = ctx.createLinearGradient(0, 0, 0, m.ch);
    bg.addColorStop(0, '#08090d');
    bg.addColorStop(1, '#0e1015');
    ctx.fillStyle = bg;
    ctx.fillRect(-30, -30, m.cw + 60, m.ch + 60);

    /* 바닥 마름모 */
    var c00 = proj(m, 0, 0), cW0 = proj(m, W, 0), cWH = proj(m, W, H), c0H = proj(m, 0, H);
    ctx.beginPath();
    ctx.moveTo(c00.x, c00.y); ctx.lineTo(cW0.x, cW0.y);
    ctx.lineTo(cWH.x, cWH.y); ctx.lineTo(c0H.x, c0H.y);
    ctx.closePath();
    var fg = ctx.createLinearGradient(0, c00.y, 0, cWH.y);
    fg.addColorStop(0, shade(theme.floor, -0.25));
    fg.addColorStop(0.5, theme.floor);
    fg.addColorStop(1, shade(theme.floor, 0.06));
    ctx.fillStyle = fg;
    ctx.fill(); var tex = global.DG.mode2d.fillIso(ctx, { id: (global.DG.cfg.mode2d.tile || {})[theme.name], a: IX * m.s, b: IY * m.s, c: -IX * m.s, d: IY * m.s, e: m.ox, f: m.oy, W: W, H: H, tint: theme.floor });   // 2D 바닥 타일(K-0020)

    /* 바닥 판석(板石) — 원작의 바닥은 매끈한 면이 아니라 **낱장 돌**이다.
       칸마다 밝기를 조금씩 흔들고 이음선을 어둡게 파면, 그림 한 장 없이도
       돌을 깐 바닥으로 읽힌다. 흔들림은 hash2 라 방이 같으면 무늬도 같다
       (매 프레임 달라지면 바닥이 지글거린다). */
    var TS = 40, gx, gy, q0, q1, q2, q3, v;
    ctx.lineWidth = 1;
    for (gx = 0; gx < W; gx += TS) {
      for (gy = 0; gy < H; gy += TS) {
        var x2 = Math.min(gx + TS, W), y2 = Math.min(gy + TS, H);
        q0 = proj(m, gx, gy); q1 = proj(m, x2, gy);
        q2 = proj(m, x2, y2); q3 = proj(m, gx, y2);
        ctx.beginPath();
        ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y);
        ctx.lineTo(q2.x, q2.y); ctx.lineTo(q3.x, q3.y);
        ctx.closePath();
        /* 칸 **번호**로 흔든다 — 좌표(40의 배수)로 해싱하면 값이 규칙적으로
           맞물려 바닥이 체크무늬가 된다(실제로 그렇게 나왔다). */
        v = (core.hash2(gx / TS * 13 + gy / TS * 7, gy / TS * 29 + run.floor) - 0.5) * 0.09;
        ctx.fillStyle = shade(theme.floor, v);
        if (!tex) { ctx.fill(); }
        /* 이음선 — 아래로 파인 쪽만 밝게 하면 돌이 솟아 보인다 */
        ctx.strokeStyle = 'rgba(0,0,0,0.34)';
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(q3.x, q3.y); ctx.lineTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.022)';
        ctx.stroke();
        /* 드물게 깨진 돌 하나 — 같은 무늬가 끝없이 반복되는 것을 끊는다 */
        if (core.hash2(gx / TS + 7, gy / TS + 13) > 0.86) {
          ctx.beginPath();
          ctx.moveTo((q0.x + q2.x) / 2, (q0.y + q2.y) / 2);
          ctx.lineTo(q1.x, q1.y);
          ctx.strokeStyle = 'rgba(0,0,0,0.34)';
          ctx.stroke();
        }
      }
    }

    /* 핏자국 — 판석 위, 균열 아래 */
    for (i = 0; i < gore.length; i++) {
      var gr0 = gore[i];
      ctx.save();
      ctx.globalAlpha = gr0.a;
      ctx.fillStyle = gr0.big ? '#4a0a06' : '#380806';
      for (var gj = 0; gj < 3; gj++) {
        ctx.beginPath();
        isoEllipse(ctx, m,
          gr0.x + (gr0.s[gj] - 0.5) * gr0.r * 1.6,
          gr0.y + (gr0.s[gj + 3] - 0.5) * gr0.r * 1.6,
          gr0.r * (0.45 + gr0.s[gj] * 0.55));
        ctx.fill();
      }
      ctx.restore();
    }

    /* 균열 */
    var dec = run.room.decor || [], di, o;
    ctx.strokeStyle = 'rgba(0,0,0,0.32)';
    ctx.lineWidth = 1.4;
    for (di = 0; di < dec.length; di++) {
      o = dec[di];
      if (o.t !== 'crack') { continue; }
      var ca = Math.cos(o.a), sa = Math.sin(o.a), L = o.len / 2;
      var pts = [[-L, 0], [-L / 3, -3], [L / 3, 2], [L, -1]];
      ctx.beginPath();
      for (var pi = 0; pi < pts.length; pi++) {
        var wx = o.x + pts[pi][0] * ca - pts[pi][1] * sa;
        var wy = o.y + pts[pi][0] * sa + pts[pi][1] * ca;
        var pp = proj(m, wx, wy);
        if (pi === 0) { ctx.moveTo(pp.x, pp.y); } else { ctx.lineTo(pp.x, pp.y); }
      }
      ctx.stroke();
    }

    /* 안쪽 통행 경계 (벽 두께만큼 안쪽) */
    var i1 = proj(m, WALLT, WALLT), i2 = proj(m, W - WALLT, WALLT),
        i3 = proj(m, W - WALLT, H - WALLT), i4 = proj(m, WALLT, H - WALLT);
    ctx.beginPath();
    ctx.moveTo(i1.x, i1.y); ctx.lineTo(i2.x, i2.y);
    ctx.lineTo(i3.x, i3.y); ctx.lineTo(i4.x, i4.y);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    /* 뒷벽 두 장 — (0,0)-(W,0) 위-오른쪽, (0,0)-(0,H) 위-왼쪽 */
    var wh = WALLH * m.s;
    wall(ctx, c00, cW0, wh, shade(theme.wall, 0.10), shade(theme.wall, -0.34));
    wall(ctx, c00, c0H, wh, shade(theme.wall, -0.18), shade(theme.wall, -0.50));

    /* 벽 횃불 — 여태 **빛만 있고 불이 없었다**. 어둠을 뚫는 구멍의 출처가
       화면에 안 보이면 조명이 아니라 얼룩으로 읽힌다. */
    for (di = 0; di < dec.length; di++) {
      if (dec[di].t === 'torch') { drawTorch(m, dec[di], now); }
    }

    /* 앞쪽 낮은 턱 — 방의 경계는 보이되 캐릭터를 가리지 않게 */
    rim(ctx, c0H, cWH, 9 * m.s, shade(theme.wall, -0.15));
    rim(ctx, cW0, cWH, 9 * m.s, shade(theme.wall, -0.3));

    /* 문 — 오른쪽 벽(x=W) 자리. 열리면 금빛으로 빛난다 */
    var open = run.room.cleared;
    for (i = 0; i < run.room.doors.length; i++) {
      var dr = run.room.doors[i];
      var dp1 = proj(m, W - WALLT, dr.y - 26), dp2 = proj(m, W - WALLT, dr.y + 26);
      var dp3 = proj(m, W, dr.y + 26), dp4 = proj(m, W, dr.y - 26);
      ctx.beginPath();
      ctx.moveTo(dp1.x, dp1.y); ctx.lineTo(dp2.x, dp2.y);
      ctx.lineTo(dp3.x, dp3.y); ctx.lineTo(dp4.x, dp4.y);
      ctx.closePath();
      ctx.fillStyle = open
        ? 'rgba(245,180,69,' + (0.55 + Math.sin(now / 300 + i) * 0.15) + ')'
        : 'rgba(120,120,130,0.4)';
      ctx.fill();
      var dc = proj(m, W - WALLT / 2, dr.y);
      ctx.font = Math.round(19 * m.s + 8) + 'px "Malgun Gothic", system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = open ? 1 : 0.45;
      ctx.fillText(DOOR_ICON[dr.kind] || '⚔️', dc.x, dc.y - 8 * m.s);
      if (dr.title) {
        /* 명소 층(§5.15) — 다음 방 이름 */
        ctx.font = '700 ' + Math.round(9 * m.s + 7) + 'px "Malgun Gothic", system-ui';
        ctx.fillStyle = '#f0d9a0';
        ctx.fillText(dr.title, dc.x - 34 * m.s, dc.y + 14 * m.s);
      }
      ctx.globalAlpha = 1;
    }

    /* ── 깊이 정렬 대상 (기둥·장치·적·플레이어) ── */
    var items = [];

    for (di = 0; di < dec.length; di++) {
      o = dec[di];
      if (o.t === 'pillar') {
        items.push({ z: o.x + o.y, kind: 'pillar', o: o });
      } else if (o.t === 'jar') {
        items.push({ z: o.x + o.y, kind: 'jar', o: o });
      }
    }
    thingItem(items, run.room.grave, '💀');
    thingItem(items, run.room.chest, run.room.chest && run.room.chest.taken ? '📭' : '🎁');
    thingItem(items, run.room.well, run.room.well && run.room.well.used ? '🕳️' : '💧');
    thingItem(items, run.room.shrine, run.room.shrine && run.room.shrine.used ? '🪨' : '⛩️');
    thingItem(items, run.room.vein, run.room.vein && run.room.vein.used ? '🕳️' : '⛏️');
    thingItem(items, run.room.merchant, run.room.merchant && run.room.merchant.used ? '🚶' : '🧺');
    if (run.room.puzzle) {
      var pzPods = run.room.puzzle.pods;
      for (var pzi = 0; pzi < pzPods.length; pzi++) {
        thingItem(items, pzPods[pzi], pzPods[pzi].lit ? '🔆' : '🗿');
      }
    }
    thingItem(items, run.room.captive, run.room.captive && run.room.captive.freed ? '🙏' : '⛓️');
    if (run.room.forage) {
      var fgHerbs = run.room.forage.herbs;
      for (var fghi = 0; fghi < fgHerbs.length; fghi++) {
        if (!fgHerbs[fghi].picked) { thingItem(items, fgHerbs[fghi], '🌿'); }
      }
      thingItem(items, run.room.forage.pond, run.room.forage.pond.used ? '🌊' : '🎣');
    }
    /* 비밀(POI: Secret) — 찾기 전엔 여느 균열과 똑같이 그려진다(위 균열
       루프가 이미 그린다). 찾은 뒤에만 반짝임을 하나 더 얹는다 */
    for (di = 0; di < dec.length; di++) {
      if (dec[di].secret && dec[di].found) { thingItem(items, dec[di], '✨'); }
    }

    for (i = 0; i < run.room.enemies.length; i++) {
      var e = run.room.enemies[i];
      if (e.hp <= 0) { continue; }
      items.push({ z: e.x + e.y, kind: 'foe', o: e });
    }
    /* 마을 사람과 표식 — 던전에는 없다(빈 배열이라 그냥 지나간다).
       **플레이어와의 거리**를 같이 담는다. 이름표를 아홉 개 늘 띄우면 폰에서
       글자가 뭉쳐 아무것도 못 읽는다 — 원작도 가리킨 것 하나만 이름을 보여 준다. */
    var npcs = run.room.npcs || [], marks = run.room.marks || [];
    var NEAR = 170;
    for (i = 0; i < npcs.length; i++) {
      items.push({ z: npcs[i].x + npcs[i].y, kind: 'npc', o: npcs[i],
        near: Math.hypot(npcs[i].x - run.player.x, npcs[i].y - run.player.y) < NEAR });
    }
    for (i = 0; i < marks.length; i++) {
      items.push({ z: marks[i].x + marks[i].y, kind: 'mark', o: marks[i],
        near: Math.hypot(marks[i].x - run.player.x, marks[i].y - run.player.y) < NEAR });
    }
    items.push({ z: run.player.x + run.player.y, kind: 'player', o: run.player });
    if (run.companion) {
      items.push({ z: run.companion.x + run.companion.y, kind: 'companion', o: run.companion });
    }

    items.sort(function (a, b) { return a.z - b.z; });

    /* 바닥에 떨어진 것 (이름표는 조명 뒤에 다시 그린다) */
    var plates = [];
    for (i = 0; i < run.room.drops.length; i++) {
      var dp = run.room.drops[i];
      var bob = Math.sin((now + i * 300) / 320) * 2;
      p = proj(m, dp.x, dp.y);
      ctx.beginPath();
      isoEllipse(ctx, m, dp.x, dp.y, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
      if (dp.kind === 'gold') {
        ctx.beginPath();
        ctx.arc(p.x, p.y - 5 + bob, 5.5 * Math.max(0.7, m.s), 0, Math.PI * 2);
        ctx.fillStyle = '#f0c45a'; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      } else if (dp.kind === 'scroll') {
        /* 감정서 — 말린 두루마리 */
        var sz = Math.max(0.7, m.s);
        ctx.fillStyle = '#d8ceb0';
        ctx.fillRect(p.x - 6 * sz, p.y - 10 * sz + bob, 12 * sz, 5 * sz);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x - 6 * sz, p.y - 10 * sz + bob, 12 * sz, 5 * sz);
        plates.push({ x: p.x, y: p.y - 20 * sz + bob, text: '감정서', color: '#8ec7ff' });
      } else if (dp.kind === 'potion') {
        /* 단약 — 작은 병. 이름표는 등급색 대신 그 물약의 색이다 */
        var P2 = global.DG.potion;
        var pz = Math.max(0.7, m.s);
        var pk = P2.kindOf(dp.p.kind), pg = P2.gradeOf(dp.p.g);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 6 * pz + bob, 4 * pz, 5.5 * pz, 0, 0, Math.PI * 2);
        ctx.fillStyle = pk.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = 'rgba(220,210,190,0.9)';
        ctx.fillRect(p.x - 1.4 * pz, p.y - 13 * pz + bob, 2.8 * pz, 3.5 * pz);
        plates.push({ x: p.x, y: p.y - 20 * pz + bob,
          text: pg.name + ' ' + pk.short, color: pk.color });
      } else if (dp.kind === 'mat') {
        /* 세공 재료 — 보석은 둥글게, 부문(符文)은 글자로 */
        var GD = global.DG.gemData;
        var mz = Math.max(0.7, m.s);
        var mm = dp.mat;
        if (mm.kind === 'rune') {
          var rd = GD.runeByKey(mm.key);
          ctx.font = 'bold ' + (13 * mz) + 'px serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#f0a53a';
          ctx.fillText(rd ? rd.glyph : '符', p.x, p.y - 5 + bob);
          ctx.textAlign = 'left';
          plates.push({ x: p.x, y: p.y - 20 * mz + bob,
            text: rd ? (rd.glyph + '(' + rd.name + ')') : '부문', color: '#f0a53a' });
        } else {
          var gd = GD.gemByKey(mm.key), gr = GD.grade(mm.g);
          ctx.beginPath();
          ctx.arc(p.x, p.y - 6 + bob, 5 * mz, 0, Math.PI * 2);
          ctx.fillStyle = gr.color; ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.stroke();
          plates.push({ x: p.x, y: p.y - 19 * mz + bob,
            text: (gd ? gd.name : '보석'), color: gr.color });
        }
      } else {
        var t = global.DG.item.tierOf(dp.item);
        var dz = Math.max(0.7, m.s);
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 14 * dz + bob);
        ctx.lineTo(p.x + 6 * dz, p.y - 7 * dz + bob);
        ctx.lineTo(p.x, p.y + bob);
        ctx.lineTo(p.x - 6 * dz, p.y - 7 * dz + bob);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.stroke();
        plates.push({ x: p.x, y: p.y - 20 * dz + bob,
          text: global.DG.item.name(dp.item), color: t.color });
      }
    }

    /* 정렬된 것들 그리기 */
    var bars = [];
    for (i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.kind === 'jar') { drawJar(m, it.o, now); }
      else if (it.kind === 'pillar') { drawPillar(m, it.o, theme, wh); }
      else if (it.kind === 'thing') { drawThing(m, it.o, it.icon, now); }
      else if (it.kind === 'foe') { drawFoe(m, it.o, now, bars); }
      else if (it.kind === 'npc') { drawNpc(m, it.o, now, plates, it.near); }
      else if (it.kind === 'mark') { drawMark(m, it.o, now, plates, it.near); }
      else if (it.kind === 'companion') { drawCompanion(m, it.o, now, plates); }
      else { drawPlayer(m, run, now); }
    }

    /* 기공파 */
    for (i = 0; i < run.shots.length; i++) {
      var sh = run.shots[i];
      p = proj(m, sh.x, sh.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10, 7 * Math.max(0.7, m.s), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,220,255,0.9)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x - sh.dx * 10, p.y - 10 - sh.dy * 6, 4 * Math.max(0.7, m.s), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,220,255,0.35)';
      ctx.fill();
    }

    /* 연출 (조명 아래층) — 같은 김에 **새로 터진 격파**에서 핏자국을 하나 받는다.
       fx 객체에 표시를 남겨 두 번 세지 않는다 (dungeon.js 는 life 만 보므로 안전하다). */
    var fxs = d().fx();
    for (i = 0; i < fxs.length; i++) {
      var fu = fxs[i];
      if (fu.t === 'pop' && !fu.goreDone) {
        fu.goreDone = true;
        if (gore.length >= GORE_MAX) { gore.shift(); }
        gore.push({
          x: fu.x, y: fu.y, r: fu.boss ? 26 : 13, big: !!fu.boss,
          a: fu.boss ? 0.55 : 0.36,
          s: [core.hash2(Math.round(fu.x), Math.round(fu.y)),
              core.hash2(Math.round(fu.x) + 3, Math.round(fu.y)),
              core.hash2(Math.round(fu.x), Math.round(fu.y) + 3),
              core.hash2(Math.round(fu.x) + 5, Math.round(fu.y) + 7),
              core.hash2(Math.round(fu.x) + 9, Math.round(fu.y) + 1),
              core.hash2(Math.round(fu.x) + 2, Math.round(fu.y) + 11)]
        });
      }
      drawFxUnder(m, fu);
    }

    ctx.restore();

    /* ── 조명 — 어둠 레이어에 빛 구멍을 뚫는다 ── */
    drawLights(m, run, theme, now);
    ctx.drawImage(lightCv, 0, 0, m.cw, m.ch);

    /* ── 조명 위층: 이름표 · 체력바 · 숫자 연출 (항상 읽히게) ── */
    ctx.save();
    /* 바닥에 떨어진 것의 이름 — 원작에서 물건은 **바닥에 이름으로 놓인다**.
       네모난 검은 쪽지에 등급색 글씨, 모서리는 각지게. 둥근 모서리를 주면
       그 순간 요즘 앱의 알림처럼 보인다. */
    for (i = 0; i < plates.length; i++) {
      var pl = plates[i];
      ctx.font = '600 11px ' + D2_FONT;
      var tw = ctx.measureText(pl.text).width;
      ctx.fillStyle = 'rgba(0,0,0,0.80)';
      ctx.fillRect(pl.x - tw / 2 - 6, pl.y - 9, tw + 12, 16);
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(pl.x - tw / 2 - 6.5, pl.y - 9.5, tw + 13, 17);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = pl.color;
      ctx.fillText(pl.text, pl.x, pl.y - 1);
    }
    for (i = 0; i < bars.length; i++) {
      var br = bars[i];
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(br.x - br.w / 2 - 1, br.y - 1, br.w + 2, 5);
      ctx.fillStyle = br.boss ? '#c82a18' : (br.color || '#9c1109');
      ctx.fillRect(br.x - br.w / 2, br.y, br.w * br.p, 3);
      if (br.name) {
        ctx.font = '600 10px ' + D2_FONT;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = br.color || '#f0a53a';
        ctx.fillText(br.name, br.x, br.y - 3);
      }
    }
    var fxs2 = d().fx();
    for (i = 0; i < fxs2.length; i++) { drawFxOver(m, fxs2[i]); }
    ctx.restore();

    /* 피격 시 화면이 붉어진다 + 흔들림 */
    var st = d().status();
    var shMul = shakeMul();
    if (st.active) {
      if (st.hp < lastHp) { shake = Math.max(shake, 6 * shMul); }
      lastHp = st.hp;
      for (i = 0; i < fxs2.length; i++) {
        if (fxs2[i].t === 'pop' && fxs2[i].life > 0.42) {
          shake = Math.max(shake, (fxs2[i].boss ? 12 : 4) * shMul);
        }
        /* §5.8① 내가 때릴 때도 흔든다(2026-09-18) — 평타 1.5px·크리 4px.
           'hit'는 life 0.6 에서 태어나므로 pop 의 0.42(0.45-0.03) 와 같은
           결로 "막 태어난 것만" 잡는다(0.6-0.03=0.57) */
        if (fxs2[i].t === 'hit' && !fxs2[i].foe && fxs2[i].life > 0.57) {
          shake = Math.max(shake, (fxs2[i].crit ? 4 : 1.5) * shMul);
        }
      }
      var low = st.hpMax ? st.hp / st.hpMax : 1;
      if (low < 0.34) {
        ctx.fillStyle = 'rgba(200,40,40,' + (0.20 * (1 - low / 0.34)) + ')';
        ctx.fillRect(0, 0, m.cw, m.ch);
      }
    }
  }

  /** 뒷벽 한 장 — 아랫변 p1→p2 를 위로 h 만큼 뽑는다 */
  function wall(c, p1, p2, h, colTop, colBot) {
    c.beginPath();
    c.moveTo(p1.x, p1.y - h);
    c.lineTo(p2.x, p2.y - h);
    c.lineTo(p2.x, p2.y);
    c.lineTo(p1.x, p1.y);
    c.closePath();
    var wg = c.createLinearGradient(0, p1.y - h, 0, Math.max(p1.y, p2.y));
    wg.addColorStop(0, colTop);
    wg.addColorStop(1, colBot);
    c.fillStyle = wg;
    c.fill();
    /* 벽돌 줄눈 */
    c.strokeStyle = 'rgba(0,0,0,0.22)';
    c.lineWidth = 1;
    for (var k = 1; k < 4; k++) {
      var t = k / 4;
      c.beginPath();
      c.moveTo(p1.x + (p2.x - p1.x) * t, p1.y + (p2.y - p1.y) * t - h);
      c.lineTo(p1.x + (p2.x - p1.x) * t, p1.y + (p2.y - p1.y) * t);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(p1.x, p1.y - h * 0.5);
    c.lineTo(p2.x, p2.y - h * 0.5);
    c.stroke();
  }

  /** 앞쪽 낮은 턱 */
  function rim(c, p1, p2, h, col) {
    c.beginPath();
    c.moveTo(p1.x, p1.y - h);
    c.lineTo(p2.x, p2.y - h);
    c.lineTo(p2.x, p2.y);
    c.lineTo(p1.x, p1.y);
    c.closePath();
    c.fillStyle = col;
    c.globalAlpha = 0.55;
    c.fill();
    c.globalAlpha = 1;
  }

  function thingItem(items, o, icon) {
    if (!o) { return; }
    items.push({ z: o.x + o.y, kind: 'thing', o: o, icon: icon });
  }

  function drawThing(m, o, icon, now) {
    var p = proj(m, o.x, o.y);
    ctx.beginPath();
    isoEllipse(ctx, m, o.x, o.y, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.font = Math.round(22 * m.s + 8) + 'px "Malgun Gothic", system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(icon, p.x, p.y - 12 * m.s + Math.sin(now / 500) * 2);
  }

  /**
   * 마을 사람 하나 — **플레이어와 같은 붓**(sprite.stamp)으로 그린다.
   * 다른 붓을 쓰면 마을에서만 사람이 다르게 생겨서 곧바로 눈에 걸린다.
   * 이름표는 여기서 바로 그리지 않고 plates 에 얹는다 — 조명 뒤에 그려야
   * 어둠에 먹히지 않는다(바닥에 떨어진 물건 이름과 같은 처리다).
   */
  function drawNpc(m, o, now, plates, near) {
    var p = proj(m, o.x, o.y);
    var sf = m.s * 1.12;
    var z = Math.max(0.7, m.s);
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    isoEllipse(ctx, m, o.x, o.y, 12);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
    global.DG.sprite.stamp(ctx, {
      kind: 'human', ref: o.ref,
      x: p.x, y: p.y, s: 0.86 * sf, facing: o.facing,
      phase: o.phase, walking: false,
      color: o.color, look: global.DG.sprite.lookOf(o.ref), t: now
    });
    /* 멀면 **무슨 일을 하는 사람인지**만(그림 하나), 다가서면 이름까지.
       아홉을 다 이름으로 띄우면 폰에서 글자가 겹쳐 죄다 못 읽는다. */
    plates.push({ x: p.x, y: p.y - 44 * z,
      text: near ? (o.emoji + ' ' + o.name) : o.emoji, color: '#e6d3a6' });
    gesturePlate(plates, o.key, p.x, p.y - 60 * z, true);
  }

  /** 몸짓 글자(§5.16, `gesture.js`) — 3D 풍선과 같은 글자를 이름표 위에 띄운다 */
  function gesturePlate(plates, key, x, y, npc) {
    var GS = global.DG.gesture;
    var g = GS ? GS.plan(key, Date.now() / 1000, 'idle', npc) : null;
    if (g && g.text) { plates.push({ x: x, y: y - g.k * 6, text: g.text, color: '#ffe8a8' }); }
  }

  /**
   * 표식 하나 — 사람이 아니라 **밟는 자리**다. 굴혈 입구 · 역참 돌 · 결사비.
   * 발밑 고리가 숨 쉬듯 늘었다 줄어든다 — 원작의 웨이포인트가 그렇게 뛴다.
   * 이 고리가 없으면 바닥에 이모지 하나 놓인 것으로만 보여서 밟을 것인 줄 모른다.
   */
  function drawMark(m, o, now, plates, near) {
    var p = proj(m, o.x, o.y);
    var z = Math.max(0.7, m.s);
    var puls = 0.5 + Math.sin(now / 420) * 0.5;
    ctx.save();
    ctx.beginPath();
    isoEllipse(ctx, m, o.x, o.y, 15);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fill();
    ctx.beginPath();
    isoEllipse(ctx, m, o.x, o.y, 26 + puls * 5);
    ctx.strokeStyle = 'rgba(245,180,69,' + (0.18 + puls * 0.24).toFixed(3) + ')';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.font = Math.round(23 * m.s + 9) + 'px "Malgun Gothic", system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.emoji, p.x, p.y - 13 * m.s + Math.sin(now / 500) * 2);
    /* 표식은 바닥에 큰 그림이 이미 있다 — 멀면 이름표를 걸지 않는다 */
    if (near) {
      plates.push({ x: p.x, y: p.y - 38 * z, text: o.name, color: '#f5b445' });
    }
  }

  /** 벽에 걸린 횃불 하나 — 받침과 흔들리는 불꽃 */
  function drawTorch(m, o, now) {
    var p = proj(m, o.x, o.y);
    var z = Math.max(0.8, m.s);
    var base = p.y - 22 * z;
    /* 받침 */
    ctx.fillStyle = '#2b2018';
    ctx.fillRect(p.x - 2 * z, base, 4 * z, 12 * z);
    ctx.fillStyle = '#40301f';
    ctx.fillRect(p.x - 4 * z, base - 2 * z, 8 * z, 3 * z);
    /* 불꽃 — 세 겹 (겉 주황 · 속 노랑 · 심 흰빛) */
    var fl = Math.sin(now / 90 + o.seed) * 0.18 + Math.sin(now / 37 + o.seed * 2) * 0.08;
    var hgt = (13 + fl * 5) * z;
    function flame(w, h, col, off) {
      ctx.beginPath();
      ctx.moveTo(p.x, base - h - off);
      ctx.quadraticCurveTo(p.x + w, base - h * 0.35, p.x, base + 1);
      ctx.quadraticCurveTo(p.x - w, base - h * 0.35, p.x, base - h - off);
      ctx.fillStyle = col;
      ctx.fill();
    }
    flame(5.2 * z, hgt, 'rgba(226,96,20,0.92)', 0);
    flame(3.2 * z, hgt * 0.72, 'rgba(252,178,48,0.95)', 0);
    flame(1.6 * z, hgt * 0.40, 'rgba(255,240,190,0.95)', 0);
  }

  /** 항아리 — 성한 것은 배가 부르고, 깨진 것은 조각만 남는다 */
  function drawJar(m, o, now) {
    var p = proj(m, o.x, o.y);
    var z = Math.max(0.7, m.s);
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    isoEllipse(ctx, m, o.x, o.y, 7);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
    if (o.broken) {
      ctx.fillStyle = '#4a3a2a';
      ctx.beginPath();
      ctx.moveTo(p.x - 7 * z, p.y);
      ctx.lineTo(p.x - 2 * z, p.y - 5 * z);
      ctx.lineTo(p.x + 3 * z, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(p.x + 3 * z, p.y - 2 * z, 4 * z, 2 * z);
      return;
    }
    var jg = ctx.createLinearGradient(p.x - 8 * z, 0, p.x + 8 * z, 0);
    jg.addColorStop(0, '#3a2c1e');
    jg.addColorStop(0.42, '#6b5236');
    jg.addColorStop(1, '#2a2016');
    ctx.fillStyle = jg;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 8 * z, 7 * z, 9 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a3a26';
    ctx.fillRect(p.x - 3.5 * z, p.y - 18 * z, 7 * z, 3 * z);
  }

  function drawPillar(m, o, theme, wh) {
    var p = proj(m, o.x, o.y);
    var w = 10 * m.s, h = wh * 0.72;
    ctx.beginPath();
    isoEllipse(ctx, m, o.x, o.y, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    var pg = ctx.createLinearGradient(p.x - w, 0, p.x + w, 0);
    pg.addColorStop(0, shade(theme.wall, -0.35));
    pg.addColorStop(0.45, shade(theme.wall, 0.12));
    pg.addColorStop(1, shade(theme.wall, -0.5));
    ctx.fillStyle = pg;
    ctx.fillRect(p.x - w, p.y - h, w * 2, h);
    ctx.fillStyle = shade(theme.wall, -0.15);
    ctx.fillRect(p.x - w * 1.3, p.y - h - 4 * m.s, w * 2.6, 5 * m.s);
    ctx.fillRect(p.x - w * 1.3, p.y - 3 * m.s, w * 2.6, 4 * m.s);
  }

  function drawFoe(m, e, now, bars) {
    var ref = e.ref;
    var p = proj(m, e.x, e.y);
    var sf = m.s * 1.12;
    /* 원작에서 인물은 화면에 꽤 크게 선다 — 작게 두면 아이소 지도처럼 보인다 */
    var s = (e.boss ? 1.12 : 0.76) * sf;
    var isHuman = ref.kind !== 'beast';
    var bodyH = (isHuman ? 40 : 30) * s;
    /* eliteOf 는 dungeon.js 것을 직접 쓴다 — 위 renderFoe 의 사정과 같다 */
    var el = e.elite ? global.DG.dungeon.eliteOf(e.elite) : null;

    /* 발밑 그림자 — 이게 없으면 인물이 바닥에 안 붙고 떠 보인다.
       원작의 인물에는 늘 발밑 그늘이 있다. */
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.beginPath();
    isoEllipse(ctx, m, e.x, e.y, e.r * 0.95);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    ctx.save();
    if (e.hurt > 0) { ctx.globalAlpha = 0.65; }
    /* 빙(氷)에 걸린 적 — 발밑이 푸르다. 왜 굼떠졌는지 보여야 한다 */
    if (e.slow > 0) {
      ctx.save();
      ctx.globalAlpha = 0.30;
      ctx.beginPath();
      isoEllipse(ctx, m, e.x, e.y, e.r + 5);
      ctx.fillStyle = '#5fa8e8';
      ctx.fill();
      ctx.restore();
    }
    if (el) {
      /* 정예 — 발밑에 그 접두의 빛을 깐다 (원작에서 이름 색이 다른 그 신호) */
      ctx.save();
      ctx.globalAlpha = 0.22 + Math.abs(Math.sin(now / 420)) * 0.16;
      ctx.beginPath();
      isoEllipse(ctx, m, e.x, e.y, e.r + 8);
      ctx.strokeStyle = el.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    if (!(isHuman && global.DG.foe2d && global.DG.foe2d.draw(ctx, e, p, bodyH, now))) global.DG.sprite.stamp(ctx, {
      kind: isHuman ? 'human' : 'beast',
      ref: ref, key: ref.name,
      x: p.x, y: p.y, s: s, facing: -1,
      /* 어그로(2026-09-10) — 못 알아챈 적은 walking:false로 가만히 선 자세를
         쓴다(sprite.js가 이미 그 자세를 안다, 3D 쪽 dungeon3d.js의 'idle'과
         같은 결). 안 그러면 안 쫓아오는데 제자리서 걷는 시늉만 계속한다. */
      phase: e.phase, walking: !!e.aggro,
      color: ref.color, look: ref.look, form: ref.form,
      divine: !!ref.divine, t: now
    });
    ctx.restore();
    /* 원작은 적 머리 위에 아무것도 띄우지 않는다 — 이름은 화면 위쪽 한 줄
       (#d2-foe) 이 맡는다. 다만 **깎여 나간 적**은 표가 나야 하므로,
       한 대라도 맞은 적에게만 얇은 줄을 남긴다. */
    if (e.hp < e.hpMax) {
      bars.push({
        x: p.x, y: p.y - bodyH - 10,
        w: (e.boss ? 52 : (el ? 36 : 26)) * Math.max(0.8, m.s),
        p: core.clamp(e.hp / e.hpMax, 0, 1),
        boss: e.boss,
        name: null,
        color: el ? el.color : null
      });
    }
  }

  function drawPlayer(m, run, now) {
    var lead = core.save.party.length ? global.DG.data.find(core.save.party[0]) : null;
    var pl = run.player;
    var p = proj(m, pl.x, pl.y);
    var sf = m.s * 1.12;

    /* 발밑 그림자 (적과 같은 이유) */
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    isoEllipse(ctx, m, pl.x, pl.y, 12);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    /* 사거리 표시 (아주 옅게) + 사기 버프 고리 */
    ctx.beginPath();
    isoEllipse(ctx, m, pl.x, pl.y, d().status().reach + 12);
    ctx.strokeStyle = 'rgba(120,200,255,0.10)';
    ctx.lineWidth = 1; ctx.stroke();
    if (pl.rallyUntil > now) {
      ctx.beginPath();
      isoEllipse(ctx, m, pl.x, pl.y, 24 + Math.sin(now / 160) * 3);
      ctx.strokeStyle = 'rgba(240,180,90,0.55)';
      ctx.lineWidth = 2; ctx.stroke();
    }
    /* 마을에서는 **내가 누구인지**가 안 보인다 — 서 있는 사람이 아홉이고
       다 같은 붓으로 그려지기 때문이다. 발밑 금빛 고리 하나로 가른다.
       던전에서는 필요 없다(거기 서 있는 사람은 나 하나다). */
    if (run.town) {
      ctx.beginPath();
      isoEllipse(ctx, m, pl.x, pl.y, 19);
      ctx.strokeStyle = 'rgba(245,180,69,0.60)';
      ctx.lineWidth = 2; ctx.stroke();
    }

    ctx.save();
    if (pl.hurt > 0) { ctx.globalAlpha = 0.6; }
    if (pl.dash) { ctx.globalAlpha = 0.85; }
    if (lead) {
      var fac = global.DG.data.faction(lead.faction);
      global.DG.sprite.stamp(ctx, {
        kind: 'human', ref: lead,
        x: p.x, y: p.y, s: 0.88 * sf, facing: pl.facing,
        phase: pl.phase, walking: pl.walking || pl.atkAnim > 0,
        color: fac.color, look: global.DG.sprite.lookOf(lead), t: now
      });
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y - 10, 11 * sf, 0, Math.PI * 2);
      ctx.fillStyle = '#f5b445'; ctx.fill();
    }
    ctx.restore();
  }

  /** 동행(§51) — 부대 2번째 인물. drawPlayer 와 같은 결이나 마을 전용
   *  장식(사기 고리·황금 고리)은 뺐다(동행은 던전에서만 산다,
   *  buildFloor 참고 — 마을엔 run.companion 이 없다). */
  function drawCompanion(m, c, now, plates) {
    var ref = global.DG.data.find(c.id);
    if (!ref) { return; }
    var p = proj(m, c.x, c.y);
    var sf = m.s * 1.12;

    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    isoEllipse(ctx, m, c.x, c.y, 12);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    var fac = global.DG.data.faction(ref.faction);
    global.DG.sprite.stamp(ctx, {
      kind: 'human', ref: ref,
      x: p.x, y: p.y, s: 0.84 * sf, facing: c.facing,
      phase: c.phase, walking: c.walking || c.atkAnim > 0,
      color: fac.color, look: global.DG.sprite.lookOf(ref), t: now
    });
    if (plates) { gesturePlate(plates, 'ally', p.x, p.y - 44 * Math.max(0.7, m.s), false); }
  }

  /* ── 조명 레이어 ─────────────────────────────────────── */

  function drawLights(m, run, theme, now) {
    var c = lightCtx;
    c.clearRect(0, 0, m.cw, m.ch);
    /* 원작의 던전은 등불 반경 밖이 거의 검다 — 그 어둠이 "내려간다" 는 감각을 만든다.
       **마을은 그 반대다.** 불을 피워 두고 사람이 사는 자리라 훤하다 —
       던전과 같은 어둠을 씌우면 여섯 사람이 죄다 그림자에 잠겨 누가 누군지 안 보인다. */
    c.fillStyle = run.town ? 'rgba(3,3,6,0.30)' : 'rgba(2,2,4,0.74)';
    c.fillRect(0, 0, m.cw, m.ch);
    c.globalCompositeOperation = 'destination-out';

    /* 플레이어 빛 */
    hole(c, m, run.player.x, run.player.y, run.town ? 300 : 178, 1);

    /* 마을 표식 빛 — 밟을 자리는 멀리서도 보여야 간다 */
    var mks = run.room.marks || [];
    for (var mi = 0; mi < mks.length; mi++) {
      hole(c, m, mks[mi].x, mks[mi].y, 76, 0.8);
    }

    /* 횃불 빛 (일렁인다) */
    var dec = run.room.decor || [];
    for (var i = 0; i < dec.length; i++) {
      if (dec[i].t !== 'torch') { continue; }
      var fl = 0.72 + Math.sin(now / 140 + dec[i].seed) * 0.12;
      hole(c, m, dec[i].x, dec[i].y + 8, 118, fl);
    }
    /* 기공파 빛 */
    for (i = 0; i < run.shots.length; i++) {
      hole(c, m, run.shots[i].x, run.shots[i].y, 62, 0.9);
    }
    /* 열린 문 빛 */
    if (run.room.cleared) {
      for (i = 0; i < run.room.doors.length; i++) {
        hole(c, m, d().ROOM_W - 10, run.room.doors[i].y, 55, 0.7);
      }
    }

    /* 어둠을 뚫는 것으로 끝내지 않고 **불빛 색**을 덧댄다.
       원작의 횃불은 주황이고 그 언저리만 따뜻하다 — 이 한 겹이 없으면
       구멍만 뚫린 회색 무대가 된다. */
    c.globalCompositeOperation = 'lighter';
    glow(c, m, run.player.x, run.player.y, 170, 'rgba(255,186,112,0.085)');
    for (mi = 0; mi < mks.length; mi++) {
      glow(c, m, mks[mi].x, mks[mi].y, 80, 'rgba(255,196,96,0.10)');
    }
    for (i = 0; i < dec.length; i++) {
      if (dec[i].t !== 'torch') { continue; }
      var fw = 0.16 + Math.sin(now / 140 + dec[i].seed) * 0.05;
      glow(c, m, dec[i].x, dec[i].y + 8, 128, 'rgba(255,138,44,' + fw.toFixed(3) + ')');
    }
    for (i = 0; i < run.shots.length; i++) {
      glow(c, m, run.shots[i].x, run.shots[i].y, 60, 'rgba(120,200,255,0.12)');
    }
    if (run.room.cleared) {
      for (i = 0; i < run.room.doors.length; i++) {
        glow(c, m, d().ROOM_W - 10, run.room.doors[i].y, 58, 'rgba(255,196,96,0.11)');
      }
    }
    c.globalCompositeOperation = 'source-over';
  }

  /** 불빛 한 겹 — hole 과 같은 자리에 색을 얹는다 (composite 는 부르는 쪽이 정한다) */
  function glow(c, m, x, y, r, color) {
    var p = proj(m, x, y);
    var rx = r * 1.414 * IX * m.s, ry = r * 1.414 * IY * m.s;
    c.save();
    c.translate(p.x, p.y - 8 * m.s);
    c.scale(1, ry / rx);
    var g = c.createRadialGradient(0, 0, rx * 0.05, 0, 0, rx);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, rx, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  /** 어둠에 빛 구멍 하나 — 납작한 타원 그라디언트 */
  function hole(c, m, x, y, r, strength) {
    var p = proj(m, x, y);
    var rx = r * 1.414 * IX * m.s, ry = r * 1.414 * IY * m.s;
    c.save();
    c.translate(p.x, p.y - 8 * m.s);
    c.scale(1, ry / rx);
    var g = c.createRadialGradient(0, 0, rx * 0.12, 0, 0, rx);
    g.addColorStop(0, 'rgba(0,0,0,' + Math.min(1, strength) + ')');
    g.addColorStop(0.62, 'rgba(0,0,0,' + Math.min(1, strength * 0.55) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, rx, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  /* ── 연출 ─────────────────────────────────────────────── */

  /** 조명보다 아래 — 장면에 섞이는 것 (칼궤적·격파·돌진 잔상·회전참) */
  function drawFxUnder(m, f) {
    var p;
    if (f.t === 'slash') {
      p = proj(m, f.x, f.y);
      var a = (f.a || 0) * 0.5;              // 투영이 눕어 있어 각도를 죽인다
      ctx.save();
      ctx.translate(p.x, p.y - 10);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.arc(0, 0, 16 * Math.max(0.8, m.s), -0.7, 0.7);
      ctx.strokeStyle = f.crit ? 'rgba(255,220,120,' + (f.life / 0.16) + ')'
                               : 'rgba(240,245,255,' + (f.life / 0.16 * 0.85) + ')';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    } else if (f.t === 'fan') {
      /* §5.19 2차 원뿔 무예 — slash 와 같은 호를 크게 */
      p = proj(m, f.x, f.y);
      ctx.save();
      ctx.translate(p.x, p.y - 10);
      ctx.rotate((f.a || 0) * 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, (f.r || 50) * 0.5 * Math.max(0.8, m.s), -0.8, 0.8);
      ctx.strokeStyle = 'rgba(200,236,255,' + (f.life / 0.26 * 0.9) + ')';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
    } else if (f.t === 'pop') {
      ctx.beginPath();
      isoEllipse(ctx, m, f.x, f.y, (0.45 - f.life) * (f.boss ? 88 : 44));
      ctx.strokeStyle = 'rgba(255,220,150,' + (f.life / 0.45) + ')';
      ctx.lineWidth = 2; ctx.stroke();
    } else if (f.t === 'burst') {
      p = proj(m, f.x, f.y);
      var k = 1 - f.life / 0.5;
      ctx.save();
      ctx.globalAlpha = f.life / 0.5;
      ctx.fillStyle = f.color || '#c9a83a';
      for (var j = 0; j < (f.boss ? 10 : 6); j++) {
        var ang = f.seed + j * (6.283 / (f.boss ? 10 : 6));
        var rr = (10 + k * (f.boss ? 46 : 26)) * Math.max(0.8, m.s);
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(ang) * rr, p.y - 8 + Math.sin(ang) * rr * 0.5 - k * 14,
          (f.boss ? 3.4 : 2.4) * (1 - k * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (f.t === 'whirl') {
      ctx.beginPath();
      isoEllipse(ctx, m, f.x, f.y, f.r * (1.15 - f.life / 0.3 * 0.4));
      ctx.strokeStyle = 'rgba(150,220,255,' + (f.life / 0.3 * 0.8) + ')';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (f.t === 'pull') {
      /* §5.19 2차 끌어당기기 — 바깥에서 발밑으로 오그라드는 원 */
      ctx.beginPath();
      isoEllipse(ctx, m, f.x, f.y, Math.max(8, (f.r || 150) * (f.life / 0.35)));
      ctx.strokeStyle = 'rgba(180,140,255,' + (0.35 + 0.65 * f.life / 0.35) + ')';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (f.t === 'zone') {
      /* 예고 원(§5.18) — 제 크기에 서서 터질 때가 다가올수록 진해진다(불바닥은 고르게) */
      var zk = 1 - f.life / (f.max || 1);
      ctx.beginPath();
      isoEllipse(ctx, m, f.x, f.y, f.r || 40);
      ctx.globalAlpha = f.pool ? Math.min(1, f.life) * 0.35 : 0.12 + 0.3 * zk;
      ctx.fillStyle = f.color || '#ff6a3a';
      ctx.fill();
      ctx.globalAlpha = f.pool ? Math.min(1, f.life) * 0.8 : 0.4 + 0.6 * zk;
      ctx.strokeStyle = f.color || '#ff6a3a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (f.t === 'ring') {
      ctx.beginPath();
      isoEllipse(ctx, m, f.x, f.y, (0.55 - f.life) * 130);
      ctx.strokeStyle = 'rgba(240,180,90,' + (f.life / 0.55) + ')';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (f.t === 'trail') {
      p = proj(m, f.x, f.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10, 8 * (f.life / 0.22), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(150,220,255,' + (f.life / 0.22 * 0.3) + ')';
      ctx.fill();
    }
  }

  /** 조명 위 — 숫자·획득 문구 (어두워도 읽혀야 한다) */
  function drawFxOver(m, f) {
    var p;
    if (f.t === 'hit') {
      p = proj(m, f.x, f.y);
      var up = (0.6 - f.life) * 26;
      /* §5.8① 크리 숫자는 1.4배(13×1.4=18)·주황(2026-09-18, 3D fx3d.js 와 같은 색) */
      ctx.font = (f.crit ? '700 18px ' : '600 13px ') + D2_FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      /* 저항에 깎인 타격은 **흐린 잿빛**이다 — 숫자만 보고도 "안 통한다" 를 안다 */
      ctx.fillStyle = f.foe ? 'rgba(255,120,120,' + (f.life / 0.7) + ')'
                            : (f.crit ? 'rgba(255,140,60,' + (f.life / 0.6) + ')'
                                      : (f.resist ? 'rgba(150,150,160,' + (f.life / 0.6) + ')'
                                                  : 'rgba(255,255,255,' + (f.life / 0.6) + ')'));
      ctx.fillText((f.crit ? '★' : '') + f.v, p.x, p.y - 24 - up);
    } else if (f.t === 'elem') {
      /* 원소 피해 — 그 결의 색으로 뜬다. 독은 몇 초에 걸쳐 들어가므로 괄호를 씌운다 */
      p = proj(m, f.x, f.y);
      var eu = (0.6 - f.life) * 22;
      ctx.font = '700 12px ' + D2_FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = core.clamp(f.life / 0.6, 0, 1);
      ctx.fillStyle = f.color || '#fff';
      ctx.fillText((f.dot ? '(' + f.v + ')' : '' + f.v), p.x, p.y - 30 - eu);
      ctx.globalAlpha = 1;
    } else if (f.t === 'get') {
      p = proj(m, f.x, f.y);
      var uy = (1.1 - f.life) * 22;
      ctx.font = '600 11px ' + D2_FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = f.color || '#f0c45a';
      ctx.globalAlpha = core.clamp(f.life, 0, 1);
      ctx.fillText(f.text, p.x, p.y - 22 - uy);
      ctx.globalAlpha = 1;
    }
  }

  function roundedRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ── 루프에서 불린다 ─────────────────────────────────── */

  function update(dt) {
    if (!DG_) { DG_ = global.DG.dungeon; DD = global.DG.dungeonData; }
    var on = d().active();
    if (on && !shown) { show(); }
    if (!on && shown) { hide(); }
    if (!on) { return; }
    d().update(dt);
    renderHud();
    renderBottom();
    renderFoe();
    renderChoice();
  }

  function init() {
    DG_ = global.DG.dungeon;
    DD = global.DG.dungeonData;
    build();
    hide();
    global.addEventListener('resize', function () { if (shown) { resize(); } });
    /* 던전이 끝나면 화면을 내렸었다. 이제는 **마을이 그 자리를 받는다** —
       update() 가 d().active() 로 알아서 갈아 끼우므로, 마을이 없을 때만 내린다.
       여기서 무조건 hide 하면 던전에서 나온 순간 한 틱 검게 깜빡인다. */
    core.on('dungeon:end', function () {
      var T = global.DG.town;
      if (!T || !T.active()) { hide(); }
    });
  }

  global.DG = global.DG || {};
  global.DG.dungeonView = {
    init: init, update: update, draw: draw,
    show: show, hide: hide,
    shown: function () { return shown; },
    /** 키 배치 — 1~4 는 요대, 스킬은 여기 넷 (진단이 이 약속을 검사한다) */
    SKILL_KEYS: SKILL_KEYS,
    /** 자가진단용 — 투영이 정확히 역변환되는지 검증한다 */
    _proj: function (x, y) { return proj(metrics(), x, y); },
    _unproj: toRoom,
    /** 키 세팅(ui.js 의 '⌨️ 키설정' 시트가 읽고 쓴다) */
    keymap: keymap, beginRemap: beginRemap,
    remapping: function () { return remapping; }
  };
})(window);
