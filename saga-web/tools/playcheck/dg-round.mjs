// 사가나락 회귀(회차, PLAN §5.21): 퀘스트 시트 이야기 아래 🔁 카드·단추 → 2회차, 적 체력·공격 배율, 예외 없나
// 사진은 `shot` 을 줄 때만(shots/dg_round_*). PC_PROF=tmp/… 새 프로필로 돌릴 것
import { launch, sleep } from './cdp.mjs';
const shot = process.argv.includes('shot');
const B = 'http://127.0.0.1:8871/saga-dungeon/';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 150000);
try {
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('회귀'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(3000);
  await c.ev(`(function(){ var cells = document.querySelectorAll('.stc-cell'); for (var i = 0; i < 3 && i < cells.length; i++) { cells[i].click(); } var b = document.querySelector('.stc-btn'); if (b) { b.click(); } })()`);
  await sleep(4000);
  const hp = () => c.ev(`JSON.stringify({ round: DG.scenario.roundNo(), hp: DG.dungeon.enemyHp(10, false), dmg: DG.dungeon.enemyDmg(10, false), boss: DG.dungeon.enemyHp(10, true) })`);
  const h1 = JSON.parse(await hp());
  console.log('1회차', JSON.stringify(h1));
  await c.ev(`(function(){ DG.scenario.state(); DG.scenarioData.CHAPTERS.forEach(function (ch) { DG.scenario.state().done[ch.id] = 1; }); DG.core.emit('changed'); DG.ui.openSheet('quest'); })()`);
  console.log('카드', await c.ev(`(function(){ var b = document.querySelector('#sheet-body [data-act="round-next"]'); var t = document.getElementById('sheet-body').textContent.replace(/\\s+/g, ' '); var i = t.indexOf('🔁'); return JSON.stringify({ why: DG.scenario.roundWhy(), btn: !!b, card: t.slice(i, i + 120) }); })()`));
  if (shot) { await c.shot('dg_round_0_card'); }
  await c.ev(`(function(){ var b = document.querySelector('#sheet-body [data-act="round-next"]'); if (b) { b.click(); } })()`);
  await sleep(800);
  console.log('클릭 뒤', await c.ev(`(function(){ var t = document.getElementById('sheet-body').textContent.replace(/\\s+/g, ' '); var i = t.indexOf('🔁'); return JSON.stringify({ round: DG.scenario.roundNo(), gold: DG.core.save.player.gold, card: t.slice(i, i + 170) }); })()`));
  if (shot) { await c.shot('dg_round_1_after'); }
  const h2 = JSON.parse(await hp());
  console.log('배율', JSON.stringify({ hpX: +(h2.hp / h1.hp).toFixed(3), dmgX: +(h2.dmg / h1.dmg).toFixed(3), bossX: +(h2.boss / h1.boss).toFixed(3) }));
  const ex = c.logs.filter((l) => /^EXC|error/i.test(l) && !/WebGLProgram|Shader|ERROR: 0:|Program Info/i.test(l));
  console.log(ex.length ? ex.slice(0, 6).join('\n') : '예외 없음');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
