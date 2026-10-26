// node saga-web/tools/playcheck/go-2d-crowd.mjs → shots/go-2d-crowd-{before,after}.png + 콘솔 수
// 1만리 2D 들판 몹 밀도(사용자 10-26 「1번 2d몹이 너무 몰려있어」) — 같은 자리 몇 군데에서 화면 반경 안 몹 수·무리 수를
// 옛 값(field.campChance2d 1 · field.pack2d 99) 과 새 기본(0.6 · 2) 으로 잰다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8914, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', 'saga-go')], { stdio: 'ignore' });
await sleep(800);
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); srv.kill(); process.exit(1); }, 300000);
const OUT = path.join(HERE, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const SPOTS = [[600, 200], [1400, -500], [-900, 900], [2200, 1300]];
try {
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  const B = `http://127.0.0.1:${PORT}/index.html?mode=2d`;
  await c.go(B, 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('밀도'); } })()`);
  const res = {};
  for (const [tag, cc, pk] of [['before', 1, 99], ['after', 0.6, 2]]) {
    await c.go(B, 8000);
    await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
    await sleep(5000);
    await c.ev(`DG.core.setTune('field.campChance2d', ${cc}); DG.core.setTune('field.pack2d', ${pk}); DG.core.setTune('world3d.dayNight', 0);`);
    const rows = [];
    for (const [x, y] of SPOTS) {
      await c.ev(`(function(){ var S = DG.fieldCombat.state(); if (S) { S.camps = {}; S.foes = {}; S.cleared = {}; } var p = DG.core.save.player.pos; p.x = ${x}; p.y = ${y}; })()`);
      await sleep(2500);
      rows.push(JSON.parse(await c.ev(`(function(){ var S = DG.fieldCombat.state(), p = DG.core.save.player.pos, kd = DG.fieldCombat._kd ? DG.fieldCombat._kd() : 0, n = 0, camps = {}, R = 600;
        for (var k in S.foes) { var f = S.foes[k]; if (f.dead || f.sky) continue; if (Math.hypot(f.x - p.x, f.y - p.y) <= R) { n++; camps[f.camp] = 1; } }
        return JSON.stringify({ foes: n, camps: Object.keys(camps).length }); })()`)));
    }
    const s = await c.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, 'go-2d-crowd-' + tag + '.png'), Buffer.from(s.result.data, 'base64'));
    res[tag] = rows;
    console.log(tag, JSON.stringify(rows), '합 몹', rows.reduce((a, r) => a + r.foes, 0), '무리', rows.reduce((a, r) => a + r.camps, 0));
  }
  await c.ev(`DG.core.setTune('field.campChance2d', 0.6); DG.core.setTune('field.pack2d', 2);`);
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard); c.close(); srv.kill();
