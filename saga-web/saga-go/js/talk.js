/**
 * 말 걸기 — 주민과 짐승을 눌러 본다
 * ---------------------------------------------------------------
 * PHASE 6·7 에서 이 땅에 사람 열과 짐승 다섯 종을 들였는데, **눌러서 여는 창이
 * 없었다.** 지나가며 한 마디를 듣고 짐승이 도망갈 뿐이었다. 그 자리를 안 만든 것은
 * `world.js` 의 **조우 판정에 손대야 했기 때문**이다 — 잡고 설득하는 그 판정은
 * 이 판의 심장이라 조심스러웠다.
 *
 * 그래서 이렇게 넣는다: **스폰·역참·성채가 아무것도 안 잡혔을 때만** 주민·짐승을
 * 본다. 눌러서 잡히는 것들의 순서는 한 치도 안 바뀐다 — 여태 "빈 땅" 으로 흘러가
 * 그쪽으로 걸어가던 자리에 한 겹이 끼어들 뿐이다.
 *
 * **잡히지도 설득되지도 않는다.** 카드에 미니게임이 없고 버튼은 '닫는다' 뿐이다.
 * 주민은 제 일과와 한 마디를 보여 주고, 짐승은 습성과 지금 놀랐는지를 보여 준다.
 * 여기서 세이브가 바뀌는 것은 **발견 도장**(`codex.js`) 하나뿐이고, 그것도 보상이
 * 아니다. 손잡이 `talk.on` 을 0 으로 두면 예전처럼 빈 땅으로 흘러간다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /** 눌러서 열까 — 0 이면 예전처럼 그 자리로 걸어간다 */
  function on() { return core.tuned('talk.on', 1) ? true : false; }
  /** 주민은 이만큼 안에서 눌러야 창이 열린다(m). 밖이면 그쪽으로 걸어간다 */
  function NPC_R() { return core.tuned('talk.npcRange', 18); }
  /** 짐승은 조금 더 멀리서도 본다 — 다가가면 도망가는 것이 있어서다 */
  function BEAST_R() { return core.tuned('talk.beastRange', 26); }

  /**
   * 이 자리에서 가장 가까운 주민·짐승 — **순수하게 고르기만** 한다.
   * `world.js` 가 누른 자리(월드 좌표)와 잡는 반경을 준다.
   */
  function pick(wx, wy, hitR) {
    if (!on()) { return null; }
    var pos = core.save.player.pos;
    var best = null, bd = Infinity, i;

    var N = global.DG.npc;
    if (N && N.on()) {
      var ns = N.live(pos);
      for (i = 0; i < ns.length; i++) {
        var d = Math.hypot(ns[i].x - wx, ns[i].y - wy);
        if (d < hitR && d < bd) { bd = d; best = { kind: 'npc', it: ns[i] }; }
      }
    }
    var A = global.DG.animal;
    if (A && A.on()) {
      var bs = A.live(pos);
      for (i = 0; i < bs.length; i++) {
        /* 짐승은 작아서 손가락으로 집기 어렵다 — 잡는 범위를 조금 넉넉히 */
        var bdd = Math.hypot(bs[i].x - wx, bs[i].y - wy);
        if (bdd < hitR * 1.3 && bdd < bd) { bd = bdd; best = { kind: 'beast', it: bs[i] }; }
      }
    }
    return best;
  }

  /* ── 카드 ─────────────────────────────────────────────
   * 조우·역참·성채가 쓰는 **같은 `#encounter` 한 칸**을 쓴다. 하나만 열린다는
   * 규칙이 그 한 칸으로 지켜지고 있다.
   */
  function host() { return document.getElementById('encounter'); }
  function busy() { var el = host(); return !!(el && el.classList.contains('show')); }

  function close() {
    var el = host();
    if (el) { el.classList.remove('show'); el.innerHTML = ''; }
    core.emit('changed');
  }

  function card(html) {
    var el = host();
    if (!el) { return false; }
    el.innerHTML = '<div class="enc-card">' + html +
      '<button class="btn primary wide" data-act="ok">닫는다</button></div>';
    el.classList.add('show');
    var ok = el.querySelector('[data-act="ok"]');
    if (ok) { ok.addEventListener('click', close); }
    return true;
  }

  /**
   * '로' 냐 '으로' 냐 — 받침이 없거나 ㄹ 이면 '로'. 자리 이름이 열한 가지라
   * 손으로 적어 두면 하나만 늘려도 어긋난다(사가천하에서 조사가 어긋나 고쳤던 그 건).
   */
  function josaRo(name) {
    var c = String(name || '').charCodeAt(String(name).length - 1);
    if (!(c >= 0xac00 && c <= 0xd7a3)) { return '로'; }   // 한글이 아니면 그냥 '로'
    var jong = (c - 0xac00) % 28;
    return (jong === 0 || jong === 8) ? '로' : '으로';    // 8 = ㄹ
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ── 길 행동(W-0276, 옥토패스 트래블러식) ─────────────
   * 선두 동행(`save.party[0]`)의 무력·지력·통솔 중 가장 높은 축이 마을 사람에게 하는 한 가지를 정한다:
   *   지력 → 조사(가까운 숨은 터를 방향·거리로) · 무력 → 도발(그 자리 결투, 이기면 금) · 통솔 → 이끌기(가까운 명소로 앞장 — 걸어감)
   * 마을 사람마다 하루 한 번(`save.path = { day, used: { 사람id: 1 | -1 } }`). 조사·이끌기는 30% 로 거절당하고,
   * 도발은 지면 거절과 같다 — 거절한 사람은 그날 다시 말을 섞지 않는다(-1). 손잡이 `talk.pathFail`(0.3) · `talk.provokeHpMul`(14)
   */
  var PATH = {
    wisdom: { key: 'probe', name: '조사', icon: '🔎' },
    might: { key: 'provoke', name: '도발', icon: '⚔️' },
    command: { key: 'lead', name: '이끌기', icon: '🧭' }
  };
  function leadHero() {
    var id = (core.save.party || [])[0], hs = (global.DG.data && global.DG.data.heroes) || [], i;
    if (!id) { return null; }
    for (i = 0; i < hs.length; i++) { if (hs[i].id === id) { return hs[i]; } }
    return null;
  }
  /** 이 인물의 길 행동 — 무력·지력·통솔 중 가장 높은 축(같으면 지력 → 무력 → 통솔 순) */
  function pathOf(h) {
    if (!h || !h.stats) { return null; }
    var s = h.stats, k = 'wisdom';
    if ((s.might || 0) > (s[k] || 0)) { k = 'might'; }
    if ((s.command || 0) > (s[k] || 0)) { k = 'command'; }
    return PATH[k];
  }
  function today() { var D = global.DG.daily; return D && D.dayKey ? D.dayKey() : new Date().toDateString(); }
  function pathState() {
    var s = core.save.path;
    if (!s || s.day !== today()) { s = core.save.path = { day: today(), used: {} }; }
    return s;
  }
  /** 0 아직 · 1 오늘 했다 · -1 거절(오늘 말을 안 섞는다) */
  function pathUsed(id) { return pathState().used[id] || 0; }
  /** 화면 위(-y)가 북 */
  function compass(dx, dy) {
    var a = Math.atan2(dx, -dy) * 180 / Math.PI; if (a < 0) { a += 360; }
    return ['북', '북동', '동', '남동', '남', '남서', '서', '북서'][Math.round(a / 45) % 8];
  }
  function refuse(st, p) {
    st.used[p.id] = -1;
    core.emit('toast', '🙅 ' + p.name + '이(가) 고개를 돌립니다 — 오늘은 말을 섞지 않겠답니다');
  }
  /** 길 행동 하나 — 카드 단추가 부른다. 진단도 그대로 부른다 */
  function doPath(n) {
    var p = n.p, act = pathOf(leadHero());
    if (!act) { return { ok: false, why: '동행이 없다' }; }
    var st = pathState();
    if (st.used[p.id]) { return { ok: false, why: '오늘은 이미' }; }
    var pos = core.save.player.pos, h = leadHero();
    if (act.key !== 'provoke' && Math.random() < core.tuned('talk.pathFail', 0.3)) {
      refuse(st, p); core.persist(); close();
      return { ok: false, why: 'refused', act: act.key };
    }
    st.used[p.id] = 1;
    var out = { ok: true, act: act.key };
    if (act.key === 'probe') {
      var DM = global.DG.domain, g0 = DM && DM.nearest ? DM.nearest() : null, g = g0 ? (g0.d || g0) : null;   // nearest() = { d, dist, inRange }
      if (g) {
        out.target = { x: g.x, y: g.y, name: g.name };
        core.emit('toast', '🔎 ' + p.name + ': "' + (g.name || '숨은 터') + '" — ' + compass(g.x - pos.x, g.y - pos.y) + '쪽 ' + Math.round(Math.hypot(g.x - pos.x, g.y - pos.y)) + 'm 에 있다더군요');
      } else {
        core.emit('toast', '🔎 ' + p.name + ': 이 근처엔 숨은 터가 없다고 합니다');
      }
      core.emit('path:probe', out.target || null);
    } else if (act.key === 'lead') {
      var L = global.DG.land, ps = L && L.places ? L.places().filter(function (q) { return q && !q.hidden; }) : [], best = null, bd = Infinity;
      ps.forEach(function (q) { var d = Math.hypot(q.x - pos.x, q.y - pos.y); if (d > 40 && d < bd) { bd = d; best = q; } });
      if (best) {
        out.target = { x: best.x, y: best.y, name: best.name };
        if (global.DG.world && global.DG.world.walkTo) { global.DG.world.walkTo(best.x, best.y); }
        core.emit('toast', '🧭 ' + p.name + ': "' + best.name + '"까지 앞장서지요 · ' + Math.round(bd) + 'm');
      } else {
        core.emit('toast', '🧭 ' + p.name + ': 가 볼 만한 곳이 가까이엔 없습니다');
      }
      core.emit('path:lead', out.target || null);
    } else {
      var Du = global.DG.duel, pw = global.DG.hero && global.DG.hero.partyPower ? global.DG.hero.partyPower() : { atk: 40, def: 200 };
      out.foeHp = Math.max(1, Math.round((pw.atk || 40) * core.tuned('talk.provokeHpMul', 14)));
      close();
      if (Du && Du.open) {
        Du.open({
          title: '⚔️ 도발 — ' + p.name, foeName: p.name, foeHp: out.foeHp, myAtk: pw.atk, myDef: pw.def,
          onDone: function (r) {
            if (r && r.cleared) { core.save.player.gold += 30; core.emit('toast', '⚔️ ' + p.name + '을(를) 꺾었습니다 · 금 +30'); }
            else { refuse(pathState(), p); }
            core.persist(); core.emit('changed');
          }
        });
      }
    }
    core.emit('path:act', { act: act.key, who: p.id, by: h ? h.id : null });
    core.persist();
    if (act.key !== 'provoke') { close(); }
    return out;
  }

  /** 주민 카드 — 누구고, 지금 어디로 가는 길이고, 무슨 말을 하는가 */
  function openNpc(n) {
    var N = global.DG.npc, L = global.DG.land;
    var p = n.p;
    var spot = L ? L.place(n.at) : null;
    var line = N.say(p) || '…';
    var where = spot
      ? (n.walking ? esc(spot.name) + josaRo(spot.name) + ' 가는 길'
                   : esc(spot.name) + '에 있다')
      : '';
    var CX = global.DG.codex;
    if (CX) { CX.discover('people', p.id, { name: p.name }); }
    var used = pathUsed(p.id), h = leadHero(), act = pathOf(h);
    if (used < 0) { line = '…(오늘은 말을 섞지 않으려 합니다)'; }
    var pathBtn = act
      ? '<button class="btn wide" data-act="path"' + (used ? ' disabled' : '') + '>' + act.icon + ' ' + esc(h.name) + ' · ' + act.name + (used > 0 ? ' — 오늘 했다' : used < 0 ? ' — 거절당함' : '') + '</button>'
      : '';
    var okCard = card(
      '<div class="enc-big">' + global.DG.portrait3d.img('hero', p, 96) + '</div>' +
      '<h3>' + esc(p.name) + '</h3>' +
      '<p class="quote">"' + esc(line) + '"</p>' +
      '<div class="enc-reward">' + esc(p.personality) +
        (where ? ' · ' + where : '') + ' · ' + Math.round(n.dist) + 'm</div>' +
      '<small class="muted">이 마을 사람입니다 — 잡거나 설득할 수는 없습니다. 선두 동행이 길 행동을 하루 한 번 할 수 있습니다.</small>' +
      pathBtn
    );
    var b = host() && host().querySelector('[data-act="path"]');
    if (b) { b.addEventListener('click', function () { doPath(n); }); }
    return okCard;
  }

  /** 짐승 카드 — 무엇이고, 어떤 습성이고, 지금 나를 알아챘는가 */
  function openBeast(b) {
    var A = global.DG.animal;
    var K = b.kind;
    var ref = A.refOf(K);
    var act = K.act === 'flee' ? '다가가면 물러납니다'
      : K.act === 'chase' ? '알아채면 다가옵니다'
      : K.act === 'fly' ? '인기척에 날아오릅니다'
      : '사람을 봐도 그대로입니다';
    var mood = b.alarm > 0.5 ? '이쪽을 보고 있습니다'
      : (b.alarm > 0.05 ? '기척을 느낀 듯합니다' : '아직 못 알아챘습니다');
    var CX = global.DG.codex;
    if (CX) { CX.discover('beast', K.id, { name: K.name }); }
    return card(
      '<div class="enc-big">' + global.DG.portrait3d.img('pet', ref, 96) + '</div>' +
      '<h3>' + esc(K.name) + '</h3>' +
      '<p class="quote">' + esc(K.note) + '</p>' +
      '<div class="enc-reward">' + esc(act) + ' · ' + esc(mood) +
        ' · ' + Math.round(b.dist) + 'm</div>' +
      '<small class="muted">들에 사는 짐승입니다 — 도감에 오르지 않습니다.</small>'
    );
  }

  /**
   * 눌렀다. `world.js` 가 **아무것도 안 잡혔을 때만** 부른다.
   * @returns {boolean} 우리가 받았으면 true (그러면 `world.js` 는 물러난다)
   */
  function tap(hit) {
    if (!hit || busy()) { return false; }
    var pos = core.save.player.pos;
    var it = hit.it;
    var range = hit.kind === 'npc' ? NPC_R() : BEAST_R();
    if (it.dist > range) {
      /* 멀면 그 자리로 걸어간다 — 스폰·역참을 눌렀을 때와 같은 결이다 */
      core.emit('toast', (hit.kind === 'npc' ? '🧑 ' : '🦌 ') +
        '멉니다 · ' + Math.round(it.dist) + 'm · 그쪽으로 걸어갑니다');
      return 'walk';
    }
    return hit.kind === 'npc' ? openNpc(it) : openBeast(it);
  }

  global.DG = global.DG || {};
  global.DG.talk = {
    on: on, pick: pick, tap: tap, close: close, josaRo: josaRo,
    PATH: PATH, pathOf: pathOf, leadHero: leadHero, pathUsed: pathUsed, doPath: doPath, compass: compass,   // W-0276 길 행동
    NPC_R: NPC_R, BEAST_R: BEAST_R,
    /** 지금 열려 있나 */
    active: function () { return busy(); }
  };
})(window);
