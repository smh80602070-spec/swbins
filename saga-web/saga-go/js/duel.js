/**
 * 교전(交戰) — 원작의 탭 전투
 * ---------------------------------------------------------------
 * 성채와 토벌은 여태 **수치를 한 번에 계산해 결과만 뿌렸다**. 원작에서 이 자리는
 * 손가락으로 하는 실시간 전투다 — 연타해서 때리고, 기가 차면 필살을 지르고,
 * 적이 크게 휘두르려 할 때 옆으로 피한다. 그 셋을 옮긴다.
 *
 *   맞붙는 모습 → 무대(舞臺)   둘이 마주 서서 치고 맞고 피한다
 *   빠른 공격  → 속공(速攻)   기 게이지 → 기(氣)
 *   차징 기술  → 필살(必殺)   회피      → 회피(回避)
 *   제한 시간  → 그대로 있다 (원작 레이드 100초 → 여기 60초)
 *
 * **두 층으로 갈라 두었다.**
 *   판정 층  create() · step(dt) · act()  — 화면이 없어도 굴러간다
 *   화면 층  open()                        — rAF 로 판정 층을 굴리고 DOM 을 그린다
 *
 * 헤드리스(`--dump-dom`)에서는 rAF 가 거의 돌지 않는다(밟아 본 함정이다). 그래서
 * 자가진단은 화면 층을 건드리지 않고 **판정 층만 직접 굴린다**. 이 판의 다른
 * 실시간 요소(자동 순행)와 같은 방식이다.
 *
 * 기존 판정을 지우지 않았다 — `raid.fight()` · `fort.challenge()` 를 **인자 없이**
 * 부르면 예전과 한 글자도 다르지 않게 돈다(자동 순행과 자가진단이 그 길을 쓴다).
 * 교전을 거친 경우에만 성과(perf)를 넘겨 그 결과를 판정에 반영한다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /* ── 규칙 상수 ────────────────────────────────────────── */

  /* 전부 어드민이 잡을 수 있는 손잡이다(`core.tuned`) — 켤 때 한 번 읽는다 */
  var TIME_SEC   = core.tuned('duel.timeSec', 60);      // 제한 시간
  var QUICK_CD   = core.tuned('duel.quickCd', 0.35);    // 속공 쿨 (연타 상한)
  var QUICK_MUL  = core.tuned('duel.quickMul', 0.10);   // 속공 피해 = 공격력 × 이 값
  var QUICK_KI   = core.tuned('duel.quickKi', 9);       // 속공 한 번에 차는 기
  var ULT_MUL    = core.tuned('duel.ultMul', 0.62);     // 필살 피해
  var KI_MAX     = 100;

  var FOE_GAP    = core.tuned('duel.foeGap', 2.6);      // 적 공격 간격(초)
  var FOE_HEAVY  = core.tuned('duel.foeHeavy', 3);      // 몇 번째마다 강타인지
  var TELL_SEC   = core.tuned('duel.tellSec', 1.1);     // 강타 예고 — 이 사이에 피한다
  var HEAVY_MUL  = core.tuned('duel.heavyMul', 2.4);    // 강타 피해 배수
  var DODGE_CUT  = core.tuned('duel.dodgeCut', 0.15);   // 회피 성공 시 남는 피해 비율
  var MORALE_MUL = core.tuned('duel.moraleMul', 3);     // 내 사기 = 방어력 × 이 값

  /* ── 판정 층 ──────────────────────────────────────────── */

  /**
   * 교전 하나를 만든다.
   * @param {{foeHp:number, myAtk:number, myDef:number, timeSec?:number}} o
   */
  function create(o) {
    var hp = Math.max(1, Math.round(o.foeHp || 1));
    return {
      foeHp: hp,
      hp: hp,
      foeAtk: Math.max(1, Math.round(hp * 0.010)),
      myAtk: Math.max(1, Math.round(o.myAtk || 1)),
      morale: Math.max(200, Math.round((o.myDef || 0) * MORALE_MUL)),
      moraleMax: Math.max(200, Math.round((o.myDef || 0) * MORALE_MUL)),
      left: o.timeSec || TIME_SEC,
      /* perf() 의 timeUsed 가 이 값을 쓴다 — 예전엔 여기서 안 채우고 open()
       * 이 나중에 cur.timeSec 를 덧붙여서, create() 를 timeSec 를 다르게
       * 줘서 직접 부르면(화면 없이) timeUsed 가 기본값(60)으로 잘못
       * 계산됐다(rogue-action.js 의 create() 는 처음부터 같이 채운다 —
       * 그쪽과 맞춤). 지금은 어디서도 다른 timeSec 를 안 줘서 겉으로 안
       * 드러났을 뿐이다. */
      timeSec: o.timeSec || TIME_SEC,
      ki: 0,
      cd: 0,
      /* 적 차례 */
      foeT: FOE_GAP,
      foeN: 0,
      tell: 0,            // 0 보다 크면 강타를 예고하는 중
      /* 실적 */
      dealt: 0,
      hits: 0,
      ults: 0,
      dodgeTry: 0,
      dodgeOk: 0,
      taken: 0,
      acts: [],           // 결과 화면이 읽는 기록
      over: false,
      cleared: false,
      fled: false
    };
  }

  function note(s, kind, dmg) {
    /* 예전엔 60개를 넘으면 앞을 잘랐다(`shift`) — 그런데 `fold()`가 이 배열
     * 하나로 결과 화면의 "합" 목록을 접는 유일한 곳이라, 잘라내면 초반
     * 타격이 통째로 사라지고 접은 목록의 "남은 기세"가 실제 전투 흐름과
     * 어긋났다(2026-09-07 발견 — 속공 쿨(0.35초)만으로도 60초 교전에서
     * 170타 가까이 나온다). `fold()`가 어차피 몇 덩이로만 접어 화면에
     * 내므로 여기서 자를 이유가 없다 — 한 교전(최대 수백 개)은 잘라내지
     * 않아도 메모리에 부담이 없다. */
    s.acts.push({ kind: kind, dmg: dmg, left: Math.max(0, s.hp) });
  }

  /**
   * 한 수 둔다.
   * @param {'quick'|'ult'|'dodge'} kind
   * @returns {{ok:boolean, kind:string, dmg?:number, reason?:string}}
   */
  function act(s, kind) {
    if (s.over) { return { ok: false, reason: 'over' }; }

    if (kind === 'dodge') {
      /* 예고 중이 아니면 헛동작이다 — 원작에서도 아무 때나 피하는 건 뜻이 없다 */
      s.dodgeTry++;
      if (s.tell > 0) { s.dodged = true; s.dodgeOk++; return { ok: true, kind: 'dodge' }; }
      return { ok: false, kind: 'dodge', reason: 'notell' };
    }

    if (kind === 'ult') {
      if (s.ki < KI_MAX) { return { ok: false, kind: 'ult', reason: 'noki' }; }
      var big = Math.round(s.myAtk * ULT_MUL);
      s.ki = 0;
      s.hp -= big;
      s.dealt += big;
      s.ults++;
      note(s, 'ult', big);
      finishIfDone(s);
      return { ok: true, kind: 'ult', dmg: big };
    }

    if (kind !== 'quick') { return { ok: false, reason: 'what' }; }
    if (s.cd > 0) { return { ok: false, kind: 'quick', reason: 'cd' }; }
    var dmg = Math.round(s.myAtk * QUICK_MUL * (0.9 + Math.random() * 0.2));
    s.cd = QUICK_CD;
    s.ki = Math.min(KI_MAX, s.ki + QUICK_KI);
    s.hp -= dmg;
    s.dealt += dmg;
    s.hits++;
    note(s, 'quick', dmg);
    finishIfDone(s);
    return { ok: true, kind: 'quick', dmg: dmg };
  }

  function finishIfDone(s) {
    if (s.hp <= 0) { s.over = true; s.cleared = true; }
  }

  /**
   * 시간을 흘린다. 적의 차례도 여기서 온다.
   * @returns {Array} 이 사이에 벌어진 일 (화면이 연출로 쓴다)
   */
  function step(s, dt) {
    var ev = [];
    if (s.over) { return ev; }

    if (s.cd > 0) { s.cd = Math.max(0, s.cd - dt); }
    s.left -= dt;

    /* 강타 예고가 끝나면 실제로 맞는다 */
    if (s.tell > 0) {
      s.tell -= dt;
      if (s.tell <= 0) {
        s.tell = 0;
        var heavy = Math.round(s.foeAtk * HEAVY_MUL);
        if (s.dodged) { heavy = Math.round(heavy * DODGE_CUT); }
        s.morale -= heavy;
        s.taken += heavy;
        ev.push({ t: 'heavy', dmg: heavy, dodged: !!s.dodged });
        s.dodged = false;
        s.foeT = FOE_GAP;
      }
    } else {
      s.foeT -= dt;
      if (s.foeT <= 0) {
        s.foeN++;
        if (s.foeN % FOE_HEAVY === 0) {
          s.tell = TELL_SEC;
          s.dodged = false;
          ev.push({ t: 'tell' });
        } else {
          var d = Math.round(s.foeAtk * (0.85 + Math.random() * 0.3));
          s.morale -= d;
          s.taken += d;
          ev.push({ t: 'hit', dmg: d });
          s.foeT = FOE_GAP;
        }
      }
    }

    if (s.morale <= 0) { s.morale = 0; s.over = true; s.cleared = false; ev.push({ t: 'rout' }); }
    else if (s.left <= 0) { s.left = 0; s.over = true; s.cleared = s.hp <= 0; ev.push({ t: 'time' }); }
    return ev;
  }

  /** 물러난다 — 성과는 그때까지 낸 만큼만 인정된다 */
  function flee(s) { s.over = true; s.fled = true; s.cleared = false; }

  /**
   * 성과 — 판정에 넘기는 한 덩어리.
   * `ratio` 는 적 기세를 얼마나 깎았는지다(1 이면 꺾은 것). 회피를 잘 맞혔으면
   * 조금 얹는다 — 원작에서도 잘 피하면 더 오래 때릴 수 있으니 같은 뜻이다.
   */
  function perf(s) {
    var ratio = s.dealt / Math.max(1, s.foeHp);
    var dodgeRate = s.dodgeTry > 0 ? s.dodgeOk / s.dodgeTry : 0;
    return {
      live: true,
      ratio: ratio,
      score: core.clamp(ratio * (1 + dodgeRate * 0.10), 0, 1.6),
      dealt: s.dealt,
      cleared: !!s.cleared,
      fled: !!s.fled,
      hits: s.hits, ults: s.ults,
      dodgeOk: s.dodgeOk, dodgeTry: s.dodgeTry,
      taken: s.taken,
      timeUsed: Math.round(((s.timeSec || TIME_SEC) - s.left) * 10) / 10,
      acts: s.acts
    };
  }

  /**
   * 교전 실적을 결과 화면이 읽는 `rounds` 꼴로 접는다.
   * 백 번의 속공을 백 줄로 뿌리면 아무도 읽지 못하므로 열 덩이로 묶는다.
   */
  function fold(s, cap) {
    var n = cap || 10;
    var acts = s.acts;
    if (!acts.length) { return []; }
    var per = Math.ceil(acts.length / n), out = [], i, k = 0;
    for (i = 0; i < acts.length; i += per) {
      var sum = 0, ult = 0, last = 0;
      for (var j = i; j < Math.min(acts.length, i + per); j++) {
        sum += acts[j].dmg;
        if (acts[j].kind === 'ult') { ult++; }
        last = acts[j].left;
      }
      k++;
      out.push({ n: k, dmg: sum, left: last, ult: ult });
    }
    return out;
  }

  /* ── 화면 층 ──────────────────────────────────────────── */

  var el = null, cur = null, rafId = null, doneCb = null, meta = null;

  function host() { return document.getElementById('encounter'); }
  function $(sel) { return el ? el.querySelector(sel) : null; }

  /**
   * 교전 화면을 띄운다.
   * @param {{title:string, foeName:string, portrait?:string, emoji?:string,
   *          foeHp:number, myAtk:number, myDef:number, timeSec?:number,
   *          onDone:function}} o
   */
  function open(o) {
    el = host();
    if (!el) { return null; }
    cur = create(o);            // create() 가 이미 timeSec 를 채운다
    meta = o;
    doneCb = o.onDone || null;
    el.classList.add('show');
    /* 실제 3D 상대가 설 수 있을 때만 카드를 얇게 걷는다 — `battle3d.js` 의
       `duel:open` 처리가 이 값을 보고 `world3d.duelStage()` 를 부른다(같은 조건).
       3D 가 꺼져 있으면(WebGL 없음 등) 그대로 두어야 무대가 텅 빈 채로 카드만
       얇아지는 일이 없다 */
    var W3 = global.DG.world3d;
    el.classList.toggle('duel3d', !!(o.stage3d && W3 && W3.available && W3.available()));
    paint();
    bind();
    loop();
    /* 3D 연출이 이 신호를 듣는다(`battle3d.js`) — 카메라가 당겨지고 흙먼지가 인다.
       **판정에는 한 줄도 안 닿는다.** 듣는 쪽이 없어도 교전은 그대로 돈다.
       `stage3d` 는 부르는 쪽(`event.js`·`fort.js`)이 "상대를 3D 로 세우면 이 모습"
       을 미리 정해 건네주는 값이다(`{kind:'hero'|'pet', ref}`) — 없으면 카드만 뜬다 */
    core.emit('duel:open', { title: meta.title, foeName: meta.foeName, stage3d: o.stage3d || null });
    return cur;
  }

  /**
   * 내 쪽에 세울 사람 — **동행 선두**다(지도 위 내 모습과 같은 사람).
   * 아무도 없으면 이모지로 대신한다. 화면에만 쓰는 값이라 판정에는 닿지 않는다.
   */
  function myFighter() {
    var id = core.save.party && core.save.party[0];
    var h = id ? global.DG.data.find(id) : null;
    return { name: h ? h.name : '나', ref: h };
  }

  function paint() {
    /* `stage3d`가 있으면(사실상 늘 있다 — 상대가 있는 교전은 `foeVisual()`이
       hero/pet 중 하나를 낸다) 그쪽을 우선한다 — 이 자리도 `portrait3d.img()`를
       거치므로 모델이 다 구워지면 그림이 실제 3D 초상으로 갈아 끼워진다.
       `meta.portrait`는 옛 호출(스테이지 없이 구운 src만 건네는 자리)을 위한
       되돌아가는 길일 뿐이다 */
    var face = meta.stage3d
      ? global.DG.portrait3d.img(meta.stage3d.kind, meta.stage3d.ref, 96)
      : (meta.portrait
          ? '<img class="pt" alt="" src="' + meta.portrait + '">'
          : '<span class="duel-emoji">' + (meta.emoji || '⚔️') + '</span>');
    var me = myFighter();
    var meFace = me.ref
      ? global.DG.portrait3d.img('hero', me.ref, 96)
      : '<span class="duel-emoji">🧭</span>';
    el.innerHTML = '' +
      '<div class="duel" id="duel">' +
        '<div class="duel-head">' +
          '<div class="duel-title">' + meta.title + '</div>' +
          '<div class="duel-time"><b id="d-time">' + Math.ceil(cur.left) + '</b>초</div>' +
        '</div>' +
        /* 무대 — 적은 뒤쪽 오른편, 나는 앞쪽 왼편에 선다(원작의 전투 화면 배치) */
        '<div class="duel-arena" id="d-arena">' +
          '<div class="d-unit foe" id="d-face">' + face + '<i class="d-shadow"></i></div>' +
          '<div class="d-unit me" id="d-me">' + meFace + '<i class="d-shadow"></i></div>' +
          '<div class="d-name foe">' + meta.foeName + '</div>' +
          '<div class="d-name me">' + me.name + '</div>' +
          '<div class="duel-pops" id="d-pops"></div>' +
          '<div class="duel-tell" id="d-tell">강타가 온다 — 피하라!</div>' +
        '</div>' +
        '<div class="duel-foe">' +
          '<div class="bar red"><i id="d-hp" style="width:100%"></i></div>' +
          '<div class="duel-num" id="d-hpnum">기세 ' + core.fmt(cur.hp) + '</div>' +
        '</div>' +
        '<div class="duel-me">' +
          '<div class="duel-row"><small>사기</small>' +
            '<div class="bar blue"><i id="d-mor" style="width:100%"></i></div></div>' +
          '<div class="duel-row"><small>기(氣)</small>' +
            '<div class="bar ki"><i id="d-ki" style="width:0%"></i></div></div>' +
        '</div>' +
        '<div class="duel-pad">' +
          '<button class="dbtn quick" data-d="quick"><b>속공</b><small>연타 · Space</small></button>' +
          '<button class="dbtn ult" data-d="ult" disabled><b>필살</b><small>기 만충 · F</small></button>' +
          '<button class="dbtn dodge" data-d="dodge"><b>회피</b><small>예고에 · D</small></button>' +
        '</div>' +
        '<button class="btn ghost wide" data-d="flee">물러난다</button>' +
      '</div>';
  }

  function pop(text, cls) {
    var box = $('#d-pops');
    if (!box) { return; }
    var s = document.createElement('span');
    s.className = 'dpop ' + (cls || '');
    s.textContent = text;
    box.appendChild(s);
    setTimeout(function () { if (s.parentNode) { s.parentNode.removeChild(s); } }, 700);
  }

  function shake(id, cls) {
    var n = $(id);
    if (!n) { return; }
    n.classList.remove(cls);
    /* 클래스를 다시 붙여 애니메이션을 처음부터 돌린다 */
    void n.offsetWidth;
    n.classList.add(cls);
    setTimeout(function () { n.classList.remove(cls); }, 320);
  }

  /**
   * 무대 위 동작 — **화면 층에만 있다.** 판정은 이미 끝난 뒤에 부르므로
   * 애니메이션이 안 돌아도(헤드리스처럼 rAF 가 멎은 곳) 결과는 달라지지 않는다.
   * @param {string} sel 대상 · @param {string} cls 동작 · @param {number} ms 되돌릴 시각
   */
  var motionT = {};
  function motion(sel, cls, ms) {
    var n = $(sel);
    if (!n) { return; }
    n.classList.remove(cls);
    void n.offsetWidth;                 // 클래스를 다시 붙여 처음부터 돌린다
    n.classList.add(cls);
    if (motionT[sel + cls]) { clearTimeout(motionT[sel + cls]); }
    motionT[sel + cls] = setTimeout(function () { n.classList.remove(cls); }, ms || 300);
  }

  /** 내가 친다 — 앞으로 뛰어들고, 적이 흔들린다 */
  function swing(big) {
    motion('#d-me', big ? 'ulting' : 'lunge', big ? 460 : 240);
    motion('#d-face', big ? 'blast' : 'hurt', big ? 460 : 240);
  }

  /** 적이 친다 — 적이 달려들고, 내가 밀린다(피했으면 옆으로 샌다) */
  function foeSwing(heavy, dodged) {
    motion('#d-face', 'lunge', heavy ? 420 : 300);
    if (dodged) { motion('#d-me', 'evade', 380); }
    else { motion('#d-me', heavy ? 'blast' : 'hurt', heavy ? 420 : 300); }
  }

  function refresh() {
    var hp = $('#d-hp'), mor = $('#d-mor'), ki = $('#d-ki');
    if (hp) { hp.style.width = core.clamp(cur.hp / cur.foeHp * 100, 0, 100) + '%'; }
    if (mor) { mor.style.width = core.clamp(cur.morale / cur.moraleMax * 100, 0, 100) + '%'; }
    if (ki) { ki.style.width = (cur.ki / KI_MAX * 100) + '%'; }
    var num = $('#d-hpnum'), t = $('#d-time');
    if (num) { num.textContent = '기세 ' + core.fmt(Math.max(0, cur.hp)); }
    if (t) { t.textContent = Math.ceil(Math.max(0, cur.left)); }
    var u = $('.dbtn.ult');
    if (u) { u.disabled = cur.ki < KI_MAX; }
    var root = $('#duel');
    if (root) {
      if (cur.tell > 0) { root.classList.add('tell'); }
      else { root.classList.remove('tell'); }
    }
  }

  function loop() {
    var last = performance.now();
    function frame(now) {
      if (!cur || cur.over) { return; }
      var dt = Math.min(0.25, (now - last) / 1000); last = now;
      var ev = step(cur, dt);
      for (var i = 0; i < ev.length; i++) {
        var e = ev[i];
        if (e.t === 'hit') {
          pop('-' + e.dmg, 'bad'); shake('#duel', 'jolt'); foeSwing(false, false);
        }
        if (e.t === 'heavy') {
          pop((e.dodged ? '회피! -' : '강타! -') + e.dmg, e.dodged ? 'ok' : 'bad');
          shake('#duel', e.dodged ? 'flash' : 'jolt');
          foeSwing(true, e.dodged);
        }
        if (e.t === 'hit' || e.t === 'heavy') {
          core.emit('duel:fx', { kind: e.t, dmg: e.dmg || 0, dodged: !!e.dodged, mine: false });
        }
      }
      refresh();
      if (cur.over) { finish(); return; }
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
  }

  function doAct(kind) {
    if (!cur || cur.over) { return; }
    var r = act(cur, kind);
    if (r.ok && kind === 'quick') { pop('-' + r.dmg, ''); swing(false); }
    if (r.ok && kind === 'ult') { pop('필살 -' + r.dmg, 'big'); swing(true); }
    if (r.ok && kind === 'dodge') { pop('피했다', 'ok'); motion('#d-me', 'evade', 380); }
    if (r.ok) { core.emit('duel:fx', { kind: kind, dmg: r.dmg || 0, mine: true }); }
    refresh();
    if (cur.over) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      finish();
    }
  }

  function bind() {
    var b = el.querySelectorAll('[data-d]');
    for (var i = 0; i < b.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var k = btn.getAttribute('data-d');
          if (k === 'flee') {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            flee(cur); finish(); return;
          }
          doAct(k);
        });
      })(b[i]);
    }
  }

  function finish() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    var p = perf(cur);
    p.folded = fold(cur);
    var cb = doneCb;
    cur = null; doneCb = null; meta = null;
    /* `show` 도 여기서 내린다 — 안 그러면 콜백(`cb`)이 결과 카드를 새로
       열지 않는 길(예: 한 대도 못 때리고 물러난 경우, `event.js` 가 "빈손
       도주엔 벌을 안 물린다"며 곧바로 return 한다)에서 빈 채로 눌러붙어
       다음 조우가 `busy()` 에 막혀 안 열린다(2026-08-30, 발견 즉시 고침).
       결과 카드를 여는 길에서는 `cb` 안에서 곧바로 다시 `show` 를 붙이므로
       화면 깜빡임 없이 그대로 이어진다 */
    if (el) { el.innerHTML = ''; el.classList.remove('duel3d'); el.classList.remove('show'); }
    core.emit('duel:close', p);
    if (cb) { cb(p); }
  }

  global.addEventListener('keydown', function (e) {
    if (!cur || cur.over) { return; }
    if (e.key === ' ') { e.preventDefault(); doAct('quick'); }
    else if (e.key === 'f' || e.key === 'F') { doAct('ult'); }
    else if (e.key === 'd' || e.key === 'D' ||
             e.key === 'ArrowLeft' || e.key === 'ArrowRight') { doAct('dodge'); }
  });

  global.DG = global.DG || {};
  global.DG.duel = {
    TIME_SEC: TIME_SEC, KI_MAX: KI_MAX, QUICK_CD: QUICK_CD, QUICK_KI: QUICK_KI,
    QUICK_MUL: QUICK_MUL, ULT_MUL: ULT_MUL, HEAVY_MUL: HEAVY_MUL,
    DODGE_CUT: DODGE_CUT, TELL_SEC: TELL_SEC, FOE_GAP: FOE_GAP,
    /* rogue-action.js(사가나락식 위치 기반 도적전)가 재사용한다 — 이 둘만
       여태 export가 안 돼 있었다. 계산·기본값은 그대로, export만 추가 */
    FOE_HEAVY: FOE_HEAVY, MORALE_MUL: MORALE_MUL,
    /* 판정 층 — 화면 없이 굴린다 (자가진단이 쓰는 문) */
    create: create, step: step, act: act, flee: flee, perf: perf, fold: fold,
    /* 화면 층 */
    open: open,
    /** 데모가 동작을 정지 화면으로 붙잡을 때만 쓰는 문 (게임 코드는 부르지 않는다) */
    _motion: function (sel, cls, ms) { motion(sel, cls, ms); },
    get active() { return !!cur; }
  };
})(window);
