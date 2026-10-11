// W-0171 2나락 3D 무기 몸짓·자체 타격음 확인 — 새 계정 → 동료 셋 → 1층, 공격을 여섯 번 걸어 주인공 몸이 Wpn_ 1·2·3타를 트는지·맞는 소리가 샘플로 나는지 센다
// node saga-web/tools/playcheck/dg-wpn-probe.mjs  (서버·크롬은 여기서 띄우고 PID 로만 끈다, 화면은 shots/dg-probe.png)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { launch, sleep } from './cdp.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8898, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', 'saga-dungeon')], { stdio: 'ignore' });
await sleep(800);
const c = await launch(1000, 700);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); srv.kill(); process.exit(1); }, 200000);
try {
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  const B = `http://127.0.0.1:${PORT}/`;
  await c.go(B + 'index.html', 5000);
  await c.ev(`DG.account && DG.account.create && DG.account.create('확인')`);
  await c.go(B + 'index.html', 7000);
  await c.ev(`(function(){ var b = document.getElementById('title-continue'); if (b) b.click(); })()`);
  await sleep(4000);
  for (let i = 0; i < 10; i++) { await c.key('Escape', 60); await sleep(200); }
  await c.ev(`(function(){ var cs = document.querySelectorAll('.stc-cell'); for (var i = 0; i < 3 && i < cs.length; i++) cs[i].click(); var b = document.querySelector('.stc-btn'); if (b) b.click(); })()`);
  await sleep(2500);
  for (let i = 0; i < 10; i++) { await c.key('Escape', 60); await sleep(200); }
  await c.key('a', 80);   // 손짓 = 소리 잠금 해제
  await c.ev(`DG.dungeon.enter({ floor: 1 })`);
  await sleep(6000);
  await c.ev(`(function(){ window.__hit = { sample: 0, synth: 0 }; var X = DG.sfx, h = X.hitOf; X.hitOf = function (l, i) { var ok = h(l, i); window.__hit[ok ? 'sample' : 'synth']++; return ok; };
    window.__anims = {}; window.__nul = []; var AS = DG.ownAnim.attackSlot; DG.ownAnim.attackSlot = function (st, v, now, k, sp) { var r = AS.call(DG.ownAnim, st, v, now, k, sp); if (v > 0 && !r && window.__nul.length < 12) { window.__nul.push([+v.toFixed ? v.toFixed(3) : v, (st.v||0).toFixed(3), st.slot, (st.until - now).toFixed(3)].join(':')); } return r; }; setInterval(function(){ var m = DG.dungeon3d._meMix && DG.dungeon3d._meMix(); var a = m && m.userData && m.userData.anim; if (a) { window.__anims[a] = (window.__anims[a] || 0) + 1; } }, 50); })()`);
  const seq = [];
  for (let k = 0; k < 6; k++) {
    seq.push(await c.ev(`(function(){ var R = DG.dungeon.raw(); R.combo = ${k} + 1; var p = R.player; p.atkAnim = 0.3 + ${k} * 0.001; p.castAnim = false; return new Promise(function (res) { setTimeout(function () { var m = DG.dungeon3d._meMix(); res((m && m.userData.anim) + ' acts=' + Object.keys(m.userData.actions).filter(function(n){return n.indexOf('Wpn_')===0;}).join('/')); }, 160); }); })()`));
    await sleep(900);
  }
  console.log(seq.join(' | '));
  const out = await c.ev(`JSON.stringify({ nul: window.__nul, anims: window.__anims, hit: window.__hit, own: !!(DG.dungeon3d._meMix() && DG.dungeon3d._meMix().userData.ownAnim), look: (function(){ var IT = DG.item, w = IT.equipped(DG.core.save.party[0]).weapon; return w ? (IT.baseOf(w)||{}).look : 'none'; })(), combo: DG.dungeon.raw() && DG.dungeon.raw().combo, sfxOn: DG.sfx.ready() })`);
  console.log(out);
  const s = await c.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(HERE, 'shots', 'dg-probe.png'), Buffer.from(s.result.data, 'base64'));
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard); await c.close(); srv.kill();
