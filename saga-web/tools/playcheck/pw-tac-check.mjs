// 사가천하 전술판(W-0134) 확인 — PC·폰 세로·가로에서 화면이 쓰는 tacticsView.open 으로 판을 열고(내 장수 셋 · 적 장수 둘 + 부대) 판·고른 상태(엄폐 방패, W-0168)·공격 컷을 찍는다.
//   node pw-tac-check.mjs [태그]   → shots/tac/<태그>-<화면>-{board,sel,cut}.png (서버는 스스로 빈 포트에)
import net from 'node:net'; import path from 'node:path'; import fs from 'node:fs'; import { spawn } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'shots', 'tac'); fs.mkdirSync(OUT, { recursive: true });
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const srv = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.resolve(HERE, '..', '..'), String(port)], { stdio: 'ignore' });
process.env.PW_BASE = `http://127.0.0.1:${port}/`;
const { open, sleep } = await import('./pw.mjs'); await sleep(800);
const tag = process.argv[2] || 'a';
for (const V of [{ k: 'pc', w: 1280, h: 720 }, { k: 'phone', w: 390, h: 844, mobile: true }, { k: 'land', w: 844, h: 390, mobile: true }]) {
  const r = await open('saga-realm', V); const ev = (f, a) => r.page.evaluate(f, a);
  try {
    await r.page.goto(r.url('index.html')); await sleep(1500); await ev(() => DG.account.create('tac'));
    await r.page.goto(r.url('index.html')); await sleep(2500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) b.click(); }); await sleep(2500);
    await r.page.locator('[data-act="pick-scen"]').first().click(); await sleep(800);
    await r.page.locator('[data-act="pick-force"]').first().click(); await sleep(3000);
    const info = await ev(() => {
      const R = DG.rtk, me = R.me(), mine = DG.off.ofForce(me).map((o) => o.id || o).slice(0, 3);
      const fs0 = R.state().forces || {}, other = (Array.isArray(fs0) ? fs0.map((f) => f.id || f) : Object.keys(fs0)).find((f) => f !== me && DG.off.ofForce(f).length >= 2) || null;
      const foes = other ? DG.off.ofForce(other).map((o) => o.id || o).slice(0, 2) : [];
      const face = (id) => { const h = DG.off.find(id), P = DG.portrait3d; const u = h && P && P.of ? P.of('hero', h, 64, 64) : null; return typeof u === 'string' ? u : ''; };
      let host = document.getElementById('tacview'); if (!host) { host = document.createElement('div'); host.className = 'tacview'; host.id = 'tacview'; host.style.position = 'fixed'; host.style.zIndex = 60; document.body.appendChild(host); }   // 전투 카드 밖에서 열 때 자리
      DG.tacticsView.open(host, { seed: 7, land: 'forest', siege: true, mine, foes, foeTroops: [4000, 4000], where: R.citiesOf(me)[0], name: (id) => (DG.off.find(id) || {}).name || id, face }, () => {});
      return { mine: mine.length, foes: foes.length, art: !!document.querySelector('#tacview .tv-body, #tacview svg svg') };
    });
    await sleep(2500);
    await r.page.screenshot({ path: path.join(OUT, `${tag}-${V.k}-board.png`) });
    await ev(() => { const v = DG.tacticsView.cur(), T = DG.tactics, m = T.alive(v.b, 'me'); const u = m[1] || m[0]; DG.tacticsView.tap(u.x, u.y); }); await sleep(1500);   // W-0168 — 고른 상태(갈 칸·엄폐 방패)
    await r.page.screenshot({ path: path.join(OUT, `${tag}-${V.k}-sel.png`) });
    const cut = await ev(() => {
      const v = DG.tacticsView.cur(), T = DG.tactics, b = v.b, u = T.alive(b, 'me')[0], f = T.alive(b, 'foe')[0];
      if (!u || !f) { return 'no units'; }
      const nx = u.x + 1 < b.cols ? u.x + 1 : u.x - 1; f.x = nx; f.y = u.y; u.acted = false;
      DG.tacticsView.tap(u.x, u.y); DG.tacticsView.tap(f.x, f.y);
      return !!document.querySelector('#tacview .tv-cut');
    });
    await sleep(450);
    await r.page.screenshot({ path: path.join(OUT, `${tag}-${V.k}-cut.png`) });
    console.log(V.k, JSON.stringify(info), 'cut', cut, r.errors.filter((e) => !/404|ERR_CONN/.test(e)).slice(0, 3).join(' | '));
  } catch (e) { console.log(V.k, 'ERR', e.message.split('\n')[0]); }
  await r.close();
}
srv.kill(); process.exit(0);
