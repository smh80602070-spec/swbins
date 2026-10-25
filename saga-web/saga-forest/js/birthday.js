/**
 * 3마을 주민 생일 (W-0427 · 스타듀 밸리·동물의숲 생일 — 구조만, 이름·수치는 우리 것)
 * ---------------------------------------------------------------
 * 하트(관계)는 있는데 특별한 날이 없었다 — 달력을 보고 그날 찾아가는 작은 약속:
 *   날짜   주민마다 한 해에 하루(id 해시 → 달 1~12 · 날 1~28, 그 고장 달력). 같은 날이 겹치면 id 순으로 다음 날(저장 안 함)
 *   선물   생일에 건네면 하트 +BD_HEART(3) · 좋아하는 갈래면 +BD_LOVED(5)(보통 날 1·3) · 친밀도 ×2 · 싫어하는 것이어도 깎이진 않음
 *   알림   그날 아침(rollDay) 토스트 「🎂 오늘은 ○○ 생일」 · 「오늘」 창 한 줄 · 주민 창에 🎂 달/날
 *   안 줘도 아무 벌 없음.
 * village giveGift 하트 줄·친밀도 줄 끝에서 heart()·friendMul(), rollDay s.day 줄 끝에서 onDay(), ui 주민 줄에서 label(). 손잡이 fo.birthday(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var BD_HEART = 3, BD_LOVED = 5, FRIEND_MUL = 2;

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('fo.birthday', 1)); }
  function V() { return global.DG.village; }
  function h01(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }
  /** 마을 날 번호(1970-01-01 부터 며칠째, 그 고장 시각) → {m, d}(1 부터) */
  function md(dayN) { var dt = new Date(dayN * 86400000); return { m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }; }
  function slotOf(id) { return Math.floor(h01('bd:' + id) * 336); }   // 0~335 = 12달 × 28일
  function residentIds() { var v = V(), R = v && v.raw ? v.raw() : null; return R && R.residents ? R.residents.map(function (r) { return r.id; }) : []; }
  /** 그 사람의 생일 {m, d} — 겹치면 id 순으로 다음 날 */
  function of(id, ids) {
    ids = (ids || residentIds()).slice(); if (ids.indexOf(id) < 0) { ids.push(id); }
    ids.sort(); var used = {}, mine = 0;
    ids.forEach(function (x) { var s = slotOf(x); while (used[s]) { s = (s + 1) % 336; } used[s] = 1; if (x === id) { mine = s; } });
    return { m: Math.floor(mine / 28) + 1, d: (mine % 28) + 1 };
  }
  function isToday(id, dayN, ids) { if (!on()) { return false; } var b = of(id, ids), t = md(dayN); return b.m === t.m && b.d === t.d; }
  function todayN() { var v = V(), s = v && v.state ? v.state() : null; return s ? s.day : 0; }
  /** 오늘 생일인 주민 id 들 */
  function todays(dayN, ids) { ids = ids || residentIds(); var n = dayN == null ? todayN() : dayN; return ids.filter(function (id) { return isToday(id, n, ids); }); }

  /** giveGift 하트 — 생일이면 3·5(싫어함도 깎지 않음), 아니면 원래 값 */
  function heart(id, hUp, loved) { return isToday(id, todayN()) ? (loved ? BD_LOVED : BD_HEART) : hUp; }
  function friendMul(id) { return isToday(id, todayN()) ? FRIEND_MUL : 1; }
  function nameOf(id) { var v = V(), R = v && v.raw ? v.raw() : null; var r = R && R.residents ? R.residents.filter(function (x) { return x.id === id; })[0] : null; return r && r.ref ? r.ref.name : id; }
  /** 아침 — 생일인 사람 알림(토스트) */
  function onDay(dayN) {
    var L = todays(dayN); if (!L.length) { return L; }
    var C = core(); if (C && C.emit) { C.emit('toast', '🎂 오늘은 ' + L.map(nameOf).join('·') + ' 생일 — 선물을 건네 보세요'); }
    return L;
  }
  /** 주민 창 꼬리 — 「🎂 3월 14일」(오늘이면 「🎂 오늘 생일!」) */
  function label(id) { if (!on()) { return ''; } if (isToday(id, todayN())) { return ' · 🎂 오늘 생일!'; } var b = of(id); return ' · 🎂 ' + b.m + '월 ' + b.d + '일'; }
  /** 「오늘」 창 — 오늘 생일인 사람이 있으면 한 줄 */
  function row() {
    var L = todays(); if (!L.length) { return null; }
    var v = V(), given = L.filter(function (id) { return v && v.giftedToday && v.giftedToday(id); }).length;
    return { label: nameOf(L[0]) + (L.length > 1 ? ' 외 ' + (L.length - 1) : '') + ' 생일 — 선물하기', icon: '🎂', cur: given, max: L.length, done: given >= L.length };
  }

  global.DG = global.DG || {};
  global.DG.birthday = { BD_HEART: BD_HEART, BD_LOVED: BD_LOVED, FRIEND_MUL: FRIEND_MUL, md: md, of: of, isToday: isToday, todays: todays, heart: heart, friendMul: friendMul, onDay: onDay, label: label, row: row };
})(window);
