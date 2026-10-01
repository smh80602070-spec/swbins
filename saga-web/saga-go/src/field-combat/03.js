  /* ── 화면: HUD ────────────────────────────────────────── */
  function hide() {
    if (hudEl) { hudEl.classList.remove('show'); }
    if (document.body) { document.body.classList.remove('fc-on'); }
  }

  function buildHud() {
    hudEl = document.getElementById('field-hud');
    if (!hudEl) {
      hudEl = document.createElement('div');
      hudEl.id = 'field-hud';
      document.body.appendChild(hudEl);
    }
    hudEl.innerHTML =
      '<div class="fc-party"></div>' +
      '<div class="fc-acts">' +
        '<div class="fc-sta"><i></i></div>' +
        '<button class="fc-btn fc-burst" data-fc="burst"><span>폭발</span><em>Q</em><i class="fc-fill"></i></button>' +
        '<button class="fc-btn fc-skill" data-fc="skill"><span>스킬</span><em>E</em><i class="fc-cd"></i></button>' +
        '<button class="fc-btn fc-dodge" data-fc="dodge"><span>회피</span><em>␣</em></button>' +
        '<button class="fc-btn fc-atk" data-fc="attack"><span>⚔️</span><em>J</em></button>' +
        '<button class="fc-btn fc-aim" data-fc="aim" style="display:none"><span>🎯</span><em>R</em></button>' +
      '</div>';
    var btns = hudEl.querySelectorAll('[data-fc]');
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        b.addEventListener('pointerdown', function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          var k = b.getAttribute('data-fc'), r = act(k);
          if (k === 'attack' && !(r && r.plunge)) { holdStart(); }                // ⑲-2 누르고 있으면 강공격
        });
        if (b.getAttribute('data-fc') === 'attack') {
          ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { b.addEventListener(t, holdEnd); });
        }
      })(btns[i]);
    }
    numLayer = document.createElement('div');
    numLayer.className = 'fc-nums';
    hudEl.appendChild(numLayer);
    partyKeyPainted = '';
  }

  var partyKeyPainted = '';
  function paintParty() {
    var box = hudEl.querySelector('.fc-party');
    var key = S.party.map(function (m) { return m.id; }).join(',');
    if (key !== partyKeyPainted) {
      partyKeyPainted = key;
      var P3 = global.DG.portrait3d, html = '<div class="fc-guard"><i></i><b></b></div>';   // ⑲-1 결정 보호막 띠
      for (var i = 0; i < S.party.length; i++) {
        var m = S.party[i], h = m.id === '_me' ? null : data().find(m.id);
        var face = h && P3 && P3.img ? P3.img('hero', h, 40) : '<b>' + EL[m.el].icon + '</b>';
        html += '<button class="fc-mem" data-idx="' + i + '" style="--el:' + EL[m.el].color + '">' +
          '<span class="fc-face">' + face + '</span>' +
          '<span class="fc-meta"><small>' + (i + 1) + ' · ' + EL[m.el].icon + ' ' + m.name + '</small>' +
          '<span class="fc-hp"><i></i></span><span class="fc-en"><i></i></span></span></button>';
      }
      box.innerHTML = html;
      var mb = box.querySelectorAll('.fc-mem');
      for (var j = 0; j < mb.length; j++) {
        (function (b) {
          b.addEventListener('pointerdown', function (ev) { ev.preventDefault(); ev.stopPropagation(); act('swap', +b.getAttribute('data-idx')); });
        })(mb[j]);
      }
    }
    var gd = box.querySelector('.fc-guard');
    if (gd) {
      gd.classList.toggle('on', !!S.guard);
      if (S.guard) {
        gd.querySelector('i').style.width = Math.round(100 * S.guard.hp / S.guard.max) + '%';
        gd.querySelector('b').textContent = '🪨 ' + S.guard.hp + ' · ' + Math.ceil(S.guard.t) + '초';
      }
    }
    var rows = box.querySelectorAll('.fc-mem');
    for (var k = 0; k < rows.length; k++) {
      var mm = S.party[k];
      if (!mm) { continue; }
      rows[k].classList.toggle('on', k === S.active);
      rows[k].classList.toggle('down', mm.down);
      rows[k].querySelector('.fc-hp i').style.width = Math.round(100 * mm.hp / mm.hpMax) + '%';
      rows[k].querySelector('.fc-en i').style.width = Math.round(100 * mm.energy / ENERGY_MAX()) + '%';
    }
  }

  function paint(dt) {
    var pp = core().save.player.pos, TR = global.DG.treasure;
    var show = engaged(S) || !!nearestFoe(S, pp.x, pp.y, 22) || !!(TR && TR.wantsHud && TR.wantsHud(pp.x, pp.y)) || !!S.aim;   // ⑲-3 석등 곁에서도 스킬을 쓰게
    if (!hudEl) { buildHud(); }
    hudEl.classList.toggle('show', show);
    document.body.classList.toggle('fc-on', show);
    paintMarks();
    tickRings(dt);
    paintAim();
    if (!show) { return; }
    var ab = hudEl.querySelector('.fc-aim');                          // ⑲-22 활 인물일 때만 🎯
    if (ab) { ab.style.display = canAim(S) && aimOk() ? '' : 'none'; ab.classList.toggle('ready', !!S.aim); }
    /* ⑲-1 원소가 일곱으로 늘며 동행 원소가 새로 정해졌다 — 처음 한 번만 알린다(save.field.el7) */
    var fsv = fieldSave();
    if (!fsv.el7) { fsv.el7 = 1; toast('✨ 원소가 일곱(화·수·뇌·풍·빙·암·초)으로 늘었다 — 동행 원소가 새로 정해졌다'); core().persist(); }
    paintParty();
    var m = active(S);
    var sk = hudEl.querySelector('.fc-skill'), bu = hudEl.querySelector('.fc-burst');
    sk.style.setProperty('--el', EL[m.el].color);
    bu.style.setProperty('--el', EL[m.el].color);
    sk.querySelector('.fc-cd').style.height = Math.round(100 * Math.min(1, m.skillCd / (m.skCdMax || SKILL_CD()))) + '%';
    sk.querySelector('span').textContent = m.skillCd > 0 ? m.skillCd.toFixed(1) : EL[m.el].icon + ' ' + (m.kitS ? m.kitS.name : (SHAPES[m.shape] && m.shape !== 'circle' ? SHAPES[m.shape].name : '스킬'));
    var ready = m.energy >= ENERGY_MAX() && m.burstCd <= 0;
    bu.classList.toggle('ready', ready);
    bu.querySelector('.fc-fill').style.height = Math.round(100 * m.energy / ENERGY_MAX()) + '%';
    hudEl.querySelector('.fc-sta i').style.width = Math.round(S.stamina) + '%';
    paintBars();
  }

  /* ⑲-22 조준 화면 — 가운데 조준점 + 충전 막대(DOM), 잠긴 것 발밑 금빛 고리 · 날아가는 화살(3D, 코드 그림) */
  var aimEl = null;
  function paintAim() {
    var a = S.aim, w = W3(), T3 = w && w.three();
    if (!aimEl && document.body) {
      aimEl = document.createElement('div');
      aimEl.id = 'fc-aim';
      aimEl.style.cssText = 'position:fixed;left:50%;top:44%;transform:translate(-50%,-50%);pointer-events:none;z-index:40;display:none;text-align:center;' +
        'font:700 26px/1 sans-serif;color:#fff;text-shadow:0 0 4px #000';
      aimEl.innerHTML = '<div class="a-dot">◎</div><div style="width:84px;height:5px;margin:6px auto 0;background:rgba(0,0,0,.45);border-radius:3px;overflow:hidden">' +
        '<i style="display:block;height:100%;width:0;background:#e8e2d0"></i></div>';
      document.body.appendChild(aimEl);
    }
    if (aimEl) {
      aimEl.style.display = a ? '' : 'none';
      if (a) {
        var k = Math.min(1, a.t / AIM_FULL()), full = a.hold && k >= 1, bar = aimEl.querySelector('i');
        bar.style.width = Math.round((a.hold ? k : 0) * 100) + '%';
        bar.style.background = full ? (EL[active(S).el] ? EL[active(S).el].color : '#ffd24a') : '#e8e2d0';
        aimEl.querySelector('.a-dot').style.color = a.lock ? '#ffd24a' : '#ffffff';
      }
    }
    if (!w || !T3) { return; }
    if (a && a.lock) {
      if (!fx.aimRing) { fx.aimRing = ringMesh(1.1, '#ffd24a', 0.9); if (fx.aimRing) { w.addFx(fx.aimRing); } }
      if (fx.aimRing) { fx.aimRing.visible = true; fx.aimRing.position.set(a.lock.x, (w.standY ? w.standY(a.lock.x, a.lock.y) : 0) + 0.15, a.lock.y); }
    } else if (fx.aimRing) { fx.aimRing.visible = false; }
    var A = S.arrows || [];
    if (!fx.arrows) { fx.arrows = []; }
    while (fx.arrows.length < A.length) {
      var am = new T3.Mesh(new T3.CylinderGeometry(0.03, 0.03, 0.9, 5), new T3.MeshBasicMaterial({ color: 0xf2ead8 }));
      am.rotation.order = 'YXZ';
      fx.arrows.push(w.addFx(am));
    }
    for (var i = 0; i < fx.arrows.length; i++) {
      var mesh = fx.arrows[i], r = A[i];
      mesh.visible = !!r;
      if (!r) { continue; }
      mesh.position.set(r.x, (w.standY ? w.standY(r.x, r.y) : 0) + 1.35, r.y);
      mesh.rotation.set(Math.PI / 2, Math.atan2(r.dx, r.dy), 0);
      mesh.material.color.set(r.full && EL[r.m.el] ? EL[r.m.el].color : '#f2ead8');
    }
  }

  /* 3D 좌표 → 화면 좌표. 3D 가 없으면 null(2D 에선 숫자를 내 머리 위에 띄운다) */
  function toScreen(x, y, up) {
    var w = W3();
    if (!w) { return null; }
    var T3 = w.three(), cam = w.camNode();
    if (!T3 || !cam) { return null; }
    var gy = w.standY ? w.standY(x, y) : (w.groundY ? w.groundY(x, y) : 0);
    var v = new T3.Vector3(x, gy + (up || 2), y).project(cam);
    if (v.z > 1) { return null; }
    return { x: (v.x + 1) / 2 * global.innerWidth, y: (1 - v.y) / 2 * global.innerHeight };
  }

  function floatNum(x, y, text, el, scale, bold, mine) {
    if (!numLayer || global.DG_NO_DRAW) { return; }
    var p = toScreen(x, y, 2.4) || { x: global.innerWidth / 2 + (Math.random() - 0.5) * 60, y: global.innerHeight * 0.42 };
    var n = document.createElement('span');
    n.className = 'fc-num' + (bold ? ' big' : '') + (mine ? ' mine' : '');
    n.textContent = text;
    n.style.left = Math.round(p.x + (Math.random() - 0.5) * 24) + 'px';
    n.style.top = Math.round(p.y) + 'px';
    n.style.color = el ? EL[el].color : (mine ? '#ff8080' : '#ffe9a8');
    n.style.fontSize = Math.round(16 * (scale || 1)) + 'px';
    numLayer.appendChild(n);
    setTimeout(function () { if (n.parentNode) { n.parentNode.removeChild(n); } }, 900);
  }

  var barEls = {};
  function paintBars() {
    var seen = {}, L = living(S), pos = core().save.player.pos;
    for (var i = 0; i < L.length; i++) {
      var f = L[i];
      if (Math.hypot(f.x - pos.x, f.y - pos.y) > 30) { continue; }
      var F = FOES[f.kind];
      var p = toScreen(f.x, f.y, F.h * 1.9 + 0.4);
      if (!p) { continue; }
      var b = barEls[f.uid];
      if (!b) {
        b = barEls[f.uid] = document.createElement('div');
        b.className = 'fc-bar' + (F.boss || F.hero ? ' boss' : '');
        b.innerHTML = '<small></small><span class="fc-bhp"><i></i></span><span class="fc-bsh"><i></i></span>';
        numLayer.appendChild(b);
      }
      seen[f.uid] = true;
      b.style.left = Math.round(p.x) + 'px';
      b.style.top = Math.round(p.y) + 'px';
      var layerTxt = f.layers && f.layers.length > 1 && f.shield > 0 ? ' 🛡️' + f.layers.slice(f.layer).map(function (x) { return EL[x].icon; }).join('') : '';
      b.querySelector('small').textContent = (f.aura ? EL[f.aura].icon + ' ' : '') + f.name + ' Lv.' + (f.tier * 5 + lvAddOf(f.wl)) + layerTxt + (f.stun > 0 ? ' 💫' : '');
      b.querySelector('.fc-bhp i').style.width = Math.round(100 * f.hp / f.hpMax) + '%';
      var sh = b.querySelector('.fc-bsh');
      sh.style.display = f.shieldMax ? '' : 'none';
      if (f.shieldMax) {
        sh.querySelector('i').style.width = Math.round(100 * f.shield / f.shieldMax) + '%';
        sh.style.setProperty('--el', EL[f.shEl].color);
      }
    }
    for (var k in barEls) {
      if (barEls.hasOwnProperty(k) && !seen[k]) {
        if (barEls[k].parentNode) { barEls[k].parentNode.removeChild(barEls[k]); }
        delete barEls[k];
      }
    }
  }

  /* ── 화면: 3D 원(예고·광역) ─────────────────────────────── */
  function ringMesh(r, color, opacity) {
    var w = W3(), T3 = w && w.three();
    if (!T3) { return null; }
    var g = new T3.RingGeometry(Math.max(0.05, r - 0.18), r, 40);
    g.rotateX(-Math.PI / 2);
    var mat = new T3.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false, side: T3.DoubleSide });
    var mesh = new T3.Mesh(g, mat);
    mesh.renderOrder = 5;
    return mesh;
  }
  function ring(x, y, r, color, life) {
    var w = W3();
    if (!w || global.DG_NO_DRAW) { return; }
    var mesh = ringMesh(r, color, 0.9);
    if (!mesh) { return; }
    mesh.position.set(x, (w.standY ? w.standY(x, y) : (w.groundY ? w.groundY(x, y) : 0)) + 0.12, y);
    mesh.scale.setScalar(0.35);
    w.addFx(mesh);
    fx.rings.push({ mesh: mesh, t: 0, life: life || 0.4 });
  }
  function tickRings(dt) {
    var w = W3();
    for (var i = fx.rings.length - 1; i >= 0; i--) {
      var R = fx.rings[i];
      R.t += dt;
      var k = Math.min(1, R.t / R.life);
      R.mesh.scale.setScalar(0.35 + 0.65 * Math.sqrt(k));
      R.mesh.material.opacity = 0.9 * (1 - k);
      if (k >= 1) {
        if (w) { w.removeFx(R.mesh); }
        R.mesh.geometry.dispose(); R.mesh.material.dispose();
        fx.rings.splice(i, 1);
      }
    }
  }
  /** 적 예고 — 떨어질 자리를 붉은 원으로. 예고가 차오를수록 짙어진다 */
  function paintMarks() {
    var w = W3(), seen = {}, k;
    if (!w) { return; }
    var L = living(S);
    for (var i = 0; i < L.length; i++) {
      var f = L[i];
      if (!f.mark) { continue; }
      /* ⑲-16 밀물처럼 원이 여럿이면 원마다 표식 하나(키 uid:j) */
      var ML = f.mark.list || [f.mark];
      for (var j = 0; j < ML.length; j++) { paintMark(w, f, ML[j], j ? f.uid + ':' + j : f.uid, seen); }
    }
    for (k in fx.marks) {
      if (fx.marks.hasOwnProperty(k) && !seen[k]) {
        var mm = fx.marks[k];
        if (mm) { w.removeFx(mm); mm.geometry.dispose(); mm.material.dispose(); }
        delete fx.marks[k];
      }
    }
  }
  function paintMark(w, f, q, key, seen) {
    seen[key] = true;
    var M = fx.marks[key];
    if (!M) {
      M = fx.marks[key] = ringMesh(f.mark.r, '#ff3b3b', 0.3);
      if (!M) { return; }
      var T3 = w.three();
      /* ⑲-20 고리는 안쪽이 빈 판 + 안쪽 테 — 빈 곳이 피할 자리다 */
      var disk = new T3.Mesh((f.mark.inner ? new T3.RingGeometry(f.mark.inner, f.mark.r, 48) : new T3.CircleGeometry(f.mark.r, 40)).rotateX(-Math.PI / 2),
        new T3.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.15, depthWrite: false, side: T3.DoubleSide }));
      M.add(disk);
      if (f.mark.inner) { var inn = ringMesh(f.mark.inner, '#ff3b3b', 0.8); if (inn) { M.add(inn); } }
      M.userData.disk = disk; M.userData.halo = !!f.mark.inner;
      w.addFx(M);
    }
    M.position.set(q.x, (w.standY ? w.standY(q.x, q.y, !!f.sky) : (w.groundY ? w.groundY(q.x, q.y) : 0)) + 0.1, q.y);
    var prog = 1 - Math.max(0, f.stT) / (f.mark.t || 1);
    M.material.opacity = 0.35 + 0.55 * prog;
    M.userData.disk.scale.setScalar(M.userData.halo ? 1 : Math.max(0.05, prog));
    M.userData.disk.material.opacity = 0.18 + 0.2 * prog;
  }

  /* ⑲-2 공격 누르고 있기 — 0.4초 넘으면 강공격 한 번(떼면 풀린다) */
  var holdTimer = null;
  function holdStart() {
    holdEnd();
    holdTimer = setTimeout(function () { holdTimer = null; act('heavy'); }, CHARGE_HOLD() * 1000);
  }
  function holdEnd() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    /* ⑲-22 조준 충전 중에 떼면 쏜다 — 길게 눌러 들어온 조준이면 쏘고 나온다 */
    if (S && S.aim && S.aim.hold && on() && core() && core().save) {
      var pos = core().save.player.pos, auto = S.aim.auto;
      aimShoot(S, pos.x, pos.y);
      if (auto) { aimEnd(S); }
      handle(drain(S), pos);
    }
  }
  /** ⑲-22 조준은 키보드 판만(GPS 판은 몸이 걷는다) */
  function aimOk() { var W = global.DG.world; return !!(W && W.mode === 'keyboard'); }
  /** landform 이 걸음 대신 부른다 — 조준 중이면 방향 키가 겨눈 쪽을 돌린다 */
  function aimSteerRt(ux, uy, dt) { return !!(S && S.aim && aimSteer(S, ux, uy, dt)); }
  function aimView() {
    if (!S || !S.aim) { return null; }
    var a = S.aim;
    return { dx: a.dx, dy: a.dy, t: a.t, hold: a.hold, full: a.hold && a.t >= AIM_FULL() - 1e-9, k: Math.min(1, a.t / AIM_FULL()), lock: a.lock };
  }
  /** ⑲-2 landform 이 내리꽂기 착지 때 부른다 — 떨어진 높이(m) */
  function plungeLand(fell) {
    if (!on() || !core() || !core().save) { return { ok: false }; }
    ensureState();
    var pos = core().save.player.pos, r = plunge(S, pos.x, pos.y, fell);
    handle(drain(S), pos);
    return r;
  }

  /* ── 입력: 키 ─────────────────────────────────────────── */
  function bindKeys() {
    if (bound) { return; }
    bound = true;
    global.addEventListener('keyup', function (e) { if (e.key && e.key.toLowerCase() === 'j') { holdEnd(); } });
    global.addEventListener('keydown', function (e) {
      if (!S || !on() || e.repeat) { return; }
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { return; }
      if (blocked()) { return; }
      var k = e.key.toLowerCase();
      var nearby = engaged(S) || !!nearestFoe(S, core().save.player.pos.x, core().save.player.pos.y, 22);
      if (k === 'j') { var ra = act('attack'); if (!(ra && ra.plunge)) { holdStart(); } }
      else if (k === 'e') { act('skill'); }
      else if (k === 'r') { act('aim'); }                             // ⑲-22 활 조준
      else if (k === 'q') { act('burst'); }
      else if (k === ' ' && nearby) { e.preventDefault(); act('dodge'); }
      else if (k >= '1' && k <= '4' && nearby) { act('swap', +k - 1); }
    });
  }

  /** 3D 배우 목록 — `world3d.js` 가 매 프레임 읽는다 */
  function live() {
    if (!S || !on()) { return []; }
    var out = [], D = data();
    for (var k in S.foes) {
      if (!S.foes.hasOwnProperty(k)) { continue; }
      var f = S.foes[k], F = FOES[f.kind];
      var ref = F.body ? { id: F.body, name: F.name, rarity: 5, trait: 'might', color: '#26222e' }     // ⑲-14 이야기 보스 — 고정 사람 몸
        : ((D && D.find && D.find(f.heroId || F.ref)) || { id: 'fc_' + f.kind, name: F.name, kind: 'beast', rarity: 2, form: 'boar' });
      out.push({ uid: f.uid, x: f.x, y: f.y, h: F.h, ref: ref, moving: f.moving, phase: f.phase,
        dead: f.dead, deadT: f.deadT, stun: f.stun > 0 && f.st !== 'yield', el: f.el, aura: f.aura, boss: !!F.boss,
        hero: !!(F.hero || F.body), mask: F.mask || null, yielded: f.st === 'yield', sky: !!f.sky });
    }
    return out;
  }

  /**
   * ⑯ 싸워서 등용 — 들판 인물을 눌렀을 때(encounter.js startHero). 3D 들판 전투가 도는 자리에서만 true
   * (2D·진단(DG_NO_DRAW)은 옛 설득 카드). 판은 인물이 서 있던 자리에 선다 — 끝나면 'duelEnd'(win·lose·flee)
   */
  function canChallenge() { return !!(on() && core() && core().save && W3() && !(S && S.duel)); }
  function challenge(spawn) {
    if (!canChallenge() || !spawn || !spawn.ref) { return false; }
    ensureState();
    var c = duelCamp(spawn.ref, spawn.x, spawn.y, spawn.uid);
    if (S.camps[c.key]) { return false; }
    spawnCamp(S, c);
    var cp = S.camps[c.key];
    S.duel = { uid: cp.uids[0], camp: c.key, spawnUid: spawn.uid, heroId: spawn.ref.id, wiped: false };
    for (var i = 0; i < cp.uids.length; i++) { wake(S.foes[cp.uids[i]]); }
    return true;
  }
  function duelSpawn() { return S && S.duel ? S.duel.spawnUid : null; }

  /** 지도 위 아바타로 설 사람 — 교체하면 바뀐다(없으면 null → 동행 선두) */
  function leadId() {
    if (!S || !on()) { return null; }
    var m = active(S);
    return m && m.id !== '_me' ? m.id : null;
  }

  function init() { bindKeys(); }

  global.DG = global.DG || {};
  global.DG.fieldCombat = {
    EL: EL, FOES: FOES, ROT: ROT, SHADOW_BACK: SHADOW_BACK, RIFT_STEP: RIFT_STEP, RIFT_SLOPE: RIFT_SLOPE, riftOk: riftOk, SIEGE_PULL: SIEGE_PULL, tideMarks: tideMarks, markHit: markHit, foeAtk: foeAtk, KB_T: KB_T, knock: knock, rainFollow: rainFollow, THEMES: THEMES, ELITES: ELITES, ERA_THEMES: ERA_THEMES, ERA_ELITES: ERA_ELITES, eraOfCamp: eraOfCamp, CELL: CELL, ENERGY_MAX: ENERGY_MAX,
    SKILL_CD: SKILL_CD, SWAP_CD: SWAP_CD, BODY: BODY, separate: separate, DODGE_COST: DODGE_COST, VAPOR_MUL: VAPOR_MUL,
    /* 판정 층 — 화면 없이 굴린다(자가진단이 쓰는 문) */
    elementOf: elementOf, EL_KEYS: EL_KEYS, heavy: heavy, plunge: plunge, plungeMul: plungeMul, plungeLand: plungeLand, PLUNGE_R: PLUNGE_R(), CHARGE_COST: CHARGE_COST(), REACT: REACT, attaches: attaches, shapeOf: shapeOf, SHAPES: SHAPES, kitFor: kitFor, segDist: segDist, react: react, shieldMul: shieldMul, campAt: campAt, tierAt: tierAt, guardianAt: guardianAt, COUNTER: COUNTER,
    autoThreat: autoThreat, create: create, reparty: reparty, populate: populate, spawnCamp: spawnCamp, step: step, drain: drain,
    attack: attack, skill: skill, burst: burst, dodge: dodge, swap: swap, hitFoe: hitFoe,
    canAim: canAim, aimStart: aimStart, aimEnd: aimEnd, aimSteer: aimSteer, aimHold: aimHold, aimShoot: aimShoot, aimLock: aimLock, stepArrows: stepArrows,
    AIM_R: AIM_R(), AIM_FULL: AIM_FULL(), AIM_PART: AIM_PART(), AIM_FULLMUL: AIM_FULLMUL(), ARROW_V: ARROW_V(), ARROW_RANGE: ARROW_RANGE(),
    aiming: function () { return !!(S && S.aim); }, aimSteerRt: aimSteerRt, aimView: aimView, aimCancel: function () { return !!(S && aimEnd(S)); },
    engaged: engaged, inCombat: inCombat, COMBAT_R: COMBAT_R, living: living, memberOf: memberOf, applyWorld: applyWorld, rescaleWorld: rescaleWorld, killGold: killGold, clearLoot: clearLoot,
    guardBack: guardBack, duelCamp: duelCamp, canChallenge: canChallenge, challenge: challenge, duelSpawn: duelSpawn,
    /* 런타임 */
    init: init, tick: tick, act: act, live: live, leadId: leadId,
    state: function () { return S; },
    _setStateForTest: function (st) { S = st; },
    _resetForTest: function () { S = null; partyKey = ''; popAcc = 9; }
  };
})(window);
