// 아이템 아이콘 현황표(K-0035 단계 1) — 판마다 아이템 데이터를 읽어 종류 수와 현재 그림(이모지·글리프·이미지) 유무를 센다. 읽기만 한다.
//   node tools/ai-art/icon_inventory.mjs            → tools/ai-art/data/icon_inventory.json + 요약
// 웹 다섯 판은 각 판 data*.js 를 vm 에 올려 표를 그대로 읽는다(추측 없음). Godot·Unity 는 소스에서 표 항목 수만 정규식으로 센다 —
// "방식":"regex" 로 표시하고 정확한 목록이 아니라 개수(대략)다.
import vm from 'vm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'tools', 'ai-art', 'data', 'icon_inventory.json');
const ICON_FIELDS = ['emoji', 'icon', 'glyph', 'img', 'image', 'sprite', 'emoji_'];

// [판, 읽을 파일들, 표 식, 이름, 갈래]
const WEB = [
  ['dungeon', 'data-item.js', 'DG.itemData.BASES', '장비 기본 종류', 'equip'],
  ['dungeon', 'data-unique.js', 'DG.uniqueData.UNIQUES', '유니크 장비', 'equip'],
  ['dungeon', 'data-set.js', 'DG.setData.SETS', '세트(조각은 기본 종류 재사용)', 'set'],
  ['dungeon', 'data-gem.js', 'DG.gemData.GEMS', '보석', 'gem'],
  ['dungeon', 'data-gem.js', 'DG.gemData.RUNES', '룬', 'gem'],
  ['story', 'data-gear.js', 'DG.gearData.GEAR', '장비', 'equip'],
  ['story', 'data-gear.js', 'DG.gearData.SCROLLS', '주문서', 'consumable'],
  ['story', 'data-unique.js', 'DG.uniqueData.UNIQUES', '유니크 장비', 'equip'],
  ['realm', 'data-item.js', 'DG.item.ITEMS', '보물', 'equip'],
  ['go', 'bag.js', 'DG.bag.ITEMS', '가방 물건', 'consumable'],
  ['go', 'cooking.js', 'DG.cooking.ITEMS', '요리 재료', 'material'],
  ['go', 'cooking.js', 'DG.cooking.SPECIALTIES', '특산물', 'material'],
  ['go', 'bag.js,artifact.js', 'DG.artifact.SET_IDS', '성유물 세트(조각 = 세트 × 부위 5)', 'artifact'],
  ['forest', 'data-village.js', 'DG.villageData.ITEMS', '물건', 'material'],
  ['forest', 'data-village.js', 'DG.villageData.FURNITURE', '가구', 'furniture'],
  ['forest', 'data-village.js', 'DG.villageData.TOOLS', '도구', 'tool'],
  ['forest', 'data-village.js', 'DG.villageData.WALLS', '벽지', 'furniture'],
  ['forest', 'data-village.js', 'DG.villageData.FLOORS', '바닥', 'furniture'],
  ['forest', 'data-village.js', 'DG.villageData.WEAR_PARTS', '옷(겉옷·머리·망토·염색 등 부위별 목록을 풀어 셈)', 'wear'],
];
// Godot·Unity: [트랙, 파일, 이름, 개수를 세는 정규식(줄 단위), 갈래]
const SRC = [
  ['godot', 'saga-godot/games/saga_go/data/weapons.gd', '무기(WEAPONS 블록 키)', 'weapons-gd', 'equip'],
  ['unity', 'saga-unity/Assets/Games/SagaGo/Data/GoWeapons.cs', '무기(All 배열 항목)', 'weapons-cs', 'equip'],
];

function load(game, files) {
  const sb = { console: { log() {}, warn() {}, error() {} }, Math, Date, JSON, Object, Array, Number, String, Map, Set, setTimeout() {}, clearTimeout() {}, setInterval() {},
    localStorage: { getItem() { return null; }, setItem() {} }, navigator: {},
    document: { addEventListener() {}, getElementById() { return null; }, createElement() { return { getContext() { return null; }, style: {} }; }, body: {} } };
  sb.window = sb; sb.global = sb; sb.globalThis = sb; sb.self = sb;
  sb.DG = { core: { save: {}, on() {}, emit() {} } };
  vm.createContext(sb);
  const errs = [];
  for (const f of files.split(',')) {
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'saga-web', 'saga-' + game, 'js', f), 'utf8'), sb, { filename: f }); } catch (e) { errs.push(f + ': ' + String(e).slice(0, 80)); }
  }
  return [sb, errs];
}

function flat(list) {
  // 부위별 묶음(`list: [...]`) · 갈래별 묶음(값이 배열인 객체) 은 한 겹 풀어 낱개로 센다
  if (list.length && list.every((x) => Array.isArray(x.list))) return list.flatMap((x) => x.list.map((y) => ({ ...y, _group: x.key })));
  if (list.length && list.every((x) => Object.values(x).every((y) => typeof y === 'object'))) return list.flatMap((x) => Object.values(x));
  return list;
}

function entries(v) {
  if (v && !Array.isArray(v) && typeof v === 'object' && Object.values(v).length && Object.values(v).every(Array.isArray)) return Object.values(v).flat().map((x) => (typeof x === 'object' ? x : { _v: x }));
  if (Array.isArray(v)) return v.map((x, i) => (typeof x === 'object' && x ? x : { _v: x, _k: String(i) }));
  if (v && typeof v === 'object') return Object.entries(v).map(([k, x]) => (typeof x === 'object' && x ? { _k: k, ...x } : { _k: k, _v: x }));
  return [];
}

const rows = [];
const cache = {};
for (const [game, files, expr, name, kind] of WEB) {
  const key = game + '|' + files;
  if (!cache[key]) cache[key] = load(game, files);
  const [sb, errs] = cache[key];
  let list = [];
  let note = errs.join('; ');
  try { list = flat(entries(vm.runInContext(expr, sb))); } catch (e) { note += ' 읽기 실패: ' + String(e).slice(0, 60); }
  const iconField = ICON_FIELDS.find((f) => list.some((x) => x[f])) || null;
  const withIcon = iconField ? list.filter((x) => x[iconField]).length : 0;
  const ids = list.map((x) => x.key || x.id || x._k || x.name).filter(Boolean);
  rows.push({ track: 'web', game: 'saga-' + game, name, kind, expr, count: list.length, icon_field: iconField, with_icon: withIcon,
    icon_kind: iconField ? 'emoji/글리프(그림 파일 아님)' : '없음', ids, note: note || undefined });
}
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
for (const [track, file, name, how, kind] of SRC) {
  let count = 0, note;
  try {
    const t = read(file);
    if (how === 'weapons-gd') {
      const m = t.match(/const WEAPONS := \{([\s\S]*?)\n\}/);
      count = m ? (m[1].match(/^\s*"[a-z0-9_]+"\s*:/gm) || []).length : 0;
    } else if (how === 'weapons-cs') {
      const m = t.match(/Weapon\[\] All =([\s\S]*?)\n\s*\};/);
      count = m ? (m[1].match(/W\("/g) || []).length : 0;
    }
  } catch (e) { note = String(e).slice(0, 60); }
  rows.push({ track, game: track === 'godot' ? 'saga_go' : 'SagaGo', name, kind, 방식: 'regex(개수만, 대략)', count, icon_field: null, with_icon: 0, icon_kind: '확인 안 함', note });
}
const bykind = {};
for (const r of rows) bykind[r.kind] = (bykind[r.kind] || 0) + r.count;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ note: 'tools/ai-art/icon_inventory.mjs 가 만든 표 — 손으로 고치지 않는다', by_kind: bykind, total: rows.reduce((a, r) => a + r.count, 0), rows }, null, 1) + '\n');
for (const r of rows) console.log(`${r.track.padEnd(6)} ${r.game.padEnd(13)} ${String(r.count).padStart(4)}  ${r.name}  [${r.kind}]  ${r.icon_kind}${r.note ? '  ! ' + r.note : ''}`);
console.log('갈래별 합계', JSON.stringify(bykind));
