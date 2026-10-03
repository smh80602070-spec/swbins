#!/usr/bin/env node
/**
 * `saga-web/shared/assets/icons/map.json`(K-0035 정본의 사본, 배치는 K-0019) + `icon64/` 파일 →
 * `saga-web/shared/js/itemicon-ids.js` (W-0025)
 *
 *   node tools/gen-itemicon-ids.mjs           쓴다
 *   node tools/gen-itemicon-ids.mjs --check   쓰지 않고 지금 파일과 같은지만(다르면 종료 1 — precheck 가 부른다)
 *
 * 웹 다섯 판이 "이 물건에 그림이 있나" 를 파일을 두드리지 않고 알게 하는 표다.
 * 표 꼴 { '<판>': { '<종류>:<id>': '<그림 이름 = 키_g등급>' } } — 웹 다섯 판 항목만, skip(상태 값)·파일 없는 항목은 뺀다.
 * 에셋은 자체툴(K-0019)이 놓으므로 새 아이콘이 들어오면 이 명령을 다시 돌린다. 생성물 — 손으로 고치지 않는다.
 * 판별 그림 파일 복사는 sync-shared.mjs 가 이 표를 읽어 한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHARED = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'saga-web', 'shared');
const WEB_GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const map = JSON.parse(fs.readFileSync(path.join(SHARED, 'assets', 'icons', 'map.json'), 'utf8')).entries;
const have = new Set(fs.readdirSync(path.join(SHARED, 'assets', 'icons', 'icon64')).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)));

const ids = {}; let n = 0, missing = [];
for (const g of WEB_GAMES) ids[g] = {};
for (const [k, v] of Object.entries(map).sort((a, b) => a[0] < b[0] ? -1 : 1)) {
  const i = k.indexOf(':'), g = k.slice(0, i);
  if (!ids[g] || v.mode === 'skip' || !v.key) continue;
  const name = v.key + '_g' + v.grade;
  if (!have.has(name)) { missing.push(k + ' → ' + name); continue; }
  ids[g][k.slice(i + 1)] = name; n++;
}

const body = `/* 생성: tools/gen-itemicon-ids.mjs — 손으로 고치지 않는다. 아이템 아이콘 이름 표(W-0025) */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.itemiconIds = ${JSON.stringify(ids)};
})(typeof window !== 'undefined' ? window : this);
`;
const out = path.join(SHARED, 'js', 'itemicon-ids.js');
const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : '';
if (missing.length) console.log('파일 없음 ' + missing.length + '개: ' + missing.slice(0, 5).join(' · '));
if (process.argv.includes('--check')) {
  if (cur === body) { console.log('OK itemicon-ids.js = map.json + icon64'); process.exit(0); }
  console.log('DIFF itemicon-ids.js ≠ shared/assets/icons — node tools/gen-itemicon-ids.mjs'); process.exit(1);
}
fs.writeFileSync(out, body);
console.log('쓴 것', out, '· 항목', n, '· ' + WEB_GAMES.map(g => g.replace('saga-', '') + ' ' + Object.keys(ids[g]).length).join(' · '));
