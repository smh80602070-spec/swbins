/**
 * 3마을 주민 — 친밀(하트)·기념품 이야기·따라오기·부탁·말 걸기 — village.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * village.js 가 `bind({ VD, st, bagCount, idNum })` 로 손잡이를 넘기고 같은 이름으로 부른다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var G = null, VD, st, bagCount, idNum;
  var api = null;
  function bind(g) { if (G !== g) { G = g; VD = g.VD; st = g.st; bagCount = g.bagCount; idNum = g.idNum; } return api; }

  /* ── 주민 ─────────────────────────────────────────────── */

  function friendOf(id) { return st().friend[id] || 0; }

  /**
   * 하트(PLAN §5.4 "관계 하트") — `friend`(친밀도) 는 예전부터 있던 값인데
   * **상한이 없고 화면에 안 보인다**(세배 삯·§5.2 카드가 계속 읽으므로 그건
   * 그대로 둔다). 하트는 그 옆에 두는 **새 0~10 게이지**다 — 하루 상한
   * +4, 해제 문턱(3·5·7·10)이 있어야 "쌓임" 이 눈에 보인다.
   */
  var HEART_MAX = 10, HEART_DAILY_CAP = 4;

  function heartRec(id) {
    var s = st();
    if (!s.hearts[id]) { s.hearts[id] = { h: 0, lastTalk: 0, gainDay: 0, gained: 0 }; }
    return s.hearts[id];
  }

  function heartOf(id) { return heartRec(id).h; }

  /** 오늘 이미 하루 상한(+4)만큼 올랐으면 나머지는 버린다(음수 delta — 선물이
   *  싫은 것일 때 — 는 상한에 안 걸린다, 벌은 늘 다 들어간다) */
  function bumpHeart(id, delta) {
    var s = st(), r = heartRec(id);
    if (r.gainDay !== s.day) { r.gainDay = s.day; r.gained = 0; }
    if (global.DG.workshop) { delta = global.DG.workshop.heart(delta); } /* 솜씨도 하트 */ var applied = delta;
    if (delta > 0) {
      var cap = HEART_DAILY_CAP + (global.DG.birthday && global.DG.birthday.isToday(id, s.day) ? global.DG.birthday.BD_LOVED : 0);   // W-0427 생일엔 상한 위로
      applied = Math.max(0, Math.min(delta, cap - r.gained));
      r.gained += applied;
    }
    r.h = Math.max(0, Math.min(HEART_MAX, r.h + applied));
    return applied;
  }

  /** 다음 해제 문턱 — 화면에 "다음: n♥ 에 …" 를 보여줄 때 쓴다 */
  function heartNext(id) {
    var h = heartOf(id), U = VD.HEART_UNLOCKS, i;
    for (i = 0; i < U.length; i++) { if (h < U[i].at) { return U[i]; } }
    return null;
  }

  /** 하트로 푸는 해제 하나의 문턱 — `HEART_UNLOCKS`(§5.4)를 이름으로 찾는다.
   *  표 순서·값이 바뀌어도 자리(인덱스)에 안 얽매이게. 없는 이름이면 못
   *  풀리는 것으로(Infinity) 본다. */
  function heartUnlockAt(name) {
    var U = VD.HEART_UNLOCKS;
    for (var i = 0; i < U.length; i++) { if (U[i].name === name) { return U[i].at; } }
    return Infinity;
  }

  /** 5♥ 해제 "고유 대화"(§5.4 HEART_UNLOCKS) — 주민은 실제 역사 인물이라
   *  새로 쓰지 않고, 이미 실명 없이 다듬어진 열전(BIOS, data.js §"열전")
   *  한 줄을 그대로 돌려쓴다. 절차적 생성 인물(saga-go 전용 genchar) 등
   *  BIOS가 없는 인물은 아직 못 여는 것으로(null) 본다 — 새로 지어내지 않는다. */
  function uniqLineOf(id) {
    if (heartOf(id) < heartUnlockAt('고유 대화')) { return null; }
    var bio = global.DG.data ? global.DG.data.bio(id) : '';
    return bio ? '문득 지난 이야기가 떠오르는구려... ' + bio : null;
  }

  /** 하트 10(기념품 해제) 주민 사연 — 사람마다 한 번. 틀 셋 가운데 인물 id 로 하나를 고르고 도감 열전 한 줄을 끼운다. 아직 못 들었으면 그 결과를, 아니면 null */
  function mementoStory(res) {
    var s = st(), id = res.id;
    if (s.memento[id] || heartOf(id) < heartUnlockAt('기념품')) { return null; }
    var FR = VD.MEMENTO_FRAMES, fr = FR[idNum(id) % FR.length], bio = global.DG.data ? global.DG.data.bio(id) : '';
    s.memento[id] = fr.key;
    core.save.player.gold += VD.MEMENTO_GOLD;
    core.gainFeat(VD.MEMENTO_FEAT, '기념품');
    core.log('🎁 ' + res.ref.name + ' 의 사연을 들었다 — 기념품 🪙 +' + core.fmt(VD.MEMENTO_GOLD), 'good');
    core.emit('changed');
    core.persist();
    return { kind: 'talk', name: res.ref.name, memento: fr.key,
             text: fr.emoji + ' ' + fr.text.replace('{이름}', res.ref.name).replace('{bio}', bio || '') + ' (🪙 +' + core.fmt(VD.MEMENTO_GOLD) + ')' };
  }

  /** 동행(PLAN §5.4, 7♥ 해제) — 자격 판정은 여기(하트를 쥔 쪽)가 하고,
   *  실제 "따라 걷기"는 `folk.js` 몫이다. */
  function canFollow(id) { return heartOf(id) >= heartUnlockAt('동행'); }

  function requestFollow(id) {
    if (!canFollow(id)) { return { kind: 'no', text: '아직 그 정도로 정이 깊지 않습니다' }; }
    var F = global.DG.folk;
    if (!F || !F.startFollow(id)) {
      return { kind: 'no', text: '이미 다른 이와 함께 걷고 있습니다' };
    }
    var h = global.DG.data ? global.DG.data.find(id) : null;
    core.log('🚶 ' + (h ? h.name : id) + ' 이(가) 잠시 함께 걷습니다', 'good');
    core.emit('changed');
    return { kind: 'follow', text: '🚶 ' + (h ? h.name : id) + ' 와(과) 함께 걷습니다 (' +
      F.FOLLOW_SEC + '초)' };
  }

  /** 부탁 하나를 만든다 — 오늘 안에 가져오면 금과 친밀도 */
  /**
   * 부탁 하나를 만든다.
   * **지금 나는 것 중에서만** 청한다(`VD.pick`) — 표에서 그냥 뽑으면 한겨울에 매실을,
   * 맑은 날에 미꾸라지를 가져오라고 한다. 오늘 안에 채울 수 없는 부탁은 부탁이 아니다.
   */
  function makeRequest(id) {
    /* 청하는 갈래는 **성격이 정한다** — 학구는 광물과 화석을, 다정은 꽃을 청한다.
       사람마다 청하는 것이 늘 비슷해야 그 사람으로 기억된다 */
    var t = global.DG.folk ? global.DG.folk.typeOf(id) : null;
    var cats = t ? t.req : ['fruit', 'nut', 'ore', 'flower', 'fish'];
    var cat = core.pick(cats);
    var want = VD.pick(cat);
    if (!want) { want = VD.pick('fruit') || VD.ITEMS.fruit[0]; }
    var n = core.pick(VD.REQUEST_N);
    return { want: want.key, n: n, done: false };
  }

  function requestOf(id) {
    var s = st();
    if (!s.requests[id]) { s.requests[id] = makeRequest(id); }
    return s.requests[id];
  }

  /** 말을 건다 — 부탁을 받거나, 채웠으면 건네고 보상을 받는다 */
  function talk(res) {
    var s = st();
    var req = requestOf(res.id);
    var it = VD.item(req.want);

    /* 하트(PLAN §5.4) "대화" +1 — 오늘 이 사람과 처음 말을 건 것이면 한 번만.
       세배·부탁 완수 등 아래 갈림길과 무관하게, 말을 걸었다는 사실 자체에 준다 */
    var hr0 = heartRec(res.id);
    if (hr0.lastTalk !== s.day) { hr0.lastTalk = s.day; bumpHeart(res.id, 1); }

    /* 설날 — 첫 인사는 세배다. 사람마다 한 번, 정이 깊을수록 두둑하다 */
    if (global.DG.town && global.DG.town.isNewYear()) {
      if (!s.bow) { s.bow = {}; }
      if (s.bow[res.id] !== s.day) {
        s.bow[res.id] = s.day;
        var money = 500 + friendOf(res.id) * 150;
        core.save.player.gold += money;
        bumpHeart(res.id, 2);   // 행사날 세배 — PLAN §5.4 "행사날 세배·나눔 +2"
        core.gainFeat(2, '세배');
        core.log('🧧 ' + res.ref.name + ' 에게 세배했다 — 세뱃돈 🪙 +' + core.fmt(money), 'good');
        core.emit('changed');
        core.persist();
        var bowDone = global.DG.festival ? global.DG.festival.onBow() : null;      // 세배 돌기(PLAN §5.6)
        return { kind: 'bow', name: res.ref.name,
                 text: '새해 복 많이 받으시오. 🧧 🪙 +' + core.fmt(money) + (bowDone ? ' · ' + bowDone : '') };
      }
    }
    /* 동지 팥죽 나눔(PLAN §5.6) — 쑨 팥죽이 남았으면 말 건 주민에게 한 그릇 */
    if (global.DG.festival) {
      var soup = global.DG.festival.share(res);
      if (soup) { return soup; }
    }

    /* 떠날 뜻을 비친 사람 — 붙잡는 것이 다른 무엇보다 먼저다.
       부탁을 들어준 뒤라야 붙잡힌다(mail.keep 이 그 판정을 갖는다) */
    var lv = global.DG.mail ? global.DG.mail.leavingOf(res.id) : null;
    if (lv) {
      var kept = global.DG.mail.keep(res.id);
      if (kept && kept.kind === 'keep') {
        return { kind: 'keep', name: res.ref.name, text: kept.text };
      }
      return { kind: 'leaving', name: res.ref.name, req: req, item: it,
               text: '떠날 뜻을 굳혔소 (' + lv.left + '일 남음). ' +
                     (kept ? kept.text : '') };
    }

    var mem = mementoStory(res);                     // 하트 10 — 사람마다 한 번 사연과 기념품
    if (mem) { return mem; }
    var pl = global.DG.partner ? global.DG.partner.line(res) : null;   // W-0288 동반자 기념일 대사(그날만)
    if (pl) { return pl; }

    var F = global.DG.folk;
    var ty = F ? F.typeOf(res.id) : null;

    if (req.done) {
      var uniq = uniqLineOf(res.id);
      return { kind: 'talk', name: res.ref.name,
               text: uniq ? uniq
                        : ty ? ty.idle
                        : '오늘은 고마웠소. ' + VD.phaseOf(new Date().getHours()).hello + '.' };
    }
    if (bagCount(req.want) >= req.n) {
      s.bag[req.want] -= req.n;
      req.done = true;
      var gold = it.price * req.n * 2;
      var fame = 8 + req.n * 3;
      core.save.player.gold += gold;
      core.save.player.fame += fame;
      s.friend[res.id] = friendOf(res.id) + 1;
      bumpHeart(res.id, 2);   // 부탁 완수 — PLAN §5.4
      s.helped += 1;
      core.gainFeat(4, '심부름');
      core.gainExp(18);
      core.log('🤝 ' + res.ref.name + ' 의 부탁을 들어주었다 — 🪙 +' + core.fmt(gold) +
        ' · 🎖️ +' + fame + ' · 친밀도 ' + s.friend[res.id] + ' · 💗 ' + heartOf(res.id) + '/10', 'good');
      core.emit('changed');
      core.persist();
      return { kind: 'reward', name: res.ref.name,
               text: (ty ? ty.done + ' ' : '') +
                     it.emoji + ' ' + it.name + ' ×' + req.n + ' — 🪙 +' + core.fmt(gold) };
    }
    return { kind: 'request', name: res.ref.name, req: req, item: it,
             text: ty ? F.say(ty.ask, it, req.n, bagCount(req.want))
                      : it.emoji + ' ' + it.name + ' ' + req.n + '개를 구해 줄 수 있겠소? (' +
                        bagCount(req.want) + '/' + req.n + ')' };
  }

  api = { bind: bind, friendOf: friendOf, heartRec: heartRec, heartOf: heartOf, bumpHeart: bumpHeart, heartNext: heartNext, heartUnlockAt: heartUnlockAt, mementoStory: mementoStory, canFollow: canFollow, requestFollow: requestFollow, requestOf: requestOf, talk: talk };
  global.DG = global.DG || {};
  global.DG.villageFolk = api;
})(typeof window !== 'undefined' ? window : this);
