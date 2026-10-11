// node saga-web/tools/playcheck/go-capture-shot.mjs → shots/go-capture.png (W-0174)
// 1만리 포획·사건 싸움(rogueAction) HUD — 단추마다 키 글자(Space·E·J·R·Esc)가 붙었나 · Space 를 누르면 회피(몸 빼기)가 나가나
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { launch, sleep } from './cdp.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8914, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', 'saga-go')], { stdio: 'ignore' });
await sleep(800);
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); srv.kill(); process.exit(1); }, 180000);
try {
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  const B = `http://127.0.0.1:${PORT}/`;
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('테스트'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  await c.ev(`DG.core.setTune('world3d.dayNight', 0); DG.core.save.settings.autoBattle = false;`);
  await c.ev(`(function(){ window.__done = null; DG.rogueAction.open({ title: '포획', foeName: '시험 짐승', foeHp: 1e6, myAtk: 10, myDef: 1e6, raid: false, timeSec: 600, onDone: function (p) { window.__done = p; } }); })()`);
  await sleep(1500);
  const p0 = JSON.parse(await c.ev(`JSON.stringify(DG.core.save.player.pos)`));
  const s1 = await c.send('Page.captureScreenshot', { format: 'png' });
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await sleep(500);
  const st = JSON.parse(await c.ev(`JSON.stringify({ d: DG.rogueAction.lastDodge(), p: DG.core.save.player.pos, keys: [].map.call(document.querySelectorAll('#rogue-hud .ra-pad .btn'), function (b) { return b.textContent; }) })`));
  const moved = Math.hypot(st.p.x - p0.x, st.p.y - p0.y);
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(400);
  const fled = await c.ev(`JSON.stringify({ active: DG.rogueAction.active, done: !!window.__done })`);
  fs.writeFileSync(path.join(HERE, 'shots', 'go-capture.png'), Buffer.from(s1.result.data, 'base64'));
  console.log('capture 단추 ' + st.keys.join(' | ') + ' · Space 회피 ' + (st.d ? (st.d.dash ? '몸 뺌' : '판정만') : '없음') + ' ' + moved.toFixed(1) + 'm · Esc ' + fled);
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard); await c.close(); srv.kill();
