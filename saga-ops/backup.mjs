#!/usr/bin/env node
/**
 * saga-ops 백업(W-0334 ⑥) — 서버가 도는 중에도 안전하게: WAL 체크포인트 뒤 `VACUUM INTO` 로 한 파일 사본을 만든다(복사 도중 쓰기가 끼어도 깨지지 않는다).
 *   node saga-ops/backup.mjs [--db saga-ops/data/ops.db] [--dir saga-ops/data/backup] [--keep 7]
 *   → <dir>/ops-YYYY-MM-DD.db (같은 날 다시 돌리면 덮음) · keep 일보다 오래된 ops-*.db 는 지운다 · 마지막 줄 "OPS-BACKUP OK <파일> <바이트>"
 * 매일 한 번 — 윈도 작업 스케줄러: schtasks /Create /SC DAILY /ST 04:00 /TN saga-ops-backup /TR "node C:\경로\saga-ops\backup.mjs"
 *   리눅스 cron: 0 4 * * * node /경로/saga-ops/backup.mjs. data/ 는 .gitignore — 사본도 저장소에 안 들어간다(다른 디스크·클라우드로 옮기는 건 운영자 몫).
 * 되살리기: 서버를 멈추고 사본을 data/ops.db 로 바꿔 넣은 뒤 다시 띄운다(-wal·-shm 파일은 지운다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const DBP = arg('--db', process.env.OPS_DB || path.join(HERE, 'data', 'ops.db'));
const DIR = arg('--dir', path.join(path.dirname(DBP), 'backup'));
const KEEP = Math.max(1, +arg('--keep', 7) || 7);

if (!fs.existsSync(DBP)) { console.log('OPS-BACKUP FAIL DB 없음 ' + DBP); process.exit(1); }
fs.mkdirSync(DIR, { recursive: true });
const day = new Date().toISOString().slice(0, 10), out = path.join(DIR, 'ops-' + day + '.db');
if (fs.existsSync(out)) { fs.rmSync(out); }   // VACUUM INTO 는 있는 파일에 못 쓴다
const db = new DatabaseSync(DBP);
db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
db.prepare('VACUUM INTO ?').run(out);
db.close();
/* 사본 확인 — 열어서 표 수를 센다 */
const chk = new DatabaseSync(out, { readOnly: true });
const tables = chk.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table'").get().n, accounts = chk.prepare('SELECT COUNT(*) n FROM account').get().n;
chk.close();
/* 오래된 것 지우기 */
const cut = Date.parse(day) - (KEEP - 1) * 864e5, gone = [];
for (const f of fs.readdirSync(DIR)) { const m = /^ops-(\d{4}-\d{2}-\d{2})\.db$/.exec(f); if (m && Date.parse(m[1]) < cut) { fs.rmSync(path.join(DIR, f)); gone.push(f); } }
console.log('표 ' + tables + ' · 계정 ' + accounts + (gone.length ? ' · 지움 ' + gone.join(' ') : ''));
console.log('OPS-BACKUP OK ' + out + ' ' + fs.statSync(out).size);
