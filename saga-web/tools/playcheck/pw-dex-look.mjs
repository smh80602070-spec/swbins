// 탈것·몬스터 도감 한 장씩(W-0117) — 사가만리 도감 시트의 🐎 탈것 칸 · 사가나락 👹 몬스터 도감 시트를 2D 판으로 찍는다.
//   node pw-dex-look.mjs [saga-go|saga-dungeon ...]   → shots/qc/<판>-dex.png
// 서버는 스스로 빈 포트에 띄우고 끝에 끈다(다른 세션 :8871 과 안 겹친다). 크롬은 pw.mjs 의 전용 새 프로필.
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const games = process.argv.slice(2).length ? process.argv.slice(2) : ['saga-go', 'saga-dungeon'];
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const srv = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.resolve(HERE, '..', '..'), String(port)], { stdio: 'ignore' });
process.env.PW_BASE = process.env.PW_BASE || `http://127.0.0.1:${port}/`;
const { open, sleep } = await import('./pw.mjs');
fs.mkdirSync(path.join(HERE, 'shots', 'qc'), { recursive: true });
for (let i = 0; i < 50; i++) {   // 서버가 실제로 듣기 시작할 때까지(최대 10초)
  const up = await new Promise((res) => { const s = net.connect(port, '127.0.0.1', () => { s.end(); res(true); }); s.on('error', () => res(false)); });
  if (up) { break; }
  await sleep(200);
}

for (const game of games) {
  const dest = path.join(HERE, 'shots', 'qc', `${game}-dex.png`);
  let r = null;
  try {
    r = await open(game, { w: 1280, h: 720 });
    const { page } = r;
    const ev = (fn, arg) => page.evaluate(fn, arg);
    await page.goto(r.url('index.html')); await sleep(1500);
    await ev(() => { DG.account.create('도감'); });
    await page.goto(r.url('index.html')); await sleep(2500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } });
    await sleep(2500);
    for (let i = 0; i < 14; i++) { await page.keyboard.press('Escape'); await sleep(150); }
    await ev(() => { const h = document.getElementById('help-ok'); if (h && h.offsetParent) { h.click(); } });
    let info;
    if (game === 'saga-go') {
      for (let i = 0; i < 3 && await ev(() => DG.core.save.settings.tilt !== 0); i++) { await ev(() => document.getElementById('btn-tilt').click()); await sleep(1500); }   // 2D 판
      info = await ev(() => {
        DG.core.save.player.level = 22;                       // 농마·갈색 말·학 열림, 흰 말(30)·푸른 용(40)은 잠김
        DG.ui.openSheet('dex');
        const h = [...document.querySelectorAll('#sheet-body h4')].find((x) => /탈것/.test(x.textContent));
        if (h) { h.scrollIntoView({ block: 'start' }); }
        return { sec: !!h, cells: h ? h.parentNode.querySelectorAll('.dcell').length : 0, imgs: h ? h.parentNode.querySelectorAll('.dcell img, .dcell canvas, .dcell .pt').length : 0 };
      });
    } else {
      await ev(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } });   // 출사표
      await sleep(3000);
      if (await ev(() => DG.dungeon3d && DG.dungeon3d.wanted())) { await ev(() => document.getElementById('btn-3d').click()); await sleep(2500); }   // 2D 판
      for (let i = 0; i < 4; i++) { await ev(() => { document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent)) { b.click(); } }); const c = document.getElementById('sheet-close'); if (c && c.offsetParent) { c.click(); } }); await sleep(400); }
      info = await ev(() => {
        const ED = DG.enemyData, K = (ref, f, n, boss) => { for (let i = 0; i < n; i++) { DG.core.emit('dungeon:kill', { e: { ref, boss }, floor: f }); } };
        ED.bosses.slice(0, 4).forEach((b, i) => K(b, 5 + i * 7, 1, true));
        ED.enemies.filter((e) => e.tier <= 2).slice(0, 16).forEach((e, i) => K(e, i % 3 ? i + 1 : 0, 1 + (i % 4) * 3));
        ED.eraEnemies.slice(0, 2).forEach((e) => K(e, 0, 2));
        document.querySelector('[data-sheet="beast"]').click();
        const body = document.getElementById('sheet-body');
        return { title: (document.getElementById('sheet-title') || {}).textContent, cells: body.querySelectorAll('.dcell').length,
          open: body.querySelectorAll('.dcell:not(.locked)').length, imgs: body.querySelectorAll('.dcell img.d2-fport').length, tally: DG.bestiary.tally() };
      });
    }
    await sleep(2000);
    if (game === 'saga-dungeon') {   // 처치 사건이 이야기 장면을 부를 수 있다 — 넘기고 시트를 다시 연다
      for (let i = 0; i < 8; i++) { await ev(() => { document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) { b.click(); } }); }); await sleep(500); }
      await ev(() => { if (!document.getElementById('sheet').classList.contains('show')) { document.querySelector('[data-sheet="beast"]').click(); } });
      await sleep(1500);
    }
    await page.screenshot({ path: dest });
    console.log(game, '저장', dest, JSON.stringify(info), r.errors.length ? 'errors ' + JSON.stringify(r.errors.slice(0, 3)) : '예외 없음', r.notFound.length ? '404 ' + r.notFound.slice(0, 4).join(' ') : '');
  } catch (e) { console.log(game, 'ERR', e.message); }
  if (r) { await r.close().catch(() => {}); }
}
srv.kill();
process.exit(0);
