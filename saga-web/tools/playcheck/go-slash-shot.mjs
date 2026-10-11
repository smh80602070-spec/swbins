// W-0173 1만리 검기 띠 확인 — 무기·단 다섯(검 1·2·3타·큰날 3타·창 3타)을 휘두른 0.07초 뒤를 한 장에(shots/slash.png)
// node saga-web/tools/playcheck/go-slash-shot.mjs  (서버·크롬은 여기서 띄우고 PID 로만 끈다)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { launch, sleep } from './cdp.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8906, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', 'saga-go')], { stdio: 'ignore' });
await sleep(800);
const c = await launch(960, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); srv.kill(); process.exit(1); }, 200000);
try {
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  const B = `http://127.0.0.1:${PORT}/`;
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('테스트'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(6000);
  await c.ev(`DG.core.setTune('world3d.dayNight', 0); DG.core.save.settings.zoom3d = 0.18; document.querySelectorAll('#near,.near-list').forEach(function(n){n.style.display='none'}); window.__pa = DG.world3d.playAnim; DG.world3d.playAnim = function () { return false; }; DG.core.save.settings.autoBattle = false;`);
  await c.ev(`DG.world3d.yaw(0.9)`);
  await sleep(2500);
  const shots = [];
  for (const [w, st] of [['sword', 0], ['sword', 1], ['sword', 2], ['claymore', 2], ['polearm', 2]]) {
    await c.ev(`(function(){ var p = DG.core.save.player.pos, a = DG.world3d.meAng(); window.__pa('me', 'Wpn_${w}_${st}', 600000); DG.slash3d.swing('${w}', ${st}, p.x, p.y, a); })()`);
    await sleep(70);
    const s = await c.send('Page.captureScreenshot', { format: 'png', clip: { x: 280, y: 220, width: 400, height: 380, scale: 1 } });
    shots.push({ label: w + ' ' + (st + 1) + '타', data: s.result.data });
    await sleep(600);
  }
  const sheet = await c.ev(`(async function(){ var T = ${JSON.stringify(shots)}, tw = 400, th = 380; var cv = document.createElement('canvas'); cv.width = T.length * tw; cv.height = th + 16; var g = cv.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, cv.width, cv.height);
    for (var i = 0; i < T.length; i++) { var im = new Image(); im.src = 'data:image/png;base64,' + T[i].data; await im.decode(); g.drawImage(im, i * tw, 16, tw, th); g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(T[i].label, i * tw + 4, 12); }
    return cv.toDataURL('image/png').split(',')[1]; })()`);
  fs.writeFileSync(path.join(HERE, 'shots', 'slash.png'), Buffer.from(sheet, 'base64'));
  console.log('ok');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard); await c.close(); srv.kill();
