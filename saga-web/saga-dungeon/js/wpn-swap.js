/**
 * 2나락 — 무기 두 벌 바꿔 들기 (W-0281, 패스 오브 엑자일 2 식 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 한 판 안에서 원거리·근접을 바꿔 쓸 길이 없었다 → 인물마다 **무기 을(乙) 칸** 하나. Q(폰 🔁 단추)로 손에 든 갑과 을을 0.4초에
 * 바꿔 든다. 무예 슬롯은 직업(= 무기 look, skill.js classOf)마다 따로 저장돼 있어(save.slots[인물][직업]) 바꾸면 손이 통째로 바뀐다.
 * 쿨 1초 · 바꾼 직후 첫 타(strike) ×1.15.
 *
 *   세이브 save.wpn2[인물id] = 물건(가방과 같은 꼴) · 옛 세이브엔 없다(빈 것 = 한 벌) · 장비 보정(item.js eq 순회)에는 안 들어간다
 *   을은 장비 창 종이인형 아래 칸 — 가방의 무기마다 "을에 들기" 단추, 을 칸을 누르면 가방으로
 */
(function (global) {
  'use strict';

  var SWAP_SEC = 0.4, CD_SEC = 1.0, FIRST_MUL = 1.15;
  var LOOK_EMOJI = { sword: '🗡️', bow: '🏹', spear: '🔱', club: '🏏', guandao: '⚔️', axe: '🪓', halberd: '🪓', staff: '🪄', fan: '🪭', brush: '🖌️', scroll: '📜', gauntlet: '🥊' };

  function core() { return global.DG.core; }
  function item() { return global.DG.item; }
  function lead() { var s = core().save; return s.party && s.party[0] || null; }
  function st() {
    var s = core().save;
    if (!s.wpn2 || typeof s.wpn2 !== 'object') { s.wpn2 = {}; }
    return s.wpn2;
  }
  function of(hid) { return hid && st()[hid] || null; }
  function lookOf(it) { var b = it && item().baseOf(it); return b ? b.look : null; }
  function emoji(it) { return LOOK_EMOJI[lookOf(it)] || '⚔️'; }

  /* ── 을 칸 넣고 빼기 ── */
  function take(hid, uid) {
    var IT = item(), b = IT.bag(), i, it = null, base;
    if (!hid || !core().save.dex.heroes[hid]) { return { ok: false, reason: 'hero' }; }
    for (i = 0; i < b.length; i++) { if (b[i].uid === uid) { it = b[i]; break; } }
    if (!it) { return { ok: false, reason: 'none' }; }
    base = IT.baseOf(it);
    if (!base || base.slot !== 'weapon') { return { ok: false, reason: 'slot' }; }
    if (it.unid) { return { ok: false, reason: 'unid' }; }
    if (!IT.meetsReq(hid, it)) { return { ok: false, reason: 'req' }; }
    b.splice(i, 1);
    if (st()[hid]) { b.push(st()[hid]); }
    st()[hid] = it;
    core().emit('changed');
    return { ok: true };
  }
  function off(hid) {
    var IT = item(), cur = of(hid);
    if (!cur) { return { ok: false, reason: 'empty' }; }
    if (IT.bag().length >= IT.bagCap()) { return { ok: false, reason: 'bag' }; }
    IT.bag().push(cur);
    delete st()[hid];
    core().emit('changed');
    return { ok: true };
  }

  /* ── 바꿔 들기 ── */
  var cdUntil = {}, boost = {};
  function now() { return Date.now() / 1000; }
  function cdLeft(hid) { return Math.max(0, (cdUntil[hid] || 0) - now()); }
  function can(hid) { return !!of(hid) && cdLeft(hid) <= 0; }
  function swap(hid) {
    if (!hid) { return { ok: false, reason: 'arg' }; }
    var w2 = of(hid);
    if (!w2) { return { ok: false, reason: 'single' }; }
    if (cdLeft(hid) > 0) { return { ok: false, reason: 'cd', left: cdLeft(hid) }; }
    var eq = item().equipped(hid), cur = eq.weapon || null;
    eq.weapon = w2;
    if (cur) { st()[hid] = cur; } else { delete st()[hid]; }   // 갑이 비어 있었으면 을이 손으로 가고 을 칸은 빈다
    cdUntil[hid] = now() + CD_SEC;
    boost[hid] = FIRST_MUL;
    var D = global.DG.dungeon, run = D && D.raw ? D.raw() : null;
    if (run && run.player && D.active && D.active()) { run.player.atkAnim = Math.max(run.player.atkAnim || 0, SWAP_SEC); run.player.castAnim = true; }
    core().emit('changed');
    return { ok: true, look: lookOf(w2), emoji: emoji(w2) };
  }
  /** 바꾼 직후 첫 타 배율 — strike 가 한 번 쓰고 끈다 */
  function firstHit() {
    var id = lead(), b = id && boost[id];
    if (!b) { return 1; }
    boost[id] = 0;
    return b;
  }
  /** 키·단추 — 선두가 바꿔 든다 */
  function press() {
    var id = lead(), r = swap(id);
    if (r.ok) { core().emit('toast', r.emoji + ' 바꿔 들었다 — 첫 타 ×' + FIRST_MUL); }
    else if (r.reason === 'single') { core().emit('toast', '을(乙) 무기가 없다 — 장비 창에서 "을에 들기"'); }
    return r.ok;
  }
  /** HUD 가 매 틱 읽는다 */
  function info(hid) {
    hid = hid || lead();
    var w2 = of(hid), eq = hid ? item().equipped(hid) : {};
    return { has: !!w2, can: can(hid), cd: cdLeft(hid), cdMax: CD_SEC, hand: emoji(eq.weapon), next: w2 ? emoji(w2) : '' };
  }

  /* ── 장비 창 ── */
  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function slotHtml(hid) {
    var IT = item(), g = of(hid), inner;
    if (!g) { inner = '<div class="d2-dslot"><span class="muted">무기 을(乙)<small>비었다 — 가방 무기의 "을에 들기" · Q 로 바꿔 듦</small></span></div>'; }
    else {
      var t = IT.tierOf(g);
      inner = '<div class="d2-dslot" data-wpn2off="' + esc(hid) + '" title="가방으로">' +
        '<span style="color:' + t.color + '">' + emoji(g) + ' ' + esc(IT.name(g)) + '<small>무기 을(乙) · Q 로 바꿔 듦 · 눌러 벗기</small></span></div>';
    }
    return '<div class="d2-doll" style="grid-template-columns:1fr">' + inner + '</div>';
  }
  function bagBtn(g) {
    var b = g && item().baseOf(g);
    if (!b || b.slot !== 'weapon' || g.unid) { return ''; }
    return '<button class="btn tiny ghost" data-wpn2="1" data-id="' + esc(g.uid) + '">을(乙)에 들기</button>';
  }
  function gearHero() {
    var b = global.document.querySelector('[data-act="gear-hero"].primary');
    return b ? b.getAttribute('data-hero') : lead();
  }
  if (global.document) {
    global.document.addEventListener('click', function (e) {
      var t = e.target, b = t && t.closest ? t.closest('[data-wpn2],[data-wpn2off]') : null, r;
      if (!b) { return; }
      if (b.hasAttribute('data-wpn2off')) { r = off(b.getAttribute('data-wpn2off')); core().emit('toast', r.ok ? '을 무기를 가방에 넣었다' : r.reason === 'bag' ? '가방이 꽉 찼다' : '빈 칸'); }
      else { r = take(gearHero(), b.getAttribute('data-id')); core().emit('toast', r.ok ? '을(乙)에 들었다 — Q 로 바꿔 든다' : r.reason === 'req' ? '아직 못 든다(요구 수준)' : r.reason === 'unid' ? '미확인은 못 든다' : '못 든다'); }
      core().persist();
    });
  }

  global.DG = global.DG || {};
  global.DG.wpnSwap = {
    SWAP_SEC: SWAP_SEC, CD_SEC: CD_SEC, FIRST_MUL: FIRST_MUL,
    of: of, take: take, off: off, swap: swap, can: can, cdLeft: cdLeft, firstHit: firstHit, press: press, info: info,
    slotHtml: slotHtml, bagBtn: bagBtn, emoji: emoji,
    _reset: function (hid) { delete cdUntil[hid]; delete boost[hid]; }
  };
})(window);
