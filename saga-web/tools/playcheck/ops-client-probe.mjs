// 라이브옵스 수신 확인(W-0271, 일회성) — live.json 에 공지·최소 버전을 넣고 1만리에서 카드·띠가 뜨는지, 지운 뒤 안 뜨는지
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, sleep } from './pw.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIVE = path.join(HERE, '..', '..', 'shared', 'ops', 'live.json');
const orig = fs.readFileSync(LIVE, 'utf8');
const j = JSON.parse(orig);
j.notices = [{ id: 'probe-1', title: '시험 공지', body: '운영 콘솔에서 넣은 공지입니다.', games: ['saga-go'] }];
j.minVersion = { 'saga-go': 'go-v9.0.0' };
fs.writeFileSync(LIVE, JSON.stringify(j, null, 1));
let out = {};
const r = await open('saga-go');
try {
  await r.page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded' }); await sleep(1500);
  await r.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} DG.account.create('옵스'); });
  await r.page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded' }); await sleep(6500);
  out.first = await r.page.evaluate(() => ({ card: !!document.getElementById('ops-card'), cardText: (document.getElementById('ops-card') || {}).textContent || '', band: (document.getElementById('ops-band') || {}).textContent || '', live: !!(DG.ops && DG.ops.live()), game: DG.ops && DG.ops.GAME }));
  await r.page.screenshot({ path: path.join(HERE, 'shots', 'ops_client_probe.png') });
  await r.page.evaluate(() => { const b = document.querySelector('#ops-card button'); if (b) { b.click(); } DG.ops.track('probe', { a: 1 }); });
  await r.page.evaluate(() => DG.ops.refresh()); await sleep(800);
  out.second = await r.page.evaluate(() => ({ cardAgain: !!document.getElementById('ops-card'), seen: JSON.parse(localStorage.getItem(DG.ops._seenKey) || '[]'), dump: DG.ops.dump().track.length }));
} catch (e) { out.err = e.message; }
await r.close();
fs.writeFileSync(LIVE, orig);
console.log(JSON.stringify(out));
console.log('예외', r.errors.filter((e) => !/404/.test(e)).slice(0, 3).join(' | ') || '없음');
const ok = out.first && out.first.card && /시험 공지/.test(out.first.cardText) && /새 버전/.test(out.first.band) && out.second && !out.second.cardAgain && out.second.seen.includes('probe-1') && out.second.dump === 1;
console.log(ok ? 'OPS-CLIENT OK' : 'OPS-CLIENT FAIL');
