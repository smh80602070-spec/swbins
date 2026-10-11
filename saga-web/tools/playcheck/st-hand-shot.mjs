// node saga-web/tools/playcheck/st-hand-shot.mjs → shots/st_hand_{1_relic,2_secret}.png (W-0176)
// 4종횡 조작·숨은 것 — 허창 들판에서 옛 조각(🧩)·숨은 상자(🎁)가 보이나 · 공격 단추 Z 글자·🌀 무예 자동 단추 · 실제 Z 키를 누르고 있으면 계속 치나 · 숨은 발판 위에서 상자가 열리나
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8917, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', 'saga-story')], { stdio: 'ignore' });
await sleep(800);
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); srv.kill(); process.exit(1); }, 180000);
try {
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  const B = `http://127.0.0.1:${PORT}/`;
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('손질'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(3000);
  console.log('들판', await c.ev(`(function(){
    if (DG.story.isOpen()) DG.story.skip(); if (DG.auto.active()) { DG.auto.toggle(); }
    if (DG.side.active()) { DG.side.leave(); }
    DG.side.enter('field');
    var r = DG.side.raw(), st = r.stage; r.enemies = []; r.player.x = st.relics[1] - 220; r.player.invuln = 999;
    return JSON.stringify({ relics: st.relics, secret: st.secret, btn: !!document.getElementById('btn-autoskill'), autoSkill: DG.sideHand.autoSkillOn() });
  })()`));
  await sleep(2500);
  console.log('HUD', await c.ev(`JSON.stringify({ z: !!document.querySelector('.hud-sk .hk'), zText: (document.querySelector('.hud-sk .hk') || {}).textContent })`));
  await c.shot('st_hand_1_relic');
  /* 실제 Z 키 — 누르고 1초 */
  await c.ev(`(function(){ window.__n = 0; var S = DG.side, real = S.castSkill; S.castSkill = function (k) { var ok = real(k); if (ok) { window.__n++; } return ok; }; DG.side.raw().mp = 9999; })()`);
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90 });
  await sleep(1000);
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90 });
  console.log('Z 1초', await c.ev(`window.__n`), '번');
  /* 숨은 발판 위로 옮겨 상자를 연다 */
  console.log('숨은 자리', await c.ev(`(function(){
    var r = DG.side.raw(), st = r.stage, p = r.player; p.x = st.secret.x - 120; p.y = st.secret.y - DG.side.P_H - 40; p.vy = 0;
    return 'moved';
  })()`));
  await sleep(1200);
  await c.shot('st_hand_2_secret');
  console.log('열림', await c.ev(`(function(){ var r = DG.side.raw(), p = r.player, st = r.stage; p.x = st.secret.x - DG.side.P_W / 2; p.y = st.secret.y - DG.side.P_H; p.vy = 0; p.onGround = true; var g = DG.sideHand.check(); return JSON.stringify({ got: g, info: DG.sideHand.stageInfo(st) }); })()`));
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard); await c.close(); srv.kill();
