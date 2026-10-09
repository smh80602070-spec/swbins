// 사가마을 2D 마을(W-0133 스타듀식) 확인 — PC·폰 세로·가로, 2D(3D 끔)로 새벽·낮·저녁·밤 네 장(셋째 인자로 고름). shots/cozy/<태그>-<화면>-<때>.png
//   node pw-cozy-check.mjs [태그]   (서버는 스스로 빈 포트에 띄우고 끈다)
import net from 'node:net'; import path from 'node:path'; import fs from 'node:fs'; import { spawn } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'shots', 'cozy'); fs.mkdirSync(OUT, { recursive: true });
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const srv = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.resolve(HERE, '..', '..'), String(port)], { stdio: 'ignore' });
process.env.PW_BASE = `http://127.0.0.1:${port}/`;
const { open, sleep } = await import('./pw.mjs'); await sleep(800);
const tag = process.argv[2] || 'a';
const skip = async (ev, page) => { for (let i = 0; i < 14; i++) { const o = await ev(() => !!((DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen()) || (DG.story && DG.story.isOpen && DG.story.isOpen()))); if (!o) break; await page.keyboard.press('Escape'); await sleep(200); } };
for (const V of [{ k: 'pc', w: 1280, h: 720 }, { k: 'phone', w: 390, h: 844, mobile: true }, { k: 'land', w: 844, h: 390, mobile: true }]) {
  const r = await open('saga-forest', V); const ev = (f, a) => r.page.evaluate(f, a);
  try {
    await r.page.goto(r.url('index.html')); await sleep(1500); await ev(() => DG.account.create('cozy'));
    await r.page.goto(r.url('index.html')); await sleep(2500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) b.click(); }); await sleep(2500); await skip(ev, r.page);
    await ev(() => { const h = document.getElementById('help-ok'); if (h && h.offsetParent) h.click(); const c = document.getElementById('sheet-close'); if (c && c.offsetParent) c.click(); });
    if (await ev(() => DG.villageView3d && DG.villageView3d.active && DG.villageView3d.active())) { await ev(() => document.getElementById('btn-3d').click()); await sleep(1500); }
    for (const ph of (process.argv[3] || 'dawn,day,even,night').split(',')) {
      await ev((p) => { DG.core.setTune('time.phase', p); DG.core.emit('changed'); }, ph); await sleep(1500);
      await r.page.screenshot({ path: path.join(OUT, `${tag}-${V.k}-${ph}.png`) });
    }
    await ev(() => { DG.core.setTune('time.phase', null); });
    console.log(V.k, JSON.stringify(await ev(() => ({ is3d: !!(DG.villageView3d && DG.villageView3d.active && DG.villageView3d.active()), cozy: DG.cozy2d ? DG.cozy2d.zoomMul() : null }))), r.errors.filter((e) => !/404|ERR_CONN/.test(e)).slice(0, 3).join(' | '));
  } catch (e) { console.log(V.k, 'ERR', e.message.split('\n')[0]); }
  await r.close();
}
srv.kill(); process.exit(0);
