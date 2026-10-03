#!/usr/bin/env node
/**
 * 공용 파일 정본(saga-web/shared/)을 다섯 판에 복사하고, md5 가 같은지 본다.
 *
 *   node tools/sync-shared.mjs           shared → 다섯 판 복사(다른 것만 덮어쓴다)
 *   node tools/sync-shared.mjs --check   복사 없이 비교만. 다르면 줄을 찍고 종료 1 (precheck 가 부른다)
 *
 * 정본을 고쳤으면: 이 명령으로 퍼뜨리고, 다섯 판 `sw.js` VERSION 을 올린다(saga-web/RULES.md).
 * 판별 사본을 직접 고치면 다음 복사에서 덮인다 — 고치는 곳은 shared/ 하나다.
 * 표에 없는 파일(data.js·core.js·ui.js·sprite.js·perf.js …)은 여기 안 넣는다.
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
  ['js/mode2d.js', 'js/mode2d.js', ['saga-story', 'saga-dungeon', 'saga-go', 'saga-forest']],   // W-0019 — 2D 시트 부품(사가스토리부터, 다른 판은 배선하며 판 목록에 추가)
  ['js/ssao3d.js', 'js/ssao3d.js', ['saga-go', 'saga-dungeon', 'saga-story']],
  ['js/post3d.js', 'js/post3d.js', ['saga-go', 'saga-dungeon', 'saga-story']],
  ['js/toon3d-core.js', 'js/toon3d-core.js'],
  ['js/toon3d.js', 'js/toon3d.js', ['saga-go', 'saga-dungeon']],   // 3째 칸 = 이 판들에만(없으면 다섯 판 전부)
];
const check = process.argv.includes('--check');

/** 판 폴더 단독 서버(run.bat)는 `../shared` 를 못 읽는다 — 2D 모드 배경·타일(K-0020)은 그 판 접두어 파일만 판 폴더로 복사한다(W-0019).
 *  정본 shared/assets/web2d/{bg,tile}/ · 접두어 = 판 이름(go_·dungeon_·forest_·story_·realm_) · 출처 .license.json 은 정본에만 둔다 */
const PREFIX = { 'saga-go': 'go_', 'saga-dungeon': 'dungeon_', 'saga-forest': 'forest_', 'saga-story': 'story_', 'saga-realm': 'realm_' };
const ASSET_DIRS = ['assets/web2d/bg', 'assets/web2d/tile'];
const ASSET_GAMES = ['saga-story'];   // 배선이 끝난 판만(안 쓰는 판에 용량을 안 싣는다) — 판을 배선할 때마다 추가
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
for (const g of ASSET_GAMES) {
  for (const d of ASSET_DIRS) {
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
if (check) console.log(bad ? `FAIL shared 정본과 다른 사본 ${bad}개 — node tools/sync-shared.mjs` : `OK ${total}개 사본`);
else console.log(`복사 ${copied}개 · 이미 같은 것 ${total - copied}개`);
process.exit(bad ? 1 : 0);
