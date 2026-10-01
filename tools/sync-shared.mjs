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
/** 정본 경로(shared/ 기준) → 판 폴더 안 경로 */
const FILES = [
  ['js/net.js', 'js/net.js'],
  ['js/anim-own.js', 'js/anim-own.js'],
  ['js/vroid-variant.js', 'js/vroid-variant.js'],
  ['js/account.js', 'js/account.js'],
  ['build/build-single.mjs', 'build/build-single.mjs'],
];
const check = process.argv.includes('--check');
const md5 = p => (fs.existsSync(p) ? crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex') : null);

let bad = 0, copied = 0;
for (const [src, dst] of FILES) {
  const from = path.join(WEB, 'shared', src), want = md5(from);
  if (!want) { console.log('FAIL 정본 없음 shared/' + src); bad++; continue; }
  for (const g of GAMES) {
    const to = path.join(WEB, g, dst);
    if (md5(to) === want) continue;
    if (check) { console.log(`DIFF ${g}/${dst} ≠ shared/${src}`); bad++; continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied++;
    console.log(`복사 shared/${src} → ${g}/${dst}`);
  }
}
if (check) console.log(bad ? `FAIL shared 정본과 다른 사본 ${bad}개 — node tools/sync-shared.mjs` : `OK ${FILES.length}×${GAMES.length}`);
else console.log(`복사 ${copied}개 · 이미 같은 것 ${FILES.length * GAMES.length - copied}개`);
process.exit(bad ? 1 : 0);
