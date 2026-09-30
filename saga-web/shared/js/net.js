/**
 * 모드 — 오프라인 / 온라인
 * ---------------------------------------------------------------
 * 이 게임은 **오프라인이 기본**이다. 세이브도 계산도 전부 이 기기 안에서 끝난다.
 * 온라인 모드는 거기에 딱 하나를 더한다 — **AI(사관) 기능**.
 * 그래서 서버가 없거나 꺼져 있어도 게임은 아무 것도 잃지 않는다.
 *
 *   오프라인   localStorage + 서비스 워커. 지도 타일도 본 것은 캐시된다
 *   온라인     /dg-ai/* 프록시가 살아 있을 때만. API 키는 서버에만 있다
 *
 * 브라우저에서 Anthropic 을 직접 부르지 않는 이유는 하나다 — 키가 노출된다.
 * 그래서 이 파일은 **우리 서버만** 부른다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var health = null;          // 마지막으로 확인한 서버 상태
  var probing = false;
  var lastProbe = 0;

  function settings() {
    var s = core.save.settings;
    if (!s.mode) { s.mode = 'offline'; }
    if (s.aiBase === undefined) { s.aiBase = ''; }   // 빈 값 = 같은 출처
    return s;
  }

  function base() {
    var b = settings().aiBase || '';
    if (b && b.charAt(b.length - 1) !== '/') { b += '/'; }
    return b;
  }

  function mode() { return settings().mode; }

  /** 온라인으로 실제 동작 가능한 상태인가 (모드 + 서버 확인) */
  function online() {
    return mode() === 'online' && !!(health && health.ok);
  }

  function setBase(url) {
    settings().aiBase = (url || '').trim();
    health = null;
    core.persist();
    return probe(true);
  }

  /**
   * 모드 전환. 온라인으로 바꿀 때는 서버가 응답해야 실제로 켜진다.
   * @returns {Promise<boolean>} 켜졌는지
   */
  function setMode(m) {
    settings().mode = m === 'online' ? 'online' : 'offline';
    core.persist();
    if (settings().mode === 'offline') {
      health = null;
      core.emit('net', { mode: 'offline' });
      core.emit('changed');
      return Promise.resolve(false);
    }
    return probe(true).then(function (h) {
      core.emit('changed');
      return !!(h && h.ok);
    });
  }

  function fetchJson(url, opts, ms) {
    if (!global.fetch) { return Promise.reject(new Error('이 브라우저는 fetch 를 지원하지 않습니다')); }
    var ctrl = global.AbortController ? new global.AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) { ctrl.abort(); } }, ms || 8000);
    var o = opts || {};
    if (ctrl) { o.signal = ctrl.signal; }
    return global.fetch(url, o).then(function (r) {
      clearTimeout(timer);
      return r.json()['catch'](function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var err = new Error(j.error || ('서버 응답 ' + r.status));
          err.status = r.status;
          err.body = j;
          throw err;
        }
        return j;
      });
    }, function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  /** 서버가 살아 있는지 확인 (12초에 한 번만 실제로 물어본다) */
  function probe(force) {
    if (probing) { return Promise.resolve(health); }
    if (!force && Date.now() - lastProbe < 12000) { return Promise.resolve(health); }
    probing = true;
    lastProbe = Date.now();
    return fetchJson(base() + 'dg-ai/health', {}, 3500).then(function (j) {
      probing = false;
      health = j;
      core.emit('net', { mode: mode(), health: j });
      return j;
    })['catch'](function () {
      probing = false;
      health = null;
      core.emit('net', { mode: mode(), health: null });
      return null;
    });
  }

  /**
   * 사관에게 묻는다.
   * @param kind 'advise' | 'talk' | 'appraise' | 'omen'
   * @param p    프롬프트에 넣을 값들 (서버에서 길이를 자른다)
   */
  function ask(kind, p) {
    if (mode() !== 'online') {
      return Promise.reject(new Error('오프라인 모드입니다'));
    }
    return fetchJson(base() + 'dg-ai/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: kind, p: p || {} })
    }, 60000).then(function (j) {
      if (j.ledger) {
        health = health || { ok: true };
        health.ledger = j.ledger;
        health.cap = j.cap;
      }
      return j;
    });
  }

  /** 화면에 뿌릴 상태 */
  function status() {
    var s = settings();
    var h = health;
    var left = h && h.cap !== undefined ? Math.max(0, h.cap - (h.ledger ? h.ledger.cost : 0)) : null;
    return {
      mode: s.mode,
      base: s.aiBase || '(같은 주소)',
      ok: !!(h && h.ok),
      model: h ? h.model : null,
      cap: h ? h.cap : null,
      used: h && h.ledger ? h.ledger.cost : 0,
      calls: h && h.ledger ? h.ledger.calls : 0,
      left: left
    };
  }

  global.DG = global.DG || {};
  global.DG.net = {
    mode: mode, setMode: setMode, online: online,
    base: base, setBase: setBase,
    probe: probe, ask: ask, status: status,
    /** 테스트에서 서버 없이 상태를 흉내 낼 때 */
    _setHealth: function (h) { health = h; }
  };
})(window);
