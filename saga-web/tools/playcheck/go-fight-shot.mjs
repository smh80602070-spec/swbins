// node saga-web/tools/playcheck/go-fight-shot.mjs → shots/go-fight.png (PC_PORT·PC_PROF=chrome-prof-* 로 다른 크롬과 안 겹치게)
// 1만리 실제 들판 싸움 — 자동 전투로 무리와 싸우는 동안 0.3초 간격 12컷(검기 띠·대상 쪽 돌기·무기 몸짓이 실전에서 보이나)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { launch, sleep } from './cdp.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8913, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', 'saga-go')], { stdio: 'ignore' });
await sleep(800);
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); srv.kill(); process.exit(1); }, 300000);
try {
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  const B = `http://127.0.0.1:${PORT}/`;
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('테스트'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  await c.ev(`DG.core.setTune('world3d.dayNight', 0); DG.perf && DG.perf.pin && DG.perf.pin('HIGH'); DG.core.save.settings.zoom3d = 0.5;`);
  let camp = null;
  for (let k = 0; k < 8 && !camp; k++) {
    camp = JSON.parse(await c.ev(`(function(){ var S = DG.fieldCombat.state(), p = DG.core.save.player.pos, best = null, bd = 1e9; if (!S) return 'null';
      for (var key in S.camps) { var cp = S.camps[key]; if (cp.kind === 'guard' || cp.sky) continue; var d = Math.hypot(cp.x - p.x, cp.y - p.y); if (d < bd) { bd = d; best = cp; } }
      return JSON.stringify(best && { x: best.x, y: best.y, n: best.uids.length }); })()`));
    if (!camp) { await c.ev(`DG.core.save.player.pos.x += 300`); await sleep(1500); }
  }
  if (!camp) { throw new Error('무리 없음'); }
  await c.ev(`(function(){ var p = DG.core.save.player.pos; p.x = ${camp.x} - 7; p.y = ${camp.y}; })()`);
  await sleep(3000);
  await c.ev(`(function(){ DG.core.save.settings.autoBattle = true; window.__sw = 0; var S3 = DG.slash3d, sw = S3.swing; S3.swing = function () { window.__sw++; return sw.apply(S3, arguments); }; })()`);
  const tiles = [];
  for (let i = 0; i < 40 && tiles.length < 12; i++) {
    await sleep(300);
    const st = JSON.parse(await c.ev(`JSON.stringify({ sw: window.__sw, live: DG.slash3d.live(), anim: (function(){ var n = DG.world3d.actorNode('me'); return n && n.userData && n.userData.mixerNode ? n.userData.mixerNode.userData.anim : (n && n.userData ? n.userData.anim : ''); })() })`));
    if (i > 2) {
      const s = await c.send('Page.captureScreenshot', { format: 'png', clip: { x: 340, y: 160, width: 600, height: 460, scale: 0.5 } });
      tiles.push({ label: 'sw' + st.sw + ' 띠' + st.live + ' ' + (st.anim || ''), data: s.result.data });
    }
  }
  const sheet = await c.ev(`(async function(){ var T = ${JSON.stringify(tiles)}, tw = 300, th = 230, cols = 4; var cv = document.createElement('canvas'); cv.width = cols * tw; cv.height = Math.ceil(T.length / cols) * (th + 14); var g = cv.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, cv.width, cv.height);
    for (var i = 0; i < T.length; i++) { var im = new Image(); im.src = 'data:image/png;base64,' + T[i].data; await im.decode(); var x = (i % cols) * tw, y = Math.floor(i / cols) * (th + 14); g.drawImage(im, x, y + 14, tw, th); g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText(T[i].label, x + 3, y + 11); }
    return cv.toDataURL('image/png').split(',')[1]; })()`);
  fs.writeFileSync(path.join(HERE, 'shots', 'go-fight.png'), Buffer.from(sheet, 'base64'));
  console.log('fight', tiles.map((t) => t.label).join(' | '));
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard); await c.close(); srv.kill();
