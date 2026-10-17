/**
 * 3마을 동반자(W-0288) — 관계 하트(§5.4) 끝에 함께 살기.
 * ---------------------------------------------------------------
 * 스타듀 밸리·하베스트 문의 구조만 따랐다(이름·수치·그림은 안 가져옴).
 *   청하기   하트 10 + 표시 물건 ❤️ 홍매(교배 꽃, hongmae) 한 송이를 곁에서 건넨다 → 승낙(조건이 맞으면 늘).
 *   한 명만  이미 동반자가 있으면 청할 수 없다. 헤어지면(breakUp) 그 사람 하트는 절반.
 *   아침     날이 바뀔 때(rollDay) 하루 한 가지 — 뜰 손질(잡초 둘 뽑기) · 아침밥(경험 +20) · 선물(좋아하는 갈래 하나) — 날짜 해시로 고른다.
 *   기념일   함께 산 지 30일마다 — 그날 말을 걸면 기념 대사, 금 300.
 *   집 안    2D 집 안 그림에 동반자가 서 있다(drawIn — 3D 는 집 안을 안 그린다). 밖에선 여느 주민처럼 돌아다닌다.
 *   저장     save.village.partner = { id, since(day), last(day), anniv } — 새 칸(옛 세이브는 없음 = null).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var TOKEN = 'hongmae';
  var ANNIV_DAYS = 30, ANNIV_GOLD = 300;
  var MORNING = ['water', 'meal', 'gift'];

  function V() { return global.DG.village; }
  function VD() { return global.DG.villageData; }
  function st() { return V().state(); }
  function get() { var s = st(); return s.partner || null; }
  function isPartner(id) { var p = get(); return !!(p && p.id === id); }
  function nameOf(id) { var h = global.DG.data ? global.DG.data.find(id) : null; return h ? h.name : String(id); }
  function refOf(id) { return global.DG.data ? global.DG.data.find(id) : null; }

  /** 청할 수 있나 — { ok, why } */
  function canPropose(id) {
    var v = V();
    if (!id) { return { ok: false, why: '곁에 아무도 없습니다' }; }
    if (get()) { return { ok: false, why: '이미 ' + nameOf(get().id) + ' 와(과) 함께 삽니다 — 한 명뿐입니다' }; }
    var full = v.heartOf(id) >= v.heartUnlockAt('기념품');
    if (!full) { return { ok: false, why: '하트가 가득 차야 청할 수 있습니다 (💗 ' + v.heartOf(id) + '/10)' }; }
    if (v.bagCount(TOKEN) < 1) { var it = VD().item(TOKEN); return { ok: false, why: (it ? it.emoji + ' ' + it.name : TOKEN) + ' 한 송이가 있어야 마음을 전할 수 있습니다' }; }
    return { ok: true, why: '' };
  }

  /** 곁의 주민에게 홍매를 건네며 청한다 */
  function propose(id) {
    var c = canPropose(id);
    if (!c.ok) { return { kind: 'no', text: c.why }; }
    var raw = V().raw(), res = null, i;
    for (i = 0; i < raw.residents.length; i++) { if (raw.residents[i].id === id) { res = raw.residents[i]; } }
    if (!res) { return { kind: 'no', text: '그 사람은 이 마을에 없습니다' }; }
    if (Math.hypot(res.x - raw.player.x, res.y - raw.player.y) > V().REACH) { return { kind: 'no', text: nameOf(id) + ' 곁으로 가야 건넬 수 있습니다' }; }
    var s = st(), it = VD().item(TOKEN);
    s.bag[TOKEN] -= 1;
    s.partner = { id: id, since: s.day, last: s.day, anniv: 0 };
    core.gainFeat(10, '동반자');
    core.log('💞 ' + nameOf(id) + ' 이(가) 내 집으로 옮겨 왔다 — ' + it.emoji + ' ' + it.name + ' 을(를) 받아 들였다', 'good');
    core.emit('changed');
    core.persist();
    return { kind: 'talk', name: nameOf(id), text: it.emoji + ' 이 꽃을... 내게? 좋소, 그대 곁에서 살겠소. 💞 (아침마다 한 가지를 거들어 드리리다)' };
  }

  /** 헤어진다 — 하트 절반 */
  function breakUp() {
    var p = get(); if (!p) { return { kind: 'no', text: '함께 사는 이가 없습니다' }; }
    var s = st(); V().heartOf(p.id); var hr = s.hearts[p.id];   // heartRec 은 village API 에 없다 — heartOf 가 칸을 만든다
    hr.h = Math.floor(hr.h / 2);
    s.partner = null;
    core.log('💔 ' + nameOf(p.id) + ' 와(과) 헤어졌다 — 💗 ' + hr.h + '/10', 'warn');
    core.emit('changed');
    core.persist();
    return { kind: 'talk', name: nameOf(p.id), text: '...그렇구려. 그동안 고마웠소. 💔 (💗 ' + hr.h + '/10)' };
  }

  /* ── 아침 한 가지 ───────────────────────────────────────── */

  function morningKind(day) { return MORNING[Math.floor(core.hash2(day, 7331) * MORNING.length) % MORNING.length]; }

  /** 하루 넘김 훅(rollDay 끝) — 같은 날 두 번 안 한다. 한 일 { kind, text } 또는 null */
  function onNewDay() {
    var p = get(); if (!p) { return null; }
    var s = st(), v = V();
    if (p.last === s.day) { return null; }
    p.last = s.day;
    var kind = morningKind(s.day), text, nm = nameOf(p.id);
    if (kind === 'water') {
      var n = 0; while (s.weeds && s.weeds.length && n < 2) { s.weeds.pop(); n++; }
      text = '🌿 ' + nm + ' 이(가) 아침에 뜰을 손질했다 (잡초 ' + n + ')';
    } else if (kind === 'meal') {
      core.gainExp(20);
      text = '🍚 ' + nm + ' 이(가) 아침밥을 차려 주었다 (경험 +20)';
    } else {
      var t = global.DG.folk ? global.DG.folk.typeOf(p.id) : null;
      var it = (t && t.like ? VD().pick(t.like) : null) || VD().pick('fruit') || VD().ITEMS.fruit[0];
      v.bagAdd(it, 1);
      text = '🎁 ' + nm + ' 이(가) ' + it.emoji + ' ' + it.name + ' 을(를) 건넸다';
    }
    /* 기념일 — 30일마다 */
    var lived = s.day - p.since;
    if (lived > 0 && lived % ANNIV_DAYS === 0) { p.anniv = Math.floor(lived / ANNIV_DAYS); text += ' · 💞 함께 산 지 ' + lived + '일'; }
    core.log(text, 'good');
    return { kind: kind, text: text };
  }

  function isAnniversary() { var p = get(); if (!p) { return false; } var l = st().day - p.since; return l > 0 && l % ANNIV_DAYS === 0; }

  /** 말 걸기 — 기념일이면 기념 대사(그날 한 번 금), 아니면 null(여느 대화 흐름으로) */
  function line(res) {
    var p = get(); if (!p || p.id !== res.id) { return null; }
    var s = st(), lived = s.day - p.since;
    if (!isAnniversary()) { return null; }
    if (p.annivDay === s.day) { return { kind: 'talk', name: res.ref.name, text: '💞 오늘로 ' + lived + '일이구려. 내일도 함께하오.' }; }
    p.annivDay = s.day;
    core.save.player.gold += ANNIV_GOLD;
    core.gainFeat(3, '기념일');
    core.emit('changed');
    core.persist();
    return { kind: 'talk', name: res.ref.name, text: '💞 함께 산 지 ' + lived + '일째요. 그날 받은 ❤️ 홍매를 아직 간직하고 있소. (🪙 +' + core.fmt(ANNIV_GOLD) + ')' };
  }

  /* ── 집 안 ────────────────────────────────────────────── */

  /** 방 안 자리 — 오른쪽 벽 가까이. 동반자가 없으면 null */
  function homeSpot() {
    var p = get(); if (!p) { return null; }
    var Hm = global.DG.home; if (!Hm) { return null; }
    var rm = Hm.room(), T = V().TILE;
    return { x: rm.w - T * 1.5, y: T * 2.2 };
  }

  /** 2D 집 안 그리기 — village-view drawHomeScene 이 부른다(ctx·투영·축척·그림자·말풍선은 그쪽 것) */
  function drawIn(ctx, projIn, inSc, now, shadow, bubble) {
    var p = get(), spot = homeSpot(), ref = p ? refOf(p.id) : null;
    if (!p || !spot || !ref) { return; }
    var q = projIn(spot.x, spot.y);
    var k = core.clamp(inSc * 0.9, 0.6, 1.8);
    var facing = 'down';
    shadow(q.x, q.y + 2 * k, 13 * k, 4.6 * k);
    if (!(global.DG.actor2d && global.DG.actor2d.draw(ctx, 'adult', ref, null, q.x, q.y, k, { facing: facing, moving: false, now: now, pk: 'pt:in' }))) {
      global.DG.sprite.stamp(ctx, { kind: 'human', ref: ref, x: q.x, y: q.y, s: k, facing: facing, phase: 0, walking: false,
        color: global.DG.data.faction(ref.faction).color, look: global.DG.sprite.lookOf(ref), rarity: ref.rarity, t: now });
    }
    if (bubble && Math.floor(now / 4000) % 3 === 0) { bubble(isAnniversary() ? '💞 오늘이 그날이오' : '다녀왔소?', q.x, q.y - 44 * k, '#54402c', '#f7ecd8'); }
  }

  global.DG = global.DG || {};
  global.DG.partner = {
    TOKEN: TOKEN, ANNIV_DAYS: ANNIV_DAYS, ANNIV_GOLD: ANNIV_GOLD, get: get, isPartner: isPartner, canPropose: canPropose, propose: propose, breakUp: breakUp,
    onNewDay: onNewDay, morningKind: morningKind, isAnniversary: isAnniversary, line: line, homeSpot: homeSpot, drawIn: drawIn
  };
})(typeof window !== 'undefined' ? window : this);
