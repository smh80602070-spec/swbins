// 사가종횡 2D 사냥터(W-0132) 확인 — PC·폰 세로·가로, 첫 사냥터를 2D(3D 끔)로 두 장(처음·조금 걸은 뒤). shots/side/<태그>-<화면>-<n>.png
//   node pw-side-check.mjs [태그]   (서버는 스스로 빈 포트에 띄우고 끈다)
import net from 'node:net'; import path from 'node:path'; import fs from 'node:fs'; import { spawn } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'shots', 'side'); fs.mkdirSync(OUT, { recursive: true });
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const srv = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.resolve(HERE, '..', '..'), String(port)], { stdio: 'ignore' });
process.env.PW_BASE = `http://127.0.0.1:${port}/`;
const { open, sleep } = await import('./pw.mjs'); await sleep(800);
const tag = process.argv[2] || 'a';
const skip = async (ev, page) => { for (let i = 0; i < 14; i++) { const o = await ev(() => !!((DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen()) || (DG.story && DG.story.isOpen && DG.story.isOpen()))); if (!o) break; await page.keyboard.press('Escape'); await sleep(200); } };
for (const V of [{ k: 'pc', w: 1280, h: 720 }, { k: 'phone', w: 390, h: 844, mobile: true }, { k: 'land', w: 844, h: 390, mobile: true }]) {
  const r = await open('saga-story', V); const ev = (f, a) => r.page.evaluate(f, a);
  try {
    await r.page.goto(r.url('index.html')); await sleep(1500); await ev(() => DG.account.create('side'));
    await r.page.goto(r.url('index.html')); await sleep(2500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) b.click(); }); await sleep(2500); await skip(ev, r.page);
    await ev(() => { const h = document.getElementById('help-ok'); if (h && h.offsetParent) h.click(); });
    await ev(() => { if (!DG.side.enter('field')) { DG.side.enter('field', DG.sideData.stage('field')); } }); await sleep(1500);
    if (await ev(() => DG.sideView3d && DG.sideView3d.ready && DG.sideView3d.ready())) { await ev(() => document.getElementById('btn-3d').click()); await sleep(1500); }
    await ev(() => { const R = DG.side.raw(); R.hp = R.hpMax = 99999; });
    for (let i = 0; i < 6; i++) { await ev(() => { document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) b.click(); }); }); await sleep(300); }
    await sleep(2000);
    await r.page.screenshot({ path: path.join(OUT, `${tag}-${V.k}-1.png`) });
    await ev(() => { const R = DG.side.raw(); R.player.x = 760; }); await sleep(1500);
    await r.page.screenshot({ path: path.join(OUT, `${tag}-${V.k}-2.png`) });
    console.log(V.k, JSON.stringify(await ev(() => ({ use3d: !!(DG.sideView3d && DG.sideView3d.ready()), z: document.getElementById('stage').style.transform, cam: DG.sideView._cam ? Math.round(DG.sideView._cam()) : null }))), r.errors.filter((e) => !/404|ERR_CONN/.test(e)).slice(0, 3).join(' | '));
  } catch (e) { console.log(V.k, 'ERR', e.message.split('\n')[0]); }
  await r.close();
}
srv.kill(); process.exit(0);
