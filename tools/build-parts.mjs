#!/usr/bin/env node
/**
 * 큰 js 를 소스 조각으로 나눠 두고 이어 붙여 실행 파일을 만든다 (SAGA-ARCH §4.2-4).
 *
 *   node tools/build-parts.mjs           조각(`dir/*.js`, 이름순)을 바이트 그대로 이어 `out` 에 쓴다
 *   node tools/build-parts.mjs --check   쓰지 않고 이어 붙인 것과 `out` 이 같은지만 본다. 다르면 종료 1 (precheck 가 부른다)
 *
 * 왜 이어 붙이나: `world3d.js` 는 `(function(global){…})(window)` 하나의 클로저라 절끼리 쓰는 심볼이 많다
 * (232개 중 137개). 조각을 따로 <script> 로 실으면 공유 상태를 전부 객체로 바꿔야 해서, 소스만 나누고
 * 실행 파일은 한 덩이로 둔다. 조각은 단독으로는 문법이 안 맞는 토막이다 — 고치는 곳은 조각이고,
 * 실행 파일(out)은 생성물이다(직접 고치지 않는다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = [
  { out: 'saga-web/saga-go/js/world3d.js', dir: 'saga-web/saga-go/src/world3d' },
];
const check = process.argv.includes('--check');

let bad = 0;
for (const t of TARGETS) {
  const dir = path.join(ROOT, t.dir), out = path.join(ROOT, t.out);
  const parts = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
  if (!parts.length) { console.log(`FAIL ${t.dir} 에 조각이 없다`); bad++; continue; }
  const built = Buffer.concat(parts.map(f => fs.readFileSync(path.join(dir, f))));
  const cur = fs.existsSync(out) ? fs.readFileSync(out) : null;
  const same = cur && cur.equals(built);
  if (check) {
    if (same) console.log(`ok   ${t.out} = 조각 ${parts.length}개`);
    else { console.log(`DIFF ${t.out} ≠ ${t.dir}/*.js — 조각을 고쳤으면 node tools/build-parts.mjs, ${path.basename(t.out)} 를 직접 고쳤으면 그 내용을 조각에 옮길 것`); bad++; }
  } else if (same) console.log(`이미 같음 ${t.out}`);
  else { fs.writeFileSync(out, built); console.log(`조립 ${t.out} ← 조각 ${parts.length}개 (${built.length}B)`); }
}
process.exit(bad ? 1 : 0);
