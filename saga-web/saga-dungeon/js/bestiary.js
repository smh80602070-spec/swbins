/**
 * 몬스터 도감 — 무엇을 몇 마리 잡았는지 (W-0117)
 * ---------------------------------------------------------------
 * 목록은 새로 만들지 않는다 — `enemyData` 의 세 표(우두머리 BOSSES · 잡졸 ENEMIES · 세 시대 ERA_ENEMIES)를 그대로 읽는다.
 * 세는 일은 `dungeon:kill` 사건만 듣는다(quest.js·scenario.js 와 같은 길) — 판정 파일(dungeon.js)은 한 줄도 안 바뀐다.
 *
 *   종 키   표 우두머리 = 'b:' + id(토벌첩과 같은 id) · 표 밖에서 id 를 단 적(지역 우두머리 rb_*·층 주인 fx_*) = 'x:' + id
 *           · 나머지 = 표시 이름(잡졸 표엔 id 가 없고 data-enemy.js 는 사가종횡과 나눠 든 파일이라 새 칸을 안 만든다 —
 *           `enemyData.byName` 과 같은 길). **잡졸 이름을 바꾸면 아래 `RENAMED` 에 옛 이름 → 새 이름 한 줄** — 그래야
 *           세이브의 처치 수가 새 이름으로 옮겨 간다(안 적으면 그 종은 0 부터).
 *   세이브  `save.kills[<종 키>] = { n, floor, at, name, emoji, kind, form }` — 처치 수 · 처음 잡은 층(0 = 들판) · 처음 잡은 때
 *           · 표 밖 적을 다시 그릴 이름·모습. 없던 칸이라 옛 세이브는 빈 칸으로 채워진다(판 올림 없음). 새 종일 때만 바로 저장.
 *   초상    `monsterPortrait` 몸 계열 초상(못 받으면 이모지로 바뀜), 사람형(초상 없음)은 이모지. 분신(shade)은 세지 않는다.
 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};

  function core() { return global.DG.core; }
  function ED() { return global.DG.enemyData; }

  /** 잡졸 이름을 바꿨을 때 옛 이름 → 새 이름(세이브 키를 옮긴다) */
  var RENAMED = {};

  function inBosses(id) {
    var b = (ED() && ED().bosses) || [], i;
    for (i = 0; i < b.length; i++) { if (b[i].id === id) { return true; } }
    return false;
  }
  function keyOf(ref) {
    if (!ref) { return null; }
    if (ref.id) { return (inBosses(ref.id) ? 'b:' : 'x:') + ref.id; }
    return ref.name || null;
  }

  function book() {
    var s = core().save, k;
    if (!s.kills || typeof s.kills !== 'object') { s.kills = {}; }
    for (k in RENAMED) {
      if (Object.prototype.hasOwnProperty.call(RENAMED, k) && s.kills[k]) {
        var to = s.kills[RENAMED[k]], from = s.kills[k];
        if (to) { to.n += from.n; if (from.at < to.at) { to.at = from.at; to.floor = from.floor; } } else { s.kills[RENAMED[k]] = from; }
        delete s.kills[k];
      }
    }
    return s.kills;
  }

  /** 처치 한 번 — 처음이면 층·모습을 남기고 바로 저장한다. 반환: 그 종 칸 */
  function record(ref, floor) {
    var k = keyOf(ref);
    if (!k) { return null; }
    var b = book(), c = b[k];
    if (!c) {
      c = b[k] = { n: 0, floor: Math.max(0, floor | 0), at: Date.now(),
        name: ref.name || '', emoji: ref.emoji || '', kind: ref.kind || '', form: ref.form || '' };
      c.n = 1;
      if (core().persist) { core().persist(); }
      return c;
    }
    c.n += 1;
    return c;
  }

  function onKill(p) {
    if (!p || !p.e || p.e.shade) { return; }
    record(p.e.ref, p.floor);
  }

  /** 갈래 `[{ key, name, rows:[{ key, ref, boss, n, floor }] }]` — 표 순서 그대로, 끝에 표 밖 이름난 적(잡은 것만) */
  function groups() {
    var ed = ED(), b = book(), out = [], k;
    if (!ed) { return out; }
    function rows(list, boss) {
      return (list || []).map(function (r) {
        var c = b[keyOf(r)];
        return { key: keyOf(r), ref: r, boss: boss, n: c ? c.n : 0, floor: c ? c.floor : -1 };
      });
    }
    out.push({ key: 'boss', name: '우두머리', rows: rows(ed.bosses, true) });
    [1, 2, 3, 4].forEach(function (t) {
      out.push({ key: 't' + t, name: t + '단계 · ' + ['', '1~5', '6~12', '13~25', '26~'][t] + '관문',
        rows: rows((ed.enemies || []).filter(function (e) { return e.tier === t; }), false) });
    });
    out.push({ key: 'era', name: '다른 시대', rows: rows(ed.eraEnemies, false) });
    var named = [];
    for (k in b) {
      if (Object.prototype.hasOwnProperty.call(b, k) && k.indexOf('x:') === 0 && b[k].n) {
        var c = b[k];
        named.push({ key: k, ref: { id: k.slice(2), name: c.name || k.slice(2), emoji: c.emoji, kind: c.kind, form: c.form },
          boss: false, n: c.n, floor: c.floor });
      }
    }
    if (named.length) { out.push({ key: 'named', name: '이름난 적(지역 우두머리·층 주인)', rows: named, open: true }); }
    return out;
  }

  function tally() {
    var seen = 0, total = 0, kills = 0;
    groups().forEach(function (g) {
      g.rows.forEach(function (r) { total++; if (r.n) { seen++; kills += r.n; } });
    });
    return { seen: seen, total: total, kills: kills };
  }

  function placeText(floor) { return floor > 0 ? '제' + floor + '층' : '들판'; }

  /** 얼굴 — 몸 계열 초상, 그림을 못 받으면 그 자리를 이모지로 바꾼다 */
  function faceOf(ref, boss) {
    var MP = global.DG.monsterPortrait, emo = ref.emoji || '👹', p = MP ? MP.src(ref, boss) : null;
    if (!p) { return emo; }
    return '<img class="d2-fport" alt="" src="' + p + '" width="40" height="40" onerror="this.replaceWith(document.createTextNode(\'' + emo + '\'))">';
  }

  /** 시트 본문 — ui.js 의 `esc`·`dexBar` 를 받아 쓴다. 칸은 도감과 같은 `dexgrid`/`dcell`(새 CSS 없음, 누를 것이 없어 손가락 모양을 끈다) */
  function view(esc, dexBar) {
    esc = esc || function (s) { return String(s); };
    var t = tally(), bar = dexBar || function () { return ''; };
    var html = '<div class="sec"><h4>잡아 본 종 <small class="muted">' + t.seen + ' / ' + t.total +
      ' 종 · 모두 ' + t.kills + '마리</small></h4>' + bar(t.seen, t.total || 1) + '</div>';
    groups().forEach(function (g) {
      if (!g.rows.length) { return; }
      var gs = g.rows.filter(function (r) { return r.n; }).length;
      html += '<div class="sec"><h4>' + g.name + ' <small class="muted">' + (g.open ? gs : gs + ' / ' + g.rows.length) + '</small></h4><div class="dexgrid">';
      g.rows.forEach(function (r) {
        var have = r.n > 0;
        html += '<div class="dcell bst-cell' + (have ? '' : ' locked') + '" style="cursor:default;transform:none" title="' +
          esc(have ? r.ref.name + ' · 처치 ' + r.n + ' · 처음 ' + placeText(r.floor) : '아직 못 잡음') + '">' +
          (have ? '<span class="de">' + faceOf(r.ref, r.boss) + '</span>' : '<span class="de locked-mark">❔</span>') +
          '<small>' + (have ? esc(r.ref.name) : '???') + '</small>' +
          (have ? '<i class="cnt">×' + r.n + '</i>' : '') + '</div>';
      });
      html += '</div></div>';
    });
    return html + '<div class="hint">잡으면 칸이 열립니다. 칸에 손을 올리면 처치 수와 처음 잡은 곳이 보입니다. ' +
      '그림은 몸 계열 초상이라 닮은 것끼리 같은 얼굴을 씁니다.</div>';
  }

  var started = false;
  function start() {
    if (started || !core() || !core().on) { return false; }
    core().on('dungeon:kill', onKill);
    started = true;
    return true;
  }
  start();

  global.DG.bestiary = {
    RENAMED: RENAMED,
    keyOf: keyOf, record: record, onKill: onKill, groups: groups, tally: tally, view: view, start: start,
    /** 진단이 제 뒤를 치울 때 */
    clear: function () { core().save.kills = {}; return true; }
  };
})(typeof window !== 'undefined' ? window : this);
