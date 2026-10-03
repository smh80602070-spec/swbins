/**
 * 사관(史官) — 온라인 모드의 AI 기능과 천기(天機)
 * ---------------------------------------------------------------
 * 온라인 모드에서 쓸 수 있는 세 가지. **토큰 사용량이 곧 자원**이다.
 *
 *   ⚖️ 군략   지금 형편을 보고 다음에 무엇을 할지 세 가지를 짚어 준다
 *             (걷기·등용과 포획·서당 문답 — 본편의 세 축 안에서만)
 *   💬 대화   동행 인물에게 말을 건다 (그 인물의 열전·기질로 답한다)
 *   🔮 천기   앞길을 점친다. 길조면 잠시 실제 보정이 붙는다
 *
 * 감정(🔎)은 장비 확장(js/_expansion/item.js)과 함께 뺐다 — 서버 KINDS 에서도 빠져 있다.
 *
 * 천기(天機) = 남은 AI 예산. 서버 장부(하루 한도)가 진짜 잔량이고,
 * 여기서는 **부른 만큼 깎아서 보여 준다**. 클라이언트 숫자는 표시용일 뿐이다.
 *
 * 길조 보정만 게임 수치에 손을 댄다 — core.effect() 에 합산되고 시간이 지나면 사라진다.
 * 그 외 AI 결과는 전부 '읽을 것'이다. AI 응답이 게임 규칙을 바꾸지는 않는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /** 기능 정의 — 예상 소모는 화면에 미리 보여 주기 위한 어림값
   *  (감정(鑑定)은 장비 확장(js/_expansion/item.js)과 함께 뺐다) */
  var ACTS = [
    { key: 'advise', name: '군략(軍略)', emoji: '⚖️', est: 0.006,
      desc: '지금 형편을 보고 다음 할 일 셋' },
    { key: 'talk', name: '대화(對話)', emoji: '💬', est: 0.005,
      desc: '동행 인물에게 말을 건다' },
    { key: 'omen', name: '천기(天機)', emoji: '🔮', est: 0.004,
      desc: '앞길을 점친다 — 길조면 보정이 붙는다' }
  ];

  /** 길조가 줄 수 있는 보정 (하나가 무작위로 붙는다)
   *
   *  **본편에서 실제로 먹히는 키만 둔다.** 전에는 lootPct·goldPct·findPct·atkPct 가
   *  섞여 있었는데 그 넷은 전투·장비·던전(js/_expansion/)에서만 읽던 키라,
   *  길조가 떠도 다섯 중 넷은 라벨만 뜨고 아무 일도 일어나지 않았다.
   *  확장을 되살리면 그때 다시 넣을 것 — 지금 본편이 읽는 키는 이 넷뿐이다.
   *
   *    expPct       core.gainExp()          경험치 배수
   *    catchPct     encounter 포획 판정      확률에 %p 로 더해진다
   *    spawnRarePct world.rarityRoll()      등급 굴림을 위로 밀어 준다
   *    divinePct    world.pickPet()         신수(神獸) 쪽으로 기운다
   */
  var OMEN_BOONS = [
    { eff: 'expPct', val: 12, label: '경험치 +12%' },
    { eff: 'catchPct', val: 10, label: '포획 성공 +10%' },
    { eff: 'spawnRarePct', val: 15, label: '귀한 만남 +15%' },
    { eff: 'divinePct', val: 12, label: '신수 출현 +12%' }
  ];
  var OMEN_MINUTES = 20;

  function st() {
    var s = core.save;
    if (!s.ai) { s.ai = { spent: 0, calls: 0, log: [], buff: null, day: '' }; }
    if (!s.ai.log) { s.ai.log = []; }
    return s.ai;
  }

  function actByKey(k) {
    for (var i = 0; i < ACTS.length; i++) { if (ACTS[i].key === k) { return ACTS[i]; } }
    return null;
  }

  /* ── 게임 상태 요약 ───────────────────────────────────────
   * AI 에게 보낼 요약. 짧게 만드는 것이 곧 절약이다 —
   * 여기서 줄줄이 붙이면 입력 토큰이 그대로 늘어난다.
   */
  function summary() {
    var p = core.save.player;
    var party = core.save.party.map(function (id) {
      var h = global.DG.data.find(id);
      var g = global.DG.hero.info(id);
      return h ? (h.name + ' Lv.' + g.lv + (g.rank ? '★' + g.rank : '')) : id;
    }).join(', ');
    var hC = Object.keys(core.save.dex.heroes).length;
    var pC = Object.keys(core.save.dex.pets).length;
    var lines = [
      '칭호 Lv.' + p.level + ' · 금 ' + core.fmt(p.gold) + ' · 명성 ' + core.fmt(p.fame) +
        ' · 공적 ' + core.fmt(p.feat) + ' · 이동 ' + core.fmt(p.distance) + 'm',
      '동행: ' + (party || '없음'),
      '도감: 인물 ' + hC + '/' + global.DG.data.heroes.length +
        ' · 펫 ' + pC + '/' + global.DG.data.pets.length,
      '소모품: 등용서 ' + core.save.items.scroll + ' · 사료 ' + core.save.items.feed
    ];
    return lines.join('\n');
  }

  /* ── 호출 ─────────────────────────────────────────────── */

  function record(kind, r) {
    var s = st();
    s.calls += 1;
    s.spent += r.cost || 0;
    s.log.unshift({
      t: Date.now(), kind: kind, text: r.text || '',
      cost: r.cost || 0, inTok: r.usage ? r.usage.in : 0, outTok: r.usage ? r.usage.out : 0
    });
    if (s.log.length > 40) { s.log.length = 40; }
    core.emit('ai', { kind: kind, result: r });
    core.emit('changed');
    core.persist();
  }

  function fail(e) {
    var msg = (e && e.message) || '알 수 없는 오류';
    if (/authentication|api key|credential/i.test(msg)) {
      msg = '서버에 API 키가 없습니다 (server/README 참고)';
    } else if (e && e.status === 429) {
      msg = '오늘 몫의 천기를 다 썼습니다';
    }
    core.log('⚠️ 사관을 부르지 못했다 — ' + msg, 'bad');
    core.emit('toast', '⚠️ ' + msg);
    core.emit('ai', { error: msg });
    return { error: msg };
  }

  /** 군략 — 다음에 뭘 할지 */
  function advise() {
    return global.DG.net.ask('advise', { state: summary() }).then(function (r) {
      record('advise', r);
      core.log('⚖️ 군략을 들었다', 'info');
      return r;
    })['catch'](fail);
  }

  /** 인물에게 말을 건다 */
  function talk(heroId, say) {
    var h = global.DG.data.find(heroId);
    if (!h) { return Promise.resolve({ error: '그런 인물이 없습니다' }); }
    var g = global.DG.hero.info(heroId);
    var inParty = core.save.party.indexOf(heroId) >= 0;
    return global.DG.net.ask('talk', {
      name: h.name, hanja: h.hanja || '', era: h.era, faction: h.faction,
      trait: ({ might: '무인', wisdom: '지략가', virtue: '덕망가' })[h.trait] || h.trait,
      bio: global.DG.data.bio(heroId) || h.quote,
      status: 'Lv.' + g.lv + (g.rank ? ' 승급★' + g.rank : '') + ' · ' +
        (inParty ? '길을 함께 걷는 동행' : '집에서 대기 중'),
      say: say || '요즘 어떠한가?'
    }).then(function (r) {
      r.heroId = heroId;
      record('talk', r);
      core.log('💬 ' + h.name + ' 과 이야기했다', 'info');
      return r;
    })['catch'](fail);
  }

  /**
   * 천기 — 예언 한 줄. 길조면 잠시 보정이 붙는다.
   * 이게 AI가 게임 수치를 건드리는 **유일한 자리**다.
   */
  function omen() {
    return global.DG.net.ask('omen', { state: summary() }).then(function (r) {
      var good = /길조/.test(r.text || '');
      if (good) {
        var b = core.pick(OMEN_BOONS);
        st().buff = {
          eff: b.eff, val: b.val, label: b.label,
          until: Date.now() + OMEN_MINUTES * 60000
        };
        core.log('🔮 길조 — ' + b.label + ' (' + OMEN_MINUTES + '분)', 'good');
        core.emit('toast', '🔮 길조 · ' + b.label);
      } else {
        core.log('🔮 흉조 — 오늘은 몸을 낮추는 게 좋겠다', 'info');
      }
      r.good = good;
      record('omen', r);
      return r;
    })['catch'](fail);
  }

  /** core.effect() 훅 — 길조 보정 (시간이 지나면 스스로 사라진다) */
  function bonus() {
    var b = st().buff;
    if (!b) { return {}; }
    if (Date.now() > b.until) { st().buff = null; return {}; }
    var out = {};
    out[b.eff] = b.val;
    return out;
  }

  /** 남은 길조 시간(초). 없으면 0 */
  function buffLeft() {
    var b = st().buff;
    if (!b) { return 0; }
    return Math.max(0, (b.until - Date.now()) / 1000);
  }

  global.DG = global.DG || {};
  global.DG.ai = {
    ACTS: ACTS, actByKey: actByKey, state: st, summary: summary,
    advise: advise, talk: talk, omen: omen,
    bonus: bonus, buffLeft: buffLeft, OMEN_MINUTES: OMEN_MINUTES
  };
})(window);
