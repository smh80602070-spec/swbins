#!/usr/bin/env node
/**
 * 공용 파일 정본(saga-web/shared/)을 다섯 판에 복사하고, md5 가 같은지 본다.
 *
 *   node tools/sync-shared.mjs           shared → 다섯 판 복사(다른 것만 덮어쓴다)
 *   node tools/sync-shared.mjs --check   복사 없이 비교만. 다르면 줄을 찍고 종료 1 (precheck 가 부른다)
 *
 * 정본을 고쳤으면: 이 명령으로 퍼뜨리고, 다섯 판 `sw.js` VERSION 을 올린다(saga-web/RULES.md).
 * 판별 사본을 직접 고치면 다음 복사에서 덮인다 — 고치는 곳은 shared/ 하나다.
 * 표에 없는 파일(data.js·core.js·ui.js·sprite.js·사가고 perf.js …)은 여기 안 넣는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'saga-web');
const GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
/** 정본 경로(shared/ 기준) → 판 폴더 안 경로 [→ 복사할 판들, 없으면 다섯 — 일부 판에만 줄 때 3째 칸] */
const FILES = [
  ['js/net.js', 'js/net.js'],
  ['js/anim-own.js', 'js/anim-own.js'],
  ['js/vroid-variant.js', 'js/vroid-variant.js'],
  ['js/account.js', 'js/account.js'],
  ['build/build-single.mjs', 'build/build-single.mjs'],
  ['js/errlog.js', 'js/errlog.js'],
  ['js/bgm.js', 'js/bgm.js'],
  ['js/assets3d-ids.js', 'js/assets3d-ids.js'],   // W-0021 — 통일 3D 에셋 조회(판을 배선하며 판 목록에 추가). ids 는 tools/gen-assets3d-ids.mjs 생성물
  ['js/assets3d.js', 'js/assets3d.js'],
  ['js/ai.js', 'js/ai.js', ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story']],   // R-4 — 네 판이 글자까지 같다(사가국지는 따로 갈라짐)
  ['js/mode2d.js', 'js/mode2d.js', ['saga-story', 'saga-dungeon', 'saga-go', 'saga-forest', 'saga-realm']],   // W-0019 — 2D 시트 부품(사가스토리부터, 다른 판은 배선하며 판 목록에 추가)
  ['js/perf-hud.js', 'js/perf.js', ['saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm']],   // 재기 표시(?perf) — 네 벌이 글자까지 같다(사가고 perf.js 는 품질 자동조절이 든 다른 파일)
  ['js/ssao3d.js', 'js/ssao3d.js', ['saga-go', 'saga-dungeon', 'saga-story']],
  ['js/post3d.js', 'js/post3d.js', ['saga-go', 'saga-dungeon', 'saga-story']],
  ['js/toon3d-core.js', 'js/toon3d-core.js'],
  ['js/itemicon-ids.js', 'js/itemicon-ids.js'],   // W-0025 — 아이템 아이콘 이름 표(생성물: tools/gen-itemicon-ids.mjs)
  ['js/itemicon.js', 'js/itemicon.js'],
  ['js/toon3d.js', 'js/toon3d.js', ['saga-go', 'saga-dungeon']],   // 3째 칸 = 이 판들에만(없으면 다섯 판 전부)
];
const check = process.argv.includes('--check');

/** 판 폴더 단독 서버(run.bat)는 `../shared` 를 못 읽는다 — 2D 모드 배경·타일(K-0020)은 그 판 접두어 파일만 판 폴더로 복사한다(W-0019).
 *  정본 shared/assets/web2d/{bg,tile}/ · 접두어 = 판 이름(go_·dungeon_·forest_·story_·realm_) · 출처 .license.json 은 정본에만 둔다 */
const PREFIX = { 'saga-go': 'go_', 'saga-dungeon': 'dungeon_', 'saga-forest': 'forest_', 'saga-story': 'story_', 'saga-realm': 'realm_' };
const ASSET_GAMES = { 'saga-story': ['assets/web2d/bg', 'assets/web2d/tile'], 'saga-go': ['assets/web2d/tile'], 'saga-dungeon': ['assets/web2d/tile'], 'saga-forest': ['assets/web2d/tile'], 'saga-realm': ['assets/web2d/tile'] };   // 판 → 그 판이 쓰는 폴더만(사가고는 위에서 본 지도라 층 배경 없음)   // 배선이 끝난 판만(안 쓰는 판에 용량을 안 싣는다) — 판을 배선할 때마다 추가
/** 아이템 아이콘(W-0025) — 이름 표 `itemicon-ids.js` 에 오른 그림 중 **그 판 것만** `<판>/assets/icons/icon64/` 로 복사한다(판 폴더 단독 서버가 `../shared` 를 못 읽는다).
 *  정본 shared/assets/icons/icon64/ · 출처(license/)는 정본에만 둔다. 표는 gen-itemicon-ids.mjs 가 만든다 */
function iconNames(g) {
  const f = path.join(WEB, 'shared', 'js', 'itemicon-ids.js');
  if (!fs.existsSync(f)) return [];
  const m = /itemiconIds = ({.*});/.exec(fs.readFileSync(f, 'utf8'));
  return m ? [...new Set(Object.values((JSON.parse(m[1])[g]) || {}))].sort() : [];
}
/** 줄바꿈(CRLF/LF)은 git autocrlf 가 판마다 따로 바꾸므로 정규화해서 비교한다 */
const md5 = p => (fs.existsSync(p) ? crypto.createHash('md5').update(fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')).digest('hex') : null);

let bad = 0, copied = 0;
let total = 0;
for (const [src, dst, only] of FILES) {
  const from = path.join(WEB, 'shared', src), want = md5(from);
  if (!want) { console.log('FAIL 정본 없음 shared/' + src); bad++; continue; }
  for (const g of (only || GAMES)) {
    total++;
    const to = path.join(WEB, g, dst);
    if (md5(to) === want) continue;
    if (check) { console.log(`DIFF ${g}/${dst} ≠ shared/${src}`); bad++; continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied++;
    console.log(`복사 shared/${src} → ${g}/${dst}`);
  }
}
/** 다른 판 접두어의 타일을 이 판이 빌려 쓴다(RTS 격자는 위에서 본 풀·흙이 필요한데 사가국지 `realm_*` 풀·흙은 옆보기 줄무늬) — 판 → 타일 이름(webp) */
const EXTRA_TILES = { 'saga-realm': ['forest_grass', 'forest_dirt', 'go_water'] };
/** 판이 쓰는 K-0061 폴더 통째(출처 .license.json 은 정본에만) — 판 → 폴더(shared/ 아래) */
const EXTRA_DIRS = { 'saga-realm': ['assets/web2d/rts'] };
for (const g of Object.keys(EXTRA_DIRS)) {
  for (const d of EXTRA_DIRS[g]) {
    const dir = path.join(WEB, 'shared', d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.license.json')) continue;
      total++;
      const from = path.join(dir, f), to = path.join(WEB, g, d, f);
      if (fs.existsSync(to) && fs.readFileSync(to).equals(fs.readFileSync(from))) continue;
      if (check) { console.log(`DIFF ${g}/${d}/${f} ≠ shared/${d}/${f}`); bad++; continue; }
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      copied++;
    }
  }
}
for (const g of Object.keys(EXTRA_TILES)) {
  for (const n of EXTRA_TILES[g]) {
    const from = path.join(WEB, 'shared', 'assets/web2d/tile', n + '.webp'), to = path.join(WEB, g, 'assets/web2d/tile', n + '.webp');
    total++;
    if (!fs.existsSync(from)) { console.log(`FAIL 빌린 타일 정본 없음 shared/assets/web2d/tile/${n}.webp`); bad++; continue; }
    if (fs.existsSync(to) && fs.readFileSync(to).equals(fs.readFileSync(from))) continue;
    if (check) { console.log(`DIFF ${g}/assets/web2d/tile/${n}.webp ≠ shared`); bad++; continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied++;
  }
}
for (const g of Object.keys(ASSET_GAMES)) {
  for (const d of ASSET_GAMES[g]) {
    const dir = path.join(WEB, 'shared', d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.startsWith(PREFIX[g]) || f.endsWith('.license.json')) continue;
      total++;
      const from = path.join(dir, f), to = path.join(WEB, g, d, f);
      if (fs.existsSync(to) && fs.readFileSync(to).equals(fs.readFileSync(from))) continue;
      if (check) { console.log(`DIFF ${g}/${d}/${f} ≠ shared/${d}/${f}`); bad++; continue; }
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      copied++;
    }
  }
}
for (const g of GAMES) {
  for (const n of iconNames(g)) {
    const from = path.join(WEB, 'shared', 'assets', 'icons', 'icon64', n + '.png'), to = path.join(WEB, g, 'assets', 'icons', 'icon64', n + '.png');
    total++;
    if (!fs.existsSync(from)) { console.log(`FAIL 아이콘 정본 없음 shared/assets/icons/icon64/${n}.png`); bad++; continue; }
    if (fs.existsSync(to) && fs.readFileSync(to).equals(fs.readFileSync(from))) continue;
    if (check) { console.log(`DIFF ${g}/assets/icons/icon64/${n}.png ≠ shared`); bad++; continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied++;
  }
}
/** 움직이는 그림(K-0056 한 장 모드, W-0032) — 판이 쓰는 풀의 front·side·back.webp 만 `<판>/assets/web2d/moving/<풀>/` 로 복사한다. 판 → 풀 목록은 그 판 `cfg.mode2d.still` 과 맞춘다 */
const MOVING_GAMES = { 'saga-forest': ['villager_a', 'villager_b', 'villager_c', 'hero_m', 'hero_f'], 'saga-go': ['villager_a', 'villager_b', 'villager_c', 'hero_m', 'hero_f'], 'saga-story': ['hero_m', 'hero_f'], 'saga-realm': ['companion_warrior', 'companion_archer', 'hero_m', 'hero_f'],
  'saga-dungeon': ['hero_m', 'hero_f', 'companion_warrior', 'companion_archer', 'companion_mage', 'villager_a', 'villager_b', 'villager_c'] };
for (const g of Object.keys(MOVING_GAMES)) {
  for (const pool of MOVING_GAMES[g]) {
    for (const v of ['front', 'side', 'back']) {
      const from = path.join(WEB, 'shared', 'assets', 'web2d', 'moving', pool, v + '.webp'), to = path.join(WEB, g, 'assets', 'web2d', 'moving', pool, v + '.webp');
      total++;
      if (!fs.existsSync(from)) { console.log(`FAIL 움직이는 그림 정본 없음 shared/assets/web2d/moving/${pool}/${v}.webp`); bad++; continue; }
      if (fs.existsSync(to) && fs.readFileSync(to).equals(fs.readFileSync(from))) continue;
      if (check) { console.log(`DIFF ${g}/assets/web2d/moving/${pool}/${v}.webp ≠ shared`); bad++; continue; }
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      copied++;
    }
  }
}
/** 건물 실내 그림(K-0025, W-0045) — 판이 쓰는 방 그림과 앞가림 층(_front)만 `<판>/assets/web2d/interior/` 로 복사한다. 판 → 방 id */
const INTERIOR_GAMES = { 'saga-dungeon': ['inn_hall', 'barn_hayloft', 'jp_minka_irori'] };
for (const g of Object.keys(INTERIOR_GAMES)) {
  for (const id of INTERIOR_GAMES[g]) {
    for (const suf of ['', '_front']) {
      const from = path.join(WEB, 'shared', 'assets', 'web2d', 'interior', id + suf + '.webp'), to = path.join(WEB, g, 'assets', 'web2d', 'interior', id + suf + '.webp');
      total++;
      if (!fs.existsSync(from)) { console.log(`FAIL 실내 그림 정본 없음 shared/assets/web2d/interior/${id}${suf}.webp`); bad++; continue; }
      if (fs.existsSync(to) && fs.readFileSync(to).equals(fs.readFileSync(from))) continue;
      if (check) { console.log(`DIFF ${g}/assets/web2d/interior/${id}${suf}.webp ≠ shared`); bad++; continue; }
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      copied++;
    }
  }
}
/** 지역 아이콘(K-0042, W-0046) — 판이 쓰는 접두어의 64px 아이콘만 `<판>/assets/map/icons/` 로 복사한다. 판 → 파일 접두어 */
const MAP_ICON_GAMES = { 'saga-story': 'story_' };
for (const g of Object.keys(MAP_ICON_GAMES)) {
  const dir = path.join(WEB, 'shared', 'assets', 'map', 'icons');
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith(MAP_ICON_GAMES[g]) || !f.endsWith('.png')) continue;
    total++;
    const from = path.join(dir, f), to = path.join(WEB, g, 'assets', 'map', 'icons', f);
    if (fs.existsSync(to) && fs.readFileSync(to).equals(fs.readFileSync(from))) continue;
    if (check) { console.log(`DIFF ${g}/assets/map/icons/${f} ≠ shared`); bad++; continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied++;
  }
}
if (check) console.log(bad ? `FAIL shared 정본과 다른 사본 ${bad}개 — node tools/sync-shared.mjs` : `OK ${total}개 사본`);
else console.log(`복사 ${copied}개 · 이미 같은 것 ${total - copied}개`);
process.exit(bad ? 1 : 0);
