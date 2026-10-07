// 사가천하 Q9·Q11 — 새 판(194) → 이웃 적 성으로 출진 → 전투 화면을 합마다 찍고 걸린 시간·누른 횟수를 잰다
// 인자: auto(누르지 않고 기다리기 — 실시간 전투가 저절로 흐르는지) · 초(auto 일 때 기다릴 최대, 기본 40)
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-realm/';
const PRESS = process.argv.includes('press');
const SIM = !process.argv.includes('nosim');   // 헤드리스는 프레임이 느려 그림 시뮬을 벽시계만큼 앞당겨 준다(nosim 이면 안 함)
const SECS = +(process.argv.find((a) => /^\d+$/.test(a)) || 120);
const PHONE = process.argv.includes('phone');   // 폰 세로(412×915)
const c = await launch(PHONE ? 412 : 1280, PHONE ? 915 : 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, (SECS + 150) * 1000);
const fake = (o) => `({ getAttribute: function (k) { return ${JSON.stringify(o)}[k] || null; } })`;
try {
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('확인'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(3000);
  /* 가장 센 세력으로 시작해 이웃 적 성 하나를 고른다 */
  const pick = await c.ev(`(function(){
    var R = DG.rtk, CD = DG.cityData || DG.cities, FD = DG.forceData;
    DG.ui._act('pick-scen', ${fake({ 'data-id': '194' })});
    var fs = FD.forces ? FD.forces() : null;
    var btn = document.querySelector('[data-act="pick-force"]');
    DG.ui._act('pick-force', btn);
    var me = R.me(), best = null;
    R.citiesOf(me).forEach(function (cid) {
      var c = R.city(cid), info = (DG.cityData || DG.CD).find(cid);
      info.adj.forEach(function (to) {
        var t = R.city(to);
        if (!t || !t.force || t.force === me) { return; }
        if ((DG.cityData || DG.CD).isWater(cid, to)) { return; }
        if (R.readyAt(cid).length && (!best || c.troops > best.troops)) { best = { from: cid, to: to, troops: c.troops, def: t.troops }; }
      });
    });
    return JSON.stringify({ me: me, best: best });
  })()`);
  console.log('판', pick);
  const best = JSON.parse(pick).best;
  await c.ev(`DG.ui._act('march', ${fake({ 'data-from': best.from, 'data-to': best.to })})`);
  await sleep(800);
  await c.shot('rk_march_card');
  await c.ev(`document.querySelector('[data-act="ask-ok"]').click()`);
  const t0 = Date.now();
  let clicks = 0, shots = 0, lastShot = -99;
  /* 실시간 전장 — 누르지 않아도 합이 흐르는가(시계), 병사가 붙어 싸우고 쓰러지는가(armyView). press 인자면 5초에 돌격 한 번 */
  for (let i = 0; i < 600; i++) {
    await sleep(500);
    if (SIM) { await c.ev(`DG.battle3d.simArmy && DG.battle3d.simArmy(0.5)`); }
    const s = await c.ev(`(function(){
      var d = document.querySelector('[data-act="duel-pick"],[data-act="duel-go"]');
      var rd = document.getElementById('bhud-round');
      var res = document.querySelector('#liveresult .bres');
      var v = DG.battle3d.armyView && DG.battle3d.armyView();
      return JSON.stringify({ duel: !!d, round: rd ? rd.textContent : '', done: !!res, head: res ? res.querySelector('h3').textContent : '', army: v });
    })()`);
    const j = JSON.parse(s);
    const el = (Date.now() - t0) / 1000;
    if (j.duel) {
      if (!shots++) { await c.shot('rk_duel'); }
      await c.ev(`(function(){ var d = document.querySelector('[data-act="duel-go"]') || document.querySelector('[data-pick="auto"]'); d.click(); })()`);
      clicks++;
      continue;
    }
    if (el - lastShot > 6) {
      lastShot = el;
      const v = j.army;
      console.log(el.toFixed(1) + 's', j.round, v ? 'a ' + v.a.alive + '/' + v.a.n + ' 붙음' + v.a.engaged + ' 몸' + v.a.bodies + ' · d ' + v.d.alive + '/' + v.d.n + ' 붙음' + v.d.engaged + ' 몸' + v.d.bodies + ' 벽' + v.wallUp + (v.sortie ? ' 야전' : ' 공성') + ' ' + v.stance : '');
      await c.shot('rk_live_' + (PHONE ? 'p' : '') + Math.round(el));
    }
    if (PRESS && el > 5 && !clicks) { await c.ev(`document.querySelector('#livecmd [data-cmd="press"]').click()`); clicks++; }
    if (j.done) { console.log('끝', el.toFixed(1) + 's', j.head, '누름', clicks, j.round); await sleep(1500); break; }
    if (el > SECS) { console.log('기다림 끝', JSON.stringify(j)); break; }
  }
  await c.shot('rk_battle_end');
  const ex = c.logs.filter((l) => /^EXC/.test(l));
  if (ex.length) { console.log(ex.slice(0, 4).join('\n')); }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
