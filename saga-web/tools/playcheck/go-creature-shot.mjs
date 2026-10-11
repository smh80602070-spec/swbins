// node saga-web/tools/playcheck/go-creature-shot.mjs → shots/go_creature.png (W-0178)
// 1만리 3D 들판 짐승(사슴·늑대·소·까치 …)이 실제 판에서 자체판 creatures3d 몸으로 서나 — 가장 가까운 무리 곁으로 옮겨 찍는다
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8919, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', 'saga-go')], { stdio: 'ignore' });
await sleep(800);
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); srv.kill(); process.exit(1); }, 180000);
try {
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  const B = `http://127.0.0.1:${PORT}/`;
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('짐승'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(4000);
  await c.ev(`(function(){ window.__urls = []; var A = DG.assets3d, f = A.creatureFor; A.creatureFor = function (u) { var r = f(u); if (r) { window.__urls.push(r.split('/').pop()); } return r; };
    DG.core.setTune('world3d.dayNight', 0); DG.animal.forceTime(new Date(2026, 7, 26, 12, 30).getTime()); DG.animal.reset(); })()`);
  let near = null;
  for (let k = 0; k < 10 && !near; k++) {
    near = JSON.parse(await c.ev(`(function(){ var p = DG.core.save.player.pos, L = DG.animal.live(p), best = null, bd = 1e9; if (!L.length) { L = DG.animal.all(); }
      L.forEach(function (a) { var d = Math.hypot(a.x - p.x, a.y - p.y); if (d < bd) { bd = d; best = a; } });
      return JSON.stringify(best && { x: best.x, y: best.y, kind: best.kind || (best.ref && best.ref.id) || '' }); })()`));
    if (!near) { await c.ev(`DG.core.save.player.pos.x += 400`); await sleep(1500); }
  }
  console.log('무리', JSON.stringify(near));
  if (near) { await c.ev(`(function(){ var p = DG.core.save.player.pos; p.x = ${near.x} - 14; p.y = ${near.y} + 10; })()`); }
  await sleep(6000);
  await c.shot('go_creature');
  console.log('자체판으로 받은 몸', await c.ev(`JSON.stringify(Array.from(new Set(window.__urls)))`));
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard); await c.close(); srv.kill();
