// 사가국지 시나리오 단계(PLAN §5-13)·회차(§5-14): 실제 화면에서 설전·일기토·성 차지 카드 흐름과 회차 단추가 서나 · 예외 없나
// 사진은 `shot` 을 줄 때만(shots/rk_stage_*). PC_PROF=tmp/… 새 프로필로 돌릴 것. 서버: node serve.mjs C:/swbins/saga-web 8871
import { launch, sleep } from './cdp.mjs';
const shot = process.argv.includes('shot');
const B = 'http://127.0.0.1:8871/saga-realm/';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 170000);
const fake = (o) => `({ getAttribute: function (k) { return ${JSON.stringify(o)}[k] || null; } })`;
const enc = () => c.ev(`(function(){ var e = document.getElementById('encounter'); return JSON.stringify({ show: e.classList.contains('show'), acts: [].map.call(e.querySelectorAll('[data-act]'), function (b) { return b.getAttribute('data-act'); }).join(','), text: e.textContent.replace(/\\s+/g, ' ').slice(0, 150) }); })()`);
try {
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('단계'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(3000);
  console.log('판', await c.ev(`(function(){
    DG.ui._act('pick-scen', ${fake({ 'data-id': '194' })});
    DG.ui._act('pick-force', document.querySelector('[data-act="pick-force"]'));
    var R = DG.rtk; return JSON.stringify({ me: R.me(), scen: R.state().scen, round: R.roundNo(), off: !!window.DG_NO_SCENARIO });
  })()`));
  await sleep(2000);
  // ── 설전: 첫 화친(r1_first_ally) ──
  await c.ev(`(function(){ var st = DG.rtk.state(); DG.scenario.state(); DG.scenario.state().done = { r1_start: { k: 'def', turn: 0 }, r1_rift_sign: { k: 'def', turn: 1 } }; st.turn = 24; DG.event.tick(); DG.ui.showEvent(); })()`);
  console.log('1 카드', await enc());
  await c.ev(`DG.ui._act('ev-pick', ${fake({ 'data-k': 'def' })})`);
  await c.ev(`(function(){ DG.ui.closeEnc(); DG.rtk.state().turn += 1; DG.event.tick(); DG.ui.showEvent(); })()`);
  console.log('2 설전 도입', await enc());
  await c.ev(`DG.ui._act('ev-pre', ${fake({})})`);
  console.log('3 문답', await enc());
  for (let i = 0; i < 3; i++) {
    await c.ev(`DG.ui._act('deb-answer', ${fake({ 'data-i': '0' })})`);
    await c.ev(`DG.ui._act('deb-next', ${fake({})})`);
  }
  console.log('4 설전 결과 카드', await enc());
  if (shot) { await c.shot('rk_stage_0_debate_result'); }
  await c.ev(`DG.ui._act('ev-pick', ${fake({ 'data-k': 'def' })})`);
  console.log('5 끝', await c.ev(`JSON.stringify({ stage: !!DG.scenario.state().stage, view: !!DG.event.view() })`));
  // ── 성 차지: 관도(r2_plains) ──
  await c.ev(`(function(){ DG.ui.closeEnc(); var st = DG.rtk.state(); var d = DG.scenario.state().done; d.r1_first_ally = { k: 'def', turn: 1 }; d.r2_fallen = { k: 'def', turn: 2 }; st.turn = 60; DG.event.tick(); DG.ui.showEvent(); })()`);
  console.log('6 관도 카드', await enc());
  await c.ev(`DG.ui._act('ev-pick', ${fake({ 'data-k': 'def' })})`);
  console.log('7 목표', await c.ev(`(function(){ var g = DG.scenario.state().stage; var cd = g && DG.cityData.find(g.target); var lines = DG.scenario.lines().filter(function (x) { return x.state === 'goal'; }); DG.ui.closeEnc(); DG.ui.openSheet('log'); var body = document.getElementById('sheet-body').textContent; DG.ui.closeSheet(); return JSON.stringify({ kind: g && g.kind, target: cd && cd.name, land: cd && cd.land, mine: DG.rtk.citiesOf(DG.rtk.me()).length, sheetGoal: body.indexOf('🎯') >= 0, note: lines[0] && lines[0].note }); })()`));
  if (shot) { await c.shot('rk_stage_1_goal'); }
  await c.ev(`(function(){ var g = DG.scenario.state().stage; DG.rtk.city(g.target).force = DG.rtk.me(); DG.rtk.state().turn += 2; DG.event.tick(); DG.ui.showEvent(); })()`);
  console.log('8 성 차지 결과', await enc());
  await c.ev(`DG.ui._act('ev-pick', ${fake({ 'data-k': 'def' })})`);
  // ── 일기토: 영점(r3_duel) ──
  await c.ev(`(function(){ DG.ui.closeEnc(); var st = DG.rtk.state(), d = DG.scenario.state().done; ['r2_plains','r2_debate','r3_navigator','r3_river'].forEach(function (k) { d[k] = { k: 'def', turn: 3 }; }); st.turn = 100; DG.event.tick(); DG.ui.showEvent(); })()`);
  console.log('9 영점 카드', await enc());
  await c.ev(`DG.ui._act('ev-pick', ${fake({ 'data-k': 'def' })})`);
  await c.ev(`(function(){ DG.ui.closeEnc(); DG.rtk.state().turn += 1; DG.event.tick(); DG.ui.showEvent(); })()`);
  console.log('10 일기토 도입', await enc());
  await c.ev(`DG.ui._act('ev-pre', ${fake({})})`);
  console.log('11 손 싸움', await enc());
  if (shot) { await c.shot('rk_stage_2_duel'); }
  await c.ev(`(function(){ for (var g = 0; document.querySelector('#encounter [data-act="duel-pick"]') && g < 10; g++) { DG.ui._act('duel-pick', ${fake({ 'data-pick': 'slash' })}); } })()`);
  console.log('12 승부', await enc());
  await c.ev(`DG.ui._act('duel-go', ${fake({})})`);
  console.log('13 일기토 결과 카드', await enc());
  await c.ev(`DG.ui._act('ev-pick', ${fake({ 'data-k': 'def' })})`);
  // ── 회차 ──
  console.log('14 회차 카드', await c.ev(`(function(){ DG.ui.closeEnc(); var st = DG.rtk.state(); st.victories = [{ kind: 'culture', month: 5 }]; DG.core.emit('rtk:victory', DG.rtk.resultCard('culture')); var e = document.getElementById('encounter'); return JSON.stringify({ btn: !!e.querySelector('[data-act="next-round"]'), text: e.textContent.replace(/\\s+/g, ' ').slice(-170) }); })()`));
  if (shot) { await c.shot('rk_stage_3_round_card'); }
  await c.ev(`DG.ui._act('next-round', ${fake({})})`);
  await sleep(1500);
  console.log('15 2회차', await c.ev(`(function(){ var R = DG.rtk, st = R.state(); return JSON.stringify({ round: R.roundNo(), turn: st.turn, me: st.me, cities: R.citiesOf(st.me).length, best: R.roundBest(), top: document.getElementById('top') ? document.getElementById('top').textContent.replace(/\\s+/g, ' ').slice(0, 80) : '' }); })()`));
  if (shot) { await c.shot('rk_stage_4_round2'); }
  const ex = c.logs.filter((l) => /^EXC|error/i.test(l) && !/WebGLProgram|Shader|ERROR: 0:|Program Info/i.test(l));
  console.log(ex.length ? ex.slice(0, 6).join('\n') : '예외 없음');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
