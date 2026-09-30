// 사가스토리 5차 전직(PLAN §10-Q7)·회귀(§5-14): 무예창에 5차가 서나 · 띠 맨 윗자리 · 각성기가 실제로 적을 치나 · 이야기 시트 회귀 단추 → 2회차 적 체력 배율 · 예외 없나
// 사진은 `shot` 을 줄 때만(shots/st_tier5_*). PC_PROF=tmp/… 새 프로필로 돌릴 것
import { launch, sleep } from './cdp.mjs';
const shot = process.argv.includes('shot');
const B = 'http://127.0.0.1:8871/saga-story/';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 170000);
const fake = (o) => `({ getAttribute: function (k) { return ${JSON.stringify(o)}[k] || null; } })`;
try {
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('오차'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(4000);
  console.log('전직', await c.ev(`(function(){
    var C = DG.core, J = DG.job, i;
    C.save.player.level = 90; C.save.job = 'none'; C.save.skills = {};
    J.join('warrior'); for (i = 0; i < 5; i++) { J.raise('w_cut'); }
    J.join('general'); for (i = 0; i < 8; i++) { J.raise('g_smash'); }
    J.join('marshal'); for (i = 0; i < 10; i++) { J.raise('n_heaven'); }
    J.join('warlord'); for (i = 0; i < 10; i++) { J.raise('o_ruin'); }
    var why = J.canJoin('godwar'); var ok = J.join('godwar');
    for (i = 0; i < 3; i++) { J.raise('p_wrath'); }
    var bar = J.bar();
    return JSON.stringify({ why: why, joined: ok, job: C.save.job, bar: bar.map(function (s) { return s.name; }), left: J.spLeft() });
  })()`));
  await c.ev(`DG.ui.openSheet('job')`);
  console.log('무예창', await c.ev(`(function(){ var t = document.getElementById('sheet-body').textContent.replace(/\\s+/g, ' '); return JSON.stringify({ godwar: t.indexOf('군신') >= 0, wrath: t.indexOf('천멸격') >= 0, banner: t.indexOf('군신강림') >= 0, len: t.length }); })()`));
  if (shot) { await c.shot('st_tier5_0_job'); }
  await c.ev(`DG.ui.closeSheet()`);
  console.log('입장', await c.ev(`(function(){ var S = DG.side; var st = S.stages().map(function (x) { return x.ref; }).filter(function (s) { return !s.town; })[0]; return JSON.stringify({ stage: st.key, ok: S.enter(st.key) }); })()`));
  await sleep(2500);
  console.log('각성기', await c.ev(`(function(){
    var S = DG.side, J = DG.job, run = S.raw(), p = run.player;
    p.x = 200; p.y = run.stage.floor - S.P_H; p.onGround = true; p.facing = 1;
    run.enemies = [{ ref: { name: '허수아비', kind: 'human', look: {} }, x: p.x + 40, y: p.y, w: 34, h: 34, hp: 99999, hpMax: 99999, dmg: 0, dir: -1, homeY: p.y + 34, spd: 0, phase: 0, hurt: 0, cd: 99 }];
    run.mp = run.mpMax = 999;
    var bar = J.bar(), at = -1, i; for (i = 0; i < bar.length; i++) { if (bar[i].key === 'p_wrath') { at = i; } }
    var b = run.enemies[0].hp; S.castSkill(at); return JSON.stringify({ at: at, dealt: b - run.enemies[0].hp });
  })()`));
  await sleep(1200);
  if (shot) { await c.shot('st_tier5_1_cast'); }
  // 회귀 — 이야기를 다 본 뒤
  const hp = (round) => c.ev(`(function(){
    var S = DG.side, C = DG.core; if (S.active()) { S.leave(); }
    ${round ? 'var r = DG.scenario.nextRound();' : ''}
    var st = S.stages().map(function (x) { return x.ref; }).filter(function (s) { return !s.town; })[0]; S.enter(st.key);
    var run = S.raw(); run.enemies = []; var rnd = Math.random; Math.random = function () { return 0.9; }; S.spawnEnemy(300); Math.random = rnd;
    var e = run.enemies[0], out = { round: DG.scenario.roundNo(), hp: e.hpMax, dmg: e.dmg }; S.leave(); return JSON.stringify(out);
  })()`);
  const h1 = JSON.parse(await hp(false));
  await c.ev(`(function(){ DG.scenario.state(); DG.scenarioData.CHAPTERS.forEach(function (ch) { DG.scenario.state().done[ch.id] = 1; }); DG.core.emit('changed'); })()`);
  await c.ev(`(function(){ if (DG.side.active()) { DG.side.leave(); } DG.side.enter('sinya'); })()`);
  await sleep(800);
  await c.ev(`DG.ui.openSheet('story')`);
  console.log('회귀 카드', await c.ev(`(function(){ var b = document.querySelector('#sheet-body [data-act="round-next"]'); var t = document.getElementById('sheet-body').textContent.replace(/\\s+/g, ' '); return JSON.stringify({ why: DG.scenario.roundWhy(), act: DG.side.active(), btn: !!b, card: t.slice(t.indexOf('회귀'), t.indexOf('회귀') + 110) }); })()`));
  if (shot) { await c.shot('st_tier5_2_round_card'); }
  await c.ev(`(function(){ var b = document.querySelector('#sheet-body [data-act="round-next"]'); if (b) { b.click(); } })()`);
  await sleep(800);
  console.log('클릭 뒤', await c.ev(`JSON.stringify({ round: DG.scenario.roundNo(), gold: DG.core.save.player.gold, sheet: document.getElementById('sheet-body').textContent.replace(/\\s+/g, ' ').slice(-140) })`));
  await c.ev(`DG.ui.closeSheet()`);
  const h2 = JSON.parse(await hp(false));
  console.log('적 배율', JSON.stringify({ r1: h1, r2: h2, hpX: +(h2.hp / h1.hp).toFixed(3), dmgX: +(h2.dmg / h1.dmg).toFixed(3) }));
  const ex = c.logs.filter((l) => /^EXC|error/i.test(l) && !/WebGLProgram|Shader|ERROR: 0:|Program Info/i.test(l));
  console.log(ex.length ? ex.slice(0, 6).join('\n') : '예외 없음');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
