// W-0169 무기 몸짓 판정 시트 — 1만리 주인공을 옆에서 보고 각 몸짓의 감기·맞음·끝 세 순간을 한 장에 모은다
// node saga-web/tools/playcheck/go-wpn-sheet.mjs <빈 포트> <out.png> [yaw=1.5708] [zoom=0.18]  (env ONLY=sword,bow · CX/CY/CW/CH 자르기 · FULL=1 전체 화면도)
// 촬영 중엔 다른 몸짓(맞음·걷기)이 끼지 않게 playAnim 을 막는다. 서버·크롬은 여기서 띄우고 PID 로만 끈다
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { launch, sleep } from './cdp.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = +process.argv[2] || 8893, OUTF = process.argv[3], YAW = process.argv[4] !== undefined ? +process.argv[4] : 1.5708;
const srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', 'saga-go')], { stdio: 'ignore' });
const B = `http://127.0.0.1:${PORT}/`;
await sleep(800);
const c = await launch(960, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); srv.kill(); process.exit(1); }, 420000);
try {
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('테스트'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(6000);
  await c.ev(`DG.core.setTune('world3d.dayNight', 0); DG.perf && DG.perf.pin && DG.perf.pin('HIGH'); DG.core.save.settings.zoom3d = ${process.argv[5] || 0.18}; document.querySelectorAll('#near,.near-list').forEach(function(n){n.style.display='none'});`);
  let ok = false;
  for (let k = 0; k < 40 && !ok; k++) { ok = await c.ev(`(function(){ var n = DG.world3d.actorNode('me'); return !!(n && n.userData && n.userData.ownAnim); })()`); if (!ok) await sleep(1000); }
  if (!ok) throw new Error('me 몸이 자체 몸짓이 아님');
  await c.ev(`DG.world3d.yaw(${YAW}); window.__pa = DG.world3d.playAnim; DG.world3d.playAnim = function () { return false; }; DG.core.save.settings.autoBattle = false;`);
  await sleep(1500);
  if (process.env.FULL) { const f = await c.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(OUTF.replace('.png', '-full.png'), Buffer.from(f.result.data, 'base64')); }
  const W = process.env.ONLY ? process.env.ONLY.split(',') : ['sword', 'claymore', 'polearm', 'catalyst', 'bow'], U = [0.22, 0.42, 0.62];
  const tiles = [];
  for (const w of W) for (let s = 0; s < 3; s++) {
    const slot = `Wpn_${w}_${s}`;
    await c.ev(`window.__pa('me', '${slot}', 600000)`);
    await sleep(400);
    for (const u of U) {
      const r = await c.ev(`(function(){ var n = DG.world3d.actorNode('me'), ud = n.userData, a = ud.actions['${slot}']; if (!a) return 'no action';
        ud.mixer.stopAllAction(); a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true; a.time = a.getClip().duration * ${u}; ud.mixer.update(0); return 'ok'; })()`);
      if (r !== 'ok') { console.log(slot, r); }
      await sleep(120);
      const shot = await c.send('Page.captureScreenshot', { format: 'png', clip: { x: +(process.env.CX || 365), y: +(process.env.CY || 290), width: +(process.env.CW || 220), height: +(process.env.CH || 260), scale: 1 } });
      tiles.push({ label: `${w} ${s + 1}타 u${u}`, data: shot.result.data });
    }
    await c.ev(`(function(){ var a = DG.world3d.actorNode('me').userData.actions['${slot}']; if (a) a.paused = false; })()`);
  }
  // 한 장으로 모으기 — 줄 = 무기·단(15), 칸 = 세 순간
  const sheet = await c.ev(`(async function(){ var T = ${JSON.stringify(tiles)}, tw = 150, th = 190, cols = 9, rows = Math.ceil(T.length / cols);
    var cv = document.createElement('canvas'); cv.width = cols * tw; cv.height = rows * (th + 14); var g = cv.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, cv.width, cv.height);
    for (var i = 0; i < T.length; i++) { var im = new Image(); im.src = 'data:image/png;base64,' + T[i].data; await im.decode();
      var x = (i % cols) * tw, y = Math.floor(i / cols) * (th + 14); g.drawImage(im, x, y + 14, tw, th); g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText(T[i].label, x + 3, y + 11); }
    return cv.toDataURL('image/png').split(',')[1]; })()`);
  if (typeof sheet !== "string" || sheet.startsWith("ERR")) { console.log("SHEETERR", String(sheet).slice(0, 300)); } else fs.writeFileSync(OUTF, Buffer.from(sheet, "base64"));
  console.log('SHEET', OUTF, tiles.length);
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard); await c.close(); srv.kill();
