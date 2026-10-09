// 사가만리 2D 들판(W-0130) 확인 — PC·폰 세로·가로에서 시점을 2D 로 놓고 찍는다. shots/go2d/<태그>-<화면>.png
//   node pw-go2d-check.mjs [태그]   (서버는 스스로 빈 포트에 띄우고 끈다)
import net from 'node:net'; import path from 'node:path'; import fs from 'node:fs'; import { spawn } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'shots', 'go2d'); fs.mkdirSync(OUT, { recursive: true });
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const srv = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.resolve(HERE, '..', '..'), String(port)], { stdio: 'ignore' });
process.env.PW_BASE = `http://127.0.0.1:${port}/`;
const { open, sleep } = await import('./pw.mjs'); await sleep(800);
const tag = process.argv[2] || 'a';
for (const V of [{ k: 'pc', w: 1280, h: 720 }, { k: 'phone', w: 390, h: 844, mobile: true }, { k: 'land', w: 844, h: 390, mobile: true }]) {
  const r = await open('saga-go', V); const ev = (f, a) => r.page.evaluate(f, a);
  try {
    await r.page.goto(r.url('index.html')); await sleep(1500); await ev(() => DG.account.create('go2d'));
    await r.page.goto(r.url('index.html')); await sleep(3000);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) b.click(); }); await sleep(3000);
    for (let i = 0; i < 12; i++) { await r.page.keyboard.press('Escape'); await sleep(100); }
    await ev(() => { const h = document.getElementById('help-ok'); if (h && h.offsetParent) h.click(); });
    for (let i = 0; i < 3 && await ev(() => DG.core.save.settings.tilt !== 0); i++) { await ev(() => document.getElementById('btn-tilt').click()); await sleep(1500); }
    await sleep(3000);
    await r.page.screenshot({ path: path.join(OUT, `${tag}-${V.k}.png`) });
    const info = await ev(() => ({ tilt: DG.core.save.settings.tilt, f2: !!(DG.field2d && DG.field2d.on()), zoom: DG.core.save.settings.camZoom2d }));
    console.log(V.k, JSON.stringify(info), r.errors.filter((e) => !/404|ERR_CONN/.test(e)).slice(0, 3).join(' | '));
  } catch (e) { console.log(V.k, 'ERR', e.message.split('\n')[0]); }
  await r.close();
}
srv.kill(); process.exit(0);
