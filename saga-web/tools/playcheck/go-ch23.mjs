// 사가만리 ⑲-47 — 23장 등대: 🤖📖 자동이 돌탑을 타고 올라 난간 판에서 등롱에 불을 넣는가 + 켜진 등대·기록실 단말·파랑·파수 거신 사진(shots/go_ch23_*)
// 인자: 초(기본 240)
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-go/';
const SECS = +(process.argv.find((a) => /^\d+$/.test(a)) || 240);
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, (SECS + 200) * 1000);
const st = () => c.ev(`JSON.stringify({ ch: DG.story.state().ch, i: DG.story.state().step, doing: DG.auto.status().doing, perched: DG.landform.perched(), lit: DG.sunken.lighthouseLit(), p: (function(){ var p = DG.core.save.player.pos; return Math.round(p.x) + ',' + Math.round(p.y); })() })`);
try {
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('등대'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  await c.ev(`DG.perf.pin('LOW'); DG.core.save.settings.autoBattle = true; DG.core.save.player.level = 60;`);
  /* 들판 무리는 끈다 — 헤드리스는 초당 두세 프레임이라 곁 무리와 싸우다 1km 넘게 끌려갔다(등대 풀이만 본다). 보스 칸에서 다시 켠다 */
  if (!process.argv.includes('field')) { await c.ev(`DG.core.setTune('field.on', 0)`); }
  /* 23장 둘째 단계(돌탑 오르기) — 등대 남쪽 25m 에 세운다 */
  console.log('자리', await c.ev(`(function(){ var sv = DG.story.state(); sv.ch = 22; sv.step = 1; var L = DG.sunken.siteById('lighthouse'), p = DG.core.save.player.pos; p.x = L.x; p.y = L.y + 25; DG.world.walkTo(p.x, p.y); return JSON.stringify({ L: [Math.round(L.x), Math.round(L.y)], target: DG.story.targetOf(DG.story.step()) }); })()`));
  if (!process.argv.includes('field')) { await c.ev(`DG.core.setTune('field.on', 0); DG.fieldCombat._resetForTest && DG.fieldCombat._resetForTest();`); }
  await sleep(3000);
  await c.shot('go_ch23_1_foot');
  await c.ev(`DG.auto.setOn(true)`);
  const t0 = Date.now(); let lastI = 1;
  while (Date.now() - t0 < SECS * 1000) {
    await sleep(3000);
    const r = JSON.parse(await st());
    if (r.perched) { await c.ev(`DG.core.setTune('field.on', null)`); }   // 난간 판에 서면 전투(스킬)를 다시 켠다 — 꺼 두면 원소 스킬도 막힌다
    if (r.i !== lastI || Math.round((Date.now() - t0) / 1000) % 30 < 3) { console.log(Math.round((Date.now() - t0) / 1000) + 's', JSON.stringify(r).slice(0, 200)); }
    if (r.i !== lastI) { lastI = r.i; if (r.i === 3) { await c.ev(`DG.auto.setOn(false)`); await sleep(2500); await c.shot('go_ch23_2_lit'); break; } }
  }
  /* 기록실 앞 — 파랑·단말 */
  await c.ev(`(function(){ var sv = DG.story.state(); sv.ch = 22; sv.step = 4; var q = DG.sunken.spot('parang'), p = DG.core.save.player.pos; p.x = q.x - 3; p.y = q.y + 7; DG.world.walkTo(p.x, p.y); DG.landform._resetForTest && 0; })()`);
  await sleep(4000);
  await c.shot('go_ch23_3_record');
  /* 파수 거신 */
  await c.ev(`DG.core.setTune('field.on', null)`);
  await c.ev(`(function(){ var sv = DG.story.state(); sv.ch = 22; sv.step = 5; var t = DG.story.targetOf(DG.story.step()), p = DG.core.save.player.pos; p.x = t.x + 6; p.y = t.y + 6; DG.world.walkTo(p.x, p.y); DG.story.check(); })()`);
  await sleep(4000);
  console.log('보스', await c.ev(`(function(){ var S = DG.fieldCombat.state(), out = []; for (var u in S.foes) { var f = S.foes[u]; if (!f.dead && f.boss) { out.push(f.name + ' ' + f.el + ' ' + Math.round(f.hp)); } } return out.join(' / '); })()`));
  await c.shot('go_ch23_4_colossus');
  const ex = c.logs.filter((l) => /^EXC/.test(l));
  if (ex.length) { console.log(ex.slice(0, 4).join('\n')); }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
await c.close();
process.exit(0);
