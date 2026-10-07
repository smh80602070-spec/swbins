// 사가나락 Q8 — "던전에 들어가면 캐릭터가 바뀜": 본영(마을)과 던전에서 내 캐릭터 몸(GLB)·크기를 재고 찍는다
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-dungeon/';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 200000);
const body = () => c.ev(`(function(){
  var D3 = DG.dungeon3d, out = { scene: document.body.className.slice(0, 60) };
  try { out.me = D3 && D3.meBody ? D3.meBody() : null; } catch (e) { out.me = 'ERR ' + e.message; }
  return JSON.stringify(out);
})()`);
try {
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('확인'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(3000);
  await c.ev(`(function(){ var cells = document.querySelectorAll('.stc-cell'); for (var i = 0; i < 3 && i < cells.length; i++) { cells[i].click(); } var b = document.querySelector('.stc-btn'); if (b) { b.click(); } })()`);   // 출사표 — 첫 셋
  await sleep(9000);
  console.log('본영', await body());
  await c.shot('dg_town_me');
  console.log('입장', await c.ev(`JSON.stringify(DG.dungeon.enter({ floor: 1 }))`));
  await sleep(9000);
  console.log('던전', await body());
  await c.shot('dg_dungeon_me');
  if (c.logs.length) { console.log(c.logs.slice(0, 6).join('\n')); }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
