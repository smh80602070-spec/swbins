// W-0442 발소리 확인 — 판에 들어가 방향키로 3초 걷고: 디딤 수·마지막 소리 id·shared/audio/sfx 요청(받은 상태)을 찍는다.
//   node probe-steps.mjs [판=saga-go]   서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다)
import { open, sleep } from './pw.mjs';
const game = process.argv[2] || 'saga-go';
const r = await open(game, { w: 1280, h: 720 });
const { page } = r, reqs = [];
page.on('response', (res) => { const u = res.url(); if (/audio\/sfx\/sfx_(step|hoof|wing)/.test(u)) { reqs.push(u.split('/').pop() + ' ' + res.status()); } });
try {
  await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(1500);
  await page.evaluate(() => { DG.account.create('발소리'); });
  await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(3000);
  await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Escape'); await sleep(200); }
  await page.mouse.click(640, 360); await sleep(300);   // 소리 잠금 풀기(사용자 몸짓)
  await page.evaluate(() => DG.stepsSfx && DG.stepsSfx._reset());
  await page.keyboard.down('ArrowRight'); await sleep(3000); await page.keyboard.up('ArrowRight'); await sleep(500);
  const st = await page.evaluate(() => ({ n: DG.stepsSfx ? DG.stepsSfx.count() : -1, last: DG.stepsSfx ? DG.stepsSfx.last() : null }));
  console.log(game, JSON.stringify(st), 'sfx 받음', reqs.length, reqs.slice(0, 3).join(' | '), 'errors', r.errors.length);
} finally { await r.close(); }
