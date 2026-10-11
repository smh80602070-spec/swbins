// node saga-web/tools/playcheck/rk-hand-shot.mjs → shots/rk_hand_{1_sheet,2_pop,3_card}.png (W-0177)
// 5천하 한 달 손질 — 성 시트 🤝 맡기기 단추 · 상단 🤝 전부 뒤 지도 위 결과 숫자 · 실제 Enter 키로 다음 달 → 달말 카드 한 장(결산 + 사연 칸)
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8915, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', 'saga-realm')], { stdio: 'ignore' });
await sleep(800);
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); srv.kill(); process.exit(1); }, 180000);
const fake = (o) => `({ getAttribute: function (k) { return ${JSON.stringify(o)}[k] || null; } })`;
try {
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  const B = `http://127.0.0.1:${PORT}/`;
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('손질'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(3000);
  console.log('판', await c.ev(`(function(){
    DG.ui._act('pick-scen', ${fake({ 'data-id': '194' })});
    DG.ui._act('pick-force', document.querySelector('[data-act="pick-force"]'));
    var g = 0; while (document.getElementById('encounter').classList.contains('show') && g++ < 10) { DG.ui.closeEnc(); }
    DG.core.setTune('rtk.newsChance', 1);
    var R = DG.rtk, me = R.me(); R.force(me).gold = 99999;
    DG.ui.openCity(R.citiesOf(me)[0]);
    var b = document.querySelector('#sheet-body [data-rkh-del]'); if (b) { b.scrollIntoView({ block: 'center' }); }
    return JSON.stringify({ me: me, cities: R.citiesOf(me).length, btn: b ? b.textContent : null, all: !!document.querySelector('#wallet [data-rkh-del="*"]') });
  })()`));
  await sleep(800);
  await c.shot('rk_hand_1_sheet');
  console.log('맡기기', await c.ev(`(function(){
    DG.ui.closeSheet();
    document.querySelector('#wallet [data-rkh-del="*"]').click();
    return JSON.stringify({ pops: [].map.call(document.querySelectorAll('#realm .rpop'), function (t) { return t.textContent; }), toast: document.getElementById('toast').textContent });
  })()`));
  await sleep(250);
  await c.shot('rk_hand_2_pop');
  await sleep(900);
  const t0 = await c.ev(`DG.rtk.state().turn`);
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(1200);
  console.log('Enter', await c.ev(`JSON.stringify({ turn: DG.rtk.state().turn - ${t0}, card: !!document.querySelector('#encounter.show'), picks: document.querySelectorAll('#encounter [data-rkh-pick]').length, okLocked: !!(document.querySelector('#encounter [data-rkh-ok]') || {}).disabled })`));
  await c.shot('rk_hand_3_card');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard); await c.close(); srv.kill();
