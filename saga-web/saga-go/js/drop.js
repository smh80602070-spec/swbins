/**
 * 패배 비용과 회수 — 떨어진 짐 (PLAN §5 ⑧)
 * ---------------------------------------------------------------
 * 토벌·성채·도적전·사당에서 **손으로 치르다** 지면 소지 금의 15%(상한 300)가 그 자리에
 * '떨어진 짐'으로 남는다(위경도). 10분 안에 그 자리 400m 안에서 넷 중 무엇이든 이기면
 * 되찾고, 아니면 흩어진다. (W-0247 10-15: 들판 전투에서 진 짐도 같다 — 들판 무리·수호자를 쓰러뜨려도 되찾는다.) 동시에 3개까지 — 넷째가 생기면 가장 오래된 것이 먼저 흩어진다.
 * (2026-09-22: 진 대상 자체는 10분 쿨다운이 짐 수명과 같아 곧바로 되찾을 수 없다 —
 * 반경을 150→400m 로 넓혀 근처 다른 것으로 회수할 여지를 늘렸다, 사용자 결정.)
 * 죽어도 남는 것: 도감·인물·인연·비석·승급 특성(잃는 건 금뿐이다).
 *
 * 손잡이(`_admin.html`): `drop.pct`(0 이면 벌칙이 꺼진다) · `drop.cap` · `drop.minutes` ·
 * `drop.radiusM`.
 *
 * **손으로 치른 판만 벌칙이 붙는다** — 판정이 `opts.live` 로 온 것(rogue-action 이 낸
 * 성과)과 사당. 자동 순행·자가진단이 인자 없이 부르는 즉시 판정은 잃는 것이 없다
 * (자동이 사람 몰래 금을 흘리면 안 된다). 이긴 쪽의 회수는 즉시 판정에서도 돈다.
 *
 * 짐은 위경도로만 갖는다 — 원점(origin)이 GPS 첫 수신 때 바뀐다(stela.js 와 같은 요령).
 * 세이브 `save.drops[{lat, lng, gold, at}]` — 읽기는 세이브를 만들지 않는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var MAX_DROPS = 3;
  var M_LAT = 111320;

  function pct() { return core.clamp(core.tuned('drop.pct', 0.15), 0, 1); }
  function cap() { return Math.max(0, Math.round(core.tuned('drop.cap', 300))); }
  function lifeMs() { return Math.max(1, core.tuned('drop.minutes', 10)) * 60 * 1000; }
  function radiusM() { return Math.max(10, core.tuned('drop.radiusM', 400)); }

  function raw() { return core.save.drops || []; }

  function alive(d, t) { return t - d.at < lifeMs(); }

  /** 살아 있는 짐 — 읽기만 한다(세이브는 안 건드린다) */
  function list(t) {
    t = t === undefined ? Date.now() : t;
    return raw().filter(function (d) { return alive(d, t); });
  }

  /** 흩어진 것을 걷어 낸다. 걷어 낸 개수를 돌려준다(세이브가 바뀌는 곳) */
  function sweep(t) {
    t = t === undefined ? Date.now() : t;
    var all = raw();
    if (!all.length) { return 0; }
    var keep = all.filter(function (d) { return alive(d, t); });
    var gone = all.length - keep.length;
    if (gone > 0) {
      var lost = 0, i;
      for (i = 0; i < all.length; i++) { if (!alive(all[i], t)) { lost += all[i].gold; } }
      core.save.drops = keep;
      core.log('🎒 떨어뜨린 짐(🪙 ' + lost + ')이 흩어졌다', 'bad');
      core.emit('changed');
      core.persist();
    }
    return gone;
  }

  function here() {
    var W = global.DG.world, pos = core.save.player.pos;
    return W && W.worldToLatLng ? W.worldToLatLng(pos.x, pos.y) : null;
  }

  function distM(aLat, aLng, bLat, bLng) {
    var dy = (aLat - bLat) * M_LAT;
    var dx = (aLng - bLng) * M_LAT * Math.cos((aLat + bLat) / 2 * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 졌다 — 금의 일부가 여기 남는다. 한 번 진 판마다 한 번만 부를 것.
   * @returns {{gold:number, ms:number, n:number}|null}  null = 잃은 것 없음(0% · 금 없음 · 위치 모름)
   */
  function lose(t) {
    t = t === undefined ? Date.now() : t;
    var ll = here();
    if (!ll) { return null; }
    var have = Math.max(0, Math.floor(core.save.player.gold || 0));
    var amt = Math.min(cap(), Math.floor(have * pct()));
    if (amt < 1) { return null; }

    core.save.player.gold = have - amt;
    var all = list(t);
    all.push({ lat: ll.lat, lng: ll.lng, gold: amt, at: t });
    while (all.length > MAX_DROPS) { all.shift(); }        // 가장 오래된 것이 먼저 흩어진다
    core.save.drops = all;
    core.log('🎒 졌다 — 🪙 ' + amt + ' 을(를) 여기 떨어뜨렸다. ' + Math.round(lifeMs() / 60000) +
      '분 안에 이 근처에서 이기면 되찾는다', 'bad');
    core.emit('changed');
    core.persist();
    return { gold: amt, ms: lifeMs(), n: all.length };
  }

  /**
   * 이겼다 — 반경 안의 짐을 모두 되찾는다.
   * @returns {{gold:number, n:number}|null}
   */
  function win(t) {
    t = t === undefined ? Date.now() : t;
    var ll = here();
    if (!ll) { return null; }
    var all = list(t);
    if (!all.length) { sweep(t); return null; }
    var keep = [], got = 0, n = 0, r = radiusM(), i;
    for (i = 0; i < all.length; i++) {
      if (distM(ll.lat, ll.lng, all[i].lat, all[i].lng) <= r) { got += all[i].gold; n++; }
      else { keep.push(all[i]); }
    }
    if (!n) { return null; }
    core.save.player.gold += got;
    core.save.drops = keep;
    core.log('🎒 떨어뜨린 짐을 되찾았다 — 🪙 +' + got, 'good');
    core.emit('toast', '🎒 짐을 되찾았다 +' + got);
    core.emit('changed');
    core.persist();
    return { gold: got, n: n };
  }

  /** 패배 카드 한 줄(HTML) — 잃은 게 없으면 빈 문자열 */
  function cardLine(d) {
    if (!d) { return ''; }
    return '<div class="enc-reward">🎒 🪙 ' + d.gold + ' 을(를) 떨어뜨렸다 — ' + Math.round(d.ms / 60000) +
      '분 안에 이 근처에서 이기면 되찾는다</div>' +
      '<small class="muted">도감·인물·인연·비석은 그대로입니다.</small>';
  }

  /** 승리 카드 한 줄(HTML) — 되찾은 게 없으면 빈 문자열 */
  function backLine(r) {
    return r ? '<div class="enc-reward">🎒 떨어뜨린 짐을 되찾았다 — 🪙 +' + r.gold + '</div>' : '';
  }

  /** 미니맵 — 살아 있는 짐의 월드 좌표 */
  function markers() {
    var W = global.DG.world, out = [], all = list(), i, w;
    if (!W || !W.latLngToWorld) { return out; }
    for (i = 0; i < all.length; i++) {
      w = W.latLngToWorld(all[i].lat, all[i].lng);
      out.push({ x: w.x, y: w.y, gold: all[i].gold, at: all[i].at });
    }
    return out;
  }

  var acc = 0;
  /** 매 프레임(game.js loop) — 몇 초에 한 번 흩어진 짐을 걷는다 */
  function tick(dt) {
    acc += dt;
    if (acc < 5) { return; }
    acc = 0;
    sweep();
  }

  global.DG = global.DG || {};
  global.DG.drop = {
    MAX_DROPS: MAX_DROPS,
    pct: pct, cap: cap, lifeMs: lifeMs, radiusM: radiusM,
    list: list, markers: markers, cardLine: cardLine, backLine: backLine, distM: distM,
    /* 세이브가 바뀌는 곳은 여기 셋 */
    lose: lose, win: win, sweep: sweep, tick: tick,
    _resetForTest: function () { acc = 0; }
  };
})(window);
