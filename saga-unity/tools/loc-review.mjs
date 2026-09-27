// 영어 검수 목록 (PLAN.md 110 ⑥c).
//
// 다섯 판 번역 표(Games/SagaXxx/Resources/Localization/xxx_{ko,en}.json)와 코드에 박힌 두 언어 짝
// (`SagaUi.L("한국어", "English")`, Editor 밖)을 모아 기계로 잡을 수 있는 것을 먼저 거르고,
// 사람이 한 줄씩 볼 검수표를 만든다.
//
//   docs/en_review.tsv  — 모든 짝(순위·판·키·한국어·영어·깃발·검수). "검수" 칸은 사람이 채운다
//                          (OK / 고칠 말). 다시 돌려도 영어가 그대로인 줄은 검수 칸을 지키고,
//                          영어가 바뀐 줄은 비운다.
//   docs/EN_REVIEW.md   — 요약: 오류·경고·용어 흔들림·실명·넘침 주의·검수 진척.
//
// 오류(자리표 {0} 불일치·영어에 한글·빈 영어·키 짝 안 맞음·앞뒤 공백 다름·실명)가 하나라도 있으면 exit 1.
//
// 사용: node tools/loc-review.mjs [--check]   (saga-unity 폴더에서. --check 는 파일을 안 쓰고 검사만)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const assets = path.join(root, 'Assets');
const checkOnly = process.argv.includes('--check');
const GAMES = ['go', 'dungeon', 'forest', 'story', 'realm'];
const HANGUL = /[ㄱ-ㆎ가-힣]/;

// ── 모으기 ─────────────────────────────────────────────────────────────
function readTable(game, lang) {
  const G = game[0].toUpperCase() + game.slice(1);
  const f = path.join(assets, 'Games', 'Saga' + G, 'Resources', 'Localization', `${game}_${lang}.json`);
  const map = new Map();
  for (const e of JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')).entries) map.set(e.key, e.value);
  return map;
}

function walk(dir, out = []) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) { if (d.name !== 'Editor') walk(p, out); }
    else if (d.name.endsWith('.cs')) out.push(p);
  }
  return out;
}

const rows = [];
const errors = [];
for (const g of GAMES) {
  const ko = readTable(g, 'ko'), en = readTable(g, 'en');
  for (const k of ko.keys()) if (!en.has(k)) errors.push([g, k, '영어 표에 키 없음']);
  for (const k of en.keys()) if (!ko.has(k)) errors.push([g, k, '한국어 표에 키 없음']);
  for (const [k, v] of ko) if (en.has(k)) rows.push({ game: g, key: k, ko: v, en: en.get(k) });
}
const LIT = '"((?:[^"\\\\]|\\\\.)*)"';
const codePair = new RegExp('\\bL\\(\\s*' + LIT + '\\s*,\\s*' + LIT + '\\s*\\)', 'g');
const unesc = s => s.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
for (const f of walk(assets)) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(codePair)) {
    const line = src.slice(0, m.index).split('\n').length;
    rows.push({ game: 'common', key: `${path.basename(f)}:${line}`, ko: unesc(m[1]), en: unesc(m[2]) });
  }
}

// ── 검사 ───────────────────────────────────────────────────────────────
const warns = [];
const flag = (r, level, msg) => { (r.flags ??= []).push(msg); (level === 'E' ? errors : warns).push([r.game, r.key, msg]); };
const tokens = (s, re) => (s.match(re) || []).slice().sort().join(' ');
const PH = /\{\d+(?::[^}]*)?\}/g;
const TAG = /<\/?[a-z]+(?:=[^>]*)?>/gi;
const edge = s => [s.match(/^\s*/)[0], s.match(/\s*$/)[0]];
const lead = s => { const c = [...s.trimStart()][0] || ''; return /[\p{L}\p{N}{("'“‘\[—–-]/u.test(c) ? '' : c; };

// 실명 — 사가고 도감 id 의 이름 조각(sg_guanyu → guan yu / Guanyu …)과 손 목록. 표시 글자에 나오면 오류.
const REAL_EN = new Set(['Liu Bei', 'Zhuge Liang', 'Xiang Yu', 'Aristotle', 'Plato', 'Socrates', 'Pythagoras', 'Columbus',
  'Martin Luther', 'Luther', 'Calvin', 'Zwingli', 'Aquinas', 'Qin Shi Huang', 'Zhu Yuanzhang', 'Alexander the Great',
  'Eulji Mundeok', 'Yeon Gaesomun', 'Yang Manchun', 'On Dal', 'Seo Hui', 'Yun Gwan', 'Choe Yeong', 'Gung-ye', 'Gyeon Hwon',
  'Wang Geon', 'Yi Seong-gye', 'Dae Jo-yeong', 'Jumong', 'Onjo', 'Bak Hyeokgeose', 'Gwon Yul', 'Kim Si-min', 'Gwak Jae-u',
  'Taejong', 'Seongjong', 'Jeongjo', 'King Sejong']);
const REAL_KO = ['태종', '세종', '성종', '정조', '권율', '김시민', '이순신', '곽재우', '을지문덕', '연개소문', '양만춘', '온달',
  '서희', '윤관', '강감찬', '최영', '궁예', '견훤', '왕건', '이성계', '대조영', '주몽', '온조', '박혁거세', '항우', '유비',
  '제갈량', '소크라테스', '플라톤', '아리스토텔레스', '피타고라스', '진시황', '주원장', '콜럼버스', '루터', '칼뱅', '츠빙글리',
  '아퀴나스', '알렉산드로스'];
const KEEP_KO = ['유비무환', '세종로']; // 낱말 속 우연 — 늘어나면 여기에
const realRes = [...REAL_EN].map(n => [n, new RegExp('\\b' + n.replace(/[- ]/g, "[\\s'’-]?") + '\\b', 'i')]);
for (const r of rows.filter(r => r.game === 'go' && /^hero\.[a-z]{2}_[a-z]+$/.test(r.key))) {
  const name = r.key.split('_').slice(1).join('');
  if (name.length >= 5) realRes.push([name, new RegExp('\\b' + [...name].join("[\\s'’-]?") + '\\b', 'i')]);
}

// 원작 게임 고유 용어 — 웹 사가고 PLAN §5 ⑳ 에서 이 판 이름으로 바꾼 것. 표시 글자에 나오면 오류.
const ORIGINAL = [
  /\b(Pyro|Hydro|Electro|Anemo|Cryo|Dendro)\b/, /Electro-Charged|Vaporize|Elemental Burst/i,
  /\b(Exquisite|Precious|Luxurious) Chest/i, /\bArtifacts?\b|\bLey Line/i,
  /원소 폭발|정교한 상자|진귀한 상자|화려한 상자|성유물|지맥 이상|운명의 자리/,
];

// 용어 — 판 안에서 한 낱말로 맞춘 것. 어기면 경고.
const TERMS = [
  { game: 'dungeon', re: /\bhordes?\b/i, want: '난입 = Onslaught' },
  { game: 'story', re: /\bjobs?\b/i, want: '전직·직업 = class' },
  { game: 'forest', re: /\bfog wraiths?\b/i, want: '안개유령 = Mist Ghost' },
  { game: '*', re: /%p\b/, want: '%p 는 한국식 — "+10%" 로' },
  { game: '*', re: /\b(colour|armour|honour|favour|centre|metre|defence|grey)\w*/i, want: '미국식 철자' },
  { game: '*', re: /\bmini-?boss\b/, want: 'Mini-Boss / Miniboss 한 가지로' },
];

for (const r of rows) {
  const { ko, en } = r;
  if (!en.trim()) { flag(r, 'E', '빈 영어'); continue; }
  if (HANGUL.test(en) && !/quiz\.(i\d+\.c\d|m\d+\.(q|why))$/.test(r.key)) flag(r, 'E', '영어에 한글');
  if (tokens(ko, PH) !== tokens(en, PH)) flag(r, 'E', `자리표 다름 ko[${tokens(ko, PH)}] en[${tokens(en, PH)}]`);
  if (tokens(ko, TAG) !== tokens(en, TAG)) flag(r, 'E', '서식 태그 다름');
  const [kl, kt] = edge(ko), [el, et] = edge(en);
  // 한국어 조사는 앞말에 붙고 영어는 띄운다("{이름}이 쓰러졌다" ↔ " has fallen") — 한국어 쪽이 비고 영어가 한 칸이면 둔다.
  const same = (a, b) => a === b || (a === '' && b === ' ');
  if (!same(kl, el) || !same(kt, et)) flag(r, 'E', '앞뒤 공백·줄바꿈 다름(이어 붙이는 글)');
  if (lead(ko) !== lead(en)) flag(r, 'W', `첫 기호 다름 ko「${lead(ko)}」 en「${lead(en)}」`);
  const nk = (ko.trim().match(/\n/g) || []).length, ne = (en.trim().match(/\n/g) || []).length;
  if (nk !== ne) flag(r, 'W', `줄 수 다름 ${nk + 1}→${ne + 1}`);
  if (/\S {2,}\S/.test(en) && !/\S {2,}\S/.test(ko)) flag(r, 'W', '두 칸 띄움');
  if (/\s[,.!?;:](\s|$)/.test(en)) flag(r, 'W', '문장부호 앞 띄움');
  for (const t of TERMS) if ((t.game === '*' || t.game === r.game) && t.re.test(en)) flag(r, 'W', '용어: ' + t.want);
  for (const re of ORIGINAL) { const m = (ko + '\n' + en).match(re); if (m) { flag(r, 'E', '원작 용어: ' + m[0]); break; } }
  for (const [n, re] of realRes) if (re.test(en)) { flag(r, 'E', '실명(영어): ' + n); break; }
  for (const n of REAL_KO) if (ko.includes(n) && !KEEP_KO.some(w => w.includes(n) && ko.includes(w))) { flag(r, 'E', '실명(한국어): ' + n); break; }
}

// 용어 흔들림 — 같은 짧은 한국어가 판·줄마다 다른 영어로.
const byKo = new Map();
for (const r of rows) {
  const k = r.ko.trim();
  if (k.length > 12 || PH.test(k) || /\n/.test(k)) continue;
  PH.lastIndex = 0;
  if (!byKo.has(k)) byKo.set(k, new Map());
  const m = byKo.get(k), e = r.en.trim();
  if (!m.has(e)) m.set(e, []);
  m.get(e).push(`${r.game}:${r.key}`);
}
// 뜻이 다른 동음이의어·자리가 달라 일부러 다른 말 — 검토 끝난 것만.
const DRIFT_OK = new Set(['장판', '세계사', '수(守)', '두목', '숙적']);
const drift = [...byKo].filter(([k, m]) => !DRIFT_OK.has(k) && m.size > 1 && new Set([...m.keys()].map(s => s.toLowerCase())).size > 1);

// 넘침 주의 — 대충 글자 폭(한글 1, 영문 소문자 0.5 …)으로 영어가 한국어보다 훨씬 긴 줄.
const width = s => [...s].reduce((w, c) => w + (HANGUL.test(c) || /[一-鿿\p{Extended_Pictographic}]/u.test(c) ? 1
  : /[A-Z]/.test(c) ? 0.62 : /[a-z0-9]/.test(c) ? 0.52 : c === ' ' ? 0.28 : 0.35), 0);
const longRows = rows.filter(r => rank(r) <= 2).map(r => ({ r, kw: width(r.ko), ew: width(r.en) }))
  .filter(x => x.ew > 8 && x.ew > x.kw * 1.6).sort((a, b) => (b.ew - b.kw * 1.6) - (a.ew - a.kw * 1.6));

// 순위 — 1 늘 보이는 UI · 2 놀면서 자주 보는 것 · 3 대사·사연·문답.
function rank(r) {
  if (r.game === 'common') return 1;
  const k = r.key;
  if (/^(settings|state|quality|scale|action|command|hud|goal|task|panel|ui|map\.(button|title|close)|cut\.skip|dex\.(button|close)|secret\.close|skill\.(tab|pin))\b/.test(k)) return 1;
  if (/(\.lore|\.line|\.quote|\.desc|\.body)$|^(folk|era_folk|quiz|event)\.|\.\d$/.test(k)) return 3;
  return 2;
}

// ── 검수표 ─────────────────────────────────────────────────────────────
const tsvPath = path.join(root, 'docs', 'en_review.tsv');
const cell = s => s.replace(/\t/g, ' ').replace(/\r?\n/g, '⏎');
const kept = new Map();
if (fs.existsSync(tsvPath)) {
  for (const line of fs.readFileSync(tsvPath, 'utf8').split('\n').slice(1)) {
    const c = line.split('\t');
    if (c.length >= 7 && c[6].trim()) kept.set(c[1] + '\t' + c[2], { en: c[4], mark: c[6].trim() });
  }
}
const idOf = r => r.game === 'common' ? r.key.replace(/:\d+$/, '') + '\t' + r.en : r.key;
let reviewed = 0, reset = 0;
const byRank = { 1: 0, 2: 0, 3: 0 }, doneRank = { 1: 0, 2: 0, 3: 0 };
const sorted = rows.map(r => ({ ...r, rank: rank(r) }))
  .sort((a, b) => a.rank - b.rank || GAMES.concat('common').indexOf(a.game) - GAMES.concat('common').indexOf(b.game) || (a.key < b.key ? -1 : 1));
const tsv = ['순위\t판\t키\t한국어\t영어\t깃발\t검수'];
for (const r of sorted) {
  const old = kept.get(r.game + '\t' + (r.game === 'common' ? idOf(r) : r.key));
  let mark = '';
  if (old) { if (old.en === cell(r.en)) mark = old.mark; else reset++; }
  if (mark) { reviewed++; doneRank[r.rank]++; }
  byRank[r.rank]++;
  const key = r.game === 'common' ? idOf(r).split('\t')[0] : r.key;
  tsv.push([r.rank, r.game, key, cell(r.ko), cell(r.en), (r.flags || []).join(' / '), mark].join('\t'));
}

// ── 요약 ───────────────────────────────────────────────────────────────
const md = [];
const esc = s => cell(s).replace(/\|/g, '\\|');
md.push('# 영어 검수 목록 — saga-unity (자동 생성, 손으로 고치지 않는다)', '',
  '`node tools/loc-review.mjs` 가 쓴다(PLAN.md 110 ⑥c). 사람이 채우는 곳은 `docs/en_review.tsv` 의 **검수** 칸뿐 — ' +
  '`OK` 또는 고칠 말을 적고 다시 돌리면 진척이 여기 반영된다. 고친 영어는 번역 표(`xxx_en.json`)·코드에 넣는다(키는 안 바꾼다).', '',
  `- 짝 **${rows.length}** (표 ${rows.filter(r => r.game !== 'common').length} · 코드 ${rows.filter(r => r.game === 'common').length}) — ` +
  GAMES.map(g => `${g} ${rows.filter(r => r.game === g).length}`).join(' · '),
  `- 자동 오류 **${errors.length}** · 경고 **${warns.length}** · 용어 흔들림 **${drift.length}** · 넘침 주의 **${longRows.length}**`,
  `- 사람 검수 **${reviewed}/${rows.length}** — 순위1 ${doneRank[1]}/${byRank[1]} · 순위2 ${doneRank[2]}/${byRank[2]} · 순위3 ${doneRank[3]}/${byRank[3]}` +
  (reset ? ` (영어가 바뀌어 검수를 비운 줄 ${reset})` : ''), '',
  '## 검수 순서', '',
  '1. **순위 1** — 늘 보이는 UI(타이틀·일시정지·설정·HUD·단추·목표판·일과). 스토어 스크린숏에 찍히는 글.',
  '2. **순위 2** — 놀면서 자주 보는 것(알림·전투·아이템·적·지역·기술 이름).',
  '3. **순위 3** — 대사·사연·인물 한마디·문답·사건 본문.',
  '',
  '볼 것: 뜻이 맞는지 · 어색한 직역 · 같은 것을 같은 말로 부르는지(아래 용어 흔들림) · 단추 글은 Title Case, 문장은 문장 끝 부호 · ' +
  '가명(인물·지명)은 로마자 그대로 · 원작 게임 고유 용어를 쓰지 않는지.', '');
const sect = (title, list, fmt) => { md.push(`## ${title} (${list.length})`, ''); if (!list.length) md.push('없음.'); else md.push(...list.map(fmt)); md.push(''); };
sect('자동 오류 — 0 이어야 한다', errors, ([g, k, m]) => `- \`${g}\` \`${k}\` — ${m}`);
sect('경고 — 의도면 두고, 아니면 고친다', warns, ([g, k, m]) => `- \`${g}\` \`${k}\` — ${m}`);
sect('용어 흔들림 — 같은 한국어, 다른 영어', drift, ([k, m]) => `- 「${esc(k)}」 → ` + [...m].map(([e, ks]) => `**${esc(e)}** (${ks.slice(0, 3).join(', ')}${ks.length > 3 ? ` 외 ${ks.length - 3}` : ''})`).join(' · '));
md.push(`## 넘침 주의 — 순위 1·2 에서 영어가 한국어보다 1.6배 넘게 넓은 줄 (위 30 / ${longRows.length})`, '',
  '배치 점검(`UiLayoutCheck`)은 첫 화면·패널·상태 38 만 잰다 — 그 밖에서 뜨는 긴 줄은 실기에서 한 번 본다.', '',
  '| 폭 한→영 | 판 | 키 | 영어 |', '|---|---|---|---|',
  ...longRows.slice(0, 30).map(x => `| ${x.kw.toFixed(0)}→${x.ew.toFixed(0)} | ${x.r.game} | \`${x.r.key}\` | ${esc(x.r.en)} |`), '');

if (!checkOnly) {
  fs.writeFileSync(tsvPath, tsv.join('\n') + '\n');
  fs.writeFileSync(path.join(root, 'docs', 'EN_REVIEW.md'), md.join('\n'));
}
console.log(`loc-review: 짝 ${rows.length} · 오류 ${errors.length} · 경고 ${warns.length} · 흔들림 ${drift.length} · 넘침 ${longRows.length} · 검수 ${reviewed}/${rows.length}`);
for (const [g, k, m] of errors.slice(0, 60)) console.log(`  E ${g} ${k} — ${m}`);
process.exit(errors.length ? 1 : 0);
