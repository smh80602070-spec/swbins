// 폰·PC 실제 탭 확인(W-0117 다시 보기 · W-0127 재현) — PC·폰 세로·폰 가로에서 실제 단추를 눌러 도감(탈것)·몬스터 도감을 찍는다. 결과 shots/dexcheck/<판>-<화면>-<n>.png
//   node pw-dex-check.mjs [saga-go|saga-dungeon …]   (서버는 스스로 빈 포트에 띄우고 끈다)
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PC = HERE;
const OUT = path.join(PC, 'shots', 'dexcheck');
fs.mkdirSync(OUT, { recursive: true });
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const srv = spawn(process.execPath, [path.join(PC, 'serve.mjs'), path.resolve(PC, '..', '..'), String(port)], { stdio: 'ignore' });
process.env.PW_BASE = `http://127.0.0.1:${port}/`;
const { open, sleep } = await import('./pw.mjs');
for (let i = 0; i < 50; i++) { const up = await new Promise((res) => { const s = net.connect(port, '127.0.0.1', () => { s.end(); res(true); }); s.on('error', () => res(false)); }); if (up) break; await sleep(200); }

const VIEWS = [{ k: 'pc', w: 1280, h: 720 }, { k: 'phone', w: 390, h: 844, mobile: true }, { k: 'land', w: 844, h: 390, mobile: true }];
const games = process.argv.slice(2).length ? process.argv.slice(2) : ['saga-go', 'saga-dungeon'];
const log = [];

async function press(page, sel, mobile) {
  const el = page.locator(sel).first();
  const box = await el.boundingBox().catch(() => null);
  if (!box) { return 'NOBOX ' + sel; }
  const vis = await el.isVisible();
  if (mobile) { await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); } else { await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); }
  return `${sel} @${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)} vis=${vis}`;
}

for (const game of games) {
  for (const V of VIEWS) {
    let r = null; const tag = `${game}-${V.k}`; const shot = async (n) => r.page.screenshot({ path: path.join(OUT, `${tag}-${n}.png`) });
    try {
      r = await open(game, V);
      const { page } = r; const ev = (fn, a) => page.evaluate(fn, a);
      await page.goto(r.url('index.html')); await sleep(1500);
      await ev(() => { DG.account.create('확인'); });
      await page.goto(r.url('index.html')); await sleep(3000);
      await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } });
      await sleep(3000);
      for (let i = 0; i < 14; i++) { await page.keyboard.press('Escape'); await sleep(120); }
      await ev(() => { const h = document.getElementById('help-ok'); if (h && h.offsetParent) { h.click(); } });
      if (game === 'saga-go') {
        await ev(() => { DG.core.save.player.level = 22; DG.core.emit('changed'); });
        await sleep(800); await shot('0-field');
        log.push(tag + ' 도감 단추: ' + await press(page, '[data-sheet="dex"]', V.mobile)); await sleep(1500);
        await shot('1-dex-top');
        const m = await ev(() => {
          const body = document.getElementById('sheet-body'); const h = [...body.querySelectorAll('h4')].find((x) => /탈것/.test(x.textContent));
          return { scrollH: body.scrollHeight, clientH: body.clientHeight, mountTop: h ? h.offsetTop : -1, h4: [...body.querySelectorAll('h4')].map((x) => x.textContent.trim().slice(0, 14)), cells: body.querySelectorAll('.dcell').length };
        });
        log.push(tag + ' 시트: ' + JSON.stringify(m));
        await ev(() => { const body = document.getElementById('sheet-body'); const h = [...body.querySelectorAll('h4')].find((x) => /탈것/.test(x.textContent)); if (h) { h.scrollIntoView({ block: 'start' }); } });
        await sleep(1200); await shot('2-mount');
        log.push(tag + ' 탈것 칸 누름: ' + await press(page, '#sheet-body .sec:has(h4:text("탈것")) .dcell', V.mobile)); await sleep(400);
        await shot('3-mount-tap');
      } else {
        await ev(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } });
        await sleep(4000);
        for (let i = 0; i < 6; i++) { await ev(() => { document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) { b.click(); } }); }); await sleep(400); }
        await ev(() => {
          const ED = DG.enemyData, B = DG.bestiary;
          ED.bosses.slice(0, 3).forEach((b, i) => B.record(b, 5 + i * 7));
          ED.enemies.filter((e) => e.tier <= 2).slice(0, 18).forEach((e, i) => { for (let k = 0; k <= i % 5; k++) B.record(e, i % 3 ? i + 1 : 0); });
          ED.eraEnemies.slice(0, 2).forEach((e) => B.record(e, 0));
          B.record({ id: 'rb_jungwon', name: '벌판 흑기 대장', emoji: '🏴', kind: 'human' }, 0);
        });
        await shot('0-town');
        if (await ev(() => document.getElementById('sheet').classList.contains('show'))) { log.push(tag + ' 저절로 열린 시트 닫기: ' + await ev(() => document.getElementById('sheet-title').textContent) + ' / ' + await press(page, '#sheet-close', V.mobile)); await sleep(800); }
        log.push(tag + ' 더보기: ' + await press(page, '#dock-more-btn', V.mobile)); await sleep(1000);
        await shot('1-more');
        log.push(tag + ' 몬스터: ' + await press(page, '[data-sheet="beast"]', V.mobile)); await sleep(1500);
        await shot('2-beast-top');
        const m = await ev(() => { const body = document.getElementById('sheet-body'); return { open: document.getElementById('sheet').classList.contains('show'), title: document.getElementById('sheet-title').textContent, scrollH: body.scrollHeight, clientH: body.clientHeight, cells: body.querySelectorAll('.dcell').length }; });
        log.push(tag + ' 시트: ' + JSON.stringify(m));
        await ev(() => { const body = document.getElementById('sheet-body'); const h = [...body.querySelectorAll('h4')].find((x) => /1단계/.test(x.textContent)); if (h) { h.scrollIntoView({ block: 'start' }); } });
        await sleep(1000); await shot('3-beast-tier1');
        await ev(() => { const b = document.getElementById('sheet-body').getBoundingClientRect(); const c = [...document.querySelectorAll('#sheet-body .bst-cell:not(.locked)')].find((x) => { const r = x.getBoundingClientRect(); return r.top > b.top + 4 && r.bottom < b.bottom - 4; }); document.querySelectorAll('.bst-pick').forEach((x) => x.classList.remove('bst-pick')); if (c) { c.classList.add('bst-pick'); } }); log.push(tag + ' 칸 누름: ' + await press(page, '.bst-pick', V.mobile)); await sleep(400);
        await shot('4-cell-tap');
        await ev(() => { const body = document.getElementById('sheet-body'); body.scrollTop = body.scrollHeight; }); await sleep(800); await shot('5-beast-end');
      }
      log.push(tag + ' 오류: ' + JSON.stringify(r.errors.filter((e) => !/404|ERR_CONNECTION/.test(e)).slice(0, 4)));
    } catch (e) { log.push(tag + ' ERR ' + e.message.split('\n')[0]); }
    if (r) { await r.close().catch(() => {}); }
  }
}
srv.kill();
console.log(log.join('\n'));
process.exit(0);
