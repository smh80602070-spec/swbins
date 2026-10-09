/**
 * 몬스터 도감 — 무엇을 몇 마리 잡았는지 (W-0117)
 * ---------------------------------------------------------------
 * 목록은 새로 만들지 않는다 — `enemyData` 의 세 표(우두머리 BOSSES · 잡졸 ENEMIES · 세 시대 ERA_ENEMIES)를 그대로 읽는다.
 * 세는 일은 `dungeon:kill` 사건만 듣는다(quest.js·scenario.js 와 같은 길) — 판정 파일(dungeon.js)은 한 줄도 안 바뀐다.
 *
 *   종 키   우두머리 = 'b:' + id(로마자 슬러그, 토벌첩과 같은 id) · 나머지 = 표시 이름(잡졸 표엔 id 가 없고
 *           data-enemy.js 는 사가종횡과 나눠 든 파일이라 새 칸을 안 만든다 — `enemyData.byName` 과 같은 길).
 *           이름을 바꾸면 그 종의 처치 수는 0 부터 다시 센다.
 *   세이브  `save.kills[<종 키>] = { n, floor, at }` — 처치 수 · 처음 잡은 층(0 = 들판) · 처음 잡은 때.
 *           없던 칸이라 옛 세이브는 여기서 빈 칸으로 채워진다(세이브 판 올림 없음).
 *   초상    `monsterPortrait.html` 몸 계열 초상, 사람형(초상 없음)은 이모지. 분신(shade)은 세지 않는다.
 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};

  function core() { return global.DG.core; }
  function ED() { return global.DG.enemyData; }

  function keyOf(ref) { return !ref ? null : (ref.id ? 'b:' + ref.id : ref.name || null); }

  function book() {
    var s = core().save;
    if (!s.kills || typeof s.kills !== 'object') { s.kills = {}; }
    return s.kills;
  }

  /** 처치 한 번 — 처음이면 층을 남긴다. 반환: 그 종 칸 */
  function record(ref, floor) {
    var k = keyOf(ref);
    if (!k) { return null; }
    var b = book(), c = b[k];
    if (!c) { c = b[k] = { n: 0, floor: Math.max(0, floor | 0), at: Date.now() }; }
    c.n += 1;
    return c;
  }

  function onKill(p) {
    if (!p || !p.e || p.e.shade) { return; }
    record(p.e.ref, p.floor);
  }

  /** 갈래 넷 `[{ key, name, rows:[{ key, ref, boss, n, floor }] }]` — 표 순서 그대로 */
  function groups() {
    var ed = ED(), b = book(), out = [];
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

  /** 시트 본문 — ui.js 의 `esc` 를 받아 쓴다. 칸은 도감과 같은 `dexgrid`/`dcell`(새 CSS 없음) */
  function view(esc) {
    esc = esc || function (s) { return String(s); };
    var MP = global.DG.monsterPortrait, t = tally();
    var html = '<div class="sec"><h4>잡아 본 종 <small class="muted">' + t.seen + ' / ' + t.total +
      ' 종 · 모두 ' + t.kills + '마리</small></h4>' +
      '<div class="dexbar"><div class="bar"><i style="width:' + (t.total ? t.seen / t.total * 100 : 0) + '%"></i></div>' +
      '<small>' + t.seen + ' / ' + t.total + '</small></div></div>';
    groups().forEach(function (g) {
      if (!g.rows.length) { return; }
      var gs = g.rows.filter(function (r) { return r.n; }).length;
      html += '<div class="sec"><h4>' + g.name + ' <small class="muted">' + gs + ' / ' + g.rows.length + '</small></h4><div class="dexgrid">';
      g.rows.forEach(function (r) {
        var have = r.n > 0, face = '';
        if (have) {
          face = MP ? MP.html(r.ref, r.boss, 40) : '';
          if (!face) { face = r.ref.emoji || '👹'; }
        }
        html += '<div class="dcell bst-cell' + (have ? '' : ' locked') + '" title="' +
          esc(have ? r.ref.name + ' · 처치 ' + r.n + ' · 처음 ' + placeText(r.floor) : '아직 못 잡음') + '">' +
          (have ? '<span class="de">' + face + '</span>' : '<span class="de locked-mark">❔</span>') +
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
    keyOf: keyOf, record: record, groups: groups, tally: tally, view: view, start: start,
    /** 진단이 제 뒤를 치울 때 */
    clear: function () { core().save.kills = {}; return true; }
  };
})(typeof window !== 'undefined' ? window : this);
