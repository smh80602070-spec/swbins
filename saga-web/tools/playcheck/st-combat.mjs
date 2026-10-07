// 사가종횡 Q10 — 첫 사냥터에서 🤖 자동 사냥을 켜고 잰다: 처치 수·한 마리당 때린 수·걸린 초·내 체력 · 사진(캐릭터가 화면에서 얼마나 보이나)
// 인자: 초(기본 90) · 사냥터 키(기본 첫 사냥터)
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-story/';
const SECS = +(process.argv.find((a) => /^\d+$/.test(a)) || 90);
const KEY = process.argv.find((a) => /^[a-z_]+$/.test(a) && a !== 'fresh') || '';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, (SECS + 120) * 1000);
try {
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('확인'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(4000);
  const setup = await c.ev(`(function(){
    var S = DG.side, C = DG.core;
    if (!C.save.party.length) { var h = DG.data.heroes.filter(function (x) { return x.rarity <= 2; })[0]; if (DG.hero && DG.hero.recruit) { DG.hero.recruit(h.id); } else { C.save.dex = C.save.dex || {}; } if (!C.save.party.length) { C.save.party.push(h.id); } }
    var st = S.stages().map(function (x) { return x.ref; }).filter(function (s) { return !s.town && ('${KEY}' ? s.key === '${KEY}' : true); })[0];
    var ok = S.enter(st.key);
    return JSON.stringify({ stage: st.key, name: st.name, ok: ok, party: C.save.party, lv: C.save.player && C.save.player.level });
  })()`);
  console.log('입장', setup);
  await sleep(3000);
  await c.ev(`(function(){
    window.__hits = 0; window.__kills = []; window.__hurt = 0;
    var C = DG.core;
    C.on('side:hit', function (e) { window.__hits++; });
    C.on('side:kill', function (e) { window.__kills.push(Date.now()); });
    C.on('side:hurt', function () { window.__hurt++; });
    DG.auto.setOn(true);
  })()`);
  /* 첫 발 장면(이야기 대화)이 열려 있으면 사냥이 멎는다 — 사람처럼 넘긴다(자동으로 계속 닫아 둔다) */
  await c.ev(`setInterval(function(){ if (DG.story && DG.story.isOpen()) { DG.story.skip(); } }, 500)`);
  const t0 = Date.now();
  await sleep(6000); await c.shot('st_combat_6s');
  while (Date.now() - t0 < SECS * 1000) { await sleep(5000); }
  await c.shot('st_combat_end');
  console.log(await c.ev(`(function(){
    var r = DG.side.raw(), p = r && r.player, en = r ? r.enemies.filter(function (e) { return e.hp > 0; }) : [];
    var one = en[0];
    return JSON.stringify({ kills: r && r.kills, hitEvents: window.__hits, killEvents: window.__kills.length, hurt: window.__hurt,
      hp: p && (Math.round(p.hp || r.hp) + '/' + Math.round(p.hpMax || r.hpMax)), enemies: en.length,
      oneEnemy: one ? { name: one.name, hp: Math.round(one.hp), hpMax: one.hpMax, boss: !!one.boss } : null,
      atk: DG.side.power && DG.side.power(), doing: DG.auto.status().doing });
  })()`));
  await c.ev(`DG.auto.setOn(false)`);
  const ex = c.logs.filter((l) => /^EXC/.test(l));
  if (ex.length) { console.log(ex.slice(0, 4).join('\n')); }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
