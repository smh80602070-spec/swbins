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
    return card(
      '<div class="enc-big">' + global.DG.portrait3d.img('hero', p, 96) + '</div>' +
      '<h3>' + esc(p.name) + '</h3>' +
      '<p class="quote">"' + esc(line) + '"</p>' +
      '<div class="enc-reward">' + esc(p.personality) +
        (where ? ' · ' + where : '') + ' · ' + Math.round(n.dist) + 'm</div>' +
      '<small class="muted">이 마을 사람입니다 — 잡거나 설득할 수는 없습니다.</small>'
    );
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
    NPC_R: NPC_R, BEAST_R: BEAST_R,
    /** 지금 열려 있나 */
    active: function () { return busy(); }
  };
})(window);
