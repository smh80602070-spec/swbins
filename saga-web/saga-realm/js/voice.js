/**
 * 대사 음성 — 다섯 판 공용 (W-0137, 고돗 `saga_core/audio/voice.gd` G-0111 의 웹 짝)
 * ---------------------------------------------------------------
 * **정본은 saga-web/shared/js/voice.js** — 판별 복사본은 tools/sync-shared.mjs 가 만든다(직접 고치지 않는다).
 *
 * 파일 `shared/audio/voice/voice_<목소리>_<줄 id>.ogg` + 표 `voice_list.json`(lines·assign·missing — K-0036 산출, 고치지 않는다).
 * 주소는 통일 3D 에셋 뿌리(`DG.assets3d.root()`, `../shared/assets/` · `_shared/assets/`)의 `assets/` 를 `audio/voice/` 로.
 *
 *   say(kind, id, sure)  갈래 shout·pickup·greet — 그 인물 목소리(assign, 없으면 id 해시로 열 목소리 중 하나)로 무작위 한 줄
 *   system(key)          안내 = 해설 NA 의 system 줄(SYSTEM 표 — 고돗과 같은 키)
 *   규칙(고돗 그대로)     갈래마다 간격(GAP)·확률(CHANCE) · 말하는 중엔 낮은 순위(PRIO) 말은 버림 · 빠진 줄(missing)·상황 줄(SKIP)은 안 고름
 *   소리 규칙            배경음악(bgm.js)과 같은 잠금 — 첫 터치 전엔 무음 · 설정 "대사 음성" 끄면 무음(core.save.settings.voice)
 *   설정 줄              `DG.bgm.settingsHtml()` 뒤에 한 줄을 덧붙인다 — 다섯 판 ⚙️ 시트가 그 문자열을 이미 끼운다
 *   사건                 판마다 이미 쏘는 core 이벤트를 듣는다(EVENTS — 판 이름 `DG.cfg.account.name` 으로 고름). 판 코드는 안 고친다
 *
 * 진단: pick()·voiceOf()·pathOf() 순수 · _speak 는 last·count 를 남긴다 · _test(o) 로 잠금·표·시계를 바꿔 끼운다.
 */
(function (global) {
  'use strict';

  var core = global.DG && global.DG.core;
  var NARRATOR = 'NA', HASH_VOICES = ['M1', 'M2', 'M3', 'M4', 'M5', 'F1', 'F2', 'F3', 'F4', 'F5'];
  var GAP = { shout: 3.0, pickup: 4.0, greet: 1.5, system: 2.0 };
  var CHANCE = { shout: 0.35, pickup: 0.6, greet: 1.0, system: 1.0 };
  var PRIO = { pickup: 1, greet: 1, shout: 2, system: 3 };
  var EST_SEC = 1.5;
  var SKIP = { pickup: ['pickup_12', 'pickup_14', 'pickup_15', 'pickup_18'], greet: ['greet_05', 'greet_09', 'greet_11', 'greet_15', 'greet_18', 'greet_19'] };
  var SYSTEM = {
    save: 'system_01', new_area: 'system_02', bag_full: 'system_03', daily: 'system_04', levelup: 'system_06', gacha_rare: 'system_07',
    gacha_legend: 'system_07', join: 'system_07', quest: 'system_08', new_gear: 'system_09', danger: 'system_10', boss_appear: 'system_11',
    victory: 'system_12', defeat: 'system_13', load: 'system_14', settings: 'system_15', new_skill: 'system_16', time_low: 'system_17',
    door: 'system_18', secret: 'system_19', reward: 'system_19', login: 'system_20'
  };
  /* 판별 사건 — [이벤트, 갈래, (안내 키 | 말하는 이 고르기)]. 저장은 자동 저장이 잦아 뺐다 */
  function heroOfSkill(p) { var m = /^(?:sig|ally):([a-z0-9_]+)/.exec(String(p || '')); return m ? m[1] : ''; }
  var EVENTS = {
    '1만리': [['levelup', 'system', 'levelup'], ['zone:enter', 'system', 'new_area'], ['weapon:new', 'system', 'new_gear'],
      ['treasure:open', 'pickup'], ['duel:open', 'shout'], ['encounter:request', 'greet']],
    '2나락': [['levelup', 'system', 'levelup'], ['dungeon:floor', 'system', 'new_area'], ['dungeon:clear', 'system', 'victory'],
      ['dungeon:skill', 'shout', heroOfSkill], ['gear:drop', 'pickup'], ['town:npc', 'greet']],
    '3마을': [['levelup', 'system', 'levelup'], ['forest:enter', 'system', 'new_area'],
      ['village:gather', 'pickup'], ['village:fish', 'pickup'], ['village:bug', 'pickup'], ['village:open', 'greet']],
    '4종횡': [['levelup', 'system', 'levelup'], ['side:enter', 'system', 'new_area'], ['questdone', 'system', 'quest'],
      ['side:skill', 'shout'], ['side:gather', 'pickup'], ['side:talk', 'greet']],
    '5천하': [['levelup', 'system', 'levelup'], ['rtk:victory', 'system', 'victory'], ['rtk:battle', 'shout'], ['rtk:discover', 'pickup']]
  };

  var lines = {}, assign = {}, missing = {}, loaded = false, at = {}, busyUntil = 0, busyPrio = 0, cache = {}, cur = null;
  var st = { last: '', lastKind: '', count: 0 };
  var T = { unlocked: null, now: null, rand: null, noPlay: false, base: null };   // 진단이 바꿔 끼운다

  function nowMs() { return T.now ? T.now() : Date.now(); }
  function rand() { return T.rand ? T.rand() : Math.random(); }
  function settings() { var s = core && core.save ? (core.save.settings || (core.save.settings = {})) : {}; if (typeof s.voice !== 'boolean') { s.voice = true; } return s; }
  function enabled() { return settings().voice !== false; }
  function unlocked() { if (T.unlocked !== null) { return !!T.unlocked; } var B = global.DG.bgm; return !!(B && B.unlocked && B.unlocked()); }
  function volume() { var B = global.DG.bgm; return 0.9 * (B && B.volume ? Math.max(0.35, Math.min(1, B.volume() * 1.6)) : 1); }

  function base() {
    if (T.base) { return T.base; }
    var A = global.DG.assets3d, r = null;
    if (A) { if (A.url) { A.url('world', '_'); } r = A.root ? A.root() : null; }
    return r ? r.replace(/assets\/$/, 'audio/voice/') : null;
  }
  function setTable(j) {
    lines = {}; assign = (j && j.assign) || {}; missing = {};
    ((j && j.lines) || []).forEach(function (l) { (lines[l.kind] = lines[l.kind] || []).push(l.id); });
    ((j && j.missing) || []).forEach(function (m) { missing[m] = true; });
    loaded = true;
  }
  function load() {
    if (loaded || !global.fetch) { return; }
    var b = base();
    if (!b) { return; }
    loaded = true;
    global.fetch(b + 'voice_list.json').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) { setTable(j); } else { loaded = false; } })['catch'](function () { loaded = false; });
  }

  function hashOf(s) { var h = 0, i; s = String(s); for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }
  /** 인물 id → 목소리. 표에 없으면 id 해시로 열 목소리 중 하나(같은 id 는 늘 같은 목소리) */
  function voiceOf(id) { return assign[id] || HASH_VOICES[hashOf(id || 'self') % HASH_VOICES.length]; }
  /** 그 목소리로 낼 수 있는 갈래 줄 하나(빠진 줄·SKIP 은 건너뜀). 없으면 '' */
  function pick(kind, voice) {
    var ok = (lines[kind] || []).filter(function (lid) { return !missing[voice + '/' + lid] && (SKIP[kind] || []).indexOf(lid) < 0; });
    return ok.length ? ok[Math.floor(rand() * ok.length) % ok.length] : '';
  }
  function pathOf(voice, lineId) { var b = base(); return b ? b + 'voice_' + voice + '_' + lineId + '.ogg' : ''; }

  function play(url) {
    if (T.noPlay || !global.Audio) { return; }
    try {
      if (cur && !cur.paused) { cur.pause(); }
      var a = cache[url] || (cache[url] = new global.Audio(url));
      a.volume = volume(); a.currentTime = 0; cur = a;
      var p = a.play(); if (p && p['catch']) { p['catch'](function () { /* 자동재생 막힘 — 다음 사건에 다시 */ }); }
    } catch (e) { /* 소리는 없어도 된다 */ }
  }
  function speak(kind, voice, lineId, gapKey, sure) {
    if (!enabled() || !unlocked() || !lineId || missing[voice + '/' + lineId]) { return ''; }
    var now = nowMs();
    if (!sure && now - (at[gapKey] === undefined ? -1e9 : at[gapKey]) < GAP[kind] * 1000) { return ''; }
    var prio = PRIO[kind] + (sure ? 1 : 0);
    if (now < busyUntil && prio < busyPrio) { return ''; }
    var url = pathOf(voice, lineId);
    if (!url) { return ''; }
    at[gapKey] = now; busyPrio = prio; busyUntil = now + EST_SEC * 1000;
    st.last = url; st.lastKind = kind; st.count++;
    play(url);
    return url;
  }
  function say(kind, id, sure) {
    if (kind === 'system' || !GAP[kind]) { return ''; }
    load();
    if (!enabled() || !unlocked()) { return ''; }   // 확률(난수)보다 먼저 — 잠긴 동안 Math.random 을 안 쓴다(진단 씨앗 순서를 안 민다)
    if (!sure && rand() > CHANCE[kind]) { return ''; }
    var v = voiceOf(id || 'self');
    return speak(kind, v, pick(kind, v), kind, !!sure);
  }
  function system(key) { load(); return SYSTEM[key] ? speak('system', NARRATOR, SYSTEM[key], 'system:' + key, false) : ''; }

  /* ── 사건 잇기 — 판 이름으로 표를 고른다 ── */
  function bind() {
    var name = global.DG.cfg && global.DG.cfg.account && global.DG.cfg.account.name, list = EVENTS[name] || [];
    if (!core || !core.on) { return; }
    list.forEach(function (e) {
      core.on(e[0], function (p) {
        if (e[1] === 'system') { system(e[2]); } else { say(e[1], typeof e[2] === 'function' ? e[2](p) : ''); }
      });
    });
  }

  /* ── ⚙️ 설정 한 줄 — bgm.settingsHtml 뒤에 덧붙인다 ── */
  function rowHtml() { return '<div class="key-row" data-voice-box><b>대사 음성</b><button data-voice="toggle">' + (enabled() ? '켜짐' : '꺼짐') + '</button></div>'; }
  function wrapSettings() {
    var B = global.DG.bgm;
    if (!B || !B.settingsHtml || B.settingsHtml.__voice) { return; }
    var orig = B.settingsHtml, w = function () { return orig() + rowHtml(); };
    w.__voice = true; B.settingsHtml = w;
    if (global.document && document.addEventListener) {
      document.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest && ev.target.closest('[data-voice="toggle"]');
        if (!b) { return; }
        settings().voice = !enabled();
        if (core && core.persist) { core.persist(); }
        b.textContent = enabled() ? '켜짐' : '꺼짐';
        if (enabled()) { system('settings'); }
      }, true);
    }
  }

  bind();
  wrapSettings();

  global.DG = global.DG || {};
  global.DG.voice = {
    say: say, system: system, enabled: enabled, voiceOf: voiceOf, pick: pick, pathOf: pathOf,
    GAP: GAP, CHANCE: CHANCE, SYSTEM: SYSTEM, EVENTS: EVENTS, rowHtml: rowHtml,
    state: function () { return { last: st.last, kind: st.lastKind, count: st.count, loaded: loaded, lines: Object.keys(lines).length }; },
    /** 진단 — { unlocked, now, rand, noPlay, base, table } 를 바꿔 끼우고 간격·순위를 비운다 */
    _test: function (o) {
      o = o || {};
      T.unlocked = o.unlocked === undefined ? null : o.unlocked; T.now = o.now || null; T.rand = o.rand || null; T.noPlay = o.noPlay !== false; T.base = o.base || null;
      if (o.table) { setTable(o.table); }
      at = {}; busyUntil = 0; busyPrio = 0; st = { last: '', lastKind: '', count: 0 };
    }
  };
})(typeof window !== 'undefined' ? window : this);
