/**
 * 대사·퀘스트 편집기 — 서버 쪽(표 목록·읽기·검사·저장). 화면은 story.html.
 *
 * 다섯 판의 퀘스트·대사 표(`var NAME = [ … ]`·`{ … }`)를 **값으로** 읽어 칸마다 고치게 하고,
 * 저장은 jslit.patchTop 으로 **바뀐 값의 글자 자리만** 바꾼다(주석·줄 맞춤·다른 값 그대로).
 * 함수·식이 섞인 자리(사가만리 사건의 결과 등)는 코드는 못 고치고 그 안의 `text:`·`label:` 문자열만 고친다.
 *
 * 저장 전에 막는 것:
 *   그새 파일이 바뀜(md5) · 고친 파일 구문 오류 · **되읽기 불일치**(고친 파일을 다시 읽은 값이 화면 값과 다르면)
 *   · 표마다 검사 오류(없는 사냥터·없는 방 종류·모르는 목표 …) · 있던 id/키를 지우거나 바꿈(세이브가 들고 있다)
 *   · 새로 쓴 글자의 실명(역사 문답 파일은 예외 — realname.isExempt)
 * 경고만(저장은 된다): 게임이 첫 번째만 채우는 표지(`{town}` 두 번) · 모르는 표지 · 빈 설명 · 새 항목(코드가 셀 수 있는지 볼 것).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const J = require('./jslit');
const realname = require('./realname');

const md5 = (t) => crypto.createHash('md5').update(t, 'utf8').digest('hex');
const fileOf = (root, game, file) => path.join(root, game, 'js', file);

/* 다른 표에서 값 읽기(참조 검사용) — 파일·이름이 없으면 빈 값 */
function readVar(root, game, file, name) {
  try { const n = J.parseVar(fs.readFileSync(fileOf(root, game, file), 'utf8'), name); return n ? J.toValue(n) : null; } catch (e) { return null; }
}
const keysOf = (arr, k) => (Array.isArray(arr) ? arr.map((x) => x && x[k]).filter((x) => x !== undefined) : []);
const isInt = (n) => Number.isInteger(n);

/* 표지 — 게임의 replace('{x}', …) 는 **첫 번째만** 채운다 */
function tokenWarn(where, s, allowed, warns) {
  if (typeof s !== 'string') return;
  const found = s.match(/\{[a-z]+\}/g) || [];
  const seen = {};
  for (const t of found) {
    if (allowed.indexOf(t) < 0) warns.push(where + ' — 모르는 표지 ' + t + '(그대로 찍힌다). 쓸 수 있는 것: ' + allowed.join(' '));
    else if (seen[t]) warns.push(where + ' — ' + t + ' 가 두 번: 게임은 첫 번째만 채운다');
    seen[t] = 1;
  }
}
const need = (cond, msg, out) => { if (!cond) out.push(msg); };

/* ── 표 목록 ─────────────────────────────────────────────
 *  id·game·file·v   어느 파일의 어느 변수
 *  group            'quest' | 'talk' | 'quiz'
 *  idKey            배열 항목의 id 칸(없으면 자리 번호) — 맵(객체)은 키가 id
 *  lock             있던 항목에서 못 고치는 칸(세이브·코드가 이 값을 쥔다)
 *  add / del        항목 더하기·지우기 허용(del 은 id 없는 표만 의미 있다 — id 있는 것은 늘 막는다)
 *  enums(ctx)       칸 경로 → 고를 값(''은 "없음" = 그 칸을 뺀다). 경로는 항목 안 기준, 배열 자리는 *
 *  opt              더할 수 있는 칸 → 기본값
 *  tuple            배열 자리의 이름(대사 [누가, 감정, 말])
 *  template         새 항목 기본값(없으면 첫 항목을 본뜬다)
 *  preview          화면 미리보기 모양
 *  check(value, ctx, errors, warns)
 */
function adapters(root) {
  const R = (g, f, v) => readVar(root, g, f, v);
  return [
    /* ── 사가종횡 ── */
    { id: 'story.quests', game: 'saga-story', file: 'data-quest.js', v: 'QUESTS', group: 'quest', label: '사명(퀘스트)', idKey: 'key', add: true,
      lock: ['key'], preview: 'quest',
      enums: () => ({
        'goal.type': ['kill', 'boss', 'gather', 'visit', 'talk', 'gear', 'skill', 'gold', 'level'],
        'goal.stage': [''].concat((R('saga-story', 'data-side.js', 'STAGES') || []).filter((s) => !s.town).map((s) => s.key)),   // 마을(town)은 싸움이 없다
        'goal.kind': [''].concat(Object.keys(R('saga-story', 'data-side.js', 'GATHERS') || {})),
        'reward.scroll': [''].concat(keysOf(R('saga-story', 'data-gear.js', 'SCROLLS'), 'key')),
      }),
      opt: { 'goal.stage': 'field', 'goal.kind': 'herb', 'reward.exp': 100, 'reward.gold': 100, 'reward.potion': 1, 'reward.scroll': 'atk100', 'reward.gear': 1 },
      template: { key: 'q_new', name: '새 사명', need: 1, repeat: false, goal: { type: 'kill', n: 10 }, desc: '', reward: { exp: 100, gold: 100 } },
      check(v, ctx, E, W) {
        const en = this.enums();
        v.forEach((q, i) => {
          const at = '#' + (i + 1) + ' ' + (q.name || q.key);
          need(isInt(q.need) && q.need >= 1, at + ' — need(레벨)는 1 이상 정수', E);
          need(q.goal && en['goal.type'].indexOf(q.goal.type) >= 0, at + ' — 모르는 목표 ' + (q.goal && q.goal.type), E);
          need(q.goal && isInt(q.goal.n) && q.goal.n > 0, at + ' — 목표 수 n 은 1 이상 정수', E);
          if (q.goal && q.goal.stage !== undefined) need(en['goal.stage'].indexOf(q.goal.stage) > 0, at + ' — 없는 사냥터 ' + q.goal.stage, E);
          if (q.goal && q.goal.stage !== undefined && q.goal.type !== 'kill' && q.goal.type !== 'boss') W.push(at + ' — stage 는 kill·boss 에서만 센다(quest.js)');
          if (q.goal && q.goal.kind !== undefined) need(en['goal.kind'].indexOf(q.goal.kind) > 0, at + ' — 없는 채집물 ' + q.goal.kind, E);
          if (q.goal && q.goal.kind !== undefined && q.goal.type !== 'gather') W.push(at + ' — kind 는 gather 에서만 센다');
          if (q.reward && q.reward.scroll !== undefined) need(en['reward.scroll'].indexOf(q.reward.scroll) > 0, at + ' — 없는 주문서 ' + q.reward.scroll, E);
          for (const k of ['exp', 'gold', 'potion']) if (q.reward && q.reward[k] !== undefined) need(isInt(q.reward[k]) && q.reward[k] >= 0, at + ' — 보상 ' + k + ' 는 0 이상 정수', E);
          if (!q.desc) W.push(at + ' — 설명이 비었다');
        });
      } },
    { id: 'story.talk', game: 'saga-story', file: 'data-side.js', v: 'NPC_TALK', group: 'talk', label: '마을 사람 말', add: true, preview: 'npcLines',
      opt: { shop: true }, template: { name: '새 사람', emoji: '🙂', lines: ['안녕하시오.'] },
      check(v, ctx, E, W) {
        const used = new Set();
        (R('saga-story', 'data-side.js', 'STAGES') || []).forEach((s) => (s.npcs || []).forEach((n) => used.add(n[1])));
        for (const k of used) need(v[k], '사냥터 npcs 가 쓰는 ' + k + ' 가 없다', E);
        for (const [k, p] of Object.entries(v)) {
          need(p && p.name, k + ' — 이름이 없다', E);
          need(Array.isArray(p.lines) && p.lines.length && p.lines.every((s) => typeof s === 'string' && s.trim()), k + ' — 말(lines)이 하나 이상, 빈 줄 없이', E);
          if (!used.has(k)) W.push(k + ' — 어느 마을에도 안 선다(사냥터 npcs 에 [x, \'' + k + '\'] 를 더해야 보인다 — 맵 편집기 사냥터)');
        }
      } },
    { id: 'story.scenes', game: 'saga-story', file: 'data-side.js', v: 'STORY', group: 'talk', label: '첫 발 장면(연출)', add: true, preview: 'scene',
      tuple: { 'lines.*': ['누가', '감정', '말'] },
      enums: () => ({ 'lines.*.0': ['me'].concat(Object.keys(R('saga-story', 'data-side.js', 'NPC_TALK') || {})), 'lines.*.1': Object.keys(R('saga-story', 'data-side.js', 'EMOTES') || {}) }),
      template: { title: '새 장면', lines: [['me', 'calm', '…']] },
      ctx: () => ({ names: Object.fromEntries(Object.entries(R('saga-story', 'data-side.js', 'NPC_TALK') || {}).map(([k, p]) => [k, (p.emoji || '') + ' ' + p.name])), emotes: R('saga-story', 'data-side.js', 'EMOTES') || {} }),
      check(v, ctx, E, W) {
        const en = this.enums(), stages = keysOf(R('saga-story', 'data-side.js', 'STAGES'), 'key');
        for (const [k, sc] of Object.entries(v)) {
          need(stages.indexOf(k) >= 0, k + ' — 이 이름의 사냥터가 없다(장면은 그 사냥터에 처음 들 때 뜬다)', E);
          need(Array.isArray(sc.lines) && sc.lines.length, k + ' — 줄이 없다', E);
          (sc.lines || []).forEach((l, i) => {
            const at = k + ' ' + (i + 1) + '줄';
            need(Array.isArray(l) && l.length === 3, at + ' — [누가, 감정, 말] 셋이어야', E);
            need(en['lines.*.0'].indexOf(l[0]) >= 0, at + ' — 모르는 사람 ' + l[0], E);
            need(en['lines.*.1'].indexOf(l[1]) >= 0, at + ' — 모르는 감정 ' + l[1], E);
            need(typeof l[2] === 'string' && l[2].trim(), at + ' — 말이 비었다', E);
          });
        }
      } },
    { id: 'story.chat', game: 'saga-story', file: 'data-side.js', v: 'NPC_CHAT', group: 'talk', label: '마을 사람끼리 잡담', add: true, del: true, preview: 'pair',
      tuple: { '': ['앞사람', '받는 말'] }, tokens: ['{town}'], template: ['{town} 이 오늘따라 조용하구먼.', '그러게 말입니다.'],
      check(v, ctx, E, W) {
        v.forEach((p, i) => {
          need(Array.isArray(p) && p.length === 2 && p.every((s) => typeof s === 'string' && s.trim()), '#' + (i + 1) + ' — 두 줄이어야(주고받기)', E);
          (p || []).forEach((s) => tokenWarn('#' + (i + 1), s, this.tokens, W));
        });
      } },

    /* ── 사가나락 ── */
    ...['MAIN', 'EVENT'].map((V) => ({
      id: 'dungeon.' + V.toLowerCase(), game: 'saga-dungeon', file: 'data-quest.js', v: V, group: 'quest',
      label: V === 'MAIN' ? '메인 퀘스트(차례대로)' : '구출 이벤트 단계', idKey: 'key', add: true, lock: ['key'], preview: 'quest', ordered: V === 'MAIN' ? 'mainIdx' : 'eventIdx',
      enums: () => ({ 'req.t': ['kill', 'discover', 'floor', 'rescue'], 'req.tag': ['', 'elite', 'boss'], 'req.room': [''].concat(keysOf(R('saga-dungeon', 'data-dungeon.js', 'ROOMS'), 'key')) }),
      opt: { 'req.tag': 'elite', 'req.room': 'trove', 'reward.feat': 10 },
      template: { key: (V === 'MAIN' ? 'm' : 'e') + 'new', name: '새 퀘스트', desc: '', req: { t: V === 'MAIN' ? 'floor' : 'rescue', n: 1 }, reward: { gold: 100, exp: 10 } },
      check(v, ctx, E, W) { dungeonReqCheck(v, this.enums(), E, W, false); } })),
    { id: 'dungeon.region', game: 'saga-dungeon', file: 'data-quest.js', v: 'REGION', group: 'quest', label: '지역 퀘스트(지역 순서 그대로)', preview: 'plain', fixed: '지역',
      check(v, ctx, E, W) {
        const th = R('saga-dungeon', 'data-dungeon.js', 'THEMES') || [];
        need(v.length === th.length, '지역 수 ' + v.length + ' ≠ 테마 ' + th.length + '(자리 번호가 곧 지역이다)', E);
        v.forEach((r, i) => { need(r.name, '#' + (i + 1) + ' 이름', E); need(isInt(r.kill) && r.kill > 0, '#' + (i + 1) + ' kill 은 1 이상 정수', E); });
      } },
    { id: 'dungeon.random', game: 'saga-dungeon', file: 'data-quest.js', v: 'RANDOM_POOL', group: 'quest', label: '무작위 현상(설명은 코드)', preview: 'plain',
      enums: () => ({ 'req.t': ['kill', 'discover', 'floor', 'rescue'], 'req.tag': ['', 'elite', 'boss'], 'req.room': [''].concat(keysOf(R('saga-dungeon', 'data-dungeon.js', 'ROOMS'), 'key')) }),
      check(v, ctx, E, W) { dungeonReqCheck(v, this.enums(), E, W, true); } },
    { id: 'dungeon.npc', game: 'saga-dungeon', file: 'town.js', v: 'NPC_DEFS', group: 'talk', label: '마을 사람(한 마디)', lock: ['sheet'], preview: 'npcLine',
      check(v, ctx, E, W) {
        for (const [k, p] of Object.entries(v)) {
          need(p.name, k + ' 이름', E);
          need(typeof p.line === 'string' && p.line.trim(), k + ' — 한 마디가 비었다', E);
          need(/^#[0-9a-fA-F]{6}$/.test(p.color || ''), k + ' — 색은 #rrggbb', E);
          need(isInt(p.rarity) && p.rarity >= 1 && p.rarity <= 5, k + ' — rarity 1~5', E);
        }
      } },

    /* ── 사가만리 ── */
    { id: 'go.quests', game: 'saga-go', file: 'quest.js', v: 'KINDS', group: 'quest', label: '사명(날마다 셋)', idKey: 'key', add: true, lock: ['key', 'kind'], preview: 'quest',
      enums: () => ({ kind: ['catch', 'recruit', 'station', 'walk', 'letter', 'fort', 'rare', 'rogue'] }),
      opt: { 'reward.gold': 50, 'reward.exp': 100, 'reward.feed': 1, 'reward.scroll': 1, 'reward.treat': 1, 'reward.incense': 1, 'reward.prayer': 1 },
      template: { key: 'new', kind: 'walk', name: '새 사명', emoji: '📜', n: 1, reward: { gold: 50, exp: 100 } },
      check(v, ctx, E, W) {
        const kinds = this.enums().kind;
        v.forEach((q, i) => {
          const at = '#' + (i + 1) + ' ' + q.name;
          need(kinds.indexOf(q.kind) >= 0, at + ' — 코드가 세는 kind 가 아니다: ' + q.kind, E);
          need(isInt(q.n) && q.n > 0, at + ' — n 은 1 이상 정수', E);
          for (const [k, x] of Object.entries(q.reward || {})) {
            need(['gold', 'exp', 'feed', 'scroll', 'treat', 'incense', 'prayer'].indexOf(k) >= 0, at + ' — 모르는 보상 ' + k, E);
            need(isInt(x) && x >= 0, at + ' — 보상 ' + k + ' 는 0 이상 정수', E);
          }
        });
      } },
    { id: 'go.lines', game: 'saga-go', file: 'npc.js', v: 'LINES', group: 'talk', label: '마을 사람 말(낮·밤·비)', preview: 'dayNight',
      check(v, ctx, E, W) {
        for (const [k, s] of Object.entries(v)) {
          need(typeof s.day === 'string' && s.day, k + ' — 낮 말(day)이 없다(밤·비가 없으면 이것으로 대신한다)', E);
          for (const t of ['night', 'rain']) if (s[t] === undefined) W.push(k + ' — ' + t + ' 가 없어 낮 말로 대신한다');
        }
      }, opt: { night: '…', rain: '…' } },
    { id: 'go.events', game: 'saga-go', file: 'event.js', v: 'EVENTS', group: 'talk', label: '길 위 사건(고르기·결과 글)', idKey: 'id', lock: ['id'], preview: 'event',
      enums: () => ({ when: ['day', 'night', 'any'], 'where.*': ['grass', 'forest', 'mount', 'water', 'road', 'town', 'farm'] }),
      check(v, ctx, E, W) {
        v.forEach((ev, i) => {
          const at = ev.id;
          need(ev.name, at + ' 이름', E);
          need(typeof ev.w === 'number' && ev.w > 0, at + ' — 가중치 w > 0', E);
          need(this.enums().when.indexOf(ev.when) >= 0, at + ' — when 은 day·night·any', E);
          (ev.where || []).forEach((w) => need(this.enums()['where.*'].indexOf(w) >= 0, at + ' — 모르는 터 ' + w, E));
          (ev.choices || []).forEach((c, j) => need(c.label, at + ' 고르기 ' + (j + 1) + ' — 글이 비었다', E));
        });
      } },

    /* ── 사가마을 ── */
    { id: 'forest.topics', game: 'saga-forest', file: 'folk.js', v: 'TOPICS', group: 'talk', label: '주민끼리 대화(번갈아)', add: true, del: true, preview: 'alternate',
      tokens: ['{season}', '{phase}', '{town}', '{other}'], template: ['{season}이 좋구려.', '그렇소.', '허허.'],
      check(v, ctx, E, W) {
        v.forEach((t, i) => {
          need(Array.isArray(t) && t.length >= 2 && t.every((s) => typeof s === 'string' && s.trim()), '#' + (i + 1) + ' — 두 줄 이상, 빈 줄 없이', E);
          (t || []).forEach((s) => tokenWarn('#' + (i + 1), s, this.tokens, W));
        });
      } },
    { id: 'forest.eventTopic', game: 'saga-forest', file: 'folk.js', v: 'EVENT_TOPIC', group: 'talk', label: '행삿날 대화', preview: 'alternate1',
      tokens: ['{season}', '{phase}', '{town}', '{other}', '{event}', '{hello}'], add: true, del: true, template: '…',
      check(v, ctx, E, W) {
        need(v.length >= 2 && v.every((s) => typeof s === 'string' && s.trim()), '두 줄 이상, 빈 줄 없이', E);
        v.forEach((s, i) => tokenWarn((i + 1) + '줄', s, this.tokens, W));
      } },

    /* ── 사가천하 — 문답은 이 판 몫이다(CLAUDE.md) ── */
    { id: 'realm.quiz', game: 'saga-realm', file: 'data-quiz.js', v: 'BANK', group: 'quiz', label: '문답(역사 퀴즈)', idKey: 'id', add: true, lock: ['id'], preview: 'quiz',
      enums: () => ({ cat: keysOf(R('saga-realm', 'data-quiz.js', 'CATS'), 'key'), lv: [1, 2, 3] }),
      template: { id: 'x01', cat: 'hist', lv: 1, q: '', c: ['', '', '', ''], a: 0, why: '' },
      check(v, ctx, E, W) {
        const cats = this.enums().cat;
        v.forEach((q, i) => {
          const at = q.id || '#' + (i + 1);
          need(cats.indexOf(q.cat) >= 0, at + ' — 모르는 갈래 ' + q.cat, E);
          need(isInt(q.lv) && q.lv >= 1 && q.lv <= 3, at + ' — lv 1~3', E);
          need(typeof q.q === 'string' && q.q.trim(), at + ' — 물음이 비었다', E);
          need(Array.isArray(q.c) && q.c.length >= 2 && q.c.every((s) => typeof s === 'string' && s.trim()), at + ' — 보기가 둘 이상, 빈 칸 없이', E);
          need(isInt(q.a) && q.a >= 0 && q.a < (q.c || []).length, at + ' — 답(a)이 보기 번호 밖', E);
          if (Array.isArray(q.c) && new Set(q.c).size !== q.c.length) W.push(at + ' — 같은 보기가 둘');
          if (!q.why) W.push(at + ' — 풀이(why)가 비었다');
        });
      } },
  ];
}

function dungeonReqCheck(v, en, E, W, pool) {
  v.forEach((q, i) => {
    const at = '#' + (i + 1) + ' ' + (q.name || q.key);
    const r = q.req || {};
    need(en['req.t'].indexOf(r.t) >= 0, at + ' — 모르는 요구 ' + r.t, E);
    if (r.tag !== undefined) need(en['req.tag'].indexOf(r.tag) > 0, at + ' — tag 는 elite·boss', E);
    if (r.t === 'discover') need(en['req.room'].indexOf(r.room) > 0, at + ' — discover 는 있는 방 종류(room)가 있어야: ' + r.room, E);
    if (r.room !== undefined && r.t !== 'discover') W.push(at + ' — room 은 discover 에서만 센다');
    if (r.tag !== undefined && r.t !== 'kill') W.push(at + ' — tag 는 kill 에서만 센다');
    if (pool) need(isInt(r.lo) && isInt(r.hi) && r.lo >= 1 && r.lo <= r.hi, at + ' — lo ≤ hi, 1 이상 정수', E);
    else need(isInt(r.n) && r.n > 0, at + ' — n 은 1 이상 정수', E);
    if (!pool && !q.desc) W.push(at + ' — 설명이 비었다');
    for (const [k, x] of Object.entries(q.reward || {})) need(isInt(x) && x >= 0, at + ' — 보상 ' + k + ' 는 0 이상 정수', E);
  });
}

/* ── 공통 ─────────────────────────────────────────────── */
function find(root, id) { return adapters(root).find((a) => a.id === id) || null; }
function strings(v, out) {
  if (typeof v === 'string') out.push(v);
  else if (J.isRawVal(v)) v.$texts.forEach((x) => out.push(x.v));
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}
/** 있던 항목(id·키)이 그대로 있고, 잠근 칸이 안 바뀌었나 */
function lockCheck(A, oldV, newV, E) {
  if (Array.isArray(oldV)) {
    if (A.idKey) {
      const ids = new Set(newV.map((x) => x && x[A.idKey]));
      oldV.forEach((o) => {
        if (!ids.has(o[A.idKey])) E.push(A.idKey + ' ' + o[A.idKey] + ' 를 지웠거나 바꿨다 — 세이브·코드가 이 값을 쥐고 있어 막는다');
      });
      const seen = {};
      newV.forEach((x, i) => {
        const id = x && x[A.idKey];
        if (id === undefined || id === '') E.push('#' + (i + 1) + ' — ' + A.idKey + ' 가 비었다');
        else if (seen[id]) E.push(A.idKey + ' ' + id + ' 가 둘');
        seen[id] = 1;
        const o = oldV.find((y) => y[A.idKey] === id);
        if (!o && !/^[a-z][a-z0-9_]*$/.test(String(id))) E.push('새 ' + A.idKey + ' ' + id + ' — 영문 소문자·숫자·_ 로');
        if (o) (A.lock || []).forEach((k) => { if (!J.same(o[k], x[k])) E.push(id + ' — ' + k + ' 는 못 바꾼다(잠금)'); });
      });
      if (!A.add && newV.length > oldV.length) E.push('이 표는 항목을 더하지 않는다(코드가 따로 세야 한다)');
    } else {
      if (!A.del && newV.length < oldV.length) E.push('이 표는 항목을 지우지 않는다(자리 번호가 곧 뜻이다)');
      if (!A.add && newV.length > oldV.length) E.push('이 표는 항목을 더하지 않는다');
    }
  } else {
    Object.keys(oldV).forEach((k) => {
      if (!(k in newV)) E.push('키 ' + k + ' 를 지웠다 — 다른 표·코드가 이 키를 부른다');
      else (A.lock || []).forEach((f) => { if (!J.same(oldV[k][f], newV[k][f])) E.push(k + ' — ' + f + ' 는 못 바꾼다(잠금)'); });
    });
    Object.keys(newV).forEach((k) => {
      if (!(k in oldV)) {
        if (!A.add) E.push('이 표는 키를 더하지 않는다');
        else if (!/^[a-z][a-z0-9_]*$/.test(k)) E.push('새 키 ' + k + ' — 영문 소문자·숫자·_ 로');
      }
    });
  }
}

/** 차례 — fixed 표는 못 옮기고, ordered 표는 옛 항목 자리가 바뀌면 경고(세이브가 자리 번호로 진행을 쥔다) */
function orderCheck(A, oldV, newV, origin, E, W) {
  if (!Array.isArray(oldV)) return;
  let from;                                                             // 새 자리 → 옛 자리(-1 = 새 항목)
  if (A.idKey) from = newV.map((x) => oldV.findIndex((o) => x && o[A.idKey] === x[A.idKey]));
  else if (Array.isArray(origin) && origin.length === newV.length) from = origin;
  else return;
  const shifted = from.filter((o, j) => o >= 0 && o !== j).length;
  const inserted = from.findIndex((o) => o < 0) >= 0 && from.some((o, j) => o < 0 && from.slice(j + 1).some((x) => x >= 0));
  if (A.fixed && (shifted || inserted)) E.push('이 표는 자리 번호가 곧 뜻이다(' + A.fixed + ') — 옮기거나 가운데 끼우지 않는다');
  else if (A.ordered && shifted) W.push('옛 항목 ' + shifted + '개의 차례가 바뀐다 — 세이브가 자리 번호(' + A.ordered + ')로 진행을 쥐어, 하던 세이브는 건너뛰거나 되풀이한다');
}

function list(root) {
  return adapters(root).map((A) => {
    let count = null, error = null;
    try { const n = J.parseVar(fs.readFileSync(fileOf(root, A.game, A.file), 'utf8'), A.v); const v = J.toValue(n); count = Array.isArray(v) ? v.length : Object.keys(v).length; }
    catch (e) { error = e.message; }
    return { id: A.id, game: A.game, file: A.file, v: A.v, group: A.group, label: A.label, count, error };
  });
}

function read(root, id) {
  const A = find(root, id);
  if (!A) return { error: '모르는 표' };
  const text = fs.readFileSync(fileOf(root, A.game, A.file), 'utf8');
  const n = J.parseVar(text, A.v);
  if (!n) return { error: A.v + ' 를 못 찾음' };
  return {
    id: A.id, game: A.game, file: A.file, v: A.v, group: A.group, label: A.label, hash: md5(text),
    value: J.toValue(n), idKey: A.idKey || null, lock: A.lock || [], add: !!A.add, del: !!A.del, ordered: !!A.ordered, fixed: !!A.fixed,
    enums: A.enums ? A.enums() : {}, opt: A.opt || {}, tuple: A.tuple || {}, tokens: A.tokens || [], template: A.template === undefined ? null : A.template,
    preview: A.preview || 'plain', ctx: A.ctx ? A.ctx() : {}, exempt: realname.isExempt(A.game + '/js/' + A.file),
    textKeys: J.TEXT_KEYS,
  };
}

/** 검사 + 고친 글자 만들기(저장과 같은 길) — 저장은 이것이 오류 없이 끝났을 때만 쓴다 */
function build(root, b) {
  const A = find(root, b.id);
  if (!A) return { error: '모르는 표' };
  const fp = fileOf(root, A.game, A.file);
  const text = fs.readFileSync(fp, 'utf8');
  const n = J.parseVar(text, A.v);
  const oldV = J.toValue(n), newV = b.value;
  const E = [], W = [];
  if (Array.isArray(oldV) !== Array.isArray(newV) || !newV || typeof newV !== 'object') return { errors: ['값 모양이 다르다(배열/객체)'], warns: [] };
  lockCheck(A, oldV, newV, E);
  orderCheck(A, oldV, newV, b.origin, E, W);
  try { A.check(newV, {}, E, W); } catch (e) { E.push('검사 중 오류: ' + e.message); }
  let out = null;
  try {
    out = J.patchTop(text, n, newV, A.idKey, b.origin);
    new vm.Script(out.text, { filename: A.file });
    const back = J.toValue(J.parseVar(out.text, A.v));
    const norm = (x) => JSON.stringify(x, (k, y) => (J.isRawVal(y) ? { t: y.$texts.map((z) => z.v) } : y));
    if (norm(back) !== norm(newV)) E.push('되읽기 불일치 — 고친 파일을 다시 읽은 값이 화면과 다르다(편집기 버그 — 이 고침은 저장 안 한다)');
    if (out.lost.length) W.push('통째로 새로 쓰는 자리 ' + out.lost.join(', ') + ' — 그 안의 주석이 사라진다');
  } catch (e) { E.push('고친 파일을 만들지 못함: ' + e.message); }
  /* 새로 들어온 글자만 실명 가드(역사 문답 파일은 예외) */
  if (!realname.isExempt(A.game + '/js/' + A.file)) {
    const old = new Set(strings(oldV, []));
    const fresh = strings(newV, []).filter((s) => !old.has(s));
    if (fresh.length) { const g = realname.guard(A.game + '/' + A.file + ' ' + A.v, ...fresh); if (g) E.push(g); }
  }
  const changed = out ? out.text !== text : false;
  return { A, fp, text, next: out ? out.text : null, errors: E, warns: W, changed, edits: out ? out.edits : 0 };
}

function check(root, b) {
  const r = build(root, b);
  if (r.error) return r;
  return { errors: r.errors, warns: r.warns, changed: r.changed, edits: r.edits };
}

function save(root, b, bumpSw) {
  const r = build(root, b);
  if (r.error) return r;
  if (md5(r.text) !== b.hash) return { error: '그새 ' + r.A.file + ' 가 바뀌었다(다른 세션·편집기) — 다시 읽고 고친다', errors: r.errors, warns: r.warns };
  if (r.errors.length) return { error: '검사 오류(저장 안 함): ' + r.errors.slice(0, 4).join(' · '), errors: r.errors, warns: r.warns };
  if (!r.changed) return { ok: true, unchanged: true, hash: b.hash, errors: [], warns: r.warns };
  fs.writeFileSync(r.fp, r.next, 'utf8');
  return { ok: true, hash: md5(r.next), edits: r.edits, sw: bumpSw(r.A.game), errors: [], warns: r.warns };
}

module.exports = { adapters, list, read, check, save, build };
